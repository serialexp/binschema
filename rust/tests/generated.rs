use binschema_runtime::{BitStreamEncoder, BitStreamDecoder, Endianness, BitOrder, Result};

#[derive(Debug, Clone, PartialEq)]
pub struct DNSHeader {
    pub id: u16,
    pub qr: u8,
    pub opcode: u8,
    pub aa: u8,
    pub tc: u8,
    pub rd: u8,
    pub ra: u8,
    pub z: u8,
    pub rcode: u8,
    pub qdcount: u16,
    pub ancount: u16,
    pub nscount: u16,
    pub arcount: u16,
}

impl DNSHeader {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint16(self.id, Endianness::BigEndian);
        encoder.write_bits(self.qr as u64, 1);
        encoder.write_bits(self.opcode as u64, 4);
        encoder.write_bits(self.aa as u64, 1);
        encoder.write_bits(self.tc as u64, 1);
        encoder.write_bits(self.rd as u64, 1);
        encoder.write_bits(self.ra as u64, 1);
        encoder.write_bits(self.z as u64, 3);
        encoder.write_bits(self.rcode as u64, 4);
        encoder.write_uint16(self.qdcount, Endianness::BigEndian);
        encoder.write_uint16(self.ancount, Endianness::BigEndian);
        encoder.write_uint16(self.nscount, Endianness::BigEndian);
        encoder.write_uint16(self.arcount, Endianness::BigEndian);
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let id = decoder.read_uint16(Endianness::BigEndian)?;
        let qr = decoder.read_bits(1)? as u8;
        let opcode = decoder.read_bits(4)? as u8;
        let aa = decoder.read_bits(1)? as u8;
        let tc = decoder.read_bits(1)? as u8;
        let rd = decoder.read_bits(1)? as u8;
        let ra = decoder.read_bits(1)? as u8;
        let z = decoder.read_bits(3)? as u8;
        let rcode = decoder.read_bits(4)? as u8;
        let qdcount = decoder.read_uint16(Endianness::BigEndian)?;
        let ancount = decoder.read_uint16(Endianness::BigEndian)?;
        let nscount = decoder.read_uint16(Endianness::BigEndian)?;
        let arcount = decoder.read_uint16(Endianness::BigEndian)?;
        Ok(Self {
            id,
            qr,
            opcode,
            aa,
            tc,
            rd,
            ra,
            z,
            rcode,
            qdcount,
            ancount,
            nscount,
            arcount,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Label {
    pub value: String,
}

impl Label {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint8(self.value.len() as u8);
        for b in self.value.as_bytes() {
            encoder.write_uint8(*b);
        }
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let length = decoder.read_uint8()? as usize;
        let mut bytes = Vec::with_capacity(length);
        for _ in 0..length {
            bytes.push(decoder.read_uint8()?);
        }
        let value = String::from_utf8(bytes).map_err(|_| binschema_runtime::BinSchemaError::InvalidUtf8)?;
        Ok(Self {
            value,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct DomainName {
    pub value: Vec<Label>,
}

impl DomainName {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        for item in &self.value {
            let bytes = item.encode();
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        encoder.write_uint8(0);
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let mut value: Vec<Label> = Vec::new();
        loop {
            let item = Label::decode_with_decoder(decoder)?;
            value.push(item);
            // TODO: null termination check
        }
        Ok(Self {
            value,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Pointer {
    pub value: u16,
}

impl Pointer {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint16(self.value, Endianness::BigEndian);
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let value = decoder.read_uint16(Endianness::BigEndian)?;
        Ok(Self {
            value,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Question {
    pub qname: DomainName,
    pub qtype: u16,
    pub qclass: u16,
}

impl Question {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        let bytes = self.qname.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        encoder.write_uint16(self.qtype, Endianness::BigEndian);
        encoder.write_uint16(self.qclass, Endianness::BigEndian);
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let qname = DomainName::decode_with_decoder(decoder)?;
        let qtype = decoder.read_uint16(Endianness::BigEndian)?;
        let qclass = decoder.read_uint16(Endianness::BigEndian)?;
        Ok(Self {
            qname,
            qtype,
            qclass,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResourceRecord {
    pub name: DomainName,
    pub rtype: u16,
    pub rclass: u16,
    pub ttl: u32,
    pub rdlength: u16,
    pub rdata: Vec<u8>,
}

impl ResourceRecord {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        let bytes = self.name.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        encoder.write_uint16(self.rtype, Endianness::BigEndian);
        encoder.write_uint16(self.rclass, Endianness::BigEndian);
        encoder.write_uint32(self.ttl, Endianness::BigEndian);
        encoder.write_uint16(self.rdlength, Endianness::BigEndian);
        encoder.write_uint16(self.rdata.len() as u16, Endianness::BigEndian);
        for item in &self.rdata {
            encoder.write_uint8(*item);
        }
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let name = DomainName::decode_with_decoder(decoder)?;
        let rtype = decoder.read_uint16(Endianness::BigEndian)?;
        let rclass = decoder.read_uint16(Endianness::BigEndian)?;
        let ttl = decoder.read_uint32(Endianness::BigEndian)?;
        let rdlength = decoder.read_uint16(Endianness::BigEndian)?;
        let length = decoder.read_uint16(Endianness::BigEndian)? as usize;
        let mut rdata = Vec::with_capacity(length);
        for _ in 0..length {
            let item = decoder.read_uint8()?;
            rdata.push(item);
        }
        Ok(Self {
            name,
            rtype,
            rclass,
            ttl,
            rdlength,
            rdata,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct A_Record {
    pub address: u32,
}

impl A_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint32(self.address, Endianness::BigEndian);
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let address = decoder.read_uint32(Endianness::BigEndian)?;
        Ok(Self {
            address,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct NS_Record {
    pub nsdname: DomainName,
}

impl NS_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        let bytes = self.nsdname.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let nsdname = DomainName::decode_with_decoder(decoder)?;
        Ok(Self {
            nsdname,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct CNAME_Record {
    pub cname: DomainName,
}

impl CNAME_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        let bytes = self.cname.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let cname = DomainName::decode_with_decoder(decoder)?;
        Ok(Self {
            cname,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SOA_Record {
    pub mname: DomainName,
    pub rname: DomainName,
    pub serial: u32,
    pub refresh: u32,
    pub retry: u32,
    pub expire: u32,
    pub minimum: u32,
}

impl SOA_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        let bytes = self.mname.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        let bytes = self.rname.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        encoder.write_uint32(self.serial, Endianness::BigEndian);
        encoder.write_uint32(self.refresh, Endianness::BigEndian);
        encoder.write_uint32(self.retry, Endianness::BigEndian);
        encoder.write_uint32(self.expire, Endianness::BigEndian);
        encoder.write_uint32(self.minimum, Endianness::BigEndian);
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let mname = DomainName::decode_with_decoder(decoder)?;
        let rname = DomainName::decode_with_decoder(decoder)?;
        let serial = decoder.read_uint32(Endianness::BigEndian)?;
        let refresh = decoder.read_uint32(Endianness::BigEndian)?;
        let retry = decoder.read_uint32(Endianness::BigEndian)?;
        let expire = decoder.read_uint32(Endianness::BigEndian)?;
        let minimum = decoder.read_uint32(Endianness::BigEndian)?;
        Ok(Self {
            mname,
            rname,
            serial,
            refresh,
            retry,
            expire,
            minimum,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct PTR_Record {
    pub ptrdname: DomainName,
}

impl PTR_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        let bytes = self.ptrdname.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let ptrdname = DomainName::decode_with_decoder(decoder)?;
        Ok(Self {
            ptrdname,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct MX_Record {
    pub preference: u16,
    pub exchange: DomainName,
}

impl MX_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint16(self.preference, Endianness::BigEndian);
        let bytes = self.exchange.encode();
        for b in bytes {
            encoder.write_uint8(b);
        }
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let preference = decoder.read_uint16(Endianness::BigEndian)?;
        let exchange = DomainName::decode_with_decoder(decoder)?;
        Ok(Self {
            preference,
            exchange,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TXT_Record {
    pub value: Vec<u8>,
}

impl TXT_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint8(self.value.len() as u8);
        for item in &self.value {
            encoder.write_uint8(*item);
        }
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let length = decoder.read_uint8()? as usize;
        let mut value = Vec::with_capacity(length);
        for _ in 0..length {
            let item = decoder.read_uint8()?;
            value.push(item);
        }
        Ok(Self {
            value,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct AAAA_Record {
    pub address_high: u64,
    pub address_low: u64,
}

impl AAAA_Record {
    pub fn encode(&self) -> Vec<u8> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint64(self.address_high, Endianness::BigEndian);
        encoder.write_uint64(self.address_low, Endianness::BigEndian);
        encoder.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let address_high = decoder.read_uint64(Endianness::BigEndian)?;
        let address_low = decoder.read_uint64(Endianness::BigEndian)?;
        Ok(Self {
            address_high,
            address_low,
        })
    }
}
