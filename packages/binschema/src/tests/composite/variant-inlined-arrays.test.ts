// ABOUTME: Tests for arrays inside discriminated_union / choice variant arms.
// ABOUTME: The Rust variant-arm inliner historically only handled
// ABOUTME: array<uint8|uint16|uint32> and bailed (NotImplemented) on every
// ABOUTME: other item type — uint64, int*, float*, bool, etc. These suites
// ABOUTME: exercise the full primitive item-type matrix in both variant kinds
// ABOUTME: so cross-language harnesses catch any regression.
//
// Companion to variant-inlined-fields.test.ts (which covers bool / bytes /
// Optional<T>); see CLAUDE.md "Tests-first for codegen features" for context.

import { defineTestSuite } from "../../schema/test-schema.js";

// Small helper to build a variant-style schema with one variant that holds a
// `length_prefixed` array of the given primitive item type. Keeps each suite's
// schema tiny and obviously correct.
function arrayInDiscriminatedUnionSchema(itemType: string) {
  return {
    config: { endianness: "big_endian" } as const,
    types: {
      "Holder": {
        sequence: [
          {
            name: "values",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint8",
            items: { type: itemType },
          },
        ],
      },
      "Empty": { sequence: [] },
      "Tagged": {
        sequence: [
          { name: "tag", type: "uint8" },
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "tag" },
            variants: [
              { when: "value == 1", type: "Holder" },
              { when: "value == 2", type: "Empty" },
            ],
          },
        ],
      },
    },
  } as const;
}

function arrayInChoiceSchema(itemType: string) {
  return {
    config: { endianness: "big_endian" } as const,
    types: {
      "Holder": {
        sequence: [
          { name: "kind", type: "uint8", const: 0x01 },
          {
            name: "values",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint8",
            items: { type: itemType },
          },
        ],
      },
      "Empty": {
        sequence: [
          { name: "kind", type: "uint8", const: 0x02 },
        ],
      },
      "Outer": {
        sequence: [
          {
            name: "body",
            type: "choice",
            choices: [
              { type: "Holder" },
              { type: "Empty" },
            ],
          },
        ],
      },
    },
  } as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. discriminated_union — array<uint64>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayUint64DiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_array_uint64_discriminated",
  description:
    "discriminated_union arm whose variant struct contains array<uint64> " +
    "(length-prefixed). Catches the inliner's missing uint64 array case.",
  schema: arrayInDiscriminatedUnionSchema("uint64"),
  test_type: "Tagged",
  test_cases: [
    {
      description: "Two uint64 values",
      value: {
        tag: 1,
        payload: { type: "Holder", value: { values: [1n, 0xDEADBEEFCAFEn] } },
      },
      bytes: [
        0x01,                                  // tag
        0x02,                                  // length
        0, 0, 0, 0, 0, 0, 0, 0x01,             // 1
        0, 0, 0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, // 0xDEADBEEFCAFE
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. discriminated_union — array<int32>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayInt32DiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_array_int32_discriminated",
  description:
    "discriminated_union arm whose variant struct contains array<int32> " +
    "(length-prefixed). Exercises the inliner's missing signed-integer array case.",
  schema: arrayInDiscriminatedUnionSchema("int32"),
  test_type: "Tagged",
  test_cases: [
    {
      description: "Three int32 values including negative",
      value: {
        tag: 1,
        payload: { type: "Holder", value: { values: [1, -1, 0x7FFFFFFF] } },
      },
      bytes: [
        0x01,                   // tag
        0x03,                   // length
        0x00, 0x00, 0x00, 0x01, // 1
        0xFF, 0xFF, 0xFF, 0xFF, // -1
        0x7F, 0xFF, 0xFF, 0xFF, // INT32_MAX
      ],
    },
    {
      description: "Empty int32 array",
      value: {
        tag: 1,
        payload: { type: "Holder", value: { values: [] } },
      },
      bytes: [0x01, 0x00],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. discriminated_union — array<float32>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayFloat32DiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_array_float32_discriminated",
  description:
    "discriminated_union arm whose variant struct contains array<float32> " +
    "(length-prefixed). Exercises the inliner's missing float array case.",
  schema: arrayInDiscriminatedUnionSchema("float32"),
  test_type: "Tagged",
  test_cases: [
    {
      description: "Two float32 values",
      value: {
        tag: 1,
        payload: { type: "Holder", value: { values: [1.0, -2.5] } },
      },
      bytes: [
        0x01,                   // tag
        0x02,                   // length
        0x3F, 0x80, 0x00, 0x00, // 1.0f
        0xC0, 0x20, 0x00, 0x00, // -2.5f
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. discriminated_union — array<bool>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayBoolDiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_array_bool_discriminated",
  description:
    "discriminated_union arm whose variant struct contains array<bool> " +
    "(length-prefixed). Exercises the inliner's missing bool array case.",
  schema: arrayInDiscriminatedUnionSchema("bool"),
  test_type: "Tagged",
  test_cases: [
    {
      description: "Three bool values",
      value: {
        tag: 1,
        payload: { type: "Holder", value: { values: [true, false, true] } },
      },
      bytes: [0x01, 0x03, 0x01, 0x00, 0x01],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. choice — array<uint64>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayUint64ChoiceTestSuite = defineTestSuite({
  name: "variant_inlined_array_uint64_choice",
  description:
    "choice arm whose variant struct contains array<uint64> (length-prefixed). " +
    "Mirrors the discriminated_union test against the choice inliner.",
  schema: arrayInChoiceSchema("uint64"),
  test_type: "Outer",
  test_cases: [
    {
      description: "Single uint64 value",
      value: {
        body: { type: "Holder", values: [0x0102030405060708n] },
      },
      decoded_value: {
        body: { type: "Holder", kind: 0x01, values: [0x0102030405060708n] },
      },
      bytes: [0x01, 0x01, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. choice — array<int32>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayInt32ChoiceTestSuite = defineTestSuite({
  name: "variant_inlined_array_int32_choice",
  description:
    "choice arm whose variant struct contains array<int32> (length-prefixed).",
  schema: arrayInChoiceSchema("int32"),
  test_type: "Outer",
  test_cases: [
    {
      description: "Two int32 values",
      value: {
        body: { type: "Holder", values: [-1, 1] },
      },
      decoded_value: {
        body: { type: "Holder", kind: 0x01, values: [-1, 1] },
      },
      bytes: [
        0x01,                   // discriminator
        0x02,                   // length
        0xFF, 0xFF, 0xFF, 0xFF, // -1
        0x00, 0x00, 0x00, 0x01, // 1
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. choice — array<float32>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayFloat32ChoiceTestSuite = defineTestSuite({
  name: "variant_inlined_array_float32_choice",
  description:
    "choice arm whose variant struct contains array<float32> (length-prefixed).",
  schema: arrayInChoiceSchema("float32"),
  test_type: "Outer",
  test_cases: [
    {
      description: "Single float32",
      value: {
        body: { type: "Holder", values: [1.0] },
      },
      decoded_value: {
        body: { type: "Holder", kind: 0x01, values: [1.0] },
      },
      bytes: [0x01, 0x01, 0x3F, 0x80, 0x00, 0x00],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. choice — array<bool>
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedArrayBoolChoiceTestSuite = defineTestSuite({
  name: "variant_inlined_array_bool_choice",
  description:
    "choice arm whose variant struct contains array<bool> (length-prefixed).",
  schema: arrayInChoiceSchema("bool"),
  test_type: "Outer",
  test_cases: [
    {
      description: "Two bool values",
      value: {
        body: { type: "Holder", values: [true, false] },
      },
      decoded_value: {
        body: { type: "Holder", kind: 0x01, values: [true, false] },
      },
      bytes: [0x01, 0x02, 0x01, 0x00],
    },
  ],
});
