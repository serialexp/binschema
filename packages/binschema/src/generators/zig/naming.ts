// ABOUTME: Naming + identifier helpers for the Zig generator.
// ABOUTME: snake_case fields, PascalCase types, Zig keyword escaping, var counter.

/** Convert a camelCase / PascalCase / kebab name to snake_case (Zig field convention). */
export function toSnakeCase(name: string): string {
  return name
    .replace(/-/g, "_")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

/** Convert to PascalCase for Zig type (struct/enum/union) names. */
export function toPascalCase(name: string): string {
  if (/^[A-Z]/.test(name) && !name.includes("_") && !name.includes("-")) return name;
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

// Unique counter for generated locals to avoid collisions in nested scopes.
let _varCounter = 0;
export function resetVarCounter(): void {
  _varCounter = 0;
}
export function uniqueVar(prefix: string): string {
  return `${prefix}_${_varCounter++}`;
}

// Zig reserved words — identifiers colliding with these must be escaped as @"name".
const ZIG_KEYWORDS = new Set([
  "addrspace", "align", "allowzero", "and", "anyframe", "anytype", "asm", "async",
  "await", "break", "callconv", "catch", "comptime", "const", "continue", "defer",
  "else", "enum", "errdefer", "error", "export", "extern", "fn", "for", "if",
  "inline", "linksection", "noalias", "noinline", "nosuspend", "opaque", "or",
  "orelse", "packed", "pub", "resume", "return", "struct", "suspend", "switch",
  "test", "threadlocal", "try", "union", "unreachable", "usingnamespace", "var",
  "volatile", "while",
  // common primitive type names that would shadow if used as field idents
  "void", "bool", "type", "anyerror", "noreturn", "anyopaque",
]);

/** Escape a Zig identifier if it collides with a keyword or isn't a plain ident. */
export function zigIdent(name: string): string {
  if (ZIG_KEYWORDS.has(name) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return `@"${name}"`;
  }
  return name;
}

/** A Zig field name: snake_case then keyword-escaped. */
export function zigFieldName(name: string): string {
  return zigIdent(toSnakeCase(name));
}

/** A Zig type name: PascalCase (type names rarely collide, but escape just in case). */
export function zigTypeName(name: string): string {
  const pascal = toPascalCase(name);
  return zigIdent(pascal);
}
