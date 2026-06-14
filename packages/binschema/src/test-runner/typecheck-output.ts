/**
 * Strict-tsc gate for generated TypeScript output.
 *
 * Why this exists: nothing previously typechecked the code the TypeScript
 * generator emits, so whole classes of bug shipped silently — node-only globals
 * on the browser path, a `private` field the generator wrote to, computed-field
 * type mismatches, `new <builtin>Encoder()` for primitives, etc. A downstream
 * consumer (lune) was the first to run `tsc --noEmit` over vendored output and
 * filed two reports' worth of breakage.
 *
 * What it does: for every TestSuite with a `.schema`, generate TypeScript, drop
 * it into a temp dir alongside a single copy of the runtime, and run ONE
 * `ts.createProgram` over all of them under a strict, browser-targeted config
 * (no `@types/node`). One Program amortizes lib loading, so ~360 suites check in
 * a few seconds rather than minutes.
 *
 * Ratchet model: most of the corpus does not yet pass strict tsc. Rather than
 * block on fixing all of it at once, we lock the currently-failing suite names
 * into `typecheck-baseline.json` and fail only on:
 *   - a NEW failure (a suite that fails but isn't in the baseline) — a regression
 *   - an UNEXPECTED PASS (a baselined suite that now typechecks) — tighten the
 *     baseline so the win can't silently regress later
 * Run with `--update` to rewrite the baseline after intentionally changing the
 * set of passing suites.
 */

import {
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import ts from "typescript";
import { generateTypeScript } from "../generators/typescript.js";

const here = dirname(fileURLToPath(import.meta.url));
// src/test-runner -> package root
const packageRoot = join(here, "..", "..");
const testsDir = join(packageRoot, "src", "tests");
const runtimeDir = join(packageRoot, "src", "runtime");
const baselinePath = join(packageRoot, "typecheck-baseline.json");

/** Runtime module basenames that generated code imports as `./<name>.js`. */
const RUNTIME_IMPORTS = [
  "bit-stream",
  "seekable-bit-stream",
  "binary-reader",
  "crc32",
  "errors",
  "expression-evaluator",
  "expr-helpers",
  "stream-decoder",
  "codecs",
];

interface SuiteDiag {
  code: number;
  message: string;
}

export interface TypecheckResult {
  /** All suite names that were generated and checked. */
  checked: string[];
  /** Suite names that produced at least one diagnostic. */
  failing: string[];
  /** code -> count across all failing suites. */
  byCode: Map<number, number>;
  /** code -> one sample message. */
  sampleByCode: Map<number, string>;
  /** suite name -> its diagnostics. */
  diagsBySuite: Map<string, SuiteDiag[]>;
}

function findTestFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...findTestFiles(p));
    else if (entry.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

/** Rewrite `from "./<runtime>.js"` to point at the copied `./_runtime/` dir. */
function rewriteRuntimeImports(code: string): string {
  let out = code;
  for (const mod of RUNTIME_IMPORTS) {
    out = out.split(`from "./${mod}.js"`).join(`from "./_runtime/${mod}.js"`);
  }
  return out;
}

/**
 * Generate every suite's TypeScript into `workDir`, copy the runtime once, and
 * batch-typecheck under a strict browser config. Pure: no baseline comparison.
 */
export async function typecheckGeneratedOutput(workDir: string): Promise<TypecheckResult> {
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(join(workDir, "_runtime"), { recursive: true });
  for (const f of readdirSync(runtimeDir)) {
    if (f.endsWith(".ts") || f.endsWith(".js")) {
      copyFileSync(join(runtimeDir, f), join(workDir, "_runtime", f));
    }
  }

  const roots: string[] = [];
  const fileToSuite = new Map<string, string>();
  const seen = new Set<string>();

  for (const tf of findTestFiles(testsDir)) {
    const rel = "./" + relative(here, tf).replace(/\.ts$/, ".js");
    let mod: any;
    try {
      mod = await import(rel);
    } catch {
      continue;
    }
    for (const [key, val] of Object.entries(mod)) {
      if (!key.endsWith("TestSuite") || !val || typeof val !== "object") continue;
      const suite: any = val;
      if (!suite.schema) continue;
      const name = String(suite.name || key);
      if (seen.has(name)) continue;
      seen.add(name);

      let code: string;
      try {
        code = generateTypeScript(suite.schema);
      } catch {
        // Generator throwing is a separate failure mode from a type error; the
        // existing test suites already cover generation, so skip here.
        continue;
      }
      const safe = name.replace(/[^a-zA-Z0-9_]/g, "_");
      const outPath = join(workDir, `${safe}.ts`);
      writeFileSync(outPath, rewriteRuntimeImports(code));
      roots.push(outPath);
      fileToSuite.set(outPath, name);
    }
  }

  const program = ts.createProgram(roots, {
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"],
    types: [], // no @types/node — mirrors a strict browser consumer
    noEmit: true,
    skipLibCheck: true,
  });

  const diagnostics = [
    ...program.getSemanticDiagnostics(),
    ...program.getSyntacticDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ];

  const byCode = new Map<number, number>();
  const sampleByCode = new Map<number, string>();
  const diagsBySuite = new Map<string, SuiteDiag[]>();

  for (const d of diagnostics) {
    if (!d.file) continue;
    const fileName = d.file.fileName;
    if (!fileName.startsWith(workDir)) continue;
    if (fileName.includes("/_runtime/")) continue; // runtime bugs are not codegen bugs
    const suite = fileToSuite.get(fileName);
    if (!suite) continue;

    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    byCode.set(d.code, (byCode.get(d.code) || 0) + 1);
    if (!sampleByCode.has(d.code)) sampleByCode.set(d.code, message.slice(0, 100));
    const list = diagsBySuite.get(suite) || [];
    list.push({ code: d.code, message });
    diagsBySuite.set(suite, list);
  }

  return {
    checked: roots.map((r) => fileToSuite.get(r)!).sort(),
    failing: [...diagsBySuite.keys()].sort(),
    byCode,
    sampleByCode,
    diagsBySuite,
  };
}

interface Baseline {
  /**
   * Suite names known to NOT pass strict browser tsc yet. The gate fails on any
   * failing suite NOT in this list (regression) and on any listed suite that now
   * passes (unexpected win — tighten the baseline). Keep sorted.
   */
  knownFailing: string[];
}

function readBaseline(): Baseline {
  if (!existsSync(baselinePath)) return { knownFailing: [] };
  return JSON.parse(readFileSync(baselinePath, "utf-8"));
}

function writeBaseline(failing: string[]): void {
  const baseline: Baseline = { knownFailing: [...failing].sort() };
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n", "utf-8");
}

async function main(): Promise<void> {
  const update = process.argv.includes("--update");
  const verbose = process.argv.includes("--verbose");
  const workDir = join(packageRoot, "tmp", "typecheck-output");

  const result = await typecheckGeneratedOutput(workDir);
  rmSync(workDir, { recursive: true, force: true });

  if (update) {
    writeBaseline(result.failing);
    console.log(
      `Updated baseline: ${result.failing.length} known-failing suite(s) of ${result.checked.length} checked.`
    );
    return;
  }

  const baseline = readBaseline();
  const known = new Set(baseline.knownFailing);
  const failing = new Set(result.failing);

  const newFailures = result.failing.filter((s) => !known.has(s));
  const unexpectedPasses = baseline.knownFailing.filter((s) => !failing.has(s));

  console.log(
    `Generated-output tsc gate: ${result.checked.length} suites checked, ` +
      `${result.failing.length} failing (${baseline.knownFailing.length} baselined).`
  );

  if (verbose && result.byCode.size > 0) {
    console.log("\nby error code:");
    for (const [code, n] of [...result.byCode.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  TS${code} x${n}  e.g. ${result.sampleByCode.get(code)}`);
    }
  }

  let failed = false;

  if (newFailures.length > 0) {
    failed = true;
    console.error(
      `\n❌ ${newFailures.length} NEW suite(s) fail strict tsc (regression — not in baseline):`
    );
    for (const s of newFailures) {
      const diags = result.diagsBySuite.get(s) || [];
      const codes = [...new Set(diags.map((d) => `TS${d.code}`))].join(", ");
      console.error(`   • ${s} (${codes})`);
      console.error(`     ${diags[0]?.message?.slice(0, 120)}`);
    }
    console.error(
      `\nFix the generated output for these suites, or — if intentional — run ` +
        `\`just test-ts-tsc-update\` to re-baseline.`
    );
  }

  if (unexpectedPasses.length > 0) {
    // Not a hard failure by default would let wins silently rot; make it fail so
    // the baseline is forced tighter the moment a suite starts passing.
    failed = true;
    console.error(
      `\n⚠️  ${unexpectedPasses.length} baselined suite(s) now PASS — tighten the baseline:`
    );
    for (const s of unexpectedPasses) console.error(`   • ${s}`);
    console.error(`\nRun \`just test-ts-tsc-update\` to record these wins.`);
  }

  if (!failed) {
    console.log("✅ No new strict-tsc regressions in generated output.");
  } else {
    process.exit(1);
  }
}

// Run as a script (not when imported by a test).
const isMain = process.argv[1] && process.argv[1].endsWith("typecheck-output.ts");
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
