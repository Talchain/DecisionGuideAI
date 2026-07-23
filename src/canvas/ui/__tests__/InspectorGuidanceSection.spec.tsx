/**
 * Tests for InspectorGuidanceSection (A.2 Task 3)
 *
 * Verifies:
 * - Filters by selected element ID (target_object.id)
 * - Max 2 items shown
 * - "+N more" count shown when additional items exist
 * - Empty state renders correctly
 * - Recomputes when selection changes
 * - External activeGuidanceItemId highlights matching card
 * - Action button triggers correct behaviour
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { InspectorGuidanceSection } from '../inspector/InspectorGuidanceSection'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    signal_code: 'TEST',
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: 'node-a' },
    ...overrides,
  }
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
})

// ---------------------------------------------------------------------------
// Filtering by element ID
// ---------------------------------------------------------------------------

describe('InspectorGuidanceSection — filtering', () => {
  it('shows only items whose target_object.id matches elementId', () => {
    const items = [
      makeItem({ item_id: 'match', title: 'Match item', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'no-match', title: 'Other item', target_object: { type: 'node', id: 'node-b' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    render(<InspectorGuidanceSection elementId="node-a" />)
    expect(screen.getByText('Match item')).toBeInTheDocument()
    expect(screen.queryByText('Other item')).not.toBeInTheDocument()
  })

  it('renders nothing when no items match', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'different-node' } })])
    const { container } = render(<InspectorGuidanceSection elementId="node-a" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when store is empty', () => {
    const { container } = render(<InspectorGuidanceSection elementId="node-a" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Max 2 items + "+N more" count
// ---------------------------------------------------------------------------

describe('InspectorGuidanceSection — max 2 items', () => {
  it('shows max 2 items when 3 match', () => {
    const items = [
      makeItem({ item_id: 'a', title: 'Item A', priority: 30, target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'b', title: 'Item B', priority: 50, target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'c', title: 'Item C', priority: 70, target_object: { type: 'node', id: 'node-a' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    render(<InspectorGuidanceSection elementId="node-a" />)

    // Should show highest priority first
    const cards = screen.getAllByTestId('inspector-guidance-card')
    expect(cards).toHaveLength(2)
  })

  it('shows "+1 more" when 3 items match', () => {
    const items = [
      makeItem({ item_id: 'a', priority: 30, target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'b', priority: 50, target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'c', priority: 70, target_object: { type: 'node', id: 'node-a' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    render(<InspectorGuidanceSection elementId="node-a" />)
    expect(screen.getByText(/\+1 more suggestion/)).toBeInTheDocument()
  })

  it('shows "+2 more" when 4 items match', () => {
    const items = Array.from({ length: 4 }, (_, i) =>
      makeItem({ item_id: `item-${i}`, priority: i * 10, target_object: { type: 'node', id: 'node-a' } }),
    )
    useGuidanceStore.getState().setGuidanceItems(items)
    render(<InspectorGuidanceSection elementId="node-a" />)
    expect(screen.getByText(/\+2 more suggestions/)).toBeInTheDocument()
  })

  it('does NOT show "+N more" when only 2 items match', () => {
    const items = [
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'b', target_object: { type: 'node', id: 'node-a' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    render(<InspectorGuidanceSection elementId="node-a" />)
    expect(screen.queryByText(/more suggestion/)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Recomputes when selection changes
// ---------------------------------------------------------------------------

describe('InspectorGuidanceSection — selection changes', () => {
  it('recomputes when elementId prop changes', () => {
    const items = [
      makeItem({ item_id: 'for-a', title: 'Node A item', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'for-b', title: 'Node B item', target_object: { type: 'node', id: 'node-b' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)

    const { rerender } = render(<InspectorGuidanceSection elementId="node-a" />)
    expect(screen.getByText('Node A item')).toBeInTheDocument()

    rerender(<InspectorGuidanceSection elementId="node-b" />)
    expect(screen.getByText('Node B item')).toBeInTheDocument()
    expect(screen.queryByText('Node A item')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Category icon — shared source of truth with the on-canvas node marker
// ---------------------------------------------------------------------------

describe('InspectorGuidanceSection — category icon (shared SOT)', () => {
  it('renders the danger AlertTriangle on a must_fix/should_fix card', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ category: 'must_fix', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<InspectorGuidanceSection elementId="node-a" />)
    const icon = screen.getByTestId('inspector-guidance-card').querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('class')).toContain('text-danger')
  })

  it('renders the info Lightbulb on an UNCATEGORISED card (unified with the canvas marker)', () => {
    // Deliberate behaviour change: an item the producer never categorised used
    // to render NO icon on the card while the on-canvas marker showed the
    // Lightbulb — a live divergence. Both now derive from guidanceCategoryIcon,
    // so the card shows the info Lightbulb too. RED before the fix (cardIcon had
    // no default branch → undefined → no svg).
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ category: undefined, target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<InspectorGuidanceSection elementId="node-a" />)
    const icon = screen.getByTestId('inspector-guidance-card').querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('class')).toContain('text-info')
  })
})

// ---------------------------------------------------------------------------
// External activeGuidanceItemId highlights matching card
// ---------------------------------------------------------------------------

describe('InspectorGuidanceSection — external active ID highlight', () => {
  it('applies data-item-id to cards for identification', () => {
    const item = makeItem({ item_id: 'highlight-me', target_object: { type: 'node', id: 'node-a' } })
    useGuidanceStore.getState().setGuidanceItems([item])
    render(<InspectorGuidanceSection elementId="node-a" />)

    const card = screen.getByTestId('inspector-guidance-card')
    expect(card).toHaveAttribute('data-item-id', 'highlight-me')
  })

  it('applies ring class when item is the active guidance item', () => {
    const item = makeItem({ item_id: 'active-item', target_object: { type: 'node', id: 'node-a' } })
    useGuidanceStore.getState().setGuidanceItems([item])
    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('active-item')
    })

    render(<InspectorGuidanceSection elementId="node-a" />)
    const card = screen.getByTestId('inspector-guidance-card')
    // Active item should have ring class applied
    expect(card.className).toMatch(/ring/)
  })
})

// ---------------------------------------------------------------------------
// Action button behaviour
// ---------------------------------------------------------------------------

describe('InspectorGuidanceSection — action buttons', () => {
  it('discuss action calls onSendMessage', () => {
    const item = makeItem({
      primary_action: { type: 'discuss', prompt: 'Discuss this.' },
      target_object: { type: 'node', id: 'node-a' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    const onSendMessage = vi.fn()
    render(<InspectorGuidanceSection elementId="node-a" onSendMessage={onSendMessage} />)

    fireEvent.click(screen.getByRole('button', { name: /discuss/i }))
    expect(onSendMessage).toHaveBeenCalledWith('Discuss this.')
  })

  it('open_inspector action calls onOpenInspector', () => {
    const item = makeItem({
      primary_action: { type: 'open_inspector', node_id: 'other-node' },
      target_object: { type: 'node', id: 'node-a' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    const onOpenInspector = vi.fn()
    render(<InspectorGuidanceSection elementId="node-a" onOpenInspector={onOpenInspector} />)

    fireEvent.click(screen.getByRole('button', { name: /view/i }))
    expect(onOpenInspector).toHaveBeenCalledWith('other-node')
  })

  it('open_inspector fallback calls canvasStore directly when no onOpenInspector prop', () => {
    const item = makeItem({
      primary_action: { type: 'open_inspector', node_id: 'target-node' },
      target_object: { type: 'node', id: 'node-a' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    const selectSpy = vi.spyOn(useCanvasStore.getState(), 'selectNodeWithoutHistory')
    const inspectorSpy = vi.spyOn(useCanvasStore.getState(), 'setShowInspectorPanel')

    // No onOpenInspector prop — should fall back to canvasStore
    render(<InspectorGuidanceSection elementId="node-a" />)
    fireEvent.click(screen.getByRole('button', { name: /view/i }))

    expect(selectSpy).toHaveBeenCalledWith('target-node')
    expect(inspectorSpy).toHaveBeenCalledWith(true)

    selectSpy.mockRestore()
    inspectorSpy.mockRestore()
  })

  it('discuss action uses store-registered sendMessage when no prop provided', () => {
    const item = makeItem({
      primary_action: { type: 'discuss', prompt: 'Via store.' },
      target_object: { type: 'node', id: 'node-a' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])

    // Register a store callback (simulating ConversationPanel mount)
    const storeSend = vi.fn()
    useGuidanceStore.getState().registerConversationCallbacks(storeSend, vi.fn())

    // No onSendMessage prop
    render(<InspectorGuidanceSection elementId="node-a" />)
    fireEvent.click(screen.getByRole('button', { name: /discuss/i }))

    expect(storeSend).toHaveBeenCalledWith('Via store.')

    // Cleanup
    useGuidanceStore.setState({ _sendMessage: null, _scrollToPatch: null })
  })
})
