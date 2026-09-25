/**
 * ⭐ V2 (Paul, 25 Sep 2026): THE STRIP CARRIES NO WORKLIST CHIPS.
 *
 * This file used to pin how the two worklist chips ("N to verify", "N with no
 * value yet") lined up: no per-chip margins, one flex row carrying the gap.
 * The V2 prototype removed both chips from the strip — they duplicated the
 * review tool's "N to review" — so the alignment cases went with them.
 *
 * What remains is the ruling itself: on the models that used to draw one chip,
 * or both, the strip draws NEITHER. Each absence is paired with a builder
 * precondition that the chip's population is really there, so it cannot pass
 * on an empty worklist (trap 13b). And the old wrapper must not linger as an
 * empty box.
 *
 * jsdom applies no CSS (trap 3); nothing here claims layout.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
type MockState = { nodes: unknown; setHighlightedNodes: unknown }
const setHighlightedNodesSpy = vi.fn()
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: setHighlightedNodesSpy })
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

import { ModelStrip } from '../sections/ModelStrip'
import { buildModelStrip } from '../buildModelStrip'

const TID = 'analysis-new-model-strip'

/** No value at all — counted by `noValueTotal`, invisible to `needsCheck`. */
const bare = (id: string, label: string) => ({ id, type: 'factor', data: { label } })
/**
 * Carries a value AND wants verification — the only shape that puts a factor in
 * `needsCheck`, and therefore the only way to make the FIRST chip render.
 */
const needsCheck = (id: string, label: string) => ({
  id,
  type: 'factor',
  data: {
    label,
    observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' },
    confidence: 'low',
  },
})

/**
 * ⭐ IN NEITHER COUNT — the fixture the first version of this file LACKED, and
 * the reason a mutant survived it.
 *
 * `factorNeedsVerification` is `!source || source === 'cee_inference'`
 * (`valueProvenance.ts:346`), so a factor whose value came from a HUMAN needs
 * no verification, and carrying a value keeps it out of `noValueTotal` too.
 * That is the only shape that empties BOTH worklists at once.
 *
 * ⚠⚠ WITHOUT IT THE "no empty container" TEST WAS VACUOUS. Its fixture used a
 * `needsCheck` factor, so the FIRST chip always rendered and the container was
 * never empty — the state the test names could not occur in it. Proven by
 * execution: mutating the wrapper to unconditional left the file 6/6 GREEN. A
 * test whose case cannot trigger the transformation asserts nothing (trap 13b),
 * and only the mutant could see it.
 */
const settled = (id: string, label: string) => ({
  id,
  type: 'factor',
  data: {
    label,
    observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'user' },
  },
})

const setNodes = (next: unknown[]) => {
  nodes.length = 0
  nodes.push(...next)
}
afterEach(() => {
  cleanup()
  setHighlightedNodesSpy.mockClear()
})

const openStrip = () => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
}

describe('THE FIXTURES REACH THE TWO STATES (precondition)', () => {
  /**
   * ⚠ PINNED IN-TEST RATHER THAN ASSUMED. Every assertion below is about which
   * chips render, so a fixture that silently stopped producing the counts would
   * make the whole file pass by rendering nothing (trap 13b). These assert the
   * populations the chips are derived from, at the builder.
   */
  it('the value-less model scores noValue > 0 and needsCheck === 0', () => {
    const strip = buildModelStrip([bare('f_a', 'Competitive pressure'), bare('f_b', 'Switching friction')])
    expect(strip.noValueTotal).toBeGreaterThan(0)
    expect(strip.needsCheckTotal).toBe(0)
  })

  it('the mixed model scores BOTH above zero — the contrast', () => {
    const strip = buildModelStrip([
      bare('f_a', 'Competitive pressure'),
      needsCheck('f_c', 'Vendor licensing cost'),
    ])
    expect(strip.noValueTotal).toBeGreaterThan(0)
    expect(strip.needsCheckTotal).toBeGreaterThan(0)
  })
})

const chipsIn = () => ({
  verify: screen.queryByTestId(`${TID}-verify-toggle`),
  noValue: screen.queryByTestId(`${TID}-no-value-toggle`),
})
const markIds = () =>
  screen.queryAllByTestId(`${TID}-mark`).map((el) => el.getAttribute('data-node-id'))

describe('V2: neither chip renders, on the models that used to draw them', () => {
  it('⭐ the value-less model: no no-value chip (it used to render alone here)', () => {
    setNodes([bare('f_a', 'Competitive pressure'), bare('f_b', 'Switching friction')])
    openStrip()
    // CONTRAST: the strip is open and drawing both factors.
    expect(markIds()).toEqual(['f_a', 'f_b'])
    expect(chipsIn()).toEqual({ verify: null, noValue: null })
  })

  it('⭐ the mixed model: no chip of either kind (both used to render here)', () => {
    setNodes([bare('f_a', 'Competitive pressure'), needsCheck('f_c', 'Vendor licensing cost')])
    openStrip()
    expect(markIds()).toEqual(['f_a', 'f_c'])
    expect(chipsIn()).toEqual({ verify: null, noValue: null })
  })
})

describe('no empty container is left behind', () => {
  /**
   * The chips' wrapper was conditional so a clean model drew no empty box. With
   * the chips gone it must not linger as one on ANY model — including the two
   * that used to fill it, which is where an emptied-but-kept wrapper would show.
   */
  const MODELS: Array<[string, Array<{ id: string; type: string; data: unknown }>]> = [
    ['clean', [settled('f_c', 'Vendor licensing cost')]],
    ['value-less', [bare('f_a', 'Competitive pressure'), bare('f_b', 'Switching friction')]],
    ['mixed', [bare('f_a', 'Competitive pressure'), needsCheck('f_c', 'Vendor licensing cost')]],
  ]

  it('⛔ PRECONDITION: the clean model really is in neither count', () => {
    const strip = buildModelStrip(MODELS[0][1])
    expect(`needsCheck=${strip.needsCheckTotal} noValue=${strip.noValueTotal}`).toBe(
      'needsCheck=0 noValue=0',
    )
  })

  it.each(MODELS)('⛔ the %s model leaves no empty box in the open region', (_name, model) => {
    setNodes(model)
    openStrip()
    // CONTRAST: the region is open and holds marks.
    expect(markIds().length).toBeGreaterThan(0)
    const region = screen.getByTestId(`${TID}-region`)
    const empties = Array.from(region.querySelectorAll('div')).filter(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim() === '',
    )
    expect(empties).toEqual([])
  })
})
