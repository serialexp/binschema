// ABOUTME: first<Type>/last<Type> selectors over a HOMOGENEOUS array ([]DataChunk,
// ABOUTME: not a choice/discriminated_union). The DU-flavored peers live in
// ABOUTME: length-crc-first-last.test.ts; those deliberately use a `choice` array
// ABOUTME: "so item sub-fields are populated in the encode context". This file is
// ABOUTME: the missing counterpart: does length_of/crc32_of of a SELECTED element's
// ABOUTME: sub-field work when every element is the same struct type and carries no
// ABOUTME: `.type` discriminator? The TS reference matches homogeneous items via
// ABOUTME: `item.type === undefined`, so first<T> == element 0 and last<T> == the
// ABOUTME: final element. These suites let the selector codegen path be verified
// ABOUTME: end-to-end WITHOUT needing discriminated_union/choice (Phase 4).
//
// Each suite pairs the length_of/crc32_of selector with a sibling position_of to
// the same target — position tracking is only enabled when a position_of field
// scans the selector (detectFirstLastTracking in
// src/generators/typescript/computed-fields.ts), and the position_of doubles as a
// sanity check on which element we resolved.

import { defineTestSuite } from "../../schema/test-schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// length_of with first<Type> over a homogeneous []DataChunk. Every element is a
// DataChunk, so first<DataChunk> is element 0 (offset 0).
// ─────────────────────────────────────────────────────────────────────────────
export const lengthOfFirstSelectorHomogeneousTestSuite = defineTestSuite({
  name: "length_of_first_selector_homogeneous",
  description:
    "length_of `../chunks[first<DataChunk>].payload` over a homogeneous array — " +
    "no choice/DU. First element is index 0; writes its payload byte length.",
  schema: {
    config: { endianness: "little_endian" },
    types: {
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
            name: "first_chunk_offset",
            type: "uint16",
            computed: {
              type: "position_of",
              target: "../chunks[first<DataChunk>]",
            },
          },
          {
            name: "first_payload_len",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../chunks[first<DataChunk>].payload",
            },
          },
        ],
      },
      "Container": {
        sequence: [
          {
            name: "chunks",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "DataChunk" },
          },
          { name: "summary", type: "Summary" },
        ],
      },
    },
  },
  test_type: "Container",
  test_cases: [
    {
      description: "first chunk payload length over homogeneous array",
      value: {
        chunks: [
          { payload: [0xAA, 0xBB, 0xCC] },
          { payload: [0xDD, 0xEE, 0xFF, 0x11] },
          { payload: [0x99] },
        ],
        summary: {},
      },
      decoded_value: {
        chunks: [
          { type_tag: 0x02, payload_len: 3, payload: [0xAA, 0xBB, 0xCC] },
          { type_tag: 0x02, payload_len: 4, payload: [0xDD, 0xEE, 0xFF, 0x11] },
          { type_tag: 0x02, payload_len: 1, payload: [0x99] },
        ],
        summary: {
          first_chunk_offset: 0, // first DataChunk is element 0
          first_payload_len: 3,
        },
      },
      bytes: [
        // chunks[0] @ 0 — 5 bytes
        0x02, 0x03, 0xAA, 0xBB, 0xCC,
        // chunks[1] @ 5 — 6 bytes
        0x02, 0x04, 0xDD, 0xEE, 0xFF, 0x11,
        // chunks[2] @ 11 — 3 bytes
        0x02, 0x01, 0x99,
        // summary @ 14
        0x00, 0x00, // first_chunk_offset = 0 (LE u16)
        0x03, 0x00, // first_payload_len = 3 (LE u16)
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// crc32_of with last<Type> over a homogeneous []DataChunk. last<DataChunk> is the
// final element. Payload [0x44,0x55,0x66] reuses the known CRC32-IEEE vector
// 0xEBCF9172 (same value asserted in crc32_of_last_selector) so the expected
// bytes come from a standard oracle, not from the binschema implementation.
// ─────────────────────────────────────────────────────────────────────────────
export const crc32OfLastSelectorHomogeneousTestSuite = defineTestSuite({
  name: "crc32_of_last_selector_homogeneous",
  description:
    "crc32_of `../chunks[last<DataChunk>].payload` over a homogeneous array — " +
    "no choice/DU. CRC32-IEEE of the last element's payload bytes.",
  schema: {
    config: { endianness: "little_endian" },
    types: {
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
            name: "last_chunk_offset",
            type: "uint16",
            computed: {
              type: "position_of",
              target: "../chunks[last<DataChunk>]",
            },
          },
          {
            name: "last_payload_crc",
            type: "uint32",
            computed: {
              type: "crc32_of",
              target: "../chunks[last<DataChunk>].payload",
            },
          },
        ],
      },
      "Container": {
        sequence: [
          {
            name: "chunks",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "DataChunk" },
          },
          { name: "footer", type: "Footer" },
        ],
      },
    },
  },
  test_type: "Container",
  test_cases: [
    {
      description: "CRC32 of last chunk payload [0x44, 0x55, 0x66] over homogeneous array",
      value: {
        chunks: [
          { payload: [0x11, 0x22] },
          { payload: [0x33] },
          { payload: [0x44, 0x55, 0x66] },
        ],
        footer: {},
      },
      decoded_value: {
        chunks: [
          { type_tag: 0x02, payload_len: 2, payload: [0x11, 0x22] },
          { type_tag: 0x02, payload_len: 1, payload: [0x33] },
          { type_tag: 0x02, payload_len: 3, payload: [0x44, 0x55, 0x66] },
        ],
        footer: {
          last_chunk_offset: 7, // chunks[0]=4, chunks[1]=3 → chunks[2] @ 7
          // CRC32-IEEE of [0x44, 0x55, 0x66] = 0xEBCF9172
          last_payload_crc: 0xEBCF9172,
        },
      },
      bytes: [
        // chunks[0] @ 0 — 4 bytes (type_tag+len+2 payload)
        0x02, 0x02, 0x11, 0x22,
        // chunks[1] @ 4 — 3 bytes
        0x02, 0x01, 0x33,
        // chunks[2] @ 7 — 5 bytes
        0x02, 0x03, 0x44, 0x55, 0x66,
        // footer @ 12
        0x07, 0x00, // last_chunk_offset = 7 (LE u16)
        0x72, 0x91, 0xCF, 0xEB, // last_payload_crc = 0xEBCF9172 (LE u32)
      ],
    },
  ],
});
