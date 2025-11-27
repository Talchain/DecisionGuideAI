# PLC Adapter Hotfix - Validation Checklist

## Status: ✅ DEPLOYED TO MAIN

**Hotfix Commit**: `e337fa8` - Force adapter ON  
**Revert Commit**: `96d51f6` - Back to env flag with hardened check  
**Date**: October 14, 2025

---

## Changes Summary

### Commit 1: Hotfix (e337fa8)
**Purpose**: Force PLC adapter ON to prove runtime path

**Changes**:
1. ✅ Boot diagnostic with String() wrapping
2. ✅ `USE_PLC_CANVAS = true` (forced ON)
3. ✅ Removed `nodes.length > 0` gating (adapter always mounts)
4. ✅ Added `data-testid="plc-canvas-adapter"`
5. ✅ Added `onError` prop

### Commit 2: Revert (96d51f6)
**Purpose**: Switch to hardened env flag check

**Changes**:
1. ✅ `USE_PLC_CANVAS = String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS) === '1'`
2. ✅ Kept boot diagnostic
3. ✅ Kept data-testid
4. ✅ Kept no-gating behavior
5. ✅ Kept onError prop

---

## Build Verification ✅

Both commits pass build:
```bash
$ npm run build:ci
✓ built in 7.14s
[ASSERT] ✅ PLC chunks present: PlcCanvas-Dj6EyOWk.js, PlcLab-DaHMJzid.js
```

---

## Live Validation (After Netlify Deploy)

### Step 1: Check Netlify Deploy
1. Go to: https://app.netlify.com/sites/olumi/deploys
2. Wait for both deploys to complete:
   - Deploy 1: `e337fa8` (hotfix)
   - Deploy 2: `96d51f6` (revert)
3. Verify deploy log shows:
   ```
   [ASSERT] ✅ PLC chunks present: PlcCanvas-*.js, PlcLab-*.js
   ```

### Step 2: Validate Hotfix Deploy (e337fa8)
**URL**: https://olumi.netlify.app/#/plot

**Console Checks**:
```javascript
// 1. Boot diagnostic should appear
// Expected output:
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1

// 2. Adapter presence check
!!document.querySelector('[data-testid="plc-canvas-adapter"]')
// Expected: true

// 3. Verify it's the wrapper div (not inner canvas)
document.querySelector('[data-testid="plc-canvas-adapter"]').tagName
// Expected: "DIV"
```

**Network Checks**:
1. Open DevTools → Network → JS filter
2. Look for:
   - `PlcCanvas-*.js` (should load)
   - `PlcLab-*.js` (should load)
3. Both should have 200 status

**Interaction Checks**:
- [ ] Canvas visible immediately (even with 0 nodes)
- [ ] Click "Run" → nodes appear
- [ ] Drag canvas → pans smoothly
- [ ] Zoom with wheel → works (clamped 0.25-3x)
- [ ] No overlay blocking center area
- [ ] No console errors

### Step 3: Validate Revert Deploy (96d51f6)
**URL**: https://olumi.netlify.app/#/plot (after second deploy)

**Console Checks**:
```javascript
// 1. Boot diagnostic still present
[BOOT] mode=POC route=#/plot PLC_LAB=1 POC_ONLY=0 PLOT_PLC_CANVAS=1

// 2. Adapter still present (via env flag now)
!!document.querySelector('[data-testid="plc-canvas-adapter"]')
// Expected: true

// 3. Verify env flag is being read correctly
String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS)
// Expected: "1"
```

**Interaction Checks** (same as Step 2):
- [ ] Canvas visible immediately
- [ ] All interactions work
- [ ] No console errors

### Step 4: Verify version.json
**URL**: https://olumi.netlify.app/version.json

**Expected**:
```json
{
  "commit": "96d51f6...",
  "short": "96d51f6",
  "branch": "main",
  "timestamp": "2025-10-14T..."
}
```

---

## Acceptance Criteria

### Must All Pass ✅

#### Build
- [x] Hotfix commit builds successfully
- [x] Revert commit builds successfully
- [x] PLC assertion passes in both

#### Console (Hotfix Deploy)
- [ ] `[BOOT]` line shows all three flags
- [ ] `PLOT_PLC_CANVAS=1` (not undefined)
- [ ] `data-testid="plc-canvas-adapter"` present
- [ ] No console errors

#### Console (Revert Deploy)
- [ ] `[BOOT]` line still shows all flags
- [ ] `PLOT_PLC_CANVAS=1` (from Netlify env)
- [ ] `data-testid="plc-canvas-adapter"` still present
- [ ] No console errors

#### Interactions (Both Deploys)
- [ ] Canvas mounts with 0 nodes (no gating)
- [ ] Drag/pan works smoothly
- [ ] Zoom works (clamped)
- [ ] No overlay blocking
- [ ] Network shows PLC chunks loading

#### Version
- [ ] version.json commit matches `96d51f6`

---

## Troubleshooting

### Issue: Console shows `PLOT_PLC_CANVAS=undefined`
**Diagnosis**: Netlify env var not set or wrong format

**Fix**:
1. Go to: Netlify → Site settings → Environment variables
2. Check: `VITE_FEATURE_PLOT_USES_PLC_CANVAS`
3. Should be: `1` (string "1", no quotes in UI)
4. If missing or wrong, set it and redeploy

**Verify netlify.toml**:
```toml
[build.environment]
  VITE_FEATURE_PLOT_USES_PLC_CANVAS = "1"
```

### Issue: Adapter not present after revert
**Diagnosis**: Env flag check failing

**Debug in console**:
```javascript
// Check raw env value
import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS
// Should be: "1" (string)

// Check string conversion
String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS)
// Should be: "1"

// Check comparison
String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS) === '1'
// Should be: true
```

**Fix**: If env var is wrong type, update Netlify env and redeploy

### Issue: Canvas not interactive
**Diagnosis**: Z-index or pointer-events issue

**Check**:
```javascript
const adapter = document.querySelector('[data-testid="plc-canvas-adapter"]')
window.getComputedStyle(adapter).zIndex
// Should be: "10"

window.getComputedStyle(adapter).position
// Should be: "relative"
```

**Fix**: Already fixed in PlcCanvasAdapter.tsx (z-index:10)

### Issue: Canvas doesn't appear with 0 nodes
**Diagnosis**: Gating logic still present

**Check**: Look for `{nodes.length > 0 &&` wrapping the canvas div

**Fix**: Already removed in hotfix - canvas div is no longer conditional

---

## Rollback Plan

If critical issues arise:

### Option 1: Revert Both Commits
```bash
git revert 96d51f6 e337fa8
git push origin main
```

### Option 2: Disable Flag in Netlify
1. Set: `VITE_FEATURE_PLOT_USES_PLC_CANVAS = "0"`
2. Redeploy with cache clear
3. Falls back to GraphCanvas

### Option 3: Cherry-pick Last Good Commit
```bash
git checkout main
git reset --hard 24ed44d  # Before hotfix
git push origin main --force
```

---

## Post-Validation Actions

### If All Checks Pass ✅
1. Update `PLOT_PLC_VERIFICATION.md` with results
2. Close any related issues
3. Document in release notes

### If Issues Found ❌
1. Document exact failure in console/network
2. Screenshot the issue
3. Execute rollback plan
4. Debug locally with same env vars

---

## Key Differences: Hotfix vs Revert

| Aspect | Hotfix (e337fa8) | Revert (96d51f6) |
|--------|------------------|------------------|
| Flag Value | `true` (hardcoded) | `String(env) === '1'` |
| Purpose | Prove runtime path | Production-ready |
| Boot Diag | ✅ Yes | ✅ Yes (kept) |
| data-testid | ✅ Yes | ✅ Yes (kept) |
| No Gating | ✅ Yes | ✅ Yes (kept) |
| onError | ✅ Yes | ✅ Yes (kept) |

**Key Point**: The revert keeps all improvements (diagnostics, testid, no gating) but switches from hardcoded `true` to env flag check.

---

## Success Indicators

### Green Flags ✅
- Console shows `[BOOT]` with all flags
- `data-testid` present in DOM
- PLC chunks in Network tab
- Canvas interactive with 0 nodes
- No console errors
- Smooth interactions

### Red Flags 🚨
- `PLOT_PLC_CANVAS=undefined` in console
- `data-testid` not found
- Canvas not appearing
- Overlay blocking interactions
- Console errors about missing modules
- GraphCanvas rendering instead of PLC

---

## Timeline

1. **12:00 PM** - Hotfix committed (e337fa8)
2. **12:05 PM** - Revert committed (96d51f6)
3. **12:10 PM** - Netlify auto-deploys hotfix
4. **12:15 PM** - Validate hotfix (prove path)
5. **12:20 PM** - Netlify auto-deploys revert
6. **12:25 PM** - Validate revert (env flag works)
7. **12:30 PM** - Mark as complete or rollback

---

## Contact Points

**Netlify Dashboard**: https://app.netlify.com/sites/olumi  
**Live Site**: https://olumi.netlify.app/#/plot  
**GitHub Repo**: https://github.com/Talchain/DecisionGuideAI  
**Version JSON**: https://olumi.netlify.app/version.json

---

**Status**: ✅ Commits pushed, awaiting Netlify deploy  
**Next Action**: Monitor Netlify deploys and validate using checklist above
