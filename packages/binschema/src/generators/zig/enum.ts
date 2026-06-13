// ABOUTME: Enum type emission for the Zig generator (Phase 4).
// ABOUTME: Enums are represented at the API as their repr integer (u8/u16/u32);
// decode validates the value is a declared variant, else errors.

import { RT, ENC, CTX, DEC, ALLOC, ROOT, ERR } from "./context.js";
import { zigTypeName, uniqueVar } from "./naming.js";
import { zigEndianness, zigBitOrder } from "./types.js";
import { ZigNotImplemented } from "./encode.js";

/** Map an enum `repr` (uint8/uint16/uint32) to its Zig unsigned int type. */
export function enumReprZigType(repr: string): string {
  switch (repr) {
    case "uint8": return "u8";
    case "uint16": return "u16";
    case "uint32": return "u32";
    default:
      throw new ZigNotImplemented(`enum repr '${repr}'`);
  }
}

/** The sorted list of declared variant values for a `{ Name: value }` map. */
function variantValues(typeDef: any): number[] {
  const variants = (typeDef.variants ?? {}) as Record<string, number>;
  return Object.values(variants);
}

/**
 * Emit `enc.write*` for an enum repr integer at the current position. Endianness
 * follows the field's override, else the schema default. uint8 has no byte order.
 */
function emitReprWrite(repr: string, value: string, e: string, indent: string): string[] {
  switch (repr) {
    case "uint8": return [`${indent}try ${ENC}.writeUint8(${value});`];
    case "uint16": return [`${indent}try ${ENC}.writeUint16(${value}, ${e});`];
    case "uint32": return [`${indent}try ${ENC}.writeUint32(${value}, ${e});`];
    default:
      throw new ZigNotImplemented(`enum repr '${repr}'`);
  }
}

function emitReprRead(repr: string, lhs: string, e: string, indent: string): string[] {
  switch (repr) {
    case "uint8": return [`${indent}${lhs} = try ${DEC}.readUint8();`];
    case "uint16": return [`${indent}${lhs} = try ${DEC}.readUint16(${e});`];
    case "uint32": return [`${indent}${lhs} = try ${DEC}.readUint32(${e});`];
    default:
      throw new ZigNotImplemented(`enum repr '${repr}'`);
  }
}

/**
 * Field-level enum encode: the stored value is already the repr integer, so we
 * just write it. `typeDef` is the resolved enum type.
 */
export function emitEnumEncode(
  typeDef: any,
  value: string,
  fieldEndianness: string | undefined,
  defaultEndianness: string,
  indent: string,
): string[] {
  const e = zigEndianness(fieldEndianness, defaultEndianness);
  return emitReprWrite(typeDef.repr, value, e, indent);
}

/**
 * Field-level enum decode: read the repr integer, then validate it is one of the
 * declared variant values (else INVALID_VALUE). The validated integer is stored.
 */
export function emitEnumDecode(
  typeDef: any,
  lhs: string,
  fieldEndianness: string | undefined,
  defaultEndianness: string,
  indent: string,
): string[] {
  const e = zigEndianness(fieldEndianness, defaultEndianness);
  const lines: string[] = [];
  lines.push(...emitReprRead(typeDef.repr, lhs, e, indent));
  lines.push(...emitEnumValidate(typeDef, lhs, indent));
  return lines;
}

/** Emit a `switch` that returns InvalidValue if `expr` isn't a declared variant. */
function emitEnumValidate(typeDef: any, expr: string, indent: string): string[] {
  const values = variantValues(typeDef);
  if (values.length === 0) return [];
  const prongs = values.join(", ");
  return [
    `${indent}switch (${expr}) {`,
    `${indent}    ${prongs} => {},`,
    `${indent}    else => return error.InvalidValue,`,
    `${indent}}`,
  ];
}

/**
 * Emit a top-level enum type: a repr-integer alias plus free
 * `encode<Name>`/`decode<Name>` functions so the enum can be used as a standalone
 * entry point (its own `test_type`). Decode validates the variant.
 */
export function generateEnumCode(
  name: string,
  typeDef: any,
  endianness: string,
  bitOrder: string,
): string[] {
  const typeNameZ = zigTypeName(name);
  const repr = typeDef.repr as string;
  const reprType = enumReprZigType(repr);
  const e = zigEndianness(undefined, endianness);
  const bo = zigBitOrder(bitOrder, "msb_first");

  const lines: string[] = [];
  lines.push(`pub const ${typeNameZ} = ${reprType};`);
  lines.push(``);

  // encode<Name>(value, allocator)
  lines.push(`pub fn encode${typeNameZ}(value: ${reprType}, ${ALLOC}: std.mem.Allocator) ${ERR}![]u8 {`);
  lines.push(`    var ${ENC} = ${RT}.BitStreamEncoder.init(${ALLOC}, ${bo});`);
  lines.push(`    errdefer ${ENC}.deinit();`);
  lines.push(...emitReprWrite(repr, "value", e, "    "));
  lines.push(`    return ${ENC}.finish();`);
  lines.push(`}`);
  lines.push(``);

  // decode<Name>(allocator, bytes)
  lines.push(`pub fn decode${typeNameZ}(${ALLOC}: std.mem.Allocator, bytes: []const u8) ${ERR}!${reprType} {`);
  lines.push(`    _ = ${ALLOC};`);
  lines.push(`    var ${DEC} = ${RT}.BitStreamDecoder.init(bytes, ${bo});`);
  const raw = uniqueVar("_e");
  lines.push(`    var ${raw}: ${reprType} = undefined;`);
  lines.push(...emitReprRead(repr, raw, e, "    "));
  lines.push(...emitEnumValidate(typeDef, raw, "    "));
  lines.push(`    return ${raw};`);
  lines.push(`}`);

  return lines;
}

export { CTX, ROOT };
