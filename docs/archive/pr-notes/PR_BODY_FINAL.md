# fix(safe-screen): isolate from React + add regression tests

## Problem
Production crash where the safe screen imported React early and hit a `use-sync-external-store` error when chunking caused load-order issues.

## Solution
Implemented a pure DOM safe entry, `forceSafe` switch, timeout fallback, React dedupe, ESLint import guard, and 3 E2E regression tests.

Added a Sentry breadcrumb for field triage and a reusable console guard for tests.

## Changes

### Core Fix
- **Pure DOM safe entry** (`src/poc/safe/`) - Zero React dependencies
- **Boot logic** (`index.html`) - `forceSafe=1` parameter support
- **React deduplication** (`vite.config.ts`) - Prevents multi-React instances
- **ESLint guard** (`.eslintrc.cjs`) - Blocks unsafe imports in safe code
- **3 E2E tests** (`e2e/safe-screen.spec.ts`) - Comprehensive coverage

### Hardening
- **Sentry breadcrumb** - `safe-screen:shown` for field triage
- **Console guard helper** (`e2e/utils/consoleGuard.ts`) - Reusable test utility
- **Timeout constant** - `SAFE_TIMEOUT_MS` exported for CI tuning
- **CSS hook** - `data-visible` attribute for cleaner visibility control

### Documentation
- **Maintainer guide** - [`docs/SAFE_SCREEN.md`](docs/SAFE_SCREEN.md)
- **Merge checklist** - Complete verification workflow

## Verification

### Local Tests ✅
```bash
npm run typecheck  # ✓ Passes
npm run lint       # ✓ Passes (ESLint guards active)
npm run e2e:safe   # ✓ 3/3 passing
```

### Manual Tests ✅
- `/#/canvas` → Loads app, safe screen hidden, no console errors
- `/?forceSafe=1#/canvas` → Safe screen only, no React errors

## Preview URLs

**Normal flow:**
```
https://[netlify-preview]/#/canvas
```
Expected: App loads, safe screen hidden

**Forced safe:**
```
https://[netlify-preview]/?forceSafe=1#/canvas
```
Expected: Safe screen visible, no `use-sync-external-store` errors

## Files Changed

### Created
- `src/poc/safe/safe-entry.ts` - Pure DOM safe screen
- `src/poc/safe/safe-utils.ts` - React-free utilities
- `e2e/safe-screen.spec.ts` - 3 regression tests
- `e2e/utils/consoleGuard.ts` - Reusable test helper
- `docs/SAFE_SCREEN.md` - Maintainer guide

### Modified
- `index.html` - Boot logic with forceSafe support
- `vite.config.ts` - React deduplication
- `.eslintrc.cjs` - Safe entry import restrictions
- `package.json` - Added `e2e:safe` script

## CI Requirements

- ✅ `npm run typecheck` (required)
- ✅ `npm run lint` (required)
- ✅ `npm run e2e:safe` (required - 3/3 tests must pass)

## Post-Merge Monitoring (24h)

1. **Sentry**: Check for `safe-screen:shown` breadcrumb count
   - Expected: Very low (only on real failures)
   - If high: Investigate why safe screen is showing

2. **Error monitoring**: Search for `use-sync-external-store` errors
   - Expected: Zero
   - If any: Rollback immediately

3. **Lighthouse**: Verify LCP unchanged or better on `/#/canvas`

## Rollback Plan

If issues detected:
```bash
git revert 52ac456 29e438e ad1028a
git push origin main
```

## Related Documentation

- [Safe Screen Maintainer Guide](docs/SAFE_SCREEN.md)
- [Merge Checklist](MERGE_CHECKLIST.md)

---

**Impact**: No user-visible changes in normal flow. Ensures safe screen can never crash again.
