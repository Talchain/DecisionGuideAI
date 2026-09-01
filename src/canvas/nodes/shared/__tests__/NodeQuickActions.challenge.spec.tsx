/**
 * The GENERATIVE half of the quick-actions layer.
 *
 * ── THE GAP THIS PINS ────────────────────────────────────────────────
 *
 * `NodeQuickActions` shipped with a one-click "Ask Olumi about X", and the
 * prompt behind it is `explain_element` — *"Explain the role of X in this
 * decision model."* That is a REPORTING question: it describes what is already
 * on the card. The product's one node-scoped GENERATIVE prompt —
 * `challenge_element`, *"Challenge the current setup of X. What could be wrong
 * or missing?"* — had no button at all. Its only doors were RIGHT-CLICK →
 * Ask AI ▸ Challenge this, and the overflow button that re-emits that same
 * right-click. Both land it two levels inside a menu.
 *
 * So the affordance layer built to unbury this node's power *picked the
 * reporting prompt and left the generating one buried* — the founder's standing
 * critique of the canvas, reproduced inside the fix for it.
 *
 * ── WHAT IS ASSERTED, AND WHY EACH CASE EXISTS ───────────────────────
 *
 * 1. THE PAYLOAD, NOT THE DOM. A render assertion passes on a button that
 *    exists and routes nowhere. Every routing case here reads the string the
 *    conversation channel actually RECEIVED.
 *
 * 2. IT IS A DRAFT, NEVER A SEND. `_sendMessage` must stay untouched on every
 *    routing path. An idea the user has not agreed to is a draft — and the
 *    sibling ask button auto-sends via `askAI`, so this is exactly the seam
 *    where the two semantics could quietly converge on the wrong one.
 *
 * 3. NO SECOND SPELLING. The expected text is derived from
 *    `buildAskAIPrompt(target, 'challenge_element')` — the SAME producer the
 *    context menu calls — rather than pasted. A literal here would pass while
 *    the two copies drifted, which is how one idea comes to have two wordings.
 *
 * 4. THE EMPTINESS CONDITION. `option` and `decision` have no challenge prompt
 *    (the menu gates it on `FULL_MENU_KINDS ∪ {goal}`), so they must get NO
 *    button. An affordance that opens nothing is worse than no affordance.
 *
 * 5. A DISCRIMINATING PAIR. Clicking node-a's control must act on node-a and
 *    must NOT act on node-b — binding by identity, not by a value predicate
 *    another node could satisfy.
 *
 * ⚠ jsdom CANNOT PROVE VISIBILITY. Everything below is presence, wiring and
 * payload. That the button is legible, clear of the corner stack and revealed
 * on hover/focus/selection needs a browser witness; these tests would all pass
 * on a control rendered at zero opacity behind another element.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { buildAskAIPrompt } from '../../../contextMenu/actions'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const NODE_A = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }
const NODE_B = { id: 'node-b', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team productivity' } }

function seedGraph() {
  useCanvasStore.setState({ nodes: [NODE_A, NODE_B] } as never)
}

/** The prompt the CONTEXT MENU would produce for the same node — the one
 *  authority for this copy. Built here rather than pasted so a drift between
 *  the menu's wording and the button's is a RED, not an invisible divergence. */
function menuChallengePromptFor(node: typeof NODE_A): string {
  return buildAskAIPrompt(
    { kind: 'node', nodeId: node.id, nodeType: 'factor', node: node as never, screenPos: { x: 0, y: 0 } },
    'challenge_element',
  )
}

describe('NodeQuickActions — the generative prompt gets a door', () => {
  beforeEach(() => {
    seedGraph()
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null } as never)
  })

  it('offers a challenge action naming the element, alongside the ask and inspect actions', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    expect(screen.getByRole('button', { name: 'Challenge Hiring spend' })).toBeInTheDocument()
    expect(screen.getByTestId('node-action-challenge-node-a')).toBeInTheDocument()
  })

  /**
   * THE LOAD-BEARING CASE. Reads the payload the composer received, and pins
   * it to the menu's own producer.
   */
  it('lands the CONTEXT MENU\'s challenge prompt as an editable draft — and never sends it', () => {
    const prefillChat = vi.fn()
    const sendMessage = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefillChat, _sendMessage: sendMessage } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    fireEvent.click(screen.getByTestId('node-action-challenge-node-a'))

    const expected = menuChallengePromptFor(NODE_A)
    // Sanity: the producer really did yield a challenge prompt for this node,
    // so an empty-string bug cannot make the assertion below vacuous.
    expect(expected).toContain('Hiring spend')
    expect(prefillChat).toHaveBeenCalledTimes(1)
    expect(prefillChat).toHaveBeenCalledWith(expected)
    // The whole point: a draft, not a message. Humans stay the authors.
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('selects the node first, so the turn carries selected_elements', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    fireEvent.click(screen.getByTestId('node-action-challenge-node-a'))

    expect(useCanvasStore.getState().selection.nodeIds.has('node-a')).toBe(true)
  })

  it('binds to THIS node, not another (discriminating pair)', () => {
    const prefillChat = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefillChat } as never)
    render(
      <>
        <NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />
        <NodeQuickActions nodeId="node-b" nodeType="factor" label="Team productivity" />
      </>,
    )

    // node-b deliberately: a positional mutant that ignores the argument and
    // reads nodes[0] passes trivially when the target is the first node.
    fireEvent.click(screen.getByTestId('node-action-challenge-node-b'))

    expect(prefillChat).toHaveBeenCalledWith(menuChallengePromptFor(NODE_B))
    expect(prefillChat).not.toHaveBeenCalledWith(menuChallengePromptFor(NODE_A))
    const selected = useCanvasStore.getState().selection.nodeIds
    expect(selected.has('node-b')).toBe(true)
    expect(selected.has('node-a')).toBe(false)
  })

  it('falls back to the Ask-Olumi drawer when no composer is registered — still a draft, still not sent', () => {
    const sendMessage = vi.fn()
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: sendMessage, _dispatchAction: dispatchAction } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    fireEvent.click(screen.getByTestId('node-action-challenge-node-a'))

    // requestAsk routes to the drawer, which holds the draft until the user
    // presses Send. Neither wire may be driven by the click itself.
    expect(sendMessage).not.toHaveBeenCalled()
    expect(dispatchAction).not.toHaveBeenCalled()
  })
})

/**
 * THE EMPTINESS CONDITION — the half that keeps this from becoming a dead
 * control on two thirds of the canvas.
 */
describe('NodeQuickActions — no challenge button where there is no challenge prompt', () => {
  beforeEach(() => {
    seedGraph()
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null } as never)
  })

  it('renders no challenge button when no conversation surface is registered', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    expect(screen.queryByTestId('node-action-challenge-node-a')).toBeNull()
    // …while the inspect action, which needs no conversation, stays.
    expect(screen.getByTestId('node-action-inspect-node-a')).toBeInTheDocument()
  })

  /**
   * The gate must derive from the SAME set the menu gates on. `option` and
   * `decision` are organisational kinds: the menu builds no "Challenge this"
   * for them, so a button here would open a prompt that does not exist.
   */
  it.each(['option', 'decision'] as const)('renders no challenge button for %s nodes', (kind) => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType={kind} label="Hiring spend" />)

    expect(screen.queryByTestId('node-action-challenge-node-a')).toBeNull()
  })

  /** The positive half of the same gate — without this the case above passes
   *  on a component that renders the button for nothing at all. */
  it.each(['factor', 'risk', 'outcome', 'goal'] as const)('DOES render a challenge button for %s nodes', (kind) => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType={kind} label="Hiring spend" />)

    expect(screen.getByTestId('node-action-challenge-node-a')).toBeInTheDocument()
  })

  it('keeps the challenge button in the tab order and focus-ringed, like its siblings', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    const btn = screen.getByTestId('node-action-challenge-node-a')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).not.toHaveAttribute('tabindex', '-1')
    expect(btn).not.toHaveAttribute('hidden')
    expect(btn.className).toContain('focus-visible:ring-2')
  })
})
