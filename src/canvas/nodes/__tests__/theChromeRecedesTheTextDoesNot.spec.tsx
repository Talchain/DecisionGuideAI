/**
 * ⭐⭐ TWENTY IDENTICAL BOXES WERE THE MESS — NOT THE TWENTY QUESTIONS.
 *
 * Measured on the fresh draft: **14 of 20 cards carry a `NodeChip`**, and that
 * is deliberate — `FactorNode`'s own comment says *"this is the one that must be
 * reachable without hovering."* Each chip was right on its own card; the
 * aggregate was not.
 *
 * So the chip keeps its place, its text and its hit area, and gives up only its
 * BORDER and FILL until the card has the reader's attention.
 *
 * ## Why this is a class contract rather than a rendered-pixel assertion
 *
 * jsdom does not run Tailwind, so it cannot compute `group-hover:` — asserting a
 * colour here would assert the fixture, not the product. The behaviour was
 * measured in a real browser instead (local dev, `pricing-model`, zoom 100):
 *
 *     at rest  border rgba(0,0,0,0)        bg rgba(0,0,0,0)     text rgb(63,63,62)
 *     on focus border rgba(39,122,157,.3)  bg rgb(254,254,254)  text rgb(63,63,62)
 *
 * What this spec pins is the thing a later edit can quietly break: that BOTH
 * halves are present. Half of this change is worse than none of it — drop the
 * reveal and the affordance becomes invisible; drop the recede and nothing was
 * fixed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/canvas/nodes/shared/NodeChip.tsx', 'utf8')

describe('the chrome recedes at rest; the text does not', () => {
  it('⭐ at rest the chip has no border and no fill', () => {
    expect(SRC).toContain('border-transparent')
    expect(SRC).toContain('bg-transparent')
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, deleting the reveal passes every
   * assertion above and ships an affordance nobody can see.
   */
  it('⛔ CONTRAST: the chrome RETURNS when the card has attention', () => {
    expect(SRC).toContain('group-hover:border-info/30')
    expect(SRC).toContain('group-hover:bg-panel')
    expect(SRC).toContain('group-focus-within:border-info/30')
    expect(SRC).toContain('group-focus-within:bg-panel')
  })

  it('⛔ the reveal needs the card root to be a `group`, or it silently never fires', () => {
    // `group-*` variants resolve against an ancestor carrying `group`. If
    // BaseNode ever loses it, this change degrades to "the chip is invisible" —
    // with no error anywhere. Pinned at the source that provides it.
    expect(readFileSync('src/canvas/nodes/BaseNode.tsx', 'utf8')).toMatch(/\bgroup relative\b/)
  })

  it('⭐ the TEXT colour is untouched — no WCAG question is reopened', () => {
    expect(SRC).toContain('text-text-body')
    // ⛔ Dimming the text was the obvious move and would trade a design
    // complaint for an accessibility one.
    expect(SRC).not.toContain('group-hover:text-')
  })

  it('the 24px touch target and the painted density are unchanged', () => {
    expect(SRC).toContain("before:-inset-y-[3px]")
    expect(SRC).toContain('py-0.5')
  })
})
