/**
 * ⭐⭐ THE GEOMETRY THAT CLEARS SPACE FOR CANVAS TEXT MUST AGREE WITH THE TEXT.
 *
 * ⛔ THE DEFECT THIS EXISTS TO STOP, dated and measured rather than imagined.
 * #1527 (12 Sep 2026) raised canvas type — nodeTitle 12→14, nodeLabel 11→12,
 * **edgeLabel 10→11**. The geometry did not move with it, because it could not
 * see it: `edgeLabelCollision.ts` carried
 *
 *     const LABEL_DECLARED_FONT_PX = 10 // typography.edgeLabel
 *
 * a HAND-COPY whose comment asserted the very mirror that had gone stale. Two
 * consequences shipped and sat on staging for two days:
 *   · the label BOX stayed 160 graph units while its text grew 10%, so strength
 *     labels truncated. The founder reported "Moder… est."; his own captures
 *     from before #1527 read "Moderate boost (uncertain)" in full.
 *   · the box's HEIGHT was computed from a 10px font, so the collision resolver
 *     under-cleared every dodge by the same 10%.
 *
 * ⚠ AND THE CLASS STRINGS CANNOT DERIVE FROM THE NUMBERS — I tried, and it would
 * have shipped DARK. Tailwind's scanner reads SOURCE TEXT: an arbitrary-value
 * class built by template interpolation is invisible to it, the rule is never
 * generated, and the size silently falls back to inherited. So this is doctrine's
 * other half — derive where you can, and where you cannot, MAKE THE MIRROR FAIL
 * LOUD (CLAUDE.md trap 12).
 */
import { describe, it, expect } from 'vitest'
import { typography, CANVAS_TYPE_PX } from '../../src/styles/typography'
import { LABEL_HALF_WIDTH } from '../../src/canvas/edges/edgeLabelCollision'

/** The px a canvas type token actually declares, read out of the class string. */
const declaredPx = (cls: string): number | null => {
  const m = /text-\[length:calc\((\d+)px\*/.exec(cls)
  return m ? Number(m[1]) : null
}

describe('canvas type and the geometry that clears it cannot drift apart', () => {
  it('PRECONDITION: the parser can read a real token — otherwise every test below is vacuous', () => {
    expect(declaredPx(typography.edgeLabel), 'parser found no px in the edgeLabel class').not.toBeNull()
    expect(declaredPx('not-a-type-class'), 'parser must return null on a non-match').toBeNull()
  })

  it('every CANVAS_TYPE_PX number equals the px its class string declares', () => {
    const drift: string[] = []
    for (const key of Object.keys(CANVAS_TYPE_PX) as Array<keyof typeof CANVAS_TYPE_PX>) {
      const declared = declaredPx(typography[key] as string)
      if (declared !== CANVAS_TYPE_PX[key]) {
        drift.push(`${key}: CANVAS_TYPE_PX=${CANVAS_TYPE_PX[key]} but the class declares ${declared}`)
      }
    }
    expect(
      drift,
      'A canvas type size moved in one place and not the other. The class string is what the ' +
      'user sees; CANVAS_TYPE_PX is what the geometry reserves for. #1527 moved the first and ' +
      'not the second, and strength labels truncated for two days.',
    ).toEqual([])
  })

  it('⭐ the edge-label BOX scales with the edge-label FONT — the exact #1527 regression', () => {
    // 80 half-width was chosen at a 10px font. The box must hold that ratio.
    const expected = Math.ceil(80 * (CANVAS_TYPE_PX.edgeLabel / 10))
    expect(
      LABEL_HALF_WIDTH,
      `LABEL_HALF_WIDTH is ${LABEL_HALF_WIDTH} for a ${CANVAS_TYPE_PX.edgeLabel}px font. At ` +
      `10px it was 80. A font that grows inside a box that does not is what truncates a label.`,
    ).toBe(expected)
  })

  it('⛔ DISCRIMINATING: the box would NOT satisfy the ratio at the pre-#1527 font', () => {
    // Pins that the assertion above is sensitive to the font, not merely to a literal.
    // If someone re-hardcodes LABEL_HALF_WIDTH = 80, this run's font (11) reds the test above.
    expect(Math.ceil(80 * (10 / 10))).toBe(80)
    expect(Math.ceil(80 * (11 / 10))).toBe(88)
    expect(LABEL_HALF_WIDTH).not.toBe(80)
  })
})
