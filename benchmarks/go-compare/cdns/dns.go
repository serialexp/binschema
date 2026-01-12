package cdns

/*
#include "dns_wrapper.h"
*/
import "C"
import "unsafe"

// DNSResult holds the parsed DNS packet header
type DNSResult struct {
	ID      uint16
	Flags   uint16
	QDCount uint16
	ANCount uint16
	NSCount uint16
	ARCount uint16
}

// ParseDNSPacket parses a DNS packet using the C implementation
func ParseDNSPacket(data []byte) (*DNSResult, error) {
	if len(data) == 0 {
		return nil, nil
	}

	result := C.parse_dns_packet(
		(*C.uint8_t)(unsafe.Pointer(&data[0])),
		C.size_t(len(data)),
	)

	if result.error != 0 {
		return nil, nil
	}

	return &DNSResult{
		ID:      uint16(result.id),
		Flags:   uint16(result.flags),
		QDCount: uint16(result.qdcount),
		ANCount: uint16(result.ancount),
		NSCount: uint16(result.nscount),
		ARCount: uint16(result.arcount),
	}, nil
}
