//! String transcoding between the in-memory representation (UTF-8 `[]const u8`,
//! matching the Zig string literal a caller passes) and non-UTF-8 wire encodings
//! (Latin-1 / UTF-16). utf8 and ascii need no transcoding — logical text equals
//! wire bytes — so the generator handles those inline and only reaches for these
//! helpers for `latin1` and `utf16`.
//!
//! Semantics mirror the TypeScript reference (`generators/typescript/string-support.ts`):
//!   - Latin-1: each Unicode code point maps 1:1 to a byte (must be <= 0xFF).
//!   - UTF-16: each code point becomes one 16-bit code unit (a surrogate pair for
//!     code points >= 0x10000), serialized with the field's endianness. The byte
//!     length — not the code-unit or character count — is what length prefixes
//!     and fixed widths measure.

const std = @import("std");
const Endianness = @import("bitstream.zig").Endianness;
const Error = @import("errors.zig").Error;

/// UTF-8 logical text -> Latin-1 wire bytes. Errors if any code point exceeds
/// 0xFF (not representable in Latin-1) or the input isn't valid UTF-8.
pub fn encodeLatin1Alloc(allocator: std.mem.Allocator, text: []const u8) Error![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    const view = std.unicode.Utf8View.init(text) catch return error.InvalidUtf8;
    var it = view.iterator();
    while (it.nextCodepoint()) |cp| {
        if (cp > 0xFF) return error.InvalidValue;
        try out.append(allocator, @intCast(cp));
    }
    return out.toOwnedSlice(allocator);
}

/// Latin-1 wire bytes -> UTF-8 logical text. Every byte is a code point in
/// U+0000..U+00FF, re-encoded as UTF-8 (1 byte for <= 0x7F, else 2 bytes).
pub fn decodeLatin1Alloc(allocator: std.mem.Allocator, bytes: []const u8) Error![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    var buf: [4]u8 = undefined;
    for (bytes) |b| {
        const n = std.unicode.utf8Encode(@as(u21, b), &buf) catch return error.InvalidEncoding;
        try out.appendSlice(allocator, buf[0..n]);
    }
    return out.toOwnedSlice(allocator);
}

fn appendUnit(out: *std.ArrayList(u8), allocator: std.mem.Allocator, unit: u16, endianness: Endianness) Error!void {
    const hi: u8 = @intCast((unit >> 8) & 0xFF);
    const lo: u8 = @intCast(unit & 0xFF);
    if (endianness == .big_endian) {
        try out.append(allocator, hi);
        try out.append(allocator, lo);
    } else {
        try out.append(allocator, lo);
        try out.append(allocator, hi);
    }
}

/// UTF-8 logical text -> UTF-16 wire bytes (code units in `endianness` order).
/// Code points >= 0x10000 are emitted as a high/low surrogate pair.
pub fn encodeUtf16Alloc(allocator: std.mem.Allocator, text: []const u8, endianness: Endianness) Error![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    const view = std.unicode.Utf8View.init(text) catch return error.InvalidUtf8;
    var it = view.iterator();
    while (it.nextCodepoint()) |cp| {
        if (cp <= 0xFFFF) {
            try appendUnit(&out, allocator, @intCast(cp), endianness);
        } else {
            const c = cp - 0x10000;
            const high: u16 = @intCast(0xD800 + (c >> 10));
            const low: u16 = @intCast(0xDC00 + (c & 0x3FF));
            try appendUnit(&out, allocator, high, endianness);
            try appendUnit(&out, allocator, low, endianness);
        }
    }
    return out.toOwnedSlice(allocator);
}

/// Read one UTF-16 code unit at byte offset `i` using `endianness`.
pub fn readUtf16Unit(bytes: []const u8, i: usize, endianness: Endianness) u16 {
    const b0: u16 = bytes[i];
    const b1: u16 = bytes[i + 1];
    return if (endianness == .big_endian) (b0 << 8) | b1 else (b1 << 8) | b0;
}

/// UTF-16 wire bytes -> UTF-8 logical text. Combines surrogate pairs; a trailing
/// odd byte (incomplete unit) is ignored, matching the reference loop bound.
pub fn decodeUtf16Alloc(allocator: std.mem.Allocator, bytes: []const u8, endianness: Endianness) Error![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    var buf: [4]u8 = undefined;
    var i: usize = 0;
    while (i + 1 < bytes.len) : (i += 2) {
        const unit = readUtf16Unit(bytes, i, endianness);
        var cp: u21 = unit;
        if (unit >= 0xD800 and unit <= 0xDBFF and i + 3 < bytes.len) {
            const low = readUtf16Unit(bytes, i + 2, endianness);
            if (low >= 0xDC00 and low <= 0xDFFF) {
                cp = 0x10000 + ((@as(u21, unit - 0xD800) << 10) | (low - 0xDC00));
                i += 2;
            }
        }
        const n = std.unicode.utf8Encode(cp, &buf) catch return error.InvalidEncoding;
        try out.appendSlice(allocator, buf[0..n]);
    }
    return out.toOwnedSlice(allocator);
}

const testing = std.testing;

test "latin1 round-trip (ASCII + extended)" {
    const wire = try encodeLatin1Alloc(testing.allocator, "café");
    defer testing.allocator.free(wire);
    try testing.expectEqualSlices(u8, &[_]u8{ 0x63, 0x61, 0x66, 0xE9 }, wire);

    const text = try decodeLatin1Alloc(testing.allocator, wire);
    defer testing.allocator.free(text);
    try testing.expectEqualStrings("café", text);
}

test "latin1 rejects code points above 0xFF" {
    try testing.expectError(error.InvalidValue, encodeLatin1Alloc(testing.allocator, "€"));
}

test "utf16 big-endian round-trip" {
    const wire = try encodeUtf16Alloc(testing.allocator, "AB", .big_endian);
    defer testing.allocator.free(wire);
    try testing.expectEqualSlices(u8, &[_]u8{ 0x00, 0x41, 0x00, 0x42 }, wire);

    const text = try decodeUtf16Alloc(testing.allocator, wire, .big_endian);
    defer testing.allocator.free(text);
    try testing.expectEqualStrings("AB", text);
}

test "utf16 little-endian + extended BMP char" {
    const wire = try encodeUtf16Alloc(testing.allocator, "€", .little_endian);
    defer testing.allocator.free(wire);
    try testing.expectEqualSlices(u8, &[_]u8{ 0xAC, 0x20 }, wire);

    const text = try decodeUtf16Alloc(testing.allocator, wire, .little_endian);
    defer testing.allocator.free(text);
    try testing.expectEqualStrings("€", text);
}

test "utf16 surrogate pair (U+1F600)" {
    const wire = try encodeUtf16Alloc(testing.allocator, "😀", .big_endian);
    defer testing.allocator.free(wire);
    // U+1F600 -> D83D DE00
    try testing.expectEqualSlices(u8, &[_]u8{ 0xD8, 0x3D, 0xDE, 0x00 }, wire);

    const text = try decodeUtf16Alloc(testing.allocator, wire, .big_endian);
    defer testing.allocator.free(text);
    try testing.expectEqualStrings("😀", text);
}
