/** A link whose direction nobody gave is drawn, never lost (buddy A2, 21 Oct): core's mapper drops it (mapper.ts:453). */
import { describe, expect, it } from 'vitest'
import { directionNeededLinksOf } from '../directionNeeded'

const link = (id: string, from: string, to: string, sign: string | null, source = 'user', party: string | null = null) =>
  ({ id, from, to, effect: { form: sign === null ? 'unknown' : 'direction_only', value: null, sign }, source, party, quote: 'x' })
const graph = (links: unknown[]) => ({ nodes: [], edges: [], living_model: { links } })
const ON = new Set(['tracking', 'on_time', 'courier'])

describe('links the engine leaves out for want of a direction', () => {
  it('⭐ each unsigned link between two cards, by id, with whose it is', () => {
    expect(directionNeededLinksOf(graph([
      link('l1', 'tracking', 'on_time', null),
      link('l2', 'courier', 'on_time', null, 'party', 'Ops lead'),
    ]), ON, new Set())).toEqual([
      { id: 'l1', from: 'tracking', to: 'on_time', source: 'user', party: null },
      { id: 'l2', from: 'courier', to: 'on_time', source: 'party', party: 'Ops lead' },
    ])
  })
  it('⛔ a signed link (the engine draws it), an end off the canvas, or a pair already joined is not drawn again', () => {
    expect(directionNeededLinksOf(graph([
      link('signed', 'tracking', 'on_time', '+'),
      link('off', 'refunds', 'on_time', null),
      link('joined', 'courier', 'on_time', null),
    ]), ON, new Set(['courier->on_time']))).toEqual([])
  })
  it('a source it does not know reads unverified; no living model reads none', () => {
    expect(directionNeededLinksOf(graph([link('l', 'tracking', 'on_time', null, 'someone')]), ON, new Set())[0].source).toBe('unverified')
    expect(directionNeededLinksOf({ nodes: [] }, ON, new Set())).toEqual([])
  })
})
