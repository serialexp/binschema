// ABOUTME: Tests for the expression engine
// ABOUTME: Validates expression parsing and evaluation against the test specification

import { allExpressionTestSuites } from "../../expression/test-cases.js";
import { ExpressionTestSuite, ExpressionTestCase, isErrorTestCase, ExpressionResult } from "../../expression/spec.js";
import { evaluateExpression } from "../../expression/evaluator.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

/**
 * Run all expression engine tests
 */
export function runExpressionEngineTests(): { passed: number; failed: number; checks: TestCheck[] } {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];

  for (const suite of allExpressionTestSuites) {
    const suiteResults = runTestSuite(suite);
    passed += suiteResults.passed;
    failed += suiteResults.failed;
    checks.push(...suiteResults.checks);
  }

  return { passed, failed, checks };
}

function runTestSuite(suite: ExpressionTestSuite): { passed: number; failed: number; checks: TestCheck[] } {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];

  for (const test of suite.tests) {
    const testName = `${suite.name}: ${test.description}`;

    try {
      const result = evaluateExpression(test.expression, test.context);

      if (isErrorTestCase(test)) {
        // Expected an error
        if (result.success) {
          failed++;
          checks.push({
            description: testName,
            passed: false,
            message: `Expected error '${test.expected_error}' but got success with value ${result.value}`,
          });
        } else if (result.error !== test.expected_error) {
          failed++;
          checks.push({
            description: testName,
            passed: false,
            message: `Expected error '${test.expected_error}' but got '${result.error}'${result.details ? ` (${result.details})` : ""}`,
          });
        } else if (test.error_details && result.details !== test.error_details) {
          failed++;
          checks.push({
            description: testName,
            passed: false,
            message: `Expected error details '${test.error_details}' but got '${result.details}'`,
          });
        } else {
          passed++;
          checks.push({
            description: testName,
            passed: true,
          });
        }
      } else {
        // Expected success
        if (!result.success) {
          failed++;
          checks.push({
            description: testName,
            passed: false,
            message: `Expected value ${test.expected} but got error '${result.error}'${result.details ? ` (${result.details})` : ""}`,
          });
        } else if (result.value !== test.expected) {
          failed++;
          checks.push({
            description: testName,
            passed: false,
            message: `Expected ${test.expected} but got ${result.value}`,
          });
        } else {
          passed++;
          checks.push({
            description: testName,
            passed: true,
          });
        }
      }
    } catch (error: any) {
      failed++;
      checks.push({
        description: testName,
        passed: false,
        message: `Exception: ${error.message}`,
      });
    }
  }

  return { passed, failed, checks };
}
