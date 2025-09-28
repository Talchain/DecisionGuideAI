# Deterministic Run Registry

**Purpose**: In-memory cache for deterministic scenario execution with replay capability

## 🎯 Quick Overview

The run registry eliminates duplicate scenario executions by caching results based on `(scenarioId, seed, engineCodeHash)`. Same inputs always return the same `runId`, proving reproducibility.

## 🔍 Cache Keys & Behavior

### Cache Key Generation
```
cache_key = SHA256(scenarioId + ":" + seed + ":" + engineCodeHash)
```

**Components**:
- `scenarioId`: Unique scenario identifier
- `seed`: Deterministic randomness seed
- `engineCodeHash`: Engine version + commit SHA (mock in PoC)

### Cache Hit vs Miss

| Scenario | Result | `source` |
|----------|---------|----------|
| First request for scenario A, seed 42 | New run created | `"new"` |
| Repeat request for scenario A, seed 42 | Cached run returned | `"cache"` |
| Different scenario B, seed 42 | New run created | `"new"` |
| Same scenario A, different seed 17 | New run created | `"new"` |

## 🚀 API Usage

### GET /runs/lookup
**Purpose**: Get runId for scenario execution (cache hit or create new)

```bash
# First lookup - cache miss
curl "http://localhost:3001/runs/lookup?scenarioId=pricing-v1&seed=42"
# Response: {"runId": "run_pricing-v1_42_1696000000000", "source": "new"}

# Immediate repeat - cache hit
curl "http://localhost:3001/runs/lookup?scenarioId=pricing-v1&seed=42"
# Response: {"runId": "run_pricing-v1_42_1696000000000", "source": "cache"}
```

**Parameters**:
- `scenarioId` (required): Scenario identifier
- `seed` (required): Integer deterministic seed

### GET /runs/{runId}/events
**Purpose**: Retrieve recorded SSE events for evidence and replay

```bash
curl "http://localhost:3001/runs/run_pricing-v1_42_1696000000000/events"
```

**Response**:
```json
{
  "runId": "run_pricing-v1_42_1696000000000",
  "events": [
    {"type": "start", "data": {"sessionId": "session_123", "seed": 42}},
    {"type": "token", "data": {"text": "Based", "tokenIndex": 1}},
    {"type": "done", "data": {"sessionId": "session_123", "totalTokens": 150}}
  ],
  "count": 3
}
```

## ⏰ TTL & Expiry

### Configuration
```bash
# Environment variable (default: 60 minutes)
export RUN_REGISTRY_TTL_MIN=60
```

### Expiry Behavior
- **Entry created**: TTL timer starts
- **Cache hit**: TTL timer resets to full duration
- **Expired entry**: Automatically removed, next lookup is cache miss
- **Server restart**: All entries lost (in-memory storage)

### TTL Examples
```bash
# Set short TTL for testing
export RUN_REGISTRY_TTL_MIN=5

# First request
curl "http://localhost:3001/runs/lookup?scenarioId=test&seed=1"
# Response: {"source": "new"}

# Within 5 minutes
curl "http://localhost:3001/runs/lookup?scenarioId=test&seed=1"
# Response: {"source": "cache"}

# After 5 minutes
curl "http://localhost:3001/runs/lookup?scenarioId=test&seed=1"
# Response: {"source": "new"} (cache expired)
```

## 🔧 JavaScript Integration

### Basic Usage
```javascript
async function getOrCreateRun(scenarioId, seed) {
  const response = await fetch(`/runs/lookup?scenarioId=${scenarioId}&seed=${seed}`);
  const result = await response.json();

  console.log(`Run ${result.runId} (${result.source})`);
  return result.runId;
}

// Usage
const runId = await getOrCreateRun('pricing-strategy', 42);

if (result.source === 'cache') {
  console.log('Using cached execution - scenario already computed');
} else {
  console.log('New execution required');
}
```

### Event Retrieval
```javascript
async function getRunEvents(runId) {
  const response = await fetch(`/runs/${runId}/events`);

  if (!response.ok) {
    throw new Error(`Run ${runId} not found`);
  }

  const data = await response.json();
  return data.events;
}

// Get SSE transcript for audit
const events = await getRunEvents('run_pricing-v1_42_1696000000000');
const tokenEvents = events.filter(e => e.type === 'token');
console.log(`Generated ${tokenEvents.length} tokens`);
```

### Cache Warmup
```javascript
// Pre-populate cache for common scenarios
const scenarios = ['pricing-v1', 'pricing-v2', 'pricing-v3'];
const seed = 42;

for (const scenarioId of scenarios) {
  const result = await getOrCreateRun(scenarioId, seed);
  console.log(`${scenarioId}: ${result.source}`);
}
```

## 🎯 Demo & Reproducibility Benefits

### Proving Determinism
```bash
# Run same scenario multiple times
for i in {1..5}; do
  echo "Attempt $i:"
  curl -s "http://localhost:3001/runs/lookup?scenarioId=demo&seed=999" | jq .
done

# All responses should have same runId after first
```

### A/B Testing with Registry
```javascript
async function compareWithRegistry(scenarioA, scenarioB, seed) {
  // Both scenarios use same seed for fair comparison
  const runA = await getOrCreateRun(scenarioA, seed);
  const runB = await getOrCreateRun(scenarioB, seed);

  // If both are cache hits, comparison is instant
  const comparison = await fetch('/compare', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      left: {scenarioId: scenarioA, seed},
      right: {scenarioId: scenarioB, seed}
    })
  }).then(r => r.json());

  return comparison;
}
```

## 🔄 Cache Miss Scenarios

Registry returns `"source": "new"` when:

1. **First Request**: Scenario + seed combination never seen
2. **TTL Expired**: Cache entry older than `RUN_REGISTRY_TTL_MIN`
3. **Engine Update**: `engineCodeHash` changed (version bump/deploy)
4. **Server Restart**: In-memory cache cleared
5. **Different Parameters**: Any change to scenarioId or seed

## 🚨 Error Handling

### Missing Parameters
```bash
curl "http://localhost:3001/runs/lookup?scenarioId=test"
# Response: 400 {"type": "BAD_INPUT", "message": "scenarioId and seed parameters required"}
```

### Invalid Seed
```bash
curl "http://localhost:3001/runs/lookup?scenarioId=test&seed=invalid"
# Response: 400 {"type": "BAD_INPUT", "message": "seed must be a valid integer"}
```

### Run Not Found
```bash
curl "http://localhost:3001/runs/non-existent-run/events"
# Response: 404 {"type": "BAD_INPUT", "message": "Run non-existent-run not found"}
```

## 📊 Registry Statistics

For debugging and monitoring:

```javascript
// Internal function (not exposed as API)
function getRegistryStats() {
  return {
    total_entries: 15,
    ttl_minutes: 60,
    entries_by_scenario: {
      "pricing-v1": 3,
      "pricing-v2": 2,
      "demo-scenario": 10
    }
  };
}
```

## 💡 Best Practices

### 1. Consistent Seeds for Comparisons
```javascript
// Good: Same seed enables fair comparison
const COMPARISON_SEED = 42;
const runA = await getOrCreateRun('strategy-a', COMPARISON_SEED);
const runB = await getOrCreateRun('strategy-b', COMPARISON_SEED);

// Bad: Different seeds make comparison meaningless
const runA = await getOrCreateRun('strategy-a', 42);
const runB = await getOrCreateRun('strategy-b', 17);
```

### 2. Check Source for UX
```javascript
const result = await getOrCreateRun(scenarioId, seed);

if (result.source === 'cache') {
  showMessage('Using previous analysis - results available instantly');
} else {
  showMessage('Analysing scenario - this may take a moment...');
}
```

### 3. Preload Common Scenarios
```javascript
// Warm cache during quiet periods
async function warmCache() {
  const commonScenarios = ['pricing-basic', 'pricing-premium'];
  const seeds = [42, 17, 99];

  for (const scenarioId of commonScenarios) {
    for (const seed of seeds) {
      await getOrCreateRun(scenarioId, seed);
    }
  }
}
```

## 🔗 Related Features

- **Snapshots**: Use runId to download ZIP evidence packs
- **Events API**: Get SSE transcript for cached runs
- **Compare API**: Leverage cached reports for instant comparisons
- **Exports**: Generate CSV from cached run data

---

**Storage**: In-memory (resets on restart)
**TTL**: Configurable via `RUN_REGISTRY_TTL_MIN` (default 60 minutes)
**Cache Key**: `scenarioId:seed:engineCodeHash`
**Thread Safety**: Single-threaded Node.js event loop