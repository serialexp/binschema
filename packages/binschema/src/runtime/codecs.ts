/**
 * Codec registry for `compressed` regions.
 *
 * A `compressed` field serializes its inner type to a buffer, runs it through
 * a named codec, and frames the result. Codecs are resolved by name from a
 * module-level registry:
 *
 *   - `store`   — identity passthrough (no compression). Always available.
 *   - `deflate` — raw DEFLATE (RFC 1951), via the vendored fflate.
 *   - `gzip`    — gzip container (RFC 1952), via the vendored fflate.
 *
 * The registry is pluggable: register additional codecs (zstd, lz4, snappy, …)
 * with `registerCodec(name, codec)` before encoding/decoding. Generated code
 * calls `resolveCodec(name)`; an unknown name throws so the failure is loud
 * rather than silently producing wrong bytes.
 */

import { deflateSync, inflateSync, gzipSync, gunzipSync } from "./fflate.js";
import { BinSchemaError, ErrorCode } from "./errors.js";

/**
 * A codec transforms a byte buffer in both directions.
 *
 * `decompress` receives the optional `expectedSize` (the decoded
 * `uncompressed_size` framing field) so implementations can pre-allocate the
 * exact output buffer. It is advisory; codecs may ignore it.
 */
export interface Codec {
  compress(data: Uint8Array): Uint8Array;
  decompress(data: Uint8Array, expectedSize?: number): Uint8Array;
}

const STORE_CODEC: Codec = {
  compress: (data) => data,
  decompress: (data) => data,
};

const DEFLATE_CODEC: Codec = {
  compress: (data) => deflateSync(data),
  decompress: (data) => inflateSync(data),
};

const GZIP_CODEC: Codec = {
  compress: (data) => gzipSync(data),
  decompress: (data) => gunzipSync(data),
};

const registry = new Map<string, Codec>([
  ["store", STORE_CODEC],
  ["deflate", DEFLATE_CODEC],
  ["gzip", GZIP_CODEC],
]);

/**
 * Register (or override) a codec by name. Use for codecs that aren't built in
 * (e.g. zstd/lz4/snappy) by wrapping the library of your choice.
 */
export function registerCodec(name: string, codec: Codec): void {
  registry.set(name, codec);
}

/**
 * Resolve a codec by name. Throws BinSchemaError(INVALID_ENCODING) if the name
 * isn't a built-in and hasn't been registered.
 */
export function resolveCodec(name: string): Codec {
  const codec = registry.get(name);
  if (!codec) {
    throw new BinSchemaError(
      ErrorCode.INVALID_ENCODING,
      `No codec registered for '${name}'. Built-in codecs: store, deflate, gzip. Register custom codecs with registerCodec('${name}', …).`,
      { context: `codec:${name}` }
    );
  }
  return codec;
}
