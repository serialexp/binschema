use criterion::{black_box, criterion_group, criterion_main, Criterion};
use binschema_bench::dns_message::DnsMessageOutput;

/// DNS query packet for "example.com" type A (29 bytes)
/// Same packet used in the Go and TypeScript benchmarks.
const DNS_QUERY_PACKET: &[u8] = &[
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
];

/// DNS response packet for "example.com" with A record and compression (45 bytes)
/// Same packet used in the Go and TypeScript benchmarks.
const DNS_RESPONSE_PACKET: &[u8] = &[
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
];

fn bench_decode_query(c: &mut Criterion) {
    // Verify it works first
    let msg = DnsMessageOutput::decode(DNS_QUERY_PACKET).expect("decode query");
    assert_eq!(msg.id, 0x1234);
    assert_eq!(msg.qdcount, 1);
    assert_eq!(msg.ancount, 0);

    c.bench_function("BinSchemaRust_QueryDecode", |b| {
        b.iter(|| {
            DnsMessageOutput::decode(black_box(DNS_QUERY_PACKET)).unwrap()
        })
    });
}

fn bench_decode_response(c: &mut Criterion) {
    // Verify it works first
    let msg = DnsMessageOutput::decode(DNS_RESPONSE_PACKET).expect("decode response");
    assert_eq!(msg.id, 0x1234);
    assert_eq!(msg.qdcount, 1);
    assert_eq!(msg.ancount, 1);

    c.bench_function("BinSchemaRust_ResponseDecode", |b| {
        b.iter(|| {
            DnsMessageOutput::decode(black_box(DNS_RESPONSE_PACKET)).unwrap()
        })
    });
}

fn bench_encode_query(c: &mut Criterion) {
    use binschema_bench::dns_message::*;

    let msg = DnsMessageOutput::decode(DNS_QUERY_PACKET).expect("decode query for encode");

    // Build the input from the decoded output
    let input = DnsMessageInput {
        id: msg.id,
        flags: msg.flags.clone(),
        qdcount: msg.qdcount,
        ancount: msg.ancount,
        nscount: msg.nscount,
        arcount: msg.arcount,
        questions: msg.questions.iter().map(|q| QuestionInput {
            qname: q.qname.clone(),
            qtype: q.qtype,
            qclass: q.qclass,
        }).collect(),
        answers: vec![],
        authority: vec![],
        additional: vec![],
    };

    // Verify encode produces valid bytes
    let encoded = input.encode().expect("encode query");
    assert!(!encoded.is_empty());

    c.bench_function("BinSchemaRust_QueryEncode", |b| {
        b.iter(|| {
            black_box(&input).encode().unwrap()
        })
    });
}

fn bench_encode_response(c: &mut Criterion) {
    use binschema_bench::dns_message::*;

    let msg = DnsMessageOutput::decode(DNS_RESPONSE_PACKET).expect("decode response for encode");

    // Build the input from the decoded output
    let input = DnsMessageInput {
        id: msg.id,
        flags: msg.flags.clone(),
        qdcount: msg.qdcount,
        ancount: msg.ancount,
        nscount: msg.nscount,
        arcount: msg.arcount,
        questions: msg.questions.iter().map(|q| QuestionInput {
            qname: q.qname.clone(),
            qtype: q.qtype,
            qclass: q.qclass,
        }).collect(),
        answers: msg.answers.iter().map(|rr| ResourceRecordInput {
            name: rr.name.clone(),
            r#type: rr.r#type,
            class: rr.class,
            ttl: rr.ttl,
            rdlength: rr.rdlength,
            rdata: rr.rdata.clone(),
        }).collect(),
        authority: vec![],
        additional: vec![],
    };

    // Verify encode produces valid bytes
    let encoded = input.encode().expect("encode response");
    assert!(!encoded.is_empty());

    c.bench_function("BinSchemaRust_ResponseEncode", |b| {
        b.iter(|| {
            black_box(&input).encode().unwrap()
        })
    });
}

criterion_group!(benches, bench_decode_query, bench_decode_response, bench_encode_query, bench_encode_response);
criterion_main!(benches);
