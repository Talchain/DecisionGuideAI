/**
 * ACCOUNTS viewer mode: CANVAS 5947752314's row. For a viewer, each local edit door
 * leaves `nodes` / `edges` identical, so nothing on screen can look like an edit
 * that was saved. The doors are the factor value edit (the in-card editor,
 * context-menu "Set value" and "Put it back" all end at `proposeFactorValue`),
 * rename, and the two commit helpers. CONTRAST: with the flag off, the same calls
 * DO change the graph, so each refusal is the flag's doing.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { commitGraphMutation } from '../commitGraphMutation'
import { commitValidatedMutation } from '../commitValidatedMutation'
import { useModelEditAuthority } from '../../hooks/useModelEditAuthority'
import { useNodeMutations, useEdgeMutations } from '../../ui/inspector-v2/useInspectorMutations'
import { __resetViewerModeForTests, setViewerScenario } from '../../../lib/viewerMode'
import { resolveEffectiveInteractionMode } from '../../useKeyboardShortcuts'

const SID = '3b241101-e2bb-4255-8caf-4136c566a962'

function seed() {
  useCanvasStore.setState({
    nodes: [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Price', value: 0.4 } },
    ] as never,
    edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }] as never,
  } as never)
}

/** The graph as content: `selected` / `measured` are view state a viewer may still change. */
function graph() {
  const strip = <T extends Node | Edge>(xs: T[]) => xs.map(({ selected: _s, ...rest }) => {
    const { measured: _m, ...content } = rest as typeof rest & { measured?: unknown }
    return content
  })
  const s = useCanvasStore.getState()
  return JSON.stringify({ nodes: strip(s.nodes as Node[]), edges: strip(s.edges as Edge[]) })
}

const addNode = (g: { nodes: Node[]; edges: Edge[] }) => ({
  ...g,
  nodes: [...g.nodes, { id: 'x1', type: 'factor', position: { x: 1, y: 1 }, data: { kind: 'factor', label: 'New' } } as Node],
})

beforeEach(() => {
  __resetViewerModeForTests()
  seed()
})

describe('viewer: every local edit door leaves the graph identical', () => {
  beforeEach(() => setViewerScenario(SID))

  it('commitGraphMutation (templates, blueprint insert) applies nothing', () => {
    const before = graph()
    commitGraphMutation(addNode)
    expect(graph()).toBe(before)
  })

  it('commitValidatedMutation (context menu, Delete key) never runs its local apply', async () => {
    const before = graph()
    let applied = false
    const result = await commitValidatedMutation([], () => {
      applied = true
      useCanvasStore.setState({ nodes: [] as never })
    })
    expect(result).toEqual({ success: false, error: 'view_only' })
    expect(applied).toBe(false)
    expect(graph()).toBe(before)
  })

  it('rename (card label, inspector title) changes nothing', () => {
    const before = graph()
    useCanvasStore.getState().updateNodeLabel('f1', 'Renamed by a viewer')
    expect(graph()).toBe(before)
  })

  it('a factor value edit happens nowhere: not_encodable, graph identical', () => {
    const before = graph()
    const { result } = renderHook(() => useModelEditAuthority('f1'))
    expect(result.current.proposeFactorValue(0.9)).toBe('not_encodable')
    expect(graph()).toBe(before)
  })

  it('inspector writes (Codex P2: the factor prior range) change nothing: node and edge mutation hooks', () => {
    const before = graph()
    const node = renderHook(() => useNodeMutations('f1'))
    node.result.current.setPriorRange(0, 100)
    node.result.current.setLabel('Renamed in the inspector')
    const edge = renderHook(() => useEdgeMutations('e1'))
    edge.result.current.setLabel('edge label by a viewer')
    expect(graph()).toBe(before)
  })

  it('a viewer is always in hand mode, so no card drags (nodesDraggable binds effectiveMode === select)', () => {
    expect(resolveEffectiveInteractionMode('select', false)).toBe('hand')
  })

  it('selection still works for a viewer (read-only, not inert)', () => {
    useCanvasStore.getState().onNodesChange([{ type: 'select', id: 'f1', selected: true }])
    expect((useCanvasStore.getState().nodes as Node[]).find((n) => n.id === 'f1')?.selected).toBe(true)
  })
})

describe('CONTRAST: the same calls with the flag off DO change the graph', () => {
  it('the owner keeps the tool they chose (select stays select)', () => {
    expect(resolveEffectiveInteractionMode('select', false)).toBe('select')
  })

  it('commitGraphMutation adds the node', () => {
    const before = graph()
    commitGraphMutation(addNode)
    expect(graph()).not.toBe(before)
  })

  it('rename changes the label', () => {
    useCanvasStore.getState().updateNodeLabel('f1', 'Renamed by the owner')
    expect((useCanvasStore.getState().nodes as Node[]).find((n) => n.id === 'f1')?.data.label).toBe('Renamed by the owner')
  })

  it('the inspector prior range and edge label land', () => {
    const before = graph()
    renderHook(() => useNodeMutations('f1')).result.current.setPriorRange(0, 100)
    renderHook(() => useEdgeMutations('e1')).result.current.setLabel('owner edge label')
    expect(graph()).not.toBe(before)
  })

  it('commitValidatedMutation reaches its local apply', async () => {
    let applied = false
    await commitValidatedMutation([], () => { applied = true })
    expect(applied).toBe(true)
  })
})
