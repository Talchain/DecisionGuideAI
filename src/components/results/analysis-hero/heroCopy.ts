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

import { COMPARATIVE_COPY, GOAL_ANCHOR_COPY } from '../utils/goalAnchorCopy'

export const HERO_COPY = {
  panelAria: 'Analysis',
  tablistAria: 'Results lens',

  /** Per-lens accessible name for the option rows container (prototype ARIA:
   * the outcome table is "Expected outcome by option"). */
  rowsAria: {
    goal: 'Goal fit by option',
    outcome: 'Expected outcome by option',
    stability: 'Stability by option',
    whatChanged: 'Expected outcome by option',
  } as const,

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
    /** Inline unlock action beside goalNoTarget — rendered ONLY when a
     * define-success route is wired (never a dead control). */
    goalDefineSuccess: GOAL_ANCHOR_COPY.noTargetCta,
    goalProducerGap: 'Goal fit is not available for this run.',
    outcome: 'Likely outcome is not available for this run.',
    stability:
      'This view needs per-option stability data, which the analysis does not provide yet.',
    /**
     * F15: names the real dependency (producer-versioned run comparisons,
     * PLoT #212) in the ratified honest-unavailable register. Must never
     * read as a session-local unlock, and must state that Olumi will not
     * approximate the comparison locally (no client-side run diffing).
     */
    whatChanged:
      'Run comparison is not available yet. This unlocks with versioned run comparisons. Olumi will not approximate it locally.',
  } as const,

  headline: {
    goalWithLimits: (label: string, readout: string) =>
      `${label} has the highest chance of meeting your goal and limits: ${readout}.`,
    /**
     * GOAL-ATTAINMENT IDENTITY, interim wording (family 2, slice −1) — the
     * same claim, in the same words, as `caption.goalOnly` and
     * `detail.goalFitJointBasis`. See the block above `noneOnTrack` for the
     * full producer trace and why all three had to move together.
     *
     * The crown is the UNIQUE argmax of the goal probability among rows that
     * all carry one (UI-SEM-072), clearing the sub-1% floor — so "most likely
     * to meet" names exactly the quantity the caption below and the row detail
     * beneath it show. It was `"{label} best fits your goal."`, which asserted
     * a possessive over a number that, when the user has set constraints, does
     * not involve the goal at all.
     */
    goalOnly: (label: string, readout: string) =>
      `${label} has the highest chance of meeting every target this run scored: ${readout}.`,
    // DELETED 2026-07-26 (ROADMAP 1.223): `analysisLeads` — "{label} currently
    // leads the overall analysis." It was the UNBANDED leader claim, reached
    // only when no band could be resolved. Once the UI stopped banding win
    // probabilities itself, "no band" came to mean "the producer made no
    // leader claim", so this string became the exact sentence a withheld turn
    // must not print. That branch now takes `noLeader` below. Deleted rather
    // than left dangling: dead copy beside a live selector is an invitation to
    // re-wire it.
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
    /**
     * ⭐ RE-ANCHORED 2026-07-31. Was `"{label} is most likely to be strongest
     * overall."` — a bare superlative over an unnamed basis: a reader could
     * not tell what it was strongest AT, and it carried no number to argue
     * with. The claim was always grounded in the COMPARATIVE quantity (see
     * the block above), so it now says so, with its magnitude.
     */
    mostLikelyStrongest: (label: string, readout: string | null) => {
      const claim = readout ? COMPARATIVE_COPY.clause(readout) : COMPARATIVE_COPY.phraseNoMagnitude
      return `${label} ${claim}.`
    },
    /** Banding state B: ahead on win probability without a strong majority. */
    slightlyAhead: (label: string) => `${label} is slightly ahead.`,
    /** Banding state C: the win probabilities identify no clear leader. */
    noClearLeader: 'No option is clearly ahead.',
    /** Fallback when no recommended option exists among the rows: headline the outcome fact itself. */
    outcomeLeader: (label: string, readout: string) =>
      `${label} has the highest expected outcome: ${readout}.`,
    /**
     * Goal honesty: every option's goal probability sits below the sub-1%
     * floor (UI-SEM-057) — crowning any option would be false, so the headline
     * states the decision-relevant truth instead.
     * Constraint-aware like every other goal claim: under constraints the
     * floored figure is the JOINT (goal AND limits) probability, and the
     * axis/caption already say "goal and limits" — the headline must match.
     *
     * ⭐ GOAL-ATTAINMENT IDENTITY, interim wording (family 2, slice −1).
     * This string, `headline.goalOnly`, `caption.goalOnly` and
     * `detail.goalFitJointBasis` are ONE claim on four surfaces and must stay
     * in the same voice. They were changed together because they had drifted
     * apart in a way the user could see in a single render: the row detail
     * withheld the possessive while the headline and caption above it asserted
     * it, about the same number, on every live run.
     *
     * WHY. The number every live V5 run renders here is
     * `probability_of_joint_goal`. Two live cases produce it and the UI cannot
     * tell them apart:
     *   A. no user constraints — PLoT synthesises ONE constraint from the goal
     *      threshold, on the goal node, `>=`, and ISL evaluates it against the
     *      EXACT goal samples. The figure IS goal attainment, over exactly one
     *      target, and that target is the user's own. "All targets together"
     *      over-stated plurality on 100% of live runs.
     *   B. user constraints present — PLoT SKIPS the synthesis and DISCARDS the
     *      goal threshold, so the number does not involve the goal at all and
     *      "your goal" would be false.
     * The discriminator does not exist in contract: PLoT's attestation
     * (`_meta.constraint_sources`) is stripped at CEE's transport keep-list,
     * and the only local signal is an undeclared magic string on another
     * service's internal constant. Sniffing it would be the hand-maintained
     * mirror this family exists to remove, so the copy asserts neither a count
     * nor a possessive and is true in BOTH cases.
     *
     * INTERIM: retires when CEE ships the goal verdict with an explicit
     * measure scope and the copy can be exact.
     */
    noneOnTrack: 'No option is currently on track to meet every target this run scored.',
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
    highestOutcome: (label: string, readout: string) =>
      `${label} has the highest expected outcome: ${readout}.`,
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
    // Goal-lens axes retired with the goal tracks (prototype v6: the goal
    // table renders badges + labels + probabilities only, no bars — an axis
    // would describe geometry the lens no longer draws).
    outcome: { left: 'lower', mid: 'expected outcome', right: 'higher' },
  } as const,

  caption: {
    // Value-based wording (not "each bar"): the goal lens draws no tracks
    // (prototype v6), so the caption describes the readouts it shows.
    goalWithLimits: 'Each value is the chance that option meets your goal and limits together.',
    /**
     * GOAL-ATTAINMENT IDENTITY, interim wording (family 2, slice −1) — the
     * same claim, in the same words, as `headline.goalOnly` /
     * `headline.noneOnTrack` and `detail.goalFitJointBasis`. See the block
     * above `noneOnTrack` for the producer trace. It was `"Each value is the
     * chance that option hits your goal."`, which asserted the possessive the
     * row detail directly beneath it was written to withhold.
     */
    goalOnly: 'Each value is the chance that option meets every target this run scored.',
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
    /**
     * RE-ANCHORED: was `"{N}% chance it is the strongest option overall."` —
     * "strongest overall" named no basis. Aligned to the house comparative
     * register, which says exactly what the number measures.
     */
    winChance: (formatted: string) => COMPARATIVE_COPY.sentence(formatted),
    /** Grounded lines from existing adapted fields — never authored prose. */
    range: (low: string, high: string) => `Realistic range: ${low} to ${high}.`,
    goalFit: (readout: string) => GOAL_ANCHOR_COPY.sentence(readout, false),
    goalFitWithLimits: (readout: string) => `${readout} chance of meeting your goal and limits.`,
    /**
     * Goal-probability IDENTITY: used when the row's number is
     * `probability_of_joint_goal` STANDING IN for an absent
     * `goal_probability` (flagged by the shared selector as
     * `basis: 'joint_goal_substituted'` — which, on the live V5 wire, is
     * EVERY run). The number is shown, unchanged: this is a copy switch,
     * never a value transform.
     *
     * GOAL-ATTAINMENT IDENTITY, interim wording (family 2, slice −1) — the
     * same claim, in the same words, as `headline.goalOnly` /
     * `headline.noneOnTrack` and `caption.goalOnly`. See the block above
     * `noneOnTrack` for the producer trace. It was `"...chance of meeting all
     * targets together."`, which over-stated plurality: on the ordinary run
     * there is exactly ONE target and it is the user's own goal threshold.
     * "Every target" is true over a singleton and over a set, so it asserts
     * no count — and no possessive, which would be false when the user HAS
     * set constraints and PLoT discards the goal threshold.
     */
    goalFitJointBasis: (readout: string) => GOAL_ANCHOR_COPY.sentence(readout, true),
  },

  /**
   * §6.5 quick evidence PILLS — the .hero-summary row between the lens body
   * and the evidence disclosure (prototype 1d). Pill labels carry no
   * trailing full stop (they are pills, not sentences). `combined` renders
   * when the main driver and the top flip risk are the SAME factor — one
   * pill labelled for both, never two pills pointing at one node.
   */
  pills: {
    mainDriver: (factor: string) => `Main driver: ${factor}`,
    topFlipRisk: (factor: string) => `Top flip risk: ${factor}`,
    combined: (factor: string) => `Main driver and top flip risk: ${factor}`,
  },

  /**
   * Next-step footer row (prototype §5 .analysis-next-route): mirrors the
   * TOP active Strengthen entry. Label is 'Next step', not the prototype's
   * 'Next recommendation' — 'recommendation' is a canonical glossary banned
   * term for hero copy (same voice rule the Strengthen panel follows with
   * 'worth checking'), so the label deviates deliberately.
   */
  nextRec: {
    label: 'Next step',
    open: 'Open',
    openAria: 'Scroll to the Strengthen your model panel',
  },

  /**
   * §6.2 pause-read resolution action — 'Resolve with Olumi' opens the
   * Ask-Olumi drawer with the contradiction as context and this editable
   * draft prefilled. The contradiction body itself is producer text
   * rendered verbatim; only the button label and draft are authored here.
   */
  paused: {
    resolveButton: 'Resolve with Olumi',
    askLabel: 'Resolve the conflict in the decision brief',
    draft: 'Help me work through the conflict in my decision brief.',
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
    // C1: the footer 'rerun' entry is retired with the hero's stale Re-run
    // pill — the freshness strip owns the one Rerun (Wave F-B, brief §5).
  },

  // §6.6 — one expandable evidence section, three views. Flip-risk
  // sentences are format-only over producer flipThresholds values (the
  // direction is arithmetic on current_value vs flip_value, the unit is
  // the producer's user unit) — nothing invented, no internal terms.
  evidence: {
    heading: 'Why and what could change it',
    /** Disclosure-toggle subtitle line (prototype §3 anatomy). */
    subtitle: 'Drivers, flip risks and trade-offs',
    driversTab: 'Drivers',
    flipRisksTab: 'Flip risks',
    tradeOffsTab: 'Trade-offs',
    /** Drivers-view note (prototype copy). "Evidence quality is separate"
     * states only that this list does not rank by evidence — no quality
     * claim is made (the per-row quality slot stays absent until a
     * display-safe producer label exists, issues 219/221). */
    driversNote: 'Ranked by effect on the analysed outcome. Evidence quality is separate.',
    /**
     * Flip-risks-view note (prototype copy).
     *
     * ROADMAP 1.267 — the flip PROBABILITIES are data; "the leading option"
     * is a claim, and it presupposes one exists. The withheld branch keeps
     * the same fact (a relationship varied within its plausible range moves
     * the result) without the presupposition. Permitted is byte-identical to
     * the string it replaced.
     *
     * One function of the verdict, not two sibling constants: a `…Withheld`
     * twin beside it would be a hand-maintained mirror (trap 12).
     */
    flipRisksNote: (designationsWithheld: boolean) =>
      designationsWithheld
        ? 'Chance the comparison between options changes when a relationship is varied within its plausible range.'
        : 'Chance the leading option changes when a relationship is varied within its plausible range.',
    /** Switch-probability meta beside a flip row, e.g. "48% switch". */
    switchMeta: (pct: string) => `${pct} switch`,
    seeAllFactors: 'See all factors',
    showFewer: 'Show fewer',
    /**
     * ROADMAP 1.267. The producer's `alternative_winner_label` SURVIVES on a
     * withheld run — it is data, and dropping it would be the
     * over-suppression the ruling forbids. What goes is the designation
     * verb: "becomes the likely leader" both asserts a leader exists after
     * the flip and implies a different one exists now.
     */
    flipRiskWithAlternative: (
      factor: string,
      direction: string,
      value: string,
      alternative: string,
      designationsWithheld: boolean,
    ) =>
      designationsWithheld
        ? `If ${factor} ${direction} ${value}, the comparison shifts towards ${alternative}.`
        : `If ${factor} ${direction} ${value}, ${alternative} becomes the likely leader.`,
    flipRiskNoAlternative: (
      factor: string,
      direction: string,
      value: string,
      designationsWithheld: boolean,
    ) =>
      designationsWithheld
        ? `If ${factor} ${direction} ${value}, the comparison is likely to change.`
        : `If ${factor} ${direction} ${value}, the leading option is likely to change.`,
    fallsBelow: 'falls below',
    risesAbove: 'rises above',
    // Direction-neutral fallback (UI-SEM-074): used when flip_value equals
    // current_value — a direction claim would not be honestly determinable.
    crosses: 'crosses',
    tradeOffGain: 'You gain',
    tradeOffGiveUp: 'You give up',
    tradeOffDependsOn: 'Depends on',
    tradeOffWatch: 'Watch',
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

  /**
   * Screen-reader-only cue so the crowned row is perceivable without colour.
   *
   * ROADMAP 1.223: was "Leads on this view". REWORDED — the wording states
   * what it marks, the highest row on the lens in view. Note it is sr-only
   * but NOT invisible to auditing: text extraction sees it, which is how the
   * render probe caught it.
   *
   * ⚠ CORRECTED 27 Jul (ROADMAP 1.267). This entry used to continue
   * "…deliberately NOT gated on the leader verdict", arguing that the
   * per-lens crown is an ARGMAX over the data the lens is drawing — "a
   * property of the view, not the producer's leader designation" — and that
   * suppressing it would be over-suppression.
   *
   * THAT REASONING IS OVERTURNED, at the screenshots, in row 1.306. An
   * argmax rendered as a filled badge, an emphasised readout, `aria-current`
   * and a spoken label is a DESIGNATION whatever it is derived from, and
   * this one was being announced to screen-reader users on the same screen
   * as CEE's own "no option can be put forward yet". Ruling 1.267 draws the
   * line at designation-vs-data, not at who computed the argmax.
   *
   * The STRING is still correct and still used — on a PERMITTED run. It is
   * now gated at its source: `buildHeroModel` nulls every entry of
   * `HeroChartModel.leaders` when the verdict withholds, which removes this
   * cue together with the badge fill, the readout emphasis, the bar colours
   * and `aria-current` in one place. Pinned by
   * `__tests__/withheldDesignations.hero.spec.tsx`, including the real
   * accessible-name computation.
   *
   * Kept as a correction rather than a rewrite because the superseded
   * argument is a good one that was applied to the wrong side of the line —
   * and a comment that quietly changed its mind would be the stale-label
   * defect CLAUDE.md trap 14 exists to catch.
   */
  srLeader: 'Highest on this view',

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
