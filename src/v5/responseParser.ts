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
 *   parse. Unknown top-level keys are split off into an `additiveExtensions`
 *   map BEFORE strict validation, then attached to the parsed result via a
 *   non-enumerable sidecar (`__additive__`).
 *
 * v1.3 Phase 3 blocks-array tolerance (Phase 3 fix, 2026-05-18):
 * - CEE emits the v1.3 Phase 3 block types `review_card | coaching |
 *   evidence | exercise` INSIDE `blocks[]` per the frozen contract. The
 *   vendored @talchain/schemas (0.8.1) does not yet include them in the
 *   `blocks[]` discriminated union, so a literal pass-through fails strict
 *   validation. We tolerate ONLY this canonical whitelist by splitting
 *   `blocks[]` into known-to-schema, phase3-tolerated, and truly-unknown
 *   before validation. Known blocks go to strict validation; phase3 blocks
 *   are attached to the sidecar under `phase3_blocks_from_blocks_array`;
 *   truly-unknown types still produce a `parse_error` whose `reason`
 *   enumerates the offending types. Nested product schemas remain strict.
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
 * Sidecar key inside the additive-extensions map under which v1.3 Phase 3
 * blocks pulled out of `blocks[]` are stashed. Consumers (e.g.
 * extractPhase3FromV5Response) read this slot directly.
 */
export const PHASE3_SIDECAR_BLOCKS_KEY = 'phase3_blocks_from_blocks_array' as const;

/**
 * Sidecar key carrying the pre-validation top-level key list of the raw
 * CEE body. Recorded only when a sidecar is being emitted (i.e. on success
 * paths where additive top-level keys or Phase 3 blocks were tolerated).
 * Diagnostic-only — lets the debug bundle report the ORIGINAL CEE root
 * shape instead of the parsed-clone shape (which has `__additive__`
 * promoted as an enumerable key in the trace store).
 */
export const ORIGINAL_TOP_LEVEL_KEYS_KEY = '__original_top_level_keys__' as const;

/**
 * Whitelist of v1.3 Phase 3 block types tolerated inside `blocks[]`. Any
 * other unknown `type` discriminator inside `blocks[]` still hard-fails the
 * parse so accidental schema drift is detected.
 */
export const PHASE3_TOLERATED_BLOCK_TYPES = new Set([
  'review_card',
  'coaching',
  'evidence',
  'exercise',
] as const);

export type Phase3ToleratedBlockType =
  typeof PHASE3_TOLERATED_BLOCK_TYPES extends Set<infer T> ? T : never;

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

/**
 * Block types declared by the strict @talchain/schemas (0.8.1) discriminated
 * union for `blocks[]`. Source: dist/boundary/blocks.js inside the vendored
 * tarball. Kept as a DGAI-side mirror so the parser can classify entries
 * BEFORE strict validation and give a precise diagnostic on truly unknown
 * types. If the schema package adds a block type, add it here too; a missed
 * type produces a clear parse_error (the offender is named in
 * `unknown_block_types`), which the tests will catch.
 */
const LEGACY_SCHEMA_KNOWN_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'text',
  'error',
  'analysis_result',
  'graph_patch',
  'explanation',
  'comparison',
  'flip_analysis',
  'draft_graph',
]);

/**
 * Classify the entries of `blocks[]` against the v1.3 contract:
 *   - `known`: entries with a `type` in the legacy schema. Forwarded to
 *     strict validation as-is.
 *   - `phase3`: entries with a `type` in PHASE3_TOLERATED_BLOCK_TYPES.
 *     Preserved verbatim and stashed in the sidecar.
 *   - `unknown`: shape-broken entries (non-object, missing `type`, or any
 *     `type` neither in the legacy schema nor in the Phase 3 whitelist).
 *     The parser hard-fails when this bucket is non-empty and surfaces
 *     offending types via `unknown_block_types` so the debug bundle can
 *     name them.
 *
 * Original input is NOT mutated. The returned arrays are new arrays of the
 * same entries (referential to the original block objects).
 */
function splitBlocksTolerance(blocks: unknown[]): {
  known: unknown[];
  phase3: unknown[];
  unknown: unknown[];
  unknownTypes: string[];
} {
  const known: unknown[] = [];
  const phase3: unknown[] = [];
  const unknown: unknown[] = [];
  const unknownTypeSet = new Set<string>();
  for (const entry of blocks) {
    if (entry === null || entry === undefined) {
      unknown.push(entry);
      unknownTypeSet.add(entry === null ? 'null' : 'undefined');
      continue;
    }
    if (Array.isArray(entry)) {
      unknown.push(entry);
      unknownTypeSet.add('array');
      continue;
    }
    if (typeof entry !== 'object') {
      unknown.push(entry);
      unknownTypeSet.add(typeof entry);
      continue;
    }
    const type = (entry as { type?: unknown }).type;
    if (typeof type !== 'string') {
      unknown.push(entry);
      unknownTypeSet.add('<missing-type>');
      continue;
    }
    if (PHASE3_TOLERATED_BLOCK_TYPES.has(type as Phase3ToleratedBlockType)) {
      phase3.push(entry);
      continue;
    }
    if (LEGACY_SCHEMA_KNOWN_BLOCK_TYPES.has(type)) {
      known.push(entry);
      continue;
    }
    unknown.push(entry);
    unknownTypeSet.add(type);
  }
  // Dedupe + sort so multiple unknown blocks of the same type don't bloat
  // the parse_error reason / debug bundle, and the ordering is stable for
  // reviewers diffing two captures.
  const unknownTypes = [...unknownTypeSet].sort();
  return { known, phase3, unknown, unknownTypes };
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

/**
 * Why a parse_error fired. Surfaced verbatim in the debug bundle so a
 * reader can distinguish a transport-level non-JSON body from a schema
 * mismatch from an unknown block type from a malformed-known nested shape.
 */
export type ParseFailureKind =
  | 'non_json'
  | 'non_ok_non_boundary'
  | 'schema_mismatch'
  | 'unknown_block_types'

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
      /** Why parsing failed; populated for all parse_error branches. */
      parse_failure_kind?: ParseFailureKind
      /** Populated when parse_failure_kind === 'unknown_block_types'. */
      unknown_block_types?: string[]
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
      parse_failure_kind: 'non_json',
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
      parse_failure_kind: 'non_json',
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
      parse_failure_kind: 'non_ok_non_boundary',
    };
  }

  // 2xx path: must parse as OlumiResponse.
  // Tolerance step 1: split additive top-level keys off the known surface
  // so strict validation only sees the declared shape.
  const { known, extensions } = splitAdditiveExtensions(raw);

  // Tolerance step 2 (Phase 3 blocks-array fix): if `blocks` is an array,
  // classify each entry. Schema-known entries continue to strict validation;
  // Phase 3 whitelist entries get stashed in the sidecar; truly unknown
  // entries trigger a hard parse_error that names the offending types.
  let phase3Blocks: readonly unknown[] = []
  let knownForValidation: unknown = known
  if (
    known !== null &&
    typeof known === 'object' &&
    !Array.isArray(known) &&
    Array.isArray((known as Record<string, unknown>).blocks)
  ) {
    const split = splitBlocksTolerance(
      (known as Record<string, unknown>).blocks as unknown[],
    )
    if (split.unknown.length > 0) {
      // Hard-fail when truly unknown block types appear. The raw response
      // is preserved verbatim so reviewers can inspect the offending
      // payload via the debug bundle.
      return {
        kind: 'parse_error',
        reason: `unknown block type(s) in blocks[]: ${split.unknownTypes.join(', ')}`,
        http_status: res.status,
        raw,
        diagnosticHeaders: captureDiagnosticHeaders(res),
        parse_failure_kind: 'unknown_block_types',
        unknown_block_types: split.unknownTypes,
      }
    }
    // Replace blocks for validation with the legacy-known slice, leaving
    // the raw input untouched. We build a shallow clone of the known
    // surface (which is itself already a shallow clone of raw produced by
    // splitAdditiveExtensions).
    knownForValidation = {
      ...(known as Record<string, unknown>),
      blocks: split.known,
    }
    phase3Blocks = split.phase3
  }

  const parsed = OlumiResponseSchema.safeParse(knownForValidation)
  if (parsed.success) {
    const hasTopLevelExt = Object.keys(extensions).length > 0
    const hasPhase3 = phase3Blocks.length > 0
    if (!hasTopLevelExt && !hasPhase3) {
      return { kind: 'response', response: parsed.data }
    }
    // Compose the sidecar payload. Top-level additive keys keep their
    // existing surface. Phase 3 blocks pulled out of blocks[] land under a
    // distinct key so consumers can read them without conflating with
    // top-level additive keys. The pre-validation top-level keys are
    // stashed too, so the debug bundle can faithfully report the ORIGINAL
    // CEE root shape (the parsed clone surfaces `__additive__` and drops
    // the demoted top-level extras, so its keys list is misleading).
    const sidecar: Record<string, unknown> = { ...extensions }
    if (hasPhase3) {
      sidecar[PHASE3_SIDECAR_BLOCKS_KEY] = Object.freeze(phase3Blocks.slice())
    }
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      sidecar[ORIGINAL_TOP_LEVEL_KEYS_KEY] = Object.freeze(
        Object.keys(raw as Record<string, unknown>).sort(),
      )
    }
    const withExt: OlumiResponseWithExtensions = parsed.data
    Object.defineProperty(withExt, ADDITIVE_EXTENSIONS_KEY, {
      value: Object.freeze(sidecar),
      enumerable: false,
      writable: false,
      configurable: false,
    })
    return { kind: 'response', response: withExt }
  }
  return {
    kind: 'parse_error',
    reason: 'body did not match OlumiResponse schema',
    http_status: res.status,
    raw,
    diagnosticHeaders: captureDiagnosticHeaders(res),
    parse_failure_kind: 'schema_mismatch',
  };
}
