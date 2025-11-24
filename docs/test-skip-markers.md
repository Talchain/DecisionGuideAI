# Test Skip Markers Documentation

This document tracks all `.skip()` markers in the test suite, categorising them as intentional (valid) or requiring action.

**Last Updated:** 2025-01-15 (Phase 2 Sprint 1A)

---

## Intentional Skips (Valid)

These skips are documented and should remain:

### 1. Feature Flag Conditionals (14 tests)
**File:** `e2e/snapshots-v2.spec.ts`
**Reason:** Tests skipped when `VITE_FEATURE_SNAPSHOTS_V2` flag is not enabled
**Action:** None - These are conditional tests for unmerged feature work

### 2. Slow Backend Requirements (2 tests)
**File:** `e2e/canvas-results-panel.spec.ts`
**Lines:** 109, 127
**Reason:** Tests require slow backend to verify cancel button and progress bar behaviour
**Action:** None - These require special test infrastructure

### 3. Legacy/Deprecated Features (5 blocks)
**File:** `src/canvas/components/__tests__/StatusChips.spec.tsx`
**Lines:** 92, 239, 345, 422, 451
**Reason:** Tests for legacy multi-chip layout (replaced with new design)
**Action:** None - Kept for historical reference and potential rollback

### 4. Conditional Dependencies (1 test)
**File:** `e2e/tldraw-adapter.spec.ts`
**Line:** 42
**Reason:** Skipped when TLdraw adapter not installed
**Action:** None - Valid conditional skip

### 5. Timeout/Timer Tests (1 test)
**File:** `src/adapters/plot/v1/__tests__/http.test.ts`
**Line:** 317
**Reason:** Difficult to test with mocked timers in Vitest (verified in integration tests)
**Action:** None - Integration tests cover this behaviour

---

## Skips Requiring Review (22 tests)

These skips need evaluation - implement the test or remove the skip marker:

### 6. Canvas Inspector E2E (11 tests)
**File:** `e2e/canvas-inspector.spec.ts`
**Lines:** 65, 70, 75, 80, 87, 92, 97, 102, 109, 141
**Status:** ⚠️ Unimplemented placeholder tests
**Recommendation:** Implement as part of canvas inspector enhancement work OR remove and create tickets

### 7. Canvas Edges E2E (2 tests)
**File:** `e2e/canvas.edges.spec.ts`
**Lines:** 24, 81
**Status:** ⚠️ Unimplemented placeholder tests
**Recommendation:** Implement edge creation/manipulation tests OR remove and create tickets

### 8. Performance Smoke Tests (3 tests)
**File:** `e2e/canvas.perf-smoke.spec.ts`
**Lines:** 10, 47, 101
**Status:** ⚠️ Conditional skips (unclear condition)
**Recommendation:** Review skip conditions and document them

### 9. Share Links (2 tests)
**File:** `e2e/share-links.spec.ts`
**Lines:** 273, 294
**Status:** ⚠️ Unimplemented placeholder tests
**Recommendation:** Implement share link status verification tests OR remove and create tickets

### 10. ELK Layout Progress (1 test)
**File:** `e2e/smoke/elk-layout.spec.ts`
**Line:** 96
**Status:** ⚠️ Unimplemented placeholder test
**Recommendation:** Implement as part of Phase 2 ELK Progress UX work (see FOLLOW_UP_TICKETS.md)

### 11. Run Gating (2 tests)
**File:** `src/canvas/__tests__/canvas.run-gating.dom.spec.tsx`
**Lines:** 221, 258
**Status:** ⚠️ Unimplemented placeholder tests
**Recommendation:** Implement run gating validation tests OR remove and create tickets

### 12. Scenario Operations (1 test)
**File:** `src/canvas/components/__tests__/ScenarioSwitcher.s6-operations.spec.tsx`
**Line:** 700
**Status:** ⚠️ Unimplemented placeholder test
**Recommendation:** Implement input clearing test OR remove (low priority)

---

## Action Plan

**Immediate (Sprint 1A):**
- ✅ Document all skips (this file)
- Consider adding inline comments for category 6-12 skips explaining they're tracked here

**Phase 2 Follow-up:**
- Create tickets for unimplemented tests (categories 6-12)
- Prioritise canvas inspector and edges tests (core functionality)
- Defer performance smoke tests until performance benchmarking work begins

**Phase 3:**
- Implement high-priority skipped tests (canvas inspector, edges)
- Review and potentially remove low-priority unimplemented skips
