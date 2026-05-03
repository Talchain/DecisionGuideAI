/**
 * V5 response parser — validates raw fetch responses against the
 * OlumiResponse schema from @talchain/schemas/boundary. Fails closed to a
 * typed error result; never throws past this boundary.
 *
 * v5-ui-exclusive-path brief: one-shot buffered JSON parse only (no
 * streaming). Failure modes — non-JSON body, non-2xx with non-BoundaryError
 * body, 2xx with invalid OlumiResponse — all surface as `parse_error` for
 * the router to map to a typed-error RenderTarget.
 *
 * Diagnostic enhancements (v5-non-edge-proxy-routing):
 * - Reads `res.text()` first, then `JSON.parse()` — preserves raw body on
 *   non-JSON failures for debugging Netlify Edge / proxy / CEE errors.
 * - Classifies error source from response body and headers.
 * - Captures safe diagnostic headers (service, build, request-id).
 */
import {
  OlumiResponseSchema,
  BoundaryErrorSchema,
  type OlumiResponse,
  type BoundaryError,
} from '@talchain/schemas/boundary';

// ---------------------------------------------------------------------------
// Error source classification
// ---------------------------------------------------------------------------

/**
 * Where the error originated.
 * - `netlify`: Netlify Edge infrastructure killed the request (body contains
 *   "edge function timed out" or headers indicate Netlify).
 * - `cee`: CEE service returned an error (has x-olumi-service header).
 * - `plot`: PLoT analysis service error (x-olumi-service: isl or plot, or
 *   ISL-specific error codes in the body).
 * - `proxy`: Browser proxy returned a structured proxy error.
 * - `browser_timeout`: The browser's AbortController fired (caller sets this).
 * - `unknown`: Cannot determine origin.
 */
export type ErrorSource = 'netlify' | 'cee' | 'plot' | 'proxy' | 'browser_timeout' | 'unknown';

/** Safe subset of response headers for diagnostics. */
export interface DiagnosticHeaders {
  server?: string
  'x-olumi-service'?: string
  'x-olumi-service-build'?: string
  'x-request-id'?: string
  'x-olumi-response-hash'?: string
  'x-proxy-source'?: string
  'x-proxy-duration-ms'?: string
}

const DIAGNOSTIC_HEADER_NAMES: ReadonlyArray<keyof DiagnosticHeaders> = [
  'server',
  'x-olumi-service',
  'x-olumi-service-build',
  'x-request-id',
  'x-olumi-response-hash',
  'x-proxy-source',
  'x-proxy-duration-ms',
]

function captureDiagnosticHeaders(res: Response): DiagnosticHeaders {
  const headers: DiagnosticHeaders = {}
  for (const name of DIAGNOSTIC_HEADER_NAMES) {
    const value = res.headers.get(name)
    if (value) {
      headers[name] = value
    }
  }
  return headers
}

function classifyErrorSource(bodyText: string, res: Response): ErrorSource {
  // Netlify Edge infrastructure timeout — plain text, not JSON
  if (
    bodyText.includes('edge function') &&
    bodyText.includes('timed out')
  ) {
    return 'netlify'
  }
  // Server header from Netlify
  const server = res.headers.get('server')
  if (server && server.toLowerCase().includes('netlify')) {
    return 'netlify'
  }

  // PLoT/ISL analysis service — check before generic CEE check since ISL is
  // a sub-service that runs within the CEE pipeline. x-olumi-service: isl or
  // plot signals an error from the analysis layer specifically.
  const serviceHeader = res.headers.get('x-olumi-service')
  if (serviceHeader === 'isl' || serviceHeader === 'plot') {
    return 'plot'
  }

  // CEE service header (any other x-olumi-service value)
  if (serviceHeader) {
    return 'cee'
  }

  // Browser proxy structured error
  try {
    const parsed = JSON.parse(bodyText)
    if (parsed?.error?.source === 'proxy') return 'proxy'
  } catch {
    // Not JSON — already handled
  }

  return 'unknown'
}

/** Truncate raw body for safe diagnostic storage (no secrets). */
function truncateBody(text: string, maxLen = 500): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + `... [truncated, total ${text.length} chars]`
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type V5ParseResult =
  | { kind: 'response'; response: OlumiResponse }
  | { kind: 'boundary_error'; error: BoundaryError }
  | {
      kind: 'parse_error'
      reason: string
      http_status?: number
      raw?: unknown
      source?: ErrorSource
      diagnosticHeaders?: DiagnosticHeaders
    };

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export async function parseV5Response(res: Response): Promise<V5ParseResult> {
  // Read as text first so we always have the raw body for diagnostics.
  // This is a change from the previous `res.json()` approach — it ensures
  // non-JSON responses (Netlify "edge function timed out", proxy HTML errors,
  // etc.) are captured instead of lost in a generic SyntaxError.
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    return {
      kind: 'parse_error',
      reason: `failed to read response body (${(e as Error).message})`,
      http_status: res.status,
      source: 'unknown',
      diagnosticHeaders: captureDiagnosticHeaders(res),
    };
  }

  // Attempt JSON parse
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const source = classifyErrorSource(text, res);
    return {
      kind: 'parse_error',
      reason: `non-json response body (${(e as Error).message})`,
      http_status: res.status,
      raw: truncateBody(text),
      source,
      diagnosticHeaders: captureDiagnosticHeaders(res),
    };
  }

  // A typed BoundaryError is returned with a non-2xx status (e.g. 422).
  if (!res.ok) {
    const asError = BoundaryErrorSchema.safeParse(raw);
    if (asError.success) {
      return { kind: 'boundary_error', error: asError.data };
    }
    // Non-2xx but not a BoundaryError — capture diagnostics
    const source = classifyErrorSource(text, res);
    return {
      kind: 'parse_error',
      reason: `non-ok status ${res.status} and body is not a BoundaryError`,
      http_status: res.status,
      raw,
      source,
      diagnosticHeaders: captureDiagnosticHeaders(res),
    };
  }

  // 2xx path: must parse as OlumiResponse.
  const parsed = OlumiResponseSchema.safeParse(raw);
  if (parsed.success) {
    return { kind: 'response', response: parsed.data };
  }
  return {
    kind: 'parse_error',
    reason: 'body did not match OlumiResponse schema',
    http_status: res.status,
    raw,
  };
}
