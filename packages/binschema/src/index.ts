/**
 * BinSchema - Bit-level binary serialization schema and code generator
 *
 * @example
 * ```typescript
 * import { generateTypeScript, validateSchema } from 'binschema';
 *
 * const schema = {
 *   config: { endianness: 'big_endian' },
 *   types: {
 *     Header: {
 *       sequence: [
 *         { name: 'magic', type: 'uint32' },
 *         { name: 'version', type: 'uint16' }
 *       ]
 *     }
 *   }
 * };
 *
 * // Validate the schema
 * const result = validateSchema(schema);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 *
 * // Generate TypeScript encoder/decoder
 * const code = generateTypeScript(schema);
 * ```
 */

// =============================================================================
// Code Generators
// =============================================================================

export { generateTypeScript } from './generators/typescript.js';
export type { GenerateTypeScriptOptions } from './generators/typescript.js';

export { generateGo } from './generators/go.js';
export type { GoGeneratorOptions, GeneratedGoCode } from './generators/go.js';

export { generateHTML } from './generators/html.js';
export type { HTMLGeneratorOptions } from './generators/html.js';

// =============================================================================
// Schema Types & Validation
// =============================================================================

export {
  BinarySchemaSchema,
  type BinarySchema,
  type Schema,
  defineBinarySchema,
  // Meta types
  MetaSchema,
  type Meta,
  // Config types
  type Config,
  type Endianness,
  type BitOrder,
  // Field types
  type Field,
  type TypeDef,
  type ComputedField,
  type StringEncoding,
  type VarlengthEncoding,
  type ArrayKind,
} from './schema/binary-schema.js';

export {
  validateSchema,
  formatValidationErrors,
  type ValidationResult,
  type ValidationError,
} from './schema/validator.js';

// =============================================================================
// Runtime - Encoder/Decoder
// =============================================================================

export {
  BitStreamEncoder,
  BitStreamDecoder,
  type Endianness as RuntimeEndianness,
  type BitOrder as RuntimeBitOrder,
} from './runtime/bit-stream.js';

export { SeekableBitStreamDecoder } from './runtime/seekable-bit-stream.js';

export {
  type BinaryReader,
  BufferReader,
  FileHandleReader,
  BrowserFileReader,
  StreamReader,
  createReader,
} from './runtime/binary-reader.js';

export { crc32 } from './runtime/crc32.js';

// =============================================================================
// Protocol Layer (for documentation generation)
// =============================================================================

export {
  type ProtocolSchema,
  type ProtocolMessage,
  type MessageGroup,
  type ProtocolConstant,
  validateProtocolSchema,
  normalizeProtocolSchemaInPlace,
} from './schema/protocol-schema.js';

// =============================================================================
// Test Utilities (for cross-language test validation)
// =============================================================================

export {
  type TestSuite,
  type TestCase,
  TestSuiteSchema,
  TestCaseSchema,
  defineTestSuite,
} from './schema/test-schema.js';

// =============================================================================
// Low-level utilities (advanced usage)
// =============================================================================

export { encodeValue } from './schema/encoder.js';
export { annotateWireFormat, type Annotation } from './schema/annotate-wire-format.js';
