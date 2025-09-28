# Contract Wall API - cURL Collection

This collection provides ready-to-use cURL commands for testing the Contract Wall API endpoints.

## Base Configuration

```bash
BASE_URL="http://localhost:3001"
# For production: BASE_URL="https://api.decisionguide.ai"
```

## 1. Health Check

```bash
# Get system health status
curl -s "${BASE_URL}/health" | jq '.'

# Expected response includes: status, p95_ms, replay, test_routes_enabled
```

## 2. SSE Stream (Analysis)

```bash
# Start analysis stream with seed
curl -svN -H "Accept: text/event-stream" \
  "${BASE_URL}/stream?seed=demo-seed-123"

# Resume stream (once only)
curl -svN -H "Accept: text/event-stream" \
  -H "Last-Event-ID: evt-1" \
  "${BASE_URL}/stream?seed=demo-seed-123&resume=1"

# Expected events: hello, token, cost, done, cancelled, limited, error
```

## 3. Cancel Analysis

```bash
# Cancel analysis job (fast response expected)
curl -sS -X POST "${BASE_URL}/cancel" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"demo-job-123"}' | jq '.'

# Second cancel (idempotent)
curl -sS -X POST "${BASE_URL}/cancel" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"demo-job-123"}' | jq '.'
```

## 4. Jobs Queue Stream

```bash
# Monitor job processing
curl -svN -H "Accept: text/event-stream" \
  "${BASE_URL}/jobs/stream?jobId=demo-job-456"

# Expected events: hello, token, done
```

## 5. Cancel Job

```bash
# Cancel background job
curl -sS -X POST "${BASE_URL}/jobs/cancel" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"demo-job-456"}' | jq '.'

# Expected: cancelled=true, previousStatus, timestamp
```

## 6. Submit Report

```bash
# Submit report.v1 with meta.seed
curl -sS -X POST "${BASE_URL}/report" \
  -H "Content-Type: application/json" \
  -d '{
    "seed": "report-seed-789",
    "nodes": 5,
    "title": "Demo Analysis Report",
    "summary": "This is a test report for validation"
  }' | jq '.'

# Expected: schema="report.v1", meta.seed echoed, reportId generated
```

## Error Testing

```bash
# Missing required parameter
curl -sS "${BASE_URL}/stream" | jq '.'
# Expected: 400 BAD_INPUT

# Missing jobId
curl -sS -X POST "${BASE_URL}/cancel" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
# Expected: 400 BAD_INPUT

# Invalid report
curl -sS -X POST "${BASE_URL}/report" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}' | jq '.'
# Expected: 422 validation errors
```

## Performance Testing

```bash
# Measure response times
time curl -sS "${BASE_URL}/health" > /dev/null

# Check P95 performance
for i in {1..10}; do
  time curl -sS "${BASE_URL}/health" > /dev/null
done
```

## Security Testing

```bash
# XSS attempt (should be sanitized)
curl -sS "${BASE_URL}/stream?seed=%3Cscript%3Ealert(1)%3C%2Fscript%3E"

# Large payload test
curl -sS -X POST "${BASE_URL}/report" \
  -H "Content-Type: application/json" \
  -d '{"seed":"test","data":"'$(printf 'x%.0s' {1..8192})'"}' | jq '.'
```

## Notes

- All endpoints support CORS with wildcard origin
- SSE streams emit only frozen event types: hello, token, cost, done, cancelled, limited, error
- Resume functionality is limited to once per session
- Cancel operations are idempotent and fast (≤150ms expected)
- Report submissions must include "schema":"report.v1" and echo meta.seed
- Health endpoint includes all required contract keys
- Error responses follow taxonomy: TIMEOUT→408, RETRYABLE→503, INTERNAL→500, BAD_INPUT→400, RATE_LIMIT→429, BREAKER_OPEN→503