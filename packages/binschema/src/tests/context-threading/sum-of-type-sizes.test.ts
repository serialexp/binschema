// ABOUTME: Tests for sum_of_type_sizes computed field with context threading
// ABOUTME: Validates size tracking and type-filtered summation across arrays

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: Basic sum_of_type_sizes
 *
 * Computed field sums byte sizes of all elements of a specific type in an array.
 * Used in ZIP EndOfCentralDir to compute total central directory size.
 */
export const basicSumOfTypeSizesTestSuite = defineTestSuite({
  name: "context_sum_of_type_sizes_basic",
  description: "Computed field sums sizes of array elements by type",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "DataBlock": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "block_id", type: "uint8" },
          {
            name: "payload",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "uint8" }
          }
        ]
      },
      "IndexBlock": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          { name: "index_id", type: "uint16" }
        ]
      },
      "Summary": {
        sequence: [
          {
            name: "total_data_size",
            type: "uint32",
            computed: {
              type: "sum_of_type_sizes",
              target: "../blocks",
              element_type: "DataBlock"
            }
          },
          {
            name: "total_index_size",
            type: "uint32",
            computed: {
              type: "sum_of_type_sizes",
              target: "../blocks",
              element_type: "IndexBlock"
            }
          }
        ]
      },
      "Archive": {
        sequence: [
          {
            name: "blocks",
            type: "array",
            kind: "fixed",
            length: 4,
            items: {
              type: "choice",
              choices: [
                { type: "DataBlock" },
                { type: "IndexBlock" }
              ]
            }
          },
          { name: "summary", type: "Summary" }
        ]
      }
    }
  },
  test_type: "Archive",
  test_cases: [
    {
      description: "Sum sizes of DataBlock and IndexBlock separately",
      value: {
        blocks: [
          { type: "DataBlock", block_id: 1, payload: [0xAA, 0xBB, 0xCC] },
          { type: "IndexBlock", index_id: 100 },
          { type: "DataBlock", block_id: 2, payload: [0xDD, 0xEE, 0xFF] },
          { type: "IndexBlock", index_id: 200 }
        ],
        summary: {}
      },
      decoded_value: {
        blocks: [
          { type: "DataBlock", type_tag: 0x01, block_id: 1, payload: [0xAA, 0xBB, 0xCC] },
          { type: "IndexBlock", type_tag: 0x02, index_id: 100 },
          { type: "DataBlock", type_tag: 0x01, block_id: 2, payload: [0xDD, 0xEE, 0xFF] },
          { type: "IndexBlock", type_tag: 0x02, index_id: 200 }
        ],
        summary: {
          total_data_size: 10,   // 2 DataBlocks × 5 bytes each = 10
          total_index_size: 6    // 2 IndexBlocks × 3 bytes each = 6
        }
      },
      bytes: [
        // blocks[0]: DataBlock (5 bytes)
        0x01, 1, 0xAA, 0xBB, 0xCC,

        // blocks[1]: IndexBlock (3 bytes)
        0x02, 100, 0,  // index_id = 100 (LE)

        // blocks[2]: DataBlock (5 bytes)
        0x01, 2, 0xDD, 0xEE, 0xFF,

        // blocks[3]: IndexBlock (3 bytes)
        0x02, 200, 0,  // index_id = 200 (LE)

        // summary
        10, 0, 0, 0,   // total_data_size = 10
        6, 0, 0, 0     // total_index_size = 6
      ]
    },
    {
      description: "All blocks same type",
      value: {
        blocks: [
          { type: "DataBlock", block_id: 1, payload: [0x01, 0x02, 0x03] },
          { type: "DataBlock", block_id: 2, payload: [0x04, 0x05, 0x06] },
          { type: "DataBlock", block_id: 3, payload: [0x07, 0x08, 0x09] },
          { type: "DataBlock", block_id: 4, payload: [0x0A, 0x0B, 0x0C] }
        ],
        summary: {}
      },
      decoded_value: {
        blocks: [
          { type: "DataBlock", type_tag: 0x01, block_id: 1, payload: [0x01, 0x02, 0x03] },
          { type: "DataBlock", type_tag: 0x01, block_id: 2, payload: [0x04, 0x05, 0x06] },
          { type: "DataBlock", type_tag: 0x01, block_id: 3, payload: [0x07, 0x08, 0x09] },
          { type: "DataBlock", type_tag: 0x01, block_id: 4, payload: [0x0A, 0x0B, 0x0C] }
        ],
        summary: {
          total_data_size: 20,   // 4 × 5 bytes = 20
          total_index_size: 0    // No IndexBlocks
        }
      },
      bytes: [
        // 4 DataBlocks
        0x01, 1, 0x01, 0x02, 0x03,
        0x01, 2, 0x04, 0x05, 0x06,
        0x01, 3, 0x07, 0x08, 0x09,
        0x01, 4, 0x0A, 0x0B, 0x0C,

        // summary
        20, 0, 0, 0,   // total_data_size = 20
        0, 0, 0, 0     // total_index_size = 0
      ]
    }
  ]
});

/**
 * Test: ZIP-style sum_of_type_sizes
 *
 * Realistic ZIP EndOfCentralDir pattern: sum sizes of CentralDirEntry elements.
 */
export const zipStyleSumOfTypeSizesTestSuite = defineTestSuite({
  name: "context_sum_of_type_sizes_zip_style",
  description: "ZIP-style: sum central directory entry sizes",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "LocalFileHeader": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "signature", type: "uint32" },
          {
            name: "filename_length",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "filename",
              encoding: "utf8"
            }
          },
          {
            name: "filename",
            type: "string",
            kind: "field_referenced",
            length_field: "filename_length",
            encoding: "utf8"
          }
        ]
      },
      "CentralDirEntry": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          { name: "signature", type: "uint32" },
          {
            name: "filename_length",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "filename",
              encoding: "utf8"
            }
          },
          {
            name: "local_header_offset",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../sections[corresponding<LocalFileHeader>]"
            }
          },
          {
            name: "filename",
            type: "string",
            kind: "field_referenced",
            length_field: "filename_length",
            encoding: "utf8"
          }
        ]
      },
      "EndOfCentralDir": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x03 },
          { name: "signature", type: "uint32" },
          {
            name: "central_dir_offset",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../sections[first<CentralDirEntry>]"
            }
          },
          {
            name: "central_dir_size",
            type: "uint32",
            computed: {
              type: "sum_of_type_sizes",
              target: "../sections",
              element_type: "CentralDirEntry"
            }
          }
        ]
      },
      "ZipArchive": {
        sequence: [
          {
            name: "sections",
            type: "array",
            kind: "fixed",
            length: 5,
            items: {
              type: "choice",
              choices: [
                { type: "LocalFileHeader" },
                { type: "CentralDirEntry" },
                { type: "EndOfCentralDir" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "ZipArchive",
  test_cases: [
    {
      description: "ZIP: 2 local headers + 2 central dir + end record",
      value: {
        sections: [
          { type: "LocalFileHeader", signature: 0x04034b50, filename: "a.txt" },
          { type: "LocalFileHeader", signature: 0x04034b50, filename: "b.txt" },
          { type: "CentralDirEntry", signature: 0x02014b50, filename: "a.txt" },
          { type: "CentralDirEntry", signature: 0x02014b50, filename: "b.txt" },
          { type: "EndOfCentralDir", signature: 0x06054b50 }
        ]
      },
      decoded_value: {
        sections: [
          {
            type: "LocalFileHeader",
            type_tag: 0x01,
            signature: 0x04034b50,
            filename_length: 5,
            filename: "a.txt"
          },
          {
            type: "LocalFileHeader",
            type_tag: 0x01,
            signature: 0x04034b50,
            filename_length: 5,
            filename: "b.txt"
          },
          {
            type: "CentralDirEntry",
            type_tag: 0x02,
            signature: 0x02014b50,
            filename_length: 5,
            local_header_offset: 0,
            filename: "a.txt"
          },
          {
            type: "CentralDirEntry",
            type_tag: 0x02,
            signature: 0x02014b50,
            filename_length: 5,
            local_header_offset: 12,
            filename: "b.txt"
          },
          {
            type: "EndOfCentralDir",
            type_tag: 0x03,
            signature: 0x06054b50,
            central_dir_offset: 24,   // Position of first CentralDirEntry
            central_dir_size: 32      // Sum of 2 CentralDirEntry sizes (16 bytes each)
          }
        ]
      },
      bytes: [
        // sections[0]: LocalFileHeader "a.txt" (12 bytes)
        0x01,                    // type_tag
        0x50, 0x4b, 0x03, 0x04,  // signature
        5, 0,                    // filename_length
        0x61, 0x2e, 0x74, 0x78, 0x74,  // "a.txt"

        // sections[1]: LocalFileHeader "b.txt" (12 bytes)
        0x01,
        0x50, 0x4b, 0x03, 0x04,
        5, 0,                    // filename_length
        0x62, 0x2e, 0x74, 0x78, 0x74,  // "b.txt"

        // sections[2]: CentralDirEntry "a.txt" (16 bytes)
        0x02,
        0x50, 0x4b, 0x01, 0x02,  // signature
        5, 0,                    // filename_length
        0, 0, 0, 0,              // local_header_offset = 0
        0x61, 0x2e, 0x74, 0x78, 0x74,

        // sections[3]: CentralDirEntry "b.txt" (16 bytes)
        0x02,
        0x50, 0x4b, 0x01, 0x02,
        5, 0,                    // filename_length
        12, 0, 0, 0,             // local_header_offset = 12
        0x62, 0x2e, 0x74, 0x78, 0x74,

        // sections[4]: EndOfCentralDir (13 bytes)
        0x03,
        0x50, 0x4b, 0x05, 0x06,  // signature
        24, 0, 0, 0,             // central_dir_offset = 24
        32, 0, 0, 0              // central_dir_size = 32 (2 × 16)
      ]
    }
  ]
});

/**
 * Test: sum_of_type_sizes with variable-length elements
 *
 * Elements have variable sizes (strings, dynamic arrays).
 * Size tracking must measure actual encoded bytes.
 */
export const sumOfTypeSizesVariableLengthTestSuite = defineTestSuite({
  name: "context_sum_of_type_sizes_variable_length",
  description: "sum_of_type_sizes with variable-length string fields",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "NamedEntry": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x4E },  // ASCII 'N'
          {
            name: "name_length",
            type: "uint8",
            computed: {
              type: "length_of",
              target: "name",
              encoding: "utf8"
            }
          },
          {
            name: "name",
            type: "string",
            kind: "field_referenced",
            length_field: "name_length",
            encoding: "utf8"
          }
        ]
      },
      "ValueEntry": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x56 },  // ASCII 'V'
          { name: "value", type: "uint16" }
        ]
      },
      "Manifest": {
        sequence: [
          {
            name: "total_named_size",
            type: "uint32",
            computed: {
              type: "sum_of_type_sizes",
              target: "../entries",
              element_type: "NamedEntry"
            }
          }
        ]
      },
      "Collection": {
        sequence: [
          {
            name: "entries",
            type: "array",
            kind: "fixed",
            length: 4,
            items: {
              type: "choice",
              choices: [
                { type: "NamedEntry" },
                { type: "ValueEntry" }
              ]
            }
          },
          { name: "manifest", type: "Manifest" }
        ]
      }
    }
  },
  test_type: "Collection",
  test_cases: [
    {
      description: "Sum variable-length NamedEntry sizes",
      value: {
        entries: [
          { type: "NamedEntry", name: "Alice" },     // 7 bytes: tag(1) + len(1) + "Alice"(5)
          { type: "ValueEntry", value: 100 },        // 3 bytes: tag(1) + value(2)
          { type: "NamedEntry", name: "Bob" },       // 5 bytes: tag(1) + len(1) + "Bob"(3)
          { type: "NamedEntry", name: "Charlie" }    // 9 bytes: tag(1) + len(1) + "Charlie"(7)
        ],
        manifest: {}
      },
      decoded_value: {
        entries: [
          { type: "NamedEntry", type_tag: 0x4E, name_length: 5, name: "Alice" },
          { type: "ValueEntry", type_tag: 0x56, value: 100 },
          { type: "NamedEntry", type_tag: 0x4E, name_length: 3, name: "Bob" },
          { type: "NamedEntry", type_tag: 0x4E, name_length: 7, name: "Charlie" }
        ],
        manifest: {
          total_named_size: 21  // 7 + 5 + 9 = 21 bytes
        }
      },
      bytes: [
        // entries[0]: NamedEntry "Alice" (7 bytes)
        0x4E, 5, 0x41, 0x6C, 0x69, 0x63, 0x65,

        // entries[1]: ValueEntry (3 bytes)
        0x56, 100, 0,

        // entries[2]: NamedEntry "Bob" (5 bytes)
        0x4E, 3, 0x42, 0x6F, 0x62,

        // entries[3]: NamedEntry "Charlie" (9 bytes)
        0x4E, 7, 0x43, 0x68, 0x61, 0x72, 0x6C, 0x69, 0x65,

        // manifest
        21, 0, 0, 0  // total_named_size = 21
      ]
    }
  ]
});

/**
 * Test: sum_of_type_sizes with no matching elements
 *
 * Array contains no elements of the filtered type.
 * Should produce zero sum.
 */
export const sumOfTypeSizesNoMatchesTestSuite = defineTestSuite({
  name: "context_sum_of_type_sizes_no_matches",
  description: "sum_of_type_sizes when no elements match filter",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "TypeA": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xAA },
          { name: "data_a", type: "uint16" }
        ]
      },
      "TypeB": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xBB },
          { name: "data_b", type: "uint8" }
        ]
      },
      "Summary": {
        sequence: [
          {
            name: "total_b_size",
            type: "uint32",
            computed: {
              type: "sum_of_type_sizes",
              target: "../items",
              element_type: "TypeB"
            }
          }
        ]
      },
      "Container": {
        sequence: [
          {
            name: "items",
            type: "array",
            kind: "fixed",
            length: 3,
            items: {
              type: "choice",
              choices: [
                { type: "TypeA" },
                { type: "TypeB" }
              ]
            }
          },
          { name: "summary", type: "Summary" }
        ]
      }
    }
  },
  test_type: "Container",
  test_cases: [
    {
      description: "No TypeB elements, sum should be zero",
      value: {
        items: [
          { type: "TypeA", data_a: 100 },
          { type: "TypeA", data_a: 200 },
          { type: "TypeA", data_a: 255 }
        ],
        summary: {}
      },
      decoded_value: {
        items: [
          { type: "TypeA", type_tag: 0xAA, data_a: 100 },
          { type: "TypeA", type_tag: 0xAA, data_a: 200 },
          { type: "TypeA", type_tag: 0xAA, data_a: 255 }
        ],
        summary: {
          total_b_size: 0  // No TypeB elements
        }
      },
      bytes: [
        // 3 TypeA elements
        0xAA, 100, 0,
        0xAA, 200, 0,
        0xAA, 255, 0,

        // summary
        0, 0, 0, 0  // total_b_size = 0
      ]
    }
  ]
});
