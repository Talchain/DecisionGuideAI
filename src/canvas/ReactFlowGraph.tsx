import { useCallback, useEffect, useState } from 'react'
import { ReactFlow, ReactFlowProvider, Controls, MiniMap, Background, BackgroundVariant, useReactFlow, type Connection, type NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import DecisionNode from './nodes/DecisionNode'
import { useCanvasStore } from './store'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { loadState, saveState } from './persist'
import { ContextMenu } from './ContextMenu'
import { CanvasToolbar } from './CanvasToolbar'
import { AlignmentGuides } from './components/AlignmentGuides'
import { PropertiesPanel } from './components/PropertiesPanel'
import { CommandPalette } from './components/CommandPalette'
import { EmptyStateOverlay } from './components/EmptyStateOverlay'
import { KeyboardCheatsheet } from './components/KeyboardCheatsheet'
import { SettingsPanel } from './components/SettingsPanel'
import { useSettingsStore } from './settingsStore'
import { CanvasErrorBoundary } from './ErrorBoundary'
import { ToastProvider } from './ToastContext'

const nodeTypes = { decision: DecisionNode }

function ReactFlowGraphInner() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const onNodesChange = useCanvasStore(s => s.onNodesChange)
  const onEdgesChange = useCanvasStore(s => s.onEdgesChange)
  const onSelectionChange = useCanvasStore(s => s.onSelectionChange)
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [draggingNodeIds, setDraggingNodeIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showEmptyState, setShowEmptyState] = useState(true)
  const [showCheatsheet, setShowCheatsheet] = useState(false)
  
  const { showGrid, gridSize, snapToGrid, showAlignmentGuides, loadSettings } = useSettingsStore()

  useKeyboardShortcuts()
  
  // Load settings and layout options on mount
  useEffect(() => {
    loadSettings()
    const { useLayoutStore } = require('./layoutStore')
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
    useCanvasStore.getState().addEdge({ source: conn.source!, target: conn.target! })
  }, [])

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  // Track dragging state for alignment guides
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

    onNodesChange(changes)
  }, [onNodesChange])

  return (
    <div className="w-full h-full relative" data-testid="react-flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        minZoom={0.2}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 2 }
        }}
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} gap={gridSize} size={1} color="#e5e7eb" />}
        <MiniMap 
          nodeColor="#EA7B4B" 
          position="bottom-left" 
          style={{ width: 120, height: 80 }} 
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
