import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addNodeAction } from '../contextMenu/actions'
import { useCanvasStore } from '../store'
import { useRenameIntentStore } from '../ui/inspector-v2/renameIntent'
import { OPEN_FULL_INSPECTOR_EVENT } from '../utils/openEdgeStrengthEditor'
import { registerFocusHelpers } from '../utils/focusHelpers'
import { commitValidatedMutation } from '../mutations/commitValidatedMutation'
import type { NodeType } from '../domain/nodes'

vi.mock('../mutations/commitValidatedMutation', () => ({
  commitValidatedMutation: vi.fn(),
}))

const originalState = useCanvasStore.getState()
const toast = vi.fn()
const focusNode = vi.fn()
const openedOn: Array<string | null> = []
let unregisterFocus: () => void

function recordInspectorOpen() {
  openedOn.push([...useCanvasStore.getState().selection.nodeIds][0] ?? null)
}

beforeEach(() => {
  openedOn.length = 0
  useRenameIntentStore.getState().clear()
  useCanvasStore.setState({
    ...originalState,
    nodes: [{ id: 'existing-factor', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Existing', kind: 'factor' } }],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    engineLimits: null,
    addNode: vi.fn((position = { x: 0, y: 0 }, type: NodeType = 'factor') => {
      useCanvasStore.setState(state => ({
        nodes: [...state.nodes, { id: 'landed-new-factor', type, position, data: { label: 'New factor', kind: type } }],
      }))
      return null
    }),
  })
  vi.mocked(commitValidatedMutation).mockImplementation(async (_ops, apply) => {
    apply()
    return { success: true }
  })
  unregisterFocus = registerFocusHelpers(focusNode, vi.fn())
  window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, recordInspectorOpen)
})

afterEach(() => {
  unregisterFocus()
  window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, recordInspectorOpen)
  useCanvasStore.setState(originalState)
  useRenameIntentStore.getState().clear()
})

describe('slice 3a: Add finishes on the element that actually landed', () => {
  it('opens the inspector and rename intent on the NEW id, then focuses that id', async () => {
    await addNodeAction('factor', { x: 2600, y: 600 }, toast)

    expect(useCanvasStore.getState().nodes.map(node => node.id)).toEqual(['existing-factor', 'landed-new-factor'])
    expect(openedOn).toEqual(['landed-new-factor'])
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual(['landed-new-factor'])
    expect(useRenameIntentStore.getState().renameNodeId).toBe('landed-new-factor')
    await vi.waitFor(() => expect(focusNode).toHaveBeenCalledOnce())
    expect(focusNode).toHaveBeenCalledWith('landed-new-factor')
  })

  it('a refused commit opens nothing, requests no rename and does not move the camera', async () => {
    vi.mocked(commitValidatedMutation).mockResolvedValue({ success: false })

    await addNodeAction('factor', { x: 2600, y: 600 }, toast)

    expect(useCanvasStore.getState().nodes.map(node => node.id)).toEqual(['existing-factor'])
    expect(useCanvasStore.getState().addNode).not.toHaveBeenCalled()
    expect(openedOn).toEqual([])
    expect(useCanvasStore.getState().selection.nodeIds.size).toBe(0)
    expect(useRenameIntentStore.getState().renameNodeId).toBeNull()
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('a landing result without a node-count increase also opens nothing', async () => {
    vi.mocked(commitValidatedMutation).mockResolvedValue({ success: true })

    await addNodeAction('factor', { x: 2600, y: 600 }, toast)

    expect(openedOn).toEqual([])
    expect(useRenameIntentStore.getState().renameNodeId).toBeNull()
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('a refused commit cannot claim a concurrent unrelated add as its own', async () => {
    vi.mocked(commitValidatedMutation).mockImplementation(async () => {
      useCanvasStore.setState(state => ({
        nodes: [...state.nodes, { id: 'somebody-elses-node', type: 'risk', position: { x: 40, y: 50 }, data: { label: 'Other addition', kind: 'risk' } }],
      }))
      return { success: false }
    })

    await addNodeAction('factor', { x: 2600, y: 600 }, toast)

    expect(openedOn).toEqual([])
    expect(useRenameIntentStore.getState().renameNodeId).toBeNull()
    expect(focusNode).not.toHaveBeenCalled()
  })

  it('binds the new id even when validation returns the new node first', async () => {
    vi.mocked(commitValidatedMutation).mockImplementation(async () => {
      useCanvasStore.setState(state => ({
        nodes: [{ id: 'validated-new-factor', type: 'factor', position: { x: 2600, y: 600 }, data: { label: 'New factor', kind: 'factor' } }, ...state.nodes],
      }))
      return { success: true }
    })

    await addNodeAction('factor', { x: 2600, y: 600 }, toast)

    expect(openedOn).toEqual(['validated-new-factor'])
    expect(useRenameIntentStore.getState().renameNodeId).toBe('validated-new-factor')
    await vi.waitFor(() => expect(focusNode).toHaveBeenCalledWith('validated-new-factor'))
  })
})
