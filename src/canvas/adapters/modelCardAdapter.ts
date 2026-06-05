/**
 * Model Card Lite — data adapters and selectors
 *
 * Produces stable view-models for ModelCardLite and ModelReceiptBlock from canvas store state.
 *
 * Phase 2A: trust surfaces + pre-analysis enrichment.
 */

import type { Node, Edge } from '@xyflow/react'
import type { ModelReceiptBlockType } from '../conversation/types'

// ---------------------------------------------------------------------------
// § 1 — Types
// ---------------------------------------------------------------------------

export interface NodeCountsByKind {
  factor: number
  option: number
  goal: number
  decision: number
  risk: number
  outcome: number
}

export interface ModelCardData {
  graphHash: string | null
  seed: number | null
  qualityMode: string | null
  nodeCounts: NodeCountsByKind
  edgeCount: number
  confidenceLabel: string | null
  repairsApplied: RepairDisplay[]
  hasResults: boolean
}

export interface RepairDisplay {
  label: string
  action: string
  before?: string
  after?: string
  reason?: string
}

export interface ModelReceiptData {
  factorCount: number
  edgeCount: number
  optionCount: number
  goalLabel: string | null
  /**
   * CEE-owned coaching (analysis_ready.coaching_summary), verbatim. This is the
   * card's main content (F1 PR B). DGAI never rewrites or augments it — it is
   * displayed as-is and is intentionally exempt from the DGAI copy/glossary gate.
   */
  coachingSummary: string | null
  topInsight: string | null
  topEvidenceGap: string | null
  readiness: 'ready' | 'blocked' | 'incomplete' | 'unknown'
  adjustments: RepairDisplay[]
}

// Raw repair from PLoT response
interface RawRepair {
  code?: string
  type?: string
  layer?: string
  field_path?: string
  before?: unknown
  after?: unknown
  severity?: string
  node_id?: string
  value?: unknown
  source?: string
  reason?: string
}

// ---------------------------------------------------------------------------
// § 2 — Field path to human-readable label
// ---------------------------------------------------------------------------

/**
 * Converts a PLoT field_path (e.g. "edges[3].exists_probability") to a
 * human-readable description for the repairs display.
 */
export function fieldPathToLabel(fieldPath: string | undefined, nodes?: Node[]): string {
  if (!fieldPath) return 'Model parameter'

  // edges[N].field → "Strength of relationship N"
  const edgeMatch = fieldPath.match(/^edges\[(\d+)]\.(.+)$/)
  if (edgeMatch) {
    const field = edgeMatch[2]
    const fieldLabel = FIELD_LABELS[field] ?? field.replace(/_/g, ' ')
    return `${fieldLabel} of relationship`
  }

  // nodes[N].field → try to resolve label
  const nodeMatch = fieldPath.match(/^nodes\[(\d+)]\.(.+)$/)
  if (nodeMatch) {
    const idx = parseInt(nodeMatch[1], 10)
    const field = nodeMatch[2]
    const fieldLabel = FIELD_LABELS[field] ?? field.replace(/_/g, ' ')
    const nodeLabel = nodes?.[idx]?.data?.label
    return nodeLabel
      ? `${fieldLabel} of "${nodeLabel}"`
      : `${fieldLabel} of node`
  }

  // Fallback: humanise the path
  return fieldPath
    .replace(/\[\d+]/g, '')
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
}

export const FIELD_LABELS: Record<string, string> = {
  exists_probability: 'Existence probability',
  strength_mean: 'Strength',
  strength_std: 'Strength uncertainty',
  observed_state: 'Observed value',
  baseline: 'Baseline',
  std: 'Standard deviation',
  prior: 'Prior distribution',
  range_min: 'Range minimum',
  range_max: 'Range maximum',
}

// ---------------------------------------------------------------------------
// § 3 — Repair formatting
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  DEFAULT_EXISTS_PROB: 'Defaulted',
  DEFAULT_STRENGTH_STD: 'Defaulted',
  CLAMP_PROBABILITY: 'Clamped',
  NORMALISE_WEIGHTS: 'Normalised',
  FLOOR_STD: 'Floored',
  DEFAULT_BASELINE: 'Defaulted',
}

export function formatRepair(raw: RawRepair, nodes?: Node[]): RepairDisplay {
  const label = fieldPathToLabel(raw.field_path, nodes)
  const action = ACTION_LABELS[raw.code ?? ''] ?? raw.type ?? 'Adjusted'
  const before = raw.before != null ? String(raw.before) : undefined
  const after = raw.after != null ? String(raw.after) : undefined
  return { label, action, before, after, reason: raw.reason }
}

export function formatRepairs(raw: RawRepair[] | null | undefined, nodes?: Node[]): RepairDisplay[] {
  if (!raw || raw.length === 0) return []
  return raw.map(r => formatRepair(r, nodes))
}

// ---------------------------------------------------------------------------
// § 4 — Node counting
// ---------------------------------------------------------------------------

export function countNodesByKind(nodes: Node[]): NodeCountsByKind {
  const counts: NodeCountsByKind = { factor: 0, option: 0, goal: 0, decision: 0, risk: 0, outcome: 0 }
  for (const n of nodes) {
    const kind = (n.data?.kind ?? n.type ?? '') as string
    if (kind in counts) {
      counts[kind as keyof NodeCountsByKind]++
    } else if (kind === 'intervention') {
      // CEE sometimes uses 'intervention' for options
      counts.option++
    }
  }
  return counts
}

export function formatNodeCounts(counts: NodeCountsByKind): string {
  const parts: string[] = []
  if (counts.factor > 0) parts.push(`${counts.factor} factor${counts.factor !== 1 ? 's' : ''}`)
  if (counts.option > 0) parts.push(`${counts.option} option${counts.option !== 1 ? 's' : ''}`)
  if (counts.goal > 0) parts.push(`${counts.goal} goal${counts.goal !== 1 ? 's' : ''}`)
  if (counts.decision > 0) parts.push(`${counts.decision} decision${counts.decision !== 1 ? 's' : ''}`)
  if (counts.risk > 0) parts.push(`${counts.risk} risk${counts.risk !== 1 ? 's' : ''}`)
  if (counts.outcome > 0) parts.push(`${counts.outcome} outcome${counts.outcome !== 1 ? 's' : ''}`)
  return parts.join(', ') || '0 nodes'
}

// ---------------------------------------------------------------------------
// § 5 — Confidence label derivation
// ---------------------------------------------------------------------------

export function deriveConfidenceLabel(
  robustness: { ranking_stability?: number; recommendation_stability?: number } | null | undefined,
): string | null {
  if (!robustness) return null
  const stability = robustness.recommendation_stability ?? robustness.ranking_stability
  if (stability == null) return null
  // Science UX Architecture v2 §4.2 thresholds
  if (stability >= 0.85) return 'Robust'
  if (stability >= 0.70) return 'Moderate'
  return 'Low'
}

// ---------------------------------------------------------------------------
// § 6 — selectModelCardData (store → view-model)
// ---------------------------------------------------------------------------

interface StoreSlice {
  nodes: Node[]
  edges: Edge[]
  currentGraphHash?: string
  lastAnalysisSeed: number | null
  lastQualityMode: string | null
  repairsApplied: RawRepair[] | null
  results: { status: string; report?: any }
  hasCompletedFirstRun: boolean
}

export function selectModelCardData(store: StoreSlice): ModelCardData {
  const report = store.results?.report
  const robustness = report?.robustness
  return {
    // Engine-produced only. Never compute from nodes/edges.
    graphHash: store.currentGraphHash ?? null,
    seed: store.lastAnalysisSeed,
    qualityMode: store.lastQualityMode,
    nodeCounts: countNodesByKind(store.nodes),
    edgeCount: store.edges.length,
    confidenceLabel: deriveConfidenceLabel(robustness),
    repairsApplied: formatRepairs(store.repairsApplied, store.nodes),
    hasResults: store.hasCompletedFirstRun,
  }
}

// ---------------------------------------------------------------------------
// § 7 — selectModelReceiptData (store → view-model for conversation block)
// ---------------------------------------------------------------------------

export interface ReceiptStoreSlice {
  nodes: Node[]
  edges: Edge[]
  ceeAnalysisReady: {
    status?: string
    coaching_summary?: string | null
    model_critiques?: Array<{ message: string }> | null
  } | null
  // `| undefined` so the full canvas store (where repairs_applied is optional)
  // is structurally assignable; formatRepairs already tolerates null/undefined.
  repairsApplied: RawRepair[] | null | undefined
}

export function selectModelReceiptData(store: ReceiptStoreSlice): ModelReceiptData | null {
  if (store.nodes.length === 0) return null

  const counts = countNodesByKind(store.nodes)
  const goalNode = store.nodes.find(n => (n.data?.kind ?? n.type) === 'goal')
  const goalLabel = goalNode?.data?.label as string | undefined

  // Top insight: first model critique or coaching summary first sentence
  const critiques = store.ceeAnalysisReady?.model_critiques
  const coaching = store.ceeAnalysisReady?.coaching_summary
  let topInsight: string | null = null
  if (critiques && critiques.length > 0) {
    topInsight = critiques[0].message
  } else if (coaching) {
    // Take first sentence
    const dot = coaching.indexOf('.')
    topInsight = dot > 0 ? coaching.slice(0, dot + 1) : coaching
  }

  // Top evidence gap: factors without observed data
  // Heuristic: find first factor node missing observedState.value
  let topEvidenceGap: string | null = null
  const factorNodes = store.nodes.filter(n => (n.data?.kind ?? n.type) === 'factor')
  for (const f of factorNodes) {
    const obs = f.data?.observedState as { value?: unknown } | undefined
    if (!obs || obs.value == null) {
      topEvidenceGap = `${f.data?.label ?? 'Unknown factor'}: no observed data`
      break
    }
  }

  // Readiness
  const status = store.ceeAnalysisReady?.status
  const readiness = status === 'ready' ? 'ready'
    : status === 'blocked' ? 'blocked'
    : status === 'incomplete' ? 'incomplete'
    : 'unknown'

  return {
    factorCount: counts.factor,
    edgeCount: store.edges.length,
    optionCount: counts.option,
    goalLabel: goalLabel ?? null,
    // CEE coaching, verbatim and untruncated (distinct from `topInsight`, which
    // takes only the first sentence). This is the card's main content.
    coachingSummary: coaching ?? null,
    topInsight,
    topEvidenceGap,
    readiness,
    adjustments: formatRepairs(store.repairsApplied, store.nodes),
  }
}

// ---------------------------------------------------------------------------
// § 8 — maybeBuildModelReceiptBlock (post-draft receipt gate)
// ---------------------------------------------------------------------------

/**
 * F1 PR B — construct the client-synthesised model_receipt block for the
 * post-draft assistant message, or return null.
 *
 * Pure and path-agnostic: it only reads the canvas store, so the same gate
 * serves the V5 live path (the one wired today) and a future V4 wiring. It
 * centralises the race/order rules so they are unit-testable in isolation.
 *
 * No receipt is better than a partial one (brief). A receipt is produced only
 * when ALL hold:
 *   - the flag is enabled;
 *   - this turn applied a fresh draft graph (`isDraftTurn`) — so the card fires
 *     once, on the generative turn, never on later conversational updates;
 *   - the graph is in the store (selectModelReceiptData returns non-null);
 *   - analysis_ready has been normalised into the store (`ceeAnalysisReady`);
 *   - CEE coaching survived into the store (`coachingSummary` is non-empty) —
 *     the coaching IS the card's value, so without it there is no card.
 */
export function maybeBuildModelReceiptBlock(args: {
  enabled: boolean
  isDraftTurn: boolean
  store: ReceiptStoreSlice
}): ModelReceiptBlockType | null {
  const { enabled, isDraftTurn, store } = args
  if (!enabled || !isDraftTurn) return null
  const data = selectModelReceiptData(store)
  if (!data) return null
  if (!store.ceeAnalysisReady) return null
  if (!data.coachingSummary || data.coachingSummary.trim().length === 0) return null
  return { type: 'model_receipt', ...data }
}
