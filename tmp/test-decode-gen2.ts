import { readFileSync } from 'fs';

const code = readFileSync('src/generators/typescript/array-support.ts', 'utf-8');

// Check if byte_length_prefixed is in the code
const byteLength = code.includes('byte_length_prefixed');
console.log('byte_length_prefixed found in file:', byteLength);

// Check the exact line
const lines = code.split('\n');
const byteLineFull = lines.find(l => l.includes('byte_length_prefixed') && l.includes('Read items'));
console.log('Found line:', byteLineFull);

// Check what comes after
const idx = lines.findIndex(l => l.includes('byte_length_prefixed') && l.includes('Read items'));
console.log('Lines after byte_length_prefixed branch:');
for (let i = idx; i < idx + 10; i++) {
  console.log(i, ':', lines[i]);
}
