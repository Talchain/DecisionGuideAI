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
 */

/** Just the four counts; the component owns everything else. */
export interface FigureTally {
  readonly total: number
  readonly inModel: number
  readonly proseOnly: number
  readonly absent: number
}

const figures = (n: number): string => `figure${n === 1 ? '' : 's'}`

export function figureTallySubtitle(tally: FigureTally | null): string {
  if (tally === null) return "I can't show this yet"

  const notYet = tally.absent + tally.proseOnly

  if (tally.total === 0 && tally.inModel === 0 && notYet === 0) {
    return 'No figures to track from your brief yet'
  }

  if (notYet > 0) {
    if (tally.total === 1 && notYet === 1) return "The figure you mentioned isn't in the model yet"
    const verb = notYet === 1 ? "isn't" : "aren't"
    return tally.total > 0 && notYet <= tally.total
      ? `${notYet} of ${tally.total} ${figures(tally.total)} you mentioned ${verb} in the model yet`
      : `${notYet} ${figures(notYet)} you mentioned ${verb} in the model yet`
  }

  if (tally.inModel === tally.total) {
    return tally.total === 1
      ? 'The figure you mentioned is in the model'
      : `All ${tally.total} figures you mentioned are in the model`
  }

  if (tally.inModel === 0) {
    return `None of the ${tally.total} ${figures(tally.total)} you mentioned ${
      tally.total === 1 ? 'is' : 'are'
    } in the model`
  }

  const verb = tally.inModel === 1 ? 'is' : 'are'
  return tally.inModel <= tally.total
    ? `${tally.inModel} of ${tally.total} ${figures(tally.total)} you mentioned ${verb} in the model`
    : `${tally.inModel} ${figures(tally.inModel)} you mentioned ${verb} in the model`
}
