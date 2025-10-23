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
  }>
  critique?: string[]
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
}

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
  mode?: 'strict' | 'real'
  inputs?: Record<string, unknown>
}

export type StreamEvent =
  | { type: 'hello'; data: { response_id: string } }
  | { type: 'tick'; data: { index: number } }
  | { type: 'reconnected'; data: { attempt: number } }
  | { type: 'done'; data: { response_id: string } }
  | { type: 'error'; data: ErrorV1 }
