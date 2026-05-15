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

### Phase 2: error codes for cross-language parity (~1 day)

- `BitStreamDecoder.lastErrorCode: string | null`.
- Set `INCOMPLETE_DATA` on EOF in every read method; clear on success.
- Define constants: `INCOMPLETE_DATA`, `INVALID_VALUE`, `SCHEMA_MISMATCH`,
  `CIRCULAR_REFERENCE`.
- Tests for set-on-EOF and clear-on-success.

### Phase 3: streaming layer (~2–3 days)

- `src/runtime/stream-decoder.ts`: `readExactly(reader, n)`,
  `decodeArrayStream()` (length-prefixed), `decodeArrayGreedy()`
  (standard).
- Re-enable `tests/streaming/chunked-network.test.ts.disabled` and
  flesh out: items split across chunks, one-byte chunks, large chunks,
  partial item at boundary, variable-length items, empty arrays, network
  errors mid-stream, decode errors mid-stream, slow-consumer backpressure,
  `length_prefixed_items` + chunked.

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
