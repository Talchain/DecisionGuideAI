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
 * Endpoint resolution — FAIL CLOSED, single source.
 *
 * `VITE_V5_ENDPOINT` is the ONLY source. Absent, blank or non-string ⇒ throw
 * `V5EndpointNotConfiguredError`. There is deliberately no fallback.
 *
 * ── WHY THERE IS NO FALLBACK (2026-08-29) ─────────────────────────────────────
 * This resolver used to fall back to `${VITE_ORCHESTRATOR_BASE}/orchestrate/v2/turn`
 * and then to `/bff/orchestrate/v2/turn`. BOTH rungs now point at a route that is
 * deliberately closed or actively unsafe:
 *
 *   - `/bff/orchestrate/*` was CLOSED at the Netlify edge on 2026-08-28
 *     (`orchestrator-proxy.ts`: `ALLOWED_TARGETS = []`) after a wire-witnessed
 *     anonymous scenario-ownership takeover. PROBED 2026-08-29 against
 *     `https://staging--olumi.netlify.app` with an allowed Origin:
 *     `/bff/orchestrate/v2/turn` ⇒ 404 `{"error":"Not found"}` (the edge-block
 *     sentinel), while the off-prefix control returned SPA HTML and the live
 *     control `/bff/cee/graph-readiness` reached CEE (400 `cee.error.v1`).
 *   - `${VITE_ORCHESTRATOR_BASE}/orchestrate/v2/turn` is WORSE: it addresses CEE
 *     directly, bypassing the very edge block that is the remedy, and lands on
 *     the route carrying the ownership defect.
 *
 * So a missing variable used to silently select a closed endpoint (an outage) or
 * the vulnerable one (a security regression). Neither is a safe default, and the
 * failure was invisible: Vite CONSTANT-FOLDS this function at build time, so the
 * rung is chosen when the bundle is built, from dashboard state nobody can see.
 * Measured in the deployed bundle at b7ce774d: `resolveEndpoint` had folded to a
 * single `return "https://cee-staging.onrender.com/proxy/v5/turn"` and the string
 * `/bff/orchestrate/v2/turn` appeared ZERO times — clearing one dashboard
 * variable would have changed what the NEXT build baked, with nothing to catch it.
 *
 * Throwing is safe here: this runs on TURN DISPATCH, never at module load or
 * first paint, so a misconfiguration surfaces as a turn error the UI already
 * renders — not a blank screen. `scripts/ci/assert-v5-endpoint-configured.mjs`
 * additionally fails the BUILD when the variable is absent, so the runtime throw
 * is the second line of defence, not the first.
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

/**
 * Thrown when no V5 endpoint is configured. Named so callers and tests can bind
 * to the identity rather than to message text.
 */
export class V5EndpointNotConfiguredError extends Error {
  constructor() {
    super(
      'VITE_V5_ENDPOINT is not configured. The V5 orchestration endpoint has no ' +
        'fallback: the legacy /bff/orchestrate/* family is closed at the edge and ' +
        'must never be selected implicitly. Set VITE_V5_ENDPOINT and redeploy.',
    );
    this.name = 'V5EndpointNotConfiguredError';
  }
}

function resolveEndpoint(): string {
  // ⚠ Correct for ABSENT, not merely for falsy. `undefined`, `null`, `''` and a
  // whitespace-only value are all "not configured" and take the SAME branch —
  // the defect class this replaces was an exact-match predicate where absent and
  // explicitly-false behaved identically but only one of them was intended.
  const override: unknown = import.meta.env?.VITE_V5_ENDPOINT;
  if (typeof override === 'string' && override.trim().length > 0) {
    return override.trim();
  }
  throw new V5EndpointNotConfiguredError();
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
