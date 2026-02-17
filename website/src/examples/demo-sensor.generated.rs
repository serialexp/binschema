use binschema_runtime::{BitStreamEncoder, BitStreamDecoder, Endianness, BitOrder, Result, EncodeContext, FieldValue};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct SensorReadingInput {
    pub device_id: u16,
    pub temperature: f32,
    pub humidity: u8,
    pub timestamp: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SensorReadingOutput {
    pub device_id: u16,
    pub temperature: f32,
    pub humidity: u8,
    pub timestamp: u32,
}

pub type SensorReading = SensorReadingOutput;

impl SensorReadingInput {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint16(self.device_id, Endianness::BigEndian);
        encoder.write_float32(self.temperature, Endianness::BigEndian);
        encoder.write_uint8(self.humidity);
        encoder.write_uint32(self.timestamp, Endianness::BigEndian);
        Ok(encoder.finish())
    }

}

impl SensorReadingOutput {
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let device_id = decoder.read_uint16(Endianness::BigEndian)?;
        let temperature = decoder.read_float32(Endianness::BigEndian)?;
        let humidity = decoder.read_uint8()?;
        let timestamp = decoder.read_uint32(Endianness::BigEndian)?;
        Ok(Self {
            device_id,
            temperature,
            humidity,
            timestamp,
        })
    }
}
