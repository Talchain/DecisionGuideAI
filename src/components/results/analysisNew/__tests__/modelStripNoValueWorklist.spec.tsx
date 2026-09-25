/**
 * ⭐⭐ THE STRIP WAS QUIETEST ON THE MODELS WITH THE LEAST IN THEM.
 *
 * `needsCheck` is `factorIsConfirmable`, i.e. `factorNeedsVerification &&
 * factorHasConfirmableValue`. The value limb is deliberate — `utils.ts` records
 * it as "narrowed 19 Aug" and `FactorsSection.tsx` records what it fixed, "an
 * enabled Confirm that silently did nothing". So **a factor with no value at all
 * cannot be "to verify"**, and the strip's only review affordance renders
 * nothing on exactly the models that most need review.
 *
 * Measured on the DEPLOYED build `80ccf768` (guest, seeded "Customer Data
 * Platform Selection"): the Model tab's own outline heading read **"2 with no
 * value yet"** while the Reasoning strip offered no review affordance at all.
 *
 * ⚠⚠ THIS IS A SECOND COUNT, NEVER A WIDER PREDICATE, and that is the whole
 * design. Widening `factorIsConfirmable` re-ships the defect its narrowing
 * fixed. Two questions, named apart (trap 21): *is there a value to RATIFY?*
 * and *is there a value AT ALL?*
 *
 * ⚠ AND ONE PREMISE I INHERITED IS TOO BROAD, SO THIS FILE DOES NOT ASSERT IT.
 * The handover said a value-less factor is "invisible to the strip". It is not:
 * the per-node DETAIL already reads "No value set". What was missing is the
 * AGGREGATE — a count and a worklist — which is what a reader uses to find the
 * gaps without clicking every mark. The narrower claim is the one built.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
type MockState = { nodes: unknown; setHighlightedNodes: unknown }
/*
 * ⚠ ONE STABLE SPY, not a fresh `vi.fn()` per read. The store mock is called on
 * every render, so a spy minted inside `read()` is a different object each time
 * and records nothing observable — an assertion against it would pass by
 * measuring an empty spy that was never the one the component called.
 */
const setHighlightedNodesSpy = vi.fn()
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: setHighlightedNodesSpy })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
const ringNodes = vi.fn()
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'
import { buildModelStrip } from '../buildModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'

/** A factor nobody has set and Olumi has not estimated — the population counted. */
const bare = (id: string, label: string) => ({ id, type: 'factor', data: { label } })
/** A factor carrying a number: `needsCheck` territory, NOT this one. */
const withValue = (id: string, label: string) => ({
  id,
  type: 'factor',
  data: { label, observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' } },
})
/**
 * ⭐ THE DISCRIMINATING SHAPE — derived by execution, not chosen.
 *
 * `observed_state` in SNAKE case. `factorCarriesValue` reads snake and camel;
 * `factorDisplayText` reads camel only. Measured at this head:
 *
 *   bare        hasValue=false  valueText=null
 *   camel       hasValue=true   valueText="£49"
 *   ⭐ snake    hasValue=true   valueText=null      ← the two disagree
 *   topDisplay  hasValue=true   valueText="0.25 to 0.75"
 *
 * This is the ONLY shape of the four on which the count's question and the
 * display text's question give different answers, which is exactly what makes
 * it the fixture that can see them drift apart. On every other shape the two
 * agree, so a suite built from those cannot observe the defect at all.
 */
const snakeValue = (id: string, label: string) => ({
  id,
  type: 'factor',
  data: { label, observed_state: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' } },
})

/** Olumi sent display text — a DIFFERENT clause on the Model tab, not "no value yet". */
const estimated = (id: string, label: string) => ({
  id,
  type: 'factor',
  data: { label, display_value: '0.25 to 0.75' },
})

const setNodes = (next: unknown[]) => {
  nodes.length = 0
  nodes.push(...next)
}
afterEach(() => {
  cleanup()
  ringNodes.mockClear()
  setHighlightedNodesSpy.mockClear()
})

describe('the strip counts the factors that carry no value at all', () => {
  it('⭐ counts them — and this is the state `needsCheck` cannot see', () => {
    const strip = buildModelStrip([
      bare('f_a', 'Competitive pressure'),
      bare('f_b', 'Switching friction'),
      withValue('f_c', 'Vendor licensing cost'),
    ])
    expect(strip.noValueTotal).toBe(2)
    // THE DISCRIMINATION. If the two counts ever answered one question, this REDs.
    expect(strip.needsCheckTotal).not.toBe(strip.noValueTotal)
  })

  it('⛔ SCOPED TO FACTORS — and the scoping is load-bearing, not tidiness', () => {
    // `valueText` is null for EVERY non-factor by construction, so a count that
    // forgot to scope returns the whole model and reads as a catastrophe.
    const strip = buildModelStrip([
      bare('f_a', 'Competitive pressure'),
      { id: 'o1', type: 'option', data: { label: 'A full switch at renewal' } },
      { id: 'r1', type: 'risk', data: { label: 'Migration delay' } },
      { id: 'u1', type: 'outcome', data: { label: 'GDPR compliance' } },
    ])
    // PRECONDITION: the non-factors really are present, so the 1 is a filter
    // doing its job rather than an empty model.
    expect(strip.total).toBe(4)
    expect(strip.noValueTotal).toBe(1)
  })

  it('⛔ A FACTOR OLUMI HAS ESTIMATED IS NOT "no value yet"', () => {
    // The same line `ModelOutline.unsetSummary` draws between "with no value
    // yet" and "estimated by Olumi". Read from `valueText`, which is
    // `factorDisplayText` — the estate's shared entry point — so this surface
    // and the canvas node cannot disagree about one factor.
    const strip = buildModelStrip([estimated('f_e', 'CRM feature fit')])
    expect(strip.rows[0].nodes[0].valueText).not.toBeNull()
    expect(strip.noValueTotal).toBe(0)
  })

  /*
   * ⛔ THE COUNT ASKS `hasValue`, NEVER THE DISPLAY TEXT. The count half of the
   * deleted "count and worklist ask one question" case, re-pointed to the
   * builder, where it is still live. Only the snake-case shape separates the
   * two questions.
   */
  it('⛔ a snake-case value is a value — the count does not read display text', () => {
    const strip = buildModelStrip([
      bare('f_a', 'Competitive pressure'),
      snakeValue('f_snake', 'Vendor licensing cost'),
    ])
    const snake = strip.rows[0].nodes.find((n) => n.id === 'f_snake')!
    // PRECONDITION: this is the shape on which the two questions disagree.
    expect(snake.valueText).toBeNull()
    expect(snake.hasValue).toBe(true)
    expect(strip.noValueTotal).toBe(1)
  })
})

/*
 * ⚠ V2 (Paul, 25 Sep 2026): the no-value CHIP left the strip — it duplicated
 * the review tool's "N to review". The cases that pressed it (narrowing, count
 * vs worklist, canvas ring, one-at-a-time, derived icon) were deleted with it.
 * The count above is still live builder logic; what the strip owes now is the
 * chip's ABSENCE, on exactly the model it used to render for.
 */
describe('V2: the strip carries no no-value chip', () => {
  it('⛔ ABSENT even when factors carry no value — the review tool owns the count', () => {
    const model = [
      bare('f_a', 'Competitive pressure'),
      bare('f_b', 'Switching friction'),
      withValue('f_c', 'Vendor licensing cost'),
    ]
    // PRECONDITION: the population the chip used to count is really there, so
    // the absence below is the V2 ruling and not an empty worklist.
    expect(buildModelStrip(model).noValueTotal).toBe(2)

    setNodes(model)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    // CONTRAST CONTROL: the strip rendered and every factor is on screen.
    expect(
      screen.queryAllByTestId(`${TID}-mark`).map((el) => el.getAttribute('data-node-id')),
    ).toEqual(['f_a', 'f_b', 'f_c'])
    expect(screen.queryByTestId(`${TID}-no-value-toggle`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-no-value-narrowed-note`)).toBeNull()
    // Nor is its count restated anywhere in the strip.
    expect(screen.getByTestId(TID)).not.toHaveTextContent(COPY.modelStrip.noValueCount(2))
  })
})

describe('the copy keys do not collide', () => {
  it('⛔ `noValue` STAYS THE DETAIL STRING AND `noValueCount` IS THE COUNT', () => {
    // I shipped this collision and three existing specs caught it: a duplicate
    // literal key silently won and the detail rendered a function. Two questions
    // under one name. This pins both so it cannot recur silently.
    expect(typeof COPY.modelStrip.noValue).toBe('string')
    expect(COPY.modelStrip.noValue).toBe('No value set')
    expect(typeof COPY.modelStrip.noValueCount).toBe('function')
    expect(COPY.modelStrip.noValueCount(1)).toBe('1 with no value yet')
    expect(COPY.modelStrip.noValueCount(4)).toBe('4 with no value yet')
  })
})
