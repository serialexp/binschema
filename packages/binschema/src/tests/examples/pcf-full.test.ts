// ABOUTME: Full PCF font format test with inline discriminated union for table bodies
// ABOUTME: Tests the complete PCF pattern: table_type in entry, body at ofs_body position

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * Full PCF font implementation
 *
 * This demonstrates the complete PCF pattern:
 * - Header with magic and table count
 * - Table directory with entries containing type, format, offset, size
 * - Table bodies accessed via instances with inline discriminated union
 * - Type selection based on table_type field
 *
 * Table types (enum values):
 * - 8 = PCF_BITMAPS
 * - 0x40 = PCF_SWIDTHS
 */
export const pcfFullTestSuite = defineTestSuite({
  name: "pcf_full",
  description: "Full PCF font with inline discriminated union for table bodies",
  schema: {
    config: { endianness: "little_endian", bit_order: "lsb_first" },
    types: {
      "Uint8": {
        description: "Single byte wrapper",
        type: "uint8"
      },
      "Format": {
        description: "Table format specifier (4 bytes)",
        sequence: [
          { name: "padding1", type: "bit", size: 2 },
          { name: "scan_unit_mask", type: "bit", size: 2 },
          { name: "is_msb_first", type: "bit", size: 1 },
          { name: "is_big_endian", type: "bit", size: 1 },
          { name: "glyph_pad_mask", type: "bit", size: 2 },
          { name: "format_byte", type: "uint8" },
          { name: "padding", type: "uint16" }
        ]
      },

      "BitmapsTableBody": {
        description: "PCF_BITMAPS table body (simplified)",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_glyphs", type: "uint32" }
        ]
      },

      "SwidthsTableBody": {
        description: "PCF_SWIDTHS table body (simplified)",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_glyphs", type: "uint32" },
          {
            name: "swidths",
            type: "array",
            kind: "field_referenced",
            length_field: "num_glyphs",
            items: { type: "uint32" }
          }
        ]
      },

      "TableEntry": {
        description: "Table directory entry with lazy body access",
        sequence: [
          { name: "table_type", type: "uint32" },
          { name: "format", type: "Format" },
          { name: "len_body", type: "uint32" },
          { name: "ofs_body", type: "uint32" }
        ],
        instances: [
          {
            name: "body",
            type: {
              discriminator: { field: "table_type" },
              variants: [
                { when: "value == 8", type: "BitmapsTableBody" },
                { when: "value == 64", type: "SwidthsTableBody" }
              ]
            },
            position: "ofs_body",
            size: "len_body",
            description: "Table body, type determined by table_type field"
          }
        ]
      },

      "PcfFull": {
        description: "PCF font file with full table body parsing",
        sequence: [
          {
            name: "magic",
            type: "array",
            kind: "fixed",
            length: 4,
            items: { type: "uint8" }
          },
          { name: "num_tables", type: "uint32" },
          {
            name: "tables",
            type: "array",
            kind: "field_referenced",
            length_field: "num_tables",
            items: { type: "TableEntry" }
          }
        ],
        // Marker instance to indicate this type has nested instances
        // (triggers decode-only mode in test runner)
        instances: [
          {
            name: "_has_nested_instances",
            type: "Uint8",
            position: 0,
            description: "Marker for test runner - nested types have instances"
          }
        ]
      }
    }
  },
  test_type: "PcfFull",
  test_cases: [
    {
      description: "PCF with bitmaps table (type=8)",
      bytes: [
        // === Header (offset 0-7) ===
        // Magic: 0x01 'f' 'c' 'p'
        0x01, 0x66, 0x63, 0x70,
        // num_tables: 1
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        // table_type: 8 (PCF_BITMAPS)
        0x08, 0x00, 0x00, 0x00,
        // format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // len_body: 8
        0x08, 0x00, 0x00, 0x00,
        // ofs_body: 24
        0x18, 0x00, 0x00, 0x00,

        // === BitmapsTableBody at offset 24 ===
        // format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // num_glyphs: 42
        0x2a, 0x00, 0x00, 0x00
      ],
      // Value for encoding (no instances)
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [
          {
            table_type: 8,
            format: {
              padding1: 0,
              scan_unit_mask: 0,
              is_msb_first: 0,
              is_big_endian: 0,
              glyph_pad_mask: 0,
              format_byte: 0,
              padding: 0
            },
            len_body: 8,
            ofs_body: 24
          }
        ]
      },
      // Decoded value includes instances (lazy fields)
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [
          {
            table_type: 8,
            format: {
              padding1: 0,
              scan_unit_mask: 0,
              is_msb_first: 0,
              is_big_endian: 0,
              glyph_pad_mask: 0,
              format_byte: 0,
              padding: 0
            },
            len_body: 8,
            ofs_body: 24,
            body: {
              type: "BitmapsTableBody",
              value: {
                format: {
                  padding1: 0,
                  scan_unit_mask: 0,
                  is_msb_first: 0,
                  is_big_endian: 0,
                  glyph_pad_mask: 0,
                  format_byte: 0,
                  padding: 0
                },
                num_glyphs: 42
              }
            }
          }
        ],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with swidths table (type=64/0x40)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        // table_type: 64 (PCF_SWIDTHS)
        0x40, 0x00, 0x00, 0x00,
        // format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // len_body: 20 (8 + 3*4)
        0x14, 0x00, 0x00, 0x00,
        // ofs_body: 24
        0x18, 0x00, 0x00, 0x00,

        // === SwidthsTableBody at offset 24 ===
        // format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // num_glyphs: 3
        0x03, 0x00, 0x00, 0x00,
        // swidths: [500, 600, 700]
        0xf4, 0x01, 0x00, 0x00,
        0x58, 0x02, 0x00, 0x00,
        0xbc, 0x02, 0x00, 0x00
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [
          {
            table_type: 64,
            format: {
              padding1: 0,
              scan_unit_mask: 0,
              is_msb_first: 0,
              is_big_endian: 0,
              glyph_pad_mask: 0,
              format_byte: 0,
              padding: 0
            },
            len_body: 20,
            ofs_body: 24
          }
        ]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [
          {
            table_type: 64,
            format: {
              padding1: 0,
              scan_unit_mask: 0,
              is_msb_first: 0,
              is_big_endian: 0,
              glyph_pad_mask: 0,
              format_byte: 0,
              padding: 0
            },
            len_body: 20,
            ofs_body: 24,
            body: {
              type: "SwidthsTableBody",
              value: {
                format: {
                  padding1: 0,
                  scan_unit_mask: 0,
                  is_msb_first: 0,
                  is_big_endian: 0,
                  glyph_pad_mask: 0,
                  format_byte: 0,
                  padding: 0
                },
                num_glyphs: 3,
                swidths: [500, 600, 700]
              }
            }
          }
        ],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with multiple tables (bitmaps + swidths)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x02, 0x00, 0x00, 0x00,  // 2 tables

        // === Table entry 0 (offset 8-23): BITMAPS ===
        0x08, 0x00, 0x00, 0x00,  // type: 8
        0x00, 0x00, 0x00, 0x00,  // format
        0x08, 0x00, 0x00, 0x00,  // len_body: 8
        0x28, 0x00, 0x00, 0x00,  // ofs_body: 40

        // === Table entry 1 (offset 24-39): SWIDTHS ===
        0x40, 0x00, 0x00, 0x00,  // type: 64
        0x00, 0x00, 0x00, 0x00,  // format
        0x10, 0x00, 0x00, 0x00,  // len_body: 16 (8 + 2*4)
        0x30, 0x00, 0x00, 0x00,  // ofs_body: 48

        // === BitmapsTableBody at offset 40 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x05, 0x00, 0x00, 0x00,  // num_glyphs: 5

        // === SwidthsTableBody at offset 48 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x02, 0x00, 0x00, 0x00,  // num_glyphs: 2
        0xe8, 0x03, 0x00, 0x00,  // swidth[0]: 1000
        0xd0, 0x07, 0x00, 0x00   // swidth[1]: 2000
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 2,
        tables: [
          {
            table_type: 8,
            format: {
              padding1: 0, scan_unit_mask: 0, is_msb_first: 0,
              is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0
            },
            len_body: 8,
            ofs_body: 40
          },
          {
            table_type: 64,
            format: {
              padding1: 0, scan_unit_mask: 0, is_msb_first: 0,
              is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0
            },
            len_body: 16,
            ofs_body: 48
          }
        ]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 2,
        tables: [
          {
            table_type: 8,
            format: {
              padding1: 0, scan_unit_mask: 0, is_msb_first: 0,
              is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0
            },
            len_body: 8,
            ofs_body: 40,
            body: {
              type: "BitmapsTableBody",
              value: {
                format: {
                  padding1: 0, scan_unit_mask: 0, is_msb_first: 0,
                  is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0
                },
                num_glyphs: 5
              }
            }
          },
          {
            table_type: 64,
            format: {
              padding1: 0, scan_unit_mask: 0, is_msb_first: 0,
              is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0
            },
            len_body: 16,
            ofs_body: 48,
            body: {
              type: "SwidthsTableBody",
              value: {
                format: {
                  padding1: 0, scan_unit_mask: 0, is_msb_first: 0,
                  is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0
                },
                num_glyphs: 2,
                swidths: [1000, 2000]
              }
            }
          }
        ],
        _has_nested_instances: 1
      }
    }
  ]
});
