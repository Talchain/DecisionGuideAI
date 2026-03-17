/**
 * Tests for useGuidancePulseHighlight (A.2 Task 4)
 *
 * Uses a shallow mock DOM renderer — does NOT mount the full React Flow canvas.
 * Verifies:
 * - Correct CSS class applied to targeted node/edge element
 * - Class removed when activeGuidanceItemId clears
 * - No highlight for 'graph'/'framing' targets (no specific element)
 * - Missing target ID → no error
 * - data-guidance-category attribute applied correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGuidancePulseHighlight } from '../useGuidancePulseHighlight'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

const PULSE_CLASS = 'guidance-pulse-ring'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    signal_code: 'TEST',
    category: 'should_fix',
    source: 'structural',
    title: 'Test item',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Discuss.' },
    target_object: { type: 'node', id: 'node-xyz' },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// DOM mock helpers
// ---------------------------------------------------------------------------

function createMockNode(nodeId: string): HTMLDivElement {
  const el = document.createElement('div')
  el.classList.add('react-flow__node')
  el.setAttribute('data-id', nodeId)
  document.body.appendChild(el)
  return el
}

function createMockEdge(edgeId: string): HTMLDivElement {
  const el = document.createElement('div')
  el.classList.add('react-flow__edge')
  el.setAttribute('data-id', edgeId)
  document.body.appendChild(el)
  return el
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
  document.body.innerHTML = '' // clean DOM
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGuidancePulseHighlight — node targeting', () => {
  it('applies pulse class to matching node element when active item set', () => {
    const el = createMockNode('node-xyz')
    const item = makeItem({ target_object: { type: 'node', id: 'node-xyz' } })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    })

    expect(el.classList.contains(PULSE_CLASS)).toBe(true)
  })

  it('removes pulse class when activeGuidanceItemId is cleared', () => {
    const el = createMockNode('node-xyz')
    const item = makeItem({ target_object: { type: 'node', id: 'node-xyz' } })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    })
    expect(el.classList.contains(PULSE_CLASS)).toBe(true)

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem(null)
    })
    expect(el.classList.contains(PULSE_CLASS)).toBe(false)
  })

  it('applies data-guidance-category attribute', () => {
    const el = createMockNode('node-cat')
    const item = makeItem({
      item_id: 'cat-item',
      category: 'must_fix',
      target_object: { type: 'node', id: 'node-cat' },
    })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('cat-item')
    })
    expect(el.getAttribute('data-guidance-category')).toBe('must_fix')
  })

  it('removes data-guidance-category on clear', () => {
    const el = createMockNode('node-cat2')
    const item = makeItem({
      item_id: 'cat-item2',
      category: 'must_fix',
      target_object: { type: 'node', id: 'node-cat2' },
    })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('cat-item2')
    })
    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem(null)
    })
    expect(el.getAttribute('data-guidance-category')).toBeNull()
  })
})

describe('useGuidancePulseHighlight — edge targeting', () => {
  it('applies pulse class to matching edge element', () => {
    const el = createMockEdge('edge-1')
    const item = makeItem({
      target_object: { type: 'edge', id: 'edge-1' },
    })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    })
    expect(el.classList.contains(PULSE_CLASS)).toBe(true)
  })
})

describe('useGuidancePulseHighlight — no highlight for graph/framing targets', () => {
  it('does NOT apply class for graph target type', () => {
    const el = createMockNode('node-xyz')
    const item = makeItem({
      target_object: { type: 'graph' }, // no id
    })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    })
    expect(el.classList.contains(PULSE_CLASS)).toBe(false)
  })

  it('does NOT apply class for framing target type', () => {
    const el = createMockNode('node-xyz')
    const item = makeItem({
      target_object: { type: 'framing' }, // no id
    })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    })
    expect(el.classList.contains(PULSE_CLASS)).toBe(false)
  })

  it('does NOT throw when target ID does not match any element', () => {
    const item = makeItem({
      target_object: { type: 'node', id: 'non-existent-node-id' },
    })

    useGuidanceStore.getState().setGuidanceItems([item])
    renderHook(() => useGuidancePulseHighlight())

    expect(() => {
      act(() => {
        useGuidanceStore.getState().setActiveGuidanceItem('item-1')
      })
    }).not.toThrow()
  })
})

describe('useGuidancePulseHighlight — category change refresh', () => {
  it('re-applies ring with updated category when same target switches category', () => {
    const el = createMockNode('node-switch')
    const itemA = makeItem({
      item_id: 'item-a',
      category: 'could_fix',
      target_object: { type: 'node', id: 'node-switch' },
    })
    const itemB = makeItem({
      item_id: 'item-b',
      category: 'must_fix',
      target_object: { type: 'node', id: 'node-switch' },
    })

    useGuidanceStore.getState().setGuidanceItems([itemA, itemB])
    renderHook(() => useGuidancePulseHighlight())

    // Activate item-a (could_fix → info category)
    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-a')
    })
    expect(el.getAttribute('data-guidance-category')).toBe('could_fix')
    expect(el.classList.contains(PULSE_CLASS)).toBe(true)

    // Activate item-b on same target (must_fix → danger category)
    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-b')
    })
    // Ring should refresh: same element, new category
    expect(el.classList.contains(PULSE_CLASS)).toBe(true)
    expect(el.getAttribute('data-guidance-category')).toBe('must_fix')
  })
})

describe('useGuidancePulseHighlight — cleanup', () => {
  it('removes ring when hook unmounts', () => {
    const el = createMockNode('node-xyz')
    const item = makeItem({ target_object: { type: 'node', id: 'node-xyz' } })

    useGuidanceStore.getState().setGuidanceItems([item])
    const { unmount } = renderHook(() => useGuidancePulseHighlight())

    act(() => {
      useGuidanceStore.getState().setActiveGuidanceItem('item-1')
    })
    expect(el.classList.contains(PULSE_CLASS)).toBe(true)

    unmount()
    expect(el.classList.contains(PULSE_CLASS)).toBe(false)
  })
})
