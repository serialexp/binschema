# BinSchema Feature Gap Analysis

Originally analyzed 2026-03-03. **Updated 2026-05-28** after a re-audit of the
TypeScript/Go/Rust/Python generators, schema definitions, test suites, and a
round of real-world pressure-testing against Apache Parquet/Thrift.

> Source now lives under `packages/binschema/src/` (monorepo layout). Paths in
> this document reflect that.

## What's Already Excellent

The type system is remarkably complete for binary format definition:

- **Primitives**: uint8-64, int8-64, float32/64, **bool**, varlength (DER, LEB128, VLQ, EBML)
- **Strings**: fixed, length-prefixed, field-referenced, null-terminated; **utf8/utf16(LE+BE)/ascii/latin1** encodings
- **Raw bytes**: first-class `bytes` type with the same kind options as arrays (fixed, length-prefixed, field-referenced, byte-length-prefixed, signature-terminated, computed-count) → `Uint8Array`/`[]byte`/`Vec<u8>`
- **Arrays**: 10 kinds (fixed, length-prefixed, length-prefixed-items, byte-length-prefixed, field-referenced, null-terminated, signature-terminated, variant-terminated, computed-count, eof-terminated)
- **Bit-level**: bitfields, single bits, multi-byte bits, MSB/LSB ordering
- **Unions**: discriminated_union (peek/field-based), choice (auto-detected from const values)
- **Computed fields**: length_of, count_of, position_of, crc32_of, sum_of_sizes, sum_of_type_sizes
- **Array transforms**: `delta` (store elements as differences from the previous one — a pure wire transform for sorted/correlated integer columns)
- **Compressed regions**: `compressed` wrapper type with a pluggable codec registry (built-in `store`/`deflate`/`gzip`; inject `zstd`/`lz4`/… via `registerCodec`). Frames `[uncompressed_size][compressed_length][bytes…]`; the inner type encodes/decodes through the codec as a self-contained sub-stream.
- **Expression language**: arithmetic (`+ - * /`) with precedence and parentheses, comparisons, boolean/bitwise operators, field references
- **Structural**: conditional fields, optional fields, back-references, padding/alignment, enums
- **Random-access**: position fields with seekable parsing
- **Streaming**: async-generator decode wrappers (`decode{Type}Stream`) for chunked inputs
- **Generators**: TypeScript (reference), Go, Rust, Python
- **Real-world formats modeled**: DNS, ZIP, PNG, MIDI, PCF fonts, Kerberos

## Genuinely Missing Features

Ordered roughly by how often you'd hit them in practice. The first two are the
features blocking byte-exact Apache Parquet/Thrift output.

### 1. No signed / zigzag variable-length integers

`varlength` only supports unsigned values (`der`, `leb128`, `ebml`, `vlq`). Missing:
- **ZigZag encoding**: maps `0,-1,1,-2,2…` → `0,1,2,3,4…` so small-magnitude negatives stay short, then LEB128. Used by Protocol Buffers (sint32/sint64) and **Apache Thrift compact protocol — every `i16/i32/i64`**.
- **Signed LEB128**: DWARF debug info, WebAssembly (i32/i64 types).

These are distinct wire formats that can't be worked around with unsigned
varlength — the *value* round-trips but the *bytes* don't match a real reader.
This is the single most pervasive gap for Parquet: nearly every Thrift field is
an i32/i64.

**Proposed shape**: add `"encoding": "zigzag"` (or a `"signed": true` flag) to `varlength`.

**Formats affected**: Apache Parquet/Thrift, Protocol Buffers, WebAssembly, DWARF, ELF debug sections

### 2. No packed collection header (count + type tag in one byte)

Thrift lists/maps start with one byte that crams two things together:
`(count << 4) | element_type`, with a `0xF` escape in the low nibble when
`count ≥ 15` (the real count then follows as a varint). BinSchema's `computed`
system can compute a count, but it can't express "shift it left 4, OR in a type
tag, and switch to an escape form past a threshold." Without this, any Thrift
`list<…>` — and the Parquet footer is *made* of lists (`schema`, `row_groups`,
`columns`) — can't be laid out field-by-field.

**Proposed shape**: a small computed-field kind like `packed_count` that knows
the element-type tag and the escape rule.

**Formats affected**: Apache Parquet/Thrift, any Thrift-encoded protocol

### 3. No stateful field-id deltas (running accumulator across fields)

Thrift compact-protocol field headers store the field id as a *delta from the
previous written field*. When a writer omits optional fields, the next field's
delta changes. A fixed-shape writer sidesteps this (every delta is a
compile-time constant), but a general writer that conditionally drops optional
fields needs BinSchema to track "what was the last field id I actually emitted"
and compute the running delta. That's a stateful accumulator across
`conditional`/`optional` fields, which `computed` doesn't have today.

Only required for a *fully general, spec-complete* Thrift encoder — a
fixed-shape Parquet footer (features 1 + 2) does not need it.

**Formats affected**: general Apache Thrift encoders

### 4. No checksum validation on decode

CRC32 is computed during encode via `computed: { type: "crc32_of", target: "field" }`,
but during decode the computed value is just stored — there's no validation that
it matches the data. For a format tool, being able to say "validate this CRC on
decode and raise an error on mismatch" would catch data corruption.

Could extend to other checksums too: Adler32 (zlib), MD5, SHA-256.

**Formats affected**: PNG, ZIP, Ethernet frames, TCP/UDP, any format with integrity checks

### 5. No bit-shift operators in expressions

`<<` and `>>` are missing from the expression language (which now does `+ - * /`).
Used in formats where:
- `size = value << 4` (block size encoding)
- `offset = value >> 2` (word-aligned offset encoding)
- `flags = value & (1 << bit_index)` (individual bit testing)

**Formats affected**: hardware registers, embedded protocols, multimedia codecs

### 6. No bitmask/flags type

Distinct from bitfields: a `flags` type where a uint8/uint16/uint32 is decoded
into a set of named boolean flags. Bitfields work when bits are contiguous and
explicitly defined, but the common "flags register" pattern (scattered named
bits with reserved/unused gaps) would benefit from:
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

### 7. No `assert` / validation constraints

Beyond `const` (exact match required), there's no way to express:
- Range constraints: `value >= 1 && value <= 10`
- Reserved byte validation: "must be zero"
- Alignment assertions: "must be divisible by 4"
- Enum-like constraints without full enum: "must be one of [1, 2, 4, 8]"

Useful for both format validation and self-documenting schemas.

**Formats affected**: most formats with reserved fields or value constraints

## Smaller Gaps

### Field-based discriminators incomplete in Go/Rust encode
The schema allows `discriminator: { field: "earlier_field" }`. It now works in
**TypeScript and Python** (encode + decode) and in **Go/Rust decode**, but the
**Go and Rust encode paths still throw** `field-based discriminator not implemented`
(`go.ts` ~L1847, `rust.ts` ~L1994). Inline (in-array) field-based discriminators
are also still unsupported in TypeScript. The schema validates fine, so this
remains a partial usability trap on the unfinished paths.

### Default values for optional/conditional fields
When a conditional/optional field is absent, decoded value is `undefined`/`nil`/`None`.
Some formats define default values for absent fields (e.g., "if flag not set,
assume version = 1"). No `default_value` support in the schema.

### No ternary expressions
Can't write `condition ? value_a : value_b` in conditional or computed expressions.

### Varlength size calculation incomplete (LEB128/EBML)
Computed-field size calculation now handles DER and VLQ varlength, but **LEB128
and EBML still throw** a "not yet implemented" error
(`typescript/size-calculation.ts` ~L245). Computed fields that depend on
LEB128/EBML-sized fields can't calculate sizes.

## Implementation Status Across Generators

| Feature | TypeScript | Go | Rust | Python |
|---------|-----------|-----|------|--------|
| Field-based discriminators (decode) | ✅ | ✅ | ✅ | ✅ |
| Field-based discriminators (encode) | ✅ | ❌ Throws | ❌ Throws | ✅ |
| Inline (in-array) field-based discriminators | ❌ Throws | ❌ | ❌ | ❌ |
| Corresponding selectors in CRC32 | ✅ | ✅ | ✅ | ⚠️ Partial |
| Inline choice in sequences | ✅ | ❌ | ✅ | ✅ |
| Parent field references (../) | ✅ | ✅ | ✅ | ⚠️ Partial |
| Context threading | ✅ Full | ⚠️ Partial | ✅ Full | ⚠️ Partial |
| String type aliases | ✅ | ✅ | ✅ | ✅ |
| Overall test pass rate | high* | high* | 100% (756/756) | ~93% (730/785) |

\* TypeScript and Go were not freshly re-measured in this audit; both were
near-perfect at last measurement and no regressions are documented. Rust pass
rate jumped from ~70% (March) to 100%. Python is the newest generator and its
remaining failures are tracked in `CURRENT_TASK.md` (encode-time context
threading for selectors, corresponding correlations, multi-level parent refs,
and DNS/ZIP/PCF integration).

## Known Bugs

### ~~Rust: off-by-one in parent-frame depth for `../` references from a nested child struct~~ — FIXED 2026-05-28

When a nested struct referenced a field in its containing struct via `../` *and*
that same struct also contained a nested struct of its own, the Rust generator
resolved the struct's own `../` computed fields against `child_ctx` (which has
the struct's own frame pushed on top for its children), instead of the incoming
`ctx`. The extra frame put the target one level too deep, producing
`InvalidValue("Parent field 'foo' not found at level 1")` at encode time.

Fixed in `rust.ts`: parent-reference computed fields now resolve against the
incoming `ctx` (`parentRefCtxVar`), while tracking-based selectors
(first/last/corresponding/position) continue to use `child_ctx`. Regression test:
`tests/composite/parent-reference-with-nested-struct.test.ts` (passes on all four
generators).

## Not Missing (Reasonable Design Decisions)

These were considered but are intentionally out of scope:

- **No type inheritance/generics**: Keeps the type system simple and predictable
- **No recursive self-referential types**: Extremely rare in wire formats
- **No TLV as first-class type**: Can be modeled with discriminated_union + computed length fields
