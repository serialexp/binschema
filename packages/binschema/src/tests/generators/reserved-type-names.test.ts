/**
 * Tests that a schema type whose name collides with a JS/TS global is usable
 * from generated code, not just declarable.
 *
 * `sanitizeTypeName` renames such a type at its *declaration* ("Error" →
 * "Error_", so the class is `Error_Encoder`). Every reference site has to
 * agree, or the emitted code names a class that does not exist and dies at
 * runtime with `ReferenceError: ErrorEncoder is not defined` — which is worse
 * than a compile error, because the declaration looks fine and only the code
 * paths that actually touch that type break.
 *
 * Covers a reference from a plain sequence field and from a discriminated
 * union variant (the shape that hit us: scry's ingest `Frame` union carries an
 * `Error` frame, so the failing path was exactly the one that reports why a
 * server refused a request).
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { generateTypeScript } from "../../generators/typescript.js";
import type { BinarySchema } from "../../schema/binary-schema.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

function rewriteRuntimeImports(code: string): string {
  // tmp/ is a sibling of src/ inside packages/binschema, so the import path
  // from a file in tmp/ to a runtime module is "../src/runtime/...".
  const map: Record<string, string> = {
    "./bit-stream.js": "../src/runtime/bit-stream.js",
    "./seekable-bit-stream.js": "../src/runtime/seekable-bit-stream.js",
    "./binary-reader.js": "../src/runtime/binary-reader.js",
    "./crc32.js": "../src/runtime/crc32.js",
    "./expression-evaluator.js": "../src/runtime/expression-evaluator.js",
    "./expr-helpers.js": "../src/runtime/expr-helpers.js",
    "./errors.js": "../src/runtime/errors.js",
    "./stream-decoder.js": "../src/runtime/stream-decoder.js",
  };
  let out = code;
  for (const [from, to] of Object.entries(map)) {
    out = out.split(`from "${from}"`).join(`from "${to}"`);
  }
  return out;
}

async function generateAndImport(schema: BinarySchema, name: string): Promise<any> {
  const dir = join(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `reserved-type-${name}.ts`);
  writeFileSync(file, rewriteRuntimeImports(generateTypeScript(schema)));
  return import(pathToFileURL(file).href + `?t=${Date.now()}`);
}

/** A type named `Error`, referenced as an ordinary field of another type. */
async function testReservedTypeAsField(): Promise<void> {
  const schema: BinarySchema = {
    config: { endianness: "big_endian" },
    types: {
      Error: {
        sequence: [{ name: "code", type: "uint8" }],
      },
      Envelope: {
        sequence: [
          { name: "tag", type: "uint8" },
          { name: "error", type: "Error" },
        ],
      },
    } as any,
  };
  const mod = await generateAndImport(schema, "field");

  const bytes = new mod.EnvelopeEncoder().encode({ tag: 7, error: { code: 9 } });
  const decoded = new mod.EnvelopeDecoder(bytes).decode();
  if (decoded.tag !== 7 || decoded.error.code !== 9) {
    throw new Error(`round trip lost data: ${JSON.stringify(decoded)}`);
  }
}

/** The scry shape: `Error` as one variant of a discriminated union. */
async function testReservedTypeAsUnionVariant(): Promise<void> {
  const schema: BinarySchema = {
    config: { endianness: "big_endian" },
    types: {
      Ping: {
        sequence: [
          { name: "tag", type: "uint8", const: 1 },
          { name: "nonce", type: "uint8" },
        ],
      },
      Error: {
        sequence: [
          { name: "tag", type: "uint8", const: 2 },
          { name: "code", type: "uint8" },
        ],
      },
      Frame: {
        sequence: [
          {
            name: "msg",
            type: "discriminated_union",
            discriminator: { peek: "uint8" },
            variants: [
              { when: "value === 1", type: "Ping" },
              { when: "value === 2", type: "Error" },
            ],
          } as any,
        ],
      },
    } as any,
  };
  const mod = await generateAndImport(schema, "union");

  // Encoding the *Error* arm is the path that used to throw
  // `ReferenceError: ErrorEncoder is not defined`.
  const bytes = new mod.FrameEncoder().encode({
    msg: { type: "Error", value: { tag: 2, code: 42 } },
  });
  const decoded = new mod.FrameDecoder(bytes).decode();
  if (decoded.msg.type !== "Error" || decoded.msg.value.code !== 42) {
    throw new Error(`round trip lost the Error arm: ${JSON.stringify(decoded)}`);
  }

  // The sibling arm must still work — the fix must not rename anything else.
  const pingBytes = new mod.FrameEncoder().encode({
    msg: { type: "Ping", value: { tag: 1, nonce: 5 } },
  });
  const ping = new mod.FrameDecoder(pingBytes).decode();
  if (ping.msg.type !== "Ping" || ping.msg.value.nonce !== 5) {
    throw new Error(`round trip lost the Ping arm: ${JSON.stringify(ping)}`);
  }
}

/**
 * Whatever name the declaration uses, no reference site may name a class that
 * was never declared. Checked textually so a *new* unsanitized reference site
 * fails here even if no round-trip test happens to exercise it.
 */
async function testNoDanglingCodecReferences(): Promise<void> {
  const schema: BinarySchema = {
    config: { endianness: "big_endian" },
    types: {
      Error: { sequence: [{ name: "code", type: "uint8" }] },
      Map: { sequence: [{ name: "size", type: "uint8" }] },
      Envelope: {
        sequence: [
          { name: "error", type: "Error" },
          { name: "map", type: "Map" },
        ],
      },
    } as any,
  };
  const code = generateTypeScript(schema);

  const declared = new Set<string>();
  for (const m of code.matchAll(/^export class (\w+) /gm)) declared.add(m[1]!);

  const missing = new Set<string>();
  for (const m of code.matchAll(/\bnew (\w+(?:Encoder|Decoder))\b/g)) {
    const name = m[1]!;
    if (!declared.has(name)) missing.add(name);
  }
  if (missing.size > 0) {
    throw new Error(
      `generated code references undeclared codec class(es): ${[...missing].join(", ")}. ` +
        `Declared: ${[...declared].join(", ")}`,
    );
  }
}

/**
 * The same rule for the `…Input`/`…Output` interfaces. These are erased at
 * runtime, so a dangling one does not crash — it just makes the emitted file
 * fail to compile, which stays invisible while consumers vendor the output
 * behind `@ts-nocheck`. Checked here so it cannot rot unnoticed.
 */
async function testNoDanglingValueTypes(): Promise<void> {
  const schema: BinarySchema = {
    config: { endianness: "big_endian" },
    types: {
      Ping: {
        sequence: [
          { name: "tag", type: "uint8", const: 1 },
          { name: "nonce", type: "uint8" },
        ],
      },
      Error: {
        sequence: [
          { name: "tag", type: "uint8", const: 2 },
          { name: "code", type: "uint8" },
        ],
      },
      Frame: {
        sequence: [
          {
            name: "msg",
            type: "discriminated_union",
            discriminator: { peek: "uint8" },
            variants: [
              { when: "value === 1", type: "Ping" },
              { when: "value === 2", type: "Error" },
            ],
          } as any,
        ],
      },
    } as any,
  };
  const code = generateTypeScript(schema);

  const declared = new Set<string>();
  for (const m of code.matchAll(/^export interface (\w+) /gm)) declared.add(m[1]!);

  const missing = new Set<string>();
  for (const m of code.matchAll(/\bvalue: (\w+(?:Input|Output))\b/g)) {
    const name = m[1]!;
    if (!declared.has(name)) missing.add(name);
  }
  if (missing.size > 0) {
    throw new Error(
      `generated code references undeclared value type(s): ${[...missing].join(", ")}. ` +
        `Declared: ${[...declared].join(", ")}`,
    );
  }
}

export async function runReservedTypeNameTests(): Promise<{
  passed: number;
  failed: number;
  checks: TestCheck[];
}> {
  const checks: TestCheck[] = [];
  let passed = 0;
  let failed = 0;
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "Reserved type name (Error) round-trips as a field", fn: testReservedTypeAsField },
    {
      name: "Reserved type name (Error) round-trips as a union variant",
      fn: testReservedTypeAsUnionVariant,
    },
    {
      name: "No reference site names an undeclared codec class",
      fn: testNoDanglingCodecReferences,
    },
    {
      name: "No union member names an undeclared Input/Output type",
      fn: testNoDanglingValueTypes,
    },
  ];
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      checks.push({ description: t.name, passed: true });
    } catch (e) {
      failed++;
      checks.push({ description: t.name, passed: false, message: String(e) });
    }
  }
  return { passed, failed, checks };
}
