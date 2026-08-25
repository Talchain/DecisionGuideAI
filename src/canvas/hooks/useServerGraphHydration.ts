/**
 * useServerGraphHydration — mounts the boot-time server-graph merge.
 *
 * ROADMAP 2.312 piece 3. All of the behaviour lives in
 * `hydrate/serverGraphHydration.ts`; this hook is only the trigger, so the
 * outcomes stay measurable without React.
 *
 * ORDERING. The canvas restores from the localStorage autosave inside
 * `ReactFlowGraph`'s init effect, which also sets `currentScenarioId` from the
 * autosave's own stamp. React runs child effects before parent effects, and
 * `ReactFlowGraph` is a child of the route that calls this hook — so by the
 * time this fires the local canvas is already on screen and the scenario id is
 * in hand. That order is what makes the merge a merge: the server's values are
 * overlaid onto real local nodes carrying real local positions, rather than
 * racing an empty store.
 *
 * ONCE PER SCENARIO. Keyed on the scenario id, not on mount, so a route change
 * A→B hydrates B while a re-render of A does not re-request. An in-flight read
 * is aborted when the id changes: the answer would describe the previous
 * scenario, and `hydrateCanvasFromServer` refuses it anyway.
 *
 * ⚠ "ONCE PER SCENARIO" HAD A MEASURED COST, AND IT IS WHY THE RE-ASK BELOW
 * EXISTS. The server write-back completes 30–90s AFTER the model first appears
 * on screen, so a guest who returns inside that window got `graph_present:false`
 * — and because the read fired exactly once, the canvas stayed empty FOR THE
 * LIFE OF THE PAGE while their model sat intact on the server (journey-witnessed
 * 2026-08-25, 5 trials, build `55807813`; a plain reload recovered it every
 * time). `absent` is the ONE outcome that is a "not yet" rather than an answer,
 * so it — and only it — arms a bounded re-ask. Every other outcome, the 404
 * included, still fires exactly once and behaves byte-identically to before.
 * See `hydrate/absentGraphRetry.ts` for the schedule and the allow-list.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useAuth } from '../../contexts/AuthContext'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import {
  runAbsentGraphRetrySchedule,
  waitForRetry,
} from '../hydrate/absentGraphRetry'
import { useServerGraphRetryStore } from '../stores/serverGraphRetryStore'
import { logger } from '../../lib/logger'
import { getSessionIdentity } from '../../lib/supabase'

export function useServerGraphHydration(scenarioIdFromRoute?: string | null): void {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const { user } = useAuth()

  // The store id is the general source — it is what the guest boot path sets
  // from the autosave, and guest is the tier that actually ships. The route
  // param is the fallback for a deep link that has not reached the store yet.
  const scenarioId = currentScenarioId ?? scenarioIdFromRoute ?? null

  const attemptedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!scenarioId) return
    if (attemptedRef.current === scenarioId) return
    attemptedRef.current = scenarioId

    const controller = new AbortController()
    let settled = false

    // Any stage from a previous scenario stops describing this one the moment
    // we begin. Cleared here rather than on unmount so a route change A→B never
    // leaves B looking at A's notice even for a frame.
    useServerGraphRetryStore.getState().clear()

    // Fire-and-forget by design: hydration is an improvement on what is already
    // on screen, never a precondition for it. `hydrateCanvasFromServer` never
    // rejects, so the canvas cannot be left mid-boot by a failure here.
    // ⚠ IDENTITY IS READ AT REQUEST TIME, NEVER CAPTURED AT RENDER TIME.
    // `useAuth()` stays the effect's DEPENDENCY (re-hydrate when the signed-in
    // user changes), but it must not be the source of the value we send: an
    // access token ROTATES, so a token captured in a render can already be
    // expired when this fire-and-forget effect's request goes out. And it is
    // the same accessor the turn path uses (`useConversation` →
    // `getSessionIdentity` → `buildTurnAuthHeaders`), so there is exactly one
    // way to turn a session into identity in this codebase.
    void (async (): Promise<void> => {
      try {
        const identity = await getSessionIdentity()

        const outcome = await hydrateCanvasFromServer(scenarioId, {
          userId: identity.userId,
          accessToken: identity.accessToken,
          signal: controller.signal,
        })
        logger.debug('server_graph_hydration.outcome', { scenarioId, outcome })

        // ── THE RETURNING-GUEST WINDOW ────────────────────────────────────
        // `absent` alone means "exists, no graph YET". Everything else is a
        // settled answer and returns here unchanged, having cost exactly one
        // request — which is what keeps the 404 path byte-identical.
        if (outcome !== 'absent') return

        const retry = await runAbsentGraphRetrySchedule({
          scenarioId,
          userId: identity.userId,
          accessToken: identity.accessToken,
          signal: controller.signal,
          hydrate: hydrateCanvasFromServer,
          wait: waitForRetry,
          // The stage is keyed by scenario, so a late write cannot describe a
          // decision the user has since left (`serverGraphRetryStore` header).
          onStage: (stage) =>
            useServerGraphRetryStore.getState().setRetryStage({ scenarioId, stage }),
        })

        // A graph arrived, or the scenario turned out to be something other
        // than "not written back yet". Either way there is nothing to say, so
        // retract whatever the schedule put up. `exhausted` is deliberately NOT
        // cleared — that stage IS the honest terminal message.
        //
        // ⚠ GATED ON THIS EFFECT STILL OWNING THE CANVAS. Without the abort
        // check this is a RACE, and StrictMode's dev double-mount hits it every
        // time: effect 1 is torn down, its schedule returns `'aborted'`, and its
        // clear would wipe the `'retrying'` stage EFFECT 2 had already armed —
        // leaving a re-asking canvas with no notice at all. The replacement
        // effect clears on entry, so an aborted chain has nothing to tidy.
        if (!controller.signal.aborted && retry !== 'exhausted') {
          useServerGraphRetryStore.getState().clear()
        }

        logger.debug('server_graph_hydration.absent_retry', { scenarioId, retry })
      } finally {
        settled = true
      }
    })()

    return () => {
      controller.abort()
      // ⚠ AN ABORTED ATTEMPT IS NOT AN ATTEMPT (review A6). React StrictMode
      // mounts every effect twice in dev: the first run set the ref and was
      // then torn down and aborted, and the second run early-returned on that
      // same ref — so hydration NEVER ran in development. Production was
      // unaffected, which is the trap: any manual dev check would have observed
      // "no hydration" and drawn exactly the wrong conclusion about shipped
      // code. Releasing the ref when the attempt did not settle makes the dev
      // and prod paths agree, and costs nothing in prod, where this cleanup
      // only fires on a dependency change (which must re-hydrate anyway) or on
      // unmount (where there is nothing left to guard).
      if (!settled) attemptedRef.current = null
    }
  }, [scenarioId, user?.id])
}
