// ABOUTME: Thin JSON5 parse/load helper for cross-package tooling (e.g. the Zig harness).
// ABOUTME: Lives here so `json5` resolves against the package's node_modules.

import JSON5 from "json5";
import { readFileSync } from "node:fs";

/** Parse a JSON5 string. */
export function parseJson5<T = any>(text: string): T {
  return JSON5.parse(text) as T;
}

/** Read and parse a JSON5 file from disk. */
export function loadJson5File<T = any>(path: string): T {
  return JSON5.parse(readFileSync(path, "utf-8")) as T;
}
