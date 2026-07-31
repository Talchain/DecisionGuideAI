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

import { clampRevealLabel, clampCollapseLabel } from './ClampToggle'

import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from '../utils/goalAnchorCopy'

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
    winReadout: (formatted: string) => COMPARATIVE_COPY.phrase(formatted),
  },

  goal: {
    caption: 'Each value is the chance that option reaches your success target.',
    /** No user target set — user-actionable, distinct from the producer gap. */
    gateNoTarget: GOAL_ANCHOR_COPY.noTarget,
    /** A target is set but the engine returned no per-option goal probabilities. */
    gateProducerGap: 'Goal fit unlocks when the engine returns per-option goal probabilities for this run.',
    hitReadout: (formatted: string, isSubstitutedJoint: boolean) =>
      GOAL_ANCHOR_COPY.phrase(formatted, isSubstitutedJoint),
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
    /**
     * ⚠ R-11 — REFERENCES the shared definition rather than re-declaring the
     * string. See the twin note at `v7GuidanceCopy.showMore`: two differently
     * named functions returned this byte-identical label for the same affordance
     * in the same directory. `seeMore` keeps its name (the resolve-next spec
     * asserts through it); only the duplicate definition is gone.
     */
    seeMore: clampRevealLabel,
    showFewer: clampCollapseLabel,
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

    // ── Resolve next (V7-C slice 1, ROADMAP 2.141) ───────────────────────
    //
    // The five licensed sentences of V7C-EVPPI-RANKING-DESIGN-2026-07-30 §4,
    // plus that table's honest gate, reproduced VERBATIM. Paul's sign-off is
    // pending (design §8 Q2); verbatim use is what keeps his review meaningful,
    // so a deviation here gets flagged in the PR, never silently improved.
    //
    // WHAT LICENSES EACH SENTENCE (design §4):
    //   · resolveNextLead  ← rank-1 of the `status: 'resolved'` rows, in wire
    //     order, its label resolved from the canvas node for `factor_id`.
    //   · resolveNextThen  ← ranks 2..n of the resolved rows, wire order.
    //   · resolveNextBelow ← `status: 'below_resolution'`. NEVER "zero value"
    //     and never "not worth resolving": below-resolution means
    //     indistinguishable from noise AT THIS RUN'S RESOLUTION.
    //   · resolveNextNote  ← `method: 'regression_evppi_v1'` on every row. The
    //     honesty disclosure IS that we name the basis and the restraint. The
    //     em dash is the design's, kept against this file's own no-em-dash rule
    //     for the same reason the What-changed empty state keeps its one: the
    //     wording is ratified elsewhere and mirroring it inexactly is worse.
    //   · resolveNextPartial ← `inference_warnings[].code ===
    //     'FACTOR_EVPPI_PARTIAL'`, or any row this reader had to drop. It never
    //     names WHICH factors: the id lists are dropped at the PLoT hop and
    //     id-shaped names are banned anyway.
    //   · resolveNextGate  ← `factor_evppi` absent/null/empty/unusable. An
    //     honest gate, never a fabricated ranking and never a heuristic
    //     substitute (this surface exists to retire the `gap.voi` regime).
    //
    // NOT LICENSED, and absent from this deck by construction: any magnitude
    // (`evppi` and `decision_evpi` are in OUTCOME units), any percentage-point
    // figure, and any band beyond below-resolution.
    resolveNextTab: 'Resolve next',
    resolveNextNote:
      'Ranked by value of information — what a run says it is worth learning before deciding. No amounts shown.',
    resolveNextLead: 'Most worth resolving next',
    resolveNextThen: 'then',
    resolveNextBelow: (labels: string) => `Below resolution on this run: ${labels}`,
    resolveNextPartial: "Some factors couldn't be assessed for this ranking.",
    resolveNextGate: "Value-of-information ranking wasn't produced for this run.",
    /** Conditional-winner narration — all values are producer-supplied
     * (factor label, split value/unit, winner labels); nothing invented. */
    tradeOffSplit: (factor: string, value: string, high: string, low: string) =>
      `If ${factor} is above ${value}, ${high} leads; below it, ${low} leads.`,
  },
} as const
