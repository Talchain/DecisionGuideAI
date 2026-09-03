/**
 * The metric-noun register — the properties the rest of the change rests on.
 *
 * Two of these are structural rather than cosmetic, and they are the reason
 * this file exists rather than the sweep alone:
 *
 *  · `ahead` must be `COMPARATIVE_COPY.anchor` BY REFERENCE. A copy would be
 *    a second authority for one word, which is the drift the register was
 *    introduced to abolish.
 *
 *    ⭐⭐ AND THE OBVIOUS GUARD FOR THIS DOES NOT WORK — MEASURED, NOT ASSUMED.
 *    The brief for this change specified `toBe` rather than `toEqual` "so a
 *    copy REDs". That is FALSE for a primitive string: `toBe` is `Object.is`,
 *    and `Object.is('Ahead', 'Ahead')` is `true` whether the value arrived by
 *    import or by re-typing. A value assertion CANNOT distinguish a reference
 *    from a copy here — it would have shipped as a guard that cannot fail
 *    (CLAUDE.md trap 13), certifying the exact defect it was written against.
 *
 *    The only instrument that can see the difference is one that reads the
 *    SOURCE, so that is what the reference test below does. The value
 *    assertion is kept beside it — it still catches the authority changing its
 *    word without the register following — but it is not what proves the
 *    reference.
 *
 *  · the retired nouns must be ABSENT. A register that lists both the old and
 *    the new word for one quantity has not fixed anything.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  METRIC_NOUN,
  METRIC_LEGEND_ROWS,
  RETIRED_METRIC_NOUNS,
  ORDINAL_ROW_MUST_STATE_MINT,
  MAX_GLOSS_LENGTH,
} from '../metricVocabulary'
import { COMPARATIVE_COPY } from '../../../../components/results/utils/goalAnchorCopy'
import { INFLUENCE_EXPLANATION_GENERIC } from '../../../../components/results/influenceScaleCopy'

describe('METRIC_NOUN', () => {
  it('agrees with COMPARATIVE_COPY.anchor by VALUE', () => {
    // Necessary and NOT sufficient — see the header. This catches the
    // authority changing its word without the register following; it is blind
    // to a re-typed literal, which is what the source test below is for.
    expect(METRIC_NOUN.ahead).toBe(COMPARATIVE_COPY.anchor)
    // PRECONDITION PINNED: the authority actually carries a word. Without
    // this, both sides being `undefined` would satisfy the line above.
    expect(typeof COMPARATIVE_COPY.anchor).toBe('string')
    expect(COMPARATIVE_COPY.anchor.length).toBeGreaterThan(0)
  })

  it('⭐ `ahead` is COMPARATIVE_COPY.anchor BY REFERENCE — asserted at the source', () => {
    const src = readFileSync(resolve(__dirname, '../metricVocabulary.ts'), 'utf8')

    // POSITIVE CONTROL: the file was actually read. An unreadable or empty
    // source satisfies a `not.toMatch` for the wrong reason (trap 13).
    expect(src.length, 'the register source read as empty').toBeGreaterThan(500)
    expect(src).toContain('METRIC_NOUN')

    // (a) the authority is imported…
    expect(src, 'the register no longer imports the comparative authority')
      .toMatch(/import \{[^}]*COMPARATIVE_COPY[^}]*\} from/)
    // (b) …and `ahead` is that reference, not a literal.
    expect(src, '`ahead` is not bound to COMPARATIVE_COPY.anchor')
      .toMatch(/ahead:\s*COMPARATIVE_COPY\.anchor/)
    // (c) CONTRAST: the word is nowhere re-typed as a literal in the register.
    //     This is the assertion a copy actually REDs on.
    const quoted = new RegExp(`['"\`]${COMPARATIVE_COPY.anchor}['"\`]`)
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(quoted.test(codeOnly), `"${COMPARATIVE_COPY.anchor}" is re-typed as a literal in the register`)
      .toBe(false)
    // …and prove that contrast predicate can fire, or it is vacuous.
    expect(quoted.test(`ahead: '${COMPARATIVE_COPY.anchor}',`), 'the literal detector never fires').toBe(true)
  })

  it('every noun is a single sentence-case word', () => {
    for (const [key, noun] of Object.entries(METRIC_NOUN)) {
      expect(noun, `${key} is empty`).toBeTruthy()
      expect(noun, `${key} ("${noun}") is more than one word`).not.toMatch(/\s/)
      expect(noun, `${key} ("${noun}") is not sentence case`).toMatch(/^[A-Z][a-z]+$/)
    }
  })

  it('the four nouns are distinct — one noun per idea, not one noun for four', () => {
    const values = Object.values(METRIC_NOUN)
    expect(new Set(values).size, 'two quantities share a noun').toBe(values.length)
    expect(values.length).toBe(4)
  })

  it('the retired nouns are gone from the live register', () => {
    const live = Object.values(METRIC_NOUN) as string[]
    for (const retired of RETIRED_METRIC_NOUNS) {
      expect(live, `"${retired}" is still live`).not.toContain(retired)
    }
    // Discrimination — the loop above is doing work, not iterating nothing.
    expect(RETIRED_METRIC_NOUNS).toContain('Leads')
    expect(RETIRED_METRIC_NOUNS).toContain('Achievement')
  })
})

describe('METRIC_LEGEND_ROWS', () => {
  it('every row has a noun and a one-line gloss', () => {
    expect(METRIC_LEGEND_ROWS.length).toBeGreaterThan(4)
    for (const row of METRIC_LEGEND_ROWS) {
      expect(row.noun, 'a row has no noun').toBeTruthy()
      expect(row.gloss, `"${row.noun}" has no gloss`).toBeTruthy()
      // A gloss is a line, not a paragraph. ⚠ A PROXY, NOT A PROOF — jsdom
      // cannot measure the popover; see LEGEND_POPOVER_WIDTH_PX's header.
      expect(row.gloss.length, `"${row.noun}" gloss is too long for the popover`)
        .toBeLessThan(MAX_GLOSS_LENGTH)
    }
  })

  it('every noun in the register is explained by a row', () => {
    // The binding that makes the legend COMPLETE rather than merely present:
    // adding a fifth noun without a row REDs here. Derived from the register,
    // so there is no second list to keep in sync.
    const explained = METRIC_LEGEND_ROWS.map((r) => r.noun)
    for (const noun of Object.values(METRIC_NOUN)) {
      expect(explained, `"${noun}" is captioned on a card but absent from the legend`).toContain(noun)
    }
  })

  it('the influence gloss is DERIVED from the producer, not re-worded', () => {
    const row = METRIC_LEGEND_ROWS.find((r) => r.noun === METRIC_NOUN.influence)!
    // Pins the derivation itself: the rendered row must reconstruct the
    // results-surface sentence exactly. A hand-written replacement REDs.
    expect(`Influence: ${row.gloss}`).toBe(INFLUENCE_EXPLANATION_GENERIC)
  })

  it('ONE escape hatch, ONE word for it — "details", matching EstimateMarker', () => {
    // S3 from the review: the legend said "Open the CARD" while both
    // EstimateMarker arms say "Open the DETAILS". Two vocabularies for one
    // affordance, inside the change whose whole point is to abolish those.
    const row = METRIC_LEGEND_ROWS.find((r) => r.noun === 'est.')!
    expect(row.gloss).toMatch(/Open the details/)
    expect(row.gloss).not.toMatch(/Open the card/)
  })

  it('no gloss uses the technical vocabulary the popover bans', () => {
    // The popover's own spec lowercases the container and bans these. Catching
    // it here names the offending ROW, which the container-level assertion
    // cannot do.
    for (const row of METRIC_LEGEND_ROWS) {
      const text = `${row.noun} ${row.gloss}`.toLowerCase()
      expect(text, `"${row.noun}" says "node"`).not.toMatch(/\bnode\b/)
      expect(text, `"${row.noun}" says "edge"`).not.toMatch(/\bedge\b/)
      expect(text, `"${row.noun}" says "graph"`).not.toMatch(/\bgraph\b/)
    }
  })

  it('⭐⭐ the ordinal row STATES ITS MINT CONDITION — it asserted a falsehood once', () => {
    const row = METRIC_LEGEND_ROWS.find((r) => r.noun.includes('on an option'))!
    expect(row, 'the ordinal row is gone — if deliberate, delete this test too').toBeDefined()

    // (a) THE QUALIFIER. Option numbers are append-only: `assignStableOptionNumbers`
    //     spreads `previous` verbatim, so a number never moves once minted.
    //     Measured, badges read [2,3,1] after a drag and [4,1,2,3] after an
    //     insert at the left — so an unqualified "left to right" is false for
    //     any board a user has touched.
    expect(
      ORDINAL_ROW_MUST_STATE_MINT.test(row.gloss),
      'the ordinal row lost its mint qualifier and now asserts a falsehood',
    ).toBe(true)

    // (b) THE CLAIM IT MUST NEVER MAKE AGAIN, pinned as a literal absence.
    expect(row.gloss, 'the row claims present-tense positional order again')
      .not.toMatch(/place on the board/)
    expect(row.gloss).not.toMatch(/left to right/)

    // (c) still says the thing it was there to say.
    expect(row.gloss).toMatch(/[Nn]ot a ranking/)

    // (d) DISCRIMINATION: the qualifier predicate can fail. Without this, a
    //     regex that matches everything would satisfy (a) forever.
    expect(ORDINAL_ROW_MUST_STATE_MINT.test('its place on the board, left to right')).toBe(false)
  })

  it('⭐ the goal gloss is basis-NEUTRAL — a legend cannot earn the possessive', () => {
    // `basisWithholdsPossessive` gates "your goal" on the run's basis. Static
    // legend copy is shown for every run at once and can read no basis, so the
    // possessive is never earned here. This is the assertion that stops a
    // later "friendlier" rewrite reintroducing it.
    const row = METRIC_LEGEND_ROWS.find((r) => r.noun === METRIC_NOUN.chance)!
    expect(row.gloss).not.toMatch(/\byour\b/i)
    expect(row.gloss).toMatch(/the goal target/)
  })
})
