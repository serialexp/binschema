/**
 * Codegen-pattern test: calculateSize() folds runs of constant addends.
 *
 * `generateFieldSizeCalculation` emits one `size += <n>;` per fixed-size field.
 * Without folding, an all-fixed struct produced a noisy ladder
 * (`size += 2; size += 4; size += 1; size += 4;`) that is equivalent to a
 * single constant. The fold pass (typescript/size-calculation.ts) merges
 * consecutive constant addends at the same indent into one line, collapsing a
 * fully-fixed struct to a bare `return <n>;` while leaving variable-size
 * fields (strings, arrays, computed lengths) on their own runtime lines and
 * folding the constant runs on either side of them.
 *
 * This guards the output shape; correctness of the *values* is covered by the
 * encode/decode TestSuites (the folded sum must equal the true encoded size).
 */

import { generateTypeScript } from "../../generators/typescript.js";
import type { BinarySchema } from "../../schema/binary-schema.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

/** Extract the body of the first `calculateSize(` method in generated code. */
function extractCalculateSize(code: string): string {
  const lines = code.split("\n");
  const start = lines.findIndex((l) => l.includes("calculateSize("));
  if (start < 0) return "";
  let depth = 0;
  let started = false;
  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    body.push(lines[i]);
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (started && depth === 0) break;
  }
  return body.join("\n");
}

const ALL_FIXED: BinarySchema = {
  config: { endianness: "big_endian" },
  types: {
    SensorReading: {
      sequence: [
        { name: "device_id", type: "uint16" },
        { name: "temperature", type: "float32" },
        { name: "humidity", type: "uint8" },
        { name: "timestamp", type: "uint32" },
      ],
    },
  },
} as any as BinarySchema;

// Constant run, then a variable-length string, then another constant run.
const MIXED: BinarySchema = {
  config: { endianness: "big_endian" },
  types: {
    Frame: {
      sequence: [
        { name: "version", type: "uint8" },
        { name: "kind", type: "uint8" },
        { name: "a", type: "uint16" },
        { name: "label", type: "string", kind: "length_prefixed", length_type: "uint8" },
        { name: "b", type: "uint16" },
        { name: "checksum", type: "uint32" },
      ],
    },
  },
} as any as BinarySchema;

export function runSizeCalcFoldTests(): {
  passed: number;
  failed: number;
  checks: TestCheck[];
} {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];

  const check = (description: string, cond: boolean, message?: string) => {
    if (cond) {
      passed++;
      checks.push({ description, passed: true });
    } else {
      failed++;
      checks.push({ description, passed: false, message });
    }
  };

  // 1. All-fixed struct collapses to a single bare `return <sum>;`.
  {
    const body = extractCalculateSize(generateTypeScript(ALL_FIXED));
    // 2 + 4 + 1 + 4 = 11
    check(
      "all-fixed struct returns the folded constant directly",
      /return 11;/.test(body),
      `expected 'return 11;' in:\n${body}`
    );
    const addendLines = (body.match(/size \+= /g) || []).length;
    check(
      "all-fixed struct emits no `size +=` ladder",
      addendLines === 0,
      `expected 0 'size +=' lines, found ${addendLines}:\n${body}`
    );
    check(
      "folded return keeps per-field provenance comment",
      /return 11; \/\/ device_id \+ temperature \+ humidity \+ timestamp/.test(body),
      `missing provenance comment:\n${body}`
    );
  }

  // 2. Mixed struct folds the constant runs on either side of the variable field.
  {
    const body = extractCalculateSize(generateTypeScript(MIXED));
    // version(1) + kind(1) + a(2) = 4 before the string
    check(
      "leading constant run folds to a single addend",
      /size \+= 4;/.test(body),
      `expected 'size += 4;' in:\n${body}`
    );
    // b(2) + checksum(4) = 6 after the string
    check(
      "trailing constant run folds to a single addend",
      /size \+= 6;/.test(body),
      `expected 'size += 6;' in:\n${body}`
    );
    // The variable string expression must survive unfolded.
    check(
      "variable-length field keeps its runtime expression",
      /size \+= new TextEncoder\(\)\.encode\(value\.label\)\.length;/.test(body),
      `string size expression missing:\n${body}`
    );
    // Exactly two folded constant addends remain (4 and 6), plus the string line.
    const constAddends = (body.match(/size \+= \d+;/g) || []).length;
    check(
      "mixed struct keeps exactly two folded constant addends",
      constAddends === 2,
      `expected 2 constant 'size += N;' lines, found ${constAddends}:\n${body}`
    );
  }

  return { passed, failed, checks };
}
