/**
 * PLoT Graph Type Definitions
 *
 * CRITICAL: Keep UI and API shapes strictly separated.
 * - UI shape: React Flow format (nodes with id/type/data, edges with id/source/target/data)
 * - API shape: PLoT v1 format (nodes with id/label, edges with from/to/label/weight)
 *
 * Never send UI shape to API. Use mapper.ts to convert.
 */

// ============================================================================
// UI Types (React Flow)
// ============================================================================

export interface UiNode {
  id: string
  label?: string
  type?: string
  data?: {
    label?: string
    [key: string]: any
  }
}

export interface UiEdge {
  id: string
  source: string
  target: string
  data?: {
    label?: string
    weight?: number
    confidence?: number
    [key: string]: any
  }
}

export interface UiGraph {
  nodes: UiNode[]
  edges: UiEdge[]
}

// ============================================================================
// API Types (PLoT v1)
// ============================================================================

export interface ApiNode {
  id: string
  label?: string
}

export interface ApiEdge {
  from: string
  to: string
  label?: string
  weight?: number
}

export interface ApiGraph {
  nodes: ApiNode[]
  edges: ApiEdge[]
}

// ============================================================================
// Run Request/Response
// ============================================================================

export interface RunRequest {
  graph: ApiGraph
  seed?: number
  k_samples?: number
  treatment_node?: string
  outcome_node?: string
  baseline_value?: number
}

export interface RunResponse {
  model_card?: {
    seed?: number
    response_hash?: string
  }
  meta?: {
    seed?: number
  }
  results?: {
    conservative?: number
    most_likely?: number // Some API versions use this
    likely?: number // v1 API uses this
    optimistic?: number
    units?: string
    summary?: {
      conservative?: number
      likely?: number
      optimistic?: number
      units?: string
    }
  }
  result?: {
    summary?: {
      conservative?: number
      likely?: number
      optimistic?: number
      units?: string
    }
  }
  explain_delta?: {
    top_drivers?: Array<{
      label?: string
      kind?: 'node' | 'edge'
      node_id?: string
      edge_id?: string
      impact?: number
    }>
  }
  confidence?: number
  explanation?: string
  response_hash?: string
}
