// ABOUTME: Test cases for the expression engine
// ABOUTME: These tests define the expected behavior for all language implementations

import { ExpressionTestSuite } from "./spec.js";

/**
 * Test suite for basic arithmetic operations
 */
export const arithmeticTestSuite: ExpressionTestSuite = {
  name: "arithmetic",
  description: "Basic arithmetic operations (+, -, *, /)",
  tests: [
    // Addition
    {
      description: "Simple addition",
      expression: "a + b",
      context: { a: 10, b: 5 },
      expected: 15,
    },
    {
      description: "Addition with zero",
      expression: "a + b",
      context: { a: 42, b: 0 },
      expected: 42,
    },
    {
      description: "Addition of three values",
      expression: "a + b + c",
      context: { a: 1, b: 2, c: 3 },
      expected: 6,
    },

    // Subtraction
    {
      description: "Simple subtraction",
      expression: "a - b",
      context: { a: 10, b: 3 },
      expected: 7,
    },
    {
      description: "Subtraction resulting in negative",
      expression: "a - b",
      context: { a: 3, b: 10 },
      expected: -7,
    },
    {
      description: "Subtraction from zero",
      expression: "a - b",
      context: { a: 0, b: 5 },
      expected: -5,
    },

    // Multiplication
    {
      description: "Simple multiplication",
      expression: "a * b",
      context: { a: 6, b: 7 },
      expected: 42,
    },
    {
      description: "Multiplication by zero",
      expression: "a * b",
      context: { a: 100, b: 0 },
      expected: 0,
    },
    {
      description: "Multiplication by one",
      expression: "a * b",
      context: { a: 42, b: 1 },
      expected: 42,
    },

    // Division
    {
      description: "Simple division",
      expression: "a / b",
      context: { a: 20, b: 4 },
      expected: 5,
    },
    {
      description: "Division with remainder (truncates)",
      expression: "a / b",
      context: { a: 7, b: 2 },
      expected: 3,
    },
    {
      description: "Division of zero",
      expression: "a / b",
      context: { a: 0, b: 5 },
      expected: 0,
    },

    // Division by zero error
    {
      description: "Division by zero",
      expression: "a / b",
      context: { a: 10, b: 0 },
      expected_error: "division_by_zero",
    },
  ],
};

/**
 * Test suite for operator precedence
 */
export const precedenceTestSuite: ExpressionTestSuite = {
  name: "precedence",
  description: "Operator precedence and parentheses",
  tests: [
    {
      description: "Multiplication before addition",
      expression: "a + b * c",
      context: { a: 2, b: 3, c: 4 },
      expected: 14, // 2 + (3 * 4) = 14
    },
    {
      description: "Division before subtraction",
      expression: "a - b / c",
      context: { a: 10, b: 6, c: 2 },
      expected: 7, // 10 - (6 / 2) = 7
    },
    {
      description: "Parentheses override precedence",
      expression: "(a + b) * c",
      context: { a: 2, b: 3, c: 4 },
      expected: 20, // (2 + 3) * 4 = 20
    },
    {
      description: "Nested parentheses",
      expression: "((a + b) * c) - d",
      context: { a: 1, b: 2, c: 3, d: 4 },
      expected: 5, // ((1 + 2) * 3) - 4 = 5
    },
    {
      description: "Complex expression with mixed operators",
      expression: "a * b + c * d",
      context: { a: 2, b: 3, c: 4, d: 5 },
      expected: 26, // (2 * 3) + (4 * 5) = 26
    },
    {
      description: "Left-to-right for same precedence (addition/subtraction)",
      expression: "a - b + c",
      context: { a: 10, b: 3, c: 5 },
      expected: 12, // (10 - 3) + 5 = 12
    },
    {
      description: "Left-to-right for same precedence (multiplication/division)",
      expression: "a * b / c",
      context: { a: 12, b: 3, c: 4 },
      expected: 9, // (12 * 3) / 4 = 9
    },
  ],
};

/**
 * Test suite for field references
 */
export const fieldReferenceTestSuite: ExpressionTestSuite = {
  name: "field_references",
  description: "Field references including dotted notation",
  tests: [
    {
      description: "Simple field reference",
      expression: "count",
      context: { count: 42 },
      expected: 42,
    },
    {
      description: "Dotted field reference",
      expression: "header.length",
      context: { "header.length": 256 },
      expected: 256,
    },
    {
      description: "Multiple dotted references in expression",
      expression: "header.max - header.min + 1",
      context: { "header.max": 255, "header.min": 0 },
      expected: 256,
    },
    {
      description: "Deeply nested dotted reference",
      expression: "a.b.c.d",
      context: { "a.b.c.d": 100 },
      expected: 100,
    },
    {
      description: "Mix of simple and dotted references",
      expression: "count * item.size",
      context: { count: 10, "item.size": 8 },
      expected: 80,
    },

    // Undefined field errors
    {
      description: "Undefined simple field",
      expression: "foo + bar",
      context: { foo: 10 },
      expected_error: "undefined_field",
      error_details: "bar",
    },
    {
      description: "Undefined dotted field",
      expression: "header.length",
      context: {},
      expected_error: "undefined_field",
      error_details: "header.length",
    },
  ],
};

/**
 * Test suite for integer literals
 */
export const literalTestSuite: ExpressionTestSuite = {
  name: "literals",
  description: "Integer literal values in expressions",
  tests: [
    {
      description: "Literal only",
      expression: "42",
      context: {},
      expected: 42,
    },
    {
      description: "Zero literal",
      expression: "0",
      context: {},
      expected: 0,
    },
    {
      description: "Field plus literal",
      expression: "count + 1",
      context: { count: 10 },
      expected: 11,
    },
    {
      description: "Literal minus field",
      expression: "100 - offset",
      context: { offset: 25 },
      expected: 75,
    },
    {
      description: "Range calculation pattern (max - min + 1)",
      expression: "max - min + 1",
      context: { max: 255, min: 0 },
      expected: 256,
    },
    {
      description: "Literal in complex expression",
      expression: "(max - min + 1) * 2",
      context: { max: 10, min: 5 },
      expected: 12, // (10 - 5 + 1) * 2 = 12
    },
  ],
};

/**
 * Test suite for PCF-specific patterns
 */
export const pcfPatternsTestSuite: ExpressionTestSuite = {
  name: "pcf_patterns",
  description: "Real-world patterns from PCF font format",
  tests: [
    {
      description: "BdfEncodings array size (single byte range)",
      expression: "(max_char_or_byte2 - min_char_or_byte2 + 1) * (max_byte1 - min_byte1 + 1)",
      context: {
        max_char_or_byte2: 255,
        min_char_or_byte2: 0,
        max_byte1: 0,
        min_byte1: 0,
      },
      expected: 256, // 256 * 1 = 256
    },
    {
      description: "BdfEncodings array size (two byte range)",
      expression: "(max_char_or_byte2 - min_char_or_byte2 + 1) * (max_byte1 - min_byte1 + 1)",
      context: {
        max_char_or_byte2: 127,
        min_char_or_byte2: 32,
        max_byte1: 1,
        min_byte1: 0,
      },
      expected: 192, // 96 * 2 = 192
    },
    {
      description: "Simple count from field",
      expression: "num_glyphs",
      context: { num_glyphs: 256 },
      expected: 256,
    },
    {
      description: "Bitmap size calculation",
      expression: "width * height",
      context: { width: 8, height: 16 },
      expected: 128,
    },
  ],
};

/**
 * Test suite for parse errors
 */
export const parseErrorTestSuite: ExpressionTestSuite = {
  name: "parse_errors",
  description: "Invalid expression syntax",
  tests: [
    {
      description: "Empty expression",
      expression: "",
      context: {},
      expected_error: "parse_error",
    },
    {
      description: "Trailing operator",
      expression: "a +",
      context: { a: 10 },
      expected_error: "parse_error",
    },
    {
      description: "Leading operator",
      expression: "* b",
      context: { b: 10 },
      expected_error: "parse_error",
    },
    {
      description: "Double operator",
      expression: "a + + b",
      context: { a: 10, b: 5 },
      expected_error: "parse_error",
    },
    {
      description: "Unmatched open parenthesis",
      expression: "(a + b",
      context: { a: 10, b: 5 },
      expected_error: "parse_error",
    },
    {
      description: "Unmatched close parenthesis",
      expression: "a + b)",
      context: { a: 10, b: 5 },
      expected_error: "parse_error",
    },
    {
      description: "Empty parentheses",
      expression: "()",
      context: {},
      expected_error: "parse_error",
    },
    {
      description: "Invalid character",
      expression: "a @ b",
      context: { a: 10, b: 5 },
      expected_error: "parse_error",
    },
  ],
};

/**
 * All expression test suites
 */
export const allExpressionTestSuites: ExpressionTestSuite[] = [
  arithmeticTestSuite,
  precedenceTestSuite,
  fieldReferenceTestSuite,
  literalTestSuite,
  pcfPatternsTestSuite,
  parseErrorTestSuite,
];
