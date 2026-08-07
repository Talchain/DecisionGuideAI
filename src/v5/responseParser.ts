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
 *   truly-unknown block types are NO LONGER fatal (defensive hardening,
 *   2026-06): they are dropped from the validated `blocks[]`, the rest of
 *   the response still parses/renders, and a privacy-safe
 *   `{ types, count, by_type }` diagnostic is stashed in the sidecar under
 *   `unknown_blocks`. Nested product schemas remain strict — a malformed
 *   KNOWN block still hard-fails as `schema_mismatch`.
 *
 *   Contract rule: unknown-block tolerance is a SAFETY NET, not a rendering
 *   contract. Dropped != rendered. A new user-facing block type requires an
 *   explicit allowlist + mapper + renderer + visibility tests before CEE
 *   relies on it being shown to the user.
 */
import {
  OlumiResponseSchema,
  BoundaryErrorSchema,
  type OlumiResponse,
  type BoundaryError,
} from '@talchain/schemas/boundary';
// Track C Step 1 (approved D-5): session-scoped dropped-content counter.
// Counting only — never alters parse results or rendering. The per-turn
// truth stays in the `unknown_blocks` sidecar below; the counter aggregates
// across turns for the debug export + a console.info observability line.
import { recordDroppedContent } from '../lib/droppedContentCounter';

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
 * Sidecar key carrying the list of action_type alias rewrites applied
 * before strict validation. Diagnostic-only — lets the debug bundle and
 * downstream observers see EXACTLY which suggested_actions[] entries had
 * their `action_type` normalised, so the rewrite is never silent.
 *
 * Entries: `Array<{ index: number; from: string; to: string }>`.
 *
 * Recorded only when at least one rewrite was applied (consistent with
 * PHASE3_SIDECAR_BLOCKS_KEY and ORIGINAL_TOP_LEVEL_KEYS_KEY emission rules).
 */
export const ACTION_TYPE_ALIASES_APPLIED_KEY = 'action_type_aliases_applied' as const;

/**
 * Sidecar key carrying the privacy-safe diagnostic for unknown `blocks[]`
 * entries that were dropped by the defensive-hardening tolerance (2026-06).
 *
 * Value shape: `{ types: string[]; count: number; by_type: Record<string, number> }`.
 *   - `types`: unique, sorted block-type labels (incl. shape descriptors
 *     `'array'` / `'null'` / `'<missing-type>'`).
 *   - `count`: total number of unknown entries dropped.
 *   - `by_type`: per-type drop counts.
 *
 * Diagnostic-only and deliberately content-free: it NEVER carries the raw
 * block payload, labels, IDs, values, or any user content. Recorded only
 * when at least one unknown block was dropped (consistent with the other
 * sidecar emission rules).
 */
export const UNKNOWN_BLOCKS_KEY = 'unknown_blocks' as const;

/**
 * Whitelist of v1.3 Phase 3 block types tolerated inside `blocks[]` and
 * stashed verbatim in the sidecar (vs. legacy-known types, which continue to
 * strict validation). Since the defensive-hardening change (2026-06) any
 * OTHER `type` discriminator inside `blocks[]` is no longer fatal — it is
 * dropped from the validated `blocks[]` and recorded in the `unknown_blocks`
 * sidecar diagnostic. This whitelist therefore distinguishes "preserve
 * verbatim for downstream Phase 3 consumers" from "drop + diagnose".
 *
 * Exported as `ReadonlySet` to prevent accidental mutation of the
 * tolerated-type allowlist at consumer boundaries (.add/.delete are not
 * available on the public type). The underlying Set is constructed from a
 * literal tuple so the union member type can still be derived.
 */
export type Phase3ToleratedBlockType =
  | 'review_card'
  | 'coaching'
  | 'evidence'
  | 'exercise';

export const PHASE3_TOLERATED_BLOCK_TYPES: ReadonlySet<Phase3ToleratedBlockType> = new Set<Phase3ToleratedBlockType>([
  'review_card',
  'coaching',
  'evidence',
  'exercise',
]);

/**
 * Allowlist of known CEE→schema drift in `suggested_actions[].action_type`.
 *
 * EMPTY under schemas 0.15 — deliberately. The single historical entry
 * (`explain_results` → `explain_result`) existed because the 0.8.1 enum
 * lacked the plural and strict validation rejected the whole response. The
 * 0.15 `ActionType` enum accepts BOTH forms, the V5 backend handler ID is
 * the PLURAL (see ACTION_TO_TURN_TYPE in useConversation.ts — the singular
 * is its "legacy alias"), and the SuggestedChips V5 filter keys on the
 * plural — so the rewrite had become actively harmful: it converted the
 * producer's canonical value into one the filter hid, silently swallowing
 * the "Explain the result" chip on live staging (V-P0-2, wire-verified
 * 2026-07-13). The mechanism is retained for future GENUINE drift (a value
 * the schema rejects); any entry requires explicit addition — broad
 * tolerance is NOT acceptable. Truly unknown action_type values still fail
 * strict validation.
 *
 * Keys are aliases CEE may emit; values are the canonical schema-accepted
 * forms.
 */
const SUGGESTED_ACTION_TYPE_ALIASES: Readonly<Record<string, string>> = {} as const;

/**
 * A single rewrite recorded by normaliseSuggestedActionTypeAliases for the
 * debug bundle / sidecar. Surfaced verbatim under
 * ACTION_TYPE_ALIASES_APPLIED_KEY.
 */
export interface ActionTypeAliasRewrite {
  /** Index into the original suggested_actions array. */
  index: number;
  /** The non-canonical value CEE emitted. */
  from: string;
  /** The canonical value rewritten in place for validation. */
  to: string;
}

/**
 * OlumiResponse extended with the additive sidecar. Consumers reading
 * unknown-but-tolerated fields (e.g. guidance items, phase-3 blocks) should
 * read `response[ADDITIVE_EXTENSIONS_KEY]` rather than expanding the strict
 * schema in @talchain/schemas.
 */
export type OlumiResponseWithExtensions = OlumiResponse & {
  readonly [ADDITIVE_EXTENSIONS_KEY]?: Readonly<Record<string, unknown>>;
};

/**
 * Top-level keys the strict OlumiResponseSchema declares — DERIVED from the
 * schema itself, never restated.
 *
 * This used to be a hand-written list, and its docstring made exactly the
 * claim above while being FALSE: at the vendored 0.22.0 pin the schema
 * declared 13 keys and the list allowed 9. The four it silently withheld —
 * `framing_question`, `decision_classification`, `framing_quality`,
 * `graph_hash` — are precisely the fields the contract added so consumers
 * could STOP deriving verdicts client-side. Because everything outside this
 * set is demoted to the non-enumerable `__additive__` sidecar, each of them
 * would have read `undefined` off the typed response FOREVER, including
 * after CEE started emitting them, and the silence would have been
 * indistinguishable from the producer sending nothing.
 *
 * `OlumiResponseSchema` is a plain `z.object(...).strict()`, so `.shape` is
 * directly enumerable and this derivation stays correct across re-vendors
 * with no human in the loop. Do NOT convert this back into a literal list:
 * this repo's dominant defect is the hand-maintained mirror, whose drift
 * always reads green. (CEE performs the same derivation in
 * `tests/contract/cee-egress-wire-surface-pin.test.ts`.)
 *
 * Note this admits DECLARED keys only. An UNDECLARED root key (e.g.
 * `coaching`, which the schema still does not declare at 0.22.0) must keep
 * going to the sidecar — the schema is `.strict()`, so routing an undeclared
 * key into validation would fail the entire parse. Deriving cannot admit
 * one; hand-adding could, which is why hand-adding is the hazard here.
 * Pinned end-to-end in `responseParser.declaredKeysReachStrict.spec.ts`.
 */
const KNOWN_OLUMI_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(
  Object.keys(OlumiResponseSchema.shape),
);

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
 * types. If the schema package adds a block type, add it here too so it is
 * strict-validated; an unlisted type is now tolerated (dropped + recorded in
 * the `unknown_blocks` sidecar diagnostic) rather than fatal.
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
  // 0.15.0 wave (re-vendor lane): schema-known and now fully handled — both are
  // LIVE (R8 + R4 landed; #539/C3). `held_proposal` maps to the R8 held-proposal
  // card (mapV5Blocks → 'v5_held_proposal' → V5HeldProposalBlock; it fails closed
  // to v5_unsupported only on a drifted block whose confirm ref cannot resolve).
  // `ui_directive` is dispatched by the R4 dispatcher in applyV5State (highlight
  // verbs → targets); the chat mapper returns null because a directive is an
  // advisory presentation hint, not a chat card.
  'held_proposal',
  'ui_directive',
]);

/**
 * Defensive bound on the `type` label stored in the `unknown_blocks`
 * diagnostic. `type` is a producer-controlled discriminator and legitimate
 * values are short (e.g. `analysis_result`); but if a future CEE/model bug
 * emitted a pathologically long or user-content-like discriminator, the
 * diagnostic must not preserve it unbounded. Cap to a generous discriminator
 * length so the diagnostic stays small and content-free. Drop counts are
 * unaffected. Real type names are well under the cap, so this is a no-op for
 * legitimate input.
 */
export const MAX_UNKNOWN_BLOCK_TYPE_LABEL_LENGTH = 64;

function boundUnknownBlockTypeLabel(label: string): string {
  return label.length <= MAX_UNKNOWN_BLOCK_TYPE_LABEL_LENGTH
    ? label
    : `${label.slice(0, MAX_UNKNOWN_BLOCK_TYPE_LABEL_LENGTH)}...[truncated]`;
}

/**
 * Classify the entries of `blocks[]` against the v1.3 contract:
 *   - `known`: entries with a `type` in the legacy schema. Forwarded to
 *     strict validation as-is.
 *   - `phase3`: entries with a `type` in PHASE3_TOLERATED_BLOCK_TYPES.
 *     Preserved verbatim and stashed in the sidecar.
 *   - `unknownTypes`: a deduped + sorted list of offending `type` labels
 *     (or shape descriptors like `'array'` / `'<missing-type>'`) for any
 *     entry that is neither legacy-known nor in the Phase 3 whitelist.
 *     The parser now TOLERATES these (defensive hardening): they are
 *     dropped from the validated `blocks[]` and surfaced verbatim via the
 *     `unknown_blocks` sidecar diagnostic for the debug bundle.
 *   - `unknownCount`: total number of dropped unknown entries.
 *   - `unknownByType`: per-type drop counts.
 *
 * Original input is NOT mutated. The returned arrays are new arrays of the
 * same entries (referential to the original block objects).
 */
function splitBlocksTolerance(blocks: unknown[]): {
  known: unknown[];
  phase3: unknown[];
  unknownTypes: string[];
  unknownCount: number;
  unknownByType: Record<string, number>;
} {
  const known: unknown[] = [];
  const phase3: unknown[] = [];
  const unknownTypeSet = new Set<string>();
  const unknownByType: Record<string, number> = {};
  let unknownCount = 0;
  const addUnknown = (rawLabel: string): void => {
    const label = boundUnknownBlockTypeLabel(rawLabel);
    unknownTypeSet.add(label);
    unknownByType[label] = (unknownByType[label] ?? 0) + 1;
    unknownCount += 1;
  };
  for (const entry of blocks) {
    if (entry === null || entry === undefined) {
      addUnknown(entry === null ? 'null' : 'undefined');
      continue;
    }
    if (Array.isArray(entry)) {
      addUnknown('array');
      continue;
    }
    if (typeof entry !== 'object') {
      addUnknown(typeof entry);
      continue;
    }
    const type = (entry as { type?: unknown }).type;
    if (typeof type !== 'string') {
      addUnknown('<missing-type>');
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
    addUnknown(type);
  }
  // Dedupe + sort so multiple unknown blocks of the same type produce a
  // stable, compact diagnostic; `unknownByType` retains per-type counts and
  // `unknownCount` the total number of dropped entries.
  const unknownTypes = [...unknownTypeSet].sort();
  return { known, phase3, unknownTypes, unknownCount, unknownByType };
}

/**
 * Pre-validation alias normalisation for `suggested_actions[].action_type`.
 *
 * Walks the suggested_actions array on `known` (the splitAdditiveExtensions
 * output, already a shallow clone of the raw response). When an entry's
 * `action_type` matches an allowlisted alias key in
 * SUGGESTED_ACTION_TYPE_ALIASES, returns a new `known` object with that one
 * field rewritten to the canonical form. The original input is NOT mutated;
 * new shallow clones are constructed only for affected objects.
 *
 * Returns the rewrites alongside the (possibly cloned) known surface, so the
 * caller can stash them on the parser sidecar for diagnostic faithfulness.
 *
 * No-op when:
 *   - known is null/non-object/array, or
 *   - known.suggested_actions is not an array, or
 *   - no entry has an action_type that matches an allowlisted alias.
 *
 * Strictness is preserved: action_type values OUTSIDE the allowlist pass
 * through unchanged. The downstream OlumiResponseSchema strict enum then
 * fails on them, producing schema_mismatch as before.
 */
function normaliseSuggestedActionTypeAliases(known: unknown): {
  known: unknown;
  rewrites: ActionTypeAliasRewrite[];
} {
  if (
    known === null ||
    typeof known !== 'object' ||
    Array.isArray(known) ||
    !Array.isArray((known as Record<string, unknown>).suggested_actions)
  ) {
    return { known, rewrites: [] };
  }
  const knownObj = known as Record<string, unknown>;
  const actions = knownObj.suggested_actions as unknown[];
  const rewrites: ActionTypeAliasRewrite[] = [];
  let mutatedAny = false;
  const nextActions = actions.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return entry;
    }
    const obj = entry as Record<string, unknown>;
    const at = obj.action_type;
    if (typeof at !== 'string') return entry;
    const canonical = SUGGESTED_ACTION_TYPE_ALIASES[at];
    if (canonical === undefined) return entry;
    if (canonical === at) return entry;
    mutatedAny = true;
    rewrites.push({ index, from: at, to: canonical });
    return { ...obj, action_type: canonical };
  });
  if (!mutatedAny) return { known, rewrites: [] };
  return {
    known: { ...knownObj, suggested_actions: nextActions },
    rewrites,
  };
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
  /**
   * @deprecated No longer produced. Unknown `blocks[]` types are now tolerated
   * (dropped + recorded in the `unknown_blocks` sidecar) instead of failing
   * the parse. Retained for back-compat with diagnostics consumers that still
   * reference the literal.
   */
  | 'unknown_block_types'

/**
 * Literal value of `V5ParseResult['kind']` for the parse-error branch.
 * Exported so the debug bundle (and any other consumer that introspects
 * a captured response body) discriminates the envelope by this constant
 * rather than a hand-rolled string literal — keeps the wire-shape contract
 * centralised. If the kind label ever changes here, every comparison
 * follows automatically.
 */
export const V5_PARSE_ERROR_KIND = 'parse_error' as const
export type V5ParseErrorKind = typeof V5_PARSE_ERROR_KIND

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
      /**
       * @deprecated Unknown blocks are now tolerated (see the `unknown_blocks`
       * sidecar on the success path); this no longer populates from `blocks[]`
       * tolerance. Kept on the type for back-compat with existing consumers.
       */
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
  let unknownBlockTypes: readonly string[] = []
  let unknownBlockCount = 0
  let unknownBlocksByType: Record<string, number> = {}
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
    // Defensive hardening (2026-06): truly-unknown block types are NO LONGER
    // fatal. Only `split.known` continues to strict validation; unknown
    // entries are dropped from the validated `blocks[]`, the rest of the
    // response parses normally, and a privacy-safe { types, count, by_type }
    // diagnostic is stashed in the sidecar under `unknown_blocks` below. This
    // converts a future-additive CEE block from a whole-turn INTERNAL_ERROR
    // into an observable, non-fatal compatibility event. Tolerance is a
    // safety net, not a rendering contract — dropped blocks are never
    // rendered. Malformed KNOWN blocks still hard-fail via strict zod
    // (nested product schemas remain strict). Raw input is not mutated; the
    // known surface is already a shallow clone from splitAdditiveExtensions.
    knownForValidation = {
      ...(known as Record<string, unknown>),
      blocks: split.known,
    }
    phase3Blocks = split.phase3
    if (split.unknownTypes.length > 0) {
      unknownBlockTypes = split.unknownTypes
      unknownBlockCount = split.unknownCount
      unknownBlocksByType = split.unknownByType
      // Track C Step 1 (D-5): count-and-log each dropped unknown block type.
      // recordDroppedContent never throws and never mutates parse state.
      for (const [blockType, count] of Object.entries(split.unknownByType)) {
        recordDroppedContent({
          blockType,
          source: 'v5_response_parser',
          rationale: 'unknown_block_type_dropped_pre_validation',
          count,
        })
      }
    }
  }

  // Tolerance step 3 (action_type alias drift): rewrite values the STRICT
  // SCHEMA REJECTS to their schema-accepted forms. The table is EMPTY under
  // schemas 0.15 (see SUGGESTED_ACTION_TYPE_ALIASES) — do NOT re-add entries
  // for values the enum already accepts: rewriting a schema-valid form
  // breaks downstream consumers keyed on the producer's vocabulary (V-P0-2:
  // the plural→singular entry hid the explain chip from the V5 filter).
  // Raw input is not mutated; any rewrites are stashed on the sidecar for
  // the debug bundle to surface faithfully.
  const aliasNorm = normaliseSuggestedActionTypeAliases(knownForValidation)
  knownForValidation = aliasNorm.known
  const aliasRewrites = aliasNorm.rewrites

  const parsed = OlumiResponseSchema.safeParse(knownForValidation)
  if (parsed.success) {
    const hasTopLevelExt = Object.keys(extensions).length > 0
    const hasPhase3 = phase3Blocks.length > 0
    const hasAliasRewrites = aliasRewrites.length > 0
    const hasUnknownBlocks = unknownBlockCount > 0
    if (!hasTopLevelExt && !hasPhase3 && !hasAliasRewrites && !hasUnknownBlocks) {
      return { kind: 'response', response: parsed.data }
    }
    // Compose the sidecar payload. Top-level additive keys keep their
    // existing surface. Phase 3 blocks pulled out of blocks[] land under a
    // distinct key so consumers can read them without conflating with
    // top-level additive keys. action_type alias rewrites land under their
    // own key so debug bundle consumers see EXACTLY which suggested_actions
    // entries were normalised. The pre-validation top-level keys are
    // stashed too, so the debug bundle can faithfully report the ORIGINAL
    // CEE root shape (the parsed clone surfaces `__additive__` and drops
    // the demoted top-level extras, so its keys list is misleading).
    const sidecar: Record<string, unknown> = { ...extensions }
    if (hasPhase3) {
      sidecar[PHASE3_SIDECAR_BLOCKS_KEY] = Object.freeze(phase3Blocks.slice())
    }
    if (hasAliasRewrites) {
      sidecar[ACTION_TYPE_ALIASES_APPLIED_KEY] = Object.freeze(aliasRewrites.slice())
    }
    if (hasUnknownBlocks) {
      // Privacy-safe diagnostic ONLY — type labels + counts, NEVER raw block
      // payload or user content. Rides the __additive__ sidecar into the
      // debug bundle via v5Adapter; surfaced structurally on V5CeeCapture by
      // exportBundle (unknown_block_types + unknown_blocks_tolerated_count).
      sidecar[UNKNOWN_BLOCKS_KEY] = Object.freeze({
        types: Object.freeze(unknownBlockTypes.slice()),
        count: unknownBlockCount,
        by_type: Object.freeze({ ...unknownBlocksByType }),
      })
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
