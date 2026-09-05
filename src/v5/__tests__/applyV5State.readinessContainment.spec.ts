/**
 * P0 #1204 — the readiness write must be ABOUT THE CANVAS IT IS PAINTED ONTO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 * The Analysis tab presented an analysis of a DIFFERENT model. Reproduced by
 * the founder and independently by Core; the session pair was identified by
 * verbatim label match (`53993ecf` pricing / `eda3c12b` hiring). Both records
 * are internally consistent SERVER-side — CEE honestly returns readiness for
 * the scenario id it was given. The divergence is client-side: `applyV5State`
 * step 4 wrote `ceeAnalysisReady` after SHAPE validation only, so a payload
 * naming option nodes that do not exist on the mounted canvas was painted onto
 * it regardless.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A CONTAINMENT CHECK AND *NOT* A SECOND SCENARIO FENCE
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ THE SCENARIO FENCE ALREADY EXISTS AND ALREADY DOMINATES THIS CALL.
 * `responseBelongsToDispatchingScenario` (`scenarioResponseFence.ts`) is called
 * at five sites; the `terminal_response` site sits in the SAME lexical block as
 * the sole production `applyV5State(` call and `return`s before it, with ZERO
 * awaits between them. `scenarioResponseFence.spec.ts` pins BOTH facts — five
 * call sites, and zero raw re-derivations of the comparison anywhere in the
 * turn path. A sixth comparison added here would be the drift that module was
 * written to end.
 *
 * So this spec pins the question the fence does NOT answer. They are two
 * different questions and must be named apart (CLAUDE.md trap 21):
 *
 *   fence:       "is this response's scenario the scenario id now mounted?"
 *   containment: "do the option nodes this readiness NAMES exist on the canvas
 *                 I am about to paint it onto?"
 *
 * Containment is strictly stronger for THIS harm because it does not depend on
 * scenario-id bookkeeping being correct: if the mounted node set is swapped
 * while `currentScenarioId` still agrees, the fence passes and only containment
 * can refuse.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THE HAZARD THAT MUST NOT BE TRADED FOR THE FIX: OVER-SUPPRESSION
 * ═══════════════════════════════════════════════════════════════════════════
 * This is a suppression gate on the PRIMARY path. Silencing a correct analysis
 * is a WORSE defect than showing a foreign one, because the user loses work.
 * Every case below therefore carries its opposite-direction twin, and the two
 * must-apply twins below are derived from the real call order, not imagined:
 *
 *   · `applyDraftResult` — which INSTALLS the draft nodes — runs at
 *     `useConversation.ts:4824` (inline) and `:4925` (DB re-fetch fallback),
 *     BOTH *after* the `applyV5State(` call at `:4665`. `reconcileAppliedGraph`
 *     (`:4861`) likewise. So on a turn that DELIVERS a model, the nodes are not
 *     on the canvas yet when this step runs, and a blanket containment check
 *     would suppress exactly the readiness that turn exists to provide.
 *   · The DB re-fetch leg fires on `!inlineGraph && stage:analyse &&
 *     canvasIsEmpty` and installs nodes ASYNCHRONOUSLY — so an EMPTY canvas is
 *     never evidence that a readiness is foreign.
 *
 * Hence the gate: containment is asked ONLY when there is a mounted model to
 * contradict (`nodes.length > 0`) AND this turn is not itself delivering one
 * (`draft_graph` carries no nodes). Both exclusions err toward APPLYING, which
 * is the safe direction.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

// ---------------------------------------------------------------------------
// The two real models from the reproduction, reduced to their node identities.
// ---------------------------------------------------------------------------

const HIRING_GOAL = 'goal-hiring-eda3c12b'
const HIRING_OPTION_A = 'opt-hire-senior-eda3c12b'
const HIRING_OPTION_B = 'opt-hire-two-juniors-eda3c12b'

const PRICING_GOAL = 'goal-pricing-53993ecf'
const PRICING_OPTION_A = 'opt-raise-price-53993ecf'
const PRICING_OPTION_B = 'opt-hold-price-53993ecf'

function node(id: string): Node {
  return { id, position: { x: 0, y: 0 }, data: {} } as Node
}

/** The canvas the user is looking at: the hiring model. */
const HIRING_CANVAS: Node[] = [
  node(HIRING_GOAL),
  node(HIRING_OPTION_A),
  node(HIRING_OPTION_B),
]

function readiness(goalNodeId: string, optionIds: string[]): Record<string, unknown> {
  return {
    status: 'ready',
    goal_node_id: goalNodeId,
    options: optionIds.map((id) => ({ id, status: 'ready', interventions: {} })),
    freshness: 'fresh',
    computed_at: '2026-09-05T10:00:00.000Z',
  }
}

function baseResponse(overrides: Record<string, unknown> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    ...overrides,
  } as unknown as OlumiResponse
}

function makeStore(nodes: Node[]): {
  store: V5ApplicatorStore
  setCeeAnalysisReady: ReturnType<typeof vi.fn>
  backfillGoalThreshold: ReturnType<typeof vi.fn>
} {
  const setCeeAnalysisReady = vi.fn()
  const backfillGoalThreshold = vi.fn()
  return {
    store: {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta: vi.fn(),
      setCeeAnalysisReady,
      backfillGoalThreshold,
      setAnalysisFreshness: vi.fn(),
      nodes,
      edges: [],
    },
    setCeeAnalysisReady,
    backfillGoalThreshold,
  }
}

/** The payload actually handed to the store, or undefined when none was. */
function writtenPayload(
  setCeeAnalysisReady: ReturnType<typeof vi.fn>,
): Record<string, unknown> | null | undefined {
  const setCalls = setCeeAnalysisReady.mock.calls
  if (setCalls.length === 0) return undefined
  return setCalls[0][0] as Record<string, unknown> | null
}

// ═══════════════════════════════════════════════════════════════════════════
// DECLINE — the defect itself
// ═══════════════════════════════════════════════════════════════════════════

describe('P0 #1204 — foreign readiness must not be painted onto a mounted model', () => {
  it('DECLINES a readiness whose option ids are DISJOINT from the mounted canvas', () => {
    const { store, setCeeAnalysisReady, backfillGoalThreshold } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: readiness(PRICING_GOAL, [PRICING_OPTION_A, PRICING_OPTION_B]),
      }),
      store,
    )

    // The user's hiring readiness must survive: refuse the write, do not clear.
    expect(setCeeAnalysisReady).not.toHaveBeenCalled()
    expect(backfillGoalThreshold).not.toHaveBeenCalled()
    expect(result.applied).not.toContain('analysis_ready:set')
    expect(result.deferred.map((d) => d.reason)).toContain(
      'analysis_ready_not_about_current_graph',
    )
  })

  it('DECLINES when the goal node belongs to another model even if an option id collides', () => {
    // Same element ids may legitimately exist in two scenarios — the fence's own
    // stated reason for existing. A single colliding option must not buy entry.
    const { store, setCeeAnalysisReady } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({ analysis_ready: readiness(PRICING_GOAL, [HIRING_OPTION_A]) }),
      store,
    )

    expect(setCeeAnalysisReady).not.toHaveBeenCalled()
    expect(result.deferred.map((d) => d.reason)).toContain(
      'analysis_ready_not_about_current_graph',
    )
  })

  it('DECLINES a PARTIALLY contained readiness (deliberate: fail closed, same as every restore path)', () => {
    // Deliberate and stated: `validateCeeAnalysisReady` fail-closes on the FIRST
    // missing option, and it is the same predicate `loadScenario`,
    // `RecoveryBanner`, `ReactFlowGraph` and the autosave/crash restores already
    // use. Admitting a partial here would make the live turn leg the ONE reader
    // that answers this question differently — which is the drift the reuse
    // exists to prevent.
    const { store, setCeeAnalysisReady } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: readiness(HIRING_GOAL, [HIRING_OPTION_A, PRICING_OPTION_B]),
      }),
      store,
    )

    expect(setCeeAnalysisReady).not.toHaveBeenCalled()
    expect(result.deferred.map((d) => d.reason)).toContain(
      'analysis_ready_not_about_current_graph',
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// APPLY — the opposite-direction twins. Over-suppression is the worse defect.
// ═══════════════════════════════════════════════════════════════════════════

describe('P0 #1204 — a legitimate readiness must still apply, byte-identically', () => {
  it('APPLIES a same-canvas CONTAINED readiness, with the payload unchanged', () => {
    const { store, setCeeAnalysisReady, backfillGoalThreshold } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: readiness(HIRING_GOAL, [HIRING_OPTION_A, HIRING_OPTION_B]),
      }),
      store,
    )

    expect(result.applied).toContain('analysis_ready:set')
    expect(backfillGoalThreshold).toHaveBeenCalledTimes(1)

    const payload = writtenPayload(setCeeAnalysisReady)
    expect(payload).toBeTruthy()
    expect(payload?.goal_node_id).toBe(HIRING_GOAL)
    expect((payload?.options as Array<{ id: string }>).map((o) => o.id)).toEqual([
      HIRING_OPTION_A,
      HIRING_OPTION_B,
    ])
    // Byte-identical on the fields the gate could plausibly have touched.
    expect(payload?.status).toBe('ready')
    expect(payload?.freshness).toBe('fresh')
    expect(payload?.computed_at).toBe('2026-09-05T10:00:00.000Z')
    expect(result.deferred.map((d) => d.reason)).not.toContain(
      'analysis_ready_not_about_current_graph',
    )
  })

  it('APPLIES on an EMPTY canvas — the nodes arrive AFTER this step (inline install / DB re-fetch)', () => {
    // `applyDraftResult` runs at useConversation.ts:4824 and :4925, both AFTER
    // the applyV5State call at :4665. An empty canvas is not evidence that a
    // readiness is foreign — it is the normal state of the turn that delivers
    // the model. Suppressing here would break the first-draft journey outright.
    const { store, setCeeAnalysisReady } = makeStore([])

    const result = applyV5State(
      baseResponse({
        analysis_ready: readiness(PRICING_GOAL, [PRICING_OPTION_A, PRICING_OPTION_B]),
      }),
      store,
    )

    expect(result.applied).toContain('analysis_ready:set')
    expect(writtenPayload(setCeeAnalysisReady)).toBeTruthy()
  })

  it('APPLIES when the turn CARRIES the graph that supplies the ids (re-draft over a populated canvas)', () => {
    // A turn carrying a draft_graph reconciles the canvas to it — via
    // applyDraftResult (empty canvas) or reconcileAppliedGraph (:4861,
    // populated). Either way the ids this readiness names are the ones the
    // canvas is about to hold, so the pre-turn node set is the wrong operand.
    const { store, setCeeAnalysisReady } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: readiness(PRICING_GOAL, [PRICING_OPTION_A, PRICING_OPTION_B]),
        draft_graph: {
          nodes: [
            { id: PRICING_GOAL, type: 'goal', data: {} },
            { id: PRICING_OPTION_A, type: 'option', data: {} },
            { id: PRICING_OPTION_B, type: 'option', data: {} },
          ],
          edges: [],
        },
      }),
      store,
    )

    expect(result.applied).toContain('analysis_ready:set')
    expect(writtenPayload(setCeeAnalysisReady)).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// UNCHANGED — the arms this gate must not touch
// ═══════════════════════════════════════════════════════════════════════════

describe('P0 #1204 — the pre-existing arms are untouched', () => {
  it('an EMPTY options array still clears via the normaliser, not via containment', () => {
    const { store, setCeeAnalysisReady } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: { status: 'ready', goal_node_id: HIRING_GOAL, options: [] },
      }),
      store,
    )

    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(result.deferred.map((d) => d.reason)).toContain('analysis_ready_invalid_shape')
    expect(result.deferred.map((d) => d.reason)).not.toContain(
      'analysis_ready_not_about_current_graph',
    )
  })

  it('an ABSENT analysis_ready on a conversational turn still writes nothing', () => {
    const { store, setCeeAnalysisReady } = makeStore(HIRING_CANVAS)

    const result = applyV5State(baseResponse({ stage_indicator: 'frame' }), store)

    expect(setCeeAnalysisReady).not.toHaveBeenCalled()
    expect(result.deferred.map((d) => d.reason)).not.toContain(
      'analysis_ready_not_about_current_graph',
    )
  })

  it('an ARM-B blocked refusal (identity-preserving, CONTAINED) still SETS — containment must not swallow the refusal carrier', () => {
    // `validateCeeAnalysisReady` also rejects `status: 'blocked'` as
    // `blocked_refusal` — a question about RESTORING a refusal, not about
    // containment. applyV5State deliberately ACCEPTS the identity-preserving
    // refusal carrier (CEE #1023) so the refusal notice can render. Acting on
    // the whole verdict rather than the containment reasons would silently
    // reverse that.
    const { store, setCeeAnalysisReady } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: {
          ...readiness(HIRING_GOAL, [HIRING_OPTION_A, HIRING_OPTION_B]),
          status: 'blocked',
          blocked_reason: 'insufficient_model',
        },
      }),
      store,
    )

    expect(result.applied).toContain('analysis_ready:set')
    expect(writtenPayload(setCeeAnalysisReady)).toBeTruthy()
  })
})
