/**
 * commitGraphMutation — the shared canvas-store commit that every raw-setState graph
 * route converges on (template insert/replace via commitTemplateGraphReplace, and
 * both TemplatesPanel merges). It must dirty the analysis-freshness overlay so a
 * structural graph change cannot leave a retained CEE 'fresh' verdict falsely intact.
 *
 * Exercising the helper directly covers those call sites' dirtying without rendering
 * the heavy panels/canvas (TemplatesPanel pulls async template fetches + scenarios;
 * ReactFlowGraph pulls OutputsDock/Supabase/ELK). The routing — that the merge
 * handlers actually call this — is guarded separately by a source check.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { commitGraphMutation } from '../commitGraphMutation'
import { useCanvasStore } from '../../store'
import { resolveDisplayedFreshness } from '../../store/analysisFreshness'
import type { EdgeData } from '../../domain/edges'

const node = (id: string): Node =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }) as Node
const edge = (id: string, source: string, target: string): Edge =>
  ({ id, source, target }) as Edge

const dirty = () => useCanvasStore.getState().analysisFreshnessDirty
const displayed = () => {
  const s = useCanvasStore.getState()
  return resolveDisplayedFreshness(s.analysisFreshness, s.analysisFreshnessDirty)
}
const applyFresh = () =>
  useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [] as Edge<EdgeData>[],
    history: { past: [], future: [] },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
})

describe('commitGraphMutation — merge form (TemplatesPanel "Merge into Current" / card merge)', () => {
  it('appends to the CURRENT graph and downgrades a retained fresh verdict to cannot-confirm', () => {
    useCanvasStore.setState({ nodes: [node('a')], edges: [edge('e-a', 'a', 'a')] as Edge<EdgeData>[] })
    applyFresh()
    expect(displayed()).toBe('fresh') // precondition: clean fresh analysis

    // The exact appender shape both TemplatesPanel merges use.
    commitGraphMutation((cur) => ({
      nodes: [...cur.nodes, node('b'), node('c')],
      edges: [...cur.edges, edge('e-b', 'b', 'c')],
    }))

    // Functional updater read the CURRENT store state (['a'] + new), not a stale snapshot.
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(useCanvasStore.getState().edges.map((e) => e.id)).toEqual(['e-a', 'e-b'])
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown') // CEE 'fresh' + local dirty → cannot-confirm
  })

  it('does not fabricate stale: a CEE stale verdict stays stale (overlay only downgrades fresh)', () => {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
    commitGraphMutation((cur) => ({ nodes: [...cur.nodes, node('b')], edges: cur.edges }))
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('stale')
  })
})

describe('commitGraphMutation — replace form (template insert/replace)', () => {
  it('replaces the graph and downgrades a retained fresh verdict', () => {
    useCanvasStore.setState({ nodes: [node('old')] })
    applyFresh()
    commitGraphMutation(() => ({ nodes: [node('t1')], edges: [] }), { pushHistory: true })
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['t1'])
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })
})

describe('commitGraphMutation — history', () => {
  it('pushes a single history frame by default (undoable)', () => {
    useCanvasStore.setState({ nodes: [node('old')], history: { past: [], future: [] } })
    commitGraphMutation((cur) => ({ nodes: [...cur.nodes, node('b')], edges: cur.edges }))
    expect(useCanvasStore.getState().history.past.length).toBe(1)
  })

  it('skips the history frame when pushHistory: false', () => {
    useCanvasStore.setState({ nodes: [node('old')], history: { past: [], future: [] } })
    commitGraphMutation((cur) => ({ nodes: [...cur.nodes, node('b')], edges: cur.edges }), { pushHistory: false })
    expect(useCanvasStore.getState().history.past.length).toBe(0)
    // Still dirties — the commit happened, only the undo frame was skipped.
    expect(dirty()).toBe(true)
  })
})
