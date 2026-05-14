// ABOUTME: Tests for schemas where a named type alias is called `String`
// ABOUTME: combined with features that make the Rust generator emit
// ABOUTME: HashMap<String, FieldValue> parent-tracking code. Without
// ABOUTME: fully-qualifying `std::string::String`, the generated `String`
// ABOUTME: wrapper shadows the std type and the HashMap fails to compile
// ABOUTME: with a flood of E0308 / E0599 errors.
//
// See BINSCHEMA_RUST_GEN_ISSUES_2.md "Issue 2" — the rustyql wire schema
// hit this with 59 errors before introducing a manual `WireStr` rename. The
// fix is for the Rust generator to emit `std::string::String` / qualified
// `HashMap` everywhere the runtime contract calls for it, instead of bare
// `String`.

import { defineTestSuite } from "../../schema/test-schema.js";

// A schema that combines:
//   1. A named type alias called `String` (so the wrapper struct exists)
//   2. A nested struct field whose containing type uses `length_of`
//      parent-tracking — that triggers `HashMap<String, FieldValue>`
//      emission in the Rust output.
export const stringAliasWithParentTrackingTestSuite = defineTestSuite({
  name: "string_alias_with_parent_tracking",
  description:
    "Schema defines an alias named `String` AND uses computed length_of " +
    "parent-tracking. Generated Rust must keep the `String` alias usable " +
    "without breaking the runtime HashMap<std::string::String, FieldValue> " +
    "contract.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      // The type alias whose name shadows std::string::String inside the
      // generated module. Wraps the primitive `string` with a uint8 length
      // prefix.
      "String": {
        type: "string",
        kind: "length_prefixed",
        length_type: "uint8",
        encoding: "ascii",
        description: "Length-prefixed ASCII string alias named String",
      },
      // A nested struct field. Having a direct nested-struct field is what
      // makes the Rust generator emit `hasNestedStructs = true` and therefore
      // the `let mut parent_fields: HashMap<String, FieldValue> = ...` line.
      "Inner": {
        sequence: [
          { name: "marker", type: "uint8" },
        ],
      },
      // The outer container. A direct `inner: Inner` field forces the Rust
      // generator to thread parent_fields through — emitting
      // `let mut parent_fields: HashMap<String, FieldValue> = ...` in the
      // encode method. Combined with the `String` type alias above, the
      // generated `String` wrapper would shadow `std::string::String` inside
      // that HashMap declaration unless the generator fully qualifies it.
      "Container": {
        sequence: [
          { name: "name", type: "String" },
          { name: "inner", type: "Inner" },
        ],
      },
    },
  },

  test_type: "Container",

  test_cases: [
    {
      description: "Empty name, marker=0",
      value: {
        name: "",
        inner: { marker: 0x00 },
      },
      bytes: [
        0x00, // name length = 0
        0x00, // inner.marker = 0
      ],
    },
    {
      description: "name='hi', marker=0xab",
      value: {
        name: "hi",
        inner: { marker: 0xab },
      },
      bytes: [
        0x02, 0x68, 0x69, // name = "hi"
        0xab,             // inner.marker
      ],
    },
    {
      description: "name='abc', marker=0x42",
      value: {
        name: "abc",
        inner: { marker: 0x42 },
      },
      bytes: [
        0x03, 0x61, 0x62, 0x63, // name = "abc"
        0x42,                   // inner.marker
      ],
    },
  ],
});
