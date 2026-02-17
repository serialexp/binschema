#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { spawn } from "child_process";
import JSON5 from "json5";
import {
  parseCLICommand,
  formatHelp,
  DocsBuildCommand,
  DocsServeCommand,
  GenerateCommand,
  HelpCommand,
  ValidateCommand,
} from "./command-parser.js";
import type { BinarySchema } from "../schema/binary-schema.js";

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
    default:
      // Exhaustiveness guard
      const neverCommand: never = command;
      throw new Error(`Unhandled command: ${JSON.stringify(neverCommand)}`);
  }
}

async function handleHelp(command: HelpCommand): Promise<void> {
  console.log(formatHelp(command.path));
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

  const schema = loadSchema(command.schemaPath);
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
      const typeName = resolveTypeName(schema, command.typeName);
      if (!typeName) {
        throw new Error("Schema does not define any types; cannot generate Go code.");
      }
      await runGoGenerator({
        schemaPath: resolve(process.cwd(), command.schemaPath),
        typeName,
        outputDir: absoluteOut,
      });
      console.log(`Generated Go sources → ${join(absoluteOut, "generated.go")}`);
      break;
    }
    case "ts": {
      const { generateTypeScript } = await import("../generators/typescript.js");
      const code = generateTypeScript(schema);
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
      const typeName = resolveTypeName(schema, command.typeName);
      if (!typeName) {
        throw new Error("Schema does not define any types; cannot generate Rust code.");
      }
      const { generateRust } = await import("../generators/rust.js");
      const result = generateRust(schema, typeName);
      const outputPath = join(absoluteOut, "generated.rs");
      writeFileSync(outputPath, result.code, "utf-8");
      console.log(`Generated Rust sources → ${outputPath}`);
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

function resolveTypeName(schema: BinarySchema, explicit?: string): string | undefined {
  if (explicit) return explicit;
  const names = Object.keys(schema.types ?? {});
  return names.length > 0 ? names.sort()[0] : undefined;
}

async function runGoGenerator(opts: { schemaPath: string; typeName: string; outputDir: string }): Promise<void> {
  mkdirSync(opts.outputDir, { recursive: true });

  // Use TypeScript generator directly
  const { generateGo } = await import("../generators/go.js");
  const schema = loadSchema(opts.schemaPath);
  const result = generateGo(schema, opts.typeName);

  const outputPath = join(opts.outputDir, "generated.go");
  writeFileSync(outputPath, result.code);
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
