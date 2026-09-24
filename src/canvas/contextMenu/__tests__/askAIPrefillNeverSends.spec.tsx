/**
 * `askAI` under the house rule — every canvas ask lands a DRAFT, never a send.
 *
 * ── THE DEFECT THIS PINS ─────────────────────────────────────────────
 *
 * The house rule is `ASK_SEMANTIC = 'prefill-and-confirm'` (askSemantic.ts): an
 * ask becomes an editable draft in a visible surface and the person presses
 * Send. `askAI` — behind the card's hover "Ask Olumi" and every context-menu
 * ask — polled for `_sendMessage` and SENT `buildAskAIPrompt(...)` at once, in
 * the user's name (witnessed on served staging, 24 Sep 2026). Its sibling on
 * the same row, the challenge button, already prefilled via `requestAsk`: two
 * adjacent controls, one layer, opposite confirmation (trap 21).
 *
 * ── WHAT IS ASSERTED ─────────────────────────────────────────────────
 *
 * 1. THE PAYLOAD, BY IDENTITY. The expected draft is the producer's own output
 *    for THIS target and THIS intent — `buildAskAIPrompt(target, intent)` —
 *    and it must arrive EXACTLY, once. A node-b discriminating pair proves the
 *    click binds to the element it sits on.
 * 2. ZERO SENDS, on every door, checked FIRST — that is the defect.
 * 3. THE MENU IS DRIVEN THROUGH ITS REAL BUILDER (`useMenuItems`), not by
 *    calling `askAI` with arguments copied out of it, so a menu row re-pointed
 *    at a different intent or a different helper REDs here.
 * 4. NO COMPOSER → THE ASK DRAWER, holding exactly the prompt; the person's own
 *    Send sends it once. The ask is never lost and never auto-sent.
 * 5. THE GATE asks the question `askAI` now asks — `canReceiveAsk` — with a
 *    same-run contrast (nothing registered → no button).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { NodeQuickActions } from '../../nodes/shared/NodeQuickActions'
import { askAI, buildAskAIPrompt } from '../actions'
import { useMenuItems } from '../useMenuItems'
import type { ContextTarget, EdgeTarget, MenuEntry, MenuItemDef, MultiTarget, NodeTarget, PaneTarget } from '../types'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { AskOlumiDrawer } from '../../../components/results/coaching/AskOlumiDrawer'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { DEFAULT_EDGE_DATA, type EdgeData } from '../../domain/edges'

const NODE_A = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend', kind: 'factor' } } as Node
const NODE_B = { id: 'node-b', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team productivity', kind: 'factor' } } as Node
const EDGE_AB = { id: 'edge-ab', source: 'node-a', target: 'node-b', type: 'styled', data: { ...DEFAULT_EDGE_DATA } } as Edge<EdgeData>

const AT = { x: 0, y: 0 }
const nodeTarget = (node: Node): NodeTarget => ({ kind: 'node', nodeId: node.id, nodeType: 'factor', node, screenPos: AT })
const EDGE_TARGET: EdgeTarget = { kind: 'edge', edgeId: EDGE_AB.id, edge: EDGE_AB, isStructural: false, screenPos: AT }
const PANE_TARGET: PaneTarget = { kind: 'pane', screenPos: AT }
const MULTI_TARGET: MultiTarget = { kind: 'multi', nodeIds: ['node-a', 'node-b'], edgeIds: ['edge-ab'], screenPos: AT }

/** Register exactly the named channels; record everything that reaches each. */
function wire(ch: { composer?: boolean; send?: boolean; dispatch?: boolean }) {
  const prefilled: string[] = []
  const sent: string[] = []
  const dispatched: Array<Record<string, unknown>> = []
  useGuidanceStore.setState({
    _prefillChat: ch.composer ? (t: string) => { prefilled.push(t) } : null,
    _sendMessage: ch.send ? (t: string) => { sent.push(t) } : null,
    _dispatchAction: ch.dispatch ? (o: Record<string, unknown>) => { dispatched.push(o) } : null,
  } as never)
  /** Every send on either wire, as the text that would reach the thread. */
  const allSends = () => [...sent, ...dispatched.map((d) => d.message as string)]
  return { prefilled, sent, dispatched, allSends }
}

/** Run askAI's first frame and its whole registration poll (20 × 50ms). */
function flushAsk() {
  act(() => { vi.advanceTimersByTime(1500) })
}

function menuItem(entries: MenuEntry[], parentId: string, childId: string): MenuItemDef {
  const isItem = (e: MenuEntry): e is MenuItemDef => !('type' in e)
  const parent = entries.filter(isItem).find((e) => e.id === parentId)
  const child = parent?.submenuItems?.filter(isItem).find((e) => e.id === childId)
  if (!child) throw new Error(`menu has no ${parentId} ▸ ${childId}`)
  return child
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  useCanvasStore.setState({
    nodes: [NODE_A, NODE_B],
    edges: [EDGE_AB],
    // The hover Ask renders below Normal zoom; at `full` the rail's coaching
    // icon is the card's one Ask door (askOlumiOneGlyph.spec pins that).
    lodRung: 'quiet',
  } as never)
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null, parameters: undefined, source: 'chip' })
  useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('hover "Ask Olumi" on a card — a draft, never a send', () => {
  it('prefills EXACTLY the explain prompt for this node, sends nothing, and selects the node first', () => {
    const c = wire({ composer: true, send: true, dispatch: true })
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)

    fireEvent.click(screen.getByTestId('node-action-ask-node-a'))
    flushAsk()

    const expected = buildAskAIPrompt(nodeTarget(NODE_A), 'explain_element')
    expect(expected, 'non-vacuous: the producer named this node').toContain('Hiring spend')
    expect(c.allSends(), 'the click itself sent a message in the user\'s name').toEqual([])
    expect(c.prefilled).toEqual([expected])
    // A composer is registered, so no third floating surface opens.
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
    expect(useCanvasStore.getState().selection.nodeIds.has('node-a')).toBe(true)
  })

  it('binds to THIS node — node-b\'s button drafts node-b\'s prompt, not node-a\'s (discriminating pair)', () => {
    const c = wire({ composer: true, send: true })
    render(
      <>
        <NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />
        <NodeQuickActions nodeId="node-b" nodeType="factor" label="Team productivity" />
      </>,
    )

    fireEvent.click(screen.getByTestId('node-action-ask-node-b'))
    flushAsk()

    expect(c.allSends()).toEqual([])
    expect(c.prefilled).toEqual([buildAskAIPrompt(nodeTarget(NODE_B), 'explain_element')])
    expect(c.prefilled).not.toContain(buildAskAIPrompt(nodeTarget(NODE_A), 'explain_element'))
  })

  it('waits for a surface that registers a few frames late — the poll is kept — and still only drafts', () => {
    // Nothing registered when the ask starts: the panel `askAI` just opened is
    // still mounting. It registers ~120ms later.
    askAI(nodeTarget(NODE_A), 'explain_element', vi.fn())
    act(() => { vi.advanceTimersByTime(120) })

    const c = wire({ composer: true, send: true })
    flushAsk()

    expect(c.allSends()).toEqual([])
    expect(c.prefilled).toEqual([buildAskAIPrompt(nodeTarget(NODE_A), 'explain_element')])
  })
})

describe('context-menu asks, driven through the real menu builder — drafts, never sends', () => {
  const CASES: Array<{ name: string; target: () => ContextTarget; parent: string; child: string; intent: string; mustName: string }> = [
    { name: 'node ▸ Explain this', target: () => nodeTarget(NODE_A), parent: 'ask-ai', child: 'ask-ai-explain', intent: 'explain_element', mustName: 'Hiring spend' },
    { name: 'node ▸ Challenge this', target: () => nodeTarget(NODE_A), parent: 'ask-ai', child: 'ask-ai-challenge', intent: 'challenge_element', mustName: 'Hiring spend' },
    { name: 'edge ▸ Explain this', target: () => EDGE_TARGET, parent: 'ask-ai', child: 'ask-ai-explain', intent: 'explain_element', mustName: 'Team productivity' },
    { name: 'edge ▸ Challenge this', target: () => EDGE_TARGET, parent: 'ask-ai', child: 'ask-ai-challenge', intent: 'challenge_element', mustName: 'Team productivity' },
    { name: "pane ▸ What's missing", target: () => PANE_TARGET, parent: 'ask-ai-pane', child: 'ask-ai-missing', intent: 'review_model_gaps', mustName: 'missing' },
    { name: 'multi ▸ Explain this', target: () => MULTI_TARGET, parent: 'ask-ai', child: 'ask-ai-explain', intent: 'explain_subgraph', mustName: 'selected elements' },
  ]

  it.each(CASES)('$name → the composer receives EXACTLY the producer\'s prompt and nothing is sent', ({ target, parent, child, intent, mustName }) => {
    const c = wire({ composer: true, send: true, dispatch: true })
    const t = target()
    const { result } = renderHook(() =>
      useMenuItems({ target: t, showToast: vi.fn(), screenToFlowPosition: (p) => p, onClose: vi.fn() }),
    )

    act(() => { menuItem(result.current, parent, child).action() })
    flushAsk()

    const expected = buildAskAIPrompt(t, intent)
    expect(expected, 'non-vacuous: the producer built this intent, not the fallback').toContain(mustName)
    expect(c.allSends()).toEqual([])
    expect(c.prefilled).toEqual([expected])
  })
})

describe('no composer registered — the Ask drawer is the confirm surface', () => {
  it('hover Ask with only a SEND channel: the drawer holds exactly the prompt, nothing is sent; the person\'s Send sends it once', () => {
    const c = wire({ send: true })
    render(
      <>
        <NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />
        <AskOlumiDrawer />
      </>,
    )

    fireEvent.click(screen.getByTestId('node-action-ask-node-a'))
    flushAsk()

    const expected = buildAskAIPrompt(nodeTarget(NODE_A), 'explain_element')
    expect(c.allSends(), 'zero sends on activation').toEqual([])
    expect(useAskOlumiStore.getState().isOpen).toBe(true)
    expect(useAskOlumiStore.getState().draft).toBe(expected)
    const draftBox = screen.getByTestId('ask-olumi-draft') as HTMLTextAreaElement
    expect(draftBox.value).toBe(expected)

    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Send' })) })
    expect(c.allSends()).toEqual([expected])
  })

  it('a menu ask with only a SEND channel opens the drawer too — never a send', () => {
    const c = wire({ send: true })
    const t = nodeTarget(NODE_B)
    const { result } = renderHook(() =>
      useMenuItems({ target: t, showToast: vi.fn(), screenToFlowPosition: (p) => p, onClose: vi.fn() }),
    )

    act(() => { menuItem(result.current, 'ask-ai', 'ask-ai-challenge').action() })
    flushAsk()

    expect(c.allSends()).toEqual([])
    expect(useAskOlumiStore.getState().isOpen).toBe(true)
    expect(useAskOlumiStore.getState().draft).toBe(buildAskAIPrompt(t, 'challenge_element'))
  })

  it('no surface ever registers: the person is told, and nothing is drafted or sent', () => {
    const showToast = vi.fn()
    askAI(nodeTarget(NODE_A), 'explain_element', showToast)
    flushAsk()

    expect(showToast).toHaveBeenCalledWith('Could not open a draft — try typing your question directly.', 'warning')
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })
})

describe('the hover Ask gate asks the question askAI asks — canReceiveAsk', () => {
  it('shows the button when ONLY the composer is registered', () => {
    wire({ composer: true })
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    expect(screen.getByTestId('node-action-ask-node-a')).toBeInTheDocument()
  })

  it('shows the button when ONLY the typed dispatcher is registered (the drawer can land it)', () => {
    wire({ dispatch: true })
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    expect(screen.getByTestId('node-action-ask-node-a')).toBeInTheDocument()
  })

  it('CONTRAST: hides the button when nothing is registered, while More stays', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    expect(screen.queryByTestId('node-action-ask-node-a')).toBeNull()
    expect(screen.getByTestId('node-action-menu-node-a')).toBeInTheDocument()
  })
})
