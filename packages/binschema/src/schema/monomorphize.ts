// ABOUTME: Pre-pass that monomorphizes parameterized templates like Optional<T>
// ABOUTME: into concrete named types (e.g. OptionalUint64), so downstream
// ABOUTME: consumers see only ordinary type references.

import type { BinarySchema } from "./binary-schema.js";

/**
 * Capitalize the first character — used to mangle a type-arg into a
 * Rust/Go/Python-friendly suffix. e.g. "uint64" → "Uint64",
 * "String" → "String" (already capitalized).
 */
function capitalizeFirst(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pre-pass: monomorphize parameterized templates like `Optional<T>`.
 *
 * The schema author may declare a generic template (e.g. `"Optional<T>"`) and
 * reference it as `Optional<uint64>` in field types. Most generators have no
 * notion of generics; before code generation we rewrite the schema:
 *
 *   1. Synthesize a concrete type per `Foo<X>` instantiation (mangled name
 *      "FooX", e.g. `OptionalUint64`) by deep-cloning the template and
 *      substituting every `T` with `X`.
 *   2. Rewrite all field references `Foo<X>` to point at the synthesized name.
 *   3. Iterate to a fixpoint so nested instantiations like `Optional<List<X>>`
 *      resolve inside-out (`ListX` first, then `OptionalListX`).
 *   4. Drop the `Foo<T>` template entries from `schema.types`.
 *
 * After this pass the rest of the generator sees only ordinary named types.
 *
 * The TypeScript generator handles templates differently — it inline-expands
 * at field-reference sites instead of synthesizing types — so this pass is
 * idempotent and safe to apply ahead of any generator.
 *
 * @param schemaInput  The user-authored schema (NOT mutated).
 * @returns A deep-cloned schema with templates monomorphized.
 */
export function monomorphizeTemplates(schemaInput: BinarySchema): BinarySchema {
  // Detect templates first; if there are none we skip the deep-clone entirely.
  const templateNames: string[] = [];
  for (const key of Object.keys(schemaInput.types ?? {})) {
    const m = key.match(/^(\w+)<T>$/);
    if (m) templateNames.push(m[1]);
  }
  if (templateNames.length === 0) return schemaInput;

  // Deep-clone so we don't mutate the caller's schema.
  const result: BinarySchema = JSON.parse(JSON.stringify(schemaInput));

  // Index templates by their bare name (e.g. "Optional" → template definition).
  const templates: Record<string, any> = {};
  for (const name of templateNames) {
    templates[name] = result.types[`${name}<T>`];
  }

  /** Replace every occurrence of the type-parameter `T` in a cloned template. */
  function substituteT(node: any, typeArg: string): void {
    if (Array.isArray(node)) {
      for (const item of node) substituteT(item, typeArg);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string") {
          if (v === "T") {
            (node as any)[k] = typeArg;
          } else if (
            /\bT\b/.test(v) &&
            (v.includes("<T>") || v.includes("<T,") || v.includes(",T>") || v.includes(",T,"))
          ) {
            // Nested template parameter, e.g. inner field of type "Foo<T>"
            (node as any)[k] = v.replace(/\bT\b/g, typeArg);
          }
        } else {
          substituteT(v, typeArg);
        }
      }
    }
  }

  /** Walk arbitrary schema subtree and call `cb` on each string value. */
  function walkStrings(
    node: any,
    cb: (parent: any, key: string, value: string) => void
  ): void {
    if (Array.isArray(node)) {
      for (const item of node) walkStrings(item, cb);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string") cb(node, k, v);
        else walkStrings(v, cb);
      }
    }
  }

  // Iterate to a fixpoint. Each round resolves the innermost generic layer:
  // we only treat "Foo<X>" as ready-to-monomorphize when X has no further `<`.
  let changed = true;
  while (changed) {
    changed = false;

    // Collect this round's resolvable instantiations.
    const instantiations = new Set<string>();
    walkStrings(result.types, (_parent, _key, value) => {
      const m = value.match(/^(\w+)<([^<>]+)>$/);
      if (m && templates[m[1]]) {
        instantiations.add(value);
      }
    });

    // Synthesize a concrete type per fresh instantiation.
    for (const inst of instantiations) {
      const m = inst.match(/^(\w+)<([^<>]+)>$/)!;
      const templateName = m[1];
      const typeArg = m[2];
      const mangled = templateName + capitalizeFirst(typeArg);
      if (result.types[mangled]) continue;

      const cloned = JSON.parse(JSON.stringify(templates[templateName]));
      substituteT(cloned, typeArg);
      result.types[mangled] = cloned;
      changed = true;
    }

    // Rewrite references "Foo<X>" → mangled name everywhere in the schema.
    walkStrings(result.types, (parent, key, value) => {
      const m = value.match(/^(\w+)<([^<>]+)>$/);
      if (m && templates[m[1]]) {
        const mangled = m[1] + capitalizeFirst(m[2]);
        if (result.types[mangled]) {
          parent[key] = mangled;
          changed = true;
        }
      }
    });
  }

  // Drop the template entries themselves so the emit loop never sees them.
  for (const name of templateNames) {
    delete result.types[`${name}<T>`];
  }

  return result;
}
