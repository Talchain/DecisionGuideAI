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
import { parseV5Response, type V5ParseResult } from './responseParser';

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

  // TODO: redact auth headers when auth is enabled
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
      });
      throw err;
    }
    recordResponsePayload({
      id: requestId,
      status: 0,
      headers: {},
      body: null,
      duration: Date.now() - requestedAt,
      error: err.message,
    });
    return {
      kind: 'parse_error',
      reason: `network error: ${err.message}`,
    };
  }

  const parsed = await parseV5Response(res);
  recordResponsePayload({
    id: requestId,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: parsed.kind === 'response' ? parsed.response : parsed,
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
