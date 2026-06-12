//! EncodeContext — the context-threading machinery for two-pass encoding.
//!
//! This is deliberately built *before* any generator feature needs it. Every
//! prior BinSchema generator (Go, Rust, Python) was first written single-pass
//! and had to be rewritten the moment a real protocol needed a forward
//! reference (`length_of` + `from_after_field`, `position_of` to a later
//! field, `../` parent refs). The fix is to thread one `*EncodeContext`
//! through every generated encode call from day one.
//!
//! ## Parent frames (`../field` resolution)
//!
//! Each struct's `encodeInto` pushes a *frame* before encoding its fields and
//! pops it after. A frame records, per field, its logical length (array element
//! count / string-bytes count, known from the input value) and its encoded byte
//! range `[start, end)` in the shared encoder buffer. Children resolve
//! `../field` against an ancestor frame:
//!   - `length_of ../field`  — read synchronously from the ancestor frame's
//!     pre-registered length (the parent registers lengths before encoding
//!     children, so the value is available when the child encodes).
//!   - `position_of ../field` / `crc32_of ../field` — the field's offset/bytes
//!     are not known when the child encodes (the field comes later in the
//!     parent), so the child writes a fixed-width placeholder and registers a
//!     *deferred patch* capturing the ancestor frame pointer. Once the whole
//!     tree is encoded, `resolveDeferredPatches` fills every patch in.
//!
//! Because every nested struct encodes into the *same* encoder, placeholder
//! offsets are absolute in one buffer — no per-struct sub-encoder rebasing is
//! needed (unlike the Python runtime).
//!
//! ## Memory
//!
//! The context owns an arena. Frames are arena-allocated and referenced by
//! pointer, so a frame pointer captured in a deferred patch stays valid even
//! after the frame is popped (pop only removes it from the active stack; the
//! arena keeps the storage until `deinit`). `deinit()` frees the whole graph.

const std = @import("std");
const bitstream = @import("bitstream.zig");
const err = @import("errors.zig");
const Error = err.Error;
const Endianness = bitstream.Endianness;
const BitStreamEncoder = bitstream.BitStreamEncoder;

pub const ByteRange = struct { start: usize, end: usize };

/// Per-field info captured in a parent frame. `length` is the logical length
/// (array element count / string byte count); `range` is the encoded byte span.
pub const FieldInfo = struct {
    length: ?u64 = null,
    range: ?ByteRange = null,
};

/// One struct-encode scope. Field name -> info. Arena-allocated; referenced by
/// pointer so captures survive the frame being popped.
pub const Frame = struct {
    fields: std.StringHashMapUnmanaged(FieldInfo) = .empty,
};

const PositionEntry = struct {
    offset: usize,
    type_name: ?[]const u8,
};

const IterState = struct {
    done: bool = false,
    type_indices: std.StringHashMapUnmanaged(usize) = .empty,
};

pub const PatchWidth = enum(u8) { u8 = 1, u16 = 2, u32 = 4, u64 = 8 };

pub const SelectorKind = enum { first, last, corresponding };

/// A patch whose target value isn't known when the slot is written, resolved
/// against ctx state once the whole tree is encoded.
pub const Patch = union(enum) {
    /// `position_of(../field)` — byte offset where an ancestor field starts.
    parent_position: struct {
        local_offset: usize,
        width: PatchWidth,
        endianness: Endianness,
        frame: *Frame,
        field_name: []const u8,
        alignment: usize = 1,
    },
    /// `crc32_of(../field)` — CRC32 over an ancestor field's byte span.
    parent_crc32: struct {
        local_offset: usize,
        width: PatchWidth,
        endianness: Endianness,
        frame: *Frame,
        field_name: []const u8,
    },
    /// `position_of(array[first<T>|last<T>|corresponding<T>])`.
    selector_position: struct {
        local_offset: usize,
        width: PatchWidth,
        endianness: Endianness,
        array_name: []const u8,
        selector: SelectorKind,
        filter_type: ?[]const u8,
        alignment: usize = 1,
    },
};

pub const EncodeContext = struct {
    arena: std.heap.ArenaAllocator,
    frames: std.ArrayListUnmanaged(*Frame) = .empty,
    positions: std.StringHashMapUnmanaged(std.ArrayListUnmanaged(PositionEntry)) = .empty,
    array_iterations: std.StringHashMapUnmanaged(IterState) = .empty,
    deferred_patches: std.ArrayListUnmanaged(Patch) = .empty,
    compression_dict: std.StringHashMapUnmanaged(usize) = .empty,
    absolute_byte_offset: usize = 0,

    pub fn init(backing: std.mem.Allocator) EncodeContext {
        return .{ .arena = std.heap.ArenaAllocator.init(backing) };
    }

    pub fn deinit(self: *EncodeContext) void {
        self.arena.deinit();
    }

    fn alloc(self: *EncodeContext) std.mem.Allocator {
        return self.arena.allocator();
    }

    // ---- Parent frames (`../field` resolution) ----

    /// Push a fresh frame and return a stable pointer to it.
    pub fn pushParent(self: *EncodeContext) Error!*Frame {
        const a = self.alloc();
        const f = try a.create(Frame);
        f.* = .{};
        try self.frames.append(a, f);
        return f;
    }

    pub fn popParent(self: *EncodeContext) void {
        if (self.frames.items.len > 0) _ = self.frames.pop();
    }

    /// Frame `levels_up` above the top of the stack (0 = current/top frame,
    /// 1 = direct parent, matching one `../`). Null if out of range.
    pub fn frameAtLevel(self: *EncodeContext, levels_up: usize) ?*Frame {
        const n = self.frames.items.len;
        if (levels_up >= n) return null;
        return self.frames.items[n - 1 - levels_up];
    }

    pub fn setLength(self: *EncodeContext, frame: *Frame, name: []const u8, length: u64) Error!void {
        const gop = try frame.fields.getOrPut(self.alloc(), name);
        if (!gop.found_existing) gop.value_ptr.* = .{};
        gop.value_ptr.length = length;
    }

    pub fn setRange(self: *EncodeContext, frame: *Frame, name: []const u8, start: usize, end: usize) Error!void {
        const gop = try frame.fields.getOrPut(self.alloc(), name);
        if (!gop.found_existing) gop.value_ptr.* = .{};
        gop.value_ptr.range = .{ .start = start, .end = end };
    }

    /// Logical length of `../field` `levels_up` frames up (for length_of/count_of).
    pub fn parentLength(self: *EncodeContext, levels_up: usize, name: []const u8) ?u64 {
        const f = self.frameAtLevel(levels_up) orelse return null;
        const info = f.fields.get(name) orelse return null;
        return info.length;
    }

    // ---- Array position tracking (selectors) ----

    pub fn recordPosition(
        self: *EncodeContext,
        array_name: []const u8,
        type_name: ?[]const u8,
        offset: usize,
    ) Error!void {
        const a = self.alloc();
        const gop = try self.positions.getOrPut(a, array_name);
        if (!gop.found_existing) gop.value_ptr.* = .empty;
        try gop.value_ptr.append(a, .{ .offset = offset, .type_name = type_name });
    }

    pub fn getPosition(
        self: *EncodeContext,
        array_name: []const u8,
        type_name: ?[]const u8,
        index: usize,
    ) ?usize {
        const entries = self.positions.get(array_name) orelse return null;
        var count: usize = 0;
        for (entries.items) |e| {
            const matches = type_name == null or e.type_name == null or
                std.mem.eql(u8, e.type_name.?, type_name.?);
            if (matches) {
                if (count == index) return e.offset;
                count += 1;
            }
        }
        return null;
    }

    // ---- Array iteration state (corresponding<T> correlation) ----

    pub fn iterState(self: *EncodeContext, array_name: []const u8) Error!*IterState {
        const gop = try self.array_iterations.getOrPut(self.alloc(), array_name);
        if (!gop.found_existing) gop.value_ptr.* = .{};
        return gop.value_ptr;
    }

    pub fn markArrayDone(self: *EncodeContext, array_name: []const u8) Error!void {
        const st = try self.iterState(array_name);
        st.done = true;
    }

    pub fn bumpTypeIndex(self: *EncodeContext, array_name: []const u8, type_name: []const u8) Error!usize {
        const st = try self.iterState(array_name);
        const gop = try st.type_indices.getOrPut(self.alloc(), type_name);
        if (!gop.found_existing) gop.value_ptr.* = 0;
        gop.value_ptr.* += 1;
        return gop.value_ptr.*;
    }

    // ---- Back-reference compression dictionary ----

    pub fn compressionLookup(self: *EncodeContext, key: []const u8) ?usize {
        return self.compression_dict.get(key);
    }

    pub fn compressionInsert(self: *EncodeContext, key: []const u8, offset: usize) Error!void {
        const a = self.alloc();
        const owned = try a.dupe(u8, key);
        try self.compression_dict.put(a, owned, offset);
    }

    // ---- Deferred patches ----

    pub fn addDeferredPatch(self: *EncodeContext, patch: Patch) Error!void {
        try self.deferred_patches.append(self.alloc(), patch);
    }

    fn applyAlignment(value: usize, alignment: usize) usize {
        if (alignment <= 1) return value;
        const rem = value % alignment;
        return if (rem == 0) value else value + (alignment - rem);
    }

    fn writePatch(enc: *BitStreamEncoder, off: usize, width: PatchWidth, value: u64, e: Endianness) void {
        switch (width) {
            .u8 => enc.patchUint8(off, @intCast(value & 0xFF)),
            .u16 => enc.patchUint16(off, @intCast(value & 0xFFFF), e),
            .u32 => enc.patchUint32(off, @intCast(value & 0xFFFFFFFF), e),
            .u64 => enc.patchUint64(off, value, e),
        }
    }

    /// Resolve every deferred patch against current ctx state, writing resolved
    /// ones into `enc`. Patches that still can't resolve are retained.
    pub fn resolveDeferredPatches(self: *EncodeContext, enc: *BitStreamEncoder) Error!void {
        var remaining: std.ArrayListUnmanaged(Patch) = .empty;
        for (self.deferred_patches.items) |p| {
            const resolved: ?u64 = switch (p) {
                .parent_position => |pp| blk: {
                    const info = pp.frame.fields.get(pp.field_name) orelse break :blk null;
                    const r = info.range orelse break :blk null;
                    break :blk @as(u64, applyAlignment(r.start, pp.alignment));
                },
                .parent_crc32 => |pc| blk: {
                    const info = pc.frame.fields.get(pc.field_name) orelse break :blk null;
                    const r = info.range orelse break :blk null;
                    if (r.end <= r.start) break :blk @as(u64, bitstream.computeCrc32(""));
                    break :blk bitstream.computeCrc32(enc.bytes.items[r.start..r.end]);
                },
                .selector_position => |sp| blk: {
                    const st = self.array_iterations.get(sp.array_name);
                    switch (sp.selector) {
                        .first => {
                            if (st == null or !st.?.done) break :blk null;
                            break :blk self.resolveSelectorFirstLast(sp, true);
                        },
                        .last => {
                            if (st == null or !st.?.done) break :blk null;
                            break :blk self.resolveSelectorFirstLast(sp, false);
                        },
                        .corresponding => {
                            if (self.positions.get(sp.array_name) == null) break :blk null;
                            break :blk self.resolveSelectorCorresponding(sp, st);
                        },
                    }
                },
            };

            if (resolved) |value| {
                const off, const width, const e = patchTarget(p);
                writePatch(enc, off, width, value, e);
            } else {
                try remaining.append(self.alloc(), p);
            }
        }
        self.deferred_patches = remaining;
    }

    fn patchTarget(p: Patch) struct { usize, PatchWidth, Endianness } {
        return switch (p) {
            .parent_position => |x| .{ x.local_offset, x.width, x.endianness },
            .parent_crc32 => |x| .{ x.local_offset, x.width, x.endianness },
            .selector_position => |x| .{ x.local_offset, x.width, x.endianness },
        };
    }

    fn resolveSelectorFirstLast(self: *EncodeContext, sp: anytype, first: bool) u64 {
        const entries = (self.positions.get(sp.array_name) orelse return 0xFFFFFFFF).items;
        if (first) {
            for (entries) |e| {
                if (matchType(e.type_name, sp.filter_type)) return applyAlignment(e.offset, sp.alignment);
            }
        } else {
            var i = entries.len;
            while (i > 0) {
                i -= 1;
                if (matchType(entries[i].type_name, sp.filter_type)) return applyAlignment(entries[i].offset, sp.alignment);
            }
        }
        return 0xFFFFFFFF;
    }

    fn resolveSelectorCorresponding(self: *EncodeContext, sp: anytype, st: ?IterState) u64 {
        const entries = (self.positions.get(sp.array_name) orelse return 0xFFFFFFFF).items;
        var target_idx: usize = 0;
        if (sp.filter_type) |ft| {
            if (st) |s| {
                if (s.type_indices.get(ft)) |c| target_idx = c -| 1;
            }
        }
        var count: usize = 0;
        for (entries) |e| {
            if (matchType(e.type_name, sp.filter_type)) {
                if (count == target_idx) return applyAlignment(e.offset, sp.alignment);
                count += 1;
            }
        }
        return 0xFFFFFFFF;
    }

    fn matchType(entry_type: ?[]const u8, filter_type: ?[]const u8) bool {
        if (filter_type == null) return true;
        if (entry_type == null) return true;
        return std.mem.eql(u8, entry_type.?, filter_type.?);
    }
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const testing = std.testing;

test "parent frames resolve ../field length at depth" {
    var ctx = EncodeContext.init(testing.allocator);
    defer ctx.deinit();

    const outer = try ctx.pushParent();
    try ctx.setLength(outer, "payload", 100);
    const inner = try ctx.pushParent();
    try ctx.setLength(inner, "blob", 7);

    try testing.expectEqual(@as(u64, 7), ctx.parentLength(0, "blob").?);
    try testing.expectEqual(@as(u64, 100), ctx.parentLength(1, "payload").?);
    try testing.expect(ctx.parentLength(0, "missing") == null);

    ctx.popParent();
    // Popped frame storage survives in the arena, but it leaves the active stack.
    try testing.expect(ctx.parentLength(0, "blob") == null);
    try testing.expectEqual(@as(u64, 100), ctx.parentLength(0, "payload").?);
}

test "deferred parent_position patch resolves against captured frame after pop" {
    var ctx = EncodeContext.init(testing.allocator);
    defer ctx.deinit();
    var enc = BitStreamEncoder.init(testing.allocator, .msb_first);
    defer enc.deinit();

    const parent = try ctx.pushParent();
    // Child writes a placeholder for position_of(../data) before data exists.
    const ph = try enc.placeholderU32();
    // ... child returns; parent later encodes `data` at offset 8 and records it.
    try enc.writeBytes(&[_]u8{ 0, 0, 0, 0 }); // pad to offset 8
    const start = enc.byteOffset();
    try enc.writeBytes(&[_]u8{ 0xAA, 0xBB, 0xCC });
    try ctx.setRange(parent, "data", start, enc.byteOffset());

    try ctx.addDeferredPatch(.{ .parent_position = .{
        .local_offset = ph.offset,
        .width = .u32,
        .endianness = .big_endian,
        .frame = parent,
        .field_name = "data",
    } });
    ctx.popParent(); // frame survives in arena
    try ctx.resolveDeferredPatches(&enc);

    const out = try enc.finish();
    defer testing.allocator.free(out);
    try testing.expectEqual(@as(u8, 0x00), out[0]);
    try testing.expectEqual(@as(u8, 0x00), out[1]);
    try testing.expectEqual(@as(u8, 0x00), out[2]);
    try testing.expectEqual(@as(u8, 0x08), out[3]); // position of data == 8
}

test "deferred parent_crc32 patch resolves over field range" {
    var ctx = EncodeContext.init(testing.allocator);
    defer ctx.deinit();
    var enc = BitStreamEncoder.init(testing.allocator, .msb_first);
    defer enc.deinit();

    const parent = try ctx.pushParent();
    const ph = try enc.placeholderU32();
    const start = enc.byteOffset();
    try enc.writeBytes("123456789");
    try ctx.setRange(parent, "data", start, enc.byteOffset());
    try ctx.addDeferredPatch(.{ .parent_crc32 = .{
        .local_offset = ph.offset,
        .width = .u32,
        .endianness = .big_endian,
        .frame = parent,
        .field_name = "data",
    } });
    try ctx.resolveDeferredPatches(&enc);

    const out = try enc.finish();
    defer testing.allocator.free(out);
    // CRC32("123456789") == 0xCBF43926, big-endian.
    try testing.expectEqual(@as(u8, 0xCB), out[0]);
    try testing.expectEqual(@as(u8, 0xF4), out[1]);
    try testing.expectEqual(@as(u8, 0x39), out[2]);
    try testing.expectEqual(@as(u8, 0x26), out[3]);
}

test "position tracking and selector resolution" {
    var ctx = EncodeContext.init(testing.allocator);
    defer ctx.deinit();
    try ctx.recordPosition("items", "Label", 12);
    try ctx.recordPosition("items", "Pointer", 20);
    try ctx.recordPosition("items", "Label", 24);
    try ctx.markArrayDone("items");

    try testing.expectEqual(@as(usize, 12), ctx.getPosition("items", "Label", 0).?);
    try testing.expectEqual(@as(usize, 24), ctx.getPosition("items", "Label", 1).?);
    try testing.expectEqual(@as(usize, 20), ctx.getPosition("items", "Pointer", 0).?);
}
