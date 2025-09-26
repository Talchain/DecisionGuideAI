#!/bin/bash

# Pilot Smoke Tests - Verify PoC is working correctly
set -e

echo "🔍 Running Pilot PoC Smoke Tests..."
echo "=================================="

# Configuration
GATEWAY_URL="http://localhost:3001"
ENGINE_URL="http://localhost:3002"
JOBS_URL="http://localhost:3003"
TEST_SEED=42
TEST_SESSION_ID="smoke_test_$(date +%s)"
TIMEOUT=30

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test result tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
pass_test() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✅ PASS${NC}: $1"
}

fail_test() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}❌ FAIL${NC}: $1"
    if [ -n "$2" ]; then
        echo -e "${RED}   Error: $2${NC}"
    fi
}

warn_test() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

run_test() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo ""
    echo "Test $TESTS_TOTAL: $1"
    echo "----------------------------------------"
}

# Test 1: Service Health Checks
run_test "Service Health Checks"

# Gateway health
if curl -f -s "$GATEWAY_URL/healthz" > /dev/null; then
    pass_test "Gateway health endpoint responding"
else
    fail_test "Gateway health endpoint not responding" "Check if services are running"
fi

# Engine health
if curl -f -s "$ENGINE_URL/healthz" > /dev/null; then
    pass_test "Engine health endpoint responding"
else
    fail_test "Engine health endpoint not responding"
fi

# Jobs health
if curl -f -s "$JOBS_URL/healthz" > /dev/null; then
    pass_test "Jobs health endpoint responding"
else
    fail_test "Jobs health endpoint not responding"
fi

# Test 2: Stream Endpoint Basic Test
run_test "Stream Endpoint Basic Test"

# Test stream connection
STREAM_TEST=$(timeout $TIMEOUT curl -s -N "$GATEWAY_URL/stream?route=critique&seed=$TEST_SEED&sessionId=$TEST_SESSION_ID" | head -n 3)

if echo "$STREAM_TEST" | grep -q "event: start"; then
    pass_test "Stream emits start event"
else
    fail_test "Stream does not emit start event" "$STREAM_TEST"
fi

if echo "$STREAM_TEST" | grep -q '"text"'; then
    pass_test "Stream emits token events"
else
    fail_test "Stream does not emit token events"
fi

# Test 3: Cancel Idempotence
run_test "Cancel Idempotence"

# First cancel (should return 202)
FIRST_CANCEL=$(curl -s -w "%{http_code}" -X POST "$GATEWAY_URL/cancel" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$TEST_SESSION_ID\"}")

if echo "$FIRST_CANCEL" | grep -q "202"; then
    pass_test "First cancel returns 202 Accepted"
else
    fail_test "First cancel should return 202" "Got: $FIRST_CANCEL"
fi

# Second cancel (should return 409)
SECOND_CANCEL=$(curl -s -w "%{http_code}" -X POST "$GATEWAY_URL/cancel" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\": \"$TEST_SESSION_ID\"}")

if echo "$SECOND_CANCEL" | grep -q "409"; then
    pass_test "Second cancel returns 409 Conflict"
else
    warn_test "Second cancel should return 409, got: $SECOND_CANCEL"
fi

# Test 4: Resume Capability
run_test "Resume Capability"

NEW_SESSION_ID="smoke_resume_$(date +%s)"

# Start a stream and capture first few events
INITIAL_STREAM=$(timeout 10 curl -s -N "$GATEWAY_URL/stream?route=critique&seed=$TEST_SEED&sessionId=$NEW_SESSION_ID" | head -n 5)

# Extract an event ID if present
EVENT_ID=$(echo "$INITIAL_STREAM" | grep "id:" | head -n 1 | cut -d' ' -f2)

if [ -n "$EVENT_ID" ]; then
    # Try to resume with Last-Event-ID
    RESUME_STREAM=$(timeout 10 curl -s -N "$GATEWAY_URL/stream?route=critique&seed=$TEST_SEED&sessionId=${NEW_SESSION_ID}_resume" \
        -H "Last-Event-ID: $EVENT_ID" | head -n 3)

    if echo "$RESUME_STREAM" | grep -q "event:"; then
        pass_test "Stream supports resume with Last-Event-ID"
    else
        warn_test "Resume capability unclear"
    fi
else
    warn_test "No event IDs found in stream"
fi

# Test 5: Report Endpoint
run_test "Report Endpoint"

REPORT_RESPONSE=$(curl -s "$GATEWAY_URL/report?scenarioId=demo&seed=$TEST_SEED")

if echo "$REPORT_RESPONSE" | grep -q '"decision"'; then
    pass_test "Report contains decision structure"
else
    fail_test "Report missing decision structure" "$REPORT_RESPONSE"
fi

if echo "$REPORT_RESPONSE" | grep -q '"meta"'; then
    pass_test "Report contains meta structure"
else
    fail_test "Report missing meta structure"
fi

# Test 6: Security Headers
run_test "Security Headers"

# Check Cache-Control header
HEADERS=$(curl -s -I "$GATEWAY_URL/report?scenarioId=demo&seed=$TEST_SEED")

if echo "$HEADERS" | grep -qi "cache-control.*no-store"; then
    pass_test "Cache-Control: no-store header present"
else
    fail_test "Cache-Control: no-store header missing"
fi

if echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
    pass_test "CORS headers present"
else
    fail_test "CORS headers missing"
fi

# Test 7: Deterministic Replay
run_test "Deterministic Replay"

REPLAY_SESSION_ID="smoke_replay_$(date +%s)"

# Run same scenario twice with same seed
FIRST_RUN=$(timeout 15 curl -s -N "$GATEWAY_URL/stream?route=critique&seed=$TEST_SEED&sessionId=${REPLAY_SESSION_ID}_1" | head -n 10)
sleep 2
SECOND_RUN=$(timeout 15 curl -s -N "$GATEWAY_URL/stream?route=critique&seed=$TEST_SEED&sessionId=${REPLAY_SESSION_ID}_2" | head -n 10)

# Extract token content for comparison
FIRST_TOKENS=$(echo "$FIRST_RUN" | grep '"text"' | head -n 3)
SECOND_TOKENS=$(echo "$SECOND_RUN" | grep '"text"' | head -n 3)

if [ "$FIRST_TOKENS" = "$SECOND_TOKENS" ] && [ -n "$FIRST_TOKENS" ]; then
    pass_test "Deterministic replay produces identical tokens"
else
    warn_test "Deterministic replay unclear or not identical"
fi

# Test 8: Performance Baseline
run_test "Performance Baseline"

# Measure TTFF (Time to First Token)
START_TIME=$(date +%s%3N)
FIRST_TOKEN_STREAM=$(timeout 10 curl -s -N "$GATEWAY_URL/stream?route=critique&seed=$TEST_SEED&sessionId=smoke_perf_$(date +%s)" | head -n 5)
END_TIME=$(date +%s%3N)

TTFF=$((END_TIME - START_TIME))

if [ $TTFF -lt 500 ]; then
    pass_test "TTFF under 500ms: ${TTFF}ms"
elif [ $TTFF -lt 1000 ]; then
    warn_test "TTFF acceptable but slow: ${TTFF}ms"
else
    fail_test "TTFF too slow: ${TTFF}ms (target: <500ms)"
fi

# Final Results
echo ""
echo "🏁 Smoke Test Results"
echo "===================="
echo "Tests Run: $TESTS_TOTAL"
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Warnings: Generated inline"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    echo ""
    echo "🎯 Pilot PoC is ready for demo"
    echo "🔧 Management commands available in pilot-deploy/scripts/"
    exit 0
else
    echo -e "${RED}❌ $TESTS_FAILED test(s) failed${NC}"
    echo ""
    echo "🚨 Please fix issues before proceeding"
    echo "📖 Check RUNBOOK.md for troubleshooting"
    exit 1
fi