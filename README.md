# BinSchema

Binary protocol schema definition and code generation tool. Define binary formats in JSON5, generate type-safe parsers and serializers for TypeScript, Go, and Rust.

## Features

- **Bit-level precision** - 1-64 bit fields with configurable bit ordering (MSB/LSB)
- **Rich type system** - Primitives, strings, arrays, discriminated unions, back-references
- **Computed fields** - Auto-calculate lengths, positions, checksums, and counts
- **Multi-language** - Generate TypeScript, Go, and Rust from a single schema
- **Cross-language testing** - JSON test format validates all implementations produce identical output

## Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## CLI Usage

```bash
# Show help
binschema help
binschema help generate
binschema help docs

# Generate TypeScript code
binschema generate --language ts --schema examples/dns.schema.json --out ./generated

# Generate Go code
binschema generate --language go --schema examples/dns.schema.json --out ./generated

# Generate HTML documentation
binschema docs build --schema examples/zip.schema.json --out docs.html
```

## Schema Format

Schemas are defined in JSON5 format:

```json5
{
  "config": {
    "endianness": "big_endian",  // or "little_endian"
    "bit_order": "msb_first"     // or "lsb_first"
  },
  "types": {
    "MessageHeader": {
      "sequence": [
        { "name": "version", "type": "uint8" },
        { "name": "flags", "type": "uint8" },
        { "name": "length", "type": "uint16", "computed": { "type": "length_of", "target": "payload" } },
        { "name": "payload", "type": "array", "kind": "field_referenced", "length_field": "length", "items": { "type": "uint8" } }
      ]
    }
  }
}
```

### Primitive Types

| Type | Size | Description |
|------|------|-------------|
| `uint8`, `int8` | 1 byte | 8-bit integers |
| `uint16`, `int16` | 2 bytes | 16-bit integers |
| `uint32`, `int32` | 4 bytes | 32-bit integers |
| `uint64`, `int64` | 8 bytes | 64-bit integers |
| `float32` | 4 bytes | IEEE 754 single precision |
| `float64` | 8 bytes | IEEE 754 double precision |
| `bitfield` | variable | Bit-level fields (1-64 bits) |

### Array Kinds

| Kind | Description |
|------|-------------|
| `fixed` | Fixed-length array (`length` property) |
| `length_prefixed` | Count prefix before elements (`length_type` property) |
| `byte_length_prefixed` | Byte-length prefix (ASN.1/DER style) |
| `field_referenced` | Length from earlier field (`length_field` property) |
| `null_terminated` | Read until 0x00 byte |
| `variant_terminated` | Read until terminal variant type (`terminal_variants` property) |
| `eof_terminated` | Read until end of stream |

### Computed Fields

```json5
// Auto-compute length of another field
{ "name": "length", "type": "uint16", "computed": { "type": "length_of", "target": "data" } }

// Auto-compute position/offset to another field
{ "name": "offset", "type": "uint32", "computed": { "type": "position_of", "target": "data" } }

// Auto-compute element count
{ "name": "count", "type": "uint8", "computed": { "type": "count_of", "target": "items" } }

// Auto-compute CRC32 checksum
{ "name": "checksum", "type": "uint32", "computed": { "type": "crc32_of", "target": "data" } }
```

### Discriminated Unions

```json5
{
  "type": "discriminated_union",
  "discriminator": { "peek": "uint8" },  // Peek at discriminator without consuming
  "variants": [
    { "type": "TextMessage", "when": "value === 0x01" },
    { "type": "BinaryMessage", "when": "value === 0x02" }
  ]
}
```

## Examples

See the `examples/` directory for complete schemas:

- **DNS Protocol** (`dns.schema.json`) - Domain name compression, bitfields, variable-length labels
- **ZIP Format** (`zip.schema.json`) - File headers, computed CRCs, random-access offsets
- **PNG Format** (`png.schema.json`) - Chunk-based format with variant-terminated arrays
- **MIDI Format** (`midi.schema.json`) - Variable-length quantities (VLQ), track chunks

## Development

```bash
# Run tests
npm test

# Run specific tests
npm test -- --filter=dns

# Debug tests
DEBUG_TEST=1 npm test -- --filter=dns

# Watch mode
npm run watch
```

## Project Structure

```
binschema/
  src/
    schema/        # Zod schemas and validation
    generators/    # Code generators (TypeScript, Go, Rust, HTML)
    runtime/       # Reference encoder/decoder implementation
    tests/         # Test suites
    cli/           # Command-line interface
  examples/        # Example schemas
  go/              # Go implementation
  rust/            # Rust implementation (experimental)
```

## License

MIT
