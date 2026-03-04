// ABOUTME: Bit-level stream operations for encoding and decoding binary data
// ABOUTME: Supports MSB-first and LSB-first bit ordering with byte-aligned operations

use crate::{BinSchemaError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Endianness {
    BigEndian,
    LittleEndian,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BitOrder {
    MsbFirst,
    LsbFirst,
}

/// Encoder for writing bit-level data to a byte stream
pub struct BitStreamEncoder {
    buffer: Vec<u8>,
    current_byte: u8,
    bit_position: u8,
    bit_order: BitOrder,
}

impl BitStreamEncoder {
    #[inline]
    pub fn new(bit_order: BitOrder) -> Self {
        Self {
            buffer: Vec::with_capacity(64),
            current_byte: 0,
            bit_position: 0,
            bit_order,
        }
    }

    #[inline]
    pub fn with_capacity(capacity: usize, bit_order: BitOrder) -> Self {
        Self {
            buffer: Vec::with_capacity(capacity),
            current_byte: 0,
            bit_position: 0,
            bit_order,
        }
    }

    /// Reset the encoder for reuse without deallocating the internal buffer.
    #[inline]
    pub fn clear(&mut self) {
        self.buffer.clear();
        self.current_byte = 0;
        self.bit_position = 0;
    }

    /// Returns a reference to the encoded bytes so far.
    #[inline]
    pub fn buffer(&self) -> &[u8] {
        &self.buffer
    }

    #[inline]
    pub fn write_bits(&mut self, value: u64, num_bits: u8) {
        if num_bits == 0 || num_bits > 64 {
            return;
        }

        let mask = if num_bits == 64 { u64::MAX } else { (1u64 << num_bits) - 1 };
        let value = value & mask;

        // Fast path: MSB-first writes of <=8 bits that fit in current byte
        if self.bit_order == BitOrder::MsbFirst && num_bits <= 8 {
            let bits_available = 8 - self.bit_position;
            if num_bits <= bits_available {
                let shift = bits_available - num_bits;
                // Use u16 to avoid overflow when num_bits == 8
                let byte_mask = ((1u16 << num_bits) - 1) as u8;
                self.current_byte |= ((value as u8) & byte_mask) << shift;
                self.bit_position += num_bits;
                if self.bit_position == 8 {
                    self.flush_byte();
                }
                return;
            }
        }

        for i in 0..num_bits {
            let bit_index = match self.bit_order {
                BitOrder::MsbFirst => num_bits - 1 - i,
                BitOrder::LsbFirst => i,
            };
            let bit = ((value >> bit_index) & 1) as u8;

            self.write_single_bit(bit);
        }
    }

    #[inline]
    fn write_single_bit(&mut self, bit: u8) {
        let bit_index = match self.bit_order {
            BitOrder::MsbFirst => 7 - self.bit_position,
            BitOrder::LsbFirst => self.bit_position,
        };

        if bit != 0 {
            self.current_byte |= 1 << bit_index;
        }

        self.bit_position += 1;

        if self.bit_position == 8 {
            self.flush_byte();
        }
    }

    #[inline]
    fn flush_byte(&mut self) {
        self.buffer.push(self.current_byte);
        self.current_byte = 0;
        self.bit_position = 0;
    }

    #[inline]
    pub fn write_uint8(&mut self, value: u8) {
        if self.bit_position == 0 {
            // Byte-aligned: write directly (same as TypeScript fast path)
            self.buffer.push(value);
        } else {
            // Not byte-aligned: write LSB-first to match TypeScript behavior.
            // When a byte value crosses a bit boundary, the bits are written
            // starting from the LSB of the value.
            for i in 0..8u8 {
                let bit = ((value >> i) & 1) as u8;
                self.write_single_bit(bit);
            }
        }
    }

    #[inline]
    pub fn write_uint16(&mut self, value: u16, endianness: Endianness) {
        if self.bit_position == 0 {
            let bytes = match endianness {
                Endianness::BigEndian => value.to_be_bytes(),
                Endianness::LittleEndian => value.to_le_bytes(),
            };
            self.buffer.extend_from_slice(&bytes);
            return;
        }
        match endianness {
            Endianness::BigEndian => {
                self.write_uint8((value >> 8) as u8);
                self.write_uint8(value as u8);
            }
            Endianness::LittleEndian => {
                self.write_uint8(value as u8);
                self.write_uint8((value >> 8) as u8);
            }
        }
    }

    #[inline]
    pub fn write_uint32(&mut self, value: u32, endianness: Endianness) {
        if self.bit_position == 0 {
            let bytes = match endianness {
                Endianness::BigEndian => value.to_be_bytes(),
                Endianness::LittleEndian => value.to_le_bytes(),
            };
            self.buffer.extend_from_slice(&bytes);
            return;
        }
        match endianness {
            Endianness::BigEndian => {
                self.write_uint8((value >> 24) as u8);
                self.write_uint8((value >> 16) as u8);
                self.write_uint8((value >> 8) as u8);
                self.write_uint8(value as u8);
            }
            Endianness::LittleEndian => {
                self.write_uint8(value as u8);
                self.write_uint8((value >> 8) as u8);
                self.write_uint8((value >> 16) as u8);
                self.write_uint8((value >> 24) as u8);
            }
        }
    }

    #[inline]
    pub fn write_uint64(&mut self, value: u64, endianness: Endianness) {
        if self.bit_position == 0 {
            let bytes = match endianness {
                Endianness::BigEndian => value.to_be_bytes(),
                Endianness::LittleEndian => value.to_le_bytes(),
            };
            self.buffer.extend_from_slice(&bytes);
            return;
        }
        match endianness {
            Endianness::BigEndian => {
                self.write_uint32((value >> 32) as u32, endianness);
                self.write_uint32(value as u32, endianness);
            }
            Endianness::LittleEndian => {
                self.write_uint32(value as u32, endianness);
                self.write_uint32((value >> 32) as u32, endianness);
            }
        }
    }

    #[inline]
    pub fn write_int8(&mut self, value: i8) {
        self.write_uint8(value as u8);
    }

    #[inline]
    pub fn write_int16(&mut self, value: i16, endianness: Endianness) {
        self.write_uint16(value as u16, endianness);
    }

    #[inline]
    pub fn write_int32(&mut self, value: i32, endianness: Endianness) {
        self.write_uint32(value as u32, endianness);
    }

    #[inline]
    pub fn write_int64(&mut self, value: i64, endianness: Endianness) {
        self.write_uint64(value as u64, endianness);
    }

    #[inline]
    pub fn write_float32(&mut self, value: f32, endianness: Endianness) {
        self.write_uint32(value.to_bits(), endianness);
    }

    #[inline]
    pub fn write_float64(&mut self, value: f64, endianness: Endianness) {
        self.write_uint64(value.to_bits(), endianness);
    }

    // --- Byte-aligned fast-path methods ---
    // These skip the bit_position check and endianness branch.
    // The generator emits these when it can prove at code-gen time
    // that the stream is byte-aligned.

    #[inline]
    pub fn write_byte(&mut self, value: u8) {
        debug_assert_eq!(self.bit_position, 0, "write_byte called when not byte-aligned");
        self.buffer.push(value);
    }

    #[inline]
    pub fn write_u16_le(&mut self, value: u16) {
        debug_assert_eq!(self.bit_position, 0, "write_u16_le called when not byte-aligned");
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }

    #[inline]
    pub fn write_u16_be(&mut self, value: u16) {
        debug_assert_eq!(self.bit_position, 0, "write_u16_be called when not byte-aligned");
        self.buffer.extend_from_slice(&value.to_be_bytes());
    }

    #[inline]
    pub fn write_u32_le(&mut self, value: u32) {
        debug_assert_eq!(self.bit_position, 0, "write_u32_le called when not byte-aligned");
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }

    #[inline]
    pub fn write_u32_be(&mut self, value: u32) {
        debug_assert_eq!(self.bit_position, 0, "write_u32_be called when not byte-aligned");
        self.buffer.extend_from_slice(&value.to_be_bytes());
    }

    #[inline]
    pub fn write_u64_le(&mut self, value: u64) {
        debug_assert_eq!(self.bit_position, 0, "write_u64_le called when not byte-aligned");
        self.buffer.extend_from_slice(&value.to_le_bytes());
    }

    #[inline]
    pub fn write_u64_be(&mut self, value: u64) {
        debug_assert_eq!(self.bit_position, 0, "write_u64_be called when not byte-aligned");
        self.buffer.extend_from_slice(&value.to_be_bytes());
    }

    /// Write variable-length integer with specified encoding
    /// Supported encodings: "der", "leb128", "ebml", "vlq"
    #[inline]
    pub fn write_varlength(&mut self, value: u64, encoding: &str) -> Result<()> {
        match encoding {
            "der" => self.write_varlength_der(value),
            "leb128" => self.write_varlength_leb128(value),
            "ebml" => self.write_varlength_ebml(value),
            "vlq" => self.write_varlength_vlq(value),
            _ => Err(BinSchemaError::InvalidValue(format!("Unknown varlength encoding: {}", encoding))),
        }
    }

    /// DER encoding: Short form (0-127) or long form (0x80+N followed by N bytes)
    #[inline]
    fn write_varlength_der(&mut self, value: u64) -> Result<()> {
        if value < 128 {
            self.write_uint8(value as u8);
        } else {
            // Determine number of bytes needed
            let mut num_bytes = 0u8;
            let mut temp = value;
            while temp > 0 {
                num_bytes += 1;
                temp >>= 8;
            }

            // Write length-of-length byte
            self.write_uint8(0x80 | num_bytes);

            // Write value bytes in big-endian order
            for i in (0..num_bytes).rev() {
                self.write_uint8((value >> (i * 8)) as u8);
            }
        }
        Ok(())
    }

    /// LEB128 encoding: 7 bits per byte, continuation bit in MSB, little-endian
    #[inline]
    fn write_varlength_leb128(&mut self, value: u64) -> Result<()> {
        let mut val = value;
        loop {
            let mut byte = (val & 0x7F) as u8;
            val >>= 7;
            if val != 0 {
                byte |= 0x80; // Set continuation bit
            }
            self.write_uint8(byte);
            if val == 0 {
                break;
            }
        }
        Ok(())
    }

    /// EBML encoding: Leading zeros indicate width, self-synchronizing
    #[inline]
    fn write_varlength_ebml(&mut self, value: u64) -> Result<()> {
        // Determine width needed (1-8 bytes)
        // Width 1: values 0-126 (7 data bits, marker at bit 7)
        // Width 2: values 127-16382 (14 data bits, marker at bit 14)
        // etc.
        let mut width = 1u8;
        let mut max_val = (1u64 << 7) - 2; // -2 for marker bit overhead

        while value > max_val && width < 8 {
            width += 1;
            max_val = (1u64 << (width * 7)) - 2;
        }

        if value > max_val {
            return Err(BinSchemaError::InvalidValue(format!("EBML value {} too large for 8-byte encoding", value)));
        }

        // Set marker bit at position (width * 7)
        let marker_bit = 1u64 << (width * 7);
        let encoded = marker_bit | value;

        // Write bytes in big-endian order
        for i in (0..width).rev() {
            self.write_uint8((encoded >> (i * 8)) as u8);
        }
        Ok(())
    }

    /// VLQ encoding (MIDI style): 7 bits per byte, continuation bit in MSB, big-endian
    #[inline]
    fn write_varlength_vlq(&mut self, value: u64) -> Result<()> {
        if value > 0x0FFFFFFF {
            return Err(BinSchemaError::InvalidValue(format!("VLQ value {} exceeds maximum (0x0FFFFFFF)", value)));
        }

        // Collect bytes in reverse order (LSB first)
        let mut bytes = Vec::new();
        let mut remaining = value;

        // First byte (LSB) has continuation bit = 0
        bytes.push((remaining & 0x7F) as u8);
        remaining >>= 7;

        // Subsequent bytes have continuation bit = 1
        while remaining > 0 {
            bytes.push(((remaining & 0x7F) | 0x80) as u8);
            remaining >>= 7;
        }

        // Write bytes in reverse order (MSB first)
        for byte in bytes.into_iter().rev() {
            self.write_uint8(byte);
        }
        Ok(())
    }

    /// Get the current byte offset (number of complete bytes written)
    #[inline]
    pub fn byte_offset(&self) -> usize {
        self.buffer.len()
    }

    #[inline]
    pub fn finish(mut self) -> Vec<u8> {
        if self.bit_position > 0 {
            self.flush_byte();
        }
        self.buffer
    }
}

/// Decoder for reading bit-level data from a byte stream
pub struct BitStreamDecoder<'a> {
    bytes: &'a [u8],
    byte_offset: usize,
    bit_offset: u8,
    bit_order: BitOrder,
}

impl<'a> BitStreamDecoder<'a> {
    #[inline]
    pub fn new(bytes: &'a [u8], bit_order: BitOrder) -> Self {
        Self {
            bytes,
            byte_offset: 0,
            bit_offset: 0,
            bit_order,
        }
    }

    #[inline]
    pub fn read_bits(&mut self, num_bits: u8) -> Result<u64> {
        if num_bits == 0 || num_bits > 64 {
            return Err(BinSchemaError::InvalidValue("Invalid number of bits".to_string()));
        }

        // Fast path: MSB-first reads of <=8 bits
        if self.bit_order == BitOrder::MsbFirst && num_bits <= 8 {
            if self.byte_offset >= self.bytes.len() {
                return Err(BinSchemaError::UnexpectedEof);
            }
            let bits_available = 8 - self.bit_offset;
            if num_bits <= bits_available {
                // All bits from current byte — single shift+mask
                let shift = bits_available - num_bits;
                // Use u16 to avoid overflow when num_bits == 8
                let mask = ((1u16 << num_bits) - 1) as u8;
                let result = ((self.bytes[self.byte_offset] >> shift) & mask) as u64;
                self.bit_offset += num_bits;
                if self.bit_offset == 8 {
                    self.bit_offset = 0;
                    self.byte_offset += 1;
                }
                return Ok(result);
            }
            // Cross byte boundary — read from two bytes
            if self.byte_offset + 1 >= self.bytes.len() {
                return Err(BinSchemaError::UnexpectedEof);
            }
            let bits_from_first = bits_available;
            let bits_from_second = num_bits - bits_from_first;
            let mask_first = (1u8 << bits_from_first) - 1;
            let high_part = ((self.bytes[self.byte_offset] & mask_first) as u64) << bits_from_second;
            let shift = 8 - bits_from_second;
            let mask_second = (1u8 << bits_from_second) - 1;
            let low_part = ((self.bytes[self.byte_offset + 1] >> shift) & mask_second) as u64;
            self.byte_offset += 1;
            self.bit_offset = bits_from_second;
            if self.bit_offset == 8 {
                self.bit_offset = 0;
                self.byte_offset += 1;
            }
            return Ok(high_part | low_part);
        }

        let mut result = 0u64;

        for i in 0..num_bits {
            let bit = self.read_single_bit()?;
            let bit_index = match self.bit_order {
                BitOrder::MsbFirst => num_bits - 1 - i,
                BitOrder::LsbFirst => i,
            };
            result |= (bit as u64) << bit_index;
        }

        Ok(result)
    }

    #[inline]
    fn read_single_bit(&mut self) -> Result<u8> {
        if self.byte_offset >= self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }

        let bit_index = match self.bit_order {
            BitOrder::MsbFirst => 7 - self.bit_offset,
            BitOrder::LsbFirst => self.bit_offset,
        };

        let bit = (self.bytes[self.byte_offset] >> bit_index) & 1;

        self.bit_offset += 1;

        if self.bit_offset == 8 {
            self.byte_offset += 1;
            self.bit_offset = 0;
        }

        Ok(bit)
    }

    /// Reads `n` bytes as a slice, advancing the byte offset.
    /// Only valid when byte-aligned.
    #[inline]
    pub fn read_bytes_vec(&mut self, n: usize) -> Result<Vec<u8>> {
        if self.bit_offset != 0 {
            return Err(BinSchemaError::InvalidValue("read_bytes_vec requires byte alignment".to_string()));
        }
        if self.byte_offset + n > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let vec = self.bytes[self.byte_offset..self.byte_offset + n].to_vec();
        self.byte_offset += n;
        Ok(vec)
    }

    #[inline]
    pub fn read_uint8(&mut self) -> Result<u8> {
        if self.bit_offset == 0 {
            // Byte-aligned: read directly (same as TypeScript fast path)
            if self.byte_offset >= self.bytes.len() {
                return Err(BinSchemaError::UnexpectedEof);
            }
            let value = self.bytes[self.byte_offset];
            self.byte_offset += 1;
            Ok(value)
        } else {
            // Not byte-aligned: read LSB-first to match TypeScript behavior.
            // When a byte value crosses a bit boundary, the bits are read
            // starting from the LSB of the value.
            let mut value = 0u8;
            for i in 0..8u8 {
                let bit = self.read_single_bit()?;
                value |= bit << i;
            }
            Ok(value)
        }
    }

    #[inline]
    pub fn read_uint16(&mut self, endianness: Endianness) -> Result<u16> {
        if self.bit_offset == 0 {
            if self.byte_offset + 2 > self.bytes.len() {
                return Err(BinSchemaError::UnexpectedEof);
            }
            let v = match endianness {
                Endianness::BigEndian =>
                    u16::from_be_bytes([self.bytes[self.byte_offset], self.bytes[self.byte_offset + 1]]),
                Endianness::LittleEndian =>
                    u16::from_le_bytes([self.bytes[self.byte_offset], self.bytes[self.byte_offset + 1]]),
            };
            self.byte_offset += 2;
            return Ok(v);
        }
        // Not byte-aligned: fallback
        match endianness {
            Endianness::BigEndian => {
                let high = self.read_uint8()? as u16;
                let low = self.read_uint8()? as u16;
                Ok((high << 8) | low)
            }
            Endianness::LittleEndian => {
                let low = self.read_uint8()? as u16;
                let high = self.read_uint8()? as u16;
                Ok((high << 8) | low)
            }
        }
    }

    #[inline]
    pub fn read_uint32(&mut self, endianness: Endianness) -> Result<u32> {
        if self.bit_offset == 0 {
            if self.byte_offset + 4 > self.bytes.len() {
                return Err(BinSchemaError::UnexpectedEof);
            }
            let bytes: [u8; 4] = [
                self.bytes[self.byte_offset],
                self.bytes[self.byte_offset + 1],
                self.bytes[self.byte_offset + 2],
                self.bytes[self.byte_offset + 3],
            ];
            let v = match endianness {
                Endianness::BigEndian => u32::from_be_bytes(bytes),
                Endianness::LittleEndian => u32::from_le_bytes(bytes),
            };
            self.byte_offset += 4;
            return Ok(v);
        }
        // Not byte-aligned: fallback
        match endianness {
            Endianness::BigEndian => {
                let b0 = self.read_uint8()? as u32;
                let b1 = self.read_uint8()? as u32;
                let b2 = self.read_uint8()? as u32;
                let b3 = self.read_uint8()? as u32;
                Ok((b0 << 24) | (b1 << 16) | (b2 << 8) | b3)
            }
            Endianness::LittleEndian => {
                let b0 = self.read_uint8()? as u32;
                let b1 = self.read_uint8()? as u32;
                let b2 = self.read_uint8()? as u32;
                let b3 = self.read_uint8()? as u32;
                Ok((b3 << 24) | (b2 << 16) | (b1 << 8) | b0)
            }
        }
    }

    #[inline]
    pub fn read_uint64(&mut self, endianness: Endianness) -> Result<u64> {
        if self.bit_offset == 0 {
            if self.byte_offset + 8 > self.bytes.len() {
                return Err(BinSchemaError::UnexpectedEof);
            }
            let mut bytes = [0u8; 8];
            bytes.copy_from_slice(&self.bytes[self.byte_offset..self.byte_offset + 8]);
            let v = match endianness {
                Endianness::BigEndian => u64::from_be_bytes(bytes),
                Endianness::LittleEndian => u64::from_le_bytes(bytes),
            };
            self.byte_offset += 8;
            return Ok(v);
        }
        // Not byte-aligned: fallback
        match endianness {
            Endianness::BigEndian => {
                let high = self.read_uint32(endianness)? as u64;
                let low = self.read_uint32(endianness)? as u64;
                Ok((high << 32) | low)
            }
            Endianness::LittleEndian => {
                let low = self.read_uint32(endianness)? as u64;
                let high = self.read_uint32(endianness)? as u64;
                Ok((high << 32) | low)
            }
        }
    }

    #[inline]
    pub fn read_int8(&mut self) -> Result<i8> {
        Ok(self.read_uint8()? as i8)
    }

    #[inline]
    pub fn read_int16(&mut self, endianness: Endianness) -> Result<i16> {
        Ok(self.read_uint16(endianness)? as i16)
    }

    #[inline]
    pub fn read_int32(&mut self, endianness: Endianness) -> Result<i32> {
        Ok(self.read_uint32(endianness)? as i32)
    }

    #[inline]
    pub fn read_int64(&mut self, endianness: Endianness) -> Result<i64> {
        Ok(self.read_uint64(endianness)? as i64)
    }

    #[inline]
    pub fn read_float32(&mut self, endianness: Endianness) -> Result<f32> {
        Ok(f32::from_bits(self.read_uint32(endianness)?))
    }

    #[inline]
    pub fn read_float64(&mut self, endianness: Endianness) -> Result<f64> {
        Ok(f64::from_bits(self.read_uint64(endianness)?))
    }

    // --- Byte-aligned fast-path methods ---
    // These skip the bit_offset check and endianness branch.
    // The generator emits these when it can prove at code-gen time
    // that the stream is byte-aligned.

    #[inline]
    pub fn read_byte(&mut self) -> Result<u8> {
        debug_assert_eq!(self.bit_offset, 0, "read_byte called when not byte-aligned");
        if self.byte_offset >= self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let value = self.bytes[self.byte_offset];
        self.byte_offset += 1;
        Ok(value)
    }

    #[inline]
    pub fn read_u16_le(&mut self) -> Result<u16> {
        debug_assert_eq!(self.bit_offset, 0, "read_u16_le called when not byte-aligned");
        if self.byte_offset + 2 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let v = u16::from_le_bytes([self.bytes[self.byte_offset], self.bytes[self.byte_offset + 1]]);
        self.byte_offset += 2;
        Ok(v)
    }

    #[inline]
    pub fn read_u16_be(&mut self) -> Result<u16> {
        debug_assert_eq!(self.bit_offset, 0, "read_u16_be called when not byte-aligned");
        if self.byte_offset + 2 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let v = u16::from_be_bytes([self.bytes[self.byte_offset], self.bytes[self.byte_offset + 1]]);
        self.byte_offset += 2;
        Ok(v)
    }

    #[inline]
    pub fn read_u32_le(&mut self) -> Result<u32> {
        debug_assert_eq!(self.bit_offset, 0, "read_u32_le called when not byte-aligned");
        if self.byte_offset + 4 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let bytes: [u8; 4] = [
            self.bytes[self.byte_offset],
            self.bytes[self.byte_offset + 1],
            self.bytes[self.byte_offset + 2],
            self.bytes[self.byte_offset + 3],
        ];
        self.byte_offset += 4;
        Ok(u32::from_le_bytes(bytes))
    }

    #[inline]
    pub fn read_u32_be(&mut self) -> Result<u32> {
        debug_assert_eq!(self.bit_offset, 0, "read_u32_be called when not byte-aligned");
        if self.byte_offset + 4 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let bytes: [u8; 4] = [
            self.bytes[self.byte_offset],
            self.bytes[self.byte_offset + 1],
            self.bytes[self.byte_offset + 2],
            self.bytes[self.byte_offset + 3],
        ];
        self.byte_offset += 4;
        Ok(u32::from_be_bytes(bytes))
    }

    #[inline]
    pub fn read_u64_le(&mut self) -> Result<u64> {
        debug_assert_eq!(self.bit_offset, 0, "read_u64_le called when not byte-aligned");
        if self.byte_offset + 8 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&self.bytes[self.byte_offset..self.byte_offset + 8]);
        self.byte_offset += 8;
        Ok(u64::from_le_bytes(bytes))
    }

    #[inline]
    pub fn read_u64_be(&mut self) -> Result<u64> {
        debug_assert_eq!(self.bit_offset, 0, "read_u64_be called when not byte-aligned");
        if self.byte_offset + 8 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&self.bytes[self.byte_offset..self.byte_offset + 8]);
        self.byte_offset += 8;
        Ok(u64::from_be_bytes(bytes))
    }

    /// Reads a variable-length integer with specified encoding
    /// Supported encodings: "der", "leb128", "ebml", "vlq"
    #[inline]
    pub fn read_varlength(&mut self, encoding: &str) -> Result<u64> {
        match encoding {
            "der" => self.read_varlength_der(),
            "leb128" => self.read_varlength_leb128(),
            "ebml" => self.read_varlength_ebml(),
            "vlq" => self.read_varlength_vlq(),
            _ => Err(BinSchemaError::InvalidValue(format!("Unknown varlength encoding: {}", encoding))),
        }
    }

    /// DER encoding: Short form (0-127) or long form (0x80+N followed by N bytes)
    #[inline]
    fn read_varlength_der(&mut self) -> Result<u64> {
        let first = self.read_uint8()?;
        if first < 128 {
            Ok(first as u64)
        } else {
            let num_bytes = (first & 0x7F) as usize;
            if num_bytes > 8 {
                return Err(BinSchemaError::InvalidValue("DER variable length too large".to_string()));
            }
            let mut value = 0u64;
            for _ in 0..num_bytes {
                value = (value << 8) | self.read_uint8()? as u64;
            }
            Ok(value)
        }
    }

    /// LEB128 encoding: 7 bits per byte, continuation bit in MSB, little-endian
    #[inline]
    fn read_varlength_leb128(&mut self) -> Result<u64> {
        let mut result = 0u64;
        let mut shift = 0u32;

        loop {
            let byte = self.read_uint8()?;
            result |= ((byte & 0x7F) as u64) << shift;
            shift += 7;

            if shift > 64 {
                return Err(BinSchemaError::InvalidValue("LEB128 value too large".to_string()));
            }

            if (byte & 0x80) == 0 {
                break;
            }
        }
        Ok(result)
    }

    /// EBML encoding: Leading zeros indicate width, self-synchronizing
    #[inline]
    fn read_varlength_ebml(&mut self) -> Result<u64> {
        let first_byte = self.read_uint8()?;

        // Count leading zeros to determine width
        let mut width = 1u8;
        let mut mask = 0x80u8;

        while (first_byte & mask) == 0 && width < 8 {
            width += 1;
            mask >>= 1;
        }

        if width > 8 {
            return Err(BinSchemaError::InvalidValue("EBML VINT: no marker bit found".to_string()));
        }

        // Start with first byte, removing marker bit
        let mut value = (first_byte & (mask - 1)) as u64;

        // Read remaining bytes
        for _ in 1..width {
            value = (value << 8) | self.read_uint8()? as u64;
        }

        Ok(value)
    }

    /// VLQ encoding (MIDI style): 7 bits per byte, continuation bit in MSB, big-endian
    #[inline]
    fn read_varlength_vlq(&mut self) -> Result<u64> {
        let mut result = 0u64;
        let mut bytes_read = 0u8;

        loop {
            if bytes_read >= 4 {
                return Err(BinSchemaError::InvalidValue("VLQ value too large (exceeds 4 bytes)".to_string()));
            }

            let byte = self.read_uint8()?;
            bytes_read += 1;

            // Add 7 bits of data (MSB-first, so shift existing bits left)
            result = (result << 7) | (byte & 0x7F) as u64;

            // Check continuation bit
            if (byte & 0x80) == 0 {
                break;
            }
        }

        Ok(result)
    }

    /// Returns the current byte position in the stream
    #[inline]
    pub fn position(&self) -> usize {
        self.byte_offset
    }

    /// Returns the total number of bytes in the stream
    #[inline]
    pub fn bytes_len(&self) -> usize {
        self.bytes.len()
    }

    /// Seeks to a specific byte position in the stream
    /// Note: This resets the bit offset to 0
    #[inline]
    pub fn seek(&mut self, pos: usize) -> Result<()> {
        if pos > self.bytes.len() {
            return Err(BinSchemaError::InvalidValue(format!("Seek position {} is past end of data", pos)));
        }
        self.byte_offset = pos;
        self.bit_offset = 0;
        Ok(())
    }

    /// Peeks at the next byte without consuming it
    #[inline]
    pub fn peek_uint8(&self) -> Result<u8> {
        if self.byte_offset >= self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        // If we're in the middle of a byte, we can't peek properly
        if self.bit_offset != 0 {
            return Err(BinSchemaError::InvalidValue("Cannot peek when not byte-aligned".to_string()));
        }
        Ok(self.bytes[self.byte_offset])
    }

    /// Peeks at the next 2 bytes as uint16 without consuming them
    #[inline]
    pub fn peek_uint16(&self, endianness: Endianness) -> Result<u16> {
        if self.byte_offset + 2 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        if self.bit_offset != 0 {
            return Err(BinSchemaError::InvalidValue("Cannot peek when not byte-aligned".to_string()));
        }
        match endianness {
            Endianness::BigEndian => {
                let high = self.bytes[self.byte_offset] as u16;
                let low = self.bytes[self.byte_offset + 1] as u16;
                Ok((high << 8) | low)
            }
            Endianness::LittleEndian => {
                let low = self.bytes[self.byte_offset] as u16;
                let high = self.bytes[self.byte_offset + 1] as u16;
                Ok((high << 8) | low)
            }
        }
    }

    /// Peeks at the next 4 bytes as uint32 without consuming them
    #[inline]
    pub fn peek_uint32(&self, endianness: Endianness) -> Result<u32> {
        if self.byte_offset + 4 > self.bytes.len() {
            return Err(BinSchemaError::UnexpectedEof);
        }
        if self.bit_offset != 0 {
            return Err(BinSchemaError::InvalidValue("Cannot peek when not byte-aligned".to_string()));
        }
        match endianness {
            Endianness::BigEndian => {
                let b0 = self.bytes[self.byte_offset] as u32;
                let b1 = self.bytes[self.byte_offset + 1] as u32;
                let b2 = self.bytes[self.byte_offset + 2] as u32;
                let b3 = self.bytes[self.byte_offset + 3] as u32;
                Ok((b0 << 24) | (b1 << 16) | (b2 << 8) | b3)
            }
            Endianness::LittleEndian => {
                let b0 = self.bytes[self.byte_offset] as u32;
                let b1 = self.bytes[self.byte_offset + 1] as u32;
                let b2 = self.bytes[self.byte_offset + 2] as u32;
                let b3 = self.bytes[self.byte_offset + 3] as u32;
                Ok((b3 << 24) | (b2 << 16) | (b1 << 8) | b0)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uint8_roundtrip() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint8(42);
        encoder.write_uint8(255);
        encoder.write_uint8(0);

        let bytes = encoder.finish();
        let mut decoder = BitStreamDecoder::new(&bytes, BitOrder::MsbFirst);

        assert_eq!(decoder.read_uint8().unwrap(), 42);
        assert_eq!(decoder.read_uint8().unwrap(), 255);
        assert_eq!(decoder.read_uint8().unwrap(), 0);
    }

    #[test]
    fn test_uint16_big_endian() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint16(0x1234, Endianness::BigEndian);

        let bytes = encoder.finish();
        assert_eq!(bytes, vec![0x12, 0x34]);

        let mut decoder = BitStreamDecoder::new(&bytes, BitOrder::MsbFirst);
        assert_eq!(decoder.read_uint16(Endianness::BigEndian).unwrap(), 0x1234);
    }

    #[test]
    fn test_float32_special_values() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_float32(f32::INFINITY, Endianness::BigEndian);
        encoder.write_float32(f32::NEG_INFINITY, Endianness::BigEndian);

        let bytes = encoder.finish();
        let mut decoder = BitStreamDecoder::new(&bytes, BitOrder::MsbFirst);

        assert_eq!(decoder.read_float32(Endianness::BigEndian).unwrap(), f32::INFINITY);
        assert_eq!(decoder.read_float32(Endianness::BigEndian).unwrap(), f32::NEG_INFINITY);
    }

    #[test]
    fn test_encoder_with_capacity() {
        let mut encoder = BitStreamEncoder::with_capacity(16, BitOrder::MsbFirst);
        encoder.write_uint32(0x12345678, Endianness::LittleEndian);
        let bytes = encoder.finish();
        assert_eq!(bytes, vec![0x78, 0x56, 0x34, 0x12]);
    }

    #[test]
    fn test_encoder_clear() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint8(42);
        encoder.clear();
        encoder.write_uint8(99);
        let bytes = encoder.finish();
        assert_eq!(bytes, vec![99]);
    }

    #[test]
    fn test_byte_aligned_write_byte() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_byte(0x42);
        encoder.write_byte(0xFF);
        let bytes = encoder.finish();
        assert_eq!(bytes, vec![0x42, 0xFF]);

        let mut decoder = BitStreamDecoder::new(&bytes, BitOrder::MsbFirst);
        assert_eq!(decoder.read_byte().unwrap(), 0x42);
        assert_eq!(decoder.read_byte().unwrap(), 0xFF);
    }

    #[test]
    fn test_byte_aligned_u16() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_u16_le(0x1234);
        encoder.write_u16_be(0x5678);
        let bytes = encoder.finish();
        assert_eq!(bytes, vec![0x34, 0x12, 0x56, 0x78]);

        let mut decoder = BitStreamDecoder::new(&bytes, BitOrder::MsbFirst);
        assert_eq!(decoder.read_u16_le().unwrap(), 0x1234);
        assert_eq!(decoder.read_u16_be().unwrap(), 0x5678);
    }

    #[test]
    fn test_byte_aligned_u32() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_u32_le(0x12345678);
        encoder.write_u32_be(0xDEADBEEF);
        let bytes = encoder.finish();
        assert_eq!(bytes, vec![0x78, 0x56, 0x34, 0x12, 0xDE, 0xAD, 0xBE, 0xEF]);

        let mut decoder = BitStreamDecoder::new(&bytes, BitOrder::MsbFirst);
        assert_eq!(decoder.read_u32_le().unwrap(), 0x12345678);
        assert_eq!(decoder.read_u32_be().unwrap(), 0xDEADBEEF);
    }

    #[test]
    fn test_byte_aligned_u64() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_u64_le(0x0102030405060708);
        encoder.write_u64_be(0x0102030405060708);
        let bytes = encoder.finish();

        let mut decoder = BitStreamDecoder::new(&bytes, BitOrder::MsbFirst);
        assert_eq!(decoder.read_u64_le().unwrap(), 0x0102030405060708);
        assert_eq!(decoder.read_u64_be().unwrap(), 0x0102030405060708);
    }

    #[test]
    fn test_byte_aligned_matches_generic() {
        // Verify byte-aligned methods produce identical output to generic methods
        let mut enc_aligned = BitStreamEncoder::new(BitOrder::MsbFirst);
        enc_aligned.write_byte(0x42);
        enc_aligned.write_u16_le(0x1234);
        enc_aligned.write_u32_be(0xDEADBEEF);
        enc_aligned.write_u64_le(0x0102030405060708);

        let mut enc_generic = BitStreamEncoder::new(BitOrder::MsbFirst);
        enc_generic.write_uint8(0x42);
        enc_generic.write_uint16(0x1234, Endianness::LittleEndian);
        enc_generic.write_uint32(0xDEADBEEF, Endianness::BigEndian);
        enc_generic.write_uint64(0x0102030405060708, Endianness::LittleEndian);

        assert_eq!(enc_aligned.finish(), enc_generic.finish());
    }
}
