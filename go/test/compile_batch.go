// ABOUTME: Batched compilation for Go test suites
// ABOUTME: Compiles all test suites at once for fast execution

package test

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/aeolun/json5"
)

// TestResult represents the result of a single test case
type TestResult struct {
	Description  string      `json:"description"`
	Pass         bool        `json:"pass"`
	Error        string      `json:"error,omitempty"`
	EncodedBytes []byte      `json:"encoded_bytes,omitempty"`
	DecodedValue interface{} `json:"decoded_value,omitempty"`
}

// CompileAndTestBatch compiles all test suites together and runs them
func CompileAndTestBatch(suites []*TestSuite) (map[string][]TestResult, error) {
	// Create temporary directory
	tmpDir, err := os.MkdirTemp("", "binschema-batch-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}

	// If DEBUG_GENERATED is set, save files to tmp-go/ instead of deleting
	debugDir := os.Getenv("DEBUG_GENERATED")
	if debugDir != "" {
		tmpDir = debugDir
		os.RemoveAll(tmpDir) // Clean old files
		os.MkdirAll(tmpDir, 0755)
	} else {
		defer os.RemoveAll(tmpDir)
	}

	// Track results for suites that fail code generation
	results := make(map[string][]TestResult)

	// Track which suites successfully generated code
	var successfulSuites []*TestSuite
	var typeNamePrefixes []string

	// Generate code for all suites - write each to its own file in main package
	for i, suite := range suites {
		// Skip suites with no test cases - these are schema validation error tests
		// that intentionally test invalid schemas (e.g., duplicate discriminator values)
		if len(suite.TestCases) == 0 {
			continue
		}

		code, err := generateGoSource(suite.Schema, suite.TestType)
		if err != nil {
			// Mark all test cases in this suite as failed due to code generation error
			var failedResults []TestResult
			for _, tc := range suite.TestCases {
				failedResults = append(failedResults, TestResult{
					Description: tc.Description,
					Pass:        false,
					Error:       fmt.Sprintf("code generation failed: %v", err),
				})
			}
			results[suite.Name] = failedResults
			continue
		}

		// Prefix type names to avoid conflicts
		prefix := strings.ReplaceAll(suite.Name, "-", "_")

		// Save original code for debugging if DEBUG_GENERATED is set
		// Use .go.orig extension so it doesn't get compiled with go run .
		if debugDir != "" {
			origFilename := fmt.Sprintf("orig_%d.go.orig", i)
			origFile := filepath.Join(tmpDir, origFilename)
			os.WriteFile(origFile, []byte(code), 0644)
		}

		prefixedCode := prefixTypeNames(code, suite.TestType, prefix)

		// Write to separate file (Go allows multiple files in same package/directory)
		filename := fmt.Sprintf("gen_%d.go", i)
		codeFile := filepath.Join(tmpDir, filename)
		if err := os.WriteFile(codeFile, []byte(prefixedCode), 0644); err != nil {
			return nil, fmt.Errorf("failed to write generated code: %w", err)
		}

		// Track successful generation
		successfulSuites = append(successfulSuites, suite)
		typeNamePrefixes = append(typeNamePrefixes, prefix)
	}

	// If no suites generated successfully, return the failure results
	if len(successfulSuites) == 0 {
		return results, nil
	}

	// Generate unified test harness (only for successfully generated suites)
	testHarness := generateBatchedTestHarness(successfulSuites, typeNamePrefixes)
	harnessFile := filepath.Join(tmpDir, "main.go")
	if err := os.WriteFile(harnessFile, []byte(testHarness), 0644); err != nil {
		return nil, fmt.Errorf("failed to write test harness: %w", err)
	}

	// Initialize go.mod
	cmd := exec.Command("go", "mod", "init", "testmodule")
	cmd.Dir = tmpDir
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to init go module: %w", err)
	}

	// Add dependency on binschema runtime
	runtimePath, err := filepath.Abs(".")
	if err != nil {
		return nil, fmt.Errorf("failed to get abs path: %w", err)
	}
	runtimePath = filepath.Dir(runtimePath) // go up to binschema root

	goModPath := filepath.Join(tmpDir, "go.mod")
	goModContent, err := os.ReadFile(goModPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read go.mod: %w", err)
	}

	goModContent = append(goModContent, []byte(fmt.Sprintf("\nreplace github.com/anthropics/binschema => %s\n", runtimePath))...)
	if err := os.WriteFile(goModPath, goModContent, 0644); err != nil {
		return nil, fmt.Errorf("failed to update go.mod: %w", err)
	}

	// Run go get to fetch dependencies
	cmd = exec.Command("go", "get", "github.com/anthropics/binschema/runtime", "github.com/aeolun/json5")
	cmd.Dir = tmpDir
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("failed to get dependencies: %w\nOutput: %s", err, output)
	}

	// Run the test harness (only one compilation!)
	cmd = exec.Command("go", "run", ".")
	cmd.Dir = tmpDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to run test harness: %w\nOutput: %s", err, output)
	}

	// Parse results - array of arrays, one per suite
	var allResults [][]TestResult
	if err := json5.Unmarshal(output, &allResults); err != nil {
		return nil, fmt.Errorf("failed to parse test results: %w\nOutput: %s", err, output)
	}

	// Map results from test harness back to suite names
	for i, suite := range successfulSuites {
		if i < len(allResults) {
			results[suite.Name] = allResults[i]
		}
	}

	return results, nil
}

// prefixTypeNames adds a prefix to ALL type names and functions to avoid conflicts
func prefixTypeNames(code string, typeName string, prefix string) string {
	// Use regexp to find and prefix ALL type definitions and decode functions
	// This is more robust than string replacement as schemas may define multiple types

	// Prefix all struct type definitions: "type Foo struct" -> "type prefix_Foo struct"
	// Include underscores to handle bitfield struct names like DnsMessage_Flags
	typeDefRegex := regexp.MustCompile(`\btype\s+([A-Z][a-zA-Z0-9_]*)\s+struct`)
	code = typeDefRegex.ReplaceAllStringFunc(code, func(match string) string {
		parts := typeDefRegex.FindStringSubmatch(match)
		if len(parts) >= 2 {
			typeName := parts[1]
			return fmt.Sprintf("type %s_%s struct", prefix, typeName)
		}
		return match
	})

	// Prefix all interface type definitions: "type Foo interface" -> "type prefix_Foo interface"
	interfaceDefRegex := regexp.MustCompile(`\btype\s+([A-Z][a-zA-Z0-9_]*)\s+interface`)
	code = interfaceDefRegex.ReplaceAllStringFunc(code, func(match string) string {
		parts := interfaceDefRegex.FindStringSubmatch(match)
		if len(parts) >= 2 {
			typeName := parts[1]
			return fmt.Sprintf("type %s_%s interface", prefix, typeName)
		}
		return match
	})

	// Prefix all Decode function DEFINITIONS: "func DecodeFoo" -> "func Decodeprefix_Foo"
	// and "func decodeFooWithDecoder" -> "func decodeprefixFooWithDecoder"
	// Note: Decode functions get prefix AFTER Decode, decode helpers get prefix BEFORE decode
	decodeFuncDefRegex := regexp.MustCompile(`(\bfunc\s+)Decode([A-Z][a-zA-Z0-9_]*)`)
	code = decodeFuncDefRegex.ReplaceAllString(code, fmt.Sprintf("${1}Decode%s_${2}", prefix))

	decodeHelperRegex := regexp.MustCompile(`(\bfunc\s+)decode([A-Z][a-zA-Z0-9_]*)`)
	code = decodeHelperRegex.ReplaceAllString(code, fmt.Sprintf("${1}%s_decode${2}", prefix))

	// Prefix type references in function CALLS: "DecodeFoo(" -> "Decodeprefix_Foo("
	// and "decodeFooWithDecoder(" -> "prefix_decodeFooWithDecoder("
	decodeCallRegex := regexp.MustCompile(`\bDecode([A-Z][a-zA-Z0-9_]*)\(`)
	code = decodeCallRegex.ReplaceAllString(code, fmt.Sprintf("Decode%s_${1}(", prefix))

	decodeHelperCallRegex := regexp.MustCompile(`\bdecode([A-Z][a-zA-Z0-9_]*)\(`)
	code = decodeHelperCallRegex.ReplaceAllString(code, fmt.Sprintf("%s_decode${1}(", prefix))

	// Prefix type references carefully to avoid breaking maps and other Go syntax
	// Only prefix: "&Foo{" -> "&prefix_Foo{", "*Foo," -> "*prefix_Foo,", " Foo{" -> " prefix_Foo{"
	// but NOT map[string]Foo or other complex expressions

	// Handle array types: []Type -> []prefix_Type
	code = regexp.MustCompile(`\[\]([A-Z][a-zA-Z0-9_]*)`).ReplaceAllString(code, fmt.Sprintf("[]%s_$1", prefix))

	// Handle &Type{} struct literals
	code = regexp.MustCompile(`&([A-Z][a-zA-Z0-9_]*)\{`).ReplaceAllString(code, fmt.Sprintf("&%s_$1{", prefix))

	// Handle *Type in function parameters/returns (with comma or closing paren after)
	code = regexp.MustCompile(`\*([A-Z][a-zA-Z0-9_]*)([,\)])`).ReplaceAllString(code, fmt.Sprintf("*%s_$1$2", prefix))

	// Handle *Type at end of line (struct field declarations like "Name *String")
	code = regexp.MustCompile(`\*([A-Z][a-zA-Z0-9_]*)(\s*)$`).ReplaceAllStringFunc(code, func(match string) string {
		// Process each line separately to match end of line
		return regexp.MustCompile(`\*([A-Z][a-zA-Z0-9_]*)(\s*)$`).ReplaceAllString(match, fmt.Sprintf("*%s_$1$2", prefix))
	})
	// Actually need to do per-line replacement for end-of-line patterns
	lines := strings.Split(code, "\n")
	for i, line := range lines {
		if regexp.MustCompile(`\s+\*([A-Z][a-zA-Z0-9_]*)$`).MatchString(line) {
			lines[i] = regexp.MustCompile(`(\s+)\*([A-Z][a-zA-Z0-9_]*)$`).ReplaceAllString(line, fmt.Sprintf("$1*%s_$2", prefix))
		}
	}
	code = strings.Join(lines, "\n")

	// Handle type assertions in case statements: "case *Type:" -> "case *prefix_Type:"
	code = regexp.MustCompile(`case\s+\*([A-Z][a-zA-Z0-9_]*):`).ReplaceAllString(code, fmt.Sprintf("case *%s_$1:", prefix))

	// Handle type assertions: elem.(*Type) -> elem.(*prefix_Type) and elem.(Type) -> elem.(prefix_Type)
	code = regexp.MustCompile(`\.\(\*([A-Z][a-zA-Z0-9_]*)\)`).ReplaceAllString(code, fmt.Sprintf(".(*%s_$1)", prefix))
	code = regexp.MustCompile(`\.\(([A-Z][a-zA-Z0-9_]*)\)`).ReplaceAllString(code, fmt.Sprintf(".(%s_$1)", prefix))

	// Handle bare Type in function return types: ) (Type, error) -> ) (prefix_Type, error)
	// Only match when preceded by ) to avoid matching function arguments
	code = regexp.MustCompile(`\)\s*\(([A-Z][a-zA-Z0-9_]*),`).ReplaceAllString(code, fmt.Sprintf(") (%s_$1,", prefix))

	// Handle Type{} struct literals (with space before)
	code = regexp.MustCompile(`\s([A-Z][a-zA-Z0-9_]*)\{`).ReplaceAllString(code, fmt.Sprintf(" %s_$1{", prefix))

	// Prefix method receivers: "func (m *Foo)" -> "func (m *prefix_Foo)"
	methodRegex := regexp.MustCompile(`\bfunc\s+\(([a-z])\s+\*([A-Z][a-zA-Z0-9_]*)\)`)
	code = methodRegex.ReplaceAllStringFunc(code, func(match string) string {
		parts := methodRegex.FindStringSubmatch(match)
		if len(parts) >= 3 {
			receiver := parts[1]
			typeName := parts[2]
			return fmt.Sprintf("func (%s *%s_%s)", receiver, prefix, typeName)
		}
		return match
	})

	// Handle field types in struct definitions: "FieldName TypeName" at end of line
	// Match patterns like "Value Discriminated_union" or "Cname CompressedDomain"
	// Be careful to match full lines to avoid false matches
	fieldTypeRegex := regexp.MustCompile(`(\s+\w+\s+)([A-Z][a-zA-Z0-9_]*)(\s*)$`)
	lines = strings.Split(code, "\n")
	for i, line := range lines {
		// Only process lines that look like field declarations (indent + word + Type)
		if fieldTypeRegex.MatchString(line) {
			lines[i] = fieldTypeRegex.ReplaceAllString(line, fmt.Sprintf("${1}%s_${2}${3}", prefix))
		}
	}
	code = strings.Join(lines, "\n")

	return code
}

func generateBatchedTestHarness(suites []*TestSuite, typePrefixes []string) string {
	harness := `package main

import (
	"bytes"
	"fmt"
	"math"
	"reflect"

	"github.com/aeolun/json5"
)

type TestResult struct {
	Description  string      ` + "`json:\"description\"`" + `
	Pass         bool        ` + "`json:\"pass\"`" + `
	Error        string      ` + "`json:\"error,omitempty\"`" + `
	EncodedBytes []byte      ` + "`json:\"encoded_bytes,omitempty\"`" + `
	DecodedValue interface{} ` + "`json:\"decoded_value,omitempty\"`" + `
}

// Pointer helper functions for optional fields
func ptrUint8(v uint8) *uint8 { return &v }
func ptrUint16(v uint16) *uint16 { return &v }
func ptrUint32(v uint32) *uint32 { return &v }
func ptrUint64(v uint64) *uint64 { return &v }
func ptrInt8(v int8) *int8 { return &v }
func ptrInt16(v int16) *int16 { return &v }
func ptrInt32(v int32) *int32 { return &v }
func ptrInt64(v int64) *int64 { return &v }
func ptrFloat32(v float32) *float32 { return &v }
func ptrFloat64(v float64) *float64 { return &v }
func ptrString(v string) *string { return &v }
func ptrBool(v bool) *bool { return &v }

func main() {
	_ = math.Pi
	_ = bytes.Equal // Ensure bytes import is used even for instance-field-only tests
	allResults := [][]TestResult{}

`

	// Generate test code for each suite
	for i, suite := range suites {
		typePrefix := typePrefixes[i]
		prefixedType := typePrefix + "_" + suite.TestType

		// Check if the test type has instance fields
		hasInstanceFields := false
		if types, ok := suite.Schema["types"].(map[string]interface{}); ok {
			if typeDef, ok := types[suite.TestType].(map[string]interface{}); ok {
				if instances, ok := typeDef["instances"].([]interface{}); ok && len(instances) > 0 {
					hasInstanceFields = true
				}
			}
		}

		harness += fmt.Sprintf("\t// Test suite: %s\n", suite.Name)
		harness += "\t{\n"
		harness += "\t\tresults := []TestResult{}\n\n"

		for j, tc := range suite.TestCases {
			// Skip encode-specific or decode-specific error tests (still not supported)
			if tc.ShouldErrorOnEncode || tc.ShouldErrorOnDecode {
				continue
			}

			harness += fmt.Sprintf("\t\t// Test case %d: %s\n", j, tc.Description)
			harness += "\t\tfunc() {\n"
			harness += fmt.Sprintf("\t\t\tresult := TestResult{Description: %q}\n", tc.Description)
			harness += "\t\t\tdefer func() { results = append(results, result) }()\n\n"

			// Handle should_error tests (general error expected)
			if tc.ShouldError {
				harness += fmt.Sprintf("\t\t\texpectedBytes := []byte{%s}\n", formatByteSlice(tc.Bytes))
				harness += fmt.Sprintf("\t\t\t_, decErr := Decode%s(expectedBytes)\n", prefixedType)
				harness += "\t\t\tif decErr == nil {\n"
				harness += "\t\t\t\tresult.Error = \"expected decode error but got none\"\n"
				harness += "\t\t\t\tresult.Pass = false\n"
				harness += "\t\t\t\treturn\n"
				harness += "\t\t\t}\n"
				harness += "\t\t\tresult.Pass = true\n"
				harness += "\t\t}()\n\n"
				continue
			}

			// Generate expected decoded value if different from input
			hasDecodedValue := tc.DecodedValue != nil
			if hasDecodedValue {
				harness += generateValueConstructionWithSchema(prefixedType, tc.DecodedValue, "expectedDecoded", suite, typePrefix)
			}

			// Generate value construction with schema information
			// For types with instance fields AND hasDecodedValue, we only need expectedDecoded
			// Otherwise we need testValue for either encoding or comparison
			needsTestValue := !hasInstanceFields || !hasDecodedValue
			if needsTestValue {
				harness += generateValueConstructionWithSchema(prefixedType, tc.Value, "testValue", suite, typePrefix)
			}

			// Define expectedBytes for types with instance fields (used for decode-only testing)
			harness += fmt.Sprintf("\t\t\texpectedBytes := []byte{%s}\n", formatByteSlice(tc.Bytes))

			if hasInstanceFields {
				// For types with instance fields, only test decoding
				// Instance fields are decode-only (data is at different positions in the file)
				harness += "\t\t\t// Instance fields are decode-only - skip encoding comparison\n"
				harness += "\t\t\tresult.EncodedBytes = expectedBytes\n\n"

				// Decode from expected bytes (which contains all data including instance positions)
				harness += fmt.Sprintf("\t\t\tdecoded, decErr := Decode%s(expectedBytes)\n", prefixedType)
				harness += "\t\t\tif decErr != nil {\n"
				harness += "\t\t\t\tresult.Error = fmt.Sprintf(\"decode error: %v\", decErr)\n"
				harness += "\t\t\t\treturn\n"
				harness += "\t\t\t}\n"
				harness += "\t\t\tresult.DecodedValue = decoded\n\n"
			} else {
				// Normal round-trip testing for types without instance fields
				// Encode
				harness += "\t\t\tencoded, encErr := testValue.Encode()\n"
				harness += "\t\t\tif encErr != nil {\n"
				harness += "\t\t\t\tresult.Error = fmt.Sprintf(\"encode error: %v\", encErr)\n"
				harness += "\t\t\t\treturn\n"
				harness += "\t\t\t}\n"
				harness += "\t\t\tresult.EncodedBytes = encoded\n\n"

				// Compare bytes
				harness += "\t\t\tif !bytes.Equal(encoded, expectedBytes) {\n"
				harness += "\t\t\t\tresult.Error = fmt.Sprintf(\"encoded bytes mismatch: got %v, want %v\", encoded, expectedBytes)\n"
				harness += "\t\t\t\tresult.Pass = false\n"
				harness += "\t\t\t\treturn\n"
				harness += "\t\t\t}\n\n"

				// Decode
				harness += fmt.Sprintf("\t\t\tdecoded, decErr := Decode%s(encoded)\n", prefixedType)
				harness += "\t\t\tif decErr != nil {\n"
				harness += "\t\t\t\tresult.Error = fmt.Sprintf(\"decode error: %v\", decErr)\n"
				harness += "\t\t\t\treturn\n"
				harness += "\t\t\t}\n"
				harness += "\t\t\tresult.DecodedValue = decoded\n\n"
			}

			// Compare values - use expectedDecoded if available, otherwise testValue
			if hasDecodedValue {
				harness += "\t\t\tif !reflect.DeepEqual(decoded, &expectedDecoded) {\n"
				harness += "\t\t\t\tresult.Error = fmt.Sprintf(\"decoded value mismatch: got %+v, want %+v\", decoded, expectedDecoded)\n"
			} else {
				harness += "\t\t\tif !reflect.DeepEqual(decoded, &testValue) {\n"
				harness += "\t\t\t\tresult.Error = fmt.Sprintf(\"decoded value mismatch: got %+v, want %+v\", decoded, testValue)\n"
			}
			harness += "\t\t\t\tresult.Pass = false\n"
			harness += "\t\t\t\treturn\n"
			harness += "\t\t\t}\n\n"

			harness += "\t\t\tresult.Pass = true\n"
			harness += "\t\t}()\n\n"
		}

		harness += "\t\tallResults = append(allResults, results)\n"
		harness += "\t}\n\n"
	}

	harness += `
	// Output results as JSON5
	data, err := json5.Marshal(allResults)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(data))
}
`

	return harness
}

func generateValueConstructionWithSchema(typeName string, value interface{}, varName string, suite *TestSuite, typePrefix string) string {
	// Get the type definition from the schema
	types, ok := suite.Schema["types"].(map[string]interface{})
	if !ok {
		return generateValueConstructionSimple(typeName, value, varName)
	}

	typeDef, ok := types[suite.TestType].(map[string]interface{})
	if !ok {
		return generateValueConstructionSimple(typeName, value, varName)
	}

	// Check if this is a string type alias (type definition where type == "string")
	// Go generator wraps these in a struct with a Value field
	if typeDefType, _ := typeDef["type"].(string); typeDefType == "string" {
		if strVal, ok := value.(string); ok {
			return fmt.Sprintf("\t\t\t%s := %s{Value: %q}\n", varName, typeName, strVal)
		}
	}

	// Check if this is an array type alias (type definition where type == "array")
	// Go generator wraps these in a struct with a Value field
	if typeDefType, _ := typeDef["type"].(string); typeDefType == "array" {
		if arrVal, ok := value.([]interface{}); ok {
			// Get the array item type for proper formatting
			typePrefix := strings.TrimSuffix(typeName, "_"+suite.TestType)
			arrayValue := formatArrayTypeAliasValue(arrVal, typeDef, types, typePrefix, suite.TestType)
			return fmt.Sprintf("\t\t\t%s := %s{Value: %s}\n", varName, typeName, arrayValue)
		}
	}

	valueMap, ok := value.(map[string]interface{})
	if !ok {
		return fmt.Sprintf("\t\t\t%s := %s{}\n", varName, typeName)
	}

	// Build field definitions map from schema (sequence fields)
	fieldDefs := make(map[string]map[string]interface{})
	if sequence, ok := typeDef["sequence"].([]interface{}); ok {
		for _, fieldRaw := range sequence {
			if field, ok := fieldRaw.(map[string]interface{}); ok {
				if name, ok := field["name"].(string); ok {
					fieldDefs[name] = field
				}
			}
		}
	}

	// Build instance field definitions map from schema (position-based fields)
	instanceDefs := make(map[string]map[string]interface{})
	if instances, ok := typeDef["instances"].([]interface{}); ok {
		for _, instanceRaw := range instances {
			if instance, ok := instanceRaw.(map[string]interface{}); ok {
				if name, ok := instance["name"].(string); ok {
					instanceDefs[name] = instance
				}
			}
		}
	}

	// Use the test type as the base name (typePrefix + "_" + baseTypeName = typeName)
	baseTypeName := suite.TestType

	result := fmt.Sprintf("\t\t\t%s := %s{\n", varName, typeName)
	for key, val := range valueMap {
		fieldDef := fieldDefs[key]
		instanceDef := instanceDefs[key]

		// Handle sequence fields
		if fieldDef != nil {
			fieldName := capitalizeFirst(key)
			formattedVal := formatValueWithSchema(val, fieldDef, types, typePrefix, baseTypeName, key)
			result += fmt.Sprintf("\t\t\t\t%s: %s,\n", fieldName, formattedVal)
			continue
		}

		// Handle instance fields (position-based)
		if instanceDef != nil {
			fieldName := capitalizeFirst(key)
			formattedVal := formatInstanceFieldValue(val, instanceDef, types, typePrefix)
			result += fmt.Sprintf("\t\t\t\t%s: %s,\n", fieldName, formattedVal)
			continue
		}

		// Skip fields that don't exist in the schema
	}
	result += "\t\t\t}\n"

	return result
}

// formatInstanceFieldValue formats an instance field value
// Instance fields are position-based (decoded at specific offsets)
func formatInstanceFieldValue(val interface{}, instanceDef map[string]interface{}, types map[string]interface{}, typePrefix string) string {
	if val == nil {
		return "nil"
	}

	// Get the instance type
	instanceType := instanceDef["type"]

	// Handle inline discriminated union type (type is an object with discriminator and variants)
	if instanceTypeObj, ok := instanceType.(map[string]interface{}); ok {
		if _, hasDiscriminator := instanceTypeObj["discriminator"]; hasDiscriminator {
			// Inline discriminated union - value is map with "type" and "value"
			valMap, ok := val.(map[string]interface{})
			if !ok {
				return "nil"
			}
			variantType, _ := valMap["type"].(string)
			variantValue := valMap["value"]
			goTypeName := typePrefix + "_" + capitalizeFirst(variantType)

			// Format the variant value as a struct
			if variantValMap, ok := variantValue.(map[string]interface{}); ok {
				typeDef, _ := types[variantType].(map[string]interface{})
				return fmt.Sprintf("map[string]interface{}{\"type\": %q, \"value\": &%s}", variantType, formatStructValue(variantValMap, typeDef, types, typePrefix, variantType))
			}
			return fmt.Sprintf("map[string]interface{}{\"type\": %q, \"value\": &%s{}}", variantType, goTypeName)
		}
	}

	// Simple type reference - instanceType is a string
	instanceTypeName, ok := instanceType.(string)
	if !ok {
		return "nil"
	}

	// Check if the type exists in the schema
	typeDef, hasTypeDef := types[instanceTypeName].(map[string]interface{})
	if hasTypeDef {
		typeDefType, _ := typeDef["type"].(string)

		// Handle type aliases (e.g., Uint8: { type: 'uint8' })
		// Go generator wraps these in a struct with a Value field
		if typeDefType != "" && typeDefType != "discriminated_union" && typeDefType != "array" {
			// Check if it's a primitive type alias
			goTypeName := typePrefix + "_" + capitalizeFirst(instanceTypeName)
			formattedVal := formatValueWithType(val, typeDefType)
			return fmt.Sprintf("&%s{Value: %s}", goTypeName, formattedVal)
		}

		// Check for discriminated union type
		if typeDefType == "discriminated_union" {
			// Discriminated union value - formatted as wrapped value
			valMap, ok := val.(map[string]interface{})
			if !ok {
				return "nil"
			}
			return formatDiscriminatedUnionValue(valMap, typeDef, types, typePrefix)
		}

		// Regular struct type - value is a map
		if valMap, ok := val.(map[string]interface{}); ok {
			return "&" + formatStructValue(valMap, typeDef, types, typePrefix, instanceTypeName)
		}
	}

	return "nil"
}

// formatValueWithSchema formats a value using full field definition and schema context
// parentTypeName is the base type name (without prefix) of the parent struct
// fieldName is the name of the field being formatted (for nested type names)
func formatValueWithSchema(val interface{}, fieldDef map[string]interface{}, types map[string]interface{}, typePrefix string, parentTypeName string, fieldName string) string {
	if fieldDef == nil {
		return formatValue(val)
	}

	fieldType, _ := fieldDef["type"].(string)

	// Handle inline array fields
	if fieldType == "array" {
		if valSlice, ok := val.([]interface{}); ok {
			return formatArrayWithSchema(valSlice, fieldDef, types, typePrefix, parentTypeName, fieldName)
		}
	}

	// Handle inline bitfield fields
	if fieldType == "bitfield" {
		if valMap, ok := val.(map[string]interface{}); ok {
			return formatBitfieldValue(valMap, typePrefix, parentTypeName, fieldName)
		}
	}

	// Handle inline discriminated_union fields
	if fieldType == "discriminated_union" {
		if valMap, ok := val.(map[string]interface{}); ok {
			return formatDiscriminatedUnionValue(valMap, fieldDef, types, typePrefix)
		}
	}

	// Handle optional fields - wrap value in pointer helper
	if fieldType == "optional" {
		if val == nil {
			return "nil"
		}
		valueType, _ := fieldDef["value_type"].(string)
		formattedVal := formatValueWithType(val, valueType)
		// Use pointer helper function based on value_type
		switch valueType {
		case "uint8":
			return fmt.Sprintf("ptrUint8(uint8(%s))", formattedVal)
		case "uint16":
			return fmt.Sprintf("ptrUint16(uint16(%s))", formattedVal)
		case "uint32":
			return fmt.Sprintf("ptrUint32(uint32(%s))", formattedVal)
		case "uint64":
			return fmt.Sprintf("ptrUint64(uint64(%s))", formattedVal)
		case "int8":
			return fmt.Sprintf("ptrInt8(int8(%s))", formattedVal)
		case "int16":
			return fmt.Sprintf("ptrInt16(int16(%s))", formattedVal)
		case "int32":
			return fmt.Sprintf("ptrInt32(int32(%s))", formattedVal)
		case "int64":
			return fmt.Sprintf("ptrInt64(int64(%s))", formattedVal)
		case "float32":
			return fmt.Sprintf("ptrFloat32(float32(%s))", formattedVal)
		case "float64":
			return fmt.Sprintf("ptrFloat64(float64(%s))", formattedVal)
		case "string":
			return fmt.Sprintf("ptrString(%s)", formattedVal)
		default:
			// For type references (structs), format and take address
			if typeDef, hasTypeDef := types[valueType].(map[string]interface{}); hasTypeDef {
				typeDefType, _ := typeDef["type"].(string)
				goTypeName := typePrefix + "_" + capitalizeFirst(valueType)

				// Type reference to string type - value is just a string
				if typeDefType == "string" {
					if strVal, ok := val.(string); ok {
						return fmt.Sprintf("&%s{Value: %q}", goTypeName, strVal)
					}
				}

				// Type reference to struct type - value is a map
				if valMap, ok := val.(map[string]interface{}); ok {
					return "&" + formatStructValue(valMap, typeDef, types, typePrefix, valueType)
				}
			}
			return formattedVal
		}
	}

	// Handle type references (field type is a name in types map)
	if typeDef, hasTypeDef := types[fieldType].(map[string]interface{}); hasTypeDef {
		typeDefType, _ := typeDef["type"].(string)

		// Handle type reference to string type
		if typeDefType == "string" {
			if strVal, ok := val.(string); ok {
				goTypeName := typePrefix + "_" + capitalizeFirst(fieldType)
				return fmt.Sprintf("%s{Value: %q}", goTypeName, strVal)
			}
		}

		// Handle type reference to array type (e.g., CompressedDomain -> array of CompressedLabel)
		// Go generator wraps array type aliases in a struct with a Value field
		if typeDefType == "array" {
			if valSlice, ok := val.([]interface{}); ok {
				goTypeName := typePrefix + "_" + capitalizeFirst(fieldType)
				arrayVal := formatArrayTypeAliasValue(valSlice, typeDef, types, typePrefix, fieldType)
				return fmt.Sprintf("%s{Value: %s}", goTypeName, arrayVal)
			}
		}

		// Handle type reference to discriminated_union type
		if typeDefType == "discriminated_union" {
			if valMap, ok := val.(map[string]interface{}); ok {
				return formatDiscriminatedUnionValue(valMap, typeDef, types, typePrefix)
			}
		}

		// Handle type alias to another user-defined type (e.g., Realm -> KerberosString)
		// Go generator wraps these in a struct with a Value field
		if aliasedTypeDef, hasAliasedType := types[typeDefType].(map[string]interface{}); hasAliasedType {
			goTypeName := typePrefix + "_" + fieldType
			if valMap, ok := val.(map[string]interface{}); ok {
				innerValue := formatStructValue(valMap, aliasedTypeDef, types, typePrefix, typeDefType)
				return fmt.Sprintf("%s{Value: %s}", goTypeName, innerValue)
			}
		}

		// Handle type reference to struct type
		if valMap, ok := val.(map[string]interface{}); ok {
			return formatStructValue(valMap, typeDef, types, typePrefix, fieldType)
		}
	}

	// For other types, use existing formatValueWithType
	return formatValueWithType(val, fieldType)
}

// formatArrayWithSchema formats an array using schema info (handles choice types)
// schemaTypeName is the name of the containing type in the schema (e.g., "EncryptedData")
// fieldName is the name of the array field (e.g., "fields")
func formatArrayWithSchema(arr []interface{}, fieldDef map[string]interface{}, types map[string]interface{}, typePrefix string, schemaTypeName string, fieldName string) string {
	items, ok := fieldDef["items"].(map[string]interface{})
	if !ok {
		return formatValue(arr)
	}

	itemType, _ := items["type"].(string)

	// Handle inline choice type arrays
	if itemType == "choice" {
		return formatChoiceArray(arr, items, types, typePrefix, schemaTypeName, fieldName)
	}

	// Handle inline discriminated_union type arrays
	if itemType == "discriminated_union" {
		return formatDiscriminatedUnionArray(arr, items, types, typePrefix)
	}

	// Handle nested arrays (2D arrays, etc.)
	if itemType == "array" {
		innerItems, _ := items["items"].(map[string]interface{})
		innerItemType, _ := innerItems["type"].(string)
		goInnerType := mapPrimitiveType(innerItemType)
		if goInnerType == "" {
			goInnerType = typePrefix + "_" + capitalizeFirst(innerItemType)
		}

		if len(arr) == 0 {
			return fmt.Sprintf("[][]%s{}", goInnerType)
		}

		var rows []string
		for _, row := range arr {
			if rowArr, ok := row.([]interface{}); ok {
				var elements []string
				for _, elem := range rowArr {
					elements = append(elements, formatValueWithType(elem, innerItemType))
				}
				rows = append(rows, fmt.Sprintf("{%s}", strings.Join(elements, ", ")))
			}
		}
		return fmt.Sprintf("[][]%s{%s}", goInnerType, strings.Join(rows, ", "))
	}

	// Handle type references
	if typeDef, hasTypeDef := types[itemType].(map[string]interface{}); hasTypeDef {
		typeDefType, _ := typeDef["type"].(string)

		// Handle reference to discriminated_union type (e.g., CompressedLabel)
		if typeDefType == "discriminated_union" {
			// Use the typed version with the type name
			return formatDiscriminatedUnionArrayTyped(arr, typeDef, types, typePrefix, itemType)
		}

		// Handle reference to string type alias (e.g., Label)
		// Go generator wraps these in a struct with a Value field
		if typeDefType == "string" {
			goTypeName := typePrefix + "_" + capitalizeFirst(itemType)
			if len(arr) == 0 {
				return fmt.Sprintf("[]%s{}", goTypeName)
			}
			result := fmt.Sprintf("[]%s{\n", goTypeName)
			for _, elem := range arr {
				if strVal, ok := elem.(string); ok {
					result += fmt.Sprintf("\t\t\t\t\t{Value: %q},\n", strVal)
				}
			}
			result += "\t\t\t\t}"
			return result
		}

		// Handle reference to struct type
		goTypeName := typePrefix + "_" + capitalizeFirst(itemType)
		if len(arr) == 0 {
			return fmt.Sprintf("[]%s{}", goTypeName)
		}
		result := fmt.Sprintf("[]%s{\n", goTypeName)
		for _, elem := range arr {
			if elemMap, ok := elem.(map[string]interface{}); ok {
				result += "\t\t\t\t\t" + formatStructValue(elemMap, typeDef, types, typePrefix, itemType) + ",\n"
			}
		}
		result += "\t\t\t\t}"
		return result
	}

	// Primitive arrays - use element type from schema
	if isPrimitiveType(itemType) {
		goElemType := mapPrimitiveType(itemType)
		if len(arr) == 0 {
			return fmt.Sprintf("[]%s{}", goElemType)
		}
		var elements []string
		for _, elem := range arr {
			elements = append(elements, formatValueWithType(elem, itemType))
		}
		return fmt.Sprintf("[]%s{%s}", goElemType, strings.Join(elements, ", "))
	}

	// String arrays (inline string items, not type references)
	if itemType == "string" {
		if len(arr) == 0 {
			return "[]string{}"
		}
		var elements []string
		for _, elem := range arr {
			if strVal, ok := elem.(string); ok {
				elements = append(elements, fmt.Sprintf("%q", strVal))
			} else {
				elements = append(elements, formatValueWithType(elem, "string"))
			}
		}
		return fmt.Sprintf("[]string{%s}", strings.Join(elements, ", "))
	}

	// Fallback for unknown types
	return formatValueWithType(arr, "array")
}

// formatArrayTypeAliasValue formats an array for a type alias (e.g., CompressedDomain with items of CompressedLabel)
func formatArrayTypeAliasValue(arr []interface{}, typeDef map[string]interface{}, types map[string]interface{}, typePrefix string, arrayTypeName string) string {
	items, ok := typeDef["items"].(map[string]interface{})
	if !ok {
		return formatValue(arr)
	}

	itemType, _ := items["type"].(string)

	// Handle reference to discriminated_union type (e.g., CompressedLabel)
	if itemTypeDef, hasTypeDef := types[itemType].(map[string]interface{}); hasTypeDef {
		typeDefType, _ := itemTypeDef["type"].(string)
		if typeDefType == "discriminated_union" {
			return formatDiscriminatedUnionArrayTyped(arr, itemTypeDef, types, typePrefix, itemType)
		}
	}

	// Handle inline discriminated_union
	if itemType == "discriminated_union" {
		// For inline discriminated_union, we still need to figure out a good type name
		return formatDiscriminatedUnionArray(arr, items, types, typePrefix)
	}

	// For other types, use formatArrayWithSchema
	// Note: For type aliases, the "containing type" is the type alias itself
	return formatArrayWithSchema(arr, typeDef, types, typePrefix, arrayTypeName, "value")
}

// formatDiscriminatedUnionArrayTyped formats an array of discriminated union values with a proper Go type
func formatDiscriminatedUnionArrayTyped(arr []interface{}, unionDef map[string]interface{}, types map[string]interface{}, typePrefix string, unionTypeName string) string {
	goTypeName := typePrefix + "_" + capitalizeFirst(unionTypeName)

	if len(arr) == 0 {
		return fmt.Sprintf("[]%s{}", goTypeName)
	}

	result := fmt.Sprintf("[]%s{\n", goTypeName)
	for _, elem := range arr {
		if elemMap, ok := elem.(map[string]interface{}); ok {
			result += "\t\t\t\t\t" + formatDiscriminatedUnionValue(elemMap, unionDef, types, typePrefix) + ",\n"
		} else {
			result += fmt.Sprintf("\t\t\t\t\t%v,\n", formatValue(elem))
		}
	}
	result += "\t\t\t\t}"
	return result
}

// formatDiscriminatedUnionArray formats an array of discriminated union values (legacy, uses interface{})
func formatDiscriminatedUnionArray(arr []interface{}, unionDef map[string]interface{}, types map[string]interface{}, typePrefix string) string {
	// For inline discriminated unions without a type name, use interface{}
	if len(arr) == 0 {
		return "nil"
	}

	result := "[]interface{}{\n"
	for _, elem := range arr {
		if elemMap, ok := elem.(map[string]interface{}); ok {
			result += "\t\t\t\t\t" + formatDiscriminatedUnionValue(elemMap, unionDef, types, typePrefix) + ",\n"
		} else {
			result += fmt.Sprintf("\t\t\t\t\t%v,\n", formatValue(elem))
		}
	}
	result += "\t\t\t\t}"
	return result
}

// formatBitfieldValue formats a bitfield struct value
// parentTypeName is the name of the struct containing the bitfield field
// fieldName is the name of the bitfield field (used to derive the struct type name)
func formatBitfieldValue(val map[string]interface{}, typePrefix string, parentTypeName string, fieldName string) string {
	// The Go generator names bitfield structs as ParentType_FieldName
	goTypeName := typePrefix + "_" + parentTypeName + "_" + capitalizeFirst(fieldName)
	result := goTypeName + "{"
	var fields []string
	for key, v := range val {
		goFieldName := capitalizeFirst(key)
		fields = append(fields, fmt.Sprintf("%s: %s", goFieldName, formatValueWithType(v, "uint64")))
	}
	// Sort for deterministic output
	sort.Strings(fields)
	result += strings.Join(fields, ", ")
	result += "}"
	return result
}

// formatDiscriminatedUnionValue formats a discriminated union value
// The value has format: {type: "VariantName", value: {...}}
func formatDiscriminatedUnionValue(val map[string]interface{}, unionDef map[string]interface{}, types map[string]interface{}, typePrefix string) string {
	variantType, _ := val["type"].(string)
	variantValue := val["value"]

	if variantType == "" {
		return formatValue(val)
	}

	// Look up the variant type definition
	variantTypeDef, _ := types[variantType].(map[string]interface{})
	goTypeName := typePrefix + "_" + capitalizeFirst(variantType)

	// If variant value is a map (struct), format it as struct literal
	if valMap, ok := variantValue.(map[string]interface{}); ok && variantTypeDef != nil {
		return "&" + formatStructValue(valMap, variantTypeDef, types, typePrefix, variantType)
	}

	// If variant value is a simple type (like string for Label)
	if variantTypeDef != nil {
		if typeDefType, _ := variantTypeDef["type"].(string); typeDefType == "string" {
			if strVal, ok := variantValue.(string); ok {
				return fmt.Sprintf("&%s{Value: %q}", goTypeName, strVal)
			}
		}
	}

	// Fallback
	return fmt.Sprintf("&%s{}", goTypeName)
}

// formatChoiceArray formats an array of choice type items
// schemaTypeName is the containing type name (e.g., "EncryptedData")
// fieldName is the array field name (e.g., "fields")
func formatChoiceArray(arr []interface{}, items map[string]interface{}, types map[string]interface{}, typePrefix string, schemaTypeName string, fieldName string) string {
	// Build the unique interface name: ${typePrefix}_${schemaTypeName}_${FieldName}_Choice
	goFieldName := capitalizeFirst(fieldName)
	choiceInterfaceName := fmt.Sprintf("%s_%s_%s_Choice", typePrefix, schemaTypeName, goFieldName)

	if len(arr) == 0 {
		return fmt.Sprintf("[]%s{}", choiceInterfaceName)
	}

	result := fmt.Sprintf("[]%s{\n", choiceInterfaceName)
	for _, elem := range arr {
		if elemMap, ok := elem.(map[string]interface{}); ok {
			// Get the "type" field from element to determine which variant
			variantType, _ := elemMap["type"].(string)
			if variantType != "" {
				if typeDef, ok := types[variantType].(map[string]interface{}); ok {
					// Use the variant type name directly (preserve underscores)
					goTypeName := typePrefix + "_" + variantType
					// Format as pointer to satisfy interface
					result += "\t\t\t\t\t&" + goTypeName + "{\n"
					if sequence, ok := typeDef["sequence"].([]interface{}); ok {
						for _, fieldRaw := range sequence {
							if field, ok := fieldRaw.(map[string]interface{}); ok {
								fieldName, _ := field["name"].(string)
								if fieldVal, hasVal := elemMap[fieldName]; hasVal {
									goFieldName := capitalizeFirst(fieldName)
									fieldType, _ := field["type"].(string)

									// Handle array fields with schema context
									if fieldType == "array" {
										if arrVal, ok := fieldVal.([]interface{}); ok {
											result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatArrayWithSchema(arrVal, field, types, typePrefix, variantType, fieldName))
											continue
										}
									}

									// Handle inline bitfield fields
									if fieldType == "bitfield" {
										if bitfieldVal, ok := fieldVal.(map[string]interface{}); ok {
											result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatBitfieldValue(bitfieldVal, typePrefix, capitalizeFirst(variantType), fieldName))
											continue
										}
									}

									// Handle inline discriminated_union fields
									if fieldType == "discriminated_union" {
										if unionVal, ok := fieldVal.(map[string]interface{}); ok {
											result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatDiscriminatedUnionValue(unionVal, field, types, typePrefix))
											continue
										}
									}

									// Handle type references (field type is a name in types map)
									if referencedTypeDef, hasTypeDef := types[fieldType].(map[string]interface{}); hasTypeDef {
										refTypeType, _ := referencedTypeDef["type"].(string)

										// Type reference to string type - wrap string value in struct
										if refTypeType == "string" {
											if strVal, ok := fieldVal.(string); ok {
												refGoTypeName := typePrefix + "_" + capitalizeFirst(fieldType)
												result += fmt.Sprintf("\t\t\t\t\t\t%s: %s{Value: %q},\n", goFieldName, refGoTypeName, strVal)
												continue
											}
										}

										// Type reference to array type (e.g., CompressedDomain)
										if refTypeType == "array" {
											if arrVal, ok := fieldVal.([]interface{}); ok {
												refGoTypeName := typePrefix + "_" + capitalizeFirst(fieldType)
												arrayVal := formatArrayTypeAliasValue(arrVal, referencedTypeDef, types, typePrefix, fieldType)
												result += fmt.Sprintf("\t\t\t\t\t\t%s: %s{Value: %s},\n", goFieldName, refGoTypeName, arrayVal)
												continue
											}
										}

										// Type reference to discriminated_union type
										if refTypeType == "discriminated_union" {
											if unionVal, ok := fieldVal.(map[string]interface{}); ok {
												result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatDiscriminatedUnionValue(unionVal, referencedTypeDef, types, typePrefix))
												continue
											}
										}

										// Type alias to another user-defined type (e.g., Realm -> KerberosString)
										// Go generator wraps these in a struct with a Value field
										if aliasedTypeDef, hasAliasedType := types[refTypeType].(map[string]interface{}); hasAliasedType {
											refGoTypeName := typePrefix + "_" + fieldType
											if nestedMap, ok := fieldVal.(map[string]interface{}); ok {
												innerValue := formatStructValue(nestedMap, aliasedTypeDef, types, typePrefix, refTypeType)
												result += fmt.Sprintf("\t\t\t\t\t\t%s: %s{Value: %s},\n", goFieldName, refGoTypeName, innerValue)
												continue
											}
										}

										// Type reference to struct type (has sequence)
										if nestedMap, ok := fieldVal.(map[string]interface{}); ok {
											result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatStructValue(nestedMap, referencedTypeDef, types, typePrefix, fieldType))
											continue
										}
									}

									result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatValueWithType(fieldVal, fieldType))
								}
							}
						}
					}
					result += "\t\t\t\t\t},\n"
					continue
				}
			}
			// Fallback
			result += fmt.Sprintf("\t\t\t\t\t%v,\n", formatValue(elem))
		}
	}
	result += "\t\t\t\t}"
	return result
}

// formatStructValue formats a struct value with schema context
func formatStructValue(val map[string]interface{}, typeDef map[string]interface{}, types map[string]interface{}, typePrefix string, typeName string) string {
	// Use the type name directly (preserve underscores) since generated code preserves them
	goTypeName := typePrefix + "_" + typeName
	result := goTypeName + "{\n"

	if sequence, ok := typeDef["sequence"].([]interface{}); ok {
		for _, fieldRaw := range sequence {
			if field, ok := fieldRaw.(map[string]interface{}); ok {
				fieldName, _ := field["name"].(string)
				if fieldVal, hasVal := val[fieldName]; hasVal {
					goFieldName := capitalizeFirst(fieldName)
					fieldType, _ := field["type"].(string)

					// Check for inline array field
					if fieldType == "array" {
						if arrVal, ok := fieldVal.([]interface{}); ok {
							result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatArrayWithSchema(arrVal, field, types, typePrefix, typeName, fieldName))
							continue
						}
					}

					// Check for inline bitfield field
					if fieldType == "bitfield" {
						if bitfieldVal, ok := fieldVal.(map[string]interface{}); ok {
							result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatBitfieldValue(bitfieldVal, typePrefix, capitalizeFirst(typeName), fieldName))
							continue
						}
					}

					// Check for inline discriminated_union field
					if fieldType == "discriminated_union" {
						if unionVal, ok := fieldVal.(map[string]interface{}); ok {
							result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatDiscriminatedUnionValue(unionVal, field, types, typePrefix))
							continue
						}
					}

					// Check for optional field - wrap value in pointer helper
					if fieldType == "optional" {
						formattedVal := formatValueWithSchema(fieldVal, field, types, typePrefix, typeName, fieldName)
						result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formattedVal)
						continue
					}

					// Check for type references (field type is a name in types map)
					if referencedTypeDef, hasTypeDef := types[fieldType].(map[string]interface{}); hasTypeDef {
						refTypeType, _ := referencedTypeDef["type"].(string)

						// Type reference to string type - wrap string value in struct
						if refTypeType == "string" {
							if strVal, ok := fieldVal.(string); ok {
								goTypeName := typePrefix + "_" + capitalizeFirst(fieldType)
								result += fmt.Sprintf("\t\t\t\t\t\t%s: %s{Value: %q},\n", goFieldName, goTypeName, strVal)
								continue
							}
						}

						// Type reference to array type (e.g., CompressedDomain)
						// Go generator wraps array type aliases in a struct with a Value field
						if refTypeType == "array" {
							if arrVal, ok := fieldVal.([]interface{}); ok {
								goTypeName := typePrefix + "_" + capitalizeFirst(fieldType)
								arrayVal := formatArrayTypeAliasValue(arrVal, referencedTypeDef, types, typePrefix, fieldType)
								result += fmt.Sprintf("\t\t\t\t\t\t%s: %s{Value: %s},\n", goFieldName, goTypeName, arrayVal)
								continue
							}
						}

						// Type reference to discriminated_union type
						if refTypeType == "discriminated_union" {
							if unionVal, ok := fieldVal.(map[string]interface{}); ok {
								result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatDiscriminatedUnionValue(unionVal, referencedTypeDef, types, typePrefix))
								continue
							}
						}

						// Type alias to another user-defined type (e.g., Realm -> KerberosString)
						// Go generator wraps these in a struct with a Value field
						if aliasedTypeDef, hasAliasedType := types[refTypeType].(map[string]interface{}); hasAliasedType {
							goTypeName := typePrefix + "_" + fieldType
							if nestedMap, ok := fieldVal.(map[string]interface{}); ok {
								innerValue := formatStructValue(nestedMap, aliasedTypeDef, types, typePrefix, refTypeType)
								result += fmt.Sprintf("\t\t\t\t\t\t%s: %s{Value: %s},\n", goFieldName, goTypeName, innerValue)
								continue
							}
						}

						// Type reference to struct type (has sequence)
						if nestedMap, ok := fieldVal.(map[string]interface{}); ok {
							result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatStructValue(nestedMap, referencedTypeDef, types, typePrefix, fieldType))
							continue
						}
					}

					result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formatValueWithType(fieldVal, fieldType))
				}
			}
		}
	}

	// Handle instance fields (position-based fields)
	if instances, ok := typeDef["instances"].([]interface{}); ok {
		for _, instanceRaw := range instances {
			if instance, ok := instanceRaw.(map[string]interface{}); ok {
				instanceName, _ := instance["name"].(string)
				if instanceVal, hasVal := val[instanceName]; hasVal {
					goFieldName := capitalizeFirst(instanceName)
					formattedVal := formatInstanceFieldValue(instanceVal, instance, types, typePrefix)
					result += fmt.Sprintf("\t\t\t\t\t\t%s: %s,\n", goFieldName, formattedVal)
				}
			}
		}
	}

	result += "\t\t\t\t\t}"
	return result
}

func generateValueConstructionSimple(typeName string, value interface{}, varName string) string {
	valueMap, ok := value.(map[string]interface{})
	if !ok {
		return fmt.Sprintf("\t\t\t%s := %s{}\n", varName, typeName)
	}

	result := fmt.Sprintf("\t\t\t%s := %s{\n", varName, typeName)
	for key, val := range valueMap {
		fieldName := capitalizeFirst(key)
		result += fmt.Sprintf("\t\t\t\t%s: %s,\n", fieldName, formatValue(val))
	}
	result += "\t\t\t}\n"

	return result
}

// generateGoSource generates Go code from a schema by calling the CLI
func generateGoSource(schema map[string]interface{}, typeName string) (string, error) {
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

	toolsRoot, err := filepath.Abs(filepath.Join(".", "..", ".."))
	if err != nil {
		return "", fmt.Errorf("failed to resolve tools root: %w", err)
	}

	cmd := exec.Command(
		"bun", "run", "packages/binschema/src/cli/index.ts", "generate",
		"--language", "go",
		"--schema", schemaFile,
		"--out", outputDir,
		"--type", typeName,
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

	return string(codeBytes), nil
}

// formatValueWithType formats a value for Go code generation with explicit type information
func formatValueWithType(val interface{}, fieldType string) string {
	// Handle nil - only convert to Infinity for float types
	if val == nil {
		if fieldType == "float32" || fieldType == "float64" {
			if fieldType == "float32" {
				return "float32(math.Inf(1))"
			}
			return "math.Inf(1)"
		}
		// For non-float types, nil means optional field not present
		return "nil"
	}

	switch v := val.(type) {
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case uint:
		return fmt.Sprintf("%d", v)
	case uint64:
		return fmt.Sprintf("%d", v)
	case float64:
		// Check for special values - cast based on field type
		if math.IsInf(v, 1) {
			if fieldType == "float32" {
				return "float32(math.Inf(1))"
			}
			return "math.Inf(1)"
		}
		if math.IsInf(v, -1) {
			if fieldType == "float32" {
				return "float32(math.Inf(-1))"
			}
			return "math.Inf(-1)"
		}
		if math.IsNaN(v) {
			if fieldType == "float32" {
				return "float32(math.NaN())"
			}
			return "math.NaN()"
		}
		// Check if it's actually an integer
		if v == float64(int64(v)) {
			return fmt.Sprintf("%d", int64(v))
		}
		// For float values, use %.17g to maintain full precision
		str := fmt.Sprintf("%.17g", v)
		// Remove + from scientific notation (1e+38 -> 1e38)
		str = strings.Replace(str, "e+", "e", 1)
		return str
	case float32:
		return fmt.Sprintf("%f", v)
	case string:
		return fmt.Sprintf("%q", v)
	case bool:
		return fmt.Sprintf("%t", v)
	case []interface{}:
		// Handle slices - empty slices should be nil in Go
		if len(v) == 0 {
			return "nil"
		}
		// Format non-empty slices with proper Go syntax
		var elements []string
		for _, elem := range v {
			elements = append(elements, formatValueWithType(elem, ""))
		}
		// Determine element type from first element for better type inference
		elemType := "interface{}"
		if len(v) > 0 {
			switch v[0].(type) {
			case int, int64, float64:
				// Check if all elements are integers that fit in common types
				allInts := true
				for _, e := range v {
					if f, ok := e.(float64); ok {
						if f != float64(int64(f)) {
							allInts = false
							break
						}
					}
				}
				if allInts {
					elemType = "int"
				}
			case string:
				elemType = "string"
			case bool:
				elemType = "bool"
			}
		}
		if elemType == "interface{}" {
			return fmt.Sprintf("[]interface{}{%s}", strings.Join(elements, ", "))
		}
		return fmt.Sprintf("[]%s{%s}", elemType, strings.Join(elements, ", "))
	case map[string]interface{}:
		// Handle maps/objects - format as struct literal if fieldType is provided
		if fieldType != "" && !isPrimitiveType(fieldType) && fieldType != "array" && fieldType != "string" {
			// It's a struct type - generate proper struct literal
			goTypeName := toGoFieldName(fieldType)
			var fields []string
			for key, val := range v {
				goFieldName := toGoFieldName(key)
				fields = append(fields, fmt.Sprintf("%s: %s", goFieldName, formatValueWithType(val, "")))
			}
			// Sort fields for deterministic output
			sort.Strings(fields)
			return fmt.Sprintf("%s{%s}", goTypeName, strings.Join(fields, ", "))
		}
		// Fallback - should not happen often
		return fmt.Sprintf("%v", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func formatValue(val interface{}) string {
	// Fallback for when type information is not available
	return formatValueWithType(val, "")
}

func formatByteSlice(bytes []byte) string {
	if len(bytes) == 0 {
		return ""
	}
	result := ""
	for i, b := range bytes {
		if i > 0 {
			result += ", "
		}
		result += fmt.Sprintf("%d", b)
	}
	return result
}

// toGoFieldName converts snake_case or camelCase to PascalCase (Go exported field name)
func toGoFieldName(s string) string {
	if s == "" {
		return ""
	}
	// Split on underscores and hyphens
	parts := strings.FieldsFunc(s, func(r rune) bool {
		return r == '_' || r == '-'
	})
	result := ""
	for _, part := range parts {
		if part == "" {
			continue
		}
		// Capitalize first letter of each part
		if part[0] >= 'a' && part[0] <= 'z' {
			result += string(part[0]-32) + part[1:]
		} else {
			result += part
		}
	}
	return result
}

// capitalizeFirst is an alias for toGoFieldName
func capitalizeFirst(s string) string {
	return toGoFieldName(s)
}

// isPrimitiveType checks if a type is a BinSchema primitive type
func isPrimitiveType(t string) bool {
	switch t {
	case "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "float32", "float64", "bit", "int":
		return true
	}
	return false
}

// mapPrimitiveType maps BinSchema primitive types to Go types
func mapPrimitiveType(binschemaType string) string {
	switch binschemaType {
	case "uint8":
		return "uint8"
	case "uint16":
		return "uint16"
	case "uint32":
		return "uint32"
	case "uint64":
		return "uint64"
	case "int8":
		return "int8"
	case "int16":
		return "int16"
	case "int32":
		return "int32"
	case "int64":
		return "int64"
	case "float32":
		return "float32"
	case "float64":
		return "float64"
	case "string":
		return "string"
	default:
		return "interface{}"
	}
}
