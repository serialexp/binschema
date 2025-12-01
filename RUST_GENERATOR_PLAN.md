# Rust Generator Implementation Plan

## Current State (2025-12-01)

### Architecture Change
**The Rust generator is now implemented in TypeScript** at `packages/binschema/src/generators/rust.ts` (~1000 lines), following the same pattern as the Go generator. The old `rust/src/codegen.rs` was removed.

### Test Infrastructure
- **Test harness**: `rust/tests/compile_batch.rs` (~600 lines)
- **Runtime library**: `rust/src/bitstream.rs` (working)
- **Test schema types**: `rust/src/test_schema.rs`

### Latest Test Results
```
Test files found:    290
Code gen succeeded:  220 (76%)
Code gen failed:     58
Compilation:         FAILED (blocked by discriminated unions, varlength runtime)
```

### Recent Progress (2025-12-01)
**Improvements from 192 → 220 code gen (66% → 76%)**

1. **Fixed optional type handling** - Added proper encode/decode for `Option<T>` fields
2. **Fixed conditional field handling** - Added null checks for unnamed fields
3. **Fixed test_schema.rs** - Added missing fields: `length_field`, `value_type`, `align_to`, `const`, `size`, `fields`
4. **Added varlength type support** - Maps to u64, generates encode/decode (runtime methods pending)
5. **Added bitfield type support** - Maps to sized integer, generates encode/decode
6. **Added padding type handling** - Skips padding fields in struct generation

### Commits Made
1. `1d25a69` - feat(rust): add Rust code generator (initial implementation)
2. `a7ac1a3` - feat(rust): add test harness and CLI integration
3. `0fdd39d` - feat(rust): run all tests, handle failures gracefully

## What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Primitives (u8-64, i8-64) | ✅ Working | All endianness variants tested |
| Float32/64 | ✅ Generator works | Test harness needs float literal fixes |
| Bit fields | ✅ Working | MSB/LSB bit order support |
| Bitfields | ✅ Generator works | Generates as packed integers (sub-fields not yet supported) |
| Fixed arrays | ✅ Working | `kind: "fixed"` |
| Field-referenced arrays | ✅ Working | `kind: "field_referenced"` |
| Length-prefixed arrays | ✅ Working | `kind: "length_prefixed"` |
| Nested structs | ✅ Working | Type references resolved |
| Strings (basic) | ✅ Working | null_terminated, length_prefixed, fixed |
| Optional types | ✅ Working | Proper `Option<T>` encode/decode |
| Reserved keyword escaping | ✅ Working | `type` → `r#type` |
| CLI integration | ✅ Working | `bun run src/cli/index.ts generate --language rust` |
| Varlength types | ✅ Generator works | Maps to u64 (runtime methods pending) |
| Padding fields | ✅ Handled | Skipped in struct generation |

## Blocking Issues (Priority Order)

### 1. Discriminated Unions (HIGH PRIORITY)
Discriminated unions (`Choice` types) are not yet implemented. Currently generates a TODO comment.

### 2. Varlength Runtime Methods
Generated code calls `encoder.write_varlength()` and `decoder.read_varlength()` but these methods don't exist in the Rust runtime yet.

### 3. ~~Optional Type Generation~~ (FIXED)
~~The struct field type is correct (`Option<T>`), but encode/decode methods are wrong:~~

```typescript
// Current broken code in generateEncodeField():
case "optional":
  // Falls through to default case which calls .encode() on Option

// Current broken code in generateDecodeField():
default:
  // Treats it as nested struct, calls Optional::decode_with_decoder()
```

**Fix needed** - Add explicit handling in `generateEncodeField()` and `generateDecodeField()`:

```rust
// Encode (needs to be generated):
if let Some(v) = self.field_name {
    encoder.write_uint8(1); // present marker
    // encode v based on value_type
} else {
    encoder.write_uint8(0); // absent marker
}

// Decode (needs to be generated):
let has_value = decoder.read_uint8()? != 0;
let field_name = if has_value {
    Some(/* decode based on value_type */)
} else {
    None
};
```

### 2. Conditional Field Handling (HIGH PRIORITY)
**Error**: `undefined is not an object (evaluating 'name.replace')` (~40 failures)

Fields with `if` conditions may have undefined names. Check `generateEncodeField()` and `generateDecodeField()` - they call `toRustFieldName(field.name)` but `field.name` can be undefined for conditional fields.

**Fix**: Add null check before calling `toRustFieldName()`.

### 3. Missing Array Kinds

| Kind | Error | Fix Location |
|------|-------|--------------|
| `length_prefixed_items` | Unknown array kind | `generateDecodeArray()` |
| `computed_count` | Unknown array kind | `generateDecodeArray()` |
| `byte_length_prefixed` | Unknown array kind | `generateDecodeArray()` |
| `variant_terminated` | Unknown array kind | `generateDecodeArray()` |
| `signature_terminated` | Unknown array kind | `generateDecodeArray()` |

### 4. Missing String Kinds

| Kind | Error | Fix Location |
|------|-------|--------------|
| `field_referenced` | Unknown string kind | `generateEncodeString()`, `generateDecodeString()` |

### 5. Type Prefixing in Batched Compilation
**File**: `rust/tests/compile_batch.rs`

The `prefix_type_names()` function doesn't catch all type reference patterns. Some nested types like `Padding`, `Varlength` aren't being prefixed.

**Current patterns handled**:
- `: TypeName,` (field with comma)
- `: TypeName ` (field with space)
- `<TypeName>` (generic)
- `TypeName::` (method call)
- `-> TypeName` (return type)

**Missing patterns**:
- Inline type annotations in complex expressions
- Type references in match arms

## Test Harness Notes

### Running Tests
```bash
# Run all Rust tests (requires env var to avoid slow CI)
cd rust && env RUST_TESTS=1 cargo test test_compile_and_run_all -- --nocapture

# Save generated code for debugging
cd rust && env RUST_TESTS=1 DEBUG_GENERATED=./debug-output cargo test test_compile_and_run_all -- --nocapture
```

### Test Harness Limitations

1. **Float literals**: Integer values aren't converted to float literals (1 vs 1.0)
2. **Infinity/NaN**: Need proper f64::INFINITY, f64::NAN handling
3. **Nested objects**: `format_value()` doesn't handle nested struct construction

## File Locations

### Generator (TypeScript)
```
packages/binschema/src/generators/rust.ts    # Main generator (~860 lines)
packages/binschema/src/cli/index.ts          # CLI integration (case "rust")
packages/binschema/src/tests/generators/rust-codegen.test.ts  # Generator tests
```

### Runtime (Rust)
```
rust/src/lib.rs              # Crate entry point
rust/src/bitstream.rs        # BitStreamEncoder/Decoder (~300 lines)
rust/src/test_schema.rs      # Test suite types
rust/Cargo.toml              # Dependencies: serde, json5, regex
```

### Test Harness (Rust)
```
rust/tests/compile_batch.rs  # Batched test runner (~600 lines)
rust/tests/test_loader.rs    # Suite loading tests
rust/tests/test_runner.rs    # Legacy runner (unused)
```

## Implementation Checklist

### Phase 1: Get Compilation Working
- [ ] Fix optional type encode/decode generation
- [ ] Add null check for conditional field names
- [ ] Fix type prefixing edge cases

### Phase 2: Add Missing Array Kinds
- [ ] `length_prefixed_items`
- [ ] `computed_count`
- [ ] `byte_length_prefixed`
- [ ] `variant_terminated`
- [ ] `signature_terminated`

### Phase 3: Add Missing String Kinds
- [ ] `field_referenced`

### Phase 4: Fix Test Harness
- [ ] Float literal formatting
- [ ] Infinity/NaN handling
- [ ] Nested object construction

### Phase 5: Advanced Features
- [ ] Conditional fields with expressions
- [ ] Discriminated unions
- [ ] Computed fields (length_of, count_of, position_of)
- [ ] Varlength encoding

## TypeScript Generator Reference

The Go generator at `packages/binschema/src/generators/go.ts` (~1100 lines) is the closest reference for the Rust generator. Key functions to compare:

| Function | Purpose |
|----------|---------|
| `generateGo()` / `generateRust()` | Entry point |
| `generateStruct()` | Struct definition |
| `generateEncodeMethod()` | Encode impl |
| `generateDecodeMethod()` | Decode impl |
| `generateEncodeField()` | Per-field encode |
| `generateDecodeField()` | Per-field decode |
| `mapFieldToGoType()` / `mapFieldToRustType()` | Type mapping |

## Commands Quick Reference

```bash
# Generate Rust code from schema
cd packages/binschema
bun run src/cli/index.ts generate --language rust --schema path/to/schema.json --out ./output

# Run TypeScript tests (includes generator tests)
npm test

# Run Rust tests
cd rust && env RUST_TESTS=1 cargo test test_compile_and_run_all -- --nocapture

# Filter TypeScript tests
npm test -- --filter=rust

# Debug specific Rust compilation
cd rust && env RUST_TESTS=1 DEBUG_GENERATED=./debug cargo test test_compile_and_run_all -- --nocapture
# Then examine ./debug/src/*.rs files
```
