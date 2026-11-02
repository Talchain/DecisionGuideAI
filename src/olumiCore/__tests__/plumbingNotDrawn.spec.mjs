import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { graphOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { changeRows } from '../../../scripts/olumi-core/lib/words.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const formOf = () => JSON.parse(JSON.stringify(fx('view-approved.json').version.form))
const quantity = (id, label, value, by, extra = {}) => ({
  family: 'quantity', id, label, unit: null, role: 'fact', assertion: { kind: 'point', value, approximate: false }, domain: null, stated_time: null, direction: null,
  origin: by === 'person' ? { by, quote: `I said ${value}`, party: null } : { by, basis: 'because' }, ...extra,
})

describe('plumbing constants are not cards on the canvas (Paul, 1 Nov 23:45Z: "Whole share 1")', () => {
  const withConstants = () => {
    const form = formOf()
    form.records.push(
      quantity('whole', 'Whole share', 1, 'structure'),
      quantity('first_close', 'Share of the institutional deal received at first close', 1, 'structure'),
      quantity('olumi_rate', 'Olumi\'s proposed rate', 0.2, 'olumi'),
      quantity('mine', 'My own figure', 7, 'person'),
      quantity('scaled', 'Scaled', 0, 'olumi', { role: 'derived', assertion: { kind: 'derived' } }),
      { family: 'relation', id: 'scaled_def', form: 'product', defines: 'scaled', parts: [{ id: 'whole', power: 1 }, { id: 'olumi_rate', power: 1 }, { id: 'mine', power: 1 }], origin: { by: 'olumi', basis: 'x' } },
    )
    return form
  }
  it('a structure constant is not drawn as a card, and no drawn edge touches it', () => {
    const { nodes, edges } = graphOf(withConstants())
    for (const id of ['whole', 'first_close']) {
      expect(nodes.find((n) => n.id === id), id).toBeUndefined()
      expect(edges.filter((e) => e.from === id || e.to === id), id).toEqual([])
    }
  })
  it('the structure lever of the fixture (carrying on adds no specialist) is not drawn either', () => {
    const { nodes, edges } = graphOf(formOf())
    expect(nodes.find((n) => n.id === 'specialists')).toBeUndefined()
    expect(edges.filter((e) => e.from === 'specialists' || e.to === 'specialists')).toEqual([])
  })
  it('Olumi\'s own figure and the person\'s own figure stay on the canvas, with their links', () => {
    const { nodes, edges } = graphOf(withConstants())
    expect(nodes.find((n) => n.id === 'olumi_rate')).toBeDefined()
    expect(nodes.find((n) => n.id === 'mine')).toBeDefined()
    expect(nodes.find((n) => n.id === 'scaled')).toBeDefined()
    expect(edges.some((e) => e.from === 'olumi_rate' && e.to === 'scaled')).toBe(true)
    expect(edges.some((e) => e.from === 'mine' && e.to === 'scaled')).toBe(true)
  })
  it('the option that sets a structure constant is still drawn, with its change on the card', () => {
    const { nodes } = graphOf(formOf())
    expect(nodes.find((n) => n.id === 'add_one').interventions.specialists).toBeDefined()
  })
  it('the constants stay in "Also in the model" on the reading card', () => {
    const form = withConstants()
    const view = { version: null, pending: { form, changes: { added: ['whole', 'first_close', 'mine'], changed: [], removed: [], top: [] } } }
    const rows = changeRows(view)
    expect(rows.find((r) => r.id === 'whole')).toMatchObject({ group: 'other', structure: true })
    expect(rows.find((r) => r.id === 'first_close')).toMatchObject({ group: 'other', structure: true })
    expect(rows.find((r) => r.id === 'mine').group).toBe('used')
  })
})
