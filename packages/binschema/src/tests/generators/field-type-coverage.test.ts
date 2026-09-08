/**
 * Every built-in field type, through every generator.
 *
 * # The bug this exists to prevent
 *
 * A field's `type` is either a built-in keyword or a reference to a
 * user-defined type, and the string alone does not say which. Each generator
 * used to dispatch on it with a `switch` whose `default:` meant both "user
 * type — build an identifier from this" and "keyword I have no case for". The
 * second meaning is silent, so when `optional` was added and the TypeScript
 * size calculator did not grow a case for it, the generator happily emitted
 *
 *     const parent_span_id_encoder = new optionalEncoder();
 *
 * naming a class that could not exist. It typechecked, it read plausibly, and
 * it only failed at runtime on the code paths that called `calculateSize`.
 * Five keywords were affected: `bool`, `bit`, `optional`, `bitfield`, `choice`.
 *
 * `isBuiltinFieldType` now peels type references off before each switch, and
 * `assertNever` makes the switches exhaustive, so a new entry in
 * `BUILTIN_FIELD_TYPES` fails to compile until every generator handles it.
 * This test is the belt to that braces: it runs each keyword through all five
 * generators and checks the *output*, catching anything the type system cannot
 * see — a keyword misrouted at runtime, or a generator that emits an
 * identifier built out of a keyword.
 *
 * A generator refusing a keyword is fine and expected (not every language
 * implements every type). What is not fine is refusing *silently*, or refusing
 * with an error that does not say which type it choked on.
 */

import { generateTypeScript } from "../../generators/typescript.js";
import { generateGo } from "../../generators/go.js";
import { generateRust } from "../../generators/rust.js";
import { generatePython } from "../../generators/python.js";
import { generateZig } from "../../generators/zig/index.js";
import { BUILTIN_FIELD_TYPES, type BuiltinFieldType } from "../../schema/field-types.js";
import type { BinarySchema } from "../../schema/binary-schema.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

/**
 * A minimal valid field definition for each built-in keyword.
 *
 * Keyed by the keyword so the list below is checked for completeness against
 * `BUILTIN_FIELD_TYPES` — adding a field type without adding a sample here is
 * itself a test failure, otherwise this suite would quietly stop covering it.
 */
const SAMPLE_FIELDS: Record<BuiltinFieldType, Record<string, unknown>> = {
  bit: { type: "bit", size: 4 },
  int: { type: "int", size: 12 },
  bool: { type: "bool" },
  uint8: { type: "uint8" },
  uint16: { type: "uint16" },
  uint32: { type: "uint32" },
  uint64: { type: "uint64" },
  int8: { type: "int8" },
  int16: { type: "int16" },
  int32: { type: "int32" },
  int64: { type: "int64" },
  varlength: { type: "varlength", encoding: "vlq" },
  float32: { type: "float32" },
  float64: { type: "float64" },
  string: { type: "string", encoding: "utf8", kind: "length_prefixed", length_type: "uint16" },
  array: { type: "array", kind: "length_prefixed", length_type: "uint16", items: { type: "uint8" } },
  bytes: { type: "bytes", kind: "fixed", length: 4 },
  optional: { type: "optional", value_type: "uint32" },
  bitfield: {
    type: "bitfield",
    size: 8,
    fields: [
      { name: "lo", offset: 0, size: 4 },
      { name: "hi", offset: 4, size: 4 },
    ],
  },
  discriminated_union: {
    type: "discriminated_union",
    discriminator: { peek: "uint8" },
    variants: [
      { when: "value === 1", type: "VariantA" },
      { when: "value === 2", type: "VariantB" },
    ],
  },
  choice: {
    type: "choice",
    choices: [{ type: "VariantA" }, { type: "VariantB" }],
  },
  back_reference: {
    type: "back_reference",
    storage: "uint16",
    offset_mask: "0x3FFF",
    offset_from: "message_start",
    target_type: "VariantA",
  },
  padding: { type: "padding", align_to: 4 },
  compressed: { type: "compressed", value_type: "VariantA", algorithm: "deflate", size_type: "uint16" },
};

/** A schema containing one field of the given keyword, plus types it references. */
function schemaFor(field: Record<string, unknown>): BinarySchema {
  return {
    config: { endianness: "big_endian" },
    types: {
      VariantA: {
        sequence: [
          { name: "tag", type: "uint8", const: 1 },
          { name: "a", type: "uint8" },
        ],
      },
      VariantB: {
        sequence: [
          { name: "tag", type: "uint8", const: 2 },
          { name: "b", type: "uint8" },
        ],
      },
      Outer: {
        sequence: [
          { name: "lead", type: "uint8" },
          { name: "subject", ...field },
          { name: "trail", type: "uint8" },
        ],
      },
    },
  } as unknown as BinarySchema;
}

type Generator = (schema: BinarySchema) => string;

/** Flatten a generator's result (string, or a record of file → source). */
function asText(out: unknown): string {
  if (typeof out === "string") return out;
  if (out && typeof out === "object") {
    return Object.values(out as Record<string, unknown>)
      .filter((v): v is string => typeof v === "string")
      .join("\n");
  }
  return String(out);
}

const GENERATORS: Array<{ name: string; run: Generator }> = [
  { name: "typescript", run: (s) => asText(generateTypeScript(s)) },
  { name: "go", run: (s) => asText(generateGo(s, "Outer")) },
  { name: "rust", run: (s) => asText(generateRust(s, "Outer")) },
  { name: "python", run: (s) => asText(generatePython(s, "Outer")) },
  { name: "zig", run: (s) => asText(generateZig(s, "Outer")) },
];

/**
 * Identifiers that could only have been built by pasting a keyword where a
 * type name belongs. No legitimate emitted symbol is called `optionalEncoder`
 * or `choiceDecoder`, in any of the five target languages.
 */
function keywordDerivedIdentifiers(code: string, keyword: string): string[] {
  const capitalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  const suffixes = "Encoder|Decoder|Input|Output";
  const pattern = new RegExp(`\\b(?:${keyword}|${capitalized})(?:${suffixes})\\b`, "g");
  return [...new Set(code.match(pattern) ?? [])];
}

/**
 * Platform globals whose names happen to end in Encoder/Decoder. The generated
 * code is expected to reference these without declaring them.
 */
const PLATFORM_CODEC_GLOBALS = new Set(["TextEncoder", "TextDecoder"]);

/** Codec classes referenced by the generated TypeScript but never declared. */
function danglingTypeScriptClasses(code: string): string[] {
  const declared = new Set<string>(PLATFORM_CODEC_GLOBALS);
  for (const m of code.matchAll(/^export class (\w+) /gm)) declared.add(m[1]!);
  const missing = new Set<string>();
  for (const m of code.matchAll(/\bnew (\w+(?:Encoder|Decoder))\b/g)) {
    if (!declared.has(m[1]!)) missing.add(m[1]!);
  }
  return [...missing];
}

/**
 * The sample table must cover every keyword, or a new field type would silently
 * drop out of this suite — the same failure mode the suite exists to catch.
 */
async function testSamplesCoverEveryFieldType(): Promise<void> {
  const missing = BUILTIN_FIELD_TYPES.filter((t) => !(t in SAMPLE_FIELDS));
  if (missing.length > 0) {
    throw new Error(
      `SAMPLE_FIELDS has no entry for: ${missing.join(", ")}. ` +
        `Add one so every built-in field type is exercised against every generator.`,
    );
  }
}

/**
 * No generator may emit an identifier built out of a keyword.
 *
 * Refusing to generate is acceptable — but the refusal has to name the type,
 * so whoever hits it knows which case is missing.
 */
async function testNoKeywordDerivedIdentifiers(): Promise<void> {
  const problems: string[] = [];

  for (const keyword of BUILTIN_FIELD_TYPES) {
    const schema = schemaFor(SAMPLE_FIELDS[keyword]);
    for (const { name, run } of GENERATORS) {
      let code: string;
      try {
        code = run(schema);
      } catch (e) {
        const message = String(e);
        // A refusal is fine, as long as it identifies the offending type.
        if (!message.includes(keyword)) {
          problems.push(
            `${name}/${keyword}: refused without naming the field type — ${message.slice(0, 160)}`,
          );
        }
        continue;
      }

      const derived = keywordDerivedIdentifiers(code, keyword);
      if (derived.length > 0) {
        problems.push(`${name}/${keyword}: emitted ${derived.join(", ")}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`keyword leaked into generated identifiers:\n  ${problems.join("\n  ")}`);
  }
}

/**
 * Sharper version of the above for TypeScript, where "declared" is checkable:
 * every `new XEncoder()` must name a class the same file declares.
 */
async function testTypeScriptHasNoDanglingCodecClasses(): Promise<void> {
  const problems: string[] = [];
  for (const keyword of BUILTIN_FIELD_TYPES) {
    let code: string;
    try {
      code = generateTypeScript(schemaFor(SAMPLE_FIELDS[keyword]));
    } catch (e) {
      if (!String(e).includes(keyword)) {
        problems.push(`${keyword}: refused without naming the field type — ${String(e).slice(0, 160)}`);
      }
      continue;
    }
    const dangling = danglingTypeScriptClasses(code);
    if (dangling.length > 0) {
      problems.push(`${keyword}: references undeclared ${dangling.join(", ")}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`TypeScript codec references:\n  ${problems.join("\n  ")}`);
  }
}

/**
 * `optional` specifically: the presence indicator is written whether or not the
 * value is present, so `calculateSize` must count it outside the guard.
 *
 * This is the arithmetic the original bug destroyed — the field contributed a
 * bogus encoder call instead of `1 + sizeof(value)` — and it is not visible to
 * either check above, which only look at identifiers.
 */
async function testOptionalSizeAccountsForPresenceByte(): Promise<void> {
  const code = generateTypeScript(schemaFor(SAMPLE_FIELDS.optional));
  const calc = code.slice(code.indexOf("calculateSize(value: Outer"));
  const body = calc.slice(0, calc.indexOf("\n  }"));

  if (!/size \+= 1; \/\/ subject presence indicator/.test(body)) {
    throw new Error(`optional presence byte is not counted:\n${body}`);
  }
  // The value's own 4 bytes must be inside the "is it present" guard, and the
  // presence byte must not be.
  const guardAt = body.indexOf("if (value.subject !== undefined");
  const presenceAt = body.indexOf("subject presence indicator");
  if (guardAt === -1 || presenceAt === -1 || presenceAt > guardAt) {
    throw new Error(`presence byte must be counted before the presence guard:\n${body}`);
  }
}


/** A one-field struct is not a type alias: its size expression still dereferences the field. */
async function testOneFieldBytesStructSizeUsesField(): Promise<void> {
  const schema: BinarySchema = {
    config: { endianness: "big_endian" },
    types: {
      Blob: {
        sequence: [
          { name: "value", type: "bytes", kind: "length_prefixed", length_type: "uint32" },
        ],
      },
    },
  } as unknown as BinarySchema;
  const code = generateTypeScript(schema);
  const calc = code.slice(code.indexOf("calculateSize(value: Blob"));
  const body = calc.slice(0, calc.indexOf("\n  }"));
  if (!body.includes("size += value.value.length;")) {
    throw new Error(`one-field bytes struct lost its field dereference:\n${body}`);
  }
}

export async function runFieldTypeCoverageTests(): Promise<{
  passed: number;
  failed: number;
  checks: TestCheck[];
}> {
  const checks: TestCheck[] = [];
  let passed = 0;
  let failed = 0;

  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "Every built-in field type has a sample field", fn: testSamplesCoverEveryFieldType },
    {
      name: "No generator turns a field-type keyword into an identifier",
      fn: testNoKeywordDerivedIdentifiers,
    },
    {
      name: "TypeScript never references an undeclared codec class",
      fn: testTypeScriptHasNoDanglingCodecClasses,
    },
    {
      name: "Optional size calculation counts the presence indicator",
      fn: testOptionalSizeAccountsForPresenceByte,
    },
    {
      name: "One-field bytes struct size dereferences its field",
      fn: testOneFieldBytesStructSizeUsesField,
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
