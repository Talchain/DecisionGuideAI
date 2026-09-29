/**
 * ⭐ E1c — A CARD IS RENAMED ON THE CARD (Paul 29 Sep: "click the title … to rename; Enter saves, Esc cancels").
 *
 * Double-clicking a card's title used to reach the rename only through the inspector (`requestNodeRename`). The title
 * now becomes the inspector's own editor (`EditableLabel`) IN PLACE and commits through the inspector's own route,
 * `store.updateNodeLabel`, the one chokepoint that captures the durable `structural_rename` intent. Nothing new writes.
 *
 * CLAIM TYPE: jsdom render of `BaseNode` with the real canvas store; `updateNodeLabel` is spied, so the rows pin WHAT
 * the card commits and that it commits through that route.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'

const ID = 'fac_price'

function renderCard() {
  const props = {
    id: ID, type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
    data: { type: 'factor', label: 'Pro plan price' },
  }
  useCanvasStore.setState({ nodes: [props] as never, edges: [], highlightedNodes: new Set<string>(), dimmedNodeIds: new Set<string>() })
  return render(
    <ReactFlowProvider>
      <BaseNode {...(props as any)} nodeType="factor" icon={Circle} />
    </ReactFlowProvider>,
  )
}

let updateNodeLabel: ReturnType<typeof vi.fn>
beforeEach(() => {
  updateNodeLabel = vi.fn()
  useCanvasStore.setState({ updateNodeLabel } as never)
})
afterEach(() => cleanup())

describe('the title is renamed on the card', () => {
  it('double-click → the editor opens in place; Enter commits through store.updateNodeLabel', () => {
    renderCard()
    fireEvent.doubleClick(screen.getByTestId('node-title'))
    const input = screen.getByTestId('inspector-rename-input') as HTMLInputElement
    expect(input.value).toBe('Pro plan price')
    fireEvent.change(input, { target: { value: 'Pro plan monthly price' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(updateNodeLabel).toHaveBeenCalledWith(ID, 'Pro plan monthly price')
    // The editor is shown only WHILE editing: the card's own title returns.
    expect(screen.queryByTestId('node-title-rename')).toBeNull()
    expect(screen.getByTestId('node-title')).toBeDefined()
  })

  it('Esc cancels: nothing is committed and the title returns', () => {
    renderCard()
    fireEvent.doubleClick(screen.getByTestId('node-title'))
    const input = screen.getByTestId('inspector-rename-input')
    fireEvent.change(input, { target: { value: 'Something else' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(updateNodeLabel).not.toHaveBeenCalled()
    expect(screen.queryByTestId('node-title-rename')).toBeNull()
  })

  it('the double-click stops at the title, so the canvas handler (inspector rename) does not also fire', () => {
    const onParentDoubleClick = vi.fn()
    const props = {
      id: ID, type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
      positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, data: { type: 'factor', label: 'Pro plan price' },
    }
    useCanvasStore.setState({ nodes: [props] as never, edges: [] } as never)
    render(
      <ReactFlowProvider>
        <div onDoubleClick={onParentDoubleClick}>
          <BaseNode {...(props as any)} nodeType="factor" icon={Circle} />
        </div>
      </ReactFlowProvider>,
    )
    fireEvent.doubleClick(screen.getByTestId('node-title'))
    expect(onParentDoubleClick).not.toHaveBeenCalled()
  })
})
