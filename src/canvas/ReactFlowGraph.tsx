import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { ReactFlow, ReactFlowProvider, MiniMap, Background, BackgroundVariant, type Connection, type NodeChange, type EdgeChange } from '@xyflow/react'
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
// import { useLayoutStore } from './layoutStore' // unused
import { CanvasErrorBoundary } from './ErrorBoundary'
import { ToastProvider, useToast } from './ToastContext'
import { DiagnosticsOverlay } from './DiagnosticsOverlay'

function ReactFlowGraphInner() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  
  const handleSelectionChange = useCallback((params: { nodes: any[]; edges: any[] }) => {
    useCanvasStore.getState().onSelectionChange(params)
  }, [])
  
  const reconnecting = useCanvasStore(s => s.reconnecting)
  const completeReconnect = useCanvasStore(s => s.completeReconnect)
  const updateEdgeEndpoints = useCanvasStore(s => s.updateEdgeEndpoints)
  const { showToast } = useToast()
  
  const handleNodeClick = useCallback((_: any, node: any) => {
    if (reconnecting) {
      completeReconnect(node.id)
      showToast('Connector updated — press ⌘Z to undo.', 'success')
    }
  }, [reconnecting, completeReconnect, showToast])
  
  const handleEdgeUpdate = useCallback((oldEdge: any, newConnection: any) => {
    updateEdgeEndpoints(oldEdge.id, { 
      source: newConnection.source, 
      target: newConnection.target 
    })
    showToast('Connector updated — press ⌘Z to undo.', 'success')
  }, [updateEdgeEndpoints, showToast])
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [draggingNodeIds, setDraggingNodeIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [, setShowEmptyState] = useState(true)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  
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

  const handleNodeDragStart = useCallback((_: any, node: any) => {
    setIsDragging(true)
    setDraggingNodeIds(new Set([node.id]))
  }, [])

  const handleNodeDragStop = useCallback(() => {
    setIsDragging(false)
    setDraggingNodeIds(new Set())
  }, [])

  return (
    <div className="w-full h-full relative" data-testid="react-flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onSelectionChange={handleSelectionChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes as any}
        fitView
        snapToGrid={snapToGrid}
        snapGrid={snapGridValue}
        minZoom={0.2}
        maxZoom={4}
        defaultEdgeOptions={defaultEdgeOpts}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} gap={gridSize} size={1} color="#e5e7eb" />}
        <MiniMap nodeColor="#EA7B4B" style={miniMapStyle} />
        {showAlignmentGuides && <AlignmentGuides draggingNodeIds={draggingNodeIds} />}
        <CanvasToolbar />
      </ReactFlow>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />}
      <PropertiesPanel />
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      <EmptyStateOverlay onDismiss={() => setShowEmptyState(false)} />
      <KeyboardCheatsheet isOpen={showCheatsheet} onClose={() => setShowCheatsheet(false)} />
      <SettingsPanel />
      <DiagnosticsOverlay />
      <ReconnectBanner />
    </div>
  )
}

export default function ReactFlowGraph() {
  return (
    <CanvasErrorBoundary>
      <ToastProvider>
        <ReactFlowProvider>
          <ReactFlowGraphInner />
        </ReactFlowProvider>
      </ToastProvider>
    </CanvasErrorBoundary>
  )
}
