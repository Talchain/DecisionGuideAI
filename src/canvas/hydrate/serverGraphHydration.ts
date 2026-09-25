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
import { useReloadDifferenceStore } from '../stores/reloadDifferenceStore'
import { logger } from '../../lib/logger'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { mergeServerGraphOnHydrate } from '../utils/mergeServerGraph'
import { applyBootAnalysisVerdict, applyBootLeaderClaimWithholding } from './applyScenarioAnalysisRead'
import { applyBootRunCurrency } from './applyBootRunCurrency'
import {
  beginBootGraphRead,
  isCeeAddressableScenarioId,
  isCurrentBootGraphRead,
  settleBootGraphRead,
} from './bootGraphRead'
import { markGraphServerAcknowledged } from '../store/importRegistrationMarker'
import { editDeliveryHold } from '../registration/editDeliveryHold'
import { buildRegistrationGraph } from '../registration/buildRegistrationGraph'
import { edgePairKey, wireEdgePairKey } from '../utils/graphIdentity'
import { canonicalJson } from '../../lib/canonical-hash'

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
  /**
   * CEE refused the caller's TOKEN (401 `sign_in_required`). Canvas untouched.
   * Distinct from `'refused'` because the recovery differs: signing in fixes
   * this and retrying cannot. Kept separate so a caller cannot accidentally
   * render "try again" over a session that has expired.
   */
  | 'signInRequired'
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
  /** Optional in-session ownership fence, checked after the read, before any write. */
  canApply?: () => boolean
  /**
   * The token the CALLER got from `beginBootGraphRead` for this read. The boot
   * hook marks the read synchronously, before its identity await, so the
   * re-arm evaluated in the same commit waits (`bootGraphRead.ts`); it passes
   * that token here so this function settles the caller's mark instead of
   * beginning a second one. Omitted (the absent-retry schedule, draft recovery,
   * direct calls) → this function begins and settles its own.
   */
  bootReadToken?: number
}

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
 * ⭐⭐ ADOPT THE SERVER'S WRITE PRECONDITION FOR THE GRAPH WE JUST APPLIED.
 *
 * A manual edit is a compare-and-set: the server refuses unless
 * `computeAnalysisAffectingGraphHash(persistedGraph)` equals the base the client
 * sent. That base used to reach the client ONLY through `applyV5State`, from a
 * turn's top-level `graph_hash` — and a RELOAD runs no turn. So a restored
 * session held no base and every FIRST edit was refused as `needs_fresh_base`:
 * witnessed natively on 2026-09-09 with the editor open, Cancel correctly silent
 * and Save honestly sending nothing. The refusal was right; the missing
 * precondition was the defect, and "ask the assistant something first" is not a
 * capability.
 *
 * ⚠ CALLED ONLY FROM THE ACCEPTED EXITS, so the existing gates hold without
 * adding any: an invalid scenario id, an aborted read, a non-graph result and a
 * REFUSED merge all return earlier. A base is adopted only when the graph it
 * describes is the graph on screen.
 *
 * ⚠⚠ AND THAT WAS NOT ENOUGH — a review found the schedule those gates do not
 * cover, and my own "superseded" control could not see it because the control
 * supplied the very predicate that made it skip. THE REAL BOOT CALLER PASSES NO
 * `canApply`, only auth and an abort signal, and that signal tracks scenario,
 * auth and unmount — NOT a same-scenario turn that lands while a read is in
 * flight. So: start read A, a genuine turn installs hB through `applyV5State`,
 * then A arrives and its hA replaces hB. The next manual edit would send the
 * SUPERSEDED precondition and earn a stale refusal from the writer.
 *
 * Worse silently: a turn does not touch `serverGraphIdentity`, so with a cached
 * identity the UNCHANGED branch keeps the displayed graph correct while
 * downgrading only the base — nothing visible moves.
 *
 * So adoption is a COMPARE-AND-SET against the base as it stood when this read
 * was ISSUED. If anything moved it since — a turn, or another read — that other
 * authority is newer and keeps it. This is a narrow ordering rule over one
 * field, not a sequencing framework: it needs no clock, no generation counter
 * and no knowledge of what the other writer was.
 *
 * ⚠ IT IS THE SERVER'S VALUE, CARRIED — never computed here. The client has no
 * authority on this hash and could not agree with the writer even by accident on
 * a graph that had moved. Nor is it `identity`: that answers a different
 * question over a different projection, and on an UNCHANGED graph a substitution
 * would still match, failing only once someone edited.
 *
 * ⚠ ABSENT STAYS FAIL-CLOSED, and the store enforces it rather than this
 * function promising it: `setLastServerGraphHash` early-returns on anything that
 * is not a non-empty string, so a CEE that predates the field leaves the session
 * exactly as it was — refusing the edit and saying so.
 */
function adoptServerWriteBase(graphHash: string | null, baseAtDispatch: string | null): void {
  if (graphHash === null) return
  // The store's setter already refuses to CLEAR, but it will happily accept any
  // later non-empty value — including an older one. The ordering rule has to
  // live here, at the only caller that can know when its own read was issued.
  if (useCanvasStore.getState().lastServerGraphHash !== baseAtDispatch) return
  useCanvasStore.getState().setLastServerGraphHash(graphHash)
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
  // A scenario id CEE can address is a UUID (`isCeeAddressableScenarioId`, the
  // one definition the re-arm gate reads too); anything else is a local draft
  // id and would spend a request to earn a guaranteed refusal.
  if (!isCeeAddressableScenarioId(scenarioId)) {
    return 'skipped'
  }
  // ⭐ THE READ'S ANSWER IS AN INPUT TO THE RELOAD RE-ARM (`bootGraphRead.ts`).
  // Marked BEFORE the first await, so a re-arm evaluated while this read is in
  // flight waits for it instead of writing the page's own copy over CEE's —
  // unless the caller already marked it and handed us its token. Settled under
  // that token only: a read the caller has since superseded changes nothing.
  const token = opts.bootReadToken ?? beginBootGraphRead(scenarioId)
  let outcome: HydrationOutcome = 'skipped'
  try {
    outcome = await readAndMergeServerGraph(scenarioId, token, opts)
    return outcome
  } finally {
    settleBootGraphRead(scenarioId, token, outcome)
  }
}

async function readAndMergeServerGraph(
  scenarioId: string,
  token: number,
  opts: HydrateFromServerOptions,
): Promise<HydrationOutcome> {

  // ⭐ THE BASE AS IT STANDS NOW, READ BEFORE THE AWAIT. `adoptServerWriteBase`
  // compares against it so a slow read cannot overwrite a newer authority —
  // see that function for the schedule this closes.
  const baseAtDispatch = useCanvasStore.getState().lastServerGraphHash
  const result = await fetchScenarioGraph(scenarioId, {
    userId: opts.userId,
    accessToken: opts.accessToken,
    signal: opts.signal,
    retryDelayMs: opts.retryDelayMs,
    timeoutMs: opts.timeoutMs,
  })

  // A response body can finish after fetch was aborted. Check at the write
  // boundary too, including caller-specific turn/canvas ownership.
  if (opts.signal?.aborted || opts.canApply?.() === false) return 'skipped'

  // ── A SUPERSEDED READ CHANGES NOTHING ────────────────────────────────────
  // The token this read began under must still be the scenario's CURRENT one
  // (`bootGraphRead.ts`). A registration CEE acknowledged while this read was in
  // flight writes a NEW token, and so does a newer read: either way this answer
  // predates, or at best races, what CEE now holds. The settle already refuses
  // it; the WRITES below must refuse it too. Probed (23 Sep): CEE acknowledged
  // [goal, kept, "Churn Risk"], this read then answered with the older model,
  // and decision A's merge took "Churn Risk" off the canvas, named it in the chat
  // line and reset `lastAuthoritativeGraph` to the older set. So: no merge, no
  // removal notice, no identity, no write base, no acknowledgement, no verdict —
  // nothing. Everything below is synchronous, so this one check at the answer
  // covers every write it guards.
  if (!isCurrentBootGraphRead(scenarioId, token)) {
    logger.debug('server_graph_hydration.superseded', { scenarioId })
    return 'skipped'
  }

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
      case 'signInRequired':
        return 'signInRequired'
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

    // ── W1-e (c) — THE WITHHOLDING SURVIVES THE RELOAD ──────────────────────
    //
    // A SECOND QUESTION UNDER THE SAME READ, and the restore above answers only
    // the first. `applyBootAnalysisVerdict` declines every kind but
    // `complete_stale`, correctly — but the witnessed refusal arrives as
    // `refused`, so its decline took the leader PERMISSION down with the run
    // state and the unsafe designation came back on every reload (staging
    // `113375a1`, drive 3, 4 Sep 2026: "did not run" 0 occurrences, "Leading
    // option" 1).
    //
    // The withholding is MONOTONE — nothing the merge below does can turn a
    // refusal into a permission — so it passes the same test the restorable set
    // is chosen by, under every kind. It is WITHHOLD-ONLY: it can subtract a
    // claim and can never grant one. See its own header for the full argument.
    //
    // ⚠ CALLED FROM THE SAME PLACE, so there is ONE placement rule to reason
    // about rather than two. That rule is ACCEPTANCE, not position: both exits
    // that represent an accepted graph, and neither refusal — a suppression is
    // still a write, and a verdict about a graph the user does not have must
    // not act on the one they do.
    const withholdingOutcome = applyBootLeaderClaimWithholding({
      analysisState: result.analysisState,
      store: {
        resultsWithholdLeaderClaim: useCanvasStore.getState().resultsWithholdLeaderClaim,
      },
    })
    logger.debug('server_graph_hydration.boot_leader_claim', {
      scenarioId,
      outcome: withholdingOutcome.outcome,
      detail: withholdingOutcome.reason,
    })
  }

  // ── FIX 2 — A RELOAD WITH NOTHING CHANGED KEEPS A CURRENT RUN CURRENT ──────
  //
  // `restoreVerdict` above still declines `complete_current`, and every reason
  // it gives stands for the verdict ALONE. This leg restores it only WITH the
  // proof that decline says is missing — the canvas carries exactly the values
  // this read carries — and binds it to the read's own `graph_hash`, so the Run
  // card can tell it is still current. Called at the SAME two accepted exits,
  // AFTER the merge (whose model-change mark it reads) and the base adoption.
  // See `applyBootRunCurrency.ts` for the derivation.
  const restoreRunCurrency = (): void => {
    const st = useCanvasStore.getState()
    const currencyOutcome = applyBootRunCurrency({
      analysisState: result.analysisState,
      graphHash: result.graphHash,
      canvasProvenEqualToRead: canvasProvenEqualToRead(scenarioId, result.graph),
      store: {
        analysisFreshnessDirty: st.analysisFreshnessDirty,
        setAnalysisStateV1: st.setAnalysisStateV1,
        setAnalysisFreshness: st.setAnalysisFreshness,
        readCurrentGraphHash: () => useCanvasStore.getState().analysisFreshness?.currentGraphHash,
      },
    })
    logger.debug('server_graph_hydration.boot_run_currency', {
      scenarioId,
      outcome: currencyOutcome.outcome,
      detail: currencyOutcome.outcome === 'declined' ? currencyOutcome.reason : 'complete_current',
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
    // ⭐ THE UNCHANGED CASE ADOPTS TOO, and it is the one a reload actually
    // takes. "The server has not moved" means the canvas already holds exactly
    // the graph this response describes — so its write base is true of what the
    // user is looking at. Skipping here would leave the ordinary restore with no
    // base, which is the whole defect.
    adoptServerWriteBase(result.graphHash, baseAtDispatch)
    restoreRunCurrency()
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
    // (`applyScenarioAnalysisRead.ts`'s "AFTER THE DIVERGENCE GUARDS" note makes
    // the same distinction on the
    // decline side). The refusal simply does not touch this seam.
    return 'mergeRefused'
  }

  // ⭐ RELOAD SHOWS THE SAVED MODEL — the accepted merge took elements off the
  // canvas because the saved model lacks them (`mergeServerGraph.ts` header).
  // Removing visible work without a word is its own defect, so record what went
  // for the conversation's one lasting line (`reloadDifferenceStore`). Keyed by
  // the scenario the read came back for; an accepted merge that removed nothing
  // records nothing.
  if (merge.removedNodeCount > 0 || merge.removedEdgeCount > 0) {
    useReloadDifferenceStore.getState().recordRemoval({
      scenarioId,
      removedLabels: merge.removedLabels,
    })
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

  adoptServerWriteBase(result.graphHash, baseAtDispatch)
  acknowledgeCanvasThatMatchesTheRead(scenarioId, result.graph)
  restoreRunCurrency()

  return 'merged'
}

/**
 * ⭐ A READ THAT CARRIES THE CANVAS IS AN ACKNOWLEDGEMENT — the re-arm's own
 * design case, without its write.
 *
 * The reload re-arm existed for one situation: the acknowledgement record was
 * lost (eviction, cleared storage), so a model CEE already holds sat HELD with
 * nothing pending, and a redundant registration was the way out. When the read
 * PROVES CEE holds exactly what the canvas would send, that redundant write is
 * unnecessary, so the read records the acknowledgement instead.
 *
 * ⚠ WHAT "PROVES" MEANS (review B3 at `b072db1a`). Equal element sets are NOT
 *   enough, and an earlier version of this comment claimed the merge had "just
 *   written CEE's values onto every shared element". It had not: `overlayNode`
 *   KEEPS a canvas key the wire omits ("a value CEE genuinely cleared stays on
 *   the canvas"), and `overlayEdge` skips keys the wire leaves at the mapper
 *   default. The acknowledgement digest is the canvas's WHOLE registration
 *   projection (`importRegistrationMarker.ts` `analyticalDigest`), so marking it
 *   on set-equality attested values CEE did not hold — e.g. a factor's
 *   `observed_state {value: 0.7}` CEE had no value for, or an edge
 *   `exists_probability` CEE lacked — and released Run over them.
 *
 *   So the read acknowledges ONLY when, for every node and edge of
 *   `buildRegistrationGraph(canvas)` — the projection the digest is taken over —
 *   the corresponding wire element (nodes by id, edges by from/to pair) carries
 *   EVERY analytical key the projection carries, present and deep-equal
 *   (`canonicalJson`: key order is not part of a value). Anything else fails
 *   CLOSED: no acknowledgement, the model stays held, and the re-arm may offer
 *   it again (`bootGraphRead.ts` subset rule), never a wall.
 *
 * ⚠ THAT RE-OFFER IS NOT ALWAYS REDUNDANT (Panel V1, #1903 5797312829). The
 *   subset rule checks ELEMENTS, not values. `overlayNode` keeps a canvas key
 *   the wire omits, so a reloaded canvas can hold a value CEE has none for
 *   (e.g. a factor's `observed_state {value: 0.7}` where CEE's factor has no
 *   `observed_state`). The acknowledgement correctly declines, and the re-offer
 *   then WRITES that value into CEE. Measured: `{merged, acked: false,
 *   registrations: 1, observed_state 0.7 sent}`; control with CEE holding 0.4:
 *   `{merged, acked: true, registrations: 0}`. So this PR guarantees a reload
 *   never RESURRECTS A DELETE, not that it never writes a value CEE lacks.
 *   Not a regression: staging's re-arm registered any unacknowledged copy.
 *   Closing it (clear the omitted analytical keys on an accepted read) needs the
 *   owner of `overlayNode`'s no-clear ruling; the one-writer contract (#63
 *   5794896612) removes the re-arm write altogether.
 *
 * Also not granted when the canvas holds an element the wire lacks (or vice
 * versa) — the stale copy the gate stops writing — nor while an edit is still
 * between the user and CEE (`editDeliveryHold`), nor for a canvas not bound to
 * the scenario that was read.
 */
function acknowledgeCanvasThatMatchesTheRead(scenarioId: string, wireGraph: unknown): void {
  if (!canvasProvenEqualToRead(scenarioId, wireGraph)) return
  const st = useCanvasStore.getState()
  markGraphServerAcknowledged(scenarioId, st.nodes as never, st.edges as never)
}

/**
 * THE PROOF, stated once: the canvas bound to `scenarioId` holds exactly what
 * this read carries, with no edit between the user and CEE. The acknowledgement
 * above and the boot run-currency restore both ask this, so it has ONE body.
 * An unregistered import is never proven equal: the server has seen none of it.
 */
function canvasProvenEqualToRead(scenarioId: string, wireGraph: unknown): boolean {
  const st = useCanvasStore.getState()
  if (st.currentScenarioId !== scenarioId) return false
  if (st.importPendingServerRegistration === true) return false
  if (editDeliveryHold(st as never) !== null) return false
  return readCarriesEveryProjectedValue(wireGraph, st.nodes as never, st.edges as never)
}

/**
 * Projected node keys a read neither can nor needs to vouch for — the ONLY
 * exclusions, each because it is not part of the model CEE analyses:
 *   · `starterId`, `starterTitle` — `applyStarter`'s canvas-side stamp
 *     (`loadStarter.ts` `stampStarterProvenance`: "a canvas-side annotation,
 *     not a change to the captured model");
 *   · `templateId`, `templateName` — `insertBlueprint`'s equivalent stamp
 *     (`useBlueprintInsert.ts`);
 *   · `provenance` — authorship metadata. CEE's own analysis-affecting
 *     projection lists it under "Excluded (cosmetic / provenance / display)"
 *     (`graph-hash.ts` `computeAnalysisAffectingGraphHash`, CEE staging
 *     `cc7b26cb`).
 * Every other projected key — `label` and `kind` included — must match. A key
 * missing from this list costs a re-offered registration (see the V1 note
 * above: not always redundant), never a false acknowledgement, which is the
 * direction this list is allowed to be wrong in.
 */
const NOT_VOUCHED_NODE_KEYS: ReadonlySet<string> = new Set([
  'starterId',
  'starterTitle',
  'templateId',
  'templateName',
  'provenance',
])

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return canonicalJson(a) === canonicalJson(b)
  } catch {
    return false
  }
}

/**
 * The wire node's value for a projected key. One key is DERIVED rather than
 * carried: `interventionKeys` is the index `mapDraftNodeToCanvas` computes from
 * the node's own `interventions`, so a wire node vouches for it through the
 * map it indexes (order-insensitive, as the digest's `normaliseInterventionKeys`
 * treats it). A wire node with no `interventions` object vouches for none.
 */
function wireNodeValue(wire: Record<string, unknown>, key: string): unknown {
  if (key !== 'interventionKeys' || wire.interventionKeys !== undefined) return wire[key]
  const interventions = wire.interventions
  if (interventions === null || typeof interventions !== 'object' || Array.isArray(interventions)) {
    return undefined
  }
  return Object.keys(interventions as Record<string, unknown>)
}

function sameNodeValue(key: string, projected: unknown, wire: unknown): boolean {
  if (key === 'interventionKeys' && Array.isArray(projected) && Array.isArray(wire)) {
    return sameValue([...projected].map(String).sort(), [...wire].map(String).sort())
  }
  return sameValue(projected, wire)
}

/** Does the read's graph carry every analytical value the canvas would send? */
function readCarriesEveryProjectedValue(
  wireGraph: unknown,
  nodes: Parameters<typeof buildRegistrationGraph>[0],
  edges: Parameters<typeof buildRegistrationGraph>[1],
): boolean {
  if (wireGraph === null || typeof wireGraph !== 'object') return false
  const g = wireGraph as { nodes?: unknown; edges?: unknown }
  const rawNodes = Array.isArray(g.nodes) ? (g.nodes as unknown[]) : []
  const rawEdges = Array.isArray(g.edges) ? (g.edges as unknown[]) : []

  const projected = buildRegistrationGraph(nodes, edges)
  if (!projected.ok) return false

  // Same indexing rule as the merge: first occurrence wins.
  const wireNodeById = new Map<string, Record<string, unknown>>()
  for (const n of rawNodes) {
    if (n === null || typeof n !== 'object') continue
    const id = (n as { id?: unknown }).id
    if (typeof id === 'string' && !wireNodeById.has(id)) wireNodeById.set(id, n as Record<string, unknown>)
  }
  const wireEdgeByPair = new Map<string, Record<string, unknown>>()
  for (const e of rawEdges) {
    if (e === null || typeof e !== 'object') continue
    const key = wireEdgePairKey(e as never)
    if (key !== null && !wireEdgeByPair.has(key)) wireEdgeByPair.set(key, e as Record<string, unknown>)
  }

  // EXACTLY the same elements: nothing the canvas holds that CEE lacks, and
  // nothing CEE holds that the canvas lacks (the merge adds CEE's elements, so
  // a gap here means it declined one — e.g. a dangling edge).
  if (projected.graph.nodes.length !== wireNodeById.size) return false
  if (projected.graph.edges.length !== wireEdgeByPair.size) return false

  for (const node of projected.graph.nodes) {
    const wire = wireNodeById.get(String(node.id))
    if (wire === undefined) return false
    for (const [key, value] of Object.entries(node)) {
      if (NOT_VOUCHED_NODE_KEYS.has(key)) continue
      const wireValue = wireNodeValue(wire, key)
      if (wireValue === undefined || !sameNodeValue(key, value, wireValue)) return false
    }
  }
  for (const edge of projected.graph.edges) {
    const wire = wireEdgeByPair.get(edgePairKey(String(edge.from), String(edge.to)))
    if (wire === undefined) return false
    for (const [key, value] of Object.entries(edge)) {
      if (key === 'from' || key === 'to') continue
      const wireValue = wire[key]
      if (wireValue === undefined || !sameValue(value, wireValue)) return false
    }
  }
  return true
}
