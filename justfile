# BinSchema build and test commands
# Run `just --list` to see all available commands

# Default recipe - run all tests
default: test

# ========== Testing ==========

# Run all tests (TypeScript and Go)
test: test-ts test-go

# Run TypeScript/Bun tests
test-ts:
    bun test

# Run Go tests with batched compilation
# Examples:
#   just test-go
#   just test-go dns
#   just test-go dns summary
test-go filter="" report="":
    cd go && TEST_FILTER="{{filter}}" TEST_REPORT="{{report}}" go test -v ./test

# Run Go tests with summary report
test-go-summary:
    cd go && TEST_REPORT=summary go test -v ./test

# Run Go tests with debug output (saves generated code to go/test/tmp-go-debug/)
test-go-debug filter="" report="":
    cd go && DEBUG_GENERATED=tmp-go-debug TEST_FILTER="{{filter}}" TEST_REPORT="{{report}}" go test -v ./test

# Run Rust tests with batched compilation (saves full output to rust/test-output.txt)
# Examples:
#   just test-rust
#   just test-rust primitives
#   just test-rust primitives summary
test-rust filter="" report="":
    #!/usr/bin/env bash
    cd rust && rm -rf tmp-rust
    RUST_TESTS=1 RUST_TEST_FILTER="{{filter}}" RUST_TEST_REPORT="{{report}}" \
        cargo test test_compile_and_run_all -- --nocapture 2>&1 | tee test-output.txt
    echo ""
    echo "Full test output saved to rust/test-output.txt"
    echo "Run 'just test-rust-categorize' to analyze failures (no recompilation needed)"

# Run Rust tests with summary report
test-rust-summary:
    cd rust && rm -rf tmp-rust && RUST_TESTS=1 RUST_TEST_REPORT=summary cargo test test_compile_and_run_all -- --nocapture

# Run Rust tests with debug output (saves generated code to rust/tmp-rust-debug/)
test-rust-debug filter="" report="":
    cd rust && rm -rf tmp-rust-debug && DEBUG_GENERATED=tmp-rust-debug RUST_TESTS=1 RUST_TEST_FILTER="{{filter}}" RUST_TEST_REPORT="{{report}}" cargo test test_compile_and_run_all -- --nocapture

# Show only errors from the last test-rust run (no recompilation!)
test-rust-errors:
    grep -E "^error|SUMMARY|Code gen|Compilation|Tests passed" rust/test-output.txt

# Categorize failures from the last test-rust run (no recompilation!)
# Run `just test-rust` first to generate rust/test-output.txt
test-rust-categorize:
    python3 rust/categorize-failures.py < rust/test-output.txt

# ========== Website ==========

# Regenerate website example code from the demo sensor schema
# Run this when code generators change to keep website examples accurate
regen-website-examples:
    #!/usr/bin/env bash
    set -euo pipefail
    ROOT="$(pwd)"
    SCHEMA="$ROOT/website/src/examples/demo-sensor.schema.json"
    OUT_DIR="$ROOT/website/src/examples"
    CLI="$ROOT/packages/binschema/dist/cli/index.js"
    mkdir -p "$ROOT/tmp/gen-ts" "$ROOT/tmp/gen-go" "$ROOT/tmp/gen-rust"
    # TypeScript generator needs to run from packages/binschema to find runtime files
    cd "$ROOT/packages/binschema"
    node "$CLI" generate --language ts --schema "$SCHEMA" --out "$ROOT/tmp/gen-ts" --type SensorReading
    cd "$ROOT"
    node "$CLI" generate --language go --schema "$SCHEMA" --out "$ROOT/tmp/gen-go" --type SensorReading
    node "$CLI" generate --language rust --schema "$SCHEMA" --out "$ROOT/tmp/gen-rust" --type SensorReading
    cp "$ROOT/tmp/gen-ts/generated.ts" "$OUT_DIR/demo-sensor.generated.ts"
    cp "$ROOT/tmp/gen-go/generated.go" "$OUT_DIR/demo-sensor.generated.go"
    cp "$ROOT/tmp/gen-rust/generated.rs" "$OUT_DIR/demo-sensor.generated.rs"
    echo "Regenerated website example code in $OUT_DIR"

# Build website
website:
    cd website && npm install && npm run build

# Run website dev server
run-website:
    cd website && npm run dev

# ========== Docker ==========

# Build Docker image
docker-build:
    #!/usr/bin/env bash
    VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
    echo "Building Docker image with version: $VERSION"
    VERSION=$VERSION depot bake --load

# Build and push Docker image
docker-build-push:
    #!/usr/bin/env bash
    VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")
    echo "Building and pushing Docker image with version: $VERSION"
    VERSION=$VERSION depot bake --push

# Run Docker container
docker-run:
    docker run -d \
        --name binschema-website \
        -p 8080:80 \
        aeolun/binschema-website:latest

# Stop and remove Docker container
docker-stop:
    docker stop binschema-website || true
    docker rm binschema-website || true

# ========== Cleanup ==========

# Clean generated files and build artifacts
clean:
    rm -rf .generated/
    rm -rf .generated-bench/
    rm -rf tmp-go/
    rm -rf rust/tmp-rust/
    rm -f test_output.txt
    rm -rf go/test/generated/
    rm -rf dist/
    rm -rf website/dist/
    rm -f benchmarks/results-ts.json
    rm -f benchmarks/results-go.json

# ========== Benchmarks ==========

# Run all benchmarks (TypeScript, Go, and Rust)
bench: bench-ts bench-go bench-rust bench-compare

# Run TypeScript benchmarks
bench-ts:
    @echo "Running TypeScript benchmarks..."
    bun benchmarks/run-ts.ts

# Run Go benchmarks
bench-go:
    @echo "Running Go benchmarks..."
    go run benchmarks/run-go.go -json=benchmarks/results-go.json

# Compare benchmark results
bench-compare:
    @echo ""
    @echo "Comparing benchmark results..."
    @bun benchmarks/compare.ts

# Run Rust benchmarks (DNS packet decode/encode via Criterion)
bench-rust:
    @echo "Running Rust benchmarks..."
    @bun benchmarks/generate-rust-bench.ts
    @cd benchmarks/rust-compare && cargo bench --bench dns_bench

# Run Go DNS comparison benchmarks (BinSchema vs Kaitai vs C)
bench-go-compare:
    @echo "Running Go DNS comparison benchmarks..."
    @cd benchmarks/go-compare && go test -bench=. -benchtime=3s -count=5 -benchmem | tee benchmark_results.txt

# Compare against other serialization libraries
bench-libraries:
    @echo "Comparing BinSchema against other libraries..."
    @cd benchmarks && bun install --silent && cd .. && bun benchmarks/compare-libraries.ts

# === Profiling ===

# Profile Go BinSchema DNS decode (opens pprof web UI on :8080)
profile-go target="response":
    @echo "Profiling Go BinSchema DNS decode ({{target}})..."
    @cd benchmarks/go-compare && bash profile.sh {{target}} web

# Profile Go BinSchema DNS decode (text output, no browser)
profile-go-text target="response":
    @cd benchmarks/go-compare && bash profile.sh {{target}} text

# Profile Rust BinSchema DNS decode (generates flamegraph SVG)
profile-rust:
    @echo "Building and profiling Rust BinSchema DNS decode..."
    @bun benchmarks/generate-rust-bench.ts
    @cd benchmarks/rust-compare && cargo build --release --bin profile_decode \
        && perf record -g --call-graph dwarf,16384 -o perf.data ./target/release/profile_decode \
        && perf script -i perf.data | inferno-collapse-perf | inferno-flamegraph > flamegraph-rust.svg \
        && echo "Flamegraph: benchmarks/rust-compare/flamegraph-rust.svg"

# Profile Rust — text report (no flamegraph, just top functions)
profile-rust-text:
    @cd benchmarks/rust-compare && perf report -i perf.data --stdio --no-children -g none 2>/dev/null | head -40

# Profile TypeScript BinSchema DNS decode (generates V8 profile)
profile-ts:
    @echo "Generating decoder and profiling with Node.js..."
    @bun benchmarks/profile-ts-decode.ts > /dev/null
    @bun build benchmarks/.generated-bench/BinSchemaDnsProfile.ts --outdir benchmarks/.generated-bench/ --outfile BinSchemaDnsProfile.js --target=node > /dev/null
    @cd benchmarks && node --prof profile-ts-standalone.mjs \
        && node --prof-process isolate-*.log 2>/dev/null | head -60 \
        && rm -f isolate-*.log
    @echo ""
    @echo "For interactive flamegraph: 0x benchmarks/profile-ts-standalone.mjs"
