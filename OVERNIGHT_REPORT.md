# Overnight Report — gates/v0.3.4-overnight

## [UTC 2025-10-07 12:04] Summary
- Branch: gates/v0.3.4-overnight
- Intent: Keep P0 green; harden e2e guardrails (zoom-center, layering); add pack-lint regex tests.

## Checks
- typecheck: PENDING
- lint: PENDING
- unit: PENDING
- e2e: PENDING
- ci:all: PENDING

## GATES lines (emitted)
- (will append as steps run)

## Changes (surgical)
- tools/pack-lint/bin/lint.mjs — regex + GATES output
- tests/pack-lint.test.ts — unit tests for regex
- e2e/plot.smoke.spec.ts — zoom-center and toolbar layering tests with GATES logs
- package.json — e2e retries + line reporter
- src/routes/PlotWorkspace.tsx — add data-testid="sticky-note" (no behavior change)
- src/components/DecisionGraphLayer.tsx — remove pointer capture; fix lint unused param

## Notes
- No pointer capture in mouse handlers.
- Coordinate math via src/utils/cameraMath.ts; typing guard via src/utils/inputGuards.ts.
