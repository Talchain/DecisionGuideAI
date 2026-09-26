/**
 * THE SUCCESS ROW IS A QUESTION WITH A QUIET PENCIL — AND THE STRIP CARRIES NO
 * FILLED PRIMARY.
 *
 * ⛔ THIS FILE'S PREMISE WAS REVERSED BY THE V2 PROTOTYPE. It pinned the unset
 * "Set a target" as the panel's one filled primary (`ACTION_TIER.primary`),
 * after a deployed census (`6f90588f`) found 25 controls and no primary at
 * all. Paul, 25 Sep 2026: match the V2 prototype, whose header has no filled
 * primary — the unset success row reads "What would success look like?" with
 * a quiet pencil.
 *
 * ⭐ THE PAIR IS STILL THE POINT. UNSET → the question, an icon-only pencil,
 * no fill. SET → the same icon-only pencil, no fill, and the question gone.
 * (26 Sep, design audit B5: the pencil is named as the prototype names it,
 * and the SET row's "Change" text is gone.) And the "no fill anywhere in the strip" probe is shown to see a filled
 * control before its zero is trusted.
 *
 * ⚠ BOUND BY TESTID AND ACCESSIBLE NAME, NOT BY VISIBLE TEXT (trap 19). The
 * unset control has no visible text at all now; its name is its identity.
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
import { ACTION_TIER, action } from '../panelSurfaces'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const STRIP = 'analysis-new-model-strip'
const TARGET = `${STRIP}-target`
/** V2 prototype's success row, verbatim; the component holds it as a local constant. */
const SUCCESS_QUESTION = 'What would success look like?'

/** The filled-control signature, read from the token so it cannot drift. */
const FILL = ACTION_TIER.primary.split(' ').filter((c) => c.startsWith('bg-'))

/** Every element under `root` carrying the whole fill signature. */
const filledIn = (root: Element) =>
  Array.from(root.querySelectorAll('*')).filter((el) => {
    const classes = (el.getAttribute('class') ?? '').split(/\s+/)
    return FILL.every((c) => classes.includes(c))
  })

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

// V2 prototype (Paul, 25 Sep 2026): no filled primary in the header; the unset
// success row is a question with a quiet pencil.
describe('the success row is a question with a quiet pencil, and nothing in the strip is filled', () => {
  it('PROBE CONTROL: the fill probe finds a filled control when one is there', () => {
    const { container } = render(
      <div>
        <button type="button" className={action('primary')}>probe</button>
        <button type="button" className={action('quiet')}>probe</button>
      </div>,
    )
    expect(filledIn(container)).toHaveLength(1)
  })

  // ⚠ 26 Sep (design audit B5): the pencil carries the prototype's name —
  // words OR an optional target — rather than "Set a target".
  it('UNSET — the row asks the question, and the pencil is icon-only, named as the prototype names it', () => {
    seed(false)
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TARGET}-none`).textContent).toBe(SUCCESS_QUESTION)
    const edit = screen.getByTestId(`${TARGET}-edit`)
    expect(screen.getByRole('button', { name: COPY.successTarget.describeSuccess })).toBe(edit)
    expect((edit.textContent ?? '').trim(), 'icon-only: no visible label').toBe('')
    expect(edit.querySelector('svg'), 'the pencil').not.toBeNull()
    for (const c of FILL) {
      expect(edit.className.split(' '), 'V2: the unset act is quiet, not filled').not.toContain(c)
    }
  })

  it('UNSET — the strip carries no filled primary anywhere', () => {
    seed(false)
    render(<ModelStrip isPreRun={false} />)
    // CONTRAST: the strip and its success row really rendered.
    expect(screen.getByTestId(`${TARGET}-edit`)).toBeInTheDocument()
    expect(filledIn(screen.getByTestId(STRIP))).toEqual([])
  })

  // ⚠ 26 Sep (design audit B5): the SET pencil is icon-only too — the
  // prototype's row has no "Change" text — and still not filled.
  it('SET — the pencil is icon-only and not filled either, and the question is gone', () => {
    seed(true)
    render(<ModelStrip isPreRun={false} />)
    const edit = screen.getByTestId(`${TARGET}-edit`)
    expect((edit.textContent ?? '').trim(), 'no "Change" text').toBe('')
    expect(edit).toHaveAccessibleName(COPY.successTarget.describeSuccess)
    for (const c of FILL) expect(edit.className.split(' ')).not.toContain(c)
    expect(screen.queryByTestId(`${TARGET}-none`)).toBeNull()
    expect(filledIn(screen.getByTestId(STRIP))).toEqual([])
  })
})
