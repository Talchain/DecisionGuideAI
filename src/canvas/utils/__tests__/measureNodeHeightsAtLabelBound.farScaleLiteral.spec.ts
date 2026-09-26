/**
 * The far-title scale is DEFINED at runtime in exactly one place — the height
 * measurer's `setProperty` — and `scripts/css-var-census.mjs` can only see a
 * runtime definition written as a string literal. So that call spells the name
 * out, and this pins the spelling to the constant every reader imports: rename
 * one without the other and this goes red, instead of the census quietly
 * reporting BaseNode's far-title size as resolving to nothing.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CANVAS_FAR_TITLE_SCALE_VAR } from '../zoomLegibility'

const SOURCE = readFileSync(resolve(__dirname, '../measureNodeHeightsAtLabelBound.ts'), 'utf8')

describe('the far-title scale is defined by a literal setProperty the css-var census can read', () => {
  it('⭐ the measurer defines the property by the SAME name the constant carries', () => {
    expect(SOURCE).toContain(`root.style.setProperty('${CANVAS_FAR_TITLE_SCALE_VAR}', String(MAX_LABEL_COUNTER_SCALE))`)
  })
  it('CONTRAST: the constant is the name BaseNode reads', () => {
    expect(CANVAS_FAR_TITLE_SCALE_VAR).toBe('--canvas-far-title-scale')
  })
})
