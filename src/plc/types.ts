// src/plc/types.ts
export interface Node {
  id: string
  label: string
  x?: number
  y?: number
}

export interface Edge {
  from: string
  to: string
  label?: string
}

export interface LocalEdits {
  addedNodes: Node[]
  renamedNodes: Record<string, string>
  addedEdges: Edge[]
}
