# Sandbox IO — Export/Import JSON (flag OFF)

## Summary (Scope)
- Adds export of current graph to JSON and secure import from JSON to the Combined Sandbox route UI.
- UI-only; no backend changes. Flag-gated and OFF by default.

## Flags
- `VITE_FEATURE_SANDBOX_IO` (default OFF in `.env.example`)

## UX & A11y Guardrails
- Polite live announce on success (e.g., "Imported 2 nodes, 1 edge").
- Overlays remain non-blocking (`pointer-events:none`), with stable `data-dg-*` attributes.
- Keyboard parity: Enter/Space activates buttons; Esc closes menus; tooltips via `title`.
- Only one score `aria-live` exists (in `ScorePill`); IO uses separate polite announce.

## Security / Validation (Import)
- Require `version` in payload.
- Size cap ≤ 2 MB.
- Entity caps: ≤ 500 nodes; ≤ 1000 edges.
- Sanitize all strings (trim, strip control chars, cap length). Clamp numerics.
- On failure: safe toast + telemetry `{ error:true, reason }`.

## Telemetry
- `sandbox_io_export` with minimal meta `{ decisionId, route:"combined", sessionId, nodeCount, edgeCount }`.
- `sandbox_io_import` with minimal meta `{ decisionId, route:"combined", sessionId, nodeCount, edgeCount }`.

## Tests (deterministic, telemetry-first)
- `src/sandbox/__tests__/io.serialize.unit.test.ts` — round-trip normalize/serialize preserves entity counts.
- `src/sandbox/__tests__/io.import.rtl.test.tsx` — import flow, polite announce (optional), and telemetry.
- Heavy components mocked to avoid TL/IDB side effects.

## QA Steps
1. In `.env.local`, set `VITE_FEATURE_SCENARIO_SANDBOX=true` and `VITE_FEATURE_SANDBOX_IO=true`.
2. Navigate to `/decisions/demo/sandbox/combined`.
3. Export JSON; verify file download.
4. Modify or create a small valid JSON and import; verify polite announce and that the graph updates.
5. Verify telemetry contains `sandbox_io_export` and `sandbox_io_import`.

## Risks / Rollback
- Low risk. Fully behind a feature flag (default OFF).
- Rollback: set `VITE_FEATURE_SANDBOX_IO=false` or revert this PR.

## Screenshots
- Attach in PR UI: Header actions with Export/Import; announce toast.

## Labels
- `ui`, `a11y`, `sandbox`, `tests`, `skip-changelog`
