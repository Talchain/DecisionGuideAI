/**
 * M6: Compare v0 Types
 * Scenario snapshots and comparison
 */

import type { Node, Edge } from '@xyflow/react'

export interface Snapshot {
  id: string
  name: string
  description?: string
  createdAt: Date
  nodes: Node[]
  edges: Edge[]
  metadata?: {
    author?: string
    tags?: string[]
    version?: number
  }
}

export interface ComparisonResult {
  added: { nodes: Node[]; edges: Edge[] }
  removed: { nodes: Node[]; edges: Edge[] }
  modified: { nodes: Node[]; edges: Edge[] }
  unchanged: { nodes: Node[]; edges: Edge[] }
}

export interface DecisionRationale {
  id: string
  snapshotId: string
  title: string
  reasoning: string
  pros: string[]
  cons: string[]
  alternatives?: string[]
  decision: 'approved' | 'rejected' | 'pending'
  decidedBy?: string
  decidedAt?: Date
}
