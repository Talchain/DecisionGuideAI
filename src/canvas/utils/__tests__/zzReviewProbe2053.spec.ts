import { describe, it, expect } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { canRunAnalysis, readinessObjectsToRun } from '../canRunAnalysis'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { selectBoundAdmission, selectBoundMayRun } from '../../hooks/useAnalysisReady'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'

// CEE staging 6dd42ebf analysis-admission.ts:1189-1193: !willProceed && strict.safeToAnalyse
// -> NOTHING_TO_COMPARE with blockedNextStep as message; blockingIssues empty -> no required inputs.
const NOTHING_TO_COMPARE_WORDING = {
  requiredInputs: [] as string[],
  structural:
    'There is nothing to compare yet, so no figures can be produced. Name at least two different options you are weighing.',
  reasonCodes: ['NOTHING_TO_COMPARE', 'CONFIDENCE_PARAMETERS_PARTLY_USER_STATED', 'NOTHING_TO_COMPARE'],
}

/** A side-car that ADMITS (can_run_analysis true) and carries coaching. */
const SIDE_CAR_ADMITS_WITH_COACHING: GraphReadiness = {
  readiness_score: 78,
  readiness_level: 'ready',
  can_run_analysis: true,
  confidence_explanation: 'Good.',
  improvements: [
    {
      category: 'evidence',
      action: 'Add evidence for how price affects churn.',
      current_gap: 'x',
      quality_impact: 5,
      target_quality: 80,
      priority: 'medium',
      effort_minutes: 5,
    } as never,
  ],
} as GraphReadiness

function wireState(readiness: AnalysisStateV1['readiness']): AnalysisStateV1 {
  return {
    run_state: { kind: 'never_run' },
    readiness,
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

const base = {
  graphHealth: null,
  hasBlockers: false,
  nodeCount: 8,
  isRunning: false,
  analysisHeldOn: null,
  draftStreamPhase: 'idle' as const,
  optionsNeedingValues: [],
  readinessStale: false,
}

describe('PROBE A — bound refusal while the side-car ADMITS: whose words?', () => {
  it('analysisReadiness null (no analysis_state on the turn)', () => {
    const r = canRunAnalysis({ ...base, readiness: SIDE_CAR_ADMITS_WITH_COACHING, analysisReadiness: null, mayRun: false, admissionWording: NOTHING_TO_COMPARE_WORDING })
    // eslint-disable-next-line no-console
    console.log('PROBE_A_NULL', JSON.stringify(r.blockedListing?.sentences))
    expect(r.allowed).toBe(false)
    expect(r.blockedListing?.sentences.map((s) => s.text)).toEqual([NOTHING_TO_COMPARE_WORDING.structural])
  })
  it('CONTRAST: analysisReadiness unknown/no blockers (same refusal, same side-car)', () => {
    const auth = selectAnalysisReadinessAuthority(wireState({ status: 'unknown', blockers: [] } as never))
    const r = canRunAnalysis({ ...base, readiness: SIDE_CAR_ADMITS_WITH_COACHING, analysisReadiness: auth, mayRun: false, admissionWording: NOTHING_TO_COMPARE_WORDING })
    // eslint-disable-next-line no-console
    console.log('PROBE_A_AUTH', JSON.stringify(r.blockedListing?.sentences))
    expect(r.blockedListing?.sentences.map((s) => s.text)).toEqual([NOTHING_TO_COMPARE_WORDING.structural])
  })
})

describe('PROBE B — edge cases of the binding', () => {
  const carrier = (o: Record<string, unknown> = {}) => ({ status: 'ready', options: [], may_run: true, current_graph_hash: 'aaaaaaaaaaaaaaaa', ...o })
  it('may_run "true" string / null is not a verdict', () => {
    expect(selectBoundMayRun({ ceeAnalysisReady: carrier({ may_run: 'true' }), lastServerGraphHash: 'aaaaaaaaaaaaaaaa', analysisFreshnessDirty: false })).toBeUndefined()
    expect(selectBoundMayRun({ ceeAnalysisReady: carrier({ may_run: null }), lastServerGraphHash: 'aaaaaaaaaaaaaaaa', analysisFreshnessDirty: false })).toBeUndefined()
  })
  it('current_graph_hash for another revision but admission hash matching: current wins (unbound)', () => {
    const c = carrier({ current_graph_hash: 'bbbbbbbbbbbbbbbb', analysis_admission: { graph_hash: 'aaaaaaaaaaaaaaaa' + 'c'.repeat(48), reasons: [] } })
    expect(selectBoundMayRun({ ceeAnalysisReady: c, lastServerGraphHash: 'aaaaaaaaaaaaaaaa', analysisFreshnessDirty: false })).toBeUndefined()
  })
  it('lastServerGraphHash longer than 16 compares by prefix', () => {
    expect(selectBoundMayRun({ ceeAnalysisReady: carrier(), lastServerGraphHash: 'aaaaaaaaaaaaaaaa' + 'zz', analysisFreshnessDirty: false })).toBe(true)
  })
  it('short (<16) hashes never bind', () => {
    expect(selectBoundMayRun({ ceeAnalysisReady: carrier({ current_graph_hash: 'abc' }), lastServerGraphHash: 'abc', analysisFreshnessDirty: false })).toBeUndefined()
  })
  it('admitting structural code with a message is not a refusal wording', () => {
    const b = selectBoundAdmission({ ceeAnalysisReady: carrier({ may_run: false, analysis_admission: { reasons: [{ field: 'structurally_analysable', code: 'RUN_WILL_EXCLUDE_OPTIONS', message: 'Analysis can run, leaving out one option' }], missing_important_inputs: [{ why_it_matters: 'Offered thing', obligation: 'offered' }, { why_it_matters: 'Required thing' }] } }), lastServerGraphHash: 'aaaaaaaaaaaaaaaa', analysisFreshnessDirty: false })
    expect(b?.wording.structural).toBeNull()
    expect(b?.wording.requiredInputs).toEqual(['Required thing'])
  })
  it('producer-stated blocked + bound may_run true still refuses; blocked + may_run false keeps the blocked ladder wording', () => {
    const blocked = selectAnalysisReadinessAuthority(wireState({ status: 'blocked', blockers: [] }))
    expect(readinessObjectsToRun(null, blocked, true)).toBe(true)
    const r = canRunAnalysis({ ...base, readiness: null, analysisReadiness: blocked, mayRun: false, admissionWording: NOTHING_TO_COMPARE_WORDING })
    // eslint-disable-next-line no-console
    console.log('PROBE_B_BLOCKED', JSON.stringify(r.blockedListing?.sentences))
    expect(r.allowed).toBe(false)
  })
  it('side-car refuses, bound admits -> allowed; side-car admits, bound refuses -> refused', () => {
    expect(readinessObjectsToRun({ ...SIDE_CAR_ADMITS_WITH_COACHING, can_run_analysis: false }, null, true)).toBe(false)
    expect(readinessObjectsToRun(SIDE_CAR_ADMITS_WITH_COACHING, null, false)).toBe(true)
    expect(BLOCKED_REASON_COPY.unspecified.length).toBeGreaterThan(0)
  })
})
