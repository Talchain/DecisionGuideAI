# Phase 0A-Harden: Monitoring - COMPLETE

## Summary
Hardened monitoring with env guards, logger, types, and tests.

## Completed Tasks

### T1: Dependency Alignment ✅
- Verified: @sentry/react@10.20.0, web-vitals@5.1.0
- Created: scripts/doctor-monitoring.mjs
- Command: npm run doctor:monitoring

### T2: Env Guards & Logger ✅
- Created: src/lib/logger.ts (no-op in prod)
- Created: src/types/monitoring.ts (strong types)
- Refactored: src/lib/monitoring.ts
  - resolveMonitoringConfig() centralizes logic
  - Hotjar ID validation: /^[0-9]{6,9}$/
  - All console.log → logger.debug/info/error

### T3: Safe Init ✅
- Sentry.init() in try/catch
- Hotjar validates ID, respects DNT
- referrerPolicy='no-referrer', crossOrigin='anonymous'

## Tests: 14/14 Passing

### Unit (9 tests)
- resolveMonitoringConfig matrix
- Dev/test disabled
- Hotjar ID validation
- DSN requirements

### E2E (5 tests)
- No Sentry/Hotjar in dev
- DNT respected
- Invalid ID blocked

## Files Changed
- src/lib/monitoring.ts (refactored)
- src/lib/logger.ts (new)
- src/types/monitoring.ts (new)
- src/lib/__tests__/monitoring.spec.ts (9 tests)
- e2e/monitoring.network.spec.ts (5 tests)
- scripts/doctor-monitoring.mjs (new)
- scripts/measure-bundle.mjs (new)

## Verification
✅ TypeScript: 0 errors
✅ ESLint: 0 errors
✅ Tests: 14/14 passing
✅ npm run doctor:monitoring: PASS
