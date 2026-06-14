# Bug: TS decoder branches on the wrong base path for a discriminated union inlined as a *named struct field*

**Reporter:** lune project (vendored TS codec, binschema @ `2befc37`)
**Generator:** `packages/binschema/src/generators/typescript.ts` (the `SeekableBitStreamDecoder` output)
**Severity:** High — produces a decoder that **always throws** on valid, round-trippable data. The Zig generator handles the same schema correctly, so encode/decode is asymmetric across languages.

---

## Summary

When a struct whose `sequence` contains a `discriminated_union` (with a
sibling-field discriminator) is inlined as a **named field** of another struct
(or as the field of an array element), the generated TS decoder:

- reads the discriminator tag into the **correct nested path** (`x.key.tag`), and
- assigns the decoded body to the **correct nested path** (`x.key.body`), but
- branches every `when` clause against the **container path** (`x.tag`), which
  is `undefined`.

Result: no branch matches, control falls through to the `else`, and decode
throws `BinSchemaError: Unknown discriminator value: undefined`.

The **array-element** case of the *same* union type generates correctly,
because there the union's struct *is* the iteration element, so the
discriminator field happens to sit directly on the iter variable. That
coincidence is what masks the bug — it only bites when the union-bearing struct
is nested one level under a named field.

---

## Minimal reproducing schema

```json
{
  "types": {
    "Val": {
      "sequence": [
        { "name": "tag", "type": "uint8" },
        {
          "name": "body",
          "type": "discriminated_union",
          "discriminator": { "field": "tag" },
          "variants": [
            { "type": "Nil", "when": "value === 0" },
            { "type": "Int", "when": "value === 1" }
          ]
        }
      ]
    },
    "Nil": { "sequence": [ { "name": "pad", "type": "uint8" } ] },
    "Int": { "sequence": [ { "name": "v", "type": "uint32", "endianness": "little_endian" } ] },

    "Pair": {
      "sequence": [
        { "name": "key", "type": "Val" },
        { "name": "val", "type": "Val" }
      ]
    },

    "Bag": {
      "sequence": [
        { "name": "as_elem", "type": "array", "kind": "length_prefixed",
          "length_type": "uint32", "items": { "type": "Val" } },
        { "name": "as_field", "type": "array", "kind": "length_prefixed",
          "length_type": "uint32", "items": { "type": "Pair" } }
      ]
    }
  }
}
```

Generate the TS decoder:

```
bun packages/binschema/src/cli/index.ts generate --language ts --schema repro.json --out /tmp/repro-ts
```

Then decode any non-empty `Bag` (e.g. one `as_field` entry). It throws on the
first `Pair.key`.

**Confirmed reproduced** against binschema `2befc37`. The generated
`/tmp/repro-ts/generated.ts` shows the defect in *two* places, proving it is not
array-iteration-specific:

- Standalone `PairDecoder` (a struct with two named `Val` fields):
  ```js
  value.key.tag = this.readUint8();   // line ~313 — tag into .key  ✓
  if (value.tag === 0) { ... }        // line ~314 — branch on parent  ✗
  ```
- Inline array-of-`Pair` inside `BagDecoder` (lines ~487–500): identical defect
  on `as_field__iter.key`.

By contrast the top-level `ValDecoder` (`value.tag` is a direct field, line
~121) and the array-of-`Val` case `as_elem__iter` (line ~465) are both correct —
exactly the cases where the inline path prefix is empty / equals the iter var.

---

## Expected vs. actual generated code

### ✅ Array-element union — `Bag.as_elem` (`Val` directly): correct

```js
array__iter = {};
array__iter.tag = this.readUint8();          // tag on the iter object
if (array__iter.tag === 0) { ... }           // branch on the SAME path  ✓
  array__iter.body = { type: 'Nil', value: payload };
```

### ❌ Named-field union — `Pair.key` / `Pair.val` (`Val` under a field): broken

```js
entries__iter = {};
entries__iter.key = {};
entries__iter.key.tag = this.readUint8();     // tag read into .key   ✓
if (entries__iter.tag === 0) {                //  ← branch on PARENT path  ✗ (undefined)
  ...
  entries__iter.key.body = { type: 'Nil', value: payload };  // body into .key  ✓
}
...
} else {
  throw new BinSchemaError(ErrorCode.INVALID_VARIANT,
    `Unknown discriminator value: ${entries__iter.tag}`);     // undefined  → always taken
}
```

The tag-read path (`entries__iter.key.tag`) and the body-assign path
(`entries__iter.key.body`) are both right; only the **branch condition base**
is wrong — it uses the enclosing object instead of the inlined struct's own
local path.

This repeats for the second field (`.val`) and would repeat for any nesting
depth: `HeapUpvalue.value`, etc.

---

## Real-world incidence (lune's vendored output)

In lune's `viz/src/gen/generated.ts` (same generator, schema
`schema/trace.json`):

- `HeapTableDecoder`: `array` field (line ~1824) — **correct**;
  `entries` field of `TableEntry` (lines ~1865 and ~1899) — **broken** (`.key`,
  `.val`).
- Same family also reaches `HeapUpvalue.value` and the `Effect`/`EffectFile`
  decoders — any place a `SnapValue`/`ConstValue`-style union sits under a named
  field rather than as an array element.

The Zig generator emits a correct decoder for the identical schema (lune
round-trips keyframes through Zig with no issue), so this is TS-codegen-specific.

---

## Root cause (where to look)

The discriminator field-access path is built from
`union.discriminator.field` (see `generateFieldAccessPath` /
`discriminatorValue` construction around `typescript.ts:424–460`) **relative to
the enclosing decode scope**, not relative to the local path of the struct
instance currently being inlined.

For an array element, the inlined struct's local path *is* the iter variable, so
`<base>.tag` is accidentally correct. For a named field `f`, the inlined struct
lives at `<base>.f`, but the discriminator path is still emitted as `<base>.tag`
instead of `<base>.f.tag`.

The fix is to thread the **current inline path prefix** (the same prefix already
used correctly for the tag read `…f.tag = readUint8()` and the body assignment
`…f.body = …`) into the discriminator-condition emission, so the `when` base and
the tag-read base are always identical.

Worth checking whether `python.ts` and `rust.ts` share the same
field-access-path construction — the bug is in *path resolution*, not anything
TS-specific, so they may have the same latent defect for nested named-field
unions.

---

## Suggested regression test

The `Bag` schema above is a tight fixture: encode `{ as_elem: [Int 7],
as_field: [{ key: Int 1, val: Nil }] }`, then assert the generated decoder
round-trips it. Today the encoder + Zig decoder agree; the TS decoder throws on
`as_field`. A passing decode of `as_field` (the named-field case) is the
acceptance check.

---

## Workaround in use (lune side)

None yet — lune is blocked on this for its keyframe state-view (step-debugger).
The two options on our end are (a) wait for this fix and keep using the
generated `SnapshotFileDecoder`, or (b) hand-roll a byte reader that bypasses
the generated decoder. We strongly prefer (a): the generated codec is our single
source of truth for the wire format, shared with the Zig producer, and a
hand-rolled parallel decoder would silently drift the moment the schema changes.
