// ABOUTME: Tests for array iteration context (same_index, first, last selectors)
// ABOUTME: Validates context extension when entering arrays and proper correlation

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Test: same_index correlation within single array
 *
 * Array contains choice types. One variant references another variant
 * at the same array index. Context must track current iteration index.
 */
export const sameIndexSingleArrayTestSuite = defineTestSuite({
  name: "context_same_index_single_array",
  description: "Choice variant references same_index element for correlation",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "DataBlock": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "id", type: "uint16" },
          {
            name: "payload",
            type: "array",
            kind: "fixed",
            length: 4,
            items: { type: "uint8" }
          }
        ]
      },
      "MetaBlock": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "data_position",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../blocks[same_index<DataBlock>]"
            }
          },
          {
            name: "data_id",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../blocks[same_index<DataBlock>].payload"
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
                { type: "MetaBlock" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "Archive",
  test_cases: [
    {
      description: "MetaBlock references corresponding DataBlock at same index",
      value: {
        blocks: [
          {
            type: "DataBlock",
            id: 100,
            payload: [0xAA, 0xBB, 0xCC, 0xDD]
          },
          {
            type: "MetaBlock"
            // data_position and data_id computed from blocks[same_index<DataBlock>]
          },
          {
            type: "DataBlock",
            id: 200,
            payload: [0x11, 0x22, 0x33, 0x44]
          },
          {
            type: "MetaBlock"
          }
        ]
      },
      decoded_value: {
        blocks: [
          {
            type: "DataBlock",
            type_tag: 0x01,
            id: 100,
            payload: [0xAA, 0xBB, 0xCC, 0xDD]
          },
          {
            type: "MetaBlock",
            type_tag: 0x02,
            data_position: 0,  // Position of blocks[0] (same index)
            data_id: 4         // Length of blocks[0].payload
          },
          {
            type: "DataBlock",
            type_tag: 0x01,
            id: 200,
            payload: [0x11, 0x22, 0x33, 0x44]
          },
          {
            type: "MetaBlock",
            type_tag: 0x02,
            data_position: 14,  // Position of blocks[2] (same index)
            data_id: 4
          }
        ]
      },
      bytes: [
        // blocks[0]: DataBlock (position 0)
        0x01,              // type_tag
        100, 0,            // id (LE)
        0xAA, 0xBB, 0xCC, 0xDD,  // payload

        // blocks[1]: MetaBlock (position 7)
        0x02,              // type_tag
        0, 0, 0, 0,        // data_position = 0 (same_index → blocks[0])
        4, 0,              // data_id = 4

        // blocks[2]: DataBlock (position 14)
        0x01,              // type_tag
        200, 0,            // id (LE)
        0x11, 0x22, 0x33, 0x44,  // payload

        // blocks[3]: MetaBlock (position 21)
        0x02,              // type_tag
        14, 0, 0, 0,       // data_position = 14 (same_index → blocks[2])
        4, 0               // data_id = 4
      ]
    }
  ]
});

/**
 * Test: first<Type> selector
 *
 * Computed field references the first element of a specific type in an array.
 * Context must track array iteration and support type filtering.
 */
export const firstSelectorTestSuite = defineTestSuite({
  name: "context_first_selector",
  description: "Computed field references first element of specific type",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "FileEntry": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xF1 },
          { name: "file_id", type: "uint8" },
          {
            name: "data",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "uint8" }
          }
        ]
      },
      "DirEntry": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xD1 },
          { name: "dir_id", type: "uint8" }
        ]
      },
      "Index": {
        sequence: [
          {
            name: "first_file_pos",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../entries[first<FileEntry>]"
            }
          },
          {
            name: "first_dir_pos",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../entries[first<DirEntry>]"
            }
          }
        ]
      },
      "FileSystem": {
        sequence: [
          {
            name: "entries",
            type: "array",
            kind: "fixed",
            length: 4,
            items: {
              type: "choice",
              choices: [
                { type: "DirEntry" },
                { type: "FileEntry" }
              ]
            }
          },
          { name: "index", type: "Index" }
        ]
      }
    }
  },
  test_type: "FileSystem",
  test_cases: [
    {
      description: "Index references first DirEntry and first FileEntry",
      value: {
        entries: [
          { type: "DirEntry", dir_id: 1 },
          { type: "FileEntry", file_id: 10, data: [0xAA, 0xBB, 0xCC] },
          { type: "DirEntry", dir_id: 2 },
          { type: "FileEntry", file_id: 20, data: [0xDD, 0xEE, 0xFF] }
        ],
        index: {}
      },
      decoded_value: {
        entries: [
          { type: "DirEntry", type_tag: 0xD1, dir_id: 1 },
          { type: "FileEntry", type_tag: 0xF1, file_id: 10, data: [0xAA, 0xBB, 0xCC] },
          { type: "DirEntry", type_tag: 0xD1, dir_id: 2 },
          { type: "FileEntry", type_tag: 0xF1, file_id: 20, data: [0xDD, 0xEE, 0xFF] }
        ],
        index: {
          first_file_pos: 2,   // Position of entries[1] (first FileEntry)
          first_dir_pos: 0     // Position of entries[0] (first DirEntry)
        }
      },
      bytes: [
        // entries[0]: DirEntry (position 0)
        0xD1, 1,

        // entries[1]: FileEntry (position 2)
        0xF1, 10, 0xAA, 0xBB, 0xCC,

        // entries[2]: DirEntry (position 7)
        0xD1, 2,

        // entries[3]: FileEntry (position 9)
        0xF1, 20, 0xDD, 0xEE, 0xFF,

        // index
        2, 0, 0, 0,    // first_file_pos = 2
        0, 0, 0, 0     // first_dir_pos = 0
      ]
    }
  ]
});

/**
 * Test: last<Type> selector
 *
 * Computed field references the last element of a specific type in an array.
 */
export const lastSelectorTestSuite = defineTestSuite({
  name: "context_last_selector",
  description: "Computed field references last element of specific type",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "DataChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0xDA },
          { name: "chunk_id", type: "uint8" },
          {
            name: "content",
            type: "array",
            kind: "fixed",
            length: 2,
            items: { type: "uint8" }
          }
        ]
      },
      "MarkerChunk": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x4D },  // ASCII 'M'
          { name: "marker_id", type: "uint8" }
        ]
      },
      "Footer": {
        sequence: [
          {
            name: "last_data_position",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../chunks[last<DataChunk>]"
            }
          },
          {
            name: "total_chunks",
            type: "uint8"
          }
        ]
      },
      "Stream": {
        sequence: [
          {
            name: "chunks",
            type: "array",
            kind: "fixed",
            length: 5,
            items: {
              type: "choice",
              choices: [
                { type: "DataChunk" },
                { type: "MarkerChunk" }
              ]
            }
          },
          { name: "footer", type: "Footer" }
        ]
      }
    }
  },
  test_type: "Stream",
  test_cases: [
    {
      description: "Footer references last DataChunk position",
      value: {
        chunks: [
          { type: "DataChunk", chunk_id: 1, content: [0x01, 0x02] },
          { type: "MarkerChunk", marker_id: 99 },
          { type: "DataChunk", chunk_id: 2, content: [0x03, 0x04] },
          { type: "MarkerChunk", marker_id: 100 },
          { type: "DataChunk", chunk_id: 3, content: [0x05, 0x06] }
        ],
        footer: {
          total_chunks: 5
        }
      },
      decoded_value: {
        chunks: [
          { type: "DataChunk", type_tag: 0xDA, chunk_id: 1, content: [0x01, 0x02] },
          { type: "MarkerChunk", type_tag: 0x4D, marker_id: 99 },
          { type: "DataChunk", type_tag: 0xDA, chunk_id: 2, content: [0x03, 0x04] },
          { type: "MarkerChunk", type_tag: 0x4D, marker_id: 100 },
          { type: "DataChunk", type_tag: 0xDA, chunk_id: 3, content: [0x05, 0x06] }
        ],
        footer: {
          last_data_position: 10,  // Position of chunks[4] (last DataChunk)
          total_chunks: 5
        }
      },
      bytes: [
        // chunks[0]: DataChunk (position 0)
        0xDA, 1, 0x01, 0x02,

        // chunks[1]: MarkerChunk (position 4)
        0x4D, 99,

        // chunks[2]: DataChunk (position 6)
        0xDA, 2, 0x03, 0x04,

        // chunks[3]: MarkerChunk (position 10)
        0x4D, 100,

        // chunks[4]: DataChunk (position 12)
        0xDA, 3, 0x05, 0x06,

        // footer
        12, 0, 0, 0,   // last_data_position = 12
        5              // total_chunks
      ]
    }
  ]
});

/**
 * Test: Multiple choice variants using same_index
 *
 * Similar to ZIP format: multiple variants reference each other at same index.
 */
export const multipleVariantsSameIndexTestSuite = defineTestSuite({
  name: "context_multiple_variants_same_index",
  description: "Multiple choice variants cross-reference via same_index",
  schema: {
    config: { endianness: "little_endian" },
    types: {
      "LocalFile": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x01 },
          { name: "file_id", type: "uint16" },
          {
            name: "body",
            type: "array",
            kind: "fixed",
            length: 3,
            items: { type: "uint8" }
          }
        ]
      },
      "CentralDir": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x02 },
          {
            name: "local_offset",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../sections[same_index<LocalFile>]"
            }
          },
          {
            name: "compressed_size",
            type: "uint16",
            computed: {
              type: "length_of",
              target: "../sections[same_index<LocalFile>].body"
            }
          }
        ]
      },
      "EndRecord": {
        sequence: [
          { name: "type_tag", type: "uint8", const: 0x03 },
          {
            name: "cd_start",
            type: "uint32",
            computed: {
              type: "position_of",
              target: "../sections[first<CentralDir>]"
            }
          }
        ]
      },
      "ZipFile": {
        sequence: [
          {
            name: "sections",
            type: "array",
            kind: "fixed",
            length: 5,
            items: {
              type: "choice",
              choices: [
                { type: "LocalFile" },
                { type: "CentralDir" },
                { type: "EndRecord" }
              ]
            }
          }
        ]
      }
    }
  },
  test_type: "ZipFile",
  test_cases: [
    {
      description: "ZIP-style: LocalFile, CentralDir pairs + EndRecord",
      value: {
        sections: [
          { type: "LocalFile", file_id: 1, body: [0xAA, 0xBB, 0xCC] },
          { type: "LocalFile", file_id: 2, body: [0xDD, 0xEE, 0xFF] },
          { type: "CentralDir" },  // References sections[0]
          { type: "CentralDir" },  // References sections[1]
          { type: "EndRecord" }
        ]
      },
      decoded_value: {
        sections: [
          {
            type: "LocalFile",
            type_tag: 0x01,
            file_id: 1,
            body: [0xAA, 0xBB, 0xCC]
          },
          {
            type: "LocalFile",
            type_tag: 0x01,
            file_id: 2,
            body: [0xDD, 0xEE, 0xFF]
          },
          {
            type: "CentralDir",
            type_tag: 0x02,
            local_offset: 0,     // Position of sections[0] (same_index)
            compressed_size: 3   // Length of sections[0].body
          },
          {
            type: "CentralDir",
            type_tag: 0x02,
            local_offset: 7,     // Position of sections[1] (same_index)
            compressed_size: 3
          },
          {
            type: "EndRecord",
            type_tag: 0x03,
            cd_start: 14  // Position of first CentralDir (sections[2])
          }
        ]
      },
      bytes: [
        // sections[0]: LocalFile (position 0)
        0x01, 1, 0, 0xAA, 0xBB, 0xCC,

        // sections[1]: LocalFile (position 7)
        0x01, 2, 0, 0xDD, 0xEE, 0xFF,

        // sections[2]: CentralDir (position 14)
        0x02,
        0, 0, 0, 0,   // local_offset = 0
        3, 0,         // compressed_size = 3

        // sections[3]: CentralDir (position 21)
        0x02,
        7, 0, 0, 0,   // local_offset = 7
        3, 0,         // compressed_size = 3

        // sections[4]: EndRecord (position 28)
        0x03,
        14, 0, 0, 0   // cd_start = 14
      ]
    }
  ]
});
