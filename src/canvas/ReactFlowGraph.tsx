import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { ReactFlow, ReactFlowProvider, MiniMap, Background, BackgroundVariant, type Connection, type NodeChange, type EdgeChange, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from './store'
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
import { EmptyStateOverlay } from './components/EmptyStateOverlay'
import { ReconnectBanner } from './components/ReconnectBanner'
import { KeyboardCheatsheet } from './components/KeyboardCheatsheet'
import { SettingsPanel } from './components/SettingsPanel'
import { useSettingsStore } from './settingsStore'
import { CanvasErrorBoundary } from './ErrorBoundary'
import { ToastProvider, useToast } from './ToastContext'
import { DiagnosticsOverlay } from './DiagnosticsOverlay'
import { ConfirmDialog } from './components/ConfirmDialog'
import type { Blueprint } from '../templates/blueprints/types'

interface ReactFlowGraphProps {
  blueprintEventBus?: {
    subscribe: (fn: (blueprint: Blueprint) => void) => () => void
  }
}

function ReactFlowGraphInner({ blueprintEventBus }: ReactFlowGraphProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { getViewport } = useReactFlow()
  const createNodeId = useCanvasStore(s => s.createNodeId)
  const createEdgeId = useCanvasStore(s => s.createEdgeId)
  
  // State declarations
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [draggingNodeIds, setDraggingNodeIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showEmptyState, setShowEmptyState] = useState(true)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [pendingBlueprint, setPendingBlueprint] = useState<Blueprint | null>(null)
  const [existingTemplate, setExistingTemplate] = useState<{ id: string; name: string } | null>(null)
  
  const handleSelectionChange = useCallback((params: { nodes: any[]; edges: any[] }) => {
    useCanvasStore.getState().onSelectionChange(params)
  }, [])
  
  const reconnecting = useCanvasStore(s => s.reconnecting)
  const completeReconnect = useCanvasStore(s => s.completeReconnect)
  const { showToast } = useToast()
  
  const handleNodeClick = useCallback((_: any, node: any) => {
    if (reconnecting) {
      completeReconnect(node.id)
      showToast('Connector updated — press ⌘Z to undo.', 'success')
    }
  }, [reconnecting, completeReconnect, showToast])
  
  // Blueprint insertion handler
  useEffect(() => {
    if (!blueprintEventBus) return
    
    const unsubscribe = blueprintEventBus.subscribe((blueprint: Blueprint) => {
      // Check for existing template
      const existingTemplateNode = nodes.find(n => n.data?.templateId)
      if (existingTemplateNode) {
        setPendingBlueprint(blueprint)
        setExistingTemplate({
          id: existingTemplateNode.data.templateId,
          name: existingTemplateNode.data.templateName || 'Existing flow'
        })
        return
      }
      
      insertBlueprint(blueprint)
    })
    
    return unsubscribe
  }, [blueprintEventBus, nodes])
  
  const insertBlueprint = useCallback((blueprint: Blueprint) => {
      const viewport = getViewport()
      const centerX = -viewport.x + (window.innerWidth / 2) / viewport.zoom
      const centerY = -viewport.y + (window.innerHeight / 2) / viewport.zoom
      
      // Create ID mapping
      const nodeIdMap = new Map<string, string>()
      blueprint.nodes.forEach(node => {
        nodeIdMap.set(node.id, createNodeId())
      })
      
      // Calculate blueprint center
      const positions = blueprint.nodes.map(n => n.position || { x: 0, y: 0 })
      const minX = Math.min(...positions.map(p => p.x))
      const maxX = Math.max(...positions.map(p => p.x))
      const minY = Math.min(...positions.map(p => p.y))
      const maxY = Math.max(...positions.map(p => p.y))
      const blueprintCenterX = (minX + maxX) / 2
      const blueprintCenterY = (minY + maxY) / 2
      
      // Create nodes with correct types and template metadata
      const templateCreatedAt = new Date().toISOString()
      const newNodes = blueprint.nodes.map(node => {
        const pos = node.position || { x: 0, y: 0 }
        return {
          id: nodeIdMap.get(node.id)!,
          type: node.kind, // Use actual node kind: goal, option, risk, outcome, decision
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
      const newEdges = blueprint.edges.map(edge => {
        const pct = edge.probability != null ? Math.round(edge.probability * 100) : undefined
        return {
          id: createEdgeId(),
          source: nodeIdMap.get(edge.from)!,
          target: nodeIdMap.get(edge.to)!,
          label: pct != null ? `${pct}%` : undefined,
          data: {
            ...DEFAULT_EDGE_DATA,
            probability: edge.probability,
            weight: edge.weight,
            label: pct != null ? `${pct}%` : undefined
          }
        }
      })
      
      // Batch update
      const store = useCanvasStore.getState()
      store.pushHistory()
      useCanvasStore.setState(state => ({
        nodes: [...state.nodes, ...newNodes],
        edges: [...state.edges, ...newEdges]
      }))
      
      showToast(`Inserted ${blueprint.name} to canvas.`, 'success')
  }, [getViewport, createNodeId, createEdgeId, showToast])
  
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
    if (loaded) useCanvasStore.setState(loaded)
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
      </ReactFlow>
      
      {showAlignmentGuides && isDragging && <AlignmentGuides draggingNodeIds={draggingNodeIds} />}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={handleCloseContextMenu} />}
      {reconnecting && <ReconnectBanner />}
      
      <CanvasToolbar onOpenCommandPalette={() => setShowCommandPalette(true)} onOpenCheatsheet={() => setShowCheatsheet(true)} />
      <PropertiesPanel />
      <SettingsPanel />
      <DiagnosticsOverlay />
      
      {showCommandPalette && <CommandPalette onClose={() => setShowCommandPalette(false)} />}
      {showCheatsheet && <KeyboardCheatsheet onClose={() => setShowCheatsheet(false)} />}
      {nodes.length === 0 && <EmptyStateOverlay onDismiss={() => setShowEmptyState(false)} />}
      
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
    </div>
  )
}

export default function ReactFlowGraph(props: ReactFlowGraphProps) {
  return (
    <CanvasErrorBoundary>
      <ToastProvider>
        <ReactFlowProvider>
          <ReactFlowGraphInner {...props} />
        </ReactFlowProvider>
      </ToastProvider>
    </CanvasErrorBoundary>
  )
}
