"""
BitStream - Low-level bit-level reading/writing

Handles bit-level precision for encoding/decoding.
Maintains a buffer and bit offset for streaming operations.

This is a direct port of the TypeScript runtime (src/runtime/bit-stream.ts).
"""

from __future__ import annotations
import struct
import math
from typing import Literal

Endianness = Literal["big_endian", "little_endian"]
BitOrder = Literal["msb_first", "lsb_first"]


class BitStreamEncoder:
    """Write bits to a byte stream."""

    def __init__(self, bit_order: BitOrder = "msb_first"):
        self._bytes: list[int] = []
        self._current_byte: int = 0
        self._bit_offset: int = 0  # Bits used in current_byte (0-7)
        self._total_bits_written: int = 0
        self._bit_order: BitOrder = bit_order

    def _write_bit(self, bit: int) -> None:
        if self._bit_order == "msb_first":
            self._current_byte |= (bit << (7 - self._bit_offset))
        else:
            self._current_byte |= (bit << self._bit_offset)

        self._bit_offset += 1
        self._total_bits_written += 1

        if self._bit_offset == 8:
            self._bytes.append(self._current_byte)
            self._current_byte = 0
            self._bit_offset = 0

    def write_bits(self, value: int, size: int) -> None:
        if size < 1 or size > 64:
            raise ValueError(f"Invalid bit size: {size} (must be 1-64)")

        value = value & ((1 << size) - 1)

        if self._bit_order == "lsb_first":
            for i in range(size):
                self._write_bit((value >> i) & 1)
        else:
            for i in range(size - 1, -1, -1):
                self._write_bit((value >> i) & 1)

    def write_uint8(self, value: int) -> None:
        if self._bit_offset == 0:
            self._bytes.append(value & 0xFF)
        else:
            for i in range(8):
                self._write_bit((value >> i) & 1)

    def write_uint16(self, value: int, endianness: Endianness) -> None:
        if endianness == "big_endian":
            self.write_uint8((value >> 8) & 0xFF)
            self.write_uint8(value & 0xFF)
        else:
            self.write_uint8(value & 0xFF)
            self.write_uint8((value >> 8) & 0xFF)

    def write_uint32(self, value: int, endianness: Endianness) -> None:
        if endianness == "big_endian":
            self.write_uint8((value >> 24) & 0xFF)
            self.write_uint8((value >> 16) & 0xFF)
            self.write_uint8((value >> 8) & 0xFF)
            self.write_uint8(value & 0xFF)
        else:
            self.write_uint8(value & 0xFF)
            self.write_uint8((value >> 8) & 0xFF)
            self.write_uint8((value >> 16) & 0xFF)
            self.write_uint8((value >> 24) & 0xFF)

    def write_uint64(self, value: int, endianness: Endianness) -> None:
        if endianness == "big_endian":
            for i in range(7, -1, -1):
                self.write_uint8((value >> (i * 8)) & 0xFF)
        else:
            for i in range(8):
                self.write_uint8((value >> (i * 8)) & 0xFF)

    def write_int8(self, value: int) -> None:
        unsigned = (256 + value) if value < 0 else value
        self.write_uint8(unsigned)

    def write_int16(self, value: int, endianness: Endianness) -> None:
        unsigned = (65536 + value) if value < 0 else value
        self.write_uint16(unsigned, endianness)

    def write_int32(self, value: int, endianness: Endianness) -> None:
        unsigned = (4294967296 + value) if value < 0 else value
        self.write_uint32(unsigned & 0xFFFFFFFF, endianness)

    def write_int64(self, value: int, endianness: Endianness) -> None:
        unsigned = ((1 << 64) + value) if value < 0 else value
        self.write_uint64(unsigned, endianness)

    def write_float32(self, value: float, endianness: Endianness) -> None:
        fmt = "<f" if endianness == "little_endian" else ">f"
        data = struct.pack(fmt, value)
        for b in data:
            self.write_uint8(b)

    def write_float64(self, value: float, endianness: Endianness) -> None:
        fmt = "<d" if endianness == "little_endian" else ">d"
        data = struct.pack(fmt, value)
        for b in data:
            self.write_uint8(b)

    def write_varlength_der(self, value: int) -> None:
        if value < 0:
            raise ValueError(f"DER length encoding requires non-negative value, got {value}")

        if value < 128:
            self.write_uint8(value)
        else:
            num_bytes = 0
            temp = value
            while temp > 0:
                num_bytes += 1
                temp = temp // 256

            self.write_uint8(0x80 | num_bytes)
            for i in range(num_bytes - 1, -1, -1):
                self.write_uint8((value >> (i * 8)) & 0xFF)

    def write_varlength_leb128(self, value: int) -> None:
        if value < 0:
            raise ValueError(f"LEB128 encoding requires non-negative value, got {value}")

        while True:
            byte = value & 0x7F
            value >>= 7
            if value != 0:
                byte |= 0x80
            self.write_uint8(byte)
            if value == 0:
                break

    def write_varlength_ebml(self, value: int) -> None:
        if value < 0:
            raise ValueError(f"EBML VINT encoding requires non-negative value, got {value}")

        width = 1
        max_val = (1 << 7) - 2

        while value > max_val and width < 8:
            width += 1
            max_val = (1 << (width * 7)) - 2

        if value > max_val:
            raise ValueError(f"EBML VINT value {value} too large for 8-byte encoding")

        marker_bit = 1 << (width * 7)
        encoded = marker_bit | value

        for i in range(width - 1, -1, -1):
            self.write_uint8((encoded >> (i * 8)) & 0xFF)

    def write_varlength_vlq(self, value: int) -> None:
        if value < 0:
            raise ValueError(f"VLQ encoding requires non-negative value, got {value}")
        if value > 0x0FFFFFFF:
            raise ValueError(f"VLQ value {value} exceeds maximum (0x0FFFFFFF)")

        byte_list: list[int] = []
        remaining = value

        byte_list.append(remaining & 0x7F)
        remaining >>= 7

        while remaining > 0:
            byte_list.append((remaining & 0x7F) | 0x80)
            remaining >>= 7

        for i in range(len(byte_list) - 1, -1, -1):
            self.write_uint8(byte_list[i])

    def write_bytes(self, data: bytes | bytearray | list[int]) -> None:
        for b in data:
            self.write_uint8(b)

    @property
    def byte_offset(self) -> int:
        return len(self._bytes)

    def get_byte_position(self) -> int:
        return len(self._bytes)

    def finish(self) -> bytes:
        if self._bit_offset > 0:
            self._bytes.append(self._current_byte)
            self._current_byte = 0
            self._bit_offset = 0
        return bytes(self._bytes)

    def finish_bits(self) -> list[int]:
        result_bytes = self.finish()
        bits: list[int] = []
        for byte_index in range(len(result_bytes)):
            byte = result_bytes[byte_index]
            bits_in_byte = min(8, self._total_bits_written - byte_index * 8)
            if self._bit_order == "msb_first":
                for i in range(7, 7 - bits_in_byte, -1):
                    bits.append((byte >> i) & 1)
            else:
                for i in range(bits_in_byte):
                    bits.append((byte >> i) & 1)
        return bits


class BitStreamDecoder:
    """Read bits from a byte stream."""

    MAX_POSITION_STACK_DEPTH = 128

    def __init__(self, data: bytes | bytearray | list[int], bit_order: BitOrder = "msb_first"):
        if isinstance(data, list):
            self._bytes = bytes(data)
        else:
            self._bytes = bytes(data)
        self._byte_offset: int = 0
        self._bit_offset: int = 0
        self._bit_order: BitOrder = bit_order
        self._saved_positions: list[int] = []

    def read_bit(self) -> int:
        if self._byte_offset >= len(self._bytes):
            raise RuntimeError("Unexpected end of stream")

        current_byte = self._bytes[self._byte_offset]

        if self._bit_order == "msb_first":
            bit = (current_byte >> (7 - self._bit_offset)) & 1
        else:
            bit = (current_byte >> self._bit_offset) & 1

        self._bit_offset += 1
        if self._bit_offset == 8:
            self._byte_offset += 1
            self._bit_offset = 0

        return bit

    def read_bits(self, size: int) -> int:
        if size < 1 or size > 64:
            raise ValueError(f"Invalid bit size: {size} (must be 1-64)")

        result = 0
        if self._bit_order == "lsb_first":
            for i in range(size):
                bit = self.read_bit()
                result |= (bit << i)
        else:
            for i in range(size - 1, -1, -1):
                bit = self.read_bit()
                result |= (bit << i)

        return result

    def read_uint8(self) -> int:
        if self._bit_offset == 0:
            if self._byte_offset >= len(self._bytes):
                raise RuntimeError("Unexpected end of stream")
            val = self._bytes[self._byte_offset]
            self._byte_offset += 1
            return val
        else:
            result = 0
            for i in range(8):
                bit = self.read_bit()
                result |= (bit << i)
            return result

    def read_bytes_slice(self, n: int) -> bytes:
        if self._bit_offset != 0:
            raise RuntimeError("read_bytes_slice requires byte alignment")
        if self._byte_offset + n > len(self._bytes):
            raise RuntimeError("Unexpected end of stream")
        result = self._bytes[self._byte_offset:self._byte_offset + n]
        self._byte_offset += n
        return result

    def read_uint16(self, endianness: Endianness) -> int:
        if self._bit_offset == 0 and self._byte_offset + 2 <= len(self._bytes):
            b0 = self._bytes[self._byte_offset]
            b1 = self._bytes[self._byte_offset + 1]
            self._byte_offset += 2
            if endianness == "big_endian":
                return (b0 << 8) | b1
            else:
                return b0 | (b1 << 8)
        if endianness == "big_endian":
            high = self.read_uint8()
            low = self.read_uint8()
            return (high << 8) | low
        else:
            low = self.read_uint8()
            high = self.read_uint8()
            return (high << 8) | low

    def read_uint32(self, endianness: Endianness) -> int:
        if self._bit_offset == 0 and self._byte_offset + 4 <= len(self._bytes):
            b = self._bytes[self._byte_offset:self._byte_offset + 4]
            self._byte_offset += 4
            if endianness == "big_endian":
                return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]
            else:
                return b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)
        if endianness == "big_endian":
            b0 = self.read_uint8()
            b1 = self.read_uint8()
            b2 = self.read_uint8()
            b3 = self.read_uint8()
            return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
        else:
            b0 = self.read_uint8()
            b1 = self.read_uint8()
            b2 = self.read_uint8()
            b3 = self.read_uint8()
            return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0

    def read_uint64(self, endianness: Endianness) -> int:
        if endianness == "big_endian":
            result = 0
            for i in range(8):
                result = (result << 8) | self.read_uint8()
            return result
        else:
            result = 0
            for i in range(8):
                result |= (self.read_uint8() << (i * 8))
            return result

    def read_int8(self) -> int:
        unsigned = self.read_uint8()
        return unsigned - 256 if unsigned > 127 else unsigned

    def read_int16(self, endianness: Endianness) -> int:
        unsigned = self.read_uint16(endianness)
        return unsigned - 65536 if unsigned > 32767 else unsigned

    def read_int32(self, endianness: Endianness) -> int:
        unsigned = self.read_uint32(endianness)
        return unsigned - 4294967296 if unsigned > 2147483647 else unsigned

    def read_int64(self, endianness: Endianness) -> int:
        unsigned = self.read_uint64(endianness)
        max_val = 1 << 63
        return unsigned - (1 << 64) if unsigned >= max_val else unsigned

    def read_float32(self, endianness: Endianness) -> float:
        data = bytes([self.read_uint8() for _ in range(4)])
        fmt = "<f" if endianness == "little_endian" else ">f"
        return struct.unpack(fmt, data)[0]

    def read_float64(self, endianness: Endianness) -> float:
        data = bytes([self.read_uint8() for _ in range(8)])
        fmt = "<d" if endianness == "little_endian" else ">d"
        return struct.unpack(fmt, data)[0]

    def read_varlength_der(self) -> int:
        first_byte = self.read_uint8()
        if first_byte < 0x80:
            return first_byte

        num_bytes = first_byte & 0x7F
        if num_bytes == 0:
            raise RuntimeError("DER indefinite length (0x80) not supported")
        if num_bytes > 4:
            raise RuntimeError(f"DER length too large: {num_bytes} bytes (max 4 supported)")

        value = 0
        for _ in range(num_bytes):
            value = (value << 8) | self.read_uint8()
        return value

    def read_varlength_leb128(self) -> int:
        result = 0
        shift = 0
        while True:
            byte = self.read_uint8()
            result |= (byte & 0x7F) << shift
            shift += 7
            if (byte & 0x80) == 0:
                break
            if shift > 64:
                raise RuntimeError("LEB128 value too large (exceeds 64 bits)")
        return result

    def read_varlength_ebml(self) -> int:
        first_byte = self.read_uint8()
        width = 1
        mask = 0x80
        while width <= 8 and (first_byte & mask) == 0:
            width += 1
            mask >>= 1
        if width > 8:
            raise RuntimeError("EBML VINT: no marker bit found in first byte")

        value = first_byte & (mask - 1)
        for _ in range(1, width):
            value = (value << 8) | self.read_uint8()
        return value

    def read_varlength_vlq(self) -> int:
        result = 0
        bytes_read = 0
        while True:
            if bytes_read >= 4:
                raise RuntimeError("VLQ value too large (exceeds 4 bytes)")
            byte = self.read_uint8()
            bytes_read += 1
            result = (result << 7) | (byte & 0x7F)
            if (byte & 0x80) == 0:
                break
        return result

    @property
    def position(self) -> int:
        return self._byte_offset

    def seek(self, offset: int) -> None:
        if offset < 0 or offset > len(self._bytes):
            raise RuntimeError(f"Seek offset {offset} out of bounds (valid range: 0-{len(self._bytes)})")
        self._byte_offset = offset
        self._bit_offset = 0

    def push_position(self) -> None:
        if len(self._saved_positions) >= self.MAX_POSITION_STACK_DEPTH:
            raise RuntimeError(f"Position stack overflow: maximum depth of {self.MAX_POSITION_STACK_DEPTH} exceeded")
        self._saved_positions.append(self._byte_offset)

    def pop_position(self) -> None:
        if not self._saved_positions:
            raise RuntimeError("Position stack underflow: attempted to pop from empty stack")
        saved = self._saved_positions.pop()
        self._byte_offset = saved
        self._bit_offset = 0

    def peek_uint8(self) -> int:
        if self._bit_offset != 0:
            raise RuntimeError(f"Peek not byte-aligned: bit offset is {self._bit_offset} (must be 0)")
        if self._byte_offset >= len(self._bytes):
            raise RuntimeError(f"Peek out of bounds at offset {self._byte_offset} (buffer size: {len(self._bytes)})")
        return self._bytes[self._byte_offset]

    def peek_uint16(self, endianness: Endianness) -> int:
        if self._bit_offset != 0:
            raise RuntimeError(f"Peek not byte-aligned: bit offset is {self._bit_offset} (must be 0)")
        if self._byte_offset + 2 > len(self._bytes):
            raise RuntimeError(f"Peek out of bounds at offset {self._byte_offset} (buffer size: {len(self._bytes)})")
        b0 = self._bytes[self._byte_offset]
        b1 = self._bytes[self._byte_offset + 1]
        if endianness == "big_endian":
            return (b0 << 8) | b1
        else:
            return b0 | (b1 << 8)

    def peek_uint32(self, endianness: Endianness) -> int:
        if self._bit_offset != 0:
            raise RuntimeError(f"Peek not byte-aligned: bit offset is {self._bit_offset} (must be 0)")
        if self._byte_offset + 4 > len(self._bytes):
            raise RuntimeError(f"Peek out of bounds at offset {self._byte_offset} (buffer size: {len(self._bytes)})")
        b = self._bytes[self._byte_offset:self._byte_offset + 4]
        if endianness == "big_endian":
            return (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]
        else:
            return b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)

    def has_more(self) -> bool:
        return self._byte_offset < len(self._bytes) or self._bit_offset > 0


class SeekableBitStreamDecoder(BitStreamDecoder):
    """BitStreamDecoder with random-access support.

    In Python, this is identical to BitStreamDecoder since we always
    have the full buffer. This class exists for API compatibility with
    generated code that references SeekableBitStreamDecoder.
    """
    pass
