export type NodeType = 'Decision' | 'Option' | 'Problem' | 'Action' | 'Outcome'
export type EdgeKind = 'causes' | 'mitigates' | 'supports' | 'impactsKR'

export interface KrImpact { krId: string; deltaP50: number; confidence: number }

export interface Node {
  id: string
  type: NodeType
  title: string
  notes?: string
  krImpacts?: KrImpact[]
  view?: { x?: number; y?: number; w?: number; h?: number }
  meta?: { generated?: boolean }
}

export interface Edge {
  id: string
  from: string
  to: string
  kind: EdgeKind
  notes?: string
  meta?: { generated?: boolean }
}

export interface Graph {
  schemaVersion: 1
  nodes: Record<string, Node>
  edges: Record<string, Edge>
}

export const SCHEMA_VERSION: 1 = 1

export function clampKrImpact(k: KrImpact): KrImpact {
  const delta = Math.max(-1, Math.min(1, Number.isFinite(k.deltaP50 as number) ? k.deltaP50 : 0))
  const conf = Math.max(0, Math.min(1, Number.isFinite(k.confidence as number) ? k.confidence : 0))
  return { krId: k.krId, deltaP50: delta, confidence: conf }
}

export function normalizeNode(n: Node): Node {
  const out: Node = { ...n }
  if (out.krImpacts && Array.isArray(out.krImpacts)) {
    out.krImpacts = out.krImpacts.map(clampKrImpact)
  }
  if (out.view) {
    const v = out.view
    out.view = {
      x: Number.isFinite(v.x as number) ? (v.x as number) : undefined,
      y: Number.isFinite(v.y as number) ? (v.y as number) : undefined,
      w: Number.isFinite(v.w as number) ? (v.w as number) : undefined,
      h: Number.isFinite(v.h as number) ? (v.h as number) : undefined,
    }
  }
  return out
}

export function emptyGraph(): Graph {
  return { schemaVersion: SCHEMA_VERSION, nodes: {}, edges: {} }
}
