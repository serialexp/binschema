#!/usr/bin/env python3
"""
BinSchema Python Test Harness

Loads JSON test suites from tests-json/, generates Python code via the CLI,
and runs encode/decode tests against the expected bytes.

This is the Python equivalent of go/test/compile_batch.go.
"""

import json
import json5
import os
import re
import subprocess
import sys
import tempfile
import math
from pathlib import Path


def find_project_root() -> Path:
    """Find the BinSchema project root by looking for justfile."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "justfile").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root (no justfile found)")


PROJECT_ROOT = find_project_root()
TESTS_DIR = PROJECT_ROOT / "packages" / "binschema" / ".generated" / "tests-json"
RUNTIME_DIR = PROJECT_ROOT / "python" / "runtime"


def load_test_suites(tests_dir: Path, filter_pattern: str = "") -> list[dict]:
    """Load all .test.json files recursively."""
    suites = []
    for path in sorted(tests_dir.rglob("*.test.json")):
        with open(path) as f:
            content = f.read()
            suite = json5.loads(content)

        # Normalize test_cases field
        test_cases = suite.get("test_cases", suite.get("tests", []))
        suite["test_cases"] = process_bigint_values(test_cases)
        suite["_path"] = str(path)

        # Convert bits to bytes if needed
        bit_order = "msb_first"
        config = suite.get("schema", {}).get("config", {})
        if isinstance(config, dict):
            bit_order = config.get("bit_order", "msb_first")
        convert_bits_to_bytes(suite["test_cases"], bit_order)

        if filter_pattern:
            if not re.search(filter_pattern, suite.get("name", ""), re.IGNORECASE):
                continue

        suites.append(suite)

    return suites



def process_bigint_values(test_cases: list) -> list:
    """Convert BigInt strings (ending in 'n') to ints."""
    for tc in test_cases:
        tc["value"] = _process_bigint(tc.get("value"))
        if "decoded_value" in tc and tc["decoded_value"] is not None:
            tc["decoded_value"] = _process_bigint(tc["decoded_value"])
    return test_cases


def _process_bigint(val):
    if isinstance(val, str) and val.endswith("n"):
        try:
            return int(val[:-1])
        except ValueError:
            return val
    elif isinstance(val, dict):
        return {k: _process_bigint(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [_process_bigint(v) for v in val]
    return val


def convert_bits_to_bytes(test_cases: list, bit_order: str):
    """Convert test cases with bits field to bytes field."""
    for tc in test_cases:
        bits = tc.get("bits")
        if bits and not tc.get("bytes"):
            tc["bytes"] = bits_to_bytes(bits, bit_order)


def bits_to_bytes(bits: list[int], bit_order: str) -> list[int]:
    """Convert bit array to byte array respecting bit order."""
    if not bits:
        return []
    num_bytes = (len(bits) + 7) // 8
    result = [0] * num_bytes

    for i, bit in enumerate(bits):
        if bit:
            byte_idx = i // 8
            if bit_order == "lsb_first":
                bit_idx = i % 8
            else:
                bit_idx = 7 - (i % 8)
            result[byte_idx] |= 1 << bit_idx

    return result


def generate_python_source(schema: dict, test_type: str) -> str:
    """Generate Python code from a schema by calling the CLI."""
    with tempfile.TemporaryDirectory(prefix="binschema-py-gen-") as tmpdir:
        schema_file = os.path.join(tmpdir, "schema.json")
        with open(schema_file, 'w') as f:
            json.dump(schema, f, indent=2)

        output_dir = os.path.join(tmpdir, "out")
        os.makedirs(output_dir)

        cmd = [
            "bun", "run",
            str(PROJECT_ROOT / "packages" / "binschema" / "src" / "cli" / "index.ts"),
            "generate",
            "--language", "python",
            "--schema", schema_file,
            "--out", output_dir,
        ]

        result = subprocess.run(
            cmd,
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            raise RuntimeError(f"Code generation failed:\n{result.stderr}\n{result.stdout}")

        code_path = os.path.join(output_dir, "generated.py")
        with open(code_path) as f:
            return f.read()


def run_test_suite(suite: dict) -> list[dict]:
    """Run all test cases in a suite and return results."""
    results = []
    schema = suite["schema"]
    test_type = suite["test_type"]
    test_cases = suite["test_cases"]

    if not test_cases:
        return results

    # Skip schema validation error tests
    if suite.get("schema_validation_error"):
        return results

    # Generate code
    try:
        code = generate_python_source(schema, test_type)
    except RuntimeError as e:
        for tc in test_cases:
            results.append({
                "description": tc["description"],
                "pass": False,
                "error": f"Code generation failed: {e}",
            })
        return results

    # Prepare the execution namespace with the runtime
    namespace: dict = {}

    # Add runtime to sys.path temporarily
    sys.path.insert(0, str(RUNTIME_DIR.parent))
    try:
        # Import runtime into the namespace
        exec("from runtime.bitstream import BitStreamEncoder, BitStreamDecoder, SeekableBitStreamDecoder", namespace)
        exec("from typing import Any", namespace)
        exec("from __future__ import annotations", namespace)
        exec("import math", namespace)
        exec("import struct", namespace)

        # Fix import in generated code: replace binschema_runtime with runtime.bitstream
        fixed_code = code.replace(
            "from binschema_runtime import BitStreamEncoder, BitStreamDecoder, SeekableBitStreamDecoder",
            "from runtime.bitstream import BitStreamEncoder, BitStreamDecoder, SeekableBitStreamDecoder"
        )
        # Also remove duplicate future import
        fixed_code = fixed_code.replace('from __future__ import annotations\n', '', 1)

        exec(fixed_code, namespace)
    except Exception as e:
        for tc in test_cases:
            results.append({
                "description": tc["description"],
                "pass": False,
                "error": f"Code compilation failed: {e}",
            })
        return results
    finally:
        sys.path.pop(0)

    # Find encoder and decoder classes
    pascal_name = to_pascal_case(test_type)
    snake_name = to_snake_case(test_type)

    encoder_class = namespace.get(f"{pascal_name}Encoder")
    decoder_class = namespace.get(f"{pascal_name}Decoder")
    decode_func = namespace.get(f"decode_{snake_name}")

    if not encoder_class:
        for tc in test_cases:
            results.append({
                "description": tc["description"],
                "pass": False,
                "error": f"Encoder class {pascal_name}Encoder not found in generated code",
            })
        return results

    # Run each test case
    for tc in test_cases:
        result = run_single_test(
            tc, encoder_class, decoder_class, decode_func,
            namespace, schema, test_type
        )
        results.append(result)

    return results


def run_single_test(
    tc: dict,
    encoder_class,
    decoder_class,
    decode_func,
    namespace: dict,
    schema: dict,
    test_type: str,
) -> dict:
    """Run a single test case (encode + decode)."""
    description = tc["description"]
    value = tc["value"]
    expected_bytes = tc.get("bytes", [])
    decoded_value = tc["decoded_value"] if tc.get("decoded_value") is not None else value
    should_error = tc.get("should_error", False)
    should_error_encode = tc.get("should_error_on_encode", False)
    should_error_decode = tc.get("should_error_on_decode", False)

    # Test encoding
    try:
        encoder = encoder_class()
        encoded = encoder.encode(value)
        encoded_list = list(encoded)

        if should_error or should_error_encode:
            return {
                "description": description,
                "pass": False,
                "error": "Expected encoding error but succeeded",
            }

        if encoded_list != expected_bytes:
            return {
                "description": description,
                "pass": False,
                "error": f"Encode mismatch: expected {expected_bytes}, got {encoded_list}",
            }
    except Exception as e:
        if should_error or should_error_encode:
            return {"description": description, "pass": True}
        return {
            "description": description,
            "pass": False,
            "error": f"Encode error: {e}",
        }

    # Test decoding
    try:
        if decoder_class:
            decoder = decoder_class(bytes(expected_bytes))
            decoded = decoder.decode()
        elif decode_func:
            from runtime.bitstream import BitStreamDecoder as BD
            decoder = BD(bytes(expected_bytes))
            decoded = decode_func(decoder)
        else:
            return {
                "description": description,
                "pass": False,
                "error": "No decoder available",
            }

        if should_error or should_error_decode:
            return {
                "description": description,
                "pass": False,
                "error": "Expected decoding error but succeeded",
            }

        if not values_equal(decoded, decoded_value):
            return {
                "description": description,
                "pass": False,
                "error": f"Decode mismatch: expected {decoded_value}, got {decoded}",
            }
    except Exception as e:
        if should_error or should_error_decode:
            return {"description": description, "pass": True}
        return {
            "description": description,
            "pass": False,
            "error": f"Decode error: {e}",
        }

    return {"description": description, "pass": True}


def values_equal(actual, expected) -> bool:
    """Compare decoded value with expected value, handling type differences."""
    if actual is None and expected is None:
        return True
    if actual is None or expected is None:
        return False

    if isinstance(expected, dict) and isinstance(actual, dict):
        if set(expected.keys()) != set(actual.keys()):
            return False
        return all(values_equal(actual[k], expected[k]) for k in expected)

    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return False
        return all(values_equal(a, e) for a, e in zip(actual, expected))

    if isinstance(expected, float) and isinstance(actual, float):
        if math.isnan(expected) and math.isnan(actual):
            return True
        if math.isinf(expected) and math.isinf(actual):
            return (expected > 0) == (actual > 0)
        # Allow float32 precision loss (relative tolerance)
        if expected == 0:
            return abs(actual) < 1e-7
        return abs((actual - expected) / expected) < 1e-6

    if isinstance(expected, bool) or isinstance(actual, bool):
        return bool(expected) == bool(actual)

    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return expected == actual

    return expected == actual


def to_pascal_case(name: str) -> str:
    if not '_' in name and name[0:1].isupper():
        return name
    return ''.join(part.capitalize() for part in name.split('_'))


def to_snake_case(name: str) -> str:
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', name)
    name = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', name)
    return name.lower()


def main():
    filter_pattern = os.environ.get("PYTHON_TEST_FILTER", "")
    report = os.environ.get("PYTHON_TEST_REPORT", "")
    debug = os.environ.get("DEBUG_GENERATED", "")

    if not TESTS_DIR.exists():
        print(f"Tests directory not found: {TESTS_DIR}")
        print("Run 'npm test' first to generate JSON test files.")
        sys.exit(1)

    suites = load_test_suites(TESTS_DIR, filter_pattern)
    print(f"Loaded {len(suites)} test suites")

    if filter_pattern:
        print(f"Filtered by: {filter_pattern}")

    total_passed = 0
    total_failed = 0
    suite_results: dict[str, list[dict]] = {}

    for suite in suites:
        name = suite.get("name", "unknown")
        results = run_test_suite(suite)
        suite_results[name] = results

        passed = sum(1 for r in results if r["pass"])
        failed = sum(1 for r in results if not r["pass"])
        total_passed += passed
        total_failed += failed

        if results:
            status = "PASS" if failed == 0 else "FAIL"
            print(f"  {status} {name}: {passed}/{passed + failed}")

            if failed > 0 or report == "failing-tests":
                for r in results:
                    if not r["pass"]:
                        print(f"       FAIL: {r['description']}: {r.get('error', '')}")

    print(f"\nTotal: {total_passed} passed, {total_failed} failed")
    print(f"{len(suites)} test suites")

    if total_failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
