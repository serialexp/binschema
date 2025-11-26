/**
 * Test: calculateSize() for types containing fields with from_after_field
 * 
 * This tests the scenario where:
 * - Type A has a from_after_field computed length
 * - Type B contains a field of Type A
 * - When encoding Type B, it calls A.calculateSize() to measure A
 * 
 * Previously this would throw: "calculateSize() not supported for types with from_after_field"
 * Now it should work by calling encode() and returning the length.
 */

import type { TestSuite } from "../../schema/test-schema.js";

export const nestedCalculateSizeTestSuite: TestSuite = {
  name: "nested_calculatesize_from_after_field",
  description: "Test calculateSize() on types with from_after_field used as nested fields",
  schema: {
    config: {
      endianness: "big_endian"
    },
    types: {
      "InnerType": {
        sequence: [
          { name: "tag", type: "uint8", const: 0x30 },
          { 
            name: "length", 
            type: "varlength", 
            encoding: "der",
            computed: { type: "length_of", from_after_field: "tag" }
          },
          { name: "value", type: "uint16", endianness: "big_endian" }
        ]
      },
      "OuterType": {
        sequence: [
          { name: "header", type: "uint8", const: 0xFF },
          { name: "inner", type: "InnerType" },  // This will call InnerType.calculateSize()
          { name: "footer", type: "uint8", const: 0xEE }
        ]
      }
    }
  },
  test_type: "OuterType",
  test_cases: [
    {
      description: "Outer type containing inner type with from_after_field",
      value: {
        header: 0xFF,
        inner: {
          tag: 0x30,
          value: 0x1234
        },
        footer: 0xEE
      },
      decoded_value: {
        header: 0xFF,
        inner: {
          tag: 0x30,
          length: 2,  // Computed from_after_field length appears in decoded output
          value: 0x1234
        },
        footer: 0xEE
      },
      bytes: [
        0xFF,           // header
        0x30, 0x02,     // inner: tag + length(2)
        0x12, 0x34,     // inner: value
        0xEE            // footer
      ]
    }
  ]
};
