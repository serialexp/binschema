// Package main implements a benchmark runner for BinSchema Go implementation.
// It generates Go benchmark code from schema files and runs them.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// BenchmarkSchema represents a benchmark schema file
type BenchmarkSchema struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
	Types       map[string]interface{} `json:"types"`
	Benchmarks  map[string]struct {
		Type       string                 `json:"type"`
		Value      interface{}            `json:"value"`
		Generator  map[string]interface{} `json:"generator"`
		Iterations int                    `json:"iterations"`
	} `json:"benchmarks"`
}

// BenchmarkResult represents a single benchmark result
type BenchmarkResult struct {
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	Operation    string  `json:"operation"`
	Iterations   int     `json:"iterations"`
	TotalTimeNs  float64 `json:"totalTimeNs"`
	AvgTimeNs    float64 `json:"avgTimeNs"`
	OpsPerSecond float64 `json:"opsPerSecond"`
	BytesPerOp   int     `json:"bytesPerOp"`
}

// BenchmarkSuite represents the full benchmark output
type BenchmarkSuite struct {
	Language  string            `json:"language"`
	Timestamp string            `json:"timestamp"`
	Results   []BenchmarkResult `json:"results"`
}

func main() {
	outputJSON := flag.String("json", "", "Output JSON file for results")
	flag.Parse()

	fmt.Println("🚀 BinSchema Go Performance Benchmarks")
	fmt.Println(strings.Repeat("=", 60))

	// Find benchmark schemas
	schemasDir := filepath.Join(filepath.Dir(os.Args[0]), "schemas")
	if _, err := os.Stat(schemasDir); os.IsNotExist(err) {
		// Try relative path from current directory
		schemasDir = "benchmarks/schemas"
	}

	schemaFiles, err := filepath.Glob(filepath.Join(schemasDir, "*.json"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error finding schema files: %v\n", err)
		os.Exit(1)
	}

	if len(schemaFiles) == 0 {
		fmt.Fprintf(os.Stderr, "No schema files found in %s\n", schemasDir)
		os.Exit(1)
	}

	var allResults []BenchmarkResult

	for _, schemaFile := range schemaFiles {
		results, err := runSchemaFile(schemaFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error running %s: %v\n", schemaFile, err)
			continue
		}
		allResults = append(allResults, results...)
	}

	// Print summary
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("📊 Summary")
	fmt.Println(strings.Repeat("=", 60))

	// Group by benchmark name
	grouped := make(map[string]map[string]BenchmarkResult)
	for _, result := range allResults {
		if grouped[result.Name] == nil {
			grouped[result.Name] = make(map[string]BenchmarkResult)
		}
		grouped[result.Name][result.Operation] = result
	}

	fmt.Printf("\n%-40s %12s %12s %10s\n", "Benchmark", "Encode/op", "Decode/op", "Bytes")
	fmt.Println(strings.Repeat("-", 76))

	// Sort benchmark names
	names := make([]string, 0, len(grouped))
	for name := range grouped {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		ops := grouped[name]
		encodeNs := "N/A"
		decodeNs := "N/A"
		bytes := 0
		if e, ok := ops["encode"]; ok {
			encodeNs = formatNs(e.AvgTimeNs)
			bytes = e.BytesPerOp
		}
		if d, ok := ops["decode"]; ok {
			decodeNs = formatNs(d.AvgTimeNs)
			if bytes == 0 {
				bytes = d.BytesPerOp
			}
		}
		fmt.Printf("%-40s %12s %12s %10d\n", name, encodeNs, decodeNs, bytes)
	}

	// Write JSON results if requested
	if *outputJSON != "" {
		output := BenchmarkSuite{
			Language:  "go",
			Timestamp: time.Now().Format(time.RFC3339),
			Results:   allResults,
		}
		outputBytes, _ := json.MarshalIndent(output, "", "  ")
		if err := os.WriteFile(*outputJSON, outputBytes, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing JSON output: %v\n", err)
		} else {
			fmt.Printf("\n📁 Results saved to: %s\n", *outputJSON)
		}
	}
}

func runSchemaFile(schemaPath string) ([]BenchmarkResult, error) {
	fmt.Printf("\n📋 Loading schema: %s\n", schemaPath)

	schemaBytes, err := os.ReadFile(schemaPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read schema: %w", err)
	}

	var schema BenchmarkSchema
	if err := json.Unmarshal(schemaBytes, &schema); err != nil {
		return nil, fmt.Errorf("failed to parse schema: %w", err)
	}

	// Create binary schema for code generation
	binarySchema := map[string]interface{}{
		"config": schema.Config,
		"types":  schema.Types,
	}

	// Generate Go code
	fmt.Println("  Generating Go code...")
	code, err := generateGoSource(binarySchema)
	if err != nil {
		return nil, fmt.Errorf("failed to generate Go code: %w", err)
	}

	// Create temporary directory for benchmark
	tmpDir, err := os.MkdirTemp("", "binschema-bench-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Write generated code
	codeFile := filepath.Join(tmpDir, "generated.go")
	if err := os.WriteFile(codeFile, []byte(code), 0644); err != nil {
		return nil, fmt.Errorf("failed to write generated code: %w", err)
	}

	// Generate benchmark harness
	harness := generateBenchmarkHarness(schema)
	harnessFile := filepath.Join(tmpDir, "bench_test.go")
	if err := os.WriteFile(harnessFile, []byte(harness), 0644); err != nil {
		return nil, fmt.Errorf("failed to write benchmark harness: %w", err)
	}

	// Initialize go.mod
	cmd := exec.Command("go", "mod", "init", "benchmodule")
	cmd.Dir = tmpDir
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to init go module: %w", err)
	}

	// Add dependency on binschema runtime
	cwd, _ := os.Getwd()
	runtimePath := filepath.Join(cwd, "go")

	goModPath := filepath.Join(tmpDir, "go.mod")
	goModContent, _ := os.ReadFile(goModPath)
	goModContent = append(goModContent, []byte(fmt.Sprintf("\nreplace github.com/anthropics/binschema => %s\n", runtimePath))...)
	if err := os.WriteFile(goModPath, goModContent, 0644); err != nil {
		return nil, fmt.Errorf("failed to update go.mod: %w", err)
	}

	// Run go mod tidy to fetch dependencies
	cmd = exec.Command("go", "mod", "tidy")
	cmd.Dir = tmpDir
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("failed to get dependencies: %w\nOutput: %s", err, output)
	}

	// Run benchmarks
	cmd = exec.Command("go", "test", "-bench=.", "-benchmem", "-benchtime=1s")
	cmd.Dir = tmpDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to run benchmarks: %w\nOutput: %s", err, output)
	}

	// Parse benchmark output
	results := parseBenchmarkOutput(string(output), schema.Name)

	// Print inline results
	for _, r := range results {
		fmt.Printf("  ⏱️  %s/%s: %s/op (%s ops/s)\n",
			r.Name, r.Operation, formatNs(r.AvgTimeNs), formatOps(r.OpsPerSecond))
	}

	return results, nil
}

func generateGoSource(schema map[string]interface{}) (string, error) {
	tmpDir, err := os.MkdirTemp("", "binschema-go-gen-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	schemaFile := filepath.Join(tmpDir, "schema.json")
	schemaBytes, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal schema: %w", err)
	}
	if err := os.WriteFile(schemaFile, schemaBytes, 0644); err != nil {
		return "", fmt.Errorf("failed to write schema file: %w", err)
	}

	outputDir := filepath.Join(tmpDir, "out")
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create output dir: %w", err)
	}

	// Get project root
	cwd, _ := os.Getwd()
	toolsRoot := cwd

	cmd := exec.Command(
		"bun", "run", "packages/binschema/src/cli/index.ts", "generate",
		"--language", "go",
		"--schema", schemaFile,
		"--out", outputDir,
	)
	cmd.Dir = toolsRoot
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("failed to run Go generator CLI: %w\nOutput: %s", err, output)
	}

	codePath := filepath.Join(outputDir, "generated.go")
	codeBytes, err := os.ReadFile(codePath)
	if err != nil {
		return "", fmt.Errorf("failed to read generated code: %w", err)
	}

	// Change package name from "generated" to "main"
	code := strings.Replace(string(codeBytes), "package generated", "package main", 1)

	return code, nil
}

func generateBenchmarkHarness(schema BenchmarkSchema) string {
	var sb strings.Builder

	sb.WriteString(`package main

import (
	"testing"
)

// Prevent compiler optimizations from eliminating benchmark operations
var benchResult interface{}
var benchBytes []byte

`)

	// Generate benchmark functions for each benchmark
	for benchName, bench := range schema.Benchmarks {
		typeName := bench.Type
		funcName := "Benchmark" + toPascalCase(benchName)

		// Generate value construction
		valueCode := generateValueCode(bench.Value, bench.Generator, typeName)

		// Encode benchmark
		sb.WriteString(fmt.Sprintf(`func %s_Encode(b *testing.B) {
	value := %s
	var result []byte
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bytes, _ := value.Encode()
		result = bytes
	}
	benchBytes = result
	b.SetBytes(int64(len(result)))
}

`, funcName, valueCode))

		// Decode benchmark
		sb.WriteString(fmt.Sprintf(`func %s_Decode(b *testing.B) {
	value := %s
	bytes, _ := value.Encode()

	var result interface{}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		decoded, _ := Decode%s(bytes)
		result = decoded
	}
	benchResult = result
	b.SetBytes(int64(len(bytes)))
}

`, funcName, valueCode, typeName))
	}

	return sb.String()
}

func generateValueCode(value interface{}, generator map[string]interface{}, typeName string) string {
	// If there's a generator, merge it with the value
	if generator != nil {
		if value == nil {
			value = make(map[string]interface{})
		}
		valueMap := value.(map[string]interface{})
		for field, spec := range generator {
			specMap := spec.(map[string]interface{})
			genType := specMap["type"].(string)
			switch genType {
			case "range":
				count := int(specMap["count"].(float64))
				start := int(specMap["start"].(float64))
				arr := make([]int, count)
				for i := 0; i < count; i++ {
					arr[i] = start + i
				}
				valueMap[field] = arr
			case "bytes":
				count := int(specMap["count"].(float64))
				arr := make([]int, count)
				for i := 0; i < count; i++ {
					arr[i] = i % 256
				}
				valueMap[field] = arr
			}
		}
		value = valueMap
	}

	return formatGoValue(value, typeName)
}

func formatGoValue(value interface{}, typeName string) string {
	if value == nil {
		return "&" + typeName + "{}"
	}

	switch v := value.(type) {
	case map[string]interface{}:
		var fields []string
		for name, val := range v {
			fieldName := toPascalCase(name)
			fieldVal := formatGoFieldValue(val, fieldName)
			fields = append(fields, fmt.Sprintf("%s: %s", fieldName, fieldVal))
		}
		sort.Strings(fields) // Sort for deterministic output
		return fmt.Sprintf("&%s{%s}", typeName, strings.Join(fields, ", "))
	default:
		return fmt.Sprintf("%v", v)
	}
}

func formatGoFieldValue(value interface{}, fieldName string) string {
	switch v := value.(type) {
	case map[string]interface{}:
		// Nested struct - use field name as type name hint
		nestedTypeName := fieldName
		var fields []string
		for name, val := range v {
			nestedFieldName := toPascalCase(name)
			fieldVal := formatGoFieldValue(val, nestedFieldName)
			fields = append(fields, fmt.Sprintf("%s: %s", nestedFieldName, fieldVal))
		}
		sort.Strings(fields)
		return fmt.Sprintf("%s{%s}", nestedTypeName, strings.Join(fields, ", "))
	case []interface{}:
		var items []string
		for _, item := range v {
			items = append(items, formatGoFieldValue(item, ""))
		}
		// Determine array type from first element
		if len(v) > 0 {
			switch v[0].(type) {
			case float64:
				return fmt.Sprintf("[]uint32{%s}", strings.Join(items, ", "))
			case map[string]interface{}:
				return fmt.Sprintf("[]%s{%s}", fieldName, strings.Join(items, ", "))
			}
		}
		return fmt.Sprintf("[]interface{}{%s}", strings.Join(items, ", "))
	case []int:
		var items []string
		for _, item := range v {
			items = append(items, fmt.Sprintf("%d", item))
		}
		return fmt.Sprintf("[]uint32{%s}", strings.Join(items, ", "))
	case float64:
		// Check if it's actually an integer
		if v == float64(int64(v)) {
			return fmt.Sprintf("%d", int64(v))
		}
		return fmt.Sprintf("%v", v)
	case string:
		return fmt.Sprintf("%q", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func toPascalCase(s string) string {
	parts := strings.Split(s, "_")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
	}
	return strings.Join(parts, "")
}

func parseBenchmarkOutput(output string, schemaName string) []BenchmarkResult {
	var results []BenchmarkResult

	// Parse Go benchmark output format:
	// BenchmarkPoint_Encode-16    26052536    46.93 ns/op    170.47 MB/s    8 B/op    1 allocs/op
	// Note: MB/s field is optional and there may be different spacing
	re := regexp.MustCompile(`Benchmark(\w+)_(Encode|Decode)-\d+\s+(\d+)\s+([\d.]+)\s+ns/op(?:\s+[\d.]+\s+MB/s)?\s+(\d+)\s+B/op`)

	for _, match := range re.FindAllStringSubmatch(output, -1) {
		benchName := match[1]
		operation := strings.ToLower(match[2])
		iterations, _ := strconv.Atoi(match[3])
		avgNs, _ := strconv.ParseFloat(match[4], 64)
		bytesPerOp, _ := strconv.Atoi(match[5])

		fullName := schemaName + "/" + toSnakeCase(benchName)

		results = append(results, BenchmarkResult{
			Name:         fullName,
			Type:         benchName,
			Operation:    operation,
			Iterations:   iterations,
			TotalTimeNs:  avgNs * float64(iterations),
			AvgTimeNs:    avgNs,
			OpsPerSecond: 1e9 / avgNs,
			BytesPerOp:   bytesPerOp,
		})
	}

	return results
}

func toSnakeCase(s string) string {
	var result []rune
	for i, r := range s {
		isUpper := r >= 'A' && r <= 'Z'

		// Add underscore before uppercase if previous char was lowercase or digit
		if i > 0 && isUpper {
			prev := rune(s[i-1])
			prevIsLowerOrDigit := (prev >= 'a' && prev <= 'z') || (prev >= '0' && prev <= '9')
			if prevIsLowerOrDigit {
				result = append(result, '_')
			}
		}
		result = append(result, r)
	}
	// Clean up any double underscores
	res := strings.ToLower(string(result))
	for strings.Contains(res, "__") {
		res = strings.ReplaceAll(res, "__", "_")
	}
	return res
}

func formatNs(ns float64) string {
	if ns < 1000 {
		return fmt.Sprintf("%.1fns", ns)
	} else if ns < 1000000 {
		return fmt.Sprintf("%.2fµs", ns/1000)
	} else {
		return fmt.Sprintf("%.2fms", ns/1000000)
	}
}

func formatOps(ops float64) string {
	if ops >= 1000000 {
		return fmt.Sprintf("%.2fM", ops/1000000)
	} else if ops >= 1000 {
		return fmt.Sprintf("%.2fK", ops/1000)
	} else {
		return fmt.Sprintf("%.0f", ops)
	}
}
