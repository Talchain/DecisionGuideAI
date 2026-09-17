/**
 * THE KEY MUST TEACH THE RIBBON THE CANVAS ACTUALLY DRAWS.
 *
 * ⭐ WHY THIS SHIPS WITH THE RIBBON AND NOT AFTER IT. This popover's own header
 * records L-49: *"the canvas spoke four vocabularies with no key — solid vs
 * dashed, +/- markers, thickness, and colour. The legend explained the first
 * and the third."* Adding a fifth channel without its row reproduces that
 * defect exactly, and a channel a reader cannot decode is decoration.
 *
 * ⚠ AND THE DRIFT THIS GUARDS. The thickness block above had to be rewritten
 * once because it carried its own `1.5 / 2 / 3` literals "mirroring"
 * `weightMagnitudeToStrokeWidth` — the hand-maintained mirror trap 12 exists to
 * abolish, whose failure mode is a key teaching a width the canvas no longer
 * draws, green all the way. So every width asserted here is DERIVED through
 * `uncertaintyBandHalfWidth`, the same function the edge calls.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'
import { uncertaintyBandHalfWidth } from '../../utils/graphDisplayCalculations'

afterEach(cleanup)

const open = () => {
  render(<CanvasLegendPopover />)
  fireEvent.click(screen.getByRole('button', { name: 'How to read this' }))
}

/** The ribbon is the TRANSLUCENT line in the swatch; the opaque one is the
 *  connection itself. Bound by opacity rather than by document order, so a
 *  reordering of the two cannot silently swap which one is measured. */
const ribbon = (testId: string): SVGLineElement | undefined =>
  Array.from(document.querySelectorAll<SVGLineElement>(`[data-testid="${testId}"] line`))
    .find(l => l.getAttribute('opacity') !== null)

describe('the key teaches the uncertainty ribbon', () => {
  it('renders all three rows, including the honesty row', () => {
    open()
    expect(screen.getByText('Tight band: this strength is fairly certain')).toBeDefined()
    expect(screen.getByText('Wide band: this strength is a rough guess')).toBeDefined()
    expect(screen.getByText('No band: nobody has said how certain this is')).toBeDefined()
  })

  /**
   * ⭐ THE ANTI-DRIFT ASSERTION. Widths come from the real function, so this
   * cannot pass on a legend that has drifted from the canvas, and it does not
   * go stale when the scale constant moves.
   */
  it('draws each sample at the width that std genuinely earns', () => {
    open()
    for (const [testId, std] of [['legend-uncertainty-tight', 0.01], ['legend-uncertainty-wide', 0.22]] as const) {
      const expected = uncertaintyBandHalfWidth({ show: true, value: std, source: 'cee' })
      expect(expected).not.toBeNull()
      const el = ribbon(testId)
      expect(el, `${testId} has no ribbon`).toBeTruthy()
      expect(Number(el!.getAttribute('stroke-width'))).toBe(expected! * 2)
    }
  })

  /**
   * Asserted as an ORDERING, so it cannot pass on two arbitrary different
   * numbers — the sibling thickness spec's rule. If the census extremes ever
   * collapse onto the floor together, this row stops teaching a contrast and
   * this test says so.
   */
  it('makes the two samples visibly different, or it teaches nothing', () => {
    open()
    const tight = Number(ribbon('legend-uncertainty-tight')!.getAttribute('stroke-width'))
    const wide = Number(ribbon('legend-uncertainty-wide')!.getAttribute('stroke-width'))
    expect(wide).toBeGreaterThan(tight)
  })

  /**
   * ⛔ THE INVERSION THIS ROW EXISTS TO PREVENT. Without it a reader is taught
   * that "no band" means certain — the strongest possible misreading, because
   * it reverses the channel. The swatch must therefore genuinely carry no
   * ribbon, not a very thin one.
   */
  it('draws no ribbon at all on the honesty row', () => {
    open()
    expect(ribbon('legend-uncertainty-unset')).toBeUndefined()
    // Contrast control: the connection line itself IS still drawn, so the
    // absence above is the ribbon's and not an empty swatch.
    expect(document.querySelectorAll('[data-testid="legend-uncertainty-unset"] line').length).toBe(1)
  })
})
