// src/plot/adapters/PlcCanvasAdapter.tsx
// Mounts PLC canvas inside PoC shell (preserves rich UI, swaps canvas logic)

import React, { useCallback, useMemo, useState } from 'react'
import PlcCanvas from '../../plc/components/PlcCanvas'
import type { Node, Edge } from '../../plc/types'
import { nextId } from '../utils/id'

interface PlcCanvasAdapterProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
}

export default function PlcCanvasAdapter({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange
}: PlcCanvasAdapterProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  const localEdits = useMemo(
    () => ({ addedNodes: [] as Node[], renamedNodes: {}, addedEdges: [] as Edge[] }),
    []
  )

  const handleOp = useCallback(
    (op: any) => {
      if (!op) return

      if (op.type === 'add' && op.payload?.kind === 'node') {
        const newNodes = [...nodes, op.payload.node]
        setNodes(newNodes)
        onNodesChange?.(newNodes)
      } else if (op.type === 'batchMove' && op.payload?.deltas) {
        const deltas = op.payload.deltas as Record<string, { dx: number; dy: number }>
        const newNodes = nodes.map(n =>
          deltas[n.id] ? { ...n, x: n.x + deltas[n.id].dx, y: n.y + deltas[n.id].dy } : n
        )
        setNodes(newNodes)
        onNodesChange?.(newNodes)
      } else if (op.type === 'connect' && op.payload?.edge) {
        const newEdges = [...edges, op.payload.edge]
        setEdges(newEdges)
        onEdgesChange?.(newEdges)
      }
    },
    [nodes, edges, onNodesChange, onEdgesChange]
  )

  // Expose add node helper for PoC toolbar integration
  const addNode = useCallback(() => {
    const id = nextId(nodes)
    const col = nodes.length % 3
    const row = Math.floor(nodes.length / 3)
    const newNode: Node = {
      id,
      label: `Node ${id.slice(1)}`,
      x: 100 + col * 200,
      y: 80 + row * 120
    }
    handleOp({ type: 'add', payload: { kind: 'node', node: newNode } })
  }, [nodes, handleOp])

  // Expose to parent via ref or context if needed
  React.useImperativeHandle(
    React.useRef<any>(),
    () => ({ addNode }),
    [addNode]
  )

  return (
    <div data-testid="plc-canvas-adapter" className="w-full h-full">
      <PlcCanvas
        nodes={nodes}
        edges={edges}
        localEdits={localEdits}
        onOp={handleOp}
        snap={{ enabled: false, grid: 10, tol: 6 }}
        guides={{ enabled: false, tol: 6, snapToGuide: false }}
      />
    </div>
  )
}
