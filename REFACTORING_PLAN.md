# SandboxStreamPanel.tsx Refactoring Plan

## Executive Summary
- Current LOC: 1682 lines
- Target: 6 components with main shell < 350 LOC
- No behavior changes
- Extract in order: Flags → Parameters → Output → Controls → Drawers → Enhancements

---

## Section 1: DETAILED BREAKDOWN BY COMPONENT

### A. StreamFlagsProvider (Lines 46-111, ~66 LOC)
**Purpose:** Centralize all feature flag state and initialization logic

**Sections to Extract:**
- Lines 47-79: Individual flag useState declarations (33 flags total)
- Lines 81-111: useEffect for flag re-evaluation and storage event listener
- Lines 47-79: Initial state setup with try-catch patterns
- Lines 113-118: useEffect for mobile guardrails side effect

**Responsibilities:**
- Manage all 33 feature flags as state
- Listen to localStorage changes
- Evaluate flags on mount and on storage events
- Auto-update flags every 250ms for first 2 seconds
- Handle mobile guardrails flag flipping

**State Managed:**
- simplifyFlag, listViewFlag, engineModeFlag, mobileGuardFlag
- summaryV2Flag, guidedFlag, commentsFlag, diagFlag, perfFlag
- scorecardFlag, errorBannersFlag, snapshotsFlag, compareFlag
- (11 additional flags required by dependent components)

**Dependencies (Input):**
- None - provides ALL flag states downstream

**Exports:**
- Hook: useStreamFlags() returning { flags: {...}, isLoading: boolean }

**Derived Logic to Keep:**
- listFirst initialization (lines 150): Keep with mobile guardrails logic
- getMobileCaps computation (line 151): Keep with mobile guardrails flag

---

### B. StreamParametersPanel (Lines 407-428, ~50 LOC + dependencies)
**Purpose:** Parameters controls and persistence for seed, budget, model

**Sections to Extract:**
- Lines 407-416: State declarations (seed, budget, model)
- Lines 417-423: persistParams utility function
- Lines 425-428: guidedSuggestions useMemo
- Lines 431-488: Scenario import and remember-last effects

**Responsibilities:**
- Manage seed, budget, model input state
- Persist params to localStorage
- Handle URL scenario param (?scenario=...)
- Handle remember-last scenario loading
- Compute guided suggestions based on params
- Show scenario import preview dialogs

**State Managed:**
- seed, budget, model
- scenarioPreview (nullable)
- scenarioImportNote (boolean)
- scenarioChipText (nullable string)
- undoRef (undo stack for guided mode)

**Props Interface:**
```typescript
interface StreamParametersProps {
  // States
  seed: string
  budget: string
  model: string
  scenarioChipText: string | null
  scenarioPreview: ScenarioPreview | null
  scenarioImportNote: boolean
  // Callbacks
  onSeedChange: (s: string) => void
  onBudgetChange: (b: string) => void
  onModelChange: (m: string) => void
  onScenarioLoad: (s: { seed: string; budget: string; model: string; name: string }) => void
  onScenarioPreviewSet: (p: ScenarioPreview | null) => void
  onScenarioImportNoteSet: (n: boolean) => void
  onScenarioChipTextSet: (t: string | null) => void
  // Flags
  paramsFlag: boolean
  scenariosFlag: boolean
  guidedFlag: boolean
  // Derived
  guidedSuggestions: Suggestion[]
  undoRef: React.MutableRefObject<UndoStack>
}
```

**Dependencies:**
- Flag: paramsFlag, scenariosFlag, guidedFlag
- useStreamConnection hook output (indirectly)
- Lib: tryDecodeScenarioParam, getRemember, getLastId, getScenarioById, getSuggestions, createUndoStack
- External: localStorage

---

### C. StreamOutputDisplay (Lines 1575-1623, ~50 LOC)
**Purpose:** Main output/results display with markdown preview and copy code buttons

**Sections to Extract:**
- Lines 1575-1591: Stream output plain text display
- Lines 1593-1618: Markdown preview with copy code buttons
- Lines 1621-1623: ARIA live copy status
- Lines 563-605: useEffect for computing copy button overlay positions
- Lines 607-618: handleCopy function

**Responsibilities:**
- Display raw stream output
- Show markdown preview when enabled
- Calculate and position copy buttons on code blocks
- Handle clipboard operations and feedback
- Manage copy button visibility on resize

**State Managed:**
- copyOverlays: Array<{id, top, left, code, lang}>
- copiedId: number | null
- failedId: number | null
- ariaCopyMsg: string

**Props Interface:**
```typescript
interface StreamOutputDisplayProps {
  // State
  output: string
  status: StreamStatus
  mdHtml: string
  copyOverlays: CopyOverlay[]
  copiedId: number | null
  failedId: number | null
  ariaCopyMsg: string
  reconnecting: boolean
  // Callbacks
  onCopyOverlaysChange: (overlays: CopyOverlay[]) => void
  onCopiedIdChange: (id: number | null) => void
  onFailedIdChange: (id: number | null) => void
  onAriaCopyMsgChange: (msg: string) => void
  onCopy: (id: number, text: string) => Promise<void>
  // Flags
  mdFlag: boolean
  copyFlag: boolean
}
```

**Dependencies:**
- useStreamConnection hook output (status, output)
- Ref: mdPreviewRef (for copy overlay positioning)
- Lib: none

---

### D. StreamControlBar (Lines 729-991, ~260 LOC)
**Purpose:** Action buttons and controls (Start, Stop, Simplify, Parameters inputs, Guided, Shortcuts)

**Sections to Extract:**
- Lines 732-773: Config/Canvas/Scenarios drawer buttons + Health Indicator
- Lines 776-789: Summary V2 chips display
- Lines 823-863: Replay, Engine mode, Health tooltip
- Lines 867-937: Start/Stop buttons, Simplify toggle, List toggle, Params inputs
- Lines 940-991: Guided suggestions and undo
- Lines 1113-1134: Keyboard shortcuts sheet
- Lines 680-728: useEffect for keyboard shortcuts

**Responsibilities:**
- Render Start/Stop buttons
- Handle simplify toggle and keyboard handler (H key)
- Display parameter inputs (Seed, Budget, Model)
- Render guided suggestions with undo
- Show keyboard shortcuts sheet
- Manage all button click handlers
- Show replay button when applicable
- Display engine mode toggle with health tip

**State Managed:**
- sheetOpen: boolean (shortcuts sheet)
- listFirst: boolean
- simplifyOn: boolean
- engineMode: EngineMode
- healthTip: string

**Props Interface:**
```typescript
interface StreamControlBarProps {
  // Stream state
  started: boolean
  status: StreamStatus
  // Parameters
  seed: string
  budget: string
  model: string
  // Callbacks
  onStart: () => void
  onStop: () => void
  onSeedChange: (s: string) => void
  onBudgetChange: (b: string) => void
  onModelChange: (m: string) => void
  onReplay: (args: { seed?: string; budget?: number; model?: string }) => void
  onEngineModeChange: (m: EngineMode) => void
  // Simplify
  simplifyOn: boolean
  onSimplifyChange: (v: boolean) => void
  simplifyFlag: boolean
  T: number
  nHidden: number
  // List view
  listFirst: boolean
  onListFirstChange: (v: boolean) => void
  listViewFlag: boolean
  // Flags
  paramsFlag: boolean
  shortcutsFlag: boolean
  hintsFlag: boolean
  canViewReport: boolean
  replayFlag: boolean
  engineModeFlag: boolean
  mobileGuardFlag: boolean
  readOnlySnap: boolean
  historyFlag: boolean
  configFlag: boolean
  canvasFlag: boolean
  scenariosFlag: boolean
  guidedFlag: boolean
  // Guided
  guidedSuggestions: Suggestion[]
  undoRef: React.MutableRefObject<UndoStack>
  onGuidedApply: (next: SimpleState) => void
  onGuidedUndo: (prev: SimpleState) => void
  ariaGuidedMsg: string
  onAriaGuidedMsgChange: (msg: string) => void
  // Drawer refs
  configBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  canvasBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  scenariosBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  reportBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  // Drawer state
  cfgOpen: boolean
  canvasOpen: boolean
  scenariosOpen: boolean
  reportOpen: boolean
  onCfgOpenChange: (v: boolean) => void
  onCanvasOpenChange: (v: boolean) => void
  onScenariosOpenChange: (v: boolean) => void
  onReportOpenChange: (v: boolean) => void
  // Other
  caps: { warn: boolean; stop: boolean; message: string | null }
  bands: { conservative: number; likely: number; optimistic: number }
  summaryV2Flag: boolean
  cost: number | undefined
}
```

**Dependencies:**
- useStreamConnection hook (status, started)
- Lib: toggleEngineMode, fetchHealth, srSummary, isNarrowViewport

---

### E. StreamDrawersContainer (Lines 1148-1678, ~530 LOC)
**Purpose:** Manage all drawer state and rendering (RunReport, Config, Canvas, Scenario, History)

**Sections to Extract:**
- Lines 1148-1161: ConfigDrawer
- Lines 1163-1171: CanvasDrawer
- Lines 1173-1189: ScenarioDrawer
- Lines 1625-1638: RunReportDrawer
- Lines 1654-1678: RunHistoryDrawer
- Plus associated state for each drawer (lines 277-384)

**Responsibilities:**
- Manage open/close state for all 5 drawers
- Handle drawer callbacks and data passing
- Coordinate between drawers and main state
- Focus management on drawer open/close

**State Managed:**
- reportOpen, historyOpen: boolean
- reportParams: { seed?, budget?, model? } | null
- cfgOpen, canvasOpen, scenariosOpen: boolean
- canvasAPIRef: CanvasAPI | null
- reportBtnRef, historyBtnRef, configBtnRef, canvasBtnRef, scenariosBtnRef
- replayedFrom: string | null
- lastArgsRef: { seed?, budget?, model? } | null

**Props Interface:**
```typescript
interface StreamDrawersContainerProps {
  // Drawer open state
  reportOpen: boolean
  historyOpen: boolean
  cfgOpen: boolean
  canvasOpen: boolean
  scenariosOpen: boolean
  // Callbacks for drawer state
  onReportOpenChange: (v: boolean) => void
  onHistoryOpenChange: (v: boolean) => void
  onCfgOpenChange: (v: boolean) => void
  onCanvasOpenChange: (v: boolean) => void
  onScenariosOpenChange: (v: boolean) => void
  // Button refs
  reportBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  historyBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  configBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  canvasBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  scenariosBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  // Parameters (for report/config/canvas/scenarios)
  seed: string
  budget: string
  model: string
  onSeedChange: (s: string) => void
  onBudgetChange: (b: string) => void
  onModelChange: (m: string) => void
  // Stream state (for history, canvas)
  status: StreamStatus
  output: string
  // Data for drawers
  reportData: ReportData | null
  snapshots: Snapshot[]
  // Canvas API ref
  canvasAPIRef: React.MutableRefObject<CanvasAPI | null>
  // Flags
  reportFlag: boolean
  configFlag: boolean
  canvasFlag: boolean
  scenariosFlag: boolean
  historyFlag: boolean
  paramsFlag: boolean
  // Callbacks (for onRerun, onConfig apply, onScenarioLoad)
  onRerun: (args: { seed?: string; budget?: number; model?: string }) => void
  onConfigApply: (vals: { seed: string; budget: string; model: string }) => void
  onScenarioLoad: (s: { seed: string; budget: string; model: string; name: string }) => void
  // Refs for export/content
  textRef: React.MutableRefObject<string>
  lastArgsRef: React.MutableRefObject<{ seed?: string; budget?: number; model?: string } | null>
  replayedFrom: string | null
  onReplayedFromChange: (v: string | null) => void
}
```

**Dependencies:**
- Components: RunReportDrawer, ConfigDrawer, CanvasDrawer, ScenarioDrawer, RunHistoryDrawer
- Lib: getDefaults, RunMeta type

---

### F. StreamEnhancementsPanel (Lines 1388-1570, ~180 LOC)
**Purpose:** Display enhancements and supplementary panels (diagnostics, perf, scorecard, snapshots, compare, confidence chips)

**Sections to Extract:**
- Lines 1393-1439: Confidence chips display
- Lines 1451-1469: Diagnostics panel
- Lines 1462-1469: Performance metrics panel
- Lines 1471-1476: Scorecard placeholder
- Lines 1478-1535: Snapshots management
- Lines 1538-1570: Compare snapshots
- Lines 1388-1392: Limited tip
- Lines 1639-1652: Error banner

**Responsibilities:**
- Display optional panels based on flags
- Manage snapshot creation and comparison
- Show confidence metrics
- Display diagnostics and perf info
- Handle error banners
- Display cost badge

**State Managed:**
- snapshots: Snapshot[]
- selA, selB: string (for comparison)
- changeLog: diff | null
- compareDiff: diff | null
- shareNote: string
- ariaSnapshotMsg, ariaCompareMsg: string
- readOnlySnap: { seed, model, data } | null

**Props Interface:**
```typescript
interface StreamEnhancementsPanelProps {
  // Stream state
  status: StreamStatus
  output: string
  reportData: ReportData | null
  cost: number | undefined
  // Diagnostics
  diagLastId: string | null
  diagTokenCount: number
  diagTtfbMs: number | null
  diagResumeCount: number
  // Performance
  bufferEnabled: boolean
  mdHtml: string
  copyOverlaysLength: number
  // Graph data
  graph: Graph
  filteredEdges: Edge[]
  // Flags
  hintsFlag: boolean
  chipsFlag: boolean
  diagFlag: boolean
  perfFlag: boolean
  scorecardFlag: boolean
  snapshotsFlag: boolean
  compareFlag: boolean
  errorBannersFlag: boolean
  // Snapshots
  snapshots: Snapshot[]
  readOnlySnap: ReadOnlySnapshot | null
  selA: string
  selB: string
  changeLog: DiffResult | null
  compareDiff: DiffResult | null
  shareNote: string
  ariaSnapshotMsg: string
  ariaCompareMsg: string
  // Callbacks
  onSnapshotsChange: (s: Snapshot[]) => void
  onSelAChange: (id: string) => void
  onSelBChange: (id: string) => void
  onShareNoteChange: (note: string) => void
  onAriaSnapshotMsgChange: (msg: string) => void
  onAriaCompareMsgChange: (msg: string) => void
  onMakeSnapshot: () => void
  // Parameters
  seed: string
  model: string
  paramsFlag: boolean
}
```

**Dependencies:**
- Lib: saveSnapshot, listSnapshots, diffItems, getDefaults, formatUSD, formatDownloadName
- Lib: buildPlainText, buildJson, buildMarkdown, triggerDownload
- Types: Snapshot, RunMeta

---

## Section 2: STATE DEPENDENCIES MAP

### Lifted to Parent (SandboxStreamPanel):
```
Root State:
  - streamState, streamActions (from useStreamConnection hook)
  - All refs: statusRef, mdPreviewRef, listContainerRef, textRef, tokensRef, startedAtRef, costRef, canvasAPIRef, lastArgsRef, undoRef
  
Sub-Component State:
  - Flags (managed by StreamFlagsProvider)
  - Parameters (managed by StreamParametersPanel)
  - Output display (managed by StreamOutputDisplay)
  - Control bar (managed by StreamControlBar)
  - Drawers (managed by StreamDrawersContainer)
  - Enhancements (managed by StreamEnhancementsPanel)
  - Simplify: simplifyFlag, simplifyOn (shared between multiple)
  - List view: listViewFlag, listFirst (shared between multiple)
  - Engine mode: engineModeFlag, engineMode, healthTip
  - Mobile guards: mobileGuardFlag, caps
  - Graph: graph, filteredEdges, nHidden, bands, T (shared)
  - Comments: commentsFlag, commentTarget, commentLabel, commentText, ariaCommentMsg
```

### Derived/Computed State:
```
Should be lifted to parent and memoized:
  - graph = useMemo(() => getSampleGraph(), [])
  - T = computeSimplifyThreshold(...)
  - filteredEdges = useMemo(() => simplifyEdges(...), [graph, simplifyOn, simplifyFlag, T])
  - nHidden = graph.edges.length - filteredEdges.length
  - bands = useMemo(() => bandEdgesByWeight(filteredEdges), [filteredEdges])
  - canViewReport = reportFlag && (status in terminal states)
  - canExport = exportFlag && (status in terminal states)
  - hintTitle = computed based on status and hintsFlag
  - guidedSuggestions = useMemo(...) [in StreamParametersPanel]
  - changeLog = useMemo(...) [in StreamEnhancementsPanel]
  - compareDiff = useMemo(...) [in StreamEnhancementsPanel]
  - caps = useMemo(() => getMobileCaps(...), [mobileGuardFlag, graph.nodes.length])
  - terminalLabel = derived from status
  - width = computed for simplify threshold
```

---

## Section 3: COMPONENT EXTRACTION ORDER (Safest First)

### Phase 1: Foundation (Low Risk - No New Dependencies)
1. **StreamFlagsProvider** (standalone hook for all flags)
   - Self-contained, only reads/writes localStorage and sets state
   - No dependencies on other components
   - Risk: Low

2. **StreamOutputDisplay** (pure display + copy handler)
   - Only consumes output, status, markdown state
   - Self-contained copy logic
   - Risk: Low

### Phase 2: Core Features (Medium Risk - Some Dependencies)
3. **StreamParametersPanel** (params + scenario management)
   - Depends on scenario libraries and guided mode
   - Manages localStorage for params
   - Moderate complexity in URL parsing and scenario import
   - Risk: Medium

4. **StreamEnhancementsPanel** (optional panels)
   - Multiple independent sections (snapshots, compare, chips, etc.)
   - Good candidates for sub-components later
   - Risk: Medium

### Phase 3: Integration (Higher Risk - Many Dependencies)
5. **StreamDrawersContainer** (manages 5 drawers)
   - Coordinates multiple drawer states
   - Depends on external drawer components
   - Handle parameter updates
   - Risk: Medium-High

6. **StreamControlBar** (main controls)
   - Most complex keyboard handling
   - Many button callbacks
   - Guided mode integration
   - Risk: High

### Phase 4: Root Refactoring (Final Assembly)
7. **SandboxStreamPanel** (now ~300 LOC orchestrator)
   - Orchestrates all sub-components
   - Manages lifted state and effects
   - Routes data between components

---

## Section 4: STEP-BY-STEP EXTRACTION INSTRUCTIONS

### STEP 1: Create StreamFlagsProvider.tsx

**File Location:** `/src/components/StreamFlagsProvider.tsx`

```typescript
// Extract lines 46-79 (flag declarations)
// Extract lines 81-111 (flag update effect)
// Extract lines 113-118 (mobile guardrail effect)

// Create hook:
export function useStreamFlags() {
  // All 13 flag states and their setters
  // Return { simplifyFlag, listViewFlag, ... setSimplifyFlag, setListViewFlag, ... }
}

// Create context/provider if needed for performance
export function StreamFlagsProvider({ children }: { children: React.ReactNode }) {
  const flags = useStreamFlags()
  return <StreamFlagsContext.Provider value={flags}>{children}</StreamFlagsContext.Provider>
}
```

**What to extract:**
- Lines 47-79: useState declarations for 13 flags
- Lines 81-111: useEffect for re-evaluation and storage listener
- Lines 113-118: useEffect for mobile guardrails side effect
- Lines 150: Initialize listFirst from mobileGuardFlag and isNarrowViewport
- Lines 151: Initialize caps from mobileGuardFlag

**Testing checklist:**
- localStorage changes trigger flag updates
- Window storage events propagate flag changes
- Initial flag values match existing behavior
- Mobile guardrails flag flip sets listFirst=true on narrow viewport

---

### STEP 2: Create StreamOutputDisplay.tsx

**File Location:** `/src/components/StreamOutputDisplay.tsx`

```typescript
interface StreamOutputDisplayProps {
  output: string
  status: StreamStatus
  mdHtml: string
  copyOverlays: CopyOverlay[]
  copiedId: number | null
  failedId: number | null
  ariaCopyMsg: string
  reconnecting: boolean
  mdFlag: boolean
  copyFlag: boolean
  mdPreviewRef: React.RefObject<HTMLDivElement>
  onCopyOverlaysChange: (overlays: CopyOverlay[]) => void
  onCopiedIdChange: (id: number | null) => void
  onFailedIdChange: (id: number | null) => void
  onAriaCopyMsgChange: (msg: string) => void
}

export default function StreamOutputDisplay(props: StreamOutputDisplayProps) {
  // useEffect lines 564-605: Copy overlay positioning
  // Function lines 607-618: handleCopy
  // JSX lines 1575-1623: Output and preview rendering
}
```

**What to extract:**
- Lines 564-605: useEffect for computing overlay positions
- Lines 607-618: handleCopy function
- Lines 1575-1591: Output display section
- Lines 1593-1618: Markdown preview and copy buttons
- Lines 1621-1623: ARIA copy status

**Testing checklist:**
- Overlay positions calculated correctly on mount
- Copy button functionality works
- Resize handler updates overlays
- Clipboard operations trigger feedback states
- ARIA status updates on copy success/failure

---

### STEP 3: Create StreamParametersPanel.tsx

**File Location:** `/src/components/StreamParametersPanel.tsx`

**What to extract:**
- Lines 407-416: State declarations (seed, budget, model)
- Lines 417-423: persistParams function
- Lines 425-428: guidedSuggestions useMemo
- Lines 431-488: Scenario import and remember-last effects

**Create child component:** ScenarioImportPreview (lines 791-822)

**Testing checklist:**
- Parameters persist to localStorage
- Scenario URL params are decoded correctly
- Remember-last loads previous scenario
- Guided suggestions compute correctly
- Preview dialog shows/hides as expected
- Import/dismiss buttons work correctly

---

### STEP 4: Create StreamEnhancementsPanel.tsx

**File Location:** `/src/components/StreamEnhancementsPanel.tsx`

**Create child components:**
- ConfidenceChips (lines 1393-1439)
- DiagnosticsPanel (lines 1451-1460)
- PerformancePanel (lines 1462-1469)
- ScorecardPanel (lines 1471-1476)
- SnapshotsSection (lines 1478-1535)
- CompareSection (lines 1538-1570)
- ErrorBanner (lines 1639-1652)

**What to extract:**
- All enhancement/supplementary panel logic
- Cost badge display (lines 1441-1449)
- Limited tip (lines 1388-1392)

**Testing checklist:**
- Snapshots create and list correctly
- Comparison diffs compute accurately
- Share link generation works
- Change log displays properly
- Confidence chips show when data available
- Diagnostics panel accurate
- Performance metrics correct
- Error banner shows appropriate advice

---

### STEP 5: Create StreamControlBar.tsx

**File Location:** `/src/components/StreamControlBar.tsx`

**Create child components:**
- KeyboardShortcutsSheet (lines 1113-1134)
- GuidedSuggestionsBar (lines 940-991)
- StreamStatusSection (lines 1191-1237)

**What to extract:**
- Lines 732-773: Drawer buttons + Health indicator
- Lines 776-789: Summary V2 chips
- Lines 823-863: Replay, Engine mode, Health
- Lines 867-937: Start/Stop, Simplify, Params inputs
- Lines 940-991: Guided mode
- Lines 680-728: Keyboard shortcuts useEffect
- Lines 1113-1134: Shortcuts sheet modal
- Lines 1191-1237: Status and metadata chips

**Testing checklist:**
- Start/Stop buttons disable correctly
- Simplify toggle updates state and reflects in output
- Parameter inputs persist to localStorage
- Keyboard shortcuts trigger correctly
- Guided suggestions apply changes
- Undo stack works bidirectionally
- Engine mode toggle and health tooltip display
- Replay button shows/hides as expected

---

### STEP 6: Create StreamDrawersContainer.tsx

**File Location:** `/src/components/StreamDrawersContainer.tsx`

**Create child wrapper components:**
- ReportDrawerWrapper
- ConfigDrawerWrapper
- CanvasDrawerWrapper
- ScenarioDrawerWrapper
- HistoryDrawerWrapper

**What to extract:**
- Lines 277-281: reportOpen, reportParams state + refs
- Lines 282-304: Various flags
- Lines 375-380: Config/Canvas drawer states + refs
- Lines 381-385: Scenario drawer states
- Lines 1148-1161: ConfigDrawer JSX
- Lines 1163-1171: CanvasDrawer JSX
- Lines 1173-1189: ScenarioDrawer JSX
- Lines 1625-1638: RunReportDrawer JSX
- Lines 1654-1678: RunHistoryDrawer JSX

**Testing checklist:**
- Each drawer opens/closes independently
- Focus restoration works on close
- Parameter updates propagate correctly
- History replay reruns with correct params
- Canvas API ref assignment works
- Config apply updates parameters
- Scenario load persists parameters

---

### STEP 7: Refactor SandboxStreamPanel.tsx (Root)

**Final Root Component Structure (~300-350 LOC):**

```typescript
export default function SandboxStreamPanel() {
  // Guard and mount signal (lines 38-44)
  if (!isSseEnabled() && !isE2EEnabled()) return null
  useEffect(() => {
    try { if (isE2EEnabled()) { (window as any).__PANEL_RENDERED = true } } catch {}
  }, [])

  // Canvas-first path (lines 174-275) - keep as-is for now or extract to CanvasFirstPath
  
  // Flags
  const flags = useStreamFlags()
  
  // Stream connection
  const streamConfig: StreamConfig = { ... }
  const { state: streamState, actions: streamActions } = useStreamConnection(streamConfig)
  
  // Graph and simplify
  const graph = useMemo(() => getSampleGraph(), [])
  const width = computeWidth()
  const T = computeSimplifyThreshold({ nodeCount: graph.nodes.length, width, defaultT: 0.3 })
  const [simplifyOn, setSimplifyOn] = useState(false)
  const filteredEdges = useMemo(() => simplifyEdges(...), [graph, simplifyOn, flags.simplifyFlag, T])
  const nHidden = graph.edges.length - filteredEdges.length
  const bands = useMemo(() => bandEdgesByWeight(filteredEdges), [filteredEdges])
  
  // Simplify keyboard shortcut (H key)
  useEffect(() => { ... }, [flags.simplifyFlag])
  
  // Refs
  const refs = {
    status: useRef(null),
    mdPreview: useRef(null),
    listContainer: useRef(null),
    text: useRef(''),
    tokens: useRef([]),
    startedAt: useRef(null),
    cost: useRef(undefined),
    canvas: useRef(null),
    lastArgs: useRef(null),
    undo: useRef(createUndoStack()),
  }
  
  // Syncs for export (lines 352-405)
  useEffect(() => { textRef.current = streamState.output }, [streamState.output])
  useEffect(() => { /* tokens sync */ }, [streamState.output, streamState.status])
  useEffect(() => { /* start time */ }, [streamState.started])
  useEffect(() => { /* cost */ }, [streamState.cost])
  
  // Output display state
  const [copyOverlays, setCopyOverlays] = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [failedId, setFailedId] = useState(null)
  const [ariaCopyMsg, setAriaCopyMsg] = useState('')
  const [mdHtml, setMdHtml] = useState('')
  
  // Control bar state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [simplifyOn, setSimplifyOn] = useState(false)
  const [engineMode, setEngineMode] = useState(() => getDefaultEngineMode())
  const [healthTip, setHealthTip] = useState('')
  const [listFirst, setListFirst] = useState(() => flags.mobileGuardFlag && isNarrowViewport())
  
  // Parameters state
  const [seed, setSeed] = useState(() => localStorage.getItem('sandbox.seed') || '')
  const [budget, setBudget] = useState(() => localStorage.getItem('sandbox.budget') || '')
  const [model, setModel] = useState(() => localStorage.getItem('sandbox.model') || '')
  const [scenarioPreview, setScenarioPreview] = useState(null)
  const [scenarioImportNote, setScenarioImportNote] = useState(false)
  const [scenarioChipText, setScenarioChipText] = useState(null)
  
  // Drawers state
  const [reportOpen, setReportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportParams, setReportParams] = useState(null)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [scenariosOpen, setScenariosOpen] = useState(false)
  const [replayedFrom, setReplayedFrom] = useState(null)
  
  // Enhancements state
  const [snapshots, setSnapshots] = useState(() => flags.snapshotsFlag ? listSnapshots() : [])
  const [readOnlySnap, setReadOnlySnap] = useState(null)
  const [selA, setSelA] = useState('')
  const [selB, setSelB] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [ariaSnapshotMsg, setAriaSnapshotMsg] = useState('')
  const [ariaCompareMsg, setAriaCompareMsg] = useState('')
  const [commentTarget, setCommentTarget] = useState(null)
  const [commentLabel, setCommentLabel] = useState('Challenge')
  const [commentText, setCommentText] = useState('')
  const [ariaCommentMsg, setAriaCommentMsg] = useState('')
  
  // Effects for scenarios/snapshots/URL params (keep most as-is)
  // ... (lines 431-551 largely unchanged)
  
  // Derived values
  const caps = useMemo(() => flags.mobileGuardFlag ? getMobileCaps(...) : {...}, [...])
  const canViewReport = flags.reportFlag && isTerminalStatus(streamState.status)
  const canExport = flags.exportFlag && isTerminalStatus(streamState.status)
  const hintTitle = computeHintTitle(...)
  const changeLog = useMemo(() => { ... }, [flags.snapshotsFlag, snapshots])
  const compareDiff = useMemo(() => { ... }, [flags.compareFlag, snapshots, selA, selB])
  
  // Functions
  const persistParams = (s, b, m) => { ... }
  const begin = (over?) => { ... }
  const stop = () => { ... }
  const handleCopy = async (id, text) => { ... }
  const makeSnapshot = () => { ... }
  const onListKeyDown = (e) => { ... }
  
  // Render
  return (
    <div className="p-3 rounded-md border border-gray-200 bg-white text-sm" data-testid="panel-root">
      <StreamControlBar
        started={streamState.started}
        status={streamState.status}
        seed={seed}
        budget={budget}
        model={model}
        onStart={() => begin()}
        onStop={() => stop()}
        onSeedChange={(s) => { setSeed(s); persistParams(s, budget, model) }}
        onBudgetChange={(b) => { setBudget(b); persistParams(seed, b, model) }}
        onModelChange={(m) => { setModel(m); persistParams(seed, budget, m) }}
        // ... all other props
      />
      
      <StreamOutputDisplay
        output={streamState.output}
        status={streamState.status}
        mdHtml={mdHtml}
        copyOverlays={copyOverlays}
        copiedId={copiedId}
        failedId={failedId}
        ariaCopyMsg={ariaCopyMsg}
        reconnecting={streamState.reconnecting}
        mdFlag={flags.mdFlag}
        copyFlag={flags.copyFlag}
        mdPreviewRef={refs.mdPreview}
        onCopyOverlaysChange={setCopyOverlays}
        onCopiedIdChange={setCopiedId}
        onFailedIdChange={setFailedId}
        onAriaCopyMsgChange={setAriaCopyMsg}
        onCopy={handleCopy}
      />
      
      {flags.listViewFlag && <ListViewSection ... />}
      {flags.commentsFlag && commentTarget && <CommentsPanel ... />}
      
      <StreamEnhancementsPanel
        status={streamState.status}
        output={streamState.output}
        reportData={streamState.reportData}
        cost={streamState.metrics.cost}
        diagLastId={streamState.metrics.lastSseId}
        diagTokenCount={streamState.metrics.tokenCount}
        diagTtfbMs={streamState.metrics.ttfbMs}
        diagResumeCount={streamState.metrics.resumeCount}
        // ... all other props
      />
      
      <StreamDrawersContainer
        reportOpen={reportOpen}
        historyOpen={historyOpen}
        cfgOpen={cfgOpen}
        canvasOpen={canvasOpen}
        scenariosOpen={scenariosOpen}
        onReportOpenChange={setReportOpen}
        onHistoryOpenChange={setHistoryOpen}
        onCfgOpenChange={setCfgOpen}
        onCanvasOpenChange={setCanvasOpen}
        onScenariosOpenChange={setScenariosOpen}
        // ... all other props
      />
    </div>
  )
}
```

**Testing checklist:**
- All state still flows correctly
- All props passed to sub-components
- No data is lost in passing
- Refs still work correctly
- Keyboard shortcuts work
- All drawers still open/close
- Snapshots still work
- Parameters still persist
- Export still works

---

## Section 5: PROPS INTERFACES (Complete)

### All Props Interfaces with Full Types

[See individual component sections above for detailed interfaces]

---

## Section 6: MIGRATION CHECKLIST

### Phase 1: Create New Components (No Changes to Root)
- [ ] StreamFlagsProvider.tsx created and tested
- [ ] StreamOutputDisplay.tsx created and tested
- [ ] StreamParametersPanel.tsx created and tested
- [ ] StreamEnhancementsPanel.tsx created and tested
- [ ] StreamDrawersContainer.tsx created and tested
- [ ] StreamControlBar.tsx created and tested

### Phase 2: Integrate Components
- [ ] Import all new components in SandboxStreamPanel.tsx
- [ ] Move state to root component
- [ ] Pass props to each sub-component
- [ ] Test each integration point

### Phase 3: Verify Behavior
- [ ] All keyboard shortcuts work
- [ ] All drawers open/close correctly
- [ ] Parameters persist and load
- [ ] Export functions work
- [ ] Snapshots create and compare
- [ ] Copy code buttons work
- [ ] Mobile guards work
- [ ] Guided mode works
- [ ] All flags update correctly

### Phase 4: Final Cleanup
- [ ] Remove unused state from root
- [ ] Optimize memoization
- [ ] Update test files
- [ ] Document component APIs
- [ ] Verify bundle size reduction

---

## Section 7: RISK MITIGATION

### High-Risk Areas:
1. **Keyboard shortcuts** (lines 680-728)
   - Many nested conditions
   - Dependencies on multiple state variables
   - Mitigation: Test extensively, create unit test file

2. **Parameter persistence** (lines 417-423)
   - localStorage access
   - Called from multiple places
   - Mitigation: Centralize in StreamParametersPanel, test all paths

3. **Snapshot/Compare logic** (lines 528-545)
   - Complex memoization with multiple deps
   - Mitigation: Keep as is, test comparisons thoroughly

4. **Drawer coordination** (5 drawers)
   - Multiple interdependencies
   - Mitigation: Create wrapper, test each drawer independently first

### Testing Strategy:
1. Unit tests for each extracted component
2. Integration tests for state flow
3. E2E tests for keyboard shortcuts
4. Snapshot tests for UI output
5. Regression tests against existing behavior

---

## Section 8: ESTIMATED LOC BREAKDOWN

### Current (1682 LOC):
- Imports & setup: 36 LOC
- Flags: 66 LOC
- Parameters: 82 LOC
- Simplify/Graph: 130 LOC
- Refs/Syncs: 60 LOC
- Stream connection: 10 LOC
- Drawers state: 100 LOC
- Output/Copy: 50 LOC
- Control bar: 260 LOC
- Effects & handlers: 100 LOC
- Enhancements: 180 LOC
- JSX render: 800 LOC

### After Refactoring:
- SandboxStreamPanel.tsx: 320 LOC
  - Imports: 40 LOC
  - State declarations: 50 LOC
  - Effects (syncs, URL parsing): 80 LOC
  - Derived values: 30 LOC
  - Functions (begin, stop, etc): 30 LOC
  - JSX render: 90 LOC

- StreamFlagsProvider.tsx: 70 LOC
- StreamOutputDisplay.tsx: 100 LOC
- StreamParametersPanel.tsx: 130 LOC
- StreamControlBar.tsx: 280 LOC
- StreamDrawersContainer.tsx: 200 LOC
- StreamEnhancementsPanel.tsx: 220 LOC

**Total: 1320 LOC (but much better organized and maintainable)**

---

## Summary

This refactoring will:
1. Reduce SandboxStreamPanel from 1682 to ~320 LOC
2. Split concerns into 6 focused components
3. Maintain 100% behavioral compatibility
4. Improve testability and maintainability
5. Make future feature additions easier
6. Reduce cognitive load for developers
7. Enable parallel development on different features

The extraction order ensures low-risk changes first, building confidence through integration testing before tackling higher-risk sections like keyboard shortcuts and drawer coordination.
