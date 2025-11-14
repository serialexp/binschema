// ABOUTME: Validation test for const + computed mutual exclusivity
// ABOUTME: Tests that Zod schema rejects fields with both const and computed

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Field cannot have both const and computed (enforced by Zod union)
 * This should fail at schema parse time, not validation time
 */
export const constAndComputedMutuallyExclusiveTestSuite = defineTestSuite({
  name: "error_const_and_computed_both_present",
  description: "Field cannot have both const and computed (mutual exclusivity enforced by schema)",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "BadType": {
        sequence: [
          {
            name: "bad_field",
            type: "uint32",
            const: 0x12345678,  // Has const
            computed: {          // AND computed - should be rejected!
              type: "length_of",
              target: "other_field"
            }
          },
          {
            name: "other_field",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "uint8" }
          }
        ]
      }
    }
  },
  test_type: "BadType",
  schema_validation_error: true,
  error_message: "Invalid"  // Zod will reject at parse time with its own error message
});
