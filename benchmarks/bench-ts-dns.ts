#!/usr/bin/env bun
/**
 * TypeScript DNS encode/decode benchmark.
 * Matches the same packets used in Go and Rust benchmarks.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { generateTypeScript } from "../packages/binschema/src/generators/typescript.js";

const ITERATIONS = 100_000;
const WARMUP = 1_000;

const DNS_QUERY_PACKET = new Uint8Array([
  0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x07, 0x65, 0x78, 0x61,
  0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
  0x00, 0x00, 0x01, 0x00, 0x01,
]);

const DNS_RESPONSE_PACKET = new Uint8Array([
  0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x07, 0x65, 0x78, 0x61,
  0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
  0x00, 0x00, 0x01, 0x00, 0x01, 0xc0, 0x0c, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x0e, 0x10, 0x00,
  0x04, 0x5d, 0xb8, 0xd8, 0x22,
]);

function formatNs(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(1)} ns`;
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(2)} µs`;
  return `${(ns / 1_000_000).toFixed(2)} ms`;
}

async function main() {
  // Load and generate
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

  const genDir = join(process.cwd(), ".generated-bench");
  mkdirSync(genDir, { recursive: true });
  const genFile = join(genDir, "BinSchemaDns.ts");
  writeFileSync(genFile, generatedCode);

  const mod = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);
  const Decoder = mod.DnsMessageDecoder;
  const Encoder = mod.DnsMessageEncoder;

  // Verify roundtrip
  const queryValue = new Decoder(DNS_QUERY_PACKET).decode();
  const responseValue = new Decoder(DNS_RESPONSE_PACKET).decode();

  console.log(`Query:    id=0x${queryValue.id.toString(16)}, qdcount=${queryValue.qdcount}`);
  console.log(`Response: id=0x${responseValue.id.toString(16)}, ancount=${responseValue.ancount}`);

  console.log(`\nIterations: ${ITERATIONS.toLocaleString()}, Warmup: ${WARMUP.toLocaleString()}\n`);

  // --- Query Decode ---
  for (let i = 0; i < WARMUP; i++) new Decoder(DNS_QUERY_PACKET).decode();
  let start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) new Decoder(DNS_QUERY_PACKET).decode();
  let elapsed = performance.now() - start;
  const queryDecodeNs = (elapsed * 1_000_000) / ITERATIONS;

  // --- Query Encode ---
  for (let i = 0; i < WARMUP; i++) new Encoder().encode(queryValue);
  start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) new Encoder().encode(queryValue);
  elapsed = performance.now() - start;
  const queryEncodeNs = (elapsed * 1_000_000) / ITERATIONS;

  // --- Response Decode ---
  for (let i = 0; i < WARMUP; i++) new Decoder(DNS_RESPONSE_PACKET).decode();
  start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) new Decoder(DNS_RESPONSE_PACKET).decode();
  elapsed = performance.now() - start;
  const responseDecodeNs = (elapsed * 1_000_000) / ITERATIONS;

  // --- Response Encode ---
  for (let i = 0; i < WARMUP; i++) new Encoder().encode(responseValue);
  start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) new Encoder().encode(responseValue);
  elapsed = performance.now() - start;
  const responseEncodeNs = (elapsed * 1_000_000) / ITERATIONS;

  // Results
  console.log("BinSchema TypeScript DNS Benchmark");
  console.log("=".repeat(55));
  console.log(`${"Packet".padEnd(20)} ${"Decode".padStart(15)} ${"Encode".padStart(15)}`);
  console.log("-".repeat(55));
  console.log(`${"Query (29 bytes)".padEnd(20)} ${formatNs(queryDecodeNs).padStart(15)} ${formatNs(queryEncodeNs).padStart(15)}`);
  console.log(`${"Response (45 bytes)".padEnd(20)} ${formatNs(responseDecodeNs).padStart(15)} ${formatNs(responseEncodeNs).padStart(15)}`);
}

main().catch(console.error);
