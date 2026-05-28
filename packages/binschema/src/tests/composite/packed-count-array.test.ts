import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Thrift compact-protocol packed collection header.
 *
 * A list/set begins with a single byte that crams two things together:
 *   (count << 4) | element_type_tag    when count is 0..14
 * When count >= 15, the high nibble becomes the escape marker 0xF and the
 * real count follows as an unsigned LEB128 varint:
 *   0xF0 | element_type_tag, then LEB128(count)
 *
 * `element_type_tag` is a schema constant (the element's Thrift type id).
 * Encode always re-emits it; decode reads the byte for the count and ignores
 * the nibble, so round-trips stay byte-exact.
 */

// Helper: build a sequential uint8 array of length n (items derived trivially,
// NOT from the encoder — the header bytes below are hand-computed).
const seq = (n: number) => Array.from({ length: n }, (_, i) => i & 0xFF);

export const packedCountArrayTestSuite = defineTestSuite({
  name: "packed_count_array",
  description: "Thrift packed collection header (count<<4 | type_tag, 0xF escape)",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "PackedList": {
        sequence: [{
          name: "elements",
          type: "array",
          kind: "packed_count",
          element_type_tag: 5,
          items: { type: "uint8" },
        }],
      },
    },
  },

  test_type: "PackedList",

  test_cases: [
    {
      description: "Empty list: (0<<4)|5 = 0x05",
      value: { elements: [] },
      decoded_value: { elements: [] },
      bytes: [0x05],
    },
    {
      description: "Three elements: (3<<4)|5 = 0x35",
      value: { elements: [0xAA, 0xBB, 0xCC] },
      decoded_value: { elements: [0xAA, 0xBB, 0xCC] },
      bytes: [0x35, 0xAA, 0xBB, 0xCC],
    },
    {
      description: "One element: (1<<4)|5 = 0x15",
      value: { elements: [0x42] },
      decoded_value: { elements: [0x42] },
      bytes: [0x15, 0x42],
    },
    {
      description: "Fourteen elements (max short form): (14<<4)|5 = 0xE5",
      value: { elements: seq(14) },
      decoded_value: { elements: seq(14) },
      bytes: [0xE5, ...seq(14)],
    },
    {
      description: "Fifteen elements (escape boundary): 0xF0|5, LEB128(15)=0x0F",
      value: { elements: seq(15) },
      decoded_value: { elements: seq(15) },
      bytes: [0xF5, 0x0F, ...seq(15)],
    },
    {
      description: "Sixteen elements (escape): 0xF0|5, LEB128(16)=0x10",
      value: { elements: seq(16) },
      decoded_value: { elements: seq(16) },
      bytes: [0xF5, 0x10, ...seq(16)],
    },
    {
      description: "130 elements (escape, multi-byte LEB128): 0xF5, LEB128(130)=0x82 0x01",
      value: { elements: seq(130) },
      decoded_value: { elements: seq(130) },
      bytes: [0xF5, 0x82, 0x01, ...seq(130)],
    },
  ],
});

/**
 * A different element_type_tag to confirm the nibble is configurable and
 * occupies the low 4 bits independently of the count.
 */
export const packedCountTagTestSuite = defineTestSuite({
  name: "packed_count_type_tag",
  description: "packed_count with a non-default element type tag (0x0C)",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "TaggedList": {
        sequence: [{
          name: "items",
          type: "array",
          kind: "packed_count",
          element_type_tag: 0x0C,
          items: { type: "uint8" },
        }],
      },
    },
  },

  test_type: "TaggedList",

  test_cases: [
    {
      description: "Empty: (0<<4)|0xC = 0x0C",
      value: { items: [] },
      decoded_value: { items: [] },
      bytes: [0x0C],
    },
    {
      description: "Two elements: (2<<4)|0xC = 0x2C",
      value: { items: [0x01, 0x02] },
      decoded_value: { items: [0x01, 0x02] },
      bytes: [0x2C, 0x01, 0x02],
    },
    {
      description: "Escape with tag 0xC: 0xFC, LEB128(20)=0x14",
      value: { items: seq(20) },
      decoded_value: { items: seq(20) },
      bytes: [0xFC, 0x14, ...seq(20)],
    },
  ],
});
