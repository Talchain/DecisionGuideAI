# Evidence Pack

## Versions
- Node: v22.15.0
- npm: 10.9.2

## Command Log (local, latest run)
1. npm run typecheck → 0 errors
2. npm run test:unit → 56 files, 113 tests passed, 0 failed
3. npx playwright install chromium → ok
4. npm run test:e2e:chromium -- --grep-invert @flaky → 38 passed, 1 skipped, 0 failed (run 1)
5. npm run test:e2e:chromium -- --grep-invert @flaky → 38 passed, 1 skipped, 0 failed (run 2)
6. npm run test:e2e:chromium -- --grep "flags-off" → 1 passed

## Pass Counts
- Typecheck: 0
- Unit: 113/113 passed
- E2E (Chromium, non-flaky): 38 passed, 1 skipped, 0 failed (twice)
- Flags-OFF smoke: 1 passed

## Flags-OFF Parity
- Baseline unchanged. Verified by `e2e/flags-off.smoke.spec.ts` and baseline flows.

## Determinism
- With fixtures + fixed seed, token count, total cost, Report v1 payload, and download filenames are identical across runs.
- Caching semantics: ETag/304 supported by the Engine; UI requests do not disable caching.
- HEAD behaviour: implicit HEAD mirrors GET contract at the Engine; UI tolerates HEAD/GET equivalence in tests.

## Accessibility
- Screen-reader announcements:
  - "Suggestion applied. You can press Undo."
  - "Undone."
  - "Comment deleted"
- Drawers restore focus to triggering control on close (Esc).

## Health Tooltip Examples
- Minimal: `status: ok, p95: 123ms`
- Extended: `status: ok, p95: 123ms, v1.2.3, replay: idle`
- Never shows the literal word "undefined".

## Captured Artefacts
- Playwright HTML report: run `npx playwright show-report`
- Download filename captured (report): `report_v1_seed-4242_model-local-sim.json`
- Summary v2 screenshot (local): open `/#/sandbox` with `feature.summaryV2=1` and capture the main panel showing chips + three cards.

## Share-link cap evidence
- Evidence path: `docs/evidence/share/url_cap_evidence.txt`
- Expected catalogue message: `Link too large; please use Export/Import JSON`

## UI Evidence Pack (ZIP)
- Path: `docs/evidence/ui/evidence-pack-seed777-model-local-sim.zip`
- Contents:
  - `snapshot.json`
  - `report.json` (fixture bytes, unmodified)
  - `health.json`
  - `version.json`
  - `headers.txt` (redacted; no secrets)

## A11y quick scan
- Summary file: `docs/evidence/a11y/axe_summary.txt`
- Target: `0` critical/serious; otherwise list succinctly.


## Mobile baselines (≤480 px)
- List-first baseline: `docs/evidence/mobile/mobile_list-first_390x844.png`
- Simplify SR announcement baseline: `docs/evidence/mobile/mobile_simplify_sr_announcement_390x844.png`
- SR string asserted (polite):
  - `Simplify on: X links hidden under 0.2; press H to toggle.`

## Loadcheck (STRICT)
- Artefact pointer: `docs/evidence/loadcheck/p95.json` (added when the Engine run lands)
- Target budget: p95 ≤ 600 ms
- Command used in Engine repo: `STRICT_LOADCHECK=1 node tools/loadcheck-wrap.cjs`

## Server Access Log Hygiene (Engine PR7)
- Access logs must exclude query strings. Tracked as a separate PR in the Engine repo (PR7).
- Unit test will assert logs contain route path only and exclude sensitive query params.

## Feature Gate Hygiene
- All new features remain OFF by default. Specs explicitly enable needed flags via `page.addInitScript` or mocks.
- No payloads or secrets are logged.

## Notes
- Currency displayed in the UI is USD. Transcript exports and history badges use `$`.
- Filenames are generated via `formatDownloadName(kind, { seed, model, ext })` across reports, transcripts, and snapshots.
