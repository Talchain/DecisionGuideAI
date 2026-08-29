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
    question: `What would have to change for ${alternativeLabel} to become more likely than ${winnerLabel} to hit your goal?`,
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
    // ⚠ WAS 'Research this' (relabelled 29 Aug 2026). There is no research
    // tool — it was deleted on 22 Jul 2026 and CEE answers "I can't fetch
    // external sources" — so the old label advertised an action that
    // reliably terminated in refusal. This is ROADMAP 2.816's defect, and
    // 2.816's own words allow exactly two honest fixes: remove the CTA, or
    // build the producer. A third became available once the prompt was read
    // properly: the QUESTION is a base-rate question the model answers from
    // its own knowledge, so only the retrieval PROMISE was ever false.
    // The capability stays; the lie goes. Pinned by
    // `outsideViewChipTruthful.spec.tsx`.
    chipLabel: 'Take an outside view',
  }
}
