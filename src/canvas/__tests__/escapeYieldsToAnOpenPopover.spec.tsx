/**
 * ESCAPE CLOSES THE OPEN POPOVER FIRST — and the canvas selection survives
 * that press (contract v3.1 §01, DESIGN-GAP-AUDIT row 36; independent verifier
 * FIX_NEEDED on `1fa17191`, 25 Sep 2026).
 *
 * The rule under test: while a popover is open, Escape means "close this". The
 * canvas clears focus and selection only on an Escape nothing else is
 * answering. The verifier's attack, reproduced here with the REAL components:
 * open a card's guidance popover (`ScienceIcon`, mounted on the Factor, Option,
 * Goal, Risk and Outcome cards), move focus off its trigger, press Escape — the
 * popover closed AND the selection behind it was thrown away.
 *
 * ⛔⛔ TWO LISTENER ORDERS, BECAUSE THE BROWSER IS NOT jsdom. Each popover
 * closes itself from a `document` keydown listener; the canvas reads "is
 * anything open?" from a `window` keydown listener, which runs AFTER it. For a
 * key press the browser delivers, Chromium runs a microtask checkpoint between
 * those two listeners, and React 18 commits a `createRoot` update in that
 * microtask — so the popover is ALREADY GONE from the DOM when the canvas
 * looks. Witnessed in Chromium (playwright 1.57, React 18.3.1 UMD, a
 * `document` listener closing an `aria-expanded` trigger): a real
 * `keyboard.press('Escape')` read `window-capture: "true"`,
 * `window-bubble: "false"`; the same press sent by `dispatchEvent` read
 * `"true"` at both. A spec that only dispatches from script — every spec in
 * this repo — sees the popover still open and passes a guard that fails in the
 * browser. `pressAsTheBrowserDelivers` puts that checkpoint back: a `document`
 * listener registered AFTER the popover's own runs `flushSync`, which is what
 * the microtask does.
 *
 * Drives the REAL hook, the REAL canvas store, the REAL `ScienceIcon` and the
 * REAL visual key (`CanvasLegendPopover`). Bound by identity: node
 * `n-selected`, edge `e-selected`, the store's `selection` sets, the trigger's
 * `data-testid`, the popover's dialog name.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, renderHook, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { flushSync } from 'react-dom'
import type { Edge, Node } from '@xyflow/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useCanvasStore } from '../store'
import { useConfirmDialogStore } from '../stores/confirmDialogStore'
import { useGuidanceStore } from '../stores/guidanceStore'
import { ScienceIcon } from '../nodes/shared/ScienceIcon'
import { CanvasLegendPopover } from '../components/CanvasLegendPopover'
import type { EdgeData } from '../domain/edges'

const SELECTED_NODE = 'n-selected'
const OTHER_NODE = 'n-other'
const SELECTED_EDGE = 'e-selected'
const GUIDANCE = 'Status quo bias: inaction risks often underestimated.'
/** The glyph is irrelevant here; `ScienceIcon`'s `icon` prop type is not `LucideIcon`. */
const GuidanceGlyph = ({ size, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} className={className} aria-hidden="true" />
)

function node(id: string, selected: boolean): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id }, selected }
}

function seedSelection(): void {
  useCanvasStore.setState({
    nodes: [node(SELECTED_NODE, true), node(OTHER_NODE, false)],
    edges: [{ id: SELECTED_EDGE, source: SELECTED_NODE, target: OTHER_NODE, data: {} as EdgeData, selected: true } as Edge<EdgeData>],
    selection: {
      nodeIds: new Set([SELECTED_NODE]),
      edgeIds: new Set([SELECTED_EDGE]),
      anchorPosition: { x: 1, y: 1 },
    },
  } as never)
}

function isIntact(): boolean {
  const s = useCanvasStore.getState()
  return (
    s.selection.nodeIds.has(SELECTED_NODE) &&
    s.selection.edgeIds.has(SELECTED_EDGE) &&
    s.nodes.find((n) => n.id === SELECTED_NODE)?.selected === true &&
    s.edges.find((e) => e.id === SELECTED_EDGE)?.selected === true
  )
}

function isCleared(): boolean {
  const s = useCanvasStore.getState()
  return (
    s.selection.nodeIds.size === 0 &&
    s.selection.edgeIds.size === 0 &&
    s.nodes.find((n) => n.id === SELECTED_NODE)?.selected === false &&
    s.edges.find((e) => e.id === SELECTED_EDGE)?.selected === false
  )
}

function escapeEvent(): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
}

/** As a script dispatches it: no checkpoint between listeners (jsdom's only mode). */
function pressAsAScriptDispatches(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(escapeEvent())
  })
}

/**
 * As the browser delivers it: the microtask checkpoint Chromium runs after the
 * popover's own `document` listener, in which React commits the close. Must be
 * called AFTER the popover opened, so this listener is registered after its.
 */
function pressAsTheBrowserDelivers(target: EventTarget): void {
  const microtaskCheckpoint = () => flushSync(() => {})
  document.addEventListener('keydown', microtaskCheckpoint)
  try {
    act(() => {
      target.dispatchEvent(escapeEvent())
    })
  } finally {
    document.removeEventListener('keydown', microtaskCheckpoint)
  }
}

const ORDERS = [
  ['as the browser delivers it', pressAsTheBrowserDelivers],
  ['as a script dispatches it', pressAsAScriptDispatches],
] as const

/** A card's guidance icon with a sibling control on the same card. */
function renderCardWithGuidance(): { trigger: HTMLElement; sibling: HTMLElement } {
  render(
    <div data-testid="card">
      <ScienceIcon icon={GuidanceGlyph} tooltip={GUIDANCE} action="What could go wrong with doing nothing?" colour="text-warning" />
      <button type="button" data-testid="card-sibling-control">Edit</button>
    </div>,
  )
  return { trigger: screen.getByTestId('science-icon-trigger'), sibling: screen.getByTestId('card-sibling-control') }
}

const guidancePopover = () => screen.queryByRole('dialog', { name: 'Guidance detail' })

beforeEach(() => {
  seedSelection()
  useConfirmDialogStore.setState({ pending: null } as never)
  useGuidanceStore.setState({ _sendMessage: null })
  renderHook(() => useKeyboardShortcuts())
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  useConfirmDialogStore.setState({ pending: null } as never)
  useGuidanceStore.setState({ _sendMessage: null })
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})

describe('a card’s guidance popover (ScienceIcon) owns the Escape that closes it', () => {
  it('the trigger announces the dialog it opens (`aria-haspopup="dialog"`), so an open one is visible to the page', () => {
    const { trigger } = renderCardWithGuidance()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })

  describe.each(ORDERS)('%s', (_order, press) => {
    it('⭐ popover open, focus on the page: Escape closes it and KEEPS the selection', () => {
      const { trigger } = renderCardWithGuidance()
      fireEvent.click(trigger)
      expect(guidancePopover()).not.toBeNull()
      ;(document.activeElement as HTMLElement | null)?.blur()
      expect(document.activeElement).toBe(document.body)

      press(document.body)

      expect(guidancePopover()).toBeNull()
      expect(isIntact()).toBe(true)
    })

    it('⭐ popover open, focus Tabbed to a sibling control on the card: Escape closes it and KEEPS the selection', () => {
      const { trigger, sibling } = renderCardWithGuidance()
      fireEvent.click(trigger)
      expect(guidancePopover()).not.toBeNull()
      sibling.focus()
      expect(document.activeElement).toBe(sibling)

      press(sibling)

      expect(guidancePopover()).toBeNull()
      expect(isIntact()).toBe(true)
    })

    it('⭐ popover open, focus on its own trigger: Escape closes it and KEEPS the selection', () => {
      const { trigger } = renderCardWithGuidance()
      fireEvent.click(trigger)
      trigger.focus()
      expect(document.activeElement).toBe(trigger)

      press(trigger)

      expect(guidancePopover()).toBeNull()
      expect(isIntact()).toBe(true)
    })

    it('⭐ the NEXT Escape, with the popover closed, clears the selection', () => {
      const { trigger } = renderCardWithGuidance()
      fireEvent.click(trigger)
      press(document.body)
      expect(isIntact()).toBe(true)

      press(document.body)
      expect(isCleared()).toBe(true)
    })

    it('CONTRAST: the guidance icon on the card with its popover CLOSED does not hold the key', () => {
      renderCardWithGuidance()
      expect(guidancePopover()).toBeNull()

      press(document.body)

      expect(isCleared()).toBe(true)
    })
  })
})

describe('the visual key (CanvasLegendPopover) owns the Escape that closes it', () => {
  const legend = () => screen.queryByTestId('canvas-legend-popover')

  describe.each(ORDERS)('%s', (_order, press) => {
    it('⭐ key open, focus on the page: Escape closes it and KEEPS the selection', () => {
      render(<CanvasLegendPopover />)
      fireEvent.click(screen.getByTestId('btn-canvas-legend'))
      expect(legend()).not.toBeNull()
      ;(document.activeElement as HTMLElement | null)?.blur()

      press(document.body)

      expect(legend()).toBeNull()
      expect(isIntact()).toBe(true)
    })

    it('CONTRAST: the key’s trigger on the page with the key CLOSED does not hold the key', () => {
      render(<CanvasLegendPopover />)
      expect(legend()).toBeNull()

      press(document.body)

      expect(isCleared()).toBe(true)
    })
  })
})
