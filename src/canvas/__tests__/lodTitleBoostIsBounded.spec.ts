/**
 * ⭐ LOD IS THE SECOND TERM IN THE CARD'S HEIGHT, AND THE FIX ONLY WORKS IF IT
 * POINTS THE SAFE WAY (review note 2 — "bounded, or merely small?").
 *
 * `applyLayout` reserves each card's height at `MAX_LABEL_COUNTER_SCALE`, which
 * is reached at `LABEL_LEGIBLE_ZOOM`. Below that same threshold a SECOND rule
 * fires: `BaseNode`'s `lodBoostTitle` swaps the goal / decision / kept-option
 * title from `typography.nodeTitle` — `calc(12px * var(--canvas-label-scale,1))`,
 * i.e. 24px at the cap — to a FIXED `text-lg`, 18px.
 *
 * Measured (`e2e/geometry/heightVsZoom.measure.ts`, build-vs-buy @1280x800):
 * crossing 0.5 downward, **7 of 23 cards move, −92px in total, 1.48% of 6211px**:
 *
 *     dec_billing          333 → 317  (−16)   ← this guard covers these two
 *     goal_billing         173 → 157  (−16)   ←
 *     out_billing_accuracy 166 → 154  (−12)   ← this guard does NOT cover these
 *     out_delivery_speed   166 → 154  (−12)   ←
 *     risk_billing_errors  166 → 154  (−12)   ←
 *     risk_eng_overload    166 → 154  (−12)   ←
 *     risk_vendor_lock     166 → 154  (−12)   ←
 *
 * ⚠⚠ WHAT THIS FILE GUARDS, AND WHAT IT DOES NOT — READ BEFORE TRUSTING IT.
 * An earlier draft of this header said the two title cards moved "and nothing
 * else moves". **That was false**, refuted by this change's own other two
 * measurements, and it is exactly the sentence a later LOD lane would have
 * inherited as settled fact.
 *
 *   GUARDED (below): the TITLE term — `lodBoostTitle`'s font size against the
 *   size the layout reserves. That is the `dec_billing` / `goal_billing` −16px.
 *
 *   NOT GUARDED: the remaining −12px on the five outcome / risk cards. It comes
 *   from other LOD-gated body content, not from the title, and no assertion in
 *   this repo compares it to anything. Same direction (a shrink) and smaller,
 *   which is why it was accepted rather than fixed — but it is ACCEPTED, not
 *   PROVEN, and a change that made LOD-gated body content GROW would pass every
 *   test here.
 *
 *   The nearest thing to a guard on that limb is `heightVsZoom.measure.ts`,
 *   which asserts BOTH directions per card — that no card is TALLER with LOD on
 *   (a layout computed with LOD off would be overflowed by it), and that no
 *   card's LOD delta reaches the tightest row slack the layout leaves (a layout
 *   computed with LOD ON reserves the shorter height, so every card grows by its
 *   delta when the user zooms back in). Measured 16px against a 45px sub-row
 *   slack. It is a real browser probe and does NOT run in CI. If you are
 *   changing LOD-gated body content, run it.
 *
 *   ⚠ AND THE TWO ARE NOT INTERCHANGEABLE, measured by mutating the boost size
 *   one step at a time: this file compares DECLARED SIZES and so REDs at
 *   `text-3xl` (30 > 24); the probe compares RENDERED CARD HEIGHTS and survives
 *   `text-3xl` — correctly, because at 30px the card lands level with its
 *   LOD-off self and is therefore not taller — and REDs from `text-5xl` up.
 *   This file is more SENSITIVE and narrower; the probe is blunter and WIDER.
 *
 * ⚠ And the bound the whole argument rests on: the worst single-card delta is
 * 16px against a designed row slack of `LAYOUT_PADDING_Y + effectiveLayerSpacing`
 * = 64px (45px for a sub-row). That margin, not the percentage, is why a
 * one-directional 1.48% is safe.
 *
 * ⭐⭐ SMALL IS NOT THE ANSWER. THE DIRECTION IS. A card that shrinks below the
 * reserved height leaves whitespace, which the layout doctrine explicitly calls
 * harmless; a card that GREW past it would overlap the row beneath and
 * reintroduce exactly the defect this PR closes. So the honest statement is:
 *
 *   LOD is safe today because 18 < 24 — an ARITHMETIC fact about two numbers in
 *   two different files, not a property of the design. Raise the boost to
 *   `text-3xl` (30px) and the goal and decision cards become TALLER than the
 *   height the layout reserved for them, silently, on every model, below 0.5
 *   zoom. Nothing else in the codebase compares these two numbers.
 *
 * This spec is that comparison. It is deliberately a SOURCE-level guard: the two
 * quantities live in a Tailwind class and a token expression, so there is no
 * runtime object that holds both, and jsdom cannot render either (trap 3).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MAX_LABEL_COUNTER_SCALE } from '../utils/zoomLegibility'
import { typography } from '../../styles/typography'

const REPO_ROOT = resolve(__dirname, '../../..')

/**
 * Tailwind's default type scale, for the classes a node title could plausibly
 * carry. Named rather than computed: the point is to force a human to state the
 * px of any class they introduce here, in the file that checks it fits.
 */
const TAILWIND_TEXT_PX: Record<string, number> = {
  'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18,
  'text-xl': 20, 'text-2xl': 24, 'text-3xl': 30, 'text-4xl': 36,
}

/** Declared px of the ordinary node title, read from the token, not restated. */
function declaredNodeTitlePx(): number {
  const m = /calc\((\d+(?:\.\d+)?)px\s*\*\s*var\(--canvas-label-scale/.exec(typography.nodeTitle)
  expect(m, `nodeTitle is no longer a counter-scaled calc() — this guard is measuring nothing (got: ${typography.nodeTitle})`).not.toBeNull()
  return Number(m![1])
}

/** The class the LOD title boost applies, read from BaseNode's own ternary. */
function lodBoostTitleClass(): string {
  const src = readFileSync(resolve(REPO_ROOT, 'src/canvas/nodes/BaseNode.tsx'), 'utf8')
  const m = /lodBoostTitle\s*\n?\s*\?\s*'([^']+)'/.exec(src)
  expect(m, 'the lodBoostTitle ternary was not found in BaseNode — this guard is measuring nothing').not.toBeNull()
  return m![1]
}

describe('LOD title boost is bounded BY THE RESERVED HEIGHT, not merely small', () => {
  it('the boosted title is no larger than the size the layout reserves for', () => {
    const reservedPx = declaredNodeTitlePx() * MAX_LABEL_COUNTER_SCALE
    const boostClass = lodBoostTitleClass()

    const sizeClass = boostClass.split(/\s+/).find((c) => c in TAILWIND_TEXT_PX)
    expect(
      sizeClass,
      `the LOD title boost uses a text size this guard cannot price ("${boostClass}"). Add it to TAILWIND_TEXT_PX with its px — an unpriced class is an unbounded one.`,
    ).toBeDefined()

    expect(
      TAILWIND_TEXT_PX[sizeClass!],
      `the LOD title boost (${sizeClass}) is LARGER than the ${reservedPx}px the layout reserves. Below LABEL_LEGIBLE_ZOOM the goal and decision cards would grow past their row band and overlap the row beneath — the defect this PR closes, arriving through the other door.`,
    ).toBeLessThanOrEqual(reservedPx)
  })

  it('CONTRAST CONTROL: the comparison discriminates', () => {
    // Without this, a guard whose extraction silently returned '' would agree
    // forever (trap 13b — a guard agreeing with itself).
    const reservedPx = declaredNodeTitlePx() * MAX_LABEL_COUNTER_SCALE
    expect(reservedPx).toBe(24)
    expect(TAILWIND_TEXT_PX['text-lg']).toBeLessThanOrEqual(reservedPx)
    expect(TAILWIND_TEXT_PX['text-3xl']).toBeGreaterThan(reservedPx)
    // And both extractors returned something real.
    expect(lodBoostTitleClass().length).toBeGreaterThan(0)
    expect(declaredNodeTitlePx()).toBeGreaterThan(0)
  })

  it('the threshold LOD flips at IS the zoom the counter-scale caps at', () => {
    // The direction argument above holds only because the two rules share one
    // threshold. If LOD flipped somewhere else, there would be a band where the
    // boost applies and the scale has NOT capped, and the reserved height would
    // be computed for a smaller title than the card renders.
    const lodSrc = readFileSync(resolve(REPO_ROOT, 'src/canvas/components/LodSync.tsx'), 'utf8')
    expect(lodSrc).toMatch(/LOD_ZOOM_THRESHOLD\s*=\s*LABEL_LEGIBLE_ZOOM/)
    expect(
      lodSrc,
      'LodSync introduced its own literal threshold — the two rules can now disagree about where the band starts',
    ).not.toMatch(/LOD_ZOOM_THRESHOLD\s*=\s*[\d.]/)
  })
})
