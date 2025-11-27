# Production Verification Instructions

## Status: READY FOR VERIFICATION

**Latest Commit**: `483f2d8` - "fix(plot): ensure canvas wrapper has z-index:10 to prevent overlay blocking"

---

## What Was Fixed

### Z-Index Issue (Overlay Blocking Canvas)
**File**: `/src/plot/adapters/PlcCanvasAdapter.tsx`

**Change**:
```tsx
<div 
  data-testid="plc-canvas-adapter"
  style={{ position: 'relative', zIndex: 10 }}  // ✅ Added
>
```

**Why**: Ensures the PLC canvas interactive layer sits on top of any decorative elements in the PoC shell.

---

## Verification Steps (Execute These)

### Step 1: Wait for Netlify Deploy
**Action**: Wait for Netlify to build and deploy commit `483f2d8`

**Check**: https://app.netlify.com/sites/olumi/deploys

**Expected in deploy log**:
```
build.command from netlify.toml
$ npm run build:ci && echo '{...}' > dist/version.json

[ASSERT] ✅ PLC chunks present: PlcCanvas-*.js, PlcLab-*.js
```

---

### Step 2: Verify Runtime Signature
**URL**: https://olumi.netlify.app/#/plot

**Action**: Open DevTools Console

**Expected**:
```
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

**Verify**:
- ✅ `mode=POC` (rich PoC shell, not minimal PLC)
- ✅ `PLC_LAB=1` (PLC Lab enabled for /#/plc)
- ✅ `POC_ONLY=0` (NOT PoC-only build)
- ✅ `PLOT_PLC_CANVAS=1` (PLC canvas enabled)

---

### Step 3: Network Check
**Action**: DevTools → Network → Filter by JS

**Expected**:
- ✅ `PlcCanvas-*.js` loaded
- ✅ `PlcLab-*.js` loaded

---

### Step 4: Smoke Test - Add Node
**Steps**:
1. Go to https://olumi.netlify.app/#/plot
2. Wait for graph to load
3. Click "Add Node" button 3 times

**Expected**:
- ✅ Node count increases by **exactly 1** each time
- ✅ Nodes appear at deterministic positions
- ✅ No duplicates

**If fails**: Adapter not wired correctly or handlers missing

---

### Step 5: Smoke Test - Zoom
**Steps**:
1. Scroll mouse wheel to zoom in
2. Scroll mouse wheel to zoom out
3. Click "Fit to Content" (if available)

**Expected**:
- ✅ Zoom is clamped (no infinite zoom)
- ✅ Canvas stays within bounds
- ✅ Fit works correctly

**If fails**: PLC canvas zoom logic not integrated

---

### Step 6: Overlay Bug Check
**Steps**:
1. Add 3 nodes
2. Try to click and drag a node
3. Try to select a node

**Expected**:
- ✅ Nodes are clickable
- ✅ Nodes are draggable
- ✅ No invisible overlay blocking interactions

**If fails**:
1. Inspect element in DevTools
2. Check for elements with `z-index > 10` or missing `pointer-events: none`
3. Report selector and computed styles

---

### Step 7: Controls State Check
**Steps**:
1. Look at toolbar buttons (Select, Connect, Undo, Redo)
2. Check if they're enabled/disabled appropriately

**Expected**:
- ✅ Buttons disabled if handlers not attached
- ✅ No "lying" UI (buttons that look clickable but do nothing)
- ✅ Clear visual feedback for state

**If fails**: Adapter not mapping toolbar actions correctly

---

### Step 8: Error Handling (Optional)
**Steps**:
1. Use DevTools to block or mock a 429 response
2. Add `Retry-After: 60` header
3. Trigger an action

**Expected**:
- ✅ Non-blocking countdown banner appears
- ✅ Shows retry time
- ✅ No auto-retry
- ✅ No "sad face" icon

---

## If Any Step Fails

### Scenario 1: Boot Line Shows `POC_ONLY=1`
**Cause**: Wrong build or environment override

**Fix**:
1. Check Netlify UI → Build settings → Clear "Build command" override
2. Check Environment variables for `VITE_POC_ONLY` override
3. Trigger "Clear cache and deploy site"

### Scenario 2: PlcCanvas-*.js Not Loaded
**Cause**: Tree-shaking or flag issue

**Fix**:
1. Verify `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"` in netlify.toml
2. Check PlotShowcase.tsx imports PlcCanvasAdapter
3. Rebuild locally: `npm run build:ci`

### Scenario 3: Nodes Not Clickable
**Cause**: Overlay blocking canvas

**Fix**:
1. Inspect element in DevTools
2. Find offending element selector
3. Add `pointer-events: none` to decorative elements
4. OR ensure canvas wrapper has higher z-index

### Scenario 4: Add Node Doesn't Work
**Cause**: Handlers not wired in adapter

**Fix**:
1. Check PlcCanvasAdapter.tsx `handleOp` function
2. Verify `onNodesChange` is called correctly
3. Check PlotShowcase.tsx passes `onNodesChange={setNodes}`

---

## Success Criteria

All of these must be ✅:

- [ ] Deploy log shows `[ASSERT] ✅ PLC chunks present`
- [ ] Console shows `[BOOT] mode=POC ... PLOT_PLC_CANVAS=1`
- [ ] Network shows `PlcCanvas-*.js` loaded
- [ ] Add Node increases count by 1 each time
- [ ] Zoom is clamped and works correctly
- [ ] Nodes are clickable and draggable (no overlay blocking)
- [ ] Controls show correct enabled/disabled state
- [ ] Error handling shows non-blocking banner (if tested)

---

## Quick Reference

### Production URL
- **Plot**: https://olumi.netlify.app/#/plot
- **PLC Lab**: https://olumi.netlify.app/#/plc

### Netlify Dashboard
- **Deploys**: https://app.netlify.com/sites/olumi/deploys
- **Build Settings**: https://app.netlify.com/sites/olumi/settings/deploys

### Local Testing
```bash
npm run build:ci  # Should show assertion passing
npm run dev       # Test locally at http://localhost:5173/#/plot
```

---

## Report Template

If you find issues, use this template:

```
### Issue: [Brief description]

**URL**: https://olumi.netlify.app/#/plot

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**: [What should happen]

**Actual**: [What actually happened]

**DevTools Info**:
- Console errors: [paste errors]
- Element selector: [paste selector]
- Computed styles: [paste relevant styles]

**Screenshot**: [attach if helpful]
```

---

**All fixes pushed to main. Ready for verification after Netlify deploy! ✅**
