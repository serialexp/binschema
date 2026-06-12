// ABOUTME: Computed-field, selector, and placeholder/patch emission for Zig.
// ABOUTME: Phase 3 home. Stubs now establish the seam; the two-pass runtime already exists.
//
// The load-bearing two-pass primitives (placeholderU{8,16,32,64} / patch / the
// EncodeContext deferred-patch resolver) already live in the Zig runtime and
// are exercised by its unit tests. This module is where the GENERATOR learns to
// emit calls to them — `length_of` with `from_after_field`, `position_of` to a
// later field, `first<T>`/`last<T>`/`corresponding<T>` selectors, `crc32_of`,
// `count_of`, and `../` parent references. Implemented in Phase 3.

import { ZigNotImplemented } from "./encode.js";

export function generateComputedFieldEncode(_field: any, _ctx: any): string[] {
  throw new ZigNotImplemented("computed field encode (Phase 3)");
}

export function generateFromAfterFieldEncode(_field: any, _ctx: any): string[] {
  throw new ZigNotImplemented("from_after_field encode (Phase 3)");
}

export function generateComputedFieldDecode(_field: any, _ctx: any): string[] {
  throw new ZigNotImplemented("computed field decode (Phase 3)");
}
