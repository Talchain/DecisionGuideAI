# Insights v0 API

Derive low-risk, high-value insights from existing reports using deterministic algorithms. No LLMs, no external calls.

## Feature Flag

**Default: OFF** - Set `INSIGHTS_ENABLE=1` to enable

## API Endpoints

### Top Drivers

```
GET /insights/top-drivers?runId={runId}
```

Returns performance drivers ranked by contribution to overall execution.

### Risk Hotspots

```
GET /insights/risk-hotspots?runId={runId}
```

Returns potential risk factors identified in the execution flow.

Both endpoints return schema: `insights.v1`

## Response Schema

```json
{
  "schema": "insights.v1",
  "runId": "sample-framework",
  "meta": {
    "analysisType": "top-drivers",
    "timestamp": "2025-09-28T12:00:00.000Z",
    "reportVersion": "report.v1"
  },
  "drivers": [
    {
      "name": "validation",
      "weight": 1.0,
      "contribution": 0.43
    },
    {
      "name": "analysis",
      "weight": 1.0,
      "contribution": 0.42
    }
  ],
  "notes": [
    "Top 2 performance drivers identified"
  ]
}
```

## Top Drivers Analysis

Identifies the steps that contribute most to execution time and cost:

- **Contribution**: Weighted combination of duration (60%) and cost (40%)
- **Weight**: 1.0 for completed steps, 0.5 for failed/incomplete
- **Ranking**: Sorted by contribution (highest first)
- **Limit**: Top 5 drivers maximum

### Sample Response

```json
{
  "schema": "insights.v1",
  "runId": "sample-framework",
  "meta": {
    "analysisType": "top-drivers",
    "timestamp": "2025-09-28T12:00:00.000Z",
    "reportVersion": "report.v1"
  },
  "drivers": [
    {
      "name": "validation",
      "weight": 1.0,
      "contribution": 0.43
    },
    {
      "name": "generation",
      "weight": 1.0,
      "contribution": 0.42
    },
    {
      "name": "analysis",
      "weight": 1.0,
      "contribution": 0.42
    }
  ],
  "notes": [
    "Top 3 performance drivers identified"
  ]
}
```

## Risk Hotspots Analysis

Identifies potential risk factors based on execution patterns:

### Risk Factors
- **High execution time**: Steps > 5000ms
- **Execution failures**: Failed or error status
- **High token cost**: Steps > $0.01
- **Incomplete execution**: Pending or running status
- **System completion**: Missing steps
- **Cost overrun**: Total cost > $0.05
- **Performance bottleneck**: Total duration > 30s

### Sample Response

```json
{
  "schema": "insights.v1",
  "runId": "sample-risks",
  "meta": {
    "analysisType": "risk-hotspots",
    "timestamp": "2025-09-28T12:00:00.000Z",
    "reportVersion": "report.v1"
  },
  "hotspots": [
    {
      "name": "generation",
      "rationale": "Risk factors: execution failure, high token cost"
    },
    {
      "name": "validation",
      "rationale": "Risk factors: incomplete execution"
    },
    {
      "name": "system_completion",
      "rationale": "Only 2/4 steps completed successfully"
    }
  ],
  "notes": [
    "3 risk hotspots identified"
  ]
}
```

## curl Examples

```bash
# Get top drivers for a run
curl "http://localhost:3001/insights/top-drivers?runId=sample-framework"

# Get risk hotspots for a run
curl "http://localhost:3001/insights/risk-hotspots?runId=sample-risks"

# Example with error handling
curl "http://localhost:3001/insights/top-drivers?runId=nonexistent"
# Returns 404 with error message
```

## Error Handling

### Missing runId
```json
{
  "error": "runId parameter is required",
  "timestamp": "2025-09-28T12:00:00.000Z"
}
```

### Report Not Found
```json
{
  "error": "Report not found: invalid-id",
  "timestamp": "2025-09-28T12:00:00.000Z"
}
```

### Feature Disabled
```json
{
  "error": "Insights functionality is disabled. Set INSIGHTS_ENABLE=1 to enable.",
  "timestamp": "2025-09-28T12:00:00.000Z"
}
```

## Implementation Notes

- **Read-only**: No data modification or external calls
- **Deterministic**: Same input always produces same output
- **Lightweight**: Simple statistical analysis only
- **Fast**: In-memory calculations, no database queries
- **Extensible**: Easy to add new insight types

## Sample Data

The following sample runIds are available for testing:

- **sample-framework**: Healthy execution with 3 completed steps
- **sample-risks**: Problematic execution with failures and incomplete steps

## File Locations

- **API Implementation**: `src/lib/insights-api.ts`
- **Documentation**: `artifacts/insights/README.md`
- **Sample Outputs**: `artifacts/insights/samples/` (generated during validation)