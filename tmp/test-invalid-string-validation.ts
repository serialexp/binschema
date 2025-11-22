import { defineBinarySchema } from '../src/schema/binary-schema.js';

console.log('Test 1: Invalid - length_prefixed with length_field');
try {
  const invalidSchema = {
    "config": { "endianness": "big_endian" },
    "types": {
      "Test": {
        "sequence": [
          { "name": "length", "type": "uint8" },
          {
            "name": "value",
            "type": "string",
            "kind": "length_prefixed",
            "length_field": "length",
            "length_type": "uint8"
          }
        ]
      }
    }
  };
  defineBinarySchema(invalidSchema as any);
  console.log('  ✗ FAIL: Schema should have been rejected!');
  process.exit(1);
} catch (e: any) {
  console.log('  ✓ PASS: Schema correctly rejected');
  console.log('  Error:', e.message);
}

console.log('\nTest 2: Valid - field_referenced with length_field');
try {
  const validSchema = {
    "config": { "endianness": "big_endian" },
    "types": {
      "Test": {
        "sequence": [
          { "name": "length", "type": "uint8" },
          {
            "name": "value",
            "type": "string",
            "kind": "field_referenced",
            "length_field": "length"
          }
        ]
      }
    }
  };
  const schema = defineBinarySchema(validSchema as any);
  const field = (schema.types.Test as any).sequence[1];
  console.log('  ✓ PASS: Valid schema accepted');
  console.log('  Field:', JSON.stringify(field, null, 2));
} catch (e: any) {
  console.log('  ✗ FAIL: Valid schema rejected!');
  console.log('  Error:', e.message);
  process.exit(1);
}

console.log('\nAll tests passed!');
