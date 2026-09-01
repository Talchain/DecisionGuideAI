/**
 * The success target is shown, is honest about what it holds, and never claims
 * a save it did not get.
 *
 * ⚠⚠ THE TWO REFUSALS ARE THE POINT. A normalised threshold rendered as a
 * target once "showed 0.8 when the real target was 20%", and there is no server
 * carrier for this value at all — so the two ways this control could lie are a
 * wrong NUMBER and a wrong OUTCOME, and each gets its own case.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setGoalThresholdAndUpdateNode = vi.fn()
let state: Record<string, unknown> = {}
vi.mock('../../../../canvas/store', () => ({
  useCanvasStore: (select: (s: Record<string, unknown>) => unknown) => select(state),
}))

import { SuccessTargetLine } from '../sections/SuccessTargetLine'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { VALUE_PROVENANCE_LABEL } from '../../../../canvas/domain/valueProvenance'

const TID = 'target'

beforeEach(() => {
  setGoalThresholdAndUpdateNode.mockReset()
  state = {
    nodes: [{ id: 'g1', type: 'goal', data: {} }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode,
  }
})
afterEach(cleanup)

const draw = (onCommitOutcome = vi.fn(), goalNodeId: string | null = 'g1') => {
  render(
    <SuccessTargetLine
      goalNodeId={goalNodeId}
      onCommitOutcome={onCommitOutcome}
      testId={TID}
    />,
  )
  return onCommitOutcome
}

describe('it shows the target the user already stated', () => {
  it('renders a raw threshold with its provenance', () => {
    state.goalThreshold = 110
    state.goalThresholdRepresentation = 'raw'
    draw()
    expect(screen.getByTestId(`${TID}-value`)).toHaveTextContent('110')
    expect(screen.getByTestId(`${TID}-source`)).toHaveTextContent(VALUE_PROVENANCE_LABEL.brief)
  })

  it('offers "Set a target" when the model has none', () => {
    draw()
    expect(screen.getByTestId(`${TID}-none`)).toHaveTextContent(COPY.successTarget.none)
    expect(screen.getByTestId(`${TID}-edit`)).toHaveTextContent(COPY.successTarget.set)
  })

  it('offers "Change" when it already holds one', () => {
    state.goalThreshold = 110
    state.goalThresholdRepresentation = 'raw'
    draw()
    expect(screen.getByTestId(`${TID}-edit`)).toHaveTextContent(COPY.successTarget.change)
  })
})

describe('the GOAL NODE is the source, and it is in the user\'s units', () => {
  /**
   * ⭐⭐ THE DEFECT THIS FIXES, WITNESSED ON DEPLOYED `6e58c921`. The canvas goal
   * card rendered "Target: 110%" while this line rendered "No target we can
   * show" — one goal, one screen, two answers. The node holds the figure in the
   * user's own units; the store held a NORMALISED twin of it, and this line was
   * reading the weaker source.
   */
  it('renders the node\'s CEE-derived target even when the store value is normalised', () => {
    state.nodes = [
      { id: 'g1', type: 'goal', data: { goal_threshold_raw: 110, goal_threshold_unit: '%' } },
    ]
    state.goalThreshold = 1.1
    state.goalThresholdRepresentation = 'normalised'
    draw()
    expect(screen.getByTestId(`${TID}-value`)).toHaveTextContent('110')
    expect(screen.queryByTestId(`${TID}-none`)).toBeNull()
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without it the case above passes on a component
   * that simply stopped honouring the normalised guard. Same normalised store
   * value, node carrying NOTHING — the refusal must return.
   */
  it('…and still refuses when the node carries nothing and only a normalised store value exists', () => {
    state.nodes = [{ id: 'g1', type: 'goal', data: {} }]
    state.goalThreshold = 1.1
    state.goalThresholdRepresentation = 'normalised'
    draw()
    expect(screen.queryByTestId(`${TID}-value`)).toBeNull()
    expect(screen.getByTestId(`${TID}-none`)).toHaveTextContent(COPY.successTarget.unexpressible)
  })

  /**
   * ⚠ PROVENANCE FOLLOWS THE RESOLVER. A target the reader TYPED and one CEE
   * lifted from their brief are different claims about authorship, and this
   * panel's provenance vocabulary exists to keep them apart. Hardcoding "From
   * brief" over a user-set value is exactly the mislabel it guards against.
   */
  it('credits the USER when they set it themselves', () => {
    state.nodes = [
      {
        id: 'g1',
        type: 'goal',
        data: { threshold_source: 'user', success_threshold: 95, goal_threshold_unit: '%' },
      },
    ]
    draw()
    expect(screen.getByTestId(`${TID}-source`)).toHaveAttribute('data-source', 'user')
    expect(screen.getByTestId(`${TID}-source`)).toHaveTextContent(VALUE_PROVENANCE_LABEL.human)
  })

  it('credits the BRIEF for a CEE-derived one', () => {
    state.nodes = [{ id: 'g1', type: 'goal', data: { goal_threshold_raw: 110 } }]
    draw()
    expect(screen.getByTestId(`${TID}-source`)).toHaveAttribute('data-source', 'brief')
    expect(screen.getByTestId(`${TID}-source`)).toHaveTextContent(VALUE_PROVENANCE_LABEL.brief)
  })

  /** A user-set value wins over CEE's backfill — `computeSuccessState`'s order. */
  it('a user-set target beats the CEE-derived one on the same node', () => {
    state.nodes = [
      {
        id: 'g1',
        type: 'goal',
        data: { threshold_source: 'user', success_threshold: 95, goal_threshold_raw: 110 },
      },
    ]
    draw()
    expect(screen.getByTestId(`${TID}-value`)).toHaveTextContent('95')
  })
})

describe('it refuses to print a number it cannot express', () => {
  /**
   * ⭐⭐ THE DEFECT THIS EXISTS TO PREVENT. A bare 0-1 painted as a target read
   * 0.8 when the real target was 20%. `normalised` is a REAL value we hold and
   * cannot state in the user's units.
   */
  it('NEVER renders a normalised threshold as a figure', () => {
    state.goalThreshold = 0.8
    state.goalThresholdRepresentation = 'normalised'
    draw()
    expect(screen.queryByTestId(`${TID}-value`)).toBeNull()
    expect(screen.getByTestId(`${TID}-none`)).toHaveTextContent(COPY.successTarget.unexpressible)
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without it the case above passes on a component
   * that never renders a value at all. Same number, different tag, different
   * render — so the tag is provably what decides.
   */
  it('…and DOES render the same number when it is raw', () => {
    state.goalThreshold = 0.8
    state.goalThresholdRepresentation = 'raw'
    draw()
    expect(screen.getByTestId(`${TID}-value`)).toHaveTextContent('0.8')
  })

  /**
   * ⚠ "None set" and "held but unexpressible" are DIFFERENT FACTS — one about
   * the model, one about the value. Telling a user who set a target that they
   * never did is the failure this separates.
   */
  /**
   * ⚠⚠ WITNESSED DEFECT, PINNED. On deployed `6e58c921` this line read
   * "Target: Set, but not in a unit we can show" roughly 120px above the
   * coaching card "Define success — No measurable success target is set" —
   * one panel asserting set and not-set about the same thing.
   *
   * The two surfaces answer different questions (this reads the MODEL's
   * threshold from the canvas store; the card's input arrives via the RUN's
   * `recommendation.goalThreshold`), and per trap 21 the fix is NOT to align
   * their defaults. But this sentence made the weaker claim — we hold a
   * normalised number we cannot interpret — so it is the one that must not
   * assert a state the reader cannot verify.
   */
  it('the unexpressible sentence never claims the target is SET', () => {
    expect(COPY.successTarget.unexpressible).not.toMatch(/\bset\b/i)
  })

  /** The twin: "none" is still allowed to say it, because there it is true. */
  it('…while "none" may still speak plainly about the absence', () => {
    expect(COPY.successTarget.none.length).toBeGreaterThan(0)
    expect(COPY.successTarget.none).not.toBe(COPY.successTarget.unexpressible)
  })

  it('says something different for "none" than for "unexpressible"', () => {
    draw()
    const none = screen.getByTestId(`${TID}-none`).textContent
    cleanup()
    state.goalThreshold = 0.8
    state.goalThresholdRepresentation = 'normalised'
    draw()
    expect(screen.getByTestId(`${TID}-none`).textContent).not.toBe(none)
  })
})

describe('the write is local, and says so', () => {
  it('writes to the GOAL node it was given', async () => {
    const user = userEvent.setup()
    draw(vi.fn(), 'goal-42')
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.type(screen.getByTestId(`${TID}-input`), '110')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(setGoalThresholdAndUpdateNode).toHaveBeenCalledWith('goal-42', 110)
  })

  /**
   * ⚠⚠ NEVER `dispatched`. `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget` is
   * `'disabled'` and no server carrier exists, so a "sent" sentence here would
   * claim an acceptance nothing gave.
   */
  it('reports local_only, never a dispatch', async () => {
    const user = userEvent.setup()
    const onCommitOutcome = draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.type(screen.getByTestId(`${TID}-input`), '110')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(onCommitOutcome).toHaveBeenCalledWith('local_only')
  })

  /** `Number('')` is 0 — a blank field must not set a target of zero. */
  it('a blank field writes nothing at all', async () => {
    const user = userEvent.setup()
    const onCommitOutcome = draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(onCommitOutcome).toHaveBeenCalledWith('not_encodable')
  })

  it('a non-numeric entry writes nothing at all', async () => {
    const user = userEvent.setup()
    const onCommitOutcome = draw()
    await user.click(screen.getByTestId(`${TID}-edit`))
    await user.type(screen.getByTestId(`${TID}-input`), 'soon')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(onCommitOutcome).toHaveBeenCalledWith('not_encodable')
  })
})

describe('it refuses to be an affordance writing into nowhere', () => {
  /**
   * ⚠ NO GOAL NODE, NO LINE. The store's setter falls back to `outcomeNodeId`
   * when handed nothing, so a rendered control with no goal would write a
   * target onto whatever else it found.
   */
  it('renders nothing when the model has no goal node', () => {
    const { container } = render(
      <SuccessTargetLine goalNodeId={null} onCommitOutcome={vi.fn()} testId={TID} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
