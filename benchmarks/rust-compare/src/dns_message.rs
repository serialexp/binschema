#![allow(non_camel_case_types)]
#![allow(dead_code)]
#![allow(unreachable_code)]

#[allow(unused_imports)]
use binschema_runtime::{BitStreamEncoder, BitStreamDecoder, Endianness, BitOrder, Result, EncodeContext, FieldValue};
#[allow(unused_imports)]
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum UnionARdataNSRdataCNAMERdata {
    ARdata(ARdataOutput),
    NSRdata(NSRdataOutput),
    CNAMERdata(CNAMERdataOutput),
}

impl UnionARdataNSRdataCNAMERdata {
    pub fn encode(&self) -> Result<Vec<u8>> {
        self.encode_with_context(&EncodeContext::new())
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        match self {
            UnionARdataNSRdataCNAMERdata::ARdata(v) => {
                encoder.write_uint32(v.address, Endianness::BigEndian);
            }
            UnionARdataNSRdataCNAMERdata::NSRdata(v) => {
                let field_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
                let field_bytes = v.nsdname.encode_with_context(&field_ctx)?;
                for b in field_bytes { encoder.write_uint8(b); }
            }
            UnionARdataNSRdataCNAMERdata::CNAMERdata(v) => {
                let field_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
                let field_bytes = v.cname.encode_with_context(&field_ctx)?;
                for b in field_bytes { encoder.write_uint8(b); }
            }
        }
        Ok(encoder.finish())
    }

    pub fn type_name(&self) -> &'static str {
        match self {
            UnionARdataNSRdataCNAMERdata::ARdata(_) => "ARdata",
            UnionARdataNSRdataCNAMERdata::NSRdata(_) => "NSRdata",
            UnionARdataNSRdataCNAMERdata::CNAMERdata(_) => "CNAMERdata",
        }
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        // Union type - try each variant in order until one succeeds
        let start_pos = decoder.position();
        if let Ok(v) = ARdataOutput::decode_with_decoder(decoder) {
            return Ok(UnionARdataNSRdataCNAMERdata::ARdata(v));
        }
        decoder.seek(start_pos)?;
        if let Ok(v) = NSRdataOutput::decode_with_decoder(decoder) {
            return Ok(UnionARdataNSRdataCNAMERdata::NSRdata(v));
        }
        decoder.seek(start_pos)?;
        if let Ok(v) = CNAMERdataOutput::decode_with_decoder(decoder) {
            return Ok(UnionARdataNSRdataCNAMERdata::CNAMERdata(v));
        }
        Err(binschema_runtime::BinSchemaError::InvalidVariant(0))
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct DnsMessageFlags {
    pub qr: u8,
    pub opcode: u8,
    pub aa: u8,
    pub tc: u8,
    pub rd: u8,
    pub ra: u8,
    pub z: u8,
    pub rcode: u8,
}

impl DnsMessageFlags {
    pub fn encode(&self, encoder: &mut BitStreamEncoder) {
        encoder.write_bits(self.qr as u64, 1);
        encoder.write_bits(self.opcode as u64, 4);
        encoder.write_bits(self.aa as u64, 1);
        encoder.write_bits(self.tc as u64, 1);
        encoder.write_bits(self.rd as u64, 1);
        encoder.write_bits(self.ra as u64, 1);
        encoder.write_bits(self.z as u64, 3);
        encoder.write_bits(self.rcode as u64, 4);
    }

    pub fn decode(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let qr = decoder.read_bits(1)? as u8;
        let opcode = decoder.read_bits(4)? as u8;
        let aa = decoder.read_bits(1)? as u8;
        let tc = decoder.read_bits(1)? as u8;
        let rd = decoder.read_bits(1)? as u8;
        let ra = decoder.read_bits(1)? as u8;
        let z = decoder.read_bits(3)? as u8;
        let rcode = decoder.read_bits(4)? as u8;
        Ok(Self {
            qr,
            opcode,
            aa,
            tc,
            rd,
            ra,
            z,
            rcode,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Label(pub std::string::String);

impl Label {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint8(self.0.chars().count() as u8);
        let string_bytes: Vec<u8> = self.0.chars().map(|c| c as u8).collect();
        for &b in string_bytes.iter() {
            encoder.write_uint8(b);
        }
        Ok(encoder.finish())
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let length = decoder.read_uint8()? as usize;
        let bytes = decoder.read_bytes_vec(length)?;
        let value: std::string::String = bytes.iter().map(|&b| b as char).collect();
        Ok(Self(value))
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum CompressedLabel {
    Label(Label),
    LabelPointer(LabelPointer),
}

impl CompressedLabel {
    pub fn encode(&self) -> Result<Vec<u8>> {
        self.encode_with_context(&EncodeContext::new())
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        match self {
            CompressedLabel::Label(v) => {
                let bytes = v.encode()?;
                // Register non-reference string in compression dict
                if let Some(dict) = ctx.compression_dict() {
                    dict.borrow_mut().entry(bytes.clone()).or_insert(ctx.base_offset() + encoder.byte_offset());
                }
                for b in bytes { encoder.write_uint8(b); }
            }
            CompressedLabel::LabelPointer(v) => {
                let item_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
                let bytes = v.encode_with_context(&item_ctx)?;
                for b in bytes { encoder.write_uint8(b); }
            }
        }
        Ok(encoder.finish())
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let value = decoder.peek_uint8()?;
        // Match on discriminator value
        if value < 0xC0 {
            Ok(CompressedLabel::Label(Label::decode_with_decoder(decoder)?))
        } else if value >= 0xC0 {
            Ok(CompressedLabel::LabelPointer(LabelPointer::decode_with_decoder(decoder)?))
        } else {
            Err(binschema_runtime::BinSchemaError::InvalidVariant(value as u64))
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct LabelPointer(pub Label);

impl LabelPointer {
    pub fn encode(&self) -> Result<Vec<u8>> {
        self.encode_with_context(&EncodeContext::new())
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        // Encode target value to get bytes for dict lookup
        let target_bytes = self.0.encode()?;

        // Check compression dictionary for existing encoding
        if let Some(dict) = ctx.compression_dict() {
            if let Some(&offset) = dict.borrow().get(&target_bytes) {
                // Found — write compression pointer
                let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
                encoder.write_uint16(0xC000u16 | (offset as u16 & 0x3FFFu16), Endianness::BigEndian);
                return Ok(encoder.finish());
            }
        }

        // Not found — record in dict and encode inline
        if let Some(dict) = ctx.compression_dict() {
            dict.borrow_mut().entry(target_bytes.clone()).or_insert(ctx.base_offset());
        }
        Ok(target_bytes)
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        // Read the reference value (uint16)
        let reference_value = decoder.read_uint16(Endianness::BigEndian)?;
        let offset = (reference_value & 0x3FFF) as usize;

        // Save current position and seek to the referenced offset
        let saved_pos = decoder.position();
        decoder.seek(offset)?;

        // Decode the target type at the referenced position
        let value = Label::decode_with_decoder(decoder)?;

        // Restore position
        decoder.seek(saved_pos)?;

        Ok(Self(value))
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct CompressedDomain {
    pub value: Vec<CompressedLabel>,
}

impl CompressedDomain {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut ctx = EncodeContext::new();
        ctx.ensure_compression_dict();
        self.encode_with_context(&ctx)
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        for item in &self.value {
            let item_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = item.encode_with_context(&item_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        // Skip null terminator if last item was a terminal variant
        let is_terminal = self.value.last().map_or(false, |last| {
            match last {
                CompressedLabel::LabelPointer(_) => true,
                _ => false,
            }
        });
        if !is_terminal {
            encoder.write_uint8(0);
        }
        Ok(encoder.finish())
    }

    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let mut value: Vec<CompressedLabel> = Vec::new();
        loop {
            // Check for null terminator before decoding item
            if decoder.peek_uint8()? == 0 {
                decoder.read_uint8()?; // Consume the null byte
                break;
            }
            let item = CompressedLabel::decode_with_decoder(decoder)?;
            value.push(item);
            // Check if item is a terminal variant (ends array without null byte)
            match &value[value.len() - 1] {
                CompressedLabel::LabelPointer(_) => break,
                _ => {}
            }
        }
        Ok(Self {
            value,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuestionInput {
    pub qname: CompressedDomain,
    pub qtype: u16,
    pub qclass: u16,
}

#[derive(Debug, Clone, PartialEq)]
pub struct QuestionOutput {
    pub qname: CompressedDomain,
    pub qtype: u16,
    pub qclass: u16,
}

pub type Question = QuestionOutput;

impl QuestionInput {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut ctx = EncodeContext::new();
        ctx.ensure_compression_dict();
        self.encode_with_context(&ctx)
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        {
            let field_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = self.qname.encode_with_context(&field_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        encoder.write_uint16(self.qtype, Endianness::BigEndian);
        encoder.write_uint16(self.qclass, Endianness::BigEndian);
        Ok(encoder.finish())
    }

}

impl QuestionOutput {
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let qname = CompressedDomain::decode_with_decoder(decoder)?;
        let qtype = decoder.read_uint16(Endianness::BigEndian)?;
        let qclass = decoder.read_uint16(Endianness::BigEndian)?;
        Ok(Self {
            qname,
            qtype,
            qclass,
        })
    }
}

impl From<QuestionOutput> for QuestionInput {
    fn from(o: QuestionOutput) -> Self {
        Self {
            qname: o.qname,
            qtype: o.qtype,
            qclass: o.qclass,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ARdataInput {
    pub address: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ARdataOutput {
    pub address: u32,
}

pub type ARdata = ARdataOutput;

impl ARdataInput {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint32(self.address, Endianness::BigEndian);
        Ok(encoder.finish())
    }

}

impl ARdataOutput {
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

impl From<ARdataOutput> for ARdataInput {
    fn from(o: ARdataOutput) -> Self {
        Self {
            address: o.address,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct NSRdataInput {
    pub nsdname: CompressedDomain,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NSRdataOutput {
    pub nsdname: CompressedDomain,
}

pub type NSRdata = NSRdataOutput;

impl NSRdataInput {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut ctx = EncodeContext::new();
        ctx.ensure_compression_dict();
        self.encode_with_context(&ctx)
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        {
            let field_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = self.nsdname.encode_with_context(&field_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        Ok(encoder.finish())
    }

}

impl NSRdataOutput {
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let nsdname = CompressedDomain::decode_with_decoder(decoder)?;
        Ok(Self {
            nsdname,
        })
    }
}

impl From<NSRdataOutput> for NSRdataInput {
    fn from(o: NSRdataOutput) -> Self {
        Self {
            nsdname: o.nsdname,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct CNAMERdataInput {
    pub cname: CompressedDomain,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CNAMERdataOutput {
    pub cname: CompressedDomain,
}

pub type CNAMERdata = CNAMERdataOutput;

impl CNAMERdataInput {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut ctx = EncodeContext::new();
        ctx.ensure_compression_dict();
        self.encode_with_context(&ctx)
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        {
            let field_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = self.cname.encode_with_context(&field_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        Ok(encoder.finish())
    }

}

impl CNAMERdataOutput {
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let cname = CompressedDomain::decode_with_decoder(decoder)?;
        Ok(Self {
            cname,
        })
    }
}

impl From<CNAMERdataOutput> for CNAMERdataInput {
    fn from(o: CNAMERdataOutput) -> Self {
        Self {
            cname: o.cname,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResourceRecordInput {
    pub name: CompressedDomain,
    pub r#type: u16,
    pub class: u16,
    pub ttl: u32,
    pub rdlength: u16,
    pub rdata: UnionARdataNSRdataCNAMERdata,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResourceRecordOutput {
    pub name: CompressedDomain,
    pub r#type: u16,
    pub class: u16,
    pub ttl: u32,
    pub rdlength: u16,
    pub rdata: UnionARdataNSRdataCNAMERdata,
}

pub type ResourceRecord = ResourceRecordOutput;

impl ResourceRecordInput {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut ctx = EncodeContext::new();
        ctx.ensure_compression_dict();
        self.encode_with_context(&ctx)
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        {
            let field_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = self.name.encode_with_context(&field_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        encoder.write_uint16(self.r#type, Endianness::BigEndian);
        encoder.write_uint16(self.class, Endianness::BigEndian);
        encoder.write_uint32(self.ttl, Endianness::BigEndian);
        encoder.write_uint16(self.rdlength, Endianness::BigEndian);
        let bytes = self.rdata.encode()?;
        for b in bytes {
            encoder.write_uint8(b);
        }
        Ok(encoder.finish())
    }

}

impl ResourceRecordOutput {
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let name = CompressedDomain::decode_with_decoder(decoder)?;
        let r#type = decoder.read_uint16(Endianness::BigEndian)?;
        let class = decoder.read_uint16(Endianness::BigEndian)?;
        let ttl = decoder.read_uint32(Endianness::BigEndian)?;
        let rdlength = decoder.read_uint16(Endianness::BigEndian)?;
        let rdata = UnionARdataNSRdataCNAMERdata::decode_with_decoder(decoder)?;
        Ok(Self {
            name,
            r#type,
            class,
            ttl,
            rdlength,
            rdata,
        })
    }
}

impl From<ResourceRecordOutput> for ResourceRecordInput {
    fn from(o: ResourceRecordOutput) -> Self {
        Self {
            name: o.name,
            r#type: o.r#type,
            class: o.class,
            ttl: o.ttl,
            rdlength: o.rdlength,
            rdata: o.rdata,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct DnsMessageInput {
    pub id: u16,
    pub flags: DnsMessageFlags,
    pub qdcount: u16,
    pub ancount: u16,
    pub nscount: u16,
    pub arcount: u16,
    pub questions: Vec<QuestionInput>,
    pub answers: Vec<ResourceRecordInput>,
    pub authority: Vec<ResourceRecordInput>,
    pub additional: Vec<ResourceRecordInput>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DnsMessageOutput {
    pub id: u16,
    pub flags: DnsMessageFlags,
    pub qdcount: u16,
    pub ancount: u16,
    pub nscount: u16,
    pub arcount: u16,
    pub questions: Vec<Question>,
    pub answers: Vec<ResourceRecord>,
    pub authority: Vec<ResourceRecord>,
    pub additional: Vec<ResourceRecord>,
}

pub type DnsMessage = DnsMessageOutput;

impl DnsMessageInput {
    pub fn encode(&self) -> Result<Vec<u8>> {
        let mut ctx = EncodeContext::new();
        ctx.ensure_compression_dict();
        self.encode_with_context(&ctx)
    }

    pub fn encode_with_context(&self, ctx: &EncodeContext) -> Result<Vec<u8>> {
        let mut encoder = BitStreamEncoder::new(BitOrder::MsbFirst);
        encoder.write_uint16(self.id, Endianness::BigEndian);
        self.flags.encode(&mut encoder);
        encoder.write_uint16(self.qdcount, Endianness::BigEndian);
        encoder.write_uint16(self.ancount, Endianness::BigEndian);
        encoder.write_uint16(self.nscount, Endianness::BigEndian);
        encoder.write_uint16(self.arcount, Endianness::BigEndian);
        for item in &self.questions {
            let item_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = item.encode_with_context(&item_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        for item in &self.answers {
            let item_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = item.encode_with_context(&item_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        for item in &self.authority {
            let item_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = item.encode_with_context(&item_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        for item in &self.additional {
            let item_ctx = ctx.with_base_offset(ctx.base_offset() + encoder.byte_offset());
            let bytes = item.encode_with_context(&item_ctx)?;
            for b in bytes {
                encoder.write_uint8(b);
            }
        }
        Ok(encoder.finish())
    }

}

impl DnsMessageOutput {
    pub fn decode(bytes: &[u8]) -> Result<Self> {
        let mut decoder = BitStreamDecoder::new(bytes.to_vec(), BitOrder::MsbFirst);
        Self::decode_with_decoder(&mut decoder)
    }

    pub fn decode_with_decoder(decoder: &mut BitStreamDecoder) -> Result<Self> {
        let id = decoder.read_uint16(Endianness::BigEndian)?;
        let flags = DnsMessageFlags::decode(decoder)?;
        let qdcount = decoder.read_uint16(Endianness::BigEndian)?;
        let ancount = decoder.read_uint16(Endianness::BigEndian)?;
        let nscount = decoder.read_uint16(Endianness::BigEndian)?;
        let arcount = decoder.read_uint16(Endianness::BigEndian)?;
        let mut questions = Vec::with_capacity(qdcount as usize);
        for _ in 0..qdcount {
            let item = QuestionOutput::decode_with_decoder(decoder)?;
            questions.push(item);
        }
        let mut answers = Vec::with_capacity(ancount as usize);
        for _ in 0..ancount {
            let item = ResourceRecordOutput::decode_with_decoder(decoder)?;
            answers.push(item);
        }
        let mut authority = Vec::with_capacity(nscount as usize);
        for _ in 0..nscount {
            let item = ResourceRecordOutput::decode_with_decoder(decoder)?;
            authority.push(item);
        }
        let mut additional = Vec::with_capacity(arcount as usize);
        for _ in 0..arcount {
            let item = ResourceRecordOutput::decode_with_decoder(decoder)?;
            additional.push(item);
        }
        Ok(Self {
            id,
            flags,
            qdcount,
            ancount,
            nscount,
            arcount,
            questions,
            answers,
            authority,
            additional,
        })
    }
}

impl From<DnsMessageOutput> for DnsMessageInput {
    fn from(o: DnsMessageOutput) -> Self {
        Self {
            id: o.id,
            flags: o.flags,
            qdcount: o.qdcount,
            ancount: o.ancount,
            nscount: o.nscount,
            arcount: o.arcount,
            questions: o.questions.into_iter().map(|x| x.into()).collect(),
            answers: o.answers.into_iter().map(|x| x.into()).collect(),
            authority: o.authority.into_iter().map(|x| x.into()).collect(),
            additional: o.additional.into_iter().map(|x| x.into()).collect(),
        }
    }
}
