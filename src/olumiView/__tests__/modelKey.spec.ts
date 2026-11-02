import { expect, it } from 'vitest'
import { modelKeyOf } from '../modelKey'

const nodes = [{ id: 'cups', position: { x: 0, y: 0 }, data: { label: 'Cups a month' } }, { id: 'profit', position: { x: 300, y: 0 }, data: { label: 'Profit' } }]
const edges = [{ id: 'cups->profit', source: 'cups', target: 'profit', data: { sign: '+' } }]

it('dragging a card does not change the key, so the View is not read again on every frame', () => {
  const dragged = nodes.map((n) => (n.id === 'cups' ? { ...n, position: { x: 140, y: 75 } } : n))
  expect(modelKeyOf(dragged, edges)).toBe(modelKeyOf(nodes, edges))
})

it('a changed figure, card or link changes the key', () => {
  const base = modelKeyOf(nodes, edges)
  expect(modelKeyOf(nodes.map((n) => (n.id === 'cups' ? { ...n, data: { label: 'Cups a week' } } : n)), edges)).not.toBe(base)
  expect(modelKeyOf(nodes.slice(1), edges)).not.toBe(base)
  expect(modelKeyOf(nodes, [])).not.toBe(base)
})
