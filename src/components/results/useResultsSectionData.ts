/**
 * useResultsSectionData Hook
 *
 * Transforms V2RunResponse and canvas store data into section-specific data structures
 * for the redesigned Results Panel components.
 *
 * Implements "coaching over gates" philosophy:
 * - Dynamic normalisation for driver influence
 * - Semantic labels (rank-based top, threshold rest)
 * - Direction derived from edges with normalisation
 * - Confidence tier with full fallback chain
 * - Merged improvements with deduplication
 */

import { useEffect, useMemo } from 'react'
import { safeArray } from '../../lib/array-utils'
import { useCanvasStore } from '../../canvas/store'
import { THRESHOLDS, LIMITS } from '../../lib/mappers/constants'
import { useShallow } from 'zustand/react/shallow'
import { findNodeMatches, type Driver } from '../../canvas/utils/driverMatching'
import { isDefaultedConfidenceFromRaw } from './driverConfidenceDisplayPolicy'
import type { Node } from '@xyflow/react'
import type {
  DecisionResultData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
  DriverItem,
  UncertaintyItem,
  ImprovementItem,
  DriverSemanticLabel,
  DriverDirection,
  ConfidenceTier,
  RawFactorSensitivity,
  UiFactorSensitivity,
  EdgeForDirection,
  CritiqueSeverity,
  FlipRiskCategory,
  FlipThreshold,
  WinnerDeterminedBy,
  RobustnessLevel,
  RobustnessLabel,
  RobustnessDisplayVerdict,
  ResultsReport,
  ResultsCanvasNodeData,
  ResultsCanvasEdgeData,
  ConfidenceSource,
  ConfidenceFormulaVersion,
  ConfidenceCalibrationStatus,
  ConfidenceInputQuality,
  ConfidenceProvenance,
} from './types'
import { normalizeAutoNoiseProvenance, normalizeHeadlineBanded } from './types'
import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../../lib/decisionVerdict'
import type { FactorEnrichment, NearTieInfo } from '../../lib/mappers/types'
import { normaliseFactorFields } from '../../lib/mappers/mapFactorSensitivity'
import { stripEncodingNotation, sanitizeCoachingText } from './utils/cleanFactorLabel'
import { humaniseCritique } from './utils/humaniseCritique'
import { selectGoalProbability, type GoalProbabilityInput } from './utils/selectGoalProbability'
import { sortOptionsForDisplay } from './utils/optionDisplayOrder'
import { deriveStabilityLevel } from '../../lib/stability'
import { deriveResultCompleteness, type ResultCompleteness } from './useResultCompleteness'
import { computeNormalisedInfluences, selectDriverDisplayModel } from './driverDisplayModel'

// =============================================================================
// Winner Selection Helper
// =============================================================================

export function determineWinnerSelection(
  options: OptionResult[],
  backendRecommendedId?: string | null
): { recommendedId: string | null; determinedBy: WinnerDeterminedBy } {
  if (options.length === 0) {
    return { recommendedId: null, determinedBy: 'unknown' }
  }

  if (backendRecommendedId) {
    const backendOption = options.find(opt => opt.id === backendRecommendedId)
    if (backendOption?.winProbability != null) {
      return { recommendedId: backendRecommendedId, determinedBy: 'win_probability' }
    }
    if (backendOption?.expected != null || backendOption?.p50 != null) {
      return { recommendedId: backendRecommendedId, determinedBy: 'expected_outcome' }
    }
    return { recommendedId: backendRecommendedId, determinedBy: 'unknown' }
  }

  const optionsWithWinProbability = options.filter(
    opt => typeof opt.winProbability === 'number'
  )
  const hasCompleteWinProbabilityCoverage =
    optionsWithWinProbability.length > 0 &&
    optionsWithWinProbability.length === options.length

  if (hasCompleteWinProbabilityCoverage) {
    const winnerByProb = [...optionsWithWinProbability]
      .sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))[0]
    return {
      recommendedId: winnerByProb?.id ?? null,
      determinedBy: 'win_probability',
    }
  }

  // Task 2.4: Deterministic tie-breaker when no backend recommendation
  // Priority: p50 (higher wins) > mean (higher wins) > option_id (alphabetical)
  const winnerByExpected = [...options]
    .sort((a, b) => {
      // 1. p50 (higher wins)
      const aP50 = a.outcome?.p50 ?? a.p50 ?? -Infinity
      const bP50 = b.outcome?.p50 ?? b.p50 ?? -Infinity
      if (aP50 !== bP50) return bP50 - aP50

      // 2. mean/expected (higher wins)
      const aMean = a.expected ?? a.outcome?.mean ?? a.goalProbability ?? -Infinity
      const bMean = b.expected ?? b.outcome?.mean ?? b.goalProbability ?? -Infinity
      if (aMean !== bMean) return bMean - aMean

      // 3. option_id (alphabetical)
      return a.id.localeCompare(b.id)
    })[0]

  return {
    recommendedId: winnerByExpected?.id ?? null,
    determinedBy: 'expected_outcome',
  }
}

// =============================================================================
// Baseline Resolution Helper (Task 2.1)
// =============================================================================

/**
 * Resolve the baseline option ID with proper precedence.
 * Order: PLoT is_baseline > user selection > heuristic (Status Quo label)
 *
 * @param options - Option results from report
 * @param optionNodes - Raw option nodes from canvas
 * @param userSelectedBaselineId - User-selected baseline ID (from state)
 * @returns Resolved baseline option ID or null
 */
export function resolveBaselineId(
  options: Array<{ id: string; label: string }>,
  optionNodes: Array<{ id: string; data: { is_baseline?: boolean; label?: string } }>,
  userSelectedBaselineId?: string | null
): string | null {
  // 1. PLoT-provided baseline (option with is_baseline: true)
  const plotBaseline = optionNodes.find(node => node.data?.is_baseline === true)
  if (plotBaseline) return plotBaseline.id

  // 2. User-selected baseline
  if (userSelectedBaselineId) {
    // Verify the user selection is still valid
    const userOption = options.find(o => o.id === userSelectedBaselineId)
    if (userOption) return userSelectedBaselineId
  }

  // v7.5: Removed label heuristic — only honour explicit baseline flags.
  // Heuristic caused baseline row to hide when option contained "Status Quo".

  return null
}

// =============================================================================
// Factor Key Derivation (CRITICAL: Standardisation)
// =============================================================================

/**
 * Normalise label to a key format (lowercase, underscores)
 */
function normaliseLabel(label: string | undefined): string {
  return label?.toLowerCase().replace(/\s+/g, '_') ?? 'unknown'
}

/**
 * Normalise critique severity to typed value.
 * Handles both uppercase (BLOCKER) and lowercase (blocker) inputs.
 */
function normaliseSeverity(severity: string | undefined): CritiqueSeverity {
  const normalised = severity?.toLowerCase()
  if (normalised === 'blocker') return 'blocker'
  if (normalised === 'error') return 'error'
  if (normalised === 'info') return 'info'
  return 'warning' // Default
}

/**
 * Get canonical factor key from various ID fields.
 * Pre-mapped data: uses factorId (already resolved).
 * Raw data: delegates to normaliseFactorFields (node_id > factor_id > id > label).
 */
function getFactorKey(factor: RawFactorSensitivity | UiFactorSensitivity, index: number): string {
  // Pre-mapped UiFactorSensitivity has factorId already resolved
  if ('factorId' in factor && factor.factorId) return factor.factorId
  // Raw data — use centralised field resolution
  const { node_id, label: resolvedLabel } = normaliseFactorFields(factor as Record<string, unknown>)
  if (node_id) return node_id
  if (resolvedLabel) return normaliseLabel(resolvedLabel)
  // Fallback: generate unique key using index
  return `factor_${index}`
}

// =============================================================================
// Raw Elasticity Extraction (CRITICAL: Fallback Chain)
// =============================================================================

/**
 * Safely extract a numeric value if it's a finite number.
 */
function safeFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && isFinite(value) ? value : null
}

/**
 * Extract raw elasticity with fallback chain.
 *
 * ============================================================================
 * FACTOR INFLUENCE CONTRACT (M0)
 * ============================================================================
 *
 * Fallback priority for factor influence value:
 * 1. elasticity (if present and finite)
 * 2. sensitivity_score (if present, finite, AND not a placeholder zero)
 *    - EXCEPTION: Skip if sensitivity_score=0 but importance_score > 0 (P0 Fix)
 * 3. sensitivity (if present and finite)
 * 4. importance_score (if present and > 0)
 * 5. contribution (legacy, if present)
 * 6. 0 (default)
 *
 * CRITICAL: The responseMapper MUST preserve importance_score from ISL response.
 * If importance_score is dropped during mapping, factors will show 0% influence.
 *
 * See: responseMapper.ts pickFactorSensitivityForUi() for upstream contract.
 * Contract tests: src/test/integration/results-panel-contract.test.ts
 */
function getRawElasticity(factor: RawFactorSensitivity | UiFactorSensitivity): number {
  // Type-safe access to known fields
  const f = factor as Record<string, unknown>

  // Priority chain: prefer more specific fields first
  const elasticity = safeFiniteNumber(f.elasticity)
  if (elasticity !== null) return elasticity

  // P0 Fix: Check importance_score early to handle "0 blocks fallback" edge case
  // If sensitivity_score is 0 but importance_score > 0, prefer importance_score
  const importanceScore = safeFiniteNumber(f.importance_score)

  const sensitivityScore = safeFiniteNumber(f.sensitivity_score)
  // Skip sensitivity_score if it's 0 but importance_score has real data
  if (sensitivityScore !== null && (sensitivityScore !== 0 || importanceScore === null || importanceScore <= 0)) {
    return sensitivityScore
  }

  const sensitivity = safeFiniteNumber(f.sensitivity)
  if (sensitivity !== null) return sensitivity

  // importance_score only if > 0 (avoid placeholder zeros)
  if (importanceScore !== null && importanceScore > 0) return importanceScore

  // Legacy fallback
  const contribution = safeFiniteNumber(f.contribution)
  if (contribution !== null) return contribution

  return 0
}

/**
 * Type guard for the raw `confidence_provenance` object shape coming from PLoT.
 *
 * Forward-compat: this UI ships ahead of Jinghui calibration. When PLoT bumps
 * to `plot_unified_v3` (or extends `calibration_status` / `input_quality`
 * vocabularies), the column-header `is_provisional` disclosure must continue
 * to render — losing it would silently regress the audit A1-PRIMARY fix.
 *
 * Therefore the guard accepts `formula_version` matching the
 * `plot_unified_<n>` family, and tolerates unknown enum values for
 * `calibration_status` / `input_quality`. The UI only renders the
 * `is_provisional` boolean today; the strict literal types stay on the
 * payload-level interface so downstream typed consumers can still narrow.
 */
export function isValidConfidenceProvenance(value: unknown): value is {
  computation_source: ConfidenceSource
  formula_version: ConfidenceFormulaVersion
  is_provisional: boolean
  calibration_status: ConfidenceCalibrationStatus
  input_quality: ConfidenceInputQuality
} {
  if (value == null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const computationSourceValid =
    v.computation_source === 'plot_unified_from_isl_bootstrap'
    || v.computation_source === 'plot_unified_from_graph'
  const formulaVersionValid =
    typeof v.formula_version === 'string' && /^plot_unified_v\d+$/.test(v.formula_version)
  return (
    computationSourceValid
    && formulaVersionValid
    && typeof v.is_provisional === 'boolean'
    && typeof v.calibration_status === 'string'
    && typeof v.input_quality === 'string'
  )
}

/**
 * Re-exported from `driverConfidenceDisplayPolicy`, where the rule now lives
 * alongside the display gate that consumes it (one small module the canvas can
 * import without pulling in this hook file). Kept exported here so existing
 * importers and the cross-version compat unit tests are unaffected — there is
 * exactly ONE implementation, not two.
 */
export { isDefaultedConfidenceFromRaw }

export function normalizeFactorSensitivity(raw: unknown, nodeLabelMap: Map<string, string>): UiFactorSensitivity {
  if (raw == null || typeof raw !== 'object') return { factorId: '', label: 'Unknown factor', elasticity: 0, direction: 'positive' as const, confidence: null, importanceRank: 0 }
  const typed = raw as Record<string, unknown>
  const nf = normaliseFactorFields(typed)
  const rawId = nf.node_id
  const labelFromNodes = rawId ? nodeLabelMap.get(rawId) : undefined
  const label = nf.label ?? typed.node_label ?? labelFromNodes ?? rawId ?? 'Unknown factor'
  const elasticity =
    typeof typed.elasticity === 'number' ? typed.elasticity
      : typeof typed.sensitivity_score === 'number' ? typed.sensitivity_score
        : typeof typed.sensitivity === 'number' ? typed.sensitivity
          : typeof typed.importance_score === 'number' ? typed.importance_score
            : 0
  // Confidence in factor's influence (0-1) - separate from value_of_information
  const confidence = typeof typed.confidence === 'number'
    ? typed.confidence
    : null
  const direction = typed.direction
    ? (String(typed.direction).toLowerCase() === 'negative' ? 'negative' : 'positive')
    : elasticity >= 0 ? 'positive' : 'negative'

  // ISL influence_score (0-1) - structural causal influence
  const influenceScore = typeof typed.influence_score === 'number' ? typed.influence_score : undefined

  // Producer influence_rank (1 = most influential). Additive passthrough;
  // roadmap 1.7 (provisional_doctrine_v0: influence ≠ sensitivity).
  const influenceRank = typeof typed.influence_rank === 'number' ? typed.influence_rank : undefined

  // ISL zero_reason - explains why sensitivity is zero for intervention factors
  const zeroReason = typed.zero_reason as UiFactorSensitivity['zeroReason']

  // ISL value_of_information (0-1) - whether gathering more data could change the decision
  // Support both snake_case (from PLoT) and camelCase (from UI-side transforms)
  const valueOfInformation = typeof typed.value_of_information === 'number'
    ? typed.value_of_information
    : typeof typed.valueOfInformation === 'number'
      ? typed.valueOfInformation
      : undefined

  // PLoT flip_risk_category - how this factor contributes to decision uncertainty
  // Support both snake_case (from PLoT) and camelCase (from UI-side transforms)
  const rawFlipRiskCategory = typed.flip_risk_category ?? typed.flipRiskCategory
  const flipRiskCategory: FlipRiskCategory | undefined =
    rawFlipRiskCategory === 'isolated' || rawFlipRiskCategory === 'correlated' || rawFlipRiskCategory === 'negligible'
      ? rawFlipRiskCategory
      : undefined

  // V14.1: confidence_source — accepts legacy ('isl' | 'isl_default') AND
  // new honest enum values ('plot_unified_from_isl_bootstrap' |
  // 'plot_unified_from_graph') from PLoT. Audit A1-PRIMARY.
  const confidenceSource = typeof typed.confidence_source === 'string'
    ? typed.confidence_source
    : undefined

  // V14.2: sampling_stability from confidence_components (0 for ISL-defaulted, null for graph-sourced)
  const samplingStability = typed.confidence_components?.sampling_stability ?? undefined

  // Audit A1-PRIMARY: confidence_provenance disclosure object — optional for
  // backwards compat (older PLoT responses do not include this field).
  const rawProvenance = (typed as { confidence_provenance?: unknown }).confidence_provenance
  const confidenceProvenance = isValidConfidenceProvenance(rawProvenance)
    ? {
        computationSource: rawProvenance.computation_source,
        formulaVersion: rawProvenance.formula_version,
        isProvisional: rawProvenance.is_provisional,
        calibrationStatus: rawProvenance.calibration_status,
        inputQuality: rawProvenance.input_quality,
      }
    : undefined

  // Track S: factor value provenance — preserve only when present. Strict typeof
  // guards keep an explicit `false` and never coerce an absent value → false.
  const valueSource = typeof typed.value_source === 'string' ? typed.value_source : undefined
  const valueExtractionType = typeof typed.value_extraction_type === 'string' ? typed.value_extraction_type : undefined
  const valueDefaulted = typeof typed.value_defaulted === 'boolean' ? typed.value_defaulted : undefined

  // Producer worth_investigating flag — STRICT read: only an explicit wire
  // `true` (snake_case from PLoT or camelCase from UI-side transforms) sets
  // it; never derived from EVPI locally (that would fake producer provenance
  // in the Strengthen panel's source line). Additive passthrough.
  const worthInvestigating =
    typed.worth_investigating === true || typed.worthInvestigating === true ? true : undefined

  return {
    factorId: rawId ?? label,
    label,
    elasticity,
    direction,
    confidence,
    importanceRank: typeof typed.importance_rank === 'number' ? typed.importance_rank : 0,
    influenceScore,
    influenceRank,
    zeroReason,
    valueOfInformation,
    flipRiskCategory,
    confidenceSource,
    samplingStability,
    confidenceProvenance,
    valueSource,
    valueExtractionType,
    valueDefaulted,
    attributionStability: (typed.attribution_stability === 'high' || typed.attribution_stability === 'moderate' || typed.attribution_stability === 'low' || typed.attribution_stability === 'negligible') ? typed.attribution_stability : undefined,
    rankFlipRate: typeof typed.rank_flip_rate === 'number' ? typed.rank_flip_rate : undefined,
    evpi: typeof typed.evpi === 'number' ? typed.evpi : undefined,
    worthInvestigating,
  }
}

/**
 * Build the set of factor ids the producer explicitly flagged worth
 * investigating in `robustness.value_of_information`. STRICT read: only rows
 * with an explicit `worth_investigating === true` count — no EVPI-derived
 * default here (the canvas islRobustnessAdapter's `?? evpi > 0.05` fallback
 * is a different, labelled path). Matching rule: factor id only (node_id /
 * parameter_id), never label — same discipline as factor enrichments.
 * Exported for direct unit testing. Additive (worth_investigating threading).
 */
export function buildWorthInvestigatingIdSet(voiSuggestions: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(voiSuggestions)) return ids
  for (const raw of voiSuggestions) {
    if (raw == null || typeof raw !== 'object') continue
    const v = raw as Record<string, unknown>
    if (v.worth_investigating !== true) continue
    if (typeof v.node_id === 'string' && v.node_id.length > 0) ids.add(v.node_id)
    if (typeof v.parameter_id === 'string' && v.parameter_id.length > 0) ids.add(v.parameter_id)
  }
  return ids
}

// =============================================================================
// Shared driver policy feed (C4 fix 2 — ONE row feed for every surface)
// =============================================================================

/** Policy input for one merged driver row (same index as `rawFactors`). */
export interface DriverPolicyRow {
  /** Canonical factor key (getFactorKey over the normalised row). */
  key: string
  /** Producer influence score — snake-case wire field only; undefined when absent. */
  influenceScore: number | undefined
  /**
   * Resolved magnitude (normaliseFactorSensitivity chain; 0 when absent).
   * UNSIGNED — always `Math.abs`'d at construction. Consumers rank on this
   * field with a comparator that sorts it as given, so the sign must not
   * survive into the feed: it would order equal-magnitude drivers by
   * direction on one surface and by magnitude on another. Read `rawFactors`
   * for the signed wire value when disclosing direction.
   */
  rawElasticity: number
  /** Factor confidence (0-1) when the wire carried one. */
  confidence: number | null
  /**
   * True when `confidence` above is a producer PLACEHOLDER rather than a
   * computed figure (`isDefaultedConfidenceFromRaw`). Carried on the shared
   * feed so the canvas surfaces resolve the SAME verdict as the Drivers panel
   * for the same report — previously the panel derived it and the canvas hook
   * could not see it at all, which is how the canvas ended up printing a
   * defaulted 0.25 the panel refuses to show.
   */
  confidenceIsDefaulted: boolean
  /** PLoT's confidence disclosure object, when the wire carried a valid one. */
  confidenceProvenance: ConfidenceProvenance | undefined
  /** value_of_information (snake or camel wire field) when present. */
  valueOfInformation: number | undefined
}

export interface DriverPolicyFeed {
  /** Merged + de-duped raw rows (sources 1-5, panel reference order). */
  rawFactors: RawFactorSensitivity[]
  /** True when source 1 resolved via the untyped enrichment passthrough. */
  usedEnrichmentFallback: boolean
  /** Policy input per raw row (same index as rawFactors). */
  policyRows: DriverPolicyRow[]
  /** THE resolved display model every surface renders AND ranks from. */
  displayModel: ReturnType<typeof selectDriverDisplayModel>
}

const EMPTY_DRIVER_POLICY_FEED: DriverPolicyFeed = Object.freeze({
  rawFactors: [],
  usedEnrichmentFallback: false,
  policyRows: [],
  displayModel: new Map(),
})

/**
 * Untyped `enrichment.sensitivity_analysis.factors` passthrough. NOT declared
 * on ReportV1 — every reader of it (this feed, OptionNode, StyledEdge) probes
 * it speculatively, and no writer in the repo puts `enrichment` ON a report
 * (the store keeps it as a SIBLING of `report`, and every resultsComplete
 * caller passes the two separately). We nonetheless keep it as the source-1
 * fallback rather than delete it: proving it unreachable across every
 * hydration path (live map, conversation envelope, V5 apply, history restore)
 * is a negative we cannot fully evidence, and keeping it costs nothing —
 * because it now lives in the SHARED feed, reachable or not, BOTH surfaces
 * resolve the identical rows and the basis cannot fork.
 */
function readEnrichmentFactors(report: ResultsReport): unknown[] | null {
  const probe = report as { enrichment?: { sensitivity_analysis?: { factors?: unknown } } }
  const factors = probe.enrichment?.sensitivity_analysis?.factors
  return Array.isArray(factors) ? factors : null
}

/** Labels play no part in policy keys/metrics (getFactorKey resolves ids
 * before labels, and the label-map fallback needs an id anyway), so the feed
 * normalises with an empty map; the panel re-normalises with the real
 * nodeLabelMap for display labels only. */
const EMPTY_NODE_LABEL_MAP = new Map<string, string>()

/** Per-report memo (C4 review: memoise per REPORT, not per node — the canvas
 * hook runs once per node and must not rebuild the merge each time). */
const driverPolicyFeedCache = new WeakMap<object, DriverPolicyFeed>()

/**
 * The panel's five-source row merge, extracted VERBATIM into a pure function
 * so the Drivers panel and the canvas hook (useNodeDisplayMetadata) consume
 * the SAME rows (build-brief §12.4 single-selector doctrine).
 *
 * C4 fix 2 (adversarial review, verifier-reproduced): sharing the policy
 * FUNCTION (selectDriverDisplayModel) was not enough — the hook fed it a
 * private factor_sensitivity-only feed that DROPPED metric-less rows
 * (extractPolicyRow), while the panel's merge KEEPS them. The coverage
 * verdict (producer scores adopted only when EVERY row carries one) then
 * flipped per surface, so the canvas pill disclosed "absolute" while the
 * panel disclosed "relative, top always 100%" for the SAME report. The feed
 * being shared makes that fork impossible.
 *
 * Note the merge deliberately KEEPS rows with no finite metric: their absence
 * of a producer score IS the signal that flips the whole set onto the
 * comparable fallback basis.
 */
export function selectDriverPolicyFeed(
  report: ResultsReport | null | undefined,
): DriverPolicyFeed {
  if (!report || typeof report !== 'object') return EMPTY_DRIVER_POLICY_FEED
  const cached = driverPolicyFeedCache.get(report)
  if (cached) return cached

  // Collect raw factors from multiple sources (moved from the drivers memo)
  const rawFactors: RawFactorSensitivity[] = []

  // Source 1: factor_sensitivity (PLoT v2), else the untyped enrichment
  // passthrough. Precedence (certified array FIRST, enrichment only when the
  // certified array is empty) is the canvas hook's existing rule and the same
  // one OptionNode/StyledEdge apply — preserved here verbatim so folding the
  // hook onto this feed changes no behaviour, and so the panel stops being
  // the only surface blind to the fallback.
  const certifiedFactors = (report.factor_sensitivity ?? []) as RawFactorSensitivity[]
  const enrichmentFactors = certifiedFactors.length === 0 ? readEnrichmentFactors(report) : null
  const usedEnrichmentFallback = enrichmentFactors !== null && enrichmentFactors.length > 0
  const factorSensitivity: RawFactorSensitivity[] = certifiedFactors.length > 0
    ? certifiedFactors
    : ((enrichmentFactors ?? []) as RawFactorSensitivity[])
  factorSensitivity.forEach((f) => rawFactors.push(f))

  // Precompute keys in a Set for O(1) duplicate detection
  const seenKeys = new Set<string>()
  rawFactors.forEach((f, index) => seenKeys.add(getFactorKey(f, index)))

  // Source 2: drivers array (legacy) — canonical de-dupe via getFactorKey
  const legacyDrivers = report.drivers || []
  legacyDrivers.forEach((d, idx: number) => {
    const candidate: RawFactorSensitivity = {
      node_id: d.nodeId,
      id: (d as { id?: string }).id,
      label: d.label,
      sensitivity: d.contribution,
      direction: d.polarity === 'down' ? 'negative' : 'positive',
    }
    const key = getFactorKey(candidate, rawFactors.length + idx)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      rawFactors.push(candidate)
    }
  })

  // Source 3: drivers_payload
  const driversPayload = report.drivers_payload?.drivers || []
  driversPayload.forEach((pd: RawFactorSensitivity, idx: number) => {
    const key = getFactorKey(pd, rawFactors.length + idx)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      rawFactors.push(pd)
    }
  })

  // Source 4: sensitivity.factors (alternative path)
  const sensitivityFactors = report.sensitivity?.factors || []
  sensitivityFactors.forEach((sf, idx: number) => {
    const key = getFactorKey(sf as RawFactorSensitivity, rawFactors.length + idx)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      rawFactors.push(sf as RawFactorSensitivity)
    }
  })

  // Source 5: factors array (direct)
  const directFactors = report.factors || []
  directFactors.forEach((df, idx: number) => {
    const key = getFactorKey(df as RawFactorSensitivity, rawFactors.length + idx)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      rawFactors.push(df as RawFactorSensitivity)
    }
  })

  const policyRows: DriverPolicyRow[] = rawFactors.map((f, index) => {
    const norm = normalizeFactorSensitivity(f, EMPTY_NODE_LABEL_MAP)
    return {
      key: getFactorKey(norm, index),
      influenceScore: norm.influenceScore,
      // Math.abs is load-bearing, not defensive: this field is a MAGNITUDE
      // (see DriverPolicyRow), and the sole consumer ranks on it via
      // compareByDisplayModel, whose tie-break sorts the number as given. A
      // signed value here silently re-opens the very fork this feed closes —
      // two surfaces agreeing on the basis AND the displayed value, then
      // ordering equal-magnitude drivers differently by sign. The panel abs's
      // its own copy before ranking, and extractPolicyRow (the sibling
      // producer feeding the same comparator) abs's too; this keeps all
      // feeders on one semantics. Direction is NOT lost — surfaces that
      // disclose it read the signed wire row from `rawFactors`.
      rawElasticity: Math.abs(getRawElasticity(norm)),
      confidence: norm.confidence,
      // Derived from the SAME normalised row the confidence itself came from,
      // by the SAME function the panel uses — not a second reading of the wire.
      confidenceIsDefaulted: isDefaultedConfidenceFromRaw({
        confidenceSource: norm.confidenceSource,
        samplingStability: norm.samplingStability,
      }),
      confidenceProvenance: norm.confidenceProvenance,
      valueOfInformation: norm.valueOfInformation,
    }
  })

  const displayModel = selectDriverDisplayModel(policyRows)
  const feed: DriverPolicyFeed = { rawFactors, usedEnrichmentFallback, policyRows, displayModel }
  driverPolicyFeedCache.set(report, feed)
  return feed
}

// =============================================================================
// Dynamic Normalisation (CRITICAL: Fix for arbitrary div-by-2)
// =============================================================================

/**
 * Compute dynamically normalised influence for all factors.
 * Returns map of factorKey -> normalisedInfluence (0-1)
 *
 * When real elasticity data exists: top factor = 100%, others proportional.
 * When NO real elasticity data (all ~0): returns all 0 - UI uses hasMagnitudeData
 * flag to show direction-only view instead.
 */

// =============================================================================
// Factor Rank Computation (CRITICAL: Single-Pass with Map)
// =============================================================================


/**
 * Compute ranks for all factors based on absolute elasticity.
 * Returns map of factorKey -> rank (1-indexed)
 */
function computeFactorRanks(
  factors: Array<{ key: string; rawElasticity: number; displayValue?: number; importanceRank?: number; label?: string }>
): Map<string, number> {
  // Codex B2: sort by the DISPLAYED influence metric (producer
  // influence_score, else the elasticity-derived fallback the bar shows) so
  // the row order and the rank-1 "Top driver" crown always agree with the
  // visible Influence bar. Elasticity remains the first tie-break.
  const sorted = [...factors].sort((a, b) => {
    const aDisp = a.displayValue ?? Math.abs(a.rawElasticity)
    const bDisp = b.displayValue ?? Math.abs(b.rawElasticity)
    if (bDisp !== aDisp) return bDisp - aDisp

    const aVal = Math.abs(a.rawElasticity)
    const bVal = Math.abs(b.rawElasticity)

    // Tie-break 1: higher elasticity first
    if (bVal !== aVal) return bVal - aVal

    // Tie-break 2: importance_rank (lower = more important)
    const aRank = a.importanceRank ?? Infinity
    const bRank = b.importanceRank ?? Infinity
    if (aRank !== bRank) return aRank - bRank

    // Tie-break 3: label alphabetical
    return (a.label ?? '').localeCompare(b.label ?? '')
  })

  // Build rank map in single pass
  const rankMap = new Map<string, number>()
  sorted.forEach((factor, index) => {
    rankMap.set(factor.key, index + 1) // 1-indexed
  })

  return rankMap
}

// =============================================================================
// Outcome Normalisation (CRITICAL: No magnitude-based scaling)
// =============================================================================

function normalizeOutcomeValues(
  rawP10: number | null | undefined,
  rawExpected: number | null | undefined,
  rawP50: number | null | undefined,
  rawP90: number | null | undefined
): { p10: number | null; expected: number | null; p50: number | null; p90: number | null } {
  let p10 = rawP10 ?? null
  let expected = rawExpected ?? null
  let p50 = rawP50 ?? null
  let p90 = rawP90 ?? null

  const numericValues = [p10, expected, p50, p90].filter(
    (value): value is number => typeof value === 'number' && isFinite(value)
  )
  if (numericValues.length === 0) {
    return { p10: null, expected: null, p50: null, p90: null }
  }

  // Sanity check: ensure proper ordering for percentiles (p10 <= p50 <= p90)
  if (p10 !== null && p50 !== null && p90 !== null && (p10 > p50 || p50 > p90 || p10 > p90)) {
    if (import.meta.env.DEV) {
      console.warn('[Results] Percentile ordering violated - reordering:', { p10, p50, p90 })
    }
    const sorted = [p10, p50, p90].sort((a, b) => a - b)
    p10 = sorted[0]
    p50 = sorted[1]
    p90 = sorted[2]
  }

  return { p10, expected, p50, p90 }
}

// =============================================================================
// Direction Normalisation (CRITICAL)
// =============================================================================

/**
 * Normalise direction variants to canonical enum.
 */
function normaliseDirection(direction: string | undefined): DriverDirection | undefined {
  if (!direction) return undefined

  const normalised = String(direction).toLowerCase().trim()

  // Positive variants
  if (['positive', 'increases', '+', 'increase', 'up'].includes(normalised)) {
    return 'positive'
  }

  // Negative variants
  if (['negative', 'decreases', '-', 'decrease', 'down'].includes(normalised)) {
    return 'negative'
  }

  return undefined
}

/**
 * Get edge source key (handles 'source' or 'from' aliases)
 */
function getEdgeSourceKey(edge: EdgeForDirection): string | undefined {
  return edge.source ?? edge.from ?? undefined
}

/**
 * Get edge target key (handles 'target' or 'to' aliases)
 */
function getEdgeTargetKey(edge: EdgeForDirection): string | undefined {
  return edge.target ?? edge.to ?? undefined
}

/**
 * Derive factor direction from API response, with canvas edges as fallback.
 *
 * Priority (P0 Fix):
 *   1. API factor_sensitivity.direction — authoritative from analysis engine
 *   2. Canvas edge to goal — fallback when API direction unavailable
 *   3. Canvas edge to any outcome — secondary fallback
 *
 * This ensures the API's computed direction (which accounts for actual model
 * sensitivity analysis) takes precedence over static canvas edge metadata.
 */
function getFactorDirection(
  factorKey: string,
  edges: EdgeForDirection[],
  goalNodeId: string | undefined,
  outcomeNodeIds: string[],
  factorDirection?: string
): DriverDirection | undefined {
  // 1. API factor_sensitivity.direction (PRIMARY SOURCE)
  // The analysis engine computes direction based on sensitivity analysis,
  // which is more accurate than static canvas edge metadata.
  if (factorDirection) {
    return normaliseDirection(factorDirection)
  }

  // 2. Canvas edge to goal (FALLBACK when API direction unavailable)
  if (goalNodeId) {
    const goalEdge = edges.find(
      e => getEdgeSourceKey(e) === factorKey && getEdgeTargetKey(e) === goalNodeId
    )
    if (goalEdge) {
      return normaliseDirection(goalEdge.effect_direction ?? goalEdge.direction)
    }
  }

  // 3. Canvas edge to any outcome (deterministic: sort by target ID, take first)
  const outcomeEdges = edges
    .filter(e => getEdgeSourceKey(e) === factorKey && outcomeNodeIds.includes(getEdgeTargetKey(e) ?? ''))
    .sort((a, b) => (getEdgeTargetKey(a) ?? '').localeCompare(getEdgeTargetKey(b) ?? ''))

  if (outcomeEdges.length > 0) {
    return normaliseDirection(outcomeEdges[0].effect_direction ?? outcomeEdges[0].direction)
  }

  // 4. No direction available
  return undefined
}

// =============================================================================
// Semantic Label Assignment (CRITICAL: Rank-based for top, threshold for rest)
// =============================================================================

/**
 * Get semantic label for a driver.
 * Rank 1 always gets "biggest" (ensures uniqueness).
 * Ranks 2+ use threshold-based labels.
 */
function getSemanticLabel(rank: number, normalisedValue: number): DriverSemanticLabel {
  // Rank 1 always gets "Biggest factor"
  if (rank === 1) return 'biggest'

  // UI-SEM-039: Driver semantic label thresholds (0.50 strong, 0.20 moderate).
  // Remove when PLoT provides semantic labels per driver.
  if (normalisedValue >= 0.50) return 'strong'
  if (normalisedValue >= 0.20) return 'moderate'
  return 'minor'
}

// =============================================================================
// Confidence Tier Derivation (CRITICAL: Full Fallback Chain)
// =============================================================================

/**
 * UI-SEM-019: Readiness/confidence level taxonomy mapping. PLoT uses varied labels
 * (ready/caution/not_ready, high/medium/low); this normalises to strong/fair/needs_work.
 * Estimated — PLoT does not provide a canonical tier enum.
 */
function mapReadinessLevel(level: string): ConfidenceTier {
  const mapping: Record<string, ConfidenceTier> = {
    ready: 'strong',
    fair: 'fair',
    needs_work: 'needs_work',
    caution: 'fair',
    not_ready: 'needs_work',
  }
  return mapping[level.toLowerCase()] ?? 'unknown'
}

function mapConfidenceLevel(level: string): ConfidenceTier {
  const normalised = String(level).toLowerCase().trim()
  const mapping: Record<string, ConfidenceTier> = {
    strong: 'strong',
    high: 'strong',
    fair: 'fair',
    medium: 'fair',
    needs_work: 'needs_work',
    low: 'needs_work',
  }
  return mapping[normalised] ?? 'unknown'
}

/**
 * Legacy confidence tier derivation via fallback cascade.
 * UI-SEM-015: Score-based thresholds (>=70 strong, >=40 fair, else needs_work).
 * @deprecated Remove after 2026-05-12 — PLoT B1 now provides confidence_tier on the response.
 */
function deriveConfidenceTierLegacy(
  graphReadiness: { readiness_level?: string; readiness_score?: number } | undefined,
  report: { confidence?: { level?: string }; graph_quality?: { score?: number } } | undefined
): ConfidenceTier {
  // 1. Primary: Graph readiness readiness_level
  if (graphReadiness?.readiness_level) {
    return mapReadinessLevel(graphReadiness.readiness_level)
  }

  // 2. Fallback: Graph readiness readiness_score (0-100)
  if (typeof graphReadiness?.readiness_score === 'number') {
    if (graphReadiness.readiness_score >= 70) return 'strong'
    if (graphReadiness.readiness_score >= 40) return 'fair'
    return 'needs_work'
  }

  // 3. Fallback: report.confidence.level
  if (report?.confidence?.level) {
    return mapConfidenceLevel(report.confidence.level)
  }

  // 4. Last resort: report.graph_quality.score (0-100)
  if (typeof report?.graph_quality?.score === 'number') {
    if (report.graph_quality.score >= 70) return 'strong'
    if (report.graph_quality.score >= 40) return 'fair'
    return 'needs_work'
  }

  return 'unknown'
}

/**
 * Get confidence tier — reads PLoT-classified tier first, falls back to legacy cascade.
 * Presentation-tier classification from PLoT V2, derived from coaching readiness.
 * Not the same as robustness.level or ISL inference confidence.
 */
function getConfidenceTier(
  plotTier: 'strong' | 'fair' | 'needs_work' | undefined,
  graphReadiness: { readiness_level?: string; readiness_score?: number } | undefined,
  report: { confidence?: { level?: string }; graph_quality?: { score?: number } } | undefined
): ConfidenceTier {
  // 0. Highest priority: PLoT-classified confidence_tier (B1+)
  if (plotTier === 'strong' || plotTier === 'fair' || plotTier === 'needs_work') {
    return plotTier
  }
  // DEPRECATION FALLBACK: Remove after 2026-05-12
  // Pre-B1 cached results lack confidence_tier; use legacy cascade.
  return deriveConfidenceTierLegacy(graphReadiness, report)
}

// =============================================================================
// B2 Deprecation Fallbacks — Remove after 2026-05-12
// =============================================================================

/**
 * Classify fragile edge severity from switch_probability thresholds.
 * UI-SEM-012: >0.7 critical, >0.5 error, else warning.
 * @deprecated Remove after 2026-05-12 — PLoT B1 now provides severity on fragile_edges items.
 */
function classifySeverityLegacy(
  flipProbability: number | undefined | null
): 'critical' | 'error' | 'warning' {
  if (typeof flipProbability === 'number') {
    if (flipProbability > 0.7) return 'critical'
    if (flipProbability > 0.5) return 'error'
  }
  return 'warning'
}

/**
 * Detect dominant factor via local heuristic: top driver influence > 0.5
 * AND ratio vs second driver > 2:1.
 * UI-SEM-040.
 * @deprecated Remove after 2026-05-12 — PLoT B1 now provides dominant_factor on the response.
 */
function detectDominantFactorLegacy(
  nonZeroImpactDrivers: Array<{ factorKey: string; factorLabel: string; displayInfluence?: number; influenceScore?: number; normalisedInfluence?: number }>
): { dominantFactorId: string; dominantFactorLabel: string } | undefined {
  if (nonZeroImpactDrivers.length < 2) return undefined
  const top1 = nonZeroImpactDrivers[0]
  const top2 = nonZeroImpactDrivers[1]
  const top1Influence = top1.displayInfluence ?? top1.influenceScore ?? top1.normalisedInfluence
  const top2Influence = top2.displayInfluence ?? top2.influenceScore ?? top2.normalisedInfluence
  if (typeof top1Influence !== 'number' || typeof top2Influence !== 'number') return undefined
  const isDominant = top1Influence > 0.5 && (top2Influence > 0 ? top1Influence / top2Influence > 2 : true)
  if (isDominant) {
    return {
      dominantFactorId: top1.factorKey,
      dominantFactorLabel: top1.factorLabel,
    }
  }
  return undefined
}

// =============================================================================
// Improvements Normalisation (CRITICAL: Merge and Dedupe)
// =============================================================================

interface RawBiasFinding {
  explanation?: string
  micro_intervention?: { steps?: string[] }
  estimated_minutes?: number
}

interface RawQualityFactor {
  factor?: string
  recommendation?: string
  potential_improvement?: string
}

interface RawImprovementGuidance {
  action?: string
  reason?: string
  priority?: number
}

/**
 * Normalise improvements from three sources with priority ordering.
 */
function normaliseImprovements(
  biasFindings: RawBiasFinding[] | undefined,
  qualityFactors: RawQualityFactor[] | undefined,
  improvementGuidance: RawImprovementGuidance[] | undefined
): ImprovementItem[] {
  const improvements: ImprovementItem[] = []

  // 1. Bias findings (highest priority)
  biasFindings?.forEach(b => {
    const action = b.micro_intervention?.steps?.[0] ?? b.explanation
    if (action) {
      improvements.push({
        action,
        reason: b.explanation ?? '',
        priority: 1,
        source: 'bias',
        effortMinutes: b.estimated_minutes,
      })
    }
  })

  // 2. Quality factors (medium priority)
  qualityFactors?.forEach(q => {
    if (q.recommendation) {
      improvements.push({
        action: q.recommendation,
        reason: q.factor ?? '',
        priority: 2,
        source: 'quality_factor',
        potentialImprovement: q.potential_improvement,
      })
    }
  })

  // 3. Improvement guidance (lower priority, unless explicit priority given)
  improvementGuidance?.forEach(g => {
    if (g.action) {
      improvements.push({
        action: g.action,
        reason: g.reason ?? '',
        priority: g.priority ?? 3,
        source: 'improvement_guidance',
      })
    }
  })

  // Dedupe by action (case-insensitive), keep highest priority
  const seen = new Map<string, ImprovementItem>()
  improvements.forEach(imp => {
    const key = imp.action?.toLowerCase()?.trim()
    if (!key) return
    if (!seen.has(key) || (seen.get(key)?.priority ?? Infinity) > imp.priority) {
      seen.set(key, imp)
    }
  })

  // Sort by priority ascending (lower = more important)
  return Array.from(seen.values()).sort((a, b) => a.priority - b.priority)
}

// =============================================================================
// Main Hook
// =============================================================================

export interface ResultsSectionDataReturn {
  recommendation: DecisionResultData
  drivers: DriversSectionData
  confidence: ConfidenceSectionData
  improvements: ImprovementsSectionData
  isLoading: boolean
  isError: boolean
  goalLabel: string
  goalNodeId?: string
  /**
   * P0 V5 golden-path repair (Wave 4 wiring): result-completeness
   * verdict computed from SOURCE fields (PLoT/CEE) BEFORE the
   * UI-SEM fabrications mask them. Surfaced so HeroQualifier and
   * fallback panels can render curated qualifier copy when source
   * data is incomplete, instead of fabricated values being presented
   * as truth.
   */
  completeness: import('./useResultCompleteness').ResultCompleteness
  /**
   * Audit B3 (P0): analysis-level auto-noise provenance from PLoT.
   * `null` when the response predates this disclosure (old PLoT build,
   * cached staging response) or when normalisation rejected a malformed
   * payload. UI gates the visible marker on
   * `autoNoiseProvenance?.applied && autoNoiseProvenance?.isProvisional`.
   */
  autoNoiseProvenance: import('./types').AutoNoiseProvenance | null
  /**
   * Lane UI-W5 (reference-option disclosure): the option the edge/factor
   * sensitivities and fragile edges were computed against, resolved to a
   * canvas label where possible. `null` when the producer did not
   * disclose it (older PLoT/ISL builds); `optionLabel` null when the id
   * no longer resolves on this canvas (caption suppressed, fail-closed).
   */
  sensitivityReference: { optionId: string; optionLabel: string | null } | null
}

export function useResultsSectionData(): ResultsSectionDataReturn {
  const {
    results,
    runMeta,
    nodes,
    edges,
    hasCompletedFirstRun,
    currentScenarioFraming,
    m1Coaching,
    reviewStatus,
    m1ReviewAssumptions,
    goalThreshold,
    ceeAnalysisReady,
    rawV2FlipThresholds,
    rawAutoNoiseProvenance,
    rawFlipThresholdsStatus,
    rawFlipThresholdsStatusReason,
    rawMetaNSamples,
    rawHeadlineBanded,
    rawSensitivityReferenceOptionId,
    rawRobustnessDisplayVerdict,
    rawRobustnessDisplayVerdictReason,
  } = useCanvasStore(
    useShallow((s) => ({
      results: s.results,
      runMeta: s.runMeta,
      nodes: s.nodes,
      edges: s.edges,
      hasCompletedFirstRun: s.hasCompletedFirstRun,
      currentScenarioFraming: s.currentScenarioFraming,
      m1Coaching: s.runMeta?.m1Coaching ?? null,
      reviewStatus: s.runMeta?.reviewStatus,
      m1ReviewAssumptions: s.runMeta?.m1ReviewAssumptions ?? null,
      goalThreshold: s.goalThreshold,
      ceeAnalysisReady: s.ceeAnalysisReady,
      // Extract only flip_thresholds from raw V2 response to avoid subscribing to entire object.
      // Used as fallback in flip_thresholds defensive adaptor when mapped report doesn't carry them.
      // Display-honesty: PLoT v2/run emits flip_thresholds at the top level
      // (see plot-lite-service routes/v2/run.ts:2010); legacy responses
      // nested it under robustness. Prefer top-level so fresh-run and
      // hydrated-via-mapper precedence agree (the mapper also prefers
      // top-level — see responseMapper.ts display-honesty block).
      rawV2FlipThresholds:
        (s.rawV2Response as { flip_thresholds?: unknown } | null | undefined)?.flip_thresholds
        ?? s.rawV2Response?.robustness?.flip_thresholds
        ?? null,
      // Audit B3: extract only auto_noise_provenance to avoid subscribing
      // to the whole rawV2Response. Typed via V2RunResponse since PLoT
      // commit 562e461; normalised at the trust boundary below.
      rawAutoNoiseProvenance: s.rawV2Response?.auto_noise_provenance ?? null,
      // Display-honesty: PLoT-side classification of flip_thresholds[]
      // (companion to PR claude-plot/display-honesty). Optional — older
      // PLoT builds omit the field, in which case we leave UX unchanged.
      rawFlipThresholdsStatus: (s.rawV2Response as { flip_thresholds_status?: string } | null | undefined)?.flip_thresholds_status ?? null,
      // Display-honesty: PLoT-supplied reason string from the same field.
      // Drives copy variation on 'partial_no_effect' when unresolved
      // entries are present (mixed computed + no_effect + unresolved),
      // so UI can avoid wording that implies all non-computed factors
      // were harmless no-effect cases.
      rawFlipThresholdsStatusReason: (s.rawV2Response as { flip_thresholds_status_reason?: string } | null | undefined)?.flip_thresholds_status_reason ?? null,
      // Display-honesty: root meta.n_samples used as fallback resolution
      // source when an option lacks per-option n_valid_samples.
      rawMetaNSamples: s.rawV2Response?.meta?.n_samples ?? null,
      // Lane UI-W4 (producer consumption, PLoT #200): producer leader-
      // confidence band. Extracted narrowly (never subscribe to the whole
      // raw response); the mapped report is preferred below, this raw slot
      // is the fresh-run fallback — same pattern as rawV2FlipThresholds.
      rawHeadlineBanded:
        s.rawV2Response?.decision_brief?.headline_banded ?? null,
      // Lane UI-W5 (reference-option disclosure): option ID the
      // sensitivities / fragile edges were computed against. Extracted
      // narrowly; mapped report preferred below, this raw slot is the
      // fresh-run fallback — same pattern as rawHeadlineBanded.
      rawSensitivityReferenceOptionId:
        s.rawV2Response?.sensitivity_reference_option_id ?? null,
      // Display-honesty (lane 35 fix 3, ROADMAP 1.6; producer PLoT #202):
      // display-safe robustness verdict + producer-owned reason. Extracted
      // narrowly (never subscribe to the whole raw response); this raw slot
      // is the fresh-run source, the mapped report is the saved/hydrated
      // fallback below — same pattern as rawFlipThresholdsStatus. The
      // fields are additive and untyped in the vendored @talchain/schemas
      // 0.13.1 pin (0.14.0 types the envelope; the pin bump is a separate
      // rollout step), so they are declared on the repo's own
      // V2RobustnessActual wire type and normalised FAIL-CLOSED below.
      rawRobustnessDisplayVerdict:
        s.rawV2Response?.robustness?.display_verdict ?? null,
      rawRobustnessDisplayVerdictReason:
        s.rawV2Response?.robustness?.display_verdict_reason ?? null,
    }))
  )

  const autoNoiseProvenance = useMemo(
    () => normalizeAutoNoiseProvenance(rawAutoNoiseProvenance),
    [rawAutoNoiseProvenance],
  )

  // Cast report once at trust boundary — responseMapper returns ReportV1 with V2 pass-through fields
  const report = results?.report as ResultsReport | null | undefined
  const resultsStatus = results?.status

  const isLoading = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'
  const isError = resultsStatus === 'error'

  // Find goal node for label and click-to-focus
  const goalNode = useMemo(
    () => nodes.find((n) => n.type === 'goal' || (n.data as ResultsCanvasNodeData)?.kind === 'goal'),
    [nodes]
  )

  // Goal label fallback chain: framing > node label > default
  // V14.1: Sanitize + guard against short/ambiguous labels that read awkwardly as "To a Cat"
  const goalLabel = useMemo(() => {
    let raw = 'your goal'
    if (currentScenarioFraming?.goal) {
      raw = currentScenarioFraming.goal
    } else if (goalNode?.data && typeof (goalNode.data as ResultsCanvasNodeData).label === 'string') {
      raw = (goalNode.data as ResultsCanvasNodeData).label
    }
    if (raw === 'your goal') return raw

    // Sanitize encoding notation and arrows
    const cleaned = sanitizeCoachingText(raw)
    if (!cleaned || cleaned === 'your goal') return 'your goal'

    // Guard: single-word labels or labels that collide with option/factor names
    // read awkwardly as "To Cat" — prefix with context → "the best outcome for Cat"
    // Multi-word verb phrases ("increase revenue") read fine as-is.
    const optionLabels = new Set(
      nodes.filter(n => (n.data as ResultsCanvasNodeData)?.kind === 'option').map(n => (n.data as ResultsCanvasNodeData)?.label as string).filter(Boolean)
    )
    const factorLabels = new Set(
      nodes.filter(n => (n.data as ResultsCanvasNodeData)?.kind === 'factor').map(n => (n.data as ResultsCanvasNodeData)?.label as string).filter(Boolean)
    )
    const wordCount = cleaned.split(/\s+/).length
    if (wordCount < 2 || optionLabels.has(cleaned) || factorLabels.has(cleaned)) {
      return `the best outcome for ${cleaned}`
    }

    return cleaned
  }, [currentScenarioFraming, goalNode, nodes])

  const goalNodeId = goalNode?.id

  // Extract outcome unit from goal node for proper formatting (Issue 5 fix)
  // The goal node's observed_state.unit tells us whether values are currency, percent, or count
  // V11.2 Fix 3: goal_threshold_unit fallback + pass raw unit string for count types
  const { outcomeUnit, outcomeUnitSymbol } = useMemo(() => {
    const observedState = (goalNode?.data as ResultsCanvasNodeData | undefined)?.observedState ?? (goalNode?.data as ResultsCanvasNodeData | undefined)?.observed_state
    const rawUnit = observedState?.unit
      ?? (goalNode?.data as ResultsCanvasNodeData | undefined)?.goal_threshold_unit
      ?? ceeAnalysisReady?.goal_threshold_unit

    if (!rawUnit) return { outcomeUnit: undefined, outcomeUnitSymbol: undefined }

    const unitLower = String(rawUnit).toLowerCase()

    // Percentage variants
    if (unitLower === '%' || unitLower === 'percent' || unitLower === 'percentage') {
      return { outcomeUnit: 'percent' as const, outcomeUnitSymbol: undefined }
    }

    // Currency variants - detect symbol and normalize
    if (['$', '£', '€', 'usd', 'gbp', 'eur', 'dollar', 'pound', 'euro'].some(c => unitLower.includes(c))) {
      const symbol = String(rawUnit).match(/[$£€]/)?.[0] ?? '$'
      return { outcomeUnit: 'currency' as const, outcomeUnitSymbol: symbol }
    }

    // Default to count for numeric units (users, items, etc.)
    // V11.2 Fix 3: Pass raw unit string as symbol for unit-aware tornado axis labels
    return { outcomeUnit: 'count' as const, outcomeUnitSymbol: String(rawUnit) }
  }, [goalNode, ceeAnalysisReady?.goal_threshold_unit])

  // P0-1: Extract denormalisation scale from goal node OR ceeAnalysisReady
  // PLoT returns normalised effect sizes (0–1). goal_threshold_cap is the scale maximum in user units.
  // Priority: ceeAnalysisReady (most reliable) > goal node data > null
  const goalThresholdCap = useMemo(() => {
    // 1. CEE analysis_ready is the canonical source
    if (typeof ceeAnalysisReady?.goal_threshold_cap === 'number') return ceeAnalysisReady.goal_threshold_cap
    // 2. Goal node data (spread from CEE node via DraftChat)
    const data = goalNode?.data as ResultsCanvasNodeData | undefined
    if (typeof data?.goal_threshold_cap === 'number') return data.goal_threshold_cap
    if (typeof data?.threshold_cap === 'number') return data.threshold_cap
    if (typeof data?.scale_max === 'number') return data.scale_max
    return null
  }, [goalNode, ceeAnalysisReady])

  // P1-2: Effective goal threshold — canvas store > ceeAnalysisReady > goal node fallback
  const effectiveGoalThreshold = useMemo(() => {
    if (goalThreshold != null) return goalThreshold
    // CEE analysis_ready has goal_threshold_raw in user units
    if (typeof ceeAnalysisReady?.goal_threshold_raw === 'number') return ceeAnalysisReady.goal_threshold_raw
    const data = goalNode?.data as ResultsCanvasNodeData | undefined
    // data.goal_threshold is the node's NORMALISED 0-1 value (GoalSection
    // reads it as thresholdNorm) while this memo's contract is user units:
    // convert ×cap when a cap exists — same rule as the store CEE sync — so
    // a normalised fallback can never masquerade as raw and paint the
    // target line at 0.8 on a 0-25 axis.
    const nodeGoalThreshold =
      typeof data?.goal_threshold === 'number'
        ? goalThresholdCap != null && goalThresholdCap > 0
          ? data.goal_threshold * goalThresholdCap
          : data.goal_threshold
        : null
    return data?.goal_threshold_raw
      ?? nodeGoalThreshold
      ?? data?.observedState?.value
      ?? data?.observed_state?.value
      ?? data?.success_threshold
      ?? data?.threshold
      ?? null
  }, [goalThreshold, goalNode, ceeAnalysisReady, goalThresholdCap])

  const nodeLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    nodes.forEach((node) => {
      const label = (node.data as ResultsCanvasNodeData)?.label
      if (typeof label === 'string' && label.trim().length > 0) {
        map.set(node.id, label)
      }
    })
    return map
  }, [nodes])

  // Lane UI-W5 (reference-option disclosure): resolve the disclosed
  // reference-option ID to its canvas label for the shared
  // SensitivityReferenceCaption. Mapped report preferred (survives
  // save + hydrate), raw response is the fresh-run fallback — same
  // precedence as flip_thresholds / headline_banded. Fail-closed:
  // absent field → null (no caption); id that no longer resolves to a
  // canvas label → optionLabel null (caption suppressed rather than
  // leaking an internal id as user copy). provisional_doctrine_v0.
  const sensitivityReference = useMemo<
    { optionId: string; optionLabel: string | null } | null
  >(() => {
    const fromReport = report?.sensitivity_reference_option_id
    const raw =
      typeof fromReport === 'string' && fromReport.length > 0
        ? fromReport
        : typeof rawSensitivityReferenceOptionId === 'string' &&
            rawSensitivityReferenceOptionId.length > 0
          ? rawSensitivityReferenceOptionId
          : null
    if (!raw) return null
    return { optionId: raw, optionLabel: nodeLabelMap.get(raw) ?? null }
  }, [report, rawSensitivityReferenceOptionId, nodeLabelMap])

  // Get outcome node IDs for direction derivation
  const outcomeNodeIds = useMemo(
    () => nodes
      .filter(n => n.type === 'outcome' || (n.data as ResultsCanvasNodeData)?.kind === 'outcome')
      .map(n => n.id),
    [nodes]
  )

  // ==========================================================================
  // Recommendation Section Data
  // ==========================================================================
  const recommendation = useMemo<DecisionResultData>(() => {
    if (!hasCompletedFirstRun || !report) {
      return {
        recommendedOption: null,
        allOptions: [],
        goalLabel,
        goalNodeId,
        isSingleOption: true,
        analysisStatus: 'computed',
      }
    }

    // Get option probabilities from report
    const optionProbs = report.option_probabilities || {}
    const optionNodes = nodes.filter((n) => (n.data as ResultsCanvasNodeData)?.kind === 'option')

    // Determine recommended option ID - prefer backend-provided, fall back to deterministic tie-breaker
    // Task 2.4: Primary is robustness.recommended_option_id
    const backendRecommendedId =
      report?.robustness?.recommended_option_id ??
      report?.recommendation?.option_id ??
      report?.recommendation?.selected_option ??
      report?.selected_option_id ??
      null

    // Build option results with percentile extraction
    const sharedBands = report.run?.bands

    // v7: Pre-scan all options to detect already-denormalized values.
    // If any option has raw outcome magnitudes > 2, the data is already in user units
    // even when goalThresholdCap is missing — so we should NOT label as "Relative score".
    const capValid = goalThresholdCap != null && goalThresholdCap > 0
    let anyAlreadyDenormalized = false
    for (const node of optionNodes) {
      const prob = optionProbs[node.id] || {}
      const ob = prob.outcome ?? {}
      const ob2 = prob.bands ?? sharedBands ?? {}
      const vals = [
        prob.expected_outcome ?? prob.expected ?? ob.mean ?? ob2.p50,
        ob.p10 ?? ob2.p10,
        ob.p90 ?? ob2.p90,
      ]
      const maxAbs = Math.max(...vals.map((v) => (typeof v === 'number' && isFinite(v) ? Math.abs(v) : 0)))
      if (maxAbs > 2) { anyAlreadyDenormalized = true; break }
    }
    const isNormalisedResult = !capValid && !anyAlreadyDenormalized
    const unsortedOptions: OptionResult[] = optionNodes.map((node) => {
      const nodeId = node.id
      const prob = optionProbs[nodeId] || {}

      // Per-option bands take precedence over shared bands
      const optionBands = prob.bands ?? sharedBands ?? {}
      // Per-option outcome object (new structure with explicit expected)
      const optionOutcome = prob.outcome ?? {}

      // Extract expected value (mean) with fallback chain
      // Priority: expected_outcome (V2 field) > expected > outcome.mean > bands > goal_probability
      // P0 Fix: Add expected_outcome to catch unmapped V2 responses
      const rawExpected =
        prob.expected_outcome ?? prob.expected ?? optionOutcome.mean ?? optionBands.p50 ?? null

      // Extract percentiles (p10/p50/p90) — p50 is true median, NOT expected
      const rawP10 = optionOutcome.p10 ?? optionBands.p10 ?? null
      const rawP50 = optionOutcome.p50 ?? optionBands.p50 ?? rawExpected
      const rawP90 = optionOutcome.p90 ?? optionBands.p90 ?? null

      // Normalize all 4 values together with single scale decision
      // This prevents scale mismatches when expected and p50 have different magnitudes
      const norm = normalizeOutcomeValues(rawP10, rawExpected, rawP50, rawP90)

      // P0-1: Denormalise — convert effect sizes (0–1) to user units
      // Guards: skip scaling when cap is invalid or values already appear denormalized
      if (import.meta.env.DEV && nodeId === optionNodes[0]?.id) {
        console.warn('[Results] Denorm trace:', { goalThresholdCap, rawP10, rawP50, rawP90, normP10: norm.p10, normP90: norm.p90 })
      }
      const maxRaw = Math.max(
        Math.abs(norm.p90 ?? 0), Math.abs(norm.p10 ?? 0), Math.abs(norm.expected ?? 0)
      )
      const alreadyDenormalized = maxRaw > 2 // values > 2 are likely already in user units
      // v7: Track whether denormalisation was applied. When scale=1 and values are small,
      // they are normalised model scores — UI must label as "Relative score", not user units.
      const scale = capValid && !alreadyDenormalized ? goalThresholdCap : 1
      const scaledP10 = norm.p10 != null ? norm.p10 * scale : null
      const scaledExpected = norm.expected != null ? norm.expected * scale : null
      const scaledP50 = norm.p50 != null ? norm.p50 * scale : null
      const scaledP90 = norm.p90 != null ? norm.p90 * scale : null

      // T6 P0-3: Prefer probability_of_joint_goal (constrained) when constraints exist,
      // fall back to goal_probability (unconstrained).
      // Staging trust review: when ISL auto-derives the goal threshold as a
      // constraint (constraint_probabilities.auto_goal_threshold), the run
      // carries probability_of_joint_goal but NO goal_probability and NO
      // constraint_analysis — the joint value IS the goal probability there,
      // so it is the final fallback. Discarding it hid the run's most
      // decision-relevant fact (every option at 0% chance of the target).
      // ROADMAP 1.49: extracted to selectGoalProbability (utils/) so every
      // surface (this hook, OptionNode's badge) shares one fallback chain
      // instead of re-deriving it.
      const { goalProbability, goalProbabilityIsJoint } = selectGoalProbability(prob as GoalProbabilityInput)
      // Display-honesty (ROADMAP 1.6b, doctrine B / PLoT #204): the
      // provenance caveat renders ONLY when the number just shown is the
      // joint-goal figure AND the producer marked it as scored from a
      // modelled outcome distribution — never inferred, never applied to
      // the unconstrained probability_of_goal number.
      const goalFitBasisScoredFrom =
        typeof (prob as any).goal_fit_basis?.scored_from === 'string'
          ? ((prob as any).goal_fit_basis.scored_from as string)
          : null
      const goalFitIsModelledBasis =
        goalProbabilityIsJoint && goalFitBasisScoredFrom === 'modelled_outcome_distribution'

      // Display-honesty: per-option valid sample count for resolution-aware
      // probability formatting. Fallback chain prefers per-option signal,
      // then per-option total, then root meta. Source values only — display
      // formatting happens at render time.
      const rawNValid = (optionOutcome as { n_valid_samples?: number }).n_valid_samples
      const rawNTotal = (optionOutcome as { n_samples?: number }).n_samples
      const nValidSamples =
        typeof rawNValid === 'number' && Number.isFinite(rawNValid) && rawNValid > 0
          ? rawNValid
          : typeof rawNTotal === 'number' && Number.isFinite(rawNTotal) && rawNTotal > 0
            ? rawNTotal
            : typeof rawMetaNSamples === 'number' && Number.isFinite(rawMetaNSamples) && rawMetaNSamples > 0
              ? rawMetaNSamples
              : undefined

      return {
        id: nodeId,
        label: (node.data as ResultsCanvasNodeData)?.label || nodeId,
        // Explicit expected value (mean) — primary value for "Expected" display
        expected: scaledExpected,
        // Full outcome distribution (mean = expected, for consistency)
        outcome: {
          mean: scaledExpected,
          p10: scaledP10,
          p50: scaledP50,  // True median
          p90: scaledP90,
        },
        // Deprecated fields for backward compatibility
        p10: scaledP10,
        p50: scaledP50,
        p90: scaledP90,
        isRecommended: false, // Will be set immutably below
        winProbability: prob.win_probability,
        nValidSamples,
        goalProbability,
        goalFitIsModelledBasis,
        // Multi-constraint analysis (from ISL when goal_constraints were provided)
        constraintAnalysis: prob.constraint_analysis,
      }
    })

    // Task 1.1: Winner selection logic - SINGLE SOURCE OF TRUTH
    // Determine winner selection method BEFORE sorting or selecting winner
    // This ensures label matches the actual selection criteria
    const { recommendedId, determinedBy } = determineWinnerSelection(
      unsortedOptions,
      backendRecommendedId
    )

    // Order by the SHARED display sort (win probability when every option
    // carries one, else expected value — sortOptionsForDisplay), independent
    // of winner selection. This must be the same comparator the rendering
    // surfaces use (OptionCards, WinGauge, analysis hero): the staging trust
    // review found badge "4" rendering ABOVE badge "3" because ordinals were
    // seeded from an expected-value order while every list sorted by win
    // probability — one metric per surface, so allOptions order, ordinal
    // registration order and row order must be one.
    const sortedOptions = sortOptionsForDisplay(unsortedOptions)

    // Task 2.1: Resolve baseline option with precedence (PLoT > user > heuristic)
    // Note: userSelectedBaselineId would come from state if we add baseline selection UI
    const baselineId = resolveBaselineId(sortedOptions, optionNodes, undefined)
    const baselineOption = baselineId
      ? sortedOptions.find(o => o.id === baselineId)
      : null
    // Issue #2 fix: Fall back to goalProbability when expected is null
    const baselineOutcome = baselineOption?.expected ?? baselineOption?.goalProbability ?? null

    // Immutably mark recommended option and add baseline/delta info (no mutation of existing objects)
    const allOptions: OptionResult[] = sortedOptions.map(option => {
      const isBaseline = option.id === baselineId
      // Task 2.2: Calculate point delta (absolute, not percent)
      // Issue #2 fix: Use expected ?? goalProbability for delta calculation
      const optionOutcome = option.expected ?? option.goalProbability
      const deltaFromBaseline = !isBaseline && baselineOutcome != null && optionOutcome != null
        ? optionOutcome - baselineOutcome
        : null

      return {
        ...option,
        isRecommended: option.id === recommendedId,
        isBaseline,
        deltaFromBaseline,
      }
    })

    const recommendedOption = allOptions.find((o) => o.isRecommended) || null

    // Extract recommendation stability from robustness (0-1 score)
    const robustness = report?.robustness
    const recommendationStability = typeof robustness?.recommendation_stability === 'number'
      ? robustness.recommendation_stability
      : typeof robustness?.recommendationStability === 'number'
        ? robustness.recommendationStability
        : undefined

    // Task 1.3: Extract win_probability from recommended option
    const winProbability = recommendedOption?.winProbability

    // Task 1.5: Extract robustness level and label
    // P0 Fix: PLoT doesn't return level/label - derive from recommendation_stability
    const rawRobustnessLevel = robustness?.level as string | undefined
    const rawRobustnessLabel = robustness?.label as string | undefined

    // UI-SEM-005 (consolidated): Robustness level from canonical stability utility.
    // Prefers explicit PLoT level; falls back to deriveStabilityLevel() from src/lib/stability.ts.
    const hasExplicitLevel =
      rawRobustnessLevel === 'high' ||
      rawRobustnessLevel === 'moderate' ||
      rawRobustnessLevel === 'low' ||
      rawRobustnessLevel === 'very_low' ||
      rawRobustnessLevel === 'medium'
    const robustnessLevel: RobustnessLevel | undefined =
      rawRobustnessLevel === 'high' ||
      rawRobustnessLevel === 'moderate' ||
      rawRobustnessLevel === 'low' ||
      rawRobustnessLevel === 'very_low'
        ? rawRobustnessLevel
        : rawRobustnessLevel === 'medium'
          ? 'moderate'
          : deriveStabilityLevel(recommendationStability)
    // UI-SEM-005 fallback tracking: log when derivation activates so we can
    // measure how often PLoT omits the level field and prioritise removal.
    if (!hasExplicitLevel && robustnessLevel !== undefined && import.meta.env.DEV) {
      console.warn('[useResultsSectionData] UI-SEM-005 fallback: derived robustnessLevel=%s from stability=%s (PLoT omitted level)', robustnessLevel, recommendationStability)
    }

    // Derive label from level if not explicitly provided
    function deriveLabelFromLevel(level: RobustnessLevel | undefined): RobustnessLabel | undefined {
      if (!level) return undefined
      if (level === 'high') return 'robust'
      if (level === 'moderate') return 'moderate'
      return 'fragile' // low or very_low
    }

    // Normalize robustness label (fallback naming)
    const robustnessLabel: RobustnessLabel | undefined =
      rawRobustnessLabel === 'robust' || rawRobustnessLabel === 'moderate' ||
      rawRobustnessLabel === 'fragile'
        ? rawRobustnessLabel
        : deriveLabelFromLevel(robustnessLevel)

    // Extract near-tie detection from robustness
    // Keep as undefined when absent (not null) — consistent with existing patterns
    const rawNearTie = robustness?.near_tie ?? robustness?.nearTie
    const nearTie: NearTieInfo | undefined = rawNearTie ? {
      isTie: rawNearTie.is_tie ?? rawNearTie.isTie ?? false,
      topOptionId: rawNearTie.top_option_id ?? rawNearTie.topOptionId ?? '',
      secondOptionId: rawNearTie.second_option_id ?? rawNearTie.secondOptionId ?? null,
      tiedOptionIds: safeArray(rawNearTie.tied_option_ids ?? rawNearTie.tiedOptionIds),
      gap: rawNearTie.gap ?? 0,
      threshold: rawNearTie.threshold ?? 0.10,
    } : undefined

    // Task 1.7: Get goal text from framing
    const goalText = currentScenarioFraming?.goal || undefined

    // Display-safe robustness verdict consumption (lane 35 fix 3,
    // ROADMAP 1.6; producer PLoT #202). Raw response first (fresh run),
    // mapped report as the saved/hydrated fallback — same chain as
    // flipThresholdsStatus. FAIL-CLOSED: only the four producer enum
    // tokens populate the verdict; an absent field (older PLoT build) or
    // an unrecognised token leaves it undefined so every surface keeps
    // the honest "Robustness unknown" state. The reason is the
    // producer's own display phrase, carried VERBATIM (never authored
    // here) and never exposed without its verdict.
    const rawDisplayVerdict =
      rawRobustnessDisplayVerdict ?? robustness?.display_verdict
    const robustnessVerdict: RobustnessDisplayVerdict | undefined =
      rawDisplayVerdict === 'robust' ||
      rawDisplayVerdict === 'moderate' ||
      rawDisplayVerdict === 'fragile' ||
      rawDisplayVerdict === 'not_assessed'
        ? rawDisplayVerdict
        : undefined
    const rawDisplayVerdictReason =
      rawRobustnessDisplayVerdictReason ?? robustness?.display_verdict_reason
    const robustnessVerdictReason: string | undefined =
      robustnessVerdict != null &&
      typeof rawDisplayVerdictReason === 'string' &&
      rawDisplayVerdictReason.trim() !== ''
        ? rawDisplayVerdictReason
        : undefined

    // C2: Defensive adaptor for flip_thresholds — PLoT hasn't confirmed final location.
    // Check mapped report paths first, then fall back to rawV2FlipThresholds (extracted
    // from raw V2 response in the store selector). Simplify once PLoT confirms location.
    const flipThresholds: FlipThreshold[] = safeArray(
      report?.flip_thresholds
      ?? report?.report?.robustness?.flip_thresholds
      ?? report?.robustness?.flip_thresholds
      ?? rawV2FlipThresholds
    )
      .map((ft: any) => {
        const nf = normaliseFactorFields(ft)
        return {
          label: nf.label ?? nodeLabelMap.get(nf.node_id ?? '') ?? nf.node_id ?? 'Unknown',
          node_id: nf.node_id ?? '',
          current_value: typeof ft.current_value === 'number' ? ft.current_value : null, // Codex B3: preserve absence — never a fabricated 0 baseline
          flip_value: typeof ft.flip_value === 'number' ? ft.flip_value : null,
          flip_reason: ft.flip_reason,
          unit: ft.unit,
          alternative_winner_label: ft.alternative_winner_label ?? ft.alt_winner_label,
        }
      })
      .filter((ft: FlipThreshold) => ft.flip_reason !== 'timeout' && ft.flip_reason !== 'isl_error')

    return {
      recommendedOption,
      allOptions,
      goalLabel,
      goalNodeId,
      isSingleOption: allOptions.length <= 1,
      analysisStatus: 'computed',
      // Issue 5 fix: Pass through unit for proper outcome formatting
      outcomeUnit,
      outcomeUnitSymbol,
      goalThreshold: effectiveGoalThreshold,
      recommendationStability,
      // Task 1.3: Win probability for display
      winProbability,
      // Task 1.4: How winner was determined
      determinedBy,
      // Task 1.5: Robustness level and label. `robustnessLevel` is STRUCTURED
      // DATA (PLoT report.robustness.level, or the UI-SEM-005 fallback) — kept for
      // qualified/detailed display, NOT for the binary glyph.
      robustnessLevel,
      // Display-safe robustness verdict for the Robust/Sensitive glyph —
      // the producer's OWN display_verdict (PLoT #202), normalised
      // fail-closed above. PLoT `report.robustness.level` is deliberately
      // NOT a display-safe verdict (PLoT-level semantics are not
      // contractually safe to binarise), so it still must not drive the
      // glyph; when display_verdict is absent (older PLoT builds) this is
      // undefined and the glyph keeps "Robustness unknown".
      // (ROBUSTNESS-VERDICT-CONTRACT — consumer landed lane 35 fix 3.)
      robustnessVerdict,
      // The producer's own reason phrase, rendered verbatim downstream.
      robustnessVerdictReason,
      robustnessLabel,
      // Task 1.7: Goal text from framing
      goalText,
      // Task 2.1: Baseline tracking
      baselineId,
      baselineOutcome,
      // Near-tie detection: when top options are too close to call
      nearTie,
      // SINGLE VERDICT (2026-07-25): the ONE answer to "is there a leading
      // option?", derived from the SAME `report` object the canvas reads —
      // not re-derived from this hook's mapped fields, so canvas and panel
      // cannot drift apart. Every surface asserting or denying a leading
      // option quotes this. See src/lib/decisionVerdict.ts.
      verdict: deriveDecisionVerdict(report as DecisionVerdictReportLike | null | undefined, {
        visibleOptionIds: new Set(optionNodes.map((n) => n.id)),
        rawHeadlineBanded,
      }),
      // Task 6: Flip thresholds for tipping points visualisation
      flipThresholds: flipThresholds.length > 0 ? flipThresholds : undefined,
      // Display-honesty: PLoT-side classification of flip_thresholds[].
      // Optional — older PLoT builds omit it, in which case downstream UX
      // behaves exactly as before (silent absence). Fallback chain mirrors
      // the flip_thresholds defensive adaptor above: read raw first (fresh
      // runs), then the mapped report (saved / hydrated results) so the
      // new UX survives a hydrate cycle through responseMapper.
      flipThresholdsStatus: (rawFlipThresholdsStatus
        ?? (report as { flip_thresholds_status?: string } | null | undefined)?.flip_thresholds_status
        ?? undefined) as
        | 'computed'
        | 'all_no_effect'
        | 'partial_no_effect'
        | 'unresolved'
        | 'unavailable'
        | undefined,
      // Display-honesty: presence of the reason field (raw or mapped)
      // signals that unresolved entries are mixed in. Exposed as a
      // boolean so the UI never needs to inspect the raw string.
      flipThresholdsHasUnresolved: Boolean(
        rawFlipThresholdsStatusReason
          ?? (report as { flip_thresholds_status_reason?: string } | null | undefined)?.flip_thresholds_status_reason,
      ),
      // Lane UI-W4 (producer consumption, PLoT #200): producer leader-
      // confidence band from decision_brief.headline_banded. Normalised
      // fail-closed at this trust boundary (unknown band tokens / missing
      // leader id → null → the hero's UI-SEM-060 fallback banding applies).
      // Fallback chain mirrors flipThresholdsStatus above: mapped report
      // first (saved / hydrated results survive), raw response second
      // (fresh runs on older cached reports).
      headlineBanded: normalizeHeadlineBanded(
        (report as { decision_brief?: { headline_banded?: unknown } } | null | undefined)
          ?.decision_brief?.headline_banded
          ?? rawHeadlineBanded,
      ),
      /**
       * UI-SEM-050: Leading-option downside flag.
       *
       * Deterministic display gate: true when the recommended option's
       * lower-percentile outcome (p10) is below zero, signalling meaningful
       * downside risk that should qualify an otherwise-positive lead.
       * Display-only — does not affect ranking, scoring, or any forwarded
       * value. Undefined when p10 is unavailable.
       *
       * Classification: legitimate display formatting (additive qualifier).
       */
      leadingOptionDownsideFlag:
        recommendedOption?.outcome?.p10 != null && Number.isFinite(recommendedOption.outcome.p10)
          ? recommendedOption.outcome.p10 < 0
          : undefined,
      // v7: Whether outcome values are normalised model scores (no goalThresholdCap)
      isNormalised: isNormalisedResult,
      // M1 Coaching fields (Task 2) — sanitized at data layer
      coachingHeadline: m1Coaching?.executive_summary?.headline
        ? sanitizeCoachingText(m1Coaching.executive_summary.headline) : undefined,
      coachingParagraph: (() => {
        const raw = m1Coaching?.executive_summary?.paragraph
          ?? m1Coaching?.executive_summary?.summary
        return raw ? sanitizeCoachingText(raw) : undefined
      })(),
      coachingReadiness: m1Coaching?.readiness,
      coachingReadinessScore: m1Coaching?.readiness_signals?.score,
      coachingReadinessDimensions: (() => {
        // Defensive: try .dimensions first, then fall back to readiness_signals itself
        // (some backends nest dimensions, others put them at the top level)
        const dims = m1Coaching?.readiness_signals?.dimensions
        const raw = (dims ?? m1Coaching?.readiness_signals) as Record<string, number> | undefined
        if (!raw) return undefined
        // Normalise backend key variants to { evidence, robustness, clarity }
        const evidence = raw.evidence ?? raw.evidence_quality
        const robustness = raw.robustness ?? raw.model_robustness
        const clarity = raw.clarity ?? raw.framing_quality
        if (evidence == null || robustness == null || clarity == null) return undefined
        return { evidence, robustness, clarity } as { evidence: number; robustness: number; clarity: number }
      })(),
      storyHeadlines: (() => {
        const raw = m1Coaching?.story_headlines ?? {}
        const sanitized: Record<string, string> = {}
        for (const [k, v] of Object.entries(raw)) {
          sanitized[k] = typeof v === 'string' ? sanitizeCoachingText(v) : ''
        }
        return sanitized
      })(),
      // V12: Executive summary structured fields — sanitized at data layer
      coachingDecisionStatement: (() => {
        const raw = m1Coaching?.executive_summary?.decision_statement
          ?? m1Coaching?.executive_summary?.recommendation
        return raw ? sanitizeCoachingText(raw) : undefined
      })(),
      coachingKeyQualifier: m1Coaching?.executive_summary?.key_qualifier
        ? sanitizeCoachingText(m1Coaching.executive_summary.key_qualifier) : undefined,
      coachingActionImplication: (() => {
        const raw = m1Coaching?.executive_summary?.action_implication
          ?? m1Coaching?.executive_summary?.readiness_statement
        return raw ? sanitizeCoachingText(raw) : undefined
      })(),
      // V12 C1: M2 narrative summary — gated on review_status === 'complete', sanitized at data layer
      m2NarrativeSummary: (() => {
        const raw = reviewStatus === 'complete' ? m1ReviewAssumptions?.narrative_summary : undefined
        return raw ? sanitizeCoachingText(raw) : undefined
      })(),
      // B2: Dominant factor — prefer PLoT top-level field when both fields are non-empty strings
      ...(() => {
        const df = report?.dominant_factor
        if (typeof df?.factor_id === 'string' && df.factor_id && typeof df?.factor_label === 'string' && df.factor_label) {
          return { dominantFactorId: df.factor_id, dominantFactorLabel: df.factor_label }
        }
        // DEPRECATION FALLBACK: Remove after 2026-05-12 — m1Coaching path is effectively dead per B1 investigation.
        const dominantId = m1Coaching?.key_drivers?.dominant_factor
        if (!dominantId) return { dominantFactorId: undefined, dominantFactorLabel: undefined }
        const driver = m1Coaching?.key_drivers?.drivers?.find((d: any) => d.factor_id === dominantId)
        const label = driver?.factor_label ?? nodeLabelMap.get(dominantId) ?? dominantId
        return { dominantFactorId: dominantId, dominantFactorLabel: label }
      })(),
      // Task 6: Ready + warnings consistency
      // Check if there are warnings/uncertainties that need attention
      hasWarnings: (() => {
        // Check for warning/blocker critiques
        const critiques = report?.run?.critique || []
        const hasWarningCritiques = critiques.some((c: any) =>
          c.severity === 'WARNING' || c.severity === 'BLOCKER' ||
          c.severity === 'warning' || c.severity === 'blocker' ||
          // UI-SEM-069 bridge: advisories emitted as severity 'IMPROVEMENT'
          // with semantic_severity 'WARNING' are ingested into uncertainties
          // below (see the same check on the uncertainties list); hasWarnings
          // must agree or the panel shows "ready, no warnings" while the
          // uncertainties list simultaneously shows warnings.
          c.semantic_severity === 'WARNING'
        )
        // Check for fragile edges
        const fragileEdges = safeArray(report?.robustness?.fragile_edges)
        const hasFragileEdges = fragileEdges.length > 0
        return hasWarningCritiques || hasFragileEdges
      })(),
    }
  }, [hasCompletedFirstRun, report, nodes, goalLabel, goalNodeId, outcomeUnit, outcomeUnitSymbol, currentScenarioFraming, m1Coaching, nodeLabelMap, goalThreshold, goalThresholdCap, effectiveGoalThreshold, ceeAnalysisReady, m1ReviewAssumptions, rawV2FlipThresholds, rawFlipThresholdsStatus, rawFlipThresholdsStatusReason, rawMetaNSamples, rawHeadlineBanded, rawRobustnessDisplayVerdict, rawRobustnessDisplayVerdictReason])

  // ==========================================================================
  // Drivers Section Data (with dynamic normalisation)
  // ==========================================================================
  const drivers = useMemo<DriversSectionData>(() => {
    const driversStatus = report?.drivers_status || 'unavailable'

    // C4 fix 2: the row merge lives in selectDriverPolicyFeed — THE one feed
    // this panel and the canvas hook (useNodeDisplayMetadata) both read, so
    // the coverage verdict (and therefore the disclosed basis) cannot fork
    // between the two surfaces for the same report.
    const feed = selectDriverPolicyFeed(report)
    const rawFactors = feed.rawFactors

    // P0 DIAGNOSTIC: Log the resolved source-1 rows to verify field mapping
    // Fix 3: Guard window access for SSR, Fix 5: Gate behind debug toggle
    if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG && rawFactors.length > 0) {
      console.warn('[useResultsSectionData] Merged driver rows:', {
        count: rawFactors.length,
        sample: rawFactors[0],
        usedEnrichmentFallback: feed.usedEnrichmentFallback,
        allFields: rawFactors.map((f: any) => ({
          node_id: f.node_id,
          label: f.label,
          sensitivity_score: f.sensitivity_score,
          elasticity: f.elasticity,
          value_of_information: f.value_of_information,
          confidence: f.confidence,
          direction: f.direction,
        })),
      })
    }

    if (rawFactors.length === 0) {
      return {
        drivers: [],
        driversStatus: driversStatus === 'computed' ? 'unavailable' : driversStatus,
        topDrivers: [],
        totalCount: 0,
        hasMagnitudeData: false,
      }
    }

    const normalizedFactors = rawFactors.map(f => normalizeFactorSensitivity(f, nodeLabelMap))

    // Step 1: Extract keys and raw elasticities
    const factorsWithKeys = normalizedFactors.map((f, index) => ({
      raw: f,
      key: getFactorKey(f, index),
      rawElasticity: getRawElasticity(f),
      influenceScore: f.influenceScore,
      importanceRank: f.importanceRank,
      label: f.label,
    }))

    // Step 2: Compute dynamic normalisation
    const normalisedMap = computeNormalisedInfluences(factorsWithKeys)

    // Step 3: Compute ranks by the DISPLAYED metric (Codex B2 doctrine fix:
    // the surface says "Influence", so the order and the rank-1 crown follow
    // the same number the bar renders. Codex R3-B1 tightens this to a
    // complete-metric-set policy: producer influence_score is used only when
    // EVERY factor carries one — a partial set would rank a mixture of
    // producer scores and elasticity-normalised fallbacks, which are not
    // comparable. Under partial coverage every factor displays and ranks by
    // normalisedInfluence instead, so the whole surface shares one basis.
    // Codex R3-B1: display value + provenance from the ONE shared policy
    // (driverDisplayModel) — the same function the graph badge consumes.
    // C4 fix 2: read the model off the shared FEED rather than recomputing it
    // from this panel's own rows. Sharing the policy function alone still let
    // the verdict fork, because each surface fed it a different row set; the
    // keys are identical (getFactorKey resolves ids before labels, so the
    // feed's label-free normalisation yields the same key per row).
    const displayModel = feed.displayModel
    const rankMap = computeFactorRanks(
      factorsWithKeys.map((f) => ({
        ...f,
        displayValue: displayModel.get(f.key)?.value ?? 0,
      })),
    )

    // Step 4: Derive edges for direction mapping
    const edgesForDirection: EdgeForDirection[] = edges.map(e => ({
      source: e.source,
      target: e.target,
      effect_direction: (e.data as ResultsCanvasEdgeData)?.effect_direction,
      direction: (e.data as ResultsCanvasEdgeData)?.direction,
    }))

    // Step 4b: Build fragile edges lookup for factor-to-goal edges
    // RULE: When a factor has multiple fragile edges, keep the one with highest switchProbability (most risky)
    // - Prefer defined values over undefined (undefined means "no data", not "zero risk")
    // - When both defined, keep the higher value (more risky edge dominates)
    const fragileEdgesRaw = safeArray(report?.robustness?.fragile_edges)
    const fragileEdgesMap = new Map<string, { switchProbability?: number; alternativeWinnerLabel?: string }>()
    fragileEdgesRaw.forEach((fe: any) => {
      const fromId = fe.from_id ?? fe.fromId ?? fe.source
      if (fromId) {
        // Bug fix: use switch_probability as primary (direct flip probability from ISL)
        // Fall back to marginal_switch_probability only if switch_probability missing
        const newProb = typeof fe.switch_probability === 'number'
          ? fe.switch_probability
          : typeof fe.marginal_switch_probability === 'number'
            ? fe.marginal_switch_probability
            : undefined
        const existing = fragileEdgesMap.get(fromId)
        const existingProb = existing?.switchProbability

        // Decision logic: prefer defined values, then prefer higher values
        const shouldReplace = !existing || // No existing entry
          (existingProb === undefined && newProb !== undefined) || // New has value, existing doesn't
          (existingProb !== undefined && newProb !== undefined && newProb > existingProb) // Both defined, new is higher

        if (shouldReplace) {
          fragileEdgesMap.set(fromId, {
            switchProbability: newProb,
            alternativeWinnerLabel: fe.alternative_winner_label ?? fe.alternativeWinnerLabel ?? fe.alternativeWinner,
          })
        }
      }
    })

    // Step 4b-2 (additive): producer worth_investigating ids from the
    // robustness VOI suggestions — joined onto driver rows by factor id only.
    // (value_of_information is not declared on the narrowed robustness type;
    // the helper validates every row itself.)
    const voiWorthInvestigatingIds = buildWorthInvestigatingIdSet(
      (report?.robustness as { value_of_information?: unknown } | undefined)?.value_of_information,
    )

    // Step 4c: Build enrichments lookup (CEE-generated insights)
    // Matching rule: Use factor_id only (never match by label)
    const factorEnrichmentsRaw = safeArray(report?.factor_enrichments)
    const enrichmentsByFactorId = new Map<string, FactorEnrichment>()
    factorEnrichmentsRaw.forEach((e: any) => {
      const factorId = e.factor_id
      if (factorId && typeof factorId === 'string') {
        enrichmentsByFactorId.set(factorId, {
          factor_id: factorId,
          factor_label: e.factor_label ?? '',
          observations: safeArray(e.observations),
          perspectives: safeArray(e.perspectives),
          confidence_question: typeof e.confidence_question === 'string' ? e.confidence_question : undefined,
        })
      }
    })

    // Step 5: Build driver items with all presentation fields
    // Keep all factors - even those with zero elasticity (they came from the model, show them)
    // Only filter out if we have many factors AND they have zero influence
    const hasAnyElasticity = factorsWithKeys.some(f => Math.abs(f.rawElasticity) > 0)
    // Get max raw elasticity to determine if we have meaningful magnitude data
    const maxRawElasticity = Math.max(...factorsWithKeys.map(f => Math.abs(f.rawElasticity)), 0)
    // Track if we should show magnitude data (full display with bars and semantic labels)
    // CRITICAL: Based on actual data values, NOT data provenance
    // Show full display ONLY when we have real elasticity values > 0.001
    // Otherwise show direction-only view (no misleading 100% bars)
    const hasMagnitudeData = maxRawElasticity > 0.001
    const driverItems: DriverItem[] = factorsWithKeys
      .filter(f => {
        // Always keep if we have few factors
        if (rawFactors.length <= 5) return true
        // Always keep if this factor has elasticity data
        if (Math.abs(f.rawElasticity) > 0) return true
        // If NO factors have elasticity data, keep all (fallback display)
        if (!hasAnyElasticity) return true
        // Otherwise filter out zero-influence factors
        return false
      })
      .map(f => {
        const rank = rankMap.get(f.key) ?? factorsWithKeys.length
        const normalisedInfluence = normalisedMap.get(f.key) ?? 0
        const direction = getFactorDirection(
          f.key,
          edgesForDirection,
          goalNodeId,
          outcomeNodeIds,
          f.raw.direction
        )
        const semanticLabel = getSemanticLabel(rank, normalisedInfluence)

        // Check if factor can be focused on canvas
        const driverForMatch: Driver = { kind: 'node', id: f.key, label: f.raw.label }
        const matches = findNodeMatches(driverForMatch, nodes as Node[])
        const canFocus = matches.length > 0
        const matchedNodeId = matches[0]?.targetId

        // Format label for display - prefer canvas node label, then raw label, then formatted key
        const matchedNode = matchedNodeId ? nodes.find(n => n.id === matchedNodeId) : null
        const canvasLabel = (matchedNode?.data as ResultsCanvasNodeData | undefined)?.label
        const displayLabel = canvasLabel || f.raw.label ||
          f.key
            .replace(/^(fac_|out_|goal_|risk_|factor_)/, '')
            .replace(/_\d+$/, '') // Remove trailing numbers like _0, _1
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())

        // Get confidence: factor_sensitivity.confidence first, then edge beliefExists as fallback
        // PLoT returns confidence directly on factor_sensitivity array items
        const factorNodeId = matchedNodeId || f.key
        const factorConfidence = typeof f.raw.confidence === 'number'
          ? f.raw.confidence
          : undefined
        const edgeToGoal = goalNodeId
          ? edges.find(e => e.source === factorNodeId && e.target === goalNodeId)
          : undefined
        const edgeConfidence = (edgeToGoal?.data as ResultsCanvasEdgeData | undefined)?.beliefExists ?? undefined
        // Fix 3: Clamp confidence to [0,1] range
        const rawConfidence = factorConfidence ?? edgeConfidence
        const confidence = typeof rawConfidence === 'number'
          ? Math.max(0, Math.min(1, rawConfidence))
          : undefined

        // Get fragile edge info if this factor can flip decision
        const fragileInfo = fragileEdgesMap.get(factorNodeId) || fragileEdgesMap.get(f.key)
        const fragileEdgeInfo = fragileInfo ? {
          switchProbability: fragileInfo.switchProbability,
          alternativeWinnerLabel: fragileInfo.alternativeWinnerLabel,
        } : undefined

        // Get CEE enrichment using ONLY the canonical factor ID
        // Matching rule: Use factorKey only (never match by label or try multiple IDs)
        const enrichment = enrichmentsByFactorId.get(f.key)

        return {
          factorKey: f.key,
          factorLabel: displayLabel,
          rawElasticity: f.rawElasticity,
          normalisedInfluence,
          // ISL influence_score (0-1) - use directly for Influence column
          influenceScore: f.raw.influenceScore,
          // Codex R3-B1: single display basis (see DriverItem.displayInfluence)
          displayInfluence: displayModel.get(f.key)?.value ?? 0,
          // Lane 2 review fold: basis marker so absolute-claim surfaces
          // (Triage dominance nudge) can distinguish a producer causal share
          // from a set-relative fallback value.
          displayProvenance: displayModel.get(f.key)?.provenance,
          // Producer influence_rank passthrough (roadmap 1.7, provisional_doctrine_v0)
          influenceRank: f.raw.influenceRank,
          // ISL zero_reason - explains why sensitivity is zero
          zeroReason: f.raw.zeroReason,
          rank,
          direction,
          semanticLabel,
          canFocus,
          matchedNodeId: matchedNodeId !== f.key ? matchedNodeId : undefined,
          confidence,
          // ISL value_of_information (0-1) - whether investigation could change decision
          valueOfInformation: f.raw.valueOfInformation,
          fragileEdgeInfo,
          // PLoT flip_risk_category - how this factor contributes to decision uncertainty
          flipRiskCategory: f.raw.flipRiskCategory,
          // Contested edge detection: check canvas edges targeting this factor's node
          hasContestedEdge: (() => {
            const targetId = matchedNodeId ?? f.key
            return edges.some((e: any) =>
              e.target === targetId && e.data?.validation?.status === 'contested'
            )
          })(),
          // CEE-generated enrichment (observations, perspectives, confidence question)
          enrichment,
          // ISL bootstrap stability — gated on field presence
          attributionStability: f.raw.attributionStability,
          rankFlipRate: f.raw.rankFlipRate,
          evpi: f.raw.evpi,
          // V14.2: Default estimate pill — derivation extracted to
          // `isDefaultedConfidenceFromRaw` so cross-version compat behaviour
          // is unit-testable in isolation. See audit A1-PRIMARY.
          isDefaultedConfidence: isDefaultedConfidenceFromRaw({
            confidenceSource: f.raw.confidenceSource,
            samplingStability: f.raw.samplingStability,
          }),
          // Audit A1-PRIMARY: plumb provenance through for the column-header marker.
          confidenceProvenance: f.raw.confidenceProvenance,
          // Track S: factor value provenance — carried into the driver model for
          // verification only (exposed via the __OLUMI_DEBUG diagnostic, not the DOM).
          valueSource: f.raw.valueSource,
          valueExtractionType: f.raw.valueExtractionType,
          valueDefaulted: f.raw.valueDefaulted,
          // Producer worth_investigating flag (additive): explicit true on the
          // factor_sensitivity row, or the robustness VOI suggestion matched
          // by factor id. Strict — absent unless the producer said true.
          worthInvestigating:
            f.raw.worthInvestigating === true
              || voiWorthInvestigatingIds.has(factorNodeId)
              || voiWorthInvestigatingIds.has(f.key)
              ? true
              : undefined,
        }
      })
      .sort((a, b) => a.rank - b.rank) // Sort by rank

    // Task 2: Identify zero-impact factors (influence < 0.01)
    // v7.2: Filter solely on influence_score, regardless of confidence
    // These are filtered from default view but included in "See all factors"
    const ZERO_IMPACT_THRESHOLD = 0.01
    const isZeroImpact = (d: DriverItem) => {
      const influence = d.displayInfluence ?? d.influenceScore ?? d.normalisedInfluence
      // Bug fix: Handle undefined influence - treat as zero if missing
      const effectiveInfluence = typeof influence === 'number' ? influence : 0
      // v7.2: Zero impact = influence < 0.01 (confidence not checked)
      return effectiveInfluence < ZERO_IMPACT_THRESHOLD
    }

    // Filter non-zero-impact factors for default display
    const nonZeroImpactDrivers = driverItems.filter(d => !isZeroImpact(d))
    const zeroImpactCount = driverItems.length - nonZeroImpactDrivers.length

    // Top 3 drivers (excluding zero-impact factors)
    const topDrivers = nonZeroImpactDrivers.slice(0, 3)

    // Fix 1: Only set islError when we have NO driver items to show
    // If we have data, prefer showing it even if drivers_status indicates error
    const islErrorMessage = driverItems.length === 0 && (driversStatus === 'error' || driversStatus === 'unavailable')
      ? (report?.drivers_error ??
         report?.sensitivity?.error ??
         report?.isl_error ??
         (driversStatus === 'error' ? 'Factor sensitivity service unavailable' : undefined))
      : undefined

    return {
      drivers: driverItems,
      driversStatus: driverItems.length > 0 ? 'computed' : driversStatus,
      topDrivers,
      // v7.2: totalCount reflects non-zero-impact drivers only (visible count)
      totalCount: nonZeroImpactDrivers.length,
      hasMagnitudeData,
      islError: islErrorMessage,
      // Task 2: Track hidden zero-impact factors
      hiddenZeroImpactCount: zeroImpactCount > 0 ? zeroImpactCount : undefined,
      // B2: Detect dominant factor
      // Priority: PLoT top-level dominant_factor > m1Coaching > local heuristic
      ...(() => {
        // B2: Prefer PLoT top-level dominant_factor when both fields are non-empty strings
        const df = report?.dominant_factor
        if (typeof df?.factor_id === 'string' && df.factor_id && typeof df?.factor_label === 'string' && df.factor_label) {
          return {
            dominantFactorId: df.factor_id,
            dominantFactorLabel: df.factor_label,
          }
        }
        // DEPRECATION FALLBACK: Remove after 2026-05-12 — m1Coaching path is effectively dead per B1 investigation.
        const plotDominantId = m1Coaching?.key_drivers?.dominant_factor
        if (plotDominantId) {
          const dominantDriver = nonZeroImpactDrivers.find((d: any) => d.factorKey === plotDominantId)
          if (dominantDriver) {
            return {
              dominantFactorId: plotDominantId,
              dominantFactorLabel: dominantDriver.factorLabel,
            }
          }
          const plotDriver = m1Coaching?.key_drivers?.drivers?.find((d: any) => d.factor_id === plotDominantId)
          return {
            dominantFactorId: plotDominantId,
            dominantFactorLabel: plotDriver?.factor_label ?? plotDominantId,
          }
        }
        // DEPRECATION FALLBACK: Remove after 2026-05-12 — local heuristic (UI-SEM-040).
        const legacy = detectDominantFactorLegacy(nonZeroImpactDrivers as any)
        return legacy ? { dominantFactorId: legacy.dominantFactorId, dominantFactorLabel: legacy.dominantFactorLabel } : {}
      })(),
    }
  }, [report, nodes, edges, goalNodeId, outcomeNodeIds])

  // ==========================================================================
  // Confidence Section Data (with improvements merged)
  // ==========================================================================
  const confidence = useMemo<ConfidenceSectionData>(() => {
    // Get graph readiness from CEE review V1
    const ceeReviewV1 = runMeta?.ceeReviewV1
    const graphReadiness = ceeReviewV1?.readiness ? {
      readiness_level: ceeReviewV1.readiness.level,
      readiness_score: ceeReviewV1.readiness.score,
    } : undefined

    // Get confidence tier with full fallback chain
    const tier = getConfidenceTier(report?.confidence_tier, graphReadiness, report ?? undefined)

    // Derive quality score - only use actual computed values, never fabricate
    // When only tier is known, qualityScore remains null and UI shows tier label only
    let qualityScore: number | null = null
    if (typeof graphReadiness?.readiness_score === 'number') {
      qualityScore = graphReadiness.readiness_score
    } else if (typeof report?.graph_quality?.score === 'number') {
      qualityScore = report.graph_quality.score
    }
    // Note: Do NOT fabricate scores from tier (80/50/20) - display tier label only when score is unavailable

    // Get tier display info
    const tierInfo = {
      tier,
      icon: tier === 'strong' ? '✓' : '⚠',
      label: tier === 'strong'
        ? 'Good foundation'
        : tier === 'fair'
          ? 'Partial picture'
          : tier === 'needs_work'
            ? 'Early sketch'
            : 'Unknown',
      description: tier === 'strong'
        ? 'Your model captures this decision well.'
        : tier === 'fair'
          ? 'Your model covers the basics. Address the items below.'
          : tier === 'needs_work'
            ? 'Add the missing elements below before relying on the result.'
            : 'Unable to assess model quality.',
    }

    // Get warnings as uncertainties from critiques.
    // UI-SEM-069: severity taxonomy bridge — PLoT emits advisories as
    // severity 'IMPROVEMENT' with semantic_severity 'WARNING' (e.g.
    // GRAPH_DENSE, ISL_UNCERTAIN); keying on severity alone silently
    // dropped every one of them. Remove when PLoT unifies the taxonomy.
    const critiques = report?.run?.critique || []
    const warnings = critiques.filter(
      (c: any) => c.severity === 'WARNING' || c.semantic_severity === 'WARNING',
    )

    // V14.3b: Internal-token guard — messages matching this are NOT safe for JSX render.
    const CRITIQUE_INTERNAL_PATTERN = /constraint_|observed_state|intercept=|node_id=|edge_id=|fac_[a-z_]+|opt_[a-z_]+|goal_[a-z_]+|blocks_analysis/i

    const uncertainties: UncertaintyItem[] = warnings.map((w: any) => {
      const msg: string = w.message ?? ''
      const cleaned = stripEncodingNotation(msg)
      return {
        code: w.code || 'UNKNOWN',
        message: msg,
        // Pass user_message through for humanisation fallback
        userMessage: typeof w.user_message === 'string' && w.user_message.trim() ? w.user_message.trim() : undefined,
        // V14.3b: Pre-sanitised text — safe for JSX render fallback (no raw .message in render paths)
        displayText: CRITIQUE_INTERNAL_PATTERN.test(cleaned)
          ? 'Check and update this factor\u2019s inputs for more reliable results.'
          : cleaned,
        suggestion: w.suggested_fix,
        affectedNodes: w.node_id ? [w.node_id] : undefined,
        // Map critique severity: BLOCKER/ERROR/WARNING/INFO → blocker/error/warning/info
        severity: normaliseSeverity(w.severity),
      }
    })

    // UI-SEM-013: Fragile edge filter threshold (0.3). Estimated — PLoT does not provide a visibility gate.
    // Filter to only show high-risk fragile edges (switch_probability > 0.3)
    // P0 Fix: Use safeArray to handle truncated wrapper format
    const fragileEdgesRaw = safeArray(report?.robustness?.fragile_edges)
    const firstFragileEdge = fragileEdgesRaw[0] as Record<string, unknown> | undefined
    if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
      console.warn('[REPORT_SOURCE_DEBUG]', {
        hasReport: !!report,
        reportKeys: report ? Object.keys(report).slice(0, 10) : [],
        hasRobustness: !!report?.robustness,
        hasFragileEdges: !!report?.robustness?.fragile_edges,
        fragileEdgesLength: fragileEdgesRaw.length,
        hasDownstreamCalls: !!report?.downstream_calls,
        firstEdgeKeys: firstFragileEdge ? Object.keys(firstFragileEdge) : [],
        firstEdgeHasFromLabel: !!firstFragileEdge?.from_label,
      })
      console.warn('[FRAGILE_EDGES_SOURCE]', {
        source: 'report.robustness.fragile_edges',
        count: fragileEdgesRaw.length,
        firstEdgeKeys: firstFragileEdge ? Object.keys(firstFragileEdge) : [],
        hasLabels: firstFragileEdge?.from_label !== undefined,
      })
    }

    // Dedupe fragile edges by unique key (edge_id + alternative_winner_id)
    const FRAGILE_EDGE_THRESHOLD = THRESHOLDS.FRAGILE_EDGE_FILTER
    const dedupedFragileEdges = Array.from(
      new Map(
        fragileEdgesRaw.map((fe: any) => [
          `${fe.edge_id ?? fe.edgeId ?? ''}::${fe.alternative_winner_id ?? fe.alternativeWinnerId ?? ''}`,
          fe,
        ])
      ).values()
    )

    // Task 1.5: Filter to high-risk edges (switch_probability > threshold)
    // Metric consistency verified: same pattern used for filtering, counting, and display
    const highRiskFragileEdges = dedupedFragileEdges
      .filter((fe: any) => {
        // Use switch_probability as primary (direct flip probability from ISL)
        // Fall back to marginal_switch_probability only if switch_probability missing
        const flipProb = fe.switch_probability ?? fe.marginal_switch_probability
        if (typeof flipProb === 'number') {
          return flipProb > FRAGILE_EDGE_THRESHOLD
        }
        // If no probability data, include by default (legacy data)
        return true
      })

    // Count how many were filtered out (had numeric probability <= threshold)
    const filteredFragileEdgesCount = dedupedFragileEdges.filter((fe: any) => {
      const flipProb = fe.switch_probability ?? fe.marginal_switch_probability
      return typeof flipProb === 'number' && flipProb <= FRAGILE_EDGE_THRESHOLD
    }).length

    // Task 1: Track total high-risk edges before display limit
    const totalHighRiskEdges = highRiskFragileEdges.length
    const FRAGILE_EDGES_DISPLAY_LIMIT = LIMITS.FRAGILE_EDGES_DISPLAY

    // Sort by risk and take top 3
    const sortedHighRiskEdges = highRiskFragileEdges
      .sort((a: any, b: any) => {
        const bProb = b.switch_probability ?? b.marginal_switch_probability ?? -Infinity
        const aProb = a.switch_probability ?? a.marginal_switch_probability ?? -Infinity
        return bProb - aProb
      })
    const sensitiveAssumptions = sortedHighRiskEdges.slice(0, FRAGILE_EDGES_DISPLAY_LIMIT)

    // Task 1: Count high-risk edges hidden by display limit
    const hiddenHighRiskCount = totalHighRiskEdges > FRAGILE_EDGES_DISPLAY_LIMIT
      ? totalHighRiskEdges - FRAGILE_EDGES_DISPLAY_LIMIT
      : 0
    // Phase 3 Task 3.3: Label enrichment with "Not attributed: {id}" fallback
    // Changed from "Unknown" to "Not attributed" for clarity about data provenance
    const formatUnattributedId = (id: string | undefined) =>
      id ? `Not attributed: ${id}` : undefined
    const nonEmptyLabel = (value: unknown) =>
      typeof value === 'string' && value.trim().length > 0 ? value : undefined
    const getNodeLabel = (id: string | undefined) => (id ? nodeLabelMap.get(id) : undefined)

    // P2 Fix: Build option label lookup from report.option_comparison
    // This provides an additional fallback when PLoT doesn't enrich alternative_winner_label
    // and the canvas node lookup fails
    const optionComparison = safeArray(report?.option_comparison)
    const optionLabelMap = new Map<string, string>()
    optionComparison.forEach((opt: any) => {
      const optId = opt?.option_id
      const optLabel = opt?.option_label
      if (typeof optId === 'string' && typeof optLabel === 'string' && optLabel.trim()) {
        optionLabelMap.set(optId, optLabel)
      }
    })
    const getOptionLabel = (id: string | undefined) => (id ? optionLabelMap.get(id) : undefined)

    // =========================================================================
    // P1 Integration: Extract topFragileEdge for HeroSection bullet 3
    // Task C fix: Use ALL fragile edges (not just high-risk) sorted by switch_probability
    // Only show stable template when fragile_edges is genuinely empty (length === 0)
    // =========================================================================
    const topFragileEdgeData = (() => {
      // Sort ALL fragile edges by switch_probability descending, pick top one
      const allSortedByRisk = [...dedupedFragileEdges].sort((a: any, b: any) => {
        const bProb = b.switch_probability ?? b.marginal_switch_probability ?? -Infinity
        const aProb = a.switch_probability ?? a.marginal_switch_probability ?? -Infinity
        return bProb - aProb
      })
      const fe = allSortedByRisk[0]
      if (!fe) return undefined

      const parseEdgeIdLocal = (edgeId: string | undefined) => {
        if (!edgeId) return {}
        const parts = edgeId.split('::')
        if (parts.length === 2 && parts[0] && parts[1]) {
          return { fromId: parts[0], toId: parts[1] }
        }
        return {}
      }

      const edgeId = typeof fe === 'string' ? fe : fe.edge_id ?? fe.edgeId
      const parsed = parseEdgeIdLocal(edgeId)
      const fromId = (typeof fe === 'string' ? undefined : (fe.from_id ?? fe.fromId ?? fe.source)) ?? parsed.fromId
      const toId = (typeof fe === 'string' ? undefined : (fe.to_id ?? fe.toId ?? fe.target)) ?? parsed.toId
      const altWinnerId = fe.alternative_winner_id ?? fe.alternativeWinnerId

      // Track if we needed to fall back to graph lookup (PLoT didn't enrich labels)
      const apiFromLabel = nonEmptyLabel(fe.from_label) ?? nonEmptyLabel(fe.fromLabel)
      const apiToLabel = nonEmptyLabel(fe.to_label) ?? nonEmptyLabel(fe.toLabel)
      const graphFromLabel = getNodeLabel(fromId)
      const graphToLabel = getNodeLabel(toId)

      // Task C: Console.warn when labels are ABSENT and we use graph lookup
      if (!apiFromLabel && graphFromLabel && import.meta.env.DEV) {
        console.warn(`[useResultsSectionData] Fragile edge from_label ABSENT, using graph lookup: ${fromId} → "${graphFromLabel}"`)
      }
      if (!apiToLabel && graphToLabel && import.meta.env.DEV) {
        console.warn(`[useResultsSectionData] Fragile edge to_label ABSENT, using graph lookup: ${toId} → "${graphToLabel}"`)
      }

      const sourceName = stripEncodingNotation(
        apiFromLabel ??
        graphFromLabel ??
        formatUnattributedId(fromId) ??
        'Unknown factor'
      )
      const targetName = stripEncodingNotation(
        apiToLabel ??
        graphToLabel ??
        formatUnattributedId(toId) ??
        'Unknown target'
      )

      // Task C: Track if labels were successfully resolved
      // If both source and target are "Unknown" or "Not attributed", set flag for generic bullet
      const sourceResolved = sourceName !== 'Unknown factor' && !sourceName.startsWith('Not attributed:')
      const targetResolved = targetName !== 'Unknown target' && !targetName.startsWith('Not attributed:')
      const labelsResolved = sourceResolved && targetResolved

      const alternativeWinnerLabel = stripEncodingNotation(
        nonEmptyLabel(fe.alternative_winner_label) ??
        nonEmptyLabel(fe.alternativeWinnerLabel) ??
        nonEmptyLabel(fe.alternativeWinner) ??
        getNodeLabel(altWinnerId) ??
        getOptionLabel(altWinnerId) ??
        formatUnattributedId(altWinnerId) ??
        'another option'
      )

      return {
        fromId: fromId ?? '',
        fromLabel: sourceName,
        toId: toId ?? '',
        toLabel: targetName,
        alternativeWinnerLabel,
        alternativeWinnerId: altWinnerId,
        switchProbability: fe.switch_probability ?? fe.marginal_switch_probability,
        // Task C: Flag for HeroSection to show generic bullet when labels unresolved
        labelsResolved,
      }
    })()

    const parseEdgeId = (edgeId: string | undefined) => {
      if (!edgeId) return {}
      const parts = edgeId.split('::')
      if (parts.length === 2 && parts[0] && parts[1]) {
        return { fromId: parts[0], toId: parts[1] }
      }
      if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
        console.warn('[useResultsSectionData] Unrecognized fragile edge id format:', edgeId)
      }
      return {}
    }

    // Build E-value lookup from edge_e_values array (ISL) — gated on field presence
    const eValueMap = new Map<string, number>()
    for (const ev of safeArray(report?.robustness?.edge_e_values)) {
      if (typeof ev?.edge_id === 'string' && typeof ev?.e_value === 'number') {
        eValueMap.set(ev.edge_id, ev.e_value)
      }
    }

    sensitiveAssumptions.forEach((fe: any) => {
      const edgeId = typeof fe === 'string' ? fe : fe.edge_id ?? fe.edgeId
      const parsed = parseEdgeId(edgeId)
      const fromId = (typeof fe === 'string' ? undefined : (fe.from_id ?? fe.fromId ?? fe.source)) ?? parsed.fromId
      const toId = (typeof fe === 'string' ? undefined : (fe.to_id ?? fe.toId ?? fe.target)) ?? parsed.toId

      const isEdgeObject = typeof fe === 'object' && fe !== null

      if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
        console.warn('[UNCERTAINTY_DEBUG]', {
          rawEdge: fe,
          hasFromLabel: isEdgeObject && 'from_label' in fe,
          hasToLabel: isEdgeObject && 'to_label' in fe,
          hasAltLabel: isEdgeObject && 'alternative_winner_label' in fe,
          fromLabelValue: isEdgeObject ? fe.from_label : undefined,
          toLabelValue: isEdgeObject ? fe.to_label : undefined,
          altLabelValue: isEdgeObject ? fe.alternative_winner_label : undefined,
        })
      }

      if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
        console.warn('[FragileEdge:RAW]', {
          edge_id: fe.edge_id ?? fe.edgeId ?? edgeId,
          from_label: fe.from_label,
          fromLabel: fe.fromLabel,
          to_label: fe.to_label,
          toLabel: fe.toLabel,
          alternative_winner_label: fe.alternative_winner_label,
          alternativeWinnerLabel: fe.alternativeWinnerLabel,
          from_id: fe.from_id ?? fe.fromId ?? parsed.fromId,
          to_id: fe.to_id ?? fe.toId ?? parsed.toId,
          alternative_winner_id: fe.alternative_winner_id ?? fe.alternativeWinnerId,
          fullObject: (() => {
            try {
              return JSON.stringify(fe).substring(0, 500)
            } catch {
              return '[unserializable]'
            }
          })(),
        })
      }

      // Phase 3 Task 3.3: Label enrichment with fallback chain
      // Priority: PLoT label → canvas node lookup → "Unknown: {id}"
      // Patch 3: Apply stripEncodingNotation to clean labels from encoding patterns like "(0/1)"
      const sourceName = stripEncodingNotation(
        nonEmptyLabel(fe.from_label) ??
        nonEmptyLabel(fe.fromLabel) ??
        getNodeLabel(fromId) ??
        formatUnattributedId(fromId) ??
        'Unknown factor'
      )
      const targetName = stripEncodingNotation(
        nonEmptyLabel(fe.to_label) ??
        nonEmptyLabel(fe.toLabel) ??
        getNodeLabel(toId) ??
        formatUnattributedId(toId) ??
        'Unknown target'
      )

      // Phase 3 Task 3.3: Alternative winner label enrichment
      // Fallback chain: PLoT enrichment → canvas node → report option_comparison → "Unknown: {id}"
      // Patch 3: Apply stripEncodingNotation to clean labels
      const altWinnerId = fe.alternative_winner_id ?? fe.alternativeWinnerId
      const alternativeWinnerLabel = stripEncodingNotation(
        nonEmptyLabel(fe.alternative_winner_label) ??
        nonEmptyLabel(fe.alternativeWinnerLabel) ??
        nonEmptyLabel(fe.alternativeWinner) ??
        getNodeLabel(altWinnerId) ??
        getOptionLabel(altWinnerId) ??
        formatUnattributedId(altWinnerId) ??
        'another option'
      )

      if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG) {
        console.warn('[FragileEdge:RESOLVED]', {
          fromLabel: sourceName,
          toLabel: targetName,
          alternativeLabel: alternativeWinnerLabel,
          usedFallback:
            sourceName === 'this factor' ||
            targetName === 'the outcome' ||
            alternativeWinnerLabel === 'another option',
        })
      }

      // Enhanced message format per spec
      const edgeLabel = fe.label || `${sourceName} → ${targetName}`
      const friendlyMessage = fe.description ||
        `If "${edgeLabel}" changes significantly, "${alternativeWinnerLabel}" could become the better choice`

      // UI-SEM-012: Read PLoT-classified severity (B1+); fall back to local heuristic for pre-B1 cached results.
      const severity: 'critical' | 'error' | 'warning' =
        (fe.severity === 'critical' || fe.severity === 'error' || fe.severity === 'warning')
          ? fe.severity
          // DEPRECATION FALLBACK: Remove after 2026-05-12
          // Pre-B1 cached results lack severity field; compute locally via classifySeverityLegacy.
          : classifySeverityLegacy(fe.switch_probability ?? fe.marginal_switch_probability)

      // Look up factor confidence from driver items for confidence pill display
      const factorConfidence = (() => {
        const sourceKey = fromId
        if (!sourceKey) return null
        const matchedDriver = drivers.drivers.find(
          d => d.factorKey === sourceKey || d.matchedNodeId === sourceKey
        )
        return matchedDriver?.confidence ?? null
      })()

      // V14.3b: Pre-sanitised displayText for JSX render fallback
      const saDisplayText = CRITIQUE_INTERNAL_PATTERN.test(friendlyMessage)
        ? 'Check and update this factor\u2019s inputs for more reliable results.'
        : friendlyMessage

      // E-value: from fragile edge entry directly, or from separate edge_e_values array
      const rawEValue = typeof fe.e_value === 'number' ? fe.e_value : edgeId ? eValueMap.get(edgeId) : undefined

      uncertainties.push({
        code: 'SENSITIVE_ASSUMPTION',
        message: friendlyMessage,
        displayText: saDisplayText,
        suggestion: 'Review this assumption',
        affectedNodes: [fromId, toId].filter(Boolean),
        severity,
        factorConfidence,
        eValue: rawEValue,
        threshold: fe.threshold ? {
          variable: fe.from_id ?? fe.fromId ?? fe.source,
          direction: normaliseDirection(fe.direction) ?? 'positive',
          value: fe.threshold,
          alternativeOption: alternativeWinnerLabel,
        } : undefined,
      })
    })

    // Get evidence coverage from multiple sources
    const rawEvidenceQuality = ceeReviewV1?.evidence_quality
      ?? report?.evidence_quality
      ?? null

    const evidenceCoverage = rawEvidenceQuality ? {
      backedByData: rawEvidenceQuality.backed_by_data ?? rawEvidenceQuality.strong ?? 0,
      needsValidation: rawEvidenceQuality.needs_validation ?? rawEvidenceQuality.weak ?? 0,
    } : undefined

    // Normalise improvements from multiple sources
    const biasFindings = report?.bias_findings || ceeReviewV1?.bias_findings || []
    const qualityFactors = report?.quality_factors || ceeReviewV1?.quality_factors || []
    const improvementGuidance = report?.improvement_guidance || ceeReviewV1?.improvement_guidance || []

    const improvements = normaliseImprovements(biasFindings, qualityFactors, improvementGuidance)

    // Wire status signals from report (not runMeta) for degraded banner
    // P2 Fix: These fields are set by responseMapper from V2 response
    const analysisStatus = report?.analysis_state === 'partial' ? 'partial' : 'computed'
    const driversStatus = report?.drivers_status ?? 'computed'
    // Check for robustness data: fragile_edges or robust_edges indicates computed
    // P0 Fix: Use safeArray to handle truncated wrapper format { __truncated: true, items: [...] }
    const robustness = report?.robustness
    const hasRobustnessData = robustness && (
      safeArray(robustness.fragile_edges).length > 0 ||
      safeArray(robustness.robust_edges).length > 0 ||
      robustness.recommendation_stability !== undefined ||
      robustness.ranking_stability !== undefined
    )
    const robustnessStatus = hasRobustnessData ? 'computed' : 'unavailable'

    // Build filtered disclosure when items were excluded
    // Task 2: Use scenario-tested language, avoid "flip risk"
    // Bug fix: Use "assumption"/"assumptions" terminology, NOT "edge"/"edges"
    const filteredFragileEdges = filteredFragileEdgesCount > 0 ? {
      filteredCount: filteredFragileEdgesCount,
      threshold: FRAGILE_EDGE_THRESHOLD,
      description: `${filteredFragileEdgesCount} additional ${filteredFragileEdgesCount === 1 ? 'assumption' : 'assumptions'} changed the best option in <${Math.round(FRAGILE_EDGE_THRESHOLD * 100)}% of simulations`,
    } : undefined

    // Bug 2 fix: Extract robustness level for "Good foundation" logic
    const robustnessLevel = report?.robustness?.level as RobustnessLevel | undefined

    // P0.1: Humanise non-SENSITIVE_ASSUMPTION critiques for attention banner
    const plotCritiques = uncertainties.filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
    const humanisedCritiques = plotCritiques.map(item => humaniseCritique(item, nodeLabelMap))

    return {
      tier: tierInfo,
      qualityScore,
      uncertainties,
      topUncertainties: uncertainties.slice(0, 3),
      // Task 1: Track total high-risk edges for disclosure
      totalHighRiskEdges,
      rankingStability: report?.robustness?.recommendation_stability ?? report?.robustness?.ranking_stability,
      robustnessLevel,
      evidenceCoverage,
      improvements,
      topImprovements: improvements.slice(0, 2),
      analysisStatus,
      driversStatus,
      robustnessStatus,
      filteredFragileEdges,
      // Task 1: Track hidden high-risk edges for disclosure
      hiddenHighRiskCount: hiddenHighRiskCount > 0 ? hiddenHighRiskCount : undefined,
      // P0.1: Humanised critiques for attention banner
      humanisedCritiques,
      // P1 Integration: Top fragile edge for HeroSection bullet 3
      topFragileEdge: topFragileEdgeData,
      // Task 4 (M1 Coaching): Evidence gaps - sorted by VOI descending, deduped by factor_id
      ...(() => {
        const rawGaps = safeArray(m1Coaching?.evidence_gaps)
        if (rawGaps.length === 0) return {}

        // Dedupe by factor_id
        const seenFactors = new Set<string>()
        const uniqueGaps = rawGaps.filter((gap: any) => {
          const factorId = gap.factor_id
          if (!factorId || seenFactors.has(factorId)) return false
          seenFactors.add(factorId)
          return true
        })

        // ⛔ NO CLIENT-SIDE RE-RANK. The producer's emission order is kept.
        //
        // This list used to be sorted EVPI → VOI here, and then the top-3 slice
        // below re-sorted by `evpi_percentage_points`. Both are gone. The
        // quantity is not merely uncalibrated, it is REFUTED: replayed live on
        // 2026-07-25 against PLoT 1dd45b6a → ISL 3aea011c, PLoT published
        // `evpi_percentage_points: 12.3` for *Market Receptivity to Feature*
        // while ISL, in the SAME response one level away, measured that same
        // factor at `p_win_delta_percentage_points: 0.0` and
        // `factor_evppi: 0.0`. Same for 10.2 and 6.6 on decision a4b32ee2.
        //
        // The formula (PLoT coaching/evidence-gaps.ts:75) is
        // `voi × winProbSpread × 100`, multiplying BY the top-two
        // win-probability gap — which INVERTS decision theory. ISL measures the
        // near-tied decision as worth 16× the foregone one; PLoT ranks them
        // opposite.
        //
        // Losing this sort is not a downgrade. `winProbSpread` is a SINGLE
        // PER-RESPONSE SCALAR, so within one response "by evpi_pp desc" and
        // "by voi desc" are the SAME ordering — and "by voi desc" is exactly
        // what PLoT already emits. Preserving producer order therefore
        // reproduces the previous on-screen order on live data, without the UI
        // depending on, or asserting, the refuted figure.
        //
        // Do NOT reinstate a sort here. If an ordering claim is ever wanted
        // again it must come from a quantity our own compute layer corroborates.
        const orderedGaps = uniqueGaps

        // Map to UI format (defensive: accept both voi_score/voi field names)
        const evidenceGaps = orderedGaps.map((gap: any) => ({
          factorId: gap.factor_id,
          factorLabel: gap.factor_label ?? gap.factor_id,
          // ⛔ No absence-fabrication. `?? 0` used to turn "the producer sent
          // no confidence" into "the producer said zero", which the triage
          // card then spoke as "This factor has 0% confidence."
          confidence: typeof gap.confidence === 'number' && Number.isFinite(gap.confidence)
            ? gap.confidence
            : null,
          voi: gap.voi_score ?? gap.voi ?? 0,
          evpi: typeof gap.evpi === 'number' ? gap.evpi : undefined,
          suggestion: gap.suggestion ?? '',
          targetNodeId: gap.target_node_id,
        }))

        // ⛔ NO SECOND SELECTION GATE. The producer's set IS the selection.
        //
        // This was `.filter(g => (g.evpiPp ?? 0) > 0)` — and it was not an
        // ordering, it decided MEMBERSHIP. Its worst mode was not
        // "misordered", it was EMPTY: PLoT's `computeEvpiPercentagePoints`
        // returns undefined when `winProbSpread <= 0`, so on a PERFECT TIE
        // between the top two options — precisely where information is most
        // valuable — PLoT omits the field, `?? 0` turned that absence into a
        // confident zero, `0 > 0` was false, and EVERY suggested evidence gap
        // vanished. A user with a genuinely close decision saw none.
        //
        // What selects now: PLoT's own membership decision, which is
        // `non-lever ∧ top-k by ISL importance_rank ∧ confidence < 0.7`
        // (coaching/evidence-gaps.ts). That is defensible in words — "a factor
        // that matters to the result, that we are not confident about" — and
        // contains no EVPI. The UI simply stops stacking a second, refuted
        // numeric gate on top of it. No replacement number is introduced;
        // substituting one unvalidated figure for another is the mistake this
        // whole track exists to stop.
        //
        // `topEvidenceGapsEmpty` went with the gate: it could only ever be true
        // because of that filter, and the copy it drove ("No high-value
        // evidence gaps. Your current uncertainties have minimal impact on the
        // result.") was itself an EVPI claim.
        const topEvidenceGaps = evidenceGaps.slice(0, 3)

        return {
          evidenceGaps,
          topEvidenceGaps,
        }
      })(),
      // Task 5 (M1 Coaching): Next actions - sorted by priority, deduped against fragile edges
      ...(() => {
        const rawActions = safeArray(m1Coaching?.next_actions)
        if (rawActions.length === 0) return {}

        // Build a set of fragile edge factor IDs for deduplication
        const fragileFactorIds = new Set<string>()
        safeArray(report?.robustness?.fragile_edges).forEach((fe: any) => {
          const factorId = fe.from_id ?? fe.fromId ?? fe.source
          if (factorId) fragileFactorIds.add(factorId)
        })

        // Dedupe by action text + target_id, skip if target_id matches a fragile edge
        const seenActions = new Set<string>()
        const uniqueActions = rawActions.filter((action: any) => {
          const actionText = (action.action ?? '').toLowerCase().trim()
          const targetId = action.target_id ?? ''
          const dedupeKey = `${actionText}::${targetId}`

          // Skip if already seen
          if (seenActions.has(dedupeKey)) return false
          seenActions.add(dedupeKey)

          // Skip if target_id matches a fragile edge (already shown in uncertainties)
          if (targetId && fragileFactorIds.has(targetId)) return false

          return true
        })

        // Sort by priority (lower = higher priority)
        const sortedActions = uniqueActions.sort((a: any, b: any) => {
          const aPriority = typeof a.priority === 'number' ? a.priority : 999
          const bPriority = typeof b.priority === 'number' ? b.priority : 999
          return aPriority - bPriority
        })

        // Map to UI format
        // V12 B6: For edge targets, extract from-node ID for canvas focus
        const nextActions = sortedActions.map((action: any) => {
          const rawTargetId = action.target_id as string | undefined
          const targetType = action.target_type as 'node' | 'edge' | 'factor' | 'option' | undefined
          const resolvedTargetId = targetType === 'edge' && rawTargetId?.includes('->')
            ? rawTargetId.split('->')[0]
            : rawTargetId
          return {
            action: action.action ? sanitizeCoachingText(action.action) : '',
            rationale: action.rationale ? sanitizeCoachingText(action.rationale) : '',
            priority: action.priority ?? 999,
            targetType,
            targetId: resolvedTargetId,
            targetLabel: action.target_label ? sanitizeCoachingText(action.target_label) : undefined,
          }
        })

        // V14.2: topNextActions for hero coaching line uses ALL actions sorted by
        // priority (not deduped against fragile edges). The deduped `nextActions` is
        // used by the "Your next steps" section to avoid redundancy.
        const allSortedActions = [...rawActions].sort((a: any, b: any) => {
          const aPriority = typeof a.priority === 'number' ? a.priority : 999
          const bPriority = typeof b.priority === 'number' ? b.priority : 999
          return aPriority - bPriority
        }).map((action: any) => ({
          action: action.action ? sanitizeCoachingText(action.action) : '',
          rationale: action.rationale ? sanitizeCoachingText(action.rationale) : '',
          priority: action.priority ?? 999,
          targetType: action.target_type as 'node' | 'edge' | 'factor' | 'option' | undefined,
          targetId: (() => {
            const rawTargetId = action.target_id as string | undefined
            const targetType = action.target_type as string | undefined
            return targetType === 'edge' && rawTargetId?.includes('->')
              ? rawTargetId.split('->')[0]
              : rawTargetId
          })(),
          targetLabel: action.target_label ? sanitizeCoachingText(action.target_label) : undefined,
        }))

        return {
          nextActions,
          topNextActions: allSortedActions.slice(0, 3),
        }
      })(),
      // Task 6 (M1 Coaching): Assumptions ledger - sorted by severity (high → medium → low)
      ...(() => {
        const rawAssumptions = safeArray(m1Coaching?.assumptions_ledger)
        if (rawAssumptions.length === 0) return {}

        // Sort by severity: high → medium → low
        const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
        const sortedAssumptions = rawAssumptions.sort((a: any, b: any) => {
          const aOrder = severityOrder[a.severity] ?? 3
          const bOrder = severityOrder[b.severity] ?? 3
          return aOrder - bOrder
        })

        // Map to UI format
        const assumptions = sortedAssumptions.map((assumption: any) => ({
          severity: (assumption.severity ?? 'low') as 'low' | 'medium' | 'high',
          message: assumption.message ? sanitizeCoachingText(assumption.message) : '',
          target: assumption.target,
        }))

        return { assumptions }
      })(),
      // V12: M1 coaching top fragile edge — parsed from edge_id/label
      m1CoachingTopFragileEdge: (() => {
        const tfe = m1Coaching?.top_fragile_edge
        if (!tfe?.edge_id) return undefined
        // Parse from_id from edge_id (e.g. "fac_x->out_y" → "fac_x")
        const fromId = tfe.edge_id.split('->')[0] ?? ''
        const toId = tfe.edge_id.split('->')[1] ?? ''
        // Parse from_label from label (e.g. "Product-Market Fit → Customer Acq" → "Product-Market Fit")
        const labelParts = tfe.label.split(/\s*\u2192\s*|\s*->\s*/)
        const fromLabel = labelParts[0]?.trim() ?? fromId
        const toLabel = labelParts[1]?.trim() ?? toId
        return {
          fromId,
          fromLabel,
          toId,
          toLabel,
          switchProbability: tfe.switch_probability,
          alternativeWinnerLabel: tfe.alternative_winner ?? null,
        }
      })(),
      // V12: Review status for M2 gate
      reviewStatus,
      // V12: M2 data (gated on reviewStatus === 'complete' in components)
      m2BiasFindings: (() => {
        const findings = safeArray(m1ReviewAssumptions?.bias_findings)
        if (findings.length === 0) return undefined
        return findings.map((f: any) => ({
          type: f.type ?? '',
          source: f.source ?? '',
          description: f.description ? sanitizeCoachingText(f.description) : '',
          affectedElements: safeArray(f.affected_elements),
          linkedCritiqueCode: f.linked_critique_code ?? '',
        }))
      })(),
      m2DecisionQualityPrompts: (() => {
        const prompts = safeArray(m1ReviewAssumptions?.decision_quality_prompts)
        if (prompts.length === 0) return undefined
        return prompts.map((p: any) => ({
          principle: p.principle ? sanitizeCoachingText(p.principle) : '',
          appliesBecause: p.applies_because ? sanitizeCoachingText(p.applies_because) : '',
          question: p.question ? sanitizeCoachingText(p.question) : '',
        }))
      })(),
      m2EvidenceEnhancements: (() => {
        const raw = m1ReviewAssumptions?.evidence_enhancements as
          Record<string, { specific_action: string; decision_hygiene: string }> | undefined
        if (!raw) return undefined
        const sanitized: Record<string, { specific_action: string; decision_hygiene: string }> = {}
        for (const [k, v] of Object.entries(raw)) {
          sanitized[k] = {
            specific_action: v.specific_action ? sanitizeCoachingText(v.specific_action) : '',
            decision_hygiene: v.decision_hygiene ? sanitizeCoachingText(v.decision_hygiene) : '',
          }
        }
        return sanitized
      })(),
      m2NarrativeSummary: (() => {
        const raw = reviewStatus === 'complete' ? m1ReviewAssumptions?.narrative_summary : undefined
        return raw ? sanitizeCoachingText(raw) : undefined
      })(),

      // New ISL fields (gated on presence)
      conditionalWinners: (() => {
        const raw = safeArray((report as any)?.conditional_winners ?? (report as any)?.robustness?.conditional_winners)
        if (raw.length === 0) return undefined
        return raw.map((w: any) => ({
          factor_label: String(w.factor_label ?? w.label ?? ''),
          factor_id: String(w.factor_id ?? w.node_id ?? ''),
          split_value: Number(w.split_value ?? 0),
          split_unit: w.split_unit ?? w.unit ?? undefined,
          high_bucket: {
            winner_label: String(w.high_bucket?.winner_label ?? w.high_bucket?.label ?? ''),
            win_probability: Number(w.high_bucket?.win_probability ?? 0),
          },
          low_bucket: {
            winner_label: String(w.low_bucket?.winner_label ?? w.low_bucket?.label ?? ''),
            win_probability: Number(w.low_bucket?.win_probability ?? 0),
          },
        }))
      })(),
      inferenceWarnings: (() => {
        const raw = safeArray((report as any)?.inference_warnings ?? (report as any)?.robustness?.inference_warnings)
        // Surface all inference warnings (previously gated on specific codes)
        const relevant = raw.filter((w: any) => typeof w?.code === 'string')
        if (relevant.length === 0) return undefined
        return relevant.map((w: any) => {
          const nodeIds: string[] = safeArray(w.affected_nodes ?? w.affectedNodes)
          return {
            code: String(w.code ?? ''),
            affected_nodes: nodeIds,
            affected_labels: nodeIds.map(id => nodeLabelMap.get(id) ?? id),
            message: w.message ? String(w.message) : undefined,
            // Roadmap 1.12: producer severity carried verbatim (never
            // defaulted). Warning-severity entries surface on the Analysis
            // tab; info-severity stays hidden there.
            severity: typeof w.severity === 'string' ? w.severity : undefined,
          }
        })
      })(),
      edgeEValues: (() => {
        const raw = safeArray((report as any)?.robustness?.edge_e_values)
        const valid = raw.filter((ev: any) => typeof ev?.edge_id === 'string' && typeof ev?.e_value === 'number')
        return valid.length > 0 ? valid.map((ev: any) => ({ edge_id: String(ev.edge_id), e_value: Number(ev.e_value) })) : undefined
      })(),
      // Fragile edges for ChallengeSection "Model structure" subgroup (used when edge_e_values absent)
      challengeFragileEdges: (() => {
        const raw = safeArray(report?.robustness?.fragile_edges)
        const valid = raw.filter((fe: any) =>
          typeof fe?.from_label === 'string' && typeof fe?.to_label === 'string' &&
          typeof fe?.switch_probability === 'number'
        )
        if (valid.length === 0) return undefined
        // Option-label lookup for alternative_winner_id → label resolution.
        const optionLabelMap = new Map<string, string>()
        for (const o of safeArray(report?.option_comparison)) {
          if (o?.option_id && typeof o?.option_label === 'string') {
            optionLabelMap.set(o.option_id, o.option_label)
          }
        }
        const enriched = valid.map((fe: any) => {
          const altId: string | undefined = fe.alternative_winner_id ?? fe.alternativeWinnerId ?? undefined
          const rawAltLabel: string | undefined =
            typeof fe.alternative_winner_label === 'string' && fe.alternative_winner_label.trim().length > 0
              ? fe.alternative_winner_label
              : typeof fe.alternativeWinnerLabel === 'string' && fe.alternativeWinnerLabel.trim().length > 0
                ? fe.alternativeWinnerLabel
                : undefined
          const resolvedLabel = rawAltLabel
            ?? (altId ? optionLabelMap.get(altId) : undefined)
            ?? (altId ? nodeLabelMap.get(altId) : undefined)
          if (!resolvedLabel) {
            if (import.meta.env.DEV) {
              console.warn('[brief-4] fragile edge dropped — no alternative winner label resolved', {
                edge_id: fe.edge_id,
                from_label: fe.from_label,
                to_label: fe.to_label,
                alternative_winner_id: altId,
              })
            }
            return null
          }
          return {
            edge_id: fe.edge_id ? String(fe.edge_id) : undefined,
            from_id: fe.from_id ?? fe.fromId ?? fe.source ?? undefined,
            // to_id passthrough (mirrors from_id): the analysis-graph projection
            // resolves a flip risk to its canvas edge via the from→to endpoint
            // pair. Pure passthrough — no default, no inference.
            to_id: fe.to_id ?? fe.toId ?? fe.target ?? undefined,
            from_label: String(fe.from_label),
            to_label: String(fe.to_label),
            switch_probability: Number(fe.switch_probability),
            marginal_switch_probability: typeof fe.marginal_switch_probability === 'number'
              ? Number(fe.marginal_switch_probability)
              : undefined,
            alternative_winner_id: altId,
            alternative_winner_label: stripEncodingNotation(resolvedLabel),
          }
        }).filter((fe): fe is NonNullable<typeof fe> => fe != null)
        if (enriched.length === 0) return undefined
        // Sort: marginal_switch_probability desc, fallback switch_probability desc.
        enriched.sort((a, b) => {
          const aKey = a.marginal_switch_probability ?? a.switch_probability
          const bKey = b.marginal_switch_probability ?? b.switch_probability
          return bKey - aKey
        })
        return enriched
      })(),
    }
    // runMeta?.ceeReviewV1 is a genuine input (graphReadiness, evidence
    // quality, bias/quality/improvement guidance all read it); the CEE review
    // lands asynchronously after `report`, so omitting it froze the tier at
    // its pre-review value. The sibling `completeness` memo already lists it.
  }, [report, m1Coaching, drivers, reviewStatus, m1ReviewAssumptions, nodeLabelMap, runMeta?.ceeReviewV1])

  // ==========================================================================
  // Improvements Section Data (Legacy - now merged into confidence)
  // ==========================================================================
  const improvements = useMemo<ImprovementsSectionData>(() => {
    return {
      improvements: confidence.improvements,
      count: confidence.improvements.length,
      hasHighPriority: confidence.improvements.some(i => i.priority === 1),
    }
  }, [confidence])

  // P0 V5 golden-path repair (Wave 4 wiring): consult SOURCE fields
  // before the UI-SEM fabrications mask them. Surfaced on the return so
  // HeroQualifier / fallback panels render curated qualifier copy
  // honestly when source data is incomplete.
  const completeness = useMemo<ResultCompleteness>(
    () =>
      deriveResultCompleteness({
        resultsStatus,
        report: report ?? null,
        ceeReviewV1: runMeta?.ceeReviewV1 ?? null,
        driversPayload: report?.drivers_payload ?? null,
      }),
    [resultsStatus, report, runMeta?.ceeReviewV1],
  )

  // Wave F-A: register option ids for identity-anchored ordinals the first
  // time each id appears (append-only merge; per-scenario continuity —
  // hydrateGraphSlice resets). Ordinals are display continuity only.
  // Codex SF10: never reconstruct ids from a separator-joined string — the
  // accepted schema does not forbid any character in an id, so ANY separator
  // can split a legitimate id into fragments that register wrongly. The dep
  // key is canonical JSON (collision-free) and the ORIGINAL array registers.
  // Registration goes through sortOptionsForDisplay explicitly (allOptions
  // already carries that order, but first-seen ordinals are frozen forever,
  // so the seeding order must be guaranteed at the registration site, not
  // inherited): badge numbers then match the order every list renders in.
  const optionIds = sortOptionsForDisplay(recommendation.allOptions).map((o) => o.id)
  const optionIdsKey = JSON.stringify(optionIds)
  useEffect(() => {
    if (optionIds.length === 0) return
    useCanvasStore.getState().registerOptionNumbering(optionIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionIdsKey is the canonical value key for optionIds
  }, [optionIdsKey])

  // Lane 3 (SF2) perf — EVIDENCE-DEMANDED (rerunContinuity render-count
  // pin): with the results body mounted through a run, a fresh return
  // object here defeated ResultsBody's memo on every SSE progress tick.
  // The constituent fields are themselves memoised; stabilising the
  // envelope stops per-tick subtree re-renders.
  return useMemo(
    () => ({
      recommendation,
      drivers,
      confidence,
      improvements,
      isLoading,
      isError,
      goalLabel,
      goalNodeId,
      completeness,
      autoNoiseProvenance,
      sensitivityReference,
    }),
    [
      recommendation,
      drivers,
      confidence,
      improvements,
      isLoading,
      isError,
      goalLabel,
      goalNodeId,
      completeness,
      autoNoiseProvenance,
      sensitivityReference,
    ],
  )
}

export default useResultsSectionData

// =============================================================================
// Exported for testing
// =============================================================================

export {
  normaliseLabel,
  getFactorKey,
  getRawElasticity,
  computeNormalisedInfluences,
  computeFactorRanks,
  selectDriverDisplayModel,
  normalizeOutcomeValues,
  normaliseDirection,
  getFactorDirection,
  getSemanticLabel,
  mapReadinessLevel,
  mapConfidenceLevel,
  getConfidenceTier,
  deriveConfidenceTierLegacy,
  classifySeverityLegacy,
  detectDominantFactorLegacy,
  normaliseImprovements,
}
