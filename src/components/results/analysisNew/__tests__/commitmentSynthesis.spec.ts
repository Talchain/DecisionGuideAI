/**
 * ⭐ "MOVE TOWARDS COMMITMENT" — the three bullets, pinned at the builder.
 *
 * Every case goes through the REAL view-model builder over the shared fixtures,
 * so a bullet is asserted against the field the panel actually carries, not a
 * hand-typed VM. Each rule has a contrast control: the same input with the one
 * condition flipped, proving the assertion discriminates.
 *
 * Bound by IDENTITY: the bullet's `source` tag plus the exact copy constant or
 * view-model string it must equal. Never a value predicate another sentence
 * could satisfy.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel, type AnalysisNewViewModelInputs } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY, leaderWithholdCause } from '../analysisNewCopy'
import {
  EVIDENCE_GAP_ID_PREFIX,
  buildCommitmentSynthesis,
  commitmentAskContext,
  commitmentBullets,
  COMMITMENT_COPY,
} from '../commitmentSynthesis'
import {
  decisionWithLeaderWithheld,
  evidenceGapWithNullConfidence,
  genuineDecision,
  makeData,
  makeOption,
} from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { DecisionResultData } from '../../types'
import type { Recommendation } from '../../strengthen/strengthenTypes'

// ── helpers ─────────────────────────────────────────────────────────────────

const vmOf = (data: ResultsSectionDataReturn, over: Partial<AnalysisNewViewModelInputs> = {}) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    ...over,
  })

const synth = (data: ResultsSectionDataReturn, over: Partial<AnalysisNewViewModelInputs> = {}) =>
  buildCommitmentSynthesis(vmOf(data, over))

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'clarify',
    title: 'Define what success looks like',
    signal: 'No measurable success target is set.',
    whyNow: 'Without a target the analysis cannot say how likely each option is to succeed.',
    tryThis: null,
    sourceLine: 'Source: your goal has no success threshold (checked directly).',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'p' },
    targetId: null,
    priority: 0,
    ...over,
  }) as Recommendation

const ENTITLED = {
  verdict: { leaderId: 'opt_a', hasLeadingOption: true } as DecisionResultData['verdict'],
  leaderDesignationPermitted: true,
}

function rangedOption(id: string, label: string, centre: number, goalProbability: number | null) {
  return makeOption({
    id,
    label,
    expected: centre,
    p10: centre - 10,
    p50: centre,
    p90: centre + 10,
    outcome: { mean: centre, p10: centre - 10, p50: centre, p90: centre + 10 },
    ...(goalProbability === null ? {} : { goalProbability }),
    nValidSamples: 2000,
  })
}

/** Two ranged options. `goal` supplies the user target and per-option goal chances. */
function twoOptionRun(
  goal: { a: number; b: number } | null,
  over: Partial<DecisionResultData> = {},
): ResultsSectionDataReturn {
  const a = rangedOption('opt_a', 'Segment', 120, goal ? goal.a : null)
  const b = rangedOption('opt_b', 'RudderStack', 60, goal ? goal.b : null)
  return makeData({
    recommendation: {
      allOptions: [a, b],
      recommendedOption: a,
      ...(goal ? { goalThreshold: 100 } : {}),
      robustnessVerdict: 'robust',
      ...ENTITLED,
      ...over,
    },
    confidence: { evidenceGapsAssessed: true },
  })
}

const FOUND_ROW = {
  label: 'Tech Lead Presence',
  current_value: 0.6,
  flip_value: 0.9619,
  alternative_winner_label: 'Two Developers',
  flip_reason: 'found',
  unit: '',
}
const SECOND_FOUND_ROW = { ...FOUND_ROW, label: 'Hiring cost', current_value: 10, flip_value: 20 }

const withFlip = (data: ResultsSectionDataReturn, rows: unknown[] = [FOUND_ROW]): ResultsSectionDataReturn => ({
  ...data,
  recommendation: { ...data.recommendation, flipThresholds: rows } as ResultsSectionDataReturn['recommendation'],
})

const robustnessCode = (data: ResultsSectionDataReturn) =>
  vmOf(data).checks.items.find((i) => i.id === 'robustness')!.code

// ═══════════════════════════════════════════════════════════════════════════

describe('pre-run: nothing', () => {
  it('every bullet is null pre-run, even with a review item waiting', () => {
    const s = synth(genuineDecision(), { isPreRun: true, recommendations: [rec({ id: 'r1' })] })
    expect(s).toEqual({ describesLastRun: false, staleKind: null, founded: null, open: null, before: null })
    expect(commitmentBullets(s)).toEqual([])
  })

  it('CONTRAST: the same inputs post-run do produce bullets', () => {
    const s = synth(genuineDecision(), { isPreRun: false, recommendations: [rec({ id: 'r1' })] })
    expect(commitmentBullets(s).length).toBeGreaterThan(0)
  })
})

describe('bullet 1 — what seems well-founded (vm.modelImplication)', () => {
  it('needs_target → the first statement, `modelImplication.outcome.sentence`, verbatim', () => {
    const vm = vmOf(twoOptionRun(null))
    expect(vm.modelImplication.kind).toBe('needs_target')
    if (vm.modelImplication.kind !== 'needs_target') throw new Error('unreachable')
    const s = buildCommitmentSynthesis(vm)
    expect(s.founded).toEqual({ text: vm.modelImplication.outcome.sentence, source: 'implication_outcome_claim' })
    // Its lead is a limitation, not a reading, and must not stand in for one.
    expect(s.founded!.text).not.toBe(COPY.implications.needsTargetLead)
  })

  it('aligned → the block lead, `alignedLead(modelImplication.label)`', () => {
    const vm = vmOf(twoOptionRun({ a: 0.8, b: 0.3 }))
    expect(vm.modelImplication.kind).toBe('aligned')
    if (vm.modelImplication.kind !== 'aligned') throw new Error('unreachable')
    expect(buildCommitmentSynthesis(vm).founded).toEqual({
      text: COPY.implications.alignedLead(vm.modelImplication.label),
      source: 'implication_aligned_lead',
    })
  })

  it('diverged → the block lead, `divergedLead`, which names the split rather than one side of it', () => {
    const vm = vmOf(twoOptionRun({ a: 0.3, b: 0.8 }))
    expect(vm.modelImplication.kind).toBe('diverged')
    expect(buildCommitmentSynthesis(vm).founded).toEqual({
      text: COPY.implications.divergedLead,
      source: 'implication_diverged_lead',
    })
  })

  it('CONTRAST: `none` → no bullet (genuineDecision carries no expected outcome)', () => {
    const vm = vmOf(genuineDecision())
    expect(vm.modelImplication.kind).toBe('none')
    expect(buildCommitmentSynthesis(vm).founded).toBeNull()
  })

  /**
   * ⭐⭐ WAVE 2 (commitment structure, 25 Sep 2026): RE-POINTED, NOT DELETED.
   * Bullet 1 used to go silent on every withheld run — Paul's manual test of
   * the provisional PA-hire run showed only "Still open", nothing under
   * "What we have". The withheld gate still forbids a READING (this case's
   * own `modelImplication.kind === 'none'` proves no reading exists to
   * silence); what it no longer does is drop the bullet to `null` when there
   * IS a truthful, reading-free fact to state — the option count.
   */
  it('withheld leader → the VM emits `none`, but bullet 1 states the option COUNT, never a reading', () => {
    const withheld = twoOptionRun(null, {
      verdict: { leaderId: 'opt_a', hasLeadingOption: false } as DecisionResultData['verdict'],
      leaderDesignationPermitted: false,
    })
    const vm = vmOf(withheld)
    expect(vm.modelImplication.kind).toBe('none')
    expect(vm.optionsComparison.rows.length, 'PRECONDITION: two named options').toBe(2)
    expect(buildCommitmentSynthesis(vm).founded).toEqual({
      text: COMMITMENT_COPY.withheldFounded(2),
      source: 'withheld_count',
    })
    // CONTRAST: the permitted twin of the same run states a READING, not a count.
    expect(buildCommitmentSynthesis(vmOf(twoOptionRun(null))).founded?.source).not.toBe('withheld_count')
  })

  it('⛔ NO VERDICT: the implication still says "most likely", but bullet 1 states the count, never "most likely"', () => {
    // The Rich-fixture contradiction: `modelImplication` withholds only on a
    // verdict that arrived and refused; with NO verdict it stays `aligned`
    // while `checks` reads `leader_not_assessed`. Side by side, bullet 1 said
    // "most likely" and bullet 2 "could not confirm which option is most likely".
    // Wave 2: bullet 1 no longer goes silent OR contradicts bullet 2 — it
    // states the one fact that cannot contradict anything, the count.
    const noVerdict = twoOptionRun({ a: 0.8, b: 0.3 }, {
      verdict: undefined,
      leaderDesignationPermitted: undefined,
    } as Partial<DecisionResultData>)
    const vm = vmOf(noVerdict)
    expect(vm.modelImplication.kind, 'PRECONDITION: the implication still speaks').toBe('aligned')
    expect(vm.checks.leaderWithheld, 'PRECONDITION: the checks say not assessed').toBe(true)
    expect(buildCommitmentSynthesis(vm).founded).toEqual({
      text: COMMITMENT_COPY.withheldFounded(vm.optionsComparison.rows.length),
      source: 'withheld_count',
    })
    expect(buildCommitmentSynthesis(vm).founded!.text).not.toMatch(/most likely/i)
  })

  it('withheld AND zero options compared → still no bullet (nothing truthful to count)', () => {
    const vm = vmOf(makeData({ recommendation: { allOptions: [], verdict: { leaderId: null, hasLeadingOption: false } as DecisionResultData['verdict'], leaderDesignationPermitted: false } }))
    expect(vm.checks.leaderWithheld, 'PRECONDITION').toBe(true)
    expect(vm.optionsComparison.rows.length, 'PRECONDITION: nothing to count').toBe(0)
    expect(buildCommitmentSynthesis(vm).founded).toBeNull()
  })
})

describe('bullet 2 — what remains uncertain, by fixed priority', () => {
  it('(a) withheld with a nameable cause → `checks.leaderWithholdCause`, verbatim', () => {
    const vm = vmOf(decisionWithLeaderWithheld(), { producerLeaderWithholdReason: 'separation_unavailable' })
    expect(vm.checks.leaderWithheld).toBe(true)
    expect(vm.checks.leaderWithholdCause).toBe(leaderWithholdCause('separation_unavailable'))
    expect(buildCommitmentSynthesis(vm).open).toEqual({
      text: vm.checks.leaderWithholdCause,
      source: 'leader_withheld_cause',
    })
  })

  it('(a) withheld, cause NOT nameable → the standing `leader_not_assessed.meaning`', () => {
    const vm = vmOf(decisionWithLeaderWithheld())
    expect(vm.checks.leaderWithheld).toBe(true)
    expect(vm.checks.leaderWithholdCause).toBeNull()
    expect(buildCommitmentSynthesis(vm).open).toEqual({
      text: COPY.checks.leader_not_assessed.meaning,
      source: 'leader_withheld',
    })
  })

  it('CONTRAST: the permitted twin does not take (a)', () => {
    const vm = vmOf(genuineDecision(), { producerLeaderWithholdReason: 'separation_unavailable' })
    expect(vm.checks.leaderWithheld).toBe(false)
    // Robust, evidence assessed with none flagged, no threshold: nothing is open.
    expect(buildCommitmentSynthesis(vm).open).toBeNull()
  })

  it('(b) RETIRED: a found threshold is NOT restated here — the Challenge signals row owns it', () => {
    const vm = vmOf(withFlip(genuineDecision(), [FOUND_ROW, SECOND_FOUND_ROW]))
    expect(vm.leaderClaimPermitted, 'PRECONDITION').toBe(true)
    expect(vm.sensitivity.tippingPoints.length, 'PRECONDITION: a tipping point exists').toBeGreaterThan(0)
    const t = vm.sensitivity.tippingPoints[0]!
    const sentence = COPY.disclosure.tippingPoint(t.factorLabel, t.currentValue, t.flipValue, t.alternativeLabel, t.unit)
    const open = buildCommitmentSynthesis(vm).open
    expect(open?.text ?? '').not.toBe(sentence)
    expect(open?.source).not.toBe('tipping_point')
  })

  it('(b) is strict: a row the producer did not mark `found` is not a tipping point', () => {
    const vm = vmOf(withFlip(genuineDecision(), [{ ...FOUND_ROW, flip_reason: 'no_effect_within_bounds', flip_value: null }]))
    expect(vm.sensitivity.tippingPoints).toEqual([])
    expect(buildCommitmentSynthesis(vm).open?.source).not.toBe('tipping_point')
  })

  it('(a) OUTRANKS (b): a withheld run with a found threshold states the withhold', () => {
    const vm = vmOf(withFlip(decisionWithLeaderWithheld()), { producerLeaderWithholdReason: 'separation_unavailable' })
    expect(vm.sensitivity.tippingPoints.length).toBe(1)
    expect(buildCommitmentSynthesis(vm).open?.source).toBe('leader_withheld_cause')
  })

  it('⛔ (b) needs `leaderClaimPermitted`: a TIED run with a found threshold does not imply a leader', () => {
    const tied = withFlip(
      makeData({
        recommendation: {
          ...genuineDecision().recommendation,
          verdict: { leaderId: null, hasLeadingOption: false, separation: 'tied' } as unknown as DecisionResultData['verdict'],
          leaderDesignationPermitted: false,
        },
        confidence: { evidenceGapsAssessed: true },
      }),
    )
    const vm = vmOf(tied)
    expect(vm.checks.items.find((i) => i.id === 'leader')!.code).toBe('leader_tied')
    expect(vm.checks.leaderWithheld).toBe(false)
    expect(vm.leaderClaimPermitted).toBe(false)
    expect(vm.sensitivity.tippingPoints.length).toBe(1)
    expect(buildCommitmentSynthesis(vm).open?.source).not.toBe('tipping_point')
  })

  it('(c) robustness not assessed → that code\'s own `meaning`', () => {
    const data = twoOptionRun(null, { robustnessVerdict: 'not_assessed' })
    expect(robustnessCode(data)).toBe('robustness_not_assessed')
    expect(synth(data).open).toEqual({ text: COPY.checks.robustness_not_assessed.meaning, source: 'robustness' })
  })

  it('(c) no robustness verdict at all → `robustness_unknown.meaning`', () => {
    const data = twoOptionRun(null, { robustnessVerdict: undefined })
    expect(robustnessCode(data)).toBe('robustness_unknown')
    expect(synth(data).open).toEqual({ text: COPY.checks.robustness_unknown.meaning, source: 'robustness' })
  })

  it('(c) a verdict the admission does not license → `robustness_not_established.meaning`', () => {
    const data = twoOptionRun(null, {
      analysisAdmission: { permitted_analysis_mode: 'quantified_provisional' },
    } as Partial<DecisionResultData>)
    expect(robustnessCode(data)).toBe('robustness_not_established')
    expect(synth(data).open).toEqual({ text: COPY.checks.robustness_not_established.meaning, source: 'robustness' })
  })

  it('with (b) retired, an unassessed robustness check is the open item even when a threshold exists', () => {
    const data = withFlip(twoOptionRun(null, { robustnessVerdict: 'not_assessed' }))
    expect(synth(data).open?.source).toBe('robustness')
  })

  it('CONTRAST for (c): a licensed "robust" verdict is not an open item', () => {
    const data = twoOptionRun(null)
    expect(robustnessCode(data)).toBe('robustness_robust')
    expect(synth(data).open).toBeNull()
  })

  it('(d) an OUTSTANDING evidence gap → the first `gap:` finding\'s headline, verbatim', () => {
    const base = twoOptionRun(null)
    const data: ResultsSectionDataReturn = {
      ...base,
      confidence: {
        ...base.confidence,
        evidenceGapsAssessed: true,
        evidenceGaps: [
          { factorId: 'f_churn', factorLabel: 'Churn rate', confidence: null, voi: null, suggestion: 'Pull churn.' },
          { factorId: 'f_cac', factorLabel: 'Acquisition cost', confidence: null, voi: null, suggestion: 'Pull CAC.' },
        ],
      } as ResultsSectionDataReturn['confidence'],
    }
    const vm = vmOf(data)
    expect(vm.checks.items.find((i) => i.id === 'evidence')!.code).toBe('evidence_gaps')
    const gap = vm.uncertainty.findings.find((f) => f.id === 'gap:f_churn')!
    expect(buildCommitmentSynthesis(vm).open).toEqual({ text: gap.headline, source: 'evidence_gap' })
    expect(buildCommitmentSynthesis(vm).open!.text).not.toContain('Acquisition cost')
  })

  it('CONTRAST for (d): gaps that are all ADDRESSED are not an open item', () => {
    const base = twoOptionRun(null)
    const data: ResultsSectionDataReturn = {
      ...base,
      confidence: {
        ...base.confidence,
        evidenceGapsAssessed: true,
        evidenceGaps: [{ factorId: 'f_churn', factorLabel: 'Churn rate', confidence: 95, voi: null, suggestion: 'x' }],
      } as ResultsSectionDataReturn['confidence'],
    }
    const vm = vmOf(data)
    expect(vm.checks.items.find((i) => i.id === 'evidence')!.code).toBe('evidence_all_addressed')
    expect(vm.uncertainty.findings.some((f) => f.id === 'gap:f_churn')).toBe(true)
    expect(buildCommitmentSynthesis(vm).open).toBeNull()
  })

  it('(c) OUTRANKS (d)', () => {
    const base = twoOptionRun(null, { robustnessVerdict: 'not_assessed' })
    const data = {
      ...base,
      confidence: {
        ...base.confidence,
        evidenceGaps: [{ factorId: 'f_churn', factorLabel: 'Churn rate', confidence: null, voi: null, suggestion: 'x' }],
      },
    } as ResultsSectionDataReturn
    expect(synth(data).open?.source).toBe('robustness')
  })

  it('PIN: the `gap:` id prefix this module reads is the real builder\'s', () => {
    const vm = vmOf(evidenceGapWithNullConfidence())
    const gapIds = vm.uncertainty.findings.map((f) => f.id).filter((id) => id.startsWith(EVIDENCE_GAP_ID_PREFIX))
    expect(gapIds).toEqual(['gap:f_churn'])
  })
})

describe('bullet 3 — before committing', () => {
  it('the top review item\'s title, verbatim, and only the top one', () => {
    const recs = [rec({ id: 'r1', title: 'Check the churn assumption' }), rec({ id: 'r2', title: 'Second item' })]
    const s = synth(genuineDecision(), { recommendations: recs })
    expect(s.before).toEqual({ text: recs[0]!.title, source: 'intervention' })
  })

  it('CONTRAST: no review item → no bullet', () => {
    expect(synth(genuineDecision(), { recommendations: [] }).before).toBeNull()
  })

  it('stale → the existing re-run words, `status.reanalyseToBeSure`, instead of the item', () => {
    const s = synth(genuineDecision(), {
      recommendations: [rec({ id: 'r1' })],
      isStale: true,
      staleReason: 'changed',
    })
    expect(s.before).toEqual({ text: COPY.status.reanalyseToBeSure, source: 'rerun' })
  })

  it('⛔ stale but a re-run would NOT help (`checks.rerunWouldNotHelp`) → no re-run advice', () => {
    const inputs = {
      recommendations: [rec({ id: 'r1' })],
      isStale: true,
      staleReason: 'unconfirmed' as const,
      producerLeaderWithholdReason: 'separation_unavailable',
    }
    const vm = vmOf(decisionWithLeaderWithheld(), inputs)
    expect(vm.checks.rerunWouldNotHelp).toBe(true)
    expect(buildCommitmentSynthesis(vm).before).toEqual({ text: 'Define what success looks like', source: 'intervention' })

    // CONTRAST: the model changed, so a re-run can help and is offered.
    const changed = vmOf(decisionWithLeaderWithheld(), { ...inputs, staleReason: 'changed' })
    expect(changed.checks.rerunWouldNotHelp).toBe(false)
    expect(buildCommitmentSynthesis(changed).before?.source).toBe('rerun')
  })
})

describe('stale: the bullets say they describe the last run', () => {
  it('describesLastRun follows `status.isStale`', () => {
    expect(synth(genuineDecision(), { isStale: true, staleReason: 'changed' }).describesLastRun).toBe(true)
    expect(synth(genuineDecision(), { isStale: false }).describesLastRun).toBe(false)
  })

  it('the ask context names WHICH staleness first (changed), then each bullet as the reader sees it', () => {
    const s = synth(decisionWithLeaderWithheld(), {
      recommendations: [rec({ id: 'r1' })],
      isStale: true,
      staleReason: 'changed',
    })
    const lines = commitmentAskContext(s).split('\n')
    expect(lines[0]).toBe(COPY.status.stale)
    expect(lines).toContain(`${COMMITMENT_COPY.labels.open}: ${COPY.checks.leader_not_assessed.meaning}`)
    expect(lines).toContain(`${COMMITMENT_COPY.labels.before}: ${COPY.status.reanalyseToBeSure}`)
    // CONTRAST: fresh, no marker.
    const fresh = synth(decisionWithLeaderWithheld(), { recommendations: [rec({ id: 'r1' })] })
    expect(commitmentAskContext(fresh).split('\n')[0]).not.toBe(COPY.status.stale)
  })

  it('⛔ an UNCONFIRMED stale run is never described as a changed model', () => {
    const s = synth(decisionWithLeaderWithheld(), {
      recommendations: [rec({ id: 'r1' })],
      isStale: true,
      staleReason: 'unconfirmed',
    })
    const lines = commitmentAskContext(s).split('\n')
    expect(lines[0]).toBe(COPY.status.freshnessUnknown)
    expect(lines).not.toContain(COPY.status.stale)
    expect(lines).not.toContain(COPY.markers.stale)
  })
})

describe("bullet 3 never repeats the Challenge card's own item (V2 census B1)", () => {
  it('skips the intervention the card is showing and takes the next one', () => {
    const s = buildCommitmentSynthesis(
      vmOf(genuineDecision(), { recommendations: [rec({ id: 'r1', title: 'Card item' }), rec({ id: 'r2', title: 'Next item' })] }),
      { excludeInterventionIds: ['r1'] },
    )
    expect(s.before?.text).toBe('Next item')
  })

  it('CONTRAST: with nothing excluded, the top item is used; with only the card item, no bullet', () => {
    const vm = vmOf(genuineDecision(), { recommendations: [rec({ id: 'r1', title: 'Card item' })] })
    expect(buildCommitmentSynthesis(vm).before?.text).toBe('Card item')
    expect(buildCommitmentSynthesis(vm, { excludeInterventionIds: ['r1'] }).before).toBeNull()
  })
})
