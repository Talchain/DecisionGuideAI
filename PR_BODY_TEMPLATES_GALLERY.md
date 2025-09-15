# Templates Gallery (flag OFF) — PR Body

## Scope
- Replace Templates menu with a keyboardable popover gallery under flags.
- Search, arrow navigation, Enter to apply, Esc to close. Focus returns to trigger.
- Apply reuses snapshot backup → storage replace → polite announce → microtask → reload → toast.

## Flags (default OFF)
- VITE_FEATURE_SANDBOX_TEMPLATES=false
- VITE_FEATURE_SANDBOX_TEMPLATES_GALLERY=false

Threaded via `FlagsProvider` as `sandboxTemplates` and `sandboxTemplatesGallery`.

## A11y & UX
- Popover `role="dialog"` with focus trap; Esc closes; focus returns to Templates button.
- Search input has `aria-label="Search templates"`.
- Cards are keyboardable with `data-dg-template-card`; Arrow keys change selection; Enter applies.
- Local polite live region `data-dg-template-status` announces actions; ScorePill remains the only score aria-live.
- Overlays are `pointer-events:none`; stable `data-dg-*` selectors.

## Security
- No remote calls. Applies static templates only.
- Sanitize text fields and clamp lengths via existing normalize path.

## Telemetry
- `sandbox_template_preview_open`
- `sandbox_template_preview_close`
- `sandbox_template_apply` extended with `{ source:'gallery', templateId, nodeCount, edgeCount }`

All events include `{ decisionId, route:'combined', sessionId }`.

## Tests (telemetry-first)
- `src/sandbox/__tests__/template.gallery.rtl.test.tsx`: open → open telemetry; filter + arrow → Enter applies; asserts `sandbox_template_apply` with `source:'gallery'`.
- Undo banner presence is optional.

## QA
1) Enable flags in `.env.local`: set `VITE_FEATURE_SCENARIO_SANDBOX=true`, `VITE_FEATURE_WHITEBOARD=true`, `VITE_FEATURE_SANDBOX_TEMPLATES=true`, `VITE_FEATURE_SANDBOX_TEMPLATES_GALLERY=true`.
2) Go to `/decisions/demo/sandbox/combined`.
3) Click Templates → popover opens. Type to filter; use Arrow keys then Enter on a card.
4) Expect polite announce before reload; Undo button visible; telemetry events emitted.

## Rollback
- Low risk. Flags default OFF. Toggle flags or revert this PR.

## Labels
- ui, a11y, sandbox, tests, skip-changelog
