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
import { getEdgeKey } from '../domain/edgeUtils'
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
}

// ── Module-level singletons ────────────────────────────────────────
// These replace the per-hook-instance useRef values.

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let unsubCanvasStore: (() => void) | null = null
/** Number of active consumers (hook instances). Subscription tears down at 0. */
let listenerRefCount = 0
let lastFingerprint: string | null = null
let lastPayloadHash: string | null = null
let fetchInFlight = false
let backoff = { delay: 0, until: 0 }
let lastLogTime = 0
/** Ref-counted dedup entry from the shared inflight cache */
let currentInflightEntry: { refCount: number; controller: AbortController } | null = null

// ── Helpers ────────────────────────────────────────────────────────

function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * Create a stable fingerprint for graph state.
 * Only changes when graph content actually changes.
 */
function createGraphFingerprint(nodes: Node[], edges: Edge[]): string {
  const nodeFingerprint = nodes
    .map((n) => {
      const value = (n.data as any)?.value
      return `${n.id}:${n.type}:${typeof value === 'number' ? value.toFixed(3) : 'x'}`
    })
    .sort()
    .join(',')

  const edgeFingerprint = edges
    .map((e) => {
      const conf = (e.data as any)?.confidence
      return `${getEdgeKey(e)}:${conf !== undefined ? conf.toFixed(3) : 'x'}`
    })
    .sort()
    .join(',')

  return `n${nodes.length}|e${edges.length}|${nodeFingerprint}|${edgeFingerprint}`
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
  if (fetchInFlight) return
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

    const {
      nodes: currentNodes,
      edges: currentEdges,
      graphHealth,
      ceeAnalysisReady: currentCeeAnalysisReady,
    } = useCanvasStore.getState()

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
      })
      return
    }

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
      const payload: Record<string, unknown> = {
        graph: {
          nodes: currentNodes.map((n) => {
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
          edges: currentEdges.map((e) => ({
            id: e.id,
            from: e.source,
            to: e.target,
            weight: (e.data as any)?.weight ?? 0.5,
            belief: (e.data as any)?.beliefExists ?? (e.data as any)?.belief ?? 0.8,
            effect_direction: (e.data as any)?.direction ?? 'positive',
          })),
        },
      }

      const briefText = useCanvasStore.getState().currentBriefText
      if (briefText && briefText.length >= 20) {
        payload.brief = briefText
      }

      if (currentCeeAnalysisReady?.options?.length) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { model_adjustments: _strip, ...analysisReadyForPayload } = currentCeeAnalysisReady
        payload.analysis_ready = analysisReadyForPayload
      }

      const payloadJson = JSON.stringify(payload)

      if (payloadJson === lastPayloadHash) {
        useReadinessStore.setState({ loading: false })
        return
      }
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
          })
          return
        }

        if (response.status === 404) {
          if (import.meta.env.DEV) {
            console.info(
              '[readinessStore] CEE graph-readiness endpoint not available (404), using local validation',
            )
          }
          const fallback = calculateFallbackReadiness(currentNodes, currentEdges, graphHealth)
          useReadinessStore.setState({ readiness: fallback, loading: false })
          return
        }

        console.error('[readinessStore] CEE error response:', {
          status: response.status,
          statusText: response.statusText,
          body: response.errorBody,
        })
        throw new Error(`HTTP ${response.status} - ${response.errorBody}`)
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
      useReadinessStore.setState({ readiness: normalized, loading: false, error: null })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      console.warn('[readinessStore] Fetch failed, using fallback:', err)
      const fallback = calculateFallbackReadiness(currentNodes, currentEdges, graphHealth)
      useReadinessStore.setState({
        readiness: fallback,
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false,
      })
    }
  } finally {
    fetchInFlight = false
  }
}

// ── Store definition ───────────────────────────────────────────────

export const useReadinessStore = create<ReadinessStoreState & ReadinessStoreActions>((set, get) => ({
  ...initialState,

  refresh: () => {
    lastPayloadHash = null
    fetchReadiness().catch(() => {
      // Swallow — fetchReadiness handles errors internally
    })
  },

  startListening: () => {
    listenerRefCount++

    if (!unsubCanvasStore) {
      // First consumer — create the subscription
      unsubCanvasStore = useCanvasStore.subscribe((state, prevState) => {
        // Only react to node/edge changes — skip unrelated store updates.
        // Identity check is cheap; fingerprint is computed only on mismatch.
        if (state.nodes === prevState.nodes && state.edges === prevState.edges) return

        const fp = createGraphFingerprint(state.nodes, state.edges)
        if (fp === lastFingerprint) return
        lastFingerprint = fp

        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          fetchReadiness().catch(() => {
            // Swallow — fetchReadiness handles errors internally
          })
        }, DEBOUNCE_DELAY)
      })

      // Fire immediately on first listen
      const { nodes, edges } = useCanvasStore.getState()
      lastFingerprint = createGraphFingerprint(nodes, edges)
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
  lastFingerprint = null
  lastPayloadHash = null
  fetchInFlight = false
  backoff = { delay: 0, until: 0 }
  lastLogTime = 0
}

// Selectors
export const selectReadiness = (state: ReadinessStoreState) => state.readiness
export const selectReadinessLoading = (state: ReadinessStoreState) => state.loading
export const selectReadinessError = (state: ReadinessStoreState) => state.error

// ── Test helpers ───────────────────────────────────────────────────

/** @internal — exposed for unit testing. Not part of public API. */
export const __test__ = {
  fetchReadiness,
  createGraphFingerprint,
  calculateFallbackReadiness,
  getModuleState: () => ({
    lastFingerprint,
    lastPayloadHash,
    fetchInFlight,
    backoff,
    listenerRefCount,
    hasSubscription: unsubCanvasStore !== null,
    hasDebounceTimer: debounceTimer !== null,
  }),
  resetModuleState: () => {
    stopListening()
  },
}
