# Safe Screen - Maintainer Guide

## What Is It?
Zero-dependency HTML fallback when React fails to mount within 1200ms.

## Critical Rule
**NEVER import React, Zustand, React Flow, or Sentry in `src/poc/safe/**`**

ESLint will block unsafe imports.

## Files
- `src/poc/safe/safe-entry.ts` - Pure DOM safe screen
- `src/poc/safe/safe-utils.ts` - React-free utilities
- `e2e/safe-screen.spec.ts` - 3 regression tests
- `e2e/utils/consoleGuard.ts` - Reusable test helper

## Triggers
1. **Timeout**: React doesn't mount in 1200ms
2. **Error**: Critical JS error before React
3. **Manual**: `/?forceSafe=1#/canvas` (testing)

## Testing
```bash
npm run e2e:safe  # Must pass in CI
```

## Debugging
Look for console message: `POC_HTML_SAFE: showing (reason)`
Check Sentry breadcrumb: `safe-screen:shown`
