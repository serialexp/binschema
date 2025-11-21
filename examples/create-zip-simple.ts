#!/usr/bin/env bun
/**
 * Create a simple ZIP file using BinSchema runtime encoder
 * This demonstrates creating a minimal valid ZIP file
 */

import { writeFileSync } from "fs";
import { BitStreamEncoder } from "../src/runtime/bit-stream.js";
import { crc32 } from "../src/runtime/crc32.js";

console.log("Creating a minimal ZIP file by hand...\n");

const encoder = new BitStreamEncoder("lsb_first"); // ZIP uses little-endian

// File content
const fileContent = "Hello, World!";
const fileBytes = new TextEncoder().encode(fileContent);
const fileName = "hello.txt";
const fileNameBytes = new TextEncoder().encode(fileName);

// Compute CRC32 of file content
const fileCRC32 = crc32(fileBytes);
console.log(`File CRC32: 0x${fileCRC32.toString(16).toUpperCase().padStart(8, '0')}\n`);

// LOCAL FILE HEADER
console.log("Writing local file header...");
encoder.writeUint32(0x04034b50, "little_endian"); // Local file header signature
encoder.writeUint16(20, "little_endian");          // Version needed to extract (2.0)
encoder.writeUint16(0, "little_endian");           // General purpose bit flag
encoder.writeUint16(0, "little_endian");           // Compression method (0 = stored)
encoder.writeUint16(0, "little_endian");           // File last modification time
encoder.writeUint16(0, "little_endian");           // File last modification date
encoder.writeUint32(fileCRC32, "little_endian");   // CRC-32 of uncompressed file data
encoder.writeUint32(fileBytes.length, "little_endian"); // Compressed size
encoder.writeUint32(fileBytes.length, "little_endian"); // Uncompressed size
encoder.writeUint16(fileNameBytes.length, "little_endian"); // File name length
encoder.writeUint16(0, "little_endian");           // Extra field length

// File name
for (const byte of fileNameBytes) {
  encoder.writeUint8(byte);
}

// File data
for (const byte of fileBytes) {
  encoder.writeUint8(byte);
}

const localHeaderEnd = encoder.byteOffset;
console.log(`  Local file entry: ${localHeaderEnd} bytes`);

// CENTRAL DIRECTORY HEADER
console.log("Writing central directory header...");
const centralDirStart = encoder.byteOffset;
encoder.writeUint32(0x02014b50, "little_endian"); // Central directory file header signature
encoder.writeUint16(0x031E, "little_endian");     // Version made by (3.0, Unix)
encoder.writeUint16(20, "little_endian");         // Version needed to extract
encoder.writeUint16(0, "little_endian");          // General purpose bit flag
encoder.writeUint16(0, "little_endian");          // Compression method
encoder.writeUint16(0, "little_endian");          // File last modification time
encoder.writeUint16(0, "little_endian");          // File last modification date
encoder.writeUint32(fileCRC32, "little_endian");  // CRC-32
encoder.writeUint32(fileBytes.length, "little_endian"); // Compressed size
encoder.writeUint32(fileBytes.length, "little_endian"); // Uncompressed size
encoder.writeUint16(fileNameBytes.length, "little_endian"); // File name length
encoder.writeUint16(0, "little_endian");          // Extra field length
encoder.writeUint16(0, "little_endian");          // File comment length
encoder.writeUint16(0, "little_endian");          // Disk number where file starts
encoder.writeUint16(0, "little_endian");          // Internal file attributes
encoder.writeUint32(0x81A40000, "little_endian"); // External file attributes
encoder.writeUint32(0, "little_endian");          // Relative offset of local file header

// File name (again)
for (const byte of fileNameBytes) {
  encoder.writeUint8(byte);
}

const centralDirEnd = encoder.byteOffset;
const centralDirSize = centralDirEnd - centralDirStart;
console.log(`  Central directory: ${centralDirSize} bytes`);

// END OF CENTRAL DIRECTORY RECORD
console.log("Writing end of central directory record...");
encoder.writeUint32(0x06054b50, "little_endian"); // End of central directory signature
encoder.writeUint16(0, "little_endian");          // Number of this disk
encoder.writeUint16(0, "little_endian");          // Disk where central directory starts
encoder.writeUint16(1, "little_endian");          // Number of central directory records on this disk
encoder.writeUint16(1, "little_endian");          // Total number of central directory records
encoder.writeUint32(centralDirSize, "little_endian"); // Size of central directory
encoder.writeUint32(centralDirStart, "little_endian"); // Offset of start of central directory
encoder.writeUint16(0, "little_endian");          // ZIP file comment length

const bytes = encoder.finish();
console.log(`\nTotal ZIP file size: ${bytes.length} bytes\n`);

// Write to file
const outputPath = "test-output.zip";
writeFileSync(outputPath, bytes);

console.log(`✓ ZIP file written to ${outputPath}`);
console.log("\nTo verify, run:");
console.log(`  unzip -l ${outputPath}`);
console.log(`  unzip -p ${outputPath} hello.txt`);
