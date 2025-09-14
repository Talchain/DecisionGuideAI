# Explain Score Δ (V1) — PR Body

## Scope
- UI-only, flag-gated implementation of Explain Score Δ for the combined Sandbox route.
- Adds a small side panel that explains the scenario score delta (Δ) and highlights contributors on the canvas.
- No backend/schema or network changes.

## Flags
- VITE_FEATURE_SANDBOX_EXPLAIN (default OFF in .env.example)
- Entry: when ON and Δ ≠ 0, `ScorePill` shows an "Explain Δ" link.

## UX
- Panel: `ExplainDeltaPanel` (non-modal) with `role="region"`; open from the ScorePill link; Close button and Esc both close the panel.
- Highlight: clicking a contributor row applies a transient (≈1200ms) non-blocking highlight ring over the corresponding node on the canvas.
- Overlays: remain pointer-events:none with stable tags:
  - `data-dg-explain="true"` on the panel
  - `data-dg-explain-highlight` and `[data-dg-explain-overlay]` on the canvas

## A11y Guardrails
- One and only one score `aria-live="polite"` (stays in `ScorePill`).
- Panel includes an internal `aria-live="polite"` only for open/close announcements (no score announcements here).
- Buttons have accessible names; panel uses `role="region"` with a heading.

## Telemetry Guardrails
- Name-only telemetry with standard meta `{ decisionId, route:'combined', sessionId }`.
- Events:
  - `sandbox_score_explain_open`
  - `sandbox_score_explain_close`
- Debounced/noisy actions avoided; no spam during normal interactions.

## Deterministic Tests
- Domain explain helper unit test: totals, clamping, sort order.
- Link gating RTL: link appears only when flag ON and Δ ≠ 0; click triggers open.
- Telemetry unit: open → close emits expected events (hoisted mocks, fake timers, final 0ms flush).
- Panel RTL: opens, lists contributors, click → canvas highlight attribute set, closes on Esc.
- TLDraw polyfills centralized in `src/test/setup.ts` (FontFace + document.fonts.add) to remove jsdom flakiness.

## QA Steps
1) In `.env.local`, set `VITE_FEATURE_SCENARIO_SANDBOX=true`, `VITE_FEATURE_WHITEBOARD=true`, `VITE_FEATURE_SANDBOX_SCORE=true`, `VITE_FEATURE_SANDBOX_WHATIF=true`, and `VITE_FEATURE_SANDBOX_EXPLAIN=true`.
2) Navigate to `/decisions/demo/sandbox/combined`.
3) Toggle a What-If (disable a node) to produce a non-zero Δ; confirm the "Explain Δ" link appears next to the score.
4) Click "Explain Δ": panel opens. Verify before/after and Δ text in header.
5) Click a contributor row: a transient highlight ring is rendered over the corresponding node (non-blocking overlay).
6) Press Esc: panel closes; re-open via link to re-verify.
7) Verify only one score live region exists (ScorePill), while the panel announces open/close politely.

## Risk & Rollback
- Low risk. All changes are behind feature flags (default OFF in `.env.example`).
- Rollback: set `VITE_FEATURE_SANDBOX_EXPLAIN=false` or revert this PR; no migration or state changes required.

## Screenshots (attach in PR UI)
- Desktop: Combined route with panel opened, showing before/after and contributors.
- Mobile: Combined route on small viewport, panel open with accessible navigation.
