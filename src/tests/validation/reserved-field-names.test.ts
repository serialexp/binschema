// ABOUTME: Schema validation tests for reserved field name patterns
// ABOUTME: Ensures user field names don't conflict with code generator internals

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Field name containing __iter (reserved for array iterator variables)
 */
export const fieldNameWithIterSuffixTestSuite = defineTestSuite({
  name: "error_field_name_with_iter",
  description: "Field names cannot contain __iter (reserved for code generator)",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "BadFieldNames": {
        sequence: [
          { name: "my__iter_field", type: "uint8" }
        ]
      }
    }
  },
  test_type: "BadFieldNames",
  schema_validation_error: true,
  error_message: "Field name 'my__iter_field' contains reserved pattern '__iter' (reserved for internal use by code generators)"
});

/**
 * Field name exactly matching __iter
 */
export const fieldNameExactlyIterTestSuite = defineTestSuite({
  name: "error_field_name_exactly_iter",
  description: "Field name cannot be exactly __iter",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "ExactMatch": {
        sequence: [
          { name: "__iter", type: "uint16" }
        ]
      }
    }
  },
  test_type: "ExactMatch",
  schema_validation_error: true,
  error_message: "Field name '__iter' contains reserved pattern '__iter'"
});

/**
 * Instance field name containing __iter
 */
export const instanceFieldNameWithIterTestSuite = defineTestSuite({
  name: "error_instance_field_with_iter",
  description: "Instance field names also cannot contain __iter",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "BadInstanceName": {
        sequence: [
          { name: "offset", type: "uint32" }
        ],
        instances: [
          {
            name: "data__iter_bad",
            type: "DataBlock",
            position: "offset"
          }
        ]
      },
      "DataBlock": {
        sequence: [
          { name: "value", type: "uint8" }
        ]
      }
    }
  },
  test_type: "BadInstanceName",
  schema_validation_error: true,
  error_message: "Instance field name 'data__iter_bad' contains reserved pattern '__iter'"
});

/**
 * Valid field names that happen to contain "_item" or "iter" without __ prefix
 */
export const validFieldNamesWithSimilarPatternsTestSuite = defineTestSuite({
  name: "valid_field_names_similar_patterns",
  description: "Field names can contain 'iter' or '_item' as long as not '__iter'",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "ValidNames": {
        sequence: [
          { name: "iterator_count", type: "uint8" },
          { name: "first_item_offset", type: "uint32" },
          { name: "last_item", type: "uint16" },
          { name: "iter", type: "uint8" }
        ]
      }
    }
  },
  test_type: "ValidNames",
  test_cases: [
    {
      description: "Field names without __ prefix are valid",
      value: {
        iterator_count: 5,
        first_item_offset: 100,
        last_item: 42,
        iter: 3
      },
      bytes: [5, 100, 0, 0, 0, 42, 0, 3]
    }
  ]
});
