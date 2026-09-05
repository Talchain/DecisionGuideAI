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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

  it('⚠ THE THIRD SENTENCE — no OTHER guidance on the card may borrow the vocabulary either', () => {
    // The finding my own spec missed: it tested the two families in isolation
    // and never the third sentence rendered beside them. `externalGuidance`
    // (`FactorExternalPanel.tsx`) is gated on `sensitivityRank` — the INFLUENCE
    // signal — and said "contributes significant uncertainty", the
    // INVESTIGATION family's claim. With low VoI the card read "you already
    // know enough about this one" directly above it.
    //
    // Source-scanned rather than rendered, deliberately: the point is that NO
    // sentence gated on the influence signal may speak the uncertainty
    // vocabulary, which is a property of the file, not of one render path. A
    // render test would only cover the fixture it happened to mount — which is
    // exactly how this survived.
    const src = readFileSync(
      resolve(__dirname, '../panels/FactorExternalPanel.tsx'),
      'utf8',
    )
    expect(src.length, 'empty read makes this assertion vacuous').toBeGreaterThan(500)
    const gatedOnInfluence = src.slice(
      src.indexOf('const externalGuidance'),
      src.indexOf('return (', src.indexOf('const externalGuidance')),
    )
    expect(gatedOnInfluence.length).toBeGreaterThan(100)
    // ⚠ COMMENTS STRIPPED FIRST, so the absence claim is about CODE. The
    // explanation of the defect necessarily QUOTES the sentence it forbids, and
    // deleting that record to satisfy a text match would trade the reason for a
    // green test. This test caught exactly that on its own first run.
    const code = gatedOnInfluence
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(code.trim().length, 'comment strip left nothing to assert against').toBeGreaterThan(80)
    // ⚠ THE WHOLE FAMILY, NOT ONE LITERAL — and this test's title always
    // claimed the family while its body checked a single string.
    //
    // `not.toMatch(/contributes significant uncertainty/i)` is satisfied by any
    // sentence that borrows the vocabulary in different words, and the fallback
    // arm did exactly that: "...so its level is uncertain." A review found it
    // still live AFTER this spec went green, in the arm covering every factor
    // outside the top three — i.e. the common case, while the arm I fixed
    // covers at most three per model.
    //
    // A guard written against the failure mode in hand rather than against the
    // property, which is the shape CLAUDE.md 13d records. The property is: no
    // sentence in this expression may speak the INVESTIGATION family's words.
    const INVESTIGATION_WORDS = /\b(uncertain|uncertainty|evidence|know enough|worth (investigating|learning))\b/i
    expect(
      code.match(INVESTIGATION_WORDS)?.[0] ?? null,
      'externalGuidance borrows the investigation family\'s vocabulary',
    ).toBeNull()

    // ⚠ POSITIVE CONTROLS THAT DISCRIMINATE BETWEEN THE ARMS. The old control
    // (`/outside your control/i`) matches BOTH arms, so it proved the slice was
    // non-empty and nothing else — it could not tell the fixed arm from the
    // untouched one, which is why it certified a half-done fix. One control per
    // arm, so deleting or rewording either REDs here.
    expect(code, 'the influence arm is missing from the slice').toMatch(/externalInfluence/)
    expect(code, 'the fallback arm is missing from the slice').toMatch(/plan around it/i)

    // ⚠ ONE OWNER FOR THE INFLUENCE THRESHOLD. This panel used a bespoke
    // `sensitivityRank != null` (rank 1-3 → "one of the strongest") against
    // `influenceGuidance`'s `<= 2` / `<= 5`, so AT RANK 3 it contradicted the
    // Controllable and Observable panels about the same signal. Asserting the
    // owner is called AND the bespoke threshold is gone, because either alone
    // permits both to coexist.
    expect(code, 'the influence clause must come from influenceGuidance').toMatch(/influenceGuidance\s*\(/)
    expect(code, 'a second, bespoke rank threshold has come back').not.toMatch(/sensitivityRank\s*!=\s*null/)
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
