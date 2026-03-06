// ABOUTME: Generates Python encoder/decoder code from BinSchema definitions
// ABOUTME: Produces byte-for-byte compatible code with TypeScript runtime
// ABOUTME: Reference: src/generators/typescript.ts is the canonical implementation

import { type BinarySchema, type Field, type Endianness, isEnumType } from "../schema/binary-schema.js";

export interface GeneratedPythonCode {
  code: string;
  typeName: string;
}

export interface PythonGeneratorOptions {
  /** Module name for the runtime import (default: "binschema_runtime") */
  runtimeModule?: string;
}

/**
 * Convert a camelCase or PascalCase name to snake_case
 */
function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Convert to PascalCase for class names
 */
function toPascalCase(name: string): string {
  // Already PascalCase? Return as-is
  if (/^[A-Z]/.test(name) && !name.includes('_')) return name;
  return name
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Map endianness string to Python string literal
 */
function pyEndianness(endianness: string): string {
  return `"${endianness}"`;
}

/**
 * Map field type to Python type hint
 */
function mapFieldToPythonType(field: any, schema: BinarySchema): string {
  if (!field || typeof field !== 'object') return "Any";

  switch (field.type) {
    case "bit":
    case "uint8":
    case "uint16":
    case "uint32":
    case "uint64":
    case "int8":
    case "int16":
    case "int32":
    case "int64":
    case "varlength":
      return "int";
    case "float32":
    case "float64":
      return "float";
    case "bool":
      return "bool";
    case "string":
      return "str";
    case "bytes":
      return "list[int]";
    case "array": {
      const itemType = mapFieldToPythonType(field.items, schema);
      return `list[${itemType}]`;
    }
    case "bitfield":
      return "dict[str, int]";
    case "discriminated_union":
      return "dict[str, Any]";
    case "choice":
      return "dict[str, Any]";
    case "optional": {
      const vt = field.value_type;
      const valueType = typeof vt === "object"
        ? mapFieldToPythonType(vt, schema)
        : mapFieldToPythonType({ type: vt }, schema);
      return `${valueType} | None`;
    }
    case "back_reference":
      return "Any";
    case "padding":
      return "None";
    default:
      // Type reference - check if it's a known type in the schema
      if (field.type && schema.types[field.type]) {
        return toPascalCase(field.type);
      }
      return "Any";
  }
}

/**
 * Get the fields from a type definition
 */
function getTypeFields(typeDef: any): any[] {
  if ('sequence' in typeDef) {
    return typeDef.sequence;
  }
  return [];
}

/**
 * Check if a field is conditional
 */
function isFieldConditional(field: any): boolean {
  return field.conditional !== undefined;
}

/**
 * Convert conditional expression to Python
 */
function convertConditionalToPython(condition: string, basePath: string = "value"): string {
  // Replace logical operators
  let expr = condition
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/!/g, 'not ')
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False')
    .replace(/!=/g, ' != ')
    .replace(/==/g, ' == ');

  // Add basePath prefix to field references
  const identifierRegex = /\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\b/g;
  const reserved = new Set(['True', 'False', 'None', 'and', 'or', 'not', 'in', 'is']);
  expr = expr.replace(identifierRegex, (match) => {
    if (reserved.has(match)) return match;
    if (/^\d/.test(match)) return match;
    if (match === basePath || match.startsWith(`${basePath}.`)) return match;
    return `${basePath}.get("${match}", 0) if isinstance(${basePath}, dict) else getattr(${basePath}, "${match}", 0)`;
  });

  return expr;
}

/**
 * Generate Python encode expression for a single field
 */
function generateFieldEncode(field: any, valuePath: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';

  // Handle conditional fields
  if (field.conditional) {
    const condition = convertConditionalToPython(field.conditional, valuePath.split('.')[0]);
    // For conditional fields, we need to check if the field exists
    code += `${indent}if ${condition}:\n`;
    indent += '    ';
  }

  // Use .get() for conditional/optional fields to avoid KeyError when field is absent
  const useGet = isFieldConditional(field) || field.type === 'optional';
  const fieldAccess = field.name
    ? (useGet ? `${valuePath}.get("${field.name}")` : `${valuePath}["${field.name}"]`)
    : valuePath;
  if (field.const !== undefined) {
    code += generateConstEncode(field, indent, endianness);
    return code;
  }

  // Handle computed fields
  if (field.computed) {
    code += generateComputedFieldEncode(field, valuePath, indent, endianness, schema);
    return code;
  }

  switch (field.type) {
    case "padding":
      code += generatePaddingEncode(field, indent);
      break;
    case "bit":
      code += `${indent}encoder.write_bits(${fieldAccess}, ${field.size || 1})\n`;
      break;
    case "bool":
      code += `${indent}encoder.write_uint8(1 if ${fieldAccess} else 0)\n`;
      break;
    case "uint8":
      code += `${indent}encoder.write_uint8(${fieldAccess})\n`;
      break;
    case "uint16": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_uint16(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "uint32": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_uint32(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "uint64": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_uint64(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "int8":
      code += `${indent}encoder.write_int8(${fieldAccess})\n`;
      break;
    case "int16": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_int16(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "int32": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_int32(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "int64": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_int64(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "float32": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_float32(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "float64": {
      const e = field.endianness || endianness;
      code += `${indent}encoder.write_float64(${fieldAccess}, ${pyEndianness(e)})\n`;
      break;
    }
    case "varlength":
      code += generateVarlengthEncode(field, fieldAccess, indent);
      break;
    case "string":
      code += generateStringEncode(field, fieldAccess, indent, endianness);
      break;
    case "bytes":
      code += generateBytesEncode(field, fieldAccess, indent, endianness);
      break;
    case "array":
      code += generateArrayEncode(field, fieldAccess, indent, endianness, schema, bitOrder);
      break;
    case "bitfield":
      code += generateBitfieldEncode(field, fieldAccess, indent, bitOrder);
      break;
    case "discriminated_union":
      code += generateDiscriminatedUnionEncode(field, fieldAccess, indent, endianness, schema, bitOrder);
      break;
    case "choice":
      code += generateChoiceEncode(field, fieldAccess, indent, endianness, schema, bitOrder);
      break;
    case "optional":
      code += generateOptionalEncode(field, fieldAccess, indent, endianness, schema, bitOrder);
      break;
    default:
      // Type reference - delegate to that type's encoder
      if (field.type && schema.types[field.type]) {
        code += generateTypeRefEncode(field, fieldAccess, indent, endianness, schema, bitOrder);
      } else {
        code += `${indent}# TODO: unsupported type ${field.type}\n`;
      }
  }

  return code;
}

function generateConstEncode(field: any, indent: string, endianness: string): string {
  let code = '';
  const value = field.const;

  if (field.type === "string") {
    // String const - encode as fixed-length ASCII
    const encoding = field.encoding || "utf8";
    const length = field.length;
    if (length !== undefined) {
      code += `${indent}const_str = "${value}"\n`;
      code += `${indent}encoded = const_str.encode("${encoding === 'utf8' ? 'utf-8' : encoding}")\n`;
      code += `${indent}if len(encoded) > ${length}:\n`;
      code += `${indent}    raise ValueError(f"String const '{const_str}' is {len(encoded)} bytes, max is ${length}")\n`;
      code += `${indent}encoder.write_bytes(encoded)\n`;
      // Pad with zeros if needed
      code += `${indent}for _ in range(${length} - len(encoded)):\n`;
      code += `${indent}    encoder.write_uint8(0)\n`;
    } else {
      code += `${indent}encoder.write_bytes("${value}".encode("${encoding === 'utf8' ? 'utf-8' : encoding}"))\n`;
    }
    return code;
  }

  switch (field.type) {
    case "uint8":
      code += `${indent}encoder.write_uint8(${value})\n`;
      break;
    case "uint16":
      code += `${indent}encoder.write_uint16(${value}, ${pyEndianness(field.endianness || endianness)})\n`;
      break;
    case "uint32":
      code += `${indent}encoder.write_uint32(${value}, ${pyEndianness(field.endianness || endianness)})\n`;
      break;
    case "uint64":
      code += `${indent}encoder.write_uint64(${value}, ${pyEndianness(field.endianness || endianness)})\n`;
      break;
    case "bit":
      code += `${indent}encoder.write_bits(${value}, ${field.size || 1})\n`;
      break;
    default:
      code += `${indent}# const encode for ${field.type}: ${value}\n`;
  }
  return code;
}

function generatePaddingEncode(field: any, indent: string): string {
  const size = field.size || 1;
  let code = '';
  if (field.pad_to) {
    code += `${indent}padding_needed = (${field.pad_to} - (encoder.byte_offset % ${field.pad_to})) % ${field.pad_to}\n`;
    code += `${indent}for _ in range(padding_needed):\n`;
    code += `${indent}    encoder.write_uint8(0)\n`;
  } else {
    code += `${indent}for _ in range(${size}):\n`;
    code += `${indent}    encoder.write_uint8(0)\n`;
  }
  return code;
}

function generateBytesEncode(field: any, fieldAccess: string, indent: string, endianness: string): string {
  let code = '';
  const kind = field.kind;

  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixEncode(lengthType, `len(${fieldAccess})`, indent, endianness);
  } else if (kind === "fixed" && field.length !== undefined) {
    // Fixed length - pad or truncate
    code += `${indent}encoder.write_bytes(${fieldAccess}[:${field.length}])\n`;
    code += `${indent}for _ in range(${field.length} - len(${fieldAccess})):\n`;
    code += `${indent}    encoder.write_uint8(0)\n`;
    return code;
  }
  code += `${indent}encoder.write_bytes(${fieldAccess})\n`;
  return code;
}

function generateVarlengthEncode(field: any, fieldAccess: string, indent: string): string {
  const encoding = field.encoding || "der";
  switch (encoding) {
    case "der":
      return `${indent}encoder.write_varlength_der(${fieldAccess})\n`;
    case "leb128":
      return `${indent}encoder.write_varlength_leb128(${fieldAccess})\n`;
    case "ebml":
      return `${indent}encoder.write_varlength_ebml(${fieldAccess})\n`;
    case "vlq":
      return `${indent}encoder.write_varlength_vlq(${fieldAccess})\n`;
    default:
      return `${indent}encoder.write_varlength_der(${fieldAccess})\n`;
  }
}

function generateStringEncode(field: any, fieldAccess: string, indent: string, endianness: string): string {
  let code = '';
  const encoding = field.encoding || "utf8";
  const pyEncoding = encoding === "utf8" ? "utf-8" : encoding === "ascii" ? "ascii" : "utf-8";
  const kind = field.kind;

  if (kind === "fixed" && field.length !== undefined) {
    code += `${indent}_str_bytes = ${fieldAccess}.encode("${pyEncoding}")\n`;
    code += `${indent}encoder.write_bytes(_str_bytes[:${field.length}])\n`;
    code += `${indent}for _ in range(${field.length} - len(_str_bytes)):\n`;
    code += `${indent}    encoder.write_uint8(0)\n`;
  } else if (kind === "null_terminated" || field.terminator !== undefined) {
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    code += `${indent}encoder.write_bytes(${fieldAccess}.encode("${pyEncoding}"))\n`;
    code += `${indent}encoder.write_uint8(${terminator})\n`;
  } else if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += `${indent}_str_bytes = ${fieldAccess}.encode("${pyEncoding}")\n`;
    code += generateLengthPrefixEncode(lengthType, 'len(_str_bytes)', indent, endianness);
    code += `${indent}encoder.write_bytes(_str_bytes)\n`;
  } else if (kind === "field_referenced") {
    // Length from another field - just write the raw bytes
    code += `${indent}encoder.write_bytes(${fieldAccess}.encode("${pyEncoding}"))\n`;
  } else if (field.length !== undefined) {
    // Fixed-length (without explicit kind)
    code += `${indent}_str_bytes = ${fieldAccess}.encode("${pyEncoding}")\n`;
    code += `${indent}encoder.write_bytes(_str_bytes[:${field.length}])\n`;
    code += `${indent}for _ in range(${field.length} - len(_str_bytes)):\n`;
    code += `${indent}    encoder.write_uint8(0)\n`;
  } else if (field.terminator !== undefined) {
    code += `${indent}encoder.write_bytes(${fieldAccess}.encode("${pyEncoding}"))\n`;
    code += `${indent}encoder.write_uint8(${field.terminator})\n`;
  } else {
    // Raw string
    code += `${indent}encoder.write_bytes(${fieldAccess}.encode("${pyEncoding}"))\n`;
  }
  return code;
}

function generateLengthPrefixEncode(prefixType: string, lengthExpr: string, indent: string, endianness: string): string {
  switch (prefixType) {
    case "uint8":
      return `${indent}encoder.write_uint8(${lengthExpr})\n`;
    case "uint16":
      return `${indent}encoder.write_uint16(${lengthExpr}, ${pyEndianness(endianness)})\n`;
    case "uint32":
      return `${indent}encoder.write_uint32(${lengthExpr}, ${pyEndianness(endianness)})\n`;
    case "uint64":
      return `${indent}encoder.write_uint64(${lengthExpr}, ${pyEndianness(endianness)})\n`;
    case "varlength":
    case "varlength_der":
      return `${indent}encoder.write_varlength_der(${lengthExpr})\n`;
    case "varlength_leb128":
      return `${indent}encoder.write_varlength_leb128(${lengthExpr})\n`;
    default:
      return `${indent}encoder.write_uint8(${lengthExpr})\n`;
  }
}

function generateArrayEncode(field: any, fieldAccess: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const items = field.items;
  const kind = field.kind;

  // Length prefix based on kind
  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixEncode(lengthType, `len(${fieldAccess})`, indent, endianness);
  } else if (kind === "byte_length_prefixed") {
    const lengthType = field.length_type || "uint8";
    // Need to encode items first to measure byte length
    code += `${indent}_temp_encoder = BitStreamEncoder("${bitOrder}")\n`;
    code += `${indent}for _temp_item in ${fieldAccess}:\n`;
    if (items && typeof items === 'object' && items.type) {
      code += generateFieldEncode({ ...items, name: undefined }, '_temp_item', indent + '    ', endianness, schema, bitOrder);
    }
    // Replace encoder reference in temp section
    const tempCode = code.split(`_temp_encoder = BitStreamEncoder`);
    if (tempCode.length > 1) {
      // Actually, simpler approach: encode to temp, measure, write length, write bytes
      code = code.substring(0, code.lastIndexOf(`${indent}_temp_encoder`));
      code += `${indent}_temp_encoder_arr = BitStreamEncoder("${bitOrder}")\n`;
      code += `${indent}for _temp_item in ${fieldAccess}:\n`;
      if (items && typeof items === 'object' && items.type) {
        const itemEncCode = generateFieldEncode({ ...items, name: undefined }, '_temp_item', indent + '    ', endianness, schema, bitOrder);
        code += itemEncCode.replace(/\bencoder\b/g, '_temp_encoder_arr');
      }
      code += `${indent}_arr_bytes = _temp_encoder_arr.finish()\n`;
      code += generateLengthPrefixEncode(lengthType, 'len(_arr_bytes)', indent, endianness);
      code += `${indent}encoder.write_bytes(_arr_bytes)\n`;
      return code;
    }
  } else if (kind === "length_prefixed_items") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixEncode(lengthType, `len(${fieldAccess})`, indent, endianness);
  }

  // Null-terminated arrays write a terminator after all items
  if (kind === "null_terminated") {
    code += `${indent}for _item in ${fieldAccess}:\n`;
    code += generateArrayItemEncode(items, indent + '    ', endianness, schema, bitOrder);
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    code += `${indent}encoder.write_uint8(${terminator})\n`;
    return code;
  }

  // Iterate over elements
  code += `${indent}for _item in ${fieldAccess}:\n`;
  code += generateArrayItemEncode(items, indent + '    ', endianness, schema, bitOrder);

  return code;
}

function generateArrayItemEncode(items: any, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  if (items && typeof items === 'object' && items.type) {
    return generateFieldEncode({ ...items, name: undefined }, '_item', indent, endianness, schema, bitOrder);
  } else if (typeof items === 'string') {
    return generateFieldEncode({ type: items }, '_item', indent, endianness, schema, bitOrder);
  }
  return `${indent}pass  # unknown item type\n`;
}

function generateBitfieldEncode(field: any, fieldAccess: string, indent: string, bitOrder: string): string {
  let code = '';
  for (const subfield of (field.fields || [])) {
    code += `${indent}encoder.write_bits(${fieldAccess}["${subfield.name}"], ${subfield.size || 1})\n`;
  }
  return code;
}

function generateDiscriminatedUnionEncode(field: any, fieldAccess: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const variants = field.variants || [];
  const discriminatorField = field.discriminator?.field || "type";

  code += `${indent}_disc_type = ${fieldAccess}["type"]\n`;

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const cond = i === 0 ? 'if' : 'elif';
    code += `${indent}${cond} _disc_type == "${variant.type}":\n`;

    // Encode discriminator
    if (field.discriminator?.type) {
      const discType = field.discriminator.type;
      const discValue = variant.value !== undefined ? variant.value : i;
      switch (discType) {
        case "uint8":
          code += `${indent}    encoder.write_uint8(${discValue})\n`;
          break;
        case "uint16":
          code += `${indent}    encoder.write_uint16(${discValue}, ${pyEndianness(field.discriminator.endianness || endianness)})\n`;
          break;
        case "uint32":
          code += `${indent}    encoder.write_uint32(${discValue}, ${pyEndianness(field.discriminator.endianness || endianness)})\n`;
          break;
      }
    }

    // Encode the variant value
    if (schema.types[variant.type]) {
      code += `${indent}    _variant_data = ${fieldAccess}["value"]\n`;
      code += `${indent}    _sub_encoder = ${toPascalCase(variant.type)}Encoder()\n`;
      code += `${indent}    _sub_bytes = _sub_encoder.encode(_variant_data)\n`;
      code += `${indent}    encoder.write_bytes(_sub_bytes)\n`;
    }
  }

  code += `${indent}else:\n`;
  code += `${indent}    raise ValueError(f"Unknown variant type: {_disc_type}")\n`;

  return code;
}

function generateChoiceEncode(field: any, fieldAccess: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const choices = field.choices || [];

  code += `${indent}_choice_type = ${fieldAccess}["type"]\n`;

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    const cond = i === 0 ? 'if' : 'elif';
    code += `${indent}${cond} _choice_type == "${choice.type}":\n`;

    if (schema.types[choice.type]) {
      const typeDef = schema.types[choice.type];
      if ('sequence' in typeDef) {
        for (const subfield of typeDef.sequence) {
          code += generateFieldEncode(subfield, fieldAccess, indent + '    ', endianness, schema, bitOrder);
        }
      }
    }
  }

  code += `${indent}else:\n`;
  code += `${indent}    raise ValueError(f"Unknown choice type: {_choice_type}")\n`;

  return code;
}

function generateOptionalEncode(field: any, fieldAccess: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const presenceType = field.presence_type || "uint8";
  const valueType = field.value_type;

  code += `${indent}if ${fieldAccess} is not None:\n`;
  // Write presence marker (1)
  switch (presenceType) {
    case "bit":
      code += `${indent}    encoder.write_bits(1, 1)\n`;
      break;
    default:
      code += `${indent}    encoder.write_uint8(1)\n`;
  }
  // Write value
  if (typeof valueType === 'string') {
    code += generateFieldEncode({ type: valueType, name: undefined }, fieldAccess, indent + '    ', endianness, schema, bitOrder);
  } else {
    code += generateFieldEncode({ ...valueType, name: undefined }, fieldAccess, indent + '    ', endianness, schema, bitOrder);
  }
  code += `${indent}else:\n`;
  // Write absence marker (0)
  switch (presenceType) {
    case "bit":
      code += `${indent}    encoder.write_bits(0, 1)\n`;
      break;
    default:
      code += `${indent}    encoder.write_uint8(0)\n`;
  }

  return code;
}

function generateTypeRefEncode(field: any, fieldAccess: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const typeName = toPascalCase(field.type);
  const typeDef = schema.types[field.type];

  if (isEnumType(typeDef)) {
    // Enum type - encode directly
    const repr = (typeDef as any).repr;
    switch (repr) {
      case "uint8":
        code += `${indent}encoder.write_uint8(${fieldAccess})\n`;
        break;
      case "uint16":
        code += `${indent}encoder.write_uint16(${fieldAccess}, ${pyEndianness(endianness)})\n`;
        break;
      case "uint32":
        code += `${indent}encoder.write_uint32(${fieldAccess}, ${pyEndianness(endianness)})\n`;
        break;
    }
  } else if ('sequence' in typeDef) {
    // Struct type - use sub-encoder
    code += `${indent}_sub_encoder = ${typeName}Encoder()\n`;
    code += `${indent}_sub_bytes = _sub_encoder.encode(${fieldAccess})\n`;
    code += `${indent}encoder.write_bytes(_sub_bytes)\n`;
  } else if ((typeDef as any).type === 'string') {
    // String type alias
    code += generateStringEncode(typeDef as any, fieldAccess, indent, endianness);
  } else if ((typeDef as any).type === 'array') {
    // Array type alias
    code += generateArrayEncode(typeDef as any, fieldAccess, indent, endianness, schema, bitOrder);
  } else {
    code += `${indent}# TODO: type ref encode for ${field.type}\n`;
  }

  return code;
}

function generateComputedFieldEncode(field: any, valuePath: string, indent: string, endianness: string, schema: BinarySchema): string {
  let code = '';
  const computed = field.computed;
  const e = field.endianness || endianness;

  // Computed fields are calculated during encoding
  if (computed.type === "length_of" || computed.type === "count_of") {
    const target = computed.target;
    const targetAccess = `${valuePath}["${target}"]`;

    let lengthExpr: string;
    if (computed.type === "count_of") {
      lengthExpr = `len(${targetAccess})`;
    } else {
      // length_of - need to calculate byte length
      // Use a temporary encoder to measure the size
      if (computed.from_after_field) {
        // Length starts counting from after a specific field
        // This is handled by encoding into a temp encoder and measuring
        code += `${indent}# Computed: ${computed.type} ${target} (from_after_field: ${computed.from_after_field})\n`;
        code += `${indent}# Placeholder - will be back-patched\n`;
        code += `${indent}_length_pos_${field.name} = encoder.byte_offset\n`;
        code += generatePlaceholderWrite(field.type, indent, e);
        return code;
      }
      lengthExpr = `_computed_length_${field.name}`;
      code += `${indent}# Computed: length_of ${target}\n`;
      code += `${indent}# Calculate length by trial encoding\n`;
      code += `${indent}_temp_encoder = BitStreamEncoder("${schema.config?.bit_order || 'msb_first'}")\n`;
      // This is a simplification - full implementation would need to encode the target
      code += `${indent}${lengthExpr} = len(${targetAccess}) if isinstance(${targetAccess}, (list, bytes)) else 0\n`;
    }

    switch (field.type) {
      case "uint8":
        code += `${indent}encoder.write_uint8(${lengthExpr})\n`;
        break;
      case "uint16":
        code += `${indent}encoder.write_uint16(${lengthExpr}, ${pyEndianness(e)})\n`;
        break;
      case "uint32":
        code += `${indent}encoder.write_uint32(${lengthExpr}, ${pyEndianness(e)})\n`;
        break;
      case "uint64":
        code += `${indent}encoder.write_uint64(${lengthExpr}, ${pyEndianness(e)})\n`;
        break;
      case "varlength":
        code += `${indent}encoder.write_varlength_der(${lengthExpr})\n`;
        break;
      default:
        code += `${indent}encoder.write_uint8(${lengthExpr})\n`;
    }
  } else if (computed.type === "crc32_of") {
    code += `${indent}# CRC32 computed field - placeholder\n`;
    code += `${indent}_crc_pos_${field.name} = encoder.byte_offset\n`;
    code += generatePlaceholderWrite(field.type, indent, e);
  } else if (computed.type === "position_of") {
    code += `${indent}# Position computed field - placeholder\n`;
    code += `${indent}_pos_${field.name} = encoder.byte_offset\n`;
    code += generatePlaceholderWrite(field.type, indent, e);
  }

  return code;
}

function generatePlaceholderWrite(fieldType: string, indent: string, endianness: string): string {
  switch (fieldType) {
    case "uint8":
      return `${indent}encoder.write_uint8(0)  # placeholder\n`;
    case "uint16":
      return `${indent}encoder.write_uint16(0, ${pyEndianness(endianness)})  # placeholder\n`;
    case "uint32":
      return `${indent}encoder.write_uint32(0, ${pyEndianness(endianness)})  # placeholder\n`;
    case "uint64":
      return `${indent}encoder.write_uint64(0, ${pyEndianness(endianness)})  # placeholder\n`;
    case "varlength":
      return `${indent}encoder.write_varlength_der(0)  # placeholder\n`;
    default:
      return `${indent}encoder.write_uint8(0)  # placeholder\n`;
  }
}

/**
 * Generate Python decode expression for a single field
 */
function generateFieldDecode(field: any, resultPath: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';

  // Handle conditional fields
  if (field.conditional) {
    const condition = convertConditionalToPython(field.conditional, resultPath);
    code += `${indent}if ${condition}:\n`;
    indent += '    ';
  }

  const fieldAssign = field.name ? `${resultPath}["${field.name}"]` : resultPath;

  // Handle const fields - read and validate
  if (field.const !== undefined) {
    code += generateConstDecode(field, fieldAssign, indent, endianness);
    return code;
  }

  // Handle computed fields - read normally (the value is in the byte stream)
  // No special handling needed for decode

  switch (field.type) {
    case "padding":
      code += generatePaddingDecode(field, indent);
      break;
    case "bit":
      code += `${indent}${fieldAssign} = decoder.read_bits(${field.size || 1})\n`;
      break;
    case "bool":
      code += `${indent}${fieldAssign} = decoder.read_uint8() != 0\n`;
      break;
    case "uint8":
      code += `${indent}${fieldAssign} = decoder.read_uint8()\n`;
      break;
    case "uint16": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_uint16(${pyEndianness(e)})\n`;
      break;
    }
    case "uint32": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_uint32(${pyEndianness(e)})\n`;
      break;
    }
    case "uint64": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_uint64(${pyEndianness(e)})\n`;
      break;
    }
    case "int8":
      code += `${indent}${fieldAssign} = decoder.read_int8()\n`;
      break;
    case "int16": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_int16(${pyEndianness(e)})\n`;
      break;
    }
    case "int32": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_int32(${pyEndianness(e)})\n`;
      break;
    }
    case "int64": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_int64(${pyEndianness(e)})\n`;
      break;
    }
    case "float32": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_float32(${pyEndianness(e)})\n`;
      break;
    }
    case "float64": {
      const e = field.endianness || endianness;
      code += `${indent}${fieldAssign} = decoder.read_float64(${pyEndianness(e)})\n`;
      break;
    }
    case "varlength":
      code += generateVarlengthDecode(field, fieldAssign, indent);
      break;
    case "string":
      code += generateStringDecode(field, fieldAssign, resultPath, indent, endianness);
      break;
    case "bytes":
      code += generateBytesDecode(field, fieldAssign, resultPath, indent, endianness);
      break;
    case "array":
      code += generateArrayDecode(field, fieldAssign, resultPath, indent, endianness, schema, bitOrder);
      break;
    case "bitfield":
      code += generateBitfieldDecode(field, fieldAssign, indent, bitOrder);
      break;
    case "discriminated_union":
      code += generateDiscriminatedUnionDecode(field, fieldAssign, indent, endianness, schema, bitOrder);
      break;
    case "choice":
      code += generateChoiceDecode(field, fieldAssign, indent, endianness, schema, bitOrder);
      break;
    case "optional":
      code += generateOptionalDecode(field, fieldAssign, indent, endianness, schema, bitOrder);
      break;
    default:
      // Type reference
      if (field.type && schema.types[field.type]) {
        code += generateTypeRefDecode(field, fieldAssign, indent, endianness, schema, bitOrder);
      } else {
        code += `${indent}# TODO: unsupported decode type ${field.type}\n`;
      }
  }

  return code;
}

function generateConstDecode(field: any, fieldAssign: string, indent: string, endianness: string): string {
  let code = '';

  if (field.type === "string") {
    const encoding = field.encoding || "utf8";
    const pyEncoding = encoding === "utf8" ? "utf-8" : encoding === "ascii" ? "ascii" : "utf-8";
    if (field.length !== undefined) {
      code += `${indent}_const_bytes = decoder.read_bytes_slice(${field.length})\n`;
      code += `${indent}${fieldAssign} = _const_bytes.rstrip(b'\\x00').decode("${pyEncoding}")\n`;
    } else {
      const constLen = Buffer.byteLength(field.const, 'utf8');
      code += `${indent}_const_bytes = decoder.read_bytes_slice(${constLen})\n`;
      code += `${indent}${fieldAssign} = _const_bytes.decode("${pyEncoding}")\n`;
    }
    return code;
  }

  switch (field.type) {
    case "uint8":
      code += `${indent}${fieldAssign} = decoder.read_uint8()\n`;
      break;
    case "uint16":
      code += `${indent}${fieldAssign} = decoder.read_uint16(${pyEndianness(field.endianness || endianness)})\n`;
      break;
    case "uint32":
      code += `${indent}${fieldAssign} = decoder.read_uint32(${pyEndianness(field.endianness || endianness)})\n`;
      break;
    case "uint64":
      code += `${indent}${fieldAssign} = decoder.read_uint64(${pyEndianness(field.endianness || endianness)})\n`;
      break;
    case "bit":
      code += `${indent}${fieldAssign} = decoder.read_bits(${field.size || 1})\n`;
      break;
    default:
      code += `${indent}# const decode for ${field.type}\n`;
  }

  return code;
}

function generatePaddingDecode(field: any, indent: string): string {
  const size = field.size || 1;
  if (field.pad_to) {
    let code = '';
    code += `${indent}_padding_needed = (${field.pad_to} - (decoder.position % ${field.pad_to})) % ${field.pad_to}\n`;
    code += `${indent}for _ in range(_padding_needed):\n`;
    code += `${indent}    decoder.read_uint8()\n`;
    return code;
  }
  return `${indent}for _ in range(${size}):\n${indent}    decoder.read_uint8()\n`;
}

function generateVarlengthDecode(field: any, fieldAssign: string, indent: string): string {
  const encoding = field.encoding || "der";
  switch (encoding) {
    case "der":
      return `${indent}${fieldAssign} = decoder.read_varlength_der()\n`;
    case "leb128":
      return `${indent}${fieldAssign} = decoder.read_varlength_leb128()\n`;
    case "ebml":
      return `${indent}${fieldAssign} = decoder.read_varlength_ebml()\n`;
    case "vlq":
      return `${indent}${fieldAssign} = decoder.read_varlength_vlq()\n`;
    default:
      return `${indent}${fieldAssign} = decoder.read_varlength_der()\n`;
  }
}

function generateStringDecode(field: any, fieldAssign: string, resultPath: string, indent: string, endianness: string): string {
  let code = '';
  const encoding = field.encoding || "utf8";
  const pyEncoding = encoding === "utf8" ? "utf-8" : encoding === "ascii" ? "ascii" : "utf-8";
  const kind = field.kind;

  if (kind === "fixed" && field.length !== undefined) {
    code += `${indent}_str_bytes = decoder.read_bytes_slice(${field.length})\n`;
    code += `${indent}${fieldAssign} = _str_bytes.rstrip(b'\\x00').decode("${pyEncoding}")\n`;
  } else if (kind === "null_terminated" || field.terminator !== undefined) {
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    code += `${indent}_str_buf = bytearray()\n`;
    code += `${indent}while True:\n`;
    code += `${indent}    _ch = decoder.read_uint8()\n`;
    code += `${indent}    if _ch == ${terminator}:\n`;
    code += `${indent}        break\n`;
    code += `${indent}    _str_buf.append(_ch)\n`;
    code += `${indent}${fieldAssign} = _str_buf.decode("${pyEncoding}")\n`;
  } else if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixDecode(lengthType, '_str_len', indent, endianness);
    code += `${indent}_str_bytes = decoder.read_bytes_slice(_str_len)\n`;
    code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}")\n`;
  } else if (kind === "field_referenced" && field.length_field) {
    code += `${indent}_str_len = ${resultPath}["${field.length_field}"]\n`;
    code += `${indent}_str_bytes = decoder.read_bytes_slice(_str_len)\n`;
    code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}")\n`;
  } else if (field.length !== undefined) {
    // Fallback fixed-length
    code += `${indent}_str_bytes = decoder.read_bytes_slice(${field.length})\n`;
    code += `${indent}${fieldAssign} = _str_bytes.rstrip(b'\\x00').decode("${pyEncoding}")\n`;
  } else if (field.length_field) {
    code += `${indent}_str_len = ${resultPath}["${field.length_field}"]\n`;
    code += `${indent}_str_bytes = decoder.read_bytes_slice(_str_len)\n`;
    code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}")\n`;
  } else {
    code += `${indent}_remaining = len(decoder._bytes) - decoder.position\n`;
    code += `${indent}_str_bytes = decoder.read_bytes_slice(_remaining)\n`;
    code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}")\n`;
  }
  return code;
}

function generateBytesDecode(field: any, fieldAssign: string, resultPath: string, indent: string, endianness: string): string {
  let code = '';
  const kind = field.kind;

  if (kind === "fixed" && field.length !== undefined) {
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(${field.length}))\n`;
  } else if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixDecode(lengthType, '_bytes_len', indent, endianness);
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(_bytes_len))\n`;
  } else if (kind === "field_referenced" && field.length_field) {
    code += `${indent}_bytes_len = ${resultPath}["${field.length_field}"]\n`;
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(_bytes_len))\n`;
  } else if (field.length !== undefined) {
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(${field.length}))\n`;
  } else if (field.length_field) {
    code += `${indent}_bytes_len = ${resultPath}["${field.length_field}"]\n`;
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(_bytes_len))\n`;
  } else {
    code += `${indent}_remaining = len(decoder._bytes) - decoder.position\n`;
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(_remaining))\n`;
  }
  return code;
}

function generateLengthPrefixDecode(prefixType: string, varName: string, indent: string, endianness: string): string {
  switch (prefixType) {
    case "uint8":
      return `${indent}${varName} = decoder.read_uint8()\n`;
    case "uint16":
      return `${indent}${varName} = decoder.read_uint16(${pyEndianness(endianness)})\n`;
    case "uint32":
      return `${indent}${varName} = decoder.read_uint32(${pyEndianness(endianness)})\n`;
    case "uint64":
      return `${indent}${varName} = decoder.read_uint64(${pyEndianness(endianness)})\n`;
    case "varlength":
    case "varlength_der":
      return `${indent}${varName} = decoder.read_varlength_der()\n`;
    case "varlength_leb128":
      return `${indent}${varName} = decoder.read_varlength_leb128()\n`;
    default:
      return `${indent}${varName} = decoder.read_uint8()\n`;
  }
}

function generateArrayDecode(field: any, fieldAssign: string, resultPath: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const items = field.items;
  const kind = field.kind;

  if (kind === "fixed" && field.length !== undefined) {
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for _i in range(${field.length}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixDecode(lengthType, '_arr_len', indent, endianness);
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for _i in range(_arr_len):\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "field_referenced" && field.length_field) {
    code += `${indent}_arr_count = ${resultPath}["${field.length_field}"]\n`;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for _i in range(_arr_count):\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "computed_count") {
    // Count from a computed count_of field
    const countField = field.count_field || field.length_field;
    if (countField) {
      code += `${indent}_arr_count = ${resultPath}["${countField}"]\n`;
    } else {
      code += `${indent}_arr_count = 0  # computed_count without field reference\n`;
    }
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for _i in range(_arr_count):\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "byte_length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixDecode(lengthType, '_arr_byte_len', indent, endianness);
    code += `${indent}_arr_end = decoder.position + _arr_byte_len\n`;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while decoder.position < _arr_end:\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "null_terminated") {
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while True:\n`;
    code += `${indent}    if decoder.peek_uint8() == ${terminator}:\n`;
    code += `${indent}        decoder.read_uint8()  # consume terminator\n`;
    code += `${indent}        break\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "eof_terminated") {
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while decoder.has_more():\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (field.length !== undefined) {
    // Fallback fixed
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for _i in range(${field.length}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else if (field.length_field) {
    code += `${indent}_arr_count = ${resultPath}["${field.length_field}"]\n`;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for _i in range(_arr_count):\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else {
    // Read until end of stream
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while decoder.has_more():\n`;
    code += generateArrayItemDecode(items, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  }

  return code;
}

function generateArrayItemDecode(items: any, arrayVar: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';

  if (items && typeof items === 'object' && items.type) {
    const itemField = { ...items, name: undefined };
    code += generateFieldDecode(itemField, '_arr_item', indent, endianness, schema, bitOrder);
    // The _arr_item might be a dict or primitive depending on the type
    // For struct types decoded via generateFieldDecode, they get assigned to _arr_item
    // For primitives, they get assigned to _arr_item directly
    code += `${indent}${arrayVar}.append(_arr_item)\n`;
  } else if (typeof items === 'string') {
    code += generateFieldDecode({ type: items, name: undefined }, '_arr_item', indent, endianness, schema, bitOrder);
    code += `${indent}${arrayVar}.append(_arr_item)\n`;
  }

  return code;
}

function generateBitfieldDecode(field: any, fieldAssign: string, indent: string, bitOrder: string): string {
  let code = '';
  code += `${indent}${fieldAssign} = {}\n`;
  for (const subfield of (field.fields || [])) {
    code += `${indent}${fieldAssign}["${subfield.name}"] = decoder.read_bits(${subfield.size || 1})\n`;
  }
  return code;
}

function generateDiscriminatedUnionDecode(field: any, fieldAssign: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const variants = field.variants || [];

  // Read discriminator
  if (field.discriminator?.type) {
    const discType = field.discriminator.type;
    const e = field.discriminator.endianness || endianness;
    switch (discType) {
      case "uint8":
        code += `${indent}_disc_val = decoder.read_uint8()\n`;
        break;
      case "uint16":
        code += `${indent}_disc_val = decoder.read_uint16(${pyEndianness(e)})\n`;
        break;
      case "uint32":
        code += `${indent}_disc_val = decoder.read_uint32(${pyEndianness(e)})\n`;
        break;
    }
  } else if (field.discriminator?.peek) {
    const peekType = field.discriminator.peek;
    const e = field.discriminator.endianness || endianness;
    switch (peekType) {
      case "uint8":
        code += `${indent}_disc_val = decoder.peek_uint8()\n`;
        break;
      case "uint16":
        code += `${indent}_disc_val = decoder.peek_uint16(${pyEndianness(e)})\n`;
        break;
      case "uint32":
        code += `${indent}_disc_val = decoder.peek_uint32(${pyEndianness(e)})\n`;
        break;
    }
  }

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const discValue = variant.value !== undefined ? variant.value : i;
    const cond = i === 0 ? 'if' : 'elif';
    code += `${indent}${cond} _disc_val == ${discValue}:\n`;
    code += `${indent}    ${fieldAssign} = {"type": "${variant.type}", "value": decode_${toSnakeCase(variant.type)}(decoder)}\n`;
  }

  code += `${indent}else:\n`;
  code += `${indent}    raise ValueError(f"Unknown discriminator value: {_disc_val}")\n`;

  return code;
}

function generateChoiceDecode(field: any, fieldAssign: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const choices = field.choices || [];

  // Find discriminator by looking at first field's const in each choice type
  let discriminatorType = "uint8";
  let discriminatorEndianness = endianness;

  for (const choice of choices) {
    if (schema.types[choice.type] && 'sequence' in schema.types[choice.type]) {
      const firstField = (schema.types[choice.type] as any).sequence[0];
      if (firstField && firstField.const !== undefined) {
        discriminatorType = firstField.type;
        discriminatorEndianness = firstField.endianness || endianness;
        break;
      }
    }
  }

  // Peek at discriminator
  switch (discriminatorType) {
    case "uint8":
      code += `${indent}_choice_disc = decoder.peek_uint8()\n`;
      break;
    case "uint16":
      code += `${indent}_choice_disc = decoder.peek_uint16(${pyEndianness(discriminatorEndianness)})\n`;
      break;
    case "uint32":
      code += `${indent}_choice_disc = decoder.peek_uint32(${pyEndianness(discriminatorEndianness)})\n`;
      break;
  }

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    const cond = i === 0 ? 'if' : 'elif';

    // Find the const value for this choice
    let constValue: any = i;
    if (schema.types[choice.type] && 'sequence' in schema.types[choice.type]) {
      const firstField = (schema.types[choice.type] as any).sequence[0];
      if (firstField && firstField.const !== undefined) {
        constValue = firstField.const;
      }
    }

    code += `${indent}${cond} _choice_disc == ${constValue}:\n`;
    code += `${indent}    _choice_result = decode_${toSnakeCase(choice.type)}(decoder)\n`;
    code += `${indent}    _choice_result["type"] = "${choice.type}"\n`;
    code += `${indent}    ${fieldAssign} = _choice_result\n`;
  }

  code += `${indent}else:\n`;
  code += `${indent}    raise ValueError(f"Unknown choice discriminator: {_choice_disc}")\n`;

  return code;
}

function generateOptionalDecode(field: any, fieldAssign: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const presenceType = field.presence_type || "uint8";
  const valueType = field.value_type;

  // Read presence marker
  switch (presenceType) {
    case "bit":
      code += `${indent}_present = decoder.read_bits(1) != 0\n`;
      break;
    default:
      code += `${indent}_present = decoder.read_uint8() != 0\n`;
  }

  code += `${indent}if _present:\n`;
  if (typeof valueType === 'string') {
    code += generateFieldDecode({ type: valueType, name: undefined }, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  } else {
    code += generateFieldDecode({ ...valueType, name: undefined }, fieldAssign, indent + '    ', endianness, schema, bitOrder);
  }
  code += `${indent}else:\n`;
  code += `${indent}    ${fieldAssign} = None\n`;

  return code;
}

function generateTypeRefDecode(field: any, fieldAssign: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';
  const typeDef = schema.types[field.type];

  if (isEnumType(typeDef)) {
    const repr = (typeDef as any).repr;
    const e = field.endianness || endianness;
    switch (repr) {
      case "uint8":
        code += `${indent}${fieldAssign} = decoder.read_uint8()\n`;
        break;
      case "uint16":
        code += `${indent}${fieldAssign} = decoder.read_uint16(${pyEndianness(e)})\n`;
        break;
      case "uint32":
        code += `${indent}${fieldAssign} = decoder.read_uint32(${pyEndianness(e)})\n`;
        break;
    }
  } else if ('sequence' in typeDef) {
    code += `${indent}${fieldAssign} = decode_${toSnakeCase(field.type)}(decoder)\n`;
  } else if ((typeDef as any).type === 'string') {
    code += generateStringDecode(typeDef as any, fieldAssign, '', indent, endianness);
  } else if ((typeDef as any).type === 'array') {
    code += generateArrayDecode(typeDef as any, fieldAssign, '', indent, endianness, schema, bitOrder);
  } else {
    code += `${indent}# TODO: type ref decode for ${field.type}\n`;
  }

  return code;
}

/**
 * Generate the complete Python module for a schema
 */
export function generatePython(
  schema: BinarySchema,
  typeName: string,
  options?: PythonGeneratorOptions
): GeneratedPythonCode {
  const runtimeModule = options?.runtimeModule || "binschema_runtime";

  if (!schema.types[typeName]) {
    throw new Error(`Type ${typeName} not found in schema`);
  }

  const defaultEndianness = schema.config?.endianness || "big_endian";
  const defaultBitOrder = schema.config?.bit_order || "msb_first";

  const lines: string[] = [];

  // Module header
  lines.push(`"""Generated by BinSchema - do not edit manually"""`);
  lines.push(``);
  lines.push(`from __future__ import annotations`);
  lines.push(`from typing import Any`);
  lines.push(`import math`);
  lines.push(`import struct`);
  lines.push(`from ${runtimeModule} import BitStreamEncoder, BitStreamDecoder, SeekableBitStreamDecoder`);
  lines.push(``);
  lines.push(``);

  // Generate code for each type
  for (const [name, typeDef] of Object.entries(schema.types)) {
    if (name.includes('<')) continue; // Skip generic templates

    if ('sequence' in typeDef) {
      // Composite type
      lines.push(...generateStructCode(name, typeDef, schema, defaultEndianness, defaultBitOrder));
    } else if (isEnumType(typeDef)) {
      lines.push(...generateEnumCode(name, typeDef as any, defaultEndianness));
    } else if ((typeDef as any).type === 'discriminated_union') {
      lines.push(...generateDiscriminatedUnionCode(name, typeDef as any, schema, defaultEndianness, defaultBitOrder));
    } else if ((typeDef as any).type === 'string') {
      lines.push(...generateStringTypeCode(name, typeDef as any, defaultEndianness));
    } else if ((typeDef as any).type === 'array') {
      lines.push(...generateArrayTypeCode(name, typeDef as any, schema, defaultEndianness, defaultBitOrder));
    }
    lines.push(``);
    lines.push(``);
  }

  return {
    code: lines.join("\n"),
    typeName,
  };
}

/**
 * Generate encoder class and decode function for a struct type
 */
function generateStructCode(name: string, typeDef: any, schema: BinarySchema, endianness: string, bitOrder: string): string[] {
  const lines: string[] = [];
  const className = toPascalCase(name);
  const fields = typeDef.sequence || [];

  // Encoder class
  lines.push(`class ${className}Encoder(BitStreamEncoder):`);
  lines.push(`    def __init__(self):`);
  lines.push(`        super().__init__("${bitOrder}")`);
  lines.push(``);
  lines.push(`    def encode(self, value: dict[str, Any]) -> bytes:`);
  lines.push(`        encoder = BitStreamEncoder("${bitOrder}")`);

  // Generate encoding for each field
  for (const field of fields) {
    lines.push(generateFieldEncode(field, 'value', '        ', endianness, schema, bitOrder));
  }

  lines.push(`        return encoder.finish()`);
  lines.push(``);

  // Decode function
  lines.push(``);
  lines.push(`def decode_${toSnakeCase(name)}(decoder: BitStreamDecoder) -> dict[str, Any]:`);
  lines.push(`    result: dict[str, Any] = {}`);

  for (const field of fields) {
    lines.push(generateFieldDecode(field, 'result', '    ', endianness, schema, bitOrder));
  }

  lines.push(`    return result`);

  // Top-level decode (from bytes)
  lines.push(``);
  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "${bitOrder}")`);
  lines.push(``);
  lines.push(`    def decode(self) -> dict[str, Any]:`);
  lines.push(`        return decode_${toSnakeCase(name)}(self)`);

  return lines;
}

function generateEnumCode(name: string, typeDef: any, endianness: string): string[] {
  const lines: string[] = [];
  const className = toPascalCase(name);
  const variants = typeDef.variants as Record<string, number>;
  const repr = typeDef.repr as string;
  const bitOrder = "msb_first"; // Enums don't use bit order

  // Generate constants
  lines.push(`# ${className} enum values`);
  for (const [variantName, value] of Object.entries(variants)) {
    lines.push(`${className}_${variantName.toUpperCase()} = ${value}`);
  }
  lines.push(``);

  // Reverse lookup
  lines.push(`_${toSnakeCase(name)}_from_value = {`);
  for (const [variantName, value] of Object.entries(variants)) {
    lines.push(`    ${value}: "${variantName}",`);
  }
  lines.push(`}`);
  lines.push(``);

  // Encoder class
  lines.push(`class ${className}Encoder(BitStreamEncoder):`);
  lines.push(`    def __init__(self):`);
  lines.push(`        super().__init__("${bitOrder}")`);
  lines.push(``);
  lines.push(`    def encode(self, value: int) -> bytes:`);
  lines.push(`        encoder = BitStreamEncoder("${bitOrder}")`);
  switch (repr) {
    case "uint8":
      lines.push(`        encoder.write_uint8(value)`);
      break;
    case "uint16":
      lines.push(`        encoder.write_uint16(value, ${pyEndianness(endianness)})`);
      break;
    case "uint32":
      lines.push(`        encoder.write_uint32(value, ${pyEndianness(endianness)})`);
      break;
  }
  lines.push(`        return encoder.finish()`);
  lines.push(``);

  // Decoder class
  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "${bitOrder}")`);
  lines.push(``);
  lines.push(`    def decode(self) -> int:`);
  switch (repr) {
    case "uint8":
      lines.push(`        raw = self.read_uint8()`);
      break;
    case "uint16":
      lines.push(`        raw = self.read_uint16(${pyEndianness(endianness)})`);
      break;
    case "uint32":
      lines.push(`        raw = self.read_uint32(${pyEndianness(endianness)})`);
      break;
  }
  lines.push(`        if raw not in _${toSnakeCase(name)}_from_value:`);
  lines.push(`            raise ValueError(f"Invalid ${className} value: {raw}")`);
  lines.push(`        return raw`);

  return lines;
}

function generateDiscriminatedUnionCode(name: string, typeDef: any, schema: BinarySchema, endianness: string, bitOrder: string): string[] {
  const lines: string[] = [];
  const className = toPascalCase(name);

  // Encoder
  lines.push(`class ${className}Encoder(BitStreamEncoder):`);
  lines.push(`    def __init__(self):`);
  lines.push(`        super().__init__("${bitOrder}")`);
  lines.push(``);
  lines.push(`    def encode(self, value: dict[str, Any]) -> bytes:`);
  lines.push(`        encoder = BitStreamEncoder("${bitOrder}")`);
  lines.push(generateDiscriminatedUnionEncode(typeDef, 'value', '        ', endianness, schema, bitOrder));
  lines.push(`        return encoder.finish()`);
  lines.push(``);

  // Decoder
  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "${bitOrder}")`);
  lines.push(``);
  lines.push(`    def decode(self) -> dict[str, Any]:`);
  lines.push(`        decoder = self`);
  lines.push(`        result: dict[str, Any] = {}`);
  lines.push(generateDiscriminatedUnionDecode(typeDef, 'result', '        ', endianness, schema, bitOrder));
  lines.push(`        return result`);

  return lines;
}

function generateStringTypeCode(name: string, typeDef: any, endianness: string): string[] {
  const lines: string[] = [];
  const className = toPascalCase(name);

  lines.push(`class ${className}Encoder(BitStreamEncoder):`);
  lines.push(`    def __init__(self):`);
  lines.push(`        super().__init__("msb_first")`);
  lines.push(``);
  lines.push(`    def encode(self, value: str) -> bytes:`);
  lines.push(`        encoder = BitStreamEncoder("msb_first")`);
  lines.push(generateStringEncode(typeDef, 'value', '        ', endianness));
  lines.push(`        return encoder.finish()`);
  lines.push(``);

  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "msb_first")`);
  lines.push(``);
  lines.push(`    def decode(self) -> str:`);
  lines.push(`        decoder = self`);
  lines.push(`        result = ""`);
  lines.push(generateStringDecode(typeDef, 'result', '', '        ', endianness));
  lines.push(`        return result`);

  return lines;
}

function generateArrayTypeCode(name: string, typeDef: any, schema: BinarySchema, endianness: string, bitOrder: string): string[] {
  const lines: string[] = [];
  const className = toPascalCase(name);

  lines.push(`class ${className}Encoder(BitStreamEncoder):`);
  lines.push(`    def __init__(self):`);
  lines.push(`        super().__init__("${bitOrder}")`);
  lines.push(``);
  lines.push(`    def encode(self, value: list) -> bytes:`);
  lines.push(`        encoder = BitStreamEncoder("${bitOrder}")`);
  lines.push(generateArrayEncode(typeDef, 'value', '        ', endianness, schema, bitOrder));
  lines.push(`        return encoder.finish()`);
  lines.push(``);

  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "${bitOrder}")`);
  lines.push(``);
  lines.push(`    def decode(self) -> list:`);
  lines.push(`        decoder = self`);
  lines.push(`        result = []`);
  lines.push(generateArrayDecode(typeDef, 'result', '', '        ', endianness, schema, bitOrder));
  lines.push(`        return result`);

  return lines;
}
