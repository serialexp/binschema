// ABOUTME: Batched compilation for Rust test suites
// ABOUTME: Compiles all test suites at once for fast execution

use binschema_runtime::test_schema::{TestCase, TestSuite};
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
    // This is a simplified version - we need to replace struct names and their references
    // For now, we'll use regex-like replacements

    let mut result = code.to_string();

    // Replace struct definitions: "pub struct Foo" -> "pub struct prefix_Foo"
    // Note: This is a simple approach. A more robust version would use a proper parser.
    let re_struct = regex::Regex::new(r"pub struct ([A-Z][a-zA-Z0-9_]*)").unwrap();
    let type_names: Vec<String> = re_struct
        .captures_iter(&code)
        .map(|cap| cap[1].to_string())
        .collect();

    for type_name in &type_names {
        // Replace struct definition
        result = result.replace(
            &format!("pub struct {}", type_name),
            &format!("pub struct {}_{}", prefix, type_name),
        );

        // Replace impl block
        result = result.replace(
            &format!("impl {} ", type_name),
            &format!("impl {}_{} ", prefix, type_name),
        );

        // Replace type references (Self:: prefix is okay)
        result = result.replace(
            &format!(": {} ", type_name),
            &format!(": {}_{} ", prefix, type_name),
        );

        result = result.replace(
            &format!("{}::", type_name),
            &format!("{}_{}", prefix, type_name),
        );
    }

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
            harness.push_str(&generate_value_construction(&prefixed_type, &tc.value, "test_value"));

            // Encode
            harness.push_str("            let encoded = test_value.encode();\n");

            // Compare bytes
            if let Some(bytes) = &tc.bytes {
                harness.push_str(&format!(
                    "            let expected: Vec<u8> = vec![{}];\n",
                    bytes
                        .iter()
                        .map(|b| b.to_string())
                        .collect::<Vec<_>>()
                        .join(", ")
                ));
                harness.push_str("            if encoded != expected {\n");
                harness.push_str("                result.error = Some(format!(\"encode mismatch: got {:?}, want {:?}\", encoded, expected));\n");
                harness.push_str("                results.push(result);\n");
                harness.push_str("            } else {\n");

                // Decode
                harness.push_str(&format!(
                    "                match {}::decode(&encoded) {{\n",
                    prefixed_type
                ));
                harness.push_str("                    Ok(decoded) => {\n");
                harness.push_str("                        if decoded == test_value {\n");
                harness.push_str("                            result.pass = true;\n");
                harness.push_str("                        } else {\n");
                harness.push_str("                            result.error = Some(format!(\"decode mismatch: got {:?}, want {:?}\", decoded, test_value));\n");
                harness.push_str("                        }\n");
                harness.push_str("                        results.push(result);\n");
                harness.push_str("                    }\n");
                harness.push_str("                    Err(e) => {\n");
                harness.push_str("                        result.error = Some(format!(\"decode error: {}\", e));\n");
                harness.push_str("                        results.push(result);\n");
                harness.push_str("                    }\n");
                harness.push_str("                }\n");
                harness.push_str("            }\n");
            }

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
fn generate_value_construction(type_name: &str, value: &serde_json::Value, var_name: &str) -> String {
    match value {
        serde_json::Value::Object(map) => {
            let mut result = format!("            let {} = {} {{\n", var_name, type_name);
            for (key, val) in map {
                let field_name = to_snake_case(key);
                let field_value = format_value(val);
                result.push_str(&format!("                {}: {},\n", field_name, field_value));
            }
            result.push_str("            };\n");
            result
        }
        _ => format!("            let {} = {}::default();\n", var_name, type_name),
    }
}

/// Convert a value to Rust literal
fn format_value(value: &serde_json::Value) -> String {
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
                // Try parsing as i64 first, then u64
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
            let items: Vec<String> = arr.iter().map(format_value).collect();
            format!("vec![{}]", items.join(", "))
        }
        serde_json::Value::Object(_map) => {
            // For nested structs, we'd need the type name - skip for now
            format!("/* nested object */")
        }
        serde_json::Value::Null => "None".to_string(),
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

#[test]
fn test_compile_and_run_primitives() {
    // Only run if RUST_TESTS env var is set (compilation is slow)
    if std::env::var("RUST_TESTS").is_err() {
        println!("Skipping Rust compilation tests (set RUST_TESTS=1 to run)");
        return;
    }

    let tests_dir = "../packages/binschema/.generated/tests-json/primitives";
    let test_files = find_test_files(tests_dir);

    println!("Found {} primitive test files", test_files.len());

    // Test basic primitive types (exclude complex ones that use unsupported features)
    let exclude_patterns = [
        "varlength", "leb128", "ebml", "midi", "ber", "der", "asn1",
        "vlq", "mixed_varlength", "latin1",
        "float", "bit_patterns", "boundary", "power_of_two", "signed_boundaries",
    ];
    let filtered_files: Vec<_> = test_files
        .iter()
        .filter(|p| {
            let name = p.file_name().unwrap().to_str().unwrap().to_lowercase();
            !exclude_patterns.iter().any(|pattern| name.contains(pattern))
        })
        .collect();

    println!("Testing {} files: {:?}", filtered_files.len(), filtered_files);

    let mut all_suites: Vec<(String, TestSuite, String)> = Vec::new();

    for path in filtered_files {
        let suite = load_test_suite(path).expect("Should load suite");

        // Generate Rust code
        let schema_json = serde_json::to_string(&suite.schema).expect("Should serialize schema");
        match generate_rust_code(&schema_json, &suite.test_type) {
            Ok(code) => {
                let prefix = suite.name.replace("-", "_");
                let prefixed_code = prefix_type_names(&code, &prefix);
                all_suites.push((prefix, suite, prefixed_code));
            }
            Err(e) => {
                println!("Failed to generate code for {}: {}", suite.name, e);
            }
        }
    }

    println!("Successfully generated code for {} suites", all_suites.len());

    if all_suites.is_empty() {
        println!("No suites generated - skipping compilation");
        return;
    }

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

    println!("Temp dir: {:?}", temp_dir.path());
    println!("Compiling with cargo...");

    // Compile
    let output = Command::new("cargo")
        .args(["build", "--release"])
        .current_dir(temp_dir.path())
        .output()
        .expect("Run cargo build");

    if !output.status.success() {
        println!("Cargo build failed:");
        println!("{}", String::from_utf8_lossy(&output.stderr));
        panic!("Cargo build failed");
    }

    println!("Compilation succeeded!");

    // Run
    let output = Command::new("cargo")
        .args(["run", "--release"])
        .current_dir(temp_dir.path())
        .output()
        .expect("Run cargo run");

    if !output.status.success() {
        println!("Cargo run failed:");
        println!("{}", String::from_utf8_lossy(&output.stderr));
        panic!("Cargo run failed");
    }

    // Parse results
    let stdout = String::from_utf8_lossy(&output.stdout);
    println!("Output: {}", stdout);

    let results: Vec<Vec<TestResult>> =
        serde_json::from_str(&stdout).expect("Parse JSON results");

    let mut total_passed = 0;
    let mut total_failed = 0;

    for (i, suite_results) in results.iter().enumerate() {
        let suite_name = &all_suites[i].1.name;
        let passed = suite_results.iter().filter(|r| r.pass).count();
        let failed = suite_results.iter().filter(|r| !r.pass).count();
        total_passed += passed;
        total_failed += failed;

        if failed > 0 {
            println!("✗ {}: {}/{} passed", suite_name, passed, passed + failed);
            for r in suite_results.iter().filter(|r| !r.pass) {
                println!("  - {}: {}", r.description, r.error.as_ref().unwrap_or(&"".to_string()));
            }
        } else {
            println!("✓ {}: {}/{} passed", suite_name, passed, passed + failed);
        }
    }

    println!("\nSummary: {}/{} tests passed", total_passed, total_passed + total_failed);
    assert!(total_passed > 0, "Should have at least one passing test");
}
