import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Connection,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import DecisionNode from './nodes/DecisionNode'
import { useCanvasStore } from './store'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'

const nodeTypes = {
  decision: DecisionNode,
}

export default function ReactFlowGraph() {
  // Use Zustand store
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const onNodesChange = useCanvasStore((state) => state.onNodesChange)
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange)
  const addNode = useCanvasStore((state) => state.addNode)
  const reset = useCanvasStore((state) => state.reset)
  const undo = useCanvasStore((state) => state.undo)
  const redo = useCanvasStore((state) => state.redo)
  const canUndo = useCanvasStore((state) => state.canUndo)
  const canRedo = useCanvasStore((state) => state.canRedo)

  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  const [nodeId, setNodeId] = useState(5)

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        id: `e${connection.source}-${connection.target}`,
        ...connection
      }
      useCanvasStore.getState().addEdge(newEdge)
    },
    []
  )

  const handleAddNode = useCallback(() => {
    const newNode = {
      id: String(nodeId),
      type: 'decision',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { label: `Node ${nodeId}` }
    }
    addNode(newNode)
    setNodeId(nodeId + 1)
  }, [nodeId, addNode])


  return (
    <div className="w-full h-full" data-testid="react-flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap
          nodeColor="#EA7B4B"
          maskColor="rgba(0, 0, 0, 0.1)"
          position="bottom-left"
          style={{ width: 120, height: 80 }}
        />
        <Panel position="top-left" className="flex flex-col gap-2">
          <button
            onClick={handleAddNode}
            className="px-3 py-2 bg-[#EA7B4B] hover:bg-[#d86a3e] text-white text-sm rounded-lg shadow-md transition-colors"
            aria-label="Add Node"
          >
            + Node
          </button>
          <button
            onClick={reset}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg shadow-md transition-colors"
            aria-label="Reset Demo"
          >
            Reset
          </button>
          <button
            onClick={undo}
            disabled={!canUndo()}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Undo"
            title="Cmd/Ctrl+Z"
          >
            ↶ Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Redo"
            title="Cmd/Ctrl+Shift+Z"
          >
            ↷ Redo
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
