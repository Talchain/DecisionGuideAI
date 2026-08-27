/**
 * M3 — "a model arrived" and "we drew a model" are DIFFERENT FACTS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT (deployed build, fresh isolated context, fresh signup,
 * fresh scenario, CEE `d7dcdd0`, 2026-08-26)
 * ═══════════════════════════════════════════════════════════════════════════
 *   STREAM  : 15 chunks · 110,343 bytes · ENDED=TRUE · lastMs=71,532
 *   STAGES  : DRAFTING → GRAPH_READY → COACHING_READY → COMPLETE  (all four)
 *   RENDERED: nodes = 0
 *   UI SAYS : "Olumi did not return a model for this decision."
 * Direct HTTP to the same server completed 14/14 at 47.9–64.0 s, so the server
 * is not the cause. The client blamed it anyway.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE OLD SHAPE COULD NOT TELL THE TRUTH
 * ═══════════════════════════════════════════════════════════════════════════
 * `renderedGraph` was the only thing this consumer reported about the graph,
 * and it is null in TWO unrelated situations:
 *
 *   (a) no GRAPH_READY frame carrying a graph ever arrived;
 *   (b) one DID arrive and the render callback THREW.
 *
 * `consumeStreamedDraftTurn` catches that throw deliberately — a canvas-side
 * failure must not cost the user the whole turn. But the catch also erased the
 * only evidence that the server had delivered, so every consumer downstream
 * saw case (b) as case (a). `graphFrameArrived` separates them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ "ARRIVED" MEANS CONSUMABLE, NOT "BYTES ON THE WIRE"
 * ═══════════════════════════════════════════════════════════════════════════
 * A byte count or a substring match would answer TRUE for a malformed graph,
 * which would fabricate a delivery in the opposite direction — a worse defect
 * than the one being fixed, because it would let the product claim Olumi
 * returned a model on the strength of rubbish. So the predicate is the
 * module's OWN canonical `nodeIdentities`, which drops empty and `'undefined'`
 * ids, and the malformed / empty / absent arms below are first-class tests
 * rather than an afterthought: without them these tests could not tell "we
 * report real graphs" from "we report anything at all".
 *
 * Every arm asserts its own precondition (trap 13b — a discriminator must pin
 * the fixture it depends on, or it can silently stop discriminating).
 */
import { describe, it, expect, vi } from 'vitest'

import {
  consumeStreamedDraftTurn,
  nodeIdentities,
} from '../consumeStreamedDraftTurn'
import type { StageFrame } from '../streamedDraftFrames'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Structurally valid, real node ids — what the live GRAPH_READY frame carries. */
const CONSUMABLE_GRAPH = {
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

/**
 * An object `parseStageFrame` WOULD admit (non-null, non-array) but which
 * carries no usable node identity. This is the "rubbish on the wire" arm.
 */
const MALFORMED_GRAPH = { nodes: [{}, { id: '' }, 'not-a-node'], edges: 'nope' }

/** Well-formed and genuinely empty — a real answer of "no model". */
const EMPTY_GRAPH = { nodes: [], edges: [] }

function terminalPayload(graph: unknown = CONSUMABLE_GRAPH) {
  return { response_version: 2, assistant_text: 'ok', blocks: [], draft_graph: graph }
}

/** The full live four-stage sequence. `graph` is what GRAPH_READY carries. */
function fourStageFrames(graph: unknown): StageFrame[] {
  return [
    { stage: 'DRAFTING', seq: 0, status: 'in_progress' },
    { stage: 'GRAPH_READY', seq: 2, status: 'in_progress', graph: graph as never },
    { stage: 'COACHING_READY', seq: 3, status: 'in_progress', coaching_status: 'ready' },
    {
      stage: 'COMPLETE',
      seq: 4,
      status: 'complete',
      status_code: 200,
      payload: terminalPayload(),
    },
  ]
}

async function* iterate(frames: StageFrame[]): AsyncGenerator<StageFrame> {
  for (const f of frames) yield f
}

/** The stage names actually seen, so each test can prove its own precondition. */
function stagesOf(frames: StageFrame[]): string[] {
  return frames.map((f) => f.stage)
}

// ---------------------------------------------------------------------------

describe('consumeStreamedDraftTurn — M3: a delivered model that could not be drawn', () => {
  /**
   * ⭐ THE M3 CONDITION, BOUND EXACTLY.
   *
   * All four stages arrive · GRAPH_READY carries a CONSUMABLE graph · the
   * client renders ZERO. A test that merely checked "an error string is shown"
   * cannot see this defect, because the string was shown correctly — for a case
   * that did not occur.
   */
  it('reports graphFrameArrived=TRUE when all four stages arrive, the graph is consumable, and the render fails', async () => {
    const frames = fourStageFrames(CONSUMABLE_GRAPH)

    // PRECONDITION 1 — all four stages really are in this stream.
    expect(stagesOf(frames)).toEqual([
      'DRAFTING',
      'GRAPH_READY',
      'COACHING_READY',
      'COMPLETE',
    ])
    // PRECONDITION 2 — the graph really is consumable. Without this the test
    // could pass against an empty fixture and prove nothing (trap 13).
    expect(nodeIdentities(CONSUMABLE_GRAPH)).toEqual(['fac_cost', 'goal_1', 'opt_build'])

    // The client cannot use it — the scenario guard, or any canvas-side throw.
    const onGraphReady = vi.fn(() => {
      throw new Error('scenario changed during the streamed draft')
    })

    const outcome = await consumeStreamedDraftTurn(iterate(frames), { onGraphReady })

    // PRECONDITION 3 — the render was genuinely attempted and genuinely failed.
    expect(onGraphReady).toHaveBeenCalledTimes(1)
    expect(outcome.kind).toBe('complete')
    expect(outcome.renderedGraph).toBeNull() // "rendered node count is zero"

    // THE CLAIM: the server delivered. Anything downstream that says otherwise
    // is stating a falsehood about the server.
    expect(outcome.graphFrameArrived).toBe(true)
  })

  it('reports graphFrameArrived=TRUE on the healthy path too — the positive control', async () => {
    const onGraphReady = vi.fn()
    const outcome = await consumeStreamedDraftTurn(
      iterate(fourStageFrames(CONSUMABLE_GRAPH)),
      { onGraphReady },
    )

    expect(onGraphReady).toHaveBeenCalledTimes(1)
    expect(outcome.renderedGraph).not.toBeNull()
    expect(outcome.graphFrameArrived).toBe(true)
  })
})

describe('consumeStreamedDraftTurn — what does NOT count as a delivery', () => {
  /**
   * ⭐ THE CONTRAST ARM THE FOUNDER'S RULING REQUIRES. Without it these tests
   * cannot distinguish "we report valid graphs" from "we report anything,
   * including rubbish" — and the second would be a worse defect.
   */
  it('a MALFORMED graph is not a delivery, even though the frame parser admits it', async () => {
    // PRECONDITION — the parser WOULD keep this (object, not null, not array),
    // so the arm is exercising the real gap and not a straw man.
    expect(typeof MALFORMED_GRAPH).toBe('object')
    expect(Array.isArray(MALFORMED_GRAPH)).toBe(false)
    // ...and it yields no usable identity.
    expect(nodeIdentities(MALFORMED_GRAPH)).toEqual([])

    const outcome = await consumeStreamedDraftTurn(
      iterate(fourStageFrames(MALFORMED_GRAPH)),
      { onGraphReady: vi.fn() },
    )

    expect(outcome.kind).toBe('complete')
    expect(outcome.graphFrameArrived).toBe(false)
  })

  it('a well-formed but EMPTY graph is not a delivery', async () => {
    expect(nodeIdentities(EMPTY_GRAPH)).toEqual([])

    const outcome = await consumeStreamedDraftTurn(
      iterate(fourStageFrames(EMPTY_GRAPH)),
      { onGraphReady: vi.fn() },
    )

    expect(outcome.graphFrameArrived).toBe(false)
  })

  it('a stream with NO GRAPH_READY frame is not a delivery', async () => {
    const frames: StageFrame[] = [
      { stage: 'DRAFTING', seq: 0, status: 'in_progress' },
      {
        stage: 'COMPLETE',
        seq: 4,
        status: 'complete',
        status_code: 200,
        payload: terminalPayload(null),
      },
    ]
    expect(stagesOf(frames)).not.toContain('GRAPH_READY')

    const onGraphReady = vi.fn()
    const outcome = await consumeStreamedDraftTurn(iterate(frames), { onGraphReady })

    expect(onGraphReady).not.toHaveBeenCalled()
    expect(outcome.graphFrameArrived).toBe(false)
  })
})

describe('consumeStreamedDraftTurn — the delivery fact survives every exit', () => {
  /**
   * M1/M2 are cut streams. They are a SEPARATE lane's question, but the
   * delivery fact must still be reported on those exits — otherwise the
   * distinction would be available only on the happy path, which is precisely
   * the path that does not need it.
   */
  it('reports it on an abandoned stream that ended without a terminal frame', async () => {
    const frames: StageFrame[] = [
      { stage: 'DRAFTING', seq: 0, status: 'in_progress' },
      {
        stage: 'GRAPH_READY',
        seq: 2,
        status: 'in_progress',
        graph: CONSUMABLE_GRAPH as never,
      },
    ]
    expect(stagesOf(frames)).not.toContain('COMPLETE')

    const outcome = await consumeStreamedDraftTurn(iterate(frames), {
      onGraphReady: vi.fn(() => {
        throw new Error('canvas-side failure')
      }),
    })

    expect(outcome.kind).toBe('abandoned')
    expect(outcome.renderedGraph).toBeNull()
    expect(outcome.graphFrameArrived).toBe(true)
  })
})
