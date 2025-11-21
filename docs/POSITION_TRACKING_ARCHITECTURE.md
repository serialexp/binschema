# Position Tracking Architecture

## Overview

BinSchema supports tracking byte positions of array elements for use in computed fields like `position_of`, `length_of`, and aggregate size calculations. Position tracking is essential for random-access binary formats like ZIP archives.

## Core Concepts

### Position Tracking Types

Position tracking happens in two contexts:

1. **Pre-pass Position Tracking** (for `first<Type>`, `last<Type>`, and `position_of` + `corresponding<Type>`)
   - Runs BEFORE main encoding loop
   - Calculates positions by encoding items to temporary encoders to measure size
   - Stores positions in `context.positions` Map
   - Required when positions must be known BEFORE encoding

2. **Inline Position Tracking** (for `length_of` + `corresponding<Type>`)
   - Runs DURING main encoding loop
   - Tracks positions using `this.byteOffset`
   - Used when only the current value is needed, not positions

### Type Occurrence Counting

For choice arrays, we track how many times each type has appeared:
- `context.arrayIterations.{arrayName}.typeIndices` - Map of type → occurrence count
- Used for `corresponding<Type>` correlation to match "Nth occurrence of TypeA with Nth occurrence of TypeB"
- **CRITICAL**: Must be reset between pre-pass and main encoding loop to avoid double-counting

## Choice Array Encoding

### No External Discriminator

BinSchema choice types do NOT add an external discriminator byte:
```typescript
// WRONG (what some binary formats do):
[discriminator_byte, type_specific_data...]

// CORRECT (BinSchema approach):
[type_tag_field, other_fields...]  // type_tag IS the discriminator
```

### Why No External Discriminator?

1. **Format Compatibility** - Real-world formats like ZIP don't use wrapper discriminators
2. **No Duplication** - The `type_tag` field (marked with `const`) already identifies the type
3. **Zero Overhead** - No extra bytes beyond what the format requires

### Position Calculation Example

```typescript
// Schema
LocalFile: type_tag(1 byte) + file_id(2 bytes) + body(3 bytes) = 6 bytes
CentralDir: type_tag(1 byte) + offset(4 bytes) + size(2 bytes) = 7 bytes

// Array: [LocalFile, LocalFile, CentralDir]
// Positions:
sections[0]: position 0, size 6  → ends at byte 5
sections[1]: position 6, size 6  → ends at byte 11
sections[2]: position 12, size 7 → ends at byte 18
```

## Corresponding Correlation

### Two Semantic Modes

`corresponding<Type>` has different behavior depending on array context:

#### 1. Same-Array Type Correlation
```typescript
// Within a choice array referencing same array
"../blocks[corresponding<DataBlock>].field"
```
- Uses type-occurrence counting
- "I'm the Nth MetaBlock, find the Nth DataBlock"
- Both types are in the same array

#### 2. Cross-Array Index Correlation
```typescript
// From one array referencing a sibling array
"../primaries[corresponding<Primary>].field"  // from secondaries array
```
- Uses array index matching
- "I'm at secondaries[2], find primaries[2]"
- Types are in different arrays

### Detection Logic

```typescript
const isSameArrayCorrelation =
  currentItemType !== undefined &&
  context.arrayIterations.{targetArray}.typeIndices.has(currentItemType);
```

If the current item's type is tracked in the target array's typeIndices, it's same-array correlation. Otherwise, it's cross-array correlation.

## TypeIndices Lifecycle

### Initialization
```typescript
const value_sections_typeIndices = new Map<string, number>();
value_sections_typeIndices.set('LocalFile', 0);
value_sections_typeIndices.set('CentralDir', 0);
```

### Pre-Pass Loop
```typescript
for (let i = 0; i < array.length; i++) {
  // Increment counter
  const currentType = item.type;
  const currentIndex = typeIndices.get(currentType) ?? 0;
  typeIndices.set(currentType, currentIndex + 1);

  // Track positions if needed
  if (needsPrePassTracking(currentType)) {
    positions.get('array_' + currentType).push(currentOffset);
  }

  // Measure size by encoding to temp encoder
  const tempEncoder = new TypeEncoder();
  const tempBytes = tempEncoder.encode(item, context);
  currentOffset += tempBytes.length;
}
```

### **CRITICAL: Reset Between Passes**
```typescript
// Reset type indices after pre-pass, before main loop
typeIndices.set('LocalFile', 0);
typeIndices.set('CentralDir', 0);
```

**Why?** The pre-pass increments indices to track positions. The main loop must start fresh to provide correct occurrence counts during encoding.

### Main Encoding Loop
```typescript
for (let i = 0; i < array.length; i++) {
  // Extend context with current index
  const extendedContext = { ...context, arrayIterations: { ... } };

  // Increment counter (starting from 0 again after reset)
  const currentType = item.type;
  const currentIndex = typeIndices.get(currentType) ?? 0;
  typeIndices.set(currentType, currentIndex + 1);

  // Encode item
  const encoder = new TypeEncoder();
  const bytes = encoder.encode(item, extendedContext);
  writeBytes(bytes);
}
```

## Position Tracking Decision Tree

```
Does field use corresponding<Type>?
  ├─ YES: Is it position_of?
  │   ├─ YES → Track in PRE-PASS (need positions before encoding)
  │   └─ NO (length_of/sum_of) → Track INLINE during main loop
  │
  └─ NO: Is it first<Type> or last<Type>?
      └─ YES → Track in PRE-PASS
```

## Common Pitfalls

### ❌ Double Position Tracking
```typescript
// WRONG: Tracking in both pre-pass AND main loop
// Pre-pass
positions.push(prepassOffset);
// Main loop
positions.push(this.byteOffset); // Duplicate!
```

**Fix**: Only track `corresponding` types in pre-pass if used with `position_of`. Otherwise only in main loop.

### ❌ Forgetting TypeIndices Reset
```typescript
// WRONG: No reset between passes
prePass();  // Increments indices to [2, 2, 1]
mainLoop(); // Starts from [2, 2, 1] instead of [0, 0, 0]
```

**Fix**: Always reset typeIndices after pre-pass completes.

### ❌ Wrong Position Calculation
```typescript
// WRONG: Assuming extra discriminator byte exists
position = 7;  // Expecting: [6 bytes LocalFile] + [1 discriminator] = 7

// CORRECT: No discriminator, positions are sequential
position = 6;  // Reality: [6 bytes LocalFile] → next starts at 6
```

**Fix**: Calculate positions based on actual encoded sizes, no extra bytes.

## Testing Position Tracking

When writing tests with `position_of`:

1. **Manually calculate positions** by summing field sizes
2. **Count each field's bytes**: uint8=1, uint16=2, uint32=4, array=length×itemSize
3. **Don't add phantom bytes** for discriminators
4. **Verify with hex dumps** of expected output

### Example Test Verification

```typescript
// LocalFile: type_tag(1) + file_id(2) + body(3) = 6 bytes
// Expected positions:
sections[0]: starts at 0  (6 bytes) → ends at 5
sections[1]: starts at 6  (6 bytes) → ends at 11
sections[2]: starts at 12 (7 bytes) → ends at 18

// NOT:
sections[1]: starts at 7  ❌ (off by 1 error)
```

## Implementation Files

- `src/generators/typescript/array-support.ts` - Pre-pass and inline position tracking
- `src/generators/typescript/computed-fields.ts` - Position lookups for position_of/length_of
- `src/generators/typescript/context-extension.ts` - Context threading for arrays
- `src/generators/typescript/context-analysis.ts` - Detect when context is needed

## Future Improvements

1. **Type-safe position tracking** - Ensure positions Map keys match expected format
2. **Validation** - Detect conflicting position tracking requirements at schema validation time
3. **Optimize** - Skip pre-pass when no position_of/first/last fields exist
4. **Document** - Add inline comments explaining why each tracking mode is chosen
