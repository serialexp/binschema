// ABOUTME: Tests for standalone-type discriminated_union with a FIELD-based
// ABOUTME: discriminator (vs. inline-in-sequence or peek-based). The TS
// ABOUTME: generator handles this by inlining the dispatch into the *parent*
// ABOUTME: decoder/encoder using the parent's previously-decoded discriminator
// ABOUTME: field — the standalone Payload type's decode_with_decoder is never
// ABOUTME: called. The Rust generator currently emits NotImplemented for the
// ABOUTME: standalone type's decoder and silently breaks the parent's call site.
//
// See CLAUDE.md "Tests-first for codegen features" for context on why this
// scenario lives here as a regression-prevention suite.

import { defineTestSuite } from "../../schema/test-schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Standalone DU with field-based discriminator referenced from a wrapper.
// ─────────────────────────────────────────────────────────────────────────────
export const standaloneDuFieldDiscriminatorTestSuite = defineTestSuite({
  name: "standalone_du_field_discriminator",
  description:
    "A discriminated_union declared as a top-level type (so it gets its own " +
    "Rust enum) with a field-based discriminator. The parent struct has the " +
    "tag field and the union references it. TypeScript handles this by " +
    "inlining the dispatch at the parent's call site.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Foo": {
        sequence: [{ name: "a", type: "uint8" }],
      },
      "Bar": {
        sequence: [{ name: "b", type: "uint16" }],
      },
      "Payload": {
        type: "discriminated_union",
        discriminator: { field: "tag" },
        variants: [
          { when: "value == 1", type: "Foo" },
          { when: "value == 2", type: "Bar" },
        ],
      },
      "Wrapper": {
        sequence: [
          { name: "tag", type: "uint8" },
          { name: "p", type: "Payload" },
        ],
      },
    },
  },

  test_type: "Wrapper",

  test_cases: [
    {
      description: "Foo variant (tag=1)",
      value: {
        tag: 1,
        p: { type: "Foo", value: { a: 0x42 } },
      },
      bytes: [0x01, 0x42],
    },
    {
      description: "Bar variant (tag=2)",
      value: {
        tag: 2,
        p: { type: "Bar", value: { b: 0x1234 } },
      },
      bytes: [0x02, 0x12, 0x34],
    },
  ],
});
