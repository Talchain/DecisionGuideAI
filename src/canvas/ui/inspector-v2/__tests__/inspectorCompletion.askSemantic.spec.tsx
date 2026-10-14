// 7 Oct: explicit auto-send ruling supersedes the old prefill-and-confirm specs.
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InspectorRouter } from '../InspectorRouter'
import { ToastProvider } from '../../../ToastContext'
import { DiscussWithAiButton } from '../../../components/pre-analysis/DiscussWithAiButton'
import { InspectorQuickActions } from '../shared/InspectorQuickActions'
import { requestAsk, ASK_SEMANTIC } from '../askSemantic'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../../components/results/coaching/askOlumiStore'
import { takeAskTargetBinding, clearAskTargetBinding } from '../askTargetBinding'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'
vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
let dispatch: ReturnType<typeof vi.fn>
beforeEach(() => {
  clearAskTargetBinding(); vi.clearAllMocks()
  useCanvasStore.setState({ nodes: [
    { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Budget' } },
    { id: 'b', type: 'goal', position: { x: 0, y: 1 }, data: { label: 'Delivery' } },
  ], edges: [{ id: 'ab', source: 'a', target: 'b', data: {} }], hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _sendMessage: vi.fn(), _prefillChat: vi.fn(), _isConversationBusy: () => false })
  useAskOlumiStore.getState().close()
})
describe('one ask semantic', () => {
  it('declares immediate chip submission', () => expect(ASK_SEMANTIC).toBe('send-chip-immediately'))
  it('sends once and reveals the panel, without prefilling or sending Olumi words as composer text', () => {
    expect(requestAsk({ text: 'Old wording', label: 'Explore', targetId: 'a', intent: 'explain' })).toBe('sent')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0]).toMatchObject({ id: 'ask:explain', source: 'chip' })
    expect(useGuidanceStore.getState()._prefillChat).not.toHaveBeenCalled()
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
    expect(revealOlumiSurface).toHaveBeenCalled()
  })
  it('keeps an explicitly editable template in the drawer with its trailing space', () => {
    expect(requestAsk({ text: 'My answer: ', label: 'Answer', editable: true })).toBe('drawer')
    expect(useAskOlumiStore.getState().draft).toBe('My answer: ')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('without dispatch refuses, never invents a composer turn', () => {
    useGuidanceStore.setState({ _dispatchAction: null })
    expect(requestAsk({ text: 'Ask', label: 'Ask', targetId: 'a', intent: 'explain' })).toBe('none')
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
  })
  it.each([['a', 'factor-controllable', 'Budget'], ['ab', 'edge', 'Budget to Delivery']])('Explore %s sends once with the correct target set', (elementId, panelType, elementLabel) => {
    render(<InspectorQuickActions elementId={elementId} panelType={panelType} elementLabel={elementLabel} labelContext={{ sourceLabel: 'Budget', targetLabel: 'Delivery' }} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    const sent = dispatch.mock.calls[0][0]
    expect(sent).toMatchObject({ id: panelType === 'edge' ? 'ask:link' : 'ask:explain', source: 'chip' })
    const bound = takeAskTargetBinding(sent.message)
    expect(panelType === 'edge' ? bound?.edgeIds : bound?.nodeIds).toEqual(new Set([elementId]))
    expect(sent.message).toContain('Budget')
    expect(revealOlumiSurface).toHaveBeenCalled()
  })
})

const dispatchMessage = () => (useGuidanceStore.getState()._dispatchAction as ReturnType<typeof vi.fn>).mock.calls[0][0].message
describe('one ask semantic · DiscussWithAiButton runs the same routing', () => {
  it('prefills the composer instead of floating a drawer when one is registered', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send } as never)

    render(<DiscussWithAiButton element={{ kind: 'factor', label: 'Team size' }} />)
    fireEvent.click(screen.getByTestId('discuss-with-ai'))

    expect(send).not.toHaveBeenCalled()
    expect(prefill).toHaveBeenCalledTimes(1)
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('honours an explicit onSend override unchanged', () => {
    // The override is the caller managing its own handler; it must not be
    // re-routed underneath the caller.
    const onSend = vi.fn()
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    render(<DiscussWithAiButton element={{ kind: 'factor', label: 'Team size' }} onSend={onSend} />)
    fireEvent.click(screen.getByTestId('discuss-with-ai'))
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('falls back to the drawer when no composer is registered', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: vi.fn() } as never)
    render(<DiscussWithAiButton element={{ kind: 'factor', label: 'Team size' }} />)
    fireEvent.click(screen.getByTestId('discuss-with-ai'))
    expect(useAskOlumiStore.getState().isOpen).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────
// R5 — quick actions at the TOP of the inspector
// ─────────────────────────────────────────────────────────────────────

describe('R5 · quick actions sit at the top of the inspector', () => {
  function setNodeStore() {
    useCanvasStore.setState({
      ...useCanvasStore.getState(),
      nodes: [
        { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing Budget', kind: 'factor', category: 'controllable' } },
      ],
      edges: [],
      results: { status: 'none', report: null },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never)
  }

  it('renders the two contract buttons — "Explore with Olumi" and "Back to the conversation"', () => {
    // v3.1 (DESIGN-GAP-v31 row 7; point 11). "Its analysis" (a switch to the
    // generic Analysis tab) is retired with the rest of the pre-contract chips.
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _dispatchAction: vi.fn() } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />, { wrapper: ToastProvider })
    expect(screen.getByTestId('inspector-quick-ask').textContent).toBe('Ask Olumi')
    fireEvent.click(screen.getByTestId('inspector-header-menu'))
    expect(screen.getByTestId('inspector-back-to-conversation').textContent).toBe('Back to the conversation')
    expect(screen.queryByTestId('inspector-quick-analysis')).toBeNull()
  })

  it('the route OUT of the read-only panel is the ONE conversation route — "Change this" is retired', () => {
    // ⭐ WHAT "Change this" EXISTED FOR still holds: the panel below is
    // read-only and its notice is TRUE, and a true refusal must not be a dead
    // end. v3.1 asks for ONE edit route instead of the served pile-up (dashed
    // title + pencil + "Change this" + "Change"), so the conversational route
    // is "Explore with Olumi" — the notices' own remedy, "ask Olumi to …".
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _dispatchAction: vi.fn() } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-quick-change')).toBeNull()
    expect(screen.getByTestId('inspector-quick-ask')).toBeTruthy()
  })

  it('that route sends one chip and never sends as composer text, and names the element', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('inspector-quick-ask'))

    // ⚠ THE LOAD-BEARING HALF. A control that SENDS on click would make the
    // read-only notice beneath it a lie — the panel would be telling the user
    // their change cannot be saved while the click had already committed one.
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(prefill).not.toHaveBeenCalled()

    // Bound to the element by its LABEL, not by matching the copy — a draft
    // naming the wrong node is the failure that matters.
    const drafted = String(dispatch.mock.calls[0][0].message)
    expect(drafted).toContain('Marketing Budget')
  })

  it('both are HIDDEN, not inert, when no conversation surface is registered', () => {
    // A control that looks live and does nothing is the dead-button class.
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    setNodeStore()
    const { unmount } = render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-quick-ask')).toBeNull()
    expect(screen.queryByTestId('inspector-back-to-conversation')).toBeNull()
    unmount()
    // Positive control: the SAME probe sees both once a surface is registered,
    // so the absence above is a real absence rather than a blind query.
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _dispatchAction: vi.fn() } as never)
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />, { wrapper: ToastProvider })
    expect(screen.getByTestId('inspector-quick-ask')).toBeTruthy()
    fireEvent.click(screen.getByTestId('inspector-header-menu'))
    expect(screen.getByTestId('inspector-back-to-conversation')).toBeTruthy()
  })

  it('places the merged Ask after the primary controls and before More', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _dispatchAction: vi.fn() } as never)
    setNodeStore()
    const { container } = render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    const quick = screen.getByTestId('inspector-quick-actions')
    const firstGroup = container.querySelector('[data-panel-group]')
    expect(firstGroup).not.toBeNull()
    // The single action follows primary controls and precedes More.
    expect((firstGroup as Node).compareDocumentPosition(quick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(quick.compareDocumentPosition(screen.getByTestId('inspector-more-toggle')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the quick ask runs the batch semantic — one chip, never composer text', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: vi.fn() } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(send).not.toHaveBeenCalled()
    expect(useGuidanceStore.getState()._dispatchAction).toHaveBeenCalledTimes(1)
    expect(prefill).not.toHaveBeenCalled()
    expect(dispatchMessage()).toBe('What does ‘Marketing Budget’ do in this decision, and what is it assumed to depend on?')
  })

  it('hides the quick ask when no conversation surface exists — no dead button', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-quick-ask')).toBeNull()
  })
})
