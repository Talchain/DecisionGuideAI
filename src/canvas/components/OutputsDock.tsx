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
import { BarChart3, Shuffle, Activity, Clock, PlayCircle, RefreshCw, AlertTriangle, GitCompare } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useDockState } from '../hooks/useDockState'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useCanvasStore, selectResultsStatus, selectReport, selectError } from '../store'
import { loadRuns, type StoredRun } from '../store/runHistory'
import * as runsBus from '../store/runsBus'
import { typography } from '../../styles/typography'
import { buildHealthStrings } from '../utils/graphHealthStrings'
import type { GraphHealth } from '../validation/types'
import { selectScenarioLastRun } from '../shared/lastRun'
import {
  trackCompareOpened,
  trackAutoFixClicked,
  trackAutoFixSuccess,
  trackAutoFixFailed,
} from '../utils/sandboxTelemetry'
import { VerdictCard } from './VerdictCard'
import { DecisionReviewPanel, type DecisionReviewStatus } from './DecisionReviewPanel'
import { DeltaInterpretation } from './DeltaInterpretation'
// ISL client memoization bug fixed - ValidationSuggestionsSection now stable
import { ValidationSuggestionsSection } from './ValidationSuggestions'
import { isDecisionReviewEnabled } from '../../flags'
import { getObjectiveText, getGoalDirection } from '../utils/getObjectiveText'
import { computeDelta, deriveVerdict } from '../utils/interpretOutcome'
import { useDebugShortcut } from '../hooks/useDebugShortcut'
import { RANGE_TERMINOLOGY } from '../../config/terminology'
import { IdentifiabilityBadge, normalizeIdentifiabilityTag } from './IdentifiabilityBadge'
import { EvidenceCoverageCompact } from './EvidenceCoverage'
// DecisionReadinessBadge import removed — readiness content absorbed into Hero "More" expand
import { ModelQualityScore } from './ModelQualityScore'
import { UnifiedStatusBadge } from './UnifiedStatusBadge'
import { InsightsPanel } from './InsightsPanel'
import { ValidationPanel, type CritiqueItem } from './ValidationPanel'
import { GraphTextView } from './GraphTextView'
import { PreAnalysisGuidance } from './PreAnalysisGuidance'
import { PreAnalysisHealth } from './PreAnalysisHealth'
import { PreAnalysisPanel } from './pre-analysis'
import { usePreRunValidation } from '../hooks/usePreRunValidation'
import { usePreAnalysisData } from './pre-analysis/hooks/usePreAnalysisData'
import { ActionsSignal } from './ActionsSignal'
import { WarningBanner } from './WarningBanner'
import { DegradedStateBanner } from './DegradedStateBanner'
import { OutcomesSignal } from './OutcomesSignal'
import { TrustSignal } from './TrustSignal'
import { DriversSignal } from './DriversSignal'
import { DecisionSummary } from './DecisionSummary'
import { DecisionQuality } from './DecisionQuality'
import { AdvancedSettingsPanel } from './AdvancedSettingsPanel'
import { mapConfidenceToReadiness } from '../utils/mapConfidenceToReadiness'
import { useV2Run } from '../hooks/useV2Run'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { buildFragileEdgeIdSet, buildRobustEdgeIdSet, getDisplayEdgeId } from '../utils/edgeIdentity'
import { NON_EVIDENCE_PROVENANCE } from '../utils/evidenceCoverage'
import { LensContainer } from './LensContainer'
// Results Panel Redesign: v7 four-section layout components
import { useResultsSectionData } from '../../components/results/useResultsSectionData'
import type { TornadoRow } from '../../components/results/TornadoChart'
import { useCanvasResultsSync } from '../../components/results/useCanvasResultsSync'
import { ResultsBody } from '../../components/results/ResultsBody'
import { executeAutoFix, determineFixType, type AutoFixParams } from '../utils/autoFix'
import { getStrengthCorrections, type StrengthCorrection } from '../../adapters/plot/v2/adapter'
import { computeCTA, type CTAConfig } from '../../lib/ctaStateMachine'
import { computeReadiness } from '../../lib/readiness'
// P0.1: Driver gating utilities
import { areDriversInformative, getDriversGatingState } from '../../lib/driversGating'
// P0.6: User-friendly error messages
import { getUserFriendlyError } from '../../lib/userFriendlyErrors'
// Phase 0.3: Response normalisation and degeneracy detection
import { normaliseResponse, checkOutcomeDegeneracy } from '../../lib/responseNormalisation'
import { DegeneracyWarning, useDegeneracyDismissal } from './DegeneracyWarning'
// P0.7: Loading skeletons
import { ResultsPanelSkeleton } from './ResultsPanelSkeleton'
// P0.8: Instrumentation
import { trackRunStarted, trackRunCompleted, trackRunFailed } from '../../lib/resultsInstrumentation'
// P0-2: Mixed messaging gating
import { getAnalysisDisplayState, type EnrichmentForDisplayState } from '../../lib/analysisDisplayState'
import { useComparisonDetection } from '../hooks/useComparisonDetection'
import { useScenarioComparison } from '../hooks/useScenarioComparison'
import { useOptionRanking } from '../hooks/useOptionRanking'
import { useRobustness } from '../hooks/useRobustness'
import { mapRobustness } from '../../lib/mappers/mapRobustness'
import type { MappedRobustness } from '../../lib/mappers/types'
import { RobustnessBlock } from './RecommendationCard/RobustnessBlock'
import { EvidencePackExport } from './ResultsPanel/EvidencePackExport'
// ScenarioComparison modal removed - now rendered as ComparisonCanvasLayout in ReactFlowGraph
import type { CritiqueItemV1 } from '../../adapters/plot/types'
import type { Node, Edge } from '@xyflow/react'

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

type OutputsDockTab = 'results' | 'compare' | 'diagnostics'

interface OutputsDockState {
  isOpen: boolean
  activeTab: OutputsDockTab
}

const STORAGE_KEY = 'canvas.outputsDock.v1'

// Feature flag for Phase 1A.1: Verdict Card + Delta Interpretation
const SHOW_VERDICT_FEATURES = import.meta.env.VITE_SHOW_VERDICT_CARD === 'true'

const OUTPUT_TABS: { id: OutputsDockTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'compare', label: 'Compare' },
  { id: 'diagnostics', label: 'Structure' },
]

export function OutputsDock() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [state, setState] = useDockState<OutputsDockState>(STORAGE_KEY, {
    isOpen: true,
    activeTab: 'results',
  })

  // Phase 1A.5: Debug controls visibility (Shift+D shortcut)
  const { showDebug } = useDebugShortcut()

  // Phase 2 Sprint 1B: Slow-run UX feedback (20s/40s thresholds)
  const [slowRunMessage, setSlowRunMessage] = useState<string | null>(null)
  const runStartTimeRef = useRef<number | null>(null)

  // M6: Comparison prompt state (dismissed persists in sessionStorage)
  const [comparisonDismissed, setComparisonDismissed] = useState<boolean>(() => {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem('comparison-prompt-dismissed') === 'true'
  })

  // Phase 2: Response warnings banner dismissal state
  const [warningsDismissed, setWarningsDismissed] = useState(false)
  // P2: Degraded/partial state banner dismissal
  const [degradedBannerDismissed, setDegradedBannerDismissed] = useState(false)
  const comparison = useComparisonDetection()
  const scenarioComparison = useScenarioComparison()
  const optionRanking = useOptionRanking()

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
  const setShowIssuesPanel = useCanvasStore(s => s.setShowIssuesPanel)
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

  // P0-UI-6: Pre-run validation hook
  const preRunValidation = usePreRunValidation()

  // Pre-run readiness from canonical usePreAnalysisData hook
  const preAnalysisReadiness = usePreAnalysisData()

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

  const healthView = buildHealthStrings(graphHealth ?? null)
  const isPreRun = !hasCompletedFirstRun
  // Empty state: hide panel when canvas has no nodes
  const hasGraphContent = nodes.length > 0

  // DEBUG: Log node count on every render to diagnose empty state issue
  if (import.meta.env.DEV) {
    console.log('[OutputsDock] nodes.length:', nodes.length, 'hasGraphContent:', hasGraphContent)
  }
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const report = useCanvasStore(selectReport)
  const error = useCanvasStore(selectError)

  // P0-UI: V2 run hook for /v2/run endpoint
  const { runV2Analysis } = useV2Run()

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
  // v7 layout: Drivers are always visible (no accordion), so isAccordionExpanded is always true
  const { highlightedDriverId, registerDriverRef } = useCanvasResultsSync({
    drivers: resultsSectionData.drivers.drivers,
    isAccordionExpanded: true,
    onExpandAccordion: () => { /* no-op: drivers always visible in v7 layout */ },
  })

  const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

  // Unified run eligibility: canonical readiness from usePreAnalysisData AND pre-run validation
  // P0-UI-6: Added preRunValidation.canRun check
  const canRunAnalysis = preAnalysisReadiness.isReady && preRunValidation.canRun && !isRunning

  // R3: CTA state machine for primary analysis button
  // P0.3: Enhanced with option count, driver informativeness, confidence level
  const ctaConfig: CTAConfig = useMemo(() => {
    // Compute readiness from current state
    const hasOutcome = nodes.some(n => n.type === 'outcome')
    const hasDecision = nodes.some(n => n.type === 'decision')
    const readinessResult = computeReadiness({
      nodeCount: nodes.length,
      edgeCount: edges.length,
      graphHealth,
      hasOutcome,
      hasDecision,
    })

    // P0.1: Check if drivers are informative for CTA decisions
    const driversInformative = areDriversInformative(report?.drivers_payload)
    // P0.3: Get fallback message for "Strengthen Model" tooltip context
    const gatingState = getDriversGatingState(report?.drivers_payload)

    return computeCTA({
      resultsStatus,
      hasGraph: nodes.length > 0,
      readinessLevel: readinessResult.level,
      isDegraded: runMeta?.degraded,
      errorMessage: error?.message,
      // P0.3: Enhanced CTA inputs
      optionCount: comparison.optionNodes.length,
      driversInformative,
      confidenceLevel: report?.confidence?.level as 'high' | 'medium' | 'low' | undefined,
      canCompare: comparison.canCompare && resultsStatus === 'complete',
      driversFallbackMessage: gatingState.fallbackMessage,
    })
  }, [resultsStatus, nodes, edges, graphHealth, runMeta?.degraded, error?.message, comparison.optionNodes.length, comparison.canCompare, report?.drivers_payload, report?.confidence?.level])

  // Handle Run button click
  const handleRunAnalysis = useCallback(async () => {
    if (!canRunAnalysis) return
    // P0.8: Track run started
    trackRunStarted({
      option_count: comparison.optionNodes.length,
      node_count: nodes.length,
      edge_count: edges.length,
    })
    // P0: Log graph used for observability
    console.info('[GRAPH_USED_FOR_RUN]', {
      node_count: nodes.length,
      edge_count: edges.length,
      option_count: comparison.optionNodes.length,
      template_id: (framing as any)?.templateId || 'canvas-graph',
    })
    // P0-UI: Use V2 adapter (gets nodes, edges, outcomeNodeId from store)
    await runV2Analysis()
  }, [canRunAnalysis, runV2Analysis, framing, nodes, edges, comparison.optionNodes.length])

  // M6: Handle comparison prompt dismissal
  const handleDismissComparison = useCallback(() => {
    setComparisonDismissed(true)
    try {
      sessionStorage.setItem('comparison-prompt-dismissed', 'true')
    } catch {}
  }, [])

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
          confidence: 0, // No confidence needed for decision→option edge
        },
      })
    }

    // Invalidate CEE analysis ready cache so next run re-extracts options
    setCeeAnalysisReady(null)

    console.info('[OutputsDock] Added Status Quo baseline option:', newNode.id)
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

  // M6: Handle compare now action - triggers scenario comparison
  const handleCompareNow = useCallback(async () => {
    handleDismissComparison()
    trackCompareOpened()
    // Start scenario comparison workflow
    await scenarioComparison.startComparison()
  }, [handleDismissComparison, scenarioComparison])

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
  const resultUnitSymbol = report?.results.unitSymbol
  const hasInlineSummary = Boolean(report && resultsStatus === 'complete')

  // P0.2: Compute evidence coverage from local edge provenance for consistency
  // This ensures Results and Diagnostics tabs show the same numbers
  // Memoized to prevent recomputation on unrelated state changes
  const totalEdges = edges.length
  const evidencedEdges = useMemo(
    () => edges.filter(e => e.data?.provenance && e.data.provenance.trim() !== '').length,
    [edges]
  )
  const objectiveText = getObjectiveText({ framing, nodes })
  const goalDirection = getGoalDirection(framing, nodes)
  const isError = resultsStatus === 'error'

  // Phase 1A.1: Compute verdict for VerdictCard
  // Use baseline from framing or default to 0 ("do nothing" scenario)
  const baselineValue = framing?.baseline ?? 0

  // Brief 31 Task 6: Memoize topDrivers to prevent InsightsPanel re-render loop
  const topDrivers = useMemo(() => {
    if (!report?.drivers) return undefined
    return report.drivers.slice(0, 3).map(d => ({
      label: d.label,
      polarity: d.polarity,
      strength: d.strength,
      contribution: d.contribution,
    }))
  }, [report?.drivers])

  // P0.1: Driver gating state for contradiction prevention
  const driversGating = useMemo(
    () => getDriversGatingState(report?.drivers_payload),
    [report?.drivers_payload]
  )

  // P0-2: Mixed messaging gating - compute display state based on critical issues
  // Uses stable primitive deps to prevent render loops
  const analysisDisplayState = useMemo(() => {
    const enrichmentData: EnrichmentForDisplayState = {
      critique: report?.run?.critique,
      identifiability_tag: report?.model_card?.identifiability_tag as 'identifiable' | 'not_identifiable' | 'partially_identifiable' | 'unknown' | undefined,
    }
    return getAnalysisDisplayState(enrichmentData)
  }, [
    // Use stable primitive deps - array lengths rather than object references
    report?.run?.critique?.length,
    report?.model_card?.identifiability_tag,
  ])

  const verdict = mostLikelyValue !== null
    ? deriveVerdict({
        outcomeValue: mostLikelyValue,
        baselineValue,
        goalDirection,
      })
    : null

  const decisionReviewFlagOn = isDecisionReviewEnabled()
  // Legacy CEE types (deprecated)
  const ceeReview = runMeta.ceeReview ?? null
  const ceeTrace = runMeta.ceeTrace ?? null
  const ceeError = runMeta.ceeError ?? null
  // M1 CEE Orchestrator types (preferred)
  const ceeReviewV1 = runMeta.ceeReviewV1 ?? null
  const ceeTraceV1 = runMeta.ceeTraceV1 ?? null
  const ceeErrorV1 = runMeta.ceeErrorV1 ?? null

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
  const hasDecisionReadiness = !isPreRun && !!decisionReadiness
  const hasBlockers = hasDecisionReadiness && decisionReadiness!.blockers.length > 0
  const isReadyForOutcome = hasDecisionReadiness && decisionReadiness!.ready && !hasBlockers

  if (import.meta.env.DEV) {
    // Dev-only instrumentation for trust signals visibility and gating
    // eslint-disable-next-line no-console
    console.debug('[TrustSignals] OutputsDock', {
      isPreRun,
      hasReport: !!report,
      hasDecisionReadiness: !!decisionReadiness,
      fromConfidence: !!readinessFromConfidence,
      hasGraphQuality: !!report?.graph_quality,
      hasInsights: !!report?.insights,
    })
  }

  // Phase 0.3: Normalize response and check for degeneracy
  const normalisedResponse = useMemo(() => normaliseResponse(report), [report])
  const degeneracyCheck = useMemo(() => checkOutcomeDegeneracy(normalisedResponse), [normalisedResponse])
  useDegeneracyDismissal(robustnessRunId)

  const mappedRobustness: MappedRobustness | null = useMemo(() => {
    const raw = (report as any)?.robustness
    if (!raw) return null
    return mapRobustness(raw, { sourcePath: 'top_level' })
  }, [report])

  let decisionReviewStatus: DecisionReviewStatus | null = null
  if (decisionReviewFlagOn) {
    if (resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming') {
      decisionReviewStatus = 'loading'
    } else if (resultsStatus === 'complete' && report) {
      // Check both V1 types (preferred) and legacy types for backwards compatibility
      // V1 types come from synthesized data when using V2 endpoint
      if (ceeErrorV1 || ceeError) {
        decisionReviewStatus = 'error'
      } else if (ceeReviewV1 || ceeReview) {
        decisionReviewStatus = 'ready'
      } else if (ceeTraceV1 || ceeTrace) {
        // CEE was engaged for this run (trace present) but no review/error was returned.
        // Treat this as an "empty" Decision Review state.
        decisionReviewStatus = 'empty'
      }
    }
  }

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
  const lastDockOpenRef = useRef<number>(0)

  useEffect(() => {
    // Determine if dock should open based on either trigger
    const shouldOpenForResults =
      resultsStatus === 'preparing' ||
      resultsStatus === 'connecting' ||
      resultsStatus === 'streaming' ||
      resultsStatus === 'complete' ||
      resultsStatus === 'error'

    const shouldOpen = shouldOpenForResults || showResultsPanel

    if (!shouldOpen) return

    // Debounce: prevent rapid updates within 50ms (React #185 fix)
    const now = Date.now()
    if (now - lastDockOpenRef.current < 50) {
      return
    }
    lastDockOpenRef.current = now

    setState(prev => {
      // Guard: only update if state actually needs to change
      if (prev.isOpen && prev.activeTab === 'results') {
        return prev // No change needed
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
      return { ...prev, isOpen: nextIsOpen }
    })
  }

  const handleTabClick = (tab: OutputsDockTab) => {
    setState(prev => ({ ...prev, isOpen: true, activeTab: tab }))

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

  // Empty state: hide panel completely when canvas has no nodes
  // Return null to completely unmount - no DOM element, no visual footprint
  if (!hasGraphContent) {
    return null
  }

  return (
    <aside
      className={`${transitionClass} flex flex-col transition-shadow pointer-events-auto`}
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
                  className={`flex-1 px-2 py-1 rounded ${typography.caption} font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-offset-1 ${
                    state.activeTab === tab.id
                      ? 'bg-sky-200 text-sky-600 border-b-2 border-sky-500'
                      : 'text-ink-900/70 hover:bg-paper-50 hover:text-ink-900 border-b-2 border-transparent'
                  }`}
                >
                  {tab.label}
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
                : Activity
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center justify-center w-7 h-7 rounded-full border ${typography.caption} focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'bg-sky-200 text-sky-600 border-sky-500'
                    : 'text-ink-900/70 bg-paper-50 border-sand-200 hover:bg-paper-50 hover:text-ink-900'
                }`}
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
        <div className={`flex-1 min-h-0 ${typography.caption} text-ink-900/70 ${isPreRun && nodes.length > 0 ? 'flex flex-col overflow-hidden' : 'px-3 py-3 space-y-4 overflow-y-auto'}`} data-testid="outputs-dock-body">
            {state.activeTab === 'results' && (
              <div className={isPreRun && nodes.length > 0 ? 'flex-1 min-h-0 flex flex-col' : 'space-y-6'}>
                {/* P0.6: User-friendly error display */}
                {isError && error && (() => {
                  const friendlyError = getUserFriendlyError({
                    code: error.code,
                    message: error.message,
                    hasPartialResults: Boolean(report),
                  })
                  return (
                    <div
                      className={`flex flex-col gap-2 px-3 py-3 rounded-lg border ${
                        friendlyError.severity === 'error'
                          ? 'bg-danger-50 border-danger-200'
                          : friendlyError.severity === 'warning'
                            ? 'bg-sun-50 border-sun-200'
                            : 'bg-sky-50 border-sky-200'
                      }`}
                      role="alert"
                      aria-live="polite"
                      data-testid="outputs-error-banner"
                    >
                      <div className={`${typography.body} font-medium ${
                        friendlyError.severity === 'error'
                          ? 'text-danger-800'
                          : friendlyError.severity === 'warning'
                            ? 'text-sun-800'
                            : 'text-sky-800'
                      }`}>
                        {friendlyError.headline}
                      </div>
                      <div className={`${typography.caption} text-ink-900/80`}>
                        {friendlyError.explanation}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {friendlyError.canRetry && (
                          <button
                            type="button"
                            onClick={handleRunAnalysis}
                            disabled={isRunning}
                            className={`${typography.caption} font-medium px-3 py-1.5 rounded ${
                              friendlyError.severity === 'error'
                                ? 'bg-danger-600 text-white hover:bg-danger-700'
                                : friendlyError.severity === 'warning'
                                  ? 'bg-sun-600 text-white hover:bg-sun-700'
                                  : 'bg-sky-600 text-white hover:bg-sky-700'
                            } disabled:opacity-50`}
                          >
                            {friendlyError.actionText}
                          </button>
                        )}
                        {friendlyError.secondaryActionText && (
                          <button
                            type="button"
                            className={`${typography.caption} font-medium px-3 py-1.5 rounded border ${
                              friendlyError.severity === 'error'
                                ? 'border-danger-300 text-danger-700 hover:bg-danger-100'
                                : friendlyError.severity === 'warning'
                                  ? 'border-sun-300 text-sun-700 hover:bg-sun-100'
                                  : 'border-sky-300 text-sky-700 hover:bg-sky-100'
                            }`}
                          >
                            {friendlyError.secondaryActionText}
                          </button>
                        )}
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
                    isThresholdFromBrief={preAnalysisReadiness.isThresholdAutoDerived}
                    onAddStatusQuoBaseline={addStatusQuoBaseline}
                    onApplyThreshold={handleApplyThreshold}
                    onAddBaseline={handleAddBaseline}
                    nSamples={(report as any)?.summary?.n_samples_used ?? (report as any)?.meta?.n_samples}
                    seedUsed={(report as any)?.meta?.seed}
                    fragileEdgeCount={(report as any)?.robustness?.fragile_edges?.length}
                    robustEdgeCount={(report as any)?.robustness?.robust_edges?.length}
                    responseHash={results?.hash}
                    nodeCount={nodes.length}
                    edgeCount={edges.length}
                    identifiability={report?.model_card?.identifiability_tag}
                    goalDirection={goalDirection}
                  />
                )}
              </div>
            )}
            {state.activeTab === 'compare' && (
              <CompareTabBody />
            )}
            {state.activeTab === 'diagnostics' && (
              <DiagnosticsTabBody
                healthView={healthView}
                graphHealth={graphHealth}
                setShowIssuesPanel={setShowIssuesPanel}
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
                robustnessSynthesis={ceeReviewV1?.robustness_synthesis ?? null}
              />
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
            <div className="bg-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span className={`${typography.body} text-ink-900`}>Generating comparison...</span>
            </div>
          </div>
        )}

        {/* M6: Error display for comparison */}
        {scenarioComparison.error && (
          <div
            className="fixed bottom-24 right-4 z-[1000] bg-danger-50 border border-danger-200 px-4 py-3 rounded-lg shadow-lg max-w-sm"
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

        {/* ── v7 STICKY FOOTER: Rerun + Compare ──────────────────────────── */}
        {/* Fixed to bottom of dock. Visible post-run only. */}
        {state.isOpen && !isPreRun && (
          <div
            className="sticky bottom-0 z-10 flex gap-1.5 px-2 py-2 rounded-b-2xl"
            style={{
              background: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-default)',
              boxShadow: '0 -2px 8px rgba(38,38,38,0.06)',
            }}
            data-testid="outputs-sticky-footer"
          >
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold transition-colors ${
                isRunning
                  ? 'bg-sand-200 text-text-light cursor-not-allowed'
                  : 'text-text-header hover:opacity-90'
              }`}
              style={isRunning ? undefined : { backgroundColor: 'var(--goal)' }}
              data-testid="outputs-rerun-button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRunning ? 'Running...' : 'Rerun'}
            </button>
            {comparison.canCompare && (
              <button
                type="button"
                onClick={handleCompareNow}
                disabled={scenarioComparison.loading}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold transition-colors border ${
                  scenarioComparison.loading
                    ? 'bg-sand-200 text-text-light border-sand-200 cursor-not-allowed'
                    : 'bg-panel text-text-header border-panel-border hover:bg-panel-hover'
                }`}
                data-testid="outputs-compare-button"
              >
                <GitCompare className="w-3.5 h-3.5" aria-hidden="true" />
                {scenarioComparison.loading ? 'Comparing...' : 'Compare'}
              </button>
            )}
          </div>
        )}
    </aside>
  )
}

/**
 * Diagnostics tab body - extracted for clarity
 */
function DiagnosticsTabBody({
  healthView,
  graphHealth,
  setShowIssuesPanel,
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
  robustnessSynthesis,
}: {
  healthView: { label: string; detail: string }
  graphHealth: GraphHealth | null
  setShowIssuesPanel: (show: boolean) => void
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
  robustnessSynthesis: {
    headline?: string
    assumption_explanations?: Array<{ node_id: string; label: string; explanation: string }>
    investigation_suggestions?: string[]
  } | null
}) {
  // Build fragile and robust edge ID sets for badges using adapter
  const fragileEdgeIds = useMemo(() => {
    if (!robustness?.fragileEdges) return new Set<string>()
    return buildFragileEdgeIdSet(robustness.fragileEdges)
  }, [robustness?.fragileEdges])

  const robustEdgeIds = useMemo(() => {
    if (!robustness?.robustEdges) return new Set<string>()
    return buildRobustEdgeIdSet(robustness.robustEdges)
  }, [robustness?.robustEdges])

  // Determine analysis state for banner
  // Check if robustness object exists (analysis completed), not if arrays have content
  // Empty/undefined arrays are valid (model may be fully robust with no fragile edges)
  const hasRobustnessData = !!robustness
  const hasSynthesis = !!robustnessSynthesis?.headline
  const hasPartialData = hasRobustnessData && !hasSynthesis
  const needsAnalysis = !hasRobustnessData && !hasSynthesis

  // Find edges without real evidence (missing provenance or non-evidence markers)
  // Uses canonical NON_EVIDENCE_PROVENANCE for consistency with countEdgesWithEvidence
  const edgesWithoutEvidence = useMemo(() => {
    return edges.filter(edge => {
      const provenance = (edge.data as any)?.provenance
      return !provenance || NON_EVIDENCE_PROVENANCE.includes(provenance)
    })
  }, [edges])

  return (
    <div className="space-y-0" data-testid="diagnostics-tab">
      {/* ===== LENS 1: CAUSAL LOGIC (default OPEN) ===== */}
      <LensContainer title="Causal Logic" defaultOpen={true} testId="lens-causal-logic">
        {/* A. Analysis State Banner */}
        {needsAnalysis && (
          <div className="mb-4 p-3 bg-sand-50 border border-sand-200 rounded-lg">
            <p className={`${typography.body} text-ink-600`}>
              Run analysis to see causal explanations.
            </p>
          </div>
        )}
        {hasPartialData && (
          <div className="mb-4 p-3 bg-sun-50 border border-sun-200 rounded-lg">
            <p className={`${typography.body} text-sun-800`}>
              Analysis incomplete — some insights unavailable.
            </p>
          </div>
        )}

        {/* B. Key Assumptions - Fragile edges with explanations */}
        {robustness?.fragileEdges && robustness.fragileEdges.length > 0 && (
          <div className="mb-4" data-testid="key-assumptions-section">
            <div className={`${typography.label} text-ink-700 mb-2`}>Key Assumptions</div>
            <div className="space-y-2">
              {robustness.fragileEdges.map((fragileEdge, idx) => {
                const edgeId = fragileEdge.edgeId
                const edgeLabel = fragileEdge.fromLabel && fragileEdge.toLabel
                  ? `${fragileEdge.fromLabel} → ${fragileEdge.toLabel}`
                  : edgeId
                // Find matching assumption explanation if available
                const explanation = robustnessSynthesis?.assumption_explanations?.find(
                  ae => ae.node_id === edgeId || ae.label === edgeLabel
                )

                return (
                  <div key={edgeId || idx} className="p-2 bg-amber-50 border border-amber-200 rounded">
                    <button
                      type="button"
                      onClick={() => focusEdgeById(edgeId)}
                      className="flex items-center gap-2 text-left w-full hover:bg-amber-100 rounded p-1 -m-1 transition-colors"
                    >
                      <span className="text-amber-600">⚠️</span>
                      <span className={`${typography.body} text-amber-800 flex-1`}>
                        {edgeLabel}
                      </span>
                      <span className={`${typography.caption} text-amber-600`}>click to focus</span>
                    </button>
                    {explanation && (
                      <p className={`${typography.caption} text-amber-700 mt-1 pl-6`}>
                        {explanation.explanation}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Robust edges */}
        {robustness?.robustEdges && robustness.robustEdges.length > 0 && (
          <div className="mb-4" data-testid="robust-edges-section">
            <div className={`${typography.label} text-ink-700 mb-2`}>Stable Assumptions</div>
            <div className="space-y-1">
              {robustness.robustEdges.slice(0, 5).map((edgeId, idx) => {
                // Try to find the edge to get labels
                const edge = edges.find(e => getDisplayEdgeId(e) === edgeId)
                const sourceNode = edge ? nodes.find(n => n.id === edge.source) : null
                const targetNode = edge ? nodes.find(n => n.id === edge.target) : null
                const edgeLabel = sourceNode && targetNode
                  ? `${(sourceNode.data as any)?.label || sourceNode.id} → ${(targetNode.data as any)?.label || targetNode.id}`
                  : edgeId

                return (
                  <button
                    key={edgeId || idx}
                    type="button"
                    onClick={() => focusEdgeById(edgeId)}
                    className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded w-full text-left hover:bg-emerald-100 transition-colors"
                  >
                    <span className="text-emerald-600">✓</span>
                    <span className={`${typography.body} text-emerald-800 flex-1`}>
                      {edgeLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* C. Investigation Suggestions */}
        {robustnessSynthesis?.investigation_suggestions && robustnessSynthesis.investigation_suggestions.length > 0 && (
          <div className="mb-4" data-testid="investigation-suggestions-section">
            <div className={`${typography.label} text-ink-700 mb-2`}>Suggested Next Steps</div>
            <div className="space-y-1">
              {robustnessSynthesis.investigation_suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-sky-500 mt-0.5">→</span>
                  <p className={`${typography.body} text-ink-700`}>{suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* D. Closure - What this decision hinges on */}
        <div data-testid="closure-section">
          <div className={`${typography.label} text-ink-700 mb-2`}>What this decision hinges on</div>
          {robustnessSynthesis?.headline ? (
            <p className={`${typography.body} text-ink-700`}>
              {robustnessSynthesis.headline}
            </p>
          ) : (
            <p className={`${typography.body} text-ink-500`}>
              Run analysis to generate a summary of what matters most.
            </p>
          )}
        </div>
      </LensContainer>

      {/* ===== LENS 2: MODEL STRUCTURE (default COLLAPSED) ===== */}
      <LensContainer title="Model Structure" defaultOpen={false} testId="lens-model-structure">
        {/* Group headers with microcopy */}
        <div className="mb-3">
          <div className={`${typography.label} text-ink-700 mb-1`}>Organisational Structure</div>
          <p className={`${typography.caption} text-ink-500 mb-2`}>
            Decisions and options organise alternatives; factors and edges drive inference.
          </p>
        </div>

        {/* Full GraphTextView with all P1 functionality */}
        <GraphTextView
          nodes={nodes}
          edges={edges}
          onNodeClick={focusNodeById}
          onEdgeClick={focusEdgeById}
          fragileEdgeIds={fragileEdgeIds}
          robustEdgeIds={robustEdgeIds}
        />
      </LensContainer>

      {/* ===== LENS 3: IMPROVEMENTS (default COLLAPSED) ===== */}
      <LensContainer title="Improvements" defaultOpen={false} testId="lens-improvements">
        {/* A. Evidence Gaps */}
        {edgesWithoutEvidence.length > 0 && (
          <div className="mb-4" data-testid="evidence-gaps-section">
            <div className={`${typography.label} text-ink-700 mb-2`}>Strengthen Your Model</div>
            <div className="space-y-1">
              {edgesWithoutEvidence.slice(0, 5).map(edge => {
                const edgeId = getDisplayEdgeId(edge)
                const sourceNode = nodes.find(n => n.id === edge.source)
                const targetNode = nodes.find(n => n.id === edge.target)
                const edgeLabel = sourceNode && targetNode
                  ? `${(sourceNode.data as any)?.label || sourceNode.id} → ${(targetNode.data as any)?.label || targetNode.id}`
                  : edgeId

                return (
                  <button
                    key={edgeId}
                    type="button"
                    onClick={() => focusEdgeById(edgeId)}
                    className="flex items-center gap-2 p-2 bg-paper-50 border border-sand-200 rounded w-full text-left hover:bg-sand-50 transition-colors"
                  >
                    <span className="text-sand-500">◐</span>
                    <span className={`${typography.body} text-ink-700 flex-1`}>
                      {edgeLabel}
                    </span>
                    <span className={`${typography.caption} text-ink-500`}>Add evidence to increase confidence</span>
                  </button>
                )
              })}
              {edgesWithoutEvidence.length > 5 && (
                <p className={`${typography.caption} text-ink-500 pl-6`}>
                  +{edgesWithoutEvidence.length - 5} more edges without evidence
                </p>
              )}
            </div>
          </div>
        )}

        {/* B. Gated Validation */}
        <div data-testid="isl-validation-section">
          <div className={`${typography.label} text-ink-700 mb-2`}>Validation</div>
          <p className={`${typography.body} text-ink-500`}>
            Validation suggestions not available in this environment
          </p>
        </div>
      </LensContainer>

      {/* Phase 1A.5: Streaming Diagnostics - Hidden by default, Shift+D to show */}
      {showDebug && (
        <>
          <div className={`${typography.label} text-ink-900 pt-2 border-t border-sand-200`}>
            Streaming diagnostics
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between" data-testid="diag-resumes" title="Resumes: times the stream reconnected.">
              <span className="text-ink-900/70">Resumes</span>
              <span className="tabular-nums text-ink-900">{hasDiagnostics ? diagnostics?.resumes ?? 0 : 0}</span>
            </div>
            <div className="flex items-center justify-between" data-testid="diag-recovered" title="Recovered events: events caught up after a resume.">
              <span className="text-ink-900/70">Recovered events</span>
              <span className="tabular-nums text-ink-900">{hasDiagnostics ? diagnostics?.recovered_events ?? 0 : 0}</span>
            </div>
            <div className="flex items-center justify-between" data-testid="diag-trims" title="Buffer trimmed: older events were dropped to keep streaming responsive.">
              <span className="text-ink-900/70">Buffer trimmed</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${typography.code} font-medium border`} aria-label={hasTrim ? 'Buffer was trimmed' : 'Buffer was not trimmed'}>
                {hasTrim ? (
                  <span className="bg-sun-50 text-sun-800 border-sun-200 px-1.5 py-0.5 rounded">Yes</span>
                ) : (
                  <span className="text-ink-900/80 border-sand-200 px-1.5 py-0.5 rounded">No</span>
                )}
              </span>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-sand-200">
            <div className="flex items-center justify-between" title="Correlation ID: include this when reporting issues.">
              <span className="text-ink-900/70">Correlation ID</span>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono ${typography.code} text-ink-900 max-w-[10rem] truncate`}
                  data-testid="diag-correlation-value"
                >
                  {effectiveCorrelationId ?? '—'}
                </span>
                {effectiveCorrelationId && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                          navigator.clipboard.writeText(effectiveCorrelationId)
                        }
                      } catch {}
                    }}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded border border-sand-200 ${typography.code} text-ink-900/80 hover:bg-paper-50`}
                    data-testid="diag-correlation-copy"
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
            {correlationMismatch && (
              <p
                className={`${typography.code} text-sun-700`}
                data-testid="diag-correlation-mismatch"
              >
                Correlation ID in diagnostics ({diagnostics?.correlation_id}) does not match header ({correlationIdHeader}).
              </p>
            )}
          </div>

          <p className={`${typography.code} text-ink-900/60`}>
            For deeper engine instrumentation, use the on-canvas diagnostics overlay via
            <code className="mx-1">?diag=1</code> and the debug tray configuration when needed.
          </p>
        </>
      )}

      {/* Hint to show debug controls */}
      {!showDebug && (
        <p className={`${typography.caption} text-ink-900/50 pt-2 border-t border-sand-200`}>
          Press <kbd className={`px-1.5 py-0.5 bg-sand-100 rounded ${typography.caption} font-mono`}>Shift+D</kbd> for streaming diagnostics
        </p>
      )}
    </div>
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
