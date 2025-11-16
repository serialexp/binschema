# Same Index Correlation in Standalone Encoders - Issue & Solutions

## 🎯 Quick Summary for Next Session

**What We Built:** Generic context threading system for encoders/decoders to access parent state and array iteration info.

**What Works:** ✅ Context passing, interface generation, array iteration tracking, parent field access

**What's Blocked:** ❌ `corresponding<Type>` correlation - needs per-type occurrence counters, not just array index

**Naming Decision:** Renamed `same_index<Type>` → `corresponding<Type>` for clarity (see discussion below)

**Next Task:** Add `typeIndices: Map<string, number>` to context to track "Nth DataBlock" vs "Nth MetaBlock"

**Files to Modify:** See "Next Steps" section below for detailed 5-step plan.

---

## Current Status (Context Threading Implementation)

**Implementation Status:** Phases 1-4 complete, Phase 5 in progress (80% done)

**Completed:**
1. ✅ Phase 1: Schema analysis for context requirements (`src/generators/typescript/context-analysis.ts`)
2. ✅ Phase 2: Context interface generation (creates `EncodingContext` with proper types)
3. ✅ Phase 3: Encoder signatures accept optional context parameter
4. ✅ Phase 4: Context extension code for arrays and nested types (`src/generators/typescript/context-extension.ts`)
5. ✅ Phase 5 (partial): Updated computed field path resolution to use context

**Blocking Issue Discovered:**
`same_index<Type>` semantics are more complex than initially understood, and the name is misleading.

### What `same_index<Type>` Actually Means

**NOT**: Element at same array index
**IS**: Nth occurrence of Type A references Nth occurrence of Type B

Example from ZIP format:
```javascript
sections = [
  LocalFile #0,    // array[0] - 1st LocalFile
  LocalFile #1,    // array[1] - 2nd LocalFile
  CentralDir #0,   // array[2] - 1st CentralDir <- references LocalFile #0 at array[0]
  CentralDir #1,   // array[3] - 2nd CentralDir <- references LocalFile #1 at array[1]
]
```

Conceptually, it's like having two parallel arrays filtered by type:
```javascript
local_files = [LocalFile #0, LocalFile #1]       // indices in LocalFile subsequence
central_dirs = [CentralDir #0, CentralDir #1]    // indices in CentralDir subsequence
```

Where `central_dirs[i]` references `local_files[i]`, but both are interleaved in one heterogeneous array.

### Naming Decision: `same_index` → `corresponding`

**Renamed to `corresponding<Type>`** for clarity:
- ✅ Semantic: "CentralDir references the corresponding LocalFile"
- ✅ No mention of "index" which is ambiguous
- ✅ Makes it clear this is about pairing/correlation
- ✅ Only makes sense in heterogeneous (choice) arrays

**Syntax:**
```javascript
{
  name: "crc32",
  computed: {
    type: "crc32_of",
    target: "../sections[corresponding<LocalFile>].body"
  }
}
```

This requires **per-type occurrence counters**, not just array index.

### Future Investigation: `nth<Type, N>` Selector

**Question:** Would an explicit index selector like `nth<Type, N>` ever be useful?

Example syntax: `../sections[nth<LocalFile, 2>]` (get the 3rd LocalFile, zero-indexed)

**Analysis:**
For this to work in sequential encoding/decoding, you'd need:
1. **Fixed schema** - know ahead of time there will be exactly N+1 of that type
2. **Two-pass encoding** - collect all elements first, then reference arbitrary positions
3. **Random access** - seekable stream (supported for decode but not encode)

**Conclusion:** Probably not useful for binary protocols. Typical patterns are:
- `first<Type>` - reference a header (already supported)
- `last<Type>` - reference a footer (already supported)
- `corresponding<Type>` - parallel sequences (what we're implementing)

Arbitrary positional references (`nth<Type, N>`) don't fit sequential encoding patterns. If you need fixed positions, you'd structure the schema differently.

**TODO:** Verify this assumption by researching real-world binary protocols. Document if any counter-examples exist.

---

**What Needs to Happen Next:** See "Next Steps" section below.

## The Problem

### Architecture Overview

BinSchema supports **same_index correlation** - a feature where one choice variant can reference data from another variant at the same array index. This is essential for ZIP format:

```javascript
// ZIP structure (simplified)
{
  sections: [
    { type: "LocalFile", body: [bytes...] },           // Index 0
    { type: "CentralDirEntry", /* references LocalFile at index 0 */ }
  ]
}
```

The `CentralDirEntry` has fields like:
- `crc32`: computed from `../sections[same_index<LocalFile>].body`
- `len_body_compressed`: length of `../sections[same_index<LocalFile>].body`

### Current Generator Behavior

The TypeScript generator creates **two kinds of encoders**:

1. **Standalone Encoders** - Classes like `CentralDirEntryEncoder`
   - Can be instantiated independently
   - Used for: type aliases, measuring sizes, standalone encoding
   - Problem: Has no array context, so `value_sections__iter` is undefined

2. **Inline Encoders** - Code within parent encoder's array loop
   - Has access to: `value_sections__iter`, correlation indices, position tracking
   - Works correctly for same_index references

### The Conflict

When generating code for `sum_of_type_sizes` (used to compute `len_central_dir` in EndOfCentralDir), the generator:

```typescript
// Generated code that fails:
const encoder_len_central_dir = new CentralDirEntryEncoder();
const encoded_len_central_dir = encoder_len_central_dir.encode(item);
```

But `CentralDirEntryEncoder.encode()` tries to access `value_sections__iter.type` which doesn't exist in standalone context:

```typescript
// In CentralDirEntryEncoder.encode():
const crc32_currentType = value_sections__iter.type; // ❌ ReferenceError
```

### Current Workaround

We added error messages for standalone encoders:
```typescript
if (iterSuffixPos < 0) {
  throw new Error("Field uses same_index correlation which requires encoding within an array context");
}
```

But this means standalone encoders fail at runtime when called.

## Relevant Files

- `src/generators/typescript/computed-fields.ts` (lines 325-362, 428-454) - same_index handling
- `src/generators/typescript.ts` (line 1784) - choice encoding, line 2048 - type reference encoding
- `src/tests/composite/zip-*.test.ts` - ZIP test suites
- `.generated/minimal_zip_single_file.ts` - Example of generated code with the issue

## Potential Solutions

### Option 1: Skip Standalone Encoder Generation for Inline-Only Types ⭐ RECOMMENDED

**Approach:** Detect types that use same_index/first/last and don't generate standalone encoder classes for them.

**Pros:**
- Clean solution - no unused code
- Forces correct usage (these types should only be used inline)
- No runtime errors

**Cons:**
- Need to detect which types use same_index correlation
- `sum_of_type_sizes` computation needs alternative approach

**Implementation:**
1. Add function to detect if a type uses same_index/first/last references:
   ```typescript
   function typeRequiresArrayContext(typeDef: TypeDef, schema: BinarySchema): boolean {
     // Check all computed fields for same_index/first/last patterns
   }
   ```

2. In `generateTypeScriptCode()`, skip standalone encoder generation:
   ```typescript
   if (!typeRequiresArrayContext(typeDef, schema)) {
     code += generateEncoder(typeName, typeDef, ...);
   }
   ```

3. For `sum_of_type_sizes`, generate inline size calculation instead of encoding-based measurement:
   ```typescript
   // Instead of: encoder.encode(item).length
   // Generate: computeTypeSize(item, schema, typeName)
   ```

### Option 2: Pass Context to Standalone Encoders

**Approach:** Make standalone encoders accept optional context parameter with correlation data.

**Pros:**
- Standalone encoders remain usable
- Backward compatible

**Cons:**
- Complex API - users must provide correlation indices
- Error-prone - easy to pass wrong context
- Doesn't solve the real issue (these types shouldn't be standalone)

**Implementation sketch:**
```typescript
class CentralDirEntryEncoder {
  encode(value: CentralDirEntry, context?: {
    correlationIndices: Map<string, number>,
    sourceArray: any[]
  }) {
    if (!context && usesCorrelation) {
      throw new Error("Context required for types using same_index");
    }
    // Use context.correlationIndices[currentType] instead of this._index_*
  }
}
```

### Option 3: Compute Sizes Without Encoding

**Approach:** Generate size calculation functions that don't require encoding.

**Pros:**
- More efficient (no actual encoding for size measurement)
- Avoids the standalone encoder issue

**Cons:**
- Need to maintain size calculation logic separately from encoding logic
- Complexity: variable-length fields (strings, arrays) still need actual encoding to measure

**Implementation:**
```typescript
function computeCentralDirEntrySize(value: CentralDirEntry, context): number {
  let size = 46; // Fixed header size
  size += new TextEncoder().encode(value.file_name).length;
  // ... etc
}
```

## Recommended Approach: Generic Context Threading ⭐

**Strategy:** Pass structured context through the entire encoder/decoder tree, enabling any encoder to access parent state, array iterations, or other contextual information needed for complex references.

### Design Principles

1. **Immutable Context**: Each encoder that needs to contribute information creates a new context object (correctness over optimization)
2. **Universal Threading**: All encoders accept context parameter (simplified API, even if some don't use it)
3. **Structured Schema**: Context shape is generated from schema analysis, providing compile-time safety
4. **Readable Generated Code**: Use descriptive variable names for debuggability (e.g., `localFileAtSameIndex` not `temp1`)
5. **Non-Exported Encoders**: Types requiring context exist internally but aren't exported to users

### Context Structure

The context interface is **generated per-schema** by analyzing which fields encoders need to reference:

```typescript
interface EncodingContext {
  // Stack of parent values for ../ navigation
  parents: Array<{
    sections?: ZipSection[];
    header?: ZipHeader;
    // ... fields that computed paths reference via ../
  }>;

  // Current array iterations (for same_index/first/last)
  arrayIterations: {
    sections?: {
      items: ZipSection[];
      index: number;
      fieldName: string;
    };
    // ... arrays referenced by same_index/first/last
  };
}
```

**Key insight:** We know at generation time exactly which parent fields and arrays will be referenced, so we can generate a strongly-typed context interface.

### Implementation Phases

#### Phase 1: Schema Analysis

Add detection functions to identify context requirements:

```typescript
// In src/generators/typescript/context-analysis.ts

interface ContextRequirements {
  needsParentFields: Set<string>;     // Fields referenced via ../field_name
  needsArrayIterations: Set<string>;   // Arrays referenced via same_index/first/last
  usesParentNavigation: boolean;       // Uses ../ at all
}

function analyzeContextRequirements(
  typeDef: TypeDef,
  schema: BinarySchema
): ContextRequirements {
  const requirements: ContextRequirements = {
    needsParentFields: new Set(),
    needsArrayIterations: new Set(),
    usesParentNavigation: false
  };

  // Walk all fields, looking for computed field targets
  for (const field of getTypeFields(typeDef)) {
    if (field.computed?.target) {
      const target = field.computed.target;

      // Parse path to identify:
      // - ../ parent references
      // - [same_index<Type>] / [first<Type>] / [last<Type>] array correlations
      // - field names being accessed

      if (target.startsWith('../')) {
        requirements.usesParentNavigation = true;
        const fieldMatch = target.match(/\.\.\/([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (fieldMatch) {
          requirements.needsParentFields.add(fieldMatch[1]);
        }
      }

      if (target.includes('[same_index<') ||
          target.includes('[first<') ||
          target.includes('[last<')) {
        const arrayMatch = target.match(/([a-zA-Z_][a-zA-Z0-9_]*)\[(?:same_index|first|last)</);
        if (arrayMatch) {
          requirements.needsArrayIterations.add(arrayMatch[1]);
        }
      }
    }
  }

  // Recursively analyze nested type references
  for (const field of getTypeFields(typeDef)) {
    if (field.type && schema.types[field.type]) {
      const nestedReqs = analyzeContextRequirements(
        schema.types[field.type],
        schema
      );
      // Merge requirements
      nestedReqs.needsParentFields.forEach(f => requirements.needsParentFields.add(f));
      nestedReqs.needsArrayIterations.forEach(a => requirements.needsArrayIterations.add(a));
      requirements.usesParentNavigation ||= nestedReqs.usesParentNavigation;
    }
  }

  return requirements;
}

function schemaRequiresContext(schema: BinarySchema): boolean {
  return Object.values(schema.types).some(typeDef => {
    const reqs = analyzeContextRequirements(typeDef, schema);
    return reqs.usesParentNavigation ||
           reqs.needsArrayIterations.size > 0;
  });
}
```

#### Phase 2: Context Type Generation

Generate the context interface at the top of the output file:

```typescript
// In src/generators/typescript.ts

function generateContextInterface(schema: BinarySchema): string {
  if (!schemaRequiresContext(schema)) {
    return ''; // No context needed for this schema
  }

  // Collect all referenced parent fields and arrays across all types
  const allParentFields = new Set<string>();
  const allArrayIterations = new Set<string>();

  for (const typeDef of Object.values(schema.types)) {
    const reqs = analyzeContextRequirements(typeDef, schema);
    reqs.needsParentFields.forEach(f => allParentFields.add(f));
    reqs.needsArrayIterations.forEach(a => allArrayIterations.add(a));
  }

  let code = 'interface EncodingContext {\n';

  // Parent fields stack
  if (allParentFields.size > 0) {
    code += '  parents: Array<{\n';
    for (const fieldName of allParentFields) {
      // Determine type from schema
      const fieldType = inferFieldType(fieldName, schema);
      code += `    ${fieldName}?: ${fieldType};\n`;
    }
    code += '  }>;\n';
  }

  // Array iterations
  if (allArrayIterations.size > 0) {
    code += '  arrayIterations: {\n';
    for (const arrayName of allArrayIterations) {
      const arrayType = inferArrayType(arrayName, schema);
      code += `    ${arrayName}?: {\n`;
      code += `      items: ${arrayType}[];\n`;
      code += `      index: number;\n`;
      code += `      fieldName: string;\n`;
      code += `    };\n`;
    }
    code += '  };\n';
  }

  code += '}\n\n';

  // Default empty context
  code += 'const EMPTY_CONTEXT: EncodingContext = {\n';
  if (allParentFields.size > 0) {
    code += '  parents: [],\n';
  }
  if (allArrayIterations.size > 0) {
    code += '  arrayIterations: {},\n';
  }
  code += '};\n\n';

  return code;
}
```

#### Phase 3: Update Encoder Signatures

All encoders accept optional context parameter:

```typescript
class ZipFileEncoder {
  encode(
    value: ZipFile,
    context: EncodingContext = EMPTY_CONTEXT
  ): Uint8Array {
    // ...
  }
}

class CentralDirEntryEncoder {
  encode(
    value: CentralDirEntry,
    context: EncodingContext = EMPTY_CONTEXT
  ): Uint8Array {
    // This encoder needs context, but signature is same as others
    // If context is empty and same_index is used, generate helpful error
  }
}
```

#### Phase 4: Generate Context Extension Code

When encoding nested types or arrays, extend context immutably:

```typescript
// Example: Encoding the "sections" array field
for (let i = 0; i < value.sections.length; i++) {
  const item = value.sections[i];

  // Extend context with current array iteration state
  const extendedContext: EncodingContext = {
    ...context,
    parents: [
      ...context.parents,
      { sections: value.sections }  // Add parent field reference
    ],
    arrayIterations: {
      ...context.arrayIterations,
      sections: {
        items: value.sections,
        index: i,
        fieldName: 'sections'
      }
    }
  };

  // Encode choice variant with extended context
  if (item.type === 'LocalFile') {
    const localFileEncoder = new LocalFileEncoder();
    const encoded = localFileEncoder.encode(item, extendedContext);
    encoder.writeBytes(encoded);
  } else if (item.type === 'CentralDirEntry') {
    const centralDirEncoder = new CentralDirEntryEncoder();
    const encoded = centralDirEncoder.encode(item, extendedContext);
    encoder.writeBytes(encoded);
  }
}
```

#### Phase 5: Update Path Resolution with Readable Names

When resolving computed field paths like `../sections[same_index<LocalFile>].body`:

```typescript
// In src/generators/typescript/computed-fields.ts

// Instead of:
const temp1 = context.arrayIterations.sections.items[context.arrayIterations.sections.index];

// Generate:
const sections_array = context.parents[0].sections;  // Navigate to parent's sections field
const currentIndex_sections = context.arrayIterations.sections?.index ?? -1;

if (currentIndex_sections < 0) {
  throw new Error(
    "Field 'crc32' uses same_index correlation on 'sections' which requires encoding within an array context. " +
    "This encoder was called standalone without proper context."
  );
}

// Find the LocalFile variant at the same index
const localFileAtSameIndex = sections_array[currentIndex_sections];

if (localFileAtSameIndex.type !== 'LocalFile') {
  throw new Error(
    `Expected LocalFile at sections[${currentIndex_sections}] but found ${localFileAtSameIndex.type}`
  );
}

const targetBody = localFileAtSameIndex.body;
const crc32_computed = computeCRC32(targetBody);
```

#### Phase 6: Export Policy

```typescript
// In src/generators/typescript.ts

function shouldExportEncoder(
  typeName: string,
  typeDef: TypeDef,
  schema: BinarySchema
): boolean {
  const reqs = analyzeContextRequirements(typeDef, schema);

  // Don't export encoders that require context
  // They'll still exist for internal use, but users can't import them
  if (reqs.usesParentNavigation || reqs.needsArrayIterations.size > 0) {
    return false;
  }

  return true;
}

// At the end of generated file:
let exports = 'export {\n';
for (const [typeName, typeDef] of Object.entries(schema.types)) {
  exports += `  ${typeName},\n`;
  exports += `  ${typeName}Decoder,\n`;

  if (shouldExportEncoder(typeName, typeDef, schema)) {
    exports += `  ${typeName}Encoder,\n`;
  }
  // else: encoder exists but isn't exported
}
exports += '};\n';
```

### Benefits of This Approach

1. **Generic & Extensible**: Works for any future feature that needs parent/array context, not just same_index
2. **Type-Safe**: Generated context interface provides compile-time checking
3. **Debuggable**: Readable variable names make generated code easy to troubleshoot
4. **Correct by Construction**: Schema analysis at generation time ensures context has exactly what's needed
5. **Simple API**: All encoders have same signature, just pass context through
6. **Safe Boundaries**: Types requiring context aren't exported, preventing misuse

### Solutions to Potential Issues

#### 1. Type Inference (SOLVED)

**Not actually a problem.** We have the full schema at generation time, so we can analyze the complete type graph to determine exactly what fields each encoder needs in context.

**Approach**: Build a call graph during schema analysis:
- Track which types contain which other types (parent-child relationships)
- When we see `../sections` in `CentralDirEntry` used within `Archive.sections`, we know:
  - Parent type: `Archive`
  - Field name: `sections`
  - Field type: `ZipSection[]` (from schema)
- Generate context interface with exact types needed

**No runtime inference required** - everything is known at code generation time.

#### 2. sum_of_type_sizes (SOLVED - Use Existing Two-Pass Pattern)

**Solution**: Reuse the existing two-pass encoding approach we already use for `position_of` tracking.

**Current system** (for position tracking):
- First pass: Encode elements, track byte positions
- Second pass: Encode with computed positions

**Extended system** (add size tracking):
- First pass: Encode elements, track both positions AND byte sizes
- When encoding `EndOfCentralDir.len_central_dir`, sum tracked sizes for all `CentralDirEntry` elements
- Second pass: Encode with computed sizes and positions

**Key insight**: We're already encoding once for position tracking. Just add size tracking to the same pass. No double encoding needed.

**Implementation**: Extend the existing position tracking map to include sizes:
```typescript
// Existing position tracking (already in generated code):
const _positions = new Map<string, number>();

// Add size tracking:
const _sizes = new Map<string, number>();

// During first pass array encoding:
for (let i = 0; i < value.sections.length; i++) {
  const item = value.sections[i];
  const encoded = /* ... encode item ... */;

  _positions.set(`sections[${i}]`, currentPosition);
  _sizes.set(`sections[${i}]`, encoded.length);  // Track size

  currentPosition += encoded.length;
}

// When computing sum_of_type_sizes for len_central_dir:
let len_central_dir_sum = 0;
for (let i = 0; i < value.sections.length; i++) {
  if (value.sections[i].type === 'CentralDirEntry') {
    len_central_dir_sum += _sizes.get(`sections[${i}]`) ?? 0;
  }
}
```

#### 3. Context Memory Growth (ACCEPTABLE - Minimal Impact)

**Analysis**:
- Context objects are only created when extending (adding parent or array iteration info)
- If an encoder doesn't extend context, it passes the same reference through
- Typical nesting depth: 5-10 levels max
- Each context frame: ~few hundred bytes (object overhead + references)
- Total memory per encoding: ~few KB even with deep nesting

**Trade-off**: A few KB of temporary allocations during encoding is negligible compared to the actual binary data being processed.

**Future optimization** (if needed): Use structural sharing library like Immer to automatically share unchanged parts of context between levels.

#### 4. Circular Type References (NEEDS IMPLEMENTATION)

**Solution**: Add visited set to schema analysis to detect and break cycles.

```typescript
function analyzeContextRequirements(
  typeDef: TypeDef,
  schema: BinarySchema,
  visitedTypes: Set<string> = new Set()
): ContextRequirements {
  const typeName = getTypeName(typeDef, schema);

  if (visitedTypes.has(typeName)) {
    // Already analyzing this type, return empty to break cycle
    return { needsParentFields: new Set(), needsArrayIterations: new Set(), usesParentNavigation: false };
  }

  visitedTypes.add(typeName);
  // ... rest of analysis with visitedTypes passed down ...
}
```

**Not a fundamental issue** - standard cycle detection pattern.

#### 5. Multiple Array Levels (DESIGN DECISION NEEDED)

**Question**: If we're iterating `groups[2].items[5]`, and `Item` references `../../groups[same_index<Group>]`, which index does `same_index` use?

**Answer**: Should use the `groups` iteration index (2), not the `items` index (5).

**Context structure when nested**:
```typescript
context = {
  parents: [
    { groups: [...] },   // Container's fields
    { items: [...] }     // Group's fields
  ],
  arrayIterations: {
    groups: { items: [...], index: 2, fieldName: 'groups' },
    items: { items: [...], index: 5, fieldName: 'items' }
  }
}
```

**Path resolution rules**:
1. `../` navigates up parent stack
2. `[same_index<Type>]` uses the index from the named array's iteration context
3. Multiple arrays tracked independently in `arrayIterations`

**Needs comprehensive test coverage** for nested arrays with cross-references.

#### 6. sum_of_type_sizes with Context (SOLVED - See #2)

Now that encoders accept context, `sum_of_type_sizes` can be implemented using the size tracking approach described in #2 above. No need to call encoders for measurement - just look up already-tracked sizes.

### Test Plan

```bash
# Context threading tests (33 test suites in src/tests/context-threading/)
npm test -- --filter=context_no_requirements          # ✅ Passing
npm test -- --filter=context_single_parent            # ✅ Passing
npm test -- --filter=context_same_index_single_array  # ❌ Failing (needs corresponding<Type> per-type counters)

# After completing implementation, verify all:
npm test -- --filter=context_

# ZIP tests (will work once context threading is complete):
npm test -- --filter=minimal_zip_single_file
npm test -- --filter=zip_style_aggregate_size
npm test -- --filter=multi_file_zip
```

## Next Steps (To Complete Context Threading)

### Step 0: Rename `same_index` to `corresponding` Throughout Codebase

**Before implementing per-type counters**, rename the selector for consistency:

1. **Schema validation** (`src/schema/binary-schema.ts`):
   - No changes needed - syntax is already `[same_index<Type>]` in target strings
   - Just a string pattern, parsed at generation time

2. **Code generation** (`src/generators/typescript/computed-fields.ts`):
   - Update `parseSameIndexTarget()` function name → `parseCorrespondingTarget()`
   - Update regex pattern: `\[same_index<` → `\[corresponding<`
   - Update comments and variable names

3. **Test files** (`src/tests/context-threading/`, `src/tests/composite/zip-*.test.ts`):
   - Update all schema definitions: `[same_index<Type>]` → `[corresponding<Type>]`
   - Update test names and descriptions for clarity

4. **Documentation**:
   - Already updated in this file
   - Update any other docs that reference `same_index`

### Immediate: Fix `corresponding<Type>` Per-Type Counters

**Problem:** Current implementation uses `context.arrayIterations.blocks.index` (array index), but `corresponding<Type>` needs per-type occurrence counters.

**Solution:** Extend context to track type-specific occurrence indices.

#### Step 1: Update Context Interface Generation

Modify `src/generators/typescript/context-analysis.ts`:

```typescript
interface EncodingContext {
  parents: Array<{
    sections?: ZipSection[];
  }>;
  arrayIterations: {
    sections?: {
      items: ZipSection[];
      index: number;                    // Overall array index
      fieldName: string;
      typeIndices: Map<string, number>; // NEW: Per-type occurrence counters
    };
  };
}
```

#### Step 2: Update Context Extension Code

Modify `src/generators/typescript/context-extension.ts` to initialize and maintain type counters:

```typescript
export function generateArrayContextExtension(
  fieldName: string,
  valuePath: string,
  itemVar: string,
  indexVar: string,
  indent: string,
  schema: BinarySchema,
  isChoiceArray: boolean,  // NEW parameter
  choiceTypes: string[]    // NEW parameter
): string {
  // ... existing code ...

  code += `${indent}    ${fieldName}: {\n`;
  code += `${indent}      items: ${valuePath},\n`;
  code += `${indent}      index: ${indexVar},\n`;
  code += `${indent}      fieldName: '${fieldName}',\n`;

  // NEW: Initialize type indices for choice arrays
  if (isChoiceArray) {
    code += `${indent}      typeIndices: (() => {\n`;
    code += `${indent}        const indices = new Map<string, number>();\n`;
    for (const typeName of choiceTypes) {
      code += `${indent}        indices.set('${typeName}', 0);\n`;
    }
    code += `${indent}        return indices;\n`;
    code += `${indent}      })()\n`;
  }

  code += `${indent}    }\n`;
}
```

#### Step 3: Update Array Encoding to Increment Type Counters

Modify `src/generators/typescript/array-support.ts` array loop:

```typescript
// After context extension, before encoding item:
if (field.items?.type === "choice") {
  code += `${indent}  // Increment type-specific occurrence counter\n`;
  code += `${indent}  const currentItemType = ${itemVar}.type;\n`;
  code += `${indent}  const currentTypeIndex = extendedContext.arrayIterations.${fieldName}.typeIndices.get(currentItemType) ?? 0;\n`;
  code += `${indent}  extendedContext.arrayIterations.${fieldName}.typeIndices.set(currentItemType, currentTypeIndex + 1);\n`;
}
```

#### Step 4: Update Computed Field Resolution

Modify `src/generators/typescript/computed-fields.ts` to use type-specific index:

```typescript
// OLD (current broken code):
const correlationIndex = extendedContext.arrayIterations.${arrayPath}?.index ?? -1;

// NEW (use per-type counter):
const ${fieldName}_currentType = ${itemVarPattern}.type;
const ${fieldName}_correlationIndex = extendedContext.arrayIterations.${arrayPath}?.typeIndices.get('${filterType}') ?? -1;
if (${fieldName}_correlationIndex < 0) {
  throw new Error("No ${filterType} found at same_index in ${arrayPath}");
}
// Subtract 1 because counter was incremented AFTER the item we want to reference
const ${fieldName}_actualIndex = ${fieldName}_correlationIndex - 1;
```

#### Step 5: Test Incrementally

1. Run `npm test -- --filter=context_same_index_single_array`
2. Verify MetaBlock #0 finds DataBlock #0, MetaBlock #1 finds DataBlock #1
3. Run full context threading test suite: `npm test -- --filter=context_`
4. Run ZIP tests: `npm test -- --filter=zip`

### After same_index Fix: Complete Remaining Phases

#### Phase 5 (Complete): Path Resolution

- ✅ `corresponding<Type>` - uses type counters (Step 4 above)
- ⚠️ `first<Type>`/`last<Type>` selectors - verify they work with context
- ⚠️ Parent field references (`../field`) - verify they use `context.parents`

#### Phase 6: Export Policy

Decide how to handle encoders that require context:
- Option A: Don't export them at all
- Option B: Export with runtime validation throwing helpful errors

Recommendation: **Option B** - export everything but throw clear errors if context missing.

#### Phase 7: Decoder Context

Decoders may also need context for validation. Evaluate if `EncodingContext` works for decoders or if we need separate `DecodingContext`.

### Files Modified So Far

- ✅ `src/generators/typescript/context-analysis.ts` - NEW: Schema analysis and context interface generation
- ✅ `src/generators/typescript/context-extension.ts` - NEW: Context extension code generation
- ✅ `src/generators/typescript.ts` - Encoder signatures, context param passing
- ✅ `src/generators/typescript/array-support.ts` - Array iteration with context extension
- ⚠️ `src/generators/typescript/computed-fields.ts` - PARTIAL: `corresponding<Type>` uses context (needs per-type counters)

### Files Needing Updates

- ⚠️ `src/generators/typescript/context-analysis.ts` - Add typeIndices to interface
- ⚠️ `src/generators/typescript/context-extension.ts` - Initialize typeIndices Map
- ⚠️ `src/generators/typescript/array-support.ts` - Increment typeIndices during iteration
- ⚠️ `src/generators/typescript/computed-fields.ts` - Use typeIndices for `corresponding<Type>` lookup

## Additional Notes

### Alternative: Runtime Size Tracking

Instead of re-encoding to measure sizes, track sizes during the first encoding pass:
- First loop: encode items and record their byte sizes
- Second loop: use recorded sizes for sum_of_type_sizes

This would be more efficient but requires refactoring the two-pass position tracking system.

### Why This Matters for ZIP

The ZIP format is a perfect test case for BinSchema's advanced features:
- Choice types (LocalFile vs CentralDirEntry vs EndOfCentralDir)
- Same-index correlation (CentralDir references LocalFile at same index)
- Computed positions (CentralDir.ofs_local_header points to LocalFile)
- Computed sizes (EndOfCentralDir.len_central_dir sums all CentralDir sizes)

Getting this right proves BinSchema can handle real-world binary formats with complex cross-references.

---

## Summary for Next Session

### Progress Made
- ✅ Built generic context threading infrastructure (Phases 1-4)
- ✅ 80% of Phase 5 complete (path resolution using context)
- ✅ Discovered and documented `corresponding<Type>` semantics
- ✅ Comprehensive test suite ready (33 test suites in `src/tests/context-threading/`)

### Blocking Issue
The `corresponding<Type>` selector (formerly `same_index<Type>`) needs per-type occurrence counters to track "Nth DataBlock" vs "Nth MetaBlock" in heterogeneous arrays.

### What to Do Next
1. **Rename** `same_index` → `corresponding` throughout codebase (Step 0 above)
2. **Implement** per-type counters in context (Steps 1-5 above)
3. **Test** with `npm test -- --filter=context_`
4. **Complete** remaining phases (verify first/last, export policy)

### Key Files
- `src/generators/typescript/context-analysis.ts` - Context interface generation
- `src/generators/typescript/context-extension.ts` - Context extension helpers
- `src/generators/typescript/computed-fields.ts` - Path resolution (needs type counter fix)
- `src/generators/typescript/array-support.ts` - Array iteration (needs counter increment)
- `docs/SAME_INDEX_STANDALONE_ENCODER_ISSUE.md` - This file (complete documentation)
