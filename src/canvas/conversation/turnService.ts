/**
 * TurnService — HTTP client for the orchestrator endpoint
 *
 * Calls POST /orchestrate/v1/turn on CEE staging. When the
 * orchestratorV2 flag is OFF, callers should not invoke this —
 * use the existing useCEEDraft path instead.
 *
 * ## Orchestrator Request Contract (OrchestratorTurnRequest)
 *
 * Required fields:
 *   scenario_id     string   — Session/scenario identifier (e.g. "session-<ts>")
 *   message         string   — User's message text (brief on first turn)
 *   client_turn_id  string   — UUID for deduplication / idempotency
 *
 * Required (sent every turn):
 *   conversation_history  ConversationTurnPair[]  — Last 5 user/assistant pairs
 *   graph_state           { nodes: Node[], edges: Edge[] }  — Full canvas graph
 *   analysis_state        { has_results: bool, last_run_hash: string | null }
 *
 * Optional:
 *   selected_elements  { node_ids?: string[], edge_ids?: string[] }
 *   analysis_inputs    { options: AnalysisInputOption[], goal_node_id: string }
 *   system_event       SystemEventWire | SystemEvent  — For graph edits, patch accept/dismiss
 *   turn_nonce         string  — Additional idempotency nonce
 *
 * ## Response: OrchestratorResponseEnvelopeV2
 *
 *   assistant_text    string         — Main response text
 *   blocks?           ConversationBlock[]  — Inline blocks (commentary, graph_patch, etc.)
 *   suggested_actions?  ActionChip[] — Suggested follow-up actions
 *   stage_indicator?    ScenarioStage
 *   guidance_items?     GuidanceItem[]
 *   analysis_response?  V2RunResponse  — When orchestrator ran analysis
 *   analysis_error?     { code, message }
 *   client_turn_id?     string  — Echoed for dedup
 *
 * ## Auth
 *
 * Authentication is handled by the proxy layer (Netlify edge function or Vite dev proxy),
 * which injects X-Olumi-Assist-Key from the ASSIST_API_KEY env var. The client does NOT
 * send auth headers — they are added server-side to keep secrets out of the browser.
 *
 * ## Error responses
 *
 * CEE returns structured errors:
 *   { turn_id: string, error: { code: string, message: string, recoverable: boolean } }
 *
 * Common codes:
 *   INVALID_REQUEST  — Fastify schema validation failed (400)
 *   UNAUTHENTICATED  — Missing/invalid X-Olumi-Assist-Key (401)
 *   INTERNAL         — Server error (500)
 */

import type {
  OrchestratorResponseEnvelopeV2,
} from './types'
import { computePayloadHash } from '../../lib/canonical-hash'
import { recordRequest, recordResponse } from '../../lib/debug-state'
import { recordRequestPayload, recordResponsePayload } from '../../lib/payload-trace-store'
import { stripDevTurnType, validateTurnRequestBoundary, type TurnRequestPayload } from '../../services/turn-request-builder'

// In production/staging, route through Netlify edge function proxy at /bff/orchestrate
// to avoid CORS issues (CEE backend lacks CORS on /orchestrate/* routes).
// The proxy maps /bff/orchestrate/v1/turn → cee-staging.onrender.com/orchestrate/v1/turn.
// In dev, Vite's proxy config forwards /bff/orchestrate to the CEE backend.
// Only fall back to direct URL if VITE_ORCHESTRATOR_BASE is explicitly set.
const ORCHESTRATOR_URL =
  import.meta.env.VITE_ORCHESTRATOR_BASE
    ? `${import.meta.env.VITE_ORCHESTRATOR_BASE}/orchestrate/v1/turn`
    : '/bff/orchestrate/v1/turn'

const ORCHESTRATOR_TIMEOUT_MS = 60_000

const LOG_PREFIX = '[turnService]'

export class OrchestratorError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    /** x-request-id from CEE response for correlation */
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = 'OrchestratorError'
  }
}

/**
 * Summarise the shape of a request payload for debug logging.
 * Logs keys and types — never logs values (may contain user content).
 */
function describePayloadShape(obj: Record<string, unknown>): Record<string, string> {
  const shape: Record<string, string> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue
    if (val === null) { shape[key] = 'null'; continue }
    if (Array.isArray(val)) { shape[key] = `array(${val.length})`; continue }
    if (typeof val === 'object') {
      shape[key] = `object{${Object.keys(val as Record<string, unknown>).join(',')}}`
      continue
    }
    shape[key] = typeof val
  }
  return shape
}

/**
 * Send a turn to the orchestrator and return the parsed envelope.
 *
 * Includes comprehensive request/response logging for debugging boundary
 * mismatches with the CEE backend.
 *
 * @param request - The turn request payload
 * @param signal  - Optional AbortSignal for cancellation
 * @throws OrchestratorError on non-2xx responses
 */
export async function callOrchestratorTurn(
  request: TurnRequestPayload,
  signal?: AbortSignal,
): Promise<OrchestratorResponseEnvelopeV2> {
  const startTime = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS)

  // Combine external signal with timeout
  const combinedSignal = signal
    ? combineSignals(signal, controller.signal)
    : controller.signal

  validateTurnRequestBoundary(request)
  const wireRequest = stripDevTurnType(request)
  const requestBody = JSON.stringify(wireRequest)
  const requestId = request.client_turn_id
  const payloadHash = await computePayloadHash(wireRequest)

  recordRequest({
    requestId,
    endpoint: ORCHESTRATOR_URL,
    method: 'POST',
    payloadHash,
  })

  recordRequestPayload({
    id: requestId,
    endpoint: ORCHESTRATOR_URL,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: wireRequest,
  })

  // Log request diagnostics (shape only — no user content)
  console.warn(LOG_PREFIX, 'Request', {
    url: ORCHESTRATOR_URL,
    method: 'POST',
    bodyBytes: requestBody.length,
    payloadShape: describePayloadShape(wireRequest as unknown as Record<string, unknown>),
    clientTurnId: request.client_turn_id,
  })

  try {
    const response = await fetch(ORCHESTRATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      signal: combinedSignal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      let body: unknown
      try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
      const elapsedMs = Math.max(1, Date.now() - startTime)

      recordResponse(requestId, {
        status: response.status,
        elapsedMs,
        error: typeof (body as Record<string, unknown>)?.error === 'object'
          ? String(((body as Record<string, unknown>).error as Record<string, unknown>)?.message ?? response.statusText)
          : String((body as Record<string, unknown>)?.message ?? response.statusText),
      })
      recordResponsePayload({
        id: requestId,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
        duration: elapsedMs,
        error: typeof (body as Record<string, unknown>)?.message === 'string'
          ? (body as Record<string, unknown>).message as string
          : response.statusText,
      })

      // Log full error response — this is critical for debugging 400s
      console.error(LOG_PREFIX, `Error ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        url: ORCHESTRATOR_URL,
        responseBody: body,
        requestPayloadShape: describePayloadShape(wireRequest as unknown as Record<string, unknown>),
        clientTurnId: request.client_turn_id,
        responseHeaders: {
          'x-request-id': response.headers.get('x-request-id'),
          'x-olumi-trace-received': response.headers.get('x-olumi-trace-received'),
          'x-olumi-service-build': response.headers.get('x-olumi-service-build'),
        },
      })

      const errorMessage =
        (body as Record<string, any>)?.error?.message ||
        (body as Record<string, any>)?.message ||
        `Orchestrator returned ${response.status}`

      throw new OrchestratorError(
        errorMessage,
        response.status,
        body,
        response.headers.get('x-request-id') ?? undefined,
      )
    }

    const envelope = (await response.json()) as OrchestratorResponseEnvelopeV2
    const elapsedMs = Math.max(1, Date.now() - startTime)

    recordResponse(requestId, {
      status: response.status,
      elapsedMs,
      error: undefined,
    })
    recordResponsePayload({
      id: requestId,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: envelope,
      duration: elapsedMs,
    })

    console.warn(LOG_PREFIX, 'Response OK', {
      status: response.status,
      hasBlocks: Array.isArray(envelope.blocks) ? envelope.blocks.length : 0,
      hasGuidance: Array.isArray(envelope.guidance_items) ? envelope.guidance_items.length : 0,
      hasAnalysis: !!envelope.analysis_response,
      stageIndicator: envelope.stage_indicator ?? 'none',
      clientTurnId: envelope.client_turn_id,
    })

    return envelope
  } catch (err) {
    if (err instanceof OrchestratorError) throw err

    // Network / timeout errors
    const isTimeout = (err as Error).name === 'AbortError'
    const elapsedMs = Math.max(1, Date.now() - startTime)
    recordResponse(requestId, {
      status: 0,
      elapsedMs,
      error: (err as Error).message,
    })
    recordResponsePayload({
      id: requestId,
      status: 0,
      headers: {},
      body: null,
      duration: elapsedMs,
      error: (err as Error).message,
    })
    console.error(LOG_PREFIX, isTimeout ? 'Timeout' : 'Network error', {
      url: ORCHESTRATOR_URL,
      error: (err as Error).message,
      clientTurnId: request.client_turn_id,
    })
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Combine two AbortSignals — aborts when either fires */
function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (a.aborted || b.aborted) {
    controller.abort()
    return controller.signal
  }
  a.addEventListener('abort', abort, { once: true })
  b.addEventListener('abort', abort, { once: true })
  return controller.signal
}
