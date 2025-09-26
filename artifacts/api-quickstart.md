# DecisionGuide AI - API Quickstart

Quick reference for the core API endpoints and usage patterns.

## Base URL
```
Development: http://localhost:3000
Production: https://api.decisionguide.ai
```

## Authentication
All API calls require authentication via Bearer token:
```bash
Authorization: Bearer your-api-token-here
```

## Core Endpoints

### Health & Version
```bash
# Health check
curl -X GET /api/health
# Response: {"status": "ok", "timestamp": "2025-09-26T15:14:00Z"}

# Version info
curl -X GET /api/version
# Response: {"version": "1.0.0", "build": "abc123"}
```

### Analysis Workflow

#### 1. Create Analysis
```bash
curl -X POST /api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "scenario": "Market entry decision",
    "context": {
      "industry": "technology",
      "timeline": "6 months",
      "budget": 500000
    },
    "options": [
      {"name": "Option A", "description": "Organic growth"},
      {"name": "Option B", "description": "Acquisition"}
    ]
  }'
# Response: {"id": "analysis-123", "status": "created"}
```

#### 2. Stream Analysis Events (SSE)
```bash
curl -X GET /api/analysis/analysis-123/events \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Accept: text/event-stream"
```

**Event Types:**
- `data`: Analysis tokens as they're generated
- `progress`: Completion percentage
- `complete`: Analysis finished
- `error`: Error occurred

#### 3. Get Analysis Status
```bash
curl -X GET /api/analysis/analysis-123/status \
  -H "Authorization: Bearer $API_TOKEN"
# Response: {"id": "analysis-123", "status": "running", "progress": 75}
```

#### 4. Cancel Analysis
```bash
curl -X POST /api/analysis/analysis-123/cancel \
  -H "Authorization: Bearer $API_TOKEN"
# Response: {"id": "analysis-123", "status": "cancelled"}
```

#### 5. Get Final Report
```bash
curl -X GET /api/analysis/analysis-123/report \
  -H "Authorization: Bearer $API_TOKEN"
# Response: Complete analysis report with recommendations
```

### Background Jobs

#### Create Job
```bash
curl -X POST /api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "type": "batch_analysis",
    "params": {"scenarios": [...]}
  }'
# Response: {"id": "job-456", "status": "queued"}
```

#### Get Job Status
```bash
curl -X GET /api/jobs/job-456 \
  -H "Authorization: Bearer $API_TOKEN"
# Response: {"id": "job-456", "status": "running", "progress": 60}
```

#### Cancel Job
```bash
curl -X DELETE /api/jobs/job-456 \
  -H "Authorization: Bearer $API_TOKEN"
# Response: {"id": "job-456", "status": "cancelled"}
```

## Request Parameters

### Analysis Creation Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scenario` | string | Yes | Brief scenario description |
| `context` | object | Yes | Context information |
| `options` | array | Yes | Decision options to analyze |
| `seed` | number | No | Seed for deterministic results |
| `model` | string | No | Analysis model (default: gpt-4) |
| `budget` | number | No | Token budget limit |

### Common Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `seed` | number | Deterministic seed for replay |
| `format` | string | Response format (json, csv) |
| `include` | string | Additional fields to include |

## Response Headers

All responses include:
- `Cache-Control: no-store` (prevents caching of sensitive data)
- `X-Request-ID: req-abc123` (for request tracing)
- `X-RateLimit-*` (when rate limiting enabled)

## Error Responses

Standard HTTP status codes with error details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid scenario format",
    "details": {
      "field": "options",
      "reason": "At least 2 options required"
    },
    "requestId": "req-abc123"
  }
}
```

## Sample cURL Scripts

### Complete Analysis Flow
```bash
#!/bin/bash
# Set environment
export BASE_URL="http://localhost:3000"
export API_TOKEN="your-token-here"

# 1. Create analysis
ANALYSIS_ID=$(curl -s -X POST "$BASE_URL/api/analysis" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"scenario": "Test scenario", "context": {}, "options": [{"name": "A"}, {"name": "B"}]}' \
  | jq -r '.id')

echo "Created analysis: $ANALYSIS_ID"

# 2. Monitor progress
while true; do
  STATUS=$(curl -s "$BASE_URL/api/analysis/$ANALYSIS_ID/status" \
    -H "Authorization: Bearer $API_TOKEN" | jq -r '.status')

  if [[ "$STATUS" == "completed" ]]; then
    break
  elif [[ "$STATUS" == "error" || "$STATUS" == "cancelled" ]]; then
    echo "Analysis failed: $STATUS"
    exit 1
  fi

  echo "Status: $STATUS"
  sleep 2
done

# 3. Get report
curl "$BASE_URL/api/analysis/$ANALYSIS_ID/report" \
  -H "Authorization: Bearer $API_TOKEN" | jq '.'
```

### Stream Events Example
```bash
# Stream events with curl (basic)
curl -X GET "$BASE_URL/api/analysis/$ANALYSIS_ID/events" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Accept: text/event-stream" \
  -N

# Stream with reconnection on connection drop
curl -X GET "$BASE_URL/api/analysis/$ANALYSIS_ID/events?lastEventId=42" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Accept: text/event-stream" \
  -H "Last-Event-ID: 42" \
  -N
```

## SDK Usage Patterns

### JavaScript/Node.js
```javascript
// Using fetch API
const response = await fetch('/api/analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    scenario: 'Your scenario',
    context: {},
    options: [{name: 'Option A'}, {name: 'Option B'}]
  })
});

const analysis = await response.json();

// Stream events with EventSource
const events = new EventSource(`/api/analysis/${analysis.id}/events`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Token:', data.token);
};
```

### Python
```python
import requests
import sseclient

# Create analysis
response = requests.post('/api/analysis',
  headers={'Authorization': f'Bearer {token}'},
  json={'scenario': 'Your scenario', 'context': {}, 'options': [...]})

analysis_id = response.json()['id']

# Stream events
stream = requests.get(f'/api/analysis/{analysis_id}/events',
  headers={'Authorization': f'Bearer {token}'}, stream=True)

client = sseclient.SSEClient(stream)
for event in client.events():
  print(f"Event: {event.data}")
```

---

**Note**: This API is in simulation mode by default. Set appropriate feature flags for production use.