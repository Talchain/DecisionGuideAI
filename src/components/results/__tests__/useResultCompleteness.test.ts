/**
 * Tests for `deriveResultCompleteness` (P0 V5 golden-path repair, Wave 4).
 *
 * Pin the source-to-render trace: a fixture with valid source data
 * returns status='full'; fixtures with genuinely-missing fields return
 * status='partial' with the right `missing` keys and reason codes.
 *
 * The selector consults SOURCE fields (PLoT/CEE), not the UI-SEM
 * fabrications applied later by `useResultsSectionData`. This is the
 * critical contract: the completeness verdict is honest about what
 * PLoT/ISL actually delivered, even when fabrications would otherwise
 * make the rendered values look complete.
 */

import { describe, it, expect } from 'vitest'

import { deriveResultCompleteness } from '../useResultCompleteness'
import type {
  ResultCompletenessInputs,
  ResultCompleteness,
} from '../useResultCompleteness'
import type { ReportV1 } from '../../../adapters/plot/types'

function makeFullReport(): ReportV1 {
  return {
    schema: 'report.v1',
    meta: { seed: 42, response_id: 'r1', elapsed_ms: 100 },
    model_card: {
      response_hash: 'hash',
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: { conservative: 0.3, likely: 0.5, optimistic: 0.7 },
    confidence: { level: 'high', why: 'strong evidence' },
    drivers: [
      {
        label: 'Driver A',
        polarity: 'up',
        strength: 'high',
        // Source-side sensitivity field (the trace flagged this as
        // the SOURCE the completeness check consults).
        sensitivity_score: 0.65,
      } as never,
    ],
    option_probabilities: {
      opt_1: {
        goal_probability: 0.6,
        confidence: 0.8,
        win_probability: 0.62,
        // Outcome carried via shape that matches the fallback chain.
        outcome: { p10: 0.4, p50: 0.6, p90: 0.8, mean: 0.6 },
      } as never,
      opt_2: {
        goal_probability: 0.3,
        confidence: 0.7,
        win_probability: 0.27,
        outcome: { p10: 0.2, p50: 0.3, p90: 0.5, mean: 0.3 },
      } as never,
    },
    robustness: {
      level: 'moderate',
      recommendation_stability: 0.72,
    } as never,
  } as ReportV1
}

function makeReview(): ResultCompletenessInputs['ceeReviewV1'] {
  return {
    m1_coaching: {
      executive_summary: {
        headline: 'Hire Senior Engineer is the leading option',
        paragraph: 'Engineering capacity is the strongest driver.',
      },
    },
  } as never
}

function inputs(
  overrides?: Partial<ResultCompletenessInputs>,
): ResultCompletenessInputs {
  return {
    resultsStatus: 'complete',
    report: makeFullReport(),
    ceeReviewV1: makeReview(),
    decisionReview030: null,
    driversPayload: null,
    ...overrides,
  }
}

/** A 0.30 review view-model carrying prose (ROADMAP 2.154). */
function makeReview030(
  overrides?: Partial<NonNullable<ResultCompletenessInputs['decisionReview030']>>,
): ResultCompletenessInputs['decisionReview030'] {
  return {
    narrative_summary: 'Status quo leads by a wide margin.',
    story_headlines: [],
    robustness_explanation: null,
    readiness_rationale: null,
    scenario_contexts: [],
    // 2.466: the verbatim DQP carry — irrelevant to completeness (it is not a
    // hasProse input; pinned by decisionReviewAdapter.dqpCarry.spec).
    decision_quality_prompts: [],
    produced_at: '2026-07-29T23:06:30.954Z',
    hasProse: true,
    ...overrides,
  }
}

describe('deriveResultCompleteness — full coverage', () => {
  it('full source fixture → status=full, no missing keys', () => {
    const result = deriveResultCompleteness(inputs())
    expect(result).toEqual<ResultCompleteness>({
      status: 'full',
      missing: [],
      reasons: [],
    })
  })

  it('idle status → status=full (nothing to evaluate yet)', () => {
    const result = deriveResultCompleteness(inputs({ resultsStatus: 'idle', report: null }))
    expect(result.status).toBe('full')
  })

  it('running status → status=full (run in flight, no verdict yet)', () => {
    const result = deriveResultCompleteness(inputs({ resultsStatus: 'running', report: null }))
    expect(result.status).toBe('full')
  })
})

describe('deriveResultCompleteness — partial source coverage', () => {
  it('all options lack win_probability → win_probability_missing', () => {
    const report = makeFullReport()
    for (const id of Object.keys(report.option_probabilities ?? {})) {
      const prob = report.option_probabilities![id] as { win_probability?: number }
      delete prob.win_probability
    }
    const result = deriveResultCompleteness(inputs({ report }))
    expect(result.status).toBe('partial')
    expect(result.missing).toContain('win_probability')
    expect(result.reasons).toContain('win_probability_missing')
  })

  it('one option lacks any outcome reading → expected_outcome_missing', () => {
    const report = makeFullReport()
    const opt2 = report.option_probabilities!.opt_2 as {
      outcome?: unknown
      bands?: unknown
      expected_outcome?: unknown
      expected?: unknown
    }
    delete opt2.outcome
    delete opt2.bands
    delete opt2.expected_outcome
    delete opt2.expected
    const result = deriveResultCompleteness(inputs({ report }))
    expect(result.status).toBe('partial')
    expect(result.missing).toContain('expected_outcome')
    expect(result.reasons).toContain('expected_outcome_missing')
  })

  it('drivers present but lack sensitivity / elasticity / importance → sensitivity_missing', () => {
    const report = makeFullReport()
    report.drivers = [
      { label: 'Driver A', polarity: 'up', strength: 'high' } as never,
    ]
    const result = deriveResultCompleteness(inputs({ report }))
    expect(result.status).toBe('partial')
    expect(result.missing).toContain('sensitivity')
    expect(result.reasons).toContain('sensitivity_missing')
  })

  it('robustness lacks both level and stability → robustness_unavailable', () => {
    const report = makeFullReport() as ReportV1 & { robustness?: unknown }
    ;(report as { robustness?: unknown }).robustness = {}
    const result = deriveResultCompleteness(inputs({ report }))
    expect(result.status).toBe('partial')
    expect(result.missing).toContain('robustness_level')
    expect(result.missing).toContain('recommendation_stability')
    expect(result.reasons).toContain('robustness_unavailable')
  })

  it('decision review absent → decision_review_unavailable', () => {
    const result = deriveResultCompleteness(inputs({ ceeReviewV1: null }))
    expect(result.status).toBe('partial')
    expect(result.missing).toContain('decision_review')
    expect(result.reasons).toContain('decision_review_unavailable')
  })

  it('decision review present but no headline / paragraph → decision_review_unavailable', () => {
    const result = deriveResultCompleteness(
      inputs({ ceeReviewV1: { m1_coaching: { executive_summary: {} } } as never }),
    )
    expect(result.status).toBe('partial')
    expect(result.missing).toContain('decision_review')
  })

  // ── ROADMAP 2.154 — the signal used to fire on EVERY turn ────────────────
  //
  // It tested `ceeReviewV1.m1_coaching.executive_summary`, a key the live V5
  // wire does not carry at all, so `decision_review_unavailable` was true on
  // every analysis and the user was told "Decision coaching is still being
  // prepared for this analysis" while a real ~8-9s gpt-4.1 review sat in the
  // same response. These cases pin that a 0.30 review now clears it, and — the
  // half that keeps the signal non-vacuous — that it STILL fires when nothing
  // arrived.
  describe('the decision_review signal is satisfied by a 0.30 review too', () => {
    it('a 0.30 review with prose clears the signal even with NO m1_coaching', () => {
      const result = deriveResultCompleteness(
        inputs({ ceeReviewV1: null, decisionReview030: makeReview030() }),
      )
      expect(result.missing).not.toContain('decision_review')
      expect(result.reasons).not.toContain('decision_review_unavailable')
      expect(result.status).toBe('full')
    })

    it('a 0.30 review with NO prose does NOT clear it (nothing to show is unavailable)', () => {
      const result = deriveResultCompleteness(
        inputs({
          ceeReviewV1: null,
          decisionReview030: makeReview030({ narrative_summary: null, hasProse: false }),
        }),
      )
      expect(result.missing).toContain('decision_review')
      expect(result.reasons).toContain('decision_review_unavailable')
    })

    it('NEGATIVE CONTROL — both witnesses absent still fires the signal', () => {
      const result = deriveResultCompleteness(
        inputs({ ceeReviewV1: null, decisionReview030: null }),
      )
      expect(result.missing).toContain('decision_review')
      expect(result.reasons).toContain('decision_review_unavailable')
    })

    it('m1_coaching alone still clears it (the M1 path is untouched)', () => {
      const result = deriveResultCompleteness(inputs({ decisionReview030: null }))
      expect(result.missing).not.toContain('decision_review')
    })

    it('A1 framing — a MALFORMED review still fires the signal for the user', () => {
      // Recorded because the A1 write-up first over-claimed "silently
      // discarded". On the wrong-typed path `applyV5State` writes
      // `decisionReview030: null`, so the user DOES get a signal here. What went
      // dark was the OPERATOR marker — the only witness distinguishing "the
      // producer sent nothing" from "the producer sent something broken". The
      // user was told the review was still coming when it had arrived malformed.
      const result = deriveResultCompleteness(
        inputs({ ceeReviewV1: null, decisionReview030: null }),
      )
      expect(result.reasons).toContain('decision_review_unavailable')
    })
  })

  it('multiple gaps → status=partial with all reasons surfaced', () => {
    const report = makeFullReport()
    for (const id of Object.keys(report.option_probabilities ?? {})) {
      delete (report.option_probabilities![id] as { win_probability?: number }).win_probability
    }
    report.drivers = [
      { label: 'Driver A', polarity: 'up', strength: 'high' } as never,
    ]
    const result = deriveResultCompleteness(inputs({ report, ceeReviewV1: null }))
    expect(result.status).toBe('partial')
    expect(result.missing).toEqual(
      expect.arrayContaining(['win_probability', 'sensitivity', 'decision_review']),
    )
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'win_probability_missing',
        'sensitivity_missing',
        'decision_review_unavailable',
      ]),
    )
  })
})

describe('deriveResultCompleteness — failed', () => {
  it('DELIBERATE PIN FLIP (Lane 3 / SF2): error WITH a retained report describes THAT report, not the new run\'s failure', () => {
    // Post-SF2 the body renders the retained previous report at status
    // 'error'; its completeness must describe itself (a full retained
    // report → full), not slander it as "failed/partial" for the new run
    // that failed. The failed short-circuit now requires NO report.
    const result = deriveResultCompleteness(inputs({ resultsStatus: 'error' }))
    expect(result.status).toBe('full')
    expect(result.reasons).toEqual([])
  })

  it('resultsStatus=error with NO retained report → status=failed', () => {
    const result = deriveResultCompleteness(inputs({ resultsStatus: 'error', report: null }))
    expect(result.status).toBe('failed')
    expect(result.reasons).toContain('analysis_partial')
  })
})

describe('deriveResultCompleteness — coherence properties', () => {
  it('result is deterministic — same inputs give same output', () => {
    const i = inputs()
    expect(deriveResultCompleteness(i)).toEqual(deriveResultCompleteness(i))
  })

  it('an empty drivers array (no top drivers computed) is flagged but not a hard error', () => {
    const report = makeFullReport()
    report.drivers = []
    const result = deriveResultCompleteness(inputs({ report }))
    expect(result.status).toBe('partial')
    expect(result.missing).toContain('top_drivers')
  })
})
