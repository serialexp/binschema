# Test Fixes Progress Report

## Summary

**Starting state:** 53 failing tests out of 540 total
**Current state:** 41 failing tests out of 540 total
**Progress:** 12 tests fixed (23% reduction in failures)

## Changes Made

### 1. Removed Unused Code
- **Deleted:** `src/generators/typescript/legacy-monolith.ts` (2,737 lines)
- **Reason:** Not imported or used anywhere in the codebase
- All imports reference `src/generators/typescript.ts` instead

### 2. Fixed Context Variable Name Threading

#### Problem
Generated code for choice arrays within arrays was using hardcoded `extendedContext` variable name, but the actual variable was field-specific like `extendedContext_primaries`.

**Example error:**
```
ReferenceError: extendedContext is not defined
```

#### Solution
Added context variable name parameter threading through the code generation pipeline:

**Files modified:**
1. `src/generators/typescript/context-extension.ts`
   - Enhanced `getContextParam()` to accept optional `fieldName` parameter
   - Returns field-specific context like `, extendedContext_primaries` when fieldName provided

2. `src/generators/typescript.ts`
   - Added `contextVarName?: string` parameter to `generateEncodeFieldCoreImpl()`
   - Added `contextVarName?: string` parameter to `generateEncodeChoice()`
   - Added `contextVarName?: string` parameter to `generateEncodeTypeReference()`
   - Modified `generateEncodeTypeReference()` to pass context var name to nested encoders
   - Updated `generateNestedTypeContextExtension()` to accept `baseContextVarName` parameter

3. `src/generators/typescript/array-support.ts`
   - Updated function signature to match new `generateEncodeFieldCoreImpl()` signature
   - Pass field-specific context variable name when encoding array items

**Key insight:** Context variables are scoped to fields (e.g., `extendedContext_primaries`, `extendedContext_secondaries`), not globally as `extendedContext`.

### 3. Fixed Nested Type Context Extension

#### Problem
When encoding nested types within arrays, the context extension was always spreading from `context` instead of the current (potentially array-extended) context variable.

**Example:**
```typescript
// WRONG: Always spreads from 'context' even inside array loop
const extendedContext_item: EncodingContext = {
  ...context,  // ❌ Should use extendedContext_arrayName
  parents: [...context.parents, ...]
};
```

#### Solution
- Modified `generateNestedTypeContextExtension()` to accept `baseContextVarName` parameter (defaults to `'context'`)
- When calling from `generateEncodeTypeReference()`, pass the provided `contextVarName` as the base
- This ensures array-extended contexts are properly inherited by nested types

## Tests Fixed (12)

Most of these were "extendedContext is not defined" errors in various context threading scenarios:
- Multiple context extension tests (chaining, arrays, nested types)
- Some complex scenarios like unchanged context pass-through
- Array iteration context scenarios

## Remaining Issues (41 tests)

### Category 1: Parent Field References (~17 tests)
**Symptom:** `TypeError: undefined is not an object (evaluating 'value.field_name.length')`

**Root cause:** Computed fields trying to access parent fields via `../` syntax aren't finding them in context.

**Affected tests:**
- `context_extension_sibling_arrays` - `value.array_a.length`
- `context_extension_nested_type` - `value.shared_value.length`
- `context_single_parent_reference` - `value.content.length`
- `context_extension_array` - `value.items.length`
- `parent_field_reference_length` - `value.body.length`
- `nested_parent_references` - `value.payload.length`
- `context_multi_level_parent_reference` - `value.version_info.length`
- `context_extension_chaining` - `value.root_data.length`
- `context_extension_parent_stack_across_arrays` - `value.outer_value.length`
- `context_multiple_parent_fields` - `value.data_a.length`
- `context_extension_array_of_structs` - `value.payload.length`
- `multiple_parent_references` - `value.uncompressed_data.length`

**Investigation needed:**
- Check `src/generators/typescript/computed-fields.ts` - specifically the path resolution for `../` references
- The context.parents array should contain the parent fields, but computed field generation may not be looking them up correctly
- Look at `resolveComputedFieldPath()` function

**Example schema structure:**
```json
{
  "Message": {
    "sequence": [
      { "name": "body", "type": "array", ... },
      { "name": "header", "type": "Header" }  // Header needs to reference ../body
    ]
  },
  "Header": {
    "sequence": [
      { "name": "size", "type": "uint32", "computed": { "type": "length_of", "target": "../body" } }
    ]
  }
}
```

### Category 2: Remaining extendedContext Errors (~7 tests)
**Symptom:** `ReferenceError: extendedContext is not defined`

**Root cause:** First/last selectors in choice arrays still have hardcoded variable names in some code paths.

**Affected tests:**
- `context_last_selector`
- `context_error_last_selector_no_match`
- `context_first_selector`
- `context_sum_of_type_sizes_zip_style`
- `context_multiple_variants_corresponding`
- `context_error_first_selector_no_match`
- `zip_style_aggregate_size`
- `aggregate_size_with_position`
- `last_element_position`
- `first_element_position`

**Investigation needed:**
- Search for hardcoded `extendedContext` references in array-support.ts
- Check the first/last position tracking code generation
- These likely occur in pre-pass position tracking loops (lines ~100-200 in array-support.ts)

**Quick fix strategy:**
```bash
# Find remaining hardcoded references
grep -n "extendedContext[^_]" src/generators/typescript/array-support.ts
```

### Category 3: Sum-of-Type-Sizes Computed Fields (~6 tests)
**Symptom:** Encoded bytes show zeros instead of actual computed sizes

**Example:**
```
Expected: [12,0,0,0,8,0,0,0,...]  # 12 and 8 are computed sizes
Actual:   [0,0,0,0,0,0,0,0,...]   # zeros written
```

**Affected tests:**
- `context_sum_of_type_sizes_basic` (2 cases)
- `context_sum_of_type_sizes_variable_length`
- `context_sum_of_type_sizes_zip_style`
- `array_element_type_size` (2 cases)
- `parent_reference_string_length` (2 cases)
- `parent_reference_crc32`

**Root cause:** The sum-of-sizes computation for arrays with type filtering is not working.

**Investigation needed:**
- Check `src/generators/typescript/computed-fields.ts`
- Look for `sum_of_type_sizes` or similar computed field handling
- The pre-pass position tracking may not be measuring sizes correctly
- String length computation might not be encoding to bytes first

**Example failing schema:**
```json
{
  "name": "total_data_size",
  "type": "uint32",
  "computed": {
    "type": "sum_of_type_sizes",
    "target": "blocks",
    "filter_types": ["DataBlock"]
  }
}
```

### Category 4: Corresponding Correlation (~5 tests)
**Symptom:** `Error: Field 'X' uses corresponding correlation which requires encoding within an array context for 'Y'`

**Affected tests:**
- `context_sibling_array_cross_reference` - Needs primaries array context
- `context_deep_nesting_cross_reference` - Needs root_nodes array context
- `context_inner_references_outer_array` - Needs outer_items array context
- `context_error_type_mismatch_corresponding`

**Root cause:** When encoding a nested type (Secondary) inside an array (secondaries), it needs access to a SIBLING array (primaries) from the parent struct. The context doesn't preserve sibling array information.

**Example:**
```
TwoArrays {
  primaries: [Primary, Primary, Primary],    // First array
  secondaries: [Secondary, Secondary, ...]   // Second array - items need primaries context
}

Secondary {
  ref_value: length_of "../primaries[corresponding<Primary>].primary_value"
  //                    ^^^^^^^^^^^ Can't find primaries in context
}
```

**Investigation needed:**
- The issue is that `extendedContext_secondaries` only knows about secondaries, not primaries
- Need to preserve parent-level fields (like primaries, secondaries) when extending context for nested types
- Check `generateNestedTypeContextExtension()` - may need to preserve more parent context
- The `context.parents` array should have the parent struct with all its fields

**Potential solution:**
When extending context for a nested type inside an array, preserve ALL parent fields, not just the immediate parent field reference.

### Category 5: Error Message Validation (~4 tests)
**Symptom:** `Error was thrown but message doesn't match expected`

**Affected tests:**
- `context_error_missing_parent_field`
- `context_error_type_mismatch_corresponding`
- `context_error_missing_array_context`
- `context_error_too_many_parent_levels`

**Root cause:** Error messages in generated code don't match test expectations.

**Investigation:** These are likely easy fixes - just need to check what error message is expected vs. what's generated.

**How to debug:**
```bash
DEBUG_TEST=1 npm test -- --filter=context_error_missing_parent_field
# Look at the actual error message vs expected
```

### Category 6: Array Index Validation (~1 test)
**Symptom:** `Expected encode to throw an error, but it succeeded`

**Affected test:**
- `context_error_array_index_out_of_bounds`

**Investigation needed:**
- Should validate that `corresponding` doesn't access array indices that don't exist
- Add bounds checking in computed field generation

## Code Structure Reference

### Key Files for Fixes

1. **src/generators/typescript.ts** (main generator)
   - `generateTypeCode()` - Entry point for type generation
   - `generateEncoder()` - Encoder class generation
   - `generateEncodeFieldCoreImpl()` - Core field encoding logic (MODIFIED)
   - `generateEncodeChoice()` - Choice type encoding (MODIFIED)
   - `generateEncodeTypeReference()` - Nested type encoding (MODIFIED)

2. **src/generators/typescript/context-extension.ts**
   - `generateArrayContextExtension()` - Array iteration context
   - `generateNestedTypeContextExtension()` - Nested type context (MODIFIED)
   - `getContextParam()` - Context parameter helper (MODIFIED)
   - `getContextVarName()` - Get field-specific context var name

3. **src/generators/typescript/array-support.ts**
   - `generateEncodeArray()` - Array encoding (MODIFIED)
   - Position tracking code (~lines 100-200)
   - Choice array encoding

4. **src/generators/typescript/computed-fields.ts**
   - `generateEncodeComputedField()` - Computed field generation
   - `resolveComputedFieldPath()` - Path resolution for ../
   - `detectCorrespondingTracking()` - Corresponding selector detection
   - `detectFirstLastTracking()` - First/last selector detection

5. **src/generators/typescript/context-analysis.ts**
   - `schemaRequiresContext()` - Check if context threading needed
   - `generateContextInterface()` - EncodingContext type definition

## Testing Tips

### Run specific test
```bash
npm test -- --filter=test_name
```

### Debug test with verbose output
```bash
DEBUG_TEST=1 npm test -- --filter=test_name
```

### Show only failures
```bash
npm test -- --failures
```

### Summary only
```bash
npm test -- --summary
```

### Check progress
```bash
npm test -- --summary 2>&1 | tail -5
# Should show: "258 test suites, 0 schema errors, 0 generation errors, X execution failures"
```

## Architecture Notes

### Context Threading System
The context system passes information down through nested encoders:

```typescript
interface EncodingContext {
  parents: Array<{[fieldName: string]: any}>;  // Parent field values
  arrayIterations: {                            // Array iteration state
    [arrayFieldName: string]: {
      items: any[];
      index: number;
      fieldName: string;
      typeIndices: Map<string, number>;  // For choice arrays
    }
  };
  positions: Map<string, number[]>;  // Position tracking for first/last
}
```

**Key principles:**
1. Each array field gets its own context variable: `extendedContext_<fieldName>`
2. Nested types extend the current context, not the base context
3. Context is immutable - each extension creates a new object
4. The `positions` Map is shared (not copied) for performance

### Computed Fields
Computed fields are calculated during encoding and NOT stored in the input value:

```typescript
// Input value does NOT include computed fields
const value = { body: [1,2,3] };

// During encoding, computed field is calculated
const header_size = value.body.length;  // Must access via context
```

**Path resolution:**
- `./field` - Same level field
- `../field` - Parent field (from context.parents)
- `../../field` - Grandparent field
- `array[first<Type>]` - First occurrence of Type in array
- `array[last<Type>]` - Last occurrence of Type in array
- `array[corresponding<Type>]` - Same index as current item in sibling array

## Next Steps (Priority Order)

1. **Fix remaining extendedContext errors** (7 tests, easiest)
   - Search and replace hardcoded `extendedContext` in first/last tracking code
   - Should be similar to the choice array fix we already did

2. **Fix error message validation** (4 tests, easy)
   - Debug each failing test to see actual vs expected error message
   - Update error message strings in generated code

3. **Fix parent field references** (17 tests, medium difficulty)
   - Debug `resolveComputedFieldPath()` to understand parent lookup
   - Ensure context.parents is being populated correctly
   - Fix path resolution to find `../field` references

4. **Fix sum-of-type-sizes** (6 tests, medium difficulty)
   - Review size computation logic in computed-fields.ts
   - Check if pre-pass is correctly measuring variable-length types
   - Verify string encoding happens before length calculation

5. **Fix corresponding correlation** (5 tests, hard)
   - Requires preserving sibling array context
   - May need architectural changes to context structure
   - Consider preserving ALL parent fields in nested type context

6. **Fix array bounds validation** (1 test, easy)
   - Add bounds checking for array access in computed fields

## Debugging Workflow

1. **Identify test category** - Use this doc to understand the pattern
2. **Run with DEBUG_TEST=1** - See actual error and generated code
3. **Check generated code** - Look in `.generated/` directory
4. **Find generator code** - Use grep to find where code is generated
5. **Make targeted fix** - Minimal changes to fix specific issue
6. **Test fix** - Run test again
7. **Check for regressions** - Run full test suite

## Git Commit

When ready to commit these changes:

```bash
git add src/generators/typescript.ts
git add src/generators/typescript/context-extension.ts
git add src/generators/typescript/array-support.ts
git commit -m "fix(codegen): thread context variable names through choice arrays

- Fix extendedContext undefined errors in choice array encoding
- Add contextVarName parameter threading through encode pipeline
- Fix nested type context to inherit array-extended context
- Remove unused legacy-monolith.ts (2,737 lines)

Fixes 12 tests (53 → 41 failing tests)
"
```
