# Canvas v2.1 - Follow-Up Implementation Tickets

**Parent Epic**: Canvas v2.1 - Performance & Quality Gates  
**Status**: Vendor optimization shipped ✅ - Now implement remaining phases

---

## 🎯 Phase 1: Route-Based Lazy Loading + Error Boundary

**Priority**: HIGH  
**Estimated effort**: 2-3 hours  
**Dependencies**: None (vendor split already done)

### Tasks
- [ ] Add `React.lazy()` for Canvas, Plot, Sandbox routes in `AppPoC.tsx`
- [ ] Create `CanvasErrorBoundary` component with Sentry integration
- [ ] Implement `RouteLoadingFallback` with ARIA + reduced motion support
- [ ] Add E2E tests:
  - [ ] `e2e/smoke/chunk-failure.spec.ts` - Error boundary catches lazy failures
  - [ ] `e2e/smoke/route-transitions.spec.ts` - Loading states + a11y

### Acceptance Criteria
- All routes lazy-loaded with `React.lazy()`
- Error boundary catches chunk load failures and reports to Sentry
- Loading fallback visible with proper ARIA attributes
- E2E tests pass for chunk failure scenarios

### Files to Create/Modify
```
src/components/CanvasErrorBoundary.tsx (NEW)
src/components/RouteLoadingFallback.tsx (EXISTS - enhance)
src/poc/AppPoC.tsx (MODIFY - add lazy routes)
e2e/smoke/chunk-failure.spec.ts (NEW)
e2e/smoke/route-transitions.spec.ts (NEW)
```

---

## 🎯 Phase 2: ELK Progress UX

**Priority**: MEDIUM  
**Estimated effort**: 2-3 hours  
**Dependencies**: Phase 1 (lazy loading)

### Tasks
- [ ] Enhance `importWithProgress()` with streaming progress
- [ ] Add `ImportCancelToken` for abort support
- [ ] Create progress toast UI (cancel/retry buttons)
- [ ] Add reduced motion support for progress animations
- [ ] Unit tests for progress tracking + abort
- [ ] E2E test for ELK layout with progress

### Acceptance Criteria
- Progress bar shows during ELK download (~431 KB)
- User can cancel import mid-stream
- Retry button appears on failure
- Respects `prefers-reduced-motion`
- Non-blocking UI during download

### Files to Create/Modify
```
src/lib/importWithProgress.ts (EXISTS - enhance)
src/lib/__tests__/importWithProgress.test.ts (EXISTS - add tests)
src/components/ProgressToast.tsx (NEW)
e2e/elk-progress.spec.ts (NEW)
```

---

## 🎯 Phase 3: Core Smoke Test Suite

**Priority**: HIGH  
**Estimated effort**: 4-5 hours  
**Dependencies**: Phase 1 (lazy routes)

### Tasks
- [ ] `e2e/smoke/node-crud.spec.ts` - Add, edit, connect, delete nodes
- [ ] `e2e/smoke/snapshots.spec.ts` - Save/restore/rotation
- [ ] `e2e/smoke/import-export-json.spec.ts` - Validation + XSS sanitization
- [ ] `e2e/smoke/settings.spec.ts` - Persistence + keyboard access
- [ ] `e2e/smoke/palette.spec.ts` - Command execution + focus return
- [ ] `e2e/smoke/diagnostics.spec.ts` - `?diag=1` overlay
- [ ] `e2e/smoke/keyboard.spec.ts` - Shortcuts + focus management
- [ ] `e2e/smoke/a11y.spec.ts` - ARIA roles + focus visible
- [ ] `e2e/smoke/elk-layout.spec.ts` - Layout application
- [ ] `e2e/smoke/network-guards.spec.ts` - No Sentry/Hotjar in dev

### Acceptance Criteria
- All 13 smoke tests passing
- Zero console errors in tests
- Stable selectors using `data-testid`
- Screenshots captured on failure

### Files to Create
```
e2e/smoke/node-crud.spec.ts (NEW)
e2e/smoke/snapshots.spec.ts (NEW)
e2e/smoke/import-export-json.spec.ts (NEW)
e2e/smoke/settings.spec.ts (NEW)
e2e/smoke/palette.spec.ts (NEW)
e2e/smoke/diagnostics.spec.ts (NEW)
e2e/smoke/keyboard.spec.ts (NEW)
e2e/smoke/a11y.spec.ts (NEW)
e2e/smoke/elk-layout.spec.ts (NEW)
e2e/smoke/network-guards.spec.ts (NEW)
```

---

## 🎯 Phase 4: Web Vitals CI Gates

**Priority**: MEDIUM  
**Estimated effort**: 2-3 hours  
**Dependencies**: Phase 1 (lazy routes)

### Tasks
- [ ] Create `e2e/webvitals.spec.ts` with PerformanceObserver
- [ ] Implement LCP, INP, CLS measurement
- [ ] Add configurable thresholds via env vars
- [ ] Export metrics to JSON artifacts
- [ ] Add 3-run consistency checks
- [ ] Wire into CI pipeline

### Acceptance Criteria
- LCP < 2500ms (configurable via `VITALS_LCP_MS`)
- INP < 100ms (configurable via `VITALS_INP_MS`)
- CLS < 0.1 (configurable via `VITALS_CLS`)
- Metrics exported to `test-artifacts/webvitals.json`
- CI fails if thresholds exceeded

### Files to Create
```
e2e/webvitals.spec.ts (NEW)
e2e/global.d.ts (NEW - type declarations)
package.json (MODIFY - add script)
```

### Environment Variables
```bash
VITALS_LCP_MS=2500      # Default: 2500ms
VITALS_INP_MS=100       # Default: 100ms
VITALS_CLS=0.1          # Default: 0.1
```

---

## 🎯 Phase 5: Performance Benchmarks

**Priority**: MEDIUM  
**Estimated effort**: 3-4 hours  
**Dependencies**: Phase 1 (lazy routes)

### Tasks
- [ ] Create `e2e/perf/layout-100.spec.ts` - 100-node layout <2s
- [ ] Create `e2e/perf/drag-zoom-300.spec.ts` - 300-node ≥55fps
- [ ] Implement FPS tracking
- [ ] Add long task monitoring (>100ms)
- [ ] Export metrics to JSON artifacts
- [ ] Add configurable thresholds

### Acceptance Criteria
- 100 nodes + 160 edges layout: median <2000ms (3 runs)
- 300 nodes drag/zoom: ≥55fps over 3 seconds
- Long tasks logged (warn if >100ms)
- Metrics exported to `test-artifacts/perf.json`

### Files to Create
```
e2e/perf/layout-100.spec.ts (NEW)
e2e/perf/drag-zoom-300.spec.ts (NEW)
package.json (MODIFY - add script)
```

### Environment Variables
```bash
LAYOUT_100_MS=2000      # Default: 2000ms
DRAG_300_MIN_FPS=55     # Default: 55fps
```

---

## 🎯 Phase 6: Toast Stress Testing

**Priority**: LOW  
**Estimated effort**: 1-2 hours  
**Dependencies**: None

### Tasks
- [ ] Create `e2e/toast-stress.spec.ts`
- [ ] Test 15 rapid toasts FIFO order
- [ ] Verify z-index prevents palette overlap
- [ ] Test auto-dismiss timing (±250ms tolerance)
- [ ] Test manual close immediate
- [ ] Verify focus trap doesn't break palette

### Acceptance Criteria
- 15 toasts maintain FIFO order
- Z-index isolation verified
- Auto-dismiss within ±250ms
- Manual close immediate
- Focus trap doesn't interfere

### Files to Create
```
e2e/toast-stress.spec.ts (NEW)
package.json (MODIFY - add script)
```

---

## 📋 Implementation Order

1. **Week 1**: Phase 1 (Lazy Loading + Error Boundary) ← START HERE
2. **Week 1**: Phase 3 (Core Smoke Tests) - Can run in parallel
3. **Week 2**: Phase 2 (ELK Progress UX)
4. **Week 2**: Phase 4 (Web Vitals)
5. **Week 2**: Phase 5 (Performance Benchmarks)
6. **Week 3**: Phase 6 (Toast Stress) - Optional polish

---

## 🎯 Success Metrics

### After All Phases Complete
- [ ] 30+ E2E tests passing
- [ ] LCP < 2500ms, INP < 100ms, CLS < 0.1
- [ ] 100-node layout < 2s, 300-node drag ≥55fps
- [ ] Zero console errors in production
- [ ] WCAG 2.1 AA compliance
- [ ] Bundle budgets met (already done ✅)

### CI Pipeline
```bash
npm run typecheck && npm run lint
npm run build && npm run ci:bundle-budget
npm run e2e:smoke
npm run e2e:vitals
npm run e2e:perf
npm run e2e:elk-progress
npm run e2e:toast-stress
```

---

## 📝 Notes

### Current Status (Post Vendor Optimization)
- ✅ Vendor chunking optimized (552 KB → 77 KB)
- ✅ Bundle budgets enforced
- ✅ Unit tests stabilized (6/6 passing)
- ⏸️ E2E tests pending (Phases 1-6)

### CI Threshold Overrides
If CI runners are slow, these overrides are acceptable:
```bash
VITALS_LCP_MS=3000 VITALS_INP_MS=120 VITALS_CLS=0.12
LAYOUT_100_MS=2500 DRAG_300_MIN_FPS=50
```

### Monitoring Post-Merge
- Sentry errors by release
- p75 LCP/INP/CLS (confirm no regressions)
- Bundle sizes (ensure no drift)
- Core Web Vitals dashboard

---

## 🚀 Getting Started

To begin Phase 1:
```bash
git checkout -b feat/canvas-v2.1-lazy-routes
# Implement lazy routes + error boundary
# Add E2E tests
# Open PR with Phase 1 checklist
```

Each phase should be a separate PR for easier review and rollback if needed.
