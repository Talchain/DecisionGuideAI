# Error Mapping Guide

## Quick Reference

| Error Code | HTTP Status | Retryable | SSE Event | Retry Guidance | Category |
|------------|-------------|-----------|-----------|----------------|----------|
| `BAD_INPUT` | 400 | ❌ | `error` | **No** - Fix request first | Client |
| `TIMEOUT` | 408 | ✅ | `error` | **Backoff** - Exponential, max 2 attempts | Network |
| `RATE_LIMIT` | 429 | ✅ | `limited` | **Yes** - Wait for Retry-After | Rate Limit |
| `INTERNAL` | 500 | ✅ | `error` | **Backoff** - Exponential, max 3 attempts | Server |
| `RETRYABLE` | 503 | ✅ | `error` | **Yes** - Brief delay then retry | Server |
| `BREAKER_OPEN` | 503 | ✅ | `error` | **Yes** - Wait for cooldown period | Server |

## Error Response Format

All errors follow this standard format:
```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable description",
  "retryable": true,
  "timestamp": "2025-09-28T12:30:14.824Z",
  "details": {
    "key": "value"
  }
}
```

## Client Error (400) - BAD_INPUT

**When to use:** Invalid input, malformed requests, validation failures

**Common scenarios:**
- Missing required parameters
- Invalid parameter format
- Schema validation failures
- Invalid UUIDs or identifiers

**Example responses:**
```json
{
  "code": "BAD_INPUT",
  "message": "Required field missing: sessionId",
  "retryable": false,
  "timestamp": "2025-09-28T12:30:14.824Z",
  "details": {
    "field": "sessionId",
    "type": "required"
  }
}
```

**SSE counterpart:**
```
event: error
data: {"code":"BAD_INPUT","message":"Required field missing: sessionId","retryable":false}
```

**Client action:** Fix request and retry

**curl example:**
```bash
# Bad request - missing sessionId
curl -i "http://localhost:3001/stream?scenarioId=test" \
  -H "Accept: text/event-stream"

# Expected: HTTP/1.1 400 Bad Request
```

**Node.js example:**
```javascript
// Error handling
try {
  const response = await fetch('/stream?sessionId=&scenarioId=test');
  if (!response.ok) {
    const error = await response.json();
    if (error.code === 'BAD_INPUT' && !error.retryable) {
      console.log('Fix request parameters:', error.details);
      // Don't retry - fix the request first
    }
  }
} catch (err) {
  console.error('Request failed:', err);
}
```

## Network Error (408) - TIMEOUT

**When to use:** Operations that exceed configured time limits

**Common scenarios:**
- SSE stream establishment timeout
- Analysis processing timeout
- Database query timeout

**Example responses:**
```json
{
  "code": "TIMEOUT",
  "message": "Analysis timed out after 30 seconds",
  "retryable": true,
  "timestamp": "2025-09-28T12:30:14.824Z"
}
```

**SSE counterpart:**
```
event: error
data: {"code":"TIMEOUT","message":"Analysis timed out after 30 seconds","retryable":true}
```

**Client action:** Retry with exponential backoff (max 2 attempts)

**curl example:**
```bash
# Long-running request that may timeout
curl -i "http://localhost:3001/stream?sessionId=test-timeout&scenarioId=complex" \
  -H "Accept: text/event-stream" \
  --max-time 5

# Expected: HTTP/1.1 408 Request Timeout (if server times out)
```

**Node.js example:**
```javascript
// Timeout with retry logic
async function retryWithBackoff(url, maxAttempts = 2) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000) // 30s timeout
      });
      return response;
    } catch (err) {
      if (err.name === 'TimeoutError' && attempt < maxAttempts - 1) {
        const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
        console.log(`Timeout on attempt ${attempt + 1}, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}
```

## Rate Limit Error (429) - RATE_LIMIT

**When to use:** Request rate exceeds configured limits

**Required headers:**
- `Retry-After`: Seconds to wait
- `X-RateLimit-Limit`: Total allowed requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp of reset

**Example responses:**
```json
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

**SSE counterpart:**
```
event: limited
data: {"code":"RATE_LIMIT","resetTime":"2025-09-28T12:31:14.824Z","remaining":0,"limit":100}
```

**Client action:** Wait for `Retry-After` seconds then retry

**curl example:**
```bash
# Trigger rate limit with rapid requests
for i in {1..105}; do
  curl -i "http://localhost:3001/stream?sessionId=test-$i&scenarioId=sample" \
    -H "Accept: text/event-stream" \
    --max-time 1 &
done
wait

# Expected headers on 429 response:
# HTTP/1.1 429 Too Many Requests
# Retry-After: 60
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 0
# X-RateLimit-Reset: 1727520074
```

**Node.js example:**
```javascript
// Rate limit handling with proper headers
async function handleRateLimit(response) {
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After')) * 1000; // Convert to ms
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const resetTime = new Date(parseInt(response.headers.get('X-RateLimit-Reset')) * 1000);

    console.log(`Rate limited: ${remaining}/${limit} remaining, resets at ${resetTime}`);
    console.log(`Waiting ${retryAfter/1000} seconds before retry...`);

    await new Promise(resolve => setTimeout(resolve, retryAfter));
    return true; // Should retry
  }
  return false;
}

// Usage
const response = await fetch('/stream?sessionId=test');
if (await handleRateLimit(response)) {
  // Retry the request
  const retryResponse = await fetch('/stream?sessionId=test');
}
```

**Complete 429 response example:**
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

## Server Error (500) - INTERNAL

**When to use:** Unexpected internal conditions, unhandled exceptions

**Common scenarios:**
- Database connection failures
- Unhandled exceptions
- Configuration errors
- Third-party service failures

**Example responses:**
```json
{
  "code": "INTERNAL",
  "message": "An internal error occurred while processing the request",
  "retryable": true,
  "timestamp": "2025-09-28T12:30:14.824Z"
}
```

**SSE counterpart:**
```
event: error
data: {"code":"INTERNAL","message":"An internal error occurred while processing the request","retryable":true}
```

**Client action:** Retry with exponential backoff

**curl example:**
```bash
# Internal errors typically occur unpredictably
curl -i "http://localhost:3001/stream?sessionId=test-internal&scenarioId=sample" \
  -H "Accept: text/event-stream"

# Expected: HTTP/1.1 500 Internal Server Error (occasionally)
```

**Node.js example:**
```javascript
// Internal error retry with backoff
async function retryInternalError(url, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 500) {
        const error = await response.json();
        if (error.code === 'INTERNAL' && error.retryable && attempt < maxAttempts - 1) {
          const delay = 1000 * Math.pow(2, attempt); // Exponential backoff
          console.log(`Internal error on attempt ${attempt + 1}, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
    }
  }
}
```

## Service Unavailable (503) - RETRYABLE

**When to use:** Temporary service unavailability

**Common scenarios:**
- Maintenance mode
- Overload conditions
- Dependency unavailability
- Graceful degradation

**Example responses:**
```json
{
  "code": "RETRYABLE",
  "message": "Service temporarily unavailable",
  "retryable": true,
  "timestamp": "2025-09-28T12:30:14.824Z"
}
```

**SSE counterpart:**
```
event: error
data: {"code":"RETRYABLE","message":"Service temporarily unavailable","retryable":true}
```

**Client action:** Retry after brief delay

**curl example:**
```bash
# Service unavailable during maintenance
curl -i "http://localhost:3001/stream?sessionId=test-retryable&scenarioId=sample" \
  -H "Accept: text/event-stream"

# Expected: HTTP/1.1 503 Service Unavailable
```

**Node.js example:**
```javascript
// Retryable error with brief delay
async function retryServiceUnavailable(url, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 503) {
        const error = await response.json();
        if (error.code === 'RETRYABLE' && error.retryable && attempt < maxAttempts - 1) {
          const delay = 2000; // Brief delay (2 seconds)
          console.log(`Service unavailable on attempt ${attempt + 1}, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
    }
  }
}
```

## Circuit Breaker (503) - BREAKER_OPEN

**When to use:** Circuit breaker protecting against cascading failures

**Common scenarios:**
- Multiple consecutive failures to downstream service
- Service degradation protection
- Automatic failover scenarios

**Example responses:**
```json
{
  "code": "BREAKER_OPEN",
  "message": "Circuit breaker is open",
  "retryable": true,
  "timestamp": "2025-09-28T12:30:14.824Z",
  "details": {
    "service": "analysis-engine",
    "retryAfter": 60000
  }
}
```

**SSE counterpart:**
```
event: error
data: {"code":"BREAKER_OPEN","message":"Circuit breaker is open","retryable":true,"details":{"retryAfter":60000}}
```

**Client action:** Wait for circuit breaker cooldown period

**curl example:**
```bash
# Trigger circuit breaker with multiple failures
for i in {1..6}; do
  curl -X POST "http://localhost:3001/report" \
    -H "Content-Type: application/json" \
    -d '{"invalid": "data"}' &
done
wait

# Then try normal request - should get circuit breaker
curl -i "http://localhost:3001/stream?sessionId=test-breaker&scenarioId=sample" \
  -H "Accept: text/event-stream"

# Expected: HTTP/1.1 503 Service Unavailable with BREAKER_OPEN
```

**Node.js example:**
```javascript
// Circuit breaker handling with cooldown
async function handleCircuitBreaker(url) {
  try {
    const response = await fetch(url);

    if (response.status === 503) {
      const error = await response.json();
      if (error.code === 'BREAKER_OPEN' && error.retryable) {
        const retryAfter = error.details?.retryAfter || 60000; // Default 1 minute
        console.log(`Circuit breaker open, waiting ${retryAfter/1000} seconds for cooldown`);

        await new Promise(resolve => setTimeout(resolve, retryAfter));

        // Retry after cooldown
        return await fetch(url);
      }
    }

    return response;
  } catch (err) {
    console.error('Circuit breaker handling failed:', err);
    throw err;
  }
}
```

## Implementation Examples

### Creating Errors
```typescript
import { ErrorFactory } from './error-taxonomy.js';

// Bad input
const error = ErrorFactory.badInput('Invalid sessionId format');

// Rate limit with details
const rateLimitError = ErrorFactory.rateLimit(
  '2025-09-28T12:31:14.824Z', // resetTime
  100,                        // limit
  0                          // remaining
);

// Timeout with context
const timeoutError = ErrorFactory.timeout(
  'Analysis timed out',
  { analysisId: 'abc123', timeout: 30000 }
);
```

### HTTP Response Formatting
```typescript
import { ErrorFormatter } from './error-taxonomy.js';

const error = ErrorFactory.badInput('Missing required field');
const response = ErrorFormatter.toHttpResponse(error);

// Returns:
// {
//   status: 400,
//   body: { code: 'BAD_INPUT', message: '...', retryable: false, ... }
// }
```

### SSE Error Events
```typescript
const error = ErrorFactory.internal('Processing failed');
const sseEvent = ErrorFormatter.toSSEError(error, 'session-123');

// Returns SSE-formatted error event
```

### Retry Logic
```typescript
import { ErrorClassifier } from './error-taxonomy.js';

const shouldRetry = ErrorClassifier.shouldRetry(error, attemptCount, maxAttempts);
const retryDelay = ErrorClassifier.calculateRetryDelay(error, attemptCount);

if (shouldRetry) {
  setTimeout(() => retryRequest(), retryDelay);
}
```

## Best Practices

### For API Developers
1. **Use specific error codes** - Don't default to INTERNAL for everything
2. **Include helpful details** - Add context that helps debugging
3. **Set appropriate retry logic** - Use the classification utilities
4. **Log errors consistently** - Use ErrorFormatter.toLogEntry()

### For Client Developers
1. **Check retryable flag** - Don't retry non-retryable errors
2. **Respect rate limit headers** - Use Retry-After for 429 responses
3. **Implement exponential backoff** - Use ErrorClassifier.calculateRetryDelay()
4. **Handle circuit breaker states** - Respect retryAfter for BREAKER_OPEN

### For Testing
1. **Test all error paths** - Verify proper error codes and formats
2. **Validate retry behavior** - Ensure clients handle retryable errors correctly
3. **Check rate limit compliance** - Verify header presence and format
4. **Test error propagation** - Ensure errors flow correctly through the system

## SSE Error Events

Errors in Server-Sent Events use the frozen `error` event type:

```
event: error
data: {"code":"TIMEOUT","message":"Analysis timed out","retryable":true}
```

**Frozen event types:** `hello|token|cost|done|cancelled|limited|error`

## Common Patterns

### Validation Errors
```typescript
// Field missing
ErrorFactory.badInput('Required field missing: sessionId', {
  field: 'sessionId',
  type: 'required'
});

// Invalid format
ErrorFactory.badInput('Invalid UUID format for sessionId', {
  field: 'sessionId',
  expectedFormat: 'UUID v4',
  type: 'format'
});
```

### Service Integration Errors
```typescript
// Downstream timeout
ErrorFactory.timeout('Analysis engine timed out', {
  service: 'analysis-engine',
  timeout: 30000
});

// Service unavailable
ErrorFactory.retryable('Database temporarily unavailable', {
  service: 'postgresql',
  type: 'connection_pool_exhausted'
});
```

This guide provides everything you need to implement consistent, client-friendly error handling across the DecisionGuide AI platform.