# Python Generator: Remaining Work

## Status
**730 / 785 tests passing** (55 failing). Up from 717 at start of last session, originally ~514 several sessions ago.

Recent commits:
- `845f7bc` length_of with target struct trial-encode, nested from_after_field recursion, hyphen names
- `306ff0d` threaded parentFields through choice inliner, alias chain resolution → all kerberos pass
- `0a2e458` (docs) CLAUDE.md rule: two-pass + context threading from day one for new generators
- `6604661` inline DU length_of, sum_of_type_sizes, length_of first/last selectors

## What's left (55 failures)

All remaining failures fall into one of five categories, all blocked on the **same missing infrastructure**: encode-time context threading + byte-offset tracking + back-patch via context lookup.

### Category 1: `position_of` with `first<T>` / `last<T>` selectors
Tests: `context_first_selector`, `context_last_selector`, `first_element_position`, `last_element_position`, `length_of_first_selector` (already partially works — only the position_of half fails), `length_of_last_selector`, `crc32_of_first_selector`, `crc32_of_last_selector`.

**What's needed:** Parent encoder records `(byte_offset, item)` per array element while encoding. That info travels to the sibling struct's encoder so its `position_of` placeholder can be back-patched with `offsets[arr][first<T>]`.

### Category 2: `corresponding<T>` correlations
Tests: `corresponding_correlation`, `empty_array_correlation`, `context_corresponding_single_array`, `context_multiple_variants_corresponding`, `context_inner_references_outer_array`, `context_sibling_array_cross_reference`, `zip_style_correlation`.

**What's needed:** Same-array type-occurrence index tracked at encode time (`typeIndices[T]++` as each T encodes). When a computed field hits `arr[corresponding<T>]`, look up the Nth T (where N is the current iteration's occurrence count). See TS `computed-fields.ts:835-925` for the full algorithm — it distinguishes same-array (use type occurrence) vs cross-array (use index).

### Category 3: Multi-level / cross-array parent references
Tests: `nested_parent_references`, `parent_reference_position`, `parent_reference_crc32`, `context_deep_nesting_cross_reference`, `context_multi_level_parent_reference`, `context_extension_array`, `context_extension_chaining`, `context_extension_parent_stack_across_arrays`, `context_extension_sibling_arrays`, `conditional_nested_parent` (1 case).

**What's needed:** `_parent_value` only goes one level. `../../foo` needs a `parents: list[dict]` stack threaded through every nested encode call so the child can walk arbitrarily far up.

### Category 4: Aggregate / sum computed fields at encode time
Tests: `aggregate_size_with_position`, `array_element_type_size`, `sum_of_field_sizes`, `zip_style_aggregate_size`, `context_sum_of_type_sizes_zip_style`.

**What's needed:** Some of these are variants of sum_of_type_sizes that need offset awareness (e.g. `aggregate_size_with_position` writes the position of where the aggregate starts). Others are sum_of_field_sizes against sibling arrays — works similarly to sum_of_type_sizes but the current impl doesn't traverse the parent ref correctly.

### Category 5: Real protocols (DNS / ZIP / PCF)
Tests: `dns_compression_pointer`, `dns_compression_in_answers`, `dns_compression_mixed`, `dns_compression_edge_cases`, `minimal_zip_single_file`, `multi_file_zip`, `multi_file_utf8_filenames`, `pcf_full`.

**What's needed:** DNS uses `back_reference` (forward pointers to earlier-encoded labels). ZIP uses `position_of` to later fields (central directory headers reference the local-header positions). PCF has all of: position_of, sum_of_type_sizes against sibling array, deeply nested parent refs. These are integration tests — they pass when all of categories 1-4 work.

## Proposed infrastructure (the actual retrofit)

This is the work CLAUDE.md now mandates for any **new** generator, but Python was written without it and needs the retrofit. The TS reference (`packages/binschema/src/generators/typescript/`) already does all of this — copy the structure.

### 1. Encoder signature change
```python
def encode(self, value, _parent_value=None, _ctx=None) -> bytes:
    if _ctx is None:
        _ctx = {
            "parents": [],
            "array_offsets": {},     # {arrname: [(offset, item), ...]}
            "array_iterations": {},  # {arrname: {"index": int, "typeIndices": {T: int}}}
        }
    _ctx["parents"].append(value)
    try:
        # ... existing encode body ...
    finally:
        _ctx["parents"].pop()
```

All nested encoder invocations (DU sub-encoder, choice sub-encoder, type-ref sub-encoder, array item encoder, `sum_of_type_sizes` trial encoders) must pass `_ctx` through.

### 2. Array iteration tracking
In every array encode loop, before encoding each item:
```python
_ctx["array_offsets"]["<arrname>"].append((encoder.byte_offset, _item))
_ctx["array_iterations"]["<arrname>"]["index"] = i
_ctx["array_iterations"]["<arrname>"]["typeIndices"].setdefault(_item.get("type"), 0)
_ctx["array_iterations"]["<arrname>"]["typeIndices"][_item["type"]] += 1
```

Only emit this tracking code for arrays that are actually targets of `position_of`/`corresponding<>`/`first<>`/`last<>` in any computed field in the schema (otherwise it's noise). Use `detectFirstLastTracking`/`detectCorrespondingTracking` ports of the TS helpers in `typescript/computed-fields.ts:480-534`.

### 3. position_of back-patch via context lookup
Currently `generateStructCode` does back-patching for `position_of target=fieldname` (same-struct). Extend the back-patch logic to handle:
- `target = "../arr[first<T>]"` → look up `_ctx["array_offsets"]["arr"]`, find first item with `type == T`, write its offset
- `target = "../arr[last<T>]"` → ditto, reverse iteration
- `target = "../arr[corresponding<T>]"` → use current array iteration state to look up the corresponding peer

### 4. crc32_of with selectors
Same lookup as position_of selector to find the item, then trial-encode it (or look up its bytes via offset range in the buffer) and CRC32.

### 5. Multi-level parent refs
Replace single-level `_parent_value["foo"]` resolution with walking `_ctx["parents"]` from the back:
- `../foo` → `_ctx["parents"][-2]["foo"]`
- `../../foo` → `_ctx["parents"][-3]["foo"]`
- Or scan from innermost outward to find the closest parent that has `foo`.

## Why not in this session
Each piece is straightforward in isolation, but the retrofit touches every encoder/decoder generator path: DU encode, choice encode/inline, type-ref encode, array item encode, optional encode, computed field handlers, struct encode entry, and every nested invocation site. Estimating ~3-5h of careful work plus verification across the full test suite. Better done as a focused PR than crammed into a tail-end session where context budget is constrained.

## Next steps
1. Implement the ctx threading retrofit (categories 1-3) — biggest unlock, ~30-40 of the 55 remaining failures.
2. Implement back_reference for DNS compression (category 5, ~6 failures).
3. Re-evaluate remaining failures — likely a small set of bespoke cases.
