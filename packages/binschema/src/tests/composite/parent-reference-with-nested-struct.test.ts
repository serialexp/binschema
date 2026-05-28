// ABOUTME: Regression test for the Rust parent-frame off-by-one bug.
// ABOUTME: A struct that has BOTH a ../parent reference AND a nested struct field.

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Reproduces the Rust generator off-by-one in parent-frame depth.
 *
 * The shape that triggers the bug (Parquet Page / PageHeader):
 * - `Message` has `header` (a nested struct) and `body` (bytes).
 * - `Header` references the parent's body via `length_of "../body"`.
 * - CRUCIALLY, `Header` ALSO contains its own nested struct (`inner`).
 *
 * Because `Header` has a nested struct, the Rust generator builds a
 * `child_ctx` (pushing Header's own frame) and previously resolved Header's
 * OWN `../body` computed field against that `child_ctx`. The extra frame put
 * `body` one level too deep, producing a runtime
 * `InvalidValue("Parent field 'body' not found at level 1")`.
 *
 * The plain `parent_field_reference_length` suite does NOT catch this because
 * its `Header` has no nested struct, so no `child_ctx` frame is pushed.
 */
export const parentReferenceWithNestedStructTestSuite = defineTestSuite({
  name: "parent_reference_with_nested_struct",
  description:
    "Struct with both a ../parent reference and a nested struct field (Rust parent-frame off-by-one regression)",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Inner": {
        sequence: [
          { name: "magic", type: "uint8" }
        ]
      },
      "Header": {
        sequence: [
          { name: "version", type: "uint16" },
          // Nested struct → makes Header "hasNestedStructs", which is what
          // triggered the extra parent frame in the Rust generator.
          { name: "inner", type: "Inner" },
          {
            name: "body_length",
            type: "uint32",
            computed: {
              type: "length_of",
              target: "../body"
            }
          }
        ]
      },
      "Message": {
        sequence: [
          { name: "header", type: "Header" },
          {
            name: "body",
            type: "array",
            kind: "field_referenced",
            length_field: "header.body_length",
            items: { type: "uint8" }
          }
        ]
      }
    }
  },
  test_type: "Message",
  test_cases: [
    {
      description: "Header with nested struct still resolves ../body",
      value: {
        header: {
          version: 1,
          inner: { magic: 0x07 }
          // body_length is computed from ../body
        },
        body: [0xAA, 0xBB, 0xCC, 0xDD]
      },
      decoded_value: {
        header: {
          version: 1,
          inner: { magic: 0x07 },
          body_length: 4
        },
        body: [0xAA, 0xBB, 0xCC, 0xDD]
      },
      bytes: [
        // header.version (uint16 LE)
        1, 0,
        // header.inner.magic (uint8)
        0x07,
        // header.body_length (uint32 LE) — AUTO-COMPUTED from ../body
        4, 0, 0, 0,
        // body (4 bytes)
        0xAA, 0xBB, 0xCC, 0xDD
      ]
    },
    {
      description: "Empty body produces zero length",
      value: {
        header: {
          version: 2,
          inner: { magic: 0x42 }
        },
        body: []
      },
      decoded_value: {
        header: {
          version: 2,
          inner: { magic: 0x42 },
          body_length: 0
        },
        body: []
      },
      bytes: [
        2, 0,    // version
        0x42,    // inner.magic
        0, 0, 0, 0  // body_length = 0
      ]
    }
  ]
});
