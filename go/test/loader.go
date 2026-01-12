// ABOUTME: Loads JSON test suites and handles BigInt parsing for cross-language test compatibility
// ABOUTME: Provides utilities for finding and parsing test files from the .generated/tests-json directory
package test

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/aeolun/json5"
)

// TestSuite represents a complete test suite loaded from JSON
type TestSuite struct {
	Name                  string                 `json:"name"`
	Description           string                 `json:"description"`
	Schema                map[string]interface{} `json:"schema"`
	TestType              string                 `json:"test_type"`
	TestCases             []TestCase             `json:"test_cases"` // Primary field name
	Tests                 []TestCase             `json:"tests"`      // Alternative field name (both are accepted)
	SchemaValidationError bool                   `json:"schema_validation_error,omitempty"` // True if this tests schema validation failure
	ErrorMessage          string                 `json:"error_message,omitempty"`           // Expected error message for validation error tests
}

// GetTestCases returns the test cases, handling both "test_cases" and "tests" field names
func (s *TestSuite) GetTestCases() []TestCase {
	if len(s.TestCases) > 0 {
		return s.TestCases
	}
	return s.Tests
}

// TestCase represents a single test case within a suite
type TestCase struct {
	Description         string      `json:"description"`
	Value               interface{} `json:"value"`
	DecodedValue        interface{} `json:"decoded_value,omitempty"` // Expected value after decoding (may differ from input due to computed fields)
	Bytes               []byte      `json:"bytes"`
	Bits                []int       `json:"bits,omitempty"`
	ChunkSizes          []int       `json:"chunkSizes,omitempty"`
	Error               *string     `json:"error,omitempty"`
	ShouldError         bool        `json:"should_error,omitempty"`         // General error expected (decode or encode)
	ShouldErrorOnEncode bool        `json:"should_error_on_encode,omitempty"`
	ShouldErrorOnDecode bool        `json:"should_error_on_decode,omitempty"`
}

// LoadTestSuite loads a single test suite from a JSON file
func LoadTestSuite(path string) (*TestSuite, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read test file %s: %w", path, err)
	}

	var suite TestSuite
	if err := json5.Unmarshal(data, &suite); err != nil {
		return nil, fmt.Errorf("failed to parse test file %s: %w", path, err)
	}

	// Post-process to handle BigInt strings (e.g., "12345n" -> int64)
	// Normalize test cases (handle both "test_cases" and "tests" field names)
	testCases := suite.GetTestCases()
	testCases = processBigIntInTestCases(testCases)
	suite.TestCases = testCases
	suite.Tests = nil // Clear the alternative field after normalization

	// Get schema's bit_order (default to "msb_first")
	bitOrder := "msb_first"
	if config, ok := suite.Schema["config"].(map[string]interface{}); ok {
		if order, ok := config["bit_order"].(string); ok {
			bitOrder = order
		}
	}

	// Convert bits to bytes for test cases that use bit-level encoding
	suite.TestCases = convertBitsToBytes(suite.TestCases, bitOrder)

	return &suite, nil
}

// LoadAllTestSuites loads all test suites from a directory (recursively)
func LoadAllTestSuites(rootDir string) ([]*TestSuite, error) {
	var suites []*TestSuite

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Only process .test.json files
		if !info.IsDir() && strings.HasSuffix(path, ".test.json") {
			suite, err := LoadTestSuite(path)
			if err != nil {
				return fmt.Errorf("failed to load %s: %w", path, err)
			}
			suites = append(suites, suite)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return suites, nil
}

// processBigIntInTestCases processes test cases to convert BigInt strings to int64
func processBigIntInTestCases(cases []TestCase) []TestCase {
	for i := range cases {
		cases[i].Value = processBigIntValue(cases[i].Value)
		if cases[i].DecodedValue != nil {
			cases[i].DecodedValue = processBigIntValue(cases[i].DecodedValue)
		}
	}
	return cases
}

// processBigIntValue recursively processes a value to convert BigInt strings
func processBigIntValue(val interface{}) interface{} {
	switch v := val.(type) {
	case string:
		// Check if it's a BigInt string (ends with 'n')
		if strings.HasSuffix(v, "n") {
			numStr := strings.TrimSuffix(v, "n")
			if num, err := strconv.ParseInt(numStr, 10, 64); err == nil {
				return num
			}
			if num, err := strconv.ParseUint(numStr, 10, 64); err == nil {
				return num
			}
		}
		return v
	case map[string]interface{}:
		// Recursively process map values
		result := make(map[string]interface{})
		for k, v := range v {
			result[k] = processBigIntValue(v)
		}
		return result
	case []interface{}:
		// Recursively process array elements
		result := make([]interface{}, len(v))
		for i, elem := range v {
			result[i] = processBigIntValue(elem)
		}
		return result
	default:
		return v
	}
}

// convertBitsToBytes converts test cases with `bits` field to `bytes` field
// This is needed because the Go test harness compares bytes, not bits
func convertBitsToBytes(cases []TestCase, bitOrder string) []TestCase {
	for i := range cases {
		// If test case has bits but no bytes, convert bits to bytes
		if len(cases[i].Bits) > 0 && len(cases[i].Bytes) == 0 {
			cases[i].Bytes = bitsToBytes(cases[i].Bits, bitOrder)
		}
	}
	return cases
}

// bitsToBytes converts a bit array to byte array respecting bit order
// For MSB first: bit 0 of array goes to position 7 of first byte
// For LSB first: bit 0 of array goes to position 0 of first byte
func bitsToBytes(bits []int, bitOrder string) []byte {
	if len(bits) == 0 {
		return []byte{}
	}

	// Calculate number of bytes needed
	numBytes := (len(bits) + 7) / 8
	bytes := make([]byte, numBytes)

	// Pack bits into bytes according to bit order
	for i, bit := range bits {
		if bit != 0 {
			byteIdx := i / 8
			var bitIdx int
			if bitOrder == "lsb_first" {
				bitIdx = i % 8 // LSB first: bit 0 at position 0
			} else {
				bitIdx = 7 - (i % 8) // MSB first: bit 0 at position 7
			}
			bytes[byteIdx] |= 1 << bitIdx
		}
	}

	return bytes
}
