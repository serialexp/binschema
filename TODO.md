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

### Phase 2: error codes for cross-language parity — DONE (TS side)

- `BinSchemaError` class with `.code`, `.position`, `.context` lives in
  `src/runtime/errors.ts` and is re-exported from the package root.
- TS `BitStreamEncoder` / `BitStreamDecoder` / `SeekableBitStreamDecoder`
  throw `BinSchemaError` at every former `throw new Error` site (28 sites).
- Code set: `INCOMPLETE_DATA`, `INVALID_VALUE`, `INVALID_ENCODING`,
  `INVALID_UTF8`, `INVALID_VARIANT`, `ALIGNMENT_REQUIRED`, `OUT_OF_BOUNDS`,
  `STACK_OVERFLOW`, `SCHEMA_MISMATCH`, `CIRCULAR_REFERENCE`. Last four are
  reserved for codegen / streaming use, not yet thrown by the runtime.
- Coverage in `src/tests/runtime/error-codes.test.ts` (31 assertions
  across all currently-thrown codes + happy-path sanity).
- Remaining work to close the cross-language loop:
  - Align Go `LastErrorCode` values with this exact code set (Go currently
    only sets `INCOMPLETE_DATA`; add the others where Go throws).
  - Add a `code: ErrorCodeValue` mapping on Rust `BinSchemaError` variants
    so the wire-level contract is symmetric.
  - Mirror the constants in Python runtime.
  - Generated codegen should raise `BinSchemaError(INVALID_VARIANT, ...)`
    on unknown discriminators and `BinSchemaError(INVALID_UTF8, ...)` on
    string decode failures (currently throws plain `Error`).

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

### Phase 4: streaming codegen (~1–2 days)

- `generate_streaming: true` option on the code generator.
- Detect root-level arrays; for `length_prefixed_items` emit
  `decode{TypeName}Stream()` async generator, for standard kinds emit
  `decode{TypeName}StreamGreedy()`. Generate both sync and streaming
  decoders side-by-side.
- TypeDoc on the generated streaming functions; document when to pick
  streaming over batch.

### Phase 5: docs & examples (~1 day)

- Streaming section in `CLAUDE.md` and main README.
- `examples/`: simple streaming (fetch → incremental decode), web client
  (WebSocket/fetch), greedy buffering against an existing protocol, error
  handling (network failure, invalid data).
- Document error codes and their meanings; troubleshooting guide.

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
