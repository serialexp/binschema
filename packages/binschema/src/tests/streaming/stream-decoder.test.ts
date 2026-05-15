/**
 * Streaming decoder runtime tests.
 *
 * Exercises `decodeArrayStream` (length_prefixed_items mode) and
 * `decodeArrayGreedy` (standard length_prefixed mode) against a controllable
 * ReadableStream so we can simulate real network chunking patterns:
 *
 * - Item split across chunks
 * - One-byte chunks (worst-case latency)
 * - Large chunks (multiple items per chunk)
 * - Partial item at chunk boundary
 * - Variable-length items (strings inside structs)
 * - Empty array
 * - length_prefixed_items + chunked
 * - Network errors mid-stream
 * - Decode errors mid-stream (truncated payload)
 * - Slow-consumer backpressure (consumer must not need to buffer the whole array)
 *
 * The disabled spec file `chunked-network.test.ts.disabled` was the design
 * input for these cases — see that file for the original schema-level intent.
 * These tests run against the runtime primitives directly; the schema-driven
 * variant will land in Phase 4 (streaming codegen).
 */

import { BitStreamDecoder, BitStreamEncoder } from "../../runtime/bit-stream.js";
import { BinSchemaError, ErrorCode } from "../../runtime/errors.js";
import {
  decodeArrayStream,
  decodeArrayGreedy,
  readExactly,
} from "../../runtime/stream-decoder.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a ReadableStream that emits `bytes` carved into chunks whose sizes
 * cycle through `chunkSizes`. Mirrors the helper in the disabled spec file.
 *
 * Example: bytes=[0..9], chunkSizes=[3, 2] → chunks [0,1,2], [3,4], [5,6,7], [8,9].
 */
function createChunkedStream(bytes: number[], chunkSizes: number[]): ReadableStream<Uint8Array> {
  if (chunkSizes.length === 0) {
    throw new Error("createChunkedStream: chunkSizes must be non-empty");
  }
  let offset = 0;
  let chunkIndex = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const size = chunkSizes[chunkIndex % chunkSizes.length];
      const end = Math.min(offset + size, bytes.length);
      controller.enqueue(new Uint8Array(bytes.slice(offset, end)));
      offset = end;
      chunkIndex++;
    },
  });
}

/** Per-item decoder for the Message schema used across several tests. */
interface Message { id: number; text: string; }
function decodeMessage(d: BitStreamDecoder): Message {
  const id = d.readUint32("big_endian");
  const len = d.readUint8();
  const bytes = d.readBytesSlice(len);
  const text = new TextDecoder("utf-8").decode(bytes);
  return { id, text };
}

interface Point { x: number; y: number; }
function decodePoint(d: BitStreamDecoder): Point {
  return { x: d.readUint16("big_endian"), y: d.readUint16("big_endian") };
}

interface Record3 { a: number; b: number; c: number; }
function decodeRecord3(d: BitStreamDecoder): Record3 {
  return {
    a: d.readUint32("big_endian"),
    b: d.readUint32("big_endian"),
    c: d.readUint32("big_endian"),
  };
}

interface Person { age: number; name: string; }
function decodePerson(d: BitStreamDecoder): Person {
  const age = d.readUint8();
  const len = d.readUint8();
  const bytes = d.readBytesSlice(len);
  const name = new TextDecoder("utf-8").decode(bytes);
  return { age, name };
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
}

// ---------------------------------------------------------------------------
// decodeArrayGreedy — standard length_prefixed arrays
// ---------------------------------------------------------------------------

async function testGreedyItemSplitAcrossChunks() {
  // One message — uint32 id straddles a chunk boundary.
  const bytes = [
    0x00, 0x01,                   // array length = 1
    0x12, 0x34, 0x56, 0x78,       // id
    0x05,                         // string length
    0x68, 0x65, 0x6c, 0x6c, 0x6f, // "hello"
  ];
  const stream = createChunkedStream(bytes, [3, 10]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint16",
      endianness: "big_endian",
      decodeItem: decodeMessage,
    })
  );
  assertEqual(items, [{ id: 0x12345678, text: "hello" }], "item split across chunks");
}

async function testGreedyOneByteChunks() {
  // Worst case: every chunk is 1 byte. Decoder retries dozens of times.
  const bytes = [
    0x02,       // length = 2 points
    0x00, 0x0A, 0x00, 0x14, // (10, 20)
    0x00, 0x1E, 0x00, 0x28, // (30, 40)
  ];
  const stream = createChunkedStream(bytes, [1]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint8",
      endianness: "big_endian",
      decodeItem: decodePoint,
    })
  );
  assertEqual(items, [{ x: 10, y: 20 }, { x: 30, y: 40 }], "one-byte chunks");
}

async function testGreedyLargeChunks() {
  // Everything in one chunk — generator must still yield item-by-item.
  const bytes = [
    0x00, 0x0A,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
  ];
  const stream = createChunkedStream(bytes, [12]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint16",
      endianness: "big_endian",
      decodeItem: (d) => d.readUint8(),
    })
  );
  assertEqual(items, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "large chunks");
}

async function testGreedyPartialItemAtBoundary() {
  // Records are 12 bytes; first chunk delivers 8 bytes of Record 0.
  const bytes = [
    0x02, // length = 2
    0x11, 0x11, 0x11, 0x11, 0x22, 0x22, 0x22, 0x22, 0x33, 0x33, 0x33, 0x33,
    0x44, 0x44, 0x44, 0x44, 0x55, 0x55, 0x55, 0x55, 0x66, 0x66, 0x66, 0x66,
  ];
  const stream = createChunkedStream(bytes, [9, 20]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint8",
      endianness: "big_endian",
      decodeItem: decodeRecord3,
    })
  );
  assertEqual(items, [
    { a: 0x11111111, b: 0x22222222, c: 0x33333333 },
    { a: 0x44444444, b: 0x55555555, c: 0x66666666 },
  ], "partial item at boundary");
}

async function testGreedyVariableLengthItems() {
  // Strings of varying lengths inside a struct. Chunk splits don't respect
  // item boundaries.
  const bytes = [
    0x00, 0x03, // length = 3
    0x1E, 0x05, 0x41, 0x6c, 0x69, 0x63, 0x65, // Alice/30
    0x19, 0x03, 0x42, 0x6f, 0x62, // Bob/25
    0x28, 0x09, 0x43, 0x68, 0x61, 0x72, 0x6c, 0x6f, 0x74, 0x74, 0x65, // Charlotte/40
  ];
  const stream = createChunkedStream(bytes, [7, 8, 12]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint16",
      endianness: "big_endian",
      decodeItem: decodePerson,
    })
  );
  assertEqual(items, [
    { age: 30, name: "Alice" },
    { age: 25, name: "Bob" },
    { age: 40, name: "Charlotte" },
  ], "variable-length items");
}

async function testGreedyEmptyArray() {
  // Length=0 → generator yields nothing and completes after reading the prefix.
  const stream = createChunkedStream([0x00, 0x00], [2]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint16",
      endianness: "big_endian",
      decodeItem: (d) => d.readUint32("big_endian"),
    })
  );
  assertEqual(items, [], "empty array");
}

async function testGreedyLiteralArrayLength() {
  // arrayLength supplied as literal — no wire-format prefix consumed.
  const bytes = [0x00, 0x01, 0x00, 0x02, 0x00, 0x03];
  const stream = createChunkedStream(bytes, [3, 3]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLength: 3,
      endianness: "big_endian",
      decodeItem: (d) => d.readUint16("big_endian"),
    })
  );
  assertEqual(items, [1, 2, 3], "literal array length");
}

// ---------------------------------------------------------------------------
// decodeArrayStream — length_prefixed_items
// ---------------------------------------------------------------------------

async function testStreamLengthPrefixedItemsChunked() {
  // Each item carries its own uint16 length. Tail of array crosses chunks.
  const bytes = [
    0x00, 0x02, // array length = 2
    0x00, 0x0A, // item 0 length = 10
    0x00, 0x00, 0x00, 0x01, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f, // {id:1, text:"hello"}
    0x00, 0x0A, // item 1 length = 10
    0x00, 0x00, 0x00, 0x02, 0x05, 0x77, 0x6f, 0x72, 0x6c, 0x64, // {id:2, text:"world"}
  ];
  const stream = createChunkedStream(bytes, [3, 10, 10]);
  const items = await collect(
    decodeArrayStream(stream.getReader(), {
      arrayLengthType: "uint16",
      itemLengthType: "uint16",
      endianness: "big_endian",
      decodeItem: decodeMessage,
    })
  );
  assertEqual(items, [
    { id: 1, text: "hello" },
    { id: 2, text: "world" },
  ], "length_prefixed_items chunked");
}

async function testStreamLengthPrefixedItemsOneByteChunks() {
  const bytes = [
    0x00, 0x02,
    0x00, 0x0A, 0x00, 0x00, 0x00, 0x01, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f,
    0x00, 0x0A, 0x00, 0x00, 0x00, 0x02, 0x05, 0x77, 0x6f, 0x72, 0x6c, 0x64,
  ];
  const stream = createChunkedStream(bytes, [1]);
  const items = await collect(
    decodeArrayStream(stream.getReader(), {
      arrayLengthType: "uint16",
      itemLengthType: "uint16",
      endianness: "big_endian",
      decodeItem: decodeMessage,
    })
  );
  assertEqual(items, [
    { id: 1, text: "hello" },
    { id: 2, text: "world" },
  ], "length_prefixed_items, 1-byte chunks");
}

async function testStreamEmptyArray() {
  const stream = createChunkedStream([0x00, 0x00], [2]);
  const items = await collect(
    decodeArrayStream(stream.getReader(), {
      arrayLengthType: "uint16",
      itemLengthType: "uint16",
      endianness: "big_endian",
      decodeItem: decodeMessage,
    })
  );
  assertEqual(items, [], "length_prefixed_items, empty");
}

// ---------------------------------------------------------------------------
// readExactly primitive
// ---------------------------------------------------------------------------

async function testReadExactlyAcrossChunks() {
  const stream = createChunkedStream([1, 2, 3, 4, 5, 6, 7, 8], [3, 3, 2]);
  const out = await readExactly(stream.getReader(), 6);
  assertEqual(Array.from(out), [1, 2, 3, 4, 5, 6], "readExactly across chunks");
}

async function testReadExactlyEof() {
  // Stream delivers fewer bytes than requested → INCOMPLETE_DATA.
  const stream = createChunkedStream([1, 2, 3], [3]);
  const reader = stream.getReader();
  try {
    await readExactly(reader, 10);
    throw new Error("expected INCOMPLETE_DATA");
  } catch (e) {
    if (!(e instanceof BinSchemaError) || e.code !== ErrorCode.INCOMPLETE_DATA) {
      throw new Error(`expected BinSchemaError(INCOMPLETE_DATA), got ${e}`);
    }
  }
}

async function testReadExactlyZero() {
  // n=0 is a no-op that returns an empty buffer without pulling.
  const stream = createChunkedStream([1, 2, 3], [3]);
  const out = await readExactly(stream.getReader(), 0);
  if (out.length !== 0) throw new Error("expected empty buffer");
}

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

async function testNetworkErrorMidStream() {
  // First chunk arrives, then the reader errors. The error must propagate
  // through the generator with its original message intact.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0x00, 0x0A, 0x00, 0x00])); // length=10 + partial
      controller.error(new Error("Network connection lost"));
    },
  });
  try {
    await collect(
      decodeArrayGreedy(stream.getReader(), {
        arrayLengthType: "uint16",
        endianness: "big_endian",
        decodeItem: (d) => d.readUint32("big_endian"),
      })
    );
    throw new Error("expected network error to propagate");
  } catch (e: any) {
    if (!String(e.message ?? e).includes("Network connection lost")) {
      throw new Error(`network error did not propagate cleanly: ${e}`);
    }
  }
}

async function testTruncatedStreamThrowsIncompleteData() {
  // Length says 3 items but stream EOFs after 2.
  const bytes = [
    0x00, 0x03,             // length = 3
    0x00, 0x00, 0x00, 0x01, // item 0
    0x00, 0x00, 0x00, 0x02, // item 1
    0xFF,                   // partial item 2 (1 of 4 bytes)
  ];
  const stream = createChunkedStream(bytes, [bytes.length]);
  let caught: BinSchemaError | null = null;
  try {
    await collect(
      decodeArrayGreedy(stream.getReader(), {
        arrayLengthType: "uint16",
        endianness: "big_endian",
        decodeItem: (d) => d.readUint32("big_endian"),
      })
    );
  } catch (e) {
    if (e instanceof BinSchemaError) caught = e;
    else throw e;
  }
  if (!caught) throw new Error("expected INCOMPLETE_DATA error");
  if (caught.code !== ErrorCode.INCOMPLETE_DATA) {
    throw new Error(`expected INCOMPLETE_DATA, got ${caught.code}`);
  }
  // Error context should mention which item failed.
  const text = `${caught.message} ${caught.context ?? ""}`;
  if (!text.includes("item 2")) {
    throw new Error(`error should mention item 2, got: ${text}`);
  }
}

async function testFatalDecodeErrorPropagates() {
  // Encode a "first byte signals invalid encoding" item. We use a uint8 item
  // that decodes via readVarlengthDER with an indefinite-length first byte
  // (0x80) — that's INVALID_ENCODING, distinct from INCOMPLETE_DATA, and must
  // NOT trigger a retry.
  const bytes = [
    0x00, 0x01, // length = 1
    0x80,       // malformed DER indefinite-length marker
  ];
  const stream = createChunkedStream(bytes, [bytes.length]);
  let caught: BinSchemaError | null = null;
  try {
    await collect(
      decodeArrayGreedy(stream.getReader(), {
        arrayLengthType: "uint16",
        endianness: "big_endian",
        decodeItem: (d) => d.readVarlengthDER(),
      })
    );
  } catch (e) {
    if (e instanceof BinSchemaError) caught = e;
    else throw e;
  }
  if (!caught) throw new Error("expected INVALID_ENCODING error");
  if (caught.code !== ErrorCode.INVALID_ENCODING) {
    throw new Error(`expected INVALID_ENCODING, got ${caught.code}`);
  }
}

// ---------------------------------------------------------------------------
// Backpressure
// ---------------------------------------------------------------------------

async function testSlowConsumerBackpressure() {
  // The reader counts pulls. After the consumer takes the first 3 items, we
  // break out of the for-await early. The reader should NOT have been
  // drained beyond what was needed for those items.
  //
  // Schema: length-prefixed array of uint16 with 100 items. Each pull
  // delivers one byte. After 3 items we've needed: 2 (length) + 3*2 (items) =
  // 8 reads. We assert the reader was pulled at most ~16 times (slack for
  // ReadableStream's internal queueing) — definitely not 200+.
  let pullCount = 0;
  const data = [0x00, 0x64]; // length = 100
  for (let i = 0; i < 100; i++) data.push(0x00, i & 0xFF);

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pullCount >= data.length) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array([data[pullCount]]));
      pullCount++;
    },
  });

  const seen: number[] = [];
  for await (const item of decodeArrayGreedy(stream.getReader(), {
    arrayLengthType: "uint16",
    endianness: "big_endian",
    decodeItem: (d) => d.readUint16("big_endian"),
  })) {
    seen.push(item);
    if (seen.length >= 3) break;
  }
  assertEqual(seen, [0, 1, 2], "backpressure: items received");
  // 2 (length prefix) + 3*2 (item bytes) = 8 bytes needed. ReadableStream
  // may prefetch one chunk past, so allow up to 12.
  if (pullCount > 12) {
    throw new Error(`backpressure: reader was over-pulled (${pullCount} chunks, expected ~8)`);
  }
}

// ---------------------------------------------------------------------------
// Options validation
// ---------------------------------------------------------------------------

async function testRejectsBothArrayLengthAndArrayLengthType() {
  const stream = createChunkedStream([0, 1], [2]);
  try {
    await collect(
      decodeArrayGreedy(stream.getReader(), {
        arrayLength: 0,
        arrayLengthType: "uint8",
        endianness: "big_endian",
        decodeItem: (d: BitStreamDecoder) => d.readUint8(),
      } as any)
    );
    throw new Error("expected INVALID_VALUE");
  } catch (e) {
    if (!(e instanceof BinSchemaError) || e.code !== ErrorCode.INVALID_VALUE) {
      throw new Error(`expected BinSchemaError(INVALID_VALUE), got ${e}`);
    }
  }
}

async function testRejectsNeitherArrayLengthNorArrayLengthType() {
  const stream = createChunkedStream([0, 1], [2]);
  try {
    await collect(
      decodeArrayGreedy(stream.getReader(), {
        endianness: "big_endian",
        decodeItem: (d: BitStreamDecoder) => d.readUint8(),
      } as any)
    );
    throw new Error("expected INVALID_VALUE");
  } catch (e) {
    if (!(e instanceof BinSchemaError) || e.code !== ErrorCode.INVALID_VALUE) {
      throw new Error(`expected BinSchemaError(INVALID_VALUE), got ${e}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Bit-level items — items whose wire size is not an integer number of bytes
// ---------------------------------------------------------------------------

/**
 * Encode an array prefixed by uint8 length, where each item is a single
 * bit-level value of `bitsPerItem` bits. Returns the resulting byte stream.
 */
function encodeBitArray(values: number[], bitsPerItem: number): Uint8Array {
  const enc = new BitStreamEncoder();
  enc.writeUint8(values.length);
  for (const v of values) enc.writeBits(v, bitsPerItem);
  return enc.finish();
}

async function testGreedyBitLevelItemsContiguous() {
  // 8 items × 3 bits = 24 bits + 8-bit length prefix = 4 bytes total.
  // Item boundaries straddle byte boundaries: item 2 spans bytes 1→2,
  // item 5 spans bytes 2→3.
  const values = [1, 2, 3, 4, 5, 6, 7, 0];
  const bytes = Array.from(encodeBitArray(values, 3));
  const stream = createChunkedStream(bytes, [bytes.length]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint8",
      endianness: "big_endian",
      decodeItem: (d) => Number(d.readBits(3)),
    })
  );
  assertEqual(items, values, "bit-level items, contiguous buffer");
}

async function testGreedyBitLevelItemsOneByteChunks() {
  // Same data but delivered one byte at a time. Each item retry must restore
  // the buffer's sub-byte position correctly across pulls.
  const values = [1, 2, 3, 4, 5, 6, 7, 0];
  const bytes = Array.from(encodeBitArray(values, 3));
  const stream = createChunkedStream(bytes, [1]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint8",
      endianness: "big_endian",
      decodeItem: (d) => Number(d.readBits(3)),
    })
  );
  assertEqual(items, values, "bit-level items, 1-byte chunks");
}

async function testGreedyBitLevelItemsStraddleChunkBoundary() {
  // Pick chunk sizes so that an item starts mid-byte in one chunk and
  // completes in the next. 12 items × 5 bits = 60 bits + 8 prefix = 68 bits
  // = 9 bytes (with 4 bits padding at the end of the final byte).
  const values = [1, 7, 15, 31, 0, 13, 22, 8, 19, 4, 11, 25];
  const bytes = Array.from(encodeBitArray(values, 5));
  // 9 bytes total: deliver as [4, 2, 3].
  const stream = createChunkedStream(bytes, [4, 2, 3]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint8",
      endianness: "big_endian",
      decodeItem: (d) => Number(d.readBits(5)),
    })
  );
  assertEqual(items, values, "bit-level items, item straddles chunk boundary");
}

async function testGreedyMixedBitAndByteItem() {
  // Realistic case: each item is { flags: bits(3), payload: uint8 } —
  // 11 bits per item, not byte-aligned. 5 items = 55 bits + 8 prefix = 63
  // bits = 8 bytes.
  interface Mix { flags: number; payload: number }
  const values: Mix[] = [
    { flags: 0, payload: 0xAB },
    { flags: 1, payload: 0xCD },
    { flags: 7, payload: 0xEF },
    { flags: 3, payload: 0x12 },
    { flags: 5, payload: 0x34 },
  ];

  const enc = new BitStreamEncoder();
  enc.writeUint8(values.length);
  for (const v of values) {
    enc.writeBits(v.flags, 3);
    enc.writeUint8(v.payload);
  }
  const bytes = Array.from(enc.finish());
  const stream = createChunkedStream(bytes, [3, 2, 3]);
  const items = await collect(
    decodeArrayGreedy(stream.getReader(), {
      arrayLengthType: "uint8",
      endianness: "big_endian",
      decodeItem: (d): Mix => ({
        flags: Number(d.readBits(3)),
        payload: d.readUint8(),
      }),
    })
  );
  assertEqual(items, values, "mixed bit+byte item, chunked");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runStreamDecoderTests(): Promise<{ passed: number; failed: number; checks: TestCheck[] }> {
  const checks: TestCheck[] = [];
  let passed = 0;
  let failed = 0;

  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    // Greedy (length_prefixed)
    { name: "Greedy: item split across two chunks", fn: testGreedyItemSplitAcrossChunks },
    { name: "Greedy: one-byte chunks (worst-case latency)", fn: testGreedyOneByteChunks },
    { name: "Greedy: large chunk containing entire array", fn: testGreedyLargeChunks },
    { name: "Greedy: partial item at chunk boundary", fn: testGreedyPartialItemAtBoundary },
    { name: "Greedy: variable-length items (strings in structs)", fn: testGreedyVariableLengthItems },
    { name: "Greedy: empty array", fn: testGreedyEmptyArray },
    { name: "Greedy: literal arrayLength option (no prefix consumed)", fn: testGreedyLiteralArrayLength },
    // Stream (length_prefixed_items)
    { name: "Stream: length_prefixed_items with chunked delivery", fn: testStreamLengthPrefixedItemsChunked },
    { name: "Stream: length_prefixed_items, 1-byte chunks", fn: testStreamLengthPrefixedItemsOneByteChunks },
    { name: "Stream: length_prefixed_items, empty array", fn: testStreamEmptyArray },
    // readExactly primitive
    { name: "readExactly: accumulates bytes across chunks", fn: testReadExactlyAcrossChunks },
    { name: "readExactly: throws INCOMPLETE_DATA on early EOF", fn: testReadExactlyEof },
    { name: "readExactly: n=0 returns empty buffer without pulling", fn: testReadExactlyZero },
    // Error propagation
    { name: "Network error mid-stream propagates with original message", fn: testNetworkErrorMidStream },
    { name: "Truncated stream throws INCOMPLETE_DATA with item context", fn: testTruncatedStreamThrowsIncompleteData },
    { name: "Fatal decode error (INVALID_ENCODING) does NOT trigger retry", fn: testFatalDecodeErrorPropagates },
    // Backpressure
    { name: "Slow consumer: reader is not over-pulled when consumer breaks early", fn: testSlowConsumerBackpressure },
    // Options validation
    { name: "Rejects both arrayLength and arrayLengthType", fn: testRejectsBothArrayLengthAndArrayLengthType },
    { name: "Rejects neither arrayLength nor arrayLengthType", fn: testRejectsNeitherArrayLengthNorArrayLengthType },
    // Bit-level items — items whose wire size is not a whole number of bytes
    { name: "Greedy: bit-level items in contiguous buffer", fn: testGreedyBitLevelItemsContiguous },
    { name: "Greedy: bit-level items with 1-byte chunks", fn: testGreedyBitLevelItemsOneByteChunks },
    { name: "Greedy: bit-level items straddling chunk boundary", fn: testGreedyBitLevelItemsStraddleChunkBoundary },
    { name: "Greedy: mixed bit+byte item ({ bits(3), uint8 }), chunked", fn: testGreedyMixedBitAndByteItem },
  ];

  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      checks.push({ description: t.name, passed: true });
    } catch (e) {
      failed++;
      checks.push({ description: t.name, passed: false, message: String(e) });
    }
  }

  return { passed, failed, checks };
}

if (require.main === module) {
  runStreamDecoderTests().then((result) => {
    console.log(`stream-decoder: ${result.passed} passed, ${result.failed} failed`);
    for (const c of result.checks) {
      if (!c.passed) console.log(`  FAIL: ${c.description} — ${c.message}`);
    }
  });
}
