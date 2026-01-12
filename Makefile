.PHONY: test test-ts test-go test-go-filter test-rust test-rust-debug clean docker-build docker-build-push docker-run docker-stop website bench bench-ts bench-go bench-compare

# Run all tests (TypeScript and Go)
test: test-ts test-go

# Run TypeScript/Bun tests
test-ts:
	bun test

# Run Go tests with batched compilation
# Usage: make test-go [FILTER=pattern] [REPORT=summary|failing-tests|failed-suites|passing-suites]
test-go:
	cd go && TEST_FILTER="$(FILTER)" TEST_REPORT="$(REPORT)" go test -v ./test

# Run Go tests summary
test-go-summary:
	cd go && TEST_REPORT=summary go test -v ./test

# Run Go tests with debug output (saves generated code)
test-go-debug:
	cd go && DEBUG_GENERATED=tmp-go-debug TEST_FILTER="$(FILTER)" TEST_REPORT="$(REPORT)" go test -v ./test

# Run Rust batch compilation tests
test-rust:
	cd rust && rm -rf tmp-rust && RUST_TESTS=1 cargo test test_compile_and_run_all -- --nocapture

# Run Rust tests with debug output (saves generated code to rust/tmp-rust/)
test-rust-debug:
	cd rust && rm -rf tmp-rust && DEBUG_GENERATED=tmp-rust RUST_TESTS=1 cargo test test_compile_and_run_all -- --nocapture

# Build website
website:
	cd website && npm install && npm run build

# Run website dev server
run-website:
	cd website && npm run dev

# Docker commands
docker-build:
	@VERSION=$$(git describe --tags --always --dirty 2>/dev/null || echo "dev"); \
	echo "Building Docker image with version: $$VERSION"; \
	VERSION=$$VERSION depot bake --load

docker-build-push:
	@VERSION=$$(git describe --tags --always --dirty 2>/dev/null || echo "dev"); \
	echo "Building and pushing Docker image with version: $$VERSION"; \
	VERSION=$$VERSION depot bake --push

docker-run:
	docker run -d \
		--name binschema-website \
		-p 8080:80 \
		aeolun/binschema-website:latest

docker-stop:
	docker stop binschema-website || true
	docker rm binschema-website || true

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
