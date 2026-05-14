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

// Unique counter for generated variable names to avoid collisions in nested arrays
let _varCounter = 0;
function uniqueVar(prefix: string): string {
  return `${prefix}_${_varCounter++}`;
}

/**
 * Convert a dotted field path to Python dict access
 * e.g., "flags.count" with basePath "result" -> result["flags"]["count"]
 */
function pyFieldAccess(basePath: string, fieldPath: string): string {
  const parts = fieldPath.split('.');
  let access = basePath;
  for (const part of parts) {
    access += `["${part}"]`;
  }
  return access;
}

/**
 * Convert a dotted field path to a Python expression that resolves against
 * either the local `result` dict or the top-level `_root` dict. This is used
 * for decode-time field references (length_field, count_field, discriminator
 * field, etc.) which may live in a parent scope.
 *
 * Rules:
 *   - Paths starting with "_root." are resolved against `_root`.
 *   - Other paths are tried against `result` first, then `_root`. We emit a
 *     conditional expression so the lookup falls through at runtime.
 *
 * This mirrors the Kaitai-style "walk up the scope chain" behavior the TS
 * reference relies on via context threading.
 */
function pyFieldAccessWithRootFallback(fieldPath: string): string {
  const parts = fieldPath.split('.');
  if (parts[0] === '_root') {
    let access = '_root';
    for (const part of parts.slice(1)) access += `[${JSON.stringify(part)}]`;
    return access;
  }
  const firstKey = JSON.stringify(parts[0]);
  const suffix = parts.map(p => `[${JSON.stringify(p)}]`).join('');
  // (result if "X" in result else _root)["X"]...
  // Relies on _root being initialized at the top of decode_X to `result` when
  // no caller passed one in (top-level decode case), so this is always safe.
  return `(result if ${firstKey} in result else _root)${suffix}`;
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
  // Replace logical operators (order matters - do multi-char first)
  let expr = condition
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/!==/g, ' != ')
    .replace(/===/g, ' == ')
    .replace(/!=/g, ' != ')
    .replace(/==/g, ' == ')
    .replace(/\btrue\b/g, 'True')
    .replace(/\bfalse\b/g, 'False');

  // Replace ! (not) but not != which was already handled
  expr = expr.replace(/!(?!=)/g, 'not ');

  // Handle hex literals (preserve them)
  // Replace field references like "header.flags" -> basePath["header"]["flags"]
  // and simple references like "flags" -> basePath["flags"]
  const reserved = new Set(['True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'if', 'else']);
  const identifierRegex = /\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)\b/g;

  expr = expr.replace(identifierRegex, (match) => {
    if (reserved.has(match)) return match;
    if (/^\d/.test(match)) return match;
    if (match === basePath || match.startsWith(`${basePath}.`)) return match;

    // Convert dotted path to nested dict access
    const parts = match.split('.');
    let access = basePath;
    for (const part of parts) {
      access += `["${part}"]`;
    }
    return access;
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
        code += generateTypeRefEncode(field, fieldAccess, indent, endianness, schema, bitOrder, valuePath);
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
  // The schema field is `align_to` (matches TS/Rust/Go). `pad_to` was a
  // pre-existing typo and is accepted as a fallback.
  const alignTo = field.align_to ?? field.pad_to;
  let code = '';
  if (alignTo) {
    code += `${indent}padding_needed = (${alignTo} - (encoder.byte_offset % ${alignTo})) % ${alignTo}\n`;
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

function pyEncodingName(encoding: string, endianness: string): string {
  switch (encoding) {
    case "utf8": return "utf-8";
    case "ascii": return "ascii";
    case "latin1": return "latin-1";
    case "utf16":
      return endianness === "little_endian" ? "utf-16-le" : "utf-16-be";
    case "utf16_be":
    case "utf16be":
      return "utf-16-be";
    case "utf16_le":
    case "utf16le":
      return "utf-16-le";
    default:
      return "utf-8";
  }
}

function isUtf16Encoding(encoding: string): boolean {
  return encoding === "utf16" || encoding === "utf16_be" || encoding === "utf16be" ||
         encoding === "utf16_le" || encoding === "utf16le";
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
  const fieldEndianness = field.endianness || endianness;
  const pyEncoding = pyEncodingName(encoding, fieldEndianness);
  const isUtf16 = isUtf16Encoding(encoding);
  const kind = field.kind;

  if (kind === "fixed" && field.length !== undefined) {
    code += `${indent}_str_bytes = ${fieldAccess}.encode("${pyEncoding}")\n`;
    code += `${indent}encoder.write_bytes(_str_bytes[:${field.length}])\n`;
    code += `${indent}for _ in range(${field.length} - len(_str_bytes)):\n`;
    code += `${indent}    encoder.write_uint8(0)\n`;
  } else if (kind === "null_terminated" || field.terminator !== undefined) {
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    code += `${indent}encoder.write_bytes(${fieldAccess}.encode("${pyEncoding}"))\n`;
    if (isUtf16) {
      // UTF-16 null terminator is 2 bytes
      code += `${indent}encoder.write_uint8(${terminator})\n`;
      code += `${indent}encoder.write_uint8(${terminator})\n`;
    } else {
      code += `${indent}encoder.write_uint8(${terminator})\n`;
    }
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

    // Each item gets its own byte-length prefix
    const itemLengthType = field.item_length_type || "uint32";
    code += `${indent}for _item in ${fieldAccess}:\n`;
    // Encode item to temp buffer to measure byte length
    code += `${indent}    _item_encoder = BitStreamEncoder("${bitOrder}")\n`;
    if (items && typeof items === 'object' && items.type) {
      const itemEncCode = generateFieldEncode({ ...items, name: undefined }, '_item', indent + '    ', endianness, schema, bitOrder);
      code += itemEncCode.replace(/\bencoder\b/g, '_item_encoder');
    }
    code += `${indent}    _item_bytes = _item_encoder.finish()\n`;
    code += generateLengthPrefixEncode(itemLengthType, 'len(_item_bytes)', indent + '    ', endianness);
    code += `${indent}    encoder.write_bytes(_item_bytes)\n`;
    return code;
  }

  // Use unique variable names for array iteration
  const encUid = _varCounter++;
  const encItemVar = `_item_${encUid}`;

  // Variant-terminated arrays: write all items including terminal variant
  if (kind === "variant_terminated") {
    code += `${indent}for ${encItemVar} in ${fieldAccess}:\n`;
    code += generateArrayItemEncode(items, encItemVar, indent + '    ', endianness, schema, bitOrder);
    return code;
  }

  // Signature-terminated arrays: write items until signature
  if (kind === "signature_terminated") {
    code += `${indent}for ${encItemVar} in ${fieldAccess}:\n`;
    code += generateArrayItemEncode(items, encItemVar, indent + '    ', endianness, schema, bitOrder);
    return code;
  }

  // Null-terminated arrays write a terminator after all items
  if (kind === "null_terminated") {
    code += `${indent}for ${encItemVar} in ${fieldAccess}:\n`;
    code += generateArrayItemEncode(items, encItemVar, indent + '    ', endianness, schema, bitOrder);
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    code += `${indent}encoder.write_uint8(${terminator})\n`;
    return code;
  }

  // Iterate over elements
  code += `${indent}for ${encItemVar} in ${fieldAccess}:\n`;
  code += generateArrayItemEncode(items, encItemVar, indent + '    ', endianness, schema, bitOrder);

  return code;
}

function generateArrayItemEncode(items: any, itemVarName: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  if (items && typeof items === 'object' && items.type) {
    return generateFieldEncode({ ...items, name: undefined }, itemVarName, indent, endianness, schema, bitOrder);
  } else if (typeof items === 'string') {
    return generateFieldEncode({ type: items }, itemVarName, indent, endianness, schema, bitOrder);
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

function generateTypeRefEncode(field: any, fieldAccess: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string, valuePath?: string): string {
  let code = '';
  const typeName = toPascalCase(field.type);
  const typeDef = schema.types[field.type];
  const parentPath = valuePath || 'value';

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
    // Struct type - use sub-encoder, pass current value as parent context
    code += `${indent}_sub_encoder = ${typeName}Encoder()\n`;
    code += `${indent}_sub_bytes = _sub_encoder.encode(${fieldAccess}, ${parentPath})\n`;
    code += `${indent}encoder.write_bytes(_sub_bytes)\n`;
  } else if ((typeDef as any).type === 'string') {
    // String type alias
    code += generateStringEncode(typeDef as any, fieldAccess, indent, endianness);
  } else if ((typeDef as any).type === 'array') {
    // Array type alias
    code += generateArrayEncode(typeDef as any, fieldAccess, indent, endianness, schema, bitOrder);
  } else if ((typeDef as any).type === 'discriminated_union') {
    // Discriminated union type - use sub-encoder
    code += `${indent}_sub_encoder = ${typeName}Encoder()\n`;
    code += `${indent}_sub_bytes = _sub_encoder.encode(${fieldAccess})\n`;
    code += `${indent}encoder.write_bytes(_sub_bytes)\n`;
  } else if ((typeDef as any).type === 'choice') {
    // Choice type - use sub-encoder
    code += `${indent}_sub_encoder = ${typeName}Encoder()\n`;
    code += `${indent}_sub_bytes = _sub_encoder.encode(${fieldAccess})\n`;
    code += `${indent}encoder.write_bytes(_sub_bytes)\n`;
  } else {
    code += `${indent}# TODO: type ref encode for ${field.type}\n`;
  }

  return code;
}

function generateComputedFieldEncode(field: any, valuePath: string, indent: string, endianness: string, schema: BinarySchema): string {
  let code = '';
  const computed = field.computed;
  const e = field.endianness || endianness;
  const bitOrder = schema.config?.bit_order || 'msb_first';

  // Computed fields are calculated during encoding
  if (computed.type === "count_of") {
    const target = computed.target;
    const targetAccess = resolveComputedTarget(target, valuePath);
    const lengthExpr = `len(${targetAccess})`;

    code += generateComputedWrite(field.type, lengthExpr, indent, e);
  } else if (computed.type === "length_of") {
    const target = computed.target;

    if (computed.from_after_field) {
      // Content-first encoding: write placeholder, will be back-patched by struct-level code
      code += `${indent}# Computed: length_of ${target} (from_after_field: ${computed.from_after_field})\n`;
      code += `${indent}_backpatch_pos_${field.name} = encoder.byte_offset\n`;
      code += generatePlaceholderWrite(field.type, indent, e);
      return code;
    }

    // Calculate length by trial encoding the target field
    const targetAccess = resolveComputedTarget(target, valuePath);
    code += `${indent}# Computed: length_of ${target}\n`;
    code += generateLengthCalculation(field, target, targetAccess, valuePath, indent, bitOrder, e, schema);
  } else if (computed.type === "crc32_of") {
    const target = computed.target;
    const targetAccess = resolveComputedTarget(target, valuePath);
    code += `${indent}# CRC32 computed field - write placeholder, back-patch later\n`;
    code += `${indent}_crc_pos_${field.name} = encoder.byte_offset\n`;
    code += generatePlaceholderWrite(field.type, indent, e);
  } else if (computed.type === "position_of") {
    code += `${indent}# Position computed field - write placeholder, back-patch later\n`;
    code += `${indent}_pos_${field.name} = encoder.byte_offset\n`;
    code += generatePlaceholderWrite(field.type, indent, e);
  } else if (computed.type === "sum_of_field_sizes") {
    const targets = computed.targets || [];
    code += `${indent}# Computed: sum_of_field_sizes\n`;
    const terms = targets.map((t: string) => {
      const tAccess = resolveComputedTarget(t, valuePath);
      return `len(${toPascalCase(getTargetFieldType(t, schema, valuePath))}Encoder().encode(${tAccess}))`;
    });
    if (terms.length > 0) {
      code += generateComputedWrite(field.type, terms.join(' + '), indent, e);
    } else {
      code += generateComputedWrite(field.type, '0', indent, e);
    }
  }

  return code;
}

function resolveComputedTarget(target: string, valuePath: string): string {
  if (target.startsWith('../')) {
    // Parent reference - count levels and resolve
    let remaining = target;
    let levels = 0;
    while (remaining.startsWith('../')) {
      levels++;
      remaining = remaining.substring(3);
    }
    // For single parent: _parent_value["field"]
    // For grandparent etc, we'd need deeper context - for now assume _parent_value
    // handles the common single-parent case
    return `_parent_value["${remaining}"]`;
  }
  return `${valuePath}["${target}"]`;
}

function getTargetFieldType(target: string, schema: BinarySchema, valuePath: string): string {
  // Best-effort field type lookup - returns the type name
  return target;
}

function generateLengthCalculation(field: any, target: string, targetAccess: string, valuePath: string, indent: string, bitOrder: string, endianness: string, schema: BinarySchema): string {
  let code = '';
  const lengthVar = `_computed_length_${field.name}`;
  const offset = field.computed.offset || 0;

  // Look up the target field's type in the schema to determine how to calculate length
  // For arrays/bytes/strings: use trial encoding
  // For simple types: use known sizes
  code += `${indent}_temp_enc_${field.name} = BitStreamEncoder("${bitOrder}")\n`;

  // Find the target field definition to determine encoding strategy
  // We need to encode the target value to measure its byte length
  code += `${indent}_target_val_${field.name} = ${targetAccess}\n`;
  code += `${indent}if isinstance(_target_val_${field.name}, (list, bytes, bytearray)):\n`;
  code += `${indent}    ${lengthVar} = len(_target_val_${field.name})\n`;
  code += `${indent}elif isinstance(_target_val_${field.name}, str):\n`;
  code += `${indent}    ${lengthVar} = len(_target_val_${field.name}.encode("utf-8"))\n`;
  code += `${indent}elif isinstance(_target_val_${field.name}, dict):\n`;
  // For struct types, need to trial-encode
  code += `${indent}    # Try to find encoder for this struct\n`;
  code += `${indent}    ${lengthVar} = 0\n`;
  code += `${indent}    for _enc_cls_name in dir():\n`;
  code += `${indent}        pass  # Will be improved with type-specific encoding\n`;
  code += `${indent}else:\n`;
  code += `${indent}    ${lengthVar} = 0\n`;

  if (offset) {
    code += `${indent}${lengthVar} += ${offset}\n`;
  }

  code += generateComputedWrite(field.type, lengthVar, indent, endianness);
  return code;
}

function generateComputedWrite(fieldType: string, valueExpr: string, indent: string, endianness: string): string {
  switch (fieldType) {
    case "uint8":
      return `${indent}encoder.write_uint8(${valueExpr})\n`;
    case "uint16":
      return `${indent}encoder.write_uint16(${valueExpr}, ${pyEndianness(endianness)})\n`;
    case "uint32":
      return `${indent}encoder.write_uint32(${valueExpr}, ${pyEndianness(endianness)})\n`;
    case "uint64":
      return `${indent}encoder.write_uint64(${valueExpr}, ${pyEndianness(endianness)})\n`;
    case "varlength":
      return `${indent}encoder.write_varlength_der(${valueExpr})\n`;
    default:
      return `${indent}encoder.write_uint8(${valueExpr})\n`;
  }
}

function generatePatchCall(fieldType: string, offsetVar: string, valueExpr: string, indent: string, endianness: string): string {
  switch (fieldType) {
    case "uint8":
      return `${indent}encoder.patch_uint8(${offsetVar}, ${valueExpr})\n`;
    case "uint16":
      return `${indent}encoder.patch_uint16(${offsetVar}, ${valueExpr}, ${pyEndianness(endianness)})\n`;
    case "uint32":
      return `${indent}encoder.patch_uint32(${offsetVar}, ${valueExpr}, ${pyEndianness(endianness)})\n`;
    case "uint64":
      return `${indent}encoder.patch_uint64(${offsetVar}, ${valueExpr}, ${pyEndianness(endianness)})\n`;
    default:
      return `${indent}encoder.patch_uint32(${offsetVar}, ${valueExpr}, ${pyEndianness(endianness)})\n`;
  }
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
      code += generateDiscriminatedUnionDecode(field, fieldAssign, indent, endianness, schema, bitOrder, resultPath);
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
    const pyEncoding = pyEncodingName(encoding, field.endianness || endianness);
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
  const alignTo = field.align_to ?? field.pad_to;
  if (alignTo) {
    let code = '';
    code += `${indent}_padding_needed = (${alignTo} - (decoder.position % ${alignTo})) % ${alignTo}\n`;
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
  const fieldEndianness = field.endianness || endianness;
  const pyEncoding = pyEncodingName(encoding, fieldEndianness);
  const isUtf16 = isUtf16Encoding(encoding);
  const kind = field.kind;

  if (kind === "fixed" && field.length !== undefined) {
    code += `${indent}_str_bytes = decoder.read_bytes_slice(${field.length})\n`;
    if (isUtf16) {
      code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}").rstrip("\\x00")\n`;
    } else {
      code += `${indent}${fieldAssign} = _str_bytes.rstrip(b'\\x00').decode("${pyEncoding}")\n`;
    }
  } else if (kind === "null_terminated" || field.terminator !== undefined) {
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    if (isUtf16) {
      // UTF-16: read 2-byte code units until we see 0x0000
      code += `${indent}_str_buf = bytearray()\n`;
      code += `${indent}while True:\n`;
      code += `${indent}    _b0 = decoder.read_uint8()\n`;
      code += `${indent}    _b1 = decoder.read_uint8()\n`;
      code += `${indent}    if _b0 == ${terminator} and _b1 == ${terminator}:\n`;
      code += `${indent}        break\n`;
      code += `${indent}    _str_buf.append(_b0)\n`;
      code += `${indent}    _str_buf.append(_b1)\n`;
      code += `${indent}${fieldAssign} = _str_buf.decode("${pyEncoding}")\n`;
    } else {
      code += `${indent}_str_buf = bytearray()\n`;
      code += `${indent}while True:\n`;
      code += `${indent}    _ch = decoder.read_uint8()\n`;
      code += `${indent}    if _ch == ${terminator}:\n`;
      code += `${indent}        break\n`;
      code += `${indent}    _str_buf.append(_ch)\n`;
      code += `${indent}${fieldAssign} = _str_buf.decode("${pyEncoding}")\n`;
    }
  } else if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixDecode(lengthType, '_str_len', indent, endianness);
    code += `${indent}_str_bytes = decoder.read_bytes_slice(_str_len)\n`;
    code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}")\n`;
  } else if (kind === "field_referenced" && field.length_field) {
    code += `${indent}_str_len = ${pyFieldAccessWithRootFallback(field.length_field)}\n`;
    code += `${indent}_str_bytes = decoder.read_bytes_slice(_str_len)\n`;
    code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}")\n`;
  } else if (field.length !== undefined) {
    // Fallback fixed-length
    code += `${indent}_str_bytes = decoder.read_bytes_slice(${field.length})\n`;
    if (isUtf16) {
      code += `${indent}${fieldAssign} = _str_bytes.decode("${pyEncoding}").rstrip("\\x00")\n`;
    } else {
      code += `${indent}${fieldAssign} = _str_bytes.rstrip(b'\\x00').decode("${pyEncoding}")\n`;
    }
  } else if (field.length_field) {
    code += `${indent}_str_len = ${pyFieldAccessWithRootFallback(field.length_field)}\n`;
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
    code += `${indent}_bytes_len = ${pyFieldAccessWithRootFallback(field.length_field)}\n`;
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(_bytes_len))\n`;
  } else if (field.length !== undefined) {
    code += `${indent}${fieldAssign} = list(decoder.read_bytes_slice(${field.length}))\n`;
  } else if (field.length_field) {
    code += `${indent}_bytes_len = ${pyFieldAccessWithRootFallback(field.length_field)}\n`;
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

  // Use unique variable names to avoid collisions in nested arrays
  const uid = _varCounter++;
  const lenVar = `_arr_len_${uid}`;
  const countVar = `_arr_count_${uid}`;
  const iVar = `_i_${uid}`;
  const itemVar = `_arr_item_${uid}`;

  if (kind === "fixed" && field.length !== undefined) {
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for ${iVar} in range(${field.length}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    code += generateLengthPrefixDecode(lengthType, lenVar, indent, endianness);
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for ${iVar} in range(${lenVar}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "field_referenced" && field.length_field) {
    code += `${indent}${countVar} = ${pyFieldAccessWithRootFallback(field.length_field)}\n`;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for ${iVar} in range(${countVar}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "computed_count") {
    const countExpr = field.count_expr;
    const countField = field.count_field || field.length_field;
    if (countExpr) {
      const pyExpr = countExpr.replace(/\b([a-zA-Z_]\w*)\b/g, (match: string) => {
        if (/^\d/.test(match)) return match;
        if (['and', 'or', 'not', 'True', 'False', 'None'].includes(match)) return match;
        return `${resultPath}["${match}"]`;
      });
      code += `${indent}${countVar} = ${pyExpr}\n`;
    } else if (countField) {
      code += `${indent}${countVar} = ${pyFieldAccessWithRootFallback(countField)}\n`;
    } else {
      code += `${indent}${countVar} = 0  # computed_count without field reference\n`;
    }
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for ${iVar} in range(${countVar}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "length_prefixed_items") {
    const lengthType = field.length_type || "uint8";
    const itemLengthType = field.item_length_type || "uint32";
    code += generateLengthPrefixDecode(lengthType, lenVar, indent, endianness);
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for ${iVar} in range(${lenVar}):\n`;
    const itemByteLenVar = `_item_byte_len_${uid}`;
    code += generateLengthPrefixDecode(itemLengthType, itemByteLenVar, indent + '    ', endianness);
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "byte_length_prefixed") {
    const lengthType = field.length_type || "uint8";
    const byteLenVar = `_arr_byte_len_${uid}`;
    const endVar = `_arr_end_${uid}`;
    code += generateLengthPrefixDecode(lengthType, byteLenVar, indent, endianness);
    code += `${indent}${endVar} = decoder.position + ${byteLenVar}\n`;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while decoder.position < ${endVar}:\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "variant_terminated") {
    const terminalVariants = field.terminal_variants || [];
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while True:\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
    if (terminalVariants.length > 0) {
      const checks = terminalVariants.map((v: string) => `${fieldAssign}[-1].get("type") == "${v}"`).join(' or ');
      code += `${indent}    if ${checks}:\n`;
      code += `${indent}        break\n`;
    } else {
      code += `${indent}    break  # no terminal variants specified\n`;
    }
  } else if (kind === "signature_terminated") {
    // Peek the typed terminator at the current position; stop when it
    // matches. Mirrors the TS generator: `terminator_value` /
    // `terminator_type` (+ optional `terminator_endianness`) describe the
    // sentinel; the array's own bytes are followed by a *sibling* field
    // that consumes the sentinel itself, so we don't read it here.
    const terminatorValue = (field as any).terminator_value;
    const terminatorType = (field as any).terminator_type;
    const terminatorEndianness = (field as any).terminator_endianness || endianness;
    if (terminatorValue === undefined || terminatorType === undefined) {
      throw new Error(
        `signature_terminated array '${field.name}' requires terminator_value and terminator_type`
      );
    }
    const peekArgs = terminatorType === "uint8" ? "" : `"${terminatorEndianness}"`;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while True:\n`;
    code += `${indent}    # Peek the typed terminator without consuming it.\n`;
    code += `${indent}    if not decoder.has_more():\n`;
    code += `${indent}        break\n`;
    code += `${indent}    if decoder.peek_${terminatorType}(${peekArgs}) == ${terminatorValue}:\n`;
    code += `${indent}        break\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "null_terminated") {
    const terminator = field.terminator !== undefined ? field.terminator : 0;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while True:\n`;
    code += `${indent}    if decoder.peek_uint8() == ${terminator}:\n`;
    code += `${indent}        decoder.read_uint8()  # consume terminator\n`;
    code += `${indent}        break\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (kind === "eof_terminated") {
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while decoder.has_more():\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (field.length !== undefined) {
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for ${iVar} in range(${field.length}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else if (field.length_field) {
    code += `${indent}${countVar} = ${pyFieldAccessWithRootFallback(field.length_field)}\n`;
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}for ${iVar} in range(${countVar}):\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  } else {
    code += `${indent}${fieldAssign} = []\n`;
    code += `${indent}while decoder.has_more():\n`;
    code += generateArrayItemDecode(items, fieldAssign, itemVar, indent + '    ', endianness, schema, bitOrder);
  }

  return code;
}

function generateArrayItemDecode(items: any, arrayVar: string, itemVar: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string): string {
  let code = '';

  if (items && typeof items === 'object' && items.type) {
    const itemField = { ...items, name: undefined };
    code += generateFieldDecode(itemField, itemVar, indent, endianness, schema, bitOrder);
    code += `${indent}${arrayVar}.append(${itemVar})\n`;
  } else if (typeof items === 'string') {
    code += generateFieldDecode({ type: items, name: undefined }, itemVar, indent, endianness, schema, bitOrder);
    code += `${indent}${arrayVar}.append(${itemVar})\n`;
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

function generateDiscriminatedUnionDecode(field: any, fieldAssign: string, indent: string, endianness: string, schema: BinarySchema, bitOrder: string, resultPath?: string): string {
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
  } else if (field.discriminator?.field) {
    // Discriminator references a previously decoded field
    const discField = field.discriminator.field;
    const rp = resultPath || 'result';
    code += `${indent}_disc_val = ${pyFieldAccessWithRootFallback(discField)}\n`;
  }

  // Check if variants use `when` conditions or `value` matching
  const usesWhen = variants.some((v: any) => v.when);

  if (usesWhen) {
    // When-based matching: convert `when` expressions to Python
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const cond = i === 0 ? 'if' : 'elif';
      if (variant.when) {
        // Convert "value === 0xFF" style to Python
        let pyWhen = variant.when
          .replace(/\bvalue\b/g, '_disc_val')
          .replace(/===/g, '==')
          .replace(/!==/g, '!=')
          .replace(/&&/g, ' and ')
          .replace(/\|\|/g, ' or ');
        code += `${indent}${cond} ${pyWhen}:\n`;
      } else {
        code += `${indent}${cond} True:\n`;
      }
      code += `${indent}    ${fieldAssign} = {"type": "${variant.type}", "value": decode_${toSnakeCase(variant.type)}(decoder, _root)}\n`;
    }
  } else {
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const discValue = variant.value !== undefined ? variant.value : i;
      const cond = i === 0 ? 'if' : 'elif';
      code += `${indent}${cond} _disc_val == ${discValue}:\n`;
      code += `${indent}    ${fieldAssign} = {"type": "${variant.type}", "value": decode_${toSnakeCase(variant.type)}(decoder, _root)}\n`;
    }
    code += `${indent}else:\n`;
    code += `${indent}    raise ValueError(f"Unknown discriminator value: {_disc_val}")\n`;
  }

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
    code += `${indent}    _choice_result = decode_${toSnakeCase(choice.type)}(decoder, _root)\n`;
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
  code += `${indent}    pass  # Field not present - omit from result\n`;

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
    code += `${indent}${fieldAssign} = decode_${toSnakeCase(field.type)}(decoder, _root)\n`;
  } else if ((typeDef as any).type === 'string') {
    code += generateStringDecode(typeDef as any, fieldAssign, '', indent, endianness);
  } else if ((typeDef as any).type === 'array') {
    code += generateArrayDecode(typeDef as any, fieldAssign, '', indent, endianness, schema, bitOrder);
  } else if ((typeDef as any).type === 'discriminated_union') {
    // Discriminated union - inline decode
    code += generateDiscriminatedUnionDecode(typeDef as any, fieldAssign, indent, endianness, schema, bitOrder, '');
  } else if ((typeDef as any).type === 'choice') {
    code += generateChoiceDecode(typeDef as any, fieldAssign, indent, endianness, schema, bitOrder);
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
  lines.push(`from ${runtimeModule} import BitStreamEncoder, BitStreamDecoder, SeekableBitStreamDecoder, compute_crc32`);
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
  _varCounter = 0; // Reset counter for each struct
  const lines: string[] = [];
  const className = toPascalCase(name);
  const fields = typeDef.sequence || [];

  // Encoder class
  lines.push(`class ${className}Encoder(BitStreamEncoder):`);
  lines.push(`    def __init__(self):`);
  lines.push(`        super().__init__("${bitOrder}")`);
  lines.push(``);
  lines.push(`    def encode(self, value: dict[str, Any], _parent_value: dict[str, Any] | None = None) -> bytes:`);
  lines.push(`        encoder = BitStreamEncoder("${bitOrder}")`);

  // Validate: error if user provides computed fields
  const computedFields = fields.filter((f: any) => f.computed);
  if (computedFields.length > 0) {
    for (const cf of computedFields) {
      lines.push(`        if "${cf.name}" in value:`);
      lines.push(`            raise ValueError("Field '${cf.name}' is computed and cannot be set manually")`);
    }
  }

  // Check for from_after_field - these need content-first encoding
  const fromAfterFields = fields.filter((f: any) => f.computed?.type === "length_of" && f.computed.from_after_field);

  // Track which fields are consumed by from_after_field content-first encoding
  const consumedByFromAfter = new Set<string>();
  for (const faf of fromAfterFields) {
    const fromAfterIdx = fields.findIndex((f: any) => f.name === faf.computed.from_after_field);
    if (fromAfterIdx >= 0) {
      for (let i = fromAfterIdx + 1; i < fields.length; i++) {
        const f = fields[i] as any;
        if (f.name && f.name !== faf.name) {
          consumedByFromAfter.add(f.name);
        }
      }
    }
  }

  // Collect position_of and crc32_of fields for back-patching
  const positionOfFields = fields.filter((f: any) => f.computed?.type === "position_of");
  const crc32OfFields = fields.filter((f: any) => f.computed?.type === "crc32_of");
  const needsFieldTracking = positionOfFields.length > 0 || crc32OfFields.length > 0;

  // Generate encoding for each field
  for (const field of fields) {
    const fieldAny = field as any;

    // Skip fields consumed by from_after_field (they'll be encoded in content-first block)
    if (consumedByFromAfter.has(fieldAny.name)) continue;

    // Track field byte offsets for position_of / crc32_of back-patching
    if (needsFieldTracking && fieldAny.name) {
      lines.push(`        _field_offset_${fieldAny.name} = encoder.byte_offset`);
    }

    // Handle from_after_field length computed fields specially
    if (fieldAny.computed?.type === "length_of" && fieldAny.computed.from_after_field) {
      const fromAfterFieldName = fieldAny.computed.from_after_field;
      const fromAfterIdx = fields.findIndex((f: any) => f.name === fromAfterFieldName);
      const fieldsAfter = fields.slice(fromAfterIdx + 1).filter((f: any) => (f as any).name !== fieldAny.name);

      lines.push(`        # Content-first encoding for from_after_field`);
      lines.push(`        _content_pieces = []`);
      lines.push(`        _total_content_length = 0`);

      for (const afterField of fieldsAfter) {
        const af = afterField as any;
        lines.push(`        _temp_enc = BitStreamEncoder("${bitOrder}")`);
        // Generate the field encode code but targeting _temp_enc instead of encoder
        const fieldCode = generateFieldEncode(af, 'value', '        ', endianness, schema, bitOrder);
        lines.push(fieldCode.replace(/\bencoder\b/g, '_temp_enc'));
        lines.push(`        _piece = _temp_enc.finish()`);
        lines.push(`        _content_pieces.append(_piece)`);
        lines.push(`        _total_content_length += len(_piece)`);
      }

      // Write the computed length
      const e = fieldAny.endianness || endianness;
      lines.push(generateComputedWrite(fieldAny.type, '_total_content_length', '        ', e));

      // Write the content pieces
      lines.push(`        for _piece in _content_pieces:`);
      lines.push(`            encoder.write_bytes(_piece)`);
      continue;
    }

    lines.push(generateFieldEncode(field, 'value', '        ', endianness, schema, bitOrder));
  }

  // Mark end of encoding for field offset tracking
  if (needsFieldTracking) {
    lines.push(`        _field_offset__end = encoder.byte_offset`);
  }

  // Back-patch position_of fields
  for (const pf of positionOfFields) {
    const pfAny = pf as any;
    const target = pfAny.computed.target;
    const e = pfAny.endianness || endianness;
    const alignment = pfAny.computed.alignment || 1;

    // Skip parent references (../field) - these can't be back-patched within this encoder
    if (target.includes('/')) continue;

    lines.push(`        # Back-patch position_of ${target}`);
    if (alignment > 1) {
      lines.push(`        _target_pos = _field_offset_${target}`);
      lines.push(`        _target_pos = _target_pos + (${alignment} - (_target_pos % ${alignment})) % ${alignment}`);
    } else {
      lines.push(`        _target_pos = _field_offset_${target}`);
    }
    lines.push(generatePatchCall(pfAny.type, `_pos_${pfAny.name}`, '_target_pos', '        ', e));
  }

  // Back-patch crc32_of fields
  for (const cf of crc32OfFields) {
    const cfAny = cf as any;
    const target = cfAny.computed.target;
    const e = cfAny.endianness || endianness;

    // Skip parent references (../field) - these can't be back-patched within this encoder
    if (target.includes('/')) continue;

    // Find the field after target to know where target bytes end
    const targetIdx = fields.findIndex((f: any) => f.name === target);
    const nextFieldWithName = fields.slice(targetIdx + 1).find((f: any) => (f as any).name);

    lines.push(`        # Back-patch crc32_of ${target}`);
    lines.push(`        _crc_start = _field_offset_${target}`);
    if (nextFieldWithName) {
      lines.push(`        _crc_end = _field_offset_${(nextFieldWithName as any).name}`);
    } else {
      lines.push(`        _crc_end = encoder.byte_offset`);
    }
    lines.push(`        _crc_data = bytes(encoder._bytes[_crc_start:_crc_end])`);
    lines.push(`        _crc_val = compute_crc32(_crc_data)`);
    lines.push(generatePatchCall(cfAny.type, `_crc_pos_${cfAny.name}`, '_crc_val', '        ', e));
  }

  lines.push(`        return encoder.finish()`);
  lines.push(``);

  // Decode function
  // Optional _root parameter lets nested instance fields resolve "_root.X"
  // paths to the top-level decoded result. When called from a top-level
  // decoder, _root defaults to the result of this very call.
  const instances = (typeDef.instances || []) as any[];
  const hasInstances = instances.length > 0;

  lines.push(``);
  lines.push(`def decode_${toSnakeCase(name)}(decoder: BitStreamDecoder, _root: dict[str, Any] | None = None) -> dict[str, Any]:`);
  lines.push(`    result: dict[str, Any] = {}`);
  // If we're the top of a decode (no _root passed), make `result` itself the
  // root. Subsequent field lookups can fall back to _root when a referenced
  // field doesn't live in the local scope.
  lines.push(`    if _root is None:`);
  lines.push(`        _root = result`);

  for (const field of fields) {
    lines.push(generateFieldDecode(field, 'result', '    ', endianness, schema, bitOrder));
  }

  // Decode instance (random-access) fields
  if (hasInstances) {
    lines.push(`    # Decode instance fields (position-based, random access)`);
    lines.push(`    _saved_pos = decoder.position`);
    for (const inst of instances) {
      lines.push(...generateInstanceDecode(inst, schema, '    '));
    }
    lines.push(`    decoder.seek(_saved_pos)`);
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

/**
 * Generate Python code that decodes a single instance (random-access lazy field)
 * after the sequence has been decoded. Seeks the decoder to the resolved
 * position, optionally validates alignment, decodes the typed payload, and
 * stores it under result[instance.name].
 *
 * The schema instance shape:
 *   { name, type, position: number | string, alignment?: number, description? }
 *
 * `position` may be:
 *   - a literal number (positive = absolute, negative = from EOF)
 *   - a field name reachable from `result` ("data_offset", "header.offset")
 *   - a "_root."-prefixed path resolved against `_root`
 */
function generateInstanceDecode(inst: any, schema: BinarySchema, indent: string): string[] {
  const lines: string[] = [];
  const name = inst.name;
  const position = inst.position;
  const alignment = inst.alignment;
  const instType = inst.type;

  // 1. Resolve position into a local _pos variable
  if (typeof position === 'number') {
    if (position < 0) {
      lines.push(`${indent}_pos = len(decoder._bytes) + (${position})`);
    } else {
      lines.push(`${indent}_pos = ${position}`);
    }
  } else if (typeof position === 'string') {
    lines.push(`${indent}_pos = ${pyPositionPath(position)}`);
    lines.push(`${indent}if not isinstance(_pos, int):`);
    lines.push(`${indent}    raise RuntimeError(f"Instance '${name}' position field '${position}' is not numeric (got {type(_pos).__name__})")`);
  } else {
    throw new Error(`Unsupported instance position type for '${name}': ${JSON.stringify(position)}`);
  }

  // 2. Alignment validation
  if (alignment && alignment > 1) {
    lines.push(`${indent}if _pos % ${alignment} != 0:`);
    lines.push(`${indent}    raise RuntimeError(f"Instance '${name}' position {_pos} not aligned to ${alignment} bytes")`);
  }

  // 3. Seek and decode
  lines.push(`${indent}decoder.seek(_pos)`);

  if (typeof instType === 'string') {
    // Simple type reference - dispatch to its decoder
    lines.push(`${indent}result["${name}"] = decode_${toSnakeCase(instType)}(decoder, _root)`);
  } else if (instType && typeof instType === 'object' && instType.discriminator && Array.isArray(instType.variants)) {
    // Inline discriminated union
    const union = instType;
    // Resolve discriminator value
    if (union.discriminator.field) {
      lines.push(`${indent}_disc = ${pyPositionPath(union.discriminator.field)}`);
    } else if (union.discriminator.peek) {
      const peekType = union.discriminator.peek;
      const peekEnd = union.discriminator.endianness || 'little_endian';
      if (peekType === 'uint8') {
        lines.push(`${indent}_disc = decoder.peek_uint8()`);
      } else if (peekType === 'uint16') {
        lines.push(`${indent}_disc = decoder.peek_uint16("${peekEnd}")`);
      } else if (peekType === 'uint32') {
        lines.push(`${indent}_disc = decoder.peek_uint32("${peekEnd}")`);
      } else {
        throw new Error(`Unsupported peek discriminator type: ${peekType}`);
      }
    } else {
      throw new Error(`Inline DU instance '${name}' has no discriminator field/peek`);
    }
    let first = true;
    let hasFallback = false;
    for (const variant of union.variants) {
      if (!variant.when) {
        // Fallback
        lines.push(`${indent}else:`);
        lines.push(`${indent}    result["${name}"] = {"type": "${variant.type}", "value": decode_${toSnakeCase(variant.type)}(decoder, _root)}`);
        hasFallback = true;
        continue;
      }
      const cond = String(variant.when).replace(/\bvalue\b/g, '_disc');
      lines.push(`${indent}${first ? 'if' : 'elif'} (${cond}):`);
      lines.push(`${indent}    result["${name}"] = {"type": "${variant.type}", "value": decode_${toSnakeCase(variant.type)}(decoder, _root)}`);
      first = false;
    }
    if (!hasFallback) {
      lines.push(`${indent}else:`);
      lines.push(`${indent}    raise RuntimeError(f"Unknown discriminator value {_disc} for instance '${name}'")`);
    }
  } else {
    throw new Error(`Unsupported instance type for '${name}': ${JSON.stringify(instType)}`);
  }

  return lines;
}

/**
 * Convert a dotted schema path like "data_offset", "header.offset",
 * "_root.file_header.offset" into a Python expression that resolves against
 * either `result` (local fields) or `_root` (top-level fields).
 */
function pyPositionPath(path: string): string {
  const parts = path.split('.');
  let root: string;
  let rest: string[];
  if (parts[0] === '_root') {
    root = '_root';
    rest = parts.slice(1);
  } else {
    root = 'result';
    rest = parts;
  }
  return root + rest.map(p => `[${JSON.stringify(p)}]`).join('');
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

  // Standalone decode function (so instance/nested call sites can use
  // `decode_<name>(decoder, _root)` uniformly, matching the convention for
  // struct types). The DU decode helper assigns its `{type, value}` dict
  // to the LHS we pass — here `result`, which we then return.
  lines.push(`def decode_${toSnakeCase(name)}(decoder: BitStreamDecoder, _root: dict[str, Any] | None = None) -> dict[str, Any]:`);
  lines.push(`    result: dict[str, Any] = {}`);
  lines.push(generateDiscriminatedUnionDecode(typeDef, 'result', '    ', endianness, schema, bitOrder));
  lines.push(`    return result`);
  lines.push(``);

  // Decoder
  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "${bitOrder}")`);
  lines.push(``);
  lines.push(`    def decode(self) -> dict[str, Any]:`);
  lines.push(`        return decode_${toSnakeCase(name)}(self)`);

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

  // Standalone decode function so DU/choice/instance call sites can use the
  // uniform `decode_<name>(decoder, _root)` convention.
  lines.push(`def decode_${toSnakeCase(name)}(decoder: BitStreamDecoder, _root: dict[str, Any] | None = None) -> str:`);
  lines.push(`    result = ""`);
  lines.push(generateStringDecode(typeDef, 'result', '', '    ', endianness));
  lines.push(`    return result`);
  lines.push(``);

  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "msb_first")`);
  lines.push(``);
  lines.push(`    def decode(self) -> str:`);
  lines.push(`        return decode_${toSnakeCase(name)}(self)`);

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

  // Standalone decode function so DU/choice/instance call sites can use the
  // uniform `decode_<name>(decoder, _root)` convention.
  lines.push(`def decode_${toSnakeCase(name)}(decoder: BitStreamDecoder, _root: dict[str, Any] | None = None) -> list:`);
  lines.push(`    result: list = []`);
  lines.push(generateArrayDecode(typeDef, 'result', '', '    ', endianness, schema, bitOrder));
  lines.push(`    return result`);
  lines.push(``);

  lines.push(`class ${className}Decoder(SeekableBitStreamDecoder):`);
  lines.push(`    def __init__(self, data: bytes | bytearray | list[int]):`);
  lines.push(`        super().__init__(data, "${bitOrder}")`);
  lines.push(``);
  lines.push(`    def decode(self) -> list:`);
  lines.push(`        return decode_${toSnakeCase(name)}(self)`);

  return lines;
}
