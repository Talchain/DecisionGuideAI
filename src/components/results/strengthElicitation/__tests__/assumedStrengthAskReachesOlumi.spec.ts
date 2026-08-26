/**
 * The most prominent intervention must reach something that can actually change
 * the model.
 *
 * ⚠ WHY THIS EXISTS. `AssumedStrengthCard` renders at panel top level — zero
 * clicks, outside the evidence collapse — and carries the most specific sentence
 * the product produces (the alternative winner, the measured switch rate, the
 * rank among unconfirmed strengths). Its button pointed at the Inspector, whose
 * every edge setter is `'disabled'` and whose own mounted copy says these changes
 * "cannot yet be saved to the shared model". The product's loudest ask ended in
 * nothing.
 *
 * ⚠ WHAT IS ASSERTED, AND WHAT DELIBERATELY IS NOT. A live probe showed the
 * router elects the graph-edit path for a fully-specified instruction naming both
 * endpoints and a number, and does NOT elect it for a vague one. So the draft's
 * SHAPE is load-bearing and is pinned here. Whether the router elects it on any
 * given turn is runtime behaviour — one trial is existence, not reliability — so
 * nothing here asserts the edit succeeds.
 */
import { describe, it, expect } from 'vitest'
import { ASSUMED_STRENGTH_ACTION, assumedStrengthAskDraft, ASSUMED_STRENGTH_ASK_CONTEXT } from '../assumedStrengthCopy'

const SEL = { fromLabel: 'Discount depth', toLabel: 'Series B fundability' }

describe('the assumed-strength act asks Olumi, and asks specifically', () => {
  it('the label promises the ASK, not the outcome', () => {
    expect(ASSUMED_STRENGTH_ACTION).toBe('Ask Olumi to set this strength')
    // It must not claim the strength is set, nor that the analysis updates.
    expect(/\bwill\b|\bupdates?\b|\bdone\b/i.test(ASSUMED_STRENGTH_ACTION)).toBe(false)
  })

  it('names BOTH endpoints verbatim — the shape the router elects', () => {
    const draft = assumedStrengthAskDraft(SEL)
    expect(draft).toContain('Discount depth')
    expect(draft).toContain('Series B fundability')
    // An explicit number: the vague form ("set X to low") did not reach the edit
    // path in the probe; the explicit form did.
    expect(/\d/.test(draft), `draft carries no explicit value: "${draft}"`).toBe(true)

    // ⚠ AND IT IS IN THE INTERVAL THE CONSUMER ENFORCES. "a digit exists" was
    // written against the failure mode in hand — a VAGUE draft ("set X to low")
    // that the router declined — and a guard written against the failure mode
    // instead of against the spec is how this estate has shipped a defect and
    // then its exact inverse. PLoT's gate is `value < 0 || value > 1`, which is
    // SIGN-SYMMETRIC, so `8`, `-3` and `0.52` all satisfied `/\d/` while only
    // one of them is a strength. Measured before this was written: mutating the
    // drafted value to 8, to -3 and to 0.52 each left the suite GREEN 20/20.
    const values = [...draft.matchAll(/-?\d+(?:\.\d+)?/g)].map(m => Number(m[0]))
    expect(values.length, `no parseable value in draft: "${draft}"`).toBeGreaterThan(0)
    for (const v of values) {
      expect(v, `drafted value ${v} is outside [0,1]: "${draft}"`).toBeGreaterThanOrEqual(0)
      expect(v, `drafted value ${v} is outside [0,1]: "${draft}"`).toBeLessThanOrEqual(1)
    }
  })

  it('DISCRIMINATES by selection — it is not a fixed string', () => {
    const other = assumedStrengthAskDraft({ fromLabel: 'Hiring pace', toLabel: 'Runway' })
    const first = assumedStrengthAskDraft(SEL)
    expect(other).not.toBe(first)
    expect(other).toContain('Hiring pace')
    expect(other).not.toContain('Discount depth')
  })

  it('the context line carries what the draft cannot: ownership and the rerun', () => {
    // The number is the user's, not Olumi's suggestion presented as fact.
    expect(/your own judgement/i.test(ASSUMED_STRENGTH_ASK_CONTEXT)).toBe(true)
    // The edit response carries no before/after receipt, so the drawer must not
    // let the user believe the analysis refreshes itself.
    expect(/rerun/i.test(ASSUMED_STRENGTH_ASK_CONTEXT)).toBe(true)
  })

  /*
   * ⭐ THE MIRROR CHECK. The draft must not assert a CURRENT strength. The
   * selection carries no numeric value — only whether it is Olumi's estimate or
   * unset — so any "currently X" phrasing would be invented.
   */
  it('does not assert a before-value it does not have', () => {
    const draft = assumedStrengthAskDraft(SEL)
    expect(/currently|at the moment|is now|from \d/i.test(draft), `draft asserts a before-value: "${draft}"`).toBe(false)
  })
})
