/**
 * Tests for extractTargetIdsFromPatch helper
 *
 * Verifies:
 * - Add node operation → extracts node ID
 * - Delete edge operation → extracts edge ID
 * - Mixed operations → extracts both node and edge IDs
 * - No identifiable targets → returns empty arrays
 * - Full draft (no individual targets) → returns empty arrays
 */

import { describe, it, expect } from 'vitest'
import { extractTargetIdsFromPatch } from '../utils/extractTargetIds'
import type { PatchOperation } from '../types'

describe('extractTargetIdsFromPatch', () => {
  it('add node operation → extracts node ID', () => {
    const ops: PatchOperation[] = [
      { op: 'add_node', target_id: 'node-1', data: { type: 'risk' } },
    ]
    const result = extractTargetIdsFromPatch(ops)
    expect(result.nodeIds).toEqual(['node-1'])
    expect(result.edgeIds).toEqual([])
  })

  it('delete edge operation → extracts edge ID', () => {
    const ops: PatchOperation[] = [
      { op: 'remove_edge', target_id: 'edge-1', data: {} },
    ]
    const result = extractTargetIdsFromPatch(ops)
    expect(result.nodeIds).toEqual([])
    expect(result.edgeIds).toEqual(['edge-1'])
  })

  it('mixed operations → extracts both node and edge IDs', () => {
    const ops: PatchOperation[] = [
      { op: 'add_node', target_id: 'n1', data: {} },
      { op: 'update_edge', target_id: 'e1', data: {} },
      { op: 'remove_node', target_id: 'n2', data: {} },
      { op: 'add_edge', target_id: 'e2', data: { source: 'n1', target: 'n2' } },
      { op: 'update_node', target_id: 'n3', data: { label: 'X' } },
    ]
    const result = extractTargetIdsFromPatch(ops)
    expect(result.nodeIds).toEqual(['n1', 'n2', 'n3'])
    expect(result.edgeIds).toEqual(['e1', 'e2'])
  })

  it('no identifiable targets → returns empty arrays', () => {
    const ops: PatchOperation[] = [
      { op: 'add_node', target_id: '', data: {} },
    ]
    const result = extractTargetIdsFromPatch(ops)
    // Empty string target_id is falsy, so filtered out
    expect(result.nodeIds).toEqual([])
    expect(result.edgeIds).toEqual([])
  })

  it('empty operations array → returns empty arrays', () => {
    const result = extractTargetIdsFromPatch([])
    expect(result.nodeIds).toEqual([])
    expect(result.edgeIds).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Integration: extractTargetIds → clearItemsByTargetIds pipeline
// ---------------------------------------------------------------------------

import { useGuidanceStore } from '../../stores/guidanceStore'
import type { GuidanceItem } from '../../stores/guidanceStore'

function makeGuidanceItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g-1',
    signal_code: 'TEST',
    category: 'should_fix',
    source: 'structural',
    title: 'Fix something',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Tell me.' },
    ...overrides,
  }
}

describe('patch accept → guidance auto-clear integration', () => {
  it('clears guidance items targeting nodes/edges modified by patch', () => {
    // Seed guidance store with items targeting specific elements
    useGuidanceStore.getState().setGuidanceItems([
      makeGuidanceItem({ item_id: 'g-n1', target_object: { type: 'node', id: 'n1' } }),
      makeGuidanceItem({ item_id: 'g-e1', target_object: { type: 'edge', id: 'e1' } }),
      makeGuidanceItem({ item_id: 'g-unrelated', target_object: { type: 'node', id: 'n99' } }),
    ])
    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(3)

    // Simulate the pipeline: extract IDs from patch ops, then clear
    const ops: PatchOperation[] = [
      { op: 'update_node', target_id: 'n1', data: { label: 'Updated' } },
      { op: 'remove_edge', target_id: 'e1', data: {} },
    ]
    const { nodeIds, edgeIds } = extractTargetIdsFromPatch(ops)
    const allIds = [...nodeIds, ...edgeIds]
    useGuidanceStore.getState().clearItemsByTargetIds(allIds)

    // Only the unrelated item should remain
    const remaining = useGuidanceStore.getState().guidanceItems
    expect(remaining).toHaveLength(1)
    expect(remaining[0].item_id).toBe('g-unrelated')
  })
})
