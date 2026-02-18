/**
 * Tests for Go and Rust example formatting functions used in HTML doc generation.
 */

import {
  toGoPascalCase,
  formatGoValue,
  formatGoExample,
  formatRustValue,
  formatRustExample,
} from "../../generators/html";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

function check(
  checks: TestCheck[],
  counters: { passed: number; failed: number },
  description: string,
  fn: () => void,
) {
  try {
    fn();
    counters.passed++;
    checks.push({ description, passed: true });
  } catch (error: any) {
    counters.failed++;
    checks.push({ description, passed: false, message: error.message });
  }
}

function assertEqual(actual: unknown, expected: unknown) {
  const a = typeof actual === "string" ? actual : JSON.stringify(actual);
  const e = typeof expected === "string" ? expected : JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`Expected:\n${e}\n\nActual:\n${a}`);
  }
}

function assertContains(haystack: string, needle: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected to contain:\n${needle}\n\nActual:\n${haystack}`);
  }
}

export function runExampleFormattingTests(): {
  passed: number;
  failed: number;
  checks: TestCheck[];
} {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];
  const c = { get passed() { return passed; }, set passed(v) { passed = v; }, get failed() { return failed; }, set failed(v) { failed = v; } };

  // --- toGoPascalCase ---

  check(checks, c, "toGoPascalCase: simple snake_case", () => {
    assertEqual(toGoPascalCase("file_name"), "FileName");
  });

  check(checks, c, "toGoPascalCase: single word", () => {
    assertEqual(toGoPascalCase("name"), "Name");
  });

  check(checks, c, "toGoPascalCase: multiple underscores", () => {
    assertEqual(toGoPascalCase("int_file_attr"), "IntFileAttr");
  });

  check(checks, c, "toGoPascalCase: numeric suffix", () => {
    assertEqual(toGoPascalCase("pattern_5555"), "Pattern5555");
  });

  check(checks, c, "toGoPascalCase: already PascalCase-ish", () => {
    assertEqual(toGoPascalCase("flags"), "Flags");
  });

  // --- formatGoValue: primitives ---

  check(checks, c, "formatGoValue: string", () => {
    assertEqual(formatGoValue("hello", 0), '"hello"');
  });

  check(checks, c, "formatGoValue: integer", () => {
    assertEqual(formatGoValue(42, 0), "42");
  });

  check(checks, c, "formatGoValue: float", () => {
    assertEqual(formatGoValue(3.14, 0), "3.14");
  });

  check(checks, c, "formatGoValue: boolean true", () => {
    assertEqual(formatGoValue(true, 0), "true");
  });

  check(checks, c, "formatGoValue: null", () => {
    assertEqual(formatGoValue(null, 0), "nil");
  });

  // --- formatGoValue: arrays ---

  check(checks, c, "formatGoValue: empty array", () => {
    assertEqual(formatGoValue([], 0), "{}");
  });

  check(checks, c, "formatGoValue: primitive array", () => {
    assertEqual(formatGoValue([1, 2, 3], 0), "{1, 2, 3}");
  });

  check(checks, c, "formatGoValue: string array", () => {
    assertEqual(formatGoValue(["a", "b"], 0), '{"a", "b"}');
  });

  // --- formatGoValue: objects ---

  check(checks, c, "formatGoValue: object converts keys to PascalCase", () => {
    const result = formatGoValue({ file_name: "test" }, 0);
    assertContains(result, 'FileName: "test"');
  });

  // --- formatGoExample: full struct ---

  check(checks, c, "formatGoExample: flat struct with fields", () => {
    const data = {
      version: 0,
      flags: 1,
      file_name: "example",
    };
    const result = formatGoExample(data, "MyType");
    assertContains(result, "generated.MyType{");
    assertContains(result, "Version: 0");
    assertContains(result, "Flags: 1");
    assertContains(result, 'FileName: "example"');
  });

  check(checks, c, "formatGoExample: null data falls back", () => {
    const result = formatGoExample(null, "MyType");
    assertContains(result, "generated.MyType{");
    assertContains(result, "Fill in your data here");
  });

  check(checks, c, "formatGoExample: empty object", () => {
    const result = formatGoExample({}, "MyType");
    assertEqual(result, "generated.MyType{}");
  });

  // --- formatRustValue: primitives ---

  check(checks, c, "formatRustValue: string adds .to_string()", () => {
    assertEqual(formatRustValue("hello", 0), '"hello".to_string()');
  });

  check(checks, c, "formatRustValue: integer", () => {
    assertEqual(formatRustValue(42, 0), "42");
  });

  check(checks, c, "formatRustValue: boolean", () => {
    assertEqual(formatRustValue(false, 0), "false");
  });

  check(checks, c, "formatRustValue: null", () => {
    assertEqual(formatRustValue(null, 0), "None");
  });

  // --- formatRustValue: arrays ---

  check(checks, c, "formatRustValue: empty array", () => {
    assertEqual(formatRustValue([], 0), "vec![]");
  });

  check(checks, c, "formatRustValue: primitive array", () => {
    assertEqual(formatRustValue([1, 2], 0), "vec![1, 2]");
  });

  // --- formatRustValue: objects ---

  check(checks, c, "formatRustValue: object keeps snake_case keys", () => {
    const result = formatRustValue({ file_name: "test" }, 0);
    assertContains(result, "file_name:");
    assertContains(result, '"test".to_string()');
  });

  // --- formatRustExample: full struct ---

  check(checks, c, "formatRustExample: flat struct with fields", () => {
    const data = {
      version: 0,
      flags: 1,
      file_name: "example",
    };
    const result = formatRustExample(data, "MyType");
    assertContains(result, "MyType {");
    assertContains(result, "version: 0");
    assertContains(result, "flags: 1");
    assertContains(result, 'file_name: "example".to_string()');
  });

  check(checks, c, "formatRustExample: null data falls back", () => {
    const result = formatRustExample(null, "MyType");
    assertContains(result, "MyType {");
    assertContains(result, "Fill in your data here");
  });

  check(checks, c, "formatRustExample: empty object", () => {
    const result = formatRustExample({}, "MyType");
    assertEqual(result, "MyType {}");
  });

  // --- Nested structures ---

  check(checks, c, "formatGoExample: nested object", () => {
    const data = {
      header: { version: 1, flags: 0 },
      name: "test",
    };
    const result = formatGoExample(data, "Packet");
    assertContains(result, "generated.Packet{");
    assertContains(result, "Header:");
    assertContains(result, "Version: 1");
    assertContains(result, "Flags: 0");
    assertContains(result, 'Name: "test"');
  });

  check(checks, c, "formatRustExample: nested object", () => {
    const data = {
      header: { version: 1, flags: 0 },
      name: "test",
    };
    const result = formatRustExample(data, "Packet");
    assertContains(result, "Packet {");
    assertContains(result, "header:");
    assertContains(result, "version: 1");
    assertContains(result, "flags: 0");
    assertContains(result, 'name: "test".to_string()');
  });

  return { passed, failed, checks };
}
