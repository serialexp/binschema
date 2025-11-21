# BinSchema TODO

This file tracks active work and future enhancements. Completed items have been moved to `docs/finished/COMPLETED_TODO_ITEMS.md`.

## Active Work

### CODEGEN Improvements (from docs/CODEGEN_IMPROVEMENTS.md)

- [ ] **Extract inline anonymous types to named interfaces**
- [ ] **Add input validation for bitfields**
- [ ] **Add const enums for well-known discriminator values**
- [ ] **Generate helper type guards**
- [ ] **Add encode/decode convenience wrappers**
- [ ] **Add `toJSON()` methods for pretty printing**
- [ ] Add test that validates generated TypeScript compiles without errors
- [ ] Add test that validates no `any` types in public API (except stream - to fix)
- [ ] Add test that validates all public interfaces have JSDoc
- [ ] Add snapshot test for generated code structure

### Go Implementation Plan (from docs/GO_IMPLEMENTATION_PLAN.md)

#### Phase 0: Setup (~30 min)
- [ ] Create `go/` directory structure
- [ ] Initialize Go module: `go mod init github.com/anthropics/binschema`
- [ ] Add basic README explaining Go implementation
- [ ] Create placeholder files for each component

#### Validation & Completion Checklist
- [ ] All primitive type tests pass (10 test suites)
- [ ] All composite type tests pass (6 test suites)
- [ ] All advanced feature tests pass (4 test suites)
- [ ] No test failures (100% pass rate required)
- [ ] Generated code compiles without warnings
- [ ] Error codes behave identically to TypeScript
- [ ] Documentation is complete
- [ ] Examples run successfully
- [ ] Can generate SuperChat protocol encoders/decoders

### Schema Migration Tasks

- [ ] Merge IoT protocol schema files into single unified schema
- [ ] Merge any other protocol schemas (follow dns.schema.json pattern)
- [ ] Update all protocol tests to use merged schemas

### Refactor Plan – Type System (from docs/REFACTOR_PLAN.md)

- [ ] All 256+ tests passing (currently: ✅ 256 passing)
- [ ] Type aliases work correctly (String, Optional, etc.)
- [ ] TypeScript generator produces correct code
- [ ] HTML generator produces correct docs
- [ ] Example SuperChat schema uses type aliases

### Schema Documentation System (from docs/SCHEMA_DOCUMENTATION.md)

#### Phase 1: Metadata System
- [ ] Add `.meta()` calls to bit-level types (bit, bitfield)
- [ ] Add `.meta()` calls to composite types (array, string, optional, discriminated_union, pointer)
- [ ] Add `.meta()` calls to special types (conditional, type reference)

#### Phase 2: Generic Metadata Extractor
- [ ] Handle array types
- [ ] Handle optional/nullable types
- [ ] Handle recursive schemas

#### Phase 3: HTML Generator
- [ ] Add search/filter functionality (optional, future)

#### Phase 4: Integration
- [ ] Add to CI/deployment pipeline (optional, future)

#### Phase 5: Documentation & Examples
- [ ] Document metadata format and conventions
- [ ] Document how to use the generic extractor
- [ ] Provide example for documenting custom schemas
- [ ] Update main README with link to type reference

## Future Enhancements

### Performance

- [ ] Benchmark encoder/decoder performance
- [ ] Consider pre-allocated buffer sizes
- [ ] Profile bit operations for hot paths

### Language Support

- [ ] Design Go code structure (types, encoder, decoder)
- [ ] Implement generator similar to TypeScript version
- [ ] Add Go-specific tests
- [ ] Rust generator improvements (currently experimental)

### Documentation

- [ ] Generate visual schema documentation
- [ ] Show byte/bit layouts
- [ ] Include examples and test cases

### Type System Extensions

- [ ] Support for enums
- [ ] Support for unions/tagged unions (beyond current discriminated unions)
- [ ] Support for alignment/padding
- [ ] Support for additional computed field types (beyond length_of, crc32_of, position_of)

### Streaming Support Roadmap (from docs/STREAMING_ANALYSIS.md)

#### Phase 1: `length_prefixed_items` Array Kind (~2-3 days)

**Schema Changes**
- [ ] Add `item_length_type` field to array schema definition
- [ ] Validate `length_prefixed_items` kind in schema validator
- [ ] Add error if `item_length_type` missing when `kind: "length_prefixed_items"`
- [ ] Support `item_length_type` values: `"uint8"`, `"uint16"`, `"uint32"`, `"uint64"`

**Encoder Changes**
- [ ] Detect `length_prefixed_items` array kind in code generator
- [ ] Generate encoding code that encodes item to temporary buffer
- [ ] Generate encoding code that measures buffer size
- [ ] Generate encoding code that validates size ≤ max for `item_length_type`
- [ ] Generate encoding code that writes item length prefix (using `item_length_type`)
- [ ] Generate encoding code that writes item bytes
- [ ] Update `generateEncodeArray()` function with new case

**Decoder Changes (Synchronous)**
- [ ] Generate decoding code that reads array length (using `length_type`)
- [ ] Generate decoding code that reads item length (using `item_length_type`)
- [ ] Generate decoding code that reads exactly that many bytes
- [ ] Generate decoding code that decodes item from bytes slice
- [ ] Update `generateDecodeArray()` and `generateFunctionalDecodeArray()` functions

**Tests**
- [ ] Run existing test suite (should all pass)
- [ ] `length-prefixed-items.test.ts` – basic primitives
- [ ] `length-prefixed-items.test.ts` – variable-length strings
- [ ] `length-prefixed-items.test.ts` – complex structs
- [ ] `length-prefixed-items.test.ts` – large arrays (100+ items)
- [ ] `length-prefixed-items.test.ts` – uint8/uint16/uint32/uint64 `item_length_type`
- [ ] `length-prefixed-items.test.ts` – nested arrays
- [ ] `length-prefixed-items.test.ts` – optional fields
- [ ] `length-prefixed-items.test.ts` – size constraint validation

#### Phase 2: Error Codes for Cross-Language Compatibility (~1 day)

**BitStreamDecoder Changes**
- [ ] Add `lastErrorCode: string | null` property to `BitStreamDecoder`
- [ ] Set `lastErrorCode = 'INCOMPLETE_DATA'` when hitting EOF in all read methods
- [ ] Clear `lastErrorCode = null` on successful read
- [ ] Document error codes in comments

**Error Code Constants**
- [ ] Define `INCOMPLETE_DATA`
- [ ] Define `INVALID_VALUE`
- [ ] Define `SCHEMA_MISMATCH`
- [ ] Define `CIRCULAR_REFERENCE`

**Tests**
- [ ] Test that `lastErrorCode` is set correctly on EOF
- [ ] Test that `lastErrorCode` is cleared on success

#### Phase 3: Streaming Layer (~2-3 days)

**New Module: `src/runtime/stream-decoder.ts`**
- [ ] Create `readExactly(reader, n)` helper
- [ ] Implement `decodeArrayStream()` for `length_prefixed_items`
- [ ] Implement `decodeArrayGreedy()` for standard arrays

**Tests**
- [ ] `chunked-network.test.ts` – items split across chunks
- [ ] `chunked-network.test.ts` – one-byte chunks
- [ ] `chunked-network.test.ts` – large chunks
- [ ] `chunked-network.test.ts` – partial item at boundary
- [ ] `chunked-network.test.ts` – variable-length items
- [ ] `chunked-network.test.ts` – empty arrays
- [ ] `chunked-network.test.ts` – network errors mid-stream
- [ ] `chunked-network.test.ts` – decode errors mid-stream
- [ ] `chunked-network.test.ts` – slow consumer backpressure
- [ ] `chunked-network.test.ts` – `length_prefixed_items` with chunks
- [ ] Update tests to work with actual generated streaming functions

#### Phase 4: Code Generation for Streaming Variants (~1-2 days)

**Codegen Changes**
- [ ] Add `generate_streaming: true` option to code generator config
- [ ] Detect root-level arrays in schema
- [ ] For `kind: "length_prefixed_items"`, generate `decode{TypeName}Stream()` async generator (uses `readExactly()`)
- [ ] For standard array kinds, generate `decode{TypeName}StreamGreedy()` async generator (uses greedy buffering)
- [ ] Generate both sync and streaming decoders side-by-side

**Documentation**
- [ ] Add TypeDoc comments to generated streaming functions
- [ ] Document when to use streaming vs batch decoding
- [ ] Add usage examples

#### Phase 5: Documentation and Examples (~1 day)

**Documentation Updates**
- [ ] Update `CLAUDE.md` with streaming section
- [ ] Add streaming examples to `examples/` directory
- [ ] Document error codes and their meanings
- [ ] Add troubleshooting guide for common streaming issues

**Examples to Add**
- [ ] Simple streaming example (fetch data, decode incrementally)
- [ ] Web client example (WebSocket/fetch integration)
- [ ] Greedy buffering example (existing protocol)
- [ ] Error handling example (network failure, invalid data)

**README Updates**
- [ ] Add streaming section to main README
- [ ] Add badges/indicators for streaming support
- [ ] Link to streaming analysis document

#### Testing Checklist

**Unit Tests**
- [ ] All existing tests pass (no regressions)
- [ ] `length-prefixed-items.test.ts` (wire format)
- [ ] `greedy-buffering.test.ts` (wire format)
- [ ] `chunked-network.test.ts` (streaming integration)

**Integration Tests**
- [ ] Test with real `ReadableStream` from `fetch()`
- [ ] Test with WebSocket streams
- [ ] Test with Node.js file streams
- [ ] Test with various chunk sizes (1 byte, 64KB, random)

**Edge Cases**
- [ ] Empty arrays
- [ ] Single-item arrays
- [ ] Very large items (> 1MB)
- [ ] Maximum array length (uint16/uint32 limits)
- [ ] Network errors at every possible boundary
- [ ] Decode errors at every possible position

**Performance Tests**
- [ ] Compare batch vs streaming overhead (< 10% acceptable)
- [ ] Measure memory usage with large arrays (no unbounded buffering)
- [ ] Verify backpressure handling (slow consumer doesn't OOM)

#### Cross-Language Considerations

- [ ] Document error codes in shared spec
- [ ] Ensure wire format is language-agnostic
- [ ] Test interoperability (TypeScript encode → Go decode)
- [ ] Consider Go-specific optimizations (`io.Reader` interface)

#### Final Checklist

- [ ] All tests passing
- [ ] Documentation complete
- [ ] Examples working
- [ ] No performance regressions
- [ ] Error messages are clear and helpful
- [ ] Code review complete
- [ ] Streaming support ready for production use

## Milestones

- [x] Computed fields working (length_of, crc32_of, position_of)
- [x] Array selectors working (first, last, corresponding)
- [x] Context threading implemented
- [x] Cross-struct references for ZIP support
- [x] All 256+ tests passing
- [ ] Performance benchmarks established
- [ ] Documentation complete
- [ ] Go generator implemented
- [ ] Streaming support added
