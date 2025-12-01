#!/usr/bin/env bun
/**
 * Adds decoded_value property to test cases that don't have it.
 * The decoded_value is initially a copy of value.
 *
 * Usage: bun scripts/add-decoded-value.ts [--dry-run] [file-pattern]
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

function processTestFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');

  // Skip if file already has decoded_value
  if (content.includes('decoded_value:')) {
    return false;
  }

  // Look for test_cases array with value/bytes pattern
  const testCasesRegex = /test_cases:\s*\[([\s\S]*?)\n\s*\]\s*\}\);/;
  const match = content.match(testCasesRegex);

  if (!match) {
    return false;
  }

  const testCasesSection = match[1];

  // Find all test cases (simple pattern: description, value, bytes)
  // We need to find test cases that have value: but not decoded_value:
  const valuePattern = /(\s*{[^}]*description:[^}]*value:\s*\{[\s\S]*?\},\s*bytes:\s*\[[\s\S]*?\]\s*})/g;

  let modified = false;
  let newContent = content;

  // Split into individual test cases
  const testCases = [];
  let depth = 0;
  let currentCase = '';
  let inTestCase = false;

  for (let i = 0; i < testCasesSection.length; i++) {
    const char = testCasesSection[i];

    if (char === '{') {
      if (depth === 0) {
        inTestCase = true;
        currentCase = '';
      }
      depth++;
    }

    if (inTestCase) {
      currentCase += char;
    }

    if (char === '}') {
      depth--;
      if (depth === 0 && inTestCase) {
        testCases.push(currentCase);
        inTestCase = false;
      }
    }
  }

  // Process each test case
  for (const testCase of testCases) {
    // Skip if already has decoded_value
    if (testCase.includes('decoded_value:')) {
      continue;
    }

    // Check if it has value: and bytes:
    if (!testCase.includes('value:') || !testCase.includes('bytes:')) {
      continue;
    }

    // Extract the value object
    const valueMatch = testCase.match(/value:\s*(\{[\s\S]*?\}),?\s*bytes:/);
    if (!valueMatch) {
      continue;
    }

    const valueContent = valueMatch[1];

    // Find where to insert decoded_value (after value, before bytes)
    const insertPattern = /(value:\s*\{[\s\S]*?\}),(\s*bytes:)/;
    const updatedCase = testCase.replace(insertPattern, `$1,\n      decoded_value: ${valueContent},$2`);

    if (updatedCase !== testCase) {
      newContent = newContent.replace(testCase, updatedCase);
      modified = true;
    }
  }

  if (modified && !dryRun) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return modified;
}

async function main() {
  console.log('🔍 Adding decoded_value to test cases...\n');

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

    const wasModified = processTestFile(file);

    if (wasModified) {
      modifiedCount++;
      console.log(`✏️  ${relativePath}`);
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
