/**
 * The two coaching sentences on a factor card must not read as one
 * contradictory claim.
 *
 * On the deployed build a factor ranked #2 with LOW value-of-information showed,
 * in one vertical stack:
 *
 *   "Further investigation here is unlikely to change the outcome."
 *   "This is one of the most influential factors in your model. Changes here
 *    noticeably affect the result."
 *
 * Both sentences were TRUE and they answer different questions — does the
 * VALUE move the result, versus is reducing UNCERTAINTY about it worth the
 * effort. A factor can be the strongest driver in the model and still not be
 * worth researching. But they were written in the same words, so a reader got a
 * flat contradiction (CLAUDE.md trap 21: two questions under names that look
 * identical).
 *
 * ⚠ SO THE ASSERTION IS ABOUT THE VOCABULARY, NOT ABOUT ONE SENTENCE. Testing
 * each string in isolation is what let this ship: each was individually
 * defensible. What has to hold is that the two families do not SHARE the words
 * that made them collide.
 */
import { describe, it, expect } from 'vitest'
import { influenceGuidance, investigationGuidance } from '../inspectorStrings'

/** The words that made the two read as one claim about the same thing. */
const RESULT_WORDS = /\b(outcome|the result|the answer)\b/i

describe('factor guidance — two questions, two vocabularies', () => {
  it('the case that shipped: top-ranked factor with LOW investigation value', () => {
    const influence = influenceGuidance(2)
    const investigation = investigationGuidance(0.1)
    expect(influence).toBeTruthy()
    // The exact pair a user saw. Neither may deny what the other asserts.
    expect(influence).not.toMatch(/unlikely/i)
    expect(investigation).not.toMatch(/noticeably affect/i)
  })

  it('only the INFLUENCE family may speak about moving the result', () => {
    expect(influenceGuidance(1)).toMatch(/influence.*on the result/i)
    expect(influenceGuidance(4)).toMatch(/influence/i)
  })

  it('the INVESTIGATION family speaks about evidence and uncertainty, never about "the outcome"', () => {
    // This is the assertion that would have caught the original defect: the old
    // low arm said "unlikely to change the outcome", which is the influence
    // family's vocabulary.
    for (const voi of [0.9, 0.5, 0.1]) {
      const s = investigationGuidance(voi)
      expect(s, `voi=${voi} borrows the influence family's words: "${s}"`).not.toMatch(RESULT_WORDS)
      expect(s).toMatch(/evidence|uncertainty/i)
    }
  })

  it('does not promise CONFIDENCE — the producer says VoI is not certainty', () => {
    // `useNodeDisplayMetadata` refuses VoI as a confidence fallback in so many
    // words: "VoI is semantically different from confidence (it measures the
    // value of learning more, not certainty)". The old high arm promised
    // exactly that (trap 13c — the expectation must come from the producer's
    // declared semantics, not from what the word sounds like).
    expect(investigationGuidance(0.9)).not.toMatch(/confidence/i)
  })

  it('names the VALUE as the thing with influence, not the factor as a whole', () => {
    // "This factor is influential" invites reading it as "we know a lot about
    // this factor". Naming the value is what keeps the two questions apart.
    expect(influenceGuidance(1)).toMatch(/value/i)
  })

  it('keeps the Observable panel’s noun without forking the sentence', () => {
    expect(influenceGuidance(1, 'measurement')).toMatch(/measurement's value/i)
    expect(influenceGuidance(1, 'factor')).toMatch(/factor's value/i)
  })

  it('says nothing when there is no rank, rather than defaulting to a claim', () => {
    expect(influenceGuidance(null)).toBeNull()
    expect(influenceGuidance(9)).toBeNull()
  })

  it('every investigation arm returns copy — no silent empty state', () => {
    for (const voi of [1, 0.7, 0.69, 0.4, 0.39, 0]) {
      expect(investigationGuidance(voi).length).toBeGreaterThan(20)
    }
  })
})
