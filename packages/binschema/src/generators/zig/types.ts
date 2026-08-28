// ABOUTME: Schema-field -> Zig type mapping + endianness/primitive helpers.
// ABOUTME: Phase 1 covers byte-aligned scalars and bit fields; richer types land later.

import type { BinarySchema, Endianness } from "../../schema/binary-schema.js";
import { zigTypeName, zigFieldName } from "./naming.js";
import { ZigNotImplemented } from "./encode.js";
import { zigBitfieldType } from "./bitfield.js";
import { zigOptionalType } from "./optional.js";
import { zigUnionType } from "./union.js";
import { isBuiltinFieldType } from "../../schema/field-types.js";

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
  | "back_reference"
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

/**
 * Walk a bare-alias chain (`{ type: "Other" }`) to the terminal concrete type
 * NAME (the struct/enum/string/… that actually defines the shape). Returns the
 * input name unchanged when it isn't an alias. Companion to `resolveAlias`,
 * which returns the terminal *definition*; this returns its name so callers can
 * emit a nominal Zig alias (`pub const Realm = KerberosString;`).
 */
export function resolveAliasName(schema: BinarySchema, typeName: string): string {
  let name = typeName;
  const seen = new Set<string>();
  while (name && schema.types[name] && !seen.has(name)) {
    seen.add(name);
    const def: any = schema.types[name];
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
    break;
  }
  return name;
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
    case "back_reference": return "back_reference";
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
  // A conditional field is present only when its guard is true, so it is stored
  // as an optional (`?T`) — null when absent. Strip the marker and wrap the
  // underlying type.
  if (field.conditional) {
    const inner = { ...field };
    delete inner.conditional;
    return `?${zigDeclaredType(inner, schema)}`;
  }

  const prim = zigPrimitiveType(field);
  if (prim !== null) return prim;

  switch (field.type) {
    case "string":
    case "bytes":
      return "[]const u8";
    case "array":
      return `[]const ${zigItemType(field.items, schema)}`;
    case "varlength":
      // Variable-length integer. Unsigned encodings (DER/LEB128/EBML/VLQ) store
      // u64; signed encodings (zigzag/SLEB128) store i64. The wire width is
      // determined by the encoding at encode/decode time.
      return varlengthIsSigned(field) ? "i64" : "u64";
    case "optional":
      return zigOptionalType(field, schema);
    case "bitfield":
      return zigBitfieldType(field);
    case "discriminated_union":
    case "choice":
      return zigUnionType(field, schema);
    case "compressed": {
      // A compressed region is a pure wire transform: the logical value (both
      // sides) is the inner `value_type`. The framing is consumed, not stored.
      const vt = field.value_type;
      const inner = typeof vt === "object" ? vt : { type: vt };
      return zigDeclaredType(inner, schema);
    }
    case "back_reference":
      // A back_reference (DNS-style pointer) is transparent: its logical value is
      // whatever the referenced `target_type` decodes to. The pointer framing is
      // consumed, not stored.
      return zigDeclaredType({ type: field.target_type }, schema);
  }

  // A built-in keyword that falls past the switch above is a gap in this
  // generator, not a type reference. Resolving it as one would report a
  // confusing "unknown type" instead of the missing case (see
  // schema/field-types.ts).
  if (isBuiltinFieldType(field.type)) {
    throw new ZigNotImplemented(`field type '${field.type}'`);
  }

  // Type reference: resolve through alias chains.
  const resolved = resolveAlias(schema, field.type);
  // Bare alias to a primitive (e.g. `Uint8 -> uint8`): its declared type is the
  // primitive's Zig type.
  const primAlias = zigPrimitiveType(resolved);
  if (primAlias !== null) return primAlias;
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
    case "choice":
      // Named DU/choice types are resolved inline to an anonymous union at each
      // field site (they have no standalone Zig representation).
      return zigUnionType(resolved, schema);
    case "back_reference":
      // Transparent pointer: declared type is the referenced target_type's.
      return zigDeclaredType({ type: resolved.target_type }, schema);
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

/**
 * Resolve a (possibly dotted) field path used in a conditional into a Zig access
 * expression plus any null-guards. Walking the schema lets us detect an
 * *optional intermediate* segment — a field that is itself conditional (`?T`) —
 * and unwrap it with `.?` while AND-guarding on `<seg> != null` so that an
 * absent parent makes the whole condition false (matching the reference's
 * short-circuiting `.get()` chains).
 */
function resolveCondPath(
  path: string,
  prefix: string,
  fields: any[] | undefined,
  schema: BinarySchema,
): { access: string; guards: string[] } {
  const segs = path.split(".");
  let access = prefix;
  let curFields = fields;
  const guards: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const isLast = i === segs.length - 1;
    const fld = (curFields || []).find((f) => f.name === segs[i]);
    access += `.${zigFieldName(segs[i])}`;
    if (fld?.conditional && !isLast) {
      guards.push(`${access} != null`);
      access += ".?";
    }
    if (!isLast && fld) {
      const resolved = resolveAlias(schema, fld.type);
      curFields = resolved?.sequence;
    }
  }
  return { access, guards };
}

/**
 * Translate a `conditional` expression into a strict-bool Zig condition.
 * `prefix` is the access root (`self` on encode, the result var on decode);
 * `fields` is the enclosing struct's sequence (for optional-intermediate
 * detection). Mirrors the Go generator's four patterns. C-style "truthiness" on
 * a bitwise AND (`flags & 0x01`) becomes an explicit `(...) != 0` since Zig `if`
 * requires a bool.
 */
export function translateConditional(
  condition: string,
  prefix: string,
  fields: any[] | undefined,
  schema: BinarySchema,
): string {
  const cond = condition.trim();
  const withGuards = (guards: string[], core: string): string =>
    guards.length ? `${guards.map((g) => `(${g})`).join(" and ")} and ${core}` : core;

  // (field & mask) <op> value   — parenthesized bitwise AND with a comparison.
  let m = cond.match(/^\((\w+(?:\.\w+)*)\s*&\s*([^)]+)\)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (m) {
    const r = resolveCondPath(m[1], prefix, fields, schema);
    return withGuards(r.guards, `(${r.access} & ${m[2].trim()}) ${m[3]} ${m[4].trim()}`);
  }

  // field <op> value            — simple comparison (already boolean).
  m = cond.match(/^(\w+(?:\.\w+)*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (m) {
    const r = resolveCondPath(m[1], prefix, fields, schema);
    return withGuards(r.guards, `${r.access} ${m[2]} ${m[3].trim()}`);
  }

  // field & mask                — bitwise AND truthiness.
  m = cond.match(/^(\w+(?:\.\w+)*)\s*&\s*(.+)$/);
  if (m) {
    const r = resolveCondPath(m[1], prefix, fields, schema);
    return withGuards(r.guards, `(${r.access} & ${m[2].trim()}) != 0`);
  }

  // field                       — bare boolean field.
  m = cond.match(/^(\w+(?:\.\w+)*)$/);
  if (m) {
    const r = resolveCondPath(m[1], prefix, fields, schema);
    return withGuards(r.guards, r.access);
  }

  throw new ZigNotImplemented(`conditional expression '${condition}'`);
}

// ---------------------------------------------------------------------------
// String encodings
// ---------------------------------------------------------------------------

/** Whether an encoding is a UTF-16 variant (plain or endianness-suffixed). */
export function isUtf16Encoding(enc: string): boolean {
  return enc === "utf16" || enc === "utf16_be" || enc === "utf16be" ||
    enc === "utf16_le" || enc === "utf16le";
}

/**
 * utf8/ascii store wire bytes directly (logical text == wire bytes); latin1 and
 * utf16 require transcoding between the in-memory UTF-8 `[]const u8` and the wire
 * encoding via the runtime helpers.
 */
export function stringNeedsTranscode(enc: string): boolean {
  return enc === "latin1" || isUtf16Encoding(enc);
}

/**
 * The Zig runtime-enum literal for a UTF-16 field's byte order. An endianness
 * suffix on the encoding wins; otherwise the field's own `endianness`, else the
 * global fallback.
 */
export function utf16EndiannessLiteral(field: any, enc: string, fallback: string): string {
  if (enc === "utf16_be" || enc === "utf16be") return ".big_endian";
  if (enc === "utf16_le" || enc === "utf16le") return ".little_endian";
  return zigEndianness(field.endianness, fallback);
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
  zigzag: "writeVarlengthZigzag",
  leb128_signed: "writeVarlengthSleb128",
};

const VARLENGTH_READ: Record<string, string> = {
  der: "readVarlengthDer",
  leb128: "readVarlengthLeb128",
  ebml: "readVarlengthEbml",
  vlq: "readVarlengthVlq",
  zigzag: "readVarlengthZigzag",
  leb128_signed: "readVarlengthSleb128",
};

/** Signed varlength encodings store/return i64; unsigned ones store/return u64. */
const VARLENGTH_SIGNED = new Set(["zigzag", "leb128_signed"]);

/** Whether a varlength field uses a signed encoding (zigzag / SLEB128). */
export function varlengthIsSigned(field: any): boolean {
  return VARLENGTH_SIGNED.has(field.encoding);
}

/** Encoder method for a varlength field (default DER). */
export function varlengthWriteMethod(field: any): string {
  const enc = field.encoding || "der";
  const m = VARLENGTH_WRITE[enc];
  if (!m) throw new ZigNotImplemented(`varlength encoding '${enc}' (unknown)`);
  return m;
}

/** Decoder method for a varlength field (default DER). */
export function varlengthReadMethod(field: any): string {
  const enc = field.encoding || "der";
  const m = VARLENGTH_READ[enc];
  if (!m) throw new ZigNotImplemented(`varlength encoding '${enc}' (unknown)`);
  return m;
}

export type { Endianness };
