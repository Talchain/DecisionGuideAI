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

/** The one read in flight or answered; `graph` once it has answered (`savedGraphNow`). */
type SavedGraphRead = { key: string; read: Promise<unknown>; graph?: unknown }
let last: SavedGraphRead | null = null
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
    const entry: SavedGraphRead = { key, read }
    last = entry
    // A failed or mismatched read is not kept: the next mount reads again (Codex R1).
    void read.then((graph) => { if (graph === null && last === entry) last = null })
    // The answer, kept on this read only while it is still the current one: a late read for an old key never wins.
    void read.then((graph) => { if (last === entry) entry.graph = graph })
  }
  return last.read
}

/**
 * The saved graph on screen now, for code outside React (the send boundary): the answered read for the scenario, saved hash
 * and epoch `useSavedGraph` keys it by; null before that read answers, or for any other key. Pure: it starts no read and
 * subscribes to nothing.
 */
export function savedGraphNow(): unknown {
  const { currentScenarioId, lastServerGraphHash } = useCanvasStore.getState()
  const key = `${currentScenarioId ?? ''}:${lastServerGraphHash ?? ''}:${savedGraphEpoch()}`
  return last !== null && last.key === key && 'graph' in last ? last.graph : null
}

/** The saved graph for the scenario and saved hash on screen now; null until that read answers (or off the core lane). */
export function useSavedGraph(): unknown {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  // A living-model-only write leaves the analysis hash as it was; each applied turn or acknowledgement reads again.
  const epoch = useSyncExternalStore(subscribeSavedGraphEpoch, savedGraphEpoch)
  const key = `${scenarioId ?? ''}:${graphHash ?? ''}:${epoch}`
  const [read, setRead] = useState<{ key: string; graph: unknown } | null>(null)
  useEffect(() => {
    // CEE serves the core lane under the default `openai` mode too (`laneModeFor`): reading only on `?ai=core` left every
    // living-model reader dark on the default path. A legacy graph carries no living model, so its readers show nothing.
    const mode = resolveAiComparisonMode()
    if (!isOpenAiLane(mode) || !isCeeAddressableScenarioId(scenarioId) || graphHash === null) return
    let live = true
    void readOnce(key, scenarioId, graphHash).then((graph) => { if (live) setRead({ key, graph }) })
    return () => { live = false }
  }, [scenarioId, graphHash, key])
  return read?.key === key ? read.graph : null
}
