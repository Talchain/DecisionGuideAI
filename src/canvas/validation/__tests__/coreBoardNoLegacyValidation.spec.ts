/**
 * A CORE BOARD TAKES ITS READINESS FROM CEE ALONE (Paul's test, 25 Oct 2026; DL go). The legacy client validator's
 * directed-cycle rule refused every stock-and-flow core model ("Cycle detected: customers → monthly_customer_losses →
 * customers") and disabled Run on the served build. On a core board (`legacyValidationOff`, set from
 * `useSavedModelIsCore`) the validator does not run: `graphHealth` is null, so Run is not blocked by it and no cycle ids
 * are listed. A board that is not core is checked exactly as before.
 *
 * Real path: Paul's saved European-expansion graph (see the fixture's `_capture`) through the canvas mapper, the store's
 * `validateGraph` and the run gate `canRunAnalysis`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { useCanvasStore } from '../../store'
import { canRunAnalysis } from '../../utils/canRunAnalysis'
import eu from './fixtures/eu-expansion-19faa1f8-graph.json'

const nodes = eu.graph.nodes.map((n) => mapDraftNodeToCanvas(n as never))
const edges = eu.graph.edges.map((e, i) => mapDraftEdgeToCanvas(e as never, i))

/** Validate the board as the store does, with the switch set, and ask the run gate. */
async function gate(core: boolean) {
  useCanvasStore.setState({ nodes, edges, graphHealth: null, legacyValidationOff: false } as never)
  if (core) useCanvasStore.getState().setLegacyValidationOff(true)
  await useCanvasStore.getState().validateGraph()
  const graphHealth = useCanvasStore.getState().graphHealth
  const result = canRunAnalysis({ graphHealth, readiness: null, hasBlockers: false, nodeCount: nodes.length })
  return { graphHealth, result }
}

afterEach(() => { useCanvasStore.setState({ graphHealth: null, legacyValidationOff: false } as never) })

describe('a core board takes its readiness from CEE alone', () => {
  it('⭐ core board with a stock-and-flow loop: no legacy health, Run not blocked by it, no cycle ids listed', async () => {
    const { graphHealth, result } = await gate(true)
    expect(graphHealth).toBeNull()
    const said = [...(result.blockingReasons ?? []), result.reason ?? ''].join(' | ')
    expect(said).not.toContain('Cycle detected')
    expect(said).not.toContain('monthly_customer_losses')
  })

  it('CONTRAST (kept negative): the same graph on a board that is not core is refused by the cycle rule, as today', async () => {
    const { graphHealth, result } = await gate(false)
    expect(graphHealth?.issues.some((i) => i.type === 'cycle')).toBe(true)
    expect(result.allowed).toBe(false)
    expect((result.blockingReasons ?? []).some((r) => r.startsWith('Cycle detected: '))).toBe(true)
  })

  it('switching back to a board that is not core runs the validator again', async () => {
    await gate(true)
    useCanvasStore.getState().setLegacyValidationOff(false)
    await new Promise((r) => setTimeout(r, 0))
    await useCanvasStore.getState().validateGraph()
    expect(useCanvasStore.getState().graphHealth?.issues.some((i) => i.type === 'cycle')).toBe(true)
  })
})
