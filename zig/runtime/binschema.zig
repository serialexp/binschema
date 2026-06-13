//! BinSchema Zig runtime — root module.
//!
//! Generated code imports this module (as `binschema`) and uses the encoder,
//! decoder, context, error types, and codec registry from one namespace. The
//! public surface mirrors the Python `runtime/__init__.py` re-exports so the
//! cross-language generators stay structurally aligned.

const std = @import("std");

const bitstream = @import("bitstream.zig");
const context = @import("context.zig");
const errors = @import("errors.zig");
const codecs = @import("codecs.zig");
const strenc = @import("strenc.zig");

// ---- bitstream ----
pub const BitStreamEncoder = bitstream.BitStreamEncoder;
pub const BitStreamDecoder = bitstream.BitStreamDecoder;
pub const Endianness = bitstream.Endianness;
pub const BitOrder = bitstream.BitOrder;
pub const Placeholder = bitstream.Placeholder;
pub const computeCrc32 = bitstream.computeCrc32;

// ---- context ----
pub const EncodeContext = context.EncodeContext;
pub const Frame = context.Frame;
pub const FieldInfo = context.FieldInfo;
pub const ByteRange = context.ByteRange;
pub const Patch = context.Patch;
pub const PatchWidth = context.PatchWidth;
pub const SelectorKind = context.SelectorKind;

// ---- errors ----
pub const Error = errors.Error;
pub const ErrorCode = errors.ErrorCode;
pub const codeFor = errors.codeFor;
pub const errorFor = errors.errorFor;

// ---- codecs ----
pub const Codec = codecs.Codec;
pub const CodecKind = codecs.CodecKind;
pub const resolveCodec = codecs.resolveCodec;

// ---- string transcoding (latin1 / utf16) ----
pub const encodeLatin1Alloc = strenc.encodeLatin1Alloc;
pub const decodeLatin1Alloc = strenc.decodeLatin1Alloc;
pub const encodeUtf16Alloc = strenc.encodeUtf16Alloc;
pub const decodeUtf16Alloc = strenc.decodeUtf16Alloc;
pub const readUtf16Unit = strenc.readUtf16Unit;

/// Validate that `data` is well-formed UTF-8, returning it unchanged or
/// `error.InvalidUtf8`. Generated string decoders call this instead of trusting
/// raw bytes, so consumers across languages can pattern-match on a stable code.
/// Mirrors Python's `_decode_text`.
pub fn validateUtf8(data: []const u8) Error![]const u8 {
    if (!std.unicode.utf8ValidateSlice(data)) return error.InvalidUtf8;
    return data;
}

test "runtime root re-exports are reachable" {
    var enc = BitStreamEncoder.init(std.testing.allocator, .msb_first);
    defer enc.deinit();
    try enc.writeUint8(0x42);
    const out = try enc.finish();
    defer std.testing.allocator.free(out);
    try std.testing.expectEqual(@as(u8, 0x42), out[0]);

    var ctx = EncodeContext.init(std.testing.allocator);
    defer ctx.deinit();

    try std.testing.expectEqualStrings("hi", try validateUtf8("hi"));
    try std.testing.expectError(error.InvalidUtf8, validateUtf8(&[_]u8{ 0xFF, 0xFE }));
    try std.testing.expectEqual(@as(u32, 0xCBF43926), computeCrc32("123456789"));
}

test {
    // Pull in the submodule tests so `zig test binschema.zig` runs everything.
    std.testing.refAllDecls(@This());
    _ = bitstream;
    _ = context;
    _ = errors;
    _ = codecs;
    _ = strenc;
}
