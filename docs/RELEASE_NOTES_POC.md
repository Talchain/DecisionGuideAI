# DecisionGuideAI — PoC Stabilisation → Release-Ready Polish

Date: 2025-09-29
Branch: feat/night-shift-epic

## Summary
- Dynamic Simplify threshold (0.3 default; auto-raise to 0.4 at ≤480 px or >12 nodes) with a single badge and SR text.
- Reduced motion honoured globally (CSS) and validated by E2E; pending microtask path in `scheduleFlush()` to avoid RAF under reduced motion.
- Engine Adapter Audit Panel: displays last status (200/304), cached ETag, and headers (ETag, Content-Length, Cache-Control, Vary). Verified no mutation on 304 and no flicker.
- Vendored accessibility scans via `@axe-core/playwright` across Sandbox + Simplify + Audit + (extended) Report, Share read-only, Compare.
- Production hygiene: esbuild drops `console`/`debugger`. CI scan to keep bundles clean.
- Evidence pack immutability guard: `report.json` bytes hashed and compared against fixture.

## Feature flags
All new features remain OFF by default. Tests/specs enable flags via `localStorage` at runtime.
- SSE streaming: `feature.sseStreaming`
- Simplify: `feature.canvasSimplify`
- List View: `feature.listView`
- Run Report: `feature.runReport`
- Snapshots: `feature.snapshots`
- Compare: `feature.compare`
- Engine Mode (audit demo): `feature.engineMode`

## Evidence artefacts
- Audit Panel (200 → 304): `docs/evidence/audit/audit_panel_200_304.png`
- Vendored axe summary: `docs/evidence/a11y/axe_summary.txt` (target: 0 serious/critical)
- Perf probe (worker layout, 20 nodes): `docs/evidence/perf/worker_20_nodes.json` (target ≤150 ms)
- UI evidence pack (ZIP): `docs/evidence/ui/evidence-pack-seed777-model-local-sim.zip`
- Share-link cap: `docs/evidence/share/url_cap_evidence.txt` (friendly catalogue message)

## Determinism & hygiene
- ETag/304 semantics preserved; UI does not mutate state on 304.
- Implicit HEAD mirrors GET contract at the Engine and is tolerated by UI.
- No payloads, headers, or query strings are logged. Production bundles strip `console.*`.

## Cross-browser notes
- Chromium is the primary target for the full suite.
- Firefox/WebKit spot checks: Summary V2, Report download, Report drawer, Snapshots (read-only), Engine Audit Panel.
- Any platform-specific quirks (pointer events, focus restore) will be listed here if encountered.

## How to regenerate evidence
- A11y: `npm run evidence:a11y`
- UI Pack: `npm run evidence:ui-pack`
- Share cap: `npm run evidence:share-cap`
- Perf: `npx playwright test e2e/perf-worker.spec.ts --project=chromium -c playwright.config.ts`

## Acceptance checklist
- Reduced motion honoured (CSS + microtask path for `scheduleFlush()`), no flicker; strings unchanged.
- Engine audit panel surfaces headers and cached ETag; 304 fetches do not mutate state.
- Vendored axe scans report 0 serious/critical issues.
- CI green (Chromium full; Firefox/WebKit spot checks). Production bundles drop console/debugger.
- Evidence Pack updated (audit + a11y + immutability + perf). Determinism and Flags-OFF parity documented.
