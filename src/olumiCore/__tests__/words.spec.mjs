import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { changeRows, groupOf, figure } from '../../../scripts/olumi-core/lib/words.mjs'
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
