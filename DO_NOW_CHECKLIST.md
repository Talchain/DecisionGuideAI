# 🚀 DO NOW: Deploy PLC+Plot Bundle to Netlify

## Current Status: ✅ ALL CODE READY

All configuration files are correct. No code changes needed. Just deploy.

---

## ✅ Step 1: Configuration Verified

### Files Checked:
- ✅ `netlify.toml` - Uses `npm run build`, all flags correct
- ✅ `package.json` - Neutral build script
- ✅ `src/main.tsx` - Diagnostic log present
- ✅ `src/routes/PlotShowcase.tsx` - Flag check present
- ✅ Only one `netlify.toml` at repo root

### Key Settings:
```toml
[build]
  command = "npm run build && ..."
  
[build.environment]
  VITE_PLC_LAB = "1"
  VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"
  VITE_POC_ONLY = "0"
```

---

## 📋 Action Items (Do These Now)

### 1. Verify Netlify UI Build Settings
**Go to**: https://app.netlify.com → Your site → Site settings → Build & deploy → Build settings

**Check**:
- Build command: Should be **empty** or `npm run build`
- Publish directory: Should be `dist`
- Branch: Should be `main` (or your default branch)

**If build command shows anything else** (like `npm run build:poc`):
1. Clear the field or change to `npm run build`
2. Click "Save"

---

### 2. Clear Cache and Deploy
**Go to**: https://app.netlify.com → Your site → Deploys

**Action**:
1. Click "Trigger deploy" dropdown (top right)
2. Select **"Clear cache and deploy site"**
3. Wait for build to complete (~2-3 minutes)

---

### 3. Verify Deploy Log
**Go to**: Latest deploy → Deploy log

**Must see this**:
```
build.command from netlify.toml
$ npm run build && echo '{...}' > dist/version.json
```

**Must see these chunks**:
```
dist/assets/PlcCanvasAdapter-*.js      1.39 kB
dist/assets/ErrorBanner-*.js           0.77 kB
dist/assets/PlcCanvas-*.js             9.58 kB
dist/assets/PlcLab-*.js               21.93 kB
```

**🚨 RED FLAG**: If you see `$ npm run build:poc`, go back to step 1.

---

### 4. Test Live: `/#/plc`
**URL**: https://olumi.netlify.app/#/plc

**Open browser console** (F12 or Cmd+Option+I)

**Expected console output**:
```
[BOOT] mode=PLC_LAB route=#/plc PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

**Expected UI**:
- ✅ Minimal black & white PLC Lab
- ✅ No "PLC disabled for this build" message
- ✅ Works without `?dev=1`

---

### 5. Test Live: `/#/plot`
**URL**: https://olumi.netlify.app/#/plot

**Open browser console** (F12 or Cmd+Option+I)

**Expected console output**:
```
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1
```

**Expected UI**:
- ✅ Rich PoC UI (gradient background, styled cards)
- ✅ PLC canvas behaviors:
  - Click "Add node" → IDs are n1, n2, n3, ... (deterministic)
  - Select multiple nodes → Drag one → All move together (single frame)
  - Arrow keys → Nudge ±1px
  - Shift+Arrow keys → Nudge ±10px
  - Zoom in/out → Canvas stays visible (no jump)
  - No permanent "sad face" icon

---

## 🎯 Success Criteria

### Deploy Log ✅
- [ ] Shows `npm run build` (not `build:poc`)
- [ ] Includes all PLC chunks (PlcCanvasAdapter, PlcCanvas, PlcLab, ErrorBanner)

### `/#/plc` ✅
- [ ] Console shows: `PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1`
- [ ] Minimal B/W UI loads
- [ ] No "disabled" message

### `/#/plot` ✅
- [ ] Console shows: `PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1`
- [ ] Rich PoC UI visible
- [ ] Add appends (n1, n2, n3, ...)
- [ ] Multi-drag works
- [ ] Keyboard nudge works
- [ ] Zoom clamped

---

## 🔧 Troubleshooting

### If `/#/plc` shows "PLC is disabled"
**Cause**: Bundle was built with `VITE_POC_ONLY=1` or `VITE_PLC_LAB=0`

**Fix**:
1. Check deploy log for `npm run build:poc` → If yes, clear Netlify UI build command
2. Verify `netlify.toml` has `VITE_PLC_LAB="1"` and `VITE_POC_ONLY="0"`
3. Clear cache and redeploy

### If `/#/plot` uses legacy canvas (no multi-drag)
**Cause**: `VITE_FEATURE_PLOT_USES_PLC_CANVAS` not in bundle

**Fix**:
1. Check console: Does it show `PLOT_PLC_CANVAS=1`?
2. If not, verify `netlify.toml` has `VITE_FEATURE_PLOT_USES_PLC_CANVAS="1"`
3. Clear cache and redeploy

### If deploy log shows `npm run build:poc`
**Cause**: Netlify UI has build command override

**Fix**:
1. Netlify UI → Site settings → Build & deploy → Build settings
2. Clear "Build command" field or change to `npm run build`
3. Save
4. Clear cache and redeploy

---

## 📊 Expected Lighthouse Scores

After successful deploy:

### Root (`/`)
- Performance: ≥95
- Accessibility: ≥90
- Best Practices: 100

### `/#/plc`
- Performance: ≥95
- Accessibility: ≥90 (ideally 100)
- Best Practices: 100

---

## ✅ Completion Checklist

- [ ] Netlify UI build command verified (empty or `npm run build`)
- [ ] Cache cleared and deployed
- [ ] Deploy log shows `npm run build` ✅
- [ ] Deploy log includes PLC chunks ✅
- [ ] `/#/plc` console shows correct flags ✅
- [ ] `/#/plc` loads minimal UI ✅
- [ ] `/#/plot` console shows correct flags ✅
- [ ] `/#/plot` shows rich UI + PLC behaviors ✅
- [ ] Lighthouse scores meet targets ✅

---

## 🎉 When Complete

Post in your tracking system:
```
GO: PLC & Plot live, verified

Deploy ID: [from Netlify]
URLs:
- PLC Lab: https://olumi.netlify.app/#/plc ✅
- Plot Showcase: https://olumi.netlify.app/#/plot ✅

Console logs verified:
- PLC_LAB=1
- POC_ONLY=0
- PLOT_PLC_CANVAS=1

All behaviors confirmed.
```

---

**Ready to execute. No code changes needed. Just follow the steps above! 🚀**
