#!/bin/bash
set -euo pipefail

# Fetch CEE contract schemas from the CEE repo into contracts/cee/.
#
# Local development: reads from a sibling directory (default: ../olumi-assistants-service).
# CI: set CEE_REPO_PATH to the checkout location (e.g. ./cee-repo).
#
# Strict mode (CI=1 or --strict): fails if any expected schema is missing.
# Permissive mode (default local): warns on missing schemas, uses local reference copies.

CEE_REPO="${CEE_REPO_PATH:-../olumi-assistants-service}"
STRICT="${STRICT_CONTRACTS:-${CI:-}}"

# Parse --strict flag
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
  esac
done

if [ ! -d "$CEE_REPO" ]; then
  echo "ERROR: CEE repo not found at $CEE_REPO"
  echo "Set CEE_REPO_PATH to the correct location"
  exit 1
fi

# CEE exports schemas via contracts/ directory (preferred) or fallback to schemas/.
CEE_CONTRACTS=""
if [ -d "$CEE_REPO/contracts" ]; then
  CEE_CONTRACTS="$CEE_REPO/contracts"
elif [ -d "$CEE_REPO/schemas" ]; then
  CEE_CONTRACTS="$CEE_REPO/schemas"
else
  echo "ERROR: No contracts/ or schemas/ directory found in $CEE_REPO"
  echo "CEE contract export must be merged first"
  exit 1
fi

mkdir -p contracts/cee

EXPECTED_COUNT=6
SCHEMAS=(
  "turn-request.schema.json"
  "analysis-state.schema.json"
  "graph-state.schema.json"
  "system-event.schema.json"
  "orchestrator-response-v2.schema.json"
  "stream-event.schema.json"
)

copied=0
missing=0
missing_names=()
for schema in "${SCHEMAS[@]}"; do
  if [ -f "$CEE_CONTRACTS/$schema" ]; then
    cp "$CEE_CONTRACTS/$schema" "contracts/cee/$schema"
    copied=$((copied + 1))
  else
    missing_names+=("$schema")
    missing=$((missing + 1))
    if [ -n "$STRICT" ]; then
      echo "ERROR: $schema not found in $CEE_CONTRACTS"
    else
      echo "WARN: $schema not found in $CEE_CONTRACTS (using local reference copy)"
    fi
  fi
done

# Verify final count matches expected
actual_count=$(ls contracts/cee/*.json 2>/dev/null | wc -l | tr -d ' ')
echo "CEE contracts synced: $copied copied, $missing using local reference"
echo "Schema files in contracts/cee/: $actual_count (expected: $EXPECTED_COUNT)"

if [ -n "$STRICT" ]; then
  if [ "$missing" -gt 0 ]; then
    echo ""
    echo "STRICT MODE: $missing required schema(s) missing from CEE repo:"
    printf '  - %s\n' "${missing_names[@]}"
    echo ""
    echo "Either update the CEE repo to export these schemas,"
    echo "or disable strict mode for local development."
    exit 1
  fi
  if [ "$actual_count" -ne "$EXPECTED_COUNT" ]; then
    echo "ERROR: Expected $EXPECTED_COUNT schemas in contracts/cee/, found $actual_count"
    exit 1
  fi
  echo "All $EXPECTED_COUNT schemas synced successfully."
fi
