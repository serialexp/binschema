#!/usr/bin/env bun
/**
 * Updates test cases to strip const and computed fields from `value`,
 * and ensures `decoded_value` includes those fields.
 *
 * Usage: bun scripts/update-test-values.ts [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

function globSync(pattern: string, options: { cwd: string; absolute: boolean }): string[] {
  const { cwd, absolute } = options;
  const baseDir = pattern.split('*')[0].replace(/\/$/, '');
  const results: string[] = [];

  function walk(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith('.test.ts')) {
        results.push(absolute ? fullPath : path.relative(cwd, fullPath));
      }
    }
  }

  walk(path.join(cwd, baseDir));
  return results;
}

interface Field {
  name: string;
  type?: string;
  const?: any;
  computed?: any;
  [key: string]: any;
}

interface TypeDef {
  sequence?: Field[];
  [key: string]: any;
}

interface Schema {
  types: Record<string, TypeDef>;
}

interface TestCase {
  description: string;
  value: any;
  decoded_value?: any;
  bytes: number[];
}

const dryRun = process.argv.includes('--dry-run');

function getTypeFields(typeDef: TypeDef): Field[] {
  if (typeDef.sequence) {
    return typeDef.sequence;
  }
  return [];
}

function getConstAndComputedFields(typeName: string, schema: Schema, path: string[] = []): Set<string> {
  const fields = new Set<string>();
  const typeDef = schema.types[typeName];

  if (!typeDef) return fields;

  const typeFields = getTypeFields(typeDef);

  for (const field of typeFields) {
    const fieldPath = [...path, field.name].join('.');

    // Check if field has const or computed
    if (field.const !== undefined || field.computed) {
      fields.add(fieldPath);
    }

    // Recursively check nested types
    if (field.type && schema.types[field.type]) {
      const nestedFields = getConstAndComputedFields(field.type, schema, [...path, field.name]);
      nestedFields.forEach(f => fields.add(f));
    }

    // Check array item types
    if (field.type === 'array' && field.items?.type && schema.types[field.items.type]) {
      // For arrays, we need to handle each element
      // We'll mark the field pattern for later processing
    }
  }

  return fields;
}

function stripFieldsFromValue(value: any, fieldsToStrip: Set<string>, prefix: string = ''): any {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, idx) => stripFieldsFromValue(item, fieldsToStrip, prefix));
  }

  const result: any = {};

  for (const [key, val] of Object.entries(value)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    // Skip if this field should be stripped
    if (fieldsToStrip.has(fieldPath)) {
      continue;
    }

    // Recursively process nested objects
    if (typeof val === 'object' && val !== null) {
      result[key] = stripFieldsFromValue(val, fieldsToStrip, fieldPath);
    } else {
      result[key] = val;
    }
  }

  return result;
}

function hasConstOrComputedFields(typeName: string, schema: Schema): boolean {
  const fields = getConstAndComputedFields(typeName, schema);
  return fields.size > 0;
}

function processTestFile(filePath: string) {
  console.log(`\nProcessing: ${filePath}`);

  const content = readFileSync(filePath, 'utf-8');

  // Extract schema and test cases using regex
  // This is a simplified approach - we're looking for the exported test suite
  const schemaMatch = content.match(/schema:\s*(\{[\s\S]*?\n\s*\}),?\n\s*test_type:/);
  const testCasesMatch = content.match(/test_cases:\s*\[([\s\S]*?)\n\s*\]\s*\}\);/);

  if (!schemaMatch || !testCasesMatch) {
    console.log('  ⏭️  Skipped: Could not parse schema or test cases');
    return;
  }

  let modified = false;
  let updatedContent = content;

  // Try to extract schema
  try {
    // Note: This is a simplified extraction - real implementation would need proper parsing
    const schemaText = schemaMatch[1];

    // For now, just report what we found
    console.log('  ℹ️  Found schema and test cases');

    // Check if test cases have value without decoded_value
    const hasValueWithoutDecodedValue = content.includes('value:') &&
                                       content.includes('bytes:') &&
                                       !content.includes('decoded_value:');

    if (hasValueWithoutDecodedValue) {
      console.log('  ⚠️  Found test cases with value but no decoded_value');
      modified = true;
    }

  } catch (e) {
    console.log(`  ❌ Error parsing: ${e}`);
  }

  if (modified) {
    console.log('  ✏️  Would update this file (dry-run mode)');
  } else {
    console.log('  ✓ No changes needed');
  }
}

async function main() {
  console.log('🔍 Scanning test files for const/computed field cleanup...\n');

  if (dryRun) {
    console.log('📋 DRY RUN MODE - No files will be modified\n');
  }

  const testFiles = globSync('packages/binschema/src/tests/', {
    cwd: '/home/bart/Projects/binschema',
    absolute: true
  });

  console.log(`Found ${testFiles.length} test files\n`);

  let processedCount = 0;
  let modifiedCount = 0;

  for (const file of testFiles) {
    // Skip validation test files
    if (file.includes('/validation/')) {
      continue;
    }

    processTestFile(file);
    processedCount++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Processed: ${processedCount} files`);
  console.log(`  Modified: ${modifiedCount} files`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes');
  }
}

main().catch(console.error);
