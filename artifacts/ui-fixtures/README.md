# UI Fixtures Pack v2

Generated deterministic fixtures for Decision Guide AI UI development.

## Fixtures

### 1. Happy Path Token Streaming
- **Path:** `1-happy-path/`
- **Description:** Complete token streaming scenario with 60+ tokens
- **Events:** Token events → completion
- **Use case:** Test normal streaming behavior

### 2. Resume with Last-Event-ID
- **Path:** `2-resume-last-event-id/`
- **Description:** Connection drops mid-stream, resumes from last event ID
- **Events:** Initial tokens → disconnect → resume → completion
- **Use case:** Test reconnection logic

### 3. Mid-Stream Cancel
- **Path:** `3-mid-stream-cancel/`
- **Description:** User cancels request while tokens are streaming
- **Events:** Token events → cancel event
- **Use case:** Test cancellation handling

### 4. Error Stream
- **Path:** `4-error-stream/`
- **Description:** Stream fails with rate limit error after 2 tokens
- **Events:** Initial tokens → error event
- **Use case:** Test error handling and user feedback

### 5. Jobs Progress with Cancel
- **Path:** `5-jobs-progress-cancel/`
- **Description:** Job progresses to 50% then gets cancelled
- **Events:** Progress events (0→50%) → cancel
- **Use case:** Test job cancellation at mid-point

## File Structure

Each fixture contains:
- `events.ndjson` - Server-Sent Events in NDJSON format
- `view-model.json` - Complete UI state after processing all events

## Usage in UI Development

### Loading Events
```typescript
import events from './ui-fixtures/1-happy-path/events.ndjson';
const eventStream = events.split('\n').map(line => JSON.parse(line));
```

### Using View Models
```typescript
import viewModel from './ui-fixtures/1-happy-path/view-model.json';
// viewModel contains final state with all tokens, metadata, etc.
```

### Event Types

#### Token Event
```json
{
  "id": "token_001",
  "event": "token",
  "data": "{\"id\":\"token_001\",\"text\":\"I\",\"timestamp\":1234567890,\"sessionId\":\"session-001\"}"
}
```

#### Complete Event
```json
{
  "id": "complete_001",
  "event": "complete",
  "data": "{\"sessionId\":\"session-001\",\"totalTokens\":60,\"totalCost\":0.045}"
}
```

#### Error Event
```json
{
  "id": "error_001",
  "event": "error",
  "data": "{\"error\":{\"code\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Request rate limit exceeded\"}}"
}
```

## View Model Schemas

### StreamViewModel
- `sessionId`: string
- `status`: 'idle' | 'streaming' | 'completed' | 'cancelled' | 'error'
- `tokens`: Array of token objects with id, text, timestamp
- `metadata`: Cost, duration, model info (if completed)
- `error`: Error details (if failed)

### JobsViewModel
- `sessionId`: string
- `jobs`: Array of job objects with progress, status, timing

All fixtures are deterministic and safe for version control.
