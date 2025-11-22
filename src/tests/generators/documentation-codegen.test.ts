/**
 * Documentation Code Generation Tests
 *
 * Ensures that generated TypeScript includes metadata-driven JSDoc comments.
 */

import { generateTypeScript } from "../../generators/typescript";
import { type BinarySchema } from "../../schema/binary-schema";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

export function runDocumentationCodegenTests(): { passed: number; failed: number; checks: TestCheck[] } {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];

  const schema: BinarySchema = {
    config: {
      endianness: "big_endian",
    },
    types: {
      "String": {
        description: "Length-prefixed UTF-8 string",
        type: "string",
        kind: "length_prefixed",
        length_type: "uint16",
        encoding: "utf8",
      },
      "Example": {
        description: "Example structure using built-in and composite types",
        sequence: [
          { name: "count", type: "uint8", description: "Number of items" },
          {
            name: "payload",
            type: "array",
            kind: "field_referenced",
            length_field: "count",
            items: { type: "String" },
          } as any,
        ],
      },
    },
  };

  try {
    const code = generateTypeScript(schema);
    const normalizedCode = code.replace(/\r\n/g, "\n").replace(/^ +/gm, "");

    const checkSpecs: Array<{ description: string; snippet?: string; pattern?: RegExp; context?: string }> = [
      {
        description: "field description included",
        snippet: "* Number of items",
      },
      {
        description: "array configuration details",
        snippet: "* Array kind: field_referenced (length from 'count')",
      },
      {
        description: "array field has documentation",
        snippet: "* Array kind: field_referenced",
      },
      {
        description: "string type has remarks section",
        snippet: "* @remarks",
      },
      {
        description: "string alias encoding metadata",
        snippet: "* Encoding: utf8",
      },
    ];

    for (const checkSpec of checkSpecs) {
      if (checkSpec.pattern) {
        if (checkSpec.pattern.test(normalizedCode)) {
          passed++;
          checks.push({
            description: checkSpec.description,
            passed: true
          });
        } else {
          // Extract the actual content for comparison
          let actualContent = "";
          if (checkSpec.context === "count field") {
            // Find the Example interface, then extract count field JSDoc
            const exampleMatch = normalizedCode.match(/export interface Example \{[\s\S]*?\}/);
            if (exampleMatch) {
              const countMatch = exampleMatch[0].match(/\/\*\*[\s\S]*?\*\/\s*count:\s*number/);
              actualContent = countMatch ? countMatch[0] : "count field JSDoc not found in Example interface";
            } else {
              actualContent = "Example interface not found";
            }
          }

          failed++;
          checks.push({
            description: checkSpec.description,
            passed: false,
            message: `Pattern not found.\n\nExpected pattern: ${checkSpec.pattern}\n\nActual content:\n${actualContent}`
          });
        }
        continue;
      }

      if (normalizedCode.includes(checkSpec.snippet!)) {
        passed++;
        checks.push({
          description: checkSpec.description,
          passed: true
        });
      } else {
        // Extract the actual content for comparison
        let actualContent = "";
        if (checkSpec.context === "payload field") {
          // Find the Example interface, then extract payload field JSDoc
          const exampleMatch = normalizedCode.match(/export interface Example \{[\s\S]*?\}/);
          if (exampleMatch) {
            const payloadMatch = exampleMatch[0].match(/\/\*\*[\s\S]*?\*\/\s*payload:\s*String\[\]/);
            actualContent = payloadMatch ? payloadMatch[0] : "payload field JSDoc not found in Example interface";
          } else {
            actualContent = "Example interface not found";
          }
        }

        failed++;
        checks.push({
          description: checkSpec.description,
          passed: false,
          message: `Snippet not found.\n\nExpected:\n${checkSpec.snippet}\n\nActual content:\n${actualContent}`
        });
      }
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Documentation code generation",
      passed: false,
      message: `Generation failed: ${error?.message ?? error}`
    });
  }

  return { passed, failed, checks };
}
