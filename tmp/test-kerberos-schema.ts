import { readFileSync } from 'fs';
import { validateBinarySchema } from '../src/schema/validator.js';
import { BinarySchemaSchema } from '../src/schema/binary-schema.js';

const schemaJson = JSON.parse(readFileSync('examples/kerberos.schema.json', 'utf-8'));
const parseResult = BinarySchemaSchema.safeParse(schemaJson);

if (!parseResult.success) {
  console.error('Schema parse failed:');
  console.error(parseResult.error.format());
  process.exit(1);
}

const validation = validateBinarySchema(parseResult.data);
if (!validation.valid) {
  console.error('Schema validation failed:');
  for (const error of validation.errors) {
    console.error(`  ${error.path}: ${error.message}`);
  }
  process.exit(1);
}

console.log('✓ Schema is valid!');
