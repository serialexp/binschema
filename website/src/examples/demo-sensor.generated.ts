import { BitStreamEncoder, Endianness } from "./bit-stream.js";
import { SeekableBitStreamDecoder } from "./seekable-bit-stream.js";
import { createReader } from "./binary-reader.js";
import { crc32 } from "./crc32.js";
import { evaluateExpression } from "./expression-evaluator.js";

function __bs_get<T>(expr: () => T): T | undefined {
  try {
    return expr();
  } catch {
    return undefined;
  }
}

function __bs_numeric(value: any): any {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }
  return value;
}

function __bs_literal(value: number): number | bigint {
  if (Number.isInteger(value)) {
    return BigInt(value);
  }
  return value;
}

function __bs_checkCondition(expr: () => any): boolean {
  try {
    const result = expr();
    if (typeof result === "bigint") {
      return result !== 0n;
    }
    return !!result;
  } catch {
    return false;
  }
}

export interface SensorReadingInput {
  /**
   * 16-bit Unsigned Integer
   * Fixed-width 16-bit unsigned integer (0-65535). Respects endianness configuration (big-endian or little-endian).
   */
  device_id: number;
  /**
   * 32-bit Floating Point
   * IEEE 754 single-precision floating point (32-bit). Provides ~7 decimal digits of precision.
   */
  temperature: number;
  /**
   * 8-bit Unsigned Integer
   * Fixed-width 8-bit unsigned integer (0-255). Single byte, no endianness concerns.
   */
  humidity: number;
  /**
   * 32-bit Unsigned Integer
   * Fixed-width 32-bit unsigned integer (0-4294967295). Respects endianness configuration.
   */
  timestamp: number;
}

export interface SensorReadingOutput {
  /**
   * 16-bit Unsigned Integer
   * Fixed-width 16-bit unsigned integer (0-65535). Respects endianness configuration (big-endian or little-endian).
   */
  device_id: number;
  /**
   * 32-bit Floating Point
   * IEEE 754 single-precision floating point (32-bit). Provides ~7 decimal digits of precision.
   */
  temperature: number;
  /**
   * 8-bit Unsigned Integer
   * Fixed-width 8-bit unsigned integer (0-255). Single byte, no endianness concerns.
   */
  humidity: number;
  /**
   * 32-bit Unsigned Integer
   * Fixed-width 32-bit unsigned integer (0-4294967295). Respects endianness configuration.
   */
  timestamp: number;
}

export type SensorReading = SensorReadingOutput;

export class SensorReadingEncoder extends BitStreamEncoder {
  private compressionDict: Map<string, number> = new Map();

  constructor() {
    super("msb_first");
  }

  encode(value: SensorReadingInput): Uint8Array {
    // Reset compression dictionary for each encode
    this.compressionDict.clear();

    const device_id_startPos_1771034087369_zi1t2msza = this.byteOffset;
    this.logFieldStart("device_id", "    ");
    this.writeUint16(value.device_id, "big_endian");
    this.logFieldEnd("device_id", device_id_startPos_1771034087369_zi1t2msza, "    ");
    const temperature_startPos_1771034087369_bimsqr7ao = this.byteOffset;
    this.logFieldStart("temperature", "    ");
    this.writeFloat32(value.temperature, "big_endian");
    this.logFieldEnd("temperature", temperature_startPos_1771034087369_bimsqr7ao, "    ");
    const humidity_startPos_1771034087369_j4w1ll0qh = this.byteOffset;
    this.logFieldStart("humidity", "    ");
    this.writeUint8(value.humidity);
    this.logFieldEnd("humidity", humidity_startPos_1771034087369_j4w1ll0qh, "    ");
    const timestamp_startPos_1771034087369_kiert81tx = this.byteOffset;
    this.logFieldStart("timestamp", "    ");
    this.writeUint32(value.timestamp, "big_endian");
    this.logFieldEnd("timestamp", timestamp_startPos_1771034087369_kiert81tx, "    ");
    return this.finish();
  }

  /**
   * Calculate the encoded size of a SensorReading value.
   * Used for from_after_field computed lengths and buffer pre-allocation.
   */
  calculateSize(value: SensorReading): number {
    let size = 0;
    size += 2; // device_id
    size += 4; // temperature
    size += 1; // humidity
    size += 4; // timestamp
    return size;
  }
}

export class SensorReadingDecoder extends SeekableBitStreamDecoder {
  constructor(input: Uint8Array | number[] | string, private context?: any) {
    const reader = createReader(input);
    super(reader, "msb_first");
  }

  decode(): SensorReadingOutput {
    const value: any = {};

    value.device_id = this.readUint16("big_endian");
    value.temperature = this.readFloat32("big_endian");
    value.humidity = this.readUint8();
    value.timestamp = this.readUint32("big_endian");
    return value;
  }
}

