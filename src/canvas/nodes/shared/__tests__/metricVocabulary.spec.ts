/**
 * The metric-noun register — the properties the rest of the change rests on.
 *
 * Two of these are structural rather than cosmetic, and they are the reason
 * this file exists rather than the sweep alone:
 *
 *  · `support` must be `COMPARATIVE_COPY.anchor` BY REFERENCE. A copy would be
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
  METRIC_UNSET,
  METRIC_LEGEND_ROWS,
  RETIRED_METRIC_NOUNS,
  ORDINAL_ROW_MUST_STATE_MINT,
  MAX_GLOSS_LENGTH,
  sensitivityRankBadgeAccessibleName,
  optionOrdinalBadgeAccessibleName,
  SENSITIVITY_RANK_CLAUSE,
  ORDINAL_MINT_CLAUSE,
} from '../metricVocabulary'
import { COMPARATIVE_COPY } from '../../../../components/results/utils/goalAnchorCopy'
import { INFLUENCE_EXPLANATION_GENERIC } from '../../../../components/results/influenceScaleCopy'

describe('METRIC_NOUN', () => {
  it('agrees with COMPARATIVE_COPY.anchor by VALUE', () => {
    // Necessary and NOT sufficient — see the header. This catches the
    // authority changing its word without the register following; it is blind
    // to a re-typed literal, which is what the source test below is for.
    expect(METRIC_NOUN.support).toBe(COMPARATIVE_COPY.anchor)
    // PRECONDITION PINNED: the authority actually carries a word. Without
    // this, both sides being `undefined` would satisfy the line above.
    expect(typeof COMPARATIVE_COPY.anchor).toBe('string')
    expect(COMPARATIVE_COPY.anchor.length).toBeGreaterThan(0)
  })

  it('⭐ `support` is COMPARATIVE_COPY.anchor BY REFERENCE — asserted at the source', () => {
    const src = readFileSync(resolve(__dirname, '../metricVocabulary.ts'), 'utf8')

    // POSITIVE CONTROL: the file was actually read. An unreadable or empty
    // source satisfies a `not.toMatch` for the wrong reason (trap 13).
    expect(src.length, 'the register source read as empty').toBeGreaterThan(500)
    expect(src).toContain('METRIC_NOUN')

    // (a) the authority is imported…
    expect(src, 'the register no longer imports the comparative authority')
      .toMatch(/import \{[^}]*COMPARATIVE_COPY[^}]*\} from/)
    // (b) …and `support` is that reference, not a literal.
    //
    // ⚠ THE KEY WAS `ahead` UNTIL 7 Sep 2026. It moved with its value under
    // Paul's no-contest ruling — leaving the key behind would have kept the
    // race word as the canonical name for the quantity.
    expect(src, '`support` is not bound to COMPARATIVE_COPY.anchor')
      .toMatch(/support:\s*COMPARATIVE_COPY\.anchor/)
    // (c) CONTRAST: the word is nowhere re-typed as a literal in the register.
    //     This is the assertion a copy actually REDs on.
    const quoted = new RegExp(`['"\`]${COMPARATIVE_COPY.anchor}['"\`]`)
    const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(quoted.test(codeOnly), `"${COMPARATIVE_COPY.anchor}" is re-typed as a literal in the register`)
      .toBe(false)
    // …and prove that contrast predicate can fire, or it is vacuous.
    expect(quoted.test(`support: '${COMPARATIVE_COPY.anchor}',`), 'the literal detector never fires').toBe(true)
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

  /**
   * ⭐⭐ N1 — THE KEY MAY NOT CLAIM THAT THE ROW AND THE LINE ARE ONE MEASURE.
   *
   * The `Strength` gloss used to end "; the same measure as line thickness".
   * That was true while both surfaces reported the producer's figure. It stopped
   * being true when the card began REFUSING an unsettled strength, because the
   * two channels are gated on different questions and nothing changed thickness:
   *
   *   this row     `strengthIsHumanSettled`                  has a human settled it?
   *   line width   `resolveEdgeSignedStrengthDisplay(...).show`  whose number is this?
   *
   * ⚠ THE ASSERTIONS ARE ON THE PROPERTY, NOT ON THE SENTENCE. Pinning the exact
   * replacement copy would be a mirror that REDs on any rewording (trap 12);
   * what must not come back is the CLAIM.
   */
  it('⭐ N1: the strength gloss makes no identity claim about line thickness', () => {
    const strength = METRIC_LEGEND_ROWS.find((r) => r.noun === METRIC_NOUN.strength)!
    // Positive control — we found a real row with real copy to examine.
    expect(strength.gloss.length).toBeGreaterThan(20)
    expect(strength.gloss, 'the "same measure as thickness" claim is back, and the cards no longer honour it')
      .not.toMatch(/same (measure|thing|number|quantity)/i)
    expect(strength.gloss, 'the strength row asserts a thickness equivalence again')
      .not.toMatch(/thickness/i)
  })

  it('⭐ N1: the unset row discloses that the line may still show a figure', () => {
    const unset = METRIC_LEGEND_ROWS.find((r) => r.noun === METRIC_UNSET.standalone)!
    // Without this sentence the reader meets a card saying "Not set yet" beside
    // a thick coloured line and has no way to reconcile them.
    expect(unset.gloss, 'the unset row no longer warns that the line can still show a suggestion')
      .toMatch(/may still/i)
    // Contrast: it must not have become a promise that the line is blank.
    expect(unset.gloss).not.toMatch(/no line|nothing is drawn/i)
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

  /**
   * ⭐⭐ THE BADGES AND THE LEGEND SPEAK ONE CLAUSE — AND A COMMENT ONCE
   * CLAIMED THIS WITHOUT AN IMPORT BEHIND IT.
   *
   * `#1414` gave the two canvas badges accessible names and wrote at both call
   * sites that the wording was "DERIVED from the legend’s own gloss … so the
   * two cannot drift into saying different things about the same badge".
   * **There was no import.** Both were template literals repeating the
   * legend’s words, and nothing tested a badge against a row:
   * `ORDINAL_ROW_MUST_STATE_MINT` is only ever applied to `row.gloss`. So a
   * legend rewrite kept every guard green, left the badges on the old wording,
   * and told a screen-reader user something a sighted reader is not told.
   *
   * ⚠ WHAT THIS PAIR OF TESTS CAN AND CANNOT DO, STATED NARROWLY. This one
   * proves AGREEMENT between the register and the builders, derived from
   * `METRIC_LEGEND_ROWS` so there is no second copy of the expectation. It is
   * structurally blind to a component that stops calling the builder — which
   * is exactly how the defect arrived. The render specs
   * (`OptionNode.leadingPillCornerStack`, `OptionNode`, `BaseNode.cornerStack`)
   * carry the other half: they bind the RENDERED accessible name to the
   * builder’s output, so re-inlining a literal REDs there while this file stays
   * green. Neither guard subsumes the other; dropping either leaves a defect
   * class unobserved (CLAUDE.md trap 12d).
   *
   * And the literal assertions already in those render specs stay: a derived
   * guard proves the copies agree, never that the wording is right. The
   * literals are the corpus that notices a wrong sentence.
   */
  it('⭐⭐ the badge accessible names are BUILT FROM the legend rows, not repeated', () => {
    // (a) THE RANK BADGE. Expected value derived from the register — find the
    //     row by its noun, never by writing the clause out again here.
    const rankRow = METRIC_LEGEND_ROWS.find((r) => r.noun === '#1, #2, #3')!
    expect(rankRow, 'the sensitivity-rank row is gone — if deliberate, delete this test too').toBeDefined()
    expect(
      sensitivityRankBadgeAccessibleName(1),
      'the rank badge no longer speaks the legend’s own gloss',
    ).toContain(rankRow.gloss)
    // ...and it still says which badge it is, so the name is not the gloss alone.
    expect(sensitivityRankBadgeAccessibleName(2)).toContain('#2')

    // (b) THE ORDINAL BADGE. The legend row carries two extra sentences the
    //     badge has no room for, so the shared unit is the row’s FIRST clause
    //     — still derived from the row, still not retyped.
    const ordinalRow = METRIC_LEGEND_ROWS.find((r) => r.noun.includes('on an option'))!
    expect(ordinalRow, 'the ordinal row is gone — if deliberate, delete this test too').toBeDefined()
    const ordinalSharedClause = ordinalRow.gloss.split('. ')[0]
    expect(
      optionOrdinalBadgeAccessibleName(3),
      'the ordinal badge no longer speaks the legend’s own gloss',
    ).toContain(ordinalSharedClause)
    expect(optionOrdinalBadgeAccessibleName(3)).toContain('Option 3')

    // (c) THE TWO NAMES MUST STAY DISTINGUISHABLE. They are the confusion the
    //     legend exists to prevent: "#1" on a factor is a ranking, "1" on an
    //     option is not. A refactor that collapsed them would satisfy (a) and
    //     (b) individually.
    expect(sensitivityRankBadgeAccessibleName(1)).not.toBe(optionOrdinalBadgeAccessibleName(1))
    expect(optionOrdinalBadgeAccessibleName(1)).toMatch(/not a ranking/)

    // (d) DISCRIMINATION: `toContain` can fail. Without this, a builder that
    //     returned the whole file, or a clause that matched everything, would
    //     satisfy (a) and (b) forever — the same vacuity the mint guard’s own
    //     discrimination case above exists to rule out.
    expect(sensitivityRankBadgeAccessibleName(1)).not.toContain(ordinalSharedClause)
    expect(optionOrdinalBadgeAccessibleName(1)).not.toContain(rankRow.gloss)
  })

  /**
   * ⭐⭐ THE THIRD GUARD, AND THE ONLY ONE THAT CAN SEE THE DEFECT AS IT
   * ACTUALLY SHIPPED — A COPY THAT IS BYTE-IDENTICAL TODAY.
   *
   * ⚠ MEASURED, NOT ASSUMED, AND IT IS THE SAME LESSON THIS FILE ALREADY
   * CARRIES ABOUT `support`: a VALUE assertion cannot distinguish a reference
   * from a copy. Re-inline the exact sentence at the call site and the render
   * specs' `toHaveAccessibleName(builder(n))` stays GREEN — the rendered string
   * and the builder's string are equal, because the copy was correct on the day
   * it was typed. That is precisely how `#1414` shipped: a literal that agreed
   * with the legend, and a comment claiming it was derived.
   *
   * The drift is latent, not present, so no value assertion anywhere can fire.
   * The only instrument that can see it is one that reads the SOURCE, which is
   * what this does.
   *
   * ⚠ SCOPE, STATED NARROWLY. This proves the two call sites CALL the builder
   * and do not re-type its clauses. It says nothing about whether the sentences
   * are right (the render specs' literals are the corpus for that), and nothing
   * about a third component that might grow its own copy — it names the two
   * files it reads, because an absence claim is only about what was searched.
   */
  it('⭐⭐ the badge call sites CALL the builders — a byte-identical copy REDs here', () => {
    const sites = [
      { file: '../../OptionNode.tsx', builder: 'optionOrdinalBadgeAccessibleName', clause: ORDINAL_MINT_CLAUSE },
      { file: '../../BaseNode.tsx', builder: 'sensitivityRankBadgeAccessibleName', clause: SENSITIVITY_RANK_CLAUSE },
    ] as const

    for (const site of sites) {
      const src = readFileSync(resolve(__dirname, site.file), 'utf8')

      // POSITIVE CONTROL: the file was actually read. An unreadable or empty
      // source satisfies every `not.toContain` below for the wrong reason
      // (trap 13), and this whole test is an absence claim.
      expect(src.length, `${site.file} read as empty`).toBeGreaterThan(5000)
      expect(src, `${site.file} is not the component it claims to be`).toContain('aria-label')

      // (a) the builder is imported…
      expect(
        new RegExp(`import \\{[^}]*${site.builder}[^}]*\\} from`).test(src),
        `${site.file} no longer imports ${site.builder}`,
      ).toBe(true)
      // (b) …and it is CALLED, not merely imported. An unused import would
      //     satisfy (a) while the label went back to a literal.
      expect(src, `${site.file} imports ${site.builder} without calling it`)
        .toContain(`aria-label={${site.builder}(`)

      // (c) THE ASSERTION A COPY REDS ON. The clause appears nowhere as a
      //     re-typed literal in the component's CODE. Comments are stripped
      //     first — this file's rule is that the historic record in a comment
      //     is evidence and stays (CLAUDE.md trap 14b), so it must not be what
      //     this predicate reads.
      const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(
        codeOnly.includes(site.clause),
        `${site.file} re-types the legend's clause as a literal — the mirror is back`,
      ).toBe(false)

      // (d) DISCRIMINATION: the predicate in (c) can fire. Without this, a
      //     stripper that ate the whole file would satisfy (c) forever.
      expect(
        `${codeOnly} ${site.clause}`.includes(site.clause),
        'the (c) predicate cannot detect a present clause — it is vacuous',
      ).toBe(true)
      // …and the stripper did not eat the code it was pointed at.
      expect(codeOnly, `${site.file}: comment-stripping removed the code too`).toContain(site.builder)
    }
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
