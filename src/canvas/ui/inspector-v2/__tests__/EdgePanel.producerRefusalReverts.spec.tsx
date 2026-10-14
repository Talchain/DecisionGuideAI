/**
 * ⭐ F1 — A BAND THE MODEL REFUSED NEVER STAYS ON THE PILL (red team #87 6006627551; DL ruling, cut 5).
 *
 * CEE (#2624, served d40fd7b1) refuses a strength move on a link that holds the user's own figure with a 200 and its
 * own words — "This link holds your figure: ‘…’. Change the figure, or say ‘replace my figure with …’." — and writes
 * nothing. Before this, the pill kept the clicked band and the panel said "Olumi may not have recorded this": a band
 * that did not apply, on display.
 *
 * The proof (never "a 200 without a graph", audit 31880193): the reply answers at the SAME analysis hash the canvas
 * sent from (`lastServerGraphHash`) while the send MOVED the server-stated strength. Pinned through the mounted
 * `InspectorRouter` and the REAL settlement (`settleSystemEventSend` → `resolveEdgeEditSettlement` → revert). The
 * carrier double does exactly what `useConversation` does with the reply (source-pinned below).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'

import type { WireSystemEvent } from '../../../conversation/types'
import type { OptimisticEdgeEdit } from '../../../conversation/ownOptimisticWrite'
import {
  __resetPendingEdgeEditsForTest,
  edgeEditAnsweredUnmoved,
  markEdgeEditInFlight,
  noteEdgeEditNotApplied,
} from '../../../conversation/pendingEdgeEdit'

const CEE_SAID = 'This link holds your figure: ‘Each lost customer removes £300 a month’. Change the figure, or say ‘replace my figure with moderate’.'
let replyHash: string | undefined
let acceptReply = false
let beforeReply: (() => void) | undefined
let afterReply: (() => void) | undefined
const sendSystemEvent = vi.fn(async (_event: WireSystemEvent, opts?: { optimisticEdgeEdit?: OptimisticEdgeEdit }) => {
  // What `useConversation` does with a non-error reply to its own edge edit, before the send settles.
  const own = opts?.optimisticEdgeEdit
  beforeReply?.()
  if (own && acceptReply) {
    // An accepted reply shows the sent magnitude in its committed graph.
    const edge = useCanvasStore.getState().edges.find((e) => e.id === own.edgeId)!
    useCanvasStore.getState().updateEdge(own.edgeId, {
      data: { ...DEFAULT_EDGE_DATA, ...edge.data, serverStrength: { mean: own.sentMagnitude, effect_direction: 'positive' } },
    })
  }
  if (own && edgeEditAnsweredUnmoved(own, replyHash)) noteEdgeEditNotApplied(own, CEE_SAID)
  // Then the reply's envelope (`applyV5State`, useConversation `:5399`), still before the send settles.
  afterReply?.()
  return undefined
})

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../../flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isV5CanonicalAnalysisEnabled: () => false,
}))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import type { CEEAnalysisReady } from '../../../../adapters/cee/types'
import { DEFAULT_EDGE_DATA } from '../../../domain/edges'
import { useAnalysisState } from '../../../state/analysisStateSelector'
import { deriveRerunActionLabel, RERUN_LABEL_CHANGED } from '../../../components/utils/postAnalysisFooter'
import { useStageAwarePlaceholder, PLACEHOLDER_CHANGED_RUNNABLE } from '../../../hooks/useStageAwarePlaceholder'
import { __resetStalenessVoicesForTest } from '../../../conversation/stalenessVoice'
import { ANALYSIS_CURRENCY_KEYS } from '../../../store'
import { applyV5State } from '../../../../v5/applyV5State'
import { backfillGoalThresholdOntoGoalNode } from '../../../utils/applyDraftResult'
import servedCapture from './fixtures/served-refused-band-d16ccc87.json'

const BASE = 'h-base-31f5adf8'
function seed(lastServerGraphHash: string | null = BASE) {
  useCanvasStore.setState({
    nodes: [
      { id: 'n_churn', type: 'factor', data: { label: 'Customer churn' }, position: { x: 0, y: 0 } },
      { id: 'n_mrr', type: 'goal', data: { label: 'MRR' }, position: { x: 0, y: 0 } },
    ] as never[],
    edges: [{
      id: 'e1', source: 'n_churn', target: 'n_mrr',
      data: { weight: 0.62, direction: 'positive', weightSource: 'cee', serverStrength: { mean: 0.62, effect_direction: 'positive' } },
    }] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    lastServerGraphHash,
    _internal: {},
  } as never)
}
const weight = () => (useCanvasStore.getState().edges.find((e) => e.id === 'e1')?.data as Record<string, unknown>).weight
const feedback = () => screen.getByTestId('edge-strength-edit-feedback')

async function clickModerate() {
  const { container } = render(<InspectorRouter nodeId={null} edgeId="e1" onClose={() => {}} />)
  const band = await waitFor(() => {
    const el = container.querySelector<HTMLButtonElement>('[data-testid="strength-band-moderate"]')
    expect(el, 'PRECONDITION: the moderate band renders').not.toBeNull()
    return el!
  })
  fireEvent.click(band)
  await waitFor(() => expect(sendSystemEvent).toHaveBeenCalledTimes(1))
  return container
}

beforeEach(() => {
  cleanup()
  sendSystemEvent.mockClear()
  __resetPendingEdgeEditsForTest()
  __resetStalenessVoicesForTest()
  replyHash = undefined
  acceptReply = false
  beforeReply = undefined
  afterReply = undefined
})

function seedCompletedRun(): CEEAnalysisReady {
  seed()
  // Minimal valid readiness, matching analysisReady.invalidation.spec.ts.
  const ready: CEEAnalysisReady = { goal_node_id: 'n_mrr', options: [] }
  useCanvasStore.setState({
    ceeAnalysisReady: ready,
    ceeAnalysisReadyNodeIds: ['n_churn', 'n_mrr'],
    results: { status: 'complete', report: { probability_of_goal: 0.62 } } as never,
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-10-07T00:00:00Z' },
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    v5AnalysisFact: null,
    importPendingServerRegistration: false,
    currentScenarioFraming: null,
  })
  const state = renderHook(() => useAnalysisState()).result.current
  expect(state.semantic).toBe('current')
  expect(deriveRerunActionLabel({ isRunning: false, ...state })).not.toBe(RERUN_LABEL_CHANGED)
  return ready
}

const rerunLabel = () => {
  const state = renderHook(() => useAnalysisState()).result.current
  return deriveRerunActionLabel({ isRunning: false, ...state })
}

describe('analysis currency after the inspector settles', () => {
  it('ROW 1: a refused band restores clean currency and the exact readiness object', async () => {
    const ready = seedCompletedRun()
    replyHash = BASE
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(weight()).toBe(0.62)
    expect(feedback().textContent).toContain(CEE_SAID)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(useCanvasStore.getState().ceeAnalysisReady).toBe(ready)
    expect(rerunLabel()).not.toBe(RERUN_LABEL_CHANGED)
    expect(renderHook(() => useStageAwarePlaceholder()).result.current).not.toBe(PLACEHOLDER_CHANGED_RUNNABLE)
  })

  it('ROW 2: an accepted band remains dirty and the real footer names the change', async () => {
    seedCompletedRun()
    acceptReply = true
    replyHash = 'h-accepted'
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'sent'))
    const edge = useCanvasStore.getState().edges.find((e) => e.id === 'e1')!
    const own = sendSystemEvent.mock.calls[0][1]!.optimisticEdgeEdit!
    expect(weight()).toBe(own.sentMagnitude)
    expect(edge.data?.serverStrength).toEqual({ mean: own.sentMagnitude, effect_direction: 'positive' })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(rerunLabel()).toBe(RERUN_LABEL_CHANGED)
  })

  it('ROW 3: refusal cannot clean a different edge’s analytical edit', async () => {
    seedCompletedRun()
    useCanvasStore.setState({ edges: [...useCanvasStore.getState().edges, {
      id: 'e2', source: 'n_mrr', target: 'n_churn', data: { ...DEFAULT_EDGE_DATA, weight: 0.2 },
    }] })
    beforeReply = () => useCanvasStore.getState().updateEdge('e2', { data: { ...DEFAULT_EDGE_DATA, weight: 0.8 } })
    replyHash = BASE
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(weight()).toBe(0.62)
    expect(useCanvasStore.getState().edges.find((e) => e.id === 'e2')?.data?.weight).toBe(0.8)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(rerunLabel()).toBe(RERUN_LABEL_CHANGED)
  })

  it('ROW 4: a newer readiness object prevents restoration of the old analysis', async () => {
    const ready = seedCompletedRun()
    const newer = { ...ready }
    beforeReply = () => {
      useCanvasStore.setState({ ceeAnalysisReady: newer, analysisFreshnessDirty: false })
      expect(useCanvasStore.getState().ceeAnalysisReady).toBe(newer)
      expect(newer).not.toBe(ready)
    }
    replyHash = BASE
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(weight()).toBe(0.62)
    // Existing updateEdge invalidation clears the newer readiness on the revert.
    // It must not be replaced with the older run's readiness or clean overlay.
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBe(ready)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
})

/**
 * ⭐ THE SERVED REFUSAL REPLY RE-STATES THE USER'S RUN (Canvas served witness draws 4a/4a-2, UI d16ccc87, CEE a5d3b0e).
 * CEE refuses the band and answers with the Run the user already had (`complete_current`, the same `graph_hash_at_run` +
 * `computed_at`) as a NEW `analysis_ready` object. Bound by object identity, the revert read that as "a newer analysis",
 * skipped the restore, and the screen said "Rerun — model changed". Served graph + both replies verbatim; both
 * replies go through the real `applyV5State`, in the turn handler's order.
 */
type Json = Record<string, any>
const SERVED = servedCapture as unknown as { graph: Json; graph_hash: string; run_reply: Json; refusal_reply: Json }
const REFUSED_FROM = 'price_rise_from_current_price'
const REFUSED_TO = 'monthly_recurring_revenue'
const RUN = { graph_hash_at_run: '735226cfd8d740c9', computed_at: '2026-10-07T02:18:38.125Z' }

function replayEnvelope(response: Json) {
  const s = useCanvasStore.getState()
  s.beginExternalGraphMutation?.('envelope_apply')
  try {
    applyV5State(response as never, {
      ...s,
      currentResultsHash: s.results?.hash ?? null,
      backfillGoalThreshold: backfillGoalThresholdOntoGoalNode,
    } as never)
  } finally {
    useCanvasStore.getState().endExternalGraphMutation?.()
  }
}

function seedServedRun() {
  const edges = (SERVED.graph.edges as Json[]).map((e) => {
    const mean = e.strength?.mean as number
    const sign = e.effect_direction === 'negative' ? 'negative' : 'positive'
    const refused = e.from === REFUSED_FROM && e.to === REFUSED_TO
    return {
      id: refused ? 'e1' : `${e.from}->${e.to}`, source: e.from, target: e.to,
      data: { ...DEFAULT_EDGE_DATA, weight: mean, direction: sign, weightSource: 'cee', serverStrength: { mean, effect_direction: sign } },
    }
  })
  useCanvasStore.setState({
    nodes: (SERVED.graph.nodes as Json[]).map((n) => ({ id: n.id, type: n.kind, data: { label: n.label }, position: { x: 0, y: 0 } })) as never[],
    edges: edges as never[],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    lastServerGraphHash: SERVED.graph_hash,
    _internal: {},
    ceeAnalysisReady: null,
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never)
  replayEnvelope(SERVED.run_reply)
  useCanvasStore.setState({
    results: { status: 'complete', report: { probability_of_goal: 0.45 } } as never,
    hasCompletedFirstRun: true,
    analysisFreshnessDirty: false,
    v5AnalysisFact: null,
    importPendingServerRegistration: false,
    currentScenarioFraming: null,
  } as never)
  const ready = useCanvasStore.getState().ceeAnalysisReady as Json | null
  expect(ready, 'PRECONDITION: the served Run reply wrote readiness').not.toBeNull()
  expect({ graph_hash_at_run: ready!.graph_hash_at_run, computed_at: ready!.computed_at }).toEqual(RUN)
  expect(rerunLabel(), 'PRECONDITION: the Run is current before the press').not.toBe(RERUN_LABEL_CHANGED)
  return Object.fromEntries(ANALYSIS_CURRENCY_KEYS.map((k) => [k, useCanvasStore.getState()[k]]))
}

/** The served refusal reply, optionally describing a different Run. */
function refusalReply(run?: { graph_hash_at_run?: string; computed_at?: string | null }): Json {
  const r = JSON.parse(JSON.stringify(SERVED.refusal_reply)) as Json
  if (run?.graph_hash_at_run !== undefined) r.analysis_ready.graph_hash_at_run = run.graph_hash_at_run
  if (run?.computed_at === null) delete r.analysis_ready.computed_at
  else if (run?.computed_at !== undefined) {
    r.analysis_ready.computed_at = run.computed_at
    r.analysis_state.run_state.computed_at = run.computed_at
  }
  return r
}

async function pressRefusedBand(reply: Json) {
  replyHash = reply.graph_hash
  afterReply = () => {
    replayEnvelope(reply)
    // PRECONDITION: the reply really did put a NEW readiness object in the store before the send settled.
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
  }
  await clickModerate()
  await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
  expect(weight()).toBe(SERVED_MEAN)
}
const SERVED_MEAN = 0.7619047619047619

describe('⭐ the served refusal reply re-states the Run the user already had (draws 4a/4a-2)', () => {
  it('RED: the same Run re-stated → every currency field is what it was before the press; never "model changed"', async () => {
    const before = seedServedRun()
    const priorObject = before.ceeAnalysisReady
    await pressRefusedBand(refusalReply())
    const after = useCanvasStore.getState()
    for (const k of ANALYSIS_CURRENCY_KEYS) expect(after[k], k).toBe(before[k])
    expect(after.ceeAnalysisReady).toBe(priorObject)
    expect(after.analysisFreshnessDirty).toBe(false)
    expect(rerunLabel()).not.toBe(RERUN_LABEL_CHANGED)
    expect(renderHook(() => useStageAwarePlaceholder()).result.current).not.toBe(PLACEHOLDER_CHANGED_RUNNABLE)
  })

  it.each([
    ['a NEW Run in the reply (later computed_at, same graph)', { computed_at: '2026-10-07T02:19:30.000Z' }],
    ['a Run on a different graph (same computed_at)', { graph_hash_at_run: 'a0b1c2d3e4f5a6b7' }],
    ['a reply whose Run cannot be identified (no computed_at)', { computed_at: null }],
  ] as const)('PRECONDITION ROW: %s still replaces — the older Run is not restored', async (_n, run) => {
    const before = seedServedRun()
    await pressRefusedBand(refusalReply(run))
    const after = useCanvasStore.getState()
    expect(after.ceeAnalysisReady).not.toBe(before.ceeAnalysisReady)
    expect(after.analysisFreshnessDirty).toBe(true)
  })
})

describe('F1 — the pill shows only what the model holds', () => {
  it('RED: CEE answers the move at the SAME hash → the pill returns to the model’s band and the panel says CEE’s words', async () => {
    seed()
    replyHash = BASE
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'refused'))
    expect(weight()).toBe(0.62)
    expect(feedback().textContent).toContain(CEE_SAID)
  })

  it('CONTROL: a reply at a NEW hash proves nothing about a no-write — the number is kept and the line says it cannot confirm', async () => {
    seed()
    replyHash = 'h-new-9a1c'
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'unverified'))
    expect(weight()).not.toBe(0.62)
    expect(feedback().textContent).not.toContain(CEE_SAID)
  })

  it('CONTROL: no base hash held (CEE never stamped one) → no claim, today’s rule', async () => {
    seed(null)
    replyHash = BASE
    await clickModerate()
    await waitFor(() => expect(feedback()).toHaveAttribute('data-settlement', 'unverified'))
    expect(weight()).not.toBe(0.62)
  })
})

describe('edgeEditAnsweredUnmoved — the proof, and only the proof', () => {
  const before = { weight: 0.62, direction: 'positive', serverStrength: { mean: 0.62, effect_direction: 'positive' } }
  const inFlight = (sentMagnitude: number, sentDirection?: 'positive' | 'negative') => {
    __resetPendingEdgeEditsForTest()
    markEdgeEditInFlight('e1', sentMagnitude, before, sentDirection)
  }
  it('a MOVE answered at the sent hash → proven not applied', () => {
    inFlight(0.3)
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: 0.3, baseGraphHash: BASE }, BASE)).toBe(true)
  })
  it('a direction FLIP (same |mean|) answered at the sent hash → proven not applied', () => {
    inFlight(0.62, 'negative')
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: 0.62, sentDirection: 'negative', baseGraphHash: BASE }, BASE)).toBe(true)
  })
  it.each([
    ['a different reply hash', 0.3, BASE, 'h-new'],
    ['no reply hash', 0.3, BASE, undefined],
    ['no base hash', 0.3, null, BASE],
    ['an empty base hash', 0.3, '', ''],
    ['a send that moved nothing (sent = server-stated)', 0.62, BASE, BASE],
  ] as const)('no claim on %s', (_n, sent, base, reply) => {
    inFlight(sent)
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: sent, baseGraphHash: base }, reply)).toBe(false)
  })
  it('no claim for an edit that is not the in-flight one', () => {
    inFlight(0.3)
    expect(edgeEditAnsweredUnmoved({ edgeId: 'e1', sentMagnitude: 0.85, baseGraphHash: BASE }, BASE)).toBe(false)
  })
})

describe('the wiring the double stands in for (source pin)', () => {
  it('useConversation notes a proven refusal of its own edge edit from the reply’s graph_hash, and the send carries the base', () => {
    const conv = readFileSync('src/canvas/conversation/useConversation.ts', 'utf8')
    expect(conv).toMatch(/systemEvent\?\.type === 'edge_strength_edit' &&\s*target\.kind !== 'typed_error' &&\s*activeV5TurnIdRef\.current === turnClientId &&\s*edgeEditAnsweredUnmoved\(ownEdgeEdit, target\.response\.graph_hash\)/)
    expect(conv).toMatch(/noteEdgeEditNotApplied\(ownEdgeEdit,/)
    const mut = readFileSync('src/canvas/ui/inspector-v2/useInspectorMutations.ts', 'utf8')
    expect(mut.match(/baseGraphHash: useCanvasStore\.getState\(\)\.lastServerGraphHash/g)?.length).toBe(2)
  })
})
