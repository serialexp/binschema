#!/usr/bin/env bun
/**
 * Create a simple ZIP file using the BinSchema-generated encoder
 * This demonstrates end-to-end encoding of a real ZIP archive
 */

import { writeFileSync } from "fs";

// Note: The generated code expects runtime files, so we'll inline-generate for this demo
// In production, you'd copy the runtime files or configure import paths

// For this demo, let's use the test infrastructure which already handles this
import { TestSuite } from "../src/schema/test-schema.js";
import { runTestSuite } from "../src/test-runner/runner.js";
import { generateTypeScript } from "../src/generators/typescript.js";
import { readFileSync } from "fs";
import JSON5 from "json5";

// Helper to compute CRC32 (simplified - for demo purposes)
function simpleCRC32(data: Uint8Array): number {
  // For a real implementation, we'd use a proper CRC32 algorithm
  // For now, just return a placeholder since we're testing structure
  return 0;
}

// Create a simple ZIP archive with one text file
const archive: ZipArchive = {
  sections: [
    // Local file entry
    {
      magic: 0x4b50, // "PK"
      section_type: 0x0403, // Local file header
      body: {
        type: "LocalFile",
        value: {
          header: {
            version: 20,
            flags: 0,
            compression_method: 0, // No compression (stored)
            file_mod_time: 0,
            crc32: 0, // Will be computed
            len_body_compressed: 13, // "Hello, World!" length
            len_body_uncompressed: 13,
            file_name: "hello.txt",
            extra: []
          },
          // Body is "Hello, World!" as bytes
          body: Array.from(new TextEncoder().encode("Hello, World!"))
        }
      }
    },
    // Central directory entry
    {
      magic: 0x4b50, // "PK"
      section_type: 0x0201, // Central directory entry
      body: {
        type: "CentralDirEntry",
        value: {
          version_made_by: 0x031E, // Unix, version 3.0
          version_needed_to_extract: 20,
          flags: 0,
          compression_method: 0,
          file_mod_time: 0,
          crc32: 0,
          len_body_compressed: 13,
          len_body_uncompressed: 13,
          disk_number_start: 0,
          int_file_attr: 1,
          ext_file_attr: 0x81A40000,
          ofs_local_header: 0, // Offset to local file header
          file_name: "hello.txt",
          extra: [],
          comment: ""
        }
      }
    },
    // End of central directory
    {
      magic: 0x4b50, // "PK"
      section_type: 0x0605, // End of central directory
      body: {
        type: "EndOfCentralDir",
        value: {
          disk_of_end_of_central_dir: 0,
          disk_of_central_dir: 0,
          num_central_dir_entries_on_disk: 1,
          num_central_dir_entries_total: 1,
          len_central_dir: 54, // Will be computed manually
          ofs_central_dir: 0, // Will be computed manually
          comment: ""
        }
      }
    }
  ]
};

console.log("Creating ZIP archive...");

// Encode the archive
const encoder = new ZipArchiveEncoder();
const bytes = encoder.encode(archive);

console.log(`Generated ${bytes.length} bytes`);

// Write to file
const outputPath = "test-output.zip";
writeFileSync(outputPath, bytes);

console.log(`✓ ZIP file written to ${outputPath}`);
console.log("\nTo verify, run:");
console.log(`  unzip -l ${outputPath}`);
console.log(`  unzip ${outputPath}`);
