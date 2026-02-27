// ABOUTME: Tests for discriminated_union with string-based dispatch
// ABOUTME: Verifies that 'when' conditions can compare against string literals

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * String-based discriminated union with field-based discriminator.
 * Dispatches on a 4-byte ASCII chunk ID (like RIFF/VOX formats).
 */
export const stringDiscriminatedUnionTestSuite = defineTestSuite({
  name: "string_discriminated_union",
  description: "Discriminated union dispatching on string field values",

  schema: {
    config: {
      endianness: "little_endian",
    },
    types: {
      "SizePayload": {
        sequence: [
          { name: "x", type: "uint32", endianness: "little_endian" },
          { name: "y", type: "uint32", endianness: "little_endian" },
          { name: "z", type: "uint32", endianness: "little_endian" },
        ],
      },
      "RGBAPayload": {
        sequence: [
          { name: "r", type: "uint8" },
          { name: "g", type: "uint8" },
          { name: "b", type: "uint8" },
          { name: "a", type: "uint8" },
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
            name: "payload",
            type: "discriminated_union",
            discriminator: { field: "chunk_id" },
            variants: [
              { when: "value == 'SIZE'", type: "SizePayload" },
              { when: "value == 'RGBA'", type: "RGBAPayload" },
            ],
          },
        ],
      },
    },
  },

  test_type: "Chunk",

  test_cases: [
    {
      description: "SIZE chunk with dimensions",
      value: {
        chunk_id: "SIZE",
        payload: {
          type: "SizePayload",
          value: { x: 10, y: 20, z: 30 },
        },
      },
      bytes: [
        0x53, 0x49, 0x5a, 0x45, // "SIZE"
        0x0a, 0x00, 0x00, 0x00, // x = 10 (LE)
        0x14, 0x00, 0x00, 0x00, // y = 20 (LE)
        0x1e, 0x00, 0x00, 0x00, // z = 30 (LE)
      ],
    },
    {
      description: "RGBA chunk with color",
      value: {
        chunk_id: "RGBA",
        payload: {
          type: "RGBAPayload",
          value: { r: 255, g: 128, b: 0, a: 255 },
        },
      },
      bytes: [
        0x52, 0x47, 0x42, 0x41, // "RGBA"
        0xff, 0x80, 0x00, 0xff, // r=255, g=128, b=0, a=255
      ],
    },
  ],
});
