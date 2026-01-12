#!/usr/bin/env bun
/**
 * Generate Go code from Kaitai DNS schema
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import KaitaiStructCompiler from "kaitai-struct-compiler";

async function main() {
  const ksyPath = "/home/bart/Projects/kaitai_struct_formats/network/dns_packet.ksy";
  const ksyContent = readFileSync(ksyPath, "utf-8");
  const ksy = YAML.parse(ksyContent);

  console.log("Compiling Kaitai DNS schema to Go...");

  const files = await KaitaiStructCompiler.compile("go", ksy, null, false);

  // Create output directory
  const genDir = join(process.cwd(), ".generated-bench/go-kaitai");
  mkdirSync(genDir, { recursive: true });

  // Write generated files
  for (const [filename, content] of Object.entries(files)) {
    const outPath = join(genDir, filename);
    writeFileSync(outPath, content as string);
    console.log(`  Generated: ${filename}`);
  }

  console.log("\nDone! Generated files in:", genDir);
}

main().catch(console.error);
