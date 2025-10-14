// src/plot/adapters/PlcCanvasAdapter.tsx
import { useCallback } from 'react'
import PlcCanvas from '../../plc/components/PlcCanvas'

export function PlcCanvasAdapter({ nodes, edges, localEdits, onNodesChange, onEdgesChange }: any) {
  const handleOp = useCallback((op: any) => {
    if (!op) return
    if (op.type === 'add' && op.payload?.node) {
      onNodesChange?.([...nodes, op.payload.node])
    } else if (op.type === 'batchMove' && op.payload?.deltas) {
      const deltas = op.payload.deltas
      onNodesChange?.(nodes.map((n: any) => 
        deltas[n.id] ? { ...n, x: (n.x || 0) + deltas[n.id].dx, y: (n.y || 0) + deltas[n.id].dy } : n
      ))
    } else if (op.type === 'connect' && op.payload?.edge) {
      onEdgesChange?.([...edges, op.payload.edge])
    }
  }, [nodes, edges, onNodesChange, onEdgesChange])

  return (
    <div 
      data-testid="plc-canvas-adapter"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <PlcCanvas
        nodes={nodes}
        edges={edges}
        localEdits={localEdits}
        onOp={handleOp}
        snap={{ enabled: false, grid: 20, tol: 10 }}
        guides={{ enabled: false, tol: 5, snapToGuide: false }}
      />
    </div>
  )
}
