/**
 * BinSchema runtime error class with machine-readable error codes.
 *
 * Provides cross-language error parity:
 * - TypeScript throws BinSchemaError instances with .code
 * - Go sets BitStreamDecoder.LastErrorCode to the same string
 * - Rust maps these codes onto BinSchemaError enum variants
 *
 * Streaming layers (Phase 3+) use the code to distinguish recoverable
 * "need more bytes" (INCOMPLETE_DATA) from fatal decoding failures.
 */

/**
 * Canonical error codes shared across all language runtimes.
 *
 * Keep this list in sync with:
 *   - go/runtime/bitstream.go (LastErrorCode string values)
 *   - rust/src/lib.rs (BinSchemaError variants)
 *   - python/runtime/bitstream.py (BinSchemaError.code)
 */
export const ErrorCode = {
  /** End of stream / insufficient bytes to satisfy a read. */
  INCOMPLETE_DATA: "INCOMPLETE_DATA",
  /** Input value to encoder (or argument to decoder) is out of range / invalid. */
  INVALID_VALUE: "INVALID_VALUE",
  /** Wire format is malformed (bad varlength prefix, bad framing, etc.). */
  INVALID_ENCODING: "INVALID_ENCODING",
  /** UTF-8 decode failed on a string field. */
  INVALID_UTF8: "INVALID_UTF8",
  /** Discriminator value does not match any variant of a union. */
  INVALID_VARIANT: "INVALID_VARIANT",
  /** Byte-aligned operation attempted on a non-byte-aligned bit position. */
  ALIGNMENT_REQUIRED: "ALIGNMENT_REQUIRED",
  /** Seek or peek would land outside the input buffer. */
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
  /** Position stack (used by pointer-following decoders) overflowed or underflowed. */
  STACK_OVERFLOW: "STACK_OVERFLOW",
  /** Decoded value violates the schema contract (e.g. length mismatch). */
  SCHEMA_MISMATCH: "SCHEMA_MISMATCH",
  /** Recursion limit hit while following pointers / decoding nested structures. */
  CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE",
} as const;

export type ErrorCodeValue = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Structured error thrown by the BinSchema runtime.
 *
 * Catch with `instanceof BinSchemaError` and switch on `.code` to react
 * programmatically. Plain `instanceof Error` still works for legacy callers.
 */
export class BinSchemaError extends Error {
  /** Machine-readable error code (see ErrorCode). */
  readonly code: ErrorCodeValue;
  /** Byte offset where the error was detected, if available. */
  readonly position?: number;
  /** Free-form context (field name, type name, decoder state) for debugging. */
  readonly context?: string;

  constructor(
    code: ErrorCodeValue,
    message: string,
    options?: { position?: number; context?: string; cause?: unknown }
  ) {
    super(message);
    this.name = "BinSchemaError";
    this.code = code;
    if (options?.position !== undefined) this.position = options.position;
    if (options?.context !== undefined) this.context = options.context;
    if (options?.cause !== undefined) {
      // Preserve native cause chaining when supported.
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    // Maintain a proper stack trace where supported.
    if (typeof (Error as any).captureStackTrace === "function") {
      (Error as any).captureStackTrace(this, BinSchemaError);
    }
  }
}
