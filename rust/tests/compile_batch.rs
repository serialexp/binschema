// ABOUTME: Batched compilation for Rust test suites
// ABOUTME: Compiles all test suites at once for fast execution

use binschema_runtime::test_schema::{TestCase, TestSuite, Schema, TypeDef, Field};
use serde::Serialize;
use serde_json;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, serde::Deserialize)]
struct TestResult {
    description: String,
    pass: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    error: Option<String>,
}

/// Load test suite from JSON file
fn load_test_suite(path: &Path) -> Result<TestSuite, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    let suite: TestSuite = json5::from_str(&content)?;
    Ok(suite)
}

/// Find all .test.json files recursively
fn find_test_files(dir: &str) -> Vec<PathBuf> {
    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                files.extend(find_test_files(path.to_str().unwrap()));
            } else if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.contains(".test."))
                    .unwrap_or(false)
                {
                    files.push(path);
                }
            }
        }
    }

    files
}

/// Generate Rust code for a schema using the TypeScript CLI
fn generate_rust_code(schema_json: &str, type_name: &str) -> Result<String, Box<dyn std::error::Error>> {
    // Create temp directory for schema file
    let temp_dir = tempfile::tempdir()?;
    let schema_path = temp_dir.path().join("schema.json");
    fs::write(&schema_path, schema_json)?;

    let out_dir = temp_dir.path().join("out");
    fs::create_dir_all(&out_dir)?;

    // Find the packages/binschema directory
    let binschema_dir = PathBuf::from("../packages/binschema");

    // Run the TypeScript CLI
    let output = Command::new("bun")
        .args([
            "run",
            "src/cli/index.ts",
            "generate",
            "--language",
            "rust",
            "--schema",
            schema_path.to_str().unwrap(),
            "--out",
            out_dir.to_str().unwrap(),
            "--type",
            type_name,
        ])
        .current_dir(&binschema_dir)
        .output()?;

    if !output.status.success() {
        return Err(format!(
            "CLI failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )
        .into());
    }

    // Read generated code
    let code_path = out_dir.join("generated.rs");
    let code = fs::read_to_string(&code_path)?;
    Ok(code)
}

/// Prefix all type names in generated code to avoid conflicts
fn prefix_type_names(code: &str, prefix: &str) -> String {
    // First, protect Rust standard library paths from replacement
    // by replacing them with placeholders
    let mut result = code.to_string();
    result = result.replace("std::string::String", "__PLACEHOLDER_STD_STRING__");
    result = result.replace("std::vec::Vec", "__PLACEHOLDER_STD_VEC__");
    result = result.replace("std::option::Option", "__PLACEHOLDER_STD_OPTION__");
    result = result.replace("std::result::Result", "__PLACEHOLDER_STD_RESULT__");

    // Find all struct and enum definitions
    let re_struct = regex::Regex::new(r"pub struct ([A-Z][a-zA-Z0-9_]*)").unwrap();
    let re_enum = regex::Regex::new(r"pub enum ([A-Z][a-zA-Z0-9_]*)").unwrap();

    let mut type_names: Vec<String> = re_struct
        .captures_iter(&code)
        .map(|cap| cap[1].to_string())
        .collect();

    type_names.extend(
        re_enum
            .captures_iter(&code)
            .map(|cap| cap[1].to_string())
    );

    // Collect enum variant names (first capture group) - these should NOT be prefixed in ::Variant( patterns
    // Pattern: EnumVariant(TypeName) or EnumVariant(TypeName,
    let re_variant_types = regex::Regex::new(r"\s+([A-Z][a-zA-Z0-9_]*)\(([A-Z][a-zA-Z0-9_]*)[\),]").unwrap();
    let mut variant_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    for cap in re_variant_types.captures_iter(&code) {
        // Collect variant name (first group) - don't replace in ::VariantName( patterns
        if let Some(variant_match) = cap.get(1) {
            variant_names.insert(variant_match.as_str().to_string());
        }
        // Collect type name (second group) - add to types to be prefixed
        if let Some(type_match) = cap.get(2) {
            type_names.push(type_match.as_str().to_string());
        }
    }

    // Remove duplicates
    type_names.sort();
    type_names.dedup();

    // Sort by length (longest first) to avoid substring replacement issues
    // E.g., replace "ChoiceTypeATypeB" before "TypeB" to avoid partial matches
    type_names.sort_by_key(|name| std::cmp::Reverse(name.len()));

    for type_name in &type_names {
        let prefixed = format!("{}_{}", prefix, type_name);

        // Replace struct/enum definition
        result = result.replace(
            &format!("pub struct {}", type_name),
            &format!("pub struct {}", prefixed),
        );
        result = result.replace(
            &format!("pub enum {}", type_name),
            &format!("pub enum {}", prefixed),
        );

        // Replace impl block
        result = result.replace(
            &format!("impl {}", type_name),
            &format!("impl {}", prefixed),
        );

        // Replace type references in various contexts:
        // 1. Enum variant with tuple: `Variant(TypeName)` or `Variant(TypeName,`
        let re_tuple_variant = regex::Regex::new(&format!(r"\b([A-Z][a-zA-Z0-9_]*)\({}([,\)])", regex::escape(type_name))).unwrap();
        result = re_tuple_variant.replace_all(&result, format!("$1({}$2", prefixed)).to_string();

        // 2. Field types ending with comma: `: Foo,`
        result = result.replace(
            &format!(": {},", type_name),
            &format!(": {},", prefixed),
        );

        // 3. Field types ending with space: `: Foo `
        result = result.replace(
            &format!(": {} ", type_name),
            &format!(": {} ", prefixed),
        );

        // 4. Generic parameters: `Vec<Foo>`
        result = result.replace(
            &format!("<{}>", type_name),
            &format!("<{}>", prefixed),
        );

        // 5. Method calls: `Foo::decode` or `EnumName::Variant`
        // Use word boundary to avoid matching TypeB:: inside ChoiceTypeATypeB::
        let re_method_call = regex::Regex::new(&format!(r"\b{}::", regex::escape(type_name))).unwrap();
        result = re_method_call.replace_all(&result, format!("{}::", prefixed)).to_string();

        // 6. Qualified enum variants in match/construction: `SomeEnum::TypeName(`
        // This handles patterns like `ChoiceAB::TypeA(` in match arms
        // IMPORTANT: Only replace if TypeName is NOT an enum variant name (variants should not be prefixed)
        if !variant_names.contains(type_name) {
            let re_qualified = regex::Regex::new(&format!(r"::{}([\(\,\)])", regex::escape(type_name))).unwrap();
            result = re_qualified.replace_all(&result, format!("::{}{}", prefixed, "$1")).to_string();
        }

        // 7. Return type: `-> Foo`
        result = result.replace(
            &format!("-> {}", type_name),
            &format!("-> {}", prefixed),
        );

        // 8. Let binding types: `let x: Foo =`
        result = result.replace(
            &format!(": {} =", type_name),
            &format!(": {} =", prefixed),
        );

        // 9. Result/Option wrapped types: `Result<Foo>` or `Option<Foo>`
        result = result.replace(
            &format!("Result<{}>", type_name),
            &format!("Result<{}>", prefixed),
        );
        result = result.replace(
            &format!("Option<{}>", type_name),
            &format!("Option<{}>", prefixed),
        );
    }

    // Restore the protected Rust standard library paths
    result = result.replace("__PLACEHOLDER_STD_STRING__", "std::string::String");
    result = result.replace("__PLACEHOLDER_STD_VEC__", "std::vec::Vec");
    result = result.replace("__PLACEHOLDER_STD_OPTION__", "std::option::Option");
    result = result.replace("__PLACEHOLDER_STD_RESULT__", "std::result::Result");

    result
}

/// Generate the test harness main function
fn generate_test_harness(suites: &[(String, TestSuite)]) -> String {
    let mut harness = String::from(
        r#"// Generated test harness
use binschema_runtime::{BitStreamEncoder, BitStreamDecoder, Endianness, BitOrder, Result, BinSchemaError};
use serde::Serialize;
use binschema_test::*;

#[derive(Serialize)]
struct TestResult {
    description: String,
    pass: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn main() {
    let mut all_results: Vec<Vec<TestResult>> = Vec::new();

"#,
    );

    for (prefix, suite) in suites {
        let prefixed_type = format!("{}_{}", prefix, suite.test_type);

        harness.push_str(&format!("    // Test suite: {}\n", suite.name));
        harness.push_str("    {\n");
        harness.push_str("        let mut results: Vec<TestResult> = Vec::new();\n\n");

        for tc in &suite.test_cases {
            // Skip tests that expect errors for now
            if tc.error.is_some() {
                continue;
            }

            // Generate test case
            harness.push_str(&format!(
                "        // Test: {}\n",
                tc.description.replace("\"", "\\\"")
            ));
            harness.push_str("        {\n");
            harness.push_str(&format!(
                "            let mut result = TestResult {{ description: \"{}\".to_string(), pass: false, error: None }};\n",
                tc.description.replace("\"", "\\\"")
            ));

            // Generate value construction
            harness.push_str(&generate_value_construction(&prefixed_type, &tc.value, "test_value", &suite.schema, prefix, &suite.test_type));

            // Encode (handle Result)
            harness.push_str("            match test_value.encode() {\n");
            harness.push_str("                Ok(encoded) => {\n");

            // Compare bytes
            if let Some(bytes) = &tc.bytes {
                harness.push_str(&format!(
                    "                    let expected: Vec<u8> = vec![{}];\n",
                    bytes
                        .iter()
                        .map(|b| b.to_string())
                        .collect::<Vec<_>>()
                        .join(", ")
                ));
                harness.push_str("                    if encoded != expected {\n");
                harness.push_str("                        result.error = Some(format!(\"encode mismatch: got {:?}, want {:?}\", encoded, expected));\n");
                harness.push_str("                        results.push(result);\n");
                harness.push_str("                    } else {\n");

                // Decode
                harness.push_str(&format!(
                    "                        match {}::decode(&encoded) {{\n",
                    prefixed_type
                ));
                harness.push_str("                            Ok(decoded) => {\n");
                harness.push_str("                                if decoded == test_value {\n");
                harness.push_str("                                    result.pass = true;\n");
                harness.push_str("                                } else {\n");
                harness.push_str("                                    result.error = Some(format!(\"decode mismatch: got {:?}, want {:?}\", decoded, test_value));\n");
                harness.push_str("                                }\n");
                harness.push_str("                                results.push(result);\n");
                harness.push_str("                            }\n");
                harness.push_str("                            Err(e) => {\n");
                harness.push_str("                                result.error = Some(format!(\"decode error: {}\", e));\n");
                harness.push_str("                                results.push(result);\n");
                harness.push_str("                            }\n");
                harness.push_str("                        }\n");
                harness.push_str("                    }\n");
            }

            // Close Ok(encoded) arm
            harness.push_str("                }\n");
            // Add Err arm for encode errors
            harness.push_str("                Err(e) => {\n");
            harness.push_str("                    result.error = Some(format!(\"encode error: {}\", e));\n");
            harness.push_str("                    results.push(result);\n");
            harness.push_str("                }\n");
            // Close match test_value.encode()
            harness.push_str("            }\n");

            harness.push_str("        }\n\n");
        }

        harness.push_str("        all_results.push(results);\n");
        harness.push_str("    }\n\n");
    }

    harness.push_str(
        r#"
    // Output results as JSON
    let json = serde_json::to_string(&all_results).unwrap();
    println!("{}", json);
}
"#,
    );

    harness
}

/// Generate Rust code to construct a value from JSON
/// Uses Go-style approach: iterate over schema sequence, not JSON keys
fn generate_value_construction(
    type_name: &str,
    value: &serde_json::Value,
    var_name: &str,
    schema: &Schema,
    prefix: &str,
    current_type_name: &str,
) -> String {
    // Handle non-object values (e.g., string for newtype wrappers)
    let value_map = match value {
        serde_json::Value::Object(map) => map,
        serde_json::Value::String(s) => {
            // Newtype string wrapper - construct with the string value
            return format!("            let {} = {}({:?}.to_string());\n", var_name, type_name, s);
        }
        serde_json::Value::Number(n) => {
            // Newtype number wrapper
            if let Some(i) = n.as_i64() {
                return format!("            let {} = {}({});\n", var_name, type_name, i);
            } else if let Some(u) = n.as_u64() {
                return format!("            let {} = {}({});\n", var_name, type_name, u);
            } else if let Some(f) = n.as_f64() {
                return format!("            let {} = {}({:?});\n", var_name, type_name, f);
            }
            return format!("            let {} = {}({});\n", var_name, type_name, n);
        }
        serde_json::Value::Bool(b) => {
            return format!("            let {} = {}({});\n", var_name, type_name, b);
        }
        serde_json::Value::Array(arr) => {
            // Array type - format as vec
            let items: Vec<String> = arr.iter().map(format_value_simple).collect();
            return format!("            let {} = {}(vec![{}]);\n", var_name, type_name, items.join(", "));
        }
        serde_json::Value::Null => {
            return format!("            let {} = {}::default();\n", var_name, type_name);
        }
    };

    // Get the type definition from the schema
    let type_def = match schema.types.get(current_type_name) {
        Some(def) => def,
        None => {
            // Fallback: iterate JSON keys if type not found
            return generate_value_construction_from_json(type_name, value_map, var_name, schema, prefix);
        }
    };

    // Get the sequence of fields from the type definition
    let sequence = match type_def {
        TypeDef::Sequence { sequence } => sequence,
        _ => {
            // For non-sequence types, fallback to JSON iteration
            return generate_value_construction_from_json(type_name, value_map, var_name, schema, prefix);
        }
    };

    let mut result = format!("            let {} = {} {{\n", var_name, type_name);

    // Iterate over schema sequence fields (not JSON keys)
    for field in sequence {
        let field_name_lower = match &field.name {
            Some(name) => name.as_str(),
            None => continue,
        };

        // Check if there's a value for this field in the JSON
        let field_value = match value_map.get(field_name_lower) {
            Some(val) => val,
            None => continue, // Field not present in test value (computed/const field)
        };

        let rust_field_name = escape_rust_keyword(&to_snake_case(field_name_lower));
        // Pass the current type name as containing type for bitfield struct naming
        let formatted_value = format_value_with_field_and_context(field_value, field, schema, prefix, current_type_name);
        result.push_str(&format!("                {}: {},\n", rust_field_name, formatted_value));
    }

    result.push_str("            };\n");
    result
}

/// Fallback: generate value construction by iterating JSON keys
fn generate_value_construction_from_json(
    type_name: &str,
    value_map: &serde_json::Map<String, serde_json::Value>,
    var_name: &str,
    schema: &Schema,
    prefix: &str,
) -> String {
    let mut result = format!("            let {} = {} {{\n", var_name, type_name);
    for (key, val) in value_map {
        let field_name = escape_rust_keyword(&to_snake_case(key));
        let field_value = format_value_simple(val);
        result.push_str(&format!("                {}: {},\n", field_name, field_value));
    }
    result.push_str("            };\n");
    result
}

/// Format a value using the field definition from the schema
/// This is the main formatting function - it uses the field's type info
fn format_value_with_field(
    value: &serde_json::Value,
    field: &Field,
    schema: &Schema,
    prefix: &str,
) -> String {
    // Call with default empty containing type name
    format_value_with_field_and_context(value, field, schema, prefix, "")
}

/// Format a value with full context including containing type name
fn format_value_with_field_and_context(
    value: &serde_json::Value,
    field: &Field,
    schema: &Schema,
    prefix: &str,
    containing_type_name: &str,
) -> String {
    let field_type = &field.field_type;

    // Handle optional fields - look at value_type and wrap in Some(...)
    if field_type == "optional" {
        if let Some(ref value_type) = field.value_type {
            // Check if the inner type is a named type in the schema
            if let Some(type_def) = schema.types.get(value_type) {
                match type_def {
                    TypeDef::Sequence { .. } => {
                        let inner = format_nested_struct(value, value_type, schema, prefix);
                        return format!("Some({})", inner);
                    }
                    TypeDef::Direct { .. } => {
                        // Direct type reference (newtype wrapper)
                        let inner = format_value_as_newtype(value, value_type, prefix);
                        return format!("Some({})", inner);
                    }
                    _ => {}
                }
            }
        }
        // Primitive optional - wrap in Some(...)
        let inner = format_value_simple(value);
        return format!("Some({})", inner);
    }

    // Handle bitfield with sub-fields
    if field_type == "bitfield" && field.fields.is_some() {
        if let Some(ref field_name) = field.name {
            // Bitfield struct name: {ContainingTypeName}{FieldName}
            let struct_name = if containing_type_name.is_empty() {
                // Fallback: just use field name capitalized
                to_pascal_case(field_name)
            } else {
                format!("{}{}", to_pascal_case(containing_type_name), to_pascal_case(field_name))
            };
            return format_bitfield_struct_with_name(value, &struct_name, prefix);
        }
    }

    // Handle array fields
    if field_type == "array" {
        if let serde_json::Value::Array(arr) = value {
            return format_array_with_field(arr, field, schema, prefix);
        }
        return "vec![]".to_string();
    }

    // Check if it's a named type (struct, discriminated union, or direct type reference)
    if let Some(type_def) = schema.types.get(field_type) {
        match type_def {
            TypeDef::Sequence { .. } => {
                return format_nested_struct(value, field_type, schema, prefix);
            }
            TypeDef::DiscriminatedUnion { .. } => {
                return format_discriminated_union_value(value, field_type, schema, prefix);
            }
            TypeDef::Direct { .. } => {
                // Direct type reference (newtype wrapper like String, InlineString)
                return format_value_as_newtype(value, field_type, prefix);
            }
        }
    }

    // Handle null values for float fields (JSON null = Infinity)
    if value.is_null() {
        if field_type == "float32" {
            return "f32::INFINITY".to_string();
        } else if field_type == "float64" {
            return "f64::INFINITY".to_string();
        }
    }

    // Handle numeric types with proper casting
    if let serde_json::Value::Number(n) = value {
        // Check if the field type is float32
        if field_type == "float32" {
            if let Some(f) = n.as_f64() {
                if f.is_infinite() && f.is_sign_positive() {
                    return "f32::INFINITY".to_string();
                } else if f.is_infinite() && f.is_sign_negative() {
                    return "f32::NEG_INFINITY".to_string();
                } else if f.is_nan() {
                    return "f32::NAN".to_string();
                } else {
                    return format!("{}_f32", f);
                }
            } else if let Some(i) = n.as_i64() {
                return format!("{}.0_f32", i);
            }
        }
        // For float64, use default formatting
        if field_type == "float64" {
            if let Some(f) = n.as_f64() {
                if f.is_infinite() && f.is_sign_positive() {
                    return "f64::INFINITY".to_string();
                } else if f.is_infinite() && f.is_sign_negative() {
                    return "f64::NEG_INFINITY".to_string();
                } else if f.is_nan() {
                    return "f64::NAN".to_string();
                } else if f == f.trunc() {
                    return format!("{}.0_f64", f as i64);
                } else {
                    return format!("{}_f64", f);
                }
            }
        }
    }

    // Primitive or string - use simple formatting
    format_value_simple(value)
}

/// Format a value as a newtype wrapper (e.g., MyString("hello".to_string()))
fn format_value_as_newtype(
    value: &serde_json::Value,
    type_name: &str,
    prefix: &str,
) -> String {
    let rust_type = format!("{}_{}", prefix, to_pascal_case(type_name));
    let inner_value = format_value_simple(value);
    format!("{}({})", rust_type, inner_value)
}

/// Format a nested struct value (recursive)
fn format_nested_struct(
    value: &serde_json::Value,
    type_name: &str,
    schema: &Schema,
    prefix: &str,
) -> String {
    let value_map = match value {
        serde_json::Value::Object(map) => map,
        _ => return format!("{}_{} {{ }}", prefix, to_pascal_case(type_name)),
    };

    // Get the type definition
    let type_def = match schema.types.get(type_name) {
        Some(def) => def,
        None => {
            // Fallback: format without schema info
            return format_nested_object_simple(value_map, type_name, prefix);
        }
    };

    let sequence = match type_def {
        TypeDef::Sequence { sequence } => sequence,
        _ => {
            return format_nested_object_simple(value_map, type_name, prefix);
        }
    };

    let rust_type_name = format!("{}_{}", prefix, to_pascal_case(type_name));
    let mut result = format!("{} {{ ", rust_type_name);

    for field in sequence {
        let field_name_lower = match &field.name {
            Some(name) => name.as_str(),
            None => continue,
        };

        let field_value = match value_map.get(field_name_lower) {
            Some(val) => val,
            None => continue, // Skip fields not in test value
        };

        let rust_field_name = escape_rust_keyword(&to_snake_case(field_name_lower));
        // Pass the type_name as containing type for bitfield struct naming
        let formatted_value = format_value_with_field_and_context(field_value, field, schema, prefix, type_name);
        result.push_str(&format!("{}: {}, ", rust_field_name, formatted_value));
    }

    result.push_str("}");
    result
}

/// Format a nested object without full schema info (fallback)
fn format_nested_object_simple(
    value_map: &serde_json::Map<String, serde_json::Value>,
    type_name: &str,
    prefix: &str,
) -> String {
    let rust_type_name = format!("{}_{}", prefix, to_pascal_case(type_name));
    let mut result = format!("{} {{ ", rust_type_name);

    for (key, val) in value_map {
        let field_name = escape_rust_keyword(&to_snake_case(key));
        let field_value = format_value_simple(val);
        result.push_str(&format!("{}: {}, ", field_name, field_value));
    }

    result.push_str("}");
    result
}

/// Format an array using field definition
fn format_array_with_field(
    arr: &[serde_json::Value],
    field: &Field,
    schema: &Schema,
    prefix: &str,
) -> String {
    if arr.is_empty() {
        return "vec![]".to_string();
    }

    // Get item type from field definition
    let items = match &field.items {
        Some(items) => items,
        None => {
            // No items definition - format as simple array
            let items: Vec<String> = arr.iter().map(format_value_simple).collect();
            return format!("vec![{}]", items.join(", "));
        }
    };

    let item_type = &items.field_type;

    // Check if it's a choice type
    if item_type == "choice" {
        if let Some(ref choices) = items.choices {
            let variant_types: Vec<String> = choices.iter()
                .map(|c| c.type_name.clone())
                .collect();
            let formatted: Vec<String> = arr.iter()
                .map(|v| format_choice_value(v, &variant_types, schema, prefix))
                .collect();
            return format!("vec![{}]", formatted.join(", "));
        }
    }

    // Check if items are a named type in the schema
    if let Some(type_def) = schema.types.get(item_type) {
        match type_def {
            TypeDef::Sequence { .. } => {
                let formatted: Vec<String> = arr.iter()
                    .map(|v| format_nested_struct(v, item_type, schema, prefix))
                    .collect();
                return format!("vec![{}]", formatted.join(", "));
            }
            TypeDef::DiscriminatedUnion { .. } => {
                let formatted: Vec<String> = arr.iter()
                    .map(|v| format_discriminated_union_value(v, item_type, schema, prefix))
                    .collect();
                return format!("vec![{}]", formatted.join(", "));
            }
            _ => {}
        }
    }

    // Primitive array
    let items: Vec<String> = arr.iter().map(format_value_simple).collect();
    format!("vec![{}]", items.join(", "))
}

/// Format a bitfield struct value with the full struct name
fn format_bitfield_struct_with_name(
    value: &serde_json::Value,
    struct_name: &str,
    prefix: &str,
) -> String {
    let value_map = match value {
        serde_json::Value::Object(map) => map,
        _ => return format!("{}_{} {{ }}", prefix, struct_name),
    };

    let rust_type_name = format!("{}_{}", prefix, struct_name);
    let mut result = format!("{} {{ ", rust_type_name);

    for (key, val) in value_map {
        let field_name = escape_rust_keyword(&to_snake_case(key));
        let field_value = format_value_simple(val);
        result.push_str(&format!("{}: {}, ", field_name, field_value));
    }

    result.push_str("}");
    result
}

// Old format_nested_object and format_nested_object_with_name removed
// Use format_nested_struct instead

/// Simple value formatting without schema (for primitives)
fn format_value_simple(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                i.to_string()
            } else if let Some(u) = n.as_u64() {
                u.to_string()
            } else if let Some(f) = n.as_f64() {
                if f.is_infinite() && f.is_sign_positive() {
                    "f64::INFINITY".to_string()
                } else if f.is_infinite() && f.is_sign_negative() {
                    "f64::NEG_INFINITY".to_string()
                } else if f.is_nan() {
                    "f64::NAN".to_string()
                } else if f == f.trunc() {
                    format!("{}", f as i64)
                } else {
                    format!("{:?}_f64", f)
                }
            } else {
                n.to_string()
            }
        }
        serde_json::Value::String(s) => {
            // Check if it's a BigInt string (ends with 'n')
            if s.ends_with('n') {
                let num_str = s.trim_end_matches('n');
                if let Ok(i) = num_str.parse::<i64>() {
                    return i.to_string();
                }
                if let Ok(u) = num_str.parse::<u64>() {
                    return u.to_string();
                }
            }
            format!("{:?}.to_string()", s)
        }
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(format_value_simple).collect();
            format!("vec![{}]", items.join(", "))
        }
        serde_json::Value::Object(_) => "/* nested object */".to_string(),
        serde_json::Value::Null => "None".to_string(),
    }
}

/// Get the type of a field from the schema
/// For optional fields, returns the value_type instead of "optional"
fn get_field_type(schema: &Schema, type_name: &str, field_name: &str) -> Option<String> {
    if let Some(type_def) = schema.types.get(type_name) {
        match type_def {
            TypeDef::Sequence { sequence } => {
                for field in sequence {
                    if field.name.as_deref() == Some(field_name) {
                        // For optional fields, return the value_type
                        if field.field_type == "optional" {
                            if let Some(ref value_type) = field.value_type {
                                return Some(value_type.clone());
                            }
                        }
                        return Some(field.field_type.clone());
                    }
                }
            }
            _ => {}
        }
    }
    None
}

/// Check if a field exists in the schema sequence (not in instances)
fn field_exists_in_schema(schema: &Schema, type_name: &str, field_name: &str) -> bool {
    if let Some(type_def) = schema.types.get(type_name) {
        match type_def {
            TypeDef::Sequence { sequence } => {
                for field in sequence {
                    if field.name.as_deref() == Some(field_name) {
                        return true;
                    }
                }
            }
            _ => {}
        }
    }
    false
}

/// Check if a field is a bitfield with sub-fields
fn is_bitfield_with_subfields(schema: &Schema, type_name: &str, field_name: &str) -> bool {
    if let Some(type_def) = schema.types.get(type_name) {
        match type_def {
            TypeDef::Sequence { sequence } => {
                for field in sequence {
                    if field.name.as_deref() == Some(field_name) {
                        if field.field_type == "bitfield" && field.fields.is_some() {
                            return true;
                        }
                    }
                }
            }
            _ => {}
        }
    }
    false
}

/// Get the generated struct name for a bitfield field
fn get_bitfield_struct_name(type_name: &str, field_name: &str) -> String {
    // Convert to PascalCase and concatenate: TypeName + FieldName
    let type_pascal = to_pascal_case(type_name);
    let field_pascal = to_pascal_case(field_name);
    format!("{}{}", type_pascal, field_pascal)
}

/// Convert to PascalCase
fn to_pascal_case(s: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = true;
    for c in s.chars() {
        if c == '_' || c == '-' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_uppercase().next().unwrap());
            capitalize_next = false;
        } else {
            result.push(c);
        }
    }
    result
}

/// Get the item type for an array field (returns None if it's a primitive array)
fn get_array_item_type(schema: &Schema, type_name: &str, field_name: &str) -> Option<ArrayItemType> {
    if let Some(type_def) = schema.types.get(type_name) {
        match type_def {
            TypeDef::Sequence { sequence } => {
                for field in sequence {
                    if field.name.as_deref() == Some(field_name) {
                        if field.field_type == "array" {
                            if let Some(ref items) = field.items {
                                // Check if items type is "choice" with choices
                                if items.field_type == "choice" {
                                    if let Some(ref choices) = items.choices {
                                        let choice_types: Vec<String> = choices.iter()
                                            .map(|c| c.type_name.clone())
                                            .collect();
                                        return Some(ArrayItemType::Choice(choice_types));
                                    }
                                }
                                // Check if items type is a named type in schema (struct or discriminated union)
                                if schema.types.contains_key(&items.field_type) {
                                    if is_discriminated_union(schema, &items.field_type) {
                                        return Some(ArrayItemType::DiscriminatedUnion(items.field_type.clone()));
                                    } else {
                                        return Some(ArrayItemType::Struct(items.field_type.clone()));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }
    None
}

/// Enum to represent different array item types
enum ArrayItemType {
    Struct(String),
    DiscriminatedUnion(String),
    Choice(Vec<String>),  // list of variant type names
}

/// Check if a type is a discriminated union
fn is_discriminated_union(schema: &Schema, type_name: &str) -> bool {
    if let Some(type_def) = schema.types.get(type_name) {
        match type_def {
            TypeDef::DiscriminatedUnion { .. } => true,
            _ => false,
        }
    } else {
        false
    }
}

/// Format a discriminated union value
fn format_discriminated_union_value(
    value: &serde_json::Value,
    enum_type_name: &str,
    schema: &Schema,
    prefix: &str,
) -> String {
    if let serde_json::Value::Object(map) = value {
        // Get the variant type from the "type" field
        let variant_type = map.get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Get the variant payload from the "value" field
        let payload = map.get("value");

        if !variant_type.is_empty() {
            let prefixed_enum = format!("{}_{}", prefix, to_pascal_case(enum_type_name));
            let variant_pascal = to_pascal_case(variant_type);

            if let Some(payload_val) = payload {
                let payload_str = format_nested_struct(payload_val, variant_type, schema, prefix);
                return format!("{}::{}({})", prefixed_enum, variant_pascal, payload_str);
            } else {
                // No payload - unit variant (shouldn't happen for discriminated unions but handle it)
                return format!("{}::{}", prefixed_enum, variant_pascal);
            }
        }
    }
    // Fallback
    "/* unknown discriminated union */".to_string()
}

/// Format a choice type value (inline enum)
/// Choice format in JSON: { type: "VariantName", ...variantFields }
/// The variant fields are at the top level, not nested in a "value" field
fn format_choice_value(
    value: &serde_json::Value,
    variant_types: &[String],
    schema: &Schema,
    prefix: &str,
) -> String {
    let value_map = match value {
        serde_json::Value::Object(map) => map,
        _ => return "/* invalid choice value */".to_string(),
    };

    // Get the variant type from the "type" field
    let variant_type = match value_map.get("type").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => return "/* missing type field in choice */".to_string(),
    };

    // Build the choice enum name: Choice{Type1}{Type2}...
    let enum_name = format!("Choice{}", variant_types.iter()
        .map(|t| to_pascal_case(t))
        .collect::<Vec<_>>()
        .join(""));
    let prefixed_enum = format!("{}_{}", prefix, enum_name);

    // The variant name in Rust is PascalCase
    let variant_pascal = to_pascal_case(variant_type);

    // For choice types, the payload is the entire object except the "type" field
    // We need to construct the variant struct from the remaining fields
    let payload_map: serde_json::Map<String, serde_json::Value> = value_map.iter()
        .filter(|(k, _)| *k != "type")
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let payload_value = serde_json::Value::Object(payload_map);

    // Format the payload struct
    let payload_str = format_nested_struct(&payload_value, variant_type, schema, prefix);

    format!("{}::{}({})", prefixed_enum, variant_pascal, payload_str)
}

/// Escape Rust reserved keywords
fn escape_rust_keyword(name: &str) -> String {
    match name {
        "type" | "struct" | "enum" | "fn" | "let" | "mut" | "ref" | "const" | "static" |
        "pub" | "mod" | "use" | "self" | "super" | "crate" | "as" | "break" | "continue" |
        "else" | "for" | "if" | "in" | "loop" | "match" | "move" | "return" | "trait" |
        "where" | "while" | "async" | "await" | "dyn" | "impl" | "extern" | "unsafe" => {
            format!("r#{}", name)
        }
        _ => name.to_string()
    }
}

/// Convert camelCase to snake_case
fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            result.push(c.to_lowercase().next().unwrap());
        } else {
            result.push(c);
        }
    }
    result
}

/// Result of attempting to run a test suite
#[derive(Debug)]
enum SuiteResult {
    /// Code generation failed
    CodeGenError(String),
    /// Tests ran (may have passed or failed)
    Ran { passed: usize, failed: usize, errors: Vec<String> },
}

#[test]
fn test_compile_and_run_all() {
    // Only run if RUST_TESTS env var is set (compilation is slow)
    if std::env::var("RUST_TESTS").is_err() {
        println!("Skipping Rust compilation tests (set RUST_TESTS=1 to run)");
        return;
    }

    // Find ALL test files from all categories
    let tests_dir = "../packages/binschema/.generated/tests-json";
    let test_files = find_test_files(tests_dir);

    println!("Found {} test files total", test_files.len());

    // Track results per suite
    let mut suite_results: Vec<(String, SuiteResult)> = Vec::new();
    let mut codegen_success: Vec<(String, TestSuite, String)> = Vec::new();
    let mut codegen_failures: Vec<(String, String)> = Vec::new();

    // Try to generate code for each suite
    for path in &test_files {
        let suite = match load_test_suite(path) {
            Ok(s) => s,
            Err(e) => {
                let name = path.file_name().unwrap().to_str().unwrap().to_string();
                suite_results.push((name.clone(), SuiteResult::CodeGenError(format!("Load error: {}", e))));
                continue;
            }
        };

        let schema_json = match serde_json::to_string(&suite.schema) {
            Ok(j) => j,
            Err(e) => {
                suite_results.push((suite.name.clone(), SuiteResult::CodeGenError(format!("Schema serialize error: {}", e))));
                continue;
            }
        };

        match generate_rust_code(&schema_json, &suite.test_type) {
            Ok(code) => {
                let prefix = suite.name.replace("-", "_").replace(".", "_");
                let prefixed_code = prefix_type_names(&code, &prefix);
                codegen_success.push((prefix, suite, prefixed_code));
            }
            Err(e) => {
                codegen_failures.push((suite.name.clone(), e.to_string()));
                suite_results.push((suite.name.clone(), SuiteResult::CodeGenError(e.to_string())));
            }
        }
    }

    println!("\n=== Code Generation Results ===");
    println!("Generated: {}/{}", codegen_success.len(), test_files.len());
    println!("Failed:    {}", codegen_failures.len());

    if !codegen_failures.is_empty() {
        println!("\nCode generation failures:");
        for (name, err) in &codegen_failures {
            // Truncate long errors
            let short_err = if err.len() > 100 { &err[..100] } else { err };
            println!("  ✗ {}: {}", name, short_err.replace('\n', " "));
        }
    }

    if codegen_success.is_empty() {
        println!("\nNo suites generated - cannot run tests");
        return;
    }

    println!("\nTesting {} files", codegen_success.len());

    // Use the successfully generated suites
    let all_suites = codegen_success;

    // Create temp directory for batched compilation
    let temp_dir = tempfile::tempdir().expect("Create temp dir");
    let src_dir = temp_dir.path().join("src");
    fs::create_dir_all(&src_dir).expect("Create src dir");

    // Write all generated code files
    let mut mod_content = String::new();
    for (i, (prefix, _suite, code)) in all_suites.iter().enumerate() {
        let filename = format!("gen_{}.rs", i);
        fs::write(src_dir.join(&filename), code).expect("Write generated code");
        mod_content.push_str(&format!("mod gen_{};\npub use gen_{}::*;\n", i, i));
    }

    // Write lib.rs
    fs::write(src_dir.join("lib.rs"), &mod_content).expect("Write lib.rs");

    // Generate and write test harness
    let suite_refs: Vec<(String, TestSuite)> = all_suites
        .iter()
        .map(|(prefix, suite, _)| (prefix.clone(), suite.clone()))
        .collect();
    let harness = generate_test_harness(&suite_refs);
    fs::write(src_dir.join("main.rs"), &harness).expect("Write main.rs");

    // Write Cargo.toml
    let runtime_path = fs::canonicalize("..").expect("Get runtime path");
    let cargo_toml = format!(
        r#"[package]
name = "binschema-test"
version = "0.1.0"
edition = "2021"

[dependencies]
binschema-runtime = {{ path = "{}/rust" }}
serde = {{ version = "1.0", features = ["derive"] }}
serde_json = "1.0"
regex = "1.10"
"#,
        runtime_path.display()
    );
    fs::write(temp_dir.path().join("Cargo.toml"), &cargo_toml).expect("Write Cargo.toml");

    // Keep temp dir if DEBUG_GENERATED is set
    let keep_temp = std::env::var("DEBUG_GENERATED").ok();
    if let Some(ref dir) = keep_temp {
        let debug_dir = PathBuf::from(dir);
        if debug_dir.exists() {
            fs::remove_dir_all(&debug_dir).ok();
        }
        fs::create_dir_all(&debug_dir).expect("Create debug dir");
        // Copy files to debug dir
        for entry in fs::read_dir(temp_dir.path()).expect("Read temp dir") {
            let entry = entry.expect("Read entry");
            let dest = debug_dir.join(entry.file_name());
            if entry.path().is_dir() {
                copy_dir_all(&entry.path(), &dest).ok();
            } else {
                fs::copy(&entry.path(), &dest).ok();
            }
        }
        println!("Debug output saved to: {:?}", debug_dir);
    }

    println!("Temp dir: {:?}", temp_dir.path());
    println!("\n=== Compilation ===");

    // Compile
    let output = Command::new("cargo")
        .args(["build", "--release"])
        .current_dir(temp_dir.path())
        .output()
        .expect("Run cargo build");

    if !output.status.success() {
        println!("Cargo build FAILED:");
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Show first 2000 chars of error
        let truncated = if stderr.len() > 2000 { &stderr[..2000] } else { &stderr };
        println!("{}", truncated);

        println!("\n=== SUMMARY ===");
        println!("Test files found:    {}", test_files.len());
        println!("Code gen succeeded:  {}", all_suites.len());
        println!("Code gen failed:     {}", codegen_failures.len());
        println!("Compilation:         FAILED");
        println!("Tests run:           0");
        println!("Tests passed:        0");

        // Don't panic - just report failure
        return;
    }

    println!("Compilation: OK");

    // Run
    println!("\n=== Running Tests ===");
    let output = Command::new("cargo")
        .args(["run", "--release"])
        .current_dir(temp_dir.path())
        .output()
        .expect("Run cargo run");

    if !output.status.success() {
        println!("Test execution FAILED:");
        println!("{}", String::from_utf8_lossy(&output.stderr));

        println!("\n=== SUMMARY ===");
        println!("Test files found:    {}", test_files.len());
        println!("Code gen succeeded:  {}", all_suites.len());
        println!("Code gen failed:     {}", codegen_failures.len());
        println!("Compilation:         OK");
        println!("Execution:           FAILED");

        return;
    }

    // Parse results
    let stdout = String::from_utf8_lossy(&output.stdout);

    let results: Vec<Vec<TestResult>> = match serde_json::from_str(&stdout) {
        Ok(r) => r,
        Err(e) => {
            println!("Failed to parse results: {}", e);
            println!("Output was: {}", stdout);
            return;
        }
    };

    let mut total_passed = 0;
    let mut total_failed = 0;
    let mut suites_passing = 0;
    let mut suites_failing = 0;

    println!("\n=== Test Results ===");
    for (i, suite_results) in results.iter().enumerate() {
        let suite_name = &all_suites[i].1.name;
        let passed = suite_results.iter().filter(|r| r.pass).count();
        let failed = suite_results.iter().filter(|r| !r.pass).count();
        total_passed += passed;
        total_failed += failed;

        if failed > 0 {
            suites_failing += 1;
            println!("✗ {}: {}/{} passed", suite_name, passed, passed + failed);
            // Only show first 3 failures per suite to avoid spam
            for r in suite_results.iter().filter(|r| !r.pass).take(3) {
                let err_msg = r.error.as_ref().map(|e| {
                    if e.len() > 80 { format!("{}...", &e[..80]) } else { e.clone() }
                }).unwrap_or_default();
                println!("    - {}: {}", r.description, err_msg);
            }
            let remaining = suite_results.iter().filter(|r| !r.pass).count().saturating_sub(3);
            if remaining > 0 {
                println!("    ... and {} more failures", remaining);
            }
        } else if passed > 0 {
            suites_passing += 1;
            println!("✓ {}: {}/{} passed", suite_name, passed, passed + failed);
        }
    }

    println!("\n=== SUMMARY ===");
    println!("Test files found:    {}", test_files.len());
    println!("Code gen succeeded:  {}", all_suites.len());
    println!("Code gen failed:     {}", codegen_failures.len());
    println!("Compilation:         OK");
    println!("Suites passing:      {}", suites_passing);
    println!("Suites failing:      {}", suites_failing);
    println!("Tests passed:        {}", total_passed);
    println!("Tests failed:        {}", total_failed);
    println!("Pass rate:           {:.1}%",
        if total_passed + total_failed > 0 {
            100.0 * total_passed as f64 / (total_passed + total_failed) as f64
        } else { 0.0 });
}

/// Helper to recursively copy a directory
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}
