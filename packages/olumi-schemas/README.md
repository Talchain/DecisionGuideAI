# @olumi/schemas

Canonical TypeScript types and Zod runtime validators for the Olumi platform contract.

## Overview

This package provides type-safe schemas with runtime validation for the Olumi decision analysis platform. All contract-boundary schemas use `.passthrough()` to preserve unknown fields across service boundaries (CEE → UI → PLoT).

## Installation

```bash
npm install @olumi/schemas zod
```

Note: `zod` is a peer dependency and must be installed separately.

## Features

- **Type Safety**: TypeScript types generated from Zod schemas
- **Runtime Validation**: Validate data at runtime with Zod
- **Forward Compatibility**: Contract schemas use `.passthrough()` to preserve unknown fields
- **Boundary Documentation**: Explicit documentation of field transformations and drops at each boundary
- **Consistent Naming**: snake_case for API contracts, camelCase for UI (documented transformations)

## Usage Examples

### Node Schemas

```typescript
import { NodeV3Schema, isNodeV3, type NodeV3 } from '@olumi/schemas'

// Runtime validation
const result = NodeV3Schema.safeParse(data)
if (result.success) {
  const node: NodeV3 = result.data
  console.log(node.label, node.kind)
}

// Type guard
if (isNodeV3(data)) {
  // data is now typed as NodeV3
  console.log(data.observed_state?.value)
}

// Create a typed node
const goalNode: NodeV3 = {
  id: 'goal_revenue',
  kind: 'goal',
  label: 'Increase Revenue',
  goal_threshold: 0.8,
  goal_threshold_raw: 1000000,
  goal_threshold_unit: 'USD',
}

// Validate and parse
const validated = NodeV3Schema.parse(goalNode)
```

### Edge Schemas

```typescript
import { EdgeV3Schema, type EdgeV3 } from '@olumi/schemas'

const edge: EdgeV3 = {
  from: 'factor_price',
  to: 'goal_revenue',
  strength: {
    mean: 0.7,
    std: 0.1,
  },
  exists_probability: 0.9,
  effect_direction: 'positive',
}

// Validate
const validated = EdgeV3Schema.parse(edge)
```

### Option Schemas

```typescript
import { OptionForAnalysisSchema, type OptionForAnalysis } from '@olumi/schemas'

const option: OptionForAnalysis = {
  id: 'option_discount',
  label: '20% Discount',
  status: 'ready',
  interventions: {
    'factor_price': 0.8,  // normalized value
  },
}

// Validate
const validated = OptionForAnalysisSchema.parse(option)
```

### Analysis-Ready Payload

```typescript
import {
  AnalysisReadyV3Schema,
  isFullyReady,
  type AnalysisReadyV3,
} from '@olumi/schemas'

const analysisReady: AnalysisReadyV3 = {
  status: 'ready',
  options: [
    {
      id: 'option_a',
      label: 'Option A',
      status: 'ready',
      interventions: { 'factor_x': 0.5 },
    },
  ],
  goal_node_id: 'goal_revenue',
  suggested_seed: '42',
}

// Validate
const validated = AnalysisReadyV3Schema.parse(analysisReady)

// Check if ready for analysis
if (isFullyReady(validated)) {
  // All options are resolved and ready
}
```

### Response Schemas

```typescript
import { FactorSensitivitySchema, type FactorSensitivity } from '@olumi/schemas'

const sensitivity: FactorSensitivity = {
  node_id: 'factor_price',
  label: 'Price',
  importance_score: 0.85,
  sensitivity_score: 0.75,
  elasticity: 1.2,
  direction: 'positive',
  importance_rank: 1,
  confidence: 0.9,
}

// Validate
const validated = FactorSensitivitySchema.parse(sensitivity)
```

### Constants and Limits

```typescript
import {
  MAX_NODES,
  MAX_EDGES,
  MAX_OPTIONS,
  STD_FLOOR,
  DEFAULT_SEED,
} from '@olumi/schemas'

// Use in validation logic
if (nodes.length > MAX_NODES) {
  throw new Error(`Cannot exceed ${MAX_NODES} nodes`)
}

// Use in calculations
const std = Math.max(STD_FLOOR, computedStd)
```

### Boundary Documentation

```typescript
import { CEE_TO_UI_DROPS, UI_TO_PLOT_DROPS, PLOT_TO_UI_DROPS } from '@olumi/schemas'

// Document what fields are dropped at each boundary
console.log(CEE_TO_UI_DROPS.description)
console.log(CEE_TO_UI_DROPS.drops)
console.log(CEE_TO_UI_DROPS.transformations)

// Example: Check what's preserved
console.log('Fields preserved at UI→PLoT boundary:', UI_TO_PLOT_DROPS.preserved)
```

## Schema Types

### Core Types

- **NodeV3**: Graph node with observed state, priors, and goal thresholds
- **EdgeV3**: Graph edge with strength distribution and existence probability
- **ObservedState**: Factor observation with value, uncertainty, and metadata
- **OptionForAnalysis**: Option with interventions and status
- **AnalysisReadyV3**: CEE payload with resolved options ready for PLoT

### Response Types

- **FactorSensitivity**: Sensitivity analysis for individual factors
- **FragileEdge**: Edge fragility analysis results

### Supporting Types

- **RichIntervention**: Intervention with metadata (source, confidence, encoding)
- **TargetMatch**: Intervention target mapping metadata
- **SeedConfig**: Seed configuration for reproducibility

## Naming Conventions

The package follows consistent naming conventions across boundaries:

### API/Contract Boundaries (snake_case)
- CEE → UI: `observed_state`, `goal_threshold_raw`
- UI → PLoT: `observed_state`, `exists_probability`

### UI Layer (camelCase)
- React Flow nodes: `observedState`, `goalThreshold`
- Component props: `nodeId`, `labelText`

Transformations are documented in boundary files (`src/boundaries/`).

## Validation Patterns

### Safe Parsing (Recommended)

```typescript
const result = NodeV3Schema.safeParse(data)
if (result.success) {
  // data is valid
  const node: NodeV3 = result.data
} else {
  // Handle validation error
  console.error(result.error.issues)
}
```

### Strict Parsing (Throws on Error)

```typescript
try {
  const node = NodeV3Schema.parse(data)
  // Use node
} catch (error) {
  // Handle ZodError
}
```

### Type Guards

```typescript
if (isNodeV3(data)) {
  // TypeScript knows data is NodeV3
  console.log(data.label)
}
```

## Contract Guarantees

### Passthrough Behavior

All contract-boundary schemas use `.passthrough()` to preserve unknown fields:

```typescript
const input = {
  id: 'node_1',
  kind: 'goal',
  label: 'My Goal',
  unknown_field: 'preserved',  // Will be preserved
}

const validated = NodeV3Schema.parse(input)
// validated.unknown_field === 'preserved' ✓
```

This ensures forward compatibility when new fields are added to CEE or PLoT.

### Field Preservation

The package documents which fields are:
- **Preserved**: Pass through unchanged
- **Transformed**: Renamed or reformatted (e.g., snake_case ↔ camelCase)
- **Dropped**: Intentionally removed (e.g., React Flow internals)

See `src/boundaries/` for complete documentation.

## Development

```bash
# Install dependencies
npm install

# Build package
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## License

ISC
