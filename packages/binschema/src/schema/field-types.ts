/**
 * The built-in field types, in one place.
 *
 * # Why this file exists
 *
 * A field's `type` is either a **built-in keyword** (`"uint8"`, `"optional"`,
 * `"choice"`, …) or a **reference to a user-defined type** (`"Point"`,
 * `"Optional<uint64>"`). Nothing in the string itself distinguishes the two —
 * user types are required to start with an uppercase letter
 * (`TypeRefFieldSchema` enforces it), but that is a runtime `refine`, so at the
 * type level both are just `string`.
 *
 * Every generator dispatches on that string with a `switch`, and historically
 * each one ended in a `default:` that meant *two* different things at once:
 * "this is a user type, build an identifier from it" **and** "this is a keyword
 * I forgot to handle". The second meaning is silent and wrong. When `optional`
 * was added, the TypeScript size calculator did not grow a case for it, so the
 * field fell into that arm and the generator emitted
 *
 *     const parent_span_id_encoder = new optionalEncoder();
 *
 * naming a class that could never exist. It typechecks (the generator emits
 * strings), it looks plausible in review, and it only detonates at runtime on
 * whichever code path happens to call `calculateSize`. Five keywords were
 * affected — `bool`, `bit`, `optional`, `bitfield`, `choice`.
 *
 * `isBuiltinFieldType` separates the two meanings *before* the switch, so the
 * switch only ever sees keywords and can be made exhaustive with
 * `assertNever`. Add an entry to `BUILTIN_FIELD_TYPES` and every switch that
 * does not handle it stops compiling.
 *
 * # Keeping it honest
 *
 * This list is the single source of truth: `schema/validator.ts` imports it
 * instead of keeping its own copy, and `schema/binary-schema.ts` is checked
 * against it (see `assertBuiltinFieldTypesMatchSchema`) so a new zod arm
 * without a list entry — or the reverse — is caught rather than diverging.
 */

/**
 * Types usable as a field's `type` without being declared in `schema.types`.
 *
 * `as const` is what makes the exhaustiveness checking work; keep it.
 */
export const BUILTIN_FIELD_TYPES = [
  "bit",
  "int",
  "bool",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "int8",
  "int16",
  "int32",
  "int64",
  "varlength",
  "float32",
  "float64",
  "string",
  "array",
  "bytes",
  "optional",
  "bitfield",
  "discriminated_union",
  "back_reference",
  "choice",
  "padding",
  "compressed",
] as const;

/** A field type that is a built-in keyword rather than a user type reference. */
export type BuiltinFieldType = (typeof BUILTIN_FIELD_TYPES)[number];

const BUILTIN_FIELD_TYPE_SET: ReadonlySet<string> = new Set(BUILTIN_FIELD_TYPES);

/**
 * Narrow a raw field-type string to a built-in keyword.
 *
 * Use this to peel the user-type-reference case off *before* switching, so the
 * switch can be exhaustive:
 *
 * ```ts
 * if (!isBuiltinFieldType(fieldType)) {
 *   return generateTypeReference(fieldType);   // user-defined type
 * }
 * switch (fieldType) {
 *   case "uint8": ...
 *   default: assertNever(fieldType);           // compile error on a new keyword
 * }
 * ```
 *
 * Accepts `unknown` because most generator call sites read the type off a
 * loosely-typed field object; a non-string is simply not a built-in.
 */
export function isBuiltinFieldType(type: unknown): type is BuiltinFieldType {
  return typeof type === "string" && BUILTIN_FIELD_TYPE_SET.has(type);
}

/**
 * The inverse: a type reference to something the user declared.
 *
 * Note this is *not* "starts with a capital" — that rule is enforced when a
 * schema is validated. A generator asking this question has already been handed
 * a validated schema and only wants to know which dispatch path to take.
 */
export function isTypeReference(type: unknown): type is string {
  return typeof type === "string" && !BUILTIN_FIELD_TYPE_SET.has(type);
}

/**
 * Exhaustiveness guard for a `switch` over `BuiltinFieldType`.
 *
 * Reaching this with a value the compiler can still widen is a **compile**
 * error: the argument is `never`, so an unhandled keyword fails to typecheck at
 * the call site. The runtime throw only fires if a caller lied about its input
 * (a hand-built schema object, a cast), and it says which keyword it was rather
 * than emitting nonsense.
 */
export function assertNever(value: never, context?: string): never {
  const where = context ? ` (${context})` : "";
  throw new Error(
    `Unhandled built-in field type${where}: ${JSON.stringify(value)}. ` +
      `If this is a new entry in BUILTIN_FIELD_TYPES, every switch over it must handle it.`,
  );
}
