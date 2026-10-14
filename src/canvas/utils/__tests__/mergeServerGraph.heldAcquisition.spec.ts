/**
 * S-DEF (Codex r2 #2602): a reload that ACQUIRES CEE's hold is not an edit. The first boot after S-DEF serves, every saved
 * model with a validated definition learns `existenceHeld` + `existenceHeldByDefinition` from the server graph. That is
 * acquired metadata, so it must not mark a current analysis stale (`markGraphStructurallyEdited`). SERVED graph: Wave B9
 * T1b (CEE df15c8c1 + UI 19e4dd53), the identity "Starter-tier monthly recurring revenue" → "monthly recurring revenue".
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { normalisePersistedGraph } from '../normalisePersistedGraph'

type Rec = Record<string, any>
const SERVED = JSON.parse(readFileSync(resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/waveB9-t1b-df15c8c-graph.json'), 'utf8')) as { graph: Rec }
const IDENTITY = ['starter_tier_monthly_recurring_revenue', 'monthly_recurring_revenue'] as const

function serverGraph(mutate?: (edge: Rec) => void): Rec {
  const g = structuredClone(SERVED.graph)
  const edge = { ...g.edges.find((e: Rec) => e.from === IDENTITY[0] && e.to === IDENTITY[1]), id: 'identity' }
  mutate?.(edge)
  return { nodes: g.nodes, edges: [edge] }
}

/** The canvas as a pre-S-DEF autosave left it: the same graph, the identity edge with NO hold stamped. */
function seedCanvasSavedBeforeSDef(): void {
  const g = serverGraph()
  const canvasEdge = mapDraftEdgeToCanvas(g.edges[0], 0)
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: normalisePersistedGraph({ nodes: g.nodes, edges: [] }).nodes,
    edges: [canvasEdge],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
    graphEditedSinceLastRun: false,
    analysisStateReady: true,
    analysisFreshnessDirty: false,
  } as never)
}

describe('S-DEF: acquiring the hold on reload is not an edit', () => {
  beforeEach(() => { seedCanvasSavedBeforeSDef() })

  it('PRECONDITION: the saved canvas edge carries no hold, and the analysis reads current', () => {
    const s = useCanvasStore.getState()
    expect((s.edges[0]?.data as Rec | undefined)?.existenceHeld).toBeUndefined()
    expect(s.graphEditedSinceLastRun).toBe(false)
  })

  it('RED at base: the identical server graph stamps the hold, and the analysis stays current', () => {
    mergeServerGraphOnHydrate(serverGraph())
    const s = useCanvasStore.getState()
    const edge = s.edges.find((e) => e.source === IDENTITY[0] && e.target === IDENTITY[1])
    expect((edge?.data as Rec | undefined)?.existenceHeld).toBe(true)
    expect((edge?.data as Rec | undefined)?.existenceHeldByDefinition).toBe(true)
    expect(s.graphEditedSinceLastRun).toBe(false)
  })

  it('CONTROL: a real change on the same edge (its existence 0.8 → 0.5) still marks the analysis stale', () => {
    mergeServerGraphOnHydrate(serverGraph((e) => { e.exists_probability = 0.5 }))
    expect(useCanvasStore.getState().graphEditedSinceLastRun).toBe(true)
  })
})
