/**
 * useGraphReadiness Hook — thin wrapper over readinessStore.
 *
 * All fetch logic, debouncing, and state management now live in
 * src/canvas/stores/readinessStore.ts. This file re-exports types
 * for backward compatibility and provides the hook interface that
 * existing consumers expect.
 *
 * The readiness store is initialised lazily on first hook mount —
 * startListening() is ref-counted so the subscription stays alive
 * until the last consumer unmounts.
 */

import { useEffect } from 'react'
import { useReadinessStore } from '../stores/readinessStore'

// ── Module-level request deduplication ──────────────────────────────
// Retained here because readinessStore.ts imports __test__.deduplicatedFetch.
// The cache is shared across the module boundary via the singleton Map.

const DEDUP_WINDOW_MS = 750

/**
 * Pre-parsed response shared between dedup consumers.
 * The Response body is consumed exactly once; all consumers read from this.
 */
export interface DeduplicatedResponse {
  ok: boolean
  status: number
  statusText: string
  /** Parsed JSON body on success, null on error */
  data: any
  /** Text body for error responses */
  errorBody: string
  /** Retry-After header value (for 429 handling) */
  retryAfterHeader: string | null
}

/**
 * The server answered, but its body could not be read as JSON.
 *
 * This type exists to keep two different facts apart at the ONE catch site
 * that sees both. `deduplicatedFetch` performs the `fetch()` and the
 * `response.json()` inside a single async IIFE, so a caller awaiting the
 * returned promise cannot otherwise distinguish "I never reached the server"
 * from "I reached it and could not read its reply". Neither is a readiness
 * verdict — but they are different things to report, and conflating them is
 * how a transport failure came to be presented as a model assessment
 * (ROADMAP 2.319a).
 *
 * Transport rejections are deliberately NOT wrapped: they propagate exactly
 * as `fetch()` threw them, so a caller can still read the underlying cause.
 */
export class ReadinessBodyUnreadableError extends Error {
  /** HTTP status of the response whose body would not parse. */
  readonly status: number
  /** The original `response.json()` rejection. */
  readonly parseError: unknown

  constructor(status: number, parseError: unknown) {
    super(`Readiness response body was not readable JSON (HTTP ${status})`)
    this.name = 'ReadinessBodyUnreadableError'
    this.status = status
    this.parseError = parseError
  }
}

interface InflightEntry {
  promise: Promise<DeduplicatedResponse>
  timestamp: number
  controller: AbortController
  /** Number of hook instances sharing this entry */
  refCount: number
  /** True once the fetch promise has settled (resolved or rejected) */
  settled: boolean
}
const inflightCache = new Map<string, InflightEntry>()

/**
 * Deduplicated fetch: reuses an in-flight (or recently resolved) request
 * for the same endpoint + payload body. Returns a pre-parsed response so
 * multiple consumers can safely read the result without "body stream already
 * read" errors. Uses refCount to prevent one consumer's unmount from
 * aborting a request shared by other consumers.
 */
function deduplicatedFetch(
  url: string,
  payloadJson: string,
  correlationId: string,
  extraHeaders: Record<string, string> = {},
): { promise: Promise<DeduplicatedResponse>; entry: InflightEntry; isReused: boolean } {
  const cacheKey = `${url}:${payloadJson}`
  const existing = inflightCache.get(cacheKey)
  if (existing && (!existing.settled || Date.now() - existing.timestamp < DEDUP_WINDOW_MS)) {
    existing.refCount++
    return { promise: existing.promise, entry: existing, isReused: true }
  }

  const controller = new AbortController()

  // Parse the response body exactly once, then share the parsed result.
  // The async IIFE ensures fetch() rejection is captured within the promise
  // chain rather than triggering Node.js "unhandled rejection" in test
  // environments where relative URLs are invalid (jsdom).
  const promise = (async (): Promise<DeduplicatedResponse> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': correlationId,
        ...extraHeaders,
      },
      body: payloadJson,
      signal: controller.signal,
    })
    if (response.ok) {
      // Tag a parse failure so the caller can tell it from a transport
      // failure. Both mean "no verdict", but only one of them means the
      // server was never reached — see ReadinessBodyUnreadableError.
      let data: unknown
      try {
        data = await response.json()
      } catch (parseErr) {
        throw new ReadinessBodyUnreadableError(response.status, parseErr)
      }
      return {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        data,
        errorBody: '',
        retryAfterHeader: null,
      }
    }
    const errorBody = await response.text().catch(() => 'Unable to read response body')
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      data: null,
      errorBody,
      retryAfterHeader: response.headers.get('Retry-After'),
    }
  })()

  const entry: InflightEntry = { promise, timestamp: Date.now(), controller, refCount: 1, settled: false }
  inflightCache.set(cacheKey, entry)
  // Suppress unhandled rejection — callers still get the rejection via `promise`.
  // `.finally()` returns a NEW, distinct promise that adopts the original's
  // rejection (it does not swallow errors). That derived promise must also
  // have a rejection handler, or it surfaces as its own unhandled rejection
  // independently of the `.catch(() => {})` above (#248).
  promise.catch(() => {})
  promise
    .finally(() => {
      entry.settled = true
      setTimeout(() => {
        if (inflightCache.get(cacheKey) === entry) {
          inflightCache.delete(cacheKey)
        }
      }, DEDUP_WINDOW_MS)
    })
    .catch(() => {})

  return { promise, entry, isReused: false }
}

/**
 * Release a ref to a shared inflight entry. Only aborts the underlying
 * request when the last consumer releases (refCount drops to 0).
 */
function releaseInflightEntry(entry: InflightEntry | null): void {
  if (!entry) return
  entry.refCount--
  if (entry.refCount <= 0) {
    entry.controller.abort()
  }
}

/** Clear inflight cache — exposed for testing */
export function clearInflightCache(): void {
  inflightCache.clear()
}

/** @internal — exposed for unit testing dedup logic and readinessStore. */
export const __test__ = { deduplicatedFetch, releaseInflightEntry }

// ── Types (re-exported for all consumers) ──────────────────────────

// ── PRE-ANALYSIS readiness vocabulary ──────────────────────────────
//
// ⚠ THIS IS NOT THE POST-ANALYSIS CONFIDENCE TIER. `EnrichmentConfidenceTier`
// (`strong | fair | needs_work`, @talchain/schemas dist/boundary/enrichment.d.ts)
// answers "how much should you trust the answer we just produced?". The field
// below answers "is this model complete enough to analyse?" — a different claim
// at a different point in the lifecycle, produced by a different service.
//
// Until 2026-07-27 the allowlist in readinessStore's normaliser was the
// POST-analysis tier's member list applied to this PRE-analysis field. The two
// sets overlap on `fair` and `needs_work` and differ on exactly one member, so
// the mistranslation was invisible on two thirds of all inputs and silently
// coerced CEE's top band (`ready`) to `fair` on EVERY graph scoring >= 70.
// Keep the two vocabularies named apart so that cannot recur.

/**
 * The levels CEE emits for `readiness_level` on POST /assist/v1/graph-readiness.
 *
 * ⚠ CROSS-REPO MIRROR — it cannot be derived from this repo, because the
 * pre-analysis readiness surface does not travel through `@talchain/schemas`.
 * Read at the bytes from olumi-assistants-service `staging`
 * `b35d09debc0c6843dbcbf7f28a4676810d77c278`:
 *   - `src/cee/graph-readiness/types.ts:8`
 *       `export type ReadinessLevel = "ready" | "fair" | "needs_work";`
 *   - `src/routes/assist.v1.graph-readiness.ts:29` (V1) and `:169` (V3), both
 *       `readiness_level: "ready" | "fair" | "needs_work";`
 *   - `src/cee/graph-readiness/index.ts:198-201` assigns `"ready"` at
 *       `score >= READINESS_THRESHOLDS.ready` (70, `constants.ts:30-31`).
 * A producer-side change to this set is NOT visible from here; the durable fix
 * is a boundary-contract test deriving both sides at their real SHAs.
 */
export const CEE_READINESS_LEVELS = ['needs_work', 'fair', 'ready'] as const
export type CeeReadinessLevel = (typeof CEE_READINESS_LEVELS)[number]

/**
 * ── ROADMAP 2.635 (I-1): `LOCAL_FALLBACK_READINESS_LEVELS` was DELETED ──
 *
 * It held exactly one member, `'strong'`, and its own docstring said the thing
 * that eventually retired it: `strong` is NOT a CEE value — no CEE code path
 * assigns it to `readiness_level`. It existed because the UI's local heuristic
 * `readinessStore.calculateFallbackReadiness` emitted it, writing straight to
 * the store WITHOUT passing through the normaliser. That heuristic's last caller
 * (the 429 arm) was retired in 2.635 and the function is deleted, so `strong`
 * now has no writer anywhere in this repo.
 *
 * It is removed rather than left resident because a level in the accepted set
 * with no producer is a standing invitation to re-fabricate one — and because
 * leaving it made the accepted set a UI invention padded onto a producer
 * vocabulary, which is the shape that caused the original defect this whole
 * area was opened for (CEE's `ready` silently coerced to `fair`).
 *
 * The old `@deprecated` note recorded the sharpest reason of all: the fallback
 * emitted a BETTER verdict than the producer could (CEE down + score 85 =>
 * `strong`; CEE up + score 85 => the top band). An unreachable server producing
 * a more confident answer than a reachable one is the fabrication class
 * inverted. It is now unreachable by construction.
 */

/**
 * Every value `GraphReadiness.readiness_level` may hold.
 *
 * ⚠ This is now EXACTLY the producer's set — see the assertion in
 * `readinessStore.ceeVocabulary.spec.ts`. Anything else is unrecognised input
 * and degrades to `fair` (loudly, in DEV). Do not widen this with a value the
 * UI invents: a level the producer cannot emit has no honest surface.
 */
export const ACCEPTED_READINESS_LEVELS = CEE_READINESS_LEVELS

export type GraphReadinessLevel = CeeReadinessLevel

export type ImprovementPriority = 'high' | 'medium' | 'low'

export type SuggestedNodeType = 'risk' | 'outcome' | 'option' | 'factor' | 'evidence' | 'goal' | 'decision'

export interface GraphImprovement {
  category: string
  action: string
  current_gap: string
  quality_impact: number
  /** Target quality score after implementing this improvement */
  target_quality: number
  priority: ImprovementPriority
  effort_minutes: number
  /** Node IDs that need attention for this improvement */
  affected_nodes?: string[]
  /** Edge IDs that need attention for this improvement */
  affected_edges?: string[]
  /** Suggested node type to add (e.g., 'risk', 'factor', 'evidence') */
  suggested_node_type?: SuggestedNodeType
  /** Current score for this quality factor (0-100) */
  current_score?: number
}

/**
 * CEE graph-readiness scaffold intent (CEE #612). When the engine will draft
 * the remaining options for the user, it rides this alongside the readiness
 * verdict so the UI can offer the run rather than false-block it.
 * Not a @talchain/schemas type — it is a CEE endpoint-response shape, typed
 * UI-side (verify the wire field name against A1's contract before widening).
 */
export interface ScaffoldPlan {
  /** True when CEE will draft the remaining options on run. */
  will_scaffold_options: boolean
  /** How many options CEE will draft. Present only when will_scaffold_options. */
  option_count?: number
}

/**
 * One entry of the graph-readiness verdict's `readiness_issues[]`.
 *
 * Field-for-field the producer's `RouteReadinessBlocker`
 * (`olumi-assistants-service/src/cee/graph-readiness/canonical-readiness.ts:139-162`
 * at CEE staging `3575b189`), read at the CEE bytes rather than inferred from a
 * capture — a capture proves what it was pointed at, and the three in this repo
 * are of `analysis_ready`, a different carrier that happens to share the name.
 *
 * ⭐⭐ `obligation` IS LOAD-BEARING AND IGNORING IT REPRODUCES THE DEFECT.
 * The producer's own comment says so in as many words: *"A PANEL THAT IGNORES
 * THIS FIELD REPRODUCES THE DEFECT. Rendering every entry of `readiness_issues[]`
 * as a demand is what asked the user to supply effect values for links the
 * product invented."* `required` = the user must answer. `offered` = the SYSTEM
 * authored this structure, so it may be shown and offered for confirmation but
 * NEVER DEMANDED (INV-P6). `waived_by_exclusion` marks a blocker the run will
 * answer by holding the option out, so it is not the user's task either.
 *
 * This is precisely the refusal at the heart of the P0: every blocker was
 * `offered`, which is why CEE's own headline says *"The values involved are
 * Olumi's own suggestions, not yours"*. A naive forward that rendered all five
 * messages as a task list would have shipped the very harm the refusal names.
 *
 * `obligation` is widened to `| (string & {})` so an UNKNOWN future class is
 * carried rather than silently narrowed into one of today's two — and readers
 * treat only the exact string `'offered'` as the waiver, never `!== 'required'`.
 */
export interface ReadinessIssue {
  /** The producer's user-facing repair sentence. The only field we render. */
  message: string
  code?: string
  category?: string
  repairability?: string
  option_id?: string
  option_label?: string
  factor_id?: string
  factor_label?: string
  /** `required` = the user owes this. `offered` = Olumi authored it (INV-P6). */
  obligation?: 'required' | 'offered' | (string & {})
  /** True when the run will proceed by excluding the option this names. */
  waived_by_exclusion?: boolean
}

export interface GraphReadiness {
  readiness_score: number // 0-100
  readiness_level: GraphReadinessLevel
  can_run_analysis: boolean
  confidence_explanation: string
  improvements: GraphImprovement[]
  /**
   * UI-SEM-091 input. Optional — absent on older CEE builds and on the local
   * 404/429 fallback, so its absence is fail-safe: the gate collapses to
   * `allowed = can_run_analysis`, byte-identical to pre-scaffold behaviour.
   */
  scaffold_plan?: ScaffoldPlan
  /**
   * V3 structured verdict fields. The blocked-state copy is composed from
   * THESE, never from `confidence_explanation` prose — see
   * `utils/composeBlockedReason.ts` for why (the guard-degrades-to-a-false-fact
   * defect, Paul 28 Jul).
   *
   * All optional: absent on older CEE builds, on the legacy V1/V2 response, and
   * on the local 404/429 fallback. Every reader must degrade to LESS SPECIFIC
   * TRUE copy when they are missing, never to a different claim.
   */
  options_ready?: number
  options_total?: number
  goal_node_valid?: boolean
  /**
   * CEE's OWN written refusal sentence, verbatim.
   *
   * ⚠ NOT `blocked_reason`. That is a DIFFERENT, healthy field on
   * `analysis_ready` (a bare CODE, read by `AnalysisRefusalNotice`). This one
   * is `blocker_reason` — singular "blocker", on the graph-readiness route,
   * and it is PROSE. Differently-named twins are this estate's chronic defect,
   * and here a grep for the wrong spelling reads perfectly healthy (24 files)
   * while the real target is zero. Measured both at UI `8f5b7a0e`.
   *
   * OPTIONAL BECAUSE THE PRODUCER DECLARES IT OPTIONAL — derived at the CEE
   * bytes, not assumed: `blocker_reason?: string` on
   * `CEEGraphReadinessResponseV1` (`assist.v1.graph-readiness.ts:59`), and it
   * is emitted only on the NOT-safe-to-analyse arm
   * (`canonical-readiness.ts:402-422`). Absent ⇒ `undefined` ⇒ readers degrade.
   *
   * ⭐ SAFE TO RENDER VERBATIM AS A HEADLINE, and that is why it is preferred
   * over our own composition. CEE has ALREADY applied INV-P6 to it: its
   * `headlineBlocker` is `readiness_issues.find(i => i.obligation !== 'offered'
   * && i.waived_by_exclusion !== true)` (`canonical-readiness.ts:371-373`), so
   * when every blocker is over structure Olumi itself authored, this field
   * falls back to an honest NON-DEMANDING sentence instead of quoting one of
   * Olumi's own asks as the user's obstacle.
   */
  /**
   * CEE's ADMISSION verdict — *"will the run actually proceed?"* — as distinct
   * from `can_run_analysis`, which answers the stricter *"is this model ready
   * as it stands?"*. Three-valued: `true | false | 'unknown'`
   * (`canonical-readiness.ts:210`), where `'unknown'` means the caller could not
   * reach the route at all.
   *
   * ⚠ CARRIED AS `'unknown'`, NOT COERCED TO A BOOLEAN. Collapsing the third
   * value into `false` would turn "we could not ask" into "we were refused" —
   * two different facts, and the producer declared three values precisely so a
   * consumer would not have to guess between them.
   *
   * ⭐ WHY IT IS FORWARDED HERE RATHER THAN LEFT OUT. `blocker_reason` is NOT
   * always a refusal. CEE's fallback has THREE branches
   * (`canonical-readiness.ts:417-421`), and when no blocker is owed and the run
   * WILL proceed it emits an AFFIRMATIVE sentence — *"This model can be
   * analysed now…"* — in the same field. Without this verdict the UI cannot
   * tell that sentence from a refusal, and would print "can be analysed now" as
   * the reason the Run button is disabled: the P0's own contradiction
   * reappearing inside the P0's fix. `may_run` is the field that discriminates,
   * and `producerAuthoredRefusal` reads exactly this.
   *
   * ⚠ THIS IS NOT WIRED INTO THE RUN GATE. `canRunAnalysis` still blocks on
   * `!can_run_analysis && !will_scaffold_options` and does not consult
   * `may_run`. Making the gate read it is a real improvement and a SEPARATE
   * change with its own blast radius; this field is forwarded here only so the
   * COPY cannot contradict the gate. Naming the limit rather than implying the
   * gate now honours it.
   */
  may_run?: boolean | 'unknown'
  blocker_reason?: string
  /**
   * The producer's per-option, per-factor repairs — the instance-level text
   * (`Choose the missing effect value for "X" on "Y".`) that makes a refusal
   * actionable instead of a count.
   *
   * ⚠ `undefined` AND `[]` ARE DIFFERENT FACTS AND THE TYPE SAYS SO.
   * `undefined` = the key was absent or malformed (older CEE, the V1/V2 body,
   * the local 404/429 fallback) — we know nothing. `[]` = CEE answered and
   * named no issues. The normaliser preserves the distinction rather than
   * collapsing both to `[]`, because "the producer told us nothing" and "the
   * producer told us there is nothing" license different copy. On the CURRENT
   * producer the key is REQUIRED (`readiness_issues: RouteReadinessBlocker[]`,
   * `assist.v1.graph-readiness.ts:84`); it is optional HERE because the UI
   * must still be correct against the older builds it can meet.
   */
  readiness_issues?: ReadinessIssue[]
}

// ── Hook (thin wrapper) ────────────────────────────────────────────

/**
 * Backward-compatible hook. All state & logic lives in readinessStore.
 * Calls startListening() on mount — ref-counted so the subscription
 * stays alive until the last consumer unmounts.
 */
export function useGraphReadiness() {
  const readiness = useReadinessStore((s) => s.readiness)
  const loading = useReadinessStore((s) => s.loading)
  const error = useReadinessStore((s) => s.error)
  // ROADMAP 2.332: a retained verdict can outlive the model it graded, so the
  // surface needs to know both that it has, and when it was taken.
  const stale = useReadinessStore((s) => s.stale)
  const verdictAtMs = useReadinessStore((s) => s.verdictAtMs)
  const refresh = useReadinessStore((s) => s.refresh)

  // Ref-counted: startListening increments, returned cleanup decrements.
  // Subscription only tears down when refCount hits 0.
  useEffect(() => {
    const unsub = useReadinessStore.getState().startListening()
    return unsub
  }, [])

  return { readiness, loading, error, stale, verdictAtMs, refresh }
}
