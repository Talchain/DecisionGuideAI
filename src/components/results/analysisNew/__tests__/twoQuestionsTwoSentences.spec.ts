/**
 * ⭐⭐ THE CHECKLIST AND THE COMPARISON DO NOT SAY THE SAME THING.
 *
 * ⛔ THE DEFECT, READ OFF THE DEPLOYED SURFACE (served `fd992149`, 20 Sep 2026).
 * `WhatWeChecked` and `OptionsComparison` rendered the SAME paragraph, byte for
 * byte, in one scroll. The comment at the second site defended it — *"one
 * wording covers one fact and the two cannot drift"* — and it was half right.
 * The wording could not drift. It was not one fact.
 *
 * `WhatWeChecked`'s own header states the division: it answers WHAT THE RUN
 * CHECKED, the glance answers WHAT THE RUN FOUND, and the comparison answers
 * HOW TO READ THIS LIST. Three questions, named apart deliberately. A compound
 * sentence served to two of them is how a correctly-divided surface still reads
 * as a repetition — CLAUDE.md trap 21 reaching the copy layer.
 *
 * ⚠ WHY A TARGETED SPEC AND NOT JUST THE CENSUS. `firstViewportCensus` exists
 * to catch one claim stated twice, and it could not see this pair: `SectionShell`
 * unmounts a closed section and the census never opened one, so only the
 * always-visible half was ever in the DOM it read. That blind spot is closed,
 * but a census is a whole-surface instrument — it reports THAT something repeats,
 * not which two concepts were collapsed. This pins the concepts.
 */

import { describe, it, expect } from 'vitest'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

/**
 * ⚠ A RECORD, NOT A FIXTURE. This is the sentence the product actually emitted
 * on the dated build above. It is here so the split cannot quietly lose a
 * clause, and it is APPEND-ONLY: if the copy changes again, add the new string,
 * never edit this one. A historic capture is evidence (CLAUDE.md trap 14b).
 */
const AS_SHIPPED_20260920 =
  'Olumi could not confirm which option is most likely on this run, so any ordering you see is unconfirmed. It is not a finding that the options are level.'

describe('the checklist and the comparison answer different questions', () => {
  const { meaning, orderingCaveat } = COPY.checks.leader_not_assessed

  it('states two different sentences, neither containing the other', () => {
    expect(meaning).not.toBe(orderingCaveat)
    expect(meaning).not.toContain(orderingCaveat)
    expect(orderingCaveat).not.toContain(meaning)
  })

  /**
   * ⚠ THE LOAD-BEARING HALF OF EACH, named by the original's own note. Without
   * "could not confirm" the checklist row reads as an all-clear; without the
   * level-options denial a list with no figures reads as a tie. A split that
   * dropped either would satisfy the sentence above completely and be the
   * mirror defect (trap 22b — a corpus that tests one direction is a guard
   * watching one door).
   */
  it('keeps the clause that stops each one being misread', () => {
    expect(meaning).toContain('could not confirm')
    expect(orderingCaveat).toContain('not a finding that the options are level')
  })

  /**
   * ⭐ NO FACT IS LOST. Every clause of the shipped sentence survives across the
   * two, under the section that owns it. Compared on words rather than on
   * punctuation, because the split necessarily re-joins the clauses differently.
   */
  it('carries every clause of the sentence as shipped', () => {
    const words = (s: string) =>
      new Set(s.toLowerCase().replace(/[.,]/g, '').split(/\s+/).filter(Boolean))
    const before = words(AS_SHIPPED_20260920)
    const after = new Set([...words(meaning), ...words(orderingCaveat)])
    // `any` and `so` are connectives the re-join drops; nothing else may go.
    const lost = [...before].filter((w) => !after.has(w) && !['any', 'so'].includes(w))
    expect(lost).toEqual([])
  })

  /**
   * ⛔ THE CONTRAST CONTROL. Without this, the test above passes on a "split"
   * that simply assigned the whole original sentence to both keys — every word
   * present, every clause present, and the defect entirely intact.
   */
  it('has not merely copied the shipped sentence into both halves', () => {
    expect(meaning).not.toBe(AS_SHIPPED_20260920)
    expect(orderingCaveat).not.toBe(AS_SHIPPED_20260920)
    expect(meaning.length + orderingCaveat.length).toBeLessThan(
      AS_SHIPPED_20260920.length * 2,
    )
  })
})
