/**
 * V5 adapter — feature-flagged entry point. When VITE_ENABLE_V5_ORCHESTRATOR
 * === 'true', callers route their turn through this adapter. Otherwise, this
 * module returns a sentinel telling callers to fall back to the V4 path.
 *
 * Slice A0 scope:
 *   - buffered JSON only
 *   - one-shot POST → parseV5Response → V5CallResult
 *   - BFF proxy at /bff/orchestrate/v2/turn (see Netlify edge function config)
 *   - explicit endpoint override via VITE_V5_ENDPOINT
 */
import type { OrchestratorTurnPayload } from '@talchain/schemas/boundary';

import { parseV5Response, type V5ParseResult } from './responseParser';

export type V5FallThroughToV4 = { kind: 'fall_through_v4' };
export type V5CallResult = V5ParseResult | V5FallThroughToV4;

function isV5Enabled(): boolean {
  // Vite inlines this at build time.
  return import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR === 'true';
}

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
  if (!isV5Enabled()) {
    return { kind: 'fall_through_v4' };
  }

  const url = resolveEndpoint();
  const fetchFn = opts.fetchImpl ?? fetch;

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
    return {
      kind: 'parse_error',
      reason: `network error: ${(e as Error).message}`,
    };
  }

  return parseV5Response(res);
}

// Exposed for the adapter's own tests and the useConversation branch switch.
export const __internals = { isV5Enabled, resolveEndpoint };
