// ABOUTME: Tests for context extension behavior
// ABOUTME: Validates context properly extends when entering arrays/nested types and is passed by reference when unchanged

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Context extends when entering arrays
 *
 * When encoder enters an array, context must be extended with:
 * - Array iteration state (current index, items array, field name)
 * - Parent field references if array elements need them
 */
export const contextExtendsForArrayTestSuite = defineTestSuite({
  name: "context_extension_array",
  description: "Context extends with iteration state when entering arrays",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Item": {
        sequence: [
          { name: "item_id", type: "uint8" },
          {
            name: "parent_count",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../items"  // Reference parent's items array
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
            length: 3,
            items: { type: "Item" }
          }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "Each item can access parent's items array length",
      value: {
        items: [
          { item_id: 1 },
          { item_id: 2 },
          { item_id: 3 }
        ]
      },
      decoded_value: {
        items: [
          { item_id: 1, parent_count: 3 },
          { item_id: 2, parent_count: 3 },
          { item_id: 3, parent_count: 3 }
        ]
      },
      bytes: [
        1, 3,  // item_id=1, parent_count=3
        2, 3,  // item_id=2, parent_count=3
        3, 3   // item_id=3, parent_count=3
      ]
    }
  ]
});

/**
 * Test: Context extends when entering nested types
 *
 * When encoder enters a nested type, context must be extended with:
 * - Parent field values that nested type might reference
 * - Previous context preserved in parent stack
 */
export const contextExtendsForNestedTypeTestSuite = defineTestSuite({
  name: "context_extension_nested_type",
  description: "Context extends with parent fields when entering nested types",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Inner": {
        sequence: [
          {
            name: "outer_value",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../shared_value"  // Reference parent's field
            }
          }
        ]
      },
      "Outer": {
        sequence: [
          { name: "shared_value", type: "uint16" },
          { name: "inner", type: "Inner" }
        ]
      }
    }
  },
  test_type: "Outer",
  test_cases: [
    {
      description: "Inner type accesses outer's shared_value via context",
      value: {
        shared_value: 1234,
        inner: {}
      },
      decoded_value: {
        shared_value: 1234,
        inner: {
          outer_value: 1234  // Copied from parent
        }
      },
      bytes: [
        0xD2, 0x04,  // shared_value = 1234 (LE)
        0xD2, 0x04   // inner.outer_value = 1234
      ]
    }
  ]
});

/**
 * Test: Context properly chains through multiple nesting levels
 *
 * Deep nesting: Root → Middle → Inner
 * Each level extends context with its own fields.
 */
export const contextChainsThroughNestingTestSuite = defineTestSuite({
  name: "context_extension_chaining",
  description: "Context chains through multiple nesting levels",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Inner": {
        sequence: [
          {
            name: "root_field_copy",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../../root_data"  // Access grandparent
            }
          },
          {
            name: "middle_field_copy",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../middle_data"  // Access parent
            }
          }
        ]
      },
      "Middle": {
        sequence: [
          { name: "middle_data", type: "uint8" },
          { name: "inner", type: "Inner" }
        ]
      },
      "Root": {
        sequence: [
          { name: "root_data", type: "uint8" },
          { name: "middle", type: "Middle" }
        ]
      }
    }
  },
  test_type: "Root",
  test_cases: [
    {
      description: "Inner accesses both parent and grandparent via context chain",
      value: {
        root_data: 100,
        middle: {
          middle_data: 200,
          inner: {}
        }
      },
      decoded_value: {
        root_data: 100,
        middle: {
          middle_data: 200,
          inner: {
            root_field_copy: 100,    // From ../../root_data
            middle_field_copy: 200   // From ../middle_data
          }
        }
      },
      bytes: [
        100,  // root_data
        200,  // middle.middle_data
        100,  // middle.inner.root_field_copy
        200   // middle.inner.middle_field_copy
      ]
    }
  ]
});

/**
 * Test: Context extends independently for sibling arrays
 *
 * Two separate arrays in same struct should each get independent array contexts.
 */
export const contextIndependentForSiblingArraysTestSuite = defineTestSuite({
  name: "context_extension_sibling_arrays",
  description: "Sibling arrays get independent array iteration contexts",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "ItemA": {
        sequence: [
          { name: "a_id", type: "uint8" },
          {
            name: "array_a_count",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../array_a"
            }
          }
        ]
      },
      "ItemB": {
        sequence: [
          { name: "b_id", type: "uint8" },
          {
            name: "array_b_count",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../array_b"
            }
          }
        ]
      },
      "TwoArrays": {
        sequence: [
          {
            name: "array_a",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "ItemA" }
          },
          {
            name: "array_b",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "ItemB" }
          }
        ]
      }
    }
  },
  test_type: "TwoArrays",
  test_cases: [
    {
      description: "Each array's items see correct parent array length",
      value: {
        array_a: [
          { a_id: 1 },
          { a_id: 2 }
        ],
        array_b: [
          { b_id: 10 },
          { b_id: 20 },
          { b_id: 30 }
        ]
      },
      decoded_value: {
        array_a: [
          { a_id: 1, array_a_count: 2 },
          { a_id: 2, array_a_count: 2 }
        ],
        array_b: [
          { b_id: 10, array_b_count: 3 },
          { b_id: 20, array_b_count: 3 },
          { b_id: 30, array_b_count: 3 }
        ]
      },
      bytes: [
        // array_a
        1, 2,   // a_id=1, array_a_count=2
        2, 2,   // a_id=2, array_a_count=2

        // array_b
        10, 3,  // b_id=10, array_b_count=3
        20, 3,  // b_id=20, array_b_count=3
        30, 3   // b_id=30, array_b_count=3
      ]
    }
  ]
});

/**
 * Test: Unchanged context passed by reference
 *
 * When encoder doesn't need to extend context (no arrays, no parent references),
 * it should pass the same context reference through for efficiency.
 * This is a performance optimization test - behavior should be identical.
 */
export const unchangedContextPassedByReferenceTestSuite = defineTestSuite({
  name: "context_extension_unchanged_pass_through",
  description: "Context passed by reference when no extension needed",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Simple": {
        sequence: [
          { name: "a", type: "uint8" },
          { name: "b", type: "uint16" }
        ]
      },
      "Container": {
        sequence: [
          { name: "value", type: "uint8" },
          { name: "simple", type: "Simple" }  // No context extension needed
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "Simple nested type doesn't extend context",
      value: {
        value: 42,
        simple: {
          a: 10,
          b: 2000
        }
      },
      bytes: [
        42,          // value
        10,          // simple.a
        0xD0, 0x07   // simple.b = 2000 (LE)
      ]
    }
  ]
});

/**
 * Test: Context extension in array of nested types
 *
 * Array contains complex nested types. Each iteration should:
 * 1. Extend context with array iteration state
 * 2. Further extend when entering nested type within array element
 */
export const contextDoubleExtensionArrayOfStructsTestSuite = defineTestSuite({
  name: "context_extension_array_of_structs",
  description: "Context extends for both array iteration and nested type",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Header": {
        sequence: [
          {
            name: "payload_size",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../payload"
            }
          }
        ]
      },
      "Message": {
        sequence: [
          { name: "msg_id", type: "uint8" },
          { name: "header", type: "Header" },
          {
            name: "payload",
            type: "array",
            kind: "field_referenced",
            length_field: "header.payload_size",
            items: { type: "uint8" }
          }
        ]
      },
      "MessageList": {
        sequence: [
          {
            name: "messages",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "Message" }
          }
        ]
      }
    }
  },
  test_type: "MessageList",
  test_cases: [
    {
      description: "Array of messages, each header references message's payload",
      value: {
        messages: [
          {
            msg_id: 1,
            header: {},
            payload: [0xAA, 0xBB]
          },
          {
            msg_id: 2,
            header: {},
            payload: [0xCC, 0xDD, 0xEE]
          }
        ]
      },
      decoded_value: {
        messages: [
          {
            msg_id: 1,
            header: { payload_size: 2 },
            payload: [0xAA, 0xBB]
          },
          {
            msg_id: 2,
            header: { payload_size: 3 },
            payload: [0xCC, 0xDD, 0xEE]
          }
        ]
      },
      bytes: [
        // messages[0]
        1,        // msg_id
        2, 0,     // header.payload_size = 2
        0xAA, 0xBB,

        // messages[1]
        2,        // msg_id
        3, 0,     // header.payload_size = 3
        0xCC, 0xDD, 0xEE
      ]
    }
  ]
});

/**
 * Test: Context preserves parent stack across array boundaries
 *
 * Nested structure: Outer has array of Middle, Middle has Inner.
 * Inner should be able to access Outer's fields via ../../
 */
export const contextPreservesParentStackAcrossArraysTestSuite = defineTestSuite({
  name: "context_extension_parent_stack_across_arrays",
  description: "Parent stack preserved when arrays are in the nesting path",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Inner": {
        sequence: [
          {
            name: "outer_ref",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../../outer_value"  // Navigate through array to outer
            }
          }
        ]
      },
      "Middle": {
        sequence: [
          { name: "middle_id", type: "uint8" },
          { name: "inner", type: "Inner" }
        ]
      },
      "Outer": {
        sequence: [
          { name: "outer_value", type: "uint8" },
          {
            name: "middles",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "Middle" }
          }
        ]
      }
    }
  },
  test_type: "Outer",
  test_cases: [
    {
      description: "Inner accesses outer_value through array boundary",
      value: {
        outer_value: 99,
        middles: [
          { middle_id: 1, inner: {} },
          { middle_id: 2, inner: {} }
        ]
      },
      decoded_value: {
        outer_value: 99,
        middles: [
          { middle_id: 1, inner: { outer_ref: 99 } },
          { middle_id: 2, inner: { outer_ref: 99 } }
        ]
      },
      bytes: [
        99,  // outer_value

        // middles[0]
        1,   // middle_id
        99,  // inner.outer_ref

        // middles[1]
        2,   // middle_id
        99   // inner.outer_ref
      ]
    }
  ]
});
