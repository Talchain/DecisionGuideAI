/**
 * Analysis freshness slice — sourced ONLY from `response.analysis_ready`.
 *
 * Deliberately independent of `v5AnalysisFact` and `useStaleGuard` (both
 * excluded by the brief) and of `ceeAnalysisReady` (which is cleared on
 * analyse-turns-without-analysis_ready and on graph edits — that conflicts with
 * the "retain last verdict" requirement). This slice holds CEE's last freshness
 * verdict verbatim and follows three rules:
 *   - retain: a turn WITHOUT analysis_ready keeps the previous verdict;
 *   - never absence→fresh: a present payload with missing/invalid freshness
 *     degrades to 'unknown', never 'fresh';
 *   - order by computed_at: a strictly-older payload is ignored.
 *
 * The UI renders this verdict as cautious, non-scientific messaging. Supporting
 * fields (reason / hashes / computed_at) are held for ordering and debug only —
 * they are technical and must not be shown as user copy.
 */

export type AnalysisFreshnessValue = 'fresh' | 'stale' | 'unknown' | 'none'

export interface AnalysisFreshnessState {
  freshness: AnalysisFreshnessValue
  /** Technical reason code from CEE (e.g. 'graph_hash_match') — debug only, never user copy. */
  freshnessReason?: string
  graphHashAtRun?: string
  currentGraphHash?: string
  /** ISO timestamp used to order updates. */
  computedAt?: string
}

const VALID: ReadonlySet<AnalysisFreshnessValue> = new Set([
  'fresh',
  'stale',
  'unknown',
  'none',
])

function nonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/**
 * Pure reducer for the analysis-freshness slice. See module doc for the rules.
 * `rawAnalysisReady` is the verbatim `response.analysis_ready` (or null/undefined
 * when the turn carried none).
 */
export function deriveAnalysisFreshnessUpdate(
  prev: AnalysisFreshnessState | null,
  rawAnalysisReady: unknown,
): AnalysisFreshnessState | null {
  // Retain: absence of analysis_ready never changes (and never clears) the verdict.
  if (rawAnalysisReady === null || typeof rawAnalysisReady !== 'object') {
    return prev
  }

  const o = rawAnalysisReady as Record<string, unknown>

  // Never absence→fresh: a present payload with a missing/invalid freshness
  // value degrades to 'unknown', not 'fresh'.
  const fRaw = o.freshness
  const freshness: AnalysisFreshnessValue =
    typeof fRaw === 'string' && VALID.has(fRaw as AnalysisFreshnessValue)
      ? (fRaw as AnalysisFreshnessValue)
      : 'unknown'

  const computedAt = nonEmptyString(o.computed_at)

  // Order by computed_at: ignore a strictly-older (or equal) payload when both
  // timestamps are present. When the new payload has no computed_at we cannot
  // order it, so we apply it as the latest turn's verdict.
  if (prev?.computedAt && computedAt && computedAt <= prev.computedAt) {
    return prev
  }

  return {
    freshness,
    freshnessReason: nonEmptyString(o.freshness_reason),
    graphHashAtRun: nonEmptyString(o.graph_hash_at_run),
    currentGraphHash: nonEmptyString(o.current_graph_hash),
    computedAt,
  }
}

/**
 * Local dirty-overlay display rule.
 *
 * CEE's verdict (`state.freshness`) is the source of truth. The local dirty
 * overlay is set by analysis-affecting local edits (see the store wiring) and
 * cleared when a new `analysis_ready` arrives or the scenario resets.
 *
 * The ONLY thing the overlay may do is downgrade a retained `fresh` verdict to
 * `unknown` (cannot-confirm) — it never fabricates `stale`, never upgrades, and
 * never touches a CEE `stale`/`unknown`/`none` verdict. Returns the value to
 * display, or null when there is no verdict to show.
 */
export function resolveDisplayedFreshness(
  state: AnalysisFreshnessState | null,
  dirty: boolean,
): AnalysisFreshnessValue | null {
  if (!state) return null
  // Suppress a stale-since-edit 'fresh' verdict to cannot-confirm. CEE 'stale'
  // stays 'stale'; everything else passes through unchanged.
  if (state.freshness === 'fresh' && dirty) return 'unknown'
  return state.freshness
}
