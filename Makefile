.PHONY: test test-ts test-go test-go-filter clean docker-build docker-build-push docker-run docker-stop website

# Run all tests (TypeScript and Go)
test: test-ts test-go

# Run TypeScript/Bun tests
test-ts:
	bun test

# Run Go tests with batched compilation
test-go:
	cd go && go test -v ./test

# Run Go tests with filter (usage: make test-go-filter FILTER=primitives)
test-go-filter:
	cd go && TEST_FILTER=$(FILTER) go test -v ./test

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
	rm -rf tmp-go/
	rm -f test_output.txt
	rm -rf go/test/generated/
	rm -rf dist/
	rm -rf website/dist/
