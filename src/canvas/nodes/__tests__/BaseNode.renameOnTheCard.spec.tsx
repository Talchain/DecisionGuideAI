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
import { ReactFlow, ReactFlowProvider, type Node, type NodeProps } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseNode } from '../BaseNode'
import { TITLE_DOUBLE_CLICK_WINDOW_MS } from '../shared/titleClickHandBack'
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

/**
 * ⭐ PR Review on #2318 (5895008733): a browser sends click, click, dblclick. React Flow's node click is the one channel
 * through which the canvas opens the full inspector AND, mid-reconnect, completes the connection
 * (`ReactFlowGraph.handleNodeClick`), and it fired on both clicks BEFORE the dblclick that renames. These rows mount
 * the REAL React Flow with a real `BaseNode` card and send the full sequence.
 */
describe('the title keeps its clicks local through the whole double-click', () => {
  beforeAll(() => {
    // React Flow measures; give the flow a size so the wrappers render and bind (as in the SI-5 spec).
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
    // jsdom has no DOMMatrixReadOnly; React Flow reads the viewport scale from it when it measures a card.
    ;(window as any).DOMMatrixReadOnly ??= class { m22 = 1 }
  })

  const FactorCard = (p: NodeProps) => <BaseNode {...(p as any)} nodeType="factor" icon={Circle} />
  const TYPES = { factor: FactorCard }
  const NODE: Node = { id: ID, type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label: 'Pro plan price' } }
  const afterTheWindow = () => new Promise((r) => setTimeout(r, TITLE_DOUBLE_CLICK_WINDOW_MS + 80))

  /** `onNodeClick` routed exactly as `ReactFlowGraph.handleNodeClick` routes it: reconnect first, else the inspector. */
  function mountFlow() {
    const openInspector = vi.fn()
    const onNodeClick = vi.fn((_e: unknown, node: { id: string }) => {
      const s = useCanvasStore.getState()
      if (s.reconnecting) s.completeReconnect(node.id)
      else openInspector(node.id)
    })
    useCanvasStore.setState({ nodes: [NODE] as never, edges: [], highlightedNodes: new Set<string>(), dimmedNodeIds: new Set<string>(), reconnecting: null } as never)
    const { container } = render(
      <ReactFlowProvider>
        <ReactFlow nodes={[NODE]} edges={[]} nodeTypes={TYPES} onNodeClick={onNodeClick as never} />
      </ReactFlowProvider>,
    )
    const card = container.querySelector<HTMLElement>(`.react-flow__node[data-id="${ID}"]`)
    expect(card, 'PRECONDITION: React Flow rendered the card').not.toBeNull()
    const title = card!.querySelector<HTMLElement>('[data-testid="node-title"]')
    expect(title, 'PRECONDITION: the card rendered its title').not.toBeNull()
    return { onNodeClick, openInspector, card: card!, title: title! }
  }

  function doubleClickLikeABrowser(el: HTMLElement) {
    fireEvent.click(el, { detail: 1 })
    fireEvent.click(el, { detail: 2 })
    fireEvent.doubleClick(el, { detail: 2 })
  }

  it('CONTRAST — a click elsewhere on the card reaches the canvas at once, as before', () => {
    const { onNodeClick, openInspector, card } = mountFlow()
    fireEvent.click(card)
    expect(onNodeClick).toHaveBeenCalledTimes(1)
    expect(openInspector).toHaveBeenCalledWith(ID)
  })

  it('NORMAL: click, click, dblclick on the title → the rename opens on the card and the inspector never opens', async () => {
    const { onNodeClick, openInspector, title } = mountFlow()
    doubleClickLikeABrowser(title)
    expect(screen.getByTestId('inspector-rename-input')).toBeDefined()
    await afterTheWindow()
    expect(onNodeClick).not.toHaveBeenCalled()
    expect(openInspector).not.toHaveBeenCalled()
  })

  it('RECONNECT: the same double-click on the title never completes the pending reconnect', async () => {
    const completeReconnect = vi.fn()
    const { title } = mountFlow()
    useCanvasStore.setState({ reconnecting: { edgeId: 'e1', end: 'target' }, completeReconnect } as never)
    doubleClickLikeABrowser(title)
    await afterTheWindow()
    expect(completeReconnect).not.toHaveBeenCalled()
    expect(useCanvasStore.getState().reconnecting).toEqual({ edgeId: 'e1', end: 'target' })
  })

  it('a LONE click on the title still does what a card click does: once, for this card, after the window', async () => {
    const { onNodeClick, openInspector, title } = mountFlow()
    fireEvent.click(title, { detail: 1 })
    expect(onNodeClick).not.toHaveBeenCalled() // held for the double-click window
    await afterTheWindow()
    expect(onNodeClick).toHaveBeenCalledTimes(1)
    expect(onNodeClick.mock.calls[0][1].id).toBe(ID)
    expect(openInspector).toHaveBeenCalledWith(ID)
  })

  it('a click into the open rename field is the editor\'s: no card action under the user\'s typing', async () => {
    const { onNodeClick, title } = mountFlow()
    doubleClickLikeABrowser(title)
    fireEvent.click(screen.getByTestId('inspector-rename-input'), { detail: 1 })
    await afterTheWindow()
    expect(onNodeClick).not.toHaveBeenCalled()
  })
})
