/**
 * InspectorCoaching — unit tests
 *
 * Verifies:
 * - Orchestrator GuidanceItems render through CoachingCard visual
 * - Guidance filtered to selected element only
 * - Static coaching is fallback when no guidance exists
 * - "Ask about this" calls _prefillChat (not _sendMessage)
 * - Button hidden when _prefillChat and _sendMessage are both null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'

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
  })
})

describe('InspectorCoaching', () => {
  it('renders static coaching text when no guidance items exist', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
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
    render(<InspectorCoaching {...defaultProps} />)
    // Should show fallback, not the guidance for node-99
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
    expect(screen.queryByText('Wrong node guidance')).toBeNull()
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

  it('"Ask about this" calls _prefillChat (not _sendMessage)', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send })
    render(<InspectorCoaching {...defaultProps} />)

    const button = screen.getByText('Ask about this')
    fireEvent.click(button)

    expect(prefill).toHaveBeenCalledTimes(1)
    expect(prefill).toHaveBeenCalledWith('How important is Marketing Budget to the outcome?')
    expect(send).not.toHaveBeenCalled()
  })

  it('falls back to _sendMessage when _prefillChat is null', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: send })
    render(<InspectorCoaching {...defaultProps} />)

    const button = screen.getByText('Ask about this')
    fireEvent.click(button)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('How important is Marketing Budget to the outcome?')
  })

  it('hides action button when both _prefillChat and _sendMessage are null', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null })
    render(<InspectorCoaching {...defaultProps} />)

    expect(screen.queryByText('Ask about this')).toBeNull()
    // But the coaching text itself should still render
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
  })

  it('renders guidance item action through CoachingCard visual (full thin border)', () => {
    useGuidanceStore.setState({
      guidanceItems: [makeGuidanceItem()],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    // CoachingCard uses inline style with info border
    const card = container.firstElementChild as HTMLElement
    expect(card.style.border).toContain('rgba(82, 163, 200, 0.3)')
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

  it('falls back to static coaching when related_elements has no id match', () => {
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
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
    expect(screen.queryByText('Unrelated guidance')).toBeNull()
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
