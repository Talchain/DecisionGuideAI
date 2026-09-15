/**
 * ⭐⭐ TWO COACHING SYSTEMS WERE MARKING THE SAME CARD.
 *
 * `NodeCoachingMarker` renders the producer's `guidance_items` — they arrive on
 * the turn envelope with a DSK claim id and a protocol, which is attributable
 * decision science. `useScienceIcons` derives its own signals from the shape of
 * the graph sitting in the browser. Both can fire on one node, and when they
 * disagree the reader has no way to tell which to believe.
 *
 * The producer wins. ⛔ But NOT by deleting the local hook: where the producer
 * is silent — most nodes, most runs — these observations are all the reader
 * gets, and they are true.
 *
 * ## Why both directions are pinned
 *
 * A hook hardcoded to `return []` would satisfy the suppression test on its
 * own. The contrast is what proves the suppression is bound to THIS node's id
 * rather than to the store being non-empty — which is the difference between
 * "the producer spoke about this card" and "a turn delivered guidance at all".
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScienceIcons } from '../useScienceIcons'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

const FACTOR_ID = 'fac_churn'
const OTHER_ID = 'fac_unrelated'

/** A factor with no value and no prior — the `evidence-gap` trigger, chosen
 *  because it depends on nothing but this node's own data. */
function seedGraph() {
  useCanvasStore.setState(
    {
      nodes: [
        { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 },
          data: { label: 'Monthly churn', kind: 'factor' } },
        { id: OTHER_ID, type: 'factor', position: { x: 0, y: 0 },
          data: { label: 'Seat expansion', kind: 'factor' } },
      ],
      edges: [],
    } as never,
    false,
  )
}

function guidanceTargeting(nodeId: string) {
  return [{
    item_id: 'g1',
    source: 'cee',
    title: 'Anchoring on the current figure',
    target_object: { type: 'node', id: nodeId },
  }] as never
}

describe('one voice per node: the producer outranks the local observation', () => {
  beforeEach(() => {
    seedGraph()
    useGuidanceStore.getState().setGuidanceItems([])
  })

  it('the local icons speak while the producer is silent', () => {
    const { result } = renderHook(() => useScienceIcons(FACTOR_ID, 'factor'))
    expect(result.current.map(i => i.id)).toContain('evidence-gap')
  })

  it('⭐ they fall silent once the producer names THIS node', () => {
    useGuidanceStore.getState().setGuidanceItems(guidanceTargeting(FACTOR_ID))
    const { result } = renderHook(() => useScienceIcons(FACTOR_ID, 'factor'))
    expect(result.current).toEqual([])
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a hook that returned nothing
   * whenever the store held anything — or nothing at all, ever — would pass the
   * test above and the suppression would not be bound to this node.
   */
  it('⛔ CONTRAST: guidance about a DIFFERENT node does not silence them', () => {
    useGuidanceStore.getState().setGuidanceItems(guidanceTargeting(OTHER_ID))
    const { result } = renderHook(() => useScienceIcons(FACTOR_ID, 'factor'))
    expect(result.current.map(i => i.id)).toContain('evidence-gap')
  })
})

describe('the baseline option is a fact, not a diagnosis of the reader', () => {
  it('states what is modelled instead of naming the reader’s bias', () => {
    useCanvasStore.setState(
      { nodes: [{ id: 'opt_stay', type: 'option', position: { x: 0, y: 0 },
          data: { label: 'Stay as we are', kind: 'option', is_baseline: true } }], edges: [] } as never,
      false,
    )
    useGuidanceStore.getState().setGuidanceItems([])
    const { result } = renderHook(() => useScienceIcons('opt_stay', 'option'))
    const sq = result.current.find(i => i.id === 'status-quo-bias')
    expect(sq).toBeDefined()
    expect(sq!.tooltip).toBe('Baseline — modelled as no change from today.')
    // The icon and the registry entry stay — only the sentence changed.
    expect(sq!.tooltip).not.toMatch(/bias/i)
  })
})
