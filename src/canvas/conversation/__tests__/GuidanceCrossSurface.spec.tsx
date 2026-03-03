/**
 * Cross-surface guidance integration tests (A.2 Task 5)
 *
 * Pure store-level tests — no React rendering needed.
 * Verifies that store state behaves correctly for all surfaces:
 * - setGuidanceItems clears stale activeGuidanceItemId
 * - clearGuidanceItems (graph edit) clears all guidance state
 * - setActiveGuidanceItem propagates correctly
 * - selectActiveItem returns correct item
 * - Top item for strip is independent of active item (hover)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useGuidanceStore, selectActiveItem, selectTopItem, type GuidanceItem } from '../../stores/guidanceStore'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    signal_code: 'TEST',
    category: 'should_fix',
    source: 'structural',
    title: 'Test guidance item',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Discuss.' },
    target_object: { type: 'node', id: 'node-1' },
    ...overrides,
  }
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
})

// ---------------------------------------------------------------------------
// New envelope → stale state cleaned up
// ---------------------------------------------------------------------------

describe('Cross-surface: setGuidanceItems → all surfaces clear on new envelope', () => {
  it('replacing guidance_items clears stale activeGuidanceItemId if item no longer present', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'old' })])
    useGuidanceStore.getState().setActiveGuidanceItem('old')
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('old')

    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'new' })])
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })

  it('setGuidanceItems with empty array → activeGuidanceItemId cleared', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    useGuidanceStore.getState().setActiveGuidanceItem('item-1')

    useGuidanceStore.getState().setGuidanceItems([])
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Local graph edit → clearGuidanceItems → all surfaces clear
// ---------------------------------------------------------------------------

describe('Cross-surface: clearGuidanceItems (local graph edit)', () => {
  it('empties items and clears activeGuidanceItemId', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    useGuidanceStore.getState().setActiveGuidanceItem('item-1')

    useGuidanceStore.getState().clearGuidanceItems()

    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })

  it('after clearGuidanceItems, selectTopItem returns null (strip would not render)', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    useGuidanceStore.getState().clearGuidanceItems()

    const top = selectTopItem(useGuidanceStore.getState())
    expect(top).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// setActiveGuidanceItem → all surfaces see the update
// ---------------------------------------------------------------------------

describe('Cross-surface: setActiveGuidanceItem propagates', () => {
  it('setting activeGuidanceItemId is visible across store state', () => {
    const item = makeItem({ item_id: 'cross-test' })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().setActiveGuidanceItem('cross-test')
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('cross-test')
  })

  it('strip shows top item regardless of which item is focused (inspector hover)', () => {
    const items = [
      makeItem({ item_id: 'low', priority: 10, title: 'Low item' }),
      makeItem({ item_id: 'high', priority: 90, title: 'High item' }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)

    // Inspector hovers over low priority item — sets active
    useGuidanceStore.getState().setActiveGuidanceItem('low')

    // Top item for strip is still highest priority (independent of active)
    const top = selectTopItem(useGuidanceStore.getState())
    expect(top?.item_id).toBe('high')
    // Active for cross-surface canvas highlight is the hovered (low)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('low')
  })
})

// ---------------------------------------------------------------------------
// approve_patch action sets activeGuidanceItemId
// ---------------------------------------------------------------------------

describe('Cross-surface: approve_patch from strip', () => {
  it('approve_patch item can be set as active guidance item', () => {
    const item = makeItem({
      item_id: 'patch-item',
      primary_action: {
        type: 'approve_patch',
        operations: [{ patch_id: 'patch-123' } as any],
      },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().setActiveGuidanceItem('patch-item')
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('patch-item')
  })
})

// ---------------------------------------------------------------------------
// Keyboard: selectActiveItem reflects active ID
// ---------------------------------------------------------------------------

describe('Cross-surface: keyboard integration (store assertions)', () => {
  it('setting active ID causes selectActiveItem to return that item', () => {
    const item = makeItem({ item_id: 'kb-item', title: 'Keyboard item' })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().setActiveGuidanceItem('kb-item')

    const active = selectActiveItem(useGuidanceStore.getState())
    expect(active?.title).toBe('Keyboard item')
  })

  it('clearing active ID causes selectActiveItem to return null', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'x' })])
    useGuidanceStore.getState().setActiveGuidanceItem('x')
    useGuidanceStore.getState().setActiveGuidanceItem(null)

    const active = selectActiveItem(useGuidanceStore.getState())
    expect(active).toBeNull()
  })
})
