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
 * @returns Generated TypeScript code that creates extended context
 */
export function generateArrayContextExtension(
  fieldName: string,
  valuePath: string,
  itemVar: string,
  indexVar: string,
  indent: string,
  schema: BinarySchema
): string {
  if (!schemaRequiresContext(schema)) {
    return ''; // No context extension needed
  }

  let code = `${indent}// Extend context for array iteration\n`;
  code += `${indent}const extendedContext: EncodingContext = {\n`;
  code += `${indent}  ...context,\n`;
  code += `${indent}  parents: [\n`;
  code += `${indent}    ...context.parents,\n`;
  code += `${indent}    { ${fieldName}: ${valuePath} }\n`;
  code += `${indent}  ],\n`;
  code += `${indent}  arrayIterations: {\n`;
  code += `${indent}    ...context.arrayIterations,\n`;
  code += `${indent}    ${fieldName}: {\n`;
  code += `${indent}      items: ${valuePath},\n`;
  code += `${indent}      index: ${indexVar},\n`;
  code += `${indent}      fieldName: '${fieldName}'\n`;
  code += `${indent}    }\n`;
  code += `${indent}  }\n`;
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
 * @returns Generated TypeScript code that creates extended context
 */
export function generateNestedTypeContextExtension(
  parentFieldName: string,
  parentValue: string,
  indent: string,
  schema: BinarySchema
): string {
  if (!schemaRequiresContext(schema)) {
    return ''; // No context extension needed
  }

  let code = `${indent}// Extend context with parent field reference\n`;
  code += `${indent}const extendedContext: EncodingContext = {\n`;
  code += `${indent}  ...context,\n`;
  code += `${indent}  parents: [\n`;
  code += `${indent}    ...context.parents,\n`;
  code += `${indent}    { ${parentFieldName}: ${parentValue}.${parentFieldName} }\n`;
  code += `${indent}  ]\n`;
  code += `${indent}};\n`;

  return code;
}

/**
 * Get the context parameter to pass to encoder calls
 * Returns ", extendedContext" if context is available, empty string otherwise
 *
 * @param schema - Binary schema for context analysis
 * @param useExtended - Whether to use extended context (true) or base context (false)
 * @returns Context parameter string for encoder calls
 */
export function getContextParam(schema: BinarySchema, useExtended: boolean = true): string {
  if (!schemaRequiresContext(schema)) {
    return '';
  }
  return useExtended ? ', extendedContext' : ', context';
}
