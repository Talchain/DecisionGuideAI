# Compare — Legend container + tooltips (UI polish)

## Summary (Scope)
- Adds a stable `data-dg-legend` container around Compare legend chips and ensures `title` tooltips for Added/Removed/Changed.
- UI-only polish; no behavior or backend changes. No flags added.

## UX & A11y Guardrails
- Non-blocking overlays preserved; legend remains part of the header UI.
- Stable attribute `data-dg-legend` improves testability and a11y tooling.
- Keyboard parity unchanged; tooltips via `title` attributes.

## Telemetry
- None added; Compare telemetry remains unchanged.

## Tests
- `src/whiteboard/__tests__/compare.legend.rtl.test.tsx`: opens Compare, verifies presence of `data-dg-legend` container and three chips with `title` tooltips.
- Heavy components mocked for determinism.

## QA Steps
1. Enable mapping/compare flags as needed for combined view.
2. Navigate to `/decisions/demo/sandbox/combined`.
3. Click Compare; verify legend area includes `data-dg-legend` and chips have tooltips.

## Risks / Rollback
- Very low risk; UI-only polish.
- Rollback: revert this PR.

## Screenshots
- Attach in PR UI: header with Compare open and legend visible.

## Labels
- `ui`, `a11y`, `sandbox`, `tests`, `skip-changelog`
