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

import { RT, ENC, CTX, ERR } from "./context.js";
import { zigFieldName } from "./naming.js";
import { zigEndianness, zigPrimitiveType, resolveAlias, classifyTypeDef } from "./types.js";
import { ZigNotImplemented, type EmitCtx } from "./encode.js";

const INT_FIELD_TYPES = new Set([
  "uint8", "uint16", "uint32", "uint64",
  "int8", "int16", "int32", "int64",
]);

/** Map a computed field's integer storage type to its placeholder method suffix. */
const PLACEHOLDER_SUFFIX: Record<string, "U8" | "U16" | "U32" | "U64"> = {
  uint8: "U8",
  uint16: "U16",
  uint32: "U32",
  uint64: "U64",
};

/** Map a computed field's integer storage type to its runtime PatchWidth tag. */
const PATCH_WIDTH: Record<string, "u8" | "u16" | "u32" | "u64"> = {
  uint8: "u8",
  uint16: "u16",
  uint32: "u32",
  uint64: "u64",
};

/**
 * A plain `../field` parent reference (any number of `../`, then a single bare
 * identifier — no dotted path, no `[selector]`). Returns `{ levels, name }`
 * where `levels` is the number of `../` segments (1 = direct parent, matching
 * the runtime's `frameAtLevel`/`parentLength` level convention), or null if the
 * target isn't a plain parent ref (a selector, a `_root.` ref, or a dotted path).
 */
export function parsePlainParentRef(target: string | undefined): { levels: number; name: string } | null {
  if (!target || !target.startsWith("../")) return null;
  let rem = target;
  let levels = 0;
  while (rem.startsWith("../")) {
    levels++;
    rem = rem.slice(3);
  }
  // A bare identifier only — dotted paths and selectors aren't plain refs.
  if (rem.length === 0 || rem.includes(".") || rem.includes("[")) return null;
  return { levels, name: rem };
}

/** Is this target a cross-struct parent / root reference (handled in Phase 3b)? */
export function isParentRef(target: string | undefined): boolean {
  return !!target && (target.startsWith("../") || target.startsWith("_root"));
}

/** Does this target use a first/last/corresponding selector (Phase 3e)? */
export function isSelector(target: string | undefined): boolean {
  return !!target && (target.includes("[first<") || target.includes("[last<") || target.includes("[corresponding<"));
}

/** Strip any leading `../` segments, returning the bare (array) name. */
export function bareArrayName(target: string): string {
  let rem = target;
  while (rem.startsWith("../")) rem = rem.slice(3);
  return rem;
}

export interface SelectorTarget {
  /** Bare array field name the selector indexes into (e.g. "chunks"). */
  arrayName: string;
  /** Type filter inside the angle brackets (e.g. "DataChunk"). */
  filterType: string;
  selector: "first" | "last" | "corresponding";
  /** Dotted sub-path after the selector, if any (e.g. "payload"); "" when none. */
  subPath: string;
}

/**
 * Parse a `first<T>` / `last<T>` / `corresponding<T>` selector target. Mirrors
 * the reference parsers (parseFirstLastTarget / parseCorrespondingTarget in
 * src/generators/typescript/computed-fields.ts). Any number of leading `../`
 * segments are stripped — selector resolution is keyed on the bare array name in
 * the global position map, not on frame depth. Returns null for non-selectors.
 */
export function parseSelectorTarget(target: string | undefined): SelectorTarget | null {
  if (!target) return null;
  const m = target.match(/(?:\.\.\/)*([^[]+)\[(first|last|corresponding)<(\w+)>\](?:\.(.+))?$/);
  if (!m) return null;
  return {
    arrayName: m[1],
    selector: m[2] as "first" | "last" | "corresponding",
    filterType: m[3],
    subPath: m[4] ?? "",
  };
}

/** Does any computed target in the schema use a first/last/corresponding selector? */
export function schemaHasSelectors(schema: any): boolean {
  for (const typeDef of Object.values(schema.types || {})) {
    const seq = (typeDef as any).sequence;
    if (!Array.isArray(seq)) continue;
    for (const f of seq) {
      if (isSelector(f?.computed?.target)) return true;
    }
  }
  return false;
}

/**
 * Does the array field named `arrayName` need per-element position tracking,
 * because some computed field selects into it with first/last/corresponding?
 * (Reference equivalent: detectFirstLastTracking / detectCorrespondingTracking.)
 */
export function arrayNeedsSelectorTracking(arrayName: string | undefined, schema: any): boolean {
  if (!arrayName) return false;
  for (const typeDef of Object.values(schema.types || {})) {
    const seq = (typeDef as any).sequence;
    if (!Array.isArray(seq)) continue;
    for (const f of seq) {
      const sel = parseSelectorTarget(f?.computed?.target);
      if (sel && sel.arrayName === arrayName) return true;
      // `sum_of_type_sizes` sums per-element byte sizes of a `../array`, so the
      // array must record each element's offset+end+type just like a selector.
      const c = f?.computed;
      if (c?.type === "sum_of_type_sizes" && c.target && bareArrayName(c.target) === arrayName) return true;
    }
  }
  return false;
}

/**
 * The struct type name to record for each element of a homogeneous selector
 * array (so `first<T>` can filter by it). Returns null when the items aren't a
 * named struct type (e.g. a `choice` array — handled by Phase 4 — or a primitive
 * array, which no selector targets).
 */
export function selectorItemTypeName(field: any, schema: any): string | null {
  const items = field.items;
  const itemTypeName = typeof items === "string" ? items : items?.type;
  if (!itemTypeName || typeof itemTypeName !== "string") return null;
  if (zigPrimitiveType({ type: itemTypeName }) !== null) return null;
  const resolved = resolveAlias(schema, itemTypeName);
  if (classifyTypeDef(resolved) !== "struct") return null;
  return itemTypeName;
}

/**
 * Emit the per-element position recording for a selector-target array. Wraps the
 * caller's item-encode lines: capture each element's absolute start offset and
 * record it (with the element's struct type name) before the element is encoded,
 * then mark the array done so first/last selectors can resolve. `itemEncodeLines`
 * are the already-generated encode statements for one element.
 */
export function emitSelectorArrayRecording(
  arrayName: string,
  typeName: string | null,
  value: string,
  itemVar: string,
  itemEncodeLines: string[],
  indent: string,
  /** Optional Zig EXPRESSION yielding the element's runtime type name (a switch
   *  over a polymorphic union item). Overrides the static `typeName`. */
  typeExpr?: string | null,
): string[] {
  const offVar = `${itemVar}_seloff`;
  const endVar = `${itemVar}_selend`;
  const markVar = `${itemVar}_selmark`;
  const typeVar = `${itemVar}_seltype`;
  const lines: string[] = [];
  lines.push(`${indent}for (${value}) |${itemVar}| {`);
  lines.push(`${indent}    const ${offVar} = ${ENC}.byteOffset();`);
  // Mark the frame history before the element encodes so we can capture the
  // element's own top frame afterwards (it records its sub-field ranges/lengths,
  // which length_of/crc32_of selectors over `[sel].subfield` read back).
  lines.push(`${indent}    const ${markVar} = ${CTX}.frameMark();`);
  lines.push(...itemEncodeLines);
  // The element's end offset; `end - offset` is its encoded byte size, summed by
  // `sum_of_type_sizes` over all elements of a given type.
  lines.push(`${indent}    const ${endVar} = ${ENC}.byteOffset();`);
  // Polymorphic (choice/DU) arrays record each element's actual variant type so
  // first/last/corresponding selectors can filter by it; homogeneous arrays use
  // the static struct type name (or null when no selector targets the array).
  let typeArg: string;
  if (typeExpr) {
    lines.push(`${indent}    const ${typeVar} = ${typeExpr};`);
    typeArg = typeVar;
  } else {
    typeArg = typeName === null ? "null" : `"${typeName}"`;
  }
  lines.push(`${indent}    try ${CTX}.recordPosition("${arrayName}", ${typeArg}, ${offVar}, ${endVar}, ${CTX}.frameAt(${markVar}));`);
  lines.push(`${indent}}`);
  lines.push(`${indent}try ${CTX}.markArrayDone("${arrayName}");`);
  return lines;
}

/** Local var holding a position/crc placeholder handle for field `name`. */
export function placeholderVar(name: string): string {
  return `_ph_${name}`;
}

/** Local var holding the start byte offset of a tracked target field. */
export function fieldOffVar(name: string): string {
  return `_field_off_${zigFieldName(name)}`;
}

/** Local var holding the start byte offset of a field, for parent-frame range recording. */
export function frameStartVar(name: string): string {
  return `_s_${zigFieldName(name)}`;
}

/**
 * Does any type in the schema use a cross-struct parent reference (`../field`
 * or `_root.…`) in a computed target? When true, every struct's encode pushes a
 * parent frame and records its fields' lengths/ranges so children can resolve
 * those references. Schemas without any such ref keep the lean Phase-2 path.
 */
export function schemaHasParentRefs(schema: any): boolean {
  for (const typeDef of Object.values(schema.types || {})) {
    const seq = (typeDef as any).sequence;
    if (!Array.isArray(seq)) continue;
    for (const f of seq) {
      const target: string | undefined = f?.computed?.target;
      if (target && (target.startsWith("../") || target.startsWith("_root"))) return true;
      // `sum_of_sizes` carries a `targets` array of `../field` parent refs whose
      // byte ranges (recorded in the parent frame) it sums — so it needs frames.
      const targets: string[] | undefined = f?.computed?.targets;
      if (Array.isArray(targets) && targets.some((t) => t.startsWith("../") || t.startsWith("_root"))) return true;
    }
  }
  return false;
}

/**
 * The `length_of` value a parent should register for a field so a child's
 * `length_of ../field` resolves synchronously: array/string/bytes -> `.len`
 * (element/byte count), integer scalar -> the value itself (matching the
 * reference generator's "int target → use the value" rule). Returns null for
 * fields that can't be a plain synchronous length target (structs, bool/float,
 * sub-byte) — a child referencing one will fault at runtime rather than silently
 * miscompute.
 */
function frameLengthExpr(field: any, schema: any, selfPath: string): string | null {
  if (!field.name || field.computed || field.const !== undefined) return null;
  const access = `${selfPath}.${zigFieldName(field.name)}`;
  if (INT_FIELD_TYPES.has(field.type)) return `@intCast(${access})`;
  if (field.type === "string" || field.type === "bytes" || field.type === "array") {
    return `@intCast(${access}.len)`;
  }
  // Type reference resolving to a string/bytes/array alias also has a `.len`.
  if (typeof field.type === "string" && !zigPrimitiveType(field)) {
    const resolved = resolveAlias(schema, field.type);
    const cls = classifyTypeDef(resolved);
    if (cls === "string" || cls === "bytes" || cls === "array") return `@intCast(${access}.len)`;
  }
  return null;
}

/**
 * Emit the eager parent-frame length registrations, run at the top of a struct's
 * encode (before any child is encoded) so `length_of ../field` children can read
 * the value synchronously.
 */
export function emitFrameLengthRegistration(
  fields: any[],
  ctx: EmitCtx,
  frameVar: string,
  indent: string,
): string[] {
  const lines: string[] = [];
  for (const f of fields) {
    const expr = frameLengthExpr(f, ctx.schema, ctx.selfPath);
    if (expr === null) continue;
    lines.push(`${indent}try ${CTX}.setLength(${frameVar}, "${f.name}", ${expr});`);
  }
  return lines;
}

/** Local var holding the end byte offset of a crc32 target field. */
export function fieldEndVar(name: string): string {
  return `_field_end_${zigFieldName(name)}`;
}

/**
 * Does a same-struct `length_of <target>` need a measure-then-patch (a u32
 * placeholder back-patched with the target's encoded byte span) rather than the
 * synchronous `.len` write? True when the target is a struct or a
 * discriminated_union / choice — none of which expose a Zig `.len`, and whose
 * encoded byte length isn't known until they're written. Slice-shaped targets
 * (string / bytes / array, inline or via alias) keep the `.len` fast path; plain
 * scalars keep their existing behaviour.
 */
export function lengthOfNeedsMeasure(target: string, schema: any, fields: any[] | undefined): boolean {
  if (!fields) return false;
  const tf = fields.find((f) => f.name === target);
  if (!tf) return false;
  if (tf.type === "discriminated_union" || tf.type === "choice") return true;
  if (tf.type === "string" || tf.type === "bytes" || tf.type === "array") return false;
  if (zigPrimitiveType(tf) !== null) return false;
  const resolved = resolveAlias(schema, tf.type);
  const cls = classifyTypeDef(resolved);
  return cls === "struct" || cls === "discriminated_union" || cls === "choice";
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
    const sel = parseSelectorTarget(target);
    if (sel) {
      // `length_of arr[first<T>|…].subfield`: the selected element's logical
      // sub-field length isn't known here (the element encodes later), so reserve
      // a slot now and defer a selector_length patch. The resolver reads the
      // chosen element's frame (`subfield.length`) once the tree is encoded.
      if (!sel.subPath) {
        throw new ZigNotImplemented(`${t} selector without a sub-field (element byte size — sum_of_type_sizes, Phase 4)`);
      }
      if (sel.subPath.includes(".")) {
        throw new ZigNotImplemented(`${t} selector nested sub-path '.${sel.subPath}'`);
      }
      return emitSelectorFramePatch(field, intType, sel, e, "selector_length", indent);
    }
    const parent = parsePlainParentRef(target);
    if (parent) {
      // Cross-struct `../field`: the parent eagerly registers the field's
      // length_of value into its frame before encoding children (array/string
      // element-or-byte count, or a scalar's value), so it is available
      // synchronously here. See `emitFrameLengthRegistration`.
      const read = `(${CTX}.parentLength(${parent.levels}, "${parent.name}") orelse return ${ERR}.SchemaMismatch)`;
      return emitIntWrite(intType, read, e, indent);
    }
    if (isParentRef(target)) {
      throw new ZigNotImplemented(`${t} target '${target}' (dotted/_root parent ref, later phase)`);
    }
    // length_of a struct / discriminated_union / choice has no synchronous `.len`:
    // reserve a fixed-width slot now and back-patch it with the target's encoded
    // byte span once it has been written (emitComputedBackpatch).
    if (t === "length_of" && lengthOfNeedsMeasure(target, ctx.schema, ctx.fields)) {
      return [`${indent}const ${placeholderVar(field.name)} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`];
    }
    // Same-struct: string/bytes -> byte length; array -> element count. Both map
    // to the Zig slice `.len`, and the value is known from the input directly.
    return emitIntWrite(intType, `${ctx.selfPath}.${zigFieldName(target)}.len`, e, indent);
  }

  if (t === "position_of") {
    const parent = parsePlainParentRef(target);
    if (parent) {
      // Cross-struct `position_of ../field`: the field's offset isn't known yet
      // (it is encoded later by the parent), so reserve a slot now and register
      // a deferred patch capturing the parent's frame. The resolver fills it in
      // once the whole tree is encoded and the parent has recorded the range.
      return emitParentDeferredPatch(field, intType, parent, e, "parent_position", indent, computed.alignment || 1);
    }
    const sel = parseSelectorTarget(target);
    if (sel) {
      // `position_of arr[first<T>|last<T>|corresponding<T>]`: reserve a slot now
      // and defer a selector_position patch. The parent records each element's
      // offset+type during the array encode (emitSelectorArrayRecording); the
      // resolver picks the matching element once the whole tree is encoded.
      if (sel.subPath) {
        throw new ZigNotImplemented(`position_of selector with sub-path '.${sel.subPath}' (only the element offset is a position)`);
      }
      return emitSelectorPositionPatch(field, intType, sel, e, indent, computed.alignment || 1);
    }
    if (isParentRef(target)) {
      throw new ZigNotImplemented(`position_of target '${target}' (dotted/_root parent ref, later phase)`);
    }
    // Same-struct: reserve a slot now; the back-patch fills in the target's
    // start offset once it has been encoded.
    return [`${indent}const ${placeholderVar(field.name)} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`];
  }

  if (t === "crc32_of") {
    const parent = parsePlainParentRef(target);
    if (parent) {
      return emitParentDeferredPatch(field, intType, parent, e, "parent_crc32", indent, 1);
    }
    const sel = parseSelectorTarget(target);
    if (sel) {
      // `crc32_of arr[first<T>|…].subfield`: defer a selector_crc32 patch that
      // CRCs the chosen element's sub-field encoded byte range (read from its
      // frame) once the whole tree is encoded.
      if (!sel.subPath) {
        throw new ZigNotImplemented(`crc32_of selector without a sub-field (element byte range — Phase 4)`);
      }
      if (sel.subPath.includes(".")) {
        throw new ZigNotImplemented(`crc32_of selector nested sub-path '.${sel.subPath}'`);
      }
      return emitSelectorFramePatch(field, intType, sel, e, "selector_crc32", indent);
    }
    if (isParentRef(target)) {
      throw new ZigNotImplemented(`crc32_of target '${target}' (dotted/_root parent ref, later phase)`);
    }
    return [`${indent}const ${placeholderVar(field.name)} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`];
  }

  if (t === "sum_of_type_sizes") {
    // Sum the encoded byte sizes of every element of `element_type` in the
    // (`../`) target array. The array isn't necessarily encoded yet (the
    // referencing struct can precede it), so reserve a slot now and defer a
    // selector_sum patch; the resolver sums each matching element's recorded
    // (end - offset) once the whole tree is encoded.
    if (!target) throw new ZigNotImplemented("sum_of_type_sizes without target");
    const elementType = computed.element_type;
    if (!elementType) throw new ZigNotImplemented("sum_of_type_sizes without element_type");
    const ph = placeholderVar(field.name);
    const width = PATCH_WIDTH[intType];
    const arrayName = bareArrayName(target);
    return [
      `${indent}const ${ph} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`,
      `${indent}try ${CTX}.addDeferredPatch(.{ .selector_sum = .{ ` +
        `.local_offset = ${ph}.offset, .width = .${width}, .endianness = ${e}, ` +
        `.array_name = "${arrayName}", .element_type = "${elementType}" } });`,
    ];
  }

  if (t === "sum_of_sizes") {
    // Sum the encoded byte spans of an explicit set of `../field` ancestor
    // fields. Each target's range is recorded in the parent frame as it encodes;
    // reserve a slot now and defer a parent_sum patch that reads those ranges
    // once the whole tree is encoded.
    const targets: string[] | undefined = computed.targets;
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new ZigNotImplemented("sum_of_sizes without targets");
    }
    const parsed = targets.map((tg) => parsePlainParentRef(tg));
    if (parsed.some((p) => p === null)) {
      throw new ZigNotImplemented("sum_of_sizes with non-plain-parent targets");
    }
    const levels = parsed[0]!.levels;
    if (parsed.some((p) => p!.levels !== levels)) {
      throw new ZigNotImplemented("sum_of_sizes targets at differing parent depths");
    }
    const ph = placeholderVar(field.name);
    const width = PATCH_WIDTH[intType];
    const frame = `(${CTX}.frameAtLevel(${levels}) orelse return ${ERR}.SchemaMismatch)`;
    const names = parsed.map((p) => `"${p!.name}"`).join(", ");
    return [
      `${indent}const ${ph} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`,
      `${indent}try ${CTX}.addDeferredPatch(.{ .parent_sum = .{ ` +
        `.local_offset = ${ph}.offset, .width = .${width}, .endianness = ${e}, ` +
        `.frame = ${frame}, .field_names = &[_][]const u8{ ${names} } } });`,
    ];
  }

  throw new ZigNotImplemented(`computed type '${t}'`);
}

/**
 * Emit a placeholder + a deferred `parent_position` / `parent_crc32` patch that
 * captures the ancestor frame `levels` up. The runtime resolves it after the
 * whole tree is encoded (the parent records the target field's byte range when
 * it encodes it).
 */
function emitParentDeferredPatch(
  field: any,
  intType: string,
  parent: { levels: number; name: string },
  e: string,
  op: "parent_position" | "parent_crc32",
  indent: string,
  alignment: number,
): string[] {
  const ph = placeholderVar(field.name);
  const width = PATCH_WIDTH[intType];
  const frame = `(${CTX}.frameAtLevel(${parent.levels}) orelse return ${ERR}.SchemaMismatch)`;
  const lines = [
    `${indent}const ${ph} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`,
  ];
  if (op === "parent_position") {
    lines.push(
      `${indent}try ${CTX}.addDeferredPatch(.{ .parent_position = .{ ` +
        `.local_offset = ${ph}.offset, .width = .${width}, .endianness = ${e}, ` +
        `.frame = ${frame}, .field_name = "${parent.name}", .alignment = ${alignment} } });`,
    );
  } else {
    lines.push(
      `${indent}try ${CTX}.addDeferredPatch(.{ .parent_crc32 = .{ ` +
        `.local_offset = ${ph}.offset, .width = .${width}, .endianness = ${e}, ` +
        `.frame = ${frame}, .field_name = "${parent.name}" } });`,
    );
  }
  return lines;
}

/**
 * `corresponding<T>` correlates the N-th element of the *referencing* type to the
 * N-th element of the *target* type — the index must be captured per-element at
 * encode time. The Zig runtime resolver currently reads only the final aggregate
 * iteration state, so corresponding can't be resolved correctly yet. Skip it
 * cleanly (whole-suite codegen-skip) rather than emit silently-wrong offsets;
 * first<T>/last<T> are unaffected.
 */
function assertSelectorImplemented(sel: SelectorTarget): void {
  if (sel.selector === "corresponding") {
    throw new ZigNotImplemented("corresponding<T> selector (per-element occurrence correlation, follow-on)");
  }
}

/**
 * Emit a placeholder + a deferred `selector_position` patch for
 * `position_of arr[first<T>|last<T>|corresponding<T>]`. The resolver matches the
 * recorded element positions (see emitSelectorArrayRecording) by `filter_type`
 * and `selector`, returning 0xFFFFFFFF when nothing matches (e.g. empty array).
 */
function emitSelectorPositionPatch(
  field: any,
  intType: string,
  sel: SelectorTarget,
  e: string,
  indent: string,
  alignment: number,
): string[] {
  assertSelectorImplemented(sel);
  const ph = placeholderVar(field.name);
  const width = PATCH_WIDTH[intType];
  return [
    `${indent}const ${ph} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`,
    `${indent}try ${CTX}.addDeferredPatch(.{ .selector_position = .{ ` +
      `.local_offset = ${ph}.offset, .width = .${width}, .endianness = ${e}, ` +
      `.array_name = "${sel.arrayName}", .selector = .${sel.selector}, ` +
      `.filter_type = "${sel.filterType}", .alignment = ${alignment} } });`,
  ];
}

/**
 * Emit a placeholder + a deferred `selector_length` / `selector_crc32` patch for
 * `length_of`/`crc32_of arr[first<T>|last<T>|corresponding<T>].subfield`. The
 * resolver finds the matching element (see emitSelectorArrayRecording — each
 * element records its top frame), then reads the named sub-field from that
 * frame: its logical length (selector_length) or its encoded byte range, CRC'd
 * (selector_crc32). Both stay deferred until the whole tree is encoded.
 */
function emitSelectorFramePatch(
  field: any,
  intType: string,
  sel: SelectorTarget,
  e: string,
  op: "selector_length" | "selector_crc32",
  indent: string,
): string[] {
  assertSelectorImplemented(sel);
  const ph = placeholderVar(field.name);
  const width = PATCH_WIDTH[intType];
  return [
    `${indent}const ${ph} = try ${ENC}.placeholder${PLACEHOLDER_SUFFIX[intType]}();`,
    `${indent}try ${CTX}.addDeferredPatch(.{ .${op} = .{ ` +
      `.local_offset = ${ph}.offset, .width = .${width}, .endianness = ${e}, ` +
      `.array_name = "${sel.arrayName}", .selector = .${sel.selector}, ` +
      `.filter_type = "${sel.filterType}", .sub_field = "${sel.subPath}" } });`,
  ];
}

/** Field names that are same-struct position_of / crc32_of / measured-length targets. */
export interface ComputedTargets {
  posTargets: Set<string>;
  crcTargets: Set<string>;
  /** length_of targets that need a measured byte span (struct / union targets). */
  lenTargets: Set<string>;
}

export function computedTargets(fields: any[], schema?: any): ComputedTargets {
  const posTargets = new Set<string>();
  const crcTargets = new Set<string>();
  const lenTargets = new Set<string>();
  for (const f of fields) {
    const c = f.computed;
    if (!c || !c.target || isParentRef(c.target) || isSelector(c.target)) continue;
    if (c.type === "position_of") posTargets.add(c.target);
    if (c.type === "crc32_of") crcTargets.add(c.target);
    if (c.type === "length_of" && lengthOfNeedsMeasure(c.target, schema, fields)) lenTargets.add(c.target);
  }
  return { posTargets, crcTargets, lenTargets };
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
    } else if (c.type === "length_of" && lengthOfNeedsMeasure(c.target, ctx.schema, ctx.fields)) {
      // Measured byte span: end - start of the target field's encoded bytes.
      lines.push(
        `${indent}${ENC}.patch(${placeholderVar(f.name)}, ` +
          `@intCast(${fieldEndVar(c.target)} - ${fieldOffVar(c.target)}), ${e});`,
      );
    }
  }
  return lines;
}
