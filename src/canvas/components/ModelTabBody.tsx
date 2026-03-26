/**
 * ModelTabBody — "Model" tab for the outputs dock.
 *
 * Sections: Goal · Options (collapsed) · Factors · Relationships · Risks (collapsed) · Audit (collapsed)
 * Above sections: StatusBar (actionable counts) + EntityBar (node composition).
 *
 * Typography: panelHeader (14px/600) · panelBody (12px/400) · panelMeta (11px/400)
 * British English throughout. Sentence case.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  memo,
} from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { getDisplayEdgeId, buildFragileEdgeLookup } from '../utils/edgeIdentity'
import { SectionErrorBoundary } from './GraphTextView'
import type { MappedRobustness } from '../../lib/mappers/types'
import { typography } from '../../styles/typography'
import { isModelCardLiteEnabled } from '../../flags'
import { ModelCardLite } from './ModelCardLite'
import { selectModelCardData } from '../adapters/modelCardAdapter'
import { trackGuidance } from '../../telemetry/guidanceEvents'
import { GoalSection } from './model-tab/GoalSection'
import { OptionsSection } from './model-tab/OptionsSection'
import { FactorsSection } from './model-tab/FactorsSection'
import { RelationshipsSection } from './model-tab/RelationshipsSection'
import type { UserAction, ValidationMetadata } from '../domain/validation'
import type { EdgeData } from '../domain/edges'
import { RisksSection } from './model-tab/RisksSection'
import { ModelHealthSection } from './model-tab/ModelHealthSection'
import { ModelTabHeader } from './model-tab/ModelTabHeader'
import { ReanalyseBar } from './model-tab/ReanalyseBar'
import { ModelFooter } from './model-tab/ModelFooter'
import { StatusBar } from './model-tab/StatusBar'
import { EntityBar } from './model-tab/EntityBar'
import { StreamingDiagnostics } from './model-tab/StreamingDiagnostics'
import { buildSynthesisedPriorMap } from './model-tab/synthesisedPriorHelpers'

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

// ── Main component ────────────────────────────────────────────────────────────

export const ModelTabBody = memo(function ModelTabBody({
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
  const rawV2Response = useCanvasStore(s => s.rawV2Response)

  // ── Scientific enrichment data from PLoT response ───────────────────────────
  // Single-pass extraction of all per-factor enrichment maps from factor_sensitivity.
  // Each map is keyed by factor node_id. Fields are only set when present in the response.

  const { evpiMap, attributionStabilityMap, elasticityMap, rankFlipRateMap, factorConfidenceMap } = useMemo(() => {
    const evpi = new Map<string, number>()
    const stability = new Map<string, string>()
    const elasticity = new Map<string, number>()
    const flipRate = new Map<string, number>()
    const confidence = new Map<string, number>()

    const factors = (rawV2Response as any)?.factor_sensitivity ??
      (rawV2Response as any)?.downstream_calls?.isl?.response?.factor_sensitivity ?? []
    if (!Array.isArray(factors)) {
      return { evpiMap: evpi, attributionStabilityMap: stability, elasticityMap: elasticity, rankFlipRateMap: flipRate, factorConfidenceMap: confidence }
    }

    for (const f of factors) {
      const id = f?.node_id ?? f?.factor_id
      if (!id) continue

      // EVPI: prefer evpi_percentage_points; fall back to VOI * 100 (UI-SEM-049)
      const evpiPp = typeof f?.evpi_percentage_points === 'number' && Number.isFinite(f.evpi_percentage_points)
        ? f.evpi_percentage_points : null
      const voi = typeof f?.value_of_information === 'number' && Number.isFinite(f.value_of_information)
        ? f.value_of_information : null
      const pp = evpiPp ?? (voi != null ? Math.round(voi * 100) : null)
      if (pp != null) evpi.set(id, pp)

      // Attribution stability (from PLoT, when present — no UI derivation)
      if (typeof f?.attribution_stability === 'string') stability.set(id, f.attribution_stability)

      // Elasticity
      if (typeof f?.elasticity === 'number') elasticity.set(id, f.elasticity)

      // Rank flip rate
      if (typeof f?.rank_flip_rate === 'number') flipRate.set(id, f.rank_flip_rate)

      // Confidence (0-1)
      if (typeof f?.confidence === 'number') confidence.set(id, f.confidence)
    }

    return { evpiMap: evpi, attributionStabilityMap: stability, elasticityMap: elasticity, rankFlipRateMap: flipRate, factorConfidenceMap: confidence }
  }, [rawV2Response])

  // Edge E-value map from ISL edge_e_values (already passed through in response mapper)
  const edgeEValueMap = useMemo(() => {
    const map = new Map<string, number>()
    const eValues = (results?.report as any)?.robustness?.edge_e_values
    if (!Array.isArray(eValues)) return map
    for (const ev of eValues) {
      if (typeof ev?.edge_id === 'string' && typeof ev?.e_value === 'number') {
        map.set(ev.edge_id, ev.e_value)
      }
    }
    return map
  }, [results])

  // Conditional winners from ISL (already passed through in response mapper)
  // Only include entries where required fields are present — no defaulting to 0 or ''
  const conditionalWinners = useMemo(() => {
    const raw = (results?.report as any)?.conditional_winners ??
      (results?.report as any)?.robustness?.conditional_winners
    if (!Array.isArray(raw) || raw.length === 0) return undefined
    const mapped = raw
      .filter((w: any) => {
        // Require factor label, split_value, and at least one bucket with a winner
        const hasLabel = w.factor_label || w.label
        const hasSplit = typeof w.split_value === 'number'
        const hasHigh = w.high_bucket?.winner_id || w.high_bucket?.option_id
        const hasLow = w.low_bucket?.winner_id || w.low_bucket?.option_id
        return hasLabel && hasSplit && (hasHigh || hasLow)
      })
      .map((w: any) => ({
        factorLabel: String(w.factor_label ?? w.label),
        factorId: String(w.factor_id ?? w.node_id ?? ''),
        splitValue: w.split_value as number,
        splitUnit: w.split_unit ?? w.unit ?? undefined,
        highBucket: {
          winnerId: String(w.high_bucket?.winner_id ?? w.high_bucket?.option_id ?? ''),
          winnerLabel: String(w.high_bucket?.winner_label ?? w.high_bucket?.label ?? ''),
          winProbability: typeof w.high_bucket?.win_probability === 'number' ? w.high_bucket.win_probability : undefined,
        },
        lowBucket: {
          winnerId: String(w.low_bucket?.winner_id ?? w.low_bucket?.option_id ?? ''),
          winnerLabel: String(w.low_bucket?.winner_label ?? w.low_bucket?.label ?? ''),
          winProbability: typeof w.low_bucket?.win_probability === 'number' ? w.low_bucket.win_probability : undefined,
        },
      }))
    return mapped.length > 0 ? mapped : undefined
  }, [results])

  // Audit trail for ModelHealthSection
  const auditTrail = useMemo(() => ({
    seedUsed: rawV2Response?.meta?.seed_used ?? null,
    responseHash: rawV2Response?.response_hash ?? null,
    nSamples: rawV2Response?.meta?.n_samples ?? null,
    repairsApplied: repairsApplied ?? null,
    inferenceWarnings: (() => {
      const raw = (results?.report as any)?.robustness?.inference_warnings
      return Array.isArray(raw) ? raw : null
    })(),
    recommendationStability: robustness?.recommendationStability ?? null,
    autoNoiseApplied: (rawV2Response as any)?.auto_noise_applied ?? (rawV2Response as any)?._meta?.auto_noise_applied ?? null,
    stabilityPenaltyFactor: (rawV2Response as any)?.stability_penalty_factor ?? null,
  }), [rawV2Response, repairsApplied, results, robustness])

  // Edge repairs map: filter repairs_applied by field_path containing edge identifiers
  const edgeRepairsMap = useMemo(() => {
    const map = new Map<string, Array<{ code: string; reason: string; before?: unknown; after?: unknown }>>()
    if (!repairsApplied || !Array.isArray(repairsApplied)) return map
    for (const r of repairsApplied) {
      if (!r?.field_path) continue
      // Match repairs with field_path containing "edge" or matching edge IDs
      const path = String(r.field_path)
      const match = path.match(/edges?\[([^\]]+)\]/) ?? path.match(/edge[_.](.+?)\./)
      if (!match) continue
      const edgeId = match[1]
      const existing = map.get(edgeId) ?? []
      existing.push({
        code: String(r.code ?? ''),
        reason: String(r.reason ?? ''),
        before: r.before,
        after: r.after,
      })
      map.set(edgeId, existing)
    }
    return map
  }, [repairsApplied])

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

  const fragileEdgeCount = hasRobustnessData ? fragileEdgeIds.size : 0

  // Count factors needing verification (cee_inference or no source)
  const factorsToVerify = useMemo(() => {
    return grouped.factor.filter(n => {
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state
      return !obs?.source || obs?.source === 'cee_inference'
    }).length
  }, [grouped.factor])

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
      // Display-only defaults for edge sort order — below UI-SEM tagging threshold.
      // Missing confidence → sort last (Infinity in ascending order)
      // Canvas store canonical name — CEE ingestion normalises to beliefExists
      const aConf = aData?.beliefExists ?? aData?.confidence
      const bConf = bData?.beliefExists ?? bData?.confidence
      const aConfVal = aConf != null ? aConf : Infinity
      const bConfVal = bConf != null ? bConf : Infinity
      if (Math.abs(aConfVal - bConfVal) > 0.001) return aConfVal - bConfVal

      // Missing weight → sort last (-Infinity in descending order)
      const aWeight = aData?.weight != null ? aData.weight : -Infinity
      const bWeight = bData?.weight != null ? bData.weight : -Infinity
      return bWeight - aWeight
    })
  }, [causalEdges, fragileEdgeSwitchProbMap])

  // ── Goal headline ─────────────────────────────────────────────────────────

  const goalNode = grouped.goal[0]
  const goalLabel = goalNode ? String((goalNode.data as any)?.label ?? goalNode.id) : null

  // ── Contested pending count (reactive — updates after each resolution) ───

  const contestedPendingCount = useMemo(() => {
    let count = 0
    for (const e of causalEdges) {
      const vm = (e.data as EdgeData | undefined)?.validation
      if (vm?.status === 'contested' && vm.user_action === 'pending') count++
    }
    return count
  }, [causalEdges])

  // ── Contested edge resolution ─────────────────────────────────────────────

  const handleResolveContested = useCallback((edgeId: string, action: UserAction, customMean?: number) => {
    const edge = edges.find(e => e.id === edgeId)
    if (!edge?.data) return

    const edgeData = edge.data as EdgeData
    const vm = edgeData.validation
    if (!vm) return

    // Spread preserves all ValidationMetadata fields; overlay user_action + resolved_by
    const updatedValidation: ValidationMetadata = { ...vm, user_action: action, resolved_by: 'user' }

    // updateEdge merges { ...e.data, ...updates.data }, so we only provide changed fields.
    // Casting the partial patch to EdgeData is safe: the store merge fills in the rest.
    type DataPatch = Partial<EdgeData>

    if (action === 'accepted_pass2') {
      const mean = vm.pass2.strength_mean
      const patch: DataPatch = {
        weight: Math.abs(mean),
        direction: mean >= 0 ? 'positive' : 'negative',
        validation: updatedValidation,
      }
      updateEdge(edgeId, { data: patch as EdgeData })
      return
    }

    if (action === 'overridden' && customMean !== undefined) {
      const patch: DataPatch = {
        weight: Math.abs(customMean),
        direction: customMean >= 0 ? 'positive' : 'negative',
        validation: { ...updatedValidation, resolved_value: { strength_mean: customMean } },
      }
      updateEdge(edgeId, { data: patch as EdgeData })
      return
    }

    // accepted_pass1 or dismissed — mark user_action only, no edge data change
    const patch: DataPatch = { validation: updatedValidation }
    updateEdge(edgeId, { data: patch as EdgeData })
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
        beliefExists: (e.data as any)?.beliefExists ?? null,
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
        contestedCount={contestedPendingCount > 0 ? contestedPendingCount : undefined}
        sortNote={hasRobustnessData && evpiMap.size > 0 ? 'ranked by EVPI' : hasRobustnessData ? undefined : 'alphabetical'}
      >
        {/* ── Status bar ─────────────────────────────────────────────── */}
        <StatusBar
          factorsToVerify={factorsToVerify}
          fragileEdgeCount={fragileEdgeCount}
          contestedCount={contestedPendingCount}
          evpiMap={evpiMap}
          recommendationStability={robustness?.recommendationStability}
          hasAnalysisData={hasRobustnessData}
        />

        {/* ── Entity composition bar ─────────────────────────────────── */}
        <EntityBar grouped={grouped} totalCount={nodes.length} />

        {/* ── Sections ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <GoalSection goalNode={grouped.goal[0]} />

          <OptionsSection
            optionNodes={grouped.option}
            allNodes={nodes}
            conditionalWinners={conditionalWinners}
            hasAnalysisData={hasRobustnessData}
          />

          <FactorsSection
            factorNodes={grouped.factor}
            factorInfluence={factorInfluence}
            synthesisedPriorMap={synthesisedPriorMap}
            selectedNodeIds={selectionNodeIds}
            evpiMap={evpiMap}
            attributionStabilityMap={attributionStabilityMap}
            elasticityMap={elasticityMap}
            rankFlipRateMap={rankFlipRateMap}
            factorConfidenceMap={factorConfidenceMap}
            hasAnalysisData={hasRobustnessData}
          />

          <RelationshipsSection
            edges={causalEdges}
            nodes={nodes}
            fragileEdgeIds={fragileEdgeIds}
            fragileEdgeSwitchProbMap={fragileEdgeSwitchProbMap}
            selectedEdgeIds={selectionEdgeIds}
            hasRobustnessData={hasRobustnessData}
            onResolveContested={handleResolveContested}
            edgeEValueMap={edgeEValueMap}
            edgeRepairsMap={edgeRepairsMap}
          />

          <RisksSection riskNodes={grouped.risk} allNodes={nodes} edges={edges} />

          <ModelHealthSection
            ceeQuality={ceeQuality}
            auditTrail={auditTrail}
          />
        </div>
      </ModelTabHeader>

      {/* ── Streaming diagnostics (Shift+D) ───────────────────────────────── */}
      <StreamingDiagnostics
        showDebug={showDebug}
        hasDiagnostics={hasDiagnostics}
        diagnostics={diagnostics}
        hasTrim={hasTrim}
        effectiveCorrelationId={effectiveCorrelationId}
        correlationMismatch={correlationMismatch}
        correlationIdHeader={correlationIdHeader}
      />

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
})
