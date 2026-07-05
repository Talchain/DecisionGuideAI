/**
 * Analysis hero panel — internal display types.
 *
 * These are UI view-model shapes only. Every value they carry is copied
 * (or formatted for display) from the adapted Results Panel object
 * (`ResultsSectionDataReturn`) — the hero never computes new quantities,
 * bands, deltas or thresholds. See buildHeroModel.ts for the mapping rules.
 */

/**
 * The two launch lenses. Stability and "What changed" are deliberately NOT
 * modelled: no per-option producer-supplied robustness label exists (ISL gap)
 * and no producer-supplied prior-run comparison object exists (PLoT gap).
 * They unlock upstream, not here.
 */
export type HeroLens = 'goal' | 'outcome'

/** Optional, fully-sourced detail lines for one option row. */
export interface HeroRowDetail {
  /** Producer story headline (M1 coaching), rendered verbatim. */
  why?: string
  /** Generated from producer flip-threshold values only (factor + value). */
  couldChangeIf?: string
  /** Formatted producer win probability (display-honesty formatter). */
  winChance?: string
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
  }
  /** Sourced-or-omitted detail lines; an all-empty detail makes the row static. */
  detail: HeroRowDetail
}

/** Interactive chart state — analysis computed with displayable options. */
export interface HeroChartModel {
  kind: 'chart'
  headline: string
  /**
   * Tension line naming the expected-outcome leader — persistent whenever
   * the headlined leader (goal basis or not) is not the outcome leader, and
   * the sole honest pointer in the no-option-on-track state; null when not
   * applicable (single option, aligned-without-claim, outcome lens hidden).
   */
  subline: string | null
  /** Available lenses in display order. Never empty. */
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
  /** Footer "Main reason" line, or null when no clean driver label exists. */
  mainReason: string | null
}

/** Curated non-chart state for partial / failed / blocked analyses. */
export interface HeroStatusModel {
  kind: 'status'
  variant: 'partial' | 'failed' | 'blocked'
  headline: string
  body: string
}

/**
 * Nothing to show and the existing tab should stay unchanged
 * (loading, hook error, or genuinely no analysis yet). Renders null.
 */
export interface HeroEmptyModel {
  kind: 'empty'
}

export type HeroModel = HeroChartModel | HeroStatusModel | HeroEmptyModel
