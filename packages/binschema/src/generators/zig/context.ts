// ABOUTME: Canonical threaded encode/decode signatures + call-args for Zig codegen.
// ABOUTME: Centralizes ctx/root threading so EVERY emitter passes context from day one.
//
// Why this module exists: every prior BinSchema generator (Go, Rust, Python) was
// first written single-pass and had to be rewritten when a real protocol needed
// a forward reference. The fix is to thread one `*EncodeContext` (encode) and a
// decode root pointer through every generated function from the very first
// commit — even while Phase 1 features don't read from them yet. By funnelling
// all signature/argument strings through here, adding a new emitter cannot
// "forget" to thread context: there is no un-threaded signature to copy.

/** Runtime import alias used by all generated Zig. */
export const RT = "binschema";

/** Names of the threaded parameters, kept in one place. */
export const ENC = "enc"; // *BitStreamEncoder
export const CTX = "ctx"; // *EncodeContext
export const DEC = "dec"; // *BitStreamDecoder
export const ROOT = "root"; // the effective root pointer used inside a decode body
export const PARENT_ROOT = "root_in"; // the inherited root param (null at the entry)
export const ALLOC = "allocator"; // std.mem.Allocator threaded into decode (owned slices)

/** Parameter list for an `encodeInto`-style method (no leading self). */
export function encodeParams(): string {
  return `${ENC}: *${RT}.BitStreamEncoder, ${CTX}: *${RT}.EncodeContext`;
}

/** Argument list to forward when calling an `encodeInto`-style method. */
export function encodeArgs(): string {
  return `${ENC}, ${CTX}`;
}

/**
 * Parameter list for a `decodeWith`-style function. When the schema uses
 * `_root.…` decode references, the inherited root arrives as `root_in`
 * (`?*const anyopaque`) and the body rebinds it to a `root` local (seeding self
 * at the entry); otherwise the lean signature names the param `root` directly.
 */
export function decodeParams(usesRoot = false): string {
  const rootParam = usesRoot
    ? `${PARENT_ROOT}: ?*const anyopaque`
    : `${ROOT}: ?*anyopaque`;
  return `${ALLOC}: std.mem.Allocator, ${DEC}: *${RT}.BitStreamDecoder, ${rootParam}`;
}

/** Argument list to forward when calling a `decodeWith`-style function. */
export function decodeArgs(): string {
  return `${ALLOC}, ${DEC}, ${ROOT}`;
}

/** Standard error/return type used everywhere. */
export const ERR = `${RT}.Error`;

/**
 * Emit a `_ = name;` discard for a threaded param a stub doesn't yet use, so the
 * generated Zig compiles cleanly without "unused parameter" errors. Phase 1
 * leans on this; later phases replace the discards with real uses.
 */
export function discard(name: string): string {
  return `    _ = ${name};`;
}
