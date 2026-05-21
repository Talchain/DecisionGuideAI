/**
 * V5 embedded-evidence resolver (post-PR #162 follow-up).
 *
 * Under V5 canonical mode (`VITE_V5_CANONICAL_ANALYSIS=true`,
 * `VITE_ENABLE_LEGACY_DIRECT_RUN=false`), the browser never fetches
 * PLoT `/v2/run` or ISL directly — analysis runs server-side inside
 * CEE. So `bundle.payloads.plot_response` / `plot_request` /
 * `isl_request` / `isl_response` are honestly null. But the CEE V5
 * turn response embeds analysis evidence under
 * `response.blocks[type==='analysis_result'].enrichment` (confirmed
 * by `src/v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json`,
 * a real staging capture from 2026-04-30).
 *
 * Scientific validators in `src/lib/scientificValidation/*` are
 * hard-wired to read from `inputs.plotResponse` / `inputs.islRequest`
 * / `inputs.islResponse`. They never look at `inputs.ceeResponse`.
 * So embedded enrichment was ignored.
 *
 * This module surfaces embedded enrichment to validators WITHOUT
 * mutating `bundle.payloads.*` (which stays raw-capture truth). The
 * bundle assembler calls `resolveScientificEvidence` to compute a
 * resolved view + per-evidence-type source metadata; validators see
 * the resolved view; the bundle exposes the source metadata under
 * `bundle.evidence_resolution` for reviewer transparency.
 *
 * Honesty contract:
 *   - Top-level capture wins over embedded (preserves dev/local and
 *     any future direct-PLoT capture path).
 *   - Embedded enrichment is promoted ONLY when it carries at least
 *     one of the canonical indicative keys (`option_comparison`,
 *     `factor_sensitivity`, `m1_coaching`, `flip_thresholds`,
 *     `robustness`). An empty `enrichment: {}` does NOT count.
 *   - Missing fields stay missing. The resolver does NOT fabricate
 *     `plot_request`, does NOT reconstruct ISL from canvas / UI
 *     state, does NOT infer EVPI / flip thresholds / confidence
 *     from anything other than the captured embedded body.
 *   - The resolver is pure: no store reads, no React, no side
 *     effects.
 */

/**
 * Where the resolved evidence came from.
 *
 *   - `'top_level'`    — `bundle.payloads.plot_response` etc.
 *     (or sibling fields) were non-null. Dev/local path.
 *   - `'cee_embedded'` — extracted from the analysis_result block
 *     inside `bundle.payloads.cee_response`. Staging V5 canonical path.
 *   - `'unavailable'`  — neither top-level capture NOR embedded
 *     enrichment had usable evidence.
 */
export type EvidenceSource = 'top_level' | 'cee_embedded' | 'unavailable'

/**
 * Per-evidence-kind resolution metadata. Same shape regardless of
 * which kind it describes. Matches the workstream spec's metadata
 * suggestion (`source`, `path`, `available`, `required_upstream_support`,
 * `notes`) so reviewers can read each evidence kind's provenance in
 * a uniform way.
 */
export interface EvidenceResolutionEntry {
  /** Source the evidence came from. */
  source: EvidenceSource
  /**
   * Concrete pathname pointing at WHERE the resolved evidence body
   * lives in the bundle, for reviewer transparency. Examples:
   *   - `'payloads.plot_response'`                                  (top-level)
   *   - `'payloads.cee_response.blocks[3].enrichment'`              (embedded)
   *   - `null`                                                      (unavailable)
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
  /** Short diagnostic note explaining the resolution decision. */
  notes: string
}

/**
 * Output shape of `resolveScientificEvidence`. Each evidence kind
 * has:
 *   - the resolved body (or `null`)
 *   - a `resolution` block carrying source / path / availability /
 *     upstream-support / notes metadata.
 *
 * Always returns the FULL shape — callers can read metadata without
 * optional chaining. Each evidence kind is resolved independently
 * (top-level PLoT + embedded ISL is a valid mix).
 */
export interface ResolvedEvidence {
  /**
   * Resolved PLoT response body. `null` only when neither
   * the top-level capture nor the embedded enrichment is usable.
   */
  plot_response: Record<string, unknown> | null
  plot_response_resolution: EvidenceResolutionEntry

  /**
   * ISL request body. V5 canonical does NOT carry an ISL request
   * in the enrichment block today, so this field commonly resolves
   * to `'unavailable'`. Threaded for symmetry + future-proofing.
   */
  isl_request: Record<string, unknown> | null
  isl_request_resolution: EvidenceResolutionEntry

  /**
   * ISL response body. When the enrichment exposes
   * `downstream_calls.isl.response` (same path the V2
   * responseMapper uses), the resolver lifts that body. Otherwise
   * `'unavailable'`.
   */
  isl_response: Record<string, unknown> | null
  isl_response_resolution: EvidenceResolutionEntry
}

/** Required-upstream-support strings (shared, single source of truth). */
const REQUIRED_UPSTREAM_PLOT_RESPONSE =
  'Top-level capture from `payloads.plot_response` OR CEE V5 response carrying an `analysis_result` block whose `enrichment` includes at least one of: option_comparison, factor_sensitivity, m1_coaching, flip_thresholds, robustness.'
const REQUIRED_UPSTREAM_ISL_REQUEST =
  'Top-level capture from `payloads.isl_request`. The V5 CEE enrichment does NOT currently embed an ISL request body; CEE would need to expose one (e.g. via `enrichment.downstream_calls.isl.request`) for resolution from `cee_embedded`.'
const REQUIRED_UPSTREAM_ISL_RESPONSE =
  'Top-level capture from `payloads.isl_response` OR CEE V5 response carrying `enrichment.downstream_calls.isl.response`.'

/**
 * Indicative keys that mark a CEE V5 enrichment block as actually
 * carrying analysis evidence (not an empty placeholder). Mirrors
 * `RAW_PAYLOAD_INDICATIVE_KEYS` in
 * `src/lib/scientificValidation/index.ts` so the classifier and
 * the resolver agree on what counts as "real" evidence.
 *
 * Kept in sync with the validator-side constant to avoid drift:
 * if either layer adds a new indicative key, the other must too.
 */
const RAW_PAYLOAD_INDICATIVE_KEYS = [
  'option_comparison',
  'factor_sensitivity',
  'm1_coaching',
  'flip_thresholds',
  'robustness',
] as const

/** Defensive: is the value a plain non-array object? */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Walks `ceeResponse.blocks` and returns the FIRST block where
 * `type === 'analysis_result'`, along with its array index for
 * source-path construction. Returns `null` if no such block exists,
 * the response is malformed, or `blocks` is missing/non-array.
 *
 * (The staging fixture pattern shows a single `analysis_result`
 * block per turn — first-block semantics suffice. If CEE later
 * emits multiple, the resolver picks the first; that's predictable
 * and reviewer-checkable.)
 */
function findAnalysisResultBlock(
  ceeResponse: unknown,
): { block: Record<string, unknown>; index: number } | null {
  if (!isPlainObject(ceeResponse)) return null
  const blocks = ceeResponse.blocks
  if (!Array.isArray(blocks)) return null
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (!isPlainObject(b)) continue
    if (b.type === 'analysis_result') {
      return { block: b, index: i }
    }
  }
  return null
}

/**
 * Returns true when `enrichment` carries at least one of the
 * canonical indicative keys with a non-null value. An empty
 * `{}` or an enrichment containing ONLY non-canonical keys
 * does NOT qualify — that prevents the resolver from promoting
 * a placeholder body to "live evidence" status.
 */
function enrichmentHasIndicativeKey(
  enrichment: Record<string, unknown>,
): boolean {
  return RAW_PAYLOAD_INDICATIVE_KEYS.some(
    (k) => enrichment[k] !== undefined && enrichment[k] !== null,
  )
}

/**
 * Resolve scientific-validation evidence for a captured bundle.
 *
 * Precedence per evidence kind:
 *   1. Top-level capture (preserves dev/local and direct-capture).
 *   2. CEE V5 embedded enrichment.
 *   3. `'unavailable'`.
 *
 * Each kind resolves independently — top-level PLoT plus
 * CEE-embedded ISL is a valid combination.
 *
 * Pure function. Defensive on malformed inputs (returns
 * `'unavailable'` rather than throwing).
 */
/** Build the metadata block for a given evidence kind. */
function buildResolution(
  source: EvidenceSource,
  path: string | null,
  notes: string,
  requiredUpstreamSupport: string,
): EvidenceResolutionEntry {
  const available = source !== 'unavailable'
  return {
    source,
    path,
    available,
    required_upstream_support: available ? null : requiredUpstreamSupport,
    notes,
  }
}

export function resolveScientificEvidence(
  topLevel: {
    plot_response: unknown
    isl_request: unknown
    isl_response: unknown
  },
  ceeResponse: unknown,
): ResolvedEvidence {
  // -------------------- plot_response ---------------------------
  let plot_response: Record<string, unknown> | null = null
  let plot_response_resolution: EvidenceResolutionEntry

  if (isPlainObject(topLevel.plot_response)) {
    plot_response = topLevel.plot_response
    plot_response_resolution = buildResolution(
      'top_level',
      'payloads.plot_response',
      'Top-level capture from `payloads.plot_response` (dev/local or direct-PLoT path).',
      REQUIRED_UPSTREAM_PLOT_RESPONSE,
    )
  } else {
    // Embedded fallback — only when the analysis_result block
    // carries indicative keys.
    const found = findAnalysisResultBlock(ceeResponse)
    if (found !== null) {
      const enrichment = found.block.enrichment
      if (isPlainObject(enrichment) && enrichmentHasIndicativeKey(enrichment)) {
        plot_response = enrichment
        plot_response_resolution = buildResolution(
          'cee_embedded',
          `payloads.cee_response.blocks[${found.index}].enrichment`,
          'Lifted from CEE V5 turn `analysis_result` block enrichment. Top-level `payloads.plot_response` was null (V5 canonical mode); enrichment carries at least one indicative key.',
          REQUIRED_UPSTREAM_PLOT_RESPONSE,
        )
      } else {
        plot_response_resolution = buildResolution(
          'unavailable',
          null,
          'Found an `analysis_result` block but its `enrichment` is missing or lacks any indicative key (option_comparison, factor_sensitivity, m1_coaching, flip_thresholds, robustness). Not promoted — empty/placeholder bodies are not treated as live evidence.',
          REQUIRED_UPSTREAM_PLOT_RESPONSE,
        )
      }
    } else {
      plot_response_resolution = buildResolution(
        'unavailable',
        null,
        'Neither top-level `payloads.plot_response` nor a CEE V5 `analysis_result` block was found.',
        REQUIRED_UPSTREAM_PLOT_RESPONSE,
      )
    }
  }

  // -------------------- isl_request -----------------------------
  // V5 canonical enrichment does NOT carry an ISL request body in
  // the staging-real fixture. Top-level only for now; the unavailable
  // branch documents the CEE side that would be needed.
  let isl_request: Record<string, unknown> | null = null
  let isl_request_resolution: EvidenceResolutionEntry

  if (isPlainObject(topLevel.isl_request)) {
    isl_request = topLevel.isl_request
    isl_request_resolution = buildResolution(
      'top_level',
      'payloads.isl_request',
      'Top-level capture from `payloads.isl_request`.',
      REQUIRED_UPSTREAM_ISL_REQUEST,
    )
  } else {
    isl_request_resolution = buildResolution(
      'unavailable',
      null,
      'No top-level `payloads.isl_request`. The V5 CEE turn enrichment does not currently embed an ISL request body; if/when CEE exposes one (e.g. via `enrichment.downstream_calls.isl.request`), this resolver will need a `cee_embedded` branch to pick it up.',
      REQUIRED_UPSTREAM_ISL_REQUEST,
    )
  }

  // -------------------- isl_response ----------------------------
  let isl_response: Record<string, unknown> | null = null
  let isl_response_resolution: EvidenceResolutionEntry

  if (isPlainObject(topLevel.isl_response)) {
    isl_response = topLevel.isl_response
    isl_response_resolution = buildResolution(
      'top_level',
      'payloads.isl_response',
      'Top-level capture from `payloads.isl_response`.',
      REQUIRED_UPSTREAM_ISL_RESPONSE,
    )
  } else {
    // Embedded fallback — probe
    // `analysis_result_block.enrichment.downstream_calls.isl.response`.
    // Same path the V2 responseMapper uses.
    const found = findAnalysisResultBlock(ceeResponse)
    let embeddedResponse: Record<string, unknown> | null = null
    let embeddedPath: string | null = null
    if (found !== null) {
      const enrichment = found.block.enrichment
      if (isPlainObject(enrichment)) {
        const downstream = enrichment.downstream_calls
        if (isPlainObject(downstream)) {
          const isl = downstream.isl
          if (isPlainObject(isl)) {
            const response = isl.response
            if (isPlainObject(response)) {
              embeddedResponse = response
              embeddedPath = `payloads.cee_response.blocks[${found.index}].enrichment.downstream_calls.isl.response`
            }
          }
        }
      }
    }
    if (embeddedResponse !== null && embeddedPath !== null) {
      isl_response = embeddedResponse
      isl_response_resolution = buildResolution(
        'cee_embedded',
        embeddedPath,
        'Lifted from CEE V5 turn enrichment `downstream_calls.isl.response`.',
        REQUIRED_UPSTREAM_ISL_RESPONSE,
      )
    } else {
      isl_response_resolution = buildResolution(
        'unavailable',
        null,
        'Neither top-level `payloads.isl_response` nor an embedded `enrichment.downstream_calls.isl.response` was found.',
        REQUIRED_UPSTREAM_ISL_RESPONSE,
      )
    }
  }

  return {
    plot_response,
    plot_response_resolution,
    isl_request,
    isl_request_resolution,
    isl_response,
    isl_response_resolution,
  }
}
