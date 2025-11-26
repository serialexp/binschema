/**
 * Tests for Latin-1 (ISO-8859-1) string encoding
 *
 * Latin-1 is a 1:1 byte mapping where byte N = Unicode U+00NN
 * - Bytes 0x00-0x7F are identical to ASCII
 * - Bytes 0x80-0xFF map to extended Latin characters
 * - Used in PNG tEXt chunks and many legacy protocols
 */

import { TestSuite } from "../../schema/test-schema.js";

export const latin1FixedStringTestSuite: TestSuite = {
  name: "latin1_fixed_string",
  description: "Fixed-length Latin-1 encoded strings",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Latin1Fixed": {
        sequence: [
          { name: "text", type: "string", kind: "fixed", length: 8, encoding: "latin1" }
        ]
      }
    }
  },
  test_type: "Latin1Fixed",
  test_cases: [
    {
      description: "ASCII text in Latin-1 field",
      value: { text: "Hello" },
      bytes: [0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0x00, 0x00]
    },
    {
      description: "Latin-1 extended characters (café)",
      value: { text: "café" },
      bytes: [0x63, 0x61, 0x66, 0xE9, 0x00, 0x00, 0x00, 0x00]
    },
    {
      description: "Latin-1 with umlaut (Björk)",
      value: { text: "Björk" },
      bytes: [0x42, 0x6A, 0xF6, 0x72, 0x6B, 0x00, 0x00, 0x00]
    },
    {
      description: "Full 8 characters",
      value: { text: "12345678" },
      bytes: [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38]
    }
  ]
};

export const latin1LengthPrefixedTestSuite: TestSuite = {
  name: "latin1_length_prefixed",
  description: "Length-prefixed Latin-1 encoded strings",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Latin1LengthPrefixed": {
        sequence: [
          { name: "text", type: "string", kind: "length_prefixed", length_type: "uint8", encoding: "latin1" }
        ]
      }
    }
  },
  test_type: "Latin1LengthPrefixed",
  test_cases: [
    {
      description: "Empty string",
      value: { text: "" },
      bytes: [0x00]
    },
    {
      description: "ASCII text",
      value: { text: "Hello" },
      bytes: [0x05, 0x48, 0x65, 0x6C, 0x6C, 0x6F]
    },
    {
      description: "Latin-1 with accents (résumé)",
      value: { text: "résumé" },
      bytes: [0x06, 0x72, 0xE9, 0x73, 0x75, 0x6D, 0xE9]
    },
    {
      description: "Latin-1 copyright symbol",
      value: { text: "©2024" },
      bytes: [0x05, 0xA9, 0x32, 0x30, 0x32, 0x34]
    },
    {
      description: "Latin-1 degree symbol",
      value: { text: "20°C" },
      bytes: [0x04, 0x32, 0x30, 0xB0, 0x43]
    }
  ]
};

export const latin1NullTerminatedTestSuite: TestSuite = {
  name: "latin1_null_terminated",
  description: "Null-terminated Latin-1 encoded strings (like PNG tEXt keywords)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Latin1NullTerminated": {
        sequence: [
          { name: "keyword", type: "string", kind: "null_terminated", encoding: "latin1" },
          { name: "value", type: "uint8" }
        ]
      }
    }
  },
  test_type: "Latin1NullTerminated",
  test_cases: [
    {
      description: "ASCII keyword",
      value: { keyword: "Title", value: 42 },
      bytes: [0x54, 0x69, 0x74, 0x6C, 0x65, 0x00, 42]
    },
    {
      description: "Latin-1 keyword with accents",
      value: { keyword: "Auteur", value: 1 },
      bytes: [0x41, 0x75, 0x74, 0x65, 0x75, 0x72, 0x00, 1]
    },
    {
      description: "PNG-style keyword",
      value: { keyword: "Description", value: 255 },
      bytes: [0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x69, 0x6F, 0x6E, 0x00, 255]
    }
  ]
};

export const latin1VsAsciiTestSuite: TestSuite = {
  name: "latin1_vs_ascii",
  description: "Comparison of Latin-1 and ASCII encoding behavior",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Latin1AndAscii": {
        sequence: [
          { name: "latin1_text", type: "string", kind: "length_prefixed", length_type: "uint8", encoding: "latin1" },
          { name: "ascii_text", type: "string", kind: "length_prefixed", length_type: "uint8", encoding: "ascii" }
        ]
      }
    }
  },
  test_type: "Latin1AndAscii",
  test_cases: [
    {
      description: "Both encodings identical for ASCII range",
      value: { latin1_text: "Hello", ascii_text: "World" },
      bytes: [0x05, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x05, 0x57, 0x6F, 0x72, 0x6C, 0x64]
    }
  ]
};
