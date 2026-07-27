/**
 * The WITHHELD / PERMITTED pair for the NON-PROSE designation contract
 * (ROADMAP 1.267).
 *
 * Shared by the two halves of the slice so both are provably describing the
 * SAME run — one fixture, no mirror:
 *   · `../__tests__/withheldDesignations.spec.tsx`
 *       the shared comparator + the ranked card repeat (OptionCards)
 *   · `../analysis-hero/__tests__/withheldDesignations.hero.spec.tsx`
 *       the hero rows (the analysis-hero inertness guard allows hero imports
 *       only from inside that module, so the hero half lives there)
 *
 * Same wire shapes as `src/lib/__fixtures__/ownedLeaderClaim.fixtures.ts`,
 * which pins the PROSE half — restated here with THREE options and a
 * deliberately reversed order, for the reason below.
 *
 * ## Why three options, and why canonical order is the reverse
 *
 * The CEE lane that shipped the producer half of this ruling (#719) caught
 * its own route fixture being VACUOUS: on a two-option graph the leader
 * sorted first anyway, so its order assertion could never have gone red.
 * Options are declared in canonical (graph/creation) order LOW → MID → HIGH
 * while their win probabilities run 0.10 / 0.30 / 0.60 — so canonical order
 * is the exact REVERSE of probability order. An implementation that
 * neutralises nothing, and one that sorts ascending by accident, both fail.
 */
import type { DecisionVerdictReportLike } from '../../../lib/decisionVerdict'
import { deriveDecisionVerdict } from '../../../lib/decisionVerdict'
import type { OptionResult } from '../types'

export const LOW_ID = 'opt_low'
export const MID_ID = 'opt_mid'
export const HIGH_ID = 'opt_high'

export const LOW_LABEL = 'Keep the current tooling'
export const MID_LABEL = 'Upskill the current team'
export const HIGH_LABEL = 'Hire two developers'

export const WIN_LOW = 0.1
export const WIN_MID = 0.3
export const WIN_HIGH = 0.6

/** Graph/creation order — what `nodes.filter(kind === 'option')` yields. */
export const CANONICAL_IDS = [LOW_ID, MID_ID, HIGH_ID] as const
export const CANONICAL_LABELS = [LOW_LABEL, MID_LABEL, HIGH_LABEL] as const
/** Probability-descending order — the designation this slice removes. */
export const PROBABILITY_IDS = [HIGH_ID, MID_ID, LOW_ID] as const
export const PROBABILITY_LABELS = [HIGH_LABEL, MID_LABEL, LOW_LABEL] as const

const OPTION_PROBABILITIES = {
  [LOW_ID]: { win_probability: WIN_LOW },
  [MID_ID]: { win_probability: WIN_MID },
  [HIGH_ID]: { win_probability: WIN_HIGH },
}

/**
 * WITHHELD, post-CEE-#711: `leading_option_id` nulled and the comparative
 * members of `decision_brief` dropped, while the per-option win probabilities
 * keep riding the wire — the DATA is not withheld, only the CLAIM.
 */
export const WITHHELD_REPORT: DecisionVerdictReportLike = {
  option_probabilities: OPTION_PROBABILITIES,
  robustness: { recommended_option_id: HIGH_ID },
  decision_brief: {
    // A non-comparative member CEE deliberately KEEPS, so the fixture cannot
    // pass merely because the brief is absent whole.
    top_drivers: [{ factor_label: 'Three-Year Total Cost of Ownership' }],
  } as unknown as DecisionVerdictReportLike['decision_brief'],
}

/** The SAME run with the claim PERMITTED — the over-suppression control. */
export const PERMITTED_REPORT: DecisionVerdictReportLike = {
  option_probabilities: OPTION_PROBABILITIES,
  robustness: { recommended_option_id: HIGH_ID },
  decision_brief: {
    headline: `${HIGH_LABEL} currently leads.`,
    headline_banded: {
      band: 'clearly_ahead',
      leader_option_id: HIGH_ID,
      robustness_gated: false,
    },
  } as unknown as DecisionVerdictReportLike['decision_brief'],
}

/**
 * WITHHELD, third shape: the producer RECOMMENDS an option that is not the
 * win-probability argmax, and bands THAT option.
 *
 * This is not a contrived shape — `decisionVerdict` documents it explicitly
 * ("PLoT may recommend an option that is not the win-probability argmax"),
 * and it is the input that separates the two identity gates:
 *   · `deriveDecisionVerdict` checks the band against `top1` (the win argmax,
 *     HIGH) → does not apply → no producer signal → `separation: 'unknown'`,
 *     `hasLeadingOption: false` → the verdict WITHHOLDS.
 *   · `buildHeroModel` checks the same band against `headlineRow` (the
 *     RECOMMENDED option, MID) → applies → it re-bands the leader claim the
 *     verdict just withheld.
 * Exactly the Authority-3 failure ROADMAP 1.223 deleted, re-entering through
 * the hero's own local fallback.
 */
export const MISALIGNED_BAND_REPORT: DecisionVerdictReportLike = {
  option_probabilities: OPTION_PROBABILITIES,
  robustness: { recommended_option_id: MID_ID },
  decision_brief: {
    headline_banded: {
      band: 'clearly_ahead',
      leader_option_id: MID_ID,
      robustness_gated: false,
    },
  } as unknown as DecisionVerdictReportLike['decision_brief'],
}

/** The hero-prop form of the same band (`DecisionResultData.headlineBanded`). */
export const MISALIGNED_BAND = {
  band: 'clearly_ahead' as const,
  leaderOptionId: MID_ID,
  robustnessGated: false,
}

export const WITHHELD_VERDICT = deriveDecisionVerdict(WITHHELD_REPORT)
export const PERMITTED_VERDICT = deriveDecisionVerdict(PERMITTED_REPORT)
export const MISALIGNED_BAND_VERDICT = deriveDecisionVerdict(MISALIGNED_BAND_REPORT)

/** Options in CANONICAL order, as the hook now emits them on a withheld run. */
export function withheldFixtureOptions(): OptionResult[] {
  return [
    {
      id: LOW_ID,
      label: LOW_LABEL,
      expected: 40,
      outcome: { mean: 40, p10: 30, p50: 40, p90: 50 },
      p10: 30,
      p50: 40,
      p90: 50,
      isRecommended: false,
      winProbability: WIN_LOW,
      goalProbability: 0.2,
    },
    {
      id: MID_ID,
      label: MID_LABEL,
      expected: 55,
      outcome: { mean: 55, p10: 45, p50: 55, p90: 65 },
      p10: 45,
      p50: 55,
      p90: 65,
      isRecommended: false,
      winProbability: WIN_MID,
      goalProbability: 0.45,
    },
    {
      id: HIGH_ID,
      label: HIGH_LABEL,
      expected: 70,
      outcome: { mean: 70, p10: 60, p50: 70, p90: 80 },
      p10: 60,
      p50: 70,
      p90: 80,
      isRecommended: true,
      winProbability: WIN_HIGH,
      goalProbability: 0.8,
    },
  ] as OptionResult[]
}

/**
 * The SWEEP RUN's shape: every option's goal probability below the shared
 * sub-1% floor (UI-SEM-057), so `allGoalBelowFloor` is true and the hero
 * headlines "No option is currently on track…".
 *
 * This is the run the 2026-07-27 browser sweep captured on the deployed
 * build, where the subline underneath still read
 * "<option> has the highest expected outcome."
 */
export function flooredGoalFixtureOptions(): OptionResult[] {
  return withheldFixtureOptions().map((o) => ({ ...o, goalProbability: 0.002 }))
}

/**
 * The MISALIGNED-BAND run's shape: MID is the recommended option, and no
 * goal crown exists (uniform goal fits tie at the max), so the banded
 * analysis-leader headline is the branch under test.
 */
export function misalignedBandFixtureOptions(): OptionResult[] {
  return withheldFixtureOptions().map((o) => ({
    ...o,
    isRecommended: o.id === MID_ID,
    goalProbability: 0.4,
  })) as OptionResult[]
}

/**
 * The NO-RECOMMENDATION run's shape: no row is the recommended option, so
 * the hero falls to the branch that headlines the outcome fact itself.
 * Goal fits are uniform (tied at the max) so no goal crown intercepts.
 */
export function noRecommendationFixtureOptions(): OptionResult[] {
  return withheldFixtureOptions().map((o) => ({
    ...o,
    isRecommended: false,
    goalProbability: 0.4,
  })) as OptionResult[]
}

/**
 * Superlative/entitlement vocabulary that must not appear in HERO COPY on a
 * withheld run, over and above the no-label rule.
 *
 * Separate from `DESIGNATION_RE` on purpose, and NARROWER: `DESIGNATION_RE`
 * screens screen-reader strings, where "top option" is itself a designation.
 * The hero's own sanctioned no-claim lines ("Compare the top options before
 * deciding.", "The top options are close on expected outcome.") contain that
 * phrase by design, so screening hero prose with `DESIGNATION_RE` would fail
 * the very copy this contract prescribes. What hero prose may never do is
 * assert a superlative or an entitlement — with or without a name.
 *
 * Verified inert against every neutral hero string it must tolerate:
 *   · 'No option is currently on track to meet every target this run scored.'
 *   · 'No option is currently on track to meet your goal and limits.'
 *   · 'Here is how your options compare.'
 *   · 'No option is clearly ahead.'          (a producer TIE claim, not ours)
 *   · 'Compare the top options before deciding.'
 *   · 'The top options are close on expected outcome.'
 */
export const HERO_CLAIM_RE =
  /\b(highest|strongest|most likely|slightly ahead|leads|leading|winner|best)\b/i

/**
 * Every string a screen reader can reach that is NOT ordinary body text:
 * explicit `aria-label`s, plus the text of any `sr-only` node — which is
 * exactly how the leader cue is delivered: invisible on screen, spoken
 * aloud, and therefore invisible to a visual review of the same page.
 */
export function screenReaderStrings(container: HTMLElement): string[] {
  const out: string[] = []
  for (const el of Array.from(container.querySelectorAll<HTMLElement>('[aria-label]'))) {
    out.push(el.getAttribute('aria-label') ?? '')
  }
  for (const el of Array.from(container.querySelectorAll<HTMLElement>('.sr-only'))) {
    out.push(el.textContent ?? '')
  }
  return out.filter(Boolean)
}

/**
 * Rendered row order, read from `data-option-id` rather than label text —
 * the label element also carries the sr-only leader cue on a permitted run,
 * so a text comparison would conflate the ORDER leg with the A11Y leg.
 */
export function renderedRowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-option-id]')).map(
    (n) => n.getAttribute('data-option-id') ?? '',
  )
}

/** Designation vocabulary that must never reach a screen reader on withheld. */
export const DESIGNATION_RE = /highest|leading|leads|winner|best|top option|rank ?1|#1/i
