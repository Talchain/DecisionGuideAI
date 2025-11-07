// Blueprint types for template starter flows

export type NodeKind = 'decision' | 'event' | 'outcome' | 'goal' | 'option' | 'risk'

export interface BlueprintNode {
  id: string
  label: string
  kind: NodeKind
  body?: string // v1.2: optional rich description
  position?: { x: number; y: number }
}

export interface BlueprintEdge {
  id: string
  from: string
  to: string
  probability?: number  // legacy field, maps to belief for v1.2
  weight?: number
  belief?: number       // v1.2: epistemic confidence (0-1)
  provenance?: 'template' | 'user' | 'inferred'  // v1.2: source tracking
}

export type Units = 'currency' | 'percent' | 'count' | 'days' | 'score'

export interface Blueprint {
  id: string
  name: string
  description: string
  longDescription?: string
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
  units?: Units
  defaults?: Record<string, number | string>
  expectedInputs?: string[]
  assumptions?: string[]
}

export interface TemplateMeta {
  id: string
  name: string
  description: string
  category?: string
}
