//! EncodeContext — the context-threading machinery for two-pass encoding.
//!
//! This is deliberately built *before* any generator feature needs it. Every
//! prior BinSchema generator (Go, Rust, Python) was first written single-pass
//! and had to be rewritten the moment a real protocol needed a forward
//! reference (`length_of` + `from_after_field`, `position_of` to a later
//! field, `../` parent refs). The fix is to thread one `*EncodeContext`
//! through every generated encode/decode call from day one — even while the
//! early phases don't read from it yet.
//!
//! Design (mirrors `python/runtime` ctx dict + `go/runtime/context.go`, typed):
//!   - parents:          stack of field maps for `../field` resolution at depth
//!   - positions:        per-array byte offsets for first/last/corresponding
//!   - array_iterations: per-array iteration state (done flag, type counters)
//!   - deferred_patches: selector/parent patches resolved at an outer scope
//!   - compression_dict: encoded-bytes -> offset, for DNS-style back references
//!
//! Memory: the context owns an internal arena; every allocation it makes goes
//! through that arena, so `deinit()` frees the whole graph at once. The parent
//! stack is push/pop on the single threaded instance (no per-level cloning),
//! because shared state (positions, iterations, patches, dict) must be visible
//! across the whole encode.
//!
//! Phase 1 scope: the struct, parent stack, position tracking, iteration
//! tracking, and the deferred-patch list with a resolver covering parent-field
//! position/crc32 and first/last/corresponding selectors. `sum_of_sizes` and
//! any further patch shapes are co-designed with the generator in Phase 3.

const std = @import("std");
const bitstream = @import("bitstream.zig");
const err = @import("errors.zig");
const Error = err.Error;
const Endianness = bitstream.Endianness;
const BitStreamEncoder = bitstream.BitStreamEncoder;

/// A heterogeneous value captured from a parent field so a child encoder can
/// resolve `../field` references. `range` records a [start, end) byte span in
/// the owning encoder's buffer (for length_of / crc32_of over that field).
pub const FieldValue = union(enum) {
    u: u64,
    i: i64,
    f: f64,
    boolean: bool,
    bytes: []const u8,
    /// Byte span [start, end) in the owning encoder buffer.
    range: struct { start: usize, end: usize },

    pub fn asU64(self: FieldValue) ?u64 {
        return switch (self) {
            .u => |v| v,
            .i => |v| @bitCast(v),
            .boolean => |b| @intFromBool(b),
            .range => |r| r.start,
            else => null,
        };
    }

    /// Length of the value: byte length for bytes/range, else 0.
    pub fn lengthOf(self: FieldValue) usize {
        return switch (self) {
            .bytes => |b| b.len,
            .range => |r| if (r.end > r.start) r.end - r.start else 0,
            else => 0,
        };
    }
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
/// against ctx state at an outer scope. Tagged by what it computes.
pub const Patch = union(enum) {
    /// `position_of(../field)` — byte offset where a parent field starts.
    parent_position: struct {
        local_offset: usize,
        width: PatchWidth,
        endianness: Endianness,
        parent_level: usize,
        field_name: []const u8,
        alignment: usize = 1,
    },
    /// `crc32_of(../field)` — CRC32 over the parent field's byte span.
    parent_crc32: struct {
        local_offset: usize,
        width: PatchWidth,
        endianness: Endianness,
        parent_level: usize,
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
    parents: std.ArrayListUnmanaged(std.StringHashMapUnmanaged(FieldValue)) = .empty,
    positions: std.StringHashMapUnmanaged(std.ArrayListUnmanaged(PositionEntry)) = .empty,
    array_iterations: std.StringHashMapUnmanaged(IterState) = .empty,
    deferred_patches: std.ArrayListUnmanaged(Patch) = .empty,
    compression_dict: std.StringHashMapUnmanaged(usize) = .empty,
    absolute_byte_offset: usize = 0,

    pub fn init(backing: std.mem.Allocator) EncodeContext {
        return .{ .arena = std.heap.ArenaAllocator.init(backing) };
    }

    pub fn deinit(self: *EncodeContext) void {
        // Everything was allocated from the arena, so a single reset frees it.
        self.arena.deinit();
    }

    fn alloc(self: *EncodeContext) std.mem.Allocator {
        return self.arena.allocator();
    }

    // ---- Parent stack (`../field` resolution) ----

    /// Push an empty parent field map and return a pointer to it so the caller
    /// can populate fields as they are encoded.
    pub fn pushParent(self: *EncodeContext) Error!*std.StringHashMapUnmanaged(FieldValue) {
        try self.parents.append(self.alloc(), .empty);
        return &self.parents.items[self.parents.items.len - 1];
    }

    pub fn popParent(self: *EncodeContext) void {
        if (self.parents.items.len > 0) _ = self.parents.pop();
    }

    pub fn setParentField(
        self: *EncodeContext,
        map: *std.StringHashMapUnmanaged(FieldValue),
        name: []const u8,
        value: FieldValue,
    ) Error!void {
        try map.put(self.alloc(), name, value);
    }

    /// Resolve `../field` `levels_up` frames above the top of the parent stack
    /// (0 = immediate parent). Returns null if missing.
    pub fn getParentField(self: *EncodeContext, levels_up: usize, name: []const u8) ?FieldValue {
        const n = self.parents.items.len;
        if (levels_up >= n) return null;
        const idx = n - 1 - levels_up;
        return self.parents.items[idx].get(name);
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
        // Own a copy of the key so it outlives the caller's buffer.
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

    /// Try to resolve every deferred patch against current ctx state, writing
    /// resolved ones into `enc`. Patches that can't yet resolve (target array
    /// not fully encoded) are retained for an outer scope to retry. Mirrors
    /// Python's `_resolve_deferred_patches`.
    pub fn resolveDeferredPatches(self: *EncodeContext, enc: *BitStreamEncoder) Error!void {
        var remaining: std.ArrayListUnmanaged(Patch) = .empty;
        for (self.deferred_patches.items) |p| {
            const resolved: ?u64 = switch (p) {
                .parent_position => |pp| blk: {
                    const fv = self.getParentField(pp.parent_level, pp.field_name) orelse break :blk null;
                    const start = fv.asU64() orelse break :blk null;
                    break :blk @as(u64, applyAlignment(@intCast(start), pp.alignment));
                },
                .parent_crc32 => |pc| blk: {
                    const fv = self.getParentField(pc.parent_level, pc.field_name) orelse break :blk null;
                    switch (fv) {
                        .range => |r| {
                            if (r.end <= r.start) break :blk null;
                            break :blk bitstream.computeCrc32(enc.bytes.items[r.start..r.end]);
                        },
                        .bytes => |b| break :blk bitstream.computeCrc32(b),
                        else => break :blk null,
                    }
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
                const aligned = if (value == 0xFFFFFFFF) value else value; // sentinel passthrough
                writePatch(enc, off, width, aligned, e);
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

test "parent stack resolves ../field at depth" {
    var ctx = EncodeContext.init(testing.allocator);
    defer ctx.deinit();

    const p0 = try ctx.pushParent();
    try ctx.setParentField(p0, "outer", .{ .u = 100 });
    const p1 = try ctx.pushParent();
    try ctx.setParentField(p1, "inner", .{ .u = 7 });

    try testing.expectEqual(@as(u64, 7), ctx.getParentField(0, "inner").?.asU64().?);
    try testing.expectEqual(@as(u64, 100), ctx.getParentField(1, "outer").?.asU64().?);
    try testing.expect(ctx.getParentField(0, "missing") == null);

    ctx.popParent();
    try testing.expect(ctx.getParentField(0, "inner") == null);
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

test "deferred selector_position patch resolves to first matching offset" {
    var ctx = EncodeContext.init(testing.allocator);
    defer ctx.deinit();
    var enc = BitStreamEncoder.init(testing.allocator, .msb_first);
    defer enc.deinit();

    // Reserve a u16 slot, then encode some content, then record positions.
    const ph = try enc.placeholderU16();
    try enc.writeBytes(&[_]u8{ 0, 0, 0, 0, 0, 0 });
    try ctx.recordPosition("arr", "T", 5);
    try ctx.markArrayDone("arr");

    try ctx.addDeferredPatch(.{ .selector_position = .{
        .local_offset = ph.offset,
        .width = .u16,
        .endianness = .big_endian,
        .array_name = "arr",
        .selector = .first,
        .filter_type = "T",
    } });
    try ctx.resolveDeferredPatches(&enc);

    const out = try enc.finish();
    defer testing.allocator.free(out);
    try testing.expectEqual(@as(u8, 0x00), out[0]);
    try testing.expectEqual(@as(u8, 0x05), out[1]);
}
