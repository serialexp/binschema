/**
 * Tests for VLQ (Variable Length Quantity) encoding
 *
 * VLQ is used in MIDI files and Git packfiles.
 * - MSB-first (big-endian), unlike LEB128 which is LSB-first
 * - 7 bits of data per byte
 * - MSB is continuation bit (1 = more bytes, 0 = last byte)
 * - Max 4 bytes (28 bits), max value 0x0FFFFFFF
 */

import { TestSuite } from "../../schema/test-schema.js";

export const vlqEncodingTestSuite: TestSuite = {
  name: "vlq_encoding",
  description: "VLQ (Variable Length Quantity) encoding used in MIDI files",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "VLQValue": {
        sequence: [
          { name: "value", type: "varlength", encoding: "vlq" }
        ]
      }
    }
  },
  test_type: "VLQValue",
  test_cases: [
    // 1-byte values (0-127)
    {
      description: "VLQ: 0 encodes as single byte 0x00",
      value: { value: 0 },
      bytes: [0x00]
    },
    {
      description: "VLQ: 1 encodes as single byte 0x01",
      value: { value: 1 },
      bytes: [0x01]
    },
    {
      description: "VLQ: 127 encodes as single byte 0x7F",
      value: { value: 127 },
      bytes: [0x7F]
    },

    // 2-byte values (128-16383)
    {
      description: "VLQ: 128 encodes as 0x81 0x00",
      value: { value: 128 },
      bytes: [0x81, 0x00]
    },
    {
      description: "VLQ: 255 encodes as 0x81 0x7F",
      value: { value: 255 },
      bytes: [0x81, 0x7F]
    },
    {
      description: "VLQ: 256 encodes as 0x82 0x00",
      value: { value: 256 },
      bytes: [0x82, 0x00]
    },
    {
      description: "VLQ: 16383 encodes as 0xFF 0x7F",
      value: { value: 16383 },
      bytes: [0xFF, 0x7F]
    },

    // 3-byte values (16384-2097151)
    {
      description: "VLQ: 16384 encodes as 0x81 0x80 0x00",
      value: { value: 16384 },
      bytes: [0x81, 0x80, 0x00]
    },
    {
      description: "VLQ: 2097151 encodes as 0xFF 0xFF 0x7F",
      value: { value: 2097151 },
      bytes: [0xFF, 0xFF, 0x7F]
    },

    // 4-byte values (2097152-268435455)
    {
      description: "VLQ: 2097152 encodes as 0x81 0x80 0x80 0x00",
      value: { value: 2097152 },
      bytes: [0x81, 0x80, 0x80, 0x00]
    },
    {
      description: "VLQ: max value 268435455 encodes as 0xFF 0xFF 0xFF 0x7F",
      value: { value: 268435455 },
      bytes: [0xFF, 0xFF, 0xFF, 0x7F]
    },

    // Common MIDI delta time values
    {
      description: "VLQ: 480 (quarter note at 480 PPQN) encodes as 0x83 0x60",
      value: { value: 480 },
      bytes: [0x83, 0x60]
    },
    {
      description: "VLQ: 960 (half note at 480 PPQN) encodes as 0x87 0x40",
      value: { value: 960 },
      bytes: [0x87, 0x40]
    },
    {
      description: "VLQ: 1920 (whole note at 480 PPQN) encodes as 0x8F 0x00",
      value: { value: 1920 },
      bytes: [0x8F, 0x00]
    }
  ]
};

export const vlqInStructTestSuite: TestSuite = {
  name: "vlq_in_struct",
  description: "VLQ encoding within larger structures (like MIDI events)",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "MIDIEvent": {
        description: "Simplified MIDI track event",
        sequence: [
          { name: "delta_time", type: "varlength", encoding: "vlq", description: "Ticks since last event" },
          { name: "status", type: "uint8", description: "Event status byte" },
          { name: "data1", type: "uint8", description: "First data byte" },
          { name: "data2", type: "uint8", description: "Second data byte" }
        ]
      }
    }
  },
  test_type: "MIDIEvent",
  test_cases: [
    {
      description: "Note On at time 0",
      value: { delta_time: 0, status: 0x90, data1: 60, data2: 100 },
      bytes: [0x00, 0x90, 60, 100]
    },
    {
      description: "Note Off at time 480 (quarter note)",
      value: { delta_time: 480, status: 0x80, data1: 60, data2: 64 },
      bytes: [0x83, 0x60, 0x80, 60, 64]
    },
    {
      description: "Note On at time 16384",
      value: { delta_time: 16384, status: 0x90, data1: 64, data2: 127 },
      bytes: [0x81, 0x80, 0x00, 0x90, 64, 127]
    }
  ]
};
