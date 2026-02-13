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
    pub fn new(bit_order: BitOrder) -> Self {
        Self {
            buffer: Vec::new(),
            current_byte: 0,
            bit_position: 0,
            bit_order,
        }
    }

    pub fn write_bits(&mut self, value: u64, num_bits: u8) {
        if num_bits == 0 || num_bits > 64 {
            return;
        }

        let mask = if num_bits == 64 { u64::MAX } else { (1u64 << num_bits) - 1 };
        let value = value & mask;

        for i in 0..num_bits {
            let bit_index = match self.bit_order {
                BitOrder::MsbFirst => num_bits - 1 - i,
                BitOrder::LsbFirst => i,
            };
            let bit = ((value >> bit_index) & 1) as u8;

            self.write_single_bit(bit);
        }
    }

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

    fn flush_byte(&mut self) {
        self.buffer.push(self.current_byte);
        self.current_byte = 0;
        self.bit_position = 0;
    }

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

    pub fn write_uint16(&mut self, value: u16, endianness: Endianness) {
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

    pub fn write_uint32(&mut self, value: u32, endianness: Endianness) {
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

    pub fn write_uint64(&mut self, value: u64, endianness: Endianness) {
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

    pub fn write_int8(&mut self, value: i8) {
        self.write_uint8(value as u8);
    }

    pub fn write_int16(&mut self, value: i16, endianness: Endianness) {
        self.write_uint16(value as u16, endianness);
    }

    pub fn write_int32(&mut self, value: i32, endianness: Endianness) {
        self.write_uint32(value as u32, endianness);
    }

    pub fn write_int64(&mut self, value: i64, endianness: Endianness) {
        self.write_uint64(value as u64, endianness);
    }

    pub fn write_float32(&mut self, value: f32, endianness: Endianness) {
        self.write_uint32(value.to_bits(), endianness);
    }

    pub fn write_float64(&mut self, value: f64, endianness: Endianness) {
        self.write_uint64(value.to_bits(), endianness);
    }

    /// Write variable-length integer with specified encoding
    /// Supported encodings: "der", "leb128", "ebml", "vlq"
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
    pub fn byte_offset(&self) -> usize {
        self.buffer.len()
    }

    pub fn finish(mut self) -> Vec<u8> {
        if self.bit_position > 0 {
            self.flush_byte();
        }
        self.buffer
    }
}

/// Decoder for reading bit-level data from a byte stream
pub struct BitStreamDecoder {
    bytes: Vec<u8>,
    byte_offset: usize,
    bit_offset: u8,
    bit_order: BitOrder,
}

impl BitStreamDecoder {
    pub fn new(bytes: Vec<u8>, bit_order: BitOrder) -> Self {
        Self {
            bytes,
            byte_offset: 0,
            bit_offset: 0,
            bit_order,
        }
    }

    pub fn read_bits(&mut self, num_bits: u8) -> Result<u64> {
        if num_bits == 0 || num_bits > 64 {
            return Err(BinSchemaError::InvalidValue("Invalid number of bits".to_string()));
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

    pub fn read_uint16(&mut self, endianness: Endianness) -> Result<u16> {
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

    pub fn read_uint32(&mut self, endianness: Endianness) -> Result<u32> {
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

    pub fn read_uint64(&mut self, endianness: Endianness) -> Result<u64> {
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

    pub fn read_int8(&mut self) -> Result<i8> {
        Ok(self.read_uint8()? as i8)
    }

    pub fn read_int16(&mut self, endianness: Endianness) -> Result<i16> {
        Ok(self.read_uint16(endianness)? as i16)
    }

    pub fn read_int32(&mut self, endianness: Endianness) -> Result<i32> {
        Ok(self.read_uint32(endianness)? as i32)
    }

    pub fn read_int64(&mut self, endianness: Endianness) -> Result<i64> {
        Ok(self.read_uint64(endianness)? as i64)
    }

    pub fn read_float32(&mut self, endianness: Endianness) -> Result<f32> {
        Ok(f32::from_bits(self.read_uint32(endianness)?))
    }

    pub fn read_float64(&mut self, endianness: Endianness) -> Result<f64> {
        Ok(f64::from_bits(self.read_uint64(endianness)?))
    }

    /// Reads a variable-length integer with specified encoding
    /// Supported encodings: "der", "leb128", "ebml", "vlq"
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
    pub fn position(&self) -> usize {
        self.byte_offset
    }

    /// Returns the total number of bytes in the stream
    pub fn bytes_len(&self) -> usize {
        self.bytes.len()
    }

    /// Seeks to a specific byte position in the stream
    /// Note: This resets the bit offset to 0
    pub fn seek(&mut self, pos: usize) -> Result<()> {
        if pos > self.bytes.len() {
            return Err(BinSchemaError::InvalidValue(format!("Seek position {} is past end of data", pos)));
        }
        self.byte_offset = pos;
        self.bit_offset = 0;
        Ok(())
    }

    /// Peeks at the next byte without consuming it
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
        let mut decoder = BitStreamDecoder::new(bytes, BitOrder::MsbFirst);

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

        let mut decoder = BitStreamDecoder::new(bytes, BitOrder::MsbFirst);
        assert_eq!(decoder.read_uint16(Endianness::BigEndian).unwrap(), 0x1234);
    }

    #[test]
    fn test_float32_special_values() {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_float32(f32::INFINITY, Endianness::BigEndian);
        encoder.write_float32(f32::NEG_INFINITY, Endianness::BigEndian);

        let bytes = encoder.finish();
        let mut decoder = BitStreamDecoder::new(bytes, BitOrder::MsbFirst);

        assert_eq!(decoder.read_float32(Endianness::BigEndian).unwrap(), f32::INFINITY);
        assert_eq!(decoder.read_float32(Endianness::BigEndian).unwrap(), f32::NEG_INFINITY);
    }
}
