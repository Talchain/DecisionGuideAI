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
  useRef,
  memo,
} from 'react'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { useAnalysisTrust } from '../hooks/useAnalysisTrust'
import { AnalysisRunStateCover } from './AnalysisRunStateCover'
import { useUIStore } from '../../stores/uiStore'
import { getDisplayEdgeId, buildFragileEdgeLookup } from '../utils/edgeIdentity'
import { edgeValueSource, resolveEdgeValueDisplay, compareEdgeValueDisplays, type EdgeValueSource } from '../domain/edgeValueProvenance'
import { getCausalEdges } from '../domain/edgeUtils'
import { SectionErrorBoundary } from './GraphTextView'
import type { MappedRobustness } from '../../lib/mappers/types'
import { trackGuidance } from '../../telemetry/guidanceEvents'
import { GoalSection } from './model-tab/GoalSection'
import { buildGoalFitRows } from './model-tab/buildGoalFitRows'
import { OptionsSection } from './model-tab/OptionsSection'
import { FactorsSection } from './model-tab/FactorsSection'
import { RelationshipsSection } from './model-tab/RelationshipsSection'
import type { UserAction, ValidationMetadata } from '../domain/validation'
import { buildEdgeAdjudicationEvent } from '../conversation/edgeAdjudication'
import { useOptionalConversationContext } from '../conversation/ConversationContext'
import type { EdgeData } from '../domain/edges'
import { RisksSection } from './model-tab/RisksSection'
import { ModelHealthSection, type AuditTrailData } from './model-tab/ModelHealthSection'
import { normalizeAutoNoiseProvenance } from '../../components/results/types'
import { readInferenceWarnings } from '../../components/results/utils/readInferenceWarnings'
import { ModelTabHeader } from './model-tab/ModelTabHeader'
import { ReanalyseBar } from './model-tab/ReanalyseBar'
import { ModelFooter } from './model-tab/ModelFooter'
import { StatusBar } from './model-tab/StatusBar'
import { EntityBar } from './model-tab/EntityBar'
import { StreamingDiagnostics } from './model-tab/StreamingDiagnostics'
import { buildSynthesisedPriorMap } from './model-tab/synthesisedPriorHelpers'
import { countFactorsToVerify, mapSourceToDisplay } from './model-tab/utils'
import { ModelAdjustments } from './model-tab/ModelAdjustments'
import { resolveRawFactorConfidenceDisplay, type FactorConfidenceDisplay } from '../../components/results/driverConfidenceDisplayPolicy'

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
  expertMode?: boolean
  onSendMessage?: (message: string, opts?: { hidden?: boolean; debugSource?: string }) => void
}

// ── Source mapping ────────────────────────────────────────────────────────────
//
// ROADMAP 2.638 S2 — this file used to carry its OWN copy of the three-literal
// `SOURCE_LABELS` map, byte-identical to `model-tab/utils.ts`'s. It feeds
// `handleCopyText`, so a source outside the three landed in the user's
// clipboard as the raw wire literal ("user_confirmed"). The duplicate is gone;
// the one classification authority now serves both (trap 12: derive, do not
// mirror).

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
  expertMode,
  onSendMessage,
}: ModelTabBodyProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Single-open accordion: in default mode, only one section open at a time.
  // In expert mode (showDetail), sections manage their own state independently.
  const [openSection, setOpenSection] = useState<string | null>('factors')
  const isExpert = expertMode ?? false
  const makeSectionProps = useCallback((sectionId: string) => {
    if (isExpert) return {} // expert mode: uncontrolled (multi-open)
    return {
      isExpanded: openSection === sectionId,
      onExpandChange: (expanded: boolean) => setOpenSection(expanded ? sectionId : null),
    }
  }, [isExpert, openSection])

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

  // Mounted guard for the deferred scroll RAF below. Lets the callback skip
  // its DOM work if the Model tab unmounts (e.g. user switches the right
  // panel) between the frame being scheduled and it firing. Cheaper and safer
  // than reinstating cancelAnimationFrame, which previously raced the
  // store-clear re-render and killed the scroll altogether.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  // Cross-panel handoff: when another surface (e.g. PreAnalysisPanel's "See all
  // relationships" link) requests a section, open it and scroll into view, then
  // clear the request so it doesn't fire again on subsequent renders.
  //
  // Why no cancelAnimationFrame cleanup: clearing the request synchronously
  // triggers a re-render that fires the previous run's cleanup before the RAF
  // callback gets a chance to execute, killing the scroll. The mountedRef
  // guard above handles the unmount-during-RAF case without that race.
  const pendingSection = useUIStore(s => s.pendingModelTabSection)
  useEffect(() => {
    if (!pendingSection) return
    setOpenSection(pendingSection)
    requestAnimationFrame(() => {
      if (!mountedRef.current) return
      const el = document.querySelector<HTMLElement>(`[data-testid="model-${pendingSection}-section"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    useUIStore.getState().requestModelTabSection(null)
  }, [pendingSection])

  // F9 (UI brief 2026-07-16 item 3): run-state coverage. One trust surface:
  // the composed useAnalysisTrust answer drives the in-flight treatment.
  const trust = useAnalysisTrust()

  // P4 transport — contested-edge verdicts ride the conversation dispatcher
  // (deferral buffer included) when a provider is present; optional so an
  // isolated Model tab render still resolves locally.
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const ceePipelineTrace = useCanvasStore(s => s.ceePipelineTrace)
  const repairsApplied = useCanvasStore(s => s.repairsApplied)
  const results = useCanvasStore(s => s.results)
  const hasCompletedFirstRun = useCanvasStore(s => s.hasCompletedFirstRun)
  const selectionNodeIds = useCanvasStore(s => s.selection?.nodeIds ?? EMPTY_NODE_IDS)
  const selectionEdgeIds = useCanvasStore(s => s.selection?.edgeIds ?? EMPTY_EDGE_IDS)
  const updateEdge = useCanvasStore(s => s.updateEdge)
  const rawV2Response = useCanvasStore(s => s.rawV2Response)

  // ── Scientific enrichment data from PLoT response ───────────────────────────
  // Single-pass extraction of all per-factor enrichment maps from factor_sensitivity.
  // Each map is keyed by factor node_id. Fields are only set when present in the response.
  //
  // Source priority:
  //   1. results.report.factor_sensitivity — picked best source from the V1 mapper.
  //      Survives history loads (rawV2Response is null after Supabase hydration).
  //   2. rawV2Response.factor_sensitivity / downstream_calls — fresh-run fallback
  //      when the V1 mapper hasn't populated the report yet.

  const { attributionStabilityMap, elasticityMap, rankFlipRateMap, factorConfidenceMap } = useMemo(() => {
    const stability = new Map<string, string>()
    const elasticity = new Map<string, number>()
    const flipRate = new Map<string, number>()
    const confidence = new Map<string, FactorConfidenceDisplay>()

    const reportFactors = (results?.report as any)?.factor_sensitivity
    const rawTopLevelFactors = (rawV2Response as any)?.factor_sensitivity
    const rawDownstreamFactors = (rawV2Response as any)?.downstream_calls?.isl?.response?.factor_sensitivity
    const factors =
      (Array.isArray(reportFactors) && reportFactors.length > 0 && reportFactors) ||
      (Array.isArray(rawTopLevelFactors) && rawTopLevelFactors.length > 0 && rawTopLevelFactors) ||
      (Array.isArray(rawDownstreamFactors) && rawDownstreamFactors) ||
      []
    if (!Array.isArray(factors)) {
      return { attributionStabilityMap: stability, elasticityMap: elasticity, rankFlipRateMap: flipRate, factorConfidenceMap: confidence }
    }

    for (const f of factors) {
      const id = f?.node_id ?? f?.factor_id
      if (!id) continue

      // ⛔ EVPI PERCENTAGE POINTS — EXTRACTION REMOVED, DO NOT REINSTATE.
      //
      // This built `evpiMap`, which fed three user-visible surfaces on the
      // model tab: the "Worth Xpp if resolved" factor chip, the `EVPI  Xpp`
      // detail row, the StatusBar `"Xpp via EVPI"` chip (a SUM of the top three
      // figures) — plus the factor list's ORDER and the visible
      // `ranked by EVPI` label above it.
      //
      // `evpi_percentage_points` is not merely uncalibrated, it is REFUTED.
      // Replayed live 2026-07-25 against PLoT 1dd45b6a → ISL 3aea011c: PLoT
      // published 12.3pp for *Market Receptivity to Feature* while ISL, in the
      // SAME response one level away, measured that factor at
      // `p_win_delta_percentage_points: 0.0` and `factor_evppi: 0.0`. Likewise
      // 10.2 and 6.6 on decision a4b32ee2, both 0.0 at ISL.
      //
      // The formula (PLoT coaching/evidence-gaps.ts:75) is
      // `voi × winProbSpread × 100` — it multiplies BY the top-two
      // win-probability gap, INVERTING decision theory: a foregone conclusion
      // scores high and a coin-flip scores ~0. ISL measures the near-tied
      // decision as worth 16× the foregone one; PLoT ranks them opposite.
      //
      // The earlier P1-9 note here was right that a unit-conflated fallback was
      // worse than a blank surface. This goes one step further: the field
      // itself does not support the claim, so there is no honest surface to
      // keep alive. See tests/contracts/no-evpi-display.contract.test.ts.

      // Attribution stability (from PLoT, when present — no UI derivation)
      if (typeof f?.attribution_stability === 'string') stability.set(id, f.attribution_stability)

      // Elasticity
      if (typeof f?.elasticity === 'number') elasticity.set(id, f.elasticity)

      // Rank flip rate
      if (typeof f?.rank_flip_rate === 'number') flipRate.set(id, f.rank_flip_rate)

      // Confidence (0-1) — resolved through THE shared display policy
      // (components/results/driverConfidenceDisplayPolicy), never read raw.
      //
      // ⛔ This map fed "Confidence NN%" in the factor detail rows off the same
      // `factor_sensitivity[].confidence` the Drivers panel refuses to render.
      // In both real staging captures that value is a defaulted 0.25. The
      // resolver reads the confidence fields off the RAW row here (this surface
      // never touches the normalised driver feed), so there is still only one
      // implementation of the rule.
      // F9: the MAP now carries the resolved DISPLAY, not the value. A number
      // in this map was a value stripped of the decision that produced it —
      // the next reader had to re-derive whether it was showable, which is the
      // fork this module exists to close.
      confidence.set(id, resolveRawFactorConfidenceDisplay(f))
    }

    return { attributionStabilityMap: stability, elasticityMap: elasticity, rankFlipRateMap: flipRate, factorConfidenceMap: confidence }
  }, [rawV2Response, results?.report])

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
      // ROADMAP 2.173 (Paul-ratified 2026-07-30): shared dual read — ROOT
      // slot first, then the legacy `robustness` nesting. This read was
      // robustness-only, which is empty on every live run (0/827 measured
      // 2026-07-30; root 419/827 non-empty), so the ModelHealthSection
      // banner and audit row were permanently blank. See
      // readInferenceWarnings' header for the adoption history.
      const raw = readInferenceWarnings(results?.report as never)
      return Array.isArray(raw)
        ? (raw as NonNullable<AuditTrailData['inferenceWarnings']>)
        : null
    })(),
    recommendationStability: robustness?.recommendationStability ?? null,
    // Legacy fallback: older PLoT builds emitted the flag under `_meta`
    // before it was promoted to a top-level field. Cached/hydrated bundles
    // captured pre-promotion still rely on this read path; without it the
    // Model card audit row vanishes for those bundles. Same `as any` shape
    // as stabilityPenaltyFactor below (legacy fields aren't on V2RunResponse).
    autoNoiseApplied:
      rawV2Response?.auto_noise_applied
      ?? (rawV2Response as any)?._meta?.auto_noise_applied
      ?? null,
    autoNoiseProvenance: normalizeAutoNoiseProvenance(rawV2Response?.auto_noise_provenance),
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

  // ── Model adjustments — CEE structural repairs with resolved node labels ──
  // Mirror of usePreAnalysisData Task 6 logic; kept here so ModelTabBody can
  // own the transparency surface without importing the full pre-analysis hook.

  const modelAdjustments = useMemo(() => {
    const raw = (ceeAnalysisReady as Record<string, unknown> | null)?.model_adjustments
    if (!Array.isArray(raw)) return []
    return raw.map((adj: Record<string, unknown>) => {
      const target = adj.target
      if (!target || typeof target !== 'string') return adj
      const node = nodes.find(n => n.id === target)
      const nodeLabel = node ? (node.data as { label?: string })?.label : null
      if (nodeLabel) return { ...adj, target: nodeLabel, targetNodeId: target }
      const cleaned = target
        .replace(/^fac_/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
      return { ...adj, target: cleaned, targetNodeId: target }
    })
  }, [ceeAnalysisReady, nodes])

  const modelRepairActions = useMemo<string[]>(() => {
    if (!ceePipelineTrace) return []
    const trace = ceePipelineTrace as unknown as Record<string, unknown>
    const repairSummary = trace.repair_summary ?? trace.repair
    if (!repairSummary || typeof repairSummary !== 'object') return []
    const summary = repairSummary as Record<string, unknown>
    const repairs = summary.deterministic_repairs
    if (!Array.isArray(repairs)) return []
    return repairs
      .map((r: unknown) => {
        if (r && typeof r === 'object' && 'action' in r) return String((r as { action: unknown }).action)
        return null
      })
      .filter((s): s is string => s !== null)
  }, [ceePipelineTrace])

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
  // Centralised in edgeUtils.getCausalEdges so ModelTabBody and PreAnalysisPanel
  // (cross-panel "See all relationships" link) share one definition.

  const causalEdges = useMemo(
    () => getCausalEdges(nodes, edges as Edge<EdgeData>[]),
    [nodes, edges]
  )

  // Per-option goal-fit rows for the goal card (journey-walk §10.4 tab
  // parity). Same source object the conditional-winners and e-value maps
  // above already read (`results.report`); the chooser and the complete-field
  // gate live in buildGoalFitRows.
  const goalFitRows = useMemo(() => {
    const report = (results as { report?: { option_probabilities?: Record<string, unknown> } } | null)
      ?.report
    return buildGoalFitRows(grouped.option, report?.option_probabilities)
  }, [results, grouped.option])

  // ── Robustness data ───────────────────────────────────────────────────────

  // hasAnalysisData is true if either:
  //   - robustness has been mapped from the latest report, OR
  //   - the user has completed at least one analysis run in this session
  // (the second branch matters after Supabase hydration where robustness may
  //  be stale or omitted while hasCompletedFirstRun is restored).
  const hasRobustnessData = robustness !== null || hasCompletedFirstRun

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

  const factorsToVerify = useMemo(() => countFactorsToVerify(grouped.factor), [grouped.factor])

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

      const aData = a.data as Record<string, unknown> | undefined
      const bData = b.data as Record<string, unknown> | undefined

      // ⛔ Provenance gate on the ORDER. The sentinels here were wrong twice:
      // `!= null` is a tautology (`DEFAULT_EDGE_DATA`/`USER_EDGE_DEFAULTS`
      // always define both fields, so neither arm could fire and every
      // defaulted edge ranked as a measured one), and the two sentinels had
      // OPPOSITE SIGNS — `+Infinity` for the ascending key, `-Infinity` for the
      // descending one — a hand-compensation that silently inverts the moment
      // either sort direction changes. `compareEdgeValueDisplays` puts unset
      // last in BOTH directions without a sentinel, so the order cannot drift
      // from the intent. The export payload below this list was already gated;
      // this brings the on-screen order into line with the copied JSON.
      const aConf = resolveEdgeValueDisplay(aData, 'beliefExists')
      const bConf = resolveEdgeValueDisplay(bData, 'beliefExists')
      const confOrder = compareEdgeValueDisplays(aConf, bConf, 'asc')
      const bothConfShown = aConf.show && bConf.show
      if (!bothConfShown ? confOrder !== 0 : Math.abs(aConf.value - bConf.value) > 0.001) {
        return confOrder
      }

      return compareEdgeValueDisplays(
        resolveEdgeValueDisplay(aData, 'weight'),
        resolveEdgeValueDisplay(bData, 'weight'),
        'desc',
      )
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
  //
  // ROADMAP 2.121 slice 1 — THE ONE HANDLER THAT DELIBERATELY STAYS A RAW WRITE,
  // stated here rather than quietly excepted in the guard spec.
  //
  // Slice 1 moved every Model-tab edit onto the sanctioned mutation setters.
  // This one cannot go with them, for two independent reasons:
  //
  //   1. No sanctioned setter writes edge `validation`. It is not in
  //      `EDGE_SETTER_FIELDS` — it is UI-domain metadata carried by passthrough,
  //      not a contract-declared edge field — and the overlay below (user_action,
  //      resolved_by, resolved_value) is the whole point of the action.
  //   2. `useEdgeMutations().setStrength` hard-codes `weightSource: 'user'`. The
  //      `accepted_pass2` branch commits the PRODUCER's pass-2 estimate, whose
  //      honest marker is 'cee'. Routing it through setStrength would stamp a
  //      producer number as a user number — provenance laundering, the exact
  //      class the F11 guard exists to prevent. A wrong marker here is worse
  //      than a raw write.
  //
  // So it stays, rowed as an honest deviation rather than forced through a third
  // write path. Making it sanctioned needs a setter that writes validation and
  // takes the provenance marker as an argument — a change to the shared arc, not
  // a slice-1 rerouting. The guard spec's scope is named accordingly.
  const handleResolveContested = useCallback((
    edgeId: string,
    action: UserAction,
    customMean?: number,
    // ROADMAP 2.263 — the provenance of the SIGN in `customMean`, supplied by
    // the control the user actually touched. `undefined` keeps the historical
    // behaviour ('user'); `null` means nothing states a direction, so we must
    // not derive one from the number.
    directionSource?: EdgeValueSource | null,
  ) => {
    const edge = edges.find(e => e.id === edgeId)
    if (!edge?.data) return

    const edgeData = edge.data as EdgeData
    const vm = edgeData.validation
    if (!vm) return

    // P4 transport (schemas 0.34.0) — the verdict REACHES THE WIRE. Runs
    // AFTER the local apply (the canvas must move regardless of the network),
    // best-effort: a failed send never reverts a resolution the user already
    // made locally, and an absent conversation context (e.g. isolated render)
    // must not break resolution at all. CEE persists the event as a typed
    // turn fact and writes no graph. The per-verdict value: an override
    // carries the user's own number; an accepted verdict carries the accepted
    // pass's mean, informatively, so the persisted fact is self-contained.
    const emitAdjudication = (mean?: number) => {
      if (!sendSystemEvent) return
      const event = buildEdgeAdjudicationEvent(edge, action, mean)
      if (event === null) return
      void Promise.resolve(sendSystemEvent(event)).catch(() => {
        // Background judgement receipt — the local resolution stands; the
        // user can re-adjudicate to re-emit. Mirrors the silent handling of
        // other best-effort background sends.
      })
    }

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
        // The accepted value is the producer's pass-2 strength, so the edge
        // now carries a real estimate rather than the UI default. The pass-2
        // mean is PRODUCER-SIGNED, so its sign is the producer's own stated
        // direction — stamping 'cee' here is reading it, not inferring it
        // (ROADMAP 2.263; see `directionFromProducerSignedMean`).
        weightSource: 'cee',
        directionSource: 'cee',
        validation: updatedValidation,
      }
      updateEdge(edgeId, { data: patch as EdgeData })
      emitAdjudication(mean)
      return
    }

    if (action === 'overridden' && customMean !== undefined) {
      // ROADMAP 2.263 — the MAGNITUDE is always the user's; the DIRECTION is
      // only theirs if they actually stated it. The signed slider does
      // ('user'); the band quick-set pills do not — their sign rides in from
      // the edge's stated direction or the producer's pass-2 mean, and is
      // stamped with THAT source. `null` means nothing states one, so both the
      // direction and its stamp are omitted and the edge keeps reading "not
      // stated" rather than being handed a sign taken off a magnitude.
      const patch: DataPatch = {
        weight: Math.abs(customMean),
        weightSource: 'user',
        ...(directionSource === null
          ? {}
          : {
              direction: customMean >= 0 ? 'positive' : 'negative',
              directionSource: directionSource ?? 'user',
            }),
        validation: { ...updatedValidation, resolved_value: { strength_mean: customMean } },
      }
      updateEdge(edgeId, { data: patch as EdgeData })
      emitAdjudication(customMean)
      return
    }

    // accepted_pass1 or dismissed — mark user_action only, no edge data change
    const patch: DataPatch = { validation: updatedValidation }
    updateEdge(edgeId, { data: patch as EdgeData })
    // accepted_pass1 keeps the CURRENT (pass1) value; a dismissal asserts none
    // (the builder drops the value for `dismissed` by contract).
    emitAdjudication(action === 'accepted_pass1' ? vm.pass1.strength_mean : undefined)
  }, [edges, updateEdge, sendSystemEvent])

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
      // ⛔ F7. The three numbers below are `DEFAULT_EDGE_DATA` /
      // `USER_EDGE_DEFAULTS` on any edge nobody characterised, and this
      // payload lands on the user's clipboard — where nothing downstream can
      // tell a chosen 0.3 from a fabricated one. The stamps now travel WITH
      // the values, derived from the same accessor the renderers use, so the
      // export cannot disagree with the screen about what is known.
      edges: sortedEdges.map(e => {
        const data = e.data as Record<string, unknown> | undefined
        return {
          id: getDisplayEdgeId(e),
          source: e.source,
          target: e.target,
          weight: (data as Record<string, unknown> | undefined)?.weight ?? null,
          weightSource: edgeValueSource(data, 'weight'),
          direction: (data as Record<string, unknown> | undefined)?.direction ?? null,
          beliefExists: (data as Record<string, unknown> | undefined)?.beliefExists ?? null,
          beliefExistsSource: edgeValueSource(data, 'beliefExists'),
          provenance: (data as Record<string, unknown> | undefined)?.provenance ?? null,
        }
      }),
    }
    const json = JSON.stringify(payload, null, 2)
    navigator.clipboard?.writeText(json).catch(() => {})
  }, [goalLabel, sortedFactors, sortedEdges])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="space-y-4 pb-4"
      data-testid="model-tab"
      aria-busy={trust.isRunning || undefined}
    >

      {/* F9: run in flight — banner above the retained model (marked, never
          blanked); defensive skeleton when there is no model to retain. The
          dock-level announcer carries the aria-live announcement. */}
      <AnalysisRunStateCover
        isRunning={trust.isRunning}
        startedAt={trust.runStartedAt}
        contentRetained={nodes.length > 0}
      />

      {/* ── Header: factor/edge counts + "Show full detail" toggle ─────────── */}
      {/* No sort label post-analysis. The list is ordered by influence, and we
          do not assert that its order encodes value — the previous
          'ranked by EVPI' label named a quantity our own compute layer
          contradicts, and it was a VISIBLE claim, not just an internal sort. */}
      <ModelTabHeader
        factorCount={grouped.factor.length}
        edgeCount={causalEdges.length}
        fragileCount={fragileEdgeCount > 0 ? fragileEdgeCount : undefined}
        contestedCount={contestedPendingCount > 0 ? contestedPendingCount : undefined}
        sortNote={hasRobustnessData ? undefined : 'alphabetical'}
        showDetail={expertMode ?? false}
      >
        {/* ── Status bar ─────────────────────────────────────────────── */}
        <StatusBar
          factorsToVerify={factorsToVerify}
          fragileEdgeCount={fragileEdgeCount}
          contestedCount={contestedPendingCount}
          recommendationStability={robustness?.recommendationStability}
          hasAnalysisData={hasRobustnessData}
        />

        {/* ── Entity composition bar ─────────────────────────────────── */}
        <EntityBar grouped={grouped} totalCount={nodes.length} />

        {/* ── Sections ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <GoalSection goalNode={grouped.goal[0]} onSendMessage={onSendMessage} goalFitRows={goalFitRows} />

          <OptionsSection
            optionNodes={grouped.option}
            allNodes={nodes}
            conditionalWinners={conditionalWinners}
            hasAnalysisData={hasRobustnessData}
            onSendMessage={onSendMessage}
            {...makeSectionProps('options')}
          />

          <FactorsSection
            factorNodes={grouped.factor}
            factorInfluence={factorInfluence}
            synthesisedPriorMap={synthesisedPriorMap}
            selectedNodeIds={selectionNodeIds}
            attributionStabilityMap={attributionStabilityMap}
            elasticityMap={elasticityMap}
            rankFlipRateMap={rankFlipRateMap}
            factorConfidenceMap={factorConfidenceMap}
            hasAnalysisData={hasRobustnessData}
            onSendMessage={onSendMessage}
            {...makeSectionProps('factors')}
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
            onSendMessage={onSendMessage}
            {...makeSectionProps('relationships')}
          />

          <RisksSection
            riskNodes={grouped.risk}
            allNodes={nodes}
            edges={edges}
            hasFragileEdges={fragileEdgeIds.size > 0}
            onSendMessage={onSendMessage}
            {...makeSectionProps('risks')}
          />

          {/* CEE structural repairs — shown whenever CEE returned model_adjustments.
              Moved here from PreAnalysisPanel per Signal Registry v3: truth.structural_repairs
              belongs on the Model tab. */}
          <ModelAdjustments
            adjustments={modelAdjustments}
            repairActions={modelRepairActions}
          />

          <ModelHealthSection
            ceeQuality={ceeQuality}
            auditTrail={auditTrail}
            factorCount={grouped.factor.length}
            edgeCount={causalEdges.length}
            factorsToVerify={factorsToVerify}
            onSendMessage={onSendMessage}
            {...makeSectionProps('modelcard')}
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
