/**
 * String encoding and decoding support.
 * Handles various string kinds: fixed, length_prefixed, null_terminated, field_referenced.
 * Supports encodings: utf8, ascii, latin1, utf16.
 */

import { Endianness } from "../../schema/binary-schema.js";
import { ARRAY_ITER_SUFFIX } from "./shared.js";

/**
 * Resolve the effective endianness for a string field.
 * UTF-16 strings use field-level endianness if specified, otherwise global.
 */
function resolveStringEndianness(field: any, globalEndianness: Endianness): Endianness {
  return field.endianness || globalEndianness;
}

/**
 * Generate encoding code for string field (class-based style).
 * Supports fixed, length_prefixed, null_terminated, and field_referenced strings.
 */
export function generateEncodeString(
  field: any,
  globalEndianness: Endianness,
  valuePath: string,
  indent: string
): string {
  const encoding = field.encoding || "utf8";
  const endianness = resolveStringEndianness(field, globalEndianness);
  let kind = field.kind;
  let code = "";

  // Auto-detect field_referenced: if kind is "fixed" but length_field exists, treat as field_referenced
  if (kind === "fixed" && field.length_field && !field.length) {
    kind = "field_referenced";
  }

  // Sanitize variable name (replace dots with underscores)
  // If valuePath is a string literal (e.g., JSON.stringify("SIZE")), use the field name for the variable
  const isLiteral = valuePath.startsWith('"') || valuePath.startsWith("'");
  const bytesVarName = isLiteral
    ? `${(field.name || "const_str").replace(/\./g, "_")}_bytes`
    : valuePath.replace(/\./g, "_") + "_bytes";

  // Convert string to bytes
  if (encoding === "utf16") {
    // UTF-16: convert to array of bytes (2 per code unit) with endianness
    const unitsVarName = bytesVarName.replace(/_bytes$/, "_units");
    code += `${indent}const ${unitsVarName}: number[] = [];\n`;
    code += `${indent}for (let i = 0; i < ${valuePath}.length; i++) {\n`;
    code += `${indent}  ${unitsVarName}.push(${valuePath}.charCodeAt(i));\n`;
    code += `${indent}}\n`;
    // Convert code units to bytes with endianness
    code += `${indent}const ${bytesVarName}: number[] = [];\n`;
    code += `${indent}for (const cu of ${unitsVarName}) {\n`;
    if (endianness === "big_endian") {
      code += `${indent}  ${bytesVarName}.push((cu >> 8) & 0xFF, cu & 0xFF);\n`;
    } else {
      code += `${indent}  ${bytesVarName}.push(cu & 0xFF, (cu >> 8) & 0xFF);\n`;
    }
    code += `${indent}}\n`;
  } else if (encoding === "utf8") {
    code += `${indent}const ${bytesVarName} = new TextEncoder().encode(${valuePath});\n`;
  } else if (encoding === "ascii" || encoding === "latin1") {
    // ASCII and Latin-1 both use direct byte mapping (charCodeAt gives codepoint, which equals byte value for 0-255)
    code += `${indent}const ${bytesVarName} = Array.from(${valuePath}, c => c.charCodeAt(0));\n`;
  }

  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    // Write length prefix (always byte count, even for UTF-16)
    switch (lengthType) {
      case "uint8":
        code += `${indent}this.writeUint8(${bytesVarName}.length);\n`;
        break;
      case "uint16":
        code += `${indent}this.writeUint16(${bytesVarName}.length, "${globalEndianness}");\n`;
        break;
      case "uint32":
        code += `${indent}this.writeUint32(${bytesVarName}.length, "${globalEndianness}");\n`;
        break;
      case "uint64":
        code += `${indent}this.writeUint64(BigInt(${bytesVarName}.length), "${globalEndianness}");\n`;
        break;
    }
    // Write bytes
    code += `${indent}for (const byte of ${bytesVarName}) {\n`;
    code += `${indent}  this.writeUint8(byte);\n`;
    code += `${indent}}\n`;
  } else if (kind === "null_terminated") {
    // Write bytes
    code += `${indent}for (const byte of ${bytesVarName}) {\n`;
    code += `${indent}  this.writeUint8(byte);\n`;
    code += `${indent}}\n`;
    // Write null terminator (2 bytes for UTF-16, 1 byte for others)
    if (encoding === "utf16") {
      code += `${indent}this.writeUint8(0);\n`;
      code += `${indent}this.writeUint8(0);\n`;
    } else {
      code += `${indent}this.writeUint8(0);\n`;
    }
  } else if (kind === "fixed") {
    const fixedLength = field.length || 0;
    // Write bytes (padded or truncated to fixed length)
    code += `${indent}for (let i = 0; i < ${fixedLength}; i++) {\n`;
    code += `${indent}  this.writeUint8(i < ${bytesVarName}.length ? ${bytesVarName}[i] : 0);\n`;
    code += `${indent}}\n`;
  } else if (kind === "field_referenced") {
    // Length comes from another field, we just write the bytes (length was already written)
    code += `${indent}for (const byte of ${bytesVarName}) {\n`;
    code += `${indent}  this.writeUint8(byte);\n`;
    code += `${indent}}\n`;
  }

  return code;
}

/**
 * Generate decoding code for string field (class-based style).
 * Supports fixed, length_prefixed, null_terminated, and field_referenced strings.
 */
export function generateDecodeString(
  field: any,
  globalEndianness: Endianness,
  fieldName: string,
  indent: string,
  addTraceLogs: boolean,
  getTargetPath: (fieldName: string) => string
): string {
  const encoding = field.encoding || "utf8";
  const endianness = resolveStringEndianness(field, globalEndianness);
  let kind = field.kind;
  const target = getTargetPath(fieldName);
  let code = "";

  if (addTraceLogs) {
    code += `${indent}console.log('[TRACE] Decoding string field ${fieldName}, kind: ${kind}, length_field: ${field.length_field}, length: ${field.length}');\n`;
  }

  // Auto-detect field_referenced: if kind is "fixed" but length_field exists, treat as field_referenced
  if (kind === "fixed" && field.length_field && !field.length) {
    kind = "field_referenced";
    if (addTraceLogs) {
      code += `${indent}console.log('[TRACE] Auto-detected field_referenced string for ${fieldName}');\n`;
    }
  }

  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
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

    // Read length
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";
    code += `${indent}const ${lengthVarName} = ${lengthRead};\n`;

    // Read bytes (bulk read)
    const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
    code += `${indent}const ${bytesVarName} = this.readBytesSlice(${lengthVarName});\n`;

    // Convert bytes to string
    code += generateBytesToString(encoding, endianness, bytesVarName, target, indent);
  } else if (kind === "null_terminated") {
    if (encoding === "utf16") {
      // UTF-16 null terminator is two zero bytes (0x0000 code unit)
      const unitsVarName = fieldName.replace(/\./g, "_") + "_units";
      code += `${indent}const ${unitsVarName}: number[] = [];\n`;
      code += `${indent}while (true) {\n`;
      if (endianness === "big_endian") {
        code += `${indent}  const hi = this.readUint8();\n`;
        code += `${indent}  const lo = this.readUint8();\n`;
        code += `${indent}  const codeUnit = (hi << 8) | lo;\n`;
      } else {
        code += `${indent}  const lo = this.readUint8();\n`;
        code += `${indent}  const hi = this.readUint8();\n`;
        code += `${indent}  const codeUnit = (hi << 8) | lo;\n`;
      }
      code += `${indent}  if (codeUnit === 0) break;\n`;
      code += `${indent}  ${unitsVarName}.push(codeUnit);\n`;
      code += `${indent}}\n`;
      code += `${indent}${target} = String.fromCharCode(...${unitsVarName});\n`;
    } else {
      // Single-byte null terminator
      const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
      code += `${indent}const ${bytesVarName}: number[] = [];\n`;
      code += `${indent}while (true) {\n`;
      code += `${indent}  const byte = this.readUint8();\n`;
      code += `${indent}  if (byte === 0) break;\n`;
      code += `${indent}  ${bytesVarName}.push(byte);\n`;
      code += `${indent}}\n`;

      // Convert bytes to string
      if (encoding === "utf8") {
        code += `${indent}${target} = new TextDecoder().decode(new Uint8Array(${bytesVarName}));\n`;
      } else if (encoding === "ascii" || encoding === "latin1") {
        code += `${indent}${target} = String.fromCharCode(...${bytesVarName});\n`;
      }
    }
  } else if (kind === "fixed") {
    const fixedLength = field.length || 0;

    // Read fixed number of bytes (bulk read)
    const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
    code += `${indent}const ${bytesVarName} = this.readBytesSlice(${fixedLength});\n`;

    if (encoding === "utf16") {
      // UTF-16: find actual string length by looking for null code unit (two zero bytes)
      const unitsVarName = fieldName.replace(/\./g, "_") + "_units";
      code += `${indent}const ${unitsVarName}: number[] = [];\n`;
      code += `${indent}for (let i = 0; i + 1 < ${bytesVarName}.length; i += 2) {\n`;
      if (endianness === "big_endian") {
        code += `${indent}  const codeUnit = (${bytesVarName}[i] << 8) | ${bytesVarName}[i + 1];\n`;
      } else {
        code += `${indent}  const codeUnit = (${bytesVarName}[i + 1] << 8) | ${bytesVarName}[i];\n`;
      }
      code += `${indent}  if (codeUnit === 0) break;\n`;
      code += `${indent}  ${unitsVarName}.push(codeUnit);\n`;
      code += `${indent}}\n`;
      code += `${indent}${target} = String.fromCharCode(...${unitsVarName});\n`;
    } else {
      // Find actual string length (before first null byte)
      code += `${indent}let actualLength = ${bytesVarName}.indexOf(0);\n`;
      code += `${indent}if (actualLength === -1) actualLength = ${bytesVarName}.length;\n`;

      // Convert bytes to string (only up to first null)
      if (encoding === "utf8") {
        code += `${indent}${target} = new TextDecoder().decode(${bytesVarName}.subarray(0, actualLength));\n`;
      } else if (encoding === "ascii" || encoding === "latin1") {
        code += `${indent}${target} = String.fromCharCode(...${bytesVarName}.subarray(0, actualLength));\n`;
      }
    }
  } else if (kind === "field_referenced") {
    // Length comes from a previously-decoded field
    const lengthField = field.length_field;
    const lengthVarName = fieldName.replace(/\./g, "_") + "_length";

    // Resolve the length field (same logic as field_referenced arrays)
    if (lengthField.startsWith('_root.')) {
      // Reference to root object - access via context._root
      const rootPath = lengthField.substring(6); // Remove "_root."
      code += `${indent}const ${lengthVarName} = this.context?._root?.${rootPath};\n`;
      code += `${indent}if (${lengthVarName} === undefined) {\n`;
      code += `${indent}  throw new Error('Field-referenced string length field "${lengthField}" not found in context._root');\n`;
      code += `${indent}}\n`;
    } else {
      // Regular field reference - need to account for inline type decoding and array items
      // If fieldName is "local_file.filename", lengthField should be resolved relative to "local_file"
      // If fieldName is "entries__iter.filename", use "entries__iter" directly (no "value." prefix)
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
      code += `${indent}  throw new Error('Field-referenced string length field "${lengthField}" not found in value or context');\n`;
      code += `${indent}}\n`;
    }

    // Read bytes (bulk read)
    const bytesVarName = fieldName.replace(/\./g, "_") + "_bytes";
    code += `${indent}const ${bytesVarName} = this.readBytesSlice(${lengthVarName});\n`;

    // Convert bytes to string
    code += generateBytesToString(encoding, endianness, bytesVarName, target, indent);
  }

  return code;
}

/**
 * Helper: generate code to convert a byte array variable to a string,
 * handling all encoding types including UTF-16.
 */
function generateBytesToString(
  encoding: string,
  endianness: Endianness,
  bytesVarName: string,
  target: string,
  indent: string
): string {
  let code = "";
  if (encoding === "utf16") {
    const unitsVarName = bytesVarName.replace(/_bytes$/, "_units");
    code += `${indent}const ${unitsVarName}: number[] = [];\n`;
    code += `${indent}for (let i = 0; i + 1 < ${bytesVarName}.length; i += 2) {\n`;
    if (endianness === "big_endian") {
      code += `${indent}  ${unitsVarName}.push((${bytesVarName}[i] << 8) | ${bytesVarName}[i + 1]);\n`;
    } else {
      code += `${indent}  ${unitsVarName}.push((${bytesVarName}[i + 1] << 8) | ${bytesVarName}[i]);\n`;
    }
    code += `${indent}}\n`;
    code += `${indent}${target} = String.fromCharCode(...${unitsVarName});\n`;
  } else if (encoding === "utf8") {
    code += `${indent}${target} = new TextDecoder().decode(${bytesVarName});\n`;
  } else if (encoding === "ascii" || encoding === "latin1") {
    code += `${indent}${target} = String.fromCharCode(...${bytesVarName});\n`;
  }
  return code;
}
