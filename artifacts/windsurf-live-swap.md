# Windsurf Live-Swap Wiring Card

**Purpose**: Single reference for switching from fixtures to live Scenario Sandbox PoC
**Mode**: Live integration (replace simulation with real Gateway endpoints)
**Safety**: All powerful features remain OFF by default

## 🔌 Base URLs

### Core Endpoints
```javascript
const LIVE_CONFIG = {
  STREAM_URL: 'http://localhost:3001/stream',
  CANCEL_URL: 'http://localhost:3001/cancel',
  JOBS_STREAM_URL: 'http://localhost:3001/jobs/stream',
  JOBS_CANCEL_URL: 'http://localhost:3001/jobs/cancel',
  REPORT_URL: 'http://localhost:3001/report',
  HEALTH_URL: 'http://localhost:3001/healthz'
};
```

### CORS Origins
```yaml
# Add to Gateway environment
CORS_ORIGINS: "http://localhost:3000,http://localhost:5173,http://localhost:8080"
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

## 🧪 cURL Examples

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

## 🚨 Safety Notes

1. **No Secrets**: All authentication disabled in pilot mode
2. **No PII**: Request/response bodies never logged
3. **Rate Limiting OFF**: No quotas enforced
4. **Simulation Available**: Can switch back to fixtures anytime
5. **Kill Switch**: `GLOBAL_KILL_SWITCH=true` disables all endpoints

---

**Live-Swap Complete**: Replace fixture URLs with base URLs above and flip USE_MOCK_DATA/USE_SIMULATION flags to false.