/**
 * F3 (graph-visuals, Paul-ratified) — the transient focus-dim store seam.
 *
 * When the user focuses a node (driver row, chat pill, Alt+V cycling), every
 * node OUTSIDE the focus neighbourhood dims via the SAME store field the
 * node dim classes already consume (dimmedNodeIds → BaseNode opacity-60 —
 * no BaseNode edits). The dim is TRANSIENT and must never survive after
 * focus ends:
 * - setFocusDim(sourceId, ids) marks the dim as focus-owned and writes it
 * - clearFocusDim() empties the dim — but ONLY when focus-owned, so it can
 *   never clobber the selection path-dim (usePathHighlight's write)
 * - removing the focused node by ANY path (delete action, AI patch replacing
 *   nodes wholesale) clears the dim — a dim without its focus source is a
 *   stuck lens
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

const node = (id: string) =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } }) as any

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [node('a'), node('b'), node('c')],
    edges: [],
    dimmedNodeIds: new Set<string>(),
    focusDimSourceId: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as any)
})

describe('store focus dim — F3 transient dim seam', () => {
  it('setFocusDim writes the dim set through dimmedNodeIds and records the focus source', () => {
    useCanvasStore.getState().setFocusDim('a', ['b', 'c'])
    const s = useCanvasStore.getState()
    expect([...s.dimmedNodeIds].sort()).toEqual(['b', 'c'])
    expect(s.focusDimSourceId).toBe('a')
  })

  it('clearFocusDim empties the dim and the source (blur/deselect/manual pan path)', () => {
    useCanvasStore.getState().setFocusDim('a', ['b', 'c'])
    useCanvasStore.getState().clearFocusDim()
    const s = useCanvasStore.getState()
    expect(s.dimmedNodeIds.size).toBe(0)
    expect(s.focusDimSourceId).toBeNull()
  })

  it('clearFocusDim is a no-op when focus dim is not active — never clobbers the selection path-dim', () => {
    useCanvasStore.getState().setDimmedNodes(['c']) // usePathHighlight's write
    useCanvasStore.getState().clearFocusDim()
    expect([...useCanvasStore.getState().dimmedNodeIds]).toEqual(['c'])
  })

  it('deleting the focused node clears the dim (deleteNodeById path)', () => {
    useCanvasStore.getState().setFocusDim('a', ['b', 'c'])
    useCanvasStore.getState().deleteNodeById('a')
    const s = useCanvasStore.getState()
    expect(s.focusDimSourceId).toBeNull()
    expect(s.dimmedNodeIds.size).toBe(0)
  })

  it('a wholesale nodes replacement that drops the focused node clears the dim (AI patch path)', () => {
    useCanvasStore.getState().setFocusDim('a', ['b', 'c'])
    useCanvasStore.setState({ nodes: [node('b'), node('c')] })
    const s = useCanvasStore.getState()
    expect(s.focusDimSourceId).toBeNull()
    expect(s.dimmedNodeIds.size).toBe(0)
  })

  it('a nodes change that KEEPS the focused node leaves the dim alone', () => {
    useCanvasStore.getState().setFocusDim('a', ['b', 'c'])
    useCanvasStore.setState({ nodes: [node('a'), node('b'), node('c'), node('d')] })
    const s = useCanvasStore.getState()
    expect(s.focusDimSourceId).toBe('a')
    expect([...s.dimmedNodeIds].sort()).toEqual(['b', 'c'])
  })
})
