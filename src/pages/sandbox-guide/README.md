# Guide Variant - Persistent AI Coach Interface

## Overview
Alternative UI implementation with persistent AI guide panel.

**Route**: `/sandbox/guide`
**Branch**: `feat/guide-variant`
**Status**: In Development

## Safety Rules
✅ CAN import from: `@/services/*`, `@/stores/*`, `@/components/shared/*`
❌ CANNOT import from: `@/pages/sandbox/*`
❌ CANNOT modify: Any files outside `src/pages/sandbox-guide/`

## Development
```bash
# Start dev server
npm run dev:guide

# Run tests
npm run test:guide

# Lint
npm run lint:guide
```

## Architecture
- Shares backend: PLoT, CEE, Supabase, Auth
- Separate UI: All components in this directory
- Isolated state: useGuideStore (separate from main UI)
