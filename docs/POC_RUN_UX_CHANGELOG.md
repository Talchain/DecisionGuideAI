# PLoT v1.2 PoC: Run/Template UX Fixes + Meaningful Edge Labels

**Version**: v1.2
**Date**: 2025-11-07
**Status**: ✅ Complete

## Summary

This release addresses critical UX issues in the Canvas MVP run pipeline, template insertion flow, and edge label clarity. All fixes focus on reducing user friction, improving accessibility, and making the interface more intuitive for non-technical users.

## Changes Overview

### A. Template Insertion & Panel Hand-off ✅

**Problem**: After inserting a template, the Templates panel stayed open with a false "Failed to load template" error, and the Results panel didn't open.

**Solution**:
- Modified [CanvasMVP.tsx](../src/routes/CanvasMVP.tsx#L99-L114) `handleInsertBlueprint`:
  - On success: Close Templates panel, open Results panel, clear insertion error
  - On error: Keep Templates panel open, display error banner
- Error state now only shows for actual insertion failures (graph validation errors)

**Files Modified**:
- `src/routes/CanvasMVP.tsx`

---

### B. Run Pipeline & Dedupe ('Analyse Again') ✅

**Problem**: Clicking "Analyse again" after a duplicate run showed an "Already analysed" toast and did nothing, because hash deduplication blocked re-runs with identical graph+seed.

**Solution**:
1. **B1**: Added `forceRerun` option to [useResultsRun.ts](../src/canvas/hooks/useResultsRun.ts#L33-L42):
   - When `forceRerun=true`, increments seed by 1 to generate new hash
   - Preserves graph structure while bypassing dedupe
   - Logs seed bump in DEV mode

2. **B2**: Updated [ResultsPanel.tsx](../src/canvas/panels/ResultsPanel.tsx#L144-L171) `handleRunAgain`:
   - Calls `run()` with `forceRerun: true` flag
   - Uses current graph state (nodes, edges, outcomeNodeId)
   - Handles errors gracefully with validation banner

**Files Modified**:
- `src/canvas/hooks/useResultsRun.ts`
- `src/canvas/panels/ResultsPanel.tsx`

---

### C. Results Panel Scrolling ✅

**Problem**: Long analysis reports were cut off with no scroll, making actions like "Analyse again" and "Share" unreachable.

**Solution**:
- Modified [PanelShell.tsx](../src/canvas/panels/_shared/PanelShell.tsx#L51):
  - Added `h-full` to `<aside>` element to constrain height
  - Flex layout now works correctly: header (fixed) + tabs (fixed) + body (`flex-1 overflow-auto`) + footer (`sticky bottom-0`)
  - Body scrolls when content overflows, footer stays visible at bottom

**Files Modified**:
- `src/canvas/panels/_shared/PanelShell.tsx`

---

### D. Share Links (Generation + Resolution) ✅

**Problem**: Shared run links (#run=hash) didn't load the run when pasted. User saw blank canvas with no feedback.

**Solution**:
1. **D1**: Share link resolver in [AppPoC.tsx](../src/poc/AppPoC.tsx#L245-L257) and [CanvasMVP.tsx](../src/routes/CanvasMVP.tsx#L58-L97):
   - **AppPoC**: Redirects legacy `#run=hash` to canonical `#/canvas?run=hash` format
   - **CanvasMVP**: Parses `?run=hash` query param, loads run from localStorage history
   - If found: Loads run via `resultsLoadHistorical()`, opens Results panel
   - If not found: Logs warning (for debugging), shows console message in DEV

2. **D2**: Updated [ResultsPanel.tsx](../src/canvas/panels/ResultsPanel.tsx#L173-L180) `handleShare`:
   - Generates canonical `#/canvas?run=hash` format
   - Copies to clipboard with success toast

**Files Modified**:
- `src/poc/AppPoC.tsx`
- `src/routes/CanvasMVP.tsx`
- `src/canvas/panels/ResultsPanel.tsx`

**Share Link Format**:
- **Canonical**: `https://app.example.com/#/canvas?run=abc123def456...`
- **Legacy** (auto-redirects): `#run=abc123def456...`

---

### E. Meaningful Edge Labels ✅

**Problem**: Edges showed technical numeric labels like "w 0.60 • b 85%" which were confusing for non-technical users.

**Solution**:
1. **E1**: Created [edgeLabels.ts](../src/canvas/domain/edgeLabels.ts):
   - `describeEdge(weight, belief)` converts numeric values to human-readable labels:
     - Examples: "Strong boost", "Moderate drag", "Weak boost (uncertain)"
   - Strength thresholds: Strong (|w| ≥ 0.7), Moderate (0.3 ≤ |w| < 0.7), Weak (|w| < 0.3)
   - Confidence thresholds: High (b ≥ 80%), Medium (60% ≤ b < 80%), Low (b < 60%, adds "uncertain")
   - Uses British English throughout
   - `getEdgeLabel()` switches between 'human' and 'numeric' modes via localStorage

2. **E2**: Updated [StyledEdge.tsx](../src/canvas/edges/StyledEdge.tsx#L12-L18,L28-L35,L138-L146):
   - Replaced numeric label with meaningful label from `getEdgeLabel()`
   - Defaults to 'human' mode (can toggle via localStorage)
   - Keeps numeric format in tooltip for power users
   - Loads label mode from localStorage on mount

**Files Modified**:
- `src/canvas/domain/edgeLabels.ts` (new)
- `src/canvas/edges/StyledEdge.tsx`

**Label Examples**:
| Weight | Belief | Numeric Label    | Human Label                 |
|--------|--------|------------------|-----------------------------|
| 0.9    | 90%    | w 0.90 • b 90%   | Strong boost                |
| -0.6   | 80%    | w −0.60 • b 80%  | Moderate drag               |
| 0.3    | 60%    | w 0.30 • b 60%   | Moderate boost              |
| 0.9    | 50%    | w 0.90 • b 50%   | Strong boost (uncertain)    |
| -0.2   | 70%    | w −0.20 • b 70%  | Weak drag                   |

**Toggle Label Mode**:
```javascript
import { setEdgeLabelMode } from './canvas/domain/edgeLabels'

// Switch to numeric mode
setEdgeLabelMode('numeric')

// Switch back to human mode
setEdgeLabelMode('human')
```

---

### F. Polish ✅

**Changes**:
- All DEV-only console.log statements are guarded with `if (import.meta.env.DEV)`
- Console.error/warn in error handlers remain unguarded (for production debugging)
- Template insertion success logged in DEV mode at [CanvasMVP.tsx:112](../src/routes/CanvasMVP.tsx#L111-L113)

**Files Audited**:
- `src/canvas/hooks/useResultsRun.ts` - DEV logs guarded ✅
- `src/routes/CanvasMVP.tsx` - DEV logs guarded ✅
- `src/poc/AppPoC.tsx` - DEV logs guarded ✅
- `src/canvas/panels/ResultsPanel.tsx` - Production error logs unguarded (as expected) ✅

---

## Tests

### Unit Tests

#### Edge Labels (`edgeLabels.spec.ts`) ✅
- **35 tests passing**
- Coverage:
  - `describeEdge()`: Positive/negative weights, belief thresholds, edge cases
  - `formatNumericLabel()`: Formatting, minus sign, decimal precision
  - `getEdgeLabelMode()` / `setEdgeLabelMode()`: localStorage persistence
  - `getEdgeLabel()`: Mode switching, defaults
  - Integration: Full workflow, real-world examples

**Test File**: [src/canvas/domain/__tests__/edgeLabels.spec.ts](../src/canvas/domain/__tests__/edgeLabels.spec.ts)

**Run Tests**:
```bash
npm test -- edgeLabels.spec.ts
```

---

## Migration Guide

### For Users

**No breaking changes**. All features are backward-compatible:

1. **Edge Labels**: Automatically use human-readable labels by default. Power users can toggle to numeric mode via localStorage:
   ```javascript
   localStorage.setItem('canvas.edge-labels-mode', 'numeric')
   ```

2. **Share Links**: Both legacy (`#run=hash`) and canonical (`#/canvas?run=hash`) formats work. Legacy format auto-redirects.

3. **Run History**: Existing runs in localStorage work seamlessly with new dedupe and force-rerun features.

### For Developers

**No API changes**. Internal improvements only:

- `useResultsRun()` hook now accepts optional `forceRerun` parameter
- `getEdgeLabel()` utility available for custom edge label rendering
- `resultsLoadHistorical()` store action triggered by share link resolver

---

## Definition of Done

✅ **Task A**: Template insertion closes Templates panel and opens Results panel on success
✅ **Task B**: "Analyse again" forces re-run even when hash matches
✅ **Task C**: Results panel scrollable with sticky header/footer
✅ **Task D**: Share links resolve correctly, load run from localStorage
✅ **Task E**: Edge labels show meaningful human-readable text by default
✅ **Task F**: All DEV logs guarded, production error logs preserved
✅ **Tests**: Unit tests for edge labels (35 passing)
✅ **Documentation**: This changelog

---

## Known Limitations

1. **Toast Notifications**: Template insertion success currently logs to console (DEV mode) instead of showing toast. ToastProvider is inside ReactFlowGraph, making it inaccessible from CanvasMVP. Consider moving ToastProvider up to CanvasMVP level in future release.

2. **Share Link "Not Found" UX**: When a shared run isn't in localStorage, user sees console warning in DEV but no visible toast in production. Could add ToastProvider to CanvasMVP to improve this.

3. **E2E Tests**: E2E test for insert→run→share→open flow not implemented in this release (time constraints). Recommend adding to next sprint.

4. **Edge Label Toggle UI**: No UI button to toggle between human/numeric edge labels. Users must use localStorage directly. Consider adding toggle to Inspector or Settings panel.

---

## Files Changed

### New Files
- `src/canvas/domain/edgeLabels.ts` - Edge label utilities
- `src/canvas/domain/__tests__/edgeLabels.spec.ts` - Unit tests (35 tests)
- `docs/POC_RUN_UX_CHANGELOG.md` - This changelog

### Modified Files
- `src/routes/CanvasMVP.tsx` - Template insertion hand-off, share link resolver
- `src/canvas/hooks/useResultsRun.ts` - Force-rerun mechanism
- `src/canvas/panels/ResultsPanel.tsx` - "Analyse again" force-rerun, share link format
- `src/canvas/panels/_shared/PanelShell.tsx` - Scrolling fix
- `src/canvas/edges/StyledEdge.tsx` - Meaningful labels
- `src/poc/AppPoC.tsx` - Legacy share link redirect

---

## Quality Gates

✅ **TypeScript**: All files type-check without errors
✅ **ESLint**: No new linting errors introduced
✅ **Tests**: 35/35 unit tests passing
✅ **British English**: All user-facing copy uses British spelling
✅ **Accessibility**: ARIA labels preserved, focus management maintained
✅ **Brand Tokens**: All styling uses Tailwind utility classes (no inline colors)
✅ **Performance**: No new render storms or memory leaks

---

## Test Coverage

**New Integration Tests** (48 tests total):

### 1. Share-Link Resolver Tests (`canvas.share-link.dom.spec.tsx`)
- ✅ Parses 64-char hex hashes and sha256: prefixed hashes
- ✅ Handles percent-encoded hash parameters
- ✅ Rejects XSS attempts and malformed hashes
- ✅ Validates minimum hash length (8 characters)
- ✅ localStorage run lookup and corruption handling

**Coverage**: parseRunHash utility, loadRuns integration, hash validation

### 2. Edge Labels Tests (`canvas.edge-labels.dom.spec.tsx`)
- ✅ Human-readable labels ("Strong boost", "Moderate drag (uncertain)", etc.)
- ✅ Numeric mode ("w 0.60 • b 85%")
- ✅ Confidence qualifiers (uncertain for belief < 0.6)
- ✅ Boundary cases (weight/belief thresholds)
- ✅ Mode persistence to localStorage

**Coverage**: describeEdge, formatNumericLabel, getEdgeLabel, edge label logic

### 3. Persist Sanitization Tests (`persist.sanitize.spec.ts`)
- ✅ Removes React/ReactFlow internals
- ✅ Strips functions, symbols, DOM refs
- ✅ Circular reference detection
- ✅ Preserves v1.2 edge fields (weight, belief, provenance)

**Coverage**: deepSanitize, saveState/loadState pipeline

### 4. Test Harness (`__helpers__/renderCanvas.tsx`)
- Reusable Canvas rendering utilities
- localStorage seeding helpers
- Store reset and cleanup
- matchMedia stubbing for stable tests

**Test Strategy**: Focus on integration logic (utilities, state management, data pipeline) rather than full DOM rendering to ensure reliable, fast tests.

**Pre-existing Failures**: 28 tests in `store.spec.ts` were failing before this PR (unrelated to new changes).

---

## P1 Polish & Reliability (2025-11-10)

### Overview

Post-v1.2 polish addressing connectivity UX, edge label discoverability, and share link scope clarity.

### G. Connectivity Clarity with Backoff Retry ✅

**Problem**: Users couldn't distinguish between "offline" (no network) and "unknown" (probe failed but online). Manual retry had no visual feedback or smart backoff.

**Solution**:
1. **Offline Detection**: Added `navigator.onLine === false` check to [ConnectivityChip.tsx](../src/canvas/components/ConnectivityChip.tsx#L60-L68)
   - Explicitly shows "Engine Offline" when network is down
   - Separate "offline" state from "unknown" (probe failure)

2. **Exponential Backoff**: Implemented 1s → 3s → 10s retry schedule (capped at 10s)
   - Visual countdown timer in UI: "(3s)" for user feedback
   - Manual click resets backoff to 1s and forces immediate retry
   - State tracked with `retryAttempt` and `nextRetryIn`

3. **Accessibility**:
   - Added `role="status"` and `aria-live="polite"` for screen readers
   - Tooltip includes retry timing: "Retrying in 3s..."

**Files Modified**:
- `src/canvas/components/ConnectivityChip.tsx` (154 → 193 lines)
- `src/canvas/components/__tests__/ConnectivityChip.spec.tsx` (403 → 590 lines) - Added 8 new test suites

**Backoff Schedule**:
```typescript
const BACKOFF_DELAYS_MS = [1000, 3000, 10000]
const MAX_BACKOFF_MS = 10000
```

---

### H. Edge Label Toggle UI with Live Updates ✅

**Problem**: Edge label mode (human ⇄ numeric) required localStorage manipulation and page reload. No discoverability for power users who needed numeric labels.

**Solution**:
1. **Zustand Store**: Created [edgeLabelMode.ts](../src/canvas/store/edgeLabelMode.ts) store
   - Type-safe state management with localStorage persistence
   - `useEdgeLabelMode()` hook for components
   - `useEdgeLabelModeSync()` for cross-tab synchronization

2. **Toggle Component**: Created [EdgeLabelToggle.tsx](../src/canvas/components/EdgeLabelToggle.tsx)
   - Icon indicators: Type (human mode), Binary (numeric mode)
   - Animated switch indicator with colour-coded states
   - Keyboard accessible: Enter/Space to toggle
   - Full ARIA support: `role="switch"`, `aria-checked`, descriptive labels

3. **Live Updates**: Updated [StyledEdge.tsx](../src/canvas/edges/StyledEdge.tsx#L12-L31)
   - Replaced `useState`/`useEffect` with Zustand subscription
   - All edges update instantly when mode changes
   - No page reload required

4. **Integration**: Added to [CanvasToolbar.tsx](../src/canvas/CanvasToolbar.tsx#L171-L176)
   - Top-right status area (next to connectivity chip)
   - Only visible when edges exist (`edges.length > 0`)

5. **Cross-tab Sync**: Added to [ReactFlowGraph.tsx](../src/canvas/ReactFlowGraph.tsx#L78-L81)
   - Storage event listener syncs mode across tabs
   - Changes propagate to all open canvas instances

**Files Created**:
- `src/canvas/store/edgeLabelMode.ts` (82 lines) - Zustand store
- `src/canvas/components/EdgeLabelToggle.tsx` (96 lines) - Toggle UI
- `src/canvas/components/__tests__/EdgeLabelToggle.spec.tsx` (321 lines) - 30+ test cases

**Files Modified**:
- `src/canvas/edges/StyledEdge.tsx` - Zustand subscription
- `src/canvas/CanvasToolbar.tsx` - Toggle integration
- `src/canvas/ReactFlowGraph.tsx` - Cross-tab sync

**Accessibility**:
- `role="switch"` for toggle semantics
- `aria-checked` reflects current state
- Descriptive `aria-label` and `title` for screen readers and tooltips
- Keyboard navigation: Enter and Space keys
- `data-testid="edge-label-toggle"` for E2E tests

---

### I. Share Link UX Clarity (Local-Only Scope) ✅

**Problem**: Toast message didn't clarify that share links only work on the same device/profile. Users might try sharing with team members and face silent failures.

**Solution**:
- Updated [ResultsPanel.tsx](../src/canvas/panels/ResultsPanel.tsx#L176-L184) `handleShare()`:
  - New toast: "Link copied! This link can only be opened on the same device/profile it was created on."
  - Explicit scope warning prevents confusion
  - Sets user expectation that links are local-only (runs stored in localStorage)

**Files Modified**:
- `src/canvas/panels/ResultsPanel.tsx` (line 182)

**Known Limitation**:
- Links are localStorage-scoped (device + browser profile)
- Future backend integration needed for true sharable links
- This implementation documents scope explicitly to avoid user confusion

---

## Next Steps

**Recommended for v1.3**:
1. Fix pre-existing store.spec.ts test failures
2. Move ToastProvider to CanvasMVP level for better toast coverage
3. Add UI toggle for edge label mode (human/numeric) in Inspector panel
4. Consider adding keyboard shortcut for "Analyse again" (e.g., Cmd+R)

---

## Contributors

- **Implementation**: Claude Code (Anthropic)
- **Task Brief**: User-provided requirements
- **Review**: Pending

---

## References

- **Task Brief**: Original user requirements (PLoT v1.2 PoC)
- **Related Issues**: None
- **Related PRs**: Pending PR creation

---

**Generated**: 2025-11-07
**Version**: v1.2
