# ✅ Netlify PLC+Plot Bundle - Configuration Status

## Date: 2025-10-13

---

## Step 1: ✅ VERIFIED - No PoC-only Build Command

### Search Results
```bash
grep -r "build:poc" netlify.toml
# No matches ✅

grep -r "VITE_POC_ONLY" netlify.toml
# Found: VITE_POC_ONLY = "0" ✅ (explicitly disabled)
```

### File Status

#### ✅ netlify.toml (CORRECT)
**Location**: `/netlify.toml` (only one file, at repo root)

**Build Command**:
```toml
[build]
  command = "npm run build && echo '{...}' > dist/version.json"
  publish = "dist"
```
✅ Uses `npm run build` (NOT `build:poc`)

**Environment Variables**:
```toml
[build.environment]
  VITE_PLC_LAB = "1"                          # ✅ PLC Lab enabled
  VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"     # ✅ PLC Canvas Adapter ON
  VITE_POC_ONLY = "0"                         # ✅ Explicitly disabled
```

#### ✅ package.json (CORRECT)
```json
{
  "build": "vite build",                      // ✅ Neutral, no cross-env
  "build:poc": "cross-env VITE_POC_ONLY=1 ..." // ✅ Local testing only
}
```

---

## Step 2: ✅ VERIFIED - Diagnostic Log Present

### src/main.tsx (Line 35-39)
```typescript
// Boot mode logging (always on for ops diagnostics)
try {
  // eslint-disable-next-line no-console
  console.info(`[BOOT] mode=${mode} route=${location.hash} PLC_LAB=${env.VITE_PLC_LAB ?? '0'} POC_ONLY=${env.VITE_POC_ONLY ?? '0'} PLOT_PLC_CANVAS=${env.VITE_FEATURE_PLOT_USES_PLC_CANVAS ?? '0'}`)
} catch {}
```

**Status**: ✅ Production-safe console log present

**Expected Output**:
- `/#/plc`: `[BOOT] mode=PLC_LAB route=#/plc PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1`
- `/#/plot`: `[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1`

---

## Step 3: ✅ READY - Commit & Push

### Current Branch Status
All configuration files are correct and ready for deployment:
- ✅ `netlify.toml` - Uses `npm run build`, flags set correctly
- ✅ `package.json` - Neutral build script
- ✅ `src/main.tsx` - Diagnostic log present
- ✅ `src/routes/PlotShowcase.tsx` - Flag check and conditional mount present

### Netlify UI Settings to Verify
**Location**: Netlify UI → Site settings → Build & deploy → Build settings

**Expected**:
- Build command: Empty or `npm run build` ✅
- Publish directory: `dist` ✅
- Branch: `main` (or your default branch) ✅

---

## Step 4: ✅ READY - Clean Rebuild

### Command
**Location**: Netlify UI → Deploys → Trigger deploy

**Action**: Select **"Clear cache and deploy site"**

### Expected Deploy Log Output
```
build.command from netlify.toml
$ npm run build && echo '{...}' > dist/version.json

> decision-mind@0.0.0 build
> vite build

vite v5.4.20 building for production...
✓ 252 modules transformed.
...
dist/assets/PlcCanvasAdapter-*.js      1.39 kB │ gzip: 0.82 kB
dist/assets/ErrorBanner-*.js           0.77 kB │ gzip: 0.46 kB
dist/assets/PlcCanvas-*.js             9.58 kB │ gzip: 3.52 kB
dist/assets/PlcLab-*.js               21.93 kB │ gzip: 6.91 kB
```

**Red Flag**: If you see `$ npm run build:poc`, STOP and verify:
1. No duplicate `netlify.toml` files
2. Netlify UI build command is empty or `npm run build`
3. Building from correct branch

---

## Step 5: ✅ READY - Live Verification

### Test 1: `/#/plc` - PLC Lab
**URL**: https://olumi.netlify.app/#/plc

**Expected Behavior**:
- ✅ Minimal black & white PLC Lab UI
- ✅ No "PLC disabled for this build" message
- ✅ Loads without `?dev=1`
- ✅ Footer shows version JSON

**Console Output**:
```
[BOOT] mode=PLC_LAB route=#/plc PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

**Lighthouse Targets**:
- Performance: ≥95
- Accessibility: ≥90

---

### Test 2: `/#/plot` - Plot Showcase with PLC Canvas
**URL**: https://olumi.netlify.app/#/plot

**Expected Behavior**:
- ✅ Rich PoC UI (gradient background, styled cards, shadows)
- ✅ PLC Canvas Behaviors:
  - **Add node**: Appends with deterministic IDs (n1, n2, n3, ...)
  - **Multi-drag**: Moves all selected nodes in single frame
  - **Keyboard nudge**: Arrow keys ±1px, Shift+Arrow ±10px
  - **Zoom**: Clamped [0.25, 3], no canvas jump or disappearing content
  - **Error handling**: No permanent "sad face", only slim banner on real errors
  - **Undo/Redo**: Single frame per operation

**Console Output**:
```
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

**Lighthouse Targets**:
- Performance: ≥95
- Accessibility: ≥90

---

## Step 6: Troubleshooting Guide

### If `/#/plot` Still Shows Legacy Canvas

#### Diagnostic Steps:
1. **Check console log**:
   ```
   [BOOT] ... PLOT_PLC_CANVAS=?
   ```
   - If `PLOT_PLC_CANVAS=0` or `unset`: Flag not in bundle

2. **Verify flag in netlify.toml**:
   ```toml
   VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"
   ```

3. **Verify route code** (`src/routes/PlotShowcase.tsx`):
   ```typescript
   // Line 23
   const usePlcCanvas = (import.meta as any)?.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS === '1'
   
   // Lines 585-600
   {usePlcCanvas ? (
     <PlcCanvasAdapter ... />
   ) : (
     <GraphCanvas ... />
   )}
   ```

4. **Clear cache and rebuild**:
   - Netlify UI → Trigger deploy → Clear cache and deploy site

---

### If `/#/plc` Shows "PLC is disabled"

#### Diagnostic Steps:
1. **Check console log**:
   ```
   [BOOT] ... PLC_LAB=?
   ```
   - If `PLC_LAB=0` or `unset`: Flag not in bundle

2. **Check deploy log**:
   - If shows `npm run build:poc`: Wrong build command
   - Solution: Clear Netlify UI build command override

3. **Verify netlify.toml**:
   ```toml
   VITE_PLC_LAB = "1"
   VITE_POC_ONLY = "0"
   ```

4. **Verify no duplicate netlify.toml files**:
   ```bash
   find . -name "netlify.toml" -not -path "./node_modules/*"
   # Should only show: ./netlify.toml
   ```

---

## Current Status Summary

### ✅ Configuration Complete
- [x] `netlify.toml` uses `npm run build`
- [x] `VITE_PLC_LAB = "1"`
- [x] `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"`
- [x] `VITE_POC_ONLY = "0"`
- [x] Only one `netlify.toml` at repo root
- [x] `package.json` has neutral `"build": "vite build"`
- [x] Diagnostic log in `src/main.tsx`
- [x] PlotShowcase checks flag and mounts adapter

### ⏳ Deployment Actions Required
- [ ] Verify Netlify UI build settings (empty or `npm run build`)
- [ ] Clear cache and deploy site
- [ ] Verify deploy log shows `npm run build`
- [ ] Test `/#/plc` live (console + behavior)
- [ ] Test `/#/plot` live (console + behavior)

---

## Quick Verification Commands

### After Deploy, Open Browser Console:

#### On `/#/plc`:
```javascript
// Expected console output:
[BOOT] mode=PLC_LAB route=#/plc PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

#### On `/#/plot`:
```javascript
// Expected console output:
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

---

## Acceptance Criteria

### Build Configuration ✅
- [x] `netlify.toml` at repo root only
- [x] Build command: `npm run build`
- [x] `VITE_PLC_LAB = "1"`
- [x] `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"`
- [x] `VITE_POC_ONLY = "0"`

### Code Implementation ✅
- [x] Boot selector reads `VITE_PLC_LAB`
- [x] PlotShowcase reads `VITE_FEATURE_PLOT_USES_PLC_CANVAS`
- [x] Diagnostic console log present
- [x] Conditional mount in PlotShowcase

### Deployment ⏳
- [ ] Deploy log shows `npm run build`
- [ ] `/#/plc` loads without `?dev=1`
- [ ] `/#/plot` shows PLC canvas behaviors
- [ ] Console logs show correct flags

---

## Next Steps

1. **Verify Netlify UI** (build command cleared or set to `npm run build`)
2. **Clear cache and deploy**
3. **Check deploy log** (must show `npm run build`)
4. **Test `/#/plc`** (minimal UI, console log)
5. **Test `/#/plot`** (rich UI + PLC behaviors, console log)

**All configuration is complete. Ready to deploy!**
