# ✅ Netlify Build Fix - Verification Checklist

## Goal
Ensure Netlify production builds include PLC Lab and PLC Canvas Adapter using the standard `npm run build` command.

---

## Configuration Status

### ✅ 1. netlify.toml
**File**: `/netlify.toml`

**Build Command**:
```toml
command = "npm run build && echo '{...}' > dist/version.json"
```
✅ Uses `npm run build` (NOT `build:poc`)

**Environment Variables**:
```toml
[build.environment]
  VITE_PLC_LAB = "1"                          # ✅ PLC Lab enabled
  VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"     # ✅ PLC Canvas Adapter ON
  VITE_POC_ONLY = "0"                         # ✅ Explicitly disabled
  VITE_AUTH_MODE = "guest"
  # ... all PoC feature flags present
```

### ✅ 2. package.json
**File**: `/package.json`

**Scripts**:
```json
{
  "build": "vite build",                      // ✅ Neutral, no cross-env
  "build:poc": "cross-env VITE_POC_ONLY=1 ..." // ✅ Kept for local testing only
}
```

### ✅ 3. Boot Selector (main.tsx)
**File**: `/src/main.tsx`

**Logic**:
- Line 16: `const labBuild = env.VITE_PLC_LAB === '1'`
- Line 22-24: If `labBuild && hash.startsWith('#/plc')` → mount PLC Lab
- Line 38: Console log shows all flags for ops diagnostics

**Status**: ✅ Correctly reads build-time env vars

### ✅ 4. Plot Route (PlotShowcase.tsx)
**File**: `/src/routes/PlotShowcase.tsx`

**Logic**:
- Line 23: `const usePlcCanvas = (import.meta as any)?.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS === '1'`
- Lines 585-600: Conditional mount (PlcCanvasAdapter vs GraphCanvas)

**Status**: ✅ Correctly checks feature flag

---

## Build Verification

### ✅ Local Build Test
```bash
VITE_PLC_LAB=1 VITE_FEATURE_PLOT_USES_PLC_CANVAS=1 VITE_POC_ONLY=0 npm run build
```

**Output**:
```
✓ PlcCanvasAdapter-DzXKagmE.js    1.39 kB │ gzip: 0.82 kB
✓ ErrorBanner-CJ7GMupB.js         0.77 kB │ gzip: 0.46 kB
✓ PlcCanvas-B-ajzIq-.js           9.58 kB │ gzip: 3.52 kB
✓ PlcLab-BLHZbyRy.js             21.93 kB │ gzip: 6.91 kB
```

**Status**: ✅ All PLC components bundled

### ✅ Test Results
```
Unit Tests: 12/12 passing
PLC Shard: 15/15 passing
GATES: PASS — PLC shard (visual+snap+guides+bulk+history+io+a11y+boot)
```

---

## Netlify UI Checklist

### 0. ✅ Clear Build Command Override
**Location**: Netlify UI → Site Settings → Build & deploy → Build settings

**Action**: 
- If "Build command" field has a value, **clear it**
- This ensures `netlify.toml` is authoritative

**Status**: ⏳ VERIFY IN NETLIFY UI

### 1. ✅ Verify Environment Variables
**Location**: Netlify UI → Site Settings → Environment variables

**Expected**:
- `VITE_PLC_LAB = "1"`
- `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"`
- `VITE_POC_ONLY = "0"` (or absent)

**Note**: These should come from `netlify.toml`, but you can also set them in UI for clarity.

**Status**: ⏳ VERIFY IN NETLIFY UI

### 2. ✅ Clear Cache and Deploy
**Location**: Netlify UI → Deploys → Trigger deploy → Clear cache and deploy site

**Why**: Ensures old PoC-only bundle is not reused

**Status**: ⏳ READY TO EXECUTE

---

## Post-Deploy Smoke Tests

### Test 1: `/#/plc` Loads Without ?dev=1
**URL**: https://olumi.netlify.app/#/plc

**Expected**:
- ✅ Minimal black/white PLC Lab UI loads
- ✅ No "PLC is disabled" message
- ✅ Console shows: `[BOOT] mode=PLC_LAB route=#/plc PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1`

**Status**: ⏳ TEST AFTER DEPLOY

### Test 2: `/#/plot` Uses PLC Canvas
**URL**: https://olumi.netlify.app/#/plot

**Expected**:
- ✅ Rich PoC UI (gradient background, styled cards)
- ✅ Canvas behaviors from PLC:
  - Multi-drag moves all selected nodes
  - Arrow keys nudge ±1px
  - Shift+Arrow keys nudge ±10px
  - Zoom stays clamped [0.25, 3]
- ✅ No permanent "sad face" (error banner only on real errors)
- ✅ Console shows: `[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1`

**Status**: ⏳ TEST AFTER DEPLOY

### Test 3: Build Log Verification
**Location**: Netlify UI → Deploys → [Latest deploy] → Deploy log

**Expected**:
```
build.command from netlify.toml
$ npm run build && echo '{...}' > dist/version.json
```

**NOT**:
```
$ npm run build:poc
```

**Status**: ⏳ VERIFY AFTER DEPLOY

---

## Acceptance Criteria

- [x] `netlify.toml` uses `npm run build` (not `build:poc`)
- [x] `VITE_PLC_LAB = "1"` in `netlify.toml`
- [x] `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"` in `netlify.toml`
- [x] `VITE_POC_ONLY = "0"` in `netlify.toml`
- [x] `package.json` has neutral `"build": "vite build"`
- [x] Boot selector reads `VITE_PLC_LAB` at build time
- [x] PlotShowcase reads `VITE_FEATURE_PLOT_USES_PLC_CANVAS` at build time
- [x] Console log shows all flags on boot
- [x] Local build includes all PLC components
- [x] All tests pass (12 unit + 15 PLC E2E)
- [ ] Netlify UI build command cleared (if set)
- [ ] Clear cache and deploy executed
- [ ] `/#/plc` loads without `?dev=1`
- [ ] `/#/plot` shows PLC canvas behaviors
- [ ] Build log shows `npm run build`

---

## Troubleshooting

### If `/#/plc` shows "PLC is disabled"
1. Check build log: Does it show `npm run build` or `npm run build:poc`?
2. If `build:poc`, clear build command in Netlify UI
3. Verify `VITE_PLC_LAB=1` in build log environment section
4. Clear cache and redeploy

### If `/#/plot` uses legacy canvas
1. Check console: Does `[BOOT]` log show `PLOT_PLC_CANVAS=1`?
2. If not, verify `VITE_FEATURE_PLOT_USES_PLC_CANVAS=1` in `netlify.toml`
3. Clear cache and redeploy

### If build log shows wrong command
1. Netlify UI → Site Settings → Build & deploy → Build settings
2. Clear "Build command" field
3. Save
4. Trigger new deploy

---

## Next Steps

1. **Verify Netlify UI** (build command cleared, env vars visible)
2. **Clear cache and deploy**
3. **Run smoke tests** (`/#/plc`, `/#/plot`)
4. **Verify build log** (shows `npm run build`)
5. **Check console logs** (shows correct flags)

**All configuration is complete. Ready to deploy!**
