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
 * The two permitted registers ALREADY EXIST, as `HERO_COPY.detail.goalFit`
 * and `HERO_COPY.detail.goalFitJointBasis`. `sentence()` below CALLS them
 * rather than restating them, so there is exactly one copy of each sentence
 * in the repo. `phrase()` is the same wording without the full stop, for
 * compact readouts that are not sentences; `goalAnchorCopy.spec.ts` pins
 * `sentence === phrase + '.'` so the two cannot drift — a derived guard, not
 * a hand-maintained mirror (CLAUDE.md trap 12).
 *
 * ⚠ Do not invent a third A-register. If a surface needs wording these two
 * do not cover, the fix is upstream in `selectGoalProbability`'s basis, not
 * a new string here.
 */

import { HERO_COPY } from '../analysis-hero/heroCopy'

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
   * Sentence form. Delegates to the shipped hero registers so the sentence
   * exists once in the repo (see the header).
   */
  sentence: (formatted: string, isSubstitutedJoint: boolean): string =>
    isSubstitutedJoint
      ? HERO_COPY.detail.goalFitJointBasis(formatted)
      : HERO_COPY.detail.goalFit(formatted),

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
  /** Inline unlock action beside `noTarget`. Reuses the hero's own wording. */
  noTargetCta: HERO_COPY.lensUnavailable.goalDefineSuccess,
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
  /** Sentence form. */
  sentence: (formatted: string): string => `${COMPARATIVE_COPY.phrase(formatted)}.`,
  /** Aria form for the distribution chart. */
  byOptionAria: 'Share of simulated scenarios each option came out ahead in',
  /** Honest absence (deck C3). */
  unavailable: 'Comparative ranking unavailable for this run',
} as const
