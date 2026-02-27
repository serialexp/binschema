// ABOUTME: Tests for byte_budget on discriminated_union
// ABOUTME: Verifies RIFF-style chunk pattern: string dispatch + byte_budget + fallback

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * RIFF-style chunk pattern with byte_budget.
 *
 * Each chunk has:
 *   - 4-byte ASCII chunk ID
 *   - uint32 content size (byte budget)
 *   - content (dispatched by chunk ID, limited to content_size bytes)
 *
 * Known chunks decode their typed payload.
 * Unknown chunks fall back to raw bytes (eof_terminated within the byte budget slice).
 */
export const byteBudgetChunkTestSuite = defineTestSuite({
  name: "byte_budget_chunk",
  description: "RIFF-style chunk with byte_budget on discriminated_union",

  schema: {
    config: {
      endianness: "little_endian",
    },
    types: {
      "SizeData": {
        sequence: [
          { name: "x", type: "uint32", endianness: "little_endian" },
          { name: "y", type: "uint32", endianness: "little_endian" },
          { name: "z", type: "uint32", endianness: "little_endian" },
        ],
      },
      "RawBytes": {
        sequence: [
          {
            name: "data",
            type: "array",
            kind: "eof_terminated",
            items: { type: "uint8" },
          },
        ],
      },
      "Chunk": {
        sequence: [
          {
            name: "chunk_id",
            type: "string",
            kind: "fixed",
            length: 4,
            encoding: "ascii",
          },
          {
            name: "content_size",
            type: "uint32",
            endianness: "little_endian",
            computed: { type: "length_of", target: "content" },
          },
          {
            name: "content",
            type: "discriminated_union",
            discriminator: { field: "chunk_id" },
            byte_budget: { field: "content_size" },
            variants: [
              { when: "value == 'SIZE'", type: "SizeData" },
              { type: "RawBytes" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Chunk",

  test_cases: [
    {
      description: "Known SIZE chunk with 12-byte payload",
      value: {
        chunk_id: "SIZE",
        content: {
          type: "SizeData",
          value: { x: 10, y: 20, z: 30 },
        },
      },
      decoded_value: {
        chunk_id: "SIZE",
        content_size: 12,
        content: {
          type: "SizeData",
          value: { x: 10, y: 20, z: 30 },
        },
      },
      bytes: [
        0x53, 0x49, 0x5a, 0x45, // "SIZE"
        0x0c, 0x00, 0x00, 0x00, // content_size = 12 (LE)
        0x0a, 0x00, 0x00, 0x00, // x = 10 (LE)
        0x14, 0x00, 0x00, 0x00, // y = 20 (LE)
        0x1e, 0x00, 0x00, 0x00, // z = 30 (LE)
      ],
    },
    {
      description: "Unknown chunk falls back to raw bytes",
      value: {
        chunk_id: "XYZI",
        content: {
          type: "RawBytes",
          value: { data: [0xAA, 0xBB, 0xCC] },
        },
      },
      decoded_value: {
        chunk_id: "XYZI",
        content_size: 3,
        content: {
          type: "RawBytes",
          value: { data: [0xAA, 0xBB, 0xCC] },
        },
      },
      bytes: [
        0x58, 0x59, 0x5a, 0x49, // "XYZI"
        0x03, 0x00, 0x00, 0x00, // content_size = 3 (LE)
        0xAA, 0xBB, 0xCC,       // raw bytes
      ],
    },
  ],
});

/**
 * Validation: byte_budget.field references non-existent field
 */
export const byteBudgetBadFieldTestSuite = defineTestSuite({
  name: "error_byte_budget_bad_field",
  description: "byte_budget.field references non-existent field",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "TypeA": {
        sequence: [{ name: "a", type: "uint8" }],
      },
      "BadChunk": {
        sequence: [
          { name: "tag", type: "uint8" },
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "tag" },
            byte_budget: { field: "nonexistent" },
            variants: [
              { when: "value == 1", type: "TypeA" },
            ],
          },
        ],
      },
    },
  },

  test_type: "BadChunk",
  schema_validation_error: true,
  error_message: "not found",
});

/**
 * Validation: byte_budget.field references a string field (must be numeric)
 */
export const byteBudgetNonNumericTestSuite = defineTestSuite({
  name: "error_byte_budget_non_numeric",
  description: "byte_budget.field references non-numeric field",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "TypeA": {
        sequence: [{ name: "a", type: "uint8" }],
      },
      "BadChunk": {
        sequence: [
          {
            name: "tag",
            type: "string",
            kind: "fixed",
            length: 4,
            encoding: "ascii",
          },
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "tag" },
            byte_budget: { field: "tag" },
            variants: [
              { when: "value == 'TEST'", type: "TypeA" },
            ],
          },
        ],
      },
    },
  },

  test_type: "BadChunk",
  schema_validation_error: true,
  error_message: "must be a numeric type",
});
