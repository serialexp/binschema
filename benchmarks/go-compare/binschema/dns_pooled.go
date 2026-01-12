package binschema

import (
	"fmt"
	"sync"

	"github.com/anthropics/binschema/benchmarks/go-compare/binschema/runtime"
)

// Pre-allocated decode context with reusable buffers
type DnsDecodeContext struct {
	decoder     *runtime.BitStreamDecoder
	result      DnsMessage
	questions   [16]Question        // Pre-allocated question buffer (most DNS has 1)
	answers     [16]ResourceRecord  // Pre-allocated answers buffer
	authority   [16]ResourceRecord  // Pre-allocated authority buffer
	additional  [16]ResourceRecord  // Pre-allocated additional buffer
	labels      [64]Label           // Pre-allocated label buffer
	labelIdx    int
}

var dnsContextPool = sync.Pool{
	New: func() interface{} {
		return &DnsDecodeContext{
			decoder: &runtime.BitStreamDecoder{},
		}
	},
}

// AcquireDnsContext gets a decode context from the pool
func AcquireDnsContext() *DnsDecodeContext {
	ctx := dnsContextPool.Get().(*DnsDecodeContext)
	ctx.labelIdx = 0
	return ctx
}

// ReleaseDnsContext returns a context to the pool
func ReleaseDnsContext(ctx *DnsDecodeContext) {
	if ctx == nil {
		return
	}
	// Clear references to allow GC
	ctx.decoder.Reset(nil, runtime.MSBFirst)
	dnsContextPool.Put(ctx)
}

// allocLabel gets a label from the pre-allocated buffer
func (ctx *DnsDecodeContext) allocLabel() *Label {
	if ctx.labelIdx >= len(ctx.labels) {
		// Fallback to heap allocation if we exceed buffer
		return &Label{}
	}
	l := &ctx.labels[ctx.labelIdx]
	ctx.labelIdx++
	return l
}

// DecodeDnsMessageFast decodes using fully pooled structures
func DecodeDnsMessageFast(data []byte) (*DnsMessage, error) {
	ctx := AcquireDnsContext()
	defer ReleaseDnsContext(ctx)

	ctx.decoder.Reset(data, runtime.MSBFirst)

	result := &ctx.result
	decoder := ctx.decoder

	// Parse header
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

	// Use pre-allocated slices if they fit
	if int(qdcount) <= len(ctx.questions) {
		result.Questions = ctx.questions[:qdcount]
	} else {
		result.Questions = make([]Question, qdcount)
	}

	for i := range result.Questions {
		q, err := ctx.decodeQuestionFast(decoder)
		if err != nil {
			return nil, err
		}
		result.Questions[i] = *q
	}

	if int(ancount) <= len(ctx.answers) {
		result.Answers = ctx.answers[:ancount]
	} else {
		result.Answers = make([]ResourceRecord, ancount)
	}

	for i := range result.Answers {
		rr, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, err
		}
		result.Answers[i] = *rr
	}

	if int(nscount) <= len(ctx.authority) {
		result.Authority = ctx.authority[:nscount]
	} else {
		result.Authority = make([]ResourceRecord, nscount)
	}

	for i := range result.Authority {
		rr, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, err
		}
		result.Authority[i] = *rr
	}

	if int(arcount) <= len(ctx.additional) {
		result.Additional = ctx.additional[:arcount]
	} else {
		result.Additional = make([]ResourceRecord, arcount)
	}

	for i := range result.Additional {
		rr, err := decodeResourceRecordWithDecoder(decoder)
		if err != nil {
			return nil, err
		}
		result.Additional[i] = *rr
	}

	// Return a copy since we're returning the pooled struct
	resultCopy := *result
	return &resultCopy, nil
}

func (ctx *DnsDecodeContext) decodeQuestionFast(decoder *runtime.BitStreamDecoder) (*Question, error) {
	result := &Question{}

	domain, err := ctx.decodeCompressedDomainFast(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode qname: %w", err)
	}
	result.Qname = *domain

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

func (ctx *DnsDecodeContext) decodeCompressedDomainFast(decoder *runtime.BitStreamDecoder) (*CompressedDomain, error) {
	result := &CompressedDomain{}
	result.Value = make([]CompressedLabel, 0, 8) // Pre-size for typical domain

valueLoop:
	for {
		peekByte, err := decoder.PeekUint8()
		if err != nil {
			return nil, fmt.Errorf("failed to peek for null terminator: %w", err)
		}
		if peekByte == 0 {
			_, _ = decoder.ReadUint8()
			break valueLoop
		}

		label, err := ctx.decodeCompressedLabelFast(decoder)
		if err != nil {
			return nil, fmt.Errorf("failed to decode label: %w", err)
		}
		result.Value = append(result.Value, label)

		// Check if it's a pointer (terminal)
		if _, ok := label.(*LabelPointer); ok {
			break valueLoop
		}
	}

	return result, nil
}

func (ctx *DnsDecodeContext) decodeCompressedLabelFast(decoder *runtime.BitStreamDecoder) (CompressedLabel, error) {
	discriminator, err := decoder.PeekUint8()
	if err != nil {
		return nil, fmt.Errorf("failed to peek discriminator: %w", err)
	}

	if discriminator < 0xC0 {
		return ctx.decodeLabelFast(decoder)
	} else {
		return decodeLabelPointerWithDecoder(decoder)
	}
}

func (ctx *DnsDecodeContext) decodeLabelFast(decoder *runtime.BitStreamDecoder) (*Label, error) {
	result := ctx.allocLabel()

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
	result.Value = string(valueBytes)

	return result, nil
}
