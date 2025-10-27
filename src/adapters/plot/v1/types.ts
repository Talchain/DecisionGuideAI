/**
 * PLoT v1 HTTP API types (internal transport layer)
 * These are the pure v1 types - not exposed to UI
 */

// Request types
export interface V1Node {
  id: string
  label?: string // max 120 chars
  body?: string // max 2000 chars
}

export interface V1Edge {
  from: string
  to: string
  confidence?: number // 0..1
  weight?: number
}

export interface V1Graph {
  nodes: V1Node[]
  edges: V1Edge[]
}

export interface V1RunRequest {
  graph: V1Graph
  seed?: number
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
  id?: string
  label?: string
  impact?: number
}

export interface V1RunResult {
  answer: string
  confidence: number // 0..1
  explanation: string
  drivers: V1Driver[]
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
  | 'progress'
  | 'interim'
  | 'heartbeat'
  | 'complete'
  | 'error'

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

// SSE handlers
export interface V1StreamHandlers {
  onStarted: (data: V1RunStartedData) => void
  onProgress: (data: V1ProgressData) => void
  onInterim: (data: V1InterimFindingsData) => void
  onComplete: (data: V1CompleteData) => void
  onError: (error: V1Error) => void
}
