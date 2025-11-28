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
        description: "PCF_SWIDTHS table body (type=0x40) - scalable widths",
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

      // ========================================
      // Properties Table (type=1)
      // Key-value pairs for X11 font settings
      // ========================================

      "Prop": {
        description: "Property entry - key-value pair with offset-based strings",
        sequence: [
          { name: "ofs_name", type: "uint32", description: "Offset to name in strings buffer" },
          { name: "is_string", type: "uint8", description: "0=integer value, non-zero=string value" },
          { name: "value_or_ofs_value", type: "uint32", description: "Integer value or offset to string value" }
        ]
      },

      "PropertiesTableBody": {
        description: "PCF_PROPERTIES table body (type=1) - key-value pairs",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_props", type: "uint32" },
          {
            name: "props",
            type: "array",
            kind: "field_referenced",
            length_field: "num_props",
            items: { type: "Prop" }
          },
          {
            name: "padding",
            type: "padding",
            align_to: 4,
            description: "Align to 4-byte boundary after props array"
          },
          { name: "len_strings", type: "uint32" },
          {
            name: "strings",
            type: "array",
            kind: "field_referenced",
            length_field: "len_strings",
            items: { type: "uint8" },
            description: "Strings buffer containing property names and string values"
          }
        ]
      },

      // ========================================
      // BDF Encodings Table (type=0x20)
      // Character code to glyph mapping
      // ========================================

      "BdfEncodingsTableBody": {
        description: "PCF_BDF_ENCODINGS table body (type=0x20) - character to glyph mapping",
        sequence: [
          { name: "format", type: "Format" },
          { name: "min_char_or_byte2", type: "uint16" },
          { name: "max_char_or_byte2", type: "uint16" },
          { name: "min_byte1", type: "uint16" },
          { name: "max_byte1", type: "uint16" },
          { name: "default_char", type: "uint16" },
          {
            name: "glyph_indexes",
            type: "array",
            kind: "computed_count",
            count_expr: "(max_char_or_byte2 - min_char_or_byte2 + 1) * (max_byte1 - min_byte1 + 1)",
            items: { type: "uint16" },
            description: "Glyph index for each character code (0xFFFF = no glyph)"
          }
        ]
      },

      // ========================================
      // Glyph Names Table (type=0x80)
      // Character names for every glyph
      // ========================================

      "StringRef": {
        description: "Offset reference to a string in the strings buffer",
        sequence: [
          { name: "ofs_string", type: "uint32" }
        ]
      },

      "GlyphNamesTableBody": {
        description: "PCF_GLYPH_NAMES table body (type=0x80) - glyph name strings",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_glyphs", type: "uint32" },
          {
            name: "names",
            type: "array",
            kind: "field_referenced",
            length_field: "num_glyphs",
            items: { type: "StringRef" },
            description: "Offsets to glyph names in strings buffer"
          },
          { name: "len_strings", type: "uint32" },
          {
            name: "strings",
            type: "array",
            kind: "field_referenced",
            length_field: "len_strings",
            items: { type: "uint8" },
            description: "Strings buffer containing null-terminated glyph names"
          }
        ]
      },

      // ========================================
      // Metrics Table (type=4)
      // Per-glyph metrics (uncompressed format)
      // ========================================

      "Metric": {
        description: "Per-glyph metric data (uncompressed)",
        sequence: [
          { name: "left_side_bearing", type: "int16" },
          { name: "right_side_bearing", type: "int16" },
          { name: "character_width", type: "int16" },
          { name: "character_ascent", type: "int16" },
          { name: "character_descent", type: "int16" },
          { name: "character_attributes", type: "uint16" }
        ]
      },

      "MetricsTableBody": {
        description: "PCF_METRICS table body (type=4) - per-glyph metrics",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_metrics", type: "uint32" },
          {
            name: "metrics",
            type: "array",
            kind: "field_referenced",
            length_field: "num_metrics",
            items: { type: "Metric" }
          }
        ]
      },

      // ========================================
      // Ink Metrics Table (type=0x10)
      // Ink bounds metrics (same structure as Metrics)
      // ========================================

      "InkMetricsTableBody": {
        description: "PCF_INK_METRICS table body (type=0x10) - ink bounds",
        sequence: [
          { name: "format", type: "Format" },
          { name: "num_metrics", type: "uint32" },
          {
            name: "metrics",
            type: "array",
            kind: "field_referenced",
            length_field: "num_metrics",
            items: { type: "Metric" }
          }
        ]
      },

      // ========================================
      // Accelerators Table (type=2)
      // Font-wide metrics cache
      // ========================================

      "AcceleratorsTableBody": {
        description: "PCF_ACCELERATORS table body (type=2) - font-wide metrics",
        sequence: [
          { name: "format", type: "Format" },
          { name: "no_overlap", type: "uint8" },
          { name: "constant_metrics", type: "uint8" },
          { name: "terminal_font", type: "uint8" },
          { name: "constant_width", type: "uint8" },
          { name: "ink_inside", type: "uint8" },
          { name: "ink_metrics", type: "uint8" },
          { name: "draw_direction", type: "uint8" },
          { name: "padding", type: "uint8" },
          { name: "font_ascent", type: "int32" },
          { name: "font_descent", type: "int32" },
          { name: "max_overlap", type: "int32" },
          { name: "min_bounds", type: "Metric" },
          { name: "max_bounds", type: "Metric" }
          // ink_min_bounds and ink_max_bounds may follow depending on format
        ]
      },

      // ========================================
      // BDF Accelerators Table (type=0x100)
      // Extended accelerators (same as Accelerators but always has ink bounds)
      // ========================================

      "BdfAcceleratorsTableBody": {
        description: "PCF_BDF_ACCELERATORS table body (type=0x100) - extended accelerators",
        sequence: [
          { name: "format", type: "Format" },
          { name: "no_overlap", type: "uint8" },
          { name: "constant_metrics", type: "uint8" },
          { name: "terminal_font", type: "uint8" },
          { name: "constant_width", type: "uint8" },
          { name: "ink_inside", type: "uint8" },
          { name: "ink_metrics", type: "uint8" },
          { name: "draw_direction", type: "uint8" },
          { name: "padding", type: "uint8" },
          { name: "font_ascent", type: "int32" },
          { name: "font_descent", type: "int32" },
          { name: "max_overlap", type: "int32" },
          { name: "min_bounds", type: "Metric" },
          { name: "max_bounds", type: "Metric" },
          { name: "ink_min_bounds", type: "Metric" },
          { name: "ink_max_bounds", type: "Metric" }
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
                { when: "value == 1", type: "PropertiesTableBody" },      // PCF_PROPERTIES
                { when: "value == 2", type: "AcceleratorsTableBody" },    // PCF_ACCELERATORS
                { when: "value == 4", type: "MetricsTableBody" },         // PCF_METRICS
                { when: "value == 8", type: "BitmapsTableBody" },         // PCF_BITMAPS
                { when: "value == 16", type: "InkMetricsTableBody" },     // PCF_INK_METRICS (0x10)
                { when: "value == 32", type: "BdfEncodingsTableBody" },   // PCF_BDF_ENCODINGS (0x20)
                { when: "value == 64", type: "SwidthsTableBody" },        // PCF_SWIDTHS (0x40)
                { when: "value == 128", type: "GlyphNamesTableBody" },    // PCF_GLYPH_NAMES (0x80)
                { when: "value == 256", type: "BdfAcceleratorsTableBody" } // PCF_BDF_ACCELERATORS (0x100)
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
    },
    {
      description: "PCF with properties table (type=1)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        0x01, 0x00, 0x00, 0x00,  // type: 1 (PCF_PROPERTIES)
        0x00, 0x00, 0x00, 0x00,  // format
        0x23, 0x00, 0x00, 0x00,  // len_body: 35
        0x18, 0x00, 0x00, 0x00,  // ofs_body: 24

        // === PropertiesTableBody at offset 24 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x01, 0x00, 0x00, 0x00,  // num_props: 1
        // props[0]: ofs_name=0, is_string=1, value_or_ofs_value=5
        0x00, 0x00, 0x00, 0x00,  // ofs_name
        0x01,                    // is_string
        0x05, 0x00, 0x00, 0x00,  // value_or_ofs_value (offset to "hello")
        // padding to 4-byte boundary (position 17 -> 20, need 3 bytes)
        0x00, 0x00, 0x00,
        // len_strings: 11
        0x0b, 0x00, 0x00, 0x00,
        // strings: "FONT\0hello\0"
        0x46, 0x4f, 0x4e, 0x54, 0x00,  // "FONT\0"
        0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00  // "hello\0"
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 1,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 35,
          ofs_body: 24
        }]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 1,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 35,
          ofs_body: 24,
          body: {
            type: "PropertiesTableBody",
            value: {
              format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
              num_props: 1,
              props: [{ ofs_name: 0, is_string: 1, value_or_ofs_value: 5 }],
              len_strings: 11,
              strings: [0x46, 0x4f, 0x4e, 0x54, 0x00, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00]
            }
          }
        }],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with metrics table (type=4)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        0x04, 0x00, 0x00, 0x00,  // type: 4 (PCF_METRICS)
        0x00, 0x00, 0x00, 0x00,  // format
        0x14, 0x00, 0x00, 0x00,  // len_body: 20
        0x18, 0x00, 0x00, 0x00,  // ofs_body: 24

        // === MetricsTableBody at offset 24 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x01, 0x00, 0x00, 0x00,  // num_metrics: 1
        // metrics[0]: Metric struct (12 bytes, all int16 little-endian)
        0xfe, 0xff,  // left_side_bearing: -2
        0x0a, 0x00,  // right_side_bearing: 10
        0x08, 0x00,  // character_width: 8
        0x0c, 0x00,  // character_ascent: 12
        0x03, 0x00,  // character_descent: 3
        0x00, 0x00   // character_attributes: 0
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 4,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 20,
          ofs_body: 24
        }]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 4,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 20,
          ofs_body: 24,
          body: {
            type: "MetricsTableBody",
            value: {
              format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
              num_metrics: 1,
              metrics: [{
                left_side_bearing: -2,
                right_side_bearing: 10,
                character_width: 8,
                character_ascent: 12,
                character_descent: 3,
                character_attributes: 0
              }]
            }
          }
        }],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with ink_metrics table (type=16/0x10)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        0x10, 0x00, 0x00, 0x00,  // type: 16 (PCF_INK_METRICS)
        0x00, 0x00, 0x00, 0x00,  // format
        0x14, 0x00, 0x00, 0x00,  // len_body: 20
        0x18, 0x00, 0x00, 0x00,  // ofs_body: 24

        // === InkMetricsTableBody at offset 24 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x01, 0x00, 0x00, 0x00,  // num_metrics: 1
        // metrics[0]: ink bounds
        0x00, 0x00,  // left_side_bearing: 0
        0x08, 0x00,  // right_side_bearing: 8
        0x08, 0x00,  // character_width: 8
        0x0a, 0x00,  // character_ascent: 10
        0x02, 0x00,  // character_descent: 2
        0x00, 0x00   // character_attributes: 0
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 16,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 20,
          ofs_body: 24
        }]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 16,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 20,
          ofs_body: 24,
          body: {
            type: "InkMetricsTableBody",
            value: {
              format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
              num_metrics: 1,
              metrics: [{
                left_side_bearing: 0,
                right_side_bearing: 8,
                character_width: 8,
                character_ascent: 10,
                character_descent: 2,
                character_attributes: 0
              }]
            }
          }
        }],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with bdf_encodings table (type=32/0x20)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        0x20, 0x00, 0x00, 0x00,  // type: 32 (PCF_BDF_ENCODINGS)
        0x00, 0x00, 0x00, 0x00,  // format
        0x14, 0x00, 0x00, 0x00,  // len_body: 20
        0x18, 0x00, 0x00, 0x00,  // ofs_body: 24

        // === BdfEncodingsTableBody at offset 24 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x20, 0x00,  // min_char_or_byte2: 32 (space)
        0x22, 0x00,  // max_char_or_byte2: 34 (")
        0x00, 0x00,  // min_byte1: 0
        0x00, 0x00,  // max_byte1: 0
        0x20, 0x00,  // default_char: 32
        // glyph_indexes: (34-32+1)*(0-0+1) = 3 entries
        0x00, 0x00,  // char 32 (space) -> glyph 0
        0x01, 0x00,  // char 33 (!) -> glyph 1
        0x02, 0x00   // char 34 (") -> glyph 2
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 32,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 20,
          ofs_body: 24
        }]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 32,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 20,
          ofs_body: 24,
          body: {
            type: "BdfEncodingsTableBody",
            value: {
              format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
              min_char_or_byte2: 32,
              max_char_or_byte2: 34,
              min_byte1: 0,
              max_byte1: 0,
              default_char: 32,
              glyph_indexes: [0, 1, 2]
            }
          }
        }],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with glyph_names table (type=128/0x80)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        0x80, 0x00, 0x00, 0x00,  // type: 128 (PCF_GLYPH_NAMES)
        0x00, 0x00, 0x00, 0x00,  // format
        0x18, 0x00, 0x00, 0x00,  // len_body: 24
        0x18, 0x00, 0x00, 0x00,  // ofs_body: 24

        // === GlyphNamesTableBody at offset 24 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x02, 0x00, 0x00, 0x00,  // num_glyphs: 2
        // names[0]: ofs_string=0 -> "A"
        0x00, 0x00, 0x00, 0x00,
        // names[1]: ofs_string=2 -> "B"
        0x02, 0x00, 0x00, 0x00,
        // len_strings: 4
        0x04, 0x00, 0x00, 0x00,
        // strings: "A\0B\0"
        0x41, 0x00, 0x42, 0x00
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 128,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 24,
          ofs_body: 24
        }]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 128,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 24,
          ofs_body: 24,
          body: {
            type: "GlyphNamesTableBody",
            value: {
              format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
              num_glyphs: 2,
              names: [{ ofs_string: 0 }, { ofs_string: 2 }],
              len_strings: 4,
              strings: [0x41, 0x00, 0x42, 0x00]
            }
          }
        }],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with accelerators table (type=2)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        0x02, 0x00, 0x00, 0x00,  // type: 2 (PCF_ACCELERATORS)
        0x00, 0x00, 0x00, 0x00,  // format
        0x30, 0x00, 0x00, 0x00,  // len_body: 48
        0x18, 0x00, 0x00, 0x00,  // ofs_body: 24

        // === AcceleratorsTableBody at offset 24 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x01,  // no_overlap
        0x00,  // constant_metrics
        0x00,  // terminal_font
        0x01,  // constant_width
        0x01,  // ink_inside
        0x00,  // ink_metrics
        0x00,  // draw_direction (left to right)
        0x00,  // padding
        0x0c, 0x00, 0x00, 0x00,  // font_ascent: 12
        0x03, 0x00, 0x00, 0x00,  // font_descent: 3
        0x00, 0x00, 0x00, 0x00,  // max_overlap: 0
        // min_bounds: Metric (12 bytes)
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        // max_bounds: Metric (12 bytes)
        0x00, 0x00, 0x08, 0x00, 0x08, 0x00, 0x0c, 0x00, 0x03, 0x00, 0x00, 0x00
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 2,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 48,
          ofs_body: 24
        }]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 2,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 48,
          ofs_body: 24,
          body: {
            type: "AcceleratorsTableBody",
            value: {
              format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
              no_overlap: 1,
              constant_metrics: 0,
              terminal_font: 0,
              constant_width: 1,
              ink_inside: 1,
              ink_metrics: 0,
              draw_direction: 0,
              padding: 0,
              font_ascent: 12,
              font_descent: 3,
              max_overlap: 0,
              min_bounds: { left_side_bearing: 0, right_side_bearing: 0, character_width: 0, character_ascent: 0, character_descent: 0, character_attributes: 0 },
              max_bounds: { left_side_bearing: 0, right_side_bearing: 8, character_width: 8, character_ascent: 12, character_descent: 3, character_attributes: 0 }
            }
          }
        }],
        _has_nested_instances: 1
      }
    },
    {
      description: "PCF with bdf_accelerators table (type=256/0x100)",
      bytes: [
        // === Header (offset 0-7) ===
        0x01, 0x66, 0x63, 0x70,
        0x01, 0x00, 0x00, 0x00,

        // === Table entry (offset 8-23) ===
        0x00, 0x01, 0x00, 0x00,  // type: 256 (PCF_BDF_ACCELERATORS)
        0x00, 0x00, 0x00, 0x00,  // format
        0x48, 0x00, 0x00, 0x00,  // len_body: 72
        0x18, 0x00, 0x00, 0x00,  // ofs_body: 24

        // === BdfAcceleratorsTableBody at offset 24 ===
        0x00, 0x00, 0x00, 0x00,  // format
        0x01,  // no_overlap
        0x00,  // constant_metrics
        0x00,  // terminal_font
        0x01,  // constant_width
        0x01,  // ink_inside
        0x01,  // ink_metrics
        0x00,  // draw_direction
        0x00,  // padding
        0x0c, 0x00, 0x00, 0x00,  // font_ascent: 12
        0x03, 0x00, 0x00, 0x00,  // font_descent: 3
        0x00, 0x00, 0x00, 0x00,  // max_overlap: 0
        // min_bounds: Metric (12 bytes)
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        // max_bounds: Metric (12 bytes)
        0x00, 0x00, 0x08, 0x00, 0x08, 0x00, 0x0c, 0x00, 0x03, 0x00, 0x00, 0x00,
        // ink_min_bounds: Metric (12 bytes)
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        // ink_max_bounds: Metric (12 bytes)
        0x00, 0x00, 0x08, 0x00, 0x08, 0x00, 0x0a, 0x00, 0x02, 0x00, 0x00, 0x00
      ],
      value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 256,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 72,
          ofs_body: 24
        }]
      },
      decoded_value: {
        magic: [0x01, 0x66, 0x63, 0x70],
        num_tables: 1,
        tables: [{
          table_type: 256,
          format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
          len_body: 72,
          ofs_body: 24,
          body: {
            type: "BdfAcceleratorsTableBody",
            value: {
              format: { padding1: 0, scan_unit_mask: 0, is_msb_first: 0, is_big_endian: 0, glyph_pad_mask: 0, format_byte: 0, padding: 0 },
              no_overlap: 1,
              constant_metrics: 0,
              terminal_font: 0,
              constant_width: 1,
              ink_inside: 1,
              ink_metrics: 1,
              draw_direction: 0,
              padding: 0,
              font_ascent: 12,
              font_descent: 3,
              max_overlap: 0,
              min_bounds: { left_side_bearing: 0, right_side_bearing: 0, character_width: 0, character_ascent: 0, character_descent: 0, character_attributes: 0 },
              max_bounds: { left_side_bearing: 0, right_side_bearing: 8, character_width: 8, character_ascent: 12, character_descent: 3, character_attributes: 0 },
              ink_min_bounds: { left_side_bearing: 0, right_side_bearing: 0, character_width: 0, character_ascent: 0, character_descent: 0, character_attributes: 0 },
              ink_max_bounds: { left_side_bearing: 0, right_side_bearing: 8, character_width: 8, character_ascent: 10, character_descent: 2, character_attributes: 0 }
            }
          }
        }],
        _has_nested_instances: 1
      }
    }
  ]
});
