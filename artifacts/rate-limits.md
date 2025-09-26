# Rate Limiting Configuration

⚠️ **KEEP OFF BY DEFAULT** - Rate limiting is disabled by default for safety. Enable only when needed.

## Recommended Defaults by Environment

### Development Environment
```
RATE_LIMIT_ENABLED=false
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_BURST_SIZE=20
```

### Staging Environment
```
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=50
RATE_LIMIT_BURST_SIZE=10
```

### Production Environment
```
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=30
RATE_LIMIT_BURST_SIZE=5
```

## Headers Emitted

When rate limiting is enabled, the platform emits these headers:

- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `X-RateLimit-Policy`: Rate limit policy identifier

### Example Response
```
HTTP/1.1 200 OK
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1695735600
X-RateLimit-Policy: production-v1
```

### Rate Limited Response
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1695735660
Retry-After: 60
```

## Implementation Notes

- Uses sliding window algorithm for smooth rate limiting
- Tracks by client IP address by default
- Burst capacity allows temporary spikes
- Graceful degradation when rate limiter is unavailable

## Configuration Guidelines

1. **Start Conservative**: Begin with lower limits and increase as needed
2. **Monitor Metrics**: Track 429 responses and legitimate traffic patterns
3. **Test Thoroughly**: Validate limits don't block normal usage
4. **Have Bypass**: Maintain admin override capability

## Safety Defaults

- **DEFAULT**: Rate limiting OFF to prevent accidental blocking
- **No Auto-Enable**: Must be explicitly configured per environment
- **Fail Open**: If rate limiter fails, allow requests through
- **Monitoring Required**: Alert on rate limit activation

---

**⚠️ IMPORTANT**: This is documentation only. Rate limiting remains OFF by default as per platform safety policy.