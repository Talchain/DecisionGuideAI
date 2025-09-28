# Windsurf Live-Swap Wiring Card

**Purpose**: Single reference for switching from fixtures to live Scenario Sandbox PoC
**Mode**: Live integration (replace simulation with real Gateway endpoints)
**Safety**: All powerful features remain OFF by default

## 🚨 Error Taxonomy Reference

### Public Error Messages (Contract)
| Taxonomy | HTTP Code | Public Phrase |
|----------|-----------|---------------|
| `BAD_INPUT` | 400 | `Request must include items array` |
| `BAD_INPUT` | 400 | `scenarioId required` |
| `BAD_INPUT` | 400 | `left and right scenarios required` |
| `BAD_INPUT` | 400 | `seed must be a number` |
| `BAD_INPUT` | 400 | `Item 1: scenarioId required` |
| `BAD_INPUT` | 400 | `Item 1: seed must be an integer` |
| `RATE_LIMIT` | 429 | `Too many requests, please try again shortly` |
| `RESOURCE_LIMIT` | 413 | `Scenario too large for pilot (12-node cap)` |
| `NOT_FOUND` | 404 | `not found` |
| `UNAUTHORIZED` | 401 | `Authorization header required` |

**Note**: Internal schema validation details (paths, codes) are normalized to stable public phrases. The taxonomy type and HTTP status remain unchanged for API contracts.

## 🔌 Base URLs

### Core Endpoints
```javascript
const LIVE_CONFIG = {
  STREAM_URL: 'http://localhost:3001/stream',
  CANCEL_URL: 'http://localhost:3001/cancel',
  JOBS_STREAM_URL: 'http://localhost:3001/jobs/stream',
  JOBS_CANCEL_URL: 'http://localhost:3001/jobs/cancel',
  REPORT_URL: 'http://localhost:3001/report',
  COMPARE_URL: 'http://localhost:3001/compare',
  LINT_URL: 'http://localhost:3001/lint/scenario',          // 🔍 Requires LINT_ENABLE=1
  SWEEP_URL: 'http://localhost:3001/compare/sweep',         // 📊 Requires SWEEP_ENABLE=1
  IMPORT_DRYRUN_URL: 'http://localhost:3001/import/dry-run', // 📋 Requires IMPORT_ENABLE=1
  INSIGHTS_DRIVERS_URL: 'http://localhost:3001/insights/top-drivers', // 💡 Requires INSIGHTS_ENABLE=1
  INSIGHTS_RISKS_URL: 'http://localhost:3001/insights/risk-hotspots', // ⚠️ Requires INSIGHTS_ENABLE=1
  TEMPLATES_ENCODE_URL: 'http://localhost:3001/templates/encode',
  TEMPLATES_DECODE_URL: 'http://localhost:3001/templates/decode',
  HEALTH_URL: 'http://localhost:3001/healthz'
};
```

### CORS Origins
```yaml
# Add to Gateway environment
CORS_ORIGINS: "http://localhost:3000,http://localhost:5173,http://localhost:8080"
```

**🩺 CORS Diagnostic Tool**: Use the [Origin Doctor](../public/origin-check.html) to test CORS configuration and troubleshoot connection issues.

## 🌐 Origins Matrix

### Pre-configured Origins
| Origin | Purpose | Status |
|--------|---------|--------|
| `http://localhost:3000` | Windsurf default dev server | ✅ Enabled |
| `http://localhost:5173` | Vite dev server | ✅ Enabled |
| `http://localhost:8080` | Alternative dev port | ✅ Enabled |

### Adding Custom Origins
To add your development origin to the pilot deployment:

1. **Edit Environment File**:
   ```bash
   # In pilot-deploy/.env.poc
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080,http://localhost:YOUR_PORT
   ```

2. **Restart Services**:
   ```bash
   cd pilot-deploy
   ./scripts/pilot-down.sh
   ./scripts/pilot-up.sh
   ```

3. **Verify CORS Headers**:
   ```bash
   curl -I "http://localhost:3001/report?scenarioId=demo" \
     -H "Origin: http://localhost:YOUR_PORT"

   # Expected response header:
   # Access-Control-Allow-Origin: *
   ```

### Windsurf Development Ports
Common ports used by Windsurf and related tools:

| Port | Service | Origin | Notes |
|------|---------|---------|-------|
| 3000 | React/Next.js | `http://localhost:3000` | Most common dev server |
| 5173 | Vite | `http://localhost:5173` | Fast dev server |
| 8080 | Alt dev server | `http://localhost:8080` | Alternative port |
| 3001 | Pilot Gateway | `http://localhost:3001` | **Target server** |
| 4173 | Vite preview | `http://localhost:4173` | Production preview |

### CORS Validation
```bash
# Test preflight request
curl -X OPTIONS "http://localhost:3001/stream" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Last-Event-ID" \
  -H "Origin: http://localhost:3000"

# Expected response headers:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, OPTIONS
# Access-Control-Allow-Headers: Last-Event-ID
```

## 🚦 Flags to Flip for Live Mode

### Switch from Simulation to Live
```javascript
// Before (Fixtures/Simulation)
const config = {
  USE_MOCK_DATA: true,
  USE_SIMULATION: true,
  ENABLE_SEED_ECHO: true
};

// After (Live Gateway)
const config = {
  USE_MOCK_DATA: false,        // ✅ Flip to false
  USE_SIMULATION: false,       // ✅ Flip to false
  ENABLE_SEED_ECHO: true       // ✅ Keep true for determinism
};
```

### Safety Defaults (Keep OFF)
```javascript
// These remain OFF in live mode
const SAFETY_FLAGS = {
  ENABLE_RATE_LIMITING: false,
  ENABLE_CACHE: false,
  ENABLE_USAGE_TRACKING: false,
  ENABLE_MONITORING: false,
  ENABLE_SECRET_HYGIENE_BLOCKING: false,
  ENABLE_SLOS: false
};
```

### Feature Flags (Gated Features)
```javascript
// Optional features (OFF by default)
const FEATURE_FLAGS = {
  LINT_ENABLE: false,           // ✅ Enable scenario linting/validation
  SWEEP_ENABLE: false,          // ✅ Enable parameter sweeps
  IMPORT_ENABLE: false,         // 📋 Enable import dry-run (CSV/Sheets/Jira)
  INSIGHTS_ENABLE: false        // 💡 Enable insights v0 (drivers/risks)
};
```

## 📋 Contract Recap

### SSE Stream Events (Exact Names)
```javascript
// Start event
{
  type: 'start',
  data: { sessionId, seed, timestamp }
}

// Token events
{
  type: 'token',
  data: { text, tokenIndex, timestamp, model }
}

// Progress events
{
  type: 'progress',
  data: { percent, message }
}

// Complete event
{
  type: 'done',
  data: { sessionId, totalTokens, seed }
}

// Cancel event
{
  type: 'cancelled',
  data: { reason, timestamp }
}

// Error event
{
  type: 'error',
  data: { message, code }
}
```

### Report v1 Keys (Stable Structure)
```javascript
{
  "decision": {
    "title": "string",
    "options": [
      {
        "id": "string",
        "name": "string",
        "score": "number",
        "description": "string"
      }
    ]
  },
  "recommendation": {
    "primary": "string"
  },
  "analysis": {
    "confidence": "string"
  },
  "meta": {
    "scenarioId": "string",
    "seed": "number",
    "timestamp": "ISO string"
  }
}
```

## 🔄 Resume Rule (Single Reconnect)

### EventSource Reconnection
```javascript
// First connection
const eventSource = new EventSource('/stream?route=critique&seed=42');

// Resume after disconnect (single reconnect only)
eventSource.onerror = () => {
  eventSource.close();

  // Reconnect with Last-Event-ID
  const resumeSource = new EventSource('/stream?route=critique&seed=42', {
    headers: { 'Last-Event-ID': lastEventId }
  });
};
```

### Last-Event-ID Handling
- Server includes `id: msg_001` in SSE events
- Client sends `Last-Event-ID: msg_001` header on resume
- Server resumes from next event after specified ID

## ⚡ Idempotent Cancel Rule

### Cancel Response Pattern
```javascript
// First cancel: 202 Accepted
POST /cancel
{
  "sessionId": "session_123"
}
// Response: 202 { "status": "cancelling" }

// Subsequent cancels: 409 Conflict
POST /cancel
{
  "sessionId": "session_123"
}
// Response: 409 { "status": "already_cancelled" }
```

## 🔒 Security Headers (Required)

### Stream Responses
```http
Cache-Control: no-store, no-cache, must-revalidate
Content-Type: text/event-stream
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Last-Event-ID
```

### API Responses
```http
Cache-Control: no-store
Content-Type: application/json
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

## 🔄 Compare API

### Scenario Comparison
```javascript
// Compare two scenarios side-by-side
async function compareScenarios(leftScenario, rightScenario) {
  const response = await fetch('/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      left: leftScenario,
      right: rightScenario
    })
  });

  const comparison = await response.json();
  return comparison; // Schema: compare.v1
}

// Usage example
const comparison = await compareScenarios(
  { scenarioId: 'pricing-conservative', seed: 42 },
  { scenarioId: 'pricing-aggressive', seed: 42 }
);

console.log(comparison.headline); // "Moderate improvement: up ~8.5% in Right vs Left"
console.log(comparison.key_drivers); // ["Higher risk tolerance", "Market timing"]
```

### Compare Response Structure
```javascript
{
  "schema": "compare.v1",
  "left": {
    "scenarioId": "pricing-conservative",
    "runId": "run_...",
    "report": { /* Report v1 */ }
  },
  "right": {
    "scenarioId": "pricing-aggressive",
    "runId": "run_...",
    "report": { /* Report v1 */ }
  },
  "delta": {
    "most_likely_diff": 1200,
    "most_likely_pct": 0.085,
    "confidence_shift": "DOWN",
    "threshold_events": []
  },
  "headline": "Moderate improvement: up ~8.5% in Right vs Left",
  "key_drivers": ["Higher risk tolerance", "Market timing"]
}
```

## 📋 Import Dry-Run API (Read-Only Helper)

**Flag:** `IMPORT_ENABLE=1` (default OFF)
**Purpose:** Convert external data sources into scenario format without persisting data

### CSV Import
```javascript
async function importFromCSV(csvData, mapping) {
  const response = await fetch('/import/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      csv: csvData,
      mapping: {
        title: 'title',
        description: 'description',
        weight: 'weight'
      }
    })
  });

  const result = await response.json();
  return result; // Schema: import-dryrun.v1
}

// Example usage
const csvData = `title,description,weight
Option A,First choice,0.8
Option B,Second choice,0.6`;

const importResult = await importFromCSV(csvData, {
  title: 'title',
  description: 'description',
  weight: 'weight'
});

console.log(importResult.summary.nodes); // 2
console.log(importResult.scenarioPreview.nodes); // Array of imported nodes
```

### cURL Example: Import CSV
```bash
curl -X POST "http://localhost:3001/import/dry-run" \
  -H "Content-Type: application/json" \
  -d '{
    "csv": "title,description,weight\nOption A,First choice,0.8\nOption B,Second choice,0.6",
    "mapping": {
      "title": "title",
      "description": "description",
      "weight": "weight"
    }
  }'
```

### CLI Usage
```bash
# Import from CSV
node scripts/import-dryrun.mjs csv --csv data.csv --mapping artifacts/import/mappings/basic.json

# Google Sheets (placeholder)
node scripts/import-dryrun.mjs sheets --sheet-id 1abc123 --range A1:Z100 --mapping basic.json

# Jira (placeholder)
node scripts/import-dryrun.mjs jira --jql "project = PROJ" --mapping basic.json
```

## 💡 Insights v0 API (Read-Only Helper)

**Flag:** `INSIGHTS_ENABLE=1` (default OFF)
**Purpose:** Derive deterministic insights from existing reports (no LLMs)

### Top Performance Drivers
```javascript
async function getTopDrivers(runId) {
  const response = await fetch(`/insights/top-drivers?runId=${runId}`);
  const insights = await response.json();
  return insights; // Schema: insights.v1
}

// Example usage
const drivers = await getTopDrivers('sample-framework');
console.log(drivers.drivers);
// [{ name: 'validation', weight: 1.0, contribution: 0.43 }, ...]
```

### cURL Example: Top Drivers
```bash
curl "http://localhost:3001/insights/top-drivers?runId=sample-framework" \
  -H "Accept: application/json"
```

### Risk Hotspots Analysis
```javascript
async function getRiskHotspots(runId) {
  const response = await fetch(`/insights/risk-hotspots?runId=${runId}`);
  const insights = await response.json();
  return insights; // Schema: insights.v1
}

// Example usage
const risks = await getRiskHotspots('sample-risks');
console.log(risks.hotspots);
// [{ name: 'generation', rationale: 'Risk factors: execution failure, high token cost' }, ...]
```

### cURL Example: Risk Hotspots
```bash
curl "http://localhost:3001/insights/risk-hotspots?runId=sample-risks" \
  -H "Accept: application/json"
```

### Insights Response Structure
```javascript
{
  "schema": "insights.v1",
  "runId": "sample-framework",
  "meta": {
    "analysisType": "top-drivers", // or "risk-hotspots"
    "timestamp": "2025-09-28T12:00:00.000Z",
    "reportVersion": "report.v1"
  },
  "drivers": [
    { "name": "validation", "weight": 1.0, "contribution": 0.43 }
  ],
  "notes": ["Top 3 performance drivers identified"]
}
```

## 🔍 Scenario Linter API

### Scenario Validation
```javascript
// Lint scenario for structural integrity and best practices
async function lintScenario(scenario) {
  const response = await fetch('/lint/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario })
  });

  const lintResult = await response.json();
  return lintResult; // Schema: lint.v1
}

// Usage example
const lintResult = await lintScenario({
  title: "Pricing Strategy Decision",
  options: [
    { id: "conservative", name: "Conservative Pricing" },
    { id: "aggressive", name: "Aggressive Pricing" }
  ],
  stakeholders: [
    { id: "sales", name: "Sales Team", influence: 0.8 }
  ]
});

console.log(lintResult.issues); // Array of validation issues
console.log(lintResult.score); // Overall quality score (0-100)
```

### Lint Response Structure
```javascript
{
  "schema": "lint.v1",
  "timestamp": "2024-09-27T10:00:00.000Z",
  "scenario": {
    "title": "Pricing Strategy Decision",
    "id": "pricing-strategy"
  },
  "summary": {
    "score": 85,
    "issueCount": 2,
    "criticalCount": 0,
    "warningCount": 2
  },
  "issues": [
    {
      "id": "missing-metrics",
      "severity": "warning",
      "category": "completeness",
      "message": "Consider adding success metrics for better decision tracking",
      "suggestion": "Add metrics like 'Revenue impact' or 'Market share'"
    },
    {
      "id": "stakeholder-balance",
      "severity": "warning",
      "category": "balance",
      "message": "Stakeholder influence distribution could be more balanced",
      "suggestion": "Consider involving customer perspective"
    }
  ],
  "recommendations": [
    "Add 2-3 measurable success metrics",
    "Include customer/market stakeholder",
    "Consider adding constraints or assumptions"
  ]
}
```

### Linter Feature Flag
**Environment Variable**: `LINT_ENABLE=1` (required)
**Default**: OFF (returns 404 when disabled)

```bash
# Enable linter in development
export LINT_ENABLE=1

# Test linter availability
curl -I "http://localhost:3001/lint/scenario"
# Enabled: 405 Method Not Allowed (POST required)
# Disabled: 404 Not Found
```

## 📊 Parameter Sweeps API

### What-If Analysis
```javascript
// Generate parameter sweep variants for what-if analysis
async function generateParameterSweep(baseScenario, targetPaths, variations, maxVariants = 20) {
  const response = await fetch('/compare/sweep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseScenario,
      targetPaths,
      variations,
      maxVariants
    })
  });

  const sweepResult = await response.json();
  return sweepResult; // Schema: sweep.v1
}

// Usage example
const sweepResult = await generateParameterSweep(
  {
    title: "Pricing Decision",
    options: [
      { id: "basic", name: "Basic Plan", price: 29 },
      { id: "premium", name: "Premium Plan", price: 49 }
    ],
    stakeholders: [
      { id: "finance", name: "Finance", weight: 0.3 },
      { id: "sales", name: "Sales", weight: 0.7 }
    ]
  },
  ["options[0].price", "stakeholders[1].weight"],  // Parameters to vary
  [-20, -10, 10, 20],                             // Percentage variations
  15                                               // Max variants to generate
);

console.log(sweepResult.variants.length); // Generated variant count
console.log(sweepResult.summary.bestVariant); // ID of top-ranked variant
```

### Sweep Response Structure
```javascript
{
  "schema": "sweep.v1",
  "timestamp": "2024-09-27T10:00:00.000Z",
  "baseScenario": {
    "id": "pricing-base",
    "baseline": { /* Original scenario */ }
  },
  "parameters": {
    "targetPaths": ["options[0].price", "stakeholders[1].weight"],
    "variations": [-20, -10, 10, 20],
    "maxVariants": 15
  },
  "variants": [
    {
      "id": "var-1",
      "description": "options[0].price: 29.000 → 34.800 (+20%)",
      "modifications": [
        {
          "path": "options[0].price",
          "originalValue": 29,
          "newValue": 34.8,
          "changePercent": 20
        }
      ],
      "scenario": { /* Modified scenario */ }
    }
  ],
  "rankings": [
    {
      "variantId": "var-1",
      "rank": 1,
      "score": 87.3
    }
  ],
  "summary": {
    "variantsGenerated": 12,
    "bestVariant": "var-1",
    "worstVariant": "var-12",
    "averageScore": 72.1
  }
}
```

### Sweep Feature Flag
**Environment Variable**: `SWEEP_ENABLE=1` (required)
**Default**: OFF (returns 404 when disabled)

```bash
# Enable parameter sweeps in development
export SWEEP_ENABLE=1

# Test sweep availability
curl -I "http://localhost:3001/compare/sweep"
# Enabled: 405 Method Not Allowed (POST required)
# Disabled: 404 Not Found
```

### Parameter Path Syntax
```javascript
// Supported path formats for parameter targeting
const SUPPORTED_PATHS = [
  "options[0].price",              // Array index access
  "stakeholders[finance].weight",  // Object key access
  "constraints.budget.max",        // Nested object property
  "metrics[0].target",            // Array element property
  "assumptions.growth_rate"        // Simple property
];

// Path validation examples
const validPaths = [
  "options[0].name",              // ✅ String property
  "stakeholders[0].influence",    // ✅ Numeric property
  "constraints.timeline.months"   // ✅ Nested numeric
];

const invalidPaths = [
  "options[999].price",           // ❌ Index out of bounds
  "nonexistent.property",         // ❌ Property doesn't exist
  "options.name"                  // ❌ Missing array index
];
```

### Sweep Limits and Safety
```javascript
// Parameter sweep constraints
const SWEEP_LIMITS = {
  maxVariants: 50,              // Maximum variants per request
  minVariants: 1,               // Minimum variants required
  maxPaths: 10,                 // Maximum target paths
  weightThreshold: 0.1,         // Minimum weight value for stakeholders
  validationTimeout: 5000       // Request timeout (ms)
};

// Automatic filtering rules
const FILTERING_RULES = {
  skipNegativeWeights: true,    // Skip variants with negative stakeholder weights
  skipZeroValues: true,         // Skip variants that would create zero values
  skipInvalidRanges: true       // Skip variants outside reasonable bounds
};
```

## 🔗 Share Links

### Template Encoding
```javascript
// Compress template for sharing
async function createShareLink(template) {
  const response = await fetch('/templates/encode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template })
  });

  const { data } = await response.json();
  return `${window.location.origin}/scenario?data=${encodeURIComponent(data)}`;
}

// Usage
const shareUrl = await createShareLink(myTemplate);
// Result: https://app.com/scenario?data=eJyrVkrLTSlJLbJS...
```

### Template Decoding
```javascript
// Decode shared template
async function loadFromShareLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const shareData = urlParams.get('data');

  if (shareData) {
    const response = await fetch(`/templates/decode?data=${encodeURIComponent(shareData)}`);
    const { template } = await response.json();
    return template;
  }
}

// Auto-load shared scenarios
const sharedTemplate = await loadFromShareLink();
if (sharedTemplate) {
  loadScenario(sharedTemplate);
}
```

### Share Link Limits
- **Compressed Size**: 2KB maximum
- **Node Count**: 12 nodes maximum (options + stakeholders + constraints + metrics)
- **Format**: Base64-encoded compressed JSON

## 🧪 cURL Examples

### Compare Scenarios
```bash
curl -X POST "http://localhost:3001/compare" \
  -H "Content-Type: application/json" \
  -d '{
    "left": {"scenarioId": "pricing-v1", "seed": 42},
    "right": {"scenarioId": "pricing-v2", "seed": 42}
  }'
```

### Encode Template
```bash
curl -X POST "http://localhost:3001/templates/encode" \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "scenario": {
        "title": "Test Decision",
        "options": [
          {"id": "a", "name": "Option A"},
          {"id": "b", "name": "Option B"}
        ]
      }
    }
  }'
```

### Decode Template
```bash
curl "http://localhost:3001/templates/decode?data=eJyrVkrLTSlJLbJS..."
```

### Start Stream
```bash
curl -N "http://localhost:3001/stream?route=critique&seed=42" \
  -H "Accept: text/event-stream"
```

### Resume Stream
```bash
curl -N "http://localhost:3001/stream?route=critique&seed=42" \
  -H "Accept: text/event-stream" \
  -H "Last-Event-ID: msg_001"
```

### Cancel Stream
```bash
curl -X POST "http://localhost:3001/cancel" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session_123"}'
```

### Start Jobs Stream
```bash
curl -N "http://localhost:3001/jobs/stream?scenarioId=job_123" \
  -H "Accept: text/event-stream"
```

### Cancel Job
```bash
curl -X POST "http://localhost:3001/jobs/cancel" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "job_123"}'
```

### Fetch Report
```bash
curl "http://localhost:3001/report?scenarioId=demo&seed=42" \
  -H "Accept: application/json"
```

### Health Check
```bash
curl "http://localhost:3001/healthz"
# Expected: { "status": "healthy", "version": "...", "timestamp": "..." }
```

### Lint Scenario
```bash
curl -X POST "http://localhost:3001/lint/scenario" \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": {
      "title": "Test Decision",
      "options": [
        {"id": "a", "name": "Option A"},
        {"id": "b", "name": "Option B"}
      ],
      "stakeholders": [
        {"id": "user", "name": "End User", "influence": 0.7}
      ]
    }
  }'
```

### Parameter Sweep
```bash
curl -X POST "http://localhost:3001/compare/sweep" \
  -H "Content-Type: application/json" \
  -d '{
    "baseScenario": {
      "title": "Pricing Decision",
      "options": [
        {"id": "basic", "name": "Basic", "price": 29}
      ],
      "stakeholders": [
        {"id": "finance", "name": "Finance", "weight": 0.3}
      ]
    },
    "targetPaths": ["options[0].price", "stakeholders[0].weight"],
    "variations": [-20, -10, 10, 20],
    "maxVariants": 10
  }'
```

## ⚙️ Integration Code Example

### Complete Windsurf Integration
```javascript
class ScenarioClient {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async startStream(params) {
    const url = new URL('/stream', this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) url.searchParams.set(key, String(value));
    });

    return new EventSource(url.toString());
  }

  async cancelStream(sessionId) {
    const response = await fetch(`${this.baseUrl}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    return response.json();
  }

  async getReport(scenarioId, seed) {
    const url = new URL('/report', this.baseUrl);
    url.searchParams.set('scenarioId', scenarioId);
    if (seed) url.searchParams.set('seed', seed);

    const response = await fetch(url.toString());
    return response.json();
  }

  async lintScenario(scenario) {
    const response = await fetch(`${this.baseUrl}/lint/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario })
    });
    return response.json();
  }

  async generateParameterSweep(baseScenario, targetPaths, variations, maxVariants = 20) {
    const response = await fetch(`${this.baseUrl}/compare/sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseScenario, targetPaths, variations, maxVariants })
    });
    return response.json();
  }
}

// Usage
const client = new ScenarioClient();
const stream = await client.startStream({
  route: 'critique',
  seed: 42,
  budget: 1000
});
```

## 🔧 Validation Checklist

- [ ] Gateway responding on http://localhost:3001
- [ ] CORS headers present on all endpoints
- [ ] SSE stream emits events with correct structure
- [ ] Cancel returns 202 then 409 for same session
- [ ] Resume works with Last-Event-ID header
- [ ] Report v1 structure matches contract
- [ ] Health endpoint returns service status
- [ ] Security headers prevent caching
- [ ] Deterministic replay with same seed
- [ ] No request bodies in logs
- [ ] Linter returns 404 when LINT_ENABLE=0, validates when enabled
- [ ] Sweep returns 404 when SWEEP_ENABLE=0, generates variants when enabled
- [ ] Lint response includes schema: lint.v1 and quality score
- [ ] Sweep response includes schema: sweep.v1 and variant rankings

## ⚠️ Error Handling

### Rate Limiting
- **RPM Limit**: 60 requests per minute per origin (default)
- **Daily Tokens**: 50,000 tokens per day per origin (default)
- **Response**: HTTP 429 with `Retry-After` header

```javascript
// Handle rate limits gracefully
async function safeApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'];
      if (retryAfter) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return await apiFunction(); // Retry once
      }
    }
    throw error;
  }
}
```

### Template Size Limits
- **Max Compressed Size**: 2KB
- **Max Nodes**: 12 (options + stakeholders + constraints + metrics)

```javascript
// Validate before encoding
function validateTemplateSize(template) {
  const nodeCount = countNodes(template.scenario);
  if (nodeCount > 12) {
    throw new Error(`Template too complex (${nodeCount}/12 nodes)`);
  }
}
```

### Error Response Format
All endpoints return consistent error structure:
```json
{
  "type": "BAD_INPUT|RATE_LIMIT|INTERNAL_ERROR",
  "message": "Human-readable error description",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```

## 🚨 Safety Notes

1. **No Secrets**: All authentication disabled in pilot mode
2. **No PII**: Request/response bodies never logged
3. **Rate Limiting OFF**: No quotas enforced
4. **Simulation Available**: Can switch back to fixtures anytime
5. **Kill Switch**: `GLOBAL_KILL_SWITCH=true` disables all endpoints

## 🚀 Pilot Day Operations

### Quick Deployment Check
**Base URL**: `http://localhost:3001`
**CORS Origins**: `http://localhost:3000,http://localhost:5173,http://localhost:8080`

### 60-Second Smoke Test
1. **Health Check** (10s):
   ```bash
   curl http://localhost:3001/healthz
   # Expected: {"status":"healthy","version":"..."}
   ```

2. **CORS Diagnostic** (15s):
   - Open: `http://localhost:3001/origin-check.html`
   - Test origin: `http://localhost:5173`
   - Expected: ✅ Origin allowed with explanation

3. **Demo Interface** (20s):
   - Open: `http://localhost:3001/demo.html`
   - Click "Start Analysis" with seed 42
   - Expected: Stream of tokens, deterministic output

4. **Report Validation** (15s):
   ```bash
   curl "http://localhost:3001/report?scenarioId=demo&seed=42"
   # Expected: {"schema":"report.v1","meta":{"seed":42},...}
   ```

### Essential Links
- **Demo Interface**: [demo.html](../public/demo.html)
- **RC Walkthrough**: [rc-walkthrough.md](../rc-walkthrough.md)
- **CORS Diagnostic**: [origin-check.html](../public/origin-check.html)
- **Ops Console**: [ops-console.html](../public/ops-console.html) (requires `OPS_CONSOLE_ENABLE=1`)

### Pilot Controls Access
**Environment**: Set `OPS_CONSOLE_ENABLE=1` to access:
- **GET /ops/flags**: Feature flags status
- **GET /ops/limits**: System limits
- **GET /ops/queue**: Processing queue
- **POST /ops/toggle-flag**: Dev-only toggles

### Emergency Procedures
- **Kill Switch**: Set `GLOBAL_KILL_SWITCH=true` to disable all endpoints
- **Revert to Fixtures**: Set `USE_MOCK_DATA=true` and `USE_SIMULATION=true`
- **CORS Issues**: Use Origin Doctor at `/origin-check.html`
- **Performance**: Monitor with SLO Guard (cancel latency ≤150ms target)

---

**Live-Swap Complete**: Replace fixture URLs with base URLs above and flip USE_MOCK_DATA/USE_SIMULATION flags to false.