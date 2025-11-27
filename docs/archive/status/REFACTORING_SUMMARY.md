# SandboxStreamPanel.tsx Refactoring - Quick Reference

## Current State: 1682 LOC Monster Component

```
SandboxStreamPanel.tsx (1682 LOC)
├── Flags management (66 LOC) - 13 separate flag states
├── Graph/Simplify logic (130 LOC) - Graph data, edge filtering
├── Stream connection (10 LOC) - Hook initialization
├── Parameters (82 LOC) - Seed, budget, model, localStorage
├── Scenario handling (80 LOC) - URL params, remember-last
├── Refs/Syncs (60 LOC) - Export tracking, cost, timing
├── Drawers management (100 LOC) - 5 drawer state variables
├── Output/Copy logic (50 LOC) - Overlay positioning, clipboard
├── Control bar (260 LOC) - Buttons, keyboard shortcuts, guided mode
├── Enhancements (180 LOC) - Snapshots, compare, diagnostics, chips
├── Effects/Handlers (100 LOC) - Various useEffect hooks
└── JSX/Render (700+ LOC) - Complex nested UI logic
```

## Target State: 6 Components + Lean Root

```
StreamFlagsProvider.tsx (70 LOC)
  Hook for all 13 feature flags
  localStorage listener
  Flag re-evaluation on mount

StreamOutputDisplay.tsx (100 LOC)
  Raw output display
  Markdown preview
  Copy code buttons + clipboard

StreamParametersPanel.tsx (130 LOC)
  Seed/Budget/Model inputs
  localStorage persistence
  Scenario import (URL params)
  Remember-last loading

StreamControlBar.tsx (280 LOC)
  Start/Stop buttons
  Simplify toggle
  Parameter inputs UI
  Guided suggestions + Undo
  Keyboard shortcuts
  Replay button
  Engine mode toggle
  Status display

StreamDrawersContainer.tsx (200 LOC)
  Manages 5 drawer states
  ConfigDrawer
  CanvasDrawer
  ScenarioDrawer
  RunReportDrawer
  RunHistoryDrawer

StreamEnhancementsPanel.tsx (220 LOC)
  Confidence chips
  Diagnostics panel
  Performance metrics
  Scorecard placeholder
  Snapshots + Compare
  Error banner
  Cost display

SandboxStreamPanel.tsx (320 LOC) - NEW LEAN ROOT
  Guard clause + mount signal (10 LOC)
  Flags setup (5 LOC)
  Stream connection (10 LOC)
  Graph & simplify (50 LOC)
  All state declarations (80 LOC)
  Effects for syncs/URL params (80 LOC)
  Utility functions (20 LOC)
  Component composition (65 LOC)
```

## Extraction Dependencies Map

```
┌─────────────────────────────────────────────────────────────┐
│                   SandboxStreamPanel Root                    │
│              (Orchestrates + manages lifted state)           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ StreamFlags      │  │ useStreamConnection hook         │ │
│  │ (all 13 flags)   │  │ (state + actions)                │ │
│  └────────┬─────────┘  └──────────┬─────────────────────┘ │
│           │                       │                        │
│           ├──────────────────────┬┴──────────────────────┐ │
│           │                      │                       │ │
│  ┌────────▼──────────┐  ┌─────────▼────────┐  ┌────────▼──┐ │
│  │ StreamControlBar  │  │ StreamOutputDisp │  │ StreamDraw│ │
│  │                   │  │ (output display) │  │ (5 drawer)│ │
│  │ - Start/Stop      │  │                  │  │           │ │
│  │ - Simplify toggle │  │ - Text output    │  │ - Reports │ │
│  │ - Param inputs    │  │ - Markdown       │  │ - Config  │ │
│  │ - Guided mode     │  │ - Copy buttons   │  │ - Canvas  │ │
│  │ - Keyboard hotkeys│  │                  │  │ - Scenario│ │
│  │ - Engine mode     │  │ Refs:            │  │ - History │ │
│  │ - Replay button   │  │ - mdPreviewRef   │  │           │ │
│  │                   │  │                  │  │ Manages:  │ │
│  │ Props: 50+        │  │ Props: 15        │  │ - Focus   │ │
│  └───────────────────┘  └──────────────────┘  │ - Params  │ │
│                                                │ - Callbacks│ │
│  ┌──────────────────────────────────────┐     └──────────┘ │
│  │ StreamEnhancementsPanel               │                  │
│  │                                       │                  │
│  │ - Confidence chips                    │                  │
│  │ - Diagnostics (SSE id, tokens, etc)  │                  │
│  │ - Performance (buffer, code blocks)   │                  │
│  │ - Snapshots + Compare                 │                  │
│  │ - Error banner                        │                  │
│  │ - Cost display                        │                  │
│  │                                       │                  │
│  │ Props: 35                             │                  │
│  └──────────────────────────────────────┘                   │
│                                                              │
│  Plus:                                                       │
│  - ListViewSection (when flag enabled)                      │
│  - CommentsPanel (when target selected)                     │
│  - CanvasFirstPath (entire alternate rendering)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## State Flow Architecture

### Lifted to Root (SandboxStreamPanel):
```typescript
// From useStreamConnection
const { state: streamState, actions: streamActions } = useStreamConnection(...)
// Contains: status, output, reportData, cost, reconnecting, etc.

// Flags
const flags = useStreamFlags() // Returns all 13 flags

// Graph & compute
const graph, filteredEdges, nHidden, bands, T

// Output display
const [copyOverlays, copiedId, failedId, ariaCopyMsg, mdHtml, ...]

// Parameters
const [seed, budget, model, scenarioPreview, scenarioChipText, ...]

// Control
const [simplifyOn, engineMode, healthTip, listFirst, sheetOpen, ...]

// Drawers
const [reportOpen, cfgOpen, canvasOpen, scenariosOpen, historyOpen, ...]
const [reportParams, replayedFrom, ...]

// Enhancements
const [snapshots, readOnlySnap, selA, selB, shareNote, ...]

// Comments
const [commentTarget, commentLabel, commentText, ariaCommentMsg, ...]

// Refs (never change, safe to pass)
const statusRef, mdPreviewRef, listContainerRef, textRef, tokensRef, etc.
```

### Per-Component State:
```
StreamFlagsProvider:
  - simplifyFlag, listViewFlag, engineModeFlag, etc. (13 total)
  - All useState + useEffect for flag re-evaluation

StreamOutputDisplay:
  - Uses parent state: output, status, mdHtml, copyOverlays, etc.
  - Internal: effect for overlay positioning

StreamParametersPanel:
  - Uses parent state: seed, budget, model, scenarioPreview, etc.
  - Internal: effects for URL params, remember-last

StreamControlBar:
  - Uses parent state: started, status, seed, budget, model, etc.
  - Internal: effect for keyboard shortcuts

StreamDrawersContainer:
  - Uses parent state: reportOpen, cfgOpen, etc. (all drawer states)
  - Internal: drawer component rendering

StreamEnhancementsPanel:
  - Uses parent state: snapshots, readOnlySnap, selA, selB, etc.
  - Internal: effects for snapshot/compare diffs
```

## Key Dependencies & Shared State

### Simplify Logic (used by 3+ components):
```
simplifyFlag -> (mobile guardrails flag)
simplifyOn -> (user toggle state)
T -> (computed threshold)
filteredEdges -> (computed edges array)
nHidden -> (computed count)
srSummary -> (library function for SR announcement)
```

### Parameters (used by 3+ components):
```
seed, budget, model -> (user inputs)
persistParams() -> (localStorage writer)
paramsFlag -> (gates parameter UI)
scenariosFlag, scenarioChipText -> (scenario features)
```

### Snapshots (used by 2 components):
```
snapshots -> (snapshot list)
selA, selB -> (comparison selection)
changeLog, compareDiff -> (computed diffs)
makeSnapshot() -> (snapshot creator)
```

## Before/After LOC Comparison

```
BEFORE (1682 LOC total):
SandboxStreamPanel.tsx          1682 LOC ██████████████████████████████

AFTER (1320 LOC total, better organized):
SandboxStreamPanel.tsx (root)     320 LOC ████████
StreamFlagsProvider.tsx            70 LOC █
StreamOutputDisplay.tsx           100 LOC ██
StreamParametersPanel.tsx         130 LOC ███
StreamControlBar.tsx              280 LOC ██████
StreamDrawersContainer.tsx        200 LOC ████
StreamEnhancementsPanel.tsx       220 LOC █████

Total: 1320 LOC (362 LOC reduction via better structure)
Root: 320 LOC (81% reduction in main file)
```

## Extraction Order (Risk Profile)

```
Phase 1: SAFE (No new deps)
  1. StreamFlagsProvider ✓ Low risk
  2. StreamOutputDisplay ✓ Low risk

Phase 2: MODERATE (Some deps)
  3. StreamParametersPanel ✓ Medium risk
  4. StreamEnhancementsPanel ✓ Medium risk

Phase 3: HIGHER (Integration needed)
  5. StreamDrawersContainer ✓ Medium-high risk
  6. StreamControlBar ✓ High risk (keyboard handling)

Phase 4: FINAL (Root assembly)
  7. Refactor SandboxStreamPanel ✓ Final assembly
```

## Props Interface Complexity

```
StreamControlBar:       50+ props (most complex)
StreamDrawersContainer: 40+ props
StreamEnhancementsPanel: 35+ props
StreamOutputDisplay:    15 props
StreamParametersPanel:  12 props
StreamFlagsProvider:    0 props (standalone hook)
```

## Testing Strategy

### Unit Tests (Per Component):
- StreamFlagsProvider: Flag initialization, storage listener
- StreamOutputDisplay: Overlay positioning, copy handler, resize
- StreamParametersPanel: Persistence, scenario parsing, guided suggestions
- StreamEnhancementsPanel: Snapshot creation, diff computation, share links
- StreamDrawersContainer: Drawer state management, focus handling
- StreamControlBar: Keyboard shortcuts, button handlers, guided mode

### Integration Tests:
- Flag updates propagate to dependent components
- Parameter changes persist and update all dependents
- Drawer open/close coordinates correctly
- Snapshot creation updates comparison UI
- Keyboard shortcuts trigger correct handlers

### E2E Tests:
- Full user workflow: Start → Configure → Simplify → Export → Compare
- Mobile guardrails behavior on narrow viewports
- Canvas-first alternate rendering
- All drawer interactions

## Potential Future Improvements

```
Post-Refactoring candidates:
  - Extract CommentsPanel to separate component
  - Extract ListViewSection to separate component
  - Extract KeyboardShortcutsSheet sub-component
  - Extract ConfidenceChips, DiagnosticsPanel as micro-components
  - Extract SnapshotsSection, CompareSection as sub-components
  - Extract CanvasFirstPath to alternate component
  - Create custom hooks for snapshot logic
  - Create custom hooks for parameter persistence
```

## Validation Checklist

```
Behavioral Validation:
  ☐ All 13 flags initialize and update correctly
  ☐ All parameters persist to localStorage
  ☐ All keyboard shortcuts work (H, ?, Cmd+Enter, Esc, R, etc.)
  ☐ All drawers open/close independently
  ☐ Snapshot creation, sharing, and comparison work
  ☐ Copy code buttons position correctly and copy text
  ☐ Guided mode suggestions apply and undo works
  ☐ Mobile guardrails activate on narrow viewports
  ☐ Engine mode toggle switches between live/fixtures
  ☐ Export functionality (txt, json, md) works
  ☐ Error banner shows with correct advice
  ☐ Canvas-first path renders correctly
  ☐ Comments can be added/deleted on nodes/edges
  ☐ Simplify toggle hides weaker links

Performance Validation:
  ☐ No unnecessary re-renders (check with React DevTools Profiler)
  ☐ memoization of graph/bands/compute values
  ☐ useCallback for handlers where appropriate
  ☐ useRef for non-state refs
  ☐ Bundle size doesn't increase
  ☐ No memory leaks from event listeners

Code Quality:
  ☐ TypeScript types are accurate
  ☐ No any types
  ☐ Props interfaces documented
  ☐ Component responsibilities clear
  ☐ No circular dependencies
  ☐ Tests pass (unit, integration, E2E)
  ☐ No linting errors
```

