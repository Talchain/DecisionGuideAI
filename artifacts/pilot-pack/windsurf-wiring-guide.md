# Windsurf Wiring Guide

**Generated from UI Kick-start Pack**: `ui-kickstart-2025-09-25-944111.zip`

Quick integration snippets for wiring DecisionGuide AI into Windsurf locally without servers.

> 💡 **Quick Start**: For copy-paste integration, see [Windsurf Drop-In Note](./windsurf-dropin-note.md) with 30 lines of code for complete Stream/Jobs/Report components.

## 🔌 1. SSE Stream Integration

```typescript
// Wire up Server-Sent Events streaming with fixtures
import { SSEEvent, TokenEventData } from './types/sse-events';

const connectStream = (sessionId: string, route: string = 'critique') => {
  const eventSource = new EventSource(`/stream?route=${route}&sessionId=${sessionId}`);

  eventSource.onmessage = (event) => {
    const data: TokenEventData = JSON.parse(event.data);
    handleStreamToken(data.text);
  };

  eventSource.onerror = () => {
    handleStreamError('Connection lost');
  };

  return eventSource;
};

// Cancel stream
const cancelStream = (eventSource: EventSource) => {
  eventSource.close();
  fetch('/cancel', { method: 'POST' });
};
```

## 📊 2. Jobs Progress Integration

```typescript
// Mock jobs progress with fixtures
import type { JobsProgressEvent } from './types/ui-models';

const mockJobProgress = (jobId: string, onProgress: (n: number) => void) => {
  const steps = [0, 25, 50, 75, 100];
  let current = 0;

  const interval = setInterval(() => {
    if (current >= steps.length) {
      clearInterval(interval);
      return;
    }
    onProgress(steps[current]);
    current++;
  }, 1000);

  return () => clearInterval(interval); // Cancel function
};

// Usage
const cancel = mockJobProgress('job_123', (progress) => {
  updateProgressBar(progress);
  if (progress === 100) showReportButton();
});
```

## 📋 3. Report Drawer Integration

```typescript
// Load and display Report v1
import type { ReportV1 } from './types/report-v1';
import sampleReport from './samples/report-v1-sample.json';

const openReportDrawer = async (analysisId: string) => {
  // In Windsurf, this would fetch from Gateway
  // For local dev, use fixture:
  const report: ReportV1 = sampleReport;

  renderReport({
    title: report.decision?.title || 'Analysis Report',
    recommendation: report.recommendation?.primary,
    options: report.decision?.options || [],
    confidence: report.analysis?.confidence || 'medium'
  });
};

// Report UI component
const ReportDrawer = ({ report }: { report: ReportV1 }) => (
  <div className="report-drawer">
    <h2>{report.decision.title}</h2>
    <div className="recommendation">
      <strong>Recommendation:</strong> {report.recommendation.primary}
    </div>
    <div className="options">
      {report.decision.options.map(option => (
        <div key={option.id} className="option">
          <h3>{option.name}</h3>
          <p>Score: {option.score}/100</p>
          <p>{option.description}</p>
        </div>
      ))}
    </div>
  </div>
);
```

## 🎯 4. Event Handling Patterns

```typescript
// Resume-once pattern (from stream-resume-once fixture)
const handleStreamResume = (eventSource: EventSource, lastEventId?: string) => {
  if (lastEventId) {
    // Windsurf should set Last-Event-ID header
    eventSource.close();
    return new EventSource(`/stream?lastEventId=${lastEventId}`);
  }
  return eventSource;
};

// Cancel with latency tracking (from fixtures)
const fastCancel = async (sessionId: string) => {
  const start = performance.now();
  await fetch(`/cancel?sessionId=${sessionId}`, { method: 'POST' });
  const latency = performance.now() - start;

  // P0 requirement: ≤150ms
  console.log(`Cancel latency: ${latency}ms`);
  return latency <= 150;
};
```

## ⚙️ 5. Configuration (Keep OFF by default)

```typescript
// Windsurf integration config - SAFE DEFAULTS
export const windsurfConfig = {
  // All powerful features OFF by default
  ENABLE_RATE_LIMITING: false,
  ENABLE_CACHE: false,
  ENABLE_USAGE_TRACKING: false,
  ENABLE_MONITORING: false,
  ENABLE_SECRET_HYGIENE_BLOCKING: false,
  ENABLE_SLOS: false,

  // Safe simulation mode
  USE_MOCK_DATA: true,
  GATEWAY_URL: 'http://localhost:3001', // Only when real gateway available

  // Seed for deterministic replay
  DEFAULT_SEED: 42,
  ENABLE_SEED_ECHO: true
};

// Usage in Windsurf
const startAnalysis = (params: {
  route: string;
  sessionId: string;
  seed?: number;
  budget?: number;
}) => {
  const url = new URL('/stream', windsurfConfig.GATEWAY_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });

  return new EventSource(url.toString());
};
```

## 🛡️ 6. Error Handling & Safety

```typescript
// Safe error handling (no PII logging)
const handleAnalysisError = (error: any) => {
  // Never log request/response bodies or personal data
  console.log('Analysis error:', error.type || 'unknown');

  // Show user-friendly message
  showErrorMessage('Analysis failed. Please try again.');

  // Reset UI state
  resetAnalysisUI();
};

// Secret hygiene check
const validateInput = (input: string): boolean => {
  // Block obvious secrets (when hygiene enabled)
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{32,}/,     // API keys
    /[a-zA-Z0-9]{32,}-[a-zA-Z0-9]{16,}/, // Tokens
  ];

  return !secretPatterns.some(pattern => pattern.test(input));
};
```

## 🚀 Quick Integration Checklist

- [ ] Import types from `./types/` directory
- [ ] Use fixtures from `./ui-fixtures/` for realistic states
- [ ] Implement SSE streaming with resume capability
- [ ] Add jobs progress with cancel functionality
- [ ] Wire up report drawer with Report v1 schema
- [ ] Keep all powerful features OFF by default
- [ ] Test cancel latency ≤150ms requirement
- [ ] Verify no secrets are logged
- [ ] Use seed parameter for deterministic replay

## 🔗 Key Files from Kick-start Pack

- **Types**: `types/sse-events.d.ts`, `types/report-v1.d.ts`
- **Fixtures**: `ui-fixtures/stream-resume-once/`, `ui-fixtures/jobs-cancel-50/`
- **Samples**: `samples/report-v1-sample.json`
- **View Models**: `ui-viewmodels/example/stream.happy.json`

---
*Generated from UI Kick-start Pack `ui-kickstart-2025-09-25-944111`*