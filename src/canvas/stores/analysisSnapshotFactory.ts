/**
 * Analysis Snapshot Factory
 *
 * Pure function that builds an AnalysisSnapshot from available data
 * at analysis completion time. Separated from the store for clean
 * unit testing without Zustand mocking.
 */
import type { Node, Edge } from '@xyflow/react'
import type { V2RunResponse, V2FactorSensitivity, V2OptionComparison } from '../../adapters/plot/v2/types'
import type { ReportV1 } from '../../adapters/plot/types'
import type { ScenarioEvent, ScenarioEventType } from '../../types/scenario'
import { SYSTEM_MARKER_EVENT_TYPES } from '../../types/scenario'
import type { AnalysisSnapshot, FactorSensitivitySummary } from '../compare-tab/types'
import { generateGraphHash } from '../utils/graphHash'
import { hasObservedData } from '../utils/observedStateHelpers'

export interface BuildSnapshotParams {
  rawV2Response: V2RunResponse
  report: ReportV1
  nodes: Node[]
  edges: Edge[]
  runNumber: number
  events: ScenarioEvent[]
  previousSnapshotTimestamp: string | null
}

// ---------------------------------------------------------------------------
// Stability label thresholds (mirrors src/lib/stability.ts / UI-SEM-006)
// Layer 3: display-only derivation
// ---------------------------------------------------------------------------

function deriveStabilityLabel(stability: number): string {
  if (stability >= 0.7) return 'stable'
  if (stability >= 0.4) return 'mostly stable'
  return 'fragile'
}

// ---------------------------------------------------------------------------
// Evidence coverage ("3/5" format)
// ---------------------------------------------------------------------------

function computeEvidenceCoverage(nodes: Node[]): string {
  let total = 0
  let withData = 0
  for (const node of nodes) {
    const data = node.data as Record<string, unknown> | undefined
    if (data?.kind !== 'factor') continue
    total++
    if (hasObservedData(data)) withData++
  }
  return `${withData}/${total}`
}

// ---------------------------------------------------------------------------
// Factor sensitivity summary (top 5)
// ---------------------------------------------------------------------------

function extractTopFactors(
  factors: V2FactorSensitivity[],
): FactorSensitivitySummary[] {
  return [...factors]
    .sort((a, b) => Math.abs(b.elasticity ?? 0) - Math.abs(a.elasticity ?? 0))
    .slice(0, 5)
    .map(f => ({
      id: f.node_id ?? f.factor_id ?? '',
      label: f.factor_label ?? f.label ?? '',
      elasticity: f.elasticity ?? 0,
      rankFlipRate: f.rank_flip_rate ?? 0,
      attributionStability: f.attribution_stability ?? 'unknown',
    }))
}

// ---------------------------------------------------------------------------
// Influence concentration
// ---------------------------------------------------------------------------

function computeInfluenceConcentration(factors: V2FactorSensitivity[]): number {
  if (factors.length === 0) return 0
  const absElasticities = factors.map(f => Math.abs(f.elasticity ?? 0))
  const sum = absElasticities.reduce((a, b) => a + b, 0)
  if (sum === 0) return 0
  const max = Math.max(...absElasticities)
  return Math.round((max / sum) * 100)
}

// ---------------------------------------------------------------------------
// ISL field extraction (pass-through from robustness, all optional)
// ---------------------------------------------------------------------------

function extractConditionalWinners(
  robustness: V2RunResponse['robustness'],
): AnalysisSnapshot['conditionalWinners'] {
  const raw = (robustness as Record<string, unknown> | undefined)?.conditional_winners
  if (!Array.isArray(raw)) return []
  return raw
    .filter((w: Record<string, unknown>) => w && typeof w === 'object')
    .map((w: Record<string, unknown>) => ({
      factorId: String(w.factor_id ?? w.node_id ?? ''),
      factorLabel: String(w.factor_label ?? w.label ?? ''),
      winner: String(w.high_bucket && typeof w.high_bucket === 'object'
        ? (w.high_bucket as Record<string, unknown>).winner_label ?? ''
        : ''),
      condition: w.split_value != null
        ? `When ${String(w.factor_label ?? w.label ?? 'factor')} exceeds ${w.split_value}${w.split_unit ? ` ${w.split_unit}` : ''}`
        : '',
    }))
}

function extractEdgeEValues(
  robustness: V2RunResponse['robustness'],
  nodes: Node[],
  _edges: Edge[],
): AnalysisSnapshot['edgeEValues'] {
  const raw = (robustness as Record<string, unknown> | undefined)?.edge_e_values
  if (!Array.isArray(raw)) return []

  // Build node label lookup
  const nodeLabels = new Map<string, string>()
  for (const n of nodes) {
    const data = n.data as Record<string, unknown> | undefined
    if (data?.label) nodeLabels.set(n.id, String(data.label))
  }

  return raw
    .filter((ev: Record<string, unknown>) =>
      typeof ev?.edge_id === 'string' && typeof ev?.e_value === 'number')
    .map((ev: Record<string, unknown>) => {
      const edgeId = String(ev.edge_id)
      // Edge IDs are "from_id->to_id" format — resolve labels
      const parts = edgeId.split('->')
      const fromLabel = parts[0] ? nodeLabels.get(parts[0]) ?? parts[0] : ''
      const toLabel = parts[1] ? nodeLabels.get(parts[1]) ?? parts[1] : ''
      return {
        edgeId,
        edgeLabel: `${fromLabel} → ${toLabel}`,
        eValue: Number(ev.e_value),
      }
    })
}

function extractInferenceWarnings(
  robustness: V2RunResponse['robustness'],
): string[] {
  const raw = (robustness as Record<string, unknown> | undefined)?.inference_warnings
  if (!Array.isArray(raw)) return []
  return raw
    .map((w: unknown) => {
      if (typeof w === 'string') return w
      if (w && typeof w === 'object') {
        const obj = w as Record<string, unknown>
        return String(obj.message ?? obj.code ?? '')
      }
      return ''
    })
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Edit summary derivation
// ---------------------------------------------------------------------------

// Events that count as a user edit for the Compare-tab summary.
// Derived, not hand-kept-disjoint: any type classified as a system persistence
// marker (types/scenario SYSTEM_MARKER_EVENT_TYPES) is structurally removed
// here, so a future marker can never start inflating the edit count just
// because someone forgot this list existed.
const EDIT_EVENT_TYPES: ReadonlySet<ScenarioEventType> = new Set(
  (['direct_edit', 'patch_accepted', 'graph_drafted', 'stage_changed'] as ScenarioEventType[])
    .filter((t) => !SYSTEM_MARKER_EVENT_TYPES.has(t)),
)

function deriveEditSummary(
  events: ScenarioEvent[],
  previousTimestamp: string | null,
  runNumber: number,
): string {
  if (runNumber === 1) return 'Initial analysis'

  const relevant = previousTimestamp
    ? events.filter(e =>
        EDIT_EVENT_TYPES.has(e.event_type) &&
        e.timestamp > previousTimestamp
      )
    : []

  if (relevant.length === 0) return 'Rerun (no edits)'

  // Try to extract a specific label from a single edit
  if (relevant.length === 1) {
    const detail = relevant[0].details
    if (detail && typeof detail === 'object') {
      const label = (detail as Record<string, unknown>).label ??
                    (detail as Record<string, unknown>).summary
      if (typeof label === 'string' && label.length <= 60) return label
    }
    // Fallback descriptions per event type
    switch (relevant[0].event_type) {
      case 'direct_edit': return 'Edited model'
      case 'patch_accepted': return 'Accepted draft changes'
      case 'graph_drafted': return 'New graph drafted'
      case 'stage_changed': return 'Stage changed'
      default: return 'Model updated'
    }
  }

  // Multiple edits — summarise counts
  const editCount = relevant.filter(e => e.event_type === 'direct_edit').length
  const patchCount = relevant.filter(e => e.event_type === 'patch_accepted').length
  const parts: string[] = []
  if (editCount > 0) parts.push(`Edited ${editCount} factor${editCount > 1 ? 's' : ''}`)
  if (patchCount > 0) parts.push(`Accepted ${patchCount} patch${patchCount > 1 ? 'es' : ''}`)
  if (parts.length === 0) parts.push(`${relevant.length} changes`)

  const summary = parts.join(', ')
  return summary.length > 60 ? summary.slice(0, 57) + '...' : summary
}

// ---------------------------------------------------------------------------
// Main factory function
// ---------------------------------------------------------------------------

export function buildAnalysisSnapshot(params: BuildSnapshotParams): AnalysisSnapshot {
  const { rawV2Response, report: _report, nodes, edges, runNumber, events, previousSnapshotTimestamp } = params

  // Sort options by win_probability descending
  const options = [...(rawV2Response.option_comparison ?? [])]
    .sort((a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0))

  const winner = options[0] as V2OptionComparison | undefined
  const runnerUp = options.length > 1 ? options[1] : null

  // Factor sensitivity
  const factors = rawV2Response.factor_sensitivity ?? []
  const topFactors = extractTopFactors(factors)

  // The factor the Compare hero invites the user to calibrate.
  //
  // ⛔ This used to be `max evpi_percentage_points`, with `?? 0` fabricating
  // absence as a confident zero — twice (here and on `topEvpiValue`). The
  // quantity is refuted: ISL measures 0.0pp for the very factors PLoT scores
  // at 12.3 / 10.2 / 6.6 in the same payload, and the formula multiplies BY
  // the top-two win-probability gap, inverting decision theory.
  //
  // It is now `topFactors[0]` — max |elasticity| — which is the SAME quantity
  // the hero already prints one clause earlier as "{topElasticity}% influence".
  // One sentence, one source, and no new number introduced.
  const topCalibrationFactor = topFactors[0]

  // Robustness
  //
  // T2b: absence-preserving. `?? 0` here was a T2-class fabrication — a
  // default that makes a fail-closed guard pass — on a PERSISTENCE surface,
  // so the false value outlived the run that produced it. It also fabricated
  // a VERDICT, not just a number: deriveStabilityLabel(0) === 'fragile', so a
  // producer that sent no robustness data at all made the compare tab assert
  // "Model fragile". An honest producer-sent 0 still flows through.
  const robustness = rawV2Response.robustness
  const stability = typeof robustness?.recommendation_stability === 'number'
    && Number.isFinite(robustness.recommendation_stability)
    ? robustness.recommendation_stability
    : null

  // Goal probability (from winner)
  const goalProbability = winner?.probability_of_goal != null
    ? Math.round(winner.probability_of_goal * 100)
    : null
  const jointGoalProbability = winner?.probability_of_joint_goal != null
    ? Math.round(winner.probability_of_joint_goal * 100)
    : null

  // Seed
  //
  // T2b: absence-preserving, and NaN-safe. The old `Number(...)` turned a
  // malformed echo into NaN, which survives every `!= null` guard downstream
  // and renders as "Seed NaN"; the `: 0` arm fabricated a seed outright.
  // Mirrors resolveSeedUsed (useV2Run) and hydrateAnalysis.ts:111-115.
  const rawSeed = rawV2Response.meta?.seed_used
  const parsedSeed = rawSeed != null ? Number.parseInt(String(rawSeed), 10) : Number.NaN
  const seedUsed: number | null = Number.isFinite(parsedSeed) ? parsedSeed : null

  return {
    runId: crypto.randomUUID(),
    runNumber,
    timestamp: new Date().toISOString(),
    graphHash: generateGraphHash(nodes, edges),
    nodeCount: nodes.length,
    edgeCount: edges.length,

    winnerId: winner?.option_id ?? '',
    winnerLabel: winner?.option_label ?? '',
    winnerProbability: Math.round((winner?.win_probability ?? 0) * 100),
    runnerUpId: runnerUp?.option_id ?? null,
    runnerUpLabel: runnerUp?.option_label ?? null,
    runnerUpProbability: runnerUp ? Math.round((runnerUp.win_probability ?? 0) * 100) : null,

    recommendationStability: stability,
    stabilityLabel: stability != null ? deriveStabilityLabel(stability) : null,
    // T2b: absence-preserving. PR #326 made the mapper's fragile_edges /
    // robust_edges absence-preserving so AdvancedSection honestly HIDES the
    // row when the producer sent nothing — but this line re-fabricated a 0
    // into the snapshot, so the same run reported "unknown" on one surface and
    // "0 fragile" on another (compare-tab). That cross-surface incoherence is
    // what #322 was merged to prevent. An honest `fragile_edges: []` (the
    // producer measured and found none) still reports 0.
    fragileEdgeCount: robustness?.fragile_edges != null
      ? robustness.fragile_edges.length
      : null,

    evidenceCoverage: computeEvidenceCoverage(nodes),

    topFactors,
    influenceConcentration: computeInfluenceConcentration(factors),
    topCalibrationFactor: topCalibrationFactor?.label ?? '',
    topCalibrationFactorId: topCalibrationFactor?.id ?? '',
    topElasticity: topFactors.length > 0
      ? Math.round(Math.abs(topFactors[0].elasticity) * 100)
      : 0,
    rankFlipRate: topFactors.length > 0 ? topFactors[0].rankFlipRate : 0,

    goalProbability,
    jointGoalProbability,

    inferenceWarnings: extractInferenceWarnings(robustness),
    conditionalWinners: extractConditionalWinners(robustness),
    edgeEValues: extractEdgeEValues(robustness, nodes, edges),

    seedUsed,
    responseHash: rawV2Response.response_hash ?? '',
    editSummary: deriveEditSummary(events, previousSnapshotTimestamp, runNumber),
  }
}
