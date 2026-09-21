/**
 * An editable field must be visibly a field.
 *
 * THE DEFECT, measured on the deployed build 21 Sep 2026. The factor value
 * input — the control that edits the model — was `bg-transparent border-b
 * border-panel-border`, a transparent box whose only marking measured
 * **1.23 : 1** against the panel. WCAG 1.4.11 asks 3.00 : 1 for a non-text
 * indicator. It rendered as plain text and the founder, who built the product,
 * reported that he could not edit the graph. The capability worked; the control
 * was invisible.
 *
 * ⚠ THE RATIOS ARE COMPUTED FROM `brand.css`, NEVER RE-TYPED HERE. A number
 * copied into a spec is a hand-maintained mirror (CLAUDE.md trap 12) and this
 * estate has already paid for exactly that with `LABEL_DECLARED_FONT_PX = 10`,
 * a stale copy carrying a comment asserting the mirror it had broken. If the
 * palette moves, this spec re-derives and fails; it cannot quietly agree.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { controls } from '../controls'

const BRAND = readFileSync(join(__dirname, '..', 'brand.css'), 'utf8')

/** Pull an `--x-rgb: R G B;` triple out of the token source. */
function token(name: string): [number, number, number] {
  const m = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(BRAND)
  if (m === null) throw new Error(`token --${name} not found in brand.css`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** WCAG 2.1 relative luminance + contrast ratio. */
const luminance = ([r, g, b]: readonly number[]): number => {
  const lin = [r, g, b].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}
const contrast = (a: readonly number[], b: readonly number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const WCAG_NON_TEXT_MINIMUM = 3.0

describe('an editable field is visibly a field', () => {
  it('⭐ the field border clears the WCAG non-text minimum against the panel', () => {
    const ratio = contrast(token('border-field-rgb'), token('bg-panel-rgb'))
    expect(ratio).toBeGreaterThanOrEqual(WCAG_NON_TEXT_MINIMUM)
  })

  /**
   * ⭐⭐ THE POSITIVE CONTROL, and without it the assertion above proves nothing.
   * A contrast test that passes every colour is a guard agreeing with itself
   * (CLAUDE.md trap 13). These two tokens are what the field used to use, and
   * they MUST fail — if they ever pass, the threshold or the maths is wrong,
   * not the palette.
   */
  it('POSITIVE CONTROL — the two pre-existing border tokens genuinely FAIL the same test', () => {
    const panel = token('bg-panel-rgb')
    expect(contrast(token('border-default-rgb'), panel)).toBeLessThan(WCAG_NON_TEXT_MINIMUM)
    expect(contrast(token('border-emphasis-rgb'), panel)).toBeLessThan(WCAG_NON_TEXT_MINIMUM)
  })

  it('⭐ has HEADROOM, so a palette nudge does not silently drop it below the floor', () => {
    // Sitting exactly on 3.00 would make the next warm-tone adjustment a
    // regression nobody notices. Asserting the margin pins the intent.
    const ratio = contrast(token('border-field-rgb'), token('bg-panel-rgb'))
    expect(ratio).toBeGreaterThanOrEqual(3.4)
  })

  it('the field style uses the field token and NOT the container token', () => {
    // ⚠ ASSERTED ON THE BASE STATE ONLY, and that is a sharpening rather than a
    // relaxation. The claim is about what an ENABLED field is marked with: the
    // 3.70:1 token, never the 1.23:1 container token.
    //
    // A FENCED field legitimately uses the low-contrast token — `disabled:` is
    // how the product says "this cannot be edited", and the flat `not.toContain`
    // could not tell that state apart from the defect. It fired on
    // `disabled:border-panel-border`, which is the correct fenced treatment.
    const base = controls.editableField
      .split(/\s+/)
      .filter((c) => !c.includes(':'))
    expect(base).toContain('border-field')
    expect(base).not.toContain('border-panel-border')

    // And the fenced state is still pinned, positively, so dropping it REDs.
    expect(controls.editableField).toContain('disabled:border-panel-border')
  })

  it('the field is a box with a fill, not a bare underline', () => {
    // An underline reads as decoration under text; a filled box reads as
    // somewhere to put something. Both halves are load-bearing.
    expect(controls.editableField).toContain('bg-panel-hover')
    expect(controls.editableField).not.toContain('bg-transparent')
    expect(controls.editableField).not.toMatch(/\bborder-b\b/)
  })

  it('focus is still marked — it was never the defect', () => {
    expect(controls.editableField).toContain('focus:border-primary')
  })
})
