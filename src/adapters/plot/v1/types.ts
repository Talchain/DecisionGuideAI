/**
 * PLoT v1 HTTP API types (internal transport layer)
 * These are the pure v1 types - not exposed to UI
 */

// Request types
export interface V1Node {
  id: string
  label?: string // max 120 chars
  body?: string // max 2000 chars
  kind?: 'decision' | 'option' | 'outcome' // v1.2: node classification
  prior?: number // v1.2: 0..1 probability
  utility?: number // v1.2: -1..+1 relative payoff
}

export interface V1Edge {
  from: string
  to: string
  confidence?: number // 0..1
  weight?: number     // Visual weight or normalized (backend-specific)
  belief?: number     // v1.2: 0..1 epistemic uncertainty
  provenance?: string // v1.2: ≤100 chars source/rationale ("template" for defaults)
  id?: string         // v1.2: stable server-assigned ID
}

export interface V1Graph {
  nodes: V1Node[]
  edges: V1Edge[]
  version?: '1.2' // v1.2: schema version marker
  meta?: {
    suggested_positions?: Record<string, { x: number; y: number }> // v1.2: initial layout hints
    [key: string]: unknown
  }
}

export interface V1RunRequest {
  graph: V1Graph
  seed?: number
  outcome_node?: string  // Target outcome node for analysis
  include_debug?: boolean  // Include debug metadata in response
  idempotencyKey?: string
  clientHash?: string
}

// Response types
export interface V1HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  timestamp: string
  version?: string
  uptime_ms?: number
}

export interface V1Driver {
  kind: 'node' | 'edge'
  node_id?: string // Node ID for canvas highlighting
  edge_id?: string // Edge ID for canvas highlighting
  label?: string
  impact?: number
}

export interface V1Summary {
  conservative: number
  likely: number
  optimistic: number
  units?: string
}

export interface V1ExplainDelta {
  top_drivers: V1Driver[]
}

export interface V1RunResult {
  answer: string
  confidence: number // 0..1
  explanation: string
  summary?: V1Summary // Structured result values
  explain_delta?: V1ExplainDelta // Drivers nested here in actual API
  response_hash?: string
  seed?: number
}

export interface V1SyncRunResponse {
  result: V1RunResult
  execution_ms: number
}

// SSE event types (lowercase per v1 spec)
export type V1EventType =
  | 'started'
  | 'RUN_STARTED'  // v1.2: new event name (alias for 'started')
  | 'progress'
  | 'interim'
  | 'heartbeat'
  | 'complete'
  | 'COMPLETE'     // v1.2: new event name (alias for 'complete')
  | 'error'
  | 'ERROR'        // v1.2: new event name (alias for 'error')
  | 'CANCELLED'    // v1.2: explicit cancellation event

export interface V1RunStartedData {
  run_id: string
}

export interface V1ProgressData {
  percent: number // 0-100
  message?: string
}

export interface V1InterimFindingsData {
  findings: string[]
}

export interface V1CompleteData {
  result: V1RunResult
  execution_ms: number
}

export interface V1ErrorData {
  code: string
  message: string
  details?: unknown
}

// Error types
export type V1ErrorCode =
  | 'BAD_INPUT'
  | 'RATE_LIMITED'
  | 'LIMIT_EXCEEDED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'

export interface V1Error {
  code: V1ErrorCode
  message: string
  field?: string
  max?: number
  retry_after?: number
  details?: unknown
}

// Limits
export const V1_LIMITS = {
  MAX_NODES: 200,
  MAX_EDGES: 500,
  MAX_LABEL_LENGTH: 120,
  MAX_BODY_LENGTH: 2000,
  RATE_LIMIT_RPM: 60,
} as const

// v1.2: Extended limits response
export interface V1LimitsResponse {
  nodes: { max: number }
  edges: { max: number }
  engine_p95_ms_budget?: number // v1.2: p95 execution time budget in milliseconds
}

// SSE handlers
export interface V1StreamHandlers {
  onStarted: (data: V1RunStartedData) => void
  onProgress: (data: V1ProgressData) => void
  onInterim: (data: V1InterimFindingsData) => void
  onComplete: (data: V1CompleteData) => void
  onError: (error: V1Error) => void
}

// Template types (actual v1 API format)
export interface V1TemplateSummary {
  id: string
  label: string // Display name
  summary: string // Short description
  updated_at: string // ISO timestamp
}

// v1 API returns bare array, not wrapped object
export type V1TemplateListResponse = V1TemplateSummary[]

export interface V1TemplateGraphResponse {
  template_id: string
  default_seed: number
  graph: V1Graph
  version?: '1.2' // v1.2: template schema version
}

// Validation types
export interface V1ValidationError {
  code: string
  message: string
  node_id?: string
  edge_id?: string
  severity: 'error' | 'warning'
  suggestion?: string // v1.2: coaching hint for non-blocking violations
}

export interface V1ValidateRequest {
  graph: V1Graph
}

export interface V1ValidateResponse {
  valid: boolean
  errors: V1ValidationError[] // Hard errors (block execution)
  violations?: V1ValidationError[] // v1.2: soft coaching warnings (non-blocking)
}
