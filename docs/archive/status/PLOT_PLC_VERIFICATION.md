# Plot PLC Adapter - Verification Checklist

## Deployment Status: ✅ PUSHED TO MAIN

**Commit**: `5ff74da` - feat(plot): wire PlcCanvasAdapter via flag + boot diag  
**Branch**: `main`  
**Date**: October 14, 2025

---

## Changes Made

### 1. Boot Diagnostic Added
**File**: `src/routes/PlotShowcase.tsx`

Added console.log at component mount:
```typescript
console.log(
  '[BOOT] mode=POC route=#/plot PLC_LAB=%s POC_ONLY=%s PLOT_PLC_CANVAS=%s',
  import.meta.env.VITE_PLC_LAB,
  import.meta.env.VITE_POC_ONLY,
  import.meta.env.VITE_FEATURE_PLOT_USES_PLC_CANVAS
)
```

### 2. Conditional Rendering (Already in Place)
```typescript
const USE_PLC_CANVAS = (import.meta as any)?.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS === '1'

// In render:
{USE_PLC_CANVAS ? (
  <PlcCanvasAdapter
    nodes={nodes}
    edges={edges}
    localEdits={localEdits}
    onNodesChange={setNodes}
    onEdgesChange={setEdges}
  />
) : (
  <GraphCanvas
    nodes={nodes}
    edges={edges}
    localEdits={localEdits}
    onNodesChange={setNodes}
    onEdgesChange={setEdges}
  />
)}
```

### 3. Z-Index Guard (Already in Place)
**File**: `src/plot/adapters/PlcCanvasAdapter.tsx`

```typescript
<div 
  data-testid="plc-canvas-adapter"
  style={{ position: 'relative', zIndex: 10 }}
>
  <PlcCanvas {...props} />
</div>
```

---

## Build Verification ✅

```bash
$ npm run build:ci
✓ built in 5.45s
[ASSERT] ✅ PLC chunks present: PlcCanvas-Dj6EyOWk.js, PlcLab-DaHMJzid.js
```

**Bundle Sizes**:
- AppPoC: 247.30 kB (gzip: 67.04 kB)
- PlcCanvas: 3.70 kB (gzip: 1.78 kB)
- PlcLab: 4.13 kB (gzip: 1.52 kB)

---

## Netlify Configuration ✅

**File**: `netlify.toml`

```toml
[build]
  command = "npm run build:ci && echo '{...}' > dist/version.json"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
  VITE_PLC_LAB = "1"
  VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"
  VITE_POC_ONLY = "0"
```

---

## Next Steps: Netlify Deployment

### 1. Trigger Deploy
1. Go to: https://app.netlify.com/sites/olumi/deploys
2. Click: **Trigger deploy** → **Clear cache and deploy site**
3. Wait for build to complete (~2-3 minutes)

### 2. Verify Deploy Log
Look for:
```
$ npm run build:ci
...
[ASSERT] ✅ PLC chunks present: PlcCanvas-*.js, PlcLab-*.js
```

### 3. Check version.json
Visit: https://olumi.netlify.app/version.json

Verify:
```json
{
  "commit": "5ff74da...",
  "short": "5ff74da",
  "branch": "main",
  "timestamp": "2025-10-14T..."
}
```

**Expected**: `commit` matches GitHub main HEAD (`5ff74da`)

---

## Browser Verification

### Test 1: Console Boot Diagnostic
1. Visit: https://olumi.netlify.app/#/plot
2. Open DevTools Console (F12)
3. Look for:
   ```
   [BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
   ```

**Expected**: All three flags show `1` or `0` (not `undefined`)

### Test 2: Network Tab - PLC Chunks
1. Open DevTools Network tab
2. Filter: JS
3. Reload page
4. Look for:
   - `PlcCanvas-*.js` (should load)
   - `PlcLab-*.js` (should load)

**Expected**: Both chunks load successfully (200 status)

### Test 3: Canvas Interaction
1. Click "Run" button
2. Wait for graph to appear
3. Test interactions:
   - [ ] Drag canvas (pans smoothly)
   - [ ] Zoom with mouse wheel (clamped 0.25-3x)
   - [ ] Click nodes (selectable)
   - [ ] No "sad face" icon
   - [ ] No overlay blocking center area

**Expected**: All interactions work smoothly

### Test 4: Visual Inspection
1. Check for `data-testid="plc-canvas-adapter"` in DOM
2. Verify z-index: 10 on adapter wrapper
3. No console errors

**Expected**: Clean console, proper z-index

---

## Troubleshooting

### Issue: Console shows `PLOT_PLC_CANVAS=undefined`
**Cause**: Netlify env var not set or wrong format  
**Fix**: 
1. Go to Netlify → Site settings → Environment variables
2. Verify: `VITE_FEATURE_PLOT_USES_PLC_CANVAS` = `1` (string "1", no quotes in UI)
3. Redeploy with cache clear

### Issue: Console shows correct flags but canvas looks legacy
**Cause**: Flag check logic issue  
**Fix**: Temporarily force adapter:
```typescript
// In PlotShowcase.tsx, temporarily change:
{true ? (  // was: {USE_PLC_CANVAS ? (
  <PlcCanvasAdapter ... />
```
Deploy, verify PLC behavior, then revert.

### Issue: PLC chunks not in Network tab
**Cause**: Tree-shaking or lazy load issue  
**Fix**: Verify import at top of PlotShowcase.tsx:
```typescript
import { PlcCanvasAdapter } from '../plot/adapters/PlcCanvasAdapter'
```
Should be direct import, not lazy-loaded.

### Issue: Canvas not interactive
**Cause**: Z-index or pointer-events issue  
**Fix**: Check PlcCanvasAdapter wrapper has:
```typescript
style={{ position: 'relative', zIndex: 10 }}
```
And no decorative overlays have higher z-index.

---

## Success Criteria (All Must Pass)

- [ ] **Deploy log** shows `[ASSERT] ✅ PLC chunks present`
- [ ] **version.json** commit matches `5ff74da`
- [ ] **Console** shows `[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1`
- [ ] **Network tab** shows `PlcCanvas-*.js` and `PlcLab-*.js` loaded
- [ ] **Canvas** is interactive (drag, zoom, select work)
- [ ] **No errors** in console
- [ ] **No overlay** blocking center area

---

## Rollback Plan (If Needed)

If issues arise:

```bash
# Revert the commit
git revert 5ff74da

# Push to main
git push origin main

# Trigger Netlify deploy
```

Or temporarily disable flag in Netlify:
1. Set `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "0"`
2. Redeploy with cache clear
3. This will use legacy GraphCanvas

---

## Additional Notes

### Local Testing
To test locally with same flags:
```bash
# .env.local
VITE_PLC_LAB=1
VITE_FEATURE_PLOT_USES_PLC_CANVAS=1
VITE_POC_ONLY=0

# Run dev server
npm run dev

# Visit: http://localhost:5173/#/plot
# Console should show: [BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

### Performance Baseline
- **Route init**: <500ms
- **Canvas render**: <200ms
- **Interaction response**: <16ms (60fps)
- **Bundle size**: ~67 kB gzipped

---

**Status**: ✅ Ready for Netlify deployment  
**Next Action**: Trigger deploy with cache clear and verify in browser
