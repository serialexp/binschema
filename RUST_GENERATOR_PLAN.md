# Rust Generator Implementation Plan

## Current State (2025-12-01 - Updated)

### Architecture
**The Rust generator is implemented in TypeScript** at `packages/binschema/src/generators/rust.ts` (~1300 lines), following the same pattern as the Go generator.

### Test Infrastructure
- **Test harness**: `rust/tests/compile_batch.rs` (~600 lines)
- **Runtime library**: `rust/src/bitstream.rs` (working, with peek/seek support)
- **Test schema types**: `rust/src/test_schema.rs` (updated with union types)

### Latest Test Results
```
Test files found:    290
Code gen succeeded:  261 (90%)  ← Up from 220 (76%)
Code gen failed:     17         ← Down from 58
Compilation:         BLOCKED (root context issues in computed fields)
```

### Session Progress (2025-12-01 Session 2)
**Improvements from 220 → 261 code gen (76% → 90%)**

1. **Implemented discriminated unions (Choice types)**
   - Added `generateDiscriminatedUnion()` for top-level union types
   - Added `generateUnionEnum()` for inline choice/union types in arrays
   - Added `collectInlineUnionTypes()` to find and generate enums for inline unions
   - Fixed `generateDecodeArrayItem()` to use correct enum names for choice types

2. **Added `field_referenced` string support**
   - Encoding: Write bytes directly (length is in another field)
   - Decoding: Read length from previously decoded field

3. **Added multiple array kinds**
   - `byte_length_prefixed`: Read byte length, decode until position reached
   - `length_prefixed_items`: Read count, decode that many items
   - `computed_count`: Use expression for count (basic support)
   - `variant_terminated`: Loop until terminator variant
   - `signature_terminated`: Loop until signature match

4. **Fixed Rust test_schema.rs**
   - Added `choices`, `variants`, `discriminator`, `computed`, `length_encoding` to Field struct
   - Added `ChoiceVariant` and `UnionVariant` structs
   - Added `DiscriminatedUnion` variant to `TypeDef` enum
   - This was critical - serde was dropping unknown fields before re-serializing!

5. **Enhanced runtime library**
   - Added `peek_uint8()`, `peek_uint16()`, `peek_uint32()` for discriminator peeking
   - Added `position()` and `seek()` for backtracking in try-each-variant pattern
   - Added `read_varlength()` for DER-style variable length encoding
   - Added `InvalidVariant` and `NotImplemented` error types

## What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Primitives (u8-64, i8-64) | ✅ Working | All endianness variants tested |
| Float32/64 | ✅ Generator works | Test harness needs float literal fixes |
| Bit fields | ✅ Working | MSB/LSB bit order support |
| Bitfields | ✅ Generator works | Generates as packed integers |
| Fixed arrays | ✅ Working | `kind: "fixed"` |
| Field-referenced arrays | ✅ Working | `kind: "field_referenced"` |
| Length-prefixed arrays | ✅ Working | `kind: "length_prefixed"` |
| Byte-length-prefixed arrays | ✅ Working | `kind: "byte_length_prefixed"` |
| Length-prefixed-items arrays | ✅ Working | `kind: "length_prefixed_items"` |
| Nested structs | ✅ Working | Type references resolved |
| Strings (basic) | ✅ Working | null_terminated, length_prefixed, fixed |
| Strings (field_referenced) | ✅ Working | Length from another field |
| Optional types | ✅ Working | Proper `Option<T>` encode/decode |
| Discriminated unions (top-level) | ✅ Working | Generates Rust enum with match-based decode |
| Choice types (inline) | ✅ Working | For array items with multiple variant types |
| Reserved keyword escaping | ✅ Working | `type` → `r#type` |
| CLI integration | ✅ Working | `bun run src/cli/index.ts generate --language rust` |
| Varlength types | ✅ Working | DER-style encode/decode in runtime |
| Padding fields | ✅ Handled | Skipped in struct generation |

## Remaining Issues (17 failures)

### 1. DNS Tests - field.type Undefined (17 failures)
All remaining failures are DNS protocol tests with error:
```
TypeError: undefined is not an object (evaluating 'field.type')
```

These tests use complex schema features that need investigation:
- dns_domain_special, dns_compression_*, dns_multi_answer, etc.
- Likely issue: recursive type references or complex conditional structures

**Root cause analysis needed** - The DNS schema has:
- Recursive label types (CompressedLabel)
- Field-based discriminators (referencing earlier fields)
- Complex nested structures

### 2. Compilation Issues (0 code gen, but blocking runtime)
When tests compile, they fail due to:
- `root` not found in scope - computed fields reference parent context
- This requires context-aware code generation for computed fields

## Implementation Checklist

### ✅ Completed
- [x] Discriminated unions (Choice types)
- [x] `field_referenced` string kind
- [x] `byte_length_prefixed` array kind
- [x] `length_prefixed_items` array kind
- [x] `computed_count` array kind (basic)
- [x] `variant_terminated` array kind (basic)
- [x] `signature_terminated` array kind (basic)
- [x] Peek/seek methods in runtime
- [x] Varlength read method in runtime
- [x] Fix test_schema.rs to preserve union types

### 🔲 Remaining
- [ ] Fix field.type undefined in DNS tests (17 failures)
- [ ] Computed field context (`root`, `parent` references)
- [ ] Float literal formatting in test harness
- [ ] Infinity/NaN handling in test harness
- [ ] Nested object construction in test harness

## File Locations

### Generator (TypeScript)
```
packages/binschema/src/generators/rust.ts    # Main generator (~1300 lines)
packages/binschema/src/cli/index.ts          # CLI integration (case "rust")
```

### Runtime (Rust)
```
rust/src/lib.rs              # Crate entry point, error types
rust/src/bitstream.rs        # BitStreamEncoder/Decoder (~400 lines)
rust/src/test_schema.rs      # Test suite types (with union support)
rust/Cargo.toml              # Dependencies: serde, json5, regex
```

### Test Harness (Rust)
```
rust/tests/compile_batch.rs  # Batched test runner (~600 lines)
rust/tests/test_loader.rs    # Suite loading tests
```

## Commands Quick Reference

```bash
# Generate Rust code from schema
cd packages/binschema
bun run src/cli/index.ts generate --language rust --schema path/to/schema.json --out ./output

# Run Rust tests
cd rust && env RUST_TESTS=1 cargo test test_compile_and_run_all -- --nocapture

# Debug specific Rust compilation
cd rust && env RUST_TESTS=1 DEBUG_GENERATED=./debug cargo test test_compile_and_run_all -- --nocapture
# Then examine ./debug/src/*.rs files
```

## Next Steps

1. **Investigate DNS test failures** - The 17 remaining failures all share a common pattern
2. **Fix computed field context** - The `root` reference issue in compiled code
3. **Run full test suite** - Once code gen and compilation succeed, validate actual encode/decode behavior
