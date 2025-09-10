# Scenario Sandbox

## Overview
The Scenario Sandbox is a visual space to explore scenarios and outcomes. It can run in two modes:

- Mock: `ScenarioSandboxMock` — self-contained, no external deps. Great for rapid dev, keyboard/a11y validation, and demos.
- Real Whiteboard: `Canvas` (tldraw) — integrates the actual canvas editor and persistence.

Use flags in `.env.local` to choose:
- `VITE_FEATURE_SCENARIO_SANDBOX=true`
- `VITE_FEATURE_WHITEBOARD=false` (mock) or `true` (real)

## Feature Flags
Add these in `.env.local` (recommended values) and mirror them in `.env.example` with conservative defaults.

- `VITE_FEATURE_SCENARIO_SANDBOX` — enable the Sandbox route and UI (mock and/or whiteboard)
- `VITE_FEATURE_SCENARIO_SNAPSHOTS` — enable storage-level snapshots for the sandbox
- `VITE_FEATURE_OPTION_HANDLES` — enable stable option handles for decision→option edges
- `VITE_FEATURE_DECISION_GRAPH` — enable the decision graph deep-link and view
- `VITE_FEATURE_WHITEBOARD` — enable the real tldraw-based whiteboard
- `VITE_FEATURE_COLLAB_VOTING` — enable collaborative voting UI
- `VITE_FEATURE_SANDBOX_REALTIME` — enable realtime provider (auth-gated in prod; mock in dev/tests)
- `VITE_FEATURE_SANDBOX_VOTING` — enable voting + alignment in the Sandbox
- `VITE_DEBUG_BOARD` — verbose Yjs/board logs in dev

- `VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE` — three-panel Strategy Bridge shell (left context, canvas, right tabs)
- `VITE_FEATURE_SANDBOX_PROJECTIONS` — enable deterministic projections and KR Cards in Goals & OKRs
- `VITE_FEATURE_SANDBOX_TRIGGERS_BASIC` — enable Intelligence triggers (KR_MISS_PROJECTION)
- `VITE_FEATURE_SANDBOX_DECISION_CTA` — enable the gated Decision CTA routing from Intelligence panel

## Realtime (auth-gated, mock in dev/tests)
- Flag: `VITE_FEATURE_SANDBOX_REALTIME`
- Provider: `src/realtime/provider.ts` exposes `connect(boardId, token)` → `{ doc, awareness, disconnect }`.
- Dev/tests: mock provider with an in-memory shared `Y.Doc` per `boardId` (no network!).
- Prod: lazy import `y-websocket` (typed via `src/types/y-websocket.d.ts`) and pass a JWT (stub for now).
- Wiring: `useBoardState(boardId, externalDoc?)` accepts an injected `Y.Doc`; defaults to local when flag is off.
- Tests: `src/sandbox/__tests__/realtime.mock.unit.test.ts` verifies isolation (flag off) and shared updates + cleanup (flag on).

## Voting & Alignment
- Flags: `VITE_FEATURE_SANDBOX_VOTING` (gates UI) and `VITE_FEATURE_SANDBOX_REALTIME` (for multi-client sync in dev/tests).
- Submit once per recompute cycle per voter; dedup keyed by `(decisionId, voterId, version)`.
- PRD alignment formula:
  - Normalise votes into [0,1].
  - Compute population std dev for probabilities `σ_p` and confidences `σ_c` separately.
  - Compute theoretical max std dev in [0,1] for the given N, `σ_max(N)` (occurs at half zeros/ones).
  - Scores: `score_p = 100 * (1 - σ_p / σ_max(N))`, `score_c = 100 * (1 - σ_c / σ_max(N))`; final Alignment = `min(score_p, score_c)`.
  - Telemetry: `track('sandbox_alignment', { decisionId, scoreProb, scoreConf, score, ts })`.
- Trigger integration: `LOW_ALIGNMENT` fires (Amber by default) when `score < 60` for two consecutive recomputes.
- Tests: `src/sandbox/__tests__/alignment.prd.unit.test.ts` (formula), `src/sandbox/__tests__/voting.rtl.test.tsx` (submit + trigger).

## Review Mode (skeleton)
- New Review tab under Intelligence.
- Steps: Progress → Decide → Why it moved → Accuracy.
- Persist a stub “review note”; telemetry:
  - `track('sandbox_review', { op: 'start'|'publish', decisionId, ts })`
- Panel: `src/sandbox/panels/ReviewPanel.tsx` (non-destructive; stub storage in `src/sandbox/state/reviewNotes.ts`).
- Tests: `src/sandbox/__tests__/review.rtl.test.tsx` walks the steps and asserts telemetry + note persisted.

## Performance marks (dev only)
- Recompute: `performance.mark/measure('recompute', ...)` in `src/sandbox/state/recompute.ts` with optional console.debug when `VITE_DEBUG_BOARD=true`.
- KR card render: `performance.mark('kr-render')` on accepted recompute version in `src/sandbox/components/KRCard.tsx`.
- Tests: `src/sandbox/__tests__/perf.harness.unit.test.ts` asserts marks were created (no timing thresholds).

## Error boundary & recovery
When the real whiteboard fails to load (e.g., missing package, import/runtime error), the route shows a friendly recovery panel:

- Copy: "Whiteboard failed to load."
- Buttons:
  - Retry — remounts the lazy module and tries again
  - Use mock instead — swaps to the mock without page refresh

Test IDs exposed for QA:
- `sandbox-loading` — Suspense spinner
- `sandbox-mock` — mock wrapper
- `sandbox-real` — real canvas wrapper
- `sandbox-fallback` — error boundary fallback panel

## Keyboard & a11y behaviors (Mock)
- Focusable tile (`data-testid="scenario-tile"`).
- Enter opens right panel; Escape closes panel and restores focus to tile.
- Live status announcements during Generate via a polite status region.
- Probability inputs accept 0–1. `aria-invalid` set only when out of range; inline hint is referenced by `aria-describedby` when invalid.

## Snapshots policy (Single Source of Truth)
- Storage-level snapshots (`src/sandbox/state/snapshots.ts`) are the SSoT.
- Yjs updates are encoded as base64; index is capped at 10 (oldest trimmed).
- Telemetry is emitted at storage only for lifecycle events:
  - `op: 'trim'` when cap is enforced (with `droppedIds`)
  - `op: 'delete'` per explicit delete, including during clear-all
  - `op: 'clear'` once after clear-all
- UI emits intent events only (e.g., save/restore buttons), never trim/delete/clear.
- Snapshot “Clear all” control lives in `SnapshotTray.tsx` to avoid divergent controls.

## DiffView method
- Non-destructive compare: load snapshot payload from storage, `fromB64(ydoc)`, apply to a temporary `BoardState`, and read its `board`.
- Compare current board vs previous for:
  - Nodes: added, removed, label changes
  - Edges: added, removed, likelihood and handle (source/target) changes
- Telemetry:
  - On open: `track('sandbox_diff', { op: 'open', decisionId, beforeId, afterId })`
  - On close: `track('sandbox_diff', { op: 'close', decisionId })`
- A11y: focus initially on Close, Esc closes and restores focus to invoker; list items are focusable; summary uses `aria-live="polite"`.

## Telemetry hook (UI)
- UI must use the hook instead of importing the adapter directly: `import { useTelemetry } from '@/lib/useTelemetry'` → `const { track } = useTelemetry()`.
- The hook auto-attaches `client_ts` when missing. Do not add additional fields beyond normal event props.
- Example:
  ```tsx
  const { track } = useTelemetry()
  track('sandbox_panel', { op: 'tab_select', tab: 'goals', decisionId })
  ```
- Adopted in:
  - `src/sandbox/layout/StrategyBridgeShell.tsx` (open/close + tab select)
  - `src/sandbox/components/SnapshotTray.tsx` (save/restore intents)
  - `src/sandbox/ui/ScenarioSandboxMock.tsx` (generate, group toggle, normalize/even split, handle clicks)

## Dev-only Telemetry Inspector
- Component: `src/sandbox/dev/TelemetryInspector.tsx`.
- Renders only in dev/test (never in prod). Shows the last ~50 events from the in-memory analytics test buffer.
- Use the small toggle button (top bar) in `ScenarioSandboxMock` when flags enable the sandbox and projections.
- Buttons:
  - Clear — calls `__clearTestBuffer()` and refreshes the list.


## Testing policy
- No network. Supabase/OpenAI must be mocked or avoided in sandbox tests.
- Use fake timers where needed; keep UI tests deterministic and fast (<1s ideally).
- Prefer dynamic imports after mocks to ensure module-level side-effects pick up the mocks.
- Use `npm run test:verbose` to get the correct Vitest reporter.
- Toast tests should render a `<Toaster />` and use `vi.useFakeTimers()`.

### FlagsProvider and useFlags (tests)
- UI components no longer read flags directly from `import.meta.env`.
- Wrap renders with `FlagsProvider` via the helper `renderSandbox(ui, flags)` in `src/test/renderSandbox.tsx`.
- Example:
  - `renderSandbox(<SandboxRoute />, { sandbox: true, strategyBridge: true, voting: true })`.

### Performance wrapper
- Use `lib/perf.ts` (`mark`, `measure`) instead of direct `performance.*` calls.
- Tests should not rely on `performance.getEntriesByName`; a fallback counter `__dmRecomputeEntries` is incremented by recompute paths for assertions.

### Unit-first with one RTL smoke per feature
- Prefer pure, side-effect free contracts in unit tests (e.g., `detectCollisions`, `evaluateTriggers`, `mapToProd`).
- Keep a single RTL smoke per feature that verifies provider wiring and essential UI presence.
- Move slower and matrix-style tests (axe/matrix) to a nightly suite.

## Scenario Engine (deterministic)
- Input: a set of options `[{ id, p, c, lastUpdatedMs? }]` (probability p in [0,1], confidence c in [0,1]).
- Midpoint model (p50): confidence-weighted mean of soft-clamped probabilities.
- Soft clamp: avoids exact 0/1 at display extremes to prevent flicker (`eps ≈ 0.01`).
- Confidence decay: exponential decay with half-life (default 14d): `c_eff = c * 0.5^(Δt/halfLife)`.
- Bands: width inversely proportional to average confidence; p10 = clamp(p50 - width), p90 = clamp(p50 + width); guaranteed `p10 ≤ p50 ≤ p90`.

## KR Cards (Goals & OKRs)
- Progressive render: show skeleton until first recompute resolves; then render p50 and bands with a confidence halo.
- Telemetry: emits `track('sandbox_projection', { op: 'recompute', decisionId, krId, reason, ts })` once per recompute version per KR.
- Last updated label shows relative time since the last recompute (`just now`, `Ns ago`, `Nm ago`, ...).

## Triggers & Decision CTA (Intelligence)
- Rules:
  - `KR_MISS_PROJECTION`: High if `p50 < 0.2`, Amber if `< 0.4`.
  - `LOW_ALIGNMENT`: Amber after two consecutive cycles with alignment < 60.
  - `CONFLICTING_IMPACTS`: High when consecutive large swings flip direction (e.g., ≥0.2 then ≤-0.2).
  - `COUNTER_GUARDRAIL_BREACH`: High when |Δp50| exceeds guardrail: manual threshold if present; else dynamic σ (last 12 actuals) with 10% fallback.
  - `STALE_ASSUMPTION`: Amber when last assumptions timestamp exceeds stale window.
- Debounce: 30s per decision.
- Cooldown: 24h unless |Δp50| ≥ 5% (override).
- Priority grouping: choose highest severity if multiple candidates in a window.
- Telemetry payload:
  - `track('sandbox_trigger', { decisionId, rule, severity, priority, payload: { trigger_id, scenario_id, kr_ids, rule }, ts })`
- CTA button navigates to `#/decisions/<id>/frame` when `VITE_FEATURE_SANDBOX_DECISION_CTA=true`.

## Environment examples
- `.env.local.example` (dev-friendly defaults):
  - `VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE=true`
  - `VITE_FEATURE_SANDBOX_PROJECTIONS=true`
  - `VITE_FEATURE_SANDBOX_TRIGGERS_BASIC=true`
  - `VITE_FEATURE_SANDBOX_DECISION_CTA=true`
  - `VITE_FEATURE_SANDBOX_REALTIME=true`
  - `VITE_FEATURE_SANDBOX_VOTING=true`
- `.env.example` (conservative defaults): flags above default to `false` with comments.

## Telemetry mapper (dev → PRD)
- Modes controlled by env:
  - `VITE_ANALYTICS_PROD_SCHEMA` (boolean: enable PRD mapping)
  - `VITE_ANALYTICS_PROD_SCHEMA_MODE` (`mirror` | `replace`) — default `mirror` in dev, `replace` in prod
- Mappings (dev → PRD):
  - `sandbox_projection` → `kr_projection_updated`
  - `sandbox_rival_edit` → `rival_edit`
  - `sandbox_panel` (op: `tab_select`) → `panel_view_changed`
  - `history_archived` → `projections_history_archived`
- Lifecycle passthroughs (names are identical in PRD):
  - `trigger_evaluation_cycle`, `trigger_debounced`, `trigger_cooldown_started`
- Replace mode behavior: when a dev event maps to a PRD name, only the PRD name is emitted. In mirror mode, both are emitted.
- Field normalization for PRD:
  - `decisionId` → `decision_id` (and `board_id` is set to the same value)
  - `ts` → `client_ts`
  - `user_id` is always present (nullable in sandbox)
- De-duplication in test adapter buffer by key: `name|decision_id|client_ts`.

## KR history rotation
- Recompute history per decision is capped at 12 entries.
- When overflow occurs, we accumulate the number of trimmed entries and emit a single `history_archived` on the next non-trim recompute with `{ scenario_id, archived_count, ts }`.
- This batching avoids noisy telemetry during bursty recomputes.
- TODO (server archival): send archived points to an Edge Function to store in `decision_analysis.historical_projections` (RLS), then clear the pending counter.

## Realtime provider URL
- Base URL is provided by `VITE_YJS_PROVIDER_URL` (e.g., `wss://y.example/ws`).
- JWT is carried in the query string: `?token=<jwt>`; for any logs, use `maskToken(url)` to redact to `token=***`.
- The `y-websocket` provider is dynamically imported only in prod and remains flag-guarded; tests/dev always use a shared in-memory `Y.Doc` (no network).

## Alignment small-N note
- PRD alignment uses population standard deviation over [0,1] votes, normalized by the theoretical max std dev `maxStdDev01(n)` (achieved at half zeros/ones).
- Final score = `min(scoreProb, scoreConf)` (0–100).
- Buckets: Low `< 40`, Medium `< 70`, High `≥ 70`.

## Extensibility checklist
- New telemetry ops:
  - For model/panel actions: `src/sandbox/ui/ScenarioSandboxMock.tsx` using `track('sandbox_model', ...)`
  - For snapshot lifecycle: storage layer only (`src/sandbox/state/snapshots.ts`)
- New feature flags: add to `.env.example`, `.env.local.example`, and gate usage in `src/lib/config.ts`.
- Projection/analysis engines: inject where `buildProjection(...)` is used in the mock and expose a stable API for the canvas.

## Troubleshooting
- Missing `@tldraw/tldraw` with `VITE_FEATURE_WHITEBOARD=true` → expect the fallback. Click "Use mock instead" to continue.
- Supabase vars unset → public routes render; auth/data flows will throw if invoked.

## Routes
- Home: `/#/`
- Sandbox: `/#/decisions/<id>/sandbox`
