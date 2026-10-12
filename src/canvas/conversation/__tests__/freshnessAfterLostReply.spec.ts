/**
 * A GRAPH-WRITING EDIT WHOSE REPLY NEVER ARRIVED MAY HAVE CHANGED THE SAVED MODEL — the last analysis can no longer be
 * vouched for as current (recovery Batch B, the stale-result class).
 *
 * SERVED (`live/runs/2026-10-12T020148Z/capacity`, row 7a; UI 52936df0, CEE c85817f2): "Add one specialist" 1 → 2 as an
 * `option_intervention_edit`. CEE stored it (graph 94902edbc47c5776 → 175a3ae98f06785f), then the connection reset
 * before the reply reached the browser. The strip then said "Analysis reflects the current model." over a result
 * computed on 94902edbc47c5776. A factor edit marks the dirty overlay through its optimistic local write; an option or
 * goal edit writes nothing locally, so nothing marked it. The write base had not moved either (the 200 never arrived),
 * so no hash comparison can see this window.
 *
 * Driven through the REAL adapter: `fetch` rejects after dispatch, as the served connection reset did.
 * Opposite-direction twins: a refusal the producer states wrote nothing, and a lost reply on an event that writes no
 * graph, leave the verdict alone.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import type { WireSystemEvent } from '../types'
import { resolveDisplayedFreshness } from '../../store/analysisFreshness'
import { FRESHNESS_COPY } from '../../../components/results/AnalysisFreshnessNotice'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))

import { useConversation } from '../useConversation'

const SCENARIO = 'cd3d9c25-fa98-4d26-a519-8dd7178ec8f6'
const BASE = '94902edbc47c5776'

/** turns/04.json `request_body.event`, the served dropped edit. */
const optionEdit: WireSystemEvent = {
  type: 'option_intervention_edit',
  payload: { option_id: 'add_one_specialist', factor_id: 'additional_specialists', value: 0.2, base_graph_hash: BASE },
} as WireSystemEvent
/** Writes no graph at CEE (`'fact_and_commit'`). */
const feedback: WireSystemEvent = { type: 'feedback_submitted', payload: { rating: 'up', turn_id: 't1' } } as WireSystemEvent

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

/** What the freshness strip says for the store's verdict and overlay. */
const stripSays = () => {
  const s = useCanvasStore.getState()
  const shown = resolveDisplayedFreshness(s.analysisFreshness, s.analysisFreshnessDirty)
  return shown ? FRESHNESS_COPY[shown] : null
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
    lastServerGraphHash: BASE,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  // The Run's verdict (turns/03.json): computed on the base, current.
  useCanvasStore.getState().setAnalysisFreshness({
    freshness: 'fresh', computed_at: '2026-10-12T02:21:30Z', graph_hash_at_run: BASE, current_graph_hash: BASE,
  })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

async function send(event: WireSystemEvent, fetchImpl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  const { result } = renderHook(() => useConversation())
  let settled: 'resolved' | 'rejected' | null = null
  act(() => {
    void result.current.sendSystemEvent(event, { deferIfBusy: false }).then(() => { settled = 'resolved' }, () => { settled = 'rejected' })
  })
  await act(async () => { await flush() })
  expect(settled, 'PRECONDITION: the send settled').not.toBeNull()
  expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 'PRECONDITION: it was dispatched').toBeGreaterThan(0)
}

describe('after a lost reply, the strip never vouches for the analysis', () => {
  it('PRECONDITION: before the edit the strip says the analysis is current', () => {
    expect(stripSays()).toBe('Analysis reflects the current model.')
  })

  it('RED on df508e8: an option edit whose reply was lost → "Cannot confirm whether this analysis is current."', async () => {
    await send(optionEdit, async () => { throw new TypeError('Failed to fetch') })
    expect(stripSays()).toBe('Cannot confirm whether this analysis is current.')
  })

  it('NEGATIVE: a refusal CEE states wrote nothing (422 system_event_refused_no_write) leaves the verdict current', async () => {
    // CEE's own commit-failure envelope (`buildCommitFailureBoundaryError`), as optionTargetRefusalSettles.wire.spec builds it.
    await send(optionEdit, async () => new Response(JSON.stringify({
      error: 'INGRESS_CONTRACT_VIOLATION', boundary: 'B1', direction: 'egress', validator: 'turn_commit',
      details: { retryable: false, reason: 'system_event_refused_no_write', event_kind: 'option_intervention_edit', stage: 'analyse' },
      request_id: 'req_refused_1', retryable: false,
    }), { status: 422, headers: { 'Content-Type': 'application/json' } }))
    expect(stripSays()).toBe('Analysis reflects the current model.')
  })

  it('NEGATIVE: a lost reply on an event that writes no graph leaves the verdict current', async () => {
    await send(feedback, async () => { throw new TypeError('Failed to fetch') })
    expect(stripSays()).toBe('Analysis reflects the current model.')
  })
})
