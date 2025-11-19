// ABOUTME: Analyzes schema types to determine encoding context requirements
// ABOUTME: Identifies parent field references and array correlations for context threading

import type { BinarySchema, TypeDef, Field } from "../../schema/binary-schema.js";
import { getTypeFields } from "./type-utils.js";

/**
 * Context requirements for a type
 */
export interface ContextRequirements {
  // Fields referenced via ../field_name
  needsParentFields: Set<string>;

  // Arrays referenced via [corresponding<Type>], [first<Type>], [last<Type>]
  needsArrayIterations: Set<string>;

  // Uses ../ parent navigation at all
  usesParentNavigation: boolean;
}

/**
 * Analyze a type's context requirements by examining computed field paths
 */
export function analyzeContextRequirements(
  typeDef: TypeDef,
  schema: BinarySchema,
  visitedTypes: Set<string> = new Set()
): ContextRequirements {
  const requirements: ContextRequirements = {
    needsParentFields: new Set(),
    needsArrayIterations: new Set(),
    usesParentNavigation: false
  };

  // Find type name for circular reference detection
  const typeName = findTypeNameForDef(typeDef, schema);
  if (typeName && visitedTypes.has(typeName)) {
    // Already analyzing this type, return empty to break cycle
    return requirements;
  }

  if (typeName) {
    visitedTypes.add(typeName);
  }

  // Walk all fields, looking for computed field targets
  const fields = getTypeFields(typeDef);
  for (const field of fields) {
    const fieldAny = field as any;

    if (fieldAny.computed?.target) {
      analyzeComputedPath(fieldAny.computed.target, requirements);
    }

    // Recursively analyze nested type references
    if (fieldAny.type && typeof fieldAny.type === 'string' && schema.types[fieldAny.type]) {
      const nestedReqs = analyzeContextRequirements(
        schema.types[fieldAny.type],
        schema,
        visitedTypes
      );
      mergeRequirements(requirements, nestedReqs);
    }

    // Handle array items that might be type references
    if (fieldAny.type === 'array' && fieldAny.items) {
      if (fieldAny.items.type && typeof fieldAny.items.type === 'string' && schema.types[fieldAny.items.type]) {
        const nestedReqs = analyzeContextRequirements(
          schema.types[fieldAny.items.type],
          schema,
          visitedTypes
        );
        mergeRequirements(requirements, nestedReqs);
      }

      // Handle choice items
      if (fieldAny.items.type === 'choice' && fieldAny.items.choices) {
        for (const choice of fieldAny.items.choices) {
          if (choice.type && schema.types[choice.type]) {
            const nestedReqs = analyzeContextRequirements(
              schema.types[choice.type],
              schema,
              visitedTypes
            );
            mergeRequirements(requirements, nestedReqs);
          }
        }
      }
    }

    // Handle choice fields
    if (fieldAny.type === 'choice' && fieldAny.choices) {
      for (const choice of fieldAny.choices) {
        if (choice.type && schema.types[choice.type]) {
          const nestedReqs = analyzeContextRequirements(
            schema.types[choice.type],
            schema,
            visitedTypes
          );
          mergeRequirements(requirements, nestedReqs);
        }
      }
    }
  }

  return requirements;
}

/**
 * Analyze a computed field path to extract context requirements
 */
function analyzeComputedPath(path: string, requirements: ContextRequirements): void {
  // Check for parent navigation (../)
  if (path.includes('../')) {
    requirements.usesParentNavigation = true;

    // Extract parent field names from path
    // Pattern: ../field_name or ../../field_name/sub_field
    const parentFieldMatches = path.matchAll(/\.\.\/([a-zA-Z_][a-zA-Z0-9_]*)/g);
    for (const match of parentFieldMatches) {
      requirements.needsParentFields.add(match[1]);
    }
  }

  // Check for array correlation patterns
  if (path.includes('[corresponding<') || path.includes('[first<') || path.includes('[last<')) {
    // Extract array name that precedes the correlation selector
    // Pattern: array_name[corresponding<Type>] or ../array_name[first<Type>]
    const arrayMatches = path.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\[(?:corresponding|first|last)</g);
    for (const match of arrayMatches) {
      requirements.needsArrayIterations.add(match[1]);
    }
  }
}

/**
 * Merge nested requirements into parent requirements
 */
function mergeRequirements(target: ContextRequirements, source: ContextRequirements): void {
  source.needsParentFields.forEach(f => target.needsParentFields.add(f));
  source.needsArrayIterations.forEach(a => target.needsArrayIterations.add(a));
  target.usesParentNavigation ||= source.usesParentNavigation;
}

/**
 * Find the type name for a type definition
 */
function findTypeNameForDef(typeDef: TypeDef, schema: BinarySchema): string | null {
  for (const [name, def] of Object.entries(schema.types)) {
    if (def === typeDef) {
      return name;
    }
  }
  return null;
}

/**
 * Check if entire schema requires context
 */
export function schemaRequiresContext(schema: BinarySchema): boolean {
  return Object.values(schema.types).some(typeDef => {
    const reqs = analyzeContextRequirements(typeDef, schema);
    return reqs.usesParentNavigation || reqs.needsArrayIterations.size > 0;
  });
}

/**
 * Get all context requirements for an entire schema
 */
export function analyzeSchemaContextRequirements(schema: BinarySchema): ContextRequirements {
  const globalRequirements: ContextRequirements = {
    needsParentFields: new Set(),
    needsArrayIterations: new Set(),
    usesParentNavigation: false
  };

  for (const typeDef of Object.values(schema.types)) {
    const typeReqs = analyzeContextRequirements(typeDef, schema);
    mergeRequirements(globalRequirements, typeReqs);
  }

  return globalRequirements;
}

/**
 * Information about a field's TypeScript type for context generation
 */
interface FieldTypeInfo {
  fieldName: string;
  tsType: string;  // TypeScript type (e.g., "ZipSection[]", "Header")
}

/**
 * Find all types in the schema that contain a given field name
 * Returns the TypeScript type for that field
 */
function findFieldTypeInSchema(fieldName: string, schema: BinarySchema): string {
  // Search all types for a field with this name
  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    const fields = getTypeFields(typeDef);
    for (const field of fields) {
      const fieldAny = field as any;
      if (fieldAny.name === fieldName) {
        // Found the field, determine its TypeScript type
        return inferTypeScriptType(fieldAny, schema);
      }
    }
  }

  // Field not found, use generic type
  return 'any';
}

/**
 * Infer the TypeScript type for a field
 */
function inferTypeScriptType(field: any, schema: BinarySchema): string {
  if (field.type === 'array') {
    // Determine element type
    if (field.items?.type === 'choice') {
      // Choice array - need to generate a union type
      const choiceTypes = field.items.choices?.map((c: any) => c.type).filter(Boolean) || [];
      if (choiceTypes.length > 0) {
        return `(${choiceTypes.join(' | ')})[]`;
      }
      return 'any[]';
    } else if (field.items?.type && schema.types[field.items.type]) {
      // Type reference array
      return `${field.items.type}[]`;
    } else if (field.items?.type) {
      // Primitive array
      return mapPrimitiveToTS(field.items.type) + '[]';
    }
    return 'any[]';
  } else if (field.type === 'choice') {
    // Choice field - union of types
    const choiceTypes = field.choices?.map((c: any) => c.type).filter(Boolean) || [];
    if (choiceTypes.length > 0) {
      return choiceTypes.join(' | ');
    }
    return 'any';
  } else if (schema.types[field.type]) {
    // Type reference
    return field.type;
  } else {
    // Primitive type
    return mapPrimitiveToTS(field.type);
  }
}

/**
 * Map primitive binary types to TypeScript types
 */
function mapPrimitiveToTS(type: string): string {
  switch (type) {
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'int8':
    case 'int16':
    case 'int32':
    case 'bit':
      return 'number';
    case 'uint64':
    case 'int64':
      return 'bigint';
    case 'string':
      return 'string';
    case 'bytes':
      return 'Uint8Array';
    default:
      return 'any';
  }
}

/**
 * Generate the EncodingContext interface TypeScript code
 */
export function generateContextInterface(schema: BinarySchema): string {
  const requirements = analyzeSchemaContextRequirements(schema);

  // If no context needed, don't generate interface
  if (!requirements.usesParentNavigation && requirements.needsArrayIterations.size === 0) {
    return '';
  }

  let code = 'interface EncodingContext {\n';

  // Generate parent fields section
  if (requirements.needsParentFields.size > 0) {
    code += '  parents: Array<{\n';
    for (const fieldName of Array.from(requirements.needsParentFields).sort()) {
      const fieldType = findFieldTypeInSchema(fieldName, schema);
      code += `    ${fieldName}?: ${fieldType};\n`;
    }
    code += '  }>;\n';
  }

  // Generate array iterations section
  if (requirements.needsArrayIterations.size > 0) {
    code += '  arrayIterations: {\n';
    for (const arrayName of Array.from(requirements.needsArrayIterations).sort()) {
      const arrayType = findFieldTypeInSchema(arrayName, schema);
      code += `    ${arrayName}?: {\n`;
      code += `      items: ${arrayType};\n`;
      code += `      index: number;\n`;
      code += `      fieldName: string;\n`;
      code += `      typeIndices: Map<string, number>;\n`;
      code += `    };\n`;
    }
    code += '  };\n';
  }

  // Add position tracking for corresponding/first/last selectors
  code += '  // Position tracking for corresponding/first/last array selectors\n';
  code += '  positions: Map<string, number[]>;\n';

  code += '}\n\n';

  // Generate EMPTY_CONTEXT constant
  code += 'const EMPTY_CONTEXT: EncodingContext = {\n';
  if (requirements.needsParentFields.size > 0) {
    code += '  parents: [],\n';
  }
  if (requirements.needsArrayIterations.size > 0) {
    code += '  arrayIterations: {},\n';
  }
  code += '  positions: new Map(),\n';
  code += '};\n\n';

  return code;
}
