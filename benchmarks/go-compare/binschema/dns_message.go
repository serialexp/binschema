package binschema

import (
	"fmt"
	"github.com/anthropics/binschema/benchmarks/go-compare/binschema/runtime"
)

type Label struct {
	Value string
}

func (m *Label) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *Label) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"value": m.Value,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	m_Value_bytes := make([]byte, 0, len(m.Value))
	for _, r := range m.Value {
		m_Value_bytes = append(m_Value_bytes, byte(r))
	}
	encoder.WriteUint8(uint8(len(m_Value_bytes)))
	for _, b := range m_Value_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func (m *Label) CalculateSize() int {
	size := 0

	size += 1 + len(m.Value) // Value (length-prefixed string)

	return size
}

func DecodeLabel(bytes []byte) (*Label, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeLabelWithDecoder(decoder)
}

func decodeLabelWithDecoder(decoder *runtime.BitStreamDecoder) (*Label, error) {
	result := &Label{}

	valueLength, err := decoder.ReadUint8()
	if err != nil {
		return nil, fmt.Errorf("failed to decode value length: %w", err)
	}
	valueBytes := make([]byte, valueLength)
	for i := range valueBytes {
		b, err := decoder.ReadUint8()
		if err != nil {
			return nil, fmt.Errorf("failed to decode value: %w", err)
		}
		valueBytes[i] = b
	}
	valueBytesRunes := make([]rune, len(valueBytes))
	for i, b := range valueBytes {
		valueBytesRunes[i] = rune(b)
	}
	result.Value = string(valueBytesRunes)


	return result, nil
}

// CompressedLabel is a discriminated union type
type CompressedLabel interface {
	Encode() ([]byte, error)
	EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error)
	CalculateSize() int
	IsCompressedLabel()
}

func (*Label) IsCompressedLabel() {}
func (*LabelPointer) IsCompressedLabel() {}

func DecodeCompressedLabel(bytes []byte) (CompressedLabel, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeCompressedLabelWithDecoder(decoder)
}

func decodeCompressedLabelWithDecoder(decoder *runtime.BitStreamDecoder) (CompressedLabel, error) {
	discriminator, err := decoder.PeekUint8()
	if err != nil {
		return nil, fmt.Errorf("failed to peek discriminator: %w", err)
	}

	if discriminator < 0xC0 {
		return decodeLabelWithDecoder(decoder)
	} else if discriminator >= 0xC0 {
		return decodeLabelPointerWithDecoder(decoder)
	} else {
		return nil, fmt.Errorf("unknown discriminator: %d", discriminator)
	}
}

type LabelPointer struct {
	Value Label
}

func (m *LabelPointer) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *LabelPointer) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"value": m.Value,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	// Encode back_reference target value
	targetBytes, err := m.Value.EncodeWithContext(childCtx)
	if err != nil {
		return nil, fmt.Errorf("failed to encode back_reference target: %w", err)
	}
	for _, b := range targetBytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func (m *LabelPointer) CalculateSize() int {
	size := 0

	size += m.Value.CalculateSize() // Value (type: back_reference)

	return size
}

func DecodeLabelPointer(bytes []byte) (*LabelPointer, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeLabelPointerWithDecoder(decoder)
}

func decodeLabelPointerWithDecoder(decoder *runtime.BitStreamDecoder) (*LabelPointer, error) {
	result := &LabelPointer{}

	referenceValue, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to read back_reference: %w", err)
	}

	offset := referenceValue & 0x3FFF

	// Save current position and seek to referenced offset
	savedPos := decoder.Position()
	decoder.Seek(int(offset))

	value, err := decodeLabelWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode back_reference target: %w", err)
	}

	decoder.Seek(savedPos)

	result.Value = *value


	return result, nil
}

type CompressedDomain struct {
	Value []CompressedLabel
}

func (m *CompressedDomain) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *CompressedDomain) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"value": m.Value,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	value_item_terminated := false
	value_itemLoop:
	// Encode array with back_reference compression support
	for _, value_item := range m.Value {
		switch v := value_item.(type) {
		case *Label:
			// Record string value in compression dictionary
			ctx.SetCompressionOffset(v.Value, ctx.ByteOffset + encoder.Position())
			value_item_bytes, err := v.EncodeWithContext(childCtx)
			if err != nil {
				return nil, fmt.Errorf("failed to encode Label: %w", err)
			}
			for _, b := range value_item_bytes {
				encoder.WriteUint8(b)
			}
		case *LabelPointer:
			// Check compression dictionary for back_reference
			if existingOffset, found := ctx.GetCompressionOffset(v.Value.Value); found {
				// Write compression pointer
				encoder.WriteUint16(0xC000 | uint16(existingOffset & 0x3FFF), runtime.BigEndian)
			} else {
				// First occurrence - record position and encode full value
				ctx.SetCompressionOffset(v.Value.Value, ctx.ByteOffset + encoder.Position())
				value_item_bytes, err := v.Value.EncodeWithContext(childCtx)
				if err != nil {
					return nil, fmt.Errorf("failed to encode LabelPointer target: %w", err)
				}
				for _, b := range value_item_bytes {
					encoder.WriteUint8(b)
				}
			}
			value_item_terminated = true
			break value_itemLoop // Terminal variant - stop encoding
		default:
			return nil, fmt.Errorf("unknown variant type in value: %T", value_item)
		}
	}
	if !value_item_terminated {
		encoder.WriteUint8(0)
	}

	return encoder.Finish(), nil
}

func (m *CompressedDomain) CalculateSize() int {
	size := 0

	for _, Value_item := range m.Value {
		size += Value_item.CalculateSize()
	}
	size += 1 // Value null terminator

	return size
}

func DecodeCompressedDomain(bytes []byte) (*CompressedDomain, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeCompressedDomainWithDecoder(decoder)
}

func decodeCompressedDomainWithDecoder(decoder *runtime.BitStreamDecoder) (*CompressedDomain, error) {
	result := &CompressedDomain{}

	result.Value = []CompressedLabel{}
	valueLoop:
	for {
		// Peek for null terminator
		peekByte, err := decoder.PeekUint8()
		if err != nil {
			return nil, fmt.Errorf("failed to peek for null terminator: %w", err)
		}
		if peekByte == 0 {
			// Consume the null terminator and exit loop
			_, _ = decoder.ReadUint8()
			break valueLoop
		}
		valueItem, err := decodeCompressedLabelWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result.Value = append(result.Value, valueItem)
		// Check if item is a terminal variant
		switch valueItem.(type) {
		case *LabelPointer:
			break valueLoop // Terminal variant - exit loop
		}
	}


	return result, nil
}

type Question struct {
	Qname CompressedDomain
	Qtype uint16
	Qclass uint16
}

func (m *Question) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *Question) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"qname": m.Qname,
		"qtype": m.Qtype,
		"qclass": m.Qclass,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	m_Qname_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
	m_Qname_bytes, err := m.Qname.EncodeWithContext(m_Qname_ctx)
	if err != nil {
		return nil, err
	}
	for _, b := range m_Qname_bytes {
		encoder.WriteUint8(b)
	}
	encoder.WriteUint16(m.Qtype, runtime.BigEndian)
	encoder.WriteUint16(m.Qclass, runtime.BigEndian)

	return encoder.Finish(), nil
}

func (m *Question) CalculateSize() int {
	size := 0

	size += m.Qname.CalculateSize() // Qname
	size += 2 // Qtype
	size += 2 // Qclass

	return size
}

func DecodeQuestion(bytes []byte) (*Question, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeQuestionWithDecoder(decoder)
}

func decodeQuestionWithDecoder(decoder *runtime.BitStreamDecoder) (*Question, error) {
	result := &Question{}

	qname, err := decodeCompressedDomainWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode qname: %w", err)
	}
	result.Qname = *qname

	qtype, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode qtype: %w", err)
	}
	result.Qtype = qtype

	qclass, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode qclass: %w", err)
	}
	result.Qclass = qclass


	return result, nil
}

type ARdata struct {
	Address uint32
}

func (m *ARdata) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *ARdata) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"address": m.Address,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	encoder.WriteUint32(m.Address, runtime.BigEndian)

	return encoder.Finish(), nil
}

func (m *ARdata) CalculateSize() int {
	size := 0

	size += 4 // Address

	return size
}

func DecodeARdata(bytes []byte) (*ARdata, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeARdataWithDecoder(decoder)
}

func decodeARdataWithDecoder(decoder *runtime.BitStreamDecoder) (*ARdata, error) {
	result := &ARdata{}

	address, err := decoder.ReadUint32(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode address: %w", err)
	}
	result.Address = address


	return result, nil
}

type NSRdata struct {
	Nsdname CompressedDomain
}

func (m *NSRdata) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *NSRdata) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"nsdname": m.Nsdname,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	m_Nsdname_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
	m_Nsdname_bytes, err := m.Nsdname.EncodeWithContext(m_Nsdname_ctx)
	if err != nil {
		return nil, err
	}
	for _, b := range m_Nsdname_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func (m *NSRdata) CalculateSize() int {
	size := 0

	size += m.Nsdname.CalculateSize() // Nsdname

	return size
}

func DecodeNSRdata(bytes []byte) (*NSRdata, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeNSRdataWithDecoder(decoder)
}

func decodeNSRdataWithDecoder(decoder *runtime.BitStreamDecoder) (*NSRdata, error) {
	result := &NSRdata{}

	nsdname, err := decodeCompressedDomainWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nsdname: %w", err)
	}
	result.Nsdname = *nsdname


	return result, nil
}

type CNAMERdata struct {
	Cname CompressedDomain
}

func (m *CNAMERdata) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *CNAMERdata) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"cname": m.Cname,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	m_Cname_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
	m_Cname_bytes, err := m.Cname.EncodeWithContext(m_Cname_ctx)
	if err != nil {
		return nil, err
	}
	for _, b := range m_Cname_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func (m *CNAMERdata) CalculateSize() int {
	size := 0

	size += m.Cname.CalculateSize() // Cname

	return size
}

func DecodeCNAMERdata(bytes []byte) (*CNAMERdata, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeCNAMERdataWithDecoder(decoder)
}

func decodeCNAMERdataWithDecoder(decoder *runtime.BitStreamDecoder) (*CNAMERdata, error) {
	result := &CNAMERdata{}

	cname, err := decodeCompressedDomainWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode cname: %w", err)
	}
	result.Cname = *cname


	return result, nil
}

type ResourceRecord struct {
	Name CompressedDomain
	Type uint16
	Class uint16
	Ttl uint32
	Rdlength uint16
	Rdata interface{}
}

func (m *ResourceRecord) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *ResourceRecord) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"name": m.Name,
		"type": m.Type,
		"class": m.Class,
		"ttl": m.Ttl,
		"rdlength": m.Rdlength,
		"rdata": m.Rdata,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	m_Name_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
	m_Name_bytes, err := m.Name.EncodeWithContext(m_Name_ctx)
	if err != nil {
		return nil, err
	}
	for _, b := range m_Name_bytes {
		encoder.WriteUint8(b)
	}
	encoder.WriteUint16(m.Type, runtime.BigEndian)
	encoder.WriteUint16(m.Class, runtime.BigEndian)
	encoder.WriteUint32(m.Ttl, runtime.BigEndian)
	encoder.WriteUint16(m.Rdlength, runtime.BigEndian)
	// Encode discriminated union variant
	switch v := m.Rdata.(type) {
	case *ARdata:
		variantBytes, err := v.EncodeWithContext(childCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to encode ARdata variant: %w", err)
		}
		for _, b := range variantBytes {
			encoder.WriteUint8(b)
		}
	case *NSRdata:
		variantBytes, err := v.EncodeWithContext(childCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to encode NSRdata variant: %w", err)
		}
		for _, b := range variantBytes {
			encoder.WriteUint8(b)
		}
	case *CNAMERdata:
		variantBytes, err := v.EncodeWithContext(childCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to encode CNAMERdata variant: %w", err)
		}
		for _, b := range variantBytes {
			encoder.WriteUint8(b)
		}
	default:
		return nil, fmt.Errorf("unknown discriminated union variant type: %T", m.Rdata)
	}

	return encoder.Finish(), nil
}

func (m *ResourceRecord) CalculateSize() int {
	size := 0

	size += m.Name.CalculateSize() // Name
	size += 2 // Type
	size += 2 // Class
	size += 4 // Ttl
	size += 2 // Rdlength
	// Rdata: inline discriminated union (encode to measure)
	if m.Rdata != nil {
		Rdata_bytes, _ := m.Rdata.(interface{ Encode() ([]byte, error) }).Encode()
		size += len(Rdata_bytes)
	}

	return size
}

func DecodeResourceRecord(bytes []byte) (*ResourceRecord, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeResourceRecordWithDecoder(decoder)
}

func decodeResourceRecordWithDecoder(decoder *runtime.BitStreamDecoder) (*ResourceRecord, error) {
	result := &ResourceRecord{}

	name, err := decodeCompressedDomainWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode name: %w", err)
	}
	result.Name = *name

	type_, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode type: %w", err)
	}
	result.Type = type_

	class, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode class: %w", err)
	}
	result.Class = class

	ttl, err := decoder.ReadUint32(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ttl: %w", err)
	}
	result.Ttl = ttl

	rdlength, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode rdlength: %w", err)
	}
	result.Rdlength = rdlength

	if result.Type == 1 {
		variantValue, err := decodeARdataWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode ARdata variant: %w", err)
		}
		result.Rdata = variantValue
	} else if result.Type == 2 {
		variantValue, err := decodeNSRdataWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode NSRdata variant: %w", err)
		}
		result.Rdata = variantValue
	} else if result.Type == 5 {
		variantValue, err := decodeCNAMERdataWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode CNAMERdata variant: %w", err)
		}
		result.Rdata = variantValue
	} else {
		return nil, fmt.Errorf("unknown discriminator value for rdata: %v", result.Type)
	}


	return result, nil
}

type DnsMessage_Flags struct {
	Qr uint8
	Opcode uint8
	Aa uint8
	Tc uint8
	Rd uint8
	Ra uint8
	Z uint8
	Rcode uint8
}

type DnsMessage struct {
	Id uint16
	Flags DnsMessage_Flags
	Qdcount uint16
	Ancount uint16
	Nscount uint16
	Arcount uint16
	Questions []Question
	Answers []ResourceRecord
	Authority []ResourceRecord
	Additional []ResourceRecord
}

func (m *DnsMessage) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *DnsMessage) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"id": m.Id,
		"flags": m.Flags,
		"qdcount": m.Qdcount,
		"ancount": m.Ancount,
		"nscount": m.Nscount,
		"arcount": m.Arcount,
		"questions": m.Questions,
		"answers": m.Answers,
		"authority": m.Authority,
		"additional": m.Additional,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	encoder.WriteUint16(m.Id, runtime.BigEndian)
	encoder.WriteBits(uint64(m.Flags.Qr), 1)
	encoder.WriteBits(uint64(m.Flags.Opcode), 4)
	encoder.WriteBits(uint64(m.Flags.Aa), 1)
	encoder.WriteBits(uint64(m.Flags.Tc), 1)
	encoder.WriteBits(uint64(m.Flags.Rd), 1)
	encoder.WriteBits(uint64(m.Flags.Ra), 1)
	encoder.WriteBits(uint64(m.Flags.Z), 3)
	encoder.WriteBits(uint64(m.Flags.Rcode), 4)
	encoder.WriteUint16(m.Qdcount, runtime.BigEndian)
	encoder.WriteUint16(m.Ancount, runtime.BigEndian)
	encoder.WriteUint16(m.Nscount, runtime.BigEndian)
	encoder.WriteUint16(m.Arcount, runtime.BigEndian)
	for _, Questions_item := range m.Questions {
		Questions_item_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
		Questions_item_bytes, err := Questions_item.EncodeWithContext(Questions_item_ctx)
		if err != nil {
			return nil, err
		}
		for _, b := range Questions_item_bytes {
			encoder.WriteUint8(b)
		}
	}
	for _, Answers_item := range m.Answers {
		Answers_item_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
		Answers_item_bytes, err := Answers_item.EncodeWithContext(Answers_item_ctx)
		if err != nil {
			return nil, err
		}
		for _, b := range Answers_item_bytes {
			encoder.WriteUint8(b)
		}
	}
	for _, Authority_item := range m.Authority {
		Authority_item_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
		Authority_item_bytes, err := Authority_item.EncodeWithContext(Authority_item_ctx)
		if err != nil {
			return nil, err
		}
		for _, b := range Authority_item_bytes {
			encoder.WriteUint8(b)
		}
	}
	for _, Additional_item := range m.Additional {
		Additional_item_ctx := childCtx.WithByteOffset(ctx.ByteOffset + encoder.Position())
		Additional_item_bytes, err := Additional_item.EncodeWithContext(Additional_item_ctx)
		if err != nil {
			return nil, err
		}
		for _, b := range Additional_item_bytes {
			encoder.WriteUint8(b)
		}
	}

	return encoder.Finish(), nil
}

func (m *DnsMessage) CalculateSize() int {
	size := 0

	size += 2 // Id
	size += 2 // Flags (bitfield: 16 bits)
	size += 2 // Qdcount
	size += 2 // Ancount
	size += 2 // Nscount
	size += 2 // Arcount
	for _, Questions_item := range m.Questions {
		size += Questions_item.CalculateSize()
	}
	for _, Answers_item := range m.Answers {
		size += Answers_item.CalculateSize()
	}
	for _, Authority_item := range m.Authority {
		size += Authority_item.CalculateSize()
	}
	for _, Additional_item := range m.Additional {
		size += Additional_item.CalculateSize()
	}

	return size
}

func DecodeDnsMessage(bytes []byte) (*DnsMessage, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeDnsMessageWithDecoder(decoder)
}

// DecodeDnsMessagePooled decodes using a pooled decoder for better performance
func DecodeDnsMessagePooled(bytes []byte) (*DnsMessage, error) {
	decoder := runtime.AcquireDecoder(bytes, runtime.MSBFirst)
	result, err := decodeDnsMessageWithDecoder(decoder)
	runtime.ReleaseDecoder(decoder)
	return result, err
}

func decodeDnsMessageWithDecoder(decoder *runtime.BitStreamDecoder) (*DnsMessage, error) {
	result := &DnsMessage{}

	id, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode id: %w", err)
	}
	result.Id = id

	flags_Qr, err := decoder.ReadBits(1)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.qr: %w", err)
	}
	result.Flags.Qr = uint8(flags_Qr)
	flags_Opcode, err := decoder.ReadBits(4)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.opcode: %w", err)
	}
	result.Flags.Opcode = uint8(flags_Opcode)
	flags_Aa, err := decoder.ReadBits(1)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.aa: %w", err)
	}
	result.Flags.Aa = uint8(flags_Aa)
	flags_Tc, err := decoder.ReadBits(1)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.tc: %w", err)
	}
	result.Flags.Tc = uint8(flags_Tc)
	flags_Rd, err := decoder.ReadBits(1)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.rd: %w", err)
	}
	result.Flags.Rd = uint8(flags_Rd)
	flags_Ra, err := decoder.ReadBits(1)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.ra: %w", err)
	}
	result.Flags.Ra = uint8(flags_Ra)
	flags_Z, err := decoder.ReadBits(3)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.z: %w", err)
	}
	result.Flags.Z = uint8(flags_Z)
	flags_Rcode, err := decoder.ReadBits(4)
	if err != nil {
		return nil, fmt.Errorf("failed to decode flags.rcode: %w", err)
	}
	result.Flags.Rcode = uint8(flags_Rcode)

	qdcount, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode qdcount: %w", err)
	}
	result.Qdcount = qdcount

	ancount, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ancount: %w", err)
	}
	result.Ancount = ancount

	nscount, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nscount: %w", err)
	}
	result.Nscount = nscount

	arcount, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode arcount: %w", err)
	}
	result.Arcount = arcount

	result.Questions = make([]Question, result.Qdcount)
	for i := range result.Questions {
		questionsItem, err := decodeQuestionWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result.Questions[i] = *questionsItem
	}

	result.Answers = make([]ResourceRecord, result.Ancount)
	for i := range result.Answers {
		answersItem, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result.Answers[i] = *answersItem
	}

	result.Authority = make([]ResourceRecord, result.Nscount)
	for i := range result.Authority {
		authorityItem, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result.Authority[i] = *authorityItem
	}

	result.Additional = make([]ResourceRecord, result.Arcount)
	for i := range result.Additional {
		additionalItem, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result.Additional[i] = *additionalItem
	}


	return result, nil
}
