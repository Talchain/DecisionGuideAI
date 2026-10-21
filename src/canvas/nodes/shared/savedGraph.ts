/**
 * The saved graph as the graph route returns it (with its living model), for display readers on the core lane: the goal
 * card's other aims and the links the engine leaves out. ONE read per saved-graph change, shared by every reader (keyed by
 * scenario, saved hash and each applied turn or acknowledgement), never another scenario's. Display only.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../../lib/supabase'
import { resolveAiComparisonMode } from '../../../v5/aiComparisonMode'
import { isCeeAddressableScenarioId } from '../../hydrate/bootGraphRead'
import { useCanvasStore } from '../../store'
import { savedGraphEpoch, subscribeSavedGraphEpoch } from './savedGraphEpoch'

let last: { key: string; read: Promise<unknown> } | null = null
/** The saved graph IS the one on screen: same scenario, same saved hash (one may be the other's 16-hex prefix). */
const sameHash = (a: string | null, b: string): boolean => a !== null && (a === b || a.startsWith(b) || b.startsWith(a))
function readOnce(key: string, scenarioId: string, graphHash: string): Promise<unknown> {
  if (last?.key !== key) {
    const read = (async () => {
      const identity = await getSessionIdentity().catch(() => ({ userId: null, accessToken: null }))
      const result = await fetchScenarioGraph(scenarioId, { userId: identity.userId, accessToken: identity.accessToken })
      // Codex R1: another scenario's or another save's graph is never shown under this key.
      return result.status === 'graph' && result.scenarioId === scenarioId && sameHash(result.graphHash, graphHash) ? result.graph : null
    })().catch(() => null)
    const entry = { key, read }
    last = entry
    // A failed or mismatched read is not kept: the next mount reads again (Codex R1).
    void read.then((graph) => { if (graph === null && last === entry) last = null })
  }
  return last.read
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
    if (resolveAiComparisonMode() !== 'core' || !isCeeAddressableScenarioId(scenarioId) || graphHash === null) return
    let live = true
    void readOnce(key, scenarioId, graphHash).then((graph) => { if (live) setRead({ key, graph }) })
    return () => { live = false }
  }, [scenarioId, graphHash, key])
  return read?.key === key ? read.graph : null
}
