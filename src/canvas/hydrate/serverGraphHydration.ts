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

import { recordAnalysisStaleReasonWords } from '../state/analysisStaleReasonWords'
import { recordCanonicalOpen } from './canonicalOpenOutcome'
import { recordBootReadAdmission } from './bootReadAdmission'
import { useCanvasStore } from '../store'
import { useContextIntegrityStore } from '../stores/contextIntegrityStore'
import { useServerConversationTurnsStore } from '../stores/serverConversationTurnsStore'
import { readServerConversationTurns } from '../conversation/serverConversationTurns'
import { useReloadDifferenceStore } from '../stores/reloadDifferenceStore'
import { declinedSavedRunKindOf, useDeclinedSavedRunStore } from '../stores/declinedSavedRunStore'
import { logger } from '../../lib/logger'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { mergeServerGraphOnHydrate } from '../utils/mergeServerGraph'
import { applyBootAnalysisVerdict, applyBootLeaderClaimWithholding, applyScenarioAnalysisRead, isBootRestorableRunState } from './applyScenarioAnalysisRead'
import { readProvisionalApplyStore } from './provisionalApplyStore'
import { adoptDeliveredRecord } from './deliveredGuidanceSink'
import { applyBootRunCurrency, applyBootBlockedVerdict, bootReadLimitVerdicts, bootReadRunFact } from './applyBootRunCurrency'
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
import { EdgeV3Schema } from '@talchain/schemas'
import { CANONICAL_GRAPH_HASH_NESTED_PROJECTION } from '@talchain/schemas/boundary'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

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
  /** The cold open only: ask the read for the stored chat (MG 5907618888, opt-in). */
  includeConversationTurns?: boolean
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

/** The canvas is `scenarioId`'s: the store is bound to it, or bound to nothing over an empty canvas. */
function canvasIsScenarioOrEmpty(scenarioId: string): boolean {
  const st = useCanvasStore.getState()
  const held = st.currentScenarioId ?? null
  return held === scenarioId || (held === null && st.nodes.length === 0 && st.edges.length === 0)
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
    ...(opts.includeConversationTurns === true ? { includeConversationTurns: true } : {}),
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

  // ⭐ ONE AUTHORITY FOR "DID THIS MODEL OPEN?" (`canonicalOpenOutcome.ts`): CEE's canonical read, bound by identity
  // AND by what the canvas then holds. Recorded at EACH exit below, never at the answer: a read can return this
  // scenario's graph and still leave another model on screen (the store moved, or the merge refused it over a
  // same-tab A→B switch), and 'opened' there would hide the notice while A is what the user sees.
  // 'opened' only when CEE served the SAME scenario_id it was asked for AND this exit leaves that model on the canvas.
  const servedId = result.status === 'graph' || result.status === 'absent' ? result.scenarioId : undefined
  const answerOpen = (onCanvas: boolean): void =>
    recordCanonicalOpen(scenarioId, onCanvas && servedId === scenarioId ? 'opened' : 'not_opened')

  // ── Every non-graph answer: leave the canvas alone, say why, surface nothing.
  if (result.status !== 'graph') {
    logger.debug('server_graph_hydration.no_merge', {
      scenarioId,
      outcome: result.status,
    })
    // A known scenario with no graph yet is open only when the canvas is ITS (bound to it, or empty and unbound).
    answerOpen(result.status === 'absent' && canvasIsScenarioOrEmpty(scenarioId))
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
    answerOpen(false)
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

  // ⭐ THE CHAT SURVIVES A RELOAD — offer the stored chat to the panel (it takes it only when empty with no local
  // transcript). The stale line keys on the SAME read verdict the held-Run drop uses, before any merge moves it.
  const serverTurns = readServerConversationTurns(result.conversationTurns)
  if (opts.includeConversationTurns === true || serverTurns !== null) {
    const runState = result.analysisState?.run_state
    const computedAt = runState != null && 'computed_at' in runState ? runState.computed_at : null
    useServerConversationTurnsStore.getState().offerServerConversationTurns({
      scenarioId,
      turns: result.scenarioId === scenarioId ? serverTurns ?? [] : (serverTurns ?? []).map(({ suggestedActions: _foreign, ...turn }) => turn),
      // Held actions belong to the response envelope, never merely to the request.
      heldProposalOffers: result.scenarioId === scenarioId ? result.heldProposalOffers : [],
      proposalFields: result.scenarioId === scenarioId ? result.proposalFields : undefined,
      run: {
        runNotCurrent: heldRunIsNotCurrentPerRead(result.analysisState, result.analysisResult),
        currentRunComputedAt: typeof computedAt === 'string' ? computedAt : null,
      },
    })
  }

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
      // RT-10 B′: the read's own reason sentence rides WITH its verdict (kept only while that verdict is complete_stale).
      store: { setAnalysisStateV1: (v) => { recordAnalysisStaleReasonWords(v, result.staleReasonWords); useCanvasStore.getState().setAnalysisStateV1(v) } },
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
  const restoreRunCurrency = (
    exit: 'unchanged' | 'merged',
    mergeChanged: boolean | null,
    dirtyBeforeMerge: boolean | null = null,
  ): void => {
    const st = useCanvasStore.getState()
    // BOTH directions: the canvas carries every value the read carries (the
    // acknowledgement's proof) AND the read carries nothing the canvas lacks.
    const notProvenEqual = whyCanvasNotProvenEqualToReadBothWays(scenarioId, result.graph)
    // ⭐ A RELOAD ONTO A RUN MADE ELSEWHERE KEEPS THAT RUN (P0 SHARED DATA, served UI `f29bc828`, scenario
    // `af640d3c`, DL #75 5921880401). A browser that last held Run A's model reloads after the model was edited and
    // re-run elsewhere (API, Agent, another device). The merge adopts Run B's model and marks it edited
    // (`mergeServerGraph.ts`, "ADOPTION INTO AN EMPTY BROWSER" covers only an empty canvas), and this leg read that
    // mark as a user edit: `edited_since_read` with `unproven: null`, so the panel said "No analysis has run yet".
    // The mark is the READ'S OWN change only when (1) it was clear before this merge, so no local edit made it, and
    // (2) the canvas is now proven equal to the read both ways. Then the read's Run describes the canvas on screen.
    // Anything else keeps today's decline: a local edit (mark set before the merge) or any unproven key.
    const markIsThisReadsOwn =
      dirtyBeforeMerge === false &&
      st.analysisFreshnessDirty === true &&
      notProvenEqual === null
    // ⭐ …and its MODE is kept beside it, under the same binding (`bootReadAdmission.ts`): recorded FIRST, so the
    // store change below already finds it. Any read that does not qualify clears it.
    const bootAdmits = result.admitted === true && notProvenEqual === null && typeof result.graphHash === 'string'
    recordBootReadAdmission(
      bootAdmits && result.permittedAnalysisMode
        ? { scenarioId, graphHash: result.graphHash as string, permittedAnalysisMode: result.permittedAnalysisMode }
        : null,
    )
    // The read's admission stands in for `may_run` until a turn speaks — only an
    // admission, only for this revision, only when the canvas IS that revision.
    st.setBootAdmittedRevision?.(
      result.admitted === true && notProvenEqual === null ? result.graphHash : null,
    )
    const currencyOutcome = applyBootRunCurrency({
      analysisState: result.analysisState,
      analysisResult: result.analysisResult,
      graphHash: result.graphHash,
      admitted: result.admitted,
      canvasProvenEqualToRead: notProvenEqual === null,
      store: {
        analysisFreshnessDirty: markIsThisReadsOwn ? false : st.analysisFreshnessDirty,
        setAnalysisStateV1: (v) => { recordAnalysisStaleReasonWords(v, result.staleReasonWords); st.setAnalysisStateV1(v) },
        setAnalysisFreshness: st.setAnalysisFreshness,
        readCurrentGraphHash: () => useCanvasStore.getState().analysisFreshness?.currentGraphHash,
      },
    })
    // A saved Run the proof below cannot confirm is RECORDED (never restored) so the run control does not say "first
    // pass" over it (`declinedSavedRunStore.ts`); a restored Run, or a read with no Run, clears any earlier record.
    const savedRunKind = declinedSavedRunKindOf(result.analysisState?.run_state.kind)
    if (currencyOutcome.outcome === 'restored' || savedRunKind === null) useDeclinedSavedRunStore.getState().clear()
    else useDeclinedSavedRunStore.getState().record({ scenarioId, runStateKind: savedRunKind, reason: currencyOutcome.reason })
    if (currencyOutcome.outcome === 'restored') {
      // R6: the restored result IS the run this verdict describes (the read ships its block only on
      // `complete_current`, stamped with the run's canonical hash), so it is not an orphan — see `bootReadRunFact`.
      const fact = bootReadRunFact({
        scenarioId,
        analysisResult: result.analysisResult,
        now: Date.now(),
      })
      if (fact !== null) {
        useCanvasStore.getState().setV5AnalysisFact(fact)
        // Under the SAME proof, the limit verdicts the read carries (see `bootReadLimitVerdicts`).
        const limits = bootReadLimitVerdicts({
          scenarioId,
          limitVerdicts: result.limitVerdicts,
          displayedResultsHash: useCanvasStore.getState().results?.hash,
        })
        if (limits !== null) useCanvasStore.getState().setLimitVerdicts(limits)
      }
      // ⭐ A FRESH BROWSER SEES THE STORED RUN (Shared Data closure row, Canonical #72 5889440955; measured by Canvas
      // 5889420398: the read carried `analysis_result` + `complete_current`, a new browser showed the pre-analysis state).
      // Under the SAME proof as the currency restore above, the READ's own block becomes the report — through the ONE read
      // applier the first pass uses, with its store view, so certainty and limits take the same validating readers and the
      // same dedupe: a same-browser reload of the held Run changes nothing; a Run another device made replaces it.
      const runRead = applyScenarioAnalysisRead({
        analysisState: result.analysisState,
        analysisResult: result.analysisResult,
        currentReadInputBasis: result.currentReadInputBasis ?? null,
        limitVerdicts: result.limitVerdicts,
        goalCertainty: result.goalCertainty,
        runDelta: result.runDelta,
        delivered: result.delivered,
        // ⭐ The Run's record of which options it left out (CEE #2432). Without it a fresh browser said "This run has no
        // result for this option" over an option the Run left out on purpose (Panel P2x, #75 5925282823).
        optionParticipation: result.optionParticipation,
        // The currency leg above is this read's ONE verdict writer (see `applyBootBlockedVerdict`: the legs never both
        // write `analysisStateV1` for one read), so the applier here builds the report and writes no verdict.
        // ⛔ NOR THE FRESHNESS (P0 5909616965 / AIQ 5909634999): the currency leg has just PROVEN this Run current and
        // written `fresh`; the applier's run-completion transition demoted it to `unknown · run_completed_without_verdict`
        // on every fresh-browser cold open, so `useRunCurrency()` stopped saying current and the Driver badges (every run
        // cue) vanished — while a same-browser reload, whose report dedupes, kept them.
        store: {
          ...readProvisionalApplyStore(), setAnalysisStateV1: () => {}, noteRunCompletedWithoutVerdict: () => {},
          // SD-1 Slice R (CEE #2654): ONLY this leg adopts what the Run's turn delivered — the canvas is proven equal to the
          // Run's graph both ways here, so the adopted items are minted over the right graph. The polling leg does not.
          adoptDeliveredRecord,
          setCurrentReadInputBasis: (basis, hash) => useCanvasStore.setState((state) => {
            if (state.currentScenarioId !== scenarioId || state.results.hash !== hash || !state.results.report) return state
            return { results: { ...state.results, report: { ...state.results.report, current_read_input_basis: basis } } }
          }),
        },
      })
      logger.debug('server_graph_hydration.boot_run_currency', { scenarioId, exit, outcome: 'restored', runFact: fact !== null, runRead: runRead.outcome })
      return
    }
    // A blocked model keeps CEE's named reason across a reload, under the SAME
    // proof (see `applyBootBlockedVerdict`). Runs only when currency declined, so
    // the two legs never both write `analysisStateV1` for one read.
    const blockedOutcome = applyBootBlockedVerdict({
      analysisState: result.analysisState,
      graphHash: result.graphHash,
      admitted: result.admitted,
      canvasProvenEqualToRead: notProvenEqual === null,
      isRestorableKind: isBootRestorableRunState,
      store: {
        analysisFreshnessDirty: useCanvasStore.getState().analysisFreshnessDirty,
        setAnalysisStateV1: (v) => { recordAnalysisStaleReasonWords(v, result.staleReasonWords); useCanvasStore.getState().setAnalysisStateV1(v) },
      },
    })
    logger.debug('server_graph_hydration.boot_blocked_verdict', {
      scenarioId,
      exit,
      outcome: blockedOutcome.outcome,
      detail: blockedOutcome.outcome === 'declined' ? blockedOutcome.reason : null,
    })
    // ⚠ WARN, NOT DEBUG: a declined restore is what the user sees as "Olumi
    // can't confirm this still matches your latest analysis" after a plain
    // reload, and PROD logs at `warn`. At debug the served decline was
    // invisible (R&C #69 5834151007). Console only; `logger` sends nothing off
    // the device. `unproven` names the first failing clause of the equality
    // proof, computed whatever the decline reason, so one served reload names
    // the exact element and key.
    logger.warn('server_graph_hydration.boot_run_currency_declined', {
      scenarioId,
      exit,
      reason: currencyOutcome.reason,
      unproven: notProvenEqual,
      dirty: useCanvasStore.getState().analysisFreshnessDirty === true,
      mergeChanged,
      runStateKind: result.analysisState?.run_state.kind ?? null,
      graphHash: result.graphHash,
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
  dropHeldRunTheReadSaysIsNotCurrent(scenarioId, result.analysisState, result.analysisResult)

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
    restoreRunCurrency('unchanged', null)
    answerOpen(true)
    return 'unchanged'
  }

  // Read BEFORE the merge, which sets it on any model change (see `restoreRunCurrency`).
  const dirtyBeforeMerge = useCanvasStore.getState().analysisFreshnessDirty === true
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
    answerOpen(false)
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
      canvasOnlyLinkLabels: merge.removedCanvasOnlyLinkLabels,
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
  restoreRunCurrency('merged', merge.changed, dirtyBeforeMerge)

  answerOpen(true)
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
 * Edge types are compared under the contract default on BOTH sides, exactly as
 * the currency proof compares them (`withContractEdgeDefaults`).
 */
/**
 * ⛔ THE SERVER'S "NOT CURRENT" OUTRANKS THE AUTOSAVED RUN (AIQ pre-share hold #75 5903405445; R3 5903397606; DL lease
 * 5903425676; P0 C2 5903423999).
 *
 * A same-browser reload after a newer Run restored Run 1 from `olumi-canvas-autosave`, and that held report made the
 * merge count as a local edit, so every verdict leg declined (`edited_since_read`, `closes_run_gate`): the panel said
 * "Cannot confirm whether this analysis is current" over a Run the server KNOWS is out of date, and re-described it
 * against today's option list ("3 of your 4 options … left out"). A fresh browser was right.
 *
 * So when the read says the held Run cannot be current (its kind is `complete_stale`, it asks for a rerun, or it ships
 * no result — the block rides only on a current Run), the held Run is dropped BEFORE the merge, and the boot proceeds
 * exactly as a fresh browser's does: same verdict, same "Model changed" surface, no Run-1 figures. A read that ships its
 * own result, or a verdict still running, leaves the held Run alone.
 */
export function heldRunIsNotCurrentPerRead(analysisState: AnalysisStateV1 | null, analysisResult: unknown): boolean {
  if (analysisState == null) return false
  // P0 C2 (5903423999): a newer degraded Run superseded the saved one — no block the read ships can be current.
  if ((analysisState as { contradictions?: unknown }).contradictions instanceof Array
    && ((analysisState as { contradictions: unknown[] }).contradictions).includes('fact_status_success_but_degraded_newer')) return true
  if (analysisResult != null) return false
  const kind = analysisState.run_state.kind
  // ⛔ NOT `complete_current` alone: a current read without a result block keeps the held Run (P0's 'no_result' decline
  // withholds currency; it is not evidence the Run is superseded). Dropping it cleared a no-edit reload (starterReload).
  return kind === 'complete_stale' || (analysisState as { requires_rerun?: unknown }).requires_rerun === true
}
function dropHeldRunTheReadSaysIsNotCurrent(scenarioId: string, analysisState: AnalysisStateV1 | null, analysisResult: unknown): void {
  const st = useCanvasStore.getState()
  if (st.results?.report == null && st.analysisFreshness == null) return
  if (!heldRunIsNotCurrentPerRead(analysisState, analysisResult)) return
  logger.warn('server_graph_hydration.held_run_dropped', { scenarioId, runStateKind: analysisState?.run_state.kind ?? null })
  st.resultsReset()
  useCanvasStore.setState({
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    graphEditedSinceLastRun: false,
    v5AnalysisFact: null,
    hasCompletedFirstRun: false,
  } as never)
}

function canvasProvenEqualToRead(scenarioId: string, wireGraph: unknown): boolean {
  return whyCanvasNotProvenEqualToRead(scenarioId, withContractEdgeDefaults(wireGraph), withContractEdgeDefaults) === null
}

/**
 * The same proof, answering WHICH clause failed: `null` when the canvas is
 * proven equal, else the first failing clause (and, for a value clause, the
 * element, key and a short excerpt of both sides). One body, so the reason a
 * decline reports can never disagree with the decision it explains.
 */
function whyCanvasNotProvenEqualToRead(
  scenarioId: string,
  wireGraph: unknown,
  normalise?: GraphNormaliser,
): string | null {
  const st = useCanvasStore.getState()
  if (st.currentScenarioId !== scenarioId) return 'scenario_not_current'
  if (st.importPendingServerRegistration === true) return 'import_pending_registration'
  const hold = editDeliveryHold(st as never)
  if (hold !== null) return `edit_delivery_hold:${hold}`
  return firstProjectedValueTheReadLacks(wireGraph, st.nodes as never, st.edges as never, normalise)
}

/**
 * A graph with the published contract's defaults applied, and nothing else.
 * `EdgeV3Schema` declares `edge_type: EdgeType.optional().default('directed')`,
 * so an edge that omits `edge_type` IS a directed edge by contract. The default
 * is read FROM the schema, never re-spelled.
 *
 * ⚠ APPLIED TO BOTH SIDES OF EVERY EQUALITY PROOF, AND ONLY THERE. The served
 * pricing read (`fixtures/pricing-provisional-poll.json`) omits `edge_type` on
 * all 15 edges, and since A1 (#2043) the canvas projection omits it too
 * (`buildRegistrationGraph` no longer mints 'directed', and the reload merge
 * strips a readback-minted one). Defaulting one side only made the reverse
 * check decline every reload of an analysed model on this one key
 * (`rev:edge:…:edge_type:canvas_lacks read="directed"`; review 5841802705
 * blocker 1). This function never touches the canvas, the registration wire
 * or the digest: an absent field stays absent everywhere a user can see it.
 */
function withContractEdgeDefaults(wireGraph: unknown): unknown {
  if (wireGraph === null || typeof wireGraph !== 'object') return wireGraph
  const g = wireGraph as { edges?: unknown }
  if (!Array.isArray(g.edges)) return wireGraph
  const edgeType = EdgeV3Schema.shape.edge_type
  return {
    ...(wireGraph as Record<string, unknown>),
    edges: g.edges.map((e) => {
      if (e === null || typeof e !== 'object') return e
      const parsed = edgeType.safeParse((e as { edge_type?: unknown }).edge_type)
      return parsed.success ? { ...(e as Record<string, unknown>), edge_type: parsed.data } : e
    }),
  }
}

/**
 * The currency restore's proof: the acknowledgement's proof, run on the read
 * with its contract defaults applied, AND the reverse direction. See
 * `applyBootRunCurrency.ts`.
 */
function whyCanvasNotProvenEqualToReadBothWays(scenarioId: string, wireGraph: unknown): string | null {
  const read = currencyComparable(wireGraph)
  return (
    whyCanvasNotProvenEqualToRead(scenarioId, read, currencyComparable) ??
    firstReadValueTheCanvasLacks(read, currencyComparable) ??
    firstGoalValueNotProvenEqual(read)
  )
}

/** The currency proof's view of EITHER graph: contract defaults, then the analysis-affecting projection. */
function currencyComparable(graph: unknown): unknown {
  return withoutNonAnalysisFields(withoutAbsentBaselineDefault(withContractEdgeDefaults(graph)))
}

/**
 * ⭐ R6, SERVED (UI c3f76e4f, `theServedReloadProvesTheResultCurrent.spec.tsx`): `is_baseline: false` IS AN
 * ABSENT `is_baseline`. The canvas projects `false` on every non-baseline option; CEE's read carries the key
 * only on the baseline. The engine reads the flag as `option.is_baseline === true` (`isBaselineOption`), so
 * the two graphs analyse identically, yet every reload of a model with a non-baseline option declined here
 * (`fwd:node:<option>:is_baseline:read_lacks canvas=false`) and the result read "Results may be outdated".
 * Applied to BOTH sides, and only to `false`: a `true` the other side lacks still declines.
 */
function withoutAbsentBaselineDefault(graph: unknown): unknown {
  if (graph === null || typeof graph !== 'object') return graph
  const g = graph as { nodes?: unknown }
  if (!Array.isArray(g.nodes)) return graph
  return {
    ...(graph as Record<string, unknown>),
    nodes: g.nodes.map((n) => {
      if (n === null || typeof n !== 'object' || (n as { is_baseline?: unknown }).is_baseline !== false) return n
      const { is_baseline: _absent, ...rest } = n as Record<string, unknown>
      return rest
    }),
  }
}

/**
 * ⭐ THE GOAL HALF OF CEE's PROJECTION, which the node and edge clauses never read.
 *
 * `computeAnalysisAffectingGraphHash` (`graph-hash.ts`, CEE staging `85ce874c`)
 * hashes the graph's top-level `goal_node_id` and `goal_constraints` beside its
 * nodes and edges. Both clauses above iterate `nodes` and `edges` only, so a read
 * whose stated limit differed from the canvas's still proved "equal", and the
 * reload restored a current Run card over a limit the user is not looking at.
 * SERVED SHAPE: Paul's manual test `1a298d6d` read back `graph.goal_constraints`
 * (one `monthly_churn <= 10` limit, keys reordered by JSONB) and no `goal_node_id`.
 *
 * ⚠ ASYMMETRIC ON PURPOSE. `store.goalConstraints` is `null` whenever the canvas
 * holds no list: every draft without a limit stores `null`, never `[]`
 * (`applyDraftResult`), and edits and readiness clears null it too. So `null`
 * cannot say "no limit", and a `null` canvas never declines. A NON-null list is
 * a statement, and it must equal the read's, where an absent read list is `[]`
 * exactly as CEE hashes it. Constraints are matched by `constraint_id ?? id`,
 * compared whole (CEE excludes no constraint field), and not by position: the
 * order of a list of limits changes no result.
 */
function firstGoalValueNotProvenEqual(wireGraph: unknown): string | null {
  if (wireGraph === null || typeof wireGraph !== 'object') return 'goal:read_not_a_graph'
  const g = wireGraph as { goal_node_id?: unknown; goal_constraints?: unknown }
  const st = useCanvasStore.getState()
  if (typeof g.goal_node_id === 'string') {
    const projected = buildRegistrationGraph(st.nodes as never, st.edges as never)
    if (!projected.ok) return 'goal:canvas_projection_failed'
    const goal = projected.graph.nodes.find((n) => String(n.id) === g.goal_node_id)
    if (goal === undefined || goal.kind !== 'goal') {
      return `goal:goal_node_id:${g.goal_node_id}:not_a_canvas_goal`
    }
  }
  const canvas = st.goalConstraints
  if (canvas == null) return null
  const read: unknown[] = Array.isArray(g.goal_constraints) ? g.goal_constraints : []
  if (read.length !== canvas.length) {
    return `goal:goal_constraints:count canvas=${canvas.length} read=${read.length}`
  }
  const readById = new Map<string, unknown>()
  for (const r of read) {
    const id = constraintIdentity(r)
    if (id === null) return 'goal:goal_constraints:read_constraint_has_no_identity'
    // A repeated id would let one entry shadow another (review 5843168236 N1).
    if (readById.has(id)) return `goal:goal_constraints:${id}:duplicate_identity_on_read`
    readById.set(id, r)
  }
  const canvasIds = new Set<string>()
  for (const c of canvas) {
    const id = constraintIdentity(c)
    if (id === null) return 'goal:goal_constraints:canvas_constraint_has_no_identity'
    if (canvasIds.has(id)) return `goal:goal_constraints:${id}:duplicate_identity_on_canvas`
    canvasIds.add(id)
    if (!readById.has(id)) return `goal:goal_constraints:${id}:absent_on_read`
    if (!sameValue(c, readById.get(id))) {
      return `goal:goal_constraints:${id}:differs canvas=${excerpt(c)} read=${excerpt(readById.get(id))}`
    }
  }
  return null
}

function constraintIdentity(value: unknown): string | null {
  if (value === null || typeof value !== 'object') return null
  const c = value as { constraint_id?: unknown; id?: unknown }
  const id = c.constraint_id ?? c.id
  return typeof id === 'string' && id !== '' ? id : null
}

/** Applied to BOTH graphs of a comparison, so the two are compared like for like. */
type GraphNormaliser = (graph: unknown) => unknown

/**
 * ⭐ WHAT THE CURRENCY PROOF MAY IGNORE: exactly what CEE's own
 * analysis-affecting projection ignores, and nothing else.
 *
 * The Run card's `graph_hash_at_generation`, the read's `graph_hash` and
 * `complete_current` are all statements in CEE's analysis-affecting hash space
 * (`graph-hash.ts` `computeAnalysisAffectingGraphHash`), whose header lists
 * these as "Excluded (cosmetic / provenance / display)". A difference in one of
 * them cannot make the verdict describe a different model, so it must not stop
 * the restore.
 *
 * THE SERVED DEFECT: a drafted canvas never carries CEE's edge `defaulted` flag
 * (9 of 18 edges on the served OpenAI pricing draft, `c673223` "C1 brief"), so
 * the reverse check declined every reload of a drafted model
 * (`bootRunCurrency.draftedCanvasReplay.spec.tsx`; R&C #69 5834151007).
 *
 * FAIL-CLOSED BY CONSTRUCTION: this is a list of EXCLUSIONS, never a whitelist.
 * Every key not named here is still compared, so a field CEE adds to its
 * projection later keeps blocking ("can't confirm") rather than passing a
 * "current" it cannot vouch for. Used by the currency proof ONLY: the
 * acknowledgement keeps its own strict comparison (its trade is the re-arm
 * write, a different question).
 */
const NOT_ANALYSIS_AFFECTING = {
  node: new Set(['description', 'display_value', 'provenance', 'provenance_display', 'origin']),
  observedState: new Set(['unit', 'source', 'raw_value', 'extractionType']),
  intervention: new Set(['unit', 'source', 'reasoning', 'value_confidence', 'display_value']),
  targetMatch: new Set(['match_type', 'confidence']),
} as const

function omitKeys(value: unknown, keys: ReadonlySet<string>): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (!keys.has(k)) out[k] = v
  return out
}

/**
 * ⚠ `unit` IS EXCLUDED ONLY WHERE CEE EXCLUDES IT. `projectIntervention`
 * (`graph-hash.ts:246-249`, CEE staging `85ce874c`) hashes `unit` whenever a
 * native `raw_value` sits beside it: 95,000 GBP and 95,000 USD are different
 * amounts to a limit check. Beside an encoded `value` alone it is metadata and
 * hashes to nothing, so only then may the proof ignore it.
 */
function withoutNonAnalysisIntervention(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
  const hasNative = (value as { raw_value?: unknown }).raw_value !== undefined
  const excluded = hasNative
    ? new Set([...NOT_ANALYSIS_AFFECTING.intervention].filter((k) => k !== 'unit'))
    : NOT_ANALYSIS_AFFECTING.intervention
  const stripped = omitKeys(value, excluded) as Record<string, unknown>
  if ('target_match' in stripped) {
    stripped.target_match = omitKeys(stripped.target_match, NOT_ANALYSIS_AFFECTING.targetMatch)
  }
  return stripped
}

function withoutNonAnalysisFields(graph: unknown): unknown {
  if (graph === null || typeof graph !== 'object') return graph
  const g = graph as { nodes?: unknown; edges?: unknown }
  const nodes = Array.isArray(g.nodes)
    ? g.nodes.map((n) => {
        if (n === null || typeof n !== 'object') return n
        const node = omitKeys(n, NOT_ANALYSIS_AFFECTING.node) as Record<string, unknown>
        if ('observed_state' in node) {
          node.observed_state = omitKeys(node.observed_state, NOT_ANALYSIS_AFFECTING.observedState)
        }
        const interventions = node.interventions
        if (interventions !== null && typeof interventions === 'object' && !Array.isArray(interventions)) {
          node.interventions = Object.fromEntries(
            Object.entries(interventions as Record<string, unknown>).map(([k, v]) => [k, withoutNonAnalysisIntervention(v)]),
          )
        }
        return node
      })
    : g.nodes
  const edges = Array.isArray(g.edges) ? g.edges.map(analysisAffectingEdge) : g.edges
  return { ...(graph as Record<string, unknown>), nodes, edges }
}

/**
 * ⭐ AN EDGE IS COMPARED ONLY ON THE PUBLISHED ANALYSIS-AFFECTING VOCABULARY (W4, X4; #70 5858906092).
 *
 * CEE's `graph_hash` — the space `complete_current` is asserted in — hashes an edge through a WHITELIST
 * (`graph-hash.ts projectEdge`), published as `CANONICAL_GRAPH_HASH_NESTED_PROJECTION.edge`. This proof used to strip
 * a hand-kept DENYLIST instead, so every metadata key CEE added declined every reload: CEE #2096's `exists_defaulted`
 * (set by a link-strength write on a defaulted edge) made the served reload say "can't confirm" (AIC n=2). The same
 * vocabulary, imported and never re-spelled, now bounds both sides; a hashed field still declines.
 * Nodes keep their denylist: the published node vocabulary lacks `nonlinear_identity`, which CEE does hash.
 */
const ANALYSIS_EDGE = CANONICAL_GRAPH_HASH_NESTED_PROJECTION.edge
function analysisAffectingEdge(edge: unknown): unknown {
  if (edge === null || typeof edge !== 'object' || Array.isArray(edge)) return edge
  const e = edge as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of ANALYSIS_EDGE.fields) if (e[k] !== undefined) out[k] = e[k]
  const strength = e.strength
  if (strength !== null && typeof strength === 'object' && !Array.isArray(strength)) {
    const s = strength as Record<string, unknown>
    const kept: Record<string, unknown> = {}
    for (const k of ANALYSIS_EDGE.strength_fields) if (s[k] !== undefined) kept[k] = s[k]
    out.strength = kept
  } else if (strength !== undefined) {
    out.strength = strength
  }
  return out
}

/**
 * Wire EDGE keys this COMPARISON skips (it decides nothing about what the
 * canvas holds), and why each cannot change what the analysis computes:
 * `origin`, `provenance` and `provenance_display` are authorship metadata. CEE's
 * analysis-affecting projection lists provenance under "Excluded (cosmetic /
 * provenance / display)" (`graph-hash.ts` `computeAnalysisAffectingGraphHash`).
 * Any other missing key fails the check.
 *
 * ⚠ `origin` IS CARRIED since #2108: draft, patch and register paths carry it,
 * and a reload ACQUIRES it (`mergeAppliedGraph.ts` `EDGE_ACQUIRED_METADATA_KEYS`).
 * It stays skipped here because it is not analysis-affecting and a canvas saved
 * before #2108 lacks it until that reload. (Measured before #2108 on the served
 * pricing read, `fixtures/pricing-provisional-poll.json`, these three were the
 * only wire keys the canvas projection did not carry.)
 */
const NOT_CARRIED_EDGE_KEYS: ReadonlySet<string> = new Set(['origin', 'provenance', 'provenance_display'])

/**
 * ⭐ THE REVERSE DIRECTION, used ONLY by the boot run-currency restore.
 *
 * `firstProjectedValueTheReadLacks` proves the canvas holds nothing CEE lacks.
 * It says nothing about a value CEE holds that the canvas does NOT, such as a
 * factor `observed_state` or an option intervention the canvas never received.
 * A "current" verdict about CEE's graph would then describe a model the user is
 * not looking at (independent pre-review on #2015). So currency also requires
 * that every key on every wire node (bar `NOT_VOUCHED_NODE_KEYS`) and every wire
 * edge (bar `NOT_CARRIED_EDGE_KEYS`) appears in the canvas projection,
 * deep-equal. Element sets are already equal under the forward check.
 *
 * ⚠ NOT added to the acknowledgement. There a stricter check would leave the
 * canvas unacknowledged, and the re-arm could then write the canvas (which
 * LACKS the value) into CEE. That is a different trade and out of this scope.
 */
function firstReadValueTheCanvasLacks(wireGraph: unknown, normalise?: GraphNormaliser): string | null {
  if (wireGraph === null || typeof wireGraph !== 'object') return 'rev:read_not_a_graph'
  const g = wireGraph as { nodes?: unknown; edges?: unknown }
  const st = useCanvasStore.getState()
  const projected = buildRegistrationGraph(st.nodes as never, st.edges as never)
  if (!projected.ok) return 'rev:canvas_projection_failed'
  const canvasGraph = (normalise ? normalise(projected.graph) : projected.graph) as typeof projected.graph
  const nodeById = new Map<string, Record<string, unknown>>()
  for (const n of canvasGraph.nodes) nodeById.set(String(n.id), n as unknown as Record<string, unknown>)
  const edgeByPair = new Map<string, Record<string, unknown>>()
  for (const e of canvasGraph.edges) {
    edgeByPair.set(edgePairKey(String(e.from), String(e.to)), e as unknown as Record<string, unknown>)
  }
  for (const w of Array.isArray(g.nodes) ? (g.nodes as unknown[]) : []) {
    if (w === null || typeof w !== 'object') return 'rev:node_not_an_object'
    const wire = w as Record<string, unknown>
    const node = nodeById.get(String(wire.id))
    if (node === undefined) return `rev:node:${String(wire.id)}:absent_on_canvas`
    for (const [key, value] of Object.entries(wire)) {
      if (NOT_VOUCHED_NODE_KEYS.has(key) || value === undefined) continue
      if (!(key in node)) return `rev:node:${String(wire.id)}:${key}:canvas_lacks read=${excerpt(value)}`
      if (!sameNodeValue(key, node[key], value)) {
        return `rev:node:${String(wire.id)}:${key}:differs canvas=${excerpt(node[key])} read=${excerpt(value)}`
      }
    }
  }
  for (const w of Array.isArray(g.edges) ? (g.edges as unknown[]) : []) {
    if (w === null || typeof w !== 'object') return 'rev:edge_not_an_object'
    const key = wireEdgePairKey(w as never)
    const edge = key === null ? undefined : edgeByPair.get(key)
    if (edge === undefined) return `rev:edge:${String(key)}:absent_on_canvas`
    for (const [k, value] of Object.entries(w as Record<string, unknown>)) {
      if (k === 'from' || k === 'to' || NOT_CARRIED_EDGE_KEYS.has(k) || value === undefined) continue
      if (!(k in edge)) return `rev:edge:${String(key)}:${k}:canvas_lacks read=${excerpt(value)}`
      if (!sameValue(edge[k], value)) {
        return `rev:edge:${String(key)}:${k}:differs canvas=${excerpt(edge[k])} read=${excerpt(value)}`
      }
    }
  }
  return null
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

/**
 * Does the read's graph carry every analytical value the canvas would send?
 * `null` when it does; otherwise the first element and key it does not carry.
 */
function firstProjectedValueTheReadLacks(
  wireGraph: unknown,
  nodes: Parameters<typeof buildRegistrationGraph>[0],
  edges: Parameters<typeof buildRegistrationGraph>[1],
  normalise?: GraphNormaliser,
): string | null {
  if (wireGraph === null || typeof wireGraph !== 'object') return 'fwd:read_not_a_graph'
  const g = wireGraph as { nodes?: unknown; edges?: unknown }
  const rawNodes = Array.isArray(g.nodes) ? (g.nodes as unknown[]) : []
  const rawEdges = Array.isArray(g.edges) ? (g.edges as unknown[]) : []

  const built = buildRegistrationGraph(nodes, edges)
  if (!built.ok) return 'fwd:canvas_projection_failed'
  const projected = { graph: (normalise ? normalise(built.graph) : built.graph) as typeof built.graph }

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
  if (projected.graph.nodes.length !== wireNodeById.size) {
    return `fwd:node_count canvas=${projected.graph.nodes.length} read=${wireNodeById.size}`
  }
  if (projected.graph.edges.length !== wireEdgeByPair.size) {
    return `fwd:edge_count canvas=${projected.graph.edges.length} read=${wireEdgeByPair.size}`
  }

  for (const node of projected.graph.nodes) {
    const wire = wireNodeById.get(String(node.id))
    if (wire === undefined) return `fwd:node:${String(node.id)}:absent_in_read`
    for (const [key, value] of Object.entries(node)) {
      if (NOT_VOUCHED_NODE_KEYS.has(key)) continue
      const wireValue = wireNodeValue(wire, key)
      if (wireValue === undefined) return `fwd:node:${String(node.id)}:${key}:read_lacks canvas=${excerpt(value)}`
      if (!sameNodeValue(key, value, wireValue)) {
        return `fwd:node:${String(node.id)}:${key}:differs canvas=${excerpt(value)} read=${excerpt(wireValue)}`
      }
    }
  }
  for (const edge of projected.graph.edges) {
    const pair = edgePairKey(String(edge.from), String(edge.to))
    const wire = wireEdgeByPair.get(pair)
    if (wire === undefined) return `fwd:edge:${pair}:absent_in_read`
    for (const [key, value] of Object.entries(edge)) {
      if (key === 'from' || key === 'to') continue
      const wireValue = wire[key]
      if (wireValue === undefined) return `fwd:edge:${pair}:${key}:read_lacks canvas=${excerpt(value)}`
      if (!sameValue(value, wireValue)) {
        return `fwd:edge:${pair}:${key}:differs canvas=${excerpt(value)} read=${excerpt(wireValue)}`
      }
    }
  }
  return null
}

/** A short, console-only excerpt of a value for a decline reason. */
function excerpt(value: unknown): string {
  let text: string
  try {
    text = canonicalJson(value) ?? String(value)
  } catch {
    text = String(value)
  }
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}
