# Phase 3: Skipped Tests Implementation Tickets

**Created:** 2025-01-15 (Phase 2 Sprint 1B completion)
**Source:** [test-skip-markers.md](test-skip-markers.md) - 24 unimplemented tests requiring review

This document converts unimplemented `.skip()` test placeholders into actionable Phase 3 tickets, prioritised by impact and feature area.

---

## High Priority: Canvas Inspector (11 tests)

**File:** `e2e/canvas-inspector.spec.ts`
**Why Important:** Core canvas functionality - edge selection, belief/provenance editing, validation

### Ticket CI-1: Edge Selection and Display
**Tests:** Lines 65, 75, 80
**Effort:** Medium (2-3 days)
**Description:**
- Implement test for displaying edge details when edge selected
- Test belief value slider interaction
- Test provenance text input

**Acceptance Criteria:**
- User can select an edge and see Inspector panel with edge details
- Belief slider updates edge `belief` property (0-1 range)
- Provenance text input updates edge metadata
- Changes persist to graph state

**Implementation Notes:**
- May need to add edge selection handlers to ReactFlowGraph
- Inspector panel already exists, needs edge mode wiring
- Belief slider component may need creation

---

### Ticket CI-2: Edge Validation and Guidance
**Tests:** Lines 80, 87
**Effort:** Small (1 day)
**Description:**
- Show validation error when high belief (>0.7) lacks provenance
- Disable Apply button when no changes made
- Enable Apply button when values change

**Acceptance Criteria:**
- Validation warning shown for high-belief edges without provenance source
- Apply button disabled state reflects form pristine/dirty status
- Visual feedback (tooltips, error messages) guide user

**Implementation Notes:**
- Integrate with existing graph validation system (graphValidator.ts)
- Add form state tracking to Inspector panel

---

### Ticket CI-3: Edge Editing Persistence
**Tests:** Lines 92, 97, 102
**Effort:** Small (1 day)
**Description:**
- Apply button persists edge changes to graph
- Reset button reverts changes to original values
- Multi-selection shows appropriate message

**Acceptance Criteria:**
- Apply commits changes to Zustand store and ReactFlow
- Reset clears form and restores original edge values
- Multi-edge selection shows "Select single edge to edit" message

**Implementation Notes:**
- Wire Apply/Reset to useCanvasStore edge update actions
- Handle multi-selection gracefully (disable editing, show message)

---

### Ticket CI-4: Inspector Accessibility
**Test:** Line 141
**Effort:** Small (0.5 days)
**Description:** Ensure Canvas Inspector has no Axe violations

**Acceptance Criteria:**
- No Axe accessibility violations in Inspector panel
- Keyboard navigation works (Tab, Enter, Esc)
- Screen reader announcements for state changes
- ARIA labels and roles properly set

**Implementation Notes:**
- Run Axe audit on Inspector panel
- Fix any violations (missing labels, contrast, focus management)
- Add aria-live regions for dynamic content

---

## Medium Priority: Canvas Edges (2 tests)

**File:** `e2e/canvas.edges.spec.ts`
**Why Important:** Core graph editing - users must be able to create edges

### Ticket CE-1: Edge Creation
**Tests:** Lines 24, 81
**Effort:** Medium (2 days)
**Description:**
- User can create edge between two nodes by dragging
- Support multiple edges between same nodes

**Acceptance Criteria:**
- Click and drag from source node to target node creates edge
- Edge appears in graph with default properties (belief: 0.5)
- Multiple edges between same pair supported (different conditions)
- New edge has unique ID and persists to store

**Implementation Notes:**
- ReactFlow supports edge creation via `onConnect` handler
- May need custom edge connection line component
- Store must handle multi-edge case (not overwrite existing)

---

## Low Priority: Performance Smoke Tests (3 tests)

**File:** `e2e/canvas.perf-smoke.spec.ts`
**Why Important:** Ensure canvas performs well with large graphs

### Ticket PERF-1: Performance Benchmarks
**Tests:** Lines 10, 47, 101
**Effort:** Medium (2-3 days)
**Description:**
- Benchmark canvas render time for large graphs (50+ nodes)
- Measure interaction latency (drag, zoom, pan)
- Establish performance budgets

**Acceptance Criteria:**
- Initial render <500ms for 50-node graph
- Drag/zoom/pan operations <16ms (60 FPS)
- No memory leaks after 100 interactions
- Performance regression detection in CI

**Implementation Notes:**
- Use Playwright performance APIs
- Create large graph fixtures (50, 100, 200 nodes)
- Set conditional skip based on CI environment (slow on CI, run locally)

---

## Low Priority: Share Links (2 tests)

**File:** `e2e/share-links.spec.ts`
**Why Important:** Share link status verification

### Ticket SL-1: Share Link Status Indicators
**Tests:** Lines 273, 294
**Effort:** Small (1 day)
**Description:**
- Show "Checking..." status when verifying share link hash
- Show "Allowed" status when hash is allowlisted

**Acceptance Criteria:**
- Loading spinner/message shown during hash verification
- "Allowed" badge shown for allowlisted hashes
- "Blocked" badge shown for non-allowlisted hashes (if applicable)

**Implementation Notes:**
- May require backend API for hash allowlist checking
- UI components likely already exist, need wiring

---

## Low Priority: ELK Layout Progress (1 test)

**File:** `e2e/smoke/elk-layout.spec.ts`
**Why Important:** User feedback during slow auto-layout operations

### Ticket ELK-1: Layout Progress Indicator
**Test:** Line 96
**Effort:** Small (1 day)
**Description:** Show progress indicator during ELK layout computation

**Acceptance Criteria:**
- Loading spinner/progress bar shown when ELK layout triggered
- Progress indicator disappears when layout complete
- User cannot trigger new layout while one in progress

**Implementation Notes:**
- ELK layout is synchronous and blocks UI (may need worker?)
- Add loading state to layout store
- Consider Phase 2 ELK Progress UX work (FOLLOW_UP_TICKETS.md)

---

## Low Priority: Run Gating (2 tests)

**File:** `src/canvas/__tests__/canvas.run-gating.dom.spec.tsx`
**Why Important:** Prevent invalid runs, show helpful error messages

### Ticket RG-1: Run Gating Validation
**Tests:** Lines 221, 258
**Effort:** Small (1 day)
**Description:**
- Run analysis once for valid, within-limits graph
- Block run on empty graph, show empty-graph helper toast

**Acceptance Criteria:**
- Valid graph triggers single analysis run (no duplicates)
- Empty graph (0 nodes) blocks run with error toast
- Toast message guides user: "Add nodes to begin analysis"
- Keyboard shortcut (Cmd+Enter) respects gating

**Implementation Notes:**
- Integrate with graph validation system
- Add toast notifications for blocked runs
- Wire keyboard shortcuts to same gating logic

---

## Very Low Priority: Scenario Operations (1 test)

**File:** `src/canvas/components/__tests__/ScenarioSwitcher.s6-operations.spec.tsx`
**Why Important:** Minor UX polish

### Ticket SO-1: Clear Rename Input on Close
**Test:** Line 700
**Effort:** Trivial (0.5 days)
**Description:** Clear input value after closing save dialog

**Acceptance Criteria:**
- Rename dialog input resets to empty when closed
- Prevents stale value appearing on reopen

**Implementation Notes:**
- Add cleanup to dialog close handler
- Single-line fix, low priority

---

## Summary

**Total Tests:** 24 unimplemented
**Tickets Created:** 11
**Estimated Effort:** ~15-20 days

### Priority Breakdown

| Priority | Tickets | Effort | Focus Area |
|----------|---------|--------|------------|
| High | 4 | 5-7 days | Canvas Inspector (core editing) |
| Medium | 2 | 4-5 days | Edge creation, performance |
| Low | 5 | 5-8 days | Share links, ELK progress, run gating |

### Recommended Phase 3 Sprint Plan

**Sprint 3A: Core Editing (1 week)**
- CI-1: Edge selection and display
- CE-1: Edge creation
- CI-2: Edge validation

**Sprint 3B: Polish & Validation (1 week)**
- CI-3: Edge editing persistence
- CI-4: Inspector accessibility
- RG-1: Run gating validation

**Sprint 3C: Performance & UX (1 week)**
- PERF-1: Performance benchmarks
- ELK-1: Layout progress indicator
- SL-1: Share link status indicators

**Defer to Phase 4:**
- SO-1: Scenario operations polish (trivial, low value)

---

## Notes

- **No .skip() removal:** Keep `.skip()` markers in place until tests implemented
- **Incremental work:** Implement tickets one at a time, merging to main as completed
- **Test-driven:** Write failing test first, then implement feature to pass
- **Document decisions:** If test is deemed unnecessary, document why and remove `.skip()`
