/**
 * Array encoding and decoding support.
 * Handles all array kinds: length_prefixed, fixed, field_referenced, null_terminated, signature_terminated, eof_terminated, variant_terminated.
 */

import { BinarySchema, Endianness, Field } from "../../schema/binary-schema.js";
import { sanitizeVarName } from "./type-utils.js";
import { detectCorrespondingTracking, detectFirstLastTracking, getVarlengthWriteMethod, getVarlengthReadMethod } from "./computed-fields.js";
import { ARRAY_ITER_SUFFIX } from "./shared.js";
import { generateArrayContextExtension, getContextParam, getContextVarName } from "./context-extension.js";
import { schemaRequiresContext } from "./context-analysis.js";

/**
 * Calculate the size of a fixed-size primitive type item for length_prefixed_items.
 */
export function getItemSize(itemDef: any, schema: BinarySchema, globalEndianness: Endianness): number {
  const itemType = itemDef.type;

  // Primitive types
  switch (itemType) {
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
      throw new Error(`length_prefixed_items: Cannot determine size for item type "${itemType}". Only fixed-size primitive types are supported.`);
  }
}

/**
 * Get the write method call for a primitive type (returns just the method call without value).
 */
function getWriteMethodForType(itemType: string, endianness: Endianness, valuePath: string): string {
  switch (itemType) {
    case "uint8":
      return `writeUint8(${valuePath})`;
    case "int8":
      return `writeInt8(${valuePath})`;
    case "uint16":
      return `writeUint16(${valuePath}, "${endianness}")`;
    case "int16":
      return `writeInt16(${valuePath}, "${endianness}")`;
    case "uint32":
      return `writeUint32(${valuePath}, "${endianness}")`;
    case "int32":
      return `writeInt32(${valuePath}, "${endianness}")`;
    case "float32":
      return `writeFloat32(${valuePath}, "${endianness}")`;
    case "uint64":
      return `writeUint64(BigInt(${valuePath}), "${endianness}")`;
    case "int64":
      return `writeInt64(BigInt(${valuePath}), "${endianness}")`;
    case "float64":
      return `writeFloat64(${valuePath}, "${endianness}")`;
    default:
      throw new Error(`Unknown primitive type: ${itemType}`);
  }
}

/**
 * Generate encoding code for arrays (class-based style).
 * Handles all array kinds with corresponding position tracking for choice arrays.
 */
export function generateEncodeArray(
  field: any,
  schema: BinarySchema,
  globalEndianness: Endianness,
  valuePath: string,
  indent: string,
  generateEncodeFieldCoreImpl: (field: Field, schema: BinarySchema, endianness: Endianness, valuePath: string, indent: string, contextVarName?: string) => string,
  baseContextVar: string = 'context'
): string {
  let code = "";

  // Write length prefix if length_prefixed or length_prefixed_items
  if (field.kind === "length_prefixed" || field.kind === "length_prefixed_items") {
    const lengthType = field.length_type;
    switch (lengthType) {
      case "uint8":
        code += `${indent}this.writeUint8(${valuePath}.length);\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${valuePath}.length, "${globalEndianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${valuePath}.length, "${globalEndianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${valuePath}.length), "${globalEndianness}");\n`;
        break;
    }
  }

  // Compute and write byte length for byte_length_prefixed arrays
  // This requires a double-pass: first encode to measure size, then write length + items
  if (field.kind === "byte_length_prefixed") {
    const byteLengthVarName = valuePath.replace(/\./g, "_") + "_byteLength";
    const tempEncoderVar = valuePath.replace(/[.\[\]]/g, "_") + "_tempEncoder";

    code += `${indent}// First pass: encode items to temporary encoder to measure total byte length\n`;
    code += `${indent}const ${tempEncoderVar} = new (this.constructor as any)();\n`;

    const itemVar = valuePath.replace(/[.\[\]]/g, "_") + "_measure_item";
    code += `${indent}for (const ${itemVar} of ${valuePath}) {\n`;

    // Encode each item to measure its size
    const itemType = field.items?.type;
    const isPrimitive = ['uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'float32', 'uint64', 'int64', 'float64'].includes(itemType || '');

    if (itemType === 'choice') {
      // Choice array: need to determine type and encode accordingly
      const choices = field.items?.choices || [];
      code += `${indent}  // Determine item type and encode to measure size\n`;
      for (const choice of choices) {
        code += `${indent}  if (${itemVar}.type === '${choice.type}') {\n`;
        code += `${indent}    const itemEncoder = new ${choice.type}Encoder();\n`;
        code += `${indent}    const itemBytes = itemEncoder.encode(${itemVar} as ${choice.type});\n`;
        code += `${indent}    ${tempEncoderVar}.writeBytes(itemBytes);\n`;
        code += `${indent}  }\n`;
      }
    } else if (isPrimitive) {
      // Primitive type: directly write to temp encoder
      const writeMethod = getWriteMethodForType(itemType || '', globalEndianness, itemVar);
      code += `${indent}  ${tempEncoderVar}.${writeMethod};\n`;
    } else {
      // Custom type: encode to measure size
      code += `${indent}  const itemEncoder = new ${itemType}Encoder();\n`;
      code += `${indent}  const itemBytes = itemEncoder.encode(${itemVar});\n`;
      code += `${indent}  ${tempEncoderVar}.writeBytes(itemBytes);\n`;
    }
    code += `${indent}}\n`;
    code += `${indent}const ${byteLengthVarName} = ${tempEncoderVar}.byteOffset;\n\n`;

    // Now write the computed byte length using length_type
    code += `${indent}// Write computed byte length prefix\n`;
    const lengthType = field.length_type;
    if (lengthType === "uint8") {
      code += `${indent}this.writeUint8(${byteLengthVarName});\n`;
    } else if (lengthType === "uint16") {
      code += `${indent}this.writeUint16(${byteLengthVarName}, "${globalEndianness}");\n`;
    } else if (lengthType === "uint32") {
      code += `${indent}this.writeUint32(${byteLengthVarName}, "${globalEndianness}");\n`;
    } else if (lengthType === "uint64") {
      code += `${indent}this.writeUint64(BigInt(${byteLengthVarName}), "${globalEndianness}");\n`;
    } else if (lengthType === "varlength") {
      const encoding = field.length_encoding || "der";
      const methodName = getVarlengthWriteMethod(encoding);
      code += `${indent}this.${methodName}(${byteLengthVarName});\n`;
    } else {
      throw new Error(`Unsupported length_type for byte_length_prefixed array: ${lengthType}`);
    }
  }

  // Note: field_referenced arrays don't write their own length -
  // the length field was already written earlier in the sequence

  // Safety check for items field
  if (!field.items || typeof field.items !== 'object' || !('type' in field.items)) {
    return `${indent}// ERROR: Array field '${valuePath}' has undefined or invalid items\n`;
  }

  const fieldName = field.name || valuePath.split('.').pop() || 'array';

  // Check if this array needs position tracking (corresponding, first/last)
  const correspondingTypes = detectCorrespondingTracking(field, schema) || new Set();
  const firstLastTypes = detectFirstLastTracking(fieldName, schema);

  // Merge all types that need position tracking
  const trackingTypes = new Set([...correspondingTypes, ...firstLastTypes]);

  // Initialize position tracking if needed
  if (trackingTypes.size > 0 && schemaRequiresContext(schema)) {
    code += `${indent}// Initialize position tracking (corresponding, first/last) in context\n`;
    for (const typeName of trackingTypes) {
      code += `${indent}context.positions.set('${fieldName}_${typeName}', []);\n`;
    }
  }

  // Validate fixed-length arrays have correct length
  if (field.kind === "fixed" && field.length !== undefined) {
    code += `${indent}// Validate fixed-length array\n`;
    code += `${indent}if (${valuePath}.length !== ${field.length}) {\n`;
    code += `${indent}  throw new Error(\`Array '${fieldName}' must have exactly ${field.length} elements, got \${${valuePath}.length}\`);\n`;
    code += `${indent}}\n`;
  }

  // Initialize type indices Map for choice arrays (before loop)
  const isChoiceArray = field.items?.type === "choice";
  const choiceTypes = isChoiceArray ? (field.items?.choices || []).map((c: any) => c.type) : [];
  if (isChoiceArray && choiceTypes.length > 0 && schema) {
    code += `${indent}// Initialize type indices for corresponding correlation\n`;
    code += `${indent}const ${valuePath.replace(/\./g, "_")}_typeIndices = new Map<string, number>();\n`;
    for (const typeName of choiceTypes) {
      code += `${indent}${valuePath.replace(/\./g, "_")}_typeIndices.set('${typeName}', 0);\n`;
    }
  }

  // Write array elements
  // Use unique variable name to avoid shadowing in nested arrays
  const itemVar = valuePath.replace(/[.\[\]]/g, "_") + ARRAY_ITER_SUFFIX;

  // Pre-pass: compute positions before encoding (for first/last and position_of+corresponding)
  // Note: length_of+corresponding requires inline tracking during encoding because it needs iteration context
  if (trackingTypes.size > 0) {
    code += `${indent}// Pre-pass: compute item positions for first/last selectors\n`;
    code += `${indent}let ${itemVar}_offset = this.byteOffset;\n`;
    code += `${indent}for (let ${itemVar}_prepass_index = 0; ${itemVar}_prepass_index < ${valuePath}.length; ${itemVar}_prepass_index++) {\n`;
    code += `${indent}  const ${itemVar} = ${valuePath}[${itemVar}_prepass_index];\n`;

    // Determine if this is a choice array and extract choice types
    const isChoiceArray = field.items?.type === "choice";
    const choiceTypes = isChoiceArray ? (field.items?.choices || []).map((c: any) => c.type) : [];

    // Generate context extension for pre-pass iteration
    code += generateArrayContextExtension(fieldName, valuePath, itemVar, `${itemVar}_prepass_index`, indent + "  ", schema, isChoiceArray, choiceTypes, baseContextVar);

    // Increment type-specific occurrence counter for choice arrays (needed for corresponding correlation in encoders)
    if (isChoiceArray && choiceTypes.length > 0) {
      code += `${indent}  // Increment type-specific occurrence counter\n`;
      code += `${indent}  const currentItemType_prepass = ${itemVar}.type;\n`;
      const typeIndicesVar = `${valuePath.replace(/\./g, "_")}_typeIndices`;
      const contextVar = getContextVarName(fieldName);
      if (schemaRequiresContext(schema)) {
        code += `${indent}  const currentTypeIndex_prepass = ${contextVar}.arrayIterations.${fieldName}.typeIndices.get(currentItemType_prepass) ?? 0;\n`;
        code += `${indent}  ${contextVar}.arrayIterations.${fieldName}.typeIndices.set(currentItemType_prepass, currentTypeIndex_prepass + 1);\n`;
      } else {
        code += `${indent}  const currentTypeIndex_prepass = ${typeIndicesVar}.get(currentItemType_prepass) ?? 0;\n`;
        code += `${indent}  ${typeIndicesVar}.set(currentItemType_prepass, currentTypeIndex_prepass + 1);\n`;
      }
    }

    if (field.items?.type === "choice") {
      // Choice array: track position based on item type in pre-pass
      // This includes both first/last AND position_of+corresponding types
      const contextVar = getContextVarName(fieldName);
      for (const typeName of trackingTypes) {
        code += `${indent}  if (${itemVar}.type === '${typeName}') {\n`;
        if (schemaRequiresContext(schema)) {
          code += `${indent}    ${contextVar}.positions.get('${fieldName}_${typeName}')!.push(${itemVar}_offset);\n`;
        } else {
          code += `${indent}    this._positions_${fieldName}_${typeName}.push(${itemVar}_offset);\n`;
        }
        code += `${indent}  }\n`;
      }
      // After tracking position, advance offset by item size
      code += `${indent}  // Advance offset by item size\n`;
      const choices = field.items.choices || [];
      for (let i = 0; i < choices.length; i++) {
        const choice = choices[i];
        const ifOrElseIf = i === 0 ? "if" : "else if";
        code += `${indent}  ${ifOrElseIf} (${itemVar}.type === '${choice.type}') {\n`;
        code += `${indent}    // Encode to temporary encoder to measure size\n`;
        code += `${indent}    const temp_encoder = new ${choice.type}Encoder();\n`;
        code += `${indent}    const temp_bytes = temp_encoder.encode(${itemVar} as ${choice.type}${getContextParam(schema, true, fieldName)});\n`;
        code += `${indent}    ${itemVar}_offset += temp_bytes.length;\n`;
        code += `${indent}  }\n`;
      }
    } else {
      // Non-choice array: track position for the single item type in pre-pass
      // This includes both first/last AND position_of+corresponding types
      const itemType = field.items?.type;
      const contextVar = getContextVarName(fieldName);
      if (itemType && trackingTypes.has(itemType)) {
        if (schemaRequiresContext(schema)) {
          code += `${indent}  ${contextVar}.positions.get('${fieldName}_${itemType}')!.push(${itemVar}_offset);\n`;
        } else {
          code += `${indent}  this._positions_${fieldName}_${itemType}.push(${itemVar}_offset);\n`;
        }
        // Advance offset by item size
        code += `${indent}  // Encode to temporary encoder to measure size\n`;
        code += `${indent}  const temp_encoder = new ${itemType}Encoder();\n`;
        code += `${indent}  const temp_bytes = temp_encoder.encode(${itemVar}${getContextParam(schema, true, fieldName)});\n`;
        code += `${indent}  ${itemVar}_offset += temp_bytes.length;\n`;
      }
    }
    code += `${indent}}\n\n`;
  }

  // Reset type indices after pre-pass (they were incremented during pre-pass for position tracking)
  // This ensures the main encoding loop starts with fresh occurrence counters
  if (isChoiceArray && choiceTypes.length > 0 && trackingTypes.size > 0) {
    const typeIndicesVar = `${valuePath.replace(/\./g, "_")}_typeIndices`;
    code += `${indent}// Reset type indices for main encoding loop\n`;
    for (const typeName of choiceTypes) {
      code += `${indent}${typeIndicesVar}.set('${typeName}', 0);\n`;
    }
  }

  // Track if we encounter a terminal variant (to skip null terminator for null_terminated, or to break for variant_terminated)
  const hasTerminalVariants = (field.kind === "null_terminated" || field.kind === "variant_terminated") && field.terminal_variants && Array.isArray(field.terminal_variants) && field.terminal_variants.length > 0;
  if (hasTerminalVariants) {
    const terminatedVar = valuePath.replace(/[.\[\]]/g, "_") + "_terminated";
    code += `${indent}let ${terminatedVar} = false;\n`;
  }

  code += `${indent}for (let ${itemVar}_index = 0; ${itemVar}_index < ${valuePath}.length; ${itemVar}_index++) {\n`;
  code += `${indent}  const ${itemVar} = ${valuePath}[${itemVar}_index];\n`;

  // Generate context extension for array iteration
  code += generateArrayContextExtension(fieldName, valuePath, itemVar, `${itemVar}_index`, indent + "  ", schema, isChoiceArray, choiceTypes, baseContextVar);

  // Increment type-specific occurrence counter for choice arrays (after context extension, before encoding)
  if (isChoiceArray && choiceTypes.length > 0) {
    code += `${indent}  // Increment type-specific occurrence counter\n`;
    code += `${indent}  const currentItemType = ${itemVar}.type;\n`;
    const typeIndicesVar = `${valuePath.replace(/\./g, "_")}_typeIndices`;
    const contextVar = getContextVarName(fieldName);
    if (schemaRequiresContext(schema)) {
      // When context is enabled, use context.arrayIterations
      code += `${indent}  const currentTypeIndex = ${contextVar}.arrayIterations.${fieldName}.typeIndices.get(currentItemType) ?? 0;\n`;
      code += `${indent}  ${contextVar}.arrayIterations.${fieldName}.typeIndices.set(currentItemType, currentTypeIndex + 1);\n`;
    } else {
      // When context is not enabled, use local typeIndices Map directly
      code += `${indent}  const currentTypeIndex = ${typeIndicesVar}.get(currentItemType) ?? 0;\n`;
      code += `${indent}  ${typeIndicesVar}.set(currentItemType, currentTypeIndex + 1);\n`;
    }
  }

  // Track position inline for corresponding types that are NOT already tracked in pre-pass
  // (i.e., corresponding types used with length_of, not position_of)
  const correspondingTypesNotInPrePass = new Set(
    [...correspondingTypes].filter(t => !trackingTypes.has(t))
  );
  if (correspondingTypesNotInPrePass.size > 0) {
    const contextVar = getContextVarName(fieldName);
    if (field.items?.type === "choice") {
      // Choice array: track position based on item type
      code += `${indent}  // Track position for corresponding correlation\n`;
      for (const typeName of correspondingTypesNotInPrePass) {
        code += `${indent}  if (${itemVar}.type === '${typeName}') {\n`;
        if (schemaRequiresContext(schema)) {
          code += `${indent}    ${contextVar}.positions.get('${fieldName}_${typeName}')!.push(this.byteOffset);\n`;
        } else {
          code += `${indent}    this._positions_${fieldName}_${typeName}.push(this.byteOffset);\n`;
        }
        code += `${indent}  }\n`;
      }
    } else {
      // Non-choice array: track position for the single item type
      const itemType = field.items?.type;
      if (itemType && correspondingTypesNotInPrePass.has(itemType)) {
        code += `${indent}  // Track position for corresponding correlation\n`;
        if (schemaRequiresContext(schema)) {
          code += `${indent}  ${contextVar}.positions.get('${fieldName}_${itemType}')!.push(this.byteOffset);\n`;
        } else {
          code += `${indent}  this._positions_${fieldName}_${itemType}.push(this.byteOffset);\n`;
        }
      }
    }
  }

  // Write item length prefix if length_prefixed_items
  if (field.kind === "length_prefixed_items" && field.item_length_type) {
    const itemLengthType = field.item_length_type;

    // Check if this is a fixed-size primitive type
    const itemType = field.items?.type;
    const isFixedSizePrimitive = ['uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'float32', 'uint64', 'int64', 'float64'].includes(itemType);

    if (isFixedSizePrimitive) {
      // For fixed-size primitives, we can write the size directly as a constant
      const itemSize = getItemSize(field.items, schema, globalEndianness);
      switch (itemLengthType) {
        case "uint8":
          code += `${indent}  this.writeUint8(${itemSize});\n`;
          break;
        case "uint16":
          code += `${indent}  this.writeUint16(${itemSize}, "${globalEndianness}");\n`;
          break;
        case "uint32":
          code += `${indent}  this.writeUint32(${itemSize}, "${globalEndianness}");\n`;
          break;
        case "uint64":
          code += `${indent}  this.writeUint64(BigInt(${itemSize}), "${globalEndianness}");\n`;
          break;
      }
    } else {
      // For variable-length types, encode to temporary encoder and measure
      code += `${indent}  // Encode item to temporary encoder to measure size\n`;
      code += `${indent}  const ${itemVar}_temp = new BitStreamEncoder("${globalEndianness === 'big_endian' ? 'msb_first' : 'lsb_first'}");\n`;

      // Generate inline encoding by reusing the encode logic
      // We'll encode to temp encoder, then copy the bytes
      const tempEncoding = generateEncodeFieldCoreImpl(
        field.items as Field,
        schema,
        globalEndianness,
        itemVar,
        indent + "  "
      );

      // Replace 'this.' with '${itemVar}_temp.' in the generated encoding code
      const modifiedEncoding = tempEncoding.replace(/\bthis\./g, `${itemVar}_temp.`);
      code += modifiedEncoding;

      code += `${indent}  const ${itemVar}_bytes = ${itemVar}_temp.finish();\n`;
      code += `${indent}  const ${itemVar}_length = ${itemVar}_bytes.length;\n`;

      // Validate size doesn't exceed max for item_length_type
      const maxSizes: {[key: string]: number} = {
        'uint8': 255,
        'uint16': 65535,
        'uint32': 4294967295,
        'uint64': Number.MAX_SAFE_INTEGER
      };
      const maxSize = maxSizes[itemLengthType];
      code += `${indent}  if (${itemVar}_length > ${maxSize}) {\n`;
      code += `${indent}    throw new Error(\`Item size \${${itemVar}_length} exceeds maximum ${maxSize} bytes for ${itemLengthType}\`);\n`;
      code += `${indent}  }\n`;

      // Write item length
      switch (itemLengthType) {
        case "uint8":
          code += `${indent}  this.writeUint8(${itemVar}_length);\n`;
          break;
        case "uint16":
          code += `${indent}  this.writeUint16(${itemVar}_length, "${globalEndianness}");\n`;
          break;
        case "uint32":
          code += `${indent}  this.writeUint32(${itemVar}_length, "${globalEndianness}");\n`;
          break;
        case "uint64":
          code += `${indent}  this.writeUint64(BigInt(${itemVar}_length), "${globalEndianness}");\n`;
          break;
      }

      // Write item bytes
      code += `${indent}  for (const byte of ${itemVar}_bytes) {\n`;
      code += `${indent}    this.writeUint8(byte);\n`;
      code += `${indent}  }\n`;

      // Continue to next iteration (don't encode again)
      code += `${indent}  continue;\n`;
    }
  }

  // Only encode if we didn't already handle it in length_prefixed_items above
  if (!(field.kind === "length_prefixed_items" && field.item_length_type && !['uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'float32', 'uint64', 'int64', 'float64'].includes(field.items?.type))) {
    // Pass field-specific context variable name for choice arrays
    const contextVarForItem = schemaRequiresContext(schema) ? getContextVarName(fieldName) : undefined;
    code += generateEncodeFieldCoreImpl(
      field.items as Field,
      schema,
      globalEndianness,
      itemVar,
      indent + "  ",
      contextVarForItem
    );
  }

  // Check if this is a terminal variant (for null_terminated or variant_terminated arrays with discriminated unions)
  if (hasTerminalVariants) {
    const terminatedVar = valuePath.replace(/[.\[\]]/g, "_") + "_terminated";
    code += `${indent}  // Check if item is a terminal variant\n`;
    const conditions = field.terminal_variants.map((v: string) => `${itemVar}.type === '${v}'`).join(' || ');
    code += `${indent}  if (${conditions}) {\n`;
    code += `${indent}    ${terminatedVar} = true;\n`;
    code += `${indent}    break;\n`;
    code += `${indent}  }\n`;
  }

  // Increment correlation index counter for corresponding tracking only
  if (correspondingTypes.size > 0 && field.items?.type === "choice") {
    code += `${indent}  // Increment correlation index for this choice type\n`;
    const choices = field.items.choices || [];
    for (const choice of choices) {
      code += `${indent}  if (${itemVar}.type === '${choice.type}') {\n`;
      code += `${indent}    this._index_${fieldName}_${choice.type}++;\n`;
      code += `${indent}  }\n`;
    }
  }

  code += `${indent}}\n`;

  // Write null terminator if null_terminated and no terminal variant was encountered
  if (field.kind === "null_terminated") {
    if (hasTerminalVariants) {
      const terminatedVar = valuePath.replace(/[.\[\]]/g, "_") + "_terminated";
      code += `${indent}if (!${terminatedVar}) {\n`;
      code += `${indent}  this.writeUint8(0);\n`;
      code += `${indent}}\n`;
    } else {
      code += `${indent}this.writeUint8(0);\n`;
    }
  }

  return code;
}

/**
 * Generate decoding code for arrays (class-based style).
 * Handles all array kinds: length_prefixed, fixed, field_referenced, null_terminated, signature_terminated, eof_terminated, variant_terminated.
 */
export function generateDecodeArray(
  field: any,
  schema: BinarySchema,
  globalEndianness: Endianness,
  fieldName: string,
  indent: string,
  addTraceLogs: boolean,
  getTargetPath: (fieldName: string) => string,
  generateDecodeFieldCore: (field: Field, schema: BinarySchema, endianness: Endianness, fieldName: string, indent: string, addTraceLogs: boolean) => string
): string {
  const target = getTargetPath(fieldName);
  let code = "";

  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoding array field ${fieldName}');\n`;
  }

  code += `${indent}${target} = [];\n`;

  // Read length if length_prefixed or length_prefixed_items
  if (field.kind === "length_prefixed" || field.kind === "length_prefixed_items") {
    const lengthType = field.length_type;
    let lengthRead = "";
    switch (lengthType) {
      case "uint8":
        lengthRead = "this.readUint8()";
        break;
      case "uint16":
        lengthRead = `this.readUint16("${globalEndianness}")`;
        break;
      case "uint32":
        lengthRead = `this.readUint32("${globalEndianness}")`;
        break;
      case "uint64":
        lengthRead = `Number(this.readUint64("${globalEndianness}"))`;
        break;
    }
    // Sanitize fieldName for use in variable name (replace dots with underscores)
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    code += `${indent}const ${lengthVarName} = ${lengthRead};\n`;
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {\n`;

    // Read item length prefix if length_prefixed_items
    if (field.kind === "length_prefixed_items" && field.item_length_type) {
      const itemLengthType = field.item_length_type;
      const itemLengthVarName = fieldName.replace(/\./g, "_") + "_item_length";
      let itemLengthRead = "";
      switch (itemLengthType) {
        case "uint8":
          itemLengthRead = "this.readUint8()";
          break;
        case "uint16":
          itemLengthRead = `this.readUint16("${globalEndianness}")`;
          break;
        case "uint32":
          itemLengthRead = `this.readUint32("${globalEndianness}")`;
          break;
        case "uint64":
          itemLengthRead = `Number(this.readUint64("${globalEndianness}"))`;
          break;
      }
      code += `${indent}  const ${itemLengthVarName} = ${itemLengthRead};\n`;
      // Note: We read the item length but don't use it for validation yet
      // In a real implementation, you might validate that the item size matches expectations
    }
  } else if (field.kind === "fixed") {
    code += `${indent}for (let i = 0; i < ${field.length}; i++) {\n`;
  } else if (field.kind === "field_referenced") {
    // Length comes from a previously-decoded field
    const lengthField = field.length_field;
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";

    // Check for _root reference
    if (lengthField.startsWith('_root.')) {
      // Reference to root object - access via context._root
      const rootPath = lengthField.substring(6); // Remove "_root."
      code += `${indent}const ${lengthVarName} = this.context?._root?.${rootPath};\n`;
      code += `${indent}if (${lengthVarName} === undefined) {\n`;
      code += `${indent}  throw new Error('Field-referenced array length field "${lengthField}" not found in context._root');\n`;
      code += `${indent}}\n`;
    } else {
      // Regular field reference - need to account for inline type decoding and array items
      // If fieldName is "local_file.entries", lengthField should be resolved relative to "local_file"
      // If fieldName is "entries_item.data", use "entries_item" directly (no "value." prefix)
      const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
      const parentPath = fieldName.includes('.') ? fieldName.substring(0, fieldName.lastIndexOf('.')) + '.' : '';
      const fullLengthPath = parentPath + lengthField;

      if (isArrayItem) {
        // For array items, the variable is already scoped (e.g., "entries_item")
        code += `${indent}const ${lengthVarName} = ${fullLengthPath} ?? this.context?.${lengthField};\n`;
      } else {
        // For regular fields, prefix with "value."
        code += `${indent}const ${lengthVarName} = value.${fullLengthPath} ?? this.context?.${lengthField};\n`;
      }
      code += `${indent}if (${lengthVarName} === undefined) {\n`;
      code += `${indent}  throw new Error('Field-referenced array length field "${lengthField}" not found in value or context');\n`;
      code += `${indent}}\n`;
    }
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {\n`;
  } else if (field.kind === "computed_count") {
    // Length is computed from an expression referencing earlier fields
    const countExpr = field.count_expr;
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";

    // Generate code to evaluate the expression using already-decoded fields
    // We need to call the expression evaluator at runtime
    code += `${indent}// Evaluate computed count expression: ${countExpr}\n`;
    code += `${indent}const ${lengthVarName}_context: Record<string, number> = {};\n`;

    // Extract field names from the expression and build the context
    // Field names are identifiers (including dotted notation)
    const fieldRefs = countExpr.match(/[a-zA-Z_][a-zA-Z0-9_.]*(?![a-zA-Z0-9_(])/g) || [];
    const uniqueFieldRefs = [...new Set(fieldRefs)];

    const isArrayItem = fieldName.endsWith(ARRAY_ITER_SUFFIX) || fieldName.includes(ARRAY_ITER_SUFFIX + ".");
    const parentPath = fieldName.includes('.') ? fieldName.substring(0, fieldName.lastIndexOf('.')) + '.' : '';

    for (const fieldRef of uniqueFieldRefs) {
      const fullPath = parentPath + fieldRef;
      if (isArrayItem) {
        code += `${indent}${lengthVarName}_context['${fieldRef}'] = ${fullPath};\n`;
      } else {
        code += `${indent}${lengthVarName}_context['${fieldRef}'] = value.${fullPath};\n`;
      }
    }

    code += `${indent}const ${lengthVarName}_result = evaluateExpression('${countExpr}', ${lengthVarName}_context);\n`;
    code += `${indent}if (!${lengthVarName}_result.success) {\n`;
    code += `${indent}  throw new Error(\`Failed to evaluate count expression '${countExpr}': \${${lengthVarName}_result.error}\${${lengthVarName}_result.details ? ' (' + ${lengthVarName}_result.details + ')' : ''}\`);\n`;
    code += `${indent}}\n`;
    code += `${indent}const ${lengthVarName} = ${lengthVarName}_result.value;\n`;
    code += `${indent}for (let i = 0; i < ${lengthVarName}; i++) {\n`;
  } else if (field.kind === "byte_length_prefixed") {
    // Read byte length prefix, then read items until we've consumed N bytes (ASN.1 SEQUENCE pattern)
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    const lengthType = field.length_type;

    // Read the length prefix
    code += `${indent}// Read byte length prefix\n`;
    if (lengthType === "uint8") {
      code += `${indent}const ${lengthVarName} = this.readUint8();\n`;
    } else if (lengthType === "uint16") {
      code += `${indent}const ${lengthVarName} = this.readUint16("${globalEndianness}");\n`;
    } else if (lengthType === "uint32") {
      code += `${indent}const ${lengthVarName} = this.readUint32("${globalEndianness}");\n`;
    } else if (lengthType === "uint64") {
      code += `${indent}const ${lengthVarName} = Number(this.readUint64("${globalEndianness}"));\n`;
    } else if (lengthType === "varlength") {
      const encoding = field.length_encoding || "der";
      const methodName = getVarlengthReadMethod(encoding);
      code += `${indent}const ${lengthVarName} = this.${methodName}();\n`;
    } else {
      throw new Error(`Unsupported length_type for byte_length_prefixed array: ${lengthType}`);
    }

    const startOffsetVar = fieldName.replace(/\./g, "_") + "_startOffset";
    const endOffsetVar = fieldName.replace(/\./g, "_") + "_endOffset";
    code += `${indent}const ${startOffsetVar} = this.byteOffset;\n`;
    code += `${indent}const ${endOffsetVar} = ${startOffsetVar} + ${lengthVarName};\n`;
    code += `${indent}while (this.byteOffset < ${endOffsetVar}) {\n`;
  } else if (field.kind === "null_terminated") {
    // For null-terminated arrays, we need to peek ahead to check for null terminator
    // If item type is uint8, we can optimize by reading bytes directly
    const itemType = field.items?.type;

    if (itemType === "uint8") {
      // Optimized path for byte arrays
      code += `${indent}while (true) {\n`;
      code += `${indent}  const byte = this.readUint8();\n`;
      code += `${indent}  if (byte === 0) break;\n`;
      code += `${indent}  ${target}.push(byte);\n`;
      code += `${indent}}\n`;
      return code;
    } else {
      // For complex types, peek at the first byte to check for null terminator
      // This assumes the first byte of the item can distinguish null terminator
      code += `${indent}while (true) {\n`;
      code += `${indent}  const firstByte = this.readUint8();\n`;
      code += `${indent}  if (firstByte === 0) break;\n`;
      code += `${indent}  // Rewind one byte since we peeked ahead\n`;
      code += `${indent}  this.byteOffset--;\n`;
      // Fall through to normal item decoding below
    }
  } else if (field.kind === "signature_terminated") {
    // For signature-terminated arrays, peek ahead to check for terminator value
    const terminatorValue = (field as any).terminator_value;
    const terminatorType = (field as any).terminator_type;
    const terminatorEndianness = (field as any).terminator_endianness || globalEndianness;

    if (terminatorValue === undefined || terminatorType === undefined) {
      throw new Error(`signature_terminated array '${field.name}' requires terminator_value and terminator_type`);
    }

    // Generate peek method name based on terminator type
    const peekMethod = `peek${terminatorType.charAt(0).toUpperCase() + terminatorType.slice(1)}`;
    const endiannessArg = terminatorType !== "uint8" ? `"${terminatorEndianness}"` : "";

    code += `${indent}while (true) {\n`;
    code += `${indent}  // Peek ahead to check for terminator signature\n`;
    code += `${indent}  const signature = this.${peekMethod}(${endiannessArg});\n`;
    code += `${indent}  if (signature === ${terminatorValue}) break;\n`;
    // Fall through to normal item decoding below (inside the loop)
  } else if (field.kind === "eof_terminated") {
    // For EOF-terminated arrays, read items until end of stream
    code += `${indent}while (this.byteOffset < this.bytes.length) {\n`;
    code += `${indent}  try {\n`;
    // Fall through to normal item decoding below (inside try block)
  } else if (field.kind === "variant_terminated") {
    // For variant-terminated arrays, read items until a terminal variant is encountered
    code += `${indent}while (true) {\n`;
    // Fall through to normal item decoding below (inside the loop)
    // Terminal variant check happens after the item is decoded
  }

  // Safety check for items field
  if (!field.items || typeof field.items !== 'object' || !('type' in field.items)) {
    code += `${indent}  // ERROR: Array items undefined\n`;
    if (field.kind === "null_terminated" || field.kind === "signature_terminated" || field.kind === "eof_terminated" || field.kind === "variant_terminated") {
      code += `${indent}}\n`;
    } else {
      code += `${indent}}\n`;
    }
    return code;
  }

  // Read array item
  // Use unique variable name to avoid shadowing in nested arrays
  const itemVar = fieldName.replace(/[.\[\]]/g, "_") + ARRAY_ITER_SUFFIX;
  const itemDecodeCode = generateDecodeFieldCore(
    field.items as Field,
    schema,
    globalEndianness,
    itemVar,
    indent + "  ",
    addTraceLogs
  );

  // For primitive types, directly push
  if (itemDecodeCode.includes(`${itemVar} =`)) {
    code += `${indent}  let ${itemVar}: any;\n`;
    code += itemDecodeCode;
    code += `${indent}  ${target}.push(${itemVar});\n`;

    // Check if this is a terminal variant (for null_terminated or variant_terminated arrays with discriminated unions)
    if ((field.kind === "null_terminated" || field.kind === "variant_terminated") && field.terminal_variants && Array.isArray(field.terminal_variants)) {
      code += `${indent}  // Check if item is a terminal variant\n`;
      const conditions = field.terminal_variants.map((v: string) => `${itemVar}.type === '${v}'`).join(' || ');
      code += `${indent}  if (${conditions}) {\n`;
      code += `${indent}    break;\n`;
      code += `${indent}  }\n`;
    }
  }

  // Close eof_terminated try-catch block
  if (field.kind === "eof_terminated") {
    code += `${indent}  } catch (error) {\n`;
    code += `${indent}    // EOF reached - stop reading items\n`;
    code += `${indent}    if (error instanceof Error && error.message.includes('Unexpected end of stream')) {\n`;
    code += `${indent}      break;\n`;
    code += `${indent}    }\n`;
    code += `${indent}    throw error; // Re-throw other errors\n`;
    code += `${indent}  }\n`;
  }

  code += `${indent}}\n`;

  return code;
}

