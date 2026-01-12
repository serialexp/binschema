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

# Run Rust tests with batched compilation
# Examples:
#   just test-rust
#   just test-rust primitives
#   just test-rust primitives summary
test-rust filter="" report="":
    cd rust && rm -rf tmp-rust && RUST_TESTS=1 RUST_TEST_FILTER="{{filter}}" RUST_TEST_REPORT="{{report}}" cargo test test_compile_and_run_all -- --nocapture

# Run Rust tests with summary report
test-rust-summary:
    cd rust && rm -rf tmp-rust && RUST_TESTS=1 RUST_TEST_REPORT=summary cargo test test_compile_and_run_all -- --nocapture

# Run Rust tests with debug output (saves generated code to rust/tmp-rust-debug/)
test-rust-debug filter="" report="":
    cd rust && rm -rf tmp-rust-debug && DEBUG_GENERATED=tmp-rust-debug RUST_TESTS=1 RUST_TEST_FILTER="{{filter}}" RUST_TEST_REPORT="{{report}}" cargo test test_compile_and_run_all -- --nocapture

# ========== Website ==========

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

# Run all benchmarks (TypeScript and Go)
bench: bench-ts bench-go bench-compare

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

# Compare against other serialization libraries
bench-libraries:
    @echo "Comparing BinSchema against other libraries..."
    @cd benchmarks && bun install --silent && cd .. && bun benchmarks/compare-libraries.ts
