//! BitStream — low-level bit-level reading/writing for the Zig runtime.
//!
//! Direct port of the TypeScript reference (`src/runtime/bit-stream.ts`) and
//! its Python sibling (`python/runtime/bitstream.py`). Byte ordering and bit
//! ordering semantics are identical across all runtimes so the shared JSON
//! test corpus produces the same bytes everywhere.
//!
//! Two-pass encoding is load-bearing here: the encoder accumulates into an
//! owned `ArrayList(u8)`, never straight to an output sink, so a length/
//! position/CRC prefix can be written as a fixed-width *placeholder* and
//! back-patched once the content that determines it has been encoded. See
//! `placeholderU32` / `patchU32`.
//!
//! Allocator convention: the encoder owns its buffer and stores the allocator
//! it was created with. `finish()` returns a caller-owned slice. The decoder
//! borrows the input bytes and never allocates.

const std = @import("std");
const err = @import("errors.zig");
const Error = err.Error;

pub const Endianness = enum { big_endian, little_endian };
pub const BitOrder = enum { msb_first, lsb_first };

/// Compute CRC32 (IEEE polynomial) returning an unsigned 32-bit value. Matches
/// zlib.crc32 / Go hash/crc32 / Rust crc32fast over the same bytes.
pub fn computeCrc32(data: []const u8) u32 {
    return std.hash.Crc32.hash(data);
}

/// Handle returned by a placeholder reservation. Records the absolute byte
/// offset of a fixed-width slot in the encoder buffer so it can be patched
/// later. Carrying the width lets `patch()` validate the caller patches with a
/// matching method.
pub const Placeholder = struct {
    offset: usize,
    width: u8, // bytes
};

pub const BitStreamEncoder = struct {
    allocator: std.mem.Allocator,
    bytes: std.ArrayList(u8) = .empty,
    current_byte: u8 = 0,
    bit_offset: u4 = 0, // bits used in current_byte (0-8 transient before flush)
    total_bits_written: usize = 0,
    bit_order: BitOrder,

    pub fn init(allocator: std.mem.Allocator, bit_order: BitOrder) BitStreamEncoder {
        return .{ .allocator = allocator, .bit_order = bit_order };
    }

    pub fn deinit(self: *BitStreamEncoder) void {
        self.bytes.deinit(self.allocator);
    }

    fn writeBit(self: *BitStreamEncoder, bit: u1) Error!void {
        if (self.bit_order == .msb_first) {
            self.current_byte |= (@as(u8, bit) << @as(u3, @intCast(7 - self.bit_offset)));
        } else {
            self.current_byte |= (@as(u8, bit) << @as(u3, @intCast(self.bit_offset)));
        }

        self.bit_offset += 1;
        self.total_bits_written += 1;

        if (self.bit_offset == 8) {
            try self.bytes.append(self.allocator, self.current_byte);
            self.current_byte = 0;
            self.bit_offset = 0;
        }
    }

    pub fn writeBits(self: *BitStreamEncoder, value: u64, size: u7) Error!void {
        if (size < 1 or size > 64) return error.InvalidValue;

        const masked: u64 = if (size == 64) value else value & ((@as(u64, 1) << @intCast(size)) - 1);

        if (self.bit_order == .lsb_first) {
            var i: u7 = 0;
            while (i < size) : (i += 1) {
                try self.writeBit(@intCast((masked >> @intCast(i)) & 1));
            }
        } else {
            var i: u7 = size;
            while (i > 0) {
                i -= 1;
                try self.writeBit(@intCast((masked >> @intCast(i)) & 1));
            }
        }
    }

    pub fn writeUint8(self: *BitStreamEncoder, value: u8) Error!void {
        if (self.bit_offset == 0) {
            try self.bytes.append(self.allocator, value);
        } else {
            // Misaligned: write LSB-first into the partial byte stream, matching
            // the Python/TS reference (which loops bit 0..7 here).
            var i: u4 = 0;
            while (i < 8) : (i += 1) {
                try self.writeBit(@intCast((value >> @intCast(i)) & 1));
            }
        }
    }

    pub fn writeUint16(self: *BitStreamEncoder, value: u16, endianness: Endianness) Error!void {
        if (endianness == .big_endian) {
            try self.writeUint8(@intCast((value >> 8) & 0xFF));
            try self.writeUint8(@intCast(value & 0xFF));
        } else {
            try self.writeUint8(@intCast(value & 0xFF));
            try self.writeUint8(@intCast((value >> 8) & 0xFF));
        }
    }

    pub fn writeUint32(self: *BitStreamEncoder, value: u32, endianness: Endianness) Error!void {
        if (endianness == .big_endian) {
            try self.writeUint8(@intCast((value >> 24) & 0xFF));
            try self.writeUint8(@intCast((value >> 16) & 0xFF));
            try self.writeUint8(@intCast((value >> 8) & 0xFF));
            try self.writeUint8(@intCast(value & 0xFF));
        } else {
            try self.writeUint8(@intCast(value & 0xFF));
            try self.writeUint8(@intCast((value >> 8) & 0xFF));
            try self.writeUint8(@intCast((value >> 16) & 0xFF));
            try self.writeUint8(@intCast((value >> 24) & 0xFF));
        }
    }

    pub fn writeUint64(self: *BitStreamEncoder, value: u64, endianness: Endianness) Error!void {
        if (endianness == .big_endian) {
            var i: u4 = 8;
            while (i > 0) {
                i -= 1;
                try self.writeUint8(@intCast((value >> (@as(u6, i) * 8)) & 0xFF));
            }
        } else {
            var i: u4 = 0;
            while (i < 8) : (i += 1) {
                try self.writeUint8(@intCast((value >> (@as(u6, i) * 8)) & 0xFF));
            }
        }
    }

    pub fn writeInt8(self: *BitStreamEncoder, value: i8) Error!void {
        try self.writeUint8(@bitCast(value));
    }

    pub fn writeInt16(self: *BitStreamEncoder, value: i16, endianness: Endianness) Error!void {
        try self.writeUint16(@bitCast(value), endianness);
    }

    pub fn writeInt32(self: *BitStreamEncoder, value: i32, endianness: Endianness) Error!void {
        try self.writeUint32(@bitCast(value), endianness);
    }

    pub fn writeInt64(self: *BitStreamEncoder, value: i64, endianness: Endianness) Error!void {
        try self.writeUint64(@bitCast(value), endianness);
    }

    pub fn writeFloat32(self: *BitStreamEncoder, value: f32, endianness: Endianness) Error!void {
        const bits: u32 = @bitCast(value);
        try self.writeUint32(bits, endianness);
    }

    pub fn writeFloat64(self: *BitStreamEncoder, value: f64, endianness: Endianness) Error!void {
        const bits: u64 = @bitCast(value);
        try self.writeUint64(bits, endianness);
    }

    pub fn writeBytes(self: *BitStreamEncoder, data: []const u8) Error!void {
        if (self.bit_offset == 0) {
            try self.bytes.appendSlice(self.allocator, data);
        } else {
            for (data) |b| try self.writeUint8(b);
        }
    }

    // ---- Variable-length integer encodings ----

    pub fn writeVarlengthDer(self: *BitStreamEncoder, value: u64) Error!void {
        if (value < 128) {
            try self.writeUint8(@intCast(value));
        } else {
            var num_bytes: u6 = 0;
            var temp = value;
            while (temp > 0) : (temp /= 256) num_bytes += 1;
            try self.writeUint8(0x80 | @as(u8, num_bytes));
            var i: u6 = num_bytes;
            while (i > 0) {
                i -= 1;
                try self.writeUint8(@intCast((value >> @as(u6, @intCast(@as(usize, i) * 8))) & 0xFF));
            }
        }
    }

    pub fn writeVarlengthLeb128(self: *BitStreamEncoder, value: u64) Error!void {
        var v = value;
        while (true) {
            var byte: u8 = @intCast(v & 0x7F);
            v >>= 7;
            if (v != 0) byte |= 0x80;
            try self.writeUint8(byte);
            if (v == 0) break;
        }
    }

    pub fn writeVarlengthEbml(self: *BitStreamEncoder, value: u64) Error!void {
        var width: u6 = 1;
        var max_val: u64 = (@as(u64, 1) << 7) - 2;
        while (value > max_val and width < 8) {
            width += 1;
            max_val = (@as(u64, 1) << @intCast(width * 7)) - 2;
        }
        if (value > max_val) return error.InvalidEncoding;
        const marker_bit: u64 = @as(u64, 1) << @intCast(width * 7);
        const encoded = marker_bit | value;
        var i: u6 = width;
        while (i > 0) {
            i -= 1;
            try self.writeUint8(@intCast((encoded >> @as(u6, @intCast(@as(usize, i) * 8))) & 0xFF));
        }
    }

    pub fn writeVarlengthVlq(self: *BitStreamEncoder, value: u64) Error!void {
        if (value > 0x0FFFFFFF) return error.InvalidEncoding;
        var buf: [5]u8 = undefined;
        var n: usize = 0;
        var remaining = value;
        buf[n] = @intCast(remaining & 0x7F);
        n += 1;
        remaining >>= 7;
        while (remaining > 0) {
            buf[n] = @intCast((remaining & 0x7F) | 0x80);
            n += 1;
            remaining >>= 7;
        }
        var i: usize = n;
        while (i > 0) {
            i -= 1;
            try self.writeUint8(buf[i]);
        }
    }

    pub fn writeVarlengthZigzag(self: *BitStreamEncoder, value: i64) Error!void {
        const encoded: u64 = @bitCast((value << 1) ^ (value >> 63));
        var v = encoded;
        while (true) {
            var byte: u8 = @intCast(v & 0x7F);
            v >>= 7;
            if (v != 0) byte |= 0x80;
            try self.writeUint8(byte);
            if (v == 0) break;
        }
    }

    pub fn writeVarlengthSleb128(self: *BitStreamEncoder, value: i64) Error!void {
        var v = value;
        var more = true;
        while (more) {
            var byte: u8 = @intCast(v & 0x7F);
            v >>= 7; // arithmetic shift
            const sign_bit = byte & 0x40;
            if ((v == 0 and sign_bit == 0) or (v == -1 and sign_bit != 0)) {
                more = false;
            } else {
                byte |= 0x80;
            }
            try self.writeUint8(byte);
        }
    }

    // ---- Position / two-pass support ----

    /// Current byte position (number of fully-flushed bytes). Mirrors Python's
    /// `byte_offset` property. Assumes byte alignment (bit_offset == 0) for the
    /// two-pass length/position machinery that calls it.
    pub fn byteOffset(self: *const BitStreamEncoder) usize {
        return self.bytes.items.len;
    }

    /// Reserve a fixed-width little/big-endian slot to be patched later. Writes
    /// zero bytes now and returns a handle recording the offset + width. The
    /// canonical two-pass primitive: write placeholder, encode content, patch.
    pub fn placeholderU8(self: *BitStreamEncoder) Error!Placeholder {
        const off = self.byteOffset();
        try self.writeUint8(0);
        return .{ .offset = off, .width = 1 };
    }

    pub fn placeholderU16(self: *BitStreamEncoder) Error!Placeholder {
        const off = self.byteOffset();
        try self.writeUint16(0, .big_endian);
        return .{ .offset = off, .width = 2 };
    }

    pub fn placeholderU32(self: *BitStreamEncoder) Error!Placeholder {
        const off = self.byteOffset();
        try self.writeUint32(0, .big_endian);
        return .{ .offset = off, .width = 4 };
    }

    pub fn placeholderU64(self: *BitStreamEncoder) Error!Placeholder {
        const off = self.byteOffset();
        try self.writeUint64(0, .big_endian);
        return .{ .offset = off, .width = 8 };
    }

    pub fn patchUint8(self: *BitStreamEncoder, offset: usize, value: u8) void {
        self.bytes.items[offset] = value;
    }

    pub fn patchUint16(self: *BitStreamEncoder, offset: usize, value: u16, endianness: Endianness) void {
        if (endianness == .big_endian) {
            self.bytes.items[offset] = @intCast((value >> 8) & 0xFF);
            self.bytes.items[offset + 1] = @intCast(value & 0xFF);
        } else {
            self.bytes.items[offset] = @intCast(value & 0xFF);
            self.bytes.items[offset + 1] = @intCast((value >> 8) & 0xFF);
        }
    }

    pub fn patchUint32(self: *BitStreamEncoder, offset: usize, value: u32, endianness: Endianness) void {
        if (endianness == .big_endian) {
            self.bytes.items[offset] = @intCast((value >> 24) & 0xFF);
            self.bytes.items[offset + 1] = @intCast((value >> 16) & 0xFF);
            self.bytes.items[offset + 2] = @intCast((value >> 8) & 0xFF);
            self.bytes.items[offset + 3] = @intCast(value & 0xFF);
        } else {
            self.bytes.items[offset] = @intCast(value & 0xFF);
            self.bytes.items[offset + 1] = @intCast((value >> 8) & 0xFF);
            self.bytes.items[offset + 2] = @intCast((value >> 16) & 0xFF);
            self.bytes.items[offset + 3] = @intCast((value >> 24) & 0xFF);
        }
    }

    pub fn patchUint64(self: *BitStreamEncoder, offset: usize, value: u64, endianness: Endianness) void {
        if (endianness == .big_endian) {
            var i: u4 = 0;
            while (i < 8) : (i += 1) {
                self.bytes.items[offset + i] = @intCast((value >> (56 - @as(u6, i) * 8)) & 0xFF);
            }
        } else {
            var i: u4 = 0;
            while (i < 8) : (i += 1) {
                self.bytes.items[offset + i] = @intCast((value >> (@as(u6, i) * 8)) & 0xFF);
            }
        }
    }

    /// Patch a placeholder, validating the width matches the value method used.
    pub fn patch(self: *BitStreamEncoder, p: Placeholder, value: u64, endianness: Endianness) void {
        switch (p.width) {
            1 => self.patchUint8(p.offset, @intCast(value & 0xFF)),
            2 => self.patchUint16(p.offset, @intCast(value & 0xFFFF), endianness),
            4 => self.patchUint32(p.offset, @intCast(value & 0xFFFFFFFF), endianness),
            8 => self.patchUint64(p.offset, value, endianness),
            else => unreachable,
        }
    }

    /// Flush any partial byte and return a caller-owned slice of the encoded
    /// bytes. The encoder is left empty and may be reused.
    pub fn finish(self: *BitStreamEncoder) Error![]u8 {
        if (self.bit_offset > 0) {
            try self.bytes.append(self.allocator, self.current_byte);
            self.current_byte = 0;
            self.bit_offset = 0;
        }
        return self.bytes.toOwnedSlice(self.allocator);
    }

    /// Borrow the current buffer without transferring ownership (flushes the
    /// partial byte first). Used when splicing a sub-encoder's bytes into a
    /// parent during two-pass content-first encoding.
    pub fn view(self: *BitStreamEncoder) []const u8 {
        if (self.bit_offset > 0) {
            self.bytes.append(self.allocator, self.current_byte) catch {};
            self.current_byte = 0;
            self.bit_offset = 0;
        }
        return self.bytes.items;
    }
};

pub const BitStreamDecoder = struct {
    pub const max_position_stack_depth: usize = 128;

    bytes: []const u8,
    byte_offset: usize = 0,
    bit_offset: u4 = 0,
    bit_order: BitOrder,
    saved_positions: [max_position_stack_depth]usize = undefined,
    saved_len: usize = 0,

    pub fn init(data: []const u8, bit_order: BitOrder) BitStreamDecoder {
        return .{ .bytes = data, .bit_order = bit_order };
    }

    pub fn readBit(self: *BitStreamDecoder) Error!u1 {
        if (self.byte_offset >= self.bytes.len) return error.IncompleteData;
        const current_byte = self.bytes[self.byte_offset];
        const bit: u1 = if (self.bit_order == .msb_first)
            @intCast((current_byte >> @as(u3, @intCast(7 - self.bit_offset))) & 1)
        else
            @intCast((current_byte >> @as(u3, @intCast(self.bit_offset))) & 1);

        self.bit_offset += 1;
        if (self.bit_offset == 8) {
            self.byte_offset += 1;
            self.bit_offset = 0;
        }
        return bit;
    }

    pub fn readBits(self: *BitStreamDecoder, size: u7) Error!u64 {
        if (size < 1 or size > 64) return error.InvalidValue;
        var result: u64 = 0;
        if (self.bit_order == .lsb_first) {
            var i: u7 = 0;
            while (i < size) : (i += 1) {
                const bit = try self.readBit();
                result |= (@as(u64, bit) << @intCast(i));
            }
        } else {
            var i: u7 = size;
            while (i > 0) {
                i -= 1;
                const bit = try self.readBit();
                result |= (@as(u64, bit) << @intCast(i));
            }
        }
        return result;
    }

    pub fn readUint8(self: *BitStreamDecoder) Error!u8 {
        if (self.bit_offset == 0) {
            if (self.byte_offset >= self.bytes.len) return error.IncompleteData;
            const val = self.bytes[self.byte_offset];
            self.byte_offset += 1;
            return val;
        } else {
            var result: u8 = 0;
            var i: u4 = 0;
            while (i < 8) : (i += 1) {
                const bit = try self.readBit();
                result |= (@as(u8, bit) << @intCast(i));
            }
            return result;
        }
    }

    pub fn readBytesSlice(self: *BitStreamDecoder, n: usize) Error![]const u8 {
        if (self.bit_offset != 0) return error.AlignmentRequired;
        if (self.byte_offset + n > self.bytes.len) return error.IncompleteData;
        const result = self.bytes[self.byte_offset .. self.byte_offset + n];
        self.byte_offset += n;
        return result;
    }

    /// Zero-copy read of the byte run up to (and consuming) the next
    /// `terminator` byte. The returned slice excludes the terminator and
    /// aliases the input buffer. Errors with IncompleteData if no terminator
    /// is found before end of input.
    pub fn readUntilByte(self: *BitStreamDecoder, terminator: u8) Error![]const u8 {
        if (self.bit_offset != 0) return error.AlignmentRequired;
        const start = self.byte_offset;
        var i = start;
        while (i < self.bytes.len) : (i += 1) {
            if (self.bytes[i] == terminator) {
                self.byte_offset = i + 1; // consume terminator
                return self.bytes[start..i];
            }
        }
        return error.IncompleteData;
    }

    pub fn readUint16(self: *BitStreamDecoder, endianness: Endianness) Error!u16 {
        if (self.bit_offset == 0 and self.byte_offset + 2 <= self.bytes.len) {
            const b0 = self.bytes[self.byte_offset];
            const b1 = self.bytes[self.byte_offset + 1];
            self.byte_offset += 2;
            return if (endianness == .big_endian)
                (@as(u16, b0) << 8) | b1
            else
                @as(u16, b0) | (@as(u16, b1) << 8);
        }
        if (endianness == .big_endian) {
            const high = try self.readUint8();
            const low = try self.readUint8();
            return (@as(u16, high) << 8) | low;
        } else {
            const low = try self.readUint8();
            const high = try self.readUint8();
            return (@as(u16, high) << 8) | low;
        }
    }

    pub fn readUint32(self: *BitStreamDecoder, endianness: Endianness) Error!u32 {
        if (self.bit_offset == 0 and self.byte_offset + 4 <= self.bytes.len) {
            const b = self.bytes[self.byte_offset .. self.byte_offset + 4];
            self.byte_offset += 4;
            return if (endianness == .big_endian)
                (@as(u32, b[0]) << 24) | (@as(u32, b[1]) << 16) | (@as(u32, b[2]) << 8) | b[3]
            else
                @as(u32, b[0]) | (@as(u32, b[1]) << 8) | (@as(u32, b[2]) << 16) | (@as(u32, b[3]) << 24);
        }
        var bytes4: [4]u8 = undefined;
        for (&bytes4) |*slot| slot.* = try self.readUint8();
        return if (endianness == .big_endian)
            (@as(u32, bytes4[0]) << 24) | (@as(u32, bytes4[1]) << 16) | (@as(u32, bytes4[2]) << 8) | bytes4[3]
        else
            @as(u32, bytes4[0]) | (@as(u32, bytes4[1]) << 8) | (@as(u32, bytes4[2]) << 16) | (@as(u32, bytes4[3]) << 24);
    }

    pub fn readUint64(self: *BitStreamDecoder, endianness: Endianness) Error!u64 {
        var result: u64 = 0;
        if (endianness == .big_endian) {
            var i: u4 = 0;
            while (i < 8) : (i += 1) {
                result = (result << 8) | try self.readUint8();
            }
        } else {
            var i: u4 = 0;
            while (i < 8) : (i += 1) {
                result |= (@as(u64, try self.readUint8()) << (@as(u6, i) * 8));
            }
        }
        return result;
    }

    pub fn readInt8(self: *BitStreamDecoder) Error!i8 {
        return @bitCast(try self.readUint8());
    }

    pub fn readInt16(self: *BitStreamDecoder, endianness: Endianness) Error!i16 {
        return @bitCast(try self.readUint16(endianness));
    }

    pub fn readInt32(self: *BitStreamDecoder, endianness: Endianness) Error!i32 {
        return @bitCast(try self.readUint32(endianness));
    }

    pub fn readInt64(self: *BitStreamDecoder, endianness: Endianness) Error!i64 {
        return @bitCast(try self.readUint64(endianness));
    }

    pub fn readFloat32(self: *BitStreamDecoder, endianness: Endianness) Error!f32 {
        return @bitCast(try self.readUint32(endianness));
    }

    pub fn readFloat64(self: *BitStreamDecoder, endianness: Endianness) Error!f64 {
        return @bitCast(try self.readUint64(endianness));
    }

    // ---- Variable-length integer decodings ----

    pub fn readVarlengthDer(self: *BitStreamDecoder) Error!u64 {
        const first_byte = try self.readUint8();
        if (first_byte < 0x80) return first_byte;
        const num_bytes = first_byte & 0x7F;
        if (num_bytes == 0) return error.InvalidEncoding;
        if (num_bytes > 4) return error.InvalidEncoding;
        var value: u64 = 0;
        var i: u8 = 0;
        while (i < num_bytes) : (i += 1) value = (value << 8) | try self.readUint8();
        return value;
    }

    pub fn readVarlengthLeb128(self: *BitStreamDecoder) Error!u64 {
        var result: u64 = 0;
        var shift: u7 = 0;
        while (true) {
            const byte = try self.readUint8();
            result |= (@as(u64, byte & 0x7F) << @intCast(shift));
            shift += 7;
            if ((byte & 0x80) == 0) break;
            if (shift > 64) return error.InvalidEncoding;
        }
        return result;
    }

    pub fn readVarlengthEbml(self: *BitStreamDecoder) Error!u64 {
        const first_byte = try self.readUint8();
        var width: u6 = 1;
        var mask: u8 = 0x80;
        while (width <= 8 and (first_byte & mask) == 0) {
            width += 1;
            mask >>= 1;
        }
        if (width > 8) return error.InvalidEncoding;
        var value: u64 = first_byte & (mask - 1);
        var i: u6 = 1;
        while (i < width) : (i += 1) value = (value << 8) | try self.readUint8();
        return value;
    }

    pub fn readVarlengthVlq(self: *BitStreamDecoder) Error!u64 {
        var result: u64 = 0;
        var bytes_read: u8 = 0;
        while (true) {
            if (bytes_read >= 4) return error.InvalidEncoding;
            const byte = try self.readUint8();
            bytes_read += 1;
            result = (result << 7) | (byte & 0x7F);
            if ((byte & 0x80) == 0) break;
        }
        return result;
    }

    pub fn readVarlengthZigzag(self: *BitStreamDecoder) Error!i64 {
        var encoded: u64 = 0;
        var shift: u7 = 0;
        while (true) {
            const byte = try self.readUint8();
            encoded |= (@as(u64, byte & 0x7F) << @intCast(shift));
            shift += 7;
            if ((byte & 0x80) == 0) break;
            if (shift > 64) return error.InvalidEncoding;
        }
        const low: i64 = @bitCast(encoded >> 1);
        const neg: i64 = -@as(i64, @intCast(encoded & 1));
        return low ^ neg;
    }

    pub fn readVarlengthSleb128(self: *BitStreamDecoder) Error!i64 {
        var result: u64 = 0;
        var shift: u7 = 0;
        var byte: u8 = 0;
        while (true) {
            byte = try self.readUint8();
            result |= (@as(u64, byte & 0x7F) << @intCast(shift));
            shift += 7;
            if ((byte & 0x80) == 0) break;
            if (shift > 64) return error.InvalidEncoding;
        }
        var signed: i64 = @bitCast(result);
        if (shift < 64 and (byte & 0x40) != 0) {
            signed |= -(@as(i64, 1) << @intCast(shift));
        }
        return signed;
    }

    // ---- Position / random access ----

    pub fn position(self: *const BitStreamDecoder) usize {
        return self.byte_offset;
    }

    pub fn seek(self: *BitStreamDecoder, offset: usize) Error!void {
        if (offset > self.bytes.len) return error.OutOfBounds;
        self.byte_offset = offset;
        self.bit_offset = 0;
    }

    pub fn pushPosition(self: *BitStreamDecoder) Error!void {
        if (self.saved_len >= max_position_stack_depth) return error.StackOverflow;
        self.saved_positions[self.saved_len] = self.byte_offset;
        self.saved_len += 1;
    }

    pub fn popPosition(self: *BitStreamDecoder) Error!void {
        if (self.saved_len == 0) return error.InvalidValue;
        self.saved_len -= 1;
        self.byte_offset = self.saved_positions[self.saved_len];
        self.bit_offset = 0;
    }

    pub fn peekUint8(self: *const BitStreamDecoder) Error!u8 {
        if (self.bit_offset != 0) return error.AlignmentRequired;
        if (self.byte_offset >= self.bytes.len) return error.OutOfBounds;
        return self.bytes[self.byte_offset];
    }

    pub fn peekUint16(self: *const BitStreamDecoder, endianness: Endianness) Error!u16 {
        if (self.bit_offset != 0) return error.AlignmentRequired;
        if (self.byte_offset + 2 > self.bytes.len) return error.OutOfBounds;
        const b0 = self.bytes[self.byte_offset];
        const b1 = self.bytes[self.byte_offset + 1];
        return if (endianness == .big_endian)
            (@as(u16, b0) << 8) | b1
        else
            @as(u16, b0) | (@as(u16, b1) << 8);
    }

    pub fn peekUint32(self: *const BitStreamDecoder, endianness: Endianness) Error!u32 {
        if (self.bit_offset != 0) return error.AlignmentRequired;
        if (self.byte_offset + 4 > self.bytes.len) return error.OutOfBounds;
        const b = self.bytes[self.byte_offset .. self.byte_offset + 4];
        return if (endianness == .big_endian)
            (@as(u32, b[0]) << 24) | (@as(u32, b[1]) << 16) | (@as(u32, b[2]) << 8) | b[3]
        else
            @as(u32, b[0]) | (@as(u32, b[1]) << 8) | (@as(u32, b[2]) << 16) | (@as(u32, b[3]) << 24);
    }

    pub fn peekUint8At(self: *const BitStreamDecoder, offset: usize) Error!u8 {
        if (self.bit_offset != 0) return error.AlignmentRequired;
        const idx = self.byte_offset + offset;
        if (idx >= self.bytes.len) return error.OutOfBounds;
        return self.bytes[idx];
    }

    pub fn hasMore(self: *const BitStreamDecoder) bool {
        return self.byte_offset < self.bytes.len or self.bit_offset > 0;
    }
};

// ---------------------------------------------------------------------------
// Tests — round-trip the encoder against the decoder for every primitive so
// the two-pass machinery and bit ordering are exercised from day one.
// ---------------------------------------------------------------------------

const testing = std.testing;

fn newEncoder() BitStreamEncoder {
    return BitStreamEncoder.init(testing.allocator, .msb_first);
}

test "uint round-trips big/little endian" {
    var enc = newEncoder();
    defer enc.deinit();
    try enc.writeUint8(0xAB);
    try enc.writeUint16(0x1234, .big_endian);
    try enc.writeUint16(0x1234, .little_endian);
    try enc.writeUint32(0xDEADBEEF, .big_endian);
    try enc.writeUint64(0x0102030405060708, .big_endian);
    const out = try enc.finish();
    defer testing.allocator.free(out);

    var dec = BitStreamDecoder.init(out, .msb_first);
    try testing.expectEqual(@as(u8, 0xAB), try dec.readUint8());
    try testing.expectEqual(@as(u16, 0x1234), try dec.readUint16(.big_endian));
    try testing.expectEqual(@as(u16, 0x1234), try dec.readUint16(.little_endian));
    try testing.expectEqual(@as(u32, 0xDEADBEEF), try dec.readUint32(.big_endian));
    try testing.expectEqual(@as(u64, 0x0102030405060708), try dec.readUint64(.big_endian));
}

test "signed and float round-trip" {
    var enc = newEncoder();
    defer enc.deinit();
    try enc.writeInt8(-5);
    try enc.writeInt32(-123456, .little_endian);
    try enc.writeFloat32(1.5, .big_endian);
    try enc.writeFloat64(-2.25, .little_endian);
    const out = try enc.finish();
    defer testing.allocator.free(out);

    var dec = BitStreamDecoder.init(out, .msb_first);
    try testing.expectEqual(@as(i8, -5), try dec.readInt8());
    try testing.expectEqual(@as(i32, -123456), try dec.readInt32(.little_endian));
    try testing.expectEqual(@as(f32, 1.5), try dec.readFloat32(.big_endian));
    try testing.expectEqual(@as(f64, -2.25), try dec.readFloat64(.little_endian));
}

test "bit-level packing msb_first" {
    var enc = newEncoder();
    defer enc.deinit();
    try enc.writeBits(0b101, 3);
    try enc.writeBits(0b01, 2);
    try enc.writeBits(0b111, 3);
    const out = try enc.finish();
    defer testing.allocator.free(out);
    try testing.expectEqual(@as(usize, 1), out.len);
    try testing.expectEqual(@as(u8, 0b10101111), out[0]);

    var dec = BitStreamDecoder.init(out, .msb_first);
    try testing.expectEqual(@as(u64, 0b101), try dec.readBits(3));
    try testing.expectEqual(@as(u64, 0b01), try dec.readBits(2));
    try testing.expectEqual(@as(u64, 0b111), try dec.readBits(3));
}

test "two-pass placeholder/patch length prefix" {
    var enc = newEncoder();
    defer enc.deinit();
    // Write a u16 length placeholder, then content, then patch the length.
    const ph = try enc.placeholderU16();
    const start = enc.byteOffset();
    try enc.writeBytes(&[_]u8{ 1, 2, 3, 4, 5 });
    const len = enc.byteOffset() - start;
    enc.patch(ph, len, .big_endian);
    const out = try enc.finish();
    defer testing.allocator.free(out);
    try testing.expectEqual(@as(u8, 0x00), out[0]);
    try testing.expectEqual(@as(u8, 0x05), out[1]);
    try testing.expectEqualSlices(u8, &[_]u8{ 1, 2, 3, 4, 5 }, out[2..]);
}

test "varlength encodings round-trip" {
    var enc = newEncoder();
    defer enc.deinit();
    try enc.writeVarlengthDer(300);
    try enc.writeVarlengthLeb128(624485);
    try enc.writeVarlengthEbml(1000);
    try enc.writeVarlengthVlq(137);
    try enc.writeVarlengthZigzag(-75);
    try enc.writeVarlengthSleb128(-12345);
    const out = try enc.finish();
    defer testing.allocator.free(out);

    var dec = BitStreamDecoder.init(out, .msb_first);
    try testing.expectEqual(@as(u64, 300), try dec.readVarlengthDer());
    try testing.expectEqual(@as(u64, 624485), try dec.readVarlengthLeb128());
    try testing.expectEqual(@as(u64, 1000), try dec.readVarlengthEbml());
    try testing.expectEqual(@as(u64, 137), try dec.readVarlengthVlq());
    try testing.expectEqual(@as(i64, -75), try dec.readVarlengthZigzag());
    try testing.expectEqual(@as(i64, -12345), try dec.readVarlengthSleb128());
}

test "crc32 matches known vector" {
    // CRC32 of "123456789" is 0xCBF43926.
    try testing.expectEqual(@as(u32, 0xCBF43926), computeCrc32("123456789"));
}
