// ABOUTME: Validation tests for choice type discriminator requirements
// ABOUTME: Tests const values, uniqueness, type consistency for choice discriminators

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Choice types must have const values on first field
 */
export const choiceMissingConstValueTestSuite = defineTestSuite({
  name: "error_choice_missing_const_value",
  description: "Choice type first field must have const value for discrimination",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "discriminator", type: "uint8" }  // Missing const value!
        ]
      },
      "TypeB": {
        sequence: [
          { name: "discriminator", type: "uint8", const: 0x02 }
        ]
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "TypeA" },
                { type: "TypeB" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "Container",
  schema_validation_error: true,
  error_message: "Discriminator field 'discriminator' in choice type 'TypeA' must have a 'const' value to enable discrimination during decoding"
});

/**
 * Test: Duplicate const values not allowed
 */
export const choiceDuplicateConstValueTestSuite = defineTestSuite({
  name: "error_choice_duplicate_const_value",
  description: "Choice types cannot have duplicate discriminator values",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "discriminator", type: "uint8", const: 0x01 }
        ]
      },
      "TypeB": {
        sequence: [
          { name: "discriminator", type: "uint8", const: 0x01 }  // Duplicate!
        ]
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "TypeA" },
                { type: "TypeB" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "Container",
  schema_validation_error: true,
  error_message: "Discriminator value 0x1 in choice type 'TypeB' conflicts with 'TypeA' (discriminator values must be unique)"
});

/**
 * Test: First fields must have same type
 */
export const choiceInconsistentTypeTestSuite = defineTestSuite({
  name: "error_choice_inconsistent_discriminator_type",
  description: "Choice type discriminators must all have the same type",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "discriminator", type: "uint8", const: 0x01 }
        ]
      },
      "TypeB": {
        sequence: [
          { name: "discriminator", type: "uint16", const: 0x02 }  // Wrong type!
        ]
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "TypeA" },
                { type: "TypeB" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "Container",
  schema_validation_error: true,
  error_message: "Discriminator field 'discriminator' in choice type 'TypeB' must be of type 'uint8', got 'uint16'"
});

/**
 * Test: First fields must have same name
 */
export const choiceInconsistentNameTestSuite = defineTestSuite({
  name: "error_choice_inconsistent_discriminator_name",
  description: "Choice type discriminators must all have the same field name",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "type_code", type: "uint8", const: 0x01 }
        ]
      },
      "TypeB": {
        sequence: [
          { name: "kind", type: "uint8", const: 0x02 }  // Wrong name!
        ]
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "TypeA" },
                { type: "TypeB" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "Container",
  schema_validation_error: true,
  error_message: "Choice type 'TypeB' must have 'type_code' as its first field (to match other choice variants). Got 'kind'"
});

/**
 * Test: Valid choice with uint8 discriminators
 */
export const choiceValidUint8TestSuite = defineTestSuite({
  name: "valid_choice_uint8_discriminators",
  description: "Valid choice with uint8 const discriminators",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "value_a", type: "uint8" }
        ]
      },
      "TypeB": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          { name: "value_b", type: "uint16" }
        ]
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "TypeA" },
                { type: "TypeB" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "Two items with different discriminators",
      value: {
        items: [
          { type: "TypeA", value_a: 10 },
          { type: "TypeB", value_b: 300 }
        ]
      },
      decoded_value: {
        items: [
          { type: "TypeA", type_tag: 0x01, value_a: 10 },
          { type: "TypeB", type_tag: 0x02, value_b: 300 }
        ]
      },
      bytes: [
        0x01, 10,        // TypeA: type_tag=0x01, value_a=10
        0x02, 44, 1      // TypeB: type_tag=0x02, value_b=300 (little-endian)
      ]
    }
  ]
});

/**
 * Test: Valid choice with uint32 discriminators (ZIP-style)
 */
export const choiceValidUint32TestSuite = defineTestSuite({
  name: "valid_choice_uint32_discriminators",
  description: "Valid choice with uint32 const discriminators (ZIP-style signatures)",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "HeaderA": {
        sequence: [
          { name: "signature", type: "uint32", const: 0x04034b50 },  // PK\x03\x04
          { name: "data", type: "uint8" }
        ]
      },
      "HeaderB": {
        sequence: [
          { name: "signature", type: "uint32", const: 0x02014b50 },  // PK\x01\x02
          { name: "data", type: "uint8" }
        ]
      },
      "Archive": {
        sequence: [
          {
            name: "sections",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "HeaderA" },
                { type: "HeaderB" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "Archive",
  test_cases: [
    {
      description: "ZIP-style headers with uint32 signatures",
      value: {
        sections: [
          { type: "HeaderA", data: 0xAA },
          { type: "HeaderB", data: 0xBB }
        ]
      },
      decoded_value: {
        sections: [
          { type: "HeaderA", signature: 0x04034b50, data: 0xAA },
          { type: "HeaderB", signature: 0x02014b50, data: 0xBB }
        ]
      },
      bytes: [
        0x50, 0x4b, 0x03, 0x04, 0xAA,  // HeaderA: signature (little-endian), data
        0x50, 0x4b, 0x01, 0x02, 0xBB   // HeaderB: signature (little-endian), data
      ]
    }
  ]
});
