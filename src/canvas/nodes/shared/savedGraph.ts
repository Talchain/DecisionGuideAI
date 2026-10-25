/**
 * The saved graph as the graph route returns it (with its living model), for display readers on the core lane: the goal
 * card's other aims and the links the engine leaves out. ONE read per saved-graph change, shared by every reader (keyed by
 * scenario, saved hash and each applied turn or acknowledgement), never another scenario's. Display only.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { isOpenAiLane, resolveAiComparisonMode } from '../../../v5/aiComparisonMode'
import { isCeeAddressableScenarioId } from '../../hydrate/bootGraphRead'
import { useCanvasStore } from '../../store'
import { savedGraphEpoch, subscribeSavedGraphEpoch } from './savedGraphEpoch'

let last: { key: string; read: Promise<unknown> } | null = null
/** The saved graph IS the one on screen: same scenario, same saved hash (one may be the other's 16-hex prefix). */
const sameHash = (a: string | null, b: string): boolean => a !== null && (a === b || a.startsWith(b) || b.startsWith(a))
function readOnce(key: string, scenarioId: string, graphHash: string): Promise<unknown> {
  if (last?.key !== key) {
    const read = (async () => {
      // The auth client is loaded with the read, never with this module: a display reader (the stage ladder, every tab)
      // must not initialise auth just by being imported (Codex r1 on #2979).
      const identity = await import('../../../lib/supabase').then((m) => m.getSessionIdentity()).catch(() => ({ userId: null, accessToken: null }))
      const result = await fetchScenarioGraph(scenarioId, { userId: identity.userId, accessToken: identity.accessToken })
      // Codex R1: another scenario's or another save's graph is never shown under this key.
      if (result.status !== 'graph' || result.scenarioId !== scenarioId || !sameHash(result.graphHash, graphHash)) return null
      // The read's own `withheld` list rides on the graph it describes (`livingModelCanvas.ts` reads it); none, as read.
      return result.withheld != null && result.graph !== null && typeof result.graph === 'object'
        ? { ...(result.graph as Record<string, unknown>), withheld: result.withheld } : result.graph
    })().catch(() => null)
    const entry = { key, read }
    last = entry
    // A failed or mismatched read is not kept: the next mount reads again (Codex R1).
    void read.then((graph) => { if (graph === null && last === entry) last = null })
  }
  return last.read
}

/**
 * The saved-graph read for the board on screen, with what `useSavedGraph`'s null cannot tell apart: `none` (no read
 * applies: off the core lane, or no saved scenario and hash yet), `pending` (this key's read has not answered), `failed`
 * (it answered with no graph of this scenario and hash) or `read`.
 */
export type SavedGraphRead =
  | { readonly status: 'none' | 'pending' | 'failed' }
  | { readonly status: 'read'; readonly graph: unknown }

export function useSavedGraphRead(): SavedGraphRead {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  // A living-model-only write leaves the analysis hash as it was; each applied turn or acknowledgement reads again.
  const epoch = useSyncExternalStore(subscribeSavedGraphEpoch, savedGraphEpoch)
  const key = `${scenarioId ?? ''}:${graphHash ?? ''}:${epoch}`
  const [read, setRead] = useState<{ key: string; graph: unknown } | null>(null)
  // CEE serves the core lane under the default `openai` mode too (`laneModeFor`): reading only on `?ai=core` left every
  // living-model reader dark on the default path. A legacy graph carries no living model, so its readers show nothing.
  const applies = isOpenAiLane(resolveAiComparisonMode()) && isCeeAddressableScenarioId(scenarioId) && graphHash !== null
  useEffect(() => {
    if (!applies || !isCeeAddressableScenarioId(scenarioId) || graphHash === null) return
    let live = true
    void readOnce(key, scenarioId, graphHash).then((graph) => { if (live) setRead({ key, graph }) })
    return () => { live = false }
  }, [applies, scenarioId, graphHash, key])
  if (!applies) return { status: 'none' }
  if (read?.key !== key) return { status: 'pending' }
  return read.graph === null ? { status: 'failed' } : { status: 'read', graph: read.graph }
}

/** The saved graph for the scenario and saved hash on screen now; null until that read answers (or off the core lane). */
export function useSavedGraph(): unknown {
  const read = useSavedGraphRead()
  return read.status === 'read' ? read.graph : null
}
