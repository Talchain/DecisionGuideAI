// tests/ci-guards/canvas-gate-registry-covers-geometry.spec.ts
// =============================================================================
// THE CANVAS GATE'S REGISTRY MUST ACCOUNT FOR THE DIRECTORY IT DESCRIBES.
// =============================================================================
//
// `e2e/geometry/canvasGateSet.ts` is this repo's authority on what the Canvas
// Browser Gate watches and why. Its header promises the gated set "cannot grow,
// shrink, or drift without a human editing this file", and for the GATED half
// that is true and enforced — `canvasGateTeardown.ts` asserts the set that ran
// against `GATED_TESTS` by name, in both directions.
//
// ⚠ THE OTHER HALF WAS PRINTED, NOT ASSERTED. `canvasGateTeardown.ts` ends with
// `DELIBERATE_EXCLUSIONS.map(e => console.log(...))` and checks nothing about
// it. So a `*.measure.ts` file could land in `e2e/geometry` and be neither
// gated nor recorded as a deliberate exclusion, and NOTHING WOULD GO RED — a
// hand-maintained mirror sitting inside the registry written to end
// hand-maintained mirrors (CLAUDE.md trap 12).
//
// IT HAD ALREADY DRIFTED. Measured at `b14cd478`: 26 `*.measure.ts` on disk,
// FOUR named nowhere in the registry — `leadingPillCorner`, `legendViewportFit`,
// `statusPillCorner` (merged while PR #1169 was open) and
// `showWholeModelDockBudget` (#1165). Contrast control in the same sweep so the
// zero is not the instrument's: `nodeKeyboardBleed` 7 mentions,
// `modelRowEditReflow` 2, 22 of 26 non-zero.
//
// ── ⭐ WHY HERE AND NOT ONLY IN THE TEARDOWN ─────────────────────────────────
// The teardown throws on this too, now. But the `canvas-gate` job is
// `continue-on-error: true` and ABSENT from the `Staging Gate` aggregator's
// `needs` (derived at `staging-full-tests.yml`: `needs: [tsc,
// typecheck-selftest, vitest, vitest-summary, build]`), and `staging`
// protection requires exactly that one context. A red there blocks nobody.
// `tests/**` runs in the `vitest` job, which IS required — so drift caught here
// blocks a merge, in milliseconds, with no browser. Same posture, and the same
// reasoning, as `core-completeness-guard.spec.ts`.
//
// ── AND IT IS SHOWN TO DISCRIMINATE, NOT MERELY TO AGREE ─────────────────────
// A coverage checker that returns "all accounted for" is indistinguishable from
// one pointed at an empty directory, or one whose matcher never matches. So the
// real tree is asserted clean AND the same pure function is run over planted
// inputs in all three failure directions, each of which must come back naming
// exactly the planted item (CLAUDE.md trap 13 — an absence probe needs a
// positive control; trap 13b — presence of a control is not coverage).

import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { GEOMETRY_DIR, MEASURE_SUFFIX } from '../../e2e/geometry/canvasGatePaths'
// `registryCoverage()` defaults to the real `GATED_TESTS` / `DELIBERATE_EXCLUSIONS`,
// which is what the two real-tree tests below exercise; the controls inject
// synthetic ones so each fails for exactly one reason.
import { coverageFailureMessage, registryCoverage } from '../../e2e/geometry/canvasGateSet'

function measureFilesOnDisk(): string[] {
  return readdirSync(GEOMETRY_DIR)
    .filter((f) => f.endsWith(MEASURE_SUFFIX))
    .sort()
}

describe('canvas gate registry covers e2e/geometry', () => {
  it('reads a plausible directory — a coverage pass over nothing is not a pass', () => {
    const files = measureFilesOnDisk()
    // Non-vacuity, bound by IDENTITY rather than by a count: a hardcoded floor
    // would be one more hand-maintained mirror, and it is the count that moves.
    // These two files are named by `GATED_TESTS`, so if the read cannot see
    // them the read is broken, not the registry.
    expect(files, 'no *.measure.ts found — the directory read is broken, not the registry').not.toHaveLength(0)
    expect(files).toContain('nodeKeyboardBleed.measure.ts')
    expect(files).toContain('overlayNodeOverlap.measure.ts')
  })

  it('every *.measure.ts is either GATED or a recorded DELIBERATE EXCLUSION', () => {
    const coverage = registryCoverage(measureFilesOnDisk())
    expect(coverageFailureMessage(coverage) ?? 'covered').toBe('covered')
  })

  // ── The positive controls ──────────────────────────────────────────────────
  // Each plants exactly one defect and asserts the checker names exactly it.
  //
  // ⚠ THEY RUN OVER SYNTHETIC INPUTS, NOT OVER THE REAL DIRECTORY, AND THAT IS
  // A CORRECTION. The first version built them by appending a planted file to
  // `measureFilesOnDisk()`, which coupled every control to the registry's
  // CURRENT state: two mutation runs against the real registry (removing an
  // exclusion; renaming a gated file) each failed the coverage test AND a
  // control, because the control's `toEqual([...])` saw the genuine drift
  // alongside its own plant. That is one control answering two questions — it
  // still went red, but it went red for a reason that was not its own, and a
  // reader debugging a real drift would have been sent to look at the control.
  // A control must fail for EXACTLY ONE reason (CLAUDE.md trap 21; "one control
  // cannot cover two defects"). Synthetic inputs give it that, and the real
  // directory is still exercised by the two tests above.

  const SYNTHETIC_FILES = ['alpha.measure.ts', 'beta.measure.ts'] as const
  const SYNTHETIC_GATED = [{ file: 'alpha.measure.ts', suite: 's', title: 't', catches: 'c' }]
  const SYNTHETIC_EXCLUSIONS = [{ what: 'beta.measure.ts — a measure', why: 'synthetic' }]

  it('CONTROL — the synthetic baseline is itself clean, or the plants below prove nothing', () => {
    // Trap 13b: a control that cannot PASS is as worthless as one that cannot
    // fail. If this baseline were already dirty, every plant below would "bite"
    // without the plant doing anything.
    const coverage = registryCoverage([...SYNTHETIC_FILES], SYNTHETIC_GATED, SYNTHETIC_EXCLUSIONS)
    expect(coverageFailureMessage(coverage)).toBeNull()
  })

  it('CONTROL — an unregistered file on disk is reported UNACCOUNTED', () => {
    const coverage = registryCoverage(
      [...SYNTHETIC_FILES, 'zzNobodyRegisteredThis.measure.ts'],
      SYNTHETIC_GATED,
      SYNTHETIC_EXCLUSIONS,
    )
    expect(coverage.unaccounted).toEqual(['zzNobodyRegisteredThis.measure.ts'])
    expect(coverage.staleGated).toEqual([])
    expect(coverage.staleExcluded).toEqual([])
    expect(coverageFailureMessage(coverage)).toContain('UNACCOUNTED')
  })

  it('CONTROL — a GATED_TESTS entry naming a file that is gone is reported STALE', () => {
    const coverage = registryCoverage(
      [...SYNTHETIC_FILES],
      [...SYNTHETIC_GATED, { file: 'zzDeletedGatedFile.measure.ts', suite: 's', title: 't', catches: 'c' }],
      SYNTHETIC_EXCLUSIONS,
    )
    expect(coverage.staleGated).toEqual(['zzDeletedGatedFile.measure.ts'])
    expect(coverage.unaccounted).toEqual([])
  })

  it('CONTROL — a DELIBERATE_EXCLUSIONS entry naming a file that is gone is reported STALE', () => {
    const coverage = registryCoverage([...SYNTHETIC_FILES], SYNTHETIC_GATED, [
      ...SYNTHETIC_EXCLUSIONS,
      { what: 'zzDeletedExcludedFile.measure.ts — retired', why: 'planted control' },
    ])
    expect(coverage.staleExcluded).toEqual(['zzDeletedExcludedFile.measure.ts'])
    expect(coverage.unaccounted).toEqual([])
  })

  it('CONTROL — the checker reads the EXPORTED CONSTANTS, not the file text', () => {
    // Measured during the mutation run: with the `showWholeModelDockBudget`
    // exclusion ENTRY deleted, that filename still appeared 3 times in this
    // registry's prose, and the guard correctly reported the file UNACCOUNTED.
    // A grep-over-the-source implementation would have passed. Pinned here so a
    // future "simplification" to a text scan REDs.
    const coverage = registryCoverage(['gamma.measure.ts'], [], [
      { what: 'not this one', why: 'gamma.measure.ts is mentioned only in a REASON, never in `what`' },
    ])
    expect(coverage.unaccounted).toEqual(['gamma.measure.ts'])
  })

  // ── The matcher's own defect, pinned ───────────────────────────────────────
  it('CONTROL — a longer filename does not account for the shorter one it contains', () => {
    // `savedExampleShowWholeModel.measure.ts` ends with `ShowWholeModel.measure.ts`
    // and `showWholeModelDockBudget.measure.ts` shares its stem. A substring
    // matcher would score `showWholeModel.measure.ts` as excluded on the
    // strength of a DIFFERENT file's name — a probe answering about the wrong
    // object (CLAUDE.md trap 19).
    const coverage = registryCoverage(
      ['showWholeModel.measure.ts'],
      [],
      [
        { what: 'savedExampleShowWholeModel.measure.ts is excluded', why: 'planted control' },
        { what: 'showWholeModelDockBudget.measure.ts is excluded', why: 'planted control' },
      ],
    )
    expect(coverage.unaccounted).toEqual(['showWholeModel.measure.ts'])
  })

  it('CONTROL — and it still matches the file when it IS named', () => {
    const coverage = registryCoverage(
      ['showWholeModel.measure.ts'],
      [],
      [{ what: 'showWholeModel.measure.ts — red at the base', why: 'planted control' }],
    )
    expect(coverage.unaccounted).toEqual([])
  })
})
