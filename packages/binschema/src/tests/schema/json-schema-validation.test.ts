// ABOUTME: Tests for JSON Schema validation of BinSchema files
// ABOUTME: Ensures binschema.schema.json correctly validates example schemas

import Ajv from "ajv";
import addFormats from "ajv-formats";
import JSON5 from "json5";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

export function runJsonSchemaValidationTests(): { passed: number; failed: number; checks: TestCheck[] } {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];

  // Load the JSON Schema
  const schemaPath = resolve(__dirname, "../../../../../binschema.schema.json");
  let schema: any;
  try {
    schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Load binschema.schema.json",
      passed: false,
      message: `Failed to load schema: ${error.message}`
    });
    return { passed, failed, checks };
  }
  passed++;
  checks.push({ description: "Load binschema.schema.json", passed: true });

  // Initialize AJV
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  
  let validate: any;
  try {
    validate = ajv.compile(schema);
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Compile JSON Schema",
      passed: false,
      message: `Schema compilation failed: ${error.message}`
    });
    return { passed, failed, checks };
  }
  passed++;
  checks.push({ description: "Compile JSON Schema", passed: true });

  // Test example schemas (supports both .schema.json and .bschema.json)
  const examplesDir = resolve(__dirname, "../../../../../examples");
  const exampleFiles = readdirSync(examplesDir).filter(f =>
    f.endsWith(".schema.json") || f.endsWith(".bschema.json")
  );

  for (const file of exampleFiles) {
    const filePath = join(examplesDir, file);
    try {
      // Use JSON5 to parse files that may have comments
      const content = JSON5.parse(readFileSync(filePath, "utf-8"));
      const valid = validate(content);
      
      if (valid) {
        passed++;
        checks.push({
          description: `Validate examples/${file}`,
          passed: true
        });
      } else {
        failed++;
        const errors = validate.errors?.slice(0, 3).map((e: any) => 
          `${e.instancePath}: ${e.message}`
        ).join("; ");
        checks.push({
          description: `Validate examples/${file}`,
          passed: false,
          message: errors || "Unknown validation error"
        });
      }
    } catch (error: any) {
      failed++;
      checks.push({
        description: `Validate examples/${file}`,
        passed: false,
        message: `Parse error: ${error.message}`
      });
    }
  }

  // Test valid minimal schema
  const minimalSchema = {
    config: { endianness: "big_endian" },
    types: {
      "SimpleMessage": {
        sequence: [
          { name: "id", type: "uint8" },
          { name: "value", type: "uint16" }
        ]
      }
    }
  };

  if (validate(minimalSchema)) {
    passed++;
    checks.push({ description: "Validate minimal valid schema", passed: true });
  } else {
    failed++;
    const errors = validate.errors?.slice(0, 3).map((e: any) => 
      `${e.instancePath}: ${e.message}`
    ).join("; ");
    checks.push({
      description: "Validate minimal valid schema",
      passed: false,
      message: errors
    });
  }

  // Test invalid schemas are rejected
  const invalidSchemas = [
    {
      name: "missing config",
      schema: { types: { "Test": { sequence: [] } } },
      expectedError: "config"
    },
    {
      name: "missing types",
      schema: { config: { endianness: "big_endian" } },
      expectedError: "types"
    },
    {
      name: "invalid endianness value",
      schema: { 
        config: { endianness: "invalid" }, 
        types: { "Test": { sequence: [] } } 
      },
      expectedError: "endianness"
    },
    {
      name: "invalid field type",
      schema: {
        config: { endianness: "big_endian" },
        types: {
          "Test": {
            sequence: [
              { name: "x", type: "invalid_type_xyz" }
            ]
          }
        }
      },
      expectedError: "type"
    }
  ];

  for (const { name, schema: testSchema, expectedError } of invalidSchemas) {
    const valid = validate(testSchema);
    if (!valid) {
      passed++;
      checks.push({
        description: `Reject invalid schema: ${name}`,
        passed: true
      });
    } else {
      failed++;
      checks.push({
        description: `Reject invalid schema: ${name}`,
        passed: false,
        message: `Schema should have been rejected (expected error about: ${expectedError})`
      });
    }
  }

  // Test various field types
  const fieldTypeTests = [
    { type: "uint8", extra: {} },
    { type: "uint16", extra: { endianness: "little_endian" } },
    { type: "uint32", extra: {} },
    { type: "uint64", extra: {} },
    { type: "int8", extra: {} },
    { type: "int16", extra: {} },
    { type: "int32", extra: {} },
    { type: "int64", extra: {} },
    { type: "float32", extra: {} },
    { type: "float64", extra: {} },
    { type: "bit", extra: { size: 4 } },
    { type: "string", extra: { kind: "null_terminated" } },
    { type: "array", extra: { items: "uint8", kind: "fixed", count: 10 } },
    { type: "varlength", extra: { encoding: "leb128" } },
    { type: "optional", extra: { inner_type: "uint8" } },
  ];

  for (const { type, extra } of fieldTypeTests) {
    const testSchema = {
      config: { endianness: "big_endian" },
      types: {
        "Test": {
          sequence: [
            { name: "field", type, ...extra }
          ]
        }
      }
    };

    const valid = validate(testSchema);
    if (valid) {
      passed++;
      checks.push({
        description: `Accept field type: ${type}`,
        passed: true
      });
    } else {
      failed++;
      const errors = validate.errors?.slice(0, 2).map((e: any) => 
        `${e.instancePath}: ${e.message}`
      ).join("; ");
      checks.push({
        description: `Accept field type: ${type}`,
        passed: false,
        message: errors
      });
    }
  }

  return { passed, failed, checks };
}
