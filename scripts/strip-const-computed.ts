#!/usr/bin/env bun
/**
 * Strips const and computed fields from test case `value` properties.
 * Reads the schema to identify which fields should be stripped.
 *
 * Usage: bun scripts/strip-const-computed.ts [--dry-run] [file-pattern]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

const dryRun = process.argv.includes('--dry-run');
const filePattern = process.argv.find(arg => !arg.includes('--') && !arg.includes('scripts/') && arg.endsWith('.ts'));

function getAllTestFiles(baseDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.test.ts')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }
  }

  walk(baseDir);
  return results;
}

interface FieldToStrip {
  path: string;  // e.g., "signature", "header.crc32", "sections[].signature"
}

function extractSchemaTypes(content: string): any {
  // Find the schema object in defineTestSuite
  const schemaMatch = content.match(/schema:\s*\{([\s\S]*?)\n\s*\},?\s*test_type:/);
  if (!schemaMatch) {
    return null;
  }

  const schemaText = schemaMatch[0];

  // Extract types section
  const typesMatch = schemaText.match(/types:\s*\{([\s\S]*?)\n\s*\}/);
  if (!typesMatch) {
    return null;
  }

  return typesMatch[0];
}

function findConstAndComputedFields(schemaText: string): FieldToStrip[] {
  const fields: FieldToStrip[] = [];

  // Pattern: { name: "fieldname", ..., const: value, ... }
  // or:      { name: "fieldname", ..., computed: { ... }, ... }
  const fieldPattern = /\{\s*name:\s*["']([^"']+)["'][^}]*?(const:|computed:)[^}]*?\}/g;

  let match;
  while ((match = fieldPattern.exec(schemaText)) !== null) {
    const fieldName = match[1];
    fields.push({ path: fieldName });
  }

  return fields;
}

function stripFieldsFromValue(content: string, fieldsToStrip: FieldToStrip[]): string {
  if (fieldsToStrip.length === 0) {
    return content;
  }

  let newContent = content;

  // Split content into test cases
  const testCasePattern = /(\{[\s\S]*?description:[\s\S]*?value:\s*\{[\s\S]*?\}[\s\S]*?bytes:[\s\S]*?\})/g;

  const matches = content.matchAll(testCasePattern);

  for (const match of matches) {
    const testCase = match[0];

    // Extract just the value part
    const valueMatch = testCase.match(/(value:\s*\{)([\s\S]*?)(\},?\s*(?:decoded_value|bytes):)/);
    if (!valueMatch) continue;

    const valuePrefix = valueMatch[1];
    const valueContent = valueMatch[2];
    const valueSuffix = valueMatch[3];

    let newValueContent = valueContent;

    // Strip fields from value content only
    for (const field of fieldsToStrip) {
      const fieldName = field.path;

      // Pattern to match field lines
      const patterns = [
        // Basic field with simple value
        new RegExp(`^(\\s*)${fieldName}:\\s*[^,\\n]+,?\\s*$`, 'gm'),
        // Field with object value (single line)
        new RegExp(`^(\\s*)${fieldName}:\\s*\\{[^}]+\\},?\\s*$`, 'gm'),
        // Field with array value (single line)
        new RegExp(`^(\\s*)${fieldName}:\\s*\\[[^\\]]+\\],?\\s*$`, 'gm'),
      ];

      for (const pattern of patterns) {
        newValueContent = newValueContent.replace(pattern, '');
      }
    }

    const newTestCase = testCase.replace(
      valuePrefix + valueContent + valueSuffix,
      valuePrefix + newValueContent + valueSuffix
    );

    if (newTestCase !== testCase) {
      newContent = newContent.replace(testCase, newTestCase);
    }
  }

  return newContent;
}

function processTestFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');

  // Extract schema
  const schemaText = extractSchemaTypes(content);
  if (!schemaText) {
    return false;
  }

  // Find const and computed fields
  const fieldsToStrip = findConstAndComputedFields(schemaText);
  if (fieldsToStrip.length === 0) {
    return false;
  }

  console.log(`  Found ${fieldsToStrip.length} const/computed fields: ${fieldsToStrip.map(f => f.path).join(', ')}`);

  // Strip fields from value properties
  const newContent = stripFieldsFromValue(content, fieldsToStrip);

  if (newContent === content) {
    return false;
  }

  if (!dryRun) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return true;
}

async function main() {
  console.log('🔍 Stripping const/computed fields from test case values...\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No files will be modified\n');
  }

  const baseDir = path.join(process.cwd(), 'packages/binschema/src/tests');
  let testFiles = getAllTestFiles(baseDir);

  if (filePattern) {
    testFiles = testFiles.filter(f => f.includes(filePattern));
    console.log(`Filtered to files matching: ${filePattern}\n`);
  }

  console.log(`Found ${testFiles.length} test files\n`);

  let modifiedCount = 0;

  for (const file of testFiles) {
    const relativePath = path.relative(process.cwd(), file);

    // Skip validation test files
    if (file.includes('/validation/')) {
      continue;
    }

    console.log(`Processing: ${relativePath}`);
    const wasModified = processTestFile(file);

    if (wasModified) {
      modifiedCount++;
      console.log(`✏️  Modified\n`);
    } else {
      console.log(`  ⏭️  No changes\n`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Total files: ${testFiles.length}`);
  console.log(`  Modified: ${modifiedCount}`);

  if (dryRun && modifiedCount > 0) {
    console.log('\n💡 Run without --dry-run to apply changes');
  }
}

main().catch(console.error);
