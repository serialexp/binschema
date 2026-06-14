// ABOUTME: Regression tests for a discriminated_union (sibling-field discriminator)
// ABOUTME: that is inlined as a NAMED FIELD of another struct, rather than sitting
// ABOUTME: at the top level or as a direct array element.
//
// Bug (BUG-nested-union-named-field-ts.md, reported by lune): the TS decoder read
// the discriminator tag and assigned the body into the correct nested path
// (`x.key.tag`, `x.key.body`) but branched every `when` clause against the wrong
// base — the CONTAINER path (`x.tag`, undefined) instead of the union field's own
// owner (`x.key.tag`). Every branch missed, the `else` threw
// "Unknown discriminator value: undefined", so a valid, round-trippable Bag always
// failed to decode. The defect was masked for the top-level and direct-array-element
// cases because there the owner path == the first path segment by coincidence; it
// only bit once the union-bearing struct was nested one level under a named field.
//
// These suites hand-compute the wire bytes (TS is the spec) and exercise BOTH the
// previously-correct cases (top-level `Val`, array-of-`Val`) and the previously-broken
// ones (named-field `Pair.key`/`Pair.val`, array-of-`Pair`), so the cross-language
// harness locks the fix in every generator. See CLAUDE.md "Tests-first for codegen
// features".

import { defineTestSuite } from "../../schema/test-schema.js";

// Shared type set: a Val struct carrying a sibling-field discriminated union, used
// both as a named field (Pair) and as an array element (Bag).
const UNION_TYPES = {
  "Val": {
    sequence: [
      { name: "tag", type: "uint8" as const },
      {
        name: "body",
        type: "discriminated_union" as const,
        discriminator: { field: "tag" },
        variants: [
          { type: "Nil", when: "value === 0" },
          { type: "Int", when: "value === 1" },
        ],
      },
    ],
  },
  "Nil": { sequence: [{ name: "pad", type: "uint8" as const }] },
  "Int": {
    sequence: [{ name: "v", type: "uint32" as const, endianness: "little_endian" as const }],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Named-field nesting — the core bug. `Pair` has two named `Val` fields, so each
//    union lives at `value.key.body` / `value.val.body` (3-segment target).
// ─────────────────────────────────────────────────────────────────────────────
export const nestedNamedFieldUnionTestSuite = defineTestSuite({
  name: "nested_named_field_union",
  description:
    "discriminated_union inlined as a named struct field (Pair.key/Pair.val). The " +
    "decoder must branch on the union field's own owner path (value.key.tag), not the " +
    "container (value.tag). Regression for BUG-nested-union-named-field-ts.md.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      ...UNION_TYPES,
      "Pair": {
        sequence: [
          { name: "key", type: "Val" },
          { name: "val", type: "Val" },
        ],
      },
    },
  },

  test_type: "Pair",

  test_cases: [
    {
      description: "key=Int(7), val=Nil — first field is the Int variant",
      value: {
        key: { tag: 1, body: { type: "Int", value: { v: 7 } } },
        val: { tag: 0, body: { type: "Nil", value: { pad: 0 } } },
      },
      // key.tag=01 | key Int.v=7 LE=07 00 00 00 | val.tag=00 | val Nil.pad=00
      bytes: [0x01, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
      description: "key=Nil, val=Int(0x01020304) — variants swapped between the two fields",
      value: {
        key: { tag: 0, body: { type: "Nil", value: { pad: 0xaa } } },
        val: { tag: 1, body: { type: "Int", value: { v: 0x01020304 } } },
      },
      // key.tag=00 | key Nil.pad=AA | val.tag=01 | val Int.v=0x01020304 LE=04 03 02 01
      bytes: [0x00, 0xaa, 0x01, 0x04, 0x03, 0x02, 0x01],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Array element vs. array-of-named-field. `Bag.as_elem` is array<Val> (the union
//    sits at the iter object — previously correct); `Bag.as_field` is array<Pair>,
//    so each union sits at `as_field__iter.key.body` (previously broken). One fixture
//    proving the fix did not regress the working case and did fix the broken one.
// ─────────────────────────────────────────────────────────────────────────────
export const nestedUnionArrayMixTestSuite = defineTestSuite({
  name: "nested_union_array_mix",
  description:
    "Array of the union type directly (as_elem) alongside an array of structs that " +
    "carry the union as a named field (as_field). Both must decode; the named-field " +
    "case is the regression target.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      ...UNION_TYPES,
      "Pair": {
        sequence: [
          { name: "key", type: "Val" },
          { name: "val", type: "Val" },
        ],
      },
      "Bag": {
        sequence: [
          {
            name: "as_elem",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint32",
            items: { type: "Val" },
          },
          {
            name: "as_field",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint32",
            items: { type: "Pair" },
          },
        ],
      },
    },
  },

  test_type: "Bag",

  test_cases: [
    {
      description: "as_elem=[Int(7)], as_field=[{key:Int(1), val:Nil}]",
      value: {
        as_elem: [{ tag: 1, body: { type: "Int", value: { v: 7 } } }],
        as_field: [
          {
            key: { tag: 1, body: { type: "Int", value: { v: 1 } } },
            val: { tag: 0, body: { type: "Nil", value: { pad: 0 } } },
          },
        ],
      },
      bytes: [
        // as_elem length prefix (uint32 BE) = 1
        0x00, 0x00, 0x00, 0x01,
        // as_elem[0]: tag=01, Int.v=7 LE
        0x01, 0x07, 0x00, 0x00, 0x00,
        // as_field length prefix (uint32 BE) = 1
        0x00, 0x00, 0x00, 0x01,
        // as_field[0].key: tag=01, Int.v=1 LE
        0x01, 0x01, 0x00, 0x00, 0x00,
        // as_field[0].val: tag=00, Nil.pad=00
        0x00, 0x00,
      ],
    },
  ],
});
