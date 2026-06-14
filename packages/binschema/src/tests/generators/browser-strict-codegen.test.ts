/**
 * Regression test for the lune report (/tmp/binschema-ts-codegen-report.md):
 * generated TypeScript must typecheck under a strict, browser-targeted project
 * with NO `@types/node` and no `fs` on the core import path.
 *
 * This is the guard that was missing — nothing previously typechecked generated
 * output, so node-only globals (`require`/`fs`/`process`/`Buffer`), a `private`
 * `byteOffset`, and a discriminated-union type that didn't match the runtime
 * `{ type, value }` shape all shipped silently.
 *
 * The test generates a discriminated-union schema (variants are named types, so
 * the decoder instantiates nested sub-decoders and advances the parent offset by
 * the child's consumed bytes — the exact shape that triggered the report),
 * copies the runtime exactly as the CLI does, and runs the TypeScript compiler
 * over the generated entry's import graph with a strict browser config. Zero
 * diagnostics is the contract.
 */

import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import ts from "typescript";
import { generateTypeScript } from "../../generators/typescript.js";
import type { BinarySchema } from "../../schema/binary-schema.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

// A discriminated_union whose variants are themselves named types.
const SCHEMA: BinarySchema = {
  config: { endianness: "big_endian" },
  types: {
    ConstNil: { sequence: [{ name: "tag", type: "uint8", const: 0 }] },
    ConstBool: {
      sequence: [
        { name: "tag", type: "uint8", const: 1 },
        { name: "v", type: "uint8" },
      ],
    },
    ConstInt: {
      sequence: [
        { name: "tag", type: "uint8", const: 2 },
        { name: "v", type: "uint64" },
      ],
    },
    ConstValue: {
      sequence: [
        { name: "tag", type: "uint8" },
        {
          name: "body",
          type: "discriminated_union",
          discriminator: { field: "tag" },
          variants: [
            { type: "ConstNil", when: "value === 0" },
            { type: "ConstBool", when: "value === 1" },
            { type: "ConstInt", when: "value === 2" },
          ],
        },
      ],
    },
  },
} as any as BinarySchema;

// Runtime files the CLI copies next to generated.ts for a non-compression
// schema (kept in sync with src/cli/index.ts).
const RUNTIME_FILES = [
  "bit-stream.ts",
  "seekable-bit-stream.ts",
  "binary-reader.ts",
  "node-file.ts",
  "crc32.ts",
  "errors.ts",
  "expression-evaluator.ts",
  "expr-helpers.ts",
];

function generateProject(): { dir: string; generatedPath: string; code: string } {
  const here = dirname(fileURLToPath(import.meta.url));
  // here = src/tests/generators -> runtime at ../../runtime
  const runtimeDir = join(here, "..", "..", "runtime");
  // tmp/ lives at the package root (process.cwd() when tests run).
  const dir = join(process.cwd(), "tmp", `browser-strict-codegen-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const code = generateTypeScript(SCHEMA);
  const generatedPath = join(dir, "generated.ts");
  writeFileSync(generatedPath, code, "utf-8");

  for (const f of RUNTIME_FILES) {
    copyFileSync(join(runtimeDir, f), join(dir, f));
  }

  return { dir, generatedPath, code };
}

/**
 * Typecheck the generated entry's import graph under a strict, browser-targeted
 * config with no ambient node types. Returns formatted diagnostics for files in
 * `dir` (one string per error), empty when clean.
 */
function typecheckBrowserStrict(dir: string, generatedPath: string): string[] {
  const options: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
    types: [], // <- the crux: no @types/node, mirrors the report's tsconfig
    noEmit: true,
    skipLibCheck: false,
    strictNullChecks: true,
  };

  const program = ts.createProgram([generatedPath], options);
  const diagnostics = [
    ...program.getSemanticDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ];

  const out: string[] = [];
  for (const d of diagnostics) {
    // Only care about the generated project files (not lib.d.ts internals).
    if (d.file && !d.file.fileName.startsWith(dir)) continue;
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (d.file && d.start !== undefined) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      const rel = d.file.fileName.slice(dir.length + 1);
      out.push(`${rel}(${line + 1},${character + 1}): TS${d.code}: ${msg}`);
    } else {
      out.push(`TS${d.code}: ${msg}`);
    }
  }
  return out;
}

function testGeneratedTypechecksBrowserStrict(): void {
  const { dir, generatedPath } = generateProject();
  try {
    const errors = typecheckBrowserStrict(dir, generatedPath);
    if (errors.length > 0) {
      throw new Error(
        `generated output failed strict browser tsc (${errors.length} error(s)):\n` +
          errors.slice(0, 20).join("\n")
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function testDiscriminatedUnionTypeIsWrapped(): void {
  // Even if tsc were unavailable, lock in that the output (and input) type for a
  // discriminated_union field is the tagged `{ type, value }` envelope that the
  // runtime actually produces/consumes — not a bare union of payloads.
  const code = generateTypeScript(SCHEMA);
  const idx = code.indexOf("export interface ConstValueOutput");
  if (idx === -1) throw new Error("ConstValueOutput interface not found in output");
  // Slice to the start of the next top-level `export` so we capture the whole
  // interface body without guessing a char count.
  const nextExport = code.indexOf("\nexport ", idx + 1);
  const slice = code.slice(idx, nextExport === -1 ? code.length : nextExport);
  const expected = "{ type: 'ConstInt'; value: ConstIntOutput }";
  if (!slice.includes(expected)) {
    throw new Error(
      `ConstValueOutput.body is not the wrapped tagged union; expected to find ` +
        `"${expected}". Got:\n${slice.split("\n").slice(0, 8).join("\n")}`
    );
  }
}

export function runBrowserStrictCodegenTests(): {
  passed: number;
  failed: number;
  checks: TestCheck[];
} {
  const checks: TestCheck[] = [];
  let passed = 0;
  let failed = 0;
  const tests: Array<{ name: string; fn: () => void }> = [
    {
      name: "Generated decoder typechecks under strict browser tsconfig (no @types/node)",
      fn: testGeneratedTypechecksBrowserStrict,
    },
    {
      name: "discriminated_union field type is the wrapped { type, value } envelope",
      fn: testDiscriminatedUnionTypeIsWrapped,
    },
  ];
  for (const t of tests) {
    try {
      t.fn();
      passed++;
      checks.push({ description: t.name, passed: true });
    } catch (e) {
      failed++;
      checks.push({ description: t.name, passed: false, message: String(e) });
    }
  }
  return { passed, failed, checks };
}
