/**
 * Computed field encoding support.
 * Handles auto-computation of length_of, crc32_of, and position_of fields.
 */

import { BinarySchema, Field, Endianness } from "../../schema/binary-schema.js";
import { getTypeFields } from "./type-utils.js";
import { ARRAY_ITER_SUFFIX } from "./shared.js";
import { generateFieldSizeCalculation } from "./size-calculation.js";

/**
 * Generate a unique variable name for a computed field.
 * When nested types are inlined, multiple fields with the same name (e.g., "length")
 * would create variable name collisions. This adds a unique suffix to prevent that.
 */
function makeUniqueComputedVar(fieldName: string): string {
  // Use timestamp + random string for uniqueness
  const suffix = `_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  return `${fieldName}_computed${suffix}`;
}

/**
 * Get the writeVarlength method name for a given encoding
 */
export function getVarlengthWriteMethod(encoding: string): string {
  const methodMap: Record<string, string> = {
    'der': 'writeVarlengthDER',
    'leb128': 'writeVarlengthLEB128',
    'ebml': 'writeVarlengthEBML',
    'vlq': 'writeVarlengthVLQ'
  };
  return methodMap[encoding] || 'writeVarlengthDER'; // Default to DER
}

/**
 * Convert conditional expression to TypeScript
 */
function convertConditionalToTypeScript(condition: any, basePath: string): string {
  // For now, handle simple field reference conditions
  // Example: condition might be "field > 0" or just "field"
  if (typeof condition === 'string') {
    // Simple field reference - add basePath
    return `${basePath}.${condition}`;
  } else if (typeof condition === 'object' && condition !== null) {
    // Complex condition object - would need full implementation
    // For now, just convert to string
    return JSON.stringify(condition);
  }
  return String(condition);
}

/**
 * Generate code to encode a field to bytes and add to contentPieces array.
 * This is used for content-first encoding in from_after_field.
 */
function generateFieldEncodingToBytes(
  field: Field,
  schema: BinarySchema,
  globalEndianness: Endianness,
  indent: string,
  baseObjectPath: string,
  lengthFieldName: string,
  computedVar: string,  // The unique computed variable name (e.g., "sequence_length_computed_12345_abc")
  containingFields?: Field[]
): string {
  const fieldAny = field as any;
  const fieldName = fieldAny.name;
  const valuePath = `${baseObjectPath}.${fieldName}`;
  const tempEncoderVar = `${fieldName}_temp`;
  const bytesVar = `${fieldName}_bytes`;

  let code = "";

  // Determine if this is a composite type (has its own encoder)
  const isCompositeType = schema.types && schema.types[fieldAny.type as string];

  // Handle conditional fields
  if ((fieldAny as any).conditional) {
    const condition = (fieldAny as any).conditional;
    // Convert condition to TypeScript
    const tsCondition = convertConditionalToTypeScript(condition, baseObjectPath);
    code += `${indent}if (${tsCondition} && ${valuePath} !== undefined) {\n`;
    const innerCode = generateFieldEncodingToBytesCore(
      field,
      schema,
      globalEndianness,
      indent + "  ",
      baseObjectPath,
      lengthFieldName,
      containingFields,
      tempEncoderVar,
      bytesVar,
      computedVar,
      valuePath,
      isCompositeType
    );
    code += innerCode;
    code += `${indent}}\n\n`;
  } else {
    code += generateFieldEncodingToBytesCore(
      field,
      schema,
      globalEndianness,
      indent,
      baseObjectPath,
      lengthFieldName,
      containingFields,
      tempEncoderVar,
      bytesVar,
      computedVar,
      valuePath,
      isCompositeType
    );
  }

  return code;
}

/**
 * Core logic for encoding a field to bytes
 */
function generateFieldEncodingToBytesCore(
  field: Field,
  schema: BinarySchema,
  globalEndianness: Endianness,
  indent: string,
  baseObjectPath: string,
  lengthFieldName: string,
  containingFields: Field[] | undefined,
  tempEncoderVar: string,
  bytesVar: string,
  computedVar: string,
  valuePath: string,
  isCompositeType: boolean
): string {
  const fieldAny = field as any;
  const fieldName = fieldAny.name;
  let code = "";

  // For composite types, use the type's encoder
  if (isCompositeType) {
    const typeName = fieldAny.type as string;
    code += `${indent}// Encode ${fieldName} (composite type: ${typeName})\n`;
    code += `${indent}{\n`;
    code += `${indent}  const ${tempEncoderVar} = new ${typeName}Encoder();\n`;
    code += `${indent}  const ${bytesVar} = ${tempEncoderVar}.encode(${valuePath});\n`;
    code += `${indent}  ${lengthFieldName}_contentPieces.push(${bytesVar});\n`;
    code += `${indent}  ${computedVar} += ${bytesVar}.length;\n`;
    code += `${indent}}\n\n`;
    return code;
  }

  // For arrays, we need to import the array encoding logic
  // This is complex because arrays can have different kinds and item types
  if (fieldAny.type === 'array') {
    code += `${indent}// Encode ${fieldName} (array)\n`;
    code += `${indent}{\n`;
    code += `${indent}  const ${tempEncoderVar} = new BitStreamEncoder();\n`;

    // Generate array encoding code inline
    // This is a simplified version - we need to handle byte_length_prefixed arrays
    const items = fieldAny.items;
    const itemType = items?.type;

    if (fieldAny.kind === 'byte_length_prefixed') {
      // Encode to temp buffer first to measure size
      code += `${indent}  const arrayTemp = new BitStreamEncoder();\n`;
      code += `${indent}  for (const item of ${valuePath}) {\n`;

      // Check if item type is composite, choice, or primitive
      const isItemComposite = schema.types && schema.types[itemType as string];
      const isItemChoice = itemType === 'choice';

      if (isItemComposite) {
        code += `${indent}    const itemEncoder = new ${itemType}Encoder();\n`;
        code += `${indent}    const itemBytes = itemEncoder.encode(item);\n`;
        code += `${indent}    arrayTemp.writeBytes(itemBytes);\n`;
      } else if (isItemChoice) {
        // Handle choice items - check item.type and encode accordingly
        const choices = (items as any).choices || [];
        code += `${indent}    // Choice item - check type and encode\n`;
        for (let i = 0; i < choices.length; i++) {
          const choice = choices[i];
          const ifKeyword = i === 0 ? "if" : "} else if";
          code += `${indent}    ${ifKeyword} (item.type === '${choice.type}') {\n`;
          code += `${indent}      const itemEncoder = new ${choice.type}Encoder();\n`;
          code += `${indent}      const itemBytes = itemEncoder.encode(item);\n`;
          code += `${indent}      arrayTemp.writeBytes(itemBytes);\n`;
        }
        if (choices.length > 0) {
          code += `${indent}    } else {\n`;
          code += `${indent}      throw new Error(\`Unknown choice type: \${(item as any).type}\`);\n`;
          code += `${indent}    }\n`;
        }
      } else {
        code += `${indent}    // Primitive item type ${itemType} - not yet implemented for arrays in from_after_field\n`;
        code += `${indent}    throw new Error("Primitive array items in from_after_field not yet supported");\n`;
      }

      code += `${indent}  }\n`;
      code += `${indent}  const arrayBytes = arrayTemp.finish();\n`;
      code += `${indent}  const arrayLength = arrayBytes.length;\n\n`;

      // Write length prefix
      const lengthType = fieldAny.length_type || 'varlength';
      const lengthEncoding = fieldAny.length_encoding || 'der';

      if (lengthType === 'varlength') {
        const lengthMethod = getVarlengthWriteMethod(lengthEncoding);
        code += `${indent}  ${tempEncoderVar}.${lengthMethod}(arrayLength);\n`;
      } else {
        code += `${indent}  // Fixed-size length type ${lengthType}\n`;
        code += `${indent}  throw new Error("Fixed-size length types in arrays not yet supported in from_after_field");\n`;
      }

      code += `${indent}  ${tempEncoderVar}.writeBytes(arrayBytes);\n`;
    } else {
      code += `${indent}  throw new Error("Array kind '${fieldAny.kind}' not yet supported in from_after_field");\n`;
    }

    code += `${indent}  const ${bytesVar} = ${tempEncoderVar}.finish();\n`;
    code += `${indent}  ${lengthFieldName}_contentPieces.push(${bytesVar});\n`;
    code += `${indent}  ${computedVar} += ${bytesVar}.length;\n`;
    code += `${indent}}\n\n`;
    return code;
  }

  // For primitives, const fields, and computed fields, create a temp BitStreamEncoder
  code += `${indent}// Encode ${fieldName}\n`;
  code += `${indent}{\n`;
  code += `${indent}  const ${tempEncoderVar} = new BitStreamEncoder();\n`;

  // Generate the encoding logic
  if (fieldAny.computed) {
    // For computed fields, we need to generate the computation code but to the temp encoder
    // This will handle nested from_after_field recursively!
    code += generateComputedFieldToTempEncoder(field, schema, globalEndianness, indent + "  ", baseObjectPath, tempEncoderVar, containingFields);
  } else if (fieldAny.const !== undefined) {
    // Const field - write the constant value
    code += generatePrimitiveEncoding(field, globalEndianness, indent + "  ", tempEncoderVar, fieldAny.const.toString());
  } else {
    // Regular field - write the value
    code += generatePrimitiveEncoding(field, globalEndianness, indent + "  ", tempEncoderVar, valuePath);
  }

  code += `${indent}  const ${bytesVar} = ${tempEncoderVar}.finish();\n`;
  code += `${indent}  ${lengthFieldName}_contentPieces.push(${bytesVar});\n`;
  code += `${indent}  ${computedVar} += ${bytesVar}.length;\n`;
  code += `${indent}}\n\n`;

  return code;
}

/**
 * Generate primitive field encoding code (to a specific encoder variable)
 */
function generatePrimitiveEncoding(
  field: Field,
  globalEndianness: Endianness,
  indent: string,
  encoderVar: string,
  valuePath: string
): string {
  const fieldAny = field as any;
  const endianness = fieldAny.endianness || globalEndianness;

  let code = "";

  switch (fieldAny.type) {
    case "bit":
      code += `${indent}${encoderVar}.writeBits(${valuePath}, ${fieldAny.size});\n`;
      break;
    case "uint8":
      code += `${indent}${encoderVar}.writeUint8(${valuePath});\n`;
      break;
    case "uint16":
      code += `${indent}${encoderVar}.writeUint16(${valuePath}, "${endianness}");\n`;
      break;
    case "uint32":
      code += `${indent}${encoderVar}.writeUint32(${valuePath}, "${endianness}");\n`;
      break;
    case "uint64":
      code += `${indent}${encoderVar}.writeUint64(BigInt(${valuePath}), "${endianness}");\n`;
      break;
    case "int8":
      code += `${indent}${encoderVar}.writeInt8(${valuePath});\n`;
      break;
    case "int16":
      code += `${indent}${encoderVar}.writeInt16(${valuePath}, "${endianness}");\n`;
      break;
    case "int32":
      code += `${indent}${encoderVar}.writeInt32(${valuePath}, "${endianness}");\n`;
      break;
    case "int64":
      code += `${indent}${encoderVar}.writeInt64(BigInt(${valuePath}), "${endianness}");\n`;
      break;
    case "float32":
      code += `${indent}${encoderVar}.writeFloat32(${valuePath}, "${endianness}");\n`;
      break;
    case "float64":
      code += `${indent}${encoderVar}.writeFloat64(${valuePath}, "${endianness}");\n`;
      break;
    case "string":
      code += `${indent}{\n`;
      code += `${indent}  const encoder = new TextEncoder();\n`;
      code += `${indent}  const bytes = encoder.encode(${valuePath});\n`;
      code += `${indent}  for (const byte of bytes) {\n`;
      code += `${indent}    ${encoderVar}.writeUint8(byte);\n`;
      code += `${indent}  }\n`;
      code += `${indent}}\n`;
      break;
    case "varlength": {
      const encoding = fieldAny.encoding || "der";
      const method = getVarlengthWriteMethod(encoding);
      code += `${indent}${encoderVar}.${method}(${valuePath});\n`;
      break;
    }
    case "array":
      // Arrays need special handling - delegate to array encoding helper
      // For now, throw a more informative error with a workaround
      throw new Error(`Array field '${(field as any).name}' within from_after_field requires composite type encoding. This is a known limitation - arrays should be wrapped in a separate type.`);
    default:
      throw new Error(`Unknown primitive type for field encoding to bytes: ${fieldAny.type}`);
  }

  return code;
}

/**
 * Generate computed field encoding to temp encoder
 */
function generateComputedFieldToTempEncoder(
  field: Field,
  schema: BinarySchema,
  globalEndianness: Endianness,
  indent: string,
  baseObjectPath: string,
  encoderVar: string,
  containingFields?: Field[]
): string {
  const fieldAny = field as any;
  const computed = fieldAny.computed;

  // Generate the computed field code as normal, but replace 'this' with encoderVar
  const normalCode = generateEncodeComputedField(field, schema, globalEndianness, indent, baseObjectPath, undefined, containingFields);

  // Replace all 'this.' with '${encoderVar}.'
  const redirectedCode = normalCode.replace(/\bthis\./g, `${encoderVar}.`);

  return redirectedCode;
}

/**
 * Get the readVarlength method name for a given encoding
 */
export function getVarlengthReadMethod(encoding: string): string {
  const methodMap: Record<string, string> = {
    'der': 'readVarlengthDER',
    'leb128': 'readVarlengthLEB128',
    'ebml': 'readVarlengthEBML',
    'vlq': 'readVarlengthVLQ'
  };
  return methodMap[encoding] || 'readVarlengthDER'; // Default to DER
}

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
    const computedVar = makeUniqueComputedVar(fieldName);

    code += `${indent}// Computed field '${fieldName}': auto-compute sum of sizes for elements of type '${elementType}'\n`;
    code += `${indent}let ${computedVar} = 0;\n`;

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
    code += `${indent}      ${computedVar} += encoded_${fieldName}.length;\n`;
    code += `${indent}    }\n`;
    code += `${indent}  }\n`;
    code += `${indent}}\n`;

    // Write the computed sum
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");\n`;
        break;
      case "varlength": {
        const encoding = (fieldAny.encoding as string) || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});\n`;
        break;
      }
      default:
        throw new Error(`Computed field '${fieldName}' (sum_of_type_sizes) has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  } else if (computed.type === "sum_of_sizes") {
    const targets: string[] = computed.targets || [];
    const computedVar = makeUniqueComputedVar(fieldName);

    code += `${indent}// Computed field '${fieldName}': auto-compute sum of sizes for ${targets.length} target(s)\n`;
    code += `${indent}let ${computedVar} = 0;\n`;

    // For each target, compute its size and add to sum
    for (const target of targets) {
      const targetPath = resolveComputedFieldPath(target, baseObjectPath);

      const { code: sizeCode, sizeVar } = generateRuntimeSizeComputation(
        targetPath,
        globalEndianness,
        indent
      );

      code += sizeCode;
      code += `${indent}${computedVar} += ${sizeVar};\n`;
    }

    // Write the computed sum
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");\n`;
        break;
      case "varlength": {
        const encoding = (fieldAny.encoding as string) || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});\n`;
        break;
      }
      default:
        throw new Error(`Computed field '${fieldName}' (sum_of_sizes) has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  } else if (computed.type === "length_of") {
    const fromAfterField = (computed as any).from_after_field;
    const computedVar = makeUniqueComputedVar(fieldName);

    // Handle from_after_field (compute size of all fields after specified field)
    if (fromAfterField) {
      if (!containingFields) {
        throw new Error(`Computed field '${fieldName}' uses from_after_field but containingFields not provided to code generator`);
      }

      // Find the index of the from_after_field
      const fromAfterIndex = containingFields.findIndex(f => (f as any).name === fromAfterField);
      if (fromAfterIndex === -1) {
        throw new Error(`Computed field '${fieldName}' references from_after_field '${fromAfterField}' which doesn't exist in type`);
      }

      // Get all fields after the from_after_field (including current computed field itself)
      const currentFieldIndex = containingFields.findIndex(f => (f as any).name === fieldName);
      const fieldsAfter = containingFields.slice(fromAfterIndex + 1);

      code += `${indent}// Computed field '${fieldName}': content-first encoding for all fields after '${fromAfterField}'\n`;
      code += `${indent}// Step 1: Encode all content fields FIRST to get actual byte lengths\n`;
      code += `${indent}const ${fieldName}_contentPieces: Uint8Array[] = [];\n`;
      code += `${indent}let ${computedVar} = 0;\n\n`;

      // Import generateEncodeFieldCore to encode fields
      // For each field after from_after_field (except self), encode it to bytes
      // Skip fields that are "consumed" by nested from_after_field fields
      let skipUntilIndex = -1;
      for (let i = 0; i < fieldsAfter.length; i++) {
        const afterField = fieldsAfter[i];
        const afterFieldAny = afterField as any;

        if (afterFieldAny.name === fieldName) {
          // Skip the computed field itself to avoid circular reference
          continue;
        }

        // If this field is after a nested from_after_field, skip it (already encoded by nested)
        if (i <= skipUntilIndex) {
          continue;
        }

        // Check if this field is a nested from_after_field
        // If so, mark all remaining fields as consumed by it
        if (afterFieldAny.computed?.type === "length_of" && afterFieldAny.computed.from_after_field) {
          // This nested from_after_field will encode all remaining fields after itself
          // So we should skip them in the outer loop
          skipUntilIndex = fieldsAfter.length - 1;
        }

        // Generate code to encode this field to bytes and add to contentPieces
        // Pass the actual computedVar (with unique suffix) not just fieldName
        code += generateFieldEncodingToBytes(
          afterFieldAny,
          schema,
          globalEndianness,
          indent,
          baseObjectPath,
          fieldName,
          computedVar,  // Pass the unique computed variable name
          containingFields
        );
      }

      // Step 2: NOW we know exact size - write the length
      code += `${indent}// Step 2: Write the length based on actual encoded content size\n`;
      switch (field.type) {
        case "varlength": {
          const encoding = (fieldAny.encoding as string) || "der";
          const methodName = getVarlengthWriteMethod(encoding);
          code += `${indent}this.${methodName}(${computedVar});\n\n`;
          break;
        }
        default:
          throw new Error(`Computed field '${fieldName}' with from_after_field has unsupported type '${field.type}'. Only varlength is currently supported for from_after_field.`);
      }

      // Step 3: Write the content
      code += `${indent}// Step 3: Write the actual content\n`;
      code += `${indent}for (const piece of ${fieldName}_contentPieces) {\n`;
      code += `${indent}  this.writeBytes(piece);\n`;
      code += `${indent}}\n`;

      // Early return - we've handled this computed field AND all fields after it
      return code;
    }

    const targetField = computed.target;

    // Check if this is a corresponding or first/last selector
    const sameIndexInfo = targetField ? parseCorrespondingTarget(targetField) : null;
    const firstLastInfo = targetField ? parseFirstLastTarget(targetField) : null;

    // Compute the length value
    code += `${indent}// Computed field '${fieldName}': auto-compute length_of '${targetField}'\n`;
    code += `${indent}let ${computedVar}: number;\n`;

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
        code += `${indent}  ${computedVar} = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        // Determine if target is a composite type
        let targetFieldDef: any = null;
        const targetFieldName = targetField.split('/')[0];

        if (containingFields) {
          targetFieldDef = containingFields.find(f => (f as any).name === targetFieldName);
        }

        const isCompositeType = targetFieldDef &&
                                (targetFieldDef as any).type &&
                                schema.types[(targetFieldDef as any).type] !== undefined &&
                                (targetFieldDef as any).type !== 'array';

        if (isCompositeType) {
          const typeName = (targetFieldDef as any).type;
          code += `${indent}{\n`;
          code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();\n`;
          code += `${indent}  ${computedVar} = ${fieldName}_encoder.calculateSize(${targetPath});\n`;
          code += `${indent}}\n`;
        } else {
          // For scalars (numbers/bigints), use the value directly; for arrays/strings, use .length
          code += `${indent}${computedVar} = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;\n`;
        }

        // Apply offset if specified
        const offset = (computed as any).offset;
        if (offset !== undefined && offset !== 0) {
          code += `${indent}${computedVar} += ${offset}; // Apply offset\n`;
        }
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
        code += `${indent}  ${computedVar} = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        // Determine if target is a composite type
        let targetFieldDef: any = null;
        const targetFieldName = targetField.split('/')[0];

        if (containingFields) {
          targetFieldDef = containingFields.find(f => (f as any).name === targetFieldName);
        }

        const isCompositeType = targetFieldDef &&
                                (targetFieldDef as any).type &&
                                schema.types[(targetFieldDef as any).type] !== undefined &&
                                (targetFieldDef as any).type !== 'array';

        if (isCompositeType) {
          const typeName = (targetFieldDef as any).type;
          code += `${indent}{\n`;
          code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();\n`;
          code += `${indent}  ${computedVar} = ${fieldName}_encoder.calculateSize(${targetPath});\n`;
          code += `${indent}}\n`;
        } else {
          // For scalars (numbers/bigints), use the value directly; for arrays/strings, use .length
          code += `${computedVar} = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;\n`;
        }

        // Apply offset if specified
        const offset = (computed as any).offset;
        if (offset !== undefined && offset !== 0) {
          code += `${indent}${computedVar} += ${offset}; // Apply offset\n`;
        }
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
        code += `${indent}  ${computedVar} = encoder.encode(${targetPath}).length;\n`;
        code += `${indent}}\n`;
      } else {
        // Determine if target is a composite type by looking it up in containingFields
        let targetFieldDef: any = null;
        const targetFieldName = targetField.split('/')[0]; // Handle paths like "field/subfield"

        if (containingFields) {
          targetFieldDef = containingFields.find(f => (f as any).name === targetFieldName);
        }

        // Check if target is a composite type (custom type in schema.types)
        const isCompositeType = targetFieldDef &&
                                (targetFieldDef as any).type &&
                                schema.types[(targetFieldDef as any).type] !== undefined &&
                                (targetFieldDef as any).type !== 'array';

        if (isCompositeType) {
          // For composite types, use calculateSize()
          const typeName = (targetFieldDef as any).type;
          code += `${indent}{\n`;
          code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();\n`;
          code += `${indent}  ${computedVar} = ${fieldName}_encoder.calculateSize(${targetPath});\n`;
          code += `${indent}}\n`;
        } else {
          // Array element count, string character count, or scalar value
          // For scalars (numbers/bigints), use the value directly; for arrays/strings, use .length
          code += `${indent}${computedVar} = (typeof ${targetPath} === 'number' || typeof ${targetPath} === 'bigint') ? ${targetPath} : ${targetPath}.length;\n`;
        }

        // Apply offset if specified
        const offset = (computed as any).offset;
        if (offset !== undefined && offset !== 0) {
          code += `${indent}${computedVar} += ${offset}; // Apply offset\n`;
        }
      }
    }

    // Write the computed value using appropriate write method
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");\n`;
        break;
      case "varlength":
        const encoding = (fieldAny.encoding as string) || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});\n`;
        break;
      default:
        throw new Error(`Computed field '${fieldName}' has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  } else if (computed.type === "crc32_of") {
    const targetField = computed.target;
    const computedVar = makeUniqueComputedVar(fieldName);

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
      code += `${indent}const ${computedVar} = crc32(${targetPath});\n`;
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
      code += `${indent}const ${computedVar} = crc32(${targetPath});\n`;
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

      code += `${indent}const ${computedVar} = crc32(${targetPath});\n`;
    }

    code += `${indent}this.writeUint32(${computedVar}, "${endianness}");\n`;
  } else if (computed.type === "position_of") {
    const computedVar = makeUniqueComputedVar(fieldName);
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
      code += `${indent}const ${computedVar} = ${fieldName}_positions_array[correlationIndex];\n`;
      code += `${indent}if (${computedVar} === undefined) {\n`;
      code += `${indent}  throw new Error(\`corresponding correlation failed: no ${filterType} at occurrence index \${correlationIndex}\`);\n`;
      code += `${indent}}\n`;
    } else if (firstLastInfo) {
      // first/last selector - look up position from tracking array
      const { arrayPath, filterType, selector } = firstLastInfo;
      code += `${indent}// Computed field '${fieldName}': auto-compute position of '${targetField}'\n`;
      code += `${indent}// Look up ${selector} ${filterType} in ${arrayPath}\n`;

      code += `${indent}const ${fieldName}_positions = context.positions.get('${arrayPath}_${filterType}') || [];\n`;

      if (selector === "first") {
        code += `${indent}const ${computedVar} = ${fieldName}_positions.length > 0 ? ${fieldName}_positions[0] : 0xFFFFFFFF;\n`;
      } else { // last
        code += `${indent}const ${computedVar} = ${fieldName}_positions.length > 0 ? ${fieldName}_positions[${fieldName}_positions.length - 1] : 0xFFFFFFFF;\n`;
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

      code += `${indent}const ${computedVar} = this.byteOffset`;
      if (sizeToTarget > 0) {
        code += ` + ${sizeToTarget}`;
      }
      code += `;\n`;
    }

    // Write the computed position using appropriate write method
    switch (field.type) {
      case "uint8":
        code += `${indent}this.writeUint8(${computedVar});\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${computedVar}, "${endianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${computedVar}, "${endianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${computedVar}), "${endianness}");\n`;
        break;
      case "varlength": {
        const encoding = (fieldAny.encoding as string) || "der";
        const methodName = getVarlengthWriteMethod(encoding);
        code += `${indent}this.${methodName}(${computedVar});\n`;
        break;
      }
      default:
        throw new Error(`Computed field '${fieldName}' (position_of) has unsupported type '${field.type}'. Supported types: uint8, uint16, uint32, uint64, varlength`);
    }
  }

  return code;
}
