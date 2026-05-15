/**
 * Streaming decoder primitives for chunked input sources (network sockets,
 * fetch ReadableStream, etc.).
 *
 * The synchronous `BitStreamDecoder` requires the entire input upfront. The
 * primitives in this file wrap a `ReadableStreamDefaultReader<Uint8Array>` so
 * decoding can proceed as bytes arrive, yielding items one at a time without
 * buffering the whole array.
 *
 * Core mechanism: retry-on-INCOMPLETE_DATA. Each per-item decode is attempted
 * over the current accumulated buffer; if the decoder throws `BinSchemaError`
 * with `code === INCOMPLETE_DATA`, the streaming layer pulls another chunk
 * from the underlying reader and retries from the saved position. Any other
 * error is fatal and propagates to the caller.
 *
 * Two flavours are provided:
 *
 * - `decodeArrayStream` — for arrays with per-item length prefixes
 *   (`length_prefixed_items` schema kind). The streaming layer reads the
 *   prefix, calls `readExactly(reader, N)` to obtain a complete item slice,
 *   then runs the user's `decodeItem` over the slice. No speculation needed.
 *
 * - `decodeArrayGreedy` — for arrays without per-item prefixes
 *   (`length_prefixed` and similar). The streaming layer speculatively
 *   attempts `decodeItem` against the current buffer; on INCOMPLETE_DATA it
 *   refills and retries.
 *
 * Both flavours return `AsyncGenerator<T>`. Backpressure is natural: the
 * generator only pulls from the underlying reader when the consumer asks for
 * another item.
 */

import { BitStreamDecoder, type Endianness } from "./bit-stream.js";
import { BinSchemaError, ErrorCode } from "./errors.js";

/** Length-prefix integer widths supported by the streaming primitives. */
export type LengthType = "uint8" | "uint16" | "uint32";

function lengthTypeBytes(t: LengthType): number {
  switch (t) {
    case "uint8":
      return 1;
    case "uint16":
      return 2;
    case "uint32":
      return 4;
  }
}

/**
 * Buffered accumulator over a `ReadableStreamDefaultReader<Uint8Array>`.
 *
 * Owns a growable byte buffer of "received but not yet consumed" bytes, plus
 * a sub-byte `headBitOffset` (0-7) tracking the bit position within
 * `bytes[0]` where the next unread bit lives. The bit offset is essential
 * for items whose wire size is not a whole number of bytes — e.g. an array
 * of 3-bit fields packs items densely across byte boundaries, and the
 * streaming layer cannot truncate the head byte until all its bits have
 * been consumed.
 *
 * Pull more bytes via `pullChunk()`, consume a (byteDelta, bitDelta) prefix
 * via `advance()`, snapshot/inspect via `bytes` + `headBitOffset`.
 *
 * Not exported as a class for now — callers go through the higher-level
 * generators. Exposed only to the streaming primitives in this file.
 */
class StreamingBuffer {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffer: Uint8Array = new Uint8Array(0);
  private _headBitOffset: number = 0;
  private eof: boolean = false;

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.reader = reader;
  }

  /** Bytes currently buffered (zero-copy view; do not mutate). */
  get bytes(): Uint8Array {
    return this.buffer;
  }

  /**
   * Bit offset within `bytes[0]` of the next unread bit. Always 0 after
   * byte-aligned operations; non-zero when the previous item ended mid-byte.
   */
  get headBitOffset(): number {
    return this._headBitOffset;
  }

  /** True once the underlying reader has signalled EOF. */
  get isEof(): boolean {
    return this.eof;
  }

  /**
   * Pull one more chunk from the underlying reader and append it to the
   * buffer. Returns the number of bytes added (0 if EOF was reached).
   *
   * Errors from `reader.read()` propagate unchanged — these are typically
   * network errors that the caller wants to surface as-is.
   */
  async pullChunk(): Promise<number> {
    if (this.eof) return 0;
    const { value, done } = await this.reader.read();
    if (done) {
      this.eof = true;
      return 0;
    }
    if (!value || value.length === 0) {
      // Spurious empty chunk — treat as no-op so the caller can decide
      // whether to retry or surface as EOF.
      return 0;
    }
    if (this.buffer.length === 0) {
      this.buffer = value;
    } else {
      const merged = new Uint8Array(this.buffer.length + value.length);
      merged.set(this.buffer, 0);
      merged.set(value, this.buffer.length);
      this.buffer = merged;
    }
    return value.length;
  }

  /**
   * Drop the first `n` bytes from the buffer and reset headBitOffset to 0.
   * Caller must guarantee `n <= buffer.length`. Use this for byte-aligned
   * consumption (length prefixes, length_prefixed_items item slices).
   */
  consume(n: number): void {
    if (n < 0 || n > this.buffer.length) {
      throw new BinSchemaError(
        ErrorCode.INVALID_VALUE,
        `StreamingBuffer.consume(${n}) out of range (buffered=${this.buffer.length})`
      );
    }
    this.buffer = this.buffer.subarray(n);
    this._headBitOffset = 0;
  }

  /**
   * Advance the buffer head to absolute position `(byteOffset, bitOffset)`
   * within the current buffer (measured from `bytes[0]` ignoring the
   * existing headBitOffset — caller passes the decoder's raw post-read
   * position). The buffer's first `byteOffset` bytes are dropped; the
   * remainder is preserved with `_headBitOffset = bitOffset`.
   *
   * If `bitOffset > 0`, byte `byteOffset` is retained because it still
   * contains unread bits. If `bitOffset === 0`, byte `byteOffset` is the
   * next byte to read from bit 0 (no retention needed beyond it).
   */
  advance(byteOffset: number, bitOffset: number): void {
    if (bitOffset < 0 || bitOffset > 7) {
      throw new BinSchemaError(
        ErrorCode.INVALID_VALUE,
        `StreamingBuffer.advance bitOffset ${bitOffset} out of range`
      );
    }
    if (byteOffset < 0 || byteOffset > this.buffer.length) {
      throw new BinSchemaError(
        ErrorCode.INVALID_VALUE,
        `StreamingBuffer.advance byteOffset ${byteOffset} out of range (buffered=${this.buffer.length})`
      );
    }
    this.buffer = this.buffer.subarray(byteOffset);
    this._headBitOffset = bitOffset;
  }

  /**
   * Ensure at least `n` whole bytes are buffered (the head bit offset is
   * counted against `bytes[0]`; this method is byte-granular). Pulls chunks
   * as needed. Throws `BinSchemaError(INCOMPLETE_DATA)` if EOF arrives first.
   */
  async ensure(n: number): Promise<void> {
    while (this.buffer.length < n) {
      const added = await this.pullChunk();
      if (added === 0 && this.buffer.length < n) {
        throw new BinSchemaError(
          ErrorCode.INCOMPLETE_DATA,
          `Stream ended with ${this.buffer.length} buffered bytes, needed ${n}`
        );
      }
    }
  }

  /**
   * Construct a fresh BitStreamDecoder over the current buffer, seeked to
   * the current headBitOffset so the next decode resumes from the correct
   * sub-byte position. Returns null if the buffer is empty (the decoder
   * would have no head byte to anchor a non-zero bit offset to).
   */
  decoderAtHead(): BitStreamDecoder {
    const d = new BitStreamDecoder(this.buffer);
    if (this._headBitOffset > 0) {
      // Must have at least one buffered byte for the bit offset to be valid.
      if (this.buffer.length === 0) {
        throw new BinSchemaError(
          ErrorCode.INCOMPLETE_DATA,
          `StreamingBuffer has non-zero headBitOffset but empty buffer (internal invariant violated)`
        );
      }
      d.seekBits(0, this._headBitOffset);
    }
    return d;
  }
}

/**
 * Pull bytes from a reader until exactly `n` have been received, then return
 * them as a contiguous Uint8Array. The bytes are consumed (not peeked).
 *
 * Throws `BinSchemaError(INCOMPLETE_DATA)` if EOF arrives before `n` bytes
 * have been collected. Other errors from `reader.read()` propagate unchanged.
 *
 * This is the lowest-level streaming primitive. Higher-level generators use
 * it internally to read length prefixes and item-sized slices.
 */
export async function readExactly(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  n: number
): Promise<Uint8Array> {
  if (n < 0) {
    throw new BinSchemaError(ErrorCode.INVALID_VALUE, `readExactly(n=${n}) requires non-negative n`);
  }
  if (n === 0) return new Uint8Array(0);

  const out = new Uint8Array(n);
  let filled = 0;

  // Drain reader.read() until we have `n` bytes. Each call may return less
  // than the remaining need, more (in which case the unused tail is lost —
  // see note below), or done=true (EOF).
  //
  // Note: this primitive does not retain unconsumed bytes. If a chunk arrives
  // that overshoots `n`, the surplus is discarded. Callers that need to
  // preserve overshoot should use `StreamingBuffer` directly.
  while (filled < n) {
    const { value, done } = await reader.read();
    if (done) {
      throw new BinSchemaError(
        ErrorCode.INCOMPLETE_DATA,
        `Stream ended after ${filled} bytes, expected ${n}`
      );
    }
    if (!value || value.length === 0) continue;

    const take = Math.min(value.length, n - filled);
    out.set(value.subarray(0, take), filled);
    filled += take;
    if (take < value.length) {
      // Surplus bytes in the chunk are discarded. This is a documented
      // limitation of the bare `readExactly` helper.
      break;
    }
  }
  return out;
}

/**
 * Read a length-prefix integer from a StreamingBuffer.
 *
 * Internal helper; pulls additional chunks until enough bytes are buffered,
 * then decodes a uint8/uint16/uint32 of the given endianness, advances the
 * buffer past the prefix bytes (or bits, if the buffer was at a non-zero
 * headBitOffset due to a prior bit-level item).
 */
async function readLengthFromBuffer(
  buf: StreamingBuffer,
  type: LengthType,
  endianness: Endianness
): Promise<number> {
  const n = lengthTypeBytes(type);
  // Need n full bytes of payload past the head bit offset. If the head is
  // mid-byte, the head byte contributes only (8 - headBitOffset) bits, so
  // we still need n bytes of buffer (the head byte itself plus n-1 more)
  // when headBitOffset === 0, and one extra byte when headBitOffset > 0.
  const extra = buf.headBitOffset > 0 ? 1 : 0;
  await buf.ensure(n + extra);
  const d = buf.decoderAtHead();
  let value: number;
  switch (type) {
    case "uint8":
      value = d.readUint8();
      break;
    case "uint16":
      value = d.readUint16(endianness);
      break;
    case "uint32":
      value = d.readUint32(endianness);
      break;
  }
  buf.advance(d.position, d.currentBitOffset);
  return value;
}

/**
 * Options shared by both streaming generators.
 *
 * The array length is supplied either as a literal (caller already knows it,
 * e.g. fixed-size arrays) or as a wire-format prefix that the generator will
 * read for you (the common case for `length_prefixed` / `length_prefixed_items`).
 *
 * Exactly one of `arrayLength` and `arrayLengthType` must be set.
 */
export interface ArrayStreamOptionsBase<T> {
  /** Literal item count (when known statically). Mutually exclusive with arrayLengthType. */
  arrayLength?: number;
  /** Type of the wire-format length prefix at the start of the array. */
  arrayLengthType?: LengthType;
  /** Endianness for length prefixes (and item length prefixes, where applicable). */
  endianness: Endianness;
  /**
   * Per-item decoder. Called with a freshly constructed BitStreamDecoder over
   * the current buffer (or item slice). Must consume exactly the bytes of one
   * item; the streaming layer uses `decoder.position` to figure out how many
   * bytes were consumed.
   *
   * For incomplete data the function should let the underlying BitStreamDecoder
   * throw BinSchemaError(INCOMPLETE_DATA) — do not catch it.
   */
  decodeItem: (decoder: BitStreamDecoder) => T;
}

/**
 * Options for `decodeArrayStream` — used with arrays that have per-item
 * length prefixes (`length_prefixed_items` schema kind).
 *
 * Each item is preceded by a uint8/uint16/uint32 prefix giving its byte
 * length. The streaming layer reads the prefix, slices off that many bytes,
 * and hands them to `decodeItem`. No speculative decoding needed; this is
 * the fast path.
 */
export interface LengthPrefixedItemsStreamOptions<T> extends ArrayStreamOptionsBase<T> {
  /** Type of the per-item length prefix that precedes each item's payload. */
  itemLengthType: LengthType;
}

/**
 * Options for `decodeArrayGreedy` — used with arrays that have no per-item
 * length prefix.
 *
 * The streaming layer speculatively runs `decodeItem` against the current
 * buffer. On INCOMPLETE_DATA it refills and retries; any other error is fatal.
 */
export type GreedyStreamOptions<T> = ArrayStreamOptionsBase<T>;

/**
 * Resolve the array length from options. Validates that exactly one source
 * is provided.
 */
async function resolveArrayLength<T>(
  buf: StreamingBuffer,
  opts: ArrayStreamOptionsBase<T>
): Promise<number> {
  const hasLiteral = opts.arrayLength !== undefined;
  const hasType = opts.arrayLengthType !== undefined;
  if (hasLiteral === hasType) {
    throw new BinSchemaError(
      ErrorCode.INVALID_VALUE,
      "Streaming options require exactly one of arrayLength or arrayLengthType"
    );
  }
  if (hasLiteral) {
    if (!Number.isInteger(opts.arrayLength!) || opts.arrayLength! < 0) {
      throw new BinSchemaError(
        ErrorCode.INVALID_VALUE,
        `arrayLength must be a non-negative integer, got ${opts.arrayLength}`
      );
    }
    return opts.arrayLength!;
  }
  return readLengthFromBuffer(buf, opts.arrayLengthType!, opts.endianness);
}

/**
 * Stream-decode an array with per-item length prefixes
 * (`length_prefixed_items` schema kind).
 *
 * For each item: read the item-length prefix, accumulate exactly that many
 * bytes from the underlying reader, then call `decodeItem` over the slice.
 * Items are yielded one at a time; the caller drives backpressure by pacing
 * its `for await` loop.
 *
 * @example
 * ```ts
 * for await (const message of decodeArrayStream(reader, {
 *   arrayLengthType: "uint16",
 *   itemLengthType: "uint16",
 *   endianness: "big_endian",
 *   decodeItem: (d) => ({ id: d.readUint32("big_endian"), text: readString(d) }),
 * })) {
 *   handle(message);
 * }
 * ```
 */
export async function* decodeArrayStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  opts: LengthPrefixedItemsStreamOptions<T>
): AsyncGenerator<T, void, void> {
  const buf = new StreamingBuffer(reader);
  const total = await resolveArrayLength(buf, opts);

  for (let i = 0; i < total; i++) {
    let itemLen: number;
    try {
      itemLen = await readLengthFromBuffer(buf, opts.itemLengthType, opts.endianness);
    } catch (e) {
      if (e instanceof BinSchemaError && e.code === ErrorCode.INCOMPLETE_DATA) {
        throw new BinSchemaError(
          ErrorCode.INCOMPLETE_DATA,
          `Stream ended while reading item-length prefix for item ${i}/${total}`,
          { context: `item ${i}/${total}`, cause: e }
        );
      }
      throw e;
    }

    try {
      await buf.ensure(itemLen);
    } catch (e) {
      if (e instanceof BinSchemaError && e.code === ErrorCode.INCOMPLETE_DATA) {
        throw new BinSchemaError(
          ErrorCode.INCOMPLETE_DATA,
          `Stream ended while reading item ${i}/${total} (expected ${itemLen} bytes)`,
          { context: `item ${i}/${total}`, cause: e }
        );
      }
      throw e;
    }

    const itemSlice = buf.bytes.subarray(0, itemLen);
    const d = new BitStreamDecoder(itemSlice);
    let item: T;
    try {
      item = opts.decodeItem(d);
    } catch (e) {
      // Annotate the item index for caller diagnostics.
      if (e instanceof BinSchemaError) {
        throw new BinSchemaError(
          e.code,
          `Failed to decode item ${i}/${total}: ${e.message}`,
          { context: `item ${i}/${total}`, cause: e, position: e.position }
        );
      }
      throw e;
    }
    buf.consume(itemLen);
    yield item;
  }
}

/**
 * Stream-decode an array without per-item length prefixes
 * (`length_prefixed` schema kind, fixed arrays, etc.).
 *
 * For each item: speculatively run `decodeItem` against the current buffer.
 * If it throws `BinSchemaError(INCOMPLETE_DATA)`, refill from the reader and
 * retry. Any other error is fatal.
 *
 * Works for variable-length items (e.g. structs containing length-prefixed
 * strings) because the per-attempt decoder consumes the item's own framing.
 */
export async function* decodeArrayGreedy<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  opts: GreedyStreamOptions<T>
): AsyncGenerator<T, void, void> {
  const buf = new StreamingBuffer(reader);
  const total = await resolveArrayLength(buf, opts);

  for (let i = 0; i < total; i++) {
    let item: T;
    let endByte: number;
    let endBit: number;

    while (true) {
      let d: BitStreamDecoder;
      try {
        d = buf.decoderAtHead();
      } catch (e) {
        // Internal invariant — empty buffer with non-zero headBitOffset
        // surfaces as INCOMPLETE_DATA so the retry loop can pull more.
        if (e instanceof BinSchemaError && e.code === ErrorCode.INCOMPLETE_DATA) {
          const added = await buf.pullChunk();
          if (added === 0 && buf.isEof) {
            throw new BinSchemaError(
              ErrorCode.INCOMPLETE_DATA,
              `Stream ended mid-item (item ${i}/${total}, head bit offset ${buf.headBitOffset})`,
              { context: `item ${i}/${total}`, cause: e }
            );
          }
          continue;
        }
        throw e;
      }
      try {
        item = opts.decodeItem(d);
        endByte = d.position;
        endBit = d.currentBitOffset;
        break;
      } catch (e) {
        if (e instanceof BinSchemaError && e.code === ErrorCode.INCOMPLETE_DATA) {
          // Need more bytes. Pull, retry from the saved head position. If
          // pull yields zero and we're at EOF, the data really is incomplete.
          const added = await buf.pullChunk();
          if (added === 0 && buf.isEof) {
            throw new BinSchemaError(
              ErrorCode.INCOMPLETE_DATA,
              `Stream ended mid-item (item ${i}/${total}, ${buf.bytes.length} bytes buffered, head bit ${buf.headBitOffset})`,
              { context: `item ${i}/${total}`, cause: e }
            );
          }
          continue;
        }
        // Fatal decode error — annotate and rethrow.
        if (e instanceof BinSchemaError) {
          throw new BinSchemaError(
            e.code,
            `Failed to decode item ${i}/${total}: ${e.message}`,
            { context: `item ${i}/${total}`, cause: e, position: e.position }
          );
        }
        throw e;
      }
    }

    buf.advance(endByte, endBit);
    yield item;
  }
}
