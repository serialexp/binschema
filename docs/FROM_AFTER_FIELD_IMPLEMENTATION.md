# from_after_field Implementation Status

## Overview

Implementation of `from_after_field` computed length fields for ASN.1/DER encoding (Kerberos protocol support).

**Date:** 2025-01-23
**Status:** 🟡 In Progress - Blocked on `writeBytes` method

---

## ✅ Completed Work

### 1. Schema Validation Updates
- **File:** `src/schema/binary-schema.ts`
- **Changes:**
  - Added `from_after_field` property to `ComputedFieldSchema`
  - Allows `length_of` fields to reference "all fields after X"

### 2. Validator Updates
- **File:** `src/schema/validator.ts`
- **Changes:**
  - Relaxed `length_of` to accept `varlength` type (for DER encoding)
  - Removed restriction that `length_of` targets must be array/string
  - Now allows byte length of ANY encoded type
  - Added validation for `from_after_field` property
  - Ensures `target` and `from_after_field` are mutually exclusive

### 3. calculateSize() Infrastructure
- **New File:** `src/generators/typescript/size-calculation.ts`
- **Purpose:** Generate `calculateSize()` methods for all encoder classes
- **Features:**
  - Calculates encoded size without actually encoding
  - Supports primitives (uint8, uint16, uint32, uint64, etc.)
  - Supports varlength (DER encoding size calculation)
  - Supports strings (TextEncoder byte length)
  - Supports arrays (sum of item sizes)
  - Supports composite types (recursive calculation)
- **Integration:**
  - Added to `generateCompositeTypeEncoder()` in `src/generators/typescript.ts`
  - Added to `generateTypeAliasEncoder()` for type aliases
  - Every encoder now has a `calculateSize(value: Type): number` method

### 4. from_after_field Implementation
- **File:** `src/generators/typescript/computed-fields.ts`
- **Changes:**
  - Implemented size calculation approach (NOT temp buffer two-pass)
  - Uses `generateFieldSizeCalculation()` to compute byte length of remaining fields
  - Generates code like:
    ```typescript
    let sequence_length_computed = 0;
    sequence_length_computed += /* size of field1 */;
    sequence_length_computed += /* size of field2 */;
    this.writeVarlengthDER(sequence_length_computed);
    ```

### 5. Bug Fixes

#### Variable Name Collisions (Pre-existing)
- **Problem:** Nested types with same field names (e.g., "length") caused variable collisions
- **Files Fixed:**
  - `src/generators/typescript/computed-fields.ts`
  - `src/generators/typescript/array-support.ts`
- **Solution:** Added `makeUniqueComputedVar()` helper that generates unique variable names using timestamp + random string
- **Impact:** All computed field variables now unique (e.g., `length_computed_1763831035683_994ryx0es`)

#### Varlength Method Calls (Pre-existing)
- **Problem:** Code called `this.writeVarlength()` which doesn't exist
- **Solution:** Added `getVarlengthWriteMethod()` helper that maps encoding to correct method:
  - `der` → `writeVarlengthDER()`
  - `leb128` → `writeVarlengthLEB128()`
  - `ebml` → `writeVarlengthEBML()`

#### Context Parameter Issues
- **Problem:** `calculateSize()` was being called with `context` parameter it doesn't accept
- **Files Fixed:**
  - `src/generators/typescript/size-calculation.ts`
  - `src/generators/typescript/array-support.ts`
- **Solution:** Removed `, context` from all `.calculateSize()` and `.encode()` calls to nested encoders

---

## 🟡 Current Blocking Issue

### Missing `writeBytes()` Method

**File:** `src/runtime/bit-stream.ts`
**Problem:** `BitStreamEncoder` doesn't have a `writeBytes(bytes: Uint8Array)` method

**Where Used:**
- `src/generators/typescript/array-support.ts:128,139`
- Byte-length-prefixed arrays encode items to temp buffer, then need to copy bytes

**Current Code:**
```typescript
// In array-support.ts (byte_length_prefixed encoding)
const tempEncoder = new (this.constructor as any)();
for (const item of value.array) {
  const itemEncoder = new ItemTypeEncoder();
  const itemBytes = itemEncoder.encode(item);
  tempEncoder.writeBytes(itemBytes); // ❌ Method doesn't exist!
}
const byteLength = tempEncoder.byteOffset;
```

**Impact:**
- Blocks all tests using byte-length-prefixed arrays
- Kerberos tests use this extensively (name_string arrays)

**Solution Options:**

1. **Add writeBytes() method to BitStreamEncoder** (recommended):
   ```typescript
   // In src/runtime/bit-stream.ts
   writeBytes(bytes: Uint8Array): void {
     for (const byte of bytes) {
       this.writeUint8(byte);
     }
   }
   ```

2. **Change array code to write bytes individually**:
   ```typescript
   // In array-support.ts
   for (const byte of itemBytes) {
     ${tempEncoderVar}.writeUint8(byte);
   }
   ```

**Recommended:** Option 1 - cleaner and more reusable

---

## ✅ Test Updates Completed

### Kerberos Tests Using `decoded_value`

**Pattern:** Computed `*_length` fields must be:
1. **Removed** from `value` (encoding input)
2. **Added** to `decoded_value` (decoding validation)

**Completed Test Suites:**
1. ✅ `kerberos_int32` (3/3 tests passing)
2. ✅ `kerberos_octet_string` (3/3 tests passing)
3. 🟡 `kerberos_principal_name` (3/3 tests updated, blocked by writeBytes)

**Remaining Test Suites to Update:**
4. ⏳ `kerberos_encrypted_data` (2 tests)
5. ⏳ `kerberos_pa_data` (2 tests)
6. ⏳ `kerberos_kdc_req_body` (1 test)
7. ⏳ `kerberos_as_req` (1 test - very complex nested structure)

---

## 📋 Next Steps

### Immediate (Unblock Tests)

1. **Add `writeBytes()` method to BitStreamEncoder**
   - File: `src/runtime/bit-stream.ts`
   - Add method to write array of bytes
   - Test with kerberos_principal_name

### Short-term (Complete Kerberos Tests)

2. **Update remaining Kerberos test suites**
   - Remove all `*_length` fields from `value` objects
   - Add `decoded_value` with all length fields included
   - Pattern is mechanical but tedious (100+ individual field moves)
   - Estimated: 4 test suites, ~50-75 field movements

3. **Verify all 7 Kerberos test suites pass**
   ```bash
   npm test -- --filter=kerberos --summary
   ```

### Medium-term (Cleanup & Optimization)

4. **Review and document the architecture**
   - Document why size-calculation approach was chosen over temp-buffer
   - Add inline comments explaining from_after_field logic

5. **Consider optimizations** (from technical-architect feedback)
   - Pre-allocate exact buffer size using calculateSize()
   - Cache encoded strings between calculateSize() and encode()
   - Emit constants for fully-fixed-size types

### Long-term (Go Support)

6. **Implement from_after_field in Go generator**
   - File: `go/codegen/generator.go`
   - Will need Go equivalent of calculateSize()
   - Should follow same architecture as TypeScript

---

## 🏗️ Architecture Notes

### Design Decision: Size Calculation vs Two-Pass Encoding

**Chosen:** Pre-Pass Size Calculation (Option B from architecture review)

**Why:**
- Matches industry standard (ASN.1 libraries, Protocol Buffers)
- Single memory allocation, no double buffering
- More efficient for nested structures
- Generated code is debuggable
- Enables future optimizations (buffer pre-allocation)

**Rejected:** Two-Pass Buffering
- Memory overhead (double buffering)
- Nested structures multiply memory usage
- Confusing generated code

### Key Files

| File | Purpose |
|------|---------|
| `src/schema/binary-schema.ts` | Schema definition (from_after_field property) |
| `src/schema/validator.ts` | Schema validation (varlength + length_of allowed) |
| `src/generators/typescript/size-calculation.ts` | Calculate encoded size without encoding |
| `src/generators/typescript/computed-fields.ts` | from_after_field implementation |
| `src/generators/typescript/array-support.ts` | Array encoding (needs writeBytes fix) |
| `src/runtime/bit-stream.ts` | Encoder runtime (needs writeBytes method) |

---

## 🧪 Testing

### Running Kerberos Tests

```bash
# All Kerberos tests
npm test -- --filter=kerberos --summary

# Specific test suite
npm test -- --filter=kerberos_int32
npm test -- --filter=kerberos_octet_string
npm test -- --filter=kerberos_principal_name

# Debug mode (verbose output)
DEBUG_TEST=1 npm test -- --filter=kerberos_int32

# Show only failures
npm test -- --filter=kerberos --failures
```

### Current Test Status

```
✅ kerberos_int32          (3/3 passing)
✅ kerberos_octet_string   (3/3 passing)
🟡 kerberos_principal_name (3/3 updated, blocked by writeBytes)
⏳ kerberos_encrypted_data (2 tests, needs decoded_value update)
⏳ kerberos_pa_data        (2 tests, needs decoded_value update)
⏳ kerberos_kdc_req_body   (1 test, needs decoded_value update)
⏳ kerberos_as_req         (1 test, needs decoded_value update)
```

---

## 📝 Example: from_after_field Generated Code

### Schema
```json
{
  "sequence": [
    { "name": "sequence_tag", "type": "uint8", "const": 0x30 },
    {
      "name": "sequence_length",
      "type": "varlength",
      "encoding": "der",
      "computed": { "type": "length_of", "from_after_field": "sequence_tag" }
    },
    { "name": "field1", "type": "Int32" },
    { "name": "field2", "type": "OctetString" }
  ]
}
```

### Generated Code (Simplified)
```typescript
class MyTypeEncoder extends BitStreamEncoder {
  encode(value: MyType): Uint8Array {
    // Write const field
    this.writeUint8(0x30);

    // Compute length of all fields after sequence_tag
    let sequence_length_computed_ABC123 = 0;

    // Add size of field1
    const field1_encoder = new Int32Encoder();
    sequence_length_computed_ABC123 += field1_encoder.calculateSize(value.field1);

    // Add size of field2
    const field2_encoder = new OctetStringEncoder();
    sequence_length_computed_ABC123 += field2_encoder.calculateSize(value.field2);

    // Write computed length
    this.writeVarlengthDER(sequence_length_computed_ABC123);

    // Encode actual fields
    const field1_bytes = field1_encoder.encode(value.field1);
    this.writeBytes(field1_bytes);

    const field2_bytes = field2_encoder.encode(value.field2);
    this.writeBytes(field2_bytes);

    return this.finish();
  }

  calculateSize(value: MyType): number {
    let size = 0;
    size += 1; // sequence_tag
    // Calculate sequence_length size
    const contentSize = /* recursive size calculation */;
    size += /* DER length size based on contentSize */;
    size += contentSize; // field1 + field2
    return size;
  }
}
```

---

## 🔍 Debugging Tips

### Common Issues

1. **"Field 'X' is computed and cannot be set manually"**
   - User provided computed field in `value`
   - Solution: Remove from `value`, add to `decoded_value`

2. **"ReferenceError: context is not defined"**
   - Code calling `.encode(value, context)` but context doesn't exist
   - Solution: Remove `, context` from encode/calculateSize calls

3. **"this.writeVarlength is not a function"**
   - Calling generic `writeVarlength()` instead of encoding-specific method
   - Solution: Use `getVarlengthWriteMethod()` helper

4. **Variable name collisions**
   - Multiple fields named same thing in nested structures
   - Solution: Use `makeUniqueComputedVar()` for all computed variables

### Debug Commands

```bash
# View generated code
cat .generated/kerberos_int32.ts

# Force regeneration
rm -rf .generated && npm test -- --filter=kerberos_int32

# Check for specific issues
grep "writeBytes" .generated/*.ts
grep "context" .generated/*.ts | grep calculateSize
```

---

## 📚 References

- RFC 4120: Kerberos Protocol Specification
- X.690: ASN.1 DER Encoding Rules
- `docs/ZOD_RECURSIVE_SCHEMA_FINDINGS.md`: Zod 4 schema patterns
- Technical architecture review (embedded in this session)
