export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface ReportV1 {
  schema: 'report.v1'
  meta: {
    seed: number
    response_id: string
    elapsed_ms: number
  }
  model_card: {
    response_hash: string
    response_hash_algo: 'sha256'
    normalized: true
  }
  results: {
    conservative: number
    likely: number
    optimistic: number
    units?: 'currency' | 'percent' | 'count'
    unitSymbol?: string
  }
  confidence: {
    level: ConfidenceLevel
    why: string
  }
  drivers: Array<{
    label: string
    polarity: 'up' | 'down' | 'neutral'
    strength: 'low' | 'medium' | 'high'
    action?: string
    node_id?: string // For canvas highlighting
    edge_id?: string // For canvas highlighting
  }>
  critique?: string[]
  run?: CanonicalRun // v1.2: normalized run data with p10/p50/p90 bands
}

export interface ErrorV1 {
  schema: 'error.v1'
  code: 'BAD_INPUT' | 'LIMIT_EXCEEDED' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'SERVER_ERROR'
  error: string
  hint?: string
  fields?: {
    field?: 'graph.nodes' | 'graph.edges' | string
    max?: number
  }
  retry_after?: number
}

export interface LimitsV1 {
  nodes: { max: number }
  edges: { max: number }
  engine_p95_ms_budget?: number // v1.2: p95 execution time budget in milliseconds
}

/**
 * Limits fetch result (Sprint 1 & 2 Finalisation)
 * Exposes source tracking to prevent silent fallback masking
 */
export type LimitsFetch =
  | { ok: true; source: 'live'; data: LimitsV1; fetchedAt: number }
  | { ok: true; source: 'fallback'; data: LimitsV1; fetchedAt: number; reason: string }
  | { ok: false; error: Error; fetchedAt: number }

export interface TemplateSummary {
  id: string
  name: string
  version: string
  description: string
}

export interface TemplateDetail extends TemplateSummary {
  default_seed: number
  graph: unknown
}

export interface TemplateListV1 {
  items: TemplateSummary[]
}

export interface RunRequest {
  template_id: string
  seed?: number
  outcome_node?: string  // Target outcome node for analysis
  include_debug?: boolean  // Include debug metadata in response
  mode?: 'strict' | 'real'
  inputs?: Record<string, unknown>
  graph?: {
    nodes: Array<{ id: string; data?: { label?: string; body?: string; [key: string]: unknown }; [key: string]: unknown }>
    edges: Array<{ id: string; source: string; target: string; data?: { confidence?: number; weight?: number; [key: string]: unknown }; [key: string]: unknown }>
  } // Optional: if provided, use this graph instead of fetching template
}

export type StreamEvent =
  | { type: 'hello'; data: { response_id: string } }
  | { type: 'tick'; data: { index: number } }
  | { type: 'reconnected'; data: { attempt: number } }
  | { type: 'done'; data: { response_id: string } }
  | { type: 'error'; data: ErrorV1 }

/**
 * Canonical run result structure for v1.2
 * Normalizes both legacy and v1.2 response formats
 */
export type CanonicalRun = {
  responseHash: string
  bands: { p10: number | null; p50: number | null; p90: number | null }
  confidence?: { level?: string; reason?: string; score?: number }
  critique?: Array<{ severity: 'INFO' | 'WARNING' | 'BLOCKER'; message: string }>
}
