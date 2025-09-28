# Rate Limiting curl Examples

## Testing Rate Limits

### Basic Request
```bash
curl -i "http://localhost:3001/stream?sessionId=test-123&scenarioId=sample" \
  -H "Accept: text/event-stream"
```

### Triggering Rate Limit
Execute this command multiple times rapidly to hit the rate limit:

```bash
# Rapid requests to trigger rate limit
for i in {1..105}; do
  curl -i "http://localhost:3001/stream?sessionId=test-$i&scenarioId=sample" \
    -H "Accept: text/event-stream" \
    --max-time 1 &
done
wait
```

### Expected 429 Response
```bash
curl -i "http://localhost:3001/stream?sessionId=test-overflow" \
  -H "Accept: text/event-stream"
```

**Expected Output:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1727520074

{
  "code": "RATE_LIMIT",
  "message": "Rate limit exceeded",
  "retryable": true,
  "timestamp": "2025-09-28T12:30:14.824Z",
  "details": {
    "resetTime": "2025-09-28T12:31:14.824Z",
    "limit": 100,
    "remaining": 0,
    "retryAfterSeconds": 60
  }
}
```

### Respecting Rate Limit Headers
```bash
# Extract retry-after header and wait
RETRY_AFTER=$(curl -s -D- "http://localhost:3001/stream?sessionId=test-limited" \
  -H "Accept: text/event-stream" | grep -i retry-after | cut -d' ' -f2)

echo "Waiting $RETRY_AFTER seconds as advised by Retry-After header..."
sleep $RETRY_AFTER

# Retry after waiting
curl -i "http://localhost:3001/stream?sessionId=test-retry" \
  -H "Accept: text/event-stream"
```

### Monitoring Rate Limit Status
```bash
# Check current rate limit status
curl -i "http://localhost:3001/health" | grep -E "X-RateLimit-|Retry-After"
```

### Working with Rate Limit Headers

#### Extract all rate limit headers:
```bash
curl -s -D- "http://localhost:3001/stream?sessionId=test" \
  -H "Accept: text/event-stream" | grep -E "^(Retry-After|X-RateLimit-)"
```

#### Parse headers in a script:
```bash
#!/bin/bash
RESPONSE=$(curl -s -D- "http://localhost:3001/stream?sessionId=test-headers")

RETRY_AFTER=$(echo "$RESPONSE" | grep -i "retry-after:" | cut -d' ' -f2)
LIMIT=$(echo "$RESPONSE" | grep -i "x-ratelimit-limit:" | cut -d' ' -f2)
REMAINING=$(echo "$RESPONSE" | grep -i "x-ratelimit-remaining:" | cut -d' ' -f2)
RESET=$(echo "$RESPONSE" | grep -i "x-ratelimit-reset:" | cut -d' ' -f2)

echo "Rate Limit Status:"
echo "  Limit: $LIMIT"
echo "  Remaining: $REMAINING"
echo "  Reset at: $(date -d @$RESET)"
if [ ! -z "$RETRY_AFTER" ]; then
  echo "  Retry after: $RETRY_AFTER seconds"
fi
```

## Circuit Breaker Examples

### Triggering Circuit Breaker
```bash
# Cause multiple failures to open circuit breaker
for i in {1..6}; do
  curl -X POST "http://localhost:3001/report" \
    -H "Content-Type: application/json" \
    -d '{"invalid": "data"}' &
done
wait

# This should return 503 Service Unavailable
curl -i -X POST "http://localhost:3001/report" \
  -H "Content-Type: application/json" \
  -d '{"runId": "test"}'
```

### Expected Circuit Breaker Response
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
Retry-After: 60

{
  "code": "BREAKER_OPEN",
  "message": "Circuit breaker is open",
  "retryable": true,
  "timestamp": "2025-09-28T12:30:14.824Z"
}
```

## Queue Management Examples

### Testing Queue Limits
```bash
# Send requests to fill queue
for i in {1..101}; do
  curl -X POST "http://localhost:3001/report" \
    -H "Content-Type: application/json" \
    -d "{\"runId\": \"queue-test-$i\"}" &
done
wait
```

This will demonstrate the reliability mechanisms in action with proper header responses.