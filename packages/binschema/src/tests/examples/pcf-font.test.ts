// ABOUTME: PCF font format test demonstrating bit fields and table directory
// ABOUTME: Tests PCF header, table directory, and various table body types

import { defineTestSuite } from "../../schema/test-schema.js";

/**
 * PCF (Portable Compiled Format) font
 * X11 bitmap font format with table-based structure
 *
 * Features tested:
 * - Fixed array for magic bytes
 * - Bit-level fields in Format structure
 * - field_referenced array for table directory
 * - Nested type references
 * - Table body types (Bitmaps, Swidths, BdfEncodings)
 *
 * Table types (enum values):
 * - 1 = PCF_PROPERTIES
 * - 2 = PCF_ACCELERATORS
 * - 4 = PCF_METRICS
 * - 8 = PCF_BITMAPS
 * - 0x10 = PCF_INK_METRICS
 * - 0x20 = PCF_BDF_ENCODINGS
 * - 0x40 = PCF_SWIDTHS
 * - 0x80 = PCF_GLYPH_NAMES
 * - 0x100 = PCF_BDF_ACCELERATORS
 */
export const pcfFontTestSuite = defineTestSuite({
  name: "pcf_font",
  description: "PCF font format header and table directory",
  schema: {
    config: { endianness: "little_endian", bit_order: "lsb_first" },
    types: {
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
      "TableEntry": {
        description: "Table directory entry",
        sequence: [
          { name: "table_type", type: "uint32" },
          { name: "format", type: "Format" },
          { name: "len_body", type: "uint32" },
          { name: "ofs_body", type: "uint32" }
        ]
      },
      "PcfFont": {
        description: "PCF font file header and table directory",
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
        ]
      },

      // ========================================
      // Table Body Types
      // ========================================

      "BitmapsTable": {
        description: "PCF_BITMAPS table (type=8) - uncompressed glyph bitmaps",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_glyphs", type: "uint32" },
          {
            name: "offsets",
            type: "array",
            kind: "field_referenced",
            length_field: "num_glyphs",
            items: { type: "uint32" },
            description: "Offset to each glyph's bitmap data"
          },
          {
            name: "bitmap_sizes",
            type: "array",
            kind: "fixed",
            length: 4,
            items: { type: "uint32" },
            description: "Bitmap data sizes for 4 padding configurations"
          }
        ]
      },

      "SwidthsTable": {
        description: "PCF_SWIDTHS table (type=0x40) - scalable widths",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_glyphs", type: "uint32" },
          {
            name: "swidths",
            type: "array",
            kind: "field_referenced",
            length_field: "num_glyphs",
            items: { type: "uint32" },
            description: "Scalable width in em-units (1/1000ths of an em)"
          }
        ]
      },

      "BdfEncodingsTable": {
        description: "PCF_BDF_ENCODINGS table (type=0x20) - character code to glyph mapping",
        sequence: [
          { name: "format", type: "Format" },
          { name: "min_char_or_byte2", type: "uint16" },
          { name: "max_char_or_byte2", type: "uint16" },
          { name: "min_byte1", type: "uint16" },
          { name: "max_byte1", type: "uint16" },
          { name: "default_char", type: "uint16" }
          // glyph_indexes array would need computed length:
          // (max_char_or_byte2 - min_char_or_byte2 + 1) * (max_byte1 - min_byte1 + 1)
          // Skipping for now since we don't support computed array lengths
        ]
      }
    }
  },
  test_type: "PcfFont",
  test_cases: [
    {
      description: "Minimal PCF with single properties table",
      bytes: [
        // Magic: 0x01 'f' 'c' 'p'
        0x01, 0x66, 0x63, 0x70,
        // num_tables: 1 (little-endian uint32)
        0x01, 0x00, 0x00, 0x00,
        // TableEntry[0]:
        //   table_type: 1 (PCF_PROPERTIES)
        0x01, 0x00, 0x00, 0x00,
        //   format (4 bytes):
        //     First byte: bits [padding1=0, scan_unit_mask=0, is_msb_first=0, is_big_endian=0, glyph_pad_mask=0] = 0x00
        //     format_byte: 0x00
        //     padding: 0x0000
        0x00, 0x00, 0x00, 0x00,
        //   len_body: 64 bytes
        0x40, 0x00, 0x00, 0x00,
        //   ofs_body: 24 (after header)
        0x18, 0x00, 0x00, 0x00
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [
          {
            table_type: 1,
            format: {
              padding1: 0,
              scan_unit_mask: 0,
              is_msb_first: 0,
              is_big_endian: 0,
              glyph_pad_mask: 0,
              format_byte: 0,
              padding: 0
            },
            len_body: 64,
            ofs_body: 24
          }
        ]
      }
    },
    {
      description: "PCF with multiple tables and format flags",
      bytes: [
        // Magic
        0x01, 0x66, 0x63, 0x70,
        // num_tables: 2
        0x02, 0x00, 0x00, 0x00,

        // TableEntry[0]: properties (type=1)
        0x01, 0x00, 0x00, 0x00,
        // format: is_big_endian=1 (bit 5), so first byte = 0b00100000 = 0x20
        0x20, 0x01, 0x00, 0x00,
        // len_body: 128
        0x80, 0x00, 0x00, 0x00,
        // ofs_body: 40
        0x28, 0x00, 0x00, 0x00,

        // TableEntry[1]: bitmaps (type=8)
        0x08, 0x00, 0x00, 0x00,
        // format: glyph_pad_mask=2 (bits 6-7), so first byte = 0b10000000 = 0x80
        0x80, 0x02, 0x00, 0x00,
        // len_body: 256
        0x00, 0x01, 0x00, 0x00,
        // ofs_body: 168
        0xa8, 0x00, 0x00, 0x00
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 2,
        tables: [
          {
            table_type: 1,
            format: {
              padding1: 0,
              scan_unit_mask: 0,
              is_msb_first: 0,
              is_big_endian: 1,
              glyph_pad_mask: 0,
              format_byte: 1,
              padding: 0
            },
            len_body: 128,
            ofs_body: 40
          },
          {
            table_type: 8,
            format: {
              padding1: 0,
              scan_unit_mask: 0,
              is_msb_first: 0,
              is_big_endian: 0,
              glyph_pad_mask: 2,
              format_byte: 2,
              padding: 0
            },
            len_body: 256,
            ofs_body: 168
          }
        ]
      }
    }
  ]
});

/**
 * Test suite for PCF Bitmaps table body
 */
export const pcfBitmapsTableTestSuite = defineTestSuite({
  name: "pcf_bitmaps_table",
  description: "PCF BITMAPS table body (type=8)",
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
      "BitmapsTable": {
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_glyphs", type: "uint32" },
          {
            name: "offsets",
            type: "array",
            kind: "field_referenced",
            length_field: "num_glyphs",
            items: { type: "uint32" }
          },
          {
            name: "bitmap_sizes",
            type: "array",
            kind: "fixed",
            length: 4,
            items: { type: "uint32" }
          }
        ]
      }
    }
  },
  test_type: "BitmapsTable",
  test_cases: [
    {
      description: "Bitmaps table with 2 glyphs",
      bytes: [
        // Format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // num_glyphs: 2
        0x02, 0x00, 0x00, 0x00,
        // offsets[0]: 0
        0x00, 0x00, 0x00, 0x00,
        // offsets[1]: 16
        0x10, 0x00, 0x00, 0x00,
        // bitmap_sizes[0-3]: 32, 64, 128, 256
        0x20, 0x00, 0x00, 0x00,
        0x40, 0x00, 0x00, 0x00,
        0x80, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x00
      ],
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
        num_glyphs: 2,
        offsets: [0, 16],
        bitmap_sizes: [32, 64, 128, 256]
      }
    }
  ]
});

/**
 * Test suite for PCF Swidths table body
 */
export const pcfSwidthsTableTestSuite = defineTestSuite({
  name: "pcf_swidths_table",
  description: "PCF SWIDTHS table body (type=0x40)",
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
      "SwidthsTable": {
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
      }
    }
  },
  test_type: "SwidthsTable",
  test_cases: [
    {
      description: "Swidths table with 3 glyphs",
      bytes: [
        // Format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // num_glyphs: 3
        0x03, 0x00, 0x00, 0x00,
        // swidths[0]: 500 (em-units)
        0xf4, 0x01, 0x00, 0x00,
        // swidths[1]: 600
        0x58, 0x02, 0x00, 0x00,
        // swidths[2]: 1000
        0xe8, 0x03, 0x00, 0x00
      ],
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
        swidths: [500, 600, 1000]
      }
    }
  ]
});

/**
 * Test suite for PCF BDF Encodings table body (partial - without glyph_indexes)
 */
export const pcfBdfEncodingsTableTestSuite = defineTestSuite({
  name: "pcf_bdf_encodings_table",
  description: "PCF BDF_ENCODINGS table body (type=0x20) - header only",
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
      "BdfEncodingsTable": {
        sequence: [
          { name: "format", type: "Format" },
          { name: "min_char_or_byte2", type: "uint16" },
          { name: "max_char_or_byte2", type: "uint16" },
          { name: "min_byte1", type: "uint16" },
          { name: "max_byte1", type: "uint16" },
          { name: "default_char", type: "uint16" }
        ]
      }
    }
  },
  test_type: "BdfEncodingsTable",
  test_cases: [
    {
      description: "BDF encodings for ASCII range (32-126)",
      bytes: [
        // Format: all zeros
        0x00, 0x00, 0x00, 0x00,
        // min_char_or_byte2: 32 (space)
        0x20, 0x00,
        // max_char_or_byte2: 126 (~)
        0x7e, 0x00,
        // min_byte1: 0 (single-byte encoding)
        0x00, 0x00,
        // max_byte1: 0
        0x00, 0x00,
        // default_char: 32 (space)
        0x20, 0x00
      ],
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
        min_char_or_byte2: 32,
        max_char_or_byte2: 126,
        min_byte1: 0,
        max_byte1: 0,
        default_char: 32
      }
    }
  ]
});
