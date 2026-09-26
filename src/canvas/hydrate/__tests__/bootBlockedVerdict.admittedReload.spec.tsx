/**
 * ⭐ A RELOAD OF A REVISION CEE ADMITS DOES NOT GREY RUN (row 3; DL blocker 5843653448, Canvas #70 5843698855).
 *
 * DL's turn 3 (`bf-20260926T054503Z`): a stale run over `needs_user_input` with MISSING_OPTION_VALUE ×3, which CEE
 * waives by exclusion — `may_run: true` on the turn, `analysis_admission.admitted: true` on the read, one revision
 * (`06bdf585412154de…`). In session the bound `may_run` waives those blockers. On a reload there is no turn, so
 * `applyBootBlockedVerdict` asked `readinessObjectsToRun(null, authority)` with no admission, read the three blockers
 * as closing the gate, and RESTORED the verdict: Run greyed on a model CEE would run.
 *
 * The read already carries the answer (`analysis_admission.admitted`, the same `resolveRunAdmission().willProceed`
 * as `may_run`; Canonical #70 5843711164). `true` waives exactly as `may_run` does; `false` and "did not answer" stay
 * as today. Built from AI Conversation's banked reload-leg patch (bank-20260926), with the waiver narrowed to `true`
 * and the admission bound to the read's revision.
 *
 * CLAIM TYPE: jsdom store + the real hydration path; `fetch` answers with a read COMPOSED from two served artefacts of
 * one graph (see the fixture's `_provenance`). No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import composed from './fixtures/served-admitted-reload.06bdf585.composed.json'
import servedBlocked from './fixtures/served-blocked-read-after-canvas-add.6dd42eb.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { applyBootBlockedVerdict } from '../applyBootRunCurrency'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { canRunAnalysis, readinessObjectsToRun } from '../../utils/canRunAnalysis'
import { logger } from '../../../lib/logger'

type Body = {
  scenario_id: string
  graph_hash: string
  graph: { nodes: unknown[]; edges: unknown[] }
  analysis_state: AnalysisStateV1
  analysis_admission: { admitted: boolean; graph_hash: string } | null
}
const BODY = (composed as unknown as { body: Body }).body
const SCENARIO_ID = BODY.scenario_id
const ADMITTED_STATE = BODY.analysis_state
const BLOCKED_STATE = (servedBlocked as unknown as { body: { analysis_state: AnalysisStateV1 } }).body.analysis_state

let body: Body

/** The Run gate as the panel computes it at boot: no turn yet, so no bound `may_run`. */
function runAllowed(sideCar: unknown = null): boolean {
  const s = useCanvasStore.getState()
  return canRunAnalysis({
    graphHealth: null,
    readiness: sideCar as never,
    analysisReadiness: selectAnalysisReadinessAuthority(s.analysisStateV1 ?? null),
    hasBlockers: false,
    nodeCount: s.nodes.length,
    isRunning: false,
    analysisHeldOn: null,
    draftStreamPhase: 'idle',
    readinessStale: false,
  }).allowed
}

function bootBlockedLog(spy: { mock: { calls: unknown[][] } }): unknown {
  return spy.mock.calls.find(([event]) => event === 'server_graph_hydration.boot_blocked_verdict')?.[1]
}

let debugSpy: { mock: { calls: unknown[][] }; mockRestore: () => void }

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [],
    edges: [],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
  } as never)
  // The live session held this exact model: drafted through the real path.
  applyDraftResult(JSON.parse(JSON.stringify(BODY.graph)) as never, { skipHistory: true, skipAutosave: true })
  // A reload drops the session's analysis beliefs.
  useCanvasStore.setState({
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    serverGraphIdentity: null,
    lastAuthoritativeGraph: null,
  } as never)
  body = JSON.parse(JSON.stringify(BODY))
  debugSpy = vi.spyOn(logger, 'debug')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response))
})
afterEach(() => {
  vi.unstubAllGlobals()
  debugSpy.mockRestore()
})

describe('⭐ a reload of a revision CEE admits does not grey Run (served DL turn 3)', () => {
  it('PRECONDITION: a stale run over needs_user_input ×3 MISSING_OPTION_VALUE, admitted, on the read\'s own revision', () => {
    expect(ADMITTED_STATE.run_state.kind).toBe('complete_stale')
    expect(ADMITTED_STATE.readiness.status).toBe('needs_user_input')
    expect(ADMITTED_STATE.readiness.blockers.map((b) => b.code)).toEqual(['MISSING_OPTION_VALUE', 'MISSING_OPTION_VALUE', 'MISSING_OPTION_VALUE'])
    expect(BODY.analysis_admission?.admitted).toBe(true)
    expect(BODY.analysis_admission?.graph_hash.startsWith(BODY.graph_hash)).toBe(true)
    // The mechanism: without the admission these blockers close the gate; with it they do not.
    const authority = selectAnalysisReadinessAuthority(ADMITTED_STATE)
    expect(readinessObjectsToRun(null, authority)).toBe(true)
    expect(readinessObjectsToRun(null, authority, true)).toBe(false)
  })

  it('⭐ after the reload the Run gate is OPEN, and the boot leg names why it declined', async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(bootBlockedLog(debugSpy)).toMatchObject({ outcome: 'declined', detail: 'does_not_close_gate' })
    expect(runAllowed()).toBe(true)
    // The served side-car for this revision (/graph-readiness, same capture): can_run_analysis false, but the
    // run will scaffold, so it does not re-close the gate either.
    expect(runAllowed({ can_run_analysis: false, scaffold_plan: { will_scaffold_options: true, option_count: 1, excluded_option_ids: [] } })).toBe(true)
  })

  it('CONTRAST (the defect): the same read with no admission restores the verdict and Run is greyed', async () => {
    body.analysis_admission = null
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(bootBlockedLog(debugSpy)).toMatchObject({ outcome: 'restored' })
    expect(runAllowed()).toBe(false)
  })

  it('CONTRAST: admitted:false is not a waiver — restored, Run greyed', async () => {
    body.analysis_admission = { ...(body.analysis_admission as NonNullable<Body['analysis_admission']>), admitted: false }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(bootBlockedLog(debugSpy)).toMatchObject({ outcome: 'restored' })
    expect(runAllowed()).toBe(false)
  })

  it('CONTRAST (bound): an admission for ANOTHER revision is "did not answer" — restored, Run greyed', async () => {
    body.analysis_admission = { ...(body.analysis_admission as NonNullable<Body['analysis_admission']>), graph_hash: 'f'.repeat(64) }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(bootBlockedLog(debugSpy)).toMatchObject({ outcome: 'restored' })
    expect(runAllowed()).toBe(false)
  })
})

describe('applyBootBlockedVerdict — only `true` waives, and never a genuine block', () => {
  const run = (analysisState: AnalysisStateV1, admitted: boolean | null | undefined) => {
    const writes: unknown[] = []
    const outcome = applyBootBlockedVerdict({
      analysisState,
      graphHash: '06bdf585412154de',
      canvasProvenEqualToRead: true,
      isRestorableKind: (kind) => kind === 'complete_stale',
      admitted,
      store: { analysisFreshnessDirty: false, setAnalysisStateV1: (v) => writes.push(v) },
    })
    return { outcome, writes }
  }

  it('⭐ admitted: true → declined as does_not_close_gate; nothing written', () => {
    expect(run(ADMITTED_STATE, true)).toEqual({ outcome: { outcome: 'declined', reason: 'does_not_close_gate' }, writes: [] })
  })

  it.each([
    ['null (did not answer)', null],
    ['absent', undefined],
    ['false', false],
  ])('admitted %s → restored, written once, as before', (_label, admitted) => {
    expect(run(ADMITTED_STATE, admitted as boolean | null | undefined)).toEqual({ outcome: { outcome: 'restored' }, writes: [ADMITTED_STATE] })
  })

  it('a genuine BLOCK (served 6dd42eb, status blocked) is still restored when admitted is true', () => {
    expect(BLOCKED_STATE.readiness.status).toBe('blocked')
    expect(run(BLOCKED_STATE, true)).toEqual({ outcome: { outcome: 'restored' }, writes: [BLOCKED_STATE] })
  })
})
