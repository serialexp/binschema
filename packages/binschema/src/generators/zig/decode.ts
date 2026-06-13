// ABOUTME: Field-level decode emission for the Zig generator.
// ABOUTME: Phase 2: primitives, bit fields, strings, bytes, byte-aligned arrays, struct refs.

import { DEC, ALLOC, ROOT, RT } from "./context.js";
import { zigFieldName, zigTypeName, uniqueVar } from "./naming.js";
import {
  zigEndianness,
  zigPrimitiveType,
  zigItemType,
  resolveAlias,
  classifyTypeDef,
  varlengthReadMethod,
  translateConditional,
  stringNeedsTranscode,
  utf16EndiannessLiteral,
} from "./types.js";
import { ZigNotImplemented, type EmitCtx } from "./encode.js";
import { emitEnumDecode } from "./enum.js";
import { emitBitfieldDecode } from "./bitfield.js";
import { emitOptionalDecode } from "./optional.js";
import { emitChoiceDecode, emitDuDecode } from "./union.js";

/**
 * Emit statements to decode a single named field of `target` (e.g. "result")
 * from `dec`, threading allocator + root. Indentation defaults to the method
 * body's 8 spaces.
 */
export function generateFieldDecode(
  field: any,
  ctx: EmitCtx,
  target: string,
  indent = "        ",
): string[] {
  if (field.if) throw new ZigNotImplemented("if-form conditional fields");
  const fname = zigFieldName(field.name);
  // Conditional field: decode only when the guard (evaluated over already-decoded
  // siblings in `target`) is true; otherwise the `?T` field is null. computed/
  // const conditionals are deferred (mirrors the encode side).
  if (field.conditional) {
    if (field.computed) throw new ZigNotImplemented("computed conditional field");
    if (field.const !== undefined) throw new ZigNotImplemented("const conditional field");
    const cond = translateConditional(field.conditional, target, ctx.fields, ctx.schema);
    const lhs = `${target}.${fname}`;
    const inner = emitDecodeValue(field, ctx, lhs, target, indent + "    ");
    return [
      `${indent}if (${cond}) {`,
      ...inner,
      `${indent}} else {`,
      `${indent}    ${lhs} = null;`,
      `${indent}}`,
    ];
  }
  // Computed and const fields are present on the wire (they were written during
  // encode), so they decode exactly like their declared primitive type.
  return emitDecodeValue(field, ctx, `${target}.${fname}`, target, indent);
}

/**
 * Decode a value into the assignment target `lhs`. `structVar` is the enclosing
 * struct result var, used to resolve sibling length/count field references.
 * Shared by struct fields and array items.
 */
export function emitDecodeValue(
  field: any,
  ctx: EmitCtx,
  lhs: string,
  structVar: string,
  indent: string,
): string[] {
  const e = zigEndianness(field.endianness, ctx.endianness);

  const prim = zigPrimitiveType(field);
  if (prim !== null) return emitPrimitiveDecode(field, lhs, e, indent);

  switch (field.type) {
    case "string": return emitStringDecode(field, ctx, lhs, structVar, indent);
    case "bytes": return emitBytesDecode(field, ctx, lhs, structVar, indent);
    case "array": return emitArrayDecode(field, ctx, lhs, structVar, indent);
    case "varlength":
      // On the wire the varlength prefix is a real field; decode it to u64.
      return [`${indent}${lhs} = try ${DEC}.${varlengthReadMethod(field)}();`];
    case "optional": return emitOptionalDecode(field, ctx, lhs, structVar, indent, emitDecodeValue);
    case "bitfield": return emitBitfieldDecode(field, lhs, indent);
    case "discriminated_union": return emitDuDecode(field, ctx, lhs, structVar, indent);
    case "choice": return emitChoiceDecode(field, ctx, lhs, indent);
  }

  const resolved = resolveAlias(ctx.schema, field.type);
  const cls = classifyTypeDef(resolved);
  switch (cls) {
    case "struct":
      return [`${indent}${lhs} = try ${zigTypeName(field.type)}.decodeWith(${ALLOC}, ${DEC}, ${ROOT});`];
    case "string":
      return emitStringDecode(resolved, ctx, lhs, structVar, indent);
    case "bytes":
      return emitBytesDecode(resolved, ctx, lhs, structVar, indent);
    case "array":
      return emitArrayDecode(resolved, ctx, lhs, structVar, indent);
    case "enum":
      return emitEnumDecode(resolved, lhs, field.endianness, ctx.endianness, indent);
    case "discriminated_union":
      return emitDuDecode(resolved, ctx, lhs, structVar, indent);
    case "choice":
      return emitChoiceDecode(resolved, ctx, lhs, indent);
    default:
      throw new ZigNotImplemented(`field type '${field.type}' (type reference)`);
  }
}

function emitPrimitiveDecode(field: any, lhs: string, e: string, indent: string): string[] {
  switch (field.type) {
    case "uint8":
      return [`${indent}${lhs} = try ${DEC}.readUint8();`];
    case "uint16":
    case "uint32":
    case "uint64":
      return [`${indent}${lhs} = try ${DEC}.read${cap(field.type)}(${e});`];
    case "int8":
      return [`${indent}${lhs} = try ${DEC}.readInt8();`];
    case "int16":
    case "int32":
    case "int64":
      return [`${indent}${lhs} = try ${DEC}.read${cap(field.type)}(${e});`];
    case "float32":
      return [`${indent}${lhs} = try ${DEC}.readFloat32(${e});`];
    case "float64":
      return [`${indent}${lhs} = try ${DEC}.readFloat64(${e});`];
    case "bool":
      return [`${indent}${lhs} = (try ${DEC}.readUint8()) != 0;`];
    case "bit":
      return [`${indent}${lhs} = @intCast(try ${DEC}.readBits(${field.size ?? 1}));`];
    case "int": {
      const w = field.size ?? 32;
      return [`${indent}${lhs} = @bitCast(@as(u${w}, @intCast(try ${DEC}.readBits(${w}))));`];
    }
    default:
      throw new ZigNotImplemented(`primitive ${field.type}`);
  }
}

// ---------------------------------------------------------------------------
// Strings (decoded as zero-copy sub-slices of the input)
// ---------------------------------------------------------------------------

function assertSimpleEncoding(field: any): void {
  const enc = field.encoding || "utf8";
  if (enc !== "utf8" && enc !== "ascii") {
    throw new ZigNotImplemented(`string encoding '${enc}' (utf16/latin1 later)`);
  }
}

function emitStringDecode(field: any, ctx: EmitCtx, lhs: string, structVar: string, indent: string): string[] {
  const enc = field.encoding || "utf8";
  if (stringNeedsTranscode(enc)) {
    return emitTranscodedStringDecode(field, ctx, lhs, structVar, indent, enc);
  }
  assertSimpleEncoding(field);
  const kind = field.kind;
  const lines: string[] = [];

  if ((kind === "fixed" || (kind === undefined && field.length !== undefined)) && field.length !== undefined) {
    const s = uniqueVar("_s");
    lines.push(`${indent}const ${s} = try ${DEC}.readBytesSlice(${field.length});`);
    lines.push(`${indent}${lhs} = std.mem.trimEnd(u8, ${s}, &[_]u8{0});`);
    return lines;
  }
  if (kind === "null_terminated" || field.terminator !== undefined) {
    const term = field.terminator !== undefined ? field.terminator : 0;
    lines.push(`${indent}${lhs} = try ${DEC}.readUntilByte(${term});`);
    return lines;
  }
  if (kind === "length_prefixed") {
    const lenVar = uniqueVar("_len");
    lines.push(...emitLengthPrefixDecode(field.length_type || "uint8", lenVar, ctx, indent));
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(${lenVar});`);
    return lines;
  }
  if (kind === "field_referenced" && field.length_field) {
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(@intCast(${siblingRef(field.length_field, structVar)}));`);
    return lines;
  }
  if (field.length_field) {
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(@intCast(${siblingRef(field.length_field, structVar)}));`);
    return lines;
  }
  // Greedy: consume the rest of the buffer.
  const rem = uniqueVar("_rem");
  lines.push(`${indent}const ${rem} = ${DEC}.bytes.len - ${DEC}.byte_offset;`);
  lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(${rem});`);
  return lines;
}

/**
 * latin1 / utf16 string decode: read the wire bytes for this field, then
 * transcode them to in-memory UTF-8 (allocated via the arena `allocator`). For
 * fixed widths the meaningful prefix ends at the first null (1 byte for latin1,
 * a 0x0000 code unit for utf16); null_terminated stops at and consumes that same
 * sentinel.
 */
function emitTranscodedStringDecode(
  field: any, ctx: EmitCtx, lhs: string, structVar: string, indent: string, enc: string,
): string[] {
  const isLatin1 = enc === "latin1";
  const decFn = isLatin1 ? "decodeLatin1Alloc" : "decodeUtf16Alloc";
  const e = utf16EndiannessLiteral(field, enc, ctx.endianness);
  const eArg = isLatin1 ? "" : `, ${e}`;
  const transcode = (rawExpr: string) => `${indent}${lhs} = try ${RT}.${decFn}(${ALLOC}, ${rawExpr}${eArg});`;
  const kind = field.kind;
  const lines: string[] = [];

  if ((kind === "fixed" || (kind === undefined && field.length !== undefined)) && field.length !== undefined) {
    const raw = uniqueVar("_raw");
    lines.push(`${indent}const ${raw} = try ${DEC}.readBytesSlice(${field.length});`);
    const end = uniqueVar("_end");
    if (isLatin1) {
      lines.push(`${indent}const ${end} = std.mem.indexOfScalar(u8, ${raw}, 0) orelse ${raw}.len;`);
    } else {
      // Stop at the first 0x0000 code unit (scanning 2-byte aligned).
      const j = uniqueVar("_j");
      lines.push(`${indent}var ${end}: usize = ${raw}.len;`);
      lines.push(`${indent}{`);
      lines.push(`${indent}    var ${j}: usize = 0;`);
      lines.push(`${indent}    while (${j} + 1 < ${raw}.len) : (${j} += 2) {`);
      lines.push(`${indent}        if (${RT}.readUtf16Unit(${raw}, ${j}, ${e}) == 0) { ${end} = ${j}; break; }`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);
    }
    lines.push(transcode(`${raw}[0..${end}]`));
    return lines;
  }

  if (kind === "length_prefixed") {
    const lenVar = uniqueVar("_len");
    lines.push(...emitLengthPrefixDecode(field.length_type || "uint8", lenVar, ctx, indent));
    const raw = uniqueVar("_raw");
    lines.push(`${indent}const ${raw} = try ${DEC}.readBytesSlice(${lenVar});`);
    lines.push(transcode(raw));
    return lines;
  }

  if (kind === "null_terminated" || field.terminator !== undefined) {
    const term = field.terminator !== undefined ? field.terminator : 0;
    if (isLatin1) {
      const raw = uniqueVar("_raw");
      lines.push(`${indent}const ${raw} = try ${DEC}.readUntilByte(${term});`);
      lines.push(transcode(raw));
    } else {
      // Collect 2-byte code units until a 0x0000 unit (consumed), then transcode.
      const list = uniqueVar("_u16");
      const b0 = uniqueVar("_b0");
      const b1 = uniqueVar("_b1");
      const raw = uniqueVar("_raw");
      lines.push(`${indent}var ${list} = std.ArrayList(u8).empty;`);
      lines.push(`${indent}while (true) {`);
      lines.push(`${indent}    const ${b0} = try ${DEC}.readUint8();`);
      lines.push(`${indent}    const ${b1} = try ${DEC}.readUint8();`);
      lines.push(`${indent}    if (${b0} == 0 and ${b1} == 0) break;`);
      lines.push(`${indent}    try ${list}.append(${ALLOC}, ${b0});`);
      lines.push(`${indent}    try ${list}.append(${ALLOC}, ${b1});`);
      lines.push(`${indent}}`);
      lines.push(`${indent}const ${raw} = try ${list}.toOwnedSlice(${ALLOC});`);
      lines.push(transcode(raw));
    }
    return lines;
  }

  if (field.length_field) {
    const raw = uniqueVar("_raw");
    lines.push(`${indent}const ${raw} = try ${DEC}.readBytesSlice(@intCast(${siblingRef(field.length_field, structVar)}));`);
    lines.push(transcode(raw));
    return lines;
  }

  // Greedy: consume the rest of the buffer, then transcode.
  const rem = uniqueVar("_rem");
  const raw = uniqueVar("_raw");
  lines.push(`${indent}const ${rem} = ${DEC}.bytes.len - ${DEC}.byte_offset;`);
  lines.push(`${indent}const ${raw} = try ${DEC}.readBytesSlice(${rem});`);
  lines.push(transcode(raw));
  return lines;
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

function emitBytesDecode(field: any, ctx: EmitCtx, lhs: string, structVar: string, indent: string): string[] {
  const kind = field.kind;
  const lines: string[] = [];

  if (kind === "fixed" && field.length !== undefined) {
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(${field.length});`);
    return lines;
  }
  if (kind === "length_prefixed") {
    const lenVar = uniqueVar("_len");
    lines.push(...emitLengthPrefixDecode(field.length_type || "uint8", lenVar, ctx, indent));
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(${lenVar});`);
    return lines;
  }
  if (kind === "field_referenced" && field.length_field) {
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(@intCast(${siblingRef(field.length_field, structVar)}));`);
    return lines;
  }
  if (field.length !== undefined) {
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(${field.length});`);
    return lines;
  }
  if (field.length_field) {
    lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(@intCast(${siblingRef(field.length_field, structVar)}));`);
    return lines;
  }
  const rem = uniqueVar("_rem");
  lines.push(`${indent}const ${rem} = ${DEC}.bytes.len - ${DEC}.byte_offset;`);
  lines.push(`${indent}${lhs} = try ${DEC}.readBytesSlice(${rem});`);
  return lines;
}

// ---------------------------------------------------------------------------
// Arrays (byte-aligned, heap-allocated)
// ---------------------------------------------------------------------------

function emitArrayDecode(field: any, ctx: EmitCtx, lhs: string, structVar: string, indent: string): string[] {
  if (field.transform && field.transform !== "delta") {
    throw new ZigNotImplemented(`array transform '${field.transform}' (Phase 5)`);
  }
  const kind = field.kind;
  const items = field.items;
  const itemType = zigItemType(items, ctx.schema);
  const itemField = typeof items === "string" ? { type: items } : { ...items };
  delete (itemField as any).name;

  const lines: string[] = [];
  const list = uniqueVar("_arr");
  const i = uniqueVar("_i");
  const item = uniqueVar("_it");

  // length_prefixed_items: read the outer count, then for each element consume
  // its per-item byte-length prefix and decode the (self-describing) item. The
  // per-item length is informational here — the item's own decode consumes the
  // exact bytes — so we read and discard it, matching the TS/Python reference.
  if (kind === "length_prefixed_items") {
    const lenVar = uniqueVar("_len");
    lines.push(...emitLengthPrefixDecode(field.length_type || "uint8", lenVar, ctx, indent));
    const buf = uniqueVar("_buf");
    lines.push(`${indent}const ${buf} = try ${ALLOC}.alloc(${itemType}, @as(usize, ${lenVar}));`);
    const ilen = uniqueVar("_ilen");
    lines.push(`${indent}for (0..${buf}.len) |${i}| {`);
    lines.push(...emitLengthPrefixDecode(field.item_length_type || "uint32", ilen, ctx, indent + "    "));
    lines.push(`${indent}    _ = ${ilen};`);
    lines.push(...emitDecodeValue(itemField, ctx, `${buf}[${i}]`, structVar, indent + "    "));
    lines.push(`${indent}}`);
    lines.push(`${indent}${lhs} = ${buf};`);
    return lines;
  }

  if (kind === "eof_terminated") {
    // Unknown count: accumulate until the buffer is exhausted.
    lines.push(`${indent}var ${list} = std.ArrayList(${itemType}).empty;`);
    lines.push(`${indent}while (${DEC}.hasMore()) {`);
    lines.push(`${indent}    var ${item}: ${itemType} = undefined;`);
    lines.push(...emitDecodeValue(itemField, ctx, item, structVar, indent + "    "));
    lines.push(`${indent}    try ${list}.append(${ALLOC}, ${item});`);
    lines.push(`${indent}}`);
    lines.push(`${indent}${lhs} = try ${list}.toOwnedSlice(${ALLOC});`);
    return lines;
  }

  // null_terminated: read items until a terminator byte is peeked (and consumed).
  if (kind === "null_terminated") {
    if (field.terminal_variants?.length) {
      throw new ZigNotImplemented("null_terminated array with terminal_variants");
    }
    const term = field.terminator !== undefined ? field.terminator : 0;
    lines.push(`${indent}var ${list} = std.ArrayList(${itemType}).empty;`);
    lines.push(`${indent}while (true) {`);
    lines.push(`${indent}    if (!${DEC}.hasMore()) break;`);
    lines.push(`${indent}    if ((try ${DEC}.peekUint8()) == ${term}) {`);
    lines.push(`${indent}        _ = try ${DEC}.readUint8();`);
    lines.push(`${indent}        break;`);
    lines.push(`${indent}    }`);
    lines.push(`${indent}    var ${item}: ${itemType} = undefined;`);
    lines.push(...emitDecodeValue(itemField, ctx, item, structVar, indent + "    "));
    lines.push(`${indent}    try ${list}.append(${ALLOC}, ${item});`);
    lines.push(`${indent}}`);
    lines.push(`${indent}${lhs} = try ${list}.toOwnedSlice(${ALLOC});`);
    return lines;
  }

  // signature_terminated: peek a typed sentinel at the current position; stop when
  // it matches. The sentinel itself is consumed by a following sibling field, so
  // we leave it in the stream.
  if (kind === "signature_terminated") {
    const tv = field.terminator_value;
    const tt = field.terminator_type;
    if (tv === undefined || tt === undefined) {
      throw new ZigNotImplemented("signature_terminated without terminator_value/type");
    }
    const e = zigEndianness(field.terminator_endianness, ctx.endianness);
    const peek =
      tt === "uint8" ? `${DEC}.peekUint8()` :
      tt === "uint16" ? `${DEC}.peekUint16(${e})` :
      tt === "uint32" ? `${DEC}.peekUint32(${e})` :
      null;
    if (peek === null) throw new ZigNotImplemented(`signature terminator type '${tt}'`);
    lines.push(`${indent}var ${list} = std.ArrayList(${itemType}).empty;`);
    lines.push(`${indent}while (true) {`);
    lines.push(`${indent}    if (!${DEC}.hasMore()) break;`);
    lines.push(`${indent}    if ((try ${peek}) == ${tv}) break;`);
    lines.push(`${indent}    var ${item}: ${itemType} = undefined;`);
    lines.push(...emitDecodeValue(itemField, ctx, item, structVar, indent + "    "));
    lines.push(`${indent}    try ${list}.append(${ALLOC}, ${item});`);
    lines.push(`${indent}}`);
    lines.push(`${indent}${lhs} = try ${list}.toOwnedSlice(${ALLOC});`);
    return lines;
  }

  // byte_length_prefixed: a byte-count prefix bounds the elements. Read items
  // until the decoder reaches start+len.
  if (kind === "byte_length_prefixed") {
    const lenVar = uniqueVar("_blen");
    const endVar = uniqueVar("_bend");
    lines.push(...emitLengthPrefixDecode(field.length_type || "uint8", lenVar, ctx, indent));
    lines.push(`${indent}const ${endVar} = ${DEC}.position() + @as(usize, ${lenVar});`);
    lines.push(`${indent}var ${list} = std.ArrayList(${itemType}).empty;`);
    lines.push(`${indent}while (${DEC}.position() < ${endVar}) {`);
    lines.push(`${indent}    var ${item}: ${itemType} = undefined;`);
    lines.push(...emitDecodeValue(itemField, ctx, item, structVar, indent + "    "));
    lines.push(`${indent}    try ${list}.append(${ALLOC}, ${item});`);
    lines.push(`${indent}}`);
    lines.push(`${indent}${lhs} = try ${list}.toOwnedSlice(${ALLOC});`);
    return lines;
  }

  // packed_count: Thrift header — high nibble is the count (low nibble the element
  // type tag, ignored here); a 0xF high nibble escapes to a LEB128 count.
  if (kind === "packed_count") {
    const hdr = uniqueVar("_phdr");
    const cnt = uniqueVar("_pcnt");
    const buf = uniqueVar("_buf");
    const i = uniqueVar("_i");
    lines.push(`${indent}const ${hdr} = try ${DEC}.readUint8();`);
    lines.push(`${indent}var ${cnt}: usize = (@as(usize, ${hdr}) >> 4) & 0x0F;`);
    lines.push(`${indent}if (${cnt} == 0x0F) ${cnt} = @intCast(try ${DEC}.readVarlengthLeb128());`);
    lines.push(`${indent}const ${buf} = try ${ALLOC}.alloc(${itemType}, ${cnt});`);
    lines.push(`${indent}for (0..${buf}.len) |${i}| {`);
    lines.push(...emitDecodeValue(itemField, ctx, `${buf}[${i}]`, structVar, indent + "    "));
    lines.push(`${indent}}`);
    lines.push(`${indent}${lhs} = ${buf};`);
    return lines;
  }

  // Known count: read N, allocate, fill.
  let countExpr: string;
  if (kind === "fixed" && field.length !== undefined) {
    countExpr = `@as(usize, ${field.length})`;
  } else if (kind === "length_prefixed") {
    const lenVar = uniqueVar("_len");
    lines.push(...emitLengthPrefixDecode(field.length_type || "uint8", lenVar, ctx, indent));
    countExpr = `@as(usize, ${lenVar})`;
  } else if (kind === "field_referenced" && (field.length_field || field.count_field)) {
    countExpr = `@as(usize, @intCast(${siblingRef(field.length_field || field.count_field, structVar)}))`;
  } else if (kind === "computed_count" && field.count_expr) {
    countExpr = translateCountExpr(field.count_expr, structVar);
  } else {
    throw new ZigNotImplemented(`array kind '${kind}'`);
  }

  const buf = uniqueVar("_buf");

  // Delta transform: each wire element is a delta; reconstruct the absolute via a
  // loop-local running accumulator (starting at 0) and store the running sum.
  if (field.transform === "delta") {
    const runVar = uniqueVar("_delta_run");
    const it = uniqueVar("_dit");
    lines.push(`${indent}var ${runVar}: ${itemType} = 0;`);
    lines.push(`${indent}const ${buf} = try ${ALLOC}.alloc(${itemType}, ${countExpr});`);
    lines.push(`${indent}for (0..${buf}.len) |${i}| {`);
    lines.push(`${indent}    var ${it}: ${itemType} = undefined;`);
    lines.push(...emitDecodeValue(itemField, ctx, it, structVar, indent + "    "));
    lines.push(`${indent}    ${runVar} += ${it};`);
    lines.push(`${indent}    ${buf}[${i}] = ${runVar};`);
    lines.push(`${indent}}`);
    lines.push(`${indent}${lhs} = ${buf};`);
    return lines;
  }

  lines.push(`${indent}const ${buf} = try ${ALLOC}.alloc(${itemType}, ${countExpr});`);
  lines.push(`${indent}for (0..${buf}.len) |${i}| {`);
  lines.push(...emitDecodeValue(itemField, ctx, `${buf}[${i}]`, structVar, indent + "    "));
  lines.push(`${indent}}`);
  lines.push(`${indent}${lhs} = ${buf};`);
  return lines;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitLengthPrefixDecode(prefixType: string, varName: string, ctx: EmitCtx, indent: string): string[] {
  const e = zigEndianness(undefined, ctx.endianness);
  switch (prefixType) {
    case "uint8":
      return [`${indent}const ${varName} = try ${DEC}.readUint8();`];
    case "uint16":
      return [`${indent}const ${varName} = try ${DEC}.readUint16(${e});`];
    case "uint32":
      return [`${indent}const ${varName} = try ${DEC}.readUint32(${e});`];
    case "uint64":
      return [`${indent}const ${varName} = try ${DEC}.readUint64(${e});`];
    default:
      throw new ZigNotImplemented(`length prefix type '${prefixType}'`);
  }
}

/**
 * Reference to a field already decoded into the struct result var. Plain names
 * (`len`) and dotted sibling-nested paths (`header.uncompressed_length`,
 * `middle.deep_header.payload_length`) resolve against the local struct value.
 * Cross-struct `../parent` and `_root.` refs need parent/root threading and are
 * handled in a later Phase-3 layer.
 */
/**
 * Translate a `computed_count` arithmetic expression (e.g. `max - min + 1` or
 * `(max_byte2 - min_byte2 + 1) * (max_byte1 - min_byte1 + 1)`) into a Zig usize
 * expression. Bare identifiers resolve to already-decoded sibling fields; each
 * is widened to `usize` so intermediate products don't overflow the field's
 * narrow storage type. Operators, numbers and parentheses pass through (Zig
 * shares C's +/-/* precedence). The schema guarantees non-negative results.
 */
function translateCountExpr(expr: string, structVar: string): string {
  // Reject anything beyond arithmetic on identifiers/numbers so we never emit
  // an unintended construct.
  if (!/^[A-Za-z0-9_+\-*/%()\s]+$/.test(expr)) {
    throw new ZigNotImplemented(`computed_count expression '${expr}' (unsupported syntax)`);
  }
  const translated = expr.replace(
    /[A-Za-z_][A-Za-z0-9_]*/g,
    (id) => `@as(usize, @intCast(${structVar}.${zigFieldName(id)}))`,
  );
  return `@as(usize, ${translated})`;
}

function siblingRef(fieldRef: string, structVar: string): string {
  if (fieldRef.startsWith("../") || fieldRef.startsWith("_root")) {
    throw new ZigNotImplemented(`parent/root field reference '${fieldRef}' (cross-struct)`);
  }
  const segs = fieldRef.split(".").map((s) => zigFieldName(s));
  return `${structVar}.${segs.join(".")}`;
}

function cap(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
