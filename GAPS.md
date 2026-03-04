# BinSchema Feature Gap Analysis

Analysis performed 2026-03-03 by thorough exploration of the TypeScript generator, schema definitions, test suites, and real-world example schemas.

## What's Already Excellent

The type system is remarkably complete for binary format definition:

- **Primitives**: uint8-64, int8-64, float32/64, varlength (DER, LEB128, VLQ, EBML)
- **Strings**: fixed, length-prefixed, field-referenced, null-terminated; utf8/ascii/latin1 encodings
- **Arrays**: 10 kinds (fixed, length-prefixed, length-prefixed-items, byte-length-prefixed, field-referenced, null-terminated, signature-terminated, variant-terminated, computed-count, eof-terminated)
- **Bit-level**: bitfields, single bits, multi-byte bits, MSB/LSB ordering
- **Unions**: discriminated_union (peek/field-based), choice (auto-detected from const values)
- **Computed fields**: length_of, count_of, position_of, crc32_of, sum_of_sizes, sum_of_type_sizes
- **Structural**: conditional fields, optional fields, back-references, padding/alignment, enums
- **Random-access**: position fields with seekable parsing
- **Real-world formats modeled**: DNS, ZIP, PNG, MIDI, PCF fonts, Kerberos

## Genuinely Missing Features

Ordered roughly by how often you'd hit them in practice.

### 1. No boolean type

Every protocol has flag bytes. Currently requires `uint8` with 0/1 convention and manual interpretation. A native `bool` (1-byte or 1-bit) mapping to language-native booleans would reduce friction.

**Formats affected**: virtually all protocols

### 2. No UTF-16 string encoding

Currently supports `utf8`, `ascii`, `latin1`. UTF-16 is used in:
- Windows formats (PE headers, SMB, NTFS)
- Java serialization
- BMP/ICO metadata
- USB descriptors
- PDF internals

Both LE and BE variants are needed.

### 3. No raw bytes shorthand

"Give me the next N bytes" is possibly the most common pattern in binary formats. Currently requires:
```json5
{ "type": "array", "items": { "type": "uint8" }, "kind": "fixed", "length": N }
```

A `bytes` type with the same kind options as arrays (fixed, length-prefixed, field-referenced, eof-terminated) would dramatically reduce schema verbosity. In generated code, this would map to `Uint8Array` (TS), `[]byte` (Go), `Vec<u8>` (Rust) instead of number arrays.

**Formats affected**: virtually all binary formats

### 4. No signed variable-length integers

`varlength` only supports unsigned values. Missing encodings:
- **Signed LEB128**: Used in DWARF debug info, WebAssembly (i32/i64 types)
- **ZigZag encoding**: Used in Protocol Buffers (sint32, sint64)

These are distinct wire formats that can't be worked around with unsigned varlength.

**Formats affected**: Protocol Buffers, WebAssembly, DWARF, ELF debug sections

### 5. No arithmetic in computed expressions

Common patterns that can't be expressed:
- `field_value * 512` — sector-based offsets (FAT, ext4, disk images)
- `field_value - 2` — JPEG markers where length includes the length field itself
- `field_value * 4` — word-aligned offsets (ARM, many embedded protocols)
- `field_value + 1` — zero-indexed counts (e.g., "0 means 1 element")

The expression language only supports comparisons and boolean/bitwise operators, not arithmetic.

**Formats affected**: JPEG, FAT/ext4, ARM binaries, many embedded/hardware protocols

### 6. No checksum validation on decode

CRC32 is computed during encode via `computed: { type: "crc32_of", target: "field" }`, but during decode the computed value is just stored — there's no validation that it matches the data. For a format tool, being able to say "validate this CRC on decode and raise an error on mismatch" would catch data corruption.

Could extend to other checksums too: Adler32 (zlib), MD5, SHA-256.

**Formats affected**: PNG, ZIP, Ethernet frames, TCP/UDP, any format with integrity checks

### 7. No bit-shift operators in expressions

`<<` and `>>` are missing from the expression language. Used in formats where:
- `size = value << 4` (block size encoding)
- `offset = value >> 2` (word-aligned offset encoding)
- `flags = value & (1 << bit_index)` (individual bit testing)

**Formats affected**: hardware registers, embedded protocols, multimedia codecs

### 8. No bitmask/flags type

Distinct from bitfields: a `flags` type where a uint8/uint16/uint32 is decoded into a set of named boolean flags.

Bitfields work when bits are contiguous and explicitly defined, but the common "flags register" pattern (scattered named bits with reserved/unused gaps) would benefit from:
```json5
{
  "type": "flags",
  "repr": "uint16",
  "flags": {
    "compressed": 0,
    "encrypted": 1,
    "has_data_descriptor": 3,
    "utf8_names": 11
  }
}
```

This is more natural than a bitfield when bits aren't contiguous.

**Formats affected**: ZIP local file headers, TCP flags, USB endpoint descriptors, ELF section flags

### 9. Field-based discriminators (schema-supported but unimplemented)

The schema allows `discriminator: { field: "earlier_field" }` but **all three generators** throw "not implemented" at code generation time. This is a usability trap — the schema validates fine, but code generation fails.

This is needed when the discriminator is a regular field that was already consumed (not peek-able), such as:
- A `type` field earlier in the struct determines which variant follows
- A bitfield sub-field discriminates the payload

**Current workaround**: Use peek-based discriminators or restructure the schema. But this forces unnatural schema design.

### 10. No `assert` / validation constraints

Beyond `const` (exact match required), there's no way to express:
- Range constraints: `value >= 1 && value <= 10`
- Reserved byte validation: "must be zero"
- Alignment assertions: "must be divisible by 4"
- Enum-like constraints without full enum: "must be one of [1, 2, 4, 8]"

Useful for both format validation and self-documenting schemas.

**Formats affected**: most formats with reserved fields or value constraints

## Smaller Gaps

### Default values for optional/conditional fields
When a conditional/optional field is absent, decoded value is `undefined`. Some formats define default values for absent fields (e.g., "if flag not set, assume version = 1").

### Latin1 string size calculation incomplete
Size calculation for latin1 strings in computed fields throws an error. Only UTF-8 and ASCII are implemented.

### No ternary expressions
Can't write `condition ? value_a : value_b` in conditional or computed expressions.

### Varlength size calculation incomplete
Computed fields that depend on varlength fields can't accurately calculate sizes. Only fixed-size types are reliable.

## Implementation Status Across Generators

| Feature | TypeScript | Go | Rust |
|---------|-----------|-----|------|
| Field-based discriminators | ❌ Throws | ❌ Throws | ❌ Throws |
| Corresponding selectors in CRC32 | ✅ | ✅ | ❌ |
| Inline choice in sequences | ✅ | ❌ | ✅ |
| Parent field references (../) | ✅ | ✅ | ⚠️ Partial |
| Context threading | ✅ Full | ⚠️ Partial | ❌ |
| String type aliases | ✅ | ✅ | ✅ |
| Overall test pass rate | ~99.7% | ~99% | ~69.8% |

## Not Missing (Reasonable Design Decisions)

These were considered but are intentionally out of scope:

- **No compression/decompression**: BinSchema defines wire format, not data transforms
- **No streaming/async decode**: Reasonable for schema-based code generation
- **No type inheritance/generics**: Keeps the type system simple and predictable
- **No recursive self-referential types**: Extremely rare in wire formats
- **No TLV as first-class type**: Can be modeled with discriminated_union + computed length fields
