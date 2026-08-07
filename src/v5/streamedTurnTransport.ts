/**
 * streamedTurnTransport — opening the staged V5 turn, and closing it back into
 * the buffered path's own parser (ROADMAP 2.122 / 1.204 M1).
 *
 * ── THE ENDPOINT IS DERIVED, NOT MIRRORED ────────────────────────────────
 * `<buffered endpoint> + '/stream'`, where the buffered endpoint comes from
 * `v5Adapter`'s existing resolver. A second copy of the env ladder here would
 * be CLAUDE.md trap 12 with a 404 for a failure mode — and the suffix rule is
 * not a lucky guess, it is correct on every rung (derived at the deployed
 * bytes, `PHASE0-EVIDENCE-2026-07-28/m1l2-consumer.md` F0-1):
 *
 *   VITE_V5_ENDPOINT=…/proxy/v5/turn   → …/proxy/v5/turn/stream
 *       (what staging actually bakes; the route cee2-live-latency.md measured)
 *   /bff/orchestrate/v2/turn           → /bff/orchestrate/v2/turn/stream
 *       (Netlify edge fn rewrites /bff/orchestrate/* → CEE /orchestrate/*, so
 *        this reaches #751's service sibling, and the edge fn injects the
 *        ASSIST_API_KEY that route requires)
 *
 * The edge function already forwards `accept` and passes SSE through
 * un-buffered (`duplex:'half'` + raw `response.body`), so nothing on the proxy
 * needed changing for this lane.
 *
 * ── THE TERMINAL FRAME GOES BACK THROUGH THE BUFFERED PARSER ─────────────
 * `terminalPayloadToResponse` wraps COMPLETE's `payload` + `status_code` in a
 * `Response` and the caller hands it to `parseV5Response` — the SAME function
 * the buffered turn uses, with the same validator and the same
 * additive-extensions sidecar. There is deliberately no second ingest path to
 * keep in step; "byte-equivalent" is a property of the construction here, not
 * a claim someone has to re-verify.
 */
import { recordRequestPayload } from '../lib/payload-trace-store'

import { StreamAbandonedError } from './streamedDraftFrames'
import { __internals as adapterInternals } from './v5Adapter'

import type { OrchestratorTurnPayload } from '@talchain/schemas/boundary'

function streamEndpointFor(bufferedEndpoint: string): string {
  return `${bufferedEndpoint.replace(/\/+$/, '')}/stream`
}

/** The streamed sibling of whatever endpoint the buffered turn resolves to. */
export function getV5StreamEndpoint(): string {
  return streamEndpointFor(adapterInternals.resolveEndpoint())
}

export interface OpenStreamOptions {
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
}

/**
 * Wrap the COMPLETE frame's verbatim buffered body in a `Response` so the
 * caller can run it through `parseV5Response` unchanged.
 */
function terminalPayloadToResponse(payload: unknown, statusCode: number): Response {
  return new Response(JSON.stringify(payload ?? null), {
    status: statusCode,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * POST the turn to the streamed sibling and return the open SSE `Response`.
 *
 * The payload is byte-identical to the buffered turn's — same builder, same
 * `turn_id` / `scenario_id`. That is what makes the fallback safe: re-sending
 * it on the buffered route is a RE-ENTERED turn, which CEE's own continuation
 * guard resolves (draft if not drafted, decline and describe if drafted), not
 * a second draft.
 */
export async function openV5TurnStream(
  payload: OrchestratorTurnPayload,
  opts: OpenStreamOptions = {},
): Promise<Response> {
  const url = getV5StreamEndpoint()
  const fetchFn = opts.fetchImpl ?? fetch

  // Mirror the buffered adapter's diagnostic capture so a streamed draft still
  // appears in the debug bundle.
  recordRequestPayload({
    id: crypto.randomUUID(),
    endpoint: url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(opts.headers ?? {}) },
    body: payload,
  })

  try {
    return await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    })
  } catch (e) {
    const err = e as Error
    if (err?.name === 'AbortError') {
      throw new StreamAbandonedError('aborted', 'streamed turn aborted before any frame')
    }
    throw new StreamAbandonedError(
      'transport',
      `streamed turn could not be opened: ${err?.message ?? 'unknown'}`,
    )
  }
}

export const __streamInternals = { streamEndpointFor, terminalPayloadToResponse }
