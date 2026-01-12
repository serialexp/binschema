// Minimal DNS packet parser for benchmarking
// Hand-optimized C implementation

#include "dns_wrapper.h"
#include <string.h>

// Read big-endian uint16
static inline uint16_t read_u16be(const uint8_t* p) {
    return (uint16_t)(p[0] << 8) | p[1];
}

// Read big-endian uint32
static inline uint32_t read_u32be(const uint8_t* p) {
    return (uint32_t)(p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3];
}

// Skip a DNS name (handling compression pointers)
// Returns new position, or -1 on error
static int skip_name(const uint8_t* data, size_t len, int pos) {
    int jumped = 0;
    int original_pos = pos;

    while (pos < (int)len) {
        uint8_t label_len = data[pos];

        if (label_len == 0) {
            // End of name
            if (!jumped) {
                return pos + 1;
            } else {
                return original_pos + 2; // After the pointer
            }
        }

        if ((label_len & 0xC0) == 0xC0) {
            // Compression pointer
            if (pos + 1 >= (int)len) return -1;

            int offset = ((label_len & 0x3F) << 8) | data[pos + 1];
            if (offset >= pos) return -1; // Forward pointer = error

            if (!jumped) {
                original_pos = pos;
                jumped = 1;
            }
            pos = offset;
            continue;
        }

        // Regular label
        pos += 1 + label_len;
    }

    return -1; // Ran off end
}

// Parse a question entry, returns new position or -1 on error
static int parse_question(const uint8_t* data, size_t len, int pos) {
    // Skip QNAME
    pos = skip_name(data, len, pos);
    if (pos < 0) return -1;

    // Skip QTYPE and QCLASS (4 bytes)
    if (pos + 4 > (int)len) return -1;
    return pos + 4;
}

// Parse a resource record, returns new position or -1 on error
static int parse_rr(const uint8_t* data, size_t len, int pos) {
    // Skip NAME
    pos = skip_name(data, len, pos);
    if (pos < 0) return -1;

    // Need TYPE(2) + CLASS(2) + TTL(4) + RDLENGTH(2) = 10 bytes
    if (pos + 10 > (int)len) return -1;

    uint16_t rdlength = read_u16be(data + pos + 8);
    pos += 10 + rdlength;

    if (pos > (int)len) return -1;
    return pos;
}

dns_parse_result parse_dns_packet(const uint8_t* data, size_t len) {
    dns_parse_result result = {0};

    // Need at least 12 bytes for header
    if (len < 12) {
        result.error = 1;
        return result;
    }

    // Parse header
    result.id = read_u16be(data);
    result.flags = read_u16be(data + 2);
    result.qdcount = read_u16be(data + 4);
    result.ancount = read_u16be(data + 6);
    result.nscount = read_u16be(data + 8);
    result.arcount = read_u16be(data + 10);

    int pos = 12;

    // Parse questions
    for (int i = 0; i < result.qdcount; i++) {
        pos = parse_question(data, len, pos);
        if (pos < 0) {
            result.error = 2;
            return result;
        }
    }

    // Parse answers
    for (int i = 0; i < result.ancount; i++) {
        pos = parse_rr(data, len, pos);
        if (pos < 0) {
            result.error = 3;
            return result;
        }
    }

    // Parse authority
    for (int i = 0; i < result.nscount; i++) {
        pos = parse_rr(data, len, pos);
        if (pos < 0) {
            result.error = 4;
            return result;
        }
    }

    // Parse additional
    for (int i = 0; i < result.arcount; i++) {
        pos = parse_rr(data, len, pos);
        if (pos < 0) {
            result.error = 5;
            return result;
        }
    }

    return result;
}
