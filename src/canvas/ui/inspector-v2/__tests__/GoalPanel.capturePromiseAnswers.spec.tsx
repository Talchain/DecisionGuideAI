/**
 * GoalPanel's legacy direct-mount branch shares SuccessTargetLine with the
 * active inspector. Keep the target-presence corpus and readout contrasts,
 * and pin the no-dispatch refusal instead of the deleted local-only writer.
 * Live routing is exercised by GoalPanel.targetReachesTheModel.spec.tsx.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { applyAnalysisReadyPatch } from '../../../conversation/utils/mirrorAnalysisReady'
import { canCaptureGoalTarget } from '../../../domain/goalTarget'
import { GOAL_CONSTRAINT_COPY } from '../inspectorStrings'
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

/** Bind the shared target control by testid, independently of its readout. */
function targetControlIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="goal-panel-target"]')
}

function openEditorIn(container: HTMLElement): HTMLInputElement {
  const edit = container.querySelector<HTMLButtonElement>('[data-testid="goal-panel-target-edit"]')
  expect(edit).not.toBeNull()
  fireEvent.click(edit!)
  const input = container.querySelector<HTMLInputElement>('[data-testid="goal-panel-target-input"]')
  expect(input).not.toBeNull()
  return input!
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

describe('the goal panel RENDERS THE EDITOR on every payload the chip fires on (presence, not answerability)', () => {
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
    expect(targetControlIn(container)).toBeNull()
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
    expect(targetControlIn(container)).not.toBeNull()
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
    expect(targetControlIn(container)).not.toBeNull()
  })

  it('the pre-existing "no number at all" branch still gets the editor', () => {
    // Neither authority holds anything. This is the branch the panel always
    // rendered the editor on, and widening the gate must not have narrowed it.
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(canCaptureGoalTarget(goalData())).toBe(true)
    const { container } = renderPanel()
    expect(targetControlIn(container)).not.toBeNull()
  })

  it('the node-target branch retains the shared control when the store has no number', () => {
    // ⚠ THE QUADRANT THE OBVIOUS FIX DELETES. Gating the editor on the node
    // ALONE would remove it here, where the node carries a brief-extracted raw
    // and the store holds no number — the exact state `SuccessTargetLine`'s
    // `thresholdRaw` pre-population and its "From your brief" badge exist for.
    // The admission is a SUFFICIENT condition, never the whole gate.
    seedCanvas({ goal_threshold_raw: 30000, goal_threshold_unit: '£' })
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(canCaptureGoalTarget(goalData())).toBe(false)

    const { container } = renderPanel()
    expect(targetControlIn(container)).not.toBeNull()
  })
})

describe('the shared target control cannot save without a dispatcher', () => {
  it('refuses a target on the divergent arm without changing the node or scalar', () => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    expect(canCaptureGoalTarget(goalData())).toBe(true)
    const { container } = renderPanel()
    const field = openEditorIn(container)
    fireEvent.change(field, { target: { value: '30000' } })
    fireEvent.click(container.querySelector('[data-testid="goal-panel-target-save"]')!)

    expect(goalData().success_threshold).toBeUndefined()
    expect(goalData().threshold_source).toBeUndefined()
    expect(useCanvasStore.getState().goalThreshold).toBe(0.8)
    expect(canCaptureGoalTarget(goalData())).toBe(true)
    expect(container.querySelector('[data-testid="goal-panel-target-outcome"]')?.textContent)
      .toBe("Not saved: this target can't be sent to Olumi right now.")
  })
})

describe('the editor the WITHDRAWN promise led to may not claim there are no probabilities', () => {
  /**
   * ⚠ THE FALSE CLAIM THE FIX ITSELF COULD HAVE BOUGHT. "Adding a specific
   * target unlocks probability calculations." is true only while there are
   * none. It sits under `SuccessTargetLine`, and before this change it was
   * UNREACHABLE whenever the pipeline held a number, because that state
   * rendered the readout instead. Routing the divergent arm to the editor made
   * it newly reachable beside a run that HAS produced probabilities.
   *
   * Trading one false sentence for another is exactly what this PR exists to
   * refuse (CLAUDE.md trap 23 — killing the symptom while the defect survives
   * one element to the left), so the line is gated on the condition it is true
   * under: the pipeline holds no number at all.
   */
  it('⛔ the divergent arm gets the editor WITHOUT the "unlocks probability calculations" claim', () => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    // The divergence, pinned: store holds a number, the node holds no target.
    expect(useCanvasStore.getState().goalThreshold).toBe(0.8)
    expect(canCaptureGoalTarget(goalData())).toBe(true)

    const { container } = renderPanel()
    const text = container.textContent ?? ''
    expect(targetControlIn(container)).not.toBeNull()
    expect(text).not.toContain(GOAL_CONSTRAINT_COPY.targetUnlocks)
  })

  it('CONTRAST — with NO number anywhere the claim is true, and is made', () => {
    // Without this the assertion above is satisfied by copy that was deleted
    // outright rather than gated (trap 13).
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(canCaptureGoalTarget(goalData())).toBe(true)

    const { container } = renderPanel()
    expect(targetControlIn(container)).not.toBeNull()
    expect(container.textContent ?? '').toContain(GOAL_CONSTRAINT_COPY.targetUnlocks)
  })
})

describe('the implication the chip’s WITHDRAWN promise rested on, over a corpus', () => {
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
          expect(targetControlIn(container), `${shape.name} / scalar ${scalar}`).not.toBeNull()
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
    expect(targetControlIn(container)).toBeNull()
    expect(hasReadout(container)).toBe(true)
  })
})

describe('the shared editor distinguishes a normalised scalar from a raw target', () => {
  it('does not seed a normalised magnitude into the raw-target input', () => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    applyAnalysisReadyPatch(
      { ceeAnalysisReady: analysisReady({ goal_threshold: 0.8, goal_threshold_unit: '£' }) },
      { patchId: 'p1', scenarioId: null },
    )
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')
    const { container } = renderPanel()
    expect(openEditorIn(container).value).toBe('')
    expect(container.textContent ?? '').not.toContain('£0.8')
    expect(container.textContent ?? '').not.toContain('0.8 £')
  })

  it('CONTRAST — a captured raw target keeps its unit and seeds the input', () => {
    seedCanvas({ goal_threshold_raw: 30000, goal_threshold_unit: '£' })
    const { container } = renderPanel()
    expect(container.textContent ?? '').toContain('£30,000')
    expect(openEditorIn(container).value).toBe('30000')
    expect(container.querySelector('[data-testid="goal-panel-target-unit"]')).toBeNull()
  })
})
