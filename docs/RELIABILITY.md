# Reliability Configuration Guide

## Circuit Breaker

The circuit breaker protects against cascading failures by temporarily blocking calls to failing services.

### Configuration

```bash
# Failure threshold before opening
BREAKER_THRESHOLD=5

# Timeout for each call (ms)
BREAKER_TIMEOUT_MS=30000

# Cooldown before trying half-open (ms)
BREAKER_COOLDOWN_MS=60000
```

### Error Mapping

- **BREAKER_OPEN** → HTTP 503 Service Unavailable
- Includes retry-after information

## Back-Pressure & Rate Limiting

Queue management and rate limiting to prevent overload.

### Configuration

```bash
# Maximum queue size
QUEUE_MAX=100

# Maximum concurrent processing
QUEUE_CONCURRENT=10

# Rate limit requests per window
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### Error Mapping

- **RATE_LIMIT** → HTTP 429 Too Many Requests
- Returns SSE `limited` event when triggered
- Includes reset time and remaining quota

### Rate Limit Headers

All 429 responses include standard rate-limiting headers:

- **Retry-After**: Number of seconds to wait before retrying
- **X-RateLimit-Limit**: Total requests allowed per window
- **X-RateLimit-Remaining**: Requests remaining in current window
- **X-RateLimit-Reset**: Unix timestamp when window resets

### Example Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1727520074

{
  "code": "RATE_LIMIT",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
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

## Graceful Shutdown

Clean shutdown with connection draining.

### Configuration

```bash
# Grace period before draining (ms)
SHUTDOWN_GRACE_MS=5000

# Maximum drain time (ms)
SHUTDOWN_DRAIN_MS=30000
```

### Health Status During Shutdown

- Status changes to `"draining"`
- New connections rejected with 503
- Existing streams cancelled gracefully

## Chaos Testing (Dev Only)

Enable with `CHAOS_ENABLE=1` (never in production).

### Endpoints

- `POST /chaos/breaker/open` - Force circuit breaker open
- `POST /chaos/breaker/close` - Force circuit breaker closed
- `POST /chaos/rate-limit` - Trigger rate limit
- `POST /chaos/shutdown` - Initiate graceful shutdown

## Taxonomy Mapping Summary

| Error Code | HTTP Status | Retryable | SSE Event |
|------------|-------------|-----------|-----------|
| TIMEOUT | 408 | ✅ | error |
| RETRYABLE | 503 | ✅ | error |
| INTERNAL | 500 | ✅ | error |
| BAD_INPUT | 400 | ❌ | error |
| RATE_LIMIT | 429 | ✅ | limited |
| BREAKER_OPEN | 503 | ✅ | error |