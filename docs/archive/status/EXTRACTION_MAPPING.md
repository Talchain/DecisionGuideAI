# SandboxStreamPanel.tsx - Detailed Line-by-Line Extraction Mapping

## Import Statements Analysis

### Original Imports (Lines 1-35)

```typescript
// KEEP in root (lines 1-9, 14, 24)
import { useEffect, useRef, useState, useMemo } from 'react'
import * as Flags from '../flags'
import { isJobsProgressEnabled } from '../flags'
import { useStreamConnection, type StreamConfig } from '../streams/useStreamConnection'
import { getSampleGraph } from '../lib/graph.sample'
import { bandEdgesByWeight } from '../lib/summary'
import { getDefaultEngineMode, toggleEngineMode, type EngineMode } from '../lib/engine.adapter'
import { simplifyEdges, srSummary, computeSimplifyThreshold } from '../lib/graph.simplify'
import { fetchHealth } from '../lib/health'
import { mapErrorTypeToAdvice } from '../lib/errors'
import { list as listSnapshots, save as saveSnapshot, type Snapshot } from '../lib/snapshots'
import { diff as diffItems } from '../lib/compare'
import { getDefaults } from '../lib/session'

// MOVE to StreamFlagsProvider.tsx (lines 2-3, 4-8)
import { isSseEnabled, isRunReportEnabled, isConfidenceChipsEnabled, isHintsEnabled, isParamsEnabled, isHistoryEnabled, isExportEnabled, isScenariosEnabled } from '../flags'
import { isMarkdownPreviewEnabled, isShortcutsEnabled, isCopyCodeEnabled } from '../flags'
import { isE2EEnabled } from '../flags'
import { isConfigDrawerEnabled } from '../flags'
import { isCanvasEnabled } from '../flags'

// MOVE to StreamOutputDisplay.tsx
// (no new imports needed, uses parent props)

// MOVE to StreamParametersPanel.tsx (lines 32)
import { tryDecodeScenarioParam, getRemember, getLastId, getScenarioById } from '../lib/scenarios'
import { getSuggestions, createUndoStack, type SimpleState } from '../lib/guided'

// MOVE to StreamControlBar.tsx (lines 17-23)
import RunReportDrawer from './RunReportDrawer'
import ConfigDrawer from './ConfigDrawer'
import CanvasDrawer from './CanvasDrawer'
import type { CanvasAPI } from './CanvasDrawer'
import ScenarioDrawer from './ScenarioDrawer'
import HealthIndicator from './HealthIndicator'
import JobsProgressPanel from './JobsProgressPanel'

// MOVE to StreamEnhancementsPanel.tsx
import RunHistoryDrawer from './RunHistoryDrawer'
import { formatUSD } from '../lib/currency'
import { encodeSnapshotToUrlParam, tryDecodeSnapshotParam } from '../lib/snapshotShare'
import { byTarget as listCommentsByTarget, add as addComment, del as delComment, type Comment } from '../lib/comments'

// MOVE to StreamDrawersContainer.tsx
import { buildPlainText, buildJson, buildMarkdown, buildMarkdownFilename, triggerDownload, type TokenRec as ExportTokenRec } from '../lib/export'
import { formatDownloadName } from '../lib/filename'
```

---

## Section Extraction Mapping

### Lines 37-44: Guard & Mount Signal
**ACTION:** Keep in root
```typescript
export default function SandboxStreamPanel() {
  // Flag-gated: OFF by default. In E2E test-mode, always mount for determinism.
  if (!isSseEnabled() && !isE2EEnabled()) return null

  // Signal to E2E tests that the panel has mounted
  useEffect(() => {
    try { if (isE2EEnabled()) { (window as any).__PANEL_RENDERED = true } } catch {}
  }, [])
```

---

### Lines 46-79: Flag Declarations
**ACTION:** MOVE to StreamFlagsProvider.tsx as state declarations
**Component:** StreamFlagsProvider

```typescript
// In StreamFlagsProvider.tsx:
export function useStreamFlags() {
  const [simplifyFlag, setSimplifyFlag] = useState<boolean>(() => { ... })
  const [listViewFlag, setListViewFlag] = useState<boolean>(() => { ... })
  const [engineModeFlag, setEngineModeFlag] = useState<boolean>(() => { ... })
  const [mobileGuardFlag, setMobileGuardFlag] = useState<boolean>(() => { ... })
  const [summaryV2Flag, setSummaryV2Flag] = useState<boolean>(() => { ... })
  const [guidedFlag, setGuidedFlag] = useState<boolean>(() => { ... })
  const [commentsFlag, setCommentsFlag] = useState<boolean>(() => { ... })
  const [diagFlag, setDiagFlag] = useState<boolean>(() => { ... })
  const [perfFlag, setPerfFlag] = useState<boolean>(() => { ... })
  const [scorecardFlag, setScorecardFlag] = useState<boolean>(() => { ... })
  const [errorBannersFlag, setErrorBannersFlag] = useState<boolean>(() => { ... })
  // Plus snapshotsFlag, compareFlag (also initialized at lines 491-496)
  
  return {
    simplifyFlag, setSimplifyFlag,
    listViewFlag, setListViewFlag,
    engineModeFlag, setEngineModeFlag,
    mobileGuardFlag, setMobileGuardFlag,
    summaryV2Flag, setSummaryV2Flag,
    guidedFlag, setGuidedFlag,
    commentsFlag, setCommentsFlag,
    diagFlag, setDiagFlag,
    perfFlag, setPerfFlag,
    scorecardFlag, setScorecardFlag,
    errorBannersFlag, setErrorBannersFlag,
    snapshotsFlag, setSnapshotsFlag,
    compareFlag, setCompareFlag,
  }
}
```

---

### Lines 81-111: Flag Update Effect
**ACTION:** MOVE to StreamFlagsProvider.tsx
**Component:** StreamFlagsProvider

```typescript
// In StreamFlagsProvider.tsx - inside useStreamFlags hook
useEffect(() => {
  // Re-evaluate flags after mount and whenever localStorage changes
  const update = () => {
    try { const fn: any = (Flags as any).isCanvasSimplifyEnabled; setSimplifyFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isListViewEnabled; setListViewFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isEngineModeEnabled; setEngineModeFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isMobileGuardrailsEnabled; setMobileGuardFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isSnapshotsEnabled; setSnapshotsFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isCompareEnabled; setCompareFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isSummaryV2Enabled; setSummaryV2Flag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isGuidedV1Enabled; setGuidedFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isCommentsEnabled; setCommentsFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isDiagnosticsEnabled; setDiagFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isPerfProbesEnabled; setPerfFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isScorecardEnabled; setScorecardFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    try { const fn: any = (Flags as any).isErrorBannersEnabled; setErrorBannersFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
  }
  update()
  const t1 = setTimeout(update, 50)
  const t2 = setTimeout(update, 200)
  const t3 = setTimeout(update, 500)
  const iv = setInterval(update, 250)
  const tStop = setTimeout(() => clearInterval(iv), 2000)
  const onStorage = (e: StorageEvent) => {
    if (!e || typeof e.key !== 'string') { update(); return }
    if (e.key.startsWith('feature.')) update()
  }
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener('storage', onStorage); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(tStop); clearInterval(iv) }
}, [])
```

---

### Lines 113-118: Mobile Guardrails Effect
**ACTION:** MOVE to StreamFlagsProvider.tsx
**Component:** StreamFlagsProvider

```typescript
// In StreamFlagsProvider.tsx - separate effect or combined with above
useEffect(() => {
  if (mobileGuardFlag && isNarrowViewport()) {
    setListFirst(true)
  }
}, [mobileGuardFlag])
```

---

### Line 120: Graph Creation
**ACTION:** KEEP in root
```typescript
const graph = useMemo(() => getSampleGraph(), [])
```

---

### Lines 121-127: Simplify Computation
**ACTION:** KEEP in root (computed/derived state)
```typescript
const [simplifyOn, setSimplifyOn] = useState<boolean>(false)
// Compute dynamic simplify threshold per PRD rules
const width = (() => { try { return (globalThis as any)?.innerWidth || 1024 } catch { return 1024 } })()
const T = computeSimplifyThreshold({ nodeCount: graph.nodes.length, width, defaultT: 0.3 })
const filteredEdges = useMemo(() => simplifyEdges(graph.edges, simplifyOn && simplifyFlag, T), [graph, simplifyOn, simplifyFlag, T])
const nHidden = graph.edges.length - filteredEdges.length
const bands = useMemo(() => bandEdgesByWeight(filteredEdges as any), [filteredEdges])
```

---

### Lines 129-139: Simplify Keyboard Handler (H key)
**ACTION:** KEEP in root
**Why:** Critical for simplify toggle functionality, needs simplifyFlag dependency

```typescript
useEffect(() => {
  if (!simplifyFlag) return
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      setSimplifyOn((v) => !v)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [simplifyFlag])
```

---

### Lines 141-151: Engine Mode & Mobile Caps
**ACTION:** KEEP in root (state initialization for control bar)
```typescript
const [engineMode, setEngineMode] = useState<EngineMode>(() => getDefaultEngineMode())
const [healthTip, setHealthTip] = useState<string>('')
const undoRef = useRef(createUndoStack<SimpleState>())
const [commentTarget, setCommentTarget] = useState<string | null>(null)
const [commentLabel, setCommentLabel] = useState<'Challenge' | 'Evidence'>('Challenge')
const [commentText, setCommentText] = useState<string>('')
const [ariaCommentMsg, setAriaCommentMsg] = useState<string>('')
const [ariaGuidedMsg, setAriaGuidedMsg] = useState<string>('')

const [listFirst, setListFirst] = useState<boolean>(() => mobileGuardFlag && isNarrowViewport())
const caps = useMemo(() => mobileGuardFlag ? getMobileCaps(graph.nodes.length) : { warn: false, stop: false, message: null as string | null }, [mobileGuardFlag, graph.nodes.length])
```

---

### Lines 152-170: List View Keyboard Navigation
**ACTION:** KEEP in root or move with ListViewSection
```typescript
const listContainerRef = useRef<HTMLDivElement | null>(null)
const onListKeyDown = (e: React.KeyboardEvent) => {
  const key = e.key
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    e.preventDefault()
    const items = listContainerRef.current?.querySelectorAll<HTMLElement>('[data-testid^="list-node-"], [data-testid^="list-edge-"]')
    if (!items || items.length === 0) return
    const arr = Array.from(items)
    const idx = arr.indexOf(document.activeElement as HTMLElement)
    const next = key === 'ArrowDown' ? Math.min(arr.length - 1, (idx < 0 ? 0 : idx + 1)) : Math.max(0, (idx < 0 ? 0 : idx - 1))
    arr[next]?.focus()
  } else if (key === 'Enter') {
    const el = document.activeElement as HTMLElement | null
    el?.focus()
  } else if ((e.shiftKey && (key === '?' || key === '/'))) {
    try { alert('Keys: Arrow to move, Enter to focus') } catch {}
  }
}
```

---

### Lines 174-275: Canvas-First Shell
**ACTION:** EXTRACT to separate CanvasFirstPath.tsx (optional optimization)
**Or KEEP in root if rarely used**

**For this refactoring:** Keep in root - entire alternate path

---

### Lines 277-281: Drawer Open/Ref State
**ACTION:** MOVE to StreamDrawersContainer.tsx
```typescript
const [reportOpen, setReportOpen] = useState(false)
const [historyOpen, setHistoryOpen] = useState(false)
const [reportParams, setReportParams] = useState<{ seed?: string | number; budget?: number; model?: string } | null>(null)
const reportBtnRef = useRef<HTMLButtonElement | null>(null)
const historyBtnRef = useRef<HTMLButtonElement | null>(null)
```

---

### Lines 282-304: Replay & Flags
**ACTION:** SPLIT
- replayFlag, lastArgsRef, replayedFrom → StreamDrawersContainer.tsx
- reportFlag, chipsFlag, hintsFlag, paramsFlag, historyFlag, exportFlag → Keep in root (used by multiple)
- mdFlag, shortcutsFlag, copyFlag, scenariosFlag → Keep in root (used by multiple)

```typescript
// MOVE to StreamDrawersContainer.tsx
const replayFlag: boolean = (() => {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_REPLAY
    if (env === '1' || env === 1 || env === true) return true
  } catch {}
  try {
    const raw = (globalThis as any)?.localStorage?.getItem?.('feature.replay')
    if (raw && raw !== '0' && raw !== 'false') return true
  } catch {}
  return false
})()
const lastArgsRef = useRef<{ seed?: string | number; budget?: number; model?: string } | null>(null)
const [replayedFrom, setReplayedFrom] = useState<string | null>(null)

// KEEP in root (gates multiple features)
const reportFlag = isRunReportEnabled()
const chipsFlag = isConfidenceChipsEnabled()
const hintsFlag = isHintsEnabled()
const paramsFlag = isParamsEnabled()
const historyFlag = isHistoryEnabled()
const exportFlag = isExportEnabled()
const mdFlag = isMarkdownPreviewEnabled()
const shortcutsFlag = isShortcutsEnabled()
const copyFlag = isCopyCodeEnabled()
const scenariosFlag = isScenariosEnabled()
```

---

### Lines 306-321: Stream Buffer Flag
**ACTION:** KEEP in root (used for useStreamConnection config)
```typescript
const bufferEnabled: boolean = (() => {
  try {
    const env = (import.meta as any)?.env?.VITE_STREAM_BUFFER
    if (env === '0' || env === 0 || env === false) return false
    if (env === '1' || env === 1 || env === true) return true
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.streamBuffer')
      if (raw === '0' || raw === 'false') return false
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch {}
  return true // default ON
})()
```

---

### Lines 323-324: Output State
**ACTION:** MOVE to StreamOutputDisplay.tsx
```typescript
const [mdHtml, setMdHtml] = useState<string>('')
```

---

### Lines 326-337: Stream Config & Hook
**ACTION:** KEEP in root
```typescript
const streamConfig: StreamConfig = {
  historyEnabled: historyFlag,
  chipsEnabled: chipsFlag,
  paramsEnabled: paramsFlag,
  mdEnabled: mdFlag,
  bufferEnabled,
  route: 'critique',
  onMdUpdate: setMdHtml,
  statusRef,
}
const { state: streamState, actions: streamActions } = useStreamConnection(streamConfig)
```

---

### Lines 339-350: Stream State Aliases
**ACTION:** KEEP in root (used throughout)
```typescript
const status = streamState.status
const output = streamState.output
const cost = streamState.metrics.cost
const reconnecting = streamState.reconnecting
const resumedOnce = streamState.resumedOnce
const started = streamState.started
const reportData = streamState.reportData
const diagLastId = streamState.metrics.lastSseId
const diagTokenCount = streamState.metrics.tokenCount
const diagTtfbMs = streamState.metrics.ttfbMs
const diagResumeCount = streamState.metrics.resumeCount
```

---

### Lines 352-405: Refs & Syncs
**ACTION:** KEEP in root
```typescript
const tokensRef = useRef<ExportTokenRec[]>([])
const textRef = useRef<string>('')
const startedAtRef = useRef<number | null>(null)
const costRef = useRef<number | undefined>(undefined)
const statusRef = useRef<HTMLDivElement | null>(null)
const mdPreviewRef = useRef<HTMLDivElement | null>(null)

// Effects for syncing
useEffect(() => { textRef.current = output }, [output])
useEffect(() => { /* tokens sync */ }, [output, status])
useEffect(() => { /* start time */ }, [started])
useEffect(() => { /* cost */ }, [cost])
```

---

### Lines 407-416: Parameter State
**ACTION:** MOVE to StreamParametersPanel.tsx
```typescript
const [seed, setSeed] = useState<string>(() => {
  try { return window.localStorage.getItem('sandbox.seed') || '' } catch { return '' }
})
const [budget, setBudget] = useState<string>(() => {
  try { return window.localStorage.getItem('sandbox.budget') || '' } catch { return '' }
})
const [model, setModel] = useState<string>(() => {
  try { return window.localStorage.getItem('sandbox.model') || '' } catch { return '' }
})
```

---

### Lines 417-423: Persist Parameters
**ACTION:** MOVE to StreamParametersPanel.tsx
```typescript
const persistParams = (s: string, b: string, m: string) => {
  try {
    window.localStorage.setItem('sandbox.seed', s)
    window.localStorage.setItem('sandbox.budget', b)
    window.localStorage.setItem('sandbox.model', m)
  } catch {}
}
```

---

### Lines 425-428: Guided Suggestions
**ACTION:** MOVE to StreamParametersPanel.tsx
```typescript
const guidedSuggestions = useMemo(() => (
  guidedFlag ? getSuggestions({ seed, budget, model, simplify: simplifyOn }) : []
), [guidedFlag, seed, budget, model, simplifyOn])
```

---

### Lines 431-488: Scenario Import & Remember-Last Effects
**ACTION:** MOVE to StreamParametersPanel.tsx
```typescript
// Scenario import via URL (?scenario=...), flag-gated
useEffect(() => { /* lines 432-468 */ }, [])

// Remember-last: on mount, if enabled and we have a lastId, hydrate params
useEffect(() => { /* lines 473-488 */ }, [])
```

---

### Lines 491-496: Snapshots & Compare Flags
**ACTION:** MOVE to StreamEnhancementsPanel.tsx OR keep as local state initialization
```typescript
const [snapshotsFlag, setSnapshotsFlag] = useState<boolean>(() => {
  try { const fn: any = (Flags as any).isSnapshotsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
})
const [compareFlag, setCompareFlag] = useState<boolean>(() => {
  try { const fn: any = (Flags as any).isCompareEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
})
```

---

### Lines 498-535: Snapshots State & Effects
**ACTION:** MOVE to StreamEnhancementsPanel.tsx
```typescript
const [snapshots, setSnapshots] = useState<Snapshot[]>(() => (snapshotsFlag ? listSnapshots() : []))
const [ariaSnapshotMsg, setAriaSnapshotMsg] = useState<string>('')
const [readOnlySnap, setReadOnlySnap] = useState<{ seed: string; model: string; data: any } | null>(null)
const [selA, setSelA] = useState<string>('')
const [selB, setSelB] = useState<string>('')
const [ariaCompareMsg, setAriaCompareMsg] = useState<string>('')
const [shareNote, setShareNote] = useState<string>('')

// Parse read-only snapshot from URL (?snap=...)
useEffect(() => { /* lines 507-520 */ }, [])

// Refresh stored snapshots on mount if feature enabled
useEffect(() => { /* lines 523-526 */ }, [snapshotsFlag])

const changeLog = useMemo(() => { /* lines 528-535 */ }, [snapshotsFlag, snapshots])
const compareDiff = useMemo(() => { /* lines 537-545 */ }, [compareFlag, snapshots, selA, selB])

useEffect(() => { /* lines 547-551 */ }, [compareDiff])
```

---

### Lines 553-561: Make Snapshot
**ACTION:** MOVE to StreamEnhancementsPanel.tsx
```typescript
const makeSnapshot = () => {
  if (!snapshotsFlag) return
  const id = String(Date.now())
  const s: Snapshot = { id, at: new Date().toISOString(), seed, model, data: { nodes: graph.nodes, edges: filteredEdges.map((e) => ({ ...e })) } as any }
  try { saveSnapshot(s) } catch {}
  try { setSnapshots(listSnapshots()) } catch {}
  setAriaSnapshotMsg(`Snapshot captured at ${new Date().toLocaleTimeString('en-GB')}`)
  setTimeout(() => setAriaSnapshotMsg(''), 1200)
}
```

---

### Lines 564-605: Copy Overlays Effect
**ACTION:** MOVE to StreamOutputDisplay.tsx
```typescript
useEffect(() => {
  if (!mdFlag || !copyFlag) { setCopyOverlays([]); return }
  // Entire effect block for computing overlay positions
  const container = mdPreviewRef.current
  if (!container) { setCopyOverlays([]); return }
  // ... overlay positioning logic ...
}, [mdHtml, mdFlag, copyFlag])
```

---

### Lines 607-618: Handle Copy
**ACTION:** MOVE to StreamOutputDisplay.tsx
```typescript
const handleCopy = async (id: number, text: string) => {
  try {
    await (globalThis as any)?.navigator?.clipboard?.writeText?.(text)
    setCopiedId(id)
    setAriaCopyMsg('Copied')
    setTimeout(() => { setCopiedId(null); setAriaCopyMsg('') }, 1200)
  } catch {
    setFailedId(id)
    setAriaCopyMsg('Copy failed')
    setTimeout(() => { setFailedId(null); setAriaCopyMsg('') }, 1200)
  }
}
```

---

### Lines 620-656: Begin & Stop Functions
**ACTION:** KEEP in root (orchestrates stream)
```typescript
const begin = (over?: { seed?: string | number; budget?: number; model?: string }) => {
  // Full function logic - lines 620-650
}

const stop = () => {
  if (!started) return
  streamActions.stop()
}
```

---

### Lines 658-677: Terminal Label & Derived Values
**ACTION:** KEEP in root
```typescript
const terminalLabel = // ... lines 658-664
const canViewReport = reportFlag && (status === 'done' || status === 'aborted' || status === 'error' || status === 'limited')
const canExport = exportFlag && (status === 'done' || status === 'aborted' || status === 'error' || status === 'limited')
const hintTitle = // ... lines 670-677
```

---

### Lines 680-728: Keyboard Shortcuts Effect
**ACTION:** MOVE to StreamControlBar.tsx
```typescript
useEffect(() => {
  if (!shortcutsFlag) return
  const onKey = (e: KeyboardEvent) => {
    // All keyboard shortcut logic - lines 682-725
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [shortcutsFlag, started, canViewReport, historyFlag, historyOpen, seed, budget, model, paramsFlag, sheetOpen])
```

---

### Lines 730-1680: JSX Render
**ACTION:** REFACTOR into component composition

**Current structure:**
- Lines 730-773: Drawer buttons + Health Indicator
- Lines 776-789: Summary V2 chips
- Lines 791-822: Scenario import preview
- Lines 823-863: Replay, Engine mode
- Lines 867-937: Start/Stop, Simplify, Params inputs
- Lines 940-991: Guided suggestions
- Lines 993-1106: List view section
- Lines 1109-1111: Simplify indicator
- Lines 1113-1134: Keyboard shortcuts sheet
- Lines 1136-1140: Jobs progress
- Lines 1142-1146: Resume note
- Lines 1148-1161: ConfigDrawer
- Lines 1163-1171: CanvasDrawer
- Lines 1173-1189: ScenarioDrawer
- Lines 1191-1237: Status & metadata chips
- Lines 1238-1282: Report button + Send to Canvas
- Lines 1283-1296: History button
- Lines 1298-1386: Export buttons
- Lines 1388-1570: Enhancements (chips, diagnostics, perf, snapshots, compare)
- Lines 1575-1591: Output display
- Lines 1593-1618: Markdown preview + copy buttons
- Lines 1625-1638: RunReportDrawer
- Lines 1639-1652: Error banner
- Lines 1654-1678: RunHistoryDrawer

**Refactored structure:**
- StreamControlBar (lines 732-991, 1113-1134, 1191-1237)
- StreamOutputDisplay (lines 1575-1623)
- StreamEnhancementsPanel (lines 1388-1570)
- StreamDrawersContainer (lines 1148-1189, 1625-1678)
- ListViewSection (inline, lines 993-1106)
- CommentsPanel (inline with ListViewSection)
- ErrorBanner (lines 1639-1652, part of Enhancements)

---

## State Initialization Summary

### Root Component State (After Refactoring)

```typescript
// From hooks
const flags = useStreamFlags()
const { state: streamState, actions: streamActions } = useStreamConnection(...)

// Graph & compute
const graph = useMemo(() => getSampleGraph(), [])
const width = computeWidth()
const T = computeSimplifyThreshold(...)
const [simplifyOn, setSimplifyOn] = useState(false)
const filteredEdges = useMemo(...)
const nHidden = ...
const bands = useMemo(...)

// Feature flags
const reportFlag = isRunReportEnabled()
const chipsFlag = isConfidenceChipsEnabled()
// ... 8 more flags ...

// Refs
const statusRef = useRef(null)
const textRef = useRef('')
const tokensRef = useRef([])
const mdPreviewRef = useRef(null)
const listContainerRef = useRef(null)
const canvasAPIRef = useRef(null)
const startedAtRef = useRef(null)
const costRef = useRef(undefined)
const lastArgsRef = useRef(null)
const undoRef = useRef(createUndoStack())

// Control bar state
const [engineMode, setEngineMode] = useState(...)
const [healthTip, setHealthTip] = useState('')
const [listFirst, setListFirst] = useState(...)

// Comments
const [commentTarget, setCommentTarget] = useState(null)
const [commentLabel, setCommentLabel] = useState('Challenge')
const [commentText, setCommentText] = useState('')
const [ariaCommentMsg, setAriaCommentMsg] = useState('')

// Output display state
const [mdHtml, setMdHtml] = useState('')
const [copyOverlays, setCopyOverlays] = useState([])
const [copiedId, setCopiedId] = useState(null)
const [failedId, setFailedId] = useState(null)
const [ariaCopyMsg, setAriaCopyMsg] = useState('')

// Drawer state
const [reportOpen, setReportOpen] = useState(false)
const [historyOpen, setHistoryOpen] = useState(false)
const [reportParams, setReportParams] = useState(null)
const [cfgOpen, setCfgOpen] = useState(false)
const [canvasOpen, setCanvasOpen] = useState(false)
const [scenariosOpen, setScenariosOpen] = useState(false)
const [replayedFrom, setReplayedFrom] = useState(null)

// Enhancements state
const [snapshots, setSnapshots] = useState(...)
const [readOnlySnap, setReadOnlySnap] = useState(null)
const [selA, setSelA] = useState('')
const [selB, setSelB] = useState('')
const [shareNote, setShareNote] = useState('')
const [ariaSnapshotMsg, setAriaSnapshotMsg] = useState('')
const [ariaCompareMsg, setAriaCompareMsg] = useState('')

// Derived values
const caps = useMemo(...)
const canViewReport = ...
const canExport = ...
const hintTitle = ...
const changeLog = useMemo(...)
const compareDiff = useMemo(...)
```

---

## Component Props Summary

### StreamControlBar (Most Complex - 50+ props)
```typescript
interface StreamControlBarProps {
  // State inputs
  started: boolean
  status: StreamStatus
  seed: string
  budget: string
  model: string
  simplifyOn: boolean
  engineMode: EngineMode
  healthTip: string
  listFirst: boolean
  
  // Callbacks
  onStart: () => void
  onStop: () => void
  onSeedChange: (s: string) => void
  onBudgetChange: (b: string) => void
  onModelChange: (m: string) => void
  onSimplifyChange: (v: boolean) => void
  onEngineModeChange: (m: EngineMode) => void
  onListFirstChange: (v: boolean) => void
  onReplay: (...) => void
  
  // Guided mode
  guidedSuggestions: Suggestion[]
  undoRef: React.MutableRefObject<UndoStack>
  onGuidedApply: (...) => void
  onGuidedUndo: (...) => void
  ariaGuidedMsg: string
  onAriaGuidedMsgChange: (msg: string) => void
  
  // Flags (13+)
  paramsFlag: boolean
  shortcutsFlag: boolean
  hintsFlag: boolean
  canViewReport: boolean
  replayFlag: boolean
  // ... etc
  
  // Drawer management
  cfgOpen: boolean
  canvasOpen: boolean
  scenariosOpen: boolean
  reportOpen: boolean
  onCfgOpenChange: (v: boolean) => void
  onCanvasOpenChange: (v: boolean) => void
  onScenariosOpenChange: (v: boolean) => void
  onReportOpenChange: (v: boolean) => void
  configBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  canvasBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  scenariosBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  reportBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  
  // Other
  caps: MobileCaps
  bands: Bands
  summaryV2Flag: boolean
  cost: number | undefined
  T: number
  nHidden: number
}
```

---

## Testing Mapping

### Lines → Tests

| Lines | Original Feature | Test Focus | New Location |
|-------|-----------------|-----------|--------------|
| 47-79 | Flag initialization | Flag states load correctly | StreamFlagsProvider |
| 81-111 | Flag updates | localStorage listener works | StreamFlagsProvider |
| 129-139 | Simplify H key | Toggle on H press | StreamControlBar |
| 407-416 | Param state | State initializes from LS | StreamParametersPanel |
| 431-488 | Scenario import | URL params decode correctly | StreamParametersPanel |
| 564-605 | Copy overlays | Positions compute on resize | StreamOutputDisplay |
| 607-618 | Copy handler | Clipboard writes work | StreamOutputDisplay |
| 620-656 | Begin/Stop | Stream starts/stops | Root |
| 680-728 | Keyboard shortcuts | All hotkeys work | StreamControlBar |
| 1148-1189 | Drawer rendering | All 5 drawers render | StreamDrawersContainer |
| 1393-1570 | Enhancement panels | All panels show when flagged | StreamEnhancementsPanel |
| 1575-1591 | Output display | Text renders correctly | StreamOutputDisplay |

