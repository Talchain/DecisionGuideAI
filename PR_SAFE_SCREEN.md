# fix(safe-screen): isolate from React + add regression tests

## Problem
Safe screen crashed with `use-sync-external-store` when chunking caused a React-dependent import to load in the "safe" path.

## Fix
- Isolate safe entry (pure DOM, no React/Zustand/React Flow)
- Add `forceSafe=1` boot path + 1.2s timeout fallback
- Vite dedupe for React
- ESLint guard to forbid unsafe imports in `src/poc/safe/**` 
- 3 Playwright regression tests (happy path, forced safe, timeout fallback)
- Sentry breadcrumb for field triage
- Reusable console guard helper for E2E tests

## Tests
- `npm run e2e:safe` → 3/3 passing
- No console errors on happy path
- No `use-sync-external-store` on forced safe path

## Files Changed
### Created
- `src/poc/safe/safe-entry.ts` - Pure DOM safe screen
- `src/poc/safe/safe-utils.ts` - React-free utilities
- `e2e/safe-screen.spec.ts` - Regression tests
- `e2e/utils/consoleGuard.ts` - Reusable test helper
- `docs/SAFE_SCREEN.md` - Maintainer guide

### Modified
- `index.html` - Fixed boot logic with forceSafe support
- `vite.config.ts` - React deduplication
- `.eslintrc.cjs` - Safe entry import restrictions
- `package.json` - Added e2e:safe script

## Merge Impact
- No user-visible changes in normal flow
- Ensures safe screen can never crash again
- ESLint prevents future regressions

## Manual Verification
- [ ] `/#/canvas` → no safe screen, no console errors
- [ ] `/?forceSafe=1#/canvas` → safe screen visible, no use-sync-external-store errors
- [ ] Check Sentry for `safe-screen:shown` breadcrumb count over 24h

## CI Requirements
- ✅ `npm run typecheck`
- ✅ `npm run lint`
- ✅ `npm run e2e:safe` (required)
