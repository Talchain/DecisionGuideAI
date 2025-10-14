# Dual-Canvas Conflict Fix - Validation

## Status: ✅ DEPLOYED TO MAIN

**Commit**: `61ab0e5` - Eliminate dual-canvas conflict  
**Date**: Oct 14, 2025

---

## Root Cause Fixed

**Problem**: Two canvases were active simultaneously:
1. Legacy `DecisionGraphLayer` (with mouse handlers)
2. New `PlcCanvasAdapter` (PLC canvas)

**Symptoms**:
- Inputs don't work (pointer events captured by wrong layer)
- Nodes snap back to (0,0) (legacy effects resetting positions)
- "Split screen" feel (invisible pane blocking regions)
- Right panel clipped (overflow issues)

---

## Changes Made

### 1. Whiteboard → Visual Only ✅
**Before**: Active layer with mouse handlers  
**After**: Wrapped with `pointerEvents: 'none'`

```tsx
<div
  id="whiteboard-layer"
  aria-hidden="true"
  style={{
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none'  // ← KEY FIX
  }}
>
  <WhiteboardCanvas />
</div>
```

### 2. PLC Canvas → Single Source of Truth ✅
**Before**: `position: 'relative', zIndex: 10`  
**After**: `position: 'absolute', inset: 0, overflow: 'hidden'`

```tsx
<div
  id="plot-canvas-root"
  data-testid="plc-canvas-adapter"
  style={{
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    overflow: 'hidden'
  }}
>
  <PlcCanvasAdapter />
</div>
```

### 3. Chrome Layer → Pointer Events Managed ✅
**Before**: Toolbar/controls directly in tree  
**After**: Wrapped in `pointerEvents: 'none'` container, restore on controls

```tsx
<div
  id="plot-chrome"
  style={{
    position: 'absolute',
    inset: 0,
    zIndex: 15,
    pointerEvents: 'none'  // Default: no capture
  }}
>
  <div style={{ pointerEvents: 'auto' }}>  {/* Restore for toolbar */}
    <PlotToolbar />
  </div>
</div>
```

### 4. Right Panel → Fixed Positioning ✅
**Before**: Relative positioning, clipped by ancestor  
**After**: Absolute with own scroll

```tsx
<div
  id="plot-right-rail"
  style={{
    position: 'absolute',
    top: 'var(--topbar-h, 56px)',
    right: 0,
    bottom: 0,
    width: '360px',
    overflowY: 'auto',
    zIndex: 20,
    pointerEvents: 'auto'
  }}
>
  <ResultsPanel />
</div>
```

### 5. Top Controls → Pointer Events Restored ✅
```tsx
<div className="..." style={{ pointerEvents: 'auto' }}>
  <div className="bg-white ...">
    {/* Template, Seed, Run button */}
  </div>
</div>
```

### 6. Container → overflow-visible ✅
**Before**: `overflow-hidden` (clipped right panel)  
**After**: `overflow-visible`

```tsx
<div className="flex-1 relative overflow-visible">
```

---

## Z-Index Layering (Bottom to Top)

```
z-index: 1   → Whiteboard (visual only, pointerEvents: none)
z-index: 10  → PLC Canvas (interactive, single source of truth)
z-index: 15  → Chrome layer (pointerEvents: none, except toolbar)
z-index: 20  → Right panel + Top controls (pointerEvents: auto)
z-index: 9999 → Debug badge (always visible)
```

---

## Validation Checklist

### After Netlify Deploy

**1. Visual Check** (https://olumi.netlify.app/#/plot):
- [ ] Blue badge visible (proves correct component)
- [ ] Canvas fills viewport
- [ ] Right panel visible and scrollable
- [ ] No clipping

**2. Console Check**:
```javascript
// Boot line
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1

// Adapter present
!!document.querySelector('[data-testid="plc-canvas-adapter"]')  // true

// Hit test - right middle of screen
const probe = (x,y) => document.elementsFromPoint(x,y).map(e => 
  [e.id, e.tagName, getComputedStyle(e).pointerEvents, getComputedStyle(e).zIndex]
)
probe(innerWidth * 0.75, innerHeight * 0.5)
// Should show: plot-canvas-root with pointerEvents: auto (or default)
```

**3. Interaction Tests**:
- [ ] **Drag nodes** → smooth, no snap-back to (0,0)
- [ ] **Pan canvas** → works across entire viewport
- [ ] **Zoom** → works everywhere
- [ ] **Click toolbar** → buttons respond
- [ ] **Click Run** → generates nodes
- [ ] **Scroll right panel** → scrolls smoothly
- [ ] **No "barrier"** → can interact anywhere on canvas

**4. Network Check**:
- [ ] `PlcCanvas-*.js` loads (200)
- [ ] `PlcLab-*.js` loads (200)

**5. No Console Errors**:
- [ ] No errors about pointer events
- [ ] No warnings about z-index
- [ ] No position reset errors

---

## Expected Behavior After Fix

### ✅ Should Work
- Drag nodes anywhere on canvas
- Pan canvas smoothly
- Zoom in/out
- Click toolbar buttons
- Click Run button
- Scroll right panel
- Add nodes via toolbar
- Select nodes

### ❌ Should NOT Happen
- Nodes snapping to (0,0)
- "Dead zones" where clicks don't register
- Split-screen feel
- Right panel clipped
- Inputs not responding
- Canvas fighting for control

---

## Diagnostics Kept

1. ✅ Blue badge (top-right)
2. ✅ `[BOOT]` console log
3. ✅ `data-testid="plc-canvas-adapter"`
4. ✅ Element IDs for debugging:
   - `#whiteboard-layer`
   - `#plot-canvas-root`
   - `#plot-chrome`
   - `#plot-right-rail`

---

## Build Verification ✅

```bash
$ npm run build:ci
✓ built in 7.61s
[ASSERT] ✅ PLC chunks present: PlcCanvas-Dj6EyOWk.js, PlcLab-DaHMJzid.js
```

---

## Rollback Plan

If issues persist:

```bash
git revert 61ab0e5
git push origin main
```

Or disable PLC flag:
```
VITE_FEATURE_PLOT_USES_PLC_CANVAS = "0"
```

---

## Key Insights

1. **Single Canvas Rule**: Only ONE interactive canvas at a time
2. **Pointer Events Hierarchy**: Default `none`, restore on controls
3. **Z-Index Discipline**: Canvas at 10, chrome at 15+, controls at 20+
4. **Absolute Positioning**: For overlays that need own scroll
5. **Visual Layers**: Can exist with `pointerEvents: none`

---

**Status**: ✅ Fix deployed, awaiting validation  
**Next**: Verify on live site using checklist above
