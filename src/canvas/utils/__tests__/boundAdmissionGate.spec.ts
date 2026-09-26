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
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'
import SERVED from './fixtures/openai-85ce874-added-option-refusal.turn.json'
import servedAddOn from './fixtures/served-addon-needs-user-input.4c3b512.turn.json'

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

  it('UNBOUND: an edit the server has not seen yet (a queued emitted edit, or an unregistered import)', () => {
    expect(selectBoundMayRun(store({ pendingEmittedEdits: 1 }))).toBeUndefined()
    expect(selectBoundMayRun(store({ importPendingServerRegistration: true }))).toBeUndefined()
  })

  it('⭐ BOUND: the results-stale overlay alone does not unbind (every approved Agent write sets it)', () => {
    expect(selectBoundMayRun(store({ analysisFreshnessDirty: true }))).toBe(true)
    expect(selectBoundMayRun(store({ analysisFreshnessDirty: true, ceeAnalysisReady: carrier({ may_run: false }) }))).toBe(false)
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
      wording: { requiredInputs: [], structural: 'An option is not connected to the decision.', reasonCodes: ['OPTION_NOT_LINKED_TO_DECISION'] },
    })
  })

  it('⭐ SERVED: the refusal carries CEE\'s own words, bound to the served revision', () => {
    const bound = selectBoundAdmission(store({ ceeAnalysisReady: SERVED.analysis_ready, lastServerGraphHash: SERVED.graph_hash }))
    expect(bound?.mayRun).toBe(false)
    expect(bound?.wording).toEqual({
      // the one input CEE REQUIRES; the `offered` value question is not a requirement
      requiredInputs: ['An option is not connected from the decision. Link the decision to it.'],
      structural: 'Review all 2 readiness issues together before analysis.',
      reasonCodes: ['MODEL_HAS_BLOCKERS', 'MODEL_HAS_BLOCKERS', 'CONFIDENCE_PARAMETERS_PARTLY_USER_STATED', 'MODEL_HAS_BLOCKERS'],
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

describe('canRunAnalysis — a bound refusal is worded from the most specific source that exists', () => {
  const servedWording = () =>
    selectBoundAdmission(store({ ceeAnalysisReady: SERVED.analysis_ready, lastServerGraphHash: SERVED.graph_hash }))!.wording
  // The served turn's own readiness authority: `unknown`, no blockers, so the BOUND verdict decides.
  const servedAuthority = () => selectAnalysisReadinessAuthority(wireState(SERVED.analysis_state_readiness as never))

  it('PRECONDITION: on the served turn the bound verdict is what refuses (the turn\'s readiness names nothing)', () => {
    expect(SERVED.analysis_state_readiness).toEqual({ status: 'unknown', blockers: [] })
    expect(readinessObjectsToRun(null, servedAuthority(), false)).toBe(true)
    expect(readinessObjectsToRun(null, servedAuthority(), undefined)).toBe(false)
  })

  it('⭐ SERVED: the refusal names the cause CEE requires, not the generic line', () => {
    const result = gate({ readiness: null, analysisReadiness: servedAuthority(), mayRun: false, admissionWording: servedWording() })
    expect(result.allowed).toBe(false)
    expect(result.blockedListing?.sentences.map((x) => x.text)).toEqual([
      'An option is not connected from the decision. Link the decision to it.',
    ])
  })

  it('⭐ REVIEW PROBE (5841669035): served codes WITHOUT messages and a side-car naming its cause keep the side-car\'s cause', () => {
    const named = { ...SIDE_CAR_OBJECTS, blocker_reason: 'Option "Cohort pricing" is not connected to the decision.' }
    const result = gate({
      readiness: named,
      analysisReadiness: null,
      mayRun: false,
      admissionWording: { requiredInputs: [], structural: null, reasonCodes: ['MODEL_HAS_BLOCKERS', 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED', 'NO_COMPARISON_SUBSTRATE'] },
    })
    expect(result.reason).toContain('Option "Cohort pricing" is not connected to the decision.')
    expect(result.reason).not.toContain(BLOCKED_REASON_COPY.unspecified)
  })

  it('with no required input and no side-car cause, CEE\'s structural sentence is used', () => {
    const result = gate({
      readiness: null,
      mayRun: false,
      admissionWording: { requiredInputs: [], structural: 'Review all 2 readiness issues together before analysis.', reasonCodes: ['MODEL_HAS_BLOCKERS'] },
    })
    expect(result.blockedListing?.sentences.map((x) => x.text)).toEqual(['Review all 2 readiness issues together before analysis.'])
  })

  it('codes alone: a mapped code is named through the one vocabulary', () => {
    const result = gate({ readiness: null, mayRun: false, admissionWording: { requiredInputs: [], structural: null, reasonCodes: ['OPTION_NOT_LINKED_TO_DECISION'] } })
    expect(result.reason).toContain('An option is not linked to the decision.')
  })

  it('an unmapped code falls back to the honest generic line, never the raw code', () => {
    const result = gate({ readiness: null, mayRun: false, admissionWording: { requiredInputs: [], structural: null, reasonCodes: ['SOME_FUTURE_CODE'] } })
    expect(result.allowed).toBe(false)
    expect(result.reason).not.toContain('SOME_FUTURE_CODE')
    expect(result.blockedListing?.sentences.map((x) => x.text)).toEqual([BLOCKED_REASON_COPY.unspecified])
  })

  it('a bound admission opens the gate over the objecting side-car', () => {
    expect(gate({ mayRun: true }).allowed).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SERVED: DL browser bf-20260926T054503Z (UI 445c1923 · CEE 4c3b512), the turn
// after the add-on option was approved. CEE admits the run (`may_run: true`)
// with MISSING_OPTION_VALUE ×3 — waived by exclusion — and the Agent said "run
// it again"; the UI's Rerun was DISABLED because the write had set the
// results-stale overlay and the binding dropped the verdict.
// ═══════════════════════════════════════════════════════════════════════════

describe('⭐ served: after an approved add-on write, CEE\'s may_run:true opens the Run gate', () => {
  const turn = (servedAddOn as { turn: { graph_hash: string; analysis_ready: unknown; analysis_state: AnalysisStateV1 } }).turn
  const afterWrite = (over: Record<string, unknown> = {}) =>
    ({
      ceeAnalysisReady: turn.analysis_ready,
      lastServerGraphHash: turn.graph_hash,
      analysisFreshnessDirty: true, // set by the approved write, by design
      pendingEmittedEdits: 0,
      importPendingServerRegistration: false,
      ...over,
    }) as never

  it('PRECONDITION: the served turn admits the run over three MISSING_OPTION_VALUE blockers', () => {
    expect((turn.analysis_ready as { may_run: boolean }).may_run).toBe(true)
    expect(turn.analysis_state.readiness.status).toBe('needs_user_input')
    expect(turn.analysis_state.readiness.blockers.map((b) => b.code)).toEqual(['MISSING_OPTION_VALUE', 'MISSING_OPTION_VALUE', 'MISSING_OPTION_VALUE'])
  })

  it('⭐ the gate does not object: the bound may_run waives the blockers', () => {
    const authority = selectAnalysisReadinessAuthority(turn.analysis_state)
    expect(selectBoundMayRun(afterWrite())).toBe(true)
    expect(readinessObjectsToRun(null, authority, selectBoundMayRun(afterWrite()))).toBe(false)
  })

  it('CONTROL: while an emitted edit is still queued, the verdict is unbound and the blockers close the gate', () => {
    const authority = selectAnalysisReadinessAuthority(turn.analysis_state)
    expect(readinessObjectsToRun(null, authority, selectBoundMayRun(afterWrite({ pendingEmittedEdits: 1 })))).toBe(true)
  })
})
