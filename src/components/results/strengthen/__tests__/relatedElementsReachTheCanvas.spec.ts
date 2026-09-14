/**
 * ⭐⭐ THE INSPECTOR COULD TAKE YOU TO THE ELEMENT AND THIS PANEL COULD NOT.
 *
 * `GuidanceItem.related_elements` is the producer's own list of the other
 * elements a finding is about. Its declared job, verbatim at the field:
 * *"Inspectors match `id` against the currently selected element in addition to
 * `target_object.id`"* — and `InspectorCoaching.tsx:58-66` does exactly that,
 * with `target_object` taking precedence.
 *
 * `toStrengthenPhase3Item` read only `target_object`. A finding the producer
 * named ONLY through `related_elements` therefore reached the engine with
 * `targetIds: []` → `targetId: null` → and `StrengthenPanel.tsx:239` gates
 * "Show me on the canvas" on precisely that. The route was absent, and the
 * panel's silence looked like the producer had said nothing.
 *
 * ⚠ THIS FILE PINS PRECEDENCE AS HARD AS IT PINS THE ADDITION. A change that
 * put a related element ahead of `target_object` would move every existing
 * row's canvas target — a far worse defect than the one being fixed, and
 * invisible without a case that asserts the ORDER.
 */
import { describe, expect, it } from 'vitest'
import { toStrengthenPhase3Item } from '../buildRecommendations'
import type { GuidanceItem } from '../../../../canvas/stores/guidanceStore'

const base = (over: Partial<GuidanceItem>): GuidanceItem =>
  ({
    item_id: 'g1',
    title: 'Two of these barely connect to anything',
    detail: 'Body.',
    primary_action: { type: 'discuss' },
    priority: 50,
    ...over,
  }) as GuidanceItem

describe('a finding reaches the canvas through either producer field', () => {
  it('carries a related element when the item has NO target_object', () => {
    const item = base({
      related_elements: [{ id: 'node_isolated', type: 'node', label: 'Supplier risk' }],
    })
    expect(toStrengthenPhase3Item(item).targetIds).toEqual(['node_isolated'])
  })

  /**
   * ⭐ THE PRECEDENCE CASE. `target_object` stays FIRST, so `targetIds[0]` —
   * which is what becomes `rec.targetId` — is unchanged for every item that
   * has one. This fix may only ADD a route, never move one.
   */
  it('keeps target_object FIRST when both are present', () => {
    const item = base({
      target_object: { id: 'node_primary', type: 'node' },
      related_elements: [{ id: 'node_neighbour', type: 'node' }],
    } as Partial<GuidanceItem>)
    expect(toStrengthenPhase3Item(item).targetIds).toEqual(['node_primary', 'node_neighbour'])
  })

  it('carries every related element, in producer order', () => {
    const item = base({
      related_elements: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    })
    expect(toStrengthenPhase3Item(item).targetIds).toEqual(['a', 'b', 'c'])
  })

  it('de-duplicates an id the producer repeats across both fields', () => {
    const item = base({
      target_object: { id: 'same', type: 'node' },
      related_elements: [{ id: 'same' }, { id: 'other' }],
    } as Partial<GuidanceItem>)
    expect(toStrengthenPhase3Item(item).targetIds).toEqual(['same', 'other'])
  })

  /**
   * ⭐ THE HONEST-SILENCE CONTROLS. An entry with no usable id names nothing,
   * and inventing a target from a label would be the panel claiming a route
   * the producer never gave it.
   */
  it('CONTROL: entries with no id, or an empty id, name nothing', () => {
    const item = base({
      related_elements: [{ type: 'node', label: 'Unnamed' }, { id: '' }, { id: 'real' }],
    })
    expect(toStrengthenPhase3Item(item).targetIds).toEqual(['real'])
  })

  it('CONTROL: an item with neither field still carries no target', () => {
    expect(toStrengthenPhase3Item(base({})).targetIds).toEqual([])
  })

  it('CONTROL: an item with only target_object is byte-for-byte unchanged', () => {
    const item = base({ target_object: { id: 'only', type: 'node' } } as Partial<GuidanceItem>)
    expect(toStrengthenPhase3Item(item).targetIds).toEqual(['only'])
  })
})
