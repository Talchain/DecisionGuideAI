import type {
  CEEDraftResponse,
  CEEInsightsResponse,
  CEEFramingFeedback,
  CEEStructuralWarning,
  CEEv2Response,
  CEEv3Response,
  CeePipelineTrace,
} from './types'
import { isCEEv2Response, isCEEv3Response, isCeePipelineTrace } from './types'
import { withObservabilityHeaders, recordBffResponse, recordBffError, recordBffResponsePayload } from '../../lib/observability-headers'
import { useGateStore } from '../../lib/gate-state'

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'
const CEE_DRAFT_ENGINE_BASE = '/bff/engine/v1/cee'

/**
 * Generate correlation ID for request tracking
 * Mirrors pattern from Assistants client
 */
function generateCorrelationId(): string {
  return crypto.randomUUID()
}

export class CEEError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public correlationId?: string
  ) {
    super(message)
    this.name = 'CEEError'
  }
}

// Adapt the raw /draft-graph response into the CEEDraftResponse
// shape expected by the UI. This is defensive so partially malformed
// responses can still yield a reasonable graph.
export function adaptDraftResponse(raw: any): CEEDraftResponse {
  const empty: CEEDraftResponse = {
    quality_overall: 5,
    nodes: [],
    edges: [],
    draft_warnings: {
      structural: [],
      completeness: [],
    },
  }

  if (!raw || typeof raw !== 'object') return empty

  // If it already looks like CEEDraftResponse, normalise lightly and return.
  if (Array.isArray((raw as any).nodes) && Array.isArray((raw as any).edges)) {
    const draft = raw as any
    const quality =
      typeof draft.quality_overall === 'number'
        ? Math.max(1, Math.min(10, Math.round(draft.quality_overall)))
        : empty.quality_overall

    const structural = Array.isArray(draft.draft_warnings?.structural)
      ? (draft.draft_warnings.structural as CEEStructuralWarning[])
      : []
    const completeness = Array.isArray(draft.draft_warnings?.completeness)
      ? draft.draft_warnings.completeness.map((m: unknown) => String(m))
      : []

    // P0 FIX: Preserve analysis_ready if present in raw response
    // This is critical for CEE V3 integration where analysis_ready contains
    // resolved options with interventions
    const result: CEEDraftResponse & { analysis_ready?: unknown; schema_version?: string; pipeline_trace?: CeePipelineTrace } = {
      quality_overall: quality,
      nodes: draft.nodes,
      edges: draft.edges,
      draft_warnings: {
        structural,
        completeness,
      },
    }

    // Pass through analysis_ready if present (CEE V3)
    if (draft.analysis_ready && typeof draft.analysis_ready === 'object') {
      result.analysis_ready = draft.analysis_ready
    }

    // Pass through schema_version if present
    if (typeof draft.schema_version === 'string') {
      result.schema_version = draft.schema_version
    }

    // Pass through pipeline trace if present (for debug panel)
    // Backend sends trace.pipeline (nested), not pipeline_trace (top-level)
    if (isCeePipelineTrace(draft.trace?.pipeline)) {
      result.pipeline_trace = draft.trace.pipeline
    }

    return result
  }

  const graph =
    (raw as any).graph && typeof (raw as any).graph === 'object' ? ((raw as any).graph as any) : {}
  const rawNodes: any[] = Array.isArray(graph.nodes) ? graph.nodes : []
  const rawEdges: any[] = Array.isArray(graph.edges) ? graph.edges : []

  const qualityMeta =
    (raw as any).quality && typeof (raw as any).quality === 'object' ? ((raw as any).quality as any) : {}
  const rawOverall = typeof qualityMeta.overall === 'number' ? qualityMeta.overall : undefined
  const rawConf = typeof qualityMeta.details?.raw_confidence === 'number'
    ? qualityMeta.details.raw_confidence
    : undefined

  const confidence =
    typeof rawConf === 'number' && rawConf >= 0 && rawConf <= 1
      ? rawConf
      : typeof rawOverall === 'number'
        ? Math.max(0, Math.min(1, rawOverall / 10))
        : 0.7

  const quality_overall =
    typeof rawOverall === 'number'
      ? Math.max(1, Math.min(10, Math.round(rawOverall)))
      : Math.round(confidence * 10) || empty.quality_overall

  const fallbackUncertainty = Math.max(0, Math.min(1, 1 - confidence))

  const nodes = rawNodes.map((n, index) => {
    const idRaw = (n as any).id
    const id =
      typeof idRaw === 'string' && idRaw.trim().length > 0
        ? idRaw
        : typeof idRaw === 'number'
          ? String(idRaw)
          : `node-${index}`

    const labelSource = (n as any).label ?? (n as any).body
    const label =
      typeof labelSource === 'string' && labelSource.trim().length > 0
        ? labelSource
        : 'Untitled'

    const kind = (n as any).kind ?? (n as any).type
    const type =
      typeof kind === 'string' && kind.trim().length > 0
        ? kind
        : 'factor'

    const uncRaw = (n as any).uncertainty
    const uncertainty =
      typeof uncRaw === 'number' && uncRaw >= 0 && uncRaw <= 1
        ? uncRaw
        : fallbackUncertainty

    // Preserve observed_state for factor nodes (Brief I fix)
    const observed_state = (n as any).observed_state
    const hasObservedState = observed_state && typeof observed_state === 'object' &&
      typeof observed_state.value === 'number'

    return {
      id,
      label,
      type,
      uncertainty,
      ...(hasObservedState ? { observed_state } : {}),
    }
  })

  const edges = rawEdges
    .map((e) => {
      const fromRaw = (e as any).from
      const toRaw = (e as any).to
      const from =
        typeof fromRaw === 'string' && fromRaw.trim().length > 0
          ? fromRaw
          : typeof fromRaw === 'number'
            ? String(fromRaw)
            : null
      const to =
        typeof toRaw === 'string' && toRaw.trim().length > 0
          ? toRaw
          : typeof toRaw === 'number'
            ? String(toRaw)
            : null
      if (!from || !to) return null

      const idRaw = (e as any).id
      const id = typeof idRaw === 'string' && idRaw.trim().length > 0 ? idRaw : undefined

      const weightRaw = (e as any).weight
      const weight =
        typeof weightRaw === 'number' ? Math.max(0, Math.min(1, weightRaw)) : undefined

      const beliefRaw = (e as any).belief
      const belief =
        typeof beliefRaw === 'number' ? Math.max(0, Math.min(1, beliefRaw)) : undefined

      const rawProv = (e as any).provenance
      let provenance: CEEDraftResponse['edges'][number]['provenance']
      if (rawProv && typeof rawProv === 'object') {
        const source = rawProv.source != null ? String(rawProv.source) : ''
        const quote = rawProv.quote != null ? String(rawProv.quote) : ''
        const location =
          rawProv.location !== undefined && rawProv.location !== null
            ? String(rawProv.location)
            : undefined
        if (source || quote || location) {
          provenance = { source, quote, ...(location ? { location } : {}) }
        }
      } else if (typeof rawProv === 'string' && rawProv.trim().length > 0) {
        provenance = rawProv
      }

      const rawProvSource = (e as any).provenance_source
      const allowedSources: Array<CEEDraftResponse['edges'][number]['provenance_source']> = [
        'document',
        'metric',
        'hypothesis',
        'engine',
      ]
      const provenance_source = allowedSources.includes(rawProvSource) ? rawProvSource : undefined

      // P0-2: Preserve semantic fields for downstream adapters
      // strength_mean: normalized from nested or flat structure
      const strengthMeanRaw = (e as any).strength_mean ?? (e as any).strength?.mean
      const strength_mean = typeof strengthMeanRaw === 'number' ? strengthMeanRaw : undefined

      // strength_std: normalized from nested or flat structure
      const strengthStdRaw = (e as any).strength_std ?? (e as any).strength?.std
      const strength_std = typeof strengthStdRaw === 'number' && strengthStdRaw > 0 ? strengthStdRaw : undefined

      // effect_direction: preserved as-is
      const effectDirRaw = (e as any).effect_direction
      const effect_direction = effectDirRaw === 'positive' || effectDirRaw === 'negative' ? effectDirRaw : undefined

      return {
        ...(id && { id }),
        from,
        to,
        ...(weight !== undefined && { weight }),
        ...(belief !== undefined && { belief }),
        ...(provenance !== undefined && { provenance }),
        ...(provenance_source && { provenance_source }),
        // P0-2: Include preserved semantic fields
        ...(strength_mean !== undefined && { strength_mean }),
        ...(strength_std !== undefined && { strength_std }),
        ...(effect_direction !== undefined && { effect_direction }),
      }
    })
    .filter((edge): edge is CEEDraftResponse['edges'][number] => edge !== null)

  const completeness: string[] = []
  if (Array.isArray((raw as any).issues)) {
    for (const issue of (raw as any).issues) {
      completeness.push(String(issue))
    }
  }
  if (Array.isArray((raw as any).validation_issues)) {
    for (const v of (raw as any).validation_issues) {
      const msg = (v as any).message ?? (v as any).code ?? 'validation_issue'
      completeness.push(String(msg))
    }
  }

  // P0 FIX: Preserve analysis_ready if present in raw response (legacy path)
  const result: CEEDraftResponse & { analysis_ready?: unknown; schema_version?: string; pipeline_trace?: CeePipelineTrace } = {
    quality_overall,
    nodes,
    edges,
    draft_warnings: {
      structural: [],
      completeness,
    },
  }

  // Pass through analysis_ready if present (CEE V3)
  if ((raw as any).analysis_ready && typeof (raw as any).analysis_ready === 'object') {
    result.analysis_ready = (raw as any).analysis_ready
  }

  // Pass through schema_version if present
  if (typeof (raw as any).schema_version === 'string') {
    result.schema_version = (raw as any).schema_version
  }

  // Pass through pipeline trace if present (for debug panel)
  // Backend sends trace.pipeline (nested), not pipeline_trace (top-level)
  if (isCeePipelineTrace((raw as any).trace?.pipeline)) {
    result.pipeline_trace = (raw as any).trace.pipeline
  }

  return result
}

// Endpoint-specific timeouts (ms)
const ENDPOINT_TIMEOUTS: Record<string, number> = {
  // draft-graph needs 120s: OpenAI can take 64-71s, plus CEE processing
  '/draft-graph': 120000,
}

// Default timeout for other CEE endpoints
const DEFAULT_CEE_TIMEOUT = 60000

export class CEEClient {
  private baseURL: string
  private timeout: number

  constructor(config: { timeout?: number } = {}) {
    this.baseURL = CEE_BASE_URL
    // Default 60s timeout to handle Render cold starts (can take 30-45s)
    this.timeout = config.timeout ?? DEFAULT_CEE_TIMEOUT
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.fetchWithBase<T>(this.baseURL, endpoint, options)
  }

  private async fetchWithBase<T>(
    baseURL: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseURL}${endpoint}`
    const correlationId = generateCorrelationId()
    const controller = new AbortController()

    // Use endpoint-specific timeout if configured, otherwise use default
    const endpointPath = endpoint.split('?')[0] // Remove query params for matching
    const effectiveTimeout = ENDPOINT_TIMEOUTS[endpointPath] ?? this.timeout
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout)

    // Parse body for observability (if present) - guard against non-JSON bodies
    let bodyData: unknown = {}
    if (options.body && typeof options.body === 'string') {
      try {
        bodyData = JSON.parse(options.body)
      } catch {
        // Non-JSON body - use empty object for hash (still provides some correlation)
        bodyData = {}
      }
    }

    // Add observability headers (async for SHA-256 hashing)
    let startTime = Date.now()

    try {
      const { headers, startTime: obsStartTime } = await withObservabilityHeaders(
        url,
        options.method || 'GET',
        bodyData,
        {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          ...(options.headers as Record<string, string>),
        },
        correlationId
      )
      startTime = obsStartTime
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      })

      clearTimeout(timeoutId)

      // Record response for observability
      recordBffResponse(correlationId, url, response, startTime)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))

        // Record error payload for debug inspection
        recordBffResponsePayload(correlationId, response, error, startTime, `HTTP ${response.status}`)

        const baseMessage =
          response.status === 404
            ? 'Draft My Model is not available in this environment.'
            : error.message || `Request failed: ${response.status}`

        throw new CEEError(
          baseMessage,
          response.status,
          error,
          correlationId
        )
      }

      // Parse and record successful response payload
      const body = await response.json()
      recordBffResponsePayload(correlationId, response, body, startTime)
      return body
    } catch (error) {
      clearTimeout(timeoutId)

      // Record error for observability
      recordBffError(correlationId, url, startTime, error)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new CEEError('Request timeout', 408, undefined, correlationId)
      }
      throw error
    }
  }

  /**
   * Generate draft model from description
   * Calls CEE /draft-graph endpoint (proxy adds /assist/v1 prefix)
   *
   * @param description - The decision description/brief
   * @param options - Optional parameters
   * @param options.schemaVersion - Schema version (v1, v2, v3)
   * @param options.raw_output - If true, bypass CEE post-processing repairs (debug mode)
   */
  async draftModel(
    description: string,
    options?: { schemaVersion?: 'v1' | 'v2' | 'v3'; raw_output?: boolean }
  ): Promise<CEEDraftResponse | CEEv2Response | CEEv3Response> {
    // Request V3 schema explicitly to get analysis_ready payload with resolved interventions
    // Defence in depth: explicit version prevents breakage if CEE default changes
    const endpoint = '/draft-graph?schema=v3'

    // Build request body
    const requestBody: { brief: string; raw_output?: boolean } = { brief: description }
    if (options?.raw_output) {
      requestBody.raw_output = true
    }

    // Debug: Log schema version request
    if (import.meta.env.DEV) {
      console.log('[CEE] draftModel request:', {
        endpoint,
        schemaVersion: 'v3 (explicit)',
        raw_output: options?.raw_output ?? false,
      })
    }

    // Intended UI path is same-origin → Plot engine proxy → CEE.
    // In the browser, always prefer the engine proxy for draft-graph to avoid CORS fragility
    // and to ensure auth/routing is handled consistently.
    const draftBase = typeof window !== 'undefined' ? CEE_DRAFT_ENGINE_BASE : this.baseURL

    const raw = await this.fetchWithBase<any>(draftBase, endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    // Debug: Log response schema details
    if (import.meta.env.DEV) {
      // P0 INVESTIGATION: Check BOTH root-level AND nested graph.edges
      const rootEdges = raw?.edges || []
      const graphEdges = raw?.graph?.edges || []
      const edges = rootEdges.length > 0 ? rootEdges : graphEdges
      const edgesWithStrengthStd = edges.filter((e: any) => typeof e.strength_std === 'number')
      // P0-1: Check both root and graph.* locations for nodes
      const allNodes = raw?.nodes ?? raw?.graph?.nodes ?? []
      const nodesWithObservedState = allNodes.filter((n: any) => n.observed_state?.value !== undefined)

      // P0 INVESTIGATION: Log graph object structure (where edges actually live)
      console.log('[CEE] === GRAPH OBJECT INVESTIGATION ===')
      console.log('[CEE] raw.graph exists:', !!raw?.graph)
      console.log('[CEE] raw.graph keys:', raw?.graph ? Object.keys(raw.graph) : 'N/A')
      console.log('[CEE] raw.graph.edges length:', graphEdges.length)
      console.log('[CEE] raw.edges length (root):', rootEdges.length)

      // Log the FIRST edge from graph.edges with ALL fields
      const graphFirstEdge = graphEdges[0]
      if (graphFirstEdge) {
        console.log('[CEE] graph.edges[0] ALL KEYS:', Object.keys(graphFirstEdge))
        console.log('[CEE] graph.edges[0] RAW:', JSON.stringify(graphFirstEdge, null, 2))
        console.log('[CEE] graph.edges[0] field check:', {
          'from': graphFirstEdge.from,
          'to': graphFirstEdge.to,
          'weight (direct)': graphFirstEdge.weight,
          'strength_mean (direct)': graphFirstEdge.strength_mean,
          'strength (object)': graphFirstEdge.strength,
          'strength.mean (nested)': graphFirstEdge.strength?.mean,
          'strength.std (nested)': graphFirstEdge.strength?.std,
          'effect_direction': graphFirstEdge.effect_direction,
          'belief': graphFirstEdge.belief,
          'edge_type': graphFirstEdge.edge_type,
        })
      } else {
        console.log('[CEE] graph.edges is empty or missing')
      }
      console.log('[CEE] === END GRAPH OBJECT INVESTIGATION ===')

      // Legacy root-level edge logging
      const firstEdge = edges[0]
      console.log('[CEE] === EDGE STRUCTURE INVESTIGATION ===')
      console.log('[CEE] edges array type:', typeof raw?.edges, Array.isArray(raw?.edges))
      console.log('[CEE] edges length:', edges.length)
      if (firstEdge) {
        console.log('[CEE] First edge ALL KEYS:', Object.keys(firstEdge))
        console.log('[CEE] First edge RAW:', JSON.stringify(firstEdge, null, 2))
        console.log('[CEE] First edge field check:', {
          'weight (direct)': firstEdge.weight,
          'strength_mean (direct)': firstEdge.strength_mean,
          'strength.mean (nested)': firstEdge.strength?.mean,
          'effect_direction': firstEdge.effect_direction,
          'belief': firstEdge.belief,
        })
      } else {
        console.log('[CEE] No edges in response - raw.edges:', raw?.edges)
      }
      console.log('[CEE] === END EDGE INVESTIGATION ===')

      // P0-1: Check both root and graph.* locations for nodes
      const nodeCount = raw?.nodes?.length ?? raw?.graph?.nodes?.length ?? 0
      console.log('[CEE] draftModel response:', {
        schema_version: raw?.schema_version,
        nodeCount,
        edgeCount: edges.length,
        edgesWithStrengthStd: edgesWithStrengthStd.length,
        nodesWithObservedState: nodesWithObservedState.length,
        sampleEdge: firstEdge ? {
          from: firstEdge.from,
          to: firstEdge.to,
          weight: firstEdge.weight,
          strength_std: firstEdge.strength_std,
          effect_direction: firstEdge.effect_direction,
        } : null,
      })

      // P0 DIAGNOSTIC: Log analysis_ready presence
      console.log('[CEE] === RAW RESPONSE DIAGNOSTIC ===')
      console.log('[CEE] Response keys:', Object.keys(raw || {}))
      console.log('[CEE] Has analysis_ready:', 'analysis_ready' in (raw || {}))
      console.log('[CEE] analysis_ready value:', raw?.analysis_ready)
      console.log('[CEE] isCEEv2Response result:', isCEEv2Response(raw))
      console.log('[CEE] === END DIAGNOSTIC ===')
    }

    // Update graph_readiness gate on successful response
    useGateStore.getState().setGate('graph_readiness', 'pass', { message: 'Draft graph received' })

    // Check V3 first (since we request ?schema=v3)
    if (isCEEv3Response(raw)) {
      const result = raw as CEEv3Response & { pipeline_trace?: CeePipelineTrace }

      // Extract trace.pipeline to top-level pipeline_trace for consistency with V1 path
      const rawTrace = (raw as any).trace?.pipeline
      if (isCeePipelineTrace(rawTrace)) {
        result.pipeline_trace = rawTrace
      } else if (import.meta.env.DEV && (raw as any).trace) {
        // Log why trace extraction failed
        console.warn('[CEE] Pipeline trace extraction failed for V3 response:', {
          hasTrace: !!(raw as any).trace,
          hasPipeline: !!(raw as any).trace?.pipeline,
          pipelineKeys: rawTrace ? Object.keys(rawTrace) : 'undefined',
          hasStatus: typeof rawTrace?.status === 'string',
          hasDuration: typeof rawTrace?.total_duration_ms === 'number',
          hasCallCount: typeof rawTrace?.llm_call_count === 'number',
          hasStages: Array.isArray(rawTrace?.stages),
        })
      }
      return result
    }

    // Fall back to v2 check
    if (isCEEv2Response(raw)) {
      const result = raw as CEEv2Response & { pipeline_trace?: CeePipelineTrace }
      // Extract trace.pipeline to top-level pipeline_trace for consistency with V1 path
      const rawTrace = (raw as any).trace?.pipeline
      if (isCeePipelineTrace(rawTrace)) {
        result.pipeline_trace = rawTrace
      } else if (import.meta.env.DEV && (raw as any).trace) {
        // Log why trace extraction failed
        console.warn('[CEE] Pipeline trace extraction failed for V2 response:', {
          hasTrace: !!(raw as any).trace,
          hasPipeline: !!(raw as any).trace?.pipeline,
          pipelineKeys: rawTrace ? Object.keys(rawTrace) : 'undefined',
          hasStatus: typeof rawTrace?.status === 'string',
          hasDuration: typeof rawTrace?.total_duration_ms === 'number',
          hasCallCount: typeof rawTrace?.llm_call_count === 'number',
          hasStages: Array.isArray(rawTrace?.stages),
        })
      }
      return result
    }

    // Fall back to v1 adaptation for legacy responses
    return adaptDraftResponse(raw)
  }

  /**
   * Check for cognitive biases in a decision graph
   * Endpoint: POST /bias-check (proxy adds /assist/v1 prefix)
   *
   * @param graph - The decision graph with nodes and edges
   * @param archetype - Optional archetype for context
   */
  async biasCheck(
    graph: {
      nodes: Array<{ id: string; label: string; type: string }>
      edges: Array<{ from: string; to: string }>
    },
    archetype?: string
  ): Promise<CEEInsightsResponse> {
    return this.fetch<CEEInsightsResponse>('/bias-check', {
      method: 'POST',
      body: JSON.stringify({ graph, archetype }),
    })
  }

  /**
   * Get sensitivity analysis coaching for a decision
   * Endpoint: POST /sensitivity-coach (proxy adds /assist/v1 prefix)
   *
   * @param graph - The decision graph with nodes and edges
   * @param inference - The inference/analysis context
   */
  async sensitivityCoach(
    graph: {
      nodes: Array<{ id: string; label: string; type: string }>
      edges: Array<{ from: string; to: string }>
    },
    inference: Record<string, unknown>
  ): Promise<CEEInsightsResponse> {
    return this.fetch<CEEInsightsResponse>('/sensitivity-coach', {
      method: 'POST',
      body: JSON.stringify({ graph, inference }),
    })
  }

  /**
   * @deprecated Use biasCheck() instead. This method signature is incompatible with CEE API.
   * CEE's bias-check endpoint requires a graph, not a text description.
   * Keeping for backward compatibility - returns degraded response.
   */
  async framingFeedback(_partialDescription: string): Promise<CEEFramingFeedback> {
    // CEE doesn't have a text-based framing feedback endpoint
    // Return a degraded response instead of calling a non-existent endpoint
    console.warn('[CEE] framingFeedback() is deprecated. CEE requires a graph for bias-check.')
    return {
      status: 'good',
      message: 'Real-time feedback is temporarily unavailable.',
      suggestions: [],
    }
  }

  /**
   * @deprecated Use biasCheck() or sensitivityCoach() instead.
   * Keeping for backward compatibility with useCEEInsights hook.
   */
  async analyzeInsights(graph: {
    nodes: Array<{ id: string; label: string; type: string }>
    edges: Array<{ from: string; to: string }>
  }): Promise<CEEInsightsResponse> {
    // Delegate to biasCheck which is the correct endpoint
    return this.biasCheck(graph)
  }
}
