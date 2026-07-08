/**
 * mapV5AnalysisToReport — pure mapper from a V5 `analysis_result` block to
 * the canvas store's `ReportV1` shape.
 *
 * Mirrors the V4 [`mapV2ResponseToReportV1`](../adapters/plot/v2/responseMapper.ts)
 * output fields (option_probabilities, drivers, factor_sensitivity,
 * robustness, confidence, warnings) so the existing main Results panel —
 * which already consumes that shape from V4 turns — can render V5 analysis
 * data without any selector changes.
 *
 * The V5 envelope is slimmer than a V2RunResponse: only `win_probabilities`
 * (Record<option_id, number>) is guaranteed at the block level. Outcome
 * quantiles, confidence intervals, and per-option goal probabilities live
 * inside `enrichment.option_comparison[]` IF PLoT included them in the
 * enrichment passthrough (the boundary contract is "enrichment is
 * byte-for-byte PLoT" — see olumi-schemas/src/orchestrator/handler-results.ts).
 *
 * No silent defaults: missing numerics surface as `null`/`undefined`. Option
 * IDs come from the canonical `enrichment.option_comparison[].option_id`
 * when present (the source of truth even though `block.win_probabilities`
 * may be keyed by labels in real staging); they fall back to the raw
 * `win_probabilities` keys only when no `option_comparison` exists, and
 * the duplicate-label guard prevents false precision in that fallback.
 * Sensitivity entries are read against the full alias set documented in the
 * backend's deriveTopDriversFromTopLevel
 * (olumi-assistants-service/src/orchestrator-v5/context/analysis-fallback.ts).
 *
 * Pure function — no store reads, no side effects, no DEV-time logging
 * that depends on `import.meta.env`.
 */

import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import type { ReportV1, ConfidenceLevel } from '../adapters/plot/types'

// ─── Helpers ───────────────────────────────────────────────────────────

function safeString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function safeFiniteNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Normalise a raw `goal_fit_basis` entry (PLoT #204, doctrine B).
 * `.passthrough()` on the schema side — only `scored_from` (open-vocab
 * string) and `node_ids` (string array) are read; unknown extra keys are
 * dropped rather than carried opaquely, matching this mapper's "narrowed,
 * never opaque" convention for nested objects (see the option_comparison
 * shape below). Returns undefined when neither field is present.
 */
function normaliseGoalFitBasis(
  raw: { scored_from?: unknown; node_ids?: unknown } | undefined,
): { scored_from?: string; node_ids?: string[] } | undefined {
  if (!raw) return undefined
  const scoredFrom = safeString(raw.scored_from)
  const nodeIds = Array.isArray(raw.node_ids)
    ? raw.node_ids.filter((v): v is string => typeof v === 'string')
    : undefined
  if (scoredFrom === undefined && nodeIds === undefined) return undefined
  return {
    ...(scoredFrom !== undefined ? { scored_from: scoredFrom } : {}),
    ...(nodeIds !== undefined ? { node_ids: nodeIds } : {}),
  }
}

// ─── Factor sensitivity normalisation ──────────────────────────────────

interface NormalisedFactor {
  factor_id: string
  factor_label: string
  sensitivity: number // absolute magnitude
  direction: 'positive' | 'negative'
  /**
   * Producer influence_score (0-1) — structural causal influence, a DISTINCT
   * measure from sensitivity (roadmap 1.7; provisional_doctrine_v0:
   * influence ≠ sensitivity). Additive passthrough only — never derived,
   * never defaulted; absent when the producer omitted it.
   */
  influence_score?: number
  /** Producer influence_rank (1 = most influential). Additive passthrough. */
  influence_rank?: number
  /**
   * Producer zero_reason (e.g. 'intervention_override' for pinned factors).
   * Additive passthrough so the DriversSection can show influence WITHOUT
   * sensitivity-flavoured copy for pinned factors.
   */
  zero_reason?: string
}

/**
 * Normalise one raw factor_sensitivity entry. Accepts the full alias set
 * the backend tolerates (factor_id|node_id|id, label|factor_label,
 * sensitivity|elasticity|sensitivity_score|importance_score, direction
 * explicit or implied by sign). Returns null when the entry has no usable
 * ID or no usable magnitude — entries are dropped, never defaulted.
 */
function normaliseFactorEntry(entry: unknown): NormalisedFactor | null {
  if (!isPlainObject(entry)) return null

  // Priority order matches V4's pickFactorSensitivityForUi:
  // sensitivity_score (unnormalized canonical) wins over elasticity
  // (which staging emits as a normalized 0–1 value, e.g. 1.0 for the top
  // factor, masking the actual magnitude). See
  // src/adapters/plot/v2/responseMapper.ts createDriversPayloadFromV2:753–757.
  const rawMagnitude =
    safeFiniteNumber(entry.sensitivity_score) ??
    safeFiniteNumber(entry.sensitivity) ??
    safeFiniteNumber(entry.elasticity) ??
    safeFiniteNumber(entry.importance_score)
  if (rawMagnitude === undefined) return null

  const factorId =
    safeString(entry.factor_id) ??
    safeString(entry.node_id) ??
    safeString(entry.id) ??
    safeString(entry.factor_label) ??
    safeString(entry.label)
  if (!factorId) return null

  const factorLabel =
    safeString(entry.factor_label) ?? safeString(entry.label) ?? factorId

  const explicitDirection =
    entry.direction === 'positive' || entry.direction === 'negative'
      ? entry.direction
      : undefined
  const direction: 'positive' | 'negative' =
    explicitDirection ?? (rawMagnitude >= 0 ? 'positive' : 'negative')

  // Roadmap 1.7 (provisional_doctrine_v0): influence_score / influence_rank /
  // zero_reason are producer-owned fields carried through verbatim. No
  // derivation, no defaults — undefined when absent so downstream consumers
  // can distinguish "not provided" from any real value.
  const influenceScore = safeFiniteNumber(entry.influence_score)
  const influenceRank = safeFiniteNumber(entry.influence_rank)
  const zeroReason = safeString(entry.zero_reason)

  return {
    factor_id: factorId,
    factor_label: factorLabel,
    sensitivity: Math.abs(rawMagnitude),
    direction,
    ...(influenceScore !== undefined ? { influence_score: influenceScore } : {}),
    ...(influenceRank !== undefined ? { influence_rank: influenceRank } : {}),
    ...(zeroReason !== undefined ? { zero_reason: zeroReason } : {}),
  }
}

/**
 * Collect factor_sensitivity entries from top-level `enrichment.factor_sensitivity`
 * AND from per-result `enrichment.results[].factor_sensitivity[]`. Both
 * shapes are observed in the wild (staging emits top-level, the per-result
 * shape is documented in CEE's context/analysis-fallback.ts). Mirrors that
 * backend's getAllFactors/deriveTopDriversFromTopLevel precedence: an entry
 * present in BOTH shapes is deduped by `factor_id` with the higher absolute
 * sensitivity winning.
 */
function collectFactors(enrichment: Record<string, unknown>): NormalisedFactor[] {
  const byId = new Map<string, NormalisedFactor>()

  const candidates: unknown[] = []
  if (Array.isArray(enrichment.factor_sensitivity)) {
    candidates.push(...enrichment.factor_sensitivity)
  }
  if (Array.isArray(enrichment.results)) {
    for (const r of enrichment.results) {
      if (isPlainObject(r) && Array.isArray(r.factor_sensitivity)) {
        candidates.push(...r.factor_sensitivity)
      }
    }
  }

  for (const raw of candidates) {
    const norm = normaliseFactorEntry(raw)
    if (!norm) continue
    const existing = byId.get(norm.factor_id)
    if (!existing || norm.sensitivity > existing.sensitivity) {
      byId.set(norm.factor_id, norm)
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const diff = b.sensitivity - a.sensitivity
    if (diff !== 0) return diff
    return a.factor_id.localeCompare(b.factor_id)
  })
}

// ─── Confidence derivation ─────────────────────────────────────────────

function deriveConfidence(
  enrichment: Record<string, unknown> | undefined,
  factorsCount: number,
): { level: ConfidenceLevel; why: string } {
  const robustness = isPlainObject(enrichment?.robustness)
    ? enrichment!.robustness
    : undefined
  const fragileCount = Array.isArray(robustness?.fragile_edges)
    ? robustness!.fragile_edges.length
    : 0
  const robustCount = Array.isArray(robustness?.robust_edges)
    ? robustness!.robust_edges.length
    : 0
  const total = fragileCount + robustCount

  if (total === 0) {
    return {
      level: 'medium',
      why:
        factorsCount > 0
          ? `Based on ${factorsCount} sensitivity factor${factorsCount === 1 ? '' : 's'}`
          : 'Based on available data',
    }
  }

  const robustRatio = robustCount / total
  const level: ConfidenceLevel =
    robustRatio >= 0.7 ? 'high' : robustRatio >= 0.3 ? 'medium' : 'low'
  return {
    level,
    why: `${fragileCount} fragile edge${fragileCount === 1 ? '' : 's'}, ${robustCount} robust edge${robustCount === 1 ? '' : 's'}`,
  }
}

// ─── Option-level enrichment lookup ────────────────────────────────────

interface RawOptionEnrichmentEntry {
  id?: unknown
  option_id?: unknown
  label?: unknown
  option_label?: unknown
  win_probability?: unknown
  probability_of_goal?: unknown
  probability_of_joint_goal?: unknown
  confidence_interval?: unknown
  expected_outcome?: unknown
  outcome?: { mean?: unknown; p10?: unknown; p50?: unknown; p90?: unknown }
  /**
   * Provenance caveat (PLoT #204, doctrine B): present when
   * probability_of_joint_goal was scored from the constraint-target node's
   * MODELLED forward-propagated outcome distribution rather than a
   * directly-elicited base. `.passthrough()` on the schema side — carried
   * verbatim, never derived. UI-BOUNDARY-DATA-INVENTORY.md §3.2/§5.
   */
  goal_fit_basis?: { scored_from?: unknown; node_ids?: unknown }
}

interface ResolvedOptionEntry {
  optionId: string
  optionLabel: string | undefined
  enriched: RawOptionEnrichmentEntry
}

/**
 * Index enrichment.option_comparison[] (when present) — each entry carries
 * BOTH a canonical option_id (e.g. `opt_hire_local`) AND a human option_label
 * (e.g. `"Hire Two Senior Engineers Locally"`). This dual indexing is the
 * key to resolving `block.win_probabilities` keys, which in real staging
 * payloads are keyed by LABELS, not IDs (verified against
 * tests/fixtures/cross-service/v5-turn.run-analysis.staging.json on
 * 2026-04-30). The Results panel selector reads
 * `option_probabilities[canvas_node_id]` where the canvas node id is
 * `opt_hire_local`, so option_probabilities MUST be keyed by option_id —
 * NOT by the label-keyed win_probabilities Record verbatim.
 */
function resolveOptionEntries(
  enrichment: Record<string, unknown> | undefined,
): ResolvedOptionEntry[] {
  const raw = enrichment?.option_comparison
  if (!Array.isArray(raw)) return []
  const out: ResolvedOptionEntry[] = []
  for (const entry of raw) {
    if (!isPlainObject(entry)) continue
    const e = entry as RawOptionEnrichmentEntry
    const optionId = safeString(e.id) ?? safeString(e.option_id)
    if (!optionId) continue
    const optionLabel = safeString(e.option_label) ?? safeString(e.label)
    out.push({ optionId, optionLabel, enriched: e })
  }
  return out
}

// ─── Public mapper ─────────────────────────────────────────────────────

export interface MapV5AnalysisOptions {
  /** Seed used for the run. Defaults to 0 when caller has none. */
  seed?: number
  /**
   * Optional override for response_hash. When omitted the hash is derived
   * deterministically from the block (summary + leading_option_id +
   * win_probabilities + canonical-serialised enrichment) so identical
   * analyses dedupe in the store, but enrichment-only deltas (updated
   * factor_sensitivity / robustness / option_comparison with unchanged
   * probabilities) still produce a distinct hash and re-hydrate.
   */
  responseHash?: string
}

/**
 * Map a V5 analysis_result block to a ReportV1 shape. The store's
 * `report` slice is widened by index signature in consumers (see
 * useAnalysisResults.ts InspectorReport interface and
 * useResultsSectionData.ts ResultsReport type), so this mapper returns the
 * `ReportV1` core fields PLUS the auxiliary V4-mapper fields (option_probabilities,
 * factor_sensitivity, robustness, drivers_status, robustness_status,
 * warnings) the main Results panel reads.
 */
export function mapV5AnalysisToReport(
  block: AnalysisResultBlock,
  options: MapV5AnalysisOptions = {},
): ReportV1 {
  const seed = options.seed ?? 0
  const enrichment = isPlainObject(block.enrichment) ? block.enrichment : undefined

  // Factor sensitivity — collected and ranked once; reused for drivers + factor_sensitivity passthrough.
  const factors = enrichment ? collectFactors(enrichment) : []
  const drivers = factors.slice(0, 5).map((f) => ({
    label: f.factor_label,
    polarity:
      f.direction === 'positive' ? ('up' as const) : ('down' as const),
    strength:
      f.sensitivity >= 0.7
        ? ('high' as const)
        : f.sensitivity >= 0.3
          ? ('medium' as const)
          : ('low' as const),
    contribution: f.sensitivity,
    nodeId: f.factor_id,
  }))

  const confidence = deriveConfidence(enrichment, factors.length)

  // Option probabilities — keyed by canonical option_id when
  // `enrichment.option_comparison` is present (the source of truth). When
  // absent, fall back to keying by `block.win_probabilities` keys verbatim
  // — those may be labels in real staging payloads, in which case the
  // downstream Results-panel lookup at useResultsSectionData.ts:1042
  // (`optionProbs[node.id]`) will honestly miss rather than silently
  // mismatch.
  const resolvedOptions = resolveOptionEntries(enrichment)
  const winProbs = block.win_probabilities ?? {}

  type ResultsOptionProbability = {
    goal_probability?: number
    probability_of_joint_goal?: number
    confidence: number
    win_probability?: number
    expected?: number
    outcome?: {
      mean?: number | null
      p10?: number | null
      p50?: number | null
      p90?: number | null
    }
    /**
     * Provenance caveat for probability_of_joint_goal — see
     * RawOptionEnrichmentEntry.goal_fit_basis above. Carried verbatim
     * (scored_from is producer-owned open vocabulary; UI never rewrites
     * it). Render sites MUST show this alongside the joint-goal number
     * per the honesty rule in UI-BOUNDARY-DATA-INVENTORY.md §5.
     */
    goal_fit_basis?: { scored_from?: string; node_ids?: string[] }
  }
  const option_probabilities: Record<string, ResultsOptionProbability> = {}

  // Resolution path A: option_comparison is the canonical source.
  // For each entry, look up win_probability in three places:
  //   1. enrichment.option_comparison[*].win_probability (canonical)
  //   2. block.win_probabilities[option_id]  (block-keyed-by-id)
  //   3. block.win_probabilities[option_label] (block-keyed-by-label,
  //      real staging behaviour as of 2026-04-30 build 3bb151b) — ONLY
  //      when the label is unique among option_comparison entries.
  //      Duplicate labels with no per-entry win_probability collapse to
  //      undefined rather than to a shared value: a label-keyed Record
  //      cannot disambiguate two options that share a label, and
  //      rendering both at the same number is false precision, not
  //      "honest miss". See duplicate-label tests for the contract.
  // Path B (no option_comparison): emit entries keyed by win_probabilities
  // keys verbatim. Honest miss in the Results panel when those keys are
  // labels.
  const labelOccurrences = new Map<string, number>()
  for (const r of resolvedOptions) {
    if (r.optionLabel !== undefined) {
      labelOccurrences.set(r.optionLabel, (labelOccurrences.get(r.optionLabel) ?? 0) + 1)
    }
  }
  const labelIsUnique = (label: string | undefined): label is string =>
    label !== undefined && (labelOccurrences.get(label) ?? 0) === 1

  const iterator: Array<{ optionId: string; enriched: RawOptionEnrichmentEntry | undefined; label: string | undefined }> =
    resolvedOptions.length > 0
      ? resolvedOptions.map((r) => ({
          optionId: r.optionId,
          enriched: r.enriched,
          label: r.optionLabel,
        }))
      : Object.keys(winProbs).map((k) => ({ optionId: k, enriched: undefined, label: undefined }))

  for (const { optionId, enriched, label } of iterator) {
    const winProb =
      safeFiniteNumber(enriched?.win_probability) ??
      safeFiniteNumber(winProbs[optionId]) ??
      (labelIsUnique(label) ? safeFiniteNumber(winProbs[label]) : undefined)

    const ci = Array.isArray(enriched?.confidence_interval)
      ? enriched.confidence_interval
      : null
    const ciLow =
      ci && safeFiniteNumber(ci[0]) !== undefined ? (ci[0] as number) : null
    const ciHigh =
      ci && safeFiniteNumber(ci[1]) !== undefined ? (ci[1] as number) : null
    const ciMid =
      ciLow != null && ciHigh != null ? (ciLow + ciHigh) / 2 : null

    const outcome = isPlainObject(enriched?.outcome) ? enriched.outcome : undefined
    const rawMean = safeFiniteNumber(outcome?.mean)
    const rawExpected = safeFiniteNumber(enriched?.expected_outcome)
    const expected = rawMean ?? rawExpected ?? ciMid ?? undefined

    const p10 = safeFiniteNumber(outcome?.p10) ?? ciLow
    const p50 = safeFiniteNumber(outcome?.p50) ?? null
    const p90 = safeFiniteNumber(outcome?.p90) ?? ciHigh

    const goalFitBasis = normaliseGoalFitBasis(enriched?.goal_fit_basis)

    option_probabilities[optionId] = {
      // No silent defaults — undefined when missing.
      ...(safeFiniteNumber(enriched?.probability_of_goal) !== undefined
        ? { goal_probability: safeFiniteNumber(enriched?.probability_of_goal) }
        : {}),
      ...(safeFiniteNumber(enriched?.probability_of_joint_goal) !== undefined
        ? {
            probability_of_joint_goal: safeFiniteNumber(
              enriched?.probability_of_joint_goal,
            ),
          }
        : {}),
      // Provenance caveat for probability_of_joint_goal — see
      // normaliseGoalFitBasis. Carried alongside the number it qualifies;
      // render sites must show both together (UI-BOUNDARY-DATA-INVENTORY §5).
      ...(goalFitBasis !== undefined ? { goal_fit_basis: goalFitBasis } : {}),
      confidence: 0.5,
      ...(winProb !== undefined ? { win_probability: winProb } : {}),
      ...(expected !== undefined ? { expected } : {}),
      outcome: {
        mean: rawMean ?? null,
        p10: p10 ?? null,
        p50,
        p90: p90 ?? null,
      },
    }
  }

  // Robustness passthrough — enrichment.robustness when present.
  const robustnessRaw = isPlainObject(enrichment?.robustness)
    ? enrichment!.robustness
    : undefined
  const robustness = robustnessRaw
    ? {
        fragile_edges: Array.isArray(robustnessRaw.fragile_edges)
          ? robustnessRaw.fragile_edges
          : [],
        robust_edges: Array.isArray(robustnessRaw.robust_edges)
          ? robustnessRaw.robust_edges
          : [],
        ...(safeFiniteNumber(robustnessRaw.ranking_stability) !== undefined
          ? { ranking_stability: safeFiniteNumber(robustnessRaw.ranking_stability) }
          : {}),
        ...(safeFiniteNumber(robustnessRaw.recommendation_stability) !== undefined
          ? {
              recommendation_stability: safeFiniteNumber(
                robustnessRaw.recommendation_stability,
              ),
            }
          : {}),
        ...(typeof robustnessRaw.is_robust === 'boolean'
          ? { is_robust: robustnessRaw.is_robust }
          : {}),
        ...(safeString(robustnessRaw.level) !== undefined
          ? { level: safeString(robustnessRaw.level) }
          : {}),
        ...(safeString(robustnessRaw.recommended_option_id) !== undefined
          ? {
              recommended_option_id: safeString(
                robustnessRaw.recommended_option_id,
              ),
            }
          : {}),
        ...(Array.isArray(robustnessRaw.flip_thresholds)
          ? { flip_thresholds: robustnessRaw.flip_thresholds }
          : {}),
        ...(Array.isArray(robustnessRaw.edge_e_values)
          ? { edge_e_values: robustnessRaw.edge_e_values }
          : {}),
        ...(Array.isArray(robustnessRaw.conditional_winners)
          ? { conditional_winners: robustnessRaw.conditional_winners }
          : {}),
        // Display-honesty (ROADMAP 1.6b; producer PLoT #202): display-safe
        // verdict + producer-owned reason, rendered VERBATIM. ON-WIRE on
        // Seam A (CEE compose.ts keep-list carries `robustness` whole) but
        // previously dropped here — the whole conversational path fell to
        // "Robustness unknown". useResultsSectionData.ts already reads
        // report.robustness.display_verdict as its Seam-B-absent fallback
        // (rawRobustnessDisplayVerdict ?? robustness?.display_verdict), so
        // populating this slot is sufficient — no render-site change needed.
        ...(safeString(robustnessRaw.display_verdict) !== undefined
          ? { display_verdict: safeString(robustnessRaw.display_verdict) }
          : {}),
        ...(safeString(robustnessRaw.display_verdict_reason) !== undefined
          ? {
              display_verdict_reason: safeString(
                robustnessRaw.display_verdict_reason,
              ),
            }
          : {}),
      }
    : undefined

  // Top-level enrichment fields that live alongside robustness in V4 output.
  const topLevelFlipThresholds = Array.isArray(enrichment?.flip_thresholds)
    ? (enrichment!.flip_thresholds as unknown[])
    : undefined
  const topLevelEdgeEValues = Array.isArray(enrichment?.edge_e_values)
    ? (enrichment!.edge_e_values as unknown[])
    : undefined
  const conditionalProbabilities = enrichment?.conditional_probabilities

  // Roadmap 1.12: producer inference_warnings ({ code, message, severity })
  // pass through verbatim so the Analysis tab can surface warning-severity
  // entries. Top-level `enrichment.inference_warnings` is the live V5 wire
  // location (captured bundle olumi-debug-45c9b625-20260707); the V4 mapper
  // reads the same field from robustness (responseMapper.ts:563) and the
  // selector accepts both slots. Passthrough only — the UI never rewrites
  // codes, messages, or severities.
  const inferenceWarnings = Array.isArray(enrichment?.inference_warnings)
    ? (enrichment!.inference_warnings as unknown[])
    : undefined

  // Display-honesty (ROADMAP 1.6b; producer PLoT #202): top-level
  // producer-classified confidence tier. ON-WIRE on Seam A (`confidence_tier`
  // is one of the 11 keys in CEE's P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP
  // compose.ts keep-list) but previously never read here, so
  // useResultsSectionData's getConfidenceTier(report?.confidence_tier, ...)
  // always fell to the legacy readiness cascade on the conversational path.
  // Carried verbatim; the consumer already gates to the closed
  // strong/fair/needs_work union before trusting it.
  const confidenceTier = safeString(enrichment?.confidence_tier)

  // constraints_status (PLoT #205): per-run constraint-evaluation feature
  // status. Read defensively for forward-compatibility, but AS OF THIS
  // LANE it is NOT on the CEE→UI wire for Seam A — constraints_status is
  // absent from CEE's compose.ts P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP
  // (verified against the 11-key list; only reaches the UI today via the
  // Seam-B raw V2 response, see useConversation.ts:1925 which reads it for
  // CEE-context building, not user display). This line is a no-op until a
  // CEE lane adds constraints_status to the keep-list — tracked as a
  // residual (UI-BOUNDARY-DATA-INVENTORY.md §4 item 5). Kept here so no
  // further UI change is needed once that lands.
  const constraintsStatus = safeString(enrichment?.constraints_status)

  // Deterministic response_hash when caller has none. Stable across identical
  // blocks so the store's hash-dedupe in resultsComplete works.
  //
  // Includes the full enrichment payload (stable-serialised) so two blocks
  // with the same summary + leading_option_id + win_probabilities but
  // changed factor_sensitivity / robustness / option_comparison produce
  // DIFFERENT hashes and re-hydrate the Results panel. Earlier drafts hashed
  // only the top-level keys, which let enrichment-only deltas (legitimate
  // re-analysis with same probabilities) silently dedupe.
  const responseHash =
    options.responseHash ??
    deriveBlockHash({
      summary: block.summary,
      leading_option_id: block.leading_option_id,
      win_probabilities: winProbs,
      enrichment: block.enrichment,
    })

  // Headline `results` triple (conservative/likely/optimistic) is consumed
  // by DetailedAnalysisSection, DecisionSummary, OutcomesSignal, and
  // TemplatesPanel as the p10 / p50 / p90 of the headline option's outcome
  // distribution. V4 derives these from the FIRST option's confidence_interval
  // and emits `null` when the CI is absent (passing through the type's
  // declared `number` via implicit narrowing — see
  // src/adapters/plot/v2/responseMapper.ts:486-490). The V5 mapper mirrors
  // that contract: prefer the LEADING option's outcome (semantically more
  // meaningful than "first by array order"), fall back to the first
  // option_comparison entry, and surface `null` when neither has usable
  // quantiles. Fabricated zeros — earlier behaviour — would mislead every
  // consumer to render "0" instead of "no data".
  const headlineOption = (() => {
    if (resolvedOptions.length === 0) return undefined
    if (block.leading_option_id) {
      const byLeader = resolvedOptions.find((r) => r.optionId === block.leading_option_id)
      if (byLeader) return byLeader
    }
    return resolvedOptions[0]
  })()
  const headlineOutcome = isPlainObject(headlineOption?.enriched.outcome)
    ? headlineOption!.enriched.outcome
    : undefined
  const headlineCI = Array.isArray(headlineOption?.enriched.confidence_interval)
    ? headlineOption!.enriched.confidence_interval
    : null
  const headlineCiLow =
    headlineCI && safeFiniteNumber(headlineCI[0]) !== undefined
      ? (headlineCI[0] as number)
      : null
  const headlineCiHigh =
    headlineCI && safeFiniteNumber(headlineCI[1]) !== undefined
      ? (headlineCI[1] as number)
      : null
  const headlineConservative = safeFiniteNumber(headlineOutcome?.p10) ?? headlineCiLow
  const headlineLikely =
    safeFiniteNumber(headlineOutcome?.p50) ??
    safeFiniteNumber(headlineOutcome?.mean) ??
    (headlineCiLow != null && headlineCiHigh != null ? (headlineCiLow + headlineCiHigh) / 2 : null)
  const headlineOptimistic = safeFiniteNumber(headlineOutcome?.p90) ?? headlineCiHigh

  const report: ReportV1 = {
    schema: 'report.v1',
    meta: {
      seed,
      response_id: responseHash,
      elapsed_ms: 0,
    },
    model_card: {
      response_hash: responseHash,
      response_hash_algo: 'sha256',
      normalized: true,
    },
    // Type lies (number, not number | null) — V4 does the same. Downstream
    // consumers narrow-check before display; passing fabricated 0 here
    // would render as "0" in DetailedAnalysisSection / DecisionSummary etc.
    results: {
      conservative: headlineConservative as unknown as number,
      likely: headlineLikely as unknown as number,
      optimistic: headlineOptimistic as unknown as number,
    },
    confidence,
    drivers,
  }

  // Auxiliary fields the main Results panel + inspector helpers read via
  // the widened ResultsReport / InspectorReport index signatures. These are
  // NOT on ReportV1 but are written onto the same record by the V4 mapper.
  const widened = report as ReportV1 & Record<string, unknown>
  if (factors.length > 0) {
    widened.factor_sensitivity = factors.map((f) => ({
      factor_id: f.factor_id,
      factor_label: f.factor_label,
      sensitivity: f.sensitivity,
      direction: f.direction,
      // Roadmap 1.7 additive passthrough (provisional_doctrine_v0):
      // influence_score / influence_rank / zero_reason reach the store so
      // the DriversSection "Influence" column renders the PRODUCER's
      // influence measure instead of falling back to a UI-normalised
      // sensitivity (influence ≠ sensitivity). Omitted when absent.
      ...(f.influence_score !== undefined ? { influence_score: f.influence_score } : {}),
      ...(f.influence_rank !== undefined ? { influence_rank: f.influence_rank } : {}),
      ...(f.zero_reason !== undefined ? { zero_reason: f.zero_reason } : {}),
    }))
  }
  if (robustness) widened.robustness = robustness
  if (topLevelFlipThresholds) widened.flip_thresholds = topLevelFlipThresholds
  if (topLevelEdgeEValues) widened.edge_e_values = topLevelEdgeEValues
  if (confidenceTier !== undefined) widened.confidence_tier = confidenceTier
  if (constraintsStatus !== undefined) widened.constraints_status = constraintsStatus
  if (inferenceWarnings) widened.inference_warnings = inferenceWarnings
  if (conditionalProbabilities !== undefined) {
    widened.conditional_probabilities = conditionalProbabilities
  }
  if (block.leading_option_id != null) {
    widened.leading_option_id = block.leading_option_id
  }
  if (Object.keys(option_probabilities).length > 0) {
    // ReportV1 declares `option_probabilities` as Record<string, OptionProbability>
    // where OptionProbability.goal_probability is required. The V4 mapper widens
    // the slot at runtime (responseMapper.ts:627-640) with an inline cast so
    // missing goal_probability surfaces as undefined rather than a fabricated 0.
    // Mirror that contract here — the consumer (ResultsReport in
    // src/components/results/types.ts:777) explicitly widens this field.
    widened.option_probabilities = option_probabilities as unknown as ReportV1['option_probabilities']
  }

  // Inspector-facing `option_comparison` passthrough. The right-hand
  // OutcomePanel.OptionComparisonSection at
  // src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx:70 reads
  // `r?.option_comparison as OptionComparisonEntry[]` and renders
  // ranked rows with win-probability bars. The V4 mapper never
  // populated this field (it is a pre-existing gap on V4); the V5
  // enrichment carries `option_comparison` byte-for-byte from PLoT,
  // so the V5 path can fix the inspector without changing OutcomePanel.
  // Shape narrowed to the OutcomePanel-consumed subset
  // (option_id, option_label, win_probability, outcome) — extra
  // enrichment fields are deliberately dropped so they don't leak
  // into the inspector's DOM.
  if (resolvedOptions.length > 0) {
    type InspectorOptionComparison = {
      option_id: string
      option_label?: string
      win_probability?: number
      expected_outcome?: number
      outcome?: {
        mean?: number | null
        p10?: number | null
        p50?: number | null
        p90?: number | null
      }
    }
    const optionComparison: InspectorOptionComparison[] = resolvedOptions.map(
      ({ optionId, optionLabel, enriched }) => {
        const entry: InspectorOptionComparison = { option_id: optionId }
        if (optionLabel) entry.option_label = optionLabel
        // Mirror the duplicate-label guard from the option_probabilities
        // resolution: labels shared by multiple option_comparison entries
        // must NOT use the label-keyed winProbs fallback, because the
        // OutcomePanel would render multiple rows at the same numeric
        // probability — false precision from ambiguous source data.
        const winProb =
          safeFiniteNumber(enriched.win_probability) ??
          safeFiniteNumber(winProbs[optionId]) ??
          (labelIsUnique(optionLabel) ? safeFiniteNumber(winProbs[optionLabel]) : undefined)
        if (winProb !== undefined) entry.win_probability = winProb
        const expected = safeFiniteNumber(enriched.expected_outcome)
        if (expected !== undefined) entry.expected_outcome = expected
        const outcome = isPlainObject(enriched.outcome) ? enriched.outcome : undefined
        if (outcome) {
          const mean = safeFiniteNumber(outcome.mean)
          const p10 = safeFiniteNumber(outcome.p10)
          const p50 = safeFiniteNumber(outcome.p50)
          const p90 = safeFiniteNumber(outcome.p90)
          if (mean !== undefined || p10 !== undefined || p50 !== undefined || p90 !== undefined) {
            entry.outcome = {
              mean: mean ?? null,
              p10: p10 ?? null,
              p50: p50 ?? null,
              p90: p90 ?? null,
            }
          }
        }
        return entry
      },
    )
    widened.option_comparison = optionComparison
    // OutcomePanel also checks option_comparison_status. Mirror the
    // top-level enrichment field when present so error/pending states
    // pass through verbatim.
    const ocStatus = safeString(enrichment?.option_comparison_status)
    if (ocStatus !== undefined) widened.option_comparison_status = ocStatus
  }
  if (block.summary.length > 0) {
    widened.summary = block.summary
  }

  return report
}

/**
 * Stable serialiser used by deriveBlockHash. Sorts object keys at every
 * nesting level so the resulting string is byte-identical for two values
 * that differ only by key-insertion order — meaning incidental object-key
 * reordering does not invalidate dedupe, but genuine content changes
 * (updated factor_sensitivity, etc.) do.
 *
 * NOT strictly JSON-canonical (a real wire payload coming through
 * JSON.parse cannot contain `undefined` or symbols, but defensive
 * production callers might pass them in). Both `undefined` and `null`
 * serialise to `"null"` here, and unsupported types (functions, symbols)
 * also map to `"null"`. The hash purpose is content equality, and
 * collapsing JSON-unrepresentable values to a single sentinel is honest
 * for that purpose. Object properties whose value is `undefined` are
 * preserved in the key order rather than omitted (JSON would drop them)
 * so the serialisation stays sensitive to "this key exists but is
 * unset" vs "this key is absent" — both rare for the wire payload but
 * relevant if a caller hands us a synthesised block.
 */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null) return 'null'
  if (typeof value === 'function' || typeof value === 'symbol') return 'null'
  if (typeof value !== 'object') {
    const serialised = JSON.stringify(value)
    // JSON.stringify can return undefined for e.g. NaN/Infinity wrapped
    // in unsupported contexts; collapse to "null" for hash purposes.
    return serialised ?? 'null'
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') +
    '}'
  )
}

/**
 * Deterministic 16-hex-char hash derived from block content INCLUDING the
 * full enrichment payload. Stable across identical inputs so the store's
 * hash-dedupe path doesn't double-write, and DISTINCT for any block whose
 * enrichment differs (so re-runs that produce updated drivers / robustness
 * / option_comparison hydrate the Results panel fresh).
 *
 * Lightweight non-crypto digest — collisions are extremely unlikely across
 * the population of analysis blocks a single session produces, and the
 * dedupe is best-effort (a collision wastes one set() call, not user data).
 */
function deriveBlockHash(parts: {
  summary: string
  leading_option_id: string | null
  win_probabilities: Record<string, number>
  enrichment: Record<string, unknown> | undefined
}): string {
  // Canonicalise win_probabilities key order so identical content hashes
  // regardless of object key insertion order.
  const sortedProbs = Object.keys(parts.win_probabilities)
    .sort()
    .map((k) => `${k}:${parts.win_probabilities[k]}`)
    .join(',')
  const enrichmentSerialised = stableStringify(parts.enrichment ?? null)
  const seed = `${parts.summary}|${parts.leading_option_id ?? ''}|${sortedProbs}|${enrichmentSerialised}`

  // FNV-1a 64-bit (BigInt) — deterministic, no crypto dependency.
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < seed.length; i++) {
    h ^= BigInt(seed.charCodeAt(i))
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return `v5:${h.toString(16).padStart(16, '0')}`
}
