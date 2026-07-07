/**
 * Analysis hero panel — ALL UI-authored copy.
 *
 * British English, sentence case, no all-caps, no em dashes. Scanned by
 * __tests__/copyHygiene.spec.tsx against the canonical glossary banned-term
 * list, so every string here must stay glossary-safe. Producer-supplied text
 * (story headlines, option labels in row titles) is rendered verbatim
 * elsewhere and is deliberately NOT routed through this file.
 *
 * Option/factor labels interpolated into these templates are gated with
 * safeInterpolatedLabel first (generated copy only — user data is never
 * rewritten where it appears verbatim).
 */

export const HERO_COPY = {
  panelAria: 'Analysis summary',
  tablistAria: 'Results lens',

  lensLabel: {
    goal: 'Goal fit',
    outcome: 'Likely outcome',
    /**
     * Lens NAMES only — "Stability" here names a view (prototype tab
     * label), it does not claim anything about this run. Trust-vocabulary
     * hygiene carves out exactly this navigation use; every stability
     * CLAIM still renders only from producer-supplied text.
     */
    stability: 'Stability',
    whatChanged: 'What changed',
  } as const,

  /**
   * Honest unavailable-lens bodies. Selecting an unavailable lens shows
   * WHY it is empty and what unlocks it — never a dead tab, never a
   * fabricated chart. The goal lens distinguishes the user-actionable
   * no-target case from the producer gap.
   */
  lensUnavailable: {
    goalNoTarget: 'Set a success target to unlock Goal fit.',
    goalProducerGap: 'Goal fit is not available for this run.',
    outcome: 'Likely outcome is not available for this run.',
    stability:
      'This view needs per-option stability data, which the analysis does not provide yet.',
    whatChanged:
      'This view compares runs. It unlocks when the analysis can report what changed between runs.',
  } as const,

  headline: {
    goalWithLimits: (label: string) => `${label} best meets the goal and your limits.`,
    goalOnly: (label: string) => `${label} best fits your goal.`,
    /**
     * No-goal-basis leader claim. Named leader MUST be the Results Panel's
     * recommendedOption (the canonical analysis leader — producer-supplied
     * or win-probability argmax), never an outcome-lens inference: the
     * retired "currently looks strongest" wording implied outcome-lens
     * evidence and contradicted the visible chart when the two leaders
     * diverged (staging trust review).
     */
    analysisLeads: (label: string) => `${label} currently leads the overall analysis.`,
    /**
     * Leader-claim banding — producer-first (Lane UI-W4, PLoT #200): the
     * band is PLoT's own decision_brief.headline_banded when present
     * (clearly_ahead selects this claim), with the UI's win-probability
     * banding (UI-SEM-060) as the absent-producer fallback only. Either
     * way the "most likely" claim is grounded in producer win
     * probabilities (the same quantity the detail's "chance it is the
     * strongest option overall" line shows) — never in outcome-lens
     * inference or range overlap. Range overlap alone must never temper or
     * manufacture a closeness claim; it only appends the overlap advisory
     * to the state-A subline.
     */
    mostLikelyStrongest: (label: string) => `${label} is most likely to be strongest overall.`,
    /** Banding state B: ahead on win probability without a strong majority. */
    slightlyAhead: (label: string) => `${label} is slightly ahead.`,
    /** Banding state C: the win probabilities identify no clear leader. */
    noClearLeader: 'No option is clearly ahead.',
    /** Fallback when no recommended option exists among the rows: headline the outcome fact itself. */
    outcomeLeader: (label: string) => `${label} has the highest expected outcome.`,
    /**
     * Goal honesty: every option's goal probability sits below the sub-1%
     * floor (UI-SEM-057) — crowning any option "best fits your goal" would
     * be false, so the headline states the decision-relevant truth instead.
     * Constraint-aware like every other goal claim: under constraints the
     * floored figure is the JOINT (goal AND limits) probability, and the
     * axis/caption already say "goal and limits" — the headline must match.
     */
    noneOnTrack: 'No option is currently on track to reach your goal.',
    noneOnTrackWithLimits: 'No option is currently on track to meet your goal and limits.',
    singleOption: (label: string) => `${label} is your only option.`,
    noLeader: 'Here is how your options compare.',
  },

  subline: {
    /**
     * Persistent divergence subline: whenever the headlined leader is not
     * the expected-outcome leader (goal basis or not), the tension is
     * stated in one plain sentence naming the outcome leader.
     */
    highestOutcome: (label: string) => `${label} has the highest expected outcome.`,
    aligned: (label: string) => `${label} also has the strongest expected outcome.`,
    /**
     * Banding state B subline (producer band or UI-SEM-060 fallback): the
     * runner-up is named from the SAME rendered outcome ranking the chart
     * shows, and ONLY when the top-two expected outcomes are genuinely
     * close — never from range overlap alone.
     */
    closeOnOutcome: (label: string) => `${label} is close on expected outcome.`,
    /**
     * Readout-tie subline (UI-SEM-070): the top-two options render the SAME
     * expected-outcome readout, so the chart cannot single one out. A neutral
     * plural statement — no name (naming a runner-up among tied values would
     * be arbitrary) and no "strongest/highest" claim the numbers contradict.
     */
    outcomesClose: 'The top options are close on expected outcome.',
    /** Banding state C companion line (no leader claimed, no name risked). */
    compareTop: 'Compare the top options before deciding.',
    /**
     * Appended to the state-A subline when the top-two p10-p90 ranges
     * intersect: overlap is stated as uncertainty about the ranges, without
     * downgrading the win-probability-grounded leader claim.
     */
    overlapAdvisory: 'Realistic ranges overlap, so validate the assumptions before deciding.',
  },

  /** Fallback when a label cannot be safely interpolated into generated copy. */
  labelFallback: 'This option',
  factorFallback: 'a key assumption',

  axis: {
    goalWithLimits: { left: '0%', mid: 'chance of meeting goal and limits', right: '100%' },
    goalOnly: { left: '0%', mid: 'chance of hitting goal', right: '100%' },
    outcome: { left: 'lower', mid: 'expected outcome', right: 'higher' },
  } as const,

  caption: {
    goalWithLimits: 'Each bar is the chance that option meets your goal and limits together.',
    goalOnly: 'Each bar is the chance that option hits your goal.',
    /** Base outcome caption — shown when TWO OR MORE rows draw p10-p90 lines. */
    outcome: 'Dots show expected outcome. Lines show the realistic range.',
    /**
     * Appended only when TWO OR MORE rows draw range lines — with a single
     * line no two ranges can overlap, so the sentence would over-describe
     * the chart.
     */
    outcomeOverlap: 'Where ranges overlap, treat the order as unsettled.',
    /** Exactly one drawn line — singular wording, no overlap sentence. */
    outcomeSingleRange: 'Dots show expected outcome. The line shows the realistic range.',
    /** Shown when no row carries a range — never describe lines that are not drawn. */
    outcomeDotsOnly: 'Dots show expected outcome for each option.',
    /**
     * Stability lens explainer — renders ONLY when the lens carries data
     * (producer-backed; fixture-only until issue 211). Reviewer-supplied
     * wording, extended with a per-option clarifier so a strong leader
     * under a cautious overall verdict does not read as contradictory.
     * Lens-explainer register (like the "Stability" tab name and the
     * unavailable copy), NOT a per-run trust claim — it describes what the
     * view measures, never a verdict about this run. Scanned in the
     * copyHygiene lens-naming carve-out (it legitimately names the view);
     * "firmly" is not the banned "firm" token (word boundary), but the
     * carve-out is the correct home because the string contains
     * "Stability".
     */
    stability:
      'Stability shows how firmly each option holds its position under uncertainty. It describes each option separately, not the analysis as a whole.',
  },

  readout: {
    goalSuffix: 'fit',
    /**
     * Missing-value placeholder GLYPH — deliberately an em dash, matching
     * the app-wide convention (src/lib/format.ts `nullPlaceholder: '—'`).
     * The module's no-em-dash rule applies to prose copy, not this token;
     * copyHygiene.spec excludes it explicitly for the same reason.
     */
    missing: '—',
    /** Mirrors OptionCards' sub-1% display-honesty affordance (UI-SEM-057). */
    subOnePercent: '< 1%',
  },

  detail: {
    whyLabel: 'Why',
    couldChangeIfLabel: 'Could change if',
    /** Labels only — the content is producer-supplied (issue 217), never authored here. */
    watchLabel: 'Watch',
    tradeOffLabel: 'Trade-off',
    couldChangeIf: (factor: string, value: string) => `${factor} crosses ${value}.`,
    winChance: (formatted: string) => `${formatted} chance it is the strongest option overall.`,
    /** Grounded lines from existing adapted fields — never authored prose. */
    range: (low: string, high: string) => `Realistic range: ${low} to ${high}.`,
    goalFit: (readout: string) => `${readout} chance of hitting your goal.`,
    goalFitWithLimits: (readout: string) => `${readout} chance of meeting your goal and limits.`,
  },

  footer: {
    /**
     * Names the top driver only — no causal implication. An implication
     * sentence ("the result depends on…") is UI-authored causal prose and
     * stays forbidden until a producer rationale string exists.
     */
    mainReason: (factor: string) => `Main driver: ${factor}.`,
    /**
     * Focus-next reconciliation (review-locked): the coaching panel's rows
     * are composed POSITIONALLY (buildFocusRows: server rows in received
     * order, then static hygiene rows — "NOT meaning-based ranking"),
     * while vm.topAction derives from selectHinge (fragile-edge/VOI
     * priority) — a different signal. The hero therefore names NO specific
     * action: this neutral line points at the panel as a whole (the scroll
     * affordance targets the panel container, never a row), so it can
     * never disagree with whatever the panel's actual top row is.
     */
    focusNext: 'Focus next: review the top actions below.',
    focusNextAria: 'Scroll to the actions panel below',
    /**
     * Single-lens promotion: when the goal lens is absent because no
     * success target exists (goalThreshold null — never a producer gap),
     * the Focus-next slot carries the unlock action instead of the generic
     * line. Actionable only when a real apply route is wired (the same
     * setGoalThreshold + rerun handler the Options Compare target row
     * used); otherwise it renders as plain text — never a dead control.
     */
    focusTarget: 'Focus next: set a success target to unlock Goal fit.',
    /** Visible editor label — with the unit suffix, says WHAT to type before commit. */
    targetLabel: 'Success target',
    targetInputAria: 'Success target value',
    targetApply: 'Apply target and run the analysis again',
    /**
     * Rerun disclosure — shown WITH the editor, before any commit: applying
     * a target is analysis-affecting (it reruns), and the user must know
     * that before pressing Enter or the tick.
     */
    targetRerunNote: 'Applying runs the analysis again.',
    rerun: 'Re-run analysis',
  },

  status: {
    partial: {
      headline: 'Some analysis steps did not complete',
      body: 'Results are partial. Run the analysis again to see the full picture here.',
    },
    failed: {
      headline: 'The analysis did not complete',
      body: 'Run the analysis again to see results here.',
    },
    blocked: {
      headline: 'The analysis could not run',
      body: 'Resolve the items flagged on the canvas, then run the analysis again.',
    },
  },

  /** Screen-reader-only cue so the leader is perceivable without colour. */
  srLeader: 'Leads on this view',

  /** Screen-reader suffix for lenses whose data is unavailable this run. */
  srLensUnavailable: 'not available for this run',

  /**
   * Rendered whenever a model's provenance is 'fixture' — fixture data
   * must never be mistakable for real analysis output.
   */
  fixtureBanner: 'Internal preview: example data, not analysis output.',

  /** What-changed ghost-mark legend (drawn marks only, fixture lens today). */
  ghostLegend:
    'Faded marks show the previous run. Current marks show where the analysis moved.',
} as const
