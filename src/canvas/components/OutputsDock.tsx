/**
 * OutputsDock - Canonical right-side outputs dock (CURRENT UX)
 *
 * ✅ ARCHITECTURE NOTE:
 * This is the **canonical Results UX** for the canvas. It provides a streamlined,
 * dock-based interface with three tabs:
 *
 * Tabs:
 * - Results: Pre-run validation + Run button, post-run KPI headline, range display,
 *            insights panel, decision review, top drivers
 * - Compare: Side-by-side run comparison with delta interpretation
 * - Structure: Graph text view with node breakdown, evidence stats, streaming diagnostics
 *
 * This component supersedes the legacy ResultsPanel (src/canvas/panels/ResultsPanel.tsx),
 * which is NOT currently rendered in the main canvas flow.
 *
 * Features:
 * - Auto-opens on run completion/error
 * - Resizable width
 * - Persistent state in localStorage
 * - Syncs with `showResultsPanel` store flag for UI coordination
 * - Auto-fix for validation issues with telemetry tracking
 * - Slow-run feedback messages (20s/40s thresholds)
 */

import { useEffect, useState, useRef, useMemo, useCallback, type ChangeEvent } from 'react'
import { BarChart3, Shuffle, Activity, Clock, AlertTriangle, XCircle, MessageCircle, CheckCircle } from 'lucide-react'
import { getStabilityClassification } from '../../lib/stability'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore, type OutputTab } from '../../stores/uiStore'
import { useDockState } from '../hooks/useDockState'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useCanvasStore, selectResultsStatus, selectReport, selectError, selectResultsSource, selectPreviousReport } from '../store'
import { loadRuns, type StoredRun } from '../store/runHistory'
import * as runsBus from '../store/runsBus'
import { typography } from '../../styles/typography'
import { selectScenarioLastRun } from '../shared/lastRun'
import {
  trackCompareOpened,
  trackAutoFixClicked,
  trackAutoFixSuccess,
  trackAutoFixFailed,
} from '../utils/sandboxTelemetry'
import { DeltaInterpretation } from './DeltaInterpretation'
import { isJourneyTabEnabled } from '../../flags'
import { ModelHealthBadge } from './ModelHealthSection'
import { getObjectiveText, getGoalDirection } from '../utils/getObjectiveText'
import { computeDelta, deriveVerdict } from '../utils/interpretOutcome'
import { useDebugShortcut } from '../hooks/useDebugShortcut'
import { RANGE_TERMINOLOGY } from '../../config/terminology'
import { IdentifiabilityBadge, normalizeIdentifiabilityTag } from './IdentifiabilityBadge'
import { ValidationPanel, type CritiqueItem } from './ValidationPanel'
import { PreAnalysisPanel } from './pre-analysis'
import { useConversation } from '../conversation/useConversation'
import { canRunAnalysis as canRunAnalysisUtil, getRunButtonTooltip } from '../utils/canRunAnalysis'
import { WarningBanner } from './WarningBanner'
import { DegradedStateBanner } from './DegradedStateBanner'
import { mapConfidenceToReadiness } from '../utils/mapConfidenceToReadiness'
import { useV2Run, type V2RunPersistence } from '../hooks/useV2Run'
import { useScenario } from '../../hooks/useScenario'
import { focusNodeById } from '../utils/focusHelpers'
import { ModelTabBody } from './ModelTabBody'
import { JourneyTabBody } from '../journey/JourneyTabBody'
// Results Panel Redesign: v7 four-section layout components
import { useResultsSectionData } from '../../components/results/useResultsSectionData'
import type { TornadoRow } from '../../components/results/TornadoChart'
import { useCanvasResultsSync } from '../../components/results/useCanvasResultsSync'
import { ResultsBody } from '../../components/results/ResultsBody'
import { useGuidanceStore } from '../stores/guidanceStore'
import type { GuidanceItem } from '../stores/guidanceStore'
import { executeAutoFix, determineFixType, type AutoFixParams } from '../utils/autoFix'
import { getStrengthCorrections } from '../../adapters/plot/v2/adapter'
// P0.6: User-friendly error messages
import { getUserFriendlyError } from '../../lib/userFriendlyErrors'
import { areDriversInformative } from '../../lib/driversGating'
import { useDegeneracyDismissal } from './DegeneracyWarning'
// P0.7: Loading skeletons
import { ResultsPanelSkeleton } from './ResultsPanelSkeleton'
// P0.8: Instrumentation
import { trackRunStarted, trackRunCompleted, trackRunFailed } from '../../lib/resultsInstrumentation'
import { useComparisonDetection } from '../hooks/useComparisonDetection'
import { useScenarioComparison } from '../hooks/useScenarioComparison'
import { useRobustness } from '../hooks/useRobustness'
import { mapRobustness } from '../../lib/mappers/mapRobustness'
import type { MappedRobustness } from '../../lib/mappers/types'
import { getUiSurfaceState, type InteractionStateSnapshot } from '../../lib/debug-state'
// ScenarioComparison modal removed - now rendered as ComparisonCanvasLayout in ReactFlowGraph
import type { CritiqueItemV1 } from '../../adapters/plot/types'
import { verboseDebug } from '../../utils/verboseLog'
import { AnalysisFooter } from '../shared/AnalysisFooter'
import { StabilityGauge } from '../../components/shared/StabilityGauge'
import { DeltaIndicator } from '../../components/shared/DeltaIndicator'
import { DEFAULT_EDGE_DATA } from '../domain/edges'
import { useGraphReadiness } from '../hooks/useGraphReadiness'

/**
 * Map API critique format (CritiqueItemV1) to ValidationPanel format
 * Converts severity to level and passes through node/edge references for click-to-focus
 * Only marks items as auto_fixable if we actually support that fix type
 */
function mapCritiqueToValidation(critique: CritiqueItemV1[] | undefined): CritiqueItem[] {
  if (!critique || critique.length === 0) return []

  return critique.map(c => ({
    level: c.severity === 'BLOCKER' ? 'blocker' : c.severity === 'WARNING' ? 'warning' : 'info',
    message: c.message,
    code: c.code,
    node_id: c.node_id,
    edge_id: c.edge_id,
    suggested_fix: c.suggested_fix,
    // Only show auto-fix button if we actually support this fix type
    auto_fixable: c.auto_fixable && c.code ? !!determineFixType(c.code) : false,
  }))
}

type OutputsDockTab = 'results' | 'compare' | 'diagnostics' | 'journey'

interface OutputsDockState {
  isOpen: boolean
  activeTab: OutputsDockTab
}

const STORAGE_KEY = 'canvas.outputsDock.v1'

// Feature flag for Phase 1A.1: Verdict Card + Delta Interpretation
const SHOW_VERDICT_FEATURES = import.meta.env.VITE_SHOW_VERDICT_CARD === 'true'

const OUTPUT_TABS: { id: OutputsDockTab; label: string }[] = [
  { id: 'results', label: 'Analysis' },
  { id: 'compare', label: 'Compare' },
  { id: 'diagnostics', label: 'Model' },
  ...(isJourneyTabEnabled() ? [{ id: 'journey' as const, label: 'Journey' }] : []),
]

export function OutputsDock() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [state, setState] = useDockState<OutputsDockState>(STORAGE_KEY, {
    isOpen: true,
    activeTab: 'results',
  })
  const { sendMessage } = useConversation()

  // Journey tab guard: if persisted tab is 'journey' but flag is off, reset to 'results'
  useEffect(() => {
    if (state.activeTab === 'journey' && !isJourneyTabEnabled()) {
      setState(prev => ({ ...prev, activeTab: 'results' }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- one-time init guard

  // E1: Sync external tab changes from Zustand store (programmatic navigation)
  const externalTab = useUIStore(s => s.activeOutputTab)
  const prevExternalTabRef = useRef(externalTab)
  useEffect(() => {
    if (externalTab !== prevExternalTabRef.current) {
      prevExternalTabRef.current = externalTab
      setState(prev => {
        if (prev.activeTab === externalTab && prev.isOpen) return prev
        return { ...prev, isOpen: true, activeTab: externalTab as OutputsDockTab }
      })
    }
  }, [externalTab, setState])


  // Phase 1A.5: Debug controls visibility (Shift+D shortcut)
  const { showDebug } = useDebugShortcut()

  // Phase 2 Sprint 1B: Slow-run UX feedback (20s/40s thresholds)
  const [slowRunMessage, setSlowRunMessage] = useState<string | null>(null)
  const runStartTimeRef = useRef<number | null>(null)

  // Transition bridge: snapshot of pre-analysis review progress captured at run time
  const transitionBridgeRef = useRef<{ verifiedCount: number; influenceCoverage: number }>({ verifiedCount: 0, influenceCoverage: 0 })

  // Phase 2: Response warnings banner dismissal state
  const [warningsDismissed, setWarningsDismissed] = useState(false)
  // P2: Degraded/partial state banner dismissal
  const [degradedBannerDismissed, setDegradedBannerDismissed] = useState(false)
  const comparison = useComparisonDetection()
  const scenarioComparison = useScenarioComparison()

  // Brief 25: Fetch robustness data for sensitivity, VoI, robustness bounds
  // Uses runMeta.runId and results hash when available
  const results = useCanvasStore(s => s.results)
  const robustnessRunId = results?.hash ? `run-${results.hash.slice(0, 8)}` : undefined
  useRobustness({
    runId: robustnessRunId,
    responseHash: results?.hash,
    autoFetch: true,
  })

  // React #185 FIX: Combine state selectors with shallow comparison
  // Using individual selectors for objects (runMeta, graphHealth, etc.) caused
  // infinite re-render loops in production builds because Zustand v5's
  // useSyncExternalStore triggers re-renders when object references change,
  // even if contents are identical. The shallow comparator prevents this.
  const {
    runMeta,
    graphHealth,
    showResultsPanel,
    showComparePanel,
    hasCompletedFirstRun,
    nodes,
    edges,
    framing,
  } = useCanvasStore(
    useShallow(s => ({
      runMeta: s.runMeta,
      graphHealth: s.graphHealth,
      showResultsPanel: s.showResultsPanel,
      showComparePanel: s.showComparePanel,
      hasCompletedFirstRun: s.hasCompletedFirstRun,
      nodes: s.nodes,
      edges: s.edges,
      framing: s.currentScenarioFraming,
    }))
  )

  // Actions don't need shallow - they're stable references
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)
  const setShowComparePanel = useCanvasStore(s => s.setShowComparePanel)
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const applyAutoFixChanges = useCanvasStore(s => s.applyAutoFixChanges)
  // P0 Results Brief: Store actions for Status Quo baseline creation
  const addNode = useCanvasStore(s => s.addNode)
  const updateNode = useCanvasStore(s => s.updateNode)
  const addEdge = useCanvasStore(s => s.addEdge)
  const setCeeAnalysisReady = useCanvasStore(s => s.setCeeAnalysisReady)
  // P2: Success target affordance - threshold update
  const setGoalThreshold = useCanvasStore(s => s.setGoalThreshold)
  // A1: Delta indicators between analysis runs
  const previousReport = useCanvasStore(selectPreviousReport)

  // Guidance items for results surface — filter to graph/option/framing targets only
  const allGuidanceItems = useGuidanceStore(s => s.guidanceItems)
  const setActiveGuidanceItem = useGuidanceStore(s => s.setActiveGuidanceItem)
  const resultsGuidanceItems = useMemo<GuidanceItem[]>(() => {
    if (allGuidanceItems.length === 0) return []
    return allGuidanceItems.filter((item) => {
      const t = item.target_object?.type
      return !t || t === 'graph' || t === 'option' || t === 'framing'
    })
  }, [allGuidanceItems])

  // Derived values from runMeta
  const diagnostics = runMeta.diagnostics
  const correlationIdHeader = runMeta.correlationIdHeader
  const effectiveCorrelationId = correlationIdHeader || diagnostics?.correlation_id
  const hasTrim = diagnostics?.trims === 1
  const hasDiagnostics = !!diagnostics
  const correlationMismatch = !!(
    diagnostics?.correlation_id &&
    correlationIdHeader &&
    diagnostics.correlation_id !== correlationIdHeader
  )

  const isPreRun = !hasCompletedFirstRun
  // Empty state: hide panel when canvas has no nodes
  const hasGraphContent = nodes.length > 0

  const resultsStatus = useCanvasStore(selectResultsStatus)
  const report = useCanvasStore(selectReport)
  const error = useCanvasStore(selectError)
  const resultsSource = useCanvasStore(selectResultsSource)

  // A.9: Auto-dismiss conversation indicator after 5 seconds
  const [convIndicatorVisible, setConvIndicatorVisible] = useState(false)
  const prevResultsSourceRef = useRef<'direct' | 'conversation' | undefined>(undefined)
  useEffect(() => {
    if (resultsSource === 'conversation' && prevResultsSourceRef.current !== 'conversation') {
      setConvIndicatorVisible(true)
      const id = setTimeout(() => setConvIndicatorVisible(false), 5000)
      return () => clearTimeout(id)
    }
    prevResultsSourceRef.current = resultsSource
    return undefined
  }, [resultsSource])

  // C.1b: Supabase persistence callbacks for analysis results
  const {
    setAnalysisRunning,
    resetAnalysisStatus,
    persistAnalysisSuccess,
    persistAnalysisFailure,
    isPersistenceActive: _isPersistenceActive,
    analysisStale,
  } = useScenario()

  // Build persistence object only when Supabase persistence is active
  const v2Persistence = useMemo<V2RunPersistence | undefined>(() => {
    if (!_isPersistenceActive) return undefined
    return {
      setAnalysisRunning,
      resetAnalysisStatus,
      persistAnalysisSuccess,
      persistAnalysisFailure,
    }
  }, [_isPersistenceActive, setAnalysisRunning, resetAnalysisStatus, persistAnalysisSuccess, persistAnalysisFailure])

  // P0-UI: V2 run hook for /v2/run endpoint
  const { runV2Analysis, cancelRun } = useV2Run(v2Persistence)

  // Results Panel Redesign: Section data hook for RecommendationSection, DriversSection, ConfidenceSection
  const resultsSectionData = useResultsSectionData()

  // Tornado chart: Derive per-factor outcome bounds from driver influence and recommended option range.
  // Each factor's contribution to the outcome swing is proportional to its normalised influence.
  const tornadoData = useMemo<{ rows: TornadoRow[]; expectedOutcome: number | null }>(() => {
    const rec = resultsSectionData?.recommendation
    const drv = resultsSectionData?.drivers
    if (!rec?.recommendedOption || !drv?.drivers?.length) {
      return { rows: [], expectedOutcome: null }
    }
    const expected = rec.recommendedOption.expected
    const p10 = rec.recommendedOption.outcome?.p10
    const p90 = rec.recommendedOption.outcome?.p90
    if (expected == null || p10 == null || p90 == null) {
      return { rows: [], expectedOutcome: null }
    }
    const downRange = expected - p10  // distance from expected to pessimistic
    const upRange = p90 - expected    // distance from expected to optimistic

    // Build rows from top drivers, sorted by influence descending
    const rows: TornadoRow[] = [...drv.drivers]
      .filter(d => (d.influenceScore ?? d.normalisedInfluence) > 0.01)
      .sort((a, b) => (b.influenceScore ?? b.normalisedInfluence) - (a.influenceScore ?? a.normalisedInfluence))
      .slice(0, 5) // Cap at 5 rows for readability
      .map(d => {
        const influence = d.influenceScore ?? d.normalisedInfluence
        // NOTE: lowOutcome/highOutcome represent outcome at the factor's low/high
        // raw value, NOT "worse/better" from the user's perspective.
        // For negative-direction factors (e.g. churn), low factor value = better
        // outcome, but the rendering assumes lowOutcome < expected < highOutcome.
        // Fixing the semantic mapping requires adding direction to TornadoRow and
        // making the render layer direction-aware (swap bar colours). Deferred to
        // Phase 3.3 alongside drag interaction work.
        return {
          factorKey: d.factorKey,
          label: d.factorLabel,
          lowOutcome: expected - influence * downRange,
          highOutcome: expected + influence * upRange,
          canFocus: d.canFocus,
          matchedNodeId: d.matchedNodeId,
          direction: d.direction === 'negative' ? 'negative' as const : 'positive' as const,
        }
      })

    return { rows, expectedOutcome: expected }
  }, [resultsSectionData?.recommendation, resultsSectionData?.drivers])

  // Graph Interaction P1: Canvas → Results sync for DriversSection
  const [driversExpanded, setDriversExpanded] = useState(false)
  const { highlightedDriverId, registerDriverRef } = useCanvasResultsSync({
    drivers: resultsSectionData.drivers.drivers,
    isAccordionExpanded: driversExpanded,
    onExpandAccordion: () => setDriversExpanded(true),
  })

  const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'
  const { readiness } = useGraphReadiness()

  // Unified run gating — same function used by ConversationPanel/ChatTopBar.
  const hasValidationBlockers = useCanvasStore(s =>
    s.graphHealth?.issues?.some((i: { severity: string }) => i.severity === 'error' || i.severity === 'blocker') ?? false
  )

  const runGateResult = canRunAnalysisUtil({
    graphHealth: graphHealth ?? null,
    readiness,
    hasBlockers: hasValidationBlockers,
    nodeCount: nodes.length,
    isRunning,
  })
  const canRunAnalysis = runGateResult.allowed
  const runBlockedTooltip = getRunButtonTooltip(runGateResult)

  // Handle Run button click
  const handleRunAnalysis = useCallback(async () => {
    if (!canRunAnalysis) return
    // Capture pre-analysis review progress for transition bridge
    const storeState = useCanvasStore.getState()
    const storeNodes = storeState.nodes
    const reviewedIds = new Set<string>()
    let verifiedCount = 0
    for (const node of storeNodes) {
      const nd = node.data as Record<string, unknown>
      if (nd.kind !== 'factor' && node.type !== 'factor') continue
      const os = (nd.observedState ?? nd.observed_state) as Record<string, unknown> | undefined
      const source = os?.source as string | undefined
      if (source === 'user_confirmed' || source === 'user_assumption' || source === 'user_override' || source === 'user_edited') {
        reviewedIds.add(node.id)
        verifiedCount++
      }
    }
    // Compute influence coverage from pre-analysis sensitivity data
    let influenceCoverage = 0
    const sensitivity = storeState.preAnalysisSensitivity as { factor_influence?: Record<string, number> } | null
    if (sensitivity?.factor_influence) {
      let reviewedSum = 0
      let totalSum = 0
      for (const [id, influence] of Object.entries(sensitivity.factor_influence)) {
        totalSum += influence
        if (reviewedIds.has(id)) reviewedSum += influence
      }
      influenceCoverage = totalSum > 0 ? reviewedSum / totalSum : 0
    }
    transitionBridgeRef.current = { verifiedCount, influenceCoverage }
    // P0.8: Track run started
    trackRunStarted({
      option_count: comparison.optionNodes.length,
      node_count: nodes.length,
      edge_count: edges.length,
    })
    // P0: Log graph used for observability
    console.warn('[GRAPH_USED_FOR_RUN]', {
      node_count: nodes.length,
      edge_count: edges.length,
      option_count: comparison.optionNodes.length,
      template_id: (framing as any)?.templateId || 'canvas-graph',
    })
    await runV2Analysis()
  }, [canRunAnalysis, runV2Analysis, framing, nodes, edges, comparison.optionNodes.length])

  // P0 Results Brief: Add Status Quo baseline option
  // Creates a new option node with is_baseline=true, empty interventions, and connects it to a decision node
  const addStatusQuoBaseline = useCallback(() => {
    // Find a decision node to connect to (or any node if no decision exists)
    const decisionNode = nodes.find(n => n.type === 'decision')
    const anchorNode = decisionNode || nodes[0]
    if (!anchorNode) {
      console.warn('[OutputsDock] Cannot add Status Quo baseline: no nodes to connect to')
      return
    }

    // Position the new node offset from the anchor
    const newPosition = {
      x: (anchorNode.position?.x || 200) + 200,
      y: (anchorNode.position?.y || 200) + 50,
    }

    // Create the option node
    addNode(newPosition, 'option')

    // Get the newly created node (it's the last one added)
    const newNodes = useCanvasStore.getState().nodes
    const newNode = newNodes[newNodes.length - 1]
    if (!newNode) return

    // Update the node data to mark it as a baseline with Status Quo label
    updateNode(newNode.id, {
      data: {
        ...newNode.data,
        label: 'Status Quo',
        kind: 'option',
        is_baseline: true,
        interventions: {},
        status: 'ready',
      },
    })

    // Connect the new option to the decision node (if we have a decision)
    if (decisionNode) {
      addEdge({
        source: decisionNode.id,
        target: newNode.id,
        type: 'default',
        data: {
          ...DEFAULT_EDGE_DATA,
          confidence: 0, // No confidence needed for decision→option edge
        },
      })
    }

    // Invalidate CEE analysis ready cache so next run re-extracts options
    setCeeAnalysisReady(null)

    console.warn('[OutputsDock] Added Status Quo baseline option:', newNode.id)
  }, [nodes, addNode, updateNode, addEdge, setCeeAnalysisReady])

  // P2 Task 1: Handle threshold change and trigger re-run
  const handleApplyThreshold = useCallback((threshold: number | null) => {
    setGoalThreshold(threshold)
    // Trigger re-run after threshold update
    runV2Analysis()
  }, [setGoalThreshold, runV2Analysis])

  // C1: Baseline addition does NOT trigger rerun — mutates draft only.
  // User must manually rerun to generate comparison data.
  const handleAddBaseline = useCallback(() => {
    addStatusQuoBaseline()
  }, [addStatusQuoBaseline])

  // Set an existing option as the baseline by ID — clears is_baseline on all others first.
  const handleSetBaseline = useCallback((optionId: string) => {
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.kind === 'option')
    for (const n of optionNodes) {
      if (n.data?.is_baseline && n.id !== optionId) {
        updateNode(n.id, { data: { ...n.data, is_baseline: false } })
      }
    }
    const target = optionNodes.find(n => n.id === optionId)
    if (target) {
      updateNode(optionId, { data: { ...target.data, is_baseline: true } })
    }
  }, [nodes, updateNode])

  // Handle auto-fix for validation issues
  const handleAutoFix = useCallback(async (item: CritiqueItem): Promise<boolean> => {
    // Track that auto-fix was clicked
    trackAutoFixClicked()

    if (!item.code) {
      trackAutoFixFailed()
      return false
    }

    const fixType = determineFixType(item.code)
    if (!fixType) {
      console.warn('[OutputsDock] No auto-fix available for code:', item.code)
      trackAutoFixFailed()
      return false
    }

    const params: AutoFixParams = {
      fixType,
      nodeId: item.node_id,
      edgeId: item.edge_id,
    }

    try {
      const result = executeAutoFix(params, nodes, edges)

      if (result.success) {
        // Use store action instead of direct setState (P1 fix - proper history/undo support)
        applyAutoFixChanges({
          nodes: result.updatedNodes,
          edges: result.updatedEdges,
        })

        trackAutoFixSuccess()
        return true
      }

      console.warn('[OutputsDock] Auto-fix failed:', result.message)
      trackAutoFixFailed()
      return false
    } catch (err) {
      console.error('[OutputsDock] Auto-fix error:', err)
      trackAutoFixFailed()
      return false
    }
  }, [nodes, edges, applyAutoFixChanges])

  const canonicalBands = report?.run?.bands ?? null
  const mostLikelyValue = canonicalBands ? canonicalBands.p50 : report?.results.likely ?? null
  const hasInlineSummary = Boolean(report && resultsStatus === 'complete')
  const goalDirection = getGoalDirection(framing, nodes)
  const isError = resultsStatus === 'error'

  // Phase 1A.1: Compute verdict for VerdictCard
  // Use baseline from framing or default to 0 ("do nothing" scenario)
  const baselineValue = framing?.baseline ?? 0

  const verdict = mostLikelyValue !== null
    ? deriveVerdict({
        outcomeValue: mostLikelyValue,
        baselineValue,
        goalDirection,
      })
    : null

  // Legacy CEE types (deprecated)
  const ceeTrace = runMeta.ceeTrace ?? null
  // M1 CEE Orchestrator types (preferred)
  const ceeTraceV1 = runMeta.ceeTraceV1 ?? null

  // Phase 1 Section 3: CEE degraded state (non-blocking overlay behaviour)
  const ceeDegraded = ceeTrace?.degraded === true || ceeTraceV1?.id_mismatch === true

  // Sprint N P0.1: Decision readiness derived from confidence when available
  const readinessFromConfidence = report?.confidence
    ? mapConfidenceToReadiness(
        {
          level: report.confidence.level.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
          reason: report.confidence.why,
        },
        verdict?.verdict === 'supports'
      )
    : null

  const decisionReadiness = report?.decision_readiness || readinessFromConfidence
  const recommendationStability = (report as any)?.robustness?.recommendation_stability ?? (report as any)?.robustness?.ranking_stability
  const stabilityClass = getStabilityClassification(recommendationStability)
  const postRunFooter = stabilityClass
    ? stabilityClass.level === 'high'
      ? { icon: CheckCircle, iconClass: 'text-success', label: stabilityClass.heroLabel }
      : stabilityClass.level === 'moderate'
        ? { icon: CheckCircle, iconClass: 'text-info', label: stabilityClass.heroLabel }
        : stabilityClass.level === 'low'
          ? { icon: AlertTriangle, iconClass: 'text-warning', label: stabilityClass.heroLabel }
          : { icon: XCircle, iconClass: 'text-danger', label: stabilityClass.heroLabel }
    : { icon: XCircle, iconClass: 'text-danger', label: 'Fragile result' }
  const postRunMetaText = recommendationStability != null
    ? <><StabilityGauge value={recommendationStability} />{' '}<DeltaIndicator currentValue={recommendationStability} previousValue={previousReport?.rankingStability} format="percent" /></>
    : null

  verboseDebug('[TrustSignals] OutputsDock', {
    isPreRun,
    hasReport: !!report,
    hasDecisionReadiness: !!decisionReadiness,
    fromConfidence: !!readinessFromConfidence,
    hasGraphQuality: !!report?.graph_quality,
    hasInsights: !!report?.insights,
  })

  useDegeneracyDismissal(robustnessRunId)

  const mappedRobustness: MappedRobustness | null = useMemo(() => {
    const raw = (report as any)?.robustness
    if (!raw) return null
    return mapRobustness(raw, { sourcePath: 'top_level' })
  }, [report])

  const ceeQuality = useCanvasStore(s => s.ceeQuality)

  const factorInfluenceMap = useMemo(() => {
    const factors =
      (report as any)?.enrichment?.sensitivity_analysis?.factors ??
      (report as any)?.factor_sensitivity ??
      []
    if (!Array.isArray(factors) || factors.length === 0) return undefined
    const map = new Map<string, number>()
    for (const f of factors) {
      const id: string | undefined = f.factor_id ?? f.factorId ?? f.node_id ?? f.nodeId
      const score: number | undefined = f.elasticity ?? f.sensitivity_score ?? f.importance_score
      if (id && score !== undefined) map.set(id, score)
    }
    return map.size > 0 ? map : undefined
  }, [report])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const resolveTab = (): OutputsDockTab | null => {
        // Prefer real query string: /canvas?tab=insights
        const searchParams = new URLSearchParams(window.location.search)
        const fromSearch = searchParams.get('tab') as OutputsDockTab | null
        if (fromSearch && OUTPUT_TABS.some(tab => tab.id === fromSearch)) {
          return fromSearch
        }

        // Fallback: read from hash fragment: /#/canvas?tab=insights
        const hash = window.location.hash
        const qIndex = hash.indexOf('?')
        if (qIndex !== -1) {
          const hashQuery = hash.slice(qIndex + 1)
          const fromHash = new URLSearchParams(hashQuery).get('tab') as OutputsDockTab | null
          if (fromHash && OUTPUT_TABS.some(tab => tab.id === fromHash)) {
            return fromHash
          }
        }

        return null
      }

      const initialTab = resolveTab()
      if (!initialTab) return

      setState(prev => {
        if (prev.isOpen && prev.activeTab === initialTab) {
          return prev
        }
        return { ...prev, isOpen: true, activeTab: initialTab }
      })
    } catch {}
  }, [setState])

  // MERGED EFFECT: Handles both resultsStatus and showResultsPanel dock opening
  // Fix for React #185: Previously two separate effects could cascade and cause infinite loops.
  // Now unified with ref-based debounce to prevent rapid state updates.
  //
  // I.1 Fix: Only auto-switch to Results tab when status *transitions* from
  // idle/cancelled into an active state — not on every render where status is
  // already non-idle. This prevents yanking users off the Structure/Compare tab
  // when they navigate there post-analysis.
  const lastDockOpenRef = useRef<number>(0)
  const prevAutoSwitchStatusRef = useRef(resultsStatus)

  useEffect(() => {
    const prevStatus = prevAutoSwitchStatusRef.current
    prevAutoSwitchStatusRef.current = resultsStatus

    const wasInactive = prevStatus === 'idle' || prevStatus === 'cancelled'
    const isNowActive =
      resultsStatus === 'preparing' ||
      resultsStatus === 'connecting' ||
      resultsStatus === 'streaming' ||
      resultsStatus === 'complete' ||
      resultsStatus === 'error'

    // Auto-switch to Results tab only when:
    // 1. Status transitions from idle/cancelled → active (user started a run)
    // 2. showResultsPanel flag is explicitly set (external trigger)
    const statusTransitioned = wasInactive && isNowActive
    if (!statusTransitioned && !showResultsPanel) return

    // Debounce: prevent rapid updates within 50ms (React #185 fix)
    const now = Date.now()
    if (now - lastDockOpenRef.current < 50) {
      return
    }
    lastDockOpenRef.current = now

    // Task F: Auto-open results — close overlay panels so OutputsDock becomes visible
    useUIStore.getState().openRightPanel('results')

    setState(prev => {
      // Guard: only update if state actually needs to change
      if (prev.isOpen && prev.activeTab === 'results') {
        return prev // No change needed
      }
      // Mutual exclusion: close inspector when dock auto-opens
      if (!prev.isOpen) {
        window.dispatchEvent(new Event('outputs-dock-opened'))
      }
      return { ...prev, isOpen: true, activeTab: 'results' }
    })
    // We intentionally depend on both triggers. setState from useDockState is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsStatus, showResultsPanel])

  // Effect: Switch to compare tab when showComparePanel flag is set
  useEffect(() => {
    if (!showComparePanel) return

    setState(prev => {
      if (prev.isOpen && prev.activeTab === 'compare') {
        return prev // Already on compare tab
      }
      // Mutual exclusion: close inspector when dock auto-opens
      if (!prev.isOpen) {
        window.dispatchEvent(new Event('outputs-dock-opened'))
      }
      return { ...prev, isOpen: true, activeTab: 'compare' }
    })

    // Reset the flag after switching (one-shot trigger)
    setShowComparePanel(false)
  }, [showComparePanel, setState, setShowComparePanel])

  // Phase 2 Sprint 1B: Track elapsed time and show slow-run messages at 20s/40s
  // Cleanup ensures timers are always cleared on unmount or status change
  useEffect(() => {
    const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

    if (isRunning) {
      // Start tracking time when run begins
      if (runStartTimeRef.current === null) {
        runStartTimeRef.current = Date.now()
        setSlowRunMessage(null)
      }

      // Check elapsed time every 5 seconds
      const intervalId = setInterval(() => {
        if (runStartTimeRef.current === null) return

        const elapsedMs = Date.now() - runStartTimeRef.current
        const elapsedSeconds = Math.floor(elapsedMs / 1000)

        if (elapsedSeconds >= 40) {
          setSlowRunMessage('Still working...')
        } else if (elapsedSeconds >= 20) {
          setSlowRunMessage('Taking longer than expected...')
        }
      }, 5000)

      // Cleanup: always clear interval on unmount or status change
      return () => clearInterval(intervalId)
    } else {
      // Clear tracking when run completes/errors/cancels/navigates away
      runStartTimeRef.current = null
      setSlowRunMessage(null)
      // No cleanup function needed when not running (no interval to clear)
    }
  }, [resultsStatus])

  // P0.8: Track run completed/failed events
  const prevResultsStatus = useRef(resultsStatus)
  useEffect(() => {
    const prevStatus = prevResultsStatus.current
    prevResultsStatus.current = resultsStatus

    // Detect transition to 'complete'
    if (resultsStatus === 'complete' && prevStatus !== 'complete' && report) {
      trackRunCompleted({
        confidence_level: report.confidence?.level as 'high' | 'medium' | 'low' ?? 'medium',
        drivers_informative: areDriversInformative(report.drivers_payload),
        trace_id: runMeta?.correlationIdHeader ?? undefined,
        duration_ms: runStartTimeRef.current ? Date.now() - runStartTimeRef.current : undefined,
      })
    }

    // Detect transition to 'error'
    if (resultsStatus === 'error' && prevStatus !== 'error' && error) {
      trackRunFailed({
        error_code: error.code ?? 'UNKNOWN',
        error_message: error.message,
      })
    }
  }, [resultsStatus, report, error, runMeta?.correlationIdHeader])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const value = state.isOpen ? 'var(--dock-right-expanded)' : 'var(--dock-right-collapsed)'
    root.style.setProperty('--dock-right-offset', value)

    return () => {
      root.style.setProperty('--dock-right-offset', '0rem')
    }
  }, [state.isOpen])
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('panel.results.width')
      if (!stored) return
      const parsed = Number(stored)
      if (!Number.isFinite(parsed)) return
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
      if (!viewportWidth) return
      const minWidth = 280
      const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
      const clamped = Math.max(minWidth, Math.min(maxWidth, parsed))
      const root = document.documentElement
      root.style.setProperty('--dock-right-expanded', `${clamped}px`)
    } catch {}
  }, [])
  const transitionClass = prefersReducedMotion ? '' : 'transition-[width,opacity] duration-200 ease-in-out'

  const toggleOpen = () => {
    setState(prev => {
      const nextIsOpen = !prev.isOpen
      // Keep showResultsPanel in sync primarily for highlighting & telemetry when
      // the dock is explicitly opened or closed. Schedule the store update on a
      // microtask to avoid cascading updates during the same render cycle.
      // Guard: Only update store if value actually changes (React #185 fix)
      Promise.resolve().then(() => {
        const shouldShowResults = nextIsOpen && prev.activeTab === 'results'
        if (shouldShowResults !== showResultsPanel) {
          setShowResultsPanel(shouldShowResults)
        }
      })
      // Mutual exclusion: close inspector when dock expands
      if (nextIsOpen) {
        window.dispatchEvent(new Event('outputs-dock-opened'))
      }
      return { ...prev, isOpen: nextIsOpen }
    })
  }

  const handleTabClick = (tab: OutputsDockTab) => {
    setState(prev => ({ ...prev, isOpen: true, activeTab: tab }))
    // E1: Sync tab state to Zustand store for cross-component navigation
    useUIStore.getState().setActiveOutputTab(tab as OutputTab)
    // Mutual exclusion: close inspector when dock opens via tab click
    window.dispatchEvent(new Event('outputs-dock-opened'))

    // Treat the Results tab as the canonical "results visible" state for
    // highlight overlays and results-viewed telemetry.
    // Guard: Only update store if value actually changes (React #185 fix)
    const shouldShowResults = tab === 'results'
    if (shouldShowResults !== showResultsPanel) {
      setShowResultsPanel(shouldShowResults)
    }

    if (tab === 'compare') {
      trackCompareOpened()
    }

    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href)
        if (tab === 'results') {
          url.searchParams.delete('tab')
        } else {
          url.searchParams.set('tab', tab)
        }
        window.history.replaceState({}, '', url.toString())
      } catch {}
    }
  }

  const handleResizeStart = (event: any) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    event.preventDefault()

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
    if (!viewportWidth) return

    const minWidth = 280
    const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
    const root = document.documentElement

    const handleMove = (e: MouseEvent) => {
      const fromRight = viewportWidth - e.clientX
      const nextWidth = fromRight
      const clamped = Math.max(minWidth, Math.min(maxWidth, nextWidth))
      root.style.setProperty('--dock-right-expanded', `${clamped}px`)
      try {
        localStorage.setItem('panel.results.width', String(clamped))
      } catch {}
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  // Task C: Panel coordination — hide OutputsDock when an overlay panel is active
  const activeRightPanel = useUIStore(s => s.activeRightPanel)
  const isOverlayPanelActive = activeRightPanel === 'provenance' || activeRightPanel === 'clarifier'

  // Empty state: unmount when canvas has no nodes (nothing to show)
  if (!hasGraphContent) {
    return null
  }
  // When an overlay panel is active, keep mounted (preserve scroll position,
  // tab state, effect continuity) but hide visually via CSS.

  return (
    <aside
      className={`${transitionClass} flex flex-col transition-shadow pointer-events-auto${isOverlayPanelActive ? ' hidden' : ''}`}
      style={{
        position: 'fixed',
        width: state.isOpen ? 'var(--dock-right-expanded, 24rem)' : 'var(--dock-right-collapsed, 2.5rem)',
        right: 12,
        top: 12,
        bottom: 'calc(var(--bottombar-h) + 1rem)',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--sand-200)',
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
        zIndex: 900,
        overflow: 'hidden',
      }}
      aria-label="Outputs dock"
      data-testid="outputs-dock"
    >
      {state.isOpen && (
        <div
          aria-hidden="true"
          onMouseDown={handleResizeStart}
          className="absolute inset-y-0 left-0 w-1 cursor-col-resize bg-transparent hover:bg-sand-200/60"
        />
      )}
      <div className="sticky top-0 z-10 border-b border-sand-200 rounded-t-2xl" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
        {!state.isOpen && (
          <div className="flex items-center justify-end px-2 py-2">
            <button
              type="button"
              onClick={toggleOpen}
              className={`inline-flex items-center justify-center w-6 h-6 rounded border border-sand-200 ${typography.caption} text-ink-900/70 hover:bg-paper-50`}
              aria-label={state.isOpen ? 'Collapse outputs dock' : 'Expand outputs dock'}
            >
              {state.isOpen ? '>' : '<'}
            </button>
          </div>
        )}

        {state.isOpen && (
          <div className="flex items-center gap-2 px-2 py-2" aria-label="Outputs sections">
            <span className="sr-only" aria-live="polite">
              {OUTPUT_TABS.find(tab => tab.id === state.activeTab)?.label ?? ''}
            </span>
            <nav className="flex flex-1 min-w-0 gap-1" aria-label="Outputs sections">
              {OUTPUT_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  data-testid={tab.id === 'diagnostics' ? 'outputs-dock-tab-diagnostics' : undefined}
                  className={`flex-1 px-2 py-1 rounded ${typography.caption} font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ${
                    state.activeTab === tab.id
                      ? 'text-info border-b-2 border-info'
                      : 'text-ink-900/70 hover:bg-paper-50 hover:text-ink-900 border-b-2 border-transparent'
                  }`}
                  style={state.activeTab === tab.id ? { backgroundColor: 'rgba(99,173,207,0.15)' } : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {tab.label}
                    {/* Model health ambient indicator (Brief 5 Task 5) */}
                    {tab.id === 'diagnostics' && <ModelHealthBadge />}
                  </span>
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={toggleOpen}
              className={`inline-flex items-center justify-center w-6 h-6 rounded border border-sand-200 ${typography.caption} text-ink-900/70 hover:bg-paper-50`}
              aria-label={state.isOpen ? 'Collapse outputs dock' : 'Expand outputs dock'}
            >
              {state.isOpen ? '>' : '<'}
            </button>
          </div>
        )}
      </div>

      {!state.isOpen && (
        <nav
          className="flex flex-col items-center gap-2 py-3"
          aria-label="Outputs sections"
        >
          {OUTPUT_TABS.map(tab => {
            const Icon =
              tab.id === 'results'
                ? BarChart3
                : tab.id === 'compare'
                ? Shuffle
                : tab.id === 'journey'
                ? Clock
                : Activity
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center justify-center w-7 h-7 rounded-full border ${typography.caption} focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'text-info border-info'
                    : 'text-ink-900/70 bg-paper-50 border-sand-200 hover:bg-paper-50 hover:text-ink-900'
                }`}
                style={state.activeTab === tab.id ? { backgroundColor: 'rgba(99,173,207,0.15)' } : undefined}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )
          })}
        </nav>
      )}

      {state.isOpen && (
        <div className={`flex-1 min-h-0 ${typography.caption} text-ink-900/70 ${state.activeTab === 'results' ? 'flex flex-col overflow-hidden' : 'olumi-scrollbar px-3 py-3 space-y-4 overflow-y-auto'}`} data-testid="outputs-dock-body">
            {state.activeTab === 'results' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className={`flex-1 min-h-0 ${isPreRun && nodes.length > 0 ? 'flex flex-col' : 'olumi-scrollbar overflow-y-auto px-3 py-3 space-y-6'}`}>
                {/* P0.6: User-friendly error display */}
                {isError && error && (() => {
                  const friendlyError = getUserFriendlyError({
                    code: error.code,
                    message: error.message,
                    hasPartialResults: Boolean(report),
                  })

                  // Task P.3.4: CEE timeout with complexity context (>15 nodes)
                  const isCeeTimeout = error.code === 'CEE_TIMEOUT' || error.code === 'TIMEOUT'
                  const isComplexGraph = nodes.length > 15
                  if (isCeeTimeout && isComplexGraph) {
                    friendlyError.explanation = 'Your decision has many factors. Try simplifying to the 8-10 most important ones, then add detail after your first analysis.'
                  }

                  return (
                    <div
                      className={`flex flex-col gap-2 px-3 py-3 rounded-lg border ${
                        friendlyError.severity === 'error'
                          ? 'bg-panel border-danger/30'
                          : friendlyError.severity === 'warning'
                            ? 'bg-panel border-warning/30'
                            : 'bg-panel border-info/30'
                      }`}
                      role="alert"
                      aria-live="polite"
                      data-testid="outputs-error-banner"
                    >
                      <div className={`${typography.body} font-medium ${
                        friendlyError.severity === 'error'
                          ? 'text-danger'
                          : friendlyError.severity === 'warning'
                            ? 'text-warning'
                            : 'text-info'
                      }`}>
                        {friendlyError.headline}
                      </div>
                      <div className={`${typography.caption} text-ink-900/80`}>
                        {friendlyError.explanation}
                      </div>
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex gap-2">
                          {friendlyError.canRetry && (
                            <button
                              type="button"
                              onClick={handleRunAnalysis}
                              disabled={isRunning}
                              className={`${typography.caption} font-medium px-3 py-1.5 rounded ${
                                friendlyError.severity === 'error'
                                  ? 'bg-danger-600 text-text-on-color hover:bg-danger-700'
                                  : friendlyError.severity === 'warning'
                                    ? 'bg-sun-600 text-white hover:bg-sun-700'
                                    : 'bg-sky-600 text-white hover:bg-sky-700'
                              } disabled:opacity-50`}
                            >
                              {friendlyError.actionText}
                            </button>
                          )}
                          {/* Task P.3.5: Edit model button (secondary action) */}
                          <button
                            type="button"
                            onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
                            className={`${typography.caption} font-medium px-3 py-1.5 rounded border ${
                              friendlyError.severity === 'error'
                                ? 'border-danger/30 text-danger hover:bg-danger-light'
                                : friendlyError.severity === 'warning'
                                  ? 'border-warning/30 text-warning hover:bg-warning-light'
                                  : 'border-info/30 text-info hover:bg-info-light'
                            }`}
                            data-testid="edit-model-button"
                          >
                            Edit model
                          </button>
                          {friendlyError.secondaryActionText && (
                            <button
                              type="button"
                              onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
                              className={`${typography.caption} font-medium px-3 py-1.5 rounded border ${
                                friendlyError.severity === 'error'
                                  ? 'border-danger/30 text-danger hover:opacity-80'
                                  : friendlyError.severity === 'warning'
                                    ? 'border-warning/30 text-warning hover:opacity-80'
                                    : 'border-info/30 text-info hover:opacity-80'
                              }`}
                              data-testid="error-secondary-action"
                            >
                              {friendlyError.secondaryActionText}
                            </button>
                          )}
                        </div>
                        {/* Task P.3.5: Coaching text for repeated failures */}
                        <p className={`${typography.caption} text-ink-900/70`}>
                          If analysis keeps failing, try simplifying to 8-10 of the most important factors.
                        </p>
                      </div>
                      {/* Debug info (only in dev mode) */}
                      {import.meta.env.DEV && (
                        <details className="mt-2">
                          <summary className={`${typography.code} text-ink-500 cursor-pointer`}>
                            Debug info
                          </summary>
                          <div className={`${typography.code} text-ink-500 mt-1 text-xs`}>
                            Code: {error.code} | Request ID: {error.request_id || 'n/a'}
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })()}
                {/* v7: Rerun + Compare buttons moved to sticky footer below */}
                {/* Pre-run state: Show consolidated guidance and Run button */}
                {isPreRun && nodes.length > 0 && (
                  <div className="flex-1 min-h-0 flex flex-col" data-testid="outputs-pre-run">
                    {/* Pre-Analysis Panel - M1 rebuild with new component architecture */}
                    {/* Goal node selector and threshold are now inside AnalysisSettings accordion */}
                    <PreAnalysisPanel
                      onAnalyse={handleRunAnalysis}
                      isAnalysing={isRunning}
                      blockedReason={runBlockedTooltip}
                      onSendMessage={sendMessage}
                    />
                  </div>
                )}
                {/* Phase 2 Sprint 1B: Slow-run UX feedback */}
                {slowRunMessage && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-200 rounded text-sky-800"
                    role="status"
                    aria-live="polite"
                    data-testid="slow-run-message"
                  >
                    <Clock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className={`${typography.caption} text-sky-900`}>{slowRunMessage}</span>
                  </div>
                )}
                {/* I.2b: Cancel button during active analysis */}
                {isRunning && (
                  <div className="flex justify-end px-3">
                    <button
                      type="button"
                      onClick={cancelRun}
                      className={`${typography.caption} font-medium px-3 py-1.5 rounded border border-ink-200 text-ink-600 hover:bg-sand-100 flex items-center gap-1.5`}
                      data-testid="cancel-analysis-button"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Cancel
                    </button>
                  </div>
                )}
                {/* P0.7: Loading skeleton during analysis (when streaming without report) */}
                {isRunning && !report && (
                  <ResultsPanelSkeleton />
                )}
                {/* P0 Engine: Identifiability Badge - only show when we have a meaningful status */}
                {(() => {
                  // Safely normalize backend identifiability tag to prevent runtime errors
                  const normalizedStatus = !isPreRun
                    ? normalizeIdentifiabilityTag(report?.model_card?.identifiability_tag)
                    : null
                  // Don't show badge for 'unknown' status - it just says "Run analysis to calculate"
                  return normalizedStatus && normalizedStatus !== 'unknown' && (
                    <IdentifiabilityBadge status={normalizedStatus} />
                  )
                })()}
                {/* NOTE: UnifiedStatusBadge removed - TrustSignal now provides plain-language
                    reliability assessment. Keeping import for potential future use in Compare tab. */}
                {/* v1.1 Contract: Engine critique shown post-run only if blockers exist
                    Note: Pre-run validation uses graphHealth, post-run uses engine critique
                    Only show if engine detected blockers that prevented clean results */}
                {!isPreRun && report?.run?.critique && report.run.critique.some(c => c.severity === 'BLOCKER') && (
                  <div data-testid="outputs-engine-critique">
                    <ValidationPanel
                      critique={mapCritiqueToValidation(report.run.critique)}
                      onAutoFix={handleAutoFix}
                    />
                  </div>
                )}
                {/* Phase 2: Response warnings banner (edge type inferred, weights normalized, etc.) */}
                {!isPreRun && !warningsDismissed && report?.warnings && report.warnings.length > 0 && (
                  <WarningBanner
                    warnings={report.warnings
                      .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
                      .map((msg) => ({ code: 'GENERAL', message: msg }))}
                    onDismiss={() => setWarningsDismissed(true)}
                    onViewAffected={(ids) => {
                      setHighlightedNodes(ids)
                      setTimeout(() => setHighlightedNodes([]), 3000)
                    }}
                  />
                )}
                {/* P2: Degraded/partial state banner */}
                {!isPreRun && !degradedBannerDismissed && (ceeDegraded || (
                  resultsSectionData?.drivers?.driversStatus &&
                  resultsSectionData.drivers.driversStatus !== 'computed'
                ) || (
                  resultsSectionData?.confidence?.robustnessStatus &&
                  resultsSectionData.confidence.robustnessStatus !== 'computed'
                )) && (
                  <DegradedStateBanner
                    ceeDegraded={ceeDegraded}
                    ceeTimeoutReason={ceeDegraded ? 'Model review may be incomplete.' : undefined}
                    islPartial={
                      (resultsSectionData?.drivers?.driversStatus !== 'computed') ||
                      (resultsSectionData?.confidence?.robustnessStatus !== 'computed' &&
                       resultsSectionData?.confidence?.robustnessStatus !== undefined)
                    }
                    analysisTypes={[
                      {
                        name: 'Comparison',
                        available: resultsSectionData?.recommendation?.analysisStatus === 'computed',
                      },
                      {
                        name: 'Drivers',
                        available: resultsSectionData?.drivers?.driversStatus === 'computed',
                      },
                      {
                        name: 'Robustness',
                        available: resultsSectionData?.confidence?.robustnessStatus === 'computed',
                      },
                    ].filter(() => resultsSectionData != null)}
                    onDismiss={() => setDegradedBannerDismissed(true)}
                  />
                )}
                {/* I.2c: Stale results indicator — shown when current run errored
                    but previous results are still visible */}
                {isError && report && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-sun-50 border border-sun-200 rounded"
                    role="status"
                    data-testid="stale-results-banner"
                  >
                    <AlertTriangle className="w-4 h-4 text-sun-600 flex-shrink-0" aria-hidden="true" />
                    <span className={`${typography.caption} text-sun-800`}>
                      Showing results from previous analysis
                    </span>
                  </div>
                )}
                {/* C.1b: Graph-staleness indicator — shown when graph has been
                    edited after the last successful analysis */}
                {analysisStale && !isError && report && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-panel border border-warning/30 rounded"
                    role="status"
                    data-testid="graph-stale-banner"
                  >
                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" aria-hidden="true" />
                    <span className={`${typography.caption} text-warning`}>
                      Results may be outdated. Run analysis again.
                    </span>
                  </div>
                )}
                {/* A.9: Conversation-triggered analysis indicator — auto-dismisses after 5s */}
                {convIndicatorVisible && !isPreRun && report && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5"
                    role="status"
                    aria-live="polite"
                    data-testid="conv-results-indicator"
                    onClick={() => setConvIndicatorVisible(false)}
                  >
                    <MessageCircle className="w-3 h-3 text-text-light flex-shrink-0" aria-hidden="true" />
                    <span className={`${typography.caption} text-text-light`}>
                      Updated from conversation
                    </span>
                  </div>
                )}
                {/* ======================================================================
                    Results Panel v7: Four-Section Flat Layout
                    Sections: 1. Hero  2. Options comparison  3. Drivers  4. Strengthen
                    18px gaps between sections, no accordion wrappers on Drivers.
                    Legacy blocks (InsightsPanel, AdvancedSettings, variance warning) removed
                    from Results tab — they are not in the v7 prototype.
                    ====================================================================== */}
                {!isPreRun && hasInlineSummary && resultsSectionData && (
                  <ResultsBody
                    resultsSectionData={resultsSectionData}
                    tornadoData={tornadoData}
                    highlightedDriverId={highlightedDriverId}
                    registerDriverRef={registerDriverRef}
                    strengthCorrections={getStrengthCorrections()}
                    onFocusNode={(nodeId) => {
                      setHighlightedNodes([nodeId])
                      focusNodeById(nodeId)
                      setTimeout(() => setHighlightedNodes([]), 3000)
                    }}
                    isRunning={isRunning}
                    onAddStatusQuoBaseline={addStatusQuoBaseline}
                    onApplyThreshold={handleApplyThreshold}
                    onAddBaseline={handleAddBaseline}
                    onSetBaseline={handleSetBaseline}
                    nSamples={(report as any)?.summary?.n_samples_used ?? (report as any)?.meta?.n_samples}
                    seedUsed={(report as any)?.meta?.seed}
                    fragileEdgeCount={(report as any)?.robustness?.fragile_edges?.length}
                    robustEdgeCount={(report as any)?.robustness?.robust_edges?.length}
                    responseHash={results?.hash}
                    nodeCount={nodes.length}
                    edgeCount={edges.length}
                    identifiability={report?.model_card?.identifiability_tag}
                    goalDirection={goalDirection}
                    guidanceItems={resultsGuidanceItems}
                    onActivateGuidanceItem={setActiveGuidanceItem}
                    verifiedCount={transitionBridgeRef.current.verifiedCount}
                    influenceCoverage={transitionBridgeRef.current.influenceCoverage}
                    driversExpanded={driversExpanded}
                    onDriversExpandChange={setDriversExpanded}
                  />
                )}
                </div>
                {!isPreRun && hasInlineSummary && resultsSectionData && (
                  <AnalysisFooter
                    statusIcon={postRunFooter.icon}
                    statusIconClassName={postRunFooter.iconClass}
                    statusText={postRunFooter.label}
                    metaText={postRunMetaText}
                    actionLabel={isRunning ? 'Analysing...' : 'Rerun analysis'}
                    onAction={handleRunAnalysis}
                    actionDisabled={isRunning || !canRunAnalysis}
                    actionLoading={isRunning}
                    actionAriaLabel={isRunning ? 'Analysis in progress' : 'Rerun analysis'}
                    actionTitle={!canRunAnalysis && !isRunning ? runBlockedTooltip : undefined}
                    testId="results-analysis-footer"
                  />
                )}
              </div>
            )}
            {state.activeTab === 'compare' && (
              <CompareTabBody />
            )}
            {state.activeTab === 'diagnostics' && (
              <ModelTabBody
                showDebug={showDebug}
                hasDiagnostics={hasDiagnostics}
                diagnostics={diagnostics}
                hasTrim={hasTrim}
                effectiveCorrelationId={effectiveCorrelationId}
                correlationMismatch={correlationMismatch}
                correlationIdHeader={correlationIdHeader}
                nodes={nodes}
                edges={edges}
                robustness={mappedRobustness}
                factorInfluence={factorInfluenceMap}
                onReanalyse={handleRunAnalysis}
                ceeQuality={ceeQuality}
              />
            )}
            {state.activeTab === 'journey' && (
              <JourneyTabBody />
            )}
          </div>
        )}

        {/* M6: Scenario Comparison - Modal removed, now rendered as ComparisonCanvasLayout in ReactFlowGraph */}

        {/* M6: Loading overlay during comparison */}
        {scenarioComparison.loading && (
          <div
            className="fixed inset-0 z-[1000] bg-black/30 flex items-center justify-center"
            role="progressbar"
            aria-label="Generating scenario comparison"
            data-testid="scenario-comparison-loading"
          >
            <div className="bg-white px-6 py-4 rounded-lg shadow-3 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span className={`${typography.body} text-ink-900`}>Generating comparison...</span>
            </div>
          </div>
        )}

        {/* M6: Error display for comparison */}
        {scenarioComparison.error && (
          <div
            className="fixed bottom-24 right-4 z-[1000] bg-panel border border-danger/30 px-4 py-3 rounded-lg shadow-3 max-w-sm"
            role="alert"
            data-testid="scenario-comparison-error"
          >
            <div className={`${typography.bodySmall} font-medium text-danger-800`}>
              Comparison failed
            </div>
            <p className={`${typography.caption} text-danger-700 mt-1`}>
              {scenarioComparison.error}
            </p>
            <button
              type="button"
              onClick={scenarioComparison.clearComparison}
              className={`mt-2 ${typography.caption} text-danger-600 hover:text-danger-800 underline`}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Legacy v7 sticky footer removed — superseded by AnalysisFooter above */}
    </aside>
  )
}
type CompareSelection = {
  baselineId: string | null
  currentId: string | null
}

function CompareTabBody() {
  // Read scenario metadata and current results hash once per render without
  // subscribing this component to store updates. This avoids nested
  // subscription/update loops while still giving CompareTabBody the
  // information it needs to choose sensible defaults.
  const canvasState = useCanvasStore.getState()
  const scenarioTitle = canvasState.currentScenarioFraming?.title ?? null
  const scenarioLastResultHash = canvasState.currentScenarioLastResultHash ?? null
  const currentResultsHash = canvasState.results.hash ?? null
  // TODO: When run history includes scenario identifiers, filter runs to the current scenario here.
  // For now, CompareTabBody works over all stored runs.
  const [runs, setRuns] = useState<StoredRun[]>(() => loadRuns())
  const [selection, setSelection] = useState<CompareSelection>({ baselineId: null, currentId: null })

  useEffect(() => {
    const unsubscribe = runsBus.on(() => {
      setRuns(loadRuns())
    })
    return unsubscribe
  }, [])

  const contextLine = scenarioTitle
    ? `Comparing runs for: ${scenarioTitle}`
    : 'Comparing runs for this decision.'

  if (runs.length === 0) {
    return (
      <div className="space-y-2" data-testid="compare-tab-empty">
        <p className={`${typography.body} text-ink-900/80`}>{contextLine}</p>
        <p className={`${typography.caption} text-ink-900/70`}>
          No runs to compare yet. Run an analysis to build history for this canvas.
        </p>
      </div>
    )
  }

  if (runs.length === 1) {
    const [onlyRun] = runs
    return (
      <div className="space-y-2" data-testid="compare-tab-single">
        <p className={`${typography.body} text-ink-900/80`}>{contextLine}</p>
        <p className={`${typography.caption} text-ink-900/70`}>
          Only one run is available. Run analysis again to compare changes over time.
        </p>
        <p className={`${typography.code} text-ink-900/70`}>Latest run: {formatRunLabel(onlyRun)}</p>
      </div>
    )
  }

  const defaults = selectDefaultRuns(runs, scenarioLastResultHash, currentResultsHash)

  // Decide which run should be treated as "current" for this scenario.
  // Prefer an explicit user selection when valid, otherwise fall back to scenario-aware defaults.
  let currentId = selection.currentId && runs.some(r => r.id === selection.currentId)
    ? selection.currentId
    : defaults.currentId

  // Decide baseline: prefer explicit selection when valid and distinct from current,
  // otherwise choose the first different run (or null when not available).
  let baselineId = selection.baselineId && runs.some(r => r.id === selection.baselineId)
    ? selection.baselineId
    : defaults.baselineId

  if (currentId && baselineId === currentId) {
    baselineId = runs.find(r => r.id !== currentId)?.id ?? null
  }

  const resolvedCurrentRun = (() => {
    const fromSelection = currentId ? runs.find(r => r.id === currentId) : null
    if (fromSelection) return fromSelection
    if (defaults.currentId) {
      const fromDefaults = runs.find(r => r.id === defaults.currentId)
      if (fromDefaults) return fromDefaults
    }
    return runs[0]
  })()

  const resolvedBaselineRun = (() => {
    if (baselineId && baselineId !== resolvedCurrentRun.id) {
      const fromSelection = runs.find(r => r.id === baselineId)
      if (fromSelection) return fromSelection
    }

    if (defaults.baselineId && defaults.baselineId !== resolvedCurrentRun.id) {
      const fromDefaults = runs.find(r => r.id === defaults.baselineId)
      if (fromDefaults) return fromDefaults
    }

    return runs.find(r => r.id !== resolvedCurrentRun.id) ?? resolvedCurrentRun
  })()

  const handleBaselineChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value || null
    setSelection(prev => ({ ...prev, baselineId: nextId }))
  }

  const handleCurrentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value || null
    setSelection(prev => ({ ...prev, currentId: nextId }))
  }

  return (
    <div className="space-y-3" data-testid="compare-tab-body">
      <p className={`${typography.body} text-ink-900/80`} data-testid="compare-context">{contextLine}</p>

      <div className="space-y-2">
        <label className="flex flex-col gap-1">
          <span className={`${typography.code} font-medium text-ink-900`}>Reference run</span>
          <select
            className={`rounded border border-sand-200 px-2 py-1 ${typography.caption} text-ink-900 bg-white`}
            value={resolvedBaselineRun?.id ?? ''}
            onChange={handleBaselineChange}
            data-testid="compare-baseline-select"
          >
            {runs.map(run => (
              <option key={run.id} value={run.id} disabled={run.id === (resolvedCurrentRun?.id ?? null)}>
                {formatRunLabel(run)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={`${typography.code} font-medium text-ink-900`}>Current run</span>
          <select
            className={`rounded border border-sand-200 px-2 py-1 ${typography.caption} text-ink-900 bg-white`}
            value={resolvedCurrentRun?.id ?? ''}
            onChange={handleCurrentChange}
            data-testid="compare-current-select"
          >
            {runs.map(run => (
              <option key={run.id} value={run.id} disabled={run.id === (resolvedBaselineRun?.id ?? null)}>
                {formatRunLabel(run)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <OutcomeComparison baselineRun={resolvedBaselineRun} currentRun={resolvedCurrentRun} />
    </div>
  )
}

interface OutcomeComparisonProps {
  baselineRun: StoredRun | null
  currentRun: StoredRun | null
}

function OutcomeComparison({ baselineRun, currentRun }: OutcomeComparisonProps) {
  if (!baselineRun || !currentRun) {
    return (
      <div className={`${typography.caption} text-ink-900/70`} data-testid="compare-outcome">
        Select two runs to see an outcome comparison.
      </div>
    )
  }

  const baselineBands = extractOutcomeBands(baselineRun)
  const currentBands = extractOutcomeBands(currentRun)
  const units = currentBands.units || baselineBands.units
  const unitSymbol = currentBands.unitSymbol ?? baselineBands.unitSymbol

  // Phase 1A.1: Get objective text and goal direction for delta interpretation
  const canvasState = useCanvasStore.getState()
  const nodes = canvasState.nodes
  const framing = canvasState.currentScenarioFraming
  const objectiveText = getObjectiveText({ framing, nodes })
  const goalDirection = getGoalDirection(framing, nodes)

  // Phase 1A.1: Compute delta interpretation
  const baselineValue = baselineBands.p50 ?? 0
  const currentValue = currentBands.p50 ?? 0
  const delta = computeDelta({
    currentValue,
    baselineValue,
    goalDirection,
  })

  const unitsString = units === 'currency' ? (unitSymbol ?? '$') : units === 'percent' ? '%' : ''

  return (
    <div className="space-y-3" data-testid="compare-outcome">
      {/* Phase 1A.1: Delta interpretation */}
      {SHOW_VERDICT_FEATURES && baselineBands.p50 !== null && currentBands.p50 !== null && (
        <DeltaInterpretation
          delta={delta}
          objectiveText={objectiveText}
          fromValue={baselineValue}
          toValue={currentValue}
          units={unitsString}
        />
      )}

      <div className={`grid grid-cols-1 gap-2 ${typography.caption} text-ink-900/80`}>
        <OutcomeSummary label="Reference run" run={baselineRun} bands={baselineBands} />
        <OutcomeSummary label="Current run" run={currentRun} bands={currentBands} />
      </div>
      <p className={`${typography.code} text-ink-900/80`} data-testid="compare-delta-text">
        {describeDelta(baselineBands.p50, currentBands.p50, units, unitSymbol)}
      </p>
    </div>
  )
}

interface OutcomeSummaryProps {
  label: string
  run: StoredRun
  bands: OutcomeBands
}

function OutcomeSummary({ label, run, bands }: OutcomeSummaryProps) {
  const cells = [
    { label: RANGE_TERMINOLOGY.conservative.userLabel, value: bands.p10 },
    { label: RANGE_TERMINOLOGY.likely.userLabel, value: bands.p50 },
    { label: RANGE_TERMINOLOGY.optimistic.userLabel, value: bands.p90 },
  ]

  return (
    <div className="rounded-lg border border-sand-200 p-2.5 bg-paper-50">
      <div className={`${typography.code} font-medium text-ink-900`}>{label}</div>
      <div className={`${typography.code} text-ink-900/70 mb-1 tabular-nums`}>{formatRunLabel(run)}</div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {cells.map(cell => (
          <div key={`${label}-${cell.label}`} className="rounded bg-white/80 border border-sand-100 p-1">
            <div className={`${typography.code} font-medium text-ink-900/70`}>
              {cell.label}
            </div>
            <div className={`${typography.code} font-semibold text-ink-900`}>
              {formatOutcomeValue(cell.value, bands.units, bands.unitSymbol)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface OutcomeBands {
  p10: number | null
  p50: number | null
  p90: number | null
  units: OutcomeUnits
  unitSymbol?: string
}

type OutcomeUnits = 'currency' | 'percent' | 'count'

function selectDefaultRuns(
  runs: StoredRun[],
  scenarioLastResultHash: string | null,
  currentResultsHash: string | null,
): CompareSelection {
  if (!runs.length) {
    return { baselineId: null, currentId: null }
  }

  const selected = selectScenarioLastRun({
    runs,
    scenarioLastResultHash,
    currentResultsHash,
  })

  const current = selected ?? runs[0]
  const baseline = runs.find(run => run.id !== current.id) ?? null
  return {
    currentId: current.id,
    baselineId: baseline?.id ?? null,
  }
}

function extractOutcomeBands(run: StoredRun): OutcomeBands {
  const units: OutcomeUnits = run.report?.results?.units ?? 'percent'
  const unitSymbol = run.report?.results?.unitSymbol

  const bands = run.report?.run?.bands

  if (bands) {
    // Canonical SSOT: trust bands even when individual values are null
    return {
      p10: bands.p10 ?? null,
      p50: bands.p50 ?? null,
      p90: bands.p90 ?? null,
      units,
      unitSymbol,
    }
  }

  // Legacy fallback when canonical bands are absent
  return {
    p10: run.report?.results?.conservative ?? null,
    p50: run.report?.results?.likely ?? null,
    p90: run.report?.results?.optimistic ?? null,
    units,
    unitSymbol,
  }
}

function formatOutcomeValue(value: number | null, units: OutcomeUnits, unitSymbol?: string): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    const absolute = Math.abs(value)
    const prefix = value < 0 ? '-' : ''
    if (absolute >= 1_000_000) {
      return `${prefix}${symbol}${(absolute / 1_000_000).toFixed(1)}M`
    }
    if (absolute >= 1_000) {
      return `${prefix}${symbol}${(absolute / 1_000).toFixed(1)}K`
    }
    return `${prefix}${symbol}${absolute.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'count') {
    const absolute = Math.abs(value)
    const prefix = value < 0 ? '-' : ''
    // Auto-detect probability format for count units
    if (absolute >= 0 && absolute <= 1 && (absolute !== Math.floor(absolute) || absolute === 0 || absolute === 1)) {
      return `${prefix}${(absolute * 100).toFixed(1)}%`
    }
    if (absolute >= 1_000_000) {
      return `${prefix}${(absolute / 1_000_000).toFixed(1)}M`
    }
    if (absolute >= 1_000) {
      return `${prefix}${(absolute / 1_000).toFixed(1)}K`
    }
    return `${prefix}${absolute.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }

  // Default (percent): auto-detect if value is in 0-1 probability form
  // Values in 0-1 range (inclusive) are treated as probabilities: 0.5 → 50%, 1 → 100%
  const isProbability = value >= 0 && value <= 1
  const displayValue = isProbability ? value * 100 : value
  return `${displayValue.toFixed(1)}%`
}

function describeDelta(
  baseline: number | null,
  current: number | null,
  units: OutcomeUnits,
  unitSymbol?: string,
): string {
  if (baseline === null || current === null) {
    return 'Most likely outcome could not be compared for these runs.'
  }

  const diff = current - baseline
  if (Math.abs(diff) < 0.05) {
    return 'Most likely outcome is unchanged vs the reference run.'
  }

  const direction = diff > 0 ? 'increased' : 'decreased'
  const deltaText = formatDeltaValue(diff, units, unitSymbol)
  return `Most likely outcome ${direction} by ${deltaText} vs the reference run.`
}

function formatDeltaValue(value: number, units: OutcomeUnits, unitSymbol?: string): string {
  if (value === 0) {
    return formatOutcomeValue(0, units, unitSymbol)
  }

  const prefix = value > 0 ? '+' : '-'
  const formatted = formatOutcomeValue(Math.abs(value), units, unitSymbol)
  return `${prefix}${formatted}`
}

function formatRunLabel(run: StoredRun): string {
  return `${getHashSnippet(run.hash)} · ${formatRunTimestamp(run.ts)}`
}

function getHashSnippet(hash?: string): string {
  if (!hash) {
    return 'No hash'
  }
  return hash.length > 8 ? `${hash.slice(0, 8)}…` : hash
}

function formatRunTimestamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ')
}
