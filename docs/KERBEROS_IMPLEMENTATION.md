# Kerberos Protocol Implementation

This document tracks the implementation of Kerberos V5 (RFC 4120) support in BinSchema.

## Overview

Kerberos uses ASN.1 DER (Distinguished Encoding Rules) encoding, which presents unique challenges for BinSchema:
- Variable-length integer encoding (DER length fields)
- Tag-Length-Value (TLV) structure with context-specific tags
- OPTIONAL fields determined by tag presence
- SEQUENCE structures with byte-length prefixes (not item counts)

## Features Implemented

### 1. Variable-Length Integer Encoding (`varlength` type)

Added support for three variable-length integer encoding schemes:

#### DER/BER Length Encoding (ASN.1)
- **Short form**: `0x00-0x7F` = length directly (0-127 bytes)
- **Long form**: `0x80 + N` where N = number of length bytes, followed by N bytes big-endian
- **Used in**: Kerberos, X.509, LDAP, SNMP

```json5
{ "name": "length", "type": "varlength", "encoding": "der" }
```

#### LEB128 (Protocol Buffers style)
- MSB continuation bit, little-endian, 7 bits per byte
- **Used in**: Protocol Buffers, WebAssembly, DWARF

```json5
{ "name": "value", "type": "varlength", "encoding": "leb128" }
```

#### EBML VINT (Matroska/WebM)
- Leading zeros indicate width, self-synchronizing
- **Used in**: Matroska/WebM multimedia containers

```json5
{ "name": "element_size", "type": "varlength", "encoding": "ebml" }
```

**Implementation**:
- Runtime: `src/runtime/bit-stream.ts` - encode/decode methods for all three schemes
- Schema: `src/schema/binary-schema.ts` - `VarlengthFieldSchema` type definition
- Generator: `src/generators/typescript.ts` - code generation for varlength fields
- Tests: `src/tests/primitives/varlength.test.ts` - 51 passing tests

**Test Results**: ✅ All 51 tests pass (DER short form, DER long form, LEB128, EBML, mixed encodings, edge cases)

### 2. Byte-Length-Prefixed Arrays (`byte_length_prefixed` array kind)

ASN.1 SEQUENCE structures have a length field that specifies the **byte length** of contents, not the item count. This required a new array kind.

**Problem**: Existing array kinds in BinSchema:
- `length_prefixed`: reads N items (item count)
- `field_referenced`: reads N items (item count from field)
- Neither supports "read until N bytes consumed"

**Solution**: Added `byte_length_prefixed` array kind:

```json5
{
  "name": "fields",
  "type": "array",
  "kind": "byte_length_prefixed",
  "byte_length_field": "sequence_length",  // Field containing byte count
  "items": { ... }
}
```

**Implementation**:
- Schema: `src/schema/binary-schema.ts` - Added to `ArrayKindSchema` enum
- Generator: `src/generators/typescript/array-support.ts` - Encoding/decoding logic
  - **Encoding**: Simply encodes items in sequence (length already written by length field)
  - **Decoding**: Tracks byte offset and reads items until `byteOffset >= startOffset + byteLength`
- Tests: `src/tests/primitives/byte-length-prefixed-array.test.ts` - 3 passing tests

**Decoding Logic**:
```typescript
const startOffset = stream.byteOffset;
const endOffset = startOffset + byteLength;
while (stream.byteOffset < endOffset) {
  // Read next item
}
```

**Test Results**: ✅ All 3 tests pass (3 bytes, empty, 5 bytes)

### 3. Test Infrastructure Improvements

#### Pipe-Separated Filters
Added support for OR logic in test filters:
```bash
npm test -- --filter="der_length|leb128|ebml"  # Matches ANY pattern
```

**Implementation**: `src/run-tests.ts` - Pattern splitting and matching for both test suites and function tests

## Kerberos Schema Progress

### Current Schema (`examples/kerberos.schema.json`)

**Implemented Types**:
- ✅ `DERLength` - Standalone DER length field (for testing)
- ✅ `DERTag` - ASN.1 tag byte
- ✅ `Int32` - ASN.1 INTEGER (32-bit signed)
- ✅ `OctetString` - ASN.1 OCTET STRING (arbitrary bytes)
- ✅ `KerberosString` - ASN.1 GeneralString (UTF-8)
- ⚠️ `PrincipalName` - Partially defined (structure only, no array parsing)
- ⚠️ `Realm` - Type alias to KerberosString
- ⚠️ `EncryptedData` - Partially defined (missing optional kvno field)
- ⚠️ `Ticket` - Partially defined (basic structure only)

**Test Coverage**:
- `src/tests/protocols/kerberos.test.ts`:
  - ✅ `kerberos_int32` - 3 passing tests
  - ✅ `kerberos_octet_string` - 3 passing tests

### Key Design Decisions

#### 1. OPTIONAL Fields → Choice Arrays

ASN.1 OPTIONAL fields are modeled as `byte_length_prefixed` arrays of `choice` items:

**ASN.1 Definition**:
```asn1
KDC-REQ-BODY ::= SEQUENCE {
    kdc-options             [0] KDCOptions,
    cname                   [1] PrincipalName OPTIONAL,
    realm                   [2] Realm,
    sname                   [3] PrincipalName OPTIONAL,
    ...
}
```

**BinSchema Approach**:
```json5
{
  "name": "sequence_length", "type": "varlength", "encoding": "der",
  "name": "fields",
  "type": "array",
  "kind": "byte_length_prefixed",
  "byte_length_field": "sequence_length",
  "items": {
    "type": "choice",
    "discriminator": { "peek": "uint8" },  // Context-specific tag
    "choices": [
      { "when": "0xA0", "type": "KDCOptions_Field" },      // [0]
      { "when": "0xA1", "type": "PrincipalName_Field" },  // [1] OPTIONAL
      { "when": "0xA2", "type": "Realm_Field" },          // [2]
      { "when": "0xA3", "type": "PrincipalName_Field" }   // [3] OPTIONAL
    ]
  }
}
```

**Rationale**:
- Context-specific tags (`[0]`, `[1]`, `[2]` → `0xA0`, `0xA1`, `0xA2`) act as perfect discriminators
- Fields can appear in any order or be omitted (OPTIONAL)
- The SEQUENCE byte length tells us when to stop reading fields

#### 2. Two-Pass Encoding Not Required

For `byte_length_prefixed` arrays, we decided **not** to implement automatic two-pass encoding:

**Rationale**:
- In Kerberos messages, the user typically constructs the entire message structure
- The length fields are provided as part of the value structure
- For encoding: trust the provided length, validate during item encoding
- For future computed length support: could add `computed: { type: "length_of", target: "fields" }` to the length field

**Current Approach**:
- User provides: `{ sequence_length: 9, fields: [...] }`
- Encoder: writes `sequence_length` as-is, then encodes all items
- If length is wrong, the decoder will fail or read wrong number of bytes (user error)

**Future Enhancement**: Add validation that consumed bytes matches length field

## Next Steps

### Phase 1: Complete Core Kerberos Types (Estimated: 4-6 hours)

1. **Fix PrincipalName** (1 hour)
   - Currently just has tag/length fields
   - Needs: `name-string` as `byte_length_prefixed` array of `KerberosString`
   - Test with various principal formats: `user@REALM`, `service/host@REALM`

2. **Fix EncryptedData** (30 minutes)
   - Add OPTIONAL `kvno` field
   - Needs conditional/choice handling for optional context tag `[1]`

3. **Implement PA-DATA** (1 hour)
   ```asn1
   PA-DATA ::= SEQUENCE {
       padata-type   [1] Int32,
       padata-value  [2] OCTET STRING
   }
   ```
   - Pre-authentication data structure
   - Used in AS-REQ

4. **Implement KDC-REQ-BODY** (2 hours)
   ```asn1
   KDC-REQ-BODY ::= SEQUENCE {
       kdc-options             [0] KDCOptions,        -- Bit string (32 bits)
       cname                   [1] PrincipalName OPTIONAL,
       realm                   [2] Realm,
       sname                   [3] PrincipalName OPTIONAL,
       from                    [4] KerberosTime OPTIONAL,     -- GeneralizedTime
       till                    [5] KerberosTime,
       rtime                   [6] KerberosTime OPTIONAL,
       nonce                   [7] UInt32,
       etype                   [8] SEQUENCE OF Int32,         -- Encryption types
       addresses               [9] HostAddresses OPTIONAL,
       enc-authorization-data  [10] EncryptedData OPTIONAL,
       additional-tickets      [11] SEQUENCE OF Ticket OPTIONAL
   }
   ```
   - **Challenge**: Many OPTIONAL fields
   - Use byte_length_prefixed array with choice items for all fields
   - Each field type becomes a separate schema type with context tag

5. **Implement AS-REQ** (1 hour)
   ```asn1
   AS-REQ ::= [APPLICATION 1] SEQUENCE {
       pvno            [1] INTEGER (5),
       msg-type        [2] INTEGER (10 -- AS-REQ --),
       padata          [3] SEQUENCE OF PA-DATA OPTIONAL,
       req-body        [4] KDC-REQ-BODY
   }
   ```
   - Application tag `[APPLICATION 1]` → `0x61`
   - Wraps KDC-REQ structure

6. **Implement AS-REP** (1 hour)
   ```asn1
   AS-REP ::= [APPLICATION 11] SEQUENCE {
       pvno            [0] INTEGER (5),
       msg-type        [1] INTEGER (11 -- AS-REP --),
       padata          [2] SEQUENCE OF PA-DATA OPTIONAL,
       crealm          [3] Realm,
       cname           [4] PrincipalName,
       ticket          [5] Ticket,
       enc-part        [6] EncryptedData
   }
   ```
   - Application tag `[APPLICATION 11]` → `0x6B`
   - Response from KDC with ticket

### Phase 2: Helper Types (Estimated: 2-3 hours)

1. **KDCOptions** (30 minutes)
   - 32-bit bitfield
   - Use BinSchema `bitfield` type with named bits
   - Flags: forwardable, forwarded, proxiable, proxy, etc.

2. **KerberosTime** (30 minutes)
   - ASN.1 GeneralizedTime
   - Format: `YYYYMMDDHHmmssZ`
   - Encoding: `IA5String` (ASCII)

3. **HostAddresses** (1 hour)
   - SEQUENCE OF HostAddress
   - Each HostAddress has addr-type (INT32) and address (OCTET STRING)

4. **SEQUENCE OF handling** (1 hour)
   - Create reusable pattern for ASN.1 SEQUENCE OF
   - Similar to single SEQUENCE but wraps array

### Phase 3: Real-World Testing (Estimated: 3-4 hours)

1. **Capture real Kerberos traffic** (1 hour)
   - Use Wireshark to capture AS-REQ/AS-REP exchange
   - Export packet bytes for test cases
   - Extract from test KDC (MIT Kerberos or Heimdal)

2. **Create integration tests** (1 hour)
   - Test decoding real AS-REQ packets
   - Test decoding real AS-REP packets
   - Verify ticket structure

3. **Build simple Kerberos client** (2 hours)
   - Construct AS-REQ message
   - Send to KDC over UDP (port 88)
   - Parse AS-REP response
   - Extract ticket (TGT)

### Phase 4: Additional Messages (If Needed)

- **TGS-REQ/TGS-REP**: Ticket-Granting Service (similar to AS-REQ/AS-REP)
- **AP-REQ/AP-REP**: Application authentication
- **KRB-ERROR**: Error responses

## Known Limitations

### 1. Choice Value Structure Inconsistency

**Issue**: Choice type encoding/decoding produces inconsistent value structures:
- **Expected**: `{ type: "Field0", value: { tag: 160, length: 1, value: 5 } }` (nested)
- **Actual**: `{ tag: 160, length: 1, value: 5, type: "Field0" }` (flat with type appended)

**Impact**: ASN.1 SEQUENCE choice tests fail on value structure comparison (not byte encoding)

**Status**: Pre-existing issue, not specific to byte_length_prefixed arrays or Kerberos

**Workaround**: Tests should accept either structure format

### 2. No Automatic Length Computation for byte_length_prefixed

**Issue**: When encoding, the byte length field must be provided by the user

**Example**:
```javascript
// User must calculate and provide length
const message = {
  sequence_length: 9,  // Must be correct!
  fields: [...]
};
```

**Future Enhancement**: Add support for computed length_of for byte_length_prefixed arrays

### 3. ASN.1 BIT STRING Not Implemented

**Issue**: KDCOptions is defined as BIT STRING in RFC 4120, but BinSchema doesn't have native BIT STRING support

**Workaround**: Model as byte array or use bitfield type

**RFC 4120**: "The kdc_options field is a bit-field, where the selected options are indicated by the bit being set (1)"

### 4. ASN.1 GeneralizedTime Not Implemented

**Issue**: KerberosTime uses ASN.1 GeneralizedTime format (`YYYYMMDDHHmmssZ`)

**Workaround**: Model as ASCII string, parse/format in application code

## Files Modified/Created

### Core Implementation
- ✅ `src/schema/binary-schema.ts` - Added varlength type, byte_length_prefixed array kind
- ✅ `src/schema/validator.ts` - Added varlength to BUILT_IN_TYPES
- ✅ `src/runtime/bit-stream.ts` - Varlength encode/decode methods
- ✅ `src/generators/typescript.ts` - Varlength code generation
- ✅ `src/generators/typescript/array-support.ts` - byte_length_prefixed encoding/decoding

### Tests
- ✅ `src/tests/primitives/varlength.test.ts` - 51 passing tests
- ✅ `src/tests/primitives/byte-length-prefixed-array.test.ts` - 3 passing tests
- ✅ `src/tests/protocols/kerberos.test.ts` - 6 passing tests
- ⚠️ `src/tests/protocols/asn1-sequence-choice.test.ts` - Choice value structure issues

### Examples
- ✅ `examples/kerberos.schema.json` - Partial Kerberos schema

### Test Infrastructure
- ✅ `src/run-tests.ts` - Pipe-separated filter support

### Documentation
- ✅ `CLAUDE.md` - Documented pipe filter syntax, ./tmp/ usage
- ✅ `docs/KERBEROS_IMPLEMENTATION.md` - This file

## Resources

- **RFC 4120**: Kerberos V5 specification - https://www.rfc-editor.org/rfc/rfc4120
- **ASN.1 Tutorial**: ITU-T X.680 (ASN.1 specification)
- **DER Encoding**: ITU-T X.690 (Distinguished Encoding Rules)
- **Test KDC Setup**: MIT Kerberos or Heimdal documentation

## Lessons Learned

1. **Test-First Development Works**: Writing tests for varlength and byte_length_prefixed before implementation caught edge cases early

2. **ASN.1 is Complex**: Every binary format we've implemented has quirks, but ASN.1's combination of optional fields, context tags, and TLV encoding is particularly challenging

3. **Incremental Implementation**: Starting with primitives (Int32, OctetString) before tackling complex messages (AS-REQ) was the right approach

4. **Two Generator Functions is Confusing**: Having both `generateDecodeArray` (class-based) and `generateFunctionalDecodeArray` (functional) caused bugs where we only updated one

5. **Pipe Filters Save Time**: Being able to run `--filter="der|leb128|ebml"` instead of running tests individually significantly speeds up development

## Questions/Decisions Needed

1. **Should we add automatic length computation for byte_length_prefixed?**
   - Pro: More user-friendly, less error-prone
   - Con: Requires two-pass encoding, complexity
   - **Recommendation**: Add as optional computed field feature later

2. **How to handle ASN.1 BIT STRING for KDCOptions?**
   - Option A: Model as byte array + manual bit manipulation
   - Option B: Extend BinSchema bitfield type to support ASN.1 BIT STRING format
   - **Recommendation**: Option A for now (simpler), Option B as future enhancement

3. **Should we model the full Kerberos protocol or just enough to connect?**
   - **Recommendation**: Focus on AS-REQ/AS-REP initially, add others as needed

4. **Test against real KDC or mock?**
   - **Recommendation**: Both - unit tests with mock data, integration tests with real MIT Kerberos KDC
