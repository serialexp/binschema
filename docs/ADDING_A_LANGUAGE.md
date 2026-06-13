# Adding a New Code-Gen Language Target — Implementation Order

> **Read this first if you've been asked to add a new language** (C, Swift,
> Kotlin, Zig, …). It encodes the order that finally worked, and *why* each step
> precedes the next. Following it avoids the two failure modes that cost us a
> full rewrite on **every** prior generator. The Zig target was the first one
> built this way start-to-finish; its live status is the appendix at the bottom.

## The two non-negotiable meta-rules (both are in CLAUDE.md)

These are not style preferences. Every generator that skipped them
(TypeScript early on, Go, Rust, Python) had to be partially or fully rewritten
weeks later. Do them on **commit 1**, before a single feature needs them.

1. **Two-pass encoding + full context threading from day one.**
   Encode emits into a buffer, never straight to the stream. A
   placeholder/patch table is part of the *runtime*, not the generator
   (`placeholderU32()` → handle; `patchU32(handle, value)` back-patches by
   offset). `parentFields`/`_root`/a context object is threaded through **every**
   recursive encode/decode call — type refs, choice/DU arms, array item
   encoders, optional encoders, nested structs — even while nothing uses it yet.
   The classes of feature that *cannot* be expressed single-pass are the common
   shapes in real protocols, not edge cases: `length_of` + `from_after_field`
   (DER/TLS/Kerberos), `position_of` to a later field (ZIP), `first/last/
   corresponding` selectors, `crc32_of` over a later range, `../` parent refs.

2. **Split the generator into multiple files from the start.**
   `go.ts` (6.6k lines) and `rust.ts` (8.6k) are single files and are miserable
   to work in. Mirror the Python/Zig module split (see "Module layout" below).

**The architecture litmus test (CLAUDE.md, mandatory):** the *first* feature
suite you make pass beyond primitives MUST include **≥1 `from_after_field`,
≥1 `position_of` to a later field, and ≥1 `../` parent reference.** If those
three don't pass early, the architecture is wrong — stop and fix the
machinery, don't pile on coverage.

## The tests-first contract (CLAUDE.md, mandatory)

- **TypeScript is the spec.** `packages/binschema/src/generators/typescript/`
  is the reference. If TS and your generator disagree on bytes, your bytes are
  wrong — verify the shape on TS *before* writing the new generator's version.
- **Never hand-compute expected bytes from your own implementation** — that
  cements bugs as ground truth. Hand-derive them from the wire format, or take
  them from the TS reference.
- **Before adding/fixing a codegen feature, ensure a `TestSuite` exercises that
  exact shape across every language.** The expensive bug class in this repo is
  "TS handles it, language X silently throws `NotImplemented` / emits `0`, nobody
  notices for two months." If no suite hits the path, the next regression lands
  silent. When you find a gap with no homogeneous/standalone coverage, *add the
  suite* (verify on TS first), then implement.
- Defer unimplemented shapes by **throwing a typed `NotImplemented`** so the
  harness records an honest per-suite skip — never emit code that miscomputes.

## Module layout (mirror `generators/zig/` and `generators/python.ts`)

```
generators/<lang>/
  index.ts        entry generate<Lang>() + per-type emit dispatch
  naming.ts       case conversion, unique vars, keyword escaping
  types.ts        field-type -> lang-type mapping, endianness, alias resolution
  context.ts      the ctx/_root threading helpers — so no emitter can forget it
  encode.ts       generateFieldEncode + string/bytes/array/typeref encode
  decode.ts       generateFieldDecode + counterparts
  computed.ts     computed fields, from_after_field, selectors, placeholder/patch
  compression.ts  back-reference / DNS-label compression
```

Runtime (`<lang>/runtime/`): `bitstream` (two-pass encoder w/ placeholder/patch,
decoder w/ zero-copy slice reads + seek/push/pop), `context` (typed
EncodeContext: parents/positions/iterations/deferred_patches/compression_dict +
`resolveDeferredPatches`), `errors` (canonical cross-lang `ErrorCode` set),
`codecs`, root re-export module.

Harness (`<lang>/test/`): Go-style **batched** — one generated file per suite
compiled into a single binary, honoring `<LANG>_TEST_FILTER` /
`<LANG>_TEST_REPORT` / `DEBUG_GENERATED`. Reuse the shared JSON corpus in
`packages/binschema/.generated/tests-json/`; the export pipeline needs no
changes. **Note:** the export step writes JSON but does not prune orphans — if
you delete a test suite, delete its stale `.generated/tests-json/**/<name>.json`
by hand or the harness keeps "failing" the ghost.

## The phase order (and why each precedes the next)

The ordering is driven by **dependency**, not difficulty. A feature is placed
right after everything it needs to be *testable end-to-end* against the corpus.

### Phase 1 — Skeleton + machinery (NO features)
Runtime (bitstream w/ placeholder/patch, context, errors), the 8-file module
split as stubs **with ctx/_root already threaded**, CLI + justfile + package
wiring, and a batched harness that compiles an empty suite. Nothing is
feature-complete; the two-pass machinery simply *exists*. This is the commit
that prevents the rewrite.

### Phase 2 — Primitives, structs, strings, byte-aligned arrays
The non-forward-reference core: scalars, bit fields, nested struct refs,
strings (fixed/length-prefixed/null-terminated/field-referenced, ascii+utf8),
bytes, byte-aligned arrays (fixed/length-prefixed/field-referenced/eof). Settle
the **allocator/ownership convention** here (decode arena, zero-copy slices,
`deinit`) — it's the one axis with no analogue in GC'd targets, and retrofitting
it is painful.

### Phase 3 — Computed fields + forward references (the machinery's first users)
This is where the Phase-1 investment pays off. Order *within* the phase:
- **3a** same-struct computed fields: `length_of`/`count_of`/`position_of`/
  `crc32_of` to a sibling, plus `const` fields. Local placeholders, struct-level
  back-patch.
- **3b** cross-struct `../field` parent references. Build **pointer-stable,
  arena-allocated parent frames**; deferred patches capture the *frame pointer*
  directly so they survive the frame being popped (this is the correctness
  insight — relative level indices break after a pop; see
  `POSITION_TRACKING_ARCHITECTURE.md`). If nested structs share ONE encoder,
  offsets are absolute and need no rebasing.
- **3c** `from_after_field` (content-first: encode the tail into a temp encoder,
  measure, write a `varlength` length, splice) + `varlength` integer fields
  (DER/LEB128/EBML/VLQ). The reference only supports `from_after_field` on
  `varlength`, so fixed-width is a clean skip — do **not** invent a fixed-width
  suite; TS will reject it.
- **3d** `computed_count` arrays (no wire prefix; decode recomputes count from
  an arithmetic `count_expr` over already-decoded siblings).

**Run the architecture litmus test at the end of 3b/3c** — that's the first
point all three mandated shapes (`from_after_field`, `position_of`-to-later,
`../`) exist together.

### Phase 3e — Selectors over **homogeneous** arrays (lands before Phase 4)
**Key sequencing insight (don't repeat the mistake of deferring all of this to
Phase 4):** `first<T>`/`last<T>`/`corresponding<T>` selectors do **not** require
a discriminated_union. The TS reference matches `item.type === undefined ||
item.type === '<Filter>'`, so over a plain `[]T` every element matches and the
selector is well-defined (`first<T>` = element 0, `last<T>` = last). The
selector *runtime* (position recording + `selector_position` patches) is already
built in Phase 1, so the **homogeneous** half of selectors is verifiable now,
against existing corpus suites (`last_element_position`, `empty_array_correlation`
are plain `[]struct`). Only the `length_of`/`crc32_of` first/last selectors
lacked homogeneous coverage — add that suite (verify on TS first). The
**DU/choice-flavored** selector suites genuinely need Phase 4 and ride on top
of it.

### Phase 4 — Polymorphism: discriminated_union / choice / optional / bitfield / enum aliases
The large structural phase. Unlocks the DU/choice-flavored selector suites and
`sum_of_type_sizes` (DU-array-shaped).

### Phase 5 — The long tail
Remaining `varlength` (signed/zigzag/sleb128), compression / back-reference
(DNS labels), utf16/latin1 strings, array transforms (delta), `instances`
(random access), streaming, and the full cross-language parity sweep.

## Verification cadence per phase

- `npm test` in `packages/binschema` — confirms the TS spec is **unchanged**
  (no expected bytes were edited to match an implementation).
- `just test-<lang> <filter>` — the slice of the corpus this phase targets.
- Cross-language guard for any *new* schema shape: add the `TestSuite`, verify
  on TS, then run `just test-go/-rust/-python/-<lang>` so a single-language gap
  can't hide.
- `<LANG>_TEST_REPORT=skips|coverage` — confirm deferred suites skip for the
  *expected* reason and no suite emits fewer cases than it holds.

---

## Appendix: Zig target — live status

> Keep this section current as work lands. Date stamps optional; commit hashes
> preferred.

**Toolchain:** `zig 0.17.0-dev` (a dev build — std APIs drift; pin the version).

**Phase 1 — DONE.** Runtime (`bitstream`/`context`/`errors`/`codecs`/`binschema`),
8-file `generators/zig/` split with ctx/root threaded, CLI (`--language zig`),
justfile + package wiring, batched harness (`zig/test/run_tests.ts`, file-import
based so no per-suite type prefixing needed). Runtime unit tests green.

**Phase 2 — DONE.** Primitives, bit fields, nested struct refs, strings
(fixed/length-prefixed/null-terminated/field-referenced, ascii+utf8), bytes,
byte-aligned arrays (fixed/length-prefixed/field-referenced/eof), top-level
string/bytes/array alias entry points. Decode uses a harness arena; strings/bytes
zero-copy. Ownership convention settled (`[]const T` fields).

**Phase 3 a–d — DONE** (commits `2ab6ff7`, `fe19083`, `26b040c`, +computed_count,
docs `dc6dc59`). Same-struct computed + const (3a); cross-struct `../field` via
pointer-stable arena frames whose pointers are captured by deferred patches and
survive pop (3b); `from_after_field` content-first + `varlength` int fields (3c);
`computed_count` arrays (3d). **Architecture litmus test passes**:
`from_after_field`, `position_of`-to-a-later-field, and `../` parent ref all green.
Single shared encoder ⇒ absolute placeholder offsets ⇒ no rebasing.

**Phase 3e — DONE.** Selectors over homogeneous arrays, end-to-end in Zig.
`position_of first/last/corresponding<T>` over a plain `[]struct`
(`last_element_position`, `empty_array_correlation`) plus `length_of`/`crc32_of`
of a *selected element's sub-field* (`../chunks[first<DataChunk>].payload`),
covered by `cross-struct/homogeneous-selectors.test.ts` (2 suites). The runtime
extension that made the sub-field variants work: an append-only `all_frames`
history (`frameMark()`/`frameAt(mark)`) lets the array-encode loop capture each
element's top frame nesting-safely; `recordPosition` carries that frame, and
`selector_length`/`selector_crc32` deferred patches read the chosen element's
`subfield.length` / `subfield.range` from it. DU/choice selectors + element-size
selectors (no sub-field, `sum_of_type_sizes`) remain Phase 4 (#24).

> **Cross-language finding from the new homogeneous suites — now fixed** (a
> textbook payoff of the tests-first mandate): `homogeneous-selectors.test.ts`
> initially passed on TS/Python/Zig but **failed on Go and Rust**, exposing a
> latent bug that had hidden for months because every prior selector suite was
> DU-shaped. Two distinct root causes, both in the encode path:
> - **Go**: the sub-field walk asserted each element was `*T` (a pointer), which
>   only holds for `choice`/DU variants stored as `interface{}` pointers. A
>   homogeneous `[]T` holds values, so the assertion never matched and the
>   selector errored. Fixed by matching both `*T` and `T` (normalizing to a
>   pointer) in the reflect loop — `go.ts`.
> - **Rust**: the homogeneous-array context collector stored only each element's
>   `_encoded_size`, never its sub-fields, so `item_fields.get("payload")`
>   resolved to 0. The `choice` path populated full sub-fields and worked. Fixed
>   by snapshotting each element's sub-fields (shared `emitItemFieldInserts`
>   helper, now used by both the choice and homogeneous paths) — `rust.ts`.
> Both languages now pass the two homogeneous suites with no regression to the
> DU-flavored peers.

**Phase 4 — DONE** (commits `a37640a` enum, `be0b893` bitfield, `ede6faf`
optional, `c3d4614` DU+choice+byte_budget+measured length_of). enum aliases
(repr integer at the API; decode validates the variant set), bitfields
(anonymous `struct { sub: uN }`, ordered `writeBits`), optionals (`?T` + uint8
presence byte; bit-presence is a clean skip matching a known Rust gap), choice
(peek each variant's first const field) / discriminated_union (`union(enum)` with
explicit `{field}`/`{peek}` discriminator, `when`-less arm as `else`),
`byte_budget` (decode active variant from a bounded sub-slice, advance parent by
the full budget — RIFF), and **measured `length_of`** of a struct/union target
(reserve u32, back-patch with the encoded byte span since unions have no `.len`).

**Phase 4 follow-on (#24) — DONE** (commits `67e6a79` named unions + first/last,
`44a7aa1` sum_of_type_sizes + sum_of_sizes, `381f7b3` corresponding<T>). See the
new pitfalls below for the three traps this phase surfaced (distinct anonymous
unions, occurrence-at-encode-time, occurrence-in-own-array).

**Phase 5 — IN PROGRESS.** Landed so far: **length_prefixed_items** (`a614b18`,
outer count + per-item byte-length framing via placeholder/patch),
**conditional fields** (`3a82850`, `?T` + `if`-guarded encode/decode, schema-aware
condition translator that unwraps optional intermediates), **signed varlength**
zigzag/SLEB128 (`deaed0c`, stored i64), **array transform `delta`** (`e07f023`,
loop-local accumulator; orthogonal to the item's wire encoding), **terminated &
framed array kinds** (`6271e45`: null_terminated, signature_terminated,
byte_length_prefixed via placeholder/patch, packed_count Thrift header),
**latin1 & utf16 string encodings** (`9532624`, new `zig/runtime/strenc.zig`
transcoding module: latin1 1:1 byte mapping, utf16 code units + endianness +
surrogate pairs), **alignment padding** (`b95fa83`, `type: "padding"` +
`align_to`: a memberless wire spacer that writes/consumes zeros to align the
byte offset; count computed from the live offset so it composes with
variable-length predecessors), **const on fixed-length strings** (`3c1cb4e`,
tag/magic shapes routed through the normal string-encode path so framing +
transcoding apply; const/computed `[]const u8` members default to `""`),
**varlength computed length_of/count_of** (`8210ec2`, the synchronous DER/LEB128
length-prefix path — value from `self.<target>.len`, written with the varlength
method; covered by a new standalone `computed/varlength-length-of` suite verified
across all five languages), **compressed wire-transform regions** (`73183ec`,
store/deflate/gzip codecs in `zig/runtime/codecs.zig` wired to
`std.compress.flate`; inner value encoded to a self-contained buffer, framed as
`[uncompressed_size][compressed_length][bytes]` — a fresh top-level pass that
composes with the outer two-pass without sharing context),
**validation-suite accounting** (`b7fd8c6`, the 12 `schema_validation_error`
suites are TS-validator negative tests the Zig generator correctly refuses; they
are now classified out of the codegen denominator rather than counted as
phantom skips), **`variant_terminated` arrays** (`92c6fa6`, read union items
until a decoded item's active variant is in `terminal_variants`; the marker is
the array's last element so encode just writes every item, decode
appends-then-breaks via a switch over the active tag), **`field_id_delta`
computed+conditional** (`204e8f6`, Thrift-style stateful field-id deltas: a
struct-scoped `u64` accumulator holds the last emitted absolute id, advanced
only inside the field's conditional guard so a dropped optional makes the next
delta jump across it), **`instances` (random access)** (`instances.ts`: after
the sequence decodes, save the cursor, seek to each instance's resolved absolute
offset, decode the typed payload, restore the cursor — eager like Go/Python, not
TS's lazy getters; the encoder never writes instance bytes so the harness
verifies these suites decode-only via `expectEqualDeep`. Positions resolve from a
literal `>=0` (absolute), literal `<0` (from EOF), a sibling field, or a dotted
path into an earlier-decoded instance; `alignment` is validated. 18/21 instance
suites land here — the other 3 are unblocked by the `_root.` work below), then
**`_root.` cross-struct decode references** (`computed.ts` `schemaUsesRootDecode`
+ `index.ts`: when any `length_field`/`count_field` reads `_root.a.b`, every
struct's `decodeWith` seeds a `root: ?*const anyopaque` — `root_in orelse
@ptrCast(&result)`, i.e. self at the entry, inherited otherwise — and forwards it
to nested decoders; a descendant resolves `_root.a.b` by casting the pointer back
to the entry type `@as(*const Root, @ptrCast(@alignCast(root.?))).a.b`. Schemas
without any `_root` ref keep the lean param-named-`root` path untouched. This
unblocked the 3 elf/zip instance suites). DNS label compression now lands too:
`back_reference` pointers (encode emits a pointer to a label's recorded offset
via the runtime `compression_dict`, or registers + writes a literal on first
sight; decode masks the offset, `seek`s, decodes the target, restores position),
non-struct DU variants (a union arm may be a `string`/`bytes` or a
`back_reference`, carried as `[]const u8`, not just a struct), and the
`null_terminated` + `terminal_variants` array framing (a terminal arm ends the
chain with no trailing 0 byte). All 13 DNS-compression suites generate. The
Kerberos ASN.1/DER bucket now lands too (all 7 suites): a single recursive
**content-first** encoder handles every varlength length prefix whose value is
the byte size of a region not yet encoded — a `from_after_field` suffix or a
`length_of` over a struct/union target — by encoding the region into a temp
encoder, measuring it, writing the varlength prefix, then splicing the bytes
(nested TLVs compose by recursion; struct fields self-measure via their own
`encodeInto`). Supporting pieces: varlength (DER) `byte_length_prefixed` arrays
(same measure-then-splice on both encode and decode), nominal Zig aliases for
bare type-reference aliases (`pub const Realm = KerberosString;` so a struct
alias resolves as a type and a method receiver), and the `offset` modifier on
`length_of`/`count_of` (e.g. an ASN.1 BIT STRING whose DER length covers a
leading unused-bits byte). Still pending: `../` parent-stack decode references
and bare ancestor-scope field refs (a different mechanism from `_root.` — walks
up N parent scopes; surfaces in `dns_protocol_query`/`_response`, where a payload
struct's array length references the outer header's `qdcount`), `pcf_full` (an
unresolved field type), and `optional_builtin_bit` (1 suite, a documented
bit/byte-overlap runtime quirk the byte-oriented Zig runtime does not replicate).

**Latest harness numbers:** 350/354 codegen suites generate (+12 validation-only,
not codegen targets), 820/820 cases pass, 0 errored, 0 failed; runtime unit tests
28/28; TS reference 1192/1192 (no existing bytes edited). Update on each landing.

---

## Appendix: Pitfalls & lessons learned

> A running log of traps that cost real debugging time, so the next generator
> author (or a future revisit of this one) pays for each once. Split into
> **generator-general** (will bite any new target) and **language-specific**.
> Add to this as you hit new ones — terse, example-anchored, root-cause first.

### Generator-general (applies to the *next* language too)

1. **`corresponding<T>` occurrence must be captured at ENCODE time, not read
   back from final aggregate state.** The intuitive implementation — at patch
   resolution, ask the context "how many `T` are there" — collapses *every*
   referencer onto the same target (the last/total count), so all of them point
   at `target[0]` or `target[N]`. The Nth referencing element must correlate to
   the Nth matching target, and "which N am I" is only knowable *while encoding
   that element*. Fix: stamp the 1-based occurrence index onto the deferred patch
   at encode time (Zig: `occurrence: ?usize` on `selector_position`/`_length`/
   `_crc32`); the resolver consumes it instead of recomputing. (Python solves the
   same problem differently — it inlines the correlation at the call site rather
   than deferring; either is fine, but *something* must capture occurrence early.)

2. **Occurrence is counted in the referencer's OWN (innermost) array, not the
   target array.** This unifies same-array correlation (ZIP: local file headers
   ↔ central-directory entries live in the *same* element stream) with
   cross-array correlation (sibling arrays via `../../`). If you count in the
   target array you get ZIP right and every sibling-array schema wrong (the three
   `sibling_array_cross_reference` / `inner_references_outer_array` /
   `deep_nesting_cross_reference` suites). Fix: a `current_arrays` stack the array
   loop push/pops; `selfOccurrence(self_type, fallback)` reads the top of stack.
   Plain (non-selector-tracked) sibling arrays still need to push their name and
   bump a per-element type index, hence a correlation-only loop wrapper.

3. **Deferred patches must capture a frame *pointer/handle*, not a relative
   level index.** Relative indices (`../`, `../../`) are only valid *before* the
   ancestor frame is popped; by resolution time the stack has unwound. Capture the
   pointer to a pointer-stable, arena-allocated frame at emit time so it survives
   the pop. (Already in the Phase-3b notes and `POSITION_TRACKING_ARCHITECTURE.md`
   — repeated here because it's the single highest-value correctness insight and
   the next author will be tempted to store an index.)

4. **A homogeneous `[]T` is NOT a degenerate `choice` — the encode-path value
   shape differs.** Selectors and sub-field walks that were only ever tested on
   DU/choice arrays assume the element is a tagged/boxed value (Go: `*T`
   interface pointer; Rust: a context entry carrying full sub-fields). A plain
   `[]T` holds bare values, so those assumptions silently resolve to "no match" /
   size `0`. This stayed latent for *months* because every selector suite was
   DU-shaped (see the Phase-3e cross-language finding above). Lesson: add the
   *homogeneous* variant of every polymorphic-array feature to the corpus — the
   shapes diverge in the encoder even when they look identical in the schema.

5. **`from_after_field` only exists on `varlength` in the reference.** Don't
   invent a fixed-width `from_after_field` suite to "round out coverage" — TS
   (the spec) rejects it, so you'd be cementing a non-spec shape. Fixed-width is a
   legitimate clean skip.

6. **Defer with a typed `NotImplemented` throw, never a silent miscompute.** The
   expensive bug class is a feature that emits `0`/`null` instead of throwing —
   the harness counts the suite as passing-ish and the gap hides. A throw makes
   the per-suite skip honest and greppable (`<LANG>_TEST_REPORT=skips`).

### Zig-specific

7. **Anonymous `union(enum){ … }` literals at two different source sites are
   DISTINCT types** — even when structurally identical. Assigning one where the
   other is expected fails to compile. Any feature that materializes a union in
   more than one place (a DU field *and* the array-element recording that filters
   it by variant, e.g. `first<T>` over a choice array) must emit ONE shared
   **named** union type and refer to it everywhere. Fix: `collectUnionTypes` +
   `unionTypeName`; the array recorder reads each element's actual variant via a
   runtime tag switch (`unionTypeSwitchExpr`). This was the whole reason
   `67e6a79` (named unions) had to precede `first/last` over choice arrays.

8. **`BitStreamEncoder.init(allocator, bitOrder)` takes a `BitOrder`
   (`.msb_first`/`.lsb_first`), NOT an `Endianness` (`.little_endian`/
   `.big_endian`).** They're both two-valued enums describing "byte/bit order"
   and are trivially swappable by autocomplete; passing `.little_endian` is a
   compile error pointing at the *enum definition*, not the call site, which makes
   it read like a deeper problem than a one-token typo. Endianness is a *separate*
   concept threaded to `patchUintN`/`writeUintN`. Cost a confusing runtime-test
   compile error during the `sum_of_type_sizes` work.

9. **Toolchain is a dev build (`zig 0.17.0-dev`) — std APIs drift.** Pin the
   version in `build.zig.zon`/docs; treat "this std signature changed" as expected
   when revisiting after an upgrade, not a code bug.

### Operational

10. **Run the harness from the project root** (`/home/bart/Projects/binschema`),
    not from `packages/binschema`. The file-import-based harness resolves the root
    module's `binschema` dependency relative to cwd; from the wrong directory you
    get a misleading `Module not found 'zig/test/run_tests.ts'` that looks like a
    missing file rather than a cwd problem.

11. **The test-export step writes JSON but does not prune orphans.** Delete a
    suite and its stale `.generated/tests-json/**/<name>.json` lingers and keeps
    "failing" as a ghost — remove it by hand. (Also noted in the harness section.)

12. **"Generated" is not "tested" — watch `constructSkips`.** A suite can
    generate code cleanly *and* contribute zero executed cases if the harness
    can't build the test *value* for the field shape. The batched harness counts
    these as `constructSkips` (visible under `<LANG>_TEST_REPORT=coverage` as
    "N case(s) not constructible"), and the suite still shows up green-ish in the
    suite count. Concrete bite: Zig varlength fields generated encode/decode from
    Phase 3c but the harness had no varlength *value* constructor, so every
    varlength suite emitted 0 cases — the codepath compiled (Zig only
    instantiates referenced functions, so even a latent `@intCast` bug stayed
    hidden) but was never actually exercised until `deaed0c` added value
    construction. Lesson: when you add a field *type* to the generator, add its
    *value constructor* to the harness in the same change, and check the coverage
    report shows the cases emitting — a rising suite count with a flat case count
    is the tell.
