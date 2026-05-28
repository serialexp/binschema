import { TestSuite } from "../../schema/test-schema.js";

/**
 * Tests for SIGNED variable-length integer encodings.
 *
 * 1. zigzag        - zigzag mapping (0,-1,1,-2,2 -> 0,1,2,3,4) then unsigned
 *                    LEB128. Used by Protocol Buffers (sint32/sint64) and Apache
 *                    Thrift compact protocol (every i16/i32/i64). This is the
 *                    encoding Parquet footers need.
 * 2. leb128_signed - signed LEB128 (SLEB128). Used by DWARF debug info and
 *                    WebAssembly. Sign-extension based, distinct wire format
 *                    from zigzag.
 *
 * All expected bytes are hand-computed (see per-case comments), never generated
 * from the implementation.
 */

// =============================================================================
// ZigZag (zigzag transform + unsigned LEB128)
// =============================================================================
// zigzag(n) = n >= 0 ? 2n : -2n - 1
//   0 -> 0, -1 -> 1, 1 -> 2, -2 -> 3, 2 -> 4, ...
// Then the unsigned result is LEB128-encoded.

export const zigzagVarlengthTestSuite: TestSuite = {
  name: "zigzag_varlength",
  description: "ZigZag-encoded signed varint (protobuf sint / Thrift compact)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "ZigZag": {
        sequence: [
          { name: "value", type: "varlength", encoding: "zigzag" }
        ]
      }
    }
  },
  test_type: "ZigZag",
  test_cases: [
    { description: "0 -> zz 0", value: { value: 0 }, bytes: [0x00] },
    { description: "-1 -> zz 1", value: { value: -1 }, bytes: [0x01] },
    { description: "1 -> zz 2", value: { value: 1 }, bytes: [0x02] },
    { description: "-2 -> zz 3", value: { value: -2 }, bytes: [0x03] },
    { description: "2 -> zz 4", value: { value: 2 }, bytes: [0x04] },
    { description: "63 -> zz 126", value: { value: 63 }, bytes: [0x7E] },
    // 64 -> zz 128 -> LEB128(128) = 0x80 0x01
    { description: "64 -> zz 128 (2 bytes)", value: { value: 64 }, bytes: [0x80, 0x01] },
    { description: "-64 -> zz 127", value: { value: -64 }, bytes: [0x7F] },
    // 150 -> zz 300 -> LEB128(300): 300 = 0b1_0010_1100; low7=0x2C|cont, hi=0x02
    { description: "150 -> zz 300", value: { value: 150 }, bytes: [0xAC, 0x02] },
    // -150 -> zz 299 -> LEB128(299): low7=0x2B|cont, hi=0x02
    { description: "-150 -> zz 299", value: { value: -150 }, bytes: [0xAB, 0x02] }
  ]
};

// =============================================================================
// Signed LEB128 (SLEB128)
// =============================================================================
// Encode: repeatedly take low 7 bits, arithmetic-shift right 7. Stop when
// (value == 0 and sign bit (0x40) of byte clear) OR
// (value == -1 and sign bit (0x40) of byte set). Otherwise set 0x80 and continue.

export const leb128SignedVarlengthTestSuite: TestSuite = {
  name: "leb128_signed_varlength",
  description: "Signed LEB128 (SLEB128) - DWARF / WebAssembly",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "SLEB": {
        sequence: [
          { name: "value", type: "varlength", encoding: "leb128_signed" }
        ]
      }
    }
  },
  test_type: "SLEB",
  test_cases: [
    { description: "0", value: { value: 0 }, bytes: [0x00] },
    { description: "-1", value: { value: -1 }, bytes: [0x7F] },
    { description: "2", value: { value: 2 }, bytes: [0x02] },
    { description: "-2", value: { value: -2 }, bytes: [0x7E] },
    { description: "63", value: { value: 63 }, bytes: [0x3F] },
    // 64: byte 0x40 with value->0 but sign bit set, so needs trailing 0x00
    { description: "64 (needs trailing 0x00)", value: { value: 64 }, bytes: [0xC0, 0x00] },
    { description: "-64", value: { value: -64 }, bytes: [0x40] },
    // 127: 0x7F has sign bit set with value->0, needs trailing 0x00
    { description: "127 (needs trailing 0x00)", value: { value: 127 }, bytes: [0xFF, 0x00] },
    // -128 -> [0x80, 0x7F]
    { description: "-128", value: { value: -128 }, bytes: [0x80, 0x7F] },
    // 128 -> [0x80, 0x01]
    { description: "128", value: { value: 128 }, bytes: [0x80, 0x01] }
  ]
};
