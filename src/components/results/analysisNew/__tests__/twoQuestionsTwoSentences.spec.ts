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

/**
 * ⛔⛔ THE POPULATION THE FIRST SPLIT FORGOT — and the only reason it is written
 * down is that a pre-existing guard REDed on it in CI.
 *
 * `orderingCaveat` renders at ONE site, gated on `noneNumbered`: every option
 * analysed and not one of them numbered. `meaning` renders on the checklist row
 * for every withheld run, numbered or not. So the two strings do NOT cover the
 * same population, and a clause moved from `meaning` into `orderingCaveat` is
 * not relocated — on a run that prints figures it is DELETED.
 *
 * That run is real and captured: `0db2eb0a` (17:50Z, `complete_current`) has
 * separation `separated`, robustness `high`, four win probabilities on the
 * wire, and `leader_claim.permitted: false` with `constraint_verdict_withheld`.
 * Four bars draw and no leader may be named. If the panel says nothing about
 * the standing of that ordering, the bars are the only claim on screen.
 *
 * ⚠ CLAUDE.md trap 23 in one change: the metric the fix was written against
 * (the same paragraph twice in one scroll) would have read as fixed, while the
 * honesty the paragraph existed for was gone on the other half of the domain.
 */
describe('the split is by population, so neither run loses a fact', () => {
  const { meaning, orderingCaveat } = COPY.checks.leader_not_assessed

  it('the string that renders WITH figures still says the ordering is unconfirmed', () => {
    expect(meaning.toLowerCase()).toContain('unconfirmed')
  })

  it('the string that renders WITHOUT figures still denies they are level', () => {
    expect(orderingCaveat.toLowerCase()).toContain('not a finding that the options are level')
  })

  /**
   * ⭐ AND THE TWO SHARE NO CLAUSE, which is what stops the repair reinstating
   * the repetition. On a silent list BOTH render, so any clause in both is a
   * fact stated twice on exactly the run Paul screenshotted. Compared on
   * five-word shingles rather than on whole strings, because the defect that
   * started this was a shared SENTENCE inside two different paragraphs — an
   * equality check could not see it.
   */
  it('shares no clause, so the silent-list run never reads one fact twice', () => {
    const shingles = (s: string) => {
      const w = s.toLowerCase().replace(/[.,—]/g, '').split(/\s+/).filter(Boolean)
      return new Set(w.slice(0, Math.max(0, w.length - 4)).map((_, i) => w.slice(i, i + 5).join(' ')))
    }
    const a = shingles(meaning)
    const b = shingles(orderingCaveat)
    const shared = [...a].filter((g) => b.has(g))
    expect(shared).toEqual([])
  })

  /**
   * ⛔ THE CONTRAST CONTROL for the shingle check — without it a bug that made
   * `shingles()` return an empty set would pass this describe block silently,
   * which is the guard-agreeing-with-itself shape (CLAUDE.md trap 13).
   */
  it('PRECONDITION: the shingle instrument can see a repeat when there is one', () => {
    const shingles = (s: string) => {
      const w = s.toLowerCase().replace(/[.,—]/g, '').split(/\s+/).filter(Boolean)
      return new Set(w.slice(0, Math.max(0, w.length - 4)).map((_, i) => w.slice(i, i + 5).join(' ')))
    }
    const a = shingles(AS_SHIPPED_20260920)
    const b = shingles(`Something else entirely. ${AS_SHIPPED_20260920}`)
    expect([...a].filter((g) => b.has(g)).length).toBeGreaterThan(0)
  })
})
