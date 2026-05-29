import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Delta-coded arrays via the general `transform: "delta"` slot.
 *
 * Delta is a PURE WIRE TRANSFORM on array elements: the logical values are
 * absolutes on BOTH sides. Encode receives [absolute...] and writes
 * value[i] - value[i-1] (accumulator starts at 0); decode reads the deltas and
 * reconstructs running += delta. So `value === decoded_value` — the deltas only
 * ever exist on the wire.
 *
 * Delta is orthogonal to the item's wire type: each delta is written/read using
 * the item's own declared encoding. A `varlength` item with `encoding: "zigzag"`
 * therefore yields zigzag-varint deltas — the right default, since deltas go
 * negative when the data dips. On a plain unsigned fixed-width item it only works
 * for monotonic data (author's responsibility, like Thrift).
 */

// --- Suite 1: signed deltas via zigzag varlength ---------------------------
// values   [100, 103, 101, 200]
// deltas   [100,   3,  -2,  99]   (100-0, 103-100, 101-103, 200-101)
// zigzag   [200,   6,   3, 198]   zz(n) = (n<<1) ^ (n>>63); zz(-2)=3
// LEB128: zz=200 > 127 ⇒ 0xC8 0x01; 6 ⇒ 0x06; 3 ⇒ 0x03; zz=198 > 127 ⇒ 0xC6 0x01
// count=4 as uint16 big-endian = 0x00 0x04
export const deltaArrayZigzagTestSuite = defineTestSuite({
  name: "delta_array_zigzag",
  description: "transform=delta over zigzag-varlength items (handles negative deltas)",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "DeltaZigzag": {
        sequence: [{
          name: "values",
          type: "array",
          kind: "length_prefixed",
          length_type: "uint16",
          transform: "delta",
          items: { type: "varlength", encoding: "zigzag" },
        }],
      },
    },
  },

  test_type: "DeltaZigzag",

  test_cases: [
    {
      description: "Four values, one negative delta: zigzag deltas 200,6,3,198",
      value: { values: [100, 103, 101, 200] },
      bytes: [0x00, 0x04, 0xC8, 0x01, 0x06, 0x03, 0xC6, 0x01],
    },
    {
      description: "Empty array: only the uint16 count prefix",
      value: { values: [] },
      bytes: [0x00, 0x00],
    },
    {
      description: "Single element: delta is the value itself (zigzag(42)=84=0x54)",
      value: { values: [42] },
      bytes: [0x00, 0x01, 0x54],
    },
  ],
});

// --- Suite 2: monotonic deltas via leb128 varlength ------------------------
// values [1700000000, 1700000001, 1700000003]
// deltas [1700000000,          1,          2]
// LEB128(1700000000) = 0x80 0xE2 0xCF 0xAA 0x06 (5 bytes), then 0x01, 0x02
// count=3 as uint16 big-endian = 0x00 0x03
export const deltaArrayLeb128TestSuite = defineTestSuite({
  name: "delta_array_leb128",
  description: "transform=delta over leb128-varlength items (monotonic, multi-byte first delta)",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "DeltaLeb": {
        sequence: [{
          name: "values",
          type: "array",
          kind: "length_prefixed",
          length_type: "uint16",
          transform: "delta",
          items: { type: "varlength", encoding: "leb128" },
        }],
      },
    },
  },

  test_type: "DeltaLeb",

  test_cases: [
    {
      description: "Monotonic timestamps: first delta is multi-byte LEB128, rest tiny",
      value: { values: [1700000000, 1700000001, 1700000003] },
      bytes: [0x00, 0x03, 0x80, 0xE2, 0xCF, 0xAA, 0x06, 0x01, 0x02],
    },
  ],
});

// --- Suite 3: fixed-count unsigned, monotonic ------------------------------
// kind: fixed, length 4, items uint8.
// values [5, 7, 10, 12] → deltas [5, 2, 3, 2] → bytes 5,2,3,2 (no count prefix)
export const deltaArrayFixedUint8TestSuite = defineTestSuite({
  name: "delta_array_fixed_uint8",
  description: "transform=delta over fixed-count uint8 items (monotonic)",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "DeltaFixed": {
        sequence: [{
          name: "values",
          type: "array",
          kind: "fixed",
          length: 4,
          transform: "delta",
          items: { type: "uint8" },
        }],
      },
    },
  },

  test_type: "DeltaFixed",

  test_cases: [
    {
      description: "Monotonic uint8: deltas 5,2,3,2",
      value: { values: [5, 7, 10, 12] },
      bytes: [5, 2, 3, 2],
    },
  ],
});
