// ABOUTME: Schema-field -> Zig type mapping + endianness/primitive helpers.
// ABOUTME: Phase 1 covers byte-aligned scalars and bit fields; richer types land later.

import type { BinarySchema, Endianness } from "../../schema/binary-schema.js";
import { zigTypeName } from "./naming.js";
import { ZigNotImplemented } from "./encode.js";
import { zigBitfieldType } from "./bitfield.js";

/** Map a BinSchema endianness to the Zig runtime enum literal. */
export function zigEndianness(endianness: string | undefined, fallback: string): string {
  const e = endianness || fallback;
  return e === "little_endian" ? ".little_endian" : ".big_endian";
}

/** Map a BinSchema bit_order to the Zig runtime enum literal. */
export function zigBitOrder(bitOrder: string | undefined, fallback: string): string {
  const b = bitOrder || fallback;
  return b === "lsb_first" ? ".lsb_first" : ".msb_first";
}

/** Smallest Zig unsigned int wide enough to hold `size` bits (bit fields). */
export function zigUintForBits(size: number): string {
  return `u${size}`;
}

/**
 * Map a primitive scalar field type to its Zig type. Returns null for anything
 * that isn't a Phase-1 byte-aligned scalar / bit field — callers treat null as
 * "not a primitive, dispatch elsewhere".
 */
export function zigPrimitiveType(field: any): string | null {
  const t = field.type;
  switch (t) {
    case "uint8": return "u8";
    case "uint16": return "u16";
    case "uint32": return "u32";
    case "uint64": return "u64";
    case "int8": return "i8";
    case "int16": return "i16";
    case "int32": return "i32";
    case "int64": return "i64";
    case "float32": return "f32";
    case "float64": return "f64";
    case "bool": return "bool";
    case "bit": return zigUintForBits(field.size ?? 1);
    case "int": return `i${field.size ?? 32}`;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Type-reference resolution (Phase 2)
// ---------------------------------------------------------------------------

export type TypeClass =
  | "struct"
  | "string"
  | "bytes"
  | "array"
  | "enum"
  | "discriminated_union"
  | "choice"
  | "unknown";

/**
 * Follow `{ type: "Other" }` alias chains until reaching a concrete type
 * definition. Returns the resolved typeDef (or null if the name isn't a known
 * type — i.e. it's a primitive or undefined).
 */
export function resolveAlias(schema: BinarySchema, typeName: string): any | null {
  let name = typeName;
  const seen = new Set<string>();
  while (name && schema.types[name] && !seen.has(name)) {
    seen.add(name);
    const def: any = schema.types[name];
    // A bare alias `{ type: "Other" }` (no sequence/kind) points at another type.
    if (
      typeof def.type === "string" &&
      schema.types[def.type] &&
      !("sequence" in def) &&
      def.type !== "string" &&
      def.type !== "bytes" &&
      def.type !== "array" &&
      def.type !== "discriminated_union" &&
      def.type !== "choice"
    ) {
      name = def.type;
      continue;
    }
    return def;
  }
  return schema.types[name] ?? null;
}

/** Classify a (resolved) type definition into a generator dispatch class. */
export function classifyTypeDef(typeDef: any): TypeClass {
  if (!typeDef || typeof typeDef !== "object") return "unknown";
  if ("sequence" in typeDef) return "struct";
  switch (typeDef.type) {
    case "string": return "string";
    case "bytes": return "bytes";
    case "array": return "array";
    case "discriminated_union": return "discriminated_union";
    case "choice": return "choice";
  }
  if (Array.isArray(typeDef.values) || typeDef.repr) return "enum";
  return "unknown";
}

/**
 * The declared Zig type for a struct field (or array item). Resolves type
 * references and string/bytes/array shapes to their Zig representation:
 *   - primitives          -> uN / iN / fN / bool
 *   - string / bytes      -> []const u8  (decoded as zero-copy sub-slices)
 *   - array               -> []ItemType  (heap-allocated on decode)
 *   - ref to struct       -> PascalTypeName (by value)
 *   - ref to string/bytes -> []const u8
 *   - ref to array alias  -> []ItemType
 * Throws ZigNotImplemented for kinds not yet supported (enum/DU/choice/etc.).
 */
export function zigDeclaredType(field: any, schema: BinarySchema): string {
  const prim = zigPrimitiveType(field);
  if (prim !== null) return prim;

  switch (field.type) {
    case "string":
    case "bytes":
      return "[]const u8";
    case "array":
      return `[]const ${zigItemType(field.items, schema)}`;
    case "varlength":
      // Variable-length integer (DER/LEB128/EBML/VLQ). Stored as u64; the wire
      // width is determined by the encoding at encode/decode time.
      return "u64";
    case "optional":
      throw new ZigNotImplemented("optional fields (Phase 4)");
    case "bitfield":
      return zigBitfieldType(field);
    case "discriminated_union":
      throw new ZigNotImplemented("discriminated_union fields (Phase 4)");
    case "choice":
      throw new ZigNotImplemented("choice fields (Phase 4)");
  }

  // Type reference: resolve through alias chains.
  const resolved = resolveAlias(schema, field.type);
  const cls = classifyTypeDef(resolved);
  switch (cls) {
    case "struct":
      return zigTypeName(field.type);
    case "string":
    case "bytes":
      return "[]const u8";
    case "array":
      return `[]const ${zigItemType(resolved.items, schema)}`;
    case "enum":
      // Enums are represented as their repr integer at the API boundary.
      return enumReprZigTypeFor(resolved);
    case "discriminated_union":
      throw new ZigNotImplemented(`discriminated_union type '${field.type}' (Phase 4)`);
    case "choice":
      throw new ZigNotImplemented(`choice type '${field.type}' (Phase 4)`);
    default:
      throw new ZigNotImplemented(`unresolved field type '${field.type}'`);
  }
}

/** Map a resolved enum typeDef's repr (uint8/uint16/uint32) to its Zig int type. */
export function enumReprZigTypeFor(typeDef: any): string {
  switch (typeDef?.repr) {
    case "uint8": return "u8";
    case "uint16": return "u16";
    case "uint32": return "u32";
    default:
      throw new ZigNotImplemented(`enum repr '${typeDef?.repr}'`);
  }
}

/** Zig type for an array `items` spec (string name or inline field object). */
export function zigItemType(items: any, schema: BinarySchema): string {
  if (items == null) throw new ZigNotImplemented("array without items");
  const field = typeof items === "string" ? { type: items } : items;
  return zigDeclaredType(field, schema);
}

// ---------------------------------------------------------------------------
// Variable-length integers (DER / LEB128 / EBML / VLQ)
// ---------------------------------------------------------------------------

const VARLENGTH_WRITE: Record<string, string> = {
  der: "writeVarlengthDer",
  leb128: "writeVarlengthLeb128",
  ebml: "writeVarlengthEbml",
  vlq: "writeVarlengthVlq",
};

const VARLENGTH_READ: Record<string, string> = {
  der: "readVarlengthDer",
  leb128: "readVarlengthLeb128",
  ebml: "readVarlengthEbml",
  vlq: "readVarlengthVlq",
};

/** Encoder method for an unsigned varlength field (default DER). */
export function varlengthWriteMethod(field: any): string {
  const enc = field.encoding || "der";
  const m = VARLENGTH_WRITE[enc];
  if (!m) throw new ZigNotImplemented(`varlength encoding '${enc}' (signed/unknown)`);
  return m;
}

/** Decoder method for an unsigned varlength field (default DER). */
export function varlengthReadMethod(field: any): string {
  const enc = field.encoding || "der";
  const m = VARLENGTH_READ[enc];
  if (!m) throw new ZigNotImplemented(`varlength encoding '${enc}' (signed/unknown)`);
  return m;
}

export type { Endianness };
