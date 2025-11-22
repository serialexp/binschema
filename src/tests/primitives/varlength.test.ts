import { TestSuite } from "../../schema/test-schema.js";

/**
 * Tests for variable-length integer encodings
 *
 * This file tests three variable-length encoding schemes:
 * 1. DER/BER length encoding (ASN.1) - used in Kerberos, X.509, LDAP, SNMP
 * 2. LEB128 varint (Protocol Buffers style) - used in protobuf, WebAssembly, DWARF
 * 3. EBML VINT - used in Matroska/WebM multimedia containers
 */

// =============================================================================
// DER/BER Length Encoding Tests
// =============================================================================
// Format: Length-of-length prefix
// - Short form: 0x00-0x7F = length directly (0-127)
// - Long form: 0x80 + N (where N = number of length bytes), followed by N bytes big-endian
// - Special: 0x80 alone = indefinite length (BER only, not valid in DER)

export const derLengthShortFormTestSuite: TestSuite = {
  name: "der_length_short_form",
  description: "DER length encoding - short form (0-127)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "DERShortLength": {
        sequence: [
          { name: "length", type: "varlength", encoding: "der" }
        ]
      }
    }
  },
  test_type: "DERShortLength",
  test_cases: [
    {
      description: "Zero length",
      value: { length: 0 },
      bytes: [0x00]
    },
    {
      description: "Length 1",
      value: { length: 1 },
      bytes: [0x01]
    },
    {
      description: "Length 5",
      value: { length: 5 },
      bytes: [0x05]
    },
    {
      description: "Length 127 (max short form)",
      value: { length: 127 },
      bytes: [0x7F]
    }
  ]
};

export const derLengthLongFormTestSuite: TestSuite = {
  name: "der_length_long_form",
  description: "DER length encoding - long form (128+)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "DERLongLength": {
        sequence: [
          { name: "length", type: "varlength", encoding: "der" }
        ]
      }
    }
  },
  test_type: "DERLongLength",
  test_cases: [
    {
      description: "Length 128 (min long form, 1 byte)",
      value: { length: 128 },
      bytes: [0x81, 0x80]
    },
    {
      description: "Length 200 (1 byte)",
      value: { length: 200 },
      bytes: [0x81, 0xC8]
    },
    {
      description: "Length 255 (max 1 byte)",
      value: { length: 255 },
      bytes: [0x81, 0xFF]
    },
    {
      description: "Length 256 (min 2 bytes)",
      value: { length: 256 },
      bytes: [0x82, 0x01, 0x00]
    },
    {
      description: "Length 500",
      value: { length: 500 },
      bytes: [0x82, 0x01, 0xF4]
    },
    {
      description: "Length 65535 (max 2 bytes)",
      value: { length: 65535 },
      bytes: [0x82, 0xFF, 0xFF]
    },
    {
      description: "Length 65536 (min 3 bytes)",
      value: { length: 65536 },
      bytes: [0x83, 0x01, 0x00, 0x00]
    },
    {
      description: "Length 1000000 (3 bytes)",
      value: { length: 1000000 },
      bytes: [0x83, 0x0F, 0x42, 0x40]
    },
    {
      description: "Length 16777215 (max 3 bytes)",
      value: { length: 16777215 },
      bytes: [0x83, 0xFF, 0xFF, 0xFF]
    },
    {
      description: "Length 16777216 (min 4 bytes)",
      value: { length: 16777216 },
      bytes: [0x84, 0x01, 0x00, 0x00, 0x00]
    },
    {
      description: "Length 100000000 (4 bytes)",
      value: { length: 100000000 },
      bytes: [0x84, 0x05, 0xF5, 0xE1, 0x00]
    }
  ]
};

// =============================================================================
// LEB128 / Protocol Buffers Varint Tests
// =============================================================================
// Format: MSB continuation bit
// - Each byte: 7 bits data + 1 bit continuation (MSB)
// - MSB=1: more bytes follow, MSB=0: last byte
// - Little-endian (least significant byte first)

export const leb128UnsignedTestSuite: TestSuite = {
  name: "leb128_unsigned",
  description: "LEB128 unsigned varint (protobuf-style)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "LEB128Unsigned": {
        sequence: [
          { name: "value", type: "varlength", encoding: "leb128" }
        ]
      }
    }
  },
  test_type: "LEB128Unsigned",
  test_cases: [
    {
      description: "Zero",
      value: { value: 0 },
      bytes: [0x00]
    },
    {
      description: "Value 1",
      value: { value: 1 },
      bytes: [0x01]
    },
    {
      description: "Value 127 (max 1 byte, 7 bits)",
      value: { value: 127 },
      bytes: [0x7F]
    },
    {
      description: "Value 128 (min 2 bytes)",
      value: { value: 128 },
      bytes: [0x80, 0x01]  // 10000000 00000001 -> 0000001 0000000 = 128
    },
    {
      description: "Value 150 (protobuf example)",
      value: { value: 150 },
      bytes: [0x96, 0x01]  // 10010110 00000001 -> 0000001 0010110 = 128 + 22 = 150
    },
    {
      description: "Value 300",
      value: { value: 300 },
      bytes: [0xAC, 0x02]  // 10101100 00000010 -> 0000010 0101100 = 256 + 44 = 300
    },
    {
      description: "Value 16383 (max 2 bytes, 14 bits)",
      value: { value: 16383 },
      bytes: [0xFF, 0x7F]
    },
    {
      description: "Value 16384 (min 3 bytes)",
      value: { value: 16384 },
      bytes: [0x80, 0x80, 0x01]
    },
    {
      description: "Value 1000000",
      value: { value: 1000000 },
      bytes: [0xC0, 0x84, 0x3D]
    },
    {
      description: "Value 2097151 (max 3 bytes, 21 bits)",
      value: { value: 2097151 },
      bytes: [0xFF, 0xFF, 0x7F]
    },
    {
      description: "Value 268435455 (max 4 bytes, 28 bits)",
      value: { value: 268435455 },
      bytes: [0xFF, 0xFF, 0xFF, 0x7F]
    }
  ]
};

// =============================================================================
// EBML VINT Tests
// =============================================================================
// Format: Leading zero bits indicate width
// - Width marker: sequence of 0s terminated by first 1 bit
// - 1xxxxxxx = 1 byte (7 bits data)
// - 01xxxxxx xxxxxxxx = 2 bytes (14 bits data)
// - 001xxxxx xxxxxxxx xxxxxxxx = 3 bytes (21 bits data)
// - Big-endian byte order

export const ebmlVintTestSuite: TestSuite = {
  name: "ebml_vint",
  description: "EBML variable-size integer (Matroska/WebM)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "EBMLVint": {
        sequence: [
          { name: "value", type: "varlength", encoding: "ebml" }
        ]
      }
    }
  },
  test_type: "EBMLVint",
  test_cases: [
    {
      description: "Value 0 (1 byte, marker removed)",
      value: { value: 0 },
      bytes: [0x80]  // 10000000 -> marker bit removed = 0
    },
    {
      description: "Value 1 (1 byte)",
      value: { value: 1 },
      bytes: [0x81]  // 10000001 -> 0000001 = 1
    },
    {
      description: "Value 5 (1 byte)",
      value: { value: 5 },
      bytes: [0x85]  // 10000101 -> 0000101 = 5
    },
    {
      description: "Value 126 (max 1 byte with marker, 7 bits)",
      value: { value: 126 },
      bytes: [0xFE]  // 11111110 -> 1111110 = 126
    },
    {
      description: "Value 127 (min 2 bytes)",
      value: { value: 127 },
      bytes: [0x40, 0x7F]  // 01000000 01111111 -> 00000000111111 = 127
    },
    {
      description: "Value 128 (2 bytes)",
      value: { value: 128 },
      bytes: [0x40, 0x80]  // 01000000 10000000 -> 00000010000000 = 128
    },
    {
      description: "Value 255 (2 bytes)",
      value: { value: 255 },
      bytes: [0x40, 0xFF]
    },
    {
      description: "Value 256 (2 bytes)",
      value: { value: 256 },
      bytes: [0x41, 0x00]  // 01000001 00000000 -> 00000100000000 = 256
    },
    {
      description: "Value 16382 (max 2 bytes with marker, 14 bits)",
      value: { value: 16382 },
      bytes: [0x7F, 0xFE]  // 01111111 11111110
    },
    {
      description: "Value 16383 (min 3 bytes)",
      value: { value: 16383 },
      bytes: [0x20, 0x3F, 0xFF]  // 00100000 00111111 11111111 -> 000000000111111111111 = 16383
    },
    {
      description: "Value 65535 (3 bytes)",
      value: { value: 65535 },
      bytes: [0x20, 0xFF, 0xFF]
    },
    {
      description: "Value 1000000 (3 bytes)",
      value: { value: 1000000 },
      bytes: [0x2F, 0x42, 0x40]
    }
  ]
};

// =============================================================================
// Mixed Context Tests
// =============================================================================
// Test that multiple varlength fields can coexist in the same structure

export const mixedVarlengthTestSuite: TestSuite = {
  name: "mixed_varlength_encodings",
  description: "Multiple varlength encodings in same structure",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "MixedVarlength": {
        sequence: [
          { name: "der_len", type: "varlength", encoding: "der" },
          { name: "leb128_val", type: "varlength", encoding: "leb128" },
          { name: "ebml_val", type: "varlength", encoding: "ebml" }
        ]
      }
    }
  },
  test_type: "MixedVarlength",
  test_cases: [
    {
      description: "Mix of small values",
      value: { der_len: 5, leb128_val: 127, ebml_val: 10 },
      bytes: [0x05, 0x7F, 0x8A]
    },
    {
      description: "Mix of medium values",
      value: { der_len: 200, leb128_val: 300, ebml_val: 256 },
      bytes: [0x81, 0xC8, 0xAC, 0x02, 0x41, 0x00]
    },
    {
      description: "Mix with zero values",
      value: { der_len: 0, leb128_val: 0, ebml_val: 0 },
      bytes: [0x00, 0x00, 0x80]
    }
  ]
};

// =============================================================================
// Edge Case Tests
// =============================================================================

export const varlengthEdgeCasesTestSuite: TestSuite = {
  name: "varlength_edge_cases",
  description: "Edge cases and boundary conditions for varlength types",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "EdgeCases": {
        sequence: [
          { name: "value", type: "varlength", encoding: "der" }
        ]
      }
    }
  },
  test_type: "EdgeCases",
  test_cases: [
    {
      description: "Boundary: 127 vs 128 (short to long form transition)",
      value: { value: 127 },
      bytes: [0x7F]
    },
    {
      description: "Boundary: 128 (first long form)",
      value: { value: 128 },
      bytes: [0x81, 0x80]
    },
    {
      description: "Powers of 2: 256",
      value: { value: 256 },
      bytes: [0x82, 0x01, 0x00]
    },
    {
      description: "Powers of 2: 65536",
      value: { value: 65536 },
      bytes: [0x83, 0x01, 0x00, 0x00]
    }
  ]
};
