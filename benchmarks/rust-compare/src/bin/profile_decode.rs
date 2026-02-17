/// Standalone profiling binary for BinSchema Rust DNS decode.
/// Run with: cargo build --release --bin profile_decode
/// Then:     perf record -g ./target/release/profile_decode
///           perf script | inferno-collapse-perf | inferno-flamegraph > flamegraph.svg

use binschema_bench::dns_message::DnsMessageOutput;

const ITERATIONS: usize = 2_000_000;
const WARMUP: usize = 10_000;

/// DNS query packet for "example.com" type A (29 bytes)
const DNS_QUERY_PACKET: &[u8] = &[
    0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x07, 0x65, 0x78, 0x61,
    0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
    0x00, 0x00, 0x01, 0x00, 0x01,
];

/// DNS response packet (45 bytes, with compression)
const DNS_RESPONSE_PACKET: &[u8] = &[
    0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x07, 0x65, 0x78, 0x61,
    0x6d, 0x70, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d,
    0x00, 0x00, 0x01, 0x00, 0x01, 0xc0, 0x0c, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x0e, 0x10, 0x00,
    0x04, 0x5d, 0xb8, 0xd8, 0x22,
];

fn main() {
    // Warmup
    for _ in 0..WARMUP {
        let _ = DnsMessageOutput::decode(DNS_QUERY_PACKET).unwrap();
        let _ = DnsMessageOutput::decode(DNS_RESPONSE_PACKET).unwrap();
    }

    let start = std::time::Instant::now();

    // Main loop — query decode
    for _ in 0..ITERATIONS {
        let _ = std::hint::black_box(
            DnsMessageOutput::decode(std::hint::black_box(DNS_QUERY_PACKET))
        );
    }

    let query_elapsed = start.elapsed();

    // Main loop — response decode
    let start2 = std::time::Instant::now();
    for _ in 0..ITERATIONS {
        let _ = std::hint::black_box(
            DnsMessageOutput::decode(std::hint::black_box(DNS_RESPONSE_PACKET))
        );
    }

    let resp_elapsed = start2.elapsed();

    eprintln!("Query decode:    {} iterations in {:?} ({:.1} ns/op)",
        ITERATIONS, query_elapsed, query_elapsed.as_nanos() as f64 / ITERATIONS as f64);
    eprintln!("Response decode: {} iterations in {:?} ({:.1} ns/op)",
        ITERATIONS, resp_elapsed, resp_elapsed.as_nanos() as f64 / ITERATIONS as f64);
}
