import { generateTypeScript } from '../src/generators/typescript.js';
import JSON5 from 'json5';
import { readFileSync } from 'fs';

const testData = JSON5.parse(readFileSync('./tests-json/protocols/asn1_sequence_choice.test.json', 'utf-8'));
const code = generateTypeScript(testData.schema);

// Print the whole generated code
console.log(code);
