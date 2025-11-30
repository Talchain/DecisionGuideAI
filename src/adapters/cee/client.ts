import type {
  CEEDraftResponse,
  CEEInsightsResponse,
  CEEFramingFeedback,
  CEEStructuralWarning,
} from './types'

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'

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

// Adapt the raw /assist/v1/draft-graph response into the CEEDraftResponse
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

    return {
      quality_overall: quality,
      nodes: draft.nodes,
      edges: draft.edges,
      draft_warnings: {
        structural,
        completeness,
      },
    }
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

    return { id, label, type, uncertainty }
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

      return {
        ...(id && { id }),
        from,
        to,
        ...(weight !== undefined && { weight }),
        ...(belief !== undefined && { belief }),
        ...(provenance !== undefined && { provenance }),
        ...(provenance_source && { provenance_source }),
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

  return {
    quality_overall,
    nodes,
    edges,
    draft_warnings: {
      structural: [],
      completeness,
    },
  }
}

export class CEEClient {
  private baseURL: string
  private timeout: number

  constructor(config: { timeout?: number } = {}) {
    this.baseURL = CEE_BASE_URL
    // 60s timeout to handle Render cold starts (can take 30-45s)
    this.timeout = config.timeout ?? 60000
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const correlationId = generateCorrelationId()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': correlationId,
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))

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

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CEEError('Request timeout', 408, undefined, correlationId)
      }
      throw error
    }
  }

  /**
   * Generate draft model from description
   * Calls CEE /assist/v1/draft-graph endpoint
   */
  async draftModel(description: string): Promise<CEEDraftResponse> {
    const raw = await this.fetch<any>('/assist/v1/draft-graph', {
      method: 'POST',
      body: JSON.stringify({ brief: description }),
    })

    return adaptDraftResponse(raw)
  }

  /**
   * Check for cognitive biases in a decision graph
   * Endpoint: POST /assist/v1/bias-check
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
    return this.fetch<CEEInsightsResponse>('/assist/v1/bias-check', {
      method: 'POST',
      body: JSON.stringify({ graph, archetype }),
    })
  }

  /**
   * Get sensitivity analysis coaching for a decision
   * Endpoint: POST /assist/v1/sensitivity-coach
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
    return this.fetch<CEEInsightsResponse>('/assist/v1/sensitivity-coach', {
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
