import { BitStreamEncoder, BitStreamDecoder } from '../src/runtime/bit-stream.js';

console.log('Testing EBML encoding for 256...');
const encoder = new BitStreamEncoder();
encoder.writeVarlengthEBML(256);
const bytes = encoder.finish();
console.log('Encoded:', Array.from(bytes));
console.log('Expected: [65, 0]  // 0x41 0x00');
console.log('Binary: 0x41 = 0b01000001, 0x00 = 0b00000000');
console.log('Width 2: 01xxxxxx xxxxxxxx where value=256');

const decoder = new BitStreamDecoder(bytes);
console.log('Decoded:', decoder.readVarlengthEBML());
