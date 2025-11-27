# Technical Overview

**Version:** 2.0
**Last Updated:** 2025-11-27
**Audience:** Engineers onboarding to DecisionGuideAI

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Systems](#core-systems)
3. [Data Flow](#data-flow)
4. [State Management](#state-management)
5. [Canvas System](#canvas-system)
6. [Backend Integration](#backend-integration)
7. [Feature Flags](#feature-flags)
8. [Testing Strategy](#testing-strategy)
9. [Performance Considerations](#performance-considerations)
10. [Production Hygiene](#production-hygiene)

---

## Architecture Overview

DecisionGuideAI is a React-based decision modeling application that enables users to create, visualize, and analyze decision graphs.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Routing | React Router v6 |
| State | Zustand |
| Canvas | ReactFlow (xyflow) |
| Styling | Tailwind CSS |
| Backend | Supabase (Auth/DB) + PLoT Engine (Analysis) |
| Testing | Vitest + Playwright |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Application                         │
├─────────────────┬─────────────────┬────────────────────────────┤
│   Canvas Layer  │  Analysis Layer │     Persistence Layer       │
│   (ReactFlow)   │  (PLoT Adapter) │     (Supabase)              │
├─────────────────┴─────────────────┴────────────────────────────┤
│                    Zustand State Management                      │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌────────────────┐   │
│  │graphStore│ │resultsStore│ │panelsStore│ │documentsStore │   │
│  └──────────┘ └────────────┘ └──────────┘ └────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Systems

### 1. Decision Canvas (`src/canvas/`)

The canvas is the primary interface for building decision models.

**Key Components:**
- `ReactFlowGraph.tsx` - Main canvas component using ReactFlow
- `nodes/` - Custom node types (Goal, Decision, Option, Factor, Risk, Outcome)
- `edges/` - Edge rendering and validation
- `layout/` - Dagre-based automatic layout

**Node Types:**
```typescript
type NodeType = 'goal' | 'decision' | 'option' | 'factor' | 'risk' | 'outcome'
```

Each node type has:
- A visual representation (`src/canvas/nodes/{Type}Node.tsx`)
- Configuration in `domain/nodes.ts`
- Validation rules for connections

### 2. Analysis Engine (`src/adapters/plot/`)

Integrates with the PLoT backend for decision analysis.

**Key Files:**
- `client.ts` - HTTP/SSE client for PLoT API
- `types.ts` - TypeScript interfaces for API contracts
- `sse.ts` - Server-Sent Events handling with reconnection

**Analysis Flow:**
1. User clicks "Run Analysis"
2. Graph serialized to PLoT format
3. SSE connection established for progress
4. Results streamed and displayed

### 3. Trust Signals (`src/canvas/components/`)

Trust signal components display analysis quality indicators. Implemented in Sprint N (P0.1-P1.7).

**Components:**

| Component | Purpose | Data Source |
|-----------|---------|-------------|
| `DecisionReadinessBadge` | Ready/Not Ready indicator with tooltip | `report.decision_readiness` |
| `InsightsPanel` | Summary, risks, next steps | `report.insights` |
| `ModelQualityScore` | Expandable quality metrics | `report.graph_quality` |
| `EvidenceCoverage` | Evidence percentage indicator | `report.graph_quality.evidence_coverage` |
| `ProvenanceChip` | Model provenance display | `report.model_card` |

**Confidence Level Mapping:**
```typescript
// Numeric confidence → Level → Decision Readiness
>= 0.7 → 'high'   → { ready: true, blockers: [] }
>= 0.4 → 'medium' → { ready: false, warnings: [...] }
< 0.4  → 'low'    → { ready: false, blockers: [...] }
```

**Contract Tests:** `src/adapters/plot/__tests__/trustFields.contract.spec.ts`
- 19 tests validating confidence → readiness mapping
- graph_quality passthrough (top-level vs nested)
- insights passthrough with array preservation

### 4. Authentication (`src/contexts/AuthContext.tsx`)

Uses Supabase Auth with:
- Magic link authentication
- Session persistence
- Team/organization support

### 5. Templates (`src/templates/`)

Pre-built decision templates users can start from:
- Investment decisions
- Career choices
- Product launches

---

## Data Flow

### Analysis Run Flow

```
User Action          State Change              Backend Call
     │                    │                         │
     ▼                    ▼                         ▼
[Run Analysis] → resultsStore.resultsStart() → POST /v1/run
                          │                         │
                    status: 'preparing'       SSE connection
                          │                         │
                    status: 'streaming'  ◄── tick events
                          │                         │
                    status: 'complete'  ◄── done + report
```

### Graph Persistence Flow

```
User Edit → pushHistory() → debounced persist → Supabase
                │
          nodes/edges updated
                │
          validation triggered
                │
          graphHealth updated
```

---

## State Management

### Store Architecture (Modular)

The application uses Zustand with modular stores for better performance:

```
src/canvas/stores/
├── index.ts           # Re-exports
├── panelsStore.ts     # UI panel visibility (~140 lines)
├── resultsStore.ts    # Analysis results state machine (~210 lines)
├── documentsStore.ts  # Document citations (~139 lines)
└── graphHealthStore.ts # Validation state (~64 lines)
```

**Store Responsibilities:**

| Store | Purpose | Key State |
|-------|---------|-----------|
| `panelsStore` | UI panel visibility | `showResultsPanel`, `showInspectorPanel`, `showIssuesPanel` |
| `resultsStore` | Analysis lifecycle | Status machine, SSE diagnostics, correlation IDs |
| `documentsStore` | Citations | Documents, citation references per node |
| `graphHealthStore` | Validation | `graphHealth`, repair suggestions |

**Import Pattern:**
```typescript
// Preferred: Import from modular stores
import { usePanelsStore, useResultsStore } from '@/canvas/stores'

// Legacy: Combined store (still supported)
import { useCanvasStore } from '@/canvas/store'
```

### Results State Machine

The results store manages a state machine for analysis runs:

```
idle → preparing → connecting → streaming → complete
                                    │
                                    └──→ error
                                    └──→ cancelled
```

### Panel State

Simple boolean flags with persistence:
```typescript
interface PanelsState {
  showResultsPanel: boolean
  showInspectorPanel: boolean
  showIssuesPanel: boolean
  showConfigPanel: boolean
  showTemplatesPanel: boolean
}
```

---

## Canvas System

### ReactFlow Integration

The canvas uses `@xyflow/react` (ReactFlow v12) with:

**Custom Nodes:** Each node type has a dedicated component:
```
src/canvas/nodes/
├── GoalNode.tsx
├── DecisionNode.tsx
├── OptionNode.tsx
├── FactorNode.tsx
├── RiskNode.tsx
└── OutcomeNode.tsx
```

**Edge Validation:** Edges have type-based connection rules defined in `domain/edges.ts`.

### Layout System

Uses Dagre for automatic graph layout:
```typescript
import { applyLayout } from '@/canvas/layout'

// Apply layout with default settings
applyLayout(nodes, edges)

// Apply with custom policy
applyLayoutWithPolicy(nodes, edges, { direction: 'TB', spacing: 100 })
```

### History (Undo/Redo)

Implemented in the main store with:
- Max 50 history entries
- Debounced history saves
- Separate past/future stacks

---

## Backend Integration

### PLoT API

Base URL: Configured via `VITE_PLOT_LITE_BASE_URL`

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/run` | POST | Run analysis (SSE) |
| `/v1/templates` | GET | List templates |
| `/v1/templates/:id` | GET | Get template details |
| `/v1/limits` | GET | Get API limits |

**Request Format:**
```typescript
interface RunRequest {
  template_id: string
  seed?: number
  graph?: { nodes: Node[]; edges: Edge[] }
  outcome_node?: string
  mode?: 'strict' | 'real'
}
```

**Response Format (ReportV1):**
```typescript
interface ReportV1 {
  schema: 'report.v1'
  results: { conservative: number; likely: number; optimistic: number }
  confidence: { level: 'low' | 'medium' | 'high'; why: string }
  drivers: Array<{ label: string; polarity: 'up' | 'down'; strength: string }>
  model_card: { response_hash: string }
}
```

### Supabase Integration

Used for:
- Authentication (magic link)
- User profiles
- Team management
- Canvas persistence (future)

**Configuration:**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Feature Flags

Feature flags are managed via environment variables and runtime config.

**Pattern:**
```typescript
const FEATURE_FLAGS = {
  ceeEnabled: import.meta.env.VITE_CEE_ENABLED === 'true',
  trustSignals: import.meta.env.VITE_TRUST_SIGNALS === 'true',
}
```

See [FEATURE_FLAG_MATRIX.md](./FEATURE_FLAG_MATRIX.md) for complete list.

---

## Testing Strategy

### Unit Tests (Vitest)

Located alongside source files as `*.spec.ts` or in `__tests__/` directories.

```bash
npm run test        # Run all tests
npm run test:watch  # Watch mode
npm run test:coverage
```

**Key test files:**
- `src/canvas/store.spec.ts` - Store logic
- `src/adapters/plot/client.spec.ts` - API client
- `src/lib/__tests__/` - Utility tests

### E2E Tests (Playwright)

Located in `e2e/` directory.

```bash
npm run e2e       # Headless
npm run e2e:ui    # Interactive mode
```

**Test organization:**
- `e2e/canvas/` - Canvas interaction tests
- `e2e/auth/` - Authentication flows
- `e2e/templates/` - Template loading

---

## Performance Considerations

### Store Modularization

The store split addresses re-render cascades:

**Before:** Single store → any change re-renders all subscribers
**After:** Modular stores → isolated re-renders per domain

### Memoization Patterns

Use selectors to prevent unnecessary re-renders:
```typescript
// Good: Granular selection
const status = useResultsStore(s => s.results.status)

// Avoid: Selecting entire state
const store = useResultsStore()
```

### Canvas Optimization

- Node components use `memo()` with custom comparators
- Edge rendering is virtualized for large graphs
- Layout calculations are debounced

---

## Production Hygiene

### Console Log Guards

All debug logs are guarded with `import.meta.env.DEV` for tree-shaking in production:

```typescript
// Pattern for debug logging
if (import.meta.env.DEV) {
  console.log('[Module] Debug info:', data)
}
```

**Guarded Files:**
| Module | Files |
|--------|-------|
| Adapters | `reconnection.ts`, `httpV1Adapter.ts` |
| Hooks | `usePreviewRun.ts`, `usePalette.ts`, `useAnalysis.ts` |
| Utils | `snapshots.ts`, `supabase.ts` |
| Components | `ValidationSuggestions.tsx` |

### Encrypted Storage (`src/lib/secureStorage.ts`)

Sensitive data encryption using Web Crypto API:

- **Algorithm:** AES-GCM with 256-bit key
- **IV:** Random 12-byte IV per encryption
- **Encoding:** Base64 for localStorage compatibility
- **Fallback:** Plaintext in dev mode without `VITE_STORAGE_KEY`

```typescript
import { secureStorage } from '@/lib/secureStorage'

// Encrypted write
await secureStorage.setItem('key', sensitiveData)

// Encrypted read
const data = await secureStorage.getItem('key')
```

### Structured Logging (`src/lib/logger.ts`)

Environment-aware logging:

| Method | Production | Development |
|--------|------------|-------------|
| `logger.debug()` | No-op | Console |
| `logger.info()` | No-op | Console |
| `logger.warn()` | Console | Console |
| `logger.error()` | Console | Console |

### Request ID Error Propagation

Errors include correlation IDs for debugging:

```typescript
// Error format with request ID
"Analysis failed: timeout. (Request ID: abc123-def456)"
```

Actionable hints per error type:
- `TIMEOUT` → "Try Quick mode"
- `RATE_LIMIT` → "Retry after X seconds"
- `SERVER_ERROR` → "Contact support with Request ID"

---

## Directory Structure Reference

```
src/
├── adapters/          # Backend adapters
│   └── plot/          # PLoT API integration
├── canvas/            # Decision graph editor
│   ├── components/    # Canvas UI components
│   ├── domain/        # Business logic (nodes, edges)
│   ├── hooks/         # Custom React hooks
│   ├── layout/        # Auto-layout algorithms
│   ├── nodes/         # Custom node renderers
│   ├── stores/        # Modular Zustand stores (NEW)
│   ├── utils/         # Canvas utilities
│   └── validation/    # Graph validation
├── components/        # Shared UI components
├── contexts/          # React contexts
├── lib/               # Core utilities
├── routes/            # Page components
└── templates/         # Decision templates
```

---

## Next Steps for New Developers

1. **Run the app locally** - Follow [GETTING_STARTED.md](./GETTING_STARTED.md)
2. **Explore the canvas** - Create nodes, connect them, run analysis
3. **Read the code** - Start with `src/canvas/ReactFlowGraph.tsx`
4. **Run tests** - `npm test` to see the test suite
5. **Check roadmap** - See [ROADMAP_V2_NEXT.md](./ROADMAP_V2_NEXT.md) for planned work

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Quick start guide |
| [FEATURE_FLAG_MATRIX.md](./FEATURE_FLAG_MATRIX.md) | Feature flags reference |
| [guides/CANVAS_USER_GUIDE.md](./guides/CANVAS_USER_GUIDE.md) | User guide |
| [technical/](./technical/) | Technical specifications |
