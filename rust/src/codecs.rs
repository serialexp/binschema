//! Codec registry for `compressed` regions.
//!
//! A `compressed` field serializes its inner type to a buffer, runs it through a
//! named codec, and frames the result. Built-in codecs:
//!
//!   - `store`   — identity passthrough (no compression).
//!   - `deflate` — raw DEFLATE (RFC 1951), via flate2.
//!   - `gzip`    — gzip container (RFC 1952), via flate2.
//!
//! The registry is pluggable: register additional codecs (zstd, lz4, snappy, …)
//! with [`register_codec`] before encoding/decoding. Generated code calls
//! [`resolve_codec`]; an unknown name returns an error so the failure is loud
//! rather than silently producing wrong bytes.

use crate::{BinSchemaError, Result};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

/// A codec transforms a byte buffer in both directions.
pub trait Codec: Send + Sync {
    /// Transform the inner-encoded bytes into the wire representation.
    fn compress(&self, data: &[u8]) -> Result<Vec<u8>>;
    /// Reverse [`compress`](Codec::compress). `expected_size` is the decoded
    /// `uncompressed_size` framing field; implementations may use it to
    /// pre-allocate the output buffer or ignore it.
    fn decompress(&self, data: &[u8], expected_size: usize) -> Result<Vec<u8>>;
}

struct StoreCodec;

impl Codec for StoreCodec {
    fn compress(&self, data: &[u8]) -> Result<Vec<u8>> {
        Ok(data.to_vec())
    }
    fn decompress(&self, data: &[u8], _expected_size: usize) -> Result<Vec<u8>> {
        Ok(data.to_vec())
    }
}

struct DeflateCodec;

impl Codec for DeflateCodec {
    fn compress(&self, data: &[u8]) -> Result<Vec<u8>> {
        use flate2::write::DeflateEncoder;
        use flate2::Compression;
        use std::io::Write;
        let mut e = DeflateEncoder::new(Vec::new(), Compression::default());
        e.write_all(data)
            .map_err(|err| BinSchemaError::InvalidEncoding(format!("deflate compress: {}", err)))?;
        e.finish()
            .map_err(|err| BinSchemaError::InvalidEncoding(format!("deflate compress: {}", err)))
    }
    fn decompress(&self, data: &[u8], expected_size: usize) -> Result<Vec<u8>> {
        use flate2::read::DeflateDecoder;
        use std::io::Read;
        let mut d = DeflateDecoder::new(data);
        let mut out = Vec::with_capacity(expected_size);
        d.read_to_end(&mut out)
            .map_err(|err| BinSchemaError::InvalidEncoding(format!("deflate decompress: {}", err)))?;
        Ok(out)
    }
}

struct GzipCodec;

impl Codec for GzipCodec {
    fn compress(&self, data: &[u8]) -> Result<Vec<u8>> {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;
        let mut e = GzEncoder::new(Vec::new(), Compression::default());
        e.write_all(data)
            .map_err(|err| BinSchemaError::InvalidEncoding(format!("gzip compress: {}", err)))?;
        e.finish()
            .map_err(|err| BinSchemaError::InvalidEncoding(format!("gzip compress: {}", err)))
    }
    fn decompress(&self, data: &[u8], expected_size: usize) -> Result<Vec<u8>> {
        use flate2::read::GzDecoder;
        use std::io::Read;
        let mut d = GzDecoder::new(data);
        let mut out = Vec::with_capacity(expected_size);
        d.read_to_end(&mut out)
            .map_err(|err| BinSchemaError::InvalidEncoding(format!("gzip decompress: {}", err)))?;
        Ok(out)
    }
}

fn registry() -> &'static Mutex<HashMap<String, Arc<dyn Codec>>> {
    static REG: OnceLock<Mutex<HashMap<String, Arc<dyn Codec>>>> = OnceLock::new();
    REG.get_or_init(|| {
        let mut m: HashMap<String, Arc<dyn Codec>> = HashMap::new();
        m.insert("store".to_string(), Arc::new(StoreCodec));
        m.insert("deflate".to_string(), Arc::new(DeflateCodec));
        m.insert("gzip".to_string(), Arc::new(GzipCodec));
        Mutex::new(m)
    })
}

/// Register (or override) a codec by name. Use for codecs that aren't built in
/// (e.g. zstd/lz4/snappy) by wrapping the library of your choice.
pub fn register_codec(name: &str, codec: Arc<dyn Codec>) {
    registry().lock().unwrap().insert(name.to_string(), codec);
}

/// Resolve a codec by name. Returns an error if the name isn't a built-in and
/// hasn't been registered.
pub fn resolve_codec(name: &str) -> Result<Arc<dyn Codec>> {
    registry()
        .lock()
        .unwrap()
        .get(name)
        .cloned()
        .ok_or_else(|| {
            BinSchemaError::InvalidEncoding(format!(
                "no codec registered for '{}' (built-in: store, deflate, gzip)",
                name
            ))
        })
}
