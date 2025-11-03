# Preview Mode - Technical Documentation

**Status**: Implemented (Phase 2+ Section C)
**Feature**: Non-destructive analysis with staged graph changes
**Related**: `src/canvas/hooks/usePreviewRun.ts`, `src/canvas/store.ts`

## Overview

Preview Mode allows users to analyze "what-if" scenarios by making temporary graph changes (node/edge edits) and running analysis **without** modifying the live canvas state. Changes are staged in memory and can be applied or discarded after reviewing results.

## Architecture

### State Management

Preview state is managed in the Zustand canvas store (`src/canvas/store.ts`):

```typescript
interface PreviewState {
  active: boolean                    // Is preview mode active?
  status: 'idle' | 'preparing' | 'running' | 'complete' | 'error' | 'cancelled'
  progress: number                   // 0-100 for streaming progress
  stagedNodes: Map<string, Partial<Node>>       // Node updates
  stagedEdges: Map<string, Partial<EdgeData>>   // Edge updates
  error?: { code: string; message: string; retryAfter?: number; violations?: ValidationViolation[] }
  previewReport?: ReportV1           // Analysis results
  previewSeed?: number
  previewHash?: string
}
```

### Core Operations

**Enter Preview Mode**:
```typescript
previewEnter(): void
```
- Sets `preview.active = true`
- Initializes empty staged maps
- Preserves current canvas state

**Stage Changes**:
```typescript
previewStageNode(id: string, updates: Partial<Node>): void
previewStageEdge(id: string, updates: Partial<EdgeData>): void
```
- Stores changes in staging maps
- Does NOT mutate live canvas
- Supports partial updates (only changed fields)

**Get Merged Graph**:
```typescript
previewGetMergedGraph(): { nodes: Node[]; edges: Edge<EdgeData>[] }
```
- Returns current canvas graph + staged changes
- Used for analysis without side effects
- Implements object spread for merging: `{ ...liveNode, ...stagedUpdates }`

**Run Analysis**:
```typescript
runPreview(templateId: string, seed?: number): Promise<void>
```
- Calls `previewGetMergedGraph()` to get analysis input
- Validates graph with client-side preflight checks
- Runs analysis via `plot.run()` or `plot.stream.run()`
- Stores results in `previewReport`

**Apply Changes**:
```typescript
previewApply(): void
```
- Merges staged changes into live canvas
- Exits preview mode
- Clears staging maps

**Discard Changes**:
```typescript
previewDiscard(): void
```
- Clears staged changes
- Exits preview mode
- Live canvas unchanged

## User Flow

1. User enters Preview Mode (e.g., via keyboard shortcut or UI button)
2. User makes changes to nodes/edges (edits are staged, not applied)
3. User clicks "Preview Run" → analysis runs on merged graph
4. User reviews results in Preview Results panel
5. User chooses:
   - **Apply** → staged changes commit to live canvas
   - **Discard** → staged changes are discarded, live canvas unchanged
   - **Exit** → same as discard

## Persistence & Security

**Preview State is Ephemeral**:
- Preview state is NOT persisted to `localStorage`
- `saveState()` and `saveSnapshot()` explicitly exclude preview state (Task H3)
- Only `nodes` and `edges` are persisted:
  ```typescript
  const persisted: PersistedState = {
    version: 1,
    timestamp: Date.now(),
    nodes: state.nodes,  // NOT using spread operator
    edges: state.edges,
  }
  ```

**Security Rationale**:
- Preview changes may contain sensitive "what-if" scenarios
- Users may not want speculative edits saved
- Preview is designed for exploration, not persistence

## Validation

**Client-Side Preflight**:
- `validateGraph(mergedGraph)` runs before analysis
- Checks node/edge limits against backend constraints
- Prevents wasteful API calls for invalid graphs

**Backend Validation**:
- Analysis request includes preflight `/v1/validate` call
- Backend enforces limits (nodes, edges, label length, etc.)
- Errors bubble up to `previewError()` state

## Integration with PLoT v1 Adapter

Preview Mode uses the same `plot.run()` interface as standard runs, but passes the merged graph explicitly:

```typescript
const request: RunRequest = {
  template_id: templateId,
  graph: mergedGraph,  // Merged graph with staged changes
  seed: useSeed,
}

const report = await plot.run(request)
previewSetReport(report, useSeed, report.model_card.response_hash)
```

**Streaming Support**:
- If `plot.stream.run()` is available, Preview Mode uses SSE streaming
- Progress updates (`onTick`) drive progress bar
- Fallback to sync API if streaming unavailable

## UI Components

**NodeInspector**:
- Detects preview mode: `const inPreview = useCanvasStore(s => s.preview.active)`
- Shows "Staged Changes" badge for nodes with staged edits
- Edit controls update staging maps, not live nodes

**ResultsPanel**:
- Displays preview results in dedicated "Preview Results" section
- Shows diff between current results and preview results
- "Apply" and "Discard" buttons visible

## Testing

**Unit Tests**: `src/canvas/__tests__/store.spec.ts`
- Tests preview state transitions
- Verifies staged changes don't mutate live state
- Confirms merged graph includes staged updates

**E2E Tests**: `e2e/canvas.preview.spec.ts` (deferred to Task I6)
- User enters preview, makes edits, runs analysis
- Verifies results show in preview panel
- Confirms Apply commits changes, Discard reverts

## Performance Considerations

**Memory**:
- Staging maps use `Map<string, Partial<T>>` for O(1) lookups
- Only changed fields are stored (not full object clones)

**Rendering**:
- Preview changes do NOT trigger canvas re-renders
- Only preview panel re-renders on `previewReport` update
- Live canvas remains static during preview

## Future Enhancements

**Diff Visualization**:
- Highlight staged nodes/edges with visual indicators (e.g., dashed border)
- Show "before/after" comparison in inspector

**Undo/Redo in Preview**:
- Support undo within preview staging
- Separate history stack from live canvas history

**Preview Snapshots**:
- Allow saving preview scenarios as named variations
- Compare multiple "what-if" scenarios side-by-side

## Related Documentation

- [PLOT_V1_Integration.md](./PLOT_V1_Integration.md) - PLoT v1 adapter integration
- [PLOT_V1_HTTP_ADAPTER_TDD.md](./PLOT_V1_HTTP_ADAPTER_TDD.md) - Adapter TDD patterns
- [CANVAS_USER_GUIDE.md](./CANVAS_USER_GUIDE.md) - User-facing canvas features

## Change Log

- **2025-10-30**: Initial documentation (Phase 2+ Section J, Task J1)
- **Phase 2+ Section C**: Preview Mode implementation completed
