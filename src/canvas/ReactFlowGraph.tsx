import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

interface ReactFlowGraphProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
}

export default function ReactFlowGraph({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
}: ReactFlowGraphProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges]
  )

  // Notify parent of changes
  const wrappedNodesChange = useCallback(
    (changes: any) => {
      handleNodesChange(changes)
      if (onNodesChange) {
        onNodesChange(nodes)
      }
    },
    [handleNodesChange, onNodesChange, nodes]
  )

  const wrappedEdgesChange = useCallback(
    (changes: any) => {
      handleEdgesChange(changes)
      if (onEdgesChange) {
        onEdgesChange(edges)
      }
    },
    [handleEdgesChange, onEdgesChange, edges]
  )

  return (
    <div className="w-full h-full" data-testid="react-flow-graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={wrappedNodesChange}
        onEdgesChange={wrappedEdgesChange}
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
      </ReactFlow>
    </div>
  )
}
