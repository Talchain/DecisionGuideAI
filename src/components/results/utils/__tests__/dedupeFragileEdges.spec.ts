/**
 * dedupeFragileEdges — identity derivation and the fail-open contract.
 *
 * The rendered behaviour is pinned separately by
 * StressTestSection.fragileDedup.spec.tsx. This file pins the KEY itself,
 * because the whole fix rests on which two rows count as "the same finding".
 */

import { describe, it, expect } from 'vitest'
import {
  fragileEdgeIdentity,
  dedupeFragileEdgesByIdentity,
  type DedupableFragileEdge,
} from '../dedupeFragileEdges'

const BASE: DedupableFragileEdge = {
  edge_id: 'edge_leadership_delivery',
  from_id: 'node_leadership',
  to_id: 'node_delivery',
  from_label: 'Leadership capacity',
  to_label: 'Delivery throughput',
  alternative_winner_id: 'opt_b',
  alternative_winner_label: 'Option B',
}

describe('fragileEdgeIdentity — key precedence', () => {
  it('prefers edge_id over the endpoint pair', () => {
    const a = fragileEdgeIdentity(BASE)
    const b = fragileEdgeIdentity({ ...BASE, from_id: 'other', to_id: 'other2' })
    expect(a).toBe(b)
    expect(a).toContain('edge:edge_leadership_delivery')
  })

  it('falls back to the id endpoint pair when edge_id is absent', () => {
    const key = fragileEdgeIdentity({ ...BASE, edge_id: undefined })
    expect(key).toContain('pair:node_leadership->node_delivery')
  })

  it('falls back to the label endpoint pair when no ids were sent at all', () => {
    const key = fragileEdgeIdentity({
      ...BASE,
      edge_id: undefined,
      from_id: undefined,
      to_id: undefined,
    })
    expect(key).toContain('pair:Leadership capacity->Delivery throughput')
  })

  it('treats whitespace-only producer ids as absent, not as a key', () => {
    const key = fragileEdgeIdentity({ ...BASE, edge_id: '   ' })
    expect(key).toContain('pair:node_leadership->node_delivery')
  })

  it('returns null when nothing identifying was sent (caller must keep the item)', () => {
    expect(fragileEdgeIdentity({})).toBeNull()
    expect(fragileEdgeIdentity({ from_label: 'Only a source' })).toBeNull()
  })
})

describe('fragileEdgeIdentity — the alternative winner discriminates', () => {
  it('separates the same relationship flipping to two different winners', () => {
    const toB = fragileEdgeIdentity(BASE)
    const toC = fragileEdgeIdentity({
      ...BASE,
      alternative_winner_id: 'opt_c',
      alternative_winner_label: 'Option C',
    })
    expect(toB).not.toBe(toC)
  })

  it('matches on the alt-winner LABEL when the producer sent no alt-winner id', () => {
    const one = fragileEdgeIdentity({ ...BASE, alternative_winner_id: undefined })
    const two = fragileEdgeIdentity({ ...BASE, alternative_winner_id: undefined })
    expect(one).toBe(two)
    expect(one).toContain('alt:Option B')
  })
})

describe('dedupeFragileEdgesByIdentity', () => {
  it('keeps the first occurrence of a repeated identity', () => {
    const first = { ...BASE, marginal_switch_probability: 0.44 }
    const second = { ...BASE, marginal_switch_probability: 0.12 }
    const out = dedupeFragileEdgesByIdentity([first, second])
    expect(out).toHaveLength(1)
    // Identity binding: assert it is the FIRST object, not merely "an object
    // with one of the two probabilities".
    expect(out[0]).toBe(first)
  })

  it('leaves a duplicate-free list untouched, in order and by reference', () => {
    const a = { ...BASE }
    const b = { ...BASE, edge_id: 'edge_funding' }
    const c = { ...BASE, edge_id: 'edge_hiring' }
    const out = dedupeFragileEdgesByIdentity([a, b, c])
    expect(out).toEqual([a, b, c])
    expect(out[0]).toBe(a)
    expect(out[2]).toBe(c)
  })

  it('keeps every un-keyable entry rather than collapsing them together', () => {
    const blank1 = {}
    const blank2 = {}
    const out = dedupeFragileEdgesByIdentity([blank1, blank2])
    expect(out).toHaveLength(2)
  })

  it('never dedups on the rendered display string alone', () => {
    // Same from_label (so the same "If X shifts" row), different targets.
    const out = dedupeFragileEdgesByIdentity([
      { ...BASE, edge_id: 'edge_a', to_label: 'Delivery throughput' },
      { ...BASE, edge_id: 'edge_b', to_label: 'Team morale' },
    ])
    expect(out).toHaveLength(2)
  })

  it('returns an empty list for an empty input', () => {
    expect(dedupeFragileEdgesByIdentity([])).toEqual([])
  })
})
