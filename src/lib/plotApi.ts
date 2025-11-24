/**
 * PLoT API Client - Phase A: Production Quality
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
const UI_BUILD = import.meta.env.VITE_BUILD_ID || 'dev'
const DEFAULT_LIMITS: ApiLimits = { max_nodes: 50, max_edges: 200 }
const CACHE_TTL_MS = 60_000

let cachedLimits: ApiLimits | null = null
let limitsETag: string | null = null
let cacheTimestamp = 0

const redactToken = (token: string) => token ? token.slice(0, 8) + '...' : '[no-token]'

function getHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'X-UI-Build': UI_BUILD,
    'Content-Type': 'application/json'
  }
}

export async function fetchLimits(token: string): Promise<ApiLimits> {
  const now = Date.now()
  if (cachedLimits && (now - cacheTimestamp) < CACHE_TTL_MS) return cachedLimits
  
  const headers = getHeaders(token)
  if (limitsETag) headers['If-None-Match'] = limitsETag
  
  try {
    const res = await fetch(`${API_BASE}/v1/limits`, { headers })
    if (res.status === 304 && cachedLimits) return cachedLimits
    if (!res.ok) return DEFAULT_LIMITS
    
    const etag = res.headers.get('ETag') || res.headers.get('etag')
    if (etag) limitsETag = etag
    
    cachedLimits = await res.json()
    cacheTimestamp = now
    return cachedLimits!
  } catch (err) {
    console.warn('[plotApi] Limits failed:', redactToken(token))
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
      headers: getHeaders(token),
      body: JSON.stringify(req)
    })
    
    if (!res.ok) {
      const error: ApiError = await res.json()
      console.error('[plotApi] Run failed:', error.code)
      throw error
    }
    
    return await res.json()
  } catch (err: any) {
    if (err.code) throw err
    console.error('[plotApi] Request error')
    throw { code: 'SERVER_ERROR', message: 'Request failed' }
  }
}
