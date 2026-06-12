// ABOUTME: Back-reference / DNS-style label compression emission for Zig.
// ABOUTME: Phase 5 home. The runtime codec registry + compression dict already exist.

import { ZigNotImplemented } from "./encode.js";

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

export function generateCompressedEncode(_field: any, _ctx: any): string[] {
  throw new ZigNotImplemented("compressed/back_reference encode (Phase 5)");
}

export function generateCompressedDecode(_field: any, _ctx: any): string[] {
  throw new ZigNotImplemented("compressed/back_reference decode (Phase 5)");
}
