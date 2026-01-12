// ABOUTME: Generates Go encoder/decoder code from BinSchema definitions
// ABOUTME: Produces byte-for-byte compatible code with TypeScript runtime

import type { BinarySchema, Field, Endianness } from "../schema/binary-schema.js";

/**
 * Get all field names for a type (only for struct types with sequence)
 */
function getTypeFieldNames(typeName: string, schema: BinarySchema): Set<string> {
  const fieldNames = new Set<string>();
  const typeDef = schema.types[typeName];
  if (!typeDef) return fieldNames;

  if ("sequence" in typeDef) {
    for (const field of typeDef.sequence) {
      fieldNames.add(field.name);
    }
  }
  return fieldNames;
}

/**
 * Check if a type has field_referenced arrays with length fields not present in the type itself.
 * Such types need context passing to access parent fields.
 */
function typeNeedsContext(typeName: string, schema: BinarySchema): boolean {
  const typeDef = schema.types[typeName];
  if (!typeDef) return false;

  if (!("sequence" in typeDef)) return false;

  const localFields = getTypeFieldNames(typeName, schema);

  for (const field of typeDef.sequence) {
    if (field.type === "array" && (field as any).kind === "field_referenced") {
      const lengthField = (field as any).length_field;
      if (lengthField && !localFields.has(lengthField)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get all types that need context (have external field references)
 */
function getTypesNeedingContext(schema: BinarySchema): Set<string> {
  const result = new Set<string>();
  for (const typeName of Object.keys(schema.types)) {
    if (typeNeedsContext(typeName, schema)) {
      result.add(typeName);
    }
  }
  return result;
}

/**
 * Check if any type in the schema has computed fields with parent references (../)
 * that require the reflect package (length_of/count_of use reflect for the default slice case,
 * sum_of_sizes and sum_of_type_sizes always use reflect)
 * This is used to determine if we need to import the reflect package
 */
function hasParentReferenceComputedFields(schema: BinarySchema): boolean {
  for (const typeDef of Object.values(schema.types)) {
    if (!("sequence" in typeDef)) continue;

    for (const field of typeDef.sequence) {
      const fieldAny = field as any;
      const computed = fieldAny.computed;
      if (!computed) continue;

      // sum_of_sizes and sum_of_type_sizes always use reflect
      if (computed.type === "sum_of_sizes" || computed.type === "sum_of_type_sizes") {
        return true;
      }

      if (!computed?.target?.startsWith("../")) continue;

      // length_of and count_of require reflect for the default slice case
      if (computed.type === "length_of" || computed.type === "count_of") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Options for Go code generation
 */
export interface GoGeneratorOptions {
  packageName?: string; // default: "main"
  runtimeImport?: string; // default: "github.com/anthropics/binschema/runtime"
}

/**
 * Generated Go code result
 */
export interface GeneratedGoCode {
  code: string;
  typeName: string;
}

/**
 * Parse a parent reference path like "../field" or "../../field"
 * Returns the number of levels up and the field name
 */
function parseParentPath(target: string): { levelsUp: number; fieldName: string } | null {
  if (!target.startsWith("../")) {
    return null;
  }

  let levelsUp = 0;
  let remaining = target;
  while (remaining.startsWith("../")) {
    levelsUp++;
    remaining = remaining.slice(3);
  }

  return { levelsUp, fieldName: remaining };
}

/**
 * Parse a first/last selector pattern like "../sections[first<FileData>]"
 * Returns the array path, filter type, and selector type
 */
function parseFirstLastTarget(target: string): { levelsUp: number; arrayPath: string; filterType: string; selector: "first" | "last" } | null {
  // Match patterns like ../sections[first<FileData>] or ../../items[last<Header>]
  const match = target.match(/^((?:\.\.\/)+)([^\[]+)\[(first|last)<(\w+)>\]$/);
  if (!match) return null;

  const parentPart = match[1];
  let levelsUp = 0;
  for (let i = 0; i < parentPart.length; i += 3) {
    if (parentPart.slice(i, i + 3) === "../") levelsUp++;
  }

  return {
    levelsUp,
    arrayPath: match[2],
    filterType: match[4],
    selector: match[3] as "first" | "last"
  };
}

/**
 * Parse a corresponding selector pattern like "../sections[corresponding<FileData>]"
 * or "../sections[corresponding<FileData>].payload" (with remaining field access)
 * Returns the array path, filter type, and any remaining path after the selector
 */
function parseCorrespondingTarget(target: string): { levelsUp: number; arrayPath: string; filterType: string; remainingPath: string } | null {
  // Match patterns like ../sections[corresponding<FileData>] or ../blocks[corresponding<DataBlock>].payload
  const match = target.match(/^((?:\.\.\/)+)([^\[]+)\[corresponding<(\w+)>\](\..*)?$/);
  if (!match) return null;

  const parentPart = match[1];
  let levelsUp = 0;
  for (let i = 0; i < parentPart.length; i += 3) {
    if (parentPart.slice(i, i + 3) === "../") levelsUp++;
  }

  return {
    levelsUp,
    arrayPath: match[2],
    filterType: match[3],
    remainingPath: match[4] || "" // e.g., ".payload" or ""
  };
}

/**
 * Detect which arrays in the schema need position tracking for first/last selectors
 * Returns a map of array field names to the set of types that need tracking
 */
function detectArraysNeedingPositionTracking(schema: BinarySchema): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  // Scan all type definitions for position_of fields with first/last selectors
  for (const typeName in schema.types) {
    const typeDef = schema.types[typeName];
    if (!("sequence" in typeDef)) continue;

    for (const field of typeDef.sequence) {
      const fieldAny = field as any;
      if (fieldAny.computed?.type !== "position_of") continue;

      const target = fieldAny.computed.target;
      if (!target) continue;

      const firstLastInfo = parseFirstLastTarget(target);
      if (firstLastInfo) {
        const existing = result.get(firstLastInfo.arrayPath) || new Set<string>();
        existing.add(firstLastInfo.filterType);
        result.set(firstLastInfo.arrayPath, existing);
      }

      const correspondingInfo = parseCorrespondingTarget(target);
      if (correspondingInfo) {
        const existing = result.get(correspondingInfo.arrayPath) || new Set<string>();
        existing.add(correspondingInfo.filterType);
        result.set(correspondingInfo.arrayPath, existing);
      }
    }
  }

  return result;
}

/**
 * Detect which arrays need corresponding<Type> tracking (not first/last).
 * These arrays need type occurrence indices tracked during encoding.
 * Returns a map of array field names to the set of target types used in corresponding<> selectors.
 */
function detectArraysNeedingCorrespondingTracking(schema: BinarySchema): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  // Scan all type definitions for computed fields using corresponding<Type>
  for (const typeName in schema.types) {
    const typeDef = schema.types[typeName];
    if (!("sequence" in typeDef)) continue;

    for (const field of typeDef.sequence) {
      const fieldAny = field as any;
      if (!fieldAny.computed) continue;

      const target = fieldAny.computed.target;
      if (!target) continue;

      const correspondingInfo = parseCorrespondingTarget(target);
      if (correspondingInfo) {
        const existing = result.get(correspondingInfo.arrayPath) || new Set<string>();
        existing.add(correspondingInfo.filterType);
        result.set(correspondingInfo.arrayPath, existing);
      }
    }
  }

  return result;
}

/**
 * Detect which types use corresponding selectors in their computed fields.
 * Returns a set of type names that need array iteration context when encoded.
 */
function detectTypesUsingCorrespondingSelectors(schema: BinarySchema): Set<string> {
  const result = new Set<string>();

  for (const typeName in schema.types) {
    const typeDef = schema.types[typeName];
    if (!("sequence" in typeDef)) continue;

    for (const field of typeDef.sequence) {
      const fieldAny = field as any;
      if (!fieldAny.computed) continue;

      const target = fieldAny.computed.target;
      if (!target) continue;

      const correspondingInfo = parseCorrespondingTarget(target);
      if (correspondingInfo) {
        result.add(typeName);
        break; // Only need to add once per type
      }
    }
  }

  return result;
}

/**
 * Get the static byte size of a field at code generation time.
 * Returns the size in bytes for fixed-size types, or 0 for variable-length types.
 */
function getStaticFieldSize(field: Field, schema?: BinarySchema): number {
  const fieldAny = field as any;
  const type = field.type;

  // Fixed-size primitive types
  const fixedSizes: Record<string, number> = {
    "uint8": 1, "int8": 1,
    "uint16": 2, "int16": 2,
    "uint32": 4, "int32": 4, "float32": 4,
    "uint64": 8, "int64": 8, "float64": 8,
  };

  if (fixedSizes[type]) {
    return fixedSizes[type];
  }

  // Bit fields - only handle when byte-aligned (8 bits = 1 byte)
  if (type === "bit" && fieldAny.size) {
    // Only count if it's a full byte, otherwise it's complex
    if (fieldAny.size === 8) return 1;
    if (fieldAny.size === 16) return 2;
    if (fieldAny.size === 32) return 4;
    if (fieldAny.size === 64) return 8;
    // Non-byte-aligned bits are complex - return 0
    return 0;
  }

  // Type references - look up in schema
  if (schema && schema.types[type]) {
    const typeDef = schema.types[type];
    if ("sequence" in typeDef) {
      let totalSize = 0;
      for (const f of typeDef.sequence) {
        const fieldSize = getStaticFieldSize(f, schema);
        if (fieldSize === 0) {
          // Variable-length field found - can't compute static size
          return 0;
        }
        totalSize += fieldSize;
      }
      return totalSize;
    }
  }

  // Variable-length types (strings, arrays, varlength, etc.)
  return 0;
}

/**
 * Generates a Go expression that computes the value for a computed field.
 * For parent references (../field), generates code that uses ctx.GetParentField().
 * The generated code is a multi-line block that must be inserted as statements,
 * with the result stored in a variable named after the field.
 *
 * @param computed - The computed field definition
 * @param fieldType - The type of the field (uint8, uint16, etc.)
 * @param indent - Current indentation level
 * @param fieldName - Name of the computed field (for variable naming)
 * @param containingFields - Optional array of all fields in the containing type
 * @param currentFieldIndex - Optional index of the current field in containingFields
 * @param schema - Optional schema for looking up type definitions
 * @returns Either a simple expression (no parent ref) or empty string if parent ref handled specially
 */
function generateComputedValue(
  computed: any,
  fieldType: string,
  indent: string,
  fieldName?: string,
  containingFields?: Field[],
  currentFieldIndex?: number,
  schema?: BinarySchema
): string {
  const computedType = computed.type;
  const target = computed.target;

  // Check for parent references (../)
  const parentRef = target ? parseParentPath(target) : null;

  switch (computedType) {
    case "length_of": {
      const goType = mapPrimitiveToGoType(fieldType);
      const offset = computed.offset || 0; // Handle offset property (e.g., for BIT STRING where length = data + unused_bits byte)

      if (parentRef) {
        // Parent reference - will be handled by generateComputedFieldEncoding
        // Return a marker that indicates parent reference
        return `__PARENT_REF__`;
      }

      // Compute length of target array or string
      // For arrays: len(m.Target)
      // For strings with encoding: len([]byte(m.Target)) to get byte length
      // For struct types: m.Target.CalculateSize()
      const goFieldName = toGoFieldName(target);

      // Check if this is a string with encoding (need byte length, not character count)
      if (computed.encoding) {
        // For UTF-8 encoded strings, we need the byte length
        const baseExpr = `len([]byte(m.${goFieldName}))`;
        if (offset !== 0) {
          return `${goType}(${baseExpr} + ${offset})`;
        }
        return `${goType}(${baseExpr})`;
      }

      // Check if target is a type that has CalculateSize method
      // This includes: structs (have sequence), string type aliases, type aliases to other structs
      if (containingFields && schema) {
        const targetField = containingFields.find(f => f.name === target);
        if (targetField) {
          const targetType = (targetField as any).type;
          // If it's a type reference (not a primitive or array), check if it has CalculateSize
          if (targetType && !isPrimitiveType(targetType) && targetType !== "array") {
            const typeDef = schema.types?.[targetType];
            if (typeDef) {
              const typeDefType = (typeDef as any).type;
              // String type alias (type: "string") - has CalculateSize
              if (typeDefType === "string") {
                const baseExpr = `m.${goFieldName}.CalculateSize()`;
                if (offset !== 0) {
                  return `${goType}(${baseExpr} + ${offset})`;
                }
                return `${goType}(${baseExpr})`;
              }
              // Type alias to another type (type is a type reference)
              if (typeDefType && !isPrimitiveType(typeDefType) && schema.types?.[typeDefType]) {
                // It references another type - it has CalculateSize
                const baseExpr = `m.${goFieldName}.CalculateSize()`;
                if (offset !== 0) {
                  return `${goType}(${baseExpr} + ${offset})`;
                }
                return `${goType}(${baseExpr})`;
              }
              // Struct type (has sequence, no type field) - has CalculateSize
              if (!typeDefType || typeDefType === undefined) {
                const baseExpr = `m.${goFieldName}.CalculateSize()`;
                if (offset !== 0) {
                  return `${goType}(${baseExpr} + ${offset})`;
                }
                return `${goType}(${baseExpr})`;
              }
            }
          }
        }
      }

      // For arrays, len() gives element count (which equals byte length for uint8 arrays)
      const baseExpr = `len(m.${goFieldName})`;
      if (offset !== 0) {
        return `${goType}(${baseExpr} + ${offset})`;
      }
      return `${goType}(${baseExpr})`;
    }

    case "count_of": {
      const goType = mapPrimitiveToGoType(fieldType);

      if (parentRef) {
        // Parent reference - will be handled by generateComputedFieldEncoding
        return `__PARENT_REF__`;
      }

      // Compute count of elements in target array
      // Similar to length_of but conceptually for count
      const goFieldName = toGoFieldName(target);
      return `${goType}(len(m.${goFieldName}))`;
    }

    case "position_of": {
      const goType = mapPrimitiveToGoType(fieldType);

      if (parentRef) {
        // Parent reference - will be handled by generateComputedFieldEncoding
        return `__PARENT_REF__`;
      }

      // For local position_of, we need:
      // 1. encoder.Position() - the current byte offset (after encoding all fields before this one)
      // 2. Plus the size of fields from current field to target field
      //
      // The target field position = current position + size of fields between current and target

      if (containingFields !== undefined && currentFieldIndex !== undefined) {
        // Find the target field index
        const targetFieldIndex = containingFields.findIndex(f => f.name === target);

        if (targetFieldIndex >= 0 && targetFieldIndex > currentFieldIndex) {
          // Calculate static size of fields from current (inclusive) to target (exclusive)
          let sizeToTarget = 0;
          let allStatic = true;

          for (let i = currentFieldIndex; i < targetFieldIndex; i++) {
            const f = containingFields[i];
            const fieldSize = getStaticFieldSize(f, schema);
            if (fieldSize === 0) {
              // Variable-length field - we can't compute static offset
              allStatic = false;
              break;
            }
            sizeToTarget += fieldSize;
          }

          if (allStatic && sizeToTarget > 0) {
            return `${goType}(encoder.Position() + ${sizeToTarget})`;
          } else if (allStatic) {
            // sizeToTarget is 0, which means position_of field is immediately before target
            // This shouldn't happen with valid position_of fields (they take space)
            // But just in case, return current position
            return `${goType}(encoder.Position())`;
          }
          // Fall through to default if not all static
        }
      }

      // Fallback: just use current encoder position (won't be accurate for most cases)
      return `${goType}(encoder.Position())`;
    }

    case "crc32_of": {
      if (parentRef) {
        // Parent reference - will be handled by generateComputedFieldEncoding
        return `__PARENT_REF__`;
      }

      // CRC32 calculation for local byte array field
      const goFieldName = toGoFieldName(target);
      // Directly compute CRC32 of the byte array
      // The target should be a []uint8 or []byte array
      return `runtime.CRC32(m.${goFieldName})`;
    }

    case "sum_of_sizes": {
      // sum_of_sizes always uses parent references (targets array with ../ paths)
      // Will be handled by generateComputedFieldEncoding
      return `__PARENT_REF__`;
    }

    case "sum_of_type_sizes": {
      // sum_of_type_sizes always uses parent reference (target with ../ path)
      // Will be handled by generateComputedFieldEncoding
      return `__PARENT_REF__`;
    }

    default:
      throw new Error(`Unsupported computed field type: ${computedType}`);
  }
}

/**
 * Generates code to write a computed value to the encoder.
 * Helper function used by generateComputedFieldEncoding.
 */
function generateComputedFieldWrite(field: Field, computedVarName: string, runtimeEndianness: string, indent: string): string[] {
  const lines: string[] = [];

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.WriteUint8(${computedVarName})`);
      break;
    case "uint16":
      lines.push(`${indent}encoder.WriteUint16(${computedVarName}, runtime.${runtimeEndianness})`);
      break;
    case "uint32":
      lines.push(`${indent}encoder.WriteUint32(${computedVarName}, runtime.${runtimeEndianness})`);
      break;
    case "uint64":
      lines.push(`${indent}encoder.WriteUint64(${computedVarName}, runtime.${runtimeEndianness})`);
      break;
    case "varlength": {
      const encoding = (field as any).encoding || "der";
      const methodMap: { [key: string]: string } = {
        'der': 'WriteVarlengthDER',
        'leb128': 'WriteVarlengthLEB128',
        'ebml': 'WriteVarlengthEBML',
        'vlq': 'WriteVarlengthVLQ'
      };
      const method = methodMap[encoding] || 'WriteVarlengthDER';
      lines.push(`${indent}encoder.${method}(uint64(${computedVarName}))`);
      break;
    }
    default:
      throw new Error(`Unsupported field type for computed field: ${field.type}`);
  }

  return lines;
}

/**
 * Generates encoding code for a computed field with parent reference.
 * This generates multiple lines of code that compute the value from parent context
 * and write it to the encoder.
 *
 * @param containingTypeName - The name of the type containing this field (used for corresponding<Type> correlation)
 */
function generateComputedFieldEncoding(
  field: Field,
  computed: any,
  endianness: string,
  runtimeEndianness: string,
  indent: string,
  containingTypeName?: string
): string[] {
  const lines: string[] = [];
  const target = computed.target;
  const computedType = computed.type;
  const goType = mapPrimitiveToGoType(field.type);
  const computedVarName = `${toGoFieldName(field.name)}_computed`;

  // Check for first/last/corresponding selectors first - they don't need parent field lookup
  if (computedType === "position_of") {
    const firstLastInfo = parseFirstLastTarget(target);
    const correspondingInfo = parseCorrespondingTarget(target);

    if (firstLastInfo) {
      // first/last selector - look up position directly from context
      const { arrayPath, filterType, selector } = firstLastInfo;
      const positionKey = `${arrayPath}_${filterType}`;
      lines.push(`${indent}// position_of with ${selector}<${filterType}> selector`);

      if (selector === "first") {
        lines.push(`${indent}${computedVarName}Pos, ${computedVarName}Ok := ctx.GetFirstPosition("${positionKey}")`);
      } else {
        lines.push(`${indent}${computedVarName}Pos, ${computedVarName}Ok := ctx.GetLastPosition("${positionKey}")`);
      }

      // Use sentinel value when position not found (empty array case)
      const sentinel = getSentinelValue(goType);
      lines.push(`${indent}var ${computedVarName} ${goType}`);
      lines.push(`${indent}if ${computedVarName}Ok {`);
      lines.push(`${indent}\t${computedVarName} = ${goType}(${computedVarName}Pos)`);
      lines.push(`${indent}} else {`);
      lines.push(`${indent}\t${computedVarName} = ${sentinel} // Sentinel: not found`);
      lines.push(`${indent}}`);

      // Generate the write code
      return [...lines, ...generateComputedFieldWrite(field, computedVarName, runtimeEndianness, indent)];
    }

    if (correspondingInfo) {
      // corresponding selector - look up position using type occurrence index
      // For same-array correlation: Nth instance of CurrentType -> Nth instance of TargetType
      const { arrayPath, filterType } = correspondingInfo;
      const positionKey = `${arrayPath}_${filterType}`;
      lines.push(`${indent}// position_of with corresponding<${filterType}> selector`);

      // Use type occurrence index for same-array correlation
      // The type counter was incremented BEFORE encoding, so we subtract 1 to get the correlation index
      // E.g., first IndexEntry has typeIndex=1, so correlationIndex=0 (references first DataBlock)
      if (containingTypeName) {
        // Verify array iteration context exists
        lines.push(`${indent}_, ${computedVarName}IterOk := ctx.GetArrayIteration("${arrayPath}")`);
        lines.push(`${indent}if !${computedVarName}IterOk {`);
        lines.push(`${indent}\treturn nil, fmt.Errorf("array iteration context not found for ${arrayPath}")`);
        lines.push(`${indent}}`);
        lines.push(`${indent}// Get type occurrence index for current type (${containingTypeName})`);
        lines.push(`${indent}${computedVarName}TypeIdx := ctx.GetTypeIndex("${arrayPath}", "${containingTypeName}")`);
        lines.push(`${indent}if ${computedVarName}TypeIdx == 0 {`);
        lines.push(`${indent}\treturn nil, fmt.Errorf("type occurrence index not found for ${containingTypeName} in ${arrayPath}")`);
        lines.push(`${indent}}`);
        lines.push(`${indent}${computedVarName}CorrelationIdx := ${computedVarName}TypeIdx - 1 // Counter was incremented before encoding`);
        lines.push(`${indent}${computedVarName}Pos, ${computedVarName}PosOk := ctx.GetPosition("${positionKey}", ${computedVarName}CorrelationIdx)`);
        lines.push(`${indent}if !${computedVarName}PosOk {`);
        lines.push(`${indent}\treturn nil, fmt.Errorf("position not found for corresponding<${filterType}> at index %d in ${arrayPath}", ${computedVarName}CorrelationIdx)`);
        lines.push(`${indent}}`);
      } else {
        // Fallback to array index if type name not available (shouldn't happen for corresponding)
        lines.push(`${indent}${computedVarName}ArrayIter, ${computedVarName}IterOk := ctx.GetArrayIteration("${arrayPath}")`);
        lines.push(`${indent}if !${computedVarName}IterOk {`);
        lines.push(`${indent}\treturn nil, fmt.Errorf("array iteration context not found for ${arrayPath}")`);
        lines.push(`${indent}}`);
        lines.push(`${indent}${computedVarName}Pos, ${computedVarName}PosOk := ctx.GetPosition("${positionKey}", ${computedVarName}ArrayIter.Index)`);
        lines.push(`${indent}if !${computedVarName}PosOk {`);
        lines.push(`${indent}\treturn nil, fmt.Errorf("position not found for corresponding<${filterType}> at index %d in ${arrayPath}", ${computedVarName}ArrayIter.Index)`);
        lines.push(`${indent}}`);
      }
      lines.push(`${indent}${computedVarName} := ${goType}(${computedVarName}Pos)`);

      // Generate the write code
      return [...lines, ...generateComputedFieldWrite(field, computedVarName, runtimeEndianness, indent)];
    }
  }

  // Handle sum_of_sizes early - it has its own parent field lookups
  if (computedType === "sum_of_sizes") {
    const targets: string[] = computed.targets || [];
    lines.push(`${indent}// sum_of_sizes: Sum encoded sizes of ${targets.length} target field(s)`);
    lines.push(`${indent}var ${computedVarName} ${goType}`);

    for (const targetPath of targets) {
      const pathParentRef = parseParentPath(targetPath);
      if (!pathParentRef) {
        throw new Error(`sum_of_sizes target '${targetPath}' is not a parent reference`);
      }

      const { levelsUp, fieldName: targetFieldName } = pathParentRef;
      const targetVar = `${toGoFieldName(field.name)}_${toGoFieldName(targetFieldName)}_raw`;
      const sizeVar = `${toGoFieldName(field.name)}_${toGoFieldName(targetFieldName)}_size`;

      lines.push(`${indent}// Get size of ${targetPath}`);
      lines.push(`${indent}${targetVar}, ${targetVar}Ok := ctx.GetParentField(${levelsUp}, "${targetFieldName}")`);
      lines.push(`${indent}if !${targetVar}Ok {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("parent field '${targetFieldName}' not found for sum_of_sizes")`);
      lines.push(`${indent}}`);

      // Compute size based on type
      lines.push(`${indent}var ${sizeVar} int`);
      lines.push(`${indent}switch v := ${targetVar}.(type) {`);
      lines.push(`${indent}case []byte:  // []byte and []uint8 are the same type in Go`);
      lines.push(`${indent}\t${sizeVar} = len(v)`);
      lines.push(`${indent}case string:`);
      lines.push(`${indent}\t${sizeVar} = len([]byte(v))`);
      const rvVar = `${sizeVar}_rv`;
      lines.push(`${indent}default:`);
      lines.push(`${indent}\t// For slices and arrays, use reflection`);
      lines.push(`${indent}\t${rvVar} := reflect.ValueOf(v)`);
      lines.push(`${indent}\tif ${rvVar}.Kind() == reflect.Slice || ${rvVar}.Kind() == reflect.Array {`);
      lines.push(`${indent}\t\t// Sum the size of each element`);
      lines.push(`${indent}\t\tfor ${sizeVar}_i := 0; ${sizeVar}_i < ${rvVar}.Len(); ${sizeVar}_i++ {`);
      lines.push(`${indent}\t\t\t${sizeVar}_elem := ${rvVar}.Index(${sizeVar}_i).Interface()`);
      lines.push(`${indent}\t\t\tif sizable, ok := ${sizeVar}_elem.(interface{ CalculateSize() int }); ok {`);
      lines.push(`${indent}\t\t\t\t${sizeVar} += sizable.CalculateSize()`);
      lines.push(`${indent}\t\t\t} else {`);
      lines.push(`${indent}\t\t\t\t// Primitive types - estimate based on type`);
      lines.push(`${indent}\t\t\t\tswitch ${rvVar}.Index(${sizeVar}_i).Kind() {`);
      lines.push(`${indent}\t\t\t\tcase reflect.Uint8: ${sizeVar} += 1`);
      lines.push(`${indent}\t\t\t\tcase reflect.Uint16: ${sizeVar} += 2`);
      lines.push(`${indent}\t\t\t\tcase reflect.Uint32: ${sizeVar} += 4`);
      lines.push(`${indent}\t\t\t\tcase reflect.Uint64: ${sizeVar} += 8`);
      lines.push(`${indent}\t\t\t\tdefault: ${sizeVar} += 1`);
      lines.push(`${indent}\t\t\t\t}`);
      lines.push(`${indent}\t\t\t}`);
      lines.push(`${indent}\t\t}`);
      lines.push(`${indent}\t} else if sizable, ok := v.(interface{ CalculateSize() int }); ok {`);
      lines.push(`${indent}\t\t${sizeVar} = sizable.CalculateSize()`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}}`);
      lines.push(`${indent}${computedVarName} += ${goType}(${sizeVar})`);
    }

    // Generate the write code and return early
    return [...lines, ...generateComputedFieldWrite(field, computedVarName, runtimeEndianness, indent)];
  }

  // Handle sum_of_type_sizes early - it has its own parent field lookups
  if (computedType === "sum_of_type_sizes") {
    const elementType = computed.element_type || "";
    const goElementType = toGoTypeName(elementType);
    lines.push(`${indent}// sum_of_type_sizes: Sum encoded sizes of ${elementType} elements in ${target}`);
    lines.push(`${indent}var ${computedVarName} ${goType}`);

    // Parse the parent reference to get the array
    const arrayParentRef = parseParentPath(target);
    if (!arrayParentRef) {
      throw new Error(`sum_of_type_sizes target '${target}' is not a parent reference`);
    }

    const { levelsUp, fieldName: arrayFieldName } = arrayParentRef;
    const arrayVar = `${toGoFieldName(field.name)}_array_raw`;

    lines.push(`${indent}${arrayVar}, ${arrayVar}Ok := ctx.GetParentField(${levelsUp}, "${arrayFieldName}")`);
    lines.push(`${indent}if !${arrayVar}Ok {`);
    lines.push(`${indent}\treturn nil, fmt.Errorf("parent field '${arrayFieldName}' not found for sum_of_type_sizes")`);
    lines.push(`${indent}}`);

    // Iterate array and sum sizes of matching elements
    const rvVar = `${toGoFieldName(field.name)}_rv`;
    lines.push(`${indent}// Iterate array and sum sizes of ${elementType} elements`);
    lines.push(`${indent}${rvVar} := reflect.ValueOf(${arrayVar})`);
    lines.push(`${indent}if ${rvVar}.Kind() == reflect.Slice || ${rvVar}.Kind() == reflect.Array {`);
    lines.push(`${indent}\tfor ${toGoFieldName(field.name)}_i := 0; ${toGoFieldName(field.name)}_i < ${rvVar}.Len(); ${toGoFieldName(field.name)}_i++ {`);
    lines.push(`${indent}\t\t${toGoFieldName(field.name)}_elem := ${rvVar}.Index(${toGoFieldName(field.name)}_i).Interface()`);
    lines.push(`${indent}\t\t// Check if element matches target type`);
    lines.push(`${indent}\t\tif typed, ok := ${toGoFieldName(field.name)}_elem.(*${goElementType}); ok {`);
    lines.push(`${indent}\t\t\t${computedVarName} += ${goType}(typed.CalculateSize())`);
    lines.push(`${indent}\t\t} else if typed, ok := ${toGoFieldName(field.name)}_elem.(${goElementType}); ok {`);
    lines.push(`${indent}\t\t\t${computedVarName} += ${goType}(typed.CalculateSize())`);
    lines.push(`${indent}\t\t}`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}}`);

    // Generate the write code and return early
    return [...lines, ...generateComputedFieldWrite(field, computedVarName, runtimeEndianness, indent)];
  }

  // Handle corresponding selectors with field access (e.g., ../blocks[corresponding<DataBlock>].payload)
  const correspondingWithFieldInfo = parseCorrespondingTarget(target);
  if (correspondingWithFieldInfo && correspondingWithFieldInfo.remainingPath) {
    const { levelsUp, arrayPath, filterType, remainingPath } = correspondingWithFieldInfo;
    const goFilterType = toGoTypeName(filterType);
    // Extract field name from remaining path (e.g., ".payload" -> "Payload")
    const fieldAccess = remainingPath.slice(1); // Remove leading "."
    const goFieldAccess = toGoFieldName(fieldAccess);

    lines.push(`${indent}// Corresponding correlation with field access: ${target}`);
    lines.push(`${indent}// Get the corresponding ${filterType} from ${arrayPath}, then access ${remainingPath}`);

    // Check for same-array vs cross-array correlation
    lines.push(`${indent}${computedVarName}Iter, ${computedVarName}IterOk := ctx.GetArrayIteration("${arrayPath}")`);
    lines.push(`${indent}var ${computedVarName}CorrelationIdx int`);
    lines.push(`${indent}if ${computedVarName}IterOk {`);
    lines.push(`${indent}\t// Same-array correlation: use type occurrence index`);
    if (containingTypeName) {
      lines.push(`${indent}\t${computedVarName}TypeIdx := ctx.GetTypeIndex("${arrayPath}", "${containingTypeName}")`);
      lines.push(`${indent}\tif ${computedVarName}TypeIdx == 0 {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("type occurrence index not found for ${containingTypeName} in ${arrayPath}")`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\t${computedVarName}CorrelationIdx = ${computedVarName}TypeIdx - 1 // Counter was incremented before encoding`);
    } else {
      lines.push(`${indent}\t${computedVarName}CorrelationIdx = ${computedVarName}Iter.Index`);
    }
    lines.push(`${indent}} else {`);
    lines.push(`${indent}\t// Cross-array correlation: use current array index from any containing array`);
    lines.push(`${indent}\t${computedVarName}AnyIter, ${computedVarName}AnyIterOk := ctx.GetAnyArrayIteration()`);
    lines.push(`${indent}\tif !${computedVarName}AnyIterOk {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("no array iteration context found for cross-array correlation to ${arrayPath}")`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}\t${computedVarName}CorrelationIdx = ${computedVarName}AnyIter.Index`);
    lines.push(`${indent}}`);
    lines.push(`${indent}_ = ${computedVarName}Iter // May be nil in cross-array case`)

    // Get the array from parent context by searching all parents (like TypeScript)
    lines.push(`${indent}// Find the target array in parent context (search through all parents)`);
    lines.push(`${indent}${computedVarName}ArrayRaw, ${computedVarName}ArrayOk := ctx.FindParentField("${arrayPath}")`);
    lines.push(`${indent}if !${computedVarName}ArrayOk {`);
    lines.push(`${indent}\treturn nil, fmt.Errorf("array '${arrayPath}' not found in parent context")`);
    lines.push(`${indent}}`);

    // Iterate array to find the nth occurrence of filterType
    lines.push(`${indent}${computedVarName}Rv := reflect.ValueOf(${computedVarName}ArrayRaw)`);
    lines.push(`${indent}var ${computedVarName}TargetItem *${goFilterType}`);
    lines.push(`${indent}${computedVarName}OccurrenceCount := 0`);
    lines.push(`${indent}for ${computedVarName}i := 0; ${computedVarName}i < ${computedVarName}Rv.Len(); ${computedVarName}i++ {`);
    lines.push(`${indent}\t${computedVarName}Elem := ${computedVarName}Rv.Index(${computedVarName}i).Interface()`);
    lines.push(`${indent}\tif typed, ok := ${computedVarName}Elem.(*${goFilterType}); ok {`);
    lines.push(`${indent}\t\tif ${computedVarName}OccurrenceCount == ${computedVarName}CorrelationIdx {`);
    lines.push(`${indent}\t\t\t${computedVarName}TargetItem = typed`);
    lines.push(`${indent}\t\t\tbreak`);
    lines.push(`${indent}\t\t}`);
    lines.push(`${indent}\t\t${computedVarName}OccurrenceCount++`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}}`);
    lines.push(`${indent}if ${computedVarName}TargetItem == nil {`);
    lines.push(`${indent}\treturn nil, fmt.Errorf("corresponding ${filterType} at index %d not found in ${arrayPath}", ${computedVarName}CorrelationIdx)`);
    lines.push(`${indent}}`);

    // Access the field and compute based on type
    lines.push(`${indent}// Access ${remainingPath} from the target item`);
    const targetFieldAccess = `${computedVarName}TargetItem.${goFieldAccess}`;

    // Generate code based on computed type
    switch (computedType) {
      case "length_of":
        lines.push(`${indent}var ${computedVarName} ${goType}`);
        lines.push(`${indent}${computedVarName}FieldRv := reflect.ValueOf(${targetFieldAccess})`);
        lines.push(`${indent}if ${computedVarName}FieldRv.Kind() == reflect.Slice || ${computedVarName}FieldRv.Kind() == reflect.Array {`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(${computedVarName}FieldRv.Len())`);
        lines.push(`${indent}} else if ${computedVarName}FieldRv.Kind() == reflect.String {`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(${computedVarName}FieldRv.Len())`);
        lines.push(`${indent}} else {`);
        lines.push(`${indent}\t// Handle scalar types`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(${computedVarName}FieldRv.Uint())`);
        lines.push(`${indent}}`);
        break;

      case "count_of":
        lines.push(`${indent}var ${computedVarName} ${goType}`);
        lines.push(`${indent}${computedVarName}FieldRv := reflect.ValueOf(${targetFieldAccess})`);
        lines.push(`${indent}if ${computedVarName}FieldRv.Kind() == reflect.Slice || ${computedVarName}FieldRv.Kind() == reflect.Array {`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(${computedVarName}FieldRv.Len())`);
        lines.push(`${indent}} else {`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(${computedVarName}FieldRv.Uint())`);
        lines.push(`${indent}}`);
        break;

      case "crc32_of":
        // CRC32 of the field value from the corresponding item
        lines.push(`${indent}var ${computedVarName} ${goType}`);
        lines.push(`${indent}${computedVarName}FieldVal := ${targetFieldAccess}`);
        lines.push(`${indent}if byteSlice, ok := ${computedVarName}FieldVal.([]byte); ok {`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(runtime.CRC32(byteSlice))`);
        lines.push(`${indent}} else if uint8Slice, ok := ${computedVarName}FieldVal.([]uint8); ok {`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(runtime.CRC32(uint8Slice))`);
        lines.push(`${indent}} else {`);
        lines.push(`${indent}\t// For other types, try to encode to bytes first`);
        lines.push(`${indent}\tif encoder, ok := ${computedVarName}FieldVal.(interface{ Encode() ([]byte, error) }); ok {`);
        lines.push(`${indent}\t\tif bytes, err := encoder.Encode(); err == nil {`);
        lines.push(`${indent}\t\t\t${computedVarName} = ${goType}(runtime.CRC32(bytes))`);
        lines.push(`${indent}\t\t}`);
        lines.push(`${indent}\t}`);
        lines.push(`${indent}}`);
        break;

      default:
        lines.push(`${indent}// Unsupported computed type '${computedType}' with corresponding field access`);
        lines.push(`${indent}var ${computedVarName} ${goType} = 0`);
    }

    return [...lines, ...generateComputedFieldWrite(field, computedVarName, runtimeEndianness, indent)];
  }

  // For other cases, use parent field lookup
  const parentRef = parseParentPath(target);

  if (!parentRef) {
    throw new Error(`generateComputedFieldEncoding called without parent reference: ${target}`);
  }

  const { levelsUp, fieldName: targetFieldName } = parentRef;
  const goTargetFieldName = toGoFieldName(targetFieldName);

  // Generate code to get the parent field value
  lines.push(`${indent}// Computed field with parent reference: ${target}`);
  lines.push(`${indent}${computedVarName}Raw, ${computedVarName}Ok := ctx.GetParentField(${levelsUp}, "${targetFieldName}")`);
  lines.push(`${indent}if !${computedVarName}Ok {`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("parent field '${targetFieldName}' not found in context (${levelsUp} level(s) up)")`);
  lines.push(`${indent}}`);

  // Generate code based on computed type
  switch (computedType) {
    case "length_of": {
      // For length_of, we need to get the length of the parent field
      // The parent field could be an array, string, or scalar value
      lines.push(`${indent}var ${computedVarName} ${goType}`);
      lines.push(`${indent}switch v := ${computedVarName}Raw.(type) {`);

      if (computed.encoding) {
        // String with encoding - get byte length
        lines.push(`${indent}case string:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(len([]byte(v)))`);
        lines.push(`${indent}case []byte:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(len(v))`);
      } else {
        // Handle scalar values (copy the value) and slices (get length)
        lines.push(`${indent}case uint8:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case uint16:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case uint32:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case uint64:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case int8:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case int16:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case int32:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case int64:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
        lines.push(`${indent}case []byte:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(len(v))`);
        lines.push(`${indent}case string:`);
        lines.push(`${indent}\t${computedVarName} = ${goType}(len(v))`);
      }

      lines.push(`${indent}default:`);
      lines.push(`${indent}\t// For other slice types, use reflection to get length`);
      lines.push(`${indent}\trv := reflect.ValueOf(v)`);
      lines.push(`${indent}\tif rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {`);
      lines.push(`${indent}\t\t${computedVarName} = ${goType}(rv.Len())`);
      lines.push(`${indent}\t} else {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("parent field '${targetFieldName}' has unexpected type %T for length_of", v)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}}`);
      break;
    }

    case "count_of": {
      // For count_of, get the count of elements (or copy scalar value)
      lines.push(`${indent}var ${computedVarName} ${goType}`);
      lines.push(`${indent}switch v := ${computedVarName}Raw.(type) {`);
      // Handle scalar values (copy the value)
      lines.push(`${indent}case uint8:`);
      lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
      lines.push(`${indent}case uint16:`);
      lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
      lines.push(`${indent}case uint32:`);
      lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
      lines.push(`${indent}case uint64:`);
      lines.push(`${indent}\t${computedVarName} = ${goType}(v)`);
      lines.push(`${indent}default:`);
      lines.push(`${indent}\t// For slice types, use reflection to get length`);
      lines.push(`${indent}\trv := reflect.ValueOf(v)`);
      lines.push(`${indent}\tif rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {`);
      lines.push(`${indent}\t\t${computedVarName} = ${goType}(rv.Len())`);
      lines.push(`${indent}\t} else {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("parent field '${targetFieldName}' has unexpected type %T for count_of", v)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}}`);
      break;
    }

    case "position_of": {
      // Check if this is a first/last/corresponding selector
      const firstLastInfo = parseFirstLastTarget(target);
      const correspondingInfo = parseCorrespondingTarget(target);

      if (firstLastInfo) {
        // first/last selector - look up position from context
        const { arrayPath, filterType, selector } = firstLastInfo;
        const positionKey = `${arrayPath}_${filterType}`;
        lines.push(`${indent}// position_of with ${selector} selector - looking up from context`);
        lines.push(`${indent}_ = ${computedVarName}Raw // Using context for position lookup`);

        if (selector === "first") {
          lines.push(`${indent}${computedVarName}Pos, ${computedVarName}Ok := ctx.GetFirstPosition("${positionKey}")`);
        } else {
          lines.push(`${indent}${computedVarName}Pos, ${computedVarName}Ok := ctx.GetLastPosition("${positionKey}")`);
        }
        lines.push(`${indent}if !${computedVarName}Ok {`);
        lines.push(`${indent}\treturn nil, fmt.Errorf("position not found for ${selector}<${filterType}> in ${arrayPath}")`);
        lines.push(`${indent}}`);
        lines.push(`${indent}${computedVarName} := ${goType}(${computedVarName}Pos)`);
      } else if (correspondingInfo) {
        // corresponding selector - look up position using type occurrence index
        const { arrayPath, filterType } = correspondingInfo;
        const positionKey = `${arrayPath}_${filterType}`;
        lines.push(`${indent}// position_of with corresponding selector - looking up from context`);
        lines.push(`${indent}_ = ${computedVarName}Raw // Using context for position lookup`);

        // Use type occurrence index for same-array correlation
        if (containingTypeName) {
          // Verify array iteration context exists
          lines.push(`${indent}_, ${computedVarName}IterOk := ctx.GetArrayIteration("${arrayPath}")`);
          lines.push(`${indent}if !${computedVarName}IterOk {`);
          lines.push(`${indent}\treturn nil, fmt.Errorf("array iteration context not found for ${arrayPath}")`);
          lines.push(`${indent}}`);
          lines.push(`${indent}// Get type occurrence index for current type (${containingTypeName})`);
          lines.push(`${indent}${computedVarName}TypeIdx := ctx.GetTypeIndex("${arrayPath}", "${containingTypeName}")`);
          lines.push(`${indent}if ${computedVarName}TypeIdx == 0 {`);
          lines.push(`${indent}\treturn nil, fmt.Errorf("type occurrence index not found for ${containingTypeName} in ${arrayPath}")`);
          lines.push(`${indent}}`);
          lines.push(`${indent}${computedVarName}CorrelationIdx := ${computedVarName}TypeIdx - 1 // Counter was incremented before encoding`);
          lines.push(`${indent}${computedVarName}Pos, ${computedVarName}PosOk := ctx.GetPosition("${positionKey}", ${computedVarName}CorrelationIdx)`);
          lines.push(`${indent}if !${computedVarName}PosOk {`);
          lines.push(`${indent}\treturn nil, fmt.Errorf("position not found for corresponding<${filterType}> at index %d in ${arrayPath}", ${computedVarName}CorrelationIdx)`);
          lines.push(`${indent}}`);
        } else {
          // Fallback to array index if type name not available
          lines.push(`${indent}${computedVarName}ArrayIter, ${computedVarName}IterOk := ctx.GetArrayIteration("${arrayPath}")`);
          lines.push(`${indent}if !${computedVarName}IterOk {`);
          lines.push(`${indent}\treturn nil, fmt.Errorf("array iteration context not found for ${arrayPath}")`);
          lines.push(`${indent}}`);
          lines.push(`${indent}${computedVarName}Pos, ${computedVarName}PosOk := ctx.GetPosition("${positionKey}", ${computedVarName}ArrayIter.Index)`);
          lines.push(`${indent}if !${computedVarName}PosOk {`);
          lines.push(`${indent}\treturn nil, fmt.Errorf("position not found for corresponding<${filterType}> at index %d in ${arrayPath}", ${computedVarName}ArrayIter.Index)`);
          lines.push(`${indent}}`);
        }
        lines.push(`${indent}${computedVarName} := ${goType}(${computedVarName}Pos)`);
      } else {
        // Regular parent reference - position is current position + size of current field
        // The target field starts right after this struct in the parent, so we need:
        // current position + remaining bytes in this struct (which is just this field's size)
        const fieldSize = getStaticFieldSize(field);
        lines.push(`${indent}// position_of with parent reference - target starts after this field`);
        lines.push(`${indent}_ = ${computedVarName}Raw // Target field position computed from current offset`);
        if (fieldSize > 0) {
          lines.push(`${indent}${computedVarName} := ${goType}(encoder.Position() + ${fieldSize})`);
        } else {
          // Variable-size field - this shouldn't normally happen for position_of, but handle gracefully
          lines.push(`${indent}// WARNING: position_of with variable-size field - using current position`);
          lines.push(`${indent}${computedVarName} := ${goType}(encoder.Position())`);
        }
      }
      break;
    }

    case "crc32_of": {
      // For crc32_of with parent reference, compute CRC32 of parent field
      lines.push(`${indent}var ${computedVarName} uint32`);
      lines.push(`${indent}switch v := ${computedVarName}Raw.(type) {`);
      lines.push(`${indent}case []byte:  // []byte and []uint8 are the same type in Go`);
      lines.push(`${indent}\t${computedVarName} = runtime.CRC32(v)`);
      lines.push(`${indent}default:`);
      lines.push(`${indent}\t// For other types, encode to bytes first`);
      lines.push(`${indent}\tif encoder, ok := v.(interface{ Encode() ([]byte, error) }); ok {`);
      lines.push(`${indent}\t\tif bytes, err := encoder.Encode(); err == nil {`);
      lines.push(`${indent}\t\t\t${computedVarName} = runtime.CRC32(bytes)`);
      lines.push(`${indent}\t\t}`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}}`);
      break;
    }

    default:
      throw new Error(`Unsupported computed field type for parent reference: ${computedType}`);
  }

  // Generate code to write the computed value
  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.WriteUint8(${computedVarName})`);
      break;
    case "uint16":
      lines.push(`${indent}encoder.WriteUint16(${computedVarName}, runtime.${runtimeEndianness})`);
      break;
    case "uint32":
      lines.push(`${indent}encoder.WriteUint32(${computedVarName}, runtime.${runtimeEndianness})`);
      break;
    case "uint64":
      lines.push(`${indent}encoder.WriteUint64(${computedVarName}, runtime.${runtimeEndianness})`);
      break;
    case "varlength": {
      const encoding = (field as any).encoding || "der";
      const methodMap: { [key: string]: string } = {
        'der': 'WriteVarlengthDER',
        'leb128': 'WriteVarlengthLEB128',
        'ebml': 'WriteVarlengthEBML',
        'vlq': 'WriteVarlengthVLQ'
      };
      const method = methodMap[encoding] || 'WriteVarlengthDER';
      lines.push(`${indent}encoder.${method}(uint64(${computedVarName}))`);
      break;
    }
    default:
      throw new Error(`Unsupported field type for computed field: ${field.type}`);
  }

  return lines;
}

/**
 * Maps a primitive type name to Go type
 */
function mapPrimitiveToGoType(typeName: string): string {
  switch (typeName) {
    case "uint8": return "uint8";
    case "uint16": return "uint16";
    case "uint32": return "uint32";
    case "uint64": return "uint64";
    case "int8": return "int8";
    case "int16": return "int16";
    case "int32": return "int32";
    case "int64": return "int64";
    case "varlength": return "uint64"; // Variable-length integers use uint64
    default: return "uint32"; // Default for unknown types
  }
}

/**
 * Converts a count expression to Go code.
 * E.g., "max - min + 1" becomes "int(result.Max) - int(result.Min) + 1"
 */
function convertCountExprToGo(countExpr: string): string {
  // Find all field references (identifiers that are not operators or numbers)
  // Field names are identifiers like "min", "max", "width", "height"
  // but not keywords like "int" or operators
  const operators = new Set(['+', '-', '*', '/', '%', '(', ')', ' ']);
  const keywords = new Set(['int', 'uint', 'uint8', 'uint16', 'uint32', 'uint64']);

  let result = '';
  let currentToken = '';

  for (let i = 0; i <= countExpr.length; i++) {
    const char = countExpr[i] || '';

    if (operators.has(char) || char === '' || /\d/.test(char) && currentToken === '') {
      // End of token or number starting
      if (currentToken !== '') {
        // Check if this is a field reference (not a number or keyword)
        if (!/^\d+$/.test(currentToken) && !keywords.has(currentToken.toLowerCase())) {
          // It's a field reference - convert to Go
          const goFieldName = toGoFieldName(currentToken);
          result += `int(result.${goFieldName})`;
        } else {
          result += currentToken;
        }
        currentToken = '';
      }

      // Handle numbers that start after operators
      if (/\d/.test(char)) {
        currentToken = char;
      } else {
        result += char;
      }
    } else {
      currentToken += char;
    }
  }

  return result;
}

/**
 * Collects all choice definitions from array fields in the schema.
 * Returns a map of choice interface name -> choice definition
 * Each choice array gets a unique interface name based on containing type and field name.
 */
function collectChoiceTypes(schema: BinarySchema): Map<string, { choices: Array<{ type: string }>, discriminatorType: string, discriminatorEndianness: string }> {
  const choiceTypes = new Map<string, { choices: Array<{ type: string }>, discriminatorType: string, discriminatorEndianness: string }>();
  const globalEndianness = schema.config?.endianness || "big_endian";

  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    if ("sequence" in typeDef) {
      for (const field of typeDef.sequence) {
        if (field.type === "array" && (field as any).items?.type === "choice") {
          const items = (field as any).items;
          const choices = items.choices || [];

          // Generate a unique name for this choice interface based on type and field
          const fieldName = toGoFieldName(field.name);
          const choiceName = `${typeName}_${fieldName}_Choice`;

          // Auto-detect discriminator from first choice type
          let discriminatorType = "uint8";
          let discriminatorEndianness = globalEndianness;

          if (choices.length > 0) {
            const firstChoiceType = schema.types[choices[0].type];
            if (firstChoiceType && 'sequence' in firstChoiceType && firstChoiceType.sequence.length > 0) {
              const firstField = firstChoiceType.sequence[0];
              discriminatorType = firstField.type;
              discriminatorEndianness = (firstField as any).endianness || globalEndianness;
            }
          }

          choiceTypes.set(choiceName, { choices, discriminatorType, discriminatorEndianness });
        }
      }
    }
  }

  return choiceTypes;
}

/**
 * Generates a Go interface for choice types
 */
function generateChoiceInterface(name: string): string[] {
  const lines: string[] = [];
  lines.push(`type ${name} interface {`);
  lines.push(`\tEncode() ([]byte, error)`);
  lines.push(`\tEncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error)`);
  lines.push(`\tCalculateSize() int`);
  lines.push(`}`);
  lines.push(``);
  return lines;
}

/**
 * Generates decoding function for choice type
 */
function generateChoiceDecodeFunction(
  name: string,
  choiceDef: { choices: Array<{ type: string }>, discriminatorType: string, discriminatorEndianness: string },
  schema: BinarySchema
): string[] {
  const lines: string[] = [];
  const { choices, discriminatorType, discriminatorEndianness } = choiceDef;
  const runtimeEndianness = mapEndianness(discriminatorEndianness);

  // Return interface value directly, not pointer (Go interfaces are already reference types)
  lines.push(`func decode${name}WithDecoder(decoder *runtime.BitStreamDecoder) (${name}, error) {`);

  // Peek at discriminator to determine type
  switch (discriminatorType) {
    case "uint8":
      lines.push(`\tdiscriminator, err := decoder.PeekUint8()`);
      break;
    case "uint16":
      lines.push(`\tdiscriminator, err := decoder.PeekUint16(runtime.${runtimeEndianness})`);
      break;
    case "uint32":
      lines.push(`\tdiscriminator, err := decoder.PeekUint32(runtime.${runtimeEndianness})`);
      break;
    default:
      lines.push(`\tdiscriminator, err := decoder.PeekUint8()`);
  }

  lines.push(`\tif err != nil {`);
  lines.push(`\t\treturn nil, fmt.Errorf("failed to peek discriminator: %w", err)`);
  lines.push(`\t}`);
  lines.push(``);

  // Generate switch for each choice
  lines.push(`\tswitch discriminator {`);
  for (const choice of choices) {
    const choiceTypeDef = schema.types[choice.type];
    let discriminatorValue: number | bigint = 0;

    // Get const value from first field
    if (choiceTypeDef && 'sequence' in choiceTypeDef && choiceTypeDef.sequence.length > 0) {
      const firstField = choiceTypeDef.sequence[0];
      if ('const' in firstField && (firstField as any).const !== undefined) {
        discriminatorValue = (firstField as any).const;
      }
    }

    const goTypeName = toGoTypeName(choice.type);
    lines.push(`\tcase ${discriminatorValue}:`);
    lines.push(`\t\tresult, err := decode${goTypeName}WithDecoder(decoder)`);
    lines.push(`\t\tif err != nil {`);
    lines.push(`\t\t\treturn nil, err`);
    lines.push(`\t\t}`);
    lines.push(`\t\treturn result, nil`);
  }
  lines.push(`\tdefault:`);
  lines.push(`\t\treturn nil, fmt.Errorf("unknown discriminator value: %d", discriminator)`);
  lines.push(`\t}`);
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates Go encoder/decoder code from a binary schema.
 *
 * Produces:
 * - Struct type definition with exported fields
 * - Encode() ([]byte, error) method for serialization
 * - DecodeTypeName([]byte) (*TypeName, error) function for deserialization
 *
 * @param schema - The binary schema definition
 * @param typeName - The type to generate code for
 * @param options - Optional generation options
 * @returns Generated Go code
 */
export function generateGo(
  schema: BinarySchema,
  typeName: string,
  options?: GoGeneratorOptions
): GeneratedGoCode {
  const pkg = options?.packageName || "main";
  const runtimePkg = options?.runtimeImport || "github.com/anthropics/binschema/runtime";

  // Verify the requested type exists
  if (!schema.types[typeName]) {
    throw new Error(`Type ${typeName} not found in schema`);
  }

  const lines: string[] = [];

  // Determine default endianness and bit order
  const defaultEndianness = schema.config?.endianness || "big_endian";
  const defaultBitOrder = schema.config?.bit_order || "msb_first";

  // Check if we need io import (only for nested structs that need Encode())
  const needsIOImport = hasNestedStructs(schema);

  // Collect choice types from the schema
  const choiceTypes = collectChoiceTypes(schema);

  // Check if we need reflect import (for parent reference computed fields)
  const needsReflectImport = hasParentReferenceComputedFields(schema);

  // Package and imports
  lines.push(`package ${pkg}`);
  lines.push(``);
  lines.push(`import (`);
  lines.push(`\t"fmt"`);
  if (needsIOImport) {
    lines.push(`\t"io"`);
  }
  if (needsReflectImport) {
    lines.push(`\t"reflect"`);
  }
  lines.push(`\t"${runtimePkg}"`);
  lines.push(`)`);
  lines.push(``);

  // Generate choice interfaces first
  for (const [choiceName, choiceDef] of choiceTypes) {
    lines.push(...generateChoiceInterface(choiceName));
  }

  // Generate all types in the schema (Go doesn't require forward declarations)
  for (const [name, typeDef] of Object.entries(schema.types)) {
    // Check if this is a composite type (has sequence) or type alias
    if ("sequence" in typeDef) {
      // Composite type with fields
      const typeDefAny = typeDef as any;
      const instances = typeDefAny.instances || [];
      lines.push(...generateStruct(name, typeDef.sequence, instances, schema));
      lines.push(...generateEncodeMethod(name, typeDef.sequence, defaultEndianness, defaultBitOrder, schema));
      lines.push(...generateCalculateSizeMethod(name, typeDef.sequence, schema));
      lines.push(...generateDecodeFunction(name, typeDef.sequence, defaultEndianness, schema, defaultBitOrder, instances));
    } else if ("type" in typeDef) {
      // Type alias or discriminated union
      if ((typeDef as any).type === "discriminated_union") {
        // Discriminated union type
        lines.push(...generateDiscriminatedUnion(name, typeDef as any, defaultEndianness, schema, defaultBitOrder));
      } else {
        // Regular type alias - generate Go type alias
        lines.push(...generateTypeAlias(name, typeDef as any, defaultEndianness, schema, defaultBitOrder));
      }
    } else if ("variants" in typeDef) {
      // Discriminated union (old format without "type" field)
      lines.push(...generateDiscriminatedUnion(name, typeDef as any, defaultEndianness, schema, defaultBitOrder));
    } else {
      // Unknown type definition
      throw new Error(`Unknown type definition for ${name}: ${JSON.stringify(typeDef)}`);
    }
  }

  // Choice decode logic is now inlined at each call site - no shared function needed

  return {
    code: lines.join("\n"),
    typeName,
  };
}

/**
 * Generates a type alias
 */
function generateTypeAlias(name: string, typeDef: any, defaultEndianness: string, schema: BinarySchema, defaultBitOrder: string = "msb_first"): string[] {
  const lines: string[] = [];

  // For now, treat type aliases as a struct with a single field "Value"
  // This allows the alias to have its own Encode/Decode methods
  const field: Field = {
    name: "value",
    type: typeDef.type,
    ...typeDef
  };

  lines.push(...generateStruct(name, [field]));
  lines.push(...generateEncodeMethod(name, [field], defaultEndianness, defaultBitOrder, schema));
  lines.push(...generateCalculateSizeMethod(name, [field], schema));
  lines.push(...generateDecodeFunction(name, [field], defaultEndianness, schema, defaultBitOrder));

  return lines;
}

/**
 * Generates a discriminated union type as a Go interface
 */
function generateDiscriminatedUnion(name: string, typeDef: any, defaultEndianness: string, schema: BinarySchema, defaultBitOrder: string = "msb_first"): string[] {
  const lines: string[] = [];
  const variants = typeDef.variants || [];
  const discriminator = typeDef.discriminator || {};
  const runtimeBitOrder = mapBitOrder(defaultBitOrder);

  // Generate interface type
  lines.push(`// ${name} is a discriminated union type`);
  lines.push(`type ${name} interface {`);
  lines.push(`\tEncode() ([]byte, error)`);
  lines.push(`\tEncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error)`);
  lines.push(`\tCalculateSize() int`);
  lines.push(`\tIs${name}()`);
  lines.push(`}`);
  lines.push(``);

  // Generate marker method implementations for each variant type
  for (const variant of variants) {
    const variantTypeName = toGoTypeName(variant.type);
    lines.push(`func (*${variantTypeName}) Is${name}() {}`);
  }
  lines.push(``);

  // Generate public decode function
  lines.push(`func Decode${name}(bytes []byte) (${name}, error) {`);
  lines.push(`\tdecoder := runtime.NewBitStreamDecoder(bytes, runtime.${runtimeBitOrder})`);
  lines.push(`\treturn decode${name}WithDecoder(decoder)`);
  lines.push(`}`);
  lines.push(``);

  // Generate decode helper with discriminator dispatch
  lines.push(`func decode${name}WithDecoder(decoder *runtime.BitStreamDecoder) (${name}, error) {`);

  if (discriminator.peek) {
    // Peek-based discriminator
    const peekType = discriminator.peek;
    const endianness = discriminator.endianness || defaultEndianness;
    const runtimeEndianness = mapEndianness(endianness);

    // Peek at discriminator value
    switch (peekType) {
      case "uint8":
        lines.push(`\tdiscriminator, err := decoder.PeekUint8()`);
        break;
      case "uint16":
        lines.push(`\tdiscriminator, err := decoder.PeekUint16(runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`\tdiscriminator, err := decoder.PeekUint32(runtime.${runtimeEndianness})`);
        break;
      default:
        lines.push(`\tdiscriminator, err := decoder.PeekUint8()`);
    }
    lines.push(`\tif err != nil {`);
    lines.push(`\t\treturn nil, fmt.Errorf("failed to peek discriminator: %w", err)`);
    lines.push(`\t}`);
    lines.push(``);

    // Generate switch for each variant
    let isFirst = true;
    for (const variant of variants) {
      if (variant.when) {
        // Parse the condition (e.g., "value == 0x01" -> "discriminator == 0x01")
        // Also convert JavaScript operators to Go (=== to ==, !== to !=)
        let condition = variant.when.replace(/\bvalue\b/g, 'discriminator');
        condition = condition.replace(/===/g, '==').replace(/!==/g, '!=');
        const ifKeyword = isFirst ? "if" : "} else if";
        isFirst = false;

        const variantTypeName = toGoTypeName(variant.type);
        lines.push(`\t${ifKeyword} ${condition} {`);
        lines.push(`\t\treturn decode${variantTypeName}WithDecoder(decoder)`);
      }
    }

    if (!isFirst) {
      lines.push(`\t} else {`);
      lines.push(`\t\treturn nil, fmt.Errorf("unknown discriminator: %d", discriminator)`);
      lines.push(`\t}`);
    }
  } else if (discriminator.field) {
    // Field-based discriminator - need to read the field value first
    // This is more complex as we need to track the field in the parent struct
    lines.push(`\t// TODO: Field-based discriminator not yet implemented`);
    lines.push(`\treturn nil, fmt.Errorf("field-based discriminator not implemented")`);
  } else {
    lines.push(`\treturn nil, fmt.Errorf("no discriminator specified for union")`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Checks if schema has nested struct types (which require io import)
 */
function hasNestedStructs(schema: BinarySchema): boolean {
  // Always return false for now - io import is never actually used
  // We encode nested structs by calling their Encode() method which returns []byte
  return false;
}

/**
 * Checks if a type is a primitive
 */
function isPrimitiveType(type: string): boolean {
  return ["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "float32", "float64"].includes(type);
}

/**
 * Gets the Go type for an instance field
 */
function getInstanceFieldGoType(instance: any, schema: BinarySchema): string {
  const instanceType = instance.type;

  // Handle inline discriminated union
  if (typeof instanceType === "object" && instanceType.discriminator && instanceType.variants) {
    // For inline discriminated unions, we need an interface type or a wrapper struct
    // For now, use interface{} and let the decoder handle variant resolution
    return "interface{}";
  }

  // Simple type reference - look it up in the schema
  const typeDef = schema.types[instanceType];
  if (!typeDef) {
    // Assume it's a valid type reference
    return `*${instanceType}`;
  }

  // Check if it's a discriminated union type
  if ("type" in typeDef && (typeDef as any).type === "discriminated_union") {
    return instanceType; // Interface type
  }

  // Regular struct type
  return `*${instanceType}`;
}

/**
 * Generates a Go struct definition
 */
function generateStruct(name: string, fields: Field[], instances?: any[], schema?: BinarySchema): string[] {
  const lines: string[] = [];

  // First, generate any inline bitfield struct types
  for (const field of fields) {
    if (field.type === "bitfield" && (field as any).fields) {
      lines.push(...generateBitfieldStruct(name, field));
    }
  }

  lines.push(`type ${name} struct {`);

  for (const field of fields) {
    // Skip padding fields - they have no struct representation
    if (field.type === "padding") {
      continue;
    }
    const goType = mapFieldToGoType(field, name);
    const fieldName = toGoFieldName(field.name);
    lines.push(`\t${fieldName} ${goType}`);
  }

  // Add instance fields (position-based lazy fields)
  if (instances && instances.length > 0) {
    for (const instance of instances) {
      const fieldName = toGoFieldName(instance.name);
      // Instance fields are eagerly loaded in Go (no lazy getters)
      // The type depends on whether it's a simple type ref or inline union
      const instanceType = instance.type;
      let goType: string;

      if (typeof instanceType === "object" && instanceType.discriminator && instanceType.variants) {
        // Inline discriminated union - use interface{} for now
        goType = "interface{}";
      } else {
        // Check if the type is a discriminated union (interface) in the schema
        const typeDef = schema?.types[instanceType];
        const isDiscriminatedUnion =
          typeDef && ("type" in typeDef && (typeDef as any).type === "discriminated_union") ||
          (typeDef && "variants" in typeDef && "discriminator" in typeDef);

        if (isDiscriminatedUnion) {
          // Discriminated unions are Go interfaces, don't use pointer
          goType = instanceType;
        } else {
          // Regular struct type - use pointer
          goType = `*${instanceType}`;
        }
      }

      lines.push(`\t${fieldName} ${goType}`);
    }
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates a struct type for an inline bitfield
 */
function generateBitfieldStruct(parentTypeName: string, field: Field): string[] {
  const lines: string[] = [];
  const bitfieldFields = (field as any).fields || [];
  const fieldName = toGoFieldName(field.name);
  const structName = `${parentTypeName}_${fieldName}`;

  lines.push(`type ${structName} struct {`);
  for (const subField of bitfieldFields) {
    const subFieldName = toGoFieldName(subField.name);
    // All bitfield sub-fields are unsigned integers
    const goType = subField.size <= 8 ? "uint8" :
                   subField.size <= 16 ? "uint16" :
                   subField.size <= 32 ? "uint32" : "uint64";
    lines.push(`\t${subFieldName} ${goType}`);
  }
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Check if a struct has any nested struct fields that might need parent context
 */
function hasNestedStructFields(fields: Field[]): boolean {
  for (const field of fields) {
    // Skip primitive types and special types that don't need context
    switch (field.type) {
      case "uint8":
      case "uint16":
      case "uint32":
      case "uint64":
      case "int8":
      case "int16":
      case "int32":
      case "int64":
      case "float32":
      case "float64":
      case "bit":
      case "int":
      case "bitfield":
      case "varlength":
      case "string":
      case "padding":
        continue;
      case "array": {
        // Check if array items are composite types
        const items = (field as any).items;
        if (items && items.type && !isPrimitiveType(items.type)) {
          return true;
        }
        continue;
      }
      default:
        // Type reference (nested struct), choice, discriminated_union, etc.
        return true;
    }
  }
  return false;
}

/**
 * Check if a field has from_after_field computed length
 */
function hasFromAfterField(field: Field): boolean {
  const fieldAny = field as any;
  return fieldAny.computed?.type === "length_of" && fieldAny.computed?.from_after_field;
}

/**
 * Generate content-first encoding for from_after_field computed fields
 * This encodes all fields after the specified field to a temp buffer first,
 * then writes the length prefix, then the buffered content.
 *
 * @param targetEncoder - The encoder to write the computed length and content to.
 *                        For top-level, this is "encoder". For nested calls, this is
 *                        the outer tempEncoder variable name.
 */
function generateFromAfterFieldEncoding(
  fields: Field[],
  fromAfterFieldIndex: number,
  computedFieldIndex: number,
  computedField: Field,
  defaultEndianness: string,
  defaultBitOrder: string,
  indent: string,
  schema?: BinarySchema,
  nestingLevel: number = 0,
  targetEncoder: string = "encoder"
): string[] {
  const lines: string[] = [];
  const fieldAny = computedField as any;
  const fromAfterFieldName = fieldAny.computed.from_after_field;
  const runtimeBitOrder = mapBitOrder(defaultBitOrder);

  // Use unique variable names for nested from_after_field contexts
  const tempEncoderVar = nestingLevel === 0 ? "tempEncoder" : `tempEncoder${nestingLevel}`;
  const contentBytesVar = nestingLevel === 0 ? "contentBytes" : `contentBytes${nestingLevel}`;

  lines.push(`${indent}// Content-first encoding for from_after_field: compute size of fields after '${fromAfterFieldName}'`);
  lines.push(`${indent}${tempEncoderVar} := runtime.NewBitStreamEncoder(runtime.${runtimeBitOrder})`);
  lines.push(``);

  // Find all fields after from_after_field (excluding the computed field itself)
  const fieldsAfter = fields.slice(fromAfterFieldIndex + 1);

  // Keep track of fields to skip (already encoded)
  const encodedFieldIndices = new Set<number>();

  for (let i = 0; i < fieldsAfter.length; i++) {
    const afterField = fieldsAfter[i];
    const afterFieldAny = afterField as any;
    const actualIndex = fromAfterFieldIndex + 1 + i;

    // Skip the computed field itself
    if (actualIndex === computedFieldIndex) {
      continue;
    }

    // Skip if this is a nested from_after_field - it will handle its own remaining fields
    if (hasFromAfterField(afterField)) {
      // Mark all remaining fields as handled by this nested from_after_field
      for (let j = i; j < fieldsAfter.length; j++) {
        encodedFieldIndices.add(fromAfterFieldIndex + 1 + j);
      }
      // Generate recursive from_after_field encoding
      // Pass the current tempEncoderVar as the target encoder for the nested call
      const nestedFromAfterIndex = fields.findIndex(f => f.name === afterFieldAny.computed.from_after_field);
      lines.push(...generateFromAfterFieldEncoding(
        fields,
        nestedFromAfterIndex,
        actualIndex,
        afterField,
        defaultEndianness,
        defaultBitOrder,
        indent,
        schema,
        nestingLevel + 1,
        tempEncoderVar  // Nested from_after_field writes to outer tempEncoder
      ));
      break;
    }

    encodedFieldIndices.add(actualIndex);

    // Generate encoding for this field to the temp encoder
    // Replace 'encoder' with the temp encoder variable name
    const fieldLines = generateEncodeField(afterField, defaultEndianness, indent, fields, actualIndex, schema);
    for (const line of fieldLines) {
      lines.push(line.replace(/\bencoder\./g, `${tempEncoderVar}.`));
    }
  }

  lines.push(``);
  lines.push(`${indent}// Get the encoded content bytes`);
  lines.push(`${indent}${contentBytesVar} := ${tempEncoderVar}.Finish()`);
  lines.push(``);

  // Write the varlength length
  const encoding = fieldAny.encoding || "der";
  let writeMethod: string;
  switch (encoding) {
    case "der":
      writeMethod = "WriteVarlengthDER";
      break;
    case "leb128":
      writeMethod = "WriteVarlengthLEB128";
      break;
    case "ebml":
      writeMethod = "WriteVarlengthEBML";
      break;
    case "vlq":
      writeMethod = "WriteVarlengthVLQ";
      break;
    default:
      writeMethod = "WriteVarlengthDER";
  }

  lines.push(`${indent}// Write the computed length (${encoding}) to ${targetEncoder}`);
  lines.push(`${indent}${targetEncoder}.${writeMethod}(uint64(len(${contentBytesVar})))`);
  lines.push(``);

  lines.push(`${indent}// Write the buffered content to ${targetEncoder}`);
  lines.push(`${indent}${targetEncoder}.WriteBytes(${contentBytesVar})`);
  lines.push(``);

  return lines;
}

/**
 * Generates an Encode method for a struct
 */
function generateEncodeMethod(name: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string = "msb_first", schema?: BinarySchema): string[] {
  const lines: string[] = [];
  const runtimeBitOrder = mapBitOrder(defaultBitOrder);

  // Public Encode method - delegates to EncodeWithContext
  lines.push(`func (m *${name}) Encode() ([]byte, error) {`);
  lines.push(`\treturn m.EncodeWithContext(runtime.NewEncodingContext())`);
  lines.push(`}`);
  lines.push(``);

  // Context-aware encoding method
  lines.push(`func (m *${name}) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {`);
  lines.push(`\tencoder := runtime.NewBitStreamEncoder(runtime.${runtimeBitOrder})`);
  lines.push(``);

  // Always build parent context for nested struct encoding and computed fields
  // This enables child types to access parent fields via ../ syntax
  lines.push(`\t// Build parent context for nested struct encoding`);
  lines.push(`\tparentFields := map[string]interface{}{`);
  for (const field of fields) {
    // Skip padding fields - they don't exist in the struct
    if (field.type === "padding") continue;
    // Skip computed fields - they don't exist in the struct
    if ((field as any).computed) continue;
    const goFieldName = toGoFieldName(field.name);
    lines.push(`\t\t"${field.name}": m.${goFieldName},`);
  }
  lines.push(`\t}`);
  lines.push(`\tchildCtx := ctx.ExtendWithParent(parentFields)`);
  lines.push(`\t_ = childCtx // Used by nested struct encoding`);
  lines.push(``);

  // Add pre-pass for array fields that need position tracking
  if (schema) {
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const field = fields[fieldIndex];
      if (field.type !== "array") continue;
      const fieldAny = field as any;
      const items = fieldAny.items;
      if (!items) continue;

      // Check if this array needs position tracking
      const trackingTypes = detectArraysNeedingPositionTracking(schema);
      const typesToTrack = trackingTypes.get(field.name);
      if (!typesToTrack || typesToTrack.size === 0) continue;

      const goFieldName = toGoFieldName(field.name);
      const isChoiceArray = items.type === "choice";

      // Calculate initial offset as sum of sizes of all fields BEFORE this array field
      let staticOffset = 0;
      const dynamicOffsetParts: string[] = [];
      for (let i = 0; i < fieldIndex; i++) {
        const precedingField = fields[i];
        const fieldSize = getStaticFieldSize(precedingField, schema);
        if (fieldSize > 0) {
          staticOffset += fieldSize;
        } else {
          // Variable-size field - need to compute dynamically
          const goName = toGoFieldName(precedingField.name);
          dynamicOffsetParts.push(`m.${goName}.CalculateSize()`);
        }
      }
      // Build the offset expression
      let initialOffsetCode: string;
      if (staticOffset === 0 && dynamicOffsetParts.length === 0) {
        initialOffsetCode = "encoder.Position()";
      } else if (dynamicOffsetParts.length === 0) {
        initialOffsetCode = `${staticOffset}`;
      } else if (staticOffset === 0) {
        initialOffsetCode = dynamicOffsetParts.join(" + ");
      } else {
        initialOffsetCode = `${staticOffset} + ${dynamicOffsetParts.join(" + ")}`;
      }

      lines.push(`\t// Pre-pass: compute positions for ${field.name} array (first/last selectors)`);
      lines.push(`\t${field.name}_offset := ${initialOffsetCode}`);

      // Account for length prefix if present
      const kind = fieldAny.kind;
      if (kind === "length_prefixed" || kind === "length_prefixed_items") {
        const lengthType = fieldAny.length_type || "uint8";
        const lengthSize = lengthType === "uint8" ? 1 : lengthType === "uint16" ? 2 : lengthType === "uint32" ? 4 : lengthType === "uint64" ? 8 : 1;
        lines.push(`\t${field.name}_offset += ${lengthSize} // Account for length prefix`);
      }

      // Loop through array items
      lines.push(`\tfor _, ${field.name}_prepass_item := range m.${goFieldName} {`);

      if (isChoiceArray) {
        // For choice arrays, check item type dynamically
        for (const typeName of typesToTrack) {
          const goTypeName = toGoTypeName(typeName);
          lines.push(`\t\tif _, ok := ${field.name}_prepass_item.(*${goTypeName}); ok {`);
          lines.push(`\t\t\tchildCtx.TrackPosition("${field.name}_${typeName}", ${field.name}_offset)`);
          lines.push(`\t\t}`);
        }
      } else {
        // For single-type arrays, all items are the same type
        const itemTypeName = items.type;
        if (typesToTrack.has(itemTypeName)) {
          lines.push(`\t\tchildCtx.TrackPosition("${field.name}_${itemTypeName}", ${field.name}_offset)`);
        }
      }

      // Measure size by encoding to temp or using CalculateSize
      lines.push(`\t\t// Advance offset by item size`);
      lines.push(`\t\t${field.name}_offset += ${field.name}_prepass_item.CalculateSize()`);
      lines.push(`\t}`);
      lines.push(``);
    }
  }

  // Generate encoding logic for each field
  // Track which fields have been encoded (for from_after_field handling)
  const encodedFields = new Set<number>();

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const fieldAny = field as any;

    // Skip if already encoded by a from_after_field
    if (encodedFields.has(i)) {
      continue;
    }

    // Check for from_after_field computed fields
    if (hasFromAfterField(field)) {
      const fromAfterFieldName = fieldAny.computed.from_after_field;
      const fromAfterIndex = fields.findIndex(f => f.name === fromAfterFieldName);

      if (fromAfterIndex === -1) {
        throw new Error(`Computed field '${field.name}' references from_after_field '${fromAfterFieldName}' which doesn't exist`);
      }

      // Generate content-first encoding
      lines.push(...generateFromAfterFieldEncoding(
        fields,
        fromAfterIndex,
        i,
        field,
        defaultEndianness,
        defaultBitOrder,
        "\t",
        schema
      ));

      // Mark all fields after from_after_field as encoded
      for (let j = fromAfterIndex + 1; j < fields.length; j++) {
        encodedFields.add(j);
      }

      continue;
    }

    lines.push(...generateEncodeField(field, defaultEndianness, "\t", fields, i, schema, name));
  }

  lines.push(``);
  lines.push(`\treturn encoder.Finish(), nil`);
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates a CalculateSize method for a struct
 * Used for multi-pass encoding (from_after_field) and buffer pre-allocation
 */
function generateCalculateSizeMethod(name: string, fields: Field[], schema: BinarySchema): string[] {
  const lines: string[] = [];

  // Check if this type has any from_after_field computed fields
  const hasFromAfterField = fields.some(f => {
    const fieldAny = f as any;
    return fieldAny.computed?.type === "length_of" && fieldAny.computed?.from_after_field;
  });

  lines.push(`func (m *${name}) CalculateSize() int {`);

  if (hasFromAfterField) {
    // For types with from_after_field, just encode and return length
    lines.push(`\t// This type uses from_after_field - encode to get exact size`);
    lines.push(`\tbytes, _ := m.Encode()`);
    lines.push(`\treturn len(bytes)`);
  } else {
    lines.push(`\tsize := 0`);
    lines.push(``);

    // Generate size calculation for each field
    for (const field of fields) {
      lines.push(...generateFieldSizeCalculation(field, schema, "\t"));
    }

    lines.push(``);
    lines.push(`\treturn size`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates size calculation code for a single field
 */
function generateFieldSizeCalculation(field: Field, schema: BinarySchema, indent: string): string[] {
  const lines: string[] = [];
  const fieldAny = field as any;
  const fieldName = toGoFieldName(fieldAny.name);

  // Handle conditional fields
  if (fieldAny.if) {
    const condition = convertConditionalToGo(fieldAny.if, "m");
    lines.push(`${indent}if ${condition} {`);
    lines.push(...generateFieldSizeCalculationImpl(field, schema, indent + "\t"));
    lines.push(`${indent}}`);
  } else {
    lines.push(...generateFieldSizeCalculationImpl(field, schema, indent));
  }

  return lines;
}

/**
 * Implementation of field size calculation
 */
function generateFieldSizeCalculationImpl(field: Field, schema: BinarySchema, indent: string): string[] {
  const lines: string[] = [];
  const fieldAny = field as any;
  const fieldName = toGoFieldName(fieldAny.name);
  const fieldType = field.type;

  // Handle padding fields - compute alignment dynamically
  if (fieldType === "padding") {
    const alignTo = fieldAny.align_to || 4;
    lines.push(`${indent}// ${fieldName} alignment padding (can't calculate statically)`);
    // Padding size depends on current position which isn't available during size calculation
    // For now, we skip it - the from_after_field approach will encode to get exact size
    return lines;
  }

  // Handle computed fields - they still take up space in the encoded output
  if (fieldAny.computed) {
    return generateComputedFieldSize(field, indent);
  }

  // Handle const fields (fixed size)
  if (fieldAny.const !== undefined) {
    return generatePrimitiveFieldSize(fieldType, fieldName, indent, "(const)");
  }

  // Handle optional fields
  if (fieldType === "optional") {
    const innerType = fieldAny.inner_type || "uint8";
    const presenceType = fieldAny.presence_type || "uint8";
    lines.push(`${indent}if m.${fieldName} != nil {`);
    // Size of presence indicator (1 = present)
    lines.push(...generatePrimitiveFieldSize(presenceType, fieldName, indent + "\t", "(presence)"));
    // Size of actual value
    lines.push(...generateFieldSizeForType(innerType, `*m.${fieldName}`, schema, indent + "\t", fieldAny));
    lines.push(`${indent}} else {`);
    // Size of presence indicator (0 = absent)
    lines.push(...generatePrimitiveFieldSize(presenceType, fieldName, indent + "\t", "(absence)"));
    lines.push(`${indent}}`);
    return lines;
  }

  // Handle regular field types
  lines.push(...generateFieldSizeForType(fieldType, `m.${fieldName}`, schema, indent, fieldAny));

  return lines;
}

/**
 * Generate size for computed fields (they still occupy space)
 */
function generateComputedFieldSize(field: Field, indent: string): string[] {
  const lines: string[] = [];
  const fieldAny = field as any;
  const fieldName = toGoFieldName(fieldAny.name);
  const fieldType = field.type;

  // Computed fields still write their value, so they take up space
  return generatePrimitiveFieldSize(fieldType, fieldName, indent, "(computed)");
}

/**
 * Generate size calculation for primitive types
 */
function generatePrimitiveFieldSize(fieldType: string, fieldName: string, indent: string, comment: string = ""): string[] {
  const lines: string[] = [];
  const commentSuffix = comment ? ` // ${fieldName} ${comment}` : ` // ${fieldName}`;

  switch (fieldType) {
    case "uint8":
    case "int8":
      lines.push(`${indent}size += 1${commentSuffix}`);
      break;
    case "uint16":
    case "int16":
      lines.push(`${indent}size += 2${commentSuffix}`);
      break;
    case "uint32":
    case "int32":
    case "float32":
      lines.push(`${indent}size += 4${commentSuffix}`);
      break;
    case "uint64":
    case "int64":
    case "float64":
      lines.push(`${indent}size += 8${commentSuffix}`);
      break;
    case "varlength":
      // For varlength, we need to calculate based on value
      // Use DER encoding size formula: 1 byte if < 128, otherwise 1 + ceil(log256(value))
      lines.push(`${indent}// ${fieldName}: varlength size calculation`);
      lines.push(`${indent}size += runtime.VarlengthDERSize(m.${fieldName})`);
      break;
    default:
      // Unknown primitive type, assume 1 byte
      lines.push(`${indent}size += 1 // ${fieldName} (unknown primitive, assuming 1 byte)`);
      break;
  }

  return lines;
}

/**
 * Generate size calculation for any field type
 */
function generateFieldSizeForType(fieldType: string, valueExpr: string, schema: BinarySchema, indent: string, fieldAny: any): string[] {
  const lines: string[] = [];
  const fieldName = valueExpr.replace(/^m\./, "").replace(/^\*/, "");

  switch (fieldType) {
    case "uint8":
    case "int8":
      lines.push(`${indent}size += 1 // ${fieldName}`);
      break;
    case "uint16":
    case "int16":
      lines.push(`${indent}size += 2 // ${fieldName}`);
      break;
    case "uint32":
    case "int32":
    case "float32":
      lines.push(`${indent}size += 4 // ${fieldName}`);
      break;
    case "uint64":
    case "int64":
    case "float64":
      lines.push(`${indent}size += 8 // ${fieldName}`);
      break;
    case "bit":
    case "int": {
      // Bitfields - size depends on bit count, converted to bytes
      const bitSize = fieldAny.size || 1;
      // Bitfields contribute to the byte count but are bit-packed
      // For size calculation, we round up to the nearest byte
      // Actually, since bits are packed, we should track bit position
      // For now, we'll just note this - proper implementation needs bit tracking
      lines.push(`${indent}// ${fieldName}: ${bitSize} bits (bitfield)`);
      break;
    }
    case "bitfield": {
      // Bitfield container - sum of all sub-field bits, rounded up to bytes
      const bitfieldFields = fieldAny.fields || [];
      let totalBits = 0;
      for (const subField of bitfieldFields) {
        totalBits += subField.size || 1;
      }
      const byteSize = Math.ceil(totalBits / 8);
      lines.push(`${indent}size += ${byteSize} // ${fieldName} (bitfield: ${totalBits} bits)`);
      break;
    }
    case "varlength": {
      lines.push(`${indent}size += runtime.VarlengthDERSize(${valueExpr}) // ${fieldName}`);
      break;
    }
    case "string": {
      const kind = fieldAny.kind || "null_terminated";
      if (kind === "null_terminated") {
        lines.push(`${indent}size += len(${valueExpr}) + 1 // ${fieldName} (null-terminated string)`);
      } else if (kind === "length_prefixed") {
        const lengthType = fieldAny.length_type || "uint8";
        const prefixSize = getPrimitiveSizeForType(lengthType);
        lines.push(`${indent}size += ${prefixSize} + len(${valueExpr}) // ${fieldName} (length-prefixed string)`);
      } else if (kind === "field_referenced") {
        lines.push(`${indent}size += len(${valueExpr}) // ${fieldName} (field-referenced string)`);
      } else {
        lines.push(`${indent}size += len(${valueExpr}) // ${fieldName} (string)`);
      }
      break;
    }
    case "array": {
      lines.push(...generateArraySizeCalculation(fieldAny, valueExpr, schema, indent));
      break;
    }
    case "discriminated_union": {
      // Inline discriminated union - need to handle via type switch
      // For size calculation, we need to encode and measure
      lines.push(`${indent}// ${fieldName}: inline discriminated union (encode to measure)`);
      lines.push(`${indent}if ${valueExpr} != nil {`);
      lines.push(`${indent}\t${fieldName}_bytes, _ := ${valueExpr}.(interface{ Encode() ([]byte, error) }).Encode()`);
      lines.push(`${indent}\tsize += len(${fieldName}_bytes)`);
      lines.push(`${indent}}`);
      break;
    }
    default: {
      // Assume custom composite type - call its CalculateSize method
      if (schema.types[fieldType]) {
        const typeDef = schema.types[fieldType] as any;
        // Check if this is a discriminated union
        if (typeDef.type === "discriminated_union" || typeDef.variants) {
          // Discriminated union interface - encode to measure
          lines.push(`${indent}// ${fieldName}: discriminated union (encode to measure)`);
          lines.push(`${indent}if ${valueExpr} != nil {`);
          lines.push(`${indent}\tsize += ${valueExpr}.CalculateSize()`);
          lines.push(`${indent}}`);
        } else {
          lines.push(`${indent}size += ${valueExpr}.CalculateSize() // ${fieldName}`);
        }
      } else {
        // Unknown type - might be interface{} for inline discriminated union
        // Check if field has variants (inline discriminated union)
        if (fieldAny.variants) {
          lines.push(`${indent}// ${fieldName}: inline discriminated union (encode to measure)`);
          lines.push(`${indent}if ${valueExpr} != nil {`);
          lines.push(`${indent}\t${fieldName}_bytes, _ := ${valueExpr}.(interface{ Encode() ([]byte, error) }).Encode()`);
          lines.push(`${indent}\tsize += len(${fieldName}_bytes)`);
          lines.push(`${indent}}`);
        } else {
          // Try to call CalculateSize anyway
          lines.push(`${indent}size += ${valueExpr}.CalculateSize() // ${fieldName} (type: ${fieldType})`);
        }
      }
      break;
    }
  }

  return lines;
}

/**
 * Generate size calculation for array fields
 */
function generateArraySizeCalculation(fieldAny: any, valueExpr: string, schema: BinarySchema, indent: string): string[] {
  const lines: string[] = [];
  const kind = fieldAny.kind || "fixed";
  const items = fieldAny.items;
  const fieldName = valueExpr.replace(/^m\./, "");

  // Handle length prefix for length_prefixed arrays
  if (kind === "length_prefixed" || kind === "length_prefixed_items") {
    const lengthType = fieldAny.length_type || "uint8";
    const prefixSize = getPrimitiveSizeForType(lengthType);
    lines.push(`${indent}size += ${prefixSize} // ${fieldName} length prefix`);
  }

  // Handle byte_length_prefixed arrays - need to calculate items size first, then add prefix size
  if (kind === "byte_length_prefixed") {
    const lengthType = fieldAny.length_type || "uint8";
    const lengthEncoding = fieldAny.length_encoding || "der";
    const itemsSizeVar = `${fieldName.replace(/\./g, "_")}_itemsSize`;

    // Calculate items size first
    lines.push(`${indent}${itemsSizeVar} := 0`);
    if (items) {
      const itemType = items.type;
      if (isPrimitiveType(itemType)) {
        const itemSize = getPrimitiveSizeForType(itemType);
        lines.push(`${indent}${itemsSizeVar} = len(${valueExpr}) * ${itemSize}`);
      } else if (itemType === "choice" || itemType === "discriminated_union") {
        const itemVar = fieldName.replace(/\./g, "_") + "_item";
        lines.push(`${indent}for _, ${itemVar} := range ${valueExpr} {`);
        lines.push(`${indent}\t${itemsSizeVar} += ${itemVar}.CalculateSize()`);
        lines.push(`${indent}}`);
      } else {
        // Composite type items
        const itemVar = fieldName.replace(/\./g, "_") + "_item";
        lines.push(`${indent}for _, ${itemVar} := range ${valueExpr} {`);
        lines.push(`${indent}\t${itemsSizeVar} += ${itemVar}.CalculateSize()`);
        lines.push(`${indent}}`);
      }
    }

    // Add length prefix size based on type
    if (lengthType === "varlength") {
      if (lengthEncoding === "der") {
        lines.push(`${indent}size += runtime.VarlengthDERSize(uint64(${itemsSizeVar})) // ${fieldName} byte length prefix (DER)`);
      } else {
        lines.push(`${indent}// TODO: ${lengthEncoding} varlength size calculation`);
        lines.push(`${indent}size += 1 // ${fieldName} byte length prefix (${lengthEncoding}) - approximate`);
      }
    } else {
      const prefixSize = getPrimitiveSizeForType(lengthType);
      lines.push(`${indent}size += ${prefixSize} // ${fieldName} byte length prefix`);
    }

    // Add items size
    lines.push(`${indent}size += ${itemsSizeVar} // ${fieldName} items`);

    return lines;
  }

  // Calculate item sizes (for non-byte_length_prefixed arrays)
  if (items) {
    const itemType = items.type;
    if (isPrimitiveType(itemType)) {
      const itemSize = getPrimitiveSizeForType(itemType);
      lines.push(`${indent}size += len(${valueExpr}) * ${itemSize} // ${fieldName} items`);
    } else if (itemType === "array") {
      // Nested array (2D array) - iterate outer array and calculate inner array sizes
      const innerItems = items.items;
      const itemVar = fieldName.replace(/\./g, "_") + "_item";
      lines.push(`${indent}for _, ${itemVar} := range ${valueExpr} {`);
      if (innerItems && isPrimitiveType(innerItems.type)) {
        const innerSize = getPrimitiveSizeForType(innerItems.type);
        lines.push(`${indent}\tsize += len(${itemVar}) * ${innerSize}`);
      } else {
        // Nested array of composite types
        const innerItemVar = itemVar + "_inner";
        lines.push(`${indent}\tfor _, ${innerItemVar} := range ${itemVar} {`);
        lines.push(`${indent}\t\tsize += ${innerItemVar}.CalculateSize()`);
        lines.push(`${indent}\t}`);
      }
      lines.push(`${indent}}`);
    } else if (itemType === "choice" || itemType === "discriminated_union") {
      // Choice or discriminated union items - encode to measure
      const itemVar = fieldName.replace(/\./g, "_") + "_item";
      lines.push(`${indent}for _, ${itemVar} := range ${valueExpr} {`);
      lines.push(`${indent}\tsize += ${itemVar}.CalculateSize()`);
      lines.push(`${indent}}`);
    } else {
      // Composite type items - call CalculateSize
      const itemVar = fieldName.replace(/\./g, "_") + "_item";
      lines.push(`${indent}for _, ${itemVar} := range ${valueExpr} {`);
      lines.push(`${indent}\tsize += ${itemVar}.CalculateSize()`);
      lines.push(`${indent}}`);
    }
  }

  // Handle null terminator
  if (kind === "null_terminated") {
    lines.push(`${indent}size += 1 // ${fieldName} null terminator`);
  }

  return lines;
}

/**
 * Get the size of a primitive type
 */
function getPrimitiveSizeForType(typeName: string): number {
  switch (typeName) {
    case "uint8":
    case "int8":
      return 1;
    case "uint16":
    case "int16":
      return 2;
    case "uint32":
    case "int32":
    case "float32":
      return 4;
    case "uint64":
    case "int64":
    case "float64":
      return 8;
    default:
      return 1; // Default to 1 byte
  }
}

/**
 * Generates code to resolve a position expression for instance fields
 */
function generatePositionResolution(position: number | string, indent: string): string[] {
  const lines: string[] = [];

  if (typeof position === "number") {
    if (position < 0) {
      // Negative position - from EOF
      lines.push(`${indent}position := len(decoder.Bytes()) + (${position})`);
    } else {
      // Positive position - absolute
      lines.push(`${indent}position := ${position}`);
    }
  } else {
    // Field reference - need to resolve the path
    // Handle dotted paths like "header.offset" or "end_record.dir_offset"
    const parts = position.split(".");

    if (parts.length === 1) {
      // Simple field reference like "data_offset"
      const fieldName = toGoFieldName(parts[0]);
      lines.push(`${indent}position := int(result.${fieldName})`);
    } else {
      // Nested path like "end_record.dir_offset" or "_root.end_record.num_files"
      // Build the access path
      let accessPath = "result";
      for (const part of parts) {
        if (part === "_root") {
          // _root refers to the root object, which in this context is still result
          // since we're in the root decode function
          accessPath = "result";
        } else {
          accessPath += `.${toGoFieldName(part)}`;
        }
      }
      lines.push(`${indent}position := int(${accessPath})`);
    }
  }

  return lines;
}

/**
 * Generates code to decode instance fields using seek
 * @param rootFields - The sequence fields of the root/containing type (for _root.* references)
 */
function generateInstanceFieldDecoding(
  instances: any[],
  schema: BinarySchema,
  defaultEndianness: string,
  indent: string,
  rootFields?: Field[]
): string[] {
  const lines: string[] = [];

  if (!instances || instances.length === 0) {
    return lines;
  }

  lines.push(`${indent}// Decode instance fields (position-based)`);
  lines.push(`${indent}savedPosition := decoder.Position()`);
  lines.push(``);

  // Track decoded instance fields so subsequent instances can reference them
  // Format: { name: string, typeName: string }
  const decodedInstanceFields: { name: string; typeName: string }[] = [];

  for (const instance of instances) {
    const fieldName = toGoFieldName(instance.name);
    const instanceType = instance.type;

    // Use a scoped block for each instance field to allow variable shadowing
    lines.push(`${indent}// Instance field: ${instance.name}`);
    lines.push(`${indent}{`);

    // Resolve position (inside block to avoid redeclaration errors)
    lines.push(...generatePositionResolution(instance.position, indent + "\t"));

    // Validate alignment if specified
    if (instance.alignment && instance.alignment > 1) {
      const alignment = instance.alignment;
      lines.push(`${indent}\tif position % ${alignment} != 0 {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("Position %d is not aligned to ${alignment} bytes (%d %% ${alignment} = %d)", position, position, position % ${alignment})`);
      lines.push(`${indent}\t}`);
    }

    // Seek to position
    lines.push(`${indent}\tdecoder.Seek(position)`);

    // Decode the type at that position
    if (typeof instanceType === "object" && instanceType.discriminator && instanceType.variants) {
      // Inline discriminated union
      lines.push(...generateInlineDiscriminatedUnionDecode(
        instanceType,
        `result.${fieldName}`,
        schema,
        defaultEndianness,
        indent + "\t"
      ));
    } else {
      // Check if the type is a discriminated union (interface) in the schema
      const typeDef = schema.types[instanceType];
      const isDiscriminatedUnion =
        typeDef && ("type" in typeDef && (typeDef as any).type === "discriminated_union") ||
        (typeDef && "variants" in typeDef && "discriminator" in typeDef);

      // Check if the instance type needs context (for field references)
      const instanceTypeNeedsCtx = typeNeedsContext(instanceType, schema);

      if (instanceTypeNeedsCtx) {
        // Build context with _root.* fields from the containing type (sequence fields + already-decoded instance fields)
        lines.push(`${indent}\tinstanceCtx := map[string]interface{}{`);
        if (rootFields) {
          for (const rootField of rootFields) {
            const goFieldName = toGoFieldName(rootField.name);
            lines.push(`${indent}\t\t"_root.${rootField.name}": result.${goFieldName},`);
          }
        }
        // Add already-decoded instance fields to context (expanded to include their sub-fields)
        for (const { name: decodedFieldName, typeName: decodedTypeName } of decodedInstanceFields) {
          const goDecodedFieldName = toGoFieldName(decodedFieldName);
          // Add the instance field itself
          lines.push(`${indent}\t\t"_root.${decodedFieldName}": result.${goDecodedFieldName},`);
          // Also add nested fields from the instance type
          const decodedTypeDef = schema.types[decodedTypeName];
          if (decodedTypeDef && "sequence" in decodedTypeDef) {
            for (const subField of decodedTypeDef.sequence) {
              const goSubFieldName = toGoFieldName(subField.name);
              lines.push(`${indent}\t\t"_root.${decodedFieldName}.${subField.name}": result.${goDecodedFieldName}.${goSubFieldName},`);
            }
          }
        }
        lines.push(`${indent}\t}`);
        lines.push(`${indent}\t${fieldName}Value, err := decode${instanceType}WithDecoderAndContext(decoder, instanceCtx)`);
      } else {
        // Simple type reference - no context needed
        lines.push(`${indent}\t${fieldName}Value, err := decode${instanceType}WithDecoder(decoder)`);
      }
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode instance field ${instance.name}: %w", err)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\tresult.${fieldName} = ${fieldName}Value`);
    }

    lines.push(`${indent}}`);
    lines.push(``);

    // Track this instance field for subsequent decoding
    decodedInstanceFields.push({ name: instance.name, typeName: typeof instanceType === 'string' ? instanceType : '' });
  }

  // Restore position (for sequential parsing after instance fields)
  lines.push(`${indent}decoder.Seek(savedPosition)`);

  return lines;
}

/**
 * Generates code to decode an inline discriminated union for instance fields
 */
function generateInlineDiscriminatedUnionDecode(
  unionDef: any,
  targetVar: string,
  schema: BinarySchema,
  defaultEndianness: string,
  indent: string
): string[] {
  const lines: string[] = [];
  const discriminator = unionDef.discriminator;
  const variants = unionDef.variants;

  // Get discriminator value
  if (discriminator.peek) {
    const peekType = discriminator.peek;
    const peekEndianness = discriminator.endianness || defaultEndianness;
    const runtimeEndianness = mapEndianness(peekEndianness);

    lines.push(`${indent}discriminatorValue, err := decoder.Peek${capitalizeFirst(peekType)}(runtime.${runtimeEndianness})`);
    lines.push(`${indent}if err != nil {`);
    lines.push(`${indent}\treturn nil, fmt.Errorf("failed to peek discriminator: %w", err)`);
    lines.push(`${indent}}`);
  } else if (discriminator.field) {
    // Field-based discriminator
    const fieldPath = discriminator.field;
    const fieldName = toGoFieldName(fieldPath);
    lines.push(`${indent}discriminatorValue := result.${fieldName}`);
  }

  // Generate switch cases
  lines.push(`${indent}switch discriminatorValue {`);
  for (const variant of variants) {
    // Convert "value == 0x01" to Go condition
    const condition = variant.when.replace(/\bvalue\b/g, "discriminatorValue")
      .replace(/===\s*/g, "== ")
      .replace(/!==\s*/g, "!= ");

    // Extract just the value from "discriminatorValue == 0x01"
    const match = condition.match(/==\s*(.+)$/);
    if (match) {
      lines.push(`${indent}case ${match[1].trim()}:`);
    } else {
      // Fallback for other conditions
      lines.push(`${indent}// ${condition}`);
      continue;
    }

    const variantType = variant.type;
    lines.push(`${indent}\tvariantValue, err := decode${variantType}WithDecoder(decoder)`);
    lines.push(`${indent}\tif err != nil {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode ${variantType}: %w", err)`);
    lines.push(`${indent}\t}`);
    // For inline unions, store as wrapped value
    lines.push(`${indent}\t${targetVar} = map[string]interface{}{"type": "${variantType}", "value": variantValue}`);
  }
  lines.push(`${indent}default:`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("unknown discriminator value: %v", discriminatorValue)`);
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates a Decode function for a struct
 */
function generateDecodeFunction(name: string, fields: Field[], defaultEndianness: string, schema: BinarySchema, defaultBitOrder: string = "msb_first", instances?: any[]): string[] {
  const lines: string[] = [];
  const needsCtx = typeNeedsContext(name, schema);
  const runtimeBitOrder = mapBitOrder(defaultBitOrder);

  // Public decode function
  lines.push(`func Decode${name}(bytes []byte) (*${name}, error) {`);
  lines.push(`\tdecoder := runtime.NewBitStreamDecoder(bytes, runtime.${runtimeBitOrder})`);
  if (needsCtx) {
    lines.push(`\treturn decode${name}WithDecoderAndContext(decoder, nil)`);
  } else {
    lines.push(`\treturn decode${name}WithDecoder(decoder)`);
  }
  lines.push(`}`);
  lines.push(``);

  // Helper function that accepts an existing decoder (for nested structs)
  lines.push(`func decode${name}WithDecoder(decoder *runtime.BitStreamDecoder) (*${name}, error) {`);
  if (needsCtx) {
    lines.push(`\treturn decode${name}WithDecoderAndContext(decoder, nil)`);
    lines.push(`}`);
    lines.push(``);

    // Context-aware version
    lines.push(`func decode${name}WithDecoderAndContext(decoder *runtime.BitStreamDecoder, ctx map[string]interface{}) (*${name}, error) {`);
  }
  lines.push(`\tresult := &${name}{}`);
  lines.push(``);

  // Generate decoding logic for each field
  for (const field of fields) {
    lines.push(...generateDecodeField(field, defaultEndianness, "\t", schema, name));
  }

  // Generate instance field decoding (position-based)
  if (instances && instances.length > 0) {
    lines.push(``);
    lines.push(...generateInstanceFieldDecoding(instances, schema, defaultEndianness, "\t", fields));
  }

  lines.push(``);
  lines.push(`\treturn result, nil`);
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates encoding code for a single field
 * @param field - The field to encode
 * @param defaultEndianness - Default endianness from schema
 * @param indent - Current indentation
 * @param containingFields - Optional: all fields in the containing type (for position_of)
 * @param currentFieldIndex - Optional: index of this field in containingFields
 * @param schema - Optional: schema for type lookups
 */
function generateEncodeField(
  field: Field,
  defaultEndianness: string,
  indent: string,
  containingFields?: Field[],
  currentFieldIndex?: number,
  schema?: BinarySchema,
  containingTypeName?: string
): string[] {
  const lines: string[] = [];
  const fieldAny = field as any;
  const endianness = fieldAny.endianness || defaultEndianness;
  const runtimeEndianness = mapEndianness(endianness);

  // Handle padding fields - write zero bytes for alignment
  if (field.type === "padding") {
    const alignTo = fieldAny.align_to || 4;
    lines.push(`${indent}// Alignment padding to ${alignTo}-byte boundary`);
    lines.push(`${indent}{`);
    lines.push(`${indent}\tcurrentPos := encoder.Position()`);
    lines.push(`${indent}\tpaddingBytes := (${alignTo} - (currentPos % ${alignTo})) % ${alignTo}`);
    lines.push(`${indent}\tfor i := 0; i < paddingBytes; i++ {`);
    lines.push(`${indent}\t\tencoder.WriteUint8(0)`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}}`);
    return lines;
  }

  // Handle const fields - write the constant value directly
  if (fieldAny.const !== undefined) {
    const constValue = fieldAny.const;
    return generateEncodeFieldImpl(field, constValue.toString(), endianness, runtimeEndianness, indent);
  }

  // Handle computed fields - compute the value instead of reading from struct
  if (fieldAny.computed) {
    const computed = fieldAny.computed;

    // Check for parent reference (../) or sum_of computed types
    const target = computed.target;
    const targets = computed.targets; // For sum_of_sizes

    // sum_of_sizes uses targets array with parent refs
    // sum_of_type_sizes uses target with parent ref
    const hasParentRef = (target && target.startsWith("../")) ||
                         (targets && Array.isArray(targets) && targets.some((t: string) => t.startsWith("../")));

    if (hasParentRef || computed.type === "sum_of_sizes" || computed.type === "sum_of_type_sizes") {
      // Parent reference or sum_of computed - use special encoding that accesses context
      return generateComputedFieldEncoding(field, computed, endianness, runtimeEndianness, indent, containingTypeName);
    }

    const computedValue = generateComputedValue(
      computed,
      field.type,
      indent,
      field.name,
      containingFields,
      currentFieldIndex,
      schema
    );
    return generateEncodeFieldImpl(field, computedValue, endianness, runtimeEndianness, indent);
  }

  const fieldName = `m.${toGoFieldName(field.name)}`;

  // Handle conditional fields
  if (fieldAny.conditional) {
    const condition = convertConditionalToGo(fieldAny.conditional);
    lines.push(`${indent}if ${condition} {`);
    const innerLines = generateEncodeFieldImpl(field, fieldName, endianness, runtimeEndianness, indent + "\t");
    lines.push(...innerLines);
    lines.push(`${indent}}`);
    return lines;
  }

  // Handle optional fields
  if (field.type === "optional") {
    return generateEncodeOptional(field as any, fieldName, endianness, runtimeEndianness, indent);
  }

  // Handle choice arrays that need corresponding tracking
  // These arrays need array iteration context with type occurrence indices
  if (field.type === "array" && schema) {
    const items = (field as any).items;
    if (items?.type === "choice") {
      const correspondingArrays = detectArraysNeedingCorrespondingTracking(schema);
      if (correspondingArrays.has(field.name)) {
        return generateEncodeArrayWithCorresponding(field as any, fieldName, endianness, runtimeEndianness, indent);
      }
    }

    // Also handle non-choice arrays whose items use corresponding selectors (cross-array references)
    const typesUsingCorresponding = detectTypesUsingCorrespondingSelectors(schema);
    const itemType = items?.type;
    if (itemType && !itemType.includes('.') && schema.types[itemType] && typesUsingCorresponding.has(itemType)) {
      return generateEncodeArrayWithIterationContext(field as any, fieldName, endianness, runtimeEndianness, indent, itemType);
    }
  }

  return generateEncodeFieldImpl(field, fieldName, endianness, runtimeEndianness, indent);
}

/**
 * Generates encoding code for choice arrays that need corresponding<Type> tracking.
 * This generates special loop code with array iteration context extension and type occurrence tracking.
 */
function generateEncodeArrayWithCorresponding(
  field: any,
  fieldName: string,
  endianness: string,
  runtimeEndianness: string,
  indent: string
): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;
  const choices = items.choices || [];
  const arrName = field.name;
  const itemVar = `${arrName}_item`;
  const idxVar = `${arrName}_idx`;

  // Write length prefix for length_prefixed arrays
  if (kind === "length_prefixed" || kind === "length_prefixed_items") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}encoder.WriteUint8(uint8(len(${fieldName})))`);
        break;
      case "uint16":
        lines.push(`${indent}encoder.WriteUint16(uint16(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}encoder.WriteUint32(uint32(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}encoder.WriteUint64(uint64(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
    }
  }

  lines.push(`${indent}// Encode choice array with corresponding<Type> tracking`);
  lines.push(`${indent}for ${idxVar}, ${itemVar} := range ${fieldName} {`);

  // Extend context with array iteration
  // The context extension needs to happen at each iteration with the current index
  lines.push(`${indent}\t// Extend context with array iteration state`);
  lines.push(`${indent}\t${arrName}_iterCtx := childCtx.ExtendWithArrayIteration("${arrName}", ${fieldName}, ${idxVar})`);

  // Determine item type and increment type counter
  lines.push(`${indent}\t// Increment type occurrence counter for the item type`);
  lines.push(`${indent}\tswitch v := ${itemVar}.(type) {`);

  for (const choice of choices) {
    const goTypeName = toGoTypeName(choice.type);
    lines.push(`${indent}\tcase *${goTypeName}:`);
    lines.push(`${indent}\t\t${arrName}_iterCtx.IncrementTypeIndex("${arrName}", "${choice.type}")`);
    lines.push(`${indent}\t\t${itemVar}_bytes, err := v.EncodeWithContext(${arrName}_iterCtx)`);
    lines.push(`${indent}\t\tif err != nil {`);
    lines.push(`${indent}\t\t\treturn nil, fmt.Errorf("failed to encode ${choice.type}: %w", err)`);
    lines.push(`${indent}\t\t}`);
    lines.push(`${indent}\t\tfor _, b := range ${itemVar}_bytes {`);
    lines.push(`${indent}\t\t\tencoder.WriteUint8(b)`);
    lines.push(`${indent}\t\t}`);
  }

  lines.push(`${indent}\tdefault:`);
  lines.push(`${indent}\t\treturn nil, fmt.Errorf("unknown choice type in ${arrName}: %T", ${itemVar})`);
  lines.push(`${indent}\t}`);
  lines.push(`${indent}}`);

  // Handle null terminator for null_terminated arrays
  if (kind === "null_terminated") {
    lines.push(`${indent}encoder.WriteUint8(0)`);
  }

  return lines;
}

/**
 * Generates encoding code for non-choice arrays whose items use corresponding selectors.
 * This sets up iteration context so cross-array correlation can find the current array index.
 */
function generateEncodeArrayWithIterationContext(
  field: any,
  fieldName: string,
  endianness: string,
  runtimeEndianness: string,
  indent: string,
  itemType: string
): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const arrName = field.name;
  const itemVar = `${arrName}_item`;
  const idxVar = `${arrName}_idx`;
  const goItemType = toGoTypeName(itemType);

  // Write length prefix for length_prefixed arrays
  if (kind === "length_prefixed" || kind === "length_prefixed_items") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}encoder.WriteUint8(uint8(len(${fieldName})))`);
        break;
      case "uint16":
        lines.push(`${indent}encoder.WriteUint16(uint16(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}encoder.WriteUint32(uint32(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}encoder.WriteUint64(uint64(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
    }
  }

  lines.push(`${indent}// Encode array with iteration context for cross-array correlation`);
  lines.push(`${indent}for ${idxVar}, ${itemVar} := range ${fieldName} {`);

  // Extend context with array iteration
  lines.push(`${indent}\t// Extend context with array iteration state for cross-array references`);
  lines.push(`${indent}\t${arrName}_iterCtx := childCtx.ExtendWithArrayIteration("${arrName}", ${fieldName}, ${idxVar})`);

  // Encode item with context
  lines.push(`${indent}\t${itemVar}_bytes, err := ${itemVar}.EncodeWithContext(${arrName}_iterCtx)`);
  lines.push(`${indent}\tif err != nil {`);
  lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to encode ${itemType}: %w", err)`);
  lines.push(`${indent}\t}`);
  lines.push(`${indent}\tfor _, b := range ${itemVar}_bytes {`);
  lines.push(`${indent}\t\tencoder.WriteUint8(b)`);
  lines.push(`${indent}\t}`);
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates encoding implementation for a field (without conditional/optional wrapper)
 */
function generateEncodeFieldImpl(field: Field, fieldName: string, endianness: string, runtimeEndianness: string, indent: string): string[] {
  const lines: string[] = [];

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.WriteUint8(${fieldName})`);
      break;

    case "uint16":
      lines.push(`${indent}encoder.WriteUint16(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "uint32":
      lines.push(`${indent}encoder.WriteUint32(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "uint64":
      lines.push(`${indent}encoder.WriteUint64(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "int8":
      lines.push(`${indent}encoder.WriteInt8(${fieldName})`);
      break;

    case "int16":
      lines.push(`${indent}encoder.WriteInt16(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "int32":
      lines.push(`${indent}encoder.WriteInt32(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "int64":
      lines.push(`${indent}encoder.WriteInt64(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "float32":
      lines.push(`${indent}encoder.WriteFloat32(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "float64":
      lines.push(`${indent}encoder.WriteFloat64(${fieldName}, runtime.${runtimeEndianness})`);
      break;

    case "bit":
    case "int": {
      // Bitfield - write individual bits
      const bitSize = (field as any).size || 1;
      lines.push(`${indent}encoder.WriteBits(uint64(${fieldName}), ${bitSize})`);
      break;
    }

    case "bitfield": {
      // Bitfield container - encode nested fields using WriteBits
      const bitfieldFields = (field as any).fields || [];
      for (const subField of bitfieldFields) {
        const subFieldName = toGoFieldName(subField.name);
        lines.push(`${indent}encoder.WriteBits(uint64(${fieldName}.${subFieldName}), ${subField.size})`);
      }
      break;
    }

    case "varlength": {
      // Variable-length integer - use encoding-specific method
      const varlengthEncoding = (field as any).encoding || "der";
      const methodMap: { [key: string]: string } = {
        'der': 'WriteVarlengthDER',
        'leb128': 'WriteVarlengthLEB128',
        'ebml': 'WriteVarlengthEBML',
        'vlq': 'WriteVarlengthVLQ'
      };
      const method = methodMap[varlengthEncoding] || 'WriteVarlengthDER';
      lines.push(`${indent}encoder.${method}(${fieldName})`);
      break;
    }

    case "string":
      lines.push(...generateEncodeString(field as any, fieldName, endianness, indent));
      break;

    case "array":
      lines.push(...generateEncodeArray(field as any, fieldName, endianness, runtimeEndianness, indent));
      break;

    case "choice":
      // Choice type - encode via interface method
      lines.push(...generateEncodeNestedStruct(field, fieldName, indent));
      break;

    case "discriminated_union":
      // Inline discriminated union - encode via interface method
      lines.push(...generateEncodeInlineDiscriminatedUnion(field as any, fieldName, endianness, runtimeEndianness, indent));
      break;

    case "back_reference":
      // Back reference - encode the target type value
      lines.push(...generateEncodeBackReferenceImpl(field as any, fieldName, endianness, runtimeEndianness, indent));
      break;

    default:
      // Type reference - nested struct
      lines.push(...generateEncodeNestedStruct(field, fieldName, indent));
      break;
  }

  return lines;
}

/**
 * Generates encoding code for optional field
 */
function generateEncodeOptional(field: any, fieldName: string, endianness: string, runtimeEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const presenceType = field.presence_type || "uint8";

  lines.push(`${indent}if ${fieldName} != nil {`);

  // Write presence indicator (1 = present)
  if (presenceType === "uint8") {
    lines.push(`${indent}\tencoder.WriteUint8(1)`);
  } else {
    lines.push(`${indent}\tencoder.WriteBit(1)`);
  }

  // Write value (dereference pointer)
  const valueField: Field = {
    name: "",
    type: field.value_type
  };
  const innerLines = generateEncodeFieldImpl(valueField, `*${fieldName}`, endianness, runtimeEndianness, indent + "\t");
  lines.push(...innerLines);

  lines.push(`${indent}} else {`);

  // Write presence indicator (0 = absent)
  if (presenceType === "uint8") {
    lines.push(`${indent}\tencoder.WriteUint8(0)`);
  } else {
    lines.push(`${indent}\tencoder.WriteBit(0)`);
  }

  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates encoding code for string field
 */
function generateEncodeString(field: any, fieldName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const encoding = field.encoding || "utf8";
  // Strip leading * (dereference) for variable naming
  const cleanFieldName = fieldName.replace(/^\*/, "");
  const bytesVar = `${cleanFieldName.replace(/\./g, "_")}_bytes`;

  // Convert string to bytes (encoding-dependent)
  if (encoding === "latin1" || encoding === "ascii") {
    // Latin-1/ASCII: convert each rune (Unicode code point) to its byte value
    // This works because Latin-1 code points 0-255 map directly to byte values
    lines.push(`${indent}${bytesVar} := make([]byte, 0, len(${fieldName}))`);
    lines.push(`${indent}for _, r := range ${fieldName} {`);
    lines.push(`${indent}\t${bytesVar} = append(${bytesVar}, byte(r))`);
    lines.push(`${indent}}`);
  } else {
    // UTF-8: use Go's native string->byte conversion
    lines.push(`${indent}${bytesVar} := []byte(${fieldName})`);
  }

  switch (kind) {
    case "length_prefixed": {
      const lengthType = field.length_type || "uint8";
      // Write length prefix
      switch (lengthType) {
        case "uint8":
          lines.push(`${indent}encoder.WriteUint8(uint8(len(${bytesVar})))`);
          break;
        case "uint16":
          lines.push(`${indent}encoder.WriteUint16(uint16(len(${bytesVar})), runtime.${mapEndianness(endianness)})`);
          break;
        case "uint32":
          lines.push(`${indent}encoder.WriteUint32(uint32(len(${bytesVar})), runtime.${mapEndianness(endianness)})`);
          break;
        case "uint64":
          lines.push(`${indent}encoder.WriteUint64(uint64(len(${bytesVar})), runtime.${mapEndianness(endianness)})`);
          break;
      }
      // Write bytes
      lines.push(`${indent}for _, b := range ${bytesVar} {`);
      lines.push(`${indent}\tencoder.WriteUint8(b)`);
      lines.push(`${indent}}`);
      break;
    }

    case "null_terminated":
      // Write bytes then null terminator
      lines.push(`${indent}for _, b := range ${bytesVar} {`);
      lines.push(`${indent}\tencoder.WriteUint8(b)`);
      lines.push(`${indent}}`);
      lines.push(`${indent}encoder.WriteUint8(0)`);
      break;

    case "fixed": {
      const length = field.length || 0;
      // Write bytes (padded or truncated to fixed length)
      lines.push(`${indent}for i := 0; i < ${length}; i++ {`);
      lines.push(`${indent}\tif i < len(${bytesVar}) {`);
      lines.push(`${indent}\t\tencoder.WriteUint8(${bytesVar}[i])`);
      lines.push(`${indent}\t} else {`);
      lines.push(`${indent}\t\tencoder.WriteUint8(0)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}}`);
      break;
    }

    case "field_referenced":
      // Length is determined by a separate field (already written)
      // Just write the bytes
      lines.push(`${indent}for _, b := range ${bytesVar} {`);
      lines.push(`${indent}\tencoder.WriteUint8(b)`);
      lines.push(`${indent}}`);
      break;

    default:
      throw new Error(`Unknown string kind: ${kind}`);
  }

  return lines;
}

/**
 * Generates encoding code for array field
 */
function generateEncodeArray(field: any, fieldName: string, endianness: string, runtimeEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;

  // Write length prefix for length_prefixed arrays
  if (kind === "length_prefixed" || kind === "length_prefixed_items") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}encoder.WriteUint8(uint8(len(${fieldName})))`);
        break;
      case "uint16":
        lines.push(`${indent}encoder.WriteUint16(uint16(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}encoder.WriteUint32(uint32(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}encoder.WriteUint64(uint64(len(${fieldName})), runtime.${runtimeEndianness})`);
        break;
    }
  }

  // Write byte length prefix for byte_length_prefixed arrays
  // For primitive types, byte length = len(arr) * item_size
  if (kind === "byte_length_prefixed") {
    const lengthType = field.length_type || "uint8";
    const itemType = items.type;
    let byteLengthExpr = "";

    // Calculate byte length based on item type
    if (isPrimitiveType(itemType)) {
      const primitiveSize = getPrimitiveSize(itemType);
      byteLengthExpr = `len(${fieldName}) * ${primitiveSize}`;
    } else {
      // For complex types, we need to calculate size - use CalculateSize if available
      // For now, encode to temp buffer and measure
      const tempEncoderVar = `${fieldName.replace(/\./g, "_")}_tempEncoder`;
      const byteLengthVar = `${fieldName.replace(/\./g, "_")}_byteLength`;
      lines.push(`${indent}// Calculate byte length by encoding to temp buffer`);
      lines.push(`${indent}${tempEncoderVar} := runtime.NewBitStreamEncoder(runtime.MSBFirst)`);
      lines.push(`${indent}for _, item := range ${fieldName} {`);
      lines.push(`${indent}\titemBytes, err := item.EncodeWithContext(childCtx)`);
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, err`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\tfor _, b := range itemBytes {`);
      lines.push(`${indent}\t\t${tempEncoderVar}.WriteUint8(b)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}}`);
      lines.push(`${indent}${byteLengthVar} := ${tempEncoderVar}.Position()`);
      lines.push(`${indent}_ = ${byteLengthVar} // Suppress unused variable warning in from_after_field contexts`);
      byteLengthExpr = byteLengthVar;
    }

    // Write the byte length prefix
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}encoder.WriteUint8(uint8(${byteLengthExpr}))`);
        break;
      case "uint16":
        lines.push(`${indent}encoder.WriteUint16(uint16(${byteLengthExpr}), runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}encoder.WriteUint32(uint32(${byteLengthExpr}), runtime.${runtimeEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}encoder.WriteUint64(uint64(${byteLengthExpr}), runtime.${runtimeEndianness})`);
        break;
      case "varlength": {
        // Handle varlength length_type with different encodings
        const lengthEncoding = (field as any).length_encoding || "der";
        const methodMap: { [key: string]: string } = {
          'der': 'WriteVarlengthDER',
          'leb128': 'WriteVarlengthLEB128',
          'ebml': 'WriteVarlengthEBML',
          'vlq': 'WriteVarlengthVLQ'
        };
        const writeMethod = methodMap[lengthEncoding] || 'WriteVarlengthDER';
        lines.push(`${indent}encoder.${writeMethod}(uint64(${byteLengthExpr}))`);
        break;
      }
    }
  }

  // Skip encoding for field_referenced arrays (length already encoded in the referenced field)
  if (kind === "field_referenced") {
    // Don't write length - it's already written in another field
  }

  // Generate loop variable name
  const itemVar = `${fieldName.replace(/\./g, "_").replace(/^m_/, "")}_item`;

  // Handle greedy arrays (no length prefix, no terminator - just encode all items)
  if (kind === "greedy") {
    // Just encode items - no prefix, no terminator
  }

  // For length_prefixed_items, encode each item separately with a length prefix
  if (kind === "length_prefixed_items") {
    const itemLengthType = field.item_length_type || "uint32";
    const itemType = items.type;

    lines.push(`${indent}for _, ${itemVar} := range ${fieldName} {`);

    // For primitive types, write fixed-size length prefix and encode inline
    if (isPrimitiveType(itemType)) {
      const primitiveSize = getPrimitiveSize(itemType);

      // Write item length
      switch (itemLengthType) {
        case "uint8":
          lines.push(`${indent}\tencoder.WriteUint8(${primitiveSize})`);
          break;
        case "uint16":
          lines.push(`${indent}\tencoder.WriteUint16(${primitiveSize}, runtime.${runtimeEndianness})`);
          break;
        case "uint32":
          lines.push(`${indent}\tencoder.WriteUint32(${primitiveSize}, runtime.${runtimeEndianness})`);
          break;
        case "uint64":
          lines.push(`${indent}\tencoder.WriteUint64(${primitiveSize}, runtime.${runtimeEndianness})`);
          break;
      }

      // Encode primitive inline
      const itemField: Field = { name: "", type: itemType, ...(items as any) };
      const innerLines = generateEncodeFieldImpl(itemField, itemVar, endianness, runtimeEndianness, indent + "\t");
      lines.push(...innerLines);
    } else {
      // For struct types, encode to bytes first
      const itemBytesVar = `${itemVar}_bytes`;
      lines.push(`${indent}\t${itemBytesVar}, err := ${itemVar}.EncodeWithContext(childCtx)`);
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, err`);
      lines.push(`${indent}\t}`);

      // Write item length
      switch (itemLengthType) {
        case "uint8":
          lines.push(`${indent}\tencoder.WriteUint8(uint8(len(${itemBytesVar})))`);
          break;
        case "uint16":
          lines.push(`${indent}\tencoder.WriteUint16(uint16(len(${itemBytesVar})), runtime.${runtimeEndianness})`);
          break;
        case "uint32":
          lines.push(`${indent}\tencoder.WriteUint32(uint32(len(${itemBytesVar})), runtime.${runtimeEndianness})`);
          break;
        case "uint64":
          lines.push(`${indent}\tencoder.WriteUint64(uint64(len(${itemBytesVar})), runtime.${runtimeEndianness})`);
          break;
      }

      // Write item bytes
      lines.push(`${indent}\tfor _, b := range ${itemBytesVar} {`);
      lines.push(`${indent}\t\tencoder.WriteUint8(b)`);
      lines.push(`${indent}\t}`);
    }

    lines.push(`${indent}}`);
  } else {
    // Regular array encoding (fixed, length_prefixed, null_terminated, variant_terminated, signature_terminated)
    const terminalVariants = (field as any).terminal_variants;
    const hasTerminalVariants = terminalVariants && Array.isArray(terminalVariants) && terminalVariants.length > 0;

    // Track if we hit a terminal variant (for null_terminated with terminal_variants)
    const terminatedVarName = `${itemVar}_terminated`;
    if (kind === "null_terminated" && hasTerminalVariants) {
      lines.push(`${indent}${terminatedVarName} := false`);
    }

    // Use a labeled loop if we need to break for terminal variants
    if ((kind === "null_terminated" || kind === "variant_terminated") && hasTerminalVariants) {
      const loopLabel = `${itemVar}Loop`;
      lines.push(`${indent}${loopLabel}:`);
      lines.push(`${indent}for _, ${itemVar} := range ${fieldName} {`);
    } else {
      lines.push(`${indent}for _, ${itemVar} := range ${fieldName} {`);
    }

    const itemField: Field = {
      name: "",
      type: items.type,
      ...(items as any)
    };
    const innerLines = generateEncodeFieldImpl(itemField, itemVar, endianness, runtimeEndianness, indent + "\t");
    lines.push(...innerLines);

    // Check for terminal variants and break if encountered
    if ((kind === "null_terminated" || kind === "variant_terminated") && hasTerminalVariants) {
      const loopLabel = `${itemVar}Loop`;
      lines.push(`${indent}\t// Check if item is a terminal variant`);
      lines.push(`${indent}\tswitch ${itemVar}.(type) {`);
      for (const terminalVariant of terminalVariants) {
        const goTypeName = toGoTypeName(terminalVariant);
        lines.push(`${indent}\tcase *${goTypeName}:`);
        if (kind === "null_terminated") {
          lines.push(`${indent}\t\t${terminatedVarName} = true`);
        }
        lines.push(`${indent}\t\tbreak ${loopLabel} // Terminal variant - stop encoding`);
      }
      lines.push(`${indent}\t}`);
    }

    lines.push(`${indent}}`);

    // Write null terminator for null_terminated arrays
    if (kind === "null_terminated") {
      if (hasTerminalVariants) {
        // Only write null terminator if no terminal variant was hit
        lines.push(`${indent}if !${terminatedVarName} {`);
        lines.push(`${indent}\tencoder.WriteUint8(0)`);
        lines.push(`${indent}}`);
      } else {
        lines.push(`${indent}encoder.WriteUint8(0)`);
      }
    }
    // For variant_terminated and signature_terminated, no terminator is needed
  }

  return lines;
}

/**
 * Generates encoding code for nested struct
 * Uses childCtx (extended with parent fields) instead of ctx
 */
function generateEncodeNestedStruct(field: Field, fieldName: string, indent: string): string[] {
  const lines: string[] = [];
  // Strip leading * (dereference) for variable naming
  const cleanFieldName = fieldName.replace(/^\*/, "");
  const bytesVar = `${cleanFieldName.replace(/\./g, "_")}_bytes`;

  // If fieldName starts with * (dereference), wrap in parens for method call
  // e.g., *m.Name.Encode() parses as *(m.Name.Encode()) but we need (*m.Name).Encode()
  const encodeTarget = fieldName.startsWith("*") ? `(${fieldName})` : fieldName;
  // Use childCtx which includes parent fields for ../ references
  lines.push(`${indent}${bytesVar}, err := ${encodeTarget}.EncodeWithContext(childCtx)`);
  lines.push(`${indent}if err != nil {`);
  lines.push(`${indent}\treturn nil, err`);
  lines.push(`${indent}}`);
  lines.push(`${indent}for _, b := range ${bytesVar} {`);
  lines.push(`${indent}\tencoder.WriteUint8(b)`);
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Converts conditional expression to Go syntax
 * @param condition - The condition expression (e.g., "version >= 2")
 * @param prefix - The struct variable prefix (e.g., "m" for encoder, "result" for decoder)
 */
function convertConditionalToGo(condition: string, prefix: string = "m"): string {
  // Helper to convert field path to Go field path
  const toGoPath = (fieldPath: string): string => {
    const parts = fieldPath.split(".");
    return prefix + "." + parts.map(toGoFieldName).join(".");
  };

  // Pattern 1: Simple comparison: "field == value", "field >= value", etc.
  // E.g., "version >= 2" -> "m.Version >= 2"
  const simpleComparisonMatch = condition.match(/^(\w+(?:\.\w+)*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (simpleComparisonMatch) {
    const [, fieldPath, operator, value] = simpleComparisonMatch;
    return `${toGoPath(fieldPath)} ${operator} ${value}`;
  }

  // Pattern 2: Bitwise AND truthiness check: "flags & 0x01" (no comparison)
  // E.g., "flags & 0x01" -> "(m.Flags & 0x01) != 0"
  const bitwiseAndMatch = condition.match(/^(\w+(?:\.\w+)*)\s*&\s*(.+)$/);
  if (bitwiseAndMatch) {
    const [, fieldPath, mask] = bitwiseAndMatch;
    return `(${toGoPath(fieldPath)} & ${mask}) != 0`;
  }

  // Pattern 3: Parenthesized bitwise AND with comparison: "(flags & 0x01) == value"
  // E.g., "(flags & mask) == 1" -> "(m.Flags & mask) == 1"
  const parenBitwiseMatch = condition.match(/^\((\w+(?:\.\w+)*)\s*&\s*([^)]+)\)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (parenBitwiseMatch) {
    const [, fieldPath, mask, operator, value] = parenBitwiseMatch;
    return `(${toGoPath(fieldPath)} & ${mask}) ${operator} ${value}`;
  }

  // Pattern 4: Just a field name (boolean check): "has_data"
  // E.g., "has_data" -> "m.HasData" (for boolean fields)
  const simpleFieldMatch = condition.match(/^(\w+(?:\.\w+)*)$/);
  if (simpleFieldMatch) {
    const [, fieldPath] = simpleFieldMatch;
    return toGoPath(fieldPath);
  }

  throw new Error(`Could not parse conditional: ${condition}`);
}

/**
 * Generates decoding code for a single field
 */
function generateDecodeField(field: Field, defaultEndianness: string, indent: string, schema: BinarySchema, parentTypeName?: string): string[] {
  const lines: string[] = [];
  const fieldAny = field as any;

  // Handle padding fields - skip alignment bytes
  if (field.type === "padding") {
    const alignTo = fieldAny.align_to || 4;
    lines.push(`${indent}// Skip alignment padding to ${alignTo}-byte boundary`);
    lines.push(`${indent}{`);
    lines.push(`${indent}\tcurrentPos := decoder.Position()`);
    lines.push(`${indent}\tpaddingBytes := (${alignTo} - (currentPos % ${alignTo})) % ${alignTo}`);
    lines.push(`${indent}\tdecoder.SkipBytes(paddingBytes)`);
    lines.push(`${indent}}`);
    lines.push(``);
    return lines;
  }

  const fieldName = toGoFieldName(field.name);
  const varName = toGoVarName(field.name);
  const endianness = fieldAny.endianness || defaultEndianness;
  const runtimeEndianness = mapEndianness(endianness);

  // Handle conditional fields
  if (fieldAny.conditional) {
    const condition = convertConditionalToGo(fieldAny.conditional, "result");
    lines.push(`${indent}if ${condition} {`);
    const innerLines = generateDecodeFieldImpl(field, fieldName, varName, endianness, runtimeEndianness, indent + "\t", schema, parentTypeName);
    lines.push(...innerLines);
    lines.push(`${indent}}`);
    lines.push(``);
    return lines;
  }

  // Handle optional fields
  if (field.type === "optional") {
    return generateDecodeOptional(field as any, fieldName, varName, endianness, runtimeEndianness, indent);
  }

  return generateDecodeFieldImpl(field, fieldName, varName, endianness, runtimeEndianness, indent, schema, parentTypeName);
}

/**
 * Generates decoding implementation for a field (without conditional/optional wrapper)
 */
function generateDecodeFieldImpl(field: Field, fieldName: string, varName: string, endianness: string, runtimeEndianness: string, indent: string, schema?: BinarySchema, parentTypeName?: string): string[] {
  const lines: string[] = [];

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}${varName}, err := decoder.ReadUint8()`);
      break;

    case "uint16":
      lines.push(`${indent}${varName}, err := decoder.ReadUint16(runtime.${runtimeEndianness})`);
      break;

    case "uint32":
      lines.push(`${indent}${varName}, err := decoder.ReadUint32(runtime.${runtimeEndianness})`);
      break;

    case "uint64":
      lines.push(`${indent}${varName}, err := decoder.ReadUint64(runtime.${runtimeEndianness})`);
      break;

    case "int8":
      lines.push(`${indent}${varName}, err := decoder.ReadInt8()`);
      break;

    case "int16":
      lines.push(`${indent}${varName}, err := decoder.ReadInt16(runtime.${runtimeEndianness})`);
      break;

    case "int32":
      lines.push(`${indent}${varName}, err := decoder.ReadInt32(runtime.${runtimeEndianness})`);
      break;

    case "int64":
      lines.push(`${indent}${varName}, err := decoder.ReadInt64(runtime.${runtimeEndianness})`);
      break;

    case "float32":
      lines.push(`${indent}${varName}, err := decoder.ReadFloat32(runtime.${runtimeEndianness})`);
      break;

    case "float64":
      lines.push(`${indent}${varName}, err := decoder.ReadFloat64(runtime.${runtimeEndianness})`);
      break;

    case "bit": {
      // Bitfield - read individual bits
      const bitSize = (field as any).size || 1;
      const goType = mapFieldToGoType(field);
      lines.push(`${indent}${varName}Bits, err := decoder.ReadBits(${bitSize})`);
      lines.push(`${indent}if err != nil {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name || 'bit value'}: %w", err)`);
      lines.push(`${indent}}`);
      lines.push(`${indent}${varName} := ${goType}(${varName}Bits)`);
      if (fieldName) {
        lines.push(`${indent}result.${fieldName} = ${varName}`);
        lines.push(``);
      }
      return lines;
    }

    case "int": {
      // Signed int bitfield
      const bitSize = (field as any).size || 8;
      const goType = mapFieldToGoType(field);
      lines.push(`${indent}${varName}Bits, err := decoder.ReadBits(${bitSize})`);
      lines.push(`${indent}if err != nil {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name || 'int value'}: %w", err)`);
      lines.push(`${indent}}`);
      lines.push(`${indent}${varName} := ${goType}(${varName}Bits)`);
      if (fieldName) {
        lines.push(`${indent}result.${fieldName} = ${varName}`);
        lines.push(``);
      }
      return lines;
    }

    case "bitfield": {
      // Bitfield container - decode nested fields using ReadBits
      const bitfieldSubFields = (field as any).fields || [];
      for (const subField of bitfieldSubFields) {
        const subFieldName = toGoFieldName(subField.name);
        const goType = subField.size <= 8 ? "uint8" :
                       subField.size <= 16 ? "uint16" :
                       subField.size <= 32 ? "uint32" : "uint64";
        lines.push(`${indent}${varName}_${subFieldName}, err := decoder.ReadBits(${subField.size})`);
        lines.push(`${indent}if err != nil {`);
        lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name}.${subField.name}: %w", err)`);
        lines.push(`${indent}}`);
        lines.push(`${indent}result.${fieldName}.${subFieldName} = ${goType}(${varName}_${subFieldName})`);
      }
      lines.push(``);
      return lines;
    }

    case "varlength": {
      // Variable-length integer - use encoding-specific method
      const varlengthEncoding = (field as any).encoding || "der";
      const methodMap: { [key: string]: string } = {
        'der': 'ReadVarlengthDER',
        'leb128': 'ReadVarlengthLEB128',
        'ebml': 'ReadVarlengthEBML',
        'vlq': 'ReadVarlengthVLQ'
      };
      const method = methodMap[varlengthEncoding] || 'ReadVarlengthDER';
      lines.push(`${indent}${varName}, err := decoder.${method}()`);
      lines.push(`${indent}if err != nil {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name || 'varlength value'}: %w", err)`);
      lines.push(`${indent}}`);
      if (fieldName) {
        lines.push(`${indent}result.${fieldName} = ${varName}`);
        lines.push(``);
      }
      return lines;
    }

    case "string":
      lines.push(...generateDecodeString(field as any, fieldName, varName, endianness, indent));
      return lines; // Early return - string handling includes assignment

    case "array":
      lines.push(...generateDecodeArray(field as any, fieldName, varName, endianness, runtimeEndianness, indent, schema, parentTypeName));
      return lines; // Early return - array handling includes assignment

    case "discriminated_union":
      lines.push(...generateDecodeInlineDiscriminatedUnion(field as any, fieldName, varName, endianness, runtimeEndianness, indent, schema, parentTypeName));
      return lines; // Early return - union handling includes assignment

    case "back_reference":
      lines.push(...generateDecodeBackReference(field as any, fieldName, varName, endianness, runtimeEndianness, indent));
      return lines; // Early return - back reference handling includes assignment

    default:
      // Type reference - nested struct
      lines.push(...generateDecodeNestedStruct(field, fieldName, varName, indent));
      return lines; // Early return - nested struct handling includes assignment
  }

  // Error handling (for primitives)
  lines.push(`${indent}if err != nil {`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name || 'value'}: %w", err)`);
  lines.push(`${indent}}`);

  // Assign to result (for primitives)
  if (fieldName) {
    lines.push(`${indent}result.${fieldName} = ${varName}`);
    lines.push(``);
  }

  return lines;
}

/**
 * Generates decoding code for optional field
 */
function generateDecodeOptional(field: any, fieldName: string, varName: string, endianness: string, runtimeEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const presenceType = field.presence_type || "uint8";
  const presenceVar = `${varName}Present`;

  // Read presence indicator
  if (presenceType === "uint8") {
    lines.push(`${indent}${presenceVar}, err := decoder.ReadUint8()`);
  } else {
    lines.push(`${indent}${presenceVar}, err := decoder.ReadBit()`);
  }

  lines.push(`${indent}if err != nil {`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name} presence: %w", err)`);
  lines.push(`${indent}}`);

  lines.push(`${indent}if ${presenceVar} == 1 {`);

  // Read value
  const valueField: Field = {
    name: "",
    type: field.value_type
  };
  const valueVar = `${varName}Value`;
  const innerLines = generateDecodeFieldImpl(valueField, "", valueVar, endianness, runtimeEndianness, indent + "\t");
  lines.push(...innerLines);

  // Assign to result - type references return pointers, primitives need address-of
  const valueType = field.value_type;
  const primitiveTypes = ["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "float32", "float64", "string", "array", "bit", "int", "varlength"];
  const isTypeRef = !primitiveTypes.includes(valueType) && typeof valueType === "string";
  if (isTypeRef) {
    // Type reference decode returns pointer, assign directly
    lines.push(`${indent}\tresult.${fieldName} = ${valueVar}`);
  } else {
    // Primitive value, take address
    lines.push(`${indent}\tresult.${fieldName} = &${valueVar}`);
  }

  lines.push(`${indent}}`);
  lines.push(``);

  return lines;
}

/**
 * Generates decoding code for string field
 */
function generateDecodeString(field: any, fieldName: string, varName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const encoding = field.encoding || "utf8";
  const bytesVar = `${varName}Bytes`;

  switch (kind) {
    case "length_prefixed": {
      const lengthType = field.length_type || "uint8";
      // Read length prefix - use unique variable name to avoid redeclaration
      const lengthVarName = `${varName}Length`;
      switch (lengthType) {
        case "uint8":
          lines.push(`${indent}${lengthVarName}, err := decoder.ReadUint8()`);
          break;
        case "uint16":
          lines.push(`${indent}${lengthVarName}, err := decoder.ReadUint16(runtime.${mapEndianness(endianness)})`);
          break;
        case "uint32":
          lines.push(`${indent}${lengthVarName}, err := decoder.ReadUint32(runtime.${mapEndianness(endianness)})`);
          break;
        case "uint64":
          lines.push(`${indent}${lengthVarName}, err := decoder.ReadUint64(runtime.${mapEndianness(endianness)})`);
          break;
      }
      lines.push(`${indent}if err != nil {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name} length: %w", err)`);
      lines.push(`${indent}}`);

      // Read bytes
      lines.push(`${indent}${bytesVar} := make([]byte, ${lengthVarName})`);
      lines.push(`${indent}for i := range ${bytesVar} {`);
      lines.push(`${indent}\tb, err := decoder.ReadUint8()`);
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode ${field.name}: %w", err)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\t${bytesVar}[i] = b`);
      lines.push(`${indent}}`);
      break;
    }

    case "null_terminated":
      // Read until null terminator
      lines.push(`${indent}${bytesVar} := []byte{}`);
      lines.push(`${indent}for {`);
      lines.push(`${indent}\tb, err := decoder.ReadUint8()`);
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode ${field.name}: %w", err)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\tif b == 0 {`);
      lines.push(`${indent}\t\tbreak`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\t${bytesVar} = append(${bytesVar}, b)`);
      lines.push(`${indent}}`);
      break;

    case "fixed": {
      const length = field.length || 0;
      // Read fixed number of bytes, trimming nulls
      lines.push(`${indent}${bytesVar} := make([]byte, 0)`);
      lines.push(`${indent}for i := 0; i < ${length}; i++ {`);
      lines.push(`${indent}\tb, err := decoder.ReadUint8()`);
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode ${field.name}: %w", err)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\tif b != 0 {`);
      lines.push(`${indent}\t\t${bytesVar} = append(${bytesVar}, b)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}}`);
      break;
    }

    case "field_referenced": {
      // Length is determined by a separate field (already read into result struct)
      const lengthField = field.length_field;
      const lengthFieldGoName = toGoFieldPath(lengthField);  // Use toGoFieldPath for dotted paths
      lines.push(`${indent}${bytesVar} := make([]byte, result.${lengthFieldGoName})`);
      lines.push(`${indent}for i := range ${bytesVar} {`);
      lines.push(`${indent}\tb, err := decoder.ReadUint8()`);
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode ${field.name}: %w", err)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\t${bytesVar}[i] = b`);
      lines.push(`${indent}}`);
      break;
    }

    default:
      throw new Error(`Unknown string kind: ${kind}`);
  }

  // Convert bytes to string (encoding-dependent)
  // If fieldName is empty (string is an array item), assign to varName instead of result
  if (encoding === "latin1" || encoding === "ascii") {
    // Latin-1/ASCII: convert each byte to its rune (Unicode code point) value
    // This preserves the full Latin-1 character range (0-255)
    const runesVar = `${bytesVar}Runes`;
    lines.push(`${indent}${runesVar} := make([]rune, len(${bytesVar}))`);
    lines.push(`${indent}for i, b := range ${bytesVar} {`);
    lines.push(`${indent}\t${runesVar}[i] = rune(b)`);
    lines.push(`${indent}}`);
    if (fieldName) {
      lines.push(`${indent}result.${fieldName} = string(${runesVar})`);
    } else {
      lines.push(`${indent}${varName} := string(${runesVar})`);
    }
  } else {
    // UTF-8: use Go's native byte->string conversion
    if (fieldName) {
      lines.push(`${indent}result.${fieldName} = string(${bytesVar})`);
    } else {
      lines.push(`${indent}${varName} := string(${bytesVar})`);
    }
  }
  lines.push(``);

  return lines;
}

/**
 * Generates decoding code for array field
 */
function generateDecodeArray(field: any, fieldName: string, varName: string, endianness: string, runtimeEndianness: string, indent: string, schema?: BinarySchema, parentTypeName?: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;

  if (!items) {
    throw new Error(`Array field ${field.name} missing items definition`);
  }

  // For choice arrays, use the unique interface name
  let itemType: string;
  if (items.type === "choice" && parentTypeName) {
    itemType = `${parentTypeName}_${fieldName}_Choice`;
  } else {
    itemType = mapFieldToGoType(items);
  }

  // Read length prefix for length_prefixed arrays
  if (kind === "length_prefixed" || kind === "length_prefixed_items") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}length, err := decoder.ReadUint8()`);
        break;
      case "uint16":
        lines.push(`${indent}length, err := decoder.ReadUint16(runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}length, err := decoder.ReadUint32(runtime.${runtimeEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}length, err := decoder.ReadUint64(runtime.${runtimeEndianness})`);
        break;
    }
    lines.push(`${indent}if err != nil {`);
    lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name} length: %w", err)`);
    lines.push(`${indent}}`);
    lines.push(`${indent}result.${fieldName} = make([]${itemType}, length)`);

    // For length_prefixed_items, handle per-item lengths
    if (kind === "length_prefixed_items") {
      return [...lines, ...generateDecodeLengthPrefixedItems(field, fieldName, endianness, runtimeEndianness, indent)];
    }

    lines.push(`${indent}for i := range result.${fieldName} {`);
  } else if (kind === "field_referenced") {
    // Length is stored in another field - may be local or in context
    const lengthField = (field as any).length_field;
    const lengthFieldGo = toGoFieldPath(lengthField);

    // Check if this field exists in the current type
    // For dotted paths like "header.content_size", check if the first part ("header") is local
    let fieldIsLocal = true;
    if (parentTypeName && schema) {
      const localFields = getTypeFieldNames(parentTypeName, schema);
      const firstPart = lengthField.split('.')[0];
      fieldIsLocal = localFields.has(firstPart);
    }

    if (fieldIsLocal) {
      // Field is local - access directly from result
      lines.push(`${indent}result.${fieldName} = make([]${itemType}, result.${lengthFieldGo})`);
    } else {
      // Field is in parent context - look it up from ctx
      lines.push(`${indent}// Length field "${lengthField}" is from parent context`);
      lines.push(`${indent}var ${varName}Length int`);
      lines.push(`${indent}if ctx != nil {`);
      lines.push(`${indent}\tif v, ok := ctx["${lengthField}"]; ok {`);
      lines.push(`${indent}\t\tswitch vv := v.(type) {`);
      lines.push(`${indent}\t\tcase int:`);
      lines.push(`${indent}\t\t\t${varName}Length = vv`);
      lines.push(`${indent}\t\tcase uint8:`);
      lines.push(`${indent}\t\t\t${varName}Length = int(vv)`);
      lines.push(`${indent}\t\tcase uint16:`);
      lines.push(`${indent}\t\t\t${varName}Length = int(vv)`);
      lines.push(`${indent}\t\tcase uint32:`);
      lines.push(`${indent}\t\t\t${varName}Length = int(vv)`);
      lines.push(`${indent}\t\tcase uint64:`);
      lines.push(`${indent}\t\t\t${varName}Length = int(vv)`);
      lines.push(`${indent}\t\tdefault:`);
      lines.push(`${indent}\t\t\treturn nil, fmt.Errorf("context field '${lengthField}' has unexpected type: %T", v)`);
      lines.push(`${indent}\t\t}`);
      lines.push(`${indent}\t} else {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("context missing required field '${lengthField}'")`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}} else {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("context required but not provided for field_referenced array '${field.name}'")`);
      lines.push(`${indent}}`);
      lines.push(`${indent}result.${fieldName} = make([]${itemType}, ${varName}Length)`);
    }
    lines.push(`${indent}for i := range result.${fieldName} {`);
  } else if (kind === "computed_count") {
    // Length is computed from an expression using other fields
    const countExpr = (field as any).count_expr || "0";
    const goCountExpr = convertCountExprToGo(countExpr);
    const countVarName = `${varName}Count`;

    lines.push(`${indent}// Computed count expression: ${countExpr}`);
    lines.push(`${indent}${countVarName} := ${goCountExpr}`);
    lines.push(`${indent}result.${fieldName} = make([]${itemType}, ${countVarName})`);
    lines.push(`${indent}for i := 0; i < ${countVarName}; i++ {`);
  } else if (kind === "byte_length_prefixed") {
    // Read byte length prefix, then read items until we've consumed N bytes
    const lengthType = field.length_type || "uint8";
    const byteLengthVar = `${varName}ByteLength`;
    const startOffsetVar = `${varName}StartOffset`;
    const endOffsetVar = `${varName}EndOffset`;

    // Read the byte length prefix
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}${byteLengthVar}, err := decoder.ReadUint8()`);
        break;
      case "uint16":
        lines.push(`${indent}${byteLengthVar}, err := decoder.ReadUint16(runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}${byteLengthVar}, err := decoder.ReadUint32(runtime.${runtimeEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}${byteLengthVar}, err := decoder.ReadUint64(runtime.${runtimeEndianness})`);
        break;
      case "varlength": {
        const lengthEncoding = (field as any).length_encoding || "der";
        const methodMap: { [key: string]: string } = {
          'der': 'ReadVarlengthDER',
          'leb128': 'ReadVarlengthLEB128',
          'ebml': 'ReadVarlengthEBML',
          'vlq': 'ReadVarlengthVLQ'
        };
        const readMethod = methodMap[lengthEncoding] || 'ReadVarlengthDER';
        lines.push(`${indent}${byteLengthVar}, err := decoder.${readMethod}()`);
        break;
      }
    }
    lines.push(`${indent}if err != nil {`);
    lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name} byte length: %w", err)`);
    lines.push(`${indent}}`);

    // Track start and end offsets
    lines.push(`${indent}${startOffsetVar} := decoder.Position()`);
    lines.push(`${indent}${endOffsetVar} := ${startOffsetVar} + int(${byteLengthVar})`);
    lines.push(`${indent}result.${fieldName} = []${itemType}{}`);
    lines.push(`${indent}for decoder.Position() < ${endOffsetVar} {`);
  } else if (kind === "fixed") {
    const length = field.length || 0;
    lines.push(`${indent}result.${fieldName} = make([]${itemType}, ${length})`);
    lines.push(`${indent}for i := 0; i < ${length}; i++ {`);
  } else if (kind === "null_terminated") {
    // Use a labeled loop so we can break out of switch statements inside
    const loopLabel = `${varName}Loop`;
    lines.push(`${indent}result.${fieldName} = []${itemType}{}`);
    lines.push(`${indent}${loopLabel}:`);
    lines.push(`${indent}for {`);
    // Check for null terminator (0x00) before decoding each item
    // This applies when items are length-prefixed types (like DNS labels)
    lines.push(`${indent}\t// Peek for null terminator`);
    lines.push(`${indent}\tpeekByte, err := decoder.PeekUint8()`);
    lines.push(`${indent}\tif err != nil {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to peek for null terminator: %w", err)`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}\tif peekByte == 0 {`);
    lines.push(`${indent}\t\t// Consume the null terminator and exit loop`);
    lines.push(`${indent}\t\t_, _ = decoder.ReadUint8()`);
    lines.push(`${indent}\t\tbreak ${loopLabel}`);
    lines.push(`${indent}\t}`);
  } else if (kind === "variant_terminated") {
    // For variant-terminated arrays, read items until a terminal variant is encountered
    // Unlike null_terminated, we don't peek - we just decode and check after
    const loopLabel = `${varName}Loop`;
    lines.push(`${indent}result.${fieldName} = []${itemType}{}`);
    lines.push(`${indent}${loopLabel}:`);
    lines.push(`${indent}for {`);
    // Fall through to decode item - terminal variant check happens after decode
  } else if (kind === "signature_terminated") {
    // For signature-terminated arrays, peek ahead to check for terminator value
    const terminatorValue = (field as any).terminator_value;
    const terminatorType = (field as any).terminator_type || "uint8";
    const terminatorEndianness = (field as any).terminator_endianness || endianness;

    if (terminatorValue === undefined) {
      throw new Error(`signature_terminated array '${field.name}' requires terminator_value`);
    }

    const loopLabel = `${varName}Loop`;
    lines.push(`${indent}result.${fieldName} = []${itemType}{}`);
    lines.push(`${indent}${loopLabel}:`);
    lines.push(`${indent}for {`);
    lines.push(`${indent}\t// Peek ahead to check for terminator signature`);

    const runtimeTerminatorEndianness = mapEndianness(terminatorEndianness);
    switch (terminatorType) {
      case "uint8":
        lines.push(`${indent}\tsignature, err := decoder.PeekUint8()`);
        break;
      case "uint16":
        lines.push(`${indent}\tsignature, err := decoder.PeekUint16(runtime.${runtimeTerminatorEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}\tsignature, err := decoder.PeekUint32(runtime.${runtimeTerminatorEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}\tsignature, err := decoder.PeekUint64(runtime.${runtimeTerminatorEndianness})`);
        break;
      default:
        lines.push(`${indent}\tsignature, err := decoder.PeekUint8()`);
    }
    lines.push(`${indent}\tif err != nil {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to peek for terminator: %w", err)`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}\tif signature == ${terminatorValue} {`);
    lines.push(`${indent}\t\tbreak ${loopLabel}`);
    lines.push(`${indent}\t}`);
    // Fall through to decode item
  } else if (kind === "greedy") {
    // Greedy: read until end of buffer
    // For now, just allocate empty array - TODO: implement greedy properly
    lines.push(`${indent}result.${fieldName} = []${itemType}{}`);
    lines.push(`${indent}// TODO: Implement greedy array reading`);
    lines.push(``);
    return lines;
  } else {
    throw new Error(`Unknown array kind: ${kind}`);
  }

  // Decode item
  const itemVar = `${varName}Item`;

  // Handle nested arrays specially (items.type === "array")
  if (items.type === "array") {
    // Generate inline nested array decoding
    const innerItems = items.items;
    const innerItemType = mapFieldToGoType(innerItems);
    const innerKind = items.kind || "length_prefixed";

    // Read inner array length
    if (innerKind === "length_prefixed") {
      const innerLengthType = items.length_type || "uint8";
      switch (innerLengthType) {
        case "uint8":
          lines.push(`${indent}\tinnerLength, err := decoder.ReadUint8()`);
          break;
        case "uint16":
          lines.push(`${indent}\tinnerLength, err := decoder.ReadUint16(runtime.${runtimeEndianness})`);
          break;
        case "uint32":
          lines.push(`${indent}\tinnerLength, err := decoder.ReadUint32(runtime.${runtimeEndianness})`);
          break;
        case "uint64":
          lines.push(`${indent}\tinnerLength, err := decoder.ReadUint64(runtime.${runtimeEndianness})`);
          break;
      }
      lines.push(`${indent}\tif err != nil {`);
      lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode nested array length: %w", err)`);
      lines.push(`${indent}\t}`);
      lines.push(`${indent}\tresult.${fieldName}[i] = make([]${innerItemType}, innerLength)`);
      lines.push(`${indent}\tfor j := range result.${fieldName}[i] {`);
    } else if (innerKind === "fixed") {
      const innerLength = items.length || 0;
      lines.push(`${indent}\tresult.${fieldName}[i] = make([]${innerItemType}, ${innerLength})`);
      lines.push(`${indent}\tfor j := 0; j < ${innerLength}; j++ {`);
    }

    // Decode inner array items
    const innerItemVar = `${varName}InnerItem`;
    const innerItemField: Field = {
      name: "",
      type: innerItems.type,
      ...(innerItems as any)
    };
    const innerItemLines = generateDecodeFieldImpl(innerItemField, "", innerItemVar, endianness, runtimeEndianness, indent + "\t\t", schema);
    lines.push(...innerItemLines);

    // Assign inner item to nested array
    const isInnerDiscriminatedUnionTypeRef = schema.types[innerItems.type] &&
      ((schema.types[innerItems.type] as any).type === "discriminated_union" ||
       (schema.types[innerItems.type] as any).variants !== undefined);
    const isInnerStructItem = !isPrimitiveType(innerItems.type) &&
      !["string", "array", "bit", "int", "bitfield", "discriminated_union"].includes(innerItems.type) &&
      !isInnerDiscriminatedUnionTypeRef;
    const innerItemValue = isInnerStructItem ? `*${innerItemVar}` : innerItemVar;
    lines.push(`${indent}\t\tresult.${fieldName}[i][j] = ${innerItemValue}`);
    lines.push(`${indent}\t}`);

    // Close outer loop
    if (kind === "fixed" || kind === "length_prefixed" || kind === "field_referenced" || kind === "computed_count") {
      lines.push(`${indent}}`);
    } else if (kind === "null_terminated") {
      lines.push(`${indent}}`);
    }

    lines.push(``);
    return lines;
  }

  // Handle choice type items specially - generate inline switch
  if (items.type === "choice") {
    const choices = items.choices || [];
    const globalEndianness = schema?.config?.endianness || "big_endian";

    // Auto-detect discriminator type from first choice
    let discriminatorType = "uint8";
    let discriminatorEndianness = globalEndianness;

    if (choices.length > 0 && schema) {
      const firstChoiceType = schema.types[choices[0].type];
      if (firstChoiceType && 'sequence' in firstChoiceType && firstChoiceType.sequence.length > 0) {
        const firstField = firstChoiceType.sequence[0];
        discriminatorType = firstField.type;
        discriminatorEndianness = (firstField as any).endianness || globalEndianness;
      }
    }

    const discRuntimeEndianness = mapEndianness(discriminatorEndianness);

    // Generate peek for discriminator
    switch (discriminatorType) {
      case "uint8":
        lines.push(`${indent}\tdiscriminator, err := decoder.PeekUint8()`);
        break;
      case "uint16":
        lines.push(`${indent}\tdiscriminator, err := decoder.PeekUint16(runtime.${discRuntimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}\tdiscriminator, err := decoder.PeekUint32(runtime.${discRuntimeEndianness})`);
        break;
      default:
        lines.push(`${indent}\tdiscriminator, err := decoder.PeekUint8()`);
    }

    lines.push(`${indent}\tif err != nil {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to peek choice discriminator: %w", err)`);
    lines.push(`${indent}\t}`);
    lines.push(``);

    // Declare the item variable with the unique interface type
    const choiceInterfaceName = parentTypeName ? `${parentTypeName}_${fieldName}_Choice` : "Choice";
    lines.push(`${indent}\tvar ${itemVar} ${choiceInterfaceName}`);
    lines.push(`${indent}\tswitch discriminator {`);

    // Generate case for each choice
    for (const choice of choices) {
      // Get the discriminator value from the choice type's first field const
      let discriminatorValue: number | bigint = 0;
      if (schema) {
        const choiceTypeDef = schema.types[choice.type];
        if (choiceTypeDef && 'sequence' in choiceTypeDef && choiceTypeDef.sequence.length > 0) {
          const firstField = choiceTypeDef.sequence[0];
          if ('const' in firstField && firstField.const !== undefined) {
            discriminatorValue = firstField.const;
          }
        }
      }

      lines.push(`${indent}\tcase ${discriminatorValue}:`);
      lines.push(`${indent}\t\tresult, err := decode${choice.type}WithDecoder(decoder)`);
      lines.push(`${indent}\t\tif err != nil {`);
      lines.push(`${indent}\t\t\treturn nil, err`);
      lines.push(`${indent}\t\t}`);
      lines.push(`${indent}\t\t${itemVar} = result`);
    }

    lines.push(`${indent}\tdefault:`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("unknown choice discriminator value: %d", discriminator)`);
    lines.push(`${indent}\t}`);

    // Assign to array (interface returned directly, no dereference needed)
    if (kind === "fixed" || kind === "length_prefixed" || kind === "field_referenced" || kind === "computed_count") {
      lines.push(`${indent}\tresult.${fieldName}[i] = ${itemVar}`);
      lines.push(`${indent}}`);
    } else if (kind === "null_terminated" || kind === "byte_length_prefixed" || kind === "signature_terminated") {
      // For these kinds, we use append since we don't know the count in advance
      lines.push(`${indent}\tresult.${fieldName} = append(result.${fieldName}, ${itemVar})`);
      lines.push(`${indent}}`);
    }

    lines.push(``);
    return lines;
  }

  const itemField: Field = {
    name: "",
    type: items.type,
    ...(items as any)
  };
  const innerLines = generateDecodeFieldImpl(itemField, "", itemVar, endianness, runtimeEndianness, indent + "\t", schema);
  lines.push(...innerLines);

  // Determine if item is a struct type (decode returns pointer, need to dereference)
  // Note: discriminated_union returns an interface, not a pointer, so don't dereference
  // Also check if the item type references a discriminated_union in the schema
  const isDiscriminatedUnionTypeRef = schema.types[items.type] &&
    ((schema.types[items.type] as any).type === "discriminated_union" ||
     (schema.types[items.type] as any).variants !== undefined);
  const isStructItem = !isPrimitiveType(items.type) &&
    !["string", "array", "bit", "int", "bitfield", "discriminated_union"].includes(items.type) &&
    !isDiscriminatedUnionTypeRef;
  const itemValue = isStructItem ? `*${itemVar}` : itemVar;

  // Assign to array
  if (kind === "fixed" || kind === "length_prefixed" || kind === "field_referenced" || kind === "computed_count") {
    lines.push(`${indent}\tresult.${fieldName}[i] = ${itemValue}`);
    lines.push(`${indent}}`);
  } else if (kind === "null_terminated" || kind === "variant_terminated") {
    lines.push(`${indent}\tresult.${fieldName} = append(result.${fieldName}, ${itemValue})`);

    // Check for terminal_variants - if this item matches a terminal variant, break the loop
    const terminalVariants = (field as any).terminal_variants;
    if (terminalVariants && Array.isArray(terminalVariants) && terminalVariants.length > 0) {
      const loopLabel = `${varName}Loop`;
      lines.push(`${indent}\t// Check if item is a terminal variant`);
      lines.push(`${indent}\tswitch ${itemVar}.(type) {`);
      for (const terminalVariant of terminalVariants) {
        const goTypeName = toGoTypeName(terminalVariant);
        lines.push(`${indent}\tcase *${goTypeName}:`);
        lines.push(`${indent}\t\tbreak ${loopLabel} // Terminal variant - exit loop`);
      }
      lines.push(`${indent}\t}`);
    }
    lines.push(`${indent}}`);
  } else if (kind === "signature_terminated" || kind === "byte_length_prefixed") {
    // For these kinds, we use append and check loop condition at the start
    lines.push(`${indent}\tresult.${fieldName} = append(result.${fieldName}, ${itemValue})`);
    lines.push(`${indent}}`);
  }

  lines.push(``);

  return lines;
}

/**
 * Generates decoding code for length-prefixed items array
 */
function generateDecodeLengthPrefixedItems(field: any, fieldName: string, endianness: string, runtimeEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const itemLengthType = field.item_length_type || "uint32";
  const items = field.items;
  const itemType = items.type;

  lines.push(`${indent}for i := range result.${fieldName} {`);

  // Read item length
  switch (itemLengthType) {
    case "uint8":
      lines.push(`${indent}\titemLength, err := decoder.ReadUint8()`);
      break;
    case "uint16":
      lines.push(`${indent}\titemLength, err := decoder.ReadUint16(runtime.${runtimeEndianness})`);
      break;
    case "uint32":
      lines.push(`${indent}\titemLength, err := decoder.ReadUint32(runtime.${runtimeEndianness})`);
      break;
    case "uint64":
      lines.push(`${indent}\titemLength, err := decoder.ReadUint64(runtime.${runtimeEndianness})`);
      break;
  }
  lines.push(`${indent}\tif err != nil {`);
  lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode item length: %w", err)`);
  lines.push(`${indent}\t}`);
  lines.push(`${indent}\t_ = itemLength // Length used for validation`);

  // For primitive types, decode directly
  if (isPrimitiveType(itemType)) {
    switch (itemType) {
      case "uint8":
        lines.push(`${indent}\titem, err := decoder.ReadUint8()`);
        break;
      case "uint16":
        lines.push(`${indent}\titem, err := decoder.ReadUint16(runtime.${runtimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}\titem, err := decoder.ReadUint32(runtime.${runtimeEndianness})`);
        break;
      case "uint64":
        lines.push(`${indent}\titem, err := decoder.ReadUint64(runtime.${runtimeEndianness})`);
        break;
      case "int8":
        lines.push(`${indent}\titem, err := decoder.ReadInt8()`);
        break;
      case "int16":
        lines.push(`${indent}\titem, err := decoder.ReadInt16(runtime.${runtimeEndianness})`);
        break;
      case "int32":
        lines.push(`${indent}\titem, err := decoder.ReadInt32(runtime.${runtimeEndianness})`);
        break;
      case "int64":
        lines.push(`${indent}\titem, err := decoder.ReadInt64(runtime.${runtimeEndianness})`);
        break;
      case "float32":
        lines.push(`${indent}\titem, err := decoder.ReadFloat32(runtime.${runtimeEndianness})`);
        break;
      case "float64":
        lines.push(`${indent}\titem, err := decoder.ReadFloat64(runtime.${runtimeEndianness})`);
        break;
      default:
        lines.push(`${indent}\t// Unsupported primitive type: ${itemType}`);
        lines.push(`${indent}\tvar item ${itemType}`);
    }
    lines.push(`${indent}\tif err != nil {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode item: %w", err)`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}\tresult.${fieldName}[i] = item`);
  } else {
    // For struct types, read item bytes and decode
    lines.push(`${indent}\titemBytes := make([]byte, itemLength)`);
    lines.push(`${indent}\tfor j := range itemBytes {`);
    lines.push(`${indent}\t\tb, err := decoder.ReadUint8()`);
    lines.push(`${indent}\t\tif err != nil {`);
    lines.push(`${indent}\t\t\treturn nil, fmt.Errorf("failed to decode item bytes: %w", err)`);
    lines.push(`${indent}\t\t}`);
    lines.push(`${indent}\t\titemBytes[j] = b`);
    lines.push(`${indent}\t}`);

    // Decode item from bytes
    const typeName = toGoTypeName(itemType);
    lines.push(`${indent}\titem, err := Decode${typeName}(itemBytes)`);
    lines.push(`${indent}\tif err != nil {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to decode item: %w", err)`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}\tresult.${fieldName}[i] = *item`);
  }

  lines.push(`${indent}}`);
  lines.push(``);

  return lines;
}

/**
 * Generates decoding code for nested struct
 */
function generateDecodeNestedStruct(field: Field, fieldName: string, varName: string, indent: string): string[] {
  const lines: string[] = [];
  const typeName = toGoTypeName(field.type);

  lines.push(`${indent}${varName}, err := decode${typeName}WithDecoder(decoder)`);
  lines.push(`${indent}if err != nil {`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode ${field.name || 'nested struct'}: %w", err)`);
  lines.push(`${indent}}`);
  // Only assign to result if fieldName is provided (not when decoding array items)
  if (fieldName) {
    lines.push(`${indent}result.${fieldName} = *${varName}`);
    lines.push(``);
  }

  return lines;
}

/**
 * Check if a type is a primitive type (not a struct/interface)
 */
function isPrimitiveType(typeName: string): boolean {
  const primitives = [
    "uint8", "uint16", "uint32", "uint64",
    "int8", "int16", "int32", "int64",
    "float32", "float64", "string"
  ];
  return primitives.includes(typeName);
}

/**
 * Get the size in bytes of a primitive type
 */
function getPrimitiveSize(typeName: string): number {
  switch (typeName) {
    case "uint8":
    case "int8":
      return 1;
    case "uint16":
    case "int16":
      return 2;
    case "uint32":
    case "int32":
    case "float32":
      return 4;
    case "uint64":
    case "int64":
    case "float64":
      return 8;
    default:
      // For string or unknown types, return 0 (variable length)
      return 0;
  }
}

/**
 * Maps a field to its Go type
 * @param parentTypeName - Optional parent type name for generating nested type names (e.g., bitfield structs)
 */
function mapFieldToGoType(field: Field, parentTypeName?: string): string {
  switch (field.type) {
    case "uint8":
      return "uint8";
    case "uint16":
      return "uint16";
    case "uint32":
      return "uint32";
    case "uint64":
      return "uint64";
    case "int8":
      return "int8";
    case "int16":
      return "int16";
    case "int32":
      return "int32";
    case "int64":
      return "int64";
    case "float32":
      return "float32";
    case "float64":
      return "float64";
    case "string":
      return "string";
    case "bit":
      // Bitfield - determine size
      const size = (field as any).size || 1;
      if (size <= 8) return "uint8";
      if (size <= 16) return "uint16";
      if (size <= 32) return "uint32";
      return "uint64";
    case "int":
      // Signed int bitfield
      const intSize = (field as any).size || 8;
      if (intSize <= 8) return "int8";
      if (intSize <= 16) return "int16";
      if (intSize <= 32) return "int32";
      return "int64";
    case "bitfield":
      // Bitfield container - return the generated struct type name
      if (parentTypeName && (field as any).fields) {
        const fieldName = toGoFieldName(field.name);
        return `${parentTypeName}_${fieldName}`;
      }
      // Fallback for bitfields without nested fields
      return "uint64";
    case "varlength":
      // Variable-length integers are decoded as uint64
      return "uint64";
    case "array":
      // Array type - get items type
      const items = (field as any).items;
      // Handle choice arrays specially - need unique interface name
      if (items?.type === "choice" && parentTypeName) {
        const fieldName = toGoFieldName(field.name);
        return `[]${parentTypeName}_${fieldName}_Choice`;
      }
      const itemsType = mapFieldToGoType(items, parentTypeName);
      return `[]${itemsType}`;
    case "choice":
      // Choice type - should be handled via array case above for proper naming
      // This fallback is for direct choice fields (rare)
      return "Choice";
    case "optional":
      // Optional type - pointer
      const valueType = (field as any).value_type;
      return `*${valueType}`;
    case "discriminated_union":
      // Inline discriminated union - use interface{} to hold any variant
      return "interface{}";
    case "back_reference":
      // Back reference - use the target type
      const targetType = (field as any).target_type;
      return toGoTypeName(targetType);
    default:
      // Assume it's a type reference (nested struct)
      return toGoTypeName(field.type);
  }
}

/**
 * Converts a field name to Go exported field name (PascalCase)
 */
function toGoFieldName(name: string): string {
  // Convert snake_case or camelCase to PascalCase
  // Handle numbers properly: pattern_5555 → Pattern5555
  return name
    .split(/[_-]/)
    .map(part => {
      if (!part) return "";
      // If part is all digits, keep as-is
      if (/^\d+$/.test(part)) return part;
      // Otherwise capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

/**
 * Converts a field path (e.g., "header.payload_size") to Go field path (e.g., "Header.PayloadSize")
 */
function toGoFieldPath(path: string): string {
  return path.split(".").map(toGoFieldName).join(".");
}

// Go reserved words that cannot be used as variable names
const GO_RESERVED_WORDS = new Set([
  "break", "case", "chan", "const", "continue",
  "default", "defer", "else", "fallthrough", "for", "func", "go", "goto",
  "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch",
  "type", "var",
]);

/**
 * Converts a field name to Go local variable name (camelCase)
 * Escapes Go reserved words by appending underscore
 */
function toGoVarName(name: string): string {
  const parts = name.split(/[_-]/);
  if (parts.length === 0) return name;

  // First part lowercase, rest capitalized
  let result = parts[0].toLowerCase() + parts.slice(1)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  // Escape Go reserved words
  if (GO_RESERVED_WORDS.has(result)) {
    result = result + "_";
  }

  return result;
}

/**
 * Converts a type name to Go type name (ensures PascalCase)
 */
function toGoTypeName(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Maps endianness string to Go runtime constant
 */
function mapEndianness(endianness: string): string {
  if (endianness === "little_endian") {
    return "LittleEndian";
  }
  return "BigEndian";
}

/**
 * Maps bit_order from schema to Go runtime constant
 */
function mapBitOrder(bitOrder: string): string {
  if (bitOrder === "lsb_first") {
    return "LSBFirst";
  }
  return "MSBFirst";
}

/**
 * Returns the sentinel value for "not found" based on Go type.
 * Used for position_of fields when array is empty.
 */
function getSentinelValue(goType: string): string {
  switch (goType) {
    case "uint8":
      return "0xFF";
    case "uint16":
      return "0xFFFF";
    case "uint32":
      return "0xFFFFFFFF";
    case "uint64":
      return "0xFFFFFFFFFFFFFFFF";
    default:
      return "0xFFFFFFFF"; // Default to uint32 sentinel
  }
}

/**
 * Generates decoding code for inline discriminated_union field
 */
function generateDecodeInlineDiscriminatedUnion(
  field: any,
  fieldName: string,
  varName: string,
  endianness: string,
  runtimeEndianness: string,
  indent: string,
  schema?: BinarySchema,
  parentTypeName?: string
): string[] {
  const lines: string[] = [];
  const discriminator = field.discriminator || {};
  const variants = field.variants || [];

  // Helper to generate variant decode call - uses context if variant needs it
  function generateVariantDecodeCall(variant: any, innerIndent: string): string[] {
    const result: string[] = [];
    const variantTypeName = toGoTypeName(variant.type);
    const needsContext = schema && typeNeedsContext(variant.type, schema);

    if (needsContext && schema && parentTypeName) {
      // Build context from current result and call with context
      result.push(`${innerIndent}// Build context for ${variant.type} (needs parent fields)`);
      result.push(`${innerIndent}variantCtx := map[string]interface{}{`);

      // Get all fields from the parent type and add them to context
      const parentTypeDef = schema.types[parentTypeName];
      if (parentTypeDef && "sequence" in parentTypeDef) {
        for (const parentField of parentTypeDef.sequence) {
          // Skip the current field (the discriminated union itself)
          if (parentField.name === field.name) continue;
          // Skip bitfield sub-fields - they're nested in result.FieldName.SubField
          if (parentField.type === "bitfield") {
            // For bitfields, we'd need to handle nested access
            // Skip for now - most context needs are for simple fields like counts
            continue;
          }
          const goFieldName = toGoFieldName(parentField.name);
          result.push(`${innerIndent}\t"${parentField.name}": result.${goFieldName},`);
        }
      }
      result.push(`${innerIndent}}`);
      result.push(`${innerIndent}variantValue, err := decode${variantTypeName}WithDecoderAndContext(decoder, variantCtx)`);
    } else {
      result.push(`${innerIndent}variantValue, err := decode${variantTypeName}WithDecoder(decoder)`);
    }
    result.push(`${innerIndent}if err != nil {`);
    result.push(`${innerIndent}\treturn nil, fmt.Errorf("failed to decode ${variant.type} variant: %w", err)`);
    result.push(`${innerIndent}}`);
    result.push(`${innerIndent}result.${fieldName} = variantValue`);
    return result;
  }

  if (discriminator.peek) {
    // Peek-based discriminator (e.g., DNS compression)
    const peekType = discriminator.peek;
    const peekEndianness = discriminator.endianness || endianness || "big_endian";
    const peekRuntimeEndianness = mapEndianness(peekEndianness);

    // Peek at discriminator value
    switch (peekType) {
      case "uint8":
        lines.push(`${indent}discriminator, err := decoder.PeekUint8()`);
        break;
      case "uint16":
        lines.push(`${indent}discriminator, err := decoder.PeekUint16(runtime.${peekRuntimeEndianness})`);
        break;
      case "uint32":
        lines.push(`${indent}discriminator, err := decoder.PeekUint32(runtime.${peekRuntimeEndianness})`);
        break;
      default:
        lines.push(`${indent}discriminator, err := decoder.PeekUint8()`);
    }
    lines.push(`${indent}if err != nil {`);
    lines.push(`${indent}\treturn nil, fmt.Errorf("failed to peek discriminator for ${field.name || 'union'}: %w", err)`);
    lines.push(`${indent}}`);
    lines.push(``);

    // Generate if-else chain for each variant
    let isFirst = true;
    for (const variant of variants) {
      if (variant.when) {
        // Convert condition: replace 'value' with 'discriminator'
        // Also convert JavaScript operators to Go (=== to ==, !== to !=)
        let condition = variant.when.replace(/\bvalue\b/g, 'discriminator');
        condition = condition.replace(/===/g, '==').replace(/!==/g, '!=');
        const ifKeyword = isFirst ? "if" : "} else if";
        isFirst = false;

        lines.push(`${indent}${ifKeyword} ${condition} {`);
        lines.push(...generateVariantDecodeCall(variant, indent + "\t"));
      }
    }

    if (!isFirst) {
      lines.push(`${indent}} else {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("unknown discriminator value: %d", discriminator)`);
      lines.push(`${indent}}`);
    }
  } else if (discriminator.field) {
    // Field-based discriminator (use previously decoded field value)
    const fieldPath = toGoFieldPath(discriminator.field);
    const discriminatorVar = `result.${fieldPath}`;

    // Generate if-else chain for each variant
    let isFirst = true;
    for (const variant of variants) {
      if (variant.when) {
        // Convert condition: replace 'value' with the discriminator variable
        // Also convert JavaScript operators to Go (=== to ==, !== to !=)
        let condition = variant.when.replace(/\bvalue\b/g, discriminatorVar);
        condition = condition.replace(/===/g, '==').replace(/!==/g, '!=');
        const ifKeyword = isFirst ? "if" : "} else if";
        isFirst = false;

        lines.push(`${indent}${ifKeyword} ${condition} {`);
        lines.push(...generateVariantDecodeCall(variant, indent + "\t"));
      }
    }

    if (!isFirst) {
      lines.push(`${indent}} else {`);
      lines.push(`${indent}\treturn nil, fmt.Errorf("unknown discriminator value for ${field.name || 'union'}: %v", ${discriminatorVar})`);
      lines.push(`${indent}}`);
    }
  } else {
    lines.push(`${indent}// TODO: Unknown discriminator type for inline discriminated_union`);
    lines.push(`${indent}return nil, fmt.Errorf("unsupported discriminator type for ${field.name || 'union'}")`);
  }

  lines.push(``);
  return lines;
}

/**
 * Generates decoding code for back_reference field
 * Back references point to previously decoded data and require seekable streams.
 */
function generateDecodeBackReference(
  field: any,
  fieldName: string,
  varName: string,
  endianness: string,
  runtimeEndianness: string,
  indent: string
): string[] {
  const lines: string[] = [];
  const storage = field.storage || "uint16";
  const offsetMask = field.offset_mask || "0x3FFF";
  const targetType = field.target_type;
  const offsetFrom = field.offset_from || "message_start";
  const storageEndianness = field.endianness || endianness || "big_endian";
  const storageRuntimeEndianness = mapEndianness(storageEndianness);

  // Read the storage value (contains either pointer or inline data)
  switch (storage) {
    case "uint8":
      lines.push(`${indent}referenceValue, err := decoder.ReadUint8()`);
      break;
    case "uint16":
      lines.push(`${indent}referenceValue, err := decoder.ReadUint16(runtime.${storageRuntimeEndianness})`);
      break;
    case "uint32":
      lines.push(`${indent}referenceValue, err := decoder.ReadUint32(runtime.${storageRuntimeEndianness})`);
      break;
    default:
      lines.push(`${indent}referenceValue, err := decoder.ReadUint16(runtime.${storageRuntimeEndianness})`);
  }

  lines.push(`${indent}if err != nil {`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("failed to read back_reference: %w", err)`);
  lines.push(`${indent}}`);
  lines.push(``);

  // Extract offset from reference value
  lines.push(`${indent}offset := referenceValue & ${offsetMask}`);
  lines.push(``);

  // Save current position and seek to offset
  lines.push(`${indent}// Save current position and seek to referenced offset`);
  lines.push(`${indent}savedPos := decoder.Position()`);

  if (offsetFrom === "current_position") {
    lines.push(`${indent}decoder.Seek(savedPos + int(offset))`);
  } else {
    // message_start
    lines.push(`${indent}decoder.Seek(int(offset))`);
  }
  lines.push(``);

  // Decode target type at the referenced position
  const targetTypeName = toGoTypeName(targetType);
  lines.push(`${indent}${varName}, err := decode${targetTypeName}WithDecoder(decoder)`);
  lines.push(`${indent}if err != nil {`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("failed to decode back_reference target: %w", err)`);
  lines.push(`${indent}}`);
  lines.push(``);

  // Restore position
  lines.push(`${indent}decoder.Seek(savedPos)`);
  lines.push(``);

  if (fieldName) {
    lines.push(`${indent}result.${fieldName} = *${varName}`);
    lines.push(``);
  }

  return lines;
}

/**
 * Generates encoding code for inline discriminated_union field
 */
function generateEncodeInlineDiscriminatedUnion(
  field: any,
  fieldName: string,
  endianness: string,
  runtimeEndianness: string,
  indent: string
): string[] {
  const lines: string[] = [];
  const variants = field.variants || [];

  // For encoding, we use type assertion to determine variant type
  lines.push(`${indent}// Encode discriminated union variant`);
  lines.push(`${indent}switch v := ${fieldName}.(type) {`);

  for (const variant of variants) {
    const variantTypeName = toGoTypeName(variant.type);
    lines.push(`${indent}case *${variantTypeName}:`);
    lines.push(`${indent}\tvariantBytes, err := v.EncodeWithContext(childCtx)`);
    lines.push(`${indent}\tif err != nil {`);
    lines.push(`${indent}\t\treturn nil, fmt.Errorf("failed to encode ${variant.type} variant: %w", err)`);
    lines.push(`${indent}\t}`);
    lines.push(`${indent}\tfor _, b := range variantBytes {`);
    lines.push(`${indent}\t\tencoder.WriteUint8(b)`);
    lines.push(`${indent}\t}`);
  }

  lines.push(`${indent}default:`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("unknown discriminated union variant type: %T", ${fieldName})`);
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates encoding code for back_reference field
 */
function generateEncodeBackReferenceImpl(
  field: any,
  fieldName: string,
  endianness: string,
  runtimeEndianness: string,
  indent: string
): string[] {
  const lines: string[] = [];
  const targetType = field.target_type;
  const targetTypeName = toGoTypeName(targetType);

  // For encoding, we just encode the target value directly
  // (full compression dictionary support would require more complex state tracking)
  lines.push(`${indent}// Encode back_reference target value`);
  lines.push(`${indent}targetBytes, err := ${fieldName}.EncodeWithContext(childCtx)`);
  lines.push(`${indent}if err != nil {`);
  lines.push(`${indent}\treturn nil, fmt.Errorf("failed to encode back_reference target: %w", err)`);
  lines.push(`${indent}}`);
  lines.push(`${indent}for _, b := range targetBytes {`);
  lines.push(`${indent}\tencoder.WriteUint8(b)`);
  lines.push(`${indent}}`);

  return lines;
}
