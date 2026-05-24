/**
 * V5 embedded-evidence resolver (post-PR #162 follow-up).
 *
 * Under V5 canonical mode (`VITE_V5_CANONICAL_ANALYSIS=true`,
 * `VITE_ENABLE_LEGACY_DIRECT_RUN=false`), the browser never fetches
 * PLoT `/v2/run` or ISL directly — analysis runs server-side inside
 * CEE. So `bundle.payloads.plot_response` / `plot_request` /
 * `isl_request` / `isl_response` are honestly null. But the CEE V5
 * turn response embeds analysis evidence in two known places:
 *
 *   1. `response.blocks[type==='analysis_result'].enrichment`
 *      — the canonical PLoT-shaped enrichment. Confirmed by
 *      `src/v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json`
 *      (real staging capture, 2026-04-30).
 *
 *   2. `response.blocks[type==='analysis_result'].enrichment._meta.payloads`
 *      — an optional metadata sidecar carrying the raw upstream
 *      `plot_request`, `plot_response`, `isl_request`,
 *      `isl_response` bodies. Forward-compatible path declared in
 *      the workstream spec; the resolver probes it defensively
 *      whether or not the current build emits it. When present, it
 *      surfaces evidence that the simple `enrichment` shape lacks
 *      (e.g. `confidence_provenance`, `evpi_percentage_points`,
 *      `flip_thresholds_status`, ISL `parameter_uncertainties`).
 *
 *   3. `response.raw.blocks[type==='analysis_result'].enrichment`
 *      — the SAME shape as #1, but reached via the parse-error
 *      wrapper emitted by `src/v5/responseParser.ts` when the CEE
 *      body fails the OlumiResponse schema. The wrapper shape is
 *      `{ kind: 'parse_error', reason: '...', raw: <original> }`.
 *      Manual staging validation of PR #168 (commit `5e9847db`,
 *      2026-05-21) observed this in the wild — full enrichment
 *      lived under `payloads.cee_response.raw.blocks[0].enrichment`
 *      while top-level `cee_response.blocks` was absent. PR #169
 *      added the fallback probe so embedded evidence resolves even
 *      when the captured body wraps the original CEE response.
 *      `_meta.payloads` and `downstream_calls.isl.response` are
 *      probed under the wrapper too (same enrichment shape, just
 *      reached via the `.raw.` prefix).
 *
 * Scientific validators are hard-wired to read from `inputs.plotResponse`
 * / `inputs.islRequest` / `inputs.islResponse`. This resolver lifts
 * embedded bodies into the validator inputs WITHOUT mutating
 * `bundle.payloads.*` (raw-capture truth preserved). The resolved
 * source metadata is exported under `bundle.evidence_resolution` for
 * reviewer transparency.
 *
 * Resolution precedence per evidence kind:
 *
 *   1. Top-level capture (`bundle.payloads.{plot,isl}_*`).
 *      Preserves dev/local and direct-capture paths.
 *
 *   2. CEE V5 embedded — first the `_meta.payloads` sidecar
 *      (if present and carries a usable body), then the
 *      `analysis_result.enrichment` body. `_meta.payloads` wins
 *      among embedded sources because it carries upstream-shape
 *      bodies (closer to the truth) while bare `enrichment` is
 *      a PLoT-shaped projection.
 *
 *   3. `'unavailable'`.
 *
 * Honesty contract:
 *   - Top-level beats embedded — always.
 *   - Embedded `plot_response` is promoted only when it carries at
 *     least one of the canonical indicative keys (`option_comparison`,
 *     `factor_sensitivity`, `m1_coaching`, `flip_thresholds`,
 *     `robustness`). Mirrors `RAW_PAYLOAD_INDICATIVE_KEYS` in
 *     `src/lib/scientificValidation/index.ts` so classifier and
 *     resolver agree on what counts as "real" evidence.
 *   - Other evidence kinds (`plot_request`, `isl_request`,
 *     `isl_response`) require only a non-empty plain-object body —
 *     they're metadata sidecars, not analysis bodies, so the
 *     indicative-keys gate does not apply.
 *   - Missing fields stay missing. The resolver does NOT fabricate.
 *   - The resolver is pure: no store reads, no React, no side effects.
 */

/**
 * Where the resolved evidence came from.
 *
 *   - `'top_level'`     — `bundle.payloads.{plot,isl}_*` was non-null.
 *   - `'cee_embedded'`  — lifted from somewhere inside
 *                          `bundle.payloads.cee_response` (either
 *                          `_meta.payloads` or the
 *                          `analysis_result.enrichment` body).
 *                          `evidence_resolution.<kind>.path` records
 *                          the exact nested path used.
 *   - `'unavailable'`   — neither source carried a usable body.
 */
export type EvidenceSource = 'top_level' | 'cee_embedded' | 'unavailable'

/**
 * Per-evidence-kind metadata exposed on `bundle.evidence_resolution`.
 * One block per evidence kind. Reviewers read:
 *
 *   evidence_resolution.plot_response.source
 *   evidence_resolution.plot_response.path
 *   evidence_resolution.plot_response.available
 *   evidence_resolution.plot_response.required_upstream_support
 *   evidence_resolution.plot_response.notes
 *
 * The actual resolved body is NOT included in this metadata — it
 * lives in `bundle.payloads.*` (raw browser capture, possibly null)
 * AND/OR can be traced via the `path` string. Validators consume
 * the body separately via `ValidatorInputs.{plotResponse,islRequest,islResponse}`,
 * threaded by `exportBundle.ts` from the resolver's separate body
 * return.
 */
export interface EvidenceResolutionEntry {
  /** Source the evidence came from. */
  source: EvidenceSource
  /**
   * Concrete pathname pointing at WHERE the resolved body lives,
   * for reviewer transparency. Examples:
   *   - `'payloads.plot_response'`                                   (top-level)
   *   - `'payloads.cee_response.blocks[3].enrichment'`               (cee_embedded — bare enrichment from conversational turn)
   *   - `'payloads.cee_response.blocks[3].enrichment._meta.payloads.plot_response'`
   *                                                                  (cee_embedded — meta sidecar from conversational turn)
   *   - `'analysis_evidence_trace.response_body.blocks[0].enrichment'`
   *                                                                  (cee_embedded — recovered earlier CEE turn body)
   *   - `null`                                                       (unavailable)
   *
   * The `payloads.cee_response.*` prefix indicates evidence was
   * resolved from the conversational CEE response (default base
   * path). The `analysis_evidence_trace.response_body.*` prefix
   * indicates evidence was resolved from a recovered earlier CEE
   * turn, surfaced on the bundle at `analysis_evidence_trace.response_body`.
   */
  path: string | null
  /** Convenience: `source !== 'unavailable'`. */
  available: boolean
  /**
   * When `available === false`, a concise description of what
   * upstream support (CEE / PLoT / ISL emission, or a top-level
   * capture path) would make this evidence kind available. `null`
   * when the evidence IS available — no upstream gap to document.
   */
  required_upstream_support: string | null
  /** Short diagnostic note explaining the resolver's decision. */
  notes: string
}

/**
 * Exported on `bundle.evidence_resolution`. Pure metadata —
 * resolved bodies live elsewhere (see `resolveScientificEvidence`'s
 * return shape for caller-side threading).
 */
export interface EvidenceResolutionReport {
  plot_request: EvidenceResolutionEntry
  plot_response: EvidenceResolutionEntry
  isl_request: EvidenceResolutionEntry
  isl_response: EvidenceResolutionEntry
}

/**
 * Resolver return shape. Carries both the resolved bodies (for
 * threading into `runScientificValidation`) AND the metadata
 * report (for the bundle's `evidence_resolution` field).
 *
 * Keeping bodies and metadata in separate buckets lets the bundle
 * shape stay clean: `evidence_resolution.<kind>.<field>` is purely
 * metadata, never a body. Bodies are validator-facing only and
 * never written to a top-level bundle field.
 */
export interface ResolvedEvidence {
  /** Resolved bodies — fed to validators by the caller. */
  bodies: {
    plot_request: Record<string, unknown> | null
    plot_response: Record<string, unknown> | null
    isl_request: Record<string, unknown> | null
    isl_response: Record<string, unknown> | null
  }
  /** Metadata report — copied verbatim to `bundle.evidence_resolution`. */
  resolution: EvidenceResolutionReport
}

// Indicative keys that gate `plot_response` promotion. Imported from
// the shared `v5EvidenceKeys` module so the resolver and the
// evidence-bearing selector (src/lib/evidenceBearingCeeTurn.ts) agree
// exactly on what counts as "real" evidence.
import { RAW_PAYLOAD_INDICATIVE_KEYS } from './v5EvidenceKeys'

/** Required-upstream-support copy (shared, single source of truth). */
const REQ_PLOT_REQUEST =
  'Top-level capture from `payloads.plot_request` OR CEE V5 response carrying `analysis_result.enrichment._meta.payloads.plot_request`.'
const REQ_PLOT_RESPONSE =
  'Top-level capture from `payloads.plot_response` OR CEE V5 response carrying `analysis_result.enrichment._meta.payloads.plot_response` OR an `analysis_result.enrichment` body with at least one of: option_comparison, factor_sensitivity, m1_coaching, flip_thresholds, robustness.'
const REQ_ISL_REQUEST =
  'Top-level capture from `payloads.isl_request` OR CEE V5 response carrying `analysis_result.enrichment._meta.payloads.isl_request`.'
const REQ_ISL_RESPONSE =
  'Top-level capture from `payloads.isl_response` OR CEE V5 response carrying `analysis_result.enrichment._meta.payloads.isl_response` OR `analysis_result.enrichment.downstream_calls.isl.response`.'

/** Defensive: is the value a plain non-array object? */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Plain object AND non-empty (at least one own key). */
function isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return isPlainObject(v) && Object.keys(v).length > 0
}

/**
 * Walk `blocks[]` looking for the first `analysis_result` entry.
 * Helper for `findAnalysisResultBlock` — accepts an `unknown` so the
 * caller can pass either `ceeResponse.blocks` or
 * `ceeResponse.raw.blocks` without re-asserting Array-ness.
 */
function findInBlocks(
  blocks: unknown,
): { block: Record<string, unknown>; index: number } | null {
  if (!Array.isArray(blocks)) return null
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (!isPlainObject(b)) continue
    if (b.type === 'analysis_result') return { block: b, index: i }
  }
  return null
}

/**
 * Find the FIRST analysis_result block reachable from `ceeResponse`.
 *
 * PR #169: extended to handle the parse-error wrapper shape emitted
 * by `src/v5/responseParser.ts` when the CEE turn body fails the
 * OlumiResponse schema. In that case the captured body has shape:
 *
 *     { kind: 'parse_error', reason: '...', raw: <original CEE body> }
 *
 * so `ceeResponse.blocks` is absent but `ceeResponse.raw.blocks[*]`
 * carries the same `analysis_result` enrichment we would otherwise
 * inspect. The wrapper is observed on staging exports (build
 * `5e9847db`+) — manual validation showed `payloads.cee_response.kind
 * = parse_error` with full enrichment under `.raw.blocks[0].enrichment`.
 *
 * Probe order:
 *   1. `ceeResponse.blocks[*]`              → unwrapped (clean body).
 *   2. `ceeResponse.raw.blocks[*]`          → parse-error wrapper.
 *
 * The returned `pathPrefix` is the canonical bundle-relative path to
 * the matched block (with or without the `.raw.` segment). Callers
 * compose evidence paths as `${pathPrefix}.enrichment[...]`.
 *
 * Returns null if neither location carries an `analysis_result` block,
 * or if `ceeResponse` is not a plain object.
 */
function findAnalysisResultBlock(
  ceeResponse: unknown,
  ceeResponseBasePath: string,
): {
  block: Record<string, unknown>
  index: number
  pathPrefix: string
} | null {
  if (!isPlainObject(ceeResponse)) return null
  // 1. Try the top-level (unwrapped) shape first.
  const top = findInBlocks(ceeResponse.blocks)
  if (top !== null) {
    return {
      ...top,
      pathPrefix: `${ceeResponseBasePath}.blocks[${top.index}]`,
    }
  }
  // 2. Fall back to the parse-error wrapper. We don't require
  //    `kind === 'parse_error'` explicitly — the structural test
  //    (`.raw.blocks[*]` carries an analysis_result) is sufficient
  //    and forward-compatible if the wrapper shape evolves.
  const raw = ceeResponse.raw
  if (isPlainObject(raw)) {
    const wrapped = findInBlocks(raw.blocks)
    if (wrapped !== null) {
      return {
        ...wrapped,
        pathPrefix: `${ceeResponseBasePath}.raw.blocks[${wrapped.index}]`,
      }
    }
  }
  return null
}

/** True iff the object carries at least one indicative key. */
function hasIndicativeKey(o: Record<string, unknown>): boolean {
  return RAW_PAYLOAD_INDICATIVE_KEYS.some(
    (k) => o[k] !== undefined && o[k] !== null,
  )
}

/** Build a metadata entry. */
function entry(
  source: EvidenceSource,
  path: string | null,
  notes: string,
  reqUpstream: string,
): EvidenceResolutionEntry {
  const available = source !== 'unavailable'
  return {
    source,
    path,
    available,
    required_upstream_support: available ? null : reqUpstream,
    notes,
  }
}

/**
 * Probe the embedded `_meta.payloads` sidecar (if present) for a
 * named kind. Returns `{ body, path }` when a usable body is found,
 * else `null`. For `plot_response` we apply the indicative-keys
 * gate; for other kinds we only require a non-empty plain object
 * (those are upstream-shape sidecars, not analysis bodies).
 */
function probeMetaPayloadsKind(
  enrichment: Record<string, unknown>,
  pathPrefix: string,
  kind: 'plot_request' | 'plot_response' | 'isl_request' | 'isl_response',
): { body: Record<string, unknown>; path: string } | null {
  const meta = enrichment._meta
  if (!isPlainObject(meta)) return null
  const payloads = (meta as Record<string, unknown>).payloads
  if (!isPlainObject(payloads)) return null
  const body = (payloads as Record<string, unknown>)[kind]
  if (!isNonEmptyObject(body)) return null
  if (kind === 'plot_response' && !hasIndicativeKey(body)) return null
  return {
    body,
    path: `${pathPrefix}.enrichment._meta.payloads.${kind}`,
  }
}

/**
 * Resolve scientific-validation evidence from a captured bundle.
 *
 * Precedence per kind:
 *   1. `topLevel.<kind>` (preserves dev/local).
 *   2. `cee_response.blocks[*].enrichment._meta.payloads.<kind>`
 *      (forward-compatible sidecar — closer to upstream shape).
 *   3. For `plot_response` only: bare
 *      `cee_response.blocks[*].enrichment` (PLoT-shaped projection).
 *   4. For `isl_response` only: `enrichment.downstream_calls.isl.response`.
 *   5. `'unavailable'`.
 *
 * `ceeResponseBasePath` controls the prefix used when emitting
 * `path` strings in the metadata report. Defaults to
 * `'payloads.cee_response'` — the canonical bundle location for
 * the captured CEE response body. When the caller resolves
 * evidence against a recovered earlier CEE turn (surfaced on the
 * bundle as `analysis_evidence_trace.response_body`), it should
 * pass `'analysis_evidence_trace.response_body'` so emitted paths
 * truthfully point at the actual bundle location of the body that
 * was inspected — not at `payloads.cee_response`, which still
 * carries the conversational (later) turn.
 *
 * Pure function. Defensive on malformed input.
 */
export function resolveScientificEvidence(
  topLevel: {
    plot_request: unknown
    plot_response: unknown
    isl_request: unknown
    isl_response: unknown
  },
  ceeResponse: unknown,
  ceeResponseBasePath: string = 'payloads.cee_response',
): ResolvedEvidence {
  const found = findAnalysisResultBlock(ceeResponse, ceeResponseBasePath)
  const enrichment =
    found !== null && isPlainObject(found.block.enrichment)
      ? (found.block.enrichment as Record<string, unknown>)
      : null

  // ------------------------- plot_request -------------------------
  let plot_request: Record<string, unknown> | null = null
  let plot_request_entry: EvidenceResolutionEntry
  if (isPlainObject(topLevel.plot_request)) {
    plot_request = topLevel.plot_request
    plot_request_entry = entry(
      'top_level',
      'payloads.plot_request',
      'Top-level capture from `payloads.plot_request`.',
      REQ_PLOT_REQUEST,
    )
  } else if (enrichment !== null && found !== null) {
    const probe = probeMetaPayloadsKind(enrichment, found.pathPrefix, 'plot_request')
    if (probe !== null) {
      plot_request = probe.body
      plot_request_entry = entry(
        'cee_embedded',
        probe.path,
        'Lifted from CEE V5 turn enrichment `_meta.payloads.plot_request` sidecar.',
        REQ_PLOT_REQUEST,
      )
    } else {
      plot_request_entry = entry(
        'unavailable',
        null,
        'No top-level `payloads.plot_request` and no `_meta.payloads.plot_request` sidecar in the CEE V5 enrichment.',
        REQ_PLOT_REQUEST,
      )
    }
  } else {
    plot_request_entry = entry(
      'unavailable',
      null,
      'No top-level `payloads.plot_request` and no CEE V5 `analysis_result` block to probe.',
      REQ_PLOT_REQUEST,
    )
  }

  // ------------------------- plot_response ------------------------
  let plot_response: Record<string, unknown> | null = null
  let plot_response_entry: EvidenceResolutionEntry
  if (isPlainObject(topLevel.plot_response)) {
    plot_response = topLevel.plot_response
    plot_response_entry = entry(
      'top_level',
      'payloads.plot_response',
      'Top-level capture from `payloads.plot_response` (dev/local or direct-PLoT path).',
      REQ_PLOT_RESPONSE,
    )
  } else if (enrichment !== null && found !== null) {
    // 1. Try the `_meta.payloads` sidecar first (closer to upstream shape).
    const meta = probeMetaPayloadsKind(enrichment, found.pathPrefix, 'plot_response')
    if (meta !== null) {
      plot_response = meta.body
      plot_response_entry = entry(
        'cee_embedded',
        meta.path,
        'Lifted from CEE V5 turn enrichment `_meta.payloads.plot_response` sidecar.',
        REQ_PLOT_RESPONSE,
      )
    } else if (hasIndicativeKey(enrichment)) {
      // 2. Fall back to the bare enrichment body (PLoT-shaped projection).
      plot_response = enrichment
      plot_response_entry = entry(
        'cee_embedded',
        `${found.pathPrefix}.enrichment`,
        'Lifted from CEE V5 turn `analysis_result` block enrichment. Top-level `payloads.plot_response` was null; enrichment carries at least one indicative key.',
        REQ_PLOT_RESPONSE,
      )
    } else {
      plot_response_entry = entry(
        'unavailable',
        null,
        'Found an `analysis_result` block but its `enrichment` is missing or lacks any indicative key (option_comparison, factor_sensitivity, m1_coaching, flip_thresholds, robustness). Not promoted.',
        REQ_PLOT_RESPONSE,
      )
    }
  } else {
    plot_response_entry = entry(
      'unavailable',
      null,
      'No top-level `payloads.plot_response` and no CEE V5 `analysis_result` block.',
      REQ_PLOT_RESPONSE,
    )
  }

  // ------------------------- isl_request --------------------------
  let isl_request: Record<string, unknown> | null = null
  let isl_request_entry: EvidenceResolutionEntry
  if (isPlainObject(topLevel.isl_request)) {
    isl_request = topLevel.isl_request
    isl_request_entry = entry(
      'top_level',
      'payloads.isl_request',
      'Top-level capture from `payloads.isl_request`.',
      REQ_ISL_REQUEST,
    )
  } else if (enrichment !== null && found !== null) {
    const probe = probeMetaPayloadsKind(enrichment, found.pathPrefix, 'isl_request')
    if (probe !== null) {
      isl_request = probe.body
      isl_request_entry = entry(
        'cee_embedded',
        probe.path,
        'Lifted from CEE V5 turn enrichment `_meta.payloads.isl_request` sidecar.',
        REQ_ISL_REQUEST,
      )
    } else {
      isl_request_entry = entry(
        'unavailable',
        null,
        'No top-level `payloads.isl_request` and no `_meta.payloads.isl_request` sidecar in the CEE V5 enrichment.',
        REQ_ISL_REQUEST,
      )
    }
  } else {
    isl_request_entry = entry(
      'unavailable',
      null,
      'No top-level `payloads.isl_request` and no CEE V5 `analysis_result` block to probe.',
      REQ_ISL_REQUEST,
    )
  }

  // ------------------------- isl_response -------------------------
  let isl_response: Record<string, unknown> | null = null
  let isl_response_entry: EvidenceResolutionEntry
  if (isPlainObject(topLevel.isl_response)) {
    isl_response = topLevel.isl_response
    isl_response_entry = entry(
      'top_level',
      'payloads.isl_response',
      'Top-level capture from `payloads.isl_response`.',
      REQ_ISL_RESPONSE,
    )
  } else if (enrichment !== null && found !== null) {
    // 1. `_meta.payloads.isl_response` first.
    const meta = probeMetaPayloadsKind(enrichment, found.pathPrefix, 'isl_response')
    if (meta !== null) {
      isl_response = meta.body
      isl_response_entry = entry(
        'cee_embedded',
        meta.path,
        'Lifted from CEE V5 turn enrichment `_meta.payloads.isl_response` sidecar.',
        REQ_ISL_RESPONSE,
      )
    } else {
      // 2. Fall back to `enrichment.downstream_calls.isl.response`.
      const downstream = enrichment.downstream_calls
      if (isPlainObject(downstream)) {
        const isl = (downstream as Record<string, unknown>).isl
        if (isPlainObject(isl)) {
          const response = (isl as Record<string, unknown>).response
          if (isNonEmptyObject(response)) {
            isl_response = response
            isl_response_entry = entry(
              'cee_embedded',
              `${found.pathPrefix}.enrichment.downstream_calls.isl.response`,
              'Lifted from CEE V5 turn enrichment `downstream_calls.isl.response`.',
              REQ_ISL_RESPONSE,
            )
          } else {
            isl_response_entry = entry(
              'unavailable',
              null,
              'Found `enrichment.downstream_calls.isl` but `response` is missing or empty.',
              REQ_ISL_RESPONSE,
            )
          }
        } else {
          isl_response_entry = entry(
            'unavailable',
            null,
            'No `_meta.payloads.isl_response` sidecar and no `downstream_calls.isl` in the CEE V5 enrichment.',
            REQ_ISL_RESPONSE,
          )
        }
      } else {
        isl_response_entry = entry(
          'unavailable',
          null,
          'No `_meta.payloads.isl_response` sidecar and no `downstream_calls` in the CEE V5 enrichment.',
          REQ_ISL_RESPONSE,
        )
      }
    }
  } else {
    isl_response_entry = entry(
      'unavailable',
      null,
      'No top-level `payloads.isl_response` and no CEE V5 `analysis_result` block to probe.',
      REQ_ISL_RESPONSE,
    )
  }

  return {
    bodies: { plot_request, plot_response, isl_request, isl_response },
    resolution: {
      plot_request: plot_request_entry,
      plot_response: plot_response_entry,
      isl_request: isl_request_entry,
      isl_response: isl_response_entry,
    },
  }
}
