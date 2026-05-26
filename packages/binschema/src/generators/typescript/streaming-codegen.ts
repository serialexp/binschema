/**
 * Streaming codegen for TypeScript.
 *
 * Detects "stream-eligible" types and emits async generator wrappers around
 * the runtime streaming primitives (`decodeArrayStream` /
 * `decodeArrayGreedy`). The synchronous per-type `{TypeName}Decoder` class
 * remains the source of truth for item decoding; the streaming wrapper just
 * routes a `ReadableStreamDefaultReader<Uint8Array>` through the runtime
 * primitive and instantiates a fresh decoder for each item.
 *
 * Stream eligibility: a struct whose `sequence` has **exactly one field**,
 * that field is an `array`, and the array kind is either `length_prefixed`
 * or `length_prefixed_items`. The item type must be either a fixed-size
 * primitive (inlined read) or a named user-defined type that has its own
 * generated `{TypeName}Decoder` class (slice-based per-item decode).
 *
 * The generated function name is `decode{TypeName}Stream` for both kinds —
 * the underlying primitive differs (greedy vs per-item-length) but the
 * caller-facing async generator shape is identical.
 */
import { BinarySchema, Endianness, TypeDef } from "../../schema/binary-schema.js";
import { sanitizeTypeName } from "./type-utils.js";
import { getTypeFields } from "./type-utils.js";

const PRIMITIVE_READ: Record<string, (endianness: Endianness) => string> = {
  uint8: () => `d.readUint8()`,
  int8: () => `d.readInt8()`,
  uint16: (e) => `d.readUint16("${e}")`,
  int16: (e) => `d.readInt16("${e}")`,
  uint32: (e) => `d.readUint32("${e}")`,
  int32: (e) => `d.readInt32("${e}")`,
  uint64: (e) => `Number(d.readUint64("${e}"))`,
  int64: (e) => `Number(d.readInt64("${e}"))`,
  float32: (e) => `d.readFloat32("${e}")`,
  float64: (e) => `d.readFloat64("${e}")`,
};

const PRIMITIVE_TS_TYPE: Record<string, string> = {
  uint8: "number",
  int8: "number",
  uint16: "number",
  int16: "number",
  uint32: "number",
  int32: "number",
  uint64: "number",
  int64: "number",
  float32: "number",
  float64: "number",
};

interface StreamEligibleInfo {
  /** The wrapper type itself (e.g. `MessageArray`). */
  wrapperTypeName: string;
  /** Name of the single array field on the wrapper (e.g. `messages`). */
  arrayFieldName: string;
  /** Array kind — drives which runtime primitive to call. */
  arrayKind: "length_prefixed" | "length_prefixed_items";
  /** Length-prefix type (uint8/uint16/uint32). */
  lengthType: "uint8" | "uint16" | "uint32";
  /**
   * Item-length-prefix type (only for `length_prefixed_items`).
   */
  itemLengthType?: "uint8" | "uint16" | "uint32";
  /** What's inside the array. */
  itemKind: "primitive" | "named";
  /** Original primitive name, e.g. `uint32`. */
  itemPrimitive?: string;
  /** Named struct type. */
  itemTypeName?: string;
}

function isSupportedLengthType(t: string | undefined): t is "uint8" | "uint16" | "uint32" {
  return t === "uint8" || t === "uint16" || t === "uint32";
}

/**
 * Detect whether a top-level type is stream-eligible. Returns the metadata
 * needed to emit a streaming wrapper, or `null` if it's not eligible.
 *
 * Eligibility rules (intentionally narrow for v1):
 *
 * 1. The type is a struct with `sequence` containing exactly one field.
 * 2. The field's type is `array` with kind `length_prefixed` or
 *    `length_prefixed_items`.
 * 3. The length prefix is uint8/uint16/uint32.
 * 4. The item type is either:
 *    - A fixed-size primitive (uint8/16/32/64, int8/16/32/64, float32/64), OR
 *    - A reference to a named user-defined type (e.g. `{ type: "Message" }`).
 *
 * Returns `null` for everything else — including arrays with `field_referenced`,
 * `fixed`, terminator-based kinds, or items that are inline composites,
 * discriminated unions, optionals, etc. Callers can grow the eligibility
 * envelope later; v1 keeps it small so generated code is easy to audit.
 */
export function detectStreamEligible(
  typeName: string,
  typeDef: TypeDef,
  schema: BinarySchema
): StreamEligibleInfo | null {
  const typeDefAny = typeDef as any;
  // Must be a struct (no `type` discriminator at the top level).
  if (typeDefAny.type !== undefined) return null;
  const fields = getTypeFields(typeDef);
  if (fields.length !== 1) return null;
  const field = fields[0] as any;
  if (field.type !== "array") return null;
  if (field.kind !== "length_prefixed" && field.kind !== "length_prefixed_items") {
    return null;
  }
  if (!isSupportedLengthType(field.length_type)) return null;
  if (field.kind === "length_prefixed_items" && !isSupportedLengthType(field.item_length_type)) {
    return null;
  }

  const items = field.items;
  if (!items || typeof items.type !== "string") return null;
  const itemType = items.type;
  if (itemType in PRIMITIVE_READ) {
    return {
      wrapperTypeName: typeName,
      arrayFieldName: field.name,
      arrayKind: field.kind,
      lengthType: field.length_type,
      itemLengthType: field.item_length_type,
      itemKind: "primitive",
      itemPrimitive: itemType,
    };
  }

  // Named type reference. Must exist in schema as a struct (i.e. have its
  // own generated Decoder class). Skip generic templates with angle brackets.
  if (itemType.includes("<")) return null;
  const referenced = schema.types?.[itemType];
  if (!referenced) return null;
  const referencedAny = referenced as any;
  // Primitive type aliases also don't get standalone Decoders we can call —
  // but a struct does. Reject `type: "string"`, `type: "array"`, etc. at the
  // top level for the referenced type.
  if (
    referencedAny.type === "string" ||
    referencedAny.type === "array" ||
    referencedAny.type === "bit" ||
    referencedAny.type === "bitfield"
  ) {
    return null;
  }
  return {
    wrapperTypeName: typeName,
    arrayFieldName: field.name,
    arrayKind: field.kind,
    lengthType: field.length_type,
    itemLengthType: field.item_length_type,
    itemKind: "named",
    itemTypeName: itemType,
  };
}

/**
 * Emit the streaming wrapper for a stream-eligible type.
 *
 * The generated function:
 *
 * ```ts
 * export async function* decode{TypeName}Stream(
 *   reader: ReadableStreamDefaultReader<Uint8Array>,
 * ): AsyncGenerator<{ItemTsType}, void, void> {
 *   yield* decodeArrayStream(reader, {  // or decodeArrayGreedy
 *     arrayLengthType: "{lengthType}",
 *     itemLengthType: "{itemLengthType}",  // only for length_prefixed_items
 *     endianness: "{globalEndianness}",
 *     decodeItem: (d) => { ... },
 *   });
 * }
 * ```
 *
 * For named-struct items the per-item decoder is constructed over a slice of
 * the streaming buffer at `d.bytes.subarray(d.position)`, then the
 * synchronous decoder's consumed length is propagated back to the outer
 * decoder via `d.seek(d.position + inner.position)`. This lets the streaming
 * layer's existing position-tracking logic (`endByte` / `endBit`) work
 * unmodified.
 */
export function generateStreamingWrapper(
  info: StreamEligibleInfo,
  globalEndianness: Endianness
): string {
  const sanitized = sanitizeTypeName(info.wrapperTypeName);
  const fnName = `decode${sanitized}Stream`;
  const itemTsType = info.itemKind === "primitive"
    ? PRIMITIVE_TS_TYPE[info.itemPrimitive!]
    : sanitizeTypeName(info.itemTypeName!);

  // Build the decodeItem lambda body.
  let decodeItem: string;
  if (info.itemKind === "primitive") {
    const read = PRIMITIVE_READ[info.itemPrimitive!](globalEndianness);
    decodeItem = `(d) => ${read}`;
  } else {
    // Named struct: instantiate the per-item decoder over the slice starting
    // at the outer decoder's current position, then advance the outer
    // decoder by the number of bytes the inner decoder consumed.
    const itemDecoder = `${sanitizeTypeName(info.itemTypeName!)}Decoder`;
    decodeItem = [
      `(d) => {`,
      `      const inner = new ${itemDecoder}(d.bytes.subarray(d.position));`,
      `      const value = inner.decode();`,
      `      d.seek(d.position + inner.position);`,
      `      return value;`,
      `    }`,
    ].join("\n");
  }

  const primitiveFn = info.arrayKind === "length_prefixed_items"
    ? "decodeArrayStream"
    : "decodeArrayGreedy";

  const optionLines: string[] = [];
  optionLines.push(`    arrayLengthType: "${info.lengthType}"`);
  if (info.arrayKind === "length_prefixed_items") {
    optionLines.push(`    itemLengthType: "${info.itemLengthType}"`);
  }
  optionLines.push(`    endianness: "${globalEndianness}"`);
  optionLines.push(`    decodeItem: ${decodeItem}`);

  let code = "";
  code += `/**\n`;
  code += ` * Stream-decode \`${sanitized}\`'s \`${info.arrayFieldName}\` array.\n`;
  code += ` *\n`;
  code += ` * Yields one item at a time as bytes arrive on the reader. Backpressure is\n`;
  code += ` * natural — the underlying ReadableStream only advances when the consumer\n`;
  code += ` * pulls the next item.\n`;
  code += ` *\n`;
  if (info.arrayKind === "length_prefixed_items") {
    code += ` * Uses the per-item length prefix from the wire format to slice each\n`;
    code += ` * item before decoding; safe against partial items at chunk boundaries.\n`;
  } else {
    code += ` * Uses speculative retry-on-INCOMPLETE_DATA: each item is attempted against\n`;
    code += ` * the current buffer; if too short, another chunk is pulled and the item is\n`;
    code += ` * retried from the same position. Works for variable-length items.\n`;
  }
  code += ` */\n`;
  code += `export async function* ${fnName}(\n`;
  code += `  reader: ReadableStreamDefaultReader<Uint8Array>,\n`;
  code += `): AsyncGenerator<${itemTsType}, void, void> {\n`;
  code += `  yield* ${primitiveFn}(reader, {\n`;
  code += optionLines.join(",\n") + ",\n";
  code += `  });\n`;
  code += `}\n`;
  return code;
}

/**
 * Top-level entry point: scan a schema and emit streaming wrappers for every
 * stream-eligible type. Returns an empty string when nothing matches.
 *
 * Also returns the set of stream-decoder primitives that need to be imported
 * — callers should prepend the appropriate `import { ... } from
 * "./stream-decoder.js"` statement.
 */
export function generateStreamingWrappers(
  schema: BinarySchema,
  globalEndianness: Endianness
): { code: string; usedPrimitives: Set<"decodeArrayStream" | "decodeArrayGreedy"> } {
  const usedPrimitives = new Set<"decodeArrayStream" | "decodeArrayGreedy">();
  const blocks: string[] = [];
  for (const [typeName, typeDef] of Object.entries(schema.types)) {
    if (typeName.includes("<")) continue;
    const info = detectStreamEligible(typeName, typeDef as TypeDef, schema);
    if (!info) continue;
    if (info.arrayKind === "length_prefixed_items") {
      usedPrimitives.add("decodeArrayStream");
    } else {
      usedPrimitives.add("decodeArrayGreedy");
    }
    blocks.push(generateStreamingWrapper(info, globalEndianness));
  }
  return { code: blocks.join("\n"), usedPrimitives };
}
