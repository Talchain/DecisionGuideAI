/**
 * Leg 3 (bias-coaching rendering slice) — SEAM pins for the draft-turn
 * bias-signal bridge. Unlike the builder pins (draftBiasSignalBlocks.spec.ts,
 * which inject the store slice by hand), this suite drives the REAL V5
 * inline-draft seam end to end, exactly as useConversation.ts sendTurn
 * wires it:
 *
 *   wire body → parseV5Response → attachAnalysisReadyToInlineDraftGraph
 *             → applyDraftResult (real canvas store)
 *             → buildDraftBiasSignalBlocks
 *
 * Why this pin exists (PR #356 adversarial review, confirmed blocker):
 * at the pinned boundary schema (0.15.0) the strict OlumiResponseSchema
 * declares NO root `coaching` key, so the parser demotes it to the
 * non-enumerable `__additive__` sidecar. Nothing on the V5 conversation
 * path mapped it into the store — applyDraftResult committed
 * `draftCoaching: null` three statements before the bridge read it, so
 * the feature was dead on arrival in production while every builder spec
 * stayed green. This suite is the pin that seam lacked.
 *
 * Fixture provenance: shape mirrors the live-verified draft response on
 * CEE staging (build 57959b2c3, 16 Jul 2026) — root `coaching.bias_signals`
 * as a SIBLING of `draft_graph`. The canonical deployed BiasSignalSchema is
 * `z.object({ type, detail }).strict()` (no target), so the primary pin drives
 * the real ungrounded wire shape; a grounded variant (target on a real node id,
 * a UI-adapter widening) is kept as secondary coverage of the ref-resolution
 * branch.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  parseV5Response,
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../../../v5/responseParser'
import { attachAnalysisReadyToInlineDraftGraph } from '../useConversation'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { useCanvasStore } from '../../store'
import { buildDraftBiasSignalBlocks } from '../draftBiasSignalBlocks'

// ─── Wire fixture (CEE staging shape) ────────────────────────────────────

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

/** A schema-valid 0.15.0 V5 turn body carrying an inline draft graph. */
function wireBody(opts: { coaching?: unknown } = {}): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: 'I have drafted a starting model of your decision.',
    blocks: [],
    suggested_actions: [],
    insights: [],
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
    ...('coaching' in opts ? { coaching: opts.coaching } : {}),
  }
}

function makeResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Drive the seam exactly as useConversation.ts sendTurn does on the
 * inline-draft turn (the ONLY production caller of the bridge): parse the
 * wire body, attach the response-root fields onto the inline graph, apply
 * it through the real store, then run the bridge against the real store
 * state. Mirrors useConversation.ts — if the production wiring changes,
 * update BOTH places.
 */
async function driveSeam(body: Record<string, unknown>) {
  const result = await parseV5Response(makeResponse(body))
  if (result.kind !== 'response') {
    throw new Error(`expected a parsed response, got ${result.kind}`)
  }
  const response = result.response
  // Full parsed response: the helper reads analysis_ready /
  // goal_constraints / sidecar coaching off it internally (review-folds A3
  // collapsed the positional params).
  const inlineGraph = attachAnalysisReadyToInlineDraftGraph(
    response.draft_graph,
    response,
  )
  expect(inlineGraph).toBeTruthy()
  applyDraftResult(inlineGraph as never)
  return buildDraftBiasSignalBlocks({
    isDraftTurn: true,
    store: useCanvasStore.getState(),
    existingBlocks: [],
  })
}

// ─── Pins ────────────────────────────────────────────────────────────────

describe('draft bias-signal bridge — REAL applyDraftResult seam', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('root coaching.bias_signals reaches the store and renders exactly 2 grounded cards', async () => {
    const blocks = await driveSeam(wireBody({ coaching: WIRE_COACHING }))

    // The commit link: applyDraftResult must have put the mapped coaching
    // into the store BEFORE the bridge read it.
    const committed = useCanvasStore.getState().draftCoaching
    expect(committed).not.toBeNull()
    expect(committed?.biasSignals).toHaveLength(2)

    // The rendered cards.
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Status quo bias', 'Anchoring'])
    expect(blocks.map((b) => b.body)).toEqual([
      WIRE_COACHING.bias_signals[0].detail,
      WIRE_COACHING.bias_signals[1].detail,
    ])
    expect(blocks[0].target_refs).toEqual([
      { id: 'fac_current_supplier', label: 'Current supplier terms', kind: 'factor' },
    ])
    expect(blocks[1].target_refs).toEqual([
      { id: 'fac_initial_quote', label: 'Initial quote', kind: 'factor' },
    ])
    for (const b of blocks) {
      expect(b.type).toBe('v5_coaching')
      expect(b.coaching_kind).toBe('bias_signal')
    }
  })

  it('real-wire signals ({ type, detail }, NO target) render 2 UNGROUNDED cards (target_refs [])', async () => {
    // The canonical deployed BiasSignalSchema is z.object({ type, detail }).strict()
    // — the wire NEVER sends a target. This is the shape the seam actually
    // receives in production; the old `if (!ref) continue` dropped every one of
    // these, so the fallback rendered nothing. Grounding is optional (CEE #541).
    const blocks = await driveSeam(
      wireBody({
        coaching: {
          summary: 'The draft leans on the current arrangement and the first quote.',
          bias_signals: [
            {
              type: 'status_quo_bias',
              detail:
                'The model leans on keeping the current supplier without weighing the switch on equal terms.',
            },
            {
              type: 'anchoring',
              detail:
                'Estimates cluster tightly around the initial quote rather than an independent range.',
            },
          ],
        },
      }),
    )

    expect(useCanvasStore.getState().draftCoaching?.biasSignals).toHaveLength(2)
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Status quo bias', 'Anchoring'])
    for (const b of blocks) {
      expect(b.coaching_kind).toBe('bias_signal')
      expect(b.target_refs).toEqual([])
    }
  })

  it('a draft with no root coaching clears stale draftCoaching — no ghost cards from a prior draft', async () => {
    // Stale coaching keyed to a previous draft's node ids must not survive
    // a fresh draft (applyDraftResult's existing clear semantics).
    useCanvasStore.getState().setDraftCoaching({
      summary: null,
      strengthenItems: [],
      wideningLog: [],
      biasSignals: [
        { type: 'anchoring', detail: 'Stale signal from a prior draft.', target: 'old_node' },
      ],
    })

    const blocks = await driveSeam(wireBody())

    expect(useCanvasStore.getState().draftCoaching).toBeNull()
    expect(blocks).toEqual([])
  })

  it('at the pinned 0.15.0 schema, root coaching lands in the __additive__ sidecar, not the strict surface', async () => {
    // Documents WHY the seam read needs the sidecar: OlumiResponseSchema is
    // .strict() and declares no `coaching` root key, so adding `coaching` to
    // KNOWN_OLUMI_TOP_LEVEL_KEYS would route it into strict validation and
    // fail the whole parse. Until @talchain/schemas formalises the key, the
    // sidecar IS where a root coaching object lands.
    const result = await parseV5Response(makeResponse(wireBody({ coaching: WIRE_COACHING })))
    if (result.kind !== 'response') {
      throw new Error(`expected a parsed response, got ${result.kind}`)
    }
    expect((result.response as { coaching?: unknown }).coaching).toBeUndefined()
    const sidecar = (result.response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY]
    expect(sidecar?.['coaching']).toEqual(WIRE_COACHING)
  })
})
