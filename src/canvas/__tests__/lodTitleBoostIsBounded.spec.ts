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
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⭐⭐⭐ AMENDED 2 Sep 2026 — TWO MECHANISMS, AND **THE SLACK IS NOW ZERO**.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * ⛔⛔ READ THIS BEFORE YOU "FIX" A RED HERE. THE OBVIOUS FIX REINSTATES A LIVE,
 * MEASURED DEFECT.
 *
 * When this guard goes red the tempting move is to put `lodBoostTitle` back to
 * `text-lg`. **Do not.** `text-lg` carries no `--canvas-label-scale`, and this
 * boost applies ONLY below `LABEL_LEGIBLE_ZOOM`, where the ordinary title is
 * counter-scaled to 24px. So:
 *
 *     ordinary title   12px x labelCounterScale(z) x z = 24z
 *     `text-lg` boost  18px x 1                    x z = 18z
 *
 * and `18z < 24z` for every positive z. The "boost" was a **25% shrink on 100%
 * of the cards it touched, 100% of the time** — the goal and decision cards,
 * the two this product singles out as always-legible, were rendering the
 * SMALLEST text on the canvas. Measured in Chromium across all five committed
 * starter drafts at 1280x800 and 1440x900 (`e2e/geometry/zoomLadder.measure.ts`):
 * **4.67px against 6.23px**. If you need to move the boost, move it to a
 * SMALLER counter-scaled size, never to a fixed one.
 *
 * ⚠ AN EARLIER DRAFT OF THIS PARAGRAPH SAID REVERTING TO `text-lg` "WOULD MAKE
 * THIS FILE GREEN". **THAT IS FALSE AT THIS TIP, AND IT WAS FALSE IN THE VERY
 * COMMIT THAT WROTE IT.** It was true of the guard as #1123 shipped it, and the
 * zero-slack assertion added below is exactly what changed it: with `text-lg`
 * the slack reads 6px, not 0, and the mechanism reads `fixed`, not
 * `counter-scaled`. Measured — that revert REDs **this file (2 failed)** as
 * well as `nodes/__tests__/BaseNode.lodTitleLegibility.spec.tsx` (4 failed).
 *
 * Recorded rather than quietly deleted, because it is this estate's
 * correcting-comment-is-the-false-one class occurring INSIDE a correction — and
 * because this whole file is an argument about a comment that stayed true of
 * the prose after it had gone false of the code. The error was conservative
 * (it under-claimed the guard's reach) rather than hazardous, which is precisely
 * why nobody would have re-checked it.
 *
 * ⭐ SO THE ACCURATE STATEMENT IS STRONGER THAN THE ONE IT REPLACES: reverting
 * to a fixed-size boost is now caught in BOTH files rather than blessed by this
 * one. Do not read that as making the header's warning redundant — a red here
 * tells you the bound moved, and only the header tells you which direction is
 * the trap.
 *
 * ⭐ WHY THE GUARD HAD TO CHANGE AT ALL — IT IS TRAP 21, NOT A CONFLICT. This
 * file and that change answer DIFFERENT QUESTIONS under similar names:
 *
 *     this guard  "is the boost's DECLARED px within the height the layout
 *                  RESERVES?"        — a HEIGHT-SAFETY question
 *     the change  "does the boost RENDER at least as large as an ordinary
 *                  title?"           — a LEGIBILITY question
 *
 * Both answers are yes. The guard REDded on neither: its EXTRACTOR matched only
 * a single-quoted literal and the class became a template literal, and its
 * PRICER (`TAILWIND_TEXT_PX`) cannot price a `calc()` at all. Aligning the two
 * questions would have been the wrong fix. So the concepts are named apart: a
 * boost declares its size by one of TWO MECHANISMS, and each is priced on its
 * own terms by `priceBoostSize` below.
 *
 *     FIXED           a named Tailwind size (`text-lg`). px is that number at
 *                     every zoom, because nothing scales it.
 *     COUNTER-SCALED  a `calc(Npx * var(--canvas-label-scale))` token. Its px AT
 *                     THE CAP — the only place this boost applies — is
 *                     `N * MAX_LABEL_COUNTER_SCALE`.
 *
 * Both are still compared against the same reserve, and both can still FAIL:
 * `text-3xl` (30 > 24) and a counter-scaled `calc(18px * ...)` (36 > 24) are
 * both rejected, and each has its own control below. An unrecognised mechanism
 * REDs rather than passing — an unpriced class is an unbounded one.
 *
 * ⚠⚠⚠ AND THE NUMBER THE NEXT LANE MUST NOT LEARN THE HARD WAY:
 *
 *         THE SLACK IN THIS BOUND IS NOW **ZERO PIXELS**.
 *
 * The boost resolves to `typography.nodeTitle` — the SAME token the reserve is
 * computed from — so the comparison is `24 <= 24`. It was `18 <= 24`, i.e. 6px
 * of headroom, and that headroom is gone. **The bound holds EXACTLY, with no
 * margin.** Any increase in the boost's declared px, or any DECREASE in
 * `nodeTitle`'s (which would lower the reserve), breaks it on the same day —
 * there is no longer a step you can take without this file going red. That is
 * intentional and it is the correct trade (a 33% legibility gain on the two
 * anchor cards for headroom that was never a design property, only an
 * arithmetic accident), but it must be VISIBLE, not discovered.
 *
 * ⚠ A degenerate case is admitted deliberately and is stated rather than hidden:
 * when the boost IS `typography.nodeTitle`, this comparison reduces to a value
 * against itself and cannot fail (trap 13b). It is not vacuous overall — the
 * pricer is a pure function and the controls below feed it synthetic classes of
 * BOTH mechanisms and prove each one rejects an oversized boost — but nobody
 * should read a green run here as evidence that the CURRENT configuration was
 * checked against something. What the current configuration is checked against
 * is the browser: `e2e/geometry/heightVsZoom.measure.ts`.
 *
 * ⭐ AND THE HEIGHT NEWS IS GOOD, measured on that probe at this tip rather than
 * argued: because the title now declares the SAME size on both sides of the
 * threshold, the title term's LOD delta is **zero**. The worst single-card LOD
 * shrink across build-vs-buy @1280x800 went **16px -> 12px** (`dec_billing`
 * 333->321, `goal_billing` 173->161, matching the outcome/risk cards exactly),
 * `cardsThatGrew: 0`, against the same 45px sub-row slack. The -16px limb this
 * file's header table attributes to the title is gone; the residual 12px is the
 * un-guarded body-content limb the header already names. **The direction the
 * whole argument rests on is unchanged, and the margin is larger.**
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

/**
 * The class the LOD title boost applies, read from BaseNode's own ternary, with
 * any `${typography.X}` interpolation RESOLVED against the token object.
 *
 * ⚠ BOTH SPELLINGS, AND THAT IS NOT A LOOSENING. This used to match a
 * single-quoted literal only, which is a claim about SYNTAX where the guard's
 * question is about SIZE — so a class written as a template literal read as "the
 * ternary was not found" rather than as a size to price. Widening the shapes it
 * can READ does not widen what it ACCEPTS: everything it reads still goes
 * through `priceBoostSize`, which rejects an oversized or unpriceable class
 * either way.
 *
 * Interpolations are resolved from the imported `typography`, the same object
 * the reserve is read from — so a token renamed or retyped surfaces here as an
 * unresolvable interpolation (a hard error) rather than as a silently unpriced
 * class.
 */
function lodBoostTitleClass(): string {
  const src = readFileSync(resolve(REPO_ROOT, 'src/canvas/nodes/BaseNode.tsx'), 'utf8')
  const m = /lodBoostTitle\s*\n?\s*\?\s*(?:'([^']*)'|`([^`]*)`)/.exec(src)
  expect(m, 'the lodBoostTitle ternary was not found in BaseNode — this guard is measuring nothing').not.toBeNull()
  const raw = m![1] ?? m![2]!
  return raw.replace(/\$\{\s*typography\.([A-Za-z0-9_$]+)\s*\}/g, (_all, name: string) => {
    const value = (typography as Record<string, string | undefined>)[name]
    expect(value, `the boost interpolates typography.${name}, which does not exist — this guard cannot price what it cannot resolve`).toBeDefined()
    return value!
  })
}

/**
 * The declared px a boost class resolves to AT THE CAP, and by WHICH MECHANISM.
 *
 * ⭐ A PURE FUNCTION OVER THE CLASS STRING, deliberately, so the controls below
 * can feed it synthetic classes of both mechanisms and prove each arm rejects an
 * oversized boost. A pricer only ever exercised on the one class the product
 * currently ships is a pricer nobody has tested (trap 13b).
 *
 * Returns `null` when the class declares no size this guard can price — which
 * the caller turns into a RED, never a pass. An unpriced class is an unbounded
 * one, and that rule is the reason this file exists.
 *
 * ⭐⭐ IT FAILS CLOSED, AND THAT PROPERTY IS WHY WIDENING THE READER LATER IS
 * SAFE. Verified by execution against ten synthetic classes in independent
 * review, not by reading this function:
 *
 *   · it REDs at **25px** as well as at the 36px the controls below use, so the
 *     discrimination is a property of the comparison and not an artefact of the
 *     one oversized case this file happens to name;
 *   · **every shape it cannot price returns `null`, and `null` is a RED** —
 *     including the two soft spots a reader would expect to be holes: a `calc()`
 *     with **reversed operands** (`var(...) * 12px`) and Tailwind's
 *     **underscore-for-space** arbitrary-value syntax. Neither is silently
 *     priced at zero, and neither passes.
 *
 * So the failure mode of an unrecognised spelling is a build that stops, never
 * a bound that quietly stops being checked. If you teach `lodBoostTitleClass`
 * to read a new shape, that property is the thing you must not break.
 *
 * ⚠⚠ ONE REAL BLIND SPOT, RECORDED BECAUSE IT CHANGES WHAT THE DEFENCE RESTS
 * ON. This function **short-circuits on the calc arm**: a class carrying BOTH a
 * counter-scaled token AND a larger named size (`... calc(12px*var(...)) ...
 * text-3xl`) is priced at 24px and passes. Demonstrated by an applied mutant in
 * review — **this file stays green (4 passed)**.
 *
 * That is not an unguarded hole, and the layering genuinely holds: the raw
 * `text-3xl` is caught by `canvas/__tests__/canvasTextCounterScale.census.spec.ts`,
 * whose `KNOWN_FIXED` set is asserted EXACTLY, so a new un-counter-scaled size
 * anywhere under the transform REDs there.
 *
 * ⛔ BUT THE CONSEQUENCE MUST BE STATED WHERE THE PRICER LIVES, NOT ONLY WHERE
 * THE CENSUS DOES: **this pricer's safety now depends on the census's SCOPE.**
 * If anyone narrows that census — excludes `nodes/`, drops the exact-set
 * assertion, or stops walking the in-transform directories — this blind spot
 * becomes live and nothing in this file will notice. Two guards covering one
 * gap is defence in depth only for as long as both are pointed at it (CLAUDE.md
 * trap 21: naming them apart is right, and it makes each one's dependence on
 * the other invisible unless it is written down).
 */
export function priceBoostSize(
  boostClass: string,
): { px: number; mechanism: 'fixed' | 'counter-scaled'; spelling: string } | null {
  // COUNTER-SCALED first: a `calc()` token also contains no named size, so order
  // is not ambiguous — but stating it removes the question.
  const calc = /calc\(\s*(\d+(?:\.\d+)?)px\s*\*\s*var\(--canvas-label-scale/.exec(boostClass)
  if (calc) {
    return {
      px: Number(calc[1]) * MAX_LABEL_COUNTER_SCALE,
      mechanism: 'counter-scaled',
      spelling: `calc(${calc[1]}px * var(--canvas-label-scale))`,
    }
  }
  const named = boostClass.split(/\s+/).find((c) => c in TAILWIND_TEXT_PX)
  if (named) return { px: TAILWIND_TEXT_PX[named]!, mechanism: 'fixed', spelling: named }
  return null
}

describe('LOD title boost is bounded BY THE RESERVED HEIGHT, not merely small', () => {
  it('the boosted title is no larger than the size the layout reserves for', () => {
    const reservedPx = declaredNodeTitlePx() * MAX_LABEL_COUNTER_SCALE
    const boostClass = lodBoostTitleClass()

    const priced = priceBoostSize(boostClass)
    expect(
      priced,
      `the LOD title boost uses a text size this guard cannot price ("${boostClass}"). Add a named size to TAILWIND_TEXT_PX with its px, or spell it as a counter-scaled calc() token — an unpriced class is an unbounded one.`,
    ).not.toBeNull()

    expect(
      priced!.px,
      `the LOD title boost (${priced!.spelling}, ${priced!.mechanism}) declares ${priced!.px}px against the ${reservedPx}px the layout reserves. Below LABEL_LEGIBLE_ZOOM the goal and decision cards would grow past their row band and overlap the row beneath — the defect #1123 closes, arriving through the other door.`,
    ).toBeLessThanOrEqual(reservedPx)
  })

  /**
   * ⚠⚠ THE SLACK, ASSERTED RATHER THAN DESCRIBED. The header says this bound now
   * holds EXACTLY. A sentence saying so is a sentence that goes stale; this is
   * the same statement in a form that REDs when it stops being true.
   *
   * It is pinned in BOTH directions on purpose (CLAUDE.md 22f — the honest way
   * to carry a known-tight bound is a test that fails if the set grows OR
   * shrinks). If the slack ever becomes POSITIVE again, someone has either
   * shrunk the boost — which reopens the 25% shrink this file's header warns
   * about — or raised `nodeTitle`, which moves the reserve. Either is a decision
   * that must be taken deliberately, here, not discovered later in a screenshot.
   */
  it('THE SLACK IS ZERO — the bound holds exactly, and that is stated, not discovered', () => {
    const reservedPx = declaredNodeTitlePx() * MAX_LABEL_COUNTER_SCALE
    const priced = priceBoostSize(lodBoostTitleClass())!
    expect(
      reservedPx - priced.px,
      'the headroom between the LOD title boost and the height the layout reserves has MOVED. ' +
        'It was 6px (text-lg 18 vs 24) until 2 Sep 2026 and is 0px by design since. ' +
        'If this is now positive, check you have not reinstated a fixed-size boost — read this file\'s header before "fixing" it.',
    ).toBe(0)
    expect(priced.mechanism, 'the boost stopped being counter-scaled — below the floor that is a SHRINK, not a boost').toBe('counter-scaled')
  })

  it('CONTRAST CONTROL: the comparison discriminates, in BOTH mechanisms', () => {
    // Without this, a guard whose extraction silently returned '' would agree
    // forever (trap 13b — a guard agreeing with itself). And since the shipped
    // boost now resolves to the same token as the reserve, the live comparison
    // is 24 <= 24 and CANNOT fail — so the pricer's discrimination has to be
    // proven on synthetic inputs or it is proven nowhere.
    const reservedPx = declaredNodeTitlePx() * MAX_LABEL_COUNTER_SCALE
    expect(reservedPx).toBe(24)

    // FIXED mechanism — the original control, unchanged.
    expect(priceBoostSize('text-lg foo')).toEqual({ px: 18, mechanism: 'fixed', spelling: 'text-lg' })
    expect(priceBoostSize('text-lg')!.px).toBeLessThanOrEqual(reservedPx)
    expect(priceBoostSize('text-3xl')!.px).toBeGreaterThan(reservedPx)

    // COUNTER-SCALED mechanism — the arm added 2 Sep 2026. An oversized
    // counter-scaled boost must be rejected exactly as an oversized fixed one
    // is: 18px at the 2x cap is 36px, half again over the reserve.
    expect(priceBoostSize('text-[length:calc(12px*var(--canvas-label-scale,1))]')!.px).toBe(24)
    expect(priceBoostSize('text-[length:calc(18px*var(--canvas-label-scale,1))]')!.px).toBe(36)
    expect(priceBoostSize('text-[length:calc(18px*var(--canvas-label-scale,1))]')!.px).toBeGreaterThan(reservedPx)

    // An unpriceable class is a RED, never a pass.
    expect(priceBoostSize('font-semibold text-text-header break-words')).toBeNull()

    // And both extractors returned something real.
    expect(lodBoostTitleClass().length).toBeGreaterThan(0)
    expect(declaredNodeTitlePx()).toBeGreaterThan(0)

    // The interpolation really was resolved — otherwise every assertion above
    // would be pricing the literal text "${typography.nodeTitle}".
    expect(lodBoostTitleClass()).not.toContain('${')
    expect(lodBoostTitleClass()).toContain('--canvas-label-scale')
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
