/**
 * Readiness Store — single source of truth for CEE graph-readiness state.
 *
 * Replaces 7+ independent useGraphReadiness() hook instances that each
 * maintained their own debounce timers, refs, and state. Now a single
 * module-level subscription watches the canvas store, debounces 500ms,
 * and makes one fetch per graph change.
 *
 * Consumers read via useReadinessStore(s => s.readiness) or via the
 * thin wrapper useGraphReadiness() for backward compatibility.
 */
import { create } from 'zustand'
import { useCanvasStore } from '../store'
import type { Node, Edge } from '@xyflow/react'
import type {
  GraphReadiness,
  GraphReadinessLevel,
  GraphImprovement,
  DeduplicatedResponse,
} from '../hooks/useGraphReadiness'
import {
  ACCEPTED_READINESS_LEVELS,
  ReadinessBodyUnreadableError,
  __test__ as dedupUtils,
} from '../hooks/useGraphReadiness'
import { plotAuthHeaders } from '../../lib/plotAuthHeaders'

// Re-export types consumers need
export type { GraphReadiness, GraphImprovement }

/**
 * Normalise CEE's `readiness_level` onto the accepted pre-analysis vocabulary.
 *
 * The accepted set is `ACCEPTED_READINESS_LEVELS` — CEE's own emitted members
 * (`needs_work | fair | ready`) plus the local-fallback `strong` — and NOT a
 * literal list maintained here. It used to be `['needs_work','fair','strong']`,
 * the POST-analysis `EnrichmentConfidenceTier` members applied to this
 * PRE-analysis field: `ready` was absent, so CEE's top band was silently
 * rewritten to `fair` on every graph scoring >= 70, and `canRunAnalysis`
 * then attached "consider improvements for better results" to the Run button
 * of a model CEE had called ready.
 *
 * The guard itself is deliberately kept: unrecognised input still degrades to
 * `fair` rather than reaching consumers untyped. What changes is (a) the
 * vocabulary it is measured against and (b) that the degrade is no longer
 * silent — a silent coercion is exactly why this survived review.
 */
function normaliseReadinessLevel(raw: unknown): GraphReadinessLevel {
  if (
    typeof raw === 'string' &&
    (ACCEPTED_READINESS_LEVELS as readonly string[]).includes(raw)
  ) {
    return raw as GraphReadinessLevel
  }

  if (import.meta.env.DEV) {
    console.warn(
      `[readinessStore] Unrecognised readiness_level ${JSON.stringify(raw)} — ` +
        `degrading to 'fair'. Accepted: ${ACCEPTED_READINESS_LEVELS.join(' | ')}. ` +
        `If CEE now emits this value, widen CEE_READINESS_LEVELS in useGraphReadiness.ts.`,
    )
  }
  return 'fair'
}

/**
 * ROADMAP 2.339 — a non-ok status that is neither 429 nor 404.
 *
 * Carries the STATUS and nothing else. The response body is logged at the
 * throw site and never travels with the error, so no arm downstream can paste
 * a proxy's HTML error page into user-facing copy — which is exactly what the
 * pristine `HTTP ${status} - ${errorBody}` string did.
 */
export class ReadinessServiceStatusError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Readiness service responded HTTP ${status}`)
    this.name = 'ReadinessServiceStatusError'
    this.status = status
  }
}

const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'

// ── Constants ──────────────────────────────────────────────────────
const DEBOUNCE_DELAY = 500
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const BACKOFF_MULTIPLIER = 2

// ── Store interface ────────────────────────────────────────────────

export interface ReadinessStoreState {
  readiness: GraphReadiness | null
  loading: boolean
  error: string | null
  /**
   * ROADMAP 2.332 — true when the model has changed in a way the CURRENT
   * `readiness` verdict was not asked about.
   *
   * Set the moment a payload-affecting mutation is detected, cleared only when
   * a fresh verdict lands. It exists because #564 made failure retain the last
   * server verdict rather than replace it with a guess — the right call, but it
   * means a retained verdict can outlive the model it graded. `stale` is what
   * stops a surface presenting that verdict as current; it never changes the
   * verdict itself, and never opens or closes the gate.
   */
  stale: boolean
  /** `Date.now()` when `readiness` was last set from an answer. Null until then. */
  verdictAtMs: number | null
}

export interface ReadinessStoreActions {
  /** Manual re-fetch bypassing debounce (used by PreAnalysisHealth refresh button) */
  refresh: () => void
  /**
   * Begin watching canvas store for graph changes.
   * Idempotent — subsequent calls are no-ops.
   * Returns an unsubscribe function.
   */
  startListening: () => () => void
  /** Reset state AND unsubscribe the canvas listener + clear timers. */
  reset: () => void
}

const initialState: ReadinessStoreState = {
  readiness: null,
  loading: false,
  error: null,
  stale: false,
  verdictAtMs: null,
}

// ── Module-level singletons ────────────────────────────────────────
// These replace the per-hook-instance useRef values.

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let unsubCanvasStore: (() => void) | null = null
/** Number of active consumers (hook instances). Subscription tears down at 0. */
let listenerRefCount = 0
/**
 * The payload of the last request ATTEMPT, successful or not. The change
 * detector compares against this, so a canvas emission that leaves the payload
 * identical asks nothing — including after a failure, where `lastPayloadHash`
 * is deliberately left unset.
 *
 * These two are NOT a mirror of each other: they answer different questions
 * ("has anything the server would see changed since we last asked?" vs "do we
 * already hold a verdict for exactly this?") and both derive from the SAME
 * `buildReadinessPayload`, so neither can drift from the payload.
 */
let lastObservedPayload: string | null = null
/** The payload of the last SUCCESSFUL request. Never written on failure. */
let lastPayloadHash: string | null = null
let fetchInFlight = false
/**
 * ROADMAP 2.332 (adversarial review, amendment 1) — a call that arrived while
 * a fetch was in flight and had to be deferred.
 *
 * `fetchReadiness` opens with `if (fetchInFlight) return`. Without this flag
 * that early return DISCARDED the call: a mutation landing during a slow fetch
 * scheduled its refetch, the debounce fired at +500ms into the in-flight
 * guard, and the request vanished with no timer and no record. Whenever
 * readiness latency exceeds `DEBOUNCE_DELAY` — the Render cold-start shape —
 * the mutated model was never asked about at all. That is the 3 Aug walk's own
 * defect, re-created inside the fix for it.
 */
let fetchQueued = false
let backoff = { delay: 0, until: 0 }
let lastLogTime = 0
/** Ref-counted dedup entry from the shared inflight cache */
let currentInflightEntry: { refCount: number; controller: AbortController } | null = null

// ── Helpers ────────────────────────────────────────────────────────

function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * ROADMAP 2.332 — the canvas state roots `buildReadinessPayload` reads.
 *
 * This is the change-detection predicate for the canvas subscription. It is
 * kept honest by `readinessStore.invalidation.spec.ts`, which Proxy-wraps the
 * state handed to `buildReadinessPayload`, records every top-level property it
 * reads and asserts the set is a subset of this list — so a payload input
 * added without a watcher fails the suite rather than going quietly dark.
 *
 * ⚠ CLAUDE.md trap 12d, stated rather than assumed: that guard proves this
 * list AGREES with the builder. It cannot prove the PAYLOAD is complete — a
 * field CEE needs that the builder never reads is invisible to both. The only
 * thing that catches that is the corpus of tests driving real mutations
 * (a turn writing `ceeAnalysisReady`, an observed-state edit, a rename, an
 * edge weight, the brief), which is why those exist alongside the guard and
 * neither replaces the other.
 */
export const WATCHED_ROOTS = [
  'nodes',
  'edges',
  'ceeAnalysisReady',
  'currentBriefText',
] as const

/** The slice of canvas state the readiness request is a function of. */
export interface ReadinessPayloadInputs {
  nodes: Node[]
  edges: Edge[]
  ceeAnalysisReady: { options?: unknown[] } | null | undefined
  currentBriefText: string | null | undefined
}

/**
 * Build the `/graph-readiness` request body. Pure: everything it reads arrives
 * in `s`, nothing is pulled from `useCanvasStore` inside.
 *
 * ROADMAP 2.332 — THIS FUNCTION IS THE SINGLE TRUTH ABOUT WHAT THE VERDICT IS
 * A FUNCTION OF, and both callers use it: the request, and the change detector
 * that decides whether to make one.
 *
 * It replaces `createGraphFingerprint`, a hand-written hash of node
 * `id:type:data.value` plus edge `key:data.confidence`. That hash was a mirror
 * of this payload maintained by memory, and it had drifted BOTH ways:
 *   · it hashed `edge.data.confidence`, which this payload has never carried —
 *     so a change to it entered the fetch, cleared the honest error state and
 *     asked the server a question it had already answered; and
 *   · it did NOT hash `observedState`, node `label`/`kind`, edge
 *     `weight`/`belief`/`direction`, the brief, or `ceeAnalysisReady` — every
 *     one of which this payload DOES carry. That is why the 3 Aug walk's
 *     successful remedy (a turn writing `ceeAnalysisReady` via
 *     `mirrorAnalysisReady`) changed the answer without ever asking for it,
 *     and the gate stayed shut on a verdict eight turns old.
 * A hash derived from the payload cannot drift from the payload, because it IS
 * the payload.
 */
export function buildReadinessPayload(s: ReadinessPayloadInputs): string {
  const { nodes, edges, ceeAnalysisReady, currentBriefText } = s

  const payload: Record<string, unknown> = {
    graph: {
      nodes: nodes.map((n) => {
        const data = n.data as any
        const nodeKind = data?.kind || n.type || 'factor'
        const node: Record<string, unknown> = {
          id: n.id,
          type: nodeKind,
          kind: nodeKind,
          label: data?.label || n.id,
        }
        if (typeof data?.value === 'number') {
          node.data = { value: data.value }
        }
        // F4 (A1 GO 21 Jul — CEE widen merged + deploy-verified live): send factor
        // observed_state so /assist/v1/graph-readiness can report
        // scaffold_plan.will_scaffold_options (fixes "blocked despite scaffold fired").
        // Built EXPLICITLY (never spread observedState) so unit/source and any
        // metadata-shaped key are excluded — a metadata key routes CEE to the strict
        // constraint branch (needs metadata.operator) → HTTP 400. value REQUIRED (0-1
        // model scale); raw_value OPTIONAL (display magnitude), only when numeric.
        const observedState = data?.observedState
        if (nodeKind === 'factor' && typeof observedState?.value === 'number') {
          node.observed_state = {
            value: observedState.value,
            ...(typeof observedState.raw_value === 'number'
              ? { raw_value: observedState.raw_value }
              : {}),
          }
        }
        return node
      }),
      /**
       * UI-SEM-011: Default belief injection (belief: 0.8).
       * UI-SEM-030: Edge defaults for CEE coaching (weight 0.5, belief 0.8, direction 'positive').
       */
      edges: edges.map((e) => ({
        id: e.id,
        from: e.source,
        to: e.target,
        weight: (e.data as any)?.weight ?? 0.5,
        belief: (e.data as any)?.beliefExists ?? (e.data as any)?.belief ?? 0.8,
        effect_direction: (e.data as any)?.direction ?? 'positive',
      })),
    },
  }

  if (currentBriefText && currentBriefText.length >= 20) {
    payload.brief = currentBriefText
  }

  if (ceeAnalysisReady?.options?.length) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { model_adjustments: _strip, ...analysisReadyForPayload } =
      ceeAnalysisReady as Record<string, unknown>
    payload.analysis_ready = analysisReadyForPayload
  }

  return JSON.stringify(payload)
}

/**
 * Calculate fallback readiness from local graph health.
 */
function calculateFallbackReadiness(
  nodes: Node[],
  edges: Edge[],
  graphHealth: { issues?: Array<{ severity: string }> } | null,
): GraphReadiness {
  let score = 50

  if (nodes.length > 0) score += 10
  if (nodes.length >= 3) score += 10
  if (nodes.length >= 5) score += 5
  if (edges.length > 0) score += 10
  if (edges.length >= nodes.length - 1) score += 5

  const issues = graphHealth?.issues || []
  const blockers = issues.filter((i) => i.severity === 'error' || i.severity === 'blocker')
  const warnings = issues.filter((i) => i.severity === 'warning')

  score -= blockers.length * 15
  score -= warnings.length * 5
  score = Math.max(0, Math.min(100, score))

  let level: GraphReadiness['readiness_level'] = 'fair'
  if (score < 40) level = 'needs_work'
  else if (score >= 70) level = 'strong'

  return {
    readiness_score: score,
    readiness_level: level,
    can_run_analysis: blockers.length === 0,
    confidence_explanation:
      level === 'strong'
        ? 'Your model has good structure and connections'
        : level === 'fair'
          ? 'Analysis available - consider improvements for better results'
          : 'Address critical issues before running analysis',
    improvements: [],
  }
}

// ── Core fetch logic ───────────────────────────────────────────────

async function fetchReadiness(): Promise<void> {
  // ROADMAP 2.332 amendment 1 — defer, never discard. See `fetchQueued`.
  if (fetchInFlight) {
    fetchQueued = true
    return
  }
  fetchInFlight = true

  const store = useReadinessStore.getState()

  try {
    const now = Date.now()
    if (backoff.until > now) {
      if (import.meta.env.DEV) {
        console.warn(
          `[readinessStore] Rate limited, waiting ${Math.ceil((backoff.until - now) / 1000)}s`,
        )
      }
      return
    }

    const canvasState = useCanvasStore.getState()
    const {
      nodes: currentNodes,
      edges: currentEdges,
      graphHealth,
      ceeAnalysisReady: currentCeeAnalysisReady,
    } = canvasState

    if (currentNodes.length === 0) {
      useReadinessStore.setState({
        readiness: {
          readiness_score: 0,
          readiness_level: 'needs_work',
          can_run_analysis: false,
          confidence_explanation: 'Add some nodes to get started',
          improvements: [],
        },
        loading: false,
        error: null,
        // This verdict IS a function of the current payload (zero nodes), so
        // nothing about it is outgrown — the mark clears honestly.
        stale: false,
        // ROADMAP 2.332 amendment 2 — but it is composed HERE, not answered.
        // `verdictAtMs` means "when `readiness` was last set from an ANSWER",
        // and no request was made. Stamping it let the footer cite "Showing
        // the check from HH:MM" for a verdict no server produced — reachable
        // by adding the first node to an empty canvas while the service is
        // down. Same invariant the 429 arm is nulled for; this is the branch
        // that was still breaking it.
        verdictAtMs: null,
      })
      return
    }

    // ── ROADMAP 2.332: build and compare BEFORE touching store state ──
    //
    // The payload-hash check used to sit AFTER `{loading: true, error: null}`,
    // so a canvas emission that changed nothing the server sees still flashed
    // `loading` and — once #564 made failure set a truthful `error` — ERASED
    // that error, with no request in flight to replace it. Composed with
    // #564 the ordering was the difference between "Could not check readiness"
    // and a panel that silently went quiet again.
    //
    // A no-op now touches NO store state at all: it does not clear the error,
    // does not flash loading, and does not disturb the stale mark.
    const payloadJson = buildReadinessPayload(canvasState)

    if (payloadJson === lastPayloadHash) {
      return
    }

    // Record the ATTEMPT (not the success): the change detector needs to know
    // what was last asked, including when the answer never arrived.
    lastObservedPayload = payloadJson

    // Release previous shared dedup entry
    if (currentInflightEntry) {
      currentInflightEntry.refCount--
      if (currentInflightEntry.refCount <= 0) {
        currentInflightEntry.controller.abort()
      }
      currentInflightEntry = null
    }

    useReadinessStore.setState({ loading: true, error: null })

    const correlationId = generateCorrelationId()

    try {
      // Set after successful fetch (not here) so failed fetches don't poison the cache.
      // See the setState call after response normalization below.
      const currentPayloadJson = payloadJson

      if (import.meta.env.DEV && now - lastLogTime > 5000) {
        console.warn('[readinessStore] Fetching readiness:', {
          nodes: currentNodes.length,
          edges: currentEdges.length,
          hasAnalysisReady: Boolean(currentCeeAnalysisReady?.options?.length),
        })
        lastLogTime = now
      }

      let response: DeduplicatedResponse
      try {
        const { promise, entry } = dedupUtils.deduplicatedFetch(
          `${CEE_BASE_URL}/graph-readiness`,
          payloadJson,
          correlationId,
          // Optional env-injected Bearer for the PLoT-direct graph-readiness
          // call. Empty {} until VITE_PLOT_BEARER is provisioned → today's
          // behaviour, byte-for-byte.
          plotAuthHeaders(),
        )
        currentInflightEntry = entry
        response = await promise
      } catch (fetchErr) {
        // An abort is a cancellation, not a failure — the outer catch owns it.
        if ((fetchErr as Error).name === 'AbortError') throw fetchErr

        // ── ROADMAP 2.319(a): no verdict is not a verdict ────────────
        //
        // `deduplicatedFetch` performs BOTH the `fetch()` and the
        // `response.json()` inside one async IIFE, so everything below lands
        // here as a single rejection:
        //   · every transport failure — connection reset, cold start, offline,
        //     DNS, TLS, and CORS. This call IS cross-origin in the deployed
        //     UI, and that is NOT derivable from this repo (CLAUDE.md trap 18):
        //     `CEE_BASE_URL` defaults to the same-origin path `/bff/cee` and
        //     nothing in the tree sets `VITE_CEE_BFF_BASE`. It is set in the
        //     NETLIFY DASHBOARD to the absolute URL
        //     `https://plot-lite-service-staging.onrender.com/v1/cee` and Vite
        //     INLINES it at build time — established by a recursive crawl of
        //     the deployed JS chunks (zero `/bff/cee` literals, four absolute
        //     `/v1/cee` hits) and corroborated by that service's own route
        //     counters showing live traffic to those paths. So a cold start on
        //     Render, a CORS refusal or a TLS failure all land here in
        //     production. The fix does not rest on that fact — same-origin
        //     fetches reject too — but it is why the blast radius is wide;
        //   · jsdom's invalid-relative-URL TypeError, which is the single
        //     case this catch was originally written for; and
        //   · a 2xx whose body would not parse as JSON.
        // A non-2xx response does NOT arrive here — `response.ok` is false and
        // it is handled immediately below.
        //
        // What this used to do is the defect, and it was SYSTEMATIC rather
        // than transient. It fell through to `calculateFallbackReadiness` — a
        // node/edge-count heuristic whose verdict is
        // `can_run_analysis: blockers.length === 0`, where the blockers come
        // from `graphHealth`. `graphHealth` is `null` in the canvas store's
        // initial state and is only ever populated from a COMPLETED analysis
        // report's `graph_quality`. So before the first analysis there are
        // never any blockers to find, and an unreachable server did not merely
        // RISK opening the gate — it ALWAYS granted the run, on the most
        // common path there is.
        //
        // And because it OVERWROTE `readiness` while reporting `error: null`,
        // it also replaced a `can_run_analysis: false` the server had already
        // given (the ROADMAP 2.308 blocked state) with a locally invented
        // `true` that no consumer could distinguish from the server's own
        // answer.
        //
        // So: publish no verdict, and say why.
        //   · `readiness` is left EXACTLY as it was. On first load that is
        //     `null`, which — alongside a non-null `error` — is the store's
        //     OWN pre-existing "unknown" state, and it already has a rendered
        //     surface: PreAnalysisHealth shows "Could not check graph health"
        //     with a Retry button on `error && !readiness`. That branch was
        //     UNREACHABLE on this path precisely because the fallback always
        //     populated `readiness`. Nothing new is introduced here; a dormant
        //     honest path is restored.
        //   · Otherwise it is the last answer the server actually gave, which
        //     a local guess is not entitled to replace.
        //   · `lastPayloadHash` is deliberately still unset, so the identical
        //     graph can be re-requested — a failure here must not be sticky.
        //
        // Two alternatives were considered and rejected, recorded here because
        // the next reader will reach for one of them:
        //   · Threading a tri-state `can_run_analysis` ('yes' | 'no' |
        //     'unknown') through its SIX non-test consumers — PreAnalysisHealth,
        //     usePreAnalysisData, usePreAnalysisModel, canRunAnalysis,
        //     composeBlockedReason and the two gate call sites. That is the
        //     hand-maintained-mirror shape (CLAUDE.md trap 12): a consumer
        //     missed keeps reading a boolean and fails SILENTLY, in the
        //     permissive direction. A state the store cannot lie about beats a
        //     state six readers must each remember to honour.
        //   · Setting `can_run_analysis: false` here. It is equally a locally
        //     invented verdict, just in the blocking direction — and with no
        //     prior server answer it strands the user behind a disabled Run
        //     button with copy composed from verdict fields that do not exist,
        //     which is exactly the permanent-dead-end class ROADMAP 2.308 was
        //     opened to fix. Trading a false "yes" for a false "no" is not a
        //     fix; refusing to answer is.
        const message =
          fetchErr instanceof ReadinessBodyUnreadableError
            ? 'Could not read the readiness service response'
            : 'Could not reach the readiness service'
        console.warn(`[readinessStore] ${message} — publishing no verdict:`, fetchErr)
        useReadinessStore.setState({ error: message, loading: false })
        return
      }

      if (!response.ok) {
        if (response.status === 429) {
          const backoffDelay = response.retryAfterHeader
            ? parseInt(response.retryAfterHeader, 10) * 1000
            : Math.min(
                backoff.delay > 0 ? backoff.delay * BACKOFF_MULTIPLIER : INITIAL_BACKOFF_MS,
                MAX_BACKOFF_MS,
              )

          backoff = { delay: backoffDelay, until: Date.now() + backoffDelay }

          console.warn(
            `[readinessStore] Rate limited (429), backing off for ${backoffDelay / 1000}s`,
          )

          const fallback = calculateFallbackReadiness(currentNodes, currentEdges, graphHealth)
          useReadinessStore.setState({
            readiness: fallback,
            error: 'Rate limited - using local validation',
            loading: false,
            // ROADMAP 2.332 — this arm's BEHAVIOUR is deliberately unchanged
            // (it still publishes the labelled local fallback; retiring that is
            // a separate row). But `verdictAtMs` means "when `readiness` was
            // last set from an ANSWER", and this verdict is not one — it is the
            // local heuristic. Stamping it would let a surface cite a time for
            // a number no server produced, which is the fabrication class this
            // whole slice exists to close. Explicitly null, so the absence is a
            // decision rather than an oversight.
            verdictAtMs: null,
          })
          return
        }

        // ── ROADMAP 2.329: a 404 here is an OUTAGE, not a deployment choice ──
        //
        // This branch used to publish `calculateFallbackReadiness` with NO
        // error — the same defect 2.319(a) fixed one level up, on the path
        // that was left out of it pending adjudication. The adjudication is
        // now derived at the deployed bytes
        // (PHASE0-EVIDENCE-2026-07-28/adjudication-2329-404-branch.md):
        //
        //   · NO deployed configuration produces a 404 on this path BY DESIGN.
        //     On PLoT's deploy branch the route is registered UNCONDITIONALLY
        //     — `createServer` → `registerV1Routes` → `registerCeeProxyRoutes`
        //     → `app.post('/v1/cee/graph-readiness', …)`, no guard at any hop —
        //     and a missing CEE_BASE_URL/CEE_API_KEY yields an error RESPONSE
        //     from a registered handler, never a 404. Staging answers 401
        //     (registered, auth-gated) where a control path answers 404.
        //   · The `'/bff/cee'` same-origin fallback does not survive
        //     minification in either deployed bundle (zero literals across an
        //     81-chunk staging crawl and a 40-chunk production crawl), so the
        //     "dead SPA redirect returns index.html" 404 vector is unreachable
        //     in the shipped artifacts.
        //   · One deployed configuration DOES 404 in steady state: production,
        //     whose PLoT predates the route by ~6.5 months while its paired UI
        //     bundle (built two months AFTER the route landed) bakes the call
        //     in. That is deploy drift — the outage class — and this branch is
        //     precisely what kept it invisible for those months.
        //
        // So there is no configuration this branch could be serving. Treat it
        // exactly as a transport failure is treated: publish no verdict, set a
        // truthful error, leave `lastPayloadHash` unset so a redeploy is picked
        // up on the next request. `readiness` is left EXACTLY as it was — null
        // on first load (the store's own "unknown" state), otherwise the last
        // answer the server actually gave, which a local guess is not entitled
        // to replace.
        //
        // Deliberately NOT a third state, and deliberately not `false`: both
        // were considered and rejected at the transport catch above, for the
        // same reasons (trap-12 tri-state threading; a false "no" is still a
        // locally invented verdict).
        //
        // Consequence, stated rather than buried: shipped to production as-is
        // against today's production PLoT, readiness would report a permanent,
        // TRUTHFUL "could not check" until prod PLoT redeploys. That is a real
        // outage becoming visible, not a regression introduced here.
        if (response.status === 404) {
          const message = 'Could not find the readiness service'
          console.warn(
            `[readinessStore] ${message} (HTTP 404) — publishing no verdict:`,
            response.errorBody,
          )
          useReadinessStore.setState({ error: message, loading: false })
          return
        }

        // ── ROADMAP 2.339: every remaining non-ok status ─────────────
        //
        // 500, 502, 503, 401, 403 — everything that is not 429 or 404. The
        // body is logged, never carried: the pristine error string was
        // `HTTP ${status} - ${errorBody}`, which for the outage shape that
        // matters most (a proxy's HTML error page) put a page of markup where
        // the UI expected a sentence.
        console.error('[readinessStore] CEE error response:', {
          status: response.status,
          statusText: response.statusText,
          body: response.errorBody,
        })
        throw new ReadinessServiceStatusError(response.status)
      }

      backoff = { delay: 0, until: 0 }

      const data = response.data

      const normalized: GraphReadiness = {
        readiness_score:
          typeof data.readiness_score === 'number'
            ? Math.max(0, Math.min(100, data.readiness_score))
            : 50,
        readiness_level: normaliseReadinessLevel(data.readiness_level),
        can_run_analysis:
          typeof data.can_run_analysis === 'boolean' ? data.can_run_analysis : true,
        confidence_explanation:
          typeof data.confidence_explanation === 'string'
            ? data.confidence_explanation
            : 'Analysis available',
        improvements: Array.isArray(data.improvements)
          ? data.improvements.map((imp: any): GraphImprovement => ({
              category: imp.category || 'general',
              action: imp.action || imp.recommendation || 'Review this area',
              current_gap: imp.current_gap || '',
              quality_impact:
                typeof imp.quality_impact === 'number'
                  ? imp.quality_impact
                  : typeof imp.potential_improvement === 'number'
                    ? imp.potential_improvement
                    : 5,
              target_quality:
                typeof imp.target_quality === 'number'
                  ? imp.target_quality
                  : typeof imp.target_score === 'number'
                    ? imp.target_score
                    : 70,
              priority: ['high', 'medium', 'low'].includes(imp.priority)
                ? imp.priority
                : imp.impact || 'medium',
              effort_minutes: typeof imp.effort_minutes === 'number' ? imp.effort_minutes : 5,
              affected_nodes: Array.isArray(imp.affected_nodes)
                ? imp.affected_nodes
                : Array.isArray(imp.affected_node_ids)
                  ? imp.affected_node_ids
                  : undefined,
              affected_edges: Array.isArray(imp.affected_edges)
                ? imp.affected_edges
                : Array.isArray(imp.affected_edge_ids)
                  ? imp.affected_edge_ids
                  : undefined,
              suggested_node_type: imp.suggested_node_type || undefined,
              current_score:
                typeof imp.current_score === 'number' ? imp.current_score : undefined,
            }))
          : [],
        // UI-SEM-091 (CEE #612): forward the scaffold intent verbatim. Without
        // this explicit forward the field would be silently dropped by the
        // normaliser (the schema-skew hazard). Absent/malformed ⇒ undefined,
        // which is fail-safe (gate collapses to can_run_analysis).
        scaffold_plan:
          data.scaffold_plan && typeof data.scaffold_plan.will_scaffold_options === 'boolean'
            ? {
                will_scaffold_options: data.scaffold_plan.will_scaffold_options,
                ...(typeof data.scaffold_plan.option_count === 'number'
                  ? { option_count: data.scaffold_plan.option_count }
                  : {}),
              }
            : undefined,
        // Structured V3 verdict fields — the SAME schema-skew hazard as
        // scaffold_plan above: this normaliser builds an explicit object, so a
        // field not named here is silently dropped before any UI code can see
        // it. The blocked-state copy is composed from these three (see
        // utils/composeBlockedReason.ts); without the explicit forward it would
        // have only the engine's prose to work from, which is precisely the
        // defect being fixed. Wrong type ⇒ undefined ⇒ the composer degrades to
        // less specific TRUE copy.
        options_ready: typeof data.options_ready === 'number' ? data.options_ready : undefined,
        options_total: typeof data.options_total === 'number' ? data.options_total : undefined,
        goal_node_valid:
          typeof data.goal_node_valid === 'boolean' ? data.goal_node_valid : undefined,
      }

      // Only cache the payload hash after a successful fetch — failed fetches
      // should allow retry on the same payload.
      lastPayloadHash = currentPayloadJson
      // ── ROADMAP 2.332 amendment 1: an answer clears only its OWN mark ──
      //
      // `stale: false` was unconditional here, and that let an answer launder
      // a mark raised AFTER it was sent: mutate during a slow fetch, the
      // in-flight answer lands, and the mark for a model it never saw is wiped.
      // The queue-on-drop repair above guarantees the mutated model IS asked
      // about, but the deferred request has not returned yet at this instant —
      // so without this the store would report "current" about a model whose
      // honest answer is still in the air.
      //
      // Derived, not tracked: rebuild the payload from the canvas as it stands
      // NOW and compare with what this response answered. Same function as the
      // request and the change detector, so it cannot disagree with either.
      const answersCurrentModel =
        buildReadinessPayload(useCanvasStore.getState()) === currentPayloadJson
      useReadinessStore.setState({
        readiness: normalized,
        loading: false,
        error: null,
        // Cleared only when this verdict describes the model on the canvas.
        // When it does not, the mark stands until the deferred answer arrives.
        ...(answersCurrentModel ? { stale: false } : {}),
        verdictAtMs: Date.now(),
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      // ── ROADMAP 2.339: the last fabrication path in this file ────
      //
      // This catch used to publish `calculateFallbackReadiness` as the
      // readiness verdict. #564 closed that on the transport limb and 2.329
      // closed it on the 404 limb; the #564 PR body then said "only 429
      // remains untouched", and the review refuted it at the bytes — EVERY
      // other non-ok status (500/502/503/401/403) was thrown into here and
      // answered with the heuristic.
      //
      // It is the same defect with the same two teeth. The heuristic's verdict
      // is `can_run_analysis: blockers.length === 0`, the blockers come from
      // `graphHealth`, and `graphHealth` is null until an analysis has already
      // run — so before the first analysis a 502 did not merely RISK opening
      // the gate, it ALWAYS granted the run. And because it overwrote
      // `readiness`, it could replace a `can_run_analysis: false` the server
      // had already given with a locally invented `true` no consumer could
      // tell from the server's own answer.
      //
      // A Render cold start answers 502. This is the most likely real outage
      // shape there is, and it was the one limb with no test at all.
      //
      // So: publish no verdict, and say why — the mechanism #564 established.
      //   · `readiness` is left EXACTLY as it was: null on first load (the
      //     store's own "unknown" state, alongside a non-null `error`), and
      //     otherwise the last answer the server actually gave, which a local
      //     guess is not entitled to replace.
      //   · `stale` is deliberately NOT touched. If the model changed since
      //     that retained verdict, it is still stale, and saying so is the
      //     truth; clearing it here would launder an outgrown verdict into a
      //     current-looking one.
      //   · `lastPayloadHash` stays unset, so the identical graph can be
      //     re-requested the moment the service recovers.
      //   · The message names the failure and carries the status. It never
      //     carries the response body (see the throw site above).
      //
      // The alternatives were considered and rejected at the transport catch
      // for reasons that apply here unchanged: a tri-state threaded through
      // six consumers is the hand-maintained-mirror shape (CLAUDE.md trap 12),
      // and `can_run_analysis: false` is equally a locally invented verdict,
      // just in the blocking direction.
      const message =
        err instanceof ReadinessServiceStatusError
          ? `The readiness service could not answer (HTTP ${err.status})`
          : 'Could not complete the readiness check'
      console.warn(`[readinessStore] ${message} — publishing no verdict:`, err)
      useReadinessStore.setState({ error: message, loading: false })
    }
  } finally {
    fetchInFlight = false
    // Drain exactly one deferred call. Re-entry is bounded, not a loop: the
    // flag is cleared BEFORE the re-invoke, and the re-invoked fetch returns
    // without a request whenever the payload already has a verdict.
    if (fetchQueued) {
      fetchQueued = false
      fetchReadiness().catch(() => {
        // Swallow — fetchReadiness handles its own errors internally.
      })
    }
  }
}

// ── Store definition ───────────────────────────────────────────────

export const useReadinessStore = create<ReadinessStoreState & ReadinessStoreActions>((set, get) => ({
  ...initialState,

  refresh: () => {
    lastPayloadHash = null
    lastObservedPayload = null
    fetchReadiness().catch(() => {
      // Swallow — fetchReadiness handles errors internally
    })
  },

  startListening: () => {
    listenerRefCount++

    if (!unsubCanvasStore) {
      // First consumer — create the subscription
      unsubCanvasStore = useCanvasStore.subscribe((state, prevState) => {
        // ── ROADMAP 2.332: derive the change signal from the payload ──
        //
        // Step 1, cheap: did any root the payload is built from change
        // IDENTITY? Same early-out the pristine code had, widened from
        // `nodes`/`edges` to the full watched set — `ceeAnalysisReady` (where
        // the 3 Aug walk's successful remedy landed, via
        // `mirrorAnalysisReady → setCeeAnalysisReady`, and was never seen) and
        // `currentBriefText` (never watched at all).
        const rootChanged = WATCHED_ROOTS.some(
          (root) =>
            (state as unknown as Record<string, unknown>)[root] !==
            (prevState as unknown as Record<string, unknown>)[root],
        )
        if (!rootChanged) return

        // Step 2: did anything the SERVER would see actually change? Built by
        // the same function the request uses, so it cannot answer differently
        // from the request. A node drag produces new identities and an
        // identical payload — no mark, no request, and (critically, composing
        // with #564) no disturbance to a standing error.
        const nextPayload = buildReadinessPayload(state as unknown as ReadinessPayloadInputs)
        if (nextPayload === lastObservedPayload) return

        // The verdict currently on screen was not asked about this model.
        // Marked synchronously — before the debounce, before the request — so
        // there is no window in which an outgrown verdict looks current.
        useReadinessStore.setState({ stale: true })

        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          fetchReadiness().catch(() => {
            // Swallow — fetchReadiness handles errors internally
          })
        }, DEBOUNCE_DELAY)
      })

      // Fire immediately on first listen
      fetchReadiness().catch(() => {
        // Swallow — fetchReadiness handles its own errors internally.
        // This catch prevents unhandled rejection in test environments
        // where fetch() rejects due to relative URL in jsdom.
      })
    }

    // Return a release function. Subscription only tears down when
    // the last consumer releases (refCount drops to 0).
    return () => {
      listenerRefCount--
      if (listenerRefCount <= 0) {
        stopListening()
      }
    }
  },

  reset: () => {
    stopListening()
    set(initialState)
  },
}))

/** Clean up subscription, timers, and module-level state. */
function stopListening(): void {
  listenerRefCount = 0
  if (unsubCanvasStore) {
    unsubCanvasStore()
    unsubCanvasStore = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (currentInflightEntry) {
    currentInflightEntry.refCount--
    if (currentInflightEntry.refCount <= 0) {
      currentInflightEntry.controller.abort()
    }
    currentInflightEntry = null
  }
  lastObservedPayload = null
  lastPayloadHash = null
  fetchInFlight = false
  fetchQueued = false
  backoff = { delay: 0, until: 0 }
  lastLogTime = 0
}

// Selectors
export const selectReadiness = (state: ReadinessStoreState) => state.readiness
export const selectReadinessLoading = (state: ReadinessStoreState) => state.loading
export const selectReadinessError = (state: ReadinessStoreState) => state.error
/** ROADMAP 2.332 — true when the model has moved on from the verdict on screen. */
export const selectReadinessStale = (state: ReadinessStoreState) => state.stale
/** ROADMAP 2.332 — when the verdict on screen was taken. */
export const selectReadinessVerdictAtMs = (state: ReadinessStoreState) => state.verdictAtMs

// ── Test helpers ───────────────────────────────────────────────────

/** @internal — exposed for unit testing. Not part of public API. */
export const __test__ = {
  fetchReadiness,
  calculateFallbackReadiness,
  getModuleState: () => ({
    lastObservedPayload,
    lastPayloadHash,
    fetchInFlight,
    fetchQueued,
    backoff,
    listenerRefCount,
    hasSubscription: unsubCanvasStore !== null,
    hasDebounceTimer: debounceTimer !== null,
  }),
  resetModuleState: () => {
    stopListening()
  },
}
