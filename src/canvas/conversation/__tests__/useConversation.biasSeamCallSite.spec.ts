/**
 * PR #356 fast-follow — CALL-SITE pin for the draft bias-signal seam.
 *
 * The existing suites pin the pieces, not the wiring:
 *   - draftBiasSignalBlocks.spec.ts pins the builder with a hand-injected
 *     store slice;
 *   - draftBiasSignalBlocks.seam.spec.ts drives a MIRROR of the sendTurn
 *     wiring (its own driveSeam copy).
 * The #356 review proved by mutation that dropping any of the real
 * call-site arguments — `target.response` into
 * attachAnalysisReadyToInlineDraftGraph (useConversation.ts ~L3293), or
 * `isDraftTurn` / `existingBlocks` into buildDraftBiasSignalBlocks
 * (~L3425-3429) — leaves all 23 seam+builder tests GREEN while the feature
 * dies in production. This suite is the missing pin: it renders the REAL
 * useConversation hook and drives sendMessage through the REAL V5
 * success path (routeV5Response → attach → applyDraftResult → bridge →
 * addMessage), asserting on the message the user would see.
 *
 * Mutation map (each verified RED in a throwaway worktree):
 *   - drop the 4th arg (`target.response`) at the attach call
 *       → sidecar coaching never reaches the store → 'renders the two
 *         grounded bias cards' goes RED (0 cards).
 *   - drop/false `isDraftTurn: draftAppliedThisTurn`
 *       → bridge gate never opens → same test RED.
 *   - drop `existingBlocks: finalBlocks`
 *       → producer-wins suppression dies → 'producer typed bias coaching
 *         wins' goes RED (bridge doubles the cards).
 *
 * Harness mirrors useConversation.reasoning.spec.ts (the established
 * V5-happy-path hook harness), plus a real draft graph + root coaching
 * sidecar in the CEE staging wire shape (build 57959b2c3, 16 Jul 2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useResultsStore } from '../../stores/resultsStore'
import { ADDITIVE_EXTENSIONS_KEY } from '../../../v5/responseParser'
import type { V5CoachingBlock } from '../types'

// ---------------------------------------------------------------------------
// Mocks (same bridge set as useConversation.reasoning.spec.ts)
// ---------------------------------------------------------------------------

const mockCallTurn = vi.fn()
const mockStreamTurn = vi.fn()

vi.mock('../turnService', () => ({
  callOrchestratorTurn: (...args: unknown[]) => mockCallTurn(...args),
  streamOrchestratorTurn: (...args: unknown[]) => mockStreamTurn(...args),
  OrchestratorError: class OrchestratorError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.name = 'OrchestratorError'
      this.status = status
      this.body = body
    }
  },
}))

const mockCallV5Turn = vi.fn()
vi.mock('../../../v5/v5Adapter', () => ({
  callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
  getV5Endpoint: () => 'https://cee.test/orchestrate/v2/turn',
}))

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  const flags = await import('../../../flags')
  return {
    ...actual,
    isV5Eligible: () => ({ eligible: true as const }),
    isV5CanonicalRunPath: () => flags.isV5CanonicalAnalysisEnabled(),
  }
})

const mockGetUserId = vi.fn<[], Promise<string | null>>()
vi.mock('../../../lib/supabase', () => ({
  getUserId: (...args: unknown[]) => mockGetUserId(...(args as [])),
  getSessionIdentity: async () => ({
    userId: (await mockGetUserId()) ?? null,
    accessToken: null,
  }),
}))

const mockLoadScenario = vi.fn<[string], Promise<unknown>>()
vi.mock('../../../services/scenarioService', () => ({
  loadScenario: (...args: unknown[]) => mockLoadScenario(...(args as [string])),
}))

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isOrchestratorStreamingEnabled: () => true,
    isOrchestratorV2Enabled: () => true,
  }
})

// ---------------------------------------------------------------------------
// Wire fixture (CEE staging shape — same graph as the seam spec)
// ---------------------------------------------------------------------------

const WIRE_NODES = [
  { id: 'dec_supplier', kind: 'decision', label: 'Choose supplier strategy' },
  { id: 'opt_switch', kind: 'option', label: 'Switch supplier' },
  {
    id: 'fac_current_supplier',
    kind: 'factor',
    label: 'Current supplier terms',
    observed_state: { value: 0.5, baseline: 0.5 },
  },
  {
    id: 'fac_initial_quote',
    kind: 'factor',
    label: 'Initial quote',
    observed_state: { value: 0.5, baseline: 0.5 },
  },
  { id: 'goal_cost', kind: 'goal', label: 'Minimise total cost' },
]

const WIRE_EDGES = [
  { id: 'e1', from: 'dec_supplier', to: 'opt_switch', weight: 0.5, belief: 0.8 },
  { id: 'e2', from: 'opt_switch', to: 'fac_current_supplier', weight: 0.5, belief: 0.7 },
  { id: 'e3', from: 'opt_switch', to: 'fac_initial_quote', weight: 0.5, belief: 0.7 },
  { id: 'e4', from: 'fac_current_supplier', to: 'goal_cost', weight: 0.5, belief: 0.7 },
  { id: 'e5', from: 'fac_initial_quote', to: 'goal_cost', weight: 0.5, belief: 0.7 },
]

const WIRE_COACHING = {
  summary: 'The draft leans on the current arrangement and the first quote.',
  bias_signals: [
    {
      type: 'status_quo_bias',
      detail:
        'The model leans on keeping the current supplier without weighing the switch on equal terms.',
      target: 'fac_current_supplier',
    },
    {
      type: 'anchoring',
      detail:
        'Estimates cluster tightly around the initial quote rather than an independent range.',
      target: 'fac_initial_quote',
    },
  ],
}

/** A producer-typed 0.13.x bias coaching block, as it would ride the
 * parser's phase-3 sidecar (splitBlocksTolerance lifts it out of blocks[]). */
const PRODUCER_BIAS_BLOCK = {
  type: 'coaching',
  block_id: 'producer_bias_1',
  title: 'Anchoring',
  body: 'Producer-authored anchoring coaching, verbatim.',
  coaching_kind: 'bias_signal',
  source: 'decision_review',
  target_refs: [],
  priority_rank: 1,
  freshness: 'fresh',
}

/**
 * A parsed V5 draft-turn result exactly as routeV5Response receives it:
 * draft_graph + analysis_ready on the strict surface, root `coaching`
 * demoted to the ADDITIVE_EXTENSIONS_KEY sidecar (the parser's behaviour at
 * the pinned 0.15.0 schema — pinned by draftBiasSignalBlocks.seam.spec.ts).
 */
function makeDraftTurnResult(opts: { coaching?: unknown; phase3Blocks?: unknown[] } = {}) {
  const response: Record<string, unknown> = {
    response_version: 2,
    assistant_text: 'I have drafted a starting model of your decision.',
    blocks: [] as unknown[],
    suggested_actions: [] as unknown[],
    insights: [] as unknown[],
    stage_indicator: 'analyse',
    draft_graph: {
      nodes: WIRE_NODES,
      edges: WIRE_EDGES,
      node_count: WIRE_NODES.length,
      edge_count: WIRE_EDGES.length,
    },
    analysis_ready: {
      status: 'ready',
      options: [
        { id: 'opt_switch', label: 'Switch supplier', interventions: {}, is_baseline: false },
      ],
      goal_node_id: 'goal_cost',
    },
  }
  const sidecar: Record<string, unknown> = {}
  if (opts.coaching !== undefined) sidecar.coaching = opts.coaching
  if (opts.phase3Blocks !== undefined) sidecar.phase3_blocks = opts.phase3Blocks
  if (Object.keys(sidecar).length > 0) {
    response[ADDITIVE_EXTENSIONS_KEY] = sidecar
  }
  return { kind: 'response' as const, response }
}

beforeEach(() => {
  mockCallTurn.mockReset()
  mockStreamTurn.mockReset()
  mockCallV5Turn.mockReset()
  mockGetUserId.mockReset()
  mockGetUserId.mockResolvedValue(null)
  mockLoadScenario.mockReset()
  mockLoadScenario.mockResolvedValue(null)

  useResultsStore.setState({
    results: {
      status: 'idle',
      progress: 0,
      analysisSummary: undefined,
      lastSnapshotId: undefined,
    },
  } as never)

  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({
    currentScenarioId: 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4',
    nodes: [],
    edges: [],
  })
})

function lastAssistantMessage(messages: ReturnType<typeof useConversation>['messages']) {
  return [...messages].reverse().find((m) => m.role === 'assistant')
}

function biasSignalBlocksOf(
  messages: ReturnType<typeof useConversation>['messages'],
): V5CoachingBlock[] {
  const msg = lastAssistantMessage(messages)
  return ((msg?.blocks ?? []) as V5CoachingBlock[]).filter(
    (b) => b.type === 'v5_coaching' && b.coaching_kind === 'bias_signal',
  )
}

// ---------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------

describe('useConversation — draft bias-signal seam CALL-SITE pin (#356 fast-follow)', () => {
  it('a real draft turn with root coaching renders the two grounded bias cards on the assistant message', async () => {
    mockCallV5Turn.mockResolvedValue(makeDraftTurnResult({ coaching: WIRE_COACHING }))

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Help me decide on a supplier strategy')
    })

    // The draft graph actually applied (the isDraftTurn gate's substrate).
    expect(useCanvasStore.getState().nodes.length).toBe(WIRE_NODES.length)
    // The response-root coaching reached the store through the attach call's
    // 4th argument (target.response) — not through any test-side injection.
    expect(useCanvasStore.getState().draftCoaching?.biasSignals).toHaveLength(2)

    const cards = biasSignalBlocksOf(result.current.messages)
    expect(cards).toHaveLength(2)
    expect(cards.map((b) => b.title)).toEqual(['Status quo bias', 'Anchoring'])
    expect(cards.map((b) => b.body)).toEqual([
      WIRE_COACHING.bias_signals[0].detail,
      WIRE_COACHING.bias_signals[1].detail,
    ])
    expect(cards[0].target_refs).toEqual([
      { id: 'fac_current_supplier', label: 'Current supplier terms', kind: 'factor' },
    ])
  })

  it('producer typed bias coaching wins — the bridge adds nothing when the turn already carries it', async () => {
    mockCallV5Turn.mockResolvedValue(
      makeDraftTurnResult({ coaching: WIRE_COACHING, phase3Blocks: [PRODUCER_BIAS_BLOCK] }),
    )

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Help me decide on a supplier strategy')
    })

    // Store still carries the wire coaching (the draft applied normally)…
    expect(useCanvasStore.getState().draftCoaching?.biasSignals).toHaveLength(2)

    // …but exactly ONE bias card renders: the producer's, never doubled by
    // the bridge (existingBlocks: finalBlocks at the call site).
    const cards = biasSignalBlocksOf(result.current.messages)
    expect(cards).toHaveLength(1)
    expect(cards[0].block_id).toBe('producer_bias_1')
    expect(cards[0].body).toBe(PRODUCER_BIAS_BLOCK.body)
  })

  it('a non-draft turn (no draft_graph) renders no bias cards even with stale store coaching', async () => {
    // Stale coaching left over in the store from a prior draft…
    useCanvasStore.getState().setDraftCoaching({
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        {
          type: 'anchoring',
          detail: 'Stale signal from a prior draft.',
          target: 'fac_current_supplier',
        },
      ],
    })
    // …and a populated canvas so no fresh draft can apply this turn.
    useCanvasStore.setState({
      nodes: [
        {
          id: 'fac_current_supplier',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'Current supplier terms' },
        },
      ] as never,
    })

    const turn = makeDraftTurnResult()
    delete (turn.response as Record<string, unknown>).draft_graph
    mockCallV5Turn.mockResolvedValue(turn)

    const { result } = renderHook(() => useConversation())
    await act(async () => {
      await result.current.sendMessage('Tell me more about the trade-offs')
    })

    // The isDraftTurn gate at the call site is load-bearing: stale store
    // coaching must not leak cards onto a conversational turn.
    expect(biasSignalBlocksOf(result.current.messages)).toEqual([])
  })
})
