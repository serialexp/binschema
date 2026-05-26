/**
 * End-to-end streaming codegen tests.
 *
 * Each suite below declares a schema with a stream-eligible wrapper struct
 * (a single length-prefixed array). The test runner picks up the
 * `chunkSizes` field and:
 *
 *   1. Enables `generate_streaming: true` when calling `generateTypeScript`.
 *   2. Generates code that includes both the synchronous decoder class and a
 *      `decode{TypeName}Stream` async generator.
 *   3. Replays the test bytes through a `ReadableStream` chunked according to
 *      `chunkSizes` and consumes the async generator.
 *   4. Compares the yielded items against the expected array on
 *      `testCase.value.{singleField}`.
 *
 * Sync encode/decode parity (no streaming) is also verified — each test case
 * runs through the standard `EncoderClass`/`DecoderClass` path.
 *
 * Coverage:
 *
 * - `length_prefixed` with primitive items (greedy mode, inline reads)
 * - `length_prefixed` with named-struct items (greedy mode, slice-based)
 * - `length_prefixed_items` with named-struct items (per-item-length mode)
 * - Worst-case chunk sizes (1 byte per chunk)
 * - Whole-array-in-one-chunk fast path
 * - Empty array
 */

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Greedy mode, primitive items.
 */
export const streamingCodegenPrimitiveTestSuite = defineTestSuite({
  name: "streaming_codegen_primitive_greedy",
  description: "Streaming codegen for length_prefixed uint32 array",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      Uint32List: {
        sequence: [
          {
            name: "values",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint8",
            items: { type: "uint32" },
          },
        ],
      },
    },
  },
  test_type: "Uint32List",
  test_cases: [
    {
      description: "Single chunk contains everything",
      value: { values: [0x11111111, 0x22222222, 0x33333333] },
      bytes: [
        0x03,
        0x11, 0x11, 0x11, 0x11,
        0x22, 0x22, 0x22, 0x22,
        0x33, 0x33, 0x33, 0x33,
      ],
      chunkSizes: [13],
    },
    {
      description: "One byte per chunk",
      value: { values: [0xAA_BB_CC_DD, 0x01020304] },
      bytes: [
        0x02,
        0xAA, 0xBB, 0xCC, 0xDD,
        0x01, 0x02, 0x03, 0x04,
      ],
      // 9 bytes -> 9 single-byte chunks
      chunkSizes: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    {
      description: "Empty array",
      value: { values: [] },
      bytes: [0x00],
      chunkSizes: [1],
    },
  ],
});

/**
 * Greedy mode, named-struct items with variable size (length-prefixed string).
 */
export const streamingCodegenGreedyStructTestSuite = defineTestSuite({
  name: "streaming_codegen_greedy_struct",
  description: "Streaming codegen for length_prefixed array of variable-length structs",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      Message: {
        sequence: [
          { name: "id", type: "uint32" },
          {
            name: "text",
            type: "string",
            kind: "length_prefixed",
            length_type: "uint8",
            encoding: "utf8",
          },
        ],
      },
      MessageArray: {
        sequence: [
          {
            name: "messages",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint16",
            items: { type: "Message" },
          },
        ],
      },
    },
  },
  test_type: "MessageArray",
  test_cases: [
    {
      description: "Two messages, whole stream in one chunk",
      value: {
        messages: [
          { id: 1, text: "hi" },
          { id: 2, text: "yo" },
        ],
      },
      bytes: [
        0x00, 0x02,
        0x00, 0x00, 0x00, 0x01, 0x02, 0x68, 0x69,
        0x00, 0x00, 0x00, 0x02, 0x02, 0x79, 0x6f,
      ],
      chunkSizes: [16],
    },
    {
      description: "Chunk boundary mid-struct",
      value: {
        messages: [
          { id: 0x12345678, text: "hello" },
        ],
      },
      bytes: [
        0x00, 0x01,
        0x12, 0x34, 0x56, 0x78,
        0x05,
        0x68, 0x65, 0x6c, 0x6c, 0x6f,
      ],
      // 12 bytes: split inside the struct (after array-length+1 ID byte)
      chunkSizes: [3, 9],
    },
    {
      description: "One byte per chunk",
      value: {
        messages: [
          { id: 7, text: "x" },
        ],
      },
      bytes: [
        0x00, 0x01,
        0x00, 0x00, 0x00, 0x07,
        0x01, 0x78,
      ],
      // 8 bytes -> 8 single-byte chunks
      chunkSizes: [1, 1, 1, 1, 1, 1, 1, 1],
    },
  ],
});

/**
 * Per-item-length mode (length_prefixed_items).
 */
export const streamingCodegenItemsTestSuite = defineTestSuite({
  name: "streaming_codegen_length_prefixed_items",
  description: "Streaming codegen for length_prefixed_items with per-item length prefix",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      Message: {
        sequence: [
          { name: "id", type: "uint32" },
          {
            name: "text",
            type: "string",
            kind: "length_prefixed",
            length_type: "uint8",
            encoding: "utf8",
          },
        ],
      },
      Framed: {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "length_prefixed_items",
            length_type: "uint16",
            item_length_type: "uint16",
            items: { type: "Message" },
          },
        ],
      },
    },
  },
  test_type: "Framed",
  test_cases: [
    {
      description: "Two framed items, single chunk",
      value: {
        items: [
          { id: 1, text: "hello" },
          { id: 2, text: "world" },
        ],
      },
      bytes: [
        0x00, 0x02,
        // Item 0 (id=1, text="hello") -> 4 + 1 + 5 = 10 bytes
        0x00, 0x0A,
        0x00, 0x00, 0x00, 0x01,
        0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f,
        // Item 1 (id=2, text="world") -> 10 bytes
        0x00, 0x0A,
        0x00, 0x00, 0x00, 0x02,
        0x05, 0x77, 0x6f, 0x72, 0x6c, 0x64,
      ],
      chunkSizes: [26],
    },
    {
      description: "Item length prefix split across chunks",
      value: {
        items: [{ id: 42, text: "ok" }],
      },
      bytes: [
        0x00, 0x01,
        0x00, 0x07,
        0x00, 0x00, 0x00, 0x2A,
        0x02, 0x6f, 0x6b,
      ],
      chunkSizes: [3, 8],
    },
    {
      description: "One byte per chunk",
      value: {
        items: [{ id: 99, text: "z" }],
      },
      bytes: [
        0x00, 0x01,
        0x00, 0x06,
        0x00, 0x00, 0x00, 0x63,
        0x01, 0x7a,
      ],
      // 10 bytes -> 10 single-byte chunks
      chunkSizes: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
  ],
});
