# DecisionGuideAI

## Quick start

1) Create `.env.local` and set flags/keys (values shown are examples):

```
VITE_FEATURE_SCENARIO_SANDBOX=true
VITE_FEATURE_WHITEBOARD=false
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=
VITE_DEBUG_BOARD=false
```

2) Install & run

- Install: `npm install`
- Dev server: `npm run dev`
- Test (CI): `npm test`
- Test (watch): `npm run test:watch`
- Typecheck/build: `npm run build`

3) Routes to try (HashRouter)

- Home: `/#/`
- Sandbox: `/#/decisions/<id>/sandbox`

## Feature flags

Single source of truth is in `src/lib/config.ts` (`isSandboxEnabled()`, `cfg.featureWhiteboard`). Configure in `.env.local`.

| Flag | Meaning | Typical Default |
|------|---------|------------------|
| `VITE_FEATURE_SCENARIO_SANDBOX` | Enables the Scenario Sandbox route | `false` |
| `VITE_FEATURE_WHITEBOARD` | Enables the real whiteboard canvas (tldraw) | `false` |
| `VITE_FEATURE_COLLAB_VOTING` | Enables collaborative voting UI | `false` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Optional. Enables auth/data flows | empty |
| `VITE_OPENAI_API_KEY` | Optional. Enables OpenAI-backed features | empty |
| `VITE_DEBUG_BOARD` | Optional. Enables verbose board logs (dev only) | `false` |

### Flags matrix (Sandbox route)

- SCENARIO_SANDBOX=false → "Scenario Sandbox is not enabled."
- SCENARIO_SANDBOX=true & WHITEBOARD=false → loads `ScenarioSandboxMock` (lazy).
- SCENARIO_SANDBOX=true & WHITEBOARD=true → loads real Canvas (lazy), ErrorBoundary fallback → mock.

See `docs/sandbox.md` for details (mock a11y, fallback UI, troubleshooting).
