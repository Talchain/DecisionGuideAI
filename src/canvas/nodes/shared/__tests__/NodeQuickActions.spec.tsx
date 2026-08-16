/**
 * R5 (Paul, 16 Aug 2026) — the contextual efficiency layer, and the seam it
 * replaces.
 *
 * Two claims are under test here and they are different claims:
 *
 * 1. The actions REACH something. The control they replace (the on-node Edit
 *    pencil) wrote the store field `showInspectorPanel`, which has zero render
 *    consumers repo-wide — so it looked like the way to open a node's details
 *    and opened nothing. `openNodeInspector` selects the node and dispatches
 *    `olumi:open-full-inspector`, the event ReactFlowGraph actually listens
 *    for, and fail-closes on a node that is not on the graph.
 * 2. They reach THIS element. Binding is by node id, asserted with a
 *    discriminating pair — clicking node-a's control must act on node-a AND
 *    must not act on node-b. A single biting assertion proves sensitivity to
 *    something; the pair proves sensitivity to the named object.
 *
 * jsdom cannot prove "quiet at rest": opacity classes are asserted as classes,
 * not as pixels. A browser witness must confirm the actions are invisible until
 * hover/focus/selection and legible when revealed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { openNodeInspector } from '../openNodeInspector'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const NODE_A = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }
const NODE_B = { id: 'node-b', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team productivity' } }

function seedGraph() {
  useCanvasStore.setState({ nodes: [NODE_A, NODE_B] } as never)
}

describe('openNodeInspector — the live inspector seam', () => {
  beforeEach(() => {
    seedGraph()
  })

  it('selects the node and raises the inspector via the event the canvas listens for', () => {
    let opened = 0
    const onOpen = () => { opened += 1 }
    window.addEventListener('olumi:open-full-inspector', onOpen)

    expect(openNodeInspector('node-a')).toBe(true)

    expect(useCanvasStore.getState().selection.nodeIds.has('node-a')).toBe(true)
    expect(opened).toBe(1)
    window.removeEventListener('olumi:open-full-inspector', onOpen)
  })

  /**
   * Deliberately the SECOND node. Measured: with node-a (the first in the
   * graph) a mutant that ignores the argument and selects `nodes[0]` survived
   * — the fixture, not the code, was supplying the right answer. Binding by
   * identity means the test must fail for any node the argument does not name,
   * including the one that happens to be first.
   */
  it('binds to the named node — the discriminating half', () => {
    openNodeInspector('node-b')
    const selected = useCanvasStore.getState().selection.nodeIds
    expect(selected.has('node-b')).toBe(true)
    expect(selected.has('node-a')).toBe(false)
  })

  it('fail-closes on a node that is not on the graph, and opens nothing', () => {
    let opened = 0
    const onOpen = () => { opened += 1 }
    window.addEventListener('olumi:open-full-inspector', onOpen)

    expect(openNodeInspector('node-that-never-existed')).toBe(false)
    expect(opened).toBe(0)

    window.removeEventListener('olumi:open-full-inspector', onOpen)
  })
})

describe('NodeQuickActions — R5 efficiency layer', () => {
  beforeEach(() => {
    seedGraph()
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null } as never)
  })

  it('offers exactly the two ruled actions, each with an accessible name naming the element', () => {
    useGuidanceStore.setState({ _sendMessage: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    expect(screen.getByRole('button', { name: 'Ask Olumi about Hiring spend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open details for Hiring spend' })).toBeInTheDocument()
  })

  it('opens THIS node\'s inspector, not another node\'s (discriminating pair)', () => {
    render(
      <>
        <NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />
        <NodeQuickActions nodeId="node-b" nodeType="factor" label="Team productivity" />
      </>,
    )
    // node-b, not node-a: see the note above — a positional mutant passes
    // trivially when the target is the first node in the graph.
    fireEvent.click(screen.getByTestId('node-action-inspect-node-b'))

    const selected = useCanvasStore.getState().selection.nodeIds
    expect(selected.has('node-b')).toBe(true)
    expect(selected.has('node-a')).toBe(false)
  })

  it('routes "ask about this" through the existing selection→conversation machinery', () => {
    const sendMessage = vi.fn()
    useGuidanceStore.setState({ _sendMessage: sendMessage } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    fireEvent.click(screen.getByTestId('node-action-ask-node-a'))

    // askAI selects the element FIRST so the turn carries selected_elements —
    // that ordering is the whole reason to reuse it rather than send raw text.
    expect(useCanvasStore.getState().selection.nodeIds.has('node-a')).toBe(true)
  })

  it('does not render a dead ask button when no conversation channel is registered', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    expect(screen.queryByTestId('node-action-ask-node-a')).toBeNull()
    // …but the inspector action does not depend on the conversation, so it stays.
    expect(screen.getByTestId('node-action-inspect-node-a')).toBeInTheDocument()
  })

  /**
   * The gate must ask the question `askAI` asks. `askAI` polls for
   * `_sendMessage`; a gate of `_sendMessage || _prefillChat` would show the
   * button on a surface that registered only the prefill channel — a control
   * that renders and cannot do its job, which is what the gate exists to
   * prevent. Trap 21: two predicates wearing one name.
   */
  it('gates on the SEND channel askAI needs, not on prefill', () => {
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    expect(screen.queryByTestId('node-action-ask-node-a')).toBeNull()
  })

  it('is quiet at rest and revealed by hover, focus-within and selection', () => {
    const { rerender } = render(
      <NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />,
    )
    const rest = screen.getByTestId('node-quick-actions-node-a')
    expect(rest.className).toContain('opacity-0')
    // Every reveal channel present: pointer, keyboard, touch.
    expect(rest.className).toContain('group-hover:opacity-100')
    expect(rest.className).toContain('group-focus-within:opacity-100')
    expect(rest.className).toContain('[@media(pointer:coarse)]:opacity-100')

    rerender(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" alwaysVisible />)
    const selected = screen.getByTestId('node-quick-actions-node-a')
    expect(selected.className).toContain('opacity-100')
    expect(selected.className).not.toContain('opacity-0')
  })

  it('keeps the buttons in the tab order at rest (opacity, never display:none)', () => {
    useGuidanceStore.setState({ _sendMessage: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    // Native buttons, no tabIndex=-1, no hidden attribute: reachable by Tab
    // even before they are visible, which is what gives the hover actions
    // their keyboard equivalent.
    for (const id of ['node-action-ask-node-a', 'node-action-inspect-node-a']) {
      const btn = screen.getByTestId(id)
      expect(btn.tagName).toBe('BUTTON')
      expect(btn).not.toHaveAttribute('tabindex', '-1')
      expect(btn).not.toHaveAttribute('hidden')
      expect(btn.className).toContain('focus-visible:ring-2')
    }
  })
})

/**
 * Geometry pin (review item: CORNER COLLISION).
 *
 * The node's TOP-right is an owned band — `node-corner-stack` sits at
 * `-top-2 -right-2 z-10` and exists because three badges used to collide there
 * (a browser-confirmed P2 fix). This layer first shipped at `top-1.5 right-1.5
 * z-[2]`: inside that band by roughly 6px AND at a lower z, so the stack
 * painted over the buttons whenever a rank badge, freshness dot or coaching
 * marker was present.
 *
 * jsdom cannot measure the overlap — no layout. What it CAN do is pin the
 * corner these classes claim, so the collision cannot be reintroduced silently.
 * A browser witness must still confirm the buttons are clear of both the corner
 * stack and the Confirm icon on a node that shows all of them.
 */
describe('NodeQuickActions — stays out of the owned top-right corner', () => {
  it('anchors to the BOTTOM-right, never the top', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const el = screen.getByTestId('node-quick-actions-node-a')

    expect(el.className).toContain('bottom-1.5')
    expect(el.className).toContain('right-1.5')
    // The defect, stated exactly: any top anchor puts it back in the band.
    expect(el.className).not.toMatch(/(^|\s)-?top-/)
  })
})
