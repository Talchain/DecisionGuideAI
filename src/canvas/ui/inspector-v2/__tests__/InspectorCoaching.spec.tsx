/**
 * InspectorCoaching — unit tests
 *
 * Verifies:
 * - Orchestrator GuidanceItems render through CoachingCard visual
 * - Guidance filtered to selected element only
 * - v3.1 (DESIGN-GAP-v31 row 32): NO static fallback — with no grounded
 *   guidance item for the element, nothing renders (the generic lightbulb
 *   card is retired)
 * - Discuss sends one bound chip question and reveals the conversation
 * - Questions require a chip dispatcher
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'
import { useCanvasStore } from '../../../store'

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
  }
}

const defaultProps = {
  elementId: 'node-1',
  panelType: 'factor-controllable',
  fallbackText: 'Static coaching fallback text',
  labelContext: { label: 'Marketing Budget' },
}

beforeEach(() => {
  useGuidanceStore.setState({
    guidanceItems: [],
    activeGuidanceItemId: null,
    inspectorDeepLinkField: null,
    _sendMessage: null,
    _runAnalysis: null,
    _sendChip: null,
    _scrollToPatch: null,
    _prefillChat: null,
    _dispatchAction: null, _isConversationBusy: () => false,
  })
})

describe('InspectorCoaching', () => {
  it('v3.1: renders NOTHING when no guidance item targets the element — no generic fallback card', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    expect(screen.queryByText('Static coaching fallback text')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('renders orchestrator guidance text when a matching item exists', () => {
    useGuidanceStore.setState({
      guidanceItems: [makeGuidanceItem()],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Orchestrator guidance title/)).toBeTruthy()
    // Static fallback should NOT appear
    expect(screen.queryByText('Static coaching fallback text')).toBeNull()
  })

  it('filters guidance to selected element only — items for other elements do not appear', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({ item_id: 'other', target_object: { type: 'node', id: 'node-99' }, title: 'Wrong node guidance' }),
      ],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    // Not the guidance for node-99 — and, since v3.1, no fallback either.
    expect(screen.queryByText('Wrong node guidance')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('shows highest-priority guidance item when multiple match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({ item_id: 'low', priority: 20, title: 'Low priority' }),
        makeGuidanceItem({ item_id: 'high', priority: 90, title: 'High priority' }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/High priority/)).toBeTruthy()
    expect(screen.queryByText(/Low priority/)).toBeNull()
  })

  it('Discuss sends a chip about the bound target without a prefill', () => {
    const dispatch = vi.fn(); const prefill = vi.fn()
    useCanvasStore.setState({ nodes: [{ id: 'node-1', type: 'factor', data: { label: 'Marketing Budget' }, position: { x: 0, y: 0 } }], edges: [] } as never)
    useGuidanceStore.setState({ guidanceItems: [makeGuidanceItem()], _dispatchAction: dispatch, _prefillChat: prefill })
    render(<InspectorCoaching {...defaultProps} />)
    fireEvent.click(screen.getByText('Discuss'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0]).toMatchObject({ id: 'ask:evidence', source: 'chip' })
    expect(dispatch.mock.calls[0][0].message).toContain('Marketing Budget')
    expect(prefill).not.toHaveBeenCalled()
  })
  it('the default button performs the card’s own navigate action', () => {
    useGuidanceStore.setState({ guidanceItems: [makeGuidanceItem({ primary_action: { type: 'navigate', target: '#model' } })], _dispatchAction: vi.fn() })
    render(<InspectorCoaching {...defaultProps} />)
    fireEvent.click(screen.getByText('Ask about this'))
    expect(window.location.hash).toBe('#model')
    expect(useGuidanceStore.getState()._dispatchAction).not.toHaveBeenCalled()
  })
  it('without a dispatcher the grounded card remains readable but the Ask action is hidden', () => {
    useGuidanceStore.setState({ guidanceItems: [makeGuidanceItem()], _dispatchAction: null })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.queryByText('Discuss')).toBeNull()
    expect(screen.getByText(/Orchestrator guidance title/)).toBeTruthy()
  })

  it('renders a grounded item FLAT — the contract\'s section-highlight, no box, no lightbulb (v3.1)', () => {
    // v3.1 (DESIGN-GAP-v31 row 32): the card was a boxed notification (an
    // inline 1px info border at 30%, `rounded-lg shadow-1`, a lightbulb and a
    // dismiss ×). It is now `.section-highlight`: a 2px left rule — the
    // contract's #A3C5D1, drawn as the DS token Info at 40% (ΔE 1.9), because
    // the production-hex ratchet forbids the raw hex (inspectorStyle.ts).
    useGuidanceStore.setState({
      guidanceItems: [makeGuidanceItem()],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    const card = screen.getByTestId('inspector-guidance')
    expect(card.className).toContain('border-l-2')
    expect(card.className).toContain('border-info/40')
    expect(card.className).not.toContain('border-[#')
    expect(card.className).not.toMatch(/rounded|shadow/)
    expect(card.style.border).toBe('')
    expect(container.querySelector('svg.lucide-lightbulb')).toBeNull()
    expect(screen.queryByLabelText('Dismiss suggestion')).toBeNull()
  })

  // ── related_elements matching ──────────────────────────────────────

  it('surfaces guidance item when elementId matches a related_elements entry', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-match',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'node-1', type: 'node' }],
          title: 'Weakly connected guidance',
        }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Weakly connected guidance/)).toBeTruthy()
  })

  it('prefers direct target_object.id match over higher-priority related_elements match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-high',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'node-1', type: 'node' }],
          title: 'Related high priority',
          priority: 99,
        }),
        makeGuidanceItem({
          item_id: 'direct-low',
          target_object: { type: 'node', id: 'node-1' },
          title: 'Direct low priority',
          priority: 10,
        }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Direct low priority/)).toBeTruthy()
    expect(screen.queryByText(/Related high priority/)).toBeNull()
  })

  it('direct match wins over related match even at identical priority', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-same-pri',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'node-1', type: 'node' }],
          title: 'Related same priority',
          priority: 80,
        }),
        makeGuidanceItem({
          item_id: 'direct-same-pri',
          target_object: { type: 'node', id: 'node-1' },
          title: 'Direct same priority',
          priority: 80,
        }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Direct same priority/)).toBeTruthy()
    expect(screen.queryByText(/Related same priority/)).toBeNull()
  })

  it('renders nothing (no static fallback, v3.1) when related_elements has no id match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'unrelated',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'different-node', type: 'node' }],
          title: 'Unrelated guidance',
        }),
      ],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    expect(screen.queryByText('Unrelated guidance')).toBeNull()
    expect(container.innerHTML).toBe('')
  })
})

// ── clearItemsByTargetIds + related_elements ──────────────────────────

describe('clearItemsByTargetIds — related_elements', () => {
  it('clears items when a related_elements[].id matches the edited node', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-item',
          target_object: { type: 'node', id: 'primary-node' },
          related_elements: [{ id: 'edited-node', type: 'node' }],
        }),
      ],
    })

    useGuidanceStore.getState().clearItemsByTargetIds(['edited-node'])

    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('preserves items when neither target_object.id nor related_elements match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'unrelated',
          target_object: { type: 'node', id: 'safe-node' },
          related_elements: [{ id: 'also-safe', type: 'node' }],
        }),
      ],
    })

    useGuidanceStore.getState().clearItemsByTargetIds(['edited-node'])

    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })
})
