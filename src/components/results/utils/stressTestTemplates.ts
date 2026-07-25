/**
 * stressTestTemplates — Brief 5.8B D4 thinking-pattern templates.
 *
 * Pure functions only. No React, no hooks, no canvas-store coupling. The
 * templates emit plain `{ question, context?, chipLabel }` shapes that the
 * StressTestSection renders.
 *
 * Clean module boundary so V5's `decision_review` (pre_mortem,
 * framing_check, key_assumptions, scenario_contexts) can replace these
 * deterministic templates later without structural changes — the
 * StressTestSection only depends on the return shape, not on which
 * function produced it.
 */

import type { FactorConfidenceDisplay } from '../driverConfidenceDisplayPolicy'

export interface ThinkingPatternCard {
  /** Primary question rendered in panelBody. */
  question: string
  /** Optional one-line context rendered as panelMeta beneath the question.
   *  When undefined, the card omits the context row entirely. */
  context?: string
  /** AI chip label rendered bottom-right. */
  chipLabel: string
}

export interface DisconfirmationInputs {
  winnerLabel: string
  alternativeLabel: string
  topDriverLabel: string
  /**
   * Top-driver confidence RESOLVED THROUGH THE DISPLAY POLICY
   * (`components/results/driverConfidenceDisplayPolicy.ts`), never the raw
   * `factor_sensitivity[].confidence`.
   *
   * This used to be `number | null | undefined` and the card asserted
   * *"…which has limited evidence."* whenever it was `< 0.5`. The producer's
   * value here IS the placeholder — `0.25` with
   * `confidence_components.sampling_stability: 0` in both real staging
   * captures — so the card made an evidence claim about a number nobody
   * measured, on every analysis. Taking the union instead of a number means
   * the "limited evidence" branch cannot be reached without a value the ruled
   * policy has cleared for display.
   */
  topDriverConfidence: FactorConfidenceDisplay
}

export interface OutsideViewInputs {
  winnerLabel: string
  alternativeLabel: string
}

/**
 * Disconfirmation card — invites the user to consider what evidence would
 * flip their recommendation. Context line surfaces only when the top
 * driver's evidence is genuinely thin (< 0.5).
 */
export function buildDisconfirmationCard({
  winnerLabel,
  alternativeLabel,
  topDriverLabel,
  topDriverConfidence,
}: DisconfirmationInputs): ThinkingPatternCard {
  // ⛔ Display-policy gate. `show: false` carries no `.value`, so the
  // threshold below is unreachable for a confidence the policy hides.
  const showContext = topDriverConfidence.show && topDriverConfidence.value < 0.5
  return {
    question: `What could make you switch your recommendation from ${winnerLabel} to ${alternativeLabel}?`,
    context: showContext
      ? `The analysis depends on ${topDriverLabel}, which has limited evidence.`
      : undefined,
    chipLabel: 'Explore this challenge',
  }
}

/**
 * Outside view card — invites the user to step outside the modelled frame
 * and ask what a peer would see.
 */
export function buildOutsideViewCard({
  winnerLabel,
  alternativeLabel,
}: OutsideViewInputs): ThinkingPatternCard {
  return {
    question: `For decisions like this, does ${winnerLabel} usually outperform ${alternativeLabel}?`,
    context: 'Outside views often catch assumptions you have stopped questioning.',
    chipLabel: 'Research this',
  }
}
