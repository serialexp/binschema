/**
 * Tests that codegen-emitted decoders throw `BinSchemaError` with the
 * expected `.code` value. The runtime-level error codes are covered by
 * `tests/runtime/error-codes.test.ts`; this file specifically asserts that
 * generated code (not the runtime) also follows the cross-language code
 * contract.
 *
 * Covers:
 *   - INVALID_VARIANT on an unknown discriminator in a discriminated_union.
 *   - INVALID_UTF8 on a length-prefixed string with invalid UTF-8 bytes.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { generateTypeScript } from "../../generators/typescript.js";
import type { BinarySchema } from "../../schema/binary-schema.js";
import { BinSchemaError, ErrorCode } from "../../runtime/errors.js";

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
    "./errors.js": "../src/runtime/errors.js",
    "./stream-decoder.js": "../src/runtime/stream-decoder.js",
  };
  let out = code;
  for (const [from, to] of Object.entries(map)) {
    const literalFrom = `from "${from}"`;
    const literalTo = `from "${to}"`;
    out = out.split(literalFrom).join(literalTo);
  }
  return out;
}

async function generateAndImport(schema: BinarySchema, name: string): Promise<any> {
  const dir = join(process.cwd(), "tmp");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `codegen-error-${name}.ts`);
  const code = rewriteRuntimeImports(generateTypeScript(schema));
  writeFileSync(file, code);
  return import(pathToFileURL(file).href + `?t=${Date.now()}`);
}

async function testUnknownDiscriminatorPeek(): Promise<void> {
  // Two-arm discriminated union with peek discriminator. Feeding it a byte
  // that matches neither arm must surface as INVALID_VARIANT.
  const schema: BinarySchema = {
    config: { endianness: "big_endian" },
    types: {
      Hello: { sequence: [{ name: "tag", type: "uint8" }] },
      World: { sequence: [{ name: "tag", type: "uint8" }] },
      Wrapper: {
        sequence: [
          {
            name: "payload",
            type: "discriminated_union",
            discriminator: { peek: "uint8" },
            variants: [
              { type: "Hello", when: "value === 0x01" },
              { type: "World", when: "value === 0x02" },
            ],
          } as any,
        ],
      },
    },
  };
  const mod = await generateAndImport(schema, "unknown-disc-peek");
  // 0x99 doesn't match either variant.
  let caught: unknown = null;
  try {
    new mod.WrapperDecoder(new Uint8Array([0x99])).decode();
  } catch (e) {
    caught = e;
  }
  if (!(caught instanceof BinSchemaError)) {
    throw new Error(`expected BinSchemaError, got ${(caught as any)?.constructor?.name}: ${caught}`);
  }
  if (caught.code !== ErrorCode.INVALID_VARIANT) {
    throw new Error(`expected INVALID_VARIANT, got ${caught.code}: ${caught.message}`);
  }
}

async function testInvalidUtf8LengthPrefixed(): Promise<void> {
  // A length-prefixed UTF-8 string with bytes that aren't valid UTF-8 must
  // throw INVALID_UTF8 once the generator emits `{ fatal: true }`.
  const schema: BinarySchema = {
    config: { endianness: "big_endian" },
    types: {
      Note: {
        sequence: [
          {
            name: "text",
            type: "string",
            kind: "length_prefixed",
            length_type: "uint8",
            encoding: "utf8",
          } as any,
        ],
      },
    },
  };
  const mod = await generateAndImport(schema, "invalid-utf8");
  // 0xC3 0x28 is the canonical "invalid UTF-8 continuation byte" sequence.
  const bytes = new Uint8Array([0x02, 0xc3, 0x28]);
  let caught: unknown = null;
  try {
    new mod.NoteDecoder(bytes).decode();
  } catch (e) {
    caught = e;
  }
  if (!(caught instanceof BinSchemaError)) {
    throw new Error(`expected BinSchemaError, got ${(caught as any)?.constructor?.name}: ${caught}`);
  }
  if (caught.code !== ErrorCode.INVALID_UTF8) {
    throw new Error(`expected INVALID_UTF8, got ${caught.code}: ${caught.message}`);
  }
}

export async function runCodegenErrorCodeTests(): Promise<{ passed: number; failed: number; checks: TestCheck[] }> {
  const checks: TestCheck[] = [];
  let passed = 0;
  let failed = 0;
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "Unknown discriminator (peek) throws INVALID_VARIANT", fn: testUnknownDiscriminatorPeek },
    { name: "Invalid UTF-8 in length_prefixed string throws INVALID_UTF8", fn: testInvalidUtf8LengthPrefixed },
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
