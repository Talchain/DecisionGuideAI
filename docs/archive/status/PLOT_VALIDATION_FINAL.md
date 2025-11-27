# Plot Canvas Validation - Final Implementation

## Status: ✅ SHIPPED TO MAIN

**Commit**: `c77890e` - Loud badge + exact probe + diag mode  
**Date**: Oct 14, 2025

---

## What Was Implemented

### 1. Loud Component Badge ✅
**Location**: Top-left, fixed position

```tsx
<div id="__plot_component_name__" style={{
  position: 'fixed', top: 8, left: 8, zIndex: 99999,
  background: '#111', color: '#0ff', padding: '6px 8px',
  fontSize: 12, fontFamily: 'monospace'
}}>
  ROUTE=/plot • COMPONENT=PlotWorkspace • COMMIT={shortSha}
</div>
```

**Purpose**: Proves we're in the correct component

### 2. Mount Log ✅
```javascript
console.log('[PLOT] route=/plot component=PlotWorkspace flags=', {
  PLC_LAB: "1",
  POC_ONLY: "0",
  PLOT_PLC_CANVAS: "1"
})
```

### 3. Exact Hit-Test Probe ✅
```javascript
const elm = (x, y) => document.elementsFromPoint(x, y)
  .map(e => ({ id: e.id, z: getComputedStyle(e).zIndex, pe: getComputedStyle(e).pointerEvents }))
const rightMid = elm(innerWidth * 0.75, innerHeight * 0.5)
console.log('[PLOT:DIAG]', { hitRightMid: rightMid.slice(0, 4) })

const top = rightMid[0]
if (top?.id !== 'plot-canvas-root') {
  console.error('[PLOT:ASSERT] Canvas not top at right-middle. Top=', top)
}
```

**Expected**: `plot-canvas-root` is the top element

### 4. CSS Guardrails with !important ✅
**File**: `src/styles/plot.css`

```css
#plot-canvas-root { pointer-events: auto !important; z-index: 10 !important; }
#whiteboard-layer { pointer-events: none !important; z-index: 1 !important; }
#plot-right-rail { pointer-events: none !important; z-index: 20 !important; }
.plot-rail-content { pointer-events: auto !important; }
#plot-chrome { pointer-events: none !important; z-index: 15 !important; }
#plot-controls { pointer-events: auto !important; }
```

### 5. Diag Mode Kill Switch ✅
**URL**: `/#/plot?diag=1`

```tsx
const isDiagMode = new URLSearchParams(window.location.hash.split('?')[1] || '').get('diag') === '1'

// ...

{!isDiagMode && (
  <aside id="plot-right-rail" className="plot-rail">
    <div className="plot-rail-content">
      <ResultsPanel />
    </div>
  </aside>
)}
```

**Purpose**: Removes right rail completely to prove canvas is accessible

### 6. Production Smoke Tests ✅
**File**: `e2e/plot.production.spec.ts`

Tests against `https://olumi.netlify.app`:
- Badge exists and shows correct info
- Diag mode: canvas is top element
- Diag mode: rail not rendered
- Normal mode: correct diagnostics
- Normal mode: no assertion errors
- Normal mode: canvas accessible

---

## Validation Checklist

### After Netlify Deploy

**1. Check /version.json**:
```bash
curl https://olumi.netlify.app/version.json
# Should show commit c77890e or later
```

**2. Load /#/plot?diag=1 (Diag Mode)**:

Open https://olumi.netlify.app/#/plot?diag=1

**Visual**:
- ✅ Black badge top-left: `ROUTE=/plot • COMPONENT=PlotWorkspace • COMMIT=c77890e`
- ✅ No right panel visible
- ✅ Canvas fills entire viewport

**Console**:
```javascript
[PLOT] route=/plot component=PlotWorkspace flags= {PLC_LAB: "1", ...}
[PLOT:DIAG] {hitRightMid: [{id: "plot-canvas-root", z: "10", pe: "auto"}, ...]}
// Should NOT see [PLOT:ASSERT] error
```

**Interaction**:
- ✅ Drag/pan/zoom works across ENTIRE right side
- ✅ No dead zones
- ✅ No snap-back

**3. Load /#/plot (Normal Mode)**:

Open https://olumi.netlify.app/#/plot

**Visual**:
- ✅ Black badge top-left shows component name
- ✅ Right panel visible and scrollable

**Console**:
```javascript
[PLOT] route=/plot component=PlotWorkspace flags= {...}
[PLOT:DIAG] {hitRightMid: [
  {id: "plot-canvas-root", z: "10", pe: "auto"},  // ← Canvas on top
  {id: "plot-right-rail", z: "20", pe: "none"},   // ← Rail transparent
  ...
]}
// Should NOT see [PLOT:ASSERT] error
```

**Manual Probe**:
```javascript
// Run in console
const elm = (x,y) => document.elementsFromPoint(x,y)
  .map(e => ({id: e.id, z: getComputedStyle(e).zIndex, pe: getComputedStyle(e).pointerEvents}))
elm(innerWidth * 0.75, innerHeight * 0.5)

// EXPECTED:
// [{id: "plot-canvas-root", z: "10", pe: "auto"}, ...]  ← Canvas first
// Rail should have pe: "none" if present in list
```

**Interaction**:
- ✅ Drag/pan/zoom works everywhere (including right side)
- ✅ Right panel scrollable and interactive
- ✅ No dead zones
- ✅ No snap-back

**4. Run E2E Tests**:

```bash
# Local tests
npm run test:e2e -- plot.interactions

# Production smoke tests
npm run test:e2e -- plot.production
```

All tests should pass.

---

## Success Criteria

### ✅ Must All Pass

1. **Badge visible**: Shows `COMPONENT=PlotWorkspace` and commit SHA
2. **Mount log**: `[PLOT] route=/plot component=PlotWorkspace` in console
3. **Diag output**: `[PLOT:DIAG] {hitRightMid: ...}` in console
4. **No assertions**: No `[PLOT:ASSERT]` errors in console
5. **Canvas on top**: `plot-canvas-root` is first element in hit test
6. **Rail transparent**: `plot-right-rail` has `pe: "none"` if present
7. **Diag mode works**: `?diag=1` removes rail, canvas fully accessible
8. **Interactions work**: Drag/pan/zoom everywhere, no dead zones
9. **E2E tests pass**: Both local and production tests green

---

## Architecture

### Z-Index Stack (Enforced by CSS)
```
z:1  → #whiteboard-layer (pe:none)
z:10 → #plot-canvas-root (pe:auto) ← INTERACTIVE
z:15 → #plot-chrome (pe:none)
z:20 → #plot-right-rail (pe:none, inner .plot-rail-content pe:auto)
```

### Pointer Events Pattern
```
Container: pe:none (transparent)
  ↓
Canvas: pe:auto (captures events)
  ↓
Inner Content: pe:auto (also captures, smaller hitbox)
```

### CSS Enforcement
- `!important` on all rules prevents inline style overrides
- Class-based pattern (`.plot-rail-content`) for inner content
- Element IDs for layer identification

---

## Diagnostic Reference

### Console Logs

**`[PLOT]`** - Mount log
- Shows component name, flags
- Runs once on mount
- Format: `[PLOT] route=/plot component=PlotWorkspace flags= {...}`

**`[PLOT:DIAG]`** - Hit-test probe
- Shows top 4 elements at right-middle
- Runs once after mount
- Format: `[PLOT:DIAG] {hitRightMid: [{id, z, pe}, ...]}`

**`[PLOT:ASSERT]`** - Error if regression
- Only appears if canvas is NOT top element
- Format: `[PLOT:ASSERT] Canvas not top at right-middle. Top= {...}`

### Diag Mode

**Enable**: `/#/plot?diag=1`

**Effect**:
- Right rail completely removed from DOM
- Canvas fills entire viewport
- Proves canvas is accessible when rail absent

**Use case**: Isolate whether rail is causing issues

---

## Troubleshooting

### If [PLOT:ASSERT] appears:

1. Check CSS is loaded:
   ```javascript
   getComputedStyle(document.getElementById('plot-canvas-root')).pointerEvents
   // Should be "auto"
   
   getComputedStyle(document.getElementById('plot-right-rail')).pointerEvents
   // Should be "none"
   ```

2. Check element order:
   ```javascript
   document.elementsFromPoint(innerWidth * 0.75, innerHeight * 0.5)
     .slice(0, 5)
     .map(e => e.id)
   // Should show plot-canvas-root first or early
   ```

3. Try diag mode:
   ```
   /#/plot?diag=1
   ```
   If interactions work in diag mode, rail is the issue.

### If interactions don't work in diag mode:

- Check PLC canvas is mounted:
  ```javascript
  !!document.querySelector('[data-testid="plc-canvas-adapter"]')
  // Should be true
  ```

- Check canvas pointer events:
  ```javascript
  getComputedStyle(document.getElementById('plot-canvas-root')).pointerEvents
  // Should be "auto"
  ```

---

## Files Changed

1. **`src/routes/PlotWorkspace.tsx`**:
   - Added loud badge
   - Added mount log
   - Added exact hit-test probe
   - Added diag mode guard
   - Updated right rail markup

2. **`src/styles/plot.css`**:
   - Updated all rules with `!important`
   - Added `#plot-controls` rule
   - Simplified and clarified

3. **`e2e/plot.production.spec.ts`** (NEW):
   - Production smoke tests
   - Tests against live deployment
   - Validates badge, diagnostics, interactions

---

## Summary

**Complete validation solution** for `/plot` canvas:
- ✅ Loud badge proves component identity
- ✅ Mount log confirms correct component
- ✅ Exact hit-test probe validates DOM state
- ✅ CSS guardrails with `!important` prevent regressions
- ✅ Diag mode (`?diag=1`) isolates issues
- ✅ Production smoke tests validate live deployment
- ✅ Comprehensive diagnostics in console

**Next action**: Wait for Netlify deploy, then:
1. Check badge shows correct commit
2. Verify console shows `[PLOT:DIAG]` with canvas on top
3. Test interactions in both normal and diag modes
4. Run E2E tests

**Key validation**: Console must show `hitRightMid[0].id === "plot-canvas-root"` and NO `[PLOT:ASSERT]` errors.
