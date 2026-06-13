//! Codec registry for `compressed` regions.
//!
//! A `compressed` field serializes its inner type to a buffer, runs it through
//! a named codec, and frames the result. Built-in codec names mirror the other
//! runtimes:
//!
//!   - `store`   - identity passthrough (no compression).
//!   - `deflate` - raw DEFLATE (RFC 1951).
//!   - `gzip`    - gzip container (RFC 1952).
//!
//! `store` is the identity codec; `deflate`/`gzip` wrap `std.compress.flate`
//! (raw DEFLATE bit-stream and gzip container respectively). Real deflate output
//! is not byte-stable across implementations/levels, so the byte-pinned tests use
//! `store`; deflate/gzip are exercised round-trip only.

const std = @import("std");
const flate = std.compress.flate;
const err = @import("errors.zig");
const Error = err.Error;

pub const CodecKind = enum { store, deflate, gzip };

/// Compress `data` through `std.compress.flate` with the given container
/// (`.raw` for deflate, `.gzip` for gzip). Caller owns the returned slice.
fn flateCompress(allocator: std.mem.Allocator, data: []const u8, container: flate.Container) Error![]u8 {
    // The output writer must own a non-trivial buffer (Compress asserts >8) and
    // grows as needed. The window buffer is heap-allocated to keep the stack
    // frame small (max_window_len is 64 KiB).
    var aw: std.Io.Writer.Allocating = std.Io.Writer.Allocating.initCapacity(allocator, 64) catch
        return error.OutOfMemory;
    defer aw.deinit();
    const window = allocator.alloc(u8, flate.max_window_len) catch return error.OutOfMemory;
    defer allocator.free(window);
    var c = flate.Compress.init(&aw.writer, window, container, .default) catch return error.InvalidEncoding;
    c.writer.writeAll(data) catch return error.InvalidEncoding;
    c.finish() catch return error.InvalidEncoding;
    return aw.toOwnedSlice() catch return error.OutOfMemory;
}

/// Reverse `flateCompress`. Caller owns the returned slice.
fn flateDecompress(allocator: std.mem.Allocator, data: []const u8, container: flate.Container) Error![]u8 {
    var in: std.Io.Reader = .fixed(data);
    var aw: std.Io.Writer.Allocating = .init(allocator);
    defer aw.deinit();
    var d: flate.Decompress = .init(&in, container, &.{});
    _ = d.reader.streamRemaining(&aw.writer) catch return error.InvalidEncoding;
    return aw.toOwnedSlice() catch return error.OutOfMemory;
}

pub const Codec = struct {
    kind: CodecKind,

    /// Transform inner-encoded bytes into the wire representation. Caller owns
    /// the returned slice (allocated with `allocator`).
    pub fn compress(self: Codec, allocator: std.mem.Allocator, data: []const u8) Error![]u8 {
        switch (self.kind) {
            .store => return allocator.dupe(u8, data),
            .deflate => return flateCompress(allocator, data, .raw),
            .gzip => return flateCompress(allocator, data, .gzip),
        }
    }

    /// Reverse `compress`. `expected_size` is the decoded `uncompressed_size`
    /// framing field; the codecs ignore it (the caller asserts the result size).
    pub fn decompress(
        self: Codec,
        allocator: std.mem.Allocator,
        data: []const u8,
        expected_size: usize,
    ) Error![]u8 {
        _ = expected_size;
        switch (self.kind) {
            .store => return allocator.dupe(u8, data),
            .deflate => return flateDecompress(allocator, data, .raw),
            .gzip => return flateDecompress(allocator, data, .gzip),
        }
    }
};

/// Resolve a codec by name. Returns `InvalidEncoding` if the name is not a
/// known built-in, so the failure is loud rather than silently wrong.
pub fn resolveCodec(name: []const u8) Error!Codec {
    if (std.mem.eql(u8, name, "store")) return .{ .kind = .store };
    if (std.mem.eql(u8, name, "deflate")) return .{ .kind = .deflate };
    if (std.mem.eql(u8, name, "gzip")) return .{ .kind = .gzip };
    return error.InvalidEncoding;
}

test "store codec round-trips" {
    const a = std.testing.allocator;
    const codec = try resolveCodec("store");
    const data = [_]u8{ 1, 2, 3, 4 };
    const c = try codec.compress(a, &data);
    defer a.free(c);
    try std.testing.expectEqualSlices(u8, &data, c);
    const d = try codec.decompress(a, c, data.len);
    defer a.free(d);
    try std.testing.expectEqualSlices(u8, &data, d);
}

test "unknown codec is loud" {
    try std.testing.expectError(error.InvalidEncoding, resolveCodec("zstd"));
}

test "deflate codec round-trips" {
    const a = std.testing.allocator;
    const codec = try resolveCodec("deflate");
    const data = "Hello, deflate! Hello, deflate! Hello, deflate!";
    const c = try codec.compress(a, data);
    defer a.free(c);
    const d = try codec.decompress(a, c, data.len);
    defer a.free(d);
    try std.testing.expectEqualSlices(u8, data, d);
}

test "gzip codec round-trips" {
    const a = std.testing.allocator;
    const codec = try resolveCodec("gzip");
    const data = "gzip container round-trip payload payload payload";
    const c = try codec.compress(a, data);
    defer a.free(c);
    const d = try codec.decompress(a, c, data.len);
    defer a.free(d);
    try std.testing.expectEqualSlices(u8, data, d);
}
