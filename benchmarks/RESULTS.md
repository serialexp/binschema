# BinSchema Performance Benchmarks

**System:** AMD Ryzen 9 9900X 12-Core, Linux, amd64
**Date:** 2026-02-14

## DNS Packet Decode — Cross-Language Comparison

All implementations decode the **same DNS packets** from the same schema definition.
The C parser is hand-written and serves as the theoretical floor.

### DNS Query (29 bytes, no compression)

| Implementation               | Decode (ns/op) | Allocs/op | Bytes/op |
|------------------------------|---------------:|----------:|---------:|
| **C hand-written**           |          32.2  |         1 |       16 |
| Go BinSchema (optimized)     |          85.8  |         3 |      288 |
| Go BinSchema (inline)        |         143.6  |         9 |      328 |
| **Rust BinSchema**           |       **178**  |       n/a |      n/a |
| Go BinSchema (fast/pooled)   |         242.2  |         8 |      336 |
| Go BinSchema (standard)      |         284.3  |        14 |      376 |
| Go Kaitai Struct             |         302.9  |        17 |      840 |
| TS Kaitai Struct             |         619.2  |       n/a |      n/a |
| TS BinSchema                 |         786.8  |       n/a |      n/a |

### DNS Response (45 bytes, with compression pointer)

| Implementation               | Decode (ns/op) | Allocs/op | Bytes/op |
|------------------------------|---------------:|----------:|---------:|
| **C hand-written**           |          34.1  |         1 |       16 |
| Go BinSchema (optimized)     |         151.5  |         5 |      576 |
| Go BinSchema (inline)        |         230.8  |        17 |      592 |
| **Rust BinSchema**           |       **296**  |       n/a |      n/a |
| Go BinSchema (fast/pooled)   |         402.4  |        17 |      528 |
| Go BinSchema (standard)      |         472.6  |        24 |      640 |
| Go Kaitai Struct             |         482.7  |        28 |    1,280 |
| TS Kaitai Struct             |         773.9  |       n/a |      n/a |
| TS BinSchema                 |         859.2  |       n/a |      n/a |

### DNS Encode (Rust only — BinSchema is the only tool that encodes)

| Packet   | Encode (ns/op) |
|----------|---------------:|
| Query    |         392.2  |
| Response |         638.2  |

## Key Takeaways

### Rust BinSchema: ~178 ns query, ~296 ns response

Rust BinSchema (standard generated code, no hand-optimization) decodes a DNS query
in **178 ns** — faster than standard Go BinSchema (284 ns) and both Kaitai
implementations, but slower than the hand-optimized Go variants.

This makes sense: the Rust runtime uses `Vec<u8>` allocations where the optimized Go
variants use zero-copy slices and value types. The Rust generated code has room for
the same optimizations.

### Go BinSchema vs Kaitai Struct (apples-to-apples)

Standard generated code, no hand-tuning:

- **Query:** BinSchema 284 ns vs Kaitai 303 ns — **BinSchema 6% faster**, 55% less memory
- **Response:** BinSchema 473 ns vs Kaitai 483 ns — **BinSchema 2% faster**, 50% less memory
- BinSchema also **encodes** — Kaitai is decode-only

### TypeScript: Kaitai is faster for decode-only

In the JS runtime, Kaitai's simpler/lazier decoder is 1.1–1.3x faster for pure
decoding. BinSchema's richer type system (discriminated unions, back_references,
bitfield structs) adds overhead that the V8 JIT doesn't fully eliminate.

But BinSchema encodes too — Kaitai can't.

### C baseline: ~10x faster than any generated code

The hand-written C parser at ~32 ns is the theoretical floor. It does no allocation
(flat struct output), no bounds checking, and has zero abstraction overhead. The gap
shows what's possible with unsafe, zero-copy parsing.

## Schema-Driven Benchmarks (TypeScript)

Simple encode/decode with generated code from JSON schemas:

| Benchmark              | Encode (ns/op) | Decode (ns/op) | Bytes |
|------------------------|---------------:|---------------:|------:|
| primitives/uint8       |           73.5 |           63.6 |     1 |
| primitives/uint16      |           66.1 |           64.9 |     2 |
| primitives/uint32      |           77.6 |           90.4 |     4 |
| primitives/all         |          123.2 |          216.7 |    14 |
| nested/point           |           83.9 |           74.8 |     8 |
| arrays/small_array     |          288.5 |          103.1 |    40 |
| dns_header/query       |          207.0 |          362.3 |    12 |
| dns_header/response    |           90.3 |          237.6 |    12 |

## CPU Profiles — Where Time Is Spent

### Go BinSchema (standard) — DNS Query Decode

Profiled with `go test -cpuprofile`. Top functions by cumulative CPU:

| Function                        | Flat   | Cumulative | Notes                       |
|---------------------------------|-------:|-----------:|-----------------------------|
| `runtime.mallocgc`              |  5.0%  |     40.3%  | **Memory allocation dominates** |
| `decodeCompressedDomainWithDecoder` | 1.2% | 55.6%  | Domain parsing is the hot path |
| `decodeLabelWithDecoder`        |  2.3%  |     34.5%  | String label decode           |
| `ReadUint8`                     | 16.8%  |     17.1%  | Biggest single flat-time func |
| `slicerunetostring`             |  4.7%  |     11.1%  | String conversion overhead    |
| `growslice`                     |  1.7%  |      8.8%  | Slice growth (arrays/labels)  |
| `ReadBits`                      |  3.4%  |     10.5%  | Bitfield decoding             |

**Key insight:** 40% of CPU is in `mallocgc` — allocation of decoder objects, slices,
and string conversions. The optimized Go variant avoids this with value types and
pre-allocated buffers, which is why it's 3.3x faster.

### Rust BinSchema — DNS Decode (Query + Response)

Profiled with `perf record` + `inferno-flamegraph`. Top functions by CPU share:

| Function                           | CPU %  | Notes                           |
|------------------------------------|-------:|---------------------------------|
| `Label::decode_with_decoder`       | 20.3%  | **String label parsing**        |
| `DnsMessageOutput::decode_with_decoder` | 20.1% | Top-level message decode   |
| `BitStreamDecoder::read_uint8`     | 13.2%  | Byte-at-a-time reading          |
| `String::from_iter<char>`          |  7.2%  | **String allocation from chars** |
| `CompressedDomain::decode_with_decoder` | 5.8% | Domain name array building |
| `BitStreamDecoder::read_bits`      |  4.9%  | Bitfield extraction             |
| `malloc`                           |  3.6%  | Heap allocation                 |
| `BitStreamDecoder::read_uint16`    |  3.6%  | 16-bit field reads              |
| `ResourceRecordOutput::decode_with_decoder` | 3.3% | Resource record parsing |
| `raw_vec::finish_grow`             |  2.3%  | Vec reallocation                |

**Key insight:** `Label::decode_with_decoder` + `String::from_iter` = 27.5% of CPU.
String building is the hot path. A zero-copy approach (returning `&[u8]` slices into
the input buffer instead of allocating `String`) would eliminate this entirely.

### TypeScript BinSchema — DNS Decode (V8 --prof)

Profiled with `node --prof`. Top V8 tick counts:

| Function                   | Ticks | Share  | Notes                          |
|----------------------------|------:|-------:|--------------------------------|
| `decode` (DnsMessage)      |   322 |  22.8% | Top-level message decoder      |
| `readUint8`                |   126 |   8.9% | Byte reading                   |
| `readBits`                 |   117 |   8.3% | Bitfield extraction            |
| `get bytes` (getter)       |    87 |   6.2% | **Typed array property access** |
| `JSConstructStubGeneric`   |    56 |   4.0% | Object construction overhead   |
| `BitStreamDecoder` (ctor)  |    51 |   3.6% | Decoder instantiation          |
| `readUint32`               |    49 |   3.5% | 32-bit field reads             |
| `decode` (Question)        |    45 |   3.2% | Question section decode        |
| `GrowFastSmiOrObjectElements` | 42 |   3.0% | **Array/object growth**        |
| `TypedArrayPrototypeSlice` |    37 |   2.6% | Uint8Array slicing             |
| GC (total)                 |    73 |   5.2% | Garbage collection             |

**Key insight:** Object construction (`JSConstructStubGeneric` + `BitStreamDecoder` ctor)
accounts for ~7.6% of time. The `get bytes` getter at 6.2% suggests the runtime's
`Uint8Array` property access is surprisingly expensive. Array growth and GC together
add another 8.2%.

### Cross-Language Hotspot Comparison

The same bottleneck appears in all three languages:

1. **String/label construction** — building strings from raw bytes is the #1 cost
2. **Memory allocation** — allocating decoder objects, result structs, and intermediate arrays
3. **ReadUint8** — byte-by-byte reading through the bitstream runtime (instead of bulk reads)

Biggest optimization opportunities:
- **Zero-copy string reads** — return byte slices/views instead of allocating strings
- **Pre-allocated buffers** — reuse encoder/decoder objects across calls
- **Bulk reads** — read multi-byte fields as a single memory read instead of byte-at-a-time

## Running Benchmarks

```bash
# All benchmarks
just bench

# Individual suites
just bench-ts                  # TypeScript schema benchmarks
just bench-go                  # Go schema benchmarks
just bench-rust                # Rust DNS decode/encode (Criterion)
just bench-go-compare          # Go DNS: BinSchema vs Kaitai vs C
just bench-libraries           # TS: BinSchema vs Protobuf vs MessagePack
```

## Running Profiles

```bash
# Go — opens pprof web UI with flamegraph on :8080
just profile-go response           # Standard response decode
just profile-go query              # Standard query decode
just profile-go optimized-response # Optimized variant
just profile-go-text response      # Text output (no browser)

# Rust — generates flamegraph SVG
just profile-rust                  # perf record + inferno flamegraph
just profile-rust-text             # Text report from last run

# TypeScript — V8 profile text output
just profile-ts                    # node --prof report
# For interactive flamegraph:
0x benchmarks/profile-ts-standalone.mjs
```

## Methodology

- **Go:** `go test -bench=. -benchtime=3s -count=5 -benchmem` (median of 5 runs)
- **Rust:** Criterion 0.5 with 100 samples, 3s warmup, statistical analysis
- **TypeScript:** Bun runtime, 100K iterations with 1K warmup
- **C:** Called via CGo from Go benchmark harness (includes CGo call overhead ~5ns)
- All tests parse the **exact same byte sequences** for the same DNS packets
