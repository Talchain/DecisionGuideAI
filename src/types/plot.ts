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
      node_label?: string  // API v1 uses this instead of label
      kind?: 'node' | 'edge'
      node_id?: string
      edge_id?: string
      impact?: number
      contribution?: number  // API v1 uses this instead of impact
      sign?: '+' | '-'  // API v1 uses this with contribution
    }>
  }
  confidence?: number
  explanation?: string
  response_hash?: string

  // P0 Trust Signal Fields (Sprint N)
  decision_readiness?: DecisionReadiness
  insights?: Insights
  graph_quality?: GraphQuality
}

// ============================================================================
// P0 Trust Signal Types (Sprint N)
// ============================================================================

/**
 * Decision Readiness - Primary go/no-go signal
 * Shows whether the model is ready for decision-making
 */
export interface DecisionReadiness {
  ready: boolean
  confidence: 'high' | 'medium' | 'low'
  blockers: string[]   // Hard gates - must fix
  warnings: string[]   // Advisory - should review
  passed: string[]     // Checks that passed
}

/**
 * Insights - Summary, risks, and next steps
 * Plain-English takeaway from the analysis
 */
export interface Insights {
  summary: string        // ≤200 chars, plain English
  risks: string[]        // Max 5 items
  next_steps: string[]   // Max 3 items
}

/**
 * Graph Quality - Engine's assessment of model quality
 * NOTE: This is different from local `graphHealth` (structural health)
 * This is the engine's assessment of completeness, coverage, and balance
 */
export interface GraphQuality {
  score: number              // 0.00–1.00
  completeness: number       // 0.00–1.00
  evidence_coverage: number  // 0.00–1.00
  balance: number            // 0.00–1.00
  issues_count?: number
  recommendation?: string
}
