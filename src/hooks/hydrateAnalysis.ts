/**
 * hydrateAnalysis — Pure mapping from persisted V2RunResponse to canvas store state.
 *
 * Used by useScenario.loadScenario to restore analysis results from Supabase.
 * Mirrors the success path in useV2Run.ts but without side effects
 * (no telemetry, no localStorage writes, no gate updates).
 */

import type { V2RunResponse } from '../adapters/plot/v2/types'
import {
  isValidV2RunResponse,
  sanitizeV2RunResponse,
} from '../adapters/plot/v2/types'
import {
  mapV2ResponseToReportV1,
  createEnrichmentFromV2Response,
  synthesizeCeeReviewFromV2,
  synthesizeCeeTraceFromV2,
} from '../adapters/plot/v2/responseMapper'
import type { ResultsState, RunMetaState } from '../canvas/store'
import type { AnalysisProvenance } from '../types/scenario'
import type { M1Review, M1Coaching, M1ReviewStatus } from '../types/cee'

// ---------------------------------------------------------------------------
// M1 extraction helpers (shared with useV2Run.ts)
// ---------------------------------------------------------------------------

/**
 * Extract M1 Review data from V2 response.
 * Returns null if CEE status is skipped or no review data present.
 */
export function extractM1ReviewFromV2(response: V2RunResponse): M1Review | null {
  const ceeStatus = (response.cee_status ?? 'skipped') as M1ReviewStatus
  if (ceeStatus === 'skipped') {
    return null
  }

  return {
    cee_status: ceeStatus,
    decision_quality: response.decision_quality ?? null,
    insights: response.insights ?? null,
    improvement_guidance: response.improvement_guidance ?? null,
    rationale: response.rationale ?? null,
    robustness_synthesis: response.robustness_synthesis ?? null,
    ceeTrace: response.cee_trace ? {
      requestId: response.cee_trace.request_id,
      latency_ms: response.cee_trace.latency_ms,
      degraded: response.cee_trace.degraded,
    } : undefined,
  }
}

/**
 * Extract M1 Coaching data from V2 response.
 * Returns null if m1_coaching is not present.
 */
export function extractM1CoachingFromV2(response: V2RunResponse): M1Coaching | null {
  const coaching = response.m1_coaching
  if (!coaching) {
    return null
  }

  return {
    executive_summary: coaching.executive_summary ?? undefined,
    story_headlines: coaching.story_headlines ?? {},
    readiness: coaching.readiness ?? undefined,
    readiness_signals: coaching.readiness_signals ?? undefined,
    key_drivers: coaching.key_drivers ?? undefined,
    // ⭐ NO DENIAL WITHOUT AUTHORITY, AT THE ONLY LIVE WRITER OF THE FIELD.
    //
    // This used to read `coaching.evidence_gaps ?? []`. That is the exact
    // collapse the footer fix withdraws, one hop UPSTREAM of it and on the one
    // path that actually writes `runMeta.m1Coaching`: a persisted response with
    // `m1_coaching` present and no `evidence_gaps` key had an array MINTED for
    // it here, so `useResultsSectionData`'s deliberately narrow
    // `Array.isArray(m1Coaching?.evidence_gaps)` read TRUE, and "What we
    // checked" rendered the unlicensed all-clear "No evidence gaps flagged" on
    // a run the producer never assessed. The comment there — "silence can never
    // be read as an assessment" — and the doc on `evidenceGapsAssessed` were
    // both FALSE on this path, because the silence had already been overwritten
    // before that flag ever looked.
    //
    // The key is therefore ABSENT when the producer sent nothing, and present
    // (including as a genuine `[]`) only when the producer actually spoke.
    // `M1Coaching.evidence_gaps` is optional, so absence is expressible.
    //
    // ⚠ Its two neighbours below (`next_actions`, `assumptions_ledger`) carry
    // the same idiom and are deliberately NOT changed here: nothing reads an
    // "assessed?" distinction off either of them today, so changing them would
    // be scope this lane has not derived consumers for. Recorded, not silently
    // fixed.
    ...(Array.isArray(coaching.evidence_gaps) ? { evidence_gaps: coaching.evidence_gaps } : {}),
    next_actions: coaching.next_actions ?? [],
    assumptions_ledger: Array.isArray(coaching.assumptions_ledger) ? coaching.assumptions_ledger : [],
    top_fragile_edge: coaching.top_fragile_edge ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Main hydration function
// ---------------------------------------------------------------------------

export interface HydratedAnalysis {
  results: Partial<ResultsState>
  runMeta: Partial<RunMetaState>
}

/**
 * Map a persisted V2RunResponse (from Supabase row.analysis) + provenance
 * into the shape the canvas store expects for results + runMeta.
 *
 * Returns null if the rawAnalysis is not a valid V2RunResponse.
 * Safe to call with any `unknown` value from a JSONB column.
 */
export function hydrateAnalysisFromV2Response(
  rawAnalysis: unknown,
  provenance: AnalysisProvenance | null,
): HydratedAnalysis | null {
  // Runtime validation at the persistence boundary
  if (!isValidV2RunResponse(rawAnalysis)) {
    if (import.meta.env.DEV) {
      console.warn('[hydrateAnalysis] Invalid V2RunResponse shape, skipping hydration')
    }
    return null
  }

  const v2Response = sanitizeV2RunResponse(rawAnalysis as V2RunResponse)

  // Derive seed: prefer provenance (numeric), fallback to response meta
  // (string→number). Receipts fail closed (T2): no real value → null —
  // never a fabricated 0. In particular, a malformed meta.seed_used parses
  // to NaN and becomes null (the old `|| 0` swallowed the NaN into a
  // fabricated seed that displayed as "Seed 0").
  const parsedMetaSeed = v2Response.meta?.seed_used != null
    ? Number.parseInt(String(v2Response.meta.seed_used), 10)
    : Number.NaN
  const seedUsed: number | null = provenance?.seed_used
    ?? (Number.isFinite(parsedMetaSeed) ? parsedMetaSeed : null)

  // Map V2RunResponse → ReportV1
  const report = mapV2ResponseToReportV1(v2Response, { seed: seedUsed })

  // Enrichment (sensitivity analysis data)
  const enrichment = createEnrichmentFromV2Response(v2Response)

  // CEE V1 synthesis
  const responseHash = provenance?.response_hash ?? v2Response.response_hash
  const ceeReviewV1 = synthesizeCeeReviewFromV2(v2Response)
  const ceeTraceV1 = synthesizeCeeTraceFromV2(v2Response, responseHash, 0)

  // M1 extraction
  const m1Review = extractM1ReviewFromV2(v2Response)
  const m1Coaching = extractM1CoachingFromV2(v2Response)
  const m1ReviewAssumptions = v2Response.m1_review ?? null

  // Derive timestamps from provenance
  const analysedAtMs = provenance?.analysed_at
    ? new Date(provenance.analysed_at).getTime()
    : undefined

  return {
    results: {
      status: 'complete',
      progress: 100,
      // Store slot uses undefined for absence (ResultsState.seed?: number);
      // the store's own guards (`!= null` / `!== undefined`) then skip
      // seed-dependent bookkeeping instead of recording a fabricated 0.
      seed: seedUsed ?? undefined,
      hash: responseHash,
      report,
      enrichment: enrichment ?? undefined,
      error: undefined,
      startedAt: analysedAtMs,
      finishedAt: analysedAtMs,
    },
    runMeta: {
      ceeReviewV1: ceeReviewV1 ?? null,
      ceeTraceV1: ceeTraceV1 ?? null,
      ceeErrorV1: null,
      m1Review: m1Review ?? null,
      m1Coaching: m1Coaching ?? null,
      m1ReviewAssumptions,
      reviewStatus: v2Response.review_status,
    },
  }
}
