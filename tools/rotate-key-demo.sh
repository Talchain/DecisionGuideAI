#!/bin/bash
# API Key Rotation Demo - Safe Overlap Window Simulation
# Demonstrates zero-downtime key rotation with old/new key overlap

echo "🔄 API Key Rotation Demo"
echo "=========================="
echo "Simulating safe key rotation with overlap window"
echo

# Configuration
OLD_KEY="demo-old-key-abc123"
NEW_KEY="demo-new-key-xyz789"
OVERLAP_DURATION="30 seconds"

echo "📋 Current Configuration:"
echo "  Old Key: ${OLD_KEY}"
echo "  New Key: ${NEW_KEY}"
echo "  Overlap Duration: ${OVERLAP_DURATION}"
echo

# Phase 1: Single Key Active
echo "Phase 1: Single Key Operation"
echo "------------------------------"
echo "✅ OLD_KEY active and accepting requests"
echo "❌ NEW_KEY not yet deployed"
echo
echo "Simulating requests with old key..."
echo "  Request 1: curl -H 'Authorization: Bearer ${OLD_KEY}' /api/analysis"
echo "  → Status: 200 OK ✅"
echo "  Request 2: curl -H 'Authorization: Bearer ${OLD_KEY}' /api/analysis/ana_001"
echo "  → Status: 200 OK ✅"
echo

# Phase 2: Deploy New Key (Overlap Begins)
echo "Phase 2: Deploy New Key (Overlap Window Starts)"
echo "------------------------------------------------"
echo "✅ OLD_KEY still active"
echo "✅ NEW_KEY now active"
echo "🟡 Both keys accepting requests during overlap"
echo
echo "Simulating requests with both keys..."
echo "  Request 3: curl -H 'Authorization: Bearer ${OLD_KEY}' /api/analysis"
echo "  → Status: 200 OK ✅ (old key still works)"
echo "  Request 4: curl -H 'Authorization: Bearer ${NEW_KEY}' /api/analysis"
echo "  → Status: 200 OK ✅ (new key works too)"
echo "  Request 5: curl -H 'Authorization: Bearer invalid-key' /api/analysis"
echo "  → Status: 401 Unauthorized ❌ (invalid keys rejected)"
echo

# Phase 3: Verify New Key Adoption
echo "Phase 3: Monitor New Key Adoption (${OVERLAP_DURATION})"
echo "--------------------------------------------------------"
echo "Waiting for clients to adopt new key..."
echo
for i in {1..6}; do
    echo "  [$i/6] Checking usage patterns..."
    echo "    Old key requests: $((20 - i * 3))"
    echo "    New key requests: $((i * 3))"
    sleep 0.5
done
echo
echo "✅ New key adoption complete: 100% of requests using new key"
echo

# Phase 4: Disable Old Key
echo "Phase 4: Disable Old Key (Overlap Window Ends)"
echo "-----------------------------------------------"
echo "❌ OLD_KEY disabled"
echo "✅ NEW_KEY continues active"
echo
echo "Simulating requests after old key disabled..."
echo "  Request 6: curl -H 'Authorization: Bearer ${OLD_KEY}' /api/analysis"
echo "  → Status: 401 Unauthorized ❌ (old key now rejected)"
echo "  Request 7: curl -H 'Authorization: Bearer ${NEW_KEY}' /api/analysis"
echo "  → Status: 200 OK ✅ (new key continues working)"
echo

# Summary
echo "🎉 Key Rotation Complete"
echo "========================"
echo "✅ Zero downtime achieved"
echo "✅ All requests successfully handled during transition"
echo "✅ Old key safely disabled"
echo "✅ Security improved with new key"
echo

# Best Practices Summary
echo "🛡️  Best Practices Demonstrated:"
echo "  1. Always maintain overlap window for zero downtime"
echo "  2. Monitor key usage before disabling old keys"
echo "  3. Verify new key works before disabling old key"
echo "  4. Have rollback plan (can re-enable old key if needed)"
echo "  5. Log all authentication attempts during rotation"
echo

# Rollback Scenario
echo "🚨 Rollback Scenario (if needed):"
echo "  If new key fails: re-enable old key immediately"
echo "  Command: export API_KEY_PRIMARY=\"${OLD_KEY}\""
echo "  Impact: Instant fallback to working authentication"
echo

echo "Demo completed successfully! 🎯"