import { describe, expect, it } from 'vitest'
import { markPath, focusIdOf, type Focusable } from '../focusPath'

const Q = 'page:question', CARD = 'viewCard'
const nodes: Focusable[] = [
  { id: Q, type: 'viewQuestion' }, { id: 'a', type: CARD }, { id: 'b', type: CARD }, { id: 'c', type: CARD, selected: true },
  { id: 'idea:1', type: 'viewIdea' }, { id: 'group:inputs', type: 'viewFold' },
]
const expectNoFade = (out: Focusable[]) => {
  for (const n of out) {
    expect(Number(n.style?.opacity ?? 1), n.id).toBeGreaterThanOrEqual(1)
    expect((n.className ?? '').split(/\s+/), n.id).not.toContain('v12-off-path')
  }
}

describe('which card lights the path', () => {
  it('LP1 the hovered card, else the selected one; hover wins over selection', () => {
    expect([focusIdOf(nodes, 'a', CARD), focusIdOf(nodes, null, CARD)]).toEqual(['a', 'c'])
  })
  it('LP1 CONTRAST: nothing hovered and nothing selected lights nothing; hovering the question, an idea or a fold lights nothing of its own (the selected card still does)', () => {
    const none = nodes.map((n) => ({ ...n, selected: false }))
    expect(focusIdOf(none, null, CARD)).toBeNull()
    expect([focusIdOf(none, Q, CARD), focusIdOf(none, 'idea:1', CARD), focusIdOf(none, 'group:inputs', CARD)]).toEqual([null, null, null])
    expect(focusIdOf(nodes, Q, CARD), 'the question hovered: the selected card still lights its path').toBe('c')
  })
})

describe('which cards are marked', () => {
  it('LP2 records the supplied card colour role only on on-path nodes and preserves DOM attributes', () => {
    const cards: (Focusable & { olumi: boolean })[] = [{ id: 'a', olumi: true, domAttributes: { 'aria-describedby': 'note' } }, { id: 'b', olumi: false }, { id: 'c', olumi: true }]
    const out = markPath(cards, new Set(['a', 'b']), Q, (n) => n.olumi ? 'olumi' : 'person')
    expect(out.map((n) => n.domAttributes?.['data-path-tone'])).toEqual(['olumi', 'person', undefined])
    expect(out[0]!.domAttributes?.['aria-describedby']).toBe('note')
    expect(out[2]).toBe(cards[2])
  })
  it('LP2 at rest returns the same array without marking any node', () => {
    const out = markPath(nodes, null, Q)
    expect(out).toBe(nodes)
    expect(out.some((n) => n.className?.includes('v12-on-path'))).toBe(false)
    expectNoFade(out)
  })
  it('LP2 marks on-path cards; the question and every off-path node stay unchanged', () => {
    const out = markPath(nodes, new Set([Q, 'a', 'b']), Q)
    expect(out.filter((n) => n.className?.includes('v12-on-path')).map((n) => n.id)).toEqual(['a', 'b'])
    for (const id of [Q, 'c', 'idea:1', 'group:inputs']) {
      expect(out.find((n) => n.id === id)).toBe(nodes.find((n) => n.id === id))
    }
    expectNoFade(out)
  })
  it('LP2 preserves existing classes and styles on-path and every property off-path', () => {
    const styled: Focusable[] = [
      { id: 'x', type: CARD, className: 'mine', style: { color: 'red' } },
      { id: 'y', type: CARD, className: 'other', style: { color: 'green' } },
      { id: 'idea:1', type: 'viewIdea' },
    ]
    const out = markPath(styled, new Set(['x']), Q)
    expect(out[0]).toEqual({ ...styled[0], className: 'mine v12-on-path' })
    expect(out[0]!.style).toBe(styled[0]!.style)
    expect(out[1]).toBe(styled[1])
    expect(out[2]).toBe(styled[2])
    expectNoFade(out)
  })
})
