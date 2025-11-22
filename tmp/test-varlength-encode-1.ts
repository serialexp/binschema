import { BitStreamEncoder } from '../src/runtime/bit-stream.js';

const encoder = new BitStreamEncoder();
encoder.writeVarlengthDER(1);
const bytes = encoder.finish();
console.log('Encoding 1:', Array.from(bytes));
console.log('Expected: [1]');
