/**
 * buildV7Guidance — V7 Lane L6 pins for the guidance split/order/affordance
 * builder (spec rows 8 + 9).
 *
 * Pins: approve_patch items are promoted to heldProposals and excluded from the
 * ordered list; the list is ordered by the canonical display-order doctrine
 * (category severity major, then priorityRank); the source array is never
 * mutated; each action type maps to its honest affordance and an unknown /
 * navigate / defaulted action fails closed to no affordance.
 */
import { describe, it, expect } from 'vitest'
import { buildV7Guidance, deriveGuidanceAffordance } from '../buildV7Guidance'
import type { GuidanceItem, GuidanceAction } from '../../../../canvas/stores/guidanceStore'

function item(partial: Partial<GuidanceItem> & { item_id: string }): GuidanceItem {
  return {
    source: 'analysis',
    title: partial.item_id,
    primary_action: { type: 'discuss', prompt: 'Tell me more' },
    priority: 50,
    ...partial,
  } as GuidanceItem
}

describe('buildV7Guidance (V7 L6)', () => {
  it('promotes approve_patch items to heldProposals and excludes them from the list', () => {
    const patch = item({
      item_id: 'patch-1',
      primary_action: { type: 'approve_patch', operations: [{ op: 'add_edge' }] },
    })
    const discuss = item({ item_id: 'd-1', primary_action: { type: 'discuss', prompt: 'q' } })

    const { heldProposals, guidance } = buildV7Guidance([patch, discuss])

    expect(heldProposals.map((i) => i.item_id)).toEqual(['patch-1'])
    expect(guidance.map((i) => i.item_id)).toEqual(['d-1'])
  })

  it('orders the list by category severity, then priorityRank (canonical comparator)', () => {
    // Deliberately unsorted: technique first, must_fix last on the wire.
    const items = [
      item({ item_id: 'tech', category: 'technique', priorityRank: 200 }),
      item({ item_id: 'could', category: 'could_fix', priorityRank: 20 }),
      item({ item_id: 'must-b', category: 'must_fix', priorityRank: 5 }),
      item({ item_id: 'must-a', category: 'must_fix', priorityRank: 2 }),
    ]
    const { guidance } = buildV7Guidance(items)
    // must_fix (by ascending rank) → could_fix → technique.
    expect(guidance.map((i) => i.item_id)).toEqual(['must-a', 'must-b', 'could', 'tech'])
  })

  it('does not mutate the source array', () => {
    const items = [
      item({ item_id: 'b', category: 'could_fix' }),
      item({ item_id: 'a', category: 'must_fix' }),
    ]
    const before = items.map((i) => i.item_id)
    buildV7Guidance(items)
    expect(items.map((i) => i.item_id)).toEqual(before)
  })

  it('handles an empty / undefined input', () => {
    expect(buildV7Guidance([])).toEqual({ heldProposals: [], guidance: [] })
    expect(buildV7Guidance(undefined)).toEqual({ heldProposals: [], guidance: [] })
  })
})

describe('deriveGuidanceAffordance (V7 L6 row 9)', () => {
  const cases: Array<[string, GuidanceAction, string]> = [
    ['open_inspector → focus', { type: 'open_inspector', node_id: 'n1', field: 'value' }, 'focus'],
    ['discuss → work_through', { type: 'discuss', prompt: 'q' }, 'work_through'],
    ['run_exercise → run_exercise', { type: 'run_exercise', exercise: 'pre_mortem' }, 'run_exercise'],
    ['approve_patch → none (promoted)', { type: 'approve_patch', operations: [] }, 'none'],
    ['navigate → none', { type: 'navigate', target: '#/x' }, 'none'],
  ]
  it.each(cases)('%s', (_label, action, expected) => {
    expect(deriveGuidanceAffordance(item({ item_id: 'x', primary_action: action })).kind).toBe(expected)
  })

  it('fails closed on an unknown action type', () => {
    const rogue = { type: 'delete_everything', target: 'x' } as unknown as GuidanceAction
    expect(deriveGuidanceAffordance(item({ item_id: 'x', primary_action: rogue })).kind).toBe('none')
  })

  it('fails closed when a known action is missing its required field', () => {
    const noNode = { type: 'open_inspector' } as unknown as GuidanceAction
    expect(deriveGuidanceAffordance(item({ item_id: 'x', primary_action: noNode })).kind).toBe('none')
    const emptyPrompt = { type: 'discuss', prompt: '   ' } as GuidanceAction
    expect(deriveGuidanceAffordance(item({ item_id: 'x', primary_action: emptyPrompt })).kind).toBe('none')
  })
})
