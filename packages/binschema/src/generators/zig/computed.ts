// ABOUTME: Computed-field encode emission for the Zig generator.
// ABOUTME: Phase 3. Same-struct length_of/count_of/position_of/crc32_of.
//
// The load-bearing two-pass primitives (placeholderU{8,16,32,64} / patch / the
// EncodeContext deferred-patch resolver) already live in the Zig runtime and are
// exercised by its unit tests. This module is where the GENERATOR emits calls to
// them.
//
// Phase 3a (this file, same-struct):
//   - length_of / count_of <sibling>  — value is the field's logical length
//     (string/bytes byte count, array element count), all == the Zig slice
//     `.len`, so it is written immediately (the value is known from the input).
//   - position_of <sibling>           — a fixed-width placeholder is written
//     now; the struct-level back-patch (emitComputedBackpatch) fills in the
//     target field's start offset once every field has been encoded.
//   - crc32_of <sibling>              — placeholder now; back-patched with the
//     CRC32 over the target field's encoded byte range.
//
// Cross-struct (`../parent`), selector (`first<T>`/`last<T>`/`corresponding<T>`),
// and `from_after_field` targets throw ZigNotImplemented here and are handled in
// later Phase-3 layers (they need the threaded EncodeContext, not local vars).

import { RT, ENC } from "./context.js";
import { zigFieldName } from "./naming.js";
import { zigEndianness } from "./types.js";
import { ZigNotImplemented, type EmitCtx } from "./encode.js";

/** Map a computed field's integer storage type to its placeholder method suffix. */
const PLACEHOLDER_SUFFIX: Record<string, "U8" | "U16" | "U32" | "U64"> = {
  uint8: "U8",
  uint16: "U16",
  uint32: "U32",
  uint64: "U64",
};

/** Is this target a cross-struct parent / root reference (handled in Phase 3b)? */
export function isParentRef(target: string | undefined): boolean {
  return !!target && (target.startsWith("../") || target.startsWith("_root"));
}

/** Does this target use a first/last/corresponding selector (Phase 3d)? */
export function isSelector(target: string | undefined): boolean {
  return !!target && (target.includes("[first<") || target.includes("[last<") || target.includes("[corresponding<"));
}

/** Local var holding a position/crc placeholder handle for field `name`. */
export function placeholderVar(name: string): string {
  return `_ph_${name}`;
}

/** Local var holding the start byte offset of a tracked target field. */
export function fieldOffVar(name: string): string {
  return `_field_off_${zigFieldName(name)}`;
}

/** Local var holding the end byte offset of a crc32 target field. */
export function fieldEndVar(name: string): string {
  return `_field_end_${zigFieldName(name)}`;
}

/** Emit a write of a computed integer VALUE (`expr`) as the field's int type. */
function emitIntWrite(intType: string, expr: string, e: string, indent: string): string[] {
  switch (intType) {
    case "uint8":
      return [`${indent}try ${ENC}.writeUint8(@intCast(${expr}));`];
    case "uint16":
      return [`${indent}try ${ENC}.writeUint16(@intCast(${expr}), ${e});`];
    case "uint32":
      return [`${indent}try ${ENC}.writeUint32(@intCast(${expr}), ${e});`];
    case "uint64":
      return [`${indent}try ${ENC}.writeUint64(@intCast(${expr}), ${e});`];
    default:
      throw new ZigNotImplemented(`computed field storage type '${intType}'`);
  }
}

/**
 * Emit the inline encode for a computed field (the write or placeholder at the
 * field's own position). The struct-level back-patch (emitComputedBackpatch)
 * later resolves position_of / crc32_of placeholders.
 */
export function emitComputedEncode(field: any, ctx: EmitCtx, indent: string): string[] {
  const computed = field.computed;
  const e = zigEndianness(field.endianness, ctx.endianness);
  const intType = field.type;
  if (!(intType in PLACEHOLDER_SUFFIX)) {
    throw new ZigNotImplemented(`computed field of non-integer type '${intType}'`);
  }
  const t = computed.type;
  const target: string | undefined = computed.target;

  if (t === "length_of" || t === "count_of") {
    if (computed.from_after_field) {
      throw new ZigNotImplemented("length_of from_after_field (Phase 3c)");
    }
    if (!target) throw new ZigNotImplemented(`${t} without target`);
    if (isParentRef(target) || isSelector(target)) {
      throw new ZigNotImplemented(`${t} target '${target}' (cross-struct/selector, Phase 3b/3d)`);
    }
    // length_of: string/bytes -> byte length; array -> element count. Both map
    // to the Zig slice `.len`, and the value is known from the input directly.
    return emitIntWrite(intType, `${ctx.selfPath}.${zigFieldName(target)}.len`, e, indent);
  }

  if (t === "position_of") {
    if (isParentRef(target) || isSelector(target)) {
      throw new ZigNotImplemented(`position_of target '${target}' (cross-struct/selector, Phase 3b/3d)`);
    }
    // Same-struct: reserve a slot now; the back-patch fills in the target's
    // start offset once it has been encoded.
    return [`${indent}const ${placeholderVar(field.name)} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`];
  }

  if (t === "crc32_of") {
    if (isParentRef(target) || isSelector(target)) {
      throw new ZigNotImplemented(`crc32_of target '${target}' (cross-struct/selector, Phase 3b/3d)`);
    }
    return [`${indent}const ${placeholderVar(field.name)} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`];
  }

  throw new ZigNotImplemented(`computed type '${t}'`);
}

/** Field names that are same-struct position_of / crc32_of targets. */
export interface ComputedTargets {
  posTargets: Set<string>;
  crcTargets: Set<string>;
}

export function computedTargets(fields: any[]): ComputedTargets {
  const posTargets = new Set<string>();
  const crcTargets = new Set<string>();
  for (const f of fields) {
    const c = f.computed;
    if (!c || !c.target || isParentRef(c.target) || isSelector(c.target)) continue;
    if (c.type === "position_of") posTargets.add(c.target);
    if (c.type === "crc32_of") crcTargets.add(c.target);
  }
  return { posTargets, crcTargets };
}

/**
 * Emit the struct-level back-patch for same-struct position_of / crc32_of
 * computed fields, run after every field of the struct has been encoded. Reads
 * the `_field_off_<target>` (and `_field_end_<target>` for CRC) offsets recorded
 * around the target field's encode.
 */
export function emitComputedBackpatch(fields: any[], ctx: EmitCtx, indent: string): string[] {
  const lines: string[] = [];
  for (const f of fields) {
    const c = f.computed;
    if (!c || !c.target || isParentRef(c.target) || isSelector(c.target)) continue;
    const e = zigEndianness(f.endianness, ctx.endianness);

    if (c.type === "position_of") {
      const align = c.alignment || 1;
      if (align > 1) {
        const v = `_pos_${f.name}`;
        lines.push(`${indent}var ${v}: usize = ${fieldOffVar(c.target)};`);
        lines.push(`${indent}if (${v} % ${align} != 0) ${v} += ${align} - (${v} % ${align});`);
        lines.push(`${indent}${ENC}.patch(${placeholderVar(f.name)}, @intCast(${v}), ${e});`);
      } else {
        lines.push(`${indent}${ENC}.patch(${placeholderVar(f.name)}, @intCast(${fieldOffVar(c.target)}), ${e});`);
      }
    } else if (c.type === "crc32_of") {
      lines.push(
        `${indent}${ENC}.patch(${placeholderVar(f.name)}, ` +
          `${RT}.computeCrc32(${ENC}.view()[${fieldOffVar(c.target)}..${fieldEndVar(c.target)}]), ${e});`,
      );
    }
  }
  return lines;
}
