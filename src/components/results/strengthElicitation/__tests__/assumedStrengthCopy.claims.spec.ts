/**
 * MECHANICAL CLAIM PROHIBITIONS. A comment is not a guard.
 *
 * Each prohibition below is paired with the PRODUCER CITATION that makes it a
 * prohibition, so the reason survives independently of whoever wrote the copy.
 * The copy module's header states these in prose; this file is what stops the
 * prose from drifting away from the strings.
 *
 * Why this can be a closed enumeration rather than an outside corpus: the copy
 * is TEMPLATED, so the sentence space is finite and generated here from the
 * types. There is no free generation on this path and therefore no predicate
 * breadth to bound — the corpus problem is sidestepped by construction, not
 * declared solved.
 */
import { describe, it, expect } from 'vitest'
import {
  ASSUMED_STRENGTH_ACTION,
  ASSUMED_STRENGTH_ASK,
  ASSUMED_STRENGTH_REFUSAL_COPY,
  ASSUMED_STRENGTH_TITLE,
  assumedStrengthLead,
  assumedStrengthOthers,
  assumedStrengthWhy,
} from '../assumedStrengthCopy'
import type { AssumedStrengthSelection } from '../selectAssumedStrengthToResolve'

const sel = (over: Partial<AssumedStrengthSelection> = {}): AssumedStrengthSelection => ({
  edgeId: 'e1',
  fromLabel: 'Customer demand',
  toLabel: 'Revenue growth',
  switchProbability: 0.35,
  alternativeWinnerLabel: 'Consolidate',
  ...over,
})

/** EVERY sentence this module can emit, enumerated from the types. */
function allSentences(): string[] {
  const out: string[] = [
    ASSUMED_STRENGTH_TITLE,
    ASSUMED_STRENGTH_ASK,
    ASSUMED_STRENGTH_ACTION,
    ...Object.values(ASSUMED_STRENGTH_REFUSAL_COPY).filter((s): s is string => s !== null),
  ]
  for (const alt of ['Consolidate', null]) {
    const s = sel({ alternativeWinnerLabel: alt })
    out.push(assumedStrengthLead(s), assumedStrengthWhy(s))
  }
  for (const n of [0, 1, 2, 5]) {
    const o = assumedStrengthOthers(n)
    if (o !== null) out.push(o)
  }
  return out
}

describe('assumedStrengthCopy — the claim boundary, held mechanically', () => {
  it('enumerates a NON-EMPTY sentence set (this guard cannot pass vacuously)', () => {
    // Without this, every prohibition below would pass over an empty array.
    expect(allSentences().length).toBeGreaterThanOrEqual(10)
  })

  it.each([
    // (a) UNCONDITIONAL / ISOLATING claims. `switch_probability` is declared by
    // ISL as "Proportion of MC samples where alternative wins WHEN EDGE IS WEAK"
    // (response_v2.py:569-575) — a conditional partition in which every other
    // edge is also varying. It cannot attribute the outcome to this edge alone.
    ['most important', /most important/i],
    ['decides', /\bdecides\b/i],
    ['the deciding', /the deciding/i],
    ['biggest driver', /biggest driver/i],
    ['drives the decision', /drives the decision/i],
    // (b) PROMISED CONSEQUENCE. The measurement is about what happens IF the
    // link is weak, never about what SETTING a number does. Whether the answer
    // moves is what the rerun is for.
    // ⚠ THIS PROHIBITION GUARDS TWO OPPOSITE HARMS AND NEEDS TWO SHAPES, NOT
    // ONE WINDOW. The banned thing is an ASSERTION that the answer will move.
    // A sentence that DEFERS the question to the rerun ("see whether it changes
    // the answer") is not a weaker version of that claim — it is the opposite
    // of it, and it is the copy we want. A first cut of this guard matched the
    // bare substring "changes the answer" and REDed on the honest deferral; the
    // fix is to name the assertive constructions, NOT to carve out our own
    // string, which would have narrowed the guard until it agreed with itself.
    ['will change the answer', /will change the answer/i],
    ['this changes the answer', /this changes the answer/i],
    ['would change your decision', /would change your decision/i],
    ['is guaranteed to', /guaranteed to/i],
    // (c) EVPI VOCABULARY — under a live ISL ban ("EVPI user-facing language
    // remains banned pending doctrine", science-validation REPORT.md §5) and
    // belonging to a different quantity in different units.
    ['value of information', /value of information/i],
    ['worth learning', /worth learning/i],
    ['EVPI', /\bEVPI\b/],
    ['expected value', /expected value/i],
  ])('never says %s', (_label, banned) => {
    for (const s of allSentences()) expect(s).not.toMatch(banned)
  })

  it('the ask DEFERS the consequence to the rerun rather than promising it', () => {
    // The positive twin of the prohibition above. The ban catches a sentence
    // rewritten INTO a promise; this catches the deferral being quietly taken
    // OUT — "re-run to see it change the answer" would pass every ban and still
    // be the defect. One without the other leaves half the door open.
    expect(ASSUMED_STRENGTH_ASK).toMatch(/\bwhether\b/i)
    expect(ASSUMED_STRENGTH_ASK).toMatch(/re-run/i)
  })

  it('never prints the ASSUMED weight as if it were a measurement', () => {
    // 0.5 / 0.3 are placeholders. Rendering "currently 50%" would be the exact
    // defect edgeValueProvenance exists to stop.
    for (const s of allSentences()) {
      expect(s).not.toMatch(/\b50%/)
      expect(s).not.toMatch(/\b30%/)
    }
  })

  it('renders ONLY the measured switch probability as a number', () => {
    const s = assumedStrengthWhy(sel({ switchProbability: 0.42 }))
    expect(s).toContain('42%')
    // Exactly one percentage in the sentence — no second number to confuse it.
    expect(s.match(/\d+%/g)).toHaveLength(1)
  })

  it('keeps the claim CONDITIONAL on the link being weak', () => {
    // The conditional is not a hedge bolted on; it is what was measured.
    for (const alt of ['Consolidate', null]) {
      expect(assumedStrengthWhy(sel({ alternativeWinnerLabel: alt }))).toMatch(/came out weak/i)
    }
  })

  it('names the alternative winner ONLY when the producer supplied one', () => {
    expect(assumedStrengthWhy(sel({ alternativeWinnerLabel: 'Consolidate' }))).toContain('Consolidate')
    const noAlt = assumedStrengthWhy(sel({ alternativeWinnerLabel: null }))
    expect(noAlt).toContain('a different option')
    expect(noAlt).not.toContain('Consolidate')
  })

  it('names the relationship using the team’s own labels', () => {
    const s = assumedStrengthLead(sel())
    expect(s).toContain('Customer demand')
    expect(s).toContain('Revenue growth')
  })

  it('the “others” clause counts the REMAINDER, and is silent at 0 and 1', () => {
    expect(assumedStrengthOthers(0)).toBeNull()
    expect(assumedStrengthOthers(1)).toBeNull()
    expect(assumedStrengthOthers(2)).toContain('One other')
    expect(assumedStrengthOthers(4)).toContain('3 other')
  })

  it('two refusals render NOTHING rather than apologising for our own gap', () => {
    expect(ASSUMED_STRENGTH_REFUSAL_COPY.no_robustness_data).toBeNull()
    expect(ASSUMED_STRENGTH_REFUSAL_COPY.no_edge_identity).toBeNull()
  })

  it('the speaking refusals are scoped to THIS RUN and never bless the model', () => {
    const spoken = [
      ASSUMED_STRENGTH_REFUSAL_COPY.all_strengths_set,
      ASSUMED_STRENGTH_REFUSAL_COPY.no_fragile_edges,
    ].filter((s): s is string => s !== null)
    expect(spoken).toHaveLength(2)
    for (const s of spoken) {
      expect(s).not.toMatch(/your model is (sound|robust|good)/i)
      expect(s).not.toMatch(/nothing left to learn/i)
      expect(s).not.toMatch(/no further/i)
    }
  })
})
