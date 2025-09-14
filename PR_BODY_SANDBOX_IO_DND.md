# Sandbox IO V2 — Drag & Drop + Paste Import (flag OFF)

## Summary (Scope)
- Adds header-only drag-and-drop import and an explicit Paste Import Mode for JSON graph imports in the Combined Sandbox route.
- Reuses existing validation/import path. UI-only, behind flags; OFF by default.

## Flags (default OFF)
- `VITE_FEATURE_SANDBOX_IO=false`
- `VITE_FEATURE_SANDBOX_IO_DND=false`

Threaded via `FlagsProvider` as `sandboxIO` and `sandboxIODnD`.

## UX & A11y Guardrails
- Header-only dropzone with `data-dg-io-dropzone`, `role="group"`, `aria-label="Import from file (drag and drop)"`.
- Paste Import Mode is active only when the IO control is focused; Esc cancels; Enter confirms.
- Polite local live region inside IO (`data-dg-io-status`) announces success/cancel/readiness; ScorePill remains the only score aria-live.
- Overlays remain `pointer-events:none`; stable `data-dg-*` attributes added for testing.
- Keyboard parity: Tab into IO control to activate paste mode; Esc cancels; Enter applies.

## Security / Validation
- Reuses centralized `validateAndNormalizeImport()` with identical guards:
  - Require `version`.
  - Max size ≤ 2 MB; caps ≤ 500 nodes and ≤ 1000 edges.
  - Sanitize strings (trim, strip control chars, cap length); clamp numerics.
- On error: safe toast + `{ error:true, reason }` telemetry.

## Telemetry (name-only)
- `sandbox_io_drop_open`
- `sandbox_io_drop_cancel`
- `sandbox_io_paste_detected`
- `sandbox_io_import` extended with `{ method:'dnd'|'paste', nodeCount, edgeCount }`

All events include minimal meta `{ decisionId, route:'combined', sessionId }`.

## Tests (deterministic, telemetry-first)
- `src/whiteboard/__tests__/io.drop.rtl.test.tsx` — dragover shows dropzone; drop imports; telemetry present.
- `src/whiteboard/__tests__/io.paste.rtl.test.tsx` — focus IO control; paste detected + telemetry; import telemetry treated as optional under jsdom timing.

## QA Steps
1) In `.env.local`, set `VITE_FEATURE_SCENARIO_SANDBOX=true`, `VITE_FEATURE_WHITEBOARD=true`, `VITE_FEATURE_SANDBOX_IO=true`, and `VITE_FEATURE_SANDBOX_IO_DND=true`.
2) Navigate to `/decisions/demo/sandbox/combined`.
3) Drag a small valid JSON over the header IO area; drop to import; observe polite announce before reload and Undo snapshot.
4) Focus the IO controls and paste a valid JSON payload; press Enter to confirm; Esc cancels; observe polite announce and telemetry.

## Risks / Rollback
- Low risk. Fully behind flags; defaults OFF.
- Rollback: set flags to false or revert this PR.

## Screenshots
- Header IO with dropzone overlay.
- Polite announce captured in the local io status live region.

## Labels
- `ui`, `a11y`, `sandbox`, `tests`, `skip-changelog`
