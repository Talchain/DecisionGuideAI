# DecisionGuide AI SDK

TypeScript SDK for interacting with the DecisionGuide AI Contract Wall API.

## Quick Start

```typescript
import { DecisionGuideClient } from './olumi-poc-sdk';

const client = new DecisionGuideClient({
  baseUrl: 'http://localhost:3001',
  apiKey: 'your-api-key' // Optional
});
```

## Examples

### 1. Start Stream with Resume-Once Support

```typescript
// Start a new analysis stream
async function startStream(seed: string) {
  try {
    const sessionId = `session-${Date.now()}`;
    const response = await fetch(`${client.baseUrl}/stream?sessionId=${sessionId}&scenarioId=${seed}`, {
      headers: {
        'Accept': 'text/event-stream',
        ...(client.apiKey && { 'X-API-Key': client.apiKey })
      }
    });

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ Stream started for session: ${sessionId}`);
    return { sessionId, stream: response.body };

  } catch (error) {
    console.error('❌ Stream start failed:', error);
    throw error;
  }
}

// Resume stream with Last-Event-ID (resume-once enforcement)
async function resumeStream(sessionId: string, lastEventId: string) {
  try {
    const response = await fetch(`${client.baseUrl}/stream?sessionId=${sessionId}`, {
      headers: {
        'Accept': 'text/event-stream',
        'Last-Event-ID': lastEventId, // Resume from this event
        ...(client.apiKey && { 'X-API-Key': client.apiKey })
      }
    });

    if (response.status === 400) {
      const error = await response.json();
      if (error.message.includes('resume-once limit')) {
        console.log('⚠️ Resume-once limit reached - session already resumed');
        return null;
      }
    }

    if (!response.ok) {
      throw new Error(`Resume failed: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ Stream resumed from event: ${lastEventId}`);
    return response.body;

  } catch (error) {
    console.error('❌ Stream resume failed:', error);
    throw error;
  }
}

// Usage
const { sessionId } = await startStream('abc123def456');
// ... later, if connection drops ...
await resumeStream(sessionId, 'evt-5'); // Resume from event 5
await resumeStream(sessionId, 'evt-8'); // ❌ This will fail due to resume-once limit
```

### 2. Cancel Job with Timing

```typescript
async function cancelJob(jobId: string, timing: boolean = true) {
  const startTime = performance.now();

  try {
    const response = await fetch(`${client.baseUrl}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(client.apiKey && { 'X-API-Key': client.apiKey })
      },
      body: JSON.stringify({
        jobId,
        reason: 'User requested cancellation'
      })
    });

    const duration = performance.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Cancel failed: ${error.code} - ${error.message}`);
    }

    const result = await response.json();

    if (timing) {
      console.log(`✅ Job ${jobId} cancelled in ${duration.toFixed(2)}ms`);
      console.log(`📊 Cancel timing: ${duration < 100 ? 'Fast' : duration < 500 ? 'Normal' : 'Slow'}`);
    }

    return {
      cancelled: result.cancelled,
      jobId: result.jobId,
      duration: Math.round(duration),
      timestamp: result.timestamp
    };

  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`❌ Cancel failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

// Usage
await cancelJob('job-123', true); // With timing
await cancelJob('job-456', false); // Without timing logs
```

### 3. Fetch Report with Schema Validation

```typescript
interface ReportPayload {
  schema: 'report.v1';
  meta: {
    seed: string;
    timestamp: string;
    version: string;
    analysisType: string;
  };
  content: {
    title: string;
    summary: string;
    recommendations?: Array<{
      action: string;
      confidence: number;
      rationale?: string;
    }>;
  };
}

async function fetchReport(payload: ReportPayload): Promise<{ reportId: string; validated: boolean }> {
  try {
    // Validate schema before sending
    if (payload.schema !== 'report.v1') {
      throw new Error(`Invalid schema: expected 'report.v1', got '${payload.schema}'`);
    }

    if (!payload.meta?.seed) {
      throw new Error('Report meta.seed is required');
    }

    console.log(`📝 Submitting report with seed: ${payload.meta.seed}`);

    const response = await fetch(`${client.baseUrl}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(client.apiKey && { 'X-API-Key': client.apiKey })
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 422) {
      const error = await response.json();
      console.error('❌ Validation failed:', error.validationErrors);
      throw new Error(`Report validation failed: ${error.validationErrors?.join(', ')}`);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Report submission failed: ${error.code} - ${error.message}`);
    }

    const result = await response.json();

    console.log(`✅ Report submitted successfully: ${result.reportId}`);
    console.log(`🔍 Schema validation: ${result.validationPassed ? 'PASSED' : 'FAILED'}`);

    return {
      reportId: result.reportId,
      validated: result.validationPassed
    };

  } catch (error) {
    console.error('❌ Report submission failed:', error);
    throw error;
  }
}

// Usage
const reportPayload: ReportPayload = {
  schema: 'report.v1',
  meta: {
    seed: 'abc123def456',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    analysisType: 'decision'
  },
  content: {
    title: 'Market Entry Analysis',
    summary: 'Comprehensive analysis of European market entry strategy',
    recommendations: [
      {
        action: 'Proceed with pilot program',
        confidence: 0.85,
        rationale: 'Strong market indicators and manageable risk'
      }
    ]
  }
};

const { reportId, validated } = await fetchReport(reportPayload);
```

### 4. Get Health Status

```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  p95_ms: number;
  replay: {
    lastStatus: 'success' | 'failure' | 'timeout';
    refusals: number;
    retries: number;
    resumeRefused: number;
    lastTs: string;
  };
  test_routes_enabled: boolean;
}

async function getHealth(): Promise<HealthResponse> {
  try {
    const response = await fetch(`${client.baseUrl}/health`, {
      headers: {
        ...(client.apiKey && { 'X-API-Key': client.apiKey })
      }
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    const health: HealthResponse = await response.json();

    // Log health status with indicators
    const statusIcon = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴'
    }[health.status];

    console.log(`${statusIcon} System Status: ${health.status.toUpperCase()}`);
    console.log(`⚡ P95 Response Time: ${health.p95_ms}ms`);
    console.log(`🔄 Replay Status: ${health.replay.lastStatus} (${health.replay.resumeRefused} resume refused)`);
    console.log(`🧪 Test Routes: ${health.test_routes_enabled ? 'ENABLED' : 'DISABLED'}`);

    // Performance assessment
    if (health.p95_ms > 3000) {
      console.warn('⚠️ High response times detected');
    }

    return health;

  } catch (error) {
    console.error('❌ Health check failed:', error);
    throw error;
  }
}

// Usage with health monitoring
const health = await getHealth();

if (health.status === 'unhealthy') {
  console.log('🚨 System unhealthy - consider waiting before making requests');
} else if (health.status === 'degraded') {
  console.log('⚠️ System degraded - expect slower responses');
}

// Monitor resume-once enforcement
if (health.replay.resumeRefused > 0) {
  console.log(`📊 Resume-once enforcement active: ${health.replay.resumeRefused} refusals recorded`);
}
```

## Error Handling

The SDK integrates with the comprehensive error taxonomy. See [Error Mapping Guide](../docs/ERROR-MAPPING-GUIDE.md) for detailed error handling patterns.

```typescript
// Example: Comprehensive error handling
async function robustRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, options);

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const resetTime = response.headers.get('X-RateLimit-Reset');

      console.log(`Rate limited. Retry after: ${retryAfter}s, resets at: ${new Date(parseInt(resetTime!) * 1000)}`);

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter!) * 1000));
      return await fetch(url, options);
    }

    // Handle retryable errors
    if (response.status >= 500) {
      const error = await response.json();
      if (error.retryable) {
        console.log(`Retryable error: ${error.code}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await fetch(url, options);
      }
    }

    return response;

  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

## Configuration

```typescript
interface ClientConfig {
  baseUrl: string;          // e.g., 'http://localhost:3001'
  apiKey?: string;          // Optional API key
  timeout?: number;         // Request timeout in ms
  retryAttempts?: number;   // Number of retry attempts
}

const client = new DecisionGuideClient({
  baseUrl: process.env.DECISION_GUIDE_URL || 'http://localhost:3001',
  apiKey: process.env.DECISION_GUIDE_API_KEY,
  timeout: 30000,
  retryAttempts: 3
});
```

For complete API documentation, see the [OpenAPI specification](../artifacts/contracts/openapi-v1.yml).