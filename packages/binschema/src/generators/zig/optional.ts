// ABOUTME: Optional (`?T`) field emission for the Zig generator (Phase 4/5).
// ABOUTME: A presence marker (1=present, 0=absent) precedes the value. The
// marker is a `uint8` byte by default, or a single bit when
// `presence_type: "bit"` — the bit case packs into the surrounding bitstream
// exactly like the TS/Python reference (misaligned `writeUint8` is LSB-first).

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

/** Validate the presence marker kind; only `uint8` and `bit` are supported. */
function presenceKind(field: any): "uint8" | "bit" {
  const presence = field.presence_type || "uint8";
  if (presence !== "uint8" && presence !== "bit") {
    throw new ZigNotImplemented(`optional with '${presence}' presence`);
  }
  return presence;
}

/** Emit the presence-marker write (1=present, 0=absent). */
function writePresence(kind: "uint8" | "bit", present: 0 | 1, indent: string): string {
  return kind === "bit"
    ? `${indent}try ${ENC}.writeBits(${present}, 1);`
    : `${indent}try ${ENC}.writeUint8(${present});`;
}

/** Emit the presence-marker read as a Zig `bool` expression. */
function readPresenceExpr(kind: "uint8" | "bit"): string {
  return kind === "bit"
    ? `(try ${DEC}.readBits(1)) != 0`
    : `(try ${DEC}.readUint8()) != 0`;
}

/** Zig declared type for an optional field: `?<inner>`. */
export function zigOptionalType(field: any, schema: any): string {
  presenceKind(field);
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
  const kind = presenceKind(field);
  const opt = uniqueVar("_opt");
  const lines: string[] = [];
  lines.push(`${indent}if (${value}) |${opt}| {`);
  lines.push(writePresence(kind, 1, indent + "    "));
  lines.push(...recurse(innerField(field), opt, ctx, indent + "    "));
  lines.push(`${indent}} else {`);
  lines.push(writePresence(kind, 0, indent + "    "));
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
  const kind = presenceKind(field);
  const present = uniqueVar("_present");
  const tmp = uniqueVar("_optv");
  const innerType = zigDeclaredType(innerField(field), ctx.schema);
  const lines: string[] = [];
  lines.push(`${indent}const ${present} = ${readPresenceExpr(kind)};`);
  lines.push(`${indent}if (${present}) {`);
  lines.push(`${indent}    var ${tmp}: ${innerType} = undefined;`);
  lines.push(...recurse(innerField(field), ctx, tmp, structVar, indent + "    "));
  lines.push(`${indent}    ${lhs} = ${tmp};`);
  lines.push(`${indent}} else {`);
  lines.push(`${indent}    ${lhs} = null;`);
  lines.push(`${indent}}`);
  return lines;
}
