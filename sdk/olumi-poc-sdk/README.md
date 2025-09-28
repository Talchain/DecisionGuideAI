# Olumi Scenario Sandbox PoC SDK

**Version**: v0.1.0
**Purpose**: Zero-dependency TypeScript client for Scenario Sandbox pilot endpoints

## 🚀 60-Second Usage

### Installation
```bash
# Extract from tarball (not published to registry)
tar -xzf olumi-poc-sdk-v0.1.0.tgz
cd package

# Install as local dependency
npm install ./olumi-poc-sdk-v0.1.0.tgz
```

### Basic Usage
```typescript
import { createClient } from 'olumi-poc-sdk';

// Create client
const client = createClient({
  baseUrl: 'http://localhost:3001'
});

// Stream analysis with deterministic seed
const stream = client.stream({
  scenarioId: 'pricing-decision',
  seed: 42,
  route: 'critique'
});

// Process events
for await (const event of stream) {
  switch (event.type) {
    case 'hello':
      console.log('Stream started:', event.data.sessionId);
      break;
    case 'token':
      console.log('Token:', event.data.text);
      break;
    case 'done':
      console.log('Complete:', event.data.totalTokens, 'tokens');
      break;
    case 'cancelled':
      console.log('Cancelled:', event.data.reason);
      break;
    case 'error':
      console.error('Error:', event.data.message);
      break;
  }
}
```

### Cancel Stream
```typescript
// Cancel active stream
const result = await client.cancel({ runId: 'session_123' });
console.log('Cancel status:', result.status); // 'cancelling' or 'already_cancelled'
```

### Get Structured Report
```typescript
// Fetch analysis report
const report = await client.getReport({
  scenarioId: 'pricing-decision',
  seed: 42
});

console.log('Decision:', report.decision.title);
console.log('Options:', report.decision.options.length);
console.log('Recommendation:', report.recommendation.primary);
```

## 📡 Complete API Reference

### `createClient(config)`
Creates a new Olumi client instance.

```typescript
interface ClientConfig {
  baseUrl: string;                    // Pilot base URL (e.g., 'http://localhost:3001')
  fetchImpl?: typeof fetch;           // Custom fetch (defaults to globalThis.fetch)
  eventSourceImpl?: typeof EventSource; // Custom EventSource (defaults to globalThis.EventSource)
}
```

### `client.stream(params)`
Start SSE analysis stream. Returns `AsyncIterable<SSEEvent>`.

```typescript
interface StreamParams {
  scenarioId: string;          // Scenario identifier
  seed?: number;               // Deterministic seed (e.g., 42)
  budget?: number;             // Time budget in ms (e.g., 1000)
  sessionId?: string;          // Optional session ID (auto-generated if omitted)
  route?: 'critique' | 'analysis' | 'decision'; // Analysis type (default: 'critique')
}
```

**Event Types:**
- `hello` - Stream started
- `token` - Analysis token received
- `cost` - Cost calculation update
- `done` - Stream completed
- `cancelled` - Stream cancelled
- `limited` - Service limited (kill switch)
- `error` - Stream error

### `client.cancel(params)`
Cancel active stream. Returns `Promise<CancelResult>`.

```typescript
interface CancelParams {
  runId: string; // Session ID to cancel
}

interface CancelResult {
  status: 'cancelling' | 'already_cancelled';
  sessionId?: string;
  timestamp: string;
}
```

**Idempotent Behaviour:**
- First call: HTTP 202, status 'cancelling'
- Subsequent calls: HTTP 409, status 'already_cancelled'

### `client.jobsStream(params)`
Start long-running job stream. Returns `AsyncIterable<JobEvent>`.

```typescript
interface JobsStreamParams {
  scenarioId: string;
  seed?: number;
}
```

### `client.jobsCancel(params)`
Cancel long-running job. Returns `Promise<CancelResult>`.

```typescript
interface JobsCancelParams {
  jobId: string;
}
```

### `client.getReport(params)`
Fetch structured analysis report. Returns `Promise<ReportV1>`.

```typescript
interface ReportParams {
  scenarioId: string;
  runId?: string;    // Optional session ID
  seed?: number;     // Optional seed for deterministic results
}

interface ReportV1 {
  decision: {
    title: string;
    options: Array<{
      id: string;
      name: string;
      score: number;
      description: string;
    }>;
  };
  recommendation: {
    primary: string;
  };
  analysis: {
    confidence: string;
  };
  meta: {
    scenarioId: string;
    seed: number;
    timestamp: string;
  };
}
```

## 🔄 Resume-Once Pattern

The SDK handles Last-Event-ID resume automatically within a single stream session. For explicit resume:

```typescript
let lastEventId: string | undefined;

// Capture event ID during stream
for await (const event of stream) {
  lastEventId = event.id;

  if (event.type === 'token' && shouldResume) {
    // Stream will auto-resume from last event if connection drops
    break;
  }
}

// Manual resume not typically needed - handled internally
```

**Resume Rules:**
- Only ONE resume per session
- Uses Last-Event-ID header automatically
- Stream continues from interruption point
- No duplicate events

## 🛡️ Error Handling

```typescript
try {
  for await (const event of client.stream(params)) {
    if (event.type === 'error') {
      console.error('Stream error:', event.data.message);
      break;
    }

    if (event.type === 'limited') {
      console.warn('Service limited:', event.data.message);
      break;
    }

    // Process normal events
  }
} catch (error) {
  console.error('Connection error:', error.message);
}
```

## 🎯 Deterministic Testing

```typescript
// Use consistent seed for reproducible results
const DETERMINISTIC_SEED = 42;

const stream = client.stream({
  scenarioId: 'test-scenario',
  seed: DETERMINISTIC_SEED,
  budget: 500 // 500ms budget for first token
});

// Same seed will produce identical token sequence
for await (const event of stream) {
  if (event.type === 'token') {
    console.log('Deterministic token:', event.data.text);
  }
}
```

## 🌐 Environment Configuration

### Local Development
```typescript
const client = createClient({
  baseUrl: 'http://localhost:3001'
});
```

### Remote Pilot
```typescript
const client = createClient({
  baseUrl: 'https://pilot.example.com'
});
```

### Custom Implementations
```typescript
import fetch from 'node-fetch';
import { EventSource } from 'eventsource';

const client = createClient({
  baseUrl: 'http://localhost:3001',
  fetchImpl: fetch as any,
  eventSourceImpl: EventSource as any
});
```

## 📊 Performance Expectations

Based on v0.1.0 pilot metrics:

| Metric | Target | Typical |
|--------|--------|---------|
| **Time-to-First-Token** | ≤500ms | ~50ms |
| **Cancel Latency** | ≤150ms | ~45ms |
| **Report Generation** | ≤5s | <1s |

## 🔧 Troubleshooting

### CORS Issues
```bash
# Add your origin to pilot CORS_ORIGINS
echo "CORS_ORIGINS=http://localhost:3000,http://localhost:5173" >> pilot-deploy/.env.poc
```

### Connection Failures
```typescript
// Check pilot health first
const healthResponse = await fetch('http://localhost:3001/healthz');
if (!healthResponse.ok) {
  console.error('Pilot service not healthy');
}
```

### EventSource Not Available
```typescript
// For Node.js environments
import { EventSource } from 'eventsource';

const client = createClient({
  baseUrl: 'http://localhost:3001',
  eventSourceImpl: EventSource
});
```

## 📋 TypeScript Integration

```typescript
import type { SSEEvent, ReportV1, OlumiClient } from 'olumi-poc-sdk';

class ScenarioAnalyzer {
  constructor(private client: OlumiClient) {}

  async analyzeWithTimeout(scenarioId: string, timeoutMs = 30000): Promise<ReportV1> {
    const stream = this.client.stream({ scenarioId, seed: 42 });

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Analysis timeout'));
      }, timeoutMs);

      try {
        for await (const event of stream) {
          if (event.type === 'done') {
            clearTimeout(timeout);
            const report = await this.client.getReport({ scenarioId, seed: 42 });
            resolve(report);
            return;
          }
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}
```

## 🔗 Related Resources

- **Live-Swap Guide**: `../artifacts/windsurf-live-swap.md`
- **UAT Checklist**: `../artifacts/checklists/live-swap-uat.md`
- **Integration Harness**: `../artifacts/tools/sse-viewer.html`
- **Starter Templates**: `../artifacts/seed/templates/`

---

**SDK Version**: v0.1.0
**Pilot Compatibility**: v0.1.0-pilot
**License**: MIT
**Support**: Check pilot health endpoint and integration harness