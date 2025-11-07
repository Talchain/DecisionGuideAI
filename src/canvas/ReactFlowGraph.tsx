import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { ReactFlow, ReactFlowProvider, MiniMap, Background, BackgroundVariant, type Connection, type NodeChange, type EdgeChange, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore, hasValidationErrors } from './store'
import { DEFAULT_EDGE_DATA } from './domain/edges'
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
import { KeyboardCheatsheet } from './components/KeyboardCheatsheet'
import { KeyboardMap } from './components/KeyboardMap'
import { SettingsPanel } from './components/SettingsPanel'
import { useSettingsStore } from './settingsStore'
import { CanvasErrorBoundary } from './ErrorBoundary'
import { ToastProvider, useToast } from './ToastContext'
import { DiagnosticsOverlay } from './DiagnosticsOverlay'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ValidationChip } from './components/ValidationChip'
import { LayerProvider } from './components/LayerProvider'
import { FirstRunHint } from './components/FirstRunHint'
import { RecoveryBanner } from './components/RecoveryBanner'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { useCanvasKeyboardShortcuts } from './hooks/useCanvasKeyboardShortcuts'
import { useAutosave } from './hooks/useAutosave'
import type { Blueprint } from '../templates/blueprints/types'
import { blueprintToGraph } from '../templates/mapper/blueprintToGraph'
import { ResultsPanel } from './panels/ResultsPanel'
import { InspectorPanel } from './panels/InspectorPanel'
import { useResultsRun } from './hooks/useResultsRun'
import { HighlightLayer } from './highlight/HighlightLayer'
import { registerFocusHelpers, unregisterFocusHelpers } from './utils/focusHelpers'

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
  const createNodeId = useCanvasStore(s => s.createNodeId)
  const createEdgeId = useCanvasStore(s => s.createEdgeId)
  
  // State declarations
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [draggingNodeIds, setDraggingNodeIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [showKeyboardMap, setShowKeyboardMap] = useState(false)
  const showResultsPanel = useCanvasStore(s => s.showResultsPanel)
  const showInspectorPanel = useCanvasStore(s => s.showInspectorPanel)
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)
  const setShowInspectorPanel = useCanvasStore(s => s.setShowInspectorPanel)
  const [pendingBlueprint, setPendingBlueprint] = useState<Blueprint | null>(null)
  const [existingTemplate, setExistingTemplate] = useState<{ id: string; name: string } | null>(null)

  // Results panel hook
  const { run: runAnalysis, cancel: cancelAnalysis } = useResultsRun()

  // Autosave hook - saves graph every 30s when dirty
  useAutosave()

  const handleSelectionChange = useCallback((params: { nodes: any[]; edges: any[] }) => {
    useCanvasStore.getState().onSelectionChange(params)
  }, [])
  
  const reconnecting = useCanvasStore(s => s.reconnecting)
  const completeReconnect = useCanvasStore(s => s.completeReconnect)
  const { showToast } = useToast()
  
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
      duration: 300
    })
  }, [getViewport, setCenter])

  // Register focus helpers for external use (Results panel)
  useEffect(() => {
    registerFocusHelpers(handleFocusNode, handleFocusEdge)
    return () => unregisterFocusHelpers()
  }, [handleFocusNode, handleFocusEdge])

  // Run simulation handler with validation gating
  const handleRunSimulation = useCallback(async () => {
    const store = useCanvasStore.getState()

    // Check if graph has any nodes
    if (store.nodes.length === 0) {
      showToast('Add nodes to the canvas before running', 'info')
      return
    }

    // Check if graph has validation errors using shared utility
    if (hasValidationErrors(store)) {
      showToast('Fix probability errors before running (Alt+V to navigate)', 'warning')
      return
    }

    // Open Results panel and trigger analysis
    setShowResultsPanel(true)

    // Run analysis with canvas graph
    // TODO: Convert canvas graph to template format for RunRequest
    await runAnalysis({
      template_id: 'canvas',
      seed: 1337
    })
  }, [showToast, runAnalysis])

  // Setup keyboard shortcuts (P, Alt+V, Cmd/Ctrl+Enter, Cmd/Ctrl+3, Cmd/Ctrl+I, ?)
  useCanvasKeyboardShortcuts({
    onFocusNode: handleFocusNode,
    onRunSimulation: handleRunSimulation,
    onToggleResults: () => setShowResultsPanel(prev => !prev),
    onToggleInspector: () => setShowInspectorPanel(prev => !prev),
    onShowKeyboardMap: () => setShowKeyboardMap(true),
    onShowToast: showToast
  })

  // Blueprint insertion handler
  const insertBlueprint = useCallback((blueprint: Blueprint) => {
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

    // Create edges with probability labels
    const newEdges = graph.edges.map(edge => {
      const pct = edge.probability != null ? Math.round(edge.probability * 100) : undefined
      const label = pct != null ? `${pct}%` : undefined
      const edgeId = createEdgeId()

      return {
        id: edgeId,
        type: 'styled',
        source: nodeIdMap.get(edge.from)!,
        target: nodeIdMap.get(edge.to)!,
        data: {
          ...DEFAULT_EDGE_DATA,
          weight: edge.weight ?? DEFAULT_EDGE_DATA.weight,
          label,
          confidence: edge.probability,
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
        return
      }
      
      insertBlueprint(blueprint)
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
    
    // Insert new blueprint
    insertBlueprint(pendingBlueprint)
    
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
      // Ensure touchedNodeIds is a Set (persist doesn't save it)
      useCanvasStore.setState({
        ...loaded,
        touchedNodeIds: new Set()
      })
    }
  }, [loadSettings])

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state) => saveState(state))
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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
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
        <MiniMap style={miniMapStyle} />
        <svg style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            {/* Arrowheads matching edge colors - original size (6x6), fixed regardless of stroke width */}
            <marker id="arrowhead-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#94A3B8" />
            </marker>
            <marker id="arrowhead-selected" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#63ADCF" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>

      {/* Highlight layer for Results panel drivers */}
      <HighlightLayer isResultsOpen={showResultsPanel} />

      {showAlignmentGuides && isDragging && <AlignmentGuides nodes={nodes} draggingNodeIds={draggingNodeIds} isActive={isDragging} />}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={handleCloseContextMenu} />}
      {reconnecting && <ReconnectBanner />}
      
      <CanvasToolbar />
      <PropertiesPanel />
      <SettingsPanel />
      <DiagnosticsOverlay />
      <ValidationChip onFocusNode={handleFocusNode} />
      <FirstRunHint />
      <RecoveryBanner />

      {showCommandPalette && <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} onOpenInspector={() => setShowInspectorPanel(true)} />}
      {showCheatsheet && <KeyboardCheatsheet isOpen={showCheatsheet} onClose={() => setShowCheatsheet(false)} />}
      {showKeyboardMap && <KeyboardMap isOpen={showKeyboardMap} onClose={() => setShowKeyboardMap(false)} />}
      {showResultsPanel && <ResultsPanel isOpen={showResultsPanel} onClose={() => setShowResultsPanel(false)} onCancel={cancelAnalysis} />}
      {showInspectorPanel && <InspectorPanel isOpen={showInspectorPanel} onClose={() => setShowInspectorPanel(false)} />}

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

      {/* Onboarding overlay for first-time users */}
      <OnboardingOverlay
        onBrowseTemplates={() => {
          // Open templates panel (trigger via onCanvasInteraction callback to parent)
          onCanvasInteraction?.()
        }}
        onCreateNew={() => {
          // Show empty state hint
          setShowEmptyState(true)
        }}
        onShowShortcuts={() => {
          // Show keyboard cheatsheet
          setShowCheatsheet(true)
        }}
      />
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
