#!/usr/bin/env bun
/**
 * Create a ZIP file using the GENERATED ZipArchive encoder
 * This actually tests the schema-generated code!
 */

import { writeFileSync } from "fs";
import { ZipArchiveEncoder, type ZipArchive } from "../.generated/zip-real/generated.js";

console.log("Creating ZIP using generated ZipArchiveEncoder...\n");

// Create a ZIP archive using the generated types
const archive: ZipArchive = {
  sections: [
    // Local file entry
    {
      type: "LocalFile",
      // signature is const, don't provide it!
      header: {
        version: 20,
        flags: 0,
        compression_method: 0, // Stored (no compression)
        file_mod_time: 0,
        file_mod_date: 0,
        len_extra: 0,
        file_name: "hello.txt"
        // crc32, len_body_compressed, len_body_uncompressed, len_file_name are ALL computed!
      },
      // File data
      body: Array.from(new TextEncoder().encode("Hello, World!"))
    },
    // Central directory entry
    {
      type: "CentralDirEntry",
      // signature is const, don't provide it!
      version_made_by: 20,
      version_needed: 20,
      flags: 0,
      compression_method: 0,
      file_mod_time: 0,
      file_mod_date: 0,
      len_extra: 0,
      len_comment: 0,
      disk_number_start: 0,
      int_file_attr: 0,
      ext_file_attr: 0,
      file_name: "hello.txt"
      // crc32, lengths, ofs_local_header, len_file_name are ALL computed!
    },
    // End of central directory
    {
      type: "EndOfCentralDir",
      // signature is const, don't provide it!
      disk_number: 0,
      disk_with_central_dir: 0,
      num_entries_this_disk: 1,
      num_entries_total: 1,
      len_comment: 0
      // len_central_dir and ofs_central_dir are computed!
    }
  ]
};

console.log("Encoding with generated ZipArchiveEncoder...");

// Use the GENERATED encoder
const encoder = new ZipArchiveEncoder();
const bytes = encoder.encode(archive);

console.log(`✓ Generated ${bytes.length} bytes\n`);

// Write to file
const outputPath = "generated-output.zip";
writeFileSync(outputPath, bytes);

console.log(`✓ ZIP file written to ${outputPath}`);
console.log("\nTo verify:");
console.log(`  unzip -v ${outputPath}`);
console.log(`  unzip -p ${outputPath} hello.txt`);
