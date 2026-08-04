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

import type { ReportV1, ConfidenceLevel, CritiqueItemV1 } from '../adapters/plot/types'
import type { DecisionVerdictReportLike } from '../lib/decisionVerdict'
import {
  factorDirectionToPolarity,
  normaliseFactorDirection,
  type FactorDirection,
} from '../lib/factorDirection'

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Projected-critique severity → the consumer union (CritiqueItemV1.severity,
 * adapters/plot/types.ts:304). The CEE→UI wire carries the lowercase V2 union
 * 'info'|'warning'|'error'|'blocker'; the Results consumers filter on the
 * UPPERCASE V4 values (useResultsSectionData.ts:2454 matches 'WARNING' only),
 * so a lowercase pass-through would silently drop every projected row from
 * the uncertainties list. 'error' folds into 'BLOCKER' (the union has no
 * ERROR member); unknown/absent severities fold to 'INFO' — conservative:
 * an unclassifiable disclosure must not inflate the warning banner.
 */
function mapProjectedCritiqueSeverity(v: unknown): CritiqueItemV1['severity'] {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (s === 'warning') return 'WARNING'
  if (s === 'error' || s === 'blocker') return 'BLOCKER'
  return 'INFO'
}

/**
 * Map CEE-projected critique rows to the canonical `run.critique` slot shape.
 * Keeps ONLY rows with a non-empty `code` AND a non-empty `user_message` —
 * the projection guarantees both on every surviving row, and a row without
 * display-safe copy has nothing honest to render (`message` never arrives on
 * this wire; it is withheld internal wording). `message` is populated FROM
 * `user_message` so every existing consumer of the slot renders the
 * display-safe copy; `user_message` also rides along verbatim for the
 * humaniser's userMessage-first path.
 */
function mapProjectedCritiques(
  raw: unknown[],
): Array<CritiqueItemV1 & { user_message: string }> {
  const out: Array<CritiqueItemV1 & { user_message: string }> = []
  for (const r of raw) {
    if (!isPlainObject(r)) continue
    const code = safeString(r.code)
    const userMessage = safeString(r.user_message)
    if (!code || !userMessage) continue
    const item: CritiqueItemV1 & { user_message: string } = {
      severity: mapProjectedCritiqueSeverity(r.severity),
      message: userMessage,
      user_message: userMessage,
      code,
    }
    const nodeId = Array.isArray(r.affected_node_ids)
      ? safeString(r.affected_node_ids[0])
      : undefined
    if (nodeId) item.node_id = nodeId
    const suggestion = safeString(r.suggestion)
    if (suggestion) item.suggested_fix = suggestion
    out.push(item)
  }
  return out
}

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
  /**
   * The producer's direction, carried VERBATIM across the contract's full
   * domain, or `null` when the producer sent none (ROADMAP 2.234).
   *
   * ⚠ This used to be `'positive' | 'negative'` with a sign fallback, and the
   * narrowing was a false-claim generator: `sensitivity` above is an absolute
   * magnitude, so `mixed`, `unknown` and absent all collapsed to `'positive'`
   * → `polarity: 'up'` → "increases the outcome". Never infer direction from
   * a magnitude; see `src/lib/factorDirection.ts`.
   */
  direction: FactorDirection | null
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
  /**
   * EVPI family (value-of-information), producer-owned. P0 F5: the live V5
   * mapper previously stripped all four before the store, so the EVPI/VoI
   * surfaces went dark on the conversational path (the V4 mapper preserves
   * them — responseMapper.ts:281,336 — and ModelTabBody.tsx:209-217 renders
   * the EVPI map from `evpi_percentage_points` ?? `value_of_information * 100`;
   * useResultsSectionData.ts:358 reads `value_of_information`). Additive
   * passthrough only — never derived, never defaulted, never scaled; a real
   * 0 is data (a below-resolution EVPI), an absent field stays absent.
   */
  value_of_information?: number
  evpi_percentage_points?: number
  evpi_method?: string
  evpi_status?: string
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

  // ROADMAP 2.234 — the producer's direction, or nothing. The line that used
  // to sit here read
  //   `explicitDirection ?? (rawMagnitude >= 0 ? 'positive' : 'negative')`
  // and `rawMagnitude` is picked from `sensitivity_score ?? sensitivity ??
  // elasticity ?? importance_score`, which are ordinarily NON-NEGATIVE — so
  // every `mixed`, every `unknown` and every absent direction silently became
  // a positive causal claim. There is no inference here any more.
  const direction = normaliseFactorDirection(entry.direction)

  // Roadmap 1.7 (provisional_doctrine_v0): influence_score / influence_rank /
  // zero_reason are producer-owned fields carried through verbatim. No
  // derivation, no defaults — undefined when absent so downstream consumers
  // can distinguish "not provided" from any real value.
  const influenceScore = safeFiniteNumber(entry.influence_score)
  const influenceRank = safeFiniteNumber(entry.influence_rank)
  const zeroReason = safeString(entry.zero_reason)

  // P0 F5: EVPI family (value-of-information) carried through verbatim. No
  // derivation, no defaults, no scaling — safeFiniteNumber(0) === 0 preserves
  // a real below-resolution EVPI, while an absent field yields undefined so
  // the conditional spread omits the key (fail closed).
  const valueOfInformation = safeFiniteNumber(entry.value_of_information)
  const evpiPercentagePoints = safeFiniteNumber(entry.evpi_percentage_points)
  const evpiMethod = safeString(entry.evpi_method)
  const evpiStatus = safeString(entry.evpi_status)

  return {
    factor_id: factorId,
    factor_label: factorLabel,
    sensitivity: Math.abs(rawMagnitude),
    direction,
    ...(influenceScore !== undefined ? { influence_score: influenceScore } : {}),
    ...(influenceRank !== undefined ? { influence_rank: influenceRank } : {}),
    ...(zeroReason !== undefined ? { zero_reason: zeroReason } : {}),
    ...(valueOfInformation !== undefined ? { value_of_information: valueOfInformation } : {}),
    ...(evpiPercentagePoints !== undefined ? { evpi_percentage_points: evpiPercentagePoints } : {}),
    ...(evpiMethod !== undefined ? { evpi_method: evpiMethod } : {}),
    ...(evpiStatus !== undefined ? { evpi_status: evpiStatus } : {}),
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

  // ⭐ PRODUCER ORDER IS PRESERVED (ROADMAP 2.235, cheap half).
  //
  // This used to end with
  //   `.sort((a, b) => b.sensitivity - a.sensitivity || a.factor_id.localeCompare(b.factor_id))`
  // and that sort was a claim the UI is not entitled to make. PLoT owns the
  // one canonical order and says so in its own source: "ISL measures · PLoT
  // orders + attests · CEE permits + projects · UI renders WITHOUT reordering"
  // (`plot-lite-service/src/lib/driver-order.ts:1-14`). The emitted
  // `factor_sensitivity[]` order IS the ranking, and on a mixed graph/ISL run
  // PLoT appends the ISL-only rows WITHOUT a global re-sort precisely because
  // `influence_score`, `sensitivity_score` and `elasticity` are
  // incommensurable — so re-sorting by magnitude ranked unlike quantities
  // against each other and then crowned the top five as Drivers. The audit's
  // payload `[graph A=.2, graph B=.1, ISL-only C=.9]` rendered `C, A, B`.
  //
  // A `Map` preserves INSERTION order, and `set` on an existing key does not
  // move it — so the de-dupe above keeps a row at its top-level position even
  // when a per-result copy wins on magnitude. Insertion order here is
  // top-level rows first, then per-result rows, which is the producer's own
  // precedence.
  //
  // ⚠ SCOPE. This preserves the order; it does not VERIFY it. Typing and
  // transporting `driver_order` and failing closed when `ranked_factor_ids`
  // disagrees with the transported rows is a schemas → CEE → UI train, rowed
  // separately. Nothing here checks the producer's attestation.
  return Array.from(byId.values())
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

/**
 * Fallback id↔label source: `enrichment.decision_brief.options[]`, whose
 * entries carry `option_id` + `label`. Used ONLY when `option_comparison` is
 * absent (it can be — the wire carries a sibling `option_comparison_status`
 * precisely because that array is not guaranteed). Both sources are supplied
 * by the producer on the same payload, so this is a fallback chain over
 * derived data, NOT a second hand-maintained mapping.
 */
function resolveDecisionBriefOptions(
  enrichment: Record<string, unknown> | undefined,
): ResolvedOptionIdentity[] {
  const brief = isPlainObject(enrichment?.decision_brief)
    ? (enrichment!.decision_brief as Record<string, unknown>)
    : undefined
  const raw = brief?.options
  if (!Array.isArray(raw)) return []
  const out: ResolvedOptionIdentity[] = []
  for (const entry of raw) {
    if (!isPlainObject(entry)) continue
    const optionId = safeString(entry.option_id) ?? safeString(entry.id)
    if (!optionId) continue
    out.push({ optionId, label: safeString(entry.label) ?? safeString(entry.option_label) })
  }
  return out
}

interface ResolvedOptionIdentity {
  optionId: string
  label: string | undefined
}

/**
 * Resolve every `block.win_probabilities` KEY that denotes the leading option.
 *
 * The two fields live in DIFFERENT IDENTITY SPACES. `leading_option_id` is an
 * option ID (`opt_mac`); `win_probabilities` is keyed by option LABEL
 * (`"Standardise on MacBook Pro"`) on real staging payloads — the same fact
 * `resolveOptionEntries` above was written for. Comparing a map key to
 * `leading_option_id` directly therefore matches NOTHING whenever the producer
 * keys by label: no error, no warning, the leader simply never gets marked.
 * That is an UNDER-claim, and it made the leader treatment in
 * V5AnalysisResultBlock unreachable in production.
 *
 * Callers iterating `Object.entries(win_probabilities)` test membership of this
 * set instead, so they work under EITHER keying without having to know which
 * one the producer used. The id↔label pairing is derived from the same wire
 * payload (`enrichment.option_comparison[]`, falling back to
 * `enrichment.decision_brief.options[]`) — there is no second mapping for
 * anyone to keep in sync.
 *
 * Fails closed in both directions — this must never become an OVER-claim:
 *   - `leadingOptionId` null/absent/empty → EMPTY set → no key is a leader.
 *     This is the withheld-turn contract; CEE sends `leading_option_id: null`
 *     when the leader is suppressed and no pill may be marked.
 *   - a leader label shared by more than one option → the label is omitted.
 *     A label-keyed Record cannot disambiguate two options sharing a label;
 *     marking both pills as leader is false precision, marking neither is an
 *     honest miss. Same rule, same reason as the `labelIsUnique` guard used
 *     for option_probabilities below.
 */
/**
 * The option rows to emit, in the mapper's own precedence order.
 *
 * Path A — `enrichment.option_comparison` is present: one row per entry,
 * keyed by canonical option_id.
 * Path B — absent: one row per `block.win_probabilities` key, verbatim (those
 * keys may be labels; the Results-panel lookup then honestly misses).
 */
function optionIterator(
  resolvedOptions: ResolvedOptionEntry[],
  winProbs: Record<string, number>,
): Array<{ optionId: string; enriched: RawOptionEnrichmentEntry | undefined; label: string | undefined }> {
  return resolvedOptions.length > 0
    ? resolvedOptions.map((r) => ({
        optionId: r.optionId,
        enriched: r.enriched,
        label: r.optionLabel,
      }))
    : Object.keys(winProbs).map((k) => ({ optionId: k, enriched: undefined, label: undefined }))
}

/**
 * option_id → win probability, resolved in ONE place from the three producer
 * locations, in precedence order:
 *   1. `enrichment.option_comparison[*].win_probability` (canonical)
 *   2. `block.win_probabilities[option_id]` (block keyed by id)
 *   3. `block.win_probabilities[option_label]` (block keyed by label — real
 *      staging behaviour) — ONLY when that label is unique among the
 *      option_comparison entries. Duplicate labels with no per-entry value
 *      collapse to ABSENT rather than to a shared number: a label-keyed
 *      Record cannot disambiguate two options that share a label, and
 *      rendering both at the same probability is false precision, not an
 *      honest miss.
 *
 * A key is present in the returned map only when a finite value resolved, so
 * callers keep their `!== undefined` emit guards and never write a default.
 *
 * Extracted (ROADMAP 1.267) because this rule previously existed TWICE in
 * this file — once here and once, by hand, in the inspector's
 * `option_comparison` build, whose comment said "Mirror the duplicate-label
 * guard". A rule a human must remember to keep in sync is the repo's dominant
 * defect class; the verdict derivation below would have made it a third copy.
 */
function resolveWinProbabilitiesById(
  candidates: WinProbabilityCandidate[],
  winProbs: Record<string, number>,
): Map<string, number> {
  const labelOccurrences = new Map<string, number>()
  for (const c of candidates) {
    if (c.optionLabel !== undefined) {
      labelOccurrences.set(c.optionLabel, (labelOccurrences.get(c.optionLabel) ?? 0) + 1)
    }
  }
  const labelIsUnique = (label: string | undefined): label is string =>
    label !== undefined && (labelOccurrences.get(label) ?? 0) === 1

  const out = new Map<string, number>()
  for (const { optionId, optionLabel, ownWinProbability } of candidates) {
    const winProb =
      ownWinProbability ??
      safeFiniteNumber(winProbs[optionId]) ??
      (labelIsUnique(optionLabel) ? safeFiniteNumber(winProbs[optionLabel]) : undefined)
    if (winProb !== undefined) out.set(optionId, winProb)
  }
  return out
}

/**
 * One option as the win-probability join sees it: its canonical id, its label
 * (for the duplicate-label guard) and the producer's OWN per-entry
 * probability when one was sent. Narrower than `ResolvedOptionEntry` on
 * purpose — the join reads three fields, and the verdict view assembles
 * candidates from `decision_brief.options[]`, which is not an
 * `option_comparison` entry and must not have to pretend to be one.
 */
interface WinProbabilityCandidate {
  optionId: string
  optionLabel: string | undefined
  ownWinProbability: number | undefined
}

/** Candidates from the mapper's own precedence order (paths A and B). */
function winProbabilityCandidates(
  resolvedOptions: ResolvedOptionEntry[],
  winProbs: Record<string, number>,
): WinProbabilityCandidate[] {
  return optionIterator(resolvedOptions, winProbs).map(({ optionId, enriched, label }) => ({
    optionId,
    optionLabel: label,
    ownWinProbability: safeFiniteNumber(enriched?.win_probability),
  }))
}

/**
 * The `decision_brief.options[]` entry for one option id, narrowed to the
 * single field the win-probability join reads. Returns `undefined` when the
 * brief carries no probability for it, so the join falls through to the
 * block's own map rather than inventing a value.
 */
function briefWinProbability(
  enrichment: Record<string, unknown> | undefined,
  optionId: string,
): number | undefined {
  const brief = isPlainObject(enrichment?.decision_brief)
    ? (enrichment!.decision_brief as Record<string, unknown>)
    : undefined
  const raw = Array.isArray(brief?.options) ? brief!.options : []
  for (const entry of raw) {
    if (!isPlainObject(entry)) continue
    const id = safeString(entry.option_id) ?? safeString(entry.id)
    if (id !== optionId) continue
    return safeFiniteNumber(entry.win_probability)
  }
  return undefined
}

/**
 * The `DecisionVerdictReportLike` view of a V5 analysis block — everything
 * `deriveDecisionVerdict` reads, and nothing else.
 *
 * ## Why this exists rather than `deriveDecisionVerdict(mapV5AnalysisToReport(block))`
 *
 * `mapV5AnalysisToReport`'s `report.robustness` is an explicit KEEP-LIST and
 * `near_tie` is not on it — deliberately, and documented as such in
 * `src/lib/__fixtures__/ownedLeaderClaim.fixtures.ts`. So the mapped report
 * cannot see PLoT's own tie verdict even though the RAW enrichment this
 * function reads carries it (`enrichment.robustness.near_tie`, present on the
 * captured staging bundle at `src/v5/__tests__/fixtures/`). Deriving the
 * verdict from the raw block therefore uses a STRICTLY richer signal than
 * deriving it from the mapped report, and does not depend on the keep-list.
 *
 * ## Identity space
 *
 * Both producer signals (`near_tie.top_option_id`,
 * `headline_banded.leader_option_id`) are option IDs, so the probabilities
 * handed to `deriveDecisionVerdict` must be id-keyed too — otherwise its
 * identity gate compares an id to a label, never matches, and silently
 * withholds every run. That join is `resolveWinProbabilitiesById`, the same
 * one the report itself uses.
 *
 * The id↔label source falls back to `decision_brief.options[]` exactly as
 * `resolveLeaderKeys` does, and for the same reason: the verdict decides
 * WHETHER a leader may be marked and `resolveLeaderKeys` decides WHICH key
 * it is, so the two MUST resolve identity from the same chain. When they
 * disagreed, a payload carrying only the brief fallback resolved a leader key
 * and no verdict — silently withholding a designation the producer permitted.
 */
export function buildV5VerdictReportLike(block: {
  win_probabilities?: Record<string, number> | null
  enrichment?: unknown
}): DecisionVerdictReportLike {
  const enrichment = isPlainObject(block.enrichment) ? block.enrichment : undefined
  const winProbs = block.win_probabilities ?? {}

  // Same fallback chain as `resolveLeaderKeys`; NOT applied to the report
  // mapper itself, whose `option_probabilities` keying is a separate,
  // already-pinned contract (path B keys by win_probabilities verbatim).
  const fromComparison = resolveOptionEntries(enrichment)
  const candidates: WinProbabilityCandidate[] =
    fromComparison.length > 0
      ? winProbabilityCandidates(fromComparison, winProbs)
      : resolveDecisionBriefOptions(enrichment).map((identity) => ({
          optionId: identity.optionId,
          optionLabel: identity.label,
          // The brief's own per-option win probability, when it sent one —
          // the same producer payload, read through the same precedence the
          // join applies to an option_comparison entry.
          ownWinProbability: briefWinProbability(enrichment, identity.optionId),
        }))

  // No id↔label source at all ⇒ fall back to the mapper's path B (the
  // win_probabilities keys verbatim), so a block with neither producer array
  // still yields probabilities. They will be LABEL-keyed, the id-space
  // producer signals will not apply, and the verdict fails closed — which is
  // the correct outcome, reached without a special case.
  const winById = resolveWinProbabilitiesById(
    candidates.length > 0 ? candidates : winProbabilityCandidates([], winProbs),
    winProbs,
  )

  const option_probabilities: Record<string, { win_probability?: number | null }> = {}
  for (const [optionId, win] of winById) {
    option_probabilities[optionId] = { win_probability: win }
  }

  const robustnessRaw = isPlainObject(enrichment?.robustness) ? enrichment!.robustness : undefined
  const briefRaw = isPlainObject(enrichment?.decision_brief)
    ? (enrichment!.decision_brief as Record<string, unknown>)
    : undefined

  return {
    option_probabilities,
    // Passed through UNNORMALISED on purpose: `deriveDecisionVerdict` reads
    // both fail-closed (a malformed `near_tie` falls to the next authority,
    // an unknown band token yields no claim), so re-validating here would be
    // a second, divergent gate on the same bytes.
    robustness: robustnessRaw
      ? {
          recommended_option_id:
            typeof robustnessRaw.recommended_option_id === 'string'
              ? robustnessRaw.recommended_option_id
              : null,
          near_tie: robustnessRaw.near_tie,
        }
      : null,
    decision_brief: briefRaw
      ? ({ headline_banded: briefRaw.headline_banded } as DecisionVerdictReportLike['decision_brief'])
      : null,
  }
}

export function resolveLeaderKeys(
  enrichment: Record<string, unknown> | undefined,
  leadingOptionId: string | null | undefined,
): ReadonlySet<string> {
  if (typeof leadingOptionId !== 'string' || leadingOptionId === '') {
    return new Set<string>()
  }
  // The id itself always counts: some paths/fixtures DO key by option_id.
  const keys = new Set<string>([leadingOptionId])

  const fromComparison: ResolvedOptionIdentity[] = resolveOptionEntries(enrichment).map((r) => ({
    optionId: r.optionId,
    label: r.optionLabel,
  }))
  const identities =
    fromComparison.length > 0 ? fromComparison : resolveDecisionBriefOptions(enrichment)

  const labelOccurrences = new Map<string, number>()
  for (const identity of identities) {
    if (identity.label !== undefined) {
      labelOccurrences.set(identity.label, (labelOccurrences.get(identity.label) ?? 0) + 1)
    }
  }

  const leaderLabel = identities.find((i) => i.optionId === leadingOptionId)?.label
  if (leaderLabel !== undefined && (labelOccurrences.get(leaderLabel) ?? 0) === 1) {
    keys.add(leaderLabel)
  }
  return keys
}

/**
 * option_id → human label, derived from the SAME payload the caller is
 * rendering: `enrichment.option_comparison` first, falling back to
 * `enrichment.decision_brief.options` (that array is not guaranteed — the wire
 * carries a sibling `option_comparison_status` precisely because of it).
 *
 * Reuses the two resolvers `resolveLeaderKeys` uses, so this is one derivation
 * chain over producer data with two callers, NOT a second hand-maintained
 * mapping. Ids with no resolvable label are simply absent from the map; the
 * caller decides what to show instead (ROADMAP 2.154 renders the raw id, which
 * is honest rather than blank).
 */
export function resolveOptionLabelById(
  enrichment: Record<string, unknown> | undefined,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  const fromComparison = resolveOptionEntries(enrichment)
  const identities: ResolvedOptionIdentity[] =
    fromComparison.length > 0
      ? fromComparison.map((r) => ({ optionId: r.optionId, label: r.optionLabel }))
      : resolveDecisionBriefOptions(enrichment)
  for (const identity of identities) {
    if (identity.label !== undefined && identity.label !== '' && !out.has(identity.optionId)) {
      out.set(identity.optionId, identity.label)
    }
  }
  return out
}

// ─── Public mapper ─────────────────────────────────────────────────────

export interface MapV5AnalysisOptions {
  /**
   * Seed used for the run. The V5 contract carries NO seed field, so when
   * the caller has no real value the report carries null and the Seed
   * receipt row fails closed (hides). Never default to 0 — a fabricated
   * seed is a provenance lie (T2 receipts-honesty).
   */
  seed?: number | null
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
  // Receipts fail closed: no real seed → null (Seed row hides), never 0.
  // NOTE: meta.seed does NOT feed the deriveBlockHash `v5:` digest — that
  // hashes summary/leading_option_id/win_probabilities/enrichment only —
  // so this change cannot perturb dedupe or hash stability.
  const seed = options.seed ?? null
  const enrichment = isPlainObject(block.enrichment) ? block.enrichment : undefined

  // Factor sensitivity — collected once IN PRODUCER ORDER (ROADMAP 2.235);
  // reused for drivers + factor_sensitivity passthrough.
  const factors = enrichment ? collectFactors(enrichment) : []
  const drivers = factors.slice(0, 5).map((f) => ({
    label: f.factor_label,
    // ROADMAP 2.234: `mixed` / `unknown` / absent take the neutral affordance
    // the driver surfaces already ship, never the "up" arrow they used to get
    // from a magnitude's sign.
    polarity: factorDirectionToPolarity(f.direction),
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
  const iterator = optionIterator(resolvedOptions, winProbs)
  const winProbabilityById = resolveWinProbabilitiesById(
    winProbabilityCandidates(resolvedOptions, winProbs),
    winProbs,
  )

  for (const { optionId, enriched } of iterator) {
    const winProb = winProbabilityById.get(optionId)

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
      /**
       * @claim-producer goal-probability
       * @rationale This is the V5/CEE enrichment wire→internal boundary where
       *   `probability_of_goal` and `probability_of_joint_goal` ENTER the UI and
       *   are written out under the internal `goal_probability` name. It creates
       *   the fields; it does not choose a displayed claim from them — no
       *   percentage, no basis, no caveat is decided here. Display goes through
       *   `selectGoalProbability`. Suppressed count is baselined and ratcheted.
       */
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

  // P0 F6: edge E-values. PLoT emits `edge_e_values` at the TOP LEVEL of
  // enrichment (enrichment.edge_e_values); the legacy nested copy
  // (enrichment.robustness.edge_e_values) is no longer populated on the live
  // V5 wire (A3 Codex compute-wave, 19 Jul 2026). Every UI consumer reads
  // `report.robustness.edge_e_values` (useAnalysisResults.ts:54,
  // ModelTabBody.tsx:238, useResultsSectionData.ts:2491/2958,
  // analysisSnapshotFactory.ts:115), so it must be sourced from the REAL wire
  // location — top-level first (real), the nested copy as a legacy fallback,
  // and fail closed (omit) when neither carries a non-empty array. An empty
  // array is treated as "no data" so a stale/empty top-level does not mask a
  // populated legacy copy.
  const topLevelEdgeEValuesRaw = enrichment?.edge_e_values
  const nestedEdgeEValuesRaw = robustnessRaw?.edge_e_values
  const robustnessEdgeEValues =
    Array.isArray(topLevelEdgeEValuesRaw) && topLevelEdgeEValuesRaw.length > 0
      ? topLevelEdgeEValuesRaw
      : Array.isArray(nestedEdgeEValuesRaw) && nestedEdgeEValuesRaw.length > 0
        ? nestedEdgeEValuesRaw
        : undefined

  const robustness = robustnessRaw
    ? {
        // Receipts fail closed (T2): preserve ABSENCE. Keys are emitted
        // only when the producer sent a real array — a producer-sent []
        // is an honest "none stable/fragile" (row shows 0), while an
        // absent or malformed field stays off the report so counts read
        // undefined and receipt rows hide. Never coerce absence to [].
        ...(Array.isArray(robustnessRaw.fragile_edges)
          ? { fragile_edges: robustnessRaw.fragile_edges }
          : {}),
        ...(Array.isArray(robustnessRaw.robust_edges)
          ? { robust_edges: robustnessRaw.robust_edges }
          : {}),
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
        // P0 F6: sourced from the real wire location (top-level first, nested
        // legacy fallback) so report.robustness.edge_e_values — the slot every
        // edge consumer reads — is populated from PLoT's top-level emit.
        ...(robustnessEdgeEValues !== undefined
          ? { edge_e_values: robustnessEdgeEValues }
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
  // Codex SF7: the producer leader-confidence band (PLoT #200,
  // decision_brief.headline_banded) was preserved by the V2 mapper but
  // DROPPED here — so the hero always fell back to UI-SEM-060 banding on
  // the live V5 path. Pass it through verbatim (same pattern as
  // flip_thresholds); the selector normalises fail-closed.
  const decisionBrief =
    enrichment && typeof (enrichment as Record<string, unknown>).decision_brief === 'object'
      ? (enrichment as Record<string, unknown>).decision_brief
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

  // Critiques transport, UI leg (ROADMAP 2.358; schemas 0.31.0 / CEE #786).
  // CEE's `projectCritiquesForTransport` (sanitise-enrichment.ts:690 at
  // d2cdd99b) ships rows with `user_message` (display-safe; S-bucket = the
  // Paul-approved 2026-04-30 copy, rendered CEE-side) and NO `message`
  // (withheld internal wording). Until this read existed, every transported
  // critique died here — the last hop before the browser (trap 16: the only
  // prior `run.critique` writer was the DEAD V4 `envelope.analysis_response`
  // path). Absence-preserving: key absent ⇒ no `run` minted; producer-sent
  // `[]` ⇒ present-and-empty (honest "nothing to disclose").
  const rawCritiques = Array.isArray(enrichment?.critiques)
    ? (enrichment!.critiques as unknown[])
    : undefined

  // V7-C slice 1 (ROADMAP 2.141): the VOI family. schemas 0.30.0 adds these
  // FOUR keys to `CEE_UI_ENRICHMENT_KEEP_LIST` and CEE #754 mirrors them onto
  // `P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP`, so they now arrive on
  // `blocks[0].enrichment` at the browser (live-probed 30 Jul). Until this read
  // existed they died one hop before the store.
  //
  // FOUR, NOT THREE: `correlation_model` is the DISCRIMINATOR for an absent
  // `p_win_sensitivity` — ISL suppresses that array under active correlation
  // and names it in `correlation_model.suppressed_attributions` ("absent from
  // the response, not null"). Carrying the question without the answer is the
  // shape the design's §6 correction exists to prevent.
  //
  // Slice 1 DISPLAYS `factor_evppi` only, as a ranking with no magnitudes; the
  // other three are transported and unread so the display half needs no second
  // cross-repo train. Transport is claim-inert — the claim cage is the reader
  // (`components/results/voi/voiRanking.ts`), which carries no number at all.
  //
  // Verbatim + absence-preserving, exactly like `inference_warnings` above: a
  // producer-sent `[]` is an honest "no factor survived" and is carried as
  // such, while absent/null/malformed stays OFF the report so the reader's
  // honest gate fires instead of a fabricated ranking. Rows are NOT narrowed
  // here — the audit legs (`noise_floor`, `clamped_*`, `method`, the utility
  // legs) reach the debug bundle intact, and the reader decides what it is
  // licensed to use.
  const factorEvppi = Array.isArray(enrichment?.factor_evppi)
    ? (enrichment!.factor_evppi as unknown[])
    : undefined
  const decisionEvpi = safeFiniteNumber(enrichment?.decision_evpi)
  const pWinSensitivity = Array.isArray(enrichment?.p_win_sensitivity)
    ? (enrichment!.p_win_sensitivity as unknown[])
    : undefined
  const correlationModel = isPlainObject(enrichment?.correlation_model)
    ? enrichment!.correlation_model
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
      // F12 (truthful labelling): `deriveBlockHash` below is FNV-1a 64-bit, not
      // SHA-256. When a producer hash is supplied it is carried verbatim (its
      // own algorithm, assumed 'sha256' per the producer paths); otherwise the
      // hash is the locally-derived FNV-1a digest and MUST be labelled as such
      // so the receipts never misrepresent the algorithm. NOTE: this is a
      // labelling fix only — deliberately NOT a switch to real SHA-256
      // (async/web-crypto churn, out of scope).
      response_hash_algo: options.responseHash ? 'sha256' : 'fnv1a-64',
      // Provenance for the receipts hash row: when the caller supplied a
      // producer hash it is 'producer'; otherwise `responseHash` is the
      // locally-derived `deriveBlockHash` digest (the V5 contract carries no
      // engine hash) and must be labelled 'local' so the UI never presents it
      // as an engine identity.
      response_hash_source: options.responseHash ? 'producer' : 'local',
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
      // ROADMAP 2.234: absence stays absence — the key is omitted rather than
      // written as a default, exactly like the additive passthroughs below, so
      // a consumer can still tell "the producer said nothing" from "the
      // producer said unknown".
      ...(f.direction !== null ? { direction: f.direction } : {}),
      // Roadmap 1.7 additive passthrough (provisional_doctrine_v0):
      // influence_score / influence_rank / zero_reason reach the store so
      // the DriversSection "Influence" column renders the PRODUCER's
      // influence measure instead of falling back to a UI-normalised
      // sensitivity (influence ≠ sensitivity). Omitted when absent.
      ...(f.influence_score !== undefined ? { influence_score: f.influence_score } : {}),
      ...(f.influence_rank !== undefined ? { influence_rank: f.influence_rank } : {}),
      ...(f.zero_reason !== undefined ? { zero_reason: f.zero_reason } : {}),
      // P0 F5: EVPI family reaches the store so ModelTabBody's EVPI map
      // (evpi_percentage_points ?? value_of_information * 100) and the
      // useResultsSectionData value_of_information read light up on the V5
      // path. Omitted when absent (no fabricated 0).
      ...(f.value_of_information !== undefined ? { value_of_information: f.value_of_information } : {}),
      ...(f.evpi_percentage_points !== undefined ? { evpi_percentage_points: f.evpi_percentage_points } : {}),
      ...(f.evpi_method !== undefined ? { evpi_method: f.evpi_method } : {}),
      ...(f.evpi_status !== undefined ? { evpi_status: f.evpi_status } : {}),
    }))
  }
  if (robustness) widened.robustness = robustness
  if (topLevelFlipThresholds) widened.flip_thresholds = topLevelFlipThresholds
  if (decisionBrief != null) widened.decision_brief = decisionBrief
  if (topLevelEdgeEValues) widened.edge_e_values = topLevelEdgeEValues
  if (confidenceTier !== undefined) widened.confidence_tier = confidenceTier
  if (constraintsStatus !== undefined) widened.constraints_status = constraintsStatus
  if (inferenceWarnings) widened.inference_warnings = inferenceWarnings
  // Critiques transport, UI leg (ROADMAP 2.358) — mint the canonical
  // `run.critique` slot the Results consumers already read
  // (useResultsSectionData.ts:2015/:2453, OutputsDock.tsx:2423,
  // usePreAnalysisData.ts:616; useUnifiedActions.ts:229 re-enables
  // honestly). `responseHash` is the report's own hash — one identity, not
  // a second derivation.
  //
  // ⚠ NO `bands` KEY — EVER (review #585 F1, executable-proven). A bands
  // object of nulls is a TRUTHY value, and two readers branch on object
  // truthiness (`canonicalBands ? canonicalBands.p50 :
  // report?.results?.likely` at OutputsDock.tsx:1188-1194; the
  // `if (bands)` early-return in share/decisionSummary.ts:28-37) — a
  // null-bands object would have nulled a REAL mostLikelyValue on exactly
  // the turns this reader lights up. True absence, not presence-shaped
  // absence: `report.run?.bands` stays undefined and every fallback chain
  // fires exactly as before this PR.
  //
  // Minted only when at least one row SURVIVES mapping (review F7): CEE's
  // projection never emits an empty `critiques` array on the wire, so a
  // present-and-empty slot would pin a producer behaviour that does not
  // exist; `[]`/all-malformed input leaves `run` absent, same as no key.
  if (rawCritiques) {
    const critique = mapProjectedCritiques(rawCritiques)
    if (critique.length > 0) {
      report.run = { responseHash, critique }
    }
  }
  // VOI family (V7-C slice 1) — see the derivation block above.
  if (factorEvppi) widened.factor_evppi = factorEvppi
  if (decisionEvpi !== undefined) widened.decision_evpi = decisionEvpi
  if (pWinSensitivity) widened.p_win_sensitivity = pWinSensitivity
  if (correlationModel !== undefined) widened.correlation_model = correlationModel
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
        // The duplicate-label guard used to be MIRRORED here, by hand, from
        // the option_probabilities resolution above ("Mirror the
        // duplicate-label guard…" — a hand-maintained copy of a rule, which
        // is the defect class, not the fix). Both now read the SAME resolved
        // map, so the OutcomePanel rows and the report's option_probabilities
        // cannot disagree about a win probability, and a change to the
        // three-place lookup lands in one place.
        const winProb = winProbabilityById.get(optionId)
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
