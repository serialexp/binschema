// ABOUTME: Tests for basic context threading through encoder/decoder tree
// ABOUTME: Validates that context is passed correctly even when not actively used

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Simple type with no context requirements
 *
 * Even types that don't need context should accept it and pass it through.
 * This ensures a consistent API across all encoders.
 */
export const noContextRequiredTestSuite = defineTestSuite({
  name: "context_no_requirements",
  description: "Type with no context requirements passes empty context through",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "SimpleMessage": {
        sequence: [
          { name: "version", type: "uint8" },
          { name: "flags", type: "uint16" },
          { name: "payload_length", type: "uint32" }
        ]
      }
    }
  },
  test_type: "SimpleMessage",
  test_cases: [
    {
      description: "Encode/decode simple message without context",
      value: {
        version: 1,
        flags: 0x1234,
        payload_length: 1000
      },
      bytes: [
        1,           // version
        0x34, 0x12,  // flags (LE)
        0xE8, 0x03, 0x00, 0x00  // payload_length = 1000 (LE)
      ]
    }
  ]
});

/**
 * Test: Type with parent field reference via ../
 *
 * The nested type needs to access a field from its parent struct.
 * Context must provide parent field values.
 */
export const singleLevelParentReferenceTestSuite = defineTestSuite({
  name: "context_single_parent_reference",
  description: "Nested type references parent field via ../field_name",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Header": {
        sequence: [
          { name: "magic", type: "uint16" },
          {
            name: "content_size",
            type: "uint32",
            computed: {
              type: "length_of",
              target: "../content"  // Reference parent's content field
            }
          }
        ]
      },
      "Packet": {
        sequence: [
          { name: "header", type: "Header" },
          {
            name: "content",
            type: "array",
            kind: "field_referenced",
            length_field: "header.content_size",
            items: { type: "uint8" }
          },
          { name: "checksum", type: "uint16" }
        ]
      }
    }
  },
  test_type: "Packet",
  test_cases: [
    {
      description: "Header computes content_size from parent's content field",
      value: {
        header: { magic: 0xABCD },
        content: [0x01, 0x02, 0x03, 0x04, 0x05],
        checksum: 0x9999
      },
      decoded_value: {
        header: {
          magic: 0xABCD,
          content_size: 5  // Computed from ../content
        },
        content: [0x01, 0x02, 0x03, 0x04, 0x05],
        checksum: 0x9999
      },
      bytes: [
        0xCD, 0xAB,        // header.magic (LE)
        5, 0, 0, 0,        // header.content_size = 5 (AUTO-COMPUTED)
        1, 2, 3, 4, 5,     // content
        0x99, 0x99         // checksum (LE)
      ]
    },
    {
      description: "Empty content produces zero size",
      value: {
        header: { magic: 0x1234 },
        content: [],
        checksum: 0x0000
      },
      decoded_value: {
        header: {
          magic: 0x1234,
          content_size: 0
        },
        content: [],
        checksum: 0x0000
      },
      bytes: [
        0x34, 0x12,
        0, 0, 0, 0,
        0x00, 0x00
      ]
    }
  ]
});

/**
 * Test: Multi-level parent reference (../../)
 *
 * Type nested multiple levels deep needs to navigate up parent chain
 * to access a field from a grandparent struct.
 */
export const multiLevelParentReferenceTestSuite = defineTestSuite({
  name: "context_multi_level_parent_reference",
  description: "Deeply nested type references grandparent field via ../../",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "InnerMost": {
        sequence: [
          {
            name: "root_version",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../../version_info"  // Navigate to root's version_info
            }
          }
        ]
      },
      "Middle": {
        sequence: [
          { name: "middle_flag", type: "uint8" },
          { name: "inner", type: "InnerMost" }
        ]
      },
      "Root": {
        sequence: [
          {
            name: "version_info",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "uint8" }
          },
          { name: "middle", type: "Middle" }
        ]
      }
    }
  },
  test_type: "Root",
  test_cases: [
    {
      description: "InnerMost accesses Root's version_info via ../../",
      value: {
        version_info: [1, 2, 3],
        middle: {
          middle_flag: 0xFF,
          inner: {
            // root_version computed from ../../version_info
          }
        }
      },
      decoded_value: {
        version_info: [1, 2, 3],
        middle: {
          middle_flag: 0xFF,
          inner: {
            root_version: 3  // Length of grandparent's version_info
          }
        }
      },
      bytes: [
        1, 2, 3,     // version_info
        0xFF,        // middle.middle_flag
        3            // middle.inner.root_version = 3 (AUTO-COMPUTED)
      ]
    }
  ]
});

/**
 * Test: Accessing different parent fields from nested types
 *
 * Multiple nested types reference different fields from their parents.
 * Context must track all parent fields that might be referenced.
 */
export const multipleParentFieldsTestSuite = defineTestSuite({
  name: "context_multiple_parent_fields",
  description: "Different nested types reference different parent fields",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "HeaderA": {
        sequence: [
          {
            name: "data_a_size",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../data_a"
            }
          }
        ]
      },
      "HeaderB": {
        sequence: [
          {
            name: "data_b_size",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../data_b"
            }
          }
        ]
      },
      "Container": {
        sequence: [
          { name: "header_a", type: "HeaderA" },
          { name: "header_b", type: "HeaderB" },
          {
            name: "data_a",
            type: "array",
            kind: "field_referenced",
            length_field: "header_a.data_a_size",
            items: { type: "uint8" }
          },
          {
            name: "data_b",
            type: "array",
            kind: "field_referenced",
            length_field: "header_b.data_b_size",
            items: { type: "uint8" }
          }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "HeaderA references data_a, HeaderB references data_b",
      value: {
        header_a: {},
        header_b: {},
        data_a: [0xAA, 0xBB],
        data_b: [0xCC, 0xDD, 0xEE]
      },
      decoded_value: {
        header_a: { data_a_size: 2 },
        header_b: { data_b_size: 3 },
        data_a: [0xAA, 0xBB],
        data_b: [0xCC, 0xDD, 0xEE]
      },
      bytes: [
        2, 0,              // header_a.data_a_size = 2
        3, 0,              // header_b.data_b_size = 3
        0xAA, 0xBB,        // data_a
        0xCC, 0xDD, 0xEE   // data_b
      ]
    }
  ]
});
