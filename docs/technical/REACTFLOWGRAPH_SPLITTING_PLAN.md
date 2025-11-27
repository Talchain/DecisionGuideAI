# ReactFlowGraph Component Splitting Plan

**Created:** 2025-11-26
**Status:** Planning
**Risk Level:** HIGH
**Requires:** Feature Freeze (3-5 days recommended)

---

## Executive Summary

The `src/canvas/ReactFlowGraph.tsx` file has grown to **1,574 lines** with:
- **65+ imports** from various modules
- **50+ state/store selectors** from useCanvasStore and other stores
- **30+ callback handlers** for various interactions
- **10+ useEffect hooks** for side effects
- **10 debug modes** for React #185 investigation

**Recommendation:** Split into focused modules: core component, hooks, handlers, and panels.

---

## Current State Analysis

### Component Metrics
- **Lines:** 1,574
- **Imports:** 65+
- **Store selectors:** ~50
- **Callbacks (useCallback):** ~30
- **Effects (useEffect):** ~10
- **Local state (useState):** ~15
- **Debug modes:** 10

### Identified Code Areas

| Area | Lines (est) | Description |
|------|-------------|-------------|
| Imports & Setup | ~100 | Module imports, types, debug utilities |
| State & Selectors | ~100 | useState, useCanvasStore selectors |
| Event Handlers | ~350 | All useCallback functions |
| Effects | ~200 | useEffect hooks for side effects |
| Debug Modes | ~400 | React #185 investigation scaffolding |
| Main Render | ~400 | JSX return with all overlays/panels |

---

## Target Architecture

### New File Structure

```
src/canvas/
├── ReactFlowGraph.tsx           # Slim main component (~300 lines)
├── hooks/
│   ├── useCanvasState.ts        # All useState and store selectors
│   ├── useCanvasEffects.ts      # Lifecycle effects (autosave, sync, validation)
│   ├── useShareLinkResolver.ts  # URL parsing and run loading
│   ├── useGraphValidation.ts    # Debounced graph validation
│   └── useBlueprintInsertion.ts # Blueprint insertion logic
├── handlers/
│   ├── useNodeHandlers.ts       # Node click, drag, focus handlers
│   ├── useEdgeHandlers.ts       # Edge click, connect, focus handlers
│   ├── usePaneHandlers.ts       # Pane click, context menu handlers
│   ├── useDocumentHandlers.ts   # Document upload/delete handlers
│   ├── useQuickAddHandlers.ts   # Q-key quick add mode handlers
│   └── useRunHandlers.ts        # Run simulation, health fix handlers
├── components/
│   ├── CanvasDebugModes.tsx     # All debug mode components (rf-only, rf-bare, etc.)
│   ├── CanvasOverlays.tsx       # Overlays container component
│   ├── CanvasPanels.tsx         # Panels container component
│   └── CanvasDocks.tsx          # InputsDock/OutputsDock wrapper
└── utils/
    └── debugBreadcrumbs.ts      # logCanvasBreadcrumb, getCanvasDebugMode
```

### After Migration (ReactFlowGraph.tsx ~300 lines)

```typescript
import { useCanvasState } from './hooks/useCanvasState'
import { useCanvasEffects } from './hooks/useCanvasEffects'
import { useNodeHandlers, useEdgeHandlers } from './handlers'
import { CanvasDebugModes } from './components/CanvasDebugModes'
import { CanvasOverlays } from './components/CanvasOverlays'
import { CanvasPanels } from './components/CanvasPanels'

function ReactFlowGraphInner(props: ReactFlowGraphProps) {
  // Consolidated state hook
  const state = useCanvasState()

  // Consolidated effects
  useCanvasEffects(state)

  // Handler hooks
  const nodeHandlers = useNodeHandlers(state)
  const edgeHandlers = useEdgeHandlers(state)
  const paneHandlers = usePaneHandlers(state)

  // Debug mode short-circuit
  if (state.debugMode !== 'normal') {
    return <CanvasDebugModes mode={state.debugMode} />
  }

  return (
    <div className="canvas-container">
      <ReactFlow {...props} {...nodeHandlers} {...edgeHandlers} />
      <CanvasOverlays {...state} />
      <CanvasPanels {...state} />
    </div>
  )
}
```

---

## Migration Strategy

### Phase 1: Extract Utilities (Day 1)

**Files to create:**
```typescript
// src/canvas/utils/debugBreadcrumbs.ts
export type CanvasDebugMode = 'normal' | 'blank' | 'no-reactflow' | ...
export function getCanvasDebugMode(): CanvasDebugMode
export function logCanvasBreadcrumb(message: string, data?: Record<string, any>)
```

**Risk:** Low - pure utility functions, no React dependencies

### Phase 2: Extract Debug Mode Components (Day 1)

**Files to create:**
```typescript
// src/canvas/components/CanvasDebugModes.tsx
export function CanvasDebugModes({ mode }: { mode: CanvasDebugMode })
// Contains: ReactFlowMinimal, ReactFlowEmpty, ReactFlowNoFitView, etc.
```

**Benefit:** Removes ~400 lines from main component

### Phase 3: Extract State Hook (Day 2)

**Files to create:**
```typescript
// src/canvas/hooks/useCanvasState.ts
export function useCanvasState() {
  // All useState declarations
  const [contextMenu, setContextMenu] = useState(...)
  const [draggingNodeIds, setDraggingNodeIds] = useState(...)

  // All useCanvasStore selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const showResultsPanel = useCanvasStore(s => s.showResultsPanel)
  // ... etc

  return {
    // State
    contextMenu, setContextMenu,
    draggingNodeIds, setDraggingNodeIds,
    // Store values
    nodes, edges, showResultsPanel,
    // ... etc
  }
}
```

**Risk:** Medium - need to carefully manage selector stability

### Phase 4: Extract Handler Hooks (Day 2-3)

**Files to create:**

```typescript
// src/canvas/handlers/useNodeHandlers.ts
export function useNodeHandlers(state: CanvasState) {
  const handleNodeClick = useCallback(...)
  const handleFocusNode = useCallback(...)
  const onNodeDragStart = useCallback(...)
  const onNodeDragStop = useCallback(...)

  return { handleNodeClick, handleFocusNode, onNodeDragStart, onNodeDragStop }
}

// src/canvas/handlers/useEdgeHandlers.ts
export function useEdgeHandlers(state: CanvasState) {
  const handleEdgeClick = useCallback(...)
  const handleFocusEdge = useCallback(...)
  const onConnect = useCallback(...)

  return { handleEdgeClick, handleFocusEdge, onConnect }
}

// src/canvas/handlers/useDocumentHandlers.ts
export function useDocumentHandlers(state: CanvasState) {
  const handleUploadDocuments = useCallback(...)
  const handleDeleteDocument = useCallback(...)
  const showDocuments = useCallback(...)

  return { handleUploadDocuments, handleDeleteDocument, showDocuments }
}

// src/canvas/handlers/useQuickAddHandlers.ts
export function useQuickAddHandlers(state: CanvasState) {
  const handlePaneClick = useCallback(...)
  const handleRadialMenuSelect = useCallback(...)
  const handleConfirmConnect = useCallback(...)

  return { handlePaneClick, handleRadialMenuSelect, handleConfirmConnect }
}

// src/canvas/handlers/useRunHandlers.ts
export function useRunHandlers(state: CanvasState) {
  const handleRunSimulation = useCallback(...)
  const handleFixIssue = useCallback(...)
  const handleQuickFixAll = useCallback(...)

  return { handleRunSimulation, handleFixIssue, handleQuickFixAll }
}
```

**Risk:** High - callbacks have many dependencies, need careful extraction

### Phase 5: Extract Effect Hooks (Day 3)

**Files to create:**

```typescript
// src/canvas/hooks/useShareLinkResolver.ts
export function useShareLinkResolver(options: {
  resultsLoadHistorical: (run: Run) => void
  setShowResultsPanel: (show: boolean) => void
  showToast: ShowToast
})

// src/canvas/hooks/useGraphValidation.ts
export function useGraphValidation(nodes: Node[], edges: Edge[])

// src/canvas/hooks/useBlueprintInsertion.ts
export function useBlueprintInsertion(options: {
  blueprintEventBus?: BlueprintEventBus
  nodes: Node[]
  edges: Edge[]
  showToast: ShowToast
})

// src/canvas/hooks/useCanvasEffects.ts
// Combines: E2E helpers, autosave, edge label sync, focus helpers, etc.
export function useCanvasEffects(state: CanvasState)
```

### Phase 6: Extract Render Components (Day 4)

**Files to create:**

```typescript
// src/canvas/components/CanvasOverlays.tsx
// Contains: HighlightLayer, CanvasEmptyState, AlignmentGuides,
//           ContextMenu, ReconnectBanner, RadialQuickAddMenu, ConnectPrompt

// src/canvas/components/CanvasPanels.tsx
// Contains: PropertiesPanel, SettingsPanel, InspectorPanel, IssuesPanel,
//           DocumentsDrawer, ProvenanceHub, LimitsPanel

// src/canvas/components/CanvasDocks.tsx
// Contains: InputsDock, OutputsDock wrapper with proper positioning
```

### Phase 7: Integration & Cleanup (Day 5)

1. **Wire up extracted modules** in main ReactFlowGraph.tsx
2. **Run full test suite** (unit, integration, E2E)
3. **Performance profiling** - verify no render regression
4. **Remove dead code** from original file
5. **Update imports** in consuming files (should be none if exports preserved)

---

## Risk Mitigation

### Before Starting

1. **Feature freeze** - No new canvas features during migration
2. **Full test run** - Establish baseline with all tests passing
3. **Branch protection** - Work on feature branch, no direct main commits
4. **Performance baseline** - Record render metrics before changes

### During Migration

1. **Atomic commits** - One extraction per commit
2. **Test after each phase** - No moving forward with failures
3. **Rollback plan** - Keep original file until proven stable
4. **Re-export everything** - No breaking changes to external imports

### After Migration

1. **Performance testing** - Compare FPS, render counts to baseline
2. **E2E smoke test** - Full canvas interaction flow
3. **Soak period** - 1 week in staging before production
4. **Monitor Sentry** - Watch for React #185 recurrence

---

## Dependency Graph

```
ReactFlowGraph.tsx
├── useCanvasState (no deps)
├── useCanvasEffects (depends on state)
│   ├── useShareLinkResolver
│   ├── useGraphValidation
│   └── useBlueprintInsertion
├── handlers/ (depends on state)
│   ├── useNodeHandlers
│   ├── useEdgeHandlers
│   ├── usePaneHandlers
│   ├── useDocumentHandlers
│   ├── useQuickAddHandlers
│   └── useRunHandlers
└── components/ (depends on state + handlers)
    ├── CanvasDebugModes
    ├── CanvasOverlays
    ├── CanvasPanels
    └── CanvasDocks
```

---

## Testing Strategy

### Unit Tests
- Each extracted hook has its own test file
- Mock store selectors for isolated testing
- Test callback stability (referential equality)

### Integration Tests
- Canvas renders correctly with extracted modules
- Event handlers trigger correct store updates
- Debug modes work as expected

### E2E Tests
- Full user flows unchanged
- Keyboard shortcuts work
- Panel interactions work
- Quick-add mode works

---

## Success Criteria

1. **Main component ≤300 lines** (down from 1,574)
2. **All tests passing** (unit, integration, E2E)
3. **No runtime errors** in production build
4. **Performance maintained** (no FPS drop, no extra renders)
5. **Bundle size unchanged** (±5%)
6. **Developer experience improved** (easier to navigate, test, modify)

---

## Rollback Plan

If critical issues found after merge:

1. **Revert commit** - Single revert to restore original
2. **Keep backup** - Original file saved as `ReactFlowGraph.tsx.backup`
3. **Notify team** - Immediate Slack notification
4. **Post-mortem** - Document what went wrong

---

## Files Affected

### New Files (to create)
```
src/canvas/utils/debugBreadcrumbs.ts
src/canvas/hooks/useCanvasState.ts
src/canvas/hooks/useCanvasEffects.ts
src/canvas/hooks/useShareLinkResolver.ts
src/canvas/hooks/useGraphValidation.ts
src/canvas/hooks/useBlueprintInsertion.ts
src/canvas/handlers/useNodeHandlers.ts
src/canvas/handlers/useEdgeHandlers.ts
src/canvas/handlers/usePaneHandlers.ts
src/canvas/handlers/useDocumentHandlers.ts
src/canvas/handlers/useQuickAddHandlers.ts
src/canvas/handlers/useRunHandlers.ts
src/canvas/handlers/index.ts
src/canvas/components/CanvasDebugModes.tsx
src/canvas/components/CanvasOverlays.tsx
src/canvas/components/CanvasPanels.tsx
src/canvas/components/CanvasDocks.tsx
```

### Modified Files
```
src/canvas/ReactFlowGraph.tsx (major refactor)
```

---

## Next Steps

1. [ ] Review this plan with team
2. [ ] Schedule feature freeze window
3. [ ] Create branch: `refactor/reactflowgraph-splitting`
4. [ ] Begin Phase 1: Extract utilities

---

**Last Updated:** 2025-11-26
**Owner:** Development Team
