#!/usr/bin/env node
/**
 * Standalone TS decode profiling script for use with Node.js profilers.
 *
 * Prerequisite: run `bun benchmarks/profile-ts-decode.ts` first to generate
 * the decoder code in .generated-bench/BinSchemaDnsProfile.ts
 *
 * Usage with 0x:
 *   0x benchmarks/profile-ts-standalone.mjs
 *
 * Usage with --prof:
 *   node --prof benchmarks/profile-ts-standalone.mjs
 *   node --prof-process isolate-*.log > profile-ts.txt
 */

import { pathToFileURL } from "url";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ITERATIONS = 1_000_000;
const WARMUP = 10_000;

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
  // Import from pre-generated file
  const genFile = resolve(__dirname, ".generated-bench", "BinSchemaDnsProfile.js");
  const module = await import(pathToFileURL(genFile).href);
  const DecoderClass = module.DnsMessageDecoder;

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    new DecoderClass(queryPacket).decode();
    new DecoderClass(responsePacket).decode();
  }

  // Query decode
  console.log(`Query decode: ${ITERATIONS.toLocaleString()} iterations...`);
  const qStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    new DecoderClass(queryPacket).decode();
  }
  const qMs = performance.now() - qStart;
  console.log(`  ${qMs.toFixed(0)}ms total, ${((qMs * 1_000_000) / ITERATIONS).toFixed(0)} ns/op`);

  // Response decode
  console.log(`Response decode: ${ITERATIONS.toLocaleString()} iterations...`);
  const rStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    new DecoderClass(responsePacket).decode();
  }
  const rMs = performance.now() - rStart;
  console.log(`  ${rMs.toFixed(0)}ms total, ${((rMs * 1_000_000) / ITERATIONS).toFixed(0)} ns/op`);
}

main().catch(console.error);
