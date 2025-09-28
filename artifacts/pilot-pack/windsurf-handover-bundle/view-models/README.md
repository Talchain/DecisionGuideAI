# UI View Models

Schema-validated, deterministic view models for Windsurf UI development. All states generated from real SARB bundle data and validated against v3 fixture schemas.

## Available States

### Stream States

| File | Description | Use Case |
|------|-------------|----------|
| `stream.happy.json` | Completed streaming session | Normal flow end-to-end |
| `stream.resume-once.json` | Connection drop + resume | Test reconnection logic |
| `stream.cancelled.json` | Mid-stream cancellation | User stops analysis |
| `stream.error.json` | Rate limit error | Error handling |

### Jobs States

| File | Description | Use Case |
|------|-------------|----------|
| `jobs.progress.json` | Active job at 75% progress | Normal job execution |
| `jobs.cancelled.json` | Job cancelled at 50% | User cancellation |

### Report States

| File | Description | Use Case |
|------|-------------|----------|
| `report.ready.json` | Report available for viewing | Loading/ready state |
| `report.empty.json` | No report available | Empty state |

## How Windsurf Renders These Offline

### Stream Component Example

```tsx
import streamHappy from './ui-viewmodels/example/stream.happy.json';
import streamError from './ui-viewmodels/example/stream.error.json';

function StreamPanel({ state = 'happy' }) {
  // Load the appropriate view model
  const viewModels = {
    happy: streamHappy,
    error: streamError,
    cancelled: streamCancelled,
    'resume-once': streamResumeOnce
  };

  const viewModel = viewModels[state];

  return (
    <div className="stream-panel">
      {/* Connection State Indicator */}
      <div className="connection-status">
        {viewModel.connectionState === 'resumed' && (
          <span className="status resumed">Reconnected</span>
        )}
        {viewModel.connectionState === 'connected' && (
          <span className="status connected">Connected</span>
        )}
      </div>

      {/* Token Stream Display */}
      <div className="token-stream">
        {viewModel.tokens.map((token, i) => (
          <span key={i} className="token">{token}</span>
        ))}
      </div>

      {/* Error Banner */}
      {viewModel.error && (
        <div className="error-banner">
          <div className="error-message">{viewModel.error.message}</div>
          <div className="error-hint">{viewModel.error.retryHint}</div>
          <button onClick={() => /* retry logic */}>
            Retry in 60s
          </button>
        </div>
      )}

      {/* Events Timeline (Debug) */}
      <details className="events-timeline">
        <summary>Event Timeline ({viewModel.events.length} events)</summary>
        {viewModel.events.map(event => (
          <div key={event.id} className="event">
            <span className="event-type">{event.event}</span>
            <span className="event-time">{event.data.timestamp}</span>
          </div>
        ))}
      </details>
    </div>
  );
}
```

### Jobs Component Example

```tsx
import jobsProgress from './ui-viewmodels/example/jobs.progress.json';
import jobsCancelled from './ui-viewmodels/example/jobs.cancelled.json';

function JobsPanel({ state = 'progress' }) {
  const viewModel = state === 'progress' ? jobsProgress : jobsCancelled;

  return (
    <div className="jobs-panel">
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${viewModel.progress.percent}%` }}
        />
        <div className="progress-text">
          {viewModel.progress.current}/{viewModel.progress.total}
        </div>
      </div>

      <div className="job-state">
        {viewModel.state === 'running' && (
          <span className="status running">In Progress</span>
        )}
        {viewModel.state === 'cancelled' && (
          <span className="status cancelled">Cancelled</span>
        )}
      </div>

      {/* Real-time Events */}
      <div className="job-events">
        {viewModel.events.map(event => (
          <div key={event.id} className="job-event">
            {event.event === 'progress' && (
              <span>Progress: {event.data.progress}%</span>
            )}
            {event.event === 'cancel' && (
              <span className="cancelled">Job cancelled by user</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Report Component Example

```tsx
import reportReady from './ui-viewmodels/example/report.ready.json';
import reportEmpty from './ui-viewmodels/example/report.empty.json';

function ReportDrawer({ isEmpty = false, isOpen = false }) {
  const viewModel = isEmpty ? reportEmpty : reportReady;

  if (!isOpen) return null;

  return (
    <div className="report-drawer">
      <header>
        <h2>Analysis Report</h2>
        <button onClick={onClose}>×</button>
      </header>

      {viewModel.state === 'empty' && (
        <div className="empty-state">
          <h3>{viewModel.placeholder.title}</h3>
          <p>{viewModel.placeholder.subtitle}</p>
          {viewModel.placeholder.action && (
            <button className="primary">
              {viewModel.placeholder.action}
            </button>
          )}
        </div>
      )}

      {viewModel.state === 'loading' && (
        <div className="loading-state">
          <h3>{viewModel.placeholder.title}</h3>
          <p>{viewModel.placeholder.subtitle}</p>
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}
```

## Development Workflow

### 1. Import the View Model
```tsx
import viewModel from './ui-viewmodels/example/stream.happy.json';
```

### 2. Use as Component Props
```tsx
const [streamState, setStreamState] = useState(viewModel);
```

### 3. Switch Between States
```tsx
// For testing different scenarios
const loadState = (stateName) => {
  import(`./ui-viewmodels/example/${stateName}.json`)
    .then(data => setStreamState(data.default));
};

// Usage: loadState('stream.error') or loadState('jobs.cancelled')
```

### 4. Type Safety (Optional)
```tsx
interface StreamViewModel {
  events: Array<{ id: string; event: string; data: any }>;
  connectionState: 'connected' | 'disconnected' | 'resumed';
  lastEventId: string | null;
  tokens: string[];
}
```

## Benefits for Windsurf Development

✅ **No Backend Required**: Develop UI components completely offline
✅ **Real Data**: Generated from actual SARB bundles, not mock data
✅ **Schema Validated**: Guaranteed to match production data structure
✅ **All Edge Cases**: Error states, cancellation, reconnection covered
✅ **Deterministic**: Same data every time, perfect for testing
✅ **Fast Iteration**: Switch between states instantly

## Regenerating View Models

```bash
# Generate all states from a SARB bundle
npm run vm:aligned -- artifacts/runs/your-bundle.sarb.zip --out artifacts/ui-viewmodels/your-scenario/

# Validate against v3 fixture schemas
npm run vm:validate
```

All view models are ready for immediate use in Windsurf components!