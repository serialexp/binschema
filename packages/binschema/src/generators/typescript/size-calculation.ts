/**
 * Size Calculation Code Generation
 *
 * Generates calculateSize() methods for encoder classes.
 * Used for:
 * - from_after_field computed lengths (ASN.1/DER)
 * - Buffer pre-allocation optimization
 * - Test validation
 */

import type { Field, BinarySchema, Endianness } from "../../schema/binary-schema.js";

/**
 * Calculate the encoded size of a DER/BER length value
 * - Short form (0-127): 1 byte
 * - Long form (128+): 1 + N bytes, where N = number of bytes needed
 */
function calculateDERLengthSize(value: number): number {
  if (value < 128) {
    return 1; // Short form
  }
  // Long form: 0x80 + N, followed by N bytes
  // Calculate N = number of bytes needed to represent value
  let n = 0;
  let temp = value;
  while (temp > 0) {
    n++;
    temp = temp >> 8;
  }
  return 1 + n; // 1 byte for 0x80+N, then N bytes for value
}

/**
 * Generate runtime code to calculate DER length size
 */
function generateDERLengthSizeCalculation(valueExpr: string): string {
  return `((${valueExpr}) < 128 ? 1 : 1 + Math.ceil(Math.log2(Math.max(1, ${valueExpr})) / 8))`;
}

/**
 * Generate VLQ length size calculation (MIDI-style variable length quantity)
 * VLQ uses 7 bits per byte with MSB as continuation flag
 */
function generateVLQLengthSizeCalculation(valueExpr: string): string {
  // VLQ: 1 byte for 0-127, 2 for 128-16383, 3 for 16384-2097151, 4 for 2097152-268435455
  return `((${valueExpr}) < 0x80 ? 1 : (${valueExpr}) < 0x4000 ? 2 : (${valueExpr}) < 0x200000 ? 3 : 4)`;
}

/**
 * Generate size calculation code for a single field
 */
export function generateFieldSizeCalculation(
  field: Field,
  schema: BinarySchema,
  globalEndianness: Endianness,
  indent: string = "    ",
  valuePrefix: string = "value.",
  containingFields?: Field[]
): string {
  const fieldAny = field as any;
  const fieldName = fieldAny.name;
  let code = "";

  // For computed fields, we need to account for the space they take in the output
  if (fieldAny.computed) {
    const computedType = fieldAny.computed.type;

    // length_of, position_of, count_of, crc32_of, sum_of_sizes, etc. all write data
    // We need to calculate the size of the written field
    if (computedType === "length_of" || computedType === "position_of" ||
        computedType === "count_of" || computedType === "crc32_of" ||
        computedType === "sum_of_sizes" || computedType === "sum_of_type_sizes") {

      const fieldType = fieldAny.type;

      // Fixed-size types
      if (fieldType === "uint8" || fieldType === "int8") {
        code += `${indent}size += 1; // ${fieldName} (computed)\n`;
      } else if (fieldType === "uint16" || fieldType === "int16") {
        code += `${indent}size += 2; // ${fieldName} (computed)\n`;
      } else if (fieldType === "uint32" || fieldType === "int32" || fieldType === "float32") {
        code += `${indent}size += 4; // ${fieldName} (computed)\n`;
      } else if (fieldType === "uint64" || fieldType === "int64" || fieldType === "float64") {
        code += `${indent}size += 8; // ${fieldName} (computed)\n`;
      } else if (fieldType === "varlength") {
        // For varlength fields, we need to calculate the size based on what will be encoded
        const encoding = fieldAny.encoding || "der";

        if (encoding === "der") {
          if (fieldAny.computed.from_after_field) {
            // from_after_field: handled at type level by calling encode()
            // Just skip this field in size calculation - it's already accounted for
            code += `${indent}// ${fieldName} (from_after_field): handled by type-level encode()\n`;
          } else if (computedType === "length_of") {
            // length_of: calculate based on target field's encoded size
            const target = fieldAny.computed.target;
            const offset = fieldAny.computed.offset || 0;
            code += `${indent}// ${fieldName} (computed length_of ${target}${offset !== 0 ? `, offset ${offset}` : ''})\n`;
            code += `${indent}{\n`;
            code += `${indent}  // Calculate encoded size of target field to determine length field size\n`;

            // Find the target field to determine if it's a composite type
            let targetFieldDef: any = null;
            if (containingFields) {
              targetFieldDef = containingFields.find(f => (f as any).name === target);
            }

            const isCompositeType = targetFieldDef &&
                                    (targetFieldDef as any).type &&
                                    schema.types[(targetFieldDef as any).type] !== undefined &&
                                    (targetFieldDef as any).type !== 'array';

            if (isCompositeType) {
              // For composite types, call the encoder's calculateSize
              const typeName = (targetFieldDef as any).type;
              code += `${indent}  const ${fieldName}_encoder = new ${typeName}Encoder();\n`;
              code += `${indent}  let ${fieldName}_targetSize = ${fieldName}_encoder.calculateSize(${valuePrefix}${target});\n`;
              if (offset !== 0) {
                code += `${indent}  ${fieldName}_targetSize += ${offset}; // Apply offset\n`;
              }
              code += `${indent}  size += ${generateDERLengthSizeCalculation(`${fieldName}_targetSize`)};\n`;
            } else {
              // For simple types (arrays, strings, primitives)
              code += `${indent}  let ${fieldName}_targetSize: number;\n`;
              code += `${indent}  if (typeof ${valuePrefix}${target} === 'number' || typeof ${valuePrefix}${target} === 'bigint') {\n`;
              code += `${indent}    ${fieldName}_targetSize = ${valuePrefix}${target} as number;\n`;
              code += `${indent}  } else if (Array.isArray(${valuePrefix}${target})) {\n`;
              code += `${indent}    ${fieldName}_targetSize = ${valuePrefix}${target}.length;\n`;
              code += `${indent}  } else if (typeof ${valuePrefix}${target} === 'string') {\n`;
              code += `${indent}    ${fieldName}_targetSize = new TextEncoder().encode(${valuePrefix}${target}).length;\n`;
              code += `${indent}  } else {\n`;
              code += `${indent}    throw new Error("Unknown target type for length_of computation");\n`;
              code += `${indent}  }\n`;
              if (offset !== 0) {
                code += `${indent}  ${fieldName}_targetSize += ${offset}; // Apply offset\n`;
              }
              code += `${indent}  size += ${generateDERLengthSizeCalculation(`${fieldName}_targetSize`)};\n`;
            }

            code += `${indent}}\n`;
          } else if (computedType === "count_of") {
            // count_of: array element count (usually small, < 128)
            code += `${indent}size += 1; // ${fieldName} (computed count_of) - assume short form DER\n`;
          } else {
            // Other computed types
            code += `${indent}size += 1; // ${fieldName} (computed ${computedType}) - assume short form DER\n`;
          }
        } else {
          code += `${indent}// TODO: Size calculation for ${encoding} varlength not yet implemented\n`;
          code += `${indent}size += 1; // ${fieldName} (estimated)\n`;
        }
      }

      return code;
    }

    // Other computed types (like discriminators) might not write anything
    return "";
  }

  const fieldType = fieldAny.type;

  // Handle const fields (fixed size, always encoded)
  if (fieldAny.const !== undefined) {
    // Const fields have fixed size based on type
    switch (fieldType) {
      case "uint8":
      case "int8":
        code += `${indent}size += 1; // ${fieldName} (const)\n`;
        return code;
      case "uint16":
      case "int16":
        code += `${indent}size += 2; // ${fieldName} (const)\n`;
        return code;
      case "uint32":
      case "int32":
      case "float32":
        code += `${indent}size += 4; // ${fieldName} (const)\n`;
        return code;
      case "uint64":
      case "int64":
      case "float64":
        code += `${indent}size += 8; // ${fieldName} (const)\n`;
        return code;
      case "string":
        if (fieldAny.kind === "fixed") {
          code += `${indent}size += ${fieldAny.length}; // ${fieldName} (string const)\n`;
        }
        return code;
      default:
        // Unknown const type, shouldn't happen
        code += `${indent}size += 1; // ${fieldName} (const, assuming 1 byte)\n`;
        return code;
    }
  }

  // Handle conditional fields (only calculate if condition is true)
  if (fieldAny.if) {
    code += `${indent}if (${fieldAny.if}) {\n`;
    indent += "  ";
  }

  // Handle optional fields (check if defined)
  const isOptional = fieldType === "optional";
  if (isOptional) {
    code += `${indent}if (${valuePrefix}${fieldName} !== undefined) {\n`;
    indent += "  ";
  }

  // Generate size calculation based on field type
  switch (fieldType) {
    case "uint8":
    case "int8":
      code += `${indent}size += 1; // ${fieldName}\n`;
      break;

    case "uint16":
    case "int16":
      code += `${indent}size += 2; // ${fieldName}\n`;
      break;

    case "uint32":
    case "int32":
    case "float32":
      code += `${indent}size += 4; // ${fieldName}\n`;
      break;

    case "uint64":
    case "int64":
    case "float64":
      code += `${indent}size += 8; // ${fieldName}\n`;
      break;

    case "varlength": {
      const encoding = fieldAny.encoding || "der";
      code += `${indent}// ${fieldName}: varlength (${encoding})\n`;

      if (encoding === "der") {
        // DER encoding: calculate based on value
        code += `${indent}size += ${generateDERLengthSizeCalculation(`${valuePrefix}${fieldName}`)};\n`;
      } else if (encoding === "vlq") {
        // VLQ encoding: 7 bits per byte, MSB continuation
        code += `${indent}size += ${generateVLQLengthSizeCalculation(`${valuePrefix}${fieldName}`)};\n`;
      } else {
        // For other encodings (leb128, ebml), we need more complex logic
        // For now, use approximate: assume worst case or encode to measure
        code += `${indent}// TODO: Implement size calculation for ${encoding} encoding\n`;
        code += `${indent}throw new Error("Size calculation for ${encoding} varlength not yet implemented");\n`;
      }
      break;
    }

    case "string": {
      const encoding = fieldAny.encoding || "utf8";
      code += `${indent}// ${fieldName}: string (${encoding})\n`;

      if (encoding === "utf8") {
        // UTF-8 can use multi-byte encoding, use TextEncoder for accurate byte count
        code += `${indent}size += new TextEncoder().encode(${valuePrefix}${fieldName}).length;\n`;
      } else if (encoding === "ascii" || encoding === "latin1") {
        // ASCII and Latin-1 are 1:1 byte mappings, string length = byte length
        code += `${indent}size += ${valuePrefix}${fieldName}.length;\n`;
      } else {
        code += `${indent}throw new Error("Size calculation for ${encoding} string encoding not yet implemented");\n`;
      }
      break;
    }

    case "array": {
      const arrayKind = fieldAny.kind;
      const items = fieldAny.items;

      code += `${indent}// ${fieldName}: array (kind: ${arrayKind})\n`;

      // For byte_length_prefixed arrays, we need to account for the length prefix itself
      if (arrayKind === "byte_length_prefixed") {
        const lengthType = fieldAny.length_type;
        const lengthEncoding = fieldAny.length_encoding;

        // First, calculate size of array items and store in temp variable
        // Use unique suffix to avoid collisions when same field appears in encode() and calculateSize()
        const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        const itemsSizeVar = `${fieldName}_items_size${uniqueSuffix}`;
        code += `${indent}let ${itemsSizeVar} = 0;\n`;

        // Calculate item sizes
        if (items) {
          if (items.type === "uint8") {
            code += `${indent}${itemsSizeVar} += ${valuePrefix}${fieldName}.length;\n`;
          } else if (items.type === "choice") {
            // Choice array: determine type and calculate size accordingly
            const choices = (items as any).choices || [];
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {\n`;
            for (let i = 0; i < choices.length; i++) {
              const choice = choices[i];
              const ifKeyword = i === 0 ? "if" : "} else if";
              code += `${indent}  ${ifKeyword} (item.type === '${choice.type}') {\n`;
              code += `${indent}    const itemEncoder = new ${choice.type}Encoder();\n`;
              code += `${indent}    ${itemsSizeVar} += itemEncoder.calculateSize(item as ${choice.type});\n`;
            }
            if (choices.length > 0) {
              code += `${indent}  } else {\n`;
              code += `${indent}    throw new Error(\`Unknown choice type: \${(item as any).type}\`);\n`;
              code += `${indent}  }\n`;
            }
            code += `${indent}}\n`;
          } else {
            const itemTypeName = items.type;
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {\n`;
            if (isBuiltInType(itemTypeName)) {
              code += `${indent}  ${itemsSizeVar} += ${getBuiltInTypeSize(itemTypeName)};\n`;
            } else {
              code += `${indent}  const ${fieldName}_itemEncoder = new ${itemTypeName}Encoder();\n`;
              code += `${indent}  ${itemsSizeVar} += ${fieldName}_itemEncoder.calculateSize(item);\n`;
            }
            code += `${indent}}\n`;
          }
        }

        // Now add the size of the length prefix itself
        if (lengthType === "uint8") {
          code += `${indent}size += 1; // length prefix (uint8)\n`;
        } else if (lengthType === "uint16") {
          code += `${indent}size += 2; // length prefix (uint16)\n`;
        } else if (lengthType === "uint32") {
          code += `${indent}size += 4; // length prefix (uint32)\n`;
        } else if (lengthType === "uint64") {
          code += `${indent}size += 8; // length prefix (uint64)\n`;
        } else if (lengthType === "varlength") {
          const encoding = lengthEncoding || "der";
          if (encoding === "der") {
            code += `${indent}size += ${generateDERLengthSizeCalculation(itemsSizeVar)}; // length prefix (DER)\n`;
          } else {
            code += `${indent}throw new Error("Size calculation for ${encoding} varlength not yet implemented");\n`;
          }
        }

        // Add the items size
        code += `${indent}size += ${itemsSizeVar}; // array items\n`;
      } else {
        // For other array kinds, just calculate item sizes
        if (items) {
          if (items.type === "uint8") {
            // Array of bytes - just the length
            code += `${indent}size += ${valuePrefix}${fieldName}.length;\n`;
          } else if (items.type === "choice") {
            // Choice array: determine type and calculate size accordingly
            const choices = (items as any).choices || [];
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {\n`;
            for (let i = 0; i < choices.length; i++) {
              const choice = choices[i];
              const ifKeyword = i === 0 ? "if" : "} else if";
              code += `${indent}  ${ifKeyword} (item.type === '${choice.type}') {\n`;
              code += `${indent}    const itemEncoder = new ${choice.type}Encoder();\n`;
              code += `${indent}    size += itemEncoder.calculateSize(item as ${choice.type});\n`;
            }
            if (choices.length > 0) {
              code += `${indent}  } else {\n`;
              code += `${indent}    throw new Error(\`Unknown choice type: \${(item as any).type}\`);\n`;
              code += `${indent}  }\n`;
            }
            code += `${indent}}\n`;
          } else {
            // Array of composite types - need to recursively calculate
            const itemTypeName = items.type;
            code += `${indent}for (const item of ${valuePrefix}${fieldName}) {\n`;

            // Check if this is a built-in type or custom type
            if (isBuiltInType(itemTypeName)) {
              code += `${indent}  size += ${getBuiltInTypeSize(itemTypeName)};\n`;
            } else {
              // Custom type - need to call its encoder's calculateSize
              code += `${indent}  const ${fieldName}_itemEncoder = new ${itemTypeName}Encoder();\n`;
              code += `${indent}  size += ${fieldName}_itemEncoder.calculateSize(item);\n`;
            }

            code += `${indent}}\n`;
          }
        } else {
          code += `${indent}throw new Error("Array items not defined for ${fieldName}");\n`;
        }
      }
      break;
    }

    case "discriminated_union": {
      // Dispatch on variant .type and call each variant's calculateSize
      const variants = fieldAny.variants || [];
      const duPath = `${valuePrefix}${fieldName}`;
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const ifKw = i === 0 ? "if" : "else if";
        if (v.when) {
          code += `${indent}${ifKw} (${duPath}.type === '${v.type}') {\n`;
        } else {
          code += `${indent}else {\n`;
        }
        code += `${indent}  const _enc = new ${v.type}Encoder();\n`;
        code += `${indent}  size += _enc.calculateSize(${duPath}.value);\n`;
        code += `${indent}}\n`;
      }
      const hasFallback = variants.some((v: any) => !v.when);
      if (!hasFallback) {
        code += `${indent}else {\n`;
        code += `${indent}  throw new Error(\`Unknown variant type for ${fieldName}: \${${duPath}.type}\`);\n`;
        code += `${indent}}\n`;
      }
      break;
    }

    default: {
      // Assume this is a custom composite type
      // Call its encoder's calculateSize method
      code += `${indent}// ${fieldName}: custom type (${fieldType})\n`;
      code += `${indent}const ${fieldName}_encoder = new ${fieldType}Encoder();\n`;
      code += `${indent}size += ${fieldName}_encoder.calculateSize(${valuePrefix}${fieldName});\n`;
      break;
    }
  }

  // Close optional/conditional blocks
  if (isOptional) {
    indent = indent.substring(2);
    code += `${indent}}\n`;
  }

  if (fieldAny.if) {
    indent = indent.substring(2);
    code += `${indent}}\n`;
  }

  return code;
}

/**
 * Check if a type is a built-in primitive type
 */
function isBuiltInType(typeName: string): boolean {
  const builtIns = [
    "uint8", "uint16", "uint32", "uint64",
    "int8", "int16", "int32", "int64",
    "float32", "float64", "string", "varlength"
  ];
  return builtIns.includes(typeName);
}

/**
 * Get the fixed size of a built-in type (or 0 if variable)
 */
function getBuiltInTypeSize(typeName: string): number {
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
      return 0; // Variable size
  }
}

/**
 * Generate a complete calculateSize() method for a composite type
 */
export function generateCalculateSizeMethod(
  typeName: string,
  fields: Field[],
  schema: BinarySchema,
  globalEndianness: Endianness,
  hasContext: boolean
): string {
  const contextParam = hasContext ? ', context?: EncodingContext' : '';

  // Check if this type has any from_after_field - if so, use encode() for size calculation
  const hasFromAfterField = fields.some(f => {
    const fieldAny = f as any;
    return fieldAny.computed?.type === "length_of" && fieldAny.computed.from_after_field;
  });

  let code = `\n  /**\n`;
  code += `   * Calculate the encoded size of a ${typeName} value.\n`;
  if (hasFromAfterField) {
    code += `   * This type uses from_after_field, so we encode to determine size.\n`;
  } else {
    code += `   * Used for from_after_field computed lengths and buffer pre-allocation.\n`;
  }
  code += `   */\n`;
  code += `  calculateSize(value: ${typeName}${contextParam}): number {\n`;

  if (hasFromAfterField) {
    // For types with from_after_field, just encode and return length
    code += `    // This type uses from_after_field - encode to get exact size\n`;
    code += `    return this.encode(value${contextParam ? ', context' : ''}).length;\n`;
  } else {
    // Normal size calculation
    code += `    let size = 0;\n`;

    // For type aliases (single pseudo-field named 'value'), use empty prefix
    // For normal types, use "value." prefix to access fields
    const isTypeAlias = fields.length === 1 && (fields[0] as any).name === 'value';
    const valuePrefix = isTypeAlias ? "" : "value.";

    // Generate size calculation for each field
    for (const field of fields) {
      code += generateFieldSizeCalculation(field, schema, globalEndianness, "    ", valuePrefix, fields);
    }

    code += `    return size;\n`;
  }

  code += `  }\n`;

  return code;
}
