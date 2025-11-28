// ABOUTME: Tests for computed_count array kind
// ABOUTME: Validates arrays whose length is computed from an expression

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test suite for simple computed count expressions
 */
export const computedCountSimpleTestSuite = defineTestSuite({
  name: "computed_count_simple",
  description: "Arrays with simple computed count expressions",

  schema: {
    config: { endianness: "little_endian" },
    types: {
      "RangeData": {
        sequence: [
          { name: "min", type: "uint8" },
          { name: "max", type: "uint8" },
          {
            name: "values",
            type: "array",
            kind: "computed_count",
            count_expr: "max - min + 1",
            items: { type: "uint8" }
          }
        ]
      }
    }
  },

  test_type: "RangeData",

  test_cases: [
    {
      description: "Range 0-2 has 3 elements",
      value: {
        min: 0,
        max: 2,
        values: [10, 20, 30]
      },
      bytes: [
        0x00,       // min
        0x02,       // max
        0x0A, 0x14, 0x1E  // values
      ],
    },
    {
      description: "Range 5-5 has 1 element",
      value: {
        min: 5,
        max: 5,
        values: [42]
      },
      bytes: [
        0x05,  // min
        0x05,  // max
        0x2A   // values
      ],
    },
    {
      description: "Range 0-255 has 256 elements",
      value: {
        min: 0,
        max: 255,
        values: Array.from({ length: 256 }, (_, i) => i)
      },
      bytes: [
        0x00,  // min
        0xFF,  // max
        ...Array.from({ length: 256 }, (_, i) => i)  // values 0-255
      ],
    },
  ]
});

/**
 * Test suite for multiplication in count expressions (PCF-style)
 */
export const computedCountMultiplicationTestSuite = defineTestSuite({
  name: "computed_count_multiplication",
  description: "Arrays with multiplication in count expressions (PCF BdfEncodings style)",

  schema: {
    config: { endianness: "little_endian" },
    types: {
      "EncodingTable": {
        sequence: [
          { name: "min_byte1", type: "uint8" },
          { name: "max_byte1", type: "uint8" },
          { name: "min_byte2", type: "uint8" },
          { name: "max_byte2", type: "uint8" },
          {
            name: "encodings",
            type: "array",
            kind: "computed_count",
            count_expr: "(max_byte2 - min_byte2 + 1) * (max_byte1 - min_byte1 + 1)",
            items: { type: "uint16", endianness: "little_endian" }
          }
        ]
      }
    }
  },

  test_type: "EncodingTable",

  test_cases: [
    {
      description: "Single byte range (1x4 = 4 elements)",
      value: {
        min_byte1: 0,
        max_byte1: 0,
        min_byte2: 0,
        max_byte2: 3,
        encodings: [0x0100, 0x0101, 0x0102, 0x0103]
      },
      bytes: [
        0x00,  // min_byte1
        0x00,  // max_byte1
        0x00,  // min_byte2
        0x03,  // max_byte2
        // 4 uint16 values (LE)
        0x00, 0x01,  // 0x0100
        0x01, 0x01,  // 0x0101
        0x02, 0x01,  // 0x0102
        0x03, 0x01,  // 0x0103
      ],
    },
    {
      description: "Two byte ranges (2x3 = 6 elements)",
      value: {
        min_byte1: 0,
        max_byte1: 1,
        min_byte2: 10,
        max_byte2: 12,
        encodings: [1, 2, 3, 4, 5, 6]
      },
      bytes: [
        0x00,  // min_byte1
        0x01,  // max_byte1
        0x0A,  // min_byte2
        0x0C,  // max_byte2
        // 6 uint16 values (LE)
        0x01, 0x00,
        0x02, 0x00,
        0x03, 0x00,
        0x04, 0x00,
        0x05, 0x00,
        0x06, 0x00,
      ],
    },
  ]
});

/**
 * Test suite for computed count with field multiplication
 */
export const computedCountFieldMultiplicationTestSuite = defineTestSuite({
  name: "computed_count_field_multiplication",
  description: "Arrays with simple field multiplication",

  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Grid": {
        sequence: [
          { name: "width", type: "uint8" },
          { name: "height", type: "uint8" },
          {
            name: "pixels",
            type: "array",
            kind: "computed_count",
            count_expr: "width * height",
            items: { type: "uint8" }
          }
        ]
      }
    }
  },

  test_type: "Grid",

  test_cases: [
    {
      description: "2x3 grid has 6 elements",
      value: {
        width: 2,
        height: 3,
        pixels: [1, 2, 3, 4, 5, 6]
      },
      bytes: [
        0x02,  // width
        0x03,  // height
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06  // pixels
      ],
    },
    {
      description: "4x4 grid has 16 elements",
      value: {
        width: 4,
        height: 4,
        pixels: Array.from({ length: 16 }, (_, i) => i)
      },
      bytes: [
        0x04,  // width
        0x04,  // height
        ...Array.from({ length: 16 }, (_, i) => i)  // pixels
      ],
    },
  ]
});
