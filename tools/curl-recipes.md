# DecisionGuide AI - curl Recipes

Quick curl commands for testing the Scenario Sandbox API. Replace variables with actual values.

## Environment Variables

Set these for convenience:

```bash
export BASE_URL="http://localhost:3000"
export API_TOKEN="your-api-token-here"
export USER_ID="test-user-123"
```

## Health Check

```bash
curl -X GET "$BASE_URL/api/health"
```

Expected: `{"status": "ok", "timestamp": "..."}`

## Authentication Test

```bash
curl -X GET "$BASE_URL/api/user/profile" \
  -H "Authorization: Bearer $API_TOKEN"
```

## Create Decision Scenario

```bash
curl -X POST "$BASE_URL/api/decisions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "title": "Market Entry Strategy",
    "description": "Evaluating options for entering a new geographic market",
    "context": {
      "industry": "technology",
      "timeline": "6 months",
      "budget": "500k",
      "riskTolerance": "medium"
    },
    "options": [
      {
        "name": "Organic Growth",
        "description": "Build local presence gradually",
        "estimatedCost": 300000,
        "timeline": "18 months"
      },
      {
        "name": "Acquisition",
        "description": "Acquire existing local player",
        "estimatedCost": 800000,
        "timeline": "6 months"
      },
      {
        "name": "Partnership",
        "description": "Joint venture with local company",
        "estimatedCost": 200000,
        "timeline": "9 months"
      }
    ]
  }'
```

Save the returned `id` as `DECISION_ID`:

```bash
export DECISION_ID="the-returned-decision-id"
```

## Get Decision

```bash
curl -X GET "$BASE_URL/api/decisions/$DECISION_ID" \
  -H "Authorization: Bearer $API_TOKEN"
```

## List User Decisions

```bash
curl -X GET "$BASE_URL/api/decisions?user_id=$USER_ID&limit=10&offset=0" \
  -H "Authorization: Bearer $API_TOKEN"
```

## Start Streaming Analysis

**Note**: This uses Server-Sent Events. Use tools like `curl`, `httpie`, or custom clients that handle SSE.

```bash
curl -X POST "$BASE_URL/api/analysis/stream" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer $API_TOKEN" \
  -N \
  -d '{
    "decisionId": "'$DECISION_ID'",
    "analysisType": "comprehensive",
    "parameters": {
      "depth": "detailed",
      "includeRiskAnalysis": true,
      "includeFinancialModel": true,
      "scenarioCount": 3,
      "confidenceLevel": 0.95
    }
  }'
```

**Alternative with httpie** (better for SSE):

```bash
http --stream POST "$BASE_URL/api/analysis/stream" \
  Authorization:"Bearer $API_TOKEN" \
  Content-Type:application/json \
  Accept:text/event-stream \
  decisionId="$DECISION_ID" \
  analysisType=comprehensive \
  parameters:='{
    "depth": "detailed",
    "includeRiskAnalysis": true,
    "includeFinancialModel": true,
    "scenarioCount": 3,
    "confidenceLevel": 0.95
  }'
```

## Get Analysis Results

After streaming completes, get the final results:

```bash
export ANALYSIS_ID="analysis-id-from-stream"

curl -X GET "$BASE_URL/api/analysis/$ANALYSIS_ID" \
  -H "Authorization: Bearer $API_TOKEN"
```

## Export Analysis as PDF

```bash
curl -X GET "$BASE_URL/api/analysis/$ANALYSIS_ID/export?format=pdf" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Accept: application/pdf" \
  -o "analysis-report.pdf"
```

## Simulation Mode (Testing)

For development/testing without real AI calls:

```bash
curl -X POST "$BASE_URL/api/simulate/analysis" \
  -H "Content-Type: application/json" \
  -H "X-Simulation-Mode: true" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "scenario": "market_entry_test",
    "seed": 42,
    "options": 3,
    "complexity": "medium"
  }'
```

## Streaming with Last-Event-ID (Reconnection)

If connection drops during streaming, resume with:

```bash
curl -X POST "$BASE_URL/api/analysis/stream" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Last-Event-ID: last-received-event-id" \
  -N \
  -d '{
    "decisionId": "'$DECISION_ID'",
    "resumeFromEventId": "last-received-event-id"
  }'
```

## Error Handling Examples

### Check API Errors

```bash
curl -X GET "$BASE_URL/api/decisions/invalid-id" \
  -H "Authorization: Bearer $API_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
```

### Test Rate Limiting

```bash
for i in {1..10}; do
  curl -X GET "$BASE_URL/api/health" -w " | Status: %{http_code}\n"
done
```

### Test Invalid Auth

```bash
curl -X GET "$BASE_URL/api/decisions" \
  -H "Authorization: Bearer invalid-token" \
  -w "\nHTTP Status: %{http_code}\n"
```

## Batch Operations

### Create Multiple Decisions

```bash
#!/bin/bash
# create-test-decisions.sh

for i in {1..5}; do
  echo "Creating decision $i..."
  curl -X POST "$BASE_URL/api/decisions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_TOKEN" \
    -d "{
      \"title\": \"Test Decision $i\",
      \"description\": \"Automated test decision for batch testing\",
      \"options\": [
        {\"name\": \"Option A\", \"description\": \"First option\"},
        {\"name\": \"Option B\", \"description\": \"Second option\"}
      ]
    }" | jq '.id'
done
```

### Cleanup Test Data

```bash
#!/bin/bash
# cleanup-test-data.sh

# Get all decisions for user
DECISIONS=$(curl -s -X GET "$BASE_URL/api/decisions?user_id=$USER_ID" \
  -H "Authorization: Bearer $API_TOKEN" | jq -r '.decisions[].id')

for decision_id in $DECISIONS; do
  if [[ $decision_id == test-* ]]; then
    echo "Deleting test decision: $decision_id"
    curl -X DELETE "$BASE_URL/api/decisions/$decision_id" \
      -H "Authorization: Bearer $API_TOKEN"
  fi
done
```

## Response Examples

### Successful Decision Creation

```json
{
  "id": "dec_abc123",
  "title": "Market Entry Strategy",
  "status": "created",
  "createdAt": "2024-09-24T14:30:00Z",
  "userId": "user123"
}
```

### SSE Stream Format

```
event: start
data: {"analysisId": "ana_xyz789", "status": "started"}

event: progress
data: {"step": "risk_analysis", "progress": 25, "message": "Analyzing risk factors..."}

event: token
data: {"content": "Based on the provided options, here are the key considerations:"}

event: complete
data: {"analysisId": "ana_xyz789", "status": "completed", "totalTokens": 1250}
```

## Tips

1. **jq for JSON parsing**: Install `jq` for better JSON handling
2. **httpie for SSE**: Use `http --stream` for Server-Sent Events
3. **Environment files**: Store variables in `.env` for convenience
4. **Verbose output**: Add `-v` flag to curl for debugging
5. **Save responses**: Use `-o filename.json` to save API responses