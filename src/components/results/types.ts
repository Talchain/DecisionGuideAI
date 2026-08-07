/**
 * Results Panel Types
 *
 * Shared types for the redesigned Results Panel components.
 * Based on V2RunResponse contract from PLoT /v2/run endpoint.
 *
 * "Coaching over gates" philosophy - users see clear decision guidance.
 */

import type { FactorDirection } from '../../lib/factorDirection'
import type { FactorEnrichment, NearTieInfo } from '../../lib/mappers/types'
import type { ConstraintAnalysis } from '../../types/constraints'
import type { M1CoachingReadiness } from '../../types/cee'
import type { DecisionVerdict } from '../../lib/decisionVerdict'
import type { ReportV1, OptionProbability } from '../../adapters/plot/types'
import type { V2FactorSensitivity, V2OptionComparison } from '../../adapters/plot/v2/types'
import type { KnownFlipReason } from './utils/flipReasonVocabulary'
import type { PercentilesSource } from './utils/downsideCopy'
import type { MappedDecisionQualityPrompt } from './utils/decisionQualityPrompts'

// Re-export M1 coaching type for component use
export type { M1CoachingReadiness }

// =============================================================================
// Rich Text Types (M2 structured content)
// Moved from HeroSection.tsx (Brief 5.4 Phase 2 — HeroSection deleted)
// =============================================================================

/** Structured span for M2 content with clickable refs */
export type RichSegment =
  | { type: 'text'; text: string }
  | { type: 'ref'; id: string; label: string }

export type RichText = RichSegment[]

// =============================================================================
// Confidence Tier Types
// =============================================================================

export type ConfidenceTier = 'strong' | 'fair' | 'needs_work' | 'unknown'

export interface ConfidenceTierInfo {
  tier: ConfidenceTier
  icon: string
  label: string
  description: string
}

// =============================================================================
// Goal Constraint Types (Task 2 — Success Targets)
// =============================================================================

/** A single goal constraint for success target display */
export interface GoalConstraint {
  /** Unique identifier */
  id: string
  /** Display label (e.g., "MRR", "Churn rate") */
  label: string
  /** Comparison operator */
  operator: '>=' | '<=' | '>' | '<' | '='
  /** Threshold value */
  value: number
  /** Probability of achieving this individual constraint (0-1) */
  probability?: number | null
}

// =============================================================================
// Flip Threshold Types (Task 6 — Tipping Points)
// =============================================================================

/**
 * Why a flip value is what it is (ROADMAP 2.280).
 *
 * ⚠ THIS WAS `'no_bracket' | 'timeout' | 'isl_error'` AND HAD ESSENTIALLY ZERO
 * OVERLAP WITH THE WIRE. `no_bracket` has zero occurrences in the producer;
 * `isl_error` exists there only as a transport-error envelope field, never as a
 * flip reason; only `timeout` was real. The tokens the live wire actually
 * carries (`found`, `no_effect_within_bounds`, `structurally_invariant`) were
 * absent from the union entirely — so anything narrowing on this type was
 * narrowing on fiction.
 *
 * ⚠ AND IT STAYS OPEN. The pinned contract types this field as a bare string
 * and warns against matching it, and PLoT passes unknown ISL tokens through
 * verbatim. A closed union here would re-commit the same error with a longer
 * list. `KnownFlipReason` gives call sites autocomplete and exhaustiveness over
 * what this build KNOWS; the `(string & {})` arm keeps every other token
 * assignable, so an unrecognised value is a runtime classification question —
 * answered conservatively in `flipReasonVocabulary` — and never a type error
 * that tempts someone to cast it away.
 *
 * Never test this string inline. Use `flipReasonVocabulary`'s predicates: they
 * are written so an unknown token lands on the safe side.
 */
export type FlipReason = KnownFlipReason | (string & {})

/** A single tipping-point entry from PLoT's robustness.flip_thresholds */
export interface FlipThreshold {
  /** Display label for the factor */
  label: string
  /** Canvas node ID for click-to-focus */
  node_id: string
  /** Current assumed value of the factor — null when the producer did not
   * supply one (Codex B3: a defaulted 0 fabricated flip DIRECTION and
   * "changes from 0" copy; with no baseline, direction is unknowable). */
  current_value: number | null
  /** Value at which the recommendation changes (null if undetermined) */
  flip_value: number | null
  /** Why flip_value is null */
  flip_reason?: FlipReason
  /** Unit string for formatting (e.g., '$', '%') */
  unit?: string
  /** Label of the option that would become winner */
  alternative_winner_label?: string
}

// =============================================================================
// Recommendation Types
// =============================================================================

/**
 * Outcome distribution for an option.
 * p10/p50/p90 are percentiles; mean is the arithmetic average.
 * Note: mean (expected) and p50 (median) are semantically different for skewed distributions.
 */
export interface OptionOutcome {
  /** Arithmetic mean (average outcome) - use OptionResult.expected for display */
  mean: number | null
  /** 10th percentile (pessimistic case) */
  p10: number | null
  /** 50th percentile (median) - NOT the same as mean for skewed distributions */
  p50: number | null
  /** 90th percentile (optimistic case) */
  p90: number | null
}

/**
 * ROADMAP 2.449 — the DOWNSIDE / tail-risk view of an option's simulated
 * outcome distribution, ready for display: both magnitudes have already been
 * put on the SAME scale as `OptionOutcome.p10/p50/p90`.
 *
 * Present only when the whole block survived the producer's all-or-nothing
 * emission rule and the boundary guards; there is deliberately NO partial
 * shape, and no field is ever defaulted to 0 — a zero in a tail statistic
 * reads as "there is no downside".
 */
export interface OptionDownside {
  /**
   * Mean of the worst 10% of simulated outcomes (a tail average, so it sits
   * at or below `outcome.p10` by construction).
   *
   * ⚠ The 10% cut-off is a WORKING DEFAULT at the producer, explicitly not a
   * ratified convention. Any surface showing this number must say so — see
   * `DOWNSIDE_TAIL_CAVEAT_COPY` in OptionCards.
   */
  cvar10: number
  /** 5th percentile — extends the p10/p50/p90 family downward. */
  p05: number
  /**
   * How much better this decision would have gone, on average, had the true
   * outcome been known in advance and the best option chosen each time.
   *
   * ⛔ CARRIED, NOT DISPLAYED. This is the per-option limb of the
   * value-of-information family (the whole-decision EVPI is exactly the
   * MINIMUM of these across options), and the estate's standing
   * no-EVPI-display doctrine licenses a ranking with NO magnitudes for that
   * family — it is why the EVPI percentage-point pill was removed from
   * TriageCard. Rendering this magnitude is a doctrine ruling, not a wiring
   * gap. It is carried here so a licensed surface does not have to re-plumb
   * four services; every render site must leave it alone until then.
   */
  expectedRegret: number
}

export interface OptionResult {
  id: string
  label: string
  /** Explicit expected value (mean) - primary value for "Expected" display */
  expected: number | null
  /** Full outcome distribution when available */
  outcome: OptionOutcome
  /** @deprecated Use outcome.p10/p50/p90 instead. Kept for backward compatibility. */
  p10: number | null
  /** @deprecated Use expected or outcome.p50 instead. Kept for backward compatibility. */
  p50: number | null
  /** @deprecated Use outcome.p90 instead. Kept for backward compatibility. */
  p90: number | null
  isRecommended: boolean
  winProbability?: number
  /**
   * Display-honesty: per-option valid Monte Carlo sample count (from
   * PLoT outcome.n_valid_samples, with fallback to outcome.n_samples /
   * meta.n_samples). Used to derive the simulation-resolution floor /
   * ceiling for `winProbability` display ("<0.1%" / ">99.9%" at n=1000).
   * Source value only — display formatting happens at render time.
   */
  nValidSamples?: number
  /**
   * ROADMAP 2.449 — tail-risk view of this option's simulated outcomes,
   * already scaled onto the same axis as `outcome`. ABSENT (undefined) when
   * the engine could not compute it honestly; render sites must show nothing
   * at all rather than a zero or a placeholder.
   */
  downside?: OptionDownside
  /**
   * ROADMAP 2.646 — the producer's PERCENTILE PROVENANCE for this option,
   * carried verbatim from `enrichment.option_comparison[].outcome
   * .percentiles_source` and used for exactly one thing: choosing which
   * absence sentence `OptionCards` shows when {@link downside} is missing.
   *
   * ⚠ A SIBLING OF {@link outcome}, NOT A MEMBER OF IT, on purpose. `outcome`
   * here is a DISPLAY object: its `p10`/`p90` may have come from the
   * confidence interval (the V5 mapper's fallback) or from `run.bands` (this
   * hook's), so a provenance flag inside it would read as certifying numbers
   * the producer's percentile population never produced. It certifies that
   * population and nothing else.
   *
   * ⚠ ABSENT MEANS ABSENT — never read it as `'samples'`. See
   * `downsideUnavailableCopy`, which is the only place this field is consumed.
   */
  percentilesSource?: PercentilesSource
  /** Optional goal probability when no distribution data exists. */
  goalProbability?: number | null
  /** Task 2.1: Whether this option is the baseline for comparison */
  isBaseline?: boolean
  /** Task 2.2: Point delta vs baseline (absolute, not percent) */
  deltaFromBaseline?: number | null
  /** Task 8: Rank of this option (1 = best, 2 = second best, etc.) for display */
  rank?: number
  /** Multi-constraint analysis: per-option constraint satisfaction from ISL */
  constraintAnalysis?: ConstraintAnalysis
  /**
   * Display-honesty (ROADMAP 1.6b): true when the rendered `goalProbability`
   * IS the joint-goal number AND its producer-owned `goal_fit_basis.scored_from`
   * is 'modelled_outcome_distribution' — i.e. the number was scored from a
   * MODELLED forward-propagated outcome distribution rather than a
   * directly-elicited base. Render sites showing `goalProbability` MUST
   * surface a caveat when this is true (UI-BOUNDARY-DATA-INVENTORY.md §5).
   */
  goalFitIsModelledBasis?: boolean
  /**
   * Goal-probability IDENTITY: true when the rendered `goalProbability` is
   * `probability_of_joint_goal` STANDING IN for an absent `goal_probability`.
   *
   * ⚠ L62 (2026-08-04): this is now ALWAYS FALSE on every live payload, and
   * the field is retained only so the surfaces that branch on it keep
   * compiling. `selectGoalProbability` no longer substitutes — the joint
   * figure is withheld from the goal-fit slot entirely (see that module's L62
   * block for why the wire cannot justify the substitution). A rendered
   * `goalProbability` is therefore always a quantity that earns the
   * possessive. Retiring this field and the substituted-voice copy it selects
   * is a follow-up; it is NOT done here because it touches a dozen surfaces
   * and this change is a P0 truth fix, not a refactor.
   *
   * Set from `!selectGoalProbability(...).mayUsePossessiveGoalFraming` on a
   * present number; never re-derived at a render site.
   */
  goalFitIsSubstitutedJoint?: boolean
  /**
   * ⭐ L62 — true when this run DID carry a `probability_of_joint_goal` and the
   * selector refused to put it in the goal-fit slot (basis
   * `'joint_goal_withheld'`).
   *
   * The distinction it carries is one no other field can: `goalProbability`
   * being null means "no goal number", which is ALSO the state of a run where
   * the user set no target. Those need different sentences — offering "Set a
   * success target" to someone who set one is its own small untruth. Surfaces
   * read this to choose `GOAL_ANCHOR_COPY.notScored` over
   * `GOAL_ANCHOR_COPY.noTarget`.
   */
  goalFitWithheld?: boolean
}

/** Outcome unit type for formatting - from goal node observed_state.unit */
export type OutcomeUnitType = 'currency' | 'percent' | 'count'

/** Stability level derived from recommendation_stability score */
export type StabilityLevel = 'high' | 'medium' | 'low'

/** How the winner was determined - for honest labelling */
export type WinnerDeterminedBy = 'win_probability' | 'expected_outcome' | 'unknown'

/** Robustness level from PLoT (level field) - aligned with mapper types */
export type RobustnessLevel = 'high' | 'moderate' | 'low' | 'very_low'

/** Robustness label from PLoT (label field - alternative naming) */
export type RobustnessLabel = 'robust' | 'moderate' | 'fragile'

/**
 * Display-safe robustness verdict — the PLoT `robustness.display_verdict`
 * wire enum (PLoT #202, ROADMAP 1.6). Producer-owned meaning; the UI renders
 * it verbatim and never derives it from raw facts. 'not_assessed' is the
 * producer's own stated absence (robustness not computed) — distinct from
 * the field being absent entirely (older PLoT builds → undefined →
 * "Robustness unknown").
 */
export type RobustnessDisplayVerdict = 'robust' | 'moderate' | 'fragile' | 'not_assessed'

/**
 * DecisionResultData (renamed from RecommendationSectionData — Brief 5.4 closeout item 9).
 * The old name referenced the deleted RecommendationSection component.
 * This type describes the decision outcome data shape, not any UI component.
 */
export interface DecisionResultData {
  recommendedOption: OptionResult | null
  allOptions: OptionResult[]
  goalLabel: string
  goalNodeId?: string // For click-to-focus
  isSingleOption: boolean
  analysisStatus: 'computed' | 'partial' | 'failed' | 'blocked'
  statusReason?: string
  /** Unit for outcome values (from goal node observed_state.unit) */
  outcomeUnit?: OutcomeUnitType
  /** Symbol for currency (e.g., '$', '£') */
  outcomeUnitSymbol?: string
  goalThreshold?: number | null
  /** Recommendation stability (0-1): how often the recommendation stays winner under uncertainty */
  recommendationStability?: number
  /** Win probability (0-1): how often this option beats alternatives */
  winProbability?: number
  /** How the winner was determined - for honest labelling */
  determinedBy?: WinnerDeterminedBy
  /**
   * Structured robustness level from the analysis report (PLoT
   * report.robustness.level), or the UI-SEM-005 stability fallback when the
   * report omits it. This is STRUCTURED DATA — safe to surface in detailed,
   * qualified contexts, but it must NOT drive the binary Robust/Sensitive glyph
   * (PLoT-level semantics are not a display-safe verdict). Use `robustnessVerdict`
   * for the glyph.
   */
  robustnessLevel?: RobustnessLevel
  /**
   * Display-safe robustness verdict that drives the binary Robust/Sensitive
   * glyph. Sourced ONLY from the producer's explicit display-safe verdict —
   * PLoT `robustness.display_verdict` (#202, ROADMAP 1.6) — never from raw
   * `report.robustness.level` and never from the UI-SEM-005 stability
   * fallback. Normalised FAIL-CLOSED in useResultsSectionData: only the four
   * wire enum tokens populate it; absent field / unknown token → undefined →
   * every surface keeps the honest "Robustness unknown" state.
   * (ROBUSTNESS-VERDICT-CONTRACT — consumer side landed lane 35 fix 3.)
   */
  robustnessVerdict?: RobustnessDisplayVerdict
  /**
   * Producer-owned display reason accompanying `robustnessVerdict`
   * (PLoT `robustness.display_verdict_reason`). Rendered VERBATIM — the UI
   * never authors robustness prose. Never populated without its verdict.
   */
  robustnessVerdictReason?: string
  /** Robustness label from PLoT (fallback when level missing) */
  robustnessLabel?: RobustnessLabel
  /** Goal text from scenario framing */
  goalText?: string
  /** Task 2.1: Resolved baseline option ID (PLoT > user > heuristic) */
  baselineId?: string | null
  /** Task 2.1: Baseline outcome for delta calculations */
  baselineOutcome?: number | null
  /** Near-tie detection: when top options are too close to call */
  nearTie?: NearTieInfo
  /**
   * SINGLE VERDICT: the ONE answer to "is there a leading option?", derived by
   * `src/lib/decisionVerdict.ts` from the same PLoT report the canvas reads.
   * Every surface that asserts or denies a leading option must gate on this
   * and must not compute its own. See that module for the diagnosis.
   */
  verdict?: DecisionVerdict
  /** Task 6: Flip thresholds for tipping points visualisation */
  flipThresholds?: FlipThreshold[]
  /**
   * Display-honesty: PLoT classification of the post-denormalised
   * `flip_thresholds[]` array. Drives the all-no-effect / partial /
   * unresolved UX so the section is not presented as actionable insight
   * when no factor changed the leading option within the current range.
   * Optional — present on PLoT builds shipping the display-honesty PR.
   */
  flipThresholdsStatus?: 'computed' | 'all_no_effect' | 'partial_no_effect' | 'unresolved' | 'unavailable'
  /**
   * Display-honesty: signals that the flip_thresholds[] array also
   * contained unresolved entries (timeout / error / insufficient
   * precision) alongside computed and no_effect ones. Used by the UI
   * to soften copy on `'partial_no_effect'` so it doesn't imply every
   * non-computed factor was a harmless no-effect case.
   */
  flipThresholdsHasUnresolved?: boolean
  /**
   * Display-honesty: leading option has meaningful downside in the lower
   * range of simulated outcomes (deterministic: leading option's
   * `outcome.p10 < 0`). Drives a single qualifying sentence in the
   * leading-option summary. Undefined when p10 unavailable.
   * @see UI-SEM-050
   */
  leadingOptionDownsideFlag?: boolean
  /**
   * Producer leader-confidence band from PLoT `decision_brief.headline_banded`
   * (Lane UI-W4, PLoT #200) — normalised fail-closed via
   * `normalizeHeadlineBanded`. When present AND naming the hero's headline
   * leader, it drives the banded leader copy (buildHeroModel); the UI-SEM-060
   * win-probability banding remains ONLY as the absent-producer fallback.
   * `null`/absent on older PLoT builds, single-option runs (< 2 ranked
   * options), and malformed payloads.
   */
  headlineBanded?: HeadlineBanded | null

  // ==========================================================================
  // M1 Coaching Fields (deterministic, not LLM-generated)
  // ==========================================================================

  /** M1 Coaching headline from executive_summary */
  coachingHeadline?: string
  /** M1 Coaching paragraph from executive_summary (full narrative) */
  coachingParagraph?: string
  /** M1 Coaching readiness level */
  coachingReadiness?: M1CoachingReadiness
  /** M1 Coaching readiness score (0-100) */
  coachingReadinessScore?: number
  /** V12: Readiness signal dimensions for tooltip */
  coachingReadinessDimensions?: { evidence: number; robustness: number; clarity: number }
  /** M1 Coaching story headlines: optionId → summary */
  storyHeadlines?: Record<string, string>
  /** V12: Executive summary decision statement */
  coachingDecisionStatement?: string
  /** V12: Executive summary key qualifier */
  coachingKeyQualifier?: string
  /** V12: Executive summary action implication */
  coachingActionImplication?: string
  /** V12 C1: M2 narrative summary for "Full analysis" expandable */
  m2NarrativeSummary?: string

  // ==========================================================================
  // M1 Coaching: Dominant Factor Warning
  // ==========================================================================

  /** Dominant factor ID if any factor has >50% influence */
  dominantFactorId?: string
  /** Dominant factor label for display */
  dominantFactorLabel?: string
  /** Whether there are warnings/uncertainties that need attention (for Ready + warnings consistency) */
  hasWarnings?: boolean
  /**
   * v7: True when outcome values are normalised model scores (scale=1, no goalThresholdCap).
   * When true, UI must label values as "Relative score" with tooltip, never as user units.
   */
  isNormalised?: boolean
}

// =============================================================================
// Drivers Types (Updated for semantic labels and dynamic normalisation)
// =============================================================================

/**
 * Semantic labels for driver importance.
 * - 'biggest': Rank 1 factor (always unique)
 * - 'strong': normalisedInfluence >= 0.50
 * - 'moderate': normalisedInfluence >= 0.20
 * - 'minor': normalisedInfluence < 0.20
 */
export type DriverSemanticLabel = 'biggest' | 'strong' | 'moderate' | 'minor'

/**
 * Canonical direction after normalisation — the PRODUCER's full documented
 * domain (`src/lib/factorDirection.ts`).
 *
 * 'positive' = increases goal · 'negative' = decreases goal ·
 * 'mixed' / 'unknown' = the producer measured the factor but declined to
 * assert a single direction.
 *
 * ⚠ WIDENED 2026-08-01 (ROADMAP 2.234). This was `'positive' | 'negative'`,
 * and that narrowing is what turned `mixed`/`unknown`/absent into "up" arrows
 * and the sentence "increases the outcome". Only the two directional members
 * license directional rendering — ask `isDirectionalFactor`, never
 * `direction != null`.
 */
export type DriverDirection = FactorDirection

// =============================================================================
// Confidence Provenance (audit A1-PRIMARY)
// =============================================================================
// Mirrors PLoT's confidence_provenance object on factor_sensitivity[] entries.
// Drives the column-header "operational estimate" disclosure marker.
// All fields are surfaced as optional on the UI side for graceful degradation:
// cached/old PLoT payloads have no confidence_provenance and must still render.

/**
 * Honest source label for the user-visible confidence value.
 * Mirrors PLoT's `ConfidenceSource` (audit A1-PRIMARY): the legacy `'isl'`
 * value misleadingly tagged PLoT-recomputed values as ISL-sourced.
 */
export type ConfidenceSource =
  | 'plot_unified_from_isl_bootstrap'
  | 'plot_unified_from_graph'

/**
 * Forward-compat note: `formulaVersion`, `calibrationStatus`, and `inputQuality`
 * are deliberately typed as plain `string` on the UI mirror. PLoT's typed
 * payload uses narrow literal unions today, but this UI ships ahead of
 * Jinghui's calibration brief — when PLoT bumps the formula or extends the
 * status vocabulary, the UI must continue to render the `is_provisional`
 * disclosure marker without code changes. The narrow types live on PLoT's
 * `FactorSensitivityResultV3` for typed downstream consumers.
 */
export type ConfidenceFormulaVersion = string

export type ConfidenceCalibrationStatus = string

export type ConfidenceInputQuality = string

export interface ConfidenceProvenance {
  computationSource: ConfidenceSource
  formulaVersion: ConfidenceFormulaVersion
  /** True when the value is an operational estimate pending pilot calibration. Drives the column-header marker. */
  isProvisional: boolean
  calibrationStatus: ConfidenceCalibrationStatus
  inputQuality: ConfidenceInputQuality
}

// ─── Auto-noise provenance (audit B3) ───────────────────────────────────────
//
// Analysis-level disclosure for the operational variance adjustment ISL
// applies in `_apply_auto_scaled_noise`. PLoT emits the snake_case payload
// `auto_noise_provenance`; this UI type is the camelCase normalised form.
//
// Forward-compat: enum slots are typed `string` (mirrors A1's relaxed
// confidence-provenance types — see commit e46f305f) so future calibration
// values from PLoT do not crash old UI builds.
//
// UI surfaces ONLY the boolean gate (`applied && isProvisional`). All other
// fields are payload-only debug metadata and must NEVER be rendered as
// user-facing text.

export type AutoNoiseEffect = string
export type AutoNoiseFormulaVersion = string
export type AutoNoiseDistribution = string
export type AutoNoiseFilterScope = string
export type AutoNoiseCalibrationStatus = string

export interface AutoNoiseProvenance {
  applied: boolean
  effect: AutoNoiseEffect
  formulaVersion: AutoNoiseFormulaVersion
  multiplier: number
  noiseDistribution: AutoNoiseDistribution
  filterScope: AutoNoiseFilterScope
  /** Drives whether the visible disclosure marker renders. */
  isProvisional: boolean
  calibrationStatus: AutoNoiseCalibrationStatus
}

/**
 * Normalise a raw PLoT `auto_noise_provenance` payload (snake_case) into
 * the UI's `AutoNoiseProvenance` (camelCase). Returns `null` on missing,
 * non-object, or malformed input — never throws, never partially fills.
 *
 * Graceful degradation: an old PLoT build without the field, or a cached
 * staging response, will return `null` here and the marker will simply
 * not render. No silent typecast.
 */
export function normalizeAutoNoiseProvenance(raw: unknown): AutoNoiseProvenance | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  if (typeof r.applied !== 'boolean') return null
  if (typeof r.is_provisional !== 'boolean') return null
  if (typeof r.multiplier !== 'number' || !Number.isFinite(r.multiplier)) return null

  const stringFields: Array<['effect' | 'formula_version' | 'noise_distribution' | 'filter_scope' | 'calibration_status', string]> = []
  for (const key of ['effect', 'formula_version', 'noise_distribution', 'filter_scope', 'calibration_status'] as const) {
    const v = r[key]
    if (typeof v !== 'string' || v.length === 0) return null
    stringFields.push([key, v])
  }
  const m = Object.fromEntries(stringFields) as Record<typeof stringFields[number][0], string>

  return {
    applied: r.applied,
    effect: m.effect,
    formulaVersion: m.formula_version,
    multiplier: r.multiplier,
    noiseDistribution: m.noise_distribution,
    filterScope: m.filter_scope,
    isProvisional: r.is_provisional,
    calibrationStatus: m.calibration_status,
  }
}

// ─── Producer leader-confidence band (Lane UI-W4, PLoT #200) ────────────────
//
// MOVED (2026-07-25, SINGLE VERDICT lane): `HeadlineBanded` and
// `normalizeHeadlineBanded` now live in `src/lib/decisionVerdict.ts`, next to
// the one function entitled to turn producer signals into a leader verdict.
// `src/lib` must not import from `src/components`, and duplicating the
// normaliser here would be exactly the hand-maintained mirror this programme
// keeps getting bitten by. Re-exported so every existing import site
// (`useResultsSectionData`, the normaliser spec) keeps working unchanged.
export type { HeadlineBandedBand, HeadlineBanded } from '../../lib/decisionVerdict'
export { normalizeHeadlineBanded } from '../../lib/decisionVerdict'
// `export ... from` re-exports without binding the names locally, and this
// file references both below.
import type { HeadlineBanded } from '../../lib/decisionVerdict'

export interface DriverItem {
  /** Canonical identifier: node_id ?? factor_id ?? id ?? normalised(label) */
  factorKey: string
  /** Display label */
  factorLabel: string
  /** Raw elasticity value (elasticity ?? sensitivity_score ?? sensitivity) */
  rawElasticity: number
  /** Dynamically normalised 0-1 (abs(rawElasticity) / max(all elasticities)) */
  normalisedInfluence: number
  /** ISL influence_score (0-1) - structural causal influence, used for Influence column */
  influenceScore?: number
  /** Codex R3-B1: the value every surface displays AND ranks by, resolved under the
   *  complete-metric-set policy — producer influenceScore only when EVERY ranked factor
   *  carries one (a single comparable basis), otherwise normalisedInfluence for every
   *  factor. Consumers must render/sort this, not influenceScore ?? normalisedInfluence,
   *  which mixes bases under partial producer coverage. Optional only for legacy
   *  fixtures — the live pipeline always sets it. */
  displayInfluence?: number
  /** Which basis produced displayInfluence ('influence_score' = absolute producer
   *  scale; 'normalised_elasticity' = set-relative). Lane 2 review fold: surfaces
   *  making ABSOLUTE claims ("drives NN% of the outcome") must gate on this —
   *  a set-relative 1.0 is "largest in this set", not a causal share. Optional
   *  only for legacy fixtures — the live pipeline always sets it. */
  displayProvenance?: 'influence_score' | 'normalised_elasticity'
  /** Producer influence_rank (1 = most influential). Additive; roadmap 1.7 (provisional_doctrine_v0). */
  influenceRank?: number
  /** ISL zero_reason - explains why sensitivity is zero for intervention factors */
  zeroReason?: ZeroReasonCode
  /** 1-indexed rank by absolute elasticity */
  rank: number
  /** Direction derived from edges, normalised */
  direction?: DriverDirection
  /** Semantic label based on rank (1) or threshold (2+) */
  semanticLabel: DriverSemanticLabel
  /** Whether this factor has a matching canvas node for click-to-focus */
  canFocus: boolean
  /** Matching canvas node ID (if different from factorKey) */
  matchedNodeId?: string
  /** Confidence in this factor's influence (beliefExists from edge to goal, 0-1) */
  confidence?: number
  /** Value of Information (0-1) - whether gathering more data could change the decision */
  valueOfInformation?: number
  /** Fragile edge info if this factor can flip the decision */
  fragileEdgeInfo?: {
    /** Probability decision flips to alternative winner (0-1, higher = more likely to flip) */
    switchProbability?: number
    /** Alternative option that would win if flipped */
    alternativeWinnerLabel?: string
  }
  /** PLoT flip_risk_category - how this factor contributes to decision uncertainty */
  flipRiskCategory?: FlipRiskCategory
  /** CEE-generated enrichment (observations, perspectives, confidence question) */
  enrichment?: FactorEnrichment
  /** V14.1: confidence is a default estimate (isl_default), not user-provided */
  isDefaultedConfidence?: boolean
  /**
   * Confidence provenance disclosure object (audit A1-PRIMARY).
   * Optional for graceful degradation when receiving cached/old PLoT payloads
   * that pre-date this field. When absent, the column-header marker is hidden.
   */
  confidenceProvenance?: ConfidenceProvenance
  /** ISL bootstrap: stability of this factor's attribution across model variations */
  attributionStability?: 'high' | 'moderate' | 'low' | 'negligible'
  /** True when at least one inbound edge has validation.status === 'contested' */
  hasContestedEdge?: boolean
  /** ISL bootstrap: fraction of bootstrap samples where this factor's rank flips (0-1) */
  rankFlipRate?: number
  /** ISL EVPI: expected value of perfect information */
  evpi?: number
  /**
   * ⛔ `evpiPercentagePoints` DELETED. Its only reader was the Strengthen
   * "Knowing this better could shift the result by about {N} percentage
   * points" line plus a UI-invented `> 5pp` selection threshold — both removed.
   * See tests/contracts/no-evpi-display.contract.test.ts.
   */
  /** Track S: provenance of the factor value. Optional; absent on pre-Track-S payloads. */
  valueSource?: string
  /** Track S: how the value was obtained (explicit / inferred / …). Optional. */
  valueExtractionType?: string
  /** Track S: true when the value was assumed/defaulted. Distinct from isDefaultedConfidence (a confidence signal). */
  valueDefaulted?: boolean
  /** Producer worth_investigating flag for this factor (from the
   * factor_sensitivity row or the robustness value_of_information suggestion
   * matched by factor id). Strict producer read — only an explicit `true`
   * sets it; absent otherwise. Additive; consumed by the Strengthen panel's
   * VOI trigger so its source line can honestly cite the engine. */
  worthInvestigating?: boolean
}

export interface DriversSectionData {
  drivers: DriverItem[]
  driversStatus: 'computed' | 'unavailable' | 'skipped' | 'error'
  topDrivers: DriverItem[] // Top 3 (excluding zero-impact factors)
  totalCount: number
  /** True if any factor has real elasticity data (>0.001). When false, show direction-only view. */
  hasMagnitudeData: boolean
  /** ISL service error message if unavailable */
  islError?: string
  /** Task 2: Count of zero-impact factors hidden from default view */
  hiddenZeroImpactCount?: number
  /** M1 Coaching: dominant factor ID if any factor has >50% influence */
  dominantFactorId?: string
  /** M1 Coaching: dominant factor label (looked up from drivers) */
  dominantFactorLabel?: string
}

// =============================================================================
// Confidence Types (Merged with Improvements per redesign spec)
// =============================================================================

/** Severity levels for critiques/uncertainties */
// 'blocker' = genuine pre-run validation blocker (blocks_analysis: true)
// 'critical' = high-severity fragile edge (flip probability > 0.7) - doesn't block, but critical assumption
// 'error' = medium-severity fragile edge (flip probability > 0.5)
// 'warning' = lower-severity items
// 'info' = informational
export type CritiqueSeverity = 'blocker' | 'critical' | 'error' | 'warning' | 'info'

export interface UncertaintyItem {
  code: string
  message: string
  /** Humanised message from PLoT (preferred over raw `message` for user-facing UI) */
  userMessage?: string
  /** V14.3b: Pre-sanitised text for JSX render fallback. Computed at data layer via internal-token guard. */
  displayText?: string
  suggestion?: string
  affectedNodes?: string[]
  /** Severity level for visual styling - defaults to 'warning' if not specified */
  severity?: CritiqueSeverity
  /** Factor confidence (0-1) for confidence pill display. Derived from edge exists_probability. */
  factorConfidence?: number | null
  /** ISL E-value: how many times wrong the assumption must be to flip the recommendation */
  eValue?: number
  /** For sensitivity thresholds (when small changes flip the recommendation) */
  threshold?: {
    variable: string
    direction: DriverDirection
    value: number
    alternativeOption?: string
  }
}

export interface ImprovementItem {
  action: string
  reason: string
  priority: number // Lower = more important
  source: 'bias' | 'quality_factor' | 'improvement_guidance'
  effortMinutes?: number
  potentialImprovement?: string
}

export interface EvidenceCoverage {
  backedByData: number
  needsValidation: number
}

/** Disclosure info when items are filtered below threshold */
export interface FilteredItemsDisclosure {
  /** Number of items filtered out */
  filteredCount: number
  /** Threshold used for filtering (e.g., 0.3 for 30% flip probability) */
  threshold: number
  /** Human-readable description of what was filtered */
  description: string
}

// =============================================================================
// M1 Coaching Item Types
// =============================================================================

/** Evidence gap from M1 Coaching - area where more data would help */
export interface EvidenceGapItem {
  factorId: string
  factorLabel: string
  /**
   * Confidence (0-100), or `null` when the producer sent none.
   *
   * ⚠ This was `number`, fabricated at the mapper with `gap.confidence ?? 0`.
   * `0` is a VALUE, and the triage card asserted it as one —
   * "This factor has 0% confidence." plus a "No data" pill computed from
   * `confidence <= 0`. Absence must suppress the sentence, not print a zero:
   * "we were not told" and "we were told zero" are different facts and the
   * user cannot tell them apart from a rendered 0. Nullable so every consumer
   * has to decide, and so a future `?? 0` is a visible act.
   */
  confidence: number | null
  /** Value of Information (0-1) - higher = more impactful to investigate */
  voi: number
  /** ISL EVPI: expected value of perfect information (absolute units) — gated on presence */
  evpi?: number
  /**
   * ⛔ `evpiPp` DELETED — do not reinstate.
   *
   * `evpi_percentage_points` is refuted, not merely uncalibrated: PLoT
   * publishes 12.3pp for a factor ISL measures at 0.0pp in the same payload,
   * and the formula multiplies BY the top-two win-probability gap, inverting
   * decision theory. It was rendered to users in eight places and used as a
   * SELECTION GATE that emptied the evidence-gap list on a near-tie.
   * See tests/contracts/no-evpi-display.contract.test.ts.
   */
  suggestion: string
  /** Node ID for canvas focus (may differ from factorId) */
  targetNodeId?: string
}

/** Next action from M1 Coaching - prioritised recommendation */
export interface NextActionItem {
  action: string
  rationale: string
  /** Lower = more important */
  priority: number
  targetType?: 'node' | 'edge' | 'factor' | 'option'
  targetId?: string
  targetLabel?: string
}

/** Assumption from M1 Coaching ledger */
export interface AssumptionItem {
  severity: 'low' | 'medium' | 'high'
  message: string
  target?: string
}

/** Conditional winner entry from ISL (factor-dependent recommendation splits) */
export interface ConditionalWinner {
  /** Factor label driving the split */
  factor_label: string
  /** Factor node ID */
  factor_id: string
  /** Split value where winner changes */
  split_value: number
  /** Unit for display */
  split_unit?: string
  /** Winner label when factor is above split */
  high_bucket: { winner_label: string; win_probability: number }
  /** Winner label when factor is below split */
  low_bucket: { winner_label: string; win_probability: number }
}

/** Inference warning from ISL (model gaps) */
export interface InferenceWarning {
  /** Warning code (e.g. 'MISSING_ROOT_VALUE') */
  code: string
  /** Affected node IDs */
  affected_nodes: string[]
  /** Affected node labels (resolved from canvas) */
  affected_labels?: string[]
  /** Human-readable message */
  message?: string
  /**
   * Producer severity ('info' | 'warning' | …) carried verbatim. Roadmap
   * 1.12: warning-severity entries surface on the Analysis tab; info stays
   * hidden. Optional/additive — absent when the producer omitted it.
   */
  severity?: string
}

export interface ConfidenceSectionData {
  tier: ConfidenceTierInfo
  /** Quality score 0-100 from graph readiness or fallback */
  qualityScore: number | null
  /** Merged uncertainties from critiques and sensitivity analysis */
  uncertainties: UncertaintyItem[]
  topUncertainties: UncertaintyItem[] // Top 3
  /** Task 1: Total high-risk edges (above threshold) before display limit */
  totalHighRiskEdges?: number
  /** Ranking stability from robustness (0-1) */
  rankingStability?: number
  /** Robustness level from PLoT (high/medium/low/very_low) */
  robustnessLevel?: RobustnessLevel
  /** Evidence coverage from graph readiness */
  evidenceCoverage?: EvidenceCoverage
  /** Merged and deduplicated improvements */
  improvements: ImprovementItem[]
  topImprovements: ImprovementItem[] // Top 2
  /** Status fields from runMeta */
  analysisStatus?: string
  driversStatus?: string
  robustnessStatus?: string
  /** Disclosure when fragile edges are filtered below threshold */
  filteredFragileEdges?: FilteredItemsDisclosure
  /** Task 1: Count of high-risk edges hidden by display limit (above threshold but not shown) */
  hiddenHighRiskCount?: number

  /** P1 Integration: Top fragile edge for HeroSection bullet 3 */
  topFragileEdge?: {
    fromId: string
    fromLabel: string
    toId: string
    toLabel: string
    alternativeWinnerLabel: string
    alternativeWinnerId?: string
    switchProbability?: number
    /** Task C: Whether labels were successfully resolved (true) or fell back to "Unknown" (false) */
    labelsResolved?: boolean
  }

  // ==========================================================================
  // M1 Coaching Fields (deterministic, not LLM-generated)
  // ==========================================================================

  /** M1 Coaching evidence gaps - areas where more data would improve decision confidence */
  evidenceGaps?: EvidenceGapItem[]
  /**
   * M1 Coaching top evidence gaps — the first 3 of `evidenceGaps`, in the
   * producer's emission order. No client-side selection gate and no
   * client-side re-rank: PLoT already selects (non-lever ∧ top-k by ISL
   * `importance_rank` ∧ confidence < 0.7) and emits in its own order.
   *
   * `topEvidenceGapsEmpty` was deleted with the EVPI gate that was its only
   * cause. It can no longer arise: this list is empty iff `evidenceGaps` is.
   */
  topEvidenceGaps?: EvidenceGapItem[]
  /** M1 Coaching next actions - prioritised recommendations */
  nextActions?: NextActionItem[]
  /** M1 Coaching top next actions (max 3, sorted by priority) */
  topNextActions?: NextActionItem[]
  /** M1 Coaching assumptions from ledger */
  assumptions?: AssumptionItem[]
  /** Humanised critique items for attention banner (non-SENSITIVE_ASSUMPTION only) */
  humanisedCritiques?: Array<{ title: string; description: string; displayText: string | null; suggestion?: string; factorId?: string }>

  // ==========================================================================
  // V12: M1 Coaching Top Fragile Edge + M2 Fields
  // ==========================================================================

  /** V12: M1 coaching's pick for the single most decision-relevant sensitivity (Priority 0 hinge) */
  m1CoachingTopFragileEdge?: {
    fromId: string
    fromLabel: string
    toId: string
    toLabel: string
    switchProbability: number
    alternativeWinnerLabel: string | null
  }
  /** V12: Review status for M2 gate ('complete' enables M2 data) */
  reviewStatus?: string
  /** V12: M2 bias findings (structured) */
  m2BiasFindings?: Array<{
    type: string
    source: string
    description: string
    affectedElements: string[]
    linkedCritiqueCode: string
  }>
  /**
   * V12: M2 decision quality prompts (structured). Lane 1 (P1): the entry
   * shape is owned by `utils/decisionQualityPrompts` (single mapping site) and
   * carries optional id-gated DSK provenance — dskClaimId / dskProtocolId /
   * evidenceStrength are present ONLY when the wire entry attested a
   * `dsk_claim_id`; absence means "not grounded", never "unknown default".
   */
  m2DecisionQualityPrompts?: MappedDecisionQualityPrompt[]
  /** V12: M2 evidence enhancements per factor_id */
  m2EvidenceEnhancements?: Record<string, { specific_action: string; decision_hygiene: string }>
  /** V12: M2 narrative summary paragraph */
  m2NarrativeSummary?: string

  // ==========================================================================
  // New ISL Fields (gated on presence)
  // ==========================================================================

  /** ISL conditional_winners — factor-dependent recommendation splits */
  conditionalWinners?: ConditionalWinner[]
  /** ISL inference_warnings — model gap warnings */
  inferenceWarnings?: InferenceWarning[]
  /** ISL edge_e_values — sensitivity measure per edge */
  edgeEValues?: Array<{ edge_id: string; e_value: number }>
  /** Fragile edges from robustness — for ChallengeSection Model structure subgroup */
  challengeFragileEdges?: Array<{ edge_id?: string; from_id?: string; to_id?: string; from_label: string; to_label: string; switch_probability: number }>
}

// =============================================================================
// Improvements Types (Legacy - now merged into ConfidenceSectionData)
// =============================================================================

export interface ImprovementsSectionData {
  improvements: ImprovementItem[]
  count: number
  hasHighPriority: boolean
}

// =============================================================================
// Click-to-Focus Event
// =============================================================================

export interface FocusCanvasEvent {
  nodeId: string
  source: 'objective' | 'recommendation' | 'drivers' | 'confidence' | 'improvements'
}

// =============================================================================
// Raw Factor Data (from response, before presentation transform)
// =============================================================================

/** ISL zero_reason codes - explains why influence is zero for intervention factors */
export type ZeroReasonCode = 'intervention_override' | 'disconnected' | 'zero_outcome_diff' | null

/** PLoT flip_risk_category - how a factor contributes to decision uncertainty */
export type FlipRiskCategory = 'isolated' | 'correlated' | 'negligible'

export interface RawFactorSensitivity {
  factor_id?: string
  node_id?: string
  id?: string
  label?: string
  elasticity?: number
  sensitivity_score?: number
  sensitivity?: number
  /** P0 Fix: PLoT may return importance_score instead of elasticity/sensitivity_score */
  importance_score?: number
  /** ISL influence_score (0-1) - structural causal influence */
  influence_score?: number
  /** Producer influence_rank (1 = most influential). Additive passthrough; roadmap 1.7 (provisional_doctrine_v0). */
  influence_rank?: number
  /** ISL zero_reason - explains why sensitivity is zero for intervention factors */
  zero_reason?: ZeroReasonCode
  direction?: string
  importance_rank?: number
  /** Confidence signal for factor influence (0-1), used for driver confidence */
  value_of_information?: number
  /** Confidence in this factor's influence (0-1), from PLoT factor_sensitivity */
  confidence?: number
  /** Breakdown of confidence into structural and sampling components */
  confidence_components?: {
    structural_certainty: number
    sampling_stability: number | null
  }
  /** ISL bootstrap stability */
  attribution_stability?: 'high' | 'moderate' | 'low' | 'negligible'
  rank_flip_rate?: number
  evpi?: number
  evpi_percentage_points?: number
  /** Track S: provenance of the factor value. Optional/additive; mirrors V2FactorSensitivity. */
  value_source?: string
  /** Track S: how the value was obtained (explicit / inferred / …). Optional/additive. */
  value_extraction_type?: string
  /** Track S: true when the value was assumed/defaulted. Optional/additive. */
  value_defaulted?: boolean
}

export interface UiFactorSensitivity {
  factorId: string
  label: string
  elasticity: number
  /**
   * The producer's direction across its full domain, or `null` when the
   * producer sent none (ROADMAP 2.234). Was `'positive' | 'negative'`, which
   * could only be satisfied by inventing one.
   */
  direction: FactorDirection | null
  confidence: number | null
  importanceRank: number
  /** ISL influence_score (0-1) - structural causal influence */
  influenceScore?: number
  /** Producer influence_rank (1 = most influential). Additive; roadmap 1.7 (provisional_doctrine_v0). */
  influenceRank?: number
  /** ISL zero_reason - explains why sensitivity is zero */
  zeroReason?: ZeroReasonCode
  /** ISL value_of_information (0-1) - whether gathering more data could change the decision */
  valueOfInformation?: number
  /** PLoT flip_risk_category - how this factor contributes to decision uncertainty */
  flipRiskCategory?: FlipRiskCategory
  /**
   * PLoT confidence_source — accepts BOTH new honest enum values and legacy
   * strings ('isl', 'isl_default') so cached/old PLoT payloads still flow
   * through the existing `isDefaultedConfidence` derivation. Audit A1-PRIMARY.
   */
  confidenceSource?: string
  /** Sampling stability from confidence_components (0 → ISL bootstrap was degenerate) */
  samplingStability?: number | null
  /** Confidence provenance disclosure object (audit A1-PRIMARY). Optional for backwards compat. */
  confidenceProvenance?: ConfidenceProvenance
  attributionStability?: 'high' | 'moderate' | 'low' | 'negligible'
  rankFlipRate?: number
  evpi?: number
  /** Track S: provenance of the factor value. Optional; absent on pre-Track-S payloads. */
  valueSource?: string
  /** Track S: how the value was obtained (explicit / inferred / …). Optional. */
  valueExtractionType?: string
  /** Track S: true when the value was assumed/defaulted. Distinct from isDefaultedConfidence (a confidence signal). */
  valueDefaulted?: boolean
  /** Producer worth_investigating flag (strict read: only an explicit wire
   * `true` sets it; never derived from EVPI locally). Additive — threads the
   * engine flag through to the Strengthen VOI trigger. */
  worthInvestigating?: boolean
}

// =============================================================================
// Edge Data (for direction derivation)
// =============================================================================

export interface EdgeForDirection {
  source?: string
  from?: string
  target?: string
  to?: string
  effect_direction?: string
  direction?: string
}

// =============================================================================
// V11: Results View Model Types
// =============================================================================

/** Tri-state decision classification driving hero, colours, and collapse behaviour */
export type DecisionState = 'robust' | 'sensitive' | 'indeterminate'

/** Evidence quality derived from decision state + fragile ratio */
export type EvidenceLevel = 'good' | 'fair' | 'needs_work'

/** Deterministic single-uncertainty selection for coaching copy */
export interface HingeInfo {
  /** The uncertainty FACTOR name (from_label), NOT the edge or option */
  label: string
  /** Always from_id — the input factor the user can edit */
  nodeId: string
  /** 'edge' if from fragile_edges, 'node' if from VOI/heuristic */
  kind: 'edge' | 'node'
  /** How the hinge was selected */
  reason: 'fragile_edge' | 'voi' | 'heuristic' | 'none'
  /** Full edge description "X → Y" — for tooltip / "More detail" only */
  edgeDetail: string | null
  /** Label of the option that would win if this assumption shifts */
  alternativeWinnerLabel: string | null
}

/** VOI-driven top action recommendation */
export interface TopAction {
  /** Factor label for display */
  label: string
  /** Node ID for focus */
  nodeId: string
  /** True when this factor could flip the recommendation */
  couldFlip: boolean
}

/** Extra metadata not in ResultsSectionDataReturn (passed from parent) */
export interface BuildResultsVMMeta {
  fragileEdgeCount?: number
  totalEdgeCount?: number
}

/** Enriched view model layered on top of ResultsSectionDataReturn */
export interface ResultsVM {
  decisionState: DecisionState
  gapTop2: number
  hinge: HingeInfo | null
  evidenceLevel: EvidenceLevel
  topAction: TopAction | null
  /** Pass-through to underlying data */
  raw: import('./useResultsSectionData').ResultsSectionDataReturn
}

// =============================================================================
// Trust Boundary Types
// =============================================================================
// These types capture the actual runtime shape of data consumed by
// useResultsSectionData. They replace `as any` casts at the trust boundary
// between backend responses and UI components.

/**
 * Extended report type representing the actual shape of `results.report`
 * as produced by `mapV2ResponseToReportV1()` in the response mapper.
 *
 * The mapper returns a `ReportV1` plus additional V2 pass-through fields
 * that are not declared on the base interface. This type makes those
 * fields explicitly typed so consumers don't need `as any`.
 */
export interface ResultsReport extends Omit<ReportV1, 'option_probabilities'> {
  /** Widened option_probabilities with V2 pass-through fields */
  option_probabilities?: Record<string, ResultsOptionProbability>
  // V2 pass-through fields from responseMapper
  factor_sensitivity?: V2FactorSensitivity[]
  robustness?: {
    // Optional (T2 receipts-honesty): the V5 mapper preserves ABSENCE —
    // keys exist only when the producer sent an array ([] = honest "none",
    // absent = "engine said nothing" → receipt rows fail closed). The V4
    // mapper still always emits both when robustness is present, because
    // the V2 wire contract requires them (V2RobustnessActual).
    fragile_edges?: Array<Record<string, unknown>>
    robust_edges?: Array<Record<string, unknown>>
    ranking_stability?: number
    recommendation_stability?: number
    is_robust?: boolean
    level?: string
    recommended_option_id?: string
    near_tie?: Record<string, unknown>
    nearTie?: Record<string, unknown>
    /**
     * Display-safe verdict + producer reason (PLoT #202, ROADMAP 1.6) —
     * mapped-report slot of the responseMapper passthrough; normalised
     * fail-closed in useResultsSectionData.
     */
    display_verdict?: string
    display_verdict_reason?: string
    flip_thresholds?: Array<Record<string, unknown>>
    // ⚠ `inference_warnings` is DELIBERATELY NOT DECLARED HERE, even though the
    // V4/V2 mapper nests it in this slot. Adding a member to this INLINE object
    // type changes the elided-member counter TypeScript prints inside four
    // unrelated baselined diagnostics in `useResultsSectionData.ts`
    // ("… 8 more …" → "… 9 more …"), which makes the typecheck gate emit its
    // identity-diff notice on a clean tree — and `typecheck:selftest`'s green
    // control asserts that notice does NOT appear on a clean tree. So declaring
    // it here reds a required check for a purely cosmetic reason.
    // `readInferenceWarnings()` in `useResultsSectionData.ts` reads this slot
    // through one narrow cast instead, and it is the LEGACY slot regardless:
    // measured 0/773 on live staging facts (root 773/773) — see
    // `canvas/stores/persistedRunSnapshotFactory.ts`.
    _truncation?: {
      fragile_truncated: boolean
      fragile_total: number
      robust_truncated: boolean
      robust_total: number
    }
  }
  robustness_status?: 'computed' | 'unavailable' | 'skipped' | 'error'
  option_comparison?: V2OptionComparison[]

  // Fields accessed by useResultsSectionData that may appear on report
  flip_thresholds?: Array<Record<string, unknown>>
  recommendation?: { option_id?: string; selected_option?: string }
  selected_option_id?: string
  evidence_quality?: Record<string, unknown>
  bias_findings?: Array<Record<string, unknown>>
  quality_factors?: Array<Record<string, unknown>>
  improvement_guidance?: Array<Record<string, unknown>>
  analysis_state?: string
  /** PLoT-classified confidence tier (B2, optional for cached pre-B1 results) */
  confidence_tier?: 'strong' | 'fair' | 'needs_work'
  /**
   * Constraint-evaluation feature status (PLoT #205). NOT on the CEE→UI
   * Seam-A wire today (absent from compose.ts's keep-list) — declared here
   * so the mapper's forward-compatible passthrough is typed; expect
   * undefined until a CEE lane adds it to the keep-list.
   */
  constraints_status?: 'computed' | 'unavailable' | 'skipped' | 'error'
  /** PLoT-classified dominant factor (B2, optional for cached pre-B1 results) */
  dominant_factor?: { factor_id: string; factor_label: string }
  /**
   * Reference-option disclosure (Lane UI-W5): option ID the sensitivities /
   * fragile edges were computed against. Mapper pass-through of the /v2/run
   * root field; absent on older PLoT/ISL builds. provisional_doctrine_v0.
   */
  sensitivity_reference_option_id?: string
  drivers_error?: string
  sensitivity?: { factors?: Array<Record<string, unknown>>; error?: string }
  isl_error?: string
  downstream_calls?: unknown
  factors?: Array<Record<string, unknown>>
  factor_enrichments?: Array<Record<string, unknown>>
  /**
   * V7-C slice 1 (ROADMAP 2.141): the mapper's verbatim carry of
   * `enrichment.factor_evppi` (`src/v5/mapV5AnalysisToReport.ts`).
   *
   * `unknown[]` ON PURPOSE — the ROW shape is validated at the one reader
   * (`voi/voiRanking.ts`) against the pinned `EnrichmentFactorEvppiEntrySchema`,
   * never here. What matters is that the KEY is declared: while it was absent,
   * every read of it needed `(report as unknown as Record<string, unknown>)`,
   * and a mistyped key inside that cast yields `undefined` — so the honest gate
   * would render forever with nothing red anywhere. Declaring the key is what
   * makes the typo a compile error instead of a silent permanent gate.
   */
  factor_evppi?: unknown[]
  /**
   * ISL `inference_warnings[]` — the enrichment-ROOT slot. Same reasoning as
   * `factor_evppi`: declared so readers do not cast, entries left `unknown`
   * because each reader validates the codes it cares about. Read it through
   * `readInferenceWarnings()` in `useResultsSectionData.ts`, which also covers
   * the legacy `robustness.inference_warnings` slot.
   */
  inference_warnings?: unknown[]
}

/**
 * Extended option probability with all fields the mapper may add.
 * Widens the base OptionProbability from plot/types.
 */
export interface ResultsOptionProbability extends OptionProbability {
  expected_outcome?: number
  expected?: number
  outcome?: {
    mean?: number | null
    p10?: number | null
    p50?: number | null
    p90?: number | null
  }
  bands?: { p10?: number | null; p50?: number | null; p90?: number | null }
  constraint_analysis?: ConstraintAnalysis
  /**
   * Provenance caveat for probability_of_joint_goal (PLoT #204, doctrine
   * B): present when the joint-goal number was scored from the
   * constraint-target node's MODELLED forward-propagated outcome
   * distribution rather than a directly-elicited base. `scored_from` is
   * producer-owned open vocabulary (currently always
   * 'modelled_outcome_distribution'). Render sites that show the
   * joint-goal number MUST surface this caveat alongside it — see
   * UI-BOUNDARY-DATA-INVENTORY.md §5.
   */
  goal_fit_basis?: { scored_from?: string; node_ids?: string[] }
  /**
   * ROADMAP 2.449 — per-option tail-risk view from ISL, forwarded by PLoT.
   * Values are in the SAME units and on the SAME axis as `outcome.mean` /
   * `outcome.p10` (no normalisation of their own), so any consumer that scales
   * the percentile family MUST scale these identically. Present only when the
   * producer emitted all three components as finite numbers; absent otherwise
   * — never zeroed, never null.
   */
  downside?: { cvar_10: number; p05: number; expected_regret: number }
  /**
   * ROADMAP 2.646 — percentile provenance, wire-named and carried verbatim by
   * the V5 mapper (which narrows it to the producer's closed vocabulary first).
   *
   * ⚠ THIS INTERFACE AND `mapV5AnalysisToReport`'s FUNCTION-LOCAL
   * `ResultsOptionProbability` ARE TWINS: one describes what the mapper WRITES,
   * this one describes what the hook READS, and nothing makes them agree except
   * a human noticing. That is the same-named-twin shape CLAUDE.md trap 16 names
   * (`generateGraphHash`), and it is why a field added to only one of them
   * vanishes silently at the seam. Both moved in this row; a spec drives the
   * REAL mapper into the REAL hook so the pair is checked by execution rather
   * than by memory.
   *
   * Absent means absent — see `downsideUnavailableCopy`.
   */
  percentiles_source?: PercentilesSource
}

/**
 * Canvas node data shape as accessed by results hooks.
 * Captures the subset of node.data fields needed for results computation.
 */
export interface ResultsCanvasNodeData {
  kind?: string
  label?: string
  is_baseline?: boolean
  observedState?: { value?: number; unit?: string; [key: string]: unknown }
  observed_state?: { value?: number; unit?: string; [key: string]: unknown }
  goal_threshold_unit?: string
  goal_threshold_raw?: number
  goal_threshold?: number
  success_threshold?: number
  threshold?: number
  threshold_cap?: number
  scale_max?: number
  [key: string]: unknown
}

/**
 * Canvas edge data shape as accessed by results hooks.
 */
export interface ResultsCanvasEdgeData {
  effect_direction?: string
  direction?: string
  beliefExists?: number
  [key: string]: unknown
}
