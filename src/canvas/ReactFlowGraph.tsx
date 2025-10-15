import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import DecisionNode from './nodes/DecisionNode'

const nodeTypes = {
  decision: DecisionNode,
}

const initialDemoNodes: Node[] = [
  {
    id: '1',
    type: 'decision',
    position: { x: 250, y: 100 },
    data: { label: 'Start' }
  },
  {
    id: '2',
    type: 'decision',
    position: { x: 100, y: 250 },
    data: { label: 'Option A' }
  },
  {
    id: '3',
    type: 'decision',
    position: { x: 400, y: 250 },
    data: { label: 'Option B' }
  },
  {
    id: '4',
    type: 'decision',
    position: { x: 250, y: 400 },
    data: { label: 'Outcome' }
  }
]

const initialDemoEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'Path A' },
  { id: 'e1-3', source: '1', target: '3', label: 'Path B' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e3-4', source: '3', target: '4' }
]

interface ReactFlowGraphProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
}

export default function ReactFlowGraph({
  initialNodes = initialDemoNodes,
  initialEdges = initialDemoEdges,
}: ReactFlowGraphProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges)
  const [nodeId, setNodeId] = useState(5)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges]
  )

  const handleAddNode = useCallback(() => {
    const newNode: Node = {
      id: String(nodeId),
      type: 'decision',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { label: `Node ${nodeId}` }
    }
    setNodes((nds) => [...nds, newNode])
    setNodeId(nodeId + 1)
  }, [nodeId, setNodes])

  const handleReset = useCallback(() => {
    setNodes(initialDemoNodes)
    setEdges(initialDemoEdges)
    setNodeId(5)
  }, [setNodes, setEdges])


  return (
    <div className="w-full h-full" data-testid="react-flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
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
            onClick={handleReset}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg shadow-md transition-colors"
            aria-label="Reset Demo"
          >
            Reset
          </button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
