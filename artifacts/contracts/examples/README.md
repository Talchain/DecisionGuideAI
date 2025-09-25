# Contract Examples

Copy-runnable examples showing the exact API contracts and data formats used by DecisionGuide AI.

## Files Overview

### `stream-sse-events.txt`
**Purpose**: Server-Sent Events sequence for real-time analysis streaming
**Use Case**: Understanding how live analysis results are delivered
**Format**: Raw SSE event stream with headers and data

**Key Events**:
- `connected` - Initial connection established
- `start` - Analysis begins
- `progress` - Progress updates (25%, 50%, 75%)
- `token` - Content streaming (token-by-token)
- `complete` - Analysis finished
- `error` - Error handling

### `jobs-progress-sse.txt`
**Purpose**: Job queue status updates via SSE
**Use Case**: Monitoring background analysis jobs
**Format**: SSE events for queue management

**Key Events**:
- `queue-status` - Overall queue statistics
- `job-queued` - New job added
- `job-started` - Job processing begins
- `job-progress` - Job progress updates
- `job-completed` - Job finished successfully
- `job-failed` - Job failed with error details

### `cancel-request.json`
**Purpose**: Cancel/stop analysis operations
**Use Case**: Implementing cancel functionality
**Format**: JSON request/response examples

**Scenarios Covered**:
- Graceful cancellation
- Force cancellation
- Already completed analysis
- Not found errors
- curl command examples

### `report-v1-payload.json`
**Purpose**: Complete analysis report structure
**Use Case**: Final analysis results format
**Format**: Full JSON payload with all fields

**Sections**:
- Summary and recommendation
- Context and constraints
- Option analysis with scores
- Risk assessment
- Financial projections
- Next steps and alternatives
- Metadata and limitations

## Usage Guidelines

### For Frontend Development
1. Use `stream-sse-events.txt` to implement SSE handling
2. Use `report-v1-payload.json` for result display components
3. Use `cancel-request.json` for stop/cancel functionality

### For Backend Development
1. Ensure SSE events match `stream-sse-events.txt` format
2. Implement job progress updates per `jobs-progress-sse.txt`
3. Follow `report-v1-payload.json` structure for response data

### For Testing
1. Copy events from examples as test fixtures
2. Use curl commands from `cancel-request.json`
3. Validate response formats against examples

## Copy-Paste Examples

### Test SSE Connection
```bash
curl -N -H "Accept: text/event-stream" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/analysis/stream
```

### Test Cancel Request
```bash
curl -X POST 'http://localhost:3000/api/analysis/ana_demo_001/cancel' \
     -H 'Authorization: Bearer YOUR_TOKEN' \
     -H 'Content-Type: application/json' \
     -d '{"reason": "user_requested"}'
```

### Test Jobs Status
```bash
curl -N -H "Accept: text/event-stream" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:4500/jobs/progress
```

## Data Consistency Rules

### IDs Format
- Analysis IDs: `ana_[a-z0-9]{8,12}`
- Job IDs: `job_[a-z0-9]{6,8}`
- User IDs: `usr_[a-z0-9]{8}`
- Result IDs: `result_[a-z0-9]{6,12}`

### Timestamps
- Format: ISO 8601 with milliseconds: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Timezone: Always UTC
- Precision: Milliseconds for events, seconds for reports

### Status Values
- Analysis: `queued`, `started`, `streaming`, `completed`, `cancelled`, `failed`
- Jobs: `pending`, `running`, `completed`, `failed`, `cancelled`
- Connections: `connected`, `streaming`, `paused`, `closed`

### Error Handling
- Always include `error` field with machine-readable code
- Always include `message` field with human-readable description
- Include `suggestions` array for actionable next steps
- Use appropriate HTTP status codes (400, 404, 429, 500)

## Validation Notes

✅ **No PII**: All examples use synthetic data
✅ **Realistic**: Based on actual platform usage patterns
✅ **Current**: Updated to match latest OpenAPI spec
✅ **Complete**: Covers happy path and error scenarios

❗ **Important**: These are examples only. Actual API responses may include additional fields or vary based on configuration.

---

*Last updated: September 2024*
*Next review: When OpenAPI spec changes*