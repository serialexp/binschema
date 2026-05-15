/**
 * Tests for BinSchemaError + error codes on the BitStream runtime.
 *
 * These tests assert that every runtime failure throws a BinSchemaError with
 * the documented .code value, so downstream consumers (streaming layer,
 * cross-language callers) can branch on the code instead of pattern-matching
 * message strings.
 */

import {
  BitStreamEncoder,
  BitStreamDecoder,
} from "../../runtime/bit-stream.js";
import { BinSchemaError, ErrorCode } from "../../runtime/errors.js";
import { SeekableBitStreamDecoder } from "../../runtime/seekable-bit-stream.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

/**
 * Expect `fn` to throw a BinSchemaError with the given code. If it throws
 * the wrong type, the wrong code, or doesn't throw at all, returns a
 * descriptive failure message; otherwise returns null.
 */
function expectErrorCode(fn: () => unknown, expectedCode: string): string | null {
  try {
    fn();
    return `expected BinSchemaError(${expectedCode}) but no error was thrown`;
  } catch (e) {
    if (!(e instanceof BinSchemaError)) {
      return `expected BinSchemaError but got ${(e as Error)?.constructor?.name ?? typeof e}: ${e}`;
    }
    if (e.code !== expectedCode) {
      return `expected code ${expectedCode} but got ${e.code} (message: ${e.message})`;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// INCOMPLETE_DATA — EOF on every read path
// ---------------------------------------------------------------------------

function testEofReadBit() {
  const d = new BitStreamDecoder(new Uint8Array([]));
  const err = expectErrorCode(() => d.readBit(), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofReadUint8() {
  const d = new BitStreamDecoder(new Uint8Array([]));
  const err = expectErrorCode(() => d.readUint8(), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofReadUint16() {
  const d = new BitStreamDecoder(new Uint8Array([0x12]));
  const err = expectErrorCode(() => d.readUint16("big_endian"), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofReadUint32() {
  const d = new BitStreamDecoder(new Uint8Array([0x12, 0x34, 0x56]));
  const err = expectErrorCode(() => d.readUint32("big_endian"), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofReadFloat32() {
  const d = new BitStreamDecoder(new Uint8Array([0x00, 0x00, 0x00]));
  const err = expectErrorCode(() => d.readFloat32("big_endian"), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofReadFloat64() {
  const d = new BitStreamDecoder(new Uint8Array([0, 0, 0, 0, 0, 0, 0]));
  const err = expectErrorCode(() => d.readFloat64("big_endian"), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofReadBytesSlice() {
  const d = new BitStreamDecoder(new Uint8Array([0x12, 0x34]));
  const err = expectErrorCode(() => d.readBytesSlice(4), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofReadBitsCrossByte() {
  // 8-bit read needs two bytes when bit-aligned mid-byte; only one provided.
  const d = new BitStreamDecoder(new Uint8Array([0xAB]));
  d.readBits(4); // advance into the middle of the byte
  const err = expectErrorCode(() => d.readBits(8), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofPeekUint8() {
  const d = new BitStreamDecoder(new Uint8Array([]));
  const err = expectErrorCode(() => d.peekUint8(), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofPeekUint16() {
  const d = new BitStreamDecoder(new Uint8Array([0x12]));
  const err = expectErrorCode(() => d.peekUint16("big_endian"), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

function testEofPeekUint32() {
  const d = new BitStreamDecoder(new Uint8Array([0x12, 0x34]));
  const err = expectErrorCode(() => d.peekUint32("big_endian"), ErrorCode.INCOMPLETE_DATA);
  if (err) throw new Error(err);
}

// ---------------------------------------------------------------------------
// INVALID_VALUE — encoder input validation, decoder argument validation
// ---------------------------------------------------------------------------

function testInvalidBitSizeWriter() {
  const e = new BitStreamEncoder();
  const tooSmall = expectErrorCode(() => e.writeBits(0, 0), ErrorCode.INVALID_VALUE);
  if (tooSmall) throw new Error(tooSmall);
  const tooLarge = expectErrorCode(() => e.writeBits(0, 65), ErrorCode.INVALID_VALUE);
  if (tooLarge) throw new Error(tooLarge);
}

function testInvalidBitSizeReader() {
  const d = new BitStreamDecoder(new Uint8Array([0xFF]));
  const err = expectErrorCode(() => d.readBits(0), ErrorCode.INVALID_VALUE);
  if (err) throw new Error(err);
}

function testNegativeDER() {
  const e = new BitStreamEncoder();
  const err = expectErrorCode(() => e.writeVarlengthDER(-1), ErrorCode.INVALID_VALUE);
  if (err) throw new Error(err);
}

function testNegativeLEB128() {
  const e = new BitStreamEncoder();
  const err = expectErrorCode(() => e.writeVarlengthLEB128(-1n), ErrorCode.INVALID_VALUE);
  if (err) throw new Error(err);
}

function testNegativeEBML() {
  const e = new BitStreamEncoder();
  const err = expectErrorCode(() => e.writeVarlengthEBML(-1), ErrorCode.INVALID_VALUE);
  if (err) throw new Error(err);
}

function testVLQOverflowEncode() {
  const e = new BitStreamEncoder();
  const err = expectErrorCode(() => e.writeVarlengthVLQ(0xFFFFFFFF), ErrorCode.INVALID_VALUE);
  if (err) throw new Error(err);
}

// ---------------------------------------------------------------------------
// INVALID_ENCODING — malformed wire format on the decoder side
// ---------------------------------------------------------------------------

function testDERIndefiniteRejected() {
  const d = new BitStreamDecoder(new Uint8Array([0x80]));
  const err = expectErrorCode(() => d.readVarlengthDER(), ErrorCode.INVALID_ENCODING);
  if (err) throw new Error(err);
}

function testDERTooLong() {
  const d = new BitStreamDecoder(new Uint8Array([0x85, 0, 0, 0, 0, 0]));
  const err = expectErrorCode(() => d.readVarlengthDER(), ErrorCode.INVALID_ENCODING);
  if (err) throw new Error(err);
}

function testLEB128Overflow() {
  // Need >9 continuation bytes for the shift>64 guard to fire; the guard runs
  // after `shift += 7` but before the loop checks termination, so a tenth
  // continuation byte pushes shift to 70 and triggers the error.
  const bytes = new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01]);
  const d = new BitStreamDecoder(bytes);
  const err = expectErrorCode(() => d.readVarlengthLEB128(), ErrorCode.INVALID_ENCODING);
  if (err) throw new Error(err);
}

function testEBMLNoMarker() {
  // 0x00 has no marker bit anywhere in the first byte.
  const d = new BitStreamDecoder(new Uint8Array([0x00]));
  const err = expectErrorCode(() => d.readVarlengthEBML(), ErrorCode.INVALID_ENCODING);
  if (err) throw new Error(err);
}

function testVLQOverflowDecode() {
  // 5 continuation bytes — VLQ caps at 4.
  const d = new BitStreamDecoder(new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x01]));
  const err = expectErrorCode(() => d.readVarlengthVLQ(), ErrorCode.INVALID_ENCODING);
  if (err) throw new Error(err);
}

// ---------------------------------------------------------------------------
// ALIGNMENT_REQUIRED — byte-aligned op on unaligned position
// ---------------------------------------------------------------------------

function testReadBytesSliceUnaligned() {
  const d = new BitStreamDecoder(new Uint8Array([0xFF, 0xFF, 0xFF]));
  d.readBits(3);
  const err = expectErrorCode(() => d.readBytesSlice(1), ErrorCode.ALIGNMENT_REQUIRED);
  if (err) throw new Error(err);
}

function testPeekUnaligned() {
  const d = new BitStreamDecoder(new Uint8Array([0xFF, 0xFF]));
  d.readBits(1);
  const err = expectErrorCode(() => d.peekUint8(), ErrorCode.ALIGNMENT_REQUIRED);
  if (err) throw new Error(err);
}

// ---------------------------------------------------------------------------
// OUT_OF_BOUNDS — seek past buffer
// ---------------------------------------------------------------------------

function testSeekNegative() {
  const d = new BitStreamDecoder(new Uint8Array([0, 0, 0]));
  const err = expectErrorCode(() => d.seek(-1), ErrorCode.OUT_OF_BOUNDS);
  if (err) throw new Error(err);
}

function testSeekPastEnd() {
  const d = new BitStreamDecoder(new Uint8Array([0, 0, 0]));
  const err = expectErrorCode(() => d.seek(100), ErrorCode.OUT_OF_BOUNDS);
  if (err) throw new Error(err);
}

// ---------------------------------------------------------------------------
// STACK_OVERFLOW — position stack
// ---------------------------------------------------------------------------

function testPositionStackOverflow() {
  const d = new BitStreamDecoder(new Uint8Array([0]));
  // The decoder allows up to 128 entries — pushing 129 must overflow.
  for (let i = 0; i < 128; i++) d.pushPosition();
  const err = expectErrorCode(() => d.pushPosition(), ErrorCode.STACK_OVERFLOW);
  if (err) throw new Error(err);
}

function testPositionStackUnderflow() {
  const d = new BitStreamDecoder(new Uint8Array([0]));
  const err = expectErrorCode(() => d.popPosition(), ErrorCode.STACK_OVERFLOW);
  if (err) throw new Error(err);
}

// ---------------------------------------------------------------------------
// BinSchemaError shape — fields are populated correctly
// ---------------------------------------------------------------------------

function testErrorShape() {
  const d = new BitStreamDecoder(new Uint8Array([]));
  try {
    d.readUint8();
    throw new Error("expected throw");
  } catch (e) {
    if (!(e instanceof BinSchemaError)) {
      throw new Error(`expected BinSchemaError, got ${(e as Error)?.constructor?.name}`);
    }
    if (e.code !== ErrorCode.INCOMPLETE_DATA) {
      throw new Error(`wrong code: ${e.code}`);
    }
    if (e.name !== "BinSchemaError") {
      throw new Error(`wrong name: ${e.name}`);
    }
    if (!(e instanceof Error)) {
      throw new Error("BinSchemaError must also be an Error (instanceof Error failed)");
    }
    if (typeof e.message !== "string" || e.message.length === 0) {
      throw new Error(`message must be a non-empty string, got ${e.message}`);
    }
    if (e.position !== 0) {
      throw new Error(`position should be 0 on empty buffer EOF, got ${e.position}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Successful reads must NOT throw — sanity guard against over-eager rewrites
// ---------------------------------------------------------------------------

function testHappyPathNoThrow() {
  const enc = new BitStreamEncoder();
  enc.writeUint32(0xDEADBEEF, "big_endian");
  enc.writeUint8(0x42);
  const bytes = enc.finish();
  const d = new BitStreamDecoder(bytes);
  if (d.readUint32("big_endian") !== 0xDEADBEEF) throw new Error("uint32 round-trip failed");
  if (d.readUint8() !== 0x42) throw new Error("uint8 round-trip failed");
}

// ---------------------------------------------------------------------------
// SeekableBitStreamDecoder error paths
// ---------------------------------------------------------------------------

function testSeekableFileNotFound() {
  const err = expectErrorCode(
    () => SeekableBitStreamDecoder.fromFile("/nonexistent/path/that/does/not/exist.bin"),
    ErrorCode.INVALID_VALUE
  );
  if (err) throw new Error(err);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runErrorCodeTests(): { passed: number; failed: number; checks: TestCheck[] } {
  const checks: TestCheck[] = [];
  let passed = 0;
  let failed = 0;

  const tests: Array<{ name: string; fn: () => void }> = [
    // INCOMPLETE_DATA
    { name: "EOF on readBit throws INCOMPLETE_DATA", fn: testEofReadBit },
    { name: "EOF on readUint8 throws INCOMPLETE_DATA", fn: testEofReadUint8 },
    { name: "EOF on readUint16 throws INCOMPLETE_DATA", fn: testEofReadUint16 },
    { name: "EOF on readUint32 throws INCOMPLETE_DATA", fn: testEofReadUint32 },
    { name: "EOF on readFloat32 throws INCOMPLETE_DATA", fn: testEofReadFloat32 },
    { name: "EOF on readFloat64 throws INCOMPLETE_DATA", fn: testEofReadFloat64 },
    { name: "EOF on readBytesSlice throws INCOMPLETE_DATA", fn: testEofReadBytesSlice },
    { name: "EOF on readBits crossing byte boundary throws INCOMPLETE_DATA", fn: testEofReadBitsCrossByte },
    { name: "EOF on peekUint8 throws INCOMPLETE_DATA", fn: testEofPeekUint8 },
    { name: "EOF on peekUint16 throws INCOMPLETE_DATA", fn: testEofPeekUint16 },
    { name: "EOF on peekUint32 throws INCOMPLETE_DATA", fn: testEofPeekUint32 },
    // INVALID_VALUE
    { name: "Invalid bit size on writer throws INVALID_VALUE", fn: testInvalidBitSizeWriter },
    { name: "Invalid bit size on reader throws INVALID_VALUE", fn: testInvalidBitSizeReader },
    { name: "Negative DER value throws INVALID_VALUE", fn: testNegativeDER },
    { name: "Negative LEB128 value throws INVALID_VALUE", fn: testNegativeLEB128 },
    { name: "Negative EBML value throws INVALID_VALUE", fn: testNegativeEBML },
    { name: "VLQ encoder overflow throws INVALID_VALUE", fn: testVLQOverflowEncode },
    // INVALID_ENCODING
    { name: "DER indefinite-length decode throws INVALID_ENCODING", fn: testDERIndefiniteRejected },
    { name: "DER long-form > 4 bytes throws INVALID_ENCODING", fn: testDERTooLong },
    { name: "LEB128 overflow decode throws INVALID_ENCODING", fn: testLEB128Overflow },
    { name: "EBML missing marker bit throws INVALID_ENCODING", fn: testEBMLNoMarker },
    { name: "VLQ decode > 4 bytes throws INVALID_ENCODING", fn: testVLQOverflowDecode },
    // ALIGNMENT_REQUIRED
    { name: "readBytesSlice on unaligned position throws ALIGNMENT_REQUIRED", fn: testReadBytesSliceUnaligned },
    { name: "peek on unaligned position throws ALIGNMENT_REQUIRED", fn: testPeekUnaligned },
    // OUT_OF_BOUNDS
    { name: "Negative seek throws OUT_OF_BOUNDS", fn: testSeekNegative },
    { name: "Seek past end throws OUT_OF_BOUNDS", fn: testSeekPastEnd },
    // STACK_OVERFLOW
    { name: "Pushing 129th position throws STACK_OVERFLOW", fn: testPositionStackOverflow },
    { name: "Popping empty position stack throws STACK_OVERFLOW", fn: testPositionStackUnderflow },
    // Shape
    { name: "BinSchemaError has correct shape (code, name, position, instanceof Error)", fn: testErrorShape },
    // Happy path
    { name: "Successful reads do not throw", fn: testHappyPathNoThrow },
    // Seekable
    { name: "SeekableBitStreamDecoder.fromFile on missing path throws INVALID_VALUE", fn: testSeekableFileNotFound },
  ];

  for (const t of tests) {
    try {
      t.fn();
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
  const result = runErrorCodeTests();
  console.log(`error-codes: ${result.passed} passed, ${result.failed} failed`);
  for (const c of result.checks) {
    if (!c.passed) console.log(`  FAIL: ${c.description} — ${c.message}`);
  }
}
