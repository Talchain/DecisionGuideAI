/**
 * Tests for guidanceStore (A.2 Task 1)
 *
 * Verifies:
 * - setGuidanceItems replaces array + clears stale activeGuidanceItemId
 * - clearGuidanceItems empties array + clears active
 * - setActiveGuidanceItem sets and clears
 * - selectItemsForTarget filters correctly
 * - selectTopItem returns highest priority
 * - selectActiveItem returns matching item or null
 * - Empty array handled throughout
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useGuidanceStore,
  selectItemsForTarget,
  selectTopItem,
  selectActiveItem,
  type GuidanceItem,
} from '../guidanceStore'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    signal_code: 'DEFAULT_EDGE_STRENGTH',
    category: 'should_fix',
    source: 'structural',
    title: 'Add edge strength',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Tell me about this edge.' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
})

// ---------------------------------------------------------------------------
// setGuidanceItems
// ---------------------------------------------------------------------------

describe('guidanceStore — setGuidanceItems', () => {
  it('replaces the items array', () => {
    const a = makeItem({ item_id: 'a', title: 'A', priority: 10 })
    const b = makeItem({ item_id: 'b', title: 'B', priority: 20 })
    useGuidanceStore.getState().setGuidanceItems([a])
    useGuidanceStore.getState().setGuidanceItems([b])
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
    expect(useGuidanceStore.getState().guidanceItems[0].item_id).toBe('b')
  })

  it('clears activeGuidanceItemId when the active item no longer exists in the new array', () => {
    const a = makeItem({ item_id: 'old-item' })
    useGuidanceStore.getState().setGuidanceItems([a])
    useGuidanceStore.getState().setActiveGuidanceItem('old-item')
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('old-item')

    const b = makeItem({ item_id: 'new-item' })
    useGuidanceStore.getState().setGuidanceItems([b])
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })

  it('preserves activeGuidanceItemId when the active item still exists in the new array', () => {
    const a = makeItem({ item_id: 'stays' })
    useGuidanceStore.getState().setGuidanceItems([a])
    useGuidanceStore.getState().setActiveGuidanceItem('stays')

    // Envelope with same item
    const updated = makeItem({ item_id: 'stays', title: 'Updated title' })
    useGuidanceStore.getState().setGuidanceItems([updated])
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('stays')
  })

  it('handles empty array', () => {
    useGuidanceStore.getState().setGuidanceItems([])
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// clearGuidanceItems
// ---------------------------------------------------------------------------

describe('guidanceStore — clearGuidanceItems', () => {
  it('empties items array and clears activeGuidanceItemId', () => {
    const a = makeItem()
    useGuidanceStore.getState().setGuidanceItems([a])
    useGuidanceStore.getState().setActiveGuidanceItem('item-1')

    useGuidanceStore.getState().clearGuidanceItems()

    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })

  it('is idempotent on empty store', () => {
    useGuidanceStore.getState().clearGuidanceItems()
    useGuidanceStore.getState().clearGuidanceItems()
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// setActiveGuidanceItem
// ---------------------------------------------------------------------------

describe('guidanceStore — setActiveGuidanceItem', () => {
  it('sets the focused item ID', () => {
    useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('item-1')
  })

  it('clears with null', () => {
    useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    useGuidanceStore.getState().setActiveGuidanceItem(null)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// selectItemsForTarget
// ---------------------------------------------------------------------------

describe('guidanceStore — selectItemsForTarget', () => {
  it('returns items where target_object.id matches', () => {
    const items = [
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'node-1' } }),
      makeItem({ item_id: 'b', target_object: { type: 'node', id: 'node-2' } }),
      makeItem({ item_id: 'c', target_object: { type: 'node', id: 'node-1' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    const state = useGuidanceStore.getState()
    const result = selectItemsForTarget(state, 'node-1')
    expect(result).toHaveLength(2)
    expect(result.map((i) => i.item_id)).toEqual(['a', 'c'])
  })

  it('returns empty array for unknown target', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'a', target_object: { type: 'node', id: 'node-1' } })])
    const result = selectItemsForTarget(useGuidanceStore.getState(), 'node-999')
    expect(result).toHaveLength(0)
  })

  it('returns empty array when no items in store', () => {
    const result = selectItemsForTarget(useGuidanceStore.getState(), 'node-1')
    expect(result).toHaveLength(0)
  })

  it('excludes items with no target_object', () => {
    const items = [
      makeItem({ item_id: 'no-target' }), // no target_object
      makeItem({ item_id: 'with-target', target_object: { type: 'node', id: 'node-1' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    const result = selectItemsForTarget(useGuidanceStore.getState(), 'node-1')
    expect(result).toHaveLength(1)
    expect(result[0].item_id).toBe('with-target')
  })
})

// ---------------------------------------------------------------------------
// selectTopItem
// ---------------------------------------------------------------------------

describe('guidanceStore — selectTopItem', () => {
  it('returns the highest priority item', () => {
    const items = [
      makeItem({ item_id: 'low', priority: 20 }),
      makeItem({ item_id: 'high', priority: 90 }),
      makeItem({ item_id: 'mid', priority: 50 }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    const top = selectTopItem(useGuidanceStore.getState())
    expect(top?.item_id).toBe('high')
  })

  it('returns null when items array is empty', () => {
    const top = selectTopItem(useGuidanceStore.getState())
    expect(top).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// selectActiveItem
// ---------------------------------------------------------------------------

describe('guidanceStore — selectActiveItem', () => {
  it('returns the full item when active ID matches', () => {
    const item = makeItem({ item_id: 'active-one', title: 'Active Item' })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().setActiveGuidanceItem('active-one')
    const active = selectActiveItem(useGuidanceStore.getState())
    expect(active?.title).toBe('Active Item')
  })

  it('returns null when no active ID', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    const active = selectActiveItem(useGuidanceStore.getState())
    expect(active).toBeNull()
  })

  it('returns null when active ID does not match any item', () => {
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'a' })])
    useGuidanceStore.getState().setActiveGuidanceItem('non-existent')
    const active = selectActiveItem(useGuidanceStore.getState())
    expect(active).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// evictStaleItems — valid_while staleness
// ---------------------------------------------------------------------------

describe('guidanceStore — evictStaleItems', () => {
  it('clears item with valid_while.analysis_hash when analysis hash changes', () => {
    const item = makeItem({
      item_id: 'stale',
      valid_while: { analysis_hash: 'abc' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: 'def' })
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('clears item with valid_while.analysis_hash when currentAnalysisHash is null (unknown)', () => {
    const item = makeItem({
      item_id: 'stale',
      valid_while: { analysis_hash: 'abc' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: null })
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('keeps item with valid_while.analysis_hash when hash matches', () => {
    const item = makeItem({
      item_id: 'valid',
      valid_while: { analysis_hash: 'abc' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: 'abc' })
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })

  it('keeps item with no valid_while when graph hash changes', () => {
    const item = makeItem({ item_id: 'no-vw' }) // no valid_while
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: 'xyz', graphChanged: true })
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })

  it('clears item with valid_while.graph_hash when graphChanged is true', () => {
    const item = makeItem({
      item_id: 'graph-stale',
      valid_while: { graph_hash: 'abc' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: null, graphChanged: true })
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('does not clear item with valid_while.graph_hash when graphChanged is false', () => {
    const item = makeItem({
      item_id: 'graph-ok',
      valid_while: { graph_hash: 'abc' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: null, graphChanged: false })
    // graph_hash only; no analysis_hash → kept when graphChanged=false
    // But analysis_hash is undefined so that check is skipped
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })

  it('clears stale activeGuidanceItemId when evicted item was active', () => {
    const item = makeItem({
      item_id: 'active-stale',
      valid_while: { analysis_hash: 'abc' },
    })
    useGuidanceStore.getState().setGuidanceItems([item])
    useGuidanceStore.getState().setActiveGuidanceItem('active-stale')
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: 'different' })
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })

  it('is a no-op when store is empty', () => {
    useGuidanceStore.getState().evictStaleItems({ currentAnalysisHash: 'xyz', graphChanged: true })
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// clearItemsByTargetIds
// ---------------------------------------------------------------------------

describe('guidanceStore — clearItemsByTargetIds', () => {
  it('removes matching items where target_object.type is node or edge', () => {
    const items = [
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'n1' } }),
      makeItem({ item_id: 'b', target_object: { type: 'edge', id: 'e1' } }),
      makeItem({ item_id: 'c', target_object: { type: 'node', id: 'n2' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    useGuidanceStore.getState().clearItemsByTargetIds(['n1', 'e1'])
    const remaining = useGuidanceStore.getState().guidanceItems
    expect(remaining).toHaveLength(1)
    expect(remaining[0].item_id).toBe('c')
  })

  it('non-matching items remain after clear', () => {
    const items = [
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'n1' } }),
      makeItem({ item_id: 'b', target_object: { type: 'node', id: 'n99' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    useGuidanceStore.getState().clearItemsByTargetIds(['n1'])
    const remaining = useGuidanceStore.getState().guidanceItems
    expect(remaining).toHaveLength(1)
    expect(remaining[0].item_id).toBe('b')
  })

  it('empty target IDs array → no items cleared', () => {
    const items = [makeItem({ item_id: 'a', target_object: { type: 'node', id: 'n1' } })]
    useGuidanceStore.getState().setGuidanceItems(items)
    useGuidanceStore.getState().clearItemsByTargetIds([])
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })

  it('GuidanceItem with no target_object → not cleared', () => {
    const items = [
      makeItem({ item_id: 'no-target' }), // no target_object
      makeItem({ item_id: 'has-target', target_object: { type: 'node', id: 'n1' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    useGuidanceStore.getState().clearItemsByTargetIds(['n1'])
    const remaining = useGuidanceStore.getState().guidanceItems
    expect(remaining).toHaveLength(1)
    expect(remaining[0].item_id).toBe('no-target')
  })

  it('GuidanceItem with target_object.type not node/edge → not cleared', () => {
    const items = [
      makeItem({ item_id: 'graph-target', target_object: { type: 'graph', id: 'n1' } }),
      makeItem({ item_id: 'framing-target', target_object: { type: 'framing', id: 'n1' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    useGuidanceStore.getState().clearItemsByTargetIds(['n1'])
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(2)
  })

  it('multiple matches → all cleared', () => {
    const items = [
      makeItem({ item_id: 'a', target_object: { type: 'node', id: 'shared' } }),
      makeItem({ item_id: 'b', target_object: { type: 'edge', id: 'shared' } }),
      makeItem({ item_id: 'c', target_object: { type: 'node', id: 'other' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    useGuidanceStore.getState().clearItemsByTargetIds(['shared'])
    const remaining = useGuidanceStore.getState().guidanceItems
    expect(remaining).toHaveLength(1)
    expect(remaining[0].item_id).toBe('c')
  })

  it('clears activeGuidanceItemId when cleared item was active', () => {
    const items = [
      makeItem({ item_id: 'target-item', target_object: { type: 'node', id: 'n1' } }),
    ]
    useGuidanceStore.getState().setGuidanceItems(items)
    useGuidanceStore.getState().setActiveGuidanceItem('target-item')
    useGuidanceStore.getState().clearItemsByTargetIds(['n1'])
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBeNull()
  })
})
