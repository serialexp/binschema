/**
 * Test byte_length_prefixed arrays
 *
 * This array kind reads items until N bytes have been consumed.
 * Used in ASN.1 SEQUENCE structures where the length field specifies
 * the byte length of the contents, not the item count.
 */

import type { TestSuite } from "../../schema/test-schema.js";

export const byteLengthPrefixedSimpleTestSuite: TestSuite = {
  name: "byte_length_prefixed_simple",
  description: "Byte-length-prefixed array of simple uint8 values",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Container": {
        sequence: [
          { name: "byte_length", type: "uint8" },
          {
            name: "items",
            type: "array",
            kind: "byte_length_prefixed",
            byte_length_field: "byte_length",
            items: { type: "uint8" }
          }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "3 bytes of data",
      value: {
        byte_length: 3,
        items: [0x0A, 0x0B, 0x0C]
      },
      bytes: [
        0x03,              // byte_length: 3
        0x0A, 0x0B, 0x0C   // items: 3 bytes
      ]
    },
    {
      description: "Empty (0 bytes)",
      value: {
        byte_length: 0,
        items: []
      },
      bytes: [
        0x00   // byte_length: 0, no items
      ]
    },
    {
      description: "5 bytes of data",
      value: {
        byte_length: 5,
        items: [0x01, 0x02, 0x03, 0x04, 0x05]
      },
      bytes: [
        0x05,                          // byte_length: 5
        0x01, 0x02, 0x03, 0x04, 0x05  // items: 5 bytes
      ]
    }
  ]
};
