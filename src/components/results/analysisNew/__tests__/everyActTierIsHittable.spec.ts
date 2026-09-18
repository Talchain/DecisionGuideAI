/**
 * ⭐⭐ EVERY ACTION TIER CARRIES THE TOUCH TARGET — derived from the map, with
 * no list of tiers to keep in step.
 *
 * WCAG 2.2 AA §2.5.8 asks for 24×24 CSS px. #1655 put that on `inline` after
 * finding the geometry applied at exactly ONE of twelve call sites, so eleven
 * acts shipped at 15px — including the only route out of a withheld verdict.
 * ⛔ **It fixed the tier it was looking at and did not ask the same question of
 * the others.** Measured on deployed `d084e9a8`, `primary` and `secondary`
 * still rendered `py-0.5` — about 19px — and `analysis-new-model-strip-target-edit`
 * ("Set a target") was **76×19, the only control under 24px at rest on the
 * whole panel**.
 *
 * ⭐ SO THE RULE IS OVER THE MAP, NOT OVER A LIST OF TIER NAMES. A guard that
 * named the tiers would be the same hand-maintained mirror one level up: the
 * sixth tier would be added without the geometry and nothing would go red.
 * `quiet` has zero call sites and is covered anyway, because a tier missing
 * this is discovered by its FIRST user shipping a 15px control.
 *
 * ⚠ `inline-flex items-center` IS PART OF THE CLAIM. `min-h` does nothing to a
 * purely inline box, so a tier declaring the minimum without the display mode
 * states a target it never reaches — which is why the assertion demands all
 * three and not just the height.
 *
 * ⚠ THIS FILE CANNOT SEE A PIXEL (trap 3). It asserts the tier DECLARES the
 * geometry; that the declaration reaches the rendered box was measured on the
 * deployed build by injection — 19px → 24px, panel column 1292 → 1297 (+0.39%).
 */
import { describe, expect, it } from 'vitest'
import { ACTION_TIER } from '../panelSurfaces'

/** The three classes that together make a hittable target, not just a tall one. */
const TOUCH_TARGET = ['inline-flex', 'items-center', 'min-h-[24px]'] as const

describe('every action tier is hittable', () => {
  /**
   * ⭐ THE PRECONDITION, PINNED. A rule of the form "every tier carries X" is
   * vacuously true over an empty map, and an import that silently resolved to
   * `{}` would make every case below pass while asserting nothing.
   */
  it('PRECONDITION: the tier map is non-empty and has the tiers this panel uses', () => {
    const tiers = Object.keys(ACTION_TIER)
    expect(tiers.length, 'the map must have tiers to assert over').toBeGreaterThanOrEqual(5)
    expect(tiers).toEqual(expect.arrayContaining(['primary', 'secondary', 'inline']))
  })

  it.each(Object.entries(ACTION_TIER))('⭐ %s declares a 24px touch target', (_name, classes) => {
    for (const cls of TOUCH_TARGET) {
      expect(classes, `missing "${cls}" — the target is stated but not reached`).toContain(cls)
    }
  })

  /**
   * ⛔ THE CONTROL. Without it, a `TOUCH_TARGET` that was accidentally emptied
   * would make every case above pass by asserting nothing at all — the shape
   * that lets a guard agree with itself.
   */
  it('CONTROL: the assertion can fail', () => {
    expect(TOUCH_TARGET.length).toBeGreaterThan(0)
    for (const [name, classes] of Object.entries(ACTION_TIER)) {
      expect(classes, `${name} must not already contain the sentinel`).not.toContain('min-h-[999px]')
    }
  })
})
