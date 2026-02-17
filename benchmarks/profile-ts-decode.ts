#!/usr/bin/env bun
/**
 * TypeScript DNS decode profiling.
 *
 * Usage:
 *   bun benchmarks/profile-ts-decode.ts                    # Quick run from Bun
 *   node --prof benchmarks/.generated-bench/profile-ts.mjs  # Node V8 profiler
 *   node --prof benchmarks/.generated-bench/profile-ts.mjs && \
 *     node --prof-process isolate-*.log > profile-ts.txt    # Text profile
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { generateTypeScript } from "../packages/binschema/src/generators/typescript.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ITERATIONS = 1_000_000;
const WARMUP = 10_000;

// Same DNS packets as Go and Rust benchmarks
const queryPacket = new Uint8Array([
  0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x07, 0x65, 0x78, 0x61,
  0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
  0x00, 0x00, 0x01, 0x00, 0x01,
]);

const responsePacket = new Uint8Array([
  0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x07, 0x65, 0x78, 0x61,
  0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
  0x00, 0x00, 0x01, 0x00, 0x01, 0xc0, 0x0c, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x0e, 0x10, 0x00,
  0x04, 0x5d, 0xb8, 0xd8, 0x22,
]);

async function main() {
  // Generate decoder
  const schemaPath = resolve(__dirname, "../packages/binschema/src/tests/protocols/dns-complete-message.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

  let generatedCode = generateTypeScript(schema as any);

  const runtimeDir = resolve(__dirname, "../packages/binschema/src/runtime");
  generatedCode = generatedCode
    .replace(/from "\.\/bit-stream\.js"/g, `from "${runtimeDir}/bit-stream.js"`)
    .replace(/from "\.\/seekable-bit-stream\.js"/g, `from "${runtimeDir}/seekable-bit-stream.js"`)
    .replace(/from "\.\/binary-reader\.js"/g, `from "${runtimeDir}/binary-reader.js"`)
    .replace(/from "\.\/crc32\.js"/g, `from "${runtimeDir}/crc32.js"`)
    .replace(/from "\.\/expression-evaluator\.js"/g, `from "${runtimeDir}/expression-evaluator.js"`);

  const genDir = join(__dirname, ".generated-bench");
  mkdirSync(genDir, { recursive: true });
  const genFile = join(genDir, "BinSchemaDnsProfile.ts");
  writeFileSync(genFile, generatedCode);

  const module = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);
  const DecoderClass = module.DnsMessageDecoder;

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    new DecoderClass(queryPacket).decode();
    new DecoderClass(responsePacket).decode();
  }

  // Profile: Query decode
  console.log(`Query decode: ${ITERATIONS.toLocaleString()} iterations...`);
  const qStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    new DecoderClass(queryPacket).decode();
  }
  const qMs = performance.now() - qStart;
  console.log(`  ${qMs.toFixed(0)}ms total, ${((qMs * 1_000_000) / ITERATIONS).toFixed(0)} ns/op`);

  // Profile: Response decode
  console.log(`Response decode: ${ITERATIONS.toLocaleString()} iterations...`);
  const rStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    new DecoderClass(responsePacket).decode();
  }
  const rMs = performance.now() - rStart;
  console.log(`  ${rMs.toFixed(0)}ms total, ${((rMs * 1_000_000) / ITERATIONS).toFixed(0)} ns/op`);
}

main().catch(console.error);
