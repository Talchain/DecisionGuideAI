/**
 * goalAnchorCopy — THE house registers for the two questions every
 * comparative surface must anchor to (Paul's ruling, 2026-07-31).
 *
 *   (A) "which option is most likely to achieve MY GOAL"  → backed by
 *       `OptionResult.goalProbability` (the producer's goal-attainment
 *       quantity, chosen by `selectGoalProbability`).
 *   (B) "what is most likely to happen"                    → backed by
 *       `OptionResult.outcome.p50`, already labelled "Most likely outcome"
 *       across the panel; no new register needed here.
 *   (C) the COMPARATIVE quantity (`winProbability`) is NEITHER of those —
 *       it is the share of Monte-Carlo runs in which an option out-ranked
 *       the others. It keeps its place, DEMOTED below the goal number, and
 *       it must always be described by what it measures.
 *
 * Un-anchored forms — bare "win probability", endorsement nouns, bare
 * superlatives — are retired. This module exists so the replacement copy
 * lives in ONE place rather than being re-typed at fifteen render sites.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE POSSESSIVE GATE — the reason every A-register function takes a flag
 * ─────────────────────────────────────────────────────────────────────────
 * `selectGoalProbability` publishes `basis`. When it is
 * `'joint_goal_substituted'` the number is P(all constraints jointly
 * satisfied) STANDING IN for an absent goal probability — it answers a
 * DIFFERENT question from the one "your goal" asserts, and the selector's
 * `mayUsePossessiveGoalFraming` is false. `OptionResult` already carries the
 * decision as `goalFitIsSubstitutedJoint` (set from that basis in
 * `useResultsSectionData`, never re-derived at a render site), so every
 * caller here passes it straight through.
 *
 * The two permitted registers ALREADY SHIPPED, as `HERO_COPY.detail.goalFit`
 * and `HERO_COPY.detail.goalFitJointBasis`. Their wording is unchanged and it
 * now lives HERE, with `heroCopy` delegating to `sentence()` — so there is
 * exactly one copy of each sentence in the repo and every surface reads the
 * same one.
 *
 * ⚠ THE DIRECTION OF THAT DELEGATION IS LOAD-BEARING. It was written the
 * other way first (this module importing `HERO_COPY`) and `heroCopy` also
 * needs `COMPARATIVE_COPY` for its own comparative lines — which made the two
 * modules a cycle, and nine hero specs failed at COLLECTION rather than on an
 * assertion. This module is therefore a LEAF: it imports nothing. Do not add
 * an import here.
 *
 * `phrase()` is the same wording without the full stop, for compact readouts
 * that are not sentences; `goalAnchorCopy.spec.ts` pins
 * `sentence === phrase + '.'` so the two cannot drift — a derived guard, not
 * a hand-maintained mirror (CLAUDE.md trap 12).
 *
 * ⚠ Do not invent a third A-register. If a surface needs wording these two
 * do not cover, the fix is upstream in `selectGoalProbability`'s basis, not
 * a new string here.
 */

/**
 * The A-register: goal attainment per option, in the two permitted voices.
 *
 * `isSubstitutedJoint` is `OptionResult.goalFitIsSubstitutedJoint` — true
 * ⇔ `selectGoalProbability(...).basis === 'joint_goal_substituted'`. Passing
 * `true` withholds the possessive; passing `false` permits it. There is no
 * third value and no default: a caller that does not know the basis must not
 * be rendering this copy.
 */
export const GOAL_ANCHOR_COPY = {
  /**
   * Label form — names the quantity, carries no number, no full stop.
   * Used by chart headers, data-bar labels and column captions.
   */
  label: (isSubstitutedJoint: boolean): string =>
    isSubstitutedJoint
      ? 'Chance of meeting every target this run scored'
      : 'Chance of hitting your goal',

  /**
   * Compact readout — number first, no full stop. Used inline beside an
   * option label where a full sentence would be noise.
   */
  phrase: (formatted: string, isSubstitutedJoint: boolean): string =>
    isSubstitutedJoint
      ? `${formatted} chance of meeting every target this run scored`
      : `${formatted} chance of hitting your goal`,

  /**
   * Sentence form — the shipped hero wording, verbatim. `HERO_COPY.detail`
   * calls this; nothing restates it.
   */
  sentence: (formatted: string, isSubstitutedJoint: boolean): string =>
    `${GOAL_ANCHOR_COPY.phrase(formatted, isSubstitutedJoint)}.`,

  /**
   * Headline form (deck A4) — names the option, the basis AND the magnitude.
   * Replaces the bare superlatives ("performs best", "is the leading
   * option", "is most likely to be strongest overall") which named no basis
   * and carried no number.
   */
  headline: (label: string, formatted: string, isSubstitutedJoint: boolean): string =>
    isSubstitutedJoint
      ? `${label} has the highest chance of meeting every target this run scored: ${formatted}`
      : `${label} has the highest chance of hitting your goal: ${formatted}`,

  /**
   * Aria form for a distribution chart over the A quantity.
   */
  byOptionAria: (isSubstitutedJoint: boolean): string =>
    `${GOAL_ANCHOR_COPY.label(isSubstitutedJoint)}, by option`,

  /**
   * A5 — the no-target state. ISL computes a goal probability ONLY when a
   * success threshold was supplied, so this is not an edge case: it is the
   * state of every run the user has not set a target on.
   *
   * Paul's ruling: it NEVER blocks. This is an invitation with a route, not
   * a wall — the surface keeps rendering whatever it can (the comparative
   * distribution stays drawn), and this line says what setting a target
   * would add.
   */
  noTarget: 'Set a success target to see which option is most likely to reach it.',
  /** Inline unlock action beside `noTarget`. `HERO_COPY` re-exports this. */
  noTargetCta: 'Define success',
} as const

/**
 * The C-register — the comparative quantity, described by what it measures.
 *
 * Not retired, and not renamed: `OptionCards`' tooltip has shipped
 * "Came out ahead in {N}% of simulated scenarios" for months and it is the
 * most honest sentence in the estate about this number. It is promoted to
 * the house register and DEMOTED below the A number on every surface that
 * shows both (Paul's ruling).
 */
export const COMPARATIVE_COPY = {
  /** Label form — chart header / data-bar label. */
  label: 'Came out ahead across scenarios',
  /** Compact readout, number first, no full stop. */
  phrase: (formatted: string): string => `Came out ahead in ${formatted} of simulated scenarios`,
  /**
   * The same claim with NO magnitude — for the runs that carry the
   * comparative RANK but not a displayable probability for the leader.
   *
   * ⚠ This arm exists because the first draft did not have it, and the
   * builder fell back to the missing-value glyph INSIDE the sentence:
   * "came out ahead in — of simulated scenarios". A placeholder rendered as
   * though it were a quantity is worse than saying less, and the honesty bar
   * this whole change serves forbids it. Caught by an existing readout-tie
   * spec, not by a new one.
   */
  phraseNoMagnitude: 'came out ahead most often across simulated scenarios',
  /**
   * The magnitude-free claim in SENTENCE-INITIAL position.
   *
   * ⚠ Added because the F1 fix opened by writing
   * `phraseNoMagnitude.charAt(0).toUpperCase() + …slice(1)` inline at the call
   * site — which is EXACTLY the duplicated string surgery that produced the
   * §10.2 casing defect, reintroduced two sections after being named. The
   * register owns casing; call sites never do it. `goalAnchorCopy.spec.ts`
   * pins this against `phraseNoMagnitude` so the two cannot drift.
   */
  leadNoMagnitude: 'Came out ahead most often across simulated scenarios',
  /**
   * Mid-sentence form — `phrase()` with a lower-case initial, for when the
   * claim follows an option label rather than opening a line.
   *
   * ⚠ Exists because two call sites were doing
   * `phrase(x).charAt(0).toLowerCase() + phrase(x).slice(1)` inline, and one
   * of them (`buildV7Headline`) did NOT, shipping "Option A Came out ahead in
   * 71% of simulated scenarios" with a capital mid-sentence. String surgery
   * repeated at call sites is how one of them ends up different; the register
   * owns the casing.
   */
  clause: (formatted: string): string => {
    // Built ONCE. Calling `phrase()` twice and slicing each result is two
    // chances for the halves to come from different strings if the register
    // ever grows a branch.
    const phrase = COMPARATIVE_COPY.phrase(formatted)
    return `${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`
  },
  /** Mid-sentence honest-absence form, parallel to `clause`. */
  unavailableClause: 'comparative ranking is unavailable for this run',
  /** Sentence form. */
  sentence: (formatted: string): string => `${COMPARATIVE_COPY.phrase(formatted)}.`,
  /** Aria form for the distribution chart. */
  byOptionAria: 'Share of simulated scenarios each option came out ahead in',
  /** Honest absence (deck C3). */
  unavailable: 'Comparative ranking unavailable for this run',
} as const

/**
 * THE presence test for a producer probability — never treats a missing
 * number as 0.
 *
 * `Number.isFinite` and not `!= null`: a NaN passes the null check, and a NaN
 * that reaches a comparator or a formatter produces an arbitrary order or a
 * "NaN%" readout. Exported from here because `runHasGoalNumbers` below needs
 * it anyway, and because four surfaces had each written their own copy
 * (`WinGauge`'s `finite`, `DecisionConfidencePanel`'s `isFiniteProb`, an
 * inline expression in `OptionCards`, another in `buildV7Headline`) — four
 * chances for one of them to drift to `!= null` and start rendering a hole as
 * a measurement.
 */
export function isFiniteProbability(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * True when this run carries a goal number for at least one option.
 *
 * ISL computes a goal probability ONLY against a success threshold, so on a
 * no-target run there is no goal ranking AT ALL — not an empty one. Any copy
 * that names "the goal ranking" must ask this first.
 */
export function runHasGoalNumbers(
  options: ReadonlyArray<{ goalProbability?: number | null }> | null | undefined,
): boolean {
  return (options ?? []).some((o) => isFiniteProbability(o.goalProbability))
}

/**
 * Copy for the outcome-view lens — the sentence that says what the lens does
 * NOT change.
 *
 * ⚠ F3. The re-anchoring replaced the un-anchored noun "the overall
 * recommendation" with "the goal ranking above" at three sites, and left it
 * UNCONDITIONAL. On a no-target run that asserts the existence of a ranking
 * the same panel is offering to unlock — the exact no-target branch this
 * change added to `WinGauge`, the confidence ring and the V7 goal lens, not
 * applied to these three strings. One function, three callers, so a fourth
 * lens sentence cannot be born ungated.
 */
export const LENS_COPY = {
  unchanged: (hasGoalNumbers: boolean): string =>
    hasGoalNumbers
      ? 'The goal ranking above is unchanged.'
      : 'The comparative ranking above is unchanged.',
} as const
