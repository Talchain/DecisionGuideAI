/**
 * Analysis (New) — THE CENSUS NEVER TRUNCATES ITS OWN CATEGORY NAMES.
 *
 * ⚠⚠ THE DEFECT, MEASURED ON DEPLOYED `a4d6e204` (guest, saved model). The
 * strip's four category labels sit in a grid whose first column was a literal
 * `76px`. Options, Factors and Risks fit. **Outcomes did not** — 53px of text
 * in a 52px box, with `truncate` doing exactly what it was asked to:
 *
 *     Options · Factors · Risks · Outcome…
 *
 * One pixel, on every model, at every panel width, in the panel's own census of
 * what the model contains. Nothing in the suite could see it, because jsdom has
 * no layout — `getBoundingClientRect` is all zeroes, so no rendering assertion
 * can catch a text overflow here. It was found by LOOKING at the screen.
 *
 * ── WHAT THIS TEST CAN HONESTLY GUARD, GIVEN THAT ──────────────────────────
 * Not the pixels. The DEFECT CLASS: a hardcoded pixel width sized to the copy
 * that happened to exist when it was written. That is the hand-maintained
 * mirror in CSS form (CLAUDE.md trap 12) — it drifts the moment a label is
 * renamed, a font changes, or the product is translated, and the drift reads as
 * green because nothing measures it.
 *
 * So the invariant is structural and derived from the source: **the label
 * column is content-sized.** `auto` is always exactly as wide as its widest
 * content, which is the property that makes the labels fit by construction
 * rather than by a number someone has to keep correct.
 *
 * ⚠ THIS IS A WEAKER GUARD THAN A PIXEL MEASUREMENT AND I AM NOT PRETENDING
 * OTHERWISE. It cannot catch a future truncation caused by something other than
 * this column. The real instrument for that is driving the build and looking,
 * which is how this was found and how the next one will be.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(__dirname, '../sections/ModelStrip.tsx'),
  'utf8',
)

/** The census row's grid template, extracted from source. */
const gridTemplate = (() => {
  const m = source.match(/grid grid-cols-\[([^\]]+)\]/)
  return m ? m[1] : null
})()

describe('the census row grid', () => {
  /**
   * ⭐ THE POSITIVE CONTROL. A regex that matches nothing looks exactly like a
   * regex whose assertion passed (CLAUDE.md trap 13). If the class moves or is
   * renamed, this REDs before the real assertion can pass vacuously.
   */
  it('can be located in source', () => {
    expect(gridTemplate).not.toBeNull()
    expect(gridTemplate).toContain('_1fr_')
  })

  /**
   * ⚠⚠ THE ACTUAL DEFECT. `76px` fitted three of four labels. Any pixel literal
   * in the label column is the same bet on today's copy.
   */
  it('sizes the label column to its CONTENT, never to a pixel literal', () => {
    const labelColumn = gridTemplate!.split('_')[0]
    expect(labelColumn).toBe('auto')
    expect(labelColumn).not.toMatch(/\d+px/)
  })

  /** The other two columns are unchanged — this was a one-column correction. */
  it('leaves the marks and count columns as they were', () => {
    expect(gridTemplate).toBe('auto_1fr_auto')
  })
})
