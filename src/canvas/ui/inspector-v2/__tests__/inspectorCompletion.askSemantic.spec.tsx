/**
 * Inspector completion — ONE ASK SEMANTIC (the ledger's trap-21 pair) + R5
 * quick actions.
 *
 * THE PAIR, and the two questions it conflated:
 *
 *   `InspectorCoaching`  — "Ask about this" AUTO-SENT via `_sendMessage`.
 *   `DiscussWithAiButton` — PREFILLED an editable draft and waited.
 *
 * Same user intent ("ask Olumi about this element"), opposite semantics, one
 * inspector. Auto-send is the one that lies: the message vanishes into a
 * surface the user may not be looking at, so the button reads as dead.
 *
 * RULING APPLIED: prefill-and-confirm, everywhere. An ask affordance NEVER
 * dispatches. It lands the question as an EDITABLE DRAFT in a visible surface
 * with a single obvious Send, which the user presses.
 *
 * The two questions are now named apart (trap 21):
 *   Q1 "how does an ask get CONFIRMED?"  → one answer: the user sends it.
 *   Q2 "which CARRIER does it travel on?" → per call site, unchanged.
 * Q2 is deliberately NOT unified: the analysis-tab asks ride a typed dispatch
 * that carries chip_metadata, and a bare composer prefill would drop it.
 *
 * `run_exercise` stays a direct command: its button IS the confirmation, and a
 * prefilled '/exercise …' would sit in the composer as literal text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { InspectorCoaching } from '../shared/InspectorCoaching'
import { InspectorRouter } from '../InspectorRouter'
import { DiscussWithAiButton } from '../../../components/pre-analysis/DiscussWithAiButton'
import { requestAsk, ASK_SEMANTIC } from '../askSemantic'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../../components/results/coaching/askOlumiStore'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../../../conversation/revealOlumi', () => ({
  revealOlumiSurface: vi.fn(),
}))

import { revealOlumiSurface } from '../../../conversation/revealOlumi'
const mockReveal = revealOlumiSurface as ReturnType<typeof vi.fn>

const coachingProps = {
  elementId: 'node-1',
  panelType: 'factor-controllable',
  fallbackText: 'Static coaching fallback text',
  labelContext: { label: 'Marketing Budget' },
}

const EXPECTED_QUESTION = 'How important is Marketing Budget to the outcome?'

function makeGuidanceItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g1',
    signal_code: 'evidence_gap',
    category: 'should_fix',
    source: 'analysis',
    title: 'Orchestrator guidance title',
    detail: 'with detail',
    primary_action: { type: 'discuss', prompt: 'Tell me more about this' },
    target_object: { type: 'node', id: 'node-1', label: 'Test Factor' },
    priority: 80,
    ...overrides,
  } as GuidanceItem
}

beforeEach(() => {
  vi.clearAllMocks()
  useAskOlumiStore.getState().close()
  useAskOlumiStore.setState({ draft: '', context: '', label: '' } as never)
  useGuidanceStore.setState({
    guidanceItems: [],
    activeGuidanceItemId: null,
    inspectorDeepLinkField: null,
    _sendMessage: null,
    _runAnalysis: null,
    _sendChip: null,
    _scrollToPatch: null,
    _prefillChat: null,
    _dispatchAction: null,
  } as never)
})

// ─────────────────────────────────────────────────────────────────────
// The semantic itself
// ─────────────────────────────────────────────────────────────────────

describe('one ask semantic · the module declares it and never dispatches', () => {
  it('declares prefill-and-confirm as the semantic', () => {
    expect(ASK_SEMANTIC).toBe('prefill-and-confirm')
  })

  it('prefills the composer and reveals it — it does NOT send', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send } as never)

    requestAsk({ text: 'Why does this matter?', label: 'Ask', context: 'ctx' })

    expect(prefill).toHaveBeenCalledWith('Why does this matter?')
    expect(send).not.toHaveBeenCalled()
    expect(mockReveal).toHaveBeenCalled()
    // No third floating surface when a simple prefill suffices.
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('falls back to the drawer — still unsent — when no composer is registered', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: send } as never)

    requestAsk({ text: 'Why does this matter?', label: 'Ask', context: 'ctx' })

    expect(send).not.toHaveBeenCalled()
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe('Why does this matter?')
  })

  it('uses the drawer when the ask carries a typed-dispatch payload', () => {
    // Q2: chip_metadata survives ONLY on the typed turn, so an ask carrying
    // parameters must not be flattened into a bare composer prefill.
    const prefill = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill } as never)

    requestAsk({
      text: 'Run the outside view on this',
      label: 'Outside view',
      context: 'ctx',
      parameters: { method_id: 'outside_view' },
    })

    expect(prefill).not.toHaveBeenCalled()
    expect(useAskOlumiStore.getState().isOpen).toBe(true)
  })

  it('does nothing at all when there is no surface to receive the draft', () => {
    requestAsk({ text: 'Why does this matter?', label: 'Ask', context: 'ctx' })
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
    expect(mockReveal).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────
// Half one of the pair — InspectorCoaching stops auto-sending
// ─────────────────────────────────────────────────────────────────────

describe('one ask semantic · InspectorCoaching no longer auto-sends', () => {
  it('"Ask about this" prefills and does NOT call _sendMessage', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send } as never)

    render(<InspectorCoaching {...coachingProps} />)
    fireEvent.click(screen.getByText('Ask about this'))

    expect(send).not.toHaveBeenCalled()
    expect(prefill).toHaveBeenCalledWith(EXPECTED_QUESTION)
  })

  it('a "discuss" guidance action also prefills rather than sending', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({
      guidanceItems: [makeGuidanceItem()],
      _prefillChat: prefill,
      _sendMessage: send,
    } as never)

    render(<InspectorCoaching {...coachingProps} />)
    fireEvent.click(screen.getByText('Discuss'))

    expect(send).not.toHaveBeenCalled()
    expect(prefill).toHaveBeenCalledWith('Tell me more about this')
  })

  it('still routes a slash-command exercise as a direct command', () => {
    // Discriminating twin: proves the change is scoped to ASKS. A prefilled
    // '/exercise …' would sit in the composer as literal text, so its button
    // remains the confirmation. If this ever goes green-by-accident the
    // distinction has been flattened.
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          // The producer's own enum — 'pre_mortem', not 'premortem'. Derived
          // from GuidanceAction in guidanceStore.ts rather than guessed, and
          // asserted without a cast so the compiler keeps checking it.
          primary_action: { type: 'run_exercise', exercise: 'pre_mortem' },
        }),
      ],
      _prefillChat: prefill,
      _sendMessage: send,
    } as never)

    render(<InspectorCoaching {...coachingProps} />)
    // Labelled 'Try it', not 'Ask about this' — an auto-sending control must
    // not wear an ask's label (review item 4). Clicking it still sends.
    expect(screen.queryByText('Ask about this')).toBeNull()
    fireEvent.click(screen.getByText('Try it'))

    expect(send).toHaveBeenCalledWith('/exercise pre_mortem')
    expect(prefill).not.toHaveBeenCalled()
  })

  it('hides the action when no surface can receive it', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null } as never)
    render(<InspectorCoaching {...coachingProps} />)
    expect(screen.queryByText('Ask about this')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
// Half two of the pair — DiscussWithAiButton runs the same semantic
// ─────────────────────────────────────────────────────────────────────

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

  it('renders both ruled quick actions', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-quick-ask')).toBeTruthy()
    expect(screen.getByTestId('inspector-quick-analysis')).toBeTruthy()
  })

  it('places them ABOVE the panel body — nothing buried', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() } as never)
    setNodeStore()
    const { container } = render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    const quick = screen.getByTestId('inspector-quick-actions')
    const firstGroup = container.querySelector('[data-panel-group]')
    expect(firstGroup).not.toBeNull()
    // DOCUMENT_POSITION_FOLLOWING === 4: the first panel group follows the
    // quick-action row in document order.
    expect(quick.compareDocumentPosition(firstGroup as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the quick ask runs the ONE semantic — prefill, never send', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(send).not.toHaveBeenCalled()
    expect(prefill).toHaveBeenCalledTimes(1)
    expect(String(prefill.mock.calls[0][0])).toContain('Marketing Budget')
  })

  it('hides the quick ask when no conversation surface exists — no dead button', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null } as never)
    setNodeStore()
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-quick-ask')).toBeNull()
  })
})
