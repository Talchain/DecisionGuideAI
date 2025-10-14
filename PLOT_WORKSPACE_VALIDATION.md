# PlotWorkspace PLC Integration - Validation

## Status: ✅ DEPLOYED TO MAIN

**Hotfix**: `c912de0` - Force PLC ON  
**Revert**: `8ff8b73` - Env flag check  
**Date**: Oct 14, 2025

---

## Critical Discovery

**`/#/plot` routes to `PlotWorkspace.tsx`, NOT `PlotShowcase.tsx`**

Route in `AppPoC.tsx`:
```typescript
<Route path="/plot" element={<PlotWorkspace />} />
<Route path="/plot-legacy" element={<PlotShowcase />} />
```

---

## Changes Made

### Hotfix (c912de0)
1. ✅ Boot diagnostic console.log
2. ✅ Blue badge at top-right (proves component mounted)
3. ✅ Imported PlcCanvasAdapter
4. ✅ `USE_PLC_CANVAS = true` (forced)
5. ✅ Replaced DecisionGraphLayer with PLC adapter
6. ✅ Added `data-testid="plc-canvas-adapter"` with `zIndex: 10`

### Revert (8ff8b73)
1. ✅ `USE_PLC_CANVAS = String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS) === '1'`
2. ✅ Kept all diagnostics, badge, testid

---

## Validation Checklist

### Visual
- [ ] Blue badge visible top-right: `PLOT ROUTE LIVE · PLC_LAB=1 · POC_ONLY=0 · PLOT_PLC_CANVAS=1`

### Console
```javascript
// Boot line
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1

// Adapter present
!!document.querySelector('[data-testid="plc-canvas-adapter"]')  // true
```

### Network
- [ ] `PlcCanvas-*.js` loads (200)
- [ ] `PlcLab-*.js` loads (200)

### Interactions
- [ ] Canvas visible immediately
- [ ] Drag/zoom work
- [ ] No overlay blocking
- [ ] No console errors

---

## Build ✅

```bash
$ npm run build:ci
✓ built in 17.78s
[ASSERT] ✅ PLC chunks present: PlcCanvas-Dj6EyOWk.js, PlcLab-DaHMJzid.js
```

---

## Rollback

If issues:
```bash
git revert 8ff8b73 c912de0
git push origin main
```

Or disable flag in Netlify:
```
VITE_FEATURE_PLOT_USES_PLC_CANVAS = "0"
```
