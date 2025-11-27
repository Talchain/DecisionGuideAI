# Production Verification Checklist

## Goal
Verify latest main is live, /#/plot uses PLC canvas, and no regressions.

---

## 1. Build Signature ✅

### Netlify Deploy Log Check
**URL**: https://app.netlify.com/sites/olumi/deploys

**Required**:
- [ ] `build.command` shows: `npm run build:ci`
- [ ] `[ASSERT]` line lists both `PlcCanvas-*.js` and `PlcLab-*.js`

**Example**:
```
build.command from netlify.toml
$ npm run build:ci && echo '{...}' > dist/version.json

[ASSERT] ✅ PLC chunks present: PlcCanvas-*.js, PlcLab-*.js
```

---

## 2. Runtime Signature (Production)

### Console Boot Line
**URL**: https://olumi.netlify.app/#/plot

**Steps**:
1. Open DevTools Console
2. Look for boot line

**Required**:
```
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

**Verify**:
- [ ] `mode=POC` (rich PoC shell)
- [ ] `PLC_LAB=1` (PLC Lab enabled)
- [ ] `POC_ONLY=0` (NOT PoC-only)
- [ ] `PLOT_PLC_CANVAS=1` (PLC canvas enabled)

### Network Check
**Steps**:
1. Open DevTools → Network tab
2. Filter by JS
3. Reload page

**Required**:
- [ ] `PlcCanvas-*.js` is loaded at runtime
- [ ] `PlcLab-*.js` is loaded (for /#/plc route)

---

## 3. Smoke Checks (Production /#/plot)

### Test 1: Add Node (Deterministic)
**Steps**:
1. Click "Add Node" button
2. Observe node count
3. Click "Add Node" again
4. Click "Add Node" third time

**Expected**:
- [ ] Node count increases by **exactly 1** each time
- [ ] No duplicate nodes
- [ ] Nodes appear at deterministic positions

### Test 2: Controls State
**Steps**:
1. Check Select button
2. Check Connect button
3. Try clicking them

**Expected**:
- [ ] Buttons are **disabled** if handlers not attached
- [ ] No "lying" UI (buttons that look clickable but do nothing)
- [ ] Clear visual feedback for disabled state

### Test 3: Zoom Behavior
**Steps**:
1. Zoom in with mouse wheel
2. Zoom out with mouse wheel
3. Click "Fit to Content" button

**Expected**:
- [ ] Canvas remains within bounds (no infinite zoom)
- [ ] Zoom is clamped to reasonable limits
- [ ] "Fit to Content" works correctly
- [ ] No jitter or jumping

### Test 4: Error Handling (429 Rate Limit)
**Steps**:
1. Open DevTools → Network tab
2. Right-click on a request → "Block request URL"
3. Or use "Override" to inject 429 response with `Retry-After` header
4. Trigger an action that makes a request

**Expected**:
- [ ] No "sad face" icon
- [ ] Non-blocking countdown banner appears
- [ ] Shows retry time from `Retry-After` header
- [ ] **No auto-retry** (user must manually retry)

---

## 4. Overlay Bug Check

### Issue
Image or decorative element covering nodes at center, blocking interactions.

### Diagnostic Steps
1. Open DevTools → Elements
2. Inspect the canvas area
3. Look for elements with high z-index or no `pointer-events: none`

### Common Culprits
- Background gradients with `position: absolute`
- Hero images without `pointer-events: none`
- Decorative overlays with high z-index

### Fix Applied
**File**: `/src/plot/adapters/PlcCanvasAdapter.tsx`

```tsx
<div 
  data-testid="plc-canvas-adapter"
  style={{ position: 'relative', zIndex: 10 }}  // ✅ Ensures canvas on top
>
  <PlcCanvas ... />
</div>
```

### Verification
- [ ] Canvas wrapper has `position: relative; z-index: 10`
- [ ] No decorative elements with `z-index > 10` in same stacking context
- [ ] Decorative overlays have `pointer-events: none` if present
- [ ] Nodes are clickable and draggable

---

## 5. A11y/Visual Snapshots

### Contrast Check
**Tool**: axe DevTools or Lighthouse

**Steps**:
1. Run axe scan on https://olumi.netlify.app/#/plot
2. Check contrast ratios

**Required**:
- [ ] Text contrast ≥ 4.5:1 (WCAG AA)
- [ ] Interactive elements ≥ 3:1
- [ ] No contrast violations

### Keyboard Navigation
**Steps**:
1. Tab through all interactive elements
2. Verify focus indicators
3. Test keyboard shortcuts

**Required**:
- [ ] All buttons are keyboard accessible
- [ ] Focus indicators visible
- [ ] Logical tab order
- [ ] No keyboard traps

### ARIA Semantics
**Check**:
- [ ] Buttons have `role="button"` or are `<button>` elements
- [ ] Disabled buttons have `aria-disabled="true"`
- [ ] Canvas has appropriate `aria-label`
- [ ] Interactive elements have descriptive labels

---

## 6. Telemetry Sanity (If Enabled)

### Events to Check
1. **Run Request**: Emitted when user clicks "Run"
2. **Run Success**: Emitted when flow completes
3. **Critique Fix**: Emitted when user applies a fix

### Verification
**Steps**:
1. Open DevTools → Network tab
2. Filter by telemetry endpoint
3. Trigger events

**Required**:
- [ ] Events emit correctly
- [ ] UI does **not** fail if telemetry errors
- [ ] No blocking on telemetry sends
- [ ] Errors logged to console (non-blocking)

---

## Failure Scenarios

### If Boot Line Shows `POC_ONLY=1`
**Cause**: Wrong build or environment override

**Fix**:
1. Check Netlify UI → Build settings
2. Ensure "Build command" is **empty** (uses `netlify.toml`)
3. Check Environment variables for overrides
4. Trigger "Clear cache and deploy site"

### If Assertion Not in Deploy Log
**Cause**: Build command not using `build:ci`

**Fix**:
1. Verify `netlify.toml` has `command = "npm run build:ci ..."`
2. Check Netlify UI for build command override
3. Clear override and redeploy

### If PlcCanvas-*.js Not Loaded
**Cause**: Tree-shaking or flag issue

**Fix**:
1. Verify `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"` in `netlify.toml`
2. Check `PlotShowcase.tsx` imports `PlcCanvasAdapter`
3. Rebuild and verify assertion passes

### If Overlay Blocks Canvas
**Cause**: Z-index or pointer-events issue

**Fix**:
1. Inspect offending element
2. Add `pointer-events: none` to decorative elements
3. Ensure canvas wrapper has `position: relative; z-index: 10`
4. Lower z-index of overlay elements

---

## Quick Commands

### Local Build Test
```bash
npm run build:ci
# Should show: [ASSERT] ✅ PLC chunks present: PlcCanvas-*.js, PlcLab-*.js
```

### Local Dev Server
```bash
npm run dev
# Visit http://localhost:5173/#/plot
```

### E2E Tests
```bash
npm run e2e:chromium
# Should pass all plot-related tests
```

---

## Summary Checklist

- [ ] Build signature verified (deploy log shows assertion)
- [ ] Runtime signature verified (console shows correct flags)
- [ ] Add Node works deterministically
- [ ] Controls state correct (no lying UI)
- [ ] Zoom behavior correct (clamped, fit works)
- [ ] Error handling correct (429 shows banner, no auto-retry)
- [ ] No overlay blocking canvas
- [ ] A11y checks pass (contrast, keyboard, ARIA)
- [ ] Telemetry works (if enabled, non-blocking)

**All checks must pass before marking production as verified! ✅**
