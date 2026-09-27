/**
 * Build train slice D (root R7), D-2 case c3 — a DRAGGED inspector stays clear
 * of the right panel and inside the window, like a freshly opened one.
 *
 * Measured on served UI `507d8ef8` (27 Sep 2026, pricing, 1280x800): the
 * inspector opened at x 466..796 with the dock at 961 (0px overlap). One drag
 * of its header 600px to the right left it at x 1066..1396 — 214px over the
 * dock and 116px past the window — owning 85 of 144 sampled points inside the
 * dock. The drag wrote the raw pointer delta; only the opening placement
 * (`placeInspector`) was clamped.
 *
 * The mounted row drives the real `InspectorModal` drag handlers through the
 * header the router renders, against a dock element whose left edge is the
 * served 961, so reverting the drag's clamp turns it RED.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { DragHandlers } from '../../ui/inspector-v2/types'

vi.mock('../../ui/inspector-v2', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    // The router's header is where the served drag starts; the panels are not under test.
    InspectorRouter: ({ dragHandlers }: { dragHandlers?: DragHandlers }) => (
      <div
        data-testid="inspector-drag-header"
        onPointerDown={dragHandlers?.onPointerDown}
        onPointerMove={dragHandlers?.onPointerMove}
        onPointerUp={dragHandlers?.onPointerUp}
      />
    ),
  }
})

import { InspectorModal, clampInspector, placeInspector } from '../InspectorModal'
import { useCanvasStore } from '../../store'

/**
 * jsdom has no `PointerEvent`: `fireEvent.pointerDown(el, { clientX })` dispatches
 * a bare `Event` with no coordinates. A `MouseEvent` typed `pointer*` carries
 * them, and React routes it to `onPointer*` by its type.
 */
function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', el: Element, clientX: number, clientY: number): void {
  act(() => { fireEvent(el, new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY })) })
}

/** The served geometry (UI `507d8ef8`, 1280x800): panel 330x665, dock from x 961, app bar 51. */
const WINDOW = { width: 1280, height: 800 }
const PANEL = { width: 330, height: 665 }
const DOCK_LEFT = 961
const PAD = 16

describe('D-2 c3 — the bounds rule the drag shares with the opening placement', () => {
  it('⭐ a position past the dock is pulled back to the dock edge, minus the padding', () => {
    // The served drag's resting point: x 1066.
    const p = clampInspector({ at: { x: 1066, y: 67 }, panel: PANEL, viewport: WINDOW, rightLimit: DOCK_LEFT, topLimit: 51 })
    expect(p.x + PANEL.width).toBe(DOCK_LEFT - PAD)
    expect(p.y).toBe(51 + PAD)
  })

  it('CONTRAST — a position already on the free canvas is left exactly where it is', () => {
    const p = clampInspector({ at: { x: 300, y: 90 }, panel: PANEL, viewport: WINDOW, rightLimit: DOCK_LEFT, topLimit: 51 })
    expect(p).toEqual({ x: 300, y: 90 })
  })

  it('the opening placement is unchanged by sharing it (flip left, then clamp)', () => {
    const p = placeInspector({ anchor: { x: 587, y: 400 }, panel: { width: 330, height: 600 }, viewport: WINDOW, rightLimit: 853 })
    expect(p).toEqual({ x: 587 - 330 - 24, y: 100 })
  })
})

describe('D-2 c3 — dragging the mounted inspector', () => {
  let dock: HTMLElement
  const rafOriginal = window.requestAnimationFrame

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: WINDOW.width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: WINDOW.height })
    // Async, as in a browser: the mount's position reset runs BEFORE the placement frame.
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number) as typeof window.requestAnimationFrame
    HTMLElement.prototype.setPointerCapture = () => {}
    HTMLElement.prototype.releasePointerCapture = () => {}
    dock = document.createElement('aside')
    dock.setAttribute('data-testid', 'outputs-dock')
    dock.getBoundingClientRect = () => ({ left: DOCK_LEFT, top: 51, right: WINDOW.width, bottom: WINDOW.height, width: WINDOW.width - DOCK_LEFT, height: 749, x: DOCK_LEFT, y: 51, toJSON: () => ({}) }) as DOMRect
    document.body.appendChild(dock)
    // Every inspector box measures as the served panel.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this === dock) return dock.getBoundingClientRect()
      return { left: 0, top: 0, right: PANEL.width, bottom: PANEL.height, width: PANEL.width, height: PANEL.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    useCanvasStore.setState({
      selection: { nodeIds: new Set(['fac_adoption_friction']), edgeIds: new Set<string>(), anchorPosition: { x: 400, y: 380 } },
    } as never)
  })

  afterEach(() => {
    cleanup()
    dock.remove()
    vi.restoreAllMocks()
    window.requestAnimationFrame = rafOriginal
  })

  it('⭐ a 600px drag to the right stops at the dock, not over it or past the window', async () => {
    render(
      <ReactFlowProvider>
        <InspectorModal nodeId="fac_adoption_friction" edgeId={null} onClose={() => {}} />
      </ReactFlowProvider>,
    )
    await act(async () => { await new Promise(r => setTimeout(r, 5)) }) // the placement frame
    const box = screen.getByRole('dialog', { name: 'Node inspector' })
    expect(box.style.opacity).toBe('1') // placed (not the pre-measure fallback)
    const opened = parseFloat(box.style.left)
    expect(opened + PANEL.width).toBeLessThanOrEqual(DOCK_LEFT - PAD) // opens clear (the existing rule)

    const header = screen.getByTestId('inspector-drag-header')
    // One act() per event: the move handler reads the drag state the down event set.
    pointer('pointerdown', header, opened + 60, 90)
    pointer('pointermove', header, opened + 660, 90)
    pointer('pointerup', header, opened + 660, 90)

    const left = parseFloat(box.style.left)
    expect(left).toBeGreaterThan(opened) // it did move
    expect(left + PANEL.width).toBe(DOCK_LEFT - PAD)
  })

  it('CONTRAST — a small drag on the free canvas moves the panel by exactly the pointer delta', async () => {
    render(
      <ReactFlowProvider>
        <InspectorModal nodeId="fac_adoption_friction" edgeId={null} onClose={() => {}} />
      </ReactFlowProvider>,
    )
    await act(async () => { await new Promise(r => setTimeout(r, 5)) }) // the placement frame
    const box = screen.getByRole('dialog', { name: 'Node inspector' })
    expect(box.style.opacity).toBe('1') // placed (not the pre-measure fallback)
    const opened = { x: parseFloat(box.style.left), y: parseFloat(box.style.top) }
    const header = screen.getByTestId('inspector-drag-header')
    pointer('pointerdown', header, opened.x + 60, opened.y + 18)
    pointer('pointermove', header, opened.x + 20, opened.y + 18 + 30)
    pointer('pointerup', header, opened.x + 20, opened.y + 18 + 30)
    expect(parseFloat(box.style.left)).toBe(opened.x - 40)
    expect(parseFloat(box.style.top)).toBe(Math.min(opened.y + 30, WINDOW.height - PAD - PANEL.height))
  })
})
