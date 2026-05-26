/**
 * Streaming Decode Example
 *
 * Defines a simple "telemetry sample" protocol and demonstrates four
 * streaming-decoder patterns:
 *
 *   1. In-memory chunked playback — replay a buffer through a mock
 *      ReadableStream with deterministic chunk sizes. Useful as a unit-test
 *      shape and for reproducing wire-format edge cases.
 *
 *   2. Speculative greedy decode — `length_prefixed` array with no per-item
 *      length on the wire. The codegen emits a wrapper around
 *      `decodeArrayGreedy` which retries on `INCOMPLETE_DATA`.
 *
 *   3. Per-item-length framing — `length_prefixed_items` array. Each item is
 *      preceded by a uint16 byte-length; the streaming layer slices exactly
 *      that many bytes per item before decoding.
 *
 *   4. Error handling — both `BinSchemaError` (wire-format problems) and raw
 *      reader errors (network failures) bubble out of the async generator
 *      with full context.
 *
 * The schema is built in-memory, generated to TypeScript at startup, written
 * to `./tmp/streaming-example.ts`, then dynamically imported. In a real
 * project you'd commit the generated file and import it normally.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { generateTypeScript } from "../generators/typescript.js";
import type { BinarySchema } from "../schema/binary-schema.js";
import { BinSchemaError, ErrorCode } from "../runtime/errors.js";

// ---------------------------------------------------------------------------
// Schema: a single length-prefixed array of Sample records, plus a framed
// variant that uses per-item length prefixes.
// ---------------------------------------------------------------------------
const schema: BinarySchema = {
  config: { endianness: "big_endian" },
  types: {
    Sample: {
      sequence: [
        { name: "timestamp", type: "uint32" },
        { name: "sensor_id", type: "uint16" },
        { name: "value", type: "float32" },
        {
          name: "label",
          type: "string",
          kind: "length_prefixed",
          length_type: "uint8",
          encoding: "utf8",
        },
      ],
    },
    SampleStream: {
      sequence: [
        {
          name: "samples",
          type: "array",
          kind: "length_prefixed",
          length_type: "uint16",
          items: { type: "Sample" },
        },
      ],
    },
    FramedSampleStream: {
      sequence: [
        {
          name: "samples",
          type: "array",
          kind: "length_prefixed_items",
          length_type: "uint16",
          item_length_type: "uint16",
          items: { type: "Sample" },
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Generate streaming TypeScript and load it dynamically.
// ---------------------------------------------------------------------------
async function loadGenerated(): Promise<any> {
  const tmpDir = join(process.cwd(), "tmp");
  mkdirSync(tmpDir, { recursive: true });

  // The generated file imports `./bit-stream.js`, `./stream-decoder.js`, etc.
  // For the example we point it at the runtime files in src/runtime/.
  let code = generateTypeScript(schema, { generate_streaming: true });
  // Re-route runtime imports so the generated module finds the source files
  // without needing a build step.
  code = code.replace(/from "\.\/bit-stream\.js"/g, `from "../packages/binschema/src/runtime/bit-stream.js"`);
  code = code.replace(/from "\.\/seekable-bit-stream\.js"/g, `from "../packages/binschema/src/runtime/seekable-bit-stream.js"`);
  code = code.replace(/from "\.\/binary-reader\.js"/g, `from "../packages/binschema/src/runtime/binary-reader.js"`);
  code = code.replace(/from "\.\/crc32\.js"/g, `from "../packages/binschema/src/runtime/crc32.js"`);
  code = code.replace(/from "\.\/expression-evaluator\.js"/g, `from "../packages/binschema/src/runtime/expression-evaluator.js"`);
  code = code.replace(/from "\.\/stream-decoder\.js"/g, `from "../packages/binschema/src/runtime/stream-decoder.js"`);
  const file = join(tmpDir, "streaming-example.ts");
  writeFileSync(file, code);
  return import(pathToFileURL(file).href + `?t=${Date.now()}`);
}

// ---------------------------------------------------------------------------
// Helpers: build a chunked ReadableStream + an error-injecting stream.
// ---------------------------------------------------------------------------
function chunkedStream(bytes: number[], chunkSize: number): ReadableStream<Uint8Array> {
  let offset = 0;
  const data = new Uint8Array(bytes);
  return new ReadableStream({
    pull(controller) {
      if (offset >= data.length) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, data.length);
      controller.enqueue(data.slice(offset, end));
      offset = end;
    },
  });
}

function failingStream(initialBytes: number[], errorMsg: string): ReadableStream<Uint8Array> {
  let delivered = false;
  return new ReadableStream({
    pull(controller) {
      if (!delivered) {
        controller.enqueue(new Uint8Array(initialBytes));
        delivered = true;
        return;
      }
      controller.error(new Error(errorMsg));
    },
  });
}

// ---------------------------------------------------------------------------
// Demo 1: greedy mode, whole array in one chunk.
// ---------------------------------------------------------------------------
async function demoGreedyWholeStream(Generated: any): Promise<void> {
  console.log("\n[Demo 1] Greedy mode, single chunk");

  const encoder = new Generated.SampleStreamEncoder();
  const fullBytes = Array.from(encoder.encode({
    samples: [
      { timestamp: 1700000000, sensor_id: 7, value: 23.5, label: "kitchen" },
      { timestamp: 1700000005, sensor_id: 7, value: 24.0, label: "kitchen" },
      { timestamp: 1700000010, sensor_id: 3, value: 18.2, label: "office" },
    ],
  }));

  const stream = chunkedStream(fullBytes, 1024);
  const reader = stream.getReader();
  for await (const sample of Generated.decodeSampleStreamStream(reader)) {
    console.log("  sample:", sample);
  }
}

// ---------------------------------------------------------------------------
// Demo 2: greedy mode, 1-byte chunks (worst case latency).
// ---------------------------------------------------------------------------
async function demoGreedyTinyChunks(Generated: any): Promise<void> {
  console.log("\n[Demo 2] Greedy mode, 1-byte chunks");

  const encoder = new Generated.SampleStreamEncoder();
  const fullBytes = Array.from(encoder.encode({
    samples: [
      { timestamp: 1, sensor_id: 1, value: 1.0, label: "a" },
      { timestamp: 2, sensor_id: 2, value: 2.0, label: "b" },
    ],
  }));

  const stream = chunkedStream(fullBytes, 1);
  const reader = stream.getReader();
  let count = 0;
  for await (const sample of Generated.decodeSampleStreamStream(reader)) {
    count++;
    console.log(`  sample ${count}: ts=${sample.timestamp} label=${sample.label}`);
  }
}

// ---------------------------------------------------------------------------
// Demo 3: per-item length framing.
// ---------------------------------------------------------------------------
async function demoFramedItems(Generated: any): Promise<void> {
  console.log("\n[Demo 3] length_prefixed_items framing");

  const encoder = new Generated.FramedSampleStreamEncoder();
  const fullBytes = Array.from(encoder.encode({
    samples: [
      { timestamp: 100, sensor_id: 1, value: 0.5, label: "north" },
      { timestamp: 200, sensor_id: 2, value: 1.5, label: "south" },
    ],
  }));

  const stream = chunkedStream(fullBytes, 3); // tiny chunks straddle frames
  const reader = stream.getReader();
  for await (const sample of Generated.decodeFramedSampleStreamStream(reader)) {
    console.log("  framed sample:", sample);
  }
}

// ---------------------------------------------------------------------------
// Demo 4: error propagation — both network and decode failures.
// ---------------------------------------------------------------------------
async function demoNetworkError(Generated: any): Promise<void> {
  console.log("\n[Demo 4a] Network error mid-stream");

  // Send the array length (2) and a partial first item, then explode.
  const stream = failingStream([0x00, 0x02, 0x00, 0x00], "ECONNRESET");
  const reader = stream.getReader();
  try {
    for await (const _ of Generated.decodeSampleStreamStream(reader)) {
      // no-op
    }
  } catch (e) {
    console.log("  caught:", (e as Error).message);
  }
}

async function demoDecodeError(Generated: any): Promise<void> {
  console.log("\n[Demo 4b] Decode error (truncated stream)");

  // Claim 3 items but only deliver bytes for 1.
  const truncated = [
    0x00, 0x03, // array length = 3
    0x00, 0x00, 0x00, 0x01, // sample 0 timestamp
    0x00, 0x07,             // sample 0 sensor_id
    0x40, 0x00, 0x00, 0x00, // sample 0 value
    0x01, 0x61,             // sample 0 label = "a"
    // ...no more bytes; stream closes here.
  ];
  const stream = chunkedStream(truncated, 4);
  const reader = stream.getReader();
  const received: any[] = [];
  try {
    for await (const sample of Generated.decodeSampleStreamStream(reader)) {
      received.push(sample);
    }
  } catch (e) {
    if (e instanceof BinSchemaError) {
      console.log(`  caught BinSchemaError: code=${e.code} ctx=${e.context} msg="${e.message}"`);
    } else {
      console.log("  caught (non-BinSchemaError):", e);
    }
  }
  console.log(`  decoded ${received.length} item(s) before failure`);
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const Generated = await loadGenerated();
  await demoGreedyWholeStream(Generated);
  await demoGreedyTinyChunks(Generated);
  await demoFramedItems(Generated);
  await demoNetworkError(Generated);
  await demoDecodeError(Generated);
  console.log("\nDone. Error codes available on `BinSchemaError.code`:");
  for (const code of Object.values(ErrorCode)) {
    console.log("  -", code);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
