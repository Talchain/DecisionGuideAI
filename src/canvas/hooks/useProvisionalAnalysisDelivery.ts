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
  readonly signal: AbortSignal
  readonly getStore: () => ScenarioAnalysisApplyStore
  readonly read: typeof fetchScenarioGraph
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>
  readonly delays?: readonly number[]
}): Promise<ProvisionalDeliveryOutcome> {
  const delays = deps.delays ?? PROVISIONAL_DELIVERY_DELAYS_MS
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
      store: deps.getStore(),
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
    // `notYet` — the H4 path. NOTHING was written; keep waiting.
  }
  // H3: the bound expired. Write nothing; leave CEE's verdict standing.
  logger.debug('provisional_analysis_delivery.deadline', {
    scenarioId: deps.scenarioId,
    deadlineMs: PROVISIONAL_DELIVERY_DEADLINE_MS,
  })
  return 'deadline'
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

    void runProvisionalDeliverySchedule({
      scenarioId,
      userId,
      signal: controller.signal,
      // Read the store LAZILY, per attempt: the dedupe compares against
      // `currentResultsHash` as it is when the answer arrives, not as it was
      // when the wait was armed a minute earlier.
      getStore: () => useCanvasStore.getState() as unknown as ScenarioAnalysisApplyStore,
      read: fetchScenarioGraph,
      wait: waitFor,
    }).then((outcome) => {
      settled = true
      logger.debug('provisional_analysis_delivery.outcome', { scenarioId, outcome })
    })

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
