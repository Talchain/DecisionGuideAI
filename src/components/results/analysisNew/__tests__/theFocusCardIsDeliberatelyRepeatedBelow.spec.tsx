/**
 * THE FOCUS CARD IS DELIBERATELY REPEATED BELOW — and this file pins exactly
 * that. The repetition is a KNOWN, ACCEPTED state, not an open bug drifting
 * towards a quiet fix.
 *
 * ── ⚠ RENAMED 6 Sep 2026, BECAUSE THE NAME ASSERTED THE OPPOSITE ───────────
 * This file was `theFocusCardIsNotRepeatedBelow.spec.tsx` while its ruling
 * case pinned that the promoted card is NOT removed from the list below — i.e.
 * that it IS repeated. Anyone grepping the filename to ask "is the duplicate
 * coaching closed?" read the name and concluded yes. It is not closed. A name
 * that claims more than the code does is this estate's most expensive defect
 * class, and a spec filename is the worst place for one: it is read far more
 * often than it is opened.
 *
 * ── WHAT THIS FILE PINS ────────────────────────────────────────────────────
 * `selectAlsoWorthDoing` returns its input list UNCHANGED, at every arity: the
 * promoted (focus) recommendation stays in the "also worth doing" list beneath
 * the glance card. The tests below are the guard that stops the exclusion
 * being re-attempted. They are NOT evidence that the duplication is fixed.
 *
 * ── WHY THE EXCLUSION WAS WORSE THAN THE DUPLICATION ───────────────────────
 * Paul witnessed the same ~40-word producer paragraph twice on one screen —
 * once in the glance card, once under "Strengthen the reasoning". It was first
 * fixed by excluding the promoted recommendation from the list below. An
 * independent review refuted that, and it was right.
 *
 * The two surfaces are not interchangeable. The glance card is a POINTER:
 * icon, label, method chip, one sentence, one click. The Strengthen card
 * carries the severity, the method as a dispatchable control, the science
 * grounding, "show on canvas", "I disagree", the source line — and DISMISS.
 *
 * And dismiss is load-bearing in a way that makes the regression structural
 * rather than cosmetic: **retiring a recommendation is the only thing that
 * advances `glancePrimary`.** Exclude the promoted card and its dismiss
 * becomes unreachable, so the focus card can never advance — one
 * recommendation pinned to the top of the panel for the life of the run.
 *
 * The argument was already written down for the n=1 case: *"the dismissal is
 * how a human stays authoritative over the coaching"*. That it applies at
 * every n went unnoticed. That is the finding.
 *
 * ── WHERE THE DUPLICATE IS PRODUCED ────────────────────────────────────────
 * ONE `Recommendation` object is rendered twice. Symbols are the anchor; the
 * line numbers were verified at staging `711e85c2` and WILL drift — re-derive
 * them, do not inherit them.
 *
 *   1. `AnalysisNewTabBody.tsx` `glancePrimary` (~:385-391) is passed as
 *      `why: glancePrimary.signal` (~:557-572) and rendered by
 *      `AtAGlance.tsx` as `primaryIntervention.why` (~:918-920).
 *   2. The SAME object is still in `alsoWorthDoing`
 *      (`selectAlsoWorthDoing`, ~:393-396), handed to
 *      `<StrengthenTheReasoning interventions={alsoWorthDoing}>` (~:702) and
 *      rendered by `StrengthenTheReasoning.tsx` as
 *      `strengthenWhyLine(rec.signal, rec.whyNow)` (~:699).
 *
 * The two are BYTE-IDENTICAL whenever the producer sends no `signal` of its
 * own, which is the ordinary case: `buildRecommendations.ts` (~:368-369) sets
 * `signal: item.signal ?? item.body` and `whyNow: item.body`, so both collapse
 * to `item.body`; `strengthenWhyLine` (`analysisNewCopy.ts` ~:1097-1100)
 * returns `signal` alone when `whyNow === signal`. When the producer DOES
 * carry its own `signal` (today only the deterministic stale-rerun nudge), the
 * Strengthen line is `signal + ' ' + whyNow` — a superset that still repeats
 * the glance paragraph verbatim, but is not byte-identical. Both cases repeat;
 * only the first repeats exactly.
 *
 * ── WHAT IS STILL OPEN ─────────────────────────────────────────────────────
 * The duplication is real and unfixed. It costs a repeated paragraph to a
 * reader who OPENS the section (it rests closed). The correct fix is the
 * Focus/Also split the design pack draws, where the affordances live on the
 * focus card — an IA change, with Paul. Recorded here rather than in a comment
 * nobody greps.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { selectAlsoWorthDoing } from '../AnalysisNewTabBody'

type Rec = { id: string; signal: string }
const REC = (id: string, signal: string) => ({ id, signal }) as unknown as Rec

const A = REC('r1', 'Six options, all one funding channel — the frame may be too narrow.')
const B = REC('r2', 'Four factors still sit on Olumi’s estimates.')
const C = REC('r3', 'The leading option is sensitive to one relationship.')

describe('the promoted card keeps every affordance it had', () => {
  it('CONTROL: the selector returns the list it was given', () => {
    // Without this, every assertion below could pass against a selector that
    // had been reduced to returning a constant.
    expect(selectAlsoWorthDoing([A, B, C] as never, null).map((r) => r.id)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
  })

  it('THE RULING: the promoted card is NOT removed from the list below', () => {
    expect(selectAlsoWorthDoing([A, B, C] as never, A as never).map((r) => r.id)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
  })

  it('DISCRIMINATOR: a lone recommendation is likewise untouched', () => {
    // The case the earlier fix already carved out. It must not diverge again:
    // one rule, every arity.
    expect(selectAlsoWorthDoing([A] as never, A as never).map((r) => r.id)).toEqual(['r1'])
  })

  it("returns a fresh array, never the caller's own", () => {
    // `StrengthenTheReasoningProps.interventions` is mutable, so handing over
    // the view model's array would let a consumer mutate state in place — and
    // a `readonly` return is a type error at the mount, which the LOCAL
    // typecheck cannot see because it excludes tests.
    const input = [A, B] as never as { id: string }[]
    const out = selectAlsoWorthDoing(input, null)
    expect(out).not.toBe(input)
    expect(out).toEqual(input)
  })
})
