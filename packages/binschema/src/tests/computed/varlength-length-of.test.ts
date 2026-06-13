// ABOUTME: Tests for a varlength (DER) computed length_of an array field
// ABOUTME: The DER length prefix is written with the varlength method, value from input

import type { TestSuite } from "../../schema/test-schema.js";

/**
 * A minimal ASN.1 DER INTEGER: a tag byte, a DER varlength length prefix that
 * is computed as the byte length of the following content, then the content
 * itself (a field-referenced byte array).
 *
 * This exercises the synchronous varlength `length_of` path: the length value
 * is known directly from the input (`value.len`) and written with the DER
 * varlength method — distinct from the fixed-width-integer computed path and
 * from the `from_after_field` content-first path.
 */
export const varlengthLengthOfArrayTestSuite: TestSuite = {
  name: "varlength_length_of_array",
  description: "DER length prefix (varlength) computed as length_of a byte array",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "DerInteger": {
        sequence: [
          { name: "tag", type: "uint8", const: 0x02 },
          {
            name: "length",
            type: "varlength",
            encoding: "der",
            computed: { type: "length_of", target: "value" },
          },
          {
            name: "value",
            type: "array",
            kind: "field_referenced",
            length_field: "length",
            items: { type: "uint8" },
          },
        ],
      },
    },
  },
  test_type: "DerInteger",
  test_cases: [
    {
      description: "Single-byte content (length 1)",
      value: { value: [0x05] },
      decoded_value: { tag: 0x02, length: 1, value: [0x05] },
      bytes: [0x02, 0x01, 0x05],
    },
    {
      description: "Two-byte content (length 2)",
      value: { value: [0x01, 0x00] },
      decoded_value: { tag: 0x02, length: 2, value: [0x01, 0x00] },
      bytes: [0x02, 0x02, 0x01, 0x00],
    },
    {
      description: "Empty content (length 0)",
      value: { value: [] },
      decoded_value: { tag: 0x02, length: 0, value: [] },
      bytes: [0x02, 0x00],
    },
  ],
};
