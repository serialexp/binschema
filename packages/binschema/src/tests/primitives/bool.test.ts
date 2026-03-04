/**
 * Tests for bool type (boolean field)
 *
 * Wire format: Single byte, 0x00 = false, 0x01 = true
 * Sugar over uint8 with boolean semantics in generated code.
 */

import { defineTestSuite } from "../../schema/test-schema.js";

export const boolBasicTestSuite = defineTestSuite({
  name: "bool_basic",
  description: "Basic boolean type",
  schema: {
    types: {
      "BoolValue": {
        sequence: [
          { name: "flag", type: "bool" }
        ]
      }
    }
  },
  test_type: "BoolValue",
  test_cases: [
    {
      description: "False value",
      value: { flag: false },
      bytes: [0x00],
    },
    {
      description: "True value",
      value: { flag: true },
      bytes: [0x01],
    },
  ]
});

export const boolMultipleTestSuite = defineTestSuite({
  name: "bool_multiple",
  description: "Multiple boolean fields in a struct",
  schema: {
    types: {
      "BoolFlags": {
        sequence: [
          { name: "active", type: "bool" },
          { name: "visible", type: "bool" },
          { name: "locked", type: "bool" },
        ]
      }
    }
  },
  test_type: "BoolFlags",
  test_cases: [
    {
      description: "All false",
      value: { active: false, visible: false, locked: false },
      bytes: [0x00, 0x00, 0x00],
    },
    {
      description: "All true",
      value: { active: true, visible: true, locked: true },
      bytes: [0x01, 0x01, 0x01],
    },
    {
      description: "Mixed values",
      value: { active: true, visible: false, locked: true },
      bytes: [0x01, 0x00, 0x01],
    },
  ]
});

export const boolWithOtherFieldsTestSuite = defineTestSuite({
  name: "bool_with_other_fields",
  description: "Boolean fields mixed with other types",
  schema: {
    types: {
      "BoolMixed": {
        sequence: [
          { name: "version", type: "uint8" },
          { name: "enabled", type: "bool" },
          { name: "count", type: "uint16", endianness: "big_endian" },
        ]
      }
    }
  },
  test_type: "BoolMixed",
  test_cases: [
    {
      description: "Disabled with zero count",
      value: { version: 1, enabled: false, count: 0 },
      bytes: [0x01, 0x00, 0x00, 0x00],
    },
    {
      description: "Enabled with count",
      value: { version: 2, enabled: true, count: 256 },
      bytes: [0x02, 0x01, 0x01, 0x00],
    },
  ]
});

export const boolOptionalTestSuite = defineTestSuite({
  name: "bool_optional",
  description: "Boolean as optional value type",
  schema: {
    types: {
      "OptionalBool": {
        sequence: [
          { name: "flag", type: "optional", value_type: "bool" },
        ]
      }
    }
  },
  test_type: "OptionalBool",
  test_cases: [
    {
      description: "Absent boolean",
      value: { flag: undefined },
      bytes: [0x00],
    },
    {
      description: "Present false",
      value: { flag: false },
      bytes: [0x01, 0x00],
    },
    {
      description: "Present true",
      value: { flag: true },
      bytes: [0x01, 0x01],
    },
  ]
});
