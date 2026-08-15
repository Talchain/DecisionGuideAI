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
 */

import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store'
import { useDraftStore } from '../stores/draftStore'
import { useAuth } from '../../contexts/AuthContext'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { registerEdgeStrengthAuthorityRefresher } from '../edge-strength/edgeStrengthCoordinator'
import { logger } from '../../lib/logger'

export function useServerGraphHydration(scenarioIdFromRoute?: string | null): void {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const fullDraftAppliedAt = useDraftStore((s) => s.fullDraftAppliedAt)
  const { user } = useAuth()

  // The store id is the general source — it is what the guest boot path sets
  // from the autosave, and guest is the tier that actually ships. The route
  // param is the fallback for a deep link that has not reached the store yet.
  const scenarioId = currentScenarioId ?? scenarioIdFromRoute ?? null

  const attemptedRef = useRef<string | null>(null)
  const [postDraftRead, setPostDraftRead] = useState<{
    attemptKey: string
    scenarioId: string
    userId: string | null
    draftMarkerAtReadStart: number | null
    phase: 'waiting_for_draft' | 'ready'
  } | null>(null)

  useEffect(() => registerEdgeStrengthAuthorityRefresher(async (requestedScenarioId, refreshOpts) => {
    const outcome = await hydrateCanvasFromServer(requestedScenarioId, {
      userId: user?.id ?? null,
      replaceLocalGraph: refreshOpts?.replaceLocalGraph,
    })
    return outcome === 'merged' || outcome === 'unchanged'
  }), [user?.id])

  useEffect(() => {
    if (!scenarioId) return
    // A guest refusal is not a completed authenticated attempt. Include auth
    // identity in the key so signing in retries the same scenario instead of
    // leaving canonical Run permanently stranded on the guest outcome.
    const attemptKey = `${scenarioId}:${user?.id ?? 'guest'}`
    if (attemptedRef.current === attemptKey) return
    attemptedRef.current = attemptKey
    setPostDraftRead((current) => current?.attemptKey === attemptKey ? current : null)

    const controller = new AbortController()
    let settled = false
    const draftMarkerAtReadStart = useDraftStore.getState().fullDraftAppliedAt

    // Fire-and-forget for rendering: the restored canvas can paint immediately.
    // Canonical Run is independently held by the edge-strength hydration lane
    // until this strict authority read settles. `hydrateCanvasFromServer` never
    // rejects, so the canvas cannot be left mid-boot by a failure here.
    void hydrateCanvasFromServer(scenarioId, {
      userId: user?.id ?? null,
      signal: controller.signal,
    }).then((outcome) => {
      settled = true
      logger.debug('server_graph_hydration.outcome', { scenarioId, outcome })
      if (attemptedRef.current !== attemptKey) return
      if (outcome === 'absent') {
        // A brand-new scenario can be strictly read before its first draft turn
        // commits. Absence is authoritative only for that instant. Arm one
        // post-commit read; every refusal/failure outcome remains terminal and
        // is deliberately NOT converted into a retry loop.
        setPostDraftRead({
          attemptKey,
          scenarioId,
          userId: user?.id ?? null,
          draftMarkerAtReadStart,
          phase: 'waiting_for_draft',
        })
      } else {
        setPostDraftRead((current) => current?.attemptKey === attemptKey ? null : current)
      }
    })

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
      if (!settled && attemptedRef.current === attemptKey) attemptedRef.current = null
    }
  }, [scenarioId, user?.id])

  // Convert the first committed draft marker after an honest `absent` read
  // into exactly one strict authority read. This separate phase transition is
  // intentional: the request effect below does not depend on the marker, so a
  // second draft completion cannot abort/restart an in-flight reconciliation.
  useEffect(() => {
    if (
      !postDraftRead ||
      postDraftRead.phase !== 'waiting_for_draft' ||
      postDraftRead.attemptKey !== `${scenarioId}:${user?.id ?? 'guest'}` ||
      fullDraftAppliedAt === null ||
      fullDraftAppliedAt === postDraftRead.draftMarkerAtReadStart
    ) return
    setPostDraftRead({ ...postDraftRead, phase: 'ready' })
  }, [fullDraftAppliedAt, postDraftRead, scenarioId, user?.id])

  useEffect(() => {
    if (!postDraftRead || postDraftRead.phase !== 'ready') return
    const controller = new AbortController()
    let settled = false
    const { attemptKey, scenarioId: retryScenarioId, userId } = postDraftRead

    void hydrateCanvasFromServer(retryScenarioId, {
      userId,
      signal: controller.signal,
    }).then((outcome) => {
      settled = true
      // React StrictMode tears down and replays effects. The aborted rehearsal
      // must not consume the one post-draft entitlement or clear the live
      // replay's request state.
      if (controller.signal.aborted) return
      logger.debug('server_graph_hydration.post_draft_outcome', {
        scenarioId: retryScenarioId,
        outcome,
      })
      setPostDraftRead((current) => current?.attemptKey === attemptKey ? null : current)
    })

    return () => {
      if (!settled) controller.abort()
    }
  }, [postDraftRead])
}
