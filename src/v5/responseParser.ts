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
 *
 * Additive top-level tolerance (v5-canonical-analysis brief, correction 7):
 * - OlumiResponseSchema is .strict() so unknown top-level keys would fail
 *   parse. CEE may emit additive top-level fields (e.g. guidance_items,
 *   phase 3 coaching/review_card/evidence blocks, analysis_freshness)
 *   ahead of a schema-package bump. To tolerate these without losing them,
 *   unknown top-level keys are split off into an `additiveExtensions` map
 *   BEFORE strict validation, then attached to the parsed result via a
 *   non-enumerable sidecar (`__additive__`). Nested schemas remain strict —
 *   only the response root is widened.
 */
import {
  OlumiResponseSchema,
  BoundaryErrorSchema,
  type OlumiResponse,
  type BoundaryError,
} from '@talchain/schemas/boundary';

/** Sidecar key used to carry additive extensions on a parsed OlumiResponse. */
export const ADDITIVE_EXTENSIONS_KEY = '__additive__' as const;

/**
 * OlumiResponse extended with the additive sidecar. Consumers reading
 * unknown-but-tolerated fields (e.g. guidance items, phase-3 blocks) should
 * read `response[ADDITIVE_EXTENSIONS_KEY]` rather than expanding the strict
 * schema in @talchain/schemas.
 */
export type OlumiResponseWithExtensions = OlumiResponse & {
  readonly [ADDITIVE_EXTENSIONS_KEY]?: Readonly<Record<string, unknown>>;
};

/** Top-level keys the strict OlumiResponseSchema declares. */
const KNOWN_OLUMI_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  'response_version',
  'assistant_text',
  'blocks',
  'suggested_actions',
  'insights',
  'stage_indicator',
  'draft_graph',
  'analysis_ready',
]);

/**
 * Split a raw response into the known surface (validated by zod) and a map
 * of additive top-level keys. Mutating the raw object is avoided — the input
 * may be referenced by diagnostic capture layers.
 */
function splitAdditiveExtensions(raw: unknown): {
  known: unknown;
  extensions: Record<string, unknown>;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { known: raw, extensions: {} };
  }
  const source = raw as Record<string, unknown>;
  const known: Record<string, unknown> = {};
  const extensions: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (KNOWN_OLUMI_TOP_LEVEL_KEYS.has(k)) {
      known[k] = v;
    } else {
      extensions[k] = v;
    }
  }
  return { known, extensions };
}

// ---------------------------------------------------------------------------
// Error source classification
// ---------------------------------------------------------------------------

/**
 * Where the error originated.
 * - `netlify`: Netlify Edge infrastructure killed the request (body contains
 *   "edge function timed out" or headers indicate Netlify).
 * - `cee`: CEE service returned an error (has x-olumi-service header).
 * - `plot`: PLoT analysis service error (x-olumi-service: isl or plot).
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
  // Tolerance step: split additive top-level keys off the known surface so
  // strict validation only sees the declared shape. Nested schemas remain
  // strict (unknown keys inside blocks / suggested_actions / etc. still fail).
  const { known, extensions } = splitAdditiveExtensions(raw);
  const parsed = OlumiResponseSchema.safeParse(known);
  if (parsed.success) {
    if (Object.keys(extensions).length === 0) {
      return { kind: 'response', response: parsed.data };
    }
    // Attach extensions via a non-enumerable, readonly property. Consumers
    // who care opt in via the ADDITIVE_EXTENSIONS_KEY symbol; everyone else
    // sees the unchanged OlumiResponse shape.
    const withExt: OlumiResponseWithExtensions = parsed.data;
    Object.defineProperty(withExt, ADDITIVE_EXTENSIONS_KEY, {
      value: Object.freeze(extensions),
      enumerable: false,
      writable: false,
      configurable: false,
    });
    return { kind: 'response', response: withExt };
  }
  return {
    kind: 'parse_error',
    reason: 'body did not match OlumiResponse schema',
    http_status: res.status,
    raw,
  };
}
