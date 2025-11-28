// ABOUTME: Test runner for BinSchema Rust implementation
// ABOUTME: Loads all test suites and reports coverage status

use binschema_runtime::test_schema::TestSuite;
use std::fs;
use std::path::PathBuf;

fn find_test_files(dir: &str) -> Vec<PathBuf> {
    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                files.extend(find_test_files(path.to_str().unwrap()));
            } else if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if path.file_name()
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

fn load_test_suite(path: &PathBuf) -> Result<TestSuite, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    let suite: TestSuite = json5::from_str(&content)?;
    Ok(suite)
}

#[test]
fn test_rust_implementation_status() {
    // Load ALL test suites from all directories
    let tests_dir = "../packages/binschema/.generated/tests-json";
    let test_files = find_test_files(tests_dir);

    println!("Found {} test files", test_files.len());

    // Load all test suites and count total tests
    let mut total_suites = 0;
    let mut total_tests = 0;
    let mut load_failures = 0;

    for file in &test_files {
        match load_test_suite(file) {
            Ok(suite) => {
                total_suites += 1;
                total_tests += suite.test_cases.len();
            }
            Err(_) => {
                load_failures += 1;
            }
        }
    }

    println!("\n=== Rust Implementation Status ===");
    println!("Test suites found: {}", test_files.len());
    println!("Test suites loaded: {} ({} failed to parse)", total_suites, load_failures);
    println!("Total test cases: {}", total_tests);
    println!();
    println!("NOTE: The Rust code generator is not yet implemented.");
    println!("      Once implemented, this test will compile and run generated Rust code");
    println!("      against all {} test cases.", total_tests);
    println!();
    println!("Summary: 0/{} tests passed (Rust generator not implemented)", total_tests);

    // This test passes - it's just reporting status, not failing on missing implementation
    // Note: Some tests in TypeScript are custom function tests, not TestSuite tests
    // TestSuite tests (the ones in JSON) should be ~660+
    assert!(total_tests > 600, "Expected at least 600 test cases, found {}", total_tests);
}
