import { BinarySchema, TypeDef, Field } from "../../schema/binary-schema.js";
import { getTypeFields, sanitizeTypeName } from "./type-utils.js";
import { getFieldDocumentation, generateJSDoc } from "./documentation.js";

/**
 * Check if field is conditional
 */
function isFieldConditional(field: Field): boolean {
  return 'conditional' in field && field.conditional !== undefined;
}

/**
 * Check if instance type is an inline discriminated union
 */
function isInlineDiscriminatedUnion(instanceType: any): instanceType is { discriminator: any; variants: any[] } {
  return typeof instanceType === 'object' && instanceType !== null && 'discriminator' in instanceType && 'variants' in instanceType;
}

/**
 * Generate TypeScript union type for inline discriminated union in instances
 * Produces wrapped format: { type: 'TypeA'; value: TypeAOutput } | { type: 'TypeB'; value: TypeBOutput }
 */
function generateInlineDiscriminatedUnionType(unionDef: { discriminator: any; variants: any[] }, schema: BinarySchema, useInputTypes: boolean): string {
  const variants: string[] = [];
  for (const variant of unionDef.variants) {
    const suffix = useInputTypes ? "Input" : "Output";
    const variantType = schema.types[variant.type] ? `${variant.type}${suffix}` : variant.type;
    variants.push(`{ type: '${variant.type}'; value: ${variantType} }`);
  }
  return variants.join(" | ");
}

/**
 * Interface Generation Module
 *
 * Generates TypeScript interfaces for binary schema types.
 * Creates separate Input and Output interfaces to accurately reflect the encoder/decoder contract:
 *
 * - Input interfaces: Used by encoders, omit const and computed fields
 * - Output interfaces: Returned by decoders, include all fields
 */

/**
 * Determines if a field should be included in the Input interface (for encoding)
 */
function isInputField(field: Field): boolean {
  const fieldAny = field as any;

  // Exclude computed fields - they are calculated during encoding
  if (fieldAny.computed) {
    return false;
  }

  // Exclude const fields - they use schema-defined values
  if (fieldAny.const !== undefined) {
    return false;
  }

  return true;
}

/**
 * Determines if a field should be included in the Output interface (from decoding)
 */
function isOutputField(field: Field): boolean {
  // Output includes ALL fields (const, computed, and regular)
  return true;
}

/**
 * Get TypeScript type for a field, with option to use Input or Output variant
 */
export function getFieldTypeScriptType(
  field: Field,
  schema: BinarySchema,
  useInputTypes: boolean = false
): string {
  // Safety check
  if (!field || typeof field !== 'object') {
    return "any";
  }

  if ('type' in field) {
    switch (field.type) {
      case "bit":
      case "uint8":
      case "uint16":
      case "uint32":
      case "int8":
      case "int16":
      case "int32":
      case "varlength":
      case "float32":
      case "float64":
        return "number";
      case "uint64":
      case "int64":
        return "bigint";
      case "array":
        const itemType = getFieldTypeScriptType(field.items as Field, schema, useInputTypes);
        return `${itemType}[]`;
      case "string":
        return "string";
      case "bitfield":
        // Bitfield is an object with named fields
        return `{ ${field.fields!.map((f: any) => `${f.name}: number`).join(", ")} }`;
      case "discriminated_union":
        // Generate union type from variants
        return generateDiscriminatedUnionType(field, schema, useInputTypes);
      case "back_reference":
        // Pointer is transparent - just the target type
        return resolveTypeReference((field as any).target_type, schema, useInputTypes);
      case "optional":
        // Optional field - generate T | undefined
        const valueType = resolveTypeReference((field as any).value_type, schema, useInputTypes);
        return `${valueType} | undefined`;
      default:
        // Type reference (e.g., "Point", "Optional<uint64>")
        return resolveTypeReference(field.type, schema, useInputTypes);
    }
  }
  return "any";
}

/**
 * Resolve type reference (handles generics like Optional<T>)
 */
function resolveTypeReference(typeRef: string | undefined, schema: BinarySchema, useInputTypes: boolean): string {
  // Handle undefined/null type references
  if (!typeRef) {
    throw new Error("resolveTypeReference called with undefined typeRef");
  }
  // Check for generic syntax: Optional<T>
  const genericMatch = typeRef.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, genericType, typeArg] = genericMatch;
    const templateDef = schema.types[`${genericType}<T>`] as TypeDef | undefined;

    if (templateDef) {
      // For generic types, expand inline
      const templateFields = getTypeFields(templateDef);
      // Generate inline interface structure
      const fields: string[] = [];
      for (const field of templateFields) {
        // Get the TypeScript type for the field, replacing T with typeArg
        let fieldType: string;
        if ('type' in field && field.type === 'T') {
          fieldType = resolveTypeReference(typeArg, schema, useInputTypes);
        } else {
          fieldType = getFieldTypeScriptType(field, schema, useInputTypes);
        }
        const optional = isFieldConditional(field) ? "?" : "";
        fields.push(`${field.name}${optional}: ${fieldType}`);
      }
      return `{ ${fields.join(", ")} }`;
    }
  }

  // Regular type reference - append Input/Output suffix if it's a custom type
  if (schema.types[typeRef]) {
    const suffix = useInputTypes ? "Input" : "Output";
    return `${typeRef}${suffix}`;
  }

  // Unknown type - return as-is
  return typeRef;
}

/**
 * Generate discriminated union type
 */
function generateDiscriminatedUnionType(field: any, schema: BinarySchema, useInputTypes: boolean): string {
  if (!field.variants || !Array.isArray(field.variants)) {
    return "any";
  }

  const variantTypes: string[] = [];
  for (const variant of field.variants) {
    if (variant.type) {
      const resolvedType = resolveTypeReference(variant.type, schema, useInputTypes);
      variantTypes.push(resolvedType);
    }
  }

  return variantTypes.length > 0 ? variantTypes.join(" | ") : "any";
}

/**
 * Generate TypeScript Input interface for a composite type
 * This is used by encoders - omits const and computed fields
 */
export function generateInputInterface(typeName: string, typeDef: TypeDef, schema: BinarySchema): string {
  const fields = getTypeFields(typeDef);
  const typeDefAny = typeDef as any;

  // Add JSDoc for the interface itself
  let code = generateJSDoc(typeDefAny.description);
  code += `export interface ${typeName}Input {\n`;

  // Add sequence fields (only fields that can be provided as input)
  for (const field of fields) {
    // Skip fields that shouldn't be in input
    if (!isInputField(field)) {
      continue;
    }

    const fieldType = getFieldTypeScriptType(field, schema, true);
    const optional = isFieldConditional(field) ? "?" : "";

    // Add JSDoc for each field
    const fieldDocString = generateJSDoc(getFieldDocumentation(field, schema), "  ");
    if (fieldDocString) {
      code += fieldDocString;
    }
    code += `  ${field.name}${optional}: ${fieldType};\n`;
  }

  // Note: instances are not included in input - they're position-based and only in output

  code += `}`;
  return code;
}

/**
 * Generate TypeScript Output interface for a composite type
 * This is returned by decoders - includes all fields (const, computed, regular)
 */
export function generateOutputInterface(typeName: string, typeDef: TypeDef, schema: BinarySchema): string {
  const fields = getTypeFields(typeDef);
  const typeDefAny = typeDef as any;

  // Add JSDoc for the interface itself
  let code = generateJSDoc(typeDefAny.description);
  code += `export interface ${typeName}Output {\n`;

  // Add ALL sequence fields (including const and computed)
  for (const field of fields) {
    // Include all fields in output
    if (!isOutputField(field)) {
      continue;
    }

    const fieldType = getFieldTypeScriptType(field, schema, false);
    const optional = isFieldConditional(field) ? "?" : "";

    // Add JSDoc for each field
    const fieldDocString = generateJSDoc(getFieldDocumentation(field, schema), "  ");
    if (fieldDocString) {
      code += fieldDocString;
    }
    code += `  ${field.name}${optional}: ${fieldType};\n`;
  }

  // Add instance fields (position-based lazy fields)
  if (typeDefAny.instances && Array.isArray(typeDefAny.instances)) {
    for (const instance of typeDefAny.instances) {
      // Handle inline discriminated unions vs simple type references
      const instanceType = isInlineDiscriminatedUnion(instance.type)
        ? generateInlineDiscriminatedUnionType(instance.type, schema, false)
        : resolveTypeReference(instance.type, schema, false);

      // Add JSDoc for instance field
      const instanceDoc: any = {
        summary: instance.description || `Position-based field at ${typeof instance.position === 'number' ? instance.position : instance.position}`
      };
      const instanceDocString = generateJSDoc(instanceDoc, "  ");
      if (instanceDocString) {
        code += instanceDocString;
      }
      code += `  readonly ${instance.name}: ${instanceType};\n`;
    }
  }

  code += `}`;
  return code;
}

/**
 * Generate both Input and Output interfaces for a type
 * Also exports a backward-compatible type alias
 */
export function generateInterfaces(typeName: string, typeDef: TypeDef, schema: BinarySchema): string {
  const inputInterface = generateInputInterface(typeName, typeDef, schema);
  const outputInterface = generateOutputInterface(typeName, typeDef, schema);

  // Add backward compatibility - Output is the "main" interface
  const typeAlias = `export type ${typeName} = ${typeName}Output;`;

  return `${inputInterface}\n\n${outputInterface}\n\n${typeAlias}`;
}
