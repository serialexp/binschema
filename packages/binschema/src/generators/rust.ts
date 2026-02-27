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

  // Suppress common warnings for generated code
  lines.push(`#![allow(non_camel_case_types)]`);
  lines.push(`#![allow(dead_code)]`);
  lines.push(`#![allow(unreachable_code)]`);
  lines.push(``);

  // Determine default endianness and bit order
  const defaultEndianness = schema.config?.endianness || "big_endian";
  const defaultBitOrder = schema.config?.bit_order || "msb_first";

  // Use statement - allow unused since different schemas need different imports
  lines.push(`#[allow(unused_imports)]`);
  lines.push(`use ${crateName}::{BitStreamEncoder, BitStreamDecoder, Endianness, BitOrder, Result, EncodeContext, FieldValue};`);
  lines.push(`#[allow(unused_imports)]`);
  lines.push(`use std::collections::HashMap;`);
  lines.push(``);

  // Collect inline union types (choice and discriminated_union) and generate enums for them
  const unionEnums = collectInlineUnionTypes(schema);
  for (const [enumName, variantTypes] of Object.entries(unionEnums)) {
    lines.push(...generateUnionEnum(enumName, variantTypes, defaultEndianness, defaultBitOrder, schema));
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
      // Composite type with fields - generate struct(s) and impl
      const instances = (typeDef as any).instances || [];
      lines.push(...generateStructs(rustTypeName, name, typeDef.sequence, schema, instances));
      lines.push(...generateImpl(rustTypeName, name, typeDef.sequence, defaultEndianness, defaultBitOrder, schema, instances));
    } else if ("variants" in typeDef) {
      // Discriminated union type - must check before "type" since it has both
      lines.push(...generateDiscriminatedUnion(rustTypeName, typeDef as any, defaultEndianness, defaultBitOrder, schema));
    } else if ("type" in typeDef) {
      // Type alias - generate wrapper struct
      lines.push(...generateTypeAlias(rustTypeName, name, typeDef as any, defaultEndianness, defaultBitOrder, schema));
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

// ===== Selector Parsing Helpers =====

/**
 * Parse first/last selector pattern like "../sections[first<FileData>]"
 */
function parseFirstLastTarget(target: string): { levelsUp: number; arrayPath: string; filterType: string; selector: "first" | "last" } | null {
  const match = target.match(/^((?:\.\.\/)+)([^\[]+)\[(first|last)<(\w+)>\]$/);
  if (!match) return null;

  const parentPart = match[1];
  let levelsUp = 0;
  for (let i = 0; i < parentPart.length; i += 3) {
    if (parentPart.slice(i, i + 3) === "../") levelsUp++;
  }

  return {
    levelsUp,
    arrayPath: match[2],
    filterType: match[4],
    selector: match[3] as "first" | "last"
  };
}

/**
 * Parse corresponding selector pattern like "../sections[corresponding<FileData>]"
 * or "../sections[corresponding<FileData>].payload"
 */
function parseCorrespondingTarget(target: string): { levelsUp: number; arrayPath: string; filterType: string; remainingPath: string } | null {
  const match = target.match(/^((?:\.\.\/)+)([^\[]+)\[corresponding<(\w+)>\](\..*)?$/);
  if (!match) return null;

  const parentPart = match[1];
  let levelsUp = 0;
  for (let i = 0; i < parentPart.length; i += 3) {
    if (parentPart.slice(i, i + 3) === "../") levelsUp++;
  }

  return {
    levelsUp,
    arrayPath: match[2],
    filterType: match[3],
    remainingPath: match[4] || ""
  };
}

/**
 * Detect which arrays in the schema need position tracking for first/last selectors
 * Returns a map of array field names to the set of types that need tracking
 */
function detectArraysNeedingPositionTracking(schema: BinarySchema): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  for (const typeName in schema.types) {
    const typeDef = schema.types[typeName];
    if (!("sequence" in typeDef)) continue;

    for (const field of typeDef.sequence) {
      const fieldAny = field as any;
      if (!fieldAny.computed) continue;

      const target = fieldAny.computed.target;
      if (!target) continue;

      const firstLastInfo = parseFirstLastTarget(target);
      if (firstLastInfo) {
        const existing = result.get(firstLastInfo.arrayPath) || new Set<string>();
        existing.add(firstLastInfo.filterType);
        result.set(firstLastInfo.arrayPath, existing);
      }

      const correspondingInfo = parseCorrespondingTarget(target);
      if (correspondingInfo) {
        const existing = result.get(correspondingInfo.arrayPath) || new Set<string>();
        existing.add(correspondingInfo.filterType);
        result.set(correspondingInfo.arrayPath, existing);
      }
    }
  }

  return result;
}

/**
 * Get the static (compile-time known) size of a field in bytes.
 * Returns 0 for variable-size fields.
 */
function getStaticFieldSize(field: Field, schema: BinarySchema): number {
  const fieldAny = field as any;
  if (fieldAny.computed) {
    // Computed fields still take up space based on their type
    switch (field.type) {
      case "uint8": case "int8": return 1;
      case "uint16": case "int16": return 2;
      case "uint32": case "int32": case "float32": return 4;
      case "uint64": case "int64": case "float64": return 8;
      default: return 0;
    }
  }
  if (fieldAny.const !== undefined) {
    switch (field.type) {
      case "uint8": case "int8": return 1;
      case "uint16": case "int16": return 2;
      case "uint32": case "int32": case "float32": return 4;
      case "uint64": case "int64": case "float64": return 8;
      default: return 0;
    }
  }
  switch (field.type) {
    case "uint8": case "int8": return 1;
    case "uint16": case "int16": return 2;
    case "uint32": case "int32": case "float32": return 4;
    case "uint64": case "int64": case "float64": return 8;
    case "padding": return fieldAny.align_to || 0;
    default: return 0; // Variable size (string, array, composite)
  }
}

// ===== Parent Reference Helpers =====

/**
 * Parse a parent reference path like "../field" or "../../field"
 * Returns the number of levels up and the field name, or null if not a parent reference
 */
function parseParentPath(target: string): { levelsUp: number; fieldName: string } | null {
  if (!target.startsWith("../")) {
    return null;
  }

  let levelsUp = 0;
  let remaining = target;
  while (remaining.startsWith("../")) {
    levelsUp++;
    remaining = remaining.slice(3);
  }

  return { levelsUp, fieldName: remaining };
}

/**
 * Check if a type has any computed fields with parent references
 * Returns true if any computed field uses ../ syntax
 */
function typeHasParentReferences(fields: Field[]): boolean {
  for (const field of fields) {
    const fieldAny = field as any;
    if (fieldAny.computed) {
      const target = fieldAny.computed.target as string | undefined;
      const targets = fieldAny.computed.targets as string[] | undefined;

      // Check single target
      if (target && target.startsWith("../")) {
        return true;
      }

      // Check targets array (for sum_of_sizes)
      if (targets && Array.isArray(targets)) {
        for (const t of targets) {
          if (t.startsWith("../")) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Check if a type has any nested struct fields
 * Returns true if any field references another struct type
 */
function hasNestedStructFields(fields: Field[], schema: BinarySchema): boolean {
  for (const field of fields) {
    const fieldType = field.type as string;
    // Check if it's a reference to another type in the schema
    if (schema.types && schema.types[fieldType]) {
      const typeDef = schema.types[fieldType];
      // It's a nested struct if it has a sequence
      if ("sequence" in typeDef) {
        return true;
      }
    }
    // Check array items - if they reference types that need context
    if (fieldType === "array") {
      const items = (field as any).items;
      if (items?.type && schema.types && schema.types[items.type]) {
        const itemTypeDef = schema.types[items.type];
        if ("sequence" in itemTypeDef) {
          const itemFields = (itemTypeDef as any).sequence as Field[];
          if (typeHasParentReferences(itemFields) || hasNestedStructFields(itemFields, schema)) {
            return true;
          }
        }
      }
      // Check if choice array variants need encode context (parent refs, selectors, corresponding)
      // If so, the parent needs to build Items context (requires parent_fields + child_ctx)
      if (items?.type === "choice" || items?.type === "discriminated_union") {
        if (arrayItemsUseCorrespondingSelectors(field as any, schema)) {
          return true;
        }
        // Also check if any variant has parent references or selectors that need context
        const choices = items.choices || items.types || [];
        for (const choice of choices) {
          if (variantTypeNeedsEncodeContext(choice.type, schema)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Check if an array item type needs context (has parent references or nested structs that do)
 */
function arrayItemNeedsContext(field: any, schema: BinarySchema): boolean {
  const items = field.items;
  if (!items?.type || !schema.types) return false;
  const itemTypeDef = schema.types[items.type];
  if (!itemTypeDef) return false;
  if ("sequence" in itemTypeDef) {
    const itemFields = (itemTypeDef as any).sequence as Field[];
    return typeHasParentReferences(itemFields) || hasNestedStructFields(itemFields, schema);
  }
  return false;
}

/**
 * Check if items in a typed array use corresponding selectors (cross-array correlation).
 * If so, the encoding loop needs iteration index tracking via set_array_iteration.
 */
function arrayItemsUseCorrespondingSelectors(field: any, schema: BinarySchema): boolean {
  const items = field.items;
  if (!items?.type || !schema.types) return false;

  // For choice arrays, check each variant
  if (items.type === "choice" || items.type === "discriminated_union") {
    const choices = items.choices || items.types || [];
    for (const choice of choices) {
      if (variantUsesCorrespondingSelector(choice.type, schema)) return true;
    }
    return false;
  }

  // For single-type arrays, check the type directly
  return variantUsesCorrespondingSelector(items.type, schema);
}

function variantUsesCorrespondingSelector(typeName: string, schema: BinarySchema): boolean {
  const typeDef = schema.types?.[typeName];
  if (!typeDef || !("sequence" in typeDef)) return false;
  const sequence = (typeDef as any).sequence as Field[];
  for (const field of sequence) {
    const fieldAny = field as any;
    if (fieldAny.computed?.target) {
      const parsed = parseCorrespondingTarget(fieldAny.computed.target);
      if (parsed) return true;
    }
  }
  return false;
}

/**
 * Check if a variant type needs encode context (has computed fields with parent refs or selectors)
 * This means the variant's encode cannot work without an EncodeContext.
 */
function variantTypeNeedsEncodeContext(typeName: string, schema: BinarySchema): boolean {
  const typeDef = schema.types[typeName];
  if (!typeDef || !("sequence" in typeDef)) return false;
  const sequence = (typeDef as any).sequence as Field[];
  for (const field of sequence) {
    const fieldAny = field as any;
    if (fieldAny.computed) {
      const target = fieldAny.computed.target as string | undefined;
      const targets = fieldAny.computed.targets as string[] | undefined;
      // Check single target for parent refs or selectors
      if (target && (target.startsWith("../") || target.includes("[") || target.includes("<"))) {
        return true;
      }
      // Check targets array (for sum_of_sizes)
      if (targets && Array.isArray(targets)) {
        for (const t of targets) {
          if (t.startsWith("../") || t.includes("[") || t.includes("<")) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Get the Rust type for a FieldValue conversion based on field type
 */
function getFieldValueConversion(field: Field): string {
  const fieldType = field.type;
  switch (fieldType) {
    case "uint8": return "FieldValue::U8";
    case "uint16": return "FieldValue::U16";
    case "uint32": return "FieldValue::U32";
    case "uint64": return "FieldValue::U64";
    case "int8": return "FieldValue::I8";
    case "int16": return "FieldValue::I16";
    case "int32": return "FieldValue::I32";
    case "int64": return "FieldValue::I64";
    case "float32": return "FieldValue::F32";
    case "float64": return "FieldValue::F64";
    case "string": return "FieldValue::String";
    case "array": return "FieldValue::Bytes";
    default: return "FieldValue::Bytes"; // Fallback for complex types
  }
}

// ===== Decode Context Helpers =====

/**
 * Get all field names for a given type
 */
function getTypeFieldNames(typeName: string, schema: BinarySchema): Set<string> {
  const fieldNames = new Set<string>();
  const typeDef = schema.types[typeName];
  if (!typeDef) return fieldNames;

  if ("sequence" in typeDef) {
    for (const field of typeDef.sequence) {
      if (field.name) {
        fieldNames.add(field.name);
      }
    }
  }
  return fieldNames;
}

/**
 * Check if a type has field_referenced arrays with length fields not present in the type itself.
 * Such types need decode context passing to access parent fields.
 */
function typeNeedsDecodeContext(typeName: string, schema: BinarySchema): boolean {
  const typeDef = schema.types[typeName];
  if (!typeDef) return false;

  if (!("sequence" in typeDef)) return false;

  const localFields = getTypeFieldNames(typeName, schema);

  for (const field of typeDef.sequence) {
    const fieldAny = field as any;
    if (field.type === "array" && fieldAny.kind === "field_referenced") {
      const lengthField = fieldAny.length_field;
      if (lengthField && !localFields.has(lengthField)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get all types that need decode context (have external field references)
 */
function getTypesNeedingDecodeContext(schema: BinarySchema): Set<string> {
  const result = new Set<string>();
  for (const typeName of Object.keys(schema.types)) {
    if (typeNeedsDecodeContext(typeName, schema)) {
      result.add(typeName);
    }
  }
  return result;
}

// ===== Back-Reference Compression Helpers =====

/**
 * Check if a schema contains any back_reference type definitions.
 */
function schemaHasBackReferences(schema: BinarySchema): boolean {
  for (const typeName of Object.keys(schema.types)) {
    const typeDef = schema.types[typeName];
    if ("type" in typeDef && (typeDef as any).type === "back_reference") {
      return true;
    }
  }
  return false;
}

/**
 * Check if a type transitively contains back_reference types.
 * Returns true if the type is a back_reference, contains fields of back_reference types,
 * or contains arrays/unions with back_reference variants.
 * Used to determine which types need encode_with_context() for compression dict threading.
 */
function typeTransitivelyContainsBackReference(typeName: string, schema: BinarySchema, visited?: Set<string>): boolean {
  if (!visited) visited = new Set();
  if (visited.has(typeName)) return false;
  visited.add(typeName);

  const typeDef = schema.types[typeName];
  if (!typeDef) return false;

  // Direct back_reference type
  if ("type" in typeDef && (typeDef as any).type === "back_reference") {
    return true;
  }

  // Type alias — check the referenced type
  if ("type" in typeDef && !("sequence" in typeDef) && !("variants" in typeDef)) {
    const innerType = (typeDef as any).type as string;
    if (innerType === "array") {
      const items = (typeDef as any).items;
      if (items?.type && schema.types[items.type]) {
        return typeTransitivelyContainsBackReference(items.type, schema, visited);
      }
      // Inline discriminated union in array items
      if (items?.type === "discriminated_union" || items?.type === "choice") {
        const choices = items.choices || items.types || [];
        for (const choice of choices) {
          if (typeTransitivelyContainsBackReference(choice.type, schema, visited)) return true;
        }
      }
      return false;
    }
    if (schema.types[innerType]) {
      return typeTransitivelyContainsBackReference(innerType, schema, visited);
    }
    return false;
  }

  // Discriminated union — check variants
  if ("variants" in typeDef) {
    const variants = (typeDef as any).variants || [];
    for (const variant of variants) {
      if (typeTransitivelyContainsBackReference(variant.type, schema, visited)) return true;
    }
    return false;
  }

  // Sequence type — check fields
  if ("sequence" in typeDef) {
    const sequence = (typeDef as any).sequence as Field[];
    for (const field of sequence) {
      const fieldType = field.type as string;
      if (fieldType === "array") {
        const items = (field as any).items;
        if (items?.type && schema.types[items.type]) {
          if (typeTransitivelyContainsBackReference(items.type, schema, visited)) return true;
        }
        if (items?.type === "discriminated_union" || items?.type === "choice") {
          const choices = items.choices || items.types || [];
          for (const choice of choices) {
            if (typeTransitivelyContainsBackReference(choice.type, schema, visited)) return true;
          }
        }
      } else if (schema.types[fieldType]) {
        if (typeTransitivelyContainsBackReference(fieldType, schema, visited)) return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * Check if a discriminated union has any back_reference variants.
 */
function unionHasBackReferenceVariant(unionDef: any, schema: BinarySchema): boolean {
  const variants = unionDef.variants || [];
  for (const variant of variants) {
    const typeDef = schema.types[variant.type];
    if (typeDef && "type" in typeDef && (typeDef as any).type === "back_reference") {
      return true;
    }
  }
  return false;
}

/**
 * Get all back_reference type names in the schema, mapped to their definitions.
 */
function getBackReferenceTypes(schema: BinarySchema): Map<string, any> {
  const result = new Map<string, any>();
  for (const typeName of Object.keys(schema.types)) {
    const typeDef = schema.types[typeName];
    if ("type" in typeDef && (typeDef as any).type === "back_reference") {
      result.set(typeName, typeDef);
    }
  }
  return result;
}

/**
 * Generates a type alias as a wrapper struct
 */
function generateTypeAlias(name: string, schemaTypeName: string, typeDef: any, defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
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
    // Create a temporary field to use generateEncodeString
    const stringField: Field = {
      name: "0",  // For tuple struct, access is self.0
      type: "string",
      ...typeDef
    };
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into(&mut encoder)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
    lines.push(...generateEncodeString(stringField, "self.0", defaultEndianness, "        "));
    lines.push(`        Ok(())`);
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

  // Special handling for back_reference type aliases
  if (typeDef.type === "back_reference") {
    const targetType = typeDef.target_type;
    const storage = typeDef.storage || "uint16";
    const offsetMask = typeDef.offset_mask || "0x3FFF";
    const offsetFrom = typeDef.offset_from || "message_start";
    const backRefEndianness = typeDef.endianness || defaultEndianness;
    const rustEndianness = mapEndianness(backRefEndianness);

    // Get the Rust type name for the target type
    const targetRustTypeName = toRustTypeName(targetType);
    const targetTypeDef = schema.types[targetType];
    const targetIsComposite = targetTypeDef && "sequence" in targetTypeDef;
    const targetNeedsSplit = targetIsComposite && typeNeedsInputOutputSplit(targetType, schema);
    const targetDecodeName = targetNeedsSplit ? `${targetRustTypeName}Output` : targetRustTypeName;

    // Determine pointer marker bits based on storage type
    let markerBits: string;
    let writeMethod: string;
    switch (storage) {
      case "uint8":
        markerBits = "0xC0";
        writeMethod = `encoder.write_uint8(${markerBits}u8 | (offset as u8 & ${offsetMask}u8));`;
        break;
      case "uint32":
        markerBits = "0xC0000000";
        writeMethod = `encoder.write_uint32(${markerBits}u32 | (offset as u32 & ${offsetMask}u32), Endianness::${rustEndianness});`;
        break;
      case "uint16":
      default:
        markerBits = "0xC000";
        writeMethod = `encoder.write_uint16(${markerBits}u16 | (offset as u16 & ${offsetMask}u16), Endianness::${rustEndianness});`;
        break;
    }

    // Generate a newtype wrapper for back_reference
    lines.push(`#[derive(Debug, Clone, PartialEq)]`);
    lines.push(`pub struct ${name}(pub ${targetDecodeName});`);
    lines.push(``);
    lines.push(`impl ${name} {`);

    // Generate encode method - delegates to encode_with_context
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        self.encode_with_context(&EncodeContext::new())`);
    lines.push(`    }`);
    lines.push(``);

    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
    lines.push(`        self.encode_into_with_context(encoder, &EncodeContext::new())`);
    lines.push(`    }`);
    lines.push(``);

    // Generate encode_with_context - uses compression dictionary for pointer encoding
    lines.push(`    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into_with_context(&mut encoder, ctx)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);

    lines.push(`    pub fn encode_into_with_context(&self, encoder: &mut BitStreamEncoder, ctx: &EncodeContext) -> Result<()> {`);
    lines.push(`        // Encode target value to get bytes for dict lookup`);
    lines.push(`        let target_bytes = self.0.encode()?;`);
    lines.push(``);
    lines.push(`        // Check compression dictionary for existing encoding`);
    lines.push(`        if let Some(dict) = ctx.compression_dict() {`);
    lines.push(`            if let Some(&offset) = dict.borrow().get(&target_bytes) {`);
    lines.push(`                // Found — write compression pointer`);
    lines.push(`                ${writeMethod}`);
    lines.push(`                return Ok(());`);
    lines.push(`            }`);
    lines.push(`        }`);
    lines.push(``);
    lines.push(`        // Not found — record in dict and encode inline`);
    lines.push(`        if let Some(dict) = ctx.compression_dict() {`);
    lines.push(`            dict.borrow_mut().entry(target_bytes.clone()).or_insert(encoder.byte_offset());`);
    lines.push(`        }`);
    lines.push(`        for b in &target_bytes { encoder.write_uint8(*b); }`);
    lines.push(`        Ok(())`);
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
    lines.push(`        // Read the reference value (${storage})`);

    // Read the storage value
    switch (storage) {
      case "uint8":
        lines.push(`        let reference_value = decoder.read_uint8()?;`);
        break;
      case "uint16":
        lines.push(`        let reference_value = decoder.read_uint16(Endianness::${rustEndianness})?;`);
        break;
      case "uint32":
        lines.push(`        let reference_value = decoder.read_uint32(Endianness::${rustEndianness})?;`);
        break;
      default:
        lines.push(`        let reference_value = decoder.read_uint16(Endianness::${rustEndianness})?;`);
    }

    lines.push(`        let offset = (reference_value & ${offsetMask}) as usize;`);
    lines.push(``);
    lines.push(`        // Save current position and seek to the referenced offset`);
    lines.push(`        let saved_pos = decoder.position();`);

    if (offsetFrom === "current_position") {
      lines.push(`        decoder.seek(saved_pos + offset)?;`);
    } else {
      // message_start
      lines.push(`        decoder.seek(offset)?;`);
    }

    lines.push(``);
    lines.push(`        // Decode the target type at the referenced position`);
    lines.push(`        let value = ${targetDecodeName}::decode_with_decoder(decoder)?;`);
    lines.push(``);
    lines.push(`        // Restore position`);
    lines.push(`        decoder.seek(saved_pos)?;`);
    lines.push(``);
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
    lines.push(...generateStructs(name, name, [field], schema));
    lines.push(...generateImpl(name, name, [field], defaultEndianness, defaultBitOrder, schema));
  } else {
    // Simple wrappers (primitives, other type aliases) don't need Input/Output
    lines.push(...generateSimpleStruct(name, [field], schemaTypeName));
    lines.push(...generateSimpleImpl(name, schemaTypeName, [field], defaultEndianness, defaultBitOrder, schema));
  }

  return lines;
}

/**
 * Check if a type needs Input/Output suffix (i.e., is composite or alias to composite)
 */
/**
 * Determines if a sequence type needs separate Input/Output structs.
 * Returns true only when the type's sequence contains fields with computed or const values,
 * meaning Input (for encoding, excludes computed/const) differs from Output (includes all).
 * Types without computed/const fields get a single unified struct.
 */
function typeNeedsInputOutputSplit(typeName: string, schema: BinarySchema): boolean {
  const typeDef = schema.types[typeName];
  if (!typeDef) return false;

  if ("sequence" in typeDef) {
    const sequence = (typeDef as any).sequence as Field[];
    return sequence.some((f: any) => {
      if (!f.name || !f.type || f.type === "padding") return false;
      return (f.computed != null) || (f.const != null);
    });
  }

  // Type alias - follow the chain
  if ("type" in typeDef) {
    const innerType = (typeDef as any).type;
    if (innerType === "string" || innerType === "back_reference" || innerType === "array") {
      return false;
    }
    return typeNeedsInputOutputSplit(innerType, schema);
  }

  return false;
}

function typeNeedsInputOutputSuffix(typeName: string, schema: BinarySchema): boolean {
  const typeDef = schema.types[typeName];
  if (!typeDef) return false;

  // Direct sequence type - needs suffix only if it needs the Input/Output split
  if ("sequence" in typeDef) return typeNeedsInputOutputSplit(typeName, schema);

  // Discriminated union - doesn't need suffix (uses its own type name)
  if ("variants" in typeDef) return false;

  // Type alias - check if it wraps a composite type that needs the split
  if ("type" in typeDef) {
    const innerType = (typeDef as any).type;
    // Special types that don't need suffix
    if (innerType === "string" || innerType === "back_reference" || innerType === "array") {
      return false;
    }
    // Check if it's a reference to another composite type that needs the split
    return typeNeedsInputOutputSuffix(innerType, schema);
  }

  return false;
}

/**
 * Generates a discriminated union as a Rust enum
 * Uses Output types for variants that have Input/Output separation
 */
function generateDiscriminatedUnion(name: string, unionDef: any, defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const discriminator = unionDef.discriminator;
  const variants = unionDef.variants || [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Generate enum definition - variants wrap Output types for composite types, plain types otherwise
  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub enum ${name} {`);
  for (const variant of variants) {
    const variantTypeName = toRustTypeName(variant.type);
    const needsSuffix = typeNeedsInputOutputSuffix(variant.type, schema);
    const wrappedType = needsSuffix ? `${variantTypeName}Output` : variantTypeName;
    lines.push(`    ${variantTypeName}(${wrappedType}),`);
  }
  lines.push(`}`);
  lines.push(``);

  // Generate impl block
  lines.push(`impl ${name} {`);

  // Check if this union has back_reference variants (needs compression dict support)
  const hasBackRefVariants = unionHasBackReferenceVariant(unionDef, schema);

  // Generate encode method
  // For variants with simple types (no Input/Output separation), we can call encode() directly
  // For composite types wrapped in Output, encode all their fields inline
  if (hasBackRefVariants) {
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into_with_context(&mut encoder, &EncodeContext::new())?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
    lines.push(`        self.encode_into_with_context(encoder, &EncodeContext::new())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into_with_context(&mut encoder, ctx)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into_with_context(&self, encoder: &mut BitStreamEncoder, ctx: &EncodeContext) -> Result<()> {`);
  } else {
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into(&mut encoder)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
  }
  lines.push(`        match self {`);
  for (const variant of variants) {
    const variantTypeName = toRustTypeName(variant.type);
    const needsSuffix = typeNeedsInputOutputSuffix(variant.type, schema);
    const typeDef = schema.types[variant.type];
    const variantIsBackRef = typeDef && "type" in typeDef && (typeDef as any).type === "back_reference";
    const variantIsString = typeDef && "type" in typeDef && (typeDef as any).type === "string";

    if (needsSuffix && typeDef && "sequence" in typeDef) {
      // Composite type wrapped in Output - encode all fields inline
      const sequence = (typeDef as any).sequence;
      lines.push(`            ${name}::${variantTypeName}(v) => {`);
      const rustEndianness = mapEndianness(defaultEndianness);

      // Check if any sub-field is a nested struct that needs parent context from this variant
      const variantHasNestedStructNeedingContext = sequence.some((f: any) => {
        if (!f.name || f.type === "padding" || (f as any).computed || (f as any).const != null) return false;
        const fTypeDef = schema.types?.[f.type as string];
        if (!fTypeDef || !("sequence" in fTypeDef)) return false;
        const fSeq = (fTypeDef as any).sequence as Field[];
        return typeHasParentReferences(fSeq) || hasNestedStructFields(fSeq, schema);
      });

      // Build per-variant context if needed
      if (variantHasNestedStructNeedingContext) {
        lines.push(`                // Build per-variant context for nested struct sub-fields`);
        lines.push(`                let mut variant_fields: HashMap<String, FieldValue> = HashMap::new();`);
        for (const vf of sequence) {
          const vfAny = vf as any;
          if (!vf.name || vf.type === "padding" || vfAny.computed || vfAny.const != null) continue;
          // Skip the nested struct fields themselves — they consume context, they don't provide it
          const vfTypeDef = schema.types?.[vf.type as string];
          const vfIsNestedStruct = vfTypeDef && "sequence" in vfTypeDef;
          if (vfIsNestedStruct) continue;

          const vfRustName = toRustFieldName(vf.name);
          const vfType = vf.type as string;
          if (vfType === "string") {
            lines.push(`                variant_fields.insert("${vf.name}".to_string(), FieldValue::String(v.${vfRustName}.clone()));`);
          } else if (vfType === "array" && (vf as any).items?.type === "uint8") {
            lines.push(`                variant_fields.insert("${vf.name}".to_string(), FieldValue::Bytes(v.${vfRustName}.clone()));`);
          } else if (["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64"].includes(vfType)) {
            const conversion = getFieldValueConversion(vf);
            lines.push(`                variant_fields.insert("${vf.name}".to_string(), ${conversion}(v.${vfRustName}));`);
          }
        }
        lines.push(`                let variant_ctx = ctx.extend_with_parent(variant_fields);`);
      }

      for (const field of sequence) {
        if (!field.name || field.type === "padding") continue;
        const fieldName = toRustFieldName(field.name);
        const fieldEndianness = field.endianness ? mapEndianness(field.endianness) : rustEndianness;

        // Handle computed fields - compute value inline rather than reading from struct
        // Only handle simple local targets (no parent refs or selectors)
        const fieldAny = field as any;
        if (fieldAny.computed) {
          const computed = fieldAny.computed;
          const target = computed.target as string | undefined;
          const isSimpleTarget = target && !target.startsWith("../") && !target.includes("[") && !target.includes("<");

          if (isSimpleTarget) {
            if (computed.type === "length_of") {
              const targetRust = toRustFieldName(target);
              const computedVarName = `${fieldName}_computed`;

              // Find the target field to determine what length calculation to use
              const targetField = sequence.find((f: any) => f.name === target);
              const targetType = targetField?.type as string | undefined;
              const isCompositeTarget = targetType && schema.types && schema.types[targetType] && targetType !== "array";

              if (isCompositeTarget) {
                // Composite type - convert Output to Input and encode to measure byte length
                const compositeRustName = toRustTypeName(targetType!);
                const compositeNeedsSuffix = typeNeedsInputOutputSuffix(targetType!, schema);
                if (compositeNeedsSuffix) {
                  lines.push(`                let ${computedVarName} = ${compositeRustName}Input::from(v.${targetRust}.clone()).encode()?.len();`);
                } else {
                  lines.push(`                let ${computedVarName} = v.${targetRust}.encode()?.len();`);
                }
              } else {
                // Array, string, or primitive - use .len()
                lines.push(`                let ${computedVarName} = v.${targetRust}.len();`);
              }

                if (computed.offset !== undefined && computed.offset !== 0) {
                  lines.push(`                let ${computedVarName} = ${computedVarName} + ${computed.offset};`);
                }
                lines.push(...generateComputedFieldWrite(field, computedVarName, fieldEndianness, "                "));
                continue;
            } else if (computed.type === "count_of") {
              const targetRust = toRustFieldName(target);
              const computedVarName = `${fieldName}_computed`;
              lines.push(`                let ${computedVarName} = v.${targetRust}.len();`);
              lines.push(...generateComputedFieldWrite(field, computedVarName, fieldEndianness, "                "));
              continue;
            } else if (computed.type === "crc32_of") {
              const targetRust = toRustFieldName(target);
              const crcInputVar = `${fieldName}_crc_input`;
              lines.push(`                let ${crcInputVar}: Vec<u8> = v.${targetRust}.iter().cloned().collect();`);
              lines.push(`                let ${fieldName}_computed = binschema_runtime::crc32(&${crcInputVar});`);
              lines.push(`                encoder.write_uint32(${fieldName}_computed, Endianness::${fieldEndianness});`);
              continue;
            }
          }
          // Fall through for complex targets or other computed types - encode the field value as-is
        }

        // Encode each field from the Output struct
        switch (field.type) {
          case "uint8":
            lines.push(`                encoder.write_uint8(v.${fieldName});`);
            break;
          case "uint16":
            lines.push(`                encoder.write_uint16(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "uint32":
            lines.push(`                encoder.write_uint32(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "uint64":
            lines.push(`                encoder.write_uint64(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "int8":
            lines.push(`                encoder.write_int8(v.${fieldName});`);
            break;
          case "int16":
            lines.push(`                encoder.write_int16(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "int32":
            lines.push(`                encoder.write_int32(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "int64":
            lines.push(`                encoder.write_int64(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "float32":
            lines.push(`                encoder.write_float32(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "float64":
            lines.push(`                encoder.write_float64(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "string": {
            const strLines = generateEncodeString(field, `v.${fieldName}`, defaultEndianness, "                ");
            lines.push(...strLines);
            break;
          }
          case "varlength": {
            const vlEnc = (field as any).encoding || "der";
            lines.push(`                encoder.write_varlength(v.${fieldName}, "${vlEnc}")?;`);
            break;
          }
          case "array": {
            const arrayItems = field.items;
            if (arrayItems) {
              switch (arrayItems.type) {
                case "uint8":
                  lines.push(`                for item in &v.${fieldName} {`);
                  lines.push(`                    encoder.write_uint8(*item);`);
                  lines.push(`                }`);
                  break;
                case "uint16":
                  lines.push(`                for item in &v.${fieldName} {`);
                  lines.push(`                    encoder.write_uint16(*item, Endianness::${fieldEndianness});`);
                  lines.push(`                }`);
                  break;
                case "uint32":
                  lines.push(`                for item in &v.${fieldName} {`);
                  lines.push(`                    encoder.write_uint32(*item, Endianness::${fieldEndianness});`);
                  lines.push(`                }`);
                  break;
                default: {
                  const itemTypeDef = schema.types[arrayItems.type];
                  if (itemTypeDef) {
                    if ("sequence" in itemTypeDef) {
                      const itemTypeName = toRustTypeName(arrayItems.type);
                      const itemNeedsSplit = typeNeedsInputOutputSplit(arrayItems.type, schema);
                      lines.push(`                for item in &v.${fieldName} {`);
                      if (itemNeedsSplit) {
                        // Composite type with split - convert Output to Input and encode
                        lines.push(`                    ${itemTypeName}Input::from(item.clone()).encode_into(encoder)?;`);
                      } else {
                        // Unified type - encode directly
                        lines.push(`                    item.encode_into(encoder)?;`);
                      }
                      lines.push(`                }`);
                    } else {
                      // Simple type alias with encode()
                      lines.push(`                for item in &v.${fieldName} {`);
                      lines.push(`                    item.encode_into(encoder)?;`);
                      lines.push(`                }`);
                    }
                  } else {
                    lines.push(`                return Err(binschema_runtime::BinSchemaError::NotImplemented("encoding array of '${arrayItems.type}' in discriminated union variant".to_string()));`);
                  }
                  break;
                }
              }
            }
            break;
          }
          default: {
            const typeDef2 = schema.types[field.type];
            const needsSuffix2 = typeNeedsInputOutputSuffix(field.type, schema);
            if (typeDef2 && !needsSuffix2) {
              lines.push(`                v.${fieldName}.encode_into(encoder)?;`);
            } else if (typeDef2 && isCompositeType(field.type, schema)) {
              // Composite type that needs Input/Output split - convert Output to Input and call encode()
              const refTypeName = toRustTypeName(field.type);
              // Check if this nested struct type needs context from the variant
              const nestedTypeDef = schema.types[field.type];
              const nestedSeq = nestedTypeDef && "sequence" in nestedTypeDef ? (nestedTypeDef as any).sequence as Field[] : [];
              const nestedNeedsCtx = nestedSeq.length > 0 && (typeHasParentReferences(nestedSeq) || hasNestedStructFields(nestedSeq, schema));
              if (nestedNeedsCtx && variantHasNestedStructNeedingContext) {
                lines.push(`                ${refTypeName}Input::from(v.${fieldName}.clone()).encode_into_with_context(encoder, &variant_ctx)?;`);
              } else {
                lines.push(`                ${refTypeName}Input::from(v.${fieldName}.clone()).encode_into(encoder)?;`);
              }
            } else {
              lines.push(`                return Err(binschema_runtime::BinSchemaError::NotImplemented("encoding field '${field.name}' of type '${field.type}' in discriminated union variant".to_string()));`);
            }
            break;
          }
        }
      }
      lines.push(`            }`);
    } else if (needsSuffix) {
      // Composite type alias with Input/Output split - convert Output to Input and encode directly
      lines.push(`            ${name}::${variantTypeName}(v) => {`);
      lines.push(`                ${variantTypeName}Input::from(v.clone()).encode_into(encoder)?;`);
      lines.push(`            }`);
    } else if (hasBackRefVariants && variantIsBackRef) {
      // Back-reference variant with compression context — call encode_into_with_context
      lines.push(`            ${name}::${variantTypeName}(v) => {`);
      lines.push(`                let item_ctx = ctx.with_base_offset(encoder.byte_offset());`);
      lines.push(`                v.encode_into_with_context(encoder, &item_ctx)?;`);
      lines.push(`            }`);
    } else if (hasBackRefVariants && variantIsString) {
      // Non-reference string variant in union with back_references — register in compression dict
      // NOTE: Strings need materialized bytes for dict registration
      lines.push(`            ${name}::${variantTypeName}(v) => {`);
      lines.push(`                let bytes = v.encode()?;`);
      lines.push(`                // Register non-reference string in compression dict`);
      lines.push(`                if let Some(dict) = ctx.compression_dict() {`);
      lines.push(`                    dict.borrow_mut().entry(bytes.clone()).or_insert(encoder.byte_offset());`);
      lines.push(`                }`);
      lines.push(`                for b in bytes { encoder.write_uint8(b); }`);
      lines.push(`            }`);
    } else {
      // Simple type - encode directly into encoder
      lines.push(`            ${name}::${variantTypeName}(v) => {`);
      lines.push(`                v.encode_into(encoder)?;`);
      lines.push(`            }`);
    }
  }
  lines.push(`        }`);
  lines.push(`        Ok(())`);
  lines.push(`    }`);
  lines.push(``);

  // Check if any variant needs decode context
  const typesNeedingContext = getTypesNeedingDecodeContext(schema);
  const anyVariantNeedsContext = variants.some((v: any) => typesNeedingContext.has(v.type));

  // Generate decode method
  lines.push(`    pub fn decode(bytes: &[u8]) -> Result<Self> {`);
  lines.push(`        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::${bitOrder});`);
  if (anyVariantNeedsContext) {
    lines.push(`        Self::decode_with_decoder_and_context(&mut decoder, None)`);
  } else {
    lines.push(`        Self::decode_with_decoder(&mut decoder)`);
  }
  lines.push(`    }`);
  lines.push(``);

  // Generate decode_with_decoder method
  lines.push(`    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {`);
  if (anyVariantNeedsContext) {
    lines.push(`        Self::decode_with_decoder_and_context(decoder, None)`);
    lines.push(`    }`);
    lines.push(``);

    // Context-aware version
    lines.push(`    pub fn decode_with_decoder_and_context(decoder: &mut BitStreamDecoder, ctx: Option<&HashMap<String, u64>>) -> Result<Self> {`);
  }

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
      const needsSuffix = typeNeedsInputOutputSuffix(variant.type, schema);
      const decodeTypeName = needsSuffix ? `${variantTypeName}Output` : variantTypeName;
      const condition = translateConditionToRust(variant.when);
      const variantNeedsContext = typesNeedingContext.has(variant.type);

      if (i === 0) {
        lines.push(`        if ${condition} {`);
      } else {
        lines.push(`        } else if ${condition} {`);
      }
      if (variantNeedsContext && anyVariantNeedsContext) {
        lines.push(`            Ok(${name}::${variantTypeName}(${decodeTypeName}::decode_with_decoder_and_context(decoder, ctx)?))`);
      } else {
        lines.push(`            Ok(${name}::${variantTypeName}(${decodeTypeName}::decode_with_decoder(decoder)?))`);
      }
    }

    // Handle fallback or error
    if (fallbackVariant) {
      const variantTypeName = toRustTypeName(fallbackVariant.type);
      const needsSuffix = typeNeedsInputOutputSuffix(fallbackVariant.type, schema);
      const decodeTypeName = needsSuffix ? `${variantTypeName}Output` : variantTypeName;
      const variantNeedsContext = typesNeedingContext.has(fallbackVariant.type);

      if (conditionalVariants.length > 0) {
        lines.push(`        } else {`);
        if (variantNeedsContext && anyVariantNeedsContext) {
          lines.push(`            Ok(${name}::${variantTypeName}(${decodeTypeName}::decode_with_decoder_and_context(decoder, ctx)?))`);
        } else {
          lines.push(`            Ok(${name}::${variantTypeName}(${decodeTypeName}::decode_with_decoder(decoder)?))`);
        }
        lines.push(`        }`);
      } else {
        if (variantNeedsContext && anyVariantNeedsContext) {
          lines.push(`        Ok(${name}::${variantTypeName}(${decodeTypeName}::decode_with_decoder_and_context(decoder, ctx)?))`);
        } else {
          lines.push(`        Ok(${name}::${variantTypeName}(${decodeTypeName}::decode_with_decoder(decoder)?))`);
        }
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
 * Check if field is conditional
 * Note: padding fields are never considered conditional (they don't have values)
 */
function isFieldConditional(field: Field): boolean {
  // Padding fields are never conditional (they don't produce values)
  if (field.type === "padding") {
    return false;
  }
  const fieldAny = field as any;
  // Check for conditional property that is not null/undefined
  // (Rust serde serializes Option::None as null in JSON)
  return 'conditional' in fieldAny && fieldAny.conditional != null;
}

// Rust reserved keywords that need r# prefix in conditions (must be defined before usage)
const RUST_RESERVED_KEYWORDS = new Set([
  'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
  'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
  'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
  'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
  'async', 'await', 'dyn', 'abstract', 'become', 'box', 'do', 'final',
  'macro', 'override', 'priv', 'typeof', 'unsized', 'virtual', 'yield', 'try'
]);

/**
 * Convert conditional expression to Rust code
 * E.g., "flags & 0x01" -> "self.flags & 0x01 != 0"
 * E.g., "type == 0x01" -> "self.r#type == 0x01"
 * E.g., "header.flags & 0x01" -> "self.header.as_ref().map_or(false, |h| h.flags & 0x01 != 0)"
 *       (when header is a conditional field)
 *
 * For encoding, the base is "self." - accessing struct fields
 * For decoding, the base is just the variable name (empty string)
 *
 * @param condition - The condition expression from the schema
 * @param basePath - The base path prefix ("self." for encoding, "" for decoding)
 * @param allFields - All fields in the struct, to check which are conditional
 */
function convertConditionalToRust(condition: string | any, basePath: string, allFields?: Field[]): string {
  // Handle null/undefined conditions
  if (condition === null || condition === undefined) {
    return "true"; // Default to always true if no condition
  }

  // Handle non-string conditions (could be an object or other type)
  if (typeof condition !== 'string') {
    // Try to convert to string if possible
    condition = String(condition);
  }

  // First, translate JavaScript operators to Rust
  let rustCondition = translateConditionToRust(condition);

  // Check if this is a bitwise AND expression without comparison (e.g., "flags & 0x01")
  // In JavaScript, this is truthy if non-zero, but in Rust we need explicit comparison
  const isBitwiseOnly = /^[\w.]+\s*&\s*0x[0-9a-fA-F]+$/.test(rustCondition.trim()) ||
                        /^[\w.]+\s*&\s*\d+$/.test(rustCondition.trim());

  // Build a set of conditional field names for quick lookup
  const conditionalFields = new Set<string>();
  if (allFields) {
    for (const field of allFields) {
      if (field.name && isFieldConditional(field)) {
        conditionalFields.add(field.name);
      }
    }
  }

  // Replace field references with the base path and escape reserved keywords
  // Match field paths (including dotted paths like header.flags) as a single unit
  const withBasePath = rustCondition.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\b(?!\s*\()/g,
    (match, fieldPath) => {
      // Don't replace hex prefixes, logical keywords, or operators
      if (['0x', 'and', 'or', 'not', 'true', 'false'].includes(fieldPath.toLowerCase())) {
        return match;
      }

      // Split the path into components
      const parts = fieldPath.split('.');

      // Escape reserved keywords in all parts
      const escapedParts = parts.map((part: string) =>
        RUST_RESERVED_KEYWORDS.has(part) ? `r#${part}` : part
      );

      // Check if the first component is a conditional field (Option type)
      const firstField = parts[0];
      if (parts.length > 1 && conditionalFields.has(firstField)) {
        // Generate Option-safe access: field.as_ref().map_or(false, |f| f.rest_of_path OP VALUE)
        // For now, we'll mark this for special handling by returning a placeholder
        // that will be processed later
        const restPath = escapedParts.slice(1).join('.');
        const escapedFirst = escapedParts[0];
        // Return a special marker that we'll process after the full expression is built
        return `__OPTION_ACCESS__${basePath}${escapedFirst}__SEP__${restPath}__END__`;
      }

      // Simple path - just add the base path prefix
      return `${basePath}${escapedParts.join('.')}`;
    }
  );

  // Process Option access markers
  // Pattern: __OPTION_ACCESS__self.header__SEP__flags__END__ & 0x01
  // Should become: self.header.as_ref().map_or(false, |h| h.flags & 0x01 != 0)
  const optionAccessPattern = /__OPTION_ACCESS__([^_]+)__SEP__([^_]+)__END__/;
  const optionMatch = withBasePath.match(optionAccessPattern);

  if (optionMatch) {
    const optionField = optionMatch[1]; // e.g., "self.header"
    const innerPath = optionMatch[2];   // e.g., "flags"

    // Extract the rest of the expression after the option access
    const afterOption = withBasePath.substring(optionMatch.index! + optionMatch[0].length);

    // Build the inner condition (what goes inside the closure)
    let innerCondition = `h.${innerPath}${afterOption}`;

    // Add != 0 for bitwise expressions if needed
    if (isBitwiseOnly) {
      innerCondition = `${innerCondition} != 0`;
    }

    // Generate Option-safe access
    return `${optionField}.as_ref().map_or(false, |h| ${innerCondition})`;
  }

  // For bitwise-only expressions, add "!= 0" to make it a boolean
  if (isBitwiseOnly) {
    return `${withBasePath} != 0`;
  }

  return withBasePath;
}

/**
 * Collects all inline choice and discriminated_union types from the schema
 * Returns a map of enum name -> array of variant type names
 */
/**
 * Compute the inline enum name from parent type + field name.
 * E.g., parentType="FloorEntry", fieldName="data" → "FloorEntryData"
 */
function inlineEnumName(parentTypeName: string, fieldName: string): string {
  return `${toRustTypeName(parentTypeName)}${toRustTypeName(fieldName)}`;
}

function collectInlineUnionTypes(schema: BinarySchema): Record<string, string[]> {
  const unionEnums: Record<string, string[]> = {};

  function visitField(field: any, parentTypeName: string): void {
    if (!field) return;

    // Handle choice types
    if (field.type === "choice" && field.choices) {
      const choiceTypes = field.choices.map((c: any) => c.type);
      const enumName = inlineEnumName(parentTypeName, field.name || "");
      unionEnums[enumName] = choiceTypes;
    }

    // Handle inline discriminated_union fields
    if (field.type === "discriminated_union" && field.variants) {
      const variantTypes = field.variants.map((v: any) => v.type);
      const enumName = inlineEnumName(parentTypeName, field.name || "");
      unionEnums[enumName] = variantTypes;
    }

    // Recurse into array items — use the array field's name for the enum name
    if (field.type === "array" && field.items) {
      const items = { ...field.items, name: field.name };
      visitField(items, parentTypeName);
    }
  }

  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    if ("sequence" in (typeDef as any)) {
      for (const field of (typeDef as any).sequence) {
        visitField(field, typeName);
      }
    }
  }

  return unionEnums;
}

/**
 * Generates an enum for inline union types (choice or discriminated_union)
 * Uses Output types for variants since these are created during decoding
 */
function generateUnionEnum(enumName: string, variantTypes: string[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Check if any variant needs decode context
  const typesNeedingContext = getTypesNeedingDecodeContext(schema);
  const anyVariantNeedsContext = variantTypes.some(t => typesNeedingContext.has(t));

  // Generate enum definition - variants wrap Output types for composite types, plain types otherwise
  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub enum ${enumName} {`);
  for (const typeName of variantTypes) {
    const rustTypeName = toRustTypeName(typeName);
    const needsSuffix = typeNeedsInputOutputSuffix(typeName, schema);
    const wrappedType = needsSuffix ? `${rustTypeName}Output` : rustTypeName;
    lines.push(`    ${rustTypeName}(${wrappedType}),`);
  }
  lines.push(`}`);
  lines.push(``);

  // Check if any variant needs encode context (parent refs or selectors in computed fields,
  // OR has nested struct sub-fields that need parent context from the variant)
  const anyVariantHasNestedStructNeedingContext = variantTypes.some(t => {
    const td = schema.types[t];
    if (!td || !("sequence" in td)) return false;
    return ((td as any).sequence as any[]).some((f: any) => {
      if (!f.name || f.type === "padding" || f.computed || f.const != null) return false;
      const fTypeDef = schema.types?.[f.type as string];
      if (!fTypeDef || !("sequence" in fTypeDef)) return false;
      const fSeq = (fTypeDef as any).sequence as Field[];
      return typeHasParentReferences(fSeq) || hasNestedStructFields(fSeq, schema);
    });
  });
  // Check if any variant transitively contains back_references
  const anyVariantContainsBackRef = variantTypes.some(t => typeTransitivelyContainsBackReference(t, schema));

  const anyVariantNeedsEncodeContext = variantTypes.some(t => variantTypeNeedsEncodeContext(t, schema)) || anyVariantHasNestedStructNeedingContext || anyVariantContainsBackRef;

  // Generate impl block
  lines.push(`impl ${enumName} {`);

  // Generate encode method - delegates to encode_with_context if any variant needs context
  if (anyVariantNeedsEncodeContext) {
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into_with_context(&mut encoder, &EncodeContext::new())?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
    lines.push(`        self.encode_into_with_context(encoder, &EncodeContext::new())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into_with_context(&mut encoder, ctx)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into_with_context(&self, encoder: &mut BitStreamEncoder, ctx: &EncodeContext) -> Result<()> {`);
  } else {
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into(&mut encoder)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
  }
  lines.push(`        match self {`);
  for (const typeName of variantTypes) {
    const rustTypeName = toRustTypeName(typeName);
    const typeDef = schema.types[typeName];
    if (typeDef && "sequence" in typeDef) {
      const sequence = (typeDef as any).sequence;
      lines.push(`            ${enumName}::${rustTypeName}(v) => {`);
      const rustEndianness = mapEndianness(defaultEndianness);

      // Check if any sub-field is a nested struct that needs parent context from this variant
      const variantHasNestedStructNeedingContext = sequence.some((f: any) => {
        if (!f.name || f.type === "padding" || (f as any).computed || (f as any).const != null) return false;
        const fTypeDef = schema.types?.[f.type as string];
        if (!fTypeDef || !("sequence" in fTypeDef)) return false;
        const fSeq = (fTypeDef as any).sequence as Field[];
        return typeHasParentReferences(fSeq) || hasNestedStructFields(fSeq, schema);
      });

      // Build per-variant context if needed
      if (variantHasNestedStructNeedingContext) {
        lines.push(`                // Build per-variant context for nested struct sub-fields`);
        lines.push(`                let mut variant_fields: HashMap<String, FieldValue> = HashMap::new();`);
        for (const vf of sequence) {
          const vfAny = vf as any;
          if (!vf.name || vf.type === "padding" || vfAny.computed || vfAny.const != null) continue;
          const vfTypeDef = schema.types?.[vf.type as string];
          const vfIsNestedStruct = vfTypeDef && "sequence" in vfTypeDef;
          if (vfIsNestedStruct) continue;

          const vfRustName = toRustFieldName(vf.name);
          const vfType = vf.type as string;
          if (vfType === "string") {
            lines.push(`                variant_fields.insert("${vf.name}".to_string(), FieldValue::String(v.${vfRustName}.clone()));`);
          } else if (vfType === "array" && (vf as any).items?.type === "uint8") {
            lines.push(`                variant_fields.insert("${vf.name}".to_string(), FieldValue::Bytes(v.${vfRustName}.clone()));`);
          } else if (["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64"].includes(vfType)) {
            const conversion = getFieldValueConversion(vf);
            lines.push(`                variant_fields.insert("${vf.name}".to_string(), ${conversion}(v.${vfRustName}));`);
          }
        }
        lines.push(`                let variant_ctx = EncodeContext::new().extend_with_parent(variant_fields);`);
      }

      for (const field of sequence) {
        if (!field.name || field.type === "padding") continue;
        const fieldName = toRustFieldName(field.name);
        const fieldEndianness = field.endianness ? mapEndianness(field.endianness) : rustEndianness;

        // Handle const fields - write the constant value directly
        const fieldAny = field as any;
        if (fieldAny.const != null) {
          lines.push(...generateEncodeConstField(field, fieldAny.const, defaultEndianness, "                "));
          continue;
        }

        // Handle computed fields - compute value inline rather than reading from struct
        if (fieldAny.computed) {
          const computed = fieldAny.computed;
          const target = computed.target as string | undefined;
          const isSimpleTarget = target && !target.startsWith("../") && !target.includes("[") && !target.includes("<");

          if (isSimpleTarget) {
            // Simple local target - compute inline (no context needed)
            if (computed.type === "length_of") {
              const targetRust = toRustFieldName(target);
              const computedVarName = `${fieldName}_computed`;

              // Find the target field to determine what length calculation to use
              const targetField = sequence.find((f: any) => f.name === target);
              const targetType = targetField?.type as string | undefined;
              const isCompositeTarget = targetType && schema.types && schema.types[targetType] && targetType !== "array";

              if (targetType === "discriminated_union") {
                // Discriminated union - encode variant to get byte length
                lines.push(`                let ${computedVarName} = v.${targetRust}.encode()?.len();`);
              } else if (isCompositeTarget) {
                // Composite type - convert Output to Input and encode to measure byte length
                const compositeRustName = toRustTypeName(targetType!);
                const compositeNeedsSuffix = typeNeedsInputOutputSuffix(targetType!, schema);
                if (compositeNeedsSuffix) {
                  lines.push(`                let ${computedVarName} = ${compositeRustName}Input::from(v.${targetRust}.clone()).encode()?.len();`);
                } else {
                  lines.push(`                let ${computedVarName} = v.${targetRust}.encode()?.len();`);
                }
              } else {
                // Array, string, or primitive - use .len()
                lines.push(`                let ${computedVarName} = v.${targetRust}.len();`);
              }

                if (computed.offset !== undefined && computed.offset !== 0) {
                  lines.push(`                let ${computedVarName} = ${computedVarName} + ${computed.offset};`);
                }
                lines.push(...generateComputedFieldWrite(field, computedVarName, fieldEndianness, "                "));
                continue;
            } else if (computed.type === "count_of") {
              const targetRust = toRustFieldName(target);
              const computedVarName = `${fieldName}_computed`;
              lines.push(`                let ${computedVarName} = v.${targetRust}.len();`);
              lines.push(...generateComputedFieldWrite(field, computedVarName, fieldEndianness, "                "));
              continue;
            } else if (computed.type === "crc32_of") {
              const targetRust = toRustFieldName(target);
              const crcInputVar = `${fieldName}_crc_input`;
              lines.push(`                let ${crcInputVar}: Vec<u8> = v.${targetRust}.iter().cloned().collect();`);
              lines.push(`                let ${fieldName}_computed = binschema_runtime::crc32(&${crcInputVar});`);
              lines.push(`                encoder.write_uint32(${fieldName}_computed, Endianness::${fieldEndianness});`);
              continue;
            }
          } else if (anyVariantNeedsEncodeContext && target) {
            // Complex target with parent refs or selectors - use context to compute
            const computedVarName = `${fieldName}_computed`;

            // Handle position_of with first/last selector
            const firstLastInfo = parseFirstLastTarget(target);
            if (firstLastInfo) {
              const { arrayPath, filterType, selector } = firstLastInfo;
              const positionKey = `${arrayPath}_${filterType}`;
              lines.push(`                // Computed field '${field.name}': position_of with ${selector}<${filterType}> selector`);
              if (selector === "first") {
                lines.push(`                let ${computedVarName} = ctx.get_first_position("${positionKey}").unwrap_or(0xFFFFFFFF);`);
              } else {
                lines.push(`                let ${computedVarName} = ctx.get_last_position("${positionKey}").unwrap_or(0xFFFFFFFF);`);
              }
              lines.push(...generateComputedFieldWrite(field, computedVarName, fieldEndianness, "                "));
              continue;
            }

            // Handle position_of with corresponding selector
            const correspondingInfo = parseCorrespondingTarget(target);
            if (correspondingInfo) {
              const { arrayPath, filterType } = correspondingInfo;
              const positionKey = `${arrayPath}_${filterType}`;
              lines.push(`                // Computed field '${field.name}': ${computed.type} with corresponding<${filterType}> selector`);
              // Use the current variant type name for the type index key (not the field name)
              lines.push(`                let ${computedVarName}_type_idx = ctx.get_type_index("${arrayPath}_${typeName}");`);
              lines.push(`                let ${computedVarName}_corr_idx = if ${computedVarName}_type_idx > 0 { ${computedVarName}_type_idx - 1 } else { 0 };`);

              if (computed.type === "position_of") {
                lines.push(`                let ${computedVarName} = ctx.get_position("${positionKey}", ${computedVarName}_corr_idx).unwrap_or(0xFFFFFFFF);`);
              } else if (computed.type === "length_of") {
                // length_of with corresponding selector: look up sub-field from Items in parent context
                const { remainingPath } = correspondingInfo;
                const fieldAccess = remainingPath ? remainingPath.slice(1) : ""; // Remove leading "."
                lines.push(`                let ${computedVarName} = match ctx.find_parent_field("${arrayPath}") {`);
                lines.push(`                    Some(array_val) => {`);
                lines.push(`                        match array_val.get_nth_item_of_type("${filterType}", ${computedVarName}_corr_idx) {`);
                if (fieldAccess) {
                  lines.push(`                            Some(item_fields) => {`);
                  lines.push(`                                item_fields.get("${fieldAccess}").map(|v| v.length_of_value()).unwrap_or(0)`);
                  lines.push(`                            },`);
                } else {
                  lines.push(`                            Some(item_fields) => {`);
                  lines.push(`                                item_fields.get("_encoded_size").map(|v| v.length_of_value()).unwrap_or(0)`);
                  lines.push(`                            },`);
                }
                lines.push(`                            None => 0,`);
                lines.push(`                        }`);
                lines.push(`                    },`);
                lines.push(`                    None => 0,`);
                lines.push(`                };`);
              } else if (computed.type === "crc32_of") {
                // crc32_of with corresponding selector: look up sub-field bytes from Items
                const { remainingPath } = correspondingInfo;
                const fieldAccess = remainingPath ? remainingPath.slice(1) : "";
                lines.push(`                let ${computedVarName} = match ctx.find_parent_field("${arrayPath}") {`);
                lines.push(`                    Some(array_val) => {`);
                lines.push(`                        match array_val.get_nth_item_of_type("${filterType}", ${computedVarName}_corr_idx) {`);
                if (fieldAccess) {
                  lines.push(`                            Some(item_fields) => {`);
                  lines.push(`                                item_fields.get("${fieldAccess}").map(|v| binschema_runtime::crc32(&v.to_bytes())).unwrap_or(0)`);
                  lines.push(`                            },`);
                } else {
                  lines.push(`                            Some(item_fields) => {`);
                  lines.push(`                                item_fields.get("_encoded_size").map(|v| binschema_runtime::crc32(&v.to_bytes())).unwrap_or(0)`);
                  lines.push(`                            },`);
                }
                lines.push(`                            None => 0,`);
                lines.push(`                        }`);
                lines.push(`                    },`);
                lines.push(`                    None => 0,`);
                lines.push(`                };`);
              } else if (computed.type === "sum_of_type_sizes") {
                // sum_of_type_sizes with corresponding selector
                const elementType = computed.element_type || filterType;
                lines.push(`                let ${computedVarName} = match ctx.find_parent_field("${arrayPath}") {`);
                lines.push(`                    Some(field_value) => field_value.sum_type_sizes("${elementType}"),`);
                lines.push(`                    None => 0,`);
                lines.push(`                };`);
              } else {
                lines.push(`                let ${computedVarName} = 0_usize; // ${computed.type} with corresponding not fully implemented`);
              }
              lines.push(...generateComputedFieldWrite(field, computedVarName, fieldEndianness, "                "));
              continue;
            }

            // Handle parent reference
            const parentRef = parseParentPath(target);
            if (parentRef) {
              const { levelsUp, fieldName: targetFieldName } = parentRef;
              lines.push(`                // Computed field '${field.name}': ${computed.type} '${target}' (parent reference)`);
              if (computed.type === "length_of") {
                lines.push(`                let ${computedVarName} = match ctx.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
                lines.push(`                    Some(field_value) => field_value.length_of_value(),`);
                lines.push(`                    None => 0,`);
                lines.push(`                };`);
              } else if (computed.type === "count_of") {
                lines.push(`                let ${computedVarName} = match ctx.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
                lines.push(`                    Some(field_value) => field_value.len(),`);
                lines.push(`                    None => 0,`);
                lines.push(`                };`);
              } else if (computed.type === "position_of") {
                const fieldSize = getFieldSize(field);
                lines.push(`                let ${computedVarName} = encoder.byte_offset() + ${fieldSize};`);
              } else if (computed.type === "sum_of_type_sizes") {
                const elementType = computed.element_type || "";
                lines.push(`                let ${computedVarName} = match ctx.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
                lines.push(`                    Some(field_value) => field_value.sum_type_sizes("${elementType}"),`);
                lines.push(`                    None => 0,`);
                lines.push(`                };`);
              } else {
                lines.push(`                let ${computedVarName} = 0_usize; // ${computed.type} with parent ref not fully implemented in choice`);
              }
              if (computed.offset !== undefined && computed.offset !== 0) {
                lines.push(`                let ${computedVarName} = ${computedVarName} + ${computed.offset};`);
              }
              lines.push(...generateComputedFieldWrite(field, computedVarName, fieldEndianness, "                "));
              continue;
            }

            // Unrecognized complex target - fall through to write stored value
          }
          // Fall through for complex targets without context or other computed types - encode the field value as-is
        }

        // Encode each field from the Output struct
        switch (field.type) {
          case "uint8":
            lines.push(`                encoder.write_uint8(v.${fieldName});`);
            break;
          case "uint16":
            lines.push(`                encoder.write_uint16(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "uint32":
            lines.push(`                encoder.write_uint32(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "uint64":
            lines.push(`                encoder.write_uint64(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "int8":
            lines.push(`                encoder.write_int8(v.${fieldName});`);
            break;
          case "int16":
            lines.push(`                encoder.write_int16(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "int32":
            lines.push(`                encoder.write_int32(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "int64":
            lines.push(`                encoder.write_int64(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "float32":
            lines.push(`                encoder.write_float32(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "float64":
            lines.push(`                encoder.write_float64(v.${fieldName}, Endianness::${fieldEndianness});`);
            break;
          case "string": {
            const strLines = generateEncodeString(field, `v.${fieldName}`, defaultEndianness, "                ");
            lines.push(...strLines);
            break;
          }
          case "varlength": {
            const vlEnc = (field as any).encoding || "der";
            lines.push(`                encoder.write_varlength(v.${fieldName}, "${vlEnc}")?;`);
            break;
          }
          case "array": {
            // Encode array items inline
            const arrayItems = field.items;
            if (arrayItems) {
              switch (arrayItems.type) {
                case "uint8":
                  lines.push(`                for item in &v.${fieldName} {`);
                  lines.push(`                    encoder.write_uint8(*item);`);
                  lines.push(`                }`);
                  break;
                case "uint16":
                  lines.push(`                for item in &v.${fieldName} {`);
                  lines.push(`                    encoder.write_uint16(*item, Endianness::${fieldEndianness});`);
                  lines.push(`                }`);
                  break;
                case "uint32":
                  lines.push(`                for item in &v.${fieldName} {`);
                  lines.push(`                    encoder.write_uint32(*item, Endianness::${fieldEndianness});`);
                  lines.push(`                }`);
                  break;
                default: {
                  // Check if item type is a named type with encode()
                  const itemTypeDef = schema.types[arrayItems.type];
                  if (itemTypeDef) {
                    if ("sequence" in itemTypeDef) {
                      const itemTypeName = toRustTypeName(arrayItems.type);
                      const itemNeedsSplit = typeNeedsInputOutputSplit(arrayItems.type, schema);
                      lines.push(`                for item in &v.${fieldName} {`);
                      if (itemNeedsSplit) {
                        // Composite type with split - convert Output to Input and encode
                        lines.push(`                    ${itemTypeName}Input::from(item.clone()).encode_into(encoder)?;`);
                      } else {
                        // Unified type - encode directly
                        lines.push(`                    item.encode_into(encoder)?;`);
                      }
                      lines.push(`                }`);
                    } else {
                      // Simple type alias with encode()
                      lines.push(`                for item in &v.${fieldName} {`);
                      lines.push(`                    item.encode_into(encoder)?;`);
                      lines.push(`                }`);
                    }
                  } else {
                    lines.push(`                return Err(binschema_runtime::BinSchemaError::NotImplemented("encoding array of '${arrayItems.type}' in choice variant".to_string()));`);
                  }
                  break;
                }
              }
            }
            break;
          }
          default: {
            // Check if it's a named type reference with encode method
            const typeDef2 = schema.types[field.type];
            const needsSuffix2 = typeNeedsInputOutputSuffix(field.type, schema);
            if (typeDef2 && !needsSuffix2) {
              // Type without Input/Output split - encode directly
              if (anyVariantContainsBackRef && typeTransitivelyContainsBackReference(field.type, schema)) {
                // Field transitively contains back_references — pass compression context
                lines.push(`                let field_ctx = ctx.with_base_offset(encoder.byte_offset());`);
                lines.push(`                v.${fieldName}.encode_into_with_context(encoder, &field_ctx)?;`);
              } else {
                lines.push(`                v.${fieldName}.encode_into(encoder)?;`);
              }
            } else if (typeDef2 && isCompositeType(field.type, schema)) {
              // Composite type that needs Input/Output split - convert Output to Input and call encode()
              const refTypeName = toRustTypeName(field.type);
              // Check if this nested struct type needs context from the variant
              const nestedTypeDef = schema.types[field.type];
              const nestedSeq = nestedTypeDef && "sequence" in nestedTypeDef ? (nestedTypeDef as any).sequence as Field[] : [];
              const nestedNeedsCtx = nestedSeq.length > 0 && (typeHasParentReferences(nestedSeq) || hasNestedStructFields(nestedSeq, schema));
              if (nestedNeedsCtx && variantHasNestedStructNeedingContext) {
                lines.push(`                ${refTypeName}Input::from(v.${fieldName}.clone()).encode_into_with_context(encoder, &variant_ctx)?;`);
              } else {
                lines.push(`                ${refTypeName}Input::from(v.${fieldName}.clone()).encode_into(encoder)?;`);
              }
            } else {
              // Unknown type - encoding not supported
              lines.push(`                return Err(binschema_runtime::BinSchemaError::NotImplemented("encoding field '${field.name}' of type '${field.type}' in choice variant".to_string()));`);
            }
            break;
          }
        }
      }
      lines.push(`            }`);
    } else {
      // Non-sequence type - try calling encode()
      if (anyVariantNeedsEncodeContext && typeTransitivelyContainsBackReference(typeName, schema)) {
        // Variant transitively contains back_references — pass compression context
        lines.push(`            ${enumName}::${rustTypeName}(v) => {`);
        lines.push(`                let variant_ctx = ctx.with_base_offset(encoder.byte_offset());`);
        lines.push(`                v.encode_into_with_context(encoder, &variant_ctx)?;`);
        lines.push(`            }`);
      } else {
        lines.push(`            ${enumName}::${rustTypeName}(v) => { v.encode_into(encoder)?; }`);
      }
    }
  }
  lines.push(`        }`);
  lines.push(`        Ok(())`);
  lines.push(`    }`);
  lines.push(``);

  // Generate type_name method - returns the original schema type name for sum_of_type_sizes
  lines.push(`    pub fn type_name(&self) -> &'static str {`);
  lines.push(`        match self {`);
  for (const typeName of variantTypes) {
    const rustTypeName = toRustTypeName(typeName);
    lines.push(`            ${enumName}::${rustTypeName}(_) => "${typeName}",`);
  }
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(``);

  // Generate decode method
  lines.push(`    pub fn decode(bytes: &[u8]) -> Result<Self> {`);
  lines.push(`        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::${bitOrder});`);
  if (anyVariantNeedsContext) {
    lines.push(`        Self::decode_with_decoder_and_context(&mut decoder, None)`);
  } else {
    lines.push(`        Self::decode_with_decoder(&mut decoder)`);
  }
  lines.push(`    }`);
  lines.push(``);

  // Generate decode_with_decoder method
  // Try each variant in order until one succeeds
  lines.push(`    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {`);
  if (anyVariantNeedsContext) {
    lines.push(`        Self::decode_with_decoder_and_context(decoder, None)`);
    lines.push(`    }`);
    lines.push(``);

    // Context-aware version
    lines.push(`    pub fn decode_with_decoder_and_context(decoder: &mut BitStreamDecoder, ctx: Option<&HashMap<String, u64>>) -> Result<Self> {`);
  }
  lines.push(`        // Union type - try each variant in order until one succeeds`);

  // Generate try-each-variant pattern
  for (let i = 0; i < variantTypes.length; i++) {
    const typeName = variantTypes[i];
    const rustTypeName = toRustTypeName(typeName);
    const variantNeedsContext = typesNeedingContext.has(typeName);

    if (i === 0) {
      lines.push(`        let start_pos = decoder.position();`);
    }
    const variantNeedsSplit = typeNeedsInputOutputSplit(typeName, schema);
    const decodeType = variantNeedsSplit ? `${rustTypeName}Output` : rustTypeName;
    if (variantNeedsContext && anyVariantNeedsContext) {
      lines.push(`        if let Ok(v) = ${decodeType}::decode_with_decoder_and_context(decoder, ctx) {`);
    } else {
      lines.push(`        if let Ok(v) = ${decodeType}::decode_with_decoder(decoder) {`);
    }
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
function generateInputStruct(name: string, schemaTypeName: string, fields: Field[], schema: BinarySchema): string[] {
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
      rustType = mapFieldToRustTypeForInput(field, schema, schemaTypeName);
    }
    // Wrap conditional fields in Option<>
    if (isFieldConditional(field)) {
      rustType = `Option<${rustType}>`;
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
function generateOutputStruct(name: string, schemaTypeName: string, fields: Field[], schema: BinarySchema, instances?: any[]): string[] {
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
      rustType = mapFieldToRustType(field, schema, schemaTypeName);
    }
    // Wrap conditional fields in Option<>
    if (isFieldConditional(field)) {
      rustType = `Option<${rustType}>`;
    }
    const fieldName = toRustFieldName(field.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }

  // Add instance fields (position-based, decode-only)
  if (instances && instances.length > 0) {
    for (const instance of instances) {
      // Skip inline discriminated unions for now
      if (typeof instance.type === "object") continue;
      const fieldName = toRustFieldName(instance.name);
      const rustType = getInstanceFieldRustType(instance, schema);
      lines.push(`    pub ${fieldName}: ${rustType},`);
    }
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
 * Generates a unified Rust struct definition (no Input/Output split)
 * Used when the type has no computed or const fields, so Input and Output are identical.
 * The struct name has no suffix (just the type name).
 */
function generateUnifiedStruct(name: string, schemaTypeName: string, fields: Field[], schema: BinarySchema, instances?: any[]): string[] {
  const lines: string[] = [];

  lines.push(`#[derive(Debug, Clone, PartialEq)]`);
  lines.push(`pub struct ${name} {`);

  for (const field of fields) {
    if (!field.name || !field.type || field.type === "padding") {
      continue;
    }
    // Special handling for bitfields with sub-fields - use generated struct name
    let rustType: string;
    if (field.type === "bitfield" && (field as any).fields && Array.isArray((field as any).fields) && (field as any).fields.length > 0) {
      rustType = `${name}${toRustTypeName(field.name)}`;
    } else {
      rustType = mapFieldToRustType(field, schema, schemaTypeName);
    }
    // Wrap conditional fields in Option<>
    if (isFieldConditional(field)) {
      rustType = `Option<${rustType}>`;
    }
    const fieldName = toRustFieldName(field.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }

  // Add instance fields (position-based, decode-only)
  if (instances && instances.length > 0) {
    for (const instance of instances) {
      if (typeof instance.type === "object") continue;
      const fieldName = toRustFieldName(instance.name);
      const rustType = getInstanceFieldRustType(instance, schema);
      lines.push(`    pub ${fieldName}: ${rustType},`);
    }
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates struct definitions for a sequence type.
 * If the type needs Input/Output split (has computed/const fields), generates both plus alias.
 * Otherwise generates a single unified struct.
 */
function generateStructs(name: string, schemaTypeName: string, fields: Field[], schema: BinarySchema, instances?: any[]): string[] {
  const lines: string[] = [];
  if (typeNeedsInputOutputSplit(schemaTypeName, schema)) {
    lines.push(...generateInputStruct(name, schemaTypeName, fields, schema));
    lines.push(...generateOutputStruct(name, schemaTypeName, fields, schema, instances));
    lines.push(...generateBackwardCompatAlias(name));
  } else {
    lines.push(...generateUnifiedStruct(name, schemaTypeName, fields, schema, instances));
  }
  return lines;
}

/**
 * Generates a simple Rust struct definition (for type aliases/wrappers)
 * This is used for wrapper structs that don't need Input/Output separation
 */
function generateSimpleStruct(name: string, fields: Field[], schemaTypeName?: string): string[] {
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
      rustType = mapFieldToRustType(field, undefined, schemaTypeName);
    }
    const fieldName = toRustFieldName(field.name);
    lines.push(`    pub ${fieldName}: ${rustType},`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates impl blocks for a sequence type.
 * If the type needs Input/Output split, generates separate impls for Input (encode) and Output (decode)
 * plus a From conversion. Otherwise generates a single impl with both encode and decode.
 */
function generateImpl(name: string, schemaTypeName: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema, instances?: any[]): string[] {
  const lines: string[] = [];

  if (typeNeedsInputOutputSplit(schemaTypeName, schema)) {
    // Split mode: encode on Input, decode on Output, From conversion
    lines.push(`impl ${name}Input {`);
    lines.push(...generateEncodeMethod(fields, defaultEndianness, defaultBitOrder, schema, schemaTypeName));
    lines.push(`}`);
    lines.push(``);

    lines.push(`impl ${name}Output {`);
    lines.push(...generateDecodeMethod(name, fields, defaultEndianness, defaultBitOrder, schema, instances));
    // Also add encode delegation methods on Output so callers can call .encode()
    // on Output types without manually converting to Input first
    lines.push(...generateOutputEncodeDelegation(name, fields, schema));
    lines.push(`}`);
    lines.push(``);

    // Generate From<Output> for Input conversion (drops computed/const fields)
    // This enables encoding from Output structs (e.g., in choice variant encoding)
    lines.push(...generateFromOutputToInput(name, fields, schema));
  } else {
    // Unified mode: single impl with both encode and decode
    lines.push(`impl ${name} {`);
    lines.push(...generateEncodeMethod(fields, defaultEndianness, defaultBitOrder, schema, schemaTypeName));
    lines.push(...generateDecodeMethod(name, fields, defaultEndianness, defaultBitOrder, schema, instances));
    lines.push(`}`);
    lines.push(``);
  }

  return lines;
}

/**
 * Generates encode delegation methods on the Output struct.
 * These allow callers to call .encode() on Output types directly,
 * without manually converting to Input first.
 * The delegation methods simply convert to Input via From and call the Input's encode.
 */
function generateOutputEncodeDelegation(name: string, fields: Field[], schema: BinarySchema): string[] {
  const lines: string[] = [];

  // Detect if the encode method uses context (same logic as generateEncodeMethod)
  const hasParentRefs = typeHasParentReferences(fields);
  const hasNestedStructs = hasNestedStructFields(fields, schema);

  let fieldsContainBackRef = false;
  for (const field of fields) {
    const fieldType = field.type as string;
    if (fieldType === "array") {
      const items = (field as any).items;
      if (items?.type && schema.types?.[items.type]) {
        if (typeTransitivelyContainsBackReference(items.type, schema)) {
          fieldsContainBackRef = true;
          break;
        }
      }
      if (items?.type === "choice" || items?.type === "discriminated_union") {
        const choiceVariants: string[] = (items.choices || items.variants || []).map((c: any) => c.type);
        if (choiceVariants.some((t: string) => typeTransitivelyContainsBackReference(t, schema))) {
          fieldsContainBackRef = true;
          break;
        }
      }
    } else if (fieldType === "choice" || fieldType === "discriminated_union") {
      const fieldAny = field as any;
      const variantTypes: string[] = (fieldAny.choices || fieldAny.variants || []).map((c: any) => c.type);
      if (variantTypes.some((t: string) => typeTransitivelyContainsBackReference(t, schema))) {
        fieldsContainBackRef = true;
        break;
      }
    } else if (schema.types?.[fieldType]) {
      if (typeTransitivelyContainsBackReference(fieldType, schema)) {
        fieldsContainBackRef = true;
        break;
      }
    }
  }

  const needsContext = hasParentRefs || hasNestedStructs || fieldsContainBackRef;

  // Generate encode() delegation
  lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
  lines.push(`        ${name}Input::from(self.clone()).encode()`);
  lines.push(`    }`);

  // Generate encode_into() delegation
  if (needsContext) {
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
    lines.push(`        ${name}Input::from(self.clone()).encode_into(encoder)`);
    lines.push(`    }`);
    lines.push(`    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {`);
    lines.push(`        ${name}Input::from(self.clone()).encode_with_context(ctx)`);
    lines.push(`    }`);
    lines.push(`    pub fn encode_into_with_context(&self, encoder: &mut BitStreamEncoder, ctx: &EncodeContext) -> Result<()> {`);
    lines.push(`        ${name}Input::from(self.clone()).encode_into_with_context(encoder, ctx)`);
    lines.push(`    }`);
  } else {
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
    lines.push(`        ${name}Input::from(self.clone()).encode_into(encoder)`);
    lines.push(`    }`);
  }

  return lines;
}

/**
 * Determines if a field needs type conversion in From<Output> for Input impl.
 * Returns the conversion expression for the field value.
 * Composite types need .into(), arrays of composites need .into_iter().map().collect(), etc.
 */
function generateFromFieldConversion(fieldName: string, field: Field, schema: BinarySchema): string {
  const isConditional = isFieldConditional(field);

  // Helper: check if an array item type needs conversion
  function arrayItemNeedsConversion(items: any): boolean {
    if (!items || !items.type) return false;
    const itemType = items.type;
    // Primitive types don't need conversion
    if (["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64",
         "float32", "float64", "string", "bit", "bitfield", "varlength"].includes(itemType)) {
      return false;
    }
    // Choice and discriminated_union enums don't have Input/Output split
    if (itemType === "choice" || itemType === "discriminated_union") {
      return false;
    }
    // Array of arrays - check recursively
    if (itemType === "array") {
      return arrayItemNeedsConversion(items.items);
    }
    // Named type reference - check if composite
    return isCompositeType(itemType, schema);
  }

  // Helper: determine if the base (unwrapped) field type needs conversion
  function baseFieldNeedsConversion(): boolean {
    switch (field.type) {
      case "uint8": case "uint16": case "uint32": case "uint64":
      case "int8": case "int16": case "int32": case "int64":
      case "float32": case "float64":
      case "string": case "bit": case "bitfield": case "varlength":
        return false;
      case "choice":
      case "discriminated_union":
        // Enums don't have Input/Output split
        return false;
      case "array":
        return arrayItemNeedsConversion((field as any).items);
      case "optional": {
        const valueTypeName = (field as any).value_type;
        if (!valueTypeName) return false;
        return isCompositeType(valueTypeName, schema);
      }
      case "back_reference": {
        const targetType = (field as any).target_type;
        if (!targetType) return false;
        return isCompositeType(targetType, schema);
      }
      default: {
        // Named type reference
        return isCompositeType(field.type, schema);
      }
    }
  }

  // Helper: generate the conversion expression for a non-optional value
  function baseConversion(accessor: string): string {
    switch (field.type) {
      case "array": {
        if (arrayItemNeedsConversion((field as any).items)) {
          return `${accessor}.into_iter().map(|x| x.into()).collect()`;
        }
        return accessor;
      }
      case "optional": {
        const valueTypeName = (field as any).value_type;
        if (valueTypeName && isCompositeType(valueTypeName, schema)) {
          return `${accessor}.map(|x| x.into())`;
        }
        return accessor;
      }
      case "back_reference":
      default: {
        // For composite type references, use .into()
        if (baseFieldNeedsConversion()) {
          return `${accessor}.into()`;
        }
        return accessor;
      }
    }
  }

  const accessor = `o.${fieldName}`;

  if (!baseFieldNeedsConversion()) {
    // No conversion needed (including conditional wrapping, since Option<Primitive> = Option<Primitive>)
    return accessor;
  }

  // For conditional fields: the field is Option<T> in both Input and Output,
  // but the inner T differs. Need to .map() the conversion.
  if (isConditional) {
    switch (field.type) {
      case "array": {
        if (arrayItemNeedsConversion((field as any).items)) {
          return `${accessor}.map(|v| v.into_iter().map(|x| x.into()).collect())`;
        }
        return accessor;
      }
      case "optional": {
        // Optional + conditional = Option<Option<T>>, but let's handle the inner
        const valueTypeName = (field as any).value_type;
        if (valueTypeName && isCompositeType(valueTypeName, schema)) {
          return `${accessor}.map(|v| v.map(|x| x.into()))`;
        }
        return accessor;
      }
      default: {
        // Conditional composite type: Option<TypeOutput> -> Option<TypeInput>
        return `${accessor}.map(|x| x.into())`;
      }
    }
  }

  return baseConversion(accessor);
}

/**
 * Generates a From<XOutput> for XInput impl that copies only Input fields
 * Handles type conversion for composite types (Vec, Option, nested structs)
 */
function generateFromOutputToInput(name: string, fields: Field[], schema: BinarySchema): string[] {
  const lines: string[] = [];
  const inputFields = fields.filter(f => f.name && f.type && f.type !== "padding" && isInputField(f));

  lines.push(`impl From<${name}Output> for ${name}Input {`);
  lines.push(`    fn from(o: ${name}Output) -> Self {`);
  lines.push(`        Self {`);
  for (const field of inputFields) {
    const fieldName = toRustFieldName(field.name!);
    const conversion = generateFromFieldConversion(fieldName, field, schema);
    lines.push(`            ${fieldName}: ${conversion},`);
  }
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates a simple impl block with encode and decode methods (for type aliases)
 * This is used for wrapper structs that don't need Input/Output separation
 */
function generateSimpleImpl(name: string, schemaTypeName: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema): string[] {
  const lines: string[] = [];

  lines.push(`impl ${name} {`);

  // Generate encode method
  lines.push(...generateEncodeMethod(fields, defaultEndianness, defaultBitOrder, schema, schemaTypeName));

  // Generate decode methods
  lines.push(...generateDecodeMethod(name, fields, defaultEndianness, defaultBitOrder, schema));

  lines.push(`}`);
  lines.push(``);

  return lines;
}

/**
 * Generates the encode method
 * Encodes input fields from self, writes const values directly, skips computed fields
 *
 * If the type has computed fields with parent references (../) or nested struct fields,
 * we generate encode_with_context() that accepts an EncodeContext parameter.
 * The encode() method creates an empty context and delegates to encode_with_context().
 */
function generateEncodeMethod(fields: Field[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema, containingTypeName?: string): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);

  // Check if this type has parent references or nested structs that might need context
  const hasParentRefs = typeHasParentReferences(fields);
  const hasNestedStructs = hasNestedStructFields(fields, schema);

  // Check if any field transitively contains back_reference types (needs compression dict)
  let fieldsContainBackRef = false;
  for (const field of fields) {
    const fieldType = field.type as string;
    if (fieldType === "array") {
      const items = (field as any).items;
      if (items?.type && schema.types?.[items.type]) {
        if (typeTransitivelyContainsBackReference(items.type, schema)) {
          fieldsContainBackRef = true;
          break;
        }
      }
      // Check inline choice/discriminated_union items
      if (items?.type === "choice" || items?.type === "discriminated_union") {
        const choiceVariants: string[] = (items.choices || items.variants || []).map((c: any) => c.type);
        if (choiceVariants.some(t => typeTransitivelyContainsBackReference(t, schema))) {
          fieldsContainBackRef = true;
          break;
        }
      }
    } else if (fieldType === "choice" || fieldType === "discriminated_union") {
      // Inline choice/discriminated_union field — check variants
      const fieldAny = field as any;
      const variantTypes: string[] = (fieldAny.choices || fieldAny.variants || []).map((c: any) => c.type);
      if (variantTypes.some(t => typeTransitivelyContainsBackReference(t, schema))) {
        fieldsContainBackRef = true;
        break;
      }
    } else if (schema.types?.[fieldType]) {
      if (typeTransitivelyContainsBackReference(fieldType, schema)) {
        fieldsContainBackRef = true;
        break;
      }
    }
  }

  const needsContext = hasParentRefs || hasNestedStructs || fieldsContainBackRef;

  if (needsContext) {
    // Generate encode() that delegates to encode_into_with_context()
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    if (fieldsContainBackRef) {
      // Ensure compression dict is created at the top-level encode boundary
      lines.push(`        let mut ctx = EncodeContext::new();`);
      lines.push(`        ctx.ensure_compression_dict();`);
      lines.push(`        self.encode_into_with_context(&mut encoder, &ctx)?;`);
    } else {
      lines.push(`        self.encode_into_with_context(&mut encoder, &EncodeContext::new())?;`);
    }
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
    lines.push(`        self.encode_into_with_context(encoder, &EncodeContext::new())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into_with_context(&mut encoder, ctx)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into_with_context(&self, encoder: &mut BitStreamEncoder, ctx: &EncodeContext) -> Result<()> {`);
  } else {
    lines.push(`    pub fn encode(&self) -> Result<Vec<u8>> {`);
    lines.push(`        let mut encoder = BitStreamEncoder::new(BitOrder::${bitOrder});`);
    lines.push(`        self.encode_into(&mut encoder)?;`);
    lines.push(`        Ok(encoder.finish())`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    pub fn encode_into(&self, encoder: &mut BitStreamEncoder) -> Result<()> {`);
  }

  // If we have nested structs, build parent context for them
  if (hasNestedStructs) {
    lines.push(``);
    lines.push(`        // Build parent context for nested struct encoding`);
    lines.push(`        let mut parent_fields: HashMap<String, FieldValue> = HashMap::new();`);
    for (const field of fields) {
      if (!field.name) continue;
      // Skip padding, const, and computed fields - they don't have input values
      const fieldAny = field as any;
      if (field.type === "padding") continue;
      if (fieldAny.const != null) continue;
      if (fieldAny.computed != null) continue;
      // Skip optional and conditional fields - they are Option<T> in Rust
      if (fieldAny.optional) continue;
      if (isFieldConditional(field)) continue;

      const rustFieldName = toRustFieldName(field.name);
      const fieldType = field.type as string;

      // Add field to parent context based on its type
      if (fieldType === "string") {
        lines.push(`        parent_fields.insert("${field.name}".to_string(), FieldValue::String(self.${rustFieldName}.clone()));`);
      } else if (fieldType === "array") {
        const items = (field as any).items;
        if (items?.type === "uint8") {
          lines.push(`        parent_fields.insert("${field.name}".to_string(), FieldValue::Bytes(self.${rustFieldName}.clone()));`);
        } else if (items?.type === "choice" || items?.type === "discriminated_union") {
          // Choice/discriminated union array: store as Items with sub-field values
          // This enables corresponding<Type> selectors to access sub-fields (like Go's reflect-based approach)
          const choices: Array<{type: string}> = items.choices || items.types || [];
          const choiceEnumName = inlineEnumName(containingTypeName || "", field.name);

          lines.push(`        // Collect items with sub-field values for choice array '${field.name}'`);
          lines.push(`        {`);
          lines.push(`            let mut items_data: Vec<(String, HashMap<String, FieldValue>)> = Vec::new();`);
          lines.push(`            for item in &self.${rustFieldName} {`);
          lines.push(`                let item_bytes = item.encode().unwrap_or_default();`);
          lines.push(`                let mut item_fields: HashMap<String, FieldValue> = HashMap::new();`);
          lines.push(`                item_fields.insert("_encoded_size".to_string(), FieldValue::U64(item_bytes.len() as u64));`);
          // Match on the enum to extract sub-field values from each variant's Output struct
          lines.push(`                match item {`);
          for (const choice of choices) {
            const choiceTypeDef = schema.types?.[choice.type];
            const rustChoiceTypeName = toRustTypeName(choice.type);
            if (choiceTypeDef && "sequence" in choiceTypeDef) {
              const choiceFields = (choiceTypeDef as any).sequence as Field[];
              // Get extractable fields (non-padding, non-computed, non-const)
              const extractableFields = choiceFields.filter((f: any) =>
                f.name && f.type !== "padding" && !f.computed && f.const == null
              );
              lines.push(`                    ${choiceEnumName}::${rustChoiceTypeName}(v) => {`);
              for (const sf of extractableFields) {
                if (!sf.name) continue;
                const sfName = sf.name;
                const sfRustName = toRustFieldName(sfName);
                const sfType = sf.type as string;
                // Convert each field to a FieldValue
                if (sfType === "array" && (sf as any).items?.type === "uint8") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::Bytes(v.${sfRustName}.clone()));`);
                } else if (sfType === "string") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::String(v.${sfRustName}.clone()));`);
                } else if (sfType === "uint8") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::U8(v.${sfRustName}));`);
                } else if (sfType === "uint16") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::U16(v.${sfRustName}));`);
                } else if (sfType === "uint32") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::U32(v.${sfRustName}));`);
                } else if (sfType === "uint64") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::U64(v.${sfRustName}));`);
                } else if (sfType === "int8") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::I8(v.${sfRustName}));`);
                } else if (sfType === "int16") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::I16(v.${sfRustName}));`);
                } else if (sfType === "int32") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::I32(v.${sfRustName}));`);
                } else if (sfType === "int64") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::I64(v.${sfRustName}));`);
                } else if (sfType === "float32") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::F32(v.${sfRustName}));`);
                } else if (sfType === "float64") {
                  lines.push(`                        item_fields.insert("${sfName}".to_string(), FieldValue::F64(v.${sfRustName}));`);
                } else if (sfType === "array") {
                  // Non-uint8 array — encode to bytes for size/crc computation
                  lines.push(`                        {`);
                  lines.push(`                            let mut sf_enc = BitStreamEncoder::new(BitOrder::MsbFirst);`);
                  lines.push(`                            for sf_item in &v.${sfRustName} { let sf_bytes = sf_item.encode()?; for b in sf_bytes { sf_enc.write_uint8(b); } }`);
                  lines.push(`                            item_fields.insert("${sfName}".to_string(), FieldValue::Bytes(sf_enc.finish()));`);
                  lines.push(`                        }`);
                } else if (schema.types?.[sfType]) {
                  // Named composite type — encode to bytes
                  const sfTypeName = toRustTypeName(sfType);
                  const sfNeedsSuffix = typeNeedsInputOutputSuffix(sfType, schema);
                  lines.push(`                        {`);
                  if (sfNeedsSuffix && isCompositeType(sfType, schema)) {
                    // Output type — convert to Input first, use unwrap_or_default for types that need parent context
                    lines.push(`                            let sf_bytes = ${sfTypeName}Input::from(v.${sfRustName}.clone()).encode().unwrap_or_default();`);
                  } else {
                    lines.push(`                            let sf_bytes = v.${sfRustName}.encode()?;`);
                  }
                  lines.push(`                            item_fields.insert("${sfName}".to_string(), FieldValue::Bytes(sf_bytes));`);
                  lines.push(`                        }`);
                }
              }
              lines.push(`                    },`);
            } else {
              // Non-sequence type (string alias, back_reference, etc.)
              lines.push(`                    ${choiceEnumName}::${rustChoiceTypeName}(_v) => {},`);
            }
          }
          lines.push(`                }`);
          lines.push(`                items_data.push((item.type_name().to_string(), item_fields));`);
          lines.push(`            }`);
          lines.push(`            parent_fields.insert("${field.name}".to_string(), FieldValue::Items(items_data));`);
          lines.push(`        }`);
        } else if (items?.type && schema.types && schema.types[items.type]) {
          // Named type array: store as Items with sub-field values
          const itemTypeDef = schema.types[items.type];
          const itemFields = (itemTypeDef && "sequence" in itemTypeDef) ? (itemTypeDef as any).sequence as Field[] : [];
          const itemsNeedCtx = itemFields.length > 0 && (typeHasParentReferences(itemFields) || hasNestedStructFields(itemFields, schema));
          const itemTypeName = items.type;

          lines.push(`        // Collect items with sub-field values for typed array '${field.name}'`);
          lines.push(`        {`);
          lines.push(`            let mut items_data: Vec<(String, HashMap<String, FieldValue>)> = Vec::new();`);
          lines.push(`            for item in &self.${rustFieldName} {`);
          if (!itemsNeedCtx) {
            lines.push(`                let item_bytes = item.encode()?;`);
          } else {
            lines.push(`                let item_bytes = Vec::<u8>::new(); // Items need context, skip encoding for now`);
          }
          lines.push(`                let mut item_fields: HashMap<String, FieldValue> = HashMap::new();`);
          lines.push(`                item_fields.insert("_encoded_size".to_string(), FieldValue::U64(item_bytes.len() as u64));`);
          lines.push(`                items_data.push(("${itemTypeName}".to_string(), item_fields));`);
          lines.push(`            }`);
          lines.push(`            parent_fields.insert("${field.name}".to_string(), FieldValue::Items(items_data));`);
          lines.push(`        }`);
        }
      } else if (["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "float32", "float64"].includes(fieldType)) {
        const conversion = getFieldValueConversion(field);
        lines.push(`        parent_fields.insert("${field.name}".to_string(), ${conversion}(self.${rustFieldName}));`);
      }
    }
    // Check if any array needs position tracking or iteration tracking to determine mutability of child_ctx
    const trackingTypesForMut = detectArraysNeedingPositionTracking(schema);
    const needsPositionTracking = fields.some(f => f.type === "array" && f.name && trackingTypesForMut.get(f.name)?.size);
    const needsIterationTracking = fields.some(f => f.type === "array" && f.name && arrayItemsUseCorrespondingSelectors(f as any, schema));
    if (needsPositionTracking || needsIterationTracking) {
      lines.push(`        let mut child_ctx = ctx.extend_with_parent(parent_fields);`);
    } else {
      lines.push(`        let child_ctx = ctx.extend_with_parent(parent_fields);`);
    }
    lines.push(`        let _ = &child_ctx; // Used by nested struct encoding`);
  }

  // Pre-pass for position tracking (first/last/corresponding selectors)
  {
    const trackingTypes = detectArraysNeedingPositionTracking(schema);

    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
      const field = fields[fieldIndex];
      if (field.type !== "array") continue;
      const fieldAny = field as any;
      const items = fieldAny.items;
      if (!items) continue;

      const typesToTrack = trackingTypes.get(field.name!);
      if (!typesToTrack || typesToTrack.size === 0) continue;

      const rustFieldName = toRustFieldName(field.name!);
      const isChoiceArray = items.type === "choice";

      // We need a mutable context for position tracking
      // If we already have child_ctx, make it mutable
      const ctxVarName = hasNestedStructs ? "child_ctx" : "prepass_ctx";

      if (!hasNestedStructs) {
        // Create a temporary mutable context just for position tracking
        lines.push(``);
        lines.push(`        // Position tracking pre-pass for selectors`);
        lines.push(`        let mut ${ctxVarName} = ${needsContext ? "ctx.clone()" : "EncodeContext::new()"};`);
      } else {
        // child_ctx already exists, but it's immutable - we need to make it mutable
        // Actually, child_ctx is already a local owned value. We just need to redeclare it as mutable
      }

      // Calculate initial offset: sum of static sizes of all preceding fields
      let staticOffset = 0;
      const dynamicParts: string[] = [];
      for (let i = 0; i < fieldIndex; i++) {
        const precedingField = fields[i];
        const fieldSize = getStaticFieldSize(precedingField, schema);
        if (fieldSize > 0) {
          staticOffset += fieldSize;
        } else if (precedingField.name && precedingField.type !== "padding") {
          // Variable-size field - need to encode to measure
          const prustFieldName = toRustFieldName(precedingField.name);
          // Check if this is a nested struct type that needs context
          const pFieldType = precedingField.type as string;
          const pTypeDef = schema.types?.[pFieldType];
          const pNeedsContext = pTypeDef && "sequence" in pTypeDef &&
            (typeHasParentReferences((pTypeDef as any).sequence as Field[]) ||
             hasNestedStructFields((pTypeDef as any).sequence as Field[], schema));
          if (pNeedsContext && hasNestedStructs) {
            dynamicParts.push(`self.${prustFieldName}.encode_with_context(&child_ctx)?.len()`);
          } else {
            dynamicParts.push(`self.${prustFieldName}.encode()?.len()`);
          }
        }
      }

      let offsetExpr: string;
      if (staticOffset === 0 && dynamicParts.length === 0) {
        offsetExpr = "0";
      } else if (dynamicParts.length === 0) {
        offsetExpr = `${staticOffset}`;
      } else {
        const parts = staticOffset > 0 ? [`${staticOffset}`, ...dynamicParts] : dynamicParts;
        offsetExpr = parts.join(" + ");
      }

      lines.push(``);
      lines.push(`        // Pre-pass: compute positions for '${field.name}' array (first/last/corresponding selectors)`);
      lines.push(`        let mut ${rustFieldName}_offset: usize = ${offsetExpr};`);

      // Account for length prefix
      const kind = fieldAny.kind;
      if (kind === "length_prefixed" || kind === "length_prefixed_items") {
        const lengthType = fieldAny.length_type || "uint8";
        const lengthSize = lengthType === "uint8" ? 1 : lengthType === "uint16" ? 2 : lengthType === "uint32" ? 4 : lengthType === "uint64" ? 8 : 1;
        lines.push(`        ${rustFieldName}_offset += ${lengthSize}; // Account for length prefix`);
      }

      if (isChoiceArray) {
        lines.push(`        for prepass_item in &self.${rustFieldName} {`);
        for (const typeName of typesToTrack) {
          const rustTypeName = toRustTypeName(typeName);
          // Check item type using type_name() method
          lines.push(`            if prepass_item.type_name() == "${typeName}" {`);
          lines.push(`                ${hasNestedStructs ? "child_ctx" : ctxVarName}.track_position("${field.name}_${typeName}", ${rustFieldName}_offset);`);
          lines.push(`            }`);
        }
        lines.push(`            // Advance offset by item size`);
        lines.push(`            ${rustFieldName}_offset += prepass_item.encode()?.len();`);
        lines.push(`        }`);
      } else {
        // Single-type array
        const itemTypeName = items.type;
        if (typesToTrack.has(itemTypeName)) {
          lines.push(`        for prepass_item in &self.${rustFieldName} {`);
          lines.push(`            ${hasNestedStructs ? "child_ctx" : ctxVarName}.track_position("${field.name}_${itemTypeName}", ${rustFieldName}_offset);`);
          lines.push(`            ${rustFieldName}_offset += prepass_item.encode()?.len();`);
          lines.push(`        }`);
        }
      }
    }
  }

  // Determine which fields are consumed by from_after_field
  // When a computed field has from_after_field, it encodes ALL subsequent fields itself
  // So the outer loop must skip them
  const fieldsConsumedByFromAfter = new Set<string>();
  for (let i = 0; i < fields.length; i++) {
    const fieldAny = fields[i] as any;
    if (fieldAny.computed?.type === "length_of" && fieldAny.computed?.from_after_field) {
      const fromAfterField = fieldAny.computed.from_after_field;
      const fromAfterIndex = fields.findIndex(f => f.name === fromAfterField);
      if (fromAfterIndex !== -1) {
        // Mark all fields after from_after_field as consumed (except the computed field itself)
        for (let j = fromAfterIndex + 1; j < fields.length; j++) {
          if (fields[j].name && fields[j].name !== fields[i].name) {
            fieldsConsumedByFromAfter.add(fields[j].name!);
          }
        }
      }
    }
  }

  // Generate encoding logic for each field
  for (const field of fields) {
    // Skip fields without names
    if (!field.name) {
      continue;
    }

    // Skip fields that are already encoded by from_after_field content-first encoding
    if (fieldsConsumedByFromAfter.has(field.name)) {
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

    // Handle computed fields - compute value and encode it
    if (fieldAny.computed != null) {
      // Use child_ctx if we have nested structs (it has parent fields + position tracking),
      // otherwise use ctx (the raw parameter)
      const ctxVarForComputed = hasNestedStructs ? "child_ctx" : (needsContext ? "ctx" : undefined);
      lines.push(...generateEncodeComputedField(field, fields, defaultEndianness, "        ", ctxVarForComputed, schema));
      continue;
    }

    // Handle conditional fields - only encode if condition is true AND value is Some
    if (isFieldConditional(field)) {
      lines.push(...generateEncodeConditionalField(field, fields, defaultEndianness, "        "));
      continue;
    }

    // Regular input field - encode from self
    // For nested structs, pass context if needed
    const fieldType = field.type as string;
    if (hasNestedStructs && schema.types && schema.types[fieldType] && "sequence" in schema.types[fieldType]) {
      lines.push(...generateEncodeNestedStructField(field, defaultEndianness, "        ", schema));
    } else {
      // Determine if this array field needs context for encoding
      let choiceCtxVarForField: string | undefined;
      if (fieldType === "array" && schema) {
        const fieldItems = (field as any).items;
        if (fieldItems?.type === "choice" || fieldItems?.type === "discriminated_union") {
          // Check if any variant in this choice needs encode context
          const choiceTypes: string[] = fieldItems.choices?.map((c: any) => c.type) || fieldItems.types?.map((t: any) => t.type) || [];
          const anyChoiceVariantNeedsCtx = choiceTypes.some(t => variantTypeNeedsEncodeContext(t, schema));
          if (anyChoiceVariantNeedsCtx) {
            const trackingTypes = detectArraysNeedingPositionTracking(schema);
            const hasTracking = (trackingTypes.get(field.name!)?.size ?? 0) > 0;
            if (hasTracking || hasNestedStructs) {
              choiceCtxVarForField = hasNestedStructs ? "child_ctx" : "prepass_ctx";
            }
          }
        } else if (fieldItems?.type && arrayItemsUseCorrespondingSelectors(field as any, schema)) {
          // Non-choice typed array whose items use corresponding selectors — need iteration tracking
          if (hasNestedStructs) {
            choiceCtxVarForField = "child_ctx";
          }
        }
      }
      lines.push(...generateEncodeField(field, defaultEndianness, "        ", schema, hasNestedStructs, choiceCtxVarForField));
    }
  }

  lines.push(`        Ok(())`);
  lines.push(`    }`);
  lines.push(``);

  return lines;
}

/**
 * Generates encoding code for a nested struct field with context passing
 */
function generateEncodeNestedStructField(field: Field, defaultEndianness: string, indent: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const rustFieldName = toRustFieldName(field.name);
  const fieldType = field.type as string;

  // Check if the nested type needs context
  const typeDef = schema.types[fieldType];
  let nestedNeedsContext = false;
  if (typeDef && "sequence" in typeDef) {
    const nestedFields = typeDef.sequence;
    nestedNeedsContext = typeHasParentReferences(nestedFields) || hasNestedStructFields(nestedFields, schema);
  }
  // Also check if nested type transitively contains back_references
  const nestedContainsBackRef = typeTransitivelyContainsBackReference(fieldType, schema);

  if (nestedNeedsContext) {
    if (nestedContainsBackRef) {
      // Both parent context and compression context needed
      lines.push(`${indent}// Encode nested struct ${field.name} with parent + compression context`);
      lines.push(`${indent}let ${rustFieldName}_ctx = child_ctx.with_base_offset(encoder.byte_offset());`);
      lines.push(`${indent}self.${rustFieldName}.encode_into_with_context(encoder, &${rustFieldName}_ctx)?;`);
    } else {
      lines.push(`${indent}// Encode nested struct ${field.name} with context`);
      lines.push(`${indent}self.${rustFieldName}.encode_into_with_context(encoder, &child_ctx)?;`);
    }
  } else if (nestedContainsBackRef) {
    lines.push(`${indent}// Encode nested struct ${field.name} with compression context`);
    lines.push(`${indent}let ${rustFieldName}_ctx = ctx.with_base_offset(encoder.byte_offset());`);
    lines.push(`${indent}self.${rustFieldName}.encode_into_with_context(encoder, &${rustFieldName}_ctx)?;`);
  } else {
    lines.push(`${indent}// Encode nested struct ${field.name}`);
    lines.push(`${indent}self.${rustFieldName}.encode_into(encoder)?;`);
  }

  return lines;
}

/**
 * Generates encoding code for a conditional field
 * The field is Option<T> and only encoded if the condition is true
 */
function generateEncodeConditionalField(field: Field, allFields: Field[], defaultEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const fieldAny = field as any;
  const condition = fieldAny.conditional;
  const rustFieldName = toRustFieldName(field.name);

  // Convert the condition expression to Rust (with self. prefix for field references)
  // Pass allFields so we can detect conditional parent fields for Option-safe access
  const rustCondition = convertConditionalToRust(condition, "self.", allFields);

  // Generate: if condition { if let Some(value) = self.field { encode(value) } }
  lines.push(`${indent}if ${rustCondition} {`);
  lines.push(`${indent}    if let Some(ref value) = self.${rustFieldName} {`);

  // Generate encoding for the value - we need to use "value" instead of "self.field"
  const encodeLines = generateEncodeFieldWithValue(field, "value", defaultEndianness, `${indent}        `);
  lines.push(...encodeLines);

  lines.push(`${indent}    }`);
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates encoding code for a computed field
 * Computes the value from the target field and encodes it
 *
 * @param field - The computed field definition
 * @param allFields - All fields in the containing type
 * @param defaultEndianness - Default endianness for the schema
 * @param indent - Indentation string
 * @param ctxVar - Optional context variable name (e.g., "ctx") for parent references
 * @param schema - Optional schema for type lookups
 */
function generateEncodeComputedField(
  field: Field,
  allFields: Field[],
  defaultEndianness: string,
  indent: string,
  ctxVar?: string,
  schema?: BinarySchema
): string[] {
  const lines: string[] = [];
  const fieldAny = field as any;
  const computed = fieldAny.computed;
  const fieldName = field.name;
  const endianness = fieldAny.endianness || defaultEndianness;
  const rustEndianness = mapEndianness(endianness);

  // Helper to convert computed variable name (avoid Rust reserved keywords)
  const computedVarName = toRustFieldName(fieldName) + "_computed";

  if (computed.type === "length_of") {
    // Check for from_after_field (ASN.1/DER style length calculation)
    const fromAfterField = computed.from_after_field;
    if (fromAfterField) {
      // Content-first encoding: encode all fields after from_after_field first,
      // then write the length, then write the encoded content.

      // Find the index of from_after_field in the containing sequence
      const fromAfterIndex = allFields.findIndex(f => f.name === fromAfterField);
      if (fromAfterIndex === -1) {
        throw new Error(`Computed field '${fieldName}' references from_after_field '${fromAfterField}' which doesn't exist in type`);
      }

      // Get all fields after the from_after_field
      const fieldsAfter = allFields.slice(fromAfterIndex + 1);

      const piecesVar = `${computedVarName}_pieces`;

      lines.push(`${indent}// Content-first encoding for from_after_field '${fromAfterField}'`);
      lines.push(`${indent}// Phase 1: Encode all content fields after '${fromAfterField}' to measure total size`);
      lines.push(`${indent}let mut ${piecesVar}: Vec<Vec<u8>> = Vec::new();`);
      lines.push(`${indent}let mut ${computedVarName}: usize = 0;`);

      // Track nested from_after_field - if a subsequent field also has from_after_field,
      // it will handle the remaining fields itself
      let skipRemainder = false;

      for (const afterField of fieldsAfter) {
        const afterFieldAny = afterField as any;
        if (!afterField.name) continue;
        if (afterField.name === fieldName) continue; // Skip self

        if (skipRemainder) continue;

        // Check if this field has its own from_after_field (nested)
        if (afterFieldAny.computed?.type === "length_of" && afterFieldAny.computed.from_after_field) {
          skipRemainder = true; // Nested from_after_field handles remaining fields
        }

        const afterRustName = toRustFieldName(afterField.name);
        const afterEndianness = afterFieldAny.endianness || defaultEndianness;
        const afterRustEndianness = mapEndianness(afterEndianness);

        // Encode field to temporary bytes
        if (afterFieldAny.const != null) {
          // Const field - encode the constant value
          lines.push(`${indent}{`);
          lines.push(`${indent}    let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
          const constVal = afterFieldAny.const;
          switch (afterField.type) {
            case "uint8":
              lines.push(`${indent}    temp.write_uint8(${constVal}u8);`);
              break;
            case "uint16":
              lines.push(`${indent}    temp.write_uint16(${constVal}u16, Endianness::${afterRustEndianness});`);
              break;
            case "uint32":
              lines.push(`${indent}    temp.write_uint32(${constVal}u32, Endianness::${afterRustEndianness});`);
              break;
            case "uint64":
              lines.push(`${indent}    temp.write_uint64(${constVal}u64, Endianness::${afterRustEndianness});`);
              break;
            default:
              lines.push(`${indent}    temp.write_uint8(${constVal}u8);`);
              break;
          }
          lines.push(`${indent}    let bytes = temp.finish();`);
          lines.push(`${indent}    ${computedVarName} += bytes.len();`);
          lines.push(`${indent}    ${piecesVar}.push(bytes);`);
          lines.push(`${indent}}`);
        } else if (afterFieldAny.computed != null) {
          // Nested computed field within from_after_field content
          const nestedComputed = afterFieldAny.computed;

          if (nestedComputed.type === "length_of" && nestedComputed.target && !nestedComputed.from_after_field) {
            // Simple length_of with a target: compute length of target field, write as varlength
            const targetName = nestedComputed.target;
            const targetRustName = toRustFieldName(targetName);
            const targetField = fieldsAfter.find(f => f.name === targetName);
            const targetTypeDef = targetField && schema && schema.types ? schema.types[targetField.type as string] : null;

            lines.push(`${indent}{`);
            lines.push(`${indent}    // Computed length_of '${targetName}' — measure target then write length`);
            lines.push(`${indent}    let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);

            if (targetTypeDef) {
              // Composite target — encode to measure
              lines.push(`${indent}    let target_bytes = self.${targetRustName}.encode()?;`);
              lines.push(`${indent}    let target_len = target_bytes.len();`);
            } else if (targetField && targetField.type === "array") {
              // Array target — encode elements to measure
              const items = (targetField as any).items;
              if (items?.type === "uint8") {
                lines.push(`${indent}    let target_len = self.${targetRustName}.len();`);
              } else {
                lines.push(`${indent}    let mut arr_temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
                lines.push(`${indent}    for item in &self.${targetRustName} { let ib = item.encode()?; for b in ib { arr_temp.write_uint8(b); } }`);
                lines.push(`${indent}    let target_len = arr_temp.finish().len();`);
              }
            } else if (targetField && targetField.type === "string") {
              lines.push(`${indent}    let target_len = self.${targetRustName}.len();`);
            } else {
              // Fallback: primitive type — use fixed size
              lines.push(`${indent}    let target_len = 0usize; // TODO: unsupported target type '${targetField?.type}'`);
            }

            // Write the varlength
            if (afterField.type === "varlength") {
              const encoding = afterFieldAny.encoding || "der";
              lines.push(`${indent}    temp.write_varlength(target_len as u64, "${encoding}")?;`);
            } else {
              // Fixed-size length type
              switch (afterField.type) {
                case "uint8":
                  lines.push(`${indent}    temp.write_uint8(target_len as u8);`);
                  break;
                case "uint16":
                  lines.push(`${indent}    temp.write_uint16(target_len as u16, Endianness::${afterRustEndianness});`);
                  break;
                case "uint32":
                  lines.push(`${indent}    temp.write_uint32(target_len as u32, Endianness::${afterRustEndianness});`);
                  break;
                default:
                  lines.push(`${indent}    temp.write_uint8(target_len as u8); // fallback`);
              }
            }

            lines.push(`${indent}    let bytes = temp.finish();`);
            lines.push(`${indent}    ${computedVarName} += bytes.len();`);
            lines.push(`${indent}    ${piecesVar}.push(bytes);`);
            lines.push(`${indent}}`);
          } else if (schema && schema.types && schema.types[afterField.type as string]) {
            // Composite computed field — encode the entire sub-struct
            lines.push(`${indent}{`);
            lines.push(`${indent}    let bytes = self.${afterRustName}.encode()?;`);
            lines.push(`${indent}    ${computedVarName} += bytes.len();`);
            lines.push(`${indent}    ${piecesVar}.push(bytes);`);
            lines.push(`${indent}}`);
          } else if (nestedComputed.type === "length_of" && nestedComputed.from_after_field) {
            // Nested from_after_field — recursively generate content-first encoding
            // This field measures everything after itself and the outer loop skips those fields
            const nestedFromAfterField = nestedComputed.from_after_field;
            const nestedFromAfterIndex = allFields.findIndex(f => f.name === nestedFromAfterField);
            const nestedFieldsAfter = allFields.slice(nestedFromAfterIndex + 1);
            const nestedPiecesVar = `${afterRustName}_pieces`;
            const nestedComputedVar = `${afterRustName}_computed`;

            lines.push(`${indent}// Nested from_after_field '${afterField.name}': content-first encoding`);
            lines.push(`${indent}{`);
            lines.push(`${indent}    let mut ${nestedPiecesVar}: Vec<Vec<u8>> = Vec::new();`);
            lines.push(`${indent}    let mut ${nestedComputedVar}: usize = 0;`);

            for (const nestedAfterField of nestedFieldsAfter) {
              const nestedAfterFieldAny = nestedAfterField as any;
              if (!nestedAfterField.name) continue;
              if (nestedAfterField.name === afterField.name) continue;

              const nAfterRustName = toRustFieldName(nestedAfterField.name);
              const nAfterEndianness = nestedAfterFieldAny.endianness || defaultEndianness;
              const nAfterRustEndianness = mapEndianness(nAfterEndianness);

              if (nestedAfterFieldAny.const != null) {
                lines.push(`${indent}    {`);
                lines.push(`${indent}        let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
                switch (nestedAfterField.type) {
                  case "uint8":
                    lines.push(`${indent}        temp.write_uint8(${nestedAfterFieldAny.const}u8);`);
                    break;
                  default:
                    lines.push(`${indent}        temp.write_uint8(${nestedAfterFieldAny.const}u8);`);
                }
                lines.push(`${indent}        let bytes = temp.finish();`);
                lines.push(`${indent}        ${nestedComputedVar} += bytes.len();`);
                lines.push(`${indent}        ${nestedPiecesVar}.push(bytes);`);
                lines.push(`${indent}    }`);
              } else if (schema && schema.types && schema.types[nestedAfterField.type as string]) {
                lines.push(`${indent}    {`);
                lines.push(`${indent}        let bytes = self.${nAfterRustName}.encode()?;`);
                lines.push(`${indent}        ${nestedComputedVar} += bytes.len();`);
                lines.push(`${indent}        ${nestedPiecesVar}.push(bytes);`);
                lines.push(`${indent}    }`);
              } else if (nestedAfterField.type === "array") {
                const arrayItems = nestedAfterFieldAny.items;
                lines.push(`${indent}    {`);
                lines.push(`${indent}        let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
                if (nestedAfterFieldAny.kind === "byte_length_prefixed" && nestedAfterFieldAny.length_encoding) {
                  // Byte-length-prefixed array with varlength length
                  lines.push(`${indent}        let mut arr_content = BitStreamEncoder::new(BitOrder::MsbFirst);`);
                  if (arrayItems?.type === "uint8") {
                    lines.push(`${indent}        for item in &self.${nAfterRustName} { arr_content.write_uint8(*item); }`);
                  } else if (schema && schema.types && schema.types[arrayItems?.type as string]) {
                    lines.push(`${indent}        for item in &self.${nAfterRustName} { let ib = item.encode()?; for b in ib { arr_content.write_uint8(b); } }`);
                  }
                  lines.push(`${indent}        let arr_bytes = arr_content.finish();`);
                  lines.push(`${indent}        let arr_len = arr_bytes.len();`);
                  lines.push(`${indent}        temp.write_varlength(arr_len as u64, "${nestedAfterFieldAny.length_encoding || "der"}")?;`);
                  lines.push(`${indent}        for b in &arr_bytes { temp.write_uint8(*b); }`);
                } else if (arrayItems?.type === "uint8") {
                  lines.push(`${indent}        for item in &self.${nAfterRustName} { temp.write_uint8(*item); }`);
                } else if (schema && schema.types && schema.types[arrayItems?.type as string]) {
                  lines.push(`${indent}        for item in &self.${nAfterRustName} { let ib = item.encode()?; for b in ib { temp.write_uint8(b); } }`);
                }
                lines.push(`${indent}        let bytes = temp.finish();`);
                lines.push(`${indent}        ${nestedComputedVar} += bytes.len();`);
                lines.push(`${indent}        ${nestedPiecesVar}.push(bytes);`);
                lines.push(`${indent}    }`);
              }
            }

            // Write the nested length
            lines.push(`${indent}    let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
            const nestedEncoding = afterFieldAny.encoding || "der";
            lines.push(`${indent}    temp.write_varlength(${nestedComputedVar} as u64, "${nestedEncoding}")?;`);
            lines.push(`${indent}    let len_bytes = temp.finish();`);
            lines.push(`${indent}    ${computedVarName} += len_bytes.len();`);
            lines.push(`${indent}    ${piecesVar}.push(len_bytes);`);

            // Write the nested content
            lines.push(`${indent}    for piece in &${nestedPiecesVar} {`);
            lines.push(`${indent}        ${computedVarName} += piece.len();`);
            lines.push(`${indent}        ${piecesVar}.push(piece.clone());`);
            lines.push(`${indent}    }`);
            lines.push(`${indent}}`);
          } else {
            // Other primitive computed field
            lines.push(`${indent}// Skipping computed field '${afterField.name}' (type: ${afterField.type}, computed: ${JSON.stringify(nestedComputed)})`);
          }
        } else if (schema && schema.types && schema.types[afterField.type as string]) {
          // Composite type - call encode()
          lines.push(`${indent}{`);
          lines.push(`${indent}    let bytes = self.${afterRustName}.encode()?;`);
          lines.push(`${indent}    ${computedVarName} += bytes.len();`);
          lines.push(`${indent}    ${piecesVar}.push(bytes);`);
          lines.push(`${indent}}`);
        } else if (afterField.type === "string") {
          // String field
          const strEncoding = afterFieldAny.encoding || "utf8";
          const strKind = afterFieldAny.kind;
          lines.push(`${indent}{`);
          lines.push(`${indent}    let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
          if (strEncoding === "latin1" || strEncoding === "ascii") {
            lines.push(`${indent}    for c in self.${afterRustName}.chars() { temp.write_uint8(c as u8); }`);
          } else {
            lines.push(`${indent}    for b in self.${afterRustName}.as_bytes() { temp.write_uint8(*b); }`);
          }
          if (strKind === "null_terminated") {
            lines.push(`${indent}    temp.write_uint8(0);`);
          }
          lines.push(`${indent}    let bytes = temp.finish();`);
          lines.push(`${indent}    ${computedVarName} += bytes.len();`);
          lines.push(`${indent}    ${piecesVar}.push(bytes);`);
          lines.push(`${indent}}`);
        } else if (afterField.type === "array") {
          // Array field
          const arrayItems = afterFieldAny.items;
          lines.push(`${indent}{`);
          lines.push(`${indent}    let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
          if (afterFieldAny.kind === "byte_length_prefixed" && afterFieldAny.length_encoding) {
            // Byte-length-prefixed with varlength: encode content first, write length, then content
            lines.push(`${indent}    let mut arr_content = BitStreamEncoder::new(BitOrder::MsbFirst);`);
            if (arrayItems?.type === "uint8") {
              lines.push(`${indent}    for item in &self.${afterRustName} { arr_content.write_uint8(*item); }`);
            } else {
              lines.push(`${indent}    for item in &self.${afterRustName} {`);
              lines.push(`${indent}        let ib = item.encode()?;`);
              lines.push(`${indent}        for b in ib { arr_content.write_uint8(b); }`);
              lines.push(`${indent}    }`);
            }
            lines.push(`${indent}    let arr_bytes = arr_content.finish();`);
            const le = afterFieldAny.length_encoding || "der";
            lines.push(`${indent}    temp.write_varlength(arr_bytes.len() as u64, "${le}")?;`);
            lines.push(`${indent}    for b in &arr_bytes { temp.write_uint8(*b); }`);
          } else if (arrayItems?.type === "uint8") {
            lines.push(`${indent}    for item in &self.${afterRustName} { temp.write_uint8(*item); }`);
          } else {
            lines.push(`${indent}    for item in &self.${afterRustName} {`);
            lines.push(`${indent}        let ib = item.encode()?;`);
            lines.push(`${indent}        for b in ib { temp.write_uint8(b); }`);
            lines.push(`${indent}    }`);
          }
          lines.push(`${indent}    let bytes = temp.finish();`);
          lines.push(`${indent}    ${computedVarName} += bytes.len();`);
          lines.push(`${indent}    ${piecesVar}.push(bytes);`);
          lines.push(`${indent}}`);
        } else {
          // Primitive field
          lines.push(`${indent}{`);
          lines.push(`${indent}    let mut temp = BitStreamEncoder::new(BitOrder::MsbFirst);`);
          switch (afterField.type) {
            case "uint8":
              lines.push(`${indent}    temp.write_uint8(self.${afterRustName});`);
              break;
            case "uint16":
              lines.push(`${indent}    temp.write_uint16(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "uint32":
              lines.push(`${indent}    temp.write_uint32(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "uint64":
              lines.push(`${indent}    temp.write_uint64(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "int8":
              lines.push(`${indent}    temp.write_int8(self.${afterRustName});`);
              break;
            case "int16":
              lines.push(`${indent}    temp.write_int16(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "int32":
              lines.push(`${indent}    temp.write_int32(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "int64":
              lines.push(`${indent}    temp.write_int64(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "float32":
              lines.push(`${indent}    temp.write_float32(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "float64":
              lines.push(`${indent}    temp.write_float64(self.${afterRustName}, Endianness::${afterRustEndianness});`);
              break;
            case "varlength": {
              const vlEnc = afterFieldAny.encoding || "der";
              lines.push(`${indent}    temp.write_varlength(self.${afterRustName}, "${vlEnc}")?;`);
              break;
            }
            default:
              lines.push(`${indent}    // Unknown primitive type: ${afterField.type}`);
              break;
          }
          lines.push(`${indent}    let bytes = temp.finish();`);
          lines.push(`${indent}    ${computedVarName} += bytes.len();`);
          lines.push(`${indent}    ${piecesVar}.push(bytes);`);
          lines.push(`${indent}}`);
        }
      }

      // Phase 2: Write the varlength length
      lines.push(`${indent}// Phase 2: Write the length (now we know the exact size)`);
      if (field.type === "varlength") {
        const encoding = fieldAny.encoding || "der";
        lines.push(`${indent}encoder.write_varlength(${computedVarName} as u64, "${encoding}")?;`);
      } else {
        lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      }

      // Phase 3: Write the collected content
      lines.push(`${indent}// Phase 3: Write the collected content bytes`);
      lines.push(`${indent}for piece in &${piecesVar} {`);
      lines.push(`${indent}    for b in piece {`);
      lines.push(`${indent}        encoder.write_uint8(*b);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);

      return lines;
    }

    // Compute length of target field
    const target = computed.target as string;
    if (!target) {
      throw new Error(`Computed field '${fieldName}' (length_of) has no target specified`);
    }

    // Check for first/last selector in length_of target (MUST come before simple parent ref check)
    const firstLastInfoLen = parseFirstLastTarget(target);
    if (firstLastInfoLen) {
      // length_of with first/last selector - look up item from tracking, compute its encoded size
      const { arrayPath, filterType, selector } = firstLastInfoLen;
      const positionKey = `${arrayPath}_${filterType}`;
      const ctxRef = ctxVar || "child_ctx";
      lines.push(`${indent}// Computed field '${fieldName}': length_of with ${selector}<${filterType}>`);
      // TODO: full implementation of length_of with selectors
      lines.push(`${indent}let ${computedVarName} = 0_usize; // length_of with selector not fully implemented`);
      lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      return lines;
    }

    // Check for corresponding selector in length_of target (MUST come before simple parent ref check)
    const correspondingInfoLen = parseCorrespondingTarget(target);
    if (correspondingInfoLen) {
      const { levelsUp, arrayPath, filterType, remainingPath } = correspondingInfoLen;
      const ctxRef = ctxVar || "child_ctx";
      const fieldAccess = remainingPath ? remainingPath.slice(1) : ""; // Remove leading "."

      lines.push(`${indent}// Computed field '${fieldName}': length_of '${target}' (corresponding<${filterType}>${remainingPath || ""})`);
      // Determine correlation index: same-array (type index) vs cross-array (array index)
      lines.push(`${indent}let ${computedVarName}_corr_idx = {`);
      lines.push(`${indent}    if ${ctxRef}.is_current_array("${arrayPath}") {`);
      lines.push(`${indent}        // Same-array: use type occurrence index (counter incremented before encoding)`);
      lines.push(`${indent}        let ti = ${ctxRef}.get_type_index("${arrayPath}_${filterType}");`);
      lines.push(`${indent}        if ti > 0 { ti - 1 } else { 0 }`);
      lines.push(`${indent}    } else {`);
      lines.push(`${indent}        // Cross-array: use current array index from any containing array`);
      lines.push(`${indent}        ${ctxRef}.get_any_array_iteration().map(|(_, idx)| idx).unwrap_or(0)`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}};`);
      // Find the corresponding item and access its sub-field
      lines.push(`${indent}let ${computedVarName} = match ${ctxRef}.find_parent_field("${arrayPath}") {`);
      lines.push(`${indent}    Some(array_val) => {`);
      lines.push(`${indent}        match array_val.get_nth_item_of_type("${filterType}", ${computedVarName}_corr_idx) {`);
      if (fieldAccess) {
        lines.push(`${indent}            Some(item_fields) => {`);
        lines.push(`${indent}                item_fields.get("${fieldAccess}").map(|v| v.length_of_value()).unwrap_or(0)`);
        lines.push(`${indent}            },`);
      } else {
        lines.push(`${indent}            Some(item_fields) => {`);
        lines.push(`${indent}                item_fields.get("_encoded_size").map(|v| v.length_of_value()).unwrap_or(0)`);
        lines.push(`${indent}            },`);
      }
      lines.push(`${indent}            None => 0,`);
      lines.push(`${indent}        }`);
      lines.push(`${indent}    },`);
      lines.push(`${indent}    None => 0,`);
      lines.push(`${indent}};`);
      lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      return lines;
    }

    // Check for simple parent reference (../) — no selectors
    const parentRef = parseParentPath(target);
    if (parentRef) {
      if (!ctxVar) {
        throw new Error(`Computed field '${fieldName}' has parent reference but no context available: ${target}`);
      }

      const { levelsUp, fieldName: targetFieldName } = parentRef;

      lines.push(`${indent}// Computed field '${fieldName}': length_of '${target}' (parent reference)`);
      lines.push(`${indent}let ${computedVarName} = match ${ctxVar}.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
      lines.push(`${indent}    Some(field_value) => field_value.length_of_value(),`);
      lines.push(`${indent}    None => return Err(binschema_runtime::BinSchemaError::InvalidValue(`);
      lines.push(`${indent}        format!("Parent field '${targetFieldName}' not found at level ${levelsUp}")`);
      lines.push(`${indent}    )),`);
      lines.push(`${indent}};`);

      // Apply offset if specified
      if (computed.offset !== undefined && computed.offset !== 0) {
        lines.push(`${indent}let ${computedVarName} = ${computedVarName} + ${computed.offset};`);
      }

      // Write the computed value
      lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      return lines;
    }

    // Check for other complex expressions
    if (target.includes("[") || target.includes("<")) {
      throw new Error(`Rust generator does not yet support complex computed field targets: ${target}`);
    }

    const targetRust = toRustFieldName(target);
    const targetPath = `self.${targetRust}`;

    // Check if target is a string with encoding (byte length) or array/other (element count)
    const targetField = allFields.find(f => f.name === target);
    const isString = targetField && targetField.type === "string";
    const stringEncoding = isString ? ((targetField as any).encoding || "utf8") : "utf8";

    lines.push(`${indent}// Computed field '${fieldName}': length_of '${target}'`);

    if (targetField && (targetField.type as string) === "discriminated_union") {
      // Discriminated union - encode variant to get byte length
      lines.push(`${indent}let ${computedVarName} = ${targetPath}.encode()?.len();`);
    } else if (isString && (stringEncoding === "latin1" || stringEncoding === "ascii")) {
      // Latin-1/ASCII: char count equals byte count
      lines.push(`${indent}let ${computedVarName} = ${targetPath}.chars().count();`);
    } else if (targetField && schema && schema.types && schema.types[targetField.type as string]) {
      // Composite type - encode to get byte length
      lines.push(`${indent}let ${computedVarName} = ${targetPath}.encode()?.len();`);
    } else {
      // UTF-8 strings: .len() gives byte count; arrays: .len() gives element count
      lines.push(`${indent}let ${computedVarName} = ${targetPath}.len();`);
    }

    // Apply offset if specified
    if (computed.offset !== undefined && computed.offset !== 0) {
      lines.push(`${indent}let ${computedVarName} = ${computedVarName} + ${computed.offset};`);
    }

    // Write the computed value
    lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
  } else if (computed.type === "count_of") {
    // Compute count of target array
    const target = computed.target as string;

    // Check for parent reference (../)
    const parentRef = parseParentPath(target);
    if (parentRef) {
      if (!ctxVar) {
        throw new Error(`Computed field '${fieldName}' has parent reference but no context available: ${target}`);
      }

      const { levelsUp, fieldName: targetFieldName } = parentRef;

      lines.push(`${indent}// Computed field '${fieldName}': count_of '${target}' (parent reference)`);
      lines.push(`${indent}let ${computedVarName} = match ${ctxVar}.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
      lines.push(`${indent}    Some(field_value) => field_value.len(),`);
      lines.push(`${indent}    None => return Err(binschema_runtime::BinSchemaError::InvalidValue(`);
      lines.push(`${indent}        format!("Parent field '${targetFieldName}' not found at level ${levelsUp}")`);
      lines.push(`${indent}    )),`);
      lines.push(`${indent}};`);

      // Write the computed value
      lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      return lines;
    }

    const targetRust = toRustFieldName(target);
    const targetPath = `self.${targetRust}`;

    lines.push(`${indent}// Computed field '${fieldName}': count_of '${target}'`);
    lines.push(`${indent}let ${computedVarName} = ${targetPath}.len();`);

    // Write the computed value
    lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
  } else if (computed.type === "crc32_of") {
    // Compute CRC32 checksum of target field
    const target = computed.target as string;

    // Check for corresponding selector FIRST (before simple parent ref)
    const correspondingInfoCrc = parseCorrespondingTarget(target);
    if (correspondingInfoCrc) {
      const { levelsUp, arrayPath, filterType, remainingPath } = correspondingInfoCrc;
      const ctxRef = ctxVar || "child_ctx";
      const fieldAccess = remainingPath ? remainingPath.slice(1) : ""; // Remove leading "."

      lines.push(`${indent}// Computed field '${fieldName}': crc32_of '${target}' (corresponding<${filterType}>${remainingPath || ""})`);
      // Determine correlation index: same-array vs cross-array
      lines.push(`${indent}let ${computedVarName}_corr_idx = {`);
      lines.push(`${indent}    if ${ctxRef}.is_current_array("${arrayPath}") {`);
      lines.push(`${indent}        let ti = ${ctxRef}.get_type_index("${arrayPath}_${filterType}");`);
      lines.push(`${indent}        if ti > 0 { ti - 1 } else { 0 }`);
      lines.push(`${indent}    } else {`);
      lines.push(`${indent}        ${ctxRef}.get_any_array_iteration().map(|(_, idx)| idx).unwrap_or(0)`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}};`);
      // Find corresponding item and compute CRC32 of its sub-field
      lines.push(`${indent}let ${computedVarName} = match ${ctxRef}.find_parent_field("${arrayPath}") {`);
      lines.push(`${indent}    Some(array_val) => {`);
      lines.push(`${indent}        match array_val.get_nth_item_of_type("${filterType}", ${computedVarName}_corr_idx) {`);
      if (fieldAccess) {
        lines.push(`${indent}            Some(item_fields) => {`);
        lines.push(`${indent}                item_fields.get("${fieldAccess}").map(|v| binschema_runtime::crc32(&v.to_bytes())).unwrap_or(0)`);
        lines.push(`${indent}            },`);
      } else {
        lines.push(`${indent}            Some(item_fields) => {`);
        lines.push(`${indent}                item_fields.get("_encoded_size").map(|v| binschema_runtime::crc32(&v.to_bytes())).unwrap_or(0)`);
        lines.push(`${indent}            },`);
      }
      lines.push(`${indent}            None => 0,`);
      lines.push(`${indent}        }`);
      lines.push(`${indent}    },`);
      lines.push(`${indent}    None => 0,`);
      lines.push(`${indent}};`);
      lines.push(`${indent}encoder.write_uint32(${computedVarName}, Endianness::${rustEndianness});`);
      return lines;
    }

    // Check for first/last selector in crc32_of target
    const firstLastInfoCrc = parseFirstLastTarget(target);
    if (firstLastInfoCrc) {
      // crc32_of with first/last selector - not yet needed, generate stub
      lines.push(`${indent}// Computed field '${fieldName}': crc32_of with ${firstLastInfoCrc.selector}<${firstLastInfoCrc.filterType}> (not implemented)`);
      lines.push(`${indent}let ${computedVarName} = 0_u32;`);
      lines.push(`${indent}encoder.write_uint32(${computedVarName}, Endianness::${rustEndianness});`);
      return lines;
    }

    // Check for parent reference (../)
    const parentRef = parseParentPath(target);
    if (parentRef) {
      if (!ctxVar) {
        throw new Error(`Computed field '${fieldName}' has parent reference but no context available: ${target}`);
      }

      const { levelsUp, fieldName: targetFieldName } = parentRef;

      lines.push(`${indent}// Computed field '${fieldName}': crc32_of '${target}' (parent reference)`);
      lines.push(`${indent}let ${computedVarName} = match ${ctxVar}.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
      lines.push(`${indent}    Some(field_value) => binschema_runtime::crc32(&field_value.to_bytes()),`);
      lines.push(`${indent}    None => return Err(binschema_runtime::BinSchemaError::InvalidValue(`);
      lines.push(`${indent}        format!("Parent field '${targetFieldName}' not found at level ${levelsUp}")`);
      lines.push(`${indent}    )),`);
      lines.push(`${indent}};`);
      lines.push(`${indent}encoder.write_uint32(${computedVarName}, Endianness::${rustEndianness});`);
      return lines;
    }

    // Check for other selector expressions
    if (target.includes("[") || target.includes("<")) {
      throw new Error(`Rust generator does not yet support crc32_of with selector: ${target}`);
    }

    const targetRust = toRustFieldName(target);
    const targetPath = `self.${targetRust}`;
    const crcInputVar = toRustFieldName(fieldName) + "_crc_input";

    lines.push(`${indent}// Computed field '${fieldName}': crc32_of '${target}'`);
    // First, we need to encode the target field to bytes, then compute CRC32
    // For arrays of u8, we can use the slice directly
    lines.push(`${indent}let ${crcInputVar}: Vec<u8> = ${targetPath}.iter().cloned().collect();`);
    lines.push(`${indent}let ${computedVarName} = binschema_runtime::crc32(&${crcInputVar});`);
    lines.push(`${indent}encoder.write_uint32(${computedVarName}, Endianness::${rustEndianness});`);
  } else if (computed.type === "position_of") {
    // Compute position/offset of target field
    const target = computed.target as string;

    // Check for first/last selector
    const firstLastInfo = parseFirstLastTarget(target);
    if (firstLastInfo) {
      const { arrayPath, filterType, selector } = firstLastInfo;
      const positionKey = `${arrayPath}_${filterType}`;

      lines.push(`${indent}// Computed field '${fieldName}': position_of '${target}' (${selector}<${filterType}> selector)`);

      // Use sentinel value (0xFFFFFFFF) when position not found
      const ctxRef = ctxVar || "child_ctx";
      if (selector === "first") {
        lines.push(`${indent}let ${computedVarName} = ${ctxRef}.get_first_position("${positionKey}").unwrap_or(0xFFFFFFFF);`);
      } else {
        lines.push(`${indent}let ${computedVarName} = ${ctxRef}.get_last_position("${positionKey}").unwrap_or(0xFFFFFFFF);`);
      }

      lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      return lines;
    }

    // Check for corresponding selector
    const correspondingInfo = parseCorrespondingTarget(target);
    if (correspondingInfo) {
      const { arrayPath, filterType } = correspondingInfo;
      const positionKey = `${arrayPath}_${filterType}`;

      lines.push(`${indent}// Computed field '${fieldName}': position_of '${target}' (corresponding<${filterType}> selector)`);
      const ctxRef = ctxVar || "child_ctx";

      // Get type occurrence index for correlation
      // The counter was incremented before encoding, so subtract 1
      lines.push(`${indent}let ${computedVarName}_type_idx = ${ctxRef}.get_type_index("${arrayPath}_${field.name}");`);
      lines.push(`${indent}let ${computedVarName}_corr_idx = if ${computedVarName}_type_idx > 0 { ${computedVarName}_type_idx - 1 } else { 0 };`);
      lines.push(`${indent}let ${computedVarName} = ${ctxRef}.get_position("${positionKey}", ${computedVarName}_corr_idx).unwrap_or(0xFFFFFFFF);`);

      lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      return lines;
    }

    // Check for parent reference (../)
    const parentRef = parseParentPath(target);
    if (parentRef) {
      if (!ctxVar) {
        throw new Error(`Computed field '${fieldName}' has parent reference but no context available: ${target}`);
      }

      const { levelsUp, fieldName: targetFieldName } = parentRef;

      lines.push(`${indent}// Computed field '${fieldName}': position_of '${target}' (parent reference)`);
      const fieldSize = getFieldSize(field);
      lines.push(`${indent}let ${computedVarName} = encoder.byte_offset() + ${fieldSize};`);
      lines.push(`${indent}let _ = ${ctxVar}.get_parent_field(${levelsUp}, "${targetFieldName}"); // Validate parent exists`);

      lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
      return lines;
    }

    // Check for complex expressions not handled above
    if (target.includes("[") || target.includes("<")) {
      throw new Error(`Rust generator does not yet support complex computed field targets: ${target}`);
    }

    lines.push(`${indent}// Computed field '${fieldName}': position_of '${target}'`);
    lines.push(`${indent}let ${computedVarName} = encoder.byte_offset();`);

    const fieldSize = getFieldSize(field);
    if (fieldSize > 0) {
      lines.push(`${indent}let ${computedVarName} = ${computedVarName} + ${fieldSize};`);
    }

    lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
  } else if (computed.type === "sum_of_type_sizes") {
    // Sum encoded sizes of array elements matching a specific type
    const target = computed.target as string;
    const elementType = computed.element_type || "";

    if (!target) {
      throw new Error(`Computed field '${fieldName}' (sum_of_type_sizes) has no target specified`);
    }

    // Must be a parent reference
    const parentRef = parseParentPath(target);
    if (!parentRef) {
      throw new Error(`sum_of_type_sizes target '${target}' must be a parent reference (../)`);
    }

    if (!ctxVar) {
      throw new Error(`Computed field '${fieldName}' (sum_of_type_sizes) has parent reference but no context available`);
    }

    const { levelsUp, fieldName: targetFieldName } = parentRef;

    lines.push(`${indent}// Computed field '${fieldName}': sum_of_type_sizes for '${elementType}' in '${target}'`);
    lines.push(`${indent}let ${computedVarName} = match ${ctxVar}.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
    lines.push(`${indent}    Some(field_value) => field_value.sum_type_sizes("${elementType}"),`);
    lines.push(`${indent}    None => return Err(binschema_runtime::BinSchemaError::InvalidValue(`);
    lines.push(`${indent}        format!("Parent field '${targetFieldName}' not found at level ${levelsUp}")`);
    lines.push(`${indent}    )),`);
    lines.push(`${indent}};`);

    // Write the computed value
    lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
  } else if (computed.type === "sum_of_sizes") {
    // Sum encoded sizes of multiple specific fields
    const targets: string[] = computed.targets || [];

    if (!targets.length) {
      throw new Error(`Computed field '${fieldName}' (sum_of_sizes) has no targets specified`);
    }

    lines.push(`${indent}// Computed field '${fieldName}': sum_of_sizes for ${targets.length} target(s)`);
    lines.push(`${indent}let mut ${computedVarName}: usize = 0;`);

    for (const target of targets) {
      const parentRef = parseParentPath(target);
      if (!parentRef) {
        throw new Error(`sum_of_sizes target '${target}' must be a parent reference (../)`);
      }

      if (!ctxVar) {
        throw new Error(`Computed field '${fieldName}' (sum_of_sizes) has parent reference but no context available`);
      }

      const { levelsUp, fieldName: targetFieldName } = parentRef;

      lines.push(`${indent}${computedVarName} += match ${ctxVar}.get_parent_field(${levelsUp}, "${targetFieldName}") {`);
      lines.push(`${indent}    Some(field_value) => field_value.length_of_value(),`);
      lines.push(`${indent}    None => return Err(binschema_runtime::BinSchemaError::InvalidValue(`);
      lines.push(`${indent}        format!("Parent field '${targetFieldName}' not found at level ${levelsUp}")`);
      lines.push(`${indent}    )),`);
      lines.push(`${indent}};`);
    }

    // Write the computed value
    lines.push(...generateComputedFieldWrite(field, computedVarName, rustEndianness, indent));
  } else {
    throw new Error(`Rust generator does not yet support computed type '${computed.type}' (field: ${fieldName})`);
  }

  return lines;
}

/**
 * Generates code to write a computed field value to the encoder
 */
function generateComputedFieldWrite(field: Field, varName: string, rustEndianness: string, indent: string): string[] {
  const lines: string[] = [];

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.write_uint8(${varName} as u8);`);
      break;
    case "uint16":
      lines.push(`${indent}encoder.write_uint16(${varName} as u16, Endianness::${rustEndianness});`);
      break;
    case "uint32":
      lines.push(`${indent}encoder.write_uint32(${varName} as u32, Endianness::${rustEndianness});`);
      break;
    case "uint64":
      lines.push(`${indent}encoder.write_uint64(${varName} as u64, Endianness::${rustEndianness});`);
      break;
    case "varlength": {
      const encoding = (field as any).encoding || "der";
      lines.push(`${indent}encoder.write_varlength(${varName} as u64, "${encoding}")?;`);
      break;
    }
    default:
      throw new Error(`Unsupported computed field type: ${field.type}`);
  }

  return lines;
}

/**
 * Get the byte size of a field type
 */
function getFieldSize(field: Field): number {
  switch (field.type) {
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
      return 0;
  }
}

/**
 * Generates encoding code for a field using a specific value variable
 * (used for conditional fields where the value is unwrapped from Option)
 */
function generateEncodeFieldWithValue(field: Field, valueVar: string, defaultEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const endianness = (field as any).endianness || defaultEndianness;
  const rustEndianness = mapEndianness(endianness);

  switch (field.type) {
    case "uint8":
      lines.push(`${indent}encoder.write_uint8(*${valueVar});`);
      break;
    case "uint16":
      lines.push(`${indent}encoder.write_uint16(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "uint32":
      lines.push(`${indent}encoder.write_uint32(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "uint64":
      lines.push(`${indent}encoder.write_uint64(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "int8":
      lines.push(`${indent}encoder.write_int8(*${valueVar});`);
      break;
    case "int16":
      lines.push(`${indent}encoder.write_int16(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "int32":
      lines.push(`${indent}encoder.write_int32(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "int64":
      lines.push(`${indent}encoder.write_int64(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "float32":
      lines.push(`${indent}encoder.write_float32(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "float64":
      lines.push(`${indent}encoder.write_float64(*${valueVar}, Endianness::${rustEndianness});`);
      break;
    case "string":
      // For strings, call the encoding function
      // Note: value is already a reference from if-let binding
      lines.push(...generateEncodeStringWithRef(field as any, valueVar, endianness, indent));
      break;
    case "array":
      // For arrays, iterate and encode each item
      // Note: value is already a reference from if-let binding, use iter() to avoid double reference
      lines.push(...generateEncodeArrayWithRef(field as any, valueVar, endianness, rustEndianness, indent));
      break;
    default:
      // Type reference - nested struct, encode directly into encoder
      lines.push(`${indent}${valueVar}.encode_into(encoder)?;`);
      break;
  }

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
    case "string": {
      // String const - write the const string value as fixed-length bytes
      const fieldAny = field as any;
      const kind = fieldAny.kind || "fixed";
      const encoding = fieldAny.encoding || "utf8";
      const constStr = JSON.stringify(value); // Rust string literal

      if (kind === "fixed") {
        const length = fieldAny.length || 0;
        if (encoding === "latin1" || encoding === "ascii") {
          lines.push(`${indent}let const_str_bytes: Vec<u8> = ${constStr}.chars().map(|c| c as u8).collect();`);
        } else {
          lines.push(`${indent}let const_str_bytes: &[u8] = ${constStr}.as_bytes();`);
        }
        lines.push(`${indent}for i in 0..${length} {`);
        lines.push(`${indent}    if i < const_str_bytes.len() {`);
        lines.push(`${indent}        encoder.write_uint8(const_str_bytes[i]);`);
        lines.push(`${indent}    } else {`);
        lines.push(`${indent}        encoder.write_uint8(0);`);
        lines.push(`${indent}    }`);
        lines.push(`${indent}}`);
      } else {
        throw new Error(`Unsupported string const kind: ${kind} (field: ${field.name})`);
      }
      break;
    }
    default:
      throw new Error(`Unsupported const field type: ${field.type} (field: ${field.name})`);
  }

  return lines;
}

/**
 * Generates the decode methods
 * If the type needs decode context (has field_referenced arrays with external fields),
 * generates decode_with_decoder_and_context that accepts a HashMap<String, u64> context.
 */
function generateDecodeMethod(name: string, fields: Field[], defaultEndianness: string, defaultBitOrder: string, schema: BinarySchema, instances?: any[]): string[] {
  const lines: string[] = [];
  const bitOrder = mapBitOrder(defaultBitOrder);
  const needsContext = typeNeedsDecodeContext(name, schema);
  const hasInstances = instances && instances.length > 0;

  // Public decode function
  lines.push(`    pub fn decode(bytes: &[u8]) -> Result<Self> {`);
  lines.push(`        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::${bitOrder});`);
  if (needsContext) {
    lines.push(`        Self::decode_with_decoder_and_context(&mut decoder, None)`);
  } else {
    lines.push(`        Self::decode_with_decoder(&mut decoder)`);
  }
  lines.push(`    }`);
  lines.push(``);

  // Helper function that accepts an existing decoder (for nested structs)
  lines.push(`    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {`);
  if (needsContext) {
    lines.push(`        Self::decode_with_decoder_and_context(decoder, None)`);
    lines.push(`    }`);
    lines.push(``);

    // Context-aware version
    lines.push(`    pub fn decode_with_decoder_and_context(decoder: &mut BitStreamDecoder, ctx: Option<&HashMap<String, u64>>) -> Result<Self> {`);
  }

  // Generate decoding logic for each field
  // Note: We decode ALL fields (including unnamed) because they may be referenced
  // by other fields (e.g., as length_field for arrays)
  for (const field of fields) {
    lines.push(...generateDecodeField(field, defaultEndianness, "        ", name, schema, fields, needsContext));
  }

  // Generate instance field decoding (position-based)
  // Only generate if there are non-inline-union instances
  if (hasInstances) {
    const simpleInstances = instances!.filter((i: any) => typeof i.type !== "object");
    if (simpleInstances.length > 0) {
      lines.push(...generateInstanceFieldDecoding(simpleInstances, fields, schema, defaultEndianness, "        "));
    }
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
  // Include instance fields in the struct
  if (hasInstances) {
    for (const instance of instances!) {
      // Skip inline discriminated unions for now
      if (typeof instance.type === "object") continue;
      const fieldName = toRustFieldName(instance.name);
      lines.push(`            ${fieldName},`);
    }
  }
  lines.push(`        })`);
  lines.push(`    }`);

  return lines;
}

/**
 * Generates code to resolve a position expression for instance fields.
 * Position can be a number (absolute), negative number (from EOF), or string (field reference).
 */
function generatePositionResolution(position: number | string, indent: string): string[] {
  const lines: string[] = [];

  if (typeof position === "number") {
    if (position < 0) {
      // Negative position - from EOF
      lines.push(`${indent}let position = decoder.bytes_len() as i64 + (${position}i64);`);
      lines.push(`${indent}let position = position as usize;`);
    } else {
      // Positive position - absolute
      lines.push(`${indent}let position = ${position}usize;`);
    }
  } else {
    // Field reference - resolve from already-decoded fields
    const parts = position.split(".");
    if (parts.length === 1) {
      // Simple field reference like "data_offset"
      const fieldName = toRustFieldName(parts[0]);
      lines.push(`${indent}let position = ${fieldName} as usize;`);
    } else {
      // Nested path like "end_record.dir_offset" or "index.data_offset"
      // Build access path from decoded locals
      let accessPath = toRustFieldName(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        accessPath += `.${toRustFieldName(parts[i])}`;
      }
      lines.push(`${indent}let position = ${accessPath} as usize;`);
    }
  }

  return lines;
}

/**
 * Generates code to decode instance fields by seeking to their positions.
 * Instance fields are decoded after all sequence fields.
 * Follows the same pattern as the Go generator.
 */
function generateInstanceFieldDecoding(
  instances: any[],
  sequenceFields: Field[],
  schema: BinarySchema,
  defaultEndianness: string,
  indent: string
): string[] {
  const lines: string[] = [];

  if (!instances || instances.length === 0) {
    return lines;
  }

  lines.push(``);
  lines.push(`${indent}// Decode instance fields (position-based)`);
  lines.push(`${indent}let saved_position = decoder.position();`);
  lines.push(``);

  for (const instance of instances) {
    const instanceType = instance.type;

    // Skip inline discriminated unions for now
    if (typeof instanceType === "object") continue;

    const fieldName = toRustFieldName(instance.name);

    lines.push(`${indent}// Instance field: ${instance.name}`);

    // Resolve position
    lines.push(...generatePositionResolution(instance.position, indent));

    // Validate alignment if specified
    if (instance.alignment && instance.alignment > 1) {
      const alignment = instance.alignment;
      lines.push(`${indent}if position % ${alignment} != 0 {`);
      lines.push(`${indent}    return Err(binschema_runtime::BinSchemaError::InvalidValue(format!("Position {} is not aligned to ${alignment} bytes", position)));`);
      lines.push(`${indent}}`);
    }

    // Seek to position
    lines.push(`${indent}decoder.seek(position)?;`);

    // Decode the type at that position
    const rustTypeName = toRustTypeName(instanceType);
    const typeDef = schema.types[instanceType];

    if (typeDef && "sequence" in typeDef) {
      // Composite type - use appropriate decode_with_decoder (Output if split, plain if unified)
      const instNeedsSplit = typeNeedsInputOutputSplit(instanceType, schema);
      const instDecodeType = instNeedsSplit ? `${rustTypeName}Output` : rustTypeName;
      lines.push(`${indent}let ${fieldName} = ${instDecodeType}::decode_with_decoder(decoder)?;`);
    } else if (typeDef && "variants" in typeDef) {
      // Discriminated union
      lines.push(`${indent}let ${fieldName} = ${rustTypeName}::decode_with_decoder(decoder)?;`);
    } else {
      // Type alias or other
      lines.push(`${indent}let ${fieldName} = ${rustTypeName}::decode_with_decoder(decoder)?;`);
    }

    lines.push(``);
  }

  // Restore position
  lines.push(`${indent}decoder.seek(saved_position)?;`);

  return lines;
}

/**
 * Generates code to decode an inline discriminated union for an instance field.
 * Handles both field-based and peek-based discriminators.
 */
function generateInstanceInlineUnionDecode(
  unionDef: any,
  targetFieldName: string,
  schema: BinarySchema,
  defaultEndianness: string,
  indent: string
): string[] {
  const lines: string[] = [];
  const discriminator = unionDef.discriminator;
  const variants = unionDef.variants;

  // Get discriminator value
  if (discriminator.peek) {
    const peekType = discriminator.peek;
    lines.push(`${indent}let discriminator_value = decoder.peek_uint8()?;`);
  } else if (discriminator.field) {
    // Field-based discriminator - reference the already-decoded field
    const fieldName = toRustFieldName(discriminator.field);
    lines.push(`${indent}let discriminator_value = ${fieldName};`);
  }

  // Generate match cases
  // For inline unions, we'll use serde_json::Value to wrap the result
  lines.push(`${indent}let ${targetFieldName} = {`);

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const variantType = variant.type;
    const rustVariantType = toRustTypeName(variantType);

    if (variant.when) {
      // Extract the value from "value == 0x01"
      const match = variant.when.match(/value\s*==\s*(.+)$/);
      if (match) {
        const value = match[1].trim();
        if (i === 0) {
          lines.push(`${indent}    if discriminator_value == ${value} {`);
        } else {
          lines.push(`${indent}    } else if discriminator_value == ${value} {`);
        }
      }
    }

    const typeDef = schema.types[variantType];
    if (typeDef && "sequence" in typeDef) {
      const varNeedsSplit = typeNeedsInputOutputSplit(variantType, schema);
      const varDecodeType = varNeedsSplit ? `${rustVariantType}Output` : rustVariantType;
      lines.push(`${indent}        let v = ${varDecodeType}::decode_with_decoder(decoder)?;`);
    } else {
      lines.push(`${indent}        let v = ${rustVariantType}::decode_with_decoder(decoder)?;`);
    }
    lines.push(`${indent}        serde_json::json!({"type": "${variantType}", "value": v})`);
  }

  lines.push(`${indent}    } else {`);
  lines.push(`${indent}        return Err(binschema_runtime::BinSchemaError::InvalidValue(format!("Unknown discriminator value: {}", discriminator_value)));`);
  lines.push(`${indent}    }`);
  lines.push(`${indent}};`);

  return lines;
}

/**
 * Generates encoding code for a single field
 */
function generateEncodeField(field: Field, defaultEndianness: string, indent: string, schema?: BinarySchema, hasContext?: boolean, choiceEncodeCtxVar?: string): string[] {
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
        lines.push(`${indent}${fieldName}.encode(encoder);`);
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
      lines.push(...generateEncodeArray(field as any, fieldName, endianness, rustEndianness, indent, schema, choiceEncodeCtxVar));
      break;

    case "optional":
      lines.push(...generateEncodeOptional(field as any, fieldName, endianness, indent));
      break;

    case "padding": {
      // Alignment padding: write zero bytes to align to the specified boundary
      const alignTo = (field as any).align_to || 4;
      lines.push(`${indent}// Alignment padding to ${alignTo}-byte boundary`);
      lines.push(`${indent}{`);
      lines.push(`${indent}    let current_pos = encoder.byte_offset();`);
      lines.push(`${indent}    let padding_bytes = (${alignTo} - (current_pos % ${alignTo})) % ${alignTo};`);
      lines.push(`${indent}    for _ in 0..padding_bytes {`);
      lines.push(`${indent}        encoder.write_uint8(0);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);
      break;
    }

    case "back_reference":
      // Back reference - encode the target value directly
      lines.push(...generateEncodeBackReference(field as any, fieldName, indent));
      break;

    case "choice":
    case "discriminated_union": {
      // Inline choice/discriminated_union — check if any variant transitively contains back_references
      const fieldAnyForChoice = field as any;
      const variantTypesForChoice: string[] = (fieldAnyForChoice.choices || fieldAnyForChoice.variants || []).map((c: any) => c.type);
      const anyVariantHasBackRef = schema ? variantTypesForChoice.some(t => typeTransitivelyContainsBackReference(t, schema)) : false;
      if (anyVariantHasBackRef) {
        lines.push(`${indent}${fieldName}.encode_into_with_context(encoder, ctx)?;`);
      } else {
        lines.push(`${indent}${fieldName}.encode_into(encoder)?;`);
      }
      break;
    }

    default: {
      // Type reference - nested struct or type alias
      // Check if type transitively contains back_references — if so, use encode_into_with_context
      const fieldTypeName = field.type as string;
      if (schema && typeTransitivelyContainsBackReference(fieldTypeName, schema)) {
        lines.push(`${indent}{`);
        lines.push(`${indent}    let field_ctx = ctx.with_base_offset(encoder.byte_offset());`);
        lines.push(`${indent}    ${fieldName}.encode_into_with_context(encoder, &field_ctx)?;`);
        lines.push(`${indent}}`);
      } else {
        lines.push(...generateEncodeNestedStruct(field, fieldName, indent));
      }
      break;
    }
  }

  return lines;
}

/**
 * Generates the Rust expression to convert a string to bytes based on encoding.
 * UTF-8: .as_bytes() gives the raw bytes directly
 * Latin-1/ASCII: iterate chars, each char's code point maps directly to a byte value
 */
function generateStringToBytes(fieldName: string, encoding: string, indent: string): string[] {
  const lines: string[] = [];
  if (encoding === "latin1" || encoding === "ascii") {
    // Latin-1/ASCII: each char maps directly to a byte value (charCode == byte value for 0-255)
    lines.push(`${indent}let string_bytes: Vec<u8> = ${fieldName}.chars().map(|c| c as u8).collect();`);
  } else {
    // UTF-8: use as_bytes() directly
    lines.push(`${indent}let string_bytes: &[u8] = ${fieldName}.as_bytes();`);
  }
  return lines;
}

/**
 * Generates the Rust expression to get string length (in encoded bytes) based on encoding.
 * UTF-8: .len() gives byte count (since Rust strings are UTF-8)
 * Latin-1/ASCII: .chars().count() gives char count, which equals byte count for Latin-1
 */
function generateStringLen(fieldName: string, encoding: string): string {
  if (encoding === "latin1" || encoding === "ascii") {
    return `${fieldName}.chars().count()`;
  }
  return `${fieldName}.len()`;
}

/**
 * Generates encoding code for string field
 */
function generateEncodeString(field: any, fieldName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const rustEndianness = mapEndianness(endianness);
  const encoding = field.encoding || "utf8";

  switch (kind) {
    case "length_prefixed": {
      const lengthType = field.length_type || "uint8";
      const lenExpr = generateStringLen(fieldName, encoding);
      // Write length prefix
      switch (lengthType) {
        case "uint8":
          lines.push(`${indent}encoder.write_uint8(${lenExpr} as u8);`);
          break;
        case "uint16":
          lines.push(`${indent}encoder.write_uint16(${lenExpr} as u16, Endianness::${rustEndianness});`);
          break;
        case "uint32":
          lines.push(`${indent}encoder.write_uint32(${lenExpr} as u32, Endianness::${rustEndianness});`);
          break;
        case "uint64":
          lines.push(`${indent}encoder.write_uint64(${lenExpr} as u64, Endianness::${rustEndianness});`);
          break;
      }
      // Write bytes
      lines.push(...generateStringToBytes(fieldName, encoding, indent));
      lines.push(`${indent}for &b in string_bytes.iter() {`);
      lines.push(`${indent}    encoder.write_uint8(b);`);
      lines.push(`${indent}}`);
      break;
    }

    case "null_terminated":
      lines.push(...generateStringToBytes(fieldName, encoding, indent));
      lines.push(`${indent}for &b in string_bytes.iter() {`);
      lines.push(`${indent}    encoder.write_uint8(b);`);
      lines.push(`${indent}}`);
      lines.push(`${indent}encoder.write_uint8(0);`);
      break;

    case "fixed": {
      const length = field.length || 0;
      lines.push(...generateStringToBytes(fieldName, encoding, indent));
      lines.push(`${indent}for i in 0..${length} {`);
      lines.push(`${indent}    if i < string_bytes.len() {`);
      lines.push(`${indent}        encoder.write_uint8(string_bytes[i]);`);
      lines.push(`${indent}    } else {`);
      lines.push(`${indent}        encoder.write_uint8(0);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);
      break;
    }

    case "field_referenced":
      // Length is determined by another field, just write the bytes
      lines.push(...generateStringToBytes(fieldName, encoding, indent));
      lines.push(`${indent}for &b in string_bytes.iter() {`);
      lines.push(`${indent}    encoder.write_uint8(b);`);
      lines.push(`${indent}}`);
      break;

    default:
      throw new Error(`Unknown string kind: ${kind}`);
  }

  return lines;
}

/**
 * Generates encoding code for string field when the value is already a reference
 * Used for conditional fields where if-let binds as ref
 */
function generateEncodeStringWithRef(field: any, valueVar: string, endianness: string, indent: string): string[] {
  // Delegate to the main generateEncodeString - both handle encoding-aware byte conversion
  return generateEncodeString(field, valueVar, endianness, indent);
}

/**
 * Generates encoding code for array field when the value is already a reference
 * Uses .iter() instead of & to avoid double reference
 */
function generateEncodeArrayWithRef(field: any, valueVar: string, endianness: string, rustEndianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;

  // Write length prefix for length_prefixed and length_prefixed_items arrays
  if (kind === "length_prefixed" || kind === "length_prefixed_items") {
    const lengthType = field.length_type || "uint8";
    switch (lengthType) {
      case "uint8":
        lines.push(`${indent}encoder.write_uint8(${valueVar}.len() as u8);`);
        break;
      case "uint16":
        lines.push(`${indent}encoder.write_uint16(${valueVar}.len() as u16, Endianness::${rustEndianness});`);
        break;
      case "uint32":
        lines.push(`${indent}encoder.write_uint32(${valueVar}.len() as u32, Endianness::${rustEndianness});`);
        break;
      case "uint64":
        lines.push(`${indent}encoder.write_uint64(${valueVar}.len() as u64, Endianness::${rustEndianness});`);
        break;
    }
  }

  // Handle byte_length_prefixed arrays - need to write total byte length, not item count
  if (kind === "byte_length_prefixed") {
    const lengthType = field.length_type || "uint8";
    const itemType = items?.type;

    const lengthEncoding = field.length_encoding || "der";

    // For uint8 items, byte length = item count (optimization)
    if (itemType === "uint8") {
      switch (lengthType) {
        case "uint8":
          lines.push(`${indent}encoder.write_uint8(${valueVar}.len() as u8);`);
          break;
        case "uint16":
          lines.push(`${indent}encoder.write_uint16(${valueVar}.len() as u16, Endianness::${rustEndianness});`);
          break;
        case "uint32":
          lines.push(`${indent}encoder.write_uint32(${valueVar}.len() as u32, Endianness::${rustEndianness});`);
          break;
        case "uint64":
          lines.push(`${indent}encoder.write_uint64(${valueVar}.len() as u64, Endianness::${rustEndianness});`);
          break;
        case "varlength":
          lines.push(`${indent}encoder.write_varlength(${valueVar}.len() as u64, "${lengthEncoding}")?;`);
          break;
      }
    } else {
      // For other types, need to compute byte size
      // Get the fixed item size if possible
      const itemSize = getItemSizeForRust(items);
      if (itemSize !== null) {
        // Fixed-size items: byte_length = item_count * item_size
        switch (lengthType) {
          case "uint8":
            lines.push(`${indent}encoder.write_uint8((${valueVar}.len() * ${itemSize}) as u8);`);
            break;
          case "uint16":
            lines.push(`${indent}encoder.write_uint16((${valueVar}.len() * ${itemSize}) as u16, Endianness::${rustEndianness});`);
            break;
          case "uint32":
            lines.push(`${indent}encoder.write_uint32((${valueVar}.len() * ${itemSize}) as u32, Endianness::${rustEndianness});`);
            break;
          case "uint64":
            lines.push(`${indent}encoder.write_uint64((${valueVar}.len() * ${itemSize}) as u64, Endianness::${rustEndianness});`);
            break;
          case "varlength":
            lines.push(`${indent}encoder.write_varlength((${valueVar}.len() * ${itemSize}) as u64, "${lengthEncoding}")?;`);
            break;
        }
      } else {
        // Variable-size items: encode to temp buffer first to measure
        lines.push(`${indent}// Encode items to temp encoder to measure byte length`);
        lines.push(`${indent}let mut temp_encoder = BitStreamEncoder::new(BitOrder::MsbFirst);`);
        lines.push(`${indent}for item in ${valueVar}.iter() {`);
        lines.push(`${indent}    item.encode_into(&mut temp_encoder)?;`);
        lines.push(`${indent}}`);
        lines.push(`${indent}let byte_length = temp_encoder.finish().len();`);
        switch (lengthType) {
          case "uint8":
            lines.push(`${indent}encoder.write_uint8(byte_length as u8);`);
            break;
          case "uint16":
            lines.push(`${indent}encoder.write_uint16(byte_length as u16, Endianness::${rustEndianness});`);
            break;
          case "uint32":
            lines.push(`${indent}encoder.write_uint32(byte_length as u32, Endianness::${rustEndianness});`);
            break;
          case "uint64":
            lines.push(`${indent}encoder.write_uint64(byte_length as u64, Endianness::${rustEndianness});`);
            break;
          case "varlength":
            lines.push(`${indent}encoder.write_varlength(byte_length as u64, "${lengthEncoding}")?;`);
            break;
        }
      }
    }
  }

  // Generate loop for encoding items - use .iter() since value is already a reference
  lines.push(`${indent}for item in ${valueVar}.iter() {`);

  // For length_prefixed_items, write item length prefix before each item
  if (kind === "length_prefixed_items" && field.item_length_type) {
    const itemLengthType = field.item_length_type;
    const itemSize = getItemSizeForRust(items);

    if (itemSize !== null) {
      // Fixed-size item - write constant size
      switch (itemLengthType) {
        case "uint8":
          lines.push(`${indent}    encoder.write_uint8(${itemSize});`);
          break;
        case "uint16":
          lines.push(`${indent}    encoder.write_uint16(${itemSize}, Endianness::${rustEndianness});`);
          break;
        case "uint32":
          lines.push(`${indent}    encoder.write_uint32(${itemSize}, Endianness::${rustEndianness});`);
          break;
        case "uint64":
          lines.push(`${indent}    encoder.write_uint64(${itemSize}, Endianness::${rustEndianness});`);
          break;
      }
    } else {
      // Variable-size item - need to encode to temp buffer to measure size
      lines.push(`${indent}    // Encode item to measure size`);
      lines.push(`${indent}    let item_bytes = item.encode()?;`);
      switch (itemLengthType) {
        case "uint8":
          lines.push(`${indent}    encoder.write_uint8(item_bytes.len() as u8);`);
          break;
        case "uint16":
          lines.push(`${indent}    encoder.write_uint16(item_bytes.len() as u16, Endianness::${rustEndianness});`);
          break;
        case "uint32":
          lines.push(`${indent}    encoder.write_uint32(item_bytes.len() as u32, Endianness::${rustEndianness});`);
          break;
        case "uint64":
          lines.push(`${indent}    encoder.write_uint64(item_bytes.len() as u64, Endianness::${rustEndianness});`);
          break;
      }
      lines.push(`${indent}    for b in item_bytes {`);
      lines.push(`${indent}        encoder.write_uint8(b);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);

      // Write null terminator if needed
      if (kind === "null_terminated") {
        lines.push(`${indent}encoder.write_uint8(0);`);
      }

      return lines;
    }
  }

  const itemField: Field = {
    name: "",
    type: items.type,
    ...(items as any)
  };

  lines.push(...generateEncodeArrayItem(itemField, "item", endianness, `${indent}    `));
  lines.push(`${indent}}`);

  // Write null terminator if needed
  if (kind === "null_terminated") {
    lines.push(`${indent}encoder.write_uint8(0);`);
  }

  return lines;
}

/**
 * Generates encoding code for array field
 */
function generateEncodeArray(field: any, fieldName: string, endianness: string, rustEndianness: string, indent: string, schema?: BinarySchema, choiceEncodeCtxVar?: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;

  // Write length prefix for length_prefixed and length_prefixed_items arrays
  if (kind === "length_prefixed" || kind === "length_prefixed_items") {
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
      case "varlength": {
        const lengthEncoding = field.length_encoding || "der";
        lines.push(`${indent}encoder.write_varlength(${fieldName}.len() as u64, "${lengthEncoding}")?;`);
        break;
      }
    }
  }

  // Handle byte_length_prefixed arrays - need to write total byte length, not item count
  if (kind === "byte_length_prefixed") {
    const lengthType = field.length_type || "uint8";
    const lengthEncoding = field.length_encoding || "der";
    const itemType = items?.type;

    // For uint8 items, byte length = item count (optimization)
    if (itemType === "uint8") {
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
        case "varlength":
          lines.push(`${indent}encoder.write_varlength(${fieldName}.len() as u64, "${lengthEncoding}")?;`);
          break;
      }
    } else {
      // For other types, need to compute byte size
      const itemSize = getItemSizeForRust(items);
      if (itemSize !== null) {
        // Fixed-size items: byte_length = item_count * item_size
        switch (lengthType) {
          case "uint8":
            lines.push(`${indent}encoder.write_uint8((${fieldName}.len() * ${itemSize}) as u8);`);
            break;
          case "uint16":
            lines.push(`${indent}encoder.write_uint16((${fieldName}.len() * ${itemSize}) as u16, Endianness::${rustEndianness});`);
            break;
          case "uint32":
            lines.push(`${indent}encoder.write_uint32((${fieldName}.len() * ${itemSize}) as u32, Endianness::${rustEndianness});`);
            break;
          case "uint64":
            lines.push(`${indent}encoder.write_uint64((${fieldName}.len() * ${itemSize}) as u64, Endianness::${rustEndianness});`);
            break;
          case "varlength":
            lines.push(`${indent}encoder.write_varlength((${fieldName}.len() * ${itemSize}) as u64, "${lengthEncoding}")?;`);
            break;
        }
      } else {
        // Variable-size items: encode to temp buffer first to measure
        lines.push(`${indent}// Encode items to temp encoder to measure byte length`);
        lines.push(`${indent}let mut temp_encoder = BitStreamEncoder::new(BitOrder::MsbFirst);`);
        lines.push(`${indent}for item in &${fieldName} {`);
        lines.push(`${indent}    item.encode_into(&mut temp_encoder)?;`);
        lines.push(`${indent}}`);
        lines.push(`${indent}let byte_length = temp_encoder.finish().len();`);
        switch (lengthType) {
          case "uint8":
            lines.push(`${indent}encoder.write_uint8(byte_length as u8);`);
            break;
          case "uint16":
            lines.push(`${indent}encoder.write_uint16(byte_length as u16, Endianness::${rustEndianness});`);
            break;
          case "uint32":
            lines.push(`${indent}encoder.write_uint32(byte_length as u32, Endianness::${rustEndianness});`);
            break;
          case "uint64":
            lines.push(`${indent}encoder.write_uint64(byte_length as u64, Endianness::${rustEndianness});`);
            break;
          case "varlength":
            lines.push(`${indent}encoder.write_varlength(byte_length as u64, "${lengthEncoding}")?;`);
            break;
        }
      }
    }
  }

  // Generate loop for encoding items
  // If we have a context variable, use enumerate for iteration index tracking
  if (choiceEncodeCtxVar) {
    const arrayFieldName = field.name || "";
    lines.push(`${indent}for (${arrayFieldName}_idx, item) in ${fieldName}.iter().enumerate() {`);
    lines.push(`${indent}    // Track array iteration for corresponding<Type> correlation`);
    lines.push(`${indent}    ${choiceEncodeCtxVar}.set_array_iteration("${arrayFieldName}", ${arrayFieldName}_idx);`);
  } else {
    lines.push(`${indent}for item in &${fieldName} {`);
  }

  // For length_prefixed_items, write item length prefix before each item
  if (kind === "length_prefixed_items" && field.item_length_type) {
    const itemLengthType = field.item_length_type;
    const itemSize = getItemSizeForRust(items);

    if (itemSize !== null) {
      // Fixed-size item - write constant size
      switch (itemLengthType) {
        case "uint8":
          lines.push(`${indent}    encoder.write_uint8(${itemSize});`);
          break;
        case "uint16":
          lines.push(`${indent}    encoder.write_uint16(${itemSize}, Endianness::${rustEndianness});`);
          break;
        case "uint32":
          lines.push(`${indent}    encoder.write_uint32(${itemSize}, Endianness::${rustEndianness});`);
          break;
        case "uint64":
          lines.push(`${indent}    encoder.write_uint64(${itemSize}, Endianness::${rustEndianness});`);
          break;
      }
    } else {
      // Variable-size item - need to encode to temp buffer to measure size
      lines.push(`${indent}    // Encode item to measure size`);
      lines.push(`${indent}    let item_bytes = item.encode()?;`);
      switch (itemLengthType) {
        case "uint8":
          lines.push(`${indent}    encoder.write_uint8(item_bytes.len() as u8);`);
          break;
        case "uint16":
          lines.push(`${indent}    encoder.write_uint16(item_bytes.len() as u16, Endianness::${rustEndianness});`);
          break;
        case "uint32":
          lines.push(`${indent}    encoder.write_uint32(item_bytes.len() as u32, Endianness::${rustEndianness});`);
          break;
        case "uint64":
          lines.push(`${indent}    encoder.write_uint64(item_bytes.len() as u64, Endianness::${rustEndianness});`);
          break;
      }
      lines.push(`${indent}    for b in item_bytes {`);
      lines.push(`${indent}        encoder.write_uint8(b);`);
      lines.push(`${indent}    }`);
      lines.push(`${indent}}`);

      // Write null terminator for null_terminated arrays
      if (kind === "null_terminated") {
        lines.push(`${indent}encoder.write_uint8(0);`);
      }

      return lines;
    }
  }

  const itemField: Field = {
    name: "",
    type: items.type,
    ...(items as any)
  };

  // For choice arrays with context, increment type index before encoding each item
  // This enables corresponding<Type> selectors to work
  if (choiceEncodeCtxVar && items.type === "choice" && items.choices) {
    const arrayFieldName = field.name || "";
    lines.push(`${indent}    // Increment type index for corresponding selector tracking`);
    lines.push(`${indent}    ${choiceEncodeCtxVar}.increment_type_index(&format!("{}_{}", "${arrayFieldName}", item.type_name()));`);
  }

  // Check if array items need context (for parent reference resolution)
  const itemsNeedContext = schema ? arrayItemNeedsContext(field, schema) : false;

  // Check if array items contain back_reference types (need compression context)
  const itemsContainBackRef = schema && items?.type ? typeTransitivelyContainsBackReference(items.type, schema) : false;

  if (itemsContainBackRef && !choiceEncodeCtxVar) {
    // Generate per-item compression context with updated base_offset
    lines.push(`${indent}    let item_ctx = ctx.with_base_offset(encoder.byte_offset());`);
  }

  const innerLines = generateEncodeArrayItem(itemField, "item", endianness, `${indent}    `, schema, itemsNeedContext, choiceEncodeCtxVar, itemsContainBackRef);
  lines.push(...innerLines);

  lines.push(`${indent}}`);

  // Write null terminator for null_terminated arrays (skip if last item was a terminal variant)
  if (kind === "null_terminated") {
    const terminalVariants = field.terminal_variants as string[] | undefined;
    if (terminalVariants && terminalVariants.length > 0 && items?.type) {
      // Check if the last item could be a terminal variant — if so, conditionally skip null byte
      const itemTypeDef = schema?.types?.[items.type];
      const isDiscriminatedUnion = itemTypeDef && "variants" in itemTypeDef;
      if (isDiscriminatedUnion) {
        const enumName = toRustTypeName(items.type);
        lines.push(`${indent}// Skip null terminator if last item was a terminal variant`);
        lines.push(`${indent}let is_terminal = ${fieldName}.last().map_or(false, |last| {`);
        lines.push(`${indent}    match last {`);
        for (const tv of terminalVariants) {
          const tvRust = toRustTypeName(tv);
          lines.push(`${indent}        ${enumName}::${tvRust}(_) => true,`);
        }
        lines.push(`${indent}        _ => false,`);
        lines.push(`${indent}    }`);
        lines.push(`${indent}});`);
        lines.push(`${indent}if !is_terminal {`);
        lines.push(`${indent}    encoder.write_uint8(0);`);
        lines.push(`${indent}}`);
      } else {
        lines.push(`${indent}encoder.write_uint8(0);`);
      }
    } else {
      lines.push(`${indent}encoder.write_uint8(0);`);
    }
  }

  return lines;
}

/**
 * Get the fixed size of an item type, or null if variable-size
 */
function getItemSizeForRust(items: any): number | null {
  const itemType = items.type;
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
      // Variable-size or complex type
      return null;
  }
}

/**
 * Generates encoding code for a single array item
 */
function generateEncodeArrayItem(field: Field, itemVar: string, endianness: string, indent: string, schema?: BinarySchema, hasContext?: boolean, choiceEncodeCtxVar?: string, hasCompressionCtx?: boolean): string[] {
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
    default: {
      // Type reference - nested struct, type alias, or choice enum
      // Check if the item type needs context (has parent references or nested structs that do)
      let itemNeedsContext = false;
      if (hasContext && schema && field.type) {
        const fieldType = field.type as string;
        const typeDef = schema.types?.[fieldType];
        if (typeDef && "sequence" in typeDef) {
          const itemFields = (typeDef as any).sequence as Field[];
          itemNeedsContext = typeHasParentReferences(itemFields) || hasNestedStructFields(itemFields, schema);
        }
      }
      if (choiceEncodeCtxVar) {
        // Choice enum with encode context - call encode_into_with_context
        lines.push(`${indent}${itemVar}.encode_into_with_context(encoder, &${choiceEncodeCtxVar})?;`);
      } else if (hasCompressionCtx) {
        // Back-reference compression context — pass per-item context
        lines.push(`${indent}${itemVar}.encode_into_with_context(encoder, &item_ctx)?;`);
      } else if (itemNeedsContext) {
        lines.push(`${indent}${itemVar}.encode_into_with_context(encoder, &child_ctx)?;`);
      } else {
        lines.push(`${indent}${itemVar}.encode_into(encoder)?;`);
      }
      break;
    }
  }

  return lines;
}

/**
 * Generates encoding code for nested struct
 */
function generateEncodeNestedStruct(field: Field, fieldName: string, indent: string): string[] {
  const lines: string[] = [];

  lines.push(`${indent}${fieldName}.encode_into(encoder)?;`);

  return lines;
}

/**
 * Generates encoding code for optional field
 */
function generateEncodeOptional(field: any, fieldName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const valueType = field.value_type;
  const presenceType = field.presence_type || "uint8";
  const rustEndianness = mapEndianness(endianness);

  lines.push(`${indent}if let Some(ref v) = ${fieldName} {`);
  if (presenceType === "bit") {
    lines.push(`${indent}    encoder.write_bits(1, 1);`);
  } else {
    lines.push(`${indent}    encoder.write_uint8(1);`);
  }

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
      lines.push(`${indent}    v.encode_into(encoder)?;`);
      break;
  }

  lines.push(`${indent}} else {`);
  if (presenceType === "bit") {
    lines.push(`${indent}    encoder.write_bits(0, 1);`);
  } else {
    lines.push(`${indent}    encoder.write_uint8(0);`);
  }
  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates decoding code for a single field
 */
function generateDecodeField(field: Field, defaultEndianness: string, indent: string, containingTypeName: string, schema: BinarySchema, allFields?: Field[], hasContext?: boolean): string[] {
  const lines: string[] = [];
  const varName = toRustFieldName(field.name);
  const endianness = (field as any).endianness || defaultEndianness;
  const rustEndianness = mapEndianness(endianness);

  // Skip fields without a type (e.g., conditional markers)
  if (!field.type) {
    return lines;
  }

  // Handle conditional fields
  if (isFieldConditional(field)) {
    const fieldAny = field as any;
    const condition = fieldAny.conditional;

    // Convert condition to Rust - for decoding, we use plain variable names (no self.)
    // Pass allFields so we can detect conditional parent fields for Option-safe access
    const rustCondition = convertConditionalToRust(condition, "", allFields);

    // Generate: let field = if condition { Some(decode_value) } else { None };
    lines.push(`${indent}let ${varName} = if ${rustCondition} {`);

    // Generate the decode for the inner value
    const innerLines = generateDecodeFieldInner(field, defaultEndianness, `${indent}    `, containingTypeName, schema);
    lines.push(...innerLines);
    lines.push(`${indent}    Some(${varName}_inner)`);
    lines.push(`${indent}} else {`);
    lines.push(`${indent}    None`);
    lines.push(`${indent}};`);

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
      lines.push(...generateDecodeArray(field as any, varName, endianness, rustEndianness, indent, schema, containingTypeName, hasContext));
      break;

    case "optional":
      lines.push(...generateDecodeOptional(field as any, varName, endianness, indent, schema));
      break;

    case "padding": {
      // Alignment padding: skip bytes to align to the specified boundary
      const alignTo = (field as any).align_to || 4;
      lines.push(`${indent}// Skip alignment padding to ${alignTo}-byte boundary`);
      lines.push(`${indent}{`);
      lines.push(`${indent}    let current_pos = decoder.position();`);
      lines.push(`${indent}    let padding_bytes = (${alignTo} - (current_pos % ${alignTo})) % ${alignTo};`);
      lines.push(`${indent}    decoder.seek(current_pos + padding_bytes)?;`);
      lines.push(`${indent}}`);
      break;
    }

    case "choice": {
      // Inline choice type - generate the choice enum name from choices
      const choiceFieldAny = field as any;
      const choices = choiceFieldAny.choices || [];
      if (choices.length === 0) {
        throw new Error(`Inline choice field '${field.name}' has no choices`);
      }
      const choiceEnumName = inlineEnumName(containingTypeName, field.name || "");
      lines.push(`${indent}let ${varName} = ${choiceEnumName}::decode_with_decoder(decoder)?;`);
      break;
    }

    case "discriminated_union": {
      // Inline discriminated union - generate the union enum name from variants
      const fieldAny = field as any;
      const variants = fieldAny.variants || [];
      if (variants.length === 0) {
        throw new Error(`Inline discriminated union field '${field.name}' has no variants`);
      }
      const enumName = inlineEnumName(containingTypeName, field.name || "");
      const discriminator = fieldAny.discriminator || {};
      const byteBudget = fieldAny.byte_budget;

      // Check if any variant needs context
      const typesNeedingContext = getTypesNeedingDecodeContext(schema);
      const needsCtx = variants.some((v: any) => typesNeedingContext.has(v.type));

      // If byte_budget, create a sub-decoder from budget-sized slice
      const decoderVarForVariants = byteBudget ? "sub_decoder" : "decoder";
      if (byteBudget) {
        const budgetFieldName = toRustFieldName(byteBudget.field);
        lines.push(`${indent}// byte_budget: read exactly ${byteBudget.field} bytes for variant decoding`);
        lines.push(`${indent}let budget_slice = decoder.read_bytes_vec(${budgetFieldName} as usize)?;`);
        lines.push(`${indent}let mut sub_decoder = BitStreamDecoder::new(budget_slice, BitOrder::${mapBitOrder(fieldAny.bit_order || schema.config?.bit_order || "msb_first")});`);
      }

      if (discriminator.field) {
        // Field-based discriminator - generate inline if-else chain
        // Generates: let varName = if cond { Enum::Variant(decode...) } else { ... };
        const discriminatorFieldName = toRustFieldName(discriminator.field);
        const fallbackVariant = variants.find((v: any) => !v.when);
        const conditionalVariants = variants.filter((v: any) => v.when);

        // Helper to generate variant decode expression
        function rustVariantDecodeExpr(variant: any, vi: string): string[] {
          const vTypeName = toRustTypeName(variant.type);
          const vNeedsSuffix = typeNeedsInputOutputSuffix(variant.type, schema);
          const vDecodeTypeName = vNeedsSuffix ? `${vTypeName}Output` : vTypeName;
          const vNeedsCtx = typesNeedingContext.has(variant.type);

          if (needsCtx && vNeedsCtx) {
            // Need context for this variant
            const ctxLines: string[] = [];
            ctxLines.push(`${vi}let mut union_ctx: HashMap<String, u64> = HashMap::new();`);
            if (allFields) {
              for (const prevField of allFields) {
                if (prevField.name === field.name) break;
                if (!prevField.name) continue;
                const rustPrevFieldName = toRustFieldName(prevField.name);
                if (["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64"].includes(prevField.type as string)) {
                  ctxLines.push(`${vi}union_ctx.insert("${prevField.name}".to_string(), ${rustPrevFieldName} as u64);`);
                }
              }
            }
            const decoderArg = byteBudget ? `&mut ${decoderVarForVariants}` : decoderVarForVariants;
            ctxLines.push(`${vi}${enumName}::${vTypeName}(${vDecodeTypeName}::decode_with_decoder_and_context(${decoderArg}, Some(&union_ctx))?)`);
            return ctxLines;
          } else {
            const decoderArg = byteBudget ? `&mut ${decoderVarForVariants}` : decoderVarForVariants;
            return [`${vi}${enumName}::${vTypeName}(${vDecodeTypeName}::decode_with_decoder(${decoderArg})?)`];
          }
        }

        // Generate the if-else expression
        for (let i = 0; i < conditionalVariants.length; i++) {
          const variant = conditionalVariants[i];

          // Convert condition: replace 'value' with discriminator variable, fix JS operators
          let condition = variant.when.replace(/\bvalue\b/g, discriminatorFieldName);
          condition = condition.replace(/===/g, '==').replace(/!==/g, '!=');
          // Convert single-quoted strings to Rust string literals
          condition = condition.replace(/'([^']*)'/g, '"$1"');

          if (i === 0) {
            lines.push(`${indent}let ${varName} = if ${condition} {`);
          } else {
            lines.push(`${indent}} else if ${condition} {`);
          }
          lines.push(...rustVariantDecodeExpr(variant, indent + "    "));
        }

        // Handle fallback or error in the else branch
        if (fallbackVariant) {
          if (conditionalVariants.length > 0) {
            lines.push(`${indent}} else {`);
          } else {
            // Only fallback, no conditions - just decode directly
            lines.push(...rustVariantDecodeExpr(fallbackVariant, indent));
            // No closing brace needed
          }
          if (conditionalVariants.length > 0) {
            lines.push(...rustVariantDecodeExpr(fallbackVariant, indent + "    "));
            lines.push(`${indent}};`);
          }
        } else {
          if (conditionalVariants.length > 0) {
            lines.push(`${indent}} else {`);
            lines.push(`${indent}    return Err(binschema_runtime::BinSchemaError::NotImplemented(format!("unknown discriminator value: {:?}", ${discriminatorFieldName})));`);
            lines.push(`${indent}};`);
          }
        }
      } else if (needsCtx) {
        // Peek-based with context - delegate to enum
        lines.push(`${indent}// Build context for discriminated union variants`);
        lines.push(`${indent}let mut union_ctx: HashMap<String, u64> = HashMap::new();`);
        if (allFields) {
          for (const prevField of allFields) {
            if (prevField.name === field.name) break;
            if (!prevField.name) continue;
            const rustFieldName = toRustFieldName(prevField.name);
            if (["uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64"].includes(prevField.type as string)) {
              lines.push(`${indent}union_ctx.insert("${prevField.name}".to_string(), ${rustFieldName} as u64);`);
            }
          }
        }
        lines.push(`${indent}let ${varName} = ${enumName}::decode_with_decoder_and_context(decoder, Some(&union_ctx))?;`);
      } else {
        // Peek-based without context - delegate to enum
        lines.push(`${indent}let ${varName} = ${enumName}::decode_with_decoder(decoder)?;`);
      }
      break;
    }

    default:
      // Type reference - nested struct
      lines.push(...generateDecodeNestedStruct(field, varName, indent, schema));
      break;
  }

  // Add const field validation - if the decoded value doesn't match the expected const,
  // return an error. This is critical for choice decoder try-each-variant to work.
  const fieldAny2 = field as any;
  if (fieldAny2.const != null) {
    const constVal = fieldAny2.const;
    const expectedType = field.type as string;

    if (expectedType === "string") {
      // String const validation - compare decoded string to expected value
      const rustStrLiteral = JSON.stringify(constVal);
      lines.push(`${indent}if ${varName} != ${rustStrLiteral} {`);
      lines.push(`${indent}    return Err(binschema_runtime::BinSchemaError::NotImplemented(format!("const string mismatch: expected ${constVal}, got {}", ${varName})));`);
      lines.push(`${indent}}`);
    } else {
      // Generate appropriate literal suffix for the comparison
      let rustConstExpr: string;
      switch (expectedType) {
        case "uint8": rustConstExpr = `${constVal}u8`; break;
        case "uint16": rustConstExpr = `${constVal}u16`; break;
        case "uint32": rustConstExpr = `${constVal}u32`; break;
        case "uint64": rustConstExpr = `${constVal}u64`; break;
        case "int8": rustConstExpr = `${constVal}i8`; break;
        case "int16": rustConstExpr = `${constVal}i16`; break;
        case "int32": rustConstExpr = `${constVal}i32`; break;
        case "int64": rustConstExpr = `${constVal}i64`; break;
        default: rustConstExpr = `${constVal}`; break;
      }
      lines.push(`${indent}if ${varName} != ${rustConstExpr} {`);
      lines.push(`${indent}    return Err(binschema_runtime::BinSchemaError::InvalidVariant(${varName} as u64));`);
      lines.push(`${indent}}`);
    }
  }

  return lines;
}

/**
 * Generates decoding code for a field's inner value (used for conditional fields)
 * Uses a _inner suffix for the variable name to avoid conflicts
 */
function generateDecodeFieldInner(field: Field, defaultEndianness: string, indent: string, containingTypeName: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const varName = `${toRustFieldName(field.name)}_inner`;
  const endianness = (field as any).endianness || defaultEndianness;
  const rustEndianness = mapEndianness(endianness);

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
      const encoding = (field as any).encoding || "vlq";
      lines.push(`${indent}let ${varName} = decoder.read_varlength("${encoding}")?;`);
      break;
    }
    case "bitfield": {
      const subFields = (field as any).fields;
      if (subFields && Array.isArray(subFields) && subFields.length > 0 && containingTypeName) {
        const bitfieldStructName = `${containingTypeName}${toRustTypeName(field.name)}`;
        lines.push(`${indent}let ${varName} = ${bitfieldStructName}::decode(decoder)?;`);
      } else {
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
      // In conditional fields, we don't have context - these arrays should have local field refs
      lines.push(...generateDecodeArray(field as any, varName, endianness, rustEndianness, indent, schema, containingTypeName, false));
      break;
    case "optional":
      lines.push(...generateDecodeOptional(field as any, varName, endianness, indent, schema));
      break;
    case "padding": {
      const alignTo2 = (field as any).align_to || 4;
      lines.push(`${indent}// Skip alignment padding to ${alignTo2}-byte boundary`);
      lines.push(`${indent}{`);
      lines.push(`${indent}    let current_pos = decoder.position();`);
      lines.push(`${indent}    let padding_bytes = (${alignTo2} - (current_pos % ${alignTo2})) % ${alignTo2};`);
      lines.push(`${indent}    decoder.seek(current_pos + padding_bytes)?;`);
      lines.push(`${indent}}`);
      break;
    }
    case "back_reference":
      lines.push(...generateDecodeBackReference(field as any, varName, endianness, indent, schema));
      break;
    case "choice": {
      // Inline choice type - generate the choice enum name from choices
      const innerChoices = (field as any).choices || [];
      if (innerChoices.length === 0) {
        throw new Error(`Inline choice field '${field.name}' has no choices`);
      }
      const innerChoiceEnumName = inlineEnumName(containingTypeName, field.name || "");
      lines.push(`${indent}let ${varName} = ${innerChoiceEnumName}::decode_with_decoder(decoder)?;`);
      break;
    }
    case "discriminated_union": {
      // Inline discriminated union - generate the union enum name from variants
      const innerVariants = (field as any).variants || [];
      if (innerVariants.length === 0) {
        throw new Error(`Inline discriminated union field '${field.name}' has no variants`);
      }
      const innerEnumName = inlineEnumName(containingTypeName, field.name || "");
      lines.push(`${indent}let ${varName} = ${innerEnumName}::decode_with_decoder(decoder)?;`);
      break;
    }
    default: {
      // Type reference - nested struct
      const typeName = toRustTypeName(field.type);
      const typeDef = schema.types[field.type as string];
      const isComposite = typeDef && "sequence" in typeDef;
      const needsSplit = isComposite && typeNeedsInputOutputSplit(field.type, schema);
      const decodeName = needsSplit ? `${typeName}Output` : typeName;
      lines.push(`${indent}let ${varName} = ${decodeName}::decode_with_decoder(decoder)?;`);
      break;
    }
  }

  return lines;
}

/**
 * Generates encoding code for back_reference field
 * Back references encode the target value directly (compression dictionary support would need context)
 */
function generateEncodeBackReference(field: any, fieldName: string, indent: string): string[] {
  const lines: string[] = [];
  // For encoding, we just encode the target value directly
  // Full compression dictionary support would require more complex state tracking
  lines.push(`${indent}// Encode back_reference target value`);
  lines.push(`${indent}${fieldName}.encode_into(encoder)?;`);
  return lines;
}

/**
 * Generates decoding code for back_reference field
 * Back references point to previously decoded data and require seekable streams
 */
function generateDecodeBackReference(field: any, varName: string, endianness: string, indent: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const storage = field.storage || "uint16";
  const offsetMask = field.offset_mask || "0x3FFF";
  const offsetFrom = field.offset_from || "message_start";
  const targetType = field.target_type;
  const storageEndianness = field.endianness || endianness;
  const rustEndianness = mapEndianness(storageEndianness);

  // Get the Rust type name for the target type
  const targetRustTypeName = toRustTypeName(targetType);
  const targetTypeDef = schema.types[targetType];
  const targetIsComposite = targetTypeDef && "sequence" in targetTypeDef;
  const targetNeedsSplit = targetIsComposite && typeNeedsInputOutputSplit(targetType, schema);
  const targetDecodeName = targetNeedsSplit ? `${targetRustTypeName}Output` : targetRustTypeName;

  // Read the reference value
  lines.push(`${indent}// Read back_reference storage value (${storage})`);
  switch (storage) {
    case "uint8":
      lines.push(`${indent}let reference_value = decoder.read_uint8()?;`);
      break;
    case "uint16":
      lines.push(`${indent}let reference_value = decoder.read_uint16(Endianness::${rustEndianness})?;`);
      break;
    case "uint32":
      lines.push(`${indent}let reference_value = decoder.read_uint32(Endianness::${rustEndianness})?;`);
      break;
    default:
      lines.push(`${indent}let reference_value = decoder.read_uint16(Endianness::${rustEndianness})?;`);
  }

  lines.push(`${indent}let offset = (reference_value & ${offsetMask}) as usize;`);
  lines.push(``);
  lines.push(`${indent}// Save current position and seek to the referenced offset`);
  lines.push(`${indent}let saved_pos = decoder.position();`);

  if (offsetFrom === "current_position") {
    lines.push(`${indent}decoder.seek(saved_pos + offset)?;`);
  } else {
    // message_start
    lines.push(`${indent}decoder.seek(offset)?;`);
  }

  lines.push(``);
  lines.push(`${indent}// Decode the target type at the referenced position`);
  lines.push(`${indent}let ${varName} = ${targetDecodeName}::decode_with_decoder(decoder)?;`);
  lines.push(``);
  lines.push(`${indent}// Restore position`);
  lines.push(`${indent}decoder.seek(saved_pos)?;`);

  return lines;
}

/**
 * Generates decoding code for optional field
 */
function generateDecodeOptional(field: any, varName: string, endianness: string, indent: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const valueType = field.value_type;
  const presenceType = field.presence_type || "uint8";
  const rustEndianness = mapEndianness(endianness);

  if (presenceType === "bit") {
    lines.push(`${indent}let has_value = decoder.read_bits(1)? != 0;`);
  } else {
    lines.push(`${indent}let has_value = decoder.read_uint8()? != 0;`);
  }
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
      // Use Output suffix only for composite types that need the split
      const needsSplit = isComposite && typeNeedsInputOutputSplit(valueType, schema);
      const decodeName = needsSplit ? `${typeName}Output` : typeName;
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
 * Generates the Rust expression to convert a Vec<u8> of bytes into a String based on encoding.
 * UTF-8: String::from_utf8 (validates UTF-8)
 * Latin-1/ASCII: direct char mapping (each byte maps to its Unicode code point)
 */
function generateBytesToString(varName: string, bytesExpr: string, encoding: string, indent: string): string {
  if (encoding === "latin1" || encoding === "ascii") {
    // Latin-1/ASCII: each byte maps directly to a Unicode code point (0x00-0xFF -> U+0000-U+00FF)
    // Use fully qualified std::string::String to avoid prefix_type_names rewriting
    return `${indent}let ${varName}: std::string::String = ${bytesExpr}.iter().map(|&b| b as char).collect();`;
  }
  // UTF-8: use standard conversion with validation
  return `${indent}let ${varName} = std::string::String::from_utf8(${bytesExpr}).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;`;
}

/**
 * Generates decoding code for string field
 */
function generateDecodeString(field: any, varName: string, endianness: string, indent: string): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const rustEndianness = mapEndianness(endianness);
  const encoding = field.encoding || "utf8";

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
      // Read bytes (bulk read)
      lines.push(`${indent}let bytes = decoder.read_bytes_vec(length)?;`);
      lines.push(generateBytesToString(varName, "bytes", encoding, indent));
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
      lines.push(generateBytesToString(varName, "bytes", encoding, indent));
      break;

    case "fixed": {
      const length = field.length || 0;
      // Bulk read, then filter null bytes
      lines.push(`${indent}let raw_bytes = decoder.read_bytes_vec(${length})?;`);
      lines.push(`${indent}let bytes: Vec<u8> = raw_bytes.into_iter().filter(|&b| b != 0).collect();`);
      lines.push(generateBytesToString(varName, "bytes", encoding, indent));
      break;
    }

    case "field_referenced": {
      // Length is determined by another field that was already decoded
      const lengthField = field.length_field;
      const lengthFieldRust = toRustFieldName(lengthField);
      lines.push(`${indent}let bytes = decoder.read_bytes_vec(${lengthFieldRust} as usize)?;`);
      lines.push(generateBytesToString(varName, "bytes", encoding, indent));
      break;
    }

    default:
      throw new Error(`Unknown string kind: ${kind}`);
  }

  return lines;
}

/**
 * Generates decoding code for array field
 * @param containingTypeName - The name of the type containing this field (for context checking)
 * @param hasContext - Whether the decode function has access to a context parameter
 */
function generateDecodeArray(field: any, varName: string, endianness: string, rustEndianness: string, indent: string, schema: BinarySchema, containingTypeName?: string, hasContext?: boolean): string[] {
  const lines: string[] = [];
  const kind = field.kind;
  const items = field.items;

  if (!items) {
    throw new Error(`Array field ${field.name} missing items definition`);
  }

  // Add array field's name to items so inline enum names resolve correctly
  const itemsWithName = { ...items, name: field.name };
  const itemType = mapFieldToRustType(itemsWithName, schema, containingTypeName);

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

    // Check if the length field is local to the current type
    let fieldIsLocal = true;
    if (containingTypeName && schema) {
      const localFields = getTypeFieldNames(containingTypeName, schema);
      const firstPart = lengthField.split('.')[0];
      fieldIsLocal = localFields.has(firstPart);
    }

    if (fieldIsLocal) {
      // Field is local - access directly
      lines.push(`${indent}let mut ${varName} = Vec::with_capacity(${lengthFieldRust} as usize);`);
      lines.push(`${indent}for _ in 0..${lengthFieldRust} {`);
    } else {
      // Field is in parent context - look it up from ctx
      lines.push(`${indent}// Length field "${lengthField}" is from parent context`);
      lines.push(`${indent}let ${varName}_length = ctx`);
      lines.push(`${indent}    .and_then(|c| c.get("${lengthField}"))`);
      lines.push(`${indent}    .copied()`);
      lines.push(`${indent}    .ok_or_else(|| binschema_runtime::BinSchemaError::ContextMissing("${lengthField}".to_string()))? as usize;`);
      lines.push(`${indent}let mut ${varName} = Vec::with_capacity(${varName}_length);`);
      lines.push(`${indent}for _ in 0..${varName}_length {`);
    }
  } else if (kind === "fixed") {
    const length = field.length || 0;
    lines.push(`${indent}let mut ${varName} = Vec::with_capacity(${length});`);
    lines.push(`${indent}for _ in 0..${length} {`);
  } else if (kind === "null_terminated") {
    // For null-terminated arrays, we need to check for null terminator BEFORE pushing
    const itemType2 = items.type;

    if (itemType2 === "uint8") {
      // Optimized path for byte arrays (like c_string)
      // Read byte, check if 0, break if so, push if not
      lines.push(`${indent}let mut ${varName}: Vec<u8> = Vec::new();`);
      lines.push(`${indent}loop {`);
      lines.push(`${indent}    let byte = decoder.read_uint8()?;`);
      lines.push(`${indent}    if byte == 0 { break; }`);
      lines.push(`${indent}    ${varName}.push(byte);`);
      lines.push(`${indent}}`);
      return lines; // Complete - don't go through the generic item decode path
    }

    // For other item types, peek at first byte to check for null terminator before decoding
    lines.push(`${indent}let mut ${varName}: Vec<${itemType}> = Vec::new();`);
    lines.push(`${indent}loop {`);
    lines.push(`${indent}    // Check for null terminator before decoding item`);
    lines.push(`${indent}    if decoder.peek_uint8()? == 0 {`);
    lines.push(`${indent}        decoder.read_uint8()?; // Consume the null byte`);
    lines.push(`${indent}        break;`);
    lines.push(`${indent}    }`);
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
    // Wrap the whole expression in parentheses before casting to usize,
    // otherwise `as usize` only applies to the last operand
    lines.push(`${indent}let count = (${countExpr}) as usize;`);
    lines.push(`${indent}let mut ${varName} = Vec::with_capacity(count);`);
    lines.push(`${indent}for _ in 0..count {`);
  } else if (kind === "signature_terminated") {
    // Read until a specific signature value is encountered by peeking ahead
    const terminatorValue = field.terminator_value;
    const terminatorType = field.terminator_type || "uint32";
    const terminatorEndianness = field.terminator_endianness || endianness;
    const terminatorRustEndianness = mapEndianness(terminatorEndianness);

    if (terminatorValue === undefined || terminatorValue === null) {
      throw new Error(`signature_terminated array '${field.name}' requires terminator_value`);
    }

    lines.push(`${indent}let mut ${varName}: Vec<${itemType}> = Vec::new();`);
    lines.push(`${indent}loop {`);

    // Format the terminator value with proper Rust type suffix
    let rustTermValue: string;
    switch (terminatorType) {
      case "uint8":
        rustTermValue = `${terminatorValue}u8`;
        lines.push(`${indent}    if decoder.peek_uint8()? == ${rustTermValue} { break; }`);
        break;
      case "uint16":
        rustTermValue = `${terminatorValue}u16`;
        lines.push(`${indent}    if decoder.peek_uint16(Endianness::${terminatorRustEndianness})? == ${rustTermValue} { break; }`);
        break;
      case "uint32":
        rustTermValue = `${terminatorValue}u32`;
        lines.push(`${indent}    if decoder.peek_uint32(Endianness::${terminatorRustEndianness})? == ${rustTermValue} { break; }`);
        break;
      default:
        throw new Error(`Unsupported terminator type: ${terminatorType}`);
    }
  } else if (kind === "variant_terminated") {
    // Read until a specific variant is encountered
    lines.push(`${indent}let mut ${varName}: Vec<${itemType}> = Vec::new();`);
    lines.push(`${indent}loop {`);
    // The termination check will happen after decoding the item
  } else if (kind === "eof_terminated") {
    // Read items until end of stream
    lines.push(`${indent}let mut ${varName}: Vec<${itemType}> = Vec::new();`);
    lines.push(`${indent}while decoder.position() < decoder.bytes_len() {`);
  } else {
    throw new Error(`Unknown array kind: ${kind}`);
  }

  // For length_prefixed_items, read item length prefix before decoding each item
  if (kind === "length_prefixed_items" && field.item_length_type) {
    const itemLengthType = field.item_length_type;
    switch (itemLengthType) {
      case "uint8":
        lines.push(`${indent}    let _item_length = decoder.read_uint8()? as usize;`);
        break;
      case "uint16":
        lines.push(`${indent}    let _item_length = decoder.read_uint16(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint32":
        lines.push(`${indent}    let _item_length = decoder.read_uint32(Endianness::${rustEndianness})? as usize;`);
        break;
      case "uint64":
        lines.push(`${indent}    let _item_length = decoder.read_uint64(Endianness::${rustEndianness})? as usize;`);
        break;
    }
  }

  // Decode item
  const itemLines = generateDecodeArrayItem(items, endianness, rustEndianness, `${indent}    `, schema, containingTypeName, field.name);
  lines.push(...itemLines);
  lines.push(`${indent}    ${varName}.push(item);`);

  // For variant_terminated arrays, check if the decoded item is a terminal variant and break
  if (kind === "variant_terminated" && field.terminal_variants && Array.isArray(field.terminal_variants)) {
    const terminalVariants = field.terminal_variants as string[];
    const itemTypeName = items.type;
    // The item type should be a discriminated union - get its prefixed enum name
    // We need to match on the last pushed item
    const lastItem = `${varName}[${varName}.len() - 1]`;
    lines.push(`${indent}    // Check if item is a terminal variant`);
    lines.push(`${indent}    match &${lastItem} {`);
    for (const tv of terminalVariants) {
      const rustVariantName = toRustTypeName(tv);
      lines.push(`${indent}        ${itemTypeName}::${rustVariantName}(_) => break,`);
    }
    lines.push(`${indent}        _ => {}`);
    lines.push(`${indent}    }`);
  }

  // For null_terminated arrays with terminal_variants, also check if the decoded item is a terminal
  // variant and break (the null byte check at the start of the loop handles the normal case, but
  // terminal variants like LabelPointer end the array without a null byte)
  if (kind === "null_terminated" && field.terminal_variants && Array.isArray(field.terminal_variants)) {
    const terminalVariants = field.terminal_variants as string[];
    const itemTypeName = items.type;
    const lastItem = `${varName}[${varName}.len() - 1]`;
    lines.push(`${indent}    // Check if item is a terminal variant (ends array without null byte)`);
    lines.push(`${indent}    match &${lastItem} {`);
    for (const tv of terminalVariants) {
      const rustVariantName = toRustTypeName(tv);
      lines.push(`${indent}        ${itemTypeName}::${rustVariantName}(_) => break,`);
    }
    lines.push(`${indent}        _ => {}`);
    lines.push(`${indent}    }`);
  }

  lines.push(`${indent}}`);

  return lines;
}

/**
 * Generates decoding code for a single array item
 */
function generateDecodeArrayItem(items: any, endianness: string, rustEndianness: string, indent: string, schema: BinarySchema, containingTypeName?: string, arrayFieldName?: string): string[] {
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
      const enumName = inlineEnumName(containingTypeName || "", arrayFieldName || "");
      lines.push(`${indent}let item = ${enumName}::decode_with_decoder(decoder)?;`);
      break;
    }
    case "discriminated_union": {
      // Discriminated union - use generated enum name
      const enumName = inlineEnumName(containingTypeName || "", arrayFieldName || "");
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
          lines.push(`${indent}let str_bytes = decoder.read_bytes_vec(str_len)?;`);
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
          lines.push(`${indent}let raw_bytes = decoder.read_bytes_vec(${length})?;`);
          lines.push(`${indent}let str_bytes: Vec<u8> = raw_bytes.into_iter().filter(|&b| b != 0).collect();`);
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
      const innerLines = generateDecodeArrayItem(innerItems, endianness, rustEndianness, `${indent}    `, schema, containingTypeName, arrayFieldName);
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
      // Use Output suffix only for composite types that need the split
      const needsSplit = isComposite && typeNeedsInputOutputSplit(items.type, schema);
      const decodeName = needsSplit ? `${typeName}Output` : typeName;
      lines.push(`${indent}let item = ${decodeName}::decode_with_decoder(decoder)?;`);
      break;
  }

  return lines;
}

/**
 * Generates decoding code for nested struct
 * Uses Output suffix only for composite types that need the Input/Output split
 */
function generateDecodeNestedStruct(field: Field, varName: string, indent: string, schema: BinarySchema): string[] {
  const lines: string[] = [];
  const typeName = toRustTypeName(field.type);

  // Check if the referenced type is composite (has sequence) or a type alias
  const typeDef = schema.types[field.type];
  const isComposite = typeDef && "sequence" in typeDef;

  // Use Output suffix only for composite types that need the split
  const needsSplit = isComposite && typeNeedsInputOutputSplit(field.type, schema);
  const decodeName = needsSplit ? `${typeName}Output` : typeName;
  lines.push(`${indent}let ${varName} = ${decodeName}::decode_with_decoder(decoder)?;`);

  return lines;
}

/**
 * Maps a field to its Rust type for Input structs
 * Composite types get Input suffix, type aliases stay as-is
 */
function mapFieldToRustTypeForInput(field: Field, schema: BinarySchema, containingTypeName?: string): string {
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
      if (!items) {
        throw new Error(`Array field ${field.name || 'unknown'} missing items definition`);
      }
      // Give items the array field's name so choice/union items get the right enum name
      const itemsWithName = { ...items, name: field.name };
      const itemsType = mapFieldToRustTypeForInput(itemsWithName, schema, containingTypeName);
      return `Vec<${itemsType}>`;
    }
    case "choice": {
      // Choice type - enum name from parent type + field name
      const choices = (field as any).choices || [];
      if (choices.length === 0) {
        throw new Error(`Choice field has no choices`);
      }
      return inlineEnumName(containingTypeName || "", field.name || "");
    }
    case "discriminated_union": {
      // Discriminated union - enum name from parent type + field name
      const variants = (field as any).variants || [];
      if (variants.length === 0) {
        throw new Error(`Discriminated union field has no variants`);
      }
      return inlineEnumName(containingTypeName || "", field.name || "");
    }
    case "optional": {
      const valueTypeName = (field as any).value_type;
      if (!valueTypeName) {
        throw new Error(`Optional field ${field.name} missing value_type`);
      }
      // Check if the value type is composite (including through type aliases)
      const optIsComposite = isCompositeType(valueTypeName, schema);
      const rustTypeName = toRustTypeName(valueTypeName);
      // Only use Input suffix if the type actually needs the Input/Output split
      const optNeedsSplit = optIsComposite && typeNeedsInputOutputSplit(valueTypeName, schema);
      const valueType = optNeedsSplit ? `${rustTypeName}Input` : (optIsComposite ? rustTypeName : mapPrimitiveToRustType(valueTypeName));
      return `Option<${valueType}>`;
    }
    case "back_reference": {
      // Back reference - use the target type (with Input suffix only if it needs the split)
      const targetType = (field as any).target_type;
      if (!targetType) {
        throw new Error(`back_reference field ${field.name} missing target_type`);
      }
      const typeName = toRustTypeName(targetType);
      const backRefIsComposite = isCompositeType(targetType, schema);
      const backRefNeedsSplit = backRefIsComposite && typeNeedsInputOutputSplit(targetType, schema);
      return backRefNeedsSplit ? `${typeName}Input` : typeName;
    }
    default: {
      // Type reference - check if composite or type alias
      const typeName = toRustTypeName(field.type);

      // Check if this type is composite (has sequence) or is a type alias to a composite type
      const isComposite = isCompositeType(field.type, schema);

      // Only use Input suffix if the type needs the Input/Output split
      const needsSplit = isComposite && typeNeedsInputOutputSplit(field.type, schema);
      return needsSplit ? `${typeName}Input` : typeName;
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
 * Gets the Rust type for an instance field.
 * Instance fields can be simple type references or inline discriminated unions.
 */
function getInstanceFieldRustType(instance: any, schema: BinarySchema): string {
  const instanceType = instance.type;

  // Inline discriminated unions are skipped (caller should check for typeof === "object" first)
  if (typeof instanceType === "object") {
    return "()"; // Should not be reached
  }

  // Named type reference
  const rustName = toRustTypeName(instanceType);
  const typeDef = schema.types[instanceType];
  if (!typeDef) {
    // Unknown type - assume it needs Output suffix for safety
    return `${rustName}Output`;
  }

  if ("sequence" in typeDef) {
    const needsSplit = typeNeedsInputOutputSplit(instanceType, schema);
    return needsSplit ? `${rustName}Output` : rustName;
  } else if ("variants" in typeDef) {
    // Discriminated union - these are enums
    return rustName;
  } else if ("type" in typeDef) {
    // Type alias
    return rustName;
  }

  return rustName;
}

/**
 * Maps a field to its Rust type
 * The schema parameter is optional - when provided, composite types get Output suffix
 */
function mapFieldToRustType(field: Field, schema?: BinarySchema, containingTypeName?: string): string {
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
      // Give items the array field's name so choice/union items get the right enum name
      const itemsWithName = { ...items, name: field.name };
      const itemsType = mapFieldToRustType(itemsWithName, schema, containingTypeName);
      return `Vec<${itemsType}>`;
    }
    case "choice": {
      // Choice type - enum name from parent type + field name
      const choices = (field as any).choices || [];
      if (choices.length === 0) {
        throw new Error(`Choice field has no choices`);
      }
      return inlineEnumName(containingTypeName || "", field.name || "");
    }
    case "discriminated_union": {
      // Discriminated union - enum name from parent type + field name
      const variants = (field as any).variants || [];
      if (variants.length === 0) {
        throw new Error(`Discriminated union field has no variants`);
      }
      return inlineEnumName(containingTypeName || "", field.name || "");
    }
    case "optional": {
      const valueTypeName = (field as any).value_type;
      if (!valueTypeName) {
        throw new Error(`Optional field ${field.name} missing value_type`);
      }
      const valueType = mapPrimitiveToRustType(valueTypeName);
      return `Option<${valueType}>`;
    }
    case "back_reference": {
      // Back reference - use the target type (with Output suffix only if it needs the split)
      const targetType = (field as any).target_type;
      if (!targetType) {
        throw new Error(`back_reference field ${field.name} missing target_type`);
      }
      const typeName = toRustTypeName(targetType);
      if (schema) {
        const typeDef = schema.types[targetType];
        const isComposite = typeDef && "sequence" in typeDef;
        const needsSplit = isComposite && typeNeedsInputOutputSplit(targetType, schema);
        return needsSplit ? `${typeName}Output` : typeName;
      }
      return typeName;
    }
    default: {
      // Assume it's a type reference (nested struct or type alias)
      const typeName = toRustTypeName(field.type);
      // If schema is provided, check if the type is composite
      if (schema) {
        const typeDef = schema.types[field.type];
        const isComposite = typeDef && "sequence" in typeDef;
        // Use Output suffix only for composite types that need the Input/Output split
        const needsSplit = isComposite && typeNeedsInputOutputSplit(field.type, schema);
        return needsSplit ? `${typeName}Output` : typeName;
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
