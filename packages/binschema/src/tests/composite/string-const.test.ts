// ABOUTME: Tests for string const on fixed-length strings
// ABOUTME: Verifies const string fields are excluded from encoder input but present in decoded output

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * String const on fixed-length ASCII string (4 bytes)
 * The const value is written during encoding; decoded output includes the field.
 */
export const stringConstFixedAsciiTestSuite = defineTestSuite({
  name: "string_const_fixed_ascii",
  description: "Fixed-length ASCII string with const value",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "TaggedValue": {
        sequence: [
          {
            name: "tag",
            type: "string",
            kind: "fixed",
            length: 4,
            encoding: "ascii",
            const: "SIZE",
          },
          { name: "value", type: "uint32", endianness: "big_endian" },
        ],
      },
    },
  },

  test_type: "TaggedValue",

  test_cases: [
    {
      description: "Const string 'SIZE' with value 42",
      value: { value: 42 },
      decoded_value: { tag: "SIZE", value: 42 },
      bytes: [
        0x53, 0x49, 0x5a, 0x45, // "SIZE" in ASCII
        0x00, 0x00, 0x00, 0x2a, // 42 in big-endian uint32
      ],
    },
    {
      description: "Const string 'SIZE' with value 0",
      value: { value: 0 },
      decoded_value: { tag: "SIZE", value: 0 },
      bytes: [
        0x53, 0x49, 0x5a, 0x45, // "SIZE"
        0x00, 0x00, 0x00, 0x00, // 0
      ],
    },
  ],
});

/**
 * String const shorter than fixed length (padded with zeros)
 */
export const stringConstPaddedTestSuite = defineTestSuite({
  name: "string_const_padded",
  description: "Fixed-length string const shorter than field length (zero-padded)",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "ShortTag": {
        sequence: [
          {
            name: "tag",
            type: "string",
            kind: "fixed",
            length: 4,
            encoding: "ascii",
            const: "AB",
          },
          { name: "data", type: "uint8" },
        ],
      },
    },
  },

  test_type: "ShortTag",

  test_cases: [
    {
      description: "Short const padded to fixed length",
      value: { data: 0x42 },
      decoded_value: { tag: "AB", data: 0x42 },
      bytes: [
        0x41, 0x42, 0x00, 0x00, // "AB" + 2 zero-padding bytes
        0x42, // data
      ],
    },
  ],
});

/**
 * Validation: string const too long for fixed length
 */
export const stringConstTooLongTestSuite = defineTestSuite({
  name: "error_string_const_too_long",
  description: "String const exceeds fixed length - should fail validation",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "BadTag": {
        sequence: [
          {
            name: "tag",
            type: "string",
            kind: "fixed",
            length: 2,
            encoding: "ascii",
            const: "TOOLONG",
          },
        ],
      },
    },
  },

  test_type: "BadTag",
  schema_validation_error: true,
  error_message: "exceeds fixed length",
});
