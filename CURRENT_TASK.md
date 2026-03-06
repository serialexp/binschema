# Current Task: Python Code Generator

## Status: IN PROGRESS — v1 foundation complete (514/746 tests passing, 69%)

## Goal

Add Python as the fourth target language for BinSchema code generation (after TypeScript, Go, and Rust).

## Approach

**The TypeScript generator (`src/generators/typescript.ts`) is the reference implementation for everything.** Python's dynamic typing and object model are very similar to TypeScript/JavaScript, so the Python generator should map almost 1:1 from the TypeScript generator. When in doubt about how to handle any feature, edge case, or encoding pattern — look at the TypeScript generator first.

### Design Decisions Made

- **Plain dicts** for generated types (not dataclasses) — matches JS object literal style
- **Python 3.12+** — uses `uv` for dependency management
- **`json5` package** for parsing test JSON5 files

## What's Done

### Files Created

- `python/pyproject.toml` — uv project config, depends on `json5`
- `python/runtime/__init__.py` — re-exports BitStreamEncoder/Decoder
- `python/runtime/bitstream.py` — full port of `src/runtime/bit-stream.ts` (encoder, decoder, seekable decoder)
- `python/test/__init__.py`
- `python/test/run_tests.py` — test harness: loads JSON5 test suites, generates Python code via CLI, runs encode/decode tests
- `packages/binschema/src/generators/python.ts` — Python code generator

### Files Modified

- `packages/binschema/src/cli/command-parser.ts` — added `"python"` to `SupportedLanguage`
- `packages/binschema/src/cli/index.ts` — added `case "python"` handler with `runPythonGenerator()`
- `justfile` — added `test-python` and `test-python-debug` recipes (use `uv run`)

### What Works (514 tests passing)

- All primitive types: uint8/16/32/64, int8/16/32/64, float32/64, bool
- Both endiannesses (big/little) and bit orderings (msb/lsb)
- Simple and nested structs
- Length-prefixed arrays (uint8/16/32/64 length types)
- Length-prefixed strings and bytes
- Fixed-length arrays, strings, bytes
- Field-referenced arrays (count from another field)
- Null-terminated arrays and strings
- EOF-terminated arrays
- Variable-length integers (DER, LEB128, EBML, VLQ)
- Enum types
- Bitfield types
- Basic discriminated unions
- Basic choice types
- Optional fields (presence-based)
- Const fields
- Computed count_of fields (basic)

### What's Failing (232 tests)

Key failure categories:

1. **`length_prefixed_items` arrays** — items need per-item byte-length prefix (different from array-level length prefix). The `item_length_type` field is not yet handled.

2. **Computed fields (complex)** — `length_of` with `from_after_field`, `position_of`, `crc32_of`, back-patching. The generator writes placeholders but doesn't back-patch.

3. **Optional field decode** — decoded `None` values stay in the result dict but expected output omits them. Need to strip `None` values from decoded dicts.

4. **Conditional fields** — conditional expression conversion to Python is incomplete. BigInt bitmask conditionals and nested parent conditionals fail.

5. **Parent references (`../`)** — computed fields referencing parent struct fields aren't supported yet.

6. **Back references / pointers** — `back_reference` type not implemented.

7. **Variant-terminated arrays** — `variant_terminated` kind not implemented.

8. **String type references** — standalone string types used as struct field types.

9. **DNS compression pointers** — generates invalid Python (empty for loop body).

## Next Steps

Priority order for getting more tests to pass:

1. Fix optional field decode — strip `None` from result dicts (easy win, ~10 tests)
2. Fix conditional expression conversion (medium, ~15 tests)
3. Implement `length_prefixed_items` with `item_length_type` (medium, ~10 tests)
4. Implement computed field back-patching for `length_of`/`from_after_field` (hard, ~30 tests)
5. Implement parent reference (`../`) support (hard, ~15 tests)
6. Implement remaining array kinds: variant_terminated, signature_terminated

## Commands

```bash
just test-python                    # Run all Python tests
just test-python primitives         # Filter by name
just test-python-debug              # Debug mode
```

## Previous Task (Complete)

Inline Choice Field Support for Go Generator — completed 2026-03-05. See git log for details.
