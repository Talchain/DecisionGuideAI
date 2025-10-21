/**
 * PLoT API Client - Phase A: Sync /v1/run
 */

export type NodeKind = 'goal' | 'decision' | 'option' | 'risk' | 'outcome'
export type BeliefMode = 'strict' | 'as_provided'
export type ConfidenceLevel = 'low' | 'medium' | 'high'

export type Graph = {
  goalNodeId: string
  nodes: { id: string; kind: NodeKind; label: string }[]
  edges: { id: string; source: string; target: string; weight: number; belief: number }[]
}

export type RunRequest = {
  template_id?: string
  seed: number
  belief_mode?: BeliefMode
  graph: Graph
}

export type RunResponse = {
  schema: 'report.v1'
  meta: { seed: number; elapsed_ms: number; response_id: string; template_id?: string }
  summary: {
    bands: { p10: number; p50: number; p90: number }
    confidence: { level: ConfidenceLevel; score: number; reason?: string }
  }
  critique: { type: string; text: string }[]
  model_card: { response_hash: string; response_hash_algo: 'sha256'; normalized: boolean; determinism_note?: string }
}

export type ApiLimits = { max_nodes: number; max_edges: number }
export type ApiError = { code: string; message: string; field?: string; max?: number; retry_after?: number }

const API_BASE = import.meta.env.VITE_PLOT_API_BASE_URL || 'https://plot-api.example.com'
const DEFAULT_LIMITS: ApiLimits = { max_nodes: 12, max_edges: 20 }

let cachedLimits: ApiLimits | null = null
let limitsETag: string | null = null

const redactToken = (token: string) => token.slice(0, 8) + '...'

export async function fetchLimits(token: string): Promise<ApiLimits> {
  const headers: HeadersInit = { 'Authorization': `Bearer ${token}` }
  if (limitsETag) headers['If-None-Match'] = limitsETag
  
  try {
    const res = await fetch(`${API_BASE}/v1/limits`, { headers })
    if (res.status === 304 && cachedLimits) return cachedLimits
    if (!res.ok) return DEFAULT_LIMITS
    
    const newETag = res.headers.get('ETag')
    if (newETag) limitsETag = newETag
    
    cachedLimits = await res.json()
    return cachedLimits!
  } catch (err) {
    console.warn('[plotApi] Limits fetch failed:', redactToken(token), err)
    return DEFAULT_LIMITS
  }
}

export function validateGraph(graph: Graph, limits: ApiLimits): ApiError | null {
  if (graph.nodes.length > limits.max_nodes) {
    return { code: 'LIMIT_EXCEEDED', message: `Too many nodes (max ${limits.max_nodes})`, field: 'nodes', max: limits.max_nodes }
  }
  if (graph.edges.length > limits.max_edges) {
    return { code: 'LIMIT_EXCEEDED', message: `Too many edges (max ${limits.max_edges})`, field: 'edges', max: limits.max_edges }
  }
  return null
}

export async function runTemplate(req: RunRequest, token: string): Promise<RunResponse> {
  try {
    const res = await fetch(`${API_BASE}/v1/run`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    })
    
    if (!res.ok) {
      const error: ApiError = await res.json()
      console.error('[plotApi] Run failed:', redactToken(token), error.code)
      throw error
    }
    
    return await res.json()
  } catch (err) {
    console.error('[plotApi] Request error:', redactToken(token), err)
    throw err
  }
}
