import { crc32 } from './.generated/crc32.js';

const data = [72,101,108,108,111,44,32,87,111,114,108,100,33]; // "Hello, World!"
const result = crc32(data);
console.log('CRC32: 0x' + result.toString(16).padStart(8, '0') + ' = ' + result);

// As little-endian bytes
const bytes = new Uint32Array([result]);
const view = new Uint8Array(bytes.buffer);
console.log('As bytes (little-endian): [' + Array.from(view).join(',') + ']');
