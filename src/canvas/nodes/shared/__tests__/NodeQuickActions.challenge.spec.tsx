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
 *    ⚠ Derivation alone would also pass on a producer that had stopped
 *    discriminating by kind, so every per-kind case below first asserts its
 *    sentence DIFFERS from the `factor` one. A guard that agrees with itself
 *    proves nothing.
 *
 * 4. THE GATE IS DERIVED, NEVER MIRRORED. The kinds that get a button are read
 *    from `CHALLENGE_KINDS` — the menu's own Set — at test time, in both
 *    directions: every member renders one, every non-member renders none. A
 *    hand-copied list inside `NodeQuickActions` would REd here the moment it
 *    disagreed with the menu, which is the drift this binding exists to catch.
 *    `action` is the one kind still outside the Set, so the emptiness
 *    condition is asserted on a kind that really is empty rather than on
 *    `decision`/`option`, which now carry a prompt of their own.
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
import { CHALLENGE_KINDS } from '../../../contextMenu/useMenuItems'
import { NodeTypeEnum } from '../../../domain/nodes'
import type { NodeType } from '../../../domain/nodes'
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
function menuChallengePromptFor(node: typeof NODE_A, nodeType: NodeType = 'factor'): string {
  return buildAskAIPrompt(
    { kind: 'node', nodeId: node.id, nodeType, node: node as never, screenPos: { x: 0, y: 0 } },
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

  /**
   * ⭐ THE POINT OF THE CHANGE, READ AT THE PAYLOAD.
   *
   * A Question node is not "an element with a current setup" — it is the thing
   * the whole model is about, and the generic sentence asks the wrong
   * question of it. These cases read the string the composer actually
   * received, for the node kind under test, bound by that kind.
   *
   * ⚠ EACH ONE PINS ITS OWN PRECONDITION. The per-kind assertion is preceded
   * by a check that the producer returns something DIFFERENT for `factor` —
   * without it, a producer that stopped discriminating by kind (the switch
   * deleted, the table emptied) would satisfy every assertion below by handing
   * out one sentence, and the test would applaud a change that undid itself.
   */
  it.each([
    ['decision', 'how this question is framed'],
    ['option', 'What would make it a worse choice'],
    ['constraint', 'who could relax it'],
  ] as const)('drafts copy written for a %s, not the generic element sentence', (kind, fragment) => {
    const prefillChat = vi.fn()
    const sendMessage = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefillChat, _sendMessage: sendMessage } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType={kind} label="Hiring spend" />)

    fireEvent.click(screen.getByTestId('node-action-challenge-node-a'))

    const expected = menuChallengePromptFor(NODE_A, kind)
    // Precondition: the producer really is discriminating by kind here.
    expect(expected).not.toBe(menuChallengePromptFor(NODE_A, 'factor'))
    expect(expected).toContain('Hiring spend')
    expect(expected).toContain(fragment)
    // …and the composer got exactly that, not a second spelling of it.
    expect(prefillChat).toHaveBeenCalledTimes(1)
    expect(prefillChat).toHaveBeenCalledWith(expected)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  /** The four kinds that already shipped keep the sentence users have seen —
   *  this change adds kinds, it does not reword what is already on screen. */
  it.each(['factor', 'risk', 'outcome', 'goal'] as const)('leaves the shipped %s wording untouched', (kind) => {
    expect(menuChallengePromptFor(NODE_A, kind))
      .toBe('Challenge the current setup of "Hiring spend". What could be wrong or missing?')
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
   * ⭐ THE GATE, DERIVED FROM THE MENU'S OWN SET — BOTH DIRECTIONS.
   *
   * These two cases read `CHALLENGE_KINDS` at test time rather than listing
   * kinds. Replace this component's `CHALLENGE_KINDS.has(...)` with a
   * hand-copied literal and the pair REDs the moment that literal disagrees
   * with the menu — in either direction: a SHORT list fails the first case, a
   * LONG one fails the second. A test that listed the kinds itself would be a
   * third copy of the same list and would agree with a mirror indefinitely.
   *
   * The membership of the Set is pinned separately, by a hand-written corpus
   * in `useMenuItems.spec.ts`, because a derived guard proves agreement and
   * can never notice that the list itself is short.
   */
  it.each([...CHALLENGE_KINDS] as NodeType[])('DOES render a challenge button for %s nodes — every kind the menu offers it to', (kind) => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType={kind} label="Hiring spend" />)

    expect(screen.getByTestId('node-action-challenge-node-a')).toBeInTheDocument()
  })

  it.each(NodeTypeEnum.options.filter(k => !CHALLENGE_KINDS.has(k)))('renders no challenge button for %s nodes — the menu offers none', (kind) => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<NodeQuickActions nodeId="node-a" nodeType={kind} label="Hiring spend" />)

    expect(screen.queryByTestId('node-action-challenge-node-a')).toBeNull()
  })

  /** The complement above is only meaningful if it is non-empty. Without this
   *  an `it.each([])` would silently register ZERO cases and the suite would
   *  still print green — an absence assertion pointed at nothing. */
  it('has at least one kind outside the Set, so the negative case above is not vacuous', () => {
    expect(NodeTypeEnum.options.filter(k => !CHALLENGE_KINDS.has(k)).length).toBeGreaterThan(0)
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
