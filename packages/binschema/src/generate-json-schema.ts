// ABOUTME: Generate JSON Schema from BinSchema's Zod schema definitions
// ABOUTME: Enables IDE autocomplete for .schema.json files in VS Code

import { zodToJsonSchema } from "zod-to-json-schema";
import { BinarySchemaSchema } from "./schema/binary-schema.js";
import { writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Generate JSON Schema for BinSchema files
 */
function main() {
  console.log("Generating JSON Schema from BinSchema Zod definitions...\n");

  // Convert Zod schema to JSON Schema
  const jsonSchema = zodToJsonSchema(BinarySchemaSchema, {
    name: "BinSchema",
    $refStrategy: "none", // Inline all definitions for better IDE support
  });

  // Add schema metadata
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://binschema.net/schema.json",
    title: "BinSchema",
    description: "Binary protocol schema definition for BinSchema. Define binary formats with bit-level precision and generate parsers for TypeScript, Go, and Rust.",
    ...jsonSchema,
  };

  // Write to file
  const outputPath = resolve(process.cwd(), "binschema.schema.json");
  writeFileSync(outputPath, JSON.stringify(schema, null, 2), "utf-8");

  console.log(`✓ Generated JSON Schema: ${outputPath}`);
  console.log(`\nTo use in VS Code, add to your settings.json:`);
  console.log(`{
  "json.schemas": [
    {
      "fileMatch": ["*.schema.json"],
      "url": "./binschema.schema.json"
    }
  ]
}`);
  console.log(`\nOr add to your schema file:`);
  console.log(`{
  "$schema": "https://raw.githubusercontent.com/anthropics/binschema/main/binschema.schema.json",
  ...
}`);
}

// Run if executed directly
main();
