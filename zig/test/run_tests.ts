// ABOUTME: Batched Zig cross-language test harness driver (bun/TS).
// ABOUTME: Loads the shared JSON corpus, generates Zig per suite, compiles+runs one batch.
//
// Why TS and not Zig: the generator is TypeScript, and Zig cannot synthesize
// types from JSON at runtime — code must be generated at build time. So, like
// every language harness, this one is written in a language that can both call
// the generator and emit target-language source. It mirrors go/test/compile_batch.go
// and python/test/run_tests.py.
//
// Batching trick (simpler than Go/Rust): each suite's generated code is written
// to its own gen_<i>.zig and imported under a unique alias, so suite type-name
// collisions are impossible WITHOUT the per-type name-prefixing the Go/Rust
// harnesses need (verified: a file-import resolves the root module's `binschema`
// dependency).
//
// Env:
//   ZIG_TEST_FILTER  substring filter on suite name
//   ZIG_TEST_REPORT  "" | summary | failing-tests | json
//   DEBUG_GENERATED  dir to keep generated sources (else tmp-zig is reused/cleaned)
//   DEBUG_CONSTRUCT  log why a test value was not constructible (construct-skip)

import { readdirSync, statSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { generateZig, ZigNotImplemented } from "../../packages/binschema/src/generators/zig/index.js";
import { loadJson5File } from "../../packages/binschema/src/test-runner/json5-load.js";
import { zigTypeName, zigFieldName } from "../../packages/binschema/src/generators/zig/naming.js";
import { unionTypeName } from "../../packages/binschema/src/generators/zig/union.js";
import { instanceFieldShape } from "../../packages/binschema/src/generators/zig/instances.js";
import {
  zigPrimitiveType,
  resolveAlias,
  classifyTypeDef,
  varlengthIsSigned,
} from "../../packages/binschema/src/generators/zig/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const TESTS_DIR = join(REPO_ROOT, "packages", "binschema", ".generated", "tests-json");
const RUNTIME_ROOT = join(REPO_ROOT, "zig", "runtime", "binschema.zig");

const FILTER = process.env.ZIG_TEST_FILTER || "";
const REPORT = process.env.ZIG_TEST_REPORT || "";
const DEBUG_DIR = process.env.DEBUG_GENERATED || "";
const BUILD_DIR = DEBUG_DIR
  ? resolve(REPO_ROOT, "zig", DEBUG_DIR)
  : join(__dirname, "tmp-zig");

// ---------------------------------------------------------------------------
// Corpus loading
// ---------------------------------------------------------------------------

function collectJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...collectJsonFiles(p));
    else if (entry.endsWith(".test.json")) out.push(p);
  }
  return out;
}

interface TestCase {
  description?: string;
  value?: any;
  decoded_value?: any;
  bytes?: number[];
  bits?: number[];
  error?: any;
  should_error_on_encode?: boolean;
  round_trip_only?: boolean;
}

interface Suite {
  name: string;
  schema: any;
  test_type: string;
  test_cases: TestCase[];
  /** The schema is intentionally invalid; this is a TS-validator test, not a
   *  codegen target. The Zig generator is not expected to produce code for it. */
  schemaValidationError?: boolean;
}

function bitsToBytes(bits: number[], bitOrder: string): number[] {
  const numBytes = Math.ceil(bits.length / 8);
  const bytes = new Array(numBytes).fill(0);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = bitOrder === "lsb_first" ? i % 8 : 7 - (i % 8);
      bytes[byteIdx] |= 1 << bitIdx;
    }
  }
  return bytes;
}

function loadSuite(path: string): Suite | null {
  const raw = loadJson5File<any>(path);
  const name: string = raw.name ?? path;
  const cases: TestCase[] = raw.test_cases ?? raw.tests ?? [];
  const bitOrder = raw.schema?.config?.bit_order ?? "msb_first";
  for (const tc of cases) {
    if ((!tc.bytes || tc.bytes.length === 0) && tc.bits && tc.bits.length > 0) {
      tc.bytes = bitsToBytes(tc.bits, bitOrder);
    }
  }
  if (!raw.test_type || !raw.schema) return null;
  return {
    name,
    schema: raw.schema,
    test_type: raw.test_type,
    test_cases: cases,
    schemaValidationError: raw.schema_validation_error === true,
  };
}

// ---------------------------------------------------------------------------
// Value construction: JSON value -> Zig literal expression
// ---------------------------------------------------------------------------

class UnsupportedValue extends Error {}

function stripBigInt(s: string): string {
  return s.endsWith("n") ? s.slice(0, -1) : s;
}

function intLiteral(v: any): string {
  if (typeof v === "string") return stripBigInt(v);
  if (typeof v === "number" && Number.isInteger(v)) return String(v);
  throw new UnsupportedValue(`int literal from ${JSON.stringify(v)}`);
}

function floatLiteral(v: any, zigType: string): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    // Ensure a decimal point so Zig parses it as a float literal.
    return Number.isInteger(v) ? `${v}.0` : String(v);
  }
  // Non-finite IEEE-754 values come through JSON5 as JS Infinity / -Infinity / NaN.
  if (v === Infinity) return `std.math.inf(${zigType})`;
  if (v === -Infinity) return `-std.math.inf(${zigType})`;
  if (typeof v === "number" && Number.isNaN(v)) return `std.math.nan(${zigType})`;
  throw new UnsupportedValue(`float literal from ${JSON.stringify(v)}`);
}

/** Escape a JS string as a Zig string literal body. */
function zigStrLit(s: string): string {
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (c === 0x0a) out += "\\n";
    else if (c === 0x0d) out += "\\r";
    else if (c === 0x09) out += "\\t";
    else if (c < 0x20 || c === 0x7f) out += `\\x${c.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return out + '"';
}

/** The Zig value-literal type for a field, prefixing struct types with `alias.`. */
function zigValueType(field: any, schema: any, alias: string): string {
  const prim = zigPrimitiveType(field);
  if (prim !== null) return prim;
  switch (field.type) {
    case "string": case "bytes": return "[]const u8";
    case "array": return `[]const ${zigValueType(itemField(field.items), schema, alias)}`;
    case "bitfield": return bitfieldType(field);
    case "optional": return `?${zigValueType(optionalInner(field), schema, alias)}`;
    case "varlength": return varlengthIsSigned(field) ? "i64" : "u64";
    case "choice": case "discriminated_union": return `${alias}.${unionTypeName(field)}`;
    case "compressed": return zigValueType(compressedInner(field), schema, alias);
  }
  const resolved = resolveAlias(schema, field.type);
  const cls = classifyTypeDef(resolved);
  switch (cls) {
    case "struct": return `${alias}.${zigTypeName(field.type)}`;
    case "string": case "bytes": return "[]const u8";
    case "array": return `[]const ${zigValueType(itemField(resolved.items), schema, alias)}`;
    case "enum": return enumReprType(resolved);
    case "choice": case "discriminated_union": return `${alias}.${unionTypeName(resolved)}`;
    default: throw new UnsupportedValue(`value type for '${field.type}'`);
  }
}

/** The Zig repr-integer type for a resolved enum typeDef (value boundary type). */
function enumReprType(typeDef: any): string {
  switch (typeDef?.repr) {
    case "uint8": return "u8";
    case "uint16": return "u16";
    case "uint32": return "u32";
    default: throw new UnsupportedValue(`enum repr '${typeDef?.repr}'`);
  }
}

function itemField(items: any): any {
  if (items == null) throw new UnsupportedValue("array without items");
  return typeof items === "string" ? { type: items } : items;
}

/** The inner value field of a compressed region (`value_type` as a field object). */
function compressedInner(field: any): any {
  const vt = field.value_type;
  return typeof vt === "string" ? { type: vt } : { ...vt };
}

/** The inner value field of an optional (`value_type` as a field object). */
function optionalInner(field: any): any {
  if (field.presence_type && field.presence_type !== "uint8") {
    throw new UnsupportedValue(`optional presence '${field.presence_type}'`);
  }
  const vt = field.value_type;
  return typeof vt === "string" ? { type: vt } : { ...vt };
}

/** Emit a Zig expression constructing the value for a field of the given shape. */
function valueExpr(field: any, value: any, schema: any, alias: string): string {
  const prim = zigPrimitiveType(field);
  if (prim !== null) {
    switch (field.type) {
      case "float32": return floatLiteral(value, "f32");
      case "float64": return floatLiteral(value, "f64");
      case "bool": return value ? "true" : "false";
      default: return intLiteral(value);
    }
  }

  // Inline string/bytes/array shapes.
  if (field.type === "string") return stringValue(value);
  if (field.type === "bytes") return bytesValue(value);
  if (field.type === "array") return arrayValue(field.items, value, schema, alias);
  if (field.type === "bitfield") return bitfieldValue(field, value);
  // varlength: a plain integer (signed for zigzag/SLEB128, else unsigned). The
  // literal coerces to the declared i64/u64 field type.
  if (field.type === "varlength") return intLiteral(value);
  if (field.type === "optional") {
    if (value == null) return "null";
    return valueExpr(optionalInner(field), value, schema, alias);
  }
  if (field.type === "choice") return choiceValue(field, value, schema, alias);
  if (field.type === "discriminated_union") return duValue(field, value, schema, alias);
  // A compressed region's value is the inner type on both sides (the framing is
  // consumed, never in the value), so construct the inner value directly.
  if (field.type === "compressed") return valueExpr(compressedInner(field), value, schema, alias);

  // Type reference.
  const resolved = resolveAlias(schema, field.type);
  // Bare alias to a primitive (e.g. `Uint8 -> uint8`): build the primitive value.
  if (zigPrimitiveType(resolved) !== null) return valueExpr(resolved, value, schema, alias);
  const cls = classifyTypeDef(resolved);
  switch (cls) {
    case "string": return stringValue(value);
    case "bytes": return bytesValue(value);
    case "array": return arrayValue(resolved.items, value, schema, alias);
    case "struct": return structValue(field.type, resolved, value, schema, alias);
    case "enum": return intLiteral(value);
    case "choice": return choiceValue(resolved, value, schema, alias);
    case "discriminated_union": return duValue(resolved, value, schema, alias);
    default: throw new UnsupportedValue(`value for type '${field.type}'`);
  }
}

/** Anonymous tagged-union literal for a `choice` value: `.{ .Variant = payload }`.
 *  Choice values are flat (the variant struct's fields spread next to `type`). */
function choiceValue(field: any, value: any, schema: any, alias: string): string {
  if (value == null || typeof value !== "object" || !value.type) {
    throw new UnsupportedValue(`choice value ${JSON.stringify(value)}`);
  }
  const variantType = value.type;
  const def = resolveAlias(schema, variantType);
  if (!def || !def.sequence) throw new UnsupportedValue(`choice variant '${variantType}' not a struct`);
  const payload = structValue(variantType, def, value, schema, alias);
  return `.{ .${zigTypeName(variantType)} = ${payload} }`;
}

/** Anonymous tagged-union literal for a discriminated_union value:
 *  `.{ .Variant = payload }` where payload is built from `value.value`. */
function duValue(field: any, value: any, schema: any, alias: string): string {
  if (value == null || typeof value !== "object" || !value.type) {
    throw new UnsupportedValue(`discriminated_union value ${JSON.stringify(value)}`);
  }
  const variantType = value.type;
  const def = resolveAlias(schema, variantType);
  if (def && def.sequence) {
    const payload = structValue(variantType, def, value.value ?? {}, schema, alias);
    return `.{ .${zigTypeName(variantType)} = ${payload} }`;
  }
  // Non-struct variant (DNS compression): a string/bytes label, or a
  // back_reference pointer whose logical payload is its target label's text.
  const cls = classifyTypeDef(def);
  let payload: string;
  if (cls === "string" || cls === "back_reference") payload = stringValue(value.value);
  else if (cls === "bytes") payload = bytesValue(value.value);
  else throw new UnsupportedValue(`DU variant '${variantType}' not a struct/string/back_reference`);
  return `.{ .${zigTypeName(variantType)} = ${payload} }`;
}

/** Anonymous Zig struct type for a bitfield field (one uN per sub-field). */
function bitfieldType(field: any): string {
  const parts = (field.fields || []).map((f: any) => `${zigFieldName(f.name)}: u${f.size || 1}`);
  return `struct { ${parts.join(", ")} }`;
}

/** Anonymous Zig struct literal for a bitfield value (coerces to the field type). */
function bitfieldValue(field: any, value: any): string {
  if (value == null || typeof value !== "object") throw new UnsupportedValue(`bitfield value ${JSON.stringify(value)}`);
  const parts = (field.fields || []).map(
    (f: any) => `.${zigFieldName(f.name)} = ${intLiteral(value[f.name])}`,
  );
  return parts.length === 0 ? ".{}" : `.{ ${parts.join(", ")} }`;
}

function stringValue(value: any): string {
  if (typeof value !== "string") throw new UnsupportedValue(`string value ${JSON.stringify(value)}`);
  return zigStrLit(value);
}

function bytesValue(value: any): string {
  if (!Array.isArray(value)) throw new UnsupportedValue(`bytes value ${JSON.stringify(value)}`);
  if (value.length === 0) return "&[_]u8{}";
  return `&[_]u8{ ${value.map((b) => String(Number(b) & 0xff)).join(", ")} }`;
}

function arrayValue(items: any, value: any, schema: any, alias: string): string {
  if (!Array.isArray(value)) throw new UnsupportedValue(`array value ${JSON.stringify(value)}`);
  const itf = itemField(items);
  const elemType = zigValueType(itf, schema, alias);
  if (value.length === 0) return `&[_]${elemType}{}`;
  const parts = value.map((v) => valueExpr(itf, v, schema, alias));
  return `&[_]${elemType}{ ${parts.join(", ")} }`;
}

function structValue(typeName: string, typeDef: any, value: any, schema: any, alias: string): string {
  if (!typeDef || !typeDef.sequence) throw new UnsupportedValue("non-struct value");
  const parts: string[] = [];
  for (const field of typeDef.sequence) {
    // Computed/const fields are omitted from the encode input.
    if (field.computed || field.const !== undefined) continue;
    // Padding is a pure wire spacer — not a struct member, not in the value.
    if (field.type === "padding") continue;
    const fv = value?.[field.name];
    // A conditional field is stored as `?T`; when the test value omits it the
    // field is absent (null), otherwise the bare value coerces to the optional.
    if (field.conditional && (fv === undefined || fv === null)) {
      parts.push(`.${zigFieldName(field.name)} = null`);
      continue;
    }
    parts.push(`.${zigFieldName(field.name)} = ${valueExpr(field, fv, schema, alias)}`);
  }
  // Instance (random-access) members: present in the decoded value (read from
  // their absolute offsets), so include them when constructing the expected
  // decoded literal. Built from the same field-shape the generator uses.
  for (const inst of (typeDef.instances || [])) {
    const fv = value?.[inst.name];
    parts.push(`.${zigFieldName(inst.name)} = ${valueExpr(instanceFieldShape(inst), fv, schema, alias)}`);
  }
  const tn = `${alias}.${zigTypeName(typeName)}`;
  return parts.length === 0 ? `${tn}{}` : `${tn}{ ${parts.join(", ")} }`;
}

/** Top-level struct value for a suite's test_type. */
function structValueExpr(alias: string, suite: Suite, value: any): string {
  return structValue(suite.test_type, suite.schema.types[suite.test_type], value, suite.schema, alias);
}

function zigStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function byteArrayLiteral(bytes: number[]): string {
  if (!bytes || bytes.length === 0) return "[_]u8{}";
  return `[_]u8{ ${bytes.map((b) => String(b & 0xff)).join(", ")} }`;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface SuiteResult {
  name: string;
  status: "ok" | "codegen_skip" | "error" | "validation";
  reason?: string;
  cases: number;
  emittedCases: number;
  /** Cases skipped because the harness couldn't build the Zig value (not error cases). */
  constructSkips?: number;
}

function main() {
  const files = collectJsonFiles(TESTS_DIR).sort();
  const suites: Suite[] = [];
  for (const f of files) {
    const s = loadSuite(f);
    if (!s) continue;
    if (FILTER && !s.name.toLowerCase().includes(FILTER.toLowerCase())) continue;
    suites.push(s);
  }

  if (existsSync(BUILD_DIR)) rmSync(BUILD_DIR, { recursive: true, force: true });
  mkdirSync(BUILD_DIR, { recursive: true });

  const results: SuiteResult[] = [];
  const rootLines: string[] = [];
  rootLines.push(`const std = @import("std");`);
  const imports: string[] = [];
  const testBlocks: string[] = [];

  let suiteIdx = 0;
  for (const suite of suites) {
    // Suites whose schema is intentionally invalid are TS-validator tests, not
    // codegen targets — the Zig generator legitimately may refuse them. Don't
    // attempt generation or count them as a feature gap.
    if (suite.schemaValidationError) {
      results.push({ name: suite.name, status: "validation", cases: suite.test_cases.length, emittedCases: 0 });
      continue;
    }
    let code: string;
    try {
      code = generateZig(suite.schema, suite.test_type).code;
    } catch (e: any) {
      if (e instanceof ZigNotImplemented) {
        results.push({ name: suite.name, status: "codegen_skip", reason: e.message, cases: suite.test_cases.length, emittedCases: 0 });
      } else {
        results.push({ name: suite.name, status: "error", reason: e?.message ?? String(e), cases: suite.test_cases.length, emittedCases: 0 });
      }
      continue;
    }

    const alias = `s${suiteIdx}`;
    const genFile = `gen_${suiteIdx}.zig`;
    writeFileSync(join(BUILD_DIR, genFile), code);
    imports.push(`const ${alias} = @import("${genFile}");`);

    // Is the test_type a struct (has its own Zig type + methods) or a top-level
    // string/bytes/array alias (encoded via free encode<Name>/decode<Name>)?
    const ttDef = suite.schema.types[suite.test_type];
    const ttIsStruct = ttDef != null && "sequence" in ttDef;
    // A type with `instances` (random-access fields) is decode-only: the encoder
    // writes just the sequence, never the position-referenced instance payloads,
    // so encode(value) would be shorter than the full wire bytes. Verify decode
    // against the expected value by deep equality instead of round-tripping bytes.
    const ttHasInstances = ttIsStruct && Array.isArray((ttDef as any).instances) && (ttDef as any).instances.length > 0;
    const tn = zigTypeName(suite.test_type);

    let emitted = 0;
    let constructSkips = 0;
    for (let ci = 0; ci < suite.test_cases.length; ci++) {
      const tc = suite.test_cases[ci];
      // Error-expecting cases are exercised in a later phase.
      if (tc.error || tc.should_error_on_encode) continue;

      // Instance suites: decode the full bytes and deep-compare to the expected
      // value (sequence fields + instance fields), no encode/re-encode.
      if (ttHasInstances) {
        let expectedExpr: string;
        try {
          expectedExpr = structValueExpr(alias, suite, tc.decoded_value ?? tc.value);
        } catch (e:any) {
          if (process.env.DEBUG_CONSTRUCT) console.error(`CONSTRUCT-SKIP(inst) ${suite.name}#${ci}: ${e?.message}\n${e?.stack?.split("\n").slice(1,5).join("\n")}`);
          constructSkips++;
          continue;
        }
        const expected = tc.bytes ?? [];
        const testName = `${suite.name}__${ci}: ${zigStr(tc.description ?? "")}`;
        const block: string[] = [];
        block.push(`test "${zigStr(testName)}" {`);
        block.push(`    const a = std.testing.allocator;`);
        block.push(`    const bytes = ${byteArrayLiteral(expected)};`);
        block.push(`    var arena = std.heap.ArenaAllocator.init(a);`);
        block.push(`    defer arena.deinit();`);
        block.push(`    const decoded = try ${alias}.${tn}.decode(arena.allocator(), &bytes);`);
        block.push(`    const expected = ${expectedExpr};`);
        block.push(`    try std.testing.expectEqualDeep(expected, decoded);`);
        block.push(`}`);
        testBlocks.push(block.join("\n"));
        emitted++;
        continue;
      }

      let valueExprStr: string;
      let encodeCall: string;
      let decodeCall: string;
      let reencodeCall: string;
      try {
        if (ttIsStruct) {
          valueExprStr = structValueExpr(alias, suite, tc.value);
          encodeCall = `v.encode(a)`;
          decodeCall = `${alias}.${tn}.decode(arena.allocator(), bytes)`;
          reencodeCall = `decoded.encode(a)`;
        } else {
          valueExprStr = valueExpr({ type: suite.test_type }, tc.value, suite.schema, alias);
          encodeCall = `${alias}.encode${tn}(v, a)`;
          decodeCall = `${alias}.decode${tn}(arena.allocator(), bytes)`;
          reencodeCall = `${alias}.encode${tn}(decoded, a)`;
        }
      } catch (e:any) {
        if (process.env.DEBUG_CONSTRUCT) console.error(`CONSTRUCT-SKIP ${suite.name}#${ci}: ${e?.message}\n${e?.stack?.split("\n").slice(1,4).join("\n")}`);
        constructSkips++;
        continue; // value shape not yet constructible by the harness
      }
      const expected = tc.bytes ?? [];
      const testName = `${suite.name}__${ci}: ${zigStr(tc.description ?? "")}`;
      const block: string[] = [];
      block.push(`test "${zigStr(testName)}" {`);
      block.push(`    const a = std.testing.allocator;`);
      block.push(`    const v = ${valueExprStr};`);
      block.push(`    const bytes = try ${encodeCall};`);
      block.push(`    defer a.free(bytes);`);
      if (tc.round_trip_only) {
        // No byte pinning (output not stable across impls, e.g. real deflate):
        // assert encode -> decode -> re-encode reproduces the first encoding.
        block.push(`    var arena = std.heap.ArenaAllocator.init(a);`);
        block.push(`    defer arena.deinit();`);
        block.push(`    const decoded = try ${decodeCall};`);
        block.push(`    const rebytes = try ${reencodeCall};`);
        block.push(`    defer a.free(rebytes);`);
        block.push(`    try std.testing.expectEqualSlices(u8, bytes, rebytes);`);
      } else {
        block.push(`    const expected = ${byteArrayLiteral(expected)};`);
        block.push(`    try std.testing.expectEqualSlices(u8, &expected, bytes);`);
        // Arena owns any slices the decoder allocates (arrays); freed wholesale.
        block.push(`    var arena = std.heap.ArenaAllocator.init(a);`);
        block.push(`    defer arena.deinit();`);
        block.push(`    const decoded = try ${decodeCall};`);
        block.push(`    const rebytes = try ${reencodeCall};`);
        block.push(`    defer a.free(rebytes);`);
        block.push(`    try std.testing.expectEqualSlices(u8, &expected, rebytes);`);
      }
      block.push(`}`);
      testBlocks.push(block.join("\n"));
      emitted++;
    }

    results.push({ name: suite.name, status: "ok", cases: suite.test_cases.length, emittedCases: emitted, constructSkips });
    suiteIdx++;
  }

  rootLines.push(...imports, "", ...testBlocks, "");
  writeFileSync(join(BUILD_DIR, "root.zig"), rootLines.join("\n"));

  // Compile + run the batch.
  const args = [
    "test",
    "--dep", "binschema",
    `-Mroot=${join(BUILD_DIR, "root.zig")}`,
    `-Mbinschema=${RUNTIME_ROOT}`,
  ];
  const run = spawnSync("zig", args, { encoding: "utf-8" });
  const output = (run.stdout ?? "") + (run.stderr ?? "");

  report(results, output, run.status ?? -1);

  if (!DEBUG_DIR) {
    // keep tmp-zig for inspection only when something failed
    if ((run.status ?? -1) === 0) rmSync(BUILD_DIR, { recursive: true, force: true });
  }

  process.exit((run.status ?? -1) === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Parse zig test output. Passing tests print `N/M <name>...OK`. A FAILING test
 * does NOT print `...FAIL` on that line — instead zig prints the assertion diff
 * plus a stack trace whose test frame reads `in test.<name> (root.zig)`, and a
 * final `X passed; Y skipped; Z failed.` summary line.
 */
function parseZigOutput(output: string): { passed: number; failed: number; failNames: string[]; compiled: boolean } {
  let passed = (output.match(/\.\.\.OK\s*$/gm) || []).length;
  let failed = 0;
  const summary = output.match(/(\d+)\s+passed;\s+(\d+)\s+skipped;\s+(\d+)\s+failed/);
  if (summary) {
    passed = parseInt(summary[1], 10);
    failed = parseInt(summary[3], 10);
  }
  const failNames = Array.from(
    new Set(Array.from(output.matchAll(/ in test\.(.+?) \(root\.zig\)/g)).map((m) => m[1])),
  );
  // If zig never produced a summary AND emitted a compile error, treat as compile failure.
  const compiled = summary !== null || /\.\.\.OK\s*$/m.test(output);
  return { passed, failed, failNames, compiled };
}

function report(results: SuiteResult[], output: string, exitCode: number) {
  const ok = results.filter((r) => r.status === "ok");
  const skipped = results.filter((r) => r.status === "codegen_skip");
  const errored = results.filter((r) => r.status === "error");
  const validation = results.filter((r) => r.status === "validation");
  // Validation-only suites are not codegen targets; exclude them from the
  // generated/skip denominator so the numbers reflect real feature coverage.
  const codegenTotal = results.length - validation.length;
  const emittedCases = ok.reduce((n, r) => n + r.emittedCases, 0);
  const { passed, failed, failNames, compiled } = parseZigOutput(output);

  if (REPORT === "json") {
    console.log(JSON.stringify({
      suites: { total: results.length, codegenTotal, ok: ok.length, codegen_skip: skipped.length, error: errored.length, validation: validation.length },
      cases: { emitted: emittedCases, passed, failed },
      compiled,
      exitCode,
      failures: failNames,
    }, null, 2));
    return;
  }

  const validationNote = validation.length > 0 ? ` (+${validation.length} validation-only, not codegen targets)` : "";
  console.log(`\nZig harness: ${codegenTotal} codegen suites — ${ok.length} generated, ${skipped.length} codegen-skipped, ${errored.length} errored${validationNote}`);
  console.log(`Test cases: ${emittedCases} emitted, ${passed} passed, ${failed} failed (zig exit ${exitCode})`);

  if (REPORT === "coverage") {
    // Suites that generated but emitted fewer cases than they have (excluding
    // error-expecting cases) — a value-construction gap worth surfacing.
    console.log(`\n--- Partially-emitted generated suites ---`);
    let any = false;
    for (const r of ok) {
      if ((r.constructSkips ?? 0) > 0) {
        any = true;
        console.log(`  ${r.name}: ${r.constructSkips} case(s) not constructible (${r.emittedCases} emitted)`);
      }
    }
    if (!any) console.log(`  (none)`);
    return;
  }

  if (REPORT === "skips") {
    // Bucket codegen-skipped suites by their ZigNotImplemented reason so the
    // remaining feature gaps are visible at a glance during phased work.
    const buckets = new Map<string, string[]>();
    for (const r of skipped) {
      const m = /Zig generator: (.*?) not implemented/.exec(r.reason ?? "");
      const key = (m ? m[1] : (r.reason ?? "")).replace(/'[^']*'/g, "'X'");
      (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(r.name);
    }
    console.log(`\n--- Codegen-skipped suites by reason (${skipped.length} total) ---`);
    for (const [key, names] of [...buckets.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  [${names.length}] ${key}`);
      for (const n of names.slice(0, 4)) console.log(`        ${n}`);
      if (names.length > 4) console.log(`        … +${names.length - 4} more`);
    }
    return;
  }

  if (REPORT === "summary") return;

  if (!compiled && exitCode !== 0) {
    console.log(`\n--- Batch failed to compile — raw zig output tail ---`);
    console.log(output.split("\n").slice(-50).join("\n"));
  } else if (failNames.length > 0) {
    console.log(`\n--- Failing tests ---`);
    for (const n of failNames) console.log(`  FAIL ${n}`);
  }

  if (REPORT === "failing-tests") return;

  if (errored.length > 0) {
    console.log(`\n--- Codegen errors (non-NotImplemented) ---`);
    for (const e of errored) console.log(`  ${e.name}: ${e.reason}`);
  }
}

main();
