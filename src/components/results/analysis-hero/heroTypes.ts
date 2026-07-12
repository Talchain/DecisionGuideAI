/**
 * Analysis hero panel — internal display types.
 *
 * These are UI view-model shapes only. Every value they carry is copied
 * (or formatted for display) from the adapted Results Panel object
 * (`ResultsSectionDataReturn`) — the hero never computes new quantities,
 * bands, deltas or thresholds. See buildHeroModel.ts for the mapping rules.
 */

/**
 * The four prototype lenses. Goal fit and Likely outcome are the LIVE
 * lenses; Stability and "What changed" are modelled visually but their
 * live data never exists today — no per-option producer robustness label
 * (ISL gap, issue 211) and no prior-run comparison object (PLoT gap,
 * issue 212). The live adapter therefore never makes them available: the
 * strip shows them with an honest unavailable state, and only typed
 * fixtures (provenance 'fixture') can populate their row data.
 */
export type HeroLens = 'goal' | 'outcome' | 'stability' | 'whatChanged'

/** Fixed lens-strip order (the prototype's tab order). */
export const ALL_HERO_LENSES: readonly HeroLens[] = [
  'goal',
  'outcome',
  'stability',
  'whatChanged',
]

/**
 * Where a model's values came from. `buildHeroModel` is the ONLY producer
 * of 'live' models; 'fixture' models exist solely for the internal fixture
 * gallery and render a visible internal-preview banner — fixture data must
 * never be mistakable for real analysis output.
 */
export type HeroProvenance = 'live' | 'fixture'

/** Optional, fully-sourced detail lines for one option row. */
export interface HeroRowDetail {
  /** Producer story headline (M1 coaching), rendered verbatim. */
  why?: string
  /** Generated from producer flip-threshold values only (factor + value). */
  couldChangeIf?: string
  /** Formatted producer win probability (display-honesty formatter). */
  winChance?: string
  /** "Realistic range: X to Y." from the row's own p10/p90 (same formatter as the readout). */
  range?: string
  /** Goal-fit line from the row's own goalProbability (constraint-aware wording). */
  goalFit?: string
  /**
   * Modelled-basis provenance caveat for `goalFit` (ROADMAP 1.6b follow-up,
   * claim-integrity) — set ONLY when the goal-fit number just shown IS the
   * joint-goal figure (`o.goalFitIsModelledBasis`, computed identically to
   * OptionCards' gate in useResultsSectionData.ts) AND the producer marked
   * it as scored from a modelled outcome distribution. Rendered adjacent to
   * `goalFit`, never separately — same shared wording as OptionCards
   * (GOAL_FIT_BASIS_CAVEAT_COPY), never invented.
   */
  goalFitCaveat?: string
  /**
   * "Watch" line — requires option-attributed producer narrative (issue
   * 217). The live adapter NEVER sets it; fixture-only until the producer
   * field exists.
   */
  watch?: string
  /** "Trade-off" line — same contract as `watch` (issue 217). */
  tradeOff?: string
}

export interface HeroRowVM {
  /** Analysed option id (from the adapted results object). */
  id: string
  /**
   * Presentation number (1-based) in the SHARED option display order
   * (utils/optionDisplayOrder — win probability when every option carries
   * one, else expected value), the same ranking OptionCards/WinGauge show,
   * so one screen never numbers the same option two ways. NOT graph-node
   * truth — a stable graph index is not available on the adapted object,
   * and this UI-only task must not add a graph selector. The number is
   * stable across lens switches because rows are built once per model,
   * independent of the active lens.
   */
  index: number
  /**
   * Identity-anchored ordinal from the Wave F-A numbering store (assigned
   * once per option id, stable across rerun rank flips) — null when the
   * row set is not fully registered (all-or-nothing: mixing positional and
   * stable numbers in one list could show duplicates). Wave 2 consumption
   * of brief §6.4.
   */
  stableNumber: number | null
  /** Option label for display (encoding notation stripped, rendered as text). */
  label: string
  /** Goal-fit lens values (collapsed goalProbability; see buildHeroModel). */
  goal: {
    /** Probability 0-1 from the adapted object, or null when absent. */
    value: number | null
    /** Formatted readout, '—' when absent. */
    readout: string
  }
  /** Likely-outcome lens values. */
  outcome: {
    p10: number | null
    p90: number | null
    centre: number | null
    /** Formatted centre readout, '—' when absent. */
    readout: string
    /**
     * Previous-run values for the What-changed ghost marks. Requires the
     * producer prior-run comparison object (issue 212) — the live adapter
     * NEVER sets this (UI diffing of run history is forbidden);
     * fixture-only until the producer field exists.
     */
    previous?: { p10: number | null; p90: number | null; centre: number | null }
  }
  /**
   * What-changed readout (e.g. a producer-supplied shift string). NEVER
   * UI-computed from current/previous — same contract as
   * `outcome.previous` (issue 212). Fixture-only today.
   */
  changeReadout?: string
  /**
   * Stability lens values — requires the per-option producer
   * stability/robustness label (issue 211). `value` positions the bar
   * (0-1), `readout` is the producer's own display label rendered
   * verbatim. The live adapter NEVER sets this; fixture-only today.
   */
  stability?: { value: number | null; readout: string }
  /** Sourced-or-omitted detail lines; an all-empty detail makes the row static. */
  detail: HeroRowDetail
}

/** Interactive chart state — analysis computed with displayable options. */
/** Wave 2 (§6.5): compact quick evidence link — the label names the factor,
 * the target focuses it on the canvas via the container's focus callback. */
export interface HeroQuickLink {
  label: string
  targetId: string
}

/** Wave 2 (§6.6): one evidence disclosure, three views. Trade-offs must
 * come from a grounded producer narrative — null live (producer gap),
 * fixture-populated in the gallery only. */
export interface HeroEvidenceModel {
  drivers: Array<{ rank: number; label: string; targetId: string | null }>
  flipRisks: Array<{ text: string; targetId: string | null }>
  tradeOffs: Array<{
    option: string
    gain: string
    giveUp: string
    dependsOn: string
    watch: string
  }> | null
}

export interface HeroChartModel {
  kind: 'chart'
  /**
   * 'live' models come exclusively from buildHeroModel; 'fixture' models
   * exist only for the internal gallery and force a visible
   * internal-preview banner in the panel.
   */
  provenance: HeroProvenance
  headline: string
  /**
   * Tension line naming the expected-outcome leader — persistent whenever
   * the headlined leader (goal basis or not) is not the outcome leader, and
   * the sole honest pointer in the no-option-on-track state; null when not
   * applicable (single option, aligned-without-claim, outcome lens hidden).
   */
  subline: string | null
  /**
   * DATA-BEARING lenses (never empty). The strip always renders all four
   * prototype lenses; a lens absent from this list renders the honest
   * unavailable body instead of chart rows when selected.
   */
  lenses: HeroLens[]
  defaultLens: HeroLens
  /** True when any option carries constraint analysis — drives copy only. */
  hasConstraints: boolean
  rows: HeroRowVM[]
  /**
   * Row id highlighted per lens. Goal-fit follows the Results Panel's
   * recommended option (never an independent argmax); outcome is the highest
   * existing centre with deterministic first-in-order tie-break.
   */
  leaders: Record<HeroLens, string | null>
  /**
   * Outcome-axis display domain (layout only — never displayed as data).
   * Derived from the option outcome values only; the goal threshold is
   * deliberately excluded so it cannot compress the comparison chart. Null
   * when the outcome lens is unavailable.
   */
  outcomeDomain: { min: number; max: number } | null
  /**
   * Number of rows that draw a p10-p90 range line — gates the outcome
   * caption so it never describes lines (or overlap) that are not
   * rendered: 0 → dots-only wording, 1 → singular "The line shows…"
   * wording without the overlap sentence, 2+ → full wording. (0 is
   * unreachable today — the outcome lens is only offered when some row
   * carries a range — but the gate stays honest if that lens gating ever
   * changes.)
   */
  outcomeRangedRowCount: number
  /**
   * Single-lens unlock promotion: true ONLY when the goal lens is absent
   * because no success target exists (goalThreshold null) — never when a
   * targeted run merely lacks goal probabilities (producer gap, where the
   * prompt would mislead). Drives the Focus-next slot's promoted
   * "set a success target to unlock Goal fit" line.
   */
  showGoalHint: boolean
  /** Footer "Main driver" line, or null when no clean driver label exists. */
  mainReason: string | null
  /** Wave 2 (§6.5): Main driver / Top flip risk quick links (semantically
   * distinct: strongest effect vs most likely to change the leader). */
  quickLinks: {
    mainDriver: HeroQuickLink | null
    topFlipRisk: HeroQuickLink | null
  }
  /** Wave 2 (§6.6): "Why and what could change it" disclosure content. */
  evidence: HeroEvidenceModel
  /**
   * Trust footer line, rendered VERBATIM when present — the hero never
   * authors trust wording. Requires a producer display-safe verdict/label
   * (issues 219/221); the live adapter always sets null. Fixture-only today.
   */
  trustLine: string | null
  /**
   * Header status chip (e.g. provenance/pass label), rendered verbatim.
   * Requires a producer status label (issue 221); live adapter always
   * null. Fixture-only today.
   */
  statusChip: string | null
  /**
   * Named Focus-next action, rendered verbatim in the footer slot.
   * Requires the coaching top-action contract (issue 220); live adapter
   * always null (the generic line / target promotion render instead).
   */
  focusAction: string | null
  /**
   * Display unit for the success-target editor ('%' for percent outcomes,
   * the currency symbol when known, null otherwise). Pure passthrough of
   * the existing outcomeUnit/outcomeUnitSymbol fields — shown beside the
   * input so the user knows what they are typing BEFORE committing.
   */
  targetUnit: string | null
}

/** Curated non-chart state for partial / failed / blocked analyses, plus
 * the §6.2 pause-read state ('paused': a framing contradiction pauses the
 * read — headline/lenses/evidence suppressed, resolution shown). 'paused'
 * is PRODUCER-GATED: no live signal exists, so buildHeroModel never emits
 * it (pinned) — it is reachable only via gallery fixtures. */
export interface HeroStatusModel {
  kind: 'status'
  /** Same contract as HeroChartModel.provenance — 'fixture' forces the banner. */
  provenance: HeroProvenance
  variant: 'partial' | 'failed' | 'blocked' | 'paused'
  headline: string
  body: string
  /** §6.2 resolution action line (paused only). Plain text — a routed
   * action control arrives only with the live producer signal. */
  resolution?: string
}

/**
 * Nothing to show and the existing tab should stay unchanged
 * (loading, hook error, or genuinely no analysis yet). Renders null.
 */
export interface HeroEmptyModel {
  kind: 'empty'
}

export type HeroModel = HeroChartModel | HeroStatusModel | HeroEmptyModel
