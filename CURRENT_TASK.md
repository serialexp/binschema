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
