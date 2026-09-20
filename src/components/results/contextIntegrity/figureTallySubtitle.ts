/**
 * The one sentence that reports the brief's figures against the model.
 *
 * ⚠⚠⚠ EXTRACTED AFTER THREE PASSES, EACH OF WHICH SHIPPED A DEFECT WHILE
 * CLOSING ONE.
 *
 *   pass 1 — singular added to the all-present arm and not to its twin
 *            → "1 of 1 figures you mentioned aren't in the model yet"
 *   pass 2 — a plain-tally arm added to stop a false all-clear
 *            → "0 of 1 figures you mentioned are in the model"
 *   pass 3 — the first draft of the rewrite, caught before it shipped
 *            → "1 of the 0 figures…" and "2 of the 1 figure … are"
 *
 * Every one was a NOUN or a VERB keeping the agreement of the wrong number,
 * because each pass patched the arm in front of it. CLAUDE.md trap 22f: two
 * reversals on one predicate is a signal, four is proof the approach is wrong,
 * and "one more arm" is the sunk-cost fallacy wearing engineering clothes.
 *
 * So this lives apart from the component, the agreement is derived once, and
 * the suite ENUMERATES the quantity domain instead of sampling the cases
 * whoever wrote it happened to imagine. Pass 3's two defects were found by that
 * enumeration and by nothing else.
 *
 * ── THE AGREEMENT RULES, STATED ONCE ─────────────────────────────────────────
 *  · the NOUN agrees with the number IMMEDIATELY BEFORE IT — in "N of M
 *    figures" that is M, which is why "0 of 1 figures" was wrong;
 *  · the VERB agrees with the SUBJECT — N in "N … are", and M after
 *    "None of the M".
 *
 * ⚠ AND THE FIRST VERSION OF THE ENUMERATION'S OWN INVARIANT WAS WRONG, WHICH
 * IS WORTH MORE THAN THE FIX. It read the number adjacent to the noun as the
 * subject, so it flagged "1 of the 2 figures you mentioned isn't in the model
 * yet" — correct English — as a disagreement, 33 times. Satisfying it would
 * have corrupted a sentence that was already right. An invariant over natural
 * language is a claim, and it needs checking against the language, not against
 * the code.
 *
 * ── WHY THE ORDER IS WHAT IT IS ──────────────────────────────────────────────
 * `parseNotModelled` validates the four numbers INDEPENDENTLY and never
 * reconciles them — deliberately, per its own docstring: "every available
 * default is a false statement about the user's own words". An incoherent tally
 * is therefore admitted by the contract, and every arm must be true over one.
 *
 *  1. NOTHING RECORDED — needs all three zeros, not just `total`. Gating on
 *     `total === 0` alone rendered "No figures to track from your brief yet"
 *     over `absent: 2`: an all-clear on a payload naming two figures as
 *     missing.
 *  2. SHORTFALL — figures the producer itself marked absent or prose-only.
 *     True whatever the other numbers say. The denominator is dropped when
 *     `total` cannot carry it: "2 of 0 figures" is not a sentence.
 *
 * ⚠ THE EXISTING "N of M" WORDING IS KEPT VERBATIM. A draft read "N of the M",
 * which is marginally better English and is a copy change no finding asked
 * for — and it turned a sibling spec RED on a sentence that was never in
 * question. The findings were about AGREEMENT; widening them into phrasing
 * would have put unreviewed copy in a fix.
 *  3. ALL-CLEAR — only on `inModel === total`, never on `notYetCount === 0`,
 *     which does not entail it.
 *  4. PLAIN TALLY — claims nothing about the remainder. Reached only when the
 *     numbers do not add up, and true however they fail to, including the
 *     over-count (`inModel > total`) that pass 3 got wrong.
 *
 * ── ⭐⭐ THE POPULATION, CHANGED 11 Sep 2026 (ROADMAP 2.1000) ────────────────
 * THE SENTENCE USED TO QUANTIFY OVER A SET IT CANNOT ENUMERATE. Every arm read
 * "… figures YOU MENTIONED …", which attributes the count to the user's own
 * words. Witnessed on the deployed Reasoning tab:
 *
 *     "All 5 figures you mentioned are in the model"
 *
 * `total` is not the number of figures the user wrote. It is the number CEE's
 * quantity extractor FOUND in `brief_text`, and that extractor misses forms it
 * was never written for (`4.20 pounds` among them). So a brief stating six
 * figures of which the extractor sees five renders an all-clear over five: true
 * of the five it found, and a false assurance about the sixth. "All" turns a
 * LOWER BOUND into a guarantee, and it does it in the COLLAPSED state, which is
 * the one place `COPY.caveatLead` ("this covers … it does not yet track") can
 * never reach.
 *
 * ⚠ THE FIX IS NOT A WIDER EXTRACTOR. A wider regex still is not proof of
 * completeness; it moves the boundary and leaves the claim type untouched. The
 * repair is to quantify over the set the panel CAN enumerate, which is also
 * exactly the set it lists below: the figures it found. "All 5 figures I found
 * in your brief are in the model" is true, keeps the count, keeps the
 * reassurance proportional, and makes the number the panel's own claim rather
 * than an assertion about the reader's memory. A user who wrote six now sees a
 * five that is attributed, and the mismatch is theirs to notice; the human
 * remains the author.
 *
 * ⚠ EVERY ARM MOVED, NOT ONLY THE ALL-CLEAR. The defect is the POPULATION, not
 * the quantifier, and it sits in the same noun phrase in every arm. Leaving
 * "you mentioned" on the shortfall arms would give one quantity two names on
 * one surface, which is trap 21 in miniature and is how the twins get built.
 *
 * ⚠ NOT WIDENED FURTHER. The verbs, the numbers, the arm order and the "N of M"
 * wording are untouched. This is one noun phrase, and the header above records
 * what happens here when a fix carries unreviewed phrasing along with it.
 */

/** Just the four counts; the component owns everything else. */
export interface FigureTally {
  readonly total: number
  readonly inModel: number
  readonly proseOnly: number
  readonly absent: number
}

const figures = (n: number): string => `figure${n === 1 ? '' : 's'}`

/**
 * WHOSE FIGURES THESE ARE, stated once so no arm can drift off it.
 *
 * Named rather than inlined nine times: nine copies of one noun phrase is the
 * hand-maintained mirror (trap 12), and the drift would be silent because every
 * arm reads correctly on its own.
 */
const FOUND = 'I found in your brief'

/**
 * ⛔⛔ A MISSING TALLY IS NOT A MISSING BRIEF — AND THIS RETURNED THE SAME
 * SENTENCE FOR BOTH.
 *
 * `tally === null` covers two states the section treats very differently:
 *
 *   · **no manifest at all** — CEE told us nothing. "I can't show this yet" is
 *     exactly right, and the section's own header rules it: never an empty list
 *     and never silence, because both read as "everything made it in".
 *   · **a manifest that is NOT `derived`** — `status: 'unavailable'`, which the
 *     adapter documents as *"CEE looked and could not"*. The manifest EXISTS.
 *
 * ⚠ IN THE SECOND STATE THE BRIEF IS ON SCREEN. The section returns null only
 * when `briefText === null && manifest === null`, so with a brief present it
 * renders the user's own words — **under a subtitle saying it cannot show them.**
 * Witnessed in Paul's 19 Sep screenshots: *"What you gave me, and what I did
 * with it — I can't show this yet"*, above the content.
 *
 * ⭐ SO THE CALLER NAMES WHICH ABSENCE IT HAS. The figures are what could not be
 * counted; the brief is not in question, and the sentence must not put it in
 * question. Two states under one sentence is trap 21 at copy grain.
 */
export type TallyAbsence =
  /** CEE told us nothing at all. */
  | 'no_manifest'
  /** A manifest arrived and its quantities are not derived. */
  | 'not_counted'

/**
 * ⚠ THE SECOND PARAMETER BREAKS POINT-FREE USE, AND CI CAUGHT IT.
 *
 * Three existing arms passed this function straight to `.map(...)`, where the
 * array callback's second argument is `index: number` — not assignable to
 * `TallyAbsence`. TS2345 x3. The call sites now wrap in an arrow, which is the
 * honest repair: the signature genuinely takes two things now.
 *
 * Kept as a parameter rather than split into two exported functions because the
 * ONE caller that matters asks one question — "what does this subtitle say?" —
 * and a split would push a null-branch into the component, which is where this
 * kind of branch has gone wrong before.
 */
export function figureTallySubtitle(
  tally: FigureTally | null,
  absence: TallyAbsence = 'no_manifest',
): string {
  if (tally === null) {
    return absence === 'not_counted'
      ? // ⚠ ABOUT THE FIGURES, NOT ABOUT THE SECTION. Naming the brief here —
        // "I can't show this" — would contradict the brief rendered beneath it.
        "I couldn't check the figures in your brief this time"
      : "I can't show this yet"
  }

  const notYet = tally.absent + tally.proseOnly

  if (tally.total === 0 && tally.inModel === 0 && notYet === 0) {
    /**
     * ⛔⛔ WITNESSED FALSE, 19 Sep 2026. The panel rendered "I found no figures
     * in your brief" directly beneath the reader's own brief, which read:
     *
     *     "We're raising 1.3 million, and we need all of it."
     *
     * and directly ABOVE its own "What I estimated" list of three figures. The
     * producer's tally was all zeros and this arm reported it faithfully — but
     * the sentence asserts a property of THE BRIEF, and the brief was on the
     * same screen saying otherwise.
     *
     * ⭐ THE FIX IS THE SAME ONE `separation_unavailable` NEEDED: say what the
     * RUN did, not what the WORLD is. "I found no figures" is a claim about the
     * text; "I didn't pick out any figures" is a report of this run's own
     * extraction, which is exactly what a tally of zero establishes and all it
     * establishes.
     *
     * ⚠ AND IT NEEDS NO NEW INPUT, WHICH IS WHY IT IS A SENTENCE AND NOT A
     * BRANCH. The weaker claim is true over the WHOLE domain — a brief with no
     * numbers in it, and a brief whose numbers this run missed. A conditional
     * on "does the brief contain a numeral" would be a second predicate over
     * the same fact, and this file already records what four passes of that
     * cost (trap 22f).
     */
    return "I didn't pick out any figures from your brief"
  }

  if (notYet > 0) {
    if (tally.total === 1 && notYet === 1) return `The figure ${FOUND} isn't in the model yet`
    const verb = notYet === 1 ? "isn't" : "aren't"
    return tally.total > 0 && notYet <= tally.total
      ? `${notYet} of ${tally.total} ${figures(tally.total)} ${FOUND} ${verb} in the model yet`
      : `${notYet} ${figures(notYet)} ${FOUND} ${verb} in the model yet`
  }

  if (tally.inModel === tally.total) {
    return tally.total === 1
      ? `The figure ${FOUND} is in the model`
      : `All ${tally.total} figures ${FOUND} are in the model`
  }

  if (tally.inModel === 0) {
    return `None of the ${tally.total} ${figures(tally.total)} ${FOUND} ${
      tally.total === 1 ? 'is' : 'are'
    } in the model`
  }

  const verb = tally.inModel === 1 ? 'is' : 'are'
  return tally.inModel <= tally.total
    ? `${tally.inModel} of ${tally.total} ${figures(tally.total)} ${FOUND} ${verb} in the model`
    : `${tally.inModel} ${figures(tally.inModel)} ${FOUND} ${verb} in the model`
}
