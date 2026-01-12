package main

import (
	"bytes"
	"testing"

	kaitai_runtime "github.com/kaitai-io/kaitai_struct_go_runtime/kaitai"

	"github.com/anthropics/binschema/benchmarks/go-compare/binschema"
	"github.com/anthropics/binschema/benchmarks/go-compare/cdns"
	"github.com/anthropics/binschema/benchmarks/go-compare/kaitai"
)

// DNS query packet for "example.com" type A (29 bytes)
var dnsQueryPacket = []byte{
	// Header (12 bytes)
	0x12, 0x34, // Transaction ID
	0x01, 0x00, // Flags: standard query, recursion desired
	0x00, 0x01, // Questions: 1
	0x00, 0x00, // Answers: 0
	0x00, 0x00, // Authority: 0
	0x00, 0x00, // Additional: 0
	// Question section
	0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // "example"
	0x03, 0x63, 0x6f, 0x6d, // "com"
	0x00,       // null terminator
	0x00, 0x01, // Type: A
	0x00, 0x01, // Class: IN
}

// DNS response packet for "example.com" with A record and compression (45 bytes)
var dnsResponsePacket = []byte{
	// Header (12 bytes)
	0x12, 0x34, // Transaction ID
	0x81, 0x80, // Flags: response, recursion desired, recursion available
	0x00, 0x01, // Questions: 1
	0x00, 0x01, // Answers: 1
	0x00, 0x00, // Authority: 0
	0x00, 0x00, // Additional: 0
	// Question section
	0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // "example"
	0x03, 0x63, 0x6f, 0x6d, // "com"
	0x00,       // null terminator
	0x00, 0x01, // Type: A
	0x00, 0x01, // Class: IN
	// Answer section (with compression pointer)
	0xc0, 0x0c, // Pointer to offset 12 (example.com)
	0x00, 0x01, // Type: A
	0x00, 0x01, // Class: IN
	0x00, 0x00, 0x0e, 0x10, // TTL: 3600 seconds
	0x00, 0x04, // RDLENGTH: 4
	0x5d, 0xb8, 0xd8, 0x22, // RDATA: 93.184.216.34
}

// BenchmarkKaitaiQueryDecode benchmarks Kaitai Struct DNS query decoding
func BenchmarkKaitaiQueryDecode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		stream := kaitai_runtime.NewStream(bytes.NewReader(dnsQueryPacket))
		result := kaitai.NewDnsPacket()
		if err := result.Read(stream, nil, result); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaQueryDecode benchmarks BinSchema DNS query decoding
func BenchmarkBinSchemaQueryDecode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessage(dnsQueryPacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkKaitaiResponseDecode benchmarks Kaitai Struct DNS response decoding (with compression)
func BenchmarkKaitaiResponseDecode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		stream := kaitai_runtime.NewStream(bytes.NewReader(dnsResponsePacket))
		result := kaitai.NewDnsPacket()
		if err := result.Read(stream, nil, result); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaResponseDecode benchmarks BinSchema DNS response decoding (with compression)
func BenchmarkBinSchemaResponseDecode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessage(dnsResponsePacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// TestKaitaiDecode verifies Kaitai decoding works
func TestKaitaiDecode(t *testing.T) {
	stream := kaitai_runtime.NewStream(bytes.NewReader(dnsQueryPacket))
	result := kaitai.NewDnsPacket()
	if err := result.Read(stream, nil, result); err != nil {
		t.Fatal(err)
	}

	if result.TransactionId != 0x1234 {
		t.Errorf("TransactionId: got %x, want %x", result.TransactionId, 0x1234)
	}
	if result.Qdcount != 1 {
		t.Errorf("Qdcount: got %d, want %d", result.Qdcount, 1)
	}
	if result.Ancount != 0 {
		t.Errorf("Ancount: got %d, want %d", result.Ancount, 0)
	}
}

// TestBinSchemaDecode verifies BinSchema decoding works
func TestBinSchemaDecode(t *testing.T) {
	result, err := binschema.DecodeDnsMessage(dnsQueryPacket)
	if err != nil {
		t.Fatal(err)
	}

	if result.Id != 0x1234 {
		t.Errorf("Id: got %x, want %x", result.Id, 0x1234)
	}
	if result.Qdcount != 1 {
		t.Errorf("Qdcount: got %d, want %d", result.Qdcount, 1)
	}
	if result.Ancount != 0 {
		t.Errorf("Ancount: got %d, want %d", result.Ancount, 0)
	}
}

// BenchmarkBinSchemaQueryDecodePooled benchmarks BinSchema DNS query decoding with pooled decoder
func BenchmarkBinSchemaQueryDecodePooled(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessagePooled(dnsQueryPacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaResponseDecodePooled benchmarks BinSchema DNS response decoding with pooled decoder
func BenchmarkBinSchemaResponseDecodePooled(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessagePooled(dnsResponsePacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaQueryDecodeFast benchmarks BinSchema DNS query decoding with full pooling
func BenchmarkBinSchemaQueryDecodeFast(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessageFast(dnsQueryPacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaResponseDecodeFast benchmarks BinSchema DNS response decoding with full pooling
func BenchmarkBinSchemaResponseDecodeFast(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessageFast(dnsResponsePacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaQueryDecodeInline benchmarks BinSchema DNS query decoding with inline decoder
func BenchmarkBinSchemaQueryDecodeInline(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessageInline(dnsQueryPacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaResponseDecodeInline benchmarks BinSchema DNS response decoding with inline decoder
func BenchmarkBinSchemaResponseDecodeInline(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessageInline(dnsResponsePacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaQueryDecodeOptimized benchmarks fully optimized decoder
func BenchmarkBinSchemaQueryDecodeOptimized(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessageOptimized(dnsQueryPacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBinSchemaResponseDecodeOptimized benchmarks fully optimized decoder
func BenchmarkBinSchemaResponseDecodeOptimized(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := binschema.DecodeDnsMessageOptimized(dnsResponsePacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkCQueryDecode benchmarks hand-optimized C DNS query decoding
func BenchmarkCQueryDecode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := cdns.ParseDNSPacket(dnsQueryPacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkCResponseDecode benchmarks hand-optimized C DNS response decoding (with compression)
func BenchmarkCResponseDecode(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := cdns.ParseDNSPacket(dnsResponsePacket)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// TestBinSchemaDecodeOptimized verifies optimized decoding works
func TestBinSchemaDecodeOptimized(t *testing.T) {
	result, err := binschema.DecodeDnsMessageOptimized(dnsQueryPacket)
	if err != nil {
		t.Fatal(err)
	}

	if result.Id != 0x1234 {
		t.Errorf("Id: got %x, want %x", result.Id, 0x1234)
	}
	if result.Qdcount != 1 {
		t.Errorf("Qdcount: got %d, want %d", result.Qdcount, 1)
	}
	if len(result.Questions) != 1 {
		t.Errorf("Questions len: got %d, want %d", len(result.Questions), 1)
	}
	// Check domain name
	if len(result.Questions[0].Qname.Labels) != 2 {
		t.Errorf("Labels len: got %d, want %d", len(result.Questions[0].Qname.Labels), 2)
	}
	if string(result.Questions[0].Qname.Labels[0].Value) != "example" {
		t.Errorf("Label 0: got %q, want %q", result.Questions[0].Qname.Labels[0].Value, "example")
	}
}

// TestBinSchemaDecodeInline verifies BinSchema inline decoding works
func TestBinSchemaDecodeInline(t *testing.T) {
	result, err := binschema.DecodeDnsMessageInline(dnsQueryPacket)
	if err != nil {
		t.Fatal(err)
	}

	if result.Id != 0x1234 {
		t.Errorf("Id: got %x, want %x", result.Id, 0x1234)
	}
	if result.Qdcount != 1 {
		t.Errorf("Qdcount: got %d, want %d", result.Qdcount, 1)
	}
	if len(result.Questions) != 1 {
		t.Errorf("Questions len: got %d, want %d", len(result.Questions), 1)
	}
}

// TestBinSchemaDecodeFast verifies BinSchema fast decoding works
func TestBinSchemaDecodeFast(t *testing.T) {
	result, err := binschema.DecodeDnsMessageFast(dnsQueryPacket)
	if err != nil {
		t.Fatal(err)
	}

	if result.Id != 0x1234 {
		t.Errorf("Id: got %x, want %x", result.Id, 0x1234)
	}
	if result.Qdcount != 1 {
		t.Errorf("Qdcount: got %d, want %d", result.Qdcount, 1)
	}
	if result.Ancount != 0 {
		t.Errorf("Ancount: got %d, want %d", result.Ancount, 0)
	}
	if len(result.Questions) != 1 {
		t.Errorf("Questions len: got %d, want %d", len(result.Questions), 1)
	}
}

// TestCDecode verifies C decoding works
func TestCDecode(t *testing.T) {
	result, err := cdns.ParseDNSPacket(dnsQueryPacket)
	if err != nil {
		t.Fatal(err)
	}

	if result.ID != 0x1234 {
		t.Errorf("ID: got %x, want %x", result.ID, 0x1234)
	}
	if result.QDCount != 1 {
		t.Errorf("QDCount: got %d, want %d", result.QDCount, 1)
	}
	if result.ANCount != 0 {
		t.Errorf("ANCount: got %d, want %d", result.ANCount, 0)
	}
}
