/**
 * ModelTabBody — redesigned "Model" tab for the outputs dock (v2)
 *
 * Tasks implemented:
 *  1. Goal headline at top
 *  2. Node breakdown colour bar (6px, 1px gaps)
 *  3. Health summary cards (connectivity + evidence coverage)
 *  4. Attention banner (post-analysis only, fragile/missing-source/default)
 *  5. Factor cards — human-readable values, source mapping, external prior
 *  6. Edge cards — Likelihood label, helps/hurts chips, provenance row, clickable labels
 *  7. Options/Risks/Outcomes collapsed reference section
 *  8. Strengthen section with canonical evidence counting
 *  9. Footer: search + Copy as text
 * 10. Inline editing mechanics (click → edit, blur/Enter saves, Escape cancels)
 *
 * Typography: panelHeader (14px/600) · panelBody (12px/400) · panelMeta (11px/400)
 * British English throughout. Sentence case.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
} from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { getDisplayEdgeId, buildFragileEdgeLookup } from '../utils/edgeIdentity'
import { SectionErrorBoundary } from './GraphTextView'
import type { MappedRobustness } from '../../lib/mappers/types'
import type { CritiqueItemV1 } from '../../adapters/plot/types'
import { isModelCardLiteEnabled } from '../../flags'
import { ModelCardLite } from './ModelCardLite'
import { selectModelCardData } from '../adapters/modelCardAdapter'
import { trackGuidance } from '../../telemetry/guidanceEvents'
import { GoalSection } from './model-tab/GoalSection'
import { OptionsSection } from './model-tab/OptionsSection'
import { FactorsSection, type SynthesisedPrior } from './model-tab/FactorsSection'
import { RelationshipsSection } from './model-tab/RelationshipsSection'
import type { UserAction } from '../domain/validation'
import { RisksSection } from './model-tab/RisksSection'
import { ModelHealthSection } from './model-tab/ModelHealthSection'
import { ModelTabHeader } from './model-tab/ModelTabHeader'
import { ReanalyseBar } from './model-tab/ReanalyseBar'
import { StrengthenSection } from './model-tab/StrengthenSection'
import { ModelSummaryBar } from './model-tab/ModelSummaryBar'
import { ModelFooter } from './model-tab/ModelFooter'

// ── Types ────────────────────────────────────────────────────────────────────

interface ModelTabBodyProps {
  showDebug: boolean
  hasDiagnostics: boolean
  diagnostics: any
  hasTrim: boolean
  effectiveCorrelationId: string | null | undefined
  correlationMismatch: boolean
  correlationIdHeader: string | null | undefined
  nodes: Node[]
  edges: Edge[]
  robustness: MappedRobustness | null
  /** PLoT critique items — used to surface constraint warnings in Strengthen */
  critique?: CritiqueItemV1[] | null
  /** Factor influence map from PLoT enrichment — keyed by node ID */
  factorInfluence?: Map<string, number>
  /** Trigger analysis re-run */
  onReanalyse?: () => void
  /** CEE quality dimensions from store */
  ceeQuality?: import('../store').CeeQualityDimensions | null
}

// ── Source mapping ────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  brief_extraction: 'From brief',
  cee_inference: 'AI estimate',
  user: 'User edited',
}

function mapSourceToDisplay(source: string | undefined): string | null {
  if (!source) return null
  return SOURCE_LABELS[source] ?? source
}

const KIND_ORDER = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome'] as const
const EMPTY_NODE_IDS = new Set<string>()
const EMPTY_EDGE_IDS = new Set<string>()
type KindKey = typeof KIND_ORDER[number]

// ── Synthesised prior helpers ─────────────────────────────────────────────────

/**
 * Parse repair actions from ceePipelineTrace to find synthesised priors.
 * Actions look like: 'Reclassified unreachable factor "X" to external with synthesised prior [0, 0.14]'
 * Returns a map from node ID → { rangeMin, rangeMax }.
 */
function buildSynthesisedPriorMap(
  ceePipelineTrace: unknown,
  nodes: Node[],
): Map<string, SynthesisedPrior> {
  const map = new Map<string, SynthesisedPrior>()
  if (!ceePipelineTrace || typeof ceePipelineTrace !== 'object') return map

  const trace = ceePipelineTrace as Record<string, unknown>
  const repairSummary = trace.repair_summary ?? trace.repair
  if (!repairSummary || typeof repairSummary !== 'object') return map

  const summary = repairSummary as Record<string, unknown>
  const repairs = summary.deterministic_repairs
  if (!Array.isArray(repairs)) return map

  // Build label→id lookup for matching
  const labelToId = new Map<string, string>()
  for (const n of nodes) {
    const label = String((n.data as any)?.label ?? '').toLowerCase()
    if (label) labelToId.set(label, n.id)
  }

  for (const r of repairs) {
    if (!r || typeof r !== 'object') continue
    const repair = r as Record<string, unknown>

    // Structured fields (if CEE provides them)
    if (repair.node_id && repair.synthesised_range && Array.isArray(repair.synthesised_range)) {
      const [min, max] = repair.synthesised_range as number[]
      if (typeof min === 'number' && typeof max === 'number') {
        map.set(String(repair.node_id), { rangeMin: min, rangeMax: max })
        continue
      }
    }

    // Fallback: parse from action text
    const action = typeof repair.action === 'string' ? repair.action : ''
    const match = action.match(/synthesised prior\s*\[([^\]]+)\]/i)
    if (!match) continue
    const parts = match[1].split(',').map(s => parseFloat(s.trim()))
    if (parts.length !== 2 || parts.some(isNaN)) continue

    // Try to match by node_id first, then by quoted label in action text
    let nodeId = repair.node_id ? String(repair.node_id) : undefined
    if (!nodeId) {
      const labelMatch = action.match(/"([^"]+)"/)
      if (labelMatch) {
        nodeId = labelToId.get(labelMatch[1].toLowerCase())
      }
    }
    if (nodeId) {
      map.set(nodeId, { rangeMin: parts[0], rangeMax: parts[1] })
    }
  }

  return map
}

// ── Main component ────────────────────────────────────────────────────────────

export function ModelTabBody({
  showDebug,
  hasDiagnostics,
  diagnostics,
  hasTrim,
  effectiveCorrelationId,
  correlationMismatch,
  correlationIdHeader,
  nodes,
  edges,
  robustness,
  critique,
  factorInfluence,
  onReanalyse,
  ceeQuality,
}: ModelTabBodyProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Telemetry: fire MODEL_CARD_VIEWED once when the tab mounts
  useEffect(() => {
    const state = useCanvasStore.getState()
    trackGuidance('MODEL_CARD_VIEWED', {
      item_id: 'model_tab',
      item_type: 'trust',
      surface: 'model_tab',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as 'frame' | 'ideate' | 'evaluate' | 'decide' | undefined,
    })
  }, [])

  const ceePipelineTrace = useCanvasStore(s => s.ceePipelineTrace)
  // Phase 2A: Model Card Lite data from store
  const hasCompletedFirstRun = useCanvasStore(s => s.hasCompletedFirstRun)
  const currentGraphHash = useCanvasStore(s => s.currentGraphHash)
  const lastAnalysisSeed = useCanvasStore(s => s.lastAnalysisSeed)
  const lastQualityMode = useCanvasStore(s => s.lastQualityMode)
  const repairsApplied = useCanvasStore(s => s.repairsApplied)
  const results = useCanvasStore(s => s.results)
  const modelCardData = useMemo(
    () => selectModelCardData({
      nodes, edges, currentGraphHash,
      lastAnalysisSeed, lastQualityMode, repairsApplied,
      results, hasCompletedFirstRun,
    }),
    [nodes, edges, currentGraphHash, lastAnalysisSeed, lastQualityMode, repairsApplied, results, hasCompletedFirstRun],
  )
  const selectionNodeIds = useCanvasStore(s => s.selection?.nodeIds ?? EMPTY_NODE_IDS)
  const selectionEdgeIds = useCanvasStore(s => s.selection?.edgeIds ?? EMPTY_EDGE_IDS)
  const updateEdge = useCanvasStore(s => s.updateEdge)

  // ── Synthesised prior lookup from repair summary ───────────────────────────

  const synthesisedPriorMap = useMemo(
    () => buildSynthesisedPriorMap(ceePipelineTrace, nodes),
    [ceePipelineTrace, nodes],
  )

  // ── Node groups ───────────────────────────────────────────────────────────

  const grouped = useMemo<Record<KindKey, Node[]>>(() => {
    const g: Record<KindKey, Node[]> = {
      goal: [], decision: [], option: [], factor: [], risk: [], outcome: [],
    }
    for (const n of nodes) {
      const kind = (n.type ?? (n.data as any)?.kind ?? (n.data as any)?.type) as KindKey | undefined
      if (kind && kind in g) g[kind].push(n)
    }
    return g
  }, [nodes])

  // ── Causal edges (exclude organisational edges from/to decision/option) ───

  const decisionOptionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of [...grouped.decision, ...grouped.option]) ids.add(n.id)
    return ids
  }, [grouped])

  const causalEdges = useMemo(
    () => edges.filter(e => !decisionOptionIds.has(e.source) && !decisionOptionIds.has(e.target)),
    [edges, decisionOptionIds]
  )

  // ── Causal nodes (exclude organisational: decision, option) ───────────────
  // Used for connectivity card — these are the nodes that participate in analysis

  const causalNodes = useMemo(
    () => nodes.filter(n => !decisionOptionIds.has(n.id)),
    [nodes, decisionOptionIds]
  )

  // ── Robustness data ───────────────────────────────────────────────────────

  const hasRobustnessData = robustness !== null

  // Build a lookup keyed by RF edge.id, matching by source+target when PLoT canonical IDs differ
  const fragileLookup = useMemo(() => {
    if (!robustness?.fragileEdges?.length) return new Map<string, import('../../lib/mappers/types').MappedFragileEdge>()
    return buildFragileEdgeLookup(edges, robustness.fragileEdges)
  }, [edges, robustness?.fragileEdges])

  const fragileEdgeIds = useMemo(() => new Set(fragileLookup.keys()), [fragileLookup])

  const fragileEdgeSwitchProbMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const [rfId, fe] of fragileLookup) {
      if (fe.switchProbability !== undefined) map.set(rfId, fe.switchProbability)
    }
    return map
  }, [fragileLookup])

  // ── Attention banner (post-analysis only) ─────────────────────────────────

  // Truly missing: null/undefined/empty string (excludes AI-estimated)
  const factorsTrulyMissingSource = useMemo(() => {
    return grouped.factor.filter(n => {
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state
      return !obs?.source
    }).length
  }, [grouped.factor])

  // AI-estimated: source is 'cee_inference' — less severe than truly missing
  const factorsAiEstimated = useMemo(() => {
    return grouped.factor.filter(n => {
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state
      return obs?.source === 'cee_inference'
    }).length
  }, [grouped.factor])

  const fragileEdgeCount = hasRobustnessData ? fragileEdgeIds.size : 0

  const showAttentionBanner = hasRobustnessData && (
    fragileEdgeCount > 0 || factorsTrulyMissingSource > 0 || factorsAiEstimated > 0
  )

  // ── Factor sort: needs-attention first, then alpha ─────────────────────────

  const sortedFactors = useMemo(() => {
    return [...grouped.factor].sort((a, b) => {
      const srcA = (a.data as any)?.observedState?.source ?? (a.data as any)?.observed_state?.source
      const srcB = (b.data as any)?.observedState?.source ?? (b.data as any)?.observed_state?.source
      const extA = (a.data as any)?.category === 'external'
      const extB = (b.data as any)?.category === 'external'
      // Check explicit prior and synthesised prior fallback
      const priorMinA = (a.data as any)?.prior?.range_min ?? synthesisedPriorMap.get(a.id)?.rangeMin
      const priorMaxA = (a.data as any)?.prior?.range_max ?? synthesisedPriorMap.get(a.id)?.rangeMax
      const fullRangeA = extA && (priorMinA === undefined || priorMinA === 0) && (priorMaxA === undefined || priorMaxA === 1)
      const priorMinB = (b.data as any)?.prior?.range_min ?? synthesisedPriorMap.get(b.id)?.rangeMin
      const priorMaxB = (b.data as any)?.prior?.range_max ?? synthesisedPriorMap.get(b.id)?.rangeMax
      const fullRangeB = extB && (priorMinB === undefined || priorMinB === 0) && (priorMaxB === undefined || priorMaxB === 1)

      const needsA = (!srcA || srcA === 'cee_inference' || fullRangeA) ? 0 : 1
      const needsB = (!srcB || srcB === 'cee_inference' || fullRangeB) ? 0 : 1
      if (needsA !== needsB) return needsA - needsB
      const labelA = String((a.data as any)?.label ?? a.id)
      const labelB = String((b.data as any)?.label ?? b.id)
      return labelA.localeCompare(labelB)
    })
  }, [grouped.factor, synthesisedPriorMap])

  // ── Edge sort: fragile by switchProbability desc, then low likelihood, then high |effect| ─

  const sortedEdges = useMemo(() => {
    return [...causalEdges].sort((a, b) => {
      const aId = getDisplayEdgeId(a)
      const bId = getDisplayEdgeId(b)
      const aSwitchProb = fragileEdgeSwitchProbMap.get(aId) ?? -1
      const bSwitchProb = fragileEdgeSwitchProbMap.get(bId) ?? -1
      if (aSwitchProb !== bSwitchProb) return bSwitchProb - aSwitchProb

      const aData = a.data as any
      const bData = b.data as any
      const aConf = aData?.beliefExists ?? aData?.exists_probability ?? aData?.confidence ?? 0.7
      const bConf = bData?.beliefExists ?? bData?.exists_probability ?? bData?.confidence ?? 0.7
      if (Math.abs(aConf - bConf) > 0.001) return aConf - bConf

      const aWeight = aData?.weight ?? 0.5
      const bWeight = bData?.weight ?? 0.5
      return bWeight - aWeight
    })
  }, [causalEdges, fragileEdgeSwitchProbMap])

  // ── Goal headline ─────────────────────────────────────────────────────────

  const goalNode = grouped.goal[0]
  const goalLabel = goalNode ? String((goalNode.data as any)?.label ?? goalNode.id) : null

  // ── Contested edge resolution ─────────────────────────────────────────────

  const handleResolveContested = useCallback((edgeId: string, action: UserAction, customMean?: number) => {
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return

    const data = edge.data as Record<string, unknown>
    const vm = data?.validation as Record<string, unknown> | undefined
    if (!vm) return

    // Build updated validation as a plain object — spread preserves all ValidationMetadata fields
    const updatedValidation: Record<string, unknown> = { ...vm, user_action: action, resolved_by: 'user' }

    // Helper: cast a plain patch object to EdgeData — safe because EdgeDataSchema uses .passthrough()
    const asEdgeData = (patch: Record<string, unknown>) => patch as unknown as import('../domain/edges').EdgeData

    if (action === 'accepted_pass2') {
      // Update edge weight+direction to match pass2 values — explicit user choice
      const pass2 = vm.pass2 as Record<string, unknown> | undefined
      if (pass2) {
        const mean = pass2.strength_mean as number
        updateEdge(edgeId, {
          data: asEdgeData({ ...data, weight: Math.abs(mean), direction: mean >= 0 ? 'positive' : 'negative', validation: updatedValidation }),
        })
        return
      }
    }

    if (action === 'overridden' && customMean !== undefined) {
      // Store the user's custom value both as edge weight/direction and as resolved_value
      updateEdge(edgeId, {
        data: asEdgeData({
          ...data,
          weight: Math.abs(customMean),
          direction: customMean >= 0 ? 'positive' : 'negative',
          validation: { ...updatedValidation, resolved_value: { strength_mean: customMean } },
        }),
      })
      return
    }

    // accepted_pass1 or dismissed — mark user_action only, no edge data change
    updateEdge(edgeId, { data: asEdgeData({ ...data, validation: updatedValidation }) })
  }, [edges, updateEdge])

  const handleCopyText = useCallback(() => {
    const lines: string[] = []
    if (goalLabel) lines.push(`Goal: ${goalLabel}`)
    lines.push('')
    lines.push('Factors:')
    for (const n of sortedFactors) {
      const lbl = String((n.data as any)?.label ?? n.id)
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state ?? {}
      const src = obs.source ? ` [${mapSourceToDisplay(obs.source) ?? obs.source}]` : ' [no source]'
      lines.push(`  • ${lbl}${src}`)
    }
    lines.push('')
    lines.push('Edges:')
    for (const e of sortedEdges) {
      const src = nodes.find(n => n.id === e.source)
      const tgt = nodes.find(n => n.id === e.target)
      const fromLbl = String((src?.data as any)?.label ?? e.source)
      const toLbl = String((tgt?.data as any)?.label ?? e.target)
      lines.push(`  • ${fromLbl} → ${toLbl}`)
    }
    const text = lines.join('\n')
    navigator.clipboard?.writeText(text).catch(() => {})
  }, [goalLabel, sortedFactors, sortedEdges, nodes])

  const handleCopyJson = useCallback(() => {
    const payload = {
      goal: goalLabel ?? null,
      factors: sortedFactors.map(n => ({
        id: n.id,
        label: String((n.data as any)?.label ?? n.id),
        category: (n.data as any)?.category ?? null,
        observedState: (n.data as any)?.observedState ?? (n.data as any)?.observed_state ?? null,
        prior: (n.data as any)?.prior ?? null,
      })),
      edges: sortedEdges.map(e => ({
        id: getDisplayEdgeId(e),
        source: e.source,
        target: e.target,
        weight: (e.data as any)?.weight ?? null,
        direction: (e.data as any)?.direction ?? null,
        beliefExists: (e.data as any)?.beliefExists ?? (e.data as any)?.exists_probability ?? null,
        provenance: (e.data as any)?.provenance ?? null,
      })),
    }
    const json = JSON.stringify(payload, null, 2)
    navigator.clipboard?.writeText(json).catch(() => {})
  }, [goalLabel, sortedFactors, sortedEdges])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-4" data-testid="model-tab">

      {/* ── Model Card Lite (Phase 2A) ────────────────────────────────────── */}
      {isModelCardLiteEnabled() && nodes.length > 0 && (
        <SectionErrorBoundary section="model card">
          <ModelCardLite data={modelCardData} />
        </SectionErrorBoundary>
      )}

      {/* ── Header: factor/edge counts + "Show full detail" toggle ─────────── */}
      <ModelTabHeader
        factorCount={grouped.factor.length}
        edgeCount={causalEdges.length}
        fragileCount={fragileEdgeCount > 0 ? fragileEdgeCount : undefined}
      >
        {/* ── Goal section ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <GoalSection goalNode={grouped.goal[0]} />

          {/* ── Options section ─────────────────────────────────────────── */}
          <OptionsSection optionNodes={grouped.option} allNodes={nodes} />

          {/* ── Factors section ─────────────────────────────────────────── */}
          <FactorsSection
            factorNodes={grouped.factor}
            factorInfluence={factorInfluence}
            synthesisedPriorMap={synthesisedPriorMap}
            selectedNodeIds={selectionNodeIds}
          />

          {/* ── Relationships section ───────────────────────────────────── */}
          <RelationshipsSection
            edges={causalEdges}
            nodes={nodes}
            fragileEdgeIds={fragileEdgeIds}
            fragileEdgeSwitchProbMap={fragileEdgeSwitchProbMap}
            selectedEdgeIds={selectionEdgeIds}
            onResolveContested={handleResolveContested}
          />

          {/* ── Risks section ───────────────────────────────────────────── */}
          <RisksSection riskNodes={grouped.risk} allNodes={nodes} edges={edges} />

          {/* ── Model health section (collapsed) ────────────────────────── */}
          <ModelHealthSection
            nodes={causalNodes}
            edges={causalEdges}
            fragileEdgeCount={fragileEdgeCount}
            ceeQuality={ceeQuality}
          />
        </div>
      </ModelTabHeader>

      {/* ── Model summary bar (breakdown + health cards) ─────────────────────── */}
      <ModelSummaryBar
        nodes={nodes}
        causalEdges={causalEdges}
        causalNodes={causalNodes}
        grouped={grouped}
      />

      {/* ── Attention banner (post-analysis only) ─────────────────────────── */}
      {showAttentionBanner && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-sm bg-warning/[0.08] border border-warning/[0.18]"
          data-testid="model-attention-banner"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className={`${typography.panelBody} text-text-body`}>
              {[
                factorsTrulyMissingSource > 0
                  ? `${factorsTrulyMissingSource} factor${factorsTrulyMissingSource !== 1 ? 's' : ''} missing source`
                  : null,
                factorsAiEstimated > 0
                  ? `${factorsAiEstimated} AI-estimated`
                  : null,
                fragileEdgeCount > 0
                  ? `${fragileEdgeCount} fragile edge${fragileEdgeCount !== 1 ? 's' : ''}`
                  : null,
              ].filter(Boolean).join(' · ')}
            </div>
            <a
              href="#strengthen"
              className={`${typography.panelMeta} text-info hover:underline`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('model-strengthen')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Review in Strengthen ↓
            </a>
          </div>
        </div>
      )}

      {/* ── Strengthen section ────────────────────────────────────────────── */}
      <StrengthenSection
        nodes={nodes}
        causalEdges={causalEdges}
        fragileEdgeIds={fragileEdgeIds}
        fragileEdgeSwitchProbMap={fragileEdgeSwitchProbMap}
        hasRobustnessData={hasRobustnessData}
        critique={critique}
      />

      {/* ── Streaming diagnostics (Shift+D) ───────────────────────────────── */}
      {showDebug && (
        <div className="border-t border-panel-border pt-3 space-y-1" data-testid="model-streaming-diagnostics">
          <div className={`${typography.panelHeader} text-text-header mb-2`}>
            Streaming diagnostics
          </div>
          <div className="flex items-center justify-between">
            <span className={`${typography.panelBody} text-text-light`}>Resumes</span>
            <span className={`${typography.panelBody} text-text-header tabular-nums`} data-testid="diag-resumes">
              {hasDiagnostics ? diagnostics?.resumes ?? 0 : 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${typography.panelBody} text-text-light`}>Recovered events</span>
            <span className={`${typography.panelBody} text-text-header tabular-nums`} data-testid="diag-recovered">
              {hasDiagnostics ? diagnostics?.recovered_events ?? 0 : 0}
            </span>
          </div>
          <div className="flex items-center justify-between" data-testid="diag-trims">
            <span className={`${typography.panelBody} text-text-light`}>Buffer trimmed</span>
            <span className={`${typography.panelMeta} inline-flex items-center px-1.5 py-0.5 rounded border`}>
              {hasTrim
                ? <span className="bg-sun-50 text-sun-800 border-sun-200 px-1.5 py-0.5 rounded">Yes</span>
                : <span className="text-text-light border-panel-border px-1.5 py-0.5 rounded">No</span>}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-panel-border">
            <span className={`${typography.panelBody} text-text-light`}>Correlation ID</span>
            <div className="flex items-center gap-2">
              <span
                className={`font-mono ${typography.code} text-text-header max-w-[10rem] truncate`}
                data-testid="diag-correlation-value"
              >
                {effectiveCorrelationId ?? '—'}
              </span>
              {effectiveCorrelationId && (
                <button
                  type="button"
                  onClick={() => {
                    try { navigator.clipboard?.writeText(effectiveCorrelationId) } catch {}
                  }}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded border border-panel-border ${typography.code} text-text-light hover:bg-sand-50`}
                  data-testid="diag-correlation-copy"
                >
                  Copy
                </button>
              )}
            </div>
          </div>
          {correlationMismatch && (
            <p className={`${typography.code} text-sun-700`} data-testid="diag-correlation-mismatch">
              Correlation ID in diagnostics ({diagnostics?.correlation_id}) does not match header ({correlationIdHeader}).
            </p>
          )}
          <p className={`${typography.code} text-text-light`}>
            For deeper engine instrumentation, use the on-canvas diagnostics overlay via
            <code className="mx-1">?diag=1</code>.
          </p>
        </div>
      )}

      {!showDebug && (
        <p className={`${typography.panelMeta} text-text-light border-t border-panel-border pt-2`}>
          Press <kbd className={`px-1.5 py-0.5 bg-sand-100 rounded ${typography.panelMeta} font-mono`}>Shift+D</kbd> for streaming diagnostics
        </p>
      )}

      {/* ── Reanalyse bar (shown when graph edited since last run) ─────────── */}
      <ReanalyseBar onReanalyse={onReanalyse} />

      {/* ── Footer: search + copy ─────────────────────────────────────────── */}
      <ModelFooter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCopyText={handleCopyText}
        onCopyJson={handleCopyJson}
      />
    </div>
  )
}
