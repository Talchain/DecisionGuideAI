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
import { CANVAS_CORNER_INSET_CLASSES, CANVAS_QUICK_ACTION_INSET_PX } from '../canvasGlyphScale'

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

  it('offers Ask, Challenge and More with accessible names naming the element', () => {
    useGuidanceStore.setState({ _sendMessage: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    expect(screen.getByRole('button', { name: 'Ask Olumi about Hiring spend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Challenge Hiring spend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More actions for Hiring spend' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
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
    // More stays available even without an AI channel.
    expect(screen.getByTestId('node-action-menu-node-a')).toBeInTheDocument()
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
    for (const id of ['node-action-ask-node-a', 'node-action-menu-node-a']) {
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

    // ⚠ ASSERTED THROUGH THE SHARED CONSTANT, NOT THROUGH A TAILWIND SPELLING.
    // This read `toContain('bottom-1.5')` — a hand-copy of the class literal,
    // which pinned HOW the inset is spelled rather than WHICH CORNER it claims.
    // The inset is now a keyed map so the card's bottom band can be derived
    // from it (`NODE_QUICK_ACTION_BAND_PX`), and the spelling changed to
    // `bottom-[6px]` with the corner and the px both unchanged — so the old
    // assertion failed on a change it has no opinion about, while an actual
    // move to `bottom-3` would have passed a `toContain('bottom-')`. Binding to
    // the constant means this cannot fail for a rename and cannot pass for a
    // move (CLAUDE.md trap 19: bind by identity, not by a predicate something
    // else could satisfy).
    expect(el.className).toContain(CANVAS_CORNER_INSET_CLASSES[CANVAS_QUICK_ACTION_INSET_PX])
    // …and the constant really does claim the bottom-right corner, so the
    // assertion above cannot be satisfied by a map entry that stopped doing so.
    expect(CANVAS_CORNER_INSET_CLASSES[CANVAS_QUICK_ACTION_INSET_PX]).toMatch(/(^|\s)bottom-/)
    expect(CANVAS_CORNER_INSET_CLASSES[CANVAS_QUICK_ACTION_INSET_PX]).toMatch(/(^|\s)right-/)
    // The defect, stated exactly: any top anchor puts it back in the band.
    expect(el.className).not.toMatch(/(^|\s)-?top-/)
  })
})

/**
 * ⭐⭐ THE MIRROR THIS LAYER INTRODUCED, AND THE DERIVATION THAT CLOSES IT.
 *
 * `CANVAS_CORNER_INSET_CLASSES` is read TWO ways, and they have to agree:
 *   · the DOM gets the STRING —
 *     `CANVAS_CORNER_INSET_CLASSES[CANVAS_QUICK_ACTION_INSET_PX]` →
 *     `bottom-[6px] right-[6px]`, which is what POSITIONS the row;
 *   · `NODE_QUICK_ACTION_BAND_PX` gets the KEY — `CANVAS_QUICK_ACTION_INSET_PX`
 *     → `6`, which is what the card RESERVES against.
 *
 * Nothing above asserts the value spells its key, and the assertions in the
 * block above cannot: `toContain(CANVAS_CORNER_INSET_CLASSES[…])` compares the
 * class string TO ITSELF, and the `bottom-`/`right-` twins pin the CORNER, not
 * the px. Measured, not argued: setting the map value to
 * `bottom-[10px] right-[10px]` while leaving the key at `6` — so the row renders
 * 10px from the edge while the card reserves for 6 — left this file 11/11 GREEN.
 *
 * That is the hand-maintained mirror `canvasGlyphScale.ts` exists to abolish
 * (CLAUDE.md trap 12/12d), reintroduced inside the file written to abolish it.
 * The sibling map `CANVAS_GLYPH_SIZE_CLASSES` already carries exactly this guard
 * — "the size map spells exactly the px each key claims" — and the new map got
 * the mirror without it.
 *
 * ⚠ IT LIVES HERE, in this layer's own spec, deliberately. A bound in
 * `canvasGlyphTargetScale.spec.tsx` happens to catch this drift too, but a guard
 * that exists only in a sibling is not this change's coverage and the sibling
 * could be reverted.
 */
describe('NodeQuickActions — the corner inset map cannot drift from the band it feeds', () => {
  it('the inset map spells exactly the px each key claims', () => {
    const entries = Object.entries(CANVAS_CORNER_INSET_CLASSES)

    // Non-vacuity first: an EMPTY map satisfies every assertion in the loop
    // below, so the loop is evidence only once it is known to have run
    // (CLAUDE.md trap 13 — an absence-shaped check needs to prove it can see).
    expect(entries.length, 'the inset map is empty — the loop below asserts nothing').toBeGreaterThan(0)

    for (const [key, value] of entries) {
      // Exact string, never a substring. That is what makes this bite on a px
      // that disagrees with its key, AND on an inset that quietly acquired the
      // `calc(… * var(--canvas-label-scale))` its neighbours carry — which
      // `NODE_QUICK_ACTION_BAND_PX` does not model and its header argues at
      // length that it must not.
      expect(value, `inset map key ${key} does not spell ${key}px`).toBe(
        `bottom-[${key}px] right-[${key}px]`,
      )
    }

    // …and the key the reservation actually derives from is one the map
    // carries, so the loop above covered the entry the band depends on rather
    // than some other entry that happens to be self-consistent.
    expect(entries.map(([key]) => Number(key))).toContain(CANVAS_QUICK_ACTION_INSET_PX)
  })
})
