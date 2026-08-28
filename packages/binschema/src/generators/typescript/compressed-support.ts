/**
 * Compressed region support.
 *
 * A `compressed` field is a pure wire transform on a byte region: the inner
 * `value_type` is encoded to a self-contained buffer, run through a named codec
 * (`store`/`deflate`/`gzip` built in; others via `registerCodec`), and framed as
 *
 *   [uncompressed_size: size_type][compressed_length: length_type][compressed_bytes…]
 *
 * On decode, the two sizes are read, the compressed bytes are sliced and run
 * through the codec's `decompress`, and the inner type is decoded from the
 * resulting buffer. The two size fields are *consumed framing* — they do not
 * appear in the decoded value, so `value === decoded_value`.
 */

import { BinarySchema, Endianness, Field } from "../../schema/binary-schema.js";
import { encoderClassName, decoderClassName } from "./type-utils.js";

type SizeType = "uint8" | "uint16" | "uint32" | "uint64";

/**
 * Return true if any type in the schema uses a `compressed` field, so the
 * generator can conditionally import the codec registry.
 */
export function schemaUsesCompression(schema: BinarySchema): boolean {
  const seen = new Set<unknown>();
  const scan = (node: unknown): boolean => {
    if (node === null || typeof node !== "object") return false;
    if (seen.has(node)) return false;
    seen.add(node);
    if (Array.isArray(node)) {
      return node.some(scan);
    }
    const obj = node as Record<string, unknown>;
    if (obj.type === "compressed") return true;
    return Object.values(obj).some(scan);
  };
  return scan(schema.types);
}

/**
 * Emit a statement writing a length value (a plain JS number) using the given
 * size type and endianness.
 */
function writeSizeStmt(
  sizeType: SizeType,
  valueExpr: string,
  endianness: Endianness,
  indent: string
): string {
  switch (sizeType) {
    case "uint8":
      return `${indent}this.writeUint8(${valueExpr});\n`;
    case "uint16":
      return `${indent}this.writeUint16(${valueExpr}, "${endianness}");\n`;
    case "uint32":
      return `${indent}this.writeUint32(${valueExpr}, "${endianness}");\n`;
    case "uint64":
      return `${indent}this.writeUint64(BigInt(${valueExpr}), "${endianness}");\n`;
  }
}

/**
 * Emit an expression reading a length value as a plain JS number using the
 * given size type and endianness.
 */
function readSizeExpr(sizeType: SizeType, endianness: Endianness): string {
  switch (sizeType) {
    case "uint8":
      return `this.readUint8()`;
    case "uint16":
      return `this.readUint16("${endianness}")`;
    case "uint32":
      return `this.readUint32("${endianness}")`;
    case "uint64":
      return `Number(this.readUint64("${endianness}"))`;
  }
}

/**
 * Generate encoding for a `compressed` field.
 */
export function generateEncodeCompressed(
  field: Field,
  _schema: BinarySchema,
  globalEndianness: Endianness,
  valuePath: string,
  indent: string
): string {
  const f = field as any;
  const innerType: string = f.value_type;
  const codec: string = f.codec;
  const sizeType: SizeType = f.size_type || "uint32";
  const lengthType: SizeType = f.length_type || "uint32";

  // Unique suffix derived from the field name to avoid collisions when multiple
  // compressed fields share a scope.
  const suffix = (f.name || valuePath).replace(/[^a-zA-Z0-9_]/g, "_");
  const innerVar = `__inner_${suffix}`;
  const compVar = `__compressed_${suffix}`;

  let code = "";
  code += `${indent}// Compressed region: encode inner type, compress, frame\n`;
  code += `${indent}const ${innerVar} = new ${encoderClassName(innerType)}().encode(${valuePath});\n`;
  code += `${indent}const ${compVar} = resolveCodec(${JSON.stringify(codec)}).compress(${innerVar});\n`;
  code += writeSizeStmt(sizeType, `${innerVar}.length`, globalEndianness, indent);
  code += writeSizeStmt(lengthType, `${compVar}.length`, globalEndianness, indent);
  code += `${indent}this.writeBytes(${compVar});\n`;
  return code;
}

/**
 * Generate decoding for a `compressed` field. `target` is the assignment target
 * (e.g. `value.payload`).
 */
export function generateDecodeCompressed(
  field: Field,
  _schema: BinarySchema,
  globalEndianness: Endianness,
  target: string,
  indent: string
): string {
  const f = field as any;
  const innerType: string = f.value_type;
  const codec: string = f.codec;
  const sizeType: SizeType = f.size_type || "uint32";
  const lengthType: SizeType = f.length_type || "uint32";

  const suffix = (f.name || target).replace(/[^a-zA-Z0-9_]/g, "_");
  const uSizeVar = `__usize_${suffix}`;
  const cLenVar = `__clen_${suffix}`;
  const sliceVar = `__cslice_${suffix}`;
  const decompVar = `__decomp_${suffix}`;

  let code = "";
  code += `${indent}// Compressed region: read framing, decompress, decode inner type\n`;
  code += `${indent}const ${uSizeVar} = ${readSizeExpr(sizeType, globalEndianness)};\n`;
  code += `${indent}const ${cLenVar} = ${readSizeExpr(lengthType, globalEndianness)};\n`;
  code += `${indent}const ${sliceVar} = this.readBytesSlice(${cLenVar});\n`;
  code += `${indent}const ${decompVar} = resolveCodec(${JSON.stringify(codec)}).decompress(${sliceVar}, ${uSizeVar});\n`;
  code += `${indent}if (${decompVar}.length !== ${uSizeVar}) {\n`;
  code += `${indent}  throw new BinSchemaError(ErrorCode.INVALID_ENCODING, \`Decompressed size mismatch for ${suffix}: expected \${${uSizeVar}}, got \${${decompVar}.length}\`, { context: ${JSON.stringify(codec)} });\n`;
  code += `${indent}}\n`;
  code += `${indent}${target} = new ${decoderClassName(innerType)}(${decompVar}).decode();\n`;
  return code;
}
