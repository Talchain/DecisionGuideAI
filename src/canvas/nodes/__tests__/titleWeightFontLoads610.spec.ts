/**
 * The contract title weight 610 must be a weight the loaded font can RENDER.
 *
 * Independent review of #1971 at `890c8560` (5821916572): `index.css` imported
 * Inter as a DISCRETE list (`wght@300;400;500;600;700`). Google then serves five
 * `@font-face` rules each declaring ONE weight, CSS font matching resolves 610
 * to the 700 face, and every card title rendered BOLD — measured in Chromium:
 * 610 and 700 byte-identical widths under the discrete list, a true 610 under
 * the range. jsdom does no font matching, so the inline `fontWeight: 610` specs
 * cannot see it; this pins the import itself.
 *
 *   1. The Inter import requests a weight RANGE that contains 610.
 *   2. CONTRAST — the title weight really is 610 (a range that contained it
 *      would prove nothing if the title asked for 700).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8')
// Read from the component's own source rather than exporting a constant from a
// component module; the inline-style specs (`BaseNode.titleWrap`) pin its use.
const baseNodeSrc = readFileSync(resolve(__dirname, '../BaseNode.tsx'), 'utf8')
const NODE_TITLE_WEIGHT = Number(baseNodeSrc.match(/const NODE_TITLE_WEIGHT = (\d+)/)?.[1] ?? NaN)
const interImport = css.split('\n').find((l) => /fonts\.googleapis\.com\/css2\?family=Inter/.test(l)) ?? ''

describe('the card title weight 610 is renderable by the loaded Inter', () => {
  it('Inter is imported as a weight RANGE that contains the title weight', () => {
    const m = interImport.match(/wght@(\d+)\.\.(\d+)/)
    expect(m, `Inter import is not a weight range: ${interImport}`).not.toBeNull()
    const [lo, hi] = [Number(m![1]), Number(m![2])]
    expect(lo).toBeLessThanOrEqual(NODE_TITLE_WEIGHT)
    expect(hi).toBeGreaterThanOrEqual(NODE_TITLE_WEIGHT)
  })

  it('CONTRAST — the title weight is the contract 610, not a declared face', () => {
    expect(NODE_TITLE_WEIGHT).toBe(610)
  })
})
