# Compare API - Scenario Comparison Endpoint

**Purpose**: Side-by-side scenario analysis with structured delta reporting

## 🎯 Quick Start

### Basic Usage
```bash
curl -X POST http://localhost:3001/compare \
  -H "Content-Type: application/json" \
  -d '{
    "left": {
      "scenarioId": "pricing-conservative",
      "seed": 42,
      "budget": 200
    },
    "right": {
      "scenarioId": "pricing-aggressive",
      "seed": 42,
      "budget": 200
    }
  }'
```

### Response Structure (compare.v1)
```json
{
  "schema": "compare.v1",
  "left": {
    "scenarioId": "pricing-conservative",
    "runId": "run_pricing-conservative_42_1696000000000",
    "report": { /* Report v1 structure */ }
  },
  "right": {
    "scenarioId": "pricing-aggressive",
    "runId": "run_pricing-aggressive_42_1696000000000",
    "report": { /* Report v1 structure */ }
  },
  "delta": {
    "most_likely_diff": 1200,
    "most_likely_pct": 0.012,
    "confidence_shift": "DOWN",
    "threshold_events": []
  },
  "headline": "Moderate improvement: up ~1.2% in Right vs Left",
  "key_drivers": ["Higher risk tolerance", "Lower confidence in analysis"]
}
```

## 📊 Understanding the Delta

### Numerical Differences
- **`most_likely_diff`**: Absolute difference in most likely outcomes
- **`most_likely_pct`**: Percentage change (Right vs Left)
- **`confidence_shift`**: Direction of confidence change (`NONE`|`UP`|`DOWN`)

### Threshold Events
Significant boundary crossings between scenarios:
```json
{
  "threshold_events": [
    {
      "threshold": 10000,
      "event": "Threshold 10000 crossed going up",
      "significance": "major"
    }
  ]
}
```

### Headlines and Key Drivers
- **Headlines**: Human-readable summary in British English
  - "No significant difference between scenarios"
  - "Marginal difference: up ~2.1% in Right vs Left"
  - "Moderate improvement: down ~8.5% in Right vs Left"
  - "Significant change: up ~15.2% in Right vs Left"

- **Key Drivers**: Up to 3 factors explaining the difference
  - Option score improvements/reductions
  - Confidence level changes
  - Major threshold crossings

## 🛠️ JavaScript Integration

### Using Fetch API
```javascript
async function compareScenarios(leftScenario, rightScenario) {
  const response = await fetch('/compare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      left: leftScenario,
      right: rightScenario
    })
  });

  if (!response.ok) {
    throw new Error(`Compare failed: ${response.status}`);
  }

  return await response.json();
}

// Usage
const comparison = await compareScenarios(
  { scenarioId: 'option-a', seed: 42 },
  { scenarioId: 'option-b', seed: 42 }
);

console.log('Headline:', comparison.headline);
console.log('Change:', comparison.delta.most_likely_pct);
```

### Using Olumi SDK
```javascript
import { createClient } from 'olumi-poc-sdk';

const client = createClient({ baseUrl: 'http://localhost:3001' });

// Get individual reports first
const leftReport = await client.getReport({
  scenarioId: 'pricing-conservative',
  seed: 42
});

const rightReport = await client.getReport({
  scenarioId: 'pricing-aggressive',
  seed: 42
});

// Then compare (future SDK enhancement)
const comparison = await client.compare({
  left: { scenarioId: 'pricing-conservative', seed: 42 },
  right: { scenarioId: 'pricing-aggressive', seed: 42 }
});
```

## 🎨 UI Integration Patterns

### Comparison Table
```javascript
function ComparisonTable({ comparison }) {
  const { left, right, delta } = comparison;

  return (
    <div className="comparison-grid">
      <div className="scenario-column">
        <h3>{left.report.decision.title}</h3>
        <div className="confidence">
          Confidence: {left.report.analysis.confidence}
        </div>
        <OptionsList options={left.report.decision.options} />
      </div>

      <div className="delta-column">
        <div className="headline">{comparison.headline}</div>
        <div className="change-indicator">
          {delta.most_likely_pct > 0 ? '↗️' : '↘️'}
          {Math.abs(delta.most_likely_pct * 100).toFixed(1)}%
        </div>
        <KeyDrivers drivers={comparison.key_drivers} />
      </div>

      <div className="scenario-column">
        <h3>{right.report.decision.title}</h3>
        <div className="confidence">
          Confidence: {right.report.analysis.confidence}
        </div>
        <OptionsList options={right.report.decision.options} />
      </div>
    </div>
  );
}
```

### Delta Visualisation
```javascript
function DeltaChart({ delta }) {
  const changeColour = delta.most_likely_pct > 0 ? '#10b981' : '#ef4444';
  const changePercent = Math.abs(delta.most_likely_pct * 100);

  return (
    <div className="delta-chart">
      <div
        className="change-bar"
        style={{
          width: `${Math.min(changePercent * 5, 100)}%`,
          backgroundColor: changeColour
        }}
      />
      <span className="change-label">
        {delta.most_likely_pct > 0 ? '+' : '-'}{changePercent.toFixed(1)}%
      </span>
    </div>
  );
}
```

## 🔍 Advanced Use Cases

### Batch Comparison
```javascript
async function batchCompare(scenarios) {
  const comparisons = [];

  for (let i = 0; i < scenarios.length - 1; i++) {
    for (let j = i + 1; j < scenarios.length; j++) {
      const comparison = await compareScenarios(
        scenarios[i],
        scenarios[j]
      );

      comparisons.push({
        left: scenarios[i].scenarioId,
        right: scenarios[j].scenarioId,
        ...comparison
      });
    }
  }

  return comparisons;
}
```

### A/B Testing Integration
```javascript
async function compareABTest(baselineId, variantId, seed = 42) {
  const comparison = await compareScenarios(
    { scenarioId: baselineId, seed },
    { scenarioId: variantId, seed }
  );

  return {
    winner: comparison.delta.most_likely_pct > 0 ? 'variant' : 'baseline',
    confidence: getWinnerConfidence(comparison),
    improvement: Math.abs(comparison.delta.most_likely_pct),
    summary: comparison.headline
  };
}
```

### Time Series Comparison
```javascript
async function compareEvolution(scenarioId, seeds) {
  const comparisons = [];

  for (let i = 0; i < seeds.length - 1; i++) {
    const comparison = await compareScenarios(
      { scenarioId, seed: seeds[i] },
      { scenarioId, seed: seeds[i + 1] }
    );

    comparisons.push({
      from: seeds[i],
      to: seeds[i + 1],
      change: comparison.delta.most_likely_pct,
      drivers: comparison.key_drivers
    });
  }

  return comparisons;
}
```

## ⚠️ Error Handling

### Common Error Responses
```javascript
// 400 Bad Request
{
  "type": "BAD_INPUT",
  "message": "Both left and right scenarios required",
  "timestamp": "2024-09-27T10:00:00.000Z"
}

// 429 Rate Limited
{
  "type": "RATE_LIMIT",
  "message": "Rate limit exceeded: 60 requests per minute",
  "timestamp": "2024-09-27T10:00:00.000Z"
}
```

### Error Handling Pattern
```javascript
async function safeCompare(left, right) {
  try {
    const comparison = await compareScenarios(left, right);
    return { success: true, data: comparison };
  } catch (error) {
    if (error.status === 429) {
      return {
        success: false,
        error: 'rate_limited',
        message: 'Please wait before comparing again'
      };
    } else if (error.status === 400) {
      return {
        success: false,
        error: 'bad_input',
        message: 'Invalid scenario parameters'
      };
    } else {
      return {
        success: false,
        error: 'unknown',
        message: 'Comparison failed unexpectedly'
      };
    }
  }
}
```

## 📈 Performance Considerations

### Caching Strategy
- **Response Headers**: `Cache-Control: no-store` (no caching)
- **Client-Side**: Cache based on scenario IDs and seeds
- **Deterministic**: Same inputs always produce same outputs

### Rate Limits
- **Default**: 60 requests per minute per origin
- **Headers**: `Retry-After` provided when limited
- **Token Budget**: 50,000 tokens per day per origin

### Optimisation Tips
```javascript
// Use consistent seeds for deterministic caching
const CACHE_SEED = 42;

// Batch similar comparisons
const comparisons = await Promise.all([
  compareScenarios(base, variantA),
  compareScenarios(base, variantB),
  compareScenarios(variantA, variantB)
]);

// Debounce user-triggered comparisons
const debouncedCompare = debounce(compareScenarios, 1000);
```

## 🔗 Related Endpoints

- **GET /report**: Individual scenario analysis
- **POST /stream**: Real-time scenario streaming
- **GET /healthz**: Service health check
- **POST /templates/encode**: Share scenario configurations

---

**Schema Version**: compare.v1
**Pilot Compatibility**: v0.1.0-pilot
**Rate Limits**: 60 RPM, 50k tokens/day per origin