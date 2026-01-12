#!/usr/bin/env bun
/**
 * Generate Go code from BinSchema DNS schema
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { generateGo } from "../packages/binschema/src/generators/go.js";
import type { BinarySchema } from "../packages/binschema/src/schema/binary-schema.js";

async function main() {
  const schemaPath = resolve(__dirname, "../packages/binschema/src/tests/protocols/dns-complete-message.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as BinarySchema;

  console.log("Generating BinSchema DNS decoder for Go...");

  const result = generateGo(schema, "DnsMessage", {
    packageName: "binschema",
    runtimeImport: "github.com/anthropics/binschema/runtime",
  });

  // Create output directory
  const genDir = join(process.cwd(), ".generated-bench/go-binschema");
  mkdirSync(genDir, { recursive: true });

  // Write generated file
  const outPath = join(genDir, "dns_message.go");
  writeFileSync(outPath, result.code);
  console.log(`  Generated: dns_message.go`);

  console.log("\nDone! Generated files in:", genDir);
}

main().catch(console.error);
