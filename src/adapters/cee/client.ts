import type {
  CEEDraftResponse,
  CEEInsightsResponse,
  CEEFramingFeedback,
  CEEStructuralWarning,
  CEEv2Response,
  CEEv3Response,
  CeePipelineTrace,
  CEEDraftCoaching,
} from './types'
import { isCEEv2Response, isCEEv3Response, isCeePipelineTrace } from './types'
import { withObservabilityHeaders, recordBffResponse, recordBffError, recordBffResponsePayload } from '../../lib/observability-headers'
import { useGateStore } from '../../lib/gate-state'
import { CEEDraftResponseSchema, warnOnInvalidApiResponse } from '../../lib/api-schemas'
import { withRetry } from '../../lib/fetchWithRetry'
import { devWarn } from '../../utils/debugLog'
import { plotAuthHeaders } from '../../lib/plotAuthHeaders'

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'
// CEE Draft Engine base URL
// On staging, can be set to direct PLoT URL to bypass Netlify proxy (which times out at ~28s)
// Example: VITE_CEE_DRAFT_BASE=https://plot-lite-service-staging.onrender.com/v1/cee
const CEE_DRAFT_ENGINE_BASE = (import.meta as any).env?.VITE_CEE_DRAFT_BASE || '/bff/engine/v1/cee'

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

/** Narrow unknown to Record for safe nested access (replaces `as any` on external data) */
function asRec(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Infer missing `category` on factor nodes from graph edge structure.
 * Non-breaking: only fills in when category is undefined (never overwrites).
 *
 * Logic:
 * - Factor has incoming edge from an option/decision node → "controllable"
 * - Factor has no option edges → "observable"
 *
 * This handles the LLM omission pattern where GPT-4o non-deterministically
 * drops the `category` field on factor nodes.
 */
function inferMissingCategories(nodes: Record<string, unknown>[], edges: Record<string, unknown>[]): void {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return

  // Build set of option/decision node IDs
  const optionIds = new Set<string>()
  for (const n of nodes) {
    const kind = n.kind ?? n.type
    if (kind === 'option' || kind === 'decision') {
      optionIds.add(n.id)
    }
  }

  // Build set of factor IDs that are targets of edges from option nodes
  const optionTargets = new Set<string>()
  for (const edge of edges) {
    const from = edge.from ?? edge.source
    const to = edge.to ?? edge.target
    if (from && to && optionIds.has(from)) {
      optionTargets.add(to)
    }
  }

  // Fill missing category on factor nodes
  for (const node of nodes) {
    const kind = node.kind ?? node.type
    if (kind !== 'factor') continue
    if (node.category) continue // already has category — don't overwrite

    node.category = optionTargets.has(node.id) ? 'controllable' : 'observable'
  }
}

/**
 * Map response.coaching (snake_case wire shape) to internal CEEDraftCoaching (camelCase).
 * Each list item is type-guarded; malformed entries are dropped (not mapped blindly)
 * but a devWarn is emitted so contract drift is observable in DEV builds. Returns
 * null when coaching is absent/null/non-object.
 */
export function mapDraftCoachingFromResponse(raw: unknown): CEEDraftCoaching | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>

  const dropped = { strengthenItems: 0, wideningLog: 0, biasSignals: 0 }

  const strengthenItems = Array.isArray(c.strengthen_items)
    ? (c.strengthen_items as unknown[]).flatMap((it) => {
        if (!it || typeof it !== 'object') { dropped.strengthenItems++; return [] }
        const o = it as Record<string, unknown>
        if (typeof o.id !== 'string' || typeof o.label !== 'string' || typeof o.detail !== 'string') {
          dropped.strengthenItems++
          return []
        }
        return [{
          id: o.id,
          label: o.label,
          detail: o.detail,
          ...(typeof o.action_type === 'string' ? { actionType: o.action_type } : {}),
          ...(typeof o.bias_category === 'string' ? { biasCategory: o.bias_category } : {}),
        }]
      })
    : []

  const wideningLog = Array.isArray(c.widening_log)
    ? (c.widening_log as unknown[]).flatMap((it) => {
        if (!it || typeof it !== 'object') { dropped.wideningLog++; return [] }
        const o = it as Record<string, unknown>
        if (typeof o.node_id !== 'string' || typeof o.label !== 'string' || typeof o.reason !== 'string') {
          dropped.wideningLog++
          return []
        }
        return [{ nodeId: o.node_id, label: o.label, reason: o.reason }]
      })
    : []

  const biasSignals = Array.isArray(c.bias_signals)
    ? (c.bias_signals as unknown[]).flatMap((it) => {
        if (!it || typeof it !== 'object') { dropped.biasSignals++; return [] }
        const o = it as Record<string, unknown>
        if (typeof o.type !== 'string' || typeof o.detail !== 'string') {
          dropped.biasSignals++
          return []
        }
        return [{
          type: o.type,
          detail: o.detail,
          ...(typeof o.target === 'string' ? { target: o.target } : {}),
        }]
      })
    : []

  if (dropped.strengthenItems + dropped.wideningLog + dropped.biasSignals > 0) {
    devWarn('CEE', 'mapDraftCoachingFromResponse: dropped malformed coaching entries', dropped)
  }

  return {
    summary: typeof c.summary === 'string' ? c.summary : null,
    strengthenItems,
    wideningLog,
    biasSignals,
  }
}

// Adapt the raw /draft-graph response into the CEEDraftResponse
// shape expected by the UI. This is defensive so partially malformed
// responses can still yield a reasonable graph.
export function adaptDraftResponse(raw: unknown): CEEDraftResponse {
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

  // After the guard above, raw is `object`. Cast to Record for indexed access.
  const r = raw as Record<string, unknown>

  // If it already looks like CEEDraftResponse, normalise lightly and return.
  if (Array.isArray(r.nodes) && Array.isArray(r.edges)) {
    const draft = r
    const quality =
      typeof draft.quality_overall === 'number'
        ? Math.max(1, Math.min(10, Math.round(draft.quality_overall)))
        : empty.quality_overall

    const draftWarnings = asRec(draft.draft_warnings)
    const structural = Array.isArray(draftWarnings?.structural)
      ? (draftWarnings.structural as CEEStructuralWarning[])
      : []
    const completeness = Array.isArray(draftWarnings?.completeness)
      ? (draftWarnings.completeness as unknown[]).map((m: unknown) => String(m))
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
      draftCoaching: mapDraftCoachingFromResponse(draft.coaching),
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
    const draftTrace = asRec(draft.trace)
    if (draftTrace && isCeePipelineTrace(draftTrace.pipeline)) {
      result.pipeline_trace = draftTrace.pipeline as CeePipelineTrace
    }

    // Pass through rationales if present (CEE V3 — per-node LLM reasoning)
    if (Array.isArray(draft.rationales) && draft.rationales.length > 0) {
      ;(result as Record<string, unknown>).rationales = draft.rationales
    }

    // LLM omission resilience: infer missing category from graph edges
    inferMissingCategories(result.nodes, result.edges)

    return result
  }

  const graph = asRec(r.graph) ?? {}
  const rawNodes: unknown[] = Array.isArray(graph.nodes) ? graph.nodes : []
  const rawEdges: unknown[] = Array.isArray(graph.edges) ? graph.edges : []

  const qualityMeta = asRec(r.quality) ?? {}
  const rawOverall = typeof qualityMeta.overall === 'number' ? qualityMeta.overall : undefined
  const qualityDetails = asRec(qualityMeta.details)
  const rawConf = typeof qualityDetails?.raw_confidence === 'number'
    ? qualityDetails.raw_confidence
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

  const nodes = rawNodes.map((rawNode, index) => {
    const n = (rawNode && typeof rawNode === 'object' ? rawNode : {}) as Record<string, unknown>
    const idRaw = n.id
    const id =
      typeof idRaw === 'string' && idRaw.trim().length > 0
        ? idRaw
        : typeof idRaw === 'number'
          ? String(idRaw)
          : `node-${index}`

    const labelSource = n.label ?? n.body
    const label =
      typeof labelSource === 'string' && labelSource.trim().length > 0
        ? labelSource
        : 'Untitled'

    const kind = n.kind ?? n.type
    const type =
      typeof kind === 'string' && kind.trim().length > 0
        ? kind
        : 'factor'

    const uncRaw = n.uncertainty
    // CIL 0.2: reject NaN/Infinity
    const uncertainty =
      Number.isFinite(uncRaw) && (uncRaw as number) >= 0 && (uncRaw as number) <= 1
        ? uncRaw
        : fallbackUncertainty

    // Preserve observed_state for factor nodes (Brief I fix)
    // CIL 0.2: reject NaN/Infinity in observed_state.value
    const observed_state = n.observed_state
    const obsRec = asRec(observed_state)
    const hasObservedState = !!obsRec && Number.isFinite(obsRec.value)

    // CIL 0.2: spread-first preserves unknown CEE node fields
    return {
      ...n,
      id,
      label,
      type,
      uncertainty,
      // Override observed_state: keep if valid, remove if invalid
      ...(hasObservedState ? { observed_state } : { observed_state: undefined }),
    }
  })

  const edges = rawEdges
    .map((rawEdge) => {
      // --- Validate required from/to (drop edge if missing) ---
      const e = (rawEdge && typeof rawEdge === 'object' ? rawEdge : {}) as Record<string, unknown>
      const fromRaw = e.from
      const toRaw = e.to
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

      // --- Spread-first: preserve all raw fields, then override transformed ones ---
      // This ensures unknown/additive CEE edge fields (e.g. edge_type, label,
      // future CIL additions) are not silently dropped.

      // Validate/coerce id
      const idRaw = e.id
      const id = typeof idRaw === 'string' && idRaw.trim().length > 0 ? idRaw : undefined

      // UI-SEM-026: CEE edge weight clamped to [0, 1].
      // Keep — normalises out-of-range CEE values (CIL 0.2: reject NaN/Infinity).
      const weightRaw = e.weight
      const weight =
        Number.isFinite(weightRaw) ? Math.max(0, Math.min(1, weightRaw as number)) : undefined

      // UI-SEM-027: CEE edge belief clamped to [0, 1].
      // Keep — normalises out-of-range CEE values.
      const beliefRaw = e.belief
      const belief =
        Number.isFinite(beliefRaw) ? Math.max(0, Math.min(1, beliefRaw as number)) : undefined

      // Normalize provenance (object or string)
      const rawProv = e.provenance
      let provenance: CEEDraftResponse['edges'][number]['provenance']
      if (rawProv && typeof rawProv === 'object') {
        const prov = rawProv as Record<string, unknown>
        const source = prov.source != null ? String(prov.source) : ''
        const quote = prov.quote != null ? String(prov.quote) : ''
        const location =
          prov.location !== undefined && prov.location !== null
            ? String(prov.location)
            : undefined
        if (source || quote || location) {
          provenance = { source, quote, ...(location ? { location } : {}) }
        }
      } else if (typeof rawProv === 'string' && rawProv.trim().length > 0) {
        provenance = rawProv
      }

      // Validate provenance_source against allowlist
      const rawProvSource = e.provenance_source
      const allowedSources: Array<CEEDraftResponse['edges'][number]['provenance_source']> = [
        'document',
        'metric',
        'hypothesis',
        'engine',
      ]
      const provenance_source = typeof rawProvSource === 'string' && allowedSources.includes(rawProvSource as typeof allowedSources[number]) ? rawProvSource : undefined

      // P0-2: Normalize strength_mean from nested or flat structure
      // CIL 0.2: reject NaN/Infinity — JSON.stringify converts to null
      const strengthObj = asRec(e.strength)
      const strengthMeanRaw = e.strength_mean ?? strengthObj?.mean
      const strength_mean = Number.isFinite(strengthMeanRaw) ? strengthMeanRaw as number : undefined

      // P0-2: Normalize strength_std from nested or flat structure
      const strengthStdRaw = e.strength_std ?? strengthObj?.std
      const strength_std = Number.isFinite(strengthStdRaw) && (strengthStdRaw as number) > 0 ? strengthStdRaw as number : undefined

      // Validate effect_direction against known values
      const effectDirRaw = e.effect_direction
      const effect_direction = effectDirRaw === 'positive' || effectDirRaw === 'negative' ? effectDirRaw : undefined

      // UI-SEM-028: CEE belief_exists clamped to [0, 1].
      // Keep — normalises out-of-range structural certainty (CIL 0.2: reject NaN/Infinity).
      const beliefExistsRaw = e.belief_exists
      const belief_exists =
        Number.isFinite(beliefExistsRaw) ? Math.max(0, Math.min(1, beliefExistsRaw as number)) : undefined

      // Build the result: spread e first (preserves unknown fields),
      // then override with validated/transformed values.
      // Fields that fail validation are explicitly set to undefined
      // to overwrite the invalid e value from the spread.

      // CIL 0.2: Remove only mean/std from nested strength, preserve other subfields
      let strengthRemaining: Record<string, unknown> | undefined
      if (strengthObj) {
        const { mean: _m, std: _s, ...rest } = strengthObj
        strengthRemaining = Object.keys(rest).length > 0 ? rest : undefined
      }

      return {
        ...e,                                  // spread-first: preserve unknown fields
        strength: strengthRemaining,           // CIL 0.2: preserve unknown strength.* fields, remove only mean/std
        id,                                    // coerced id (undefined if invalid)
        from,                                  // coerced from
        to,                                    // coerced to
        weight,                                // clamped weight (undefined if non-numeric)
        belief,                                // clamped belief (undefined if non-numeric)
        provenance,                            // normalized provenance (undefined if absent)
        provenance_source,                     // validated provenance_source (undefined if not in allowlist)
        strength_mean,                         // normalized strength_mean (undefined if non-numeric)
        strength_std,                          // normalized strength_std (undefined if non-numeric or ≤0)
        effect_direction,                      // validated effect_direction (undefined if not positive/negative)
        belief_exists,                         // clamped belief_exists (undefined if non-numeric)
      }
    })
    .filter((edge): edge is CEEDraftResponse['edges'][number] => edge !== null)

  const completeness: string[] = []
  if (Array.isArray(r.issues)) {
    for (const issue of r.issues) {
      completeness.push(String(issue))
    }
  }
  if (Array.isArray(r.validation_issues)) {
    for (const v of r.validation_issues) {
      const vRec = asRec(v)
      const msg = vRec?.message ?? vRec?.code ?? 'validation_issue'
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
    draftCoaching: mapDraftCoachingFromResponse(r.coaching),
  }

  // Pass through analysis_ready if present (CEE V3)
  if (r.analysis_ready && typeof r.analysis_ready === 'object') {
    result.analysis_ready = r.analysis_ready
  }

  // Pass through schema_version if present
  if (typeof r.schema_version === 'string') {
    result.schema_version = r.schema_version
  }

  // Pass through pipeline trace if present (for debug panel)
  // Backend sends trace.pipeline (nested), not pipeline_trace (top-level)
  const rawTrace = asRec(r.trace)
  if (rawTrace && isCeePipelineTrace(rawTrace.pipeline)) {
    result.pipeline_trace = rawTrace.pipeline as CeePipelineTrace
  }

  // LLM omission resilience: infer missing category from graph edges
  inferMissingCategories(result.nodes, result.edges)

  return result
}

// Endpoint-specific timeouts (ms)
const ENDPOINT_TIMEOUTS: Record<string, number> = {
  // draft-graph needs 150s: OpenAI can take 64-71s, plus CEE processing
  '/draft-graph': 150000,
}

// Audit F-67: Default timeout set to 150s — above CEE's 135s route timeout.
// Prevents silent hangs while allowing CEE sufficient processing time.
// Surfaces timeout as user-visible CEEError (408) via AbortController in fetchWithBase.
const DEFAULT_CEE_TIMEOUT = 150000

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

  /** Fetch with retry — use only for idempotent/read-only endpoints (not draft-graph) */
  private async fetchIdempotent<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return withRetry(
      () => this.fetchWithBase<T>(this.baseURL, endpoint, options),
    )
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
          // Optional env-injected Bearer for PLoT-direct calls. Empty {} until
          // VITE_PLOT_BEARER is provisioned → today's behaviour, byte-for-byte.
          ...plotAuthHeaders(),
        },
        correlationId
      )
      startTime = obsStartTime
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      })

      // NOTE: the abort timer is deliberately NOT cleared here. `fetch` resolves
      // as soon as the HEADERS arrive, so clearing it at this point left both
      // `response.json()` reads below unprotected: a headers-then-body stall
      // (the Netlify-edge hang class this project has hit before) left this
      // promise pending forever, so the draft and coaching surfaces awaiting
      // this client sat in a pending state with no escape control — the exact
      // failure the F-67 headers-phase timeout was added to prevent, reachable
      // one phase later. The timer is cleared in the `finally` instead, once the
      // body read has completed or thrown. Mirrors the runV2 fix in #367.
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
      // Record error for observability
      recordBffError(correlationId, url, startTime, error)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new CEEError('Request timeout', 408, undefined, correlationId)
      }
      throw error
    } finally {
      // Cleared here, and only here — after the body read has settled on every
      // path (success, HTTP error, abort). An abort raised mid-body rejects the
      // body read with an AbortError, which the catch above maps to the same
      // CEEError('Request timeout', 408) a headers-phase timeout already
      // produced — no new error shape.
      clearTimeout(timeoutId)
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
   * @param options.model - Generation model override (only sent if differs from default)
   * @param options.repair_model - Repair model override (only sent if differs from default)
   * @param options.enrichment_model - Enrichment model override (only sent if differs from default)
   */
  async draftModel(
    description: string,
    options?: {
      schemaVersion?: 'v1' | 'v2' | 'v3'
      raw_output?: boolean
      model?: string
      repair_model?: string
      enrichment_model?: string
    }
  ): Promise<CEEDraftResponse | CEEv2Response | CEEv3Response> {
    // Request V3 schema explicitly to get analysis_ready payload with resolved interventions
    // Defence in depth: explicit version prevents breakage if CEE default changes
    const endpoint = '/draft-graph?schema=v3'

    // Build request body - only include non-default model parameters to keep payload clean
    const requestBody: {
      brief: string
      raw_output?: boolean
      model?: string
      repair_model?: string
      enrichment_model?: string
    } = { brief: description }

    if (options?.raw_output) {
      requestBody.raw_output = true
    }

    // Add model parameters only when they differ from defaults (non-null in store)
    if (options?.model) {
      requestBody.model = options.model
    }
    if (options?.repair_model) {
      requestBody.repair_model = options.repair_model
    }
    if (options?.enrichment_model) {
      requestBody.enrichment_model = options.enrichment_model
    }

    // Debug: Log schema version request
    /* eslint-disable no-restricted-syntax, no-console -- grandfathered DEV diagnostics */
    if (import.meta.env.DEV) {
      console.log('[CEE] draftModel request:', {
        endpoint,
        schemaVersion: 'v3 (explicit)',
        raw_output: options?.raw_output ?? false,
      })
    }
    /* eslint-enable no-restricted-syntax, no-console */

    // Intended UI path is same-origin → Plot engine proxy → CEE.
    // In the browser, always prefer the engine proxy for draft-graph to avoid CORS fragility
    // and to ensure auth/routing is handled consistently.
    const draftBase = typeof window !== 'undefined' ? CEE_DRAFT_ENGINE_BASE : this.baseURL

    const raw = await this.fetchWithBase<any>(draftBase, endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    })

    // Warn if response shape is unexpected (logs warning, continues execution)
    warnOnInvalidApiResponse(CEEDraftResponseSchema, raw, 'CEE draft')

    // Debug: Log response schema details
    /* eslint-disable no-restricted-syntax, no-console -- grandfathered DEV diagnostics */
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
    /* eslint-enable no-restricted-syntax, no-console */

    // Update graph_readiness gate on successful response
    useGateStore.getState().setGate('graph_readiness', 'pass', { message: 'Draft graph received' })

    // Check V3 first (since we request ?schema=v3)
    if (isCEEv3Response(raw)) {
      const result = raw as CEEv3Response & { pipeline_trace?: CeePipelineTrace }

      // Extract trace.pipeline to top-level pipeline_trace for consistency with V1 path
      const traceObj = asRec((raw as Record<string, unknown>).trace)
      const rawTrace = traceObj?.pipeline
      if (isCeePipelineTrace(rawTrace)) {
        result.pipeline_trace = rawTrace as CeePipelineTrace
      } else if (import.meta.env.DEV && traceObj) {
        // Log why trace extraction failed
        console.warn('[CEE] Pipeline trace extraction failed for V3 response:', {
          hasTrace: !!traceObj,
          hasPipeline: !!traceObj?.pipeline,
          pipelineKeys: rawTrace ? Object.keys(rawTrace) : 'undefined',
          hasStatus: typeof rawTrace?.status === 'string',
          hasDuration: typeof rawTrace?.total_duration_ms === 'number',
          hasCallCount: typeof rawTrace?.llm_call_count === 'number',
          hasStages: Array.isArray(rawTrace?.stages),
        })
      }

      // LLM omission resilience: infer missing category from graph edges
      inferMissingCategories(result.nodes, result.edges)

      return result
    }

    // Fall back to v2 check
    if (isCEEv2Response(raw)) {
      const result = raw as CEEv2Response & { pipeline_trace?: CeePipelineTrace }
      // Extract trace.pipeline to top-level pipeline_trace for consistency with V1 path
      const traceObj2 = asRec((raw as Record<string, unknown>).trace)
      const rawTrace2 = traceObj2?.pipeline
      if (isCeePipelineTrace(rawTrace2)) {
        result.pipeline_trace = rawTrace2 as CeePipelineTrace
      } else if (import.meta.env.DEV && traceObj2) {
        // Log why trace extraction failed
        console.warn('[CEE] Pipeline trace extraction failed for V2 response:', {
          hasTrace: !!traceObj2,
          hasPipeline: !!traceObj2?.pipeline,
          pipelineKeys: rawTrace2 && typeof rawTrace2 === 'object' ? Object.keys(rawTrace2 as Record<string, unknown>) : 'undefined',
          hasStatus: typeof asRec(rawTrace2)?.status === 'string',
          hasDuration: typeof asRec(rawTrace2)?.total_duration_ms === 'number',
          hasCallCount: typeof asRec(rawTrace2)?.llm_call_count === 'number',
          hasStages: Array.isArray(asRec(rawTrace2)?.stages),
        })
      }

      // LLM omission resilience: infer missing category from graph edges
      inferMissingCategories(result.nodes, result.edges)

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
    return this.fetchIdempotent<CEEInsightsResponse>('/bias-check', {
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
    return this.fetchIdempotent<CEEInsightsResponse>('/sensitivity-coach', {
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
}
