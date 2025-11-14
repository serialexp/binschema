package main

import (
	"fmt"
	"github.com/anthropics/binschema/runtime"
)

type ARdata struct {
	Address uint32
}

func (m *ARdata) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	encoder.WriteUint32(m.Address, runtime.BigEndian)

	return encoder.Finish(), nil
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

type CNAMERdata struct {
	Cname CompressedDomain
}

func (m *CNAMERdata) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Cname_bytes, err := m.Cname.Encode()
	if err != nil {
		return nil, err
	}
	for _, b := range m_Cname_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
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

type CompressedDomain struct {
	Value []CompressedLabel
}

func (m *CompressedDomain) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	for _, Value_item := range m.Value {
		Value_item_bytes, err := Value_item.Encode()
		if err != nil {
			return nil, err
		}
		for _, b := range Value_item_bytes {
			encoder.WriteUint8(b)
		}
	}
	encoder.WriteUint8(0)

	return encoder.Finish(), nil
}

func DecodeCompressedDomain(bytes []byte) (*CompressedDomain, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeCompressedDomainWithDecoder(decoder)
}

func decodeCompressedDomainWithDecoder(decoder *runtime.BitStreamDecoder) (*CompressedDomain, error) {
	result := &CompressedDomain{}

	result.Value = []CompressedLabel{}
	for {
		valueItem, err := decodeCompressedLabelWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *valueItem

		result.Value = append(result.Value, valueItem)
	}


	return result, nil
}

type CompressedLabel struct {
	Value Discriminated_union
}

func (m *CompressedLabel) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Value_bytes, err := m.Value.Encode()
	if err != nil {
		return nil, err
	}
	for _, b := range m_Value_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func DecodeCompressedLabel(bytes []byte) (*CompressedLabel, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeCompressedLabelWithDecoder(decoder)
}

func decodeCompressedLabelWithDecoder(decoder *runtime.BitStreamDecoder) (*CompressedLabel, error) {
	result := &CompressedLabel{}

	value, err := decodeDiscriminated_unionWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode value: %w", err)
	}
	result.Value = *value


	return result, nil
}

type DnsMessage struct {
	Id uint16
	Flags uint64
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
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	encoder.WriteUint16(m.Id, runtime.BigEndian)
	// TODO: Bitfield encoding for m.Flags
	encoder.WriteUint16(m.Qdcount, runtime.BigEndian)
	encoder.WriteUint16(m.Ancount, runtime.BigEndian)
	encoder.WriteUint16(m.Nscount, runtime.BigEndian)
	encoder.WriteUint16(m.Arcount, runtime.BigEndian)
	for _, Questions_item := range m.Questions {
		Questions_item_bytes, err := Questions_item.Encode()
		if err != nil {
			return nil, err
		}
		for _, b := range Questions_item_bytes {
			encoder.WriteUint8(b)
		}
	}
	for _, Answers_item := range m.Answers {
		Answers_item_bytes, err := Answers_item.Encode()
		if err != nil {
			return nil, err
		}
		for _, b := range Answers_item_bytes {
			encoder.WriteUint8(b)
		}
	}
	for _, Authority_item := range m.Authority {
		Authority_item_bytes, err := Authority_item.Encode()
		if err != nil {
			return nil, err
		}
		for _, b := range Authority_item_bytes {
			encoder.WriteUint8(b)
		}
	}
	for _, Additional_item := range m.Additional {
		Additional_item_bytes, err := Additional_item.Encode()
		if err != nil {
			return nil, err
		}
		for _, b := range Additional_item_bytes {
			encoder.WriteUint8(b)
		}
	}

	return encoder.Finish(), nil
}

func DecodeDnsMessage(bytes []byte) (*DnsMessage, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeDnsMessageWithDecoder(decoder)
}

func decodeDnsMessageWithDecoder(decoder *runtime.BitStreamDecoder) (*DnsMessage, error) {
	result := &DnsMessage{}

	id, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode id: %w", err)
	}
	result.Id = id

	// TODO: Bitfield decoding for Flags
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
		result. = *questionsItem


	result.Answers = make([]ResourceRecord, result.Ancount)
	for i := range result.Answers {
		answersItem, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *answersItem


	result.Authority = make([]ResourceRecord, result.Nscount)
	for i := range result.Authority {
		authorityItem, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *authorityItem


	result.Additional = make([]ResourceRecord, result.Arcount)
	for i := range result.Additional {
		additionalItem, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *additionalItem



	return result, nil
}

type Label struct {
	Value string
}

func (m *Label) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Value_bytes := []byte(m.Value)
	encoder.WriteUint8(uint8(len(m_Value_bytes)))
	for _, b := range m_Value_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func DecodeLabel(bytes []byte) (*Label, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeLabelWithDecoder(decoder)
}

func decodeLabelWithDecoder(decoder *runtime.BitStreamDecoder) (*Label, error) {
	result := &Label{}

	length, err := decoder.ReadUint8()
	if err != nil {
		return nil, fmt.Errorf("failed to decode value length: %w", err)
	}
	valueBytes := make([]byte, length)
	for i := range valueBytes {
		b, err := decoder.ReadUint8()
		if err != nil {
			return nil, fmt.Errorf("failed to decode value: %w", err)
		}
		valueBytes[i] = b
	}
	result.Value = string(valueBytes)


	return result, nil
}

type LabelPointer struct {
	Value Back_reference
}

func (m *LabelPointer) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Value_bytes, err := m.Value.Encode()
	if err != nil {
		return nil, err
	}
	for _, b := range m_Value_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func DecodeLabelPointer(bytes []byte) (*LabelPointer, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeLabelPointerWithDecoder(decoder)
}

func decodeLabelPointerWithDecoder(decoder *runtime.BitStreamDecoder) (*LabelPointer, error) {
	result := &LabelPointer{}

	value, err := decodeBack_referenceWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode value: %w", err)
	}
	result.Value = *value


	return result, nil
}

type NSRdata struct {
	Nsdname CompressedDomain
}

func (m *NSRdata) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Nsdname_bytes, err := m.Nsdname.Encode()
	if err != nil {
		return nil, err
	}
	for _, b := range m_Nsdname_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
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

type Question struct {
	Qname CompressedDomain
	Qtype uint16
	Qclass uint16
}

func (m *Question) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Qname_bytes, err := m.Qname.Encode()
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

type ResourceRecord struct {
	Name CompressedDomain
	Type uint16
	Class uint16
	Ttl uint32
	Rdlength uint16
	Rdata Discriminated_union
}

func (m *ResourceRecord) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Name_bytes, err := m.Name.Encode()
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
	m_Rdata_bytes, err := m.Rdata.Encode()
	if err != nil {
		return nil, err
	}
	for _, b := range m_Rdata_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
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

	type, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode type: %w", err)
	}
	result.Type = type

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

	rdata, err := decodeDiscriminated_unionWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode rdata: %w", err)
	}
	result.Rdata = *rdata


	return result, nil
}
