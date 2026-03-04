import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test suite for standalone enum type with uint8 repr
 */
export const standaloneEnumTestSuite = defineTestSuite({
  name: "standalone_enum",
  description: "Standalone enum type with uint8 repr",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "Direction": {
        type: "enum",
        repr: "uint8",
        variants: { "North": 0, "East": 1, "South": 2, "West": 3 }
      }
    }
  },

  test_type: "Direction",

  test_cases: [
    {
      description: "North (0)",
      value: 0,
      bytes: [0x00],
    },
    {
      description: "East (1)",
      value: 1,
      bytes: [0x01],
    },
    {
      description: "South (2)",
      value: 2,
      bytes: [0x02],
    },
    {
      description: "West (3)",
      value: 3,
      bytes: [0x03],
    },
  ]
});

/**
 * Test suite for enum used as a struct field
 */
export const enumStructFieldTestSuite = defineTestSuite({
  name: "enum_struct_field",
  description: "Enum type used as a struct field",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "Color": {
        type: "enum",
        repr: "uint8",
        variants: { "Red": 0, "Green": 1, "Blue": 2 }
      },
      "Pixel": {
        sequence: [
          { name: "x", type: "uint8" },
          { name: "y", type: "uint8" },
          { name: "color", type: "Color" },
        ]
      }
    }
  },

  test_type: "Pixel",

  test_cases: [
    {
      description: "Red pixel at origin",
      value: { x: 0, y: 0, color: 0 },
      bytes: [0x00, 0x00, 0x00],
    },
    {
      description: "Blue pixel at (10, 20)",
      value: { x: 10, y: 20, color: 2 },
      bytes: [0x0A, 0x14, 0x02],
    },
    {
      description: "Green pixel at (255, 128)",
      value: { x: 255, y: 128, color: 1 },
      bytes: [0xFF, 0x80, 0x01],
    },
  ]
});

/**
 * Test suite for enum with uint16 repr
 */
export const uint16EnumTestSuite = defineTestSuite({
  name: "uint16_enum",
  description: "Enum type with uint16 repr (big endian)",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "MessageType": {
        type: "enum",
        repr: "uint16",
        variants: { "Hello": 1, "Goodbye": 2, "Data": 256 }
      }
    }
  },

  test_type: "MessageType",

  test_cases: [
    {
      description: "Hello (1)",
      value: 1,
      bytes: [0x00, 0x01],
    },
    {
      description: "Goodbye (2)",
      value: 2,
      bytes: [0x00, 0x02],
    },
    {
      description: "Data (256)",
      value: 256,
      bytes: [0x01, 0x00],
    },
  ]
});

/**
 * Test suite for invalid enum value (decode error)
 */
export const invalidEnumValueTestSuite = defineTestSuite({
  name: "invalid_enum_value",
  description: "Decoding invalid enum value should error",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "Status": {
        type: "enum",
        repr: "uint8",
        variants: { "Active": 0, "Inactive": 1 }
      }
    }
  },

  test_type: "Status",

  test_cases: [
    {
      description: "Valid: Active (0)",
      value: 0,
      bytes: [0x00],
    },
    {
      description: "Valid: Inactive (1)",
      value: 1,
      bytes: [0x01],
    },
    {
      description: "Invalid value 99 should error",
      bytes: [0x63],
      should_error: true,
      error_message: "Invalid Status value",
    },
    {
      description: "Invalid value 255 should error",
      bytes: [0xFF],
      should_error: true,
      error_message: "Invalid Status value",
    },
  ]
});

/**
 * Test suite for non-contiguous enum values (gaps in numbering)
 */
export const nonContiguousEnumTestSuite = defineTestSuite({
  name: "non_contiguous_enum",
  description: "Enum with non-contiguous variant values",

  schema: {
    config: {
      endianness: "big_endian",
    },
    types: {
      "PlotType": {
        type: "enum",
        repr: "uint8",
        variants: { "Farm": 1, "Stockpile": 2, "Workshop": 5, "Barracks": 10 }
      }
    }
  },

  test_type: "PlotType",

  test_cases: [
    {
      description: "Farm (1)",
      value: 1,
      bytes: [0x01],
    },
    {
      description: "Stockpile (2)",
      value: 2,
      bytes: [0x02],
    },
    {
      description: "Workshop (5)",
      value: 5,
      bytes: [0x05],
    },
    {
      description: "Barracks (10)",
      value: 10,
      bytes: [0x0A],
    },
  ]
});

/**
 * Test suite for enum with uint16 repr in little endian
 */
export const littleEndianEnumTestSuite = defineTestSuite({
  name: "little_endian_enum",
  description: "Enum with uint16 repr in little endian",

  schema: {
    config: {
      endianness: "little_endian",
    },
    types: {
      "EventType": {
        type: "enum",
        repr: "uint16",
        variants: { "Click": 1, "Scroll": 2, "KeyPress": 0x0100 }
      }
    }
  },

  test_type: "EventType",

  test_cases: [
    {
      description: "Click (1) little endian",
      value: 1,
      bytes: [0x01, 0x00],
    },
    {
      description: "Scroll (2) little endian",
      value: 2,
      bytes: [0x02, 0x00],
    },
    {
      description: "KeyPress (256) little endian",
      value: 0x0100,
      bytes: [0x00, 0x01],
    },
  ]
});
