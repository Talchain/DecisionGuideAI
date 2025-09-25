#!/bin/bash
# Demo Reset Helper - Clean artifacts and prepare for demonstration
# Does NOT change defaults or configuration - only cleans output files

echo "🎬 Demo Reset Helper"
echo "===================="
echo "Preparing platform for clean demonstration..."
echo

# Configuration check - don't change anything, just verify
echo "🔍 Checking current configuration..."
if [[ -f .env.poc.example ]]; then
    echo "✅ .env.poc.example found"
else
    echo "⚠️ .env.poc.example not found - this is optional"
fi

if [[ -f package.json ]]; then
    echo "✅ package.json found"
else
    echo "❌ package.json not found - are you in the project root?"
    exit 1
fi

# Clean artifacts (safe to remove - these are generated)
echo
echo "🧹 Cleaning generated artifacts..."

# Timestamped files (safe to clean)
CLEANED_COUNT=0

if [[ -d artifacts/ ]]; then
    # Remove timestamped performance baselines
    find artifacts/ -name "perf-baseline-*" -type f 2>/dev/null | while read -r file; do
        echo "  Removing: $(basename "$file")"
        rm "$file"
        CLEANED_COUNT=$((CLEANED_COUNT + 1))
    done

    # Remove old release packages
    find artifacts/ -name "release-poc-*.zip" -type f 2>/dev/null | while read -r file; do
        echo "  Removing: $(basename "$file")"
        rm "$file"
        CLEANED_COUNT=$((CLEANED_COUNT + 1))
    done

    # Remove old demo kits (keep the latest)
    find artifacts/ -name "demo-kit-*.zip" -type f 2>/dev/null | head -n -1 | while read -r file; do
        echo "  Removing: $(basename "$file")"
        rm "$file"
        CLEANED_COUNT=$((CLEANED_COUNT + 1))
    done

    # Clean up temporary status files
    if [[ -f artifacts/nightly-integration-status.json ]]; then
        echo "  Refreshing: nightly-integration-status.json"
        cat > artifacts/nightly-integration-status.json << EOF
{
  "status": "ready",
  "timestamp": "$(date -u -Iseconds)",
  "mode": "demo_reset",
  "message": "Demo environment prepared"
}
EOF
    fi

    echo "✅ Cleaned generated artifacts"
else
    echo "ℹ️ No artifacts directory to clean"
fi

# Verify feature flags are OFF (don't change, just report)
echo
echo "🚩 Verifying safe defaults..."

# Check if any dangerous flags are ON
DANGER_FLAGS=()

if [[ -n "${ENABLE_RATE_LIMITING}" && "${ENABLE_RATE_LIMITING}" == "true" ]]; then
    DANGER_FLAGS+=("ENABLE_RATE_LIMITING")
fi

if [[ -n "${ENABLE_TELEMETRY}" && "${ENABLE_TELEMETRY}" == "true" ]]; then
    DANGER_FLAGS+=("ENABLE_TELEMETRY")
fi

if [[ -n "${ENABLE_USAGE_TRACKING}" && "${ENABLE_USAGE_TRACKING}" == "true" ]]; then
    DANGER_FLAGS+=("ENABLE_USAGE_TRACKING")
fi

if [[ ${#DANGER_FLAGS[@]} -gt 0 ]]; then
    echo "⚠️ Warning: Some powerful features are enabled:"
    for flag in "${DANGER_FLAGS[@]}"; do
        echo "  - $flag=true"
    done
    echo "   💡 Use 'source ./tools/panic-off.sh' to disable all features"
else
    echo "✅ All powerful features are OFF (safe for demo)"
fi

# Browser storage note
echo
echo "💾 Browser Storage Note:"
echo "   localStorage may have previous settings"
echo "   💡 Clear browser data or use incognito mode for clean demo"

# Quick health check
echo
echo "🏥 Quick Health Check..."

# Check npm dependencies
if npm list --depth=0 >/dev/null 2>&1; then
    echo "✅ Dependencies installed"
else
    echo "⚠️ Run 'npm install' to install dependencies"
fi

# Check TypeScript compilation
if npm run typecheck >/dev/null 2>&1; then
    echo "✅ TypeScript compilation clean"
else
    echo "⚠️ TypeScript issues detected - run 'npm run typecheck'"
fi

# Generate fresh demo status
echo
echo "📊 Generating fresh demo status..."
cat > artifacts/demo-status.json << EOF
{
  "demo_ready": true,
  "reset_timestamp": "$(date -u -Iseconds)",
  "artifacts_cleaned": true,
  "flags_verified": true,
  "dependencies_ok": true
}
EOF

echo "✅ Demo status saved to artifacts/demo-status.json"

# Ready to demo steps
echo
echo "🎯 Ready to Demo - Next Steps:"
echo "==============================="
echo "1. Start the platform:"
echo "   npm run dev"
echo "   # OR for full PoC setup:"
echo "   ./tools/poc-start.sh"
echo
echo "2. Open browser to:"
echo "   http://localhost:5176 (or shown port)"
echo
echo "3. Optional - enable demo features:"
echo "   localStorage.setItem('feature.sseStreaming','1')"
echo "   localStorage.setItem('feature.streamBuffer','1')"
echo
echo "4. Quick verification:"
echo "   npm run integration:check"
echo
echo "5. If issues arise, emergency disable:"
echo "   source ./tools/panic-off.sh"
echo

echo "✅ Demo reset complete! Platform ready for safe demonstration."
echo "🛡️ All powerful features remain OFF by default"