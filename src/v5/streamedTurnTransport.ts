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
import { recordRequestPayload, recordResponsePayload } from '../lib/payload-trace-store'

import { ADDITIVE_EXTENSIONS_KEY } from './responseParser'
import { StreamAbandonedError } from './streamedDraftFrames'
import { __internals as adapterInternals } from './v5Adapter'

import type { OlumiResponseWithExtensions } from './responseParser'
import type { V5CallResult } from './v5Adapter'
import type { OrchestratorTurnPayload } from '@talchain/schemas/boundary'

function streamEndpointFor(bufferedEndpoint: string): string {
  return `${bufferedEndpoint.replace(/\/+$/, '')}/stream`
}

/** The streamed sibling of whatever endpoint the buffered turn resolves to. */
export function getV5StreamEndpoint(): string {
  return streamEndpointFor(adapterInternals.resolveEndpoint())
}

/**
 * What a `stream_open` trace record carries in place of a body.
 *
 * Deliberately NOT the SSE bytes: reading them here would consume the stream
 * the caller is about to parse. Deliberately NOT `null` either, because a null
 * body reads as "the response carried nothing", which is a claim about the turn
 * rather than about this record.
 */
export const STREAM_OPEN_TRACE_BODY = {
  __trace_record_kind__: 'stream_open',
  note:
    'Transport record for the SSE OPEN only. The turn outcome arrives in the ' +
    'terminal frame (parsed by parseV5Response) or, if the stream is abandoned, ' +
    'in the buffered fallback\u2019s own trace entry.',
} as const

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
  //
  // ⚠ 2026-09-03 — THE ENTRY MUST BE SETTLED, AND UNTIL NOW IT NEVER WAS.
  // This function recorded the REQUEST side under a fresh `crypto.randomUUID()`
  // that nothing else holds, and recorded no response on any path. The trace
  // store initialises `completed: false` at request-record time and only
  // `recordResponsePayload` flips it, so every streamed turn left a
  // `completed: false, status: null` entry in the store FOREVER — indepenent of
  // what the turn did. `isV5TurnEndpoint`'s `(?:\/|$)` boundary then admits
  // `…/turn/stream` into `recent_conversation_turns`, where the permanently
  // unsettled entry is indistinguishable from a failed turn. Measured on the
  // 2026-09-03 session bundle: the cold draft SUCCEEDED (24-edge graph, analysis
  // ran on it) and the ledger recorded it as the session's third no-text turn.
  //
  // What is recorded here is the OPEN, and it says so. The turn's own outcome
  // arrives in the terminal frame, which the caller hands to `parseV5Response`;
  // when the stream is abandoned the buffered fallback issues its own request
  // and writes its own fully-settled entry. So this record must never claim a
  // turn outcome — it claims the one thing it observed, which is whether the
  // SSE response opened.
  const traceId = crypto.randomUUID()
  const requestedAt = Date.now()
  recordRequestPayload({
    id: traceId,
    endpoint: url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(opts.headers ?? {}) },
    body: payload,
  })

  // ⚠ THE `try` COVERS THE FETCH AND NOTHING ELSE — the same scoping
  // `v5Adapter.callV5Turn` uses (`let res: Response; try { res = await
  // fetchFn(…) } catch {…}`, success record after the block). Widening it to
  // enclose the success-path record would widen the catch's question from
  // *"did the fetch throw?"* to *"did the fetch throw OR did the diagnostic
  // write throw?"* — two questions under one handler, which is the estate's
  // signature defect. Concretely, a throw from `recordResponsePayload` or from
  // `res.headers.entries()` would then write a SECOND record for this same
  // `traceId` claiming `status: 0, source: 'unknown'`, and reject a 200 open as
  // `StreamAbandonedError`, which this module's header documents as triggering
  // a buffered re-send. That is exactly the defect this file exists to remove —
  // a success recorded as a failure — reappearing one branch over.
  let res: Response
  try {
    res = await fetchFn(url, {
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
    // Same three-way classification the buffered adapter writes, for the same
    // reason: `status: 0` on its own cannot tell an abort from a network throw,
    // and those two want opposite user-facing copy.
    const isAbort = err?.name === 'AbortError'
    const isLikelyPreflightOrNetwork =
      err?.name === 'TypeError' &&
      (err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('Network request failed'))
    recordResponsePayload({
      id: traceId,
      status: 0,
      headers: {},
      body: null,
      duration: Date.now() - requestedAt,
      error: err?.message ?? 'unknown',
      errorName: err?.name || 'Error',
      source: isAbort
        ? 'browser_timeout'
        : isLikelyPreflightOrNetwork
          ? 'preflight_or_network'
          : 'unknown',
    })
    if (isAbort) {
      throw new StreamAbandonedError('aborted', 'streamed turn aborted before any frame')
    }
    throw new StreamAbandonedError(
      'transport',
      `streamed turn could not be opened: ${err?.message ?? 'unknown'}`,
    )
  }

  // `res.body` is the live SSE stream and is deliberately NOT read here —
  // consuming it would starve the caller's frame reader. The body recorded is a
  // marker naming what this record is and where the outcome actually lives.
  recordResponsePayload({
    id: traceId,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: STREAM_OPEN_TRACE_BODY,
    duration: Date.now() - requestedAt,
  })
  return res
}

/**
 * Header stamped on the terminal-ingest trace record, so a bundle reader can
 * tell it from a genuinely buffered turn. The record is deliberately filed
 * under the BUFFERED endpoint (see `recordStreamedTerminalIngest`); this is
 * where that choice is disclosed rather than hidden.
 */
export const STREAM_TERMINAL_INGEST_HEADER = 'x-olumi-trace-record-kind'
export const STREAM_TERMINAL_INGEST_KIND = 'streamed_terminal_ingest'

/**
 * Record the streamed turn's TERMINAL FRAME as a settled trace entry.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * `openV5TurnStream` records the SSE OPEN and, by design, nothing else: its
 * body is `STREAM_OPEN_TRACE_BODY` and its own spec pins that BY REFERENCE,
 * because a record that never observed the turn must not claim a turn
 * outcome. The consequence, unnoticed until 2026-09-10, is that a streamed
 * cold draft that SUCCEEDS leaves the trace store with no record of the
 * response body at all. `payloads.cee_response` in the debug bundle is
 * `findBestPayload(..., 'CEE')?.response?.body` — so on the streamed path it
 * resolved to the OPEN MARKER, and every top-level key CEE returned was
 * simply absent from the bundle. `_prompt_capture` — the verbatim served
 * system prompt — is returned ONLY on a cold draft, which is exactly and
 * only the turn shape that takes this route (`streamedDraftEligible`). The
 * one turn carrying the prompt was the one turn whose body was never
 * recorded.
 *
 * ── WHY THE BUFFERED ENDPOINT, NOT THE STREAM ENDPOINT ───────────────────
 * `detectService` derives the service FROM the endpoint, so the record must
 * carry a CEE endpoint to be reachable at all. Given that, the choice is
 * between the stream sibling and the buffered original, and it is NOT
 * cosmetic: `readTransportKind` in `recentConversationTurns.ts` matches
 * `/turn/<sub>$`, and `deriveOutcome`'s FIRST branch short-circuits anything
 * that is not `buffered_turn` to `outcome: 'transport_leg'` — before it ever
 * looks at `assistant_text`. Filed under `.../turn/stream`, this record
 * would score as a second transport leg and `turn_record_count` would stay
 * ZERO for a turn that was answered.
 *
 * The buffered endpoint is also the ACCURATE description of what this record
 * holds. This module's header states the property: the terminal frame's
 * `payload` IS the buffered body, handed to the buffered path's own parser,
 * byte-equivalent by construction. And it makes the streamed SUCCESS path
 * produce the same ledger shape the streamed FALLBACK path already produces
 * — where the buffered re-send writes exactly this record itself. The
 * transport truth is not lost: it is stamped on the response headers.
 *
 * ── SETTLED IN ONE CALL ──────────────────────────────────────────────────
 * Request and response are recorded together, synchronously. A request-only
 * entry would be read by `detectFailedHttpRecord` as a FAILED V5 HTTP record
 * for the whole session — the exact defect this module's header documents
 * removing, reintroduced one record over.
 */
export function recordStreamedTerminalIngest(params: {
  payload: OrchestratorTurnPayload
  parsed: V5CallResult
  statusCode: number
  durationMs: number
  headers?: Record<string, string>
}): void {
  const id = crypto.randomUUID()
  const endpoint = adapterInternals.resolveEndpoint()

  recordRequestPayload({
    id,
    endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(params.headers ?? {}),
    },
    // The turn payload VERBATIM, exactly as the buffered adapter records it.
    // Selectors such as `readTurnOrActionType` read this body; a marker here
    // would make the streamed turn invisible to them.
    body: params.payload,
  })

  // Promote the parser's additive-extensions sidecar to an ENUMERABLE
  // property on a shallow clone. `parseV5Response` attaches it
  // non-enumerable, and the redactor walks `Object.keys`, which skips
  // non-enumerable properties — so without this the sidecar is destroyed
  // before the bundle can read it, and `_prompt_capture` (an unknown
  // top-level key, therefore a sidecar key) never arrives. Same promotion,
  // and the same reason, as `v5Adapter.callV5Turn`.
  let traceBody: unknown
  if (params.parsed.kind === 'response') {
    const additive = (params.parsed.response as OlumiResponseWithExtensions)[
      ADDITIVE_EXTENSIONS_KEY
    ]
    traceBody = additive
      ? { ...params.parsed.response, [ADDITIVE_EXTENSIONS_KEY]: additive }
      : params.parsed.response
  } else {
    traceBody = params.parsed
  }

  recordResponsePayload({
    id,
    status: params.statusCode,
    headers: {
      'content-type': 'application/json',
      [STREAM_TERMINAL_INGEST_HEADER]: STREAM_TERMINAL_INGEST_KIND,
    },
    body: traceBody,
    duration: params.durationMs,
  })
}

export const __streamInternals = { streamEndpointFor, terminalPayloadToResponse }
