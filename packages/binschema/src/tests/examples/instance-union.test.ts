// ABOUTME: Test discriminated union types accessed via instances
// ABOUTME: Tests that instances can use discriminated unions with peek-based discrimination

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test for instances pointing to discriminated union types
 *
 * This demonstrates that an instance can reference a discriminated union type,
 * where the union uses peek-based discrimination to determine which variant to parse.
 *
 * Unlike PCF (where the type tag is external), this pattern works when
 * the type information is embedded in the data itself.
 */
export const instanceUnionTestSuite = defineTestSuite({
  name: "instance_union",
  description: "Instance pointing to discriminated union type with peek",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        description: "Variant A: starts with 0x01",
        sequence: [
          { name: "tag", type: "uint8" },  // Always 0x01
          { name: "value_a", type: "uint16" }
        ]
      },
      "TypeB": {
        description: "Variant B: starts with 0x02",
        sequence: [
          { name: "tag", type: "uint8" },  // Always 0x02
          { name: "value_b", type: "uint32" }
        ]
      },
      "TaggedData": {
        description: "Union of TypeA and TypeB based on first byte",
        type: "discriminated_union",
        discriminator: { peek: "uint8" },
        variants: [
          { when: "value == 0x01", type: "TypeA" },
          { when: "value == 0x02", type: "TypeB" }
        ]
      },
      "Container": {
        description: "Container with offset to tagged data",
        sequence: [
          { name: "header", type: "uint32" },
          { name: "data_offset", type: "uint32" },
          { name: "data_size", type: "uint32" }
        ],
        instances: [
          {
            name: "data",
            type: "TaggedData",
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
      description: "Container with TypeA data (tag=0x01)",
      bytes: [
        // === Container sequence (offset 0-11) ===
        // header: 0xDEADBEEF
        0xEF, 0xBE, 0xAD, 0xDE,
        // data_offset: 12
        0x0C, 0x00, 0x00, 0x00,
        // data_size: 3
        0x03, 0x00, 0x00, 0x00,

        // === Data at offset 12 (TypeA) ===
        // tag: 0x01
        0x01,
        // value_a: 0x1234
        0x34, 0x12
      ],
      value: {
        header: 0xDEADBEEF,
        data_offset: 12,
        data_size: 3,
        data: {
          type: "TypeA",
          value: {
            tag: 0x01,
            value_a: 0x1234
          }
        }
      }
    },
    {
      description: "Container with TypeB data (tag=0x02)",
      bytes: [
        // === Container sequence (offset 0-11) ===
        // header: 0xCAFEBABE
        0xBE, 0xBA, 0xFE, 0xCA,
        // data_offset: 12
        0x0C, 0x00, 0x00, 0x00,
        // data_size: 5
        0x05, 0x00, 0x00, 0x00,

        // === Data at offset 12 (TypeB) ===
        // tag: 0x02
        0x02,
        // value_b: 0x12345678
        0x78, 0x56, 0x34, 0x12
      ],
      value: {
        header: 0xCAFEBABE,
        data_offset: 12,
        data_size: 5,
        data: {
          type: "TypeB",
          value: {
            tag: 0x02,
            value_b: 0x12345678
          }
        }
      }
    }
  ]
});
