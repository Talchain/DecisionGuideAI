Summary

- Flag-gated features remain OFF by default. Baseline parity intact.
- Robust E2E for Report Drawer; deterministic intercepts; stable filenames (seed-…, model-…).
- Mobile baselines (≤480 px) captured; Simplify SR announcement asserted.
- A11y quick scan (axe) added; no serious/critical issues detected in targeted surfaces.
- UI debug nav logs gated behind DEV + VITE_DEBUG_NAV.

References

- PRD: “Olumi — Scenario Sandbox — PoC — PRD v15”
- Tech Spec: “Scenario Sandbox — Technical Spec & Development Roadmap (vNext)”

Test results (latest)

- Typecheck: 0 errors
- Unit: 113 passed, 0 failed
- E2E (Chromium): Run 1 – 38 passed, 1 skipped; Run 2 – 38 passed, 1 skipped
- Flags-OFF smoke: 1 passed
- Quarantines: none (@flaky not present; one environment-gated test.skip for TLdraw adapter only)

Evidence artefacts

- Mobile (≤480 px)
  - docs/evidence/mobile/mobile_list-first_390x844.png
  - docs/evidence/mobile/mobile_simplify_sr_announcement_390x844.png
  - SR string asserted: “Simplify on: X links hidden under 0.2; press H to toggle.”
- A11y (axe quick scan)
  - docs/evidence/a11y/axe_summary.txt → serious/critical: sandbox=0, reportDrawer=0
- Share-link cap (8 KB)
  - docs/evidence/share/url_cap_evidence.txt (catalogue message captured)
- UI Evidence Pack (ZIP)
  - docs/evidence/ui/evidence-pack-seed777-model-local-sim.zip
  - Contains: snapshot.json, unmodified report.json, health.json, version.json, headers.txt
- STRICT loadcheck p95 (Engine)
  - Pointer: docs/evidence/loadcheck/p95.json (Pending here; target p95 ≤ 600 ms; run in Engine repo with STRICT_LOADCHECK=1 node tools/loadcheck-wrap.cjs)

Non-negotiables (confirmed)

- Flags-OFF parity unchanged; public shapes & SSE names unchanged.
- British English catalogue strings; USD ($) costs.
- No payloads/tokens/headers or query strings logged by UI; navDebug gated.
- Engine Mode fixtures remain immutable in UI pack.
- Determinism documented (ETag/304; implicit HEAD mirrors GET).

Acceptance

ACCEPTANCE: Flags-OFF parity green; baseline unchanged.
ACCEPTANCE: Report drawer E2E navigates with shared helpers and passes deterministically.
ACCEPTANCE: Mobile baselines captured (≤480 px) with List-first screenshot and SR announcement evidence.
ACCEPTANCE: Evidence Pack updated with mobile artefacts; loadcheck p95 pointer present.
ACCEPTANCE: UI debug logs gated behind DEV + VITE_DEBUG_NAV; no query strings or secrets logged.
ACCEPTANCE: Share-link 8 KB cap evidenced with the catalogue message.
ACCEPTANCE: A11y checks pass (axe quick scan documented).

How to verify locally

- npx playwright show-report
- Evidence locations are under docs/evidence/* as listed above.
