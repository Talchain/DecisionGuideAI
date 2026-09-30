/**
 * ⭐ THE CHAT SURVIVES A RELOAD — the cold read's half (MG contract 5907618888, CEE #2352).
 *
 *   · Only the cold open asks: `include_conversation_turns: true` rides the boot hook's read; every other caller's body
 *     stays `{}` byte for byte (MG's additive pin, mirrored here).
 *   · The read's `conversation_turns` is OFFERED to the chat panel keyed by the scenario it came back for, with the
 *     stale verdict of the SAME read (`heldRunIsNotCurrentPerRead`) — never re-derived later against a merged canvas.
 *   · A read without the field (today's served CEE ignores the key: measured 09:0xZ, same 200, same 18 keys) offers nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const CEE_TOKEN = 'c'.repeat(63) + '9'

function envelope(value = CEE_TOKEN, projection = 'identity.v1') {
  return {
    kind: 'graph_identity_hash',
    value,
    algorithm: 'sha256',
    projection_version: projection,
    graph_schema_version: 'graph_v3',
    normaliser_version: '1',
  }
}

/**
 * A verdict that VALIDATES against the vendored contract — the adapter parses
 * with `AnalysisStateV1Schema.safeParse` and a shape that fails yields `null`,
 * which would make every assertion below pass for the WRONG REASON. The
 * positive control in the first test is what proves it parses.
 */
function verdict(
  runState: AnalysisStateV1['run_state'],
  over: Partial<AnalysisStateV1> = {},
): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}

const STALE_VERDICT = verdict({
  kind: 'complete_stale',
  computed_at: '2026-08-25T09:00:00.000Z',
  // `cause`, NOT `stale_cause`. The schema is `.strict()`, so the wrong spelling
  // produced a parse failure that arrived as `null` — indistinguishable from the
  // defect under test. The positive control above is the only reason that was
  // caught rather than shipped as a spec that passes for the wrong reason.
  cause: 'graph_changed',
})

const CURRENT_VERDICT = verdict({
  kind: 'complete_current',
  computed_at: '2026-08-25T09:00:00.000Z',
})

function okBody(over: Record<string, unknown> = {}) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: {
      nodes: [
        // A DIFFERENT value from the seeded canvas below, so the merge genuinely
        // `changed` the graph and #837's mark actually fires. A merge that
        // changes nothing would make the disjointness assertions vacuous.
        { id: 'factor-1', kind: 'factor', label: 'Spend', value: 250 },
        { id: 'goal-1', kind: 'goal', label: 'Profit', value: 9 },
      ],
      edges: [],
    },
    graph_present: true,
    brief_text: null,
    graph_identity_hash: envelope(),
    layout_present: false,
    request_id: 'req-boot-1',
    ...over,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function seedCanvas(): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      {
        id: 'factor-1',
        type: 'factor',
        position: { x: 10, y: 20 },
        data: { label: 'Spend', kind: 'factor', value: 100 },
      },
      {
        id: 'goal-1',
        type: 'goal',
        position: { x: 300, y: 400 },
        data: { label: 'Profit', kind: 'goal', value: 5 },
      },
    ] as never,
    edges: [] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
    // The state `hydrateGraphSlice` leaves behind at boot (`store.ts:6043`).
    analysisStateV1: null,
    analysisFreshnessDirty: false,
  } as never)
}

const TURNS = [
  { turn_id: 't1', created_at: '2026-08-25T08:50:00.000Z', user_message: 'Should we cut prices?', assistant_message: 'Profit reaches the target in 41% of model runs.' },
]

let fetchSpy: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  seedCanvas()
  useServerConversationTurnsStore.setState({ offer: null })
})
afterEach(() => { vi.unstubAllGlobals() })

const sentBody = (): Record<string, unknown> => JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))

describe('the cold read asks for, and offers, the stored chat', () => {
  it('RED: the cold open sends the opt-in key; the read’s turns are offered for THIS scenario with the read’s stale verdict', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ analysis_state: STALE_VERDICT, conversation_turns: TURNS })))
    await hydrateCanvasFromServer(SCENARIO_ID, { includeConversationTurns: true, retryDelayMs: 0 })
    expect(sentBody()).toEqual({ include_conversation_turns: true })
    const offer = useServerConversationTurnsStore.getState().offer
    expect(offer?.scenarioId).toBe(SCENARIO_ID)
    expect(offer?.turns.map((t) => t.turnId)).toEqual(['t1'])
    expect(offer?.run).toEqual({ runNotCurrent: true, currentRunComputedAt: '2026-08-25T09:00:00.000Z' })
  })

  it('a current Run is not marked not-current; its computed_at is carried for the per-reply line', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ analysis_state: { ...CURRENT_VERDICT, requires_rerun: false }, conversation_turns: TURNS })))
    await hydrateCanvasFromServer(SCENARIO_ID, { includeConversationTurns: true, retryDelayMs: 0 })
    expect(useServerConversationTurnsStore.getState().offer?.run.runNotCurrent).toBe(false)
  })

  it('CONTROL: every other caller’s body is byte-identical ({}), and a read without the field offers nothing', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, okBody({ analysis_state: STALE_VERDICT })))
    await hydrateCanvasFromServer(SCENARIO_ID, { retryDelayMs: 0 })
    expect(String((fetchSpy.mock.calls[0][1] as RequestInit).body)).toBe('{}')
    expect(useServerConversationTurnsStore.getState().offer).toBeNull()
  })
})
