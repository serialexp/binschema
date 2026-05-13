// ABOUTME: Tests for length_of / crc32_of computed fields that use first<Type>
// ABOUTME: and last<Type> selectors to look up an item in a parent array. These
// ABOUTME: scenarios were stubbed out in the Rust generator (emitted 0_usize /
// ABOUTME: 0_u32) and had no test coverage anywhere — see CLAUDE.md
// ABOUTME: "Tests-first for codegen features".
//
// Each suite includes a sibling `position_of` field referencing the same
// `first<X>` / `last<X>` target so position tracking is automatically enabled
// (see detectFirstLastTracking in src/generators/typescript/computed-fields.ts —
// it only scans position_of fields). The position_of field also serves as a
// sanity check that we're targeting the same item.

import { defineTestSuite } from "../../schema/test-schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// length_of with first<Type>: byte length of a sub-field on the FIRST item of
// a given type within a sibling array.
// ─────────────────────────────────────────────────────────────────────────────
export const lengthOfFirstSelectorTestSuite = defineTestSuite({
  name: "length_of_first_selector",
  description:
    "length_of with `first<DataChunk>.payload` selector — looks up the first " +
    "DataChunk in `items`, takes its `payload` array, writes its byte length.",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "MetaChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "marker", type: "uint8" },
        ],
      },
      "DataChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "payload_len",
            type: "uint8",
            computed: { type: "length_of", target: "payload" },
          },
          {
            name: "payload",
            type: "array",
            kind: "field_referenced",
            length_field: "payload_len",
            items: { type: "uint8" },
          },
        ],
      },
      "Summary": {
        sequence: [
          {
            name: "first_data_offset",
            type: "uint16",
            computed: {
              type: "position_of",
              target: "../items[first<DataChunk>]",
            },
          },
          {
            name: "first_data_payload_len",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../items[first<DataChunk>].payload",
            },
          },
        ],
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 3,
            items: {
              type: "choice",
              choices: [
                { type: "MetaChunk" },
                { type: "DataChunk" },
              ],
            },
          },
          { name: "summary", type: "Summary" },
        ],
      },
    },
  },
  test_type: "Container",
  test_cases: [
    {
      description: "first DataChunk found among meta+data items",
      value: {
        items: [
          { type: "MetaChunk", marker: 0x55 },
          { type: "DataChunk", payload: [0xAA, 0xBB, 0xCC] },
          { type: "DataChunk", payload: [0xDD, 0xEE, 0xFF, 0x11] },
        ],
        summary: {},
      },
      decoded_value: {
        items: [
          { type: "MetaChunk", type_tag: 0x01, marker: 0x55 },
          { type: "DataChunk", type_tag: 0x02, payload_len: 3, payload: [0xAA, 0xBB, 0xCC] },
          { type: "DataChunk", type_tag: 0x02, payload_len: 4, payload: [0xDD, 0xEE, 0xFF, 0x11] },
        ],
        summary: {
          first_data_offset: 2,
          first_data_payload_len: 3,
        },
      },
      bytes: [
        // items[0]: MetaChunk @ 0
        0x01, 0x55,
        // items[1]: DataChunk @ 2 (this is "first DataChunk")
        0x02, 0x03, 0xAA, 0xBB, 0xCC,
        // items[2]: DataChunk @ 7
        0x02, 0x04, 0xDD, 0xEE, 0xFF, 0x11,
        // summary @ 13
        0x02, 0x00, // first_data_offset = 2 (LE u16)
        0x03, 0x00, // first_data_payload_len = 3 (LE u16)
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// length_of with last<Type>: byte length of a sub-field on the LAST item of a
// given type within a sibling array.
// ─────────────────────────────────────────────────────────────────────────────
export const lengthOfLastSelectorTestSuite = defineTestSuite({
  name: "length_of_last_selector",
  description:
    "length_of with `last<DataChunk>.payload` selector — looks up the last " +
    "DataChunk in `items`, takes its `payload` array, writes its byte length. " +
    "Uses a choice array so item sub-fields are populated in the encode " +
    "context (Rust's homogeneous-array storage only carries _encoded_size).",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "MetaChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "marker", type: "uint8" },
        ],
      },
      "DataChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "payload_len",
            type: "uint8",
            computed: { type: "length_of", target: "payload" },
          },
          {
            name: "payload",
            type: "array",
            kind: "field_referenced",
            length_field: "payload_len",
            items: { type: "uint8" },
          },
        ],
      },
      "Footer": {
        sequence: [
          {
            name: "last_data_offset",
            type: "uint16",
            computed: {
              type: "position_of",
              target: "../items[last<DataChunk>]",
            },
          },
          {
            name: "last_data_payload_len",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../items[last<DataChunk>].payload",
            },
          },
        ],
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 3,
            items: {
              type: "choice",
              choices: [
                { type: "MetaChunk" },
                { type: "DataChunk" },
              ],
            },
          },
          { name: "footer", type: "Footer" },
        ],
      },
    },
  },
  test_type: "Container",
  test_cases: [
    {
      description: "last DataChunk's payload length",
      value: {
        items: [
          { type: "DataChunk", payload: [0x11] },
          { type: "MetaChunk", marker: 0x77 },
          { type: "DataChunk", payload: [0x44, 0x55, 0x66, 0x77, 0x88] },
        ],
        footer: {},
      },
      decoded_value: {
        items: [
          { type: "DataChunk", type_tag: 0x02, payload_len: 1, payload: [0x11] },
          { type: "MetaChunk", type_tag: 0x01, marker: 0x77 },
          { type: "DataChunk", type_tag: 0x02, payload_len: 5, payload: [0x44, 0x55, 0x66, 0x77, 0x88] },
        ],
        footer: {
          // items[0] = 3 bytes (type_tag+len+1), items[1] = 2 bytes (type_tag+marker), items[2] @ 5
          last_data_offset: 5,
          last_data_payload_len: 5,
        },
      },
      bytes: [
        // items[0]: DataChunk @ 0 — 3 bytes
        0x02, 0x01, 0x11,
        // items[1]: MetaChunk @ 3 — 2 bytes
        0x01, 0x77,
        // items[2]: DataChunk @ 5 — 7 bytes (type_tag+len+5)
        0x02, 0x05, 0x44, 0x55, 0x66, 0x77, 0x88,
        // footer @ 12
        0x05, 0x00, // last_data_offset = 5 (LE u16)
        0x05, 0x00, // last_data_payload_len = 5 (LE u16)
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// crc32_of with first<Type>: CRC32 of a sub-field on the FIRST item of a given
// type within a sibling array.
// ─────────────────────────────────────────────────────────────────────────────
//
// The bytes for the CRC32 expected values were computed by encoding the test
// payload through the TS reference and reading back the produced uint32 — the
// TS implementation is the spec.
export const crc32OfFirstSelectorTestSuite = defineTestSuite({
  name: "crc32_of_first_selector",
  description:
    "crc32_of with `first<DataChunk>.payload` selector — CRC32 of the first " +
    "DataChunk's payload bytes.",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "MetaChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "marker", type: "uint8" },
        ],
      },
      "DataChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "payload_len",
            type: "uint8",
            computed: { type: "length_of", target: "payload" },
          },
          {
            name: "payload",
            type: "array",
            kind: "field_referenced",
            length_field: "payload_len",
            items: { type: "uint8" },
          },
        ],
      },
      "Summary": {
        sequence: [
          {
            name: "first_data_offset",
            type: "uint16",
            computed: {
              type: "position_of",
              target: "../items[first<DataChunk>]",
            },
          },
          {
            name: "first_data_crc",
            type: "uint32",
            computed: {
              type: "crc32_of",
              target: "../items[first<DataChunk>].payload",
            },
          },
        ],
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 3,
            items: {
              type: "choice",
              choices: [
                { type: "MetaChunk" },
                { type: "DataChunk" },
              ],
            },
          },
          { name: "summary", type: "Summary" },
        ],
      },
    },
  },
  test_type: "Container",
  test_cases: [
    {
      description: "CRC32 of [0xAA, 0xBB, 0xCC]",
      value: {
        items: [
          { type: "MetaChunk", marker: 0x55 },
          { type: "DataChunk", payload: [0xAA, 0xBB, 0xCC] },
          { type: "DataChunk", payload: [0xDD, 0xEE] },
        ],
        summary: {},
      },
      decoded_value: {
        items: [
          { type: "MetaChunk", type_tag: 0x01, marker: 0x55 },
          { type: "DataChunk", type_tag: 0x02, payload_len: 3, payload: [0xAA, 0xBB, 0xCC] },
          { type: "DataChunk", type_tag: 0x02, payload_len: 2, payload: [0xDD, 0xEE] },
        ],
        summary: {
          first_data_offset: 2,
          // CRC32-IEEE of bytes [0xAA, 0xBB, 0xCC] = 0xBE4DF84C
          first_data_crc: 0xBE4DF84C,
        },
      },
      bytes: [
        // items[0]: MetaChunk @ 0
        0x01, 0x55,
        // items[1]: DataChunk @ 2
        0x02, 0x03, 0xAA, 0xBB, 0xCC,
        // items[2]: DataChunk @ 7
        0x02, 0x02, 0xDD, 0xEE,
        // summary @ 11
        0x02, 0x00, // first_data_offset (LE u16)
        0x4C, 0xF8, 0x4D, 0xBE, // first_data_crc = 0xBE4DF84C (LE u32)
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// crc32_of with last<Type>: CRC32 of a sub-field on the LAST item of a given
// type within a sibling array.
// ─────────────────────────────────────────────────────────────────────────────
export const crc32OfLastSelectorTestSuite = defineTestSuite({
  name: "crc32_of_last_selector",
  description:
    "crc32_of with `last<DataChunk>.payload` selector — CRC32 of the last " +
    "DataChunk's payload bytes. Uses a choice array so item sub-fields land " +
    "in the encode context.",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "MetaChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "marker", type: "uint8" },
        ],
      },
      "DataChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "payload_len",
            type: "uint8",
            computed: { type: "length_of", target: "payload" },
          },
          {
            name: "payload",
            type: "array",
            kind: "field_referenced",
            length_field: "payload_len",
            items: { type: "uint8" },
          },
        ],
      },
      "Footer": {
        sequence: [
          {
            name: "last_data_offset",
            type: "uint16",
            computed: {
              type: "position_of",
              target: "../items[last<DataChunk>]",
            },
          },
          {
            name: "last_data_crc",
            type: "uint32",
            computed: {
              type: "crc32_of",
              target: "../items[last<DataChunk>].payload",
            },
          },
        ],
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 3,
            items: {
              type: "choice",
              choices: [
                { type: "MetaChunk" },
                { type: "DataChunk" },
              ],
            },
          },
          { name: "footer", type: "Footer" },
        ],
      },
    },
  },
  test_type: "Container",
  test_cases: [
    {
      description: "CRC32 of last DataChunk payload [0x44, 0x55, 0x66]",
      value: {
        items: [
          { type: "DataChunk", payload: [0x11, 0x22] },
          { type: "MetaChunk", marker: 0xAB },
          { type: "DataChunk", payload: [0x44, 0x55, 0x66] },
        ],
        footer: {},
      },
      decoded_value: {
        items: [
          { type: "DataChunk", type_tag: 0x02, payload_len: 2, payload: [0x11, 0x22] },
          { type: "MetaChunk", type_tag: 0x01, marker: 0xAB },
          { type: "DataChunk", type_tag: 0x02, payload_len: 3, payload: [0x44, 0x55, 0x66] },
        ],
        footer: {
          last_data_offset: 6, // items[0]=4, items[1]=2 → items[2] @ 6
          // CRC32-IEEE of [0x44, 0x55, 0x66] = 0xEBCF9172
          last_data_crc: 0xEBCF9172,
        },
      },
      bytes: [
        // items[0]: DataChunk @ 0 — 4 bytes (type_tag+len+2 payload)
        0x02, 0x02, 0x11, 0x22,
        // items[1]: MetaChunk @ 4 — 2 bytes
        0x01, 0xAB,
        // items[2]: DataChunk @ 6 — 5 bytes
        0x02, 0x03, 0x44, 0x55, 0x66,
        // footer @ 11
        0x06, 0x00, // last_data_offset = 6 (LE u16)
        0x72, 0x91, 0xCF, 0xEB, // last_data_crc = 0xEBCF9172 (LE u32)
      ],
    },
  ],
});
