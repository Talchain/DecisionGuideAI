# ✅ Netlify Build Fix - COMPLETE

## Problem Identified
Production was running `npm run build:poc` which sets `VITE_POC_ONLY=1`, excluding all PLC code from the bundle.

## Solution Implemented

### 1. ✅ Updated netlify.toml
**File**: `/netlify.toml` (line 2)

**Changed**:
```toml
command = "npm run build:ci && echo '{...}' > dist/version.json"
```

**Flags set**:
- `VITE_PLC_LAB = "1"`
- `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"`
- `VITE_POC_ONLY = "0"` (defensive)

### 2. ✅ Added Postbuild Assertion
**Files**:
- `/scripts/assert-plc-bundle.js` - Fails build if PLC chunks missing
- `/package.json` - Added `build:ci` script

**Script**:
```json
"build:ci": "vite build && node ./scripts/assert-plc-bundle.js"
```

**Assertion Output**:
```
[ASSERT] ✅ PLC chunks present: PlcCanvas-*.js, PlcCanvasAdapter-*.js, PlcLab-*.js
```

If PLC chunks are missing, the build will **fail** with exit code 1, preventing deployment of PoC-only bundle.

### 3. ✅ Added E2E Boot Smoke Tests
**Files**:
- `/e2e/boot.plc.spec.ts` - Verifies `/#/plc` renders whiteboard
- `/e2e/boot.plot.spec.ts` - Verifies `/#/plot` renders PoC shell + canvas

---

## Deployment Steps

### 1. Commit and Push
```bash
git add netlify.toml package.json scripts/assert-plc-bundle.js e2e/boot.*.spec.ts
git commit -m "Fix: Use build:ci with PLC assertion, prevent PoC-only bundle"
git push origin main
```

### 2. Netlify UI Settings
**Go to**: Site settings → Build & deploy → Build settings

**Verify**:
- Build command: **Empty** (or `npm run build:ci`)
- Publish directory: `dist`
- Branch: `main`

**If build command shows anything else**, clear it so `netlify.toml` is authoritative.

### 3. Clear Cache and Deploy
**Go to**: Deploys → Trigger deploy

**Action**: Select **"Clear cache and deploy site"**

### 4. Verify Deploy Log
**Must see**:
```
build.command from netlify.toml
$ npm run build:ci && echo '{...}' > dist/version.json

> decision-mind@0.0.0 build:ci
> vite build && node ./scripts/assert-plc-bundle.js

...
dist/assets/PlcCanvasAdapter-*.js      1.39 kB
dist/assets/PlcCanvas-*.js             9.58 kB
dist/assets/PlcLab-*.js               21.93 kB
...
[ASSERT] ✅ PLC chunks present: PlcCanvas-*.js, PlcCanvasAdapter-*.js, PlcLab-*.js
```

**🚨 RED FLAG**: If you see `npm run build:poc`, go back to step 2.

---

## Live Verification

### Test 1: `/#/plc`
**URL**: https://olumi.netlify.app/#/plc

**Expected**:
- ✅ Minimal B/W PLC Lab UI
- ✅ No "PLC disabled for this build" message
- ✅ Console shows: `[BOOT] mode=PLC_LAB ... PLC_LAB=1 POC_ONLY=0`

### Test 2: `/#/plot`
**URL**: https://olumi.netlify.app/#/plot

**Expected**:
- ✅ Rich PoC UI (gradient background, styled cards)
- ✅ PLC canvas behaviors:
  - Add node appends (n1, n2, n3, ...)
  - Multi-drag works (single frame)
  - Keyboard nudge (Arrow ±1px, Shift+Arrow ±10px)
  - Zoom clamped [0.25, 3]
  - No permanent "sad face"
- ✅ Console shows: `[BOOT] mode=POC ... PLOT_PLC_CANVAS=1 POC_ONLY=0`

---

## Guardrails Added

### 1. Build Assertion
**Prevents**: Deploying PoC-only bundle

**How**: `scripts/assert-plc-bundle.js` checks for required PLC chunks. If missing, build fails with exit code 1.

**Triggers on**:
- `VITE_POC_ONLY=1` set anywhere
- PLC code excluded from bundle
- Wrong build command used

### 2. E2E Boot Tests
**Prevents**: Regressions in route mounting

**Tests**:
- `e2e/boot.plc.spec.ts` - Verifies PLC Lab whiteboard renders
- `e2e/boot.plot.spec.ts` - Verifies Plot PoC shell + canvas render

**Run**:
```bash
npm run e2e -- e2e/boot.plc.spec.ts e2e/boot.plot.spec.ts
```

---

## Troubleshooting

### If Deploy Log Still Shows `build:poc`
**Cause**: Netlify UI has build command override

**Fix**:
1. Netlify UI → Site settings → Build & deploy → Build settings
2. Clear "Build command" field
3. Save
4. Clear cache and redeploy

### If Assertion Fails
**Error**:
```
[ASSERT] ❌ Missing PLC chunks in dist/assets:
  - /PlcLab-.*\.js/i
  - /PlcCanvas-.*\.js/i
  - /PlcCanvasAdapter-.*\.js/i
```

**Cause**: `VITE_POC_ONLY=1` was set or PLC code excluded

**Fix**:
1. Verify `netlify.toml` has `VITE_POC_ONLY = "0"`
2. Verify build command is `npm run build:ci` (not `build:poc`)
3. Check Netlify UI env vars don't override with `VITE_POC_ONLY=1`
4. Clear cache and redeploy

### If `/#/plc` Shows "Disabled"
**Cause**: Bundle was built with `VITE_PLC_LAB=0` or `VITE_POC_ONLY=1`

**Fix**:
1. Check deploy log for assertion output
2. Verify `netlify.toml` has `VITE_PLC_LAB="1"` and `VITE_POC_ONLY="0"`
3. Clear cache and redeploy

---

## Summary

**Changes Made**:
- ✅ `netlify.toml` - Uses `build:ci` instead of `build:poc`
- ✅ `package.json` - Added `build:ci` script with assertion
- ✅ `scripts/assert-plc-bundle.js` - Postbuild PLC chunk verification
- ✅ `e2e/boot.plc.spec.ts` - PLC Lab boot smoke test
- ✅ `e2e/boot.plot.spec.ts` - Plot Showcase boot smoke test

**Guardrails**:
- ✅ Build fails if PLC chunks missing
- ✅ E2E tests verify route mounting
- ✅ `VITE_POC_ONLY="0"` explicitly set

**Next Steps**:
1. Commit and push to main
2. Clear Netlify UI build command override
3. Clear cache and deploy
4. Verify deploy log shows `build:ci` and assertion passes
5. Test `/#/plc` and `/#/plot` live

**Ready to deploy! 🚀**
