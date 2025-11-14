package main

import (
	"fmt"
	"github.com/anthropics/binschema/runtime"
)

type dns_cname_record_ARdata struct {
	Address uint32
}

func (m *dns_cname_record_ARdata) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	encoder.WriteUint32(m.Address, runtime.BigEndian)

	return encoder.Finish(), nil
}

func Decodedns_cname_record_ARdata(bytes []byte) (*dns_cname_record_ARdata, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeARdataWithDecoder(decoder)
}

func dns_cname_record_decodeARdataWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_ARdata, error) {
	result := &dns_cname_record_ARdata{}

	address, err := decoder.ReadUint32(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode address: %w", err)
	}
	result.Address = address


	return result, nil
}

type dns_cname_record_CNAMERdata struct {
	Cname dns_cname_record_CompressedDomain
}

func (m *dns_cname_record_CNAMERdata) Encode() ([]byte, error) {
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

func Decodedns_cname_record_CNAMERdata(bytes []byte) (*dns_cname_record_CNAMERdata, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeCNAMERdataWithDecoder(decoder)
}

func dns_cname_record_decodeCNAMERdataWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_CNAMERdata, error) {
	result := &dns_cname_record_CNAMERdata{}

	cname, err := dns_cname_record_decodeCompressedDomainWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode cname: %w", err)
	}
	result.Cname = *cname


	return result, nil
}

type dns_cname_record_CompressedDomain struct {
	Value []dns_cname_record_CompressedLabel
}

func (m *dns_cname_record_CompressedDomain) Encode() ([]byte, error) {
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

func Decodedns_cname_record_CompressedDomain(bytes []byte) (*dns_cname_record_CompressedDomain, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeCompressedDomainWithDecoder(decoder)
}

func dns_cname_record_decodeCompressedDomainWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_CompressedDomain, error) {
	result := &dns_cname_record_CompressedDomain{}

	result.Value = []dns_cname_record_CompressedLabel{}
	for {
		valueItem, err := dns_cname_record_decodeCompressedLabelWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *valueItem

		result.Value = append(result.Value, valueItem)
	}


	return result, nil
}

type dns_cname_record_CompressedLabel struct {
	Value dns_cname_record_Discriminated_union
}

func (m *dns_cname_record_CompressedLabel) Encode() ([]byte, error) {
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

func Decodedns_cname_record_CompressedLabel(bytes []byte) (*dns_cname_record_CompressedLabel, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeCompressedLabelWithDecoder(decoder)
}

func dns_cname_record_decodeCompressedLabelWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_CompressedLabel, error) {
	result := &dns_cname_record_CompressedLabel{}

	value, err := decodeDiscriminated_unionWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode value: %w", err)
	}
	result.Value = *value


	return result, nil
}

type dns_cname_record_DnsMessage struct {
	Id uint16
	Flags uint64
	Qdcount uint16
	Ancount uint16
	Nscount uint16
	Arcount uint16
	Questions []dns_cname_record_Question
	Answers []dns_cname_record_ResourceRecord
	Authority []dns_cname_record_ResourceRecord
	Additional []dns_cname_record_ResourceRecord
}

func (m *dns_cname_record_DnsMessage) Encode() ([]byte, error) {
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

func Decodedns_cname_record_DnsMessage(bytes []byte) (*dns_cname_record_DnsMessage, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeDnsMessageWithDecoder(decoder)
}

func dns_cname_record_decodeDnsMessageWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_DnsMessage, error) {
	result := &dns_cname_record_DnsMessage{}

	id, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode id: %w", err)
	}
	result.Id = id

	// TODO: Bitfield decoding for dns_cname_record_Flags
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

	result.Questions = make([]dns_cname_record_Question, result.Qdcount)
	for i := range result.Questions {
		questionsItem, err := dns_cname_record_decodeQuestionWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *questionsItem


	result.Answers = make([]dns_cname_record_ResourceRecord, result.Ancount)
	for i := range result.Answers {
		answersItem, err := dns_cname_record_decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *answersItem


	result.Authority = make([]dns_cname_record_ResourceRecord, result.Nscount)
	for i := range result.Authority {
		authorityItem, err := dns_cname_record_decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *authorityItem


	result.Additional = make([]dns_cname_record_ResourceRecord, result.Arcount)
	for i := range result.Additional {
		additionalItem, err := dns_cname_record_decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode nested struct: %w", err)
		}
		result. = *additionalItem



	return result, nil
}

type dns_cname_record_Label struct {
	Value string
}

func (m *dns_cname_record_Label) Encode() ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	m_Value_bytes := []byte(m.Value)
	encoder.WriteUint8(uint8(len(m_Value_bytes)))
	for _, b := range m_Value_bytes {
		encoder.WriteUint8(b)
	}

	return encoder.Finish(), nil
}

func Decodedns_cname_record_Label(bytes []byte) (*dns_cname_record_Label, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeLabelWithDecoder(decoder)
}

func dns_cname_record_decodeLabelWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_Label, error) {
	result := &dns_cname_record_Label{}

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

type dns_cname_record_LabelPointer struct {
	Value dns_cname_record_Back_reference
}

func (m *dns_cname_record_LabelPointer) Encode() ([]byte, error) {
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

func Decodedns_cname_record_LabelPointer(bytes []byte) (*dns_cname_record_LabelPointer, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeLabelPointerWithDecoder(decoder)
}

func dns_cname_record_decodeLabelPointerWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_LabelPointer, error) {
	result := &dns_cname_record_LabelPointer{}

	value, err := decodeBack_referenceWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode value: %w", err)
	}
	result.Value = *value


	return result, nil
}

type dns_cname_record_NSRdata struct {
	Nsdname dns_cname_record_CompressedDomain
}

func (m *dns_cname_record_NSRdata) Encode() ([]byte, error) {
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

func Decodedns_cname_record_NSRdata(bytes []byte) (*dns_cname_record_NSRdata, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeNSRdataWithDecoder(decoder)
}

func dns_cname_record_decodeNSRdataWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_NSRdata, error) {
	result := &dns_cname_record_NSRdata{}

	nsdname, err := dns_cname_record_decodeCompressedDomainWithDecoder(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nsdname: %w", err)
	}
	result.Nsdname = *nsdname


	return result, nil
}

type dns_cname_record_Question struct {
	Qname dns_cname_record_CompressedDomain
	Qtype uint16
	Qclass uint16
}

func (m *dns_cname_record_Question) Encode() ([]byte, error) {
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

func Decodedns_cname_record_Question(bytes []byte) (*dns_cname_record_Question, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeQuestionWithDecoder(decoder)
}

func dns_cname_record_decodeQuestionWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_Question, error) {
	result := &dns_cname_record_Question{}

	qname, err := dns_cname_record_decodeCompressedDomainWithDecoder(decoder)
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

type dns_cname_record_ResourceRecord struct {
	Name dns_cname_record_CompressedDomain
	Type uint16
	Class uint16
	Ttl uint32
	Rdlength uint16
	Rdata dns_cname_record_Discriminated_union
}

func (m *dns_cname_record_ResourceRecord) Encode() ([]byte, error) {
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

func Decodedns_cname_record_ResourceRecord(bytes []byte) (*dns_cname_record_ResourceRecord, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return dns_cname_record_decodeResourceRecordWithDecoder(decoder)
}

func dns_cname_record_decodeResourceRecordWithDecoder(decoder *runtime.BitStreamDecoder) (*dns_cname_record_ResourceRecord, error) {
	result := &dns_cname_record_ResourceRecord{}

	name, err := dns_cname_record_decodeCompressedDomainWithDecoder(decoder)
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
