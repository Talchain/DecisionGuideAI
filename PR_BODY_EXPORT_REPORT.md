# Export Report (Markdown) — Sandbox

## Summary
Adds a feature‑flagged Export Report (Markdown) action to the Combined Sandbox route header. When enabled, users can export a concise Markdown report of the current decision graph including scenario score, entity counts, and top contributors. The feature is gated OFF by default.

## Flags
- Env: `VITE_FEATURE_EXPORT_REPORT=false` (default OFF). Added to `.env.example`.
- Client: `exportReport: boolean` in `src/lib/flags.tsx` (default false), provided via `FlagsProvider` and read with `useFlags()`.

## Scope
- UI: Adds a gated “Report MD” button in `src/whiteboard/CombinedSandboxRoute.tsx` header.
- Builder: `src/whiteboard/export/reportMarkdown.ts` — pure function that generates a sanitized Markdown report from the in‑memory graph.
- Telemetry: Emits `sandbox_export_report` before any DOM/file operations to avoid timing flakes.
- Tests: Focused unit (builder) and RTL (UI + telemetry) tests.

## Accessibility
- Button has clear label: `aria-label="Export report (Markdown)"`.
- Polite, scoped status announcement via an sr‑only live region adjacent to the control (no global interruptions). Announcement example: “Exported Markdown report with N nodes, M links.”
- Keyboard parity: Button is a native `<button>`; Enter/Space trigger handled by browser.
- Overlays: None.

## Security & Privacy
- No remote calls. Export uses the current local graph only.
- Sanitization: Markdown builder uses `sanitizeString()` (from graph IO) to strip control characters (except tab/newline), trim, and length‑limit strings.
- Numeric values are clamped downstream in the scoring utilities. No unbounded sizes; no user‑provided HTML in output.

## Telemetry
- Event: `sandbox_export_report`
- When: Emitted before creating the Blob/URL to avoid jsdom/browser timing flakes.
- Meta (minimal): `{ decisionId, route: 'combined', sessionId, format: 'md', nodeCount, edgeCount }`.

## Testing
- `src/whiteboard/__tests__/export.report.unit.test.ts`
  - Verifies deterministic Markdown with fixed timestamp, entity counts, and scenario score line.
  - Guards against unwanted control characters (allows tab/newline).
- `src/whiteboard/__tests__/export.report.rtl.test.tsx`
  - Mocks heavy components and asserts that clicking “Report MD” emits `sandbox_export_report`.
  - Treats live‑region text as optional.

## QA
1) In `.env.local`, set `VITE_FEATURE_EXPORT_REPORT=true`.
2) Load Combined Sandbox route (e.g., `/decisions/demo/sandbox/combined`).
3) Click “Report MD”.
4) Verify: File download prompt with `decision-<id>-report.md`; a polite status message is announced; telemetry is emitted once.

## Rollback Strategy
- Fast: Turn the flag OFF (default).
- Code: Revert the PR. Changes are isolated to the feature gate, builder, telemetry type, and tests.

## Files Changed
- `.env.example`: added `VITE_FEATURE_EXPORT_REPORT=false`.
- `src/lib/flags.tsx`: added `exportReport` flag (default false).
- `src/lib/useTelemetry.ts`: added `sandbox_export_report` event type.
- `src/whiteboard/export/reportMarkdown.ts`: new pure builder.
- `src/whiteboard/CombinedSandboxRoute.tsx`: header control, telemetry emission, scoped live region.
- Tests: `export.report.unit.test.ts`, `export.report.rtl.test.tsx`.

## Labels
ui, a11y, sandbox, tests, skip-changelog
