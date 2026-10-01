/**
 * Paul, 1 Oct 2026: each repeated card carries a number within its type — four options read 1–4, five factors 1–5.
 * Rows bind by IDENTITY (node id → number), with a discriminating control for each rule.
 */
import { describe, it, expect } from 'vitest'
import { nodeTypeOrdinals, ROW_TOLERANCE } from '../nodeTypeOrdinal'

const n = (id: string, type: string, x: number, y = 0) => ({ id, type, position: { x, y } })

describe('nodeTypeOrdinals', () => {
  it('⭐ numbers each type 1…N on its own: 4 options → 1–4, 5 factors → 1–5', () => {
    const nodes = [
      n('q', 'decision', 500), n('g', 'goal', 500, 900),
      n('o1', 'option', 0, 200), n('o2', 'option', 300, 200), n('o3', 'option', 600, 200), n('o4', 'option', 900, 200),
      n('f1', 'factor', 0, 450), n('f2', 'factor', 250, 450), n('f3', 'factor', 500, 450), n('f4', 'factor', 750, 450), n('f5', 'factor', 1000, 450),
      n('out1', 'outcome', 0, 700), n('r1', 'risk', 300, 700),
    ]
    const o = nodeTypeOrdinals(nodes)
    expect(['o1', 'o2', 'o3', 'o4'].map((id) => o.get(id))).toEqual([1, 2, 3, 4])
    expect(['f1', 'f2', 'f3', 'f4', 'f5'].map((id) => o.get(id))).toEqual([1, 2, 3, 4, 5])
    expect(o.get('out1')).toBe(1)
    expect(o.get('r1')).toBe(1)
  })

  it('the single anchors (Question, Goal) carry no number', () => {
    const o = nodeTypeOrdinals([n('q', 'decision', 0), n('g', 'goal', 0, 900), n('o1', 'option', 0, 200)])
    expect(o.has('q')).toBe(false)
    expect(o.has('g')).toBe(false)
    expect(o.get('o1')).toBe(1)
  })

  it('⭐ the order is the READING order (left → right), not the store order', () => {
    const o = nodeTypeOrdinals([n('right', 'option', 900, 200), n('left', 'option', 0, 200), n('mid', 'option', 450, 200)])
    expect([o.get('left'), o.get('mid'), o.get('right')]).toEqual([1, 2, 3])
  })

  it('a card nudged down within the row tolerance keeps its left-to-right place; a wrapped row reads after', () => {
    const o = nodeTypeOrdinals([
      n('a', 'factor', 0, 400), n('b', 'factor', 300, 400 + ROW_TOLERANCE - 1), n('c', 'factor', 600, 400),
      n('d', 'factor', 0, 600),
    ])
    expect([o.get('a'), o.get('b'), o.get('c'), o.get('d')]).toEqual([1, 2, 3, 4])
  })

  it('CONTROL: beyond the tolerance a card IS on the next row', () => {
    const o = nodeTypeOrdinals([n('a', 'factor', 0, 400), n('b', 'factor', 300, 400 + ROW_TOLERANCE + 1), n('c', 'factor', 600, 400)])
    expect([o.get('a'), o.get('c'), o.get('b')]).toEqual([1, 2, 3])
  })

  it('ties fall back to the store order, so the numbering is total', () => {
    const o = nodeTypeOrdinals([n('first', 'risk', 0, 0), n('second', 'risk', 0, 0)])
    expect([o.get('first'), o.get('second')]).toEqual([1, 2])
  })
})
