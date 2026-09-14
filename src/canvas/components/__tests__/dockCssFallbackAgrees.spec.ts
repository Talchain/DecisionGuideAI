/**
 * ⭐⭐ THE CSS FALLBACK AND THE MODULE MUST STATE THE SAME DOCK WIDTH.
 *
 * `--dock-right-expanded` is declared in `src/index.css` AND computed by
 * `dockWidth.ts`, and that mirror is UNAVOIDABLE rather than sloppy: the custom
 * property has to carry a value before the module runs, so the CSS declaration
 * is the pre-hydration fallback and the module is the live authority. Two
 * spellings of one number, by construction.
 *
 * ⛔ SO IT NEEDS A GUARD, because this estate's dominant defect is exactly this
 * shape (CLAUDE.md trap 12): a list a human must remember to sync, whose drift
 * always reads as green. The CSS said `26rem` for the width the module called
 * 416 — they agreed on the day they were written. When the founder ruled 300px
 * on 14 Sep 2026, NOTHING in the repo would have gone red had only one of them
 * moved: the user would see a 416px dock flash to 300px on hydration, or worse,
 * a stale 416 persist wherever the module never ran.
 *
 * ⭐ IT PARSES THE CSS RATHER THAN RESTATING IT. A test asserting `18.75` twice
 * would be a third copy of the same number and would prove only that I can type.
 * This reads the declaration out of the stylesheet, converts rem to px at the
 * 16px root the file itself uses, and compares to the module's own constant —
 * so the assertion is about AGREEMENT, and nothing here needs editing when the
 * width changes again.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DOCK_RESPONSIVE_MAX_WIDTH, DOCK_MIN_WIDTH } from '../dockWidth'

const CSS_PATH = path.resolve(__dirname, '../../../index.css')
const REM_PX = 16

/** The declared value of a `--custom-property`, or null when it is absent. */
function declaredCustomProperty(css: string, name: string): string | null {
  // Deliberately tolerant of the comment block that sits above the declaration,
  // and deliberately NOT tolerant of a second declaration — see the test below.
  const matches = [...css.matchAll(new RegExp(`^\\s*${name}\\s*:\\s*([^;]+);`, 'gm'))]
  if (matches.length === 0) return null
  if (matches.length > 1) return `__MULTIPLE__${matches.length}`
  return matches[0][1].trim()
}

function toPx(value: string): number | null {
  const rem = value.match(/^([\d.]+)rem$/)
  if (rem) return Number(rem[1]) * REM_PX
  const px = value.match(/^([\d.]+)px$/)
  if (px) return Number(px[1])
  return null
}

describe('--dock-right-expanded agrees with DOCK_RESPONSIVE_MAX_WIDTH', () => {
  const css = readFileSync(CSS_PATH, 'utf8')

  it('the stylesheet can actually be read and carries the declaration', () => {
    // Non-vacuity first. Every assertion below is satisfied by an EMPTY file or
    // a wrong path, so the probe proves it can SEE before it proves anything
    // about what it sees (CLAUDE.md trap 13).
    expect(css.length, 'index.css read as empty — the path is wrong, not the CSS').toBeGreaterThan(1000)
    expect(css, 'contrast control: a sibling dock property the file certainly has').toContain('--dock-right-collapsed')
    expect(declaredCustomProperty(css, '--dock-right-expanded')).not.toBeNull()
  })

  it('is declared exactly once — a second declaration would make "agrees" ambiguous', () => {
    const declared = declaredCustomProperty(css, '--dock-right-expanded')
    expect(declared, 'more than one declaration; the last one wins in CSS and this guard cannot say which is the fallback').not.toMatch(/^__MULTIPLE__/)
  })

  it('states the same number of pixels the module computes', () => {
    const declared = declaredCustomProperty(css, '--dock-right-expanded')!
    const px = toPx(declared)
    expect(px, `--dock-right-expanded is "${declared}", which is neither rem nor px`).not.toBeNull()
    expect(px).toBe(DOCK_RESPONSIVE_MAX_WIDTH)
  })

  it('the fallback never states a width the module would refuse', () => {
    // A defence against the two halves being "synced" to a value that is itself
    // illegal — agreement is necessary and not sufficient.
    const px = toPx(declaredCustomProperty(css, '--dock-right-expanded')!)!
    expect(px).toBeGreaterThanOrEqual(DOCK_MIN_WIDTH)
  })
})
