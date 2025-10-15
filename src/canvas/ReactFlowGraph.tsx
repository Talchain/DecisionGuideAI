import { useCallback, useEffect } from 'react'
import { ReactFlow, Background, Controls, MiniMap, Panel, Connection, BackgroundVariant } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import DecisionNode from './nodes/DecisionNode'
import { useCanvasStore } from './store'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { loadState, saveState } from './persist'

const nodeTypes = { decision: DecisionNode }

export default function ReactFlowGraph() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const onNodesChange = useCanvasStore(s => s.onNodesChange)
  const onEdgesChange = useCanvasStore(s => s.onEdgesChange)
  const onSelectionChange = useCanvasStore(s => s.onSelectionChange)
  const addNode = useCanvasStore(s => s.addNode)
  const reset = useCanvasStore(s => s.reset)
  const undo = useCanvasStore(s => s.undo)
  const redo = useCanvasStore(s => s.redo)
  const canUndo = useCanvasStore(s => s.canUndo)
  const canRedo = useCanvasStore(s => s.canRedo)

  useKeyboardShortcuts()

  useEffect(() => {
    const saved = loadState()
    if (saved) {
      useCanvasStore.setState({ nodes: saved.nodes, edges: saved.edges })
      const msg = document.createElement('div')
      msg.setAttribute('role', 'status')
      msg.setAttribute('aria-live', 'polite')
      msg.className = 'sr-only'
      msg.textContent = 'Restored'
      document.body.appendChild(msg)
      setTimeout(() => msg.remove(), 1000)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => saveState({ nodes, edges }), 2000)
    return () => clearInterval(timer)
  }, [nodes, edges])

  const onConnect = useCallback((conn: Connection) => {
    useCanvasStore.getState().addEdge({ id: `e${conn.source}-${conn.target}`, ...conn })
  }, [])

  return (
    <div className="w-full h-full" data-testid="react-flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
        <Controls position="bottom-right" />
        <MiniMap nodeColor="#EA7B4B" position="bottom-left" style={{ width: 120, height: 80 }} />
        <Panel position="top-left" className="flex flex-col gap-2">
          <button onClick={() => addNode()} className="px-3 py-2 bg-[#EA7B4B] text-white text-sm rounded-lg">+ Node</button>
          <button onClick={reset} className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg">Reset</button>
          <button onClick={undo} disabled={!canUndo()} className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg disabled:opacity-50">↶ Undo</button>
          <button onClick={redo} disabled={!canRedo()} className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg disabled:opacity-50">↷ Redo</button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
