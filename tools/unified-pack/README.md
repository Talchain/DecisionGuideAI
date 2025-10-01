# Unified Evidence Composer

Pilot-ready tool for composing evidence packs from UI, Engine, and Claude components into a single unified artefact with deterministic checksums, schema validation, and SLO reporting.

## Features

- **Deterministic composition**: Stable ordering, no extended attributes, byte-exact reproducibility
- **Schema validation**: Conditional SLO requirements per component type
- **Checksum verification**: SHA-256 validation for all files within packs
- **Size enforcement**: Configurable per-zip and total size caps
- **SLO reporting**: Automated SLO_SUMMARY.md and READY_BADGE.svg generation
- **CI-ready**: Structured output for pipeline integration

## Usage

```bash
node tools/unified-pack/compose.mjs \
  --ui-pack docs/evidence/ui-pack \
  --engine-in docs/evidence/incoming/engine \
  --claude-in docs/evidence/incoming/claude \
  --out docs/evidence/unified \
  --print
```

### CLI Flags

- `--ui-pack <dir>` — Directory containing ui-pack.zip
- `--engine-in <dir>` — Directory with engine_pack_*.zip files
- `--claude-in <dir>` — Directory with claude_pack_*.zip files
- `--out <dir>` — Output directory for unified artefacts
- `--date <YYYY-MM-DD_UTC>` — Optional date override (default: current UTC date)
- `--max-zip-bytes <int>` — Per-zip size cap (default: 52428800 = 50MB)
- `--max-total-bytes <int>` — Total size cap (default: 157286400 = 150MB)
- `--print` — Print acceptance lines to stdout

## Output Artefacts

1. **Olumi_PoC_Evidence_<date>.zip** — Unified evidence pack containing source zips
2. **unified.manifest.json** — Merged manifest with component metadata, SLOs, and totals
3. **SLO_SUMMARY.md** — Markdown table with SLO values, thresholds, and status icons
4. **READY_BADGE.svg** — Visual badge (GREEN/AMBER/RED) indicating readiness

## SLO Thresholds

| Metric | Threshold |
|--------|-----------|
| ui_layout_p95_ms | ≤ 150ms |
| engine_get_p95_ms | ≤ 600ms |
| claude_ttff_ms | ≤ 500ms |
| claude_cancel_ms | ≤ 150ms |

## Component Schema Requirements

- **ui**: Must provide `slos.ui_layout_p95_ms`
- **engine**: Must provide `slos.engine_get_p95_ms`
- **claude**: Must provide `slos.claude_ttff_ms` and `slos.claude_cancel_ms`

All components must include:
- `component` (enum: ui|engine|claude)
- `build` (string)
- `checksums` (array of {file, sha256})

## Pack Discovery

For `engine` and `claude`:
- Selects latest pack by (1) date descending, (2) shortsha lexical descending, (3) mtime descending
- Expected filename pattern: `*_YYYY-MM-DD_UTC_<shortsha>.zip`

## Error Discipline

On failure, prints exactly three lines:
```
Symptom: <one line>
Likely cause: <one line>
Minimal patch plan: <one line>
```

Then exits with code 1.

## Acceptance Output

When `--print` is enabled:

```
UNIFIED_PACK: docs/evidence/unified/Olumi_PoC_Evidence_<date>.zip
SLOS: ui_layout_p95_ms=<n|null>, engine_get_p95_ms=<n|null>, claude_ttff_ms=<n|null>, claude_cancel_ms=<n|null>
PRIVACY: informational only (see component packs)
FLAGS: informational only (see component packs)
ACCEPTANCE:COMPOSER: Created unified zip + manifest + SLO_SUMMARY.md
ACCEPTANCE:SLO: ui_layout_p95_ms=<…> / engine_get_p95_ms=<…> / claude_ttff_ms=<…> / claude_cancel_ms=<…> (✅/⚠️)
ACCEPTANCE:SIZE: per-zip ≤ 50MB, total ≤ 150MB
ACCEPTANCE:CHECKSUMS: all component checksums verified
```

## Dependencies

- Node.js 20+ (ESM)
- `unzip` command (installed via CI or locally available)

No npm dependencies required — pure Node.js stdlib implementation.

## CI Integration

See `.github/workflows/unified-evidence.yml` for GitHub Actions integration with artefact upload and 14-day retention.