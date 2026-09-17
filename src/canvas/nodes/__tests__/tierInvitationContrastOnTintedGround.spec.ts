import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { invitationTextToken } from '../shared/TierInvitation'

/**
 * ⭐⭐⭐ THE GROUND MOVED AND THE COLOUR DID NOT.
 *
 * Measured on the DEPLOYED build `d135ff7e`, through the real user route
 * (press `L` -> lens dropdown -> "Evidence quality"), on two independent drafts:
 *
 *   factor BUTTON "What else drives this?"  data-testid=tier-invitation-factor
 *   #277a9d (--info) on #fcc798 (--warning-light) = 3.16:1, needs 4.5:1
 *
 * Baseline arm, same run, lens off: 73 text nodes, ZERO failing. So the card's
 * ordinary surface is fine and rule 5 is sound there — what fails is one state.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ WHY THE RULE-5 GUARD IS GREEN ON IT, AND WHY THAT IS NOT A BUG IN THAT GUARD
 * ─────────────────────────────────────────────────────────────────────────────
 * `nodeSystem.semanticColourOnText.spec.ts` permits exactly one token — `info` —
 * because `--info` clears **4.78:1** on `--bg-panel` and **4.60:1** on
 * `--bg-panel-hover`, the two grounds a node card paints. That is correct. The
 * evidence lens then repaints the card `--success-light` / `--warning-light` /
 * `--danger-light` (`BaseNode.tsx` `evidenceBgStyle`), and **`--info` clears
 * 3.40 / 3.16 / 2.78 on those** — the last below even the 3:1 graphic floor.
 *
 * That guard's own docblock already anticipated this: *"If a tinted fill ever
 * reaches a rung that renders text, this comment is the thing that should stop
 * being true, and the grounds must grow."* It does reach one. ⚠ But growing its
 * ground set globally would ban `text-info` from all 19 live sites whose contrast
 * is fine — so the grounds are not global, they are **per render state**, and this
 * file owns the tinted state.
 *
 * ⭐ WHY THIS ELEMENT AND ONLY THIS ELEMENT. Every other affordance is gated
 * `!isEvidenceLens` — quick actions, the provenance mark, the header slot, the
 * description, the whole body block. `TierInvitationRow` is mounted OUTSIDE the
 * body wrapper on purpose, and its own comment gives the reason: the LOD rung
 * blanks that wrapper by `visibility`, and an invitation that vanishes at the
 * zoom auto-fit parks at was the defect that placement fixed. **One placement
 * answered the LOD question and silently answered the LENS question too** — two
 * questions under one decision, and they have different right answers.
 *
 * ⭐ THE FIX KEEPS THE AFFORDANCE. Suppressing the invitation under the lens
 * would have passed this file and removed the only door on the board whose job
 * is to GENERATE rather than report — and the evidence lens, which exists to ask
 * *"which of these numbers do we actually know?"*, is precisely where a reader
 * wants to ask what else drives something. So the colour follows the ground
 * instead, reusing the repo's own precedent: `evidence-lens-class` already
 * renders `text-text-body` for exactly this reason, on exactly these tints.
 */

const BRAND = join(__dirname, '../../../styles/brand.css')
const BASENODE = join(__dirname, '../BaseNode.tsx')

type RGB = readonly [number, number, number]

const channels = (css: string, name: string): RGB => {
  const triple = new RegExp(`--${name}-rgb:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`).exec(css)
  if (triple) return [Number(triple[1]), Number(triple[2]), Number(triple[3])] as const
  const hex = new RegExp(`--${name}:\\s*#([0-9A-Fa-f]{6})`).exec(css)
  if (!hex) throw new Error(`brand.css defines neither --${name}-rgb nor --${name} as a hex`)
  const h = hex[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const
}

const relativeLuminance = (c: RGB) => {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

const contrast = (a: RGB, b: RGB) => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * `text-foo-bar` -> the custom property `--foo-bar` that paints it.
 * ⚠ ONCE, not repeatedly: `text-text-body` is painted by `--text-body`, and an
 * over-eager strip turns it into `--body`, which brand.css does not define. That
 * threw here before it could ever read wrong, which is the right failure — but a
 * silently-defaulting lookup would have made this guard measure nothing.
 */
const tokenVar = (className: string) => className.replace(/^text-/, '')

/**
 * ⭐ THE TINTS ARE DERIVED FROM THE CODE THAT PAINTS THEM, never listed here.
 * `evidenceBgStyle` is the single expression that decides a card's tint; if a
 * fifth evidence class is added tomorrow it appears in that switch, and this
 * guard picks it up without anyone remembering to update a list. A hand-copied
 * tint list is the hand-maintained mirror this estate keeps paying for.
 */
function tintsPaintedByTheCard(): string[] {
  const src = readFileSync(BASENODE, 'utf8')
  // `\n {2}\}` rather than two literal spaces: eslint's no-regex-spaces is right
  // that a run of spaces in a pattern is unreadable and easy to miscount.
  const block = /const evidenceBgStyle = \(\(\) => \{[\s\S]*?\n {2}\}\)\(\)/.exec(src)
  if (!block) throw new Error('evidenceBgStyle block not found in BaseNode.tsx — this guard is reading the wrong shape')
  const found = [...block[0].matchAll(/var\(--([a-z-]+)\)/g)].map(m => m[1])
  return [...new Set(found)]
}

const TEXT_THRESHOLD = 4.5

describe('the tier invitation is legible on every ground its card can paint', () => {
  it('derives the tints from the card, and finds the three the evidence lens paints', () => {
    // POSITIVE CONTROL on the derivation itself. If this ever reads empty, every
    // assertion below would pass vacuously — an absence probe with no control is
    // exactly how a guard agrees with itself.
    const tints = tintsPaintedByTheCard()
    expect(tints.length).toBeGreaterThan(0)
    expect(tints.sort()).toEqual(['danger-light', 'success-light', 'warning-light'])
  })

  it('⭐ the token used on a TINTED card clears 4.5:1 on every tint', () => {
    const css = readFileSync(BRAND, 'utf8')
    const fg = channels(css, tokenVar(invitationTextToken(true)))
    for (const tint of tintsPaintedByTheCard()) {
      const ratio = contrast(fg, channels(css, tint))
      expect(ratio, `${invitationTextToken(true)} on --${tint}`).toBeGreaterThanOrEqual(TEXT_THRESHOLD)
    }
  })

  it('the token used on an UNTINTED card still clears 4.5:1 on both panel grounds', () => {
    // The fix must not trade one ground for another: --info is the surface's
    // designated link colour and is correct where the card is not repainted.
    const css = readFileSync(BRAND, 'utf8')
    const fg = channels(css, tokenVar(invitationTextToken(false)))
    for (const ground of ['bg-panel', 'bg-panel-hover']) {
      expect(contrast(fg, channels(css, ground)), `${invitationTextToken(false)} on --${ground}`)
        .toBeGreaterThanOrEqual(TEXT_THRESHOLD)
    }
  })

  it('⛔ PINS THE SHIPPED DEFECT: the untinted token would FAIL on a tint', () => {
    /*
     * Without this, the first test could be satisfied by a fix that made BOTH
     * branches return the same safe token — losing the link colour everywhere
     * and leaving no record of what was actually wrong. This asserts the two
     * branches are genuinely discriminating, and that the direction of the
     * discrimination is the measured one: 3.16:1 on --warning-light, which is
     * the exact reading taken on the deployed build.
     */
    const css = readFileSync(BRAND, 'utf8')
    const untinted = channels(css, tokenVar(invitationTextToken(false)))
    expect(contrast(untinted, channels(css, 'warning-light'))).toBeLessThan(TEXT_THRESHOLD)
    expect(contrast(untinted, channels(css, 'warning-light'))).toBeCloseTo(3.16, 2)
    expect(contrast(untinted, channels(css, 'danger-light'))).toBeCloseTo(2.78, 2)
    expect(invitationTextToken(true)).not.toBe(invitationTextToken(false))
  })
})
