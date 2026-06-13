// ABOUTME: Bitfield emission for the Zig generator (Phase 4).
// ABOUTME: A `bitfield` packs named sub-fields into N bits; represented in Zig as
// an anonymous struct of uN sub-values, written/read MSB/LSB per the encoder's bit order.

import { ENC, DEC } from "./context.js";
import { zigFieldName } from "./naming.js";
import { ZigNotImplemented } from "./encode.js";

/** Sub-fields of a bitfield, each `{ name, size }` (size defaults to 1 bit). */
function subFields(field: any): Array<{ name: string; size: number }> {
  const fields = field.fields || [];
  return fields.map((f: any) => {
    if (!f.name) throw new ZigNotImplemented("unnamed bitfield sub-field");
    return { name: f.name, size: f.size || 1 };
  });
}

/**
 * The Zig type for a bitfield value: an anonymous struct with one uN field per
 * sub-field. Anonymous struct literals (`.{ .a = 0, ... }`) coerce into this on
 * construction, so callers don't need a named type.
 */
export function zigBitfieldType(field: any): string {
  const subs = subFields(field);
  const parts = subs.map((s) => `${zigFieldName(s.name)}: u${s.size}`);
  return `struct { ${parts.join(", ")} }`;
}

/**
 * Encode a bitfield: write each sub-field's bits in declaration order. The
 * encoder's configured bit order (msb/lsb) governs packing — matching every
 * other generator, the per-bitfield `bit_order` override relies on the enclosing
 * type already being configured with that order.
 */
export function emitBitfieldEncode(field: any, value: string, indent: string): string[] {
  const subs = subFields(field);
  const lines: string[] = [];
  for (const s of subs) {
    lines.push(`${indent}try ${ENC}.writeBits(@as(u64, ${value}.${zigFieldName(s.name)}), ${s.size});`);
  }
  return lines;
}

/**
 * Decode a bitfield: read each sub-field's bits in order into the target struct.
 * Assigning sub-fields in explicit statement order guarantees wire read order
 * (anonymous struct-literal field evaluation order is otherwise unspecified).
 */
export function emitBitfieldDecode(field: any, lhs: string, indent: string): string[] {
  const subs = subFields(field);
  const lines: string[] = [];
  for (const s of subs) {
    lines.push(`${indent}${lhs}.${zigFieldName(s.name)} = @intCast(try ${DEC}.readBits(${s.size}));`);
  }
  return lines;
}
