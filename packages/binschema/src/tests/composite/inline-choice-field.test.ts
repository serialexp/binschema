// ABOUTME: Tests for inline choice fields used directly in a struct sequence
// ABOUTME: Verifies choice as a direct sequence field (not inside an array)

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Choice used as a direct sequence field in a parent struct.
 *
 * This exercises a different code path than choice-inside-array:
 * the parent struct's decode method must call the correct enum name
 * (e.g., ChoiceSparseFloorDenseFloor::decode_with_decoder) rather
 * than a generic "Choice::decode_with_decoder".
 */
export const inlineChoiceFieldTestSuite = defineTestSuite({
  name: "inline_choice_field",
  description: "Choice type used directly as a sequence field (not inside array)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "SparseFloor": {
        sequence: [
          { name: "tag", type: "uint8", const: 0x01 },
          { name: "index", type: "uint8" },
          { name: "value", type: "uint16" }
        ]
      },
      "DenseFloor": {
        sequence: [
          { name: "tag", type: "uint8", const: 0x02 },
          { name: "count", type: "uint8" }
        ]
      },
      "FloorEntry": {
        sequence: [
          { name: "floor_num", type: "uint8" },
          {
            name: "data",
            type: "choice",
            choices: [
              { type: "SparseFloor" },
              { type: "DenseFloor" }
            ]
          }
        ]
      }
    }
  },
  test_type: "FloorEntry",
  test_cases: [
    {
      description: "SparseFloor variant",
      value: {
        floor_num: 3,
        data: { type: "SparseFloor", index: 5, value: 1000 }
      },
      decoded_value: {
        floor_num: 3,
        data: { type: "SparseFloor", tag: 0x01, index: 5, value: 1000 }
      },
      bytes: [
        3,              // floor_num
        0x01, 5,        // SparseFloor: tag=0x01, index=5
        0x03, 0xE8      // SparseFloor: value=1000 (big-endian)
      ]
    },
    {
      description: "DenseFloor variant",
      value: {
        floor_num: 7,
        data: { type: "DenseFloor", count: 42 }
      },
      decoded_value: {
        floor_num: 7,
        data: { type: "DenseFloor", tag: 0x02, count: 42 }
      },
      bytes: [
        7,              // floor_num
        0x02, 42        // DenseFloor: tag=0x02, count=42
      ]
    }
  ]
});

/**
 * Test: Multiple choice fields in the same struct.
 * Verifies that block scoping prevents duplicate `const discriminator`
 * declarations when multiple choice fields appear in the same decoder.
 */
export const multipleInlineChoiceFieldsTestSuite = defineTestSuite({
  name: "multiple_inline_choice_fields",
  description: "Multiple choice fields in the same struct",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "CmdRead": {
        sequence: [
          { name: "op", type: "uint8", const: 0x10 },
          { name: "addr", type: "uint16" }
        ]
      },
      "CmdWrite": {
        sequence: [
          { name: "op", type: "uint8", const: 0x20 },
          { name: "addr", type: "uint16" },
          { name: "val", type: "uint8" }
        ]
      },
      "RespOk": {
        sequence: [
          { name: "status", type: "uint8", const: 0x00 }
        ]
      },
      "RespError": {
        sequence: [
          { name: "status", type: "uint8", const: 0xFF },
          { name: "code", type: "uint8" }
        ]
      },
      "Transaction": {
        sequence: [
          { name: "seq", type: "uint8" },
          {
            name: "command",
            type: "choice",
            choices: [
              { type: "CmdRead" },
              { type: "CmdWrite" }
            ]
          },
          {
            name: "response",
            type: "choice",
            choices: [
              { type: "RespOk" },
              { type: "RespError" }
            ]
          }
        ]
      }
    }
  },
  test_type: "Transaction",
  test_cases: [
    {
      description: "Read command with OK response",
      value: {
        seq: 1,
        command: { type: "CmdRead", addr: 0x1234 },
        response: { type: "RespOk" }
      },
      decoded_value: {
        seq: 1,
        command: { type: "CmdRead", op: 0x10, addr: 0x1234 },
        response: { type: "RespOk", status: 0x00 }
      },
      bytes: [
        1,                  // seq
        0x10, 0x34, 0x12,   // CmdRead: op=0x10, addr=0x1234 (little-endian)
        0x00                // RespOk: status=0x00
      ]
    },
    {
      description: "Write command with error response",
      value: {
        seq: 2,
        command: { type: "CmdWrite", addr: 0x0800, val: 0xAB },
        response: { type: "RespError", code: 5 }
      },
      decoded_value: {
        seq: 2,
        command: { type: "CmdWrite", op: 0x20, addr: 0x0800, val: 0xAB },
        response: { type: "RespError", status: 0xFF, code: 5 }
      },
      bytes: [
        2,                      // seq
        0x20, 0x00, 0x08, 0xAB, // CmdWrite: op=0x20, addr=0x0800 (little-endian), val=0xAB
        0xFF, 5                 // RespError: status=0xFF, code=5
      ]
    }
  ]
});
