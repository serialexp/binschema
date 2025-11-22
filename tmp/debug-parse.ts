import { defineBinarySchema } from '../src/schema/binary-schema.js';

const schema = {
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

const parsed = defineBinarySchema(schema as any);
const field = (parsed.types.Test as any).sequence[1];
console.log('Parsed field:', JSON.stringify(field, null, 2));
console.log('Type:', field.type);
console.log('Has kind?:', 'kind' in field);
