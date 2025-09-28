# Safety Limits UAT Checklist

**Purpose**: User acceptance testing for scenario validation, rate limits, and safety features

## 🎯 Objective

Verify that safety limits are correctly enforced with appropriate error messages and consistent taxonomy.

## 📋 Environment Setup

### Prerequisites
- [ ] Pilot services running: `cd pilot-deploy && ./scripts/pilot-up.sh`
- [ ] Health check passes: `curl http://localhost:3001/healthz`
- [ ] Environment variables configured (or using defaults):
  - `MAX_NODES=12` (default)
  - `WARN_NODES=10` (default)
  - `RATE_LIMIT_RPM=60` (default)
  - `DAILY_BUDGET_TOKENS=50000` (default)

### Testing Tools
- cURL command line
- Browser for UI testing
- Multiple terminal sessions for rate limit testing

## 🧪 Test Scenarios

### Test 1: Scenario Node Validation (5 minutes)

**Objective**: Verify MAX_NODES enforcement

#### 1.1 Valid Scenario (Under Limit)
```bash
curl -X POST http://localhost:3001/templates/encode \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "scenario": {
        "title": "Valid Small Scenario",
        "options": [
          {"id": "a", "name": "Option A"},
          {"id": "b", "name": "Option B"},
          {"id": "c", "name": "Option C"}
        ],
        "stakeholders": ["Product", "Engineering"],
        "constraints": {"budget": "£100k", "timeline": "6 months"},
        "success_metrics": ["Metric 1", "Metric 2"]
      }
    }
  }'
```

**Expected Result**: ✅ HTTP 200, successful encoding
**Node Count**: 8 nodes (3 options + 2 stakeholders + 2 constraints + 2 metrics)

#### 1.2 Scenario at Exact Limit
```bash
curl -X POST http://localhost:3001/templates/encode \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "scenario": {
        "title": "Exact Limit Scenario",
        "options": [
          {"id": "opt1", "name": "Option 1"},
          {"id": "opt2", "name": "Option 2"},
          {"id": "opt3", "name": "Option 3"},
          {"id": "opt4", "name": "Option 4"},
          {"id": "opt5", "name": "Option 5"},
          {"id": "opt6", "name": "Option 6"},
          {"id": "opt7", "name": "Option 7"},
          {"id": "opt8", "name": "Option 8"},
          {"id": "opt9", "name": "Option 9"},
          {"id": "opt10", "name": "Option 10"},
          {"id": "opt11", "name": "Option 11"},
          {"id": "opt12", "name": "Option 12"}
        ]
      }
    }
  }'
```

**Expected Result**: ✅ HTTP 200, successful encoding
**Node Count**: 12 nodes (exactly at limit)

#### 1.3 Scenario Over Limit
```bash
curl -X POST http://localhost:3001/templates/encode \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "scenario": {
        "title": "Over Limit Scenario",
        "options": [
          {"id": "opt1", "name": "Option 1"},
          {"id": "opt2", "name": "Option 2"},
          {"id": "opt3", "name": "Option 3"},
          {"id": "opt4", "name": "Option 4"},
          {"id": "opt5", "name": "Option 5"},
          {"id": "opt6", "name": "Option 6"},
          {"id": "opt7", "name": "Option 7"},
          {"id": "opt8", "name": "Option 8"},
          {"id": "opt9", "name": "Option 9"},
          {"id": "opt10", "name": "Option 10"},
          {"id": "opt11", "name": "Option 11"},
          {"id": "opt12", "name": "Option 12"},
          {"id": "opt13", "name": "Option 13"}
        ]
      }
    }
  }'
```

**Expected Result**: ❌ HTTP 400, BAD_INPUT error
**Expected Message**: "Scenario too large for pilot (12-node cap)"
**Node Count**: 13 nodes (over limit)

### Test 2: Rate Limiting (RPM) (10 minutes)

**Objective**: Verify requests per minute enforcement

#### 2.1 Burst Test (Exceeding RPM)
Create a test script to make rapid requests:

```bash
#!/bin/bash
echo "Testing RPM limit..."

for i in {1..65}; do
  echo "Request $i:"
  curl -s -w "HTTP %{http_code} - Time: %{time_total}s\n" \
    -X POST http://localhost:3001/compare \
    -H "Content-Type: application/json" \
    -d '{
      "left": {"scenarioId": "test-left", "seed": 42},
      "right": {"scenarioId": "test-right", "seed": 17}
    }' | head -1

  # Small delay to see progression
  sleep 0.1
done
```

**Expected Results**:
- First 60 requests: ✅ HTTP 200
- Requests 61+: ❌ HTTP 429, RATE_LIMIT error
- Response includes `Retry-After` header
- Error message: "Rate limit exceeded: 60 requests per minute"

#### 2.2 Wait and Retry Test
After hitting rate limit:

```bash
# Wait for rate limit window to pass
sleep 60

# Should work again
curl -X POST http://localhost:3001/compare \
  -H "Content-Type: application/json" \
  -d '{
    "left": {"scenarioId": "test-left", "seed": 42},
    "right": {"scenarioId": "test-right", "seed": 17}
  }'
```

**Expected Result**: ✅ HTTP 200 (rate limit window reset)

### Test 3: Daily Token Budget (15 minutes)

**Objective**: Verify daily token budget enforcement

#### 3.1 Lower Token Budget for Testing
Set a low token budget temporarily:

```bash
# In pilot-deploy/.env.poc
echo "DAILY_BUDGET_TOKENS=100" >> .env.poc

# Restart services
./scripts/pilot-down.sh
./scripts/pilot-up.sh
```

#### 3.2 Consume Token Budget
```bash
# Make requests with estimated token usage
for i in {1..5}; do
  echo "Token test $i:"
  curl -s -w "HTTP %{http_code}\n" \
    -X POST http://localhost:3001/compare \
    -H "Content-Type: application/json" \
    -d '{
      "left": {"scenarioId": "large-scenario", "seed": 42},
      "right": {"scenarioId": "large-scenario", "seed": 17}
    }' | tail -1
done
```

**Expected Results**:
- Initial requests: ✅ HTTP 200
- When budget exceeded: ❌ HTTP 429, RATE_LIMIT error
- Error message: "Daily token budget exceeded: 100 tokens per day"

#### 3.3 Reset Token Budget
```bash
# Remove custom token budget
sed -i '' '/DAILY_BUDGET_TOKENS/d' pilot-deploy/.env.poc
./scripts/pilot-down.sh
./scripts/pilot-up.sh
```

### Test 4: SSE "Limited" Events (5 minutes)

**Objective**: Verify SSE streams emit "limited" events when rate limited

#### 4.1 Rate Limited SSE Stream
```bash
# First, exceed rate limit with regular requests
for i in {1..65}; do
  curl -s http://localhost:3001/healthz > /dev/null
done

# Then try SSE stream
curl -N "http://localhost:3001/stream?route=critique&seed=42&scenarioId=test" \
  -H "Accept: text/event-stream"
```

**Expected Result**: SSE event with type "limited"
```
data: {"type":"limited","data":{"message":"Rate limit exceeded","timestamp":"..."}}
```

### Test 5: Error Taxonomy Consistency (10 minutes)

**Objective**: Verify consistent error response format across all endpoints

#### 5.1 Test All Error Types
```bash
# BAD_INPUT - Missing required field
curl -X POST http://localhost:3001/compare \
  -H "Content-Type: application/json" \
  -d '{}'

# RATE_LIMIT - After exceeding limits
# (Use rate limit test from above)

# BAD_INPUT - Invalid template structure
curl -X POST http://localhost:3001/templates/encode \
  -H "Content-Type: application/json" \
  -d '{"template": {"invalid": "structure"}}'
```

**Expected Error Format** (all endpoints):
```json
{
  "type": "BAD_INPUT|RATE_LIMIT|INTERNAL_ERROR",
  "message": "Human-readable error description",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```

### Test 6: Multiple Origins (5 minutes)

**Objective**: Verify rate limits are enforced per origin

#### 6.1 Different Origin Headers
```bash
# Origin 1 - hit rate limit
for i in {1..61}; do
  curl -s -H "Origin: http://localhost:3000" \
    http://localhost:3001/healthz > /dev/null
done

# Origin 2 - should still work
curl -w "HTTP %{http_code}\n" \
  -H "Origin: http://localhost:5173" \
  http://localhost:3001/healthz
```

**Expected Results**:
- Origin 1: ❌ Rate limited
- Origin 2: ✅ Still allowed (separate limit)

### Test 7: Health Metrics (5 minutes)

**Objective**: Verify rate limit metrics are exposed

#### 7.1 Check Health Endpoint
```bash
curl http://localhost:3001/healthz | jq .
```

**Expected Response** (should include rate limit metrics):
```json
{
  "status": "healthy",
  "version": "v0.1.0-pilot",
  "timestamp": "...",
  "metrics": {
    "rate_limit.refusals": 0
  }
}
```

## 🔧 Custom Environment Testing

### Test with Custom Limits
```bash
# Set stricter limits for testing
echo "MAX_NODES=5" >> pilot-deploy/.env.poc
echo "RATE_LIMIT_RPM=10" >> pilot-deploy/.env.poc
echo "DAILY_BUDGET_TOKENS=200" >> pilot-deploy/.env.poc

# Restart and test
./scripts/pilot-down.sh
./scripts/pilot-up.sh

# Test with new limits
curl -X POST http://localhost:3001/templates/encode \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "scenario": {
        "title": "Test",
        "options": [
          {"id": "a", "name": "A"},
          {"id": "b", "name": "B"},
          {"id": "c", "name": "C"},
          {"id": "d", "name": "D"},
          {"id": "e", "name": "E"},
          {"id": "f", "name": "F"}
        ]
      }
    }
  }'
```

**Expected Result**: ❌ HTTP 400, "Scenario too large for pilot (5-node cap)"

### Restore Defaults
```bash
# Remove custom settings
sed -i '' '/MAX_NODES/d' pilot-deploy/.env.poc
sed -i '' '/RATE_LIMIT_RPM/d' pilot-deploy/.env.poc
sed -i '' '/DAILY_BUDGET_TOKENS/d' pilot-deploy/.env.poc

./scripts/pilot-down.sh
./scripts/pilot-up.sh
```

## 📊 UAT Results Template

```
Safety Limits UAT Results
========================
Date: [YYYY-MM-DD]
Tester: [Name]
Environment: [Local/Remote]

Test Results:
✅/❌ Scenario Node Validation: [PASS/FAIL]
  - Under limit (8 nodes): [PASS/FAIL]
  - At limit (12 nodes): [PASS/FAIL]
  - Over limit (13 nodes): [PASS/FAIL - Expected HTTP 400]

✅/❌ Rate Limiting (RPM): [PASS/FAIL]
  - First 60 requests: [PASS/FAIL]
  - Request 61+: [PASS/FAIL - Expected HTTP 429]
  - Window reset: [PASS/FAIL]

✅/❌ Daily Token Budget: [PASS/FAIL]
  - Budget enforcement: [PASS/FAIL - Expected HTTP 429]
  - Error message: [PASS/FAIL]

✅/❌ SSE Limited Events: [PASS/FAIL]
  - Limited event emitted: [PASS/FAIL]
  - Correct event format: [PASS/FAIL]

✅/❌ Error Taxonomy: [PASS/FAIL]
  - Consistent format: [PASS/FAIL]
  - Appropriate types: [PASS/FAIL]
  - Timestamps present: [PASS/FAIL]

✅/❌ Multiple Origins: [PASS/FAIL]
  - Per-origin limits: [PASS/FAIL]
  - Isolation working: [PASS/FAIL]

✅/❌ Health Metrics: [PASS/FAIL]
  - Metrics exposed: [PASS/FAIL]
  - Accurate counts: [PASS/FAIL]

Overall Assessment: 🟢/🟡/🔴
Demo Ready: YES/NO

Issues Found:
- [Any issues or concerns]

Next Steps:
- [Any follow-up actions needed]

Signed: [UAT Lead] | Date: [YYYY-MM-DD]
```

## 🚨 Common Issues and Fixes

### Issue: Rate Limits Not Enforcing
**Symptoms**: All requests return 200 even after exceeding limits
**Check**: Environment variables correctly set and services restarted
**Fix**: Verify `RATE_LIMIT_RPM` and restart pilot services

### Issue: Node Count Wrong
**Symptoms**: Templates with 10 nodes rejected with "too large" error
**Check**: Node counting logic in validation
**Debug**: Add logging to see actual node count vs limit

### Issue: Origins Not Isolated
**Symptoms**: Rate limiting affects all origins together
**Check**: `Origin`, `X-Forwarded-For`, or `X-Real-IP` headers
**Fix**: Ensure origin detection is working correctly

### Issue: Error Format Inconsistent
**Symptoms**: Some endpoints return different error structures
**Check**: All endpoints using same error response builder
**Fix**: Standardise error handling across all endpoints

## 🔗 Related Documentation

- **Integration Harness**: `../tools/README.md`
- **OpenAPI Specification**: `../openapi.yaml`
- **Compare API Guide**: `../reports/compare-api.md`
- **Share Links Examples**: `../templates/sharelink-examples.md`

---

**Testing Time**: ~45 minutes
**Prerequisites**: Pilot deployment running
**Tools**: cURL, browser, multiple terminals
**Success Criteria**: All safety limits enforced with consistent errors