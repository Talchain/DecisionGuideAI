/**
 * NodeQuickActions — the door to the node's own menu.
 *
 * The invitations this button unburies are "Challenge this", "Explore ▸ Trace
 * to goal" and "Select path to goal", plus "Explain this", Copy and Delete.
 *
 * ⚠ AN EARLIER VERSION OF THIS HEADER ALSO NAMED "Add risk from this", "Add
 * outcome from this" and "Add connected factor". None of the three can render —
 * `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` strips them because
 * `canvasSemanticMutations` is `'disabled'`, test-locked as a permanent audit.
 * The claim was false in shipped source and in this spec, which is the place it
 * does most damage: a comment that overstates what a thing does teaches the
 * next reader to stop checking.
 *
 * Until this button the only ways in were RIGHT-CLICK — which has no equivalent
 * on a touch device — and SHIFT+F10, which nobody discovers.
 *
 * ## What these tests assert, stated precisely
 *
 * That clicking the button emits a `contextmenu` event which REACHES AN
 * ANCESTOR — because that is exactly what React Flow listens for, and it is
 * the whole mechanism. What they do NOT assert is that a menu appears: that
 * needs `ReactFlowGraph`'s handler mounted and is covered by the context-menu
 * specs. Saying so here rather than implying the stronger claim, because "the
 * button opens the menu" and "the button emits the event the menu is bound to"
 * are different statements and only the second is tested at this level.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn(() => undefined),
    { getState: () => ({ nodes: [{ id: 'n1', type: 'factor', data: { label: 'Runway' } }] }) },
  ),
}))
vi.mock('../../../stores/guidanceStore', () => ({
  useGuidanceStore: vi.fn(() => null),
}))
vi.mock('../../../ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

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
    expect(screen.getByTestId('node-action-menu-n1').className).toContain('before:-inset-[2px]')
  })

  it('sits LAST, after the two named shortcuts — overflow, not a third peer', () => {
    renderInHost()
    const row = screen.getByTestId('node-quick-actions-n1')
    const ids = Array.from(row.querySelectorAll('button')).map(b => b.getAttribute('data-testid'))
    expect(ids[ids.length - 1]).toBe('node-action-menu-n1')
  })
})
