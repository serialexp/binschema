import { defineBinarySchema } from '../src/schema/binary-schema.js';

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

const schema = defineBinarySchema(invalidSchema as any);
const valueField = (schema.types.Test as any).sequence[1];
console.log('Parsed value field:', JSON.stringify(valueField, null, 2));
console.log('Has kind?', 'kind' in valueField);
console.log('Has length_field?', 'length_field' in valueField);
console.log('Has length_type?', 'length_type' in valueField);
