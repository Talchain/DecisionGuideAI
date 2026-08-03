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

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useAuth } from '../../contexts/AuthContext'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { logger } from '../../lib/logger'

export function useServerGraphHydration(scenarioIdFromRoute?: string | null): void {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const { user } = useAuth()

  // The store id is the general source — it is what the guest boot path sets
  // from the autosave, and guest is the tier that actually ships. The route
  // param is the fallback for a deep link that has not reached the store yet.
  const scenarioId = currentScenarioId ?? scenarioIdFromRoute ?? null

  const hydratedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!scenarioId) return
    if (hydratedRef.current === scenarioId) return
    hydratedRef.current = scenarioId

    const controller = new AbortController()

    // Fire-and-forget by design: hydration is an improvement on what is already
    // on screen, never a precondition for it. `hydrateCanvasFromServer` never
    // rejects, so the canvas cannot be left mid-boot by a failure here.
    void hydrateCanvasFromServer(scenarioId, {
      userId: user?.id ?? null,
      signal: controller.signal,
    }).then((outcome) => {
      logger.debug('server_graph_hydration.outcome', { scenarioId, outcome })
    })

    return () => controller.abort()
  }, [scenarioId, user?.id])
}
