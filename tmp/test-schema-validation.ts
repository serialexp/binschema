import { defineBinarySchema } from '../src/schema/binary-schema.js';
import JSON5 from 'json5';

const invalidSchema = {
  "config": { "endianness": "big_endian" },
  "types": {
    "InvalidString": {
      "sequence": [
        { "name": "length", "type": "uint8" },
        {
          "name": "value",
          "type": "string",
          "kind": "length_prefixed",
          "length_field": "length",
          "length_type": "uint8",
          "encoding": "utf8"
        }
      ]
    }
  }
};

try {
  const schema = defineBinarySchema(invalidSchema as any);
  console.log('ERROR: Schema should have been rejected!');
  console.log('Schema:', JSON.stringify(schema, null, 2));
  process.exit(1);
} catch (e: any) {
  console.log('✓ Schema correctly rejected');
  console.log('Error:', e.message);
  if (e.errors) {
    console.log('Zod errors:', JSON.stringify(e.errors, null, 2));
  }
}
