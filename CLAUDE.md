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

## Working with Temporary Files

**IMPORTANT:** When creating temporary test files or scratch files:
- **DO** use `./tmp/` relative to the project root (e.g., `./tmp/test-file.ts`)
- **DO NOT** use `/tmp/` (absolute path) - imports from `src/` won't work from there
- The `./tmp/` directory is gitignored and safe for temporary files
- Files in `./tmp/` can import from `src/` and use relative paths normally

**Example:**
```bash
# Good - relative to project root
cat > ./tmp/test-varlength.ts << 'EOF'
import { BitStreamEncoder } from '../src/runtime/bit-stream.js';
// ... test code
EOF
bun ./tmp/test-varlength.ts

# Bad - absolute path, imports won't work
cat > /tmp/test-varlength.ts << 'EOF'
import { BitStreamEncoder } from './src/runtime/bit-stream.js';  // ERROR: won't resolve
EOF
```

## Task Tracking with CURRENT_TASK.md

**IMPORTANT:** `CURRENT_TASK.md` is a local-only file for tracking work in progress. It is gitignored and should **NEVER** be committed, even after making updates to it.

**Purpose:**
- Tracks the current task state between conversations
- Documents completed work with commit references
- Lists next steps and implementation phases
- Contains references to external resources (Kaitai schemas, etc.)

**Usage:**
- Read this file at the start of a session to understand current context
- Update it as you complete work (add commit hashes, move items to "Completed")
- Keep it current so the next session can pick up where you left off

## Testing

### Running Tests

```bash
# Run all tests (TypeScript and Go)
make test

# Run TypeScript/Bun tests only
npm test                                       # Run all BinSchema tests (~0.15s with bun!)
npm test -- --filter=<pattern>                 # Run tests matching pattern (supports pipe: 'foo|bar')
npm test -- --failures                         # Show only failing tests
npm test -- --filter=uint16 --failures         # Combine flags for focused debugging
npm test -- --summary                          # Minimal output (just final summary)

# Examples
npm test -- --filter=optional                  # Only tests with 'optional' in name
npm test -- --filter='uint8|uint16|uint32'     # Tests matching ANY of the patterns (OR logic)
npm test -- --failures                         # Only show test suites with failures
DEBUG_TEST=1 npm test -- --filter=zip          # Debug zip tests with verbose output

# Go test suite
# Uses batched compilation for efficiency (single compilation, ~5-10s vs one-by-one, ~60s)
cd go
go test -v ./test                             # Run all tests with batched compilation

# Test filtering and reporting flags (Go)
TEST_FILTER=primitives go test -v ./test      # Run only tests matching 'primitives'
TEST_FILTER=bit go test -v ./test             # Run only bitfield tests (bit_order, bitfield, single_bit, etc.)
TEST_REPORT=summary go test -v ./test         # Print overall statistics
TEST_REPORT=failed-suites go test -v ./test   # List only test suites with failures
TEST_REPORT=passing-suites go test -v ./test  # List 100% passing test suites
TEST_REPORT=failing-tests go test -v ./test   # Show individual failing test cases
TEST_REPORT=json go test -v ./test            # JSON output for scripting
```

**⚠️ Important**: Please use the environment variable flags above for analyzing test results and filtering tests. Custom shell commands are fragile and hard to maintain. If you need a report format that doesn't exist, add it to `go/test/test_summary.go` and document it here.

### TypeScript Test Flags

**Command-line flags:**
- `--filter=<pattern>` - Only run tests with names containing pattern (case-insensitive)
- `--failures` - Show only test suites with failures (hides passing tests)
- `--summary` - Minimal output, only show final summary

**Environment variables:**
- `DEBUG_TEST=1` - Enable verbose debug output (input values, bytes, stack traces)

**Useful combinations:**
```bash
# Focus on specific failing tests
npm test -- --filter=context --failures

# Debug a specific test with full details
DEBUG_TEST=1 npm test -- --filter=first_element_position

# Quick check: only see what's broken
npm test -- --failures

# CI mode: minimal noise
npm test -- --summary
```

### TypeScript Test Debugging

**IMPORTANT: Always use DEBUG_TEST for debugging test failures before making code changes.**

For verbose test output with detailed encoding/decoding information:
```bash
DEBUG_TEST=1 npm test -- --filter=test_name    # Debug specific test (recommended)
DEBUG_TEST=1 npm test -- --failures            # Debug only failing tests
```

**Output includes:**
- Input values being encoded
- Expected vs actual bytes/bits
- Match status (true/false)
- Full exception stack traces

**When to use DEBUG_TEST:**
1. **Before fixing a failing test** - Always run with DEBUG_TEST to understand the failure
2. **When test output is unclear** - "Exception: Error: X" messages need stack traces
3. **Investigating byte mismatches** - See exactly what was encoded vs expected
4. **Validating assumptions** - Check if encoding works but decoding fails (or vice versa)
5. **After making generator changes** - Verify the generated code produces correct output

**Best practices:**
- Always filter to a specific test (`--filter=test_name`) to avoid overwhelming output
- Use `--failures` to see only broken tests
- Compare expected vs actual bytes first - often reveals the root cause immediately
- Check if exception happens during encoding or decoding
- Look for off-by-one errors in byte positions (common with discriminator fields)

### Field-Level Encoding Debugging

**IMPORTANT: Use DEBUG_ENCODE to trace encoding at the field level.**

When you need to see **exactly which fields are being encoded and their byte positions**:
```bash
DEBUG_ENCODE=1 npm test -- --filter=test_name
DEBUG_ENCODE=1 bun your-script.ts
```

**Output format:**
```
[0] id:
  → id: 2 bytes [12 34]
[2] flags:
  → flags: 2 bytes [81 80]
[4] questions:
  [4] qname:
    [4] Label:
      → Label: 8 bytes [07 65 78 61 6d 70 6c 65]
    [12] Label:
      → Label: 4 bytes [03 63 6f 6d]
```

**When to use DEBUG_ENCODE:**
1. **Debugging byte position issues** - See exactly where each field is written
2. **Tracing encoding order** - Verify fields are encoded in the expected sequence
3. **Finding missing/extra bytes** - Compare expected vs actual positions
4. **Debugging nested structures** - See the full encoding hierarchy with indentation
5. **Validating from_after_field** - Check that length fields are at correct positions

**Key differences from DEBUG_TEST:**
- `DEBUG_TEST`: Shows test-level input/output (what you're testing)
- `DEBUG_ENCODE`: Shows field-level encoding trace (how it's encoded)
- Use both together for complete debugging: `DEBUG_TEST=1 DEBUG_ENCODE=1 npm test --filter=test_name`

**Example workflow:**
```bash
# 1. Identify failing tests
npm test -- --failures

# 2. Debug specific test with verbose output
DEBUG_TEST=1 npm test -- --filter=first_element_position

# 3. Analyze output to find root cause
# 4. Make targeted fix
# 5. Verify fix works
npm test -- --filter=first_element_position
```

### Writing Tests

BinSchema has two types of tests:

#### 1. TestSuite Tests (for encoder/decoder validation)

**Use TestSuite tests when:** Testing that a schema correctly encodes/decodes binary data.

**Location:** `src/tests/**/*.test.ts`

**Pattern:**
```typescript
import { TestSuite } from "../../schema/test-schema.js";

export const myFeatureTestSuite: TestSuite = {
  name: "my_feature",
  description: "Tests for my feature",
  schema: {
    config: { endianness: "big_endian" },
    types: {
      "MyType": {
        sequence: [
          { name: "value", type: "uint16", endianness: "big_endian" }
        ]
      }
    }
  },
  test_type: "MyType",
  tests: [
    {
      description: "Zero value",
      value: { value: 0 },
      bytes: [0, 0]
    },
    {
      description: "Max value",
      value: { value: 65535 },
      bytes: [255, 255]
    }
  ]
};
```

**How it works:**
- Automatically generates encoder/decoder from schema
- Tests both encoding (value → bytes) and decoding (bytes → value)
- Exported to JSON for cross-language validation (Go, Rust)

**Using `decoded_value` for computed fields:**

When a type has computed fields (like `length_of` with `from_after_field`), the encoding input omits these fields (they're computed), but the decoded output includes them (they're in the byte stream). Use `decoded_value` to specify different expected output:

```typescript
{
  description: "ASN.1 INTEGER with computed length",
  value: {
    tag: 0x02,
    // length is omitted - computed during encoding
    value: [0x05]
  },
  decoded_value: {
    tag: 0x02,
    length: 1,  // Computed field appears in decoded output
    value: [0x05]
  },
  bytes: [0x02, 0x01, 0x05]  // tag, length, value
}
```

**When to use `decoded_value`:**
- **Computed fields**: Types with `length_of`, `position_of`, `count_of` fields that are computed during encoding but appear during decoding
- **ASN.1/DER encoding**: Length prefixes are computed from content but appear in decoded structures
- **Metadata fields**: Any field that's automatically calculated during encoding but is part of the wire format

**When NOT to use `decoded_value`:**
- Simple types without computed fields - decoder output matches encoder input
- If omitted, test framework uses `value` as expected decoded output

#### 2. Custom Function Tests (for everything else)

**Use custom function tests when:** Testing anything OTHER than encoder/decoder behavior:
- Schema validation
- Code generation patterns
- Protocol transformations
- Error handling
- CLI parsing

**Location:** `src/tests/**/*.test.ts` (same files as TestSuite tests)

**Pattern:**
```typescript
interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;  // Only set when passed=false
}

export function runMyCustomTests(): { passed: number; failed: number; checks: TestCheck[] } {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];

  // Test case 1
  try {
    const result = myFunction();
    if (result === expected) {
      passed++;
      checks.push({ description: "Function returns expected value", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Function returns expected value",
        passed: false,
        message: `Expected ${expected}, got ${result}`
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Function returns expected value",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  return { passed, failed, checks };
}
```

**Requirements:**
- Function name must start with `run` or end with `Tests` (e.g., `runMyTests`, `myCustomTests`)
- Must return `{ passed: number, failed: number, checks: TestCheck[] }`
- Each check must have `description`, `passed`, and optional `message` (for failures)
- Checks are automatically discovered and integrated into test output

**Examples:**
- `src/tests/generators/discriminated-union-codegen.test.ts` - Code generation validation
- `src/tests/schema/protocol-validation.test.ts` - Schema validation
- `src/tests/cli/command-parser.test.ts` - CLI argument parsing

**Key differences:**
- TestSuite: Validates binary encoding/decoding behavior
- Custom function: Validates everything else (code gen, validation, transformations, etc.)
- Both types auto-discovered and run together
- Both support `--filter` and `--failures` flags

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
- `src/generators/typescript.ts` - TypeScript code generator (reference implementation)
- `src/generators/go.ts` - Go code generator
- `src/generators/rust.ts` - Rust code generator
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

## Code Generator Development

### Reference Implementation Priority

**IMPORTANT:** The TypeScript generator (`src/generators/typescript.ts`) is the **reference implementation** and receives all new features first. When implementing features in Go or Rust generators:

1. **Always refer to the TypeScript generator** when unsure how to implement a feature
2. The TypeScript generator has the most complete implementation and handles all edge cases
3. Look for similar patterns in `typescript.ts` before implementing in other languages
4. TypeScript generator patterns are proven to work - use them as a template

### Generator Feature Parity

**Implementation order:**
1. TypeScript generator (reference) - gets features first
2. Go generator - follows TypeScript patterns
3. Rust generator - follows TypeScript/Go patterns

**When adding a feature to Go/Rust:**
- Check `src/generators/typescript.ts` for the canonical implementation
- Follow the same logic flow and edge case handling
- Adapt TypeScript patterns to the target language idioms

## Common Patterns

### Adding a New Test

1. Create test file in `src/tests/<category>/<name>.test.ts`
2. Define schema and test cases using the TestSuite format
3. Run `npm test` to verify TypeScript implementation
4. Tests are automatically exported to `tests-json/` for cross-language validation
5. Run `cd go && go test -v ./test` to verify Go implementation passes the same tests

### Adding a New Feature

1. Add test cases first (TDD approach)
2. Implement in TypeScript generator and runtime (reference implementation)
3. Update Go generator and runtime to match (refer to TypeScript implementation)
4. Update Rust generator if applicable (refer to TypeScript/Go implementations)
5. Verify all implementations pass the same JSON test cases
6. Update documentation if needed

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
