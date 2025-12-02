# Architecture - Guide Variant

This document provides a visual and technical overview of the guide variant's architecture, data flow, and component relationships.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Component Hierarchy](#component-hierarchy)
3. [Data Flow](#data-flow)
4. [Journey State Machine](#journey-state-machine)
5. [Store Architecture](#store-architecture)
6. [Event Flow](#event-flow)
7. [Integration Points](#integration-points)

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Guide Variant (/sandbox/guide)"
        Entry[index.tsx<br/>Entry Point]
        Layout[GuideLayout.tsx<br/>3-Panel Layout]

        subgraph "Top Bar"
            TopBar[GuideTopBar<br/>Journey Stage + Alerts]
        end

        subgraph "Main Content"
            Canvas[GuideCanvas<br/>ReactFlow Wrapper]
            Panel[GuidePanel<br/>Adaptive Panel]
        end

        subgraph "Bottom Toolbar"
            Toolbar[GuideBottomToolbar<br/>Quick Actions]
        end

        subgraph "State Management"
            GuideStore[useGuideStore<br/>Journey + Selection]
            Detection[useJourneyDetection<br/>Auto-detect Stage]
        end

        Entry --> Layout
        Layout --> TopBar
        Layout --> Canvas
        Layout --> Panel
        Layout --> Toolbar
        Layout --> Detection
        Detection --> GuideStore
    end

    subgraph "Shared Backend"
        CanvasStore[useCanvasStore<br/>Nodes + Edges]
        ResultsStore[useResultsStore<br/>PLoT + CEE Results]
        PLoT[PLoT Engine<br/>Analysis]
        CEE[CEE Engine<br/>Insights]
    end

    Canvas -.READ.-> CanvasStore
    Panel -.READ.-> CanvasStore
    Panel -.READ.-> ResultsStore
    Detection -.READ.-> CanvasStore
    Detection -.READ.-> ResultsStore

    ResultsStore --> PLoT
    ResultsStore --> CEE

    style Entry fill:#e1f5fe
    style Layout fill:#b3e5fc
    style GuideStore fill:#fff9c4
    style CanvasStore fill:#ffccbc
    style ResultsStore fill:#ffccbc
```

### Key Principles

1. **Isolation**: Guide code in `/sandbox-guide/`, no imports from `/sandbox/`
2. **Read-Only**: Guide reads from shared stores, never writes
3. **Separation**: `useGuideStore` for guide-specific state
4. **Shared Backend**: Reuses PLoT, CEE, canvas, auth from main app

---

## Component Hierarchy

```mermaid
graph TD
    Root[GuideLayout]

    Root --> TopBar[GuideTopBar]
    Root --> Canvas[GuideCanvas]
    Root --> Panel[GuidePanel]
    Root --> Toolbar[GuideBottomToolbar]
    Root --> Modal[HelpModal]

    Canvas --> RFGraph[ReactFlowGraph<br/>Shared Component]
    Canvas --> Overlay[GuideCanvasOverlay]

    Panel --> ErrorBoundary[GuideErrorBoundary]
    ErrorBoundary --> States{Switch on<br/>Journey Stage}

    States --> Empty[EmptyState]
    States --> Building[BuildingState]
    States --> PreBlocked[PreRunBlockedState]
    States --> PreReady[PreRunReadyState]
    States --> Post[PostRunState]
    States --> Inspector[InspectorState]
    States --> Compare[CompareState]

    Post --> TopDrivers[TopDriversSection]
    Post --> Risks[RisksSection]
    Post --> Advanced[AdvancedMetricsSection]

    TopDrivers --> Expand1[ExpandableSection]
    Risks --> Expand2[ExpandableSection]
    Advanced --> Expand3[ExpandableSection]

    Empty --> Button1[Button]
    Building --> Badge1[Badge]
    PreReady --> Button2[Button]
    Post --> Card[Card]

    style Root fill:#b3e5fc
    style Panel fill:#c5e1a5
    style States fill:#fff9c4
    style Empty fill:#ffccbc
    style Building fill:#ffccbc
    style Post fill:#ffccbc
```

---

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Canvas
    participant CanvasStore
    participant Detection
    participant GuideStore
    participant Panel
    participant PLoT
    participant Results

    User->>Canvas: Add nodes
    Canvas->>CanvasStore: Update nodes/edges
    CanvasStore-->>Detection: Subscribe (READ)
    Detection->>Detection: Determine journey stage
    Detection->>GuideStore: Set journey stage
    GuideStore-->>Panel: Subscribe
    Panel->>Panel: Switch to BuildingState

    User->>Canvas: Select node
    Canvas->>GuideStore: selectElement(nodeId)
    GuideStore-->>Detection: Subscribe
    Detection->>Detection: Stage = inspector
    Detection->>GuideStore: Set stage
    Panel->>Panel: Switch to InspectorState

    User->>Panel: Click "Run Analysis"
    Panel->>PLoT: Run analysis
    PLoT->>Results: Update report
    Results-->>Detection: Subscribe (READ)
    Detection->>Detection: Stage = post-run
    Detection->>GuideStore: Set stage
    Panel->>Panel: Switch to PostRunState
    Panel->>Results: Read report (READ)
    Panel->>Panel: Display insights
```

### Data Flow Rules

1. **Canvas Store** → Guide (READ ONLY)
   - Nodes, edges, outcomeNodeId
   - Never modified by guide

2. **Results Store** → Guide (READ ONLY)
   - PLoT report, CEE review, status
   - Never modified by guide

3. **Guide Store** → Guide (READ/WRITE)
   - Journey stage, selected element, compare mode
   - Only modified by guide

4. **Journey Detection** → Auto Updates
   - Subscribes to canvas, results, guide stores
   - Automatically determines journey stage
   - Updates guide store with new stage

---

## Journey State Machine

```mermaid
stateDiagram-v2
    [*] --> empty: App loads

    empty --> building: Add first node

    building --> pre_run_blocked: Graph invalid
    building --> pre_run_ready: Graph valid
    building --> inspector: Select element

    pre_run_blocked --> building: Fix issues
    pre_run_blocked --> pre_run_ready: Fix issues
    pre_run_blocked --> inspector: Select element

    pre_run_ready --> post_run: Run analysis
    pre_run_ready --> building: Edit graph
    pre_run_ready --> inspector: Select element

    post_run --> inspector: Select element
    post_run --> building: Edit graph
    post_run --> compare: Enable compare

    compare --> post_run: Disable compare

    inspector --> post_run: Deselect (if results)
    inspector --> building: Deselect (if no results)
    inspector --> pre_run_ready: Deselect (if valid)
    inspector --> pre_run_blocked: Deselect (if blocked)

    building --> empty: Clear all
    post_run --> empty: Clear all
    inspector --> empty: Clear all

    note right of empty
        Priority: 7 (lowest)
        No nodes on canvas
    end note

    note right of building
        Priority: 6
        Has nodes, incomplete
    end note

    note right of pre_run_blocked
        Priority: 5
        Graph has blockers
    end note

    note right of pre_run_ready
        Priority: 4
        Graph valid, ready
    end note

    note right of post_run
        Priority: 3
        Results available
    end note

    note right of compare
        Priority: 2
        Compare mode active
    end note

    note right of inspector
        Priority: 1 (highest)
        Element selected
    end note
```

### Priority Order (Highest to Lowest)

Implementation in `utils/journeyDetection.ts`:

```typescript
export function determineJourneyStage(context: JourneyContext): JourneyStage {
  // 1. Inspector (highest priority)
  if (context.selectedElement) return 'inspector'

  // 2. Compare mode
  if (context.compareMode) return 'compare'

  // 3. Post-run (results available)
  if (context.results.status === 'complete') return 'post-run'

  // 4. Pre-run (graph validation)
  if (context.graph.nodes.length > 0) {
    const blockers = findBlockers(context.graph)
    return blockers.length === 0 ? 'pre-run-ready' : 'pre-run-blocked'
  }

  // 5. Building (has nodes)
  if (context.graph.nodes.length > 0) return 'building'

  // 6. Empty (default)
  return 'empty'
}
```

---

## Store Architecture

```mermaid
graph TB
    subgraph "Guide Store (useGuideStore)"
        CS_State[State]
        CS_Journey[journeyStage: JourneyStage]
        CS_Selected[selectedElement: string | null]
        CS_Panel[panelExpanded: boolean]
        CS_Compare[compareMode: boolean]

        CS_State --> CS_Journey
        CS_State --> CS_Selected
        CS_State --> CS_Panel
        CS_State --> CS_Compare

        CS_Actions[Actions]
        CS_SetJourney[setJourneyStage]
        CS_SelectElem[selectElement]
        CS_ClearSelect[clearSelection]
        CS_TogglePanel[togglePanel]
        CS_SetCompare[setCompareMode]

        CS_Actions --> CS_SetJourney
        CS_Actions --> CS_SelectElem
        CS_Actions --> CS_ClearSelect
        CS_Actions --> CS_TogglePanel
        CS_Actions --> CS_SetCompare
    end

    subgraph "Canvas Store (READ ONLY)"
        CVS_State[State]
        CVS_Nodes[nodes: Node[]]
        CVS_Edges[edges: Edge[]]
        CVS_Outcome[outcomeNodeId: string]

        CVS_State --> CVS_Nodes
        CVS_State --> CVS_Edges
        CVS_State --> CVS_Outcome
    end

    subgraph "Results Store (READ ONLY)"
        RS_State[State]
        RS_Status[status: 'idle' | 'loading' | 'complete' | 'error']
        RS_Report[report: ReportV1]
        RS_CEE[ceeReview: CeeDecisionReviewPayload]

        RS_State --> RS_Status
        RS_State --> RS_Report
        RS_State --> RS_CEE
    end

    Detection[useJourneyDetection Hook]

    CVS_State -.READ.-> Detection
    RS_State -.READ.-> Detection
    CS_State -.READ.-> Detection

    Detection -->|setJourneyStage| CS_SetJourney

    Panel[GuidePanel]
    Inspector[InspectorState]
    PostRun[PostRunState]

    CS_Journey -.subscribe.-> Panel
    CS_Selected -.subscribe.-> Inspector
    RS_Report -.READ.-> PostRun
    CVS_Nodes -.READ.-> PostRun

    style CS_State fill:#fff9c4
    style CVS_State fill:#ffccbc
    style RS_State fill:#ffccbc
    style Detection fill:#c5e1a5
```

---

## Event Flow

### User Adds Node

```mermaid
sequenceDiagram
    actor User
    participant Canvas
    participant CanvasStore
    participant Detection
    participant GuideStore
    participant Panel

    User->>Canvas: Drag node onto canvas
    Canvas->>CanvasStore: addNode(newNode)
    CanvasStore->>CanvasStore: nodes = [...nodes, newNode]

    Note over Detection: Subscribed to CanvasStore
    CanvasStore-->>Detection: Notify: nodes changed
    Detection->>Detection: determineJourneyStage()
    Detection->>Detection: Stage = 'building'
    Detection->>GuideStore: setJourneyStage('building')

    Note over Panel: Subscribed to GuideStore
    GuideStore-->>Panel: Notify: stage changed
    Panel->>Panel: Render BuildingState
```

### User Runs Analysis

```mermaid
sequenceDiagram
    actor User
    participant PreReady[PreRunReadyState]
    participant ResultsRun[useResultsRun Hook]
    participant PLoT
    participant ResultsStore
    participant Detection
    participant GuideStore
    participant Panel

    User->>PreReady: Click "Run Analysis"
    PreReady->>ResultsRun: run({ graph, outcome_node, seed })
    ResultsRun->>ResultsStore: Set status = 'loading'
    ResultsStore-->>Detection: Notify: status changed
    Detection->>GuideStore: setJourneyStage('pre-run-ready')
    Note over Panel: Still shows PreRunReadyState<br/>with loading spinner

    ResultsRun->>PLoT: POST /analyze
    PLoT->>PLoT: Run probabilistic analysis
    PLoT-->>ResultsRun: Return report
    ResultsRun->>ResultsStore: Set report + status = 'complete'

    ResultsStore-->>Detection: Notify: status changed
    Detection->>Detection: determineJourneyStage()
    Detection->>Detection: Stage = 'post-run'
    Detection->>GuideStore: setJourneyStage('post-run')

    GuideStore-->>Panel: Notify: stage changed
    Panel->>Panel: Render PostRunState
    Panel->>ResultsStore: Read report (READ ONLY)
    Panel->>Panel: Display insights
```

### User Selects Node

```mermaid
sequenceDiagram
    actor User
    participant Canvas
    participant GuideStore
    participant Detection
    participant Panel

    User->>Canvas: Click node
    Canvas->>Canvas: Detect click on [data-id]
    Canvas->>GuideStore: selectElement(nodeId)

    GuideStore-->>Detection: Notify: selectedElement changed
    Detection->>Detection: determineJourneyStage()
    Detection->>Detection: Stage = 'inspector' (priority 1)
    Detection->>GuideStore: setJourneyStage('inspector')

    GuideStore-->>Panel: Notify: stage changed
    Panel->>Panel: Render InspectorState
    Panel->>GuideStore: Read selectedElement
    Panel->>Panel: Display node details
```

---

## Integration Points

### Shared Components (from main app)

```mermaid
graph LR
    subgraph "Guide Variant"
        Canvas[GuideCanvas]
    end

    subgraph "Main App"
        RFG[ReactFlowGraph]
        LoadingSpin[LoadingSpinner]
    end

    subgraph "Shared Stores"
        CanvasStore[useCanvasStore]
        ResultsStore[useResultsStore]
        DocsStore[useDocumentsStore]
    end

    subgraph "Shared Hooks"
        ResultsRun[useResultsRun]
    end

    subgraph "Shared Types"
        ReportV1[ReportV1]
        CEEPayload[CeeDecisionReviewPayload]
    end

    Canvas --> RFG
    Canvas -.READ.-> CanvasStore
    Canvas -.READ.-> ResultsStore

    PostRun[PostRunState] --> LoadingSpin
    PostRun -.READ.-> ResultsStore
    PostRun -.READ.-> DocsStore

    PreReady[PreRunReadyState] --> ResultsRun

    PostRun --> ReportV1
    PostRun --> CEEPayload

    style Canvas fill:#b3e5fc
    style PostRun fill:#b3e5fc
    style PreReady fill:#b3e5fc
    style CanvasStore fill:#ffccbc
    style ResultsStore fill:#ffccbc
```

### Data Flow Between Systems

```mermaid
graph TD
    subgraph "User Actions"
        UA1[Build Graph]
        UA2[Run Analysis]
        UA3[Select Element]
    end

    subgraph "Canvas System (Shared)"
        CanvasStore[useCanvasStore<br/>nodes, edges]
    end

    subgraph "Analysis System (Shared)"
        PLoT[PLoT Engine]
        CEE[CEE Engine]
        ResultsStore[useResultsStore<br/>report, ceeReview]
    end

    subgraph "Guide System"
        Detection[useJourneyDetection]
        GuideStore[useGuideStore<br/>stage, selection]
        Panel[GuidePanel]
    end

    UA1 --> CanvasStore
    UA2 --> PLoT
    UA3 --> GuideStore

    CanvasStore -.READ.-> Detection
    PLoT --> ResultsStore
    CEE --> ResultsStore
    ResultsStore -.READ.-> Detection
    GuideStore -.READ/WRITE.-> Detection

    Detection --> GuideStore
    GuideStore --> Panel
    CanvasStore -.READ.-> Panel
    ResultsStore -.READ.-> Panel

    style CanvasStore fill:#ffccbc
    style ResultsStore fill:#ffccbc
    style GuideStore fill:#fff9c4
    style Detection fill:#c5e1a5
    style Panel fill:#c5e1a5
```

---

## Progressive Disclosure Pattern

```mermaid
graph TD
    Data[Data Array: 10 items]
    Slice1[Slice 0-2: Top 3 visible]
    Slice2[Slice 3-9: Hidden 7 items]

    Data --> Slice1
    Data --> Slice2

    Render1[Render visible items]
    Render2[ExpandableSection<br/>title='Show 7 more']

    Slice1 --> Render1
    Slice2 --> Render2

    UI[UI Display]
    Render1 --> UI
    Render2 --> UI

    User[User clicks expand]
    UI --> User
    User --> Expand[Reveal hidden items]
    Expand --> UI2[Updated UI<br/>All 10 items visible]

    style Data fill:#e1f5fe
    style Slice1 fill:#c5e1a5
    style Slice2 fill:#fff9c4
    style UI fill:#b3e5fc
```

### Implementation Pattern

```typescript
// Data
const drivers = report.drivers // 10 items

// Progressive disclosure
const visibleDrivers = drivers.slice(0, 3)
const hiddenDrivers = drivers.slice(3)

// Render
<>
  {visibleDrivers.map(driver => <DriverRow key={driver.node_id} {...driver} />)}

  {hiddenDrivers.length > 0 && (
    <ExpandableSection title={`Show ${hiddenDrivers.length} more drivers`}>
      {hiddenDrivers.map(driver => <DriverRow key={driver.node_id} {...driver} />)}
    </ExpandableSection>
  )}
</>
```

---

## File Structure Map

```
sandbox-guide/
│
├── index.tsx                     # Entry point (route handler)
├── GuideLayout.tsx             # Main layout orchestrator
│
├── hooks/                        # Custom hooks
│   ├── index.ts                 # Barrel export
│   ├── useGuideStore.ts       # Guide state (Zustand)
│   ├── useJourneyDetection.ts   # Auto-detect journey stage
│   └── useKeyboardShortcuts.ts  # Global keyboard shortcuts
│
├── utils/                        # Business logic
│   ├── index.ts                 # Barrel export
│   └── journeyDetection.ts      # Journey detection algorithms
│
├── types/                        # Type definitions
│   └── guide.types.ts         # Core types (JourneyStage, etc.)
│
├── components/
│   ├── canvas/                  # Canvas enhancements
│   │   ├── GuideCanvas.tsx        # Wrapper for ReactFlowGraph
│   │   └── GuideCanvasOverlay.tsx # Top drivers legend
│   │
│   ├── panel/                   # Adaptive panel
│   │   ├── GuidePanel.tsx         # Container (switches on stage)
│   │   ├── states/                  # 7 journey state components
│   │   │   ├── index.ts            # Barrel export
│   │   │   ├── EmptyState.tsx
│   │   │   ├── BuildingState.tsx
│   │   │   ├── PreRunBlockedState.tsx
│   │   │   ├── PreRunReadyState.tsx
│   │   │   ├── PostRunState.tsx
│   │   │   ├── InspectorState.tsx
│   │   │   └── CompareState.tsx
│   │   └── sections/                # Reusable sections
│   │       ├── index.ts            # Barrel export
│   │       ├── TopDriversSection.tsx
│   │       ├── RisksSection.tsx
│   │       └── AdvancedMetricsSection.tsx
│   │
│   ├── shared/                  # Design system components
│   │   ├── index.ts            # Barrel export
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ExpandableSection.tsx
│   │   ├── MetricRow.tsx
│   │   ├── HelpModal.tsx
│   │   └── GuideErrorBoundary.tsx
│   │
│   ├── topbar/                  # Top bar
│   │   └── GuideTopBar.tsx
│   │
│   └── toolbar/                 # Bottom toolbar
│       └── GuideBottomToolbar.tsx
│
├── __tests__/                   # Test files
│   ├── hooks/
│   └── utils/
│
└── Documentation
    ├── README.md               # Safety rules, dev commands
    ├── GETTING_STARTED.md      # Quick start guide
    ├── ARCHITECTURE.md         # This file
    ├── STATUS.md               # Comprehensive project status
    └── ACCESSIBILITY.md        # WCAG guidelines
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | React 18.3.1 | UI library |
| **Language** | TypeScript (strict) | Type safety |
| **State** | Zustand | Lightweight state management |
| **Canvas** | ReactFlow (@xyflow/react) | Graph visualization |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Testing** | Vitest + React Testing Library | Unit & integration tests |
| **Linting** | ESLint | Code quality |
| **Build** | Vite | Fast dev server |

---

## Design Patterns

### 1. Observer Pattern (Store Subscriptions)

Components subscribe to stores and automatically re-render on changes:

```typescript
// Component subscribes to specific state
const journeyStage = useGuideStore((state) => state.journeyStage)
const nodes = useCanvasStore((state) => state.nodes)

// Re-renders when journeyStage or nodes change
```

### 2. State Machine Pattern (Journey Stages)

Journey detection implements a priority-based state machine:

```typescript
// Priority order determines current state
if (selectedElement) return 'inspector'        // Priority 1
if (compareMode) return 'compare'              // Priority 2
if (hasResults) return 'post-run'              // Priority 3
// ... etc
```

### 3. Container/Presentational Pattern

- **Containers**: `GuidePanel`, `GuideCanvas` (manage state)
- **Presentational**: All panel states, shared components (receive props)

### 4. Adapter Pattern (Canvas Integration)

`GuideCanvas` wraps `ReactFlowGraph` and adds guide-specific features:

```typescript
export function GuideCanvas() {
  return (
    <div ref={canvasRef}>
      <ReactFlowGraph />  {/* Shared component, unmodified */}
      {hasResults && <GuideCanvasOverlay />}  {/* Guide enhancement */}
    </div>
  )
}
```

### 5. Progressive Disclosure Pattern

All lists show max 7 items, hide rest behind `<ExpandableSection>`:

```typescript
const visible = items.slice(0, 3)
const hidden = items.slice(3)

return (
  <>
    {visible.map(...)}
    {hidden.length > 0 && (
      <ExpandableSection title={`Show ${hidden.length} more`}>
        {hidden.map(...)}
      </ExpandableSection>
    )}
  </>
)
```

---

## Performance Considerations

### Zustand Optimizations

- O(1) selector lookups
- Only re-render on selected state changes
- No unnecessary re-renders

### React Optimizations

- Minimal component nesting
- No React.memo needed (fast renders)
- useEffect dependencies carefully managed

### Journey Detection

- Runs only when relevant state changes
- Lightweight computation (<1ms)
- No polling or intervals

---

## Security & Safety

### Code Isolation

- All guide code in `/sandbox-guide/`
- ESLint rule prevents imports from `/sandbox/`
- Verification script: `./scripts/verify-guide-safety.sh`

### Read-Only Access

- Guide never writes to `useCanvasStore`
- Guide never writes to `useResultsStore`
- Only writes to `useGuideStore` (isolated)

### Feature Flag

- Behind `VITE_GUIDE_ENABLED` environment variable
- No impact on main app if disabled
- Route `/sandbox/guide` only accessible when enabled

---

## Related Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) - Quick start guide
- [STATUS.md](./STATUS.md) - Comprehensive project status
- [ACCESSIBILITY.md](./ACCESSIBILITY.md) - WCAG guidelines
- [components/shared/README.md](./components/shared/README.md) - Component library
- [components/panel/states/README.md](./components/panel/states/README.md) - State machine guide

---

**Questions?** File an issue with label `guide-variant` or `architecture`.
