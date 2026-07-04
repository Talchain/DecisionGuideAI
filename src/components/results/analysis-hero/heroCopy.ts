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
    /** Fallback when no recommended option exists among the rows: headline the outcome fact itself. */
    outcomeLeader: (label: string) => `${label} has the highest expected outcome.`,
    /**
     * Goal honesty: every option's goal probability sits below the sub-1%
     * floor (UI-SEM-057) — crowning any option "best fits your goal" would
     * be false, so the headline states the decision-relevant truth instead.
     */
    noneOnTrack: 'No option is currently on track to reach your goal.',
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
    outcome: 'Bars show the realistic range of outcomes. Where ranges overlap, treat the order as unsettled.',
    outcomeTarget: (target: string) => `The dashed line marks your target of ${target}.`,
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
    couldChangeIf: (factor: string, value: string) => `${factor} crosses ${value}.`,
    winChance: (formatted: string) => `${formatted} chance it is the strongest option overall.`,
  },

  footer: {
    mainReason: (factor: string) => `Main reason: ${factor} has the strongest effect on this result.`,
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
} as const
