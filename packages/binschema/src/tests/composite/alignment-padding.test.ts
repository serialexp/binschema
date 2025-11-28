// ABOUTME: Tests for alignment padding field type
// ABOUTME: Validates padding bytes are inserted to align to N-byte boundaries

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test suite for alignment padding
 *
 * Alignment padding inserts zero bytes to align the current position to
 * a specified byte boundary (2, 4, 8, etc.).
 *
 * Wire format: Variable number of zero bytes (0 to align_to-1)
 */

/**
 * Basic alignment padding - 4-byte alignment after 1-byte field
 */
export const alignmentPadding4ByteTestSuite = defineTestSuite({
  name: "alignment_padding_4byte",
  description: "4-byte alignment padding after variable-size prefix",

  schema: {
    types: {
      "AlignedData": {
        sequence: [
          { name: "prefix", type: "uint8" },
          { name: "padding", type: "padding", align_to: 4 },
          { name: "value", type: "uint32", endianness: "little_endian" }
        ]
      }
    }
  },

  test_type: "AlignedData",

  test_cases: [
    {
      description: "Position 1, needs 3 bytes padding to align to 4",
      value: { prefix: 0xAA, value: 0x12345678 },
      // prefix: 1 byte (0xAA), padding: 3 bytes (0x00 0x00 0x00), value: 4 bytes (LE)
      bytes: [0xAA, 0x00, 0x00, 0x00, 0x78, 0x56, 0x34, 0x12],
    },
  ]
});

/**
 * Alignment when already aligned - should insert 0 bytes
 */
export const alignmentPaddingAlreadyAlignedTestSuite = defineTestSuite({
  name: "alignment_padding_already_aligned",
  description: "Alignment padding when position is already aligned",

  schema: {
    types: {
      "AlreadyAligned": {
        sequence: [
          { name: "prefix", type: "uint32", endianness: "little_endian" },
          { name: "padding", type: "padding", align_to: 4 },
          { name: "value", type: "uint32", endianness: "little_endian" }
        ]
      }
    }
  },

  test_type: "AlreadyAligned",

  test_cases: [
    {
      description: "Position 4, already aligned - 0 bytes padding",
      value: { prefix: 0x11223344, value: 0xAABBCCDD },
      // prefix: 4 bytes, padding: 0 bytes, value: 4 bytes
      bytes: [0x44, 0x33, 0x22, 0x11, 0xDD, 0xCC, 0xBB, 0xAA],
    },
  ]
});

/**
 * Different alignment positions - test all modulo cases
 */
export const alignmentPaddingVariousPositionsTestSuite = defineTestSuite({
  name: "alignment_padding_various_positions",
  description: "Alignment padding from different starting positions",

  schema: {
    types: {
      "Position2": {
        sequence: [
          { name: "prefix", type: "uint16", endianness: "little_endian" },
          { name: "padding", type: "padding", align_to: 4 },
          { name: "value", type: "uint32", endianness: "little_endian" }
        ]
      },
      "Position3": {
        sequence: [
          { name: "prefix1", type: "uint16", endianness: "little_endian" },
          { name: "prefix2", type: "uint8" },
          { name: "padding", type: "padding", align_to: 4 },
          { name: "value", type: "uint32", endianness: "little_endian" }
        ]
      }
    }
  },

  test_type: "Position2",

  test_cases: [
    {
      description: "Position 2, needs 2 bytes padding to align to 4",
      value: { prefix: 0x1122, value: 0xAABBCCDD },
      // prefix: 2 bytes, padding: 2 bytes, value: 4 bytes
      bytes: [0x22, 0x11, 0x00, 0x00, 0xDD, 0xCC, 0xBB, 0xAA],
    },
  ]
});

export const alignmentPaddingPosition3TestSuite = defineTestSuite({
  name: "alignment_padding_position_3",
  description: "Alignment padding from position 3",

  schema: {
    types: {
      "Position3": {
        sequence: [
          { name: "prefix1", type: "uint16", endianness: "little_endian" },
          { name: "prefix2", type: "uint8" },
          { name: "padding", type: "padding", align_to: 4 },
          { name: "value", type: "uint32", endianness: "little_endian" }
        ]
      }
    }
  },

  test_type: "Position3",

  test_cases: [
    {
      description: "Position 3, needs 1 byte padding to align to 4",
      value: { prefix1: 0x1122, prefix2: 0x33, value: 0xAABBCCDD },
      // prefix1: 2 bytes, prefix2: 1 byte, padding: 1 byte, value: 4 bytes
      bytes: [0x22, 0x11, 0x33, 0x00, 0xDD, 0xCC, 0xBB, 0xAA],
    },
  ]
});

/**
 * 8-byte alignment
 */
export const alignmentPadding8ByteTestSuite = defineTestSuite({
  name: "alignment_padding_8byte",
  description: "8-byte alignment padding",

  schema: {
    types: {
      "Aligned8": {
        sequence: [
          { name: "prefix", type: "uint8" },
          { name: "padding", type: "padding", align_to: 8 },
          { name: "value", type: "uint64", endianness: "little_endian" }
        ]
      }
    }
  },

  test_type: "Aligned8",

  test_cases: [
    {
      description: "Position 1, needs 7 bytes padding to align to 8",
      value: { prefix: 0xAA, value: 0x0102030405060708n },
      // prefix: 1 byte, padding: 7 bytes, value: 8 bytes
      bytes: [0xAA, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01],
    },
  ]
});

/**
 * 2-byte alignment
 */
export const alignmentPadding2ByteTestSuite = defineTestSuite({
  name: "alignment_padding_2byte",
  description: "2-byte alignment padding",

  schema: {
    types: {
      "Aligned2": {
        sequence: [
          { name: "prefix", type: "uint8" },
          { name: "padding", type: "padding", align_to: 2 },
          { name: "value", type: "uint16", endianness: "little_endian" }
        ]
      }
    }
  },

  test_type: "Aligned2",

  test_cases: [
    {
      description: "Position 1, needs 1 byte padding to align to 2",
      value: { prefix: 0xAA, value: 0x1234 },
      // prefix: 1 byte, padding: 1 byte, value: 2 bytes
      bytes: [0xAA, 0x00, 0x34, 0x12],
    },
  ]
});

/**
 * PCF-style: alignment after variable-length array
 * This tests the PCF properties table pattern where alignment comes after
 * an array of fixed-size items.
 */
export const alignmentPaddingAfterArrayTestSuite = defineTestSuite({
  name: "alignment_padding_after_array",
  description: "PCF-style alignment padding after array of structs",

  schema: {
    types: {
      "Property": {
        sequence: [
          { name: "name_offset", type: "uint32", endianness: "little_endian" },
          { name: "is_string", type: "uint8" },
          { name: "value", type: "uint32", endianness: "little_endian" }
        ]
      },
      "PropertiesTable": {
        sequence: [
          { name: "format", type: "uint32", endianness: "little_endian" },
          { name: "num_props", type: "uint32", endianness: "little_endian" },
          {
            name: "props",
            type: "array",
            kind: "field_referenced",
            length_field: "num_props",
            items: { type: "Property" }
          },
          { name: "padding", type: "padding", align_to: 4 },
          { name: "len_strings", type: "uint32", endianness: "little_endian" }
        ]
      }
    }
  },

  test_type: "PropertiesTable",

  test_cases: [
    {
      description: "1 property (9 bytes) + 8 byte header = 17 bytes, needs 3 bytes padding",
      value: {
        format: 0x00000001,
        num_props: 1,
        props: [{ name_offset: 0, is_string: 1, value: 10 }],
        len_strings: 100
      },
      // format: 4 bytes, num_props: 4 bytes, 1 prop: 9 bytes, padding: 3 bytes, len_strings: 4 bytes
      // Total: 4 + 4 + 9 + 3 + 4 = 24 bytes
      bytes: [
        // format (LE)
        0x01, 0x00, 0x00, 0x00,
        // num_props (LE)
        0x01, 0x00, 0x00, 0x00,
        // prop[0]: name_offset (LE)
        0x00, 0x00, 0x00, 0x00,
        // prop[0]: is_string
        0x01,
        // prop[0]: value (LE)
        0x0A, 0x00, 0x00, 0x00,
        // padding: 3 bytes (position was 17, needs to align to 20)
        0x00, 0x00, 0x00,
        // len_strings (LE)
        0x64, 0x00, 0x00, 0x00
      ],
    },
    {
      description: "4 properties (36 bytes) + 8 byte header = 44 bytes, already aligned",
      value: {
        format: 0x00000001,
        num_props: 4,
        props: [
          { name_offset: 0, is_string: 1, value: 10 },
          { name_offset: 5, is_string: 0, value: 20 },
          { name_offset: 10, is_string: 1, value: 30 },
          { name_offset: 15, is_string: 0, value: 40 }
        ],
        len_strings: 200
      },
      // format: 4, num_props: 4, 4 props: 36, padding: 0, len_strings: 4
      // 8 + 36 = 44, 44 % 4 = 0, so no padding needed
      bytes: [
        // format
        0x01, 0x00, 0x00, 0x00,
        // num_props
        0x04, 0x00, 0x00, 0x00,
        // prop[0]
        0x00, 0x00, 0x00, 0x00, 0x01, 0x0A, 0x00, 0x00, 0x00,
        // prop[1]
        0x05, 0x00, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00,
        // prop[2]
        0x0A, 0x00, 0x00, 0x00, 0x01, 0x1E, 0x00, 0x00, 0x00,
        // prop[3]
        0x0F, 0x00, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00,
        // NO padding (44 is divisible by 4)
        // len_strings
        0xC8, 0x00, 0x00, 0x00
      ],
    },
    {
      description: "2 properties (18 bytes) + 8 byte header = 26 bytes, needs 2 bytes padding",
      value: {
        format: 0x00000001,
        num_props: 2,
        props: [
          { name_offset: 0, is_string: 1, value: 10 },
          { name_offset: 5, is_string: 0, value: 20 }
        ],
        len_strings: 50
      },
      // 8 + 18 = 26, 26 % 4 = 2, need 2 bytes padding
      bytes: [
        // format
        0x01, 0x00, 0x00, 0x00,
        // num_props
        0x02, 0x00, 0x00, 0x00,
        // prop[0]
        0x00, 0x00, 0x00, 0x00, 0x01, 0x0A, 0x00, 0x00, 0x00,
        // prop[1]
        0x05, 0x00, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00,
        // padding: 2 bytes
        0x00, 0x00,
        // len_strings
        0x32, 0x00, 0x00, 0x00
      ],
    },
    {
      description: "3 properties (27 bytes) + 8 byte header = 35 bytes, needs 1 byte padding",
      value: {
        format: 0x00000001,
        num_props: 3,
        props: [
          { name_offset: 0, is_string: 1, value: 10 },
          { name_offset: 5, is_string: 0, value: 20 },
          { name_offset: 10, is_string: 1, value: 30 }
        ],
        len_strings: 75
      },
      // 8 + 27 = 35, 35 % 4 = 3, need 1 byte padding
      bytes: [
        // format
        0x01, 0x00, 0x00, 0x00,
        // num_props
        0x03, 0x00, 0x00, 0x00,
        // prop[0]
        0x00, 0x00, 0x00, 0x00, 0x01, 0x0A, 0x00, 0x00, 0x00,
        // prop[1]
        0x05, 0x00, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00,
        // prop[2]
        0x0A, 0x00, 0x00, 0x00, 0x01, 0x1E, 0x00, 0x00, 0x00,
        // padding: 1 byte
        0x00,
        // len_strings
        0x4B, 0x00, 0x00, 0x00
      ],
    },
  ]
});
