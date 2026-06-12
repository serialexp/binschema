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
//! Phase 1 status: `store` is implemented; `deflate`/`gzip` resolve (so schemas
//! that name them parse and dispatch) but raise `InvalidEncoding` at use until
//! Phase 5 wires them to `std.compress.flate`. This keeps the registry shape
//! identical to the Python/Go runtimes without pulling the compression work
//! forward.

const std = @import("std");
const err = @import("errors.zig");
const Error = err.Error;

pub const CodecKind = enum { store, deflate, gzip };

pub const Codec = struct {
    kind: CodecKind,

    /// Transform inner-encoded bytes into the wire representation. Caller owns
    /// the returned slice (allocated with `allocator`).
    pub fn compress(self: Codec, allocator: std.mem.Allocator, data: []const u8) Error![]u8 {
        switch (self.kind) {
            .store => return allocator.dupe(u8, data),
            .deflate, .gzip => return error.InvalidEncoding, // Phase 5
        }
    }

    /// Reverse `compress`. `expected_size` is the decoded `uncompressed_size`
    /// framing field; the `store` codec ignores it. Caller owns the result.
    pub fn decompress(
        self: Codec,
        allocator: std.mem.Allocator,
        data: []const u8,
        expected_size: usize,
    ) Error![]u8 {
        _ = expected_size;
        switch (self.kind) {
            .store => return allocator.dupe(u8, data),
            .deflate, .gzip => return error.InvalidEncoding, // Phase 5
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
