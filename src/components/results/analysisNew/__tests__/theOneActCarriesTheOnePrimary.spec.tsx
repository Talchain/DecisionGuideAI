/**
 * THE PANEL'S ONE ACT MUST CARRY THE PANEL'S ONE PRIMARY — AND UNTIL NOW
 * NOTHING ON THE SURFACE CARRIED IT AT ALL.
 *
 * ⛔ THE CENSUS THIS EXISTS FOR, taken on the DEPLOYED build (`6f90588f`),
 * driving a real run as a guest, read off the DOM at rest:
 *
 *     25 controls  ·  ZERO `ACTION_TIER.primary`
 *     the act ("Set a target")   an 11px underlined text link, right-aligned
 *     "Strengthen the reasoning" aria-expanded="false"
 *
 * `ACTION_TIER.primary` is declared *"THE ONE ACT. A filled control, and the
 * panel should carry at most one of them in view"* — written from the approved
 * prototype's own rule — and it had NO consumer that renders. Paul's reading of
 * the same surface, independently: *"nothing reads as primary"*.
 *
 * ⭐ THE PAIR IS THE POINT, NOT THE PRESENCE. A guard that only asserted "the
 * unset state is primary" would pass just as happily on a panel where EVERY
 * control is primary — which is the same defect with the opposite sign, and the
 * tier's own docblock says so. So the discrimination is UNSET → primary AND
 * SET → not primary, in one spec, on the same component.
 *
 * ⚠ BOUND BY TESTID, NOT BY TEXT. "Set a target" and "Change" are copy and can
 * move; `${TARGET}-edit` is the control's identity (trap 19).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
let goalThreshold: number | null = null

type MockState = {
  nodes: unknown
  setHighlightedNodes: unknown
  setGoalThresholdAndUpdateNode: unknown
  goalThreshold: number | null
  goalThresholdRepresentation: string | null
  currentScenarioId: string | null
}
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({
    nodes,
    setHighlightedNodes: vi.fn(),
    setGoalThresholdAndUpdateNode: vi.fn(),
    goalThreshold,
    goalThresholdRepresentation: null,
    currentScenarioId: 'scenario-7',
  })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: true,
    captureScenarioId: () => 'scenario-7',
    proposeGoalTarget: vi.fn(),
    proposeFactorValue: vi.fn(),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

import { ModelStrip } from '../sections/ModelStrip'
import { ACTION_TIER } from '../panelSurfaces'

const TARGET = 'analysis-new-model-strip-target'

/** The filled-control signature, read from the token so it cannot drift. */
const FILL = ACTION_TIER.primary.split(' ').filter((c) => c.startsWith('bg-'))

const goal = (withTarget: boolean) => ({
  id: 'g1',
  type: 'goal',
  data: {
    label: 'Reach 20k MRR within 12 months',
    ...(withTarget ? { goal_threshold_raw: 20000, goal_threshold_unit: 'GBP' } : {}),
  },
})
const seed = (withTarget: boolean) => {
  nodes.length = 0
  nodes.push(goal(withTarget), { id: 'o1', type: 'option', data: { label: 'Hold price' } })
  goalThreshold = withTarget ? 20000 : null
}

beforeEach(() => {
  expect(FILL.length, 'the primary tier must still be a FILLED control').toBeGreaterThan(0)
})
afterEach(cleanup)

describe('the one act carries the one primary', () => {
  it('UNSET — "Set a target" is the filled control', () => {
    seed(false)
    render(<ModelStrip isPreRun={false} />)
    const edit = screen.getByTestId(`${TARGET}-edit`)
    for (const c of FILL) {
      expect(
        edit.className.split(' '),
        `the act must carry ${c}: on the deployed build it was an 11px underlined link and the panel had no primary at all`,
      ).toContain(c)
    }
  })

  it('SET — "Change" drops back, so the emphasis is not spent on an ordinary affordance', () => {
    seed(true)
    render(<ModelStrip isPreRun={false} />)
    const edit = screen.getByTestId(`${TARGET}-edit`)
    for (const c of FILL) {
      expect(
        edit.className.split(' '),
        'an emphasis every state shares is an emphasis none of them has',
      ).not.toContain(c)
    }
  })
})
