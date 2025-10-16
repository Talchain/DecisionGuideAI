import { useCallback, useEffect, useState } from 'react'
import { ReactFlow, Background, MiniMap, Connection, BackgroundVariant, ReactFlowProvider, NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import DecisionNode from './nodes/DecisionNode'
import { useCanvasStore } from './store'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { loadState, saveState } from './persist'
import { ContextMenu } from './ContextMenu'
import { CanvasToolbar } from './CanvasToolbar'
import { AlignmentGuides } from './components/AlignmentGuides'

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

  useKeyboardShortcuts()

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
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.2}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { strokeWidth: 2 }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
        <MiniMap 
          nodeColor="#EA7B4B" 
          position="bottom-left" 
          style={{ width: 120, height: 80 }} 
          className="rounded-lg shadow-lg"
          aria-label="Mini map"
        />
        
        <AlignmentGuides 
          nodes={nodes}
          draggingNodeIds={draggingNodeIds}
          isActive={isDragging}
        />
        
        <CanvasToolbar />
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

export default function ReactFlowGraph() {
  return (
    <ReactFlowProvider>
      <ReactFlowGraphInner />
    </ReactFlowProvider>
  )
}
