# Changelog

## 0.4.0 (2026-02-27)

### Features

- add string const, byte_budget, and string literal conditions

## 0.3.0 (2026-02-18)

### Features

- implement eof_terminated arrays and add decoder Len() method
- add validate command and improve generate error handling
- unify struct naming and add eof_terminated array support
- improve docs, examples, and playground link

### Bug Fixes

- include root README.md in npm package
- add parse-time validation for type references and discriminators
- fix broken doc links, domain references, and add 404 page

## 0.2.0 (2026-02-17)

### Features

- add example schemas, docs improvements, and JSON Schema for IDE support
- add inline discriminated union support for position fields
- add alignment padding field type
- add arithmetic expression engine
- add computed_count array kind with expression support
- add complete table type schemas and tests
- add Rust code generator
- add test harness and CLI integration
- run all tests, handle failures gracefully
- add usage examples section to HTML documentation
- add decoded_value to test cases
- strip const/computed fields from test case values
- remove signature const fields from ZIP test values
- split interfaces into Input/Output types
- extend generator with varlength, bitfield, optional, padding support
- implement discriminated unions and expand array/string support
- major improvements to Rust generator - 662 errors down to 6
- implement bitfield struct generation with sub-fields
- implement corresponding<Type> correlation and context infrastructure
- implement DNS-style back_reference compression
- add Go performance comparison infrastructure
- latest state of rust generator
- major Rust generator improvements and fix stale codegen tests

### Bug Fixes

- improve docs generator and add validation
- add varlength support in from_after_field encoding
- handle inline discriminated unions in interface generation
- fix discriminated union enum generation and type name prefixing
- handle nested arrays and string arrays inline
- resolve Input struct generation bugs and add duplicate test validation
- add choice as built-in field type and fix CI build

### Performance Improvements

- bulk reads, zero-copy strings, and fast bit ops across all runtimes

### Refactoring

- restructure to packages/ monorepo layout

### Other

- crc32_of with corresponding field access (incomplete)

