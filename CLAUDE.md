# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BinSchema is a binary protocol schema definition and code generation tool. It allows you to define binary formats in JSON5 and generates TypeScript, Go, and Rust parsers/serializers.

**Core Features:**
- Bit-level precision (1-64 bit fields)
- Byte-aligned types (uint8, uint16, uint32, uint64, strings, arrays)
- Conditional fields and computed fields
- Random-access support (seekable streams, position/length fields)
- Cross-language test validation (JSON test format)

## Testing

```bash
# Run all tests (TypeScript and Go)
make test

# Run TypeScript/Bun tests only
npm test                                       # Run all BinSchema tests (~0.15s with bun!)
bun run src/run-tests.ts --filter=<pattern>   # Run specific tests
bun run src/run-tests.ts --filter=uint16      # Example: only uint16 tests
bun run src/run-tests.ts --filter=optional    # Example: only optional tests

# Go test suite
# Uses batched compilation for efficiency (single compilation, ~5-10s vs one-by-one, ~60s)
cd go
go test -v ./test                             # Run all tests with batched compilation

# Test filtering and reporting flags
TEST_FILTER=primitives go test -v ./test      # Run only tests matching 'primitives'
TEST_FILTER=bit go test -v ./test             # Run only bitfield tests (bit_order, bitfield, single_bit, etc.)
TEST_REPORT=summary go test -v ./test         # Print overall statistics
TEST_REPORT=failed-suites go test -v ./test   # List only test suites with failures
TEST_REPORT=passing-suites go test -v ./test  # List 100% passing test suites
TEST_REPORT=failing-tests go test -v ./test   # Show individual failing test cases
TEST_REPORT=json go test -v ./test            # JSON output for scripting
```

**⚠️ Important**: Please use the environment variable flags above for analyzing test results and filtering tests. Custom shell commands are fragile and hard to maintain. If you need a report format that doesn't exist, add it to `go/test/test_summary.go` and document it here.

### TypeScript Test Debugging

For verbose test output with detailed encoding/decoding information:
```bash
DEBUG_TEST=1 npm test                           # Debug all tests
DEBUG_TEST=1 npm test -- --filter=test_name    # Debug specific test
```

This will output:
- Input values being encoded
- Expected vs actual bytes/bits
- Match status
- Exception stack traces

## Commit Messages

Use conventional commits format for all commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring without changing behavior
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, build, etc.)

**Examples:**
```bash
feat(computed-fields): add first/last array selector parsing
fix(schema): preserve getters in Zod 4 recursive schemas
docs(zod): document recursive schema behavior in Zod 4
refactor(generator): extract array encoding to separate module
test(zip): add tests for empty array correlation
chore(deps): update zod to 4.1.12
```

## Build Commands

```bash
# Run TypeScript tests
make test-ts

# Run Go tests
make test-go

# Run Go tests with filter
make test-go-filter FILTER=primitives

# Build website
make website

# Run website dev server
make run-website

# Docker build
make docker-build
make docker-build-push

# Clean generated files
make clean
```

## Directory Structure

- `src/` - TypeScript source code
  - `src/schema/` - Zod schemas for binary format definitions and protocol layer
  - `src/generators/` - Code generators (TypeScript, Go, HTML documentation)
  - `src/runtime/` - Runtime encoder/decoder (reference implementation)
  - `src/tests/` - Test suites organized by category (primitives, bit-level, composite, etc.)
  - `src/test-runner/` - Test execution engine
- `go/` - Go implementation
  - `go/runtime/` - Go runtime library (bitstream, errors)
  - `go/codegen/` - Go code generator
  - `go/test/` - Go test suite with batched compilation
- `rust/` - Rust implementation (experimental, limited support)
- `website/` - Marketing/documentation website
- `examples/` - Example schemas (DNS, ZIP, sensor networks)
- `fixtures/` - Binary test files (e.g., redketchup.zip)
- `tests-json/` - JSON test cases exported from TypeScript tests for cross-language validation
- `docs/` - Project documentation and design decisions

## Key Files

**Schema & Validation:**
- `src/schema/protocol-schema.ts` - Protocol metadata layer (messages, constants, examples)
- `src/schema/test-schema.ts` - Test suite schema definition
- `src/schema/validator.ts` - Schema validation

**Code Generation:**
- `src/generators/typescript.ts` - TypeScript code generator
- `src/generators/go.ts` - Go code generator
- `src/generators/html.ts` - HTML documentation generator
- `go/codegen/generator.go` - Go code generator implementation

**Runtime:**
- `src/runtime/bit-stream.ts` - Bit-level encoder/decoder (MSB/LSB bit ordering)
- `src/runtime/seekable-bit-stream.ts` - Random-access support for reading
- `go/runtime/bitstream.go` - Go bitstream implementation

**Testing:**
- `src/run-tests.ts` - Main test runner with auto-discovery
- `src/test-runner/runner.ts` - Test execution engine
- `src/test-runner/export-tests.ts` - Exports TypeScript tests to JSON
- `go/test/compile_batch.go` - Batched compilation system for Go tests (5-10s vs 60s)
- `go/test/test_summary.go` - Test result reporting with environment variable flags

## Architecture

### Schema Definition
BinSchema uses JSON5 for schema definitions with Zod validation. Schemas define:
- Global config (endianness, bit_order)
- Type definitions (structs with sequences of fields)
- Field types (primitives, arrays, conditionals, computed fields)

### Two-Layer Protocol System
1. **BinarySchema**: Low-level binary format (types, fields, encoding)
2. **ProtocolSchema**: High-level protocol metadata (messages, constants, documentation)
   - References a BinarySchema file via `types_schema`
   - Adds message definitions with codes, directions, and payload types
   - Used for generating protocol documentation

### Test Architecture
Tests are defined in TypeScript (`src/tests/**/*.test.ts`) and automatically exported to JSON (`tests-json/`) for cross-language validation:

1. TypeScript tests define schemas + test cases (expected bytes/values)
2. `src/run-tests.ts` auto-discovers and exports tests to JSON
3. JSON tests are shared between TypeScript and Go implementations
4. Each language runs the same test cases to ensure compatibility

### Code Generation Flow
1. Parse schema (JSON5 → Zod validation)
2. Generate target language code (TypeScript/Go/Rust)
3. Generated code includes:
   - Type definitions (structs/interfaces)
   - Encode methods (value → bytes)
   - Decode functions (bytes → value)
   - Bitstream handling for bit-level fields

## Common Patterns

### Adding a New Test

1. Create test file in `src/tests/<category>/<name>.test.ts`
2. Define schema and test cases using the TestSuite format
3. Run `npm test` to verify TypeScript implementation
4. Tests are automatically exported to `tests-json/` for cross-language validation
5. Run `cd go && go test -v ./test` to verify Go implementation passes the same tests

### Adding a New Feature

1. Add test cases first (TDD approach)
2. Implement in TypeScript generator and runtime
3. Update Go generator and runtime to match
4. Verify both implementations pass the same JSON test cases
5. Update documentation if needed

### Adding a New Generator

1. Implement generator in `src/generators/<language>.ts`
2. Add runtime library in `<language>/runtime/`
3. Create test suite in `<language>/test/`
4. Ensure it can consume JSON test cases from `tests-json/`
5. Update documentation

### Debugging Go Tests

If you need to inspect generated Go code:
```bash
DEBUG_GENERATED=tmp-go cd go && go test -v ./test
# Generated code will be in tmp-go/ directory instead of being deleted
```

## Important Constraints

- Schemas must be valid JSON5
- Field names must be valid identifiers in all target languages (camelCase/snake_case)
- Bit-level fields must align properly (bit offset tracked internally)
- Arrays must have known size (count field reference) or delimiter
- Rust implementation is experimental with limited feature support
- Go batched compilation requires all test suites to compile successfully together

## Important Notes

### Zod 4 Recursive Schemas
If you encounter issues with recursive schemas (especially array `items` fields being stripped during serialization), check `docs/ZOD_RECURSIVE_SCHEMA_FINDINGS.md`. Key points:
- Zod 4 uses **getters** for recursion, not `z.lazy()`
- Getters don't survive `.parse()` - validate but return the original object
- The schema definition in `src/schema/binary-schema.ts` uses getters correctly

## Key Concepts

### Bit Ordering
- `msb_first`: Most significant bit first (network protocols, video codecs)
- `lsb_first`: Least significant bit first (hardware bitfields)
- Affects how bits are packed within bytes

### Endianness
- `big_endian`: Most significant byte first (network byte order)
- `little_endian`: Least significant byte first (x86 architecture)
- Can be set globally or per-field

### Computed Fields
- `length_of`: Field contains the byte length of another field
- `count_of`: Field contains the number of elements in an array
- `position_of`: Field contains the byte offset to another field (for random access)
- `crc32_of`: Field contains CRC32 checksum of another field

### Conditional Fields
- Fields with `if` conditions are only encoded/decoded when condition is true
- Condition can reference previous fields in the sequence
- Used for protocol variants and optional features
