import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Stateful field-id deltas (the missing primitive for modelling Thrift compact
 * field headers in BinSchema).
 *
 * Each participating field carries a `computed: { type: "field_id_delta", id }`.
 * A single struct-scoped accumulator (`last emitted field id`, starting at 0)
 * advances ONLY for fields that are actually emitted. So when an optional field
 * is dropped, the next present field's delta grows to span the gap.
 *
 *   encode: delta = id - last_emitted;  last_emitted = id
 *   decode: id    = last_emitted + delta;  last_emitted = id   (decoded value is the id)
 *
 * The wire layout (here: a presence flag per field, then the delta byte, then the
 * value byte) is modelled entirely from existing BinSchema primitives — the only
 * new capability is the running accumulator.
 */
export const fieldIdDeltaTestSuite = defineTestSuite({
  name: "field_id_delta",
  description: "Stateful field-id delta accumulator across dropped optional fields",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "DeltaStruct": {
        sequence: [
          { name: "p1", type: "uint8" },
          { name: "p2", type: "uint8" },
          { name: "p5", type: "uint8" },
          { name: "d1", type: "uint8", computed: { type: "field_id_delta", id: 1 }, conditional: "p1 == 1" },
          { name: "v1", type: "uint8", conditional: "p1 == 1" },
          { name: "d2", type: "uint8", computed: { type: "field_id_delta", id: 2 }, conditional: "p2 == 1" },
          { name: "v2", type: "uint8", conditional: "p2 == 1" },
          { name: "d5", type: "uint8", computed: { type: "field_id_delta", id: 5 }, conditional: "p5 == 1" },
          { name: "v5", type: "uint8", conditional: "p5 == 1" },
        ],
      },
    },
  },

  test_type: "DeltaStruct",

  test_cases: [
    {
      description: "All present: deltas 1,1,3 (ids 1,2,5)",
      value: { p1: 1, p2: 1, p5: 1, v1: 0xAA, v2: 0xBB, v5: 0xCC },
      decoded_value: { p1: 1, p2: 1, p5: 1, d1: 1, v1: 0xAA, d2: 2, v2: 0xBB, d5: 5, v5: 0xCC },
      bytes: [0x01, 0x01, 0x01, 0x01, 0xAA, 0x01, 0xBB, 0x03, 0xCC],
    },
    {
      description: "Middle dropped: id 2 absent, so id 5's delta jumps to 4",
      value: { p1: 1, p2: 0, p5: 1, v1: 0xAA, v5: 0xCC },
      decoded_value: { p1: 1, p2: 0, p5: 1, d1: 1, v1: 0xAA, d5: 5, v5: 0xCC },
      bytes: [0x01, 0x00, 0x01, 0x01, 0xAA, 0x04, 0xCC],
    },
    {
      description: "Only last present: id 5's delta is the full 5 (accumulator still 0)",
      value: { p1: 0, p2: 0, p5: 1, v5: 0xCC },
      decoded_value: { p1: 0, p2: 0, p5: 1, d5: 5, v5: 0xCC },
      bytes: [0x00, 0x00, 0x01, 0x05, 0xCC],
    },
    {
      description: "First two present, last dropped: deltas 1,1",
      value: { p1: 1, p2: 1, p5: 0, v1: 0xAA, v2: 0xBB },
      decoded_value: { p1: 1, p2: 1, p5: 0, d1: 1, v1: 0xAA, d2: 2, v2: 0xBB },
      bytes: [0x01, 0x01, 0x00, 0x01, 0xAA, 0x01, 0xBB],
    },
    {
      description: "None present: only the presence flags",
      value: { p1: 0, p2: 0, p5: 0 },
      decoded_value: { p1: 0, p2: 0, p5: 0 },
      bytes: [0x00, 0x00, 0x00],
    },
  ],
});
