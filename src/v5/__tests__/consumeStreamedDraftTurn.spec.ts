/**
 * The two-phase apply orchestrator, and THE CROSS-FRAME IDENTITY TEST the
 * M1-L2 spec requires (ROADMAP 2.122).
 *
 * `m1l2-draft-consumer.md`: *"one test asserting the early-frame graph and the
 * COMPLETE-frame graph agree on identity"* — and the dispatch adds the second
 * half: *"the renderer never shows a node the terminal payload lacks."*
 *
 * Two vacuity traps are closed here, both learned from #751's own round-1
 * mistakes (its identity test compared two shapes that were both empty):
 *
 *   1. the terminal graph rides the response's TOP-LEVEL `draft_graph`, not
 *      `blocks[].data.applied_graph` — on the turn path `blocks` comes back
 *      empty, so an extractor reading blocks compares `[]` with `[]`;
 *   2. **edges here carry no `id`** — they are `from`/`to` pairs, so keying
 *      edge identity on `e.id` makes both sides `[undefined, undefined, …]`
 *      or `[]` and every comparison passes while testing nothing.
 *
 * Both are guarded by `expectComparableGraph`, which fails if either side of
 * a comparison came back empty (trap 13: an absence/agreement assertion must
 * first prove it can SEE a presence).
 */
import { describe, it, expect, vi } from 'vitest'

import {
  consumeStreamedDraftTurn,
  nodeIdentities,
  edgeIdentities,
  expectComparableGraph,
} from '../consumeStreamedDraftTurn'
import { StreamAbandonedError, type StageFrame } from '../streamedDraftFrames'

// ---------------------------------------------------------------------------
// Fixtures — the 16-node/33-edge live shape, reduced to 3/2 for legibility.
// GRAPH_READY and COMPLETE agree on identity and DISAGREE on values, which is
// exactly the contract: "identity is stable, values settle".
// ---------------------------------------------------------------------------

const READY_GRAPH = {
  nodes: [
    { id: 'goal_1', kind: 'goal', label: 'Choose a billing system', value: 0 },
    { id: 'opt_build', kind: 'option', label: 'Build in-house', value: 0 },
    { id: 'fac_cost', kind: 'factor', label: 'Cost', value: 0 },
  ],
  edges: [
    { from: 'opt_build', to: 'goal_1', strength: { mean: 0 } },
    { from: 'fac_cost', to: 'opt_build', strength: { mean: 0 } },
  ],
}

/** Same ids, settled numbers — the refinement `graph-data-integrity` applies. */
const TERMINAL_GRAPH = {
  nodes: [
    { id: 'goal_1', kind: 'goal', label: 'Choose a billing system', value: 18 },
    { id: 'opt_build', kind: 'option', label: 'Build in-house', value: 420_000 },
    { id: 'fac_cost', kind: 'factor', label: 'Cost', value: 250_000 },
  ],
  edges: [
    { from: 'opt_build', to: 'goal_1', strength: { mean: 0.62 } },
    { from: 'fac_cost', to: 'opt_build', strength: { mean: -0.31 } },
  ],
}

function terminalPayload(graph: unknown = TERMINAL_GRAPH) {
  return {
    response_version: 2,
    assistant_text: "Here's a first model of your billing decision.",
    blocks: [],
    draft_graph: graph,
    analysis_ready: { status: 'needs_user_input', options: [] },
  }
}

function frames(...list: Array<Partial<StageFrame> & { stage: StageFrame['stage'] }>): StageFrame[] {
  return list.map((f, i) => ({
    seq: i,
    status: f.stage === 'COMPLETE' ? 'complete' : 'in_progress',
    ...f,
  })) as StageFrame[]
}

const HAPPY = () =>
  frames(
    { stage: 'DRAFTING' },
    { stage: 'GRAPH_READY', graph: READY_GRAPH, schema_version: 'v3', elapsed_ms: 35_834 },
    { stage: 'COACHING_READY', coaching_status: 'partial' },
    { stage: 'COMPLETE', status_code: 200, payload: terminalPayload() },
  )

async function* iterate(list: StageFrame[], failAfter?: number): AsyncGenerator<StageFrame> {
  let i = 0
  for (const f of list) {
    if (failAfter !== undefined && i === failAfter) {
      throw new StreamAbandonedError('transport', 'socket hung up')
    }
    yield f
    i++
  }
  if (failAfter !== undefined && i === failAfter) {
    throw new StreamAbandonedError('transport', 'socket hung up')
  }
}

// ---------------------------------------------------------------------------

describe('consumeStreamedDraftTurn — the render-on-arrival contract', () => {
  it('renders the GRAPH_READY graph the moment it arrives, before COMPLETE', async () => {
    const order: string[] = []
    const outcome = await consumeStreamedDraftTurn(
      (async function* () {
        for (const f of HAPPY()) {
          order.push(`frame:${f.stage}`)
          yield f
        }
      })(),
      { onGraphReady: () => order.push('render') },
    )
    expect(outcome.kind).toBe('complete')
    // The render sits BETWEEN the GRAPH_READY frame and the next frame — not
    // after COMPLETE. A consumer that buffered to the end would put 'render'
    // last, and every content assertion would still pass.
    expect(order).toEqual([
      'frame:DRAFTING',
      'frame:GRAPH_READY',
      'render',
      'frame:COACHING_READY',
      'frame:COMPLETE',
    ])
  })

  it('reports the terminal payload and status code for the caller to ingest', async () => {
    const outcome = await consumeStreamedDraftTurn(iterate(HAPPY()), { onGraphReady: () => {} })
    expect(outcome).toMatchObject({ kind: 'complete', statusCode: 200, renderedGraph: READY_GRAPH })
    expect((outcome as { terminalPayload: unknown }).terminalPayload).toEqual(terminalPayload())
  })

  it('fires onDrafting for the opening frame (the 271 ms acknowledgement)', async () => {
    const onDrafting = vi.fn()
    await consumeStreamedDraftTurn(iterate(HAPPY()), { onGraphReady: () => {}, onDrafting })
    expect(onDrafting).toHaveBeenCalledTimes(1)
  })

  it('never renders twice, even if the server repeats GRAPH_READY', async () => {
    const onGraphReady = vi.fn()
    await consumeStreamedDraftTurn(
      iterate(
        frames(
          { stage: 'DRAFTING' },
          { stage: 'GRAPH_READY', graph: READY_GRAPH },
          { stage: 'GRAPH_READY', graph: READY_GRAPH },
          { stage: 'COMPLETE', status_code: 200, payload: terminalPayload() },
        ),
      ),
      { onGraphReady },
    )
    expect(onGraphReady).toHaveBeenCalledTimes(1)
  })
})

describe('CROSS-FRAME IDENTITY — the graph rendered at 36 s IS the graph committed at 61 s', () => {
  it('GRAPH_READY and the COMPLETE payload agree on node and edge identity', async () => {
    const outcome = await consumeStreamedDraftTurn(iterate(HAPPY()), { onGraphReady: () => {} })
    expect(outcome.kind).toBe('complete')
    const rendered = (outcome as { renderedGraph: unknown }).renderedGraph
    const terminal = (terminalPayload() as { draft_graph: unknown }).draft_graph

    // TRAP 13 CONTROL, first: if either extraction is empty the comparisons
    // below are vacuous, so prove both sides carry something.
    expectComparableGraph(rendered, 'GRAPH_READY frame')
    expectComparableGraph(terminal, 'COMPLETE payload draft_graph')

    expect(nodeIdentities(rendered)).toEqual(nodeIdentities(terminal))
    expect(edgeIdentities(rendered)).toEqual(edgeIdentities(terminal))
  })

  it('but the VALUES differ — the frame is in_progress for a reason', () => {
    // If this ever fails, the fixtures have stopped modelling the contract and
    // the identity test above has become a check that two identical objects
    // are identical.
    expect(READY_GRAPH.nodes.map((n) => n.value)).not.toEqual(
      TERMINAL_GRAPH.nodes.map((n) => n.value),
    )
  })

  it('the renderer never shows a node the terminal payload lacks', async () => {
    // A server that drops a node between the frames must be detected, not
    // reconciled silently — the dispatch's explicit requirement.
    const shrunk = {
      nodes: TERMINAL_GRAPH.nodes.filter((n) => n.id !== 'fac_cost'),
      edges: TERMINAL_GRAPH.edges.filter((e) => e.from !== 'fac_cost'),
    }
    const outcome = await consumeStreamedDraftTurn(
      iterate(
        frames(
          { stage: 'DRAFTING' },
          { stage: 'GRAPH_READY', graph: READY_GRAPH },
          { stage: 'COMPLETE', status_code: 200, payload: terminalPayload(shrunk) },
        ),
      ),
      { onGraphReady: () => {} },
    )
    expect(outcome.kind).toBe('complete')
    expect((outcome as { identityDrift: unknown }).identityDrift).toEqual({
      nodesOnlyInPreview: ['fac_cost'],
      nodesOnlyInTerminal: [],
      edgesOnlyInPreview: ['fac_cost->opt_build'],
      edgesOnlyInTerminal: [],
    })
    // And the caller is told to replace, not merge — which is what
    // `applyDraftResult`'s wholesale replacement does at COMPLETE.
    expect((outcome as { replaceRenderedGraph: boolean }).replaceRenderedGraph).toBe(true)
  })

  it('reports no drift when identity holds', async () => {
    const outcome = await consumeStreamedDraftTurn(iterate(HAPPY()), { onGraphReady: () => {} })
    expect((outcome as { identityDrift: unknown }).identityDrift).toBeNull()
  })
})

describe('identity helpers — the two vacuity traps, pinned', () => {
  it('keys edges on the endpoint PAIR, because wire edges carry no id', () => {
    // Keying on `e.id` would yield [undefined, undefined] on both sides and
    // every edge comparison would pass by testing nothing (#751's own bug).
    expect(edgeIdentities(READY_GRAPH)).toEqual(['fac_cost->opt_build', 'opt_build->goal_1'])
    expect(READY_GRAPH.edges.every((e) => !('id' in e))).toBe(true)
  })

  it('sorts identities so wire ordering cannot make an equal pair unequal', () => {
    const reversed = { nodes: [...READY_GRAPH.nodes].reverse(), edges: [...READY_GRAPH.edges].reverse() }
    expect(nodeIdentities(reversed)).toEqual(nodeIdentities(READY_GRAPH))
    expect(edgeIdentities(reversed)).toEqual(edgeIdentities(READY_GRAPH))
  })

  it('expectComparableGraph REFUSES an empty or absent graph', () => {
    expect(() => expectComparableGraph({ nodes: [], edges: [] }, 'x')).toThrow(/no nodes/i)
    expect(() => expectComparableGraph(undefined, 'x')).toThrow(/no nodes/i)
    expect(() => expectComparableGraph({ nodes: [{ id: 'a' }], edges: [] }, 'x')).not.toThrow()
  })
})

describe('the discard rule — a failed turn must not leave a rendered graph standing', () => {
  it('orders the preview DISCARDED when COMPLETE carries status_code >= 400', async () => {
    const outcome = await consumeStreamedDraftTurn(
      iterate(
        frames(
          { stage: 'DRAFTING' },
          { stage: 'GRAPH_READY', graph: READY_GRAPH },
          {
            stage: 'COMPLETE',
            status_code: 422,
            payload: { error: 'INGRESS_CONTRACT_VIOLATION' },
          },
        ),
      ),
      { onGraphReady: () => {} },
    )
    expect(outcome).toMatchObject({ kind: 'complete', statusCode: 422, discardPreview: true })
  })

  it('does NOT discard on a 200', async () => {
    const outcome = await consumeStreamedDraftTurn(iterate(HAPPY()), { onGraphReady: () => {} })
    expect((outcome as { discardPreview: boolean }).discardPreview).toBe(false)
  })
})

describe('abandonment — every failure reports whether a graph is already on screen', () => {
  it('abandons before GRAPH_READY and says nothing was rendered', async () => {
    const outcome = await consumeStreamedDraftTurn(iterate(HAPPY(), 1), { onGraphReady: () => {} })
    expect(outcome).toMatchObject({
      kind: 'abandoned',
      reason: 'transport',
      renderedGraph: null,
    })
  })

  it('abandons AFTER GRAPH_READY and reports the graph it already rendered', async () => {
    const outcome = await consumeStreamedDraftTurn(iterate(HAPPY(), 2), { onGraphReady: () => {} })
    expect(outcome).toMatchObject({ kind: 'abandoned', reason: 'transport' })
    expect((outcome as { renderedGraph: unknown }).renderedGraph).toEqual(READY_GRAPH)
  })

  it('a stream that ends without COMPLETE is abandonment, not success', async () => {
    const outcome = await consumeStreamedDraftTurn(
      iterate(frames({ stage: 'DRAFTING' }, { stage: 'GRAPH_READY', graph: READY_GRAPH })),
      { onGraphReady: () => {} },
    )
    expect(outcome).toMatchObject({ kind: 'abandoned', reason: 'no_terminal_frame' })
  })

  it('a non-StreamAbandonedError throw still abandons rather than escaping', async () => {
    const outcome = await consumeStreamedDraftTurn(
      (async function* () {
        yield* frames({ stage: 'DRAFTING' })
        throw new TypeError('Failed to fetch')
      })(),
      { onGraphReady: () => {} },
    )
    expect(outcome).toMatchObject({ kind: 'abandoned', reason: 'transport' })
  })

  it('a render callback that throws does not lose the turn', async () => {
    // The graph render touches the canvas store; if it throws we still want the
    // terminal payload ingested rather than the whole turn lost.
    const outcome = await consumeStreamedDraftTurn(iterate(HAPPY()), {
      onGraphReady: () => {
        throw new Error('store blew up')
      },
    })
    expect(outcome.kind).toBe('complete')
    expect((outcome as { renderedGraph: unknown }).renderedGraph).toBeNull()
  })
})
