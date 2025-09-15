# Export Report — HTML Preview + PDF (Sandbox)

## Summary
Adds feature‑flagged HTML and PDF export options to the Combined Sandbox header. HTML export downloads a sanitized, deterministic HTML report; PDF export opens a print dialog for the same content. Both are OFF by default and thread through `FlagsProvider`.

## Flags
- Env: `.env.example`
  - `VITE_FEATURE_EXPORT_REPORT_HTML=false`
  - `VITE_FEATURE_EXPORT_REPORT_PDF=false`
- Client: `src/lib/flags.tsx`
  - `exportReportHtml: false`
  - `exportReportPdf: false`

## Scope
- Builder: `src/whiteboard/export/reportHtml.ts` — pure function returning a sanitized HTML string with:
  - Decision title, UTC ISO timestamp
  - Scenario score
  - Node/link counts
  - Top contributors list (from scoring)
  - Minimal inline CSS, print‑friendly
- UI: `src/whiteboard/CombinedSandboxRoute.tsx`
  - Adds “Report HTML” and “Report PDF” buttons gated by flags
  - Telemetry‑first emission: `sandbox_export_report` with `{ format: 'html'|'pdf', nodeCount, edgeCount }`
  - Deterministic filenames: `decision-<id>-report-YYYYMMDD-HHmmUTC.html`
  - `URL.revokeObjectURL` in `finally {}` for HTML; PDF uses `window.open()` + `document.write()` + `window.print()` with deterministic document title
  - Local polite live region near buttons; ScorePill is the only aria‑live for score

## Security & Privacy
- No remote calls. Content generated from in‑memory graph only.
- Sanitization: user strings passed through `sanitizeString()` which strips C0 control chars (except tab/newline), trims, and caps length.
- No external scripts/styles; minimal inline CSS.

## Accessibility
- Buttons have explicit labels (`aria-label`).
- Local polite status regions adjacent to controls (screen‑reader‑only), avoiding global announcements.
- Keyboard parity via native buttons.

## Telemetry
- Event: `sandbox_export_report`
- Emitted before heavy DOM/Blob work to avoid timing flakiness.
- Minimal meta: `{ decisionId, route:'combined', sessionId, format, nodeCount, edgeCount }`.

## Tests
- Unit: `src/whiteboard/__tests__/export.reportHtml.unit.test.ts`
  - Deterministic HTML with ISO timestamp, counts, and score
  - Control‑char guard allows `\n` / `\t` only
- RTL: `src/whiteboard/__tests__/export.reportHtml.rtl.test.tsx`
  - Click export → exactly one telemetry with `format:'html'`; console noise silenced
- RTL: `src/whiteboard/__tests__/export.reportPdf.rtl.test.tsx`
  - Stubs `window.open/print`; asserts telemetry `format:'pdf'` and `print()` invoked

## QA
1) Enable `VITE_FEATURE_EXPORT_REPORT_HTML=true` and/or `VITE_FEATURE_EXPORT_REPORT_PDF=true`.
2) Open Combined Sandbox route.
3) Click the respective button.
4) HTML: a file downloads with UTC timestamp in the name; PDF: print dialog opens and the document title reflects the deterministic name.

## Rollback
- Fast: keep flags OFF (default).
- Code: revert this PR; changes are isolated to HTML/PDF export flags, builder, UI control, and tests.

## Files Changed
- `.env.example`: new export flags for HTML/PDF
- `src/lib/flags.tsx`: new flags default OFF
- `src/whiteboard/export/reportHtml.ts`: new builder
- `src/whiteboard/CombinedSandboxRoute.tsx`: header controls, telemetry, polite status, URL cleanup
- Tests: `export.reportHtml.unit.test.ts`, `export.reportHtml.rtl.test.tsx`, `export.reportPdf.rtl.test.tsx`

## Labels
ui, a11y, sandbox, tests, skip-changelog
