// ABOUTME: Tests for the variant-arm field inliner in discriminated_union and choice.
// ABOUTME: Each suite exercises a field type that the Rust generator's inliners
// ABOUTME: historically did not handle (bool, bytes, parameterized Optional<T>),
// ABOUTME: producing runtime NotImplemented errors in generated code despite the
// ABOUTME: outer (non-variant) encode/decode path handling the same types fine.
//
// These tests exist specifically so the cross-language harness will catch any
// regression where a primitive or generic-instantiation field cannot be encoded
// inside a union arm. See CLAUDE.md "Tests-first for codegen features" rule
// for context on why these were written before the corresponding fix.

import { defineTestSuite } from "../../schema/test-schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. discriminated_union — bool inside a variant struct
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedBoolDiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_bool_discriminated",
  description:
    "discriminated_union arm whose variant struct contains a bool field. " +
    "Catches the variant-inliner case-table missing 'bool' (encode + decode).",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Negation": {
        sequence: [
          { name: "negated", type: "bool" },
          { name: "value", type: "uint16" },
        ],
      },
      "PlainValue": {
        sequence: [
          { name: "value", type: "uint16" },
        ],
      },
      "Tagged": {
        sequence: [
          { name: "tag", type: "uint8" },
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "tag" },
            variants: [
              { when: "value == 1", type: "Negation" },
              { when: "value == 2", type: "PlainValue" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Tagged",

  test_cases: [
    {
      description: "Negation variant, negated=true",
      value: {
        tag: 1,
        payload: { type: "Negation", value: { negated: true, value: 0x1234 } },
      },
      bytes: [0x01, 0x01, 0x12, 0x34],
    },
    {
      description: "Negation variant, negated=false",
      value: {
        tag: 1,
        payload: { type: "Negation", value: { negated: false, value: 0x0000 } },
      },
      bytes: [0x01, 0x00, 0x00, 0x00],
    },
    {
      description: "PlainValue variant (no bool field)",
      value: {
        tag: 2,
        payload: { type: "PlainValue", value: { value: 0xABCD } },
      },
      bytes: [0x02, 0xAB, 0xCD],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. discriminated_union — bytes inside a variant struct
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedBytesDiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_bytes_discriminated",
  description:
    "discriminated_union arm whose variant struct contains a length-prefixed bytes field. " +
    "Catches the variant-inliner case-table missing 'bytes' (encode + decode).",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Blob": {
        sequence: [
          {
            name: "data",
            type: "bytes",
            kind: "length_prefixed",
            length_type: "uint8",
          },
        ],
      },
      "Empty": {
        sequence: [],
      },
      "Tagged": {
        sequence: [
          { name: "tag", type: "uint8" },
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "tag" },
            variants: [
              { when: "value == 1", type: "Blob" },
              { when: "value == 2", type: "Empty" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Tagged",

  test_cases: [
    {
      description: "Blob variant with 3 bytes",
      value: {
        tag: 1,
        payload: { type: "Blob", value: { data: [0xDE, 0xAD, 0xBE] } },
      },
      bytes: [0x01, 0x03, 0xDE, 0xAD, 0xBE],
    },
    {
      description: "Blob variant with empty payload",
      value: {
        tag: 1,
        payload: { type: "Blob", value: { data: [] } },
      },
      bytes: [0x01, 0x00],
    },
    {
      description: "Empty variant (no bytes field)",
      value: {
        tag: 2,
        payload: { type: "Empty", value: {} },
      },
      bytes: [0x02],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2b. discriminated_union — bytes with a NON-uint8 length prefix
// ─────────────────────────────────────────────────────────────────────────────
//
// The variant inliner has a separate length-prefix path for non-uint8 length
// types. The Rust generator's hand-rolled version of that path got both the
// cast type and the endianness wrong: it emitted `as uint32` (not a Rust type
// — should be `as u32`) and hardcoded `Endianness::BigEndian` regardless of
// the schema's config. This case exercises both bits with a uint32 length
// prefix on a little-endian schema, which any rsansible-style "blob payload"
// shape would hit.
export const variantInlinedBytesUint32LengthDiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_bytes_uint32_length_discriminated",
  description:
    "discriminated_union arm whose variant struct contains a uint32-length-prefixed bytes field on a little-endian schema. " +
    "Hits the variant-arm length-prefix path that previously emitted `as uint32` and forced BigEndian.",

  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Blob": {
        sequence: [
          {
            name: "data",
            type: "bytes",
            kind: "length_prefixed",
            length_type: "uint32",
          },
        ],
      },
      "Empty": {
        sequence: [],
      },
      "Tagged": {
        sequence: [
          { name: "tag", type: "uint8" },
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "tag" },
            variants: [
              { when: "value == 1", type: "Blob" },
              { when: "value == 2", type: "Empty" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Tagged",

  test_cases: [
    {
      description: "Blob variant with 4-byte payload (little-endian uint32 length prefix)",
      value: {
        tag: 1,
        payload: { type: "Blob", value: { data: [0xAA, 0xBB, 0xCC, 0xDD] } },
      },
      bytes: [
        0x01,                   // tag
        0x04, 0x00, 0x00, 0x00, // length = 4 (LE u32)
        0xAA, 0xBB, 0xCC, 0xDD, // data
      ],
    },
    {
      description: "Blob variant with empty payload",
      value: {
        tag: 1,
        payload: { type: "Blob", value: { data: [] } },
      },
      bytes: [
        0x01,                   // tag
        0x00, 0x00, 0x00, 0x00, // length = 0 (LE u32)
      ],
    },
    {
      description: "Empty variant (no bytes field)",
      value: {
        tag: 2,
        payload: { type: "Empty", value: {} },
      },
      bytes: [0x02],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. discriminated_union — Optional<T> (parameterized template) inside variant
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the exact shape that broke the superchat example: a variant struct
// references `Optional<uint64>`, which the generator should monomorphize at the
// reference site (TypeScript does this in src/generators/typescript.ts ~1684).
// The Rust generator currently has no monomorphization pass, so these field
// types fall through to the inliner's `default` arm and emit NotImplemented.
export const variantInlinedOptionalGenericDiscriminatedTestSuite = defineTestSuite({
  name: "variant_inlined_optional_generic_discriminated",
  description:
    "discriminated_union arm whose variant struct contains Optional<uint64> " +
    "(a parameterized-template type). Catches missing monomorphization of " +
    "Foo<T> instantiations at field-reference sites in variant arms.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Optional<T>": {
        description: "Optional field with presence byte",
        sequence: [
          { name: "present", type: "uint8" },
          { name: "value", type: "T", conditional: "present == 1" },
        ],
      },
      "WithUserId": {
        sequence: [
          { name: "user_id", type: "Optional<uint64>" },
        ],
      },
      "WithoutUserId": {
        sequence: [
          { name: "anon_marker", type: "uint8" },
        ],
      },
      "Tagged": {
        sequence: [
          { name: "tag", type: "uint8" },
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "tag" },
            variants: [
              { when: "value == 1", type: "WithUserId" },
              { when: "value == 2", type: "WithoutUserId" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Tagged",

  test_cases: [
    {
      description: "WithUserId variant, user_id present",
      value: {
        tag: 1,
        payload: {
          type: "WithUserId",
          value: { user_id: { present: 1, value: 0x0000_0000_0000_002An } },
        },
      },
      bytes: [
        0x01,                                                       // tag
        0x01,                                                       // present = 1
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2A,             // user_id = 42
      ],
    },
    {
      description: "WithUserId variant, user_id absent",
      value: {
        tag: 1,
        payload: {
          type: "WithUserId",
          value: { user_id: { present: 0 } },
        },
      },
      bytes: [
        0x01,        // tag
        0x00,        // present = 0
      ],
    },
    {
      description: "WithoutUserId variant",
      value: {
        tag: 2,
        payload: { type: "WithoutUserId", value: { anon_marker: 0xFF } },
      },
      bytes: [0x02, 0xFF],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. choice — bool inside a variant struct
// ─────────────────────────────────────────────────────────────────────────────
//
// `choice` and `discriminated_union` go through two near-duplicate inliner
// switches in rust.ts. Anything fixed in one must be fixed in the other; these
// suites exist so the harness will catch a one-sided fix.
//
// `choice` auto-derives the discriminator from each variant's first const
// field, and the value shape is flat (no { type, value } envelope).
export const variantInlinedBoolChoiceTestSuite = defineTestSuite({
  name: "variant_inlined_bool_choice",
  description:
    "choice arm whose variant struct contains a bool field. " +
    "Mirrors the discriminated_union test against the second inliner.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Yes": {
        sequence: [
          { name: "kind", type: "uint8", const: 0xAA },
          { name: "answer", type: "bool" },
        ],
      },
      "No": {
        sequence: [
          { name: "kind", type: "uint8", const: 0xBB },
          { name: "reason_code", type: "uint8" },
        ],
      },
      "Decision": {
        sequence: [
          {
            name: "outcome",
            type: "choice",
            choices: [
              { type: "Yes" },
              { type: "No" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Decision",

  test_cases: [
    {
      description: "Yes, answer=true",
      value: {
        outcome: { type: "Yes", answer: true },
      },
      decoded_value: {
        outcome: { type: "Yes", kind: 0xAA, answer: true },
      },
      bytes: [0xAA, 0x01],
    },
    {
      description: "Yes, answer=false",
      value: {
        outcome: { type: "Yes", answer: false },
      },
      decoded_value: {
        outcome: { type: "Yes", kind: 0xAA, answer: false },
      },
      bytes: [0xAA, 0x00],
    },
    {
      description: "No variant",
      value: {
        outcome: { type: "No", reason_code: 7 },
      },
      decoded_value: {
        outcome: { type: "No", kind: 0xBB, reason_code: 7 },
      },
      bytes: [0xBB, 0x07],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. choice — bytes inside a variant struct
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedBytesChoiceTestSuite = defineTestSuite({
  name: "variant_inlined_bytes_choice",
  description:
    "choice arm whose variant struct contains a length-prefixed bytes field. " +
    "Mirrors the discriminated_union test against the second inliner.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "WithBlob": {
        sequence: [
          { name: "kind", type: "uint8", const: 0x10 },
          {
            name: "data",
            type: "bytes",
            kind: "length_prefixed",
            length_type: "uint8",
          },
        ],
      },
      "WithoutBlob": {
        sequence: [
          { name: "kind", type: "uint8", const: 0x20 },
          { name: "marker", type: "uint8" },
        ],
      },
      "Wrapper": {
        sequence: [
          {
            name: "body",
            type: "choice",
            choices: [
              { type: "WithBlob" },
              { type: "WithoutBlob" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Wrapper",

  test_cases: [
    {
      description: "WithBlob, 4 bytes",
      value: {
        body: { type: "WithBlob", data: [1, 2, 3, 4] },
      },
      decoded_value: {
        body: { type: "WithBlob", kind: 0x10, data: [1, 2, 3, 4] },
      },
      bytes: [0x10, 0x04, 0x01, 0x02, 0x03, 0x04],
    },
    {
      description: "WithBlob, empty",
      value: {
        body: { type: "WithBlob", data: [] },
      },
      decoded_value: {
        body: { type: "WithBlob", kind: 0x10, data: [] },
      },
      bytes: [0x10, 0x00],
    },
    {
      description: "WithoutBlob",
      value: {
        body: { type: "WithoutBlob", marker: 0x99 },
      },
      decoded_value: {
        body: { type: "WithoutBlob", kind: 0x20, marker: 0x99 },
      },
      bytes: [0x20, 0x99],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. choice — Optional<T> inside a variant struct
// ─────────────────────────────────────────────────────────────────────────────
export const variantInlinedOptionalGenericChoiceTestSuite = defineTestSuite({
  name: "variant_inlined_optional_generic_choice",
  description:
    "choice arm whose variant struct contains Optional<uint64>. " +
    "Mirrors the discriminated_union monomorphization test against the choice inliner.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Optional<T>": {
        sequence: [
          { name: "present", type: "uint8" },
          { name: "value", type: "T", conditional: "present == 1" },
        ],
      },
      "Auth": {
        sequence: [
          { name: "kind", type: "uint8", const: 0x01 },
          { name: "user_id", type: "Optional<uint64>" },
        ],
      },
      "Anon": {
        sequence: [
          { name: "kind", type: "uint8", const: 0x02 },
          { name: "marker", type: "uint8" },
        ],
      },
      "Identity": {
        sequence: [
          {
            name: "who",
            type: "choice",
            choices: [
              { type: "Auth" },
              { type: "Anon" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Identity",

  test_cases: [
    {
      description: "Auth, user_id present",
      value: {
        who: {
          type: "Auth",
          user_id: { present: 1, value: 0x12345678n },
        },
      },
      decoded_value: {
        who: {
          type: "Auth",
          kind: 0x01,
          user_id: { present: 1, value: 0x12345678n },
        },
      },
      bytes: [
        0x01,                                                       // kind
        0x01,                                                       // present
        0x00, 0x00, 0x00, 0x00, 0x12, 0x34, 0x56, 0x78,             // user_id
      ],
    },
    {
      description: "Auth, user_id absent",
      value: {
        who: {
          type: "Auth",
          user_id: { present: 0 },
        },
      },
      decoded_value: {
        who: {
          type: "Auth",
          kind: 0x01,
          user_id: { present: 0 },
        },
      },
      bytes: [0x01, 0x00],
    },
    {
      description: "Anon",
      value: {
        who: { type: "Anon", marker: 0xFF },
      },
      decoded_value: {
        who: { type: "Anon", kind: 0x02, marker: 0xFF },
      },
      bytes: [0x02, 0xFF],
    },
  ],
});
