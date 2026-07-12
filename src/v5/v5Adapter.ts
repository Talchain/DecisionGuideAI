/**
 * V5 adapter — one-shot POST to /orchestrate/v2/turn.
 *
 * v5-ui-exclusive-path brief (Phase 3): the adapter no longer gates on the
 * feature flag. Callers are responsible for calling this only when
 * `VITE_ENABLE_V5_ORCHESTRATOR === 'true'` (see `isV5Eligible` in
 * src/v5/eligibility.ts). When the flag is off, the UI dispatches to V4
 * directly and never enters this module.
 *
 * Consumes @talchain/schemas@0.7.0 — payload is a discriminated union on
 * `kind: 'message' | 'system_event'`.
 *
 * Endpoint resolution priority:
 *   1. VITE_V5_ENDPOINT (explicit override, used in tests and dev)
 *   2. `${VITE_ORCHESTRATOR_BASE}/orchestrate/v2/turn`
 *   3. `/bff/orchestrate/v2/turn` (Netlify edge proxy — production default)
 */
import type { OrchestratorTurnPayload } from '@talchain/schemas/boundary';

import { recordRequestPayload, recordResponsePayload } from '../lib/payload-trace-store';
import {
  ADDITIVE_EXTENSIONS_KEY,
  parseV5Response,
  type OlumiResponseWithExtensions,
  type V5ParseResult,
} from './responseParser';

export type V5CallResult = V5ParseResult;

function resolveEndpoint(): string {
  const override = import.meta.env.VITE_V5_ENDPOINT as string | undefined;
  if (override && override.length > 0) return override;
  const base = import.meta.env.VITE_ORCHESTRATOR_BASE as string | undefined;
  if (base && base.length > 0) return `${base}/orchestrate/v2/turn`;
  return '/bff/orchestrate/v2/turn';
}

export interface V5CallOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export async function callV5Turn(
  payload: OrchestratorTurnPayload,
  opts: V5CallOptions = {},
): Promise<V5CallResult> {
  const url = resolveEndpoint();
  const fetchFn = opts.fetchImpl ?? fetch;

  const requestId = crypto.randomUUID();
  const requestedAt = Date.now();

  // Auth headers are already redacted downstream: the trace store runs
  // headers through redactPayload, whose default sensitiveKeys include
  // 'authorization' (case-insensitive) plus free-form Bearer/JWT scrubbing
  // (src/utils/payloadRedaction.ts) — verified in the PR #268 review.
  recordRequestPayload({
    id: requestId,
    endpoint: url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    body: payload,
  });

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify(payload),
      signal: opts.signal,
    });
  } catch (e) {
    const err = e as Error;
    // Preserve AbortError so callers can distinguish user-initiated cancel
    // from network failure. The parser layer treats anything else as
    // `parse_error`, matching fail-closed policy.
    if (err.name === 'AbortError') {
      recordResponsePayload({
        id: requestId,
        status: 0,
        headers: {},
        body: null,
        duration: Date.now() - requestedAt,
        error: 'AbortError',
        errorName: 'AbortError',
        source: 'browser_timeout',
      });
      throw err;
    }

    // P0 fix (2026-05): capture native Error.name and a safe cause
    // representation so the diagnostic bundle can distinguish "Failed to
    // fetch" from offline / DNS / CORS-preflight-blocked.
    //
    // P1 fix (2026-05): pass the FULL cause string to the store —
    // truncation now happens AFTER redaction inside the store. Earlier
    // truncation here could chop a JWT or bearer token across the 200
    // char boundary, defeating the secret-shape regex (which requires
    // the full three-segment JWT pattern to match).
    const errorName = err.name || 'Error';
    const causeRaw = (() => {
      const cause: unknown = (err as Error & { cause?: unknown }).cause;
      if (cause === undefined || cause === null) return undefined;
      if (typeof cause === 'string') return cause;
      if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
      try {
        return JSON.stringify(cause);
      } catch {
        return undefined;
      }
    })();

    // "TypeError: Failed to fetch" is the canonical Chromium signal for
    // a blocked CORS preflight or network failure. Firefox uses
    // "TypeError: NetworkError when attempting to fetch resource."
    // Either way, the response body / status of the preflight itself is
    // not exposed to JS.
    const isLikelyPreflightOrNetwork =
      err.name === 'TypeError' &&
      (err.message.includes('Failed to fetch') ||
        err.message.includes('NetworkError') ||
        err.message.includes('Network request failed'));

    recordResponsePayload({
      id: requestId,
      status: 0,
      headers: {},
      body: null,
      duration: Date.now() - requestedAt,
      error: err.message,
      errorName,
      ...(causeRaw ? { errorCause: causeRaw } : {}),
      source: isLikelyPreflightOrNetwork ? 'preflight_or_network' : 'unknown',
    });
    return {
      kind: 'parse_error',
      reason: `network error: ${err.message}`,
    };
  }

  const parsed = await parseV5Response(res);

  // Build a trace-safe diagnostic body.
  //
  // The parser attaches its additive-extensions sidecar (top-level keys
  // outside the strict schema + v1.3 Phase 3 blocks tolerated out of
  // `blocks[]`) as a NON-ENUMERABLE property so it stays invisible to
  // JSON.stringify and normal enumeration. The diagnostic trace store
  // redacts via Object.keys (src/utils/payloadRedaction.ts:247), which
  // SKIPS non-enumerable properties — dropping the sidecar before the
  // debug bundle can read it. Promote the sidecar to an ENUMERABLE
  // property on a shallow clone so it survives redaction. The runtime
  // `parsed.response` object stays untouched (its sidecar remains
  // non-enumerable for non-diagnostic consumers).
  let traceBody: unknown
  if (parsed.kind === 'response') {
    const additive = (parsed.response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY]
    traceBody = additive
      ? { ...parsed.response, [ADDITIVE_EXTENSIONS_KEY]: additive }
      : parsed.response
  } else {
    traceBody = parsed
  }

  recordResponsePayload({
    id: requestId,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: traceBody,
    duration: Date.now() - requestedAt,
  });
  return parsed;
}

/** Return the currently resolved V5 endpoint for diagnostic recording. */
export function getV5Endpoint(): string {
  return resolveEndpoint();
}

// Exposed for the adapter's own tests.
export const __internals = { resolveEndpoint };
