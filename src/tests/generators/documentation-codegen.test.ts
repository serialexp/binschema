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

    const checkSpecs: Array<{ description: string; snippet?: string; pattern?: RegExp }> = [
      {
        description: "built-in primitive metadata (uint8)",
        pattern: /\* Number of items[\s\S]*?\* @remarks\n\*\n\* 8-bit Unsigned Integer/,
      },
      {
        description: "array configuration details",
        snippet: "* Array kind: field_referenced (length from 'count')",
      },
      {
        description: "array metadata separated by blank line",
        snippet: "* Collection of elements of the same type. Supports fixed-length, length-prefixed, field-referenced, and null-terminated arrays.\n*\n* @remarks\n*\n* Array kind: field_referenced",
      },
      {
        description: "string alias detailed metadata",
        snippet: "* @remarks\n*\n* String",
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
          failed++;
          checks.push({
            description: checkSpec.description,
            passed: false,
            message: `Missing pattern: ${checkSpec.pattern}`
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
        failed++;
        checks.push({
          description: checkSpec.description,
          passed: false,
          message: `Missing snippet: "${checkSpec.snippet}"`
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
