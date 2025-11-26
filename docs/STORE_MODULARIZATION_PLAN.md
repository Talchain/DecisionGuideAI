# Store Modularization Plan

**Created:** 2025-11-26
**Status:** Planning
**Risk Level:** HIGH
**Requires:** Feature Freeze (1 week recommended)

---

## Executive Summary

The `src/canvas/store.ts` file has grown to **1,758 lines** with **976 usages** across **97 files**. This monolithic store creates:
- Merge conflicts during parallel development
- Performance issues from unnecessary re-renders
- Difficulty in testing individual features
- Cognitive load for developers

**Recommendation:** Split into 5 focused stores with backward-compatible re-exports.

---

## Current State Analysis

### Store Size
- **Lines:** 1,758
- **State slices:** 6 major areas
- **Actions:** 50+ methods
- **Consumers:** 97 files (976 usages)

### State Slices Identified

| Slice | Fields | Lines (est) | Consumers |
|-------|--------|-------------|-----------|
| Graph | nodes, edges, history, selection, clipboard | ~400 | ~60 |
| Results | results, runMeta, progress | ~200 | ~25 |
| Scenarios | currentScenario, framing, dirty, library | ~150 | ~15 |
| Panels | show*Panel flags | ~100 | ~30 |
| Documents | documents, citations, provenance | ~150 | ~20 |
| UI/Misc | selectedTemplate, graphHealth, etc | ~200 | ~40 |

---

## Target Architecture

### New Store Structure

```
src/canvas/stores/
├── index.ts              # Re-exports for backward compatibility
├── graphStore.ts         # Nodes, edges, history, selection
├── resultsStore.ts       # Results, runMeta, progress
├── scenarioStore.ts      # Scenarios, framing, dirty flags
├── panelsStore.ts        # Panel visibility flags
├── documentsStore.ts     # Documents, citations, provenance
└── uiStore.ts            # Selected items, health, misc UI state
```

### Backward Compatibility

```typescript
// src/canvas/store.ts (after migration)
// Re-export everything for backward compatibility
export { useGraphStore } from './stores/graphStore'
export { useResultsStore } from './stores/resultsStore'
export { useScenarioStore } from './stores/scenarioStore'
export { usePanelsStore } from './stores/panelsStore'
export { useDocumentsStore } from './stores/documentsStore'
export { useUIStore } from './stores/uiStore'

// Legacy combined store (deprecated)
export const useCanvasStore = /* combined selector */
```

---

## Migration Strategy

### Phase 1: Preparation (Day 1)

1. **Create store files** with empty shells
2. **Add re-exports** in main store.ts
3. **Run tests** to verify no breakage

### Phase 2: Graph Store (Day 2)

**State to move:**
```typescript
interface GraphState {
  nodes: Node[]
  edges: Edge<EdgeData>[]
  history: { past: [...]; future: [...] }
  selection: { nodeIds: Set<string>; edgeIds: Set<string> }
  clipboard: ClipboardData | null
  reconnecting: ReconnectState | null
  touchedNodeIds: Set<string>
  nextNodeId: number
  nextEdgeId: number
}
```

**Actions to move:**
- addNode, updateNode, deleteNode
- addEdge, updateEdge, deleteEdge
- onNodesChange, onEdgesChange
- undo, redo, clearHistory
- selectNodes, selectEdges, clearSelection
- copy, paste, cut

### Phase 3: Results Store (Day 3)

**State to move:**
```typescript
interface ResultsState {
  results: {
    status: ResultsStatus
    progress: number
    runId?: string
    report?: ReportV1 | null
    error?: ErrorV1 | null
    // ...
  }
  runMeta: RunMetaState
}
```

**Actions to move:**
- setResultsStatus, setProgress, setReport
- setRunMeta, clearResults
- startRun, completeRun, failRun

### Phase 4: Panels Store (Day 3)

**State to move:**
```typescript
interface PanelsState {
  showResultsPanel: boolean
  showInspectorPanel: boolean
  showIssuesPanel: boolean
  showConfigPanel: boolean
  showTemplatesPanel: boolean
  templatesPanelInvoker: { focus: () => void } | null
}
```

**Actions to move:**
- toggleResultsPanel, toggleInspectorPanel
- toggleIssuesPanel, toggleConfigPanel
- setTemplatesPanelInvoker

### Phase 5: Scenarios & Documents (Day 4)

**Scenarios State:**
```typescript
interface ScenarioState {
  currentScenario: Scenario | null
  scenarioFraming: ScenarioFraming | null
  dirtyScenario: boolean
  scenarioLibrary: Scenario[]
}
```

**Documents State:**
```typescript
interface DocumentsState {
  documents: Document[]
  citations: Citation[]
  provenanceCache: Map<string, string>
  documentSearch: string
  documentSortField: string
  documentSortDirection: string
}
```

### Phase 6: Consumer Migration (Day 5)

**Strategy:** Update imports file by file
- Use search/replace for simple cases
- Manual review for complex selectors
- Run tests after each batch

### Phase 7: Cleanup (Day 5)

- Remove deprecated code
- Update documentation
- Final test run

---

## Risk Mitigation

### Before Starting

1. **Feature freeze** - No new features during migration
2. **Full test run** - Baseline all tests passing
3. **Branch protection** - Direct commits to main blocked

### During Migration

1. **Atomic commits** - One store at a time
2. **Test after each phase** - No moving forward with failures
3. **Rollback plan** - Keep old store.ts until proven stable

### After Migration

1. **Performance testing** - Verify no regressions
2. **Soak period** - 1 week in staging before production
3. **Gradual deprecation** - Warn on legacy useCanvasStore usage

---

## Consumer Migration Guide

### Simple Selector (most common)

```typescript
// Before
const nodes = useCanvasStore(s => s.nodes)

// After
import { useGraphStore } from '@/canvas/stores'
const nodes = useGraphStore(s => s.nodes)
```

### Multiple Slices

```typescript
// Before
const { nodes, showResultsPanel } = useCanvasStore(s => ({
  nodes: s.nodes,
  showResultsPanel: s.showResultsPanel
}))

// After
import { useGraphStore, usePanelsStore } from '@/canvas/stores'
const nodes = useGraphStore(s => s.nodes)
const showResultsPanel = usePanelsStore(s => s.showResultsPanel)
```

### Actions

```typescript
// Before
const addNode = useCanvasStore(s => s.addNode)

// After
import { useGraphStore } from '@/canvas/stores'
const addNode = useGraphStore(s => s.addNode)
```

---

## Testing Strategy

### Unit Tests
- Each new store has its own test file
- Test state updates in isolation
- Test cross-store interactions

### Integration Tests
- Canvas rendering with new stores
- Results flow end-to-end
- Scenario save/load

### E2E Tests
- Full user flows unchanged
- No visual regressions

---

## Timeline

| Day | Phase | Risk | Checkpoint |
|-----|-------|------|------------|
| 1 | Preparation | Low | Tests pass |
| 2 | Graph Store | High | Graph actions work |
| 3 | Results + Panels | Medium | Run analysis works |
| 4 | Scenarios + Docs | Medium | Save/load works |
| 5 | Migration + Cleanup | High | All tests pass |

**Total:** 5 days with feature freeze

---

## Success Criteria

1. **All tests passing** (unit, integration, E2E)
2. **No runtime errors** in production build
3. **Performance maintained** (no FPS drop in canvas)
4. **Bundle size unchanged** (±5%)
5. **Developer experience improved** (measured by PR feedback)

---

## Rollback Plan

If critical issues found after merge:

1. **Revert commit** - Single commit to revert
2. **Restore old store.ts** - Keep backup in `store.ts.backup`
3. **Notify team** - Immediate Slack notification
4. **Post-mortem** - Document what went wrong

---

## Files to Update

### High Priority (Core Canvas)
```
src/canvas/ReactFlowGraph.tsx
src/canvas/components/*.tsx
src/canvas/hooks/*.ts
```

### Medium Priority (Panels)
```
src/canvas/panels/*.tsx
src/components/assistants/*.tsx
```

### Low Priority (Utilities)
```
src/canvas/utils/*.ts
src/lib/*.ts
```

---

## Next Steps

1. [ ] Review this plan with team
2. [ ] Schedule feature freeze window
3. [ ] Create store shell files
4. [ ] Begin Phase 1

---

**Last Updated:** 2025-11-26
**Owner:** Development Team
