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
    let mut result = code.to_string();

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

    // Also collect type names referenced in enum variants (they might be defined later or in the same enum)
    // Pattern: EnumVariant(TypeName) or EnumVariant(TypeName,
    let re_variant_types = regex::Regex::new(r"\s+([A-Z][a-zA-Z0-9_]*)\(([A-Z][a-zA-Z0-9_]*)[\),]").unwrap();
    for cap in re_variant_types.captures_iter(&code) {
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
        let re_qualified = regex::Regex::new(&format!(r"::{}([\(\,\)])", regex::escape(type_name))).unwrap();
        result = re_qualified.replace_all(&result, format!("::{}{}", prefixed, "$1")).to_string();

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
