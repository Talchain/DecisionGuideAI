# Developer Notes - v1.3.0-rc1

Technical implementation notes for M1-M6 integration and release hardening.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [M1-M6 Integration](#m1-m6-integration)
- [Hotfixes & Hardening](#hotfixes--hardening)
- [Testing Strategy](#testing-strategy)
- [Performance Considerations](#performance-considerations)
- [Security](#security)
- [Known Issues](#known-issues)

## Architecture Overview

### State Management
- **Zustand** for canvas state (`src/canvas/store.ts`)
- **Local hooks** for component-specific state (ProvenanceSettings, etc.)
- **localStorage** for persistence (RunHistory, Autosave, Scenarios)

### Code Splitting
- **Dynamic imports** for validation/repair modules (lazy-loaded)
- **Debounced validation** (500ms) to prevent excessive computation
- **Lazy Components** (feature-flagged: SnapshotPanel, ScenarioComparison)

### Data Flow
```
User Action → Store Update → Validation (debounced) → UI Update
                         ↓
                    localStorage Sync (throttled)
```

## M1-M6 Integration

### M1: PLoT Engine Hardening

**Health Probe (`src/adapters/plot/v1/health.ts`):**
- HEAD /v1/run with 1→3→10s backoff
- Fallback to hardcoded limits on failure
- Manual retry button in ConnectivityChip

**Live Limits (`src/adapters/plot/v1/limits.ts`):**
- GET /v1/limits with 1h sessionStorage cache
- Zustand store integration (`limitsStore.ts`)
- StatusChips displays current usage vs limits

**96KB Payload Guard (`src/adapters/plot/v1/payloadGuard.ts`):**
- Client-side pre-flight validation using Blob size
- Blocks requests >96KB with error message

**Request Tracking:**
- X-Request-Id header (crypto.randomUUID)
- x-correlation-id for Assistants API
- Debug tray displays both IDs

### M2: Assistants "Draft my model"

**BFF Proxy (`/bff/assist` routes):**
- Supabase Edge Function with 65s timeout
- Server-side auth headers (no API keys in client)
- SSE streaming support

**Client (`src/adapters/assistants/http.ts`):**
- POST /bff/assist/draft-graph (sync)
- POST /bff/assist/draft-graph/stream (streaming)
- Async generator for SSE events

**Provenance (`src/components/assistants/ProvenanceChip.tsx`):**
- Redaction default ON (≤100 chars)
- Toggle with useProvenanceSettings hook
- Document source chips with metadata

### M3: Guided Clarifier

**ClarifierPanel (`src/components/assistants/ClarifierPanel.tsx`):**
- MCQ-first question answering
- ≤3 rounds enforced
- Aria-live for accessibility

### M4: Graph Health & Repair

**Validation Lifecycle:**
- On load (hydration)
- On edit (debounced 500ms)
- On patch (immediate)
- Pre-run gate (blocking)

**Repair Order:**
1. dangling_edge (highest priority)
2. self_loop
3. duplicate_edge
4. cycle
5. missing_label
6. orphan_node (lowest priority)

**Components:**
- HealthStatusBar (top banner)
- IssuesPanel (right-side panel)
- NeedleMoversOverlay (key factors)

### M5: Grounding & Provenance Hub

**Document Memory Guards:**
- 1MB file size limit
- 5k chars/file truncation
- 25k total chars enforcement
- FNV-1a hash for content integrity

**File Types Supported:**
- PDF (application/pdf)
- TXT (text/plain)
- MD (text/markdown)
- CSV (text/csv)

**Provenance Hub:**
- Citations grouped by document
- Search filter by snippet or node ID
- Deep-linking to focused nodes

### M6: Compare v0

**RunHistory (`src/canvas/store/runHistory.ts`):**
- Max 20 runs (localStorage)
- Pinned runs preserved beyond limit
- P50 extraction from report.run.bands.p50 or results.likely
- Zero-delta shows "No material change"

**Comparison:**
- Driver deltas (added/removed/common)
- Summary change detection
- Side-by-side view in ResultsPanel

## Hotfixes & Hardening

### P0 Hotfixes

**ID Reseeding (`src/canvas/store.ts`):**
```typescript
reseedIds(nodes: Node[], edges: Edge[]): void {
  const numericIds = [...nodes, ...edges]
    .map(n => parseInt(n.id, 10))
    .filter(n => !isNaN(n))

  if (numericIds.length > 0) {
    const maxId = Math.max(...numericIds)
    this.nodeIdCounter = Math.max(maxId + 1, 5) // Min watermark 5
    this.edgeIdCounter = Math.max(maxId + 1, 5)
  }
}
```

**Compare Selection Dedupe:**
```typescript
setSelectedSnapshotsForComparison(ids: string[]): void {
  const dedupedIds = Array.from(new Set(ids)).slice(-2) // Most recent 2
  set({ selectedSnapshotsForComparison: dedupedIds })
}
```

**Document Guard:**
- 1MB: `MAX_FILE_SIZE = 1 * 1024 * 1024`
- 5k/file: `MAX_CHAR_PER_FILE = 5000`
- 25k total: `MAX_TOTAL_CHARS = 25000`

### P1 Hotfixes

**Hydration Hygiene:**
```typescript
hydrateGraphSlice(loaded: Partial<CanvasState>): void {
  const updates: Partial<CanvasState> = {}

  // Only merge graph/scenario keys
  if (loaded.nodes !== undefined) updates.nodes = loaded.nodes
  if (loaded.edges !== undefined) updates.edges = loaded.edges
  if (loaded.currentScenarioId !== undefined) updates.currentScenarioId = loaded.currentScenarioId

  // Reset ephemeral state
  updates.history = { past: [], future: [] }
  updates.selection = { nodeIds: new Set(), edgeIds: new Set() }

  set(updates)
  get().reseedIds(loaded.nodes || [], loaded.edges || [])
}
```

### P2 Hotfixes

**Autosave Throttle:**
```typescript
let lastAutosavePayload: string | null = null

export function saveAutosave(data: AutosaveData): void {
  const payload = JSON.stringify(data)

  // Skip write if payload identical
  if (payload === lastAutosavePayload) return

  localStorage.setItem(AUTOSAVE_KEY, payload)
  lastAutosavePayload = payload
}
```

**Document Checksum (FNV-1a):**
```typescript
function generateContentHash(content: string): string {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 16777619) // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
```

## Testing Strategy

### Unit Tests
- **Vitest** with Testing Library
- **Test Coverage:** 98 new tests (51 hotfix + 47 feature)
- **Mocking:** Zustand stores, hooks, localStorage

### DOM Tests
- **NeedleMoversOverlay**: 24 tests (rendering, sorting, callbacks)
- **ProvenanceChip**: 23 tests (redaction, expand/collapse, metadata)

### Integration Tests
- **RunHistory**: 18 tests (localStorage, pruning, comparison)
- **SaveStatusPill**: 6 tests (time formatting, savedBy logic)

### Test Files
```
src/canvas/__tests__/
  ├── ids.reseed.spec.ts (8 tests)
  ├── compare.selection.spec.ts (11 tests)
  ├── documents.guard.spec.ts (10 tests)
  └── hydrate.graphSlice.spec.ts (13 tests)

src/canvas/store/__tests__/
  ├── autosave.throttle.spec.ts (9 tests)
  └── runHistory.test.ts (18 tests)

src/canvas/components/__tests__/
  ├── NeedleMoversOverlay.dom.spec.tsx (24 tests)
  └── SaveStatusPill.spec.tsx (6 tests)

src/components/assistants/__tests__/
  └── ProvenanceChip.spec.tsx (23 tests)
```

## Performance Considerations

### Bundle Size
- **Target:** ≤ 500KB main chunk
- **Code Splitting:** Validation/repair modules lazy-loaded
- **Tree Shaking:** Unused lucide-react icons removed

### Runtime Performance
- **Debounced Validation:** 500ms delay to prevent excessive computation
- **Memoization:** React.memo for expensive components
- **Virtual Scrolling:** Not yet implemented (future optimization)

### Memory Management
- **RunHistory Pruning:** Max 20 runs (pinned preserved)
- **Document Limits:** 1MB file, 25k total chars
- **Autosave Throttle:** Skips redundant writes

## Security

### API Key Management
- **NO OpenAI SDK in browser bundle**
- **All /assist/* calls via BFF proxy**
- **Server-side auth headers only**

### Data Privacy
- **Redaction default ON** (ProvenanceChip, useProvenanceSettings)
- **Snippet truncation** ≤100 chars when redacted
- **Document content** never sent to PLoT engine (only metadata)

### CORS & CSP
- **BFF Proxy:** Handles CORS for Assistants API
- **Supabase:** Handles CORS for PLoT engine
- **CSP:** Not yet implemented (future security enhancement)

## Known Issues

### Pre-Existing
- **StatusChips tests:** 18 failures due to outdated test format (not blocking)
- **ESLint:** 2000 warnings (mostly hard-coded colors in plot-lite, test setup files)

### Workarounds
- **StatusChips loading state:** Tests need updating to match new "always visible" behavior
- **Process global:** ESLint errors in test setup files (false positives, env already configured)

### Future Work
- **Version display:** Add package.json version to DebugTray
- **Gitleaks integration:** CI/CD security scanning
- **Performance monitoring:** PostHog/Sentry integration
- **E2E tests:** Playwright scenarios for critical user flows

## Changelog

For user-facing changes, see [CHANGELOG.md](../CHANGELOG.md).

## Release Notes

For QA checklist and release testing, see [QA-CHECKLIST-RC.md](./QA-CHECKLIST-RC.md).

---

_Last updated: 2025-01-12 for v1.3.0-rc1_
