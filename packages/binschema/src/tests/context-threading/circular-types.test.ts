// ABOUTME: NOTE: Circular type tests disabled until cycle detection is implemented
// ABOUTME: See docs/SAME_INDEX_STANDALONE_ENCODER_ISSUE.md section on "Circular Type References"

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * NOTE: These tests are disabled because the current schema validator
 * rejects circular type dependencies.
 *
 * Per the context threading design doc, circular types will require:
 * 1. Adding visited set to schema analysis (analyzeContextRequirements)
 * 2. Breaking cycles by returning empty requirements when type is already being analyzed
 * 3. Standard cycle detection pattern
 *
 * When implementing context threading, these tests should be enabled
 * and the validator should be updated to allow conditional recursion.
 */

/**
 * Test: Simple non-recursive type for now
 *
 * Placeholder test to ensure this file is valid.
 * Replace with actual circular type tests once validator supports them.
 */
export const placeholderNonRecursiveTestSuite = defineTestSuite({
  name: "context_placeholder_non_recursive",
  description: "Placeholder test until circular types are supported",
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
      description: "Simple type (placeholder)",
      value: {
        value: 42
      },
      bytes: [42]
    }
  ]
});

// TODO: Add these tests when circular type support is implemented:
// - recursiveLinkedListTestSuite (Node contains optional Node)
// - mutualRecursionTreeTestSuite (TreeNode ↔ Branch)
// - recursiveWithComputedFieldsTestSuite (recursive + computed fields)
// - complexMutualRecursionTestSuite (Container ↔ Element with arrays)
