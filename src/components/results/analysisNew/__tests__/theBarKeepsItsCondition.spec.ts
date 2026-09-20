/**
 * ⭐⭐ THE BAR'S CAPTION NAMES THE QUANTITY THE BAR DRAWS.
 *
 * ⛔ THE DEFECT, AND THE ORACLE IS THE PRODUCER'S OWN DECLARATION. "What would
 * change your mind" draws `switch_probability`, which ISL declares as
 * *"Proportion of MC samples where alternative wins WHEN EDGE IS WEAK"*
 * (`src/models/response_v2.py:569-575`). It is CONDITIONAL on the link being
 * weak.
 *
 * The caption read *"Bars show how often each assumption changed the answer."*
 * That states an UNCONDITIONAL rate and attributes the change to the assumption
 * itself — the reading `strengthElicitation/assumedStrengthCopy.ts` bans in as
 * many words: *"the measurement is about what happens IF the link is weak, not
 * about what setting a number does."*
 *
 * ⭐ WITNESSED ON THE DEPLOYED SURFACE (served `fd992149`, 20 Sep 2026). Two
 * bars both read 52%, under that caption, above a row sentence reading *"In the
 * runs where that link came out weak, Hire One Senior Developer was the
 * stronger option 52% of the time."* Same number, two quantities, one bar — and
 * as an unconditional "how much this mattered" the twin 52% read as a broken
 * instrument rather than as two legitimate conditional rates.
 *
 * ⚠ THIS SPEC IS ABOUT THE CLAIM, NOT THE WORDING. It asserts the condition is
 * carried and that the banned unconditional form is gone — never the exact
 * sentence, which the copy layer may reword. A guard over a whole sentence
 * would RED on every edit and teach the next author to update it without
 * reading why (CLAUDE.md trap 14).
 */

import { describe, it, expect } from 'vitest'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

describe('the flip-risk caption', () => {
  const caption = COPY.disclosure.flipCaption

  it('carries the condition the measurement is conditional on', () => {
    expect(caption.toLowerCase()).toContain('weak')
  })

  /**
   * ⛔ THE BANNED FORM, PINNED AS AN ABSENCE. Without this the test above
   * passes on a caption that mentions "weak" while still asserting the
   * assumption changed the answer — the two are not the same claim, and the
   * defect lived entirely in the second.
   */
  it('does not attribute the change to the assumption itself', () => {
    expect(caption.toLowerCase()).not.toContain('changed the answer')
    expect(caption.toLowerCase()).not.toContain('would change')
  })

  /**
   * ⚠ EVERY EARLIER RULING ON THIS LINE SURVIVES. The 8 Sep no-contest ruling
   * retired placings and contest framing; past tense is required because the
   * runs already happened. A fix that restored the condition and reopened
   * either of those would be the mirror defect (trap 22b).
   */
  it('keeps past tense and states no placing', () => {
    expect(caption.toLowerCase()).not.toMatch(/\b(ahead|winner|winning|beat|best|leading)\b/)
    expect(caption.toLowerCase()).not.toContain('will ')
    expect(caption.toLowerCase()).toContain('was')
  })

  /**
   * ⭐ ONE QUANTITY, TWO SURFACES. The row sentence beneath the bars already
   * carried the condition correctly. Both must describe the same thing, or the
   * reader cannot tell which one the bar is.
   */
  it('describes the same quantity as the row sentence beneath it', () => {
    expect(caption.toLowerCase()).toContain('stronger')
  })
})
