// ABOUTME: Tests for nested array context tracking
// ABOUTME: Validates context properly extends through multiple array nesting levels

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Array inside another array
 *
 * Outer array contains items, each item has an inner array.
 * Context must track both array iteration states independently.
 */
export const nestedArraysTestSuite = defineTestSuite({
  name: "context_nested_arrays",
  description: "Array of items, each item contains an inner array",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Item": {
        sequence: [
          { name: "id", type: "uint8" },
          {
            name: "values",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "uint8" }
          }
        ]
      },
      "Group": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "Item" }
          }
        ]
      }
    }
  },
  test_type: "Group",
  test_cases: [
    {
      description: "Nested arrays encode/decode correctly",
      value: {
        items: [
          { id: 1, values: [10, 20] },
          { id: 2, values: [30, 40] }
        ]
      },
      bytes: [
        // items[0]
        1, 10, 20,
        // items[1]
        2, 30, 40
      ]
    }
  ]
});

/**
 * Test: Inner array element referencing outer array
 *
 * Element in inner array needs to reference the outer array iteration context.
 * Uses ../../outerArray[same_index<Type>] pattern.
 */
export const innerReferencesOuterArrayTestSuite = defineTestSuite({
  name: "context_inner_references_outer_array",
  description: "Inner array element references outer array via ../../",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "OuterData": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "value", type: "uint8" }
        ]
      },
      "InnerRef": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "outer_value",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../../outer_items[same_index<OuterData>].value"
            }
          }
        ]
      },
      "Container": {
        sequence: [
          {
            name: "outer_items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "OuterData" },
                { type: "InnerRef" }
              ]
            }
          },
          {
            name: "inner_refs",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "InnerRef" }
          }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "Inner array elements reference outer array via ../../",
      value: {
        outer_items: [
          { type: "OuterData", value: 100 },
          { type: "OuterData", value: 200 }
        ],
        inner_refs: [
          {},  // References outer_items[0]
          {}   // References outer_items[1]
        ]
      },
      decoded_value: {
        outer_items: [
          { type: "OuterData", type_tag: 0x01, value: 100 },
          { type: "OuterData", type_tag: 0x01, value: 200 }
        ],
        inner_refs: [
          { type_tag: 0x02, outer_value: 100 },  // Copied from outer_items[0]
          { type_tag: 0x02, outer_value: 200 }   // Copied from outer_items[1]
        ]
      },
      bytes: [
        // outer_items[0]: OuterData
        0x01, 100,

        // outer_items[1]: OuterData
        0x01, 200,

        // inner_refs[0]: InnerRef
        0x02, 100,  // outer_value = 100 (from outer_items[0])

        // inner_refs[1]: InnerRef
        0x02, 200   // outer_value = 200 (from outer_items[1])
      ]
    }
  ]
});

/**
 * Test: Multiple nested array levels (3-level nesting)
 *
 * Root → Groups → Items → Values
 * Deep nesting requires proper context stack tracking.
 */
export const threeLevelNestedArraysTestSuite = defineTestSuite({
  name: "context_three_level_nested_arrays",
  description: "Three levels of nested arrays with proper context tracking",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Value": {
        sequence: [
          { name: "data", type: "uint8" }
        ]
      },
      "Item": {
        sequence: [
          { name: "item_id", type: "uint8" },
          {
            name: "values",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "Value" }
          }
        ]
      },
      "Group": {
        sequence: [
          { name: "group_id", type: "uint8" },
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "Item" }
          }
        ]
      },
      "Root": {
        sequence: [
          {
            name: "groups",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "Group" }
          }
        ]
      }
    }
  },
  test_type: "Root",
  test_cases: [
    {
      description: "Three-level nesting: groups[].items[].values[]",
      value: {
        groups: [
          {
            group_id: 10,
            items: [
              { item_id: 1, values: [{ data: 11 }, { data: 12 }] },
              { item_id: 2, values: [{ data: 13 }, { data: 14 }] }
            ]
          },
          {
            group_id: 20,
            items: [
              { item_id: 3, values: [{ data: 21 }, { data: 22 }] },
              { item_id: 4, values: [{ data: 23 }, { data: 24 }] }
            ]
          }
        ]
      },
      bytes: [
        // groups[0]
        10,
          // items[0]
          1, 11, 12,
          // items[1]
          2, 13, 14,

        // groups[1]
        20,
          // items[0]
          3, 21, 22,
          // items[1]
          4, 23, 24
      ]
    }
  ]
});

/**
 * Test: Deep nesting with cross-references
 *
 * Inner nested structure references outer array elements.
 * Tests context navigation with multiple parent levels.
 */
export const deepNestingCrossReferenceTestSuite = defineTestSuite({
  name: "context_deep_nesting_cross_reference",
  description: "Deeply nested structure references outer array elements",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "DataNode": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xDA },
          { name: "node_id", type: "uint8" },
          { name: "size", type: "uint8" }
        ]
      },
      "RefNode": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x52 },  // ASCII 'R'
          {
            name: "target_size",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "../../../root_nodes[same_index<DataNode>].size"
            }
          }
        ]
      },
      "InnerContainer": {
        sequence: [
          {
            name: "refs",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "RefNode" }
          }
        ]
      },
      "MiddleContainer": {
        sequence: [
          { name: "middle_id", type: "uint8" },
          { name: "inner", type: "InnerContainer" }
        ]
      },
      "OuterContainer": {
        sequence: [
          {
            name: "root_nodes",
            type: "array",
            kind: "fixed",
            length: 2,
            items: {
              type: "choice",
              choices: [
                { type: "DataNode" },
                { type: "RefNode" }
              ]
            }
          },
          { name: "middle", type: "MiddleContainer" }
        ]
      }
    }
  },
  test_type: "OuterContainer",
  test_cases: [
    {
      description: "RefNode in deep nesting references root_nodes via ../../../",
      value: {
        root_nodes: [
          { type: "DataNode", node_id: 1, size: 50 },
          { type: "DataNode", node_id: 2, size: 75 }
        ],
        middle: {
          middle_id: 99,
          inner: {
            refs: [
              {},  // References root_nodes[0]
              {}   // References root_nodes[1]
            ]
          }
        }
      },
      decoded_value: {
        root_nodes: [
          { type: "DataNode", type_tag: 0xDA, node_id: 1, size: 50 },
          { type: "DataNode", type_tag: 0xDA, node_id: 2, size: 75 }
        ],
        middle: {
          middle_id: 99,
          inner: {
            refs: [
              { type_tag: 0x52, target_size: 50 },  // From root_nodes[0].size
              { type_tag: 0x52, target_size: 75 }   // From root_nodes[1].size
            ]
          }
        }
      },
      bytes: [
        // root_nodes[0]: DataNode
        0xDA, 1, 50,

        // root_nodes[1]: DataNode
        0xDA, 2, 75,

        // middle.middle_id
        99,

        // middle.inner.refs[0]
        0x52, 50,  // target_size = 50

        // middle.inner.refs[1]
        0x52, 75   // target_size = 75
      ]
    }
  ]
});

/**
 * Test: Sibling arrays with cross-references
 *
 * Two arrays at the same nesting level, one references the other.
 * Tests context properly tracks sibling array state.
 */
export const siblingArrayCrossReferenceTestSuite = defineTestSuite({
  name: "context_sibling_array_cross_reference",
  description: "Array references elements from sibling array",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "Primary": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "primary_value", type: "uint16" }
        ]
      },
      "Secondary": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "ref_value",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../primaries[same_index<Primary>].primary_value"
            }
          }
        ]
      },
      "TwoArrays": {
        sequence: [
          {
            name: "primaries",
            type: "array",
            kind: "fixed",
            length: 3,
            items: {
              type: "choice",
              choices: [
                { type: "Primary" },
                { type: "Secondary" }
              ]
            }
          },
          {
            name: "secondaries",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "Secondary" }
          }
        ]
      }
    }
  },
  test_type: "TwoArrays",
  test_cases: [
    {
      description: "Secondaries array references primaries array elements",
      value: {
        primaries: [
          { type: "Primary", primary_value: 1000 },
          { type: "Primary", primary_value: 2000 },
          { type: "Primary", primary_value: 3000 }
        ],
        secondaries: [
          {},  // References primaries[0]
          {},  // References primaries[1]
          {}   // References primaries[2]
        ]
      },
      decoded_value: {
        primaries: [
          { type: "Primary", type_tag: 0x01, primary_value: 1000 },
          { type: "Primary", type_tag: 0x01, primary_value: 2000 },
          { type: "Primary", type_tag: 0x01, primary_value: 3000 }
        ],
        secondaries: [
          { type_tag: 0x02, ref_value: 1000 },
          { type_tag: 0x02, ref_value: 2000 },
          { type_tag: 0x02, ref_value: 3000 }
        ]
      },
      bytes: [
        // primaries[0]
        0x01, 0xE8, 0x03,  // primary_value = 1000 (LE)

        // primaries[1]
        0x01, 0xD0, 0x07,  // primary_value = 2000 (LE)

        // primaries[2]
        0x01, 0xB8, 0x0B,  // primary_value = 3000 (LE)

        // secondaries[0]
        0x02, 0xE8, 0x03,  // ref_value = 1000

        // secondaries[1]
        0x02, 0xD0, 0x07,  // ref_value = 2000

        // secondaries[2]
        0x02, 0xB8, 0x0B   // ref_value = 3000
      ]
    }
  ]
});
