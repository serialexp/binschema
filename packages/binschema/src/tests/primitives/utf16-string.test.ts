/**
 * Tests for UTF-16 string encoding
 *
 * Wire format: 2 bytes per code unit, endianness from field or global config.
 * Characters outside BMP use surrogate pairs (4 bytes).
 * Null termination uses two zero bytes (0x00, 0x00).
 */

import { defineTestSuite } from "../../schema/test-schema.js";

export const utf16FixedBigEndianTestSuite = defineTestSuite({
  name: "utf16_fixed_big_endian",
  description: "Fixed-length UTF-16 strings with big-endian byte order",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Utf16FixedBE": {
        sequence: [
          { name: "text", type: "string", kind: "fixed", length: 8, encoding: "utf16" }
        ]
      }
    }
  },
  test_type: "Utf16FixedBE",
  test_cases: [
    {
      description: "ASCII text 'AB' padded to 8 bytes",
      value: { text: "AB" },
      // A=0x0041, B=0x0042, then padding with 0x0000
      bytes: [0x00, 0x41, 0x00, 0x42, 0x00, 0x00, 0x00, 0x00],
    },
    {
      description: "Full 4-char string (8 bytes)",
      value: { text: "ABCD" },
      bytes: [0x00, 0x41, 0x00, 0x42, 0x00, 0x43, 0x00, 0x44],
    },
  ]
});

export const utf16FixedLittleEndianTestSuite = defineTestSuite({
  name: "utf16_fixed_little_endian",
  description: "Fixed-length UTF-16 strings with little-endian byte order",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Utf16FixedLE": {
        sequence: [
          { name: "text", type: "string", kind: "fixed", length: 8, encoding: "utf16" }
        ]
      }
    }
  },
  test_type: "Utf16FixedLE",
  test_cases: [
    {
      description: "ASCII text 'AB' padded to 8 bytes (LE)",
      value: { text: "AB" },
      // A=0x4100, B=0x4200 in LE, then padding
      bytes: [0x41, 0x00, 0x42, 0x00, 0x00, 0x00, 0x00, 0x00],
    },
    {
      description: "Full 4-char string (8 bytes, LE)",
      value: { text: "ABCD" },
      bytes: [0x41, 0x00, 0x42, 0x00, 0x43, 0x00, 0x44, 0x00],
    },
  ]
});

export const utf16LengthPrefixedTestSuite = defineTestSuite({
  name: "utf16_length_prefixed",
  description: "Length-prefixed UTF-16 strings (length = byte count)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Utf16LengthPrefixed": {
        sequence: [
          { name: "text", type: "string", kind: "length_prefixed", length_type: "uint8", encoding: "utf16" }
        ]
      }
    }
  },
  test_type: "Utf16LengthPrefixed",
  test_cases: [
    {
      description: "Empty string",
      value: { text: "" },
      bytes: [0x00],
    },
    {
      description: "Single character 'A' (2 bytes)",
      value: { text: "A" },
      bytes: [0x02, 0x00, 0x41],
    },
    {
      description: "Two characters 'Hi' (4 bytes)",
      value: { text: "Hi" },
      bytes: [0x04, 0x00, 0x48, 0x00, 0x69],
    },
  ]
});

export const utf16FieldEndiannessOverrideTestSuite = defineTestSuite({
  name: "utf16_field_endianness_override",
  description: "UTF-16 string with field-level endianness override",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Utf16EndiannessOverride": {
        sequence: [
          { name: "le_text", type: "string", kind: "fixed", length: 4, encoding: "utf16", endianness: "little_endian" },
          { name: "be_text", type: "string", kind: "fixed", length: 4, encoding: "utf16" },
        ]
      }
    }
  },
  test_type: "Utf16EndiannessOverride",
  test_cases: [
    {
      description: "LE field then BE field",
      value: { le_text: "AB", be_text: "AB" },
      // LE: A=0x41,0x00 B=0x42,0x00  BE: A=0x00,0x41 B=0x00,0x42
      bytes: [0x41, 0x00, 0x42, 0x00, 0x00, 0x41, 0x00, 0x42],
    },
  ]
});

export const utf16ExtendedCharsTestSuite = defineTestSuite({
  name: "utf16_extended_chars",
  description: "UTF-16 with characters outside ASCII range",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Utf16Extended": {
        sequence: [
          { name: "text", type: "string", kind: "length_prefixed", length_type: "uint8", encoding: "utf16" }
        ]
      }
    }
  },
  test_type: "Utf16Extended",
  test_cases: [
    {
      description: "Euro sign (U+20AC)",
      value: { text: "\u20AC" },
      // U+20AC = 0x20AC in UTF-16 BE
      bytes: [0x02, 0x20, 0xAC],
    },
    {
      description: "Japanese yen sign (U+00A5)",
      value: { text: "\u00A5" },
      bytes: [0x02, 0x00, 0xA5],
    },
  ]
});

export const utf16NullTerminatedTestSuite = defineTestSuite({
  name: "utf16_null_terminated",
  description: "Null-terminated UTF-16 strings (two zero bytes as terminator)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Utf16NullTerminated": {
        sequence: [
          { name: "text", type: "string", kind: "null_terminated", encoding: "utf16" },
          { name: "marker", type: "uint8" },
        ]
      }
    }
  },
  test_type: "Utf16NullTerminated",
  test_cases: [
    {
      description: "Empty string (just null terminator)",
      value: { text: "", marker: 0xFF },
      bytes: [0x00, 0x00, 0xFF],
    },
    {
      description: "Single character then null",
      value: { text: "A", marker: 0x42 },
      bytes: [0x00, 0x41, 0x00, 0x00, 0x42],
    },
    {
      description: "Short string then null",
      value: { text: "Hi", marker: 0x01 },
      bytes: [0x00, 0x48, 0x00, 0x69, 0x00, 0x00, 0x01],
    },
  ]
});
