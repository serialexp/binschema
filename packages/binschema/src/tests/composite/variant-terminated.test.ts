/**
 * Variant-Terminated Array Tests
 *
 * Tests for arrays that are terminated by specific variant types.
 * Unlike null_terminated arrays (which end with a 0x00 byte OR a terminal variant),
 * variant_terminated arrays ONLY end when a terminal variant is encountered.
 *
 * Use cases:
 * - PNG chunks (ends with IEND chunk)
 * - Protocol messages with explicit "end" markers
 * - TLV sequences with "end" type
 */

import { defineTestSuite } from "../../schema/test-schema.js";

// Basic variant-terminated array: items end when EndMarker is encountered
export const variantTerminatedBasicTestSuite = defineTestSuite({
  name: "variant_terminated_basic",
  description: "Basic variant-terminated array with simple items",

  schema: {
    config: {
      endianness: "big_endian"
    },
    types: {
      "DataItem": {
        sequence: [
          { name: "value", type: "uint8" }
        ]
      },
      "EndMarker": {
        sequence: [
          { name: "code", type: "uint8", const: 0xFF }
        ]
      },
      "ItemOrEnd": {
        type: "discriminated_union",
        discriminator: {
          peek: "uint8"
        },
        variants: [
          { type: "EndMarker", when: "value === 0xFF" },
          { type: "DataItem", when: "value !== 0xFF" }
        ]
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "variant_terminated",
            terminal_variants: ["EndMarker"],
            items: { type: "ItemOrEnd" }
          }
        ]
      }
    }
  },

  test_type: "Container",

  test_cases: [
    {
      description: "Single data item followed by end marker",
      bytes: [0x42, 0xFF],
      // For discriminated unions with sequence variants, structure is:
      // { type: "VariantName", value: { <sequence fields> } }
      value: {
        items: [
          { type: "DataItem", value: { value: 0x42 } },
          { type: "EndMarker", value: { code: 0xFF } }
        ]
      }
    },
    {
      description: "Multiple data items followed by end marker",
      bytes: [0x01, 0x02, 0x03, 0xFF],
      value: {
        items: [
          { type: "DataItem", value: { value: 0x01 } },
          { type: "DataItem", value: { value: 0x02 } },
          { type: "DataItem", value: { value: 0x03 } },
          { type: "EndMarker", value: { code: 0xFF } }
        ]
      }
    },
    {
      description: "Only end marker (empty data)",
      bytes: [0xFF],
      value: {
        items: [
          { type: "EndMarker", value: { code: 0xFF } }
        ]
      }
    }
  ]
});

// Multiple terminal variants: array can end with different end markers
export const variantTerminatedMultipleEndTestSuite = defineTestSuite({
  name: "variant_terminated_multiple_end",
  description: "Variant-terminated array with multiple possible terminal variants",

  schema: {
    config: {
      endianness: "big_endian"
    },
    types: {
      "DataItem": {
        sequence: [
          { name: "tag", type: "uint8", const: 0x01 },
          { name: "value", type: "uint16" }
        ]
      },
      "EndSuccess": {
        sequence: [
          { name: "tag", type: "uint8", const: 0xFE },
          { name: "checksum", type: "uint8" }
        ]
      },
      "EndError": {
        sequence: [
          { name: "tag", type: "uint8", const: 0xFF },
          { name: "error_code", type: "uint8" }
        ]
      },
      "Message": {
        type: "discriminated_union",
        discriminator: {
          peek: "uint8"
        },
        variants: [
          { type: "DataItem", when: "value === 0x01" },
          { type: "EndSuccess", when: "value === 0xFE" },
          { type: "EndError", when: "value === 0xFF" }
        ]
      },
      "MessageStream": {
        sequence: [
          {
            name: "messages",
            type: "array",
            kind: "variant_terminated",
            terminal_variants: ["EndSuccess", "EndError"],
            items: { type: "Message" }
          }
        ]
      }
    }
  },

  test_type: "MessageStream",

  test_cases: [
    {
      description: "Data items ending with success marker",
      bytes: [0x01, 0x00, 0x0A, 0x01, 0x00, 0x14, 0xFE, 0x55],
      value: {
        messages: [
          { type: "DataItem", value: { tag: 0x01, value: 10 } },
          { type: "DataItem", value: { tag: 0x01, value: 20 } },
          { type: "EndSuccess", value: { tag: 0xFE, checksum: 0x55 } }
        ]
      }
    },
    {
      description: "Data items ending with error marker",
      bytes: [0x01, 0x00, 0x05, 0xFF, 0x03],
      value: {
        messages: [
          { type: "DataItem", value: { tag: 0x01, value: 5 } },
          { type: "EndError", value: { tag: 0xFF, error_code: 3 } }
        ]
      }
    },
    {
      description: "Immediate error (no data)",
      bytes: [0xFF, 0x01],
      value: {
        messages: [
          { type: "EndError", value: { tag: 0xFF, error_code: 1 } }
        ]
      }
    }
  ]
});

// PNG-style chunks: variable-size items ending with specific type
export const variantTerminatedPngChunksTestSuite = defineTestSuite({
  name: "variant_terminated_png_chunks",
  description: "PNG-style chunks with variable-size data, ending with IEND-like marker",

  schema: {
    config: {
      endianness: "big_endian"
    },
    types: {
      "DataChunk": {
        sequence: [
          { name: "chunk_type", type: "uint8", const: 0x01 },
          { name: "length", type: "uint8", computed: { type: "length_of", target: "data" } },
          { name: "data", type: "array", kind: "field_referenced", length_field: "length", items: { type: "uint8" } }
        ]
      },
      "EndChunk": {
        sequence: [
          { name: "chunk_type", type: "uint8", const: 0x00 }
        ]
      },
      "Chunk": {
        type: "discriminated_union",
        discriminator: {
          peek: "uint8"
        },
        variants: [
          { type: "EndChunk", when: "value === 0x00" },
          { type: "DataChunk", when: "value !== 0x00" }
        ]
      },
      "ChunkStream": {
        sequence: [
          {
            name: "chunks",
            type: "array",
            kind: "variant_terminated",
            terminal_variants: ["EndChunk"],
            items: { type: "Chunk" }
          }
        ]
      }
    }
  },

  test_type: "ChunkStream",

  test_cases: [
    {
      description: "Two data chunks followed by end chunk",
      bytes: [
        0x01, 0x03, 0xAA, 0xBB, 0xCC,  // DataChunk: chunk_type=0x01, length=3, data=[AA, BB, CC]
        0x01, 0x02, 0x11, 0x22,        // DataChunk: chunk_type=0x01, length=2, data=[11, 22]
        0x00                           // EndChunk: chunk_type=0x00
      ],
      value: {
        chunks: [
          { type: "DataChunk", value: { data: [0xAA, 0xBB, 0xCC] } },
          { type: "DataChunk", value: { data: [0x11, 0x22] } },
          { type: "EndChunk", value: {} }
        ]
      },
      decoded_value: {
        chunks: [
          { type: "DataChunk", value: { chunk_type: 0x01, length: 3, data: [0xAA, 0xBB, 0xCC] } },
          { type: "DataChunk", value: { chunk_type: 0x01, length: 2, data: [0x11, 0x22] } },
          { type: "EndChunk", value: { chunk_type: 0x00 } }
        ]
      }
    },
    {
      description: "Empty stream with just end chunk",
      bytes: [0x00],
      value: {
        chunks: [
          { type: "EndChunk", value: {} }
        ]
      },
      decoded_value: {
        chunks: [
          { type: "EndChunk", value: { chunk_type: 0x00 } }
        ]
      }
    }
  ]
});
