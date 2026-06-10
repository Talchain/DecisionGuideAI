/**
 * Pre-analysis panel v3 — shared types.
 *
 * Every panel item is a lifecycle-tracked signal; every section derives from
 * one memoised PreAnalysisModel. Types are exported so future right-hand
 * panels can adopt the same signal/attribution shapes.
 * See docs/pre-analysis-panel-solution-design-v1.md.
 */

/**
 * Collaboration-ready source attribution: a named person or Olumi, never a
 * you-versus-AI binary. Single user today; personId arrives with collaboration.
 */
export type Attribution =
  | { kind: 'olumi' }
  | { kind: 'person'; personId?: string; displayName: string }

export type PanelSignalId =
  | 'sig_goal_missing'
  | 'sig_success_missing'
  | 'sig_option_breadth'
  | 'sig_risk_count'
  | 'sig_estimates'
  | 'sig_cee_bias'

export type BarKey = 'frame' | 'options' | 'risks' | 'estimates'

/** Semantic state only — never entity colour (DS v5 three-channel rules). */
export type BarState = 'warning' | 'building' | 'success'

export interface BarModel {
  key: BarKey
  /** 0..1 honest fill — live signals only, affordances never inflate. */
  fill: number
  state: BarState
  tooltip: string
}

export type LadderStepKind =
  | 'set_goal'
  | 'set_success'
  | 'calibrate_top'
  | 'readiness_blocker'
  | 'run_first'

export interface LadderStep {
  kind: LadderStepKind
  copy: string
  /** Factor to calibrate when kind === 'calibrate_top'. */
  targetFactorId?: string
}

/** Where the estimate ranking weights came from. */
export type RankingSource = 'sensitivity' | 'degree'

export interface RankingResult {
  source: RankingSource
  /** Factor id → relative weight (sensitivity influence, or degree-based). */
  weights: Record<string, number>
  /** Factor ids, descending weight; stable label-then-id tie-break. */
  ordered: string[]
}

/** Positional priority labels — never value claims. */
export type RankLabel = 'top' | 'next' | 'lower'

export interface EstimateRowModel {
  nodeId: string
  label: string
  rankLabel: RankLabel
  /** Relative weight used for the Estimates bar movement. */
  weight: number
  reviewed: boolean
  attribution: Attribution
  /**
   * Display-scale text via the canonical factorDisplayText chain
   * (raw_value + unit > display_value > unitless raw > binary heuristic).
   * Null when no honest display-scale representation exists.
   */
  displayText: string | null
  /** Numeric prefill for the editor (display scale); null renders empty input. */
  rawPrefill: number | null
  /** Cap used to normalise on save (mirrors the legacy inline-edit handler). */
  cap: number | null
  /**
   * Value-scale guard: false when only a normalised model-scale value exists
   * with no display-scale anchor — the row degrades to confirm-only with no
   * numeric display (cee-plot-flip value-scale boundary, issue 246 species).
   */
  canEditValue: boolean
  /** True when the factor has no value at all (copy: needs a value). */
  needsValue: boolean
}

export interface SignalDetection {
  signal_id: PanelSignalId
  /** Lead sentence (regular weight) + emphasis sentence (semibold). */
  copy: { lead: string; emphasis: string }
  /** Override of the deterministic copy by live CEE text (verbatim, attributed). */
  ceeOverride?: { text: string; attribution: Attribution }
  /** Behind the info icon: trigger, method, action rationale. */
  rationale: string
  /** Entity shape channel for the row. */
  entityKind: 'goal' | 'option' | 'risk' | 'factor' | 'decision'
  /** Primary action target — absent on resolved confirmations. */
  action?: PanelAction
  /** Optional ask-Olumi spark (prefilled prompt, sent immediately). */
  spark?: { label: string; prompt: string }
}

export type PanelAction =
  | { type: 'focus_success_field' }
  | { type: 'focus_goal_field' }
  | { type: 'open_estimates'; nodeId?: string }
  | { type: 'send_prompt'; label: string; prompt: string }
  | { type: 'run_analysis' }

export type SignalStatus = 'live' | 'resolved'

export interface SignalView {
  detection: SignalDetection
  status: SignalStatus
}

export interface LadderInput {
  goalPresent: boolean
  successSet: boolean
  topUncalibrated: { id: string; label: string } | null
  /** Explicit false gates the rung; null/undefined (loading) skips it. */
  canRunAnalysis: boolean | null
  /** CEE-authored explanation, mirrored verbatim when present. */
  readinessExplanation: string | null
}

export interface BarsInput {
  decisionPresent: boolean
  goalPresent: boolean
  successSet: boolean
  optionCount: number
  riskCount: number
  estimates: {
    /** Influence-weighted 0..1 coverage of reviewed estimates. */
    coverage: number
    /** Factors carrying any observed source (the honest denominator). */
    estimableCount: number
    reviewedCount: number
  }
}
