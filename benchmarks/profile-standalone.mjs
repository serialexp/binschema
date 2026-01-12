#!/usr/bin/env node
/**
 * Standalone profiling script - no dynamic imports
 */

import { DnsMessageDecoder } from "./.generated-bench/decoder-bundle.mjs";

const ITERATIONS = 500_000;

// DNS Response packet with compression
const responsePacket = new Uint8Array([
  0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x07, 0x65, 0x78, 0x61,
  0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
  0x00, 0x00, 0x01, 0x00, 0x01, 0xc0, 0x0c, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x0e, 0x10, 0x00,
  0x04, 0x5d, 0xb8, 0xd8, 0x22,
]);

// Warmup
console.log("Warming up...");
for (let i = 0; i < 10000; i++) {
  new DnsMessageDecoder(responsePacket).decode();
}

// Profile run
console.log(`Running ${ITERATIONS.toLocaleString()} iterations...`);
const start = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
  new DnsMessageDecoder(responsePacket).decode();
}

const end = performance.now();
const totalMs = end - start;
const perOpNs = (totalMs * 1_000_000) / ITERATIONS;

console.log(`Done: ${totalMs.toFixed(0)}ms total, ${perOpNs.toFixed(0)}ns per decode`);
