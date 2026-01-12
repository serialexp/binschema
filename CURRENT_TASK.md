# Current Task: Go Code Generator Improvements

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

### Why This Matters

Throwing things at the wall to see what sticks is **wasting time**. The TypeScript implementation represents hundreds of hours of solved problems. Use it.

---

## 🎉 ALL FOUNDATIONAL PHASES COMPLETE 🎉

| Phase | Description | Status | Tests |
|-------|-------------|--------|-------|
| Phase 1 | Encoding Context Infrastructure | ✅ COMPLETE | - |
| Phase 2 | Size Calculation (`CalculateSize()`) | ✅ COMPLETE | - |
| Phase 3 | Multi-pass encoding for `from_after_field` | ✅ COMPLETE | 1/1 |
| Phase 4 | Parent reference resolution (`../field`) | ✅ COMPLETE | - |
| Phase 5 | Position tracking with pre-pass | ✅ COMPLETE | 2/2 (first/last) |
| Phase 6 | CRC32 support | ✅ COMPLETE | - |

---

**Status**: In Progress - Go Performance Optimization (Branch: go-perf-optimization)
**Date Started**: 2025-01-07
**Last Updated**: 2025-01-12

## Session Progress (2025-01-12) - Session 25: Go Performance Optimization (WIP)

### Achievement: Benchmark Infrastructure & Optimization Analysis

Created Go benchmarks comparing BinSchema vs Kaitai Struct vs hand-optimized C. Discovered significant optimization opportunities but hit complexity with discriminated union handling.

### Benchmark Results (Before Optimization)

**DNS Query Packet (29 bytes):**
| Implementation | Time | Memory | Allocations | vs C |
|---------------|------|--------|-------------|------|
| **C (hand-optimized)** | 32 ns | 16 B | 1 | 1.0x |
| BinSchema Go | 304 ns | 376 B | 14 | 9.5x |
| Kaitai Go | 330 ns | 840 B | 17 | 10.3x |

**Key Finding**: BinSchema Go is already **faster than Kaitai Go** without any optimization.

### Hand-Optimized Go Proof-of-Concept

Created `benchmarks/go-compare/binschema/dns_optimized.go` with manual optimizations:

| Implementation | Query Time | Response Time | Allocations (Query) |
|---------------|------------|---------------|---------------------|
| Original | 304 ns | 488 ns | 14 |
| Hand-Optimized | 92 ns | 152 ns | 3 |
| C | 32 ns | 35 ns | 1 |

**Achieved 3.3x speedup** with these techniques:
1. **Value type returns** - Return structs directly, not pointers
2. **Zero-copy []byte** - Labels slice into input data, no string copy
3. **No interface{}** - Inline RDATA variants in struct instead of boxing
4. **Minimal decoder** - Simple inline decoder, no abstraction overhead

### Generator Optimization Attempt (Partial)

**Branch**: `go-perf-optimization`

Attempted to modify `packages/binschema/src/generators/go.ts` to generate value-returning decode functions:

**Changes made:**
1. Public `Decode${name}` returns pointer (unchanged API)
2. Internal `decode${name}WithDecoder` returns value type `(${name}, error)`
3. Changed `result := &${name}{}` to `var result ${name}`
4. Changed `return nil, err` to `return result, err` in many places
5. Discriminated union decoders take address: `return &result, nil`

**Issues encountered:**
1. **Discriminated unions**: Interface methods are on pointer receivers, so variant decoders must return pointers or the caller must take address
2. **Cascading changes**: ~60+ places generate `return nil,` in different contexts
3. **Context undefined**: Some generated code paths reference `result` but it's not defined in that scope
4. **Interface assignment**: Value types can't directly satisfy interfaces with pointer receivers

### Files Created

**Benchmark infrastructure** (`benchmarks/go-compare/`):
- `go.mod` - Go module for benchmark
- `benchmark_test.go` - Comprehensive benchmarks
- `binschema/` - BinSchema generated code + optimized variants
- `kaitai/` - Kaitai-generated DNS parser
- `cdns/` - Hand-optimized C DNS parser with CGO wrapper

**Generation scripts** (`benchmarks/`):
- `generate-go-kaitai.ts` - Generates Kaitai Go code from .ksy
- `generate-go-binschema.ts` - Generates BinSchema Go code

### Next Steps for Generator Optimization

The value-return optimization needs a more surgical approach:

1. **Track variant types**: Know which struct types are discriminated union variants
2. **Different codegen paths**:
   - Union variants: Return pointer (for interface satisfaction)
   - Regular structs: Return value (for allocation optimization)
3. **Or simpler**: Just optimize the decoder internals without changing return types

Alternative optimizations that don't require changing return types:
- **Object pooling**: `sync.Pool` for BitStreamDecoder (minimal impact found)
- **[]byte for strings**: Zero-copy slice instead of string allocation
- **Inline decoder**: Skip BitStreamDecoder abstraction for simple reads

### Key Learnings

1. **BinSchema Go is already competitive** - 10% faster than Kaitai Go out of the box
2. **The gap to C is ~10x** - Mostly due to Go's allocation model
3. **Value types help significantly** - 3x speedup in hand-optimized code
4. **Discriminated unions are complex** - Interface semantics complicate value returns
5. **Correctness matters more** - Test suite ensures we don't break anything

---

## Session Progress (2025-01-12) - Session 24: Performance Benchmarking vs Kaitai Struct

### Achievement: Runtime Optimization - 40% Decode Performance Improvement

Created comprehensive benchmarks comparing BinSchema to Kaitai Struct (a comparable tool for parsing existing binary protocols), identified performance bottlenecks via profiling, and implemented optimizations.

### Benchmarking Infrastructure Created

**Files created in `benchmarks/`:**
- `compare-kaitai.ts` - Fair comparison benchmark using DNS packet parsing
- `profile-binschema.ts` - Standalone profiling script
- `profile-standalone.mjs` - Bundled version for 0x flamegraph profiling
- `.generated-bench/` - Generated decoders for benchmarking

**Dependencies added:**
- `kaitai-struct` and `kaitai-struct-compiler` - For generating Kaitai parsers
- `yaml` - For parsing .ksy schema files

### Profiling Results (via 0x flamegraph)

Top hotspots identified in BinSchema decoder:
1. `_SeekableBitStreamDecoder` / `_BitStreamDecoder` constructors - object allocation overhead
2. `readBits` - Using BigInt for ALL bit sizes (even 1-bit reads)
3. `BigIntShiftLeftNoThrow`, `ToBigInt/ToNumber` - Unnecessary type conversions
4. `createReader` / `BufferReader` - Factory function overhead

### Runtime Optimization Implemented

**File modified:** `packages/binschema/src/runtime/bit-stream.ts`

**Change:** Optimized `readBits()` and `writeBits()` to use Number operations for sizes ≤ 32 bits:
- Sizes 1-31: Use fast Number bitwise operations
- Size 32: Special case (since `1 << 32` overflows in JS)
- Sizes 33-64: Use BigInt (unchanged)

### Benchmark Results

**DNS Query Packet (29 bytes, no compression):**
| Library | Before | After | Improvement |
|---------|--------|-------|-------------|
| Kaitai Struct | 650ns | 650ns | (baseline) |
| BinSchema | 1.17-1.33µs | 775ns | ~40% faster |
| Gap | 1.79-2.05x slower | 1.19x slower | Much closer |

**DNS Response Packet (45 bytes, with compression):**
| Library | Before | After | Improvement |
|---------|--------|-------|-------------|
| Kaitai Struct | 750-860ns | 860ns | (baseline) |
| BinSchema | 1.41-1.76µs | 981ns | ~40% faster |
| Gap | 1.75-2.35x slower | 1.14x slower | Much closer |

### Key Findings

1. **BinSchema vs Kaitai is now competitive** - Only ~15% slower for decode-only operations
2. **BinSchema offers more features** - Full encode+decode, native bitfields, discriminated unions, back_references
3. **Further optimization opportunities exist:**
   - Constructor overhead (object pooling/reuse)
   - `createReader` factory allocation
   - Generated code could avoid SeekableBitStreamDecoder when not needed

### Next Steps for Performance

1. **Test Go code generation for Kaitai** - Compare Go implementations
2. **Reduce constructor overhead** - Object pooling or decoder reset methods
3. **Optimize generated code** - Use simpler decoder class when random access not needed
4. **Profile encoder path** - Similar BigInt optimization may help encoding

---

## Session Progress (2025-01-12) - Session 23: crc32_of with Corresponding Selectors (WIP)

### Current Test Status: 643/654 (98.3%)

### Remaining Failures (11 tests)

1. **crc32_of with corresponding<Type> field access** (3 tests):
   - `minimal_zip_single_file`: 1/2 passing
   - `multi_file_utf8_filenames`: 0/1
   - `multi_file_zip`: 0/1
   - Issue: `CentralDirEntry.crc32` uses `crc32_of: ../sections[corresponding<LocalFile>].body`
   - Need to compute CRC32 of the `.body` field from the corresponding LocalFile

2. **DNS compression** (8 tests):
   - `dns_compression_edge_cases`: 0/2
   - `dns_compression_in_answers`: 0/1
   - `dns_compression_mixed`: 0/2
   - `dns_compression_pointer`: 0/3
   - Complex back-reference handling with compression dictionary
   - Uses `back_reference` type with offset_mask and target resolution

### Work In Progress: crc32_of with corresponding field access

**Problem**: The Go generator's `generateComputedFieldEncoding()` function handles corresponding selectors with field access for `length_of` and `count_of`, but not for `crc32_of`. The switch statement at line 824 falls through to default (returning 0).

**Attempted Fix** (`packages/binschema/src/generators/go.ts` lines 848-864):
Added a `case "crc32_of"` to the switch statement that tries to compute CRC32 on the field value.

**Current Issue**: Compile error in generated code:
```
invalid operation: Crc32_computedFieldVal (variable of type []uint8) is not an interface
```

The problem is that when accessing `Crc32_computedTargetItem.Body`, the Go compiler knows the type statically (`[]uint8`), so type assertions don't work. The generated code tries:
```go
Crc32_computedFieldVal := Crc32_computedTargetItem.Body
if byteSlice, ok := Crc32_computedFieldVal.([]byte); ok {  // ERROR: not an interface
```

**Solution Needed**: Since the field type is known at code generation time (from the schema), we should:
1. Check the field type at code-gen time
2. If it's `[]uint8`/`[]byte` (array of uint8), directly call `runtime.CRC32(fieldValue)` without type assertions
3. Only use type assertions when the field type is truly unknown (interface{})

The relevant code is in `packages/binschema/src/generators/go.ts` around line 848-864.

### Files Modified (Uncommitted)

- `packages/binschema/src/generators/go.ts`: Added incomplete `crc32_of` case for corresponding with field access

---

## Session Progress (2025-01-12) - Session 22: Root Context & Alignment Validation

### Achievement: Major Instance Field Cross-Reference Improvements

Overall test results improved from **636/654 (97.2%)** to **643/654 (98.3%)** - **7 more tests passing!**

### Features Implemented

1. **Alignment Validation for Instance Fields** (`packages/binschema/src/generators/go.ts`)
   - Added alignment check generation in `generateInstanceFieldDecoding()`
   - When `instance.alignment` is specified, validates position before seeking
   - Generates error if position is not properly aligned

2. **position_of with Parent References** (`packages/binschema/src/generators/go.ts`)
   - Fixed `position_of` with parent references like `../data`
   - Now computes position as `current_position + size_of_current_field`
   - Uses `getStaticFieldSize()` to determine field size at code generation time

3. **Pre-pass Array Position Tracking** (`packages/binschema/src/generators/go.ts`)
   - Fixed initial offset calculation for array position pre-pass
   - Now computes starting offset as sum of all preceding fields' sizes
   - Fixes `aggregate_size_with_position` and similar tests

4. **Root Field Context for Instance Fields** (`packages/binschema/src/generators/go.ts`)
   - Added `rootFields` parameter to `generateInstanceFieldDecoding()`
   - Passes containing type's sequence fields as `_root.*` entries in context
   - Enables instance types to reference root fields (e.g., `_root.num_sections`)

5. **Instance Field Cross-References** (`packages/binschema/src/generators/go.ts`)
   - Instance fields now track previously decoded instance fields
   - Subsequent instance fields can reference earlier ones via `_root.{instance_name}`
   - Expanded struct fields are also added (e.g., `_root.end_record.num_files`)

6. **should_error Test Support** (`go/test/loader.go`, `go/test/compile_batch.go`)
   - Added `ShouldError` field to TestCase struct
   - Test harness now validates that tests marked `should_error` produce errors
   - Enables testing of error conditions like alignment violations

### Tests Now Passing

| Test Suite | Tests | Status |
|------------|-------|--------|
| `eight_byte_alignment` | 2/2 | ✅ |
| `four_byte_alignment` | 2/2 | ✅ |
| `parent_reference_position` | 1/1 | ✅ |
| `aggregate_size_with_position` | 1/1 | ✅ |
| `elf_like_format` | 1/1 | ✅ |
| `zip_like_format` | 1/1 | ✅ |

### Remaining Features Needed (11 tests failing)

1. **crc32_of with corresponding<Type> field access** (`minimal_zip_single_file`, `multi_file_*`):
   - Currently returns 0 for `crc32_of` with `../sections[corresponding<LocalFile>].body`
   - Need to compute CRC32 of referenced item's field
   - 3 tests affected

2. **DNS compression** (`dns_compression_*`):
   - Complex back-reference handling with compression dictionary
   - Uses `back_reference` type with offset_mask and target resolution
   - 8 tests affected

---

## Session Progress (2025-01-12) - Session 21: Instance Fields & Position-Based Decoding

### Achievement: Instance Fields Now Work in Go

Overall test results improved from **606/654 (93%)** to **636/654 (97.2%)** - **30 more tests passing!**

### Features Implemented

1. **Instance Field Support in Go Generator** (`packages/binschema/src/generators/go.ts`)
   - Added `generateInstanceFieldDecoding()` function for position-based instance fields
   - Added `generatePositionResolution()` for field references, negative offsets, nested paths
   - Added `generateInlineDiscriminatedUnionDecode()` for inline union instance types
   - Modified `generateStruct()` to include instance fields in struct definitions
   - Modified `generateDecodeFunction()` to decode instance fields after sequence fields
   - Instance fields use `decoder.Seek(position)` to jump to data at specific offsets
   - Added context passing for instance types that need field references

2. **Go Runtime Updates** (`go/runtime/bitstream.go`)
   - Added `Bytes()` method to `BitStreamDecoder` for calculating EOF-relative positions

3. **Test Harness Updates** (`go/test/compile_batch.go`)
   - Added `formatInstanceFieldValue()` function for instance field test values
   - Updated `generateValueConstructionWithSchema()` to include instance fields
   - Updated `formatStructValue()` to handle instance fields in nested structs
   - Added special handling for types with instance fields (decode-only testing)
   - Fixed type alias handling for instance field values (e.g., `Uint8` wrapper types)

### Tests Now Passing

| Test Suite | Tests | Status |
|------------|-------|--------|
| `basic_position_fields` | 2/2 | ✅ |
| `instance_union` | 2/2 | ✅ |
| `instance_field_union` | 2/2 | ✅ |
| `pcf_full` | 10/10 | ✅ |
| `pcf_instances` | 1/1 | ✅ |
| `deep_nesting_position_fields` | 1/1 | ✅ |
| `lazy_evaluation` | 1/1 | ✅ |
| `mixed_inline_standalone` | 1/1 | ✅ |
| `multiple_position_fields` | 1/1 | ✅ |
| `negative_positions` | 1/1 | ✅ |
| `nested_position_fields` | 1/1 | ✅ |
| Plus many more position-related tests | | |

### Remaining Features Needed (after Session 21)

> **Note**: Most of these were fixed in Session 22. See above for current status.

1. ~~**Instance fields with cross-references**~~ - ✅ Fixed in Session 22
2. ~~**Alignment validation**~~ - ✅ Fixed in Session 22
3. **DNS compression** - Still pending
4. **crc32_of with corresponding field access** - Still pending

---

## Session Progress (2025-01-12) - Session 20: Corresponding Field Access & Cross-Array Correlation

### Achievement: Corresponding Correlation with Field Access Now Works

Overall test results improved from **597/654 (91%)** to **606/654 (93%)** - **9 more tests passing!**
Fully passing suites increased to **249 suites**.

### Features Implemented

1. **Empty Array Sentinel Value** (`empty_array_correlation`)
   - When `first/last` position selectors find no matches (empty array), return `0xFFFFFFFF` sentinel
   - Added `getSentinelValue()` helper for type-appropriate sentinel values

2. **Corresponding Selector with Field Access** (`context_corresponding_single_array`, `context_multiple_variants_corresponding`)
   - Support for paths like `../blocks[corresponding<DataBlock>].payload`
   - Accesses fields from correlated items in same-array correlation
   - Handles `length_of`, `count_of` computed types

3. **Cross-Array Correlation** (`context_sibling_array_cross_reference`, `context_deep_nesting_cross_reference`)
   - When items in one array reference corresponding items in a sibling array
   - Added `GetAnyArrayIteration()` runtime method for cross-array index lookup
   - Added `generateEncodeArrayWithIterationContext()` for arrays needing iteration context
   - Added `detectTypesUsingCorrespondingSelectors()` to find types with cross-array refs

4. **Deep Nesting Support** (`context_inner_references_outer_array`, `context_deep_nesting_cross_reference`)
   - Fixed parent field lookup to search ALL parents instead of using fixed levelsUp
   - Added `FindParentField()` runtime method that searches through parent chain
   - Works with `../../`, `../../../`, etc. paths regardless of nesting depth

### Changes

**`packages/binschema/src/generators/go.ts`:**
- Added `getSentinelValue()` function for position not found sentinel values
- Updated `parseCorrespondingTarget()` to extract `remainingPath` for field access
- Added corresponding field access handling in `generateComputedFieldEncoding()`
- Added `generateEncodeArrayWithIterationContext()` for cross-array correlation
- Added `detectTypesUsingCorrespondingSelectors()` for type detection
- Changed to use `FindParentField()` instead of `GetParentField()` for corresponding lookups

**`go/runtime/context.go`:**
- Added `GetAnyArrayIteration()` method for cross-array correlation
- Added `FindParentField()` method to search all parents

### Tests Now Passing

| Test Suite | Tests | Status |
|------------|-------|--------|
| `empty_array_correlation` | 1/1 | ✅ |
| `context_corresponding_single_array` | 1/1 | ✅ |
| `context_multiple_variants_corresponding` | 1/1 | ✅ |
| `context_sibling_array_cross_reference` | 1/1 | ✅ |
| `context_deep_nesting_cross_reference` | 1/1 | ✅ |
| `context_inner_references_outer_array` | 1/1 | ✅ |
| `context_error_first_selector_no_match` | 1/1 | ✅ |
| `context_error_last_selector_no_match` | 1/1 | ✅ |

### Remaining Features Needed

1. **Instance fields** (`pcf_*`, `instance_*`):
   - Need `$iter` support for iteration variable references

2. **Position fields with random access** (`basic_position_fields`, `zip_*`):
   - Need seek/random access during decoding for instance fields

3. **DNS compression** (`dns_compression_*`):
   - Complex back-reference handling during decoding

---

## Session Progress (2025-01-12) - Session 19: sum_of_sizes & sum_of_type_sizes Support

### Achievement: sum_of Computed Fields Now Work

Overall test results improved from **587/654 (90%)** to **597/654 (91%)** - **10 more tests passing!**

### Feature: sum_of_sizes and sum_of_type_sizes Computed Fields

**Problem**: The Go generator did not support `sum_of_sizes` or `sum_of_type_sizes` computed fields. These are needed for formats like ZIP where metadata fields contain the total size of all entries of a specific type.

**Implementation**:

1. **sum_of_sizes** - Sums the encoded sizes of multiple specified fields
   - Uses `targets` array with parent references like `["../payload1", "../payload2"]`
   - Iterates each target, gets it from parent context, and computes its size
   - Handles primitives (arrays), strings, and complex types with `CalculateSize()`

2. **sum_of_type_sizes** - Sums the encoded sizes of array elements matching a specific type
   - Uses `target` (parent array reference) and `element_type` (type to filter by)
   - Iterates array elements, filters by type, and sums their `CalculateSize()` values

**Changes**:

- `packages/binschema/src/generators/go.ts`:
  - Added `sum_of_sizes` and `sum_of_type_sizes` cases to `generateComputedValue()` (return `__PARENT_REF__`)
  - Added early-return handling in `generateComputedFieldEncoding()` for both computed types
  - Updated `hasParentReferenceComputedFields()` to detect sum_of types for reflect import
  - Updated `generateEncodeField()` to detect sum_of computed types as parent references

- `go/test/compile_batch.go`:
  - Added type assertion handling for `elem.(Type)` and `elem.(*Type)` patterns in `prefixTypeNames()`

### Tests Now Passing

| Test Suite | Tests | Status |
|------------|-------|--------|
| `sum_of_field_sizes` | 1/1 | ✅ |
| `context_sum_of_type_sizes_basic` | 2/2 | ✅ |
| `context_sum_of_type_sizes_no_matches` | 1/1 | ✅ |
| `context_sum_of_type_sizes_variable_length` | 1/1 | ✅ |
| `context_sum_of_type_sizes_zip_style` | 1/1 | ✅ |
| `array_element_type_size` | 2/2 | ✅ |
| `variable_length_struct_sum` | 1/1 | ✅ |
| `zip_style_aggregate_size` | 1/1 | ✅ |

### Remaining Features Needed

The following tests still need additional features:

1. **Field access on corresponding items** (`context_corresponding_single_array`, `context_multiple_variants_corresponding`):
   - Accessing fields like `../blocks[corresponding<DataBlock>].payload`
   - Requires runtime field lookup on correlated items, not just position

2. **Position fields** (basic_position_fields, etc.):
   - Random access/seek during decoding

3. **DNS compression** (dns_compression_*):
   - Complex back-reference handling during decoding

4. **Instance fields** (`$iter` references):
   - pcf_*, instance_*

---

## Session Progress (2025-01-12) - Session 18: Array Iteration Context & Corresponding Correlation

### Achievement: Corresponding<Type> Position Tracking Now Works

Overall test results improved from **584/654 (89%)** to **587/654 (90%)** - **3 more tests passing!**
- `corresponding_correlation`: 2/2 ✓
- `zip_style_correlation`: 1/1 ✓

### Feature: Array Iteration Context for Corresponding Selectors

**Problem**: The Go generator did not properly support `corresponding<Type>` selectors in `position_of` computed fields. These selectors correlate items across different types in the same choice array (e.g., "the Nth IndexEntry should reference the Nth DataBlock").

**Root Cause**: Three issues:
1. Arrays with length prefixes didn't account for the prefix size in position tracking
2. Array iteration context wasn't being set up during the main encoding loop
3. Type occurrence indices weren't persisting across loop iterations (each iteration got a fresh TypeIndices map)

**Fix** (3 parts):

1. **Pre-pass position offset** (`packages/binschema/src/generators/go.ts`):
   - Added length prefix size adjustment before tracking positions
   - For `length_prefixed` arrays, initial offset now includes the length prefix bytes

2. **Array iteration context with type tracking** (`packages/binschema/src/generators/go.ts`):
   - Added `generateEncodeArrayWithCorresponding()` function for choice arrays that need corresponding tracking
   - Uses indexed loop with `ExtendWithArrayIteration()` for each item
   - Increments type occurrence counters via `IncrementTypeIndex()` before encoding each item
   - Passes the iteration-specific context to item's `EncodeWithContext()`

3. **Shared TypeIndices storage** (`go/runtime/context.go`):
   - Added `TypeIndices map[string]map[string]int` to `EncodingContext` (shared like `Positions`)
   - Updated `IncrementTypeIndex()` and `GetTypeIndex()` to use context-level storage
   - TypeIndices persists across loop iterations via shared reference

4. **Type occurrence index for correlation** (`packages/binschema/src/generators/go.ts`):
   - Updated computed field encoding to use type occurrence index for `corresponding<Type>` lookups
   - Uses `typeIndex - 1` (counter was incremented before encoding) as correlation index
   - Passes containing type name through call chain for accurate lookups

### Tests Now Passing

| Test Suite | Tests | Status |
|------------|-------|--------|
| `corresponding_correlation` | 2/2 | ✅ |
| `zip_style_correlation` | 1/1 | ✅ |

### Remaining Correlation Features Needed

The following tests still need additional features:

1. **Field access on corresponding items** (`context_corresponding_single_array`, `context_multiple_variants_corresponding`):
   - Accessing fields like `../blocks[corresponding<DataBlock>].payload`
   - Requires runtime field lookup on correlated items, not just position

2. **sum_of computed fields** (`context_sum_of_type_sizes_*`, `sum_of_field_sizes`, `zip_style_aggregate_size`):
   - Not implemented yet - aggregates sizes of array elements

3. **Cross-array references** (`context_sibling_array_cross_reference`, `context_inner_references_outer_array`):
   - References between sibling arrays or outer array from inner context

4. **Error handling tests** (`context_error_first_selector_no_match`, `context_error_last_selector_no_match`):
   - Tests for proper error messages when selectors don't find matches

### Files Modified

- `packages/binschema/src/generators/go.ts`:
  - Added `detectArraysNeedingCorrespondingTracking()` function
  - Added `generateEncodeArrayWithCorresponding()` function
  - Updated `generateEncodeField()` to use special encoding for choice arrays with corresponding
  - Updated `generateComputedFieldEncoding()` to accept and use `containingTypeName`
  - Fixed pre-pass position tracking to account for length prefix size
  - Updated corresponding selector logic to use type occurrence index

- `go/runtime/context.go`:
  - Added `TypeIndices` field to `EncodingContext`
  - Updated `NewEncodingContext()`, `ExtendWithParent()`, `ExtendWithArrayIteration()` to share TypeIndices
  - Updated `GetTypeIndex()` and `IncrementTypeIndex()` to use context-level TypeIndices

---

## Session Progress (2025-01-12) - Session 17: Test Harness Fixes & Latin-1 Support

### Achievement: Major Test Pass Rate Improvement from 85% to 89%

Overall test results improved from **557/654 (85%)** to **584/654 (89%)** - **27 more tests passing!**
Fully passing suites increased from 218 to **231 suites**.

### Bug Fix 1: Empty String Arrays in Test Harness

**Problem**: Empty arrays of strings were being formatted as `nil` instead of `[]string{}`, causing `reflect.DeepEqual` to fail when comparing decoded values (which are non-nil empty slices) with expected values.

**Root Cause**: In `formatValueWithType()`, empty slices returned `nil`. Additionally, `formatArrayWithSchema()` didn't have specific handling for inline string arrays.

**Fix** (`go/test/compile_batch.go`):
- Added `itemType == "string"` case in `formatArrayWithSchema()` to properly format string arrays as `[]string{}` or `[]string{"a", "b"}`.

### Bug Fix 2: Latin-1 String Encoding Support

**Problem**: Strings with Latin-1 encoding were being written as UTF-8 bytes instead of Latin-1 bytes. For example, `é` was written as `[0xc3, 0xa9]` (UTF-8) instead of `[0xe9]` (Latin-1).

**Root Cause**: The Go generator's `generateEncodeString()` always used `[]byte(str)` which gives UTF-8 bytes, ignoring the encoding setting.

**Fix** (`packages/binschema/src/generators/go.ts`):
- **Encoding**: For `latin1` or `ascii` encoding, iterate over runes and take each as a byte: `byte(r)`
- **Decoding**: For `latin1` or `ascii` encoding, convert each byte to a rune and build string from runes

**Tests fixed**: All 4 latin1 test suites now pass (13/13 tests):
- `latin1_fixed_string`: 4/4
- `latin1_length_prefixed`: 5/5
- `latin1_null_terminated`: 3/3
- `latin1_vs_ascii`: 1/1

### Bug Fix 3: String Type Alias Test Value Construction

**Problem**: String type aliases (like `Label` defined as `{type: "string", ...}`) were not having their test values properly constructed. The Go generator wraps these in a struct with a `Value` field, but the test harness was generating empty structs.

**Root Cause**: `generateValueConstructionWithSchema()` didn't detect string type aliases and wrap the string value in `{Value: "..."}`.

**Fix** (`go/test/compile_batch.go`):
- Added string type alias detection at the start of `generateValueConstructionWithSchema()`
- When `typeDef["type"] == "string"` and value is a string, generate `TypeName{Value: "..."}`.

**Tests fixed**: All 6 dns_label test suites now pass (11/11 tests).

### Bug Fix 4: Array Type Alias Test Value Construction

**Problem**: Array type aliases (like `DomainName` defined as `{type: "array", ...}`) were not having their test values properly constructed. The test harness was generating empty structs instead of `TypeName{Value: []ItemType{...}}`.

**Root Cause**: `generateValueConstructionWithSchema()` didn't detect array type aliases and format the array value properly.

**Fix** (`go/test/compile_batch.go`):
- Added array type alias detection after string type alias check
- When `typeDef["type"] == "array"` and value is an array, format using `formatArrayTypeAliasValue()` and wrap in struct.

### Bug Fix 5: String Type Reference Arrays

**Problem**: Arrays of string type aliases (like `[]Label` where `Label` is a string type) were not properly formatting element values. Each string element needed to be wrapped in `{Value: "..."}`.

**Root Cause**: `formatArrayWithSchema()` checked for struct type references but not string type references. When iterating over elements, it expected maps but got strings.

**Fix** (`go/test/compile_batch.go`):
- Added `typeDefType == "string"` check in the type reference handling section
- Format each string element as `{Value: "..."}` when the item type is a string alias

**Tests fixed**: All 4 dns_domain test suites now pass (9/9 tests):
- `dns_domain_multi_label`: 3/3
- `dns_domain_root`: 1/1
- `dns_domain_single_label`: 2/2
- `dns_domain_special`: 3/3

### Test Results

**Before session:**
- Total: 557/654 (85%)
- Fully passing: 218 suites

**After all fixes:**
- Total: 584/654 (89%) (+27 tests)
- Fully passing: 231 suites (+13 suites)

### Remaining Test Failures (48 suites)

The remaining failing tests require more advanced features:

1. **Context/Correlation tests** - `context_*`, `corresponding_*`, `sum_of_*` - need `$iter` and cross-array context
2. **Instance fields** - `instance_*`, `pcf_*` - need instance field support with `$iter`
3. **DNS compression** - need back-reference/pointer resolution during decoding
4. **ZIP format** - need position fields and random access
5. **Position fields** - need random access/seek during decoding

### Files Modified

- `go/test/compile_batch.go`:
  - Added string array handling in `formatArrayWithSchema()`
  - Added string type alias detection in `generateValueConstructionWithSchema()`
  - Added array type alias detection in `generateValueConstructionWithSchema()`
  - Added string type reference handling in `formatArrayWithSchema()`

- `packages/binschema/src/generators/go.ts`:
  - Added Latin-1/ASCII encoding support in `generateEncodeString()`
  - Added Latin-1/ASCII decoding support in `generateDecodeString()`

---

## Session Progress (2025-01-12) - Session 16: Kerberos Test Fixes Complete

### Achievement: All Kerberos Tests Now Pass (15/15)

This session fixed the remaining 2 kerberos test failures, bringing kerberos from 13/15 to **15/15 (100%)**.

Overall test results improved from **555/654 (85%)** to **557/654 (85%)** - **2 more tests passing**.

### Bug Fix 1: Type Alias Handling in Test Harness

**Problem**: Type aliases like `Realm` (which aliases to `KerberosString`) were not being properly formatted in the test harness. The Go generator wraps type aliases in a struct with a `Value` field, but the test harness wasn't generating the correct nested structure.

**Root Cause**: In `formatStructValue()`, `formatValueWithSchema()`, and `formatChoiceArray()`, when encountering a type reference, the code checked for specific types (string, array, discriminated_union) but didn't handle type aliases that reference other user-defined types.

**Fix** (`go/test/compile_batch.go`):
- Added type alias detection in three locations:
  1. `formatStructValue()` - line 971-980
  2. `formatValueWithSchema()` - line 567-575
  3. `formatChoiceArray()` - line 880-889
- When `refTypeType` (the aliased type) is found in the types map, format the value as: `TypeAliasName{Value: AliasedTypeName{...}}`

### Bug Fix 2: Computed `length_of` with `offset` Property

**Problem**: Computed fields with `length_of` and an `offset` property (e.g., `KDCOptions.total_length` which is `length_of: value, offset: 1`) were not adding the offset to the computed length.

**Root Cause**: The `generateComputedValue()` function in the Go generator didn't handle the `computed.offset` property at all.

**Fix** (`packages/binschema/src/generators/go.ts`):
- Added `const offset = computed.offset || 0;` at the start of the `length_of` case
- Modified all return statements to add the offset: `${goType}(${baseExpr} + ${offset})` when offset is non-zero

### Bug Fix 3: `byte_length_prefixed` Array Size Calculation

**Problem**: `CalculateSize()` methods for structs with `byte_length_prefixed` arrays (using varlength/DER prefixes) were not including the size of the length prefix byte(s).

**Root Cause**: The `generateArraySizeCalculation()` function only handled `length_prefixed` and `length_prefixed_items`, not `byte_length_prefixed`.

**Fix** (`packages/binschema/src/generators/go.ts`):
- Added a complete `byte_length_prefixed` case in `generateArraySizeCalculation()`
- For varlength/DER: calculates items size first, then uses `runtime.VarlengthDERSize()` to get the prefix size
- For fixed-size prefixes: adds the fixed prefix size
- Finally adds the items size

### Test Results

**Before session:**
- Kerberos: 13/15 passing
- Overall: 555/654 (85%)

**After all fixes:**
- Kerberos: 15/15 passing (+2)
- Overall: 557/654 (85%) (+2 tests)

### Files Modified

- `go/test/compile_batch.go`:
  - Added type alias handling in `formatStructValue()`
  - Added type alias handling in `formatValueWithSchema()`
  - Added type alias handling in `formatChoiceArray()`

- `packages/binschema/src/generators/go.ts`:
  - Added `offset` property handling in `generateComputedValue()` for `length_of`
  - Added `byte_length_prefixed` case in `generateArraySizeCalculation()` with varlength/DER support

---

## Session Progress (2025-01-11) - Session 15: Multiple Choice Array Fixes

### Achievement: Test Pass Rate Improved from 81% to 85%

This session fixed several significant bugs in the Go generator and test harness, improving overall test results from **533/654 (81%)** to **555/654 (85%)** - **22 more tests passing!**

### Bug Fix 1: Nested `from_after_field` Encoding

**Problem**: When a struct had nested `from_after_field` computed fields (e.g., PrincipalName in Kerberos with both `sequence_length` and `name_string_length`), the nested from_after_field would write its computed length and content to the wrong encoder.

**Root Cause**: In `generateFromAfterFieldEncoding()`, the nested call always wrote to `encoder` (main encoder) instead of the outer `tempEncoder`.

**Fix** (`packages/binschema/src/generators/go.ts`):
1. Added `targetEncoder` parameter to `generateFromAfterFieldEncoding()` (defaults to `"encoder"`)
2. Recursive calls now pass the outer `tempEncoderVar` as the target encoder
3. The computed length and content are written to `targetEncoder` instead of hardcoded `"encoder"`

### Bug Fix 2: Varlength `byte_length_prefixed` Arrays

**Problem**: Arrays with `kind: "byte_length_prefixed"` and `length_type: "varlength"` were not writing the byte length prefix at all.

**Root Cause**: The switch statement for writing byte length prefixes only handled `uint8`, `uint16`, `uint32`, `uint64` - it didn't have a case for `"varlength"`.

**Fix** (`packages/binschema/src/generators/go.ts`):
Added `case "varlength"` to the switch statement that handles `length_encoding` (DER, LEB128, EBML, VLQ) and writes the appropriate varlength encoding.

### Bug Fix 3: Unique Choice Interface Names (Major Architectural Fix)

**Problem**: When a schema had multiple choice arrays (e.g., EncryptedData.fields and KDC_REQ_BODY.fields), they all shared a single `Choice` interface and `decodeChoiceWithDecoder` function. Since different choice arrays have different variant types but may use the same discriminator values (e.g., tags 160, 161, 162), the decoder would try wrong variant types.

**Root Cause**:
1. `collectChoiceTypes()` used hardcoded name `"Choice"` for all choice arrays, causing later definitions to overwrite earlier ones
2. A single shared `decodeChoiceWithDecoder` function was generated for all choice arrays

**Fix** (Following TypeScript's inline approach):
1. **Generator** (`packages/binschema/src/generators/go.ts`):
   - Each choice array now gets a unique interface name: `${TypeName}_${FieldName}_Choice`
   - `collectChoiceTypes()` generates unique names per type+field
   - `mapFieldToGoType()` returns unique interface names for choice arrays
   - `generateDecodeArray()` now inlines switch logic at each call site (like TypeScript does) instead of calling shared function
   - Removed `generateChoiceDecodeFunction()` calls since decoding is now inline

2. **Test Harness** (`go/test/compile_batch.go`):
   - `formatArrayWithSchema()` now accepts `schemaTypeName` and `fieldName` parameters
   - `formatChoiceArray()` constructs unique interface names matching the generator
   - Updated all callers to pass the additional context

### Test Results

**Before session:**
- Kerberos: 8/15 passing
- Overall: 533/654 (81%)

**After all fixes:**
- Kerberos: 13/15 passing (+5)
- Overall: 555/654 (85%) (+22 tests)

### Remaining Kerberos Failures (2 tests)

- `kerberos_as_req`: 0/1
- `kerberos_kdc_req_body`: 0/1

These likely have different issues that need investigation.

### Files Modified

- `packages/binschema/src/generators/go.ts`:
  - Added `targetEncoder` parameter to `generateFromAfterFieldEncoding()`
  - Added `case "varlength"` to byte_length_prefixed encoding
  - Updated `collectChoiceTypes()` to generate unique names
  - Updated `mapFieldToGoType()` for unique choice interface names
  - Updated `generateDecodeArray()` to inline choice decoding
  - Removed shared `generateChoiceDecodeFunction()` call

- `go/test/compile_batch.go`:
  - Updated `formatArrayWithSchema()` signature with new parameters
  - Updated `formatChoiceArray()` to use unique interface names
  - Updated all callers to pass schema type name and field name

---

## Session Progress (2025-01-11) - Session 14: Kerberos Test Harness Bug Fixed

### Achievement: Kerberos Tests Now Compile and Run

This session fixed a **pre-existing test harness bug** that prevented kerberos tests from even compiling. The tests now compile and run - 8/15 pass (with the remaining 7 being actual encoding/decoding issues).

### Problems Fixed

1. **Go Generator Issues:**
   - `ByteOffset()` → `Position()`: Fixed method name for BitStreamEncoder
   - Missing varlength case in `byte_length_prefixed` decoding: Added handler for `length_type: "varlength"`
   - `len()` on struct types → `CalculateSize()`: Fixed computed length_of for struct type targets
   - Added `varlength` to `mapPrimitiveToGoType()` to return `uint64`
   - Added `_ = byteLengthVar` to suppress unused variable warnings in from_after_field contexts
   - Fixed nested `from_after_field` to use unique variable names (`tempEncoder1`, `contentBytes1`)

2. **Test Harness Issues (`go/test/compile_batch.go`):**
   - Fixed `formatChoiceArray` to handle type references for nested structs (not just arrays)
   - Fixed `typePrefix` extraction: Used `LastIndex("_")` incorrectly - now pass prefix directly
   - Fixed `formatStructValue` to preserve underscores in type names (was using `capitalizeFirst`)
   - Fixed `formatChoiceArray` to preserve underscores in variant type names
   - Updated `generateValueConstructionWithSchema` to accept and use explicit prefix

### Test Results

**Before:**
- Kerberos tests failed to compile with syntax errors like `map[tag:160 type:...]`

**After:**
- 8/15 kerberos tests pass (3 suites fully pass: kerberos_int32, kerberos_octet_string, kerberos_pa_data)
- 7 tests fail with actual encoding/decoding mismatches (further investigation needed)

### Files Modified

- `packages/binschema/src/generators/go.ts`:
  - Fixed `ByteOffset()` → `Position()` call
  - Added varlength case for byte_length_prefixed decoding
  - Fixed len() on struct types for length_of computed fields
  - Added varlength to mapPrimitiveToGoType
  - Added unused variable suppression
  - Fixed nested from_after_field variable naming

- `go/test/compile_batch.go`:
  - Fixed `formatChoiceArray` type reference handling
  - Fixed `generateValueConstructionWithSchema` prefix passing
  - Fixed type name preservation (no more capitalizeFirst on type names)

### Known Issue: Remaining Test Failures

The remaining 7 failing kerberos tests are actual encoding/decoding issues, not harness bugs. These require investigation into the ASN.1/DER encoding logic in the Go generator.

---

## Session Progress (2025-01-11) - Session 13: Local position_of Tests Fixed

### Achievement: All computed_position_* Tests Now Pass

This session fixed the remaining `position_of` computed field tests that use local (non-parent-reference) patterns.

### Problem

The `position_of` computed fields were using just `encoder.Position()` which returns the current byte offset. For position_of, we need the position of the **target** field, which comes after the position_of field. So we need:
```
position_of_target = current_position + size_of_fields_between_current_and_target
```

### Solution

**Added `getStaticFieldSize()` helper function:**
- Computes static byte sizes at code generation time
- Handles primitives (uint8=1, uint16=2, uint32=4, uint64=8, etc.)
- Handles byte-aligned bit fields (8 bits=1 byte, etc.)
- Handles type references by recursively summing field sizes
- Returns 0 for variable-length types (strings, arrays, varlength)

**Updated `generateComputedValue()` for position_of:**
- Now accepts `containingFields`, `currentFieldIndex`, and `schema` parameters
- Finds the target field index in containingFields
- Sums static sizes of fields from current to target
- Generates code like `uint32(encoder.Position() + 4)` for fixed offset

**Updated `generateEncodeField()` and call chain:**
- Added `containingFields`, `currentFieldIndex`, `schema` parameters
- Pass through from `generateEncodeMethod()` which has the full field list
- Also updated `generateFromAfterFieldEncoding()` to pass schema through

### Tests Now Passing
- `computed_position_basic` (1/1)
- `computed_position_nested_struct` (1/1)
- `computed_position_variable_length` (2/2)

Total: 4/4 position tests pass

### Known Issue: kerberos Tests

The kerberos tests are failing with a **pre-existing test harness bug** (not related to these changes). The test harness generates invalid Go map literals like `map[tag:160 type:...]` instead of proper syntax `map[string]interface{}{"tag": 160, ...}`. This affects complex ASN.1 structures with `interface{}` arrays.

### Files Modified

- `packages/binschema/src/generators/go.ts`:
  - Added `getStaticFieldSize()` function
  - Updated `generateComputedValue()` signature and position_of logic
  - Updated `generateEncodeField()` signature to accept context
  - Updated `generateFromAfterFieldEncoding()` to pass schema
  - Updated all call sites to pass additional context

---

## Session Progress (2025-01-11) - Session 12: Foundational Phases Completed

### Major Achievement: All 6 Foundational Phases Now Complete

This session completed the remaining two foundational phases that were blocking further progress.

### Phase 3: `from_after_field` Multi-Pass Encoding (COMPLETE)

**Changes to `packages/binschema/src/generators/go.ts`:**

1. **`hasFromAfterField()` function** - Detects computed length_of fields with `from_after_field` property

2. **`generateFromAfterFieldEncoding()` function** - Generates content-first encoding:
   - Creates temp encoder
   - Encodes all fields after the specified field to temp buffer
   - Measures size
   - Writes varlength length to main encoder
   - Writes buffered content to main encoder

3. **Updated `generateEncodeMethod()`** - Detects from_after_field and generates content-first encoding

**Runtime addition (`go/runtime/bitstream.go`):**
- Added `WriteBytes(data []byte)` method to BitStreamEncoder for writing buffered content

**Test passing**: `nested_calculatesize_from_after_field` (1/1)

### Phase 5: Position Tracking with Pre-Pass (COMPLETE)

**Changes to `packages/binschema/src/generators/go.ts`:**

1. **Helper functions for parsing selectors:**
   - `parseFirstLastTarget()` - Parses `../sections[first<FileData>]` patterns
   - `parseCorrespondingTarget()` - Parses `../sections[corresponding<FileData>]` patterns
   - `detectArraysNeedingPositionTracking()` - Scans schema for types needing position tracking

2. **Updated `generateComputedFieldEncoding()`:**
   - Early return for first/last/corresponding selectors (no parent field lookup needed)
   - Generates `ctx.GetFirstPosition()` / `ctx.GetLastPosition()` lookups
   - Added `generateComputedFieldWrite()` helper for write code generation

3. **Added pre-pass in `generateEncodeMethod()`:**
   - Detects arrays needing position tracking
   - Generates pre-pass loop before main encoding
   - For choice arrays: checks item type dynamically with type assertion
   - For single-type arrays: tracks all items
   - Uses `CalculateSize()` to advance offset
   - Calls `ctx.TrackPosition(key, offset)` for matching types

**Tests passing:**
- `first_element_position` (1/1)
- `last_element_position` (1/1)

### Bug Fix: byte_length_prefixed Arrays with Choice Items

Fixed pre-existing bug where `byte_length_prefixed` arrays with choice type items didn't close the decoding loop properly.

**Change**: Added `byte_length_prefixed` and `signature_terminated` to the choice item loop closing logic in `generateDecodeArray()`.

### Remaining Work

**Position tracking tests still failing** (need more work):
- `computed_position_basic`, `computed_position_nested_struct`, `computed_position_variable_length`
- These are different patterns (not first/last selectors)

**Corresponding correlation tests still failing**:
- `corresponding_correlation`, `context_corresponding_single_array`
- Need array iteration context setup during encoding

### Files Modified

- `packages/binschema/src/generators/go.ts`:
  - Added helper functions for parsing selectors
  - Added pre-pass generation for position tracking
  - Updated computed field encoding for first/last selectors
  - Fixed from_after_field encoding

- `go/runtime/bitstream.go`:
  - Added `WriteBytes()` method

---

## Session Progress (2025-01-10) - Session 11: Array Kinds & Operator Fixes

### Major Progress: New Array Kinds & Bug Fixes

Test results improved from **519/654 (79%)** to **533/654 (81%)** - **14 more tests passing!**

### Fix 1: variant_terminated Arrays (COMPLETE)

Added full support for `variant_terminated` arrays - arrays that continue until a terminal variant is encountered.

**Changes to `packages/binschema/src/generators/go.ts`:**

1. **Decoding**: Added `variant_terminated` case in `generateDecodeArray()`:
   - Uses labeled loop for proper break from type switch
   - Decodes items, then checks if item matches a terminal variant
   - Breaks loop when terminal variant is encountered

2. **Encoding**: Updated `generateEncodeArray()`:
   - Added terminal variant tracking
   - Breaks loop after encoding a terminal variant

**Tests now passing**: `variant_terminated_basic` (3/3), `variant_terminated_multiple_end` (3/3), `variant_terminated_png_chunks` (2/2)

### Fix 2: signature_terminated Arrays (COMPLETE)

Added support for `signature_terminated` arrays - arrays that continue until a signature/magic value is peeked.

**Changes:**
- Added peek-based terminator check before decoding each item
- Supports uint8, uint16, uint32, uint64 terminator types
- Added `PeekUint64()` to Go runtime

**Tests now passing**: `signature_terminated_arrays` (3/3)

### Fix 3: byte_length_prefixed Arrays (COMPLETE)

Added support for `byte_length_prefixed` arrays - arrays where the prefix is the total byte length (not item count).

**Changes to `packages/binschema/src/generators/go.ts`:**

1. **Encoding**: For primitives, uses `len(arr) * itemSize`. For complex types, encodes to temp buffer to measure.

2. **Decoding**: Reads byte length, tracks start offset, reads items while `Position() < endOffset`.

**Tests now passing**: `byte_length_prefixed_simple` (3/3)

### Fix 4: JavaScript Operator Conversion (COMPLETE)

Fixed discriminated union condition parsing - JavaScript `===` and `!==` operators weren't being converted to Go `==` and `!=`.

**Changes**: Updated all three locations in `generateDiscriminatedUnion()` where `variant.when` conditions are processed to also convert operators.

### Fix 5: Discriminated Union Array Typing (COMPLETE)

Fixed test harness to use properly typed arrays for discriminated union type references instead of `[]interface{}`.

**Changes to `go/test/compile_batch.go`:**
- Updated `formatArrayWithSchema()` to call `formatDiscriminatedUnionArrayTyped()` when item type references a discriminated_union

### Remaining Challenges

1. **Position tracking (Phase 5)**: `computed_position_*`, `first_element_position`, `last_element_position`
2. **Context correlation**: `context_first_selector`, `context_last_selector`, `corresponding_*`, `sum_of_*`
3. **Instance tests**: `instance_*`, `pcf_*`
4. **from_after_field**: `nested_calculatesize_from_after_field`
5. **Latin1 encoding**: Requires Go string encoding conversion
6. **DNS compression**: Complex back-reference handling

---

## Session Progress (2025-01-10) - Session 10: Parent References & CRC32

### Major Progress: Phase 4 (Parent References) & Phase 6 (CRC32) COMPLETE

Test results improved from **175/289 (61%)** to **519/654 (79%)** - an **18 percentage point jump!**

### Phase 4: Parent Reference Resolution (COMPLETE)

**Changes to `packages/binschema/src/generators/go.ts`:**

1. **`parseParentPath()` function** - Parses `../field` and `../../field` paths, returns `{ levelsUp, fieldName }`

2. **`generateComputedFieldEncoding()` function** - Generates multi-line code block for parent reference computed fields:
   - Gets parent field from context using `ctx.GetParentField(levelsUp, fieldName)`
   - Handles `length_of` for scalars (copy value) and slices (get length)
   - Handles `count_of` similarly
   - Handles `crc32_of` with parent reference using `runtime.CRC32()`
   - Handles `position_of` with parent reference (placeholder, needs Phase 5)
   - Uses type switch for safe handling of interface{} values

3. **`generateEncodeMethod()` updated** - Now builds parent context for all structs:
   ```go
   parentFields := map[string]interface{}{
       "field1": m.Field1,
       "field2": m.Field2,
   }
   childCtx := ctx.ExtendWithParent(parentFields)
   ```
   - Skips padding fields (don't exist in struct)
   - Skips computed fields (don't exist in struct)

4. **`generateEncodeNestedStruct()` updated** - Now uses `childCtx` instead of `ctx` for nested encoding

5. **`hasParentReferenceComputedFields()` function** - Detects schemas needing reflect import

6. **Field locality fix** - Fixed `generateDecodeArray()` to check first part of dotted paths for local field detection

### Phase 6: CRC32 Support (COMPLETE)

**Runtime addition (`go/runtime/bitstream.go`):**
- Added `CRC32(data []byte) uint32` function using `crc32.ChecksumIEEE()`

**Generator fix:**
- Updated `generateComputedValue()` for `crc32_of` to return `runtime.CRC32(m.FieldName)` instead of `"0"`

### Tests Now Passing

**Parent Reference Tests (9/10):**
- ✓ context_multi_level_parent_reference
- ✓ context_single_parent_reference
- ✓ multiple_parent_references
- ✓ nested_parent_references
- ✓ parent_reference_crc32
- ✓ parent_reference_string_length
- ✗ parent_reference_position (needs Phase 5)

**CRC32 Tests (7/7):**
- ✓ computed_crc32_before_data
- ✓ computed_crc32_byte_array
- ✓ computed_crc32_variable_length

**Context Extension Tests (16/30):**
- ✓ context_extension_chaining (was causing panic, now fixed)
- Many other context tests now passing

### Remaining Phases

**Phase 5: Position Tracking** (pending)
- `position_of` computed fields still not implemented
- Need pre-pass size calculation for position values

**Phase 3: Multi-pass Encoding for `from_after_field`** (pending)
- `nested_calculatesize_from_after_field` still failing
- Requires content-first encoding with temp buffers

---

## Session Progress (2025-01-09) - Session 9: Architectural Restructure

### Architectural Analysis and Foundation Work

This session focused on analyzing the architectural differences between the TypeScript and Go generators, then implementing foundational changes to enable future features.

### Architectural Comparison Summary

| Feature | TypeScript | Go (Before) | Go (After) |
|---------|-----------|-------------|------------|
| Encoding context | Full struct | None | **EncodingContext struct** |
| Multi-pass encoding | Yes (from_after_field) | No | Infrastructure ready |
| Size calculation | `calculateSize()` methods | None | **CalculateSize() methods** |
| Parent references | Full support | Rejected | Infrastructure ready |
| Position tracking | Pre-pass + Map | None | Infrastructure ready |
| CRC32 | Runtime + generator | Returns 0 | Infrastructure ready |

### Phase 1: Encoding Context Infrastructure (COMPLETE)

**New file:** `go/runtime/context.go`
- `EncodingContext` struct with Parents, ArrayIterations, Positions, ByteOffset
- `NewEncodingContext()` factory function
- `ExtendWithParent()` for context extension
- `ExtendWithArrayIteration()` for array loops
- `GetParentField()` for parent reference resolution
- Position tracking helper methods

**Generator changes:**
- Added `EncodeWithContext(ctx *runtime.EncodingContext)` method to all structs
- `Encode()` now delegates to `EncodeWithContext(NewEncodingContext())`
- Updated choice and discriminated union interfaces to include both methods
- All nested struct encoding calls now pass context through

### Phase 2: Size Calculation (COMPLETE)

**New runtime function:** `VarlengthDERSize(value uint64) int`
- Calculates encoded size of DER variable-length integers

**New generator functions:**
- `generateCalculateSizeMethod()` - Main method generator
- `generateFieldSizeCalculation()` - Per-field size calculation
- `generateFieldSizeForType()` - Type-specific size calculation
- `generateArraySizeCalculation()` - Array size calculation
- `generateComputedFieldSize()` - Computed field size
- `generatePrimitiveFieldSize()` - Primitive type sizes

**Handles:**
- All primitive types (uint8-64, int8-64, float32/64)
- Varlength fields (DER size formula)
- Strings (null-terminated, length-prefixed, field-referenced)
- Arrays (fixed, length-prefixed, null-terminated, nested 2D)
- Composite types (recursive CalculateSize calls)
- Choice and discriminated union interfaces
- Padding fields (skipped - position-dependent)
- Conditional fields (wrapped in if statements)
- Optional fields (presence indicator + value)

### Files Modified

**New files:**
- `go/runtime/context.go` - EncodingContext struct and helpers

**Modified files:**
- `go/runtime/bitstream.go` - Added `VarlengthDERSize()` function
- `packages/binschema/src/generators/go.ts`:
  - Updated `generateEncodeMethod()` to add context variant
  - Added `generateCalculateSizeMethod()` and helpers
  - Updated interfaces to include CalculateSize
  - Updated all nested encoding calls to pass context

### Test Results

**Before:** 175/289 suites passing (61%)
**After:** 175/289 suites passing (61%)

No regressions - infrastructure added without changing behavior.

### Remaining Phases

See plan at `/home/bart/.claude/plans/velvety-dreaming-cupcake.md`:

- **Phase 3**: Multi-pass encoding for `from_after_field`
- **Phase 4**: Parent reference resolution (`../field`)
- **Phase 5**: Position tracking with pre-pass
- **Phase 6**: CRC32 support

---

## Summary

The Go code generator has been significantly improved with:
- **Varlength type support** (DER, LEB128, EBML, VLQ encodings) - 62/62 tests pass
- **Discriminated union type support** (peek-based and field-based discriminators)
- **Inline discriminated union fields** in struct sequences
- **Back reference type support** (with Seek method in runtime)
- **Bitfield struct generation** (inline bitfields generate proper Go structs)
- **Context passing for cross-type field references** - DNS protocol tests now pass
- **Null-terminated array termination** - proper termination with discriminated unions
- **Length-prefixed items for primitive types** - fixed encoding/decoding
- **Exported WriteBit/ReadBit methods** - single bit operations now available
- **Fixed optional struct encoding** - no more double-pointer issues
- **Comprehensive test harness improvements** - nested arrays, optional pointers, BigInt, string type refs
- **Endianness fix for decoding** - decoder now respects schema endianness
- **Conditional field support** - bitwise AND and comparison operators
- **Computed field support** - length_of, count_of, and computed_count for arrays
- **LSB-first bit order support** - full support in runtime and test loader

Test status:
- **175 test suites fully passing** (61% pass rate)
- **492/659 individual tests passing**
- **All compilation errors resolved**
- Progress: 51% → 61% test pass rate (+10%)

## Session Progress (2025-01-09) - Session 8

### Test Progress: 169 → 175 suites, 489 → 492 tests

This session added computed_count array support and fixed LSB-first bit order handling.

### Fix 1: Computed Count Array Support (NEW)

**Problem**: Arrays with `kind: "computed_count"` and `count_expr` expressions were not supported.

**Solution** (`packages/binschema/src/generators/go.ts`):
1. Added `convertCountExprToGo()` helper function to convert expressions like `"max - min + 1"` to Go code like `int(result.Max) - int(result.Min) + 1`
2. Added `computed_count` case to `generateDecodeArray()` - evaluates the expression and uses result as array length
3. Added `computed_count` to all array kind checks for loop closing and item assignment

**Result**: All 3 computed_count test suites now pass (7/7 tests):
- `computed_count_simple`: 3/3
- `computed_count_multiplication`: 2/2
- `computed_count_field_multiplication`: 2/2

### Fix 2: LSB-First Bit Order - Generator (FIXED)

**Problem**: Go generator hardcoded `MSBFirst` for all encoder/decoder creation, ignoring schema's `bit_order` setting.

**Solution** (`packages/binschema/src/generators/go.ts`):
1. Added `mapBitOrder()` function to map `"lsb_first"` → `"LSBFirst"`, `"msb_first"` → `"MSBFirst"`
2. Extract `defaultBitOrder` from `schema.config?.bit_order`
3. Pass bit order to `generateEncodeMethod()`, `generateDecodeFunction()`, `generateDiscriminatedUnion()`, and `generateTypeAlias()`
4. Use `runtime.${runtimeBitOrder}` when creating encoders/decoders

### Fix 3: LSB-First Bit Order - Runtime (FIXED)

**Problem**: Go runtime's `WriteBits()` and `ReadBits()` functions always processed bits in MSB-first order regardless of the bit order setting.

**Solution** (`go/runtime/bitstream.go`):
1. Modified `WriteBits()` to respect `bitOrder`:
   - LSB first: iterate from i=0 to numBits-1 (writes bit 0 of value first)
   - MSB first: iterate from i=numBits-1 to 0 (writes MSB of value first)
2. Modified `ReadBits()` with same logic for reading

### Fix 4: LSB-First Bit Order - Test Loader (FIXED)

**Problem**: `bitsToBytes()` function always packed bits using MSB-first order, causing test failures for LSB-first tests.

**Solution** (`go/test/loader.go`):
1. Extract schema's `bit_order` from config when loading test suite
2. Pass `bitOrder` parameter to `convertBitsToBytes()` and `bitsToBytes()`
3. Update `bitsToBytes()` to pack bits according to bit order:
   - LSB first: `bitIdx = i % 8` (bit 0 at position 0)
   - MSB first: `bitIdx = 7 - (i % 8)` (bit 0 at position 7)

**Result**: All LSB-first tests now pass:
- `bitfield_lsb_first`: 1/1 (was passing)
- `bit_order_lsb_first`: 1/1 (fixed)
- `spanning_bytes_lsb`: 5/5 (fixed, was 4/5)

### Files Modified

- `packages/binschema/src/generators/go.ts`:
  - Added `convertCountExprToGo()` function
  - Added `mapBitOrder()` function
  - Added `computed_count` case to `generateDecodeArray()`
  - Updated `generateEncodeMethod()`, `generateDecodeFunction()`, `generateDiscriminatedUnion()`, `generateTypeAlias()` to accept and use `defaultBitOrder` parameter

- `go/runtime/bitstream.go`:
  - Updated `WriteBits()` to respect bit order
  - Updated `ReadBits()` to respect bit order

- `go/test/loader.go`:
  - Extract bit_order from schema config
  - Updated `convertBitsToBytes()` and `bitsToBytes()` to accept bit order parameter

---

## Session Progress (2025-01-09) - Session 7

### Major Test Pass Rate Improvement: 51% → 72%

This session focused on fixing runtime encoding/decoding issues rather than compilation errors.

### Fix 1: Decoder Endianness Bug (FIXED)

**Problem**: In `generateDecodeField()`, the decoder was hardcoding `BigEndian` as fallback instead of using the schema's default endianness.

**Before** (wrong):
```typescript
const runtimeEndianness = mapEndianness(endianness || "big_endian");
```

**After** (correct):
```typescript
const endianness = fieldAny.endianness || defaultEndianness;
const runtimeEndianness = mapEndianness(endianness);
```

**Result**: All 11 `*_little_endian` test suites now pass (50/50 tests)

### Fix 2: Conditional Field Parsing (FIXED)

**Problem**: `convertConditionalToGo()` only handled simple comparisons like `field == value` but not bitwise AND expressions like `flags & 0x01`.

**Solution**: Enhanced the function to handle multiple patterns:
1. Simple comparisons: `field == value`, `field >= value`
2. Bitwise AND truthiness: `flags & 0x01` → `(m.Flags & 0x01) != 0`
3. Parenthesized bitwise: `(flags & mask) == value`
4. Simple field references (boolean): `has_data`

**Result**: All 9 conditional test suites now pass (32/32 tests)

### Fix 3: Computed Field Support (NEW)

**Problem**: Go generator didn't handle computed fields - it just wrote field values directly instead of computing them.

**Solution**: Added `generateComputedValue()` function:
- `length_of`: Computes `len(m.Field)` for arrays
- `length_of` with `encoding`: Computes `len([]byte(m.Field))` for UTF-8 strings
- `count_of`: Computes element count (same as length_of)
- Throws clear error for unsupported parent references (`../field`)

**Result**: Basic computed field tests now pass:
- `computed_length_uint8`: 1/1
- `computed_length_various_sizes`: 1/1
- `computed_string_length`: 5/5
- `computed_byte_array_length`: 4/4
- `computed_struct_array_length`: 3/3

### Fix 4: Field-Referenced String Support (NEW)

**Problem**: Strings with `kind: "field_referenced"` weren't supported in encoding or decoding.

**Solution**:
- Added `case "field_referenced"` to `generateEncodeString()` - writes bytes directly
- Added `case "field_referenced"` to `generateDecodeString()` - reads based on length field
- Fixed string decoding inside arrays to assign to varName instead of `result.`

### Test Results

```
Before this session: 142/279 suites passing (51%)
After this session:  169/289 suites passing (72%)

Key improvements:
- Little endian tests: 0/11 → 11/11 (+11 suites)
- Conditional tests: 3/9 → 9/9 (+6 suites)
- Computed tests: 3/20 → 9/20 (+6 suites)
- Plus various string/array improvements
```

### Remaining Challenges

1. **Parent-reference computed fields** (`../body`): Not yet supported
2. **count_of with expressions** (`end - start + 1`): Not just simple length
3. **CRC32 computed fields**: Need runtime CRC32 support
4. **Position computed fields**: Need byte position tracking

### Files Modified

- `packages/binschema/src/generators/go.ts`:
  - Fixed `generateDecodeField()` endianness fallback
  - Enhanced `convertConditionalToGo()` for bitwise operators
  - Added `generateComputedValue()` function
  - Added `mapPrimitiveToGoType()` helper
  - Added `field_referenced` string encoding/decoding

---

## Session Progress (2025-01-09) - Session 6

### All Compilation Errors Fixed

This session resolved all remaining compilation errors that were blocking Go test execution.

### Runtime Improvements

**Exported WriteBit/ReadBit Methods** (`go/runtime/bitstream.go`):
- Renamed `writeBit` → `WriteBit` and `readBit` → `ReadBit` to export them
- Updated internal callers to use exported versions
- Single-bit operations now available for generated code

### Go Generator Fixes

**Optional Struct Encoding** (`packages/binschema/src/generators/go.ts`):
- Fixed `generateEncodeNestedStruct()` to handle dereferenced field names
- Added parenthesis wrapping for method calls on dereferenced pointers: `(*m.Name).Encode()` instead of `*m.Name.Encode()`
- Fixed `generateDecodeOptional()` to not double-pointer type references

**String Variable Naming**:
- Fixed `generateEncodeNestedStruct()` and `generateEncodeString()` to strip leading `*` from variable names

### Test Harness Improvements (`go/test/compile_batch.go`)

**Skip Error Validation Tests**:
- Added check to skip suites with 0 test cases (schema validation error tests)
- Prevents compilation failures from intentionally invalid schemas

**BigInt String Parsing** (`go/test/loader.go`):
- Fixed `processBigIntInTestCases()` to also process `DecodedValue`, not just `Value`

**Optional Pointer Values**:
- Added pointer helper functions (`ptrUint8`, `ptrUint16`, etc.) to test harness
- Added optional field handling in `formatValueWithSchema()` and `formatStructValue()`
- Handles both primitive optionals and type reference optionals

**Nested 2D Arrays**:
- Added handling for `itemType == "array"` in `formatArrayWithSchema()`
- Properly formats `[][]uint16{{...}, {...}}` syntax

**String Type References in Structs**:
- Added string type reference handling in `formatStructValue()`
- Wraps string values in struct type: `String{Value: "text"}`

**Choice Array Field Types**:
- Fixed `formatChoiceArray()` to use schema-aware array formatting
- Array fields in choice variants now properly typed as `[]uint8` instead of `[]int`

### Test Results

```
Total test suites: 279
Fully passing: 142 (51%)
All compilation errors: FIXED
```

### Files Modified

- `go/runtime/bitstream.go` - Exported WriteBit/ReadBit
- `packages/binschema/src/generators/go.ts` - Optional encoding fixes
- `go/test/compile_batch.go` - Comprehensive test harness improvements
- `go/test/loader.go` - BigInt parsing for DecodedValue

---

## Session Progress (2025-01-08) - Session 5

### Context Passing for Cross-Type Field References (COMPLETE)

**Problem**: DNS protocol tests had `field_referenced` arrays where the length field (e.g., `qdcount`) was in the parent type (`DnsFrame`), not the current type (`DnsQuery`).

**Solution** (`packages/binschema/src/generators/go.ts`):
1. Added `getTypeFieldNames()` to get all field names for a type
2. Added `typeNeedsContext()` to detect types with external field references
3. Added `getTypesNeedingContext()` to collect all types needing context
4. Modified `generateDecodeFunction()` to generate context-aware versions:
   - `decode${name}WithDecoder()` - standard signature
   - `decode${name}WithDecoderAndContext(decoder, ctx map[string]interface{})` - context-aware
5. Modified `generateDecodeArray()` to check both result and context for `field_referenced` length fields
6. Modified `generateDecodeInlineDiscriminatedUnion()` to pass parent fields as context to variant decoders

**Result**: DNS protocol tests (dns_protocol_query, dns_protocol_response) now pass 2/2!

### Null-Terminated Array Termination (COMPLETE)

**Problem**: Null-terminated arrays of discriminated unions had infinite loops because there was no termination condition.

**Solution** (`packages/binschema/src/generators/go.ts`):
1. Added null byte peek check before decoding each item
2. Added labeled loop (`${varName}Loop:`) for proper break from switch statements
3. Added terminal_variants check after decoding - if item matches a terminal variant, break the loop

**Example Generated Code**:
```go
valueLoop:
for {
    // Peek for null terminator
    peekByte, err := decoder.PeekUint8()
    if err != nil {
        return nil, fmt.Errorf("failed to peek for null terminator: %w", err)
    }
    if peekByte == 0 {
        _, _ = decoder.ReadUint8()
        break valueLoop
    }

    valueItem, err := decodeCompressedLabelWithDecoder(decoder)
    // ... decode logic ...
    result.Value = append(result.Value, valueItem)

    // Check if item is a terminal variant
    switch valueItem.(type) {
    case *LabelPointer:
        break valueLoop // Terminal variant - exit loop
    }
}
```

### Length-Prefixed Items for Primitive Types (COMPLETE)

**Problem**: `length_prefixed_items` arrays of primitives (e.g., `uint32`) tried to call `.Encode()` on primitives, which don't have that method.

**Solution** (`packages/binschema/src/generators/go.ts`):
1. Added `isPrimitiveType()` helper function
2. Added `getPrimitiveSize()` helper function
3. Modified `generateEncodeArray()` to encode primitives inline with fixed-size length prefix
4. Modified `generateDecodeLengthPrefixedItems()` to decode primitives directly

**Result**: length_prefixed_items_basic (3/3) and similar tests now pass!

## Session Progress (2025-01-08) - Session 4

### Inline Discriminated Union Fields (COMPLETE)

**Go Generator** (`packages/binschema/src/generators/go.ts`):
- Added `generateDecodeInlineDiscriminatedUnion()` for inline union fields
- Added `generateEncodeInlineDiscriminatedUnion()` for encoding
- Handles both `peek` discriminators and `field` discriminators
- Converts JavaScript operators (`===`, `!==`) to Go operators (`==`, `!=`)
- Updated `generateDecodeFieldImpl()` to detect and handle inline unions

### Back Reference Type (COMPLETE)

**Go Runtime** (`go/runtime/bitstream.go`):
- Added `Seek(offset int)` method to `BitStreamDecoder`

**Go Generator** (`packages/binschema/src/generators/go.ts`):
- Added `generateDecodeBackReference()` function
- Added `generateEncodeBackReferenceImpl()` function
- Handles `storage`, `offset_mask`, `target_type`, `offset_from` properties

### Bitfield Struct Generation (COMPLETE)

**Go Generator** (`packages/binschema/src/generators/go.ts`):
- Added `generateBitfieldStruct()` function
- Generates struct types for inline bitfields (e.g., `DnsMessage_Flags`)
- Updated `mapFieldToGoType()` to accept parent type name for bitfield naming
- Implemented encoding using `WriteBits()` for each subfield
- Implemented decoding using `ReadBits()` for each subfield

**Example Generated Code**:
```go
type DnsMessage_Flags struct {
    Qr uint8
    Opcode uint8
    Aa uint8
    // ... more fields
}

// Encode
encoder.WriteBits(uint64(m.Flags.Qr), 1)
encoder.WriteBits(uint64(m.Flags.Opcode), 4)

// Decode
result.Flags.Qr = uint8(decoder.ReadBits(1))
result.Flags.Opcode = uint8(decoder.ReadBits(4))
```

### Test Harness Improvements

**Type Prefixing** (`go/test/compile_batch.go`):
- Updated all regex patterns to include underscores `[A-Z][a-zA-Z0-9_]*`
- Added handling for type assertions in case statements
- Added handling for `*Type` at end of line (struct field declarations)
- Added handling for pointer types in optional fields

**Bitfield Value Formatting**:
- Updated `formatBitfieldValue()` to use correct struct name `ParentType_FieldName`
- Updated call sites to pass parent type name and field name

**Array Type Alias Handling**:
- Added `formatArrayTypeAliasValue()` for array type aliases
- Added `formatDiscriminatedUnionArrayTyped()` for typed union arrays
- Updated `formatStructValue()` to wrap array type refs in struct

### Bug Fixes

1. **Variable Redeclaration in String Decoding**:
   - Changed `length, err :=` to use unique variable names per field
   - `${varName}Length` prevents redeclaration with multiple string fields

2. **Schema Propagation**:
   - Added `schema` parameter to decode function chain
   - Allows checking if type references are discriminated unions
   - Prevents dereferencing interface types in array decoding

## Remaining Challenges (Runtime Issues)

Test suite progress: **169/289 suites passing (72%)**

### 1. Parent-Reference Computed Fields
- Tests: `parent_field_reference_*`, some `computed_*` tests
- Issue: Computed fields with `../field` parent references not yet supported
- Error: "Computed field with parent reference not yet supported in Go generator"

### 2. CRC32 Computed Fields
- Tests: `computed_crc32_*`
- Issue: CRC32 calculation needs runtime implementation

### 3. Position Computed Fields
- Tests: `computed_position_*`
- Issue: Need byte position tracking during encoding

### 4. count_of with Expressions
- Tests: `computed_count_simple`, `computed_count_multiplication`
- Issue: `count_of` with arithmetic expressions (`end - start + 1`) not supported

### 5. LSB-First Bit Order
- Tests: `bitfield_lsb_first`, `spanning_bytes_lsb`
- Issue: Some LSB-first bit operations may have encoding issues

### FIXED This Session:
- ✓ All little endian tests (decoder endianness bug)
- ✓ All conditional field tests (bitwise operator parsing)
- ✓ Basic computed length_of/count_of (new generateComputedValue function)
- ✓ Field-referenced strings (new encoding/decoding support)

## Test Results Summary

```bash
# Overall status (Session 7):
# 169/289 test suites fully passing (72%)
# 479/659 individual tests passing
# All compilation errors: FIXED

# Tests passing (examples):
make test-go FILTER=little_endian         # 50/50 passed (ALL)
make test-go FILTER=conditional           # 32/32 passed (ALL)
make test-go FILTER=computed_string       # 5/5 passed
make test-go FILTER=bitfield_8bit         # 5/5 passed
make test-go FILTER=varlength             # 62/62 passed
make test-go FILTER=dns_protocol          # 2/2 passed
make test-go FILTER=length_prefixed       # Most passing
make test-go FILTER=optional              # All passing

# Tests with remaining issues:
make test-go FILTER=computed_count        # 0/7 - needs expression support
make test-go FILTER=computed_crc32        # 1/7 - needs CRC32 impl
make test-go FILTER=computed_position     # 0/4 - needs position tracking
make test-go FILTER=parent_reference      # 0/X - needs parent context
```

## Files Modified This Session (Session 5)

### Go Generator (`packages/binschema/src/generators/go.ts`)
- Added `getTypeFieldNames()` helper function
- Added `typeNeedsContext()` helper function
- Added `getTypesNeedingContext()` helper function
- Added `isPrimitiveType()` helper function
- Added `getPrimitiveSize()` helper function
- Modified `generateDecodeFunction()` to support context-aware decoding
- Modified `generateDecodeArray()` to check context for field_referenced length fields
- Modified `generateDecodeInlineDiscriminatedUnion()` to pass context to variants
- Modified `generateEncodeArray()` for length_prefixed_items with primitives
- Modified `generateDecodeLengthPrefixedItems()` for primitive types
- Added null-terminated array termination with peek and terminal_variants

## Files Modified Session 4

### Go Generator (`packages/binschema/src/generators/go.ts`)
- Added `generateBitfieldStruct()` function
- Added `generateDecodeInlineDiscriminatedUnion()` function
- Added `generateEncodeInlineDiscriminatedUnion()` function
- Added `generateDecodeBackReference()` function
- Added `generateEncodeBackReferenceImpl()` function
- Updated `generateDecodeFieldImpl()` for inline types
- Updated `mapFieldToGoType()` for parent type names
- Updated string decoding to use unique variable names
- Added schema parameter propagation

### Go Runtime (`go/runtime/bitstream.go`)
- Added `Seek(offset int)` method

### Test Harness (`go/test/compile_batch.go`)
- Updated all type name regexes to include underscores
- Added `formatArrayTypeAliasValue()` function
- Added `formatDiscriminatedUnionArrayTyped()` function
- Updated `formatBitfieldValue()` signature and callers
- Updated `formatValueWithSchema()` signature and callers
- Updated `formatStructValue()` for array type references

## Next Steps

1. **Debug computed field handling**: Investigate `computed_length_*`, `computed_count_*` test failures
2. **Fix LSB-first bit encoding**: Investigate `bitfield_lsb_first` and `spanning_bytes_lsb` failures
3. **Debug conditional field evaluation**: Check `conditional_*` test failures
4. **Implement CRC32 validation**: Add CRC32 support if not already present

## Useful Commands

```bash
# Run passing tests
make test-go FILTER=bitfield REPORT=summary

# Debug mode (saves to go/test/tmp-go-debug/)
make test-go-debug FILTER='dns_cname'

# See all compilation errors
make test-go 2>&1 | head -30

# TypeScript reference tests
npm test -- --filter=dns --failures
```

---

# Previous Session Progress

See earlier sections for:
- Session 3: Varlength and discriminated union support
- Session 2: Test harness improvements
- Session 1: Go generator fixes (reserved words, conditionals, padding)

---

## ⚠️ PRIMARY DIRECTIVE - REMINDER ⚠️

**THIS SECTION IS SACROSANCT. IT CANNOT BE CHANGED, REMOVED, OR WEAKENED.**

**Refer back to the top of this document for the full directive.**

### Summary

1. **READ the TypeScript implementation FIRST**
2. **REPLICATE it in Go** - same architecture, same logic
3. **DO NOT reinvent** - every problem is already solved

### Key Files

- `packages/binschema/src/generators/typescript/*.ts` - The reference implementation
- `packages/binschema/src/runtime/bit-stream.ts` - Reference runtime

**The TypeScript code is the answer. Use it.**

---
