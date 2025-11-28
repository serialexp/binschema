# Current Task: varlength support in from_after_field nested content

## Problem

The TypeScript code generator fails when a type with `from_after_field` contains nested fields that use `varlength` type. This affects the Kerberos schema tests.

**Error message:**
```
Code generation failed: Unknown primitive type for field encoding to bytes: varlength
```

**Affected tests (7 suites, 15 failures):**
- kerberos_encrypted_data
- kerberos_int32
- kerberos_kdc_req_body
- kerberos_octet_string
- kerberos_principal_name
- kerberos_pa_data
- kerberos_as_req

## Root Cause

In `packages/binschema/src/generators/typescript/computed-fields.ts`, the `generatePrimitiveEncoding` function handles encoding fields to a temporary buffer for `from_after_field` content-first encoding. This function supports basic primitives (uint8, uint16, etc.) but doesn't handle `varlength` type.

The relevant code is around line 269-318 in `computed-fields.ts`:

```typescript
function generatePrimitiveEncoding(
  field: Field,
  globalEndianness: Endianness,
  indent: string,
  encoderVar: string,
  valuePath: string
): string {
  // ... handles uint8, uint16, string, etc.
  // But no case for "varlength"
  default:
    throw new Error(`Unknown primitive type for field encoding to bytes: ${fieldAny.type}`);
}
```

## Solution

Add a case for `varlength` in `generatePrimitiveEncoding`:

```typescript
case "varlength": {
  const encoding = fieldAny.encoding || "der";
  const methodMap: Record<string, string> = {
    'der': 'writeVarlengthDER',
    'leb128': 'writeVarlengthLEB128',
    'ebml': 'writeVarlengthEBML',
    'vlq': 'writeVarlengthVLQ'
  };
  const method = methodMap[encoding] || 'writeVarlengthDER';
  code += `${indent}${encoderVar}.${method}(${valuePath});\n`;
  break;
}
```

## Additional Context

The Kerberos schema has nested ASN.1 DER structures where:
- Outer type has `from_after_field` to compute length
- Inner fields include `varlength` (DER length encoding) fields

Example from Kerberos schema:
```json
{
  "name": "length",
  "type": "varlength",
  "encoding": "der",
  "computed": { "type": "length_of", "target": "value" }
}
```

When the outer `from_after_field` tries to encode nested content that includes these `varlength` fields, it fails because `varlength` isn't handled.

## Files to Modify

- `packages/binschema/src/generators/typescript/computed-fields.ts` - Add varlength case to `generatePrimitiveEncoding`

## Testing

After fix, run:
```bash
npm test -- --filter=kerberos
```

All 7 affected Kerberos test suites should pass.

---

# Previous Tasks (Completed)

## Remaining Work: UX Improvements

**Date:** 2025-11-25

### Completed
- **Bin entry** - Added `"bin": { "binschema": "./dist/cli/index.js" }` to package.json
- **Build fixes** - Fixed TypeScript errors, removed dead `go-cli.ts` file
- **README.md** - Rewrote with correct `sequence` syntax, CLI usage, schema format docs
- **Plain schema docs** - `generateHTML()` now works without protocol section (just shows Data Types)
- **Type reference docs from `.meta()` data** - Fixed `zod-metadata-extractor` to properly extract metadata from BinSchema's Zod schemas
- **JSON Schema for IDE autocomplete** - Created `binschema.schema.json` for VS Code autocomplete
