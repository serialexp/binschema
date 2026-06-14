/**
 * Expression-evaluation runtime helpers for generated TypeScript code.
 *
 * Generated encoders/decoders reference these for safe conditional evaluation
 * and numeric coercion (conditional fields, computed-field expressions). They
 * used to be injected inline into every generated file; they now live in the
 * runtime so the generated output stays lean and imports them — exactly like
 * `bit-stream`, `crc32`, and `errors`.
 *
 * The `__bs_` prefix is part of the generated call-site contract: the
 * expression converter emits `__bs_checkCondition(() => …)`,
 * `__bs_numeric(__bs_get(() => …))`, and `__bs_literal(<number>)`, so these
 * names must not change without updating the generator in lockstep.
 */

/** Safely evaluate `expr`, returning `undefined` instead of throwing. */
export function __bs_get<T>(expr: () => T): T | undefined {
  try {
    return expr();
  } catch {
    return undefined;
  }
}

/** Coerce integer numbers to BigInt so expression arithmetic stays exact. */
export function __bs_numeric(value: any): any {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }
  return value;
}

/** Coerce an integer numeric literal to BigInt (non-integers pass through). */
export function __bs_literal(value: number): number | bigint {
  if (Number.isInteger(value)) {
    return BigInt(value);
  }
  return value;
}

/**
 * Safely evaluate a condition expression. A thrown error (e.g. a missing
 * optional field) is treated as `false`; a BigInt `0n` is falsy.
 */
export function __bs_checkCondition(expr: () => any): boolean {
  try {
    const result = expr();
    if (typeof result === "bigint") {
      return result !== 0n;
    }
    return !!result;
  } catch {
    return false;
  }
}
