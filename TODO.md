# TODO

- Go test harness: dns_label_* tests fail because `Label` is a string type alias (`type X = string`) which has no Encode/Decode methods. The Go test harness can't call Encode/Decode on bare string type aliases used as test_type roots. Need to either generate wrapper structs for string types used as test_type, or handle string type aliases specially in the test harness.

- Go generator: standalone discriminated_union types with FIELD-based discriminators don't work. The parent struct's decoder calls the DU's plain `Decode...` directly, but the generated DU is an interface and the caller writes `*p` which fails (`cannot indirect p (variable of interface type)`). The Rust generator handles this by inlining the dispatch at the parent's call site (see `generateDecodeField` default branch in `packages/binschema/src/generators/rust.ts`); the Go generator should do the same. Repro: `packages/binschema/src/tests/composite/standalone-du-field-discriminator.test.ts`.
