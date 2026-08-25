/**
 * serverGraphHydration — the boot orchestration for ROADMAP 2.312 piece 3.
 *
 * Reads the scenario's graph from CEE and merges its VALUES onto the restored
 * canvas, keeping the LOCAL layout. Deliberately a plain async function rather
 * than logic inside a hook, so every boot outcome — including the refusals —
 * is measurable without mounting React.
 *
 * ⚠ THE ONE INVARIANT: an answer that is not a graph NEVER touches the canvas.
 * A 404 on this route is "not readable" — the union of absent, not-yours and
 * ownership-oracle-unresolvable — and is explicitly NOT authoritative deletion;
 * a 503 is "unknown, try again". Both leave the canvas exactly as the autosave
 * restored it, with no error surfaced: a user who is offline, or whose guest
 * scenario the server has never seen, is in a normal state and has nothing to
 * act on. Rendering a DB blip as an empty canvas over live data is the precise
 * failure the server's fail-closed 503 exists to prevent, and it would be
 * reintroduced here by treating any of these as "no graph".
 */

import { useCanvasStore } from '../store'
import { useContextIntegrityStore } from '../stores/contextIntegrityStore'
import { logger } from '../../lib/logger'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { mergeServerGraphOnHydrate } from '../utils/mergeServerGraph'
import { applyBootAnalysisVerdict } from './applyScenarioAnalysisRead'

export type HydrationOutcome =
  /** The server's graph was read and merged onto the canvas. */
  | 'merged'
  /** Read fine; CEE's token says the server graph has not moved. No write. */
  | 'unchanged'
  /** 200 with no graph yet — a normal empty scenario. Canvas untouched. */
  | 'absent'
  /**
   * A graph arrived and the MERGE refused it — unusable shape, an empty server
   * graph, or zero node-id overlap with a non-empty canvas. Canvas untouched and
   * NO identity token recorded, so the next read re-attempts. Distinct from
   * `'refused'`, which is a TRANSPORT refusal (401/403/429).
   */
  | 'mergeRefused'
  /** 404 — not readable. NEVER deletion. Canvas untouched. */
  | 'notReadable'
  /** 503 through every attempt. Canvas untouched. */
  | 'unavailable'
  /** 401 / 403 / 429. Canvas untouched. */
  | 'refused'
  /** Transport failure or a shape we cannot act on. Canvas untouched. */
  | 'unusable'
  /** No usable scenario id — nothing was requested. */
  | 'skipped'

export interface HydrateFromServerOptions {
  /** Supabase user id, when signed in. Omitted for guests. */
  userId?: string | null
  /**
   * Supabase access token, when signed in. Travels the SAME route as `userId`
   * so CEE can verify the caller rather than trust the body. Null for guests.
   */
  accessToken?: string | null
  signal?: AbortSignal
  retryDelayMs?: number
  /** Per-attempt deadline — bounds the silent-rollback window (review A3). */
  timeoutMs?: number
}

/**
 * A scenario id CEE can address is a UUID — `scenarios.id` is a uuid column, so
 * anything else is a local draft id and would spend a request to earn a
 * guaranteed refusal.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Whether CEE's answer is the SAME graph we already hydrated from.
 *
 * ⚠ CEE-TO-CEE, GATED ON `projectionVersion`. Both sides of this comparison are
 * tokens CEE issued; nothing here is derived locally, and equality is only
 * meaningful WITHIN one projection. When the projection differs the values are
 * simply not comparable — the normalisation behind them has changed — so the
 * answer is "not known to be the same", which re-merges. Comparing across
 * versions would silently skip a hydration on a coincidence of bytes.
 */
function isSameServerGraph(
  stored: { value: string; projectionVersion: string } | null,
  fetched: { value: string; projectionVersion: string } | null,
): boolean {
  if (!stored || !fetched) return false
  if (stored.projectionVersion !== fetched.projectionVersion) return false
  return stored.value === fetched.value
}

/**
 * Hydrate the canvas from the server's copy of this scenario's graph.
 *
 * Never throws and never rejects — the caller is a boot effect, and an
 * unhandled rejection at boot is how a canvas ends up in an undefined state.
 */
export async function hydrateCanvasFromServer(
  scenarioId: string | null | undefined,
  opts: HydrateFromServerOptions = {},
): Promise<HydrationOutcome> {
  if (typeof scenarioId !== 'string' || !UUID_RE.test(scenarioId)) {
    return 'skipped'
  }

  const result = await fetchScenarioGraph(scenarioId, {
    userId: opts.userId,
    accessToken: opts.accessToken,
    signal: opts.signal,
    retryDelayMs: opts.retryDelayMs,
    timeoutMs: opts.timeoutMs,
  })

  // ── Every non-graph answer: leave the canvas alone, say why, surface nothing.
  if (result.status !== 'graph') {
    logger.debug('server_graph_hydration.no_merge', {
      scenarioId,
      outcome: result.status,
    })
    switch (result.status) {
      case 'absent':
        return 'absent'
      case 'notReadable':
        return 'notReadable'
      case 'unavailable':
        return 'unavailable'
      case 'refused':
        return 'refused'
      default:
        return 'unusable'
    }
  }

  // A canvas whose scenario changed under an in-flight read must not receive
  // another scenario's graph — the request is slower than a route change.
  const currentId = useCanvasStore.getState().currentScenarioId
  if (currentId !== null && currentId !== undefined && currentId !== scenarioId) {
    logger.warn('server_graph_hydration.scenario_moved', {
      requestedScenarioId: scenarioId,
      currentScenarioId: currentId,
    })
    return 'skipped'
  }

  // ── ROADMAP 2.973 — record what we were given, and what CEE says it kept ──
  //
  // DELIBERATELY BEFORE THE `unchanged` SHORT-CIRCUIT BELOW. That branch exists
  // because the GRAPH has not moved, which is the common case on every re-boot
  // of an existing scenario — and it is precisely then that the user is most
  // likely to open the panel. Recording after it would leave the surface empty
  // for exactly the sessions it is meant to serve.
  //
  // `result.notModelled` is `null` when CEE sent no manifest. That null is
  // stored AS a null: the surface renders it as "we cannot tell you", never as
  // an empty list, which on a brief we demonstrably lose content from would be
  // a new and more damaging lie than the silence it replaces.
  // `scenarioId` is the scenario this content DESCRIBES, and the surface refuses
  // to render unless it matches the live one. It is the requested id, not
  // `currentId`: the two are equal here (the guard above returned otherwise),
  // and the requested id is the one the payload actually came back for.
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId,
    briefText: result.briefText,
    manifest: result.notModelled,
  })

  // ── A3 LINK 6 — CONSUME THE VERDICT THIS RESPONSE ALREADY CARRIES ─────────
  //
  // `fetchScenarioGraph` parses CEE's composed `AnalysisStateV1` off the SAME
  // body the graph came in (`adapters/cee/scenarioGraph.ts:296`), and this
  // function used to drop it. Its only consumer was the provisional-delivery
  // hook, which arms exclusively on a standing `running` verdict that
  // `hydrateGraphSlice` has just nulled at boot (`store.ts:6043`) — so the
  // verdict was fetched, validated against the contract, and discarded on every
  // ordinary reload.
  //
  // ⚠ AND IT MAY ONLY EVER WITHHOLD CURRENCY. `applyBootAnalysisVerdict`
  // declines `complete_current` outright: on the selector's WIRE branch the
  // local dirty overlay is not consulted, so restoring a currency claim here
  // would render "Analysis complete" over a canvas the merge below is about to
  // mark stale. See that function's header for the full derivation.
  //
  // ⚠ ORDERING AGAINST #837: the two writes are DISJOINT and neither can
  // overwrite the other. `markGraphStructurallyEdited` (fired inside
  // `mergeServerGraphOnHydrate`, `mergeServerGraph.ts:512`) writes
  // `graphEditedSinceLastRun` / `analysisStateReady` / `analysisFreshnessDirty`;
  // this writes `analysisStateV1` and nothing else. Pinned in BOTH directions in
  // `__tests__/bootAnalysisVerdictRestore.spec.ts` rather than left to this
  // comment — a disjointness that only a comment asserts is one refactor from
  // being false.
  const restoreVerdict = (): void => {
    const verdictOutcome = applyBootAnalysisVerdict({
      analysisState: result.analysisState,
      store: { setAnalysisStateV1: useCanvasStore.getState().setAnalysisStateV1 },
    })
    logger.debug('server_graph_hydration.boot_verdict', {
      scenarioId,
      outcome: verdictOutcome.outcome,
      detail:
        verdictOutcome.outcome === 'restored'
          ? verdictOutcome.kind
          : verdictOutcome.reason,
    })
  }

  // ── ⚠⚠ THE VERDICT IS GATED ON GRAPH ACCEPTANCE, AND THAT IS THE WHOLE POINT ──
  //
  // THE DEFECT THIS CLOSES, live on staging at `01755479`: this call used to sit
  // HERE, unconditionally, fifty lines above the `merge.accepted` gate below. So
  // on every boot where the MERGE REFUSED, CEE's verdict was still written into
  // `analysisStateV1` — and that field is FEATURE-DETECTED by the selector: a
  // non-null value takes the WIRE branch, where the local dirty overlay is not
  // consulted (`analysisStateSelector.ts:551-554`).
  //
  // The refused graph's verdict therefore became AUTHORITATIVE over the user's
  // OWN local graph — the one the refusal exists to protect — and the product
  // told them "Model changed since this analysis" about a model that analysis
  // never ran on. A System-A truth defect: a false assertion about the user's
  // own model, which is worse than silence.
  //
  // Reachable through three of the merge's four refusal reasons (the fourth,
  // `unusableShape`, is filtered earlier by the adapter — measured, and pinned
  // as such in `__tests__/bootVerdictGraphAcceptance.spec.ts`):
  //   `zeroOverlap`         two unrelated graphs — the verdict describes THEIRS
  //   `importUnregistered`  the canvas holds an import the server has NEVER seen
  //   `emptyServerGraph`    a verdict about a graph CEE does not have
  //
  // ⚠ THE FIX IS NOT "MOVE IT BELOW `merge.accepted`" — THAT WOULD BREAK THE
  // COMMONEST BOOT OF ALL. The `unchanged` short-circuit returns BEFORE the
  // merge runs, so a literal reordering would drop the verdict on every re-boot
  // of an unmoved scenario — precisely the sessions the original placement note
  // was right to worry about, and precisely when a user is most likely to open
  // the panel.
  //
  // `unchanged` IS an accepted path, and the reason is structural rather than
  // conventional: the identity token it matches on is recorded ONLY after a
  // merge was accepted (the `!merge.accepted` return below precedes the
  // `setServerGraphIdentity` call). A token match is therefore PROOF OF A PRIOR
  // ACCEPTANCE of that exact server graph, under that exact projection version.
  //
  // So the rule is ACCEPTANCE, not position: restore at each of the two exits
  // that represent an accepted graph, and at neither refusal. Both directions
  // are pinned — the refusal-negative AND the accepted-positive — because one
  // predicate here guards two opposite harms, and a fix aimed only at the lie
  // would re-open #842's gap on the way past.
  const stored = useCanvasStore.getState().serverGraphIdentity
  if (isSameServerGraph(stored, result.identity)) {
    // The server has not moved since we last hydrated, so there is nothing to
    // apply. Skipping is not merely an optimisation: re-merging would roll a
    // local edit made since that hydration back to the same server value the
    // user has already been shown once.
    restoreVerdict()
    return 'unchanged'
  }

  const merge = mergeServerGraphOnHydrate(result.graph)

  // ── A REFUSED MERGE IS NOT A MERGE, AND MUST NOT BE RECORDED AS ONE (L61) ──
  //
  // `mergeServerGraphOnHydrate` refuses on an unusable shape, an empty server
  // graph, and — the load-bearing one — zero node-id overlap with a non-empty
  // canvas. Every refusal used to return the same all-zero counts an idempotent
  // merge returns, this function discarded the return value entirely, and both
  // the identity token and the `'merged'` outcome were recorded unconditionally.
  //
  // Two things were wrong with that, and they are not equally severe:
  //
  //   1. THE OUTCOME WAS FALSE, always. This module exists so that every boot
  //      outcome INCLUDING THE REFUSALS is measurable without mounting React
  //      (see the header). A refusal reported as `'merged'` breaks exactly that,
  //      and `useServerGraphHydration` logs the false value as telemetry.
  //
  //   2. THE TOKEN IS A CLAIM THAT WE APPLIED THIS GRAPH, and it has a READER —
  //      the `isSameServerGraph` short-circuit above, which returns `'unchanged'`
  //      WITHOUT merging. The zero-overlap guard's verdict depends on the CANVAS,
  //      which moves; the token compares only the SERVER, which has not. So a
  //      refusal recorded as an application can suppress a later merge that
  //      would by then succeed. (Narrow today: the token is in-memory only, is
  //      cleared by `DECISION_CONTEXT_CLEAR`, and the hook attempts once per
  //      scenario id. The invariant is fixed here regardless of that wiring —
  //      a guarantee that depends on a caller's current shape is not one.)
  //
  // Gated on `accepted`, NEVER on `changed`: an idempotent boot — the server
  // matched the canvas — is the most common accepted case, and gating on
  // movement would turn it into a permanent re-merge.
  if (!merge.accepted) {
    logger.warn('server_graph_hydration.merge_refused', {
      scenarioId,
      reason: merge.refusedReason,
    })
    // ⚠ NOTHING is written to `analysisStateV1` here — and NOTHING is the
    // operative word, not `null`. Writing `null` would replace whatever belief
    // the user's session already holds with a claim of ignorance, which is a
    // second falsehood rather than the absence of the first
    // (`applyScenarioAnalysisRead.ts:402-405` makes the same distinction on the
    // decline side). The refusal simply does not touch this seam.
    return 'mergeRefused'
  }

  // THE ACCEPTED EXIT. The graph this verdict describes is now on the canvas,
  // so the verdict is a true statement about what the user is looking at.
  //
  // Deliberately AFTER the merge, which inverts the previous order and is the
  // half of this change that had to be re-measured rather than reasoned about:
  // `mergeServerGraphOnHydrate` fires #837's `markGraphStructurallyEdited`, so
  // that write now lands FIRST. The two remain disjoint — the mark writes
  // `graphEditedSinceLastRun` / `analysisStateReady` / `analysisFreshnessDirty`
  // and this writes `analysisStateV1` — and the disjointness is pinned in both
  // orders in `__tests__/bootAnalysisVerdictRestore.spec.ts`, which is what
  // makes that a measurement instead of this comment's opinion.
  restoreVerdict()

  // Store CEE's token VERBATIM — after the merge, so a throw could not leave a
  // token recorded for a graph that was never applied. `null` when CEE issued
  // none (an identity-empty graph), which never suppresses a later merge.
  useCanvasStore.getState().setServerGraphIdentity(
    result.identity
      ? {
          value: result.identity.value,
          projectionVersion: result.identity.projectionVersion,
        }
      : null,
  )

  return 'merged'
}
