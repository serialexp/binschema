//! BinSchemaError / ErrorCode for the Zig runtime.
//!
//! The string values returned by `ErrorCode.string()` are part of the
//! cross-language wire contract — code in TypeScript, Go, Rust, Python, and
//! Zig can compare against the same string constants and get a deterministic
//! answer for retry / propagate decisions.
//!
//! Zig errors cannot carry a payload, so the *error set* member is the unit of
//! propagation and `codeFor()` maps it back to the stable string code that the
//! other runtimes use. Where a position/message is useful (mostly the test
//! harness and debugging), callers can thread it separately.
//!
//! Direct port of `src/runtime/errors.ts`.

const std = @import("std");

/// Canonical error codes shared with the TypeScript, Go, Rust, and Python
/// runtimes. These string values are stable wire-format-level identifiers —
/// change them in lockstep across all runtimes or the cross-language tests
/// will diverge.
pub const ErrorCode = enum {
    /// Buffer exhausted before all required bytes were available. Streaming
    /// consumers treat this as the "pull another chunk and retry" signal.
    incomplete_data,
    /// Value out of range for its declared type (negative count, bit-width
    /// over 64, etc.).
    invalid_value,
    /// Wire-format invariant violated (DER indefinite length, LEB128
    /// overflow, EBML missing marker bit, ...).
    invalid_encoding,
    /// A length-prefixed string was not valid UTF-8.
    invalid_utf8,
    /// A discriminated-union discriminator didn't match any declared arm.
    invalid_variant,
    /// Byte-aligned operation attempted at a non-zero bit offset.
    alignment_required,
    /// Seek / peek referenced a byte position outside the buffer.
    out_of_bounds,
    /// Pointer / position-stack recursion exceeded the configured limit.
    stack_overflow,
    /// Data doesn't match schema expectations (missing required field, etc.).
    schema_mismatch,
    /// Pointer graph contained an infinite loop.
    circular_reference,

    pub fn string(self: ErrorCode) []const u8 {
        return switch (self) {
            .incomplete_data => "INCOMPLETE_DATA",
            .invalid_value => "INVALID_VALUE",
            .invalid_encoding => "INVALID_ENCODING",
            .invalid_utf8 => "INVALID_UTF8",
            .invalid_variant => "INVALID_VARIANT",
            .alignment_required => "ALIGNMENT_REQUIRED",
            .out_of_bounds => "OUT_OF_BOUNDS",
            .stack_overflow => "STACK_OVERFLOW",
            .schema_mismatch => "SCHEMA_MISMATCH",
            .circular_reference => "CIRCULAR_REFERENCE",
        };
    }
};

/// Error set raised by the BinSchema Zig runtime. Each member maps 1:1 to an
/// `ErrorCode` via `codeFor()`. `OutOfMemory` is included because the encoder
/// owns a growable buffer and decode may allocate owned slices.
pub const Error = error{
    IncompleteData,
    InvalidValue,
    InvalidEncoding,
    InvalidUtf8,
    InvalidVariant,
    AlignmentRequired,
    OutOfBounds,
    StackOverflow,
    SchemaMismatch,
    CircularReference,
    OutOfMemory,
};

/// Map an `Error` to its stable cross-language code string. `OutOfMemory` has
/// no wire-contract code (it is a host-side allocation failure) and reports as
/// "OUT_OF_MEMORY" for diagnostics only.
pub fn codeFor(e: Error) []const u8 {
    return switch (e) {
        error.IncompleteData => ErrorCode.incomplete_data.string(),
        error.InvalidValue => ErrorCode.invalid_value.string(),
        error.InvalidEncoding => ErrorCode.invalid_encoding.string(),
        error.InvalidUtf8 => ErrorCode.invalid_utf8.string(),
        error.InvalidVariant => ErrorCode.invalid_variant.string(),
        error.AlignmentRequired => ErrorCode.alignment_required.string(),
        error.OutOfBounds => ErrorCode.out_of_bounds.string(),
        error.StackOverflow => ErrorCode.stack_overflow.string(),
        error.SchemaMismatch => ErrorCode.schema_mismatch.string(),
        error.CircularReference => ErrorCode.circular_reference.string(),
        error.OutOfMemory => "OUT_OF_MEMORY",
    };
}

/// Map an `ErrorCode` to the corresponding `Error` set member. Useful for
/// generated code that wants to raise by code.
pub fn errorFor(code: ErrorCode) Error {
    return switch (code) {
        .incomplete_data => error.IncompleteData,
        .invalid_value => error.InvalidValue,
        .invalid_encoding => error.InvalidEncoding,
        .invalid_utf8 => error.InvalidUtf8,
        .invalid_variant => error.InvalidVariant,
        .alignment_required => error.AlignmentRequired,
        .out_of_bounds => error.OutOfBounds,
        .stack_overflow => error.StackOverflow,
        .schema_mismatch => error.SchemaMismatch,
        .circular_reference => error.CircularReference,
    };
}

test "error code strings are stable" {
    try std.testing.expectEqualStrings("INCOMPLETE_DATA", ErrorCode.incomplete_data.string());
    try std.testing.expectEqualStrings("INVALID_UTF8", ErrorCode.invalid_utf8.string());
    try std.testing.expectEqualStrings("OUT_OF_BOUNDS", codeFor(error.OutOfBounds));
    try std.testing.expectEqual(error.StackOverflow, errorFor(.stack_overflow));
}
