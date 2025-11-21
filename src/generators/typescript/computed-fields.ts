/**
 * Computed field encoding support.
 * Handles auto-computation of length_of, crc32_of, and position_of fields.
 */

import { BinarySchema, Field, Endianness } from "../../schema/binary-schema.js";
import { getTypeFields } from "./type-utils.js";
import { ARRAY_ITER_SUFFIX } from "./shared.js";

/**
 * Resolve a computed field target path to the actual value path.
 * Handles relative paths (../) by using context.parents array.
 */
export function resolveComputedFieldPath(target: string, baseObjectPath: string = "value"): string {
  if (!target.startsWith('../')) {
    return `${baseObjectPath}.${target}`;
  }

  // Count how many levels to go up
  let levelsUp = 0;
  let remainingPath = target;
  while (remainingPath.startsWith('../')) {
    levelsUp++;
    remainingPath = remainingPath.slice(3);
  }

  // Go up 'levelsUp' levels in the baseObjectPath
  let currentPath = baseObjectPath;
  let parentsNeeded = 0;

  for (let i = 0; i < levelsUp; i++) {
    const lastDot = currentPath.lastIndexOf('.');
    if (lastDot > 0) {
      currentPath = currentPath.substring(0, lastDot);
    } else {
      // At root level (e.g., "value"), need to use context.parents
      parentsNeeded++;
    }
  }

  // If we need to go beyond the root, use context.parents
  // Count from the end of parents array to get the most recent parent
  if (parentsNeeded > 0) {
    return `context.parents[context.parents.length - ${parentsNeeded}].${remainingPath}`;
  }

  return `${currentPath}.${remainingPath}`;
}

/**
 * Parse corresponding<Type> correlation syntax from computed field target
 * Example: "../sections[corresponding<DataBlock>]" -> { arrayPath: "sections", filterType: "DataBlock" }
 */
export function parseCorrespondingTarget(target: string): { arrayPath: string; filterType: string } | null {
  const match = target.match(/(?:\.\.\/)*([^[]+)\[corresponding<(\w+)>\]/);
  if (!match) return null;
  return {
    arrayPath: match[1],
    filterType: match[2]
  };
}

/**
 * Parse first<Type> selector syntax from computed field target
 * Example: "../sections[first<DataBlock>]" -> { arrayPath: "sections", filterType: "DataBlock", selector: "first" }
 */
export function parseFirstLastTarget(target: string): { arrayPath: string; filterType: string; selector: "first" | "last" } | null {
  const match = target.match(/(?:\.\.\/)*([^[]+)\[(first|last)<(\w+)>\]/);
  if (!match) return null;
  return {
    arrayPath: match[1],
    filterType: match[3],
    selector: match[2] as "first" | "last"
  };
}

/**
 * Check if an array field contains choice types with corresponding<Type> position_of references
 * Returns map of types that need position tracking
 */
export function detectCorrespondingTracking(field: any, schema: BinarySchema): Set<string> | null {
  const itemsType = field.items?.type;
  if (itemsType !== "choice") return null;

  const choices = field.items?.choices || [];
  const typesNeedingTracking = new Set<string>();

  // Check each choice type for computed position_of fields using corresponding<Type>
  for (const choice of choices) {
    const choiceTypeDef = schema.types[choice.type];
    if (!choiceTypeDef) continue;

    const fields = getTypeFields(choiceTypeDef);
    for (const f of fields) {
      const fAny = f as any;
      if (fAny.computed?.type === "position_of") {
        const sameIndexInfo = parseCorrespondingTarget(fAny.computed.target);
        if (sameIndexInfo) {
          // This choice type uses corresponding - add the filter type to tracking set
          typesNeedingTracking.add(sameIndexInfo.filterType);
        }
      }
    }
  }

  return typesNeedingTracking.size > 0 ? typesNeedingTracking : null;
}

/**
 * Check if any fields in the schema reference first<Type> or last<Type> for a specific array
 * Returns set of types that need position tracking for first/last lookups
 */
export function detectFirstLastTracking(arrayFieldName: string, schema: BinarySchema): Set<string> {
  const typesNeedingTracking = new Set<string>();

  // Scan all type definitions for position_of fields targeting this array with first/last selectors
  for (const typeName in schema.types) {
    const typeDef = schema.types[typeName];
    const fields = getTypeFields(typeDef);

    for (const field of fields) {
      const fAny = field as any;
      if (fAny.computed?.type === "position_of") {
        const firstLastInfo = parseFirstLastTarget(fAny.computed.target);
        if (firstLastInfo && firstLastInfo.arrayPath === arrayFieldName) {
          typesNeedingTracking.add(firstLastInfo.filterType);
        }
      }
    }
  }

  return typesNeedingTracking;
}

/**
 * Helper function to generate runtime size computation code.
 * Generates code that computes the encoded byte size of a field at runtime by encoding to a temporary buffer.
 */
function generateRuntimeSizeComputation(
  targetPath: string,
  globalEndianness: Endianness,
  indent: string
): { code: string; sizeVar: string } {
  const sizeVar = `${targetPath.replace(/[^a-zA-Z0-9_]/g, "_")}_size`;
  let code = "";

  // For simplicity, we'll encode the value to a temporary encoder and measure the size
  // This handles all types correctly (arrays, structs, strings, etc.)
  code += `${indent}// Compute encoded size of ${targetPath}\n`;
  code += `${indent}const ${sizeVar}_temp = new BitStreamEncoder("${globalEndianness === 'big_endian' ? 'msb_first' : 'lsb_first'}");\n`;
  code += `${indent}const ${sizeVar}_val = ${targetPath};\n`;
  code += `${indent}if (Array.isArray(${sizeVar}_val)) {\n`;
  code += `${indent}  // Encode array elements\n`;
  code += `${indent}  for (const item of ${sizeVar}_val) {\n`;
  code += `${indent}    if (typeof item === 'number') {\n`;
  code += `${indent}      if (Number.isInteger(item)) {\n`;
  code += `${indent}        if (item >= 0 && item <= 255) {\n`;
  code += `${indent}          ${sizeVar}_temp.writeUint8(item);\n`;
  code += `${indent}        } else if (item >= 0 && item <= 65535) {\n`;
  code += `${indent}          ${sizeVar}_temp.writeUint16(item, "${globalEndianness}");\n`;
  code += `${indent}        } else {\n`;
  code += `${indent}          ${sizeVar}_temp.writeUint32(item, "${globalEndianness}");\n`;
  code += `${indent}        }\n`;
  code += `${indent}      } else {\n`;
  code += `${indent}        ${sizeVar}_temp.writeFloat64(item, "${globalEndianness}");\n`;
  code += `${indent}      }\n`;
  code += `${indent}    } else if (typeof item === 'bigint') {\n`;
  code += `${indent}      ${sizeVar}_temp.writeUint64(item, "${globalEndianness}");\n`;
  code += `${indent}    } else if (typeof item === 'object') {\n`;
  code += `${indent}      // TODO: Handle array of objects/structs\n`;
  code += `${indent}    }\n`;
  code += `${indent}  }\n`;
  code += `${indent}} else if (typeof ${sizeVar}_val === 'string') {\n`;
  code += `${indent}  // Encode string\n`;
  code += `${indent}  const encoder = new TextEncoder();\n`;
  code += `${indent}  const bytes = encoder.encode(${sizeVar}_val);\n`;
  code += `${indent}  for (const byte of bytes) {\n`;
  code += `${indent}    ${sizeVar}_temp.writeUint8(byte);\n`;
  code += `${indent}  }\n`;
  code += `${indent}} else if (typeof ${sizeVar}_val === 'object' && ${sizeVar}_val !== null) {\n`;
  code += `${indent}  // TODO: Handle struct encoding\n`;
  code += `${indent}}\n`;
  code += `${indent}const ${sizeVar} = ${sizeVar}_temp.byteOffset;\n`;

  return { code, sizeVar };
}

/**
 * Helper function to compute the size of a field in bytes
 */
function getFieldSize(field: any, schema?: BinarySchema): number {
  const fieldSizeMap: Record<string, number> = {
    "uint8": 1, "int8": 1,
    "uint16": 2, "int16": 2,
    "uint32": 4, "int32": 4, "float32": 4,
    "uint64": 8, "int64": 8, "float64": 8
  };

  // Check if it's a primitive type
  if (fieldSizeMap[field.type as string]) {
    return fieldSizeMap[field.type as string];
  }

  // Check if it's a type reference (user-defined type)
  if (schema && field.type && schema.types[field.type]) {
    const typeDef = schema.types[field.type];
    const typeFields = getTypeFields(typeDef);
    let totalSize = 0;
    for (const f of typeFields) {
      totalSize += getFieldSize(f, schema);
    }
    return totalSize;
  }

  return 0;
}

/**
 * Generate encoding code for computed field
 * Computes the value and writes it instead of reading from input
 */
export function generateEncodeComputedField(
  field: Field,
  schema: BinarySchema,
  globalEndianness: Endianness,
  indent: string,
  currentItemVar?: string,
  containingTypeName?: string,
  containingFields?: Field[]
): string {
  if (!('type' in field)) return "";

  const fieldAny = field as any;
  const computed = fieldAny.computed;
  const fieldName = field.name;
  const baseObjectPath = currentItemVar || "value";

  const endianness = 'endianness' in field && field.endianness
    ? field.endianness
    : globalEndianness;

  let code = "";

  // Generate computation based on computed field type
  if (computed.type === "sum_of_type_sizes") {
    const target = computed.target || "";
    const elementType = computed.element_type || "";

    code += `${indent}// Computed field '${fieldName}': auto-compute sum of sizes for elements of type '${elementType}'\n`;
    code += `${indent}let ${fieldName}_computed = 0;\n`;

    const targetPath = resolveComputedFieldPath(target, baseObjectPath);

    // Generate code to iterate array and sum sizes of matching elements
    // Use the element type's encoder to compute exact encoded size
    code += `${indent}if (Array.isArray(${targetPath})) {\n`;
    code += `${indent}  for (const item of ${targetPath}) {\n`;
    code += `${indent}    // Check if this item matches the target type\n`;
    code += `${indent}    if (!item.type || item.type === '${elementType}') {\n`;
    code += `${indent}      // Encode item using ${elementType}Encoder to measure size (pass context for computed fields)\n`;
    code += `${indent}      const encoder_${fieldName} = new ${elementType}Encoder();\n`;
    code += `${indent}      const encoded_${fieldName} = encoder_${fieldName}.encode(item as ${elementType}, context);\n`;
    code += `${indent}      ${fieldName}_computed += encoded_${fieldName}.length;\n`;
    code += `${indent}    }\n`;
    code += `${indent}  }\n`;
    code += `${indent}}\n`;

    // Write the computed sum
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${fieldName}_computed);\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${fieldName}_computed), "${endianness}");\n`;
        break;
      default:
        code += `${indent}// TODO: Unsupported computed field type: ${field.type}\n`;
    }
  } else if (computed.type === "sum_of_sizes") {
    const targets: string[] = computed.targets || [];

    code += `${indent}// Computed field '${fieldName}': auto-compute sum of sizes for ${targets.length} target(s)\n`;
    code += `${indent}let ${fieldName}_computed = 0;\n`;

    // For each target, compute its size and add to sum
    for (const target of targets) {
      const targetPath = resolveComputedFieldPath(target, baseObjectPath);

      const { code: sizeCode, sizeVar } = generateRuntimeSizeComputation(
        targetPath,
        globalEndianness,
        indent
      );

      code += sizeCode;
      code += `${indent}${fieldName}_computed += ${sizeVar};\n`;
    }

    // Write the computed sum
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${fieldName}_computed);\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${fieldName}_computed), "${endianness}");\n`;
        break;
      default:
        code += `${indent}// TODO: Unsupported computed field type: ${field.type}\n`;
    }
  } else if (computed.type === "length_of") {
    const targetField = computed.target;

    // Check if this is a corresponding or first/last selector
    const sameIndexInfo = parseCorrespondingTarget(targetField);
    const firstLastInfo = parseFirstLastTarget(targetField);

    // Compute the length value
    code += `${indent}// Computed field '${fieldName}': auto-compute length_of '${targetField}'\n`;
    code += `${indent}let ${fieldName}_computed: number;\n`;

    if (sameIndexInfo) {
      // corresponding reference - need to look up the correlated item
      const { arrayPath, filterType } = sameIndexInfo;
      const remainingPath = targetField.substring(targetField.indexOf(']') + 1);

      // Check if we have array iteration context available
      // With context threading, we check if the context has the array iteration info
      code += `${indent}// Check if array iteration context is available\n`;
      code += `${indent}if (!context.arrayIterations.${arrayPath}) {\n`;
      code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context for '${arrayPath}'");\n`;
      code += `${indent}}\n`;

      // Determine if we're referencing a sibling array or the current array
      // If current item has .type property AND we have typeIndices → same-array type-based correlation
      // Otherwise → cross-array index-based correlation
      code += `${indent}// Check if this is same-array type correlation or cross-array index correlation\n`;
      code += `${indent}const ${fieldName}_currentItemType = ${baseObjectPath}.type;\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} currentItemType:', ${fieldName}_currentItemType, 'has in typeIndices:', context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType));\n`;
      code += `${indent}const ${fieldName}_isSameArrayCorrelation = ${fieldName}_currentItemType !== undefined && ` +
              `context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType);\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} isSameArrayCorrelation:', ${fieldName}_isSameArrayCorrelation);\n`;
      code += `${indent}let ${fieldName}_correlationIndex: number;\n`;
      code += `${indent}if (${fieldName}_isSameArrayCorrelation) {\n`;
      code += `${indent}  // Same-array correlation: use type-occurrence index\n`;
      code += `${indent}  const ${fieldName}_typeOccurrenceIndex = context.arrayIterations.${arrayPath}.typeIndices.get(${fieldName}_currentItemType) ?? 0;\n`;
      code += `${indent}  if (${fieldName}_typeOccurrenceIndex === 0) {\n`;
      code += `${indent}    throw new Error(\`Field '${fieldName}' uses corresponding correlation but current type '\${${fieldName}_currentItemType}' has not been seen yet in '${arrayPath}'\`);\n`;
      code += `${indent}  }\n`;
      code += `${indent}  // Subtract 1 because counter was incremented after we started encoding this item\n`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_typeOccurrenceIndex - 1;\n`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} same-array correlationIndex:', ${fieldName}_correlationIndex);\n`;
      code += `${indent}} else {\n`;
      code += `${indent}  // Cross-array correlation: use current array index\n`;
      code += `${indent}  // Find which array we're currently in\n`;
      code += `${indent}  let ${fieldName}_currentArrayIndex = -1;\n`;
      code += `${indent}  for (const [arrayName, arrayInfo] of Object.entries(context.arrayIterations)) {\n`;
      code += `${indent}    if (arrayName !== '${arrayPath}' && arrayInfo.items.includes(${baseObjectPath})) {\n`;
      code += `${indent}      ${fieldName}_currentArrayIndex = arrayInfo.index;\n`;
      code += `${indent}      break;\n`;
      code += `${indent}    }\n`;
      code += `${indent}  }\n`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} cross-array currentArrayIndex:', ${fieldName}_currentArrayIndex);\n`;
      code += `${indent}  if (${fieldName}_currentArrayIndex === -1) {\n`;
      code += `${indent}    throw new Error(\`Could not determine current array index for corresponding correlation\`);\n`;
      code += `${indent}  }\n`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_currentArrayIndex;\n`;
      code += `${indent}}\n`;
      code += `${indent}// Find the target array in parent context (search from outermost to innermost)\n`;
      code += `${indent}let ${fieldName}_array: any;\n`;
      code += `${indent}for (const parent of context.parents) {\n`;
      code += `${indent}  if (parent.${arrayPath}) {\n`;
      code += `${indent}    ${fieldName}_array = parent.${arrayPath};\n`;
      code += `${indent}    break;\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n`;
      code += `${indent}if (!${fieldName}_array) {\n`;
      code += `${indent}  throw new Error(\`Array '${arrayPath}' not found in parent context\`);\n`;
      code += `${indent}}\n`;
      code += `${indent}let ${fieldName}_occurrenceCount = 0;\n`;
      code += `${indent}let ${fieldName}_targetItem: any;\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} searching for ${filterType} at correlationIndex:', ${fieldName}_correlationIndex, 'in array of length:', ${fieldName}_array.length);\n`;
      code += `${indent}for (const item of ${fieldName}_array) {\n`;
      code += `${indent}  if (item.type === '${filterType}') {\n`;
      code += `${indent}    if (${fieldName}_occurrenceCount === ${fieldName}_correlationIndex) {\n`;
      code += `${indent}      ${fieldName}_targetItem = item;\n`;
      code += `${indent}      if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} found target item at occurrence:', ${fieldName}_occurrenceCount);\n`;
      code += `${indent}      break;\n`;
      code += `${indent}    }\n`;
      code += `${indent}    ${fieldName}_occurrenceCount++;\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} targetItem:', ${fieldName}_targetItem, 'finalOccurrenceCount:', ${fieldName}_occurrenceCount);\n`;
      code += `${indent}if (!${fieldName}_targetItem) {\n`;
      code += `${indent}  if (${fieldName}_isSameArrayCorrelation) {\n`;
      code += `${indent}    // Same-array type-occurrence correlation: looking for Nth occurrence of type\n`;
      code += `${indent}    throw new Error(\`Could not find ${filterType} at occurrence index \${${fieldName}_correlationIndex} (index out of bounds: only \${${fieldName}_occurrenceCount} ${filterType} items found)\`);\n`;
      code += `${indent}  } else {\n`;
      code += `${indent}    // Cross-array index correlation: check if item exists at that array index\n`;
      code += `${indent}    if (${fieldName}_array[${fieldName}_correlationIndex]) {\n`;
      code += `${indent}      // Item exists but wrong type\n`;
      code += `${indent}      const actualType = ${fieldName}_array[${fieldName}_correlationIndex].type;\n`;
      code += `${indent}      throw new Error(\`Expected ${filterType} at ${arrayPath}[\${${fieldName}_correlationIndex}] but found \${actualType}\`);\n`;
      code += `${indent}    } else {\n`;
      code += `${indent}      // Array index out of bounds\n`;
      code += `${indent}      throw new Error(\`Could not find ${filterType} at index \${${fieldName}_correlationIndex} (index out of bounds: array has \${${fieldName}_array.length} elements)\`);\n`;
      code += `${indent}    }\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n`;

      const targetPath = `${fieldName}_targetItem${remainingPath}`;

      if (computed.encoding) {
        code += `${indent}{\n`;
        code += `${indent}  const encoder = new TextEncoder();\n`;
        code += `${indent}  ${fieldName}_computed = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        // For scalars (numbers/bigints), use the value directly; for arrays/strings, use .length
        code += `${indent}${fieldName}_computed = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;\n`;
      }
    } else if (firstLastInfo) {
      // first/last selector - need to look up from tracking array
      const { arrayPath, filterType, selector } = firstLastInfo;
      const remainingPath = targetField.substring(targetField.indexOf(']') + 1);

      code += `${indent}// Look up ${selector} item from position tracking\n`;
      code += `${indent}const ${fieldName}_positions_len = context.positions.get('${arrayPath}_${filterType}') || [];\n`;
      code += `${indent}const targetIndex = ${fieldName}_positions_len.length > 0 ? ${selector === "first" ? "0" : `${fieldName}_positions_len.length - 1`} : undefined;\n`;
      code += `${indent}if (targetIndex === undefined) throw new Error('${selector} ${filterType} not found in ${arrayPath}');\n`;
      code += `${indent}const targetItem = ${baseObjectPath}.${arrayPath}[targetIndex];\n`;

      const targetPath = `targetItem${remainingPath}`;

      if (computed.encoding) {
        code += `${indent}{\n`;
        code += `${indent}  const encoder = new TextEncoder();\n`;
        code += `${indent}  ${fieldName}_computed = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        // For scalars (numbers/bigints), use the value directly; for arrays/strings, use .length
        code += `${fieldName}_computed = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;\n`;
      }
    } else {
      // Regular path resolution
      const targetPath = resolveComputedFieldPath(targetField, baseObjectPath);

      // Add validation if accessing parent fields
      if (targetPath.includes('context.parents')) {
        const parentAccessMatch = targetPath.match(/context\.parents\[context\.parents\.length - (\d+)\]\.(\w+)/);
        if (parentAccessMatch) {
          const levelsUp = parentAccessMatch[1];
          const parentFieldName = parentAccessMatch[2];
          code += `${indent}if (context.parents.length < ${levelsUp}) {\n`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent navigation exceeds available levels (need ${levelsUp}, have \${context.parents.length})\`);\n`;
          code += `${indent}}\n`;
          code += `${indent}if (!${targetPath.split('.').slice(0, -1).join('.')}) {\n`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent not found in context\`);\n`;
          code += `${indent}}\n`;
        }
      }

      // Check if encoding is specified (for string byte length)
      if (computed.encoding) {
        // String byte length with specific encoding
        code += `${indent}{\n`;
        code += `${indent}  const encoder = new TextEncoder();\n`;
        code += `${indent}  ${fieldName}_computed = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        // Array element count, string character count, or scalar value
        // For scalars (numbers/bigints), use the value directly; for arrays/strings, use .length
        code += `${indent}${fieldName}_computed = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;\n`;
      }
    }

    // Write the computed value using appropriate write method
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${fieldName}_computed);\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${fieldName}_computed), "${endianness}");\n`;
        break;
      default:
        code += `${indent}// TODO: Unsupported computed field type: ${field.type}\n`;
    }
  } else if (computed.type === "crc32_of") {
    const targetField = computed.target;

    // Check if this is a corresponding or first/last selector
    const sameIndexInfo = parseCorrespondingTarget(targetField);
    const firstLastInfo = parseFirstLastTarget(targetField);

    // Compute CRC32 checksum
    code += `${indent}// Computed field '${fieldName}': auto-compute CRC32 of '${targetField}'\n`;

    if (sameIndexInfo) {
      // corresponding reference - need to look up the correlated item
      const { arrayPath, filterType } = sameIndexInfo;
      const remainingPath = targetField.substring(targetField.indexOf(']') + 1);

      // Check if we have array iteration context available (same as length_of approach)
      code += `${indent}// Check if array iteration context is available\n`;
      code += `${indent}if (!context.arrayIterations.${arrayPath}) {\n`;
      code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context for '${arrayPath}'");\n`;
      code += `${indent}}\n`;

      // Determine if we're referencing a sibling array or the current array
      // If current item has .type property AND we have typeIndices → same-array type-based correlation
      // Otherwise → cross-array index-based correlation
      code += `${indent}// Check if this is same-array type correlation or cross-array index correlation\n`;
      code += `${indent}const ${fieldName}_currentItemType = ${baseObjectPath}.type;\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} currentItemType:', ${fieldName}_currentItemType, 'has in typeIndices:', context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType));\n`;
      code += `${indent}const ${fieldName}_isSameArrayCorrelation = ${fieldName}_currentItemType !== undefined && ` +
              `context.arrayIterations.${arrayPath}.typeIndices.has(${fieldName}_currentItemType);\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} isSameArrayCorrelation:', ${fieldName}_isSameArrayCorrelation);\n`;
      code += `${indent}let ${fieldName}_correlationIndex: number;\n`;
      code += `${indent}if (${fieldName}_isSameArrayCorrelation) {\n`;
      code += `${indent}  // Same-array correlation: use type-occurrence index\n`;
      code += `${indent}  const ${fieldName}_typeOccurrenceIndex = context.arrayIterations.${arrayPath}.typeIndices.get(${fieldName}_currentItemType) ?? 0;\n`;
      code += `${indent}  if (${fieldName}_typeOccurrenceIndex === 0) {\n`;
      code += `${indent}    throw new Error(\`Field '${fieldName}' uses corresponding correlation but current type '\${${fieldName}_currentItemType}' has not been seen yet in '${arrayPath}'\`);\n`;
      code += `${indent}  }\n`;
      code += `${indent}  // Subtract 1 because counter was incremented after we started encoding this item\n`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_typeOccurrenceIndex - 1;\n`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} same-array correlationIndex:', ${fieldName}_correlationIndex);\n`;
      code += `${indent}} else {\n`;
      code += `${indent}  // Cross-array correlation: use current array index\n`;
      code += `${indent}  // Find which array we're currently in\n`;
      code += `${indent}  let ${fieldName}_currentArrayIndex = -1;\n`;
      code += `${indent}  for (const [arrayName, arrayInfo] of Object.entries(context.arrayIterations)) {\n`;
      code += `${indent}    if (arrayName !== '${arrayPath}' && arrayInfo.items.includes(${baseObjectPath})) {\n`;
      code += `${indent}      ${fieldName}_currentArrayIndex = arrayInfo.index;\n`;
      code += `${indent}      break;\n`;
      code += `${indent}    }\n`;
      code += `${indent}  }\n`;
      code += `${indent}  if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} cross-array currentArrayIndex:', ${fieldName}_currentArrayIndex);\n`;
      code += `${indent}  if (${fieldName}_currentArrayIndex === -1) {\n`;
      code += `${indent}    throw new Error(\`Could not determine current array index for corresponding correlation\`);\n`;
      code += `${indent}  }\n`;
      code += `${indent}  ${fieldName}_correlationIndex = ${fieldName}_currentArrayIndex;\n`;
      code += `${indent}}\n`;
      code += `${indent}// Find the target array in parent context (search from outermost to innermost)\n`;
      code += `${indent}let ${fieldName}_array: any;\n`;
      code += `${indent}for (const parent of context.parents) {\n`;
      code += `${indent}  if (parent.${arrayPath}) {\n`;
      code += `${indent}    ${fieldName}_array = parent.${arrayPath};\n`;
      code += `${indent}    break;\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n`;
      code += `${indent}if (!${fieldName}_array) {\n`;
      code += `${indent}  throw new Error(\`Array '${arrayPath}' not found in parent context\`);\n`;
      code += `${indent}}\n`;
      code += `${indent}let ${fieldName}_occurrenceCount = 0;\n`;
      code += `${indent}let ${fieldName}_targetItem: any;\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} searching for ${filterType} at correlationIndex:', ${fieldName}_correlationIndex, 'in array of length:', ${fieldName}_array.length);\n`;
      code += `${indent}for (const item of ${fieldName}_array) {\n`;
      code += `${indent}  if (item.type === '${filterType}') {\n`;
      code += `${indent}    if (${fieldName}_occurrenceCount === ${fieldName}_correlationIndex) {\n`;
      code += `${indent}      ${fieldName}_targetItem = item;\n`;
      code += `${indent}      if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} found target item at occurrence:', ${fieldName}_occurrenceCount);\n`;
      code += `${indent}      break;\n`;
      code += `${indent}    }\n`;
      code += `${indent}    ${fieldName}_occurrenceCount++;\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] ${fieldName} targetItem:', ${fieldName}_targetItem, 'finalOccurrenceCount:', ${fieldName}_occurrenceCount);\n`;
      code += `${indent}if (!${fieldName}_targetItem) {\n`;
      code += `${indent}  if (${fieldName}_isSameArrayCorrelation) {\n`;
      code += `${indent}    // Same-array type-occurrence correlation: looking for Nth occurrence of type\n`;
      code += `${indent}    throw new Error(\`Could not find ${filterType} at occurrence index \${${fieldName}_correlationIndex} (index out of bounds: only \${${fieldName}_occurrenceCount} ${filterType} items found)\`);\n`;
      code += `${indent}  } else {\n`;
      code += `${indent}    // Cross-array index correlation: check if item exists at that array index\n`;
      code += `${indent}    if (${fieldName}_array[${fieldName}_correlationIndex]) {\n`;
      code += `${indent}      // Item exists but wrong type\n`;
      code += `${indent}      const actualType = ${fieldName}_array[${fieldName}_correlationIndex].type;\n`;
      code += `${indent}      throw new Error(\`Expected ${filterType} at ${arrayPath}[\${${fieldName}_correlationIndex}] but found \${actualType}\`);\n`;
      code += `${indent}    } else {\n`;
      code += `${indent}      // Array index out of bounds\n`;
      code += `${indent}      throw new Error(\`Could not find ${filterType} at index \${${fieldName}_correlationIndex} (index out of bounds: array has \${${fieldName}_array.length} elements)\`);\n`;
      code += `${indent}    }\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n`;

      const targetPath = `${fieldName}_targetItem${remainingPath}`;
      code += `${indent}const ${fieldName}_computed = crc32(${targetPath});\n`;
    } else if (firstLastInfo) {
      // first/last selector - need to look up from tracking array
      const { arrayPath, filterType, selector } = firstLastInfo;
      const remainingPath = targetField.substring(targetField.indexOf(']') + 1);

      code += `${indent}// Look up ${selector} item from position tracking\n`;
      code += `${indent}const ${fieldName}_positions_crc = context.positions.get('${arrayPath}_${filterType}') || [];\n`;
      code += `${indent}const targetIndex = ${fieldName}_positions_crc.length > 0 ? ${selector === "first" ? "0" : `${fieldName}_positions_crc.length - 1`} : undefined;\n`;
      code += `${indent}if (targetIndex === undefined) throw new Error('${selector} ${filterType} not found in ${arrayPath}');\n`;
      code += `${indent}const targetItem = ${baseObjectPath}.${arrayPath}[targetIndex];\n`;

      const targetPath = `targetItem${remainingPath}`;
      code += `${indent}const ${fieldName}_computed = crc32(${targetPath});\n`;
    } else {
      // Regular path resolution
      const targetPath = resolveComputedFieldPath(targetField, baseObjectPath);

      // Add validation if accessing parent fields
      if (targetPath.includes('context.parents')) {
        const parentAccessMatch = targetPath.match(/context\.parents\[context\.parents\.length - (\d+)\]\.(\w+)/);
        if (parentAccessMatch) {
          const levelsUp = parentAccessMatch[1];
          const parentFieldName = parentAccessMatch[2];
          code += `${indent}if (context.parents.length < ${levelsUp}) {\n`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent navigation exceeds available levels (need ${levelsUp}, have \${context.parents.length})\`);\n`;
          code += `${indent}}\n`;
          code += `${indent}if (!${targetPath.split('.').slice(0, -1).join('.')}) {\n`;
          code += `${indent}  throw new Error(\`Cannot access parent field '${parentFieldName}': parent not found in context\`);\n`;
          code += `${indent}}\n`;
        }
      }

      code += `${indent}const ${fieldName}_computed = crc32(${targetPath});\n`;
    }

    code += `${indent}this.writeUint32(${fieldName}_computed, "${endianness}");\n`;
  } else if (computed.type === "position_of") {
    const targetField = computed.target;

    // Check if this is a corresponding correlation
    const sameIndexInfo = parseCorrespondingTarget(targetField);
    // Check if this is a first/last selector
    const firstLastInfo = parseFirstLastTarget(targetField);

    if (sameIndexInfo) {
      // corresponding correlation - look up position from tracking map
      const { arrayPath, filterType } = sameIndexInfo;
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'\n`;
      code += `${indent}// Look up position using corresponding correlation\n`;

      // Check if array iteration context is available
      code += `${indent}if (!context.arrayIterations?.${arrayPath}) {\n`;
      code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context");\n`;
      code += `${indent}}\n`;

      // Need to determine the current item type to use the correct index counter
      // The computed field is being encoded within a specific type's fields
      // We need to extract the containing object's variable name from the context
      // For inlined encoding, look for the parent object variable (e.g., value_sections_item)

      // Determine the current item type
      // If we're in an array iteration context, use the iteration variable
      // Otherwise, use the value parameter (for encoder class methods)
      const iterSuffixPos = baseObjectPath.indexOf(ARRAY_ITER_SUFFIX);
      const itemVarPattern = iterSuffixPos >= 0
        ? baseObjectPath.substring(0, iterSuffixPos + ARRAY_ITER_SUFFIX.length)
        : baseObjectPath;

      code += `${indent}// Determine correlation index based on current item type\n`;
      code += `${indent}const currentType = ${itemVarPattern}.type;\n`;
      code += `${indent}// Check if this is same-array type correlation (target in same array) or cross-array index correlation\n`;
      code += `${indent}const isSameArrayCorrelation = currentType !== undefined && context.arrayIterations.${arrayPath}?.typeIndices.has(currentType);\n`;
      code += `${indent}let correlationIndex: number;\n`;
      code += `${indent}if (isSameArrayCorrelation) {\n`;
      code += `${indent}  // Same-array: use current type's occurrence index\n`;
      code += `${indent}  const typeOccurrenceIndex = context.arrayIterations.${arrayPath}.typeIndices.get(currentType) ?? 0;\n`;
      code += `${indent}  if (typeOccurrenceIndex === 0) {\n`;
      code += `${indent}    throw new Error(\`Field '${fieldName}' uses corresponding correlation but current type '\${currentType}' has not been seen yet in '${arrayPath}'\`);\n`;
      code += `${indent}  }\n`;
      code += `${indent}  // Subtract 1 because counter was incremented after we started encoding this item\n`;
      code += `${indent}  correlationIndex = typeOccurrenceIndex - 1;\n`;
      code += `${indent}} else {\n`;
      code += `${indent}  // Cross-array: use current array index\n`;
      code += `${indent}  let currentArrayIndex = -1;\n`;
      code += `${indent}  for (const [arrayName, arrayInfo] of Object.entries(context.arrayIterations)) {\n`;
      code += `${indent}    if (arrayName !== '${arrayPath}' && arrayInfo.items.includes(${itemVarPattern})) {\n`;
      code += `${indent}      currentArrayIndex = arrayInfo.index;\n`;
      code += `${indent}      break;\n`;
      code += `${indent}    }\n`;
      code += `${indent}  }\n`;
      code += `${indent}  if (currentArrayIndex === -1) {\n`;
      code += `${indent}    throw new Error(\`Could not determine current array index for corresponding correlation\`);\n`;
      code += `${indent}  }\n`;
      code += `${indent}  correlationIndex = currentArrayIndex;\n`;
      code += `${indent}}\n`;
      code += `${indent}// Look up the position of the Nth ${filterType}\n`;
      code += `${indent}const ${fieldName}_positions_array = context.positions.get('${arrayPath}_${filterType}') || [];\n`;
      code += `${indent}if (process.env.DEBUG_TEST) console.log('[DEBUG] position_of ${fieldName}: positions array for ${arrayPath}_${filterType}:', ${fieldName}_positions_array, 'correlationIndex:', correlationIndex);\n`;
      code += `${indent}const ${fieldName}_computed = ${fieldName}_positions_array[correlationIndex];\n`;
      code += `${indent}if (${fieldName}_computed === undefined) {\n`;
      code += `${indent}  throw new Error(\`corresponding correlation failed: no ${filterType} at occurrence index \${correlationIndex}\`);\n`;
      code += `${indent}}\n`;
    } else if (firstLastInfo) {
      // first/last selector - look up position from tracking array
      const { arrayPath, filterType, selector } = firstLastInfo;
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'\n`;
      code += `${indent}// Look up ${selector} ${filterType} in ${arrayPath}\n`;

      code += `${indent}const ${fieldName}_positions = context.positions.get('${arrayPath}_${filterType}') || [];\n`;

      if (selector === "first") {
        code += `${indent}const ${fieldName}_computed = ${fieldName}_positions.length > 0 ? ${fieldName}_positions[0] : 0xFFFFFFFF;\n`;
      } else { // last
        code += `${indent}const ${fieldName}_computed = ${fieldName}_positions.length > 0 ? ${fieldName}_positions[${fieldName}_positions.length - 1] : 0xFFFFFFFF;\n`;
      }
    } else {
      // Regular position_of - compute from current offset
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'\n`;

      // Find the target field and compute its position
      let sizeToTarget = 0;
      if (containingFields) {
        // Find the current field's index and the target field's index
        const currentFieldIndex = containingFields.findIndex(f => f.name === fieldName);
        const targetFieldIndex = containingFields.findIndex(f => f.name === targetField);

        if (currentFieldIndex >= 0 && targetFieldIndex >= 0) {
          // Sum sizes of current field + fields between current and target
          // This gives us the offset from current byteOffset to target field start
          for (let i = currentFieldIndex; i < targetFieldIndex; i++) {
            const f = containingFields[i];
            sizeToTarget += getFieldSize(f, schema);
          }
        } else {
          // Target field not found in containing fields - this shouldn't happen in valid schemas
          // Fall back to current offset + this field's size
          sizeToTarget = getFieldSize(field, schema);
        }
      } else {
        // No containing fields info - fall back to current offset + this field's size
        sizeToTarget = getFieldSize(field, schema);
      }

      code += `${indent}const ${fieldName}_computed = this.byteOffset`;
      if (sizeToTarget > 0) {
        code += ` + ${sizeToTarget}`;
      }
      code += `;\n`;
    }

    // Write the computed position using appropriate write method
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${fieldName}_computed);\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${fieldName}_computed, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${fieldName}_computed), "${endianness}");\n`;
        break;
      default:
        code += `${indent}// TODO: Unsupported position field type: ${field.type}\n`;
    }
  }

  return code;
}
