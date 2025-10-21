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
import { useLayoutStore } from './layoutStore'
import { CanvasErrorBoundary } from './ErrorBoundary'
import { ToastProvider } from './ToastContext'
import { DiagnosticsOverlay } from './DiagnosticsOverlay'

// nodeTypes imported from registry

function ReactFlowGraphInner() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  // Note: Do NOT extract store callbacks (onNodesChange, onEdgesChange, etc.)
  // They return new references each render, causing infinite loops.
  // Instead, create stable handlers with useCallback([]) that call getState().
  
  // Stable selection handler
  const handleSelectionChange = useCallback((params: { nodes: any[]; edges: any[] }) => {
    useCanvasStore.getState().onSelectionChange(params)
  }, [])
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [draggingNodeIds, setDraggingNodeIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [, setShowEmptyState] = useState(true)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  
  const { showGrid, gridSize, snapToGrid, showAlignmentGuides, loadSettings } = useSettingsStore()

  // Memoize ReactFlow props to prevent new objects/arrays on every render
  // (which causes infinite loop in ReactFlow's internal StoreUpdater)
  const snapGridValue = useMemo<[number, number]>(() => [gridSize, gridSize], [gridSize])
  
  const edgeTypes = useMemo(() => ({ styled: StyledEdge as any }), [])
  
  const defaultEdgeOpts = useMemo(() => ({
    type: 'styled' as const,
    animated: false,
  }), [])
  
  const miniMapStyle = useMemo(() => ({ width: 120, height: 80 }), [])

  // Dev-only render-storm sentinel (tree-shaken in production)
  if (import.meta.env.DEV) {
    const renderTimes = useRef<number[]>([])
    useEffect(() => {
      const now = Date.now()
      renderTimes.current.push(now)
      renderTimes.current = renderTimes.current.filter(t => now - t < 1000)
      if (renderTimes.current.length > 50 && !(window as any).__rfStormLogged) {
        (window as any).__rfStormLogged = true
        console.warn('[Canvas] Render burst detected. Check change handlers & history debounce.')
      }
    })
  }

  useKeyboardShortcuts()
  
  // Load settings and layout options on mount
  useEffect(() => {
    loadSettings()
    useLayoutStore.getState().loadOptions()
  }, [loadSettings])

  // Keyboard shortcuts (⌘K for palette, ? for cheatsheet)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey
      
      // Ignore if typing in input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
      
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault()
        setShowCheatsheet(true)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadState()
    if (saved) {
      useCanvasStore.getState().reseedIds(saved.nodes, saved.edges)
      useCanvasStore.setState({ nodes: saved.nodes, edges: saved.edges })
      const msg = document.createElement('div')
      msg.setAttribute('role', 'status')
      msg.setAttribute('aria-live', 'polite')
      msg.className = 'sr-only'
      msg.textContent = 'Canvas restored'
      document.body.appendChild(msg)
      setTimeout(() => msg.remove(), 1000)
    }
  }, [])

  // Debounced autosave (2s after changes settle)
  // Note: waitForTimeout exception - this is legitimate debounced persistence
  useEffect(() => {
    const timer = setTimeout(() => saveState({ nodes, edges }), 2000)
    return () => clearTimeout(timer)
  }, [nodes, edges])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => useCanvasStore.getState().cleanup()
  }, [])

  const onConnect = useCallback((conn: Connection) => {
    useCanvasStore.getState().addEdge({ source: conn.source!, target: conn.target!, data: DEFAULT_EDGE_DATA })
  }, [])

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  // Stable nodes change handler (keeps alignment guide logic)
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const dragChanges = changes.filter(c => c.type === 'position')
    
    if (dragChanges.length > 0) {
      const dragging = dragChanges.some((c: any) => c.dragging === true)
      setIsDragging(dragging)
      
      if (dragging) {
        const dragIds = new Set(dragChanges.map(c => c.id))
        setDraggingNodeIds(dragIds)
      } else {
        setDraggingNodeIds(new Set())
      }
    }

    // Call store via getState() to avoid unstable dependency
    useCanvasStore.getState().onNodesChange(changes)
  }, [])

  // Stable edges change handler
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    useCanvasStore.getState().onEdgesChange(changes)
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes as any}
        fitView
        snapToGrid={snapToGrid}
        snapGrid={snapGridValue}
        minZoom={0.2}
        maxZoom={4}
        defaultEdgeOptions={defaultEdgeOpts}
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} gap={gridSize} size={1} color="#e5e7eb" />}
        <MiniMap 
          nodeColor="#EA7B4B" 
          position="bottom-left" 
          style={miniMapStyle}
          className="rounded-lg shadow-lg"
          aria-label="Mini map"
        />
        
        {showAlignmentGuides && <AlignmentGuides 
          nodes={nodes}
          draggingNodeIds={draggingNodeIds}
          isActive={isDragging}
        />}
        
        <CanvasToolbar />
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

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

// Add after line 37 (after handleSelectionChange):
const reconnecting = useCanvasStore(s => s.reconnecting)
const completeReconnect = useCanvasStore(s => s.completeReconnect)
const updateEdgeEndpoints = useCanvasStore(s => s.updateEdgeEndpoints)

const handleNodeClick = useCallback((_: any, node: any) => {
  if (reconnecting) {
    completeReconnect(node.id)
  }
}, [reconnecting, completeReconnect])

const handleEdgeUpdate = useCallback((oldEdge: any, newConnection: any) => {
  updateEdgeEndpoints(oldEdge.id, { 
    source: newConnection.source, 
    target: newConnection.target 
  })
}, [updateEdgeEndpoints])
