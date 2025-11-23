import { useCallback, useEffect, useState, useMemo, useRef, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, MiniMap, Background, BackgroundVariant, type Connection, type NodeChange, type EdgeChange, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore, hasValidationErrors } from './store'
import { DEFAULT_EDGE_DATA } from './domain/edges'
import { parseRunHash } from './utils/shareLink'
import { nodeTypes } from './nodes/registry'
import { StyledEdge } from './edges/StyledEdge'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { loadState, saveState } from './persist'
import { ContextMenu } from './ContextMenu'
import { CanvasToolbar } from './CanvasToolbar'
import { AlignmentGuides } from './components/AlignmentGuides'
import { PropertiesPanel } from './components/PropertiesPanel'
import { CommandPalette } from './components/CommandPalette'
import { ReconnectBanner } from './components/ReconnectBanner'
import { KeyboardLegend, useKeyboardLegend } from './help/KeyboardLegend'
import { HelpMenu } from './help/HelpMenu'
import { SettingsPanel } from './components/SettingsPanel'
import { useSettingsStore } from './settingsStore'
import { CanvasErrorBoundary } from './ErrorBoundary'
import { ToastProvider, useToast } from './ToastContext'
import { DiagnosticsOverlay } from './DiagnosticsOverlay'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ValidationChip } from './components/ValidationChip'
import { LayerProvider } from './components/LayerProvider'
import { RecoveryBanner } from './components/RecoveryBanner'
import { OnboardingOverlay } from './onboarding/OnboardingOverlay'
import { useOnboarding } from './onboarding/useOnboarding'
import { useCanvasKeyboardShortcuts } from './hooks/useCanvasKeyboardShortcuts'
import { useAutosave } from './hooks/useAutosave'
import type { Blueprint } from '../templates/blueprints/types'
import { blueprintToGraph } from '../templates/mapper/blueprintToGraph'
import { InfluenceExplainer, useInfluenceExplainer } from '../components/assistants/InfluenceExplainer'
import { DraftChat } from './components/DraftChat'
import { CanvasEmptyState } from './components/CanvasEmptyState'
// N5: Code-split heavy panels with named chunks
const InspectorPanel = lazy(() => import(/* webpackChunkName: "inspector-panel" */ './panels/InspectorPanel').then(m => ({ default: m.InspectorPanel })))
import { useResultsRun } from './hooks/useResultsRun'
import { useRunDiagnosticsToast } from './hooks/useRunDiagnosticsToast'
import { HighlightLayer } from './highlight/HighlightLayer'
import { registerFocusHelpers, unregisterFocusHelpers } from './utils/focusHelpers'
import { loadRuns } from './store/runHistory'
import { useEdgeLabelModeSync } from './store/edgeLabelMode'
import { HealthStatusBar } from './components/HealthStatusBar'
import { DegradedBanner } from './components/DegradedBanner'
import { LayoutProgressBanner } from './components/LayoutProgressBanner'
import { ContextBar } from './components/ContextBar'
const IssuesPanel = lazy(() => import(/* webpackChunkName: "issues-panel" */ './panels/IssuesPanel').then(m => ({ default: m.IssuesPanel })))
import { NeedleMoversOverlay } from './components/NeedleMoversOverlay'
import { DocumentsManager } from './components/DocumentsManager'
import { ProvenanceHubTab } from './components/ProvenanceHubTab'
import { RadialQuickAddMenu } from './components/RadialQuickAddMenu'
import { ConnectPrompt } from './components/ConnectPrompt'
import { ConnectivityChip } from './components/ConnectivityChip'
import { StatusChips } from './components/StatusChips'
import { EdgeLabelToggle } from './components/EdgeLabelToggle'
import { LimitsPanel } from './components/LimitsPanel'
import type { NodeType } from './domain/nodes'
import { InputsDock } from './components/InputsDock'
import { OutputsDock } from './components/OutputsDock'
import { isInputsOutputsEnabled, isCommandPaletteEnabled, isDegradedBannerEnabled, isOnboardingTourEnabled, pocFlags } from '../flags'
import { useEngineLimits } from './hooks/useEngineLimits'
import { useRunEligibilityCheck } from './hooks/useRunEligibilityCheck'

interface ReactFlowGraphProps {
  blueprintEventBus?: {
    subscribe: (fn: (blueprint: Blueprint) => void) => () => void
  }
  onCanvasInteraction?: () => void
}

function ReactFlowGraphInner({ blueprintEventBus, onCanvasInteraction }: ReactFlowGraphProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { getViewport, setCenter } = useReactFlow()

  // Phase 3: Memoize heavy computations for performance
  const memoizedNodes = useMemo(() => nodes, [nodes])
  const memoizedEdges = useMemo(() => edges, [edges])
  const createNodeId = useCanvasStore(s => s.createNodeId)
  const createEdgeId = useCanvasStore(s => s.createEdgeId)
  
  // State declarations
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [draggingNodeIds, setDraggingNodeIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const showResultsPanel = useCanvasStore(s => s.showResultsPanel)
  const showInspectorPanel = useCanvasStore(s => s.showInspectorPanel)
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)
  const setShowInspectorPanel = useCanvasStore(s => s.setShowInspectorPanel)
  const [pendingBlueprint, setPendingBlueprint] = useState<Blueprint | null>(null)
  const [existingTemplate, setExistingTemplate] = useState<{ id: string; name: string } | null>(null)
  const { isOpen: isKeyboardLegendOpen, open: openKeyboardLegend, close: closeKeyboardLegend } = useKeyboardLegend()
  const { isOpen: isOnboardingOpen, open: openOnboarding, close: closeOnboarding } = useOnboarding()
  const onboardingEnabled = isOnboardingTourEnabled()
  const {
    shouldShow: shouldShowInfluenceExplainer,
    forceShow: isInfluenceExplainerForced,
    show: showInfluenceExplainer,
    hide: hideInfluenceExplainer
  } = useInfluenceExplainer()

  // P0-7: Quick-add mode state
  const [quickAddMode, setQuickAddMode] = useState(false)
  const [radialMenuPosition, setRadialMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const addNode = useCanvasStore(s => s.addNode)

  // Phase 3: Empty state actions
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const openTemplatesPanel = useCanvasStore(s => s.openTemplatesPanel)

  // P0-8: Auto-connect state
  const [connectPrompt, setConnectPrompt] = useState<{
    newNodeId: string
    targetNodeId: string
    targetNodeLabel: string
    position: { x: number; y: number }
  } | null>(null)
  const addEdge = useCanvasStore(s => s.addEdge)
  const [showLimits, setShowLimits] = useState(false)

  // M4: Graph Health state
  const graphHealth = useCanvasStore(s => s.graphHealth)
  const showIssuesPanel = useCanvasStore(s => s.showIssuesPanel)
  const setShowIssuesPanel = useCanvasStore(s => s.setShowIssuesPanel)
  const applyRepair = useCanvasStore(s => s.applyRepair)
  const applyAllRepairs = useCanvasStore(s => s.applyAllRepairs)
  const needleMovers = useCanvasStore(s => s.needleMovers)

  // M5: Grounding & Provenance state
  const documents = useCanvasStore(s => s.documents)
  const citations = useCanvasStore(s => s.citations)
  const showDocumentsDrawer = useCanvasStore(s => s.showDocumentsDrawer)
  const setShowDocumentsDrawer = useCanvasStore(s => s.setShowDocumentsDrawer)
  const showProvenanceHub = useCanvasStore(s => s.showProvenanceHub)
  const setShowProvenanceHub = useCanvasStore(s => s.setShowProvenanceHub)
  const provenanceRedactionEnabled = useCanvasStore(s => s.provenanceRedactionEnabled)
  const toggleProvenanceRedaction = useCanvasStore(s => s.toggleProvenanceRedaction)
  const addDocument = useCanvasStore(s => s.addDocument)

  // Results run hook
  const { run: runAnalysis } = useResultsRun()
  const inputsOutputsEnabled = isInputsOutputsEnabled()
  const paletteEnabled = isCommandPaletteEnabled()
  const degradedBannerEnabled = isDegradedBannerEnabled()
  const { limits } = useEngineLimits()
  const checkRunEligibility = useRunEligibilityCheck()

  // Diagnostics resume toast (B3)
  useRunDiagnosticsToast()

  // E2E-only helper: when dock layout is OFF, auto-open the legacy documents drawer
  // so that documents flows remain testable without relying on shortcut ordering.
  useEffect(() => {
    if (!inputsOutputsEnabled && typeof window !== 'undefined') {
      const win = window as any
      if (win.__E2E === '1') {
        setShowDocumentsDrawer(true)
      }
    }
  }, [inputsOutputsEnabled, setShowDocumentsDrawer])

  // Autosave hook - saves graph every 30s when dirty
  useAutosave()

  // P1 Polish: Cross-tab sync for edge label mode
  useEffect(() => {
    return useEdgeLabelModeSync()
  }, [])

  // Auto-open behaviour for Results is now handled by OutputsDock based on results.status.

  const handleSelectionChange = useCallback((params: { nodes: any[]; edges: any[] }) => {
    useCanvasStore.getState().onSelectionChange(params)
  }, [])
  
  const reconnecting = useCanvasStore(s => s.reconnecting)
  const completeReconnect = useCanvasStore(s => s.completeReconnect)
  const { showToast } = useToast()
  const resultsLoadHistorical = useCanvasStore(s => s.resultsLoadHistorical)

  // v1.2: Share link resolver - load run from localStorage when ?run=hash is present
  // Uses useLocation to detect route changes and hashchange listener for direct navigation
  const location = useLocation()

  useEffect(() => {
    const resolveShareLink = () => {
      // Parse URL using robust parser (handles both sha256: prefix and plain hex)
      const fullUrl = window.location.href
      const runHash = parseRunHash(fullUrl)

      if (!runHash) {
        return // No run parameter in URL
      }

      if (import.meta.env.DEV) {
        console.log('[ReactFlowGraph] Share link detected, loading run:', runHash.slice(0, 8))
      }

      // Load all runs from localStorage (local-device only)
      const runs = loadRuns()

      // Find run by hash
      const run = runs.find(r => r.hash === runHash)

      if (run) {
        // Load historical run into canvas
        resultsLoadHistorical(run)

        // Open Results panel to show the loaded run
        setShowResultsPanel(true)

        if (import.meta.env.DEV) {
          console.log('[ReactFlowGraph] Run loaded successfully:', run.summary)
        }
      } else {
        // Run not found in localStorage
        console.warn('[ReactFlowGraph] Shared run not found in history:', runHash)

        // Show user-friendly toast notification (local-only scope explicit)
        showToast(
          `Run not found. This link can only be opened on the device it was created on.`,
          'warning'
        )

        if (import.meta.env.DEV) {
          console.log('[ReactFlowGraph] Run not found in local history.')
        }
      }
    }

    // Resolve on mount and when location changes
    resolveShareLink()

    // Also listen for hashchange events (fallback for direct hash manipulation)
    const handleHashChange = () => {
      if (import.meta.env.DEV) {
        console.log('[ReactFlowGraph] Hash changed, re-resolving share link')
      }
      resolveShareLink()
    }

    window.addEventListener('hashchange', handleHashChange, { passive: true })

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, location.search])  // Re-run when hash or search params change

  // M4: Graph Health validation lifecycle (debounced)
  const validateGraph = useCanvasStore(s => s.validateGraph)
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Validate on mount (initial load)
    validateGraph()

    // Cleanup timer on unmount
    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
    }
  }, []) // Only run on mount

  // Validate when graph changes (debounced to avoid excessive validation)
  useEffect(() => {
    // Clear existing timer
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current)
    }

    // Debounce validation by 500ms after graph changes
    validationTimerRef.current = setTimeout(() => {
      validateGraph()
    }, 500)

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
    }
  }, [nodes, edges, validateGraph]) // Re-run when graph structure changes

  const handleNodeClick = useCallback((_: any, node: any) => {
    // Close Templates panel when interacting with canvas
    onCanvasInteraction?.()

    if (reconnecting) {
      completeReconnect(node.id)
      showToast('Connector updated — press ⌘Z to undo.', 'success')
    }
  }, [reconnecting, completeReconnect, showToast, onCanvasInteraction])

  const handleEdgeClick = useCallback(() => {
    // Close Templates panel when clicking an edge
    onCanvasInteraction?.()
  }, [onCanvasInteraction])

  // Focus node handler (for Alt+V validation cycling and Results panel drivers)
  const handleFocusNode = useCallback((nodeId: string) => {
    const store = useCanvasStore.getState()
    const targetNode = store.nodes.find(n => n.id === nodeId)

    if (!targetNode) return

    // Select node WITHOUT pushing to history (navigation-only, not structural change)
    store.selectNodeWithoutHistory(nodeId)

    // Center viewport on the node with smooth animation
    const viewport = getViewport()
    setCenter(targetNode.position.x, targetNode.position.y, {
      zoom: viewport.zoom,
      duration: 300
    })
  }, [getViewport, setCenter])

  // Focus edge handler (for Results panel drivers)
  const handleFocusEdge = useCallback((edgeId: string) => {
    const store = useCanvasStore.getState()
    const targetEdge = store.edges.find(e => e.id === edgeId)

    if (!targetEdge) return

    // Find source and target nodes
    const sourceNode = store.nodes.find(n => n.id === targetEdge.source)
    const targetNode = store.nodes.find(n => n.id === targetEdge.target)

    if (!sourceNode || !targetNode) return

    // Calculate midpoint between source and target
    const midX = (sourceNode.position.x + targetNode.position.x) / 2
    const midY = (sourceNode.position.y + targetNode.position.y) / 2

    // Select edge (not in history, just for visual feedback)
    useCanvasStore.setState({
      edges: store.edges.map(e => ({
        ...e,
        selected: e.id === edgeId
      }))
    })

    // Center viewport on edge midpoint with smooth animation
    const viewport = getViewport()
    setCenter(midX, midY, {
      zoom: viewport.zoom,
      duration: 300,
    })
  }, [getViewport, setCenter])

  // Register focus helpers for external use (Results panel)
  useEffect(() => {
    registerFocusHelpers(handleFocusNode, handleFocusEdge)
    return () => unregisterFocusHelpers()
  }, [handleFocusNode, handleFocusEdge])

  // Run simulation handler with shared eligibility gating
  const handleRunSimulation = useCallback(async () => {
    const eligibility = checkRunEligibility()
    if (!eligibility.canRun) {
      return
    }

    // Open Results panel and trigger analysis
    setShowResultsPanel(true)

    // Run analysis with canvas graph
    await runAnalysis({
      template_id: 'canvas-graph',
      seed: 1337,
      graph: { nodes: store.nodes, edges: store.edges },
      outcome_node: store.outcomeNodeId || undefined,
    })
  }, [checkRunEligibility, runAnalysis, setShowResultsPanel])

  // M4: Health panel handlers
  const handleFixIssue = useCallback(async (issue: any) => {
    await applyRepair(issue.id)
    showToast('Issue fixed — graph updated', 'success')
  }, [applyRepair, showToast])

  const handleQuickFixAll = useCallback(async () => {
    await applyAllRepairs()
    showToast('All fixable issues resolved', 'success')
  }, [applyAllRepairs, showToast])

  // M5: Documents handlers
  const handleUploadDocuments = useCallback(async (files: File[]) => {
    try {
      let uploadedCount = 0
      for (const file of files) {
        try {
          const content = await file.text()
          const type = file.name.endsWith('.pdf') ? 'pdf' :
                       file.name.endsWith('.txt') ? 'txt' :
                       file.name.endsWith('.md') ? 'md' :
                       file.name.endsWith('.csv') ? 'csv' : 'txt'

          addDocument({
            name: file.name,
            type: type as any,
            content,
            size: file.size
          })
          uploadedCount++
        } catch (fileErr) {
          // Show specific error for this file
          const message = fileErr instanceof Error ? fileErr.message : 'Failed to upload document'
          showToast(`${file.name}: ${message}`, 'error')
        }
      }
      if (uploadedCount > 0) {
        showToast(`${uploadedCount} document${uploadedCount > 1 ? 's' : ''} uploaded`, 'success')
      }
    } catch (err) {
      showToast('Failed to upload documents', 'error')
    }
  }, [addDocument, showToast])

  const handleDeleteDocument = useCallback((_documentId: string, doc?: any) => {
    const name = doc?.name ?? 'Document'
    showToast(`${name} removed`, 'success')
  }, [showToast])

  const showDocuments = useCallback(() => {
    if (inputsOutputsEnabled) {
      if (typeof document === 'undefined') return

      const dock = document.querySelector('[data-testid="inputs-dock"]') as HTMLElement | null
      if (!dock) return

      const toggleButton = dock.querySelector('[data-testid="inputs-dock-toggle"]') as HTMLButtonElement | null
      if (toggleButton && toggleButton.getAttribute('aria-label')?.includes('Expand')) {
        toggleButton.click()
      }

      const documentsTab = dock.querySelector('[data-testid="inputs-dock-tab-documents"]') as HTMLButtonElement | null
      if (documentsTab) {
        documentsTab.click()
      }

      // Focus the documents panel body for keyboard users
      requestAnimationFrame(() => {
        const panel = document.querySelector('[data-testid="documents-panel"]') as HTMLElement | null
        panel?.focus()
      })

      return
    }

    // Legacy drawer path: ensure drawer is open and focus it
    if (!useCanvasStore.getState().showDocumentsDrawer) {
      setShowDocumentsDrawer(true)
    }

    requestAnimationFrame(() => {
      if (typeof document === 'undefined') return
      const drawer = document.querySelector('[data-testid="documents-drawer"]') as HTMLElement | null
      drawer?.focus()
    })
  }, [inputsOutputsEnabled, setShowDocumentsDrawer])

  // Setup keyboard shortcuts (P, Alt+V, Cmd/Ctrl+Enter, Cmd/Ctrl+3, Cmd/Ctrl+I, Cmd/Ctrl+D, ?)
  useCanvasKeyboardShortcuts({
    onFocusNode: handleFocusNode,
    onRunSimulation: handleRunSimulation,
    onToggleResults: () => {
      // Cmd/Ctrl+3: ensure Results are visible in the Outputs dock.
      setShowResultsPanel(true)
    },
    onToggleInspector: () => {
      const next = !useCanvasStore.getState().showInspectorPanel
      setShowInspectorPanel(next)
    },
    onToggleDocuments: showDocuments,
    onShowToast: showToast
  })

  // P0-7: Q key to toggle quick-add mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        setQuickAddMode(prev => !prev)
        setRadialMenuPosition(null) // Close menu if open
        if (!quickAddMode) {
          showToast('Quick-add mode enabled. Click canvas to add nodes.', 'info')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [quickAddMode, showToast])

  // P0-7: Handle pane click to show radial menu in quick-add mode
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (quickAddMode) {
      setRadialMenuPosition({ x: event.clientX, y: event.clientY })
    }
  }, [quickAddMode])

  // P0-7: Handle node type selection from radial menu
  const handleRadialMenuSelect = useCallback((nodeType: NodeType) => {
    if (radialMenuPosition) {
      const viewport = getViewport()
      // Convert screen coordinates to canvas coordinates
      const canvasX = (radialMenuPosition.x - viewport.x) / viewport.zoom
      const canvasY = (radialMenuPosition.y - viewport.y) / viewport.zoom

      // Get current node ID before adding (to identify new node)
      const state = useCanvasStore.getState()
      const beforeNodeCount = state.nodes.length

      addNode({ x: canvasX, y: canvasY }, nodeType)
      setRadialMenuPosition(null)
      showToast(`Added ${nodeType} node`, 'success')

      // P0-8: Check for nearby nodes within 300px
      setTimeout(() => {
        const newState = useCanvasStore.getState()
        if (newState.nodes.length > beforeNodeCount) {
          // Find the newly added node (last node)
          const newNode = newState.nodes[newState.nodes.length - 1]

          // Find nearby nodes within 300px
          const nearbyNodes = newState.nodes.filter(n => {
            if (n.id === newNode.id) return false
            const dx = n.position.x - newNode.position.x
            const dy = n.position.y - newNode.position.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            return distance <= 300
          })

          if (nearbyNodes.length > 0) {
            // Show prompt for the closest node
            const closest = nearbyNodes.reduce((prev, curr) => {
              const prevDist = Math.sqrt(
                Math.pow(prev.position.x - newNode.position.x, 2) +
                Math.pow(prev.position.y - newNode.position.y, 2)
              )
              const currDist = Math.sqrt(
                Math.pow(curr.position.x - newNode.position.x, 2) +
                Math.pow(curr.position.y - newNode.position.y, 2)
              )
              return currDist < prevDist ? curr : prev
            })

            // Convert target node's canvas position to screen coordinates
            const viewport = getViewport()
            const screenX = closest.position.x * viewport.zoom + viewport.x
            const screenY = closest.position.y * viewport.zoom + viewport.y

            setConnectPrompt({
              newNodeId: newNode.id,
              targetNodeId: closest.id,
              targetNodeLabel: (closest.data as any)?.label || closest.id,
              position: { x: screenX, y: screenY }
            })
          }
        }
      }, 50) // Small delay to ensure node is added to store
    }
  }, [radialMenuPosition, getViewport, addNode, showToast])

  // P0-7: Cancel radial menu
  const handleRadialMenuCancel = useCallback(() => {
    setRadialMenuPosition(null)
  }, [])

  // P0-8: Confirm connection to nearby node
  const handleConfirmConnect = useCallback(() => {
    if (connectPrompt) {
      addEdge({
        source: connectPrompt.newNodeId,
        target: connectPrompt.targetNodeId,
        data: { ...DEFAULT_EDGE_DATA, weight: 0.5, belief: 0.5 }
      })
      showToast(`Connected to ${connectPrompt.targetNodeLabel}`, 'success')
      setConnectPrompt(null)
    }
  }, [connectPrompt, addEdge, showToast])

  // P0-8: Cancel connection prompt
  const handleCancelConnect = useCallback(() => {
    setConnectPrompt(null)
  }, [])

  // Blueprint insertion handler
  const insertBlueprint = useCallback((blueprint: Blueprint): { nodeIdMap: Map<string, string>; newNodes: any[]; newEdges: any[]; error?: string } => {
    // Transform to goal-first graph
    const graph = blueprintToGraph(blueprint)

    const viewport = getViewport()
    const centerX = -viewport.x + (window.innerWidth / 2) / viewport.zoom
    const centerY = -viewport.y + (window.innerHeight / 2) / viewport.zoom

    // Create ID mapping
    const nodeIdMap = new Map<string, string>()
    graph.nodes.forEach(node => {
      nodeIdMap.set(node.id, createNodeId())
    })

    // Calculate blueprint center
    const positions = graph.nodes.map(n => n.position || { x: 0, y: 0 })
    const minX = Math.min(...positions.map(p => p.x))
    const maxX = Math.max(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const maxY = Math.max(...positions.map(p => p.y))
    const blueprintCenterX = (minX + maxX) / 2
    const blueprintCenterY = (minY + maxY) / 2

    // Create nodes with correct types and template metadata
    const templateCreatedAt = new Date().toISOString()

    const newNodes = graph.nodes.map(node => {
      const pos = node.position || { x: 0, y: 0 }
      return {
        id: nodeIdMap.get(node.id)!,
        type: node.kind,
        position: {
          x: centerX + (pos.x - blueprintCenterX),
          y: centerY + (pos.y - blueprintCenterY)
        },
        data: {
          label: node.label,
          kind: node.kind,
          templateId: blueprint.id,
          templateName: blueprint.name,
          templateCreatedAt
        }
      }
    })

    // Create edges with v1.2 metadata (weight, belief, provenance)
    const newEdges = graph.edges.map(edge => {
      const pct = edge.probability != null ? Math.round(edge.probability * 100) : undefined
      const label = pct != null ? `${pct}%` : undefined
      const edgeId = createEdgeId()

      // Detect edge kind: influence network (has weight, no probability) vs decision tree (has probability)
      const isInfluenceEdge = edge.weight !== undefined && edge.probability === undefined
      const edgeKind = isInfluenceEdge ? 'influence-weight' as const : 'decision-probability' as const

      return {
        id: edgeId,
        type: 'styled',
        source: nodeIdMap.get(edge.from)!,
        target: nodeIdMap.get(edge.to)!,
        data: {
          ...DEFAULT_EDGE_DATA,
          kind: edgeKind,                                // Auto-detect influence vs probability edges
          weight: edge.weight ?? DEFAULT_EDGE_DATA.weight,
          label,
          confidence: edge.probability,
          belief: edge.belief ?? edge.probability,      // v1.2: prefer belief, fallback to probability
          provenance: edge.provenance ?? 'template',    // v1.2: default to template source
          templateId: blueprint.id
        }
      }
    })

    // Batch update store
    const store = useCanvasStore.getState()
    store.pushHistory()
    useCanvasStore.setState(state => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges]
    }))

    showToast(`Inserted ${blueprint.name} to canvas.`, 'success')

    // Return result object for caller to check
    return { nodeIdMap, newNodes, newEdges }
  }, [getViewport, createNodeId, createEdgeId, showToast])
  
  useEffect(() => {
    if (!blueprintEventBus) return

    const unsubscribe = blueprintEventBus.subscribe((blueprint: Blueprint) => {
      // Check for existing template
      const existingTemplateNode = nodes.find(n => n.data?.templateId)
      if (existingTemplateNode && existingTemplateNode.data) {
        setPendingBlueprint(blueprint)
        setExistingTemplate({
          id: String(existingTemplateNode.data.templateId || ''),
          name: String(existingTemplateNode.data.templateName || 'Existing flow')
        })
        return { error: 'Cannot insert: template already exists on canvas' }
      }

      // Sprint 2: Handle limit errors and return result
      const result = insertBlueprint(blueprint)
      if (result.error) {
        showToast(result.error, 'warning')
      }
      return result
    })

    return unsubscribe
  }, [blueprintEventBus, nodes, insertBlueprint])
  
  const handleConfirmReplace = useCallback(() => {
    if (!pendingBlueprint) return
    
    // Remove all nodes/edges from existing template
    const store = useCanvasStore.getState()
    store.pushHistory()
    
    const remainingNodes = nodes.filter(n => !n.data?.templateId)
    const remainingNodeIds = new Set(remainingNodes.map(n => n.id))
    const remainingEdges = edges.filter(e => 
      remainingNodeIds.has(e.source) && remainingNodeIds.has(e.target)
    )
    
    useCanvasStore.setState({
      nodes: remainingNodes,
      edges: remainingEdges
    })

    // Insert new blueprint (Sprint 2: Handle limit errors)
    const result = insertBlueprint(pendingBlueprint)
    if (result.error) {
      showToast(result.error, 'warning')
    }

    setPendingBlueprint(null)
    setExistingTemplate(null)
  }, [pendingBlueprint, nodes, edges, insertBlueprint])
  
  const handleCancelReplace = useCallback(() => {
    setPendingBlueprint(null)
    setExistingTemplate(null)
  }, [])
  
  const { showGrid, gridSize, snapToGrid, showAlignmentGuides, loadSettings } = useSettingsStore()
  const snapGridValue = useMemo<[number, number]>(() => [gridSize, gridSize], [gridSize])
  const edgeTypes = useMemo(() => ({ styled: StyledEdge as any }), [])
  const defaultEdgeOpts = useMemo(() => ({ type: 'styled' as const, animated: false }), [])
  const miniMapStyle = useMemo(() => ({ width: 120, height: 80 }), [])

  if (import.meta.env.DEV) {
    const renderCount = useRef(0)
    renderCount.current++
    if (renderCount.current > 100) console.warn('[ReactFlowGraph] Render storm detected')
  }

  useKeyboardShortcuts()

  useEffect(() => {
    loadSettings()
    const loaded = loadState()
    if (loaded) {
      // P2: Use hydrateGraphSlice to avoid clobbering panels/results
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loaded.nodes,
        edges: loaded.edges
      })
    }
  }, [loadSettings])

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state) => saveState({ nodes: state.nodes, edges: state.edges }))
    return unsubscribe
  }, [])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    useCanvasStore.getState().onNodesChange(changes)
  }, [])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    useCanvasStore.getState().onEdgesChange(changes)
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    useCanvasStore.getState().addEdge({ ...connection, data: DEFAULT_EDGE_DATA })
  }, [])

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const onNodeDragStart = useCallback((_: React.MouseEvent | MouseEvent, node: any) => {
    setDraggingNodeIds(prev => new Set([...prev, node.id]))
    setIsDragging(true)
  }, [])

  const onNodeDragStop = useCallback(() => {
    setDraggingNodeIds(new Set())
    setIsDragging(false)
  }, [])

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: quickAddMode ? 'crosshair' : undefined,
      }}
    >
      {pocFlags.contextBar && (
        <div className="absolute top-4 left-4 right-4 z-[1010] flex justify-start">
          <div className="max-w-xl">
            <ContextBar />
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 'var(--topbar-h)',
          bottom: 'var(--bottombar-h)',
          left: inputsOutputsEnabled ? 'var(--dock-left-offset, 0rem)' : 0,
          right: inputsOutputsEnabled ? 'var(--dock-right-offset, 0rem)' : 0,
        }}
      >
        <ReactFlow
          nodes={memoizedNodes}
          edges={memoizedEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onSelectionChange={handleSelectionChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOpts}
          snapToGrid={snapToGrid}
          snapGrid={snapGridValue}
          fitView
          minZoom={0.1}
          maxZoom={4}
        >
          <Background variant={showGrid ? BackgroundVariant.Dots : BackgroundVariant.Lines} gap={gridSize} />
          {/* TODO: Future enhancement - Add legend and interaction controls to MiniMap */}
          <MiniMap style={miniMapStyle} />
          <svg style={{ position: 'absolute', top: 0, left: 0 }}>
            <defs>
              {/* Arrowheads matching edge colors - original size (6x6), fixed regardless of stroke width */}
              <marker id="arrowhead-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="var(--surface-border)" />
              </marker>
              <marker id="arrowhead-selected" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="var(--info-500)" />
              </marker>
            </defs>
          </svg>
        </ReactFlow>

        {/* Phase 3: Empty state for new users */}
        {nodes.length === 0 && (
          <CanvasEmptyState
            onDraft={() => setShowDraftChat(true)}
            onTemplate={() => openTemplatesPanel()}
          />
        )}
      </div>

      {/* Highlight layer for Results drivers (keyed off global showResultsPanel flag) */}
      <HighlightLayer isResultsOpen={showResultsPanel} />

      {showAlignmentGuides && isDragging && <AlignmentGuides nodes={nodes} draggingNodeIds={draggingNodeIds} isActive={isDragging} />}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={handleCloseContextMenu} />}
      {reconnecting && <ReconnectBanner />}

      <CanvasToolbar />
      <div
        className="absolute z-[1200] flex flex-col items-end gap-3"
        style={{
          top: 'calc(var(--topbar-h, 0px) + 1rem)',
          right: inputsOutputsEnabled ? 'calc(var(--dock-right-offset, 0rem) + 1rem)' : '1rem',
        }}
      >
        <div className="flex flex-col items-end gap-2">
          <ConnectivityChip />
          <StatusChips
            currentNodes={nodes.length}
            currentEdges={edges.length}
            onClick={() => setShowLimits(true)}
          />
          {edges.length > 0 && <EdgeLabelToggle showLabel={false} />}
        </div>
        <HelpMenu
          onShowOnboarding={openOnboarding}
          onShowKeyboardLegend={openKeyboardLegend}
          onShowInfluenceExplainer={showInfluenceExplainer}
        />
        {shouldShowInfluenceExplainer && (
          <InfluenceExplainer forceShow={isInfluenceExplainerForced} onDismiss={hideInfluenceExplainer} compact />
        )}
      </div>
      <PropertiesPanel />
      <SettingsPanel />
      <DiagnosticsOverlay />
      <ValidationChip onFocusNode={handleFocusNode} />
      <RecoveryBanner />
      <LayoutProgressBanner />

      {/* M4: Graph Health UI */}
      {graphHealth && graphHealth.issues.length > 0 && (
        <div className="absolute top-20 left-4 right-4 z-10 max-w-2xl">
          <HealthStatusBar
            health={graphHealth}
            onShowIssues={() => setShowIssuesPanel(true)}
            onQuickFix={handleQuickFixAll}
          />
        </div>
      )}
      {needleMovers.length > 0 && (
        <NeedleMoversOverlay
          movers={needleMovers}
          onFocusNode={handleFocusNode}
        />
      )}

      {paletteEnabled && showCommandPalette && (
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onOpenInspector={() => setShowInspectorPanel(true)}
        />
      )}
      {degradedBannerEnabled && <DegradedBanner />}
      <KeyboardLegend isOpen={isKeyboardLegendOpen} onClose={closeKeyboardLegend} />
      {showInspectorPanel && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/20"><div className="text-sm text-white">Loading...</div></div>}>
          <InspectorPanel isOpen={showInspectorPanel} onClose={() => setShowInspectorPanel(false)} />
        </Suspense>
      )}
      {showIssuesPanel && graphHealth && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/20"><div className="text-sm text-white">Loading...</div></div>}>
          <IssuesPanel
            issues={graphHealth.issues}
            onFixIssue={handleFixIssue}
            onClose={() => setShowIssuesPanel(false)}
          />
        </Suspense>
      )}

      {/* M5: Documents drawer (left side). When inputs/outputs layout is enabled, the
          DocumentsManager is rendered inside the InputsDock instead of this drawer. */}
      {!inputsOutputsEnabled && showDocumentsDrawer && (
        <div
          className="fixed left-0 w-96 bg-white border-r border-gray-200 shadow-panel overflow-hidden"
          style={{ zIndex: 2000, top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
          data-testid="documents-drawer"
          tabIndex={-1}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Documents</h2>
            <button
              onClick={() => setShowDocumentsDrawer(false)}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Close documents drawer"
            >
              ✕
            </button>
          </div>
          <div className="h-full">
            <DocumentsManager
              onUpload={handleUploadDocuments}
              onDelete={handleDeleteDocument}
            />
          </div>
        </div>
      )}

      {/* M5: Provenance Hub panel (right side) */}
      {showProvenanceHub && (
        <div
          className="fixed right-0 w-[32rem] bg-white border-l border-gray-200 shadow-panel overflow-hidden"
          style={{ zIndex: 2000, top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Provenance Hub</h2>
            <button
              onClick={() => setShowProvenanceHub(false)}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Close provenance panel"
            >
              ✕
            </button>
          </div>
          <div className="h-full">
            <ProvenanceHubTab
              citations={citations}
              documents={documents}
              redactionEnabled={provenanceRedactionEnabled}
              onToggleRedaction={toggleProvenanceRedaction}
              onFocusNode={handleFocusNode}
            />
          </div>
        </div>
      )}

      {existingTemplate && pendingBlueprint && (
        <ConfirmDialog
          title="Replace existing flow?"
          message={`This will replace the existing '${existingTemplate.name}' flow on the canvas.`}
          confirmLabel="Replace"
          cancelLabel="Cancel"
          onConfirm={handleConfirmReplace}
          onCancel={handleCancelReplace}
        />
      )}

      {/* P0-7: Radial quick-add menu */}
      {radialMenuPosition && (
        <RadialQuickAddMenu
          position={radialMenuPosition}
          onSelect={handleRadialMenuSelect}
          onCancel={handleRadialMenuCancel}
        />
      )}

      {/* P0-8: Auto-connect prompt */}
      {connectPrompt && (
        <ConnectPrompt
          targetNodeLabel={connectPrompt.targetNodeLabel}
          position={connectPrompt.position}
          onConfirm={handleConfirmConnect}
          onCancel={handleCancelConnect}
        />
      )}

      {/* Onboarding overlay for first-time users */}
      {onboardingEnabled && (
        <OnboardingOverlay
          isOpen={isOnboardingOpen}
          onClose={closeOnboarding}
          onShowKeyboardLegend={openKeyboardLegend}
          onShowInfluenceExplainer={showInfluenceExplainer}
        />
      )}

      {inputsOutputsEnabled && (
        <>
          <div className="absolute inset-y-0 left-0 z-[1500] flex">
            <InputsDock
              currentNodes={nodes.length}
              currentEdges={edges.length}
              renderDocumentsTab={() => (
                <div className="h-full overflow-auto" data-testid="documents-panel" tabIndex={-1}>
                  <DocumentsManager
                    onUpload={handleUploadDocuments}
                    onDelete={handleDeleteDocument}
                  />
                </div>
              )}
            />
          </div>
          <div className="absolute inset-y-0 right-0 z-[1500] flex">
            <OutputsDock />
          </div>
        </>
      )}
      <LimitsPanel
        isOpen={showLimits}
        onClose={() => setShowLimits(false)}
        currentNodes={nodes.length}
        currentEdges={edges.length}
      />

      {/* R1: Draft My Model chat loop (bottom overlay above toolbar) */}
      <DraftChat />
    </div>
  )
}

export default function ReactFlowGraph(props: ReactFlowGraphProps) {
  return (
    <CanvasErrorBoundary>
      <ToastProvider>
        <LayerProvider>
          <ReactFlowProvider>
            <ReactFlowGraphInner {...props} />
          </ReactFlowProvider>
        </LayerProvider>
      </ToastProvider>
    </CanvasErrorBoundary>
  )
}
