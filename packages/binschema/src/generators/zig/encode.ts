// ABOUTME: Field-level encode emission for the Zig generator.
// ABOUTME: Phase 2: primitives, bit fields, strings, bytes, byte-aligned arrays, struct refs.

import { RT, ENC, CTX } from "./context.js";
import { zigFieldName, uniqueVar } from "./naming.js";
import {
  zigEndianness,
  zigPrimitiveType,
  resolveAlias,
  classifyTypeDef,
} from "./types.js";
import { emitComputedEncode } from "./computed.js";

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
}

/**
 * Emit statements to encode a single named struct field into `enc`, threading
 * `ctx`. Indentation is 8 spaces (method body) by default.
 */
export function generateFieldEncode(field: any, ctx: EmitCtx, indent = "        "): string[] {
  if (field.conditional || field.if) throw new ZigNotImplemented("conditional fields");
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
    case "optional": throw new ZigNotImplemented("optional fields");
    case "bitfield": throw new ZigNotImplemented("bitfield fields");
    case "discriminated_union": throw new ZigNotImplemented("discriminated_union fields");
    case "choice": throw new ZigNotImplemented("choice fields");
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
      throw new ZigNotImplemented(`enum type '${field.type}' (Phase 4)`);
    case "discriminated_union":
      throw new ZigNotImplemented(`discriminated_union type '${field.type}' (Phase 4)`);
    case "choice":
      throw new ZigNotImplemented(`choice type '${field.type}' (Phase 4)`);
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
  if (field.transform) throw new ZigNotImplemented(`array transform '${field.transform}' (Phase 5)`);
  const kind = field.kind;
  const items = field.items;
  const lines: string[] = [];

  switch (kind) {
    case "fixed":
    case "field_referenced":
    case "eof_terminated":
      // No length prefix on the wire — count is fixed / external / implicit.
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
  lines.push(`${indent}for (${value}) |${itemVar}| {`);
  lines.push(...emitEncodeValue(itemField, itemVar, ctx, indent + "    "));
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
