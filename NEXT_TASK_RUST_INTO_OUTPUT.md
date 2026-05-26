# Next task: encode-fills-Output refactor (Option B)

## Goal

Make `From<XInput> for XOutput` in the Rust generator produce an Output
whose **computed fields hold their real computed values**, not zero
placeholders. Performance-sensitive, so no encode→decode round-trip
(Option A) and no leaving placeholders for the caller to discover
(Option C). The fix must be the single-pass approach.

## Why this matters

Right now the just-shipped `From<XInput> for XOutput` impl fills const
fields from the schema but leaves computed fields (`length_of`,
`count_of`, `position_of`, `crc32_of`) as zero / `Vec::new()` / etc.

That's fine for `MyEnum::Variant(input.into())` flows where the Output
gets re-encoded almost immediately (encode regenerates computed fields
correctly), but it's wrong for:
- Inspecting Output post-conversion
- Equality / round-trip tests against decoded Outputs
- Any path that reads computed fields off an Output built via `.into()`

Bart wants this correct without an extra parse-back pass.

## The approach

The encode pipeline **already computes every computed field at the
exact site where the bytes get emitted**. We need to make that
computation visible to a caller who wants the Output back. Two
implementation shapes are viable; the second is preferred.

### Shape 1: thread `Option<&mut OutputBuilder>` through encode

- Each computed-field emitter in `rust.ts` learns to also write the
  computed value into the builder when present.
- `From<Input> for Output` allocates an `OutputBuilder`, runs encode
  into a `/dev/null` byte sink + the builder, finalizes the builder
  into an Output.
- Pros: zero parse-back. Cons: every emitter has to know about the
  builder, lots of small touches in `rust.ts`.

### Shape 2 (preferred): refactor encode to "compute, then write"

- Restructure the encode body so for each computed field we **compute
  the value into a local binding first**, then write that binding's
  bytes.
- The local bindings ARE the computed fields. `Input::into_output()`
  shares the same compute-locals logic and assembles them (plus the
  input fields and const fields) into the Output struct, never
  touching an encoder.
- The current `encode_into()` body becomes "compute locals; write
  locals + input fields + const literals to the encoder."
- Pros: one place for compute logic (extracted helper per computed
  field); `encode` and `into_output` both call into it; no encoder
  required for `into_output`. Cons: bigger codegen restructure.

Pick Shape 2 unless something blocks it.

## What to read first

1. `bugs/2026-05-26-rust-codegen-three-bugs.md` — context on what was
   broken before this work (already fixed in the commit that includes
   this file).
2. `packages/binschema/src/generators/rust.ts`:
   - `generateEncodeMethod` (around line ~3325) — current encode body.
   - The computed-field emitters in the encode path (search for
     `computed` in that file).
   - `generateFromInputToOutput` and the helpers
     `generateConstFieldExpression` /
     `generateComputedFieldPlaceholder` (around line ~3290+) — the
     current placeholder-based impl that needs replacing.
3. `packages/binschema/src/generators/typescript.ts` — the reference
   implementation per the project's "TypeScript first" convention.
   Check whether TS already does anything analogous; if so, mirror
   its shape.
4. The two new optional<bytes> regression tests added in the same
   commit (`optional_builtin_fixed_bytes`,
   `optional_builtin_length_prefixed_bytes`) — they don't exercise
   computed fields directly, but pattern-match: any new feature gets
   a TestSuite first.

## Concrete plan

1. **Test first.** Write a TestSuite that exercises a type with
   computed fields and assert `Output::from(input)` produces an
   Output whose computed fields equal what decode would produce for
   the same bytes. Put it under
   `packages/binschema/src/tests/composite/` or
   `packages/binschema/src/tests/computed/`. Verify it currently
   fails before refactoring encode.
2. **Refactor the encode body** to compute each computed field into a
   named local first, then emit writes that reference those locals.
   Make sure existing encode tests still pass — should be a no-op
   functionally.
3. **Replace `generateComputedFieldPlaceholder` usage** in
   `generateFromInputToOutput` with the actual compute expressions
   (the same ones the refactored encode uses). Factor the
   compute-expression generator into a shared helper so encode and
   into_output stay in sync.
4. **Run all three test corpora** (`cd packages/binschema && bun run
   src/run-tests.ts`, `just test-go`, `just test-rust`) — must remain
   100%.
5. **Verify against scry schema**
   (`/home/bart/Projects/scry/proto/ingest.schema.json`) — generate
   to a tmp dir + `cargo build`.

## Watch out for

- **Borrow checker.** Computed fields can reference earlier fields
  (`length_of` measures another field's encoded size). If the encode
  refactor moves field encoding into helpers, make sure borrows
  don't fight you when helpers need both `&self` for input fields
  and `&mut encoder` for writes.
- **`length_of with from_after_field`.** This is the case where you
  encode the body first, measure, then back-patch the length prefix.
  The current Rust runtime uses placeholders + patch (see the TS
  generator's two-pass machinery in
  `packages/binschema/src/generators/typescript.ts` — search for
  `placeholder`). For `into_output`, the value the user gets is just
  `body.encoded_byte_length()`, which can be computed without
  back-patching. But the compute logic for length_of from_after_field
  is non-trivial; make sure the extracted helper is correct.
- **Aggregate computed (`sum_of_type_sizes`).** Similar story —
  computable from input field sizes; just needs an explicit summer.
- **`crc32_of`.** The CRC has to run over the actual encoded bytes
  for a field range. For `into_output`, you can either re-encode that
  range to a small temp buffer to compute the CRC, OR share the
  encoded bytes between encode and into_output. The cheap approach
  is the temp buffer per crc32 field — usually small. Per the perf
  rules in `~/.claude/CLAUDE.md` ("recurring allocation failure
  mode"), if multiple crc32 fields per call, lift the temp buffer
  to a reusable scratch field on the encoder rather than allocating
  per crc32.
- **Nested computed fields inside nested structs.** Each nested
  struct's `into_output` needs to recursively populate its computed
  fields too. Don't paper over this with `Default::default()` on
  nested structs.
- **TS generator parity.** Project convention is "TypeScript first"
  — if the TS generator doesn't have an equivalent, decide whether
  to add it there too (probably yes — TS callers will hit the same
  inspection problem). Discuss with Bart before forking the design.

## Out of scope

- Go and Python generators. The bug report and this work are
  Rust-only. Once Rust is solid, mirror to other languages in
  separate commits.
- Changing the `Output` struct shape. Just populate it correctly.

## Don't touch

- Anything in `rust/src/`, `go/runtime/`, `python/runtime/` unless
  the encode refactor genuinely needs new runtime hooks (it probably
  doesn't — computed-field math is all in generated code).
- The optional<bytes> path that just got fixed. If a test there
  starts failing, that's a regression in your refactor.

## When done

Update or delete this file and update TODO.md with the conclusion.
