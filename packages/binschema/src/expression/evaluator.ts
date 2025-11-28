// ABOUTME: Expression evaluator for limited arithmetic expressions
// ABOUTME: Supports field references, +, -, *, /, and parentheses

import { ExpressionContext, ExpressionResult } from "./spec.js";

// Token types
type TokenType = "number" | "identifier" | "operator" | "lparen" | "rparen" | "end";

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * Tokenize an expression string
 */
function tokenize(expression: string): Token[] | { error: string } {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < expression.length) {
    const char = expression[pos];

    // Skip whitespace
    if (/\s/.test(char)) {
      pos++;
      continue;
    }

    // Number literal
    if (/[0-9]/.test(char)) {
      const start = pos;
      while (pos < expression.length && /[0-9]/.test(expression[pos])) {
        pos++;
      }
      tokens.push({ type: "number", value: expression.slice(start, pos), position: start });
      continue;
    }

    // Identifier (field reference) - can include dots for nested fields
    if (/[a-zA-Z_]/.test(char)) {
      const start = pos;
      while (pos < expression.length && /[a-zA-Z0-9_.]/.test(expression[pos])) {
        pos++;
      }
      tokens.push({ type: "identifier", value: expression.slice(start, pos), position: start });
      continue;
    }

    // Operators
    if (["+", "-", "*", "/"].includes(char)) {
      tokens.push({ type: "operator", value: char, position: pos });
      pos++;
      continue;
    }

    // Parentheses
    if (char === "(") {
      tokens.push({ type: "lparen", value: char, position: pos });
      pos++;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rparen", value: char, position: pos });
      pos++;
      continue;
    }

    // Invalid character
    return { error: `Invalid character '${char}' at position ${pos}` };
  }

  tokens.push({ type: "end", value: "", position: pos });
  return tokens;
}

/**
 * Recursive descent parser for arithmetic expressions
 *
 * Grammar:
 *   expr    = term (('+' | '-') term)*
 *   term    = factor (('*' | '/') factor)*
 *   factor  = number | identifier | '(' expr ')'
 */
class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private context: ExpressionContext;

  constructor(tokens: Token[], context: ExpressionContext) {
    this.tokens = tokens;
    this.context = context;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token | { error: string } {
    const token = this.current();
    if (token.type !== type) {
      return { error: `Expected ${type} but got ${token.type} at position ${token.position}` };
    }
    return this.advance();
  }

  parse(): ExpressionResult {
    const result = this.parseExpr();

    // Check for parse error (not an ExpressionResult)
    if (!("success" in result)) {
      return { success: false, error: "parse_error", details: result.error };
    }

    // If it's an ExpressionResult with an error, return it directly
    if (!result.success) {
      return result;
    }

    // Ensure we consumed all tokens
    if (this.current().type !== "end") {
      return {
        success: false,
        error: "parse_error",
        details: `Unexpected token '${this.current().value}' at position ${this.current().position}`,
      };
    }

    return result;
  }

  private parseExpr(): ExpressionResult | { error: string } {
    let left = this.parseTerm();
    if (!("success" in left)) return left; // Parse error
    if (!left.success) return left; // Runtime error

    while (this.current().type === "operator" && ["+", "-"].includes(this.current().value)) {
      const op = this.advance().value;
      const right = this.parseTerm();
      if (!("success" in right)) return right; // Parse error
      if (!right.success) return right; // Runtime error

      if (op === "+") {
        left = { success: true, value: left.value + right.value };
      } else {
        left = { success: true, value: left.value - right.value };
      }
    }

    return left;
  }

  private parseTerm(): ExpressionResult | { error: string } {
    let left = this.parseFactor();
    if (!("success" in left)) return left; // Parse error
    if (!left.success) return left; // Runtime error

    while (this.current().type === "operator" && ["*", "/"].includes(this.current().value)) {
      const op = this.advance().value;
      const right = this.parseFactor();
      if (!("success" in right)) return right; // Parse error
      if (!right.success) return right; // Runtime error

      if (op === "*") {
        left = { success: true, value: left.value * right.value };
      } else {
        if (right.value === 0) {
          return { success: false, error: "division_by_zero" };
        }
        // Integer division (truncate towards zero)
        left = { success: true, value: Math.trunc(left.value / right.value) };
      }
    }

    return left;
  }

  private parseFactor(): ExpressionResult | { error: string } {
    const token = this.current();

    // Number literal
    if (token.type === "number") {
      this.advance();
      return { success: true, value: parseInt(token.value, 10) };
    }

    // Field reference (identifier)
    if (token.type === "identifier") {
      this.advance();
      const fieldName = token.value;
      if (!(fieldName in this.context)) {
        return { success: false, error: "undefined_field", details: fieldName };
      }
      return { success: true, value: this.context[fieldName] };
    }

    // Parenthesized expression
    if (token.type === "lparen") {
      this.advance(); // consume '('
      const result = this.parseExpr();
      if (!("success" in result)) return result; // Parse error
      if (!result.success) return result; // Runtime error

      const rparen = this.expect("rparen");
      if ("error" in rparen) return rparen;

      return result;
    }

    // Unexpected token
    if (token.type === "end") {
      return { error: "Unexpected end of expression" };
    }
    return { error: `Unexpected token '${token.value}' at position ${token.position}` };
  }
}

/**
 * Evaluate an arithmetic expression with field references
 *
 * @param expression - The expression to evaluate (e.g., "(max - min + 1) * count")
 * @param context - Map of field names to numeric values
 * @returns Result containing either the computed value or an error
 */
export function evaluateExpression(
  expression: string,
  context: ExpressionContext
): ExpressionResult {
  // Handle empty expression
  if (!expression || expression.trim() === "") {
    return { success: false, error: "parse_error", details: "Empty expression" };
  }

  // Tokenize
  const tokens = tokenize(expression);
  if ("error" in tokens) {
    return { success: false, error: "parse_error", details: tokens.error };
  }

  // Check for empty token list (shouldn't happen, but be safe)
  if (tokens.length === 1 && tokens[0].type === "end") {
    return { success: false, error: "parse_error", details: "Empty expression" };
  }

  // Parse and evaluate
  const parser = new Parser(tokens, context);
  return parser.parse();
}
