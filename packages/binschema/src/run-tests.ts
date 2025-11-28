/**
 * Comprehensive test runner with automatic test discovery
 *
 * Automatically exports TypeScript tests to JSON, then runs them
 */

import { runTestSuite, printTestResults, TestResult } from "./test-runner/runner.js";
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync, copyFileSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import { TestSuite } from "./schema/test-schema.js";
import JSON5 from "json5";
import { setLogLevel, logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Export TypeScript tests to JSON (inline implementation)
 */
async function exportTestsToJson(filter?: string): Promise<{ filtered: FunctionTestResult[], total: number }> {
  console.log('Generating test scenarios, writing from src/tests/ to .generated/tests-json/');

  const testsDir = join(__dirname, 'tests');
  const outputDir = join(__dirname, '../.generated/tests-json');

  // Create output directory
  mkdirSync(outputDir, { recursive: true });

  // Find all .test.ts files
  const testFiles = findTestSourceFiles(testsDir);

  let totalSuites = 0;
  const functionTestResults: FunctionTestResult[] = [];
  let totalFunctionTests = 0;

  for (const testFile of testFiles) {
    const { suites, functionResults, totalFunctionTests: fileTotal } = await loadTestSuitesFromTypeScript(testFile, filter);

    totalFunctionTests += fileTotal;

    for (const suite of suites) {
      const relativeToTests = relative(testsDir, dirname(testFile));
      const outputPath = join(outputDir, relativeToTests, `${suite.name}.test.json`);

      mkdirSync(dirname(outputPath), { recursive: true });

      // Use JSON5 to support Infinity, -Infinity, NaN
      const json = JSON5.stringify(suite, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        return value;
      }, 2);

      writeFileSync(outputPath, json, 'utf-8');
      totalSuites++;
    }

    functionTestResults.push(...functionResults);
  }

  return {
    filtered: functionTestResults,
    total: totalFunctionTests
  };
}

/**
 * Find all *.test.ts files
 */
function findTestSourceFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findTestSourceFiles(fullPath));
      } else if (entry.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore directories we can't read
  }

  return files;
}

/**
 * Load test suites from TypeScript module
 */
async function loadTestSuitesFromTypeScript(filePath: string, filter?: string): Promise<{ suites: TestSuite[], functionResults: FunctionTestResult[], totalFunctionTests: number }> {
  const relativePath = './' + relative(__dirname, filePath).replace(/\.ts$/, '.js');

  try {
    const module = await import(relativePath);

    const testSuites: TestSuite[] = [];
    for (const [key, value] of Object.entries(module)) {
      if (key.endsWith('TestSuite') && value && typeof value === 'object') {
        testSuites.push(value as TestSuite);
      }
    }

    // Also look for exported test functions (for non-binary tests like documentation, CLI parser)
    const functionResults: FunctionTestResult[] = [];
    let totalFunctionTests = 0;

    for (const [key, value] of Object.entries(module)) {
      if (typeof value === 'function' && (key.startsWith('run') || key.endsWith('Tests'))) {
        totalFunctionTests++; // Count all function tests

        // Skip running function tests that don't match the filter (support pipe-separated patterns)
        if (filter) {
          const patterns = filter.toLowerCase().split('|');
          const matches = patterns.some(pattern => key.toLowerCase().includes(pattern.trim()));
          if (!matches) {
            continue;
          }
        }

        try {
          const result = value();

          // If function returns { passed, failed, checks? }, track it
          if (result && typeof result === 'object' && 'passed' in result && 'failed' in result) {
            functionResults.push({
              name: key,
              passed: result.passed,
              failed: result.failed,
              checks: result.checks || []
            });
          }
        } catch (err) {
          functionResults.push({
            name: key,
            passed: 0,
            failed: 1,
            checks: [{
              description: 'Test execution',
              passed: false,
              message: `Test function ${key} threw error: ${err}`
            }]
          });
        }
      }
    }

    return { suites: testSuites, functionResults, totalFunctionTests };
  } catch (err) {
    logger.error(`Failed to load test file ${filePath}:`, err);
    return { suites: [], functionResults: [], totalFunctionTests: 0 };
  }
}

/**
 * Recursively find all *.test.json files in a directory
 */
function findTestFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively search subdirectories
        files.push(...findTestFiles(fullPath));
      } else if (entry.endsWith('.test.json')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore directories we can't read
  }

  return files;
}

/**
 * Load test suite from JSON file
 */
async function loadTestSuite(filePath: string): Promise<TestSuite | null> {
  try {
    const json = readFileSync(filePath, 'utf-8');

    // Parse JSON5 with BigInt support (supports Infinity, NaN)
    const suite = JSON5.parse(json, (key, value) => {
      // Convert string ending with 'n' back to BigInt
      if (typeof value === 'string' && /^-?\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1));
      }
      return value;
    });

    return suite as TestSuite;
  } catch (err) {
    console.error(`Failed to load test file ${filePath}:`, err);
    return null;
  }
}

/**
 * Get category name from file path (e.g., "tests/composite/strings.test.ts" -> "Composite")
 */
function getCategoryFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const testsIndex = parts.indexOf('tests');

  if (testsIndex >= 0 && testsIndex < parts.length - 1) {
    const category = parts[testsIndex + 1];
    // Capitalize first letter
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  return 'Other';
}

/**
 * Set up runtime library in .generated directory
 * Copies runtime files so generated code can import them
 */
function setupRuntimeLibrary(): void {
  const genDir = join(__dirname, '../.generated');
  mkdirSync(genDir, { recursive: true });

  // Copy bit-stream.ts with both names for compatibility
  const bitStreamSource = join(__dirname, 'runtime/bit-stream.ts');
  copyFileSync(bitStreamSource, join(genDir, 'BitStream.ts')); // Legacy capitalized name
  copyFileSync(bitStreamSource, join(genDir, 'bit-stream.ts')); // Actual name for imports

  // Copy binary-reader.ts
  const binaryReaderSource = join(__dirname, 'runtime/binary-reader.ts');
  const binaryReaderDest = join(genDir, 'binary-reader.ts');
  copyFileSync(binaryReaderSource, binaryReaderDest);

  // Copy seekable-bit-stream.ts
  const seekableSource = join(__dirname, 'runtime/seekable-bit-stream.ts');
  const seekableDest = join(genDir, 'seekable-bit-stream.ts');
  copyFileSync(seekableSource, seekableDest);

  // Copy crc32.ts
  const crc32Source = join(__dirname, 'runtime/crc32.ts');
  const crc32Dest = join(genDir, 'crc32.ts');
  copyFileSync(crc32Source, crc32Dest);

  // Copy expression-evaluator.ts
  const exprEvalSource = join(__dirname, 'runtime/expression-evaluator.ts');
  const exprEvalDest = join(genDir, 'expression-evaluator.ts');
  copyFileSync(exprEvalSource, exprEvalDest);
}

async function main() {
  // Check for DEBUG_TEST environment variable and enable debug logging
  if (process.env.DEBUG_TEST === "1" || process.env.DEBUG_TEST === "true") {
    setLogLevel('debug');
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  let filter: string | undefined = undefined;
  let summaryMode = false;
  let failuresOnly = false;

  for (const arg of args) {
    if (arg.startsWith("--filter=")) {
      filter = arg.substring("--filter=".length);
    } else if (arg === "--summary") {
      summaryMode = true;
      setLogLevel('silent');
    } else if (arg === "--failures") {
      failuresOnly = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: bun run src/run-tests.ts [options]");
      console.log("");
      console.log("Options:");
      console.log("  --filter=<pattern>  Only run tests with names containing <pattern>");
      console.log("                      Supports pipe-separated patterns: 'foo|bar|baz'");
      console.log("  --failures          Show only tests with failures");
      console.log("  --summary           Show only final summary (suppress verbose output)");
      console.log("  --help, -h          Show this help message");
      console.log("");
      console.log("Environment Variables:");
      console.log("  DEBUG_TEST=1        Enable verbose debug output (input values, bytes, stack traces)");
      console.log("");
      console.log("Examples:");
      console.log("  bun run src/run-tests.ts                          # Run all tests");
      console.log("  bun run src/run-tests.ts --filter=optional        # Run tests with 'optional' in name");
      console.log("  bun run src/run-tests.ts --filter='uint8|uint16'  # Run tests matching 'uint8' OR 'uint16'");
      console.log("  bun run src/run-tests.ts --failures               # Show only failing tests");
      console.log("  bun run src/run-tests.ts --summary                # Run all tests, show only summary");
      console.log("  DEBUG_TEST=1 npm test -- --filter=uint8           # Debug uint8 tests with verbose output");
      process.exit(0);
    }
  }


  const { filtered: functionTestResults, total: totalFunctionTests } = await exportTestsToJson(filter);
  setupRuntimeLibrary();

  // Find all test JSON files
  const testsJsonDir = join(__dirname, '../.generated/tests-json');
  const testFiles = findTestFiles(testsJsonDir);

  // Load all test suites
  const allSuites: Map<string, TestSuite[]> = new Map();

  for (const testFile of testFiles) {
    const suite = await loadTestSuite(testFile);
    if (!suite) {
      logger.warn(`Skipping invalid test file: ${testFile}`);
      continue;
    }

    const category = getCategoryFromPath(testFile);

    if (!allSuites.has(category)) {
      allSuites.set(category, []);
    }

    allSuites.get(category)!.push(suite);
  }

  const results: TestResult[] = [];
  let totalSuites = 0;
  let filteredSuites = 0;

  // Sort categories for consistent output
  const sortedCategories = Array.from(allSuites.keys()).sort();

  for (const category of sortedCategories) {
    const suites = allSuites.get(category)!;

    // Filter suites (support pipe-separated patterns: "foo|bar|baz")
    const filteredGroupSuites = filter
      ? suites.filter(suite => {
          const patterns = filter.toLowerCase().split('|');
          return patterns.some(pattern => suite.name.toLowerCase().includes(pattern.trim()));
        })
      : suites;

    totalSuites += suites.length;
    filteredSuites += filteredGroupSuites.length;

    // Skip empty categories
    if (filteredGroupSuites.length === 0) continue;

    for (const suite of filteredGroupSuites) {
      const result = await runTestSuite(suite, summaryMode);
      results.push(result);
    }
  }

  // Function tests are already filtered during execution
  const filteredFunctionCount = functionTestResults.length;
  const totalFilteredCount = filteredSuites + filteredFunctionCount;
  const totalAllCount = totalSuites + totalFunctionTests;

  // Show filter summary
  if (filter && totalFilteredCount === 0) {
    logger.always(`\n⚠️  No tests matched filter: "${filter}"`);
    logger.always(`Total available test suites: ${totalAllCount}`);
    process.exit(0);
  } else if (filter) {
    logger.info(`\nℹ️  Ran ${totalFilteredCount} of ${totalAllCount} test suites (filtered)`);
  }

  if (failuresOnly) {
    logger.info("\n⚠️  Showing only tests with failures");
  }

  // Function tests are already filtered during execution
  printTestResults(results, functionTestResults, summaryMode, failuresOnly);

  // Exit with error code if any tests failed
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
