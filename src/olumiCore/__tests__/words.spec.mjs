import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { changeRows, groupOf, figure, num, quoteAgrees } from '../../../scripts/olumi-core/lib/words.mjs'
import { readProposalFields, cardCannotBeShownInFull, changeIsOlumis } from '../../canvas/conversation/proposalFields'
import { makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))

describe('the reading card follows the composition rule (INPUT-MODEL-COMPOSITION, binding)', () => {
  const rows = changeRows(fx('view-first-pending.json'))
  const byGroup = (g) => rows.filter((r) => r.group === g)

  it('the person\'s records come first, Olumi\'s what-ifs behind, then what is left out, then the folded rest', () => {
    const order = rows.map((r) => r.group)
    expect(order).toEqual([...order].sort((a, b) => ({ used: 0, inferred: 1, left_out: 2, other: 3 })[a] - ({ used: 0, inferred: 1, left_out: 2, other: 3 })[b]))
    expect(byGroup('used').every((r) => r.author === 'person')).toBe(true)
    expect(byGroup('inferred').every((r) => r.author === 'olumi')).toBe(true)
  })
  it('within the person\'s records, what they are deciding (aim, options) comes before the figures', () => {
    const used = byGroup('used').map((r) => r.family)
    expect(used.indexOf('goal')).toBeLessThan(used.indexOf('quantity'))
    expect(used.indexOf('option')).toBeLessThan(used.indexOf('quantity'))
  })
  it('every relation and every derived quantity is folded into "other"', () => {
    const view = fx('view-first-pending.json')
    for (const r of view.pending.form.records.filter((x) => x.family === 'relation' || (x.family === 'quantity' && x.role === 'derived'))) expect(groupOf(r), r.id).toBe('other')
  })
  it('a constant is marked as plumbing: structure, nobody\'s, folded, and never counted as Olumi\'s', () => {
    const c = rows.find((r) => r.id === 'specialists')
    expect(c).toMatchObject({ structure: true, group: 'other', author: 'olumi' })
    expect(c.after).toMatch(/Fixed by how the model is built/)
    expect(changeIsOlumis(c)).toBe(false)
  })
  it('a figure Olumi still needs from the person is not folded away', () => {
    const asked = { family: 'quantity', id: 'q', label: 'q', unit: null, role: 'fact', assertion: { kind: 'asked', question: 'how many?' }, origin: { by: 'olumi', basis: 'b' } }
    expect(groupOf(asked)).toBe('inferred')
  })
  it('a range is said as the person stated it, with the likeliest value', () => {
    expect(figure({ kind: 'interval', low: 10, high: 30, range_kind: 'plausible', likely: 20 }, 'ticket/week/specialist')).toBe('between 10 and 30 ticket/week/specialist, most likely 20')
    expect(figure({ kind: 'point', value: 80, approximate: true }, 'ticket/week')).toBe('about 80 ticket/week')
  })
  it('DGAI\'s own reader keeps every row, groups every row, and can show the whole card', async () => {
    const shim = makeShim({ core: async () => ({}) })
    const card = shim.cardFor(fx('view-first-pending.json'), 'turn-1')
    const read = readProposalFields({ version: 1, graph_hash: 'a'.repeat(16), proposals: [card] })
    const p = read.proposals[0]
    expect(p.changes).toHaveLength(rows.length)
    expect(p.changes.every((c) => c.group !== undefined)).toBe(true)
    expect(p.reading).toBe(true)
    expect(cardCannotBeShownInFull(p, true)).toBe(false)
  })
})

describe('a stored figure or word is never changed on its way to the card (sibling check)', () => {
  it('a figure too small for six places is not lost: 0.0000001 is not "0"; ordinary floats are still tidied', () => {
    expect(num(0.0000001)).toBe('0.0000001')
    expect(num(-0.00000042)).toBe('-0.00000042')
    expect(num(0.1 + 0.2)).toBe('0.3')
    expect(num(1234567.5)).toBe('1,234,567.5')
    expect(num(0)).toBe('0')
  })
  it('a quote with an ellipsis or a double stop in it is shown as the person wrote it; only the seam between the sentence and the quote is made one stop', () => {
    const rec = { family: 'claim', id: 'c', text: 'Wait... what', origin: { by: 'person', quote: 'wait... and then.. maybe' } }
    const row = changeRows({ version: null, pending: { form: { records: [rec] }, changes: { added: ['c'], changed: [], removed: [] } } })[0]
    expect(row.after).toContain('“wait... and then.. maybe”')
    expect(row.after.startsWith('A claim in the model. You said:')).toBe(true)
    const dotted = changeRows({ version: null, pending: { form: { records: [{ ...rec, family: 'left_out', why: 'Not modelled.', text: 'Morale...' }] }, changes: { added: ['c'], changed: [], removed: [] } } })[0]
    expect(dotted.after.startsWith('Not modelled. You said:')).toBe(true)
  })
})

describe('the person\'s words are put against a figure only while they still say it (quoteAgrees)', () => {
  const point = (value) => ({ kind: 'point', value, approximate: false })
  it('a figure the quote states, in any way it is written, agrees', () => {
    expect(quoteAgrees('keep churn under 4%', point(4))).toBe(true)
    expect(quoteAgrees('keep churn under 4%', point(0.04))).toBe(true)
    expect(quoteAgrees('no more than 120', point(120))).toBe(true)
    expect(quoteAgrees('at most £20k a month', point(20000))).toBe(true)
    expect(quoteAgrees('up to 1,200 tickets', point(1200))).toBe(true)
    expect(quoteAgrees('between 3 and 5 percent', { kind: 'interval', low: 3, high: 5, range_kind: 'bounds', likely: null })).toBe(true)
  })
  it('a quote of a figure that has since changed does not', () => {
    expect(quoteAgrees('keep churn under 4%', point(5))).toBe(false)
    expect(quoteAgrees('no more than 120', point(130))).toBe(false)
    expect(quoteAgrees('no more than 120', { kind: 'interval', low: 100, high: 130, range_kind: 'plausible', likely: null })).toBe(false)
  })
  it('a quote that states no figure, or a figure that is not saved as a number, cannot contradict it', () => {
    expect(quoteAgrees('I want more capacity', point(130))).toBe(true)
    expect(quoteAgrees('under 4%', { kind: 'asked', question: 'how much?' })).toBe(true)
    expect(quoteAgrees('', point(1))).toBe(true)
  })
})
