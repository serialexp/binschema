// ABOUTME: Generates Rust encoder/decoder code from BinSchema definitions
// ABOUTME: Produces byte-for-byte compatible code with TypeScript and Go runtimes

import type { BinarySchema, Field, Endianness } from "../schema/binary-schema.js";

/**
 * Options for Rust code generation
 */
export interface RustGeneratorOptions {
  crateName?: string; // default: "binschema_runtime"
}

/**
 * Generated Rust code result
 */
export interface GeneratedRustCode {
  code: string;
  typeName: string;
}

/**
 * Generates Rust encoder/decoder code from a binary schema.
 *
 * Produces:
 * - Struct definition with public fields
 * - encode(&self) -> Vec<u8> method for serialization
 * - decode(bytes: &[u8]) -> Result<Self> associated function for deserialization
 *
 * @param schema - The binary schema definition
 * @param typeName - The type to generate code for
 * @param options - Optional generation options
 * @returns Generated Rust code
 */
export function generateRust(
  schema: BinarySchema,
  typeName: string,
  options?: RustGeneratorOptions
): GeneratedRustCode {
  const crateName = options?.crateName || "binschema_runtime";

  // Verify the requested type exists
  if (!schema.types[typeName]) {
    throw new Error(`Type ${typeName} not found in schema`);
  }

  const lines: string[] = [];

  // Determine default endianness and bit order
  const defaultEndianness = schema.config?.endianness || "big_endian";
  const defaultBitOrder = schema.config?.bit_order || "msb_first";

  // Use statement
  lines.push(`use ${crateName}::{BitStreamEncoder, BitStreamDecoder, Endianness, BitOrder, Result};`);
  lines.push(``);

  // Generate all types in the schema
  for (const [name, typeDef] of Object.entries(schema.types)) {
    // Check if this is a composite type (has sequence) or type alias
    if ("sequence" in typeDef) {
      // Composite type with fields
      lines.push(...generateStruct(name, typeDef.sequence));
      lines.push(...generateImpl(name, typeDef.sequence, defaultEndianness, defaultBitOrder));
    } else if ("type" in typeDef) {
      // Type alias - generate wrapper struct
      lines.push(...generateTypeAlias(name, typeDef as any, defaultEndianness, defaultBitOrder));
    } else if ("variants" in typeDef) {
      // Discriminated union - not yet implemented
      lines.push(`// TODO: Discriminated union type ${name} not yet implemented`);
      lines.push(``);
    } else {
      // Unknown type definition
      throw new Error(`Unknown type definition for ${name}: ${JSON.stringify(typeDef)}`);
    }
  }

  return {
    code: lines.join("\n"),
    typeName,
  };
}

/**
 * Generates a type alias as a wrapper struct
 */
function generateTypeAlias(name: string, typeDef: any, defaultEndianness: string, defaultBitOrder: string): string[] {
  const lines: string[] = [];

  // Create a wrapper struct with a single field "value"
  const field: Field = {
    name: "value",
    type: typeDef.type,
    ...typeDef
  };

  lines.push(...generateStruct(name, [field]));
  lines.push(...generateImpl(name, [field], defaultEndianness, defaultBitOrder));

  return lines;
}

/**
 * Generates a Rust struct definition
 */
function generateStruct(name: string, fields: Field[]): string[] {
  const lines: string[] = [];

  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub struct ${name} {`);

  for (const field of fields) {
    // Skip fields without names (e.g., conditional fields)
    // Skip fields without types (e.g., conditional markers)
    // Skip padding fields (computed at encode/decode time)
    if (!field.name || !field.type || field.type === "padding") {
      continue;
    }
    const rustType = mapFieldToRustType(field);
    const fieldName = toRustFieldName(field.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates an impl block with encode and decode methods
 */
function generateImpl(name: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string): string[] {
  const lines: string[] = [];

  lines.push(`impl ${name} {`);

  // Generate encode method
  lines.push(...generateEncodeMethod(fields, defaultEndianness, defaultBitOrder));

  // Generate decode methods
  lines.push(...generateDecodeMethod(name, fields, defaultEndianness, defaultBitOrder));

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates the encode method
 */
function generateEncodeMethod(fields: Field[], defaultEndianness: string, defaultBitOrder: string): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  lines.push(`    pub fn encode(&self) -> Vec<u8> {`);
  lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);

  // Generate encoding logic for each field
  // Note: We only encode NAMED fields - unnamed fields (const, padding) aren't in the struct
  for (const field of fields) {
    // Skip fields without names - they're not in the struct
    if (!field.name) {
      continue;
    }
    lines.push(...generateEncodeField(field, defaultEndianness, "        "));
  }

  lines.push(`        encoder.finish()`);
  lines.push(`    }`);
  lines.push(``);

  return lines;
}

/**
 * Generates the decode methods
 */
function generateDecodeMethod(name: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Public decode function
  lines.push(`    pub fn decode(bytes: &[u8]) -> Result<Self> {`);
  lines.push(`        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::${bitOrder});`);
  lines.push(`        Self::decode_with_decoder(&mut decoder)`);
  lines.push(`    }`);
  lines.push(``);

  // Helper function that accepts an existing decoder (for nested structs)
  lines.push(`    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {`);

  // Generate decoding logic for each field
  // Note: We decode ALL fields (including unnamed) because they may be referenced
  // by other fields (e.g., as length_field for arrays)
  for (const field of fields) {
    lines.push(...generateDecodeField(field, defaultEndianness, "        "));
  }

  // Construct the result - only include named, non-padding fields in the struct
  lines.push(`        Ok(Self {`);
  for (const field of fields) {
    // Skip fields without names or without types
    // Skip padding fields
    if (!field.name || !field.type || field.type === "padding") {
      continue;
    }
    const fieldName = toRustFieldName(field.name);
    lines.push(`            ${fieldName},`);
  }
  lines.push(`        })`);
  lines.push(`    }`);

  return lines;
}

/**
 * Generates encoding code for a single field
 */
function generateEncodeField(field: Field, defaultEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const fieldName = `self.${toRustFieldName(field.name)}`;
  const endianness = (field as any).endianness || defaultEndianness;
  const rustEndianness = mapEndianness(endianness);

  // Skip fields without a type (e.g., conditional markers)
  if (!field.type) {
    return lines;
  }

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.write_uint8(${fieldName});`);
      break;

    case "uint16":
      lines.push(`${indent}encoder.write_uint16(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "uint32":
      lines.push(`${indent}encoder.write_uint32(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "uint64":
      lines.push(`${indent}encoder.write_uint64(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "int8":
      lines.push(`${indent}encoder.write_int8(${fieldName});`);
      break;

    case "int16":
      lines.push(`${indent}encoder.write_int16(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "int32":
      lines.push(`${indent}encoder.write_int32(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "int64":
      lines.push(`${indent}encoder.write_int64(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "float32":
      lines.push(`${indent}encoder.write_float32(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "float64":
      lines.push(`${indent}encoder.write_float64(${fieldName}, Endianness::${rustEndianness});`);
      break;

    case "bit":
    case "int": {
      // Bitfield - write individual bits
      const bitSize = (field as any).size || 1;
      lines.push(`${indent}encoder.write_bits(${fieldName} as u64, ${bitSize});`);
      break;
    }

    case "varlength": {
      // Variable-length integer encoding (VLQ, LEB128, DER, etc.)
      const encoding = (field as any).encoding || "vlq";
      lines.push(`${indent}encoder.write_varlength(${fieldName}, "${encoding}");`);
      break;
    }

    case "bitfield": {
      // Bitfield - write as packed integer
      // TODO: Full bitfield support with sub-fields
      const bitSize = (field as any).size || 8;
      lines.push(`${indent}encoder.write_bits(${fieldName} as u64, ${bitSize});`);
      break;
    }

    case "string":
      lines.push(...generateEncodeString(field as any, fieldName, endianness, indent));
      break;

    case "array":
      lines.push(...generateEncodeArray(field as any, fieldName, endianness, rustEndianness, indent));
      break;

    case "optional":
      lines.push(...generateEncodeOptional(field as any, fieldName, endianness, indent));
      break;

    case "padding":
      // Padding fields are computed at encode time, skip for now
      // In a full implementation, we'd calculate alignment and write zeros
      break;

    default:
      // Type reference - nested struct
      lines.push(...generateEncodeNestedStruct(field, fieldName, indent));
      break;
  }

  return lines;
}

/**
 * Generates encoding code for string field
 */
function generateEncodeString(field: any, fieldName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const rustEndianness = mapEndianness(endianness);

  switch (kind) {
    case "length_prefixed": {
      const lengthType = field.length_type || "uint8";
      // Write length prefix
      switch (lengthType) {
        case "uint8":
          lines.push(`${indent}encoder.write_uint8(${fieldName}.len() as u8);`);
          break;
        case "uint16":
          lines.push(`${indent}encoder.write_uint16(${fieldName}.len() as u16, Endianness::${rustEndianness});`);
          break;
        case "uint32":
          lines.push(`${indent}encoder.write_uint32(${fieldName}.len() as u32, Endianness::${rustEndianness});`);
          break;
        case "uint64":
          lines.push(`${indent}encoder.write_uint64(${fieldName}.len() as u64, Endianness::${rustEndianness});`);
          break;
      }
      // Write bytes
      lines.push(`${indent}for b in ${fieldName}.as_bytes() {`);
      lines.push(`${indent}    encoder.write_uint8(*b);`);
      lines.push(`${indent}}`);
      break;
    }

    case "null_terminated":
      lines.push(`${indent}for b in ${fieldName}.as_bytes() {`);
      lines.push(`${indent}    encoder.write_uint8(*b);`);
      lines.push(`${indent}}`);
      lines.push(`${indent}encoder.write_uint8(0);`);
      break;

    case "fixed": {
      const length = field.length || 0;
      lines.push(`${indent}let bytes = ${fieldName}.as_bytes();`);
      lines.push(`${indent}for i in 0..${length} {`);
      lines.push(`${indent}    if i < bytes.len() {`);
      lines.push(`${indent}        encoder.write_uint8(bytes[i]);`);
      lines.push(`${indent}    } else {`);
      lines.push(`${indent}        encoder.write_uint8(0);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);
      break;
    }

    default:
      throw new Error(`Unknown string kind: ${kind}`);
  }

  return lines;
}

/**
 * Generates encoding code for array field
 */
function generateEncodeArray(field: any, fieldName: string, endianness: string, rustEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;

  // Write length prefix for length_prefixed arrays
  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}encoder.write_uint8(${fieldName}.len() as u8);`);
        break;
      case "uint16":
        lines.push(`${indent}encoder.write_uint16(${fieldName}.len() as u16, Endianness::${rustEndianness});`);
        break;
      case "uint32":
        lines.push(`${indent}encoder.write_uint32(${fieldName}.len() as u32, Endianness::${rustEndianness});`);
        break;
      case "uint64":
        lines.push(`${indent}encoder.write_uint64(${fieldName}.len() as u64, Endianness::${rustEndianness});`);
        break;
    }
  }

  // Generate loop for encoding items
  lines.push(`${indent}for item in &${fieldName} {`);

  const itemField: Field = {
    name: "",
    type: items.type,
    ...(items as any)
  };
  const innerLines = generateEncodeArrayItem(itemField, "item", endianness, `${indent}    `);
  lines.push(...innerLines);

  lines.push(`${indent}}`);

  // Write null terminator for null_terminated arrays
  if (kind === "null_terminated") {
    lines.push(`${indent}encoder.write_uint8(0);`);
  }

  return lines;
}

/**
 * Generates encoding code for a single array item
 */
function generateEncodeArrayItem(field: Field, itemVar: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const rustEndianness = mapEndianness(endianness);

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.write_uint8(*${itemVar});`);
      break;
    case "uint16":
      lines.push(`${indent}encoder.write_uint16(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "uint32":
      lines.push(`${indent}encoder.write_uint32(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "uint64":
      lines.push(`${indent}encoder.write_uint64(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "int8":
      lines.push(`${indent}encoder.write_int8(*${itemVar});`);
      break;
    case "int16":
      lines.push(`${indent}encoder.write_int16(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "int32":
      lines.push(`${indent}encoder.write_int32(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "int64":
      lines.push(`${indent}encoder.write_int64(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "float32":
      lines.push(`${indent}encoder.write_float32(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "float64":
      lines.push(`${indent}encoder.write_float64(*${itemVar}, Endianness::${rustEndianness});`);
      break;
    case "bit":
    case "int": {
      const bitSize = (field as any).size || 1;
      lines.push(`${indent}encoder.write_bits(*${itemVar} as u64, ${bitSize});`);
      break;
    }
    default:
      // Type reference - nested struct
      lines.push(`${indent}let bytes = ${itemVar}.encode();`);
      lines.push(`${indent}for b in bytes {`);
      lines.push(`${indent}    encoder.write_uint8(b);`);
      lines.push(`${indent}}`);
      break;
  }

  return lines;
}

/**
 * Generates encoding code for nested struct
 */
function generateEncodeNestedStruct(field: Field, fieldName: string, indent: string): string[] {
  const lines: string[] = [];

  lines.push(`${indent}let bytes = ${fieldName}.encode();`);
  lines.push(`${indent}for b in bytes {`);
  lines.push(`${indent}    encoder.write_uint8(b);`);
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates encoding code for optional field
 */
function generateEncodeOptional(field: any, fieldName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const valueType = field.value_type;
  const rustEndianness = mapEndianness(endianness);

  lines.push(`${indent}if let Some(v) = ${fieldName} {`);
  lines.push(`${indent}    encoder.write_uint8(1);`);

  // Encode the value based on its type
  switch (valueType) {
    case "uint8":
      lines.push(`${indent}    encoder.write_uint8(v);`);
      break;
    case "uint16":
      lines.push(`${indent}    encoder.write_uint16(v, Endianness::${rustEndianness});`);
      break;
    case "uint32":
      lines.push(`${indent}    encoder.write_uint32(v, Endianness::${rustEndianness});`);
      break;
    case "uint64":
      lines.push(`${indent}    encoder.write_uint64(v, Endianness::${rustEndianness});`);
      break;
    case "int8":
      lines.push(`${indent}    encoder.write_int8(v);`);
      break;
    case "int16":
      lines.push(`${indent}    encoder.write_int16(v, Endianness::${rustEndianness});`);
      break;
    case "int32":
      lines.push(`${indent}    encoder.write_int32(v, Endianness::${rustEndianness});`);
      break;
    case "int64":
      lines.push(`${indent}    encoder.write_int64(v, Endianness::${rustEndianness});`);
      break;
    case "float32":
      lines.push(`${indent}    encoder.write_float32(v, Endianness::${rustEndianness});`);
      break;
    case "float64":
      lines.push(`${indent}    encoder.write_float64(v, Endianness::${rustEndianness});`);
      break;
    case "string":
      // For strings in optional, we need to know the string kind
      // Default to null-terminated for simplicity
      lines.push(`${indent}    for b in v.as_bytes() {`);
      lines.push(`${indent}        encoder.write_uint8(*b);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    encoder.write_uint8(0);`);
      break;
    default:
      // Type reference - nested struct
      lines.push(`${indent}    let bytes = v.encode();`);
      lines.push(`${indent}    for b in bytes {`);
      lines.push(`${indent}        encoder.write_uint8(b);`);
      lines.push(`${indent}    }`);
      break;
  }

  lines.push(`${indent}} else {`);
  lines.push(`${indent}    encoder.write_uint8(0);`);
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates decoding code for a single field
 */
function generateDecodeField(field: Field, defaultEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const varName = toRustFieldName(field.name);
  const endianness = (field as any).endianness || defaultEndianness;
  const rustEndianness = mapEndianness(endianness);

  // Skip fields without a type (e.g., conditional markers)
  if (!field.type) {
    return lines;
  }

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}let ${varName} = decoder.read_uint8()?;`);
      break;

    case "uint16":
      lines.push(`${indent}let ${varName} = decoder.read_uint16(Endianness::${rustEndianness})?;`);
      break;

    case "uint32":
      lines.push(`${indent}let ${varName} = decoder.read_uint32(Endianness::${rustEndianness})?;`);
      break;

    case "uint64":
      lines.push(`${indent}let ${varName} = decoder.read_uint64(Endianness::${rustEndianness})?;`);
      break;

    case "int8":
      lines.push(`${indent}let ${varName} = decoder.read_int8()?;`);
      break;

    case "int16":
      lines.push(`${indent}let ${varName} = decoder.read_int16(Endianness::${rustEndianness})?;`);
      break;

    case "int32":
      lines.push(`${indent}let ${varName} = decoder.read_int32(Endianness::${rustEndianness})?;`);
      break;

    case "int64":
      lines.push(`${indent}let ${varName} = decoder.read_int64(Endianness::${rustEndianness})?;`);
      break;

    case "float32":
      lines.push(`${indent}let ${varName} = decoder.read_float32(Endianness::${rustEndianness})?;`);
      break;

    case "float64":
      lines.push(`${indent}let ${varName} = decoder.read_float64(Endianness::${rustEndianness})?;`);
      break;

    case "bit": {
      const bitSize = (field as any).size || 1;
      const rustType = mapFieldToRustType(field);
      lines.push(`${indent}let ${varName} = decoder.read_bits(${bitSize})? as ${rustType};`);
      break;
    }

    case "int": {
      const bitSize = (field as any).size || 8;
      const rustType = mapFieldToRustType(field);
      lines.push(`${indent}let ${varName} = decoder.read_bits(${bitSize})? as ${rustType};`);
      break;
    }

    case "varlength": {
      // Variable-length integer decoding (VLQ, LEB128, DER, etc.)
      const encoding = (field as any).encoding || "vlq";
      lines.push(`${indent}let ${varName} = decoder.read_varlength("${encoding}")?;`);
      break;
    }

    case "bitfield": {
      // Bitfield - read as packed integer
      // TODO: Full bitfield support with sub-fields
      const bitSize = (field as any).size || 8;
      const rustType = mapFieldToRustType(field);
      lines.push(`${indent}let ${varName} = decoder.read_bits(${bitSize})? as ${rustType};`);
      break;
    }

    case "string":
      lines.push(...generateDecodeString(field as any, varName, endianness, indent));
      break;

    case "array":
      lines.push(...generateDecodeArray(field as any, varName, endianness, rustEndianness, indent));
      break;

    case "optional":
      lines.push(...generateDecodeOptional(field as any, varName, endianness, indent));
      break;

    case "padding":
      // Padding fields are computed, skip decode for now
      // In a full implementation, we'd read and discard alignment bytes
      break;

    default:
      // Type reference - nested struct
      lines.push(...generateDecodeNestedStruct(field, varName, indent));
      break;
  }

  return lines;
}

/**
 * Generates decoding code for optional field
 */
function generateDecodeOptional(field: any, varName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const valueType = field.value_type;
  const rustEndianness = mapEndianness(endianness);

  lines.push(`${indent}let has_value = decoder.read_uint8()? != 0;`);
  lines.push(`${indent}let ${varName} = if has_value {`);

  // Decode the value based on its type
  switch (valueType) {
    case "uint8":
      lines.push(`${indent}    Some(decoder.read_uint8()?)`);
      break;
    case "uint16":
      lines.push(`${indent}    Some(decoder.read_uint16(Endianness::${rustEndianness})?)`);
      break;
    case "uint32":
      lines.push(`${indent}    Some(decoder.read_uint32(Endianness::${rustEndianness})?)`);
      break;
    case "uint64":
      lines.push(`${indent}    Some(decoder.read_uint64(Endianness::${rustEndianness})?)`);
      break;
    case "int8":
      lines.push(`${indent}    Some(decoder.read_int8()?)`);
      break;
    case "int16":
      lines.push(`${indent}    Some(decoder.read_int16(Endianness::${rustEndianness})?)`);
      break;
    case "int32":
      lines.push(`${indent}    Some(decoder.read_int32(Endianness::${rustEndianness})?)`);
      break;
    case "int64":
      lines.push(`${indent}    Some(decoder.read_int64(Endianness::${rustEndianness})?)`);
      break;
    case "float32":
      lines.push(`${indent}    Some(decoder.read_float32(Endianness::${rustEndianness})?)`);
      break;
    case "float64":
      lines.push(`${indent}    Some(decoder.read_float64(Endianness::${rustEndianness})?)`);
      break;
    case "string":
      // For strings in optional, decode as null-terminated
      lines.push(`${indent}    let mut bytes = Vec::new();`);
      lines.push(`${indent}    loop {`);
      lines.push(`${indent}        let b = decoder.read_uint8()?;`);
      lines.push(`${indent}        if b == 0 { break; }`);
      lines.push(`${indent}        bytes.push(b);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    Some(String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?)`);
      break;
    default:
      // Type reference - nested struct
      const typeName = toRustTypeName(valueType);
      lines.push(`${indent}    Some(${typeName}::decode_with_decoder(decoder)?)`);
      break;
  }

  lines.push(`${indent}} else {`);
  lines.push(`${indent}    None`);
  lines.push(`${indent}};`);

  return lines;
}

/**
 * Generates decoding code for string field
 */
function generateDecodeString(field: any, varName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const rustEndianness = mapEndianness(endianness);

  switch (kind) {
    case "length_prefixed": {
      const lengthType = field.length_type || "uint8";
      // Read length prefix
      switch (lengthType) {
        case "uint8":
          lines.push(`${indent}let length = decoder.read_uint8()? as usize;`);
          break;
        case "uint16":
          lines.push(`${indent}let length = decoder.read_uint16(Endianness::${rustEndianness})? as usize;`);
          break;
        case "uint32":
          lines.push(`${indent}let length = decoder.read_uint32(Endianness::${rustEndianness})? as usize;`);
          break;
        case "uint64":
          lines.push(`${indent}let length = decoder.read_uint64(Endianness::${rustEndianness})? as usize;`);
          break;
      }
      // Read bytes
      lines.push(`${indent}let mut bytes = Vec::with_capacity(length);`);
      lines.push(`${indent}for _ in 0..length {`);
      lines.push(`${indent}    bytes.push(decoder.read_uint8()?);`);
      lines.push(`${indent}}`);
      lines.push(`${indent}let ${varName} = String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
      break;
    }

    case "null_terminated":
      lines.push(`${indent}let mut bytes = Vec::new();`);
      lines.push(`${indent}loop {`);
      lines.push(`${indent}    let b = decoder.read_uint8()?;`);
      lines.push(`${indent}    if b == 0 {`);
      lines.push(`${indent}        break;`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}    bytes.push(b);`);
      lines.push(`${indent}}`);
      lines.push(`${indent}let ${varName} = String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
      break;

    case "fixed": {
      const length = field.length || 0;
      lines.push(`${indent}let mut bytes = Vec::new();`);
      lines.push(`${indent}for _ in 0..${length} {`);
      lines.push(`${indent}    let b = decoder.read_uint8()?;`);
      lines.push(`${indent}    if b != 0 {`);
      lines.push(`${indent}        bytes.push(b);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);
      lines.push(`${indent}let ${varName} = String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
      break;
    }

    default:
      throw new Error(`Unknown string kind: ${kind}`);
  }

  return lines;
}

/**
 * Generates decoding code for array field
 */
function generateDecodeArray(field: any, varName: string, endianness: string, rustEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;

  if (!items) {
    throw new Error(`Array field ${field.name} missing items definition`);
  }

  const itemType = mapFieldToRustType(items);

  if (kind === "length_prefixed") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}let length = decoder.read_uint8()? as usize;`);
        break;
      case "uint16":
        lines.push(`${indent}let length = decoder.read_uint16(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint32":
        lines.push(`${indent}let length = decoder.read_uint32(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint64":
        lines.push(`${indent}let length = decoder.read_uint64(Endianness::${rustEndianness})? as usize;`);
        break;
    }
    lines.push(`${indent}let mut ${varName} = Vec::with_capacity(length);`);
    lines.push(`${indent}for _ in 0..length {`);
  } else if (kind === "field_referenced") {
    const lengthField = field.length_field;
    const lengthFieldRust = toRustFieldName(lengthField);
    lines.push(`${indent}let mut ${varName} = Vec::with_capacity(${lengthFieldRust} as usize);`);
    lines.push(`${indent}for _ in 0..${lengthFieldRust} {`);
  } else if (kind === "fixed") {
    const length = field.length || 0;
    lines.push(`${indent}let mut ${varName} = Vec::with_capacity(${length});`);
    lines.push(`${indent}for _ in 0..${length} {`);
  } else if (kind === "null_terminated") {
    lines.push(`${indent}let mut ${varName}: Vec<${itemType}> = Vec::new();`);
    lines.push(`${indent}loop {`);
    // TODO: Need to check for terminator BEFORE decoding item
  } else {
    throw new Error(`Unknown array kind: ${kind}`);
  }

  // Decode item
  const itemLines = generateDecodeArrayItem(items, endianness, rustEndianness, `${indent}    `);
  lines.push(...itemLines);
  lines.push(`${indent}    ${varName}.push(item);`);

  if (kind === "null_terminated") {
    // TODO: Proper null termination check
    lines.push(`${indent}    // TODO: null termination check`);
  }

  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates decoding code for a single array item
 */
function generateDecodeArrayItem(items: any, endianness: string, rustEndianness: string, indent: string): string[] {
  const lines: string[] = [];

  switch (items.type) {
    case "uint8":
      lines.push(`${indent}let item = decoder.read_uint8()?;`);
      break;
    case "uint16":
      lines.push(`${indent}let item = decoder.read_uint16(Endianness::${rustEndianness})?;`);
      break;
    case "uint32":
      lines.push(`${indent}let item = decoder.read_uint32(Endianness::${rustEndianness})?;`);
      break;
    case "uint64":
      lines.push(`${indent}let item = decoder.read_uint64(Endianness::${rustEndianness})?;`);
      break;
    case "int8":
      lines.push(`${indent}let item = decoder.read_int8()?;`);
      break;
    case "int16":
      lines.push(`${indent}let item = decoder.read_int16(Endianness::${rustEndianness})?;`);
      break;
    case "int32":
      lines.push(`${indent}let item = decoder.read_int32(Endianness::${rustEndianness})?;`);
      break;
    case "int64":
      lines.push(`${indent}let item = decoder.read_int64(Endianness::${rustEndianness})?;`);
      break;
    case "float32":
      lines.push(`${indent}let item = decoder.read_float32(Endianness::${rustEndianness})?;`);
      break;
    case "float64":
      lines.push(`${indent}let item = decoder.read_float64(Endianness::${rustEndianness})?;`);
      break;
    case "bit":
    case "int": {
      const bitSize = items.size || 1;
      const rustType = mapFieldToRustType(items);
      lines.push(`${indent}let item = decoder.read_bits(${bitSize})? as ${rustType};`);
      break;
    }
    default:
      // Type reference - nested struct
      const typeName = toRustTypeName(items.type);
      lines.push(`${indent}let item = ${typeName}::decode_with_decoder(decoder)?;`);
      break;
  }

  return lines;
}

/**
 * Generates decoding code for nested struct
 */
function generateDecodeNestedStruct(field: Field, varName: string, indent: string): string[] {
  const lines: string[] = [];
  const typeName = toRustTypeName(field.type);

  lines.push(`${indent}let ${varName} = ${typeName}::decode_with_decoder(decoder)?;`);

  return lines;
}

/**
 * Maps a field to its Rust type
 */
function mapFieldToRustType(field: Field): string {
  switch (field.type) {
    case "uint8":
      return "u8";
    case "uint16":
      return "u16";
    case "uint32":
      return "u32";
    case "uint64":
      return "u64";
    case "int8":
      return "i8";
    case "int16":
      return "i16";
    case "int32":
      return "i32";
    case "int64":
      return "i64";
    case "float32":
      return "f32";
    case "float64":
      return "f64";
    case "varlength":
      return "u64";  // Variable-length integers decode to u64
    case "bitfield": {
      // Bitfields are packed integers - use appropriate size
      const size = (field as any).size || 8;
      if (size <= 8) return "u8";
      if (size <= 16) return "u16";
      if (size <= 32) return "u32";
      return "u64";
    }
    case "string":
      return "String";
    case "bit": {
      const size = (field as any).size || 1;
      if (size <= 8) return "u8";
      if (size <= 16) return "u16";
      if (size <= 32) return "u32";
      return "u64";
    }
    case "int": {
      const intSize = (field as any).size || 8;
      if (intSize <= 8) return "i8";
      if (intSize <= 16) return "i16";
      if (intSize <= 32) return "i32";
      return "i64";
    }
    case "array": {
      const itemsType = mapFieldToRustType((field as any).items);
      return `Vec<${itemsType}>`;
    }
    case "optional": {
      const valueTypeName = (field as any).value_type;
      if (!valueTypeName) {
        throw new Error(`Optional field ${field.name} missing value_type`);
      }
      const valueType = mapPrimitiveToRustType(valueTypeName);
      return `Option<${valueType}>`;
    }
    default:
      // Assume it's a type reference (nested struct)
      return toRustTypeName(field.type);
  }
}

/**
 * Maps a primitive type name to Rust type
 */
function mapPrimitiveToRustType(typeName: string): string {
  switch (typeName) {
    case "uint8": return "u8";
    case "uint16": return "u16";
    case "uint32": return "u32";
    case "uint64": return "u64";
    case "int8": return "i8";
    case "int16": return "i16";
    case "int32": return "i32";
    case "int64": return "i64";
    case "float32": return "f32";
    case "float64": return "f64";
    case "string": return "String";
    default: return toRustTypeName(typeName);
  }
}

// Rust reserved keywords that need r# prefix
const RUST_KEYWORDS = new Set([
  'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
  'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
  'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
  'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
  'async', 'await', 'dyn', 'abstract', 'become', 'box', 'do', 'final',
  'macro', 'override', 'priv', 'typeof', 'unsized', 'virtual', 'yield', 'try'
]);

/**
 * Converts a field name to Rust field name (snake_case)
 */
function toRustFieldName(name: string | undefined): string {
  if (!name) {
    return "_unnamed";
  }
  // Already snake_case in schema, just ensure valid Rust identifier
  // Handle camelCase to snake_case conversion if needed
  let result = name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');

  // Escape Rust reserved keywords with r# prefix
  if (RUST_KEYWORDS.has(result)) {
    return `r#${result}`;
  }
  return result;
}

/**
 * Converts a type name to Rust type name (PascalCase)
 */
function toRustTypeName(name: string): string {
  if (!name) return name;
  // Convert snake_case to PascalCase
  return name
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Maps endianness string to Rust enum variant
 */
function mapEndianness(endianness: string): string {
  if (endianness === "little_endian") {
    return "LittleEndian";
  }
  return "BigEndian";
}

/**
 * Maps bit order string to Rust enum variant
 */
function mapBitOrder(bitOrder: string): string {
  if (bitOrder === "lsb_first") {
    return "LsbFirst";
  }
  return "MsbFirst";
}
