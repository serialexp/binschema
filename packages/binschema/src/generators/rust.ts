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

  // Collect inline union types (choice and discriminated_union) and generate enums for them
  const unionEnums = collectInlineUnionTypes(schema);
  for (const [enumName, variantTypes] of Object.entries(unionEnums)) {
    lines.push(...generateUnionEnum(enumName, variantTypes, defaultEndianness, defaultBitOrder));
  }

  // Collect bitfield types with sub-fields and generate structs for them
  const bitfieldTypes = collectBitfieldTypes(schema);
  for (const [structName, bitfieldDef] of Object.entries(bitfieldTypes)) {
    lines.push(...generateBitfieldStruct(structName, bitfieldDef, defaultBitOrder));
  }

  // Generate all types in the schema
  for (const [name, typeDef] of Object.entries(schema.types)) {
    // Convert type name to Rust PascalCase convention
    const rustTypeName = toRustTypeName(name);

    // Check if this is a composite type (has sequence) or type alias
    // IMPORTANT: Check for "variants" before "type" because discriminated unions have both
    if ("sequence" in typeDef) {
      // Composite type with fields - generate Input/Output structs
      lines.push(...generateStructs(rustTypeName, typeDef.sequence, schema));
      lines.push(...generateImpl(rustTypeName, typeDef.sequence, defaultEndianness, defaultBitOrder, schema));
    } else if ("variants" in typeDef) {
      // Discriminated union type - must check before "type" since it has both
      lines.push(...generateDiscriminatedUnion(rustTypeName, typeDef as any, defaultEndianness, defaultBitOrder));
    } else if ("type" in typeDef) {
      // Type alias - generate wrapper struct
      lines.push(...generateTypeAlias(rustTypeName, typeDef as any, defaultEndianness, defaultBitOrder, schema));
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
function generateTypeAlias(name: string, typeDef: any, defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Special handling for string type aliases - don't create wrapper struct
  // Just generate encode/decode that handles the string with its specific options
  if (typeDef.type === "string") {
    // Generate a newtype wrapper for string
    lines.push(`#[derive(Debug, Clone, PartialEq)]`);
    lines.push(`pub struct ${name}(pub std::string::String);`);
    lines.push(``);
    lines.push(`impl ${name} {`);

    // Generate encode method
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);

    // Create a temporary field to use generateEncodeString
    const stringField: Field = {
      name: "0",  // For tuple struct, access is self.0
      type: "string",
      ...typeDef
    };
    lines.push(...generateEncodeString(stringField, "self.0", defaultEndianness, "        "));
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);

    // Generate decode method
    lines.push(`    pub fn decode(bytes: &[u8]) -> Result<Self> {`);
    lines.push(`        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::${bitOrder});`);
    lines.push(`        Self::decode_with_decoder(&mut decoder)`);
    lines.push(`    }`);
    lines.push(``);

    // Generate decode_with_decoder method
    lines.push(`    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {`);
    lines.push(...generateDecodeString(stringField, "value", defaultEndianness, "        "));
    lines.push(`        Ok(Self(value))`);
    lines.push(`    }`);
    lines.push(`}`);
    lines.push(``);

    return lines;
  }

  // For other type aliases, create a wrapper struct with a single field "value"
  const field: Field = {
    name: "value",
    type: typeDef.type,
    ...typeDef
  };

  // Check if the wrapped type is composite - if so, use Input/Output separation
  const wrappedTypeDef = schema.types[typeDef.type];
  const wrappedIsComposite = wrappedTypeDef && "sequence" in wrappedTypeDef;

  if (wrappedIsComposite) {
    // Use Input/Output separation for wrappers of composite types
    lines.push(...generateStructs(name, [field], schema));
    lines.push(...generateImpl(name, [field], defaultEndianness, defaultBitOrder, schema));
  } else {
    // Simple wrappers (primitives, other type aliases) don't need Input/Output
    lines.push(...generateSimpleStruct(name, [field]));
    lines.push(...generateSimpleImpl(name, [field], defaultEndianness, defaultBitOrder, schema));
  }

  return lines;
}

/**
 * Generates a discriminated union as a Rust enum
 * Uses Output types for variants since these are created during decoding
 */
function generateDiscriminatedUnion(name: string, unionDef: any, defaultEndianness: string, defaultBitOrder: string): string[] {
  const lines: string[] = [];
  const discriminator = unionDef.discriminator;
  const variants = unionDef.variants || [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Generate enum definition - variants wrap Output types
  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub enum ${name} {`);
  for (const variant of variants) {
    const variantTypeName = toRustTypeName(variant.type);
    lines.push(`    ${variantTypeName}(${variantTypeName}Output),`);
  }
  lines.push(`}`);
  lines.push(``);

  // Generate impl block
  lines.push(`impl ${name} {`);

  // Generate encode method - uses the wrapped Output's encode (which doesn't exist on Output)
  // TODO: Proper encoding would need Input variants
  lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
  lines.push(`        match self {`);
  for (const variant of variants) {
    const variantTypeName = toRustTypeName(variant.type);
    // Note: This references encode on Output which doesn't have it
    // For now, we'll need to skip this or implement differently
    lines.push(`            ${name}::${variantTypeName}(_v) => Err(binschema_runtime::BinSchemaError::NotImplemented("discriminated union encoding".to_string())),`);
  }
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(``);

  // Generate decode method
  lines.push(`    pub fn decode(bytes: &[u8]) -> Result<Self> {`);
  lines.push(`        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::${bitOrder});`);
  lines.push(`        Self::decode_with_decoder(&mut decoder)`);
  lines.push(`    }`);
  lines.push(``);

  // Generate decode_with_decoder method
  lines.push(`    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {`);

  // Handle peek-based discriminator
  if (discriminator.peek) {
    const peekType = discriminator.peek;
    const peekEndianness = discriminator.endianness || defaultEndianness;
    const rustEndianness = mapEndianness(peekEndianness);

    // Generate peek call
    switch (peekType) {
      case "uint8":
        lines.push(`        let value = decoder.peek_uint8()?;`);
        break;
      case "uint16":
        lines.push(`        let value = decoder.peek_uint16(Endianness::${rustEndianness})?;`);
        break;
      case "uint32":
        lines.push(`        let value = decoder.peek_uint32(Endianness::${rustEndianness})?;`);
        break;
    }

    // Generate match arms based on variant conditions
    lines.push(`        // Match on discriminator value`);

    // Find fallback variant (no 'when' condition)
    const fallbackVariant = variants.find((v: any) => !v.when);
    const conditionalVariants = variants.filter((v: any) => v.when);

    // Generate if/else chain for conditions
    for (let i = 0; i < conditionalVariants.length; i++) {
      const variant = conditionalVariants[i];
      const variantTypeName = toRustTypeName(variant.type);
      const condition = translateConditionToRust(variant.when);

      if (i === 0) {
        lines.push(`        if ${condition} {`);
      } else {
        lines.push(`        } else if ${condition} {`);
      }
      lines.push(`            Ok(${name}::${variantTypeName}(${variantTypeName}Output::decode_with_decoder(decoder)?))`);
    }

    // Handle fallback or error
    if (fallbackVariant) {
      const variantTypeName = toRustTypeName(fallbackVariant.type);
      if (conditionalVariants.length > 0) {
        lines.push(`        } else {`);
        lines.push(`            Ok(${name}::${variantTypeName}(${variantTypeName}Output::decode_with_decoder(decoder)?))`);
        lines.push(`        }`);
      } else {
        lines.push(`        Ok(${name}::${variantTypeName}(${variantTypeName}Output::decode_with_decoder(decoder)?))`);
      }
    } else {
      if (conditionalVariants.length > 0) {
        lines.push(`        } else {`);
        lines.push(`            Err(binschema_runtime::BinSchemaError::InvalidVariant(value as u64))`);
        lines.push(`        }`);
      } else {
        lines.push(`        Err(binschema_runtime::BinSchemaError::InvalidVariant(value as u64))`);
      }
    }
  } else if (discriminator.field) {
    // Field-based discriminator - would need context from parent
    lines.push(`        // Field-based discriminator not yet fully supported`);
    lines.push(`        Err(binschema_runtime::BinSchemaError::NotImplemented("field-based discriminator".to_string()))`);
  }

  lines.push(`    }`);
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Translates a condition expression from schema format to Rust
 * e.g., "value == 0x01" -> "value == 0x01"
 * e.g., "value >= 0xC0" -> "value >= 0xC0"
 * e.g., "value !== 0xFF" -> "value != 0xFF"
 */
function translateConditionToRust(condition: string): string {
  // Replace JavaScript !== with Rust !=
  let rustCondition = condition.replace(/!==/g, '!=');
  // Replace JavaScript === with Rust ==
  rustCondition = rustCondition.replace(/===/g, '==');
  return rustCondition;
}

/**
 * Collects all inline choice and discriminated_union types from the schema
 * Returns a map of enum name -> array of variant type names
 */
function collectInlineUnionTypes(schema: BinarySchema): Record<string, string[]> {
  const unionEnums: Record<string, string[]> = {};

  function visitField(field: any): void {
    if (!field) return;

    // Handle choice types (used in array items)
    if (field.type === "choice" && field.choices) {
      const choiceTypes = field.choices.map((c: any) => c.type);
      const enumName = `Choice${choiceTypes.map(toRustTypeName).join('')}`;
      unionEnums[enumName] = choiceTypes;
    }

    // Handle inline discriminated_union fields
    if (field.type === "discriminated_union" && field.variants) {
      const variantTypes = field.variants.map((v: any) => v.type);
      const enumName = `Union${variantTypes.map(toRustTypeName).join('')}`;
      unionEnums[enumName] = variantTypes;
    }

    // Recurse into array items
    if (field.type === "array" && field.items) {
      visitField(field.items);
    }
  }

  for (const typeDef of Object.values(schema.types)) {
    if ("sequence" in (typeDef as any)) {
      for (const field of (typeDef as any).sequence) {
        visitField(field);
      }
    }
  }

  return unionEnums;
}

/**
 * Generates an enum for inline union types (choice or discriminated_union)
 * Uses Output types for variants since these are created during decoding
 */
function generateUnionEnum(enumName: string, variantTypes: string[], defaultEndianness: string, defaultBitOrder: string): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Generate enum definition - variants wrap Output types
  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub enum ${enumName} {`);
  for (const typeName of variantTypes) {
    const rustTypeName = toRustTypeName(typeName);
    lines.push(`    ${rustTypeName}(${rustTypeName}Output),`);
  }
  lines.push(`}`);
  lines.push(``);

  // Generate impl block
  lines.push(`impl ${enumName} {`);

  // Generate encode method - not yet properly implemented for Output types
  lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
  lines.push(`        match self {`);
  for (const typeName of variantTypes) {
    const rustTypeName = toRustTypeName(typeName);
    lines.push(`            ${enumName}::${rustTypeName}(_v) => Err(binschema_runtime::BinSchemaError::NotImplemented("union encoding".to_string())),`);
  }
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(``);

  // Generate decode method
  lines.push(`    pub fn decode(bytes: &[u8]) -> Result<Self> {`);
  lines.push(`        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::${bitOrder});`);
  lines.push(`        Self::decode_with_decoder(&mut decoder)`);
  lines.push(`    }`);
  lines.push(``);

  // Generate decode_with_decoder method
  // Try each variant in order until one succeeds
  lines.push(`    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {`);
  lines.push(`        // Union type - try each variant in order until one succeeds`);

  // Generate try-each-variant pattern
  for (let i = 0; i < variantTypes.length; i++) {
    const typeName = variantTypes[i];
    const rustTypeName = toRustTypeName(typeName);
    if (i === 0) {
      lines.push(`        let start_pos = decoder.position();`);
    }
    lines.push(`        if let Ok(v) = ${rustTypeName}Output::decode_with_decoder(decoder) {`);
    lines.push(`            return Ok(${enumName}::${rustTypeName}(v));`);
    lines.push(`        }`);
    if (i < variantTypes.length - 1) {
      lines.push(`        decoder.seek(start_pos)?;`);
    }
  }
  lines.push(`        Err(binschema_runtime::BinSchemaError::InvalidVariant(0))`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Bitfield sub-field definition
 */
interface BitfieldSubField {
  name: string;
  offset: number;
  size: number;
  description?: string;
}

/**
 * Bitfield type definition for code generation
 */
interface BitfieldDef {
  size: number;
  fields: BitfieldSubField[];
  containingType: string;
  fieldName: string;
}

/**
 * Collects all bitfield types with sub-fields from the schema
 * Returns a map of struct name -> bitfield definition
 */
function collectBitfieldTypes(schema: BinarySchema): Record<string, BitfieldDef> {
  const bitfieldTypes: Record<string, BitfieldDef> = {};

  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    if ("sequence" in (typeDef as any)) {
      for (const field of (typeDef as any).sequence) {
        if (field.type === "bitfield" && field.fields && Array.isArray(field.fields) && field.fields.length > 0) {
          // Generate a unique struct name based on containing type and field name
          const structName = `${toRustTypeName(typeName)}${toRustTypeName(field.name)}`;
          bitfieldTypes[structName] = {
            size: field.size || 8,
            fields: field.fields,
            containingType: typeName,
            fieldName: field.name
          };
        }
      }
    }
  }

  return bitfieldTypes;
}

/**
 * Generates a struct for a bitfield type with sub-fields
 */
function generateBitfieldStruct(structName: string, bitfieldDef: BitfieldDef, defaultBitOrder: string): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Generate struct definition
  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub struct ${structName} {`);
  for (const subField of bitfieldDef.fields) {
    const rustType = getBitfieldSubFieldType(subField.size);
    const fieldName = toRustFieldName(subField.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }
  lines.push(`}`);
  lines.push(``);

  // Generate impl block
  lines.push(`impl ${structName} {`);

  // Generate encode method - writes each sub-field in order
  lines.push(`    pub fn encode(&self, encoder: &mut BitStreamEncoder) {`);
  for (const subField of bitfieldDef.fields) {
    const fieldName = toRustFieldName(subField.name);
    lines.push(`        encoder.write_bits(self.${fieldName} as u64, ${subField.size});`);
  }
  lines.push(`    }`);
  lines.push(``);

  // Generate decode method - reads each sub-field in order
  lines.push(`    pub fn decode(decoder: &mut BitStreamDecoder) -> Result<Self> {`);
  for (const subField of bitfieldDef.fields) {
    const fieldName = toRustFieldName(subField.name);
    const rustType = getBitfieldSubFieldType(subField.size);
    lines.push(`        let ${fieldName} = decoder.read_bits(${subField.size})? as ${rustType};`);
  }
  // Construct the result
  lines.push(`        Ok(Self {`);
  for (const subField of bitfieldDef.fields) {
    const fieldName = toRustFieldName(subField.name);
    lines.push(`            ${fieldName},`);
  }
  lines.push(`        })`);
  lines.push(`    }`);

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Gets the Rust type for a bitfield sub-field based on its size
 */
function getBitfieldSubFieldType(size: number): string {
  if (size <= 8) return "u8";
  if (size <= 16) return "u16";
  if (size <= 32) return "u32";
  return "u64";
}

/**
 * Generates a Rust Input struct definition (for encoding)
 * Excludes computed and const fields
 * Uses Input types for nested composite types
 */
function generateInputStruct(name: string, fields: Field[], schema: BinarySchema): string[] {
  const lines: string[] = [];

  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub struct ${name}Input {`);

  for (const field of fields) {
    // Skip fields without names (e.g., conditional fields)
    // Skip fields without types (e.g., conditional markers)
    // Skip padding fields (computed at encode/decode time)
    if (!field.name || !field.type || field.type === "padding") {
      continue;
    }
    // Skip computed and const fields - they're not part of Input
    if (!isInputField(field)) {
      continue;
    }
    // Special handling for bitfields with sub-fields - use generated struct name
    let rustType: string;
    if (field.type === "bitfield" && (field as any).fields && Array.isArray((field as any).fields) && (field as any).fields.length > 0) {
      rustType = `${name}${toRustTypeName(field.name)}`;
    } else {
      rustType = mapFieldToRustTypeForInput(field, schema);
    }
    const fieldName = toRustFieldName(field.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates a Rust Output struct definition (from decoding)
 * Includes ALL fields (computed, const, and regular)
 */
function generateOutputStruct(name: string, fields: Field[], schema: BinarySchema): string[] {
  const lines: string[] = [];

  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub struct ${name}Output {`);

  for (const field of fields) {
    // Skip fields without names (e.g., conditional fields)
    // Skip fields without types (e.g., conditional markers)
    // Skip padding fields (computed at encode/decode time)
    if (!field.name || !field.type || field.type === "padding") {
      continue;
    }
    // Include all fields in Output (isOutputField always returns true)
    if (!isOutputField(field)) {
      continue;
    }
    // Special handling for bitfields with sub-fields - use generated struct name
    let rustType: string;
    if (field.type === "bitfield" && (field as any).fields && Array.isArray((field as any).fields) && (field as any).fields.length > 0) {
      rustType = `${name}${toRustTypeName(field.name)}`;
    } else {
      rustType = mapFieldToRustType(field, schema);
    }
    const fieldName = toRustFieldName(field.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates a backward-compatible type alias
 * The main type name refers to the Output struct
 */
function generateBackwardCompatAlias(name: string): string[] {
  return [
    `pub type ${name} = ${name}Output;`,
    ``
  ];
}

/**
 * Generates both Input and Output struct definitions plus type alias
 */
function generateStructs(name: string, fields: Field[], schema: BinarySchema): string[] {
  const lines: string[] = [];
  lines.push(...generateInputStruct(name, fields, schema));
  lines.push(...generateOutputStruct(name, fields, schema));
  lines.push(...generateBackwardCompatAlias(name));
  return lines;
}

/**
 * Generates a simple Rust struct definition (for type aliases/wrappers)
 * This is used for wrapper structs that don't need Input/Output separation
 */
function generateSimpleStruct(name: string, fields: Field[]): string[] {
  const lines: string[] = [];

  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub struct ${name} {`);

  for (const field of fields) {
    if (!field.name || !field.type || field.type === "padding") {
      continue;
    }
    let rustType: string;
    if (field.type === "bitfield" && (field as any).fields && Array.isArray((field as any).fields) && (field as any).fields.length > 0) {
      rustType = `${name}${toRustTypeName(field.name)}`;
    } else {
      rustType = mapFieldToRustType(field);
    }
    const fieldName = toRustFieldName(field.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates impl blocks for Input and Output structs
 * Input struct gets encode method, Output struct gets decode methods
 */
function generateImpl(name: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
  const lines: string[] = [];

  // Generate impl for Input struct (encode method)
  lines.push(`impl ${name}Input {`);
  lines.push(...generateEncodeMethod(fields, defaultEndianness, defaultBitOrder));
  lines.push(`}`);
  lines.push(``);

  // Generate impl for Output struct (decode methods)
  lines.push(`impl ${name}Output {`);
  lines.push(...generateDecodeMethod(name, fields, defaultEndianness, defaultBitOrder, schema));
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates a simple impl block with encode and decode methods (for type aliases)
 * This is used for wrapper structs that don't need Input/Output separation
 */
function generateSimpleImpl(name: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
  const lines: string[] = [];

  lines.push(`impl ${name} {`);

  // Generate encode method
  lines.push(...generateEncodeMethod(fields, defaultEndianness, defaultBitOrder));

  // Generate decode methods
  lines.push(...generateDecodeMethod(name, fields, defaultEndianness, defaultBitOrder, schema));

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates the encode method
 * Encodes input fields from self, writes const values directly, skips computed fields
 */
function generateEncodeMethod(fields: Field[], defaultEndianness: string, defaultBitOrder: string): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
  lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);

  // Generate encoding logic for each field
  for (const field of fields) {
    // Skip fields without names
    if (!field.name) {
      continue;
    }

    const fieldAny = field as any;

    // Handle const fields - write the constant value directly
    // Note: Use loose equality (!=) to handle both undefined and null
    // (Rust serde serializes Option::None as null in JSON)
    if (fieldAny.const != null) {
      lines.push(...generateEncodeConstField(field, fieldAny.const, defaultEndianness, "        "));
      continue;
    }

    // Skip computed fields - they need runtime computation (not yet implemented)
    // Note: Use loose equality (!=) to handle both undefined and null
    if (fieldAny.computed != null) {
      lines.push(`        // TODO: computed field '${field.name}' - requires runtime computation`);
      continue;
    }

    // Regular input field - encode from self
    lines.push(...generateEncodeField(field, defaultEndianness, "        "));
  }

  lines.push(`        Ok(encoder.finish())`);
  lines.push(`    }`);
  lines.push(``);

  return lines;
}

/**
 * Generates encoding code for a const field (writes a fixed value)
 */
function generateEncodeConstField(field: Field, constValue: any, defaultEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const endianness = (field as any).endianness || defaultEndianness;
  const rustEndianness = mapEndianness(endianness);

  // Handle null/undefined const values - use 0 as default
  const value = constValue === null || constValue === undefined ? 0 : constValue;

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.write_uint8(${value});`);
      break;
    case "uint16":
      lines.push(`${indent}encoder.write_uint16(${value}, Endianness::${rustEndianness});`);
      break;
    case "uint32":
      lines.push(`${indent}encoder.write_uint32(${value}, Endianness::${rustEndianness});`);
      break;
    case "uint64":
      lines.push(`${indent}encoder.write_uint64(${value}, Endianness::${rustEndianness});`);
      break;
    case "int8":
      lines.push(`${indent}encoder.write_int8(${value});`);
      break;
    case "int16":
      lines.push(`${indent}encoder.write_int16(${value}, Endianness::${rustEndianness});`);
      break;
    case "int32":
      lines.push(`${indent}encoder.write_int32(${value}, Endianness::${rustEndianness});`);
      break;
    case "int64":
      lines.push(`${indent}encoder.write_int64(${value}, Endianness::${rustEndianness});`);
      break;
    default:
      lines.push(`${indent}// TODO: const field '${field.name}' of type '${field.type}' not yet supported`);
      break;
  }

  return lines;
}

/**
 * Generates the decode methods
 */
function generateDecodeMethod(name: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
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
    lines.push(...generateDecodeField(field, defaultEndianness, "        ", name, schema));
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
      lines.push(`${indent}encoder.write_varlength(${fieldName}, "${encoding}")?;`);
      break;
    }

    case "bitfield": {
      // Check if this bitfield has sub-fields
      const subFields = (field as any).fields;
      if (subFields && Array.isArray(subFields) && subFields.length > 0) {
        // Bitfield with sub-fields - use the struct's encode method
        lines.push(`${indent}${fieldName}.encode(&mut encoder);`);
      } else {
        // Bitfield without sub-fields - write as packed integer
        const bitSize = (field as any).size || 8;
        lines.push(`${indent}encoder.write_bits(${fieldName} as u64, ${bitSize});`);
      }
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

    case "field_referenced":
      // Length is determined by another field, just write the bytes
      lines.push(`${indent}for b in ${fieldName}.as_bytes() {`);
      lines.push(`${indent}    encoder.write_uint8(*b);`);
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
    case "string": {
      // Inline string encoding for array items
      const kind = (field as any).kind;
      switch (kind) {
        case "length_prefixed": {
          const lengthType = (field as any).length_type || "uint8";
          switch (lengthType) {
            case "uint8":
              lines.push(`${indent}encoder.write_uint8(${itemVar}.len() as u8);`);
              break;
            case "uint16":
              lines.push(`${indent}encoder.write_uint16(${itemVar}.len() as u16, Endianness::${rustEndianness});`);
              break;
            case "uint32":
              lines.push(`${indent}encoder.write_uint32(${itemVar}.len() as u32, Endianness::${rustEndianness});`);
              break;
            case "uint64":
              lines.push(`${indent}encoder.write_uint64(${itemVar}.len() as u64, Endianness::${rustEndianness});`);
              break;
          }
          lines.push(`${indent}for b in ${itemVar}.as_bytes() {`);
          lines.push(`${indent}    encoder.write_uint8(*b);`);
          lines.push(`${indent}}`);
          break;
        }
        case "null_terminated":
          lines.push(`${indent}for b in ${itemVar}.as_bytes() {`);
          lines.push(`${indent}    encoder.write_uint8(*b);`);
          lines.push(`${indent}}`);
          lines.push(`${indent}encoder.write_uint8(0);`);
          break;
        case "fixed": {
          const length = (field as any).length || 0;
          lines.push(`${indent}let bytes = ${itemVar}.as_bytes();`);
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
          // Default to null-terminated for unknown string kinds
          lines.push(`${indent}for b in ${itemVar}.as_bytes() {`);
          lines.push(`${indent}    encoder.write_uint8(*b);`);
          lines.push(`${indent}}`);
          lines.push(`${indent}encoder.write_uint8(0);`);
          break;
      }
      break;
    }
    case "array": {
      // Nested array - inline encoding
      const innerItems = (field as any).items;
      const innerKind = (field as any).kind;
      const innerLengthType = (field as any).length_type || "uint8";

      // Write length prefix if length_prefixed
      if (innerKind === "length_prefixed") {
        switch (innerLengthType) {
          case "uint8":
            lines.push(`${indent}encoder.write_uint8(${itemVar}.len() as u8);`);
            break;
          case "uint16":
            lines.push(`${indent}encoder.write_uint16(${itemVar}.len() as u16, Endianness::${rustEndianness});`);
            break;
          case "uint32":
            lines.push(`${indent}encoder.write_uint32(${itemVar}.len() as u32, Endianness::${rustEndianness});`);
            break;
          case "uint64":
            lines.push(`${indent}encoder.write_uint64(${itemVar}.len() as u64, Endianness::${rustEndianness});`);
            break;
        }
      }

      // Encode inner items
      const innerItemField: Field = {
        name: "",
        type: innerItems.type,
        ...(innerItems as any)
      };
      lines.push(`${indent}for inner_item in ${itemVar} {`);
      const innerLines = generateEncodeArrayItem(innerItemField, "inner_item", endianness, `${indent}    `);
      lines.push(...innerLines);
      lines.push(`${indent}}`);
      break;
    }
    default:
      // Type reference - nested struct
      lines.push(`${indent}let bytes = ${itemVar}.encode()?;`);
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

  lines.push(`${indent}let bytes = ${fieldName}.encode()?;`);
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

  lines.push(`${indent}if let Some(ref v) = ${fieldName} {`);
  lines.push(`${indent}    encoder.write_uint8(1);`);

  // Encode the value based on its type
  // Note: v is a reference due to `if let Some(ref v)`, so primitives need *v to dereference
  switch (valueType) {
    case "uint8":
      lines.push(`${indent}    encoder.write_uint8(*v);`);
      break;
    case "uint16":
      lines.push(`${indent}    encoder.write_uint16(*v, Endianness::${rustEndianness});`);
      break;
    case "uint32":
      lines.push(`${indent}    encoder.write_uint32(*v, Endianness::${rustEndianness});`);
      break;
    case "uint64":
      lines.push(`${indent}    encoder.write_uint64(*v, Endianness::${rustEndianness});`);
      break;
    case "int8":
      lines.push(`${indent}    encoder.write_int8(*v);`);
      break;
    case "int16":
      lines.push(`${indent}    encoder.write_int16(*v, Endianness::${rustEndianness});`);
      break;
    case "int32":
      lines.push(`${indent}    encoder.write_int32(*v, Endianness::${rustEndianness});`);
      break;
    case "int64":
      lines.push(`${indent}    encoder.write_int64(*v, Endianness::${rustEndianness});`);
      break;
    case "float32":
      lines.push(`${indent}    encoder.write_float32(*v, Endianness::${rustEndianness});`);
      break;
    case "float64":
      lines.push(`${indent}    encoder.write_float64(*v, Endianness::${rustEndianness});`);
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
      lines.push(`${indent}    let bytes = v.encode()?;`);
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
function generateDecodeField(field: Field, defaultEndianness: string, indent: string, containingTypeName: string, schema: BinarySchema): string[] {
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
      // Check if this bitfield has sub-fields
      const subFields = (field as any).fields;
      if (subFields && Array.isArray(subFields) && subFields.length > 0 && containingTypeName) {
        // Bitfield with sub-fields - use the struct's decode method
        // Note: decoder is already &mut, so pass it directly without additional &mut
        const bitfieldStructName = `${containingTypeName}${toRustTypeName(field.name)}`;
        lines.push(`${indent}let ${varName} = ${bitfieldStructName}::decode(decoder)?;`);
      } else {
        // Bitfield without sub-fields - read as packed integer
        const bitSize = (field as any).size || 8;
        const rustType = mapFieldToRustType(field);
        lines.push(`${indent}let ${varName} = decoder.read_bits(${bitSize})? as ${rustType};`);
      }
      break;
    }

    case "string":
      lines.push(...generateDecodeString(field as any, varName, endianness, indent));
      break;

    case "array":
      lines.push(...generateDecodeArray(field as any, varName, endianness, rustEndianness, indent, schema));
      break;

    case "optional":
      lines.push(...generateDecodeOptional(field as any, varName, endianness, indent, schema));
      break;

    case "padding":
      // Padding fields are computed, skip decode for now
      // In a full implementation, we'd read and discard alignment bytes
      break;

    default:
      // Type reference - nested struct
      lines.push(...generateDecodeNestedStruct(field, varName, indent, schema));
      break;
  }

  return lines;
}

/**
 * Generates decoding code for optional field
 */
function generateDecodeOptional(field: any, varName: string, endianness: string, indent: string, schema: BinarySchema): string[] {
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
      lines.push(`${indent}    Some(std::string::String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?)`);
      break;
    default: {
      // Type reference - nested struct
      const typeName = toRustTypeName(valueType);
      // Check if the referenced type is composite (has sequence) or a type alias
      const typeDef = schema.types[valueType];
      const isComposite = typeDef && "sequence" in typeDef;
      // Use Output suffix only for composite types
      const decodeName = isComposite ? `${typeName}Output` : typeName;
      lines.push(`${indent}    Some(${decodeName}::decode_with_decoder(decoder)?)`);
      break;
    }
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
      lines.push(`${indent}let ${varName} = std::string::String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
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
      lines.push(`${indent}let ${varName} = std::string::String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
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
      lines.push(`${indent}let ${varName} = std::string::String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
      break;
    }

    case "field_referenced": {
      // Length is determined by another field that was already decoded
      const lengthField = field.length_field;
      const lengthFieldRust = toRustFieldName(lengthField);
      lines.push(`${indent}let mut bytes = Vec::with_capacity(${lengthFieldRust} as usize);`);
      lines.push(`${indent}for _ in 0..${lengthFieldRust} {`);
      lines.push(`${indent}    bytes.push(decoder.read_uint8()?);`);
      lines.push(`${indent}}`);
      lines.push(`${indent}let ${varName} = std::string::String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
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
function generateDecodeArray(field: any, varName: string, endianness: string, rustEndianness: string, indent: string, schema: BinarySchema): string[] {
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
  } else if (kind === "byte_length_prefixed") {
    // Read length in bytes, then decode items until we've consumed that many bytes
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}let byte_length = decoder.read_uint8()? as usize;`);
        break;
      case "uint16":
        lines.push(`${indent}let byte_length = decoder.read_uint16(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint32":
        lines.push(`${indent}let byte_length = decoder.read_uint32(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint64":
        lines.push(`${indent}let byte_length = decoder.read_uint64(Endianness::${rustEndianness})? as usize;`);
        break;
      case "varlength": {
        const lengthEncoding = field.length_encoding || "der";
        lines.push(`${indent}let byte_length = decoder.read_varlength("${lengthEncoding}")? as usize;`);
        break;
      }
    }
    lines.push(`${indent}let start_pos = decoder.position();`);
    lines.push(`${indent}let mut ${varName}: Vec<${itemType}> = Vec::new();`);
    lines.push(`${indent}while decoder.position() < start_pos + byte_length {`);
  } else if (kind === "length_prefixed_items") {
    // Each item has a length prefix
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}let count = decoder.read_uint8()? as usize;`);
        break;
      case "uint16":
        lines.push(`${indent}let count = decoder.read_uint16(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint32":
        lines.push(`${indent}let count = decoder.read_uint32(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint64":
        lines.push(`${indent}let count = decoder.read_uint64(Endianness::${rustEndianness})? as usize;`);
        break;
    }
    lines.push(`${indent}let mut ${varName} = Vec::with_capacity(count);`);
    lines.push(`${indent}for _ in 0..count {`);
  } else if (kind === "computed_count") {
    // Count is computed from another expression
    const countExpr = field.count_expr || "0";
    // For now, just use a simple approach
    lines.push(`${indent}let count = ${countExpr} as usize;`);
    lines.push(`${indent}let mut ${varName} = Vec::with_capacity(count);`);
    lines.push(`${indent}for _ in 0..count {`);
  } else if (kind === "variant_terminated" || kind === "signature_terminated") {
    // Read until a specific variant/signature is encountered
    lines.push(`${indent}let mut ${varName}: Vec<${itemType}> = Vec::new();`);
    lines.push(`${indent}loop {`);
    // The termination check will happen after decoding the item
  } else {
    throw new Error(`Unknown array kind: ${kind}`);
  }

  // Decode item
  const itemLines = generateDecodeArrayItem(items, endianness, rustEndianness, `${indent}    `, schema);
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
function generateDecodeArrayItem(items: any, endianness: string, rustEndianness: string, indent: string, schema: BinarySchema): string[] {
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
    case "choice": {
      // Choice type - use generated enum name
      const choices = items.choices || [];
      const choiceTypes = choices.map((c: any) => toRustTypeName(c.type));
      const enumName = `Choice${choiceTypes.join('')}`;
      lines.push(`${indent}let item = ${enumName}::decode_with_decoder(decoder)?;`);
      break;
    }
    case "discriminated_union": {
      // Discriminated union - use generated enum name
      const variants = items.variants || [];
      const variantTypes = variants.map((v: any) => toRustTypeName(v.type));
      const enumName = `Union${variantTypes.join('')}`;
      lines.push(`${indent}let item = ${enumName}::decode_with_decoder(decoder)?;`);
      break;
    }
    case "string": {
      // Inline string decoding for array items
      const kind = items.kind;
      switch (kind) {
        case "length_prefixed": {
          const lengthType = items.length_type || "uint8";
          switch (lengthType) {
            case "uint8":
              lines.push(`${indent}let str_len = decoder.read_uint8()? as usize;`);
              break;
            case "uint16":
              lines.push(`${indent}let str_len = decoder.read_uint16(Endianness::${rustEndianness})? as usize;`);
              break;
            case "uint32":
              lines.push(`${indent}let str_len = decoder.read_uint32(Endianness::${rustEndianness})? as usize;`);
              break;
            case "uint64":
              lines.push(`${indent}let str_len = decoder.read_uint64(Endianness::${rustEndianness})? as usize;`);
              break;
          }
          lines.push(`${indent}let mut str_bytes = Vec::with_capacity(str_len);`);
          lines.push(`${indent}for _ in 0..str_len {`);
          lines.push(`${indent}    str_bytes.push(decoder.read_uint8()?);`);
          lines.push(`${indent}}`);
          lines.push(`${indent}let item = std::string::String::from_utf8(str_bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
          break;
        }
        case "null_terminated":
          lines.push(`${indent}let mut str_bytes = Vec::new();`);
          lines.push(`${indent}loop {`);
          lines.push(`${indent}    let b = decoder.read_uint8()?;`);
          lines.push(`${indent}    if b == 0 { break; }`);
          lines.push(`${indent}    str_bytes.push(b);`);
          lines.push(`${indent}}`);
          lines.push(`${indent}let item = std::string::String::from_utf8(str_bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
          break;
        case "fixed": {
          const length = items.length || 0;
          lines.push(`${indent}let mut str_bytes = Vec::new();`);
          lines.push(`${indent}for _ in 0..${length} {`);
          lines.push(`${indent}    let b = decoder.read_uint8()?;`);
          lines.push(`${indent}    if b != 0 {`);
          lines.push(`${indent}        str_bytes.push(b);`);
          lines.push(`${indent}    }`);
          lines.push(`${indent}}`);
          lines.push(`${indent}let item = std::string::String::from_utf8(str_bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
          break;
        }
        default:
          // Default to null-terminated for unknown string kinds
          lines.push(`${indent}let mut str_bytes = Vec::new();`);
          lines.push(`${indent}loop {`);
          lines.push(`${indent}    let b = decoder.read_uint8()?;`);
          lines.push(`${indent}    if b == 0 { break; }`);
          lines.push(`${indent}    str_bytes.push(b);`);
          lines.push(`${indent}}`);
          lines.push(`${indent}let item = std::string::String::from_utf8(str_bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`);
          break;
      }
      break;
    }
    case "array": {
      // Nested array - inline decoding
      const innerItems = items.items;
      const innerKind = items.kind;
      const innerLengthType = items.length_type || "uint8";

      // Read length prefix if length_prefixed
      if (innerKind === "length_prefixed") {
        switch (innerLengthType) {
          case "uint8":
            lines.push(`${indent}let inner_len = decoder.read_uint8()? as usize;`);
            break;
          case "uint16":
            lines.push(`${indent}let inner_len = decoder.read_uint16(Endianness::${rustEndianness})? as usize;`);
            break;
          case "uint32":
            lines.push(`${indent}let inner_len = decoder.read_uint32(Endianness::${rustEndianness})? as usize;`);
            break;
          case "uint64":
            lines.push(`${indent}let inner_len = decoder.read_uint64(Endianness::${rustEndianness})? as usize;`);
            break;
        }
      } else {
        // For fixed arrays, use the length directly
        const fixedLen = items.length || 0;
        lines.push(`${indent}let inner_len = ${fixedLen};`);
      }

      // Decode inner items
      lines.push(`${indent}let mut item = Vec::with_capacity(inner_len);`);
      lines.push(`${indent}for _ in 0..inner_len {`);
      const innerLines = generateDecodeArrayItem(innerItems, endianness, rustEndianness, `${indent}    `, schema);
      // Rename 'item' to 'inner_item' in the inner lines to avoid shadowing
      for (const line of innerLines) {
        lines.push(line.replace(/let item = /, 'let inner_item = '));
      }
      lines.push(`${indent}    item.push(inner_item);`);
      lines.push(`${indent}}`);
      break;
    }
    default:
      // Type reference - nested struct
      const typeName = toRustTypeName(items.type);
      // Check if the referenced type is composite (has sequence) or a type alias
      const typeDef = schema.types[items.type];
      const isComposite = typeDef && "sequence" in typeDef;
      // Use Output suffix only for composite types
      const decodeName = isComposite ? `${typeName}Output` : typeName;
      lines.push(`${indent}let item = ${decodeName}::decode_with_decoder(decoder)?;`);
      break;
  }

  return lines;
}

/**
 * Generates decoding code for nested struct
 * Uses Output suffix only for composite types (with sequence)
 */
function generateDecodeNestedStruct(field: Field, varName: string, indent: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const typeName = toRustTypeName(field.type);

  // Check if the referenced type is composite (has sequence) or a type alias
  const typeDef = schema.types[field.type];
  const isComposite = typeDef && "sequence" in typeDef;

  // Use Output suffix only for composite types
  const decodeName = isComposite ? `${typeName}Output` : typeName;
  lines.push(`${indent}let ${varName} = ${decodeName}::decode_with_decoder(decoder)?;`);

  return lines;
}

/**
 * Maps a field to its Rust type for Input structs
 * Composite types get Input suffix, type aliases stay as-is
 */
function mapFieldToRustTypeForInput(field: Field, schema: BinarySchema): string {
  // Handle primitive types first
  switch (field.type) {
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
    case "varlength": return "u64";
    case "string": return "std::string::String";
    case "bit": {
      const size = (field as any).size || 1;
      if (size <= 8) return "u8";
      if (size <= 16) return "u16";
      if (size <= 32) return "u32";
      return "u64";
    }
    case "bitfield": {
      // Bitfields without sub-fields are packed integers
      const size = (field as any).size || 8;
      if (size <= 8) return "u8";
      if (size <= 16) return "u16";
      if (size <= 32) return "u32";
      return "u64";
    }
    case "array": {
      const items = (field as any).items;
      const itemsType = mapFieldToRustTypeForInput(items, schema);
      return `Vec<${itemsType}>`;
    }
    case "choice": {
      // Choice type - generate enum name from choices
      const choices = (field as any).choices || [];
      if (choices.length === 0) {
        throw new Error(`Choice field has no choices`);
      }
      const choiceTypes = choices.map((c: any) => toRustTypeName(c.type));
      return `Choice${choiceTypes.join('')}`;
    }
    case "discriminated_union": {
      // Discriminated union - generate enum name from variants
      const variants = (field as any).variants || [];
      if (variants.length === 0) {
        throw new Error(`Discriminated union field has no variants`);
      }
      const variantTypes = variants.map((v: any) => toRustTypeName(v.type));
      return `Union${variantTypes.join('')}`;
    }
    case "optional": {
      const valueTypeName = (field as any).value_type;
      if (!valueTypeName) {
        throw new Error(`Optional field ${field.name} missing value_type`);
      }
      // Check if the value type is composite (including through type aliases)
      const optIsComposite = isCompositeType(valueTypeName, schema);
      const rustTypeName = toRustTypeName(valueTypeName);
      const valueType = optIsComposite ? `${rustTypeName}Input` : mapPrimitiveToRustType(valueTypeName);
      return `Option<${valueType}>`;
    }
    default: {
      // Type reference - check if composite or type alias
      const typeName = toRustTypeName(field.type);
      const typeDef = schema.types[field.type];

      // Check if this type is composite (has sequence) or is a type alias to a composite type
      const isComposite = isCompositeType(field.type, schema);

      // Use Input suffix for composite types
      return isComposite ? `${typeName}Input` : typeName;
    }
  }
}

/**
 * Checks if a type is composite (has sequence) or is a type alias to a composite type.
 * Follows type alias chains to determine if the ultimate type is composite.
 */
function isCompositeType(typeName: string, schema: BinarySchema): boolean {
  const visited = new Set<string>();
  let currentType = typeName;

  while (currentType && !visited.has(currentType)) {
    visited.add(currentType);
    const typeDef = schema.types[currentType];

    if (!typeDef) {
      // Not defined in schema - must be a primitive
      return false;
    }

    if ("sequence" in typeDef) {
      // Direct composite type with sequence
      return true;
    }

    if ("type" in typeDef && typeof typeDef.type === "string") {
      // Type alias - follow the reference
      currentType = typeDef.type;
    } else {
      // Not a type alias, not a sequence - not composite
      return false;
    }
  }

  return false;
}

/**
 * Maps a field to its Rust type
 * The schema parameter is optional - when provided, composite types get Output suffix
 */
function mapFieldToRustType(field: Field, schema?: BinarySchema): string {
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
      // Bitfields without sub-fields are packed integers - use appropriate size
      // Note: Bitfields WITH sub-fields are handled specially in generateStruct
      const size = (field as any).size || 8;
      if (size <= 8) return "u8";
      if (size <= 16) return "u16";
      if (size <= 32) return "u32";
      return "u64";
    }
    case "string":
      return "std::string::String";
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
      const items = (field as any).items;
      const itemsType = mapFieldToRustType(items);
      return `Vec<${itemsType}>`;
    }
    case "choice": {
      // Choice type - generate enum name from choices
      // This creates a union of the choice types
      const choices = (field as any).choices || [];
      if (choices.length === 0) {
        throw new Error(`Choice field has no choices`);
      }
      // Use a generated name based on the choices
      const choiceTypes = choices.map((c: any) => toRustTypeName(c.type));
      // For now, return the first choice's wrapper enum
      // The actual enum generation happens in generateChoiceEnum
      return `Choice${choiceTypes.join('')}`;
    }
    case "discriminated_union": {
      // Discriminated union used as a field type
      // The union type should already be defined at the top level
      // This handles inline discriminated unions
      const variants = (field as any).variants || [];
      if (variants.length === 0) {
        throw new Error(`Discriminated union field has no variants`);
      }
      const variantTypes = variants.map((v: any) => toRustTypeName(v.type));
      return `Union${variantTypes.join('')}`;
    }
    case "optional": {
      const valueTypeName = (field as any).value_type;
      if (!valueTypeName) {
        throw new Error(`Optional field ${field.name} missing value_type`);
      }
      const valueType = mapPrimitiveToRustType(valueTypeName);
      return `Option<${valueType}>`;
    }
    default: {
      // Assume it's a type reference (nested struct or type alias)
      const typeName = toRustTypeName(field.type);
      // If schema is provided, check if the type is composite
      if (schema) {
        const typeDef = schema.types[field.type];
        const isComposite = typeDef && "sequence" in typeDef;
        // Use Output suffix only for composite types
        return isComposite ? `${typeName}Output` : typeName;
      }
      return typeName;
    }
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
    case "string": return "std::string::String";
    default: return toRustTypeName(typeName);
  }
}

/**
 * Determines if a field should be included in the Input struct (for encoding)
 * Input excludes computed and const fields - they are calculated during encoding
 */
function isInputField(field: Field): boolean {
  const fieldAny = field as any;

  // Exclude computed fields - they are calculated during encoding
  // Note: Use loose equality (!=) to handle both undefined and null
  // (Rust serde serializes Option::None as null in JSON)
  if (fieldAny.computed != null) {
    return false;
  }

  // Exclude const fields - they use schema-defined values
  // Note: Use loose equality (!=) to handle both undefined and null
  if (fieldAny.const != null) {
    return false;
  }

  return true;
}

/**
 * Determines if a field should be included in the Output struct (from decoding)
 * Output includes ALL fields (const, computed, and regular)
 */
function isOutputField(_field: Field): boolean {
  return true;
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

  // Handle _root references (e.g., "_root.end_of_central_dir.total_entries")
  if (name.startsWith('_root.')) {
    // For now, Rust generator doesn't support context/root references
    // This is a complex feature that requires passing context through decoders
    throw new Error(`Rust generator does not yet support _root references: ${name}. ` +
      `This requires context threading which is not implemented.`);
  }

  // Handle dotted references (e.g., "header.body_length" or "flags.count")
  // For parent struct field references, convert to Rust field access
  // Note: Bitfield sub-field references (e.g., "flags.count" where flags is a bitfield)
  // will produce invalid Rust code and fail at compile time - this is a known limitation
  if (name.includes('.')) {
    const parts = name.split('.');
    const rustParts = parts.map(part => {
      let result = part
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
      if (RUST_KEYWORDS.has(result)) {
        return `r#${result}`;
      }
      return result;
    });
    return rustParts.join('.');
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
