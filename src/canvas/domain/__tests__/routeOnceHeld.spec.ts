import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { computeRouteOnceHeld, routeOnceHeldEdges, routeOnceHeldIds } from '../routeOnceHeld'
import { resolveEdgeValueDisplay, resolveCausalLensEdgeParams } from '../edgeValueProvenance'
import { useCanvasStore } from '../../store'
import { useRouteOnceHeld } from '../../hooks/useRouteOnceHeld'
import { EdgePanel } from '../../ui/inspector-v2/panels/EdgePanel'
import { EDGE_COPY } from '../../ui/inspector-v2/inspectorStrings'
import { toRowDetail } from '../../model-tab-v2/adapters'
import { describeEdgeForSpeech } from '../edgeAccessibleName'
import { provenanceKey } from '../../components/provenanceKey'
import { useNodeConnections } from '../../hooks/useNodeConnections'
import { DEFAULT_EDGE_DATA } from '../edges'

const data = { weight: 0.4, weightSource: 'cee' as const, beliefExists: 0.8, exists_probability: 0.8, beliefExistsSource: 'cee' as const }
function chain(size = 3) {
  const nodes = Array.from({ length: size }, (_, i) => ({
    id: `n${i}`, type: 'factor', position: { x: i * 100, y: 0 }, data: { label: `Factor ${i}` },
  }))
  const edges = Array.from({ length: size - 1 }, (_, i) => ({
    id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, type: 'styled', data: { ...DEFAULT_EDGE_DATA, ...data },
  }))
  return { nodes, edges }
}
function seed(graph: ReturnType<typeof chain>) {
  useCanvasStore.setState({ ...useCanvasStore.getState(), ...graph, results: { status: 'none', report: null } } as never)
}

describe('Rule R read-time display mirror', () => {
  it('resolver: held link is 1; FIRST default link stays at stored 0.8; stored data is untouched', () => {
    const { nodes, edges } = chain()
    const before = structuredClone({ nodes, edges })
    const ids = routeOnceHeldIds(nodes, edges)
    expect([...ids]).toEqual(['e1'])
    expect(resolveEdgeValueDisplay(edges[1].data, 'beliefExists', { routeOnceHeld: ids.has('e1') }))
      .toEqual({ show: true, value: 1, source: 'cee' })
    expect(resolveEdgeValueDisplay(edges[0].data, 'beliefExists', { routeOnceHeld: ids.has('e0') }))
      .toEqual({ show: true, value: 0.8, source: 'cee' })
    expect(resolveCausalLensEdgeParams(edges[1].data, { routeOnceHeld: true }).existsProb).toBe(1)
    expect({ nodes, edges }).toEqual(before)
  })

  it('I5: nothing held means an empty set and today’s resolver output, deep-equal', () => {
    const { nodes, edges } = chain(2)
    expect(routeOnceHeldEdges(nodes, edges).size).toBe(0)
    const variants = [edges[0].data, { beliefExists: 0.8 }, {}, undefined,
      { beliefExists: 0.8, existenceHeld: true }, { beliefExists: NaN, beliefExistsSource: 'cee' as const }]
    const today = [
      { show: true, value: 0.8, source: 'cee' }, { show: false, reason: 'not_set' },
      { show: false, reason: 'absent' }, { show: false, reason: 'absent' },
      { show: true, value: 1, source: 'cee' }, { show: false, reason: 'absent' },
    ]
    variants.forEach((d, i) => {
      const current = resolveEdgeValueDisplay(d, 'beliefExists')
      expect(current).toEqual(today[i])
      expect(resolveEdgeValueDisplay(d, 'beliefExists', { routeOnceHeld: false })).toEqual(current)
    })
    expect(resolveEdgeValueDisplay(data, 'weight', { routeOnceHeld: true }))
      .toEqual(resolveEdgeValueDisplay(data, 'weight'))
  })

  it('memo: same arrays return the same Set objects; changed arrays recompute', () => {
    const { nodes, edges } = chain()
    expect(routeOnceHeldEdges(nodes, edges)).toBe(routeOnceHeldEdges(nodes, edges))
    expect(routeOnceHeldIds(nodes, edges)).toBe(routeOnceHeldIds(nodes, edges))
    expect(routeOnceHeldEdges([...nodes], edges)).not.toBe(routeOnceHeldEdges(nodes, edges))
    const edited = edges.map((e, i) => i === 0 ? { ...e, data: { ...e.data, exists_probability: 1 } } : e)
    expect(routeOnceHeldIds(nodes, edited).size).toBe(0)
    expect(routeOnceHeldIds(nodes, edges).has('e1')).toBe(true)
  })

  it('canvas probability fallback and top-level identity operands match the wire rule', () => {
    const { nodes, edges } = chain()
    edges[0].data.exists_probability = NaN
    expect([...routeOnceHeldIds(nodes, edges)]).toEqual(['e1'])
    const identityNodes = nodes.map((n, i) => i === 1 ? { ...n, nonlinear_identity: { factor_ids: ['n0'] } } : n)
    expect(routeOnceHeldIds(identityNodes, edges).size).toBe(0)
    const dataIdentityNodes = nodes.map((n, i) => i === 2 ? { ...n, data: { ...n.data, nonlinear_identity: { factor_ids: ['n1'] } } } : n)
    expect(routeOnceHeldIds(dataIdentityNodes, edges).size).toBe(0)
    const nullIdentityNodes = identityNodes.map(n => ({ ...n, data: { ...n.data, nonlinear_identity: null } }))
    expect(routeOnceHeldIds(nullIdentityNodes, edges).size).toBe(0)
  })

  it('non-component readers: model detail, causal lens, speech and provenance key use the held display', () => {
    const graph = chain()
    const heldIds = routeOnceHeldIds(graph.nodes, graph.edges)
    const detail = toRowDetail({ ...graph, goalThreshold: null }, 'e1')
    expect(detail?.advancedParameters.find(p => p.label === 'Exists probability')?.value).toBe('1')
    expect(describeEdgeForSpeech(graph.edges[1].data, 'numeric', { routeOnceHeld: heldIds.has('e1') }))
      .toBe(describeEdgeForSpeech({ ...graph.edges[1].data, existenceHeld: true }, 'numeric'))
    expect(describeEdgeForSpeech(graph.edges[1].data, 'numeric', { routeOnceHeld: true })).toContain('100%')
    const doubtedEdges = [graph.edges[0], { ...graph.edges[1], data: { ...data, beliefExists: 0.5, exists_probability: 0.5 } }]
    expect(provenanceKey(graph.nodes, doubtedEdges).links.some(c => c.cue === 'doubt')).toBe(false)
    const uncoveredEdges = [{ ...graph.edges[0], data: { ...data, beliefExists: 1, exists_probability: 1 } }, doubtedEdges[1]]
    expect(provenanceKey(graph.nodes, uncoveredEdges).links.some(c => c.cue === 'doubt')).toBe(true)
    expect(resolveCausalLensEdgeParams(graph.edges[1].data, { routeOnceHeld: true }).existsProb).toBe(1)
  })

  it('a store that is not yet two arrays holds nothing (never throws: a WeakMap key must be an object)', () => {
    for (const [n, e] of [[undefined, undefined], [[], undefined], [undefined, []], [null, null]] as const) {
      expect(routeOnceHeldIds(n as never, e as never).size).toBe(0)
      expect(routeOnceHeldEdges(n as never, e as never).size).toBe(0)
    }
  })

  it('scaling: 1000 -> 4000 nodes grows no faster than a plain Map/Set walk (normalised ratio < 1.6)', () => {
    const small = chain(1000)
    const large = chain(4000)
    type Graph = ReturnType<typeof chain>
    // The walk itself (uncached), so the row measures its growth, not the memo's retention of 30 results.
    const walk = (graph: Graph) => computeRouteOnceHeld(graph.nodes, graph.edges)
    // A known-linear walk over the same kind of structures: a Set of node ids, a Map of counts, one pass over the edges.
    const reference = (graph: Graph) => {
      const ids = new Set<string>()
      for (const node of graph.nodes) ids.add(node.id)
      const incoming = new Map<string, number>()
      for (const edge of graph.edges) if (ids.has(edge.source) && ids.has(edge.target)) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1)
      return incoming.size
    }
    const time = (f: (graph: Graph) => unknown, graph: Graph, calls: number) => {
      const start = performance.now()
      for (let i = 0; i < calls; i++) f(graph)
      return Math.max(performance.now() - start, 0.05)
    }
    for (const f of [walk, reference]) { time(f, small, 10); time(f, large, 10) }
    const calibrate = (f: (graph: Graph) => unknown) => {
      const samples = Array.from({ length: 3 }, () => time(f, large, 1)).sort((a, b) => a - b)
      const oneCallLargeMs = samples[1]
      return Math.max(1, Math.ceil(60 / oneCallLargeMs))
    }
    // Calibrate each function independently to ~60 ms at LARGE, then use its same call count at both sizes.
    const walkCalls = calibrate(walk)
    const referenceCalls = calibrate(reference)
    // ⛔ Gate on the NORMALISED ratio (walk growth ÷ a plain Map/Set walk's growth); both ratios stay in the message.
    // Calibrated 1000 → 4000, measured 7 Oct 23:5xZ (20 real / 5 quadratic-mutant runs, one file, load < 25):
    //   real: raw 4.98–5.58×, normalised 0.97–1.13×; quadratic (one O(n) target scan per edge): raw 11.36–12.23×, normalised 2.22–2.48×.
    // Raw < 8 was not taken: the mutant's raw dipped to 10.7× in calibration runs (P51's switch rule needs ≥ 12).
    // The bar 1.6 is the geometric midpoint of real max 1.13 and mutant min 2.22: ~1.4× margin on each side (2 left the RED side 1.1×).
    const min = { walkSmall: Infinity, walkLarge: Infinity, refSmall: Infinity, refLarge: Infinity }
    for (let round = 0; round < 7; round++) {
      min.walkSmall = Math.min(min.walkSmall, time(walk, small, walkCalls))
      min.walkLarge = Math.min(min.walkLarge, time(walk, large, walkCalls))
      min.refSmall = Math.min(min.refSmall, time(reference, small, referenceCalls))
      min.refLarge = Math.min(min.refLarge, time(reference, large, referenceCalls))
    }
    const walkRatio = min.walkLarge / min.walkSmall
    const referenceRatio = min.refLarge / min.refSmall
    const normalisedRatio = walkRatio / referenceRatio
    const message = `scaling: walkSmall=${min.walkSmall.toFixed(3)}ms walkLarge=${min.walkLarge.toFixed(3)}ms refSmall=${min.refSmall.toFixed(3)}ms refLarge=${min.refLarge.toFixed(3)}ms walkCalls=${walkCalls} refCalls=${referenceCalls} raw=${walkRatio.toFixed(6)}× normalised=${normalisedRatio.toFixed(6)}× reference=${referenceRatio.toFixed(6)}× (interleaved min-of-7)`
    console.log(message)
    expect(normalisedRatio, message).toBeLessThan(1.6)
  })

  it('hook: changing an earlier link flips the boolean with the held edge object unchanged', () => {
    const graph = chain()
    seed(graph)
    const { result } = renderHook(() => useRouteOnceHeld('e1'))
    expect(result.current).toBe(true)
    act(() => useCanvasStore.setState({ edges: graph.edges.map((e, i) => i === 0
      ? { ...e, data: { ...e.data, exists_probability: 1 } } : e) }))
    expect(result.current).toBe(false)
    expect(useCanvasStore.getState().edges[1]).toBe(graph.edges[1])
  })

  it('node connections: held link is 100%, first link is 80%', () => {
    seed(chain())
    useCanvasStore.setState({ results: { status: 'complete', report: null } } as never)
    const { result } = renderHook(() => [useNodeConnections('n1', 'outbound'), useNodeConnections('n0', 'outbound')])
    expect(result.current.map(rows => rows[0].confidencePct)).toEqual([100, 80])
  })

  it('EdgePanel: counted-once note + slider at 1; first link stays 0.8 with no note; upstream edit removes hold', () => {
    const graph = chain()
    seed(graph)
    const props = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
    const panel = render(createElement(EdgePanel, props))
    expect(screen.getByTestId('edge-existence-held-note').textContent).toBe(EDGE_COPY.existenceCountedOnceNote)
    expect(EDGE_COPY.existenceCountedOnceNote).toBe('Counted once: Olumi’s doubt about each route through this link already sits on an earlier link, so the analysis always includes this one.')
    expect((screen.getByLabelText('Connection existence probability') as HTMLInputElement).value).toBe('1')
    expect(screen.getByTestId('edge-existence-readout').textContent).toContain('Very likely to exist')
    act(() => useCanvasStore.setState({ edges: graph.edges.map((e, i) => i === 0
      ? { ...e, data: { ...e.data, exists_probability: 1 } } : e) }))
    expect(screen.queryByTestId('edge-existence-held-note')).toBeNull()
    expect((screen.getByLabelText('Connection existence probability') as HTMLInputElement).value).toBe('0.8')
    act(() => seed(graph))
    panel.rerender(createElement(EdgePanel, { ...props, edgeId: 'e0' }))
    expect(screen.queryByTestId('edge-existence-held-note')).toBeNull()
    expect((screen.getByLabelText('Connection existence probability') as HTMLInputElement).value).toBe('0.8')
    expect(screen.getByTestId('edge-existence-readout').textContent).toContain('Likely to exist')
    act(() => useCanvasStore.setState({ edges: graph.edges.map((e, i) => i === 1
      ? { ...e, data: { ...e.data, existenceHeld: true } } : e) }))
    panel.rerender(createElement(EdgePanel, props))
    expect(screen.getByTestId('edge-existence-held-note').textContent).toBe(EDGE_COPY.existenceHeldNote)
    expect((screen.getByLabelText('Connection existence probability') as HTMLInputElement).value).toBe('1')
  })
})
