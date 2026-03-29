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

import { useCallback, useRef, useMemo } from 'react'
import { usePreAnalysisData } from './hooks/usePreAnalysisData'
import { ModelHealthCard } from './ModelHealthCard'
import { SuccessTarget } from './SuccessTarget'
import { BlockersSection } from './BlockersSection'
import { OptionPreview } from './OptionPreview'
import { DecisionQualityChecks } from './DecisionQualityChecks'
import { GoalBaselineInput } from './GoalBaselineInput'
import { YourExpertise } from './expertise'
import { StickyFooter } from './StickyFooter'
import { focusNodeById, focusEdgeById } from '../../utils/focusHelpers'
import { getObservedState, withObservedStateUpdate } from '../../utils/observedStateHelpers'
import { useCanvasStore } from '../../store'
import { useRetryDraft } from '../../hooks/useRetryDraft'
import { SOFT_BYPASS_STATUSES } from '../../hooks/usePreRunValidation'
import { useShowToast } from '../../ToastContext'
import { copyTextToClipboard } from '../../../utils/clipboard'
import { RefreshCw, Copy, Pencil, AlertTriangle, Check, X } from 'lucide-react'
import { TriageCard } from '@/components/shared/TriageCard'
import type { ScientificEditorProps } from '@/components/shared/ScientificEditor'
import { mapImprovementToTriageCard } from './mapImprovementToTriageCard'
import type { TriageCardItem } from './mapImprovementToTriageCard'
import { buildTriageNarrative } from './utils/buildTriageNarrative'
import { STRUCTURAL_CHECK_IDS } from './DecisionQualityChecks'
import { typography } from '@/styles/typography'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { MissingKnowledgePrompt } from './MissingKnowledgePrompt'
import { hasFeasibilityWarning } from './utils/hasFeasibilityWarning'
import { SectionErrorBoundary } from '../SectionErrorBoundary'
import type { ValidationMetadata, UserAction, ResolvedValue } from '../../domain/validation'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Binary pass/fail row for triage check rows — failed rows show optional action link */
function TriageCheckRow({ label, pass, actionLabel, onAction }: {
  label: string
  pass: boolean
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      {pass
        ? <Check className="w-3.5 h-3.5 text-success flex-shrink-0" aria-hidden="true" />
        : <X className="w-3.5 h-3.5 text-danger flex-shrink-0" aria-hidden="true" />}
      <span className={`${typography.panelBody} ${pass ? 'text-text-body' : 'text-text-light'} flex-1`}>{label}</span>
      {!pass && actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`${typography.panelMeta} text-info hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

/** Labels for structural quality checks shown as triage footer flags */
const STRUCTURAL_FLAG_LABELS: Record<string, string> = {
  no_risks: 'No risks added',
  all_positive_edges: 'No trade-offs',
  no_baseline: 'No status quo',
  no_target: 'No target set',
}

/** Quality check IDs that can serve as science nudges */
const NUDGE_CHECK_IDS = new Set(['same_levers', 'zero_external_factors', 'many_ai_estimates'])

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

  // CEE analysis ready for feasibility + constraints
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)

  // Constraint feasibility warning — from CEE model_critiques (shared helper)
  const hasConstraintFeasibilityWarning = useMemo(
    () => hasFeasibilityWarning(ceeAnalysisReady?.model_critiques),
    [ceeAnalysisReady],
  )


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

  // === CONTESTED EDGE RESOLVE HANDLER (Task 2c) ===
  const handleResolveContestedEdge = useCallback((edgeId: string, action: UserAction, customMean?: number) => {
    const { edges: storeEdges, updateEdge } = useCanvasStore.getState()
    const edge = storeEdges.find(e => e.id === edgeId)
    if (!edge) return
    const edgeData = edge.data as Record<string, unknown>
    const validation = edgeData?.validation as ValidationMetadata | undefined
    if (!validation) return

    let resolvedValue: ResolvedValue | null = null
    const updates: Record<string, unknown> = {
      ...edgeData,
      validation: {
        ...validation,
        user_action: action,
        resolved_by: 'user' as const,
        was_shown: true,
        resolved_value: null as ResolvedValue | null,
      },
    }

    if (action === 'accepted_pass2') {
      resolvedValue = {
        strength_mean: validation.pass2.strength_mean,
        strength_std: validation.pass2.strength_std,
        exists_probability: validation.pass2.exists_probability,
      }
      ;(updates.validation as Record<string, unknown>).resolved_value = resolvedValue
      updates.weight = Math.abs(validation.pass2.strength_mean)
      updates.direction = validation.pass2.strength_mean >= 0 ? 'positive' : 'negative'
    } else if (action === 'overridden' && customMean !== undefined) {
      resolvedValue = { strength_mean: customMean }
      ;(updates.validation as Record<string, unknown>).resolved_value = resolvedValue
      updates.weight = Math.abs(customMean)
      updates.direction = customMean >= 0 ? 'positive' : 'negative'
    } else {
      // accepted_pass1 or dismissed — no value changes
      ;(updates.validation as Record<string, unknown>).resolved_value = null
    }

    updateEdge(edgeId, { data: updates })
  }, [])

  // === SENSITIVITY MAPS (Task 4) ===
  const preAnalysisSensitivity = useCanvasStore(s => s.preAnalysisSensitivity)
  const factorInfluenceMap = useMemo(() => {
    if (!preAnalysisSensitivity?.factor_influence) return undefined
    const entries = Object.entries(preAnalysisSensitivity.factor_influence)
    return entries.length > 0 ? new Map(entries) : undefined
  }, [preAnalysisSensitivity])
  const edgeInfluenceMap = useMemo(() => {
    if (!preAnalysisSensitivity?.edge_influence) return undefined
    const entries = Object.entries(preAnalysisSensitivity.edge_influence)
    return entries.length > 0 ? new Map(entries) : undefined
  }, [preAnalysisSensitivity])

  // Weighted influence reviewed — fraction of total influence covered by user-reviewed factors
  const weightedInfluenceReviewed = useMemo(() => {
    if (!factorInfluenceMap || factorInfluenceMap.size === 0) return undefined
    const reviewedIds = new Set<string>()
    for (const node of nodes) {
      const nd = node.data as Record<string, unknown>
      if (nd.kind !== 'factor' && node.type !== 'factor') continue
      const os = (nd.observedState ?? nd.observed_state) as Record<string, unknown> | undefined
      const source = os?.source as string | undefined
      if (source === 'user_confirmed' || source === 'user_assumption' || source === 'user_override') {
        reviewedIds.add(node.id)
      }
    }
    let reviewedSum = 0
    let totalSum = 0
    for (const [id, influence] of factorInfluenceMap) {
      totalSum += influence
      if (reviewedIds.has(id)) reviewedSum += influence
    }
    return totalSum > 0 ? reviewedSum / totalSum : 0
  }, [factorInfluenceMap, nodes])

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

  // Edge strength quick-select — update edge weight via canonical updateEdgeData (clamps [0,2])
  const handleUpdateEdgeStrength = useCallback((edgeId: string, value: number) => {
    const { updateEdgeData } = useCanvasStore.getState()
    // Write weight through updateEdgeData (clamped). Clear strength_mean so
    // computeSignedMean falls through to weight + direction (the canvas schema path).
    updateEdgeData(edgeId, { weight: value, strength_mean: undefined } as any)
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
        // Handle bias CTA: "Ask AI about this" for bias findings (Task 3d)
        if (action.startsWith('ask_ai_bias_')) {
          const biasId = action.replace('ask_ai_bias_', '')
          const finding = ceeAnalysisReady?.bias_findings?.find(
            (f: { id: string }) => f.id === biasId
          )
          if (finding) {
            onSendMessage?.(`I may have a ${(finding as { type: string }).type} bias in my model: ${(finding as { description: string }).description}. Can you help me think about this differently?`)
          }
        }
        break
    }
  }, [data.goalNode, handleAddRisk, handleAddBaseline, handleAddOption, handleFocusNode, ceeAnalysisReady, onSendMessage])

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

  // Action handlers are passed directly to YourExpertise (v6)

  // Don't show panel if canvas is empty AND not loading
  // When loading, show the "Generating..." placeholder via ModelHealthCard
  if (!data.isLoading &&
      data.nodesByKind.goal.length === 0 &&
      data.nodesByKind.option.length === 0 &&
      data.nodesByKind.factor.length === 0) {
    return null
  }

  // === READINESS SCORE (for adaptive footer CTA) ===
  const completeness = data.ceeQuality
    ? (data.ceeQuality.structure ?? 5) / 10
    : (['goal', 'option', 'factor'] as const).filter(k => data.nodesByKind[k].length > 0).length / 3
  const evidence = data.evidenceQuality.ratio
  const balance = data.balanceScore
  const calibration = data.totalReviewableFactorsCount > 0
    ? data.reviewedFactorsCount / data.totalReviewableFactorsCount
    : 0
  const readinessScore = Math.round(
    (clamp01(completeness) + clamp01(evidence) + clamp01(balance) + clamp01(calibration)) / 4 * 100,
  )

  // === TRIAGE CONTENT ===

  // Map improvement items to TriageCard props (diversified top3 + quickFix)
  // Build editorConfig for factor items that need "Set value" inline editing
  type MappedCard = TriageCardItem & { editorConfig?: ScientificEditorProps | null }
  const mapItem = (item: typeof data.triageActions.top3[number]): MappedCard => {
    const influence = item.focus?.type === 'edge'
      ? edgeInfluenceMap?.get(item.focus.id)
      : factorInfluenceMap?.get(item.focus?.id ?? '')
    const mapped = mapImprovementToTriageCard(item, influence)

    // Attach editorConfig for factor items with set_value action
    const targetId = item.action?.targetId
    if (targetId && item.focus?.type === 'node' && mapped.action?.kind === 'set_value') {
      return {
        ...mapped,
        editorConfig: {
          kind: 'factor' as const,
          rawValue: item.rawValue ?? null,
          cap: item.cap ?? null,
          unit: item.unit ?? null,
          onSave: (rawValue: number) => handleInlineEditValue(targetId, rawValue, item.cap ?? null),
          onCancel: () => {},
        },
      }
    }
    return mapped
  }
  const triageTop3 = data.triageActions.top3.map(mapItem)
  const triageQuickFix = data.triageActions.quickFix.map(mapItem)
  const triageCards = [...triageTop3, ...triageQuickFix]

  // Narrative text: CEE coaching_summary → category-specific fallback
  const triageNarrative = buildTriageNarrative(
    triageCards,
    data.successThreshold != null,
    data.coachingSummary,
    data.isLoading,
  )

  // Science nudges: cognitive/methodological quality checks (max 2)
  const scienceNudges = data.qualityChecks
    .filter(c => NUDGE_CHECK_IDS.has(c.id) || c.category === 'bias')
    .slice(0, 2)

  // Structural flags for triage footer
  const structuralFlags = data.qualityChecks
    .filter(c => STRUCTURAL_CHECK_IDS.has(c.id) && STRUCTURAL_FLAG_LABELS[c.id])
    .map(c => ({ id: c.id, label: STRUCTURAL_FLAG_LABELS[c.id] }))

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="pre-analysis-panel">
      {/* Scrollable content area */}
      <div className="olumi-scrollbar flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4">
        {/* 1. Decision readiness triage panel (v4: ring + checks + action cards + nudges + footer flags) */}
        <SectionErrorBoundary section="Model health">
          <ModelHealthCard
            completeness={completeness}
            evidence={evidence}
            balance={balance}
            calibration={calibration}
            optionCount={data.optionPreviews.length}
            goalLabel={data.goalNode ? ((data.goalNode.data as { label?: string })?.label ?? null) : null}
            coachingSummary={data.coachingSummary}
            isLoading={data.isLoading}
            hasGoalNode={data.nodesByKind.goal.length > 0}
          >
            {/* LAYER 2: Check rows — binary pass/fail with action links */}
            {!data.isLoading && (
              <>
                <div className="h-px bg-panel-border mx-3" />
                <div className="space-y-1 px-3" data-testid="triage-check-rows">
                  <TriageCheckRow
                    label="Goal target set"
                    pass={data.successThreshold != null}
                    actionLabel="Set target"
                    onAction={() => handleFocusNode(data.goalNode?.id ?? '')}
                  />
                  <TriageCheckRow
                    label={data.qualityChecks.some(c => c.id === 'no_baseline') ? 'No baseline set' : 'Status quo identified'}
                    pass={!data.qualityChecks.some(c => c.id === 'no_baseline')}
                    actionLabel="Add baseline"
                    onAction={() => onSendMessage?.('Add a status quo option to compare against')}
                  />
                  <TriageCheckRow
                    label="2+ distinct options"
                    pass={data.optionPreviews.length >= 2}
                    actionLabel="Add option"
                    onAction={() => onSendMessage?.('Add another option to compare')}
                  />
                </div>
              </>
            )}

            {/* LAYER 3: Narrative */}
            {triageNarrative && (
              <>
                <div className="h-px bg-panel-border mx-3" />
                <p className={`${typography.panelMeta} text-text-light px-3`} data-testid="triage-narrative">
                  {triageNarrative}
                </p>
              </>
            )}

            {/* LAYER 4: Top 3 action cards */}
            {triageTop3.length > 0 && (
              <div className="flex flex-col gap-1.5 px-1" data-testid="triage-top-actions">
                <p className={`${typography.panelMeta} text-text-light px-2`}>Ranked by impact on the decision</p>
                {triageTop3.map((card, i) => (
                  <TriageCard
                    key={card.key}
                    cardKey={card.key}
                    ordinal={i + 1}
                    title={card.title}
                    detail={card.detail}
                    subtitle={card.subtitle}
                    category={card.category}
                    influence={card.influence}
                    action={card.action}
                    editorConfig={card.editorConfig ?? null}
                    sourcePill={card.sourcePill}
                    onConfirm={handleConfirm}
                    onEdit={handleSetValueForGap}
                    onSendMessage={onSendMessage}
                    onHoverEnter={handleHoverElement}
                    onHoverLeave={handleHoverClear}
                  />
                ))}
              </div>
            )}

            {/* LAYER 5: Quick-fix rows (items 4-6) */}
            {triageQuickFix.length > 0 && (
              <>
                <div className="h-px bg-panel-border mx-3" />
                <div className="flex flex-col gap-1.5 px-1" data-testid="triage-quick-fix">
                  <p className={`${typography.panelMeta} text-text-light font-semibold px-2`}>Also consider</p>
                  {triageQuickFix.map((card, i) => (
                    <TriageCard
                      key={card.key}
                      cardKey={card.key}
                      ordinal={i + 4}
                      title={card.title}
                      detail={card.detail}
                      category={card.category}
                      influence={card.influence}
                      variant="compact"
                      action={card.action}
                      onConfirm={handleConfirm}
                      onEdit={handleSetValueForGap}
                      onHoverEnter={handleHoverElement}
                      onHoverLeave={handleHoverClear}
                    />
                  ))}
                </div>
              </>
            )}

            {/* LAYER 6: Science nudges (max 2) */}
            {scienceNudges.length > 0 && (
              <>
                <div className="h-px bg-panel-border mx-3" />
                <div className="space-y-1.5 px-3" data-testid="triage-nudges">
                  {scienceNudges.map(nudge => (
                    <div
                      key={nudge.id}
                      className="flex items-start gap-2 px-3 py-2 border border-panel-border rounded-lg hover:bg-panel-hover"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span className={`${typography.panelBody} text-text-body flex-1`}>{nudge.message}</span>
                      <button
                        type="button"
                        onClick={() => onSendMessage?.(`Tell me more about: ${nudge.message}`)}
                        className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer shrink-0`}
                      >
                        Explore
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* LAYER 7: Footer checks — verified count + structural flags + missing link */}
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2 border-t border-panel-border" data-testid="triage-footer-flags">
              <span className={`${typography.panelMeta} text-text-light`}>
                {data.addressedActionableCount}/{data.actionableCount} verified
              </span>
              {structuralFlags.length > 0 && (
                <>
                  <span className="text-panel-border">·</span>
                  {structuralFlags.map(flag => (
                    <span
                      key={flag.id}
                      className={`inline-flex items-center gap-1 ${typography.panelMeta} text-danger`}
                    >
                      <X className="w-2.5 h-2.5" aria-hidden="true" />
                      {flag.label}
                    </span>
                  ))}
                </>
              )}
              <button
                type="button"
                onClick={() => onSendMessage?.('What else should I consider in my model?')}
                className={`${typography.panelMeta} text-info hover:underline cursor-pointer ml-auto`}
              >
                Something missing?
              </button>
            </div>
          </ModelHealthCard>
        </SectionErrorBoundary>

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
          constraintFeasibilityWarning={hasConstraintFeasibilityWarning}
          goalConstraints={ceeAnalysisReady?.goal_constraints}
          onSendMessage={onSendMessage}
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
          <SectionErrorBoundary section="Blockers">
            <BlockersSection
              blockers={data.isReady ? [] : data.enrichedBlockers}
              informationalBlockers={data.informationalBlockers}
              canRetryDraft={canRetryDraft}
              isRetrying={isRetrying}
              lastDraftRetryable={lastDraftError?.retryable}
              onRetryDraft={handleRetryDraft}
              onEditBrief={handleEditBrief}
            />
          </SectionErrorBoundary>
        )}

        {/* 5. Option preview section (Task 3) */}
        {data.optionPreviews.length > 0 && (
          <OptionPreview
            options={data.optionPreviews}
            onFocusNode={handleFocusNode}
            onHoverEnter={handleHoverElement}
            onHoverLeave={handleHoverClear}
            onSendMessage={onSendMessage}
          />
        )}

        {/* Model quality checks */}
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
            assumptionsLedger={data.assumptionsLedger}
          />
        )}

        {/* Your expertise — unified section (v6 wireframe) */}
        <SectionErrorBoundary section="Your expertise">
          <YourExpertise
            improvementsByCategory={data.improvementsByCategory}
            contestedEdges={data.contestedEdges}
            nodes={nodes}
            edges={edges}
            factorInfluenceMap={factorInfluenceMap}
            edgeInfluenceMap={edgeInfluenceMap}
            reviewedCount={data.reviewedFactorsCount}
            allItems={[
              ...(data.improvementsByCategory.verify ?? []),
              ...(data.improvementsByCategory.add_evidence ?? []),
            ]}
            onFocusNode={handleFocusNode}
            onFocusEdge={handleFocusEdgeById}
            onConfirm={handleConfirm}
            onEdit={handleEdit}
            onSetValue={handleSetValueForGap}
            onSendMessage={onSendMessage}
            onResolveEdge={handleResolveContestedEdge}
            onUpdateEdgeStrength={handleUpdateEdgeStrength}
            onAddEvidence={handleAddEvidence}
            onHoverEnter={handleHoverElement}
            onHoverLeave={handleHoverClear}
          />
        </SectionErrorBoundary>

        {/* "What's missing?" prompt */}
        <MissingKnowledgePrompt onSendMessage={onSendMessage} />

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
        reviewedCount={data.addressedActionableCount}
        totalReviewableCount={data.actionableCount}
        evidenceNonAiCount={data.evidenceQuality.nonAiCount}
        evidenceTotalCount={data.evidenceQuality.totalCount}
        weightedInfluenceReviewed={weightedInfluenceReviewed}
        readinessScore={readinessScore}
        hasGoalTarget={data.successThreshold != null}
      />
    </div>
  )
}

export default PreAnalysisPanel
