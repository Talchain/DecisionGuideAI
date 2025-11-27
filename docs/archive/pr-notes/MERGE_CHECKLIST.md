# Safe Screen Fix - Merge Checklist ✅

## Commits Ready
- `ad1028a` - fix: isolate safe screen from React dependencies + add regression tests
- `29e438e` - chore(safe-screen): add hardening tweaks + maintainer docs

---

## Pre-Merge Verification

### Local Tests ✅
- [x] `npm run typecheck` - Passes
- [x] `npm run lint` - Passes (ESLint guards active)
- [x] `npm run e2e:safe` - 3/3 passing

### Manual Checks (Local)
- [x] `/#/canvas` → No safe screen, no console errors
- [x] `/?forceSafe=1#/canvas` → Safe screen visible, no React errors

---

## PR Setup

### Title
```
fix(safe-screen): isolate from React + add regression tests
```

### Labels
- `bug`
- `regression-guard`
- `e2e`

### Description
Use content from `PR_SAFE_SCREEN.md`

---

## CI Requirements

### Required Checks
- [ ] `npm run typecheck` - Must pass
- [ ] `npm run lint` - Must pass
- [ ] `npm run e2e:safe` - Must pass (3/3 tests)

### Optional Checks
- [ ] `npm run e2e:smoke` - Should pass
- [ ] `npm run build` - Should succeed

---

## Netlify Preview Checks

After PR opens, verify on Netlify preview:

### Happy Path
- [ ] Navigate to `/#/canvas`
- [ ] Verify no safe screen appears
- [ ] Open console, verify no errors
- [ ] Specifically check: no `use-sync-external-store` errors

### Forced Safe Path
- [ ] Navigate to `/?forceSafe=1#/canvas`
- [ ] Verify safe screen is visible
- [ ] Open console, verify no `use-sync-external-store` errors
- [ ] Verify safe screen shows "PoC HTML Safe Screen"

---

## Post-Merge Monitoring (24h)

### Production Checks
1. **Immediate** (within 5 min):
   - [ ] Open prod: `/#/canvas` → No safe screen, no console errors
   - [ ] Open prod: `/?forceSafe=1#/canvas` → Safe screen visible, no React errors

2. **24h Monitoring**:
   - [ ] Check Sentry for `safe-screen:shown` breadcrumb count
   - [ ] Expected: Very low (only on real failures)
   - [ ] If high: Investigate why safe screen is showing

3. **Error Monitoring**:
   - [ ] Search Sentry for `use-sync-external-store` errors
   - [ ] Expected: Zero
   - [ ] If any: Rollback immediately

---

## Rollback Plan

If issues detected:

```bash
# Revert both commits
git revert 29e438e ad1028a
git push origin main

# Or reset if not merged to prod yet
git reset --hard <commit-before-ad1028a>
git push -f origin main
```

---

## Success Criteria

✅ All CI checks pass
✅ Netlify preview manual checks pass
✅ No `use-sync-external-store` errors in any scenario
✅ Safe screen works in forced mode
✅ Safe screen doesn't show on happy path
✅ ESLint prevents unsafe imports in `src/poc/safe/**`

---

## Files to Review

### Core Changes
- `src/poc/safe/safe-entry.ts` - Pure DOM safe screen
- `src/poc/safe/safe-utils.ts` - React-free utilities
- `index.html` - Boot logic with forceSafe support
- `vite.config.ts` - React deduplication
- `.eslintrc.cjs` - Import restrictions

### Tests
- `e2e/safe-screen.spec.ts` - 3 regression tests
- `e2e/utils/consoleGuard.ts` - Reusable helper

### Documentation
- `docs/SAFE_SCREEN.md` - Maintainer guide
- `PR_SAFE_SCREEN.md` - PR description
- `SAFE_SCREEN_FIX_SUMMARY.md` - Implementation summary

---

## Ready to Merge? ✅

All checkboxes above should be checked before merging.

**Current Status**: Ready for PR creation and CI verification
