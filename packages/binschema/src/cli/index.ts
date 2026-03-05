#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { resolve, join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import JSON5 from "json5";
import {
  parseCLICommand,
  formatHelp,
  DocsBuildCommand,
  DocsServeCommand,
  GenerateCommand,
  HelpCommand,
  LlmCommand,
  ValidateCommand,
} from "./command-parser.js";
import type { BinarySchema } from "../schema/binary-schema.js";
import { transformProtocolToBinary } from "../schema/protocol-to-binary.js";

async function main() {
  const argv = process.argv.slice(2);
  const result = parseCLICommand(argv);

  if (!result.ok) {
    console.error(`Error: ${result.error.message}`);
    if (result.error.details) {
      console.error(result.error.details);
    }
    process.exitCode = 1;
    return;
  }

  const command = result.command;

  switch (command.type) {
    case "help":
      await handleHelp(command);
      break;
    case "docs":
      if (command.mode === "build") {
        await handleDocsBuild(command);
      } else {
        await handleDocsServe(command);
      }
      break;
    case "generate":
      await handleGenerate(command);
      break;
    case "validate":
      await handleValidate(command);
      break;
    case "llm":
      await handleLlm();
      break;
    default:
      // Exhaustiveness guard
      const neverCommand: never = command;
      throw new Error(`Unhandled command: ${JSON.stringify(neverCommand)}`);
  }
}

async function handleHelp(command: HelpCommand): Promise<void> {
  console.log(formatHelp(command.path));
}

async function handleLlm(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageRoot = resolve(__dirname, "..", "..");
  const llmsPath = join(packageRoot, "llms.txt");
  if (!existsSync(llmsPath)) {
    console.error("llms.txt not found. If running from source, copy llms.txt into the package root.");
    process.exitCode = 1;
    return;
  }
  console.log(readFileSync(llmsPath, "utf-8"));
}

async function handleValidate(command: ValidateCommand): Promise<void> {
  console.log(`Validating schema: ${command.schemaPath}`);

  try {
    // Step 1: Parse with Zod (structural validation)
    const { BinarySchemaSchema } = await import("../schema/binary-schema.js");
    const absolute = resolve(process.cwd(), command.schemaPath);
    const raw = readFileSync(absolute, "utf-8");
    let parsed: BinarySchema;
    try {
      const json = JSON5.parse(raw);
      parsed = BinarySchemaSchema.parse(json);
    } catch (error) {
      console.error("Schema parse error:");
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error(String(error));
      }
      process.exitCode = 1;
      return;
    }

    // Step 2: Semantic validation
    const { validateSchema, formatValidationErrors } = await import("../schema/validator.js");
    const validation = validateSchema(parsed);
    if (!validation.valid) {
      console.error("Schema validation failed:");
      console.error(formatValidationErrors(validation));
      process.exitCode = 1;
      return;
    }

    console.log("✓ Schema is valid");
  } catch (error) {
    console.error("Failed to validate schema:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exitCode = 1;
  }
}

async function handleDocsBuild(command: DocsBuildCommand): Promise<void> {
  console.log(`Building documentation for schema: ${command.schemaPath}`);
  console.log(`→ Output: ${command.outputPath}`);

  try {
    const schema = loadSchema(command.schemaPath);

    // Extract binary schema (always present)
    const binarySchema = {
      meta: schema.meta,
      config: schema.config,
      types: schema.types,
    };

    // Validate schema before generating docs
    const { validateSchema, formatValidationErrors } = await import("../schema/validator.js");
    const validation = validateSchema(binarySchema);
    if (!validation.valid) {
      console.error("Schema validation failed:");
      console.error(formatValidationErrors(validation));
      process.exitCode = 1;
      return;
    }

    const { generateHTML } = await import("../generators/html.js");

    // Extract protocol schema if present
    const protocolSchema = ("protocol" in schema && schema.protocol)
      ? { protocol: schema.protocol } as any
      : undefined;

    const html = generateHTML(binarySchema, protocolSchema);

    const outputPath = resolve(process.cwd(), command.outputPath!);
    writeFileSync(outputPath, html, "utf-8");

    console.log(`✓ Documentation generated successfully → ${outputPath}`);
  } catch (error) {
    console.error("Failed to generate documentation:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    process.exitCode = 1;
  }
}

async function handleDocsServe(command: DocsServeCommand): Promise<void> {
  console.log(`Serving documentation for schema: ${command.schemaPath}`);
  console.log(`→ Port: ${command.port}`);
  console.log(`→ Watch mode: ${command.watch ? "enabled" : "disabled"}`);
  if (command.outputPath) {
    console.log(`→ Initial output path: ${command.outputPath}`);
  }
  if (command.open) {
    console.log("→ Browser auto-open requested");
  }
  console.log("TODO: start dev server and file watcher");
}

async function handleGenerate(command: GenerateCommand): Promise<void> {
  if (command.watch) {
    console.warn("Watch mode for code generation is not implemented yet; proceeding with a single build.");
  }

  let schema = loadSchema(command.schemaPath);

  // If schema has a protocol section, transform it into binary types (Frame + MessageCode)
  if (schema.protocol) {
    schema = transformProtocolToBinary(schema, {
      combinedTypeName: schema.protocol.frame_type_name,
      messageCodeTypeName: schema.protocol.message_code_type_name,
    });
  }

  const absoluteOut = resolve(process.cwd(), command.outputDir);

  // Validate that --out is not an existing file (it must be a directory)
  if (existsSync(absoluteOut) && !statSync(absoluteOut).isDirectory()) {
    console.error(`Error: --out path is a file, not a directory: ${absoluteOut}`);
    console.error("The generate command writes to a directory. Use --out <dir> to specify an output directory.");
    process.exitCode = 1;
    return;
  }

  mkdirSync(absoluteOut, { recursive: true });

  switch (command.language) {
    case "go": {
      const typeName = resolveTypeName(schema);
      if (!typeName) {
        throw new Error("Schema does not define any types; cannot generate Go code.");
      }
      await runGoGenerator({
        schema,
        typeName,
        outputDir: absoluteOut,
      });
      console.log(`Generated Go sources → ${join(absoluteOut, "generated.go")}`);
      break;
    }
    case "ts": {
      const { generateTypeScript } = await import("../generators/typescript.js");
      const code = generateTypeScript(schema, { debug: command.debug });
      const outputPath = join(absoluteOut, "generated.ts");
      writeFileSync(outputPath, code, "utf-8");

      // Copy runtime dependencies
      const runtimeFiles = ["bit-stream.ts", "seekable-bit-stream.ts", "binary-reader.ts", "crc32.ts"];
      const runtimeDir = resolve(process.cwd(), "src/runtime");
      for (const file of runtimeFiles) {
        const srcPath = join(runtimeDir, file);
        const destPath = join(absoluteOut, file);
        const content = readFileSync(srcPath, "utf-8");
        writeFileSync(destPath, content, "utf-8");
      }

      console.log(`Generated TypeScript sources → ${outputPath}`);
      console.log(`Copied runtime dependencies → ${absoluteOut}/`);
      break;
    }
    case "rust": {
      const typeName = resolveTypeName(schema);
      if (!typeName) {
        throw new Error("Schema does not define any types; cannot generate Rust code.");
      }
      await runRustGenerator({
        schema,
        typeName,
        outputDir: absoluteOut,
      });
      console.log(`Generated Rust sources → ${join(absoluteOut, "src", "generated.rs")}`);
      break;
    }
    default:
      console.error(`Unsupported language: ${command.language}`);
      process.exitCode = 1;
  }
}

function loadSchema(schemaPath: string): BinarySchema {
  const absolute = resolve(process.cwd(), schemaPath);
  const raw = readFileSync(absolute, "utf-8");
  return JSON5.parse(raw) as BinarySchema;
}

function resolveTypeName(schema: BinarySchema): string | undefined {
  const names = Object.keys(schema.types ?? {});
  return names.length > 0 ? names.sort()[0] : undefined;
}

/**
 * Find the Go runtime source files. Searches:
 * 1. go-runtime/ next to the package root (published npm package)
 * 2. ../../go/runtime/ relative to package root (development in monorepo)
 */
function findGoRuntimeDir(): string | null {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageRoot = resolve(__dirname, "..", "..");

  // Published package: go-runtime/ in package root
  const publishedPath = join(packageRoot, "go-runtime");
  if (existsSync(publishedPath)) return publishedPath;

  // Development: monorepo structure
  const devPath = resolve(packageRoot, "..", "..", "go", "runtime");
  if (existsSync(devPath)) return devPath;

  return null;
}

/**
 * Walk up from a directory to find a go.mod file.
 * Returns the module name and the directory containing go.mod.
 */
function findGoModule(startDir: string): { moduleName: string; moduleDir: string } | null {
  let dir = resolve(startDir);
  while (true) {
    const goModPath = join(dir, "go.mod");
    if (existsSync(goModPath)) {
      const content = readFileSync(goModPath, "utf-8");
      const match = content.match(/^module\s+(\S+)/m);
      if (match) {
        return { moduleName: match[1], moduleDir: dir };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

async function runGoGenerator(opts: { schema: BinarySchema; typeName: string; outputDir: string }): Promise<void> {
  mkdirSync(opts.outputDir, { recursive: true });

  // Copy runtime files to outputDir/runtime/
  const runtimeSrcDir = findGoRuntimeDir();
  if (!runtimeSrcDir) {
    throw new Error(
      "Could not find Go runtime source files. " +
      "If running from source, ensure the go/runtime/ directory exists."
    );
  }

  const runtimeDestDir = join(opts.outputDir, "runtime");
  mkdirSync(runtimeDestDir, { recursive: true });

  const runtimeFiles = readdirSync(runtimeSrcDir).filter(f => f.endsWith(".go"));
  for (const file of runtimeFiles) {
    const content = readFileSync(join(runtimeSrcDir, file), "utf-8");
    writeFileSync(join(runtimeDestDir, file), content, "utf-8");
  }

  // Determine the runtime import path
  let runtimeImport: string;
  const goMod = findGoModule(opts.outputDir);
  if (goMod) {
    // Compute import path from go.mod module + relative path to runtime dir
    const relPath = relative(goMod.moduleDir, runtimeDestDir);
    runtimeImport = goMod.moduleName + "/" + relPath.split("\\").join("/");
  } else {
    // No go.mod found - use a sensible default that works with the copied runtime
    runtimeImport = "github.com/serialexp/binschema/runtime";
    console.warn(
      "Warning: No go.mod found in output directory or its parents. " +
      "The generated import path may need adjustment. " +
      "Runtime files have been copied to: " + runtimeDestDir
    );
  }

  const { generateGo } = await import("../generators/go.js");
  const result = generateGo(opts.schema, opts.typeName, { runtimeImport });

  const outputPath = join(opts.outputDir, "generated.go");
  writeFileSync(outputPath, result.code);

  console.log(`Copied Go runtime files → ${runtimeDestDir}/`);
}

/**
 * Find the Rust runtime source files. Searches:
 * 1. rust-runtime/ next to the package root (published npm package)
 * 2. ../../rust/src/ relative to package root (development in monorepo)
 */
function findRustRuntimeDir(): string | null {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageRoot = resolve(__dirname, "..", "..");

  // Published package: rust-runtime/ in package root
  const publishedPath = join(packageRoot, "rust-runtime");
  if (existsSync(publishedPath)) return publishedPath;

  // Development: monorepo structure
  const devPath = resolve(packageRoot, "..", "..", "rust", "src");
  if (existsSync(devPath)) return devPath;

  return null;
}

async function runRustGenerator(opts: { schema: BinarySchema; typeName: string; outputDir: string }): Promise<void> {
  mkdirSync(opts.outputDir, { recursive: true });

  // Copy runtime files to outputDir/binschema_runtime/ as a local crate
  const runtimeSrcDir = findRustRuntimeDir();
  if (!runtimeSrcDir) {
    throw new Error(
      "Could not find Rust runtime source files. " +
      "If running from source, ensure the rust/src/ directory exists."
    );
  }

  const runtimeCrateDir = join(opts.outputDir, "binschema_runtime");
  const runtimeCrateSrcDir = join(runtimeCrateDir, "src");
  mkdirSync(runtimeCrateSrcDir, { recursive: true });

  // Copy runtime source files (exclude test_schema.rs which is test-only)
  const runtimeFiles = ["bitstream.rs", "context.rs"];
  for (const file of runtimeFiles) {
    const content = readFileSync(join(runtimeSrcDir, file), "utf-8");
    writeFileSync(join(runtimeCrateSrcDir, file), content, "utf-8");
  }

  // Write a lib.rs that excludes test_schema module
  const libRsContent = readFileSync(join(runtimeSrcDir, "lib.rs"), "utf-8");
  const strippedLibRs = libRsContent
    .replace(/pub mod test_schema;\n?/, "")
    .replace(/pub use test_schema[^\n]*\n?/g, "");
  writeFileSync(join(runtimeCrateSrcDir, "lib.rs"), strippedLibRs, "utf-8");

  // Write Cargo.toml for the runtime crate (no external deps needed)
  const runtimeCargoToml = `[package]
name = "binschema-runtime"
version = "0.1.0"
edition = "2021"

[lib]
name = "binschema_runtime"
path = "src/lib.rs"
`;
  writeFileSync(join(runtimeCrateDir, "Cargo.toml"), runtimeCargoToml, "utf-8");

  // Generate the code
  const { generateRust } = await import("../generators/rust.js");
  const result = generateRust(opts.schema, opts.typeName);

  // Write generated code into src/
  const srcDir = join(opts.outputDir, "src");
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(join(srcDir, "generated.rs"), result.code, "utf-8");

  // Write a lib.rs that re-exports the generated module
  writeFileSync(join(srcDir, "lib.rs"), `pub mod generated;\n`, "utf-8");

  // Write Cargo.toml for the user's crate if one doesn't exist
  const userCargoPath = join(opts.outputDir, "Cargo.toml");
  if (!existsSync(userCargoPath)) {
    const userCargoToml = `[package]
name = "binschema-generated"
version = "0.1.0"
edition = "2021"

[dependencies]
binschema-runtime = { path = "binschema_runtime" }

[lib]
path = "src/lib.rs"
`;
    writeFileSync(userCargoPath, userCargoToml, "utf-8");
    console.log(`Generated Cargo.toml → ${userCargoPath}`);
  }

  console.log(`Copied Rust runtime crate → ${runtimeCrateDir}/`);
}

function execCommand(cmd: string, args: string[], options: { cwd: string }): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

main().catch((error) => {
  console.error("Unexpected error:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
