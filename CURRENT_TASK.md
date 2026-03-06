# Current Task: Inline Choice Field Support for Go Generator — COMPLETE

## Status: COMPLETE (2026-03-05)

Fixed Go generator and test harness to support `choice` as a direct sequence field (not just inside arrays). This fixes 4 failing test cases across 2 test suites.

---

## What Was Done

### Go Generator (`packages/binschema/src/generators/go.ts`)
*Note: These changes were already committed in a previous session.*

1. **Type mapping** (`mapFieldToGoType`): Changed `case "choice"` to return `interface{}` instead of `"Choice"` (matching discriminated_union pattern)
2. **Choice type collection** (`collectChoiceTypes`): Added second pass to collect choice types from direct sequence fields (not just arrays)
3. **Encoding** (`generateEncodeFieldImpl`): Replaced `generateEncodeNestedStruct` with new `generateEncodeInlineChoice` function using type switch
4. **Decoding**: Added new `generateDecodeInlineChoice` function with peek-based discriminator detection and block scoping for multiple choice fields
5. **Size calculation** (`generateFieldSizeForType`): Added `case "choice"` alongside `discriminated_union`

### Go Test Harness (`go/test/compile_batch.go`)
1. **`formatValueWithSchema`**: Added handler for `fieldType == "choice"`
2. **`formatStructValue`**: Added handler for inline choice fields
3. **`isStringUsedAsVariant`**: Added check for inline choice field variant types
4. **`formatInlineChoiceValue`**: New function to format flat choice values as `&prefix_VariantType{fields...}`

### Key Design Decisions
- Choice values are **flat** (`{type: "X", field1: v1}`) unlike discriminated_union which wraps in `{type, value}`
- Discriminator is auto-detected from first field's `const` value in first choice type
- Block scoping prevents duplicate `const discriminator` declarations when multiple choice fields exist in same struct

## Test Results
- `inline_choice_field`: 2/2 passed
- `multiple_inline_choice_fields`: 2/2 passed
- No regressions in TypeScript tests (1015 passed, 3 pre-existing Rust generator failures)
- Pre-existing Go failures (dns_label_* string type alias issue) noted in TODO.md
