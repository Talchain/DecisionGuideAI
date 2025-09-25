# TypeScript Types Import Guide

## Generated Types

Three type definition files are available:

- `artifacts/types/report-v1.d.ts` - Report v1 API types
- `artifacts/types/sse-events.d.ts` - Server-Sent Events types
- `artifacts/types/ui-models.d.ts` - UI View Model types

## Import Examples

### Report v1 Types
```typescript
import type {
  ReportV1,
  ReportV1Meta,
  ReportV1Step,
  ReportV1Response
} from './artifacts/types/report-v1';

// Using the types
const report: ReportV1 = {
  version: '1.0',
  meta: {
    seed: 42,
    timestamp: new Date().toISOString(),
    duration: 5000,
    route: '/api/analysis',
    status: 'completed'
  },
  steps: [],
  totals: {
    totalSteps: 3,
    completedSteps: 3,
    totalTokens: 1250,
    totalCost: 0.025,
    totalDuration: 5000
  }
};
```

### SSE Event Types
```typescript
import type {
  SSEEvent,
  TokenEventData,
  CompleteEventData,
  TypedSSEEvents
} from './artifacts/types/sse-events';

// Parse SSE event data
function parseTokenEvent(event: SSEEvent): TokenEventData {
  return JSON.parse(event.data) as TokenEventData;
}

// Type-safe event handling
function handleTypedEvent<T extends keyof TypedSSEEvents>(
  eventType: T,
  event: TypedSSEEvents[T]
): void {
  // event.parsedData is properly typed based on eventType
  if (eventType === 'token') {
    console.log('Token:', event.parsedData.text);
  }
}
```

### UI View Model Types
```typescript
import type {
  StreamViewModel,
  JobsViewModel,
  ReportViewModel,
  UIState
} from './artifacts/types/ui-models';

// Component props
interface StreamPanelProps {
  viewModel: StreamViewModel;
  onCancel: () => void;
}

function StreamPanel({ viewModel, onCancel }: StreamPanelProps) {
  return (
    <div>
      <div>Status: {viewModel.status}</div>
      <div>Tokens: {viewModel.tokens.length}</div>
      {viewModel.error && (
        <div>Error: {viewModel.error.message}</div>
      )}
    </div>
  );
}
```

## Type Compilation Test

To verify the types compile correctly:

```bash
npx tsc --noEmit --skipLibCheck artifacts/types/*.d.ts
```

All types are designed to be zero-dependency and compatible with modern TypeScript versions (4.0+).
