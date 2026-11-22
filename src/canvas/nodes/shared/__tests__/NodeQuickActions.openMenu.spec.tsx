/**
 * NodeQuickActions — the door to the node's own menu.
 *
 * The invitations this button unburies are "Challenge this", "Explore ▸ Trace
 * to goal" and "Select path to goal", plus "Explain this", Copy and Delete.
 *
 * ⚠⚠ AND THREE MORE, AS OF 18 Sep 2026: "Add connected factor", "Add outcome
 * from this" and "Add risk from this". An earlier version of this header named
 * them; a correction then struck them on the grounds that
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` stripped all three because
 * `canvasSemanticMutations` is `'disabled'`, "test-locked as a permanent audit".
 * **The strike has itself gone stale.** CEE #1443 shipped the
 * `structural_add_edge` writer, the three ids now sit in
 * `CONNECTED_NODE_ADD_MENU_IDS` judged by the two carriers they use, and they
 * render and are actionable on every non-constraint node
 * (`contextMenu/__tests__/connectedAddDurableDoor.spec.tsx`). Both the
 * over-claim and the over-correction are left visible: a comment that overstates
 * what a thing does teaches the next reader to stop checking, and so does one
 * that understates it.
 *
 * Until this button the only ways in were RIGHT-CLICK — which has no equivalent
 * on a touch device — and SHIFT+F10, which nobody discovers.
 *
 * ## What these tests assert, stated precisely
 *
 * That clicking the button emits a `contextmenu` event which REACHES AN
 * ANCESTOR — because that is exactly what React Flow listens for, and it is
 * the whole mechanism. The integration fixture also mounts the real canvas
 * menu and exercises dismissal through the opener and Escape.
 */
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CanvasContextMenu } from '../../../contextMenu/CanvasContextMenu'
import { contextMenuOpener, type ContextTarget } from '../../../contextMenu/types'
import { NodeQuickActions } from '../NodeQuickActions'

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn(() => undefined),
    { getState: () => ({ nodes: [{ id: 'n1', type: 'factor', data: { label: 'Runway' } }] }) },
  ),
}))
vi.mock('../../../stores/guidanceStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../stores/guidanceStore')>()),
  useGuidanceStore: vi.fn(() => null),
}))
vi.mock('../../../ToastContext', () => ({ useShowToast: () => vi.fn(), useShowToastSafe: () => vi.fn() }))
vi.mock('../../../hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ proposeFactorValue: vi.fn() }),
}))

function CanvasMenuHost() {
  const [target, setTarget] = useState<ContextTarget | null>(null)
  return (
    <div onContextMenu={(event) => {
      event.preventDefault()
      setTarget({
        kind: 'node', nodeId: 'n1', nodeType: 'factor',
        node: { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Runway' } },
        screenPos: { x: event.clientX, y: event.clientY }, opener: contextMenuOpener(event),
      })
    }}>
      <NodeQuickActions nodeId="n1" nodeType="factor" label="Runway" alwaysVisible />
      {target && <CanvasContextMenu target={target} onClose={() => setTarget(null)} screenToFlowPosition={(p) => p} />}
    </div>
  )
}

const renderInHost = () => {
  const onContextMenu = vi.fn((e: Event) => e.preventDefault())
  const { container } = render(
    <div data-testid="host">
      <NodeQuickActions nodeId="n1" nodeType="factor" label="Runway" alwaysVisible />
    </div>,
  )
  // The listener goes on the ANCESTOR, which is where React Flow's own
  // `onNodeContextMenu` effectively sits. A listener on the button itself would
  // pass even for a non-bubbling event — i.e. for the dead-control case this
  // test exists to rule out.
  const host = container.querySelector('[data-testid="host"]') as HTMLElement
  host.addEventListener('contextmenu', onContextMenu)
  return { onContextMenu }
}

describe('NodeQuickActions — opening the node menu without a right-click', () => {
  // Block bodies, not expression bodies: `vi.clearAllMocks()` RETURNS
  // `VitestUtils`, and a concise arrow makes that the hook's return value —
  // TS2322 against `Awaitable<HookCleanupCallback>`, since a hook's return is
  // read as a cleanup function.
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('renders a menu affordance named for the node', () => {
    renderInHost()
    expect(screen.getByTestId('node-action-menu-n1')).toBeInTheDocument()
    expect(screen.getByLabelText('More actions for Runway')).toBeInTheDocument()
  })

  it('is a real <button>, so tap and keyboard reach it with no key handling of our own', () => {
    renderInHost()
    const btn = screen.getByTestId('node-action-menu-n1')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('emits a contextmenu event that REACHES AN ANCESTOR when clicked', () => {
    const { onContextMenu } = renderInHost()
    fireEvent.click(screen.getByTestId('node-action-menu-n1'))
    expect(onContextMenu).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the actual node action opener when the canvas menu closes on Escape', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    render(<CanvasMenuHost />)
    const opener = screen.getByTestId('node-action-menu-n1')
    fireEvent.click(opener)
    const firstRow = screen.getByRole('menuitem', { name: 'Open details' })
    expect(document.activeElement).toBe(firstRow)
    fireEvent.keyDown(firstRow, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('keeps the canvas menu open on opener pointer-down and closes it on the click', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    render(<CanvasMenuHost />)
    const opener = screen.getByTestId('node-action-menu-n1')
    fireEvent.click(opener)
    const menu = screen.getByRole('menu', { name: 'Canvas context menu' })
    fireEvent.pointerDown(opener.querySelector('svg')!)
    expect(screen.getByRole('menu', { name: 'Canvas context menu' })).toBe(menu)
    fireEvent.click(opener)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(opener)
    expect(screen.getByRole('menu', { name: 'Canvas context menu' })).toBeInTheDocument()
  })

  it('the emitted event BUBBLES — the property the whole mechanism rests on', () => {
    // React attaches its listeners at the root container, so a non-bubbling
    // dispatch reaches nothing and the button is silently inert. That failure
    // is invisible from the button's own element, which is why the assertion
    // above listens on the ancestor and this one checks the flag directly.
    const { onContextMenu } = renderInHost()
    fireEvent.click(screen.getByTestId('node-action-menu-n1'))
    const evt = onContextMenu.mock.calls[0][0] as MouseEvent
    expect(evt.bubbles).toBe(true)
    expect(evt.cancelable).toBe(true)
  })

  it('carries the button’s own coordinates, so the menu opens where the pointer is', () => {
    const { onContextMenu } = renderInHost()
    const btn = screen.getByTestId('node-action-menu-n1')
    // jsdom has no layout, so a real rect is 0×0 — the claim under test is that
    // the handler READS the button's rect and passes it through, not that the
    // numbers are non-zero. Stubbing the rect is what makes that observable.
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
      right: 412, bottom: 271, left: 0, top: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect)
    fireEvent.click(btn)
    const evt = onContextMenu.mock.calls[0][0] as MouseEvent
    expect(evt.clientX).toBe(412)
    expect(evt.clientY).toBe(271)
  })

  it('does not select or drag the node on the way — the click is stopped', () => {
    const onClick = vi.fn()
    const { container } = render(
      <div onClick={onClick}>
        <NodeQuickActions nodeId="n1" nodeType="factor" label="Runway" alwaysVisible />
      </div>,
    )
    fireEvent.click(container.querySelector('[data-testid="node-action-menu-n1"]') as HTMLElement)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('announces that a menu follows', () => {
    renderInHost()
    const btn = screen.getByTestId('node-action-menu-n1')
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    // ⛔ And NOT `aria-expanded`: the button dispatches an event and does not
    // own the menu's open state, so it could not keep that attribute truthful.
    // A stale `aria-expanded` is worse than none.
    expect(btn).not.toHaveAttribute('aria-expanded')
  })

  it('carries a hit-area expander, so the 20px visual is a 24px target', () => {
    // ⚠ SCOPE: jsdom applies no Tailwind stylesheet, so this asserts the CLASS
    // is present, not the computed box — a hand-maintained mirror of the class
    // name and nothing more. It guards deletion, which is the realistic
    // failure; the geometry is a browser claim and is not made here.
    renderInHost()
    // ⚠ THE SLOP IS COUNTER-SCALED NOW. `before:-inset-[2px]` reached the user
    // as 1px per side inside React Flow's viewport transform, so the literal
    // this used to assert was never the thing the user got. The size invariant
    // itself lives in `canvasGlyphTargetScale.spec.tsx`, in RENDERED px; this
    // only needs the expansion to still be present on this button.
    expect(screen.getByTestId('node-action-menu-n1').className).toContain(
      'before:-inset-[calc(2px*var(--canvas-glyph-scale,1))]',
    )
  })

  it('sits LAST, after the two named shortcuts — overflow, not a third peer', () => {
    renderInHost()
    const row = screen.getByTestId('node-quick-actions-n1')
    const ids = Array.from(row.querySelectorAll('button')).map(b => b.getAttribute('data-testid'))
    expect(ids[ids.length - 1]).toBe('node-action-menu-n1')
  })
})
