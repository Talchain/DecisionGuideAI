/**
 * extractBaseRateChipSet — unit tests
 *
 * Covers:
 * - Returns undefined when guidance_items is undefined, null, or empty
 * - Returns undefined when no items match MISSING_BASE_RATE + discuss
 * - Returns the highest-priority match (lowest number)
 * - Falls back to "This factor" when target_object.label is missing
 * - Ignores items with non-discuss primary_action
 * - Ignores items with wrong signal_code
 */

import { describe, it, expect } from 'vitest'
import { extractBaseRateChipSet } from '../useConversation'
import type { GuidanceItem } from '../../stores/guidanceStore'

function makeGuidanceItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g-1',
    signal_code: 'MISSING_BASE_RATE',
    category: 'should_fix',
    source: 'analysis',
    title: 'Set base rate',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'How common is this?' },
    target_object: { type: 'node', id: 'factor-1', label: 'Market demand' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Empty / null / undefined input
// ---------------------------------------------------------------------------

describe('extractBaseRateChipSet — no items', () => {
  it('returns undefined when guidance_items is undefined', () => {
    expect(extractBaseRateChipSet(undefined)).toBeUndefined()
  })

  it('returns undefined when guidance_items is null', () => {
    expect(extractBaseRateChipSet(null)).toBeUndefined()
  })

  it('returns undefined when guidance_items is empty array', () => {
    expect(extractBaseRateChipSet([])).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// No matching items
// ---------------------------------------------------------------------------

describe('extractBaseRateChipSet — no matches', () => {
  it('returns undefined when no items have MISSING_BASE_RATE signal_code', () => {
    const items = [
      makeGuidanceItem({ signal_code: 'MISSING_EVIDENCE' }),
      makeGuidanceItem({ signal_code: 'LOW_CONFIDENCE' }),
    ]
    expect(extractBaseRateChipSet(items)).toBeUndefined()
  })

  it('returns undefined when MISSING_BASE_RATE items have non-discuss action', () => {
    const items = [
      makeGuidanceItem({ primary_action: { type: 'open_inspector', node_id: 'n1' } }),
      makeGuidanceItem({ primary_action: { type: 'navigate', target: 'results' } }),
    ]
    expect(extractBaseRateChipSet(items)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Priority selection
// ---------------------------------------------------------------------------

describe('extractBaseRateChipSet — priority', () => {
  it('selects highest-priority item (lowest number)', () => {
    const items = [
      makeGuidanceItem({ item_id: 'g-low', priority: 80, target_object: { type: 'node', id: 'f1', label: 'Low priority' } }),
      makeGuidanceItem({ item_id: 'g-high', priority: 10, target_object: { type: 'node', id: 'f2', label: 'High priority' } }),
      makeGuidanceItem({ item_id: 'g-mid', priority: 50, target_object: { type: 'node', id: 'f3', label: 'Mid priority' } }),
    ]
    const result = extractBaseRateChipSet(items)
    expect(result).toEqual({ factorLabel: 'High priority', itemId: 'g-high' })
  })

  it('returns only one factor even when multiple match', () => {
    const items = [
      makeGuidanceItem({ item_id: 'g-1', priority: 30, target_object: { type: 'node', id: 'f1', label: 'Factor A' } }),
      makeGuidanceItem({ item_id: 'g-2', priority: 20, target_object: { type: 'node', id: 'f2', label: 'Factor B' } }),
    ]
    const result = extractBaseRateChipSet(items)
    expect(result?.factorLabel).toBe('Factor B')
    expect(result?.itemId).toBe('g-2')
  })

  it('treats missing priority as 100 (lowest)', () => {
    const items = [
      makeGuidanceItem({ item_id: 'g-1', priority: undefined as unknown as number, target_object: { type: 'node', id: 'f1', label: 'No priority' } }),
      makeGuidanceItem({ item_id: 'g-2', priority: 50, target_object: { type: 'node', id: 'f2', label: 'Has priority' } }),
    ]
    const result = extractBaseRateChipSet(items)
    expect(result?.factorLabel).toBe('Has priority')
  })
})

// ---------------------------------------------------------------------------
// Label fallback
// ---------------------------------------------------------------------------

describe('extractBaseRateChipSet — label', () => {
  it('uses target_object.label when present', () => {
    const items = [makeGuidanceItem({ target_object: { type: 'node', id: 'f1', label: 'Revenue growth' } })]
    expect(extractBaseRateChipSet(items)?.factorLabel).toBe('Revenue growth')
  })

  it('falls back to "This factor" when target_object is missing', () => {
    const items = [makeGuidanceItem({ target_object: undefined })]
    expect(extractBaseRateChipSet(items)?.factorLabel).toBe('This factor')
  })

  it('falls back to "This factor" when target_object.label is missing', () => {
    const items = [makeGuidanceItem({ target_object: { type: 'node', id: 'f1' } })]
    expect(extractBaseRateChipSet(items)?.factorLabel).toBe('This factor')
  })

  it('falls back to "This factor" when target_object.label is empty string', () => {
    const items = [makeGuidanceItem({ target_object: { type: 'node', id: 'f1', label: '' } })]
    expect(extractBaseRateChipSet(items)?.factorLabel).toBe('This factor')
  })
})

// ---------------------------------------------------------------------------
// Mixed items
// ---------------------------------------------------------------------------

describe('extractBaseRateChipSet — mixed guidance items', () => {
  it('ignores non-matching items and selects the correct one', () => {
    const items = [
      makeGuidanceItem({ item_id: 'g-other', signal_code: 'MISSING_EVIDENCE', priority: 5 }),
      makeGuidanceItem({ item_id: 'g-match', signal_code: 'MISSING_BASE_RATE', priority: 20, target_object: { type: 'node', id: 'f1', label: 'Customer churn' } }),
      makeGuidanceItem({ item_id: 'g-wrong-action', signal_code: 'MISSING_BASE_RATE', primary_action: { type: 'open_inspector', node_id: 'n1' }, priority: 10 }),
    ]
    const result = extractBaseRateChipSet(items)
    expect(result).toEqual({ factorLabel: 'Customer churn', itemId: 'g-match' })
  })
})
