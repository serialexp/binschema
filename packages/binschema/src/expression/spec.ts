// ABOUTME: Type definitions for expression engine test specification
// ABOUTME: Defines the format for cross-language expression evaluation tests

/**
 * Context for expression evaluation - a map of field names to values
 * Supports nested fields via dot notation in the expression (e.g., "header.length")
 * but the context is flat with dotted keys
 */
export type ExpressionContext = Record<string, number>;

/**
 * A successful expression evaluation test case
 */
export interface ExpressionTestSuccess {
  /** Human-readable description of the test */
  description: string;
  /** The expression to evaluate */
  expression: string;
  /** Field values available during evaluation */
  context: ExpressionContext;
  /** Expected numeric result */
  expected: number;
}

/**
 * An expression evaluation test case that should fail
 */
export interface ExpressionTestError {
  /** Human-readable description of the test */
  description: string;
  /** The expression to evaluate */
  expression: string;
  /** Field values available during evaluation */
  context: ExpressionContext;
  /** Expected error type */
  expected_error: ExpressionErrorType;
  /** Additional error details (e.g., which field is undefined) */
  error_details?: string;
}

/**
 * Types of errors the expression engine can produce
 */
export type ExpressionErrorType =
  | "parse_error"        // Invalid expression syntax
  | "undefined_field"    // Referenced field not in context
  | "division_by_zero"   // Division or modulo by zero
  | "invalid_operand";   // Type error (e.g., non-numeric value)

/**
 * A test case - either success or error
 */
export type ExpressionTestCase = ExpressionTestSuccess | ExpressionTestError;

/**
 * Type guard for error test cases
 */
export function isErrorTestCase(test: ExpressionTestCase): test is ExpressionTestError {
  return "expected_error" in test;
}

/**
 * A complete test suite for expression evaluation
 */
export interface ExpressionTestSuite {
  /** Name of the test suite */
  name: string;
  /** Description of what this suite tests */
  description: string;
  /** The test cases */
  tests: ExpressionTestCase[];
}

/**
 * Result of evaluating an expression
 */
export type ExpressionResult =
  | { success: true; value: number }
  | { success: false; error: ExpressionErrorType; details?: string };
