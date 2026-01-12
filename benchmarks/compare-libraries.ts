#!/usr/bin/env bun
/**
 * Library Comparison Benchmark
 *
 * Compares BinSchema against other binary serialization libraries:
 * - Protocol Buffers (protobufjs)
 * - MessagePack (@msgpack/msgpack)
 * - JSON (baseline)
 *
 * Note: BinSchema is designed for parsing existing binary protocols with
 * bit-level precision, while protobuf/msgpack are general-purpose serialization.
 * This comparison shows relative performance for similar data structures.
 */

import protobuf from "protobufjs";
import { encode as msgpackEncode, decode as msgpackDecode } from "@msgpack/msgpack";
import { writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { generateTypeScript } from "../packages/binschema/src/generators/typescript.js";

// Test data structure (similar to go_serialization_benchmarks)
interface TestStruct {
  name: string;
  id: number;
  email: string;
  active: boolean;
  score: number;
}

const testData: TestStruct = {
  name: "John Doe",
  id: 12345,
  email: "john.doe@example.com",
  active: true,
  score: 98.6
};

// Iterations for benchmarking
const ITERATIONS = 100000;
const WARMUP = 1000;

interface BenchResult {
  library: string;
  encodeNs: number;
  decodeNs: number;
  encodedSize: number;
  encodeOpsPerSec: number;
  decodeOpsPerSec: number;
}

/**
 * Format nanoseconds for display
 */
function formatNs(ns: number): string {
  if (ns < 1000) {
    return `${ns.toFixed(1)}ns`;
  } else if (ns < 1_000_000) {
    return `${(ns / 1000).toFixed(2)}µs`;
  } else {
    return `${(ns / 1_000_000).toFixed(2)}ms`;
  }
}

/**
 * Format ops/second for display
 */
function formatOps(ops: number): string {
  if (ops >= 1_000_000) {
    return `${(ops / 1_000_000).toFixed(2)}M`;
  } else if (ops >= 1000) {
    return `${(ops / 1000).toFixed(2)}K`;
  } else {
    return ops.toFixed(0);
  }
}

/**
 * Benchmark JSON (baseline)
 */
function benchmarkJSON(): BenchResult {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const encoded = JSON.stringify(testData);
    JSON.parse(encoded);
  }

  // Encode benchmark
  let encoded = "";
  const encodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    encoded = JSON.stringify(testData);
  }
  const encodeEnd = performance.now();

  // Decode benchmark
  const decodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    JSON.parse(encoded);
  }
  const decodeEnd = performance.now();

  const encodeMs = encodeEnd - encodeStart;
  const decodeMs = decodeEnd - decodeStart;

  return {
    library: "JSON",
    encodeNs: (encodeMs * 1_000_000) / ITERATIONS,
    decodeNs: (decodeMs * 1_000_000) / ITERATIONS,
    encodedSize: new TextEncoder().encode(encoded).length,
    encodeOpsPerSec: ITERATIONS / (encodeMs / 1000),
    decodeOpsPerSec: ITERATIONS / (decodeMs / 1000)
  };
}

/**
 * Benchmark MessagePack
 */
function benchmarkMsgPack(): BenchResult {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const encoded = msgpackEncode(testData);
    msgpackDecode(encoded);
  }

  // Encode benchmark
  let encoded = new Uint8Array(0);
  const encodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    encoded = msgpackEncode(testData);
  }
  const encodeEnd = performance.now();

  // Decode benchmark
  const decodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    msgpackDecode(encoded);
  }
  const decodeEnd = performance.now();

  const encodeMs = encodeEnd - encodeStart;
  const decodeMs = decodeEnd - decodeStart;

  return {
    library: "MessagePack",
    encodeNs: (encodeMs * 1_000_000) / ITERATIONS,
    decodeNs: (decodeMs * 1_000_000) / ITERATIONS,
    encodedSize: encoded.length,
    encodeOpsPerSec: ITERATIONS / (encodeMs / 1000),
    decodeOpsPerSec: ITERATIONS / (decodeMs / 1000)
  };
}

/**
 * Benchmark Protocol Buffers
 */
async function benchmarkProtobuf(): Promise<BenchResult> {
  // Define schema inline
  const root = protobuf.Root.fromJSON({
    nested: {
      TestStruct: {
        fields: {
          name: { type: "string", id: 1 },
          id: { type: "int32", id: 2 },
          email: { type: "string", id: 3 },
          active: { type: "bool", id: 4 },
          score: { type: "double", id: 5 }
        }
      }
    }
  });

  const TestStruct = root.lookupType("TestStruct");

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const encoded = TestStruct.encode(testData).finish();
    TestStruct.decode(encoded);
  }

  // Encode benchmark
  let encoded = new Uint8Array(0);
  const encodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    encoded = TestStruct.encode(testData).finish();
  }
  const encodeEnd = performance.now();

  // Decode benchmark
  const decodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    TestStruct.decode(encoded);
  }
  const decodeEnd = performance.now();

  const encodeMs = encodeEnd - encodeStart;
  const decodeMs = decodeEnd - decodeStart;

  return {
    library: "Protobuf",
    encodeNs: (encodeMs * 1_000_000) / ITERATIONS,
    decodeNs: (decodeMs * 1_000_000) / ITERATIONS,
    encodedSize: encoded.length,
    encodeOpsPerSec: ITERATIONS / (encodeMs / 1000),
    decodeOpsPerSec: ITERATIONS / (decodeMs / 1000)
  };
}

/**
 * Benchmark BinSchema
 */
async function benchmarkBinSchema(): Promise<BenchResult> {
  // Define equivalent BinSchema schema
  // Note: BinSchema uses fixed-width fields, so we need to define sizes
  const schema = {
    config: { endianness: "big_endian" as const },
    types: {
      TestStruct: {
        sequence: [
          { name: "nameLen", type: "uint8", computed: { type: "length_of", target: "name" } },
          { name: "name", type: "string", kind: "length_prefixed", length_type: "uint8", encoding: "utf8" },
          { name: "id", type: "int32" },
          { name: "emailLen", type: "uint8", computed: { type: "length_of", target: "email" } },
          { name: "email", type: "string", kind: "length_prefixed", length_type: "uint8", encoding: "utf8" },
          { name: "active", type: "uint8" }, // bool as byte
          { name: "score", type: "float64" }
        ]
      }
    }
  };

  // Generate TypeScript code
  let generatedCode = generateTypeScript(schema as any);

  // Fix imports to use absolute paths
  const runtimeDir = resolve(__dirname, "../packages/binschema/src/runtime");
  generatedCode = generatedCode
    .replace(/from "\.\/bit-stream\.js"/g, `from "${runtimeDir}/bit-stream.js"`)
    .replace(/from "\.\/seekable-bit-stream\.js"/g, `from "${runtimeDir}/seekable-bit-stream.js"`)
    .replace(/from "\.\/binary-reader\.js"/g, `from "${runtimeDir}/binary-reader.js"`)
    .replace(/from "\.\/crc32\.js"/g, `from "${runtimeDir}/crc32.js"`)
    .replace(/from "\.\/expression-evaluator\.js"/g, `from "${runtimeDir}/expression-evaluator.js"`);

  // Write to temp file
  const genDir = join(process.cwd(), ".generated-bench");
  mkdirSync(genDir, { recursive: true });
  const genFile = join(genDir, "compare_teststruct.ts");
  writeFileSync(genFile, generatedCode);

  // Import generated module
  const generatedModule = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);

  const EncoderClass = generatedModule.TestStructEncoder;
  const DecoderClass = generatedModule.TestStructDecoder;

  // Convert test data for BinSchema (bool → number)
  const binSchemaData = {
    name: testData.name,
    id: testData.id,
    email: testData.email,
    active: testData.active ? 1 : 0,
    score: testData.score
  };

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const encoder = new EncoderClass();
    const encoded = encoder.encode(binSchemaData);
    new DecoderClass(encoded).decode();
  }

  // Encode benchmark
  let encoded = new Uint8Array(0);
  const encodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const encoder = new EncoderClass();
    encoded = encoder.encode(binSchemaData);
  }
  const encodeEnd = performance.now();

  // Decode benchmark
  const decodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    new DecoderClass(encoded).decode();
  }
  const decodeEnd = performance.now();

  const encodeMs = encodeEnd - encodeStart;
  const decodeMs = decodeEnd - decodeStart;

  return {
    library: "BinSchema",
    encodeNs: (encodeMs * 1_000_000) / ITERATIONS,
    decodeNs: (decodeMs * 1_000_000) / ITERATIONS,
    encodedSize: encoded.length,
    encodeOpsPerSec: ITERATIONS / (encodeMs / 1000),
    decodeOpsPerSec: ITERATIONS / (decodeMs / 1000)
  };
}

/**
 * Main entry point
 */
async function main() {
  console.log("=".repeat(80));
  console.log("BinSchema vs Other Libraries - Performance Comparison");
  console.log("=".repeat(80));
  console.log(`\nTest data: { name, id, email, active, score }`);
  console.log(`Iterations: ${ITERATIONS.toLocaleString()}\n`);

  const results: BenchResult[] = [];

  // Run benchmarks
  console.log("Running JSON benchmark...");
  results.push(benchmarkJSON());

  console.log("Running MessagePack benchmark...");
  results.push(benchmarkMsgPack());

  console.log("Running Protobuf benchmark...");
  results.push(await benchmarkProtobuf());

  console.log("Running BinSchema benchmark...");
  results.push(await benchmarkBinSchema());

  // Sort by encode speed
  results.sort((a, b) => a.encodeNs - b.encodeNs);

  // Print results
  console.log("\n" + "=".repeat(80));
  console.log("Results (sorted by encode speed)");
  console.log("=".repeat(80));

  console.log(`\n${"Library".padEnd(15)} ${"Encode".padStart(12)} ${"Decode".padStart(12)} ${"Size".padStart(8)} ${"Enc ops/s".padStart(12)} ${"Dec ops/s".padStart(12)}`);
  console.log("-".repeat(75));

  for (const r of results) {
    console.log(
      `${r.library.padEnd(15)} ${formatNs(r.encodeNs).padStart(12)} ${formatNs(r.decodeNs).padStart(12)} ${String(r.encodedSize + "B").padStart(8)} ${formatOps(r.encodeOpsPerSec).padStart(12)} ${formatOps(r.decodeOpsPerSec).padStart(12)}`
    );
  }

  // Calculate relative performance
  const baseline = results.find(r => r.library === "JSON")!;

  console.log("\n" + "=".repeat(80));
  console.log("Relative to JSON (lower is better for time, higher for ops/s)");
  console.log("=".repeat(80));

  console.log(`\n${"Library".padEnd(15)} ${"Encode".padStart(12)} ${"Decode".padStart(12)} ${"Size".padStart(12)}`);
  console.log("-".repeat(55));

  for (const r of results) {
    const encodeRatio = (r.encodeNs / baseline.encodeNs).toFixed(2) + "x";
    const decodeRatio = (r.decodeNs / baseline.decodeNs).toFixed(2) + "x";
    const sizeRatio = ((r.encodedSize / baseline.encodedSize) * 100).toFixed(0) + "%";
    console.log(
      `${r.library.padEnd(15)} ${encodeRatio.padStart(12)} ${decodeRatio.padStart(12)} ${sizeRatio.padStart(12)}`
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log("Notes:");
  console.log("=".repeat(80));
  console.log(`
- BinSchema is designed for parsing EXISTING binary protocols (DNS, ZIP, etc.)
  with bit-level precision, not general-purpose serialization.
- Protobuf/MessagePack are self-describing formats optimized for serialization.
- JSON is included as a baseline (human-readable, widely supported).
- BinSchema's strength is precise control over wire format, not raw speed.
`);
}

main().catch(console.error);
