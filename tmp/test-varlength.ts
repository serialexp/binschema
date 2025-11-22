import { BitStreamEncoder, BitStreamDecoder } from '../src/runtime/bit-stream.js';

// Test DER encoding
console.log('Testing DER encoding...');
const encoder = new BitStreamEncoder();
encoder.writeVarlengthDER(5);
encoder.writeVarlengthDER(200);
encoder.writeVarlengthDER(65536);
const bytes = encoder.finish();
console.log('Encoded:', Array.from(bytes));
console.log('Expected: [5, 129, 200, 131, 1, 0, 0]');

// Test DER decoding
const decoder = new BitStreamDecoder(bytes);
console.log('Decoded:', decoder.readVarlengthDER(), decoder.readVarlengthDER(), decoder.readVarlengthDER());

// Test LEB128
console.log('\nTesting LEB128 encoding...');
const encoder2 = new BitStreamEncoder();
encoder2.writeVarlengthLEB128(150);
const bytes2 = encoder2.finish();
console.log('Encoded:', Array.from(bytes2));
console.log('Expected: [150, 1]  // 0x96 0x01');

const decoder2 = new BitStreamDecoder(bytes2);
console.log('Decoded:', decoder2.readVarlengthLEB128());

// Test EBML
console.log('\nTesting EBML encoding...');
const encoder3 = new BitStreamEncoder();
encoder3.writeVarlengthEBML(10);
const bytes3 = encoder3.finish();
console.log('Encoded:', Array.from(bytes3));
console.log('Expected: [138]  // 0x8A = 0b10001010');

const decoder3 = new BitStreamDecoder(bytes3);
console.log('Decoded:', decoder3.readVarlengthEBML());
