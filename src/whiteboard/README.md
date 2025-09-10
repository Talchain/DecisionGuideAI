# Whiteboard route (Scenario Sandbox)

## Flags source of truth
- `isSandboxEnabled()` — enables the route itself
- `cfg.featureWhiteboard` — chooses real vs mock

Defined in: `src/lib/config.ts`.

## Lazy modules
- Real canvas: `src/whiteboard/Canvas.tsx` is loaded lazily (`React.lazy`) when `cfg.featureWhiteboard === true`.
- Mock: `src/sandbox/ui/ScenarioSandboxMock.tsx` is loaded lazily when `cfg.featureWhiteboard !== true` or after fallback swap.

Why lazy? Reduce initial bundle and keep first paint fast when Sandbox is disabled or mock-only.

## Fallback behavior
The route is wrapped in an error boundary and a suspense spinner.
- Suspense shows a polite loader with `data-testid="sandbox-loading"`.
- If the real canvas fails to load (missing package, import error, runtime crash), the boundary renders a friendly panel:
  - Text: "Whiteboard failed to load."
  - Buttons: Retry, Use mock instead.
  - Test id: `sandbox-fallback`
- "Use mock instead" switches to the mock without a page refresh.

## Swap logic
- `useMockOverride` (local state) forces the mock even when `cfg.featureWhiteboard === true`.
- Retry toggles a `key` on the boundary to remount the tree and re-attempt the lazy import.

## Test IDs (QA support)
- `sandbox-loading` (spinner)
- `sandbox-mock` (mock root wrapper)
- `sandbox-real` (real canvas root wrapper)
- `sandbox-fallback` (error panel)

## Routes
- `/#/decisions/<id>/sandbox`
