/**
 * A CLICK ON THE EMPTY CANVAS CLEARS SELECTION — contract v3.1 §01 (DESIGN-GAP-
 * AUDIT row 36, chrome cluster, 25 Sep 2026). VERIFIED, NOT ADDED.
 *
 * The gap audit noted `ReactFlowGraph.tsx` has no `onPaneClick` and asked
 * whether React Flow 12's default already clears the selection in THIS app's
 * configuration, before anything is written. It does — measured here, and the
 * library path is:
 *
 *   `@xyflow/react@12.10.2` `Pane` — hand mode wires `onClick` on the pane
 *   container; select mode (`selectionOnDrag` + `panOnDrag: [1]`) routes a
 *   click through `onPointerDownCapture` → `onPointerUp` → `onClick`. Either
 *   way `onClick` calls `resetSelectedElements()`, which emits `select: false`
 *   changes through `onNodesChange` / `onEdgesChange` — the same handlers the
 *   canvas wires straight to the store, which reconciles `selection` from the
 *   `selected` flags. `onPaneClick` is an optional EXTRA callback, not the
 *   mechanism, so its absence is not a defect and none is added.
 *
 * ⚠ THE CONFIGURATION IS READ FROM `ReactFlowGraph.tsx`, NOT RESTATED. The
 * values that decide which pane path runs (`PANE_CLICK_DISTANCE`,
 * `SELECT_MODE_PAN_BUTTONS`, the mode → `selectionOnDrag` / `panOnDrag` wiring,
 * and the absence of `elementsSelectable={false}`) are parsed from the source
 * with a positive control, so a change there re-runs this verification against
 * the new values instead of against a copy.
 *
 * ⚠ SCOPE: this is jsdom. It proves the library path and the store wiring; it
 * does not measure a browser. The full `<ReactFlowGraph>` is not mounted (the
 * repo mounts a real `<ReactFlow>` the same way in
 * `registry.keyboardScope.mount.spec.tsx`).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ReactFlow, ReactFlowProvider, SelectionMode, type Edge, type Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import type { EdgeData } from '../domain/edges'

const GRAPH_SRC = readFileSync(join(__dirname, '..', 'ReactFlowGraph.tsx'), 'utf8')

const PANE_CLICK_DISTANCE = Number(/const PANE_CLICK_DISTANCE = (\d+)/.exec(GRAPH_SRC)?.[1])
const SELECT_MODE_PAN_BUTTONS = JSON.parse(/const SELECT_MODE_PAN_BUTTONS = (\[[\d,\s]*\])/.exec(GRAPH_SRC)?.[1] ?? 'null') as number[] | null
/**
 * The opening tag of the ONE live `<ReactFlow>` — the element wired to the store
 * handlers. The file also renders handler-less `<ReactFlow>`s for its debug
 * modes, so the element is found BY its `onNodesChange` wiring, and the count
 * of such elements is pinned to one below.
 */
const LIVE_FLOW_HANDLER = 'onNodesChange={handleNodesChange}'
const LIVE_FLOW_PROPS = (() => {
  const at = GRAPH_SRC.indexOf(LIVE_FLOW_HANDLER)
  if (at < 0) return ''
  const start = GRAPH_SRC.lastIndexOf('<ReactFlow', at)
  const end = GRAPH_SRC.indexOf('\n          >\n', start)
  return start < 0 || end < 0 ? '' : GRAPH_SRC.slice(start, end)
})()

const SELECTED_NODE = 'n-selected'
const OTHER_NODE = 'n-other'
const SELECTED_EDGE = 'e-selected'

function seed(): void {
  useCanvasStore.setState({
    nodes: [
      { id: SELECTED_NODE, position: { x: 0, y: 0 }, data: { label: 'A' }, selected: true },
      { id: OTHER_NODE, position: { x: 300, y: 0 }, data: { label: 'B' }, selected: false },
    ] as Node[],
    edges: [{ id: SELECTED_EDGE, source: SELECTED_NODE, target: OTHER_NODE, data: {} as EdgeData, selected: true }] as Edge<EdgeData>[],
    selection: { nodeIds: new Set([SELECTED_NODE]), edgeIds: new Set([SELECTED_EDGE]), anchorPosition: { x: 1, y: 1 } },
  } as never)
}

/** The canvas's wiring, as `ReactFlowGraph` writes it: store in, store handlers out. */
function StoreFlow({ mode }: { mode: 'select' | 'hand' }) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={(c) => useCanvasStore.getState().onNodesChange(c)}
      onEdgesChange={(c) => useCanvasStore.getState().onEdgesChange(c as never)}
      onSelectionChange={(p) => useCanvasStore.getState().onSelectionChange(p as never)}
      selectionOnDrag={mode === 'select'}
      selectionMode={SelectionMode.Partial}
      multiSelectionKeyCode={['Meta', 'Control']}
      deleteKeyCode={null}
      panOnDrag={mode === 'hand' ? true : SELECT_MODE_PAN_BUTTONS!}
      paneClickDistance={PANE_CLICK_DISTANCE}
    />
  )
}

function mountFlow(mode: 'select' | 'hand'): HTMLElement {
  const { container } = render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <StoreFlow mode={mode} />
      </div>
    </ReactFlowProvider>,
  )
  const pane = container.querySelector<HTMLElement>('.react-flow__pane')
  expect(pane, 'React Flow did not render its pane — nothing below measures anything').not.toBeNull()
  return pane!
}

function selectionState() {
  const s = useCanvasStore.getState()
  return {
    nodeIds: [...s.selection.nodeIds],
    edgeIds: [...s.selection.edgeIds],
    nodeFlag: s.nodes.find((n) => n.id === SELECTED_NODE)?.selected,
    edgeFlag: s.edges.find((e) => e.id === SELECTED_EDGE)?.selected,
  }
}

const INTACT = { nodeIds: [SELECTED_NODE], edgeIds: [SELECTED_EDGE], nodeFlag: true, edgeFlag: true }
const CLEARED = { nodeIds: [], edgeIds: [], nodeFlag: false, edgeFlag: false }

/** A primary-button click as a pointer sequence, which is what select mode listens to. */
function pointerClick(target: HTMLElement): void {
  fireEvent.pointerDown(target, { button: 0, isPrimary: true, pointerId: 1, clientX: 400, clientY: 300 })
  fireEvent.pointerUp(target, { button: 0, isPrimary: true, pointerId: 1, clientX: 400, clientY: 300 })
  fireEvent.click(target, { button: 0, clientX: 400, clientY: 300 })
}

/**
 * ⚠ jsdom 24 HAS NO `PointerEvent`, so `fireEvent.pointerDown` would build a
 * bare `Event` with no `button` / `isPrimary` — and React Flow's select-mode
 * pane path returns early on exactly those two fields. Without this shim the
 * select-mode arm could not run at all. It is a MouseEvent carrying the three
 * pointer fields React Flow reads, installed only when jsdom lacks the type.
 */
class PointerEventShim extends MouseEvent {
  readonly pointerId: number
  readonly isPrimary: boolean
  readonly pointerType: string
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
    this.isPrimary = init.isPrimary ?? true
    this.pointerType = init.pointerType ?? 'mouse'
  }
}
let installedShim = false

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
  if (!('PointerEvent' in window)) {
    ;(window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventShim
    installedShim = true
  }
})

afterAll(() => {
  if (installedShim) delete (window as unknown as { PointerEvent?: unknown }).PointerEvent
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

describe('the canvas configuration, read from ReactFlowGraph.tsx', () => {
  it('POSITIVE CONTROL: the parsed values are the ones the file declares', () => {
    expect(GRAPH_SRC.split(LIVE_FLOW_HANDLER).length - 1, 'exactly one store-wired <ReactFlow>').toBe(1)
    expect(PANE_CLICK_DISTANCE).toBe(4)
    expect(SELECT_MODE_PAN_BUTTONS).toEqual([1])
    expect(LIVE_FLOW_PROPS).toContain('onNodesChange={handleNodesChange}')
    expect(LIVE_FLOW_PROPS).toContain('onEdgesChange={handleEdgesChange}')
    expect(LIVE_FLOW_PROPS).toContain('selectionOnDrag={canDragSelect}')
    expect(LIVE_FLOW_PROPS).toContain("panOnDrag={effectiveMode === 'hand' ? true : SELECT_MODE_PAN_BUTTONS}")
    expect(LIVE_FLOW_PROPS).toContain(`paneClickDistance={PANE_CLICK_DISTANCE}`)
    expect(GRAPH_SRC).toMatch(/const canDragSelect = effectiveMode === 'select'/)
  })

  it('selection is not switched off, and the store handlers are pass-throughs', () => {
    expect(LIVE_FLOW_PROPS).not.toMatch(/elementsSelectable=/)
    expect(GRAPH_SRC).toMatch(/const handleNodesChange = useCallback\(\(changes: NodeChange\[\]\) => \{\s*useCanvasStore\.getState\(\)\.onNodesChange\(changes\)\s*\}/)
    expect(GRAPH_SRC).toMatch(/const handleEdgesChange = useCallback\(\(changes: EdgeChange\[\]\) => \{\s*useCanvasStore\.getState\(\)\.onEdgesChange\(changes\)\s*\}/)
  })
})

describe('a click on the empty canvas clears the selection (React Flow default, this wiring)', () => {
  it.each(['select', 'hand'] as const)('%s mode: node AND edge selection cleared', (mode) => {
    seed()
    const pane = mountFlow(mode)
    expect(selectionState(), 'precondition').toEqual(INTACT)
    pointerClick(pane)
    expect(selectionState()).toEqual(CLEARED)
  })

  it.each(['select', 'hand'] as const)('CONTRAST (%s mode): a click that lands on the viewport, not the pane itself, clears nothing', (mode) => {
    seed()
    const pane = mountFlow(mode)
    const viewport = pane.querySelector<HTMLElement>('.react-flow__viewport')
    expect(viewport, 'no viewport element to click').not.toBeNull()
    pointerClick(viewport!)
    expect(selectionState()).toEqual(INTACT)
  })
})
