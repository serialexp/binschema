// ABOUTME: `compressed` wire-transform region emission for Zig (store/deflate/gzip).
// ABOUTME: Plus back_reference / DNS-style label compression pointers (encode + decode).

import type { BinarySchema } from "../../schema/binary-schema.js";
import { RT, ENC, CTX, DEC, ALLOC, ERR } from "./context.js";
import { zigTypeName, uniqueVar } from "./naming.js";
import { zigEndianness, resolveAlias, classifyTypeDef } from "./types.js";
import { ZigNotImplemented, emitEncodeValue, type EmitCtx } from "./encode.js";
import { emitDecodeValue } from "./decode.js";

export function schemaUsesCompression(schema: any): boolean {
  // Mirrors python.ts schemaUsesCompression: scan for compressed/back_reference shapes.
  for (const typeDef of Object.values(schema.types ?? {})) {
    const t = typeDef as any;
    if (t?.type === "back_reference") return true;
    const seq = t?.sequence;
    if (Array.isArray(seq)) {
      for (const f of seq) {
        if (f?.type === "compressed" || f?.compressed || f?.back_reference) return true;
      }
    }
  }
  return false;
}

const SIZE_TYPES = new Set(["uint8", "uint16", "uint32", "uint64"]);

/** Emit a write of a length value (`expr`) using the given size type + endianness. */
function sizeWrite(sizeType: string, expr: string, e: string, indent: string): string {
  switch (sizeType) {
    case "uint8": return `${indent}try ${ENC}.writeUint8(@intCast(${expr}));`;
    case "uint16": return `${indent}try ${ENC}.writeUint16(@intCast(${expr}), ${e});`;
    case "uint32": return `${indent}try ${ENC}.writeUint32(@intCast(${expr}), ${e});`;
    case "uint64": return `${indent}try ${ENC}.writeUint64(@intCast(${expr}), ${e});`;
    default: throw new ZigNotImplemented(`compressed size type '${sizeType}'`);
  }
}

/** Emit a `const <name> = read…;` for a size field using the given size type. */
function sizeRead(sizeType: string, name: string, e: string, indent: string): string {
  switch (sizeType) {
    case "uint8": return `${indent}const ${name} = try ${DEC}.readUint8();`;
    case "uint16": return `${indent}const ${name} = try ${DEC}.readUint16(${e});`;
    case "uint32": return `${indent}const ${name} = try ${DEC}.readUint32(${e});`;
    case "uint64": return `${indent}const ${name} = try ${DEC}.readUint64(${e});`;
    default: throw new ZigNotImplemented(`compressed size type '${sizeType}'`);
  }
}

/**
 * Resolve the inner struct type name of a `compressed` field. The inner value is
 * encoded to a self-contained buffer via its own `encode`/`decode`, so it must
 * be a named struct (the only shape with those methods). Inline/primitive inner
 * types are a later extension.
 */
function innerStructName(field: any, schema: BinarySchema): string {
  const vt = field.value_type;
  if (typeof vt !== "string") {
    throw new ZigNotImplemented("compressed inline value_type (named struct only)");
  }
  const cls = classifyTypeDef(resolveAlias(schema, vt));
  if (cls !== "struct") {
    throw new ZigNotImplemented(`compressed value_type '${vt}' (named struct only, got ${cls})`);
  }
  return zigTypeName(vt);
}

function framingTypes(field: any): { sizeType: string; lengthType: string; codec: string } {
  const codec = field.codec;
  if (typeof codec !== "string") throw new ZigNotImplemented("compressed without codec");
  const sizeType = field.size_type || "uint32";
  const lengthType = field.length_type || "uint32";
  if (!SIZE_TYPES.has(sizeType) || !SIZE_TYPES.has(lengthType)) {
    throw new ZigNotImplemented(`compressed framing types '${sizeType}'/'${lengthType}'`);
  }
  return { sizeType, lengthType, codec };
}

/**
 * Encode a `compressed` region: serialize the inner value to a self-contained
 * buffer, run it through the codec, and frame it as
 *   [uncompressed_size: size_type][compressed_length: length_type][bytes…].
 * The inner `.encode` is a fresh top-level pass (the region is self-contained),
 * so it composes with the outer two-pass machinery without sharing its context.
 */
export function emitCompressedEncode(field: any, value: string, ctx: EmitCtx, indent: string): string[] {
  innerStructName(field, ctx.schema); // validate inner shape (throws clean if unsupported)
  const { sizeType, lengthType, codec } = framingTypes(field);
  const e = zigEndianness(field.endianness, ctx.endianness);
  const inner = uniqueVar("_inner");
  const comp = uniqueVar("_comp");
  return [
    `${indent}// compressed region: encode inner, compress, frame`,
    `${indent}const ${inner} = try ${value}.encode(${ENC}.allocator);`,
    `${indent}defer ${ENC}.allocator.free(${inner});`,
    `${indent}const ${comp} = try (try ${RT}.resolveCodec("${codec}")).compress(${ENC}.allocator, ${inner});`,
    `${indent}defer ${ENC}.allocator.free(${comp});`,
    sizeWrite(sizeType, `${inner}.len`, e, indent),
    sizeWrite(lengthType, `${comp}.len`, e, indent),
    `${indent}try ${ENC}.writeBytes(${comp});`,
  ];
}

/**
 * Decode a `compressed` region: read the two framing sizes, slice the compressed
 * bytes, decompress (asserting the result matches `uncompressed_size`), and
 * decode the inner type over the decompressed buffer.
 */
export function emitCompressedDecode(field: any, ctx: EmitCtx, lhs: string, indent: string): string[] {
  const innerName = innerStructName(field, ctx.schema);
  const { sizeType, lengthType, codec } = framingTypes(field);
  const e = zigEndianness(field.endianness, ctx.endianness);
  const usize = uniqueVar("_usize");
  const clen = uniqueVar("_clen");
  const slice = uniqueVar("_cslice");
  const decomp = uniqueVar("_decomp");
  return [
    `${indent}// compressed region: read framing, decompress, decode inner`,
    sizeRead(sizeType, usize, e, indent),
    sizeRead(lengthType, clen, e, indent),
    `${indent}const ${slice} = try ${DEC}.readBytesSlice(${clen});`,
    `${indent}const ${decomp} = try (try ${RT}.resolveCodec("${codec}")).decompress(${ALLOC}, ${slice}, ${usize});`,
    `${indent}if (${decomp}.len != ${usize}) return ${ERR}.InvalidEncoding;`,
    `${indent}${lhs} = try ${innerName}.decode(${ALLOC}, ${decomp});`,
  ];
}

// ---------------------------------------------------------------------------
// Back-references (DNS-style label compression pointers)
// ---------------------------------------------------------------------------

interface BackRef {
  storage: string; // "uint16"
  endianness?: string;
  mask: number; // low bits that hold the offset, e.g. 0x3FFF
  topBits: number; // the marker bits the offset is OR'd under, e.g. 0xC000
  offsetFrom: string; // "message_start"
  targetType: string; // the type a pointer dereferences to (a string/bytes)
}

/**
 * Parse a `back_reference` typeDef into the concrete framing a DNS-style pointer
 * needs. Scope: a fixed-width unsigned `storage` int, an `offset_mask` (the low
 * bits that carry the offset, the complement being the marker bits), an absolute
 * `message_start` offset, and a string/bytes `target_type`. Anything outside that
 * throws a clean `ZigNotImplemented` so the gap stays visible.
 */
function parseBackRef(def: any): BackRef {
  const storage = def.storage || "uint16";
  const storageBits: Record<string, number> = { uint8: 8, uint16: 16, uint32: 32 };
  const bits = storageBits[storage];
  if (!bits) throw new ZigNotImplemented(`back_reference storage '${storage}'`);
  const full = bits === 32 ? 0xffffffff : (1 << bits) - 1;
  const mask = typeof def.offset_mask === "string"
    ? parseInt(def.offset_mask, 16)
    : (def.offset_mask ?? full);
  const topBits = full & ~mask;
  const offsetFrom = def.offset_from || "message_start";
  if (offsetFrom !== "message_start") {
    throw new ZigNotImplemented(`back_reference offset_from '${offsetFrom}' (message_start only)`);
  }
  if (typeof def.target_type !== "string") {
    throw new ZigNotImplemented("back_reference inline target_type (named type only)");
  }
  return { storage, endianness: def.endianness, mask, topBits, offsetFrom, targetType: def.target_type };
}

/**
 * Encode a back_reference value (the target's logical value, e.g. a label's
 * text). If that value was already encoded somewhere earlier in this message,
 * emit a pointer (`topBits | (offset & mask)`) to its recorded offset. Otherwise
 * register the current offset under it and encode the target inline as a literal
 * — the standard DNS "first occurrence is literal, later ones compress" rule.
 */
export function emitBackReferenceEncode(def: any, value: string, ctx: EmitCtx, indent: string): string[] {
  const br = parseBackRef(def);
  const e = zigEndianness(br.endianness, ctx.endianness);
  const off = uniqueVar("_bref_off");
  return [
    `${indent}if (${CTX}.compressionLookup(${value})) |${off}| {`,
    sizeWrite(br.storage, `(${br.topBits} | (${off} & ${br.mask}))`, e, indent + "    "),
    `${indent}} else {`,
    `${indent}    try ${CTX}.compressionInsert(${value}, ${CTX}.absolute_byte_offset + ${ENC}.byteOffset());`,
    ...emitEncodeValue({ type: br.targetType }, value, ctx, indent + "    "),
    `${indent}}`,
  ];
}

/**
 * Decode a back_reference: read the pointer, mask off the marker bits to get the
 * absolute offset, seek there (saving/restoring the read position), and decode
 * the `target_type` over the pointed-at bytes into `lhs`.
 */
export function emitBackReferenceDecode(
  def: any, ctx: EmitCtx, lhs: string, structVar: string, indent: string,
): string[] {
  const br = parseBackRef(def);
  const e = zigEndianness(br.endianness, ctx.endianness);
  const raw = uniqueVar("_bref_raw");
  const off = uniqueVar("_bref_off");
  return [
    sizeRead(br.storage, raw, e, indent),
    `${indent}const ${off}: usize = @as(usize, ${raw}) & ${br.mask};`,
    `${indent}try ${DEC}.pushPosition();`,
    `${indent}try ${DEC}.seek(${off});`,
    ...emitDecodeValue({ type: br.targetType }, ctx, lhs, structVar, indent),
    `${indent}try ${DEC}.popPosition();`,
  ];
}
