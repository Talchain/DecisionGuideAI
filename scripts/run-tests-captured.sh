#!/usr/bin/env bash
#
# run-tests-captured.sh
# Runs the full test suite and captures results to artifacts for truthful reporting.
#
# Usage:
#   ./scripts/run-tests-captured.sh [environment]
#
# Environment:
#   baseline (default) - RATE_LIMIT_ENABLED=0, SCM_LITE_ENABLE=0
#   scm-lite           - SCM_LITE_ENABLE=1 (runs only @scm-lite tagged tests)
#
# Outputs:
#   .tmp/test-run-<timestamp>.log       - Full stdout/stderr
#   .tmp/test-summary.json              - Parsed test counts
#   .tmp/test-run-latest.log (symlink)  - Points to most recent run
#

set -euo pipefail

# Create .tmp directory if it doesn't exist
mkdir -p .tmp

# Determine environment
ENV="${1:-baseline}"
TIMESTAMP=$(date +%s)
LOG_FILE=".tmp/test-run-${TIMESTAMP}.log"

echo "=== Test Capture Starting ===" | tee "$LOG_FILE"
echo "Environment: $ENV" | tee -a "$LOG_FILE"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Set environment variables based on profile
case "$ENV" in
  baseline)
    echo "Profile: Baseline (no rate limits, no SCM-lite)" | tee -a "$LOG_FILE"
    export RATE_LIMIT_ENABLED=0
    export SCM_LITE_ENABLE=0
    TEST_ARGS="--run"
    ;;
  scm-lite)
    echo "Profile: SCM-Lite only" | tee -a "$LOG_FILE"
    export RATE_LIMIT_ENABLED=0
    export SCM_LITE_ENABLE=1
    TEST_ARGS="--run --grep @scm-lite"
    ;;
  *)
    echo "Error: Unknown environment '$ENV'" | tee -a "$LOG_FILE"
    echo "Valid environments: baseline, scm-lite" | tee -a "$LOG_FILE"
    exit 1
    ;;
esac

echo "" | tee -a "$LOG_FILE"
echo "=== Running Tests ===" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Run tests and capture output
# Use 'npm test' for unit/integration, not Playwright E2E (those are separate)
npm test $TEST_ARGS 2>&1 | tee -a "$LOG_FILE" || true

# Create symlink to latest run
ln -sf "test-run-${TIMESTAMP}.log" .tmp/test-run-latest.log

echo "" | tee -a "$LOG_FILE"
echo "=== Test Capture Complete ===" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Latest symlink: .tmp/test-run-latest.log" | tee -a "$LOG_FILE"

# Parse results and generate summary JSON
echo "" | tee -a "$LOG_FILE"
echo "=== Generating Summary ===" | tee -a "$LOG_FILE"

node scripts/summarise-tests.cjs "$LOG_FILE"

echo "Summary saved to: .tmp/test-summary.json" | tee -a "$LOG_FILE"
echo ""
echo "Done! View results:"
echo "  cat $LOG_FILE"
echo "  cat .tmp/test-summary.json"
