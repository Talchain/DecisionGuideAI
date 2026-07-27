/**
 * v7LensCopy — all UI-authored copy for the V7 lens group + evidence
 * disclosure (V7 Lane L5).
 *
 * British English, sentence case, no all-caps, no em dashes in prose (the
 * '—' in the What-changed empty state is the spec-ratified wording, mirrored
 * verbatim from V6-RESPEC-2026-07-23 row 6d). Honest-gate strings state WHY a
 * lens is empty and what unlocks it — never a fabricated chart, never an
 * inferred number. The gate wording deliberately echoes the live analysis
 * hero's honest-unavailable register (heroCopy.lensUnavailable) so the two
 * surfaces can never disagree about what "not produced yet" means.
 */

export const V7_LENS_COPY = {
  /** Accessible name for the lens tablist. */
  tablistAria: 'Results lens',

  /** Lens tab labels. "What changed" is the SHORT tab label; the panel
   * heading disambiguates it as "in the result" (Paul-question P4 — distinct
   * from the pushed-down WhatChangedChip's "in the model" graph diff). */
  lensLabel: {
    outcome: 'Likely outcome',
    goal: 'Goal fit',
    /** Lens NAME only — naming a view, not a claim about this run. */
    stability: 'Stability',
    whatChanged: 'What changed',
  } as const,

  /** Screen-reader suffix for a lens whose data is unavailable this run. */
  srLensUnavailable: 'not available for this run',

  outcome: {
    caption: 'Dots show the median. Bars show the realistic range (10th to 90th percentile).',
    /** Shown when no option carries a distribution or a win probability. */
    gate: 'Likely outcome is not available for this run.',
    /**
     * ROADMAP 1.239: was `Leads {formatted}`. The probe found it 18 times on
     * every run including withheld ones, because the lens labels EVERY option
     * this way ("Leads 52% / Leads 30% / Leads 18%"). Applied to all options it
     * designates none — but it is a leader verb on a metric and the ordinal
     * reads straight off it.
     *
     * RELABELLED rather than gated, following #493's WinGauge precedent
     * exactly: gating would delete the win-probability DATA from the panel
     * (over-suppression), and a carve-out list of "leader words that are
     * actually fine" is the hand-maintained mirror trap 12 warns about. The
     * noun is not new copy — the canvas node, WinGauge and the confidence
     * ring caption already say it. Number-first matches `goal.hitReadout`
     * below, so the two lenses stay one voice.
     */
    winReadout: (formatted: string) => `${formatted} win probability`,
  },

  goal: {
    caption: 'Each value is the chance that option reaches your success target.',
    /** No user target set — user-actionable, distinct from the producer gap. */
    gateNoTarget: 'Set a success target to unlock Goal fit.',
    /** A target is set but the engine returned no per-option goal probabilities. */
    gateProducerGap: 'Goal fit unlocks when the engine returns per-option goal probabilities for this run.',
    hitReadout: (formatted: string) => `${formatted} hit target`,
    /** Mirrors OptionCards' sub-1% display-honesty affordance (UI-SEM-057). */
    subOnePercent: '< 1%',
  },

  stability: {
    /** Honest gap — per-option stability is not on the wire, and Olumi will
     * not infer it (V6-RESPEC row 6c). */
    heading: 'Stability',
    gate: 'Per-option stability is not produced yet, and Olumi will not infer it. The overall stability verdict lives in the footer below.',
  },

  whatChanged: {
    /** Panel heading — P4 distinctness ("in the result", not "in the model"). */
    heading: 'What changed in the result',
    /** Honest empty state — the common case on the live path, where run
     * history is usually empty (its writer is Run-button-gated on results.seed).
     * Wording ratified in V6-RESPEC row 6d. */
    empty: 'Snapshot unavailable — rerun to compare.',
    emptyDetail: 'This compares your two most recent runs. Run the analysis again to build a comparison.',
    p50Label: 'Median outcome',
    edgesLabel: 'Model edges',
    driversAddedLabel: 'Drivers added',
    driversRemovedLabel: 'Drivers removed',
    noDriverChange: 'No change in the drivers.',
  },

  evidence: {
    heading: 'Why, and what could change it',
    subtitle: 'Drivers, flip risks and trade-offs',
    driversTab: 'Drivers',
    flipRisksTab: 'Flip risks',
    tradeOffsTab: 'Trade-offs',
    driversNote: 'Ranked by effect on the analysed outcome.',
    /** Low-confidence tag — the factor value or its confidence was defaulted
     * (an estimate), a direct producer read (never a threshold). */
    estimateTag: 'est.',
    estimateTagAria: 'estimated value',
    seeMore: (n: number) => `Show ${n} more`,
    showFewer: 'Show fewer',
    driversGate: 'No drivers to show for this run.',
    /**
     * ROADMAP 1.267 — the note is a CLAIM, the rows beneath it are DATA.
     *
     * "…can change the leading option" PRESUPPOSES a leading option exists.
     * On a withheld run it therefore asserted, in a flagless section, exactly
     * what CEE had just declined to say — and it did so unconditionally,
     * because a static string has no gate.
     *
     * Taken as ONE function of the verdict rather than two sibling constants:
     * a `flipRisksNoteWithheld` key beside this one would be a hand-maintained
     * mirror (trap 12) that a future copy edit could update on one branch
     * only. The permitted branch is byte-identical to the string it replaced,
     * so a permitted run cannot change.
     */
    flipRisksNote: (designationsWithheld: boolean) =>
      designationsWithheld
        ? 'Relationships whose plausible range can change how the options compare.'
        : 'Relationships whose plausible range can change the leading option.',
    flipSwitchMeta: (pct: string) => `${pct} switch`,
    flipRisksGate: 'No flip risks to show for this run.',
    /** Same treatment, same reason, as `flipRisksNote` above. */
    tradeOffsNote: (designationsWithheld: boolean) =>
      designationsWithheld
        ? 'Where the comparison between options depends on an assumption.'
        : 'Where the leading option depends on an assumption.',
    tradeOffsGate: 'No trade-offs to show for this run.',
    /** Conditional-winner narration — all values are producer-supplied
     * (factor label, split value/unit, winner labels); nothing invented. */
    tradeOffSplit: (factor: string, value: string, high: string, low: string) =>
      `If ${factor} is above ${value}, ${high} leads; below it, ${low} leads.`,
  },
} as const
