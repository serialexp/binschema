// ABOUTME: Optional (`?T`) field emission for the Zig generator (Phase 4).
// ABOUTME: A `uint8` presence byte (1=present, 0=absent) precedes the value.
// Bit-presence optionals rely on a bit/byte-overlap quirk in the reference
// runtime that the byte-oriented Zig runtime does not replicate — skipped.

import { ENC, DEC } from "./context.js";
import { uniqueVar } from "./naming.js";
import { zigDeclaredType } from "./types.js";
import { ZigNotImplemented, type EmitCtx } from "./encode.js";

/** Build the inner value field object from `value_type` (string name or inline object). */
function innerField(field: any): any {
  const vt = field.value_type;
  const f = typeof vt === "string" ? { type: vt } : { ...vt };
  delete (f as any).name;
  return f;
}

function assertBytePresence(field: any): void {
  const presence = field.presence_type || "uint8";
  if (presence !== "uint8") {
    throw new ZigNotImplemented(`optional with '${presence}' presence (bit/byte overlap)`);
  }
}

/** Zig declared type for an optional field: `?<inner>`. */
export function zigOptionalType(field: any, schema: any): string {
  assertBytePresence(field);
  return `?${zigDeclaredType(innerField(field), schema)}`;
}

/**
 * Encode an optional: write a uint8 presence marker, then (if present) the
 * unwrapped value via the supplied recursive encoder.
 */
export function emitOptionalEncode(
  field: any,
  value: string,
  ctx: EmitCtx,
  indent: string,
  recurse: (f: any, v: string, c: EmitCtx, i: string) => string[],
): string[] {
  assertBytePresence(field);
  const opt = uniqueVar("_opt");
  const lines: string[] = [];
  lines.push(`${indent}if (${value}) |${opt}| {`);
  lines.push(`${indent}    try ${ENC}.writeUint8(1);`);
  lines.push(...recurse(innerField(field), opt, ctx, indent + "    "));
  lines.push(`${indent}} else {`);
  lines.push(`${indent}    try ${ENC}.writeUint8(0);`);
  lines.push(`${indent}}`);
  return lines;
}

/**
 * Decode an optional: read the presence marker; if present, decode the inner
 * value into a temp of the inner type and assign it (coerced to `?T`), else null.
 */
export function emitOptionalDecode(
  field: any,
  ctx: EmitCtx,
  lhs: string,
  structVar: string,
  indent: string,
  recurse: (f: any, c: EmitCtx, lhs: string, sv: string, i: string) => string[],
): string[] {
  assertBytePresence(field);
  const present = uniqueVar("_present");
  const tmp = uniqueVar("_optv");
  const innerType = zigDeclaredType(innerField(field), ctx.schema);
  const lines: string[] = [];
  lines.push(`${indent}const ${present} = (try ${DEC}.readUint8()) != 0;`);
  lines.push(`${indent}if (${present}) {`);
  lines.push(`${indent}    var ${tmp}: ${innerType} = undefined;`);
  lines.push(...recurse(innerField(field), ctx, tmp, structVar, indent + "    "));
  lines.push(`${indent}    ${lhs} = ${tmp};`);
  lines.push(`${indent}} else {`);
  lines.push(`${indent}    ${lhs} = null;`);
  lines.push(`${indent}}`);
  return lines;
}
