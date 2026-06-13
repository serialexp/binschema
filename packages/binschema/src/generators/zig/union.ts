// ABOUTME: choice + discriminated_union emission for the Zig generator (Phase 4).
// ABOUTME: Both map to an anonymous `union(enum) { Variant: VariantType, ... }`.
// `choice` auto-derives a peeked discriminator from each variant's first const
// field (flat value shape); `discriminated_union` uses an explicit peek/field
// discriminator (nested `{ type, value }` shape). Variant arms must be structs.

import { RT, ENC, DEC, CTX, ALLOC, ROOT } from "./context.js";
import { zigTypeName, zigFieldName, uniqueVar } from "./naming.js";
import { zigEndianness, resolveAlias, classifyTypeDef } from "./types.js";
import { ZigNotImplemented, type EmitCtx } from "./encode.js";

// ---------------------------------------------------------------------------
// Shared: union type + variant resolution
// ---------------------------------------------------------------------------

/** The variant type names for a choice (`choices`) or DU (`variants`). */
function variantTypeNames(field: any): string[] {
  if (field.type === "choice") return (field.choices || []).map((c: any) => c.type);
  return (field.variants || []).map((v: any) => v.type);
}

/** Require every variant to resolve to a struct; return its Pascal Zig type. */
function variantArmType(variantType: string, schema: any): string {
  const resolved = resolveAlias(schema, variantType);
  if (classifyTypeDef(resolved) !== "struct") {
    throw new ZigNotImplemented(`union variant '${variantType}' is not a struct`);
  }
  return zigTypeName(variantType);
}

/**
 * The Zig declared type for a choice/DU field: an anonymous tagged union with one
 * arm per variant (tag = variant Pascal name, payload = variant struct type).
 */
export function zigUnionType(field: any, schema: any): string {
  const names = variantTypeNames(field);
  if (names.length === 0) throw new ZigNotImplemented("union with no variants");
  const arms = names.map((n) => `${zigTypeName(n)}: ${variantArmType(n, schema)}`);
  return `union(enum) { ${arms.join(", ")} }`;
}

// ---------------------------------------------------------------------------
// choice
// ---------------------------------------------------------------------------

/** Peek type + per-variant const discriminator value for a `choice`. */
function choiceDiscriminator(field: any, schema: any): {
  peek: string;
  endianness: string | undefined;
  arms: Array<{ type: string; value: number }>;
} {
  let peek = "uint8";
  let endianness: string | undefined;
  const arms: Array<{ type: string; value: number }> = [];
  for (const c of field.choices || []) {
    const def = resolveAlias(schema, c.type);
    const first = def?.sequence?.[0];
    if (!first || first.const === undefined) {
      throw new ZigNotImplemented(`choice variant '${c.type}' lacks a const discriminator field`);
    }
    peek = first.type;
    endianness = first.endianness;
    arms.push({ type: c.type, value: first.const });
  }
  return { peek, endianness, arms };
}

function peekMethod(intType: string, e: string): string {
  switch (intType) {
    case "uint8": return `peekUint8()`;
    case "uint16": return `peekUint16(${e})`;
    case "uint32": return `peekUint32(${e})`;
    default: throw new ZigNotImplemented(`choice discriminator peek type '${intType}'`);
  }
}

export function emitChoiceEncode(field: any, value: string, indent: string): string[] {
  const names = variantTypeNames(field);
  const lines: string[] = [];
  lines.push(`${indent}switch (${value}) {`);
  for (const n of names) {
    const v = uniqueVar("_uv");
    lines.push(`${indent}    .${zigTypeName(n)} => |${v}| try ${v}.encodeInto(${ENC}, ${CTX}),`);
  }
  lines.push(`${indent}}`);
  return lines;
}

export function emitChoiceDecode(field: any, ctx: EmitCtx, lhs: string, indent: string): string[] {
  const disc = choiceDiscriminator(field, ctx.schema);
  const e = zigEndianness(disc.endianness, ctx.endianness);
  const discVar = uniqueVar("_disc");
  const lines: string[] = [];
  lines.push(`${indent}const ${discVar} = try ${DEC}.${peekMethod(disc.peek, e)};`);
  lines.push(`${indent}switch (${discVar}) {`);
  for (const arm of disc.arms) {
    lines.push(
      `${indent}    ${arm.value} => { ${lhs} = .{ .${zigTypeName(arm.type)} = try ${zigTypeName(arm.type)}.decodeWith(${ALLOC}, ${DEC}, ${ROOT}) }; },`,
    );
  }
  lines.push(`${indent}    else => return error.InvalidVariant,`);
  lines.push(`${indent}}`);
  return lines;
}

// ---------------------------------------------------------------------------
// discriminated_union
// ---------------------------------------------------------------------------

export function emitDuEncode(field: any, value: string, indent: string): string[] {
  // The DU never writes its own discriminator under current schemas (the
  // discriminator is either a sibling field written by the parent, or part of
  // the variant's own bytes for peek-based). Encode = encode the active variant.
  const names = variantTypeNames(field);
  const lines: string[] = [];
  lines.push(`${indent}switch (${value}) {`);
  for (const n of names) {
    const v = uniqueVar("_uv");
    lines.push(`${indent}    .${zigTypeName(n)} => |${v}| try ${v}.encodeInto(${ENC}, ${CTX}),`);
  }
  lines.push(`${indent}}`);
  return lines;
}

export function emitDuDecode(field: any, ctx: EmitCtx, lhs: string, structVar: string, indent: string): string[] {
  const variants = field.variants || [];
  const disc = field.discriminator || {};
  const budget = field.byte_budget;
  const lines: string[] = [];

  // byte_budget mode: decode the active variant from a sub-slice bounded to the
  // budget field's byte count, then advance the parent decoder by the full
  // budget regardless of how many bytes the variant actually consumed. This is
  // what lets an `eof_terminated` variant (e.g. RIFF raw chunk body) stop at the
  // chunk boundary instead of reading to the real end of input.
  let vdec = DEC;
  let vdecRef = DEC;
  let budgetVar = "";
  if (budget) {
    if (!budget.field) throw new ZigNotImplemented("byte_budget without a field reference");
    budgetVar = uniqueVar("_budget");
    const bdec = uniqueVar("_bdec");
    const lenRef = siblingDiscRef(budget.field, structVar);
    lines.push(`${indent}const ${budgetVar}: usize = @intCast(${lenRef});`);
    lines.push(
      `${indent}var ${bdec} = ${RT}.BitStreamDecoder.init(${DEC}.bytes[${DEC}.byte_offset .. ${DEC}.byte_offset + ${budgetVar}], ${DEC}.bit_order);`,
    );
    vdec = bdec;
    vdecRef = `&${bdec}`;
  }

  // Resolve the discriminator expression (the value we branch on).
  let discExpr: string;
  if (disc.peek) {
    const e = zigEndianness(disc.endianness, ctx.endianness);
    discExpr = uniqueVar("_disc");
    lines.push(`${indent}const ${discExpr} = try ${vdec}.${peekMethod(disc.peek, e)};`);
  } else if (disc.field) {
    discExpr = siblingDiscRef(disc.field, structVar);
  } else {
    throw new ZigNotImplemented("discriminated_union without peek/field discriminator");
  }

  // A variant with no `when` (when other variants do have one) is the catch-all
  // fallback — it becomes the final `else` arm rather than a condition.
  const usesWhen = variants.some((v: any) => v.when);
  const conditioned: any[] = [];
  let catchAll: any = null;
  for (const v of variants) {
    if (usesWhen && !v.when) {
      catchAll = v;
    } else {
      conditioned.push(v);
    }
  }

  const decodeLine = (variant: any) =>
    `${indent}    ${lhs} = .{ .${zigTypeName(variant.type)} = try ${zigTypeName(variant.type)}.decodeWith(${ALLOC}, ${vdecRef}, ${ROOT}) };`;

  for (let i = 0; i < conditioned.length; i++) {
    const variant = conditioned[i];
    const cond = i === 0 ? "if" : "else if";
    const test = usesWhen
      ? translateWhen(variant.when, discExpr)
      : `${discExpr} == ${variant.value !== undefined ? variant.value : i}`;
    lines.push(`${indent}${cond} (${test}) {`);
    lines.push(decodeLine(variant));
    lines.push(`${indent}}`);
  }
  lines.push(`${indent}else {`);
  if (catchAll) {
    lines.push(decodeLine(catchAll));
  } else {
    lines.push(`${indent}    return error.InvalidVariant;`);
  }
  lines.push(`${indent}}`);

  if (budget) {
    lines.push(`${indent}${DEC}.byte_offset += ${budgetVar};`);
  }
  return lines;
}

/** Reference to a sibling discriminator field (supports dotted paths). */
function siblingDiscRef(fieldRef: string, structVar: string): string {
  if (fieldRef.startsWith("../") || fieldRef.startsWith("_root")) {
    throw new ZigNotImplemented(`discriminator '${fieldRef}' (cross-struct)`);
  }
  const segs = fieldRef.split(".").map((s) => zigFieldName(s));
  return `${structVar}.${segs.join(".")}`;
}

/**
 * Translate a DU variant `when` expression to a Zig boolean. Supports:
 *   - string equality: `value == 'SIZE'` -> std.mem.eql / negation
 *   - numeric comparisons: `value >= 0xC0 && value <= 0xFF`
 * `value` resolves to the discriminator expression.
 */
function translateWhen(when: string, discExpr: string): string {
  const strEq = when.match(/^\s*value\s*(==|!=)\s*'([^']*)'\s*$/);
  if (strEq) {
    const eql = `std.mem.eql(u8, ${discExpr}, "${strEq[2]}")`;
    return strEq[1] === "==" ? eql : `!${eql}`;
  }
  const z = when
    .replace(/\bvalue\b/g, discExpr)
    .replace(/===/g, "==")
    .replace(/!==/g, "!=")
    .replace(/&&/g, " and ")
    .replace(/\|\|/g, " or ");
  if (/['"]/.test(z)) {
    throw new ZigNotImplemented(`discriminated_union 'when' expression '${when}'`);
  }
  return z;
}
