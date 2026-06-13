// ABOUTME: `instances` (random-access / position-based) field emission for Zig.
// ABOUTME: Phase 5. Instance fields are decode-only views into the byte stream.
//
// An `instance` is a field that lives at an ABSOLUTE byte offset rather than at
// the cursor: after the plain `sequence` is decoded, the decoder saves its
// position, seeks to each instance's resolved offset, decodes the typed payload,
// and restores the saved position. The ENCODER never writes instance bytes — the
// payload is assumed already present in the stream (the sequence only carries the
// offset/size header). This mirrors Go/Python (eager decode) rather than the
// TypeScript reference (lazy getters); the decoded value is identical either way.
//
// `position` may be: a literal number (>=0 absolute, <0 from EOF), a sibling
// field name, or a dotted path into an already-decoded instance (e.g. a ZIP
// central-directory offset read from the end-of-central-directory record). Each
// instance can carry an `alignment` the resolved offset must satisfy.

import { DEC, ERR } from "./context.js";
import { zigFieldName, uniqueVar } from "./naming.js";
import { zigDeclaredType, resolveAlias, classifyTypeDef } from "./types.js";
import { unionTypeName, unionTypeBody } from "./union.js";
import { ZigNotImplemented, type EmitCtx } from "./encode.js";
import { emitDecodeValue } from "./decode.js";

/**
 * Synthesize a regular "field" object from an instance entry so the existing
 * type/decode machinery can handle it. A string `type` is a named type or
 * primitive; an inline `{ discriminator, variants }` object is a
 * discriminated_union.
 */
export function instanceFieldShape(inst: any): any {
  const t = inst.type;
  if (typeof t === "string") {
    return { type: t, name: inst.name, endianness: inst.endianness };
  }
  if (t && typeof t === "object" && t.discriminator && Array.isArray(t.variants)) {
    return {
      type: "discriminated_union",
      name: inst.name,
      discriminator: t.discriminator,
      variants: t.variants,
      endianness: inst.endianness,
    };
  }
  throw new ZigNotImplemented(`instance '${inst.name}' type ${JSON.stringify(t)}`);
}

/** The Zig declared type for an instance's struct member. */
export function instanceMemberType(inst: any, schema: any): string {
  return zigDeclaredType(instanceFieldShape(inst), schema);
}

/**
 * Named union types introduced by DU/choice instance fields (so they are emitted
 * once at container scope alongside the sequence-derived ones). Returns
 * `{ name, body }` pairs, de-duplicated by name.
 */
export function collectInstanceUnionTypes(schema: any): Array<{ name: string; body: string }> {
  const seen = new Map<string, string>();
  for (const typeDef of Object.values(schema.types || {})) {
    const insts = (typeDef as any)?.instances;
    if (!Array.isArray(insts)) continue;
    for (const inst of insts) {
      const t = inst.type;
      let shape: any = null;
      if (t && typeof t === "object" && t.discriminator && Array.isArray(t.variants)) {
        shape = instanceFieldShape(inst);
      } else if (typeof t === "string") {
        const resolved = resolveAlias(schema, t);
        const cls = resolved && classifyTypeDef(resolved);
        if (cls === "choice" || cls === "discriminated_union") shape = resolved;
      }
      if (shape) {
        const name = unionTypeName(shape);
        if (!seen.has(name)) seen.set(name, unionTypeBody(shape, schema));
      }
    }
  }
  return Array.from(seen, ([name, body]) => ({ name, body }));
}

/**
 * Resolve an instance `position` spec to a Zig `usize` expression.
 *   number >= 0       -> absolute offset
 *   number <  0       -> from EOF (decoder byte length minus |n|)
 *   "field"           -> sibling field value (result.field)
 *   "inst.subfield"   -> dotted path into an already-decoded instance
 * `_root`-prefixed paths are a later extension (none in the current corpus).
 */
function resolveInstancePosition(position: any): string {
  if (typeof position === "number") {
    if (Number.isInteger(position)) {
      return position >= 0 ? `@as(usize, ${position})` : `${DEC}.bytes.len - ${Math.abs(position)}`;
    }
    throw new ZigNotImplemented(`instance position ${position}`);
  }
  if (typeof position === "string") {
    if (position.startsWith("_root")) {
      throw new ZigNotImplemented(`instance position '_root' path '${position}'`);
    }
    const segs = position.split(".").map((s) => zigFieldName(s));
    return `@as(usize, @intCast(result.${segs.join(".")}))`;
  }
  throw new ZigNotImplemented(`instance position ${JSON.stringify(position)}`);
}

/**
 * Emit the instance-decode block, appended after the sequence decode in
 * `decodeWith`. Saves the cursor, decodes each instance at its resolved offset
 * (in declaration order, so a later instance may reference an earlier one's
 * fields), then restores the cursor.
 */
export function emitInstancesDecode(typeDef: any, ctx: EmitCtx, indent = "        "): string[] {
  const insts = (typeDef.instances || []) as any[];
  if (insts.length === 0) return [];
  const lines: string[] = [];
  lines.push(`${indent}// instance (random-access) fields: seek, decode, restore`);
  lines.push(`${indent}try ${DEC}.pushPosition();`);
  for (const inst of insts) {
    const posVar = uniqueVar("_ipos");
    lines.push(`${indent}{`);
    lines.push(`${indent}    const ${posVar}: usize = ${resolveInstancePosition(inst.position)};`);
    if (inst.alignment && inst.alignment > 1) {
      lines.push(`${indent}    if (${posVar} % ${inst.alignment} != 0) return ${ERR}.AlignmentRequired;`);
    }
    lines.push(`${indent}    try ${DEC}.seek(${posVar});`);
    const lhs = `result.${zigFieldName(inst.name)}`;
    lines.push(...emitDecodeValue(instanceFieldShape(inst), ctx, lhs, "result", indent + "    "));
    lines.push(`${indent}}`);
  }
  lines.push(`${indent}try ${DEC}.popPosition();`);
  return lines;
}
