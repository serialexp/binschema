#!/usr/bin/env bun
/**
 * Strips signature fields from ZIP test values (but keeps them in decoded_value)
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
  'packages/binschema/src/tests/integration/zip-minimal.test.ts',
  'packages/binschema/src/tests/integration/zip-multi-file.test.ts'
];

for (const file of files) {
  console.log(`Processing: ${file}`);

  const content = readFileSync(file, 'utf-8');

  // Find all test cases
  const testCasePattern = /(\{[\s\S]*?description:[\s\S]*?value:\s*\{[\s\S]*?\},\s*decoded_value:[\s\S]*?\},\s*bytes:[\s\S]*?\})/g;

  let newContent = content;
  const matches = content.matchAll(testCasePattern);

  for (const match of matches) {
    const testCase = match[0];

    // Extract value section
    const valueMatch = testCase.match(/(value:\s*\{)([\s\S]*?)(\},\s*decoded_value:)/);
    if (!valueMatch) continue;

    const valuePrefix = valueMatch[1];
    let valueContent = valueMatch[2];
    const valueSuffix = valueMatch[3];

    // Remove signature lines from value (at any nesting level)
    valueContent = valueContent.replace(/^\s*signature: 0x[0-9A-Fa-f]+,?\s*$/gm, '');

    const newTestCase = testCase.replace(
      valuePrefix + valueMatch[2] + valueSuffix,
      valuePrefix + valueContent + valueSuffix
    );

    if (newTestCase !== testCase) {
      newContent = newContent.replace(testCase, newTestCase);
    }
  }

  writeFileSync(file, newContent, 'utf-8');
  console.log(`✓ Updated ${file}\n`);
}

console.log('Done!');
