#ifndef DNS_WRAPPER_H
#define DNS_WRAPPER_H

#include <stdint.h>
#include <stddef.h>

// Parsed DNS header result
typedef struct {
    uint16_t id;
    uint16_t flags;
    uint16_t qdcount;
    uint16_t ancount;
    uint16_t nscount;
    uint16_t arcount;
    int error;
} dns_parse_result;

// Parse a DNS packet and extract header fields
dns_parse_result parse_dns_packet(const uint8_t* data, size_t len);

#endif
