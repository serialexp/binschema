#!/usr/bin/env bash
# Script to update function-based test files to use logger instead of console

set -euo pipefail

FILES=(
  "src/tests/runtime/peek-methods.test.ts"
  "src/tests/generators/discriminated-union-codegen.test.ts"
  "src/tests/generators/pointer-codegen.test.ts"
  "src/tests/schema/protocol-transformation.test.ts"
  "src/tests/schema/protocol-validation.test.ts"
  "src/tests/schema/pointer-validation.test.ts"
  "src/tests/schema/discriminated-union-validation.test.ts"
)

PREVIEW="${1:-}"

for file in "${FILES[@]}"; do
  echo "=== Processing $file ==="

  # Show current imports
  echo "Current imports:"
  grep "^import " "$file" || true

  # Show console.log/error usage
  count=$(grep -c "console\." "$file" || true)
  echo "Found $count console.log/error calls"

  # Show throw statements
  throws=$(grep -c "throw new Error.*failed" "$file" || true)
  echo "Found $throws 'throw new Error' statements"

  echo ""
done

if [ "$PREVIEW" != "--apply" ]; then
  echo "This is a preview. Run with --apply to make changes."
  exit 0
fi

echo "ERROR: Auto-apply not implemented - please update files manually"
exit 1
