/**
 * ⭐ THE SECOND WORKLIST CHIP DREW ITSELF 4px IN FROM EVERYTHING ELSE — on
 * exactly the models it was built for.
 *
 * The two worklist chips carried their spacing as PER-ELEMENT MARGINS: `mb-1`
 * on both, and `ml-1` on the second to separate it from the first. So the gap
 * between them lived on the second chip.
 *
 * `needsCheck` is `factorIsConfirmable`, which REQUIRES a value — so a model
 * whose factors carry no values scores `needsCheckTotal === 0`, the FIRST chip
 * does not render, and the second one keeps its `ml-1` with nothing to its left.
 * It draws itself 4px in from the strip's title, its tallies and its marks.
 *
 * ⚠⚠ AND THAT IS PRECISELY THE POPULATION THE SECOND WORKLIST EXISTS FOR. It
 * was added because "the strip was quietest on the models with least in them"
 * (`modelStripNoValueWorklist.spec.tsx`). The misalignment therefore fires on
 * the models the feature was written to serve, and never on the models its
 * author had in hand while writing it — which is why nothing caught it.
 *
 * The fix is CLAUDE.md's own rule and the repo's: spacing between siblings
 * belongs to the CONTAINER, not to the siblings. One flex row, one `gap`.
 *
 * ── WHAT THIS SPEC CAN AND CANNOT CLAIM ────────────────────────────────────
 * jsdom applies no CSS and cannot prove alignment (trap 3). It therefore
 * asserts the STRUCTURAL fact that produces the alignment and is checkable:
 * neither chip carries a horizontal margin of its own, and both share one
 * parent that carries the gap. A layout claim would need a real browser and is
 * not made here.
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

describe('the second chip does not indent itself when it renders alone', () => {
  it('⭐ renders alone on a value-less model, carrying no left margin', () => {
    setNodes([bare('f_a', 'Competitive pressure'), bare('f_b', 'Switching friction')])
    openStrip()

    // The state that produces the defect: second chip present, first absent.
    const second = screen.getByTestId(`${TID}-no-value-toggle`)
    expect(screen.queryByTestId(`${TID}-verify-toggle`)).toBeNull()

    // ⚠ ANY horizontal margin, not just `ml-1` — a fix that swapped the
    // utility for `ms-1` or `mx-1` would leave the defect and pass a
    // token-exact check.
    expect(second.className).not.toMatch(/\bm[lrxse]-/)
  })

  it('…and carries none when it renders BESIDE the first — the twin', () => {
    setNodes([bare('f_a', 'Competitive pressure'), needsCheck('f_c', 'Vendor licensing cost')])
    openStrip()

    const first = screen.getByTestId(`${TID}-verify-toggle`)
    const second = screen.getByTestId(`${TID}-no-value-toggle`)
    expect(first.className).not.toMatch(/\bm[lrxse]-/)
    expect(second.className).not.toMatch(/\bm[lrxse]-/)
  })
})

describe('the gap lives on the container, which is where it can be right', () => {
  it('both chips share one parent, and that parent carries the gap', () => {
    setNodes([bare('f_a', 'Competitive pressure'), needsCheck('f_c', 'Vendor licensing cost')])
    openStrip()

    const first = screen.getByTestId(`${TID}-verify-toggle`)
    const second = screen.getByTestId(`${TID}-no-value-toggle`)
    expect(first.parentElement).toBe(second.parentElement)

    const row = first.parentElement as HTMLElement
    expect(row.className).toMatch(/\bgap-/)
    expect(row.className).toContain('flex')
  })

  it('⛔ the row is NOT rendered when there is no worklist at all', () => {
    // An unconditional flex row is an empty 4px box on every clean model —
    // trading a visible misalignment for an invisible one.
    const model = [settled('f_c', 'Vendor licensing cost')]

    // ⚠ THE PRECONDITION, PINNED IN-TEST. This assertion is the whole reason
    // the test can observe anything: unless BOTH counts are zero, neither chip
    // is absent and the container is never empty. The first version of this
    // file omitted it and passed while measuring nothing.
    const strip = buildModelStrip(model)
    expect(`needsCheck=${strip.needsCheckTotal} noValue=${strip.noValueTotal}`).toBe(
      'needsCheck=0 noValue=0',
    )

    setNodes(model)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${TID}-toggle`))

    expect(screen.queryByTestId(`${TID}-verify-toggle`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-no-value-toggle`)).toBeNull()

    // Whatever chips exist, no empty container is left behind: every element
    // inside the region either is a chip or holds content.
    const region = screen.getByTestId(`${TID}-region`)
    const empties = Array.from(region.querySelectorAll('div')).filter(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim() === '',
    )
    expect(empties).toEqual([])
  })
})
