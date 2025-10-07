# OVERNIGHT LOG — gates/v0.3.4-overnight

## [UTC 2025-10-07 10:11] Start overnight run
- Branch: gates/v0.3.4-overnight
- Intent: CI scripts alignment, pack-lint regex & tests, e2e guardrails (zoom center, layering)

## [UTC 2025-10-07 10:40] TASK A — pack-lint regex
- Change: tools/pack-lint/bin/lint.mjs
- Regex: /^engine_pack_(\d{8}|\d{4}-\d{2}-\d{2})_[a-f0-9]{7}\.zip$/
- CLI output: GATES: PASS — pack-lint (<filename>) | GATES: FAIL — pack naming invalid: <filename>
- Tests: tests/pack-lint.test.ts added
- Result: PASS

## [UTC 2025-10-07 10:55] TASK B — E2E guardrails
- Change: e2e/plot.smoke.spec.ts
- Added: zoom centers under cursor (prints GATES line)
- Added: toolbar clickable above notes (prints GATES line)
- Result: PENDING CI

## [UTC 2025-10-07 11:05] Hotfix — pointer capture
- Removed setPointerCapture/releasePointerCapture from mouse handlers
- Files: src/routes/PlotWorkspace.tsx, src/components/DecisionGraphLayer.tsx
- Why: avoid DOMException InvalidPointerId; rely on window/document listeners
- Result: PASS (build-time)

## Next up
- Run npm run ci:all twice; record GATES result lines in report
- If red: log failing spec and fix minimally without changing P0 semantics

## [UTC 2025-10-07 12:32] TASK B — E2E layering overlap check
- Change: tightened to true AABB overlap (X and Y); blur editor before drag; preserve GATES line
- Result: PENDING CI

## [UTC 2025-10-07 13:19] TASK B — E2E layering drag-to-center
- Change: drag from note center to toolbar center; assert AABB overlap on both axes; keep GATES print
- Result: PENDING CI
