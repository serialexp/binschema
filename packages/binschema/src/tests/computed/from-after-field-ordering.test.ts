/**
 * Test: from_after_field ordering validation
 *
 * Tests that from_after_field computed lengths properly handle (or reject)
 * cases where the length field comes AFTER some content it should measure.
 *
 * Valid pattern (length before content):
 *   tag -> length -> content_a -> content_b
 *   length measures: content_a + content_b
 *
 * Invalid pattern (length after some content):
 *   tag -> content_a -> length -> content_b
 *   length tries to measure: content_a + content_b
 *   Bug: content_a gets encoded twice!
 */

import type { TestSuite } from "../../schema/test-schema.js";

// Test 1: Valid ordering - length field right after tag (before all content)
export const fromAfterFieldValidOrderingTestSuite: TestSuite = {
  name: "from_after_field_valid_ordering",
  description: "from_after_field with length correctly placed before content",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "ValidOrdering": {
        sequence: [
          { name: "tag", type: "uint8", const: 0x30 },
          {
            name: "length",
            type: "varlength",
            encoding: "der",
            computed: { type: "length_of", from_after_field: "length" }
          },
          { name: "content_a", type: "uint8" },
          { name: "content_b", type: "uint16" }
        ]
      }
    }
  },
  test_type: "ValidOrdering",
  tests: [
    {
      description: "Length correctly measures content after itself",
      value: {
        content_a: 0x01,
        content_b: 0x0203
      },
      decoded_value: {
        tag: 0x30,
        length: 3,  // 1 byte (content_a) + 2 bytes (content_b)
        content_a: 0x01,
        content_b: 0x0203
      },
      bytes: [
        0x30,       // tag
        0x03,       // length = 3
        0x01,       // content_a
        0x02, 0x03  // content_b
      ]
    }
  ]
};

// Test 2: Invalid ordering - length field AFTER some content it should measure
// This SHOULD throw a schema validation error
export const fromAfterFieldInvalidOrderingTestSuite: TestSuite = {
  name: "from_after_field_invalid_ordering",
  description: "from_after_field with length incorrectly placed after some content - should be rejected",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "InvalidOrdering": {
        sequence: [
          { name: "tag", type: "uint8", const: 0x30 },
          { name: "content_a", type: "uint8" },  // Content BEFORE length field
          {
            name: "length",
            type: "varlength",
            encoding: "der",
            // This tries to measure from after "tag", which includes content_a
            // But content_a comes BEFORE the length field in the sequence!
            // This would cause content_a to be encoded twice (bug), so we reject it.
            computed: { type: "length_of", from_after_field: "tag" }
          },
          { name: "content_b", type: "uint16" }
        ]
      }
    }
  },
  test_type: "InvalidOrdering",
  schema_validation_error: true,
  error_message: "content fields (content_a) between it and the length field that would be encoded twice"
};
