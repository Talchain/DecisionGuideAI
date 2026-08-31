/**
 * ⭐⭐ THE MODEL STRIP'S FOOTPRINT — the first render coverage this component
 * has ever had.
 *
 * `modelStrip.spec.ts` tests the BUILDER and nothing else. `ModelStrip.tsx` —
 * the thing that occupied 22% of the panel — had no render test at all, which
 * is why 155px of always-visible census could sit above the result with every
 * suite green. That absence is the reason this file exists, as much as the
 * change is.
 *
 * ⚠ WHAT THIS FILE CAN AND CANNOT CLAIM, STATED BEFORE THE ASSERTIONS.
 * jsdom cannot measure pixels (CLAUDE.md trap 3), so NOTHING here asserts a
 * height and no case should be read as evidence of one. What it pins is the
 * STRUCTURE that produces the height: the 155px was dominated by four rows of
 * wrapped mark arrays, so "the closed strip renders zero per-node marks and one
 * tally per kind" is the mechanised half of the claim. The pixel figure is owed
 * on a real browser against the deployed build, and until that witness exists
 * the height claim sits at CODE EXISTS / TESTED, not WIRE-WITNESSED.
 *
 * Every case binds by identity — `data-kind`, `data-node-id`, an exact testid —
 * never by a value predicate another element could satisfy.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []

vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: { nodes: unknown }) => unknown) => select({ nodes })
  ;(useCanvasStore as unknown as { getState: () => { nodes: unknown } }).getState = () => ({ nodes })
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { ModelStrip } from '../sections/ModelStrip'
import { MARK_CAP } from '../buildModelStrip'
import { MARK_COLOUR } from '../nodeMarks'

const TID = 'analysis-new-model-strip'

const node = (id: string, type: string, label?: string) => ({
  id,
  type,
  data: label === undefined ? {} : { label },
})

/**
 * The shape this change is sized against: a realistic model whose factor row is
 * well over the cap, so the closed/open contrast is the one a real user meets.
 * 2 options + 20 factors + 1 risk + 1 outcome.
 */
const REALISTIC = [
  node('g1', 'goal', 'Replace the customer data platform within budget'),
  node('o1', 'option', 'Adopt Segment'),
  node('o2', 'option', 'Adopt RudderStack'),
  ...Array.from({ length: 20 }, (_, i) => node(`f${i}`, 'factor', `Factor ${i}`)),
  node('r1', 'risk', 'Migration delay'),
  node('u1', 'outcome', 'GDPR compliance'),
]

const setCanvas = (next: ReadonlyArray<ReturnType<typeof node>>) => {
  nodes.length = 0
  nodes.push(...next)
}

const tally = (kind: string) =>
  screen.getAllByTestId(`${TID}-tally`).find((el) => el.getAttribute('data-kind') === kind)

beforeEach(() => {
  vi.mocked(focusModelTarget).mockClear()
  setCanvas(REALISTIC)
})
afterEach(() => cleanup())

describe('⭐ closed, the strip states the census and draws no per-node marks', () => {
  it('renders one labelled tally per non-empty kind and ZERO marks', () => {
    render(<ModelStrip isPreRun={false} />)

    // The kinds, in the design order, bound by their own attribute.
    expect(screen.getAllByTestId(`${TID}-tally`).map((el) => el.getAttribute('data-kind'))).toEqual([
      'option',
      'factor',
      'risk',
      'outcome',
    ])

    // ⭐ THE LOAD-BEARING ASSERTION. The 155px was four rows of wrapped mark
    // arrays; this is the one that goes red if they come back.
    expect(screen.queryAllByTestId(`${TID}-mark`)).toHaveLength(0)
    expect(screen.queryByTestId(`${TID}-region`)).toBeNull()
    expect(screen.queryAllByTestId(`${TID}-row`)).toHaveLength(0)
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'false')
  })

  it('each tally carries its kind’s name AND its exact count — the thing the canvas cannot say', () => {
    render(<ModelStrip isPreRun={false} />)
    // Bound to the factor tally by `data-kind`; a lookalike carrying "20"
    // elsewhere on the strip cannot satisfy it.
    const factors = tally('factor')!
    expect(factors).toHaveTextContent('Factors')
    expect(factors).toHaveTextContent('20')
    expect(tally('risk')!).toHaveTextContent('Risks')
    expect(tally('risk')!).toHaveTextContent('1')
  })

  /**
   * Constraint: an empty kind is a CLAIM ("you have no risks") and must never
   * render at zero. Pinned at the RENDER level, not only in the builder.
   */
  it('a kind absent from the canvas gets no tally at all, never a zero', () => {
    setCanvas([node('o1', 'option', 'Adopt Segment'), node('o2', 'option', 'Adopt RudderStack')])
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getAllByTestId(`${TID}-tally`)).toHaveLength(1)
    expect(tally('option')).toBeInTheDocument()
    expect(tally('risk')).toBeUndefined()
  })

  it('an empty canvas renders no strip at all, not an empty frame', () => {
    setCanvas([])
    render(<ModelStrip isPreRun={false} />)
    expect(screen.queryByTestId(TID)).toBeNull()
  })
})

describe('⭐ the discriminating twin — opening restores every mark, unchanged', () => {
  it('renders the per-node marks, capped, with the withheld count stated plainly', () => {
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))

    // 2 options + MARK_CAP of 20 factors + 1 risk + 1 outcome.
    expect(screen.getAllByTestId(`${TID}-mark`)).toHaveLength(2 + MARK_CAP + 1 + 1)
    expect(screen.getByTestId(`${TID}-region`)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'true')

    // The overflow sits on the factor row and NOT on the rows within the cap —
    // bound by `data-kind`, so a single stray overflow anywhere would fail.
    const factorRow = screen
      .getAllByTestId(`${TID}-row`)
      .find((el) => el.getAttribute('data-kind') === 'factor')!
    expect(within(factorRow).getByTestId(`${TID}-overflow`)).toHaveTextContent('+8 not shown')
    const optionRow = screen
      .getAllByTestId(`${TID}-row`)
      .find((el) => el.getAttribute('data-kind') === 'option')!
    expect(within(optionRow).queryByTestId(`${TID}-overflow`)).toBeNull()
  })

  it('the tallies give way to the rows rather than sitting above them', () => {
    // Two copies of one tally is the restatement this panel keeps paying for.
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    expect(screen.queryAllByTestId(`${TID}-tally`)).toHaveLength(0)
  })

  it('a mark still routes to its OWN node on the canvas', () => {
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    // Bound by the node's id, not by position — the affordance the disclosure
    // was moved to preserve.
    const mark = screen
      .getAllByTestId(`${TID}-mark`)
      .find((el) => el.getAttribute('data-node-id') === 'r1')!
    fireEvent.click(mark)
    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    expect(focusModelTarget).toHaveBeenCalledWith('r1')
  })
})

describe('⭐ the default tracks the run state, and the reader outranks it', () => {
  it('opens before a run — orientation is worth most when nothing else is on the panel', () => {
    render(<ModelStrip isPreRun={true} />)
    expect(screen.getByTestId(`${TID}-region`)).toBeInTheDocument()
    expect(screen.queryAllByTestId(`${TID}-tally`)).toHaveLength(0)
  })

  it('closes when the run completes, giving the space back to the result', () => {
    const { rerender } = render(<ModelStrip isPreRun={true} />)
    expect(screen.getByTestId(`${TID}-region`)).toBeInTheDocument()
    rerender(<ModelStrip isPreRun={false} />)
    expect(screen.queryByTestId(`${TID}-region`)).toBeNull()
    expect(screen.getAllByTestId(`${TID}-tally`)).toHaveLength(4)
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN, and it is the one that matters. The case
   * above passes just as well for a component that IGNORES the reader and
   * recomputes from `isPreRun` every render. This one takes the SAME
   * transition and demands the opposite outcome, decided solely by whether the
   * reader touched the control — so a default that overrode them goes red here.
   */
  it('leaves it OPEN across that same transition when the reader opened it themselves', () => {
    const { rerender } = render(<ModelStrip isPreRun={true} />)
    const toggle = screen.getByTestId(`${TID}-toggle`)
    fireEvent.click(toggle) // closed
    expect(screen.queryByTestId(`${TID}-region`)).toBeNull()
    fireEvent.click(toggle) // open, and now the reader's own choice
    rerender(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-region`)).toBeInTheDocument()
  })

  it('a reader who closes it pre-run is not reopened by the default', () => {
    const { rerender } = render(<ModelStrip isPreRun={true} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    rerender(<ModelStrip isPreRun={true} />)
    expect(screen.queryByTestId(`${TID}-region`)).toBeNull()
  })
})

describe('⭐ the shared vocabulary, and the subject line', () => {
  /**
   * Constraint: `nodeMarks.tsx` is the ONE vocabulary. A tally that drew its
   * own shape would teach a reader a key that then lies to them on the findings
   * below.
   */
  it('a tally draws the SHARED mark for its own kind, in the canvas colour', () => {
    render(<ModelStrip isPreRun={false} />)
    const riskMark = tally('risk')!.querySelector('[data-mark-kind]')!
    expect(riskMark).toHaveAttribute('data-mark-kind', 'risk')
    // Derived from the canvas, never restated here.
    for (const cls of MARK_COLOUR.risk.split(' ')) expect(riskMark).toHaveClass(cls)
  })

  it('the marks DISCRIMINATE — one shape for everything would satisfy the case above', () => {
    render(<ModelStrip isPreRun={false} />)
    const shape = (kind: string) =>
      tally(kind)!.querySelector('[data-mark-kind]')!.querySelector('path')!.getAttribute('d')
    const shapes = ['option', 'factor', 'risk', 'outcome'].map(shape)
    expect(new Set(shapes).size).toBe(4)
  })

  it('the subject names the landmark, and is on screen exactly once in either state', () => {
    render(<ModelStrip isPreRun={false} />)
    const subject = screen.getByTestId(`${TID}-goal`)
    expect(subject).toHaveTextContent('Replace the customer data platform within budget')
    // The landmark is announced as the decision it is about.
    expect(screen.getByTestId(TID)).toHaveAttribute('aria-labelledby', subject.id)
    expect(subject.id.length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    // One element, clamped when closed and full when open — never two copies.
    expect(screen.getAllByTestId(`${TID}-goal`)).toHaveLength(1)
  })

  it('with no goal or decision node it uses the strip’s own name, never an invented subject', () => {
    setCanvas([node('o1', 'option', 'Adopt Segment')])
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${TID}-goal`)).toHaveTextContent('Your model so far')
  })
})
