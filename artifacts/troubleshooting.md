# Troubleshooting Guide

Common issues and solutions for DecisionGuide AI platform components.

## Stream Issues

### Symptom: Stream Never Starts
**Check:**
- ✅ Authentication token is valid and not expired
- ✅ Analysis ID exists and is correct
- ✅ No rate limiting (check X-RateLimit-* headers)

**Fix:**
```bash
# Verify analysis exists
curl -X GET /api/analysis/{id}/status -H "Authorization: Bearer $TOKEN"

# Check for 401/403 errors
curl -v -X GET /api/analysis/{id}/events -H "Authorization: Bearer $TOKEN"

# Test with fresh token
export NEW_TOKEN="$(get-fresh-token)"
```

### Symptom: Stream Stops Mid-Flow
**Check:**
- ✅ Network connectivity stable
- ✅ No proxy/firewall blocking SSE
- ✅ Client timeout settings appropriate

**Fix:**
```bash
# Reconnect with Last-Event-ID
curl -X GET /api/analysis/{id}/events \
  -H "Last-Event-ID: {last_received_id}" \
  -H "Authorization: Bearer $TOKEN"

# Check analysis hasn't been cancelled
curl -X GET /api/analysis/{id}/status -H "Authorization: Bearer $TOKEN"
```

### Symptom: Duplicate Events Received
**Check:**
- ✅ Client handling reconnection properly
- ✅ Using Last-Event-ID header correctly
- ✅ Not opening multiple streams to same analysis

**Fix:**
```javascript
// Proper reconnection handling
const events = new EventSource(`/api/analysis/${id}/events`);
let lastEventId = 0;

events.onmessage = (event) => {
  lastEventId = event.lastEventId || lastEventId + 1;
  // Process event only once
};

events.onerror = () => {
  events.close();
  // Reconnect with lastEventId
  reconnectWithLastId(lastEventId);
};
```

### Symptom: Stream Returns 429 Too Many Requests
**Check:**
- ✅ Rate limiting enabled
- ✅ Too many concurrent streams
- ✅ Exceeded request limits

**Fix:**
```bash
# Check rate limit headers
curl -v -X GET /api/analysis/{id}/events -H "Authorization: Bearer $TOKEN"

# Wait for rate limit reset
sleep $(curl -s -I /api/health | grep -i retry-after | cut -d' ' -f2)

# Close other streams before opening new ones
```

## Jobs Issues

### Symptom: Job Stuck in "Running" State
**Check:**
- ✅ Job hasn't exceeded maximum runtime
- ✅ System resources available
- ✅ No deadlocks in job queue

**Fix:**
```bash
# Check job details
curl -X GET /api/jobs/{id} -H "Authorization: Bearer $TOKEN"

# Cancel if necessary
curl -X DELETE /api/jobs/{id} -H "Authorization: Bearer $TOKEN"

# Check system health
curl -X GET /api/health
```

### Symptom: Job Progress Not Updating
**Check:**
- ✅ Job is actually running (not queued)
- ✅ Progress endpoint responding
- ✅ No caching issues

**Fix:**
```bash
# Force refresh (avoid cache)
curl -X GET /api/jobs/{id}?_t=$(date +%s) -H "Authorization: Bearer $TOKEN"

# Check job queue status
curl -X GET /api/health -H "Authorization: Bearer $TOKEN"
```

### Symptom: Job Fails with Timeout
**Check:**
- ✅ Job complexity within limits
- ✅ Sufficient timeout configured
- ✅ No resource constraints

**Fix:**
```bash
# Retry with smaller batch size
curl -X POST /api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type": "batch_analysis", "params": {"scenarios": [...], "batchSize": 1}}'

# Check resource usage
curl -X GET /api/health -H "Authorization: Bearer $TOKEN"
```

## Report Issues

### Symptom: Report Returns Empty or Incomplete
**Check:**
- ✅ Analysis completed successfully
- ✅ Report generation didn't error
- ✅ Real reports feature flag enabled (if using live data)

**Fix:**
```bash
# Check analysis status first
curl -X GET /api/analysis/{id}/status -H "Authorization: Bearer $TOKEN"

# Verify report exists
curl -X GET /api/analysis/{id}/report -H "Authorization: Bearer $TOKEN"

# Check feature flags
grep -i "real.*report" artifacts/claude-standing-permissions.md
```

### Symptom: Report Contains Redacted Data
**Check:**
- ✅ Running in simulation mode (expected behavior)
- ✅ Not accidentally using sample data
- ✅ Redaction policies properly configured

**Fix:**
```bash
# For simulation mode, this is expected
echo "Simulation mode uses redacted/sample data for safety"

# To use real data (if authorized):
# 1. Enable real reports flag
# 2. Ensure proper authentication
# 3. Verify data access permissions
```

### Symptom: Report Generation Slow
**Check:**
- ✅ Analysis complexity reasonable
- ✅ System not under heavy load
- ✅ No network issues to external services

**Fix:**
```bash
# Monitor generation progress
watch -n 2 'curl -s /api/analysis/{id}/status -H "Authorization: Bearer $TOKEN" | jq'

# Check system health
curl -X GET /api/health -H "Authorization: Bearer $TOKEN"
```

## Authentication Issues

### Symptom: 401 Unauthorized
**Check:**
- ✅ Token format correct (Bearer token)
- ✅ Token not expired
- ✅ Token has required permissions

**Fix:**
```bash
# Verify token format
echo $API_TOKEN | head -c 20  # Should start with expected format

# Test token with simple endpoint
curl -X GET /api/health -H "Authorization: Bearer $TOKEN"

# Get fresh token
export API_TOKEN="$(generate-new-token)"
```

### Symptom: 403 Forbidden
**Check:**
- ✅ Token valid but lacks permissions
- ✅ Resource access restrictions
- ✅ Rate limiting in effect

**Fix:**
```bash
# Check rate limit headers
curl -v -X GET /api/analysis -H "Authorization: Bearer $TOKEN"

# Verify permissions with admin
# Contact system administrator for access review
```

## Network Issues

### Symptom: Connection Timeouts
**Check:**
- ✅ Base URL correct
- ✅ DNS resolution working
- ✅ Firewall/proxy not blocking

**Fix:**
```bash
# Test basic connectivity
ping api.decisionguide.ai

# Test DNS resolution
nslookup api.decisionguide.ai

# Test with different timeout
curl --connect-timeout 30 -X GET /api/health
```

### Symptom: SSL/TLS Errors
**Check:**
- ✅ Certificate valid and not expired
- ✅ Certificate chain complete
- ✅ Client supports required TLS version

**Fix:**
```bash
# Check certificate
openssl s_client -connect api.decisionguide.ai:443 -servername api.decisionguide.ai

# Skip verification for testing (not recommended for production)
curl -k -X GET https://api.decisionguide.ai/api/health
```

## Performance Issues

### Symptom: Slow API Responses
**Check:**
- ✅ Request size reasonable
- ✅ Server not overloaded
- ✅ Network latency acceptable

**Fix:**
```bash
# Measure response time
time curl -X GET /api/health -H "Authorization: Bearer $TOKEN"

# Check server health
curl -X GET /api/health -H "Authorization: Bearer $TOKEN"

# Use smaller requests
# Reduce batch sizes, limit options, simplify scenarios
```

### Symptom: High Memory Usage
**Check:**
- ✅ Client properly handling streaming data
- ✅ Not accumulating all tokens in memory
- ✅ Cleaning up completed operations

**Fix:**
```javascript
// Stream processing without accumulation
events.onmessage = (event) => {
  processEventImmediately(event);
  // Don't store all events in array
};

// Clean up completed operations
if (analysis.status === 'completed') {
  cleanupAnalysis(analysis.id);
}
```

## Error Codes Quick Reference

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| 400 | Bad Request | Invalid parameters | Check request format |
| 401 | Unauthorized | Authentication failed | Verify token |
| 403 | Forbidden | Insufficient permissions | Check access rights |
| 404 | Not Found | Resource doesn't exist | Verify ID/path |
| 429 | Too Many Requests | Rate limited | Wait and retry |
| 500 | Internal Server Error | Server issue | Retry, report if persistent |
| 502/503/504 | Service Unavailable | Temporary outage | Retry with backoff |

## Getting Help

1. **Check System Status**: Start with `/api/health`
2. **Review Logs**: Check client and server logs for errors
3. **Test Isolation**: Use simple requests to isolate the issue
4. **Verify Configuration**: Confirm settings, flags, and environment
5. **Contact Support**: Include request IDs and error details

## Diagnostic Commands

```bash
# Complete health check
curl -X GET /api/health -H "Authorization: Bearer $TOKEN" | jq

# Test authentication
curl -X GET /api/version -H "Authorization: Bearer $TOKEN"

# Check rate limits
curl -v -X GET /api/health -H "Authorization: Bearer $TOKEN" 2>&1 | grep -i rate

# Test streaming
timeout 10 curl -X GET /api/analysis/{id}/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
```

---

**Remember**: When in doubt, start with the health endpoint and work up to more complex operations.