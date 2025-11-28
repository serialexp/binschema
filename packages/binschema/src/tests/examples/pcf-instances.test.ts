// ABOUTME: PCF font format test demonstrating instances (position-based access)
// ABOUTME: Tests reading table bodies at offsets specified in table directory

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * PCF font with instance-based body access
 *
 * This test demonstrates reading a table body at a position specified
 * by the ofs_body field in the table directory entry.
 *
 * Structure:
 * - Header (magic + num_tables)
 * - Table entry (type=8/bitmaps, format, len_body=24, ofs_body=24)
 * - Body at offset 24: BitmapsTable
 */
export const pcfInstancesTestSuite = defineTestSuite({
  name: "pcf_instances",
  description: "PCF font with instance-based table body access",
  schema: {
    config: { endianness: "little_endian", bit_order: "lsb_first" },
    types: {
      "Format": {
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
        description: "Simplified BitmapsTable for testing",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_glyphs", type: "uint32" }
        ]
      },

      "PcfWithBitmaps": {
        description: "PCF file with single bitmaps table - body accessed via instance",
        sequence: [
          {
            name: "magic",
            type: "array",
            kind: "fixed",
            length: 4,
            items: { type: "uint8" }
          },
          { name: "num_tables", type: "uint32" },
          { name: "table_type", type: "uint32" },
          { name: "table_format", type: "Format" },
          { name: "len_body", type: "uint32" },
          { name: "ofs_body", type: "uint32" }
        ],
        instances: [
          {
            name: "body",
            type: "BitmapsTableBody",
            position: "ofs_body",
            size: "len_body",
            description: "Table body at offset ofs_body"
          }
        ]
      }
    }
  },
  test_type: "PcfWithBitmaps",
  test_cases: [
    {
      description: "PCF with bitmaps table body accessed via instance",
      bytes: [
        // === Header (offset 0-7) ===
        // Magic: 0x01 'f' 'c' 'p'
        0x01, 0x66, 0x63, 0x70,
        // num_tables: 1
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        // table_type: 8 (PCF_BITMAPS)
        0x08, 0x00, 0x00, 0x00,
        // table_format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // len_body: 8 bytes
        0x08, 0x00, 0x00, 0x00,
        // ofs_body: 24 (offset to body)
        0x18, 0x00, 0x00, 0x00,

        // === Body at offset 24 ===
        // format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // num_glyphs: 42
        0x2a, 0x00, 0x00, 0x00
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        table_type: 8,
        table_format: {
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
  ]
});
