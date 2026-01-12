package binschema

import (
	"encoding/binary"
	"errors"
)

// Optimized types - use []byte instead of string, value types where possible

// LabelOpt uses []byte to avoid string copy
type LabelOpt struct {
	Value []byte // Points into original data - no copy!
}

// CompressedDomainOpt avoids interface{} by using a simpler structure
type CompressedDomainOpt struct {
	Labels     []LabelOpt
	IsPointer  bool
	PointerRef LabelOpt // Only valid if IsPointer is true (from last label)
}

// QuestionOpt uses value types
type QuestionOpt struct {
	Qname  CompressedDomainOpt
	Qtype  uint16
	Qclass uint16
}

// ResourceRecordOpt avoids interface{} for RDATA
type ResourceRecordOpt struct {
	Name     CompressedDomainOpt
	Type     uint16
	Class    uint16
	Ttl      uint32
	Rdlength uint16
	// Inline RDATA variants - only one is valid based on Type
	AAddress uint32              // Type == 1
	NSDomain CompressedDomainOpt // Type == 2
	CName    CompressedDomainOpt // Type == 5
}

// DnsMessageOpt is the optimized message structure
type DnsMessageOpt struct {
	Id         uint16
	Flags      DnsMessage_Flags // Reuse the flags struct
	Qdcount    uint16
	Ancount    uint16
	Nscount    uint16
	Arcount    uint16
	Questions  []QuestionOpt
	Answers    []ResourceRecordOpt
	Authority  []ResourceRecordOpt
	Additional []ResourceRecordOpt
}

// Optimized inline decoder that returns value types
type optDecoder struct {
	data   []byte
	pos    int
	bitPos int
}

func (d *optDecoder) u8() uint8 {
	v := d.data[d.pos]
	d.pos++
	return v
}

func (d *optDecoder) u16be() uint16 {
	v := binary.BigEndian.Uint16(d.data[d.pos:])
	d.pos += 2
	return v
}

func (d *optDecoder) u32be() uint32 {
	v := binary.BigEndian.Uint32(d.data[d.pos:])
	d.pos += 4
	return v
}

func (d *optDecoder) peek() uint8 {
	return d.data[d.pos]
}

func (d *optDecoder) bits(n int) uint8 {
	currentByte := d.data[d.pos]
	bitsAvailable := 8 - d.bitPos

	if n <= bitsAvailable {
		shift := bitsAvailable - n
		mask := uint8((1 << n) - 1)
		result := (currentByte >> shift) & mask
		d.bitPos += n
		if d.bitPos == 8 {
			d.bitPos = 0
			d.pos++
		}
		return result
	}

	// Cross byte boundary
	mask1 := uint8((1 << bitsAvailable) - 1)
	part1 := currentByte & mask1

	bitsFromNext := n - bitsAvailable
	nextByte := d.data[d.pos+1]
	shift := 8 - bitsFromNext
	mask2 := uint8((1 << bitsFromNext) - 1)
	part2 := (nextByte >> shift) & mask2

	d.pos++
	d.bitPos = bitsFromNext

	return (part1 << bitsFromNext) | part2
}

// DecodeDnsMessageOptimized is the fully optimized decoder
func DecodeDnsMessageOptimized(data []byte) (*DnsMessageOpt, error) {
	if len(data) < 12 {
		return nil, errors.New("data too short")
	}

	d := optDecoder{data: data}
	result := &DnsMessageOpt{}

	result.Id = d.u16be()

	// Flags
	result.Flags.Qr = d.bits(1)
	result.Flags.Opcode = d.bits(4)
	result.Flags.Aa = d.bits(1)
	result.Flags.Tc = d.bits(1)
	result.Flags.Rd = d.bits(1)
	result.Flags.Ra = d.bits(1)
	result.Flags.Z = d.bits(3)
	result.Flags.Rcode = d.bits(4)

	result.Qdcount = d.u16be()
	result.Ancount = d.u16be()
	result.Nscount = d.u16be()
	result.Arcount = d.u16be()

	// Pre-allocate slices
	result.Questions = make([]QuestionOpt, result.Qdcount)
	result.Answers = make([]ResourceRecordOpt, result.Ancount)
	result.Authority = make([]ResourceRecordOpt, result.Nscount)
	result.Additional = make([]ResourceRecordOpt, result.Arcount)

	// Decode questions - returns value type directly into slice
	for i := range result.Questions {
		result.Questions[i] = decodeQuestionOpt(&d)
	}

	for i := range result.Answers {
		result.Answers[i] = decodeResourceRecordOpt(&d)
	}

	for i := range result.Authority {
		result.Authority[i] = decodeResourceRecordOpt(&d)
	}

	for i := range result.Additional {
		result.Additional[i] = decodeResourceRecordOpt(&d)
	}

	return result, nil
}

func decodeQuestionOpt(d *optDecoder) QuestionOpt {
	return QuestionOpt{
		Qname:  decodeDomainOpt(d),
		Qtype:  d.u16be(),
		Qclass: d.u16be(),
	}
}

func decodeDomainOpt(d *optDecoder) CompressedDomainOpt {
	result := CompressedDomainOpt{
		Labels: make([]LabelOpt, 0, 4),
	}

	for {
		b := d.peek()

		if b == 0 {
			d.pos++ // consume null
			break
		}

		if b >= 0xC0 {
			// Compression pointer
			ptrVal := d.u16be()
			offset := int(ptrVal & 0x3FFF)

			// Read the referenced label
			savedPos := d.pos
			d.pos = offset
			label := decodeLabelOpt(d)
			d.pos = savedPos

			result.IsPointer = true
			result.PointerRef = label
			break
		}

		result.Labels = append(result.Labels, decodeLabelOpt(d))
	}

	return result
}

func decodeLabelOpt(d *optDecoder) LabelOpt {
	length := d.u8()
	// Zero-copy: slice directly into input data
	value := d.data[d.pos : d.pos+int(length)]
	d.pos += int(length)
	return LabelOpt{Value: value}
}

func decodeResourceRecordOpt(d *optDecoder) ResourceRecordOpt {
	result := ResourceRecordOpt{
		Name:     decodeDomainOpt(d),
		Type:     d.u16be(),
		Class:    d.u16be(),
		Ttl:      d.u32be(),
		Rdlength: d.u16be(),
	}

	switch result.Type {
	case 1: // A record
		result.AAddress = d.u32be()
	case 2: // NS
		result.NSDomain = decodeDomainOpt(d)
	case 5: // CNAME
		result.CName = decodeDomainOpt(d)
	default:
		// Skip unknown RDATA
		d.pos += int(result.Rdlength)
	}

	return result
}
