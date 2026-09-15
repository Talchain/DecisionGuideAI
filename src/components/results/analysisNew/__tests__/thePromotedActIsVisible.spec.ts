/**
 * THE ONE PROMOTED ACT MUST BE DISTINGUISHABLE WITHOUT COLOUR VISION, AND BY A
 * RATIO A READER CAN ACTUALLY SEE.
 *
 * ⛔ WHAT THIS PINS, AND WHY IT IS NOT A TASTE GUARD. `PANEL_INSET_ACTION` is
 * the panel's single deliberately-distinct pressable object — `AtAGlance`'s
 * promoted act, the one move a reader meets without opening anything. Its own
 * docblock justified having NO BORDER on the grounds that *"a filled,
 * borderless card among outlined ones reads as the thing to press"*.
 *
 * Measured against the deployed tokens, that fill is **1.08:1**. The argument
 * rested on a distinction below every threshold in the standard, and this
 * directory had already condemned the identical number once — `SectionShell`
 * restored a 1px rule after `bg-panel-hover/40` measured 1.015:1.
 *
 * ⚠ THE FIGURE IS DERIVED HERE, NEVER COPIED. `panelSurfaces` states 3.35:1 in
 * prose; a spec repeating that number would be a hand-maintained mirror of the
 * sentence it is meant to check (CLAUDE.md trap 12). So the alpha is READ OUT
 * OF THE TOKEN STRING and the ratio is COMPUTED, and a future edit that lowers
 * the alpha REDs on the computation rather than on a stale constant.
 *
 * ⚠ BOTH GROUNDS. `PANEL_GROUNDS` is `['--bg-panel','--bg-panel-hover']` and
 * hover is in scope because the object must survive being hovered — which is
 * exactly when a reader is deciding whether it is pressable.
 */
import { describe, it, expect } from 'vitest'
import { PANEL_INSET_ACTION } from '../panelSurfaces'
import { PANEL_GROUNDS, tokenHex } from '../../../../../tests/helpers/semanticTextContrastScan'
import { WCAG_NON_TEXT_MIN, compositeOver, contrast } from '../../../../../tests/helpers/wcagContrast'

/**
 * Resolve a token, ASSERTING it exists.
 *
 * ⚠ `tokenHex` returns `string | null`, and an unresolved token is not a
 * nuisance to cast away — it is the one input that would make every ratio below
 * meaningless while the spec stayed green. The assertion is the guard's own
 * precondition, so a renamed or deleted token REDs here by name rather than
 * silently computing against `null`.
 */
function ink(token: string): string {
  const hex = tokenHex(token)
  expect(hex, `${token} did not resolve — every ratio below would be computed against nothing`).not.toBeNull()
  return hex as string
}

/** `border-info/80` -> `{ token: '--info', alpha: 0.8 }`. Null when absent. */
function borderFromToken(cls: string): { token: string; alpha: number } | null {
  const m = /(?:^|\s)border-([a-z-]+)\/(\d{1,3})(?:\s|$)/.exec(cls)
  if (m === null) return null
  return { token: `--${m[1]}`, alpha: Number(m[2]) / 100 }
}

describe('the promoted act is visible without colour vision', () => {
  it('carries a border, so SHAPE and not only FILL says it is pressable', () => {
    expect(
      borderFromToken(PANEL_INSET_ACTION),
      'the one promoted act must be outlined: its fill alone measures 1.08:1, which is not a distinction',
    ).not.toBeNull()
    expect(PANEL_INSET_ACTION).toContain('border ')
  })

  it('clears SC 1.4.11 on BOTH panel grounds, computed from the token itself', () => {
    const border = borderFromToken(PANEL_INSET_ACTION)
    expect(border).not.toBeNull()
    const borderInk = ink(border!.token)
    for (const ground of PANEL_GROUNDS) {
      const bg = ink(ground)
      const ratio = contrast(compositeOver(borderInk, bg, border!.alpha), bg)
      expect(
        ratio,
        `${border!.token}/${border!.alpha * 100} over ${ground} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(WCAG_NON_TEXT_MIN)
    }
  })

  /**
   * ⭐ THE PRECONDITION, PINNED IN-TEST. Without this the pair above could pass
   * on a token whose fill was ALSO legible, and the guard would then be
   * asserting nothing about the case it was written for. The fill being
   * invisible is WHY the border has to carry the affordance.
   */
  it('is still a fill no reader can rely on — which is what the border is for', () => {
    const panel = ink('--bg-panel')
    const m = /bg-([a-z-]+)\/\[?([\d.]+)\]?/.exec(PANEL_INSET_ACTION)
    expect(m, 'the token must still carry its fill — the border adds to it, never replaces it').not.toBeNull()
    const fill = contrast(compositeOver(ink(`--${m![1]}`), panel, Number(m![2])), panel)
    expect(fill).toBeLessThan(1.5)
  })
})
