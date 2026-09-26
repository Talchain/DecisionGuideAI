/**
 * ⭐ A RELOAD OF A BLOCKED MODEL KEEPS CEE'S NAMED REASON (served, OpenAI route).
 *
 * WITNESSED on UI `c3c2d539` · CEE `6dd42eb` (AI Conversation witness
 * `bui-reads-c3c2d539-0358`): brief → approve → the canvas's "+ Add option" →
 * reload. Before the reload the Run control was disabled with a named reason:
 * `"New option" and "New option" are not ready for analysis yet. Ask in the chat
 * what they need.` (witness 02b, the control's title).
 * After it, the SAME disabled control said only "Olumi needs something more
 * from this model before the next analysis. Ask in the chat…".
 *
 * The boot read carried everything needed: `run_state: complete_stale` and a
 * `readiness: blocked` verdict with two plain-English blockers. The boot restore
 * declined it as `closes_run_gate`, because a verdict from a PREVIOUS session
 * could falsely disable Analyse. That fear does not apply when the canvas is
 * PROVEN EQUAL to the read: the read's readiness is CEE's live verdict for the
 * stored graph, and the stored graph is the one on screen.
 *
 * CLAIM TYPE: jsdom store + the real hydration path; `fetch` answers with the
 * served read's verbatim body. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import served from './fixtures/served-blocked-read-after-canvas-add.6dd42eb.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { canRunAnalysis } from '../../utils/canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../../utils/composeBlockedReason'
import { logger } from '../../../lib/logger'

type Body = { scenario_id: string; graph: { nodes: unknown[]; edges: Array<Record<string, unknown>>; goal_constraints?: unknown[] }; analysis_state: { run_state: { kind: string }; readiness: { status: string; blockers: Array<{ message: string }> } } }
const BODY = (served as { body: Body }).body
const SCENARIO_ID = BODY.scenario_id

let body: Body

function gateSentences(): string[] {
  const s = useCanvasStore.getState()
  const result = canRunAnalysis({
    graphHealth: null,
    readiness: null,
    analysisReadiness: selectAnalysisReadinessAuthority(s.analysisStateV1 ?? null),
    hasBlockers: false,
    nodeCount: s.nodes.length,
    isRunning: false,
    analysisHeldOn: null,
    draftStreamPhase: 'idle',
    optionsNeedingValues: [],
    readinessStale: false,
  })
  return (result.blockedListing?.sentences ?? []).map((x) => x.text)
}

let warnSpy: { mockRestore: () => void }

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
  warnSpy = vi.spyOn(logger, 'warn')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response))
})
afterEach(() => {
  vi.unstubAllGlobals()
  warnSpy.mockRestore()
})

describe('⭐ a reload of a BLOCKED model keeps CEE\'s named reason (served read, CEE 6dd42eb)', () => {
  it('PRECONDITION: the served read is a stale run over a blocked model with two named blockers', () => {
    expect(BODY.analysis_state.run_state.kind).toBe('complete_stale')
    expect(BODY.analysis_state.readiness.status).toBe('blocked')
    expect(BODY.analysis_state.readiness.blockers.map((b) => b.message)).toEqual([
      'An option has no factor connections and cannot be analysed. Add at least one factor edge.',
      'Choose which factor "New option" changes and by how much.',
    ])
  })

  it('BEFORE the read, the gate has nothing to name (the served generic line)', () => {
    expect(gateSentences()).toEqual([])
  })

  it('⭐ after the read, the Run gate says EXACTLY what it said before the reload (served 02b), not the generic line', async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().analysisStateV1?.readiness.status).toBe('blocked')
    const sentences = gateSentences()
    // Bound by identity to the served pre-reload title. CEE's own first sentence ("…Add at least one
    // factor edge.") is withheld by the jargon guard (`isSafeCeeText`: "edge"), so the gate names the
    // two blocked options — the same sentence the live session showed.
    expect(sentences).toEqual(['"New option" and "New option" are not ready for analysis yet. Ask in the chat what they need.'])
    expect(sentences).not.toContain(BLOCKED_REASON_COPY.unspecified)
  })

  it('CONTRAST: a read the canvas does NOT match (an edge strength differs) is still declined', async () => {
    const e = body.graph.edges[0]
    e.effect_direction = e.effect_direction === 'positive' ? 'negative' : 'positive'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  })

  it('CONTRAST: an edit made before the read landed keeps the verdict out', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  })

  it('CONTRAST: a blocked verdict on a CURRENT run is not this leg\'s to restore', async () => {
    ;(body.analysis_state.run_state as { kind: string }).kind = 'complete_current'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().analysisStateV1?.readiness.status ?? null).not.toBe('blocked')
  })
})
