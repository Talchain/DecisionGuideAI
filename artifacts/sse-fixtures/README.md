# SSE Fixtures - Replay Testing Pack

Pre-recorded Server-Sent Event streams for testing and development without needing real services.

## What's In Here

### `basic-analysis-stream.ndjson`
**Complete successful analysis** - Cloud provider comparison
- All stages: init → analysis → scoring → risks → completion
- 156 tokens generated over 45 seconds
- Progress updates at 10%, 25%, 50%, 75%, 90%, 100%
- **Use for:** Testing complete analysis flow, UI rendering, progress tracking

### `cancelled-stream.ndjson`
**User-cancelled analysis** - Mobile framework comparison
- Partial analysis (35% complete)
- Graceful cancellation with partial results
- 67 tokens generated before stop
- **Use for:** Testing cancel functionality, cleanup, partial state handling

### `error-stream.ndjson`
**Analysis error** - Database migration with insufficient data
- Error after 40% progress
- Retryable error with helpful suggestions
- Shows how errors are communicated
- **Use for:** Testing error states, user messaging, retry flows

## How to Replay (No Server Required)

### One-Liner Replay
```bash
# Basic successful analysis
npx ts-node -e "require('fs').readFileSync('./artifacts/sse-fixtures/basic-analysis-stream.ndjson', 'utf8').split('\n').filter(l => l.trim()).forEach((line, i) => setTimeout(() => console.log('data:', line, '\n'), i * 500))"

# Cancelled analysis
npx ts-node -e "require('fs').readFileSync('./artifacts/sse-fixtures/cancelled-stream.ndjson', 'utf8').split('\n').filter(l => l.trim()).forEach((line, i) => setTimeout(() => console.log('data:', line, '\n'), i * 300))"

# Error scenario
npx ts-node -e "require('fs').readFileSync('./artifacts/sse-fixtures/error-stream.ndjson', 'utf8').split('\n').filter(l => l.trim()).forEach((line, i) => setTimeout(() => console.log('data:', line, '\n'), i * 400))"
```

### Custom Replay Script
```javascript
// replay-sse.js
const fs = require('fs');

function replaySSE(filename, delayMs = 500) {
    const content = fs.readFileSync(filename, 'utf8');
    const events = content.split('\n').filter(line => line.trim());

    console.log(`🎬 Replaying ${events.length} SSE events from ${filename}`);
    console.log('Format: SSE event stream\n');

    events.forEach((line, index) => {
        setTimeout(() => {
            const event = JSON.parse(line);
            console.log(`event: ${event.event}`);
            console.log(`data: ${JSON.stringify(event.data)}\n`);

            if (index === events.length - 1) {
                console.log('🏁 Replay complete');
            }
        }, index * delayMs);
    });
}

// Usage
replaySSE('./artifacts/sse-fixtures/basic-analysis-stream.ndjson', 300);
```

### Integration with Tests
```typescript
// Load fixture data for testing
import { readFileSync } from 'fs';

function loadSSEFixture(name: string) {
    const content = readFileSync(`./artifacts/sse-fixtures/${name}.ndjson`, 'utf8');
    return content.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
}

// Example test usage
const basicFlow = loadSSEFixture('basic-analysis-stream');
const firstEvent = basicFlow[0]; // connected event
const lastEvent = basicFlow[basicFlow.length - 1]; // complete event
```

## Event Types in Fixtures

### Standard Events
- `connected` - Session established
- `start` - Analysis begins
- `progress` - Progress updates (10%, 25%, 50%, 75%, 90%, 100%)
- `token` - Streaming text content
- `complete` - Analysis finished successfully

### Error/Special Events
- `cancelled` - User or system cancellation
- `error` - Analysis failed with details

### Data Patterns
- **Timestamps**: ISO format with milliseconds
- **IDs**: Realistic format (`ana_fixture_*`, `session_fixture_*`)
- **Progress**: Integer percentages with stage names
- **Tokens**: Markdown-formatted analysis content
- **Errors**: Machine-readable codes with human messages

## Tips for Using Fixtures

### Development
- Use `basic-analysis-stream.ndjson` as your default happy path
- Test cancellation flows with `cancelled-stream.ndjson`
- Verify error handling with `error-stream.ndjson`

### Testing
- Load entire fixtures for integration tests
- Extract specific events for unit tests
- Modify delays to test different timing scenarios

### UI Development
- Replay at different speeds to test rendering performance
- Use cancelled stream to test cleanup logic
- Use error stream to design error states

## Creating New Fixtures

1. Record real SSE streams (with synthetic data)
2. Save as NDJSON format (one JSON object per line)
3. Ensure realistic timing and content
4. Add to this directory with descriptive names

---

**🔒 Security Note**: All fixtures use synthetic data only - no real user information, API keys, or sensitive data.

*Copy-paste ready commands above work immediately with no setup required.*