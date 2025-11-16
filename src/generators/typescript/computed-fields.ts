/**
 * Computed field encoding support.
 * Handles auto-computation of length_of, crc32_of, and position_of fields.
 */

import { BinarySchema, Field, Endianness } from "../../schema/binary-schema.js";
import { getTypeFields } from "./type-utils.js";
import { ARRAY_ITER_SUFFIX } from "./shared.js";

/**
 * Resolve a computed field target path to the actual value path.
 * Handles relative paths (../) by stripping them and using value prefix.
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
  for (let i = 0; i < levelsUp; i++) {
    const lastDot = currentPath.lastIndexOf('.');
    if (lastDot > 0) {
      currentPath = currentPath.substring(0, lastDot);
    } else {
      // Already at root (e.g., "value"), can't go up further
      break;
    }
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
  const sizeVar = `${targetPath.replace(/[.\[\]]/g, "_")}_size`;
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
    code += `${indent}      // Encode item using ${elementType}Encoder to measure size\n`;
    code += `${indent}      const encoder_${fieldName} = new ${elementType}Encoder();\n`;
    code += `${indent}      const encoded_${fieldName} = encoder_${fieldName}.encode(item as ${elementType});\n`;
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

      // Check if we're in an array iteration context
      const iterSuffixPos = baseObjectPath.indexOf(ARRAY_ITER_SUFFIX);

      if (iterSuffixPos < 0) {
        // Not in array iteration context - corresponding cannot be resolved
        // This happens when generating standalone encoders for types that are meant to be used in arrays
        // Throw an error at runtime
        code += `${indent}// ERROR: corresponding reference requires array iteration context\n`;
        code += `${indent}throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context");\n`;
      } else {
        code += `${indent}// Look up correlated item using corresponding<Type>\n`;

        // Parse baseObjectPath to find root and current array
        // E.g., "value_sections__iter" -> root="value", currentArray="sections"
        const parts = baseObjectPath.substring(0, iterSuffixPos).split('_');
        const rootObjectPath = parts[0]; // Usually "value"

        const itemVarPattern = `${rootObjectPath}_${arrayPath}${ARRAY_ITER_SUFFIX}`;
        code += `${indent}const ${fieldName}_currentType = ${itemVarPattern}.type;\n`;
        code += `${indent}// Use context to get correlation index for corresponding reference\n`;
        code += `${indent}const ${fieldName}_correlationIndex = extendedContext.arrayIterations.${arrayPath}?.index ?? -1;\n`;
        code += `${indent}if (${fieldName}_correlationIndex < 0) {\n`;
        code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation on '${arrayPath}' which requires encoding within an array context");\n`;
        code += `${indent}}\n`;
        code += `${indent}const ${fieldName}_targetItem = ${rootObjectPath}.${arrayPath}[${fieldName}_correlationIndex];\n`;

        const targetPath = `${fieldName}_targetItem${remainingPath}`;

        if (computed.encoding) {
          code += `${indent}{\n`;
          code += `${indent}  const encoder = new TextEncoder();\n`;
          code += `${indent}  ${fieldName}_computed = encoder.encode(${targetPath}).length;\n`;
          code += `${indent}}\n`;
        } else {
          code += `${indent}${fieldName}_computed = ${targetPath}.length;\n`;
        }
      }
    } else if (firstLastInfo) {
      // first/last selector - need to look up from tracking array
      const { arrayPath, filterType, selector } = firstLastInfo;
      const remainingPath = targetField.substring(targetField.indexOf(']') + 1);

      code += `${indent}// Look up ${selector} item from position tracking\n`;
      const positionsArray = `this._positions_${arrayPath}_${filterType}`;
      code += `${indent}const targetIndex = ${positionsArray} && ${positionsArray}.length > 0 ? ${selector === "first" ? "0" : `${positionsArray}.length - 1`} : undefined;\n`;
      code += `${indent}if (targetIndex === undefined) throw new Error('${selector} ${filterType} not found in ${arrayPath}');\n`;
      code += `${indent}const targetItem = ${baseObjectPath}.${arrayPath}[targetIndex];\n`;

      const targetPath = `targetItem${remainingPath}`;

      if (computed.encoding) {
        code += `${indent}{\n`;
        code += `${indent}  const encoder = new TextEncoder();\n`;
        code += `${indent}  ${fieldName}_computed = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        code += `${fieldName}_computed = ${targetPath}.length;\n`;
      }
    } else {
      // Regular path resolution
      const targetPath = resolveComputedFieldPath(targetField, baseObjectPath);

      // Check if encoding is specified (for string byte length)
      if (computed.encoding) {
        // String byte length with specific encoding
        code += `${indent}{\n`;
        code += `${indent}  const encoder = new TextEncoder();\n`;
        code += `${indent}  ${fieldName}_computed = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        // Array element count or string character count
        code += `${indent}${fieldName}_computed = ${targetPath}.length;\n`;
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

      // Check if we're in an array iteration context
      const iterSuffixPos = baseObjectPath.indexOf(ARRAY_ITER_SUFFIX);

      if (iterSuffixPos < 0) {
        // Not in array iteration context - corresponding cannot be resolved
        code += `${indent}// ERROR: corresponding reference requires array iteration context\n`;
        code += `${indent}throw new Error("Field '${fieldName}' uses corresponding correlation which requires encoding within an array context");\n`;
      } else {
        code += `${indent}// Look up correlated item using corresponding<Type>\n`;

        // Parse baseObjectPath to find root and current array
        const parts = baseObjectPath.substring(0, iterSuffixPos).split('_');
        const rootObjectPath = parts[0]; // Usually "value"

        const itemVarPattern = `${rootObjectPath}_${arrayPath}${ARRAY_ITER_SUFFIX}`;
        code += `${indent}const ${fieldName}_currentType = ${itemVarPattern}.type;\n`;
        code += `${indent}// Use context to get correlation index for corresponding reference\n`;
        code += `${indent}const ${fieldName}_correlationIndex = extendedContext.arrayIterations.${arrayPath}?.index ?? -1;\n`;
        code += `${indent}if (${fieldName}_correlationIndex < 0) {\n`;
        code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation on '${arrayPath}' which requires encoding within an array context");\n`;
        code += `${indent}}\n`;
        code += `${indent}const ${fieldName}_targetItem = ${rootObjectPath}.${arrayPath}[${fieldName}_correlationIndex];\n`;

        const targetPath = `${fieldName}_targetItem${remainingPath}`;
        code += `${indent}const ${fieldName}_computed = crc32(${targetPath});\n`;
      }
    } else if (firstLastInfo) {
      // first/last selector - need to look up from tracking array
      const { arrayPath, filterType, selector } = firstLastInfo;
      const remainingPath = targetField.substring(targetField.indexOf(']') + 1);

      code += `${indent}// Look up ${selector} item from position tracking\n`;
      const positionsArray = `this._positions_${arrayPath}_${filterType}`;
      code += `${indent}const targetIndex = ${positionsArray} && ${positionsArray}.length > 0 ? ${selector === "first" ? "0" : `${positionsArray}.length - 1`} : undefined;\n`;
      code += `${indent}if (targetIndex === undefined) throw new Error('${selector} ${filterType} not found in ${arrayPath}');\n`;
      code += `${indent}const targetItem = ${baseObjectPath}.${arrayPath}[targetIndex];\n`;

      const targetPath = `targetItem${remainingPath}`;
      code += `${indent}const ${fieldName}_computed = crc32(${targetPath});\n`;
    } else {
      // Regular path resolution
      const targetPath = resolveComputedFieldPath(targetField, baseObjectPath);
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

      // Need to determine the current item type to use the correct index counter
      // The computed field is being encoded within a specific type's fields
      // We need to extract the containing object's variable name from the context
      // For inlined encoding, look for the parent object variable (e.g., value_sections_item)

      // Try to infer the item variable name from the schema context
      // For computed fields in choice types, the valuePath pattern is typically: value_arrayname__iter
      // We can infer this from the arrayPath
      const itemVarPattern = `value_${arrayPath}${ARRAY_ITER_SUFFIX}`;

      code += `${indent}// Determine current item type to use correct correlation index\n`;
      code += `${indent}const currentType = ${itemVarPattern}.type;\n`;
      code += `${indent}// Use context to get correlation index for corresponding reference\n`;
      code += `${indent}const correlationIndex = extendedContext.arrayIterations.${arrayPath}?.index ?? -1;\n`;
      code += `${indent}if (correlationIndex < 0) {\n`;
      code += `${indent}  throw new Error("Field '${fieldName}' uses corresponding correlation on '${arrayPath}' which requires encoding within an array context");\n`;
      code += `${indent}}\n`;
      code += `${indent}const ${fieldName}_computed = this._positions_${arrayPath}_${filterType}[correlationIndex];\n`;
      code += `${indent}if (${fieldName}_computed === undefined) {\n`;
      code += `${indent}  throw new Error(\`corresponding correlation failed: no ${filterType} at correlation index \${correlationIndex} for type \${currentType}\`);\n`;
      code += `${indent}}\n`;
    } else if (firstLastInfo) {
      // first/last selector - look up position from tracking array
      const { arrayPath, filterType, selector } = firstLastInfo;
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'\n`;
      code += `${indent}// Look up ${selector} ${filterType} in ${arrayPath}\n`;

      const positionsArray = `this._positions_${arrayPath}_${filterType}`;
      code += `${indent}const ${fieldName}_positions = ${positionsArray} || [];\n`;

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
