package binschema

import (
	"encoding/binary"
	"errors"
	"fmt"
)

// Inline decoder - no allocation, operates directly on byte slice
type inlineDecoder struct {
	data   []byte
	pos    int
	bitPos int // 0-7, bits consumed in current byte
}

func (d *inlineDecoder) readUint8() (uint8, error) {
	if d.bitPos != 0 {
		return 0, errors.New("unaligned read")
	}
	if d.pos >= len(d.data) {
		return 0, errors.New("unexpected end of data")
	}
	v := d.data[d.pos]
	d.pos++
	return v, nil
}

func (d *inlineDecoder) readUint16BE() (uint16, error) {
	if d.bitPos != 0 {
		return 0, errors.New("unaligned read")
	}
	if d.pos+2 > len(d.data) {
		return 0, errors.New("unexpected end of data")
	}
	v := binary.BigEndian.Uint16(d.data[d.pos:])
	d.pos += 2
	return v, nil
}

func (d *inlineDecoder) readUint32BE() (uint32, error) {
	if d.bitPos != 0 {
		return 0, errors.New("unaligned read")
	}
	if d.pos+4 > len(d.data) {
		return 0, errors.New("unexpected end of data")
	}
	v := binary.BigEndian.Uint32(d.data[d.pos:])
	d.pos += 4
	return v, nil
}

func (d *inlineDecoder) peekUint8() (uint8, error) {
	if d.bitPos != 0 {
		return 0, errors.New("unaligned peek")
	}
	if d.pos >= len(d.data) {
		return 0, errors.New("unexpected end of data")
	}
	return d.data[d.pos], nil
}

func (d *inlineDecoder) readBits(n int) (uint64, error) {
	if n > 8 {
		return 0, errors.New("readBits > 8 not supported inline")
	}

	if d.pos >= len(d.data) {
		return 0, errors.New("unexpected end of data")
	}

	// MSB first bit reading
	currentByte := d.data[d.pos]
	bitsAvailable := 8 - d.bitPos

	if n <= bitsAvailable {
		// All bits from current byte
		shift := bitsAvailable - n
		mask := uint8((1 << n) - 1)
		result := uint64((currentByte >> shift) & mask)
		d.bitPos += n
		if d.bitPos == 8 {
			d.bitPos = 0
			d.pos++
		}
		return result, nil
	}

	// Need bits from next byte too
	if d.pos+1 >= len(d.data) {
		return 0, errors.New("unexpected end of data")
	}

	// Get remaining bits from current byte
	mask1 := uint8((1 << bitsAvailable) - 1)
	part1 := uint64(currentByte & mask1)

	// Get bits needed from next byte
	bitsFromNext := n - bitsAvailable
	nextByte := d.data[d.pos+1]
	shift := 8 - bitsFromNext
	mask2 := uint8((1 << bitsFromNext) - 1)
	part2 := uint64((nextByte >> shift) & mask2)

	result := (part1 << bitsFromNext) | part2

	d.pos++
	d.bitPos = bitsFromNext

	return result, nil
}

func (d *inlineDecoder) seek(pos int) {
	d.pos = pos
	d.bitPos = 0
}

func (d *inlineDecoder) position() int {
	return d.pos
}

// DecodeDnsMessageInline decodes without any allocations for the decoder
func DecodeDnsMessageInline(data []byte) (*DnsMessage, error) {
	d := inlineDecoder{data: data}
	return decodeDnsMessageInline(&d)
}

func decodeDnsMessageInline(d *inlineDecoder) (*DnsMessage, error) {
	result := &DnsMessage{}

	id, err := d.readUint16BE()
	if err != nil {
		return nil, err
	}
	result.Id = id

	// Flags bitfield (16 bits total)
	qr, _ := d.readBits(1)
	result.Flags.Qr = uint8(qr)
	opcode, _ := d.readBits(4)
	result.Flags.Opcode = uint8(opcode)
	aa, _ := d.readBits(1)
	result.Flags.Aa = uint8(aa)
	tc, _ := d.readBits(1)
	result.Flags.Tc = uint8(tc)
	rd, _ := d.readBits(1)
	result.Flags.Rd = uint8(rd)
	ra, _ := d.readBits(1)
	result.Flags.Ra = uint8(ra)
	z, _ := d.readBits(3)
	result.Flags.Z = uint8(z)
	rcode, _ := d.readBits(4)
	result.Flags.Rcode = uint8(rcode)

	result.Qdcount, _ = d.readUint16BE()
	result.Ancount, _ = d.readUint16BE()
	result.Nscount, _ = d.readUint16BE()
	result.Arcount, _ = d.readUint16BE()

	// Decode questions
	result.Questions = make([]Question, result.Qdcount)
	for i := range result.Questions {
		q, err := decodeQuestionInline(d)
		if err != nil {
			return nil, err
		}
		result.Questions[i] = *q
	}

	// Decode answers
	result.Answers = make([]ResourceRecord, result.Ancount)
	for i := range result.Answers {
		rr, err := decodeResourceRecordInline(d)
		if err != nil {
			return nil, err
		}
		result.Answers[i] = *rr
	}

	// Decode authority
	result.Authority = make([]ResourceRecord, result.Nscount)
	for i := range result.Authority {
		rr, err := decodeResourceRecordInline(d)
		if err != nil {
			return nil, err
		}
		result.Authority[i] = *rr
	}

	// Decode additional
	result.Additional = make([]ResourceRecord, result.Arcount)
	for i := range result.Additional {
		rr, err := decodeResourceRecordInline(d)
		if err != nil {
			return nil, err
		}
		result.Additional[i] = *rr
	}

	return result, nil
}

func decodeQuestionInline(d *inlineDecoder) (*Question, error) {
	result := &Question{}

	domain, err := decodeCompressedDomainInline(d)
	if err != nil {
		return nil, err
	}
	result.Qname = *domain

	result.Qtype, _ = d.readUint16BE()
	result.Qclass, _ = d.readUint16BE()

	return result, nil
}

func decodeCompressedDomainInline(d *inlineDecoder) (*CompressedDomain, error) {
	result := &CompressedDomain{}
	result.Value = make([]CompressedLabel, 0, 4)

	for {
		b, err := d.peekUint8()
		if err != nil {
			return nil, err
		}

		if b == 0 {
			d.readUint8() // consume null terminator
			break
		}

		if b >= 0xC0 {
			// Compression pointer
			ptr, err := decodeLabelPointerInline(d)
			if err != nil {
				return nil, err
			}
			result.Value = append(result.Value, ptr)
			break // Pointer is terminal
		}

		// Regular label
		label, err := decodeLabelInline(d)
		if err != nil {
			return nil, err
		}
		result.Value = append(result.Value, label)
	}

	return result, nil
}

func decodeLabelInline(d *inlineDecoder) (*Label, error) {
	length, err := d.readUint8()
	if err != nil {
		return nil, err
	}

	if d.pos+int(length) > len(d.data) {
		return nil, errors.New("label exceeds data")
	}

	value := string(d.data[d.pos : d.pos+int(length)])
	d.pos += int(length)

	return &Label{Value: value}, nil
}

func decodeLabelPointerInline(d *inlineDecoder) (*LabelPointer, error) {
	ptrVal, err := d.readUint16BE()
	if err != nil {
		return nil, err
	}

	offset := int(ptrVal & 0x3FFF)
	savedPos := d.position()
	d.seek(offset)

	label, err := decodeLabelInline(d)
	if err != nil {
		return nil, err
	}

	d.seek(savedPos)

	return &LabelPointer{Value: *label}, nil
}

func decodeResourceRecordInline(d *inlineDecoder) (*ResourceRecord, error) {
	result := &ResourceRecord{}

	domain, err := decodeCompressedDomainInline(d)
	if err != nil {
		return nil, err
	}
	result.Name = *domain

	result.Type, _ = d.readUint16BE()
	result.Class, _ = d.readUint16BE()
	result.Ttl, _ = d.readUint32BE()
	result.Rdlength, _ = d.readUint16BE()

	// Decode RDATA based on type
	switch result.Type {
	case 1: // A record
		addr, _ := d.readUint32BE()
		result.Rdata = &ARdata{Address: addr}
	case 2: // NS record
		ns, err := decodeCompressedDomainInline(d)
		if err != nil {
			return nil, err
		}
		result.Rdata = &NSRdata{Nsdname: *ns}
	case 5: // CNAME record
		cname, err := decodeCompressedDomainInline(d)
		if err != nil {
			return nil, err
		}
		result.Rdata = &CNAMERdata{Cname: *cname}
	default:
		return nil, fmt.Errorf("unsupported record type: %d", result.Type)
	}

	return result, nil
}
