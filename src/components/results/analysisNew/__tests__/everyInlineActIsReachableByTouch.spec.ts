/**
 * ⭐⭐ ONE CONTROL GOT A TOUCH TARGET. ELEVEN DID NOT.
 *
 * WCAG 2.2 AA §2.5.8 asks for 24×24 CSS px. Measured on deployed `d135ff7e`,
 * post-analysis, sections at rest: the Reasoning panel rendered TWO inline acts
 * and BOTH were 15px high —
 *
 *   `analysis-new-glance-withheld-review-estimates`   133×15
 *   `analysis-new-trust-line-open-method`             131×15
 *
 * — and they are not incidental controls. The first is the ONLY route out of a
 * withheld verdict, which on a fresh run is the panel's whole state; the second
 * is the only route to how the run was worked out.
 *
 * ⭐ THE FIX ALREADY EXISTED, APPLIED ONCE. `CLAIM_TOGGLE_TOUCH_TARGET` in
 * `nameOrClaim.ts` carried these exact classes and the exact rationale — "this
 * control had 15px of height … shipping a target below the touch minimum
 * defeats the fix for exactly the users it is for" — and exactly one of the
 * twelve `action('inline')` call sites used it. That is trap 12, the
 * hand-maintained mirror: a per-call-site remedy that every later call site
 * silently misses, and nothing goes red.
 *
 * ⇒ THE GEOMETRY MOVES INTO THE TIER, which is `panelSurfaces.ts`'s own stated
 * rule: "GEOMETRY IS GRAMMAR AND IS FIXED. TONE IS MEANING AND VARIES." A
 * target size is geometry. It belongs to the grammar, not to whoever remembers.
 *
 * ── WHAT THIS SPEC CAN AND CANNOT CLAIM ────────────────────────────────────
 * jsdom applies no CSS and cannot measure a rendered target (trap 3). It
 * asserts the two STRUCTURAL facts that produce the size and are checkable:
 * the tier carries the minimum, and NO call site supplies its own — so the
 * guarantee has exactly one owner and cannot drift back to 1-of-12.
 *
 * The pixel claim was measured on the DEPLOYED build instead, by injection:
 * both controls 15px → 24px, `min(w,h) >= 24` true for both, and the panel
 * column grew 1288px → 1304px (+16px, +1.2%). Restored cleanly.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { stripComments } from '../../../../../tests/helpers/stripSourceComments'
import { ACTION_TIER, action } from '../panelSurfaces'

const SECTIONS_DIR = path.resolve(__dirname, '..')

/** The WCAG 2.2 AA minimum, stated once so the assertions cannot disagree. */
const MIN_TARGET_PX = 24

describe('the inline act carries its own touch target', () => {
  it('⭐ `action(inline)` guarantees the WCAG minimum height', () => {
    expect(action('inline')).toContain(`min-h-[${MIN_TARGET_PX}px]`)
  })

  it('and the padding that makes the minimum reachable rather than merely declared', () => {
    // `min-h` does nothing on a purely inline box, so the display mode is part
    // of the guarantee, not decoration.
    expect(ACTION_TIER.inline).toMatch(/inline-flex/)
    expect(ACTION_TIER.inline).toMatch(/py-1/)
  })

  it('⛔ keeps the affordance it already had — a target is not a licence to drop the underline', () => {
    // `actionColourMeansPressable` is about ancestry; this is about the resting
    // treatment. "Quiet" was never a licence to drop it, and nor is "bigger".
    expect(ACTION_TIER.inline).toMatch(/underline/)
    expect(ACTION_TIER.inline).toMatch(/text-info/)
  })

  /**
   * ⭐ THE DISCRIMINATING ARM. The three assertions above would all pass if
   * every tier were given the same blob — which would say nothing about
   * `inline` specifically and would quietly restyle the pill tiers. This pins
   * that the change is scoped: the pills keep their own, different geometry.
   */
  it('does not smear one geometry across the other tiers', () => {
    expect(ACTION_TIER.secondary).toContain('rounded-full')
    expect(ACTION_TIER.neutral).toContain('rounded-full')
    expect(ACTION_TIER.secondary).not.toMatch(/inline-flex/)
    expect(ACTION_TIER.neutral).not.toMatch(/inline-flex/)
  })
})

describe('the guarantee has exactly one owner', () => {
  /**
   * ⛔ THE ARM THAT STOPS THE DEFECT RECURRING. The original failure was not a
   * missing fix — it was a fix that lived at ONE call site. If a later call
   * site hand-rolls its own `min-h-[24px]`, the tier is no longer the single
   * owner and the next one added will miss it again.
   */
  it('⛔ no call site supplies its own touch target — the tier is the only source', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        if (entry === '__tests__' || entry === 'prototype') continue
        const full = path.join(dir, entry)
        if (fs.statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(full) && !/\.(spec|test)\./.test(full)) files.push(full)
      }
    }
    walk(SECTIONS_DIR)

    // ⛔ COMMENTS ARE STRIPPED FIRST, and my first version of this guard did
    // not — it flagged two files whose only match was PROSE: the tombstone in
    // `nameOrClaim.ts` and this rule's own explanation in `panelSurfaces.ts`.
    // The sibling guard's docblock names that as "this repo's dominant guard
    // footgun" and I walked into it anyway. Same helper it uses, not a second
    // implementation of the same idea.
    // ⚠ THE FILENAME IS LOAD-BEARING, NOT DECORATION. `stripComments`
    // dispatches on extension: `.tsx` gets JSX-aware tokenisation so a JSX
    // close `</` is never read as a regex open. My first version omitted it —
    // the suite stayed GREEN while every `.tsx` in the sweep was stripped with
    // the wrong tokeniser. The typecheck caught what the passing tests could
    // not, which is the argument for running the gate's steps in order.
    const code = (f: string) => stripComments(fs.readFileSync(f, 'utf8'), f)

    // PRECONDITION, IN-TEST: the sweep really reached the panel's sources, so
    // a pass cannot come from a walker that found nothing (trap 13).
    expect(files.length, 'precondition: the sweep found panel sources').toBeGreaterThan(20)
    // ⚠ The OWNER is excluded by construction: `panelSurfaces.ts` is where the
    // geometry is supposed to live, so flagging it would be the guard banning
    // the very arrangement it exists to enforce.
    const withInlineAct = files
      .filter((f) => !f.endsWith('panelSurfaces.ts'))
      .filter((f) => code(f).includes("action('inline')"))
    expect(withInlineAct.length, 'precondition: inline acts exist to be checked').toBeGreaterThan(5)

    // ⭐ BOTH FORMS, because the defect this guard exists for took the SECOND
    // one: `DriverInfluenceChart` did not carry the literal — it imported
    // `CLAIM_TOGGLE_TOUCH_TARGET`. A guard that matched only the raw class
    // would have read GREEN across the whole 1-of-12 drift, which is the
    // failure mode it is written to prevent (a guard agreeing with itself).
    // Verified RED at pristine against that exact file before the fix landed.
    const OWN_TARGET = new RegExp(`min-h-\\[${MIN_TARGET_PX}px\\]|TOUCH_TARGET`)
    const offenders = withInlineAct.filter((f) => OWN_TARGET.test(code(f)))
    expect(offenders.map((f) => path.relative(SECTIONS_DIR, f))).toEqual([])
  })
})
