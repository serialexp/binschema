// ABOUTME: Field-level encode emission for the Zig generator.
// ABOUTME: Phase 2: primitives, bit fields, strings, bytes, byte-aligned arrays, struct refs.

import { RT, ENC, CTX } from "./context.js";
import { zigFieldName, uniqueVar } from "./naming.js";
import {
  zigEndianness,
  zigPrimitiveType,
  resolveAlias,
  classifyTypeDef,
  varlengthWriteMethod,
  translateConditional,
  zigDeclaredType,
} from "./types.js";
import {
  emitComputedEncode,
  arrayNeedsSelectorTracking,
  selectorItemTypeName,
  emitSelectorArrayRecording,
  schemaHasCorrespondingSelectors,
  emitCorrelationArrayLoop,
  PLACEHOLDER_SUFFIX,
} from "./computed.js";
import { emitEnumEncode } from "./enum.js";
import { emitBitfieldEncode } from "./bitfield.js";
import { emitOptionalEncode } from "./optional.js";
import { emitChoiceEncode, emitDuEncode, unionTypeSwitchExpr } from "./union.js";

/** Thrown when a field shape isn't handled yet by the Zig generator. */
export class ZigNotImplemented extends Error {
  constructor(what: string) {
    super(`Zig generator: ${what} not implemented yet`);
    this.name = "ZigNotImplemented";
  }
}

export interface EmitCtx {
  schema: any;
  endianness: string;
  bitOrder: string;
  /** Access expression for the value being encoded, e.g. "self.foo". */
  selfPath: string;
  /** The sibling field list of the struct being emitted (for target lookups). */
  fields?: any[];
  /** The schema type name of the struct being emitted (for corresponding<T>'s
   *  self-variant occurrence: the N-th element of this type correlates to the
   *  N-th matching target). Undefined outside a named struct (alias functions). */
  selfTypeName?: string;
}

/**
 * Emit statements to encode a single named struct field into `enc`, threading
 * `ctx`. Indentation is 8 spaces (method body) by default.
 */
export function generateFieldEncode(field: any, ctx: EmitCtx, indent = "        "): string[] {
  if (field.if) throw new ZigNotImplemented("if-form conditional fields");
  // Conditional field: emit only when the guard is true. The field is stored as
  // `?T`, so inside the guard we unwrap the access with `.?`. computed/const
  // conditionals (e.g. field_id_delta) interact with running accumulators and
  // are deferred.
  if (field.conditional) {
    if (field.computed) throw new ZigNotImplemented("computed conditional field");
    if (field.const !== undefined) throw new ZigNotImplemented("const conditional field");
    const cond = translateConditional(field.conditional, ctx.selfPath, ctx.fields, ctx.schema);
    const value = `${ctx.selfPath}.${zigFieldName(field.name)}.?`;
    const inner = emitEncodeValue(field, value, ctx, indent + "    ");
    return [`${indent}if (${cond}) {`, ...inner, `${indent}}`];
  }
  if (field.computed) return emitComputedEncode(field, ctx, indent);
  if (field.const !== undefined) return emitConstEncode(field, ctx, indent);
  const fname = zigFieldName(field.name);
  const value = `${ctx.selfPath}.${fname}`;
  return emitEncodeValue(field, value, ctx, indent);
}

/**
 * A `const` field is not supplied by the caller — its fixed value is written on
 * encode and read (into the struct field) on decode. Phase 3 supports const on
 * primitive scalar fields, which covers tag/magic bytes.
 */
function emitConstEncode(field: any, ctx: EmitCtx, indent: string): string[] {
  const prim = zigPrimitiveType(field);
  if (prim === null) throw new ZigNotImplemented(`const non-primitive field '${field.name}'`);
  const e = zigEndianness(field.endianness, ctx.endianness);
  const lit = field.type === "bool" ? (field.const ? "true" : "false") : String(field.const);
  return emitPrimitiveEncode(field, lit, e, indent);
}

/**
 * Encode a value given an explicit Zig access expression. Shared by struct
 * fields and array items. Dispatches on the field's (resolved) shape.
 */
export function emitEncodeValue(field: any, value: string, ctx: EmitCtx, indent: string): string[] {
  const e = zigEndianness(field.endianness, ctx.endianness);

  const prim = zigPrimitiveType(field);
  if (prim !== null) return emitPrimitiveEncode(field, value, e, indent);

  // Inline string/bytes/array shapes carry their kind on the field itself.
  switch (field.type) {
    case "string": return emitStringEncode(field, value, ctx, indent);
    case "bytes": return emitBytesEncode(field, value, ctx, indent);
    case "array": return emitArrayEncode(field, value, ctx, indent);
    case "varlength":
      return [`${indent}try ${ENC}.${varlengthWriteMethod(field)}(@intCast(${value}));`];
    case "optional": return emitOptionalEncode(field, value, ctx, indent, emitEncodeValue);
    case "bitfield": return emitBitfieldEncode(field, value, indent);
    case "discriminated_union": return emitDuEncode(field, value, indent);
    case "choice": return emitChoiceEncode(field, value, indent);
  }

  // Type reference: resolve alias chains and dispatch on the concrete shape.
  const resolved = resolveAlias(ctx.schema, field.type);
  const cls = classifyTypeDef(resolved);
  switch (cls) {
    case "struct":
      return [`${indent}try ${value}.encodeInto(${ENC}, ${CTX});`];
    case "string":
      return emitStringEncode(resolved, value, ctx, indent);
    case "bytes":
      return emitBytesEncode(resolved, value, ctx, indent);
    case "array":
      return emitArrayEncode(resolved, value, ctx, indent);
    case "enum":
      return emitEnumEncode(resolved, value, field.endianness, ctx.endianness, indent);
    case "discriminated_union":
      return emitDuEncode(resolved, value, indent);
    case "choice":
      return emitChoiceEncode(resolved, value, indent);
    default:
      throw new ZigNotImplemented(`field type '${field.type}' (type reference)`);
  }
}

function emitPrimitiveEncode(field: any, value: string, e: string, indent: string): string[] {
  switch (field.type) {
    case "uint8":
      return [`${indent}try ${ENC}.writeUint8(${value});`];
    case "uint16":
    case "uint32":
    case "uint64":
      return [`${indent}try ${ENC}.write${cap(field.type)}(${value}, ${e});`];
    case "int8":
      return [`${indent}try ${ENC}.writeInt8(${value});`];
    case "int16":
    case "int32":
    case "int64":
      return [`${indent}try ${ENC}.write${cap(field.type)}(${value}, ${e});`];
    case "float32":
      return [`${indent}try ${ENC}.writeFloat32(${value}, ${e});`];
    case "float64":
      return [`${indent}try ${ENC}.writeFloat64(${value}, ${e});`];
    case "bool":
      // Standalone bool encodes as a full byte (0x00 / 0x01).
      return [`${indent}try ${ENC}.writeUint8(@intFromBool(${value}));`];
    case "bit":
      return [`${indent}try ${ENC}.writeBits(@as(u64, ${value}), ${field.size ?? 1});`];
    case "int":
      return [
        `${indent}try ${ENC}.writeBits(@as(u64, @as(u${field.size ?? 32}, @bitCast(${value}))), ${field.size ?? 32});`,
      ];
    default:
      throw new ZigNotImplemented(`primitive ${field.type}`);
  }
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

/**
 * The string `[]const u8` value carries the wire bytes directly for ascii/utf8
 * (logical text == wire bytes). utf16/latin1 transcoding lands in a later phase.
 */
function assertSimpleEncoding(field: any): void {
  const enc = field.encoding || "utf8";
  if (enc !== "utf8" && enc !== "ascii") {
    throw new ZigNotImplemented(`string encoding '${enc}' (utf16/latin1 later)`);
  }
}

function emitStringEncode(field: any, value: string, ctx: EmitCtx, indent: string): string[] {
  assertSimpleEncoding(field);
  const kind = field.kind;
  const lines: string[] = [];

  if (kind === "fixed" && field.length !== undefined) {
    return emitFixedBlobEncode(value, field.length, indent);
  }
  if (kind === "null_terminated" || field.terminator !== undefined) {
    const term = field.terminator !== undefined ? field.terminator : 0;
    lines.push(`${indent}try ${ENC}.writeBytes(${value});`);
    lines.push(`${indent}try ${ENC}.writeUint8(${term});`);
    return lines;
  }
  if (kind === "length_prefixed") {
    lines.push(...emitLengthPrefixEncode(field.length_type || "uint8", `${value}.len`, ctx, indent));
    lines.push(`${indent}try ${ENC}.writeBytes(${value});`);
    return lines;
  }
  if (kind === "field_referenced") {
    lines.push(`${indent}try ${ENC}.writeBytes(${value});`);
    return lines;
  }
  if (field.length !== undefined) {
    return emitFixedBlobEncode(value, field.length, indent);
  }
  // Raw / greedy string.
  lines.push(`${indent}try ${ENC}.writeBytes(${value});`);
  return lines;
}

// ---------------------------------------------------------------------------
// Bytes
// ---------------------------------------------------------------------------

function emitBytesEncode(field: any, value: string, ctx: EmitCtx, indent: string): string[] {
  const kind = field.kind;
  const lines: string[] = [];

  if (kind === "fixed" && field.length !== undefined) {
    return emitFixedBlobEncode(value, field.length, indent);
  }
  if (kind === "length_prefixed") {
    lines.push(...emitLengthPrefixEncode(field.length_type || "uint8", `${value}.len`, ctx, indent));
    lines.push(`${indent}try ${ENC}.writeBytes(${value});`);
    return lines;
  }
  if (field.length !== undefined) {
    return emitFixedBlobEncode(value, field.length, indent);
  }
  // field_referenced / raw: write the slice as-is.
  lines.push(`${indent}try ${ENC}.writeBytes(${value});`);
  return lines;
}

/** Write up to `len` bytes of a slice, zero-padding the remainder. */
function emitFixedBlobEncode(value: string, len: number, indent: string): string[] {
  const n = uniqueVar("_n");
  const pad = uniqueVar("_pad");
  return [
    `${indent}const ${n} = @min(${value}.len, @as(usize, ${len}));`,
    `${indent}try ${ENC}.writeBytes(${value}[0..${n}]);`,
    `${indent}var ${pad}: usize = @as(usize, ${len}) - ${n};`,
    `${indent}while (${pad} > 0) : (${pad} -= 1) try ${ENC}.writeUint8(0);`,
  ];
}

// ---------------------------------------------------------------------------
// Arrays (byte-aligned)
// ---------------------------------------------------------------------------

function emitArrayEncode(field: any, value: string, ctx: EmitCtx, indent: string): string[] {
  if (field.transform && field.transform !== "delta") {
    throw new ZigNotImplemented(`array transform '${field.transform}' (Phase 5)`);
  }
  const kind = field.kind;
  const items = field.items;
  const lines: string[] = [];

  // length_prefixed_items: an outer count prefix, then EACH element is framed by
  // its own byte-length prefix. We reserve a placeholder for the per-item length,
  // encode the item directly into the same encoder, then back-patch the
  // placeholder with the encoded span (byteOffset delta) — the load-bearing
  // two-pass primitive. The length is known immediately after the item, so this
  // is a synchronous patch, not a deferred one.
  if (kind === "length_prefixed_items") {
    return emitLengthPrefixedItemsEncode(field, value, ctx, indent);
  }

  switch (kind) {
    case "fixed":
    case "field_referenced":
    case "eof_terminated":
    case "computed_count":
      // No length prefix on the wire — count is fixed / external / implicit /
      // recomputed on decode from an expression.
      break;
    case "length_prefixed":
      lines.push(...emitLengthPrefixEncode(field.length_type || "uint8", `${value}.len`, ctx, indent));
      break;
    default:
      throw new ZigNotImplemented(`array kind '${kind}'`);
  }

  const itemVar = uniqueVar("_item");
  const itemField = typeof items === "string" ? { type: items } : { ...items };
  delete (itemField as any).name;

  // Delta transform: a pure wire transform on array elements. The logical array
  // is absolutes on both sides; on the wire we write value[i] - prev using the
  // item's own encoding (a loop-local accumulator starting at 0). Negative deltas
  // require a signed item encoding (e.g. zigzag varlength); on a plain unsigned
  // item it only round-trips for monotonic data (the author's responsibility).
  if (field.transform === "delta") {
    const itemType = zigDeclaredType(itemField, ctx.schema);
    const prevVar = uniqueVar("_delta_prev");
    const deltaVar = uniqueVar("_delta");
    lines.push(`${indent}var ${prevVar}: ${itemType} = 0;`);
    lines.push(`${indent}for (${value}) |${itemVar}| {`);
    lines.push(`${indent}    const ${deltaVar}: ${itemType} = ${itemVar} - ${prevVar};`);
    lines.push(`${indent}    ${prevVar} = ${itemVar};`);
    lines.push(...emitEncodeValue(itemField, deltaVar, ctx, indent + "    "));
    lines.push(`${indent}}`);
    return lines;
  }

  const itemEncode = emitEncodeValue(itemField, itemVar, ctx, indent + "    ");

  // If a computed field selects into this array (first/last/corresponding), the
  // parent records each element's absolute start offset + type as it encodes,
  // so a deferred selector_position patch can resolve the matching element. For a
  // polymorphic (choice/DU) array, the element type is the union's active variant
  // — recorded via a runtime switch — rather than a single static struct type.
  if (field.name && arrayNeedsSelectorTracking(field.name, ctx.schema)) {
    const typeName = selectorItemTypeName(field, ctx.schema);
    const typeExpr = unionTypeSwitchExpr(itemField, ctx.schema, itemVar);
    lines.push(...emitSelectorArrayRecording(field.name, typeName, value, itemVar, itemEncode, indent, typeExpr));
    return lines;
  }

  // An array no selector targets, but whose elements hold a cross-array
  // `corresponding<T>` field, still needs current_array + per-element occurrence
  // tracking so the referencing element can count its index within THIS array.
  if (field.name && schemaHasCorrespondingSelectors(ctx.schema)) {
    const typeName = selectorItemTypeName(field, ctx.schema);
    const typeExpr = unionTypeSwitchExpr(itemField, ctx.schema, itemVar);
    if (typeName !== null || typeExpr) {
      lines.push(...emitCorrelationArrayLoop(field.name, value, itemVar, itemEncode, typeName, typeExpr, indent));
      return lines;
    }
  }

  lines.push(`${indent}for (${value}) |${itemVar}| {`);
  lines.push(...itemEncode);
  lines.push(`${indent}}`);
  return lines;
}

function emitLengthPrefixedItemsEncode(field: any, value: string, ctx: EmitCtx, indent: string): string[] {
  const itemLengthType = field.item_length_type || "uint32";
  const suffix = PLACEHOLDER_SUFFIX[itemLengthType];
  if (!suffix) throw new ZigNotImplemented(`item_length_type '${itemLengthType}'`);
  const e = zigEndianness(undefined, ctx.endianness);

  const lines: string[] = [];
  // Outer count prefix: number of elements.
  lines.push(...emitLengthPrefixEncode(field.length_type || "uint8", `${value}.len`, ctx, indent));

  const itemVar = uniqueVar("_item");
  const itemField = typeof field.items === "string" ? { type: field.items } : { ...field.items };
  delete (itemField as any).name;
  const itemEncode = emitEncodeValue(itemField, itemVar, ctx, indent + "    ");

  const ph = uniqueVar("_iph");
  const start = uniqueVar("_istart");
  lines.push(`${indent}for (${value}) |${itemVar}| {`);
  lines.push(`${indent}    const ${ph} = try ${ENC}.placeholder${suffix}();`);
  lines.push(`${indent}    const ${start} = ${ENC}.byteOffset();`);
  lines.push(...itemEncode);
  lines.push(`${indent}    ${ENC}.patch(${ph}, @intCast(${ENC}.byteOffset() - ${start}), ${e});`);
  lines.push(`${indent}}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Length prefixes
// ---------------------------------------------------------------------------

function emitLengthPrefixEncode(prefixType: string, lenExpr: string, ctx: EmitCtx, indent: string): string[] {
  const e = zigEndianness(undefined, ctx.endianness);
  switch (prefixType) {
    case "uint8":
      return [`${indent}try ${ENC}.writeUint8(@intCast(${lenExpr}));`];
    case "uint16":
      return [`${indent}try ${ENC}.writeUint16(@intCast(${lenExpr}), ${e});`];
    case "uint32":
      return [`${indent}try ${ENC}.writeUint32(@intCast(${lenExpr}), ${e});`];
    case "uint64":
      return [`${indent}try ${ENC}.writeUint64(@intCast(${lenExpr}), ${e});`];
    default:
      throw new ZigNotImplemented(`length prefix type '${prefixType}'`);
  }
}

function cap(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export { RT, ENC, CTX };
