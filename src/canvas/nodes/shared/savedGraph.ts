/**
 * The saved graph as the graph route returns it (with its living model), for display readers on the core lane: the goal
 * card's other aims and the links the engine leaves out. ONE read per saved-graph change, shared by every reader (keyed by
 * scenario and saved hash), never another scenario's. Display only.
 */
import { useEffect, useState } from 'react'

import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../../lib/supabase'
import { resolveAiComparisonMode } from '../../../v5/aiComparisonMode'
import { isCeeAddressableScenarioId } from '../../hydrate/bootGraphRead'
import { useCanvasStore } from '../../store'

let last: { key: string; read: Promise<unknown> } | null = null
function readOnce(key: string, scenarioId: string): Promise<unknown> {
  if (last?.key !== key) {
    const read = (async () => {
      const identity = await getSessionIdentity().catch(() => ({ userId: null, accessToken: null }))
      const result = await fetchScenarioGraph(scenarioId, { userId: identity.userId, accessToken: identity.accessToken })
      return result.status === 'graph' ? result.graph : null
    })().catch(() => null)
    last = { key, read }
  }
  return last.read
}

/** The saved graph for the scenario and saved hash on screen now; null until that read answers (or off the core lane). */
export function useSavedGraph(): unknown {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const graphHash = useCanvasStore((s) => s.lastServerGraphHash)
  const key = `${scenarioId ?? ''}:${graphHash ?? ''}`
  const [read, setRead] = useState<{ key: string; graph: unknown } | null>(null)
  useEffect(() => {
    if (resolveAiComparisonMode() !== 'core' || !isCeeAddressableScenarioId(scenarioId) || graphHash === null) return
    let live = true
    void readOnce(key, scenarioId).then((graph) => { if (live) setRead({ key, graph }) })
    return () => { live = false }
  }, [scenarioId, graphHash, key])
  return read?.key === key ? read.graph : null
}
