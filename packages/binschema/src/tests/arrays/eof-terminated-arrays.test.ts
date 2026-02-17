// ABOUTME: Test arrays that read elements until end of stream
// ABOUTME: Arrays with "kind": "eof_terminated" consume remaining bytes

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * EOF-terminated arrays read elements until the decoder reaches
 * the end of the byte stream. No length prefix, no terminator value.
 *
 * Use case: trailing variable-length data in command envelopes,
 * PNG chunks list, container formats where payload fills remaining space.
 *
 * Wire format: Just elements, back-to-back, until end of input.
 */

/**
 * Simple case: eof_terminated array of uint8 (raw trailing bytes)
 */
export const eofTerminatedBytesTestSuite = defineTestSuite({
  name: "eof_terminated_bytes",
  description: "EOF-terminated array of bytes (trailing raw data)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Envelope": {
        sequence: [
          { name: "command", type: "uint8" },
          {
            name: "payload",
            type: "array",
            kind: "eof_terminated",
            items: { type: "uint8" }
          }
        ]
      }
    }
  },
  test_type: "Envelope",
  test_cases: [
    {
      description: "Command with empty payload",
      bytes: [0x01],
      value: { command: 1, payload: [] }
    },
    {
      description: "Command with single byte payload",
      bytes: [0x01, 0xFF],
      value: { command: 1, payload: [0xFF] }
    },
    {
      description: "Command with multi-byte payload",
      bytes: [0x42, 0xDE, 0xAD, 0xBE, 0xEF],
      value: { command: 0x42, payload: [0xDE, 0xAD, 0xBE, 0xEF] }
    }
  ]
});

/**
 * EOF-terminated array of uint16 values
 */
export const eofTerminatedUint16TestSuite = defineTestSuite({
  name: "eof_terminated_uint16",
  description: "EOF-terminated array of uint16 values",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "U16List": {
        sequence: [
          { name: "header", type: "uint8" },
          {
            name: "values",
            type: "array",
            kind: "eof_terminated",
            items: { type: "uint16" }
          }
        ]
      }
    }
  },
  test_type: "U16List",
  test_cases: [
    {
      description: "Empty value list",
      bytes: [0x01],
      value: { header: 1, values: [] }
    },
    {
      description: "Two uint16 values",
      bytes: [0x01, 0x00, 0x0A, 0x00, 0x14],
      value: { header: 1, values: [10, 20] }
    }
  ]
});

/**
 * EOF-terminated array of structs
 */
export const eofTerminatedStructsTestSuite = defineTestSuite({
  name: "eof_terminated_structs",
  description: "EOF-terminated array of structs (variable-length record list)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Record": {
        sequence: [
          { name: "id", type: "uint8" },
          { name: "value", type: "uint16" }
        ]
      },
      "RecordFile": {
        sequence: [
          { name: "version", type: "uint8" },
          {
            name: "records",
            type: "array",
            kind: "eof_terminated",
            items: { type: "Record" }
          }
        ]
      }
    }
  },
  test_type: "RecordFile",
  test_cases: [
    {
      description: "No records (just version byte)",
      bytes: [0x01],
      value: { version: 1, records: [] }
    },
    {
      description: "Single record",
      bytes: [0x01, 0x0A, 0x01, 0x00],
      value: { version: 1, records: [{ id: 10, value: 256 }] }
    },
    {
      description: "Multiple records fill remaining bytes",
      bytes: [
        0x02,             // version = 2
        0x01, 0x00, 0x0A, // record 0: id=1, value=10
        0x02, 0x00, 0x14, // record 1: id=2, value=20
        0x03, 0x00, 0x1E, // record 2: id=3, value=30
      ],
      value: {
        version: 2,
        records: [
          { id: 1, value: 10 },
          { id: 2, value: 20 },
          { id: 3, value: 30 }
        ]
      }
    }
  ]
});
