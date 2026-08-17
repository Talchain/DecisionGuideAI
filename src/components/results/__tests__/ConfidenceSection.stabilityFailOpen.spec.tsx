/**
 * ABSENCE OF A WITHHELD FIELD IS NOT MAXIMUM CONFIDENCE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `ConfidenceSection` used to gate its readiness verdict on
 *
 *     const hasHighStability = (rankingStability ?? 1) >= MIN_STABLE_RECOMMENDATION_STABILITY
 *
 * PLoT never emits the field that feeds `rankingStability`. Derived at the
 * PRODUCER, not from an observed corpus (PLoT `staging` e4f6ef52,
 * `src/routes/v2/run.ts:3403-3459`): the `robustness` payload is built as an
 * ALLOW-LIST OBJECT LITERAL — the key is never copied in, there is no
 * `...islResult.robustness` spread on either response path, and the omission is
 * pinned route-level by `tests/isl-v2-liveness.fixture.test.ts:202`
 * (`expect(body.robustness).not.toHaveProperty('recommendation_stability')`).
 * The older spelling `ranking_stability` is emitted NOWHERE — zero occurrences
 * in PLoT `src/`, in any schema, type or fixture. The producer's stated reason:
 * ISL derives the quantity as `option_wins[winner] / n_samples`, i.e. the
 * leader's `win_probability` relabelled, carrying "zero independent
 * information", and the UI had been printing it as "N% stability" — a
 * fabricated second statistic.
 *
 * So `rankingStability` is `undefined` on every fresh run, `?? 1` coerced that
 * absence to the MAXIMUM, and the conjunct was unconditionally true.
 *
 * ⚠ WHAT THIS SUITE DOES AND DOES NOT CLAIM — read before adding a case.
 *
 * The readiness verdict for the ABSENT case is DELIBERATELY UNCHANGED by this
 * fix. `(undefined ?? 1) >= 0.6` and "skip an unmeasurable conjunct" are
 * extensionally EQUAL, so no DOM assertion can separate them, and the
 * `absence does not change the verdict` case below records that honestly rather
 * than implying a user-visible win. What the fix changes is that absence is no
 * longer *represented* as a maximal measurement, plus the two genuine truth
 * corrections pinned as RED-A and RED-B.
 *
 * `ConfidenceSection` itself is ARCHIVED — zero production JSX call sites, and
 * the results barrel that re-exports it has zero production importers. These
 * tests therefore pin a LEGACY FIXTURE's logic, not a live user surface. That is
 * stated here so no later reader mistakes a green run for a live-surface
 * witness (CLAUDE.md trap 3b).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceSection } from '../ConfidenceSection'
import { assessStabilityReadiness } from '../utils/stabilityReadiness'
import { MIN_STABLE_RECOMMENDATION_STABILITY } from '../constants'
import type { ConfidenceSectionData } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

/**
 * A payload that satisfies EVERY readiness conjunct except stability, so the
 * stability arm is the only free variable. Built per-case (not shared+mutated)
 * so one case cannot leak state into another.
 */
function readyExceptStability(
  overrides: Partial<ConfidenceSectionData> = {},
): ConfidenceSectionData {
  return {
    tier: {
      tier: 'strong',
      icon: '✓',
      label: 'Good foundation',
      description: 'Your model captures this decision well.',
    },
    qualityScore: 90,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    robustnessStatus: 'computed',
    ...overrides,
  }
}

const LOW_CONFIDENCE_COPY = /No fragile edges, but overall confidence is low/
const READY_COPY = /Your model looks good\. You're ready to decide\./

describe('stability fail-open: absence is not maximum confidence', () => {
  // ── the predicate, pinned by identity in all three directions ────────────
  describe('assessStabilityReadiness', () => {
    it('treats an ABSENT measurement as NOT ASSESSABLE — neither high nor blocking', () => {
      // The load-bearing assertion of the whole row: `isHigh` must be FALSE.
      // Under the old `?? 1` coercion the equivalent quantity was TRUE.
      expect(assessStabilityReadiness(undefined)).toEqual({
        assessable: false,
        isHigh: false,
        blocksReadiness: false,
      })
    })

    it('treats null and non-finite values as absent, not as numbers', () => {
      // `??` does not catch NaN, so the old expression evaluated `NaN >= 0.6`
      // and a garbage value silently read as "not stable".
      for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(assessStabilityReadiness(value as number | null), String(value)).toEqual({
          assessable: false,
          isHigh: false,
          blocksReadiness: false,
        })
      }
    })

    it('OPPOSITE-DIRECTION TWIN: a genuinely HIGH measurement still reads high', () => {
      expect(assessStabilityReadiness(0.85)).toEqual({
        assessable: true,
        isHigh: true,
        blocksReadiness: false,
      })
      // Boundary bound to the constant, not to a copied literal — a threshold
      // move must not silently reclassify the boundary.
      expect(assessStabilityReadiness(MIN_STABLE_RECOMMENDATION_STABILITY)).toEqual({
        assessable: true,
        isHigh: true,
        blocksReadiness: false,
      })
    })

    it('OPPOSITE-DIRECTION TWIN: a genuinely LOW measurement still reads low and blocks', () => {
      expect(assessStabilityReadiness(0.45)).toEqual({
        assessable: true,
        isHigh: false,
        blocksReadiness: true,
      })
      const justBelow = MIN_STABLE_RECOMMENDATION_STABILITY - 0.0001
      expect(assessStabilityReadiness(justBelow).blocksReadiness).toBe(true)
    })
  })

  // ── through the MOUNTED consumer (P2): what the section renders ──────────
  describe('rendered verdict', () => {
    it('RED-A: a LOW measured stability warns even when the producer omitted `level`', () => {
      // PLoT does not emit `robustness.level` either, so `robustnessLevel` is
      // routinely undefined. The old guard read
      // `robustnessLevel !== undefined && !hasHighStability`, letting the
      // presence of `level` license a claim about `stability` — two different
      // fields answering two different questions (CLAUDE.md trap 21). With
      // `level` absent, a genuinely low measured stability produced NO warning.
      render(
        <ConfidenceSection
          data={readyExceptStability({ rankingStability: 0.3, robustnessLevel: undefined })}
        />,
      )
      expect(screen.getByText(LOW_CONFIDENCE_COPY)).toBeInTheDocument()
      expect(screen.queryByText(READY_COPY)).not.toBeInTheDocument()
    })

    it('RED-B: a NON-FINITE stability must not manufacture a low-confidence claim', () => {
      // Mirror direction (P3): clearing a fail-open must not install a
      // fabricated demotion. `NaN >= 0.6` is false, so the old code showed
      // "Low confidence" on a garbage value it had never measured.
      render(
        <ConfidenceSection
          data={readyExceptStability({ rankingStability: Number.NaN, robustnessLevel: 'high' })}
        />,
      )
      expect(screen.queryByText(LOW_CONFIDENCE_COPY)).not.toBeInTheDocument()
    })

    it('TWIN: a HIGH measured stability still renders the ready verdict', () => {
      render(
        <ConfidenceSection
          data={readyExceptStability({ rankingStability: 0.85, robustnessLevel: 'high' })}
        />,
      )
      expect(screen.getByText(READY_COPY)).toBeInTheDocument()
      expect(screen.queryByText(LOW_CONFIDENCE_COPY)).not.toBeInTheDocument()
    })

    it('TWIN: a LOW measured stability still suppresses the ready verdict', () => {
      render(
        <ConfidenceSection
          data={readyExceptStability({ rankingStability: 0.45, robustnessLevel: 'low' })}
        />,
      )
      expect(screen.getByText(LOW_CONFIDENCE_COPY)).toBeInTheDocument()
      expect(screen.queryByText(READY_COPY)).not.toBeInTheDocument()
    })

    it('absence does not change the verdict — a DELIBERATE, RECORDED skip, not a win', () => {
      // ⚠ THIS PIN RECORDS AN UNRESOLVED PRODUCT QUESTION, NOT AN ACHIEVEMENT.
      // On a fresh run BOTH robustness signals are absent, and both conjuncts
      // are skipped — so the section still says "You're ready to decide" with no
      // stability evidence behind it. That is unchanged by this fix and matches
      // the deliberate skip `hasStableRobustness` applies to an absent
      // `robustnessLevel`.
      //
      // If the product decides an unmeasurable conjunct must SUPPRESS the
      // readiness claim, or surface "stability not available", this expectation
      // must flip — as a reviewed copy decision, never as a silent side effect
      // of touching the predicate.
      render(<ConfidenceSection data={readyExceptStability({ rankingStability: undefined })} />)
      expect(screen.getByText(READY_COPY)).toBeInTheDocument()
      expect(screen.queryByText(LOW_CONFIDENCE_COPY)).not.toBeInTheDocument()
    })
  })
})
