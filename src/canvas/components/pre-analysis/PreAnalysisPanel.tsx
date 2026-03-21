/**
 * PreAnalysisPanel - Pre-Analysis Results Tab Right Panel (Phase 2)
 *
 * Three-tier hierarchy structure:
 * 1. Header (with tier counts)
 * 2. Success Target section
 * 3. Must address tier
 * 4. Review assumptions tier
 * 5. Optional improvements tier (collapsed by default)
 * 6. Model Snapshot accordion
 * 7. Analysis Settings accordion
 * 8. Sticky Footer (pinned)
 *
 * Scrollable content area between header and sticky footer.
 * All data derives from existing graph state — no new backend endpoints.
 */

import { useCallback, useRef, useMemo, useState } from 'react'
import { usePreAnalysisData } from './hooks/usePreAnalysisData'
import { Header } from './Header'
import { SuccessTarget } from './SuccessTarget'
import { BlockersSection } from './BlockersSection'
import { OptionPreview } from './OptionPreview'
import { DecisionQualityChecks } from './DecisionQualityChecks'
import { GoalBaselineInput } from './GoalBaselineInput'
import { ModelAdjustments } from './ModelAdjustments'
import { AllImprovements, type ImprovementActionHandlers } from './AllImprovements'
import { ModelSnapshot } from './ModelSnapshot'
import { StickyFooter } from './StickyFooter'
import { focusNodeById, focusEdgeById } from '../../utils/focusHelpers'
import { getObservedState, withObservedStateUpdate } from '../../utils/observedStateHelpers'
import { useCanvasStore } from '../../store'
import { useRetryDraft } from '../../hooks/useRetryDraft'
import { SOFT_BYPASS_STATUSES } from '../../hooks/usePreRunValidation'
import { useShowToast } from '../../ToastContext'
import { copyTextToClipboard } from '../../../utils/clipboard'
import { RefreshCw, Copy, Pencil, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'
import { isPreAnalysisEnrichedEnabled } from '../../../flags'
import { WorthInvestigating, deriveEvidenceGaps } from './WorthInvestigating'
import { EdgeAssumptionsTable } from './EdgeAssumptionsTable'
import { ModelNotes, type ModelNote } from './ModelNotes'
import { formatRepairs } from '../../adapters/modelCardAdapter'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { ModelHealthSection } from '../ModelHealthSection'
import { EdgeSummarySection } from './EdgeSummarySection'
import { KeyRelationships } from './KeyRelationships'
import { MissingKnowledgePrompt } from './MissingKnowledgePrompt'

/** Collapsible pre-mortem section from PLoT m1_review */
function PreMortemSection({ preMortem }: { preMortem: { failure_scenario: string; warning_signs: string[]; mitigation: string } }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-panel-border border-t-[3px] border-t-warning">
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
      >
        <span className={`${typography.panelHeader} text-text-body`}>Pre-mortem</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-light" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-light" />
        )}
      </button>
      {isExpanded && (
        <div className={`px-3 pb-3 space-y-2 ${typography.panelBody} text-text-body`}>
          <div>
            <div className={`${typography.panelHeader} text-text-header mb-1`}>Failure scenario</div>
            <p>{preMortem.failure_scenario}</p>
          </div>
          {preMortem.warning_signs.length > 0 && (
            <div>
              <div className={`${typography.panelHeader} text-text-header mb-1`}>Warning signs</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {preMortem.warning_signs.map((sign, i) => (
                  <li key={i}>{sign}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className={`${typography.panelHeader} text-text-header mb-1`}>Mitigation</div>
            <p>{preMortem.mitigation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

interface PreAnalysisPanelProps {
  /** Callback when user clicks the primary action button */
  onAnalyse: () => void
  /** Whether analysis is currently running */
  isAnalysing?: boolean
  /** Shared blocked reason for the Analyse CTA */
  blockedReason?: string
  /** Callback to send a message in the conversation panel */
  onSendMessage?: (text: string) => void
}

export function PreAnalysisPanel({
  onAnalyse,
  isAnalysing = false,
  blockedReason,
  onSendMessage,
}: PreAnalysisPanelProps) {
  // Get all panel data from hook (includes derived progress counts)
  const data = usePreAnalysisData()

  // Task P.3.2: Get node and edge counts for minimal graph coaching
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const isMinimalGraph = (nodes?.length ?? 0) < 3 || (edges?.length ?? 0) < 2

  // Retry draft hook — for re-running CEE when blocked due to LLM omission
  const { retryDraft, canRetry, isRetrying } = useRetryDraft()
  const showToast = useShowToast()

  // Detect retry-eligible state: blocked + CEE status indicates LLM omission
  const ceeStatus = useCanvasStore(s => s.ceeAnalysisReady?.status)
  const canRetryDraft = canRetry && !data.isReady && !!ceeStatus && SOFT_BYPASS_STATUSES.has(ceeStatus)

  // Draft error state for error card
  const lastDraftError = useCanvasStore(s => s.lastDraftError)

  // Phase 2B: Evidence gaps + model notes (enriched pre-analysis)
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const resultsReport = useCanvasStore(s => s.results?.report)
  const evidenceGaps = useMemo(() => {
    if (!isPreAnalysisEnrichedEnabled()) return []
    // Build VoI map from post-analysis report when available
    const voiMap = new Map<string, number>()
    if (resultsReport) {
      const sensitivityFactors: Array<Record<string, unknown>> =
        (resultsReport as any)?.enrichment?.sensitivity_analysis?.factors ??
        (resultsReport as any)?.factor_sensitivity ?? []
      for (const f of sensitivityFactors) {
        const id = (f.factor_id ?? f.factorId ?? f.node_id ?? f.nodeId) as string | undefined
        const voi = (f.value_of_information ?? f.valueOfInformation) as number | undefined
        if (id && typeof voi === 'number' && voi > 0) voiMap.set(id, voi)
      }
    }
    return deriveEvidenceGaps(nodes, edges, voiMap.size > 0 ? voiMap : undefined)
  }, [nodes, edges, resultsReport])
  const modelNotes = useMemo<ModelNote[]>(() => {
    if (!isPreAnalysisEnrichedEnabled()) return []
    const critiques = (ceeAnalysisReady as any)?.model_critiques as Array<{ message: string; severity?: string; suggested_action?: string }> | undefined
    if (!critiques || critiques.length === 0) return []
    return critiques.map(c => ({
      message: c.message,
      severity: (c.severity === 'warning' ? 'warning' : 'info') as 'warning' | 'info',
      suggestedAction: c.suggested_action,
    }))
  }, [ceeAnalysisReady])

  // Phase 2B: Post-run repairs from store (populated in resultsComplete)
  const repairsApplied = useCanvasStore(s => s.repairsApplied)
  const postRunRepairs = useMemo(
    () => isPreAnalysisEnrichedEnabled() && repairsApplied ? formatRepairs(repairsApplied, nodes) : [],
    [repairsApplied, nodes],
  )

  // Phase 2B: Intervention coverage for ModelSnapshot enrichment
  const interventionCoverage = useMemo(() => {
    if (!isPreAnalysisEnrichedEnabled() || data.optionPreviews.length === 0) return null
    const mapped = data.optionPreviews.filter(op => op.interventions.length > 0).length
    return { mapped, total: data.optionPreviews.length }
  }, [data.optionPreviews])

  // Phase 2B: One-click fix — "Set value" opens the inspector for a factor (non-destructive)
  const selectNodeWithoutHistory = useCanvasStore(s => s.selectNodeWithoutHistory)
  const selectEdgeWithoutHistory = useCanvasStore(s => s.selectEdgeWithoutHistory)
  const handleSetValueForGap = useCallback((factorId: string) => {
    // Note: FIX_CLICKED is also fired in GapRow.handleClick; PreAnalysisPanel is the
    // logical orchestrator so we skip double-firing here.
    // Select the factor node to open inspector — non-destructive, no undo needed
    selectNodeWithoutHistory(factorId)
    focusNodeById(factorId)
  }, [selectNodeWithoutHistory])

  const handleAskAI = useCallback((factorId: string, factorLabel: string) => {
    onSendMessage?.(`Can you research ${factorLabel} and suggest a reasonable estimate with sources?`)
  }, [onSendMessage])

  // Retry handler with toast feedback
  const handleRetryDraft = useCallback(async () => {
    const result = await retryDraft()
    if (result.success) {
      showToast('Draft refreshed — check readiness', 'success')
    } else {
      showToast(result.error || 'Draft retry failed', 'error')
    }
  }, [retryDraft, showToast])

  // Edit brief handler — opens DraftChat for re-phrasing
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const handleEditBrief = useCallback(() => {
    setShowDraftChat(true)
  }, [setShowDraftChat])

  // Ref for scrolling to improvements
  const improvementsRef = useRef<HTMLDivElement>(null)

  // Focus handlers - wire to canvas focus helpers
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const setHighlightedEdges = useCanvasStore(s => s.setHighlightedEdges)

  const handleFocusNode = useCallback((nodeId: string) => {
    selectNodeWithoutHistory(nodeId)
    setHighlightedNodes([nodeId])
    focusNodeById(nodeId)
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes, selectNodeWithoutHistory])

  const handleFocusEdge = useCallback((type: 'node' | 'edge', id: string) => {
    if (type === 'edge') {
      selectEdgeWithoutHistory(id)  // opens edge inspector
      setHighlightedEdges([id])
      focusEdgeById(id)
      setTimeout(() => setHighlightedEdges([]), 3000)
    } else {
      // For nodes, use the node focus handler
      handleFocusNode(id)
    }
  }, [handleFocusNode, selectEdgeWithoutHistory, setHighlightedEdges])

  // Hover handlers - highlight graph elements on panel item hover
  const handleHoverElement = useCallback((type: 'node' | 'edge', id: string) => {
    if (type === 'node') {
      setHighlightedNodes([id])
      setHighlightedEdges([])
    } else {
      setHighlightedEdges([id])
      setHighlightedNodes([])
    }
  }, [setHighlightedNodes, setHighlightedEdges])

  const handleHoverClear = useCallback(() => {
    setHighlightedNodes([])
    setHighlightedEdges([])
  }, [setHighlightedNodes, setHighlightedEdges])

  // Goal change handler - update both ceeAnalysisReady AND outcomeNodeId for run pipeline
  const handleGoalChange = useCallback((goalId: string) => {
    const { ceeAnalysisReady, setCeeAnalysisReady, setOutcomeNode } = useCanvasStore.getState()

    // Update outcomeNodeId for run pipeline (useV2Run reads this)
    setOutcomeNode(goalId)

    // Update ceeAnalysisReady for pre-analysis data
    if (ceeAnalysisReady) {
      setCeeAnalysisReady({ ...ceeAnalysisReady, goal_node_id: goalId })
    } else {
      // Create minimal ceeAnalysisReady with the selected goal
      // options: [] is required by type - run pipeline uses outcomeNodeId anyway
      setCeeAnalysisReady({
        status: undefined,
        goal_node_id: goalId,
        options: [],
      })
    }
  }, [])

  // Threshold change handler - update both goal node data AND goalThreshold store field
  const handleThresholdChange = useCallback((value: number | null) => {
    const { setGoalThresholdAndUpdateNode, setGoalThreshold } = useCanvasStore.getState()
    const goalNode = data.goalNode
    if (goalNode) {
      setGoalThresholdAndUpdateNode(goalNode.id, value)
    } else {
      setGoalThreshold(value)
    }
  }, [data.goalNode])

  // Threshold confirm handler - mark threshold as confirmed in goal node
  const handleThresholdConfirm = useCallback(() => {
    const { updateNode } = useCanvasStore.getState()
    const goalNode = data.goalNode

    if (goalNode) {
      updateNode(goalNode.id, {
        data: {
          ...goalNode.data,
          threshold_confirmed: true,
        },
      })
    }
  }, [data.goalNode])

  // Threshold edit handler - clear confirmed status
  const handleThresholdEdit = useCallback(() => {
    const { updateNode } = useCanvasStore.getState()
    const goalNode = data.goalNode

    if (goalNode) {
      updateNode(goalNode.id, {
        data: {
          ...goalNode.data,
          threshold_confirmed: false,
        },
      })
    }
  }, [data.goalNode])

  // === INTERACTIVE ACTION HANDLERS ===

  // Confirm action - mark factor source as user_confirmed
  const handleConfirm = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, { source: 'user_confirmed' }),
    })
  }, [])

  // Assumption action - mark factor source as user_assumption
  const handleAssumption = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, { source: 'user_assumption' }),
    })
  }, [])

  // Edit action - focus node on canvas for editing
  const handleEdit = useCallback((nodeId: string) => {
    setHighlightedNodes([nodeId])
    focusNodeById(nodeId)
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes])

  // Reset source action - revert factor source back to AI for re-review
  const handleResetSource = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    // Reset to AI source so item reappears in verify list
    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, { source: 'ai' }),
    })
  }, [])

  // Inline value edit — update factor observed state with user-provided raw value
  const handleInlineEditValue = useCallback((nodeId: string, rawValue: number, cap: number | null) => {
    const { nodes, updateNode, setCeeAnalysisReady } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const normalised = cap != null && cap > 0 ? rawValue / cap : rawValue
    updateNode(nodeId, {
      data: withObservedStateUpdate(node.data, {
        raw_value: rawValue,
        value: normalised,
        source: 'user_override',
      }),
    })
    setCeeAnalysisReady(null)
  }, [])

  // Edge strength quick-select — update edge weight from qualitative selection
  const handleUpdateEdgeStrength = useCallback((edgeId: string, value: number) => {
    const { updateEdge, edges } = useCanvasStore.getState()
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return
    // Clear strength_mean so computeSignedMean falls through to weight + direction
    const data = { ...(edge.data ?? {}), weight: value, strength_mean: undefined }
    updateEdge(edgeId, { data })
  }, [])

  // Focus edge for KeyRelationships (simplified — always edge type)
  const handleFocusEdgeById = useCallback((edgeId: string) => {
    selectEdgeWithoutHistory(edgeId)
    setHighlightedEdges([edgeId])
    focusEdgeById(edgeId)
    setTimeout(() => setHighlightedEdges([]), 3000)
  }, [selectEdgeWithoutHistory, setHighlightedEdges])

  // Add evidence action - store evidence on edge metadata
  const handleAddEvidence = useCallback((edgeId: string, evidence: string) => {
    const { updateEdgeData } = useCanvasStore.getState()

    updateEdgeData(edgeId, {
      evidence: {
        source: evidence,
        added_at: new Date().toISOString(),
      },
    })
  }, [])

  // Add baseline action - create a new baseline option node
  const handleAddBaseline = useCallback(() => {
    const { nodes, addNode, updateNode, addEdge, setCeeAnalysisReady } = useCanvasStore.getState()

    // Guard: Check if baseline option already exists
    const existingBaseline = nodes.find(
      n => n.type === 'option' &&
           (n.data as { is_baseline?: boolean })?.is_baseline === true
    )
    if (existingBaseline) {
      // Focus existing baseline instead of creating duplicate
      setHighlightedNodes([existingBaseline.id])
      focusNodeById(existingBaseline.id)
      setTimeout(() => setHighlightedNodes([]), 3000)
      console.warn('[PreAnalysisPanel] Baseline already exists, focusing:', existingBaseline.id)
      return
    }

    // Find decision node for connection
    const decisionNode = nodes.find(n => n.type === 'decision')
    const anchorNode = decisionNode || nodes[0]

    if (!anchorNode) {
      console.warn('[PreAnalysisPanel] Cannot add baseline: no nodes to connect to')
      return
    }

    // Calculate position near anchor
    const newPosition = {
      x: (anchorNode.position?.x || 200) + 200,
      y: (anchorNode.position?.y || 200) + 50,
    }

    // Create new option node
    addNode(newPosition, 'option')

    // Get the newly created node
    const newNodes = useCanvasStore.getState().nodes
    const newNode = newNodes[newNodes.length - 1]
    if (!newNode) return

    // Collect current observed state values for interventions
    const factorNodes = nodes.filter(n => n.type === 'factor')
    const interventions: Record<string, number> = {}
    for (const factor of factorNodes) {
      const os = getObservedState(factor.data)
      if (os.value != null) {
        interventions[factor.id] = os.value
      }
    }

    // Update node with baseline properties
    updateNode(newNode.id, {
      data: {
        ...newNode.data,
        label: 'Status Quo',
        kind: 'option',
        is_baseline: true,
        interventions,
        status: 'ready',
      },
    })

    // Connect to decision node if available
    if (decisionNode) {
      addEdge({
        source: decisionNode.id,
        target: newNode.id,
        type: 'default',
        data: { ...DEFAULT_EDGE_DATA, confidence: 0 },
      })
    }

    // Invalidate CEE analysis ready state
    setCeeAnalysisReady(null)

    console.warn('[PreAnalysisPanel] Added baseline option:', newNode.id)
  }, [setHighlightedNodes])

  // Add option action - create a new option node
  const handleAddOption = useCallback(() => {
    const { nodes, addNode, setCeeAnalysisReady } = useCanvasStore.getState()

    // Find decision node for positioning
    const decisionNode = nodes.find(n => n.type === 'decision')
    const anchorNode = decisionNode || nodes[0]

    // Calculate position near anchor
    const newPosition = {
      x: (anchorNode?.position?.x || 200) + 200,
      y: (anchorNode?.position?.y || 200) + 100,
    }

    // Create new option node
    addNode(newPosition, 'option')

    // Invalidate CEE analysis ready state
    setCeeAnalysisReady(null)

    // Focus the new node
    const newNodes = useCanvasStore.getState().nodes
    const newNode = newNodes[newNodes.length - 1]
    if (newNode) {
      setHighlightedNodes([newNode.id])
      focusNodeById(newNode.id)
      setTimeout(() => setHighlightedNodes([]), 3000)
    }

    console.warn('[PreAnalysisPanel] Added option node')
  }, [setHighlightedNodes])

  // Add risk action - create a new risk node
  const handleAddRisk = useCallback(() => {
    const { nodes, addNode, setCeeAnalysisReady } = useCanvasStore.getState()

    // Find goal or decision node for positioning
    const goalNode = nodes.find(n => n.type === 'goal')
    const anchorNode = goalNode || nodes[0]

    // Calculate position near anchor
    const newPosition = {
      x: (anchorNode?.position?.x || 200) + 200,
      y: (anchorNode?.position?.y || 200) + 100,
    }

    // Create new risk node
    addNode(newPosition, 'risk')

    // Invalidate CEE analysis ready state
    setCeeAnalysisReady(null)

    // Focus the new node
    const newNodes = useCanvasStore.getState().nodes
    const newNode = newNodes[newNodes.length - 1]
    if (newNode) {
      setHighlightedNodes([newNode.id])
      focusNodeById(newNode.id)
      setTimeout(() => setHighlightedNodes([]), 3000)
    }

    console.warn('[PreAnalysisPanel] Added risk node')
  }, [setHighlightedNodes])


  // Direct add from quality checks — creates a labelled node inline
  const handleDirectAdd = useCallback((kind: 'risk' | 'factor', label: string) => {
    const { nodes, addNode, updateNode, setCeeAnalysisReady } = useCanvasStore.getState()
    const goalNode = nodes.find(n => n.type === 'goal')
    const anchorNode = goalNode || nodes[0]
    const pos = {
      x: (anchorNode?.position?.x || 200) + 200 + Math.random() * 50,
      y: (anchorNode?.position?.y || 200) + 100 + Math.random() * 50,
    }

    const nodeType = kind === 'risk' ? 'risk' : 'factor'
    addNode(pos, nodeType)

    const newNode = useCanvasStore.getState().nodes[useCanvasStore.getState().nodes.length - 1]
    if (newNode) {
      const dataUpdate: Record<string, unknown> = { label, kind: nodeType }
      if (kind === 'factor') {
        dataUpdate.category = 'external'
      }
      updateNode(newNode.id, { data: { ...newNode.data, ...dataUpdate } })
      setHighlightedNodes([newNode.id])
      focusNodeById(newNode.id)
      setTimeout(() => setHighlightedNodes([]), 3000)
    }

    setCeeAnalysisReady(null)
  }, [setHighlightedNodes])

  // Quality check CTA handler — routes action strings to existing handlers
  const handleQualityCheckAction = useCallback((action: string) => {
    switch (action) {
      case 'add_risk':
        handleAddRisk()
        break
      case 'add_baseline':
        handleAddBaseline()
        break
      case 'add_option':
        handleAddOption()
        break
      case 'review_structure':
      case 'review_options':
        // Scroll to improvements section
        improvementsRef.current?.scrollIntoView({ behavior: 'smooth' })
        break
      case 'review_assumptions':
        improvementsRef.current?.scrollIntoView({ behavior: 'smooth' })
        break
      case 'set_target':
        // Focus on success target — scroll to top of panel
        break
      case 'set_goal_baseline':
        // Focus goal node on canvas for baseline editing
        if (data.goalNode) {
          handleFocusNode(data.goalNode.id)
        }
        break
      default:
        break
    }
  }, [data.goalNode, handleAddRisk, handleAddBaseline, handleAddOption, handleFocusNode])

  // Goal baseline inline input handlers
  const handleBaselineConfirm = useCallback((value: number) => {
    const { updateNode, setCeeAnalysisReady } = useCanvasStore.getState()
    const goalNode = data.goalNode
    if (!goalNode) return

    // Write value to goal node's observedState.value
    const updatedData = withObservedStateUpdate(goalNode.data, { value })
    updateNode(goalNode.id, { data: updatedData })

    // Invalidate analysis cache — baseline change affects run inputs
    setCeeAnalysisReady(null)
  }, [data.goalNode])

  const handleBaselineClear = useCallback(() => {
    const { updateNode, setCeeAnalysisReady } = useCanvasStore.getState()
    const goalNode = data.goalNode
    if (!goalNode) return

    // Clear value from goal node's observedState by spreading without value
    const existing = getObservedState(goalNode.data)
    const { value: _removed, ...rest } = existing
    const nodeData = goalNode.data as Record<string, unknown>
    updateNode(goalNode.id, {
      data: {
        ...nodeData,
        observedState: rest,
        observed_state: rest,
      },
    })

    // Invalidate analysis cache — baseline change affects run inputs
    setCeeAnalysisReady(null)
  }, [data.goalNode])

  const handleBaselineInputOpen = useCallback(() => {
    if (data.goalNode) {
      setHighlightedNodes([data.goalNode.id])
      focusNodeById(data.goalNode.id)
    }
  }, [data.goalNode, setHighlightedNodes])

  const handleBaselineInputClose = useCallback(() => {
    setHighlightedNodes([])
  }, [setHighlightedNodes])

  // Derive goal baseline value from observedState
  const goalBaselineValue = useMemo(() => {
    if (!data.goalNode) return null
    const os = getObservedState(data.goalNode.data)
    return typeof os.value === 'number' ? os.value : null
  }, [data.goalNode])

  const goalLabel = useMemo(() => {
    if (!data.goalNode) return 'Goal'
    return (data.goalNode.data as { label?: string })?.label ?? data.goalNode.id
  }, [data.goalNode])

  const goalUnit = useMemo(() => {
    if (!data.goalNode) return null
    return (data.goalNode.data as { goal_threshold_unit?: string })?.goal_threshold_unit ?? null
  }, [data.goalNode])

  // Memoize action handlers object to prevent unnecessary re-renders
  const actionHandlers: ImprovementActionHandlers = useMemo(() => ({
    onConfirm: handleConfirm,
    onAssumption: handleAssumption,
    onEdit: handleEdit,
    onAddEvidence: handleAddEvidence,
    onAddBaseline: handleAddBaseline,
    onAddOption: handleAddOption,
    onAddRisk: handleAddRisk,
    onResetSource: handleResetSource,
    onInlineEditValue: handleInlineEditValue,
  }), [handleConfirm, handleAssumption, handleEdit, handleAddEvidence, handleAddBaseline, handleAddOption, handleAddRisk, handleResetSource, handleInlineEditValue])

  // Don't show panel if canvas is empty
  if (data.nodesByKind.goal.length === 0 &&
      data.nodesByKind.option.length === 0 &&
      data.nodesByKind.factor.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="pre-analysis-panel">
      {/* Model health — persistent structural checks (Brief 5 Task 5) */}
      <ModelHealthSection />

      {/* Scrollable content area */}
      <div className="olumi-scrollbar flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4">
        {/* 1. Header with tier counts */}
        <Header
          isReady={data.isReady}
          isLoading={data.isLoading}
          mustAddressCount={data.tiers.mustAddress.count}
          reviewCount={data.tiers.reviewAssumptions.count}
          optionalCount={data.tiers.optional.count}
        />

        {/* Coaching summary — one-line text below header */}
        {data.coachingSummary && (
          <p className={`${typography.panelBody} text-text-light -mt-2 line-clamp-1`} title={data.coachingSummary}>{data.coachingSummary}</p>
        )}

        {/* Task P.3.2: Minimal graph coaching (pre-run guidance, not blocker) */}
        {isMinimalGraph && (
          <div
            className="flex items-start gap-2 px-3 py-2.5 bg-panel border border-info/30 rounded-md"
            role="status"
            data-testid="minimal-graph-coaching"
          >
            <AlertTriangle className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className={`${typography.panelBody} text-info`}>
              Your model needs more detail for a meaningful analysis. Try adding factors that influence your outcome.
            </p>
          </div>
        )}

        {/* 2. Success Target / Hero inputs section */}
        <SuccessTarget
          goalNode={data.goalNode}
          goalNodes={data.nodesByKind.goal}
          successThreshold={data.successThreshold}
          isThresholdAutoDerived={data.isThresholdAutoDerived}
          isThresholdConfirmed={data.isThresholdConfirmed}
          thresholdProvenance={data.thresholdProvenance}
          onThresholdChange={handleThresholdChange}
          onThresholdConfirm={handleThresholdConfirm}
          onThresholdEdit={handleThresholdEdit}
          onGoalChange={handleGoalChange}
          goalThresholdRaw={data.goalThresholdRaw}
          goalThresholdUnit={data.goalThresholdUnit}
          thresholdSourceBadge={data.thresholdSourceBadge}
          onFocusNode={handleFocusNode}
          onHoverEnter={(id) => handleHoverElement('node', id)}
          onHoverLeave={handleHoverClear}
        />

        {/* Draft error card */}
        {lastDraftError && (
          <div
            className="rounded-md bg-panel border border-panel-border border-t-[3px] border-t-danger px-3 py-2.5"
            data-testid="draft-error-card"
          >
            <p className={`${typography.panelHeader} text-danger`}>Draft failed</p>
            <p className={`${typography.panelBody} text-text-body mt-0.5`}>{lastDraftError.message}</p>
            {lastDraftError.correlationId && (
              <p className={`${typography.panelMeta} text-text-light mt-0.5 font-mono`}>
                ID: {lastDraftError.correlationId}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {lastDraftError.retryable === false ? (
                <button
                  type="button"
                  onClick={handleEditBrief}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success transition-colors`}
                  data-testid="draft-error-edit-brief"
                >
                  <Pencil size={12} />
                  Edit brief
                </button>
              ) : canRetryDraft ? (
                <button
                  type="button"
                  onClick={handleRetryDraft}
                  disabled={isRetrying}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-info bg-transparent border border-info/40 rounded-full hover:border-success/40 hover:text-success disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  data-testid="draft-error-retry"
                >
                  <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                  {isRetrying ? 'Retrying…' : 'Retry Draft'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const diagnostics = {
                    message: lastDraftError.message,
                    status: lastDraftError.status,
                    correlationId: lastDraftError.correlationId,
                    timestamp: new Date(lastDraftError.timestamp).toISOString(),
                  }
                  copyTextToClipboard(JSON.stringify(diagnostics, null, 2))
                  showToast('Diagnostics copied', 'success')
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-text-light bg-panel border border-panel-border rounded-full hover:bg-panel-hover transition-colors`}
              >
                <Copy size={12} />
                Copy diagnostics
              </button>
            </div>
            {lastDraftError.retryable === false && (
              <div className="mt-2 rounded-md bg-panel border border-panel-border px-2.5 py-2">
                <p className={`${typography.panelMeta} text-text-body mb-1`}>Tips for a clearer brief</p>
                <ul className={`${typography.panelMeta} text-text-light space-y-0.5 list-disc pl-3.5`}>
                  <li>State one clear goal</li>
                  <li>List 2–3 options you're considering</li>
                  <li>Mention key factors that matter to your decision</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Blockers section — structured cards from usePreRunValidation */}
        {/* Show when: blocking items exist (not ready), OR informational items exist (notes) */}
        {((!data.isReady && data.enrichedBlockers.length > 0) || data.informationalBlockers.length > 0) && (
          <BlockersSection
            blockers={data.isReady ? [] : data.enrichedBlockers}
            informationalBlockers={data.informationalBlockers}
            canRetryDraft={canRetryDraft}
            isRetrying={isRetrying}
            lastDraftRetryable={lastDraftError?.retryable}
            onRetryDraft={handleRetryDraft}
            onEditBrief={handleEditBrief}
          />
        )}

        {/* 5. Option preview section (Task 3) */}
        {data.optionPreviews.length > 0 && (
          <OptionPreview
            options={data.optionPreviews}
            onFocusNode={handleFocusNode}
            onHoverEnter={handleHoverElement}
            onHoverLeave={handleHoverClear}
          />
        )}

        {/* 6. Decision quality checks (Task 4) — with inline goal baseline input */}
        {(data.qualityChecks.length > 0 || data.goalNode) && (
          <DecisionQualityChecks
            checks={data.qualityChecks}
            onAction={handleQualityCheckAction}
            onDirectAdd={handleDirectAdd}
            totalCheckCount={data.qualityChecks.length}
            goalBaselineSlot={
              data.goalNode ? (
                <GoalBaselineInput
                  currentValue={goalBaselineValue}
                  goalLabel={goalLabel}
                  unit={goalUnit}
                  hasGoalNode={!!data.goalNode}
                  onConfirm={handleBaselineConfirm}
                  onClear={handleBaselineClear}
                  onInputOpen={handleBaselineInputOpen}
                  onInputClose={handleBaselineInputClose}
                />
              ) : undefined
            }
          />
        )}

        {/* 3-5. Three-tier improvement sections */}
        <div ref={improvementsRef}>
          <AllImprovements
            improvementsByCategory={data.improvementsByCategory}
            tiers={data.tiers}
            totalImprovements={data.totalImprovements}
            onFocus={handleFocusEdge}
            actionHandlers={actionHandlers}
            onHoverEnter={handleHoverElement}
            onHoverLeave={handleHoverClear}
            reviewedCount={data.reviewedFactorsCount}
            totalReviewableCount={data.totalReviewableFactorsCount}
          />
          <KeyRelationships
            edges={edges}
            nodes={nodes}
            onFocusEdge={handleFocusEdgeById}
            onHoverEnter={handleHoverElement}
            onHoverLeave={handleHoverClear}
            onUpdateEdgeStrength={handleUpdateEdgeStrength}
          />
        </div>

        {/* "What's missing?" prompt */}
        <MissingKnowledgePrompt onSendMessage={onSendMessage} />

        {/* Strength warning (Pattern C, Task 8) — between assumptions and draft notes */}
        {data.hasDefaultStrengths && (
          <div
            className="rounded-md bg-panel border border-panel-border border-t-[3px] border-t-warning px-3 py-2.5"
            data-testid="strength-warning-card"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-warning" />
              <div className="flex-1 min-w-0">
                <p className={`${typography.panelHeader} text-warning`}>
                  Relationship strengths are estimated
                </p>
                <p className={`${typography.panelBody} text-text-body mt-0.5`}>
                  {data.defaultStrengthPercent}% of edges use default strength values. Results may be less precise.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={onAnalyse}
                    className={`${typography.panelMeta} text-info border border-info/40 rounded-full px-2.5 py-0.5 bg-transparent hover:border-success/40 hover:text-success cursor-pointer`}
                  >
                    Run with estimates
                  </button>
                  <button
                    type="button"
                    onClick={() => improvementsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className={`${typography.panelMeta} text-info border border-info/40 rounded-full px-2.5 py-0.5 bg-transparent hover:border-success/40 hover:text-success cursor-pointer`}
                  >
                    Review in structure
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2B: Worth investigating — evidence gaps */}
        {isPreAnalysisEnrichedEnabled() && (
          <WorthInvestigating
            gaps={evidenceGaps}
            onSetValue={handleSetValueForGap}
            onAskAI={handleAskAI}
          />
        )}

        {/* Phase 2B: Model notes — pipeline critiques */}
        {isPreAnalysisEnrichedEnabled() && (
          <ModelNotes notes={modelNotes} />
        )}

        {/* Model adjustments — transparency for CEE automatic fixes */}
        {(data.modelAdjustments.length > 0 || data.repairActions.length > 0 || postRunRepairs.length > 0) && (
          <ModelAdjustments
            adjustments={data.modelAdjustments}
            repairActions={data.repairActions}
            postRunRepairs={postRunRepairs}
          />
        )}

        {/* Pre-mortem section (collapsible, from PLoT m1_review) */}
        {data.preMortem && (
          <PreMortemSection preMortem={data.preMortem} />
        )}

        {/* Graph Editing Experience Task 9d: Edge summary section */}
        <EdgeSummarySection
          onSelectEdge={(edgeId) => handleFocusEdge('edge', edgeId)}
          onFocusNode={(nodeId) => handleFocusNode(nodeId)}
        />

        {/* Edge assumptions table — collapsible, hidden when 0 causal edges */}
        <EdgeAssumptionsTable
          edges={edges}
          nodes={nodes}
          onSelectEdge={(edgeId) => handleFocusEdge('edge', edgeId)}
        />

        {/* 6. Model Snapshot accordion */}
        <ModelSnapshot
          nodesByKind={data.nodesByKind}
          edgeCount={data.edgeCount}
          onFocusNode={handleFocusNode}
          onHoverNode={handleHoverElement}
          onHoverClear={handleHoverClear}
          ceeQuality={data.ceeQuality}
          interventionCoverage={isPreAnalysisEnrichedEnabled() ? interventionCoverage : null}
          goalLabel={isPreAnalysisEnrichedEnabled() ? (data.goalNode?.data as { label?: string })?.label ?? null : null}
          goalMeasurable={isPreAnalysisEnrichedEnabled() ? (data.successThreshold != null) : undefined}
        />

        {/* Goal selector now lives in SuccessTarget hero — AnalysisSettings removed */}
      </div>

      {/* 8. Sticky Footer (pinned to bottom) */}
      <StickyFooter
        isReady={data.isReady}
        hasBlockers={data.hasBlockers}
        blockerCount={data.blockerCount}
        isAnalysing={isAnalysing}
        onAnalyse={onAnalyse}
        blockedReason={blockedReason}
        isLoading={data.isLoading}
        isRetrying={isRetrying}
        reviewedCount={data.reviewedFactorsCount}
        totalReviewableCount={data.totalReviewableFactorsCount}
        evidenceNonAiCount={data.evidenceQuality.nonAiCount}
        evidenceTotalCount={data.evidenceQuality.totalCount}
      />
    </div>
  )
}

export default PreAnalysisPanel
