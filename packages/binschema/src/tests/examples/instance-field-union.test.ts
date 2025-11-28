// ABOUTME: Test inline discriminated union in instances with field-based discriminator
// ABOUTME: Tests the PCF-like pattern: type tag in header, data at offset

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test for inline discriminated union in instances
 *
 * This tests the pattern where:
 * - The type discriminator is a field in the containing struct
 * - The actual data is at a different position (accessed via instance)
 * - The instance type is determined by the discriminator field
 *
 * This is the PCF pattern: table_type in header, body at ofs_body
 */
export const instanceFieldUnionTestSuite = defineTestSuite({
  name: "instance_field_union",
  description: "Instance with inline discriminated union using field discriminator",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        description: "Variant A: 3 bytes",
        sequence: [
          { name: "value_a", type: "uint16" },
          { name: "extra", type: "uint8" }
        ]
      },
      "TypeB": {
        description: "Variant B: 5 bytes",
        sequence: [
          { name: "value_b", type: "uint32" },
          { name: "flag", type: "uint8" }
        ]
      },
      "Container": {
        description: "Container with type tag and offset to data",
        sequence: [
          { name: "type_tag", type: "uint8" },
          { name: "data_offset", type: "uint32" },
          { name: "data_size", type: "uint32" }
        ],
        instances: [
          {
            name: "data",
            type: {
              discriminator: { field: "type_tag" },
              variants: [
                { when: "value == 1", type: "TypeA" },
                { when: "value == 2", type: "TypeB" }
              ]
            },
            position: "data_offset",
            size: "data_size"
          }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "Container with TypeA data (type_tag=1)",
      bytes: [
        // === Container sequence (offset 0-8) ===
        // type_tag: 1 (TypeA)
        0x01,
        // data_offset: 9
        0x09, 0x00, 0x00, 0x00,
        // data_size: 3
        0x03, 0x00, 0x00, 0x00,

        // === Data at offset 9 (TypeA) ===
        // value_a: 0x1234
        0x34, 0x12,
        // extra: 0xAB
        0xAB
      ],
      value: {
        type_tag: 1,
        data_offset: 9,
        data_size: 3,
        data: {
          type: "TypeA",
          value: {
            value_a: 0x1234,
            extra: 0xAB
          }
        }
      }
    },
    {
      description: "Container with TypeB data (type_tag=2)",
      bytes: [
        // === Container sequence (offset 0-8) ===
        // type_tag: 2 (TypeB)
        0x02,
        // data_offset: 9
        0x09, 0x00, 0x00, 0x00,
        // data_size: 5
        0x05, 0x00, 0x00, 0x00,

        // === Data at offset 9 (TypeB) ===
        // value_b: 0x12345678
        0x78, 0x56, 0x34, 0x12,
        // flag: 0xFF
        0xFF
      ],
      value: {
        type_tag: 2,
        data_offset: 9,
        data_size: 5,
        data: {
          type: "TypeB",
          value: {
            value_b: 0x12345678,
            flag: 0xFF
          }
        }
      }
    }
  ]
});
