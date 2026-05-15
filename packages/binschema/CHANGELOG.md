# Changelog

## 0.7.0 (2026-05-15)

### Features

- error codes + streaming decoder

### Documentation

- add Python to landing page, playground, and docs

## 0.6.0 (2026-05-15)

### Features

- add Python code generator, runtime, and test harness
- monomorphize templates + inline bool/bytes in variant arms
- full primitive coverage for arrays in variant arms
- inline standalone DU dispatch at field-discriminator call site
- support length_of/crc32_of with first<T>/last<T> selectors
- support _root.X length_field references for instance types
- ergonomic impls for string/bytes alias newtypes, silence noisy warnings
- align_to, signature_terminated, utf16/latin1 encodings
- instance fields (random-access lazy decode)
- root-fallback field lookup + standalone decode_X aliases
- nested from_after_field, length_of struct trial-encode, hyphen names
- thread parentFields through choice inliner; resolve type aliases
- inline DU length_of, sum_of_type_sizes, first/last selectors for length_of
- retrofit ctx threading + deferred patches for forward refs
- inline corresponding<T> resolution + cross/same array distinction
- multi-level parent refs + parent-ref position_of via ctx
- crc32_of with selectors + parent-ref crc32_of via field extents
- sum_of_sizes deferred parent-ref + inlined choice arm push
- track patch owner_encoder; resolves multi-file ZIP CRCs
- raise on corresponding<T> miss + trial_mode opt-out
- DNS back_reference (label compression) — finishes retrofit

### Bug Fixes

- correct bytes-in-variant-arm with non-uint8 length prefix
- qualify std::string::String and box self-recursive type cycles
- inline standalone DU dispatch at field-discriminator call site
- emit clean generated code (no blanket allow attrs)
- conditional expressions use .get() to short-circuit on missing parents
- resolve primitive alias chain for instance fields and type-refs
- first/last selectors with sub-field path in length_of / crc32_of

### Tests

- add variant-arm inliner regression scenarios + tests-first rule

## 0.5.0 (2026-03-06)

### Features

- add messageCodeTypeName option to ProtocolTransformOptions
- add bool, bytes, and utf16 sugar types across all generators
- bundle runtime files during Go/Rust generation

### Bug Fixes

- use MessageCode enum type for discriminator field in Frame
- add frame_type_name and message_code_type_name to Zod schema

### Documentation

- add llms.txt for BinSchema package

### Chores

- clean up uncommitted changes
- update task tracking and fix Rust codegen test assertions

## 0.4.0 (2026-03-02)

### Features

- add string const, byte_budget, and string literal conditions
- make encoder trace logging conditional via --debug flag
- add MessageCode enum generation and wire protocol transform into CLI

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

