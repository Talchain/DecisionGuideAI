# Contributing

Thanks for contributing! This guide covers local workflow, testing patterns, and notes specific to the Scenario Sandbox and Whiteboard route.

## Local workflow
- Install deps: `npm install`
- Run dev: `npm run dev`
- Run tests (CI): `npm test`
- Run tests (watch): `npm run test:watch`
- Typecheck/build: `npm run build`

## Environment
Create `.env.local` and set flags/keys as needed. Minimal example:
```
VITE_FEATURE_SCENARIO_SANDBOX=true
VITE_FEATURE_WHITEBOARD=false
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=
VITE_DEBUG_BOARD=false
```

- `VITE_FEATURE_SCENARIO_SANDBOX` — enables the route
- `VITE_FEATURE_WHITEBOARD` — toggles real vs mock canvas
- `VITE_DEBUG_BOARD` — optional verbose board logs (dev only)

## Testing patterns

- React Testing Library (RTL)
  - When mocking flags, reset modules per test and mock `@/lib/config`:
    ```ts
    vi.resetModules();
    vi.doMock('@/lib/config', () => ({
      cfg: { featureWhiteboard: true, featureScenarioSandbox: true, openaiKey: '', supabaseUrl: '', supabaseAnon: '' },
      isSandboxEnabled: () => true,
      isWhiteboardEnabled: () => true,
      hasSupabase: false,
    }));
    ```
  - Await lazy content with `findBy*` queries and/or `waitFor`.
  - Prefer accessible queries (role/label). Use provided data-test IDs for the Sandbox route:
    - `sandbox-loading`
    - `sandbox-mock`
    - `sandbox-real`
    - `sandbox-fallback`

- Error-boundary & fallback
  - Simulate real-canvas import failure by mocking `@/whiteboard/Canvas` to throw, assert fallback copy ("Whiteboard failed to load."), and verify "Use mock instead" swaps to the mock without page refresh.

- Accessibility checks (Mock)
  - Focusable tile: Tab until the tile is focused; `Enter` opens right panel; `Escape` closes and focus returns to tile.
  - Live announcements: clicking Generate announces "Generating…" then completion via a polite status region.
  - Probability inputs: values 0–1; `aria-invalid` only when out of range; `aria-describedby` set when invalid.

## Sandbox Testing Rules

- Flags and UI
  - Use `FlagsProvider` and `useFlags()` for all Sandbox UI feature gating.
  - Do not import `@/lib/config` in UI files. Configuration checks belong in state or non-UI modules.

- Timing & performance signals
  - Do not call `performance.mark/measure` directly in app code; use the wrapper in `src/lib/perf`.
  - Tests that involve timers must use Vitest fake timers and React `act(...)` when advancing time.

- Telemetry
  - Emit telemetry from UI via the `useTelemetry()` hook.
  - Event name mapping and dedupe live in `src/lib/analytics.ts`; tests should use the analytics test buffer helpers (`__setProdSchemaForTest`, `__setProdSchemaModeForTest`, `__getTestBuffer`, `__clearTestBuffer`) and assert on event names only (avoid schema coupling).

- Test patterns
  - Use `renderSandbox()` for Sandbox UI tests to provide flags and theme context. For toast assertions, render a `<Toaster />` (see `renderWithSandboxBoardAndToaster()` in `src/sandbox/__tests__/testUtils.tsx`).
  - Use `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(...)` and wrap stateful flows in `await act(...)` as needed.
  - Avoid `vi.resetModules()` in Sandbox tests; prefer local mocks placed before dynamic imports.

## Long-running and guard tests
- Stress tests: see `src/sandbox/state/__tests__/boardState.stress.test.ts`.
  - These create thousands of nodes/edges; allow longer timeouts in CI.
- Graph guard tests: see `src/sandbox/state/__tests__/boardState.guards.test.ts`.
  - Prevents self-loops, duplicates (including source/target handles), and cycles.
- Anchor persistence tests: see `src/sandbox/state/__tests__/edgeAnchors.persist.test.ts`.
  - Ensures `sourceHandle`/`targetHandle` persist across updates and reloads.

## Docs
- Sandbox overview and fallback behavior: `docs/sandbox.md`
- Whiteboard route internals (flags, lazy, fallback): `src/whiteboard/README.md`

## Routes (HashRouter)
- Home: `/#/`
- Sandbox: `/#/decisions/<id>/sandbox`

## Troubleshooting
- Missing `@tldraw/tldraw` with `VITE_FEATURE_WHITEBOARD=true` → error-boundary fallback will appear; click "Use mock instead".
- Supabase vars unset → public routes work; auth/data flows will throw if invoked.
