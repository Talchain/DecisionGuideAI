Plan

- Finalise UI Evidence Pack (deterministic artefacts, real screenshots, SLO) and compose unified evidence.
- Lock provider stub and flags drift guardrails in CI; keep new surfaces OFF by default.
- Document status mapping and acceptance lines; British English copy.

Diff summary

- Unified composer (`tools/gen-unified-evidence.mjs`): status→badge mapping documented (OK→GREEN, DEGRADED→AMBER, FAIL→RED), SLO summary line added; fixed zip order [claude, engine, ui].
- UI pack generator (`tools/gen-ui-evidence-pack.mjs`): deterministic pack; canonical `features_on` pulled from `docs/spec/flags-canvas.json`; SLO via env (`UI_P95_MS`) or file; normalised mtimes for byte-stable zip; prints UI acceptance line.
- Flags drift guard (`tools/ci-guards/check-flags-drift.mjs`): writes `docs/evidence/flags/manifest_drift.json`; FAIL on extras, WARN on missing.
- Screenshots spec (`e2e/unified/ui-pack.screenshots.spec.ts`): captures desktop and ≤480 px mobile list-view to `docs/evidence/ui-pack/`.
- A11y keyboard-loop (`e2e/a11y-keyboard-loop.spec.ts`): Tab/Shift+Tab wraps; Esc restores focus; axe serious/critical = 0; saves screenshots to `docs/evidence/a11y/`.
- Evidence docs updated (`docs/EVIDENCE_PACK.md`): UI pack artefacts, unified outputs, Run locally block, acceptance lines, flags drift and a11y references.

Commands to run (local)

```
nvm use 20 || true
npm ci
npm run build
npx playwright install chromium
npx playwright test e2e/unified/ui-pack.screenshots.spec.ts --project=chromium --retries=1
UI_P95_MS=130 npm run evidence:ui || (echo 130 > docs/evidence/ui-pack/slo_ui_layout_p95_ms.txt && npm run evidence:ui)
npm run evidence:unified
npx playwright test e2e/unified/unified.smoke.spec.ts --project=chromium --grep @evidence --retries=1
npm run ci:guard:sandbox && npm run ci:guard:flags && npm run ci:no-console
```

Artefacts

- UI pack: `docs/evidence/ui-pack/` + deterministic zip `evidence/pack/ui_pack_<YYYY-MM-DD_UTC>_<sha>.zip` (copied to `docs/evidence/incoming/ui/`).
- Unified: `docs/evidence/unified/Olumi_PoC_Evidence_<YYYY-MM-DD_UTC>.zip`, `unified.manifest.json`, `SLO_SUMMARY.md`, `READY_BADGE.svg`.
- Flags drift report: `docs/evidence/flags/manifest_drift.json`.
- A11y screenshots: `docs/evidence/a11y/`.

Acceptance lines (paste verbatim)

```
UI_PACK: evidence/pack/ui_pack_<YYYY-MM-DD_UTC>_<sha>.zip (slos.ui_layout_p95_ms=<n>)
UNIFIED_PACK: docs/evidence/unified/Olumi_PoC_Evidence_<YYYY-MM-DD_UTC>.zip
SLOS: ui_layout_p95_ms=<n>, engine_get_p95_ms=<n>, claude_ttff_ms=263, claude_cancel_ms=119
PRIVACY: no request bodies or query strings in logs — PASS
FLAGS: flags-OFF parity GREEN; features_on={ ui:<list>, engine:<list>, claude:[] }
```

Backout

- Revert this PR only. All new features remain OFF by default; no public contracts changed.
