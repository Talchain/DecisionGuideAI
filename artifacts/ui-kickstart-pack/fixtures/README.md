# UI Fixture Packs v3

Deterministic edge-case fixtures that validate against the contract, enabling Windsurf to wire UI components without requiring live Warp endpoints.

## Fixture Sets

### 1. `stream-resume-once/`
**Use Case**: Test SSE streaming with disconnect/resume functionality
**Scenario**: NDJSON SSE with monotonic event IDs, simulated disconnect, single resume via `Last-Event-ID`, no token duplication

**UI Props Shape**:
```typescript
interface StreamResumeProps {
  events: StreamEvent[];
  connectionState: "connected" | "disconnected" | "resumed";
  lastEventId: string | null;
  tokens: string[];
}
```

### 2. `stream-cancel-mid/`
**Use Case**: Test user-initiated stream cancellation
**Scenario**: NDJSON SSE stops mid-run, ends with terminal `done` event carrying `reason: "cancelled"`

**UI Props Shape**:
```typescript
interface StreamCancelProps {
  events: StreamEvent[];
  state: "streaming" | "cancelled" | "done";
  reason?: "cancelled" | "completed" | "error";
  partialContent: string;
}
```

### 3. `stream-error/`
**Use Case**: Test graceful error handling in streaming
**Scenario**: NDJSON SSE emits UI-safe error event with friendly message and retry hint, then terminates cleanly

**UI Props Shape**:
```typescript
interface StreamErrorProps {
  events: StreamEvent[];
  error: {
    message: string;
    retryHint: string;
    code: string;
  };
  state: "error";
}
```

### 4. `jobs-cancel-50/`
**Use Case**: Test job progress tracking with cancellation
**Scenario**: NDJSON SSE progress 0→100 in 10 steps, cancel at 50%, emit terminal cancelled state

**UI Props Shape**:
```typescript
interface JobsCancelProps {
  progress: {
    current: number;
    total: number;
    percent: number;
  };
  state: "running" | "cancelled" | "completed";
  events: ProgressEvent[];
}
```

### 5. `report-no-data/`
**Use Case**: Test empty state in report drawer
**Scenario**: Minimal JSON representing "no report yet" with correct shape for drawer component

**UI Props Shape**:
```typescript
interface ReportEmptyProps {
  report: null;
  state: "empty" | "loading" | "error";
  placeholder: {
    title: string;
    subtitle: string;
    action?: string;
  };
}
```

## File Structure

Each fixture set contains:
- `events.ndjson` - Raw SSE event stream
- `view-model.json` - UI-ready state object
- `expected-props.json` - TypeScript interface as JSON schema
- `metadata.json` - Fixture configuration and seed info

## Determinism

All fixtures use:
- Fixed timestamps (`2024-01-15T10:30:00.000Z` + offsets)
- Deterministic seeds for any randomization
- Consistent event IDs (monotonic integers)
- Stable content ordering

## Usage

```bash
# Regenerate all fixtures
npm run fixtures:ui

# Validate determinism and schema compliance
npm run fixtures:validate
```

## Contract Validation

All fixture shapes are validated against the current OpenAPI specs to ensure the Contract Wall remains green. View models match the expected TypeScript interfaces used by Windsurf components.