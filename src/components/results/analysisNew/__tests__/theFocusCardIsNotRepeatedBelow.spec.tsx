/**
 * The promoted coaching card keeps every affordance it had.
 *
 * ── THIS FILE ASSERTED THE OPPOSITE UNTIL 5 Sep 2026 ───────────────────────
 * Paul witnessed the same ~40-word producer paragraph twice on one screen —
 * once in the glance card, once under "Strengthen the reasoning". I fixed it by
 * excluding the promoted recommendation from the list below. An independent
 * review refuted that, and it was right.
 *
 * ── WHY THE EXCLUSION WAS WORSE THAN THE DUPLICATION ───────────────────────
 * The two surfaces are not interchangeable. The glance card is a POINTER: icon,
 * label, method chip, one sentence, one click. The Strengthen card carries the
 * severity, the method as a dispatchable control, the science grounding, "show
 * on canvas", "I disagree", the source line — and DISMISS.
 *
 * And dismiss is load-bearing in a way that makes the regression structural
 * rather than cosmetic: **retiring a recommendation is the only thing that
 * advances `glancePrimary`.** Exclude the promoted card and its dismiss becomes
 * unreachable, so the focus card can never advance — one recommendation pinned
 * to the top of the panel for the life of the run.
 *
 * I had already written the argument down, for the n=1 case: *"the dismissal is
 * how a human stays authoritative over the coaching"*. I did not notice it
 * applies at every n. That is the finding.
 *
 * ── WHAT IS STILL OPEN ─────────────────────────────────────────────────────
 * The duplication is real and unfixed. It costs a repeated paragraph to a
 * reader who OPENS the section (it rests closed). The correct fix is the
 * Focus/Also split the design pack draws, where the affordances live on the
 * focus card — an IA change, with Paul. Recording it here rather than in a
 * comment nobody greps.
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
