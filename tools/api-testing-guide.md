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

## Next Steps

1. **Start with health check** to verify connection
2. **Use simulation mode** for development
3. **Test error scenarios** before production
4. **Monitor rate limits** in real usage
5. **Export analysis results** to verify full flow