// src/modules/results/types.ts
export interface ReportV1 {
  schema: 'report.v1'
  meta: {
    seed: number
    trace_id?: string
  }
  summary: {
    bands: {
      p10: number
      p50: number
      p90: number
    }
  }
  confidence: 'low' | 'medium' | 'high'
  confidence_stability?: {
    action_consistency: number
    sign_flip_rate: number
  }
}

export interface RateLimitError {
  error: string
  message: string
  headers: {
    'Retry-After': string
    'X-RateLimit-Reset'?: string
    'X-RateLimit-Reason'?: string
  }
}
