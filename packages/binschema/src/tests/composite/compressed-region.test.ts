import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Compressed regions via the `compressed` wrapper type.
 *
 * A `compressed` field is a PURE WIRE TRANSFORM on a byte region: the logical
 * value is the inner type on BOTH sides. Encode serializes `value_type` to a
 * buffer, runs it through the named codec, and writes
 *   [uncompressed_size: size_type][compressed_length: length_type][compressed_bytes…]
 * Decode reads the two sizes, reads `compressed_length` bytes, decompresses
 * (asserting the result is `uncompressed_size` bytes), and parses the inner
 * type over the decompressed buffer. The two size fields are CONSUMED FRAMING
 * (like an array length prefix) — they do NOT appear in the decoded value, so
 * `value === decoded_value` and the decoded value is just the inner type.
 *
 * `store`, `deflate`, and `gzip` are built-in codecs (no injection needed).
 * `store` is the identity codec (compressed bytes == inner bytes), which makes
 * the framing fully deterministic and identical across all four languages, so
 * the byte-pinned suites below use it. Real `deflate` output is not byte-stable
 * across implementations/levels, so its suite is `round_trip_only` (encode →
 * decode == value, no byte assertion).
 */

// --- Suite 1: store codec, named struct inner, default uint32 size fields ---
// Inner { a: uint16, b: uint8 } big-endian; value { a: 0x1234, b: 0x56 }
//   inner bytes        = [0x12, 0x34, 0x56]            (len 3)
//   store(inner)       = [0x12, 0x34, 0x56]            (len 3)
//   uncompressed_size  = 3 as uint32 BE = 00 00 00 03
//   compressed_length  = 3 as uint32 BE = 00 00 00 03
export const compressedStoreStructTestSuite = defineTestSuite({
  name: "compressed_store_struct",
  description: "compressed wrapper with store codec over a named struct (default uint32 framing)",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Inner": {
        sequence: [
          { name: "a", type: "uint16" },
          { name: "b", type: "uint8" },
        ],
      },
      "Wrapper": {
        sequence: [
          { name: "payload", type: "compressed", codec: "store", value_type: "Inner" },
        ],
      },
    },
  },

  test_type: "Wrapper",

  test_cases: [
    {
      description: "store codec: framing wraps the raw inner bytes unchanged",
      value: { payload: { a: 0x1234, b: 0x56 } },
      bytes: [0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x03, 0x12, 0x34, 0x56],
    },
  ],
});

// --- Suite 2: store codec, configurable uint16 size + length fields ---------
// Same inner; size_type and length_type narrowed to uint16.
//   uncompressed_size = 3 as uint16 BE = 00 03
//   compressed_length = 3 as uint16 BE = 00 03
export const compressedStoreUint16FramingTestSuite = defineTestSuite({
  name: "compressed_store_uint16_framing",
  description: "compressed wrapper with store codec and uint16 size/length framing",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Inner": {
        sequence: [
          { name: "a", type: "uint16" },
          { name: "b", type: "uint8" },
        ],
      },
      "Wrapper": {
        sequence: [
          {
            name: "payload",
            type: "compressed",
            codec: "store",
            value_type: "Inner",
            size_type: "uint16",
            length_type: "uint16",
          },
        ],
      },
    },
  },

  test_type: "Wrapper",

  test_cases: [
    {
      description: "uint16 framing: 2-byte size + 2-byte length prefixes",
      value: { payload: { a: 0x1234, b: 0x56 } },
      bytes: [0x00, 0x03, 0x00, 0x03, 0x12, 0x34, 0x56],
    },
  ],
});

// --- Suite 3: store codec, single-field inner (edge: 1-byte payload) ---------
export const compressedStoreSingleFieldTestSuite = defineTestSuite({
  name: "compressed_store_single_field",
  description: "compressed wrapper with store codec over a 1-byte inner struct",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Tiny": {
        sequence: [
          { name: "x", type: "uint8" },
        ],
      },
      "Wrapper": {
        sequence: [
          { name: "payload", type: "compressed", codec: "store", value_type: "Tiny" },
        ],
      },
    },
  },

  test_type: "Wrapper",

  test_cases: [
    {
      description: "single byte inner: size=1, length=1, blob=[0xAB]",
      value: { payload: { x: 0xAB } },
      bytes: [0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0xAB],
    },
  ],
});

// --- Suite 4: real deflate codec, round-trip only (no byte pinning) ---------
// Deflate output is not byte-stable across languages/levels, so we only assert
// encode → decode == value. Proves the real codec integrates end-to-end.
export const compressedDeflateRoundTripTestSuite = defineTestSuite({
  name: "compressed_deflate_round_trip",
  description: "compressed wrapper with real deflate codec (round-trip only)",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "Inner": {
        sequence: [
          { name: "a", type: "uint16" },
          { name: "b", type: "uint8" },
        ],
      },
      "Wrapper": {
        sequence: [
          { name: "payload", type: "compressed", codec: "deflate", value_type: "Inner" },
        ],
      },
    },
  },

  test_type: "Wrapper",

  test_cases: [
    {
      description: "deflate round-trip: encode then decode reproduces the value",
      value: { payload: { a: 0x1234, b: 0x56 } },
      round_trip_only: true,
    },
  ],
});
