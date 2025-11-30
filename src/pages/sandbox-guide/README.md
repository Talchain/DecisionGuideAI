# Copilot Variant - Persistent AI Coach Interface

## Overview
Alternative UI implementation with persistent AI copilot panel.

**Route**: `/sandbox/copilot`
**Branch**: `feat/copilot-variant`
**Status**: In Development

## Safety Rules
✅ CAN import from: `@/services/*`, `@/stores/*`, `@/components/shared/*`
❌ CANNOT import from: `@/pages/sandbox/*`
❌ CANNOT modify: Any files outside `src/pages/sandbox-copilot/`

## Development
```bash
# Start dev server
npm run dev:copilot

# Run tests
npm run test:copilot

# Lint
npm run lint:copilot
```

## Architecture
- Shares backend: PLoT, CEE, Supabase, Auth
- Separate UI: All components in this directory
- Isolated state: useCopilotStore (separate from main UI)
