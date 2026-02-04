/**
 * PreAnalysisPanel - Pre-Analysis Results Tab Right Panel (M1)
 *
 * Main component that replaces existing PreAnalysisReadinessPanel.
 * Section order top → bottom:
 * 1. Header
 * 2. M1 Top Actions (Coach placeholder)
 * 3. All Improvements accordion
 * 4. Model Snapshot accordion
 * 5. Analysis Settings accordion
 * 6. Sticky Footer (pinned)
 *
 * Scrollable content area between header and sticky footer.
 * All data derives from existing graph state — no new backend endpoints.
 */

import { useCallback, useRef, useMemo } from 'react'
import { usePreAnalysisData } from './hooks/usePreAnalysisData'
import { Header } from './Header'
import { M1TopActions } from './M1TopActions'
import { AllImprovements, type ImprovementActionHandlers } from './AllImprovements'
import { ModelSnapshot } from './ModelSnapshot'
import { AnalysisSettings } from './AnalysisSettings'
import { StickyFooter } from './StickyFooter'
import { focusNodeById, focusEdgeById } from '../../utils/focusHelpers'
import { useCanvasStore } from '../../store'

interface PreAnalysisPanelProps {
  /** Callback when user clicks the primary action button */
  onAnalyse: () => void
  /** Whether analysis is currently running */
  isAnalysing?: boolean
}

export function PreAnalysisPanel({
  onAnalyse,
  isAnalysing = false,
}: PreAnalysisPanelProps) {
  // Get all panel data from hook
  const data = usePreAnalysisData()

  // Ref for scrolling to improvements
  const improvementsRef = useRef<HTMLDivElement>(null)

  // Focus handlers - wire to canvas focus helpers
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const setHighlightedEdges = useCanvasStore(s => s.setHighlightedEdges)

  const handleFocusNode = useCallback((nodeId: string) => {
    // Highlight and focus the node on canvas
    setHighlightedNodes([nodeId])
    focusNodeById(nodeId)
    // Clear highlight after 3 seconds
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes])

  const handleFocusEdge = useCallback((type: 'node' | 'edge', id: string) => {
    if (type === 'edge') {
      focusEdgeById(id)
    } else {
      // For nodes, use the node focus handler
      handleFocusNode(id)
    }
  }, [handleFocusNode])

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
    const { updateNode, setGoalThreshold } = useCanvasStore.getState()
    const goalNode = data.goalNode

    // Update goalThreshold for run pipeline (useV2Run reads this)
    setGoalThreshold(value)

    // Also update goal node data for persistence
    if (goalNode) {
      updateNode(goalNode.id, {
        data: {
          ...goalNode.data,
          success_threshold: value,
          threshold_source: value !== null ? 'user' : undefined,
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

    const existingObservedState = (node.data as { observed_state?: Record<string, unknown> })?.observed_state || {}

    updateNode(nodeId, {
      data: {
        ...node.data,
        observed_state: {
          ...existingObservedState,
          source: 'user_confirmed',
        },
      },
    })
  }, [])

  // Assumption action - mark factor source as user_assumption
  const handleAssumption = useCallback((nodeId: string) => {
    const { nodes, updateNode } = useCanvasStore.getState()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const existingObservedState = (node.data as { observed_state?: Record<string, unknown> })?.observed_state || {}

    updateNode(nodeId, {
      data: {
        ...node.data,
        observed_state: {
          ...existingObservedState,
          source: 'user_assumption',
        },
      },
    })
  }, [])

  // Edit action - focus node on canvas for editing
  const handleEdit = useCallback((nodeId: string) => {
    setHighlightedNodes([nodeId])
    focusNodeById(nodeId)
    setTimeout(() => setHighlightedNodes([]), 3000)
  }, [setHighlightedNodes])

  // Add evidence action - store evidence on edge metadata
  const handleAddEvidence = useCallback((edgeId: string, evidence: string) => {
    const { updateEdge } = useCanvasStore.getState()

    updateEdge(edgeId, {
      data: {
        evidence: {
          source: evidence,
          added_at: new Date().toISOString(),
        },
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
      console.info('[PreAnalysisPanel] Baseline already exists, focusing:', existingBaseline.id)
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
      const observedState = (factor.data as { observed_state?: { value?: number } })?.observed_state
      if (observedState?.value != null) {
        interventions[factor.id] = observedState.value
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
        data: { confidence: 0 },
      })
    }

    // Invalidate CEE analysis ready state
    setCeeAnalysisReady(null)

    console.info('[PreAnalysisPanel] Added baseline option:', newNode.id)
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

    console.info('[PreAnalysisPanel] Added option node')
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

    console.info('[PreAnalysisPanel] Added risk node')
  }, [setHighlightedNodes])

  // Memoize action handlers object to prevent unnecessary re-renders
  const actionHandlers: ImprovementActionHandlers = useMemo(() => ({
    onConfirm: handleConfirm,
    onAssumption: handleAssumption,
    onEdit: handleEdit,
    onAddEvidence: handleAddEvidence,
    onAddBaseline: handleAddBaseline,
    onAddOption: handleAddOption,
    onAddRisk: handleAddRisk,
  }), [handleConfirm, handleAssumption, handleEdit, handleAddEvidence, handleAddBaseline, handleAddOption, handleAddRisk])

  // Don't show panel if canvas is empty
  if (data.nodesByKind.goal.length === 0 &&
      data.nodesByKind.option.length === 0 &&
      data.nodesByKind.factor.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" data-testid="pre-analysis-panel">
      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4">
        {/* 1. Inline status line */}
        <Header
          isReady={data.isReady}
          totalImprovements={data.totalImprovements}
          blockerCount={data.blockerCount}
          isLoading={data.isLoading}
        />

        {/* 2. M1 Top Actions (Coach placeholder) */}
        <M1TopActions
          topActions={data.topActions}
          onAddEvidence={handleAddEvidence}
          onHoverEnter={handleHoverElement}
          onHoverLeave={handleHoverClear}
        />

        {/* Divider between top actions and all improvements */}
        {data.topActions.length > 0 && (
          <hr className="border-t border-panel-border" />
        )}

        {/* 3. All Improvements accordion */}
        <div ref={improvementsRef}>
          <AllImprovements
            improvementsByCategory={data.improvementsByCategory}
            totalImprovements={data.totalImprovements}
            onFocus={handleFocusEdge}
            actionHandlers={actionHandlers}
            onHoverEnter={handleHoverElement}
            onHoverLeave={handleHoverClear}
          />
        </div>

        {/* 4. Model Snapshot accordion */}
        <ModelSnapshot
          nodesByKind={data.nodesByKind}
          edgeCount={data.edgeCount}
          onFocusNode={handleFocusNode}
          onHoverNode={handleHoverElement}
          onHoverClear={handleHoverClear}
        />

        {/* 5. Analysis Settings accordion (Goal Node + Success threshold) */}
        <AnalysisSettings
          goalNodes={data.nodesByKind.goal}
          selectedGoalNode={data.goalNode}
          successThreshold={data.successThreshold}
          isThresholdAutoDerived={data.isThresholdAutoDerived}
          onGoalChange={handleGoalChange}
          onThresholdChange={handleThresholdChange}
        />
      </div>

      {/* 6. Sticky Footer (pinned to bottom) */}
      <StickyFooter
        isReady={data.isReady}
        hasBlockers={data.hasBlockers}
        blockerCount={data.blockerCount}
        isAnalysing={isAnalysing}
        onAnalyse={onAnalyse}
        evidenceLevel={data.evidenceQuality.level}
        isLoading={data.isLoading}
      />
    </div>
  )
}

export default PreAnalysisPanel
