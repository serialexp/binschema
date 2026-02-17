#!/usr/bin/env bash
# Go CPU profiling for BinSchema DNS benchmarks.
# Generates .prof files that can be viewed with `go tool pprof`.
#
# Usage:
#   ./profile.sh                    # Profile all, open web UI
#   ./profile.sh response           # Profile response decode only
#   ./profile.sh query text         # Profile query decode, text output
#
# Output:
#   cpu-*.prof files in this directory (gitignored)

set -euo pipefail
cd "$(dirname "$0")"

BENCHMARK="${1:-all}"
OUTPUT="${2:-web}"  # "web" opens browser, "text" prints top functions

case "$BENCHMARK" in
  query)
    BENCH_REGEX="BenchmarkBinSchemaQueryDecode$"
    PROF_NAME="cpu-query.prof"
    ;;
  response)
    BENCH_REGEX="BenchmarkBinSchemaResponseDecode$"
    PROF_NAME="cpu-response.prof"
    ;;
  optimized-query)
    BENCH_REGEX="BenchmarkBinSchemaQueryDecodeOptimized$"
    PROF_NAME="cpu-optimized-query.prof"
    ;;
  optimized-response)
    BENCH_REGEX="BenchmarkBinSchemaResponseDecodeOptimized$"
    PROF_NAME="cpu-optimized-response.prof"
    ;;
  all)
    BENCH_REGEX="BenchmarkBinSchema"
    PROF_NAME="cpu-all.prof"
    ;;
  *)
    echo "Usage: $0 [query|response|optimized-query|optimized-response|all] [web|text]"
    exit 1
    ;;
esac

echo "Profiling: $BENCH_REGEX"
echo "Output to: $PROF_NAME"

go test -bench="$BENCH_REGEX" -benchtime=5s -cpuprofile="$PROF_NAME" -memprofile="mem-${PROF_NAME}" .

echo ""
echo "Profile saved to $PROF_NAME"

case "$OUTPUT" in
  web)
    echo "Opening pprof web UI..."
    go tool pprof -http=:8080 "$PROF_NAME"
    ;;
  text)
    echo ""
    echo "=== Top 20 functions by CPU ==="
    go tool pprof -top -cum "$PROF_NAME" 2>/dev/null | head -30
    ;;
  *)
    echo "Use: go tool pprof $PROF_NAME"
    ;;
esac
