// ABOUTME: Generates code for extending encoding context with parent/array state
// ABOUTME: Used when encoding arrays and nested types to provide context to child encoders

import type { BinarySchema } from "../../schema/binary-schema.js";
import { analyzeContextRequirements, schemaRequiresContext } from "./context-analysis.js";

/**
 * Generate code to extend context when entering an array iteration
 *
 * @param fieldName - Name of the array field being iterated
 * @param valuePath - Path to the array value (e.g., "value.sections")
 * @param itemVar - Variable name for the current item
 * @param indexVar - Variable name for the current index
 * @param indent - Indentation for generated code
 * @param schema - Binary schema for context analysis
 * @param isChoiceArray - Whether this array contains choice types
 * @param choiceTypes - Array of choice type names (if isChoiceArray is true)
 * @returns Generated TypeScript code that creates extended context
 */
export function generateArrayContextExtension(
  fieldName: string,
  valuePath: string,
  itemVar: string,
  indexVar: string,
  indent: string,
  schema: BinarySchema,
  isChoiceArray: boolean = false,
  choiceTypes: string[] = [],
  baseContextVar: string = 'context'
): string {
  if (!schemaRequiresContext(schema)) {
    return ''; // No context extension needed
  }

  // Use field-specific variable name to avoid redeclaration when multiple arrays exist
  const contextVarName = `extendedContext_${fieldName}`;

  // Extract parent object path (e.g., "value.messages" -> "value")
  const lastDot = valuePath.lastIndexOf('.');
  const parentPath = lastDot >= 0 ? valuePath.substring(0, lastDot) : valuePath;

  let code = `${indent}// Extend context for array iteration\n`;
  code += `${indent}const ${contextVarName}: EncodingContext = {\n`;
  code += `${indent}  ...${baseContextVar},\n`;
  code += `${indent}  parents: [\n`;
  code += `${indent}    ...${baseContextVar}.parents,\n`;
  // Pass entire parent object so nested types can access sibling fields
  code += `${indent}    ${parentPath}\n`;
  code += `${indent}  ],\n`;
  code += `${indent}  arrayIterations: {\n`;
  code += `${indent}    ...${baseContextVar}.arrayIterations,\n`;
  code += `${indent}    ${fieldName}: {\n`;
  code += `${indent}      items: ${valuePath},\n`;
  code += `${indent}      index: ${indexVar},\n`;
  code += `${indent}      fieldName: '${fieldName}',\n`;

  // Reference the persistent typeIndices Map (initialized before loop)
  if (isChoiceArray && choiceTypes.length > 0) {
    code += `${indent}      typeIndices: ${valuePath.replace(/\./g, "_")}_typeIndices\n`;
  } else {
    code += `${indent}      typeIndices: new Map<string, number>()\n`;
  }

  code += `${indent}    }\n`;
  code += `${indent}  },\n`;
  code += `${indent}  // Positions map is shared (not copied) so updates are visible to all\n`;
  code += `${indent}  positions: ${baseContextVar}.positions\n`;
  code += `${indent}};\n`;

  return code;
}

/**
 * Generate code to extend context when encoding a nested type
 *
 * @param parentFieldName - Name of the parent field containing this nested type
 * @param parentValue - Value path to the parent (e.g., "value")
 * @param indent - Indentation for generated code
 * @param schema - Binary schema for context analysis
 * @param baseContextVarName - Name of the context variable to extend from (defaults to 'context')
 * @returns Generated TypeScript code that creates extended context
 */
export function generateNestedTypeContextExtension(
  parentFieldName: string,
  parentValue: string,
  indent: string,
  schema: BinarySchema,
  baseContextVarName: string = 'context'
): string {
  if (!schemaRequiresContext(schema)) {
    return ''; // No context extension needed
  }

  // Use field-specific variable name to avoid redeclaration when multiple nested types exist
  const contextVarName = `extendedContext_${parentFieldName}`;

  let code = `${indent}// Extend context with parent field reference\n`;
  code += `${indent}const ${contextVarName}: EncodingContext = {\n`;
  code += `${indent}  ...${baseContextVarName},\n`;
  code += `${indent}  parents: [\n`;
  code += `${indent}    ...${baseContextVarName}.parents,\n`;
  // Pass entire parent object so nested types can access sibling fields via ../
  code += `${indent}    ${parentValue}\n`;
  code += `${indent}  ],\n`;
  code += `${indent}  arrayIterations: ${baseContextVarName}.arrayIterations,\n`;
  code += `${indent}  positions: ${baseContextVarName}.positions\n`;
  code += `${indent}};\n`;

  return code;
}

/**
 * Get the context variable name for a specific array field
 * Used to reference the correct context when multiple arrays exist in same scope
 */
export function getContextVarName(fieldName: string): string {
  return `extendedContext_${fieldName}`;
}

/**
 * Get the context parameter to pass to encoder calls
 * Returns ", extendedContext" if context is available, empty string otherwise
 *
 * @param schema - Binary schema for context analysis
 * @param useExtended - Whether to use extended context (true) or base context (false)
 * @param fieldName - Optional field name for field-specific context (e.g., array iteration)
 * @returns Context parameter string for encoder calls
 */
export function getContextParam(schema: BinarySchema, useExtended: boolean = true, fieldName?: string): string {
  if (!schemaRequiresContext(schema)) {
    return '';
  }

  if (fieldName) {
    return `, extendedContext_${fieldName}`;
  }

  return useExtended ? ', extendedContext' : ', context';
}
