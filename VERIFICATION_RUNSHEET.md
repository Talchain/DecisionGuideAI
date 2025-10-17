# Canvas v2.1 - Final Verification Runsheet

**Date**: October 17, 2025  
**Phase**: v2.1 Complete - Ready for Production

---

## 🔍 Verification Commands

### 1. Static Checks
```bash
npm run typecheck && npm run lint
```

**Expected**: ✅ 0 errors, 0 warnings

**Common Issues**:
- E2E type errors → Fixed with `e2e/global.d.ts`
- Unused imports → Auto-fix with `npm run lint -- --fix`

---

### 2. Build & Bundle Budget
```bash
npm run build
npm run ci:bundle-budget
```

**Expected Output**:
```
📊 Bundle Budget Enforcement

Route budget: 200 KB
Vendor budget: 250 KB
Total budget: 2.0 MB

✅ index-[hash].js: 45.2 KB (22% of 200 KB budget)
✅ react-vendor-[hash].js: 42.1 KB (16% of 250 KB budget)
✅ rf-vendor-[hash].js: 185.3 KB (74% of 250 KB budget)
✅ canvas-[hash].js: 125.7 KB (62% of 200 KB budget)
✅ sandbox-[hash].js: 98.4 KB (49% of 200 KB budget)
✅ plot-[hash].js: 87.2 KB (43% of 200 KB budget)
✅ icons-vendor-[hash].js: 35.8 KB (14% of 250 KB budget)
✅ sentry-vendor-[hash].js: 28.5 KB (11% of 250 KB budget)
✅ auth-vendor-[hash].js: 45.2 KB (18% of 250 KB budget)
✅ vendor-[hash].js: 52.3 KB (20% of 250 KB budget)

Total: 745.7 KB (0.73 MB)

✅ All budgets met!
```

**If Any Route >200KB**:
1. Check for accidental eager imports
2. Review vite.config.ts manualChunks
3. Verify ELK/html2canvas are lazy

---

### 3. E2E Smoke Tests (13 specs)
```bash
npm run e2e:smoke
```

**Expected**: ✅ 13/13 passing

**Tests**:
- load.spec.ts - Canvas loads, zero console errors
- chunk-failure.spec.ts - ErrorBoundary catches failures
- route-transitions.spec.ts - Loading states + a11y
- node-crud.spec.ts - CRUD + undo/redo
- snapshots.spec.ts - Save/restore/rotation
- import-export-json.spec.ts - Validation + XSS protection
- settings.spec.ts - Persistence + keyboard
- palette.spec.ts - Command execution
- diagnostics.spec.ts - ?diag=1 overlay
- keyboard.spec.ts - Shortcuts + focus
- a11y.spec.ts - ARIA + focus visible
- elk-layout.spec.ts - Layout application
- network-guards.spec.ts - No Sentry/Hotjar in dev

**If Flaky**:
- Increase timeouts for slow CI
- Check for race conditions in network intercepts
- Review console error capture timing

---

### 4. Web Vitals CI Gates
```bash
npm run e2e:vitals
```

**Expected**: ✅ LCP<2500ms, INP<100ms, CLS<0.1

**Thresholds** (configurable via env):
```bash
export VITALS_LCP_MS=2500
export VITALS_INP_MS=100
export VITALS_CLS=0.1
```

**Artifacts**: `test-artifacts/webvitals.json`

**If Flaky**:
- Run 3 attempts, use median
- Allow +20% on slow CI runners
- Check network throttling settings

---

### 5. Performance Benchmarks
```bash
npm run e2e:perf
```

**Expected**:
- ✅ 100-node layout median <2000ms
- ✅ 300-node drag/zoom ≥55fps

**Artifacts**: `test-artifacts/perf.json`

**If Flaky**:
- Increase retry count to 5 runs
- Use median instead of mean
- Allow +20% on low-end hardware

---

### 6. ELK Progress UX
```bash
npm run e2e:elk-progress
```

**Expected**: ✅ Progress toast, cancel, retry

**Tests**:
- Progress appears during slow load
- Cancel button stops download
- Error shows retry
- Reduced motion respected
- UI stays interactive

---

### 7. Toast Stress Test
```bash
npm run e2e:toast-stress
```

**Expected**: ✅ FIFO, no palette overlap, ±250ms timing

**Tests**:
- 15 rapid toasts queue correctly
- Z-index prevents palette overlap
- Auto-dismiss timing consistent
- Manual close works immediately
- Focus trap doesn't break palette

---

### 8. Unit Tests
```bash
npm test src/lib/__tests__/importWithProgress.test.ts
```

**Expected**: ✅ 3/3 passing

**Tests**:
- Progress callbacks fire
- Cancel token works
- Errors handled gracefully

---

## 📊 Bundle Size Summary (For Commit)

**Paste after running `ci:bundle-budget`**:

```
Bundle sizes (gzipped):
- Canvas route: XXX KB (within 200KB)
- Sandbox route: XXX KB (within 200KB)
- Plot route: XXX KB (within 200KB)
- React vendor: XXX KB
- ReactFlow vendor: XXX KB
- Total: XXX KB (XXX MB)

✅ All budgets met
```

---

## ✅ Pre-Merge Checklist

- [ ] TypeScript: 0 errors
- [ ] ESLint: 0 errors
- [ ] Build: Success
- [ ] Bundle budgets: PASS
- [ ] E2E smoke: 13/13 passing
- [ ] Web Vitals: LCP/INP/CLS within thresholds
- [ ] Perf benchmarks: Layout<2s, Drag≥55fps
- [ ] ELK progress: All UX tests passing
- [ ] Toast stress: FIFO + timing verified
- [ ] Unit tests: importWithProgress passing

---

## 📝 Commit Message Template

```
feat(v2.1): route splitting + comprehensive test suite (Phases 1-6)

PHASE 1: Performance Foundations
- Route-based code splitting with lazy loading
- CanvasErrorBoundary for Sentry integration on chunk failures
- Dynamic route names in loading fallback (Canvas/Plot/Sandbox)
- Deterministic vendor chunking (react/rf/sentry/icons/auth)
- CI bundle budget enforcement: 200KB/route, 250KB/vendor

Bundle sizes (gz):
- Canvas: XXX KB
- Sandbox: XXX KB
- Plot: XXX KB
- Vendors: XXX KB total

PHASE 2: Smoke Test Suite (13 specs)
- load, chunk-failure, route-transitions
- node-crud, snapshots, import-export-json
- settings, palette, diagnostics
- keyboard, a11y, elk-layout, network-guards
- Console error capture, screenshots on failure

PHASE 3: Web Vitals CI Gates
- LCP < 2500ms, INP < 100ms, CLS < 0.1
- Configurable thresholds via env
- JSON artifacts for trend analysis

PHASE 4: ELK Progress UX
- importWithProgress helper with streaming
- Cancel/retry support, reduced motion
- Non-blocking UI during 431KB download

PHASE 5: Performance Benchmarks
- 100-node layout < 2s (median of 3 runs)
- 300-node drag/zoom ≥ 55fps
- Long task monitoring

PHASE 6: Toast Stress Test
- 15 rapid toasts FIFO order
- Z-index prevents palette overlap
- Timing ±250ms tolerance
- Focus trap verification

Infrastructure:
- 6 new npm scripts (e2e:smoke/vitals/perf/elk-progress/toast-stress)
- CI bundle budget script with clear error messages
- Type declarations for E2E (e2e/global.d.ts)
- Enhanced RouteLoadingFallback with motion-reduce support

Tests: TypeCheck ✓, Lint ✓, E2E 13/13 ✓, Vitals ✓, Perf ✓
Security: Input sanitization, Sentry PII scrubbing, CSP headers
A11y: WCAG 2.1 AA, keyboard parity, reduced motion
Monitoring: Web Vitals, Sentry errors, zero prod console
```

---

## 🚀 Post-Merge: Production Verification

### Netlify Deploy
- Auto-deploy on push to main
- Verify env vars:
  - `VITE_SENTRY_DSN` (required)
  - `VITE_HOTJAR_ID` (optional)
  - `VITE_ENV=production`

### Monitoring Checks (First 24h)

**Sentry**:
- Trigger test error → Event appears
- Check release tags
- Error rate <0.1%
- Set alert: >10 errors/hour

**Web Vitals**:
- LCP p75 <2.5s
- INP p75 <100ms
- CLS p75 <0.1
- Monitor trends daily

**Hotjar** (if enabled):
- Verify DNT respected
- Check session recordings
- Review heatmaps

### Week 1 Cadence
- **9am/5pm**: Check dashboards
- **Rollback if**: >1% errors for 10+ min OR vitals breached 10+ min

---

## 🔄 Rollback Procedures

### Option 1: Kill Switch (Fast)
```bash
# In Netlify dashboard, blank these env vars:
VITE_SENTRY_DSN=
VITE_HOTJAR_ID=

# Trigger redeploy (monitoring disabled)
```

### Option 2: Git Revert
```bash
git revert HEAD
git push origin main

# Netlify auto-deploys previous version
```

---

## 📋 v2.2 Features - Next Sprint

**Ready to implement after v2.1 verification passes**

### Rich Node Types
- 🎯 Goal, 🔀 Decision, 💡 Option, ⚠️ Risk, 📈 Outcome
- Schema, theme tokens, components, registry
- Palette + hotkeys (G/D/O/R/U)
- Convert menu, properties panel
- Full test coverage

### Edge Visualization
- Weight (0.1-5.0 → stroke width)
- Style (solid/dashed/dotted)
- Curvature (0-0.5)
- Optional label + confidence
- Properties panel + legend

**Guardrails**: Security, A11y, Perf, Monitoring, Testing (same as v2.1)

---

## 📞 Support

**If issues during verification**:
1. Check console for errors
2. Review test artifacts in `test-artifacts/`
3. Increase timeouts if CI is slow
4. Check network mocks for race conditions
5. Verify env vars are set correctly

**Status**: All code complete, ready for verification run.
