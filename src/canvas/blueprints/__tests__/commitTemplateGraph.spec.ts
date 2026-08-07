/**
 * commitTemplateGraphReplace — template insert/replace must dirty the freshness
 * overlay (regression for the false-fresh hole where a retained CEE 'fresh' verdict
 * survived "Start from Template" / replace).
 *
 * insertBlueprint ("Start from Template") and handleConfirmReplace (which prunes the
 * existing template then calls insertBlueprint) both route their graph replace
 * through this helper, so exercising it directly covers both paths' dirtying without
 * rendering the whole ReactFlowGraph canvas tree (which pulls OutputsDock/Supabase/
 * ELK and is impractical to mock reliably; ReactFlow dom tests are excluded in
 * vitest.config.ts for jsdom issues).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { commitTemplateGraphReplace } from '../commitTemplateGraph'
import { useCanvasStore } from '../../store'
import { resolveDisplayedFreshness } from '../../store/analysisFreshness'
import type { EdgeData } from '../../domain/edges'

const node = (id: string): Node =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }) as Node

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

describe('commitTemplateGraphReplace — template insert/replace dirties freshness', () => {
  it('insert ("Start from Template"): replaces the graph and downgrades a retained fresh verdict', () => {
    applyFresh()
    expect(displayed()).toBe('fresh') // precondition: a clean fresh analysis

    commitTemplateGraphReplace([node('t1')], [])

    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['t1'])
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown') // CEE 'fresh' + local dirty → cannot-confirm
  })

  it('replace: a fresh verdict does not survive replacing an existing template', () => {
    // Seed an existing template + a fresh verdict.
    useCanvasStore.setState({ nodes: [node('old')] })
    applyFresh()
    // handleConfirmReplace prunes the existing template via bare setState (which
    // does NOT dirty on its own)...
    useCanvasStore.setState({ nodes: [] })
    expect(dirty()).toBe(false)
    // ...then calls insertBlueprint → commitTemplateGraphReplace, which dirties.
    commitTemplateGraphReplace([node('t2')], [])
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(['t2'])
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('unknown')
  })

  it('does not fabricate stale: a CEE stale verdict stays stale (overlay only downgrades fresh)', () => {
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
    commitTemplateGraphReplace([node('t1')], [])
    expect(dirty()).toBe(true)
    expect(displayed()).toBe('stale')
  })

  it('pushes a single history frame so the template insert is undoable', () => {
    useCanvasStore.setState({ nodes: [node('old')], history: { past: [], future: [] } })
    commitTemplateGraphReplace([node('t1')], [])
    expect(useCanvasStore.getState().history.past.length).toBe(1)
  })
})
