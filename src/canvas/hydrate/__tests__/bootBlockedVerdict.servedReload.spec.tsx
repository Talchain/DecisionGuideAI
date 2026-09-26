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
import { applyBootBlockedVerdict, BOOT_BLOCKED_VERDICT_DECLINE_REASONS, type BootBlockedVerdictDeclineReason } from '../applyBootRunCurrency'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
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

// ═══════════════════════════════════════════════════════════════════════════
// Review 5843445372 (Canvas): each fail-closed guard is pinned BY NAME, on the
// path where it is the only guard that can decline.
// ═══════════════════════════════════════════════════════════════════════════

const SERVED_VERDICT = BODY.analysis_state as unknown as AnalysisStateV1
const NOT_BLOCKED: AnalysisStateV1 = {
  ...SERVED_VERDICT,
  readiness: { ...(SERVED_VERDICT.readiness as object), status: 'ready', blockers: [] },
} as AnalysisStateV1

describe('applyBootBlockedVerdict — each decline reason is reachable, and names itself', () => {
  function run(over: Partial<Parameters<typeof applyBootBlockedVerdict>[0]> = {}, dirty = false) {
    const writes: unknown[] = []
    const outcome = applyBootBlockedVerdict({
      analysisState: SERVED_VERDICT,
      graphHash: 'a4f11d0997be23ee',
      canvasProvenEqualToRead: true,
      isRestorableKind: (kind) => kind === 'complete_stale',
      store: { analysisFreshnessDirty: dirty, setAnalysisStateV1: (v) => writes.push(v) },
      ...over,
    })
    return { outcome, writes }
  }

  const cases: Array<[BootBlockedVerdictDeclineReason, () => ReturnType<typeof run>]> = [
    ['no_verdict', () => run({ analysisState: null })],
    ['not_restorable', () => run({ isRestorableKind: () => false })],
    ['does_not_close_gate', () => run({ analysisState: NOT_BLOCKED })],
    ['no_graph_hash', () => run({ graphHash: null })],
    ['canvas_not_proven_equal', () => run({ canvasProvenEqualToRead: false })],
    ['edited_since_read', () => run({}, true)],
  ]

  it.each(cases)('%s: declined, and the verdict is never written', (reason, arrange) => {
    const { outcome, writes } = arrange()
    expect(outcome).toEqual({ outcome: 'declined', reason })
    expect(writes).toEqual([])
  })

  it('the cases cover every declared reason', () => {
    expect(cases.map(([r]) => r).sort()).toEqual([...BOOT_BLOCKED_VERDICT_DECLINE_REASONS].sort())
  })

  it('the positive: the served blocked verdict is restored, written once', () => {
    const { outcome, writes } = run()
    expect(outcome).toEqual({ outcome: 'restored' })
    expect(writes).toEqual([SERVED_VERDICT])
  })
})

describe('the proof is the ONLY guard on the unchanged exit (review B1)', () => {
  it('⭐ same identity token (no merge, not dirty), the read carries a value the canvas lacks: not restored, and the proof names itself', async () => {
    useCanvasStore.setState({
      serverGraphIdentity: { value: (served as { body: { graph_identity_hash: { value: string } } }).body.graph_identity_hash.value, projectionVersion: 'identity.v1' },
    } as never)
    const factor = (body.graph.nodes as Array<Record<string, unknown>>).find((n) => n.kind === 'factor' && n.observed_state && typeof n.observed_state === 'object')!
    factor.observed_state = { ...(factor.observed_state as object), value: 987654 }
    const debugSpy = vi.spyOn(logger, 'debug')
    await expect(hydrateCanvasFromServer(SCENARIO_ID)).resolves.toBe('unchanged')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
    const logged = debugSpy.mock.calls.find(([event]) => event === 'server_graph_hydration.boot_blocked_verdict')
    expect(logged?.[1]).toMatchObject({ exit: 'unchanged', outcome: 'declined', detail: 'canvas_not_proven_equal' })
    debugSpy.mockRestore()
  })
})

describe('a stale verdict that does NOT close the gate is written once, by its own leg (review B2)', () => {
  it('stale + ready: exactly one write of that verdict', async () => {
    ;(body.analysis_state as unknown as { readiness: unknown }).readiness = NOT_BLOCKED.readiness
    const original = useCanvasStore.getState().setAnalysisStateV1
    const writes: unknown[] = []
    useCanvasStore.setState({ setAnalysisStateV1: (v: AnalysisStateV1 | null) => { writes.push(v); original(v) } } as never)
    try {
      await hydrateCanvasFromServer(SCENARIO_ID)
    } finally {
      useCanvasStore.setState({ setAnalysisStateV1: original } as never)
    }
    const ofThisRead = writes.filter((w) => w !== null && (w as AnalysisStateV1).run_state?.kind === 'complete_stale')
    expect(ofThisRead).toHaveLength(1)
  })
})

