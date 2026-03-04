/**
 * Tests for bytes type (raw byte arrays)
 *
 * Wire format: Identical to array<uint8>.
 * Sugar that removes the need for items: { type: "uint8" } boilerplate.
 */

import { defineTestSuite } from "../../schema/test-schema.js";

export const bytesFixedTestSuite = defineTestSuite({
  name: "bytes_fixed",
  description: "Fixed-length byte arrays",
  schema: {
    types: {
      "FixedBytes": {
        sequence: [
          { name: "data", type: "bytes", kind: "fixed", length: 4 }
        ]
      }
    }
  },
  test_type: "FixedBytes",
  test_cases: [
    {
      description: "All zeros",
      value: { data: [0x00, 0x00, 0x00, 0x00] },
      bytes: [0x00, 0x00, 0x00, 0x00],
    },
    {
      description: "Sequential values",
      value: { data: [0x01, 0x02, 0x03, 0x04] },
      bytes: [0x01, 0x02, 0x03, 0x04],
    },
    {
      description: "All 0xFF",
      value: { data: [0xFF, 0xFF, 0xFF, 0xFF] },
      bytes: [0xFF, 0xFF, 0xFF, 0xFF],
    },
  ]
});

export const bytesLengthPrefixedUint8TestSuite = defineTestSuite({
  name: "bytes_length_prefixed_uint8",
  description: "Length-prefixed byte arrays with uint8 length",
  schema: {
    types: {
      "LengthPrefixedBytes": {
        sequence: [
          { name: "data", type: "bytes", kind: "length_prefixed", length_type: "uint8" }
        ]
      }
    }
  },
  test_type: "LengthPrefixedBytes",
  test_cases: [
    {
      description: "Empty bytes",
      value: { data: [] },
      bytes: [0x00],
    },
    {
      description: "Single byte",
      value: { data: [0x42] },
      bytes: [0x01, 0x42],
    },
    {
      description: "Multiple bytes",
      value: { data: [0xDE, 0xAD, 0xBE, 0xEF] },
      bytes: [0x04, 0xDE, 0xAD, 0xBE, 0xEF],
    },
  ]
});

export const bytesLengthPrefixedUint16TestSuite = defineTestSuite({
  name: "bytes_length_prefixed_uint16",
  description: "Length-prefixed byte arrays with uint16 length",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "LengthPrefixedBytes16": {
        sequence: [
          { name: "data", type: "bytes", kind: "length_prefixed", length_type: "uint16" }
        ]
      }
    }
  },
  test_type: "LengthPrefixedBytes16",
  test_cases: [
    {
      description: "Empty bytes with uint16 length",
      value: { data: [] },
      bytes: [0x00, 0x00],
    },
    {
      description: "Three bytes with uint16 length",
      value: { data: [0x01, 0x02, 0x03] },
      bytes: [0x00, 0x03, 0x01, 0x02, 0x03],
    },
  ]
});

export const bytesFieldReferencedTestSuite = defineTestSuite({
  name: "bytes_field_referenced",
  description: "Field-referenced byte arrays",
  schema: {
    types: {
      "FieldReferencedBytes": {
        sequence: [
          { name: "length", type: "uint8" },
          { name: "data", type: "bytes", kind: "field_referenced", length_field: "length" },
        ]
      }
    }
  },
  test_type: "FieldReferencedBytes",
  test_cases: [
    {
      description: "Empty data with zero length",
      value: { length: 0, data: [] },
      bytes: [0x00],
    },
    {
      description: "Three bytes referenced by length field",
      value: { length: 3, data: [0xAA, 0xBB, 0xCC] },
      bytes: [0x03, 0xAA, 0xBB, 0xCC],
    },
  ]
});

export const bytesWithOtherFieldsTestSuite = defineTestSuite({
  name: "bytes_with_other_fields",
  description: "Bytes mixed with other field types",
  schema: {
    types: {
      "BytesMixed": {
        sequence: [
          { name: "header", type: "uint8" },
          { name: "payload", type: "bytes", kind: "length_prefixed", length_type: "uint8" },
          { name: "checksum", type: "uint8" },
        ]
      }
    }
  },
  test_type: "BytesMixed",
  test_cases: [
    {
      description: "Header, payload, checksum",
      value: { header: 0x01, payload: [0x10, 0x20], checksum: 0xFF },
      bytes: [0x01, 0x02, 0x10, 0x20, 0xFF],
    },
    {
      description: "Empty payload",
      value: { header: 0x02, payload: [], checksum: 0x00 },
      bytes: [0x02, 0x00, 0x00],
    },
  ]
});
