/**
 * Tests for GuidanceStrip (A.2 Task 2)
 *
 * Verifies:
 * - Renders highest-priority item
 * - Not rendered when items array is empty
 * - Action button triggers correct behaviour per type
 * - Dismiss hides until next envelope (new item_id)
 * - Hover (debounced) sets activeGuidanceItemId
 * - Mouse leave clears activeGuidanceItemId
 * - Keyboard focus sets activeGuidanceItemId, blur clears
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GuidanceStrip } from '../GuidanceStrip'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { _clearTraces, getInteractionChains } from '../../../lib/debug-state'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    signal_code: 'TEST',
    category: 'should_fix',
    source: 'structural',
    title: 'Consider reviewing this edge',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Tell me more.' },
    target_object: { type: 'node', id: 'node-1' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProps(overrides: Partial<Parameters<typeof GuidanceStrip>[0]> = {}) {
  return {
    onSendMessage: vi.fn(),
    onSetActive: vi.fn(),
    onScrollToPatch: vi.fn(),
    onOpenInspector: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
  _clearTraces()
  vi.useFakeTimers()
})

// ---------------------------------------------------------------------------
// Render conditions
// ---------------------------------------------------------------------------

describe('GuidanceStrip — render conditions', () => {
  it('is not rendered when guidance items are empty', () => {
    render(<GuidanceStrip {...makeProps()} />)
    expect(screen.queryByTestId('guidance-strip')).not.toBeInTheDocument()
  })

  it('renders when a guidance item is present', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    render(<GuidanceStrip {...makeProps()} />)
    expect(screen.getByTestId('guidance-strip')).toBeInTheDocument()
  })

  it('shows the title of the highest-priority item', () => {
    const items = [
      makeItem({ item_id: 'low', title: 'Low priority', priority: 10 }),
      makeItem({ item_id: 'high', title: 'High priority', priority: 90 }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    render(<GuidanceStrip {...makeProps()} />)
    expect(screen.getByText('High priority')).toBeInTheDocument()
    expect(screen.queryByText('Low priority')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Action button behaviour
// ---------------------------------------------------------------------------

describe('GuidanceStrip — action button behaviour', () => {
  it('discuss action calls onSendMessage with prompt', () => {
    const item = makeItem({ primary_action: { type: 'discuss', prompt: 'Let us discuss.' } })
    useGuidanceStore.getState().setGuidanceItems([item])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /discuss/i }))
    expect(props.onSendMessage).toHaveBeenCalledWith('Let us discuss.')
    expect(getInteractionChains()[0]?.triggerSurface).toBe('discuss_button')
    expect(getInteractionChains()[0]?.sourceSurface).toBe('ai_panel')
  })

  it('open_inspector action calls onOpenInspector with node_id', () => {
    const item = makeItem({ primary_action: { type: 'open_inspector', node_id: 'node-abc' } })
    useGuidanceStore.getState().setGuidanceItems([item])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /view/i }))
    expect(props.onOpenInspector).toHaveBeenCalledWith('node-abc')
  })

  it('run_exercise action calls onSendMessage with exercise trigger', () => {
    const item = makeItem({ primary_action: { type: 'run_exercise', exercise: 'pre_mortem' } })
    useGuidanceStore.getState().setGuidanceItems([item])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /try it/i }))
    expect(props.onSendMessage).toHaveBeenCalledWith('/exercise pre_mortem')
  })

  it('approve_patch action calls onScrollToPatch', () => {
    const item = makeItem({
      primary_action: {
        type: 'approve_patch',
        operations: [{ patch_id: 'patch-xyz' } as any],
      },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /review/i }))
    expect(props.onScrollToPatch).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Dismiss behaviour
// ---------------------------------------------------------------------------

describe('GuidanceStrip — dismiss', () => {
  it('hides strip after X button click', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    render(<GuidanceStrip {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByTestId('guidance-strip')).not.toBeInTheDocument()
  })

  it('re-shows strip when a new item (different item_id) arrives', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'first' })])
    const { rerender } = render(<GuidanceStrip {...makeProps()} />)

    // Dismiss current item
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByTestId('guidance-strip')).not.toBeInTheDocument()

    // New envelope arrives with different item_id
    act(() => {
      useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'second', title: 'New item' })])
    })
    rerender(<GuidanceStrip {...makeProps()} />)
    expect(screen.getByTestId('guidance-strip')).toBeInTheDocument()
    expect(screen.getByText('New item')).toBeInTheDocument()
  })

  it('re-shows strip when new envelope contains the same item_id as the dismissed item', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'reused-id', title: 'First appearance' })])
    const { rerender } = render(<GuidanceStrip {...makeProps()} />)

    // Dismiss item
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByTestId('guidance-strip')).not.toBeInTheDocument()

    // New envelope arrives — same item_id, new array reference
    act(() => {
      useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'reused-id', title: 'Second appearance' })])
    })
    rerender(<GuidanceStrip {...makeProps()} />)
    // dismissedId should have been cleared on envelope refresh → item shows again
    expect(screen.getByTestId('guidance-strip')).toBeInTheDocument()
    expect(screen.getByText('Second appearance')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Focus interaction (debounced hover + keyboard)
// ---------------------------------------------------------------------------

describe('GuidanceStrip — focus interaction', () => {
  it('hover calls onSetActive with item_id after 150ms debounce', async () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'item-1' })])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)

    fireEvent.mouseEnter(screen.getByTestId('guidance-strip'))
    expect(props.onSetActive).not.toHaveBeenCalled() // not yet

    act(() => { vi.advanceTimersByTime(150) })
    expect(props.onSetActive).toHaveBeenCalledWith('item-1')
  })

  it('mouse leave clears activeGuidanceItemId', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)

    fireEvent.mouseEnter(screen.getByTestId('guidance-strip'))
    act(() => { vi.advanceTimersByTime(150) })
    fireEvent.mouseLeave(screen.getByTestId('guidance-strip'))
    expect(props.onSetActive).toHaveBeenLastCalledWith(null)
  })

  it('keyboard focus on action button sets activeGuidanceItemId', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'item-focus' })])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)

    const btn = screen.getByRole('button', { name: /discuss/i })
    fireEvent.focus(btn)
    expect(props.onSetActive).toHaveBeenCalledWith('item-focus')
  })

  it('blur on action button clears activeGuidanceItemId', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    const props = makeProps()
    render(<GuidanceStrip {...props} />)

    const btn = screen.getByRole('button', { name: /discuss/i })
    fireEvent.focus(btn)
    fireEvent.blur(btn)
    expect(props.onSetActive).toHaveBeenLastCalledWith(null)
  })
})

// ---------------------------------------------------------------------------
// Category badge
// ---------------------------------------------------------------------------

describe('GuidanceStrip — category badge', () => {
  it.each([
    ['must_fix', 'Must fix'],
    ['should_fix', 'Should fix'],
    ['could_fix', 'Could fix'],
    ['technique', 'Technique'],
  ] as const)('renders sentence-case label for %s', (category, expected) => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ category })])
    render(<GuidanceStrip {...makeProps()} />)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
