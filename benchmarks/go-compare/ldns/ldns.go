package ldns

/*
#cgo CFLAGS: -I/Users/bart.riepe/Projects/ldns
#cgo LDFLAGS: /Users/bart.riepe/Projects/ldns/.libs/libldns.a

#include <stdlib.h>
#include <ldns/ldns.h>

// Decode wire format to ldns_pkt, then free the packet.
// Returns 0 on success, non-zero on error.
int ldns_decode_packet(const uint8_t *data, size_t len) {
    ldns_pkt *pkt = NULL;
    ldns_status s = ldns_wire2pkt(&pkt, data, len);
    if (s != LDNS_STATUS_OK) {
        return (int)s;
    }
    ldns_pkt_free(pkt);
    return 0;
}

// Decode wire format, then re-encode it back to wire.
// Returns 0 on success, non-zero on error.
int ldns_roundtrip_packet(const uint8_t *data, size_t len) {
    ldns_pkt *pkt = NULL;
    ldns_status s = ldns_wire2pkt(&pkt, data, len);
    if (s != LDNS_STATUS_OK) {
        return (int)s;
    }

    uint8_t *wire = NULL;
    size_t wire_len = 0;
    s = ldns_pkt2wire(&wire, pkt, &wire_len);
    ldns_pkt_free(pkt);
    if (wire) free(wire);
    if (s != LDNS_STATUS_OK) {
        return (int)s;
    }
    return 0;
}

// Decode once, then encode N times (for encode-only benchmarking).
// The packet is decoded once upfront and reused.
typedef struct {
    ldns_pkt *pkt;
} ldns_bench_state;

ldns_bench_state* ldns_bench_prepare(const uint8_t *data, size_t len) {
    ldns_bench_state *state = (ldns_bench_state*)malloc(sizeof(ldns_bench_state));
    ldns_status s = ldns_wire2pkt(&state->pkt, data, len);
    if (s != LDNS_STATUS_OK) {
        free(state);
        return NULL;
    }
    return state;
}

int ldns_bench_encode(ldns_bench_state *state) {
    uint8_t *wire = NULL;
    size_t wire_len = 0;
    ldns_status s = ldns_pkt2wire(&wire, state->pkt, &wire_len);
    if (wire) free(wire);
    return (int)s;
}

void ldns_bench_cleanup(ldns_bench_state *state) {
    if (state) {
        if (state->pkt) ldns_pkt_free(state->pkt);
        free(state);
    }
}
*/
import "C"
import (
	"fmt"
	"unsafe"
)

// DecodeDNSPacket decodes a DNS packet using ldns (wire2pkt + free).
func DecodeDNSPacket(data []byte) error {
	ret := C.ldns_decode_packet((*C.uint8_t)(unsafe.Pointer(&data[0])), C.size_t(len(data)))
	if ret != 0 {
		return fmt.Errorf("ldns_wire2pkt failed: %d", ret)
	}
	return nil
}

// BenchState holds a pre-decoded ldns_pkt for encode benchmarking.
type BenchState struct {
	state *C.ldns_bench_state
}

// PrepareBenchEncode decodes a packet once and returns a handle for repeated encoding.
func PrepareBenchEncode(data []byte) (*BenchState, error) {
	state := C.ldns_bench_prepare((*C.uint8_t)(unsafe.Pointer(&data[0])), C.size_t(len(data)))
	if state == nil {
		return nil, fmt.Errorf("ldns_bench_prepare failed")
	}
	return &BenchState{state: state}, nil
}

// Encode serializes the pre-decoded packet to wire format.
func (b *BenchState) Encode() error {
	ret := C.ldns_bench_encode(b.state)
	if ret != 0 {
		return fmt.Errorf("ldns_pkt2wire failed: %d", ret)
	}
	return nil
}

// Close frees the ldns state.
func (b *BenchState) Close() {
	if b.state != nil {
		C.ldns_bench_cleanup(b.state)
		b.state = nil
	}
}
