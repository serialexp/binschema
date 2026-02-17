#!/usr/bin/env bun
/**
 * Generate Rust code from DNS schema for benchmarking.
 * Outputs to benchmarks/rust-compare/src/dns_message.rs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { generateRust } from "../packages/binschema/src/generators/rust.js";
import type { BinarySchema } from "../packages/binschema/src/schema/binary-schema.js";

const schemaPath = resolve(__dirname, "../packages/binschema/src/tests/protocols/dns-complete-message.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as BinarySchema;

const result = generateRust(schema, "DnsMessage");

const outDir = join(__dirname, "rust-compare", "src");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "dns_message.rs"), result.code);

console.log("Generated Rust DNS code to benchmarks/rust-compare/src/dns_message.rs");
console.log(`Code size: ${result.code.length} bytes`);
