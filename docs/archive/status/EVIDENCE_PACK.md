{{ ... }}
-## Run from GitHub Actions

You can compose and collect all evidence without a local terminal via the manual workflow `Compose Evidence (manual)`.

Inputs:
- `ui_p95_ms` (default `130`): deterministic UI SLO used for `slos.ui_layout_p95_ms`.
- `ui_features_on` (optional): comma-separated flags to enable at runtime for the UI pack; leave blank for all OFF.

The workflow will:
- Build the project and set `TZ=UTC`.
- Install Playwright Chromium and capture UI screenshots.
- Set runtime inputs (`UI_P95_MS`, optional `UI_FEATURES_ON`).
- Emit the UI pack and compose the unified evidence.
- Run the unified smoke and guardrails.
- Upload artefacts: `docs/evidence/unified/**`, `docs/evidence/ui-pack/**`, `evidence/pack/**`, `docs/evidence/flags/manifest_drift.json`.

Acceptance lines (printed in CI logs):
```
UI_PACK: evidence/pack/ui_pack_<YYYY-MM-DD_UTC>_<sha>.zip (slos.ui_layout_p95_ms=<n>)
UNIFIED_PACK: docs/evidence/unified/Olumi_PoC_Evidence_<YYYY-MM-DD_UTC>.zip
SLOS: ui_layout_p95_ms=<n>, engine_get_p95_ms=<n>, claude_ttff_ms=263, claude_cancel_ms=119
PRIVACY: no request bodies or query strings in logs — PASS
FLAGS: flags-OFF parity GREEN; features_on={ ui:<list>, engine:<list>, claude:[] }
```
- - `manifest.json` with: `component:"ui"`, `build`, `features_on` (runtime: `UI_FEATURES_ON` env or `docs/evidence/ui-pack/features_on.json`; canonical `docs/spec/flags-canvas.json` is used only by the drift gate), `privacy.no_queries_in_logs:true`, `slos.ui_layout_p95_ms` (deterministic via env/file), `checksums[]`
{{ ... }}
+Short notes:
+- Features-on sourcing: Prefer `process.env.UI_FEATURES_ON` (comma-separated), else optional `docs/evidence/ui-pack/features_on.json` (array), else `[]`. The canonical `docs/spec/flags-canvas.json` exists solely for the drift gate.
+- Deterministic SLO: Set via `UI_P95_MS` env or `docs/evidence/ui-pack/slo_ui_layout_p95_ms.txt`.
{{ ... }}
