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
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: vi.fn() })
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
import { ATTENTION_MARK } from '../../../../canvas/model-tab-v2/rowPresentation'

const TID = 'analysis-new-model-strip'

/** A factor nobody has set and Olumi has not estimated — the population counted. */
const bare = (id: string, label: string) => ({ id, type: 'factor', data: { label } })
/** A factor carrying a number: `needsCheck` territory, NOT this one. */
const withValue = (id: string, label: string) => ({
  id,
  type: 'factor',
  data: { label, observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' } },
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
})

describe('the worklist toggle', () => {
  it('⭐ renders above zero, narrows the strip to exactly those factors, and un-narrows', () => {
    setNodes([
      bare('f_a', 'Competitive pressure'),
      bare('f_b', 'Switching friction'),
      withValue('f_c', 'Vendor licensing cost'),
    ])
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))

    const marks = () =>
      screen.queryAllByTestId(`${TID}-mark`).map((el) => el.getAttribute('data-node-id'))
    // PRECONDITION, pinned in-test: all three are on screen before the filter.
    expect(marks()).toEqual(expect.arrayContaining(['f_a', 'f_b', 'f_c']))

    const toggle = screen.getByTestId(`${TID}-no-value-toggle`)
    expect(toggle).toHaveTextContent(COPY.modelStrip.noValueCount(2))
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // Bound by IDENTITY to the two valueless factors — not to a count another
    // pair of nodes could satisfy.
    expect(marks().sort()).toEqual(['f_a', 'f_b'])
    expect(screen.getByTestId(`${TID}-no-value-narrowed-note`)).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(marks()).toEqual(expect.arrayContaining(['f_a', 'f_b', 'f_c']))
  })

  it('⛔ IS ABSENT AT ZERO — a control that cannot change anything is furniture', () => {
    // The same rule the verify toggle already applies to its own number.
    setNodes([withValue('f_c', 'Vendor licensing cost')])
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    // CONTRAST CONTROL: the strip really did render, so the absence below is
    // absence and not an unmounted panel.
    expect(screen.getAllByTestId(`${TID}-mark`).length).toBeGreaterThan(0)
    expect(screen.queryByTestId(`${TID}-no-value-toggle`)).toBeNull()
  })

  it('⛔ ONE WORKLIST AT A TIME — pressing one releases the other', () => {
    // Two independent booleans would admit "both on", which names the EMPTY
    // intersection: `factorIsConfirmable` requires a value and this requires
    // its absence. Mutual exclusion by construction, asserted here.
    setNodes([
      bare('f_a', 'Competitive pressure'),
      {
        id: 'f_v',
        type: 'factor',
        data: {
          label: 'Vendor licensing cost',
          observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' },
        },
      },
    ])
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    const verify = screen.queryByTestId(`${TID}-verify-toggle`)
    const noValue = screen.getByTestId(`${TID}-no-value-toggle`)
    if (verify === null) {
      // The fixture did not produce a confirmable factor; the mutual-exclusion
      // claim is then untested rather than passing vacuously, so say so loudly.
      throw new Error(
        'PRECONDITION FAILED: no verify toggle rendered, so mutual exclusion is untested',
      )
    }
    fireEvent.click(verify)
    expect(verify).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(noValue)
    expect(noValue).toHaveAttribute('aria-pressed', 'true')
    expect(verify).toHaveAttribute('aria-pressed', 'false')
  })

  it('⛔ THE MARK IS DERIVED FROM THE MODEL TAB, NOT CHOSEN HERE', () => {
    // A hand-picked icon is a mirror of `ATTENTION_MARK['no-value']` and would
    // drift the first time either surface changed. This pins the derivation
    // itself, so a divergence REDs rather than shipping two vocabularies.
    setNodes([bare('f_a', 'Competitive pressure')])
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))
    const svg = screen.getByTestId(`${TID}-no-value-toggle`).querySelector('svg')
    expect(svg).not.toBeNull()
    const shipped = svg!.getAttribute('class') ?? ''

    // Render the Model tab's OWN answer and compare the two, so the assertion
    // is about agreement rather than about "some lucide icon rendered".
    const Expected = ATTENTION_MARK['no-value']
    const probe = render(<Expected />)
    const expectedSvg = probe.container.querySelector('svg')
    expect(expectedSvg).not.toBeNull()
    const expectedClass = expectedSvg!.getAttribute('class') ?? ''

    // DISCRIMINATION: the class must be a real icon name, not an empty string
    // that both sides would trivially satisfy.
    expect(expectedClass).toMatch(/lucide-[a-z-]+/)
    expect(shipped).toContain(expectedClass.split(' ').find(c => c.startsWith('lucide-'))!)
    probe.unmount()
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
