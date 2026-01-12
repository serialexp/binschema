#!/usr/bin/env bun
/**
 * TypeScript Performance Benchmark Runner for BinSchema
 *
 * Benchmarks encoding and decoding performance across different schema types.
 * Results are comparable with the Go benchmark runner.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { generateTypeScript } from "../packages/binschema/src/generators/typescript.js";
import { BinarySchema, defineBinarySchema } from "../packages/binschema/src/schema/binary-schema.js";

// Results output structure (matches Go benchmark output format)
interface BenchmarkResult {
  name: string;
  type: string;
  operation: "encode" | "decode";
  iterations: number;
  totalTimeNs: number;
  avgTimeNs: number;
  opsPerSecond: number;
  bytesPerOp: number;
}

interface BenchmarkSuite {
  language: string;
  timestamp: string;
  results: BenchmarkResult[];
}

// Benchmark schema structure
interface BenchmarkSchema {
  name: string;
  description: string;
  config: {
    endianness: string;
  };
  types: Record<string, any>;
  benchmarks: Record<string, {
    type: string;
    value?: any;
    generator?: any;
    iterations: number;
  }>;
}

/**
 * Generate value from generator spec
 */
function generateValue(generator: any): any {
  if (!generator) return undefined;

  const result: any = {};
  for (const [field, spec] of Object.entries(generator)) {
    const s = spec as any;
    if (s.type === "range") {
      result[field] = Array.from({ length: s.count }, (_, i) => s.start + i);
    } else if (s.type === "bytes") {
      result[field] = Array.from({ length: s.count }, (_, i) => i % 256);
    }
  }
  return result;
}

/**
 * Convert bigint strings (like "12345678901234") to BigInt in nested objects
 */
function convertBigInts(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    // Check if it's a large number string (for uint64/int64)
    if (/^-?\d{10,}$/.test(value)) {
      return BigInt(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(convertBigInts);
  }
  if (typeof value === "object") {
    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = convertBigInts(v);
    }
    return result;
  }
  return value;
}

/**
 * Run a single benchmark
 */
async function runBenchmark(
  benchName: string,
  benchConfig: any,
  generatedModule: any,
  schema: BinarySchema
): Promise<{ encode: BenchmarkResult; decode: BenchmarkResult }> {
  const typeName = benchConfig.type;
  const iterations = benchConfig.iterations;

  // Get encoder/decoder classes
  const EncoderClass = generatedModule[`${typeName}Encoder`];
  const DecoderClass = generatedModule[`${typeName}Decoder`];

  if (!EncoderClass) {
    throw new Error(`Encoder class ${typeName}Encoder not found`);
  }
  if (!DecoderClass) {
    throw new Error(`Decoder class ${typeName}Decoder not found`);
  }

  // Generate or use provided value
  let value = benchConfig.value;
  if (benchConfig.generator) {
    value = { ...value, ...generateValue(benchConfig.generator) };
  }

  // Convert any bigint strings
  value = convertBigInts(value);

  // Warm-up run
  const warmupEncoder = new EncoderClass();
  const warmupBytes = warmupEncoder.encode(value);
  new DecoderClass(warmupBytes).decode();

  // Encode benchmark
  const encodeStart = performance.now();
  let encodedBytes: Uint8Array = new Uint8Array(0);
  for (let i = 0; i < iterations; i++) {
    const encoder = new EncoderClass();
    encodedBytes = encoder.encode(value);
  }
  const encodeEnd = performance.now();
  const encodeTotalMs = encodeEnd - encodeStart;
  const encodeTotalNs = encodeTotalMs * 1_000_000;

  // Decode benchmark
  const decodeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    new DecoderClass(encodedBytes).decode();
  }
  const decodeEnd = performance.now();
  const decodeTotalMs = decodeEnd - decodeStart;
  const decodeTotalNs = decodeTotalMs * 1_000_000;

  const bytesPerOp = encodedBytes.length;

  return {
    encode: {
      name: benchName,
      type: typeName,
      operation: "encode",
      iterations,
      totalTimeNs: encodeTotalNs,
      avgTimeNs: encodeTotalNs / iterations,
      opsPerSecond: iterations / (encodeTotalMs / 1000),
      bytesPerOp
    },
    decode: {
      name: benchName,
      type: typeName,
      operation: "decode",
      iterations,
      totalTimeNs: decodeTotalNs,
      avgTimeNs: decodeTotalNs / iterations,
      opsPerSecond: iterations / (decodeTotalMs / 1000),
      bytesPerOp
    }
  };
}

/**
 * Run all benchmarks for a schema file
 */
async function runSchemaFile(schemaPath: string): Promise<BenchmarkResult[]> {
  console.log(`\n📋 Loading schema: ${schemaPath}`);

  const rawSchema = JSON.parse(readFileSync(schemaPath, "utf-8")) as BenchmarkSchema;

  // Extract just the BinarySchema part
  const binarySchema: BinarySchema = {
    config: rawSchema.config,
    types: rawSchema.types
  } as BinarySchema;

  // Generate TypeScript code
  console.log("  Generating TypeScript code...");
  let generatedCode = generateTypeScript(binarySchema);

  // Fix imports to use absolute paths to the runtime
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
  const genFile = join(genDir, `${rawSchema.name}.ts`);
  writeFileSync(genFile, generatedCode);

  // Import generated module
  const generatedModule = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);

  const results: BenchmarkResult[] = [];

  // Run each benchmark
  for (const [benchName, benchConfig] of Object.entries(rawSchema.benchmarks)) {
    const fullName = `${rawSchema.name}/${benchName}`;
    console.log(`  ⏱️  Running ${fullName} (${benchConfig.iterations} iterations)...`);

    try {
      const { encode, decode } = await runBenchmark(fullName, benchConfig, generatedModule, binarySchema);
      results.push(encode, decode);

      // Print inline results
      console.log(`      encode: ${formatNs(encode.avgTimeNs)}/op (${formatOps(encode.opsPerSecond)} ops/s)`);
      console.log(`      decode: ${formatNs(decode.avgTimeNs)}/op (${formatOps(decode.opsPerSecond)} ops/s)`);
    } catch (error) {
      console.error(`  ❌ Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  return results;
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
 * Main entry point
 */
async function main() {
  const schemasDir = resolve(__dirname, "schemas");
  const schemaFiles = readdirSync(schemasDir).filter(f => f.endsWith(".json"));

  console.log("🚀 BinSchema TypeScript Performance Benchmarks");
  console.log("=".repeat(60));

  const allResults: BenchmarkResult[] = [];

  for (const schemaFile of schemaFiles) {
    const results = await runSchemaFile(join(schemasDir, schemaFile));
    allResults.push(...results);
  }

  // Output summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));

  // Group by benchmark name
  const grouped: Record<string, { encode?: BenchmarkResult; decode?: BenchmarkResult }> = {};
  for (const result of allResults) {
    if (!grouped[result.name]) {
      grouped[result.name] = {};
    }
    grouped[result.name][result.operation] = result;
  }

  console.log("\n%-40s %12s %12s %10s".replace(/\s/g, (_, i) => " ".repeat(parseInt(i) || 1)), "Benchmark", "Encode/op", "Decode/op", "Bytes");
  console.log("-".repeat(76));

  for (const [name, ops] of Object.entries(grouped)) {
    const encodeNs = ops.encode ? formatNs(ops.encode.avgTimeNs) : "N/A";
    const decodeNs = ops.decode ? formatNs(ops.decode.avgTimeNs) : "N/A";
    const bytes = ops.encode?.bytesPerOp ?? ops.decode?.bytesPerOp ?? 0;
    console.log(`${name.padEnd(40)} ${encodeNs.padStart(12)} ${decodeNs.padStart(12)} ${String(bytes).padStart(10)}`);
  }

  // Write JSON results for comparison
  const output: BenchmarkSuite = {
    language: "typescript",
    timestamp: new Date().toISOString(),
    results: allResults
  };

  const outputPath = join(__dirname, "results-ts.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📁 Results saved to: ${outputPath}`);
}

main().catch(console.error);
