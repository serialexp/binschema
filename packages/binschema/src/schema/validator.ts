/**
 * Schema Validator
 *
 * Validates that a BinarySchema is internally consistent before code generation.
 * Catches errors like:
 * - Type references to non-existent types
 * - Missing array items
 * - Invalid generic instantiations
 * - Circular type dependencies
 */

import { BinarySchema, Field, TypeDef } from "./binary-schema.js";
import { ARRAY_ITER_SUFFIX } from "../generators/typescript/shared.js";

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Built-in types that don't need to be defined in schema.types
 */
const BUILT_IN_TYPES = [
  "bit", "int", "uint8", "uint16", "uint32", "uint64",
  "int8", "int16", "int32", "int64", "varlength", "float32", "float64",
  "string", "array", "optional", "bitfield", "discriminated_union", "back_reference", "choice",
  "padding"
];

/**
 * Reserved patterns that cannot appear in user-defined field names
 * These are used internally by code generators
 */
const RESERVED_FIELD_PATTERNS = [
  ARRAY_ITER_SUFFIX  // Used by TypeScript generator for array iterator variables
];

/**
 * Check if a type is a composite (has sequence/fields) or a type alias
 */
function isTypeAlias(typeDef: TypeDef): boolean {
  return !('sequence' in typeDef);
}

/** Get fields from a type definition */
function getTypeFields(typeDef: TypeDef): Field[] {
  if ('sequence' in typeDef && (typeDef as any).sequence) {
    return (typeDef as any).sequence;
  }
  return [];
}

/**
 * Get available fields for field references in a type
 *
 * For protocol schemas: If the type is a message payload type, includes header fields
 * For binary schemas: Only includes parent fields
 *
 * @param typeName - Name of the type being validated
 * @param parentFields - Fields from the current type
 * @param schema - The schema being validated
 * @returns Array of fields that can be referenced by field_referenced arrays and discriminated unions
 */
function getAvailableFieldsForReference(
  typeName: string,
  parentFields: Field[],
  schema: BinarySchema
): Field[] {
  // If no protocol, return only parent fields
  if (!schema.protocol) {
    return parentFields;
  }

  // Check if this type is used as a message payload type
  const isPayloadType = schema.protocol.messages.some(msg => msg.payload_type === typeName);
  if (!isPayloadType) {
    return parentFields;
  }

  // Get header fields
  const headerType = schema.types[schema.protocol.header];
  if (!headerType) {
    return parentFields; // Header type not found (will be caught by other validation)
  }

  const headerFields = getTypeFields(headerType);

  // Return header fields + parent fields (header fields come first, so they're "earlier")
  return [...headerFields, ...parentFields];
}

/**
 * Validate a binary schema for consistency
 */
export function validateSchema(schema: BinarySchema): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate each type definition
  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    validateTypeDef(typeName, typeDef, schema, errors);
  }

  // Check for circular dependencies
  for (const typeName of Object.keys(schema.types)) {
    const cycle = findCircularDependency(typeName, schema, new Set());
    if (cycle) {
      errors.push({
        path: `types.${typeName}`,
        message: `Circular dependency detected: ${cycle.join(" → ")}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single type definition
 */
function validateTypeDef(
  typeName: string,
  typeDef: TypeDef,
  schema: BinarySchema,
  errors: ValidationError[]
): void {
  // Check if this is a discriminated union or pointer type alias
  if (isTypeAlias(typeDef)) {
    const typeDefAny = typeDef as any;

    // Validate discriminated union type aliases
    if (typeDefAny.type === "discriminated_union") {
      validateDiscriminatedUnion(typeDefAny, `types.${typeName}`, schema, errors);
      return;
    }

    // Validate back_reference type aliases
    if (typeDefAny.type === "back_reference") {
      validateBackReference(typeDefAny, `types.${typeName}`, schema, errors);
      return;
    }

    // Other type aliases (primitives, arrays) don't need validation
    return;
  }

  const fields = getTypeFields(typeDef);
  const fieldsKey = 'sequence';

  // Check for duplicate field names and reserved patterns (sequence)
  const fieldNames = new Set<string>();
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if ('name' in field && field.name) {
      // Check for reserved patterns
      for (const reservedPattern of RESERVED_FIELD_PATTERNS) {
        if (field.name.includes(reservedPattern)) {
          errors.push({
            path: `types.${typeName}.${fieldsKey}[${i}]`,
            message: `Field name '${field.name}' contains reserved pattern '${reservedPattern}' (reserved for internal use by code generators)`
          });
        }
      }

      // Check for const + computed mutual exclusivity
      const fieldAny = field as any;
      if (fieldAny.const !== undefined && fieldAny.computed !== undefined) {
        errors.push({
          path: `types.${typeName}.${fieldsKey}[${i}]`,
          message: `Field '${field.name}' cannot have both 'const' and 'computed' properties (they are mutually exclusive)`
        });
      }

      // Check for duplicates
      if (fieldNames.has(field.name)) {
        errors.push({
          path: `types.${typeName}.${fieldsKey}[${i}]`,
          message: `Duplicate field name '${field.name}' in type '${typeName}' (field names must be unique within a struct)`
        });
      }
      fieldNames.add(field.name);
    }
  }

  // Validate each sequence field
  // Pass typeName as rootTypeName so nested types can use _root references
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    validateField(field, `types.${typeName}.${fieldsKey}[${i}]`, schema, errors, typeName, fields, typeName);
  }

  // NOTE: Computed fields CAN be referenced by length_field - that's their purpose!
  // The encoder will automatically calculate the computed field values.
  // Computed fields are designed to work with field_referenced arrays/strings
  // where the length is automatically calculated during encoding.

  // Validate instances (position fields)
  const typeDefAny = typeDef as any;
  if (typeDefAny.instances && Array.isArray(typeDefAny.instances)) {
    for (let i = 0; i < typeDefAny.instances.length; i++) {
      const instance = typeDefAny.instances[i];

      if (instance.name) {
        // Check for reserved patterns
        for (const reservedPattern of RESERVED_FIELD_PATTERNS) {
          if (instance.name.includes(reservedPattern)) {
            errors.push({
              path: `types.${typeName}.instances[${i}]`,
              message: `Instance field name '${instance.name}' contains reserved pattern '${reservedPattern}' (reserved for internal use by code generators)`
            });
          }
        }

        // Check for duplicate instance names (with sequence fields)
        if (fieldNames.has(instance.name)) {
          errors.push({
            path: `types.${typeName}.instances[${i}]`,
            message: `Duplicate field name '${instance.name}' conflicts with sequence field (field names must be unique)`
          });
        }
        fieldNames.add(instance.name);
      }

      validatePositionField(instance, `types.${typeName}.instances[${i}]`, schema, errors, typeName, fields, typeDefAny.instances);
    }
  }
}

/**
 * Check if a field type is numeric
 */
function isNumericType(fieldType: string): boolean {
  const numericTypes = [
    "uint8", "uint16", "uint32", "uint64",
    "int8", "int16", "int32", "int64",
    "bit"  // bit fields can also be used as positions
  ];
  return numericTypes.includes(fieldType);
}

/**
 * Check if a field type is an unsigned integer or varlength (for length_of computed fields)
 */
function isUnsignedIntType(fieldType: string): boolean {
  const unsignedTypes = ["uint8", "uint16", "uint32", "uint64", "varlength"];
  return unsignedTypes.includes(fieldType);
}

/**
 * Validate a computed field
 */
function validateComputedField(
  field: any,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[],
  typeName: string,
  parentFields: Field[]
): void {
  const computed = field.computed;

  // Validate that field type is compatible with computation type
  if (computed.type === "length_of") {
    // length_of requires unsigned integer or varlength type
    if (!isUnsignedIntType(field.type)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'length_of' must have unsigned integer or varlength type (uint8, uint16, uint32, uint64, varlength), got '${field.type}'`
      });
    }
  } else if (computed.type === "crc32_of") {
    // crc32_of requires uint32 type
    if (field.type !== "uint32") {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'crc32_of' must have type 'uint32', got '${field.type}'`
      });
    }
  } else if (computed.type === "position_of") {
    // position_of requires unsigned integer type (to hold byte positions)
    if (!isUnsignedIntType(field.type)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'position_of' must have unsigned integer type (uint8, uint16, uint32, uint64), got '${field.type}'`
      });
    }
  } else if (computed.type === "sum_of_sizes") {
    // sum_of_sizes requires unsigned integer type
    if (!isUnsignedIntType(field.type)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'sum_of_sizes' must have unsigned integer type (uint8, uint16, uint32, uint64), got '${field.type}'`
      });
    }
    // Validate targets array exists
    if (!computed.targets || !Array.isArray(computed.targets) || computed.targets.length === 0) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'sum_of_sizes' must have 'targets' array with at least one element`
      });
    }
    // Skip further validation for sum_of_sizes (parent references are validated at runtime)
    return;
  } else if (computed.type === "sum_of_type_sizes") {
    // sum_of_type_sizes requires unsigned integer type
    if (!isUnsignedIntType(field.type)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'sum_of_type_sizes' must have unsigned integer type (uint8, uint16, uint32, uint64), got '${field.type}'`
      });
    }
    // Validate target and element_type exist
    if (!computed.target) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'sum_of_type_sizes' must have 'target' property`
      });
    }
    if (!computed.element_type) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field with type 'sum_of_type_sizes' must have 'element_type' property`
      });
    }
    // Skip further validation (parent references are validated at runtime)
    return;
  }

  // For length_of, either target OR from_after_field must be specified
  if (computed.type === "length_of") {
    const hasTarget = computed.target !== undefined;
    const hasFromAfter = (computed as any).from_after_field !== undefined;

    if (!hasTarget && !hasFromAfter) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field 'length_of' must have either 'target' or 'from_after_field' property`
      });
      return;
    }

    if (hasTarget && hasFromAfter) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field 'length_of' cannot have both 'target' and 'from_after_field' properties (mutually exclusive)`
      });
      return;
    }

    // Handle from_after_field validation
    if (hasFromAfter) {
      const fromAfterField = (computed as any).from_after_field;
      const referencedFieldIndex = parentFields.findIndex((f: any) => f.name === fromAfterField);
      const currentFieldIndex = parentFields.findIndex((f: any) => f.name === field.name);

      if (referencedFieldIndex === -1) {
        const fieldNames = parentFields.map((f: any) => f.name).join(', ');
        errors.push({
          path: `${path} (${field.name})`,
          message: `Computed field 'from_after_field' references '${fromAfterField}' which not found in type '${typeName}' (available fields: ${fieldNames})`
        });
        return;
      }

      // Check for invalid ordering: if from_after_field references a field before the length field,
      // and there are non-computed fields between them, those fields would be encoded twice.
      // Valid: from_after_field references field immediately before, or self-reference
      // Invalid: from_after_field references a field with other content fields between it and the length field
      if (referencedFieldIndex < currentFieldIndex - 1) {
        // Check if there are any non-computed, non-const fields between referenced field and current field
        const fieldsBetween = parentFields.slice(referencedFieldIndex + 1, currentFieldIndex);
        const problematicFields = fieldsBetween.filter((f: any) => {
          // Fields that would be encoded twice: non-computed, non-const regular fields
          return !(f.computed || f.const !== undefined);
        });

        if (problematicFields.length > 0) {
          const problematicNames = problematicFields.map((f: any) => f.name).join(', ');
          errors.push({
            path: `${path} (${field.name})`,
            message: `Computed field 'from_after_field' references '${fromAfterField}' but there are content fields (${problematicNames}) between it and the length field that would be encoded twice. The from_after_field must reference the field immediately before the length field, or the length field itself.`
          });
        }
      }
      return; // No further validation needed for from_after_field
    }
  } else {
    // For other computed types, target is required
    if (!computed.target) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field missing 'target' property`
      });
      return;
    }
  }

  // Handle cross-struct references
  const targetRef = computed.target!;

  // Check for parent reference (../)
  if (targetRef.startsWith('../')) {
    // Parent field reference - cannot validate at schema level
    // Will be validated at code generation time when we know the parent context
    // Just check syntax is valid
    const fieldPath = targetRef.substring(3); // Remove "../"
    if (!fieldPath || fieldPath.trim() === '') {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Invalid parent reference syntax: '${targetRef}' (expected format: ../field_name)`
      });
    }
    return; // Skip further validation - will be checked at code generation
  }

  // Handle dot notation (e.g., "header.file_name")
  const dotIndex = targetRef.indexOf('.');

  if (dotIndex > 0) {
    // Nested field reference - for Phase 1, we'll keep this simple
    // Full validation of nested references will be added when needed
    const fieldName = targetRef.substring(0, dotIndex);
    const subFieldName = targetRef.substring(dotIndex + 1);

    const referencedField = parentFields.find((f: any) => f.name === fieldName);
    if (!referencedField) {
      const fieldNames = parentFields.map((f: any) => f.name).join(', ');
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field target '${fieldName}' not found in type '${typeName}' (available fields: ${fieldNames})`
      });
    }
    // TODO: Validate sub-field exists and has correct type (when implementing nested validation)
  } else {
    // Simple field reference
    const targetField = parentFields.find((f: any) => f.name === targetRef);

    if (!targetField) {
      const fieldNames = parentFields.map((f: any) => f.name).join(', ');
      errors.push({
        path: `${path} (${field.name})`,
        message: `Computed field target '${targetRef}' not found in type '${typeName}' (available fields: ${fieldNames})`
      });
      return;
    }

    // Validate target type based on computation type
    if (computed.type === "length_of") {
      const targetType = (targetField as any).type;

      // length_of computes byte length of any type (arrays, strings, composite types)
      // No type restriction needed - all encoded values have a byte length

      // If target is a string and encoding is specified, validate encoding
      if (targetType === "string" && computed.encoding) {
        const targetEncoding = (targetField as any).encoding;
        if (!targetEncoding) {
          errors.push({
            path: `${path} (${field.name})`,
            message: `Computed field specifies encoding '${computed.encoding}' but target string '${targetRef}' has no encoding`
          });
        }
      }
    } else if (computed.type === "crc32_of") {
      const targetType = (targetField as any).type;

      // Target must be array of uint8 (byte array)
      if (targetType !== "array") {
        errors.push({
          path: `${path} (${field.name})`,
          message: `Computed field 'crc32_of' target '${targetRef}' must be array, got '${targetType}'`
        });
      } else {
        const itemType = (targetField as any).items?.type;
        if (itemType !== "uint8") {
          errors.push({
            path: `${path} (${field.name})`,
            message: `Computed field 'crc32_of' target '${targetRef}' must be array of uint8 (byte array), got array of '${itemType}'`
          });
        }
      }
    } else if (computed.type === "position_of") {
      // Target must be a field name (position where that field starts in the encoded output)
      // No specific type requirements - any field can have its position tracked
      // Note: The target field can appear after the computed field (forward reference)
    }
  }
}

/**
 * Validate a position field (instance)
 */
function validatePositionField(
  instance: any,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[],
  typeName: string,
  sequenceFields: Field[],
  allInstances?: any[]  // Include instance fields for nested refs
): void {
  // Validate required fields
  if (!instance.name) {
    errors.push({ path, message: "Position field missing 'name' property" });
    return;
  }

  if (!instance.type) {
    errors.push({ path: `${path} (${instance.name})`, message: "Position field missing 'type' property" });
    return;
  }

  if (instance.position === undefined) {
    errors.push({ path: `${path} (${instance.name})`, message: "Position field missing 'position' property" });
    return;
  }

  // Validate target type exists (or inline discriminated union)
  if (typeof instance.type === 'string') {
    // Simple type reference - validate it exists
    if (!schema.types[instance.type]) {
      errors.push({
        path: `${path} (${instance.name})`,
        message: `Position field type '${instance.type}' not found in schema.types`
      });
    }
  } else if (typeof instance.type === 'object' && instance.type !== null) {
    // Inline discriminated union - validate discriminator and variants
    const inlineUnion = instance.type as { discriminator?: any; variants?: any[] };

    if (!inlineUnion.discriminator) {
      errors.push({
        path: `${path} (${instance.name})`,
        message: `Inline discriminated union missing 'discriminator' property`
      });
    } else {
      // Validate discriminator (field or peek)
      if (inlineUnion.discriminator.field) {
        // Field-based discriminator - validate field exists in sequence
        const fieldName = inlineUnion.discriminator.field;
        const fieldExists = sequenceFields.some((f: any) => f.name === fieldName);
        if (!fieldExists) {
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Discriminator field '${fieldName}' not found in sequence fields`
          });
        }
      }
      // peek-based discriminators don't need field validation
    }

    if (!inlineUnion.variants || !Array.isArray(inlineUnion.variants) || inlineUnion.variants.length === 0) {
      errors.push({
        path: `${path} (${instance.name})`,
        message: `Inline discriminated union must have at least one variant`
      });
    } else {
      // Validate each variant's type exists
      for (const variant of inlineUnion.variants) {
        if (variant.type && !schema.types[variant.type]) {
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Variant type '${variant.type}' not found in schema.types`
          });
        }
      }
    }
  } else {
    errors.push({
      path: `${path} (${instance.name})`,
      message: `Position field 'type' must be a string or inline discriminated union object`
    });
  }

  // Validate position
  if (typeof instance.position === 'string') {
    // Field reference - validate it exists and is numeric
    const positionRef = instance.position;

    // Check for dot notation (nested field reference)
    const dotIndex = positionRef.indexOf('.');
    if (dotIndex > 0) {
      const fieldName = positionRef.substring(0, dotIndex);
      const subFieldName = positionRef.substring(dotIndex + 1);

      // Check both sequence fields and instance fields
      let referencedField = sequenceFields.find((f: any) => f.name === fieldName);
      let referencedInstance = allInstances?.find((inst: any) => inst.name === fieldName);

      if (!referencedField && !referencedInstance) {
        const fieldNames = [
          ...sequenceFields.map((f: any) => f.name),
          ...(allInstances?.map((inst: any) => inst.name) || [])
        ].join(', ');
        errors.push({
          path: `${path} (${instance.name})`,
          message: `Position field reference '${fieldName}' not found in type '${typeName}' (available fields: ${fieldNames})`
        });
      } else if (referencedInstance) {
        // Referencing an instance field - need to look up its type and check for sub-field
        const instanceType = schema.types[referencedInstance.type];
        if (!instanceType) {
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Referenced instance '${fieldName}' has unknown type '${referencedInstance.type}'`
          });
        } else {
          // Get the fields from the instance's type
          const instanceFields = getTypeFields(instanceType);
          const subField = instanceFields.find((f: any) => f.name === subFieldName);
          if (!subField) {
            const availableFields = instanceFields.map((f: any) => f.name).join(', ');
            errors.push({
              path: `${path} (${instance.name})`,
              message: `Sub-field '${subFieldName}' not found in instance '${fieldName}' of type '${referencedInstance.type}' (available: ${availableFields})`
            });
          } else {
            // Validate that the sub-field is numeric
            const subFieldType = (subField as any).type;
            if (!isNumericType(subFieldType)) {
              errors.push({
                path: `${path} (${instance.name})`,
                message: `Position field '${instance.name}' references non-numeric field '${positionRef}' (type: ${subFieldType})`
              });
            }
          }
        }
      } else {
        // Verify the field is a bitfield and the sub-field exists
        const referencedFieldAny = referencedField as any;
        if (referencedFieldAny.type !== 'bitfield') {
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Position field reference '${fieldName}' is not a bitfield (cannot reference sub-field '${subFieldName}')`
          });
        } else if (!referencedFieldAny.fields || !Array.isArray(referencedFieldAny.fields)) {
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Bitfield '${fieldName}' has no fields array`
          });
        } else {
          const bitfieldSubField = referencedFieldAny.fields.find((bf: any) => bf.name === subFieldName);
          if (!bitfieldSubField) {
            const availableFields = referencedFieldAny.fields.map((bf: any) => bf.name).join(', ');
            errors.push({
              path: `${path} (${instance.name})`,
              message: `Bitfield sub-field '${subFieldName}' not found in '${fieldName}' (available: ${availableFields})`
            });
          }
          // Bitfield sub-fields are always numeric, so no need to check type
        }
      }
    } else {
      // Regular field reference (no dot notation)
      const referencedField = sequenceFields.find((f: any) => f.name === positionRef);

      if (!referencedField) {
        const fieldNames = sequenceFields.map((f: any) => f.name).join(', ');
        errors.push({
          path: `${path} (${instance.name})`,
          message: `Position field reference '${positionRef}' not found in type '${typeName}' (available fields: ${fieldNames})`
        });
      } else {
        // Validate that referenced field is numeric type
        const fieldType = (referencedField as any).type;
        if (!isNumericType(fieldType)) {
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Position field '${instance.name}' references non-numeric field '${positionRef}' (type: ${fieldType})`
          });
        }
      }
    }
  } else if (typeof instance.position === 'number') {
    // Numeric position - no validation needed (can be positive or negative)
  } else {
    errors.push({
      path: `${path} (${instance.name})`,
      message: `Position must be a number or string field reference, got ${typeof instance.position}`
    });
  }

  // Validate size if specified
  if (instance.size !== undefined) {
    if (typeof instance.size === 'string') {
      // Field reference - can be nested like "end_of_central_dir.central_dir_size"
      const sizeRef = instance.size;
      const dotIndex = sizeRef.indexOf('.');

      if (dotIndex > 0) {
        // Nested field reference
        const fieldName = sizeRef.substring(0, dotIndex);
        const subFieldName = sizeRef.substring(dotIndex + 1);

        // Check both sequence fields and instance fields
        let referencedField = sequenceFields.find((f: any) => f.name === fieldName);
        let referencedInstance = allInstances?.find((inst: any) => inst.name === fieldName);

        if (!referencedField && !referencedInstance) {
          const fieldNames = [
            ...sequenceFields.map((f: any) => f.name),
            ...(allInstances?.map((inst: any) => inst.name) || [])
          ].join(', ');
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Size field reference '${fieldName}' not found in type '${typeName}' (available fields: ${fieldNames})`
          });
        } else if (referencedInstance) {
          // Referencing an instance field - need to look up its type and check for sub-field
          const instanceType = schema.types[referencedInstance.type];
          if (!instanceType) {
            errors.push({
              path: `${path} (${instance.name})`,
              message: `Referenced instance '${fieldName}' has unknown type '${referencedInstance.type}'`
            });
          } else {
            // Get the fields from the instance's type
            const instanceFields = getTypeFields(instanceType);
            const subField = instanceFields.find((f: any) => f.name === subFieldName);
            if (!subField) {
              const availableFields = instanceFields.map((f: any) => f.name).join(', ');
              errors.push({
                path: `${path} (${instance.name})`,
                message: `Sub-field '${subFieldName}' not found in instance '${fieldName}' of type '${referencedInstance.type}' (available: ${availableFields})`
              });
            } else {
              // Validate that the sub-field is numeric
              const subFieldType = (subField as any).type;
              if (!isNumericType(subFieldType)) {
                errors.push({
                  path: `${path} (${instance.name})`,
                  message: `Size field '${instance.name}' references non-numeric field '${sizeRef}' (type: ${subFieldType})`
                });
              }
            }
          }
        } else {
          // Bitfield reference
          const referencedFieldAny = referencedField as any;
          if (referencedFieldAny.type !== 'bitfield') {
            errors.push({
              path: `${path} (${instance.name})`,
              message: `Size field reference '${fieldName}' is not a bitfield (cannot reference sub-field '${subFieldName}')`
            });
          }
        }
      } else {
        // Simple field reference (no dot notation)
        const referencedField = sequenceFields.find((f: any) => f.name === sizeRef);

        if (!referencedField) {
          const fieldNames = sequenceFields.map((f: any) => f.name).join(', ');
          errors.push({
            path: `${path} (${instance.name})`,
            message: `Size field reference '${sizeRef}' not found in type '${typeName}' (available fields: ${fieldNames})`
          });
        } else {
          // Validate that referenced field is numeric type
          const fieldType = (referencedField as any).type;
          if (!isNumericType(fieldType)) {
            errors.push({
              path: `${path} (${instance.name})`,
              message: `Size field '${instance.name}' references non-numeric field '${sizeRef}' (type: ${fieldType})`
            });
          }
        }
      }
    } else if (typeof instance.size !== 'number') {
      errors.push({
        path: `${path} (${instance.name})`,
        message: `Size must be a number or string field reference, got ${typeof instance.size}`
      });
    }
  }

  // Alignment is validated by Zod schema (must be power of 2)
}

/**
 * Validate a discriminated union
 */
function validateDiscriminatedUnion(
  field: any,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[],
  parentFields?: Field[]
): void {
  if (!field.discriminator) {
    errors.push({ path: `${path} (${field.name})`, message: "Discriminated union missing 'discriminator' property" });
    return;
  }

  const disc = field.discriminator;
  const hasPeek = disc.peek !== undefined;
  const hasField = disc.field !== undefined;

  // Must have exactly one of peek or field
  if (!hasPeek && !hasField) {
    errors.push({
      path: `${path} (${field.name})`,
      message: "Discriminator must have either 'peek' or 'field' property (both are required, one must be specified)"
    });
  }

  if (hasPeek && hasField) {
    errors.push({
      path: `${path} (${field.name})`,
      message: "Discriminator cannot have both 'peek' and 'field' properties (they are mutually exclusive)"
    });
  }

  // Validate peek-based discriminator
  if (hasPeek) {
    const validPeekTypes = ["uint8", "uint16", "uint32"];
    if (!validPeekTypes.includes(disc.peek)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Invalid peek type '${disc.peek}' (must be uint8, uint16, or uint32, not uint64)`
      });
    }

    // Check endianness requirements
    if (disc.peek === "uint8" && disc.endianness) {
      errors.push({
        path: `${path} (${field.name})`,
        message: "Endianness is meaningless for uint8 peek (single byte has no endianness)"
      });
    }

    if ((disc.peek === "uint16" || disc.peek === "uint32") && !disc.endianness) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Endianness is required for ${disc.peek} peek`
      });
    }

    if (disc.endianness && disc.endianness !== "big_endian" && disc.endianness !== "little_endian") {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Invalid endianness '${disc.endianness}' (must be 'big_endian' or 'little_endian')`
      });
    }
  }

  // Validate field-based discriminator
  if (hasField && parentFields) {
    const fieldIndex = parentFields.findIndex((f: any) => f.name === field.name);

    // Check if this is a bitfield sub-field reference (e.g., "flags.opcode")
    const dotIndex = disc.field.indexOf('.');
    if (dotIndex > 0) {
      const fieldName = disc.field.substring(0, dotIndex);
      const subFieldName = disc.field.substring(dotIndex + 1);

      const referencedFieldIndex = parentFields.findIndex((f: any) => f.name === fieldName);

      if (referencedFieldIndex === -1) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `Discriminator field '${fieldName}' not found in parent struct`
        });
      } else if (referencedFieldIndex >= fieldIndex) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `Discriminator field '${fieldName}' comes after this union (forward reference not allowed)`
        });
      } else {
        // Verify the field is a bitfield and the sub-field exists
        const referencedField = parentFields[referencedFieldIndex] as any;
        if (referencedField.type !== 'bitfield') {
          errors.push({
            path: `${path} (${field.name})`,
            message: `Discriminator field '${fieldName}' is not a bitfield (cannot reference sub-field '${subFieldName}')`
          });
        } else if (!referencedField.fields || !Array.isArray(referencedField.fields)) {
          errors.push({
            path: `${path} (${field.name})`,
            message: `Bitfield '${fieldName}' has no fields array`
          });
        } else {
          const bitfieldSubField = referencedField.fields.find((bf: any) => bf.name === subFieldName);
          if (!bitfieldSubField) {
            const availableFields = referencedField.fields.map((bf: any) => bf.name).join(', ');
            errors.push({
              path: `${path} (${field.name})`,
              message: `Bitfield sub-field '${subFieldName}' not found in '${fieldName}' (available: ${availableFields})`
            });
          }
        }
      }
    } else {
      // Regular field reference (no dot notation)
      const referencedFieldIndex = parentFields.findIndex((f: any) => f.name === disc.field);

      if (referencedFieldIndex === -1) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `Discriminator field '${disc.field}' not found in parent struct`
        });
      } else if (referencedFieldIndex >= fieldIndex) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `Discriminator field '${disc.field}' comes after this union (forward reference not allowed)`
        });
      }
    }
  }

  // Validate byte_budget
  if (field.byte_budget) {
    const budgetField = field.byte_budget.field;
    if (parentFields) {
      const fieldIndex = parentFields.findIndex((f: any) => f.name === field.name);
      const budgetFieldIndex = parentFields.findIndex((f: any) => f.name === budgetField);

      if (budgetFieldIndex === -1) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `byte_budget.field '${budgetField}' not found in parent struct`
        });
      } else if (budgetFieldIndex >= fieldIndex) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `byte_budget.field '${budgetField}' comes after this union (forward reference not allowed)`
        });
      } else {
        // Check the referenced field is numeric
        const budgetFieldDef = parentFields[budgetFieldIndex] as any;
        const numericTypes = ["uint8", "uint16", "uint32", "uint64"];
        if (!numericTypes.includes(budgetFieldDef.type)) {
          errors.push({
            path: `${path} (${field.name})`,
            message: `byte_budget.field '${budgetField}' must be a numeric type (uint8/uint16/uint32/uint64), got '${budgetFieldDef.type}'`
          });
        }
      }
    }
  }

  // Validate variants
  if (!field.variants || !Array.isArray(field.variants) || field.variants.length === 0) {
    errors.push({
      path: `${path} (${field.name})`,
      message: field.variants?.length === 0 ? "Variants array cannot be empty" : "Discriminated union missing 'variants' property"
    });
    return;
  }

  // Check that at least one variant has a 'when' condition (can't have only fallback)
  const hasNonFallback = field.variants.some((v: any) => v.when);
  if (!hasNonFallback) {
    errors.push({
      path: `${path}.variants`,
      message: "Discriminated union must have at least one variant with a 'when' condition (cannot have only fallback variants)"
    });
  }

  // Check fallback variant (no 'when') can only be last
  for (let i = 0; i < field.variants.length; i++) {
    const variant = field.variants[i];

    if (!variant.type) {
      errors.push({
        path: `${path}.variants[${i}]`,
        message: "Variant missing 'type' property"
      });
      continue;
    }

    if (!variant.when) {
      // Fallback variant
      if (i !== field.variants.length - 1) {
        errors.push({
          path: `${path}.variants[${i}]`,
          message: "Fallback variant (no 'when' condition) can only be in the last position"
        });
      }
    } else {
      // Validate 'when' expression syntax (basic check)
      if (typeof variant.when !== 'string' || variant.when.trim() === '') {
        errors.push({
          path: `${path}.variants[${i}]`,
          message: "Variant 'when' condition must be a non-empty string"
        });
      } else {
        // Basic syntax validation - check for incomplete expressions
        const trimmed = variant.when.trim();
        if (trimmed.endsWith('&&') || trimmed.endsWith('||') || trimmed.endsWith('&') || trimmed.endsWith('|')) {
          errors.push({
            path: `${path}.variants[${i}]`,
            message: `Invalid when condition syntax: '${variant.when}' (incomplete expression)`
          });
        }
      }
    }

    // Check variant type exists
    if (variant.type && !schema.types[variant.type]) {
      errors.push({
        path: `${path}.variants[${i}]`,
        message: `Variant type '${variant.type}' not found in schema.types`
      });
    }
  }
}

/**
 * Validate a back_reference
 */
function validateChoice(
  element: any,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[]
): void {
  if (!element.choices || !Array.isArray(element.choices)) {
    errors.push({ path, message: "Choice missing 'choices' array property" });
    return;
  }

  if (element.choices.length < 2) {
    errors.push({ path, message: "Choice must have at least 2 choices" });
    return;
  }

  // Validate that all choice types exist
  for (let i = 0; i < element.choices.length; i++) {
    const choice = element.choices[i];
    if (!choice.type) {
      errors.push({ path: `${path}.choices[${i}]`, message: "Choice missing 'type' property" });
      continue;
    }

    if (!schema.types[choice.type]) {
      errors.push({
        path: `${path}.choices[${i}]`,
        message: `Choice type '${choice.type}' not found in schema.types`
      });
    }
  }

  // Validate that all choice types have a common discriminator field
  // This is required for the decoder to determine which variant to decode
  const firstChoiceType = element.choices[0].type;
  const firstChoiceTypeDef = schema.types[firstChoiceType];

  if (!firstChoiceTypeDef || isTypeAlias(firstChoiceTypeDef)) {
    // If first type doesn't exist or is an alias, skip discriminator validation
    // (error already reported above)
    return;
  }

  const firstTypeFields = getTypeFields(firstChoiceTypeDef);
  if (firstTypeFields.length === 0) {
    errors.push({
      path,
      message: `Choice type '${firstChoiceType}' has no fields. Choice variant types must have a common discriminator field as their first field (e.g., type_tag: uint8)`
    });
    return;
  }

  const discriminatorField = firstTypeFields[0];
  if (!('name' in discriminatorField) || !discriminatorField.name) {
    errors.push({
      path,
      message: `First field of choice type '${firstChoiceType}' has no name. Choice variants must have a named discriminator field as their first field (e.g., type_tag: uint8)`
    });
    return;
  }

  const discriminatorName = discriminatorField.name;
  const discriminatorType = (discriminatorField as any).type;
  const discriminatorConst = (discriminatorField as any).const;

  // Validate discriminator is a type that supports peek (uint8, uint16, uint32)
  // Note: The generator uses peek methods which are currently available for these types
  const validDiscriminatorTypes = ['uint8', 'uint16', 'uint32'];
  if (!validDiscriminatorTypes.includes(discriminatorType)) {
    errors.push({
      path,
      message: `Discriminator field '${discriminatorName}' in choice type '${firstChoiceType}' must be uint8, uint16, or uint32 (types with peek support), got '${discriminatorType}'`
    });
  }

  // Validate discriminator has a const value (required for choice discrimination)
  if (discriminatorConst === undefined || discriminatorConst === null) {
    errors.push({
      path,
      message: `Discriminator field '${discriminatorName}' in choice type '${firstChoiceType}' must have a 'const' value to enable discrimination during decoding`
    });
  }

  // Track discriminator values to check for duplicates
  const discriminatorValues = new Map<number, string>();
  if (discriminatorConst !== undefined && discriminatorConst !== null) {
    discriminatorValues.set(discriminatorConst, firstChoiceType);
  }

  // Validate all other choice types have the same discriminator field
  for (let i = 1; i < element.choices.length; i++) {
    const choiceType = element.choices[i].type;
    const choiceTypeDef = schema.types[choiceType];

    if (!choiceTypeDef || isTypeAlias(choiceTypeDef)) {
      continue; // Error already reported
    }

    const choiceFields = getTypeFields(choiceTypeDef);
    if (choiceFields.length === 0) {
      errors.push({
        path: `${path}.choices[${i}]`,
        message: `Choice type '${choiceType}' has no fields. All choice variants must have the same discriminator field '${discriminatorName}' as their first field`
      });
      continue;
    }

    const choiceDiscriminator = choiceFields[0];
    if (!('name' in choiceDiscriminator) || choiceDiscriminator.name !== discriminatorName) {
      errors.push({
        path: `${path}.choices[${i}]`,
        message: `Choice type '${choiceType}' must have '${discriminatorName}' as its first field (to match other choice variants). Got '${choiceDiscriminator.name || '(unnamed)'}'`
      });
      continue;
    }

    const choiceDiscriminatorType = (choiceDiscriminator as any).type;
    if (choiceDiscriminatorType !== discriminatorType) {
      errors.push({
        path: `${path}.choices[${i}]`,
        message: `Discriminator field '${discriminatorName}' in choice type '${choiceType}' must be of type '${discriminatorType}', got '${choiceDiscriminatorType}'`
      });
    }

    // Validate this choice has a const value
    const choiceDiscriminatorConst = (choiceDiscriminator as any).const;
    if (choiceDiscriminatorConst === undefined || choiceDiscriminatorConst === null) {
      errors.push({
        path: `${path}.choices[${i}]`,
        message: `Discriminator field '${discriminatorName}' in choice type '${choiceType}' must have a 'const' value to enable discrimination during decoding`
      });
    } else {
      // Check for duplicate discriminator values
      if (discriminatorValues.has(choiceDiscriminatorConst)) {
        const duplicateType = discriminatorValues.get(choiceDiscriminatorConst);
        errors.push({
          path: `${path}.choices[${i}]`,
          message: `Discriminator value 0x${choiceDiscriminatorConst.toString(16)} in choice type '${choiceType}' conflicts with '${duplicateType}' (discriminator values must be unique)`
        });
      } else {
        discriminatorValues.set(choiceDiscriminatorConst, choiceType);
      }
    }
  }
}

function validateBackReference(
  field: any,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[]
): void {
  if (!field.storage) {
    errors.push({ path: `${path} (${field.name})`, message: "Back reference missing 'storage' property" });
    return;
  }

  const validStorageTypes = ["uint8", "uint16", "uint32"];
  if (!validStorageTypes.includes(field.storage)) {
    errors.push({
      path: `${path} (${field.name})`,
      message: `Invalid back reference storage type '${field.storage}' (must be uint8, uint16, or uint32, not uint64)`
    });
  }

  if (!field.offset_mask) {
    errors.push({ path: `${path} (${field.name})`, message: "Back reference missing 'offset_mask' property" });
  } else {
    // Validate offset_mask format
    if (!/^0x[0-9A-Fa-f]+$/.test(field.offset_mask)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Invalid offset_mask format '${field.offset_mask}' (must be hex starting with 0x, e.g., '0x3FFF')`
      });
    } else {
      const maskValue = parseInt(field.offset_mask, 16);

      // Check if mask is zero
      if (maskValue === 0) {
        errors.push({
          path: `${path} (${field.name})`,
          message: "offset_mask cannot be zero (no bits available for offset)"
        });
      }

      // Check if mask exceeds storage capacity
      const maxValues: Record<string, number> = {
        "uint8": 0xFF,
        "uint16": 0xFFFF,
        "uint32": 0xFFFFFFFF
      };

      if (field.storage in maxValues && maskValue > maxValues[field.storage]) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `offset_mask ${field.offset_mask} exceeds maximum for ${field.storage} storage (max: 0x${maxValues[field.storage].toString(16).toUpperCase()})`
        });
      }
    }
  }

  if (!field.target_type) {
    errors.push({ path: `${path} (${field.name})`, message: "Back reference missing 'target_type' property" });
  } else if (!schema.types[field.target_type]) {
    errors.push({
      path: `${path} (${field.name})`,
      message: `Back reference target_type '${field.target_type}' not found in schema.types`
    });
  }

  // Validate offset_from field
  if (!field.offset_from) {
    errors.push({ path: `${path} (${field.name})`, message: "Back reference missing 'offset_from' property" });
  } else {
    const validOffsetFrom = ["message_start", "current_position"];
    if (!validOffsetFrom.includes(field.offset_from)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: `Invalid offset_from value '${field.offset_from}' (must be 'message_start' or 'current_position')`
      });
    }
  }

  // Check endianness requirements
  if (field.storage === "uint8" && field.endianness) {
    errors.push({
      path: `${path} (${field.name})`,
      message: "Endianness is meaningless for uint8 storage (single byte has no endianness)"
    });
  }

  if ((field.storage === "uint16" || field.storage === "uint32") && !field.endianness) {
    errors.push({
      path: `${path} (${field.name})`,
      message: `Endianness is required for ${field.storage} back reference storage`
    });
  }

  if (field.endianness && field.endianness !== "big_endian" && field.endianness !== "little_endian") {
    errors.push({
      path: `${path} (${field.name})`,
      message: `Invalid endianness '${field.endianness}' (must be 'big_endian' or 'little_endian')`
    });
  }
}

/**
 * Validate an optional field
 */
function validateOptional(
  field: any,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[]
): void {
  if (!field.value_type) {
    errors.push({ path: `${path} (${field.name || "optional"})`, message: "Optional field missing 'value_type' property" });
    return;
  }

  const valueType = field.value_type;

  // Prohibit nested optionals (optional<optional<T>>)
  if (valueType === "optional") {
    errors.push({
      path: `${path} (${field.name || "optional"})`,
      message: "Nested optionals are not allowed (optional<optional<T>> is redundant)"
    });
    return;
  }

  // Prohibit optional bit (pointless - 1 bit presence + 1 bit value = 2 bits)
  if (valueType === "bit") {
    errors.push({
      path: `${path} (${field.name || "optional"})`,
      message: "Optional bit is not allowed (use a 2-bit field instead - presence flag + value bit = 2 bits total)"
    });
    return;
  }

  // Validate that value_type exists (if not a built-in type)
  if (!BUILT_IN_TYPES.includes(valueType) && !schema.types[valueType]) {
    errors.push({
      path: `${path} (${field.name || "optional"})`,
      message: `Optional value_type '${valueType}' not found in schema.types`
    });
  }

  // Validate presence_type if specified
  if (field.presence_type) {
    const validPresenceTypes = ["uint8", "bit"];
    if (!validPresenceTypes.includes(field.presence_type)) {
      errors.push({
        path: `${path} (${field.name || "optional"})`,
        message: `Invalid presence_type '${field.presence_type}' (must be 'uint8' or 'bit')`
      });
    }
  }
}

/**
 * Validate a single field
 */
function validateField(
  field: Field,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[],
  typeName?: string, // Type name being validated (for protocol context)
  parentFields?: Field[], // For field-based discriminator validation
  rootTypeName?: string // Root type name for _root references
): void {
  if (!("type" in field)) {
    errors.push({ path, message: "Field missing 'type' property" });
    return;
  }

  const fieldType = field.type;

  // Validate computed fields if present
  const fieldAny = field as any;
  if (fieldAny.computed && typeName && parentFields) {
    validateComputedField(fieldAny, path, schema, errors, typeName, parentFields);
  }

  // Check array fields have items defined
  if (fieldType === "array") {
    if (!("items" in field) || !field.items) {
      errors.push({
        path: `${path} (${field.name || "array"})`,
        message: "Array field missing 'items' property",
      });
    } else if (!("kind" in field)) {
      errors.push({
        path: `${path} (${field.name || "array"})`,
        message: "Array field missing 'kind' property (fixed|length_prefixed|null_terminated|field_referenced)",
      });
    } else {
      // Validate field_referenced arrays
      if ((field as any).kind === "field_referenced") {
        if (!("length_field" in field) || !(field as any).length_field) {
          errors.push({
            path: `${path} (${field.name || "array"})`,
            message: "field_referenced array missing 'length_field' property",
          });
        } else if (parentFields && typeName) {
          const lengthFieldRef = (field as any).length_field;

          // Check for _root reference
          if (lengthFieldRef.startsWith('_root.')) {
            // Reference to root type's fields
            // We cannot fully validate _root references at schema validation time
            // because we don't know which type will be used as root at runtime.
            // We just check that the syntax is valid (has at least one field name after _root)
            const remainingPath = lengthFieldRef.substring(6); // Remove "_root."

            if (!remainingPath || remainingPath.trim() === '') {
              errors.push({
                path: `${path} (${field.name})`,
                message: `Invalid _root reference syntax: '${lengthFieldRef}' (expected format: _root.field_name or _root.field.subfield)`,
              });
            }
            // Skip further validation - will be checked at code generation time
          } else {
            // Regular field reference (not _root)
            // Get available fields for reference (includes header fields if protocol payload type)
            const availableFields = getAvailableFieldsForReference(typeName, parentFields, schema);
            const fieldIndex = availableFields.findIndex((f: any) => f.name === field.name);

            // Check for bitfield sub-field reference (e.g., "flags.opcode")
            const dotIndex = lengthFieldRef.indexOf('.');
            if (dotIndex > 0) {
              const fieldName = lengthFieldRef.substring(0, dotIndex);
              const subFieldName = lengthFieldRef.substring(dotIndex + 1);

              const referencedFieldIndex = availableFields.findIndex((f: any) => f.name === fieldName);

              if (referencedFieldIndex === -1) {
                const fieldNames = availableFields.map((f: any) => f.name).join(', ');
                errors.push({
                  path: `${path} (${field.name})`,
                  message: `length_field '${fieldName}' not found in type '${typeName}'${schema.protocol ? ` or protocol header '${schema.protocol.header}'` : ''} (available fields: ${fieldNames})`,
                });
              } else if (referencedFieldIndex >= fieldIndex) {
                errors.push({
                  path: `${path} (${field.name})`,
                  message: `length_field '${fieldName}' comes after this array (forward reference not allowed)`,
                });
              } else {
                // Check if it's a bitfield or struct type
                const referencedField = availableFields[referencedFieldIndex] as any;

                if (referencedField.type === 'bitfield') {
                  // Bitfield sub-field reference
                  if (!referencedField.fields || !Array.isArray(referencedField.fields)) {
                    errors.push({
                      path: `${path} (${field.name})`,
                      message: `Bitfield '${fieldName}' has no fields array`,
                    });
                  } else {
                    const bitfieldSubField = referencedField.fields.find((bf: any) => bf.name === subFieldName);
                    if (!bitfieldSubField) {
                      const availableBitfields = referencedField.fields.map((bf: any) => bf.name).join(', ');
                      errors.push({
                        path: `${path} (${field.name})`,
                        message: `Bitfield sub-field '${subFieldName}' not found in '${fieldName}' (available: ${availableBitfields})`,
                      });
                    }
                  }
                } else if (schema.types[referencedField.type]) {
                  // Struct type - allow referencing fields within the nested struct
                  // We'll validate at code generation time that the sub-field exists
                  // For now, just accept the syntax
                } else {
                  // Not a bitfield or struct type
                  errors.push({
                    path: `${path} (${field.name})`,
                    message: `length_field '${fieldName}' must be a bitfield or struct type to reference sub-field '${subFieldName}', got '${referencedField.type}'`,
                  });
                }
              }
            } else {
              // Regular field reference (no dot notation)
              const referencedFieldIndex = availableFields.findIndex((f: any) => f.name === lengthFieldRef);

              if (referencedFieldIndex === -1) {
                const fieldNames = availableFields.map((f: any) => f.name).join(', ');
                errors.push({
                  path: `${path} (${field.name})`,
                  message: `length_field '${lengthFieldRef}' not found in type '${typeName}'${schema.protocol ? ` or protocol header '${schema.protocol.header}'` : ''} (available fields: ${fieldNames})`,
                });
              } else if (referencedFieldIndex >= fieldIndex) {
                errors.push({
                  path: `${path} (${field.name})`,
                  message: `length_field '${lengthFieldRef}' comes after this array (forward reference not allowed)`,
                });
              }
            }
          }
        }
      }

      // Recursively validate items (as element type, which doesn't require 'name')
      validateElementType(field.items as any, `${path}.items`, schema, errors);
    }
  }

  // Check bitfield fields have fields array
  if (fieldType === "bitfield") {
    if (!("fields" in field) || !Array.isArray(field.fields)) {
      errors.push({
        path: `${path} (${field.name})`,
        message: "Bitfield missing 'fields' array",
      });
    }
  }

  // Validate string const
  if (fieldType === "string" && (field as any).const !== undefined) {
    const fieldAny = field as any;
    if (fieldAny.kind !== "fixed") {
      errors.push({
        path: `${path} (${field.name})`,
        message: `String const is only supported on fixed-length strings (got kind '${fieldAny.kind}')`,
      });
    } else {
      const constStr = fieldAny.const;
      const fixedLength = fieldAny.length;
      // Check byte length in declared encoding
      const encoding = fieldAny.encoding || "utf8";
      let byteLength: number;
      if (encoding === "utf8") {
        byteLength = new TextEncoder().encode(constStr).length;
      } else {
        // ASCII/Latin-1: 1 byte per character
        byteLength = constStr.length;
      }
      if (byteLength > fixedLength) {
        errors.push({
          path: `${path} (${field.name})`,
          message: `String const '${constStr}' is ${byteLength} bytes in ${encoding} encoding, exceeds fixed length ${fixedLength}`,
        });
      }
    }
  }

  // Check discriminated union fields
  if (fieldType === "discriminated_union") {
    validateDiscriminatedUnion(field as any, path, schema, errors, parentFields);
  }

  // Check back_reference fields
  if (fieldType === "back_reference") {
    validateBackReference(field as any, path, schema, errors);
  }

  // Check choice fields
  if (fieldType === "choice") {
    validateChoice(field as any, path, schema, errors);
  }

  // Check optional fields
  if (fieldType === "optional") {
    validateOptional(field as any, path, schema, errors);
  }

  // Check type references exist
  // Allow 'T' as a type parameter in generic templates (don't validate it as a type reference)
  if (fieldType === 'T') {
    return;
  }

  if (!BUILT_IN_TYPES.includes(fieldType)) {
    // This is a type reference - check if it exists
    const referencedType = extractTypeReference(fieldType);

    if (!schema.types[referencedType]) {
      // Check if it's a generic instantiation
      const genericMatch = fieldType.match(/^(\w+)<(.+)>$/);
      if (genericMatch) {
        const [, genericType, typeArg] = genericMatch;
        const templateKey = `${genericType}<T>`;

        if (!schema.types[templateKey]) {
          errors.push({
            path: `${path} (${field.name})`,
            message: `Generic template '${templateKey}' not found in schema.types`,
          });
        }

        // Validate the type argument (allow 'T' here too)
        const argType = extractTypeReference(typeArg);
        if (argType !== 'T' && !BUILT_IN_TYPES.includes(argType) && !schema.types[argType]) {
          errors.push({
            path: `${path} (${field.name})`,
            message: `Type argument '${typeArg}' in '${fieldType}' not found in schema.types`,
          });
        }
      } else {
        errors.push({
          path: `${path} (${field.name})`,
          message: `Type '${fieldType}' not found in schema.types`,
        });
      }
    }
  }
}

/**
 * Validate an element type (array item - no 'name' required)
 */
function validateElementType(
  element: any,
  path: string,
  schema: BinarySchema,
  errors: ValidationError[]
): void {
  if (!("type" in element)) {
    errors.push({ path, message: "Element missing 'type' property" });
    return;
  }

  const elementType = element.type;

  // Check nested arrays
  if (elementType === "array") {
    if (!("items" in element) || !element.items) {
      errors.push({
        path,
        message: "Array element missing 'items' property",
      });
    } else if (!("kind" in element)) {
      errors.push({
        path,
        message: "Array element missing 'kind' property (fixed|length_prefixed|null_terminated)",
      });
    } else {
      // Recursively validate nested array items
      validateElementType(element.items as any, `${path}.items`, schema, errors);
    }
    return;
  }

  // Check discriminated union elements
  if (elementType === "discriminated_union") {
    validateDiscriminatedUnion(element, path, schema, errors);
    return;
  }

  // Check back_reference elements
  if (elementType === "back_reference") {
    validateBackReference(element, path, schema, errors);
    return;
  }

  // Check choice elements
  if (elementType === "choice") {
    validateChoice(element, path, schema, errors);
    return;
  }

  // Check optional elements
  if (elementType === "optional") {
    validateOptional(element, path, schema, errors);
    return;
  }

  // Check type references exist
  // Allow 'T' as a type parameter in generic templates
  if (elementType === 'T') {
    return;
  }

  if (!BUILT_IN_TYPES.includes(elementType)) {
    // This is a type reference - check if it exists
    const referencedType = extractTypeReference(elementType);

    if (!schema.types[referencedType]) {
      // Check if it's a generic instantiation
      const genericMatch = elementType.match(/^(\w+)<(.+)>$/);
      if (genericMatch) {
        const [, genericType, typeArg] = genericMatch;
        const templateKey = `${genericType}<T>`;

        if (!schema.types[templateKey]) {
          errors.push({
            path,
            message: `Generic template '${templateKey}' not found in schema.types`,
          });
        }

        // Validate the type argument (allow 'T' here too)
        const argType = extractTypeReference(typeArg);
        if (argType !== 'T' && !BUILT_IN_TYPES.includes(argType) && !schema.types[argType]) {
          errors.push({
            path,
            message: `Type argument '${typeArg}' in '${elementType}' not found in schema.types`,
          });
        }
      } else {
        errors.push({
          path,
          message: `Type '${elementType}' not found in schema.types`,
        });
      }
    }
  }
}

/**
 * Extract the base type from a type reference (e.g., "Point" from "Optional<Point>")
 */
function extractTypeReference(typeRef: string | undefined): string {
  if (!typeRef) {
    throw new Error("extractTypeReference called with undefined typeRef");
  }
  const genericMatch = typeRef.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    return `${genericMatch[1]}<T>`;
  }
  return typeRef;
}

/**
 * Find circular dependencies in type definitions
 */
function findCircularDependency(
  typeName: string,
  schema: BinarySchema,
  visited: Set<string>,
  path: string[] = []
): string[] | null {
  // If we've seen this type before in this path, we have a cycle
  if (visited.has(typeName)) {
    return [...path, typeName];
  }

  // Skip generic templates
  if (typeName.includes("<T>")) {
    return null;
  }

  const typeDef = schema.types[typeName];
  if (!typeDef) {
    return null;
  }

  visited.add(typeName);
  path.push(typeName);

  // Handle type aliases that can have dependencies (discriminated unions and pointers)
  if (isTypeAlias(typeDef)) {
    const typeDefAny = typeDef as any;

    // Check discriminated union variants for circular dependencies
    if (typeDefAny.type === "discriminated_union" && typeDefAny.variants) {
      for (const variant of typeDefAny.variants) {
        if (variant.type && schema.types[variant.type]) {
          const cycle = findCircularDependency(variant.type, schema, new Set(visited), [...path]);
          if (cycle) return cycle;
        }
      }
    }

    // Check back_reference target_type for circular dependencies
    if (typeDefAny.type === "back_reference" && typeDefAny.target_type) {
      if (schema.types[typeDefAny.target_type]) {
        const cycle = findCircularDependency(typeDefAny.target_type, schema, new Set(visited), [...path]);
        if (cycle) return cycle;
      }
    }

    // Other type aliases (primitives, arrays) don't have dependencies
    return null;
  }

  // Check all fields for type references
  const fields = getTypeFields(typeDef);
  for (const field of fields) {
    if (!("type" in field)) continue;

    const fieldType = field.type;

    // Skip built-in types
    if (BUILT_IN_TYPES.includes(fieldType)) {
      // Check array items recursively
      if (fieldType === "array" && "items" in field && field.items) {
        const itemType = (field.items as any).type;
        if (itemType && !BUILT_IN_TYPES.includes(itemType)) {
          const cycle = findCircularDependency(itemType, schema, new Set(visited), [...path]);
          if (cycle) return cycle;
        }
      }

      // Check discriminated union variants recursively
      if (fieldType === "discriminated_union" && "variants" in field && Array.isArray(field.variants)) {
        for (const variant of field.variants) {
          if (variant.type && !BUILT_IN_TYPES.includes(variant.type)) {
            const cycle = findCircularDependency(variant.type, schema, new Set(visited), [...path]);
            if (cycle) return cycle;
          }
        }
      }

      // Check back_reference target type recursively
      if (fieldType === "back_reference" && "target_type" in field) {
        const targetType = (field as any).target_type;
        if (targetType && !BUILT_IN_TYPES.includes(targetType)) {
          const cycle = findCircularDependency(targetType, schema, new Set(visited), [...path]);
          if (cycle) return cycle;
        }
      }

      continue;
    }

    // Extract base type (handle generics)
    const referencedType = extractTypeReference(fieldType);

    if (referencedType !== typeName && schema.types[referencedType]) {
      const cycle = findCircularDependency(referencedType, schema, new Set(visited), [...path]);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return "✓ Schema validation passed";
  }

  let output = `✗ Schema validation failed with ${result.errors.length} error(s):\n\n`;

  for (const error of result.errors) {
    output += `  • ${error.path}\n`;
    output += `    ${error.message}\n\n`;
  }

  return output;
}
