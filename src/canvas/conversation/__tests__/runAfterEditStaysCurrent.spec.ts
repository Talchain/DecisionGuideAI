/**
 * A RUN THAT FOLLOWS AN EDIT IS CURRENT — the receipt it carries must not
 * re-dirty the model it was computed against.
 *
 * WITNESSED on served UI `a4434670` (24 Sep 2026,
 * `output/canvas-completion-20260923/MANUAL-EDIT-PROOF-20260924.md` D1, 4 of 4
 * runs that followed an edit, `?ai=openai`, run turns `exit_path:
 * agent_lane_v1`): the run's response said `analysis_ready.freshness: "fresh"`
 * with `graph_hash_at_run == current_graph_hash`; the store took it and cleared
 * the overlay; ~39 ms later `markGraphStructurallyEdited` set it again, called
 * from the served chunk's `Vc` — `reconcileAppliedGraph` — on the run turn's
 * own `draft_graph`. Canvas cue, cards, goal card and composer all said "Model
 * changed" over a run CEE, the response and the store called current. A run
 * with NO preceding edit cleared correctly; a reload cleared it.
 *
 * WHY THE RUN TURN CARRIES A RECEIPT THAT "CHANGES" THE CANVAS: on the Agent
 * lane every turn returns `draft_graph` read back from the persisted graph
 * (CEE `routes/agent-v1-turn.ts` `readBackState`, served `3f412be`), and after
 * an edit that readback is not byte-identical to what the edit left on the
 * canvas. Which field differed on the served wire is UNVERIFIED. This spec uses
 * one divergence DERIVED FROM CODE, not invented: `applyV5State`'s
 * `set_factor_value` WITHDRAWS `extractionType` (both spellings) and does not
 * restate node `provenance`, while CEE's persisted node keeps all three
 * authorship facts — `provenance: "user_set"`, `observedState.source:
 * "user_override"`, `extractionType: "inferred"` (the witnessed persisted node
 * quoted in `applyV5State.ts` at the `set_factor_value` arm). The fix does not
 * key on that field; the contrasts below prove what it DOES key on.
 *
 * The chain is the REAL one: `useConversation` → `applyV5State` →
 * `reconcileAppliedGraph` → the real store → `useRunCurrency` (the composed
 * currency every card caption reads). Only the transport is mocked.
 *
 * The edit turn's reply is the `graph_patch: applied` shape the store's own
 * docs record for a factor-value edit (`analysis_ready` present, SILENT on
 * freshness — `VERDICT_ABSENT_FROM_PAYLOAD`), with the witnessed `after`
 * (`{ value, source: 'user_override' }`, `applyV5State.ts`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AnalysisStateV1Schema, type AnalysisStateV1 } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { useRunCurrency } from '../../nodes/shared/runCurrency'
import { __resetPendingFactorEditsForTest } from '../pendingFactorEdit'

const replies: unknown[] = []
const dispatched: Array<Record<string, unknown>> = []

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      const next = replies.shift()
      if (next === undefined) throw new Error('harness: a turn was dispatched with no reply queued')
      return next
    }),
  }
})
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useConversation } from '../useConversation'

// ── Fixtures ────────────────────────────────────────────────────────────────
const SCENARIO = '2fc23a4b-432c-45f5-aa08-05fda6b22c5b'
const FACTOR = 'fac_usage_exposure'
/** Graph hash CEE held for the first run, and after the edit. */
const H_BEFORE = '15708bd9c1d2e3f4'
const H_AFTER = '070cc94ab5a6c7d8'

const GOAL = { id: 'goal_nrr', kind: 'goal', label: 'Grow net revenue retention' }
const OPT_A = { id: 'opt_full_switch', kind: 'option', label: 'Full Switch to Usage-Based' }
const OPT_B = { id: 'opt_status_quo', kind: 'option', label: 'Keep Per-Seat Pricing' }

/** The factor as CEE persisted it at open (Olumi's estimate). */
const FACTOR_AT_OPEN = {
  id: FACTOR,
  kind: 'factor',
  label: 'Usage-Based Pricing Exposure',
  provenance: 'ai_inferred',
  observed_state: { value: 0, source: 'cee_inference', extractionType: 'inferred' },
}
/**
 * The factor as CEE persisted it after the user's `factor_value_edit` — the
 * three authorship facts of the witnessed persisted node (see header).
 */
const FACTOR_AFTER_EDIT = {
  id: FACTOR,
  kind: 'factor',
  label: 'Usage-Based Pricing Exposure',
  provenance: 'user_set',
  observed_state: { value: 0.5, source: 'user_override', extractionType: 'inferred' },
}

const nodesAtOpen = [GOAL, OPT_A, OPT_B, FACTOR_AT_OPEN]
const nodesAfterEdit = [GOAL, OPT_A, OPT_B, FACTOR_AFTER_EDIT]

/** `buildAppliedGraphWireField` — the four required fields plus the 0.43 carriers. */
function draftGraph(nodes: unknown[]) {
  return {
    nodes,
    edges: [],
    node_count: nodes.length,
    edge_count: 0,
    options: [],
    goal_node_id: GOAL.id,
    goal_constraints: [],
  }
}

function readiness(extra: Record<string, unknown>) {
  return {
    status: 'ready',
    goal_node_id: GOAL.id,
    options: [
      { id: OPT_A.id, status: 'ready', interventions: {} },
      { id: OPT_B.id, status: 'ready', interventions: {} },
    ],
    ...extra,
  }
}

/** Built through the REAL contract parser — a fixture that cannot meet the contract certifies nothing. */
function completeCurrent(computedAt: string): AnalysisStateV1 {
  const parsed = AnalysisStateV1Schema.safeParse({
    run_state: { kind: 'complete_current', computed_at: computedAt },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  })
  if (!parsed.success) throw new Error(`fixture: ${JSON.stringify(parsed.error.issues)}`)
  return parsed.data
}

function analysisBlock(pA: number) {
  return {
    type: 'analysis_result' as const,
    summary: 'Full Switch leads.',
    leading_option_id: OPT_A.id,
    win_probabilities: { [OPT_A.id]: pA, [OPT_B.id]: Number((1 - pA).toFixed(3)) },
  }
}

/**
 * An Agent-lane run turn: the run's result, the readback's `draft_graph`, and
 * the readback's verdict (`withRunStateFreshness`: `fresh` + the hash pair,
 * stamped only when `computed_against_hash === graph_hash`).
 */
function runTurn(opts: {
  nodes: unknown[]
  pA: number
  atRun: string
  current: string
  computedAt: string
}) {
  return {
    ok: true,
    response: {
      assistant_text: 'Full Switch leads.',
      blocks: [analysisBlock(opts.pA)],
      suggested_actions: [],
      graph_hash: opts.current,
      analysis_ready: readiness({
        freshness: 'fresh',
        freshness_reason: 'agent_readback_run_state_current',
        graph_hash_at_run: opts.atRun,
        current_graph_hash: opts.current,
        computed_at: opts.computedAt,
      }),
      analysis_state: completeCurrent(opts.computedAt),
      draft_graph: draftGraph(opts.nodes),
    },
  }
}

/** The `graph_patch: applied` reply to a factor-value edit — silent on freshness. */
function editTurnReply(computedAt: string) {
  return {
    ok: true,
    response: {
      assistant_text: 'Applied · Updated factor value 0 → 0.5',
      blocks: [
        {
          type: 'graph_patch',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: FACTOR,
          after: { value: 0.5, source: 'user_override' },
        },
      ],
      suggested_actions: [],
      analysis_ready: readiness({ computed_at: computedAt }),
    },
  }
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

function currency() {
  return renderHook(() => useRunCurrency()).result.current
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  replies.length = 0
  dispatched.length = 0
  __resetPendingFactorEditsForTest()
  // The canvas as boot hydration leaves it: CEE's graph through the SAME mapper
  // the receipt path uses, and CEE's acknowledgement of exactly these ids.
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: nodesAtOpen.map((n, i) => ({ ...mapDraftNodeToCanvas(n), position: { x: i * 220, y: 0 } })),
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: { nodeIds: nodesAtOpen.map((n) => n.id), edgePairs: [] },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

type Conv = { current: ReturnType<typeof useConversation> }

async function run(result: Conv, reply: unknown) {
  replies.push(reply)
  await act(async () => {
    void result.current.sendMessage('Run the analysis')
    await flush()
  })
  expect(replies.length, 'harness: the run reply was consumed').toBe(0)
  expect(useCanvasStore.getState().results?.status, 'harness: the run hydrated a report').toBe('complete')
}

/** The user types 0.5 on the card: the optimistic write, then the system event. */
async function editTheFactor(result: Conv) {
  replies.push(editTurnReply('2026-09-24T01:10:00.000Z'))
  await act(async () => {
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!
    useCanvasStore.getState().updateNode(FACTOR, {
      data: {
        ...(node.data as Record<string, unknown>),
        observedState: { ...((node.data as { observedState?: object }).observedState ?? {}), value: 0.5 },
      },
    } as never)
    await result.current.sendSystemEvent({
      type: 'factor_value_edit',
      payload: { target_id: FACTOR, value: 0.5, field: 'value' },
    } as never)
    await flush()
  })
  expect(replies.length, 'harness: the edit reply was consumed').toBe(0)
}

describe('D1 — a run that follows an edit is current', () => {
  it('CONTROL (witness run 4): a run with no preceding edit is current', async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({
      nodes: nodesAtOpen, pA: 0.578, atRun: H_BEFORE, current: H_BEFORE,
      computedAt: '2026-09-24T01:00:00.000Z',
    }))
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(currency()).toBe('current')
  })

  it('RED at base: run → edit → rerun; the rerun is current after every timer and microtask', async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({
      nodes: nodesAtOpen, pA: 0.578, atRun: H_BEFORE, current: H_BEFORE,
      computedAt: '2026-09-24T01:00:00.000Z',
    }))
    expect(currency(), 'precondition: the first run is current').toBe('current')

    await editTheFactor(result)
    expect(currency(), 'precondition: the edit is correctly shown as a change since the run').toBe('changed')

    await run(result, runTurn({
      nodes: nodesAfterEdit, pA: 0.585, atRun: H_AFTER, current: H_AFTER,
      computedAt: '2026-09-24T01:14:37.000Z',
    }))

    const s = useCanvasStore.getState()
    expect(s.analysisFreshness?.freshness, 'the store holds CEE\'s verdict').toBe('fresh')
    expect(s.analysisFreshness?.currentGraphHash).toBe(H_AFTER)
    expect(
      s.analysisFreshnessDirty,
      'the run\'s own receipt re-dirtied the model it was computed against',
    ).toBe(false)
    expect(currency(), 'every card caption would say "Last run ·" over a current run').toBe('current')

    // The receipt was still ingested — the fix withholds a false claim, not the graph.
    const factor = s.nodes.find((n) => n.id === FACTOR)!.data as Record<string, unknown>
    expect(factor.provenance, 'the readback reached the canvas').toBe('user_set')
  })

  it('CONTRAST: a `fresh` whose own hash pair disagrees licenses nothing — the rerun reads "changed"', async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({
      nodes: nodesAtOpen, pA: 0.578, atRun: H_BEFORE, current: H_BEFORE,
      computedAt: '2026-09-24T01:00:00.000Z',
    }))
    await editTheFactor(result)
    await run(result, runTurn({
      nodes: nodesAfterEdit, pA: 0.585, atRun: H_BEFORE, current: H_AFTER,
      computedAt: '2026-09-24T01:14:37.000Z',
    }))
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(currency()).toBe('changed')
  })

  it('CONTRAST: the store holds a NEWER verdict than this run\'s — the receipt is not vouched for, so it still marks', async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({
      nodes: nodesAtOpen, pA: 0.578, atRun: H_BEFORE, current: H_BEFORE,
      computedAt: '2026-09-24T01:00:00.000Z',
    }))
    await editTheFactor(result)
    // A later verdict about a different graph is already held; the reducer
    // will refuse this run's strictly-older payload.
    act(() => {
      useCanvasStore.getState().setAnalysisFreshness({
        freshness: 'fresh',
        freshness_reason: 'graph_hash_match',
        graph_hash_at_run: 'ffffeeee00001111',
        current_graph_hash: 'ffffeeee00001111',
        computed_at: '2026-09-24T02:00:00.000Z',
      })
    })
    await run(result, runTurn({
      nodes: nodesAfterEdit, pA: 0.585, atRun: H_AFTER, current: H_AFTER,
      computedAt: '2026-09-24T01:14:37.000Z',
    }))
    expect(useCanvasStore.getState().analysisFreshness?.currentGraphHash).toBe('ffffeeee00001111')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('CONTRAST (#344): a confirmed chat edit whose receipt carries a verdict SILENT on freshness still marks the model changed', async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({
      nodes: nodesAtOpen, pA: 0.578, atRun: H_BEFORE, current: H_BEFORE,
      computedAt: '2026-09-24T01:00:00.000Z',
    }))
    // No optimistic write: the chat edit's receipt is the ONLY thing that
    // changes the canvas, so only the reconcile can mark it.
    replies.push({
      ok: true,
      response: {
        assistant_text: 'Done — Usage-Based Pricing Exposure is now 0.5.',
        blocks: [],
        suggested_actions: [],
        analysis_ready: readiness({ computed_at: '2026-09-24T01:05:00.000Z' }),
        draft_graph: draftGraph(nodesAfterEdit),
      },
    })
    await act(async () => {
      void result.current.sendMessage('Set usage-based pricing exposure to 0.5')
      await flush()
    })
    const factor = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!.data as {
      observedState?: { value?: number }
    }
    expect(factor.observedState?.value, 'precondition: the receipt changed the canvas').toBe(0.5)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(currency()).toBe('changed')
  })
})
