/**
 * ⭐⭐⭐ THE CHIP PROMISES A ROUTE. THIS FILE IS WHERE THE ROUTE ANSWERS.
 *
 * ⚠⚠ THE DEFECT THIS CLOSES WAS INTRODUCED BY ITS OWN FIX. #1172 changed the
 * goal card's chip from `No target set` — a passive falsehood — to
 * `Target not captured — add one`. "add one" is a PROMISE, and in a reachable
 * state it led nowhere:
 *
 *   chip   Target not captured — add one          (fires on the NODE)
 *   panel  Threshold set · Success means reaching ≥ 0.8      (reads the STORE)
 *          …and no editor.
 *
 * The user is told to add a target, then told one already exists, and given
 * nothing to press. `store.ts` records this exact state having shipped
 * ("Inspector v2 rendered ≥ 0.8 £"). A passive falsehood became an ACTIVE FALSE
 * PROMISE — a regression in kind, even though the new sentence is more honest
 * about the data.
 *
 * ── WHY THE TWO SURFACES DIVERGE, AND WHY ALIGNING THEM IS THE WRONG FIX ───
 * `setCeeAnalysisReady` writes the store scalar and NEVER touches the node; the
 * node's `goal_threshold_raw` has exactly one writer
 * (`backfillGoalThresholdOntoGoalNode`), reached from two OTHER call sites, and
 * it writes that key only when the payload carries it. So a payload with
 * `goal_threshold` and no raw moves one authority and not the other — by
 * design, because they answer different questions (CLAUDE.md trap 21):
 *
 *   node   "has a target been CAPTURED onto this goal?"
 *   store  "does the run pipeline hold a NUMBER for this goal?"
 *
 * Both answers are correct. The remedy is therefore NOT to make them agree, but
 * to name the question the USER is asking — *may I add one?* — give it ONE
 * owner (`canCaptureGoalTarget`, `domain/goalTarget.ts`) and have both
 * consumers read it. The load-bearing property is an IMPLICATION, not an
 * equality:
 *
 *     canCaptureGoalTarget(node.data)  ⟹  the panel renders GoalThresholdEditor
 *
 * and the chip renders exactly when the antecedent holds. So the promise is
 * sound BY CONSTRUCTION rather than by two defaults happening to coincide.
 *
 * ── RED-FIRST at pristine `1f7238ab` (signatures in the PR body) ───────────
 * Both divergent arms rendered the readout and NO editor; the corpus
 * implication failed on every divergent shape.
 *
 * ── WHAT THIS FILE IS NOT ─────────────────────────────────────────────────
 * jsdom pins presence and strings; it proves nothing about layout or
 * visibility (CLAUDE.md trap 3). And the residual card↔panel READOUT
 * disagreement — the card saying "Target not captured" while the panel holds a
 * number — is the extraction defect #1172 explicitly disclaims. This file
 * closes the DEAD END, not that.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { applyAnalysisReadyPatch } from '../../../conversation/utils/mirrorAnalysisReady'
import { canCaptureGoalTarget } from '../../../domain/goalTarget'
import type { CEEAnalysisReady } from '../../../../adapters/cee/types'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }

const GOAL_ID = 'goal1'
const GOAL_NODE = {
  id: GOAL_ID,
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Reach £30k MRR within 18 months' },
}

function analysisReady(extra: Record<string, unknown>): CEEAnalysisReady {
  return {
    goal_node_id: GOAL_ID,
    options: [{ id: 'opt_a', label: 'Option A', status: 'ready', interventions: {} }],
    ...extra,
  } as CEEAnalysisReady
}

function seedCanvas(data: Record<string, unknown> = {}) {
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    nodes: [{ ...GOAL_NODE, data: { ...GOAL_NODE.data, ...data } }],
    edges: [],
    goalThreshold: null,
  } as never)
}

/** The goal node's own data, read back from the store after the producers ran. */
function goalData(): Record<string, unknown> {
  return (useCanvasStore.getState().nodes.find(n => n.id === GOAL_ID)?.data ?? {}) as Record<
    string,
    unknown
  >
}

function renderPanel() {
  return render(
    <GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />,
  )
}

/**
 * THE EDITOR, BOUND BY IDENTITY. `GoalThresholdEditor` owns `#goal-threshold`
 * and nothing else in the panel does — a text predicate like "Success means
 * reaching" is satisfied by the READOUT too, which is precisely the element
 * whose presence must not be mistaken for the editor's (CLAUDE.md trap 19).
 */
function editorIn(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('#goal-threshold')
}

/** The readout sentence, which is the editor's alternative on this branch. */
function hasReadout(container: HTMLElement): boolean {
  return /Success means reaching\s*≥/.test(container.textContent ?? '')
}

beforeEach(() => {
  cleanup()
  seedCanvas()
  vi.mocked(useAuth).mockReset()
  vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
})

describe('the goal panel answers the chip’s promise on every payload the chip fires on', () => {
  it('POSITIVE CONTROL — when the two authorities AGREE a target exists, the editor is ABSENT', () => {
    // ⛔ Trap 13. Without this the whole file could be satisfied by a panel that
    // renders the editor unconditionally, and every assertion below would be
    // measuring a constant. Same panel, same mount, only the payload differs.
    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: analysisReady({
          goal_threshold: 0.8,
          goal_threshold_raw: 800000,
          goal_threshold_unit: '£',
        }),
      },
      { patchId: 'p1', scenarioId: null },
    )

    // The precondition, pinned in-test: BOTH authorities say a target exists.
    expect(useCanvasStore.getState().goalThreshold).toBe(800000)
    expect(canCaptureGoalTarget(goalData())).toBe(false)

    const { container } = renderPanel()
    expect(editorIn(container)).toBeNull()
    expect(hasReadout(container)).toBe(true)
  })

  it('⭐ DIVERGENCE A (normalised scalar, node untouched) — the editor answers', () => {
    // The reachable sequence: a turn carrying `goal_threshold` and NO raw. The
    // store takes the bare 0-1 magnitude; the backfill writes the unit and
    // leaves the raw alone, so the card still holds nothing.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    applyAnalysisReadyPatch(
      { ceeAnalysisReady: analysisReady({ goal_threshold: 0.8, goal_threshold_unit: '£' }) },
      { patchId: 'p1', scenarioId: null },
    )

    // ⛔ THE DIVERGENCE PIN — the two selectors must return DIFFERENT facts on
    // this payload, or this test is a tautology dressed as a guard (trap 13b).
    expect(useCanvasStore.getState().goalThreshold).toBe(0.8)
    expect(canCaptureGoalTarget(goalData())).toBe(true)

    const { container } = renderPanel()
    expect(editorIn(container)).not.toBeNull()
  })

  it('⭐ DIVERGENCE B (raw scalar, node untouched) — the editor answers', () => {
    // `setCeeAnalysisReady` alone: it writes the store scalar and calls no
    // node-side writer at all, so this arm needs no patch to diverge.
    useCanvasStore
      .getState()
      .setCeeAnalysisReady(analysisReady({ goal_threshold_raw: 30000, goal_threshold_unit: '£' }))

    expect(useCanvasStore.getState().goalThreshold).toBe(30000)
    // The node is genuinely untouched — this is the reviewer's measured claim,
    // re-derived here rather than inherited.
    expect(goalData().goal_threshold_raw).toBeUndefined()
    expect(canCaptureGoalTarget(goalData())).toBe(true)

    const { container } = renderPanel()
    expect(editorIn(container)).not.toBeNull()
  })

  it('the pre-existing "no number at all" branch still gets the editor', () => {
    // Neither authority holds anything. This is the branch the panel always
    // rendered the editor on, and widening the gate must not have narrowed it.
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(canCaptureGoalTarget(goalData())).toBe(true)
    const { container } = renderPanel()
    expect(editorIn(container)).not.toBeNull()
  })

  it('the "From your brief" pre-population branch survives — node target, no store number', () => {
    // ⚠ THE QUADRANT THE OBVIOUS FIX DELETES. Gating the editor on the node
    // ALONE would remove it here, where the node carries a brief-extracted raw
    // and the store holds no number — the exact state `GoalThresholdEditor`'s
    // `thresholdRaw` pre-population and its "From your brief" badge exist for.
    // The admission is a SUFFICIENT condition, never the whole gate.
    seedCanvas({ goal_threshold_raw: 30000, goal_threshold_unit: '£' })
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(canCaptureGoalTarget(goalData())).toBe(false)

    const { container } = renderPanel()
    expect(editorIn(container)).not.toBeNull()
  })
})

describe('the implication the chip’s promise rests on, over a corpus', () => {
  /**
   * Node shapes × store scalars. The corpus is written from the CONTRACT the
   * two writers admit — a store number with no node target, a node target with
   * no store number, both, neither — not from the arm that happened to be
   * witnessed (trap 22).
   */
  const NODE_SHAPES: Array<{ name: string; data: Record<string, unknown>; captures: boolean }> = [
    { name: 'empty', data: {}, captures: true },
    { name: 'blank raw', data: { goal_threshold_raw: '   ' }, captures: true },
    { name: 'null raw', data: { goal_threshold_raw: null }, captures: true },
    {
      name: 'user-attested threshold with no source tag',
      data: { success_threshold: 30000 },
      captures: true,
    },
    { name: 'numeric raw', data: { goal_threshold_raw: 30000 }, captures: false },
    { name: 'string raw', data: { goal_threshold_raw: '200k' }, captures: false },
    {
      name: 'user-set threshold',
      data: { threshold_source: 'user', success_threshold: 15 },
      captures: false,
    },
  ]
  const STORE_SCALARS: Array<number | null> = [null, 0.8, 30000]

  it('⭐ admission yes ⟹ the editor is on screen, on every shape × scalar', () => {
    let admitted = 0
    let refused = 0
    for (const shape of NODE_SHAPES) {
      for (const scalar of STORE_SCALARS) {
        cleanup()
        seedCanvas(shape.data)
        if (scalar != null) useCanvasStore.getState().setGoalThreshold(scalar)

        const admission = canCaptureGoalTarget(goalData())
        // The corpus's own expectation is asserted, so a change to the
        // admission cannot silently reclassify a row and keep this green.
        expect(admission, `${shape.name} admission`).toBe(shape.captures)

        const { container } = renderPanel()
        if (admission) {
          admitted += 1
          expect(editorIn(container), `${shape.name} / scalar ${scalar}`).not.toBeNull()
        } else {
          refused += 1
        }
      }
    }
    // ⛔ NON-VACUITY: both sides of the implication were actually exercised.
    expect(admitted).toBe(12)
    expect(refused).toBe(9)
  })

  it('CONTRAST — a refused shape with a displayable number shows the readout and NO editor', () => {
    // The discrimination, stated as its own case: without a row where the
    // editor is absent, "the editor is present whenever admitted" is satisfied
    // by a panel that always renders it.
    cleanup()
    seedCanvas({ goal_threshold_raw: 30000, goal_threshold_unit: '£' })
    useCanvasStore.getState().setGoalThreshold(30000)
    expect(canCaptureGoalTarget(goalData())).toBe(false)

    const { container } = renderPanel()
    expect(editorIn(container)).toBeNull()
    expect(hasReadout(container)).toBe(true)
  })
})

describe('the editor the promise leads to may not wear a unit the number is not on', () => {
  it('⛔ a normalised magnitude reaches the editor WITHOUT the raw scale’s unit', () => {
    // ROADMAP 2.315's defect, one element to the left: "≥ 0.8 £" is a magnitude
    // on one scale wearing the other scale's unit. Routing this arm to the
    // editor would have re-created it inside the input if the unit were passed
    // through unguarded — the panel already computes the scale-safe unit for
    // its readout, and the editor now reads the same one.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    applyAnalysisReadyPatch(
      { ceeAnalysisReady: analysisReady({ goal_threshold: 0.8, goal_threshold_unit: '£' }) },
      { patchId: 'p1', scenarioId: null },
    )
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')

    const { container } = renderPanel()
    const editor = editorIn(container)
    expect(editor).not.toBeNull()
    // The number is NOT lost — it is in the field, editable, where the readout
    // used to state it.
    expect(editor!.value).toBe('0.8')
    expect(container.textContent ?? '').not.toContain('£')
  })

  it('CONTRAST — a RAW magnitude keeps its unit in the editor', () => {
    // Same mount, same element: the suppression above is about the scale tag,
    // not about the editor never showing a unit.
    seedCanvas({ goal_threshold_unit: '£' })
    useCanvasStore.getState().setGoalThreshold(30000, { representation: 'raw' })

    const { container } = renderPanel()
    expect(editorIn(container)).not.toBeNull()
    expect(container.textContent ?? '').toContain('£')
  })
})
