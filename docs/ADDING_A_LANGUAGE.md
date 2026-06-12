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

> **Cross-language finding from the new homogeneous suites** (a textbook payoff
> of the tests-first mandate): `homogeneous-selectors.test.ts` passes on TS and
> Python but **fails on Go** (and, by inspection, likely Rust). Root cause: for a
> homogeneous array the Go/Rust encode context retains only the element's
> `_encoded_size`, not its sub-fields, so `[first/last<T>].payload` (selecting a
> *sub-field* of the chosen element) can't resolve — it computes the wrong value.
> The DU-flavored peers pass because `choice` items carry full sub-fields. This
> latent bug had hidden for months precisely because every selector suite was
> DU-shaped. Tracked as a follow-up; not yet fixed (surfaced while answering a
> "should we test selectors without a DU?" question).

**Phase 4 — PENDING.** discriminated_union (`union(enum)`), choice, optionals
(`?T`), bitfields, enum aliases. Unlocks DU-flavored selectors +
`sum_of_type_sizes`.

**Phase 5 — PENDING.** Remaining varlength, compression/back-reference,
utf16/latin1, array transforms, `instances`, parity sweep.

**Latest harness numbers:** 178/365 suites generate, 407/407 cases pass, 0
errored; runtime unit tests 17/17; TS reference 1189/1189 unchanged. Update on
each landing.
