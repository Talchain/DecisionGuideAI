# PLC/Legacy Canvas Gating - SHIPPED ✅

**Commit**: `19d3289`  
**Date**: Oct 15, 2025  
**Status**: Deployed to Netlify

---

## 🎯 Mission Complete

PLC/Legacy canvas gating is production-ready, fully tested, and deployed.

## ✅ Acceptance Criteria

- **GATES: PASS** — unit/ts/lint/build green
- **GATES: PASS** — E2E gating (5/5 tests) green
- **GATES: PASS** — flags-off parity (both canvases mount cleanly)
- **GATES: PASS** — badge reflects source and mode

## 📊 Test Results

```bash
✅ Unit Tests: 5/5 passed (resolvePlcOverride)
✅ TypeScript: PASS
✅ Lint: PASS
✅ Build: PASS (5.43s)
✅ E2E Tests: 5/5 passed (5.0s)
```

### E2E Test Coverage
1. ✅ `?plc=1` forces PLC canvas
2. ✅ `?plc=0` forces Legacy canvas
3. ✅ localStorage precedence over env
4. ✅ Hash toggle updates view without reload
5. ✅ Diag mode removes rail

## 📝 Files Changed

- `e2e/plot.gating.spec.ts` - Rewritten with relative URLs, 5 focused tests
- `docs/plot-gating.md` - NEW: Usage guide, precedence, troubleshooting

## 🚀 Post-Deploy Smoke Tests

Visit these URLs to verify deployment:

### Force PLC
```
https://olumi.netlify.app/#/plot?plc=1
```
**Expected**: 
- PLC canvas visible
- Badge shows `CANVAS=PLC • SRC=url`

### Force Legacy
```
https://olumi.netlify.app/#/plot?plc=0
```
**Expected**:
- Legacy canvas visible
- Badge shows `CANVAS=Legacy • SRC=url`

### localStorage Persistence
```javascript
// In browser console at https://olumi.netlify.app/#/plot
localStorage.setItem('PLOT_USE_PLC', '1')
// Refresh page
```
**Expected**:
- PLC canvas visible
- Badge shows `CANVAS=PLC • SRC=localStorage`

### Default (env)
```javascript
// Clear localStorage
localStorage.removeItem('PLOT_USE_PLC')
// Visit https://olumi.netlify.app/#/plot
```
**Expected**:
- Legacy canvas visible (current env default)
- Badge shows `CANVAS=Legacy • SRC=env`

## 🔧 Implementation Details

### Precedence Order
1. **URL** `?plc=1|0` (highest)
2. **localStorage** `PLOT_USE_PLC="1"|"0"`
3. **Environment** `VITE_FEATURE_PLOT_USES_PLC_CANVAS` (lowest)

### Reactive Gating
- Uses `useState` + `useEffect` with hashchange/popstate listeners
- Micro-poller (400ms) catches client-side navigation
- No page reload required for hash changes

### Badge
- Top-left corner
- Format: `CANVAS=Legacy|PLC • SRC=url|localStorage|env`
- Always visible for debugging

### Console Log
```
[PLOT] route=/plot component=PlotWorkspace canvas=Legacy source=url
```

## 📚 Documentation

See `docs/plot-gating.md` for:
- How to force modes
- Precedence explanation
- Badge legend
- Troubleshooting guide

## 🎁 Next Steps

With gating complete and tested, we're unblocked to:
1. Build React Flow canvas layer
2. Add sketch overlay
3. Implement collaboration features

## 🔄 Rollback Plan

If issues arise:
```bash
# Force legacy for all users via Netlify env
VITE_FEATURE_PLOT_USES_PLC_CANVAS=0

# Or revert commit
git revert 19d3289
git push origin main
```

---

**Status**: ✅ PRODUCTION READY  
**Netlify**: Auto-deployed  
**Tests**: All green  
**Docs**: Complete
