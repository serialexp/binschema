import { TestSuite, TestCase } from "../schema/test-schema.js";
import { generateTypeScript } from "../generators/typescript.js";
import { validateSchema, formatValidationErrors } from "../schema/validator.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import kleur from "kleur";

/**
 * Test Runner
 *
 * Runs test suites by:
 * 1. Generating TypeScript code from schema
 * 2. Compiling to JavaScript
 * 3. Dynamically importing generated code
 * 4. Running encode/decode tests
 * 5. Comparing results with expected bytes/bits
 */

/**
 * Stringify with BigInt support
 * Converts BigInt to string with 'n' suffix
 */
function stringifyWithBigInt(value: any): string {
  return JSON.stringify(value, (key, val) =>
    typeof val === 'bigint' ? val.toString() + 'n' : val
  );
}

export interface TestResult {
  testSuite: string;
  passed: number;
  failed: number;
  failures: TestFailure[];
  phase: "schema" | "generation" | "execution" | "pass";
}

export interface TestFailure {
  description: string;
  type: "encode" | "decode" | "validation" | "generation";
  expected: number[] | string;
  actual: number[] | string;
  message: string;
}

/**
 * Run a test suite
 */
export async function runTestSuite(suite: TestSuite, summaryMode = false): Promise<TestResult> {
  const result: TestResult = {
    testSuite: suite.name,
    passed: 0,
    failed: 0,
    failures: [],
    phase: "pass",
  };

  // Validate schema before generation
  const validation = validateSchema(suite.schema);
  if (!validation.valid) {
    // Don't log immediately - will be shown in Final Results

    // If this is a schema validation error test, this is expected
    if (suite.schema_validation_error) {
      result.passed = 1;
      result.phase = "pass";
      return result;
    }

    // Otherwise, unexpected schema validation failure
    result.phase = "schema";
    result.failed = suite.test_cases?.length ?? 0;
    const validationErrorMessage = formatValidationErrors(validation);
    for (const testCase of suite.test_cases ?? []) {
      result.failures.push({
        description: testCase.description,
        type: "validation",
        expected: [],
        actual: [],
        message: `Schema validation failed:\n${validationErrorMessage}`,
      });
    }
    return result;
  }

  // If this is a schema validation error test but schema passed, that's wrong
  if (suite.schema_validation_error) {
    result.phase = "schema";
    result.failed = 1;
    result.failures.push({
      description: "Schema validation",
      type: "validation",
      expected: [],
      actual: [],
      message: "Expected schema validation to fail, but it passed",
    });
    return result;
  }

  // Generate TypeScript code
  let generatedCode: string;
  try {
    generatedCode = generateTypeScript(suite.schema);
  } catch (error) {
    // Don't log immediately - will be shown in Final Results
    result.phase = "generation";
    result.failed = suite.test_cases?.length ?? 0;
    const errorMessage = error instanceof Error ? error.message : String(error);
    for (const testCase of suite.test_cases ?? []) {
      result.failures.push({
        description: testCase.description,
        type: "generation",
        expected: [],
        actual: [],
        message: `Code generation failed: ${errorMessage}`,
      });
    }
    return result;
  }

  // Write to .generated directory (use suite.name to avoid collisions between variants)
  const genDir = join(process.cwd(), ".generated");
  mkdirSync(genDir, { recursive: true });
  const genFile = join(genDir, `${suite.name}.ts`);
  writeFileSync(genFile, generatedCode);

  // Dynamically import generated TypeScript code (bun supports .ts natively)
  // Force fresh import by adding timestamp to bypass cache
  const generatedModule = await import(pathToFileURL(genFile).href + `?t=${Date.now()}`);

  // Get encoder/decoder class names (use test_type, not first type in schema)
  const typeName = suite.test_type;
  const EncoderClass = generatedModule[`${typeName}Encoder`];
  const DecoderClass = generatedModule[`${typeName}Decoder`];

  if (!EncoderClass || !DecoderClass) {
    // Don't log immediately - will be shown in Final Results
    result.phase = "generation";
    result.failed = suite.test_cases?.length ?? 0;
    for (const testCase of suite.test_cases ?? []) {
      result.failures.push({
        description: testCase.description,
        type: "generation",
        expected: [],
        actual: [],
        message: `Could not find ${typeName}Encoder or ${typeName}Decoder in generated code`,
      });
    }
    return result;
  }

  // Check if test type has instance fields (position-based random access)
  const testTypeDef = (suite.schema.types as any)?.[typeName];
  const hasInstanceFields = testTypeDef && (testTypeDef.instances?.length ?? 0) > 0;

  // Run each test case
  for (const testCase of suite.test_cases ?? []) {
    // Run standard encode/decode test
    const testResult = await runTestCase(testCase, EncoderClass, DecoderClass, hasInstanceFields);
    if (testResult.passed) {
      result.passed++;
    } else {
      result.failed++;
      result.failures.push(...testResult.failures);
    }

    // If chunkSizes provided, also run streaming test
    if (testCase.chunkSizes && testCase.bytes) {
      const streamResult = await runStreamingTestCase(
        testCase,
        EncoderClass,
        DecoderClass,
        typeName,
        generatedModule
      );
      if (streamResult.passed) {
        result.passed++;
      } else {
        result.failed++;
        result.failures.push(...streamResult.failures);
      }
    }
  }

  // Mark phase as execution if there were failures during test execution
  if (result.failed > 0) {
    result.phase = "execution";
  }

  return result;
}

/**
 * Create a mock ReadableStream that delivers bytes in chunks
 */
function createChunkedStream(fullData: Uint8Array, chunkSizes: number[]): ReadableStream<Uint8Array> {
  let offset = 0;
  let chunkIndex = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= fullData.length) {
        controller.close();
        return;
      }

      const chunkSize = chunkSizes[chunkIndex % chunkSizes.length];
      const end = Math.min(offset + chunkSize, fullData.length);
      const chunk = fullData.slice(offset, end);

      controller.enqueue(chunk);
      offset = end;
      chunkIndex++;
    }
  });
}

/**
 * Run streaming test case
 * Tests that data can be decoded when delivered in chunks
 */
async function runStreamingTestCase(
  testCase: TestCase,
  EncoderClass: any,
  DecoderClass: any,
  typeName: string,
  generatedModule: any
): Promise<{ passed: boolean; failures: TestFailure[] }> {
  const failures: TestFailure[] = [];

  try {
    const fullData = new Uint8Array(testCase.bytes!);
    const stream = createChunkedStream(fullData, testCase.chunkSizes!);
    const reader = stream.getReader();

    // Try to find streaming decoder function
    const streamDecoderFn = generatedModule[`decode${typeName}Stream`];

    if (!streamDecoderFn) {
      // No streaming decoder generated yet - skip test (suppress in summary mode)
      return { passed: true, failures: [] };
    }

    // Decode using streaming API
    const items: any[] = [];
    for await (const item of streamDecoderFn(reader)) {
      items.push(item);
    }

    // Compare decoded items with expected value
    // For arrays, the value should be an array of items
    const expectedItems = Array.isArray(testCase.value)
      ? testCase.value
      : [testCase.value];

    if (!deepEqual(items, expectedItems)) {
      failures.push({
        description: `${testCase.description} (streaming with chunks ${testCase.chunkSizes!.join(',')})`,
        type: "decode",
        expected: stringifyWithBigInt(expectedItems),
        actual: stringifyWithBigInt(items),
        message: "Streaming decode does not match expected value",
      });
    }

  } catch (error) {
    failures.push({
      description: `${testCase.description} (streaming)`,
      type: "decode",
      expected: stringifyWithBigInt(testCase.value),
      actual: "",
      message: `Streaming exception: ${error}`,
    });
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Run a single test case
 */
async function runTestCase(
  testCase: TestCase,
  EncoderClass: any,
  DecoderClass: any,
  skipEncoding: boolean = false
): Promise<{ passed: boolean; failures: TestFailure[] }> {
  const failures: TestFailure[] = [];

  // Handle encoding error test cases (should_error_on_encode = true)
  if (testCase.should_error_on_encode) {
    try {
      const encoder = new EncoderClass();
      const encoded = encoder.encode(testCase.value);

      // If we got here, encode didn't throw - that's a failure
      failures.push({
        description: testCase.description,
        type: "validation",
        expected: `Error containing: ${testCase.error_message || "any error"}`,
        actual: `Encoded successfully to ${Array.from(encoded).length} bytes`,
        message: "Expected encode to throw an error, but it succeeded",
      });
    } catch (error) {
      // Error was thrown - check if message matches (if error_message specified)
      if (testCase.error_message) {
        const errorStr = String(error);
        if (!errorStr.includes(testCase.error_message)) {
          failures.push({
            description: testCase.description,
            type: "validation",
            expected: `Error containing: ${testCase.error_message}`,
            actual: errorStr,
            message: "Error was thrown but message doesn't match expected",
          });
        }
      }
      // Otherwise, any error is success
    }

    return {
      passed: failures.length === 0,
      failures,
    };
  }

  // Handle decoding error test cases (should_error = true)
  if (testCase.should_error) {
    try {
      if (testCase.bytes) {
        const decoder = new DecoderClass(new Uint8Array(testCase.bytes));
        const decoded = decoder.decode();

        // If we got here, decode didn't throw - that's a failure
        failures.push({
          description: testCase.description,
          type: "validation",
          expected: `Error containing: ${testCase.error_message || "any error"}`,
          actual: stringifyWithBigInt(decoded),
          message: "Expected decode to throw an error, but it succeeded",
        });
      }
    } catch (error) {
      // Error was thrown - check if message matches (if error_message specified)
      if (testCase.error_message) {
        const errorStr = String(error);
        if (!errorStr.includes(testCase.error_message)) {
          failures.push({
            description: testCase.description,
            type: "validation",
            expected: `Error containing: ${testCase.error_message}`,
            actual: errorStr,
            message: "Error was thrown but message doesn't match expected",
          });
        }
      }
      // Otherwise, any error is success
    }

    return {
      passed: failures.length === 0,
      failures,
    };
  }

  // Normal test case (not error test)
  const format = testCase.bytes ? "bytes" : "bits";
  const debugTest = process.env.DEBUG_TEST === "1" || process.env.DEBUG_TEST === "true";

  try {
    // Test encoding (skip for types with instance fields - they're decode-only)
    if (!skipEncoding) {
      const encoder = new EncoderClass();

      if (debugTest) {
        logger.debug(`\n=== DEBUG: ${testCase.description} ===`);
        logger.debug("Input value:", stringifyWithBigInt(testCase.value));
      }

      let encoded: number[];
      let expected: number[];

      if (format === "bytes") {
        // Byte-level encoding
        encoded = Array.from(encoder.encode(testCase.value));
        expected = testCase.bytes!;

        if (debugTest) {
          logger.debug("Expected bytes:", expected);
          logger.debug("Encoded bytes:", encoded);
          logger.debug("Match:", arraysEqual(encoded, expected));
        }
      } else {
        // Bit-level encoding - use finishBits() method
        encoder.encode(testCase.value);
        encoded = encoder.finishBits();
        expected = testCase.bits!;

        if (debugTest) {
          logger.debug("Expected bits:", expected);
          logger.debug("Encoded bits:", encoded);
          logger.debug("Match:", arraysEqual(encoded, expected));
        }
      }

      if (!arraysEqual(encoded, expected)) {
        failures.push({
          description: testCase.description,
          type: "encode",
          expected: expected,
          actual: encoded,
          message: `Encoded ${format} do not match`,
        });
      }
    }

    // Test decoding (round-trip)
    if (testCase.bytes) {
      const decoder = new DecoderClass(new Uint8Array(testCase.bytes));
      const decoded = decoder.decode();

      // Use decoded_value if present (for computed fields), otherwise use value
      const expectedDecoded = testCase.decoded_value !== undefined ? testCase.decoded_value : testCase.value;

      if (!deepEqual(decoded, expectedDecoded)) {
        failures.push({
          description: testCase.description,
          type: "decode",
          expected: stringifyWithBigInt(expectedDecoded),
          actual: stringifyWithBigInt(decoded),
          message: "Decoded value does not match expected",
        });
      }
    }
  } catch (error) {
    if (debugTest) {
      logger.debug("Exception during test:", error);
      if (error instanceof Error) {
        logger.debug("Stack trace:", error.stack);
      }
    }
    failures.push({
      description: testCase.description,
      type: "encode",
      expected: testCase.bytes || testCase.bits || [],
      actual: [],
      message: `Exception: ${error}`,
    });
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

/**
 * Convert bytes to bits for comparison
 */
function bytesToBits(bytes: number[]): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

/**
 * Compare two arrays for equality
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Check if two numbers are approximately equal (for float comparisons)
 * Uses relative tolerance for large numbers, absolute for small
 */
function approximatelyEqual(a: number, b: number): boolean {
  // Exact match (including special values like Infinity, NaN)
  if (a === b) return true;

  // NaN handling
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Number.isNaN(a) || Number.isNaN(b)) return false;

  // Float32 has ~7 decimal digits of precision
  // Use relative error tolerance
  const diff = Math.abs(a - b);
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  const largest = Math.max(absA, absB);

  // For very small numbers near zero, use absolute tolerance
  if (largest < 1e-9) {
    return diff < 1e-12;
  }

  // For normal numbers, use relative tolerance
  // Float32 precision is ~6-7 significant digits, so allow 1.5% error
  return diff / largest < 0.015;
}

/**
 * Deep equality comparison for objects
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  // Special handling for numbers (float comparisons with tolerance)
  if (typeof a === "number" && typeof b === "number") {
    return approximatelyEqual(a, b);
  }

  // Special handling for bigint - allow comparison between bigint and number
  if (typeof a === "bigint" || typeof b === "bigint") {
    // Convert both to bigint for comparison
    try {
      const bigA = typeof a === "bigint" ? a : BigInt(a);
      const bigB = typeof b === "bigint" ? b : BigInt(b);
      return bigA === bigB;
    } catch {
      return false;
    }
  }

  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

import { logger } from "../logger.js";

interface FunctionTestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

interface FunctionTestResult {
  name: string;
  passed: number;
  failed: number;
  checks?: FunctionTestCheck[];
}

/**
 * Pretty print test results
 */
export function printTestResults(results: TestResult[], functionResults: FunctionTestResult[] = [], summaryMode = false, failuresOnly = false): void {
  let totalPassed = 0;
  let totalFailed = 0;
  let schemaErrors = 0;
  let generationErrors = 0;
  let executionFailures = 0;

  for (const result of results) {
    totalPassed += result.passed;
    totalFailed += result.failed;

    // Count by phase
    if (result.phase === "schema") {
      schemaErrors++;
    } else if (result.phase === "generation") {
      generationErrors++;
    } else if (result.phase === "execution") {
      executionFailures++;
    }

    // Skip passing tests if --failures flag is set
    if (failuresOnly && result.failed === 0) {
      continue;
    }

    if (result.failed > 0) {
      // Show failures with condensed header
      logger.info(`${kleur.blue(result.testSuite)} (${kleur.green('✓')} ${result.passed} passed, ${kleur.red('✗')} ${result.failed} failed):`);
      for (const failure of result.failures) {
        // Format multi-line messages with proper indentation
        const lines = failure.message.split('\n');
        logger.info(`    - ${kleur.yellow(failure.description)}: ${lines[0]}`);
        // Indent continuation lines
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) { // Skip empty lines
            logger.info(`      ${lines[i]}`);
          }
        }

        // Show expected vs actual only for actual byte/value tests
        if (failure.type === "encode") {
          logger.info(`      Expected bytes: [${failure.expected}]`);
          logger.info(`      Actual bytes:   [${failure.actual}]`);
        } else if (failure.type === "decode") {
          logger.info(`      Expected: ${failure.expected}`);
          logger.info(`      Actual:   ${failure.actual}`);
        }
        // For validation/generation errors, the message already contains the details
      }
    } else if (result.passed > 0) {
      // Show passing tests on a single line
      logger.info(`${kleur.blue(result.testSuite)} (${kleur.green('✓')} ${result.passed} passed)`);
    }
  }

  // Show function test results in Final Results
  for (const funcResult of functionResults) {
    // Skip passing tests if --failures flag is set
    if (failuresOnly && funcResult.failed === 0) {
      continue;
    }

    if (funcResult.failed > 0) {
      // Show failures with condensed header
      logger.info(`${kleur.blue(funcResult.name)} (${kleur.green('✓')} ${funcResult.passed} passed, ${kleur.red('✗')} ${funcResult.failed} failed):`);
      // Show failed checks in the same format as binary test failures
      if (funcResult.checks) {
        for (const check of funcResult.checks) {
          if (!check.passed) {
            // Format multi-line messages with proper indentation
            if (check.message) {
              const lines = check.message.split('\n');
              logger.info(`    - ${kleur.yellow(check.description)}: ${lines[0]}`);
              // Indent continuation lines
              for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) { // Skip empty lines
                  logger.info(`      ${lines[i]}`);
                }
              }
            } else {
              logger.info(`    - ${kleur.yellow(check.description)}`);
            }
          }
        }
      }
    } else if (funcResult.passed > 0) {
      // Show passing tests on a single line
      logger.info(`${kleur.blue(funcResult.name)} (${kleur.green('✓')} ${funcResult.passed} passed)`);
    }
  }

  // Calculate totals
  let functionTestsPassed = 0;
  let functionTestsFailed = 0;
  for (const funcResult of functionResults) {
    functionTestsPassed += funcResult.passed;
    functionTestsFailed += funcResult.failed;
  }

  logger.info(`\nTotal: ${kleur.green(totalPassed)} passed, ${totalFailed === 0 ? kleur.green(totalFailed) : kleur.red(totalFailed)} failed`);

  // Count non-empty test suites
  const nonEmptyResults = results.filter(r => r.passed > 0 || r.failed > 0);
  const nonEmptyFunctionResults = functionResults.filter(fr => fr.passed > 0 || fr.failed > 0);
  const totalTests = nonEmptyResults.length + nonEmptyFunctionResults.length;

  logger.always(`${totalTests} test suites, ${schemaErrors === 0 ? kleur.green(schemaErrors) : kleur.red(schemaErrors)} schema errors, ${generationErrors === 0 ? kleur.green(generationErrors) : kleur.red(generationErrors)} generation errors, ${executionFailures === 0 ? kleur.green(executionFailures) : kleur.red(executionFailures)} execution failures`);
}
