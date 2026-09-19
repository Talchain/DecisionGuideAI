/**
 * A NODE POPOVER MAY ONLY BE HELD OPEN BY ITS OWN NODE'S FOCUS.
 *
 * ── THE DEFECT THIS GUARDS ──────────────────────────────────────────────────
 *
 * `usePopoverHover`'s focus guard read `next.closest('[data-node-popover]')`
 * while `NodePopover` wrote the attribute VALUELESS. That is a PREDICATE
 * ANOTHER OBJECT SATISFIES (CLAUDE.md trap 19): every node's popover carries
 * the attribute, so one node's handler read a DIFFERENT node's popover as
 * "inside mine" and held its own popover open while focus sat in the other one.
 *
 * The same defect, by the same mechanism, was measured and fixed on the EDGE
 * popover (`StyledEdge.tsx`, `data-edge-popover={edgeIdKey}`). This is the node
 * half, and the remedy is copied rather than re-invented: the exception is
 * granted BY IDENTITY.
 *
 * ⭐ AND IT WAS REACHABLE, WHICH IS NOT A SHAPE ARGUMENT. Two node popovers
 * open at once is what makes the defect observable, and nothing in the product
 * coordinates the two states: keyboard focus on one node and a pointer hovering
 * another are independent. `the fixture's own precondition` below asserts
 * exactly that, in-test, so no row here can pass because the second popover
 * quietly failed to mount (CLAUDE.md trap 13b — a discriminator must pin its
 * own precondition).
 *
 * ── THE SECOND HOLE: THE MISSING EXIT ───────────────────────────────────────
 *
 * `focusout` bubbles only within its own tree. The popover is portalled to
 * `document.body`, so once focus was inside it, moving focus onward emitted
 * `focusout` from the PORTAL, which never reached the node — and nothing closed
 * the popover. Stale node context stayed on screen as the user moved on.
 *
 * ── HOW FOCUS IS MOVED HERE, AND WHY IT MATTERS ─────────────────────────────
 *
 * ⛔ NOT `fireEvent.focusOut` AT THE NODE. A synthetic dispatch at the element
 * under suspicion exercises that element's listener whether or not the real
 * event would ever have reached it — which is precisely what hid the edge
 * defect, because the missing-exit hole IS "the event does not go there". Every
 * row below moves focus with a real `.focus()` and lets the DOM route the
 * consequences, and asserts `document.activeElement` landed where intended
 * before believing anything that follows.
 *
 * ⛔ NO VISIBILITY, LAYOUT, STACKING OR TAB-ORDER CLAIM IS MADE OR IMPLIED.
 * jsdom cannot host one. "Open" here means exactly "mounted in the DOM", which
 * is what the guard controls.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { createElement, type Ref } from 'react'
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import { usePopoverHover } from '../usePopoverHover'
import { NodePopover } from '../../nodes/shared/NodePopover'

/**
 * The SHIPPED arrangement, reduced to the parts the guard reads.
 *
 * Every product node wrapper does exactly this: `ref={nodeElRef}` plus the three
 * `nodeHandlers` on a positioned div, and `anchorRef={nodeElRef}` on the
 * popover — derived at this tip across all six node types and all eleven
 * `<NodePopover>` call sites. Using a reduced node rather than `FactorNode` keeps
 * this spec pointed at the hook and the popover, which is where the guard lives.
 */
function ProbeNode({ data }: { data: { label: string } }) {
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()
  return createElement(
    'div',
    {
      ref: nodeElRef as Ref<HTMLDivElement>,
      style: { position: 'relative', width: 160, height: 60 },
      onMouseEnter: nodeHandlers.onMouseEnter,
      onMouseLeave: nodeHandlers.onMouseLeave,
      onClick: nodeHandlers.onClick,
    },
    createElement('span', null, data.label),
    createElement(NodePopover, {
      visible: showPopover,
      anchorRef: nodeElRef,
      onMouseEnter: popoverHandlers.onMouseEnter,
      onMouseLeave: popoverHandlers.onMouseLeave,
      // In the props object, not a third `createElement` argument: `children` is
      // a required prop of `NodePopoverProps`, and the gate rejects the
      // positional form. Same shape as `NodePopover.keyboardScope.spec.tsx`.
      children: createElement(
        'button',
        { type: 'button', 'aria-label': `${data.label} control` },
        'act',
      ),
    }),
  )
}
ProbeNode.displayName = 'ProbeNode'

/**
 * Three nodes, and the third is load-bearing for the MUTANT PAIR rather than for
 * any row: widening the guard to admit C's identity must leave the identity rows
 * GREEN, which is what shows they bind to B's identity and not merely to the
 * predicate having been edited.
 */
const NODES: Node[] = [
  { id: 'node-A', type: 'probe', position: { x: 0, y: 0 }, data: { label: 'A' } },
  { id: 'node-B', type: 'probe', position: { x: 400, y: 0 }, data: { label: 'B' } },
  { id: 'node-C', type: 'probe', position: { x: 800, y: 0 }, data: { label: 'C' } },
]

let outside: HTMLButtonElement

function mount() {
  const utils = render(
    createElement(
      ReactFlowProvider,
      null,
      createElement(ReactFlow, { nodes: NODES, edges: [], nodeTypes: { probe: ProbeNode } }),
    ),
  )
  outside = document.createElement('button')
  outside.type = 'button'
  outside.textContent = 'elsewhere'
  document.body.appendChild(outside)
  return utils
}

const rfNode = (c: HTMLElement, id: string): HTMLElement => {
  const el = c.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
  expect(el, `React Flow did not render ${id} — the mount failed and nothing below measures anything`).not.toBeNull()
  return el!
}
/** The div the shipped wrappers hang `nodeHandlers` on. */
const hoverTarget = (node: HTMLElement): HTMLElement =>
  node.querySelector<HTMLElement>('div[style*="position: relative"]')!

/** Which popovers are mounted, named by the control each hosts. */
const openPopovers = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-node-popover]'))
    .map(p => p.querySelector('button')?.getAttribute('aria-label') ?? '(no control)')
    .sort()

const controlIn = (label: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`[data-node-popover] [aria-label="${label} control"]`)
  expect(el, `popover ${label} is not mounted, so its control cannot be focused`).not.toBeNull()
  return el!
}

/** Real focus, then prove it landed. Never trust the move. */
function focusFor(el: HTMLElement, what: string) {
  el.focus()
  expect(document.activeElement, `focus did not land on ${what}`).toBe(el)
}

/** Let the leave timer (100ms) and any pending state flush settle. */
const settle = () => new Promise(r => setTimeout(r, 250))

/** A's popover by keyboard; B's by pointer. Returns once BOTH are mounted. */
async function openAandB(container: HTMLElement) {
  focusFor(rfNode(container, 'node-A'), "node A's focus ring")
  await waitFor(() => expect(openPopovers()).toEqual(['A control']))
  fireEvent.mouseEnter(hoverTarget(rfNode(container, 'node-B')))
  await waitFor(() => expect(openPopovers()).toEqual(['A control', 'B control']), { timeout: 2000 })
}

describe('usePopoverHover: a node popover is held open only by ITS OWN node', () => {
  beforeAll(() => {
    // React Flow measures its container; jsdom reports 0 for everything, and
    // without this no node wrapper renders at all and every row below would
    // pass by rendering nothing.
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 })
  })

  afterEach(() => {
    cleanup()
    outside?.remove()
    document.querySelectorAll('[data-node-popover]').forEach(el => el.remove())
  })

  it('the fixture’s own precondition: TWO node popovers really are mounted at once', async () => {
    const { container } = mount()
    await openAandB(container)
    // If this ever fails, every identity row below is vacuous rather than wrong:
    // there would be no second popover for the guard to confuse with the first.
    expect(document.querySelectorAll('[data-node-popover]')).toHaveLength(2)
  })

  it('CONTRAST: the two popovers carry DIFFERENT identities, and each is its own node’s id', async () => {
    const { container } = mount()
    await openAandB(container)
    const ids = Array.from(document.querySelectorAll<HTMLElement>('[data-node-popover]'))
      .map(p => [p.querySelector('button')?.getAttribute('aria-label'), p.getAttribute('data-node-popover')])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    expect(ids).toEqual([
      ['A control', 'node-A'],
      ['B control', 'node-B'],
    ])
  })

  it('THE IDENTITY HOLE: focus into ANOTHER node’s popover closes this one', async () => {
    const { container } = mount()
    await openAandB(container)
    focusFor(controlIn('B'), "the control inside node B's popover")
    await settle()
    // A's popover must go; B's must stay — focus is inside it.
    expect(openPopovers()).toEqual(['B control'])
  })

  it('THE MISSING EXIT: focus LEAVING this popover closes it', async () => {
    const { container } = mount()
    focusFor(rfNode(container, 'node-A'), "node A's focus ring")
    await waitFor(() => expect(openPopovers()).toEqual(['A control']))

    // Into its OWN popover first — the intended exception, asserted here so the
    // row cannot pass by the popover having closed too early for the wrong
    // reason.
    focusFor(controlIn('A'), "the control inside node A's own popover")
    await settle()
    expect(openPopovers(), 'the intended exception broke: focus inside its own popover closed it').toEqual(['A control'])

    // Now DEPART it. This is the event that never reached the node.
    focusFor(outside, 'a button outside every node and popover')
    await settle()
    expect(openPopovers()).toEqual([])
  })

  it('a FOREIGN [data-node-popover] cannot hold this node’s popover open — by another id, or by none', async () => {
    const { container } = mount()

    for (const foreignId of ['node-C', '']) {
      focusFor(rfNode(container, 'node-A'), "node A's focus ring")
      await waitFor(() => expect(openPopovers()).toEqual(['A control']))

      const foreign = document.createElement('div')
      foreign.setAttribute('data-node-popover', foreignId)
      const bait = document.createElement('button')
      bait.type = 'button'
      // Named, because the decoy is itself a `[data-node-popover]` and so appears
      // in `openPopovers()`. Asserting the decoy is ALL that remains is stricter
      // than asserting an empty list would have been: it shows node A's popover
      // went while the thing that used to hold it open is still standing there.
      bait.setAttribute('aria-label', 'foreign control')
      foreign.appendChild(bait)
      document.body.appendChild(foreign)
      // The bait really is inside something the OLD predicate would have matched.
      expect(bait.closest('[data-node-popover]'), 'the foreign element is not shaped like a popover').toBe(foreign)

      focusFor(bait, `a control inside a foreign popover stamped "${foreignId}"`)
      await settle()
      expect(
        openPopovers(),
        `a popover stamped "${foreignId}" held node A's popover open`,
      ).toEqual(['foreign control'])
      foreign.remove()
    }
  })

  it('CONTROL: the pointer still opens a popover, and leaving still closes it', async () => {
    const { container } = mount()
    const a = rfNode(container, 'node-A')
    fireEvent.mouseEnter(hoverTarget(a))
    await waitFor(() => expect(openPopovers()).toEqual(['A control']), { timeout: 2000 })
    fireEvent.mouseLeave(hoverTarget(a))
    await waitFor(() => expect(openPopovers()).toEqual([]))
  })

  it('POINTER OWNERSHIP outranks a focus departure, and the pointer leaving still closes', async () => {
    /*
     * ⚠ THIS ROW IS A DELIBERATE BEHAVIOUR CHANGE, NOT A PRESERVED ONE, and it
     * REDs at pristine for a different reason than the two holes do. The old
     * guard had no pointer check, so a focus departure closed the popover even
     * while the cursor sat on the card — and with the exit now observed from the
     * portal too, that would leave a hovering user's popover shut with no way to
     * reopen it short of leaving and re-entering. `StyledEdge.tsx` carries the
     * same `pointerWithinRef` guard for the same reason; this matches it.
     */
    const { container } = mount()
    const a = rfNode(container, 'node-A')
    fireEvent.mouseEnter(hoverTarget(a))
    await waitFor(() => expect(openPopovers()).toEqual(['A control']), { timeout: 2000 })
    focusFor(a, "node A's focus ring")
    await settle()
    expect(openPopovers(), 'focusing the hovered node closed its own popover').toEqual(['A control'])

    focusFor(outside, 'a button outside every node and popover')
    await settle()
    expect(openPopovers(), 'the pointer still owns this node — its leave handler closes it, not focus').toEqual(['A control'])

    fireEvent.mouseLeave(hoverTarget(a))
    await waitFor(() => expect(openPopovers()).toEqual([]))
  })

  it('CONTROL: Escape still closes the popover', async () => {
    const { container } = mount()
    focusFor(rfNode(container, 'node-A'), "node A's focus ring")
    await waitFor(() => expect(openPopovers()).toEqual(['A control']))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(openPopovers()).toEqual([]))
  })
})
