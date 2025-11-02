#!/usr/bin/env bash
set -euo pipefail

# Bundle Flag Check (Phase A)
# Verifies that PLoT V1 feature flags are present in build artifacts
# Usage: npm run build && ./scripts/check-bundle-flags.sh

REQUIRED_FLAGS=(
  "VITE_FEATURE_PLOT_STREAM"
  "VITE_FEATURE_COMPARE_DEBUG"
  "VITE_FEATURE_INSPECTOR_DEBUG"
)

DIST_DIR="dist/assets"
MISSING_FLAGS=()

echo "🔍 Checking build artifacts for feature flags..."

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Error: dist/assets directory not found. Run 'npm run build' first."
  exit 1
fi

for flag in "${REQUIRED_FLAGS[@]}"; do
  echo "  Checking for $flag..."

  # Search for flag in all JS files (case-insensitive to catch minified variants)
  if grep -riq "$flag" "$DIST_DIR"/*.js 2>/dev/null; then
    echo "  ✅ Found $flag"
  else
    echo "  ❌ Missing $flag"
    MISSING_FLAGS+=("$flag")
  fi
done

if [ ${#MISSING_FLAGS[@]} -eq 0 ]; then
  echo ""
  echo "✅ All required feature flags present in bundle"
  exit 0
else
  echo ""
  echo "❌ Missing flags: ${MISSING_FLAGS[*]}"
  echo ""
  echo "Ensure these environment variables are set during build:"
  for flag in "${MISSING_FLAGS[@]}"; do
    echo "  export $flag=1"
  done
  exit 1
fi
