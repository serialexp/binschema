# Current Task: Split TypeScript Interfaces into Input/Output Types

## Context

Currently, the TypeScript generator creates a single interface per type that includes ALL fields (including const and computed fields). This is misleading because:

1. **Encoders ignore const/computed field values** - They use schema-defined values instead
2. **The interface shows const/computed as required** - Users think they need to provide them
3. **Test cases now correctly separate value/decoded_value** - But interfaces don't match

## Current Behavior

```typescript
// Generated interface (current)
export interface LocalFile {
  signature: number;  // const field - required but ignored!
  header: LocalFileHeader;
  body: number[];
}

export class LocalFileEncoder extends BitStreamEncoder {
  encode(value: LocalFile): Uint8Array {
    // Ignores value.signature, uses const 0x04034b50 from schema
    this.writeUint32(67324752, "little_endian");
    // ...
  }
}
```

## Desired Behavior

Generate separate input (for encoding) and output (for decoding) interfaces:

```typescript
// Input interface - for encoder (omits const/computed)
export interface LocalFileInput {
  // No signature field - it's const
  header: LocalFileHeaderInput;  // Recursive input types
  body: number[];
  // No crc32 or length fields - they're computed
}

// Output interface - for decoder (includes all fields)
export interface LocalFileOutput {
  signature: number;  // Const field present in output
  header: LocalFileHeaderOutput;  // Recursive output types
  body: number[];
  crc32: number;  // Computed field present in output
}

export class LocalFileEncoder extends BitStreamEncoder {
  encode(value: LocalFileInput): Uint8Array {
    // Type system now correctly reflects reality
    // ...
  }
}

export class LocalFileDecoder extends SeekableBitStreamDecoder {
  decode(): LocalFileOutput {
    // Type system shows all fields including const/computed
    // ...
  }
}
```

## Implementation Plan

### 1. Update TypeScript Generator Interface Generation

**File**: `packages/binschema/src/generators/typescript.ts`

**Changes needed**:

a. **Generate Input Interface** (in `generateTypeCode()`)
   - Create `{TypeName}Input` interface
   - Skip fields with `const` or `computed` properties
   - For nested types, use `{NestedType}Input` references
   - For optional fields, keep them optional
   - For conditional fields, keep them optional

b. **Generate Output Interface** (in `generateTypeCode()`)
   - Create `{TypeName}Output` interface (or keep existing `{TypeName}`)
   - Include ALL fields (const, computed, regular)
   - For nested types, use `{NestedType}Output` references
   - This matches current behavior

c. **Update Encoder Signature**
   - Change `encode(value: TypeName)` → `encode(value: TypeNameInput)`
   - No other encoder changes needed

d. **Update Decoder Signature**
   - Change `decode(): TypeName` → `decode(): TypeNameOutput`
   - No other decoder changes needed

### 2. Handle Recursive Types

Need to generate Input/Output pairs recursively:

```typescript
// For a type with nested types
interface PacketInput {
  header: HeaderInput;  // Nested input type
  payload: PayloadInput;
}

interface PacketOutput {
  header: HeaderOutput;  // Nested output type
  payload: PayloadOutput;
  checksum: number;  // Computed field
}
```

### 3. Handle Type Aliases

For type aliases (e.g., `Optional<T>`):
- Keep as-is OR
- Generate `OptionalInput<T>` and `OptionalOutput<T>` versions

### 4. Update Backward Compatibility

Consider exporting the Output interface with the simple name for backward compatibility:

```typescript
export interface LocalFileInput { /* ... */ }
export interface LocalFileOutput { /* ... */ }

// Backward compatibility - output is the "main" interface
export type LocalFile = LocalFileOutput;
```

### 5. Test Changes

**Files to update**:
- No test changes needed! Test cases already use `value` (input) and `decoded_value` (output)
- The test runner should work with new interfaces automatically

**What to verify**:
- All 810 tests still pass
- Generated interfaces compile without errors
- Encoder accepts input without const/computed fields
- Decoder returns output with all fields
- Recursive types work correctly (nested Input/Output)

## Edge Cases to Handle

1. **Bitfields** - Should const bitfield entries be omitted from input?
2. **Choice types** - Do discriminator const fields need special handling?
3. **Optional nested types** - `field?: NestedTypeInput | undefined`
4. **Arrays of custom types** - `items: ItemInput[]` vs `items: ItemOutput[]`
5. **Back references** - Context types might need Input/Output variants

## Files to Modify

Primary:
- `packages/binschema/src/generators/typescript.ts` - Main generator logic

Supporting:
- `packages/binschema/src/generators/typescript/type-utils.ts` - Type name utilities
- May need helper functions to determine input vs output type names

## Success Criteria

1. ✅ Encoder accepts input without const/computed fields (TypeScript compiles)
2. ✅ Decoder returns output with all fields (TypeScript compiles)
3. ✅ All 810 tests pass
4. ✅ Generated code for all test schemas compiles without errors
5. ✅ Nested types use correct Input/Output variants
6. ✅ Documentation/examples updated to show Input/Output types

## References

- Test cases now use `value` (input) and `decoded_value` (output) pattern
- Current encoder already ignores const field values (see `generateEncodeFieldImpl()` line 1047-1049)
- Current decoder already returns const fields in output
- HTML documentation already shows correct input (omits const/computed)

## Notes

This change makes the TypeScript type system **accurately reflect runtime behavior**. Users will no longer see misleading required fields that are actually ignored.

The split also provides better documentation - Input types show "what you need to provide", Output types show "what you get back".

---

# Previous Tasks (Completed)

## HTML Documentation Usage Examples & Test Case Value/DecodedValue Split

**Date:** 2025-12-01

**Problem:**
1. HTML documentation didn't show developers how to use generated code
2. Test cases had both `value` and `decoded_value` identical, not reflecting that encoders omit const/computed fields
3. Documentation examples showed all fields including const/computed, which is misleading

**Solution:**
1. Added intelligent usage examples to HTML docs:
   - Finds most complex type for realistic examples
   - Generates actual field names and nested structures
   - Automatically omits const/computed fields from examples
   - Shows TypeScript, Go, and Rust usage patterns
2. Added `decoded_value` to 28 test files (initially as copy of `value`)
3. Stripped const/computed fields from `value` in test cases
4. Created scripts: `add-decoded-value.ts`, `strip-const-computed.ts`, `fix-zip-signatures.ts`

**Result:**
- HTML docs now have practical, copy-paste ready code examples
- Test cases accurately document encoder/decoder contract:
  - `value`: What users provide (no const/computed)
  - `decoded_value`: What decoder returns (includes const/computed)
- All 810 tests pass
- Examples align with reality: const fields auto-filled, computed fields auto-calculated

## varlength support in from_after_field nested content

**Date:** 2025-11-28

**Problem:** TypeScript code generator failed when a type with `from_after_field` contained nested `varlength` fields.

**Solution:** Added `varlength` case to `generatePrimitiveEncoding` in `packages/binschema/src/generators/typescript/computed-fields.ts:312-316`.

**Result:** All 7 Kerberos test suites (15 tests) now pass.

## UX Improvements

**Date:** 2025-11-25

### Completed
- **Bin entry** - Added `"bin": { "binschema": "./dist/cli/index.js" }` to package.json
- **Build fixes** - Fixed TypeScript errors, removed dead `go-cli.ts` file
- **README.md** - Rewrote with correct `sequence` syntax, CLI usage, schema format docs
- **Plain schema docs** - `generateHTML()` now works without protocol section (just shows Data Types)
- **Type reference docs from `.meta()` data** - Fixed `zod-metadata-extractor` to properly extract metadata from BinSchema's Zod schemas
- **JSON Schema for IDE autocomplete** - Created `binschema.schema.json` for VS Code autocomplete
