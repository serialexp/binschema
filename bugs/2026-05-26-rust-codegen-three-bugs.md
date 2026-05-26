# Rust codegen: three bugs surfaced by the scry ingest protocol

**Date:** 2026-05-26
**Reporter:** Claude (working on the `scry` observability project)
**Affected:** `packages/binschema/src/generators/rust.ts` + emitted code
**Severity:** Codegen produces Rust that does not compile against the bundled `binschema-runtime`. Three independent bugs.

## Summary

While exercising the Rust generator against the [scry ingest protocol schema](../../scry/proto/ingest.schema.json) — a flat tagged-union wire protocol with typical features (discriminated_union at the root, optional bytes fields, length-prefixed bytes payloads) — the schema **validates cleanly** (`binschema validate` returns `✓ Schema is valid`) but the generated Rust source produces **12 compile errors** from three distinct codegen bugs.

This was hit on first contact, no exotic schema features used. Each bug touches a primitive path (`bytes`, `optional<bytes>`, discriminated-union fallback) that any non-trivial protocol uses.

## Reproduction

The full reproducing schema is at `/home/bart/Projects/scry/proto/ingest.schema.json`. A minimal reproduction for each bug is below; you can drop these into `examples/` (or `tmp/`) and run:

```bash
cd /home/bart/Projects/binschema
node packages/binschema/dist/cli/index.js generate \
  --language rust \
  --schema <repro>.schema.json \
  --out ./tmp/repro-out
cd ./tmp/repro-out
echo 'pub mod generated;' > src/lib.rs
cargo build
```

## Bug 1: `InvalidVariant` arity mismatch in discriminated_union decode fallback

**Severity:** breaks every discriminated_union with no fallback variant. (Our protocol has one — `Frame.msg` — that hits this 9 times across the recursive decode tree.)

**Generated code (broken):**
```rust
// src/generators/rust.ts emits this in the decode fallback:
Err(binschema_runtime::BinSchemaError::InvalidVariant(0))
//                                                    ^ integer
```

**Runtime definition:**
```rust
// binschema_runtime/src/lib.rs:43
InvalidVariant(String),
//             ^^^^^^ requires String
```

**Compile error:**
```
error[E0308]: mismatched types
   --> src/generated.rs:192:63
    |
192 |         Err(binschema_runtime::BinSchemaError::InvalidVariant(0))
    |             ------------------------------------------------- ^ expected `String`, found integer
```

**Likely fix:** either pass `format!("{}", tag)` / `"unknown".to_string()` at the call site, or change `InvalidVariant` in the runtime to `InvalidVariant(u64)`. The latter is probably better — losing the discriminator value when an unknown variant is decoded makes debugging harder than necessary.

**Minimal repro schema:**
```json
{
  "config": { "endianness": "big_endian", "bit_order": "msb_first" },
  "types": {
    "Root": {
      "sequence": [{
        "name": "msg",
        "type": "discriminated_union",
        "discriminator": { "peek": "uint8" },
        "variants": [
          { "type": "A", "when": "value === 0x01" },
          { "type": "B", "when": "value === 0x02" }
        ]
      }]
    },
    "A": { "sequence": [{ "name": "tag", "type": "uint8", "const": 1 }, { "name": "x", "type": "uint8" }] },
    "B": { "sequence": [{ "name": "tag", "type": "uint8", "const": 2 }, { "name": "y", "type": "uint8" }] }
  }
}
```

## Bug 2: `optional<bytes>` references a non-existent `Bytes` type

**Severity:** any `optional` wrapping an inline `bytes` field fails to compile.

**Schema fragment (legal, validates):**
```json
{
  "name": "parent_span_id",
  "type": "optional",
  "value_type": { "type": "bytes", "kind": "fixed", "length": 8 }
}
```

**Generated encode (broken):**
```rust
if let Some(ref v) = self.parent_span_id {
    encoder.write_uint8(1);
    v.encode_into(encoder)?;  // ← Vec<u8> has no method encode_into
} else {
    encoder.write_uint8(0);
}
```

**Generated decode (broken):**
```rust
let has_value = decoder.read_uint8()? != 0;
let parent_span_id = if has_value {
    Some(Bytes::decode_with_decoder(decoder)?)  // ← no such type `Bytes`
} else {
    None
};
```

**Compile errors:**
```
error[E0599]: no method named `encode_into` found for reference `&Vec<u8>` in the current scope
error[E0433]: cannot find type `Bytes` in this scope
```

**Likely cause:** the `optional` codegen dispatches `value_type` through the same path as named types, generating `<TypeName>::encode_into(...)` and `<TypeName>::decode_with_decoder(...)`. For an inline `bytes` `value_type`, the `<TypeName>` substitution falls through to literal `"Bytes"` instead of inlining the same loop that a top-level `bytes` field generates.

**Likely fix:** when `optional.value_type.type === "bytes"`, inline the same fixed-length / length-prefixed bytes write/read code that a struct field would emit, instead of synthesising a non-existent type reference.

**Minimal repro schema:**
```json
{
  "config": { "endianness": "big_endian", "bit_order": "msb_first" },
  "types": {
    "Root": {
      "sequence": [{
        "name": "id",
        "type": "optional",
        "value_type": { "type": "bytes", "kind": "fixed", "length": 8 }
      }]
    }
  }
}
```

## Bug 3: `length_prefixed bytes` field calls `encode_into` per element

**Severity:** any `bytes` field with `kind: length_prefixed` and a struct context (e.g. `Batch.payload`) generates an element-by-element loop that wrongly calls `encode_into` on each byte.

**Schema fragment (legal, validates):**
```json
{ "name": "payload", "type": "bytes", "kind": "length_prefixed", "length_type": "uint32" }
```

**Generated encode (broken):**
```rust
encoder.write_uint32(v.payload.len() as u32, Endianness::BigEndian);
for item in &v.payload {
    v.encode_into(encoder)?;  // wrong: encode_into on a u8 element, also `v` is the parent struct
}
```

(Compare with the `fixed` `bytes` case at line ~1521, which generates correctly:
```rust
for item in &self.trace_id {
    encoder.write_byte(*item);
}
```
)

**Compile error:**
```
error[E0599]: no method named `encode_into` found for reference `&Vec<u8>` in the current scope
   --> src/generated.rs:1529:15
```

**Likely cause:** the `length_prefixed` array codegen, when applied to `bytes` (i.e. `array<uint8>` sugar), doesn't special-case the element type to a `write_byte` and instead falls through to the named-type element path.

**Likely fix:** in the `length_prefixed` bytes path, emit:
```rust
encoder.write_uint32(self.payload.len() as u32, Endianness::BigEndian);
for &b in self.payload.iter() {
    encoder.write_byte(b);
}
```
…matching what the `fixed bytes` path does.

**Minimal repro schema:**
```json
{
  "config": { "endianness": "big_endian", "bit_order": "msb_first" },
  "types": {
    "Root": {
      "sequence": [
        { "name": "payload", "type": "bytes", "kind": "length_prefixed", "length_type": "uint32" }
      ]
    }
  }
}
```

## Suggested triage

All three are localised in `packages/binschema/src/generators/rust.ts`:

1. **Bug 1** — change the discriminator-fallback emission to `InvalidVariant(format!("0x{:02x}", tag))` (or similar) and/or change the runtime variant to `InvalidVariant(u64)`. Add a regression test that wraps `Root.msg` from the bug-1 repro and asserts the generated code compiles when no fallback variant exists.
2. **Bug 2** — in the `optional` codegen, dispatch `value_type` through the field-emit path rather than the type-reference path when `value_type.type === "bytes"`. Add a regression test against the bug-2 repro.
3. **Bug 3** — in the array/bytes codegen, special-case `bytes` in the `length_prefixed` (and likely also `field_referenced`, `null_terminated` if applicable) array kinds to emit `write_byte` per element instead of `<ElementType>::encode_into`. Mirror the existing `fixed bytes` codepath. Add a regression test against the bug-3 repro.

## Cross-language status

I only ran the Rust generator; TS and Go may or may not have the same issues. The `optional<bytes>` and `length_prefixed bytes` cases are worth checking in the TS test suite since they're things any new schema using `bytes` will hit.

## Context for the scry side

scry is on hold pending these fixes (or a decision to work around). The schema itself is checked in and validates; once the codegen is fixed we can re-run `binschema generate` and continue with the noise spewer + sink server build-out. No schema changes are needed to unblock us — these are pure codegen issues.
