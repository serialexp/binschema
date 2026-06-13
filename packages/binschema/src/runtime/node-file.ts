// ABOUTME: Node-only file-path helpers for the binary runtime.
// ABOUTME: Kept off the core decode import path so browser bundles stay fs-free.

// This module is the ONLY runtime file that references Node's `fs`. It is never
// imported by generated decoders (which only need `decode(Uint8Array)` and the
// seekable decoder built from a Uint8Array), so browser bundlers and
// browser-targeted `tsc` never pull it in. Node consumers that want to read
// directly from a file path import these helpers explicitly.

import * as fs from "node:fs";
import { FileHandleReader, BinaryReader } from "./binary-reader.js";
import { SeekableBitStreamDecoder } from "./seekable-bit-stream.js";
import { BitOrder } from "./bit-stream.js";
import { BinSchemaError, ErrorCode } from "./errors.js";

/**
 * Synchronously open a file path as a seekable {@link FileHandleReader} (Node only).
 */
export function openFileSync(path: string): FileHandleReader {
  const fileDescriptor = fs.openSync(path, "r");
  const stats = fs.fstatSync(fileDescriptor);
  return new FileHandleReader(
    {
      readSync: (buffer: Uint8Array, offset: number, length: number, position: number) => {
        const bytesRead = fs.readSync(fileDescriptor, buffer, offset, length, position);
        return { bytesRead };
      },
      closeSync: () => fs.closeSync(fileDescriptor),
    },
    stats.size
  );
}

/**
 * Asynchronously open a file path as a seekable {@link FileHandleReader} (Node only).
 */
export async function openFile(path: string): Promise<FileHandleReader> {
  const handle = await fs.promises.open(path, "r");
  const stats = await handle.stat();
  return new FileHandleReader(handle, stats.size);
}

/**
 * Create a {@link SeekableBitStreamDecoder} backed by a file path (Node only).
 *
 * Uses positional reads so large files are not loaded into memory up front.
 * Throws {@link BinSchemaError} with {@link ErrorCode.INVALID_VALUE} if the file
 * cannot be opened.
 */
export function seekableDecoderFromFile(
  path: string,
  bitOrder: BitOrder = "msb_first"
): SeekableBitStreamDecoder {
  try {
    const fd = fs.openSync(path, "r");
    const stats = fs.fstatSync(fd);

    const reader: BinaryReader = {
      size: stats.size,
      seekable: true,
      readAt: (position: number, length: number): Uint8Array => {
        const buffer = new Uint8Array(length);
        const actualPos = position < 0 ? stats.size + position : position;
        fs.readSync(fd, buffer, 0, length, actualPos);
        return buffer;
      },
      readByteAt: (position: number): number => {
        const buffer = new Uint8Array(1);
        const actualPos = position < 0 ? stats.size + position : position;
        fs.readSync(fd, buffer, 0, 1, actualPos);
        return buffer[0];
      },
      slice: (start: number, end?: number): Uint8Array => {
        const actualEnd = end ?? stats.size;
        const length = actualEnd - start;
        const buffer = new Uint8Array(length);
        fs.readSync(fd, buffer, 0, length, start);
        return buffer;
      },
      close: () => fs.closeSync(fd),
    };

    return new SeekableBitStreamDecoder(reader, bitOrder);
  } catch (e: any) {
    throw new BinSchemaError(
      ErrorCode.INVALID_VALUE,
      "Failed to open file: " + path + ". " + e.message,
      { cause: e }
    );
  }
}
