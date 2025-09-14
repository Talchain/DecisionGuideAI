# Sandbox Templates — Quickstart (flag OFF)

## Summary (Scope)
- Adds a Templates menu in the Combined Sandbox header to quickly seed a small starter graph.
- UI-only; no backend changes. Flag-gated and OFF by default.

## Flags
- `VITE_FEATURE_SANDBOX_TEMPLATES` (default OFF in `.env.example`)

## UX & A11y Guardrails
- Menu is keyboardable (Enter/Space to open/apply; Esc to close).
- Polite announce on apply (e.g., "Template applied"), followed by Undo banner.
- Overlays remain non-blocking (`pointer-events:none`), with stable `data-dg-*` attributes.
- Only one score `aria-live` remains in `ScorePill`.

## Telemetry
- `sandbox_template_apply` with minimal meta `{ decisionId, route:"combined", sessionId, templateId, nodeCount, edgeCount }`.

## Tests (telemetry-first)
- `src/sandbox/__tests__/template.load.unit.test.ts` — each template normalizes and has non-zero counts.
- `src/sandbox/__tests__/template.apply.rtl.test.tsx` — open menu → apply → polite announce (optional) → Undo → telemetry.

## QA Steps
1. In `.env.local`, set `VITE_FEATURE_SCENARIO_SANDBOX=true` and `VITE_FEATURE_SANDBOX_TEMPLATES=true`.
2. Navigate to `/decisions/demo/sandbox/combined`.
3. Open Templates menu; apply a template.
4. Verify polite announce, Undo banner, and telemetry `sandbox_template_apply`.

## Risks / Rollback
- Low risk. Fully behind a feature flag (default OFF).
- Rollback: set `VITE_FEATURE_SANDBOX_TEMPLATES=false` or revert this PR.

## Screenshots
- Attach in PR UI: Templates menu open; after apply with Undo banner.

## Labels
- `ui`, `a11y`, `sandbox`, `tests`, `skip-changelog`
