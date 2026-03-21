#!/usr/bin/env bash
# CI guard: fail if the number of vitest test-file exclusions increases.
# Only counts lines with quoted .spec/.test file paths in the FIRST exclude block.
# Baseline: 3 (DOM integration tests that need full canvas mount or network mocking).
set -euo pipefail

BASELINE=3
CONFIG="vitest.config.ts"

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: $CONFIG not found"
  exit 1
fi

# Extract only the first exclude block (test exclusions, not coverage exclusions)
# and count lines that reference .spec or .test files
COUNT=$(awk '/exclude: \[/{found++} found==1{print} found==1 && /\]/{exit}' "$CONFIG" \
  | grep -cE '\.(spec|test)\.' || true)

echo "Test exclusion count: $COUNT (baseline: $BASELINE)"

if [ "$COUNT" -gt "$BASELINE" ]; then
  echo "FAIL: Exclusion count ($COUNT) exceeds baseline ($BASELINE)."
  echo "Either fix the failing tests or get explicit approval to increase the baseline."
  exit 1
fi

echo "PASS: Exclusion count is within baseline."
