/**
 * useProvisionalAnalysisDelivery — deliver the auto-run's provisional analysis
 * WITHOUT another turn. ROADMAP 2.1271.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GAP THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 * A fresh admissible draft makes CEE schedule a provisional analysis (#999). Its
 * dispatch commits roughly twenty seconds AFTER the draft SSE stream's terminal
 * COMPLETE frame has closed the socket — the frame is terminal by design and no
 * branch can hold it open. So the result was computed, persisted, and never
 * arrived: the user saw it only if they happened to send another message.
 *
 * Paul's ruling (2026-08-17): server calculation and automatic client delivery
 * are ONE capability, and the capability is not done until the result appears
 * without another turn. This hook is that delivery.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT ARMS IT — the draft turn's own honest signal, not a timer
 * ═══════════════════════════════════════════════════════════════════════════
 * CEE now emits `analysis_state.run_state = { kind: 'running', started_at }` on
 * a draft that actually scheduled a run, resolved from the SAME admission
 * predicate that gates the scheduler. So this hook waits only when the server
 * has said a run exists, and it re-arms on `started_at` IDENTITY — a second
 * draft's run is a different run and gets its own bounded wait, while a
 * re-render of the same one does not restart the schedule.
 *
 * It deliberately does NOT arm on "a draft just finished". That would poll on
 * every draft, including the inadmissible ones where CEE runs nothing, and it
 * would be a second answer to a question the server already answers.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A BOUNDED SCHEDULE AND NOT A TIGHT LOOP
 * ═══════════════════════════════════════════════════════════════════════════
 * The run is ~20s, so the useful window is short and the answer is not worth
 * chasing at high frequency. The read route's limiter is keyed PER CLIENT IP —
 * not per key — and the same bucket serves boot hydration and the in-session
 * draft recovery, so a tight poll spends a budget other paths need. Derived at
 * CEE's tip: the `read` tier is 90 rpm (`cee/config/limits.ts:47-50`), and the
 * schedule below spends 7 reads over 60s.
 *
 * The delays are front-loaded around the expected commit and then spread, so the
 * common case resolves in one or two reads and the tail costs almost nothing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ H3 — ON DEADLINE IT INVENTS NOTHING
 * ═══════════════════════════════════════════════════════════════════════════
 * A `running` claim can outlive its run: the dispatch can throw (contained by
 * design), the already-analysed guard can skip it, a process can restart. So the
 * wait is bounded — and when the bound expires this hook STOPS and writes
 * NOTHING. It does not synthesise `unknown_degraded`, or any other verdict:
 * those are the producer's words, not the client's. CEE's last verdict stands,
 * and the manual Run affordance is untouched throughout (it is gated on the
 * LOCAL results status, never on the wire verdict), so the user always retains
 * the action.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ H4 — IT MUST NOT USE `applyV5State`
 * ═══════════════════════════════════════════════════════════════════════════
 * The turn applier CLEARS `analysis_state` on absence and would overwrite a
 * standing `running` with a read's `never_run` — flipping the product from "an
 * analysis is running" to "no analysis has ever been run" WHILE ONE IS RUNNING,
 * on the very first read. Every write here goes through
 * `hydrate/applyScenarioAnalysisRead.ts`, which applies a read's verdict only on
 * a TERMINAL kind. See that file's header for the full argument and for the
 * per-kind derivation.
 *
 * It also never touches the graph: `hydrate/serverGraphHydration.ts` remains the
 * one graph-ingestion authority.
 */

import { useEffect, useRef } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { useCanvasStore } from '../store'
import {
  applyScenarioAnalysisRead,
  type ScenarioAnalysisApplyStore,
} from '../hydrate/applyScenarioAnalysisRead'

/**
 * Delays from arming, in ms. Front-loaded around the ~20s commit, then spread.
 * Exported so the spec asserts the SCHEDULE rather than restating it (trap 12),
 * and so the budget claim in the header is checkable.
 */
export const PROVISIONAL_DELIVERY_DELAYS_MS: readonly number[] = [
  8_000, 14_000, 20_000, 27_000, 36_000, 47_000, 60_000,
]

/** The bound. Past this the hook stops and writes nothing (H3). */
export const PROVISIONAL_DELIVERY_DEADLINE_MS =
  PROVISIONAL_DELIVERY_DELAYS_MS[PROVISIONAL_DELIVERY_DELAYS_MS.length - 1]

export type ProvisionalDeliveryOutcome =
  | 'delivered'
  | 'already_held'
  /**
   * A terminal verdict arrived and was WITHHELD because it does not describe
   * the graph on screen. Settles the schedule: divergence is a property of the
   * canvas, not of the answer's timing, so re-reading cannot change it.
   *
   * ⚠ SILENT TODAY, AND KNOWINGLY SO. Four of the five outcomes here are
   * already `logger.debug` with no UI state, and the missing delivery receipt
   * is a known, separately-rowed gap. This adds one case to an existing silence
   * rather than creating a new silent-failure class — the distinction that
   * separates a strict improvement from trap 23. Telling the user their canvas
   * and the analysed model have diverged is the right answer and is rowed with
   * the receipt, because either alone leaves the other half silent.
   */
  | 'withheld'
  | 'deadline'
  | 'aborted'
  | 'unreadable'

/**
 * The testable core: run the bounded schedule once for one armed run. Never
 * throws; every exit is an outcome. Extracted from the effect so the schedule,
 * the H4 guard and the deadline are provable without React.
 */
export async function runProvisionalDeliverySchedule(deps: {
  readonly scenarioId: string
  readonly userId: string | null
  /**
   * Supabase access token, travelling the SAME route as `userId` and read from
   * the SAME session object. Required, not optional: this schedule re-enters
   * the scenario-graph read, so a caller that forgot the token would silently
   * make every re-ask anonymous. The compiler is the guard.
   */
  readonly accessToken: string | null
  readonly signal: AbortSignal
  /**
   * The applier's store view, read LAZILY per attempt.
   *
   * ⚠ OPTIONAL, AND THE DEFAULT IS THE POINT. When this was a required
   * parameter the hook supplied its own inline expression, so PRODUCTION's
   * store view had no test anywhere: every spec injected a substitute, and the
   * one shape that shipped was the one nothing exercised. That is how the
   * `currentResultsHash` defect survived a full mutant kit.
   *
   * Defaulting it means production has exactly ONE store view, tests can still
   * inject, and `runProvisionalDeliverySchedule` called WITHOUT this parameter
   * exercises the real thing — which is what
   * `useProvisionalAnalysisDelivery.realStoreBinding.spec.ts` asserts.
   */
  readonly getStore?: () => ScenarioAnalysisApplyStore
  readonly read: typeof fetchScenarioGraph
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>
  readonly delays?: readonly number[]
}): Promise<ProvisionalDeliveryOutcome> {
  const delays = deps.delays ?? PROVISIONAL_DELIVERY_DELAYS_MS
  const getStore = deps.getStore ?? readProvisionalApplyStore
  let previous = 0
  for (const at of delays) {
    try {
      await deps.wait(at - previous, deps.signal)
    } catch {
      return 'aborted'
    }
    previous = at
    if (deps.signal.aborted) return 'aborted'

    const result = await deps.read(deps.scenarioId, {
      userId: deps.userId ?? undefined,
      accessToken: deps.accessToken,
      signal: deps.signal,
    })
    if (deps.signal.aborted) return 'aborted'

    // Only a `graph` result can carry the analysis keys. Every other status is
    // "could not read", and `hydrateCanvasFromServer`'s own contract already
    // establishes that none of them may touch local state — a 404 here means
    // NOT READABLE, never deletion. So we keep waiting rather than concluding.
    if (result.status !== 'graph') {
      logger.debug('provisional_analysis_delivery.read_not_usable', {
        scenarioId: deps.scenarioId,
        status: result.status,
      })
      continue
    }

    const outcome = applyScenarioAnalysisRead({
      analysisState: result.analysisState,
      analysisResult: result.analysisResult,
      store: getStore(),
    })
    if (outcome.outcome === 'applied') {
      logger.debug('provisional_analysis_delivery.delivered', {
        scenarioId: deps.scenarioId,
        kind: outcome.kind,
        resultsHydrated: outcome.resultsHydrated,
      })
      return 'delivered'
    }
    if (outcome.outcome === 'alreadyHeld') return 'already_held'
    if (outcome.outcome === 'declined') {
      // The REASON is logged, never collapsed: the two harms must stay
      // distinguishable in telemetry or the next reader sees one rule.
      logger.debug('provisional_analysis_delivery.withheld', {
        scenarioId: deps.scenarioId,
        kind: outcome.kind,
        reason: outcome.reason,
      })
      return 'withheld'
    }
    // `notYet` — the H4 path. NOTHING was written; keep waiting.
  }
  // H3: the bound expired. Write nothing; leave CEE's verdict standing.
  logger.debug('provisional_analysis_delivery.deadline', {
    scenarioId: deps.scenarioId,
    deadlineMs: PROVISIONAL_DELIVERY_DEADLINE_MS,
  })
  return 'deadline'
}

/**
 * The applier's view of the LIVE canvas store.
 *
 * ⚠⚠ THIS FUNCTION EXISTS BECAUSE THE OBVIOUS ONE-LINER WAS DEAD IN PRODUCTION.
 * It was `useCanvasStore.getState() as unknown as ScenarioAnalysisApplyStore`,
 * and the double cast switched typechecking OFF across a shape that does not
 * match: the canvas store carries the results hash at `results.hash`, NOT at
 * the top level, and all three members of `ScenarioAnalysisApplyStore` are
 * optional — so `currentResultsHash` silently resolved to `undefined`, the
 * dedupe compared a string hash against `null`, and `alreadyHeld` was
 * UNREACHABLE. The turn path has always spliced the value in for exactly this
 * reason (`conversation/useConversation.ts:4783`).
 *
 * Two deliberate choices, both load-bearing:
 *
 *  1. NO CAST. The members are named explicitly and the return type is checked,
 *     so a drift in either store action's signature REDs `tsc` instead of
 *     passing silently. A cast here is what hid the defect for a whole PR.
 *  2. NO SPREAD. `...getState()` handed the applier the ENTIRE canvas store,
 *     including the graph slices that `applyScenarioAnalysisRead`'s own header
 *     says belong to `serverGraphHydration`. Naming three members keeps that
 *     boundary real rather than documented.
 *
 * Exported so its binding to the REAL store is provable — a spec that builds
 * its own store literal can only ever confirm the author's model of the store,
 * which is precisely how this shipped.
 */
export function readProvisionalApplyStore(): ScenarioAnalysisApplyStore {
  const s = useCanvasStore.getState()
  return {
    setAnalysisStateV1: s.setAnalysisStateV1,
    resultsComplete: s.resultsComplete,
    // Named explicitly, like every member here — NOT spread. A drift in this
    // action's signature must RED `tsc` rather than resolve to `undefined` and
    // silently restore the very defect this binding was added to close.
    noteRunCompletedWithoutVerdict: s.noteRunCompletedWithoutVerdict,
    currentResultsHash: s.results?.hash ?? null,
    // ── Does the canvas on screen derive from a server graph we ACCEPTED? ──
    //
    // Read STRAIGHT FROM THE STORE here rather than threaded down from the
    // hydration path: this leg is structurally blind to acceptance, so it needs
    // the signal either way, and a store read keeps the change inside this file
    // instead of reaching into `serverGraphHydration`'s options.
    //
    // `lastAuthoritativeGraph` — NOT `serverGraphIdentity`. The latter is null
    // BOTH when nothing was accepted AND when an accepted merge carried no CEE
    // token, so it would decline on an honest canvas.
    //
    // ⚠⚠ BUT THIS FIELD IS NOT AN ACCEPTANCE FLAG, AND AN EARLIER VERSION OF
    // THIS COMMENT SAID IT WAS. It claimed acceptance is "defined structurally"
    // so the two "cannot drift apart". That is true of `mergeServerGraph` — the
    // accepted path is exactly the body that records — and FALSE OF THE FIELD,
    // which has THREE recorders and a seed. Derived at the bytes:
    //
    //   RECORDERS (non-null):
    //   `mergeServerGraph.ts:412`    accepted server merge  ← the ONLY genuine
    //                                server acceptance
    //   `mergeAppliedGraph.ts:606`   applied-edit receipt
    //   `applyDraftResult.ts:292`    a fresh DRAFT. ⚠ NOT "the local canvas CEE
    //                                has never seen" — an earlier version of this
    //                                comment said that and it is FALSE at the
    //                                bytes: `nodes`/`edges` are mapped from
    //                                `draftData` (`:209`,`:212`) and applied as a
    //                                wholesale replacement, so at the instant of
    //                                recording the canvas IS CEE's own draft. The
    //                                accurate distinction is narrower and still
    //                                decisive: CEE DRAFTED it, but never ACCEPTED
    //                                it as this scenario's authoritative SERVER
    //                                graph. A draft still defeats the guard.
    //   `store.ts:6084`              COLD-LOAD SEED, property-assignment form
    //
    //   NULLERS (all fail-safe — they can only make the guard MORE cautious):
    //   `store.ts:1439`              scenario reset
    //   `store.ts:1999`              initial state
    //   `useConversation.ts:502`     nulled, and NOT on un-acceptance
    //
    // **A MERGE REFUSAL DOES NOT CLEAR IT.** So once any recorder has fired,
    // this reads `true` and the guards below do not fire — reachable mid-session
    // via draft → `recoverDraftFromServer` → refused merge → armed run.
    //
    // The field answers "which element identities may the reconciler remove?"
    // (`mergeAppliedGraph.ts:474-477`: fresh draft, prior receipt, OR DB
    // hydration — three sources, which is what I misread as one). This guard
    // asks "does the canvas derive from a server-accepted graph?" Two questions,
    // one name — trap 21, and I wrote the fused version.
    //
    // WHAT IT STILL BUYS: it is a genuine NECESSARY condition. `false` proves
    // divergence, and every case it catches is caught correctly. It is not
    // SUFFICIENT, so the guard is incomplete over its own defect class — pinned
    // as KNOWN-OPEN in
    // `hydrate/__tests__/provisionalDelivery.graphAcceptance.reachability.spec.ts`
    // rather than left to this comment. Closing it needs new state meaning
    // "derives from a server-accepted graph"; that is rowed, not done here.
    //
    // ⚠ AN EMPTY CANVAS IS NOT DIVERGENT. There is no local graph for a verdict
    // to misdescribe, and this is the case the zero-overlap guard itself calls
    // "the whole point of the feature" — it hydrates in full. Treating it as
    // divergent would withhold the verdict on a fresh scenario, which is the
    // over-fix that closes the lie by opening a gap.
    graphAcceptedForCanvas: s.lastAuthoritativeGraph !== null || s.nodes.length === 0,
  }
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return signal.aborted ? Promise.reject(new Error('aborted')) : Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Mount alongside `useServerGraphHydration`. Does nothing until CEE reports a
 * run in flight for the current scenario.
 */
export function useProvisionalAnalysisDelivery(scenarioIdFromRoute?: string | null): void {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const analysisState = useCanvasStore((s) => s.analysisStateV1)
  const { user } = useAuth()

  const scenarioId = currentScenarioId ?? scenarioIdFromRoute ?? null
  // The RUN's identity, not the verdict's. `started_at` changes per run, so a
  // second draft re-arms and a re-render does not.
  const runKey =
    analysisState !== null &&
    analysisState !== undefined &&
    analysisState.run_state.kind === 'running'
      ? `${scenarioId ?? ''}:${analysisState.run_state.started_at}`
      : null

  const armedRef = useRef<string | null>(null)
  const userId = user?.id ?? null

  useEffect(() => {
    if (scenarioId === null || runKey === null) return
    if (armedRef.current === runKey) return
    armedRef.current = runKey

    const controller = new AbortController()
    let settled = false

    // ⚠ IDENTITY READ AT REQUEST TIME, BOTH FIELDS FROM ONE SESSION OBJECT.
    // `useAuth()` stays the effect DEPENDENCY (re-arm when the signed-in user
    // changes) but is not what is sent: it is React state, populated
    // asynchronously and defaulting to the literal 'guest', and an access
    // token rotates. This schedule is armed on a run and fires up to its whole
    // delay ladder later, so the gap between the render that captured a user id
    // and the request that carries it is one of the widest in the app.
    void (async (): Promise<void> => {
      const identity = await getSessionIdentity()
      const outcome = await runProvisionalDeliverySchedule({
        scenarioId,
        userId: identity.userId,
        accessToken: identity.accessToken,
        signal: controller.signal,
        read: fetchScenarioGraph,
        wait: waitFor,
      })
      settled = true
      logger.debug('provisional_analysis_delivery.outcome', { scenarioId, outcome })
    })()

    return () => {
      controller.abort()
      // ⚠ AN ABORTED ATTEMPT IS NOT AN ATTEMPT — the StrictMode double-mount
      // lesson from `useServerGraphHydration.ts:61-72`, which made hydration
      // never run in development while production was fine. Releasing the ref
      // when the schedule did not settle keeps dev and prod in agreement.
      if (!settled) armedRef.current = null
    }
  }, [scenarioId, runKey, userId])
}
