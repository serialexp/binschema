# TODO

Active notes — known bugs we haven't fixed, roadmap items we still want to do.
Completed historical work lives in `docs/finished/COMPLETED_TODO_ITEMS.md`.

## Known bugs / paper cuts

- **TypeScript test runner `.generated/` path mismatch.** `setupRuntimeLibrary`
  in `packages/binschema/src/run-tests.ts` copies runtime files into
  `<package>/.generated/`, but `runTestSuite` in
  `packages/binschema/src/test-runner/runner.ts:128` writes generated test
  code into `process.cwd()/.generated/`. When the runner is launched from the
  repo root (the normal `npm test` / `bun run` invocation) the two
  `.generated/` directories are different and the generated test code ends up
  next to a stale copy of `bit-stream.ts` that lacks methods like
  `readBytesSlice`. Workaround: `cp packages/binschema/src/runtime/bit-stream.ts .generated/bit-stream.ts`.
  Proper fix: align both code paths to use `__dirname/../.generated` (or
  otherwise resolve from the package directory), not `process.cwd()`.

- **Go test harness can't drive bare string-type-alias roots.** `dns_label_*`
  tests fail because `Label` is `type X = string` and has no Encode/Decode
  methods. Either generate wrapper structs for string types used as
  `test_type`, or special-case string aliases in the harness.

- **Go: standalone `discriminated_union` with field-based discriminator.**
  The parent's decoder calls the DU's plain `Decode...` directly, but the
  generated DU is an interface and the caller writes `*p` which fails
  (`cannot indirect p (variable of interface type)`). Rust inlines the
  dispatch at the parent's call site (see `generateDecodeField` default
  branch in `packages/binschema/src/generators/rust.ts`); Go should do the
  same. Repro: `packages/binschema/src/tests/composite/standalone-du-field-discriminator.test.ts`.

- **TypeScript generator stack-overflows on self-recursive types.** AST
  `Expr` with a discriminated_union variant containing `lhs: Expr, rhs:
  Expr`, or a linked-list `Node` with conditional `next: Node`, both blow
  the stack during code generation. Root cause:
  `generateDecodeTypeReference` (typescript.ts:2537) inlines the
  referenced type's decoder body instead of calling its standalone
  `*Decoder` class, so the inliner re-enters the same type forever. Fix:
  when a type reference would produce a cycle (or unconditionally, for any
  non-trivial named composite reference), emit a call to the standalone
  `${typeRef}Decoder.decode*` method instead of inlining. Until this is
  fixed there's no cross-language `TestSuite` covering recursive types —
  the Rust Box-insertion fix from `BINSCHEMA_RUST_GEN_ISSUES_2.md` Issue 1
  is validated only against the rustyql wire schema (`~/Projects/db`). The
  schema validator already permits these cycles (`findCircularDependency`
  skips weak edges through DU/choice/optional/array/conditional).

## Rust generator: `From<Input> for Output` Shape 2 refactor

**Status: complete for the cases the test corpus currently exercises.**
Rust suite: 320/320 passing, 756/756 tests. The `via_into == decoded`
assertion in `rust/tests/compile_batch.rs` runs unconditionally for
every Input/Output-split type.

What `generateComputeComputedValue` (in
`packages/binschema/src/generators/rust.ts`) now populates from Input
data when constructing Output via `.into()`:

- `length_of` with simple `target` — primitive `.len()` for strings,
  array `.len()`, composite `encode().map(|b| b.len()).unwrap_or(0)`.
- `length_of` with `from_after_field` — delegates to a generated
  `_post_<fieldName>_bytes(&self)` helper on the Input impl. The
  helper reuses the full encode pipeline (const/computed/conditional
  field encoders, arrays of every kind, recursive `from_after_field`),
  so the From path stays a one-line read.
- `count_of` — `target.len()`.
- `crc32_of` — `binschema_runtime::crc32(&path)` (uint8 array) or
  composite via `encode().map(...).unwrap_or(0)`.
- `position_of` — sum of byte sizes of preceding fields. Static for
  primitives/const/computed/fixed-array-of-primitives; dynamic for
  strings (`.len()` / `.chars().count()`) and composites
  (`.encode().map(|b| b.len()).unwrap_or(0)`).

Array-of-choice / array-of-discriminated_union fields whose variant
payloads have an Input/Output split now emit a per-variant refresh in
`generateArrayVariantRefresh` — each `Variant(p)` is replaced with
`Variant(<Payload>Output::from(<Payload>Input::from(p)))` so the
payload's computed fields are recomputed instead of inheriting the
test constructor's placeholder zeros.

Cases the helper still returns null for (will surface as failures
when a test schema uses them):

- `sum_of_type_sizes`, `sum_of_sizes` — require parent context.
- Parent refs (`../foo`), selectors (`first<T>`, `last<T>`,
  `corresponding<T>`) — require runtime context.
- `optional<choice>` and direct (non-array) choice/DU fields with
  split variants — same refresh story as the array case above; the
  refresher only handles arrays today.
- `varlength` field sizes inside `position_of` sums — value-dependent.
- Array kinds beyond fixed-with-primitive-items inside `position_of`
  sums — would need to encode the field to measure.

The encode pipeline is unchanged; encode still does the compute work
inline. Pure cleanup follow-up: refactor encode to call the shared
compute helper / `_post_<field>_bytes` helper where applicable, so
the compute logic has one source of truth.

## Codegen quality-of-life (TypeScript generator)

- Extract inline anonymous types to named interfaces.
- Add input validation for bitfields.
- Add `const` enums for well-known discriminator values.
- Generate helper type guards.
- Add encode/decode convenience wrappers.
- Add `toJSON()` methods for pretty printing.
- Add test that validates generated TypeScript compiles without errors.
- Add test that validates no `any` types in public API (except stream).
- Add test that validates all public interfaces have JSDoc.
- Add snapshot test for generated code structure.

## Schema migration

- Merge IoT protocol schema files into a single unified schema (follow
  `dns.schema.json` pattern).
- Audit remaining protocol schemas for the same split-file pattern and
  consolidate where it applies.

## Schema documentation system

- Phase 1 (metadata): add `.meta()` to bit-level (bit, bitfield),
  composite (array, string, optional, discriminated_union, pointer), and
  special (conditional, type-reference) types.
- Phase 2 (extractor): handle arrays, optional/nullable, recursive
  schemas.
- Phase 3 (HTML): search/filter (optional, future).
- Phase 5 (docs/examples): document metadata format and conventions,
  document the generic extractor, provide an example schema documentation
  pass, link the type reference from the main README.

## Streaming support (analysis: `docs/STREAMING_ANALYSIS.md`)

Phase 1 (`length_prefixed_items` array kind) is shipped — the wire-format
tests live in `tests/streaming/greedy-buffering.test.ts` and the kind is
exercised across the corpus. Remaining phases:

### Phase 2: error codes for cross-language parity — DONE (all languages)

- `BinSchemaError` class with `.code`, `.position`, `.context` lives in
  `src/runtime/errors.ts` and is re-exported from the package root.
- TS `BitStreamEncoder` / `BitStreamDecoder` / `SeekableBitStreamDecoder`
  throw `BinSchemaError` at every former `throw new Error` site (28 sites).
- Code set: `INCOMPLETE_DATA`, `INVALID_VALUE`, `INVALID_ENCODING`,
  `INVALID_UTF8`, `INVALID_VARIANT`, `ALIGNMENT_REQUIRED`, `OUT_OF_BOUNDS`,
  `STACK_OVERFLOW`, `SCHEMA_MISMATCH`, `CIRCULAR_REFERENCE`.
- Coverage in `src/tests/runtime/error-codes.test.ts` (31 assertions
  across all currently-thrown codes + happy-path sanity).
- Cross-language parity — DONE:
  - **Go**: `go/runtime/errors.go` defines all 10 `Error*` constants and a
    struct-based `BinSchemaError` with `Code`/`Message`/`Position`/`Context`.
    `bitstream.go` raises `NewError(...)` / `NewErrorAt(...)` /
    `NewErrorf(...)` with the appropriate code at every former
    `fmt.Errorf` / `errors.New` site (14 sites migrated). The legacy
    `LastErrorCode *string` sentinel is removed.
  - **Rust**: `rust/src/lib.rs` exposes the 10 codes via `error_code::*`
    constants and a `BinSchemaError::code()` accessor mapping each variant
    to its canonical string. New variants `InvalidEncoding`,
    `AlignmentRequired`, `OutOfBounds`, `StackOverflow`,
    `CircularReference` added; `InvalidVariant` widened from `u64` to
    `String` so codegen can format arbitrary discriminator debug values.
  - **Python**: `python/runtime/errors.py` defines `ErrorCode` constants
    and `BinSchemaError(Exception)` with `code`/`position`/`context` slots.
    `bitstream.py` raises `BinSchemaError(ErrorCode.X, ...)` at every
    former `raise ValueError/RuntimeError` site (28 sites migrated).
- Codegen-emitted errors — DONE:
  - **TS** (`src/generators/typescript.ts`, `string-support.ts`,
    `computed-fields.ts`, `size-calculation.ts`): unknown discriminator
    sites now throw `new BinSchemaError(ErrorCode.INVALID_VARIANT, ...)`;
    UTF-8 decode wraps `TextDecoder({fatal:true})` in a try/catch that
    re-throws as `BinSchemaError(ErrorCode.INVALID_UTF8, ...)`.
  - **Go** (`src/generators/go.ts`): all 7 `fmt.Errorf("unknown
    discriminator..." )` codegen sites now emit
    `runtime.NewErrorf(runtime.ErrorInvalidVariant, ...)`.
  - **Rust** (`src/generators/rust.ts`): unknown-discriminator sites that
    were emitting `BinSchemaError::NotImplemented(...)` or
    `InvalidVariant(u64)` now uniformly emit
    `BinSchemaError::InvalidVariant(format!(...))`.
  - **Python** (`src/generators/python.ts`): unknown-discriminator /
    unknown-variant sites raise `BinSchemaError(ErrorCode.INVALID_VARIANT,
    ...)`; a `_decode_text(...)` runtime helper wraps `bytes.decode(...)`
    and re-raises `UnicodeDecodeError` as
    `BinSchemaError(ErrorCode.INVALID_UTF8, ...)`. All 12 string-decode
    sites in codegen route through it.
- Validation: TS 1135/1135, Go 771/771, Python 794/794, Rust 756/756 all
  passing after the migration. New TS suite
  `src/tests/generators/codegen-error-codes.test.ts` confirms generated
  TS decoders throw `BinSchemaError` with `INVALID_VARIANT` /
  `INVALID_UTF8` codes end-to-end.

### Phase 3: streaming layer — DONE (TS runtime)

- `src/runtime/stream-decoder.ts` exports `readExactly`, `decodeArrayStream`
  (length_prefixed_items mode), `decodeArrayGreedy` (standard length_prefixed
  retry-on-INCOMPLETE_DATA mode), plus shared option types. Internal
  `StreamingBuffer` owns the accumulating byte buffer and exposes
  `pullChunk`/`consume`/`ensure`.
- Mechanism: greedy mode catches `BinSchemaError(INCOMPLETE_DATA)`, refills
  from the reader, and retries from a saved buffer position. Other
  BinSchemaError codes are fatal and propagate (with per-item context).
- 19 scenarios covered in `src/tests/streaming/stream-decoder.test.ts`:
  - Item split across two chunks
  - One-byte chunks (worst case)
  - Large chunks (whole array in one)
  - Partial item at chunk boundary
  - Variable-length items (strings inside structs)
  - Empty array
  - Literal arrayLength (no prefix consumed)
  - length_prefixed_items chunked + 1-byte chunks + empty
  - readExactly across chunks / EOF / n=0
  - Network error propagates with original message
  - Truncated stream throws INCOMPLETE_DATA with item context
  - Fatal decode error (INVALID_ENCODING) does NOT trigger retry
  - Slow-consumer backpressure (reader not over-pulled)
  - Options validation (rejects both/neither arrayLength source)
- `run-tests.ts` now awaits async function-test results.
- The original spec file `chunked-network.test.ts.disabled` was left in
  place as input for Phase 4 (schema-driven streaming codegen). It expects
  `chunkSizes` on TestCase and references symbols that the codegen will
  emit (`decodeArrayStream`/`decodeUint32ArrayStream`/etc.).

### Phase 4: streaming codegen — DONE (TS)

- `generate_streaming: true` option on `GenerateTypeScriptOptions`.
- Stream-eligible types are detected automatically: a top-level struct
  whose `sequence` is exactly one `length_prefixed` or `length_prefixed_items`
  array. For each, the generator emits `decode{TypeName}Stream(reader)`
  alongside the existing synchronous `{TypeName}Decoder` class. The same
  function name is used for both array kinds — the underlying primitive
  (`decodeArrayGreedy` vs `decodeArrayStream`) differs but the caller-facing
  async generator shape is identical.
- Detection + emission live in
  `packages/binschema/src/generators/typescript/streaming-codegen.ts`.
  Item decode strategies: primitives inline a `d.read*()` call; named
  user-defined structs slice the outer buffer at `d.bytes.subarray(d.position)`
  and instantiate the existing per-item Decoder class, then advance the
  outer decoder by `inner.position`.
- The test runner (`packages/binschema/src/test-runner/runner.ts`) now
  auto-enables `generate_streaming` for any suite whose test cases set
  `chunkSizes`, and extracts items from the single-array-field wrapper
  struct before comparing against the streaming yield. Coverage:
  `tests/streaming/streaming-codegen.test.ts` (3 suites, 18 assertions
  spanning primitive greedy, named-struct greedy, and per-item framing).
- Worked example: `packages/binschema/src/examples/streaming-decode.ts` —
  builds a schema in-memory, generates streaming code, exercises four
  patterns (single chunk, 1-byte chunks, length_prefixed_items, network and
  decode errors).

### Phase 5: docs & examples — DONE (TS)

- README streaming section: when-to-use, mechanism, error-code table,
  greedy vs per-item-frame trade-off.
- CLAUDE.md streaming section: codegen knob, runtime entry points, test
  runner integration via `chunkSizes`.
- `packages/binschema/src/examples/streaming-decode.ts` covers the four
  spec'd example shapes (chunked playback, greedy streaming, per-item
  framing, error handling).

### Phase 6 (future): cross-language streaming codegen

- Go: streaming codegen + runtime support for `io.Reader`-style inputs.
- Rust: streaming codegen + runtime support for `AsyncRead` / `Stream`.
- Python: streaming codegen + runtime support for async iterators.

### Streaming integration / cross-language

- Real `ReadableStream` from `fetch()`, WebSocket streams, Node file
  streams.
- Various chunk sizes (1 byte, 64KB, random).
- Edge cases: empty / single-item / very large (> 1MB) arrays,
  uint16/uint32 length limits, network errors at every boundary, decode
  errors at every position.
- Perf: batch vs streaming overhead (< 10% acceptable), memory usage on
  large arrays (no unbounded buffering), backpressure (slow consumer
  doesn't OOM).
- Cross-language: document error codes in a shared spec; TS encode → Go
  decode interop; Go-specific `io.Reader` optimization.

## Type system extensions

- First-class enum support.
- Tagged unions beyond the current discriminated_union shape.
- Alignment / padding.
- More computed field types beyond `length_of`, `crc32_of`, `position_of`,
  `count_of`, `sum_of_sizes`, `sum_of_type_sizes`.

## Performance

- Standing benchmark suite for encoder/decoder (we have ad-hoc numbers on
  the website; need something checked in that runs on demand).
- Pre-allocated buffer sizes where the shape is statically knowable.
- Profile bit operations on the hot paths.

## Documentation

- Visual schema documentation: byte/bit layouts, embedded examples and
  test cases.

## Milestones

- [x] Computed fields (length_of, crc32_of, position_of)
- [x] Array selectors (first, last, corresponding)
- [x] Context threading
- [x] Cross-struct references for ZIP support
- [x] TypeScript reference implementation (1060+ tests passing)
- [x] Go generator (762/762 passing, full feature parity)
- [x] Python generator (785/785 passing, full feature parity)
- [ ] Rust generator out of experimental
- [ ] Standing performance benchmarks
- [ ] Streaming support
- [ ] Complete documentation pass

## Pre-existing: calculateSize array-item encoder name bug (noticed during size-calc fold work)
For a `field_referenced` array of a primitive (`items: "uint8"`), the TS
calculateSize emits `new undefinedEncoder()` for the item — the item type isn't
resolved to a primitive size in the array branch of `generateFieldSizeCalculation`
(typescript/size-calculation.ts). Likely only latent because such schemas don't
hit a `from_after_field` calculateSize path in the test corpus. Unrelated to the
fold change; left as-is. Worth a real fix + a TestSuite that calls calculateSize
on a primitive-item array.
