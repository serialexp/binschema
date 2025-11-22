import { generateDecodeArray } from '../src/generators/typescript/array-support.js';

const field = {
  name: "fields",
  type: "array",
  kind: "byte_length_prefixed",
  byte_length_field: "sequence_length",
  items: {
    type: "choice",
    discriminator: { peek: "uint8" },
    choices: [
      { when: "0xA0", type: "Field0" },
      { when: "0xA1", type: "Field1" },
      { when: "0xA2", type: "Field2" }
    ]
  }
};

const schema: any = { config: { endianness: "big_endian" }, types: {} };

const code = generateDecodeArray(
  field,
  schema,
  "big_endian",
  "fields",
  "  ",
  false,
  (name: string) => `value.${name}`,
  (f: any, s: any, e: any, n: string, i: string) => ""
);

console.log("Generated code:");
console.log(code);
