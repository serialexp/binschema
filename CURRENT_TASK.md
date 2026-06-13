# Zig Generator — Phase 5 IN PROGRESS

> **Latest (Phase 5, in progress):** nineteen slices landed. Most recent —
> **primitive-alias resolution** (closed `pcf_full`). A bare alias whose terminal
> type is a *primitive* (`Uint8 -> uint8`, not another named struct/enum) is now
> resolved at every site: `zigDeclaredType`, the encode/decode type-ref dispatch,
> and the harness value builder all check `zigPrimitiveType(resolveAlias(...))` and
> emit the primitive directly instead of throwing "unresolved field type". Harness
> **353/354 · 832/832**, 0 errored/0 failed, TS 1192. Only `optional_builtin_bit`
> remains (a bit/byte-overlap quirk the byte-oriented Zig runtime does not
> replicate). Before that —
> **bare ancestor-scope field refs** (closed `dns_protocol_query`/`_response`).
> A non-local `length_field`/`count_field` that names a field of the entry (root)
> type — DNS `DnsQuery.questions` is `length_field: "qdcount"`, where `qdcount`
> lives in the outer `DnsFrame` header — now resolves on decode via the threaded
> `root` pointer (the same mechanism `_root.` uses). `computed.ts`
> `schemaHasAncestorFieldRefs` turns root threading on for such schemas;
> `EmitCtx.rootFieldNames` carries the entry type's field set; `decode.ts`
> `siblingRef` casts `root` to the entry type when a bare ref isn't local but is a
> root field (else still throws the clean cross-struct skip). Harness **352/354 ·
> 822/822**, 0 errored/0 failed, TS 1192. Only 2 skips remain: `pcf_full`
> (unresolved field type) and `optional_builtin_bit` (bit/byte-overlap quirk).
> Before that —
> **Kerberos ASN.1/DER** (all 7 suites). One recursive **content-first** encoder
> (`index.ts` `emitContentFirstBody` + `structNeedsContentFirst`) now handles
> every varlength length prefix whose value is the byte size of a region not yet
> encoded — a `from_after_field` suffix or a `length_of` over a struct/union
> target: encode the region into a temp encoder, measure it, write the varlength
> prefix, splice the bytes. Nested TLVs (SEQUENCE-in-SEQUENCE, ASN.1 contexts)
> compose by recursion; struct fields self-measure via their own `encodeInto`.
> The temp encoder is declared storage+pointer (`const tmp = &store`) so the
> `enc → tmp` redirect works for both method calls and child `encodeInto(tmp,…)`.
> This subsumes (and replaces) the old single-shot `emitFromAfterFieldEncode`.
> Supporting fixes: varlength (DER) `byte_length_prefixed` arrays measure-then-
> splice on encode and read a varlength prefix on decode (`encode.ts`/`decode.ts`,
> `emitLengthPrefixDecode` gained a `varlength` case); nominal Zig aliases for
> bare type-reference aliases (`types.ts` `resolveAliasName` + `index.ts` emits
> `pub const Realm = KerberosString;` for struct/enum terminals — string/array
> terminals still resolve inline to `[]const u8`); and the `offset` modifier on
> `length_of`/`count_of` (`computed.ts` — an ASN.1 BIT STRING's DER length covers
> a leading unused-bits byte, `length_of value` + 1). Harness **350/354 ·
> 820/820**, 0 errored/0 failed, TS 1192. Remaining skips: `dns_protocol_query`/
> `_response` (ancestor-scope `qdcount` ref — parent-stack bucket), `pcf_full`
> (unresolved field type), `optional_builtin_bit` (bit/byte-overlap quirk).
> Before that —
> **DNS label compression** (`back_reference` + non-struct DU variants). A union
> arm may now be a `string`/`bytes` or a `back_reference` (carried as
> `[]const u8`), not just a struct — `union.ts` classifies each variant and
> dispatches per-arm encode/decode. `compression.ts` gained real
> `emitBackReferenceEncode`/`Decode`: encode looks up the label text in the
> runtime `compression_dict` and emits a `topBits | (offset & mask)` pointer when
> present, else registers `absolute_byte_offset + enc.byteOffset()` and writes a
> literal; decode masks the offset, `pushPosition`/`seek`/decode-target/`popPosition`.
> Literal labels in a union that has a pointer variant register their own offset
> first. `encode.ts`/`decode.ts` gained `null_terminated` + `terminal_variants`
> array framing (terminal arm ends the chain with no trailing 0). Also fixed
> `translateWhen` to quote-check the author's raw `when` (not the discExpr-
> substituted form — a keyword field like `type` escapes to `@"type"`, whose
> quotes were falsely tripping the string-literal guard). All 13 DNS-compression
> suites generate; harness **343/354 · 805/805**, 0 errored/0 failed, TS 1192.
> A cross-struct guard in `decode.ts siblingRef` cleanly skips a bare ancestor-
> scope ref (`dns_protocol_query`/`_response`'s `qdcount`) — that's the deferred
> parent-stack bucket, not compression. Before that —
> **`_root.` cross-struct decode refs** (`computed.ts` `schemaUsesRootDecode` +
> `context.ts`/`index.ts`/`decode.ts`: when any `length_field`/`count_field`
> reads `_root.a.b`, every `decodeWith` seeds a `root: ?*const anyopaque` —
> `root_in orelse @ptrCast(&result)`, self at the entry / inherited otherwise —
> and forwards it to nested decoders; a descendant resolves the path by casting
> the pointer back to the entry type. Schemas with no `_root` ref keep the lean
> path untouched. Unblocked the 3 elf/zip instance suites — harness 332/354 ·
> 789/789). Before that —
> **`instances` (random access)** (`packages/binschema/src/generators/zig/instances.ts`:
> after the sequence decodes, save the cursor, seek to each instance's resolved
> absolute offset, decode the typed payload, restore the cursor — eager like
> Go/Python, not TS's lazy getters. The encoder never writes instance bytes, so
> the harness verifies these decode-only via `std.testing.expectEqualDeep`.
> Positions resolve from a literal `>=0` (absolute), literal `<0` (from EOF), a
> sibling field, or a dotted path into an earlier-decoded instance; `alignment`
> is validated. Instance struct members are appended to the struct, populated on
> decode, ignored on encode. **18/21 instance suites landed at the time**; the
> `_root.` slice above then unblocked the remaining elf/zip suites.
>
> **Phase 5 still pending — large structural buckets** (pick via
> `ZIG_TEST_REPORT=skips`, run from project root): `../` parent-stack decode
> references + bare ancestor-scope field refs (distinct from the `_root.`
> mechanism — walks up N parent scopes; surfaces in `dns_protocol_query`/`_response`
> where a payload array's length references the outer header's `qdcount`, and in
> the kerberos bucket — 2 dns + needed for kerberos), kerberos SEQUENCE types
> (varlength measure-then-patch + `from_after_field` with parent refs, ~7),
> `pcf_full` (unresolved field type, 1), `optional_builtin_bit` (1 suite — a
> documented bit/byte-overlap runtime quirk the byte-oriented Zig runtime does not
> replicate). DNS label compression (`back_reference` + non-struct DU variants,
> 13 suites) is **DONE** — see the latest slice above.
>
> ---
>
> **Earlier Phase 5 slices — the four before instances:**
> **compressed wire-transform regions** (`73183ec`: store/deflate/gzip codecs in
> `zig/runtime/codecs.zig` wired to `std.compress.flate`; inner value encoded to a
> self-contained buffer, framed `[uncompressed_size][compressed_length][bytes]`;
> a fresh top-level pass that composes with the outer two-pass without sharing
> context), **validation-suite accounting** (`b7fd8c6`: the 12
> `schema_validation_error` suites are TS-validator negative tests the Zig
> generator correctly refuses — now classified out of the codegen denominator
> instead of counted as phantom skips; resolved the
> `error_choice_missing_const_value` skip), **`variant_terminated` arrays**
> (`92c6fa6`: read union items until a decoded item's active variant is in
> `terminal_variants`; the marker is the array's last element so encode writes
> every item, decode appends-then-breaks via a switch over the active tag),
> **`field_id_delta` computed+conditional** (`204e8f6`: Thrift-style stateful
> field-id deltas — a struct-scoped `u64` accumulator holds the last emitted
> absolute id, advanced only inside the field's conditional guard so a dropped
> optional makes the next delta jump across it).
>
> ---
>
> **Earlier Phase 5 slices (nine):**
> **length_prefixed_items** (`a614b18`: outer count + per-item byte-length framing
> via placeholder/patch), **conditional fields** (`3a82850`: `?T` + `if`-guarded
> encode/decode; schema-aware condition translator that unwraps optional
> intermediates and AND-guards `!= null`), **signed varlength** zigzag/SLEB128
> (`deaed0c`: stored i64; also closed a harness gap where varlength fields were
> generated-but-untested — no value constructor meant 0 emitted cases),
> **array transform `delta`** (`e07f023`: loop-local accumulator, orthogonal to
> the item's wire encoding), **terminated & framed array kinds** (`6271e45`:
> null_terminated, signature_terminated peek-sentinel, byte_length_prefixed via
> placeholder/patch, packed_count Thrift header), **latin1 & utf16 string
> encodings** (`9532624`: new `zig/runtime/strenc.zig` transcoding module —
> latin1 1:1 bytes, utf16 code units + endianness + surrogate pairs; in-memory is
> UTF-8 `[]const u8`, framing measures BYTES), **alignment padding** (`b95fa83`:
> `type: "padding"` + `align_to` — memberless wire spacer writing/consuming zeros
> to align the byte offset; count from the live offset, composes with var-length
> predecessors; harness value constructor also skips padding), **const on
> fixed-length strings** (`3c1cb4e`: const literal routed through the normal
> string-encode path so framing + transcoding apply; const/computed `[]const u8`
> members default to `""`), **varlength computed length_of/count_of** (`8210ec2`:
> the synchronous DER/LEB128 length-prefix path — value from `self.<target>.len`,
> written with the varlength method; placeholder-needing kinds stay integer-only;
> new standalone `computed/varlength-length-of` suite verified across all five
> languages). (Harness numbers and the pending list are in the top block above —
> this block is the historical record of the first nine slices.)
>
> Doc `docs/ADDING_A_LANGUAGE.md` has the live status appendix + a "Pitfalls &
> lessons learned" appendix — keep both current as slices land.

> **Phase 4 follow-on (#24, DONE):** named union types + first/last over
> polymorphic arrays (`67e6a79`), **sum_of_type_sizes + sum_of_sizes** (`44a7aa1`),
> and **corresponding<T> with per-element occurrence capture** (`381f7b3`) all
> landed. Zig harness was **255/365 suites generate, 530/530 cases pass, 0 errored,
> 0 failed**; runtime unit tests 21/21; TS reference unchanged at 1189/1189.
>
> ### What the #24 follow-on delivered (each its own commit)
> - **named union types + first/last selectors over polymorphic (choice/DU)
>   arrays** (`67e6a79`): anonymous `union(enum){…}` literals at different sites
>   are *distinct* Zig types, so choice/DU now emit one shared named union
>   (`collectUnionTypes`); array recording captures each element's actual variant
>   type via a runtime tag switch (`unionTypeSwitchExpr`) so `first<T>`/`last<T>`
>   filter correctly.
> - **sum_of_type_sizes + sum_of_sizes** (`44a7aa1`): `PositionEntry` gains an
>   `end` offset; `selector_sum` patch sums matching elements' `end-offset`;
>   `parent_sum` patch sums an explicit set of `../field` byte ranges.
> - **corresponding<T>** (`381f7b3`): occurrence index captured at ENCODE time onto
>   the patch (`occurrence` field) instead of reading aggregate state. New
>   `current_arrays` stack + `selfOccurrence` count the referencer within its OWN
>   array (same-array=ZIP, cross-array=sibling). Closed the 14-suite skip.
>
> **Earlier (Phase 4):** enum/alias (`a37640a`), bitfield (`be0b893`), optional
> (`ede6faf`), and **discriminated_union + choice + byte_budget + measured
> length_of** (`c3d4614`).
>
> ### What Phase 4 delivered (each its own commit)
> - **enum / alias** (`enum.ts`): enums are their repr integer (u8/u16/u32) at the
>   API; decode validates the variant set (`else => error.InvalidValue`).
> - **bitfield** (`bitfield.ts`): anonymous `struct { sub: uN, ... }`; encode via
>   ordered `writeBits`, decode assigns sub-fields in statement order.
> - **optional** (`optional.ts`): `?T` with a uint8 presence byte. Bit-presence
>   optionals are a clean skip (reference runtime has a bit/byte-overlap quirk;
>   also a known Rust gap) — only `optional_builtin_bit` skips for this reason.
> - **choice / discriminated_union** (`union.ts`): anonymous
>   `union(enum) { Variant: VariantStruct, ... }`. choice peeks each variant's
>   first const field (flat `{type,...}` value); DU uses explicit `{field}` /
>   `{peek}` discriminator (nested `{type,value}`), with a `when`-less variant as
>   the catch-all `else`. **byte_budget** decodes the active variant from a
>   bounded sub-slice then advances the parent by the full budget (RIFF). DU/choice
>   as a *direct field* relies on anonymous-union literal coercion; named DU/choice
>   types emit nothing standalone (resolved inline at each field site).
> - **measured `length_of`** (computed.ts): `length_of` of a struct/union target
>   now reserves a u32 placeholder and back-patches it with the target's encoded
>   byte span (`_field_end_* - _field_off_*`) instead of the `.len` fast path
>   (unions have no `.len`). New `lenTargets` set in `computedTargets`.
>
> ### Remaining (Phase 5 #22)
> - **#24 Phase-4 follow-on: DONE** (see Latest above). Note: `length_of arr[sel<T>]`
>   *without* a sub-field (whole-element byte size) still throws a clean skip —
>   `sum_of_type_sizes` covers the aggregate case; the single-element variant has
>   no corpus suite yet.
> - **#22 Phase 5:** length_prefixed_items array kind, signed varlength
>   (leb128_signed/zigzag), array transforms (delta), back_reference/compression
>   (DNS), conditional fields, utf16/latin1 strings, alignment padding,
>   instances (random access), kerberos non-integer computed fields.

> **Earlier (Phase 3):** Phase 3 a/b/c + computed_count landed (commits `2ab6ff7`,
> `fe19083`, `26b040c`, + computed_count). **Mandated trio passes**
> (from_after_field, position_of-to-a-later-field, `../` parent ref). Zig harness
> was **174/363 suites generate, 403/403 cases pass, 0 errored**.
>
> **Key finding — selectors are gated on Phase 4.** Every corpus suite using a
> `first<T>`/`last<T>`/`corresponding<T>` selector also uses
> `discriminated_union`/`choice` (selectors filter array elements *by type*,
> i.e. polymorphic arrays). The selector *runtime* machinery is already built
> (`context.zig`: `recordPosition`/`bumpTypeIndex`/`selector_position` patches +
> `resolveDeferredPatches`), but selector *codegen* can't be verified end-to-end
> until DU/choice exist. So the sound order is **Phase 4 (DU/choice/optional/
> bitfield/enum) next, then selectors ride on top** — rather than landing
> unverifiable selector codegen now (violates the tests-first mandate).
>
> ### What Phase 3 delivered (all committed, each its own commit)
> - **3a** same-struct `length_of`/`count_of`/`position_of`/`crc32_of` + `const`
>   fields (local placeholders + struct-level back-patch via `_field_off_*`).
> - **3b** cross-struct `../field` refs. Runtime rebuilt to pointer-stable,
>   arena-allocated `Frame`s (`{length, range}` per field); deferred patches
>   capture the ancestor frame *pointer* directly (survives pop). Nested Zig
>   structs share ONE encoder ⇒ offsets are absolute ⇒ no rebasing. `length_of
>   ../f` resolves synchronously from eagerly-registered frame lengths;
>   `position_of`/`crc32_of ../f` defer. Gated on `schemaHasParentRefs` so
>   parent-free schemas keep the lean Phase-2 path.
> - **3c** `from_after_field` (content-first: temp encoder → measure → varlength
>   length + splice) + `varlength` field encode/decode (DER/LEB128/EBML/VLQ → u64).
>   Reference only supports from_after_field on varlength, so fixed-width is a
>   clean skip.
> - **computed_count** arrays: no wire prefix; decode recomputes count from
>   `count_expr` (identifiers→`@as(usize, result.f)`, +/-/* pass through).
>
> ### Remaining Phase-3 (deferred behind Phase 4)
> - Selectors `first<T>`/`last<T>`/`corresponding<T>` (length_of/position_of/
>   crc32_of). Runtime ready; needs DU/choice arrays to test.
> - `sum_of_type_sizes` (also DU-array-shaped).
> - `instances` (random access) — actually Phase 5 per plan; throw message still
>   says "Phase 3", harmless cosmetic.
>
> Everything below documents Phases 1 & 2 (still accurate).

---

# Zig Generator — Phases 1 & 2 complete

Adding Zig as a fifth code-gen target (after TS/Go/Rust/Python). Plan:
`~/.claude/plans/piped-finding-jellyfish.md`. Bart's two hard directives:
**(1)** build the two-pass + context-threading machinery FIRST (even before
features use it — every prior generator got rewritten twice for skipping this);
**(2)** SPLIT the generator into multiple files. Both satisfied. Template:
Python generator structure + Go-style batched test harness.

## Status

- **Zig harness: 363 suites — 125 generated, 238 codegen-skipped (later phases), 0 errored. 346 cases emitted, 346 passed, 0 failed.** No partially-emitted suites (run `ZIG_TEST_REPORT=coverage`).
- Runtime unit tests: 14/14 (`just test-zig-runtime`).
- TS reference suite: 1187/1187 (spec unchanged; fixed a Phase-1 command-parser test that still asserted the old `<ts|go|rust|python>` language list).

## Commands

- `just test-zig` / `just test-zig <filter>` / `just test-zig '' summary`
- `ZIG_TEST_REPORT=coverage bun zig/test/run_tests.ts` — lists generated suites that emit fewer cases than they hold (value-construction gaps)
- `DEBUG_GENERATED=tmp-zig-debug just test-zig <filter>` — keep generated `.zig`
- `just test-zig-runtime` — runtime's own unit tests

## Phase 1 (done): runtime + skeleton + wiring + harness

- `zig/runtime/`: `bitstream.zig` (two-pass encoder w/ `placeholderU*`/`patch*`; decoder w/ `readBytesSlice` zero-copy, `readUntilByte`, `hasMore`, seek/push/pop), `context.zig` (`EncodeContext`: parents/positions/iterations/deferred_patches), `errors.zig` (cross-lang `ErrorCode`), `codecs.zig`, `binschema.zig` (root re-export).
- `packages/binschema/src/generators/zig/` — 8 files: `index.ts` (entry + per-type dispatch), `naming.ts`, `types.ts`, `context.ts` (centralized ctx/root threading — no emitter can forget it), `encode.ts`, `decode.ts`, `computed.ts` (stubs), `compression.ts` (stubs).
- CLI (`--language zig`), `index.ts` export, justfile recipes, package.json bundling, `json5-load.ts`.
- Batched harness `zig/test/run_tests.ts`: one `gen_<i>.zig` per suite imported under alias `s<i>`; file-imports resolve the root module's `binschema` dep, so NO type-name prefixing needed (unlike Go/Rust).

## Phase 2 (done): primitives, structs, strings, byte-aligned arrays

Generator now handles (with full ctx/root threading everywhere):
- **Nested struct type refs**: `try value.encodeInto(enc, ctx)` / `Field.decodeWith(allocator, dec, root)`.
- **Strings** (`[]const u8`, decoded zero-copy as sub-slices of input): kinds fixed (trailing-null trim on decode), length_prefixed (uint8/16/32/64), null_terminated, field_referenced. Encodings ascii + utf8 only. utf16/latin1 → ZigNotImplemented.
- **Bytes** (`[]const u8`): fixed / length_prefixed / field_referenced.
- **Byte-aligned arrays** (`[]const T`, heap-allocated on decode via threaded allocator): fixed / length_prefixed / field_referenced / eof_terminated. Items: primitives, nested structs, strings.
- **Top-level string/bytes/array alias types**: emitted as free `encode<Name>`/`decode<Name>` (+ `*Into`/`*With`) functions so they work as standalone entry points (e.g. a DNS `Label`). Harness uses this path when `test_type` isn't a struct.

Key design decisions:
- Slice fields declared `[]const T` so const value-literals (`&[_]T{...}`) coerce and decode's `alloc` (`[]T`) coerces on assign.
- Decode uses an **arena** in the harness so array allocations are freed wholesale; strings/bytes are zero-copy (borrow input), no deinit needed.
- `discardsFor()` emits `_ = param;` only for threaded params a given body doesn't reference — avoids both unused-param and pointless-discard errors as the feature mix varies.

Cleanly deferred via `ZigNotImplemented` (so harness records honest per-suite gaps, never miscomputes): array `transform` (delta), computed fields, `from_after_field`, `position_of`, selectors, `../` parent refs, discriminated_union/choice/optional/bitfield/enum, `instances` (random access), varlength length-prefixes, back_reference/compression, utf16/latin1.

## Next: Phase 3 — computed fields + from_after_field + selectors

Per CLAUDE.md, the FIRST Phase-3 feature suite must include ≥1 `from_after_field`, ≥1 `position_of` to a later field, and ≥1 `../` parent ref — if those three don't pass early, the architecture is wrong. The runtime placeholder/patch + EncodeContext machinery for this already exists (built in Phase 1); Phase 3 wires the generator to use it.

## Uncommitted tree note

Phases 1 & 2 are all uncommitted. The tree ALSO contains changes I did not make
(`examples/parquet.schema.json`, `website/public/examples/parquet.schema.json`,
`TODO.md`, `bun.lock`, `website/public/docs/README.md`, deleted
`NEXT_TASK_RUST_INTO_OUTPUT.md`) — left untouched, awaiting Bart's direction on
how to stage/commit.
