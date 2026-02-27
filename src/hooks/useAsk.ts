/**
 * useAsk Hook
 *
 * TanStack Query mutation for CEE /assist/v1/ask endpoint.
 * Sends WorkingSetRequest format with all required fields.
 *
 * CEE Contract Requirements:
 * - request_id: In X-Request-Id header AND optionally in body
 * - scenario_id: Required, 1-100 chars
 * - graph_schema_version: "2.2" (CEE contract version)
 * - brief: Required, 10-10000 chars
 * - message: User's question (1-2000 chars)
 * - graph_snapshot: Full Graph object (max 12 nodes / 20 edges)
 * - market_context: Required object with id, version, hash
 *
 * Usage:
 * const { mutate, isPending, data, error } = useAsk()
 * mutate('What should I focus on?')
 */

import { useCallback, useEffect, useRef } from 'react'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { useCanvasStore } from '../canvas/store'
import type { Node, Edge } from '@xyflow/react'
import type { ModelAction, Highlight, ProvenanceItem } from '../types/primitives'
import { isModelAction, isHighlight } from '../types/primitives'
import { generateRequestId, extractServerRequestId, type RequestTrace, type AskRecord } from '../types/requestId'
import { prepareGraphSnapshot, type Graph } from '../lib/graphTransform'
import { checkAskPreflight, type PreflightResult } from '../lib/askPreflight'
import { fetchWithTimeout, FetchTimeoutError } from '../utils/fetchWithTimeout'

// =============================================================================
// Types
// =============================================================================

/**
 * WorkingSetRequest - CEE /assist/v1/ask request payload
 */
export interface WorkingSetRequest {
  /** Optional in body (also sent in header) - SafeRequestId format */
  request_id?: string

  /** Required, 1-100 chars */
  scenario_id: string

  /** CEE contract version - always "2.2" */
  graph_schema_version: '2.2'

  /** Required, 10-10000 chars - composed from scenario framing */
  brief: string

  /** User's question, 1-2000 chars (was "text" in old implementation) */
  message: string

  /** Full Graph object (max 12 nodes / 20 edges) */
  graph_snapshot: Graph

  /** Required market context */
  market_context: {
    id: string
    version: string
    hash: string
  }

  /** Optional selection (highlighted node/edge) */
  selection?: {
    node_id?: string
    edge_id?: string
    panel_section?: string
  }

  /** Optional recent conversation turns (max 10) */
  turns_recent?: Turn[]

  /** Optional intent hint */
  intent?: AskIntent
}

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

export type AskIntent =
  | 'clarify'
  | 'suggest'
  | 'explain'
  | 'validate'
  | 'compare'

/**
 * AskResponse - CEE /assist/v1/ask response
 */
export interface AskResponse {
  /** Server request ID (may differ from sent if original was unsafe) */
  request_id: string

  /** Natural language response */
  message: string

  /** Suggested graph actions */
  model_actions?: ModelAction[]

  /** Elements to highlight */
  highlights?: Highlight[]

  /** Follow-up question to ask user */
  follow_up_question?: string

  /** Provenance explanation */
  why?: ProvenanceItem[]

  /** Attribution metadata */
  attribution?: {
    model_id?: string
    timestamp?: string
  }
}

/**
 * Normalized response for UI consumption
 */
export interface NormalizedAskResponse {
  /** Server request ID */
  serverRequestId: string

  /** Client request ID for tracing */
  clientRequestId: string

  /** Natural language response text */
  text: string

  /** Validated model actions */
  model_actions: ModelAction[]

  /** Validated highlights */
  highlights: Highlight[]

  /** Provenance items */
  provenance: ProvenanceItem[]

  /** Follow-up question */
  followUpQuestion?: string

  /** Raw response for debugging */
  raw: unknown
}

/**
 * Ask error response from CEE
 */
export interface AskErrorResponse {
  code: string
  message: string
  details?: unknown
  retryable?: boolean
}

/**
 * Custom error class for Ask API errors
 */
export class AskApiError extends Error {
  code: string
  details?: unknown
  retryable: boolean

  constructor(response: AskErrorResponse) {
    super(response.message)
    this.name = 'AskApiError'
    this.code = response.code
    this.details = response.details
    this.retryable = response.retryable ?? false
  }
}

/**
 * Custom error class for preflight failures
 */
export class AskPreflightError extends Error {
  preflight: PreflightResult

  constructor(message: string, preflight: PreflightResult) {
    super(message)
    this.name = 'AskPreflightError'
    this.preflight = preflight
  }
}

/**
 * Hook configuration
 */
export interface UseAskOptions {
  /** Callback when highlights are available */
  onHighlight?: (highlights: Highlight[]) => void

  /** Callback when model actions are available */
  onActions?: (actions: ModelAction[]) => void

  /** Callback when request trace is available */
  onTrace?: (trace: RequestTrace) => void

  /** Base URL override */
  baseUrl?: string
}

// =============================================================================
// Constants
// =============================================================================

/** CEE base URL - routes through PLoT which handles auth and timeout */
const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'

/** CEE /ask endpoint */
const ASK_ENDPOINT = `${CEE_BASE_URL}/ask`

/** Timeout for /ask requests (ms) — CEE LLM calls can be slow on complex graphs */
const ASK_TIMEOUT_MS = 45_000

/** CEE contract version */
const GRAPH_SCHEMA_VERSION = '2.2' as const

/** Default brief when framing is not available */
const DEFAULT_BRIEF = 'Decision analysis for the current model.'

/** Default market context */
const DEFAULT_MARKET_CONTEXT = {
  id: 'default',
  version: '1.0',
  hash: 'unknown',
} as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compose the brief string from framing fields (no fallback or truncation).
 * Exported so InputsDock can reuse the same field→string mapping for length checks.
 */
export function composeBriefText(framing: {
  title?: string
  goal?: string
  timeline?: string
  constraints?: string
  risks?: string
  uncertainties?: string
} | null): string {
  if (!framing) return ''

  const parts: string[] = []

  if (framing.title) parts.push(`Decision: ${framing.title}`)
  if (framing.goal) parts.push(`Goal: ${framing.goal}`)
  if (framing.timeline) parts.push(`Timeline: ${framing.timeline}`)
  if (framing.constraints) parts.push(`Constraints: ${framing.constraints}`)
  if (framing.risks) parts.push(`Risks: ${framing.risks}`)
  if (framing.uncertainties) parts.push(`Uncertainties: ${framing.uncertainties}`)

  return parts.join('\n\n')
}

/**
 * Build brief from scenario framing, with fallback and CEE-spec truncation.
 */
function buildBrief(framing: {
  title?: string
  goal?: string
  timeline?: string
  constraints?: string
  risks?: string
  uncertainties?: string
} | null): string {
  const brief = composeBriefText(framing)

  // Ensure minimum length (10 chars per CEE spec)
  if (brief.length < 10) {
    return DEFAULT_BRIEF
  }

  // Truncate to max length (10000 chars per CEE spec)
  return brief.slice(0, 10000)
}

/**
 * Map UI selection to CEE selection format
 */
function mapSelection(selection: {
  nodeIds: Set<string>
  edgeIds: Set<string>
}): WorkingSetRequest['selection'] | undefined {
  if (selection.nodeIds.size > 0) {
    return { node_id: Array.from(selection.nodeIds)[0] }
  }
  if (selection.edgeIds.size > 0) {
    return { edge_id: Array.from(selection.edgeIds)[0] }
  }
  return undefined
}

/**
 * Validate and normalize response
 */
function normalizeResponse(
  data: unknown,
  clientRequestId: string,
  headers?: Headers
): NormalizedAskResponse {
  // Extract server request ID (body first, then header)
  const serverRequestId = extractServerRequestId(data, headers) ?? clientRequestId

  // Cross-check header in dev mode
  if (import.meta.env.DEV && headers) {
    const headerRequestId = headers.get('X-CEE-Request-ID')
    if (headerRequestId && serverRequestId !== headerRequestId) {
      console.warn('[useAsk] Request ID mismatch', {
        body: serverRequestId,
        header: headerRequestId,
      })
    }
  }

  // Handle invalid response
  if (!data || typeof data !== 'object') {
    return {
      serverRequestId,
      clientRequestId,
      text: 'Unable to process response',
      model_actions: [],
      highlights: [],
      provenance: [],
      raw: data,
    }
  }

  const response = data as AskResponse

  // Validate and filter model_actions
  const model_actions = (response.model_actions || []).filter(isModelAction)

  // Validate and filter highlights
  const highlights = (response.highlights || []).filter(isHighlight)

  // Provenance is passed through with less strict validation
  const provenance = (response.why || []) as ProvenanceItem[]

  return {
    serverRequestId,
    clientRequestId,
    text: response.message || '',
    model_actions,
    highlights,
    provenance,
    followUpQuestion: response.follow_up_question,
    raw: data,
  }
}

// =============================================================================
// API Function
// =============================================================================

/**
 * Call CEE /assist/v1/ask endpoint with WorkingSetRequest
 */
export async function askEndpoint(
  userMessage: string,
  nodes: Node[],
  edges: Edge[],
  scenarioId: string | null,
  framing: Parameters<typeof buildBrief>[0],
  selection: { nodeIds: Set<string>; edgeIds: Set<string> },
  baseUrl?: string,
  signal?: AbortSignal,
): Promise<NormalizedAskResponse> {
  // Generate client request ID (UUID v4)
  const clientRequestId = generateRequestId()

  // Build graph snapshot FIRST (before preflight)
  const graphSnapshot = prepareGraphSnapshot(nodes, edges)

  // Preflight check on the TRANSFORMED graph
  const preflight = checkAskPreflight(graphSnapshot.nodes, graphSnapshot.edges)
  if (!preflight.allowed) {
    throw new AskPreflightError(preflight.reason!, preflight)
  }

  // Build WorkingSetRequest
  const payload: WorkingSetRequest = {
    request_id: clientRequestId, // Optional but recommended for tracing
    scenario_id: scenarioId ?? `scenario-${Date.now()}`,
    graph_schema_version: GRAPH_SCHEMA_VERSION,
    brief: buildBrief(framing),
    message: userMessage, // Was "text" in old implementation
    graph_snapshot: graphSnapshot,
    market_context: DEFAULT_MARKET_CONTEXT,
    selection: mapSelection(selection),
  }

  // Make request via BFF (BFF handles auth to CEE)
  const endpoint = baseUrl ? `${baseUrl}/ask` : ASK_ENDPOINT
  let response: Response

  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': clientRequestId, // Required header
        },
        body: JSON.stringify(payload),
        signal, // caller-provided AbortSignal (merged with timeout by fetchWithTimeout)
      },
      ASK_TIMEOUT_MS,
    )
  } catch (networkError) {
    // Timeout → user-visible error
    if (networkError instanceof FetchTimeoutError) {
      throw new AskApiError({
        code: 'TIMEOUT',
        message: `Request timed out after ${ASK_TIMEOUT_MS / 1000}s. The model may be processing a complex graph — please try again.`,
        retryable: true,
      })
    }
    // Abort (unmount or explicit cancel) — caller distinguishes via mountedRef
    if (networkError instanceof Error && networkError.name === 'AbortError') {
      throw new AskApiError({
        code: 'CANCELLED',
        message: 'Request was cancelled.',
        retryable: false,
      })
    }
    throw new AskApiError({
      code: 'NETWORK_ERROR',
      message: networkError instanceof Error ? networkError.message : 'Network request failed',
      retryable: true,
    })
  }

  // Safe response parsing (handle non-JSON errors)
  let body: unknown
  try {
    body = await response.json()
  } catch (parseError) {
    throw new AskApiError({
      code: 'PARSE_ERROR',
      message: `Server returned invalid response: ${response.status} ${response.statusText}`,
      retryable: response.status >= 500,
    })
  }

  // Handle error responses
  if (!response.ok) {
    const errorBody = body as AskErrorResponse
    throw new AskApiError({
      code: errorBody.code || `HTTP_${response.status}`,
      message: errorBody.message || `Request failed with status ${response.status}`,
      details: errorBody.details,
      retryable: errorBody.retryable ?? response.status >= 500,
    })
  }

  // Normalize and validate response
  return normalizeResponse(body, clientRequestId, response.headers)
}

// =============================================================================
// Hook
// =============================================================================

/**
 * useAsk hook for CEE /assist/v1/ask endpoint
 *
 * Sends WorkingSetRequest with all required fields.
 * Automatically includes current graph state and scenario context.
 *
 * @param options - Optional configuration
 * @returns TanStack mutation result
 *
 * @example
 * const { mutate, isPending, data, error } = useAsk({
 *   onHighlight: (highlights) => highlightDispatch.dispatch(highlights)
 * })
 *
 * // Ask a question (graph context included automatically)
 * mutate('What should I focus on?')
 *
 * // Check for preflight error
 * if (error instanceof AskPreflightError) {
 *   showWarning(error.message)
 * }
 */
export function useAsk(
  options: UseAskOptions = {}
): UseMutationResult<NormalizedAskResponse, Error, string> & {
  /** Ask with explicit nodes/edges (for testing or custom contexts) */
  askWithGraph: (message: string, nodes: Node[], edges: Edge[]) => void
} {
  // Get current state from store
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const framing = useCanvasStore(s => s.currentScenarioFraming)
  const selection = useCanvasStore(s => s.selection)

  // Abort in-flight request on unmount or new request
  const abortControllerRef = useRef<AbortController | null>(null)
  // Track mount state to distinguish unmount abort (silent) from user cancel (visible)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Abort any in-flight request on unmount
      abortControllerRef.current?.abort()
    }
  }, [])

  const mutation = useMutation<NormalizedAskResponse, Error, string>({
    mutationFn: (userMessage: string) => {
      // Abort previous in-flight request (if any)
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      return askEndpoint(
        userMessage,
        nodes,
        edges,
        scenarioId,
        framing,
        selection,
        options.baseUrl,
        controller.signal,
      )
    },
    onSuccess: (data) => {
      // Trigger highlight callback
      if (options.onHighlight && data.highlights.length > 0) {
        options.onHighlight(data.highlights)
      }

      // Trigger actions callback
      if (options.onActions && data.model_actions.length > 0) {
        options.onActions(data.model_actions)
      }

      // Trigger trace callback
      if (options.onTrace) {
        options.onTrace({
          clientRequestId: data.clientRequestId,
          serverRequestId: data.serverRequestId,
        })
      }
    },
    onError: (error) => {
      // Suppress CANCELLED errors caused by unmount — component is gone, no state to update
      if (
        !mountedRef.current &&
        error instanceof AskApiError &&
        error.code === 'CANCELLED'
      ) {
        return
      }
    },
  })

  // Helper for explicit graph context (useful for testing)
  const askWithGraph = useCallback(
    (message: string, customNodes: Node[], customEdges: Edge[]) => {
      // Abort previous in-flight request
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      mutation.mutate(message, {
        // Override the mutation function for this call
        onMutate: () => {
          return askEndpoint(
            message,
            customNodes,
            customEdges,
            scenarioId,
            framing,
            selection,
            options.baseUrl,
            controller.signal,
          )
        },
      } as any) // Type hack - TanStack Query doesn't directly support this
    },
    [mutation, scenarioId, framing, selection, options.baseUrl],
  )

  return {
    ...mutation,
    askWithGraph,
  }
}

/**
 * Type-safe query key for ask mutations
 */
export const askQueryKey = ['cee', 'ask'] as const

/**
 * Check if error is a preflight error
 */
export function isPreflightError(error: unknown): error is AskPreflightError {
  return error instanceof AskPreflightError
}

/**
 * Check if error is an API error
 */
export function isApiError(error: unknown): error is AskApiError {
  return error instanceof AskApiError
}

export default useAsk
