# Explain Δ v1.5 — Copy + Cap + Focus (flag OFF)

## Scope
- Add `VITE_FEATURE_SANDBOX_EXPLAIN_V15=false` (default OFF) in `.env.example` and plumb `sandboxExplainV15` via `src/lib/flags.tsx`.
- Enhance `ExplainDeltaPanel.tsx`:
  - Copy button (aria-label: “Copy explanation”) gated by `sandboxExplainV15`.
  - Sanitized multi-line Markdown summary (before/after/Δ and top contributors).
  - Contributor cap: top 5; shows `data-dg-explain-limited` banner “Showing top 5 of M” when applicable.
  - Focus management: focus heading on open, restore focus on close.
  - Local polite announcer for copy status. Score live region remains in `ScorePill`.
- Telemetry: `sandbox_score_explain_copy { decisionId, route:'combined', contributorCount, limitedTo? }`.

## A11y
- One score live region only (in `ScorePill`); Explain’s local `aria-live="polite"` is limited to open/copy announcements.
- Dialog-like focus behavior within the panel header: heading is focusable; Esc closes; focus returns to trigger.

## Security
- Copy content sanitized: control chars stripped (except newlines/tabs), whitespace trimmed, and per-line length capped.
- No remote calls. Clipboard API first, `textarea` fallback.

## Tests (telemetry-first)
- `src/whiteboard/__tests__/explain.copy.rtl.test.tsx`: renders panel directly under `FlagsProvider`, mocks telemetry and clipboard, asserts telemetry and content pattern.
- `src/whiteboard/__tests__/explain.limit.unit.test.ts`: verifies limited banner appears when >5 contributors.

## QA
- With `VITE_FEATURE_SANDBOX_EXPLAIN_V15=true`, open Explain Δ, click Copy, confirm clipboard content and toast/live region.
- Confirm contributor list is capped at 5 with the banner when total >5.

## Rollback
- Revert this PR; legacy Explain Δ (no copy/cap) remains behind `VITE_FEATURE_SANDBOX_EXPLAIN`.
