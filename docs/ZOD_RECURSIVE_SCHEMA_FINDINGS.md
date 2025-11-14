# Zod 4 Recursive Schema Findings

Date: 2025-11-12
Issue: Test export stripping array `items`, `kind`, `length` fields

## Problem

When exporting test schemas to JSON, array fields were missing their `items`, `kind`, and `length` properties. This caused schema validation to fail when running tests.

## Root Cause

Zod 4 handles recursive schemas using **getters**, not `z.lazy()`. When a schema contains getters:

```typescript
const ArrayFieldSchema = z.object({
  name: z.string(),
  type: z.literal("array"),
  get items() {
    return ElementTypeSchema; // Recursive reference
  },
  // ...
});
```

The getter works fine for parsing/validation, but when the schema object is serialized:
- `JSON.stringify()` ignores getters
- `JSON5.stringify()` ignores getters
- `schema.parse(data)` returns a plain object without getters

## Zod 4 Pattern (Correct)

From `/home/bart/Projects/zod/packages/zod/src/v4/mini/tests/recursive-types.test.ts`:

```typescript
const Category = z.object({
  name: z.string(),
  get subcategories(): z.ZodMiniOptional<z.ZodMiniArray<typeof Category>> {
    return z.optional(z.array(Category));
  },
});
```

**Key insight**: Use `get propertyName()` to define recursive properties. This works for validation but NOT for serialization.

## Why z.lazy() Doesn't Work

`z.lazy()` was attempted but fails because:
1. It creates a lazy-evaluated schema wrapper
2. When Zod serializes the object, it doesn't evaluate lazy wrappers into the output
3. The resulting object still lacks the property

## Solution Options

### Option 1: Don't serialize through Zod (RECOMMENDED)
Instead of:
```typescript
export function defineTestSuite(suite: TestSuite): TestSuite {
  return TestSuiteSchema.parse(suite); // This strips getters!
}
```

Do:
```typescript
export function defineTestSuite(suite: TestSuite): TestSuite {
  TestSuiteSchema.parse(suite); // Validate
  return suite; // Return original with getters intact
}
```

### Option 2: Custom serialization
Manually walk the schema and evaluate getters before serialization.

### Option 3: Don't use getters in test schemas
Define test schemas as plain objects without recursive types, but this breaks type safety.

## Implementation

We need to modify `defineTestSuite()` in `src/schema/test-schema.ts` to validate but return the original object, preserving getters.

## Related Files

- `/home/bart/Projects/binschema/src/schema/binary-schema.ts` - ArrayFieldSchema definition (line 1118)
- `/home/bart/Projects/binschema/src/schema/test-schema.ts` - defineTestSuite function (line 113)
- `/home/bart/Projects/binschema/src/run-tests.ts` - Test export logic (line 42)
- `/home/bart/Projects/zod/packages/zod/src/v4/mini/tests/recursive-types.test.ts` - Zod 4 reference examples

## Lessons Learned

1. **Zod 4 uses getters for recursion**, not `z.lazy()`
2. **Getters don't survive serialization** - they're not enumerable properties
3. **Validate but don't transform** - use `.parse()` for validation, but return the original object if you need to preserve structure
4. **Test your assumptions** - check the Zod source code when patterns aren't working as expected
