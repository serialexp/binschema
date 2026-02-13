#!/usr/bin/env python3
"""
Categorize Rust test failures from test output.

Usage:
    just test-rust        # generates rust/test-output.txt
    just test-rust-categorize  # analyzes saved output (no recompilation)
"""

import sys
import re
from collections import defaultdict


def categorize_encode_mismatch(suite_name: str) -> str:
    """Sub-categorize encode mismatches using the suite name to infer feature area."""

    # Position fields / seekable streams / instance fields
    if any(kw in suite_name for kw in [
        "position_field", "basic_position", "nested_position", "multiple_position",
        "deep_nesting_position", "memory_efficient_position", "negative_position",
        "lazy_evaluation", "circular_reference", "mixed_inline_standalone",
        "no_alignment", "negative_position_alignment",
    ]):
        return "mismatch: position/seekable fields (instance)"

    if "instance" in suite_name or suite_name.startswith("pcf_"):
        return "mismatch: instance fields"

    # first/last/corresponding selectors
    if any(kw in suite_name for kw in [
        "first_element", "last_element", "corresponding",
        "empty_array_correlation", "aggregate_size",
        "zip_style",
    ]):
        return "mismatch: first/last/corresponding selectors"

    # Context features (extension, sum_of_type_sizes, etc.)
    if suite_name.startswith("context_"):
        if "first_selector" in suite_name or "last_selector" in suite_name:
            return "mismatch: first/last/corresponding selectors"
        if "corresponding" in suite_name:
            return "mismatch: first/last/corresponding selectors"
        if "sum_of_type_sizes" in suite_name:
            return "mismatch: sum_of_type_sizes computed fields"
        if "extension" in suite_name:
            return "mismatch: context extension"
        if "error_" in suite_name:
            return "mismatch: context error handling"
        return "mismatch: context (other)"

    # DNS compression
    if "dns_compression" in suite_name:
        return "mismatch: DNS back_reference encoding"

    # Kerberos / ASN.1
    if "kerberos" in suite_name:
        return "mismatch: Kerberos/ASN.1 (from_after_field)"

    # Optional bit-level
    if "optional_builtin_bit" in suite_name:
        return "mismatch: optional bit-level fields"

    return f"mismatch: uncategorized ({suite_name})"


def categorize_error(error_msg: str, suite_name: str = "") -> str:
    """Categorize a test failure error message into a bucket."""

    # Code generation failures
    if "CLI failed" in error_msg:
        if "_root references" in error_msg:
            return "codegen: _root references (unsupported)"
        if "from_after_field" in error_msg:
            return "codegen: from_after_field (unsupported)"
        return "codegen: other"

    # Encode errors
    if "encode error:" in error_msg:
        after = error_msg.split("encode error:", 1)[1].strip()

        if "Parent field" in after:
            if "[corresponding<" in after or "[first<" in after or "[last<" in after:
                return "encode error: parent field with selector (first/last/corresponding)"
            if "not found" in after:
                return "encode error: parent field not found (context passing)"

        if "Not implemented: encoding composite variant" in after:
            return "encode error: composite variant encoding (variant_terminated)"

        if "Not implemented: encoding field" in after:
            if "varlength" in after:
                return "encode error: varlength field (ASN.1/DER)"
            if "type '" in after:
                type_match = re.search(r"type '(\w+)'", after)
                type_name = type_match.group(1) if type_match else "unknown"
                return f"encode error: not implemented field type '{type_name}'"
            return "encode error: not implemented (other)"

        if "Not implemented: encoding array" in after:
            return "encode error: array in choice variant"

        return f"encode error: other ({after[:60]}...)" if len(after) > 60 else f"encode error: other ({after})"

    # Encode mismatches - sub-categorize by suite name
    if "encode mismatch:" in error_msg:
        return categorize_encode_mismatch(suite_name)

    # Decode errors
    if "decode error:" in error_msg:
        after = error_msg.split("decode error:", 1)[1].strip()
        if "Unexpected end of input" in after:
            return "decode error: unexpected end of input"
        if "Invalid variant discriminator" in after:
            return "decode error: invalid variant discriminator"
        return f"decode error: other ({after[:60]}...)" if len(after) > 60 else f"decode error: other ({after})"

    # Decode mismatches
    if "decode mismatch:" in error_msg:
        return "decode mismatch (wrong value decoded)"

    return f"uncategorized ({error_msg[:80]}...)" if len(error_msg) > 80 else f"uncategorized ({error_msg})"


def main():
    lines = sys.stdin.readlines()

    # Parse test output
    current_suite = None
    suite_status = {}  # suite -> "pass" | "fail" | "codegen_fail"
    failures = []  # list of (suite, test_desc, error_msg, category)

    for line in lines:
        line = line.rstrip()

        # Detect suite lines
        pass_match = re.match(r'\s*[✓]\s+(\S+):', line)
        fail_match = re.match(r'\s*[✗]\s+(\S+):', line)
        codegen_match = re.match(r'\s*[✗]\s+(\S+): CLI failed:', line)

        if codegen_match:
            suite = codegen_match.group(1)
            current_suite = suite
            category = categorize_error(line.strip(), suite)
            failures.append((suite, "(code generation)", line.strip(), category))
            suite_status[suite] = "codegen_fail"
        elif fail_match:
            suite = fail_match.group(1)
            current_suite = suite
            suite_status[suite] = "fail"
        elif pass_match:
            suite = pass_match.group(1)
            current_suite = suite
            if suite not in suite_status:
                suite_status[suite] = "pass"

        # Detect individual test failure lines
        test_match = re.match(r'\s+- (.+?):\s+(encode error|encode mismatch|decode error|decode mismatch):\s*(.*)', line)
        if test_match and current_suite:
            test_desc = test_match.group(1)
            error_type = test_match.group(2)
            error_detail = test_match.group(3)
            full_error = f"{error_type}: {error_detail}"
            category = categorize_error(full_error, current_suite)
            failures.append((current_suite, test_desc, full_error, category))

    # Group by category
    by_category = defaultdict(list)
    for suite, test_desc, error_msg, category in failures:
        by_category[category].append((suite, test_desc))

    # Summary line from original output
    for line in lines:
        if "=== SUMMARY ===" in line:
            idx = lines.index(line)
            print("=" * 70)
            print("ORIGINAL SUMMARY")
            print("=" * 70)
            for summary_line in lines[idx:idx+10]:
                summary_line = summary_line.strip()
                if summary_line:
                    print(f"  {summary_line}")
            print()
            break

    # Print categorized failures
    print("=" * 70)
    print("FAILURE CATEGORIES (sorted by count)")
    print("=" * 70)

    sorted_categories = sorted(by_category.items(), key=lambda x: -len(x[1]))

    total_failures = 0
    for category, items in sorted_categories:
        count = len(items)
        total_failures += count
        print(f"\n  [{count:3d}] {category}")

        # Group by suite within category
        suites = defaultdict(list)
        for suite, test_desc in items:
            suites[suite].append(test_desc)

        for suite, tests in sorted(suites.items()):
            if len(tests) == 1 and tests[0] == "(code generation)":
                print(f"         {suite}")
            else:
                print(f"         {suite} ({len(tests)} tests)")
                for t in tests:
                    print(f"           - {t}")

    print(f"\n{'=' * 70}")
    print(f"  Total individual failures: {total_failures}")
    print(f"  Categories: {len(sorted_categories)}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
