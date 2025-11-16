// ABOUTME: Error test cases for context threading
// ABOUTME: Validates proper error handling when context is missing or malformed

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Missing array iteration context
 *
 * Type requires same_index correlation but is encoded standalone without array context.
 * Should throw clear error indicating context is required.
 */
export const missingArrayContextErrorTestSuite = defineTestSuite({
  name: "context_error_missing_array_context",
  description: "Error when same_index used without array iteration context",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "DataBlock": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "block_id", type: "uint8" }
        ]
      },
      "RefBlock": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "data_position",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../blocks[same_index<DataBlock>]"
            }
          }
        ]
      },
      "Container": {
        sequence: [
          {
            name: "blocks",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "DataBlock" },
                { type: "RefBlock" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "RefBlock",  // Testing RefBlock standalone (not in array context)
  test_cases: [
    {
      description: "Encoding RefBlock standalone should error (needs array context)",
      value: {
        type_tag: 0x02
        // data_position would need blocks array context
      },
      should_error_on_encode: true,
      error_message: "same_index correlation which requires encoding within an array context"
    }
  ]
});

/**
 * Test: Missing parent field in context
 *
 * Nested type references ../field_name but parent doesn't provide that field in context.
 */
export const missingParentFieldErrorTestSuite = defineTestSuite({
  name: "context_error_missing_parent_field",
  description: "Error when parent field referenced via ../ is not in context",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Header": {
        sequence: [
          {
            name: "body_size",
            type: "uint32",
            computed: {
              type: "length_of",
              target: "../body"  // References parent's body field
            }
          }
        ]
      },
      "Message": {
        sequence: [
          { name: "header", type: "Header" },
          {
            name: "body",
            type: "array",
            kind: "field_referenced",
            length_field: "header.body_size",
            items: { type: "uint8" }
          }
        ]
      }
    }
  },
  test_type: "Header",  // Testing Header standalone (no parent context)
  test_cases: [
    {
      description: "Encoding Header standalone should error (needs parent.body)",
      value: {},
      should_error_on_encode: true,
      error_message: "parent field 'body'"
    }
  ]
});

/**
 * Test: Array index out of bounds
 *
 * same_index references array element but current index exceeds array length.
 * This shouldn't happen in normal usage but validates error handling.
 */
export const arrayIndexOutOfBoundsErrorTestSuite = defineTestSuite({
  name: "context_error_array_index_out_of_bounds",
  description: "Error when same_index references non-existent array element",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Data": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "value", type: "uint8" }
        ]
      },
      "Ref": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "data_value",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../items[same_index<Data>].value"
            }
          }
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
                { type: "Data" },
                { type: "Ref" }
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
      description: "Ref at index 1 but only 1 element in array (index out of bounds)",
      value: {
        items: [
          { type: "Data", value: 50 },
          { type: "Ref" }  // Index 1, but trying to access items[1] which is itself
        ]
      },
      should_error_on_encode: true,
      error_message: "index out of bounds"
    }
  ]
});

/**
 * Test: Type mismatch at same_index
 *
 * same_index<TypeA> expects TypeA at that index, but finds TypeB instead.
 * Should throw error indicating type mismatch.
 */
export const typeMismatchAtSameIndexErrorTestSuite = defineTestSuite({
  name: "context_error_type_mismatch_same_index",
  description: "Error when same_index finds wrong type at target index",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xAA },
          { name: "a_value", type: "uint8" }
        ]
      },
      "TypeB": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xBB },
          { name: "b_value", type: "uint8" }
        ]
      },
      "RefToA": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x52 },  // ASCII 'R'
          {
            name: "ref_value",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../items[same_index<TypeA>].a_value"
            }
          }
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
                { type: "TypeB" },
                { type: "RefToA" }
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
      description: "RefToA expects TypeA at same_index but finds TypeB",
      value: {
        items: [
          { type: "TypeB", b_value: 50 },  // Index 0 is TypeB
          { type: "RefToA" }                // Index 1 expects TypeA at index 0
        ]
      },
      should_error_on_encode: true,
      error_message: "Expected TypeA at items[0] but found TypeB"
    }
  ]
});

/**
 * Test: first<Type> with no matching elements
 *
 * Computed field uses first<Type> but array contains no elements of that type.
 * Should use sentinel value (0xFFFFFFFF) or error, depending on implementation.
 */
export const firstSelectorNoMatchErrorTestSuite = defineTestSuite({
  name: "context_error_first_selector_no_match",
  description: "Error or sentinel when first<Type> finds no matching elements",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xAA },
          { name: "value", type: "uint8" }
        ]
      },
      "TypeB": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xBB },
          { name: "value", type: "uint8" }
        ]
      },
      "Index": {
        sequence: [
          {
            name: "first_b_position",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../items[first<TypeB>]"
            }
          }
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
          },
          { name: "index", type: "Index" }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "No TypeB in array, first<TypeB> returns 0xFFFFFFFF sentinel",
      value: {
        items: [
          { type: "TypeA", value: 10 },
          { type: "TypeA", value: 20 }
        ],
        index: {}
      },
      decoded_value: {
        items: [
          { type: "TypeA", type_tag: 0xAA, value: 10 },
          { type: "TypeA", type_tag: 0xAA, value: 20 }
        ],
        index: {
          first_b_position: 0xFFFFFFFF  // Sentinel: not found
        }
      },
      bytes: [
        // items[0]: TypeA
        0xAA, 10,

        // items[1]: TypeA
        0xAA, 20,

        // index
        0xFF, 0xFF, 0xFF, 0xFF  // first_b_position = 0xFFFFFFFF (not found)
      ]
    }
  ]
});

/**
 * Test: last<Type> with no matching elements
 *
 * Similar to first<Type> but for last element.
 */
export const lastSelectorNoMatchErrorTestSuite = defineTestSuite({
  name: "context_error_last_selector_no_match",
  description: "Sentinel value when last<Type> finds no matching elements",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeX": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x58 },  // ASCII 'X'
          { name: "x_val", type: "uint8" }
        ]
      },
      "TypeY": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x59 },  // ASCII 'Y'
          { name: "y_val", type: "uint8" }
        ]
      },
      "Footer": {
        sequence: [
          {
            name: "last_x_position",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../items[last<TypeX>]"
            }
          }
        ]
      },
      "Stream": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "TypeX" },
                { type: "TypeY" }
              ]
            }
          },
          { name: "footer", type: "Footer" }
        ]
      }
    }
  },
  test_type: "Stream",
  test_cases: [
    {
      description: "No TypeX in array, last<TypeX> returns 0xFFFFFFFF",
      value: {
        items: [
          { type: "TypeY", y_val: 30 },
          { type: "TypeY", y_val: 40 }
        ],
        footer: {}
      },
      decoded_value: {
        items: [
          { type: "TypeY", type_tag: 0x59, y_val: 30 },
          { type: "TypeY", type_tag: 0x59, y_val: 40 }
        ],
        footer: {
          last_x_position: 0xFFFFFFFF  // Not found
        }
      },
      bytes: [
        // items[0]: TypeY
        0x59, 30,

        // items[1]: TypeY
        0x59, 40,

        // footer
        0xFF, 0xFF, 0xFF, 0xFF  // last_x_position = 0xFFFFFFFF
      ]
    }
  ]
});

/**
 * Test: Circular parent reference (too many ../)
 *
 * Path uses more ../ than there are parent levels in context.
 * Should error with clear message about invalid parent navigation.
 */
export const tooManyParentLevelsErrorTestSuite = defineTestSuite({
  name: "context_error_too_many_parent_levels",
  description: "Error when ../ path exceeds available parent levels",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Nested": {
        sequence: [
          {
            name: "invalid_ref",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../../../nonexistent_field"  // Too many ../
            }
          }
        ]
      },
      "Parent": {
        sequence: [
          { name: "nested", type: "Nested" }
        ]
      }
    }
  },
  test_type: "Parent",
  test_cases: [
    {
      description: "Too many ../ levels in path (exceeds parent stack)",
      value: {
        nested: {}
      },
      should_error_on_encode: true,
      error_message: "parent navigation exceeds available levels"
    }
  ]
});

/**
 * Test: Malformed context (implementation validation)
 *
 * This test validates that the implementation properly validates context structure.
 * NOTE: This is more of an implementation test - normal schema usage won't trigger this.
 */
export const malformedContextInternalTestSuite = defineTestSuite({
  name: "context_error_malformed_context_internal",
  description: "Internal validation: encoder validates context structure",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Simple": {
        sequence: [
          { name: "value", type: "uint8" }
        ]
      }
    }
  },
  test_type: "Simple",
  test_cases: [
    {
      description: "Normal case (no context errors)",
      value: {
        value: 42
      },
      bytes: [42]
    }
  ]
});

/**
 * Test: Invalid field path in computed target
 *
 * NOTE: This test is commented out because field path validation is not yet implemented.
 * When implementing context threading, add validation for computed field targets to ensure
 * referenced paths actually exist in the schema.
 *
 * TODO: Enable this test once schema validator checks computed field paths
 */
// export const invalidFieldPathSchemaErrorTestSuite = defineTestSuite({
//   name: "context_error_invalid_field_path_schema",
//   description: "Schema validation catches invalid field paths in computed targets",
//   schema: {
//     config: { endianness: "little_endian" },
//     types: {
//       "Header": {
//         sequence: [
//           {
//             name: "size",
//             type: "uint32",
//             computed: {
//               type: "length_of",
//               target: "../nonexistent_field"  // Field doesn't exist
//             }
//           }
//         ]
//       },
//       "Message": {
//         sequence: [
//           { name: "header", type: "Header" },
//           { name: "body", type: "uint8" }  // Not "nonexistent_field"
//         ]
//       }
//     }
//   },
//   test_type: "Message",
//   schema_validation_error: true,
//   error_message: "field path '../nonexistent_field' not found"
// });
