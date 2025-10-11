// src/plc/components/PlcCanvas.tsx
import { useMemo } from 'react'
import type { LocalEdits, Node, Edge } from '../types'
import GraphCanvasPlc from './GraphCanvasPlc'

export default function PlcCanvas({
  nodes,
  edges,
  localEdits,
  onOp,
  snap,
  guides,
}: {
  nodes: Node[]
  edges: Edge[]
  localEdits: LocalEdits
  onOp?: (op: any) => void
  snap?: { enabled: boolean; grid: number; tol: number }
  guides?: { enabled: boolean; tol: number; snapToGuide: boolean }
}) {
  const stableEdits = useMemo(() => localEdits, [localEdits])
  return (
    <GraphCanvasPlc
      nodes={nodes}
      edges={edges}
      localEdits={stableEdits}
      onOp={onOp}
      snap={snap}
      guides={guides}
    />
  )
}
