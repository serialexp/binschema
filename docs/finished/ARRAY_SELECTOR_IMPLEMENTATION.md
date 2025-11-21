# Array Selector Implementation Plan

Date: 2025-11-12
Status: In Progress

## Overview

Array selectors (`first<Type>`, `last<Type>`, `same_index<Type>`) are used in `position_of` computed fields to reference specific elements in heterogeneous arrays. Critical for ZIP file format support.

## Current Status

- ✅ Parser functions added: `parseFirstLastTarget()`, `parseSameIndexTarget()`
- ✅ Detection functions added: `detectFirstLastTracking()`, `detectSameIndexTracking()`
- ✅ Encoding logic added for first/last lookup in `computed-fields.ts`
- ❌ Position tracking infrastructure NOT implemented in array encoding
- ❌ Encoder class doesn't initialize `_positions_*` tracking arrays
- ❌ Array encoding doesn't record positions as it encodes items

## Required Implementation

### 1. Initialize Position Tracking Arrays

When encoding a struct that contains arrays with first/last/same_index selectors:

```typescript
export class MyEncoder extends BitStreamEncoder {
  // Add position tracking arrays
  private _positions_items_Item: number[] = [];
  // ...
}
```

### 2. Track Positions During Array Encoding

When encoding an array field named `items` containing `Item` types:

```typescript
// Before encoding the array
const startPos_items = this.byteOffset;

for (let i = 0; i < value.items.length; i++) {
  const item = value.items[i];

  // Track position BEFORE encoding this item
  if (item.type === 'Item') {  // For choice/discriminated unions
    this._positions_items_Item.push(this.byteOffset);
  }

  // Encode the item
  // ...
}
```

### 3. Handle Empty Arrays

When array is empty, first/last selectors return `0xFFFFFFFF`:

```typescript
const first_item_computed = this._positions_items_Item.length > 0
  ? this._positions_items_Item[0]
  : 0xFFFFFFFF;
```

## Test Cases

### empty_array_correlation
- **Target**: `../items[first<Item>]`
- **Array**: `items` (empty, length=0)
- **Expected**: `0xFFFFFFFF` (not found marker)
- **Actual**: `4` (falls through to offset calculation)

### last_element_position
- **Target**: `../chunks[last<DataChunk>]`
- **Array**: `chunks` with 3 DataChunk elements
- **Expected**: Position of 3rd chunk (position 6)
- **Actual**: Wrong offset calculation

### first_element_position
- **Target**: `../sections[first<FileData>]`
- **Array**: Mixed Directory and FileData
- **Expected**: Position of first FileData (position 5)
- **Actual**: Not implemented

## Implementation Steps

1. ✅ Add parser functions for selectors
2. ✅ Add detection functions to identify which arrays need tracking
3. ✅ Add encoding logic to lookup positions
4. ❌ **Modify encoder class generation to add `_positions_*` fields**
5. ❌ **Modify array encoding to record positions**
6. ❌ Handle choice/discriminated union item types
7. ❌ Add tests for edge cases (empty arrays, multiple types)

## Files to Modify

- `src/generators/typescript/computed-fields.ts` - ✅ Selector parsing done
- `src/generators/typescript/legacy-monolith.ts` - ❌ Need to add position tracking infrastructure
  - Function `generateEncoderClass()` - Add `_positions_*` field declarations
  - Function `generateFunctionalEncodeArray()` or inline array encoding - Add position recording

## Related Tests

- `src/tests/cross-struct/array-correlation.test.ts` - All selector tests
- 14 failing tests total, most depend on this feature

## Notes

- Position tracking only needed for arrays referenced by position_of with selectors
- Same infrastructure works for `first`, `last`, and `same_index`
- `same_index` also needs correlation index counters (`_index_arrayname_TypeName`)
