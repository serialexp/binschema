// ABOUTME: Field-level decode emission for the Zig generator.
// ABOUTME: Phase 2: primitives, bit fields, strings, bytes, byte-aligned arrays, struct refs.

import { DEC, ALLOC, ROOT } from "./context.js";
import { zigFieldName, zigTypeName, uniqueVar } from "./naming.js";
import {
  zigEndianness,
  zigPrimitiveType,
  zigItemType,
  resolveAlias,
  classifyTypeDef,
} from "./types.js";
import { ZigNotImplemented, type EmitCtx } from "./encode.js";

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
  if (field.conditional || field.if) throw new ZigNotImplemented("conditional fields");
  // Computed and const fields are present on the wire (they were written during
  // encode), so they decode exactly like their declared primitive type.
  const fname = zigFieldName(field.name);
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
    case "optional": throw new ZigNotImplemented("optional fields");
    case "bitfield": throw new ZigNotImplemented("bitfield fields");
    case "discriminated_union": throw new ZigNotImplemented("discriminated_union fields");
    case "choice": throw new ZigNotImplemented("choice fields");
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
      throw new ZigNotImplemented(`enum type '${field.type}' (Phase 4)`);
    case "discriminated_union":
      throw new ZigNotImplemented(`discriminated_union type '${field.type}' (Phase 4)`);
    case "choice":
      throw new ZigNotImplemented(`choice type '${field.type}' (Phase 4)`);
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
  if (field.transform) throw new ZigNotImplemented(`array transform '${field.transform}' (Phase 5)`);
  const kind = field.kind;
  const items = field.items;
  const itemType = zigItemType(items, ctx.schema);
  const itemField = typeof items === "string" ? { type: items } : { ...items };
  delete (itemField as any).name;

  const lines: string[] = [];
  const list = uniqueVar("_arr");
  const i = uniqueVar("_i");
  const item = uniqueVar("_it");

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
  } else {
    throw new ZigNotImplemented(`array kind '${kind}'`);
  }

  const buf = uniqueVar("_buf");
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
