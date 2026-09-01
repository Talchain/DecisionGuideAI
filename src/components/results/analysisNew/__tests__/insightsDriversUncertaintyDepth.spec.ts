/**
 * Analysis (New) — the three reading sections, and the four things they were
 * losing between the producer and the screen.
 *
 * Each case below is derived from the PRODUCER's declared field semantics, not
 * from a reading of what a field ought to mean (CLAUDE.md trap 13c), and each
 * binds to its object by IDENTITY — a finding id, or a string imported from the
 * module that owns it — never by a value predicate another object could satisfy
 * (trap 19).
 *
 * ⚠ WHAT THIS FILE CANNOT DO. Every fixture here is hand-built, so it certifies
 * the SEMANTIC rules and nothing about whether the information architecture is
 * right (trap 22 — a corpus from the author's head cannot see the class the
 * author did not imagine). The layout and first-viewport questions are settled
 * in a browser, not in jsdom (trap 3).
 */

import { describe, expect, it } from 'vitest'

import {
  ANALYSIS_NEW_LIMITS,
  buildAnalysisNewViewModel,
} from '../buildAnalysisNewViewModel'
import {
  RESOLVE_NEXT_COPY,
  UNLICENSED_SIGNIFICANCE_CLAIMS,
} from '../../voi/resolveNextCopy'
import type { ConditionalWinner } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { VoiRanking } from '../../voi/voiRanking'
import { makeData, makeDriver, uncertaintyDerivedFindings} from './analysisNewFixtures'

const build = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })

/**
 * One producer `conditional_winners` row. The two bucket labels DIFFER, so the
 * "named both" arm fires and the split value is observable in the sentence —
 * which is what lets the dedupe case below discriminate WHICH row survived.
 */
const cw = (over: Partial<ConditionalWinner> & { factor_id: string }): ConditionalWinner => ({
  factor_label: `Label for ${over.factor_id}`,
  split_value: 10,
  high_bucket: { winner_label: 'Raise price' },
  low_bucket: { winner_label: 'Hold price' },
  ...over,
})

const voiRow = (factorId: string, label: string, canFocus = true) => ({
  factorId,
  label,
  canFocus,
  valueAffordance: 'review' as const,
})

const ranking = (over: Partial<VoiRanking> = {}): VoiRanking => ({
  resolved: [],
  belowResolution: [],
  someFactorsUnassessed: false,
  ...over,
})

const insightIds = (data: ResultsSectionDataReturn) =>
  build(data).keyInsights.insights.map((i) => i.id)

// ═══════════════════════════════════════════════════════════════════════════
// KEY INSIGHTS — every conditional winner, and no data cap
// ═══════════════════════════════════════════════════════════════════════════

describe('key insights — the strategic tensions, all of them', () => {
  /**
   * `useResultsSectionData.ts:3620` maps ONE row per surviving
   * `conditional_winners` entry, so the array is unbounded. Reading `[0]` threw
   * away every other answer to "what does this depend on" with nothing on
   * screen saying so.
   */
  it('emits one finding per conditional winner, in PRODUCER WIRE ORDER', () => {
    const data = makeData({
      confidence: {
        conditionalWinners: [cw({ factor_id: 'f_b' }), cw({ factor_id: 'f_a' }), cw({ factor_id: 'f_c' })],
      },
    })
    // Bound by id, and the ORDER is asserted against a deliberately unsorted
    // input: a consumer that "fixes" the producer's order is a consumer that
    // can invert it.
    expect(insightIds(data)).toEqual([
      'insight:conditional-winner:f_b',
      'insight:conditional-winner:f_a',
      'insight:conditional-winner:f_c',
    ])
  })

  /**
   * ⭐ THE DISCRIMINATING TRIPLE. `winner_flips` is the producer's attestation
   * that the winning option CHANGES across the split (`types.ts:891-899`), and
   * "The answer turns on X" is exactly that claim.
   *
   * An explicit `false` must drop the row; `true` and ABSENT must both keep it.
   * One arm alone proves nothing — a gate that dropped everything would pass
   * the first assertion, and a gate that dropped nothing would pass the last
   * two.
   */
  it('drops a row whose producer says the winner does NOT change — and keeps true AND absent', () => {
    const of = (winner_flips: boolean | undefined) =>
      insightIds(
        makeData({ confidence: { conditionalWinners: [cw({ factor_id: 'f_gated', winner_flips })] } }),
      )

    expect(of(false)).not.toContain('insight:conditional-winner:f_gated')
    expect(of(true)).toContain('insight:conditional-winner:f_gated')
    // ABSENT IS NOT FALSE. Older payloads omit the field and the producer still
    // sent a split; requiring `true` would delete a finding that renders today.
    expect(of(undefined)).toContain('insight:conditional-winner:f_gated')
  })

  it("dedupes a repeated factor_id and keeps the PRODUCER'S FIRST row", () => {
    const data = makeData({
      confidence: {
        conditionalWinners: [
          cw({ factor_id: 'f_dup', split_value: 11 }),
          cw({ factor_id: 'f_dup', split_value: 22 }),
        ],
      },
    })
    const vm = build(data)
    const dup = vm.keyInsights.insights.filter((i) => i.id === 'insight:conditional-winner:f_dup')
    // Exactly one row survives — two would collide on `key={f.id}` at the mount.
    expect(dup).toHaveLength(1)
    // …and it is the FIRST, not merely "one of them". The split value is the
    // only thing that tells the two apart, so the assertion binds to it.
    expect(dup[0].implication).toContain('11')
    expect(dup[0].implication).not.toContain('22')
  })

  /**
   * ⭐ THE ANTI-CAP CASE. `KEY_INSIGHT_CAP = 4` sliced the DATA, so the
   * component never received the tail and could not offer it. Restore that
   * slice and this goes RED by name.
   */
  it('hands the section the WHOLE ordered list — the preview is applied at the mount', () => {
    const data = makeData({
      recommendation: {
        // Two more push sites, so the total clears the old cap of four.
        coachingHeadline: 'What this run found',
        coachingDecisionStatement: 'The margin holds under most of the tested range.',
        dominantFactorId: 'f_dom',
        dominantFactorLabel: 'Supplier lead time',
      },
      confidence: {
        conditionalWinners: ['f_1', 'f_2', 'f_3', 'f_4', 'f_5'].map((id) => cw({ factor_id: id })),
      },
    })
    const ids = insightIds(data)
    expect(ids.length).toBeGreaterThan(4)
    // Bound by identity, not by a count another set could satisfy: the LAST
    // conditional winner is the one a cap of four would have removed.
    expect(ids).toContain('insight:conditional-winner:f_5')
    expect(ids).toContain('insight:executive-summary')
    expect(ids).toContain('insight:dominant-factor')
  })

  /**
   * The structural half. A data cap re-introduced as a constant would be
   * exported here, and the contrast control proves the assertion can see a key
   * that IS present rather than passing on a typo.
   */
  it('publishes a PREVIEW length and no data cap', () => {
    expect('KEY_INSIGHT_PREVIEW' in ANALYSIS_NEW_LIMITS).toBe(true)
    expect('KEY_INSIGHT_CAP' in ANALYSIS_NEW_LIMITS).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// UNCERTAINTY — what is worth resolving, and a mirror that is gone
// ═══════════════════════════════════════════════════════════════════════════

const withRanking = (voiRanking: VoiRanking | null) =>
  makeData({ confidence: { evidenceGapsAssessed: true }, voiRanking })

describe('uncertainty — the value-of-information ranking reaches the section', () => {
  it('leads the section with rank 1, named, and the owner’s note VERBATIM', () => {
    const vm = build(
      withRanking(ranking({ resolved: [voiRow('f_churn', 'Churn rate'), voiRow('f_price', 'Price elasticity')] })),
    )
    const first = uncertaintyDerivedFindings(vm)[0]
    // Identity, from the producer's own factor id.
    expect(first.id).toBe('voi:f_churn')
    expect(first.headline).toBe(`${RESOLVE_NEXT_COPY.lead}: Churn rate`)
    // Byte-identical to the owner's register — not a paraphrase of it.
    expect(first.implication).toBe(RESOLVE_NEXT_COPY.note)
    expect(first.targetId).toBe('f_churn')
  })

  /**
   * ⚠ THE FIXTURE IS THE LOAD-BEARING PART, AND MY FIRST ONE WAS VACUOUS. It
   * read `['Zeta', 'Alpha', 'Mu']`, whose TAIL (`Alpha, Mu`) is already
   * alphabetical — so an adapter that sorted the remainder produced a
   * byte-identical string and the mutant survived. The case proved the rows
   * arrived; it proved nothing about the order. `Mu` before `Alpha` is what
   * makes a sort observable.
   */
  it('carries ranks 2..n in PRODUCER WIRE ORDER and never re-sorts them', () => {
    const vm = build(
      withRanking(
        ranking({ resolved: [voiRow('f_1', 'Zeta'), voiRow('f_2', 'Mu'), voiRow('f_3', 'Alpha')] }),
      ),
    )
    const first = uncertaintyDerivedFindings(vm)[0]
    expect(first.detail).toBe(`${RESOLVE_NEXT_COPY.then} Mu, Alpha.`)
  })

  it('renders the below-resolution and partial disclosures as the owner’s own sentences', () => {
    const vm = build(
      withRanking(
        ranking({
          resolved: [voiRow('f_lead', 'Lead time')],
          belowResolution: [voiRow('f_x', 'Freight rate', false), voiRow('f_y', 'Staff churn', false)],
          someFactorsUnassessed: true,
        }),
      ),
    )
    const inspect = uncertaintyDerivedFindings(vm)[0].inspect
    const valueFor = (label: string) => inspect.find((r) => r.label === label)?.value
    expect(valueFor('Precision')).toBe(RESOLVE_NEXT_COPY.below('Freight rate, Staff churn'))
    expect(valueFor('Coverage')).toBe(RESOLVE_NEXT_COPY.partial)
  })

  it('omits both disclosures when the producer disclosed neither', () => {
    // The contrast control for the case above: the rows are absent, not empty
    // strings and not a reassuring negative.
    const vm = build(withRanking(ranking({ resolved: [voiRow('f_lead', 'Lead time')] })))
    const labels = uncertaintyDerivedFindings(vm)[0].inspect.map((r) => r.label)
    expect(labels).not.toContain('Precision')
    expect(labels).not.toContain('Coverage')
  })

  /**
   * ⭐ THE STATE THE CAPTURED RUNS ACTUALLY LAND IN. Rows arrived and were
   * label-resolved, and not one cleared its own noise floor. The sentence
   * attributes the shortfall to THIS RUN'S PRECISION — never to the factors'
   * worth — and the ceiling below is imported from the owner rather than
   * restated (a copied doctrine list is the mirror this estate keeps paying
   * for).
   */
  it('says the run lacked precision, and makes no unlicensed significance claim', () => {
    const vm = build(
      withRanking(ranking({ belowResolution: [voiRow('f_x', 'Freight rate', false)] })),
    )
    const first = uncertaintyDerivedFindings(vm)[0]
    expect(first.id).toBe('voi:none-above-resolution')
    expect(first.implication).toBe(RESOLVE_NEXT_COPY.noneAboveResolution)
    const breach = UNLICENSED_SIGNIFICANCE_CLAIMS.find(
      (p) => p.test(first.headline) || p.test(first.implication),
    )
    expect(breach, `breaches the imported ceiling via ${String(breach)}`).toBeUndefined()
    // No magnitude, ever: `evppi` is in the decision's outcome units and has no
    // licensed display, so the copy this surface renders carries no digit.
    expect(first.implication).not.toMatch(/\d/)
  })

  /**
   * ⭐ HONEST SILENCE, WITH ITS CONTRAST CONTROL. A null ranking is the gate
   * state — absent, empty, all-invalid, or an unnameable rank 1 — and claiming
   * anything at all about factors nothing assessed would fabricate the
   * assessment. The second half proves the probe can see a ranking when there
   * is one, so the absence is real and not blindness (trap 13).
   */
  it('makes NO claim when the ranking was not produced', () => {
    const silent = build(withRanking(null))
    expect(silent.uncertainty.findings.map((f) => f.id).filter((id) => id.startsWith('voi:'))).toEqual([])

    const speaking = build(withRanking(ranking({ resolved: [voiRow('f_lead', 'Lead time')] })))
    expect(speaking.uncertainty.findings.map((f) => f.id)).toContain('voi:f_lead')
  })

  it('leaves the producer’s own uncertainties in place beneath it', () => {
    const vm = build(
      makeData({
        confidence: {
          evidenceGapsAssessed: true,
          evidenceGaps: [
            {
              factorId: 'f_churn',
              factorLabel: 'Churn rate',
              confidence: 0.4,
              voi: null,
              suggestion: 'Pull the last four quarters of churn before relying on this.',
            },
          ],
        },
        voiRanking: ranking({ resolved: [voiRow('f_lead', 'Lead time')] }),
      }),
    )
    // The ranking leads; the producer's own rows are not displaced by it.
    expect(uncertaintyDerivedFindings(vm).map((f) => f.id)).toEqual(['voi:f_lead', 'gap:f_churn'])
  })
})

describe('uncertainty — the count that promised disclosure and reached no screen', () => {
  /**
   * ⭐ A DISCRIMINATING PAIR, not a bare absence. `uncertainty.totalCount` was
   * `findings.length` with ZERO render consumers; `drivers.totalCount` is the
   * same shape and IS read (the glance shows at most three drivers and does not
   * hold the run's list). Asserting only the first would pass on a typo.
   */
  it('is gone from uncertainty and still present on drivers, which reads it', () => {
    const vm = build(
      makeData({ drivers: { drivers: [makeDriver({ factorKey: 'f_a', factorLabel: 'Lead time' })] } }),
    )
    expect('totalCount' in vm.uncertainty).toBe(false)
    expect('totalCount' in vm.drivers).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// DRIVERS — is the ranking stable, and has anyone disputed it
// ═══════════════════════════════════════════════════════════════════════════

const driverInspect = (over: Parameters<typeof makeDriver>[0]) => {
  const vm = build(makeData({ drivers: { drivers: [makeDriver(over)] } }))
  const finding = vm.drivers.findings.find((f) => f.id === `driver:${over.factorKey}`)
  expect(finding, 'the driver finding must exist for this case to mean anything').toBeDefined()
  return finding!.inspect
}

const base = { factorKey: 'f_lead', factorLabel: 'Supplier lead time' }

describe('drivers — the producer’s own measure of whether the rank holds', () => {
  it('renders rank_flip_rate beside the rank it qualifies', () => {
    const inspect = driverInspect({ ...base, rankFlipRate: 0.2 })
    expect(inspect.find((r) => r.label === 'Chance the rank flips')?.value).toBe('20%')
  })

  it('treats a MEASURED zero as a result and an ABSENT one as absent', () => {
    // The two halves of rule 4, as a pair. A producer that measured no rank
    // instability said something; a producer that sent nothing did not.
    expect(
      driverInspect({ ...base, rankFlipRate: 0 }).find((r) => r.label === 'Chance the rank flips')?.value,
    ).toBe('0%')
    expect(
      driverInspect(base).map((r) => r.label),
    ).not.toContain('Chance the rank flips')
  })
})

describe('drivers — a recorded disagreement is not silence', () => {
  /**
   * `hasContestedEdge` is derived by the hook from the canvas edges'
   * `validation.status === 'contested'` (`useResultsSectionData.ts:2661`) — a
   * fact about the shared model, and the only other consumer is switched off.
   */
  it('renders only on an explicit true — false and absent both stay silent', () => {
    const labelled = (over: Parameters<typeof makeDriver>[0]) =>
      driverInspect(over).find((r) => r.label === 'Contested evidence')?.value

    expect(labelled({ ...base, hasContestedEdge: true })).toBe('yes')
    // A `false` is "no contested edge found", which is not a finding.
    expect(labelled({ ...base, hasContestedEdge: false })).toBeUndefined()
    expect(labelled(base)).toBeUndefined()
  })
})
