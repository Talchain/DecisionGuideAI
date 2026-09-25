/**
 * A STRUCTURAL link (Decision → option, option → factor) reaches the model with
 * CEE's own structural convention — a CAUSAL link still never does until its
 * strength is stated.
 *
 * THE DEFECT (served UI `5dd24fd3`, 24 Sep 2026, scenario 9b0c62d6): Decision
 * "+ Add option" sent `structural_add` for the option but NOT its link, because
 * `structural_add_edge` stood the link down at `strength_not_stated`. CEE's reply:
 * "It isn't connected to anything yet, so it can't be compared with your other
 * choices" — an added option could never be analysed.
 *
 * WHY SENDING IT IS NOT A FABRICATED STRENGTH: a Decision → option or option →
 * factor link is not a causal claim. CEE stores every one of them under one fixed
 * convention — read back from the same scenario's committed graph: `strength
 * {mean: 1, std: 0.01}`, `effect_direction: 'positive'`, `exists_probability: 1`
 * on all four `dec_pricing → opt_*` and every `opt_* → fac_*` edge. The
 * stand-down exists to stop USER_EDGE_DEFAULTS' 0.3 reaching the wire as a
 * causal strength nobody stated; it was never meant for links that carry none.
 *
 * Pinned, through the real store (`addNodeWithEdge`, the gesture "+ Add option"
 * calls):
 *   1. Decision → new option is captured at magnitude 1, direction positive.
 *   2. Option → new factor is captured the same way.
 *   3. CONTRAST — factor → new outcome (a causal link) still stands down at
 *      `strength_not_stated`, and nothing is captured.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'

const NODES = [
  { id: 'dec_pricing', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Pricing', kind: 'decision' } },
  { id: 'opt_hybrid', type: 'option', position: { x: 0, y: 200 }, data: { label: 'Hybrid', kind: 'option' } },
  { id: 'fac_friction', type: 'factor', position: { x: 0, y: 400 }, data: { label: 'Friction', kind: 'factor' } },
]

function seed() {
  useCanvasStore.getState().reset?.()
  useCanvasStore.setState({
    nodes: structuredClone(NODES) as never,
    edges: [],
    lastServerGraphHash: 'd5785ea1d6a5e1e6',
    currentScenarioId: '9b0c62d6-fec0-468f-9c82-51480f5bdc9c',
    pendingStructuralAddEdges: [],
    pendingStructuralAdds: [],
  } as never)
}

const pendingEdges = () =>
  (useCanvasStore.getState() as unknown as { pendingStructuralAddEdges: Array<Record<string, unknown>> })
    .pendingStructuralAddEdges

function addConnected(type: string, connectTo: string, dir: 'to-target' | 'from-target') {
  const before = new Set(useCanvasStore.getState().nodes.map((n) => n.id))
  useCanvasStore.getState().addNodeWithEdge({ x: 10, y: 10 }, type as never, connectTo, dir)
  const added = useCanvasStore.getState().nodes.find((n) => !before.has(n.id))
  expect(added, 'addNodeWithEdge added no node').toBeDefined()
  return added!.id
}

describe('structural links reach the model in CEE\'s structural convention', () => {
  beforeEach(seed)

  it('Decision → new option ("+ Add option") is captured at magnitude 1, positive', () => {
    const optId = addConnected('option', 'dec_pricing', 'from-target')
    const intent = pendingEdges().find((i) => i.to === optId)
    expect(intent).toMatchObject({ from: 'dec_pricing', to: optId, magnitude: 1, direction: 'positive' })
    const edge = useCanvasStore.getState().edges.find((e) => e.source === 'dec_pricing' && e.target === optId)
    expect((edge?.data as Record<string, unknown> | undefined)?.structuralAddStandDown).toBeUndefined()
  })

  it('Option → new factor is captured the same way', () => {
    const facId = addConnected('factor', 'opt_hybrid', 'from-target')
    const intent = pendingEdges().find((i) => i.to === facId)
    expect(intent).toMatchObject({ from: 'opt_hybrid', to: facId, magnitude: 1, direction: 'positive' })
  })

  it('CONTRAST — factor → new outcome is causal: it still stands down, nothing captured', () => {
    const outId = addConnected('outcome', 'fac_friction', 'to-target')
    expect(pendingEdges().find((i) => i.to === outId || i.from === outId)).toBeUndefined()
    const edge = useCanvasStore.getState().edges.find((e) => e.target === outId || e.source === outId)
    expect((edge?.data as Record<string, unknown> | undefined)?.structuralAddStandDown).toBe('strength_not_stated')
  })
})
