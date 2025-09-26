# DecisionGuide AI UI Kickstart Pack

Drop-in pack for Windsurf UI development with types, view-models, and simulation adapters - completely offline-ready.

## 🚀 Quick Install

### Option 1: Local Install (Recommended)
```bash
# From your Windsurf project root
npm install ./artifacts/decisionguide-ui-kickstart-pack-1.0.0.tgz

# Alternative: direct path to the pack
npm install ./path/to/decisionguide-ui-kickstart-pack-1.0.0.tgz
```

### Option 2: Extract and Copy
```bash
# Extract the pack
tar -xzf ui-kickstart-pack.tgz

# Copy types to your project
cp -r package/src/types ./src/
cp -r package/view-models ./src/
cp -r package/fixtures ./src/
```

## 📦 What's Included

### 🎯 TypeScript Types
- **SSE Events**: Complete type definitions for Server-Sent Events
- **Report v1**: Full typing for analysis reports
- **View Models**: Stream, Jobs, and Report view model interfaces

### 🎨 View Models & Fixtures
- **Offline-ready data**: Pre-built view models for all scenarios
- **V3 Fixtures**: Complete fixture set for UI development
- **Test Data**: Realistic sample data for every component state

### ⚡ Simulation Adapters
- **`openStreamSim()`**: Mock SSE streaming for token generation
- **`openJobStreamSim()`**: Simulated job progress updates
- **`loadReportSim()`**: Offline report loading
- **`loadViewModelSim()`**: Fixture-based view model loading

## 🎪 Usage Examples

### Basic SSE Stream Simulation
```typescript
import { openStreamSim } from '@decisionguide/ui-kickstart-pack';

// Simple token stream
for await (const event of openStreamSim()) {
  console.log(event.event, JSON.parse(event.data));
}

// Stream with cancellation
for await (const event of openStreamSim({
  tokenCount: 20,
  shouldCancel: true
})) {
  console.log(event.event, JSON.parse(event.data));
}
```

### Job Progress Simulation
```typescript
import { openJobStreamSim } from '@decisionguide/ui-kickstart-pack';

// Job that cancels at 50%
for await (const event of openJobStreamSim({
  jobName: 'Data Analysis',
  shouldCancelAt50: true
})) {
  console.log(event.event, JSON.parse(event.data));
}
```

### Report Loading
```typescript
import { loadReportSim } from '@decisionguide/ui-kickstart-pack';

const report = await loadReportSim('sample');
console.log('Report metadata:', report.meta);
console.log('Total cost:', report.totals.totalCost);
```

### View Model Loading
```typescript
import { loadViewModelSim } from '@decisionguide/ui-kickstart-pack';

// Load specific fixture
const streamModel = await loadViewModelSim('stream-resume-once');
const jobsModel = await loadViewModelSim('jobs-cancel-50');
const reportModel = await loadViewModelSim('report-no-data');
```

### React Component Example
```typescript
import React, { useEffect, useState } from 'react';
import {
  openStreamSim,
  TokenEventData,
  SSEEvent
} from '@decisionguide/ui-kickstart-pack';

function StreamingDemo() {
  const [tokens, setTokens] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = async () => {
    setIsStreaming(true);
    setTokens([]);

    try {
      for await (const event of openStreamSim({
        tokenCount: 15,
        tokenDelay: 200
      })) {
        if (event.event === 'token') {
          const tokenData: TokenEventData = JSON.parse(event.data);
          setTokens(prev => [...prev, tokenData.text]);
        } else if (event.event === 'complete') {
          setIsStreaming(false);
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      setIsStreaming(false);
    }
  };

  return (
    <div>
      <button onClick={startStream} disabled={isStreaming}>
        {isStreaming ? 'Streaming...' : 'Start Stream'}
      </button>
      <div>{tokens.join('')}</div>
    </div>
  );
}
```

## 📁 Directory Structure

```
ui-kickstart-pack/
├── package.json          # NPM package configuration
├── README.md             # This file
├── src/
│   ├── index.ts          # Main exports
│   ├── sse-events.d.ts   # SSE event type definitions
│   ├── report-v1.d.ts    # Report type definitions
│   └── adapters.ts       # Simulation functions
├── view-models/          # Pre-built view models
│   ├── example/          # Example view models
│   └── sample-framework/ # Framework samples
└── fixtures/             # Test fixtures
    ├── README.md         # Fixture documentation
    └── *.json            # Fixture data files
```

## 🎛️ Configuration Options

### Stream Simulation Config
```typescript
interface MockStreamConfig {
  sessionId?: string;      // Custom session ID
  tokenCount?: number;     // Number of tokens (default: 10)
  tokenDelay?: number;     // Delay between tokens (default: 100ms)
  shouldCancel?: boolean;  // Simulate cancellation
  shouldError?: boolean;   // Simulate error
  model?: string;          // Model name (default: 'gpt-4')
}
```

### Job Simulation Config
```typescript
interface MockJobConfig {
  sessionId?: string;        // Custom session ID
  jobName?: string;          // Job display name
  totalSteps?: number;       // Progress steps (default: 10)
  progressDelay?: number;    // Delay between updates (default: 500ms)
  shouldCancelAt50?: boolean; // Cancel at 50% progress
}
```

## 🚦 Testing Scenarios

The pack includes pre-configured scenarios for testing:

- **Happy Path**: Normal streaming completion
- **Resume Stream**: Stream with reconnection and deduplication
- **Mid-stream Cancel**: User cancellation during streaming
- **Stream Error**: Error handling during streaming
- **Jobs Cancel**: Job cancellation at various progress points
- **Report No-Data**: Empty/unavailable report states

## 🛠️ Development

### Build the Pack
```bash
cd artifacts/ui-kickstart-pack
npm run build
```

### Type Check
```bash
npm run typecheck
```

### Create Tarball
```bash
npm pack
```

## 🔧 Troubleshooting

### TypeScript Errors
If you get type errors, ensure your project's TypeScript version is compatible:
```bash
npm install typescript@^5.0.0
```

### Missing Dependencies
All required types are included in the pack. No additional dependencies needed for basic usage.

### EventSource Polyfill
For older browsers, you may need an EventSource polyfill:
```bash
npm install event-source-polyfill
```

## 📋 API Reference

### Simulation Functions

#### `openStreamSim(config?): AsyncIterable<SSEEvent>`
Creates a simulated SSE stream for token generation.

#### `openJobStreamSim(config?): AsyncIterable<SSEEvent>`
Creates a simulated job progress stream.

#### `loadReportSim(reportId?): Promise<ReportV1>`
Loads a simulated analysis report.

#### `loadViewModelSim(fixtureName): Promise<ViewModel>`
Loads a view model based on fixture name.

### Utility Classes

#### `MockEventSource`
A mock EventSource implementation for testing without network connections.

## 🎯 Next Steps

1. **Install the pack** in your Windsurf project
2. **Import types** for your components
3. **Use simulation adapters** for offline development
4. **Load view models** for realistic component states
5. **Test all scenarios** using the included fixtures

## 🤝 Support

This pack is designed to work completely offline. All data is simulated and no network requests are made.

For issues with the DecisionGuide AI platform itself, check the main project documentation.

---

*Generated by DecisionGuide AI Platform - Version 1.0*