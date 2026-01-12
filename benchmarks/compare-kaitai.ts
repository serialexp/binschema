#!/usr/bin/env bun
/**
 * Kaitai Struct vs BinSchema Benchmark
 *
 * Compares DNS packet decoding performance between:
 * - Kaitai Struct (declarative binary parser generator)
 * - BinSchema (declarative binary parser/serializer generator)
 *
 * Both tools solve the same problem: parsing existing binary protocols.
 * This is an apples-to-apples comparison.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import YAML from "yaml";
import KaitaiStructCompiler from "kaitai-struct-compiler";
import KaitaiStream from "kaitai-struct/KaitaiStream.js";
import { generateTypeScript } from "../packages/binschema/src/generators/typescript.js";

// Iterations for benchmarking
const ITERATIONS = 100000;
const WARMUP = 1000;

interface BenchResult {
  library: string;
  decodeNs: number;
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
 * Create a real DNS query packet for "example.com" type A
 */
function createDnsQueryPacket(): Uint8Array {
  // DNS query for example.com, type A, class IN
  return new Uint8Array([
    // Header (12 bytes)
    0x12, 0x34, // Transaction ID
    0x01, 0x00, // Flags: standard query, recursion desired
    0x00, 0x01, // Questions: 1
    0x00, 0x00, // Answers: 0
    0x00, 0x00, // Authority: 0
    0x00, 0x00, // Additional: 0
    // Question section
    0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // "example"
    0x03, 0x63, 0x6f, 0x6d, // "com"
    0x00, // null terminator
    0x00, 0x01, // Type: A
    0x00, 0x01, // Class: IN
  ]);
}

/**
 * Create a DNS response packet with compression
 */
function createDnsResponsePacket(): Uint8Array {
  // DNS response for example.com with A record and compression
  return new Uint8Array([
    // Header (12 bytes)
    0x12, 0x34, // Transaction ID
    0x81, 0x80, // Flags: response, recursion desired, recursion available
    0x00, 0x01, // Questions: 1
    0x00, 0x01, // Answers: 1
    0x00, 0x00, // Authority: 0
    0x00, 0x00, // Additional: 0
    // Question section
    0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // "example"
    0x03, 0x63, 0x6f, 0x6d, // "com"
    0x00, // null terminator
    0x00, 0x01, // Type: A
    0x00, 0x01, // Class: IN
    // Answer section (with compression pointer)
    0xc0, 0x0c, // Pointer to offset 12 (example.com)
    0x00, 0x01, // Type: A
    0x00, 0x01, // Class: IN
    0x00, 0x00, 0x0e, 0x10, // TTL: 3600 seconds
    0x00, 0x04, // RDLENGTH: 4
    0x5d, 0xb8, 0xd8, 0x22, // RDATA: 93.184.216.34
  ]);
}

/**
 * Compile Kaitai .ksy file to JavaScript
 */
async function compileKaitai(): Promise<any> {
  const ksyPath = "/home/bart/Projects/kaitai_struct_formats/network/dns_packet.ksy";
  const ksyContent = readFileSync(ksyPath, "utf-8");
  const ksy = YAML.parse(ksyContent);

  const files = await KaitaiStructCompiler.compile("javascript", ksy, null, false);

  // Write generated file
  const genDir = join(process.cwd(), ".generated-bench");
  mkdirSync(genDir, { recursive: true });

  const jsCode = files["DnsPacket.js"];
  const genFile = join(genDir, "DnsPacket.js");

  // Kaitai generates UMD code. We need to convert it to ESM.
  // Strategy: Replace the UMD wrapper with direct ESM exports
  // The factory function signature is: function (DnsPacket_, KaitaiStream)
  // It assigns DnsPacket_.DnsPacket = DnsPacket at the end

  // Find the factory function body (starts after the UMD boilerplate)
  const factoryStart = jsCode.indexOf("function (DnsPacket_, KaitaiStream)");
  const factoryBodyStart = jsCode.indexOf("{", factoryStart) + 1;

  // Find where the main DnsPacket constructor ends (before nested types)
  // The factory ends with: DnsPacket_.DnsPacket = DnsPacket;\n});
  const factoryEnd = jsCode.lastIndexOf("DnsPacket_.DnsPacket = DnsPacket;");

  // Extract just the DnsPacket definition code
  const factoryBody = jsCode.slice(factoryBodyStart, factoryEnd);

  const moduleCode = `
import KaitaiStream from "kaitai-struct/KaitaiStream.js";

// Extracted from Kaitai-generated UMD code
${factoryBody}

export default DnsPacket;
`;
  writeFileSync(genFile, moduleCode);

  // Import the generated module
  const module = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);
  return module.default;
}

/**
 * Generate BinSchema decoder for DNS
 */
async function generateBinSchemaDecoder(): Promise<any> {
  // Load the actual BinSchema DNS schema
  const schemaPath = resolve(__dirname, "../packages/binschema/src/tests/protocols/dns-complete-message.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));

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
  const genFile = join(genDir, "BinSchemaDns.ts");
  writeFileSync(genFile, generatedCode);

  // Import generated module
  const module = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);
  return module;
}

/**
 * Benchmark Kaitai Struct
 */
function benchmarkKaitai(DnsPacket: any, packet: Uint8Array): BenchResult {
  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    const stream = new KaitaiStream(packet.buffer);
    new DnsPacket(stream);
  }

  // Decode benchmark
  const decodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const stream = new KaitaiStream(packet.buffer);
    new DnsPacket(stream);
  }
  const decodeEnd = performance.now();

  const decodeMs = decodeEnd - decodeStart;

  return {
    library: "Kaitai Struct",
    decodeNs: (decodeMs * 1_000_000) / ITERATIONS,
    decodeOpsPerSec: ITERATIONS / (decodeMs / 1000),
  };
}

/**
 * Benchmark BinSchema
 */
function benchmarkBinSchema(module: any, packet: Uint8Array): BenchResult {
  const DecoderClass = module.DnsMessageDecoder;

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    new DecoderClass(packet).decode();
  }

  // Decode benchmark
  const decodeStart = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    new DecoderClass(packet).decode();
  }
  const decodeEnd = performance.now();

  const decodeMs = decodeEnd - decodeStart;

  return {
    library: "BinSchema",
    decodeNs: (decodeMs * 1_000_000) / ITERATIONS,
    decodeOpsPerSec: ITERATIONS / (decodeMs / 1000),
  };
}

/**
 * Main entry point
 */
async function main() {
  console.log("=".repeat(80));
  console.log("Kaitai Struct vs BinSchema - DNS Packet Decoding Benchmark");
  console.log("=".repeat(80));
  console.log(`\nIterations: ${ITERATIONS.toLocaleString()}`);
  console.log(`Warmup: ${WARMUP.toLocaleString()}\n`);

  // Create test packets
  const queryPacket = createDnsQueryPacket();
  console.log(`DNS Query packet size: ${queryPacket.length} bytes`);

  // Compile/generate parsers
  console.log("\nCompiling Kaitai Struct parser...");
  const KaitaiDnsPacket = await compileKaitai();

  console.log("Generating BinSchema parser...");
  const binSchemaModule = await generateBinSchemaDecoder();

  // Verify both parse correctly
  console.log("\nVerifying parsers produce correct output...");

  const kaitaiQueryResult = new KaitaiDnsPacket(new KaitaiStream(queryPacket.buffer));
  console.log(`Kaitai Query:    transactionId=${kaitaiQueryResult.transactionId}, qdcount=${kaitaiQueryResult.qdcount}, ancount=${kaitaiQueryResult.ancount}`);

  const binSchemaQueryResult = new binSchemaModule.DnsMessageDecoder(queryPacket).decode();
  console.log(`BinSchema Query: id=${binSchemaQueryResult.id}, qdcount=${binSchemaQueryResult.qdcount}, ancount=${binSchemaQueryResult.ancount}`);

  const responsePacketForVerify = createDnsResponsePacket();
  const kaitaiRespResult = new KaitaiDnsPacket(new KaitaiStream(responsePacketForVerify.buffer));
  console.log(`Kaitai Response: transactionId=${kaitaiRespResult.transactionId}, qdcount=${kaitaiRespResult.qdcount}, ancount=${kaitaiRespResult.ancount}`);

  const binSchemaRespResult = new binSchemaModule.DnsMessageDecoder(responsePacketForVerify).decode();
  console.log(`BinSchema Response: id=${binSchemaRespResult.id}, qdcount=${binSchemaRespResult.qdcount}, ancount=${binSchemaRespResult.ancount}`);

  // Run benchmarks - Query packet
  console.log("\n" + "-".repeat(80));
  console.log("DNS Query packet benchmark (29 bytes, no compression)");
  console.log("-".repeat(80));

  const queryResults: BenchResult[] = [];

  console.log("  Benchmarking Kaitai Struct...");
  queryResults.push(benchmarkKaitai(KaitaiDnsPacket, queryPacket));

  console.log("  Benchmarking BinSchema...");
  queryResults.push(benchmarkBinSchema(binSchemaModule, queryPacket));

  queryResults.sort((a, b) => a.decodeNs - b.decodeNs);

  // Run benchmarks - Response packet with compression
  const responsePacket = createDnsResponsePacket();
  console.log("\n" + "-".repeat(80));
  console.log(`DNS Response packet benchmark (${responsePacket.length} bytes, with compression)`);
  console.log("-".repeat(80));

  const responseResults: BenchResult[] = [];

  console.log("  Benchmarking Kaitai Struct...");
  responseResults.push(benchmarkKaitai(KaitaiDnsPacket, responsePacket));

  console.log("  Benchmarking BinSchema...");
  responseResults.push(benchmarkBinSchema(binSchemaModule, responsePacket));

  responseResults.sort((a, b) => a.decodeNs - b.decodeNs);

  // Print results
  console.log("\n" + "=".repeat(80));
  console.log("Results - DNS Query (no compression)");
  console.log("=".repeat(80));

  console.log(
    `\n${"Library".padEnd(20)} ${"Decode".padStart(12)} ${"Ops/sec".padStart(12)}`
  );
  console.log("-".repeat(48));

  for (const r of queryResults) {
    console.log(
      `${r.library.padEnd(20)} ${formatNs(r.decodeNs).padStart(12)} ${formatOps(r.decodeOpsPerSec).padStart(12)}`
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log("Results - DNS Response (with compression)");
  console.log("=".repeat(80));

  console.log(
    `\n${"Library".padEnd(20)} ${"Decode".padStart(12)} ${"Ops/sec".padStart(12)}`
  );
  console.log("-".repeat(48));

  for (const r of responseResults) {
    console.log(
      `${r.library.padEnd(20)} ${formatNs(r.decodeNs).padStart(12)} ${formatOps(r.decodeOpsPerSec).padStart(12)}`
    );
  }

  // Calculate relative performance
  const queryFastest = queryResults[0];
  const querySlowest = queryResults[queryResults.length - 1];
  const queryRatio = querySlowest.decodeNs / queryFastest.decodeNs;

  const respFastest = responseResults[0];
  const respSlowest = responseResults[responseResults.length - 1];
  const respRatio = respSlowest.decodeNs / respFastest.decodeNs;

  console.log("\n" + "=".repeat(80));
  console.log("Summary");
  console.log("=".repeat(80));
  console.log(`\nDNS Query:    ${queryFastest.library} is ${queryRatio.toFixed(2)}x faster than ${querySlowest.library}`);
  console.log(`DNS Response: ${respFastest.library} is ${respRatio.toFixed(2)}x faster than ${respSlowest.library}`);

  console.log("\n" + "=".repeat(80));
  console.log("Notes");
  console.log("=".repeat(80));
  console.log(`
- Both tools parse the SAME wire format (real DNS packets)
- Kaitai Struct: decode-only, lazy computed instances for bitfields
- BinSchema: encode+decode, native bitfield/discriminated union support
- BinSchema uses full schema with back_reference, discriminated_union, etc.
- Performance difference likely due to BinSchema's richer type system overhead
`);
}

main().catch(console.error);
