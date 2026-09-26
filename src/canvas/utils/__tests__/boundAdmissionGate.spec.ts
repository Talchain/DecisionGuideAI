/**
 * ⭐ ONE REVISION-BOUND RUN AUTHORITY: CEE's run-admission verdict, bound to the
 * revision on screen, decides the Run gate. The legacy `/graph-readiness`
 * side-car is consulted only when no bound verdict exists.
 *
 * WHY (manual test 1a298d6d, 25 Sep; Canonical's (B) draft #69 5840817605):
 * the chat's gate composed FOUR carriers with no common key — the legacy
 * side-car, `analysis_state.readiness`, `analysis_ready.may_run` and graph
 * health (`ConversationPanel.tsx:541`). `may_run` never decided on its own:
 *   · `may_run: false` could not close the gate unless another carrier did;
 *   · `may_run: true` could not open a gate the side-car had closed, so the
 *     side-car's separate score (`readiness_score`, `can_run_analysis`) could
 *     refuse a run CEE had admitted;
 *   · and no carrier was bound to the revision: a verdict for an earlier graph
 *     kept deciding for the current one.
 *
 * THE BINDING, from served bytes (Paul's export 1a298d6d and R&C's captures
 * bw-89716c13-*): the turn's top-level `graph_hash` (16 chars, kept as
 * `lastServerGraphHash`) equals `analysis_ready.current_graph_hash`, and is the
 * 16-char prefix of `analysis_ready.analysis_admission.graph_hash`.
 */
import { describe, it, expect } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { canRunAnalysis, readinessObjectsToRun, type CanRunAnalysisParams } from '../canRunAnalysis'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { selectBoundAdmission, selectBoundMayRun } from '../../hooks/useAnalysisReady'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'

const HASH = '449b882e043ae3e3'
const FULL_HASH = '449b882e043ae3e371b65f1f386fb8a6122538e3b16cb70269059d62854578c8'
const OTHER_HASH = '9b30de7c226ec991'

/** The side-car verdict as Paul's test saw it: it OBJECTS (can_run_analysis false). */
const SIDE_CAR_OBJECTS: GraphReadiness = {
  readiness_score: 45,
  readiness_level: 'fair',
  can_run_analysis: false,
  confidence_explanation: 'Some inputs are thin.',
  improvements: [],
}

const reason = (code: string, message: string) => ({ field: 'structurally_analysable', code, message })

function carrier(over: Record<string, unknown> = {}) {
  return {
    status: 'ready',
    options: [],
    goal_node_id: 'mrr',
    may_run: true,
    current_graph_hash: HASH,
    analysis_admission: {
      structurally_analysable: true,
      missing_important_inputs: [],
      semantic_quality_sufficient: true,
      permitted_analysis_mode: 'comparative_leader',
      reasons: [reason('READY_TO_COMPARE', 'Analysis can run on this model as it stands.')],
      graph_hash: FULL_HASH,
    },
    ...over,
  }
}

function store(over: Record<string, unknown> = {}) {
  return {
    ceeAnalysisReady: carrier(),
    lastServerGraphHash: HASH,
    analysisFreshnessDirty: false,
    ...over,
  } as never
}

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

function gate(overrides: Partial<CanRunAnalysisParams> = {}) {
  return canRunAnalysis({
    graphHealth: null,
    readiness: SIDE_CAR_OBJECTS,
    hasBlockers: false,
    nodeCount: 11,
    isRunning: false,
    analysisHeldOn: null,
    draftStreamPhase: 'idle',
    optionsNeedingValues: [],
    readinessStale: false,
    ...overrides,
  })
}

describe('selectBoundMayRun — a verdict counts only for the revision it was computed on', () => {
  it('bound: the verdict names the revision on screen', () => {
    expect(selectBoundMayRun(store())).toBe(true)
    expect(selectBoundMayRun(store({ ceeAnalysisReady: carrier({ may_run: false }) }))).toBe(false)
  })

  it('bound through the admission hash when current_graph_hash is absent', () => {
    const c = carrier()
    delete (c as Record<string, unknown>).current_graph_hash
    expect(selectBoundMayRun(store({ ceeAnalysisReady: c }))).toBe(true)
  })

  it('UNBOUND: a verdict for an earlier revision does not decide for this one', () => {
    expect(selectBoundMayRun(store({ lastServerGraphHash: OTHER_HASH }))).toBeUndefined()
  })

  it('UNBOUND: a local edit since the verdict', () => {
    expect(selectBoundMayRun(store({ analysisFreshnessDirty: true }))).toBeUndefined()
  })

  it('UNBOUND: no revision to bind to, no verdict, or no may_run', () => {
    expect(selectBoundMayRun(store({ lastServerGraphHash: null }))).toBeUndefined()
    expect(selectBoundMayRun(store({ ceeAnalysisReady: null }))).toBeUndefined()
    const c = carrier()
    delete (c as Record<string, unknown>).may_run
    expect(selectBoundMayRun(store({ ceeAnalysisReady: c }))).toBeUndefined()
    const noHash = carrier({ analysis_admission: { ...carrier().analysis_admission, graph_hash: null } })
    delete (noHash as Record<string, unknown>).current_graph_hash
    expect(selectBoundMayRun(store({ ceeAnalysisReady: noHash }))).toBeUndefined()
  })

  it('carries the refusal reason codes with the verdict', () => {
    const refused = carrier({
      status: 'blocked',
      may_run: false,
      analysis_admission: {
        ...carrier().analysis_admission,
        structurally_analysable: false,
        reasons: [reason('OPTION_NOT_LINKED_TO_DECISION', 'An option is not connected to the decision.')],
      },
    })
    expect(selectBoundAdmission(store({ ceeAnalysisReady: refused }))).toEqual({
      mayRun: false,
      reasonCodes: ['OPTION_NOT_LINKED_TO_DECISION'],
    })
  })
})

describe('readinessObjectsToRun — the bound verdict decides; the side-car is only the fallback', () => {
  it('⭐ a bound may_run:true opens a gate the side-car alone would close', () => {
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, null, true)).toBe(false)
  })

  it('⭐ a bound may_run:false closes the gate even when nothing else objects', () => {
    expect(readinessObjectsToRun(null, null, false)).toBe(true)
    const readyTurn = selectAnalysisReadinessAuthority(wireState({ status: 'ready', blockers: [] }))
    expect(readinessObjectsToRun(null, readyTurn, false)).toBe(true)
  })

  it('CONTRAST: with no bound verdict the side-car still decides, exactly as before', () => {
    expect(readinessObjectsToRun(SIDE_CAR_OBJECTS, null, undefined)).toBe(true)
    expect(readinessObjectsToRun(null, null, undefined)).toBe(false)
  })

  it('CONTRAST: a producer-stated blocked status still refuses over a may_run:true', () => {
    const refusedTurn = selectAnalysisReadinessAuthority(wireState({ status: 'blocked', blockers: [] }))
    expect(readinessObjectsToRun(null, refusedTurn, true)).toBe(true)
  })
})

describe('canRunAnalysis — a bound refusal names its reason in the one vocabulary', () => {
  it('⭐ OPTION_NOT_LINKED_TO_DECISION is named, not a generic line and not the side-car', () => {
    const result = gate({ readiness: null, mayRun: false, admissionReasonCodes: ['OPTION_NOT_LINKED_TO_DECISION'] })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('An option is not linked to the decision.')
  })

  it('an unmapped code falls back to the honest generic line, never the raw code', () => {
    const result = gate({ readiness: null, mayRun: false, admissionReasonCodes: ['SOME_FUTURE_CODE'] })
    expect(result.allowed).toBe(false)
    expect(result.reason).not.toContain('SOME_FUTURE_CODE')
    expect((result.reason ?? '').length).toBeGreaterThan(0)
  })

  it('a bound admission opens the gate over the objecting side-car', () => {
    expect(gate({ mayRun: true }).allowed).toBe(true)
  })
})
