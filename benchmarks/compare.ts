#!/usr/bin/env bun
/**
 * Benchmark Comparison Script
 *
 * Compares TypeScript and Go benchmark results side-by-side.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

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
 * Calculate speed ratio (positive = Go faster, negative = TS faster)
 */
function speedRatio(tsNs: number, goNs: number): string {
  if (tsNs === 0 || goNs === 0) return "N/A";

  const ratio = tsNs / goNs;
  if (ratio > 1) {
    return `Go ${ratio.toFixed(1)}x faster`;
  } else if (ratio < 1) {
    return `TS ${(1 / ratio).toFixed(1)}x faster`;
  } else {
    return "Same";
  }
}

/**
 * Get color code for speed ratio
 */
function colorRatio(tsNs: number, goNs: number): string {
  if (tsNs === 0 || goNs === 0) return "";

  const ratio = tsNs / goNs;
  if (ratio > 2) return "\x1b[32m"; // Green - Go much faster
  if (ratio > 1.2) return "\x1b[92m"; // Light green - Go faster
  if (ratio < 0.5) return "\x1b[31m"; // Red - TS much faster
  if (ratio < 0.83) return "\x1b[91m"; // Light red - TS faster
  return "\x1b[33m"; // Yellow - similar
}

const RESET = "\x1b[0m";

function main() {
  const benchDir = join(__dirname);
  const tsResultsPath = join(benchDir, "results-ts.json");
  const goResultsPath = join(benchDir, "results-go.json");

  // Check if result files exist
  const hasTsResults = existsSync(tsResultsPath);
  const hasGoResults = existsSync(goResultsPath);

  if (!hasTsResults && !hasGoResults) {
    console.log("No benchmark results found. Run 'make bench-ts' and/or 'make bench-go' first.");
    process.exit(1);
  }

  let tsResults: BenchmarkSuite | null = null;
  let goResults: BenchmarkSuite | null = null;

  if (hasTsResults) {
    tsResults = JSON.parse(readFileSync(tsResultsPath, "utf-8"));
    console.log(`TypeScript results from: ${tsResults!.timestamp}`);
  }

  if (hasGoResults) {
    goResults = JSON.parse(readFileSync(goResultsPath, "utf-8"));
    console.log(`Go results from: ${goResults!.timestamp}`);
  }

  console.log("\n" + "=".repeat(100));
  console.log("📊 Benchmark Comparison: TypeScript vs Go");
  console.log("=".repeat(100));

  // Build lookup maps
  const tsMap = new Map<string, BenchmarkResult>();
  const goMap = new Map<string, BenchmarkResult>();

  if (tsResults) {
    for (const r of tsResults.results) {
      tsMap.set(`${r.name}/${r.operation}`, r);
    }
  }

  if (goResults) {
    for (const r of goResults.results) {
      goMap.set(`${r.name}/${r.operation}`, r);
    }
  }

  // Get all unique benchmark names
  const allKeys = new Set([...tsMap.keys(), ...goMap.keys()]);
  const sortedKeys = [...allKeys].sort();

  // Group by benchmark name (without operation)
  const grouped = new Map<string, { encode?: { ts?: BenchmarkResult; go?: BenchmarkResult }; decode?: { ts?: BenchmarkResult; go?: BenchmarkResult } }>();

  for (const key of sortedKeys) {
    const [benchName, operation] = [key.substring(0, key.lastIndexOf("/")), key.substring(key.lastIndexOf("/") + 1)] as [string, "encode" | "decode"];

    if (!grouped.has(benchName)) {
      grouped.set(benchName, {});
    }

    const g = grouped.get(benchName)!;
    if (!g[operation]) {
      g[operation] = {};
    }

    const tsResult = tsMap.get(key);
    const goResult = goMap.get(key);

    if (tsResult) g[operation]!.ts = tsResult;
    if (goResult) g[operation]!.go = goResult;
  }

  // Print header
  console.log("\n%-35s │ %12s %12s %18s │ %12s %12s %18s".replace(/%(\d+)s/g, (_, n) => " ".repeat(parseInt(n))));
  console.log(`${"Benchmark".padEnd(35)} │ ${"TS Encode".padStart(12)} ${"Go Encode".padStart(12)} ${"Ratio".padStart(18)} │ ${"TS Decode".padStart(12)} ${"Go Decode".padStart(12)} ${"Ratio".padStart(18)}`);
  console.log("-".repeat(35) + "-┼" + "-".repeat(45) + "-┼" + "-".repeat(45));

  for (const [benchName, ops] of grouped) {
    const encTs = ops.encode?.ts ? formatNs(ops.encode.ts.avgTimeNs) : "N/A";
    const encGo = ops.encode?.go ? formatNs(ops.encode.go.avgTimeNs) : "N/A";
    const encRatio = ops.encode?.ts && ops.encode?.go
      ? colorRatio(ops.encode.ts.avgTimeNs, ops.encode.go.avgTimeNs) + speedRatio(ops.encode.ts.avgTimeNs, ops.encode.go.avgTimeNs) + RESET
      : "N/A";

    const decTs = ops.decode?.ts ? formatNs(ops.decode.ts.avgTimeNs) : "N/A";
    const decGo = ops.decode?.go ? formatNs(ops.decode.go.avgTimeNs) : "N/A";
    const decRatio = ops.decode?.ts && ops.decode?.go
      ? colorRatio(ops.decode.ts.avgTimeNs, ops.decode.go.avgTimeNs) + speedRatio(ops.decode.ts.avgTimeNs, ops.decode.go.avgTimeNs) + RESET
      : "N/A";

    // Truncate benchmark name if too long
    const displayName = benchName.length > 35 ? benchName.substring(0, 32) + "..." : benchName;

    console.log(`${displayName.padEnd(35)} │ ${encTs.padStart(12)} ${encGo.padStart(12)} ${encRatio.padStart(18 + (encRatio.includes("\x1b") ? 9 : 0))} │ ${decTs.padStart(12)} ${decGo.padStart(12)} ${decRatio.padStart(18 + (decRatio.includes("\x1b") ? 9 : 0))}`);
  }

  // Print summary statistics
  console.log("\n" + "=".repeat(100));
  console.log("📈 Summary Statistics");
  console.log("=".repeat(100));

  let encodeGoFaster = 0;
  let encodeTsFaster = 0;
  let decodeGoFaster = 0;
  let decodeTsFaster = 0;
  let encodeRatios: number[] = [];
  let decodeRatios: number[] = [];

  for (const [, ops] of grouped) {
    if (ops.encode?.ts && ops.encode?.go) {
      const ratio = ops.encode.ts.avgTimeNs / ops.encode.go.avgTimeNs;
      encodeRatios.push(ratio);
      if (ratio > 1) encodeGoFaster++;
      else encodeTsFaster++;
    }
    if (ops.decode?.ts && ops.decode?.go) {
      const ratio = ops.decode.ts.avgTimeNs / ops.decode.go.avgTimeNs;
      decodeRatios.push(ratio);
      if (ratio > 1) decodeGoFaster++;
      else decodeTsFaster++;
    }
  }

  const avgEncodeRatio = encodeRatios.length > 0
    ? encodeRatios.reduce((a, b) => a + b, 0) / encodeRatios.length
    : 0;
  const avgDecodeRatio = decodeRatios.length > 0
    ? decodeRatios.reduce((a, b) => a + b, 0) / decodeRatios.length
    : 0;

  console.log(`\nEncode operations:`);
  console.log(`  Go faster: ${encodeGoFaster} benchmarks`);
  console.log(`  TS faster: ${encodeTsFaster} benchmarks`);
  if (avgEncodeRatio > 0) {
    console.log(`  Average ratio: ${avgEncodeRatio > 1 ? `Go ${avgEncodeRatio.toFixed(2)}x faster` : `TS ${(1 / avgEncodeRatio).toFixed(2)}x faster`}`);
  }

  console.log(`\nDecode operations:`);
  console.log(`  Go faster: ${decodeGoFaster} benchmarks`);
  console.log(`  TS faster: ${decodeTsFaster} benchmarks`);
  if (avgDecodeRatio > 0) {
    console.log(`  Average ratio: ${avgDecodeRatio > 1 ? `Go ${avgDecodeRatio.toFixed(2)}x faster` : `TS ${(1 / avgDecodeRatio).toFixed(2)}x faster`}`);
  }
}

main();
