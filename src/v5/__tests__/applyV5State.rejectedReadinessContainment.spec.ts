/**
 * P0 #1204 / #1222 — A READINESS THE NORMALISER REJECTED LEAVES THE REPORT GATE
 * DISARMED, AND THE FOREIGN REPORT HYDRATES ANYWAY.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS SPEC PINS
 * ═══════════════════════════════════════════════════════════════════════════
 * `applyV5State` step 4 computes the turn's containment verdict ONCE and step 5
 * consumes it. But the verdict was assigned ONLY inside the `if (normalised)`
 * arm. When `analysis_ready` is PRESENT and `normaliseV5AnalysisReady` REJECTS
 * it, step 4 takes the `else` arm: it CLEARS the readiness and leaves the
 * verdict `null`. Step 5 then reads `null`, treats the turn as un-refused, and
 * hydrates whatever `analysis_result` the response carried.
 *
 * Measured at `06f0fec` on the hiring canvas, with a pricing readiness whose
 * `options` array was empty: `resultsComplete` called once, `applied` carrying
 * `analysis_result:results_hydrated`, and `report.leading_option_id` equal to
 * the PRICING model's option. That is the founder's harm, reached through a
 * different door than the one #1204 closed.
 *
 * ⚠ THE ASYMMETRY IS THE AGGRAVATING FACT, not a detail: this branch CLEARS the
 * readiness slice, so the readiness and the refusal notice stay honest while the
 * Analysis tab paints the foreign model. That is precisely the split this PR
 * exists to end.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS IS ONE BRANCH AND NOT FIVE — THE CLASS, DERIVED
 * ═══════════════════════════════════════════════════════════════════════════
 * `normaliseV5AnalysisReady` rejects at FIVE sites. Four are function-level
 * `return undefined`; one (`:264`) is a per-option `return null` inside the
 * `.map()` that drops the entry and reaches the same exit via the all-dropped
 * check. Derived, not assumed: the normaliser has EXACTLY ONE call site in the
 * repo, so every rejection cause resolves to the single `undefined` the caller
 * tests, and therefore to the single `else` arm. Closing that arm closes the
 * whole class.
 *
 * The enumeration is nonetheless exercised CAUSE BY CAUSE below, because a
 * structural argument that all five land in one place is exactly the kind of
 * claim this estate has been wrong about before. Note in particular that the
 * reviewer's reproduction (`options: []` with a real goal id) and CEE's own
 * refusal carrier (`goal_node_id: ""` AND `options: []`) trip DIFFERENT sites.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THE HAZARD THAT MUST NOT BE TRADED FOR THE FIX: OVER-SUPPRESSION
 * ═══════════════════════════════════════════════════════════════════════════
 * Refusing a report costs the user the analysis they waited a minute for, which
 * is the expensive direction. So the new branch asks NO new question: it reuses
 * the SAME two must-apply exclusions the identity path uses — both of which are
 * identity-INDEPENDENT and so survive the loss of the payload's identity — and
 * refuses only when neither fires. Every DECLINE below therefore carries its
 * opposite-direction twin.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

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
  resultsComplete: ReturnType<typeof vi.fn>
  clearAnalysisFreshnessDirty: ReturnType<typeof vi.fn>
  noteRunCompletedWithoutVerdict: ReturnType<typeof vi.fn>
} {
  const setCeeAnalysisReady = vi.fn()
  const resultsComplete = vi.fn()
  const clearAnalysisFreshnessDirty = vi.fn()
  const noteRunCompletedWithoutVerdict = vi.fn()
  return {
    store: {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta: vi.fn(),
      setCeeAnalysisReady,
      backfillGoalThreshold: vi.fn(),
      setAnalysisFreshness: vi.fn(),
      resultsComplete,
      clearAnalysisFreshnessDirty,
      noteRunCompletedWithoutVerdict,
      currentResultsHash: null,
      nodes,
      edges: [],
    },
    setCeeAnalysisReady,
    resultsComplete,
    clearAnalysisFreshnessDirty,
    noteRunCompletedWithoutVerdict,
  }
}

/** The PRICING model's analysis — the foreign report that must not hydrate. */
const PRICING_ANALYSIS_BLOCK = {
  type: 'analysis_result' as const,
  summary: 'Raising the price leads',
  leading_option_id: PRICING_OPTION_A,
  win_probabilities: { [PRICING_OPTION_A]: 0.71, [PRICING_OPTION_B]: 0.29 },
}

/** The HIRING model's own analysis — the one the user is entitled to see. */
const HIRING_ANALYSIS_BLOCK = {
  type: 'analysis_result' as const,
  summary: 'Hiring two juniors leads',
  leading_option_id: HIRING_OPTION_B,
  win_probabilities: { [HIRING_OPTION_A]: 0.42, [HIRING_OPTION_B]: 0.58 },
}

/** A well-formed readiness, for the regression twin. */
function wellFormedReadiness(goalNodeId: string, optionIds: string[]): Record<string, unknown> {
  return {
    status: 'ready',
    goal_node_id: goalNodeId,
    options: optionIds.map((id) => ({ id, status: 'ready', interventions: {} })),
    freshness: 'fresh',
    computed_at: '2026-09-05T10:00:00.000Z',
  }
}

/**
 * The `leading_option_id` the report writer was actually handed, or undefined
 * when it was never called. Binds by IDENTITY — the foreign option's id — never
 * by a value predicate another object could satisfy.
 */
function hydratedLeadingOptionId(
  resultsComplete: ReturnType<typeof vi.fn>,
): string | undefined {
  const calls = resultsComplete.mock.calls
  if (calls.length === 0) return undefined
  const arg = calls[0][0] as { report?: { leading_option_id?: string } }
  return arg?.report?.leading_option_id
}

// ═══════════════════════════════════════════════════════════════════════════
// THE FIVE REJECTION CAUSES — every one must refuse the foreign report.
// Each names the normaliser site it trips.
// ═══════════════════════════════════════════════════════════════════════════

describe('P0 #1222 — a REJECTED readiness must still refuse the foreign report', () => {
  const rejectedPayloads: Array<[string, unknown]> = [
    // `:251` AND `:252` together — CEE's own `blockedIdentityCarrier()`, the
    // shape emitted on refusal turns: both gate-disarming fields at once.
    [
      "CEE's blocked identity carrier { options: [], goal_node_id: '' } (:251)",
      { status: 'blocked', goal_node_id: '', options: [] },
    ],
    // `:251` alone — empty goal id, options otherwise well-formed.
    [
      'an empty goal_node_id with well-formed options (:251)',
      {
        status: 'blocked',
        goal_node_id: '',
        options: [{ id: PRICING_OPTION_A, status: 'blocked', interventions: {} }],
      },
    ],
    // `:251` — goal_node_id absent entirely (not a string).
    [
      'an absent goal_node_id (:251)',
      { status: 'blocked', options: [{ id: PRICING_OPTION_A }] },
    ],
    // `:252` — the reviewer's exact reproduction: a REAL foreign goal id, empty options.
    [
      'the reviewer reproduction: a foreign goal id with an empty options array (:252)',
      { status: 'blocked', goal_node_id: PRICING_GOAL, options: [] },
    ],
    // `:252` — options present but not an array.
    [
      'a non-array options field (:252)',
      { status: 'blocked', goal_node_id: PRICING_GOAL, options: {} },
    ],
    // `:264` → `:278` — options present, every entry dropped for want of an id.
    [
      'options whose every entry lacks an id, so all are dropped (:264 → :278)',
      {
        status: 'blocked',
        goal_node_id: PRICING_GOAL,
        options: [{ status: 'blocked' }, { interventions: {} }],
      },
    ],
    // `:247` — present but not an object.
    ['a non-object analysis_ready (:247)', 'blocked'],
    // `:247` — present but null. Reaches the branch because the outer guard
    // tests `!== undefined`, so an explicit null enters and is then rejected.
    ['an explicitly null analysis_ready (:247)', null],
  ]

  it.each(rejectedPayloads)(
    'REFUSES the foreign report when the readiness is rejected for %s',
    (_label, analysisReady) => {
      const { store, resultsComplete } = makeStore(HIRING_CANVAS)

      const result = applyV5State(
        baseResponse({
          analysis_ready: analysisReady,
          blocks: [PRICING_ANALYSIS_BLOCK],
        }),
        store,
      )

      // Bound by IDENTITY: the PRICING model's leading option must never reach
      // the report writer while the user is on the hiring canvas.
      expect(hydratedLeadingOptionId(resultsComplete)).not.toBe(PRICING_OPTION_A)
      expect(resultsComplete).not.toHaveBeenCalled()
      expect(result.applied).not.toContain('analysis_result:results_hydrated')
      expect(result.deferred.map((d) => d.reason)).toContain(
        'analysis_result_not_about_current_graph',
      )
    },
  )

  it('still CLEARS the readiness slice in this branch — the fix adds a refusal, it does not remove the clear', () => {
    // The pre-existing behaviour of this arm is load-bearing: a malformed
    // readiness must not leave a prior turn's value to mislead the panel. The
    // new refusal rides alongside it rather than replacing it.
    const { store, setCeeAnalysisReady, resultsComplete } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: { status: 'blocked', goal_node_id: '', options: [] },
        blocks: [PRICING_ANALYSIS_BLOCK],
      }),
      store,
    )

    expect(setCeeAnalysisReady).toHaveBeenCalledWith(null)
    expect(resultsComplete).not.toHaveBeenCalled()
    expect(result.deferred.map((d) => d.reason)).toContain('analysis_ready_invalid_shape')
  })

  it('REFUSES without CLEARING the report, and does not move the freshness overlay', () => {
    // Same rule as the identity gate: the report the user already holds passed
    // this check when it was written, so clearing would destroy a correct
    // analysis in order to reject a foreign one.
    const { store, resultsComplete, clearAnalysisFreshnessDirty, noteRunCompletedWithoutVerdict } =
      makeStore(HIRING_CANVAS)

    applyV5State(
      baseResponse({
        analysis_ready: { status: 'blocked', goal_node_id: '', options: [] },
        blocks: [PRICING_ANALYSIS_BLOCK],
      }),
      store,
    )

    expect(resultsComplete).not.toHaveBeenCalled()
    expect(clearAnalysisFreshnessDirty).not.toHaveBeenCalled()
    expect(noteRunCompletedWithoutVerdict).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE OPPOSITE-DIRECTION TWINS — over-suppression is the expensive direction.
// A rejected readiness must NOT cost the user a legitimate report.
// ═══════════════════════════════════════════════════════════════════════════

describe('P0 #1222 — a rejected readiness must not suppress a report the user is entitled to', () => {
  it('APPLIES on an EMPTY canvas — the nodes arrive AFTER this step (exclusion 1)', () => {
    // Identity-independent exclusion, so it survives the loss of the payload's
    // identity: an empty canvas is the normal state of the turn that DELIVERS
    // the model, and is not a model that can be contradicted.
    const { store, resultsComplete } = makeStore([])

    const result = applyV5State(
      baseResponse({
        analysis_ready: { status: 'blocked', goal_node_id: '', options: [] },
        blocks: [HIRING_ANALYSIS_BLOCK],
      }),
      store,
    )

    expect(resultsComplete).toHaveBeenCalledTimes(1)
    expect(hydratedLeadingOptionId(resultsComplete)).toBe(HIRING_OPTION_B)
    expect(result.deferred.map((d) => d.reason)).not.toContain(
      'analysis_result_not_about_current_graph',
    )
  })

  it('APPLIES when the turn CARRIES the graph that supplies the ids (exclusion 2)', () => {
    // Also identity-independent: a response bearing a `draft_graph` with nodes
    // reconciles the canvas to exactly those ids, so the PRE-turn node set is
    // the wrong operand.
    const { store, resultsComplete } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: { status: 'blocked', goal_node_id: '', options: [] },
        draft_graph: {
          nodes: [{ id: HIRING_GOAL }, { id: HIRING_OPTION_A }, { id: HIRING_OPTION_B }],
          edges: [],
        },
        blocks: [HIRING_ANALYSIS_BLOCK],
      }),
      store,
    )

    expect(resultsComplete).toHaveBeenCalledTimes(1)
    expect(hydratedLeadingOptionId(resultsComplete)).toBe(HIRING_OPTION_B)
    expect(result.deferred.map((d) => d.reason)).not.toContain(
      'analysis_result_not_about_current_graph',
    )
  })

  it('APPLIES the hiring report with a well-formed CONTAINED hiring readiness — the primary path is untouched', () => {
    const { store, setCeeAnalysisReady, resultsComplete } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({
        analysis_ready: wellFormedReadiness(HIRING_GOAL, [HIRING_OPTION_A, HIRING_OPTION_B]),
        blocks: [HIRING_ANALYSIS_BLOCK],
      }),
      store,
    )

    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    expect(resultsComplete).toHaveBeenCalledTimes(1)
    expect(hydratedLeadingOptionId(resultsComplete)).toBe(HIRING_OPTION_B)
    expect(result.applied).toContain('analysis_result:results_hydrated')
  })

  it('leaves the NO-analysis_ready residual exactly where it was — this fix does not move it', () => {
    // The response carries no `analysis_ready` key at all, so the rejection arm
    // is never entered and the verdict stays null. Pinned here so that if this
    // ever changes, it changes deliberately rather than as a side effect.
    const { store, resultsComplete } = makeStore(HIRING_CANVAS)

    const result = applyV5State(
      baseResponse({ blocks: [PRICING_ANALYSIS_BLOCK] }),
      store,
    )

    expect(resultsComplete).toHaveBeenCalledTimes(1)
    expect(result.deferred.map((d) => d.reason)).not.toContain(
      'analysis_result_not_about_current_graph',
    )
  })
})
