/**
 * NodeCoachingMarker — pins for the on-canvas coaching marker that replaced the
 * dead CEE/ISL NodeBadge (23-Jul capability audit G3 + G-item-2).
 *
 * Pins (each RED without the component's corresponding behaviour):
 *  - marker renders IFF a live guidance item names this node (target_object.id)
 *  - unresolvable / non-matching target id → no marker (fail-closed by construction)
 *  - empty store → no marker (no permanently-empty UI; the slot is live, not dead)
 *  - click reaches the inspector open seam (select node + open inspector + setActive)
 *  - a resolved / dismissed item clears the marker
 *  - cap: one marker per node, "+N" count, never badge soup
 *  - colour = state: tone derived from the top item's producer category
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NodeCoachingMarker } from '../NodeCoachingMarker'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'
import { useCanvasStore } from '../../../store'

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
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
// Presence: renders iff a live item names this node
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — presence', () => {
  it('renders a marker when a live item targets this node', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getByTestId('node-coaching-marker-node-a')).toBeInTheDocument()
  })

  it('renders NOTHING when no item targets this node (item names a different node)', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-b' } })])
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders NOTHING when the store is empty (no permanently-empty slot)', () => {
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })

  it('fail-closed: an unresolvable target id surfaces no marker on any real node', () => {
    // Item names a node id that no node carries. Every real node renders its own
    // marker keyed to its OWN id, so a ghost id can never mount one.
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'ghost-node' } })])
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })

  it('ignores items with no target_object', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: undefined })])
    const { container } = render(<NodeCoachingMarker nodeId="node-a" />)
    expect(container.innerHTML).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Click seam
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — click reaches the guidance surface', () => {
  it('selects the node, opens the inspector, and activates the item', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ item_id: 'the-item', target_object: { type: 'node', id: 'node-a' } })])
    const selectSpy = vi.spyOn(useCanvasStore.getState(), 'selectNodeWithoutHistory')
    const inspectorSpy = vi.spyOn(useCanvasStore.getState(), 'setShowInspectorPanel')

    render(<NodeCoachingMarker nodeId="node-a" />)
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))

    expect(selectSpy).toHaveBeenCalledWith('node-a')
    expect(inspectorSpy).toHaveBeenCalledWith(true)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('the-item')

    selectSpy.mockRestore()
    inspectorSpy.mockRestore()
  })

  it('activates the highest-severity item when several target the node', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'low', category: 'could_fix', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'high', category: 'must_fix', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// Lifecycle: resolved / dismissed item clears the marker
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — lifecycle', () => {
  it('clears the marker when the targeting item is dismissed', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ item_id: 'gone', target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getByTestId('node-coaching-marker-node-a')).toBeInTheDocument()

    act(() => {
      useGuidanceStore.getState().dismissItem('gone')
    })
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })

  it('clears the marker when the item is cleared by target id (node edited)', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getByTestId('node-coaching-marker-node-a')).toBeInTheDocument()

    act(() => {
      useGuidanceStore.getState().clearItemsByTargetIds(['node-a'])
    })
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Cap: one marker + count, never badge soup
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — cap (1 + count)', () => {
  it('renders exactly ONE marker even when several items target the node', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'b', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'c', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    expect(screen.getAllByTestId('node-coaching-marker-node-a')).toHaveLength(1)
  })

  it('shows the count when more than one item targets the node', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'b', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'c', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-count', '3')
    expect(marker.textContent).toContain('3')
  })

  it('shows no count digit for a single item', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-count', '1')
    expect(marker.textContent?.trim()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Colour = state (tone from producer category)
// ---------------------------------------------------------------------------

describe('NodeCoachingMarker — colour by category', () => {
  it('must_fix rides the danger channel', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ category: 'must_fix', target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-category', 'must_fix')
    expect(marker.className).toContain('border-danger/30')
    expect(marker.querySelector('svg')?.getAttribute('class')).toContain('text-danger')
  })

  it('could_fix rides the info channel', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ category: 'could_fix', target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker.className).toContain('border-info/30')
    expect(marker.querySelector('svg')?.getAttribute('class')).toContain('text-info')
  })

  it('an uncategorised item falls to the info channel (honest absence, never invented severity)', () => {
    useGuidanceStore
      .getState()
      .setGuidanceItems([makeItem({ category: undefined, target_object: { type: 'node', id: 'node-a' } })])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-category', 'uncategorised')
    expect(marker.className).toContain('border-info/30')
  })

  it('tone follows the highest-severity item among several', () => {
    useGuidanceStore.getState().setGuidanceItems([
      makeItem({ item_id: 'low', category: 'could_fix', target_object: { type: 'node', id: 'node-a' } }),
      makeItem({ item_id: 'high', category: 'must_fix', target_object: { type: 'node', id: 'node-a' } }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const marker = screen.getByTestId('node-coaching-marker-node-a')
    expect(marker).toHaveAttribute('data-guidance-category', 'must_fix')
    expect(marker.className).toContain('border-danger/30')
  })
})
