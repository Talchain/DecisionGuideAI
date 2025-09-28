# API Testing Guide

Quick setup guide for testing the DecisionGuide AI Scenario Sandbox API.

## Setup Options

### Option 1: Postman Collection (Recommended)

1. **Import Collection**: Open Postman → Import → Upload `postman-collection.json`
2. **Set Variables**: In collection settings, update:
   - `base_url`: Your API endpoint (default: `http://localhost:3000`)
   - `api_token`: Your authentication token
   - `user_id`: Test user ID
3. **Run Requests**: Start with "Health Check" → "Create Decision" → "Start Analysis"

### Option 2: curl Commands

1. **Set Environment**:
   ```bash
   export BASE_URL="http://localhost:3000"
   export API_TOKEN="your-api-token"
   export USER_ID="test-user-123"
   ```

2. **Test Connection**:
   ```bash
   curl -X GET "$BASE_URL/api/health"
   ```

3. **Follow curl-recipes.md** for detailed commands

### Option 3: httpie (For SSE Streaming)

Install httpie: `pip install httpie`

```bash
# Better for Server-Sent Events
http --stream POST localhost:3000/api/analysis/stream \
  Authorization:"Bearer $API_TOKEN" \
  decisionId="your-decision-id"
```

## Testing Workflow

### 1. Basic Flow
1. **Health Check** → Verify API is running
2. **Create Decision** → Get decision ID
3. **Start Analysis** → Stream real-time results
4. **Get Results** → Retrieve completed analysis
5. **Export PDF** → Download formatted report

### 2. Simulation Mode (Development)
- Add header: `X-Simulation-Mode: true`
- No real AI calls, instant responses
- Perfect for integration testing

### 3. Error Scenarios
- Invalid decision IDs
- Malformed JSON
- Missing authentication
- Rate limit testing

## Authentication

### Bearer Token
Add to all protected endpoints:
```bash
-H "Authorization: Bearer $API_TOKEN"
```

### Session Cookies (Alternative)
If using session auth instead:
```bash
-b "session=your-session-cookie"
```

## Common Issues

### CORS Errors
If testing from browser:
```javascript
fetch('http://localhost:3000/api/health', {
  mode: 'cors',
  credentials: 'include'
})
```

### SSE Connection Drops
Use Last-Event-ID header to resume:
```bash
-H "Last-Event-ID: event_123"
```

### Rate Limiting
Default: 100 requests/hour per user
Response: `429 Too Many Requests`

## Quick Scripts

### Test Everything
```bash
#!/bin/bash
# quick-test.sh
set -e

echo "🏥 Health check..."
curl -s "$BASE_URL/api/health" | jq '.status'

echo "🔐 Auth test..."
curl -s "$BASE_URL/api/user/profile" \
  -H "Authorization: Bearer $API_TOKEN" | jq '.id'

echo "📝 Create decision..."
DECISION_ID=$(curl -s -X POST "$BASE_URL/api/decisions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"title":"Test Decision","options":[{"name":"A"},{"name":"B"}]}' \
  | jq -r '.id')

echo "🎯 Decision ID: $DECISION_ID"

echo "✅ Basic flow working!"
```

### Load Test
```bash
#!/bin/bash
# load-test.sh

echo "🚀 Running load test (10 concurrent requests)..."

for i in {1..10}; do
  (curl -s "$BASE_URL/api/health" > /dev/null && echo "✅ Request $i") &
done

wait
echo "🏁 Load test complete"
```

## Response Reference

### Success Responses
- **200 OK**: Request successful
- **201 Created**: Resource created
- **202 Accepted**: Async operation started

### Error Responses
- **400 Bad Request**: Invalid input
- **401 Unauthorized**: Missing/invalid auth
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limited
- **500 Internal Server Error**: Server error

### SSE Events
- `start`: Analysis began
- `progress`: Progress update
- `token`: Content chunk
- `error`: Error occurred
- `complete`: Analysis finished

## Environment Files

Create `.env.local` for local testing:
```bash
BASE_URL=http://localhost:3000
API_TOKEN=dev-token-12345
USER_ID=dev-user-123
```

Source with: `source .env.local`

## Overnight III Features (NEW)

### Tenant Session Authentication

1. **Mint Session Token**:
   ```bash
   curl -X POST "$BASE_URL/pilot/mint-session" \
     -H "Content-Type: application/json" \
     -d '{
       "org": "acme-corp",
       "plan": "pilot",
       "caps": ["compare", "snapshot", "usage"],
       "ttlMin": 60
     }'
   ```

2. **Use Session Token**:
   ```bash
   # Option 1: Authorization header
   -H "Authorization: Pilot eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

   # Option 2: Custom header
   -H "X-Olumi-Session: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

### Concurrency Queue Management

1. **Check Queue Status**:
   ```bash
   curl "$BASE_URL/queue/status?org=acme-corp"
   ```

2. **Request Priority Bump**:
   ```bash
   curl -X POST "$BASE_URL/queue/bump" \
     -H "Content-Type: application/json" \
     -d '{
       "org": "acme-corp",
       "reason": "urgent customer demo"
     }'
   ```

### Snapshot Index & Metadata

1. **List Snapshots**:
   ```bash
   curl "$BASE_URL/snapshots?org=acme-corp&since=2024-09-26T00:00:00Z&page=1&limit=20"
   ```

2. **Get Snapshot Metadata**:
   ```bash
   curl "$BASE_URL/snapshots/run_pricing-v1_42_1696000000000"
   ```

### Usage Analytics

1. **Get Usage Summary**:
   ```bash
   curl "$BASE_URL/usage/summary?org=acme-corp&period=7d"
   ```

2. **Export Usage CSV**:
   ```bash
   curl "$BASE_URL/export/usage.csv?org=acme-corp&period=30d" \
     -H "Accept: text/csv" \
     -o "usage-report.csv"
   ```

### Correlation ID Tracking

All API responses now include traceability headers:
```bash
# Look for this header in responses
X-Olumi-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
```

### Environment Variables for Testing

```bash
# Enable tenant sessions (required for session endpoints)
export TENANT_SIGNING_KEY="your-secret-signing-key"

# Enable concurrency queue (optional)
export QUEUE_MAX_CONCURRENT=10

# Configure snapshot retention (optional)
export SNAPSHOT_INDEX_TTL_DAYS=14
```

### Testing New Features Flow

```bash
#!/bin/bash
# test-overnight-iii.sh

echo "🎫 Testing tenant sessions..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/pilot/mint-session" \
  -H "Content-Type: application/json" \
  -d '{"org":"test-org","plan":"pilot","caps":["compare","usage"]}')

SESSION_TOKEN=$(echo $SESSION_RESPONSE | jq -r '.session')
echo "Session token: ${SESSION_TOKEN:0:20}..."

echo "🚦 Testing queue status..."
curl -s "$BASE_URL/queue/status?org=test-org" | jq '.queue_depth'

echo "📊 Testing usage summary..."
curl -s "$BASE_URL/usage/summary?org=test-org&period=24h" \
  -H "X-Olumi-Session: $SESSION_TOKEN" | jq '.runs'

echo "📋 Testing snapshot list..."
curl -s "$BASE_URL/snapshots?org=test-org&limit=5" \
  -H "X-Olumi-Session: $SESSION_TOKEN" | jq '.total'

echo "✅ Overnight III features test complete!"
```

## Next Steps

1. **Start with health check** to verify connection
2. **Use simulation mode** for development
3. **Test error scenarios** before production
4. **Monitor rate limits** in real usage
5. **Export analysis results** to verify full flow
6. **Test new Overnight III features** with proper environment setup