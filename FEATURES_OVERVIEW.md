# Features Overview (S5-S8)

This document provides an overview of features implemented across sprints S5, S6, and S7, focusing on Production Hardening, UX Polish, and Assistant Refinement.

## Table of Contents

- [S5: Production Hardening](#s5-production-hardening)
- [S6: UX Polish & Keyboard Navigation](#s6-ux-polish--keyboard-navigation)
- [S7: Assistant Refinement & File Operations](#s7-assistant-refinement--file-operations)
- [S8: Docked Layout, Help & Delete Feedback](#s8-docked-layout-help--delete-feedback)

---

## S5: Production Hardening

**Goal**: Prepare the application for production deployment with security, observability, and reliability enhancements.

### Features Implemented

#### 1. E2E Critical Paths Test Suite
- **File**: `e2e/s5-critical-paths.spec.ts`
- **Coverage**: 8 critical user journeys
  - Happy path: Model draft → refinement → compare
  - Error recovery: Network failures, retry logic
  - Edge cases: Empty states, validation, limits
- **Purpose**: Ensures core workflows function correctly end-to-end

#### 2. Debug Tray with Observability
- **File**: `src/components/DebugTray.tsx`
- **Features**:
  - Real-time request/response monitoring
  - Performance metrics (timing, payload sizes)
  - Error tracking and diagnostics
  - Toggle visibility with keyboard shortcut
- **Purpose**: Aids debugging in development and staging environments

#### 3. Versioned Storage with Migrations
- **Status**: Planned for future sprint
- **Purpose**: Enable safe schema evolution without data loss

#### 4. Content Security Policy (CSP) Headers
- **Status**: Planned for future sprint
- **Purpose**: Harden application against common web vulnerabilities

#### 5. BFF-Only /assist/* Calls
- **Status**: Planned for future sprint
- **Purpose**: Secure API credentials and enable backend governance

#### 6. Provenance Integration
- **Status**: Existing feature from earlier sprint
- **Purpose**: Document citations and source tracking

---

## S6: UX Polish & Keyboard Navigation

**Goal**: Enhance user experience with keyboard shortcuts, visual polish, and workflow improvements.

### Features Implemented

#### 1. Arrow-Key Nudge for EdgeEditPopover
- **Status**: Planned for future sprint
- **Planned Features**:
  - Arrow keys nudge edge weight (±0.1)
  - Shift+Arrow for larger steps (±0.5)
  - Visual feedback on changes
  - Accessibility (ARIA labels, keyboard hints)

#### 2. Undo/Redo Integration with Canvas History
- **File**: `src/canvas/store.ts` (history management integrated)
- **Features**:
  - Full canvas state snapshots
  - Undo/Redo for all operations (add, edit, delete nodes/edges)
  - Keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
  - History limit (50 states)
  - Integrated with document rename operations (S7)

#### 3. Driver Ranking in EdgeDiffTable
- **File**: `src/canvas/compare/EdgeDiffTable.tsx`
- **Features**:
  - Rank edges by impact (Δweight)
  - Visual badges for top 3 drivers (Gold, Silver, Bronze)
  - Sortable comparison table
  - Edge status indicators (added, removed, matched)

#### 4. 'What Changed' Chip in ResultsPanel
- **File**: `src/canvas/components/WhatChangedChip.tsx`
- **Features**:
  - Summary of graph changes vs. previous run
  - Node/edge diff counts
  - Expandable details view
  - Only shown when previous run exists

#### 5. Rename/Duplicate/Save As for ScenarioSwitcher
- **File**: `src/canvas/components/ScenarioSwitcher.tsx`
- **Features**:
  - Rename current scenario
  - Duplicate scenario
  - Save As (create variant)
  - Delete with confirmation
  - Dropdown menu with operations

#### 6. Keyboard Navigation for RadialQuickAddMenu
- **File**: `src/canvas/components/RadialQuickAddMenu.tsx`
- **Features**:
  - Arrow keys to navigate options
  - Enter to select
  - Number keys (1-6) for direct selection
  - Tab/Shift+Tab for cycling
  - Escape to cancel
  - Visual selection feedback

#### 7. Focus Return on Modal Close
- **Implementation**: Already handled by `LayerProvider`
- **Verified**: Focus correctly returns to trigger element after modal closes

---

## S7: Assistant Refinement & File Operations

**Goal**: Improve assistant experience with context persistence, explanations, and enhanced document management.

### Features Implemented

#### 1. Persist Clarifier Answers Across Rounds
- **File**: `src/components/assistants/ClarifierPanel.tsx`
- **Features**:
  - Answers persist across clarification rounds (≤3 rounds)
  - Pre-populate questions with previous answers
  - Visual "Pre-filled" badge with History icon
  - Backward search for most recent answer
  - Support for both MCQ and text questions
- **Types**: Added `Answer` and `AnswerHistory` interfaces

#### 2. Impact Hints for ClarifierPanel
- **File**: `src/components/assistants/ClarifierPanel.tsx`
- **Features**:
  - Optional `impact_hint` field on questions
  - Explains why each question matters
  - Displayed with Info icon
  - Subtle blue background styling
  - Proper ARIA attributes (role="note")
- **Types**: Extended `DraftResponse['clarifier']['questions']` with `impact_hint?: string`

#### 3. Inline Rationales in Diff Viewer
- **File**: `src/components/assistants/DiffViewer.tsx`
- **Features**:
  - Optional `rationale` field on nodes and edges
  - Explains why AI added each item
  - Displayed inline with Info icon
  - Accessible and semantic markup
  - Works with selection and expand/collapse
- **Types**: Extended `DraftResponse['graph']['nodes']` and `['edges']` with `rationale?: string`

#### 4. DocumentsManager File Operations
- **Files**:
  - `src/canvas/store/documents.ts` (state management)
  - `src/canvas/components/DocumentsManager.tsx` (UI)
- **Features**:
  - **Rename**: Inline editing with F2 shortcut, Enter/Escape commit/cancel
  - **Validation**: Empty names, duplicates (case-insensitive), max 120 chars
  - **Search**: Real-time case-insensitive filtering with clear button
  - **Sort**: Stable multi-key sorting (name, date, size, type) with tie-breakers
  - **Persistence**: SessionStorage for search query and sort preferences
  - **Event Emission**: Document rename notifications for provenance chip sync
  - **Undo/Redo**: Full history integration for rename operations
  - **Accessibility**: WCAG AA compliance, ARIA labels, keyboard navigation
- **Types**:
  - `DocumentItem` interface with stable IDs
  - `ValidationError` with field-specific messages
  - Event emitter with typed listeners
- **Tests**: 114 tests across 4 files:
  - `src/canvas/store/__tests__/documents.spec.ts` (61 unit tests)
  - `src/canvas/components/__tests__/DocumentsManager.rename.dom.spec.tsx` (27 DOM tests)
  - `src/canvas/components/__tests__/DocumentsManager.search-sort.dom.spec.tsx` (26 DOM tests)
  - `e2e/documents-fileops.spec.ts` (E2E coverage)

---

## S8: Docked Layout, Help & Delete Feedback

**Goal**: Improve the canvas shell with docked layout, richer keyboard help, and clearer document deletion feedback, without changing core engine semantics.

### 1. Engine Limits Surface (read from `/v1/limits`)

- The canvas reads limits from the Plot adapter rather than hard-coding them in the bundle.
- Typical staging defaults (subject to backend configuration):
  - **Nodes**: 50
  - **Edges**: 200
  - **Per-document size**: ~96 KiB effective cap
- Limits are surfaced to users as part of the canvas toolbar and diagnostics copy; UI copy reflects the current limits returned by `/v1/limits`.

### 2. Docked Inputs & Outputs Layout

- **Files**:
  - `src/canvas/components/InputsDock.tsx`
  - `src/canvas/components/OutputsDock.tsx`
  - `src/canvas/ReactFlowGraph.tsx`
  - `src/index.css` (CSS custom properties)
- **Behaviour**:
  - **Defaults**: The docked Inputs/Outputs layout is enabled by default via `VITE_FEATURE_INPUTS_OUTPUTS=1` and the corresponding flag in `src/flags.ts`.
  - You can override this per-browser for tests/dev using `localStorage['feature.inputsOutputs']` (`'1'` to force ON, `'0'`/`'false'` to force OFF).
  - When the feature is enabled, the canvas is inset by CSS variables:
    - `--dock-left-offset` for the Inputs dock
    - `--dock-right-offset` for the Outputs dock
  - `InputsDock` and `OutputsDock` manage their own open/closed state via `useDockState`, persisting to `sessionStorage` under `canvas.inputsDock.v1` and `canvas.outputsDock.v1`.
  - Expanded vs collapsed widths are driven by design tokens:
    - `--dock-left-expanded` / `--dock-left-collapsed`
    - `--dock-right-expanded` / `--dock-right-collapsed`
  - `ReactFlowGraph` applies these offsets to the main ReactFlow wrapper so that the graph never sits underneath the docks.
  - When the feature flag is **off**, the wrapper falls back to full-width layout (`left: 0`, `right: 0`).

> Related flags: `VITE_FEATURE_COMMAND_PALETTE` (command palette in the canvas shell), `VITE_FEATURE_DIAGNOSTICS` (run diagnostics capture + tab), and `VITE_FEATURE_DEGRADED_BANNER` (engine health banner) are also ON by default and can be overridden via `localStorage['feature.commandPalette']` / `localStorage['feature.diagnostics']` / `localStorage['feature.degradedBanner']` for local testing.

### 3. Cmd/Ctrl + D routing (legacy drawer vs docked Inputs → Documents)

- **File**: `src/canvas/hooks/useCanvasKeyboardShortcuts.ts` (wiring), `src/canvas/ReactFlowGraph.tsx` (behaviour).
- **Legacy behaviour (flag OFF)**:
  - `Cmd/Ctrl + D` toggles the original **Documents drawer** on the left-hand side.
  - The drawer hosts `DocumentsManager` with upload, rename, search, sort, and delete operations.
- **Docked behaviour (flag ON)**:
  - When Inputs/Outputs dock layout is enabled, `Cmd/Ctrl + D` no longer toggles the legacy drawer.
  - Instead, it:
    - Ensures the Inputs dock is present and expanded.
    - Activates the **Documents** tab inside the Inputs dock.
    - Moves focus into the dock body (`[data-testid="inputs-dock-body"]`) for keyboard users.
  - In both modes, `DocumentsManager` is the single source of truth for document operations; only its container changes.

### 4. Keyboard legend and help

- **Files**:
  - `src/canvas/help/KeyboardLegend.tsx`
  - `src/canvas/ReactFlowGraph.tsx` (mounts `KeyboardLegend` and integrates with onboarding)
- **Behaviour**:
  - Pressing `?` (`Shift+/`) on the canvas toggles a **Keyboard legend** dialog.
  - The legend is a focusable `role="dialog"` with `aria-modal="true"`, labelled by the "Keyboard legend" heading.
  - Sections include Graph operations, Quick Add, Editing & Documents (including `Cmd/Ctrl + D`), Run & Analyse, sliders, History, and Help.
  - Close affordances:
    - `Escape` key
    - The "Close keyboard legend" button
    - Clicking the backdrop
  - A small `localStorage` key (`olumi_keys_seen`) remembers whether the legend has been shown so that first-time users get gentle onboarding, but repeat users are not interrupted.

### 5. Delete feedback toasts for documents

- **Files**:
  - `src/canvas/components/DocumentsManager.tsx`
  - `src/canvas/ReactFlowGraph.tsx` (`handleDeleteDocument`)
  - `src/canvas/ToastContext.tsx` (toast infrastructure)
- **Behaviour**:
  - `DocumentsManager` invokes `onDelete(documentId, document)` before the document is removed from the store.
  - `ReactFlowGraph` wires this to `handleDeleteDocument`, which uses the canvas `ToastContext` to show a short-lived toast such as `"<name> removed"`.
  - This behaviour is consistent in both legacy and docked layouts; only the container changes (drawer vs Inputs dock).

### 6. Degraded banner (debug/ops visibility)

- **Files**:
  - `src/canvas/components/DegradedBanner.tsx`
  - `src/lib/health.ts`
  - `src/canvas/ReactFlowGraph.tsx` (mounts banner behind the debug flag)
- **Behaviour**:
  - When enabled for debug/ops environments, the canvas header can show a **degraded-mode banner** representing backend health.
  - `DegradedBanner` periodically calls `fetchHealth` and renders different copy depending on status:
    - `degraded` → shows a soft warning that the engine is running in degraded mode.
    - `down` → shows a stronger "engine unavailable" message.
    - `ok` or errors → no banner.
  - This banner is intended for environments where a header bar is already present; production enabling is controlled via feature flags and environment configuration.

---

## Test Coverage Summary

The table below currently enumerates S5–S7 coverage. S8 adds additional DOM and E2E coverage for docked layout, keyboard legend, degraded banner, and document delete feedback; those tests are tracked alongside the feature files and QA checklist.

| Sprint | Feature Area | Test Files | Total Tests |
|--------|-------------|------------|-------------|
| **S5** | Production Hardening | 1 | 8 (E2E) |
| **S6** | UX Polish | 7 | 113+ |
| **S7** | Assistant Refinement | 6 | 169 |
| **Total** | | **14** | **290+** |

**Note**: S7 total includes DocumentsManager file operations: 114 tests (61 unit + 53 DOM).

---

## Key Architectural Patterns

### Type Safety
- All new features extend existing TypeScript interfaces
- Optional fields for backward compatibility
- Strict typing for callbacks and handlers

### Accessibility
- ARIA labels and roles throughout
- Keyboard navigation support
- Focus management
- Screen reader friendly

### Testing Strategy
- Unit tests for component logic
- Integration tests for user workflows
- E2E tests for critical paths
- Edge case coverage
- Accessibility testing

### Code Organization
- Feature-specific test files (`.spec.tsx`)
- S7 naming convention for sprint features (`S7-PERSIST`, `S7-HINTS`, etc.)
- Co-located types and implementation
- Modular, composable components

---

## Migration Guide

### For Developers

#### Using Impact Hints (S7)
```typescript
const clarifier = {
  questions: [
    {
      id: 'q1',
      text: 'What is your timeline?',
      type: 'mcq',
      options: ['Short', 'Medium', 'Long'],
      impact_hint: 'Your timeline affects risk assessment priorities.'
    }
  ]
}
```

#### Using Rationales (S7)
```typescript
const draftResponse = {
  graph: {
    nodes: [
      {
        id: 'n1',
        label: 'Revenue Goal',
        rationale: 'Added based on your stated priority in the prompt.'
      }
    ]
  }
}
```


---

## Next Steps (S8-S12)

Planned upcoming features:
- **S8**: Assistants Refinement (patch UX, stream robustness)
- **S9**: Compare v1 (KPIs, causal drivers, export)
- **S10**: Decision Brief Pack v1 (composer, hash/audit)
- **S11**: Template Library v2 (discovery, versioning)
- **S12**: Performance & DX (bundle, perf, visual regression)

---

## Documentation

- **API Types**: `src/adapters/assistants/types.ts`
- **Share Types**: `src/canvas/share/types.ts`
- **Test Examples**: See `__tests__/*.spec.tsx` files
- **Backend Integration**: `docs/PENG_INTEGRATION_REQUIREMENTS.md`

---

## Questions or Issues?

For questions about these features or to report issues, please:
1. Check the test files for usage examples
2. Review the implementation files for details
3. Consult the type definitions for API contracts

**Last Updated**: January 2025 (Post S7 Sprint)
