# Windsurf Drop-In Integration Note

Copy-paste guide for integrating DecisionGuide AI simulation into Windsurf chat UI.

## 🚀 Quick Install

```bash
npm install ./artifacts/decisionguide-ui-kickstart-pack-1.0.0.tgz
```

## 📝 Import Line

```typescript
import { openStreamSim, openJobStreamSim, loadReportSim, TokenEventData, JobEventData, ReportData } from '@decisionguide/ui-kickstart-pack';
```

## 🎯 Stream Component (5-10 lines)

```typescript
// React Stream Component
import React, { useEffect, useState } from 'react';

export const StreamDemo = () => {
  const [content, setContent] = useState('');

  useEffect(() => {
    const runStream = async () => {
      for await (const event of openStreamSim({ tokenCount: 20 })) {
        if (event.data) {
          const data = JSON.parse(event.data) as TokenEventData;
          setContent(prev => prev + data.token);
        }
      }
    };
    runStream();
  }, []);

  return <div className="stream-content">{content}</div>;
};
```

## ⚙️ Jobs Component (5-10 lines)

```typescript
// React Jobs Component
export const JobsDemo = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const runJob = async () => {
      for await (const event of openJobStreamSim({ totalSteps: 8 })) {
        if (event.data) {
          const data = JSON.parse(event.data) as JobEventData;
          setProgress(data.progress);
          setStatus(data.step);
        }
      }
    };
    runJob();
  }, []);

  return (
    <div>
      <div>Progress: {progress}%</div>
      <div>Status: {status}</div>
    </div>
  );
};
```

## 📊 Report Component (5-10 lines)

```typescript
// React Report Component
export const ReportDemo = () => {
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      const data = await loadReportSim();
      setReport(data);
    };
    loadReport();
  }, []);

  if (!report) return <div>Loading...</div>;

  return (
    <div>
      <h2>{report.title}</h2>
      <p>{report.summary}</p>
      <h3>Scenarios:</h3>
      {report.analysis.scenarios.map((scenario, i) => (
        <div key={i}>
          <strong>{scenario.name}</strong>: {scenario.recommendation}
        </div>
      ))}
    </div>
  );
};
```

## ✅ Essential Checklist

### Stop/Cancel Support
```typescript
const [controller, setController] = useState<AbortController | null>(null);

const startStream = async () => {
  const ctrl = new AbortController();
  setController(ctrl);

  try {
    for await (const event of openStreamSim({ shouldCancel: false })) {
      if (ctrl.signal.aborted) break;
      // Process event
    }
  } catch (error) {
    if (!ctrl.signal.aborted) {
      console.error('Stream error:', error);
    }
  }
};

const stopStream = () => {
  controller?.abort();
  setController(null);
};
```

### Single Reconnect + Resume
```typescript
const [lastEventId, setLastEventId] = useState(0);
const [reconnectCount, setReconnectCount] = useState(0);

const streamWithReconnect = async () => {
  try {
    for await (const event of openStreamSim({ resumeFromId: lastEventId })) {
      setLastEventId(event.lastEventId || lastEventId + 1);
      // Process event
    }
  } catch (error) {
    if (reconnectCount < 1) {
      setReconnectCount(prev => prev + 1);
      setTimeout(() => streamWithReconnect(), 2000); // Reconnect once after 2s
    }
  }
};
```

### Seed Chip + Transcript Link
```typescript
const [sessionData, setSessionData] = useState({ seed: 12345, sessionId: 'sim-123' });

return (
  <div>
    <div className="seed-chip">
      Seed: {sessionData.seed}
    </div>
    <button onClick={() => exportTranscript(sessionData.sessionId)}>
      📄 Export Transcript
    </button>
  </div>
);

const exportTranscript = (sessionId: string) => {
  // Export transcript functionality
  const transcript = getSessionTranscript(sessionId);
  downloadFile(transcript, `transcript-${sessionId}.txt`);
};
```

### No Payload Logs
```typescript
// ✅ Good: Log timing only
console.log(`Stream completed in ${duration}ms`);

// ❌ Bad: Never log content
console.log('Token received:', tokenData.token); // Don't do this

// ✅ Good: Safe telemetry
telemetry.increment('stream.token.count');
telemetry.timing('stream.duration', duration);
```

## 🔗 Vue.js Alternative

```vue
<template>
  <div>
    <div class="stream-content">{{ streamText }}</div>
    <button @click="startStream">Start Stream</button>
    <button @click="stopStream">Stop</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { openStreamSim, TokenEventData } from '@decisionguide/ui-kickstart-pack';

const streamText = ref('');
const isStreaming = ref(false);

const startStream = async () => {
  isStreaming.value = true;
  for await (const event of openStreamSim()) {
    if (!isStreaming.value) break;
    if (event.data) {
      const data = JSON.parse(event.data) as TokenEventData;
      streamText.value += data.token;
    }
  }
  isStreaming.value = false;
};

const stopStream = () => {
  isStreaming.value = false;
};
</script>
```

## 🎨 Styling Hints

```css
.stream-content {
  font-family: 'Monaco', 'Courier New', monospace;
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  white-space: pre-wrap;
  min-height: 200px;
  overflow-y: auto;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.seed-chip {
  display: inline-block;
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  color: #6c757d;
}
```

## 📦 What's Included

- **Complete TypeScript types** for all events and data structures
- **Simulation adapters** that work offline (no server required)
- **View models** with realistic data for every scenario
- **Deterministic behavior** with seed support for testing
- **Error scenarios** for edge case handling

## 🔄 Live Swap Ready

```typescript
// Development: simulation
const stream = openStreamSim({ tokenCount: 30 });

// Production: swap in real endpoint
const stream = openStream('/api/v1/analysis/stream', {
  sessionId,
  model: 'gpt-4'
});
```

The simulation functions have identical signatures to the real API for seamless swapping.

---

**🎯 Result**: Three working UI components (Stream, Jobs, Report) that render offline and integrate with Windsurf chat interface in under 30 lines of code total.