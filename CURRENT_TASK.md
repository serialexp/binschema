# Current Task: Sugar Types (bool, utf16, bytes) — COMPLETE

## Status: COMPLETE (2026-03-03)

Three new sugar types implemented across all generators (TypeScript, Go, Rust, HTML).

---

## What Was Done

### Feature 1: `bool` type
- Sugar over uint8 with true/false instead of 1/0
- Wire format: 1 byte, 0x00 = false, 0x01 = true
- Generated types: `boolean` (TS), `bool` (Go), `bool` (Rust)
- Tests: bool_basic, bool_multiple, bool_with_other_fields, bool_optional

### Feature 2: `utf16` string encoding
- New encoding option for strings using field/global endianness
- 2 bytes per code unit, surrogate pairs for characters outside BMP
- Null termination uses two zero bytes (0x0000)
- Tests: utf16_fixed_big_endian, utf16_fixed_little_endian, utf16_length_prefixed, utf16_null_terminated, utf16_extended_chars, utf16_field_endianness_override

### Feature 3: `bytes` type
- Sugar over `array<uint8>`, removes `items: { type: "uint8" }` boilerplate
- Generated types: `number[]` (TS), `[]byte` (Go), `Vec<u8>` (Rust)
- Delegation pattern: each generator constructs synthetic array field and delegates
- Tests: bytes_fixed, bytes_length_prefixed_uint8, bytes_length_prefixed_uint16, bytes_with_other_fields, bytes_field_referenced

### Files Modified

**Schema & Validation:**
- `packages/binschema/src/schema/binary-schema.ts` — Added BoolFieldSchema, BoolElementSchema, BytesFieldSchema, BytesElementSchema, utf16 encoding option, endianness on strings
- `packages/binschema/src/schema/validator.ts` — Added "bool" and "bytes" to BUILT_IN_TYPES

**TypeScript Generator:**
- `packages/binschema/src/generators/typescript.ts` — Encode/decode for bool, bytes (delegation), utf16 strings
- `packages/binschema/src/generators/typescript/interface-generation.ts` — Type mapping for bool and bytes
- `packages/binschema/src/generators/typescript/type-utils.ts` — Type alias detection for bool/bytes

**Go Generator:**
- `packages/binschema/src/generators/go.ts` — Full bool/bytes/utf16 support (encode, decode, size calculation, type mapping, imports)
- `go/test/compile_batch.go` — Optional bool handling (ptrBool), bytes formatting as []byte

**Rust Generator:**
- `packages/binschema/src/generators/rust.ts` — Full bool/bytes/utf16 support (encode, decode, size, type mapping, optionals)

**HTML Generator:**
- `packages/binschema/src/generators/html.ts` — Display support for bool, bytes, utf16 in documentation

### Test Results

- **TypeScript**: All tests pass (47 new test suites + all existing)
- **Go**: All 47 tests pass, no regressions
- **Rust**: All 707 tests pass, 0 failures

---

## ⚠️ PRIMARY DIRECTIVE - DO NOT MODIFY THIS SECTION ⚠️

**THIS SECTION IS SACROSANCT. IT CANNOT BE CHANGED, REMOVED, OR WEAKENED.**

**All other parts of this document can be modified, but this directive must remain intact.**

### The TypeScript Implementation Is The Reference

The TypeScript generator (`packages/binschema/src/generators/typescript.ts` and `packages/binschema/src/generators/typescript/*.ts`) is the **complete, working reference implementation**. Every problem you encounter in the Go generator has **already been solved** in TypeScript.

### Your Primary Approach

1. **BEFORE writing any Go code**, read the corresponding TypeScript implementation
2. **Study how TypeScript solves the problem** - the architecture, the helper functions, the edge cases
3. **Replicate the TypeScript approach in Go** - same logic, same structure, adapted to Go idioms
4. **Do NOT reinvent solutions** - we have already solved these problems

### Key TypeScript Files To Reference

- `packages/binschema/src/generators/typescript.ts` - Main generator entry point
- `packages/binschema/src/generators/typescript/computed-fields.ts` - CRC32, position_of, length_of, parent refs
- `packages/binschema/src/generators/typescript/array-support.ts` - All array kinds including computed_count
- `packages/binschema/src/generators/typescript/size-calculation.ts` - Size computation for computed fields
- `packages/binschema/src/generators/typescript/type-utils.ts` - Helper functions
- `packages/binschema/src/runtime/bit-stream.ts` - Reference runtime implementation

---

## Pre-existing Issues (Not Addressed)

- `inline_choice_field` / `multiple_inline_choice_fields` — Go generator doesn't handle inline `choice` type generation (gen_75, gen_98)
- 3 Rust generator test failures (string handling, endianness)
- Rust generator: 69.8% pass rate (427/612 tests)

---

**The TypeScript code is the answer. Use it.**
