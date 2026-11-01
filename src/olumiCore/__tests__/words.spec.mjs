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

// ── a proposal that changes only top-level fields (the question, the decision date) is a card with rows, not an empty one ──────
describe('a change to a top-level field is on the card, with whose it is (finding: "Set a deadline" showed an empty card with an approve button)', () => {
  const topOnly = (decide_by, question = 'Keep current staffing or add one specialist, and by when?') => {
    const v = fx('view-approved-with-change.json')
    v.pending.changes = { added: [], changed: [], removed: [], top: ['question', 'decide_by'] }
    v.pending.form.question = question
    v.pending.form.decide_by = decide_by
    return v
  }
  const OLUMI_DATE = { date: '2026-12-01', origin: { by: 'olumi', basis: 'a new hire takes a month to start' } }
  const MY_DATE = { date: '2026-12-01', origin: { by: 'person', quote: 'by the board meeting', party: null } }

  it('Olumi\'s proposed deadline is a row the person sees, worded as a date, marked Olumi\'s, with Olumi\'s reason', () => {
    const rows = changeRows(topOnly(OLUMI_DATE))
    const d = rows.find((r) => r.id === 'top:decide_by')
    expect(d).toMatchObject({ kind: 'record', action: 'add', label: 'Decide by', author: 'olumi', group: 'inferred', before: null })
    expect(d.after).toMatch(/^1 December 2026\./)
    expect(d.after).toMatch(/Olumi’s reason: a new hire takes a month to start/)
    expect(changeIsOlumis(d)).toBe(true)
  })
  it('the person\'s own deadline is theirs: the person\'s group, their own words quoted', () => {
    const d = changeRows(topOnly(MY_DATE)).find((r) => r.id === 'top:decide_by')
    expect(d).toMatchObject({ author: 'person', group: 'used' })
    expect(d.after).toMatch(/You said: “by the board meeting”/)
    expect(changeIsOlumis(d)).toBe(false)
  })
  it('a reworded question says what it was and what it becomes', () => {
    const q = changeRows(topOnly(OLUMI_DATE)).find((r) => r.id === 'top:question')
    expect(q).toMatchObject({ kind: 'record', action: 'change', label: 'The question', before: 'Keep current staffing or add one specialist?', after: 'Keep current staffing or add one specialist, and by when?', author: 'olumi', group: 'inferred' })
  })
  it('a deadline that moves says the old date; one that is taken away says so', () => {
    const v = topOnly({ date: '2026-12-15', origin: { by: 'person', quote: 'the 15th', party: null } })
    v.version.form.decide_by = OLUMI_DATE
    expect(changeRows(v).find((r) => r.id === 'top:decide_by')).toMatchObject({ action: 'change', before: expect.stringMatching(/^1 December 2026/), after: expect.stringMatching(/^15 December 2026/) })
    const gone = topOnly(null)
    gone.version.form.decide_by = OLUMI_DATE
    expect(changeRows(gone).find((r) => r.id === 'top:decide_by')).toMatchObject({ action: 'remove', before: expect.stringMatching(/^1 December 2026/), after: null })
  })
  it('a date core has not worked out yet is said so, not as "undefined"', () => {
    const d = changeRows(topOnly({ date: null, origin: { by: 'person', quote: 'after the audit', party: null } })).find((r) => r.id === 'top:decide_by')
    expect(d.after).toMatch(/^A date not worked out yet\./)
    expect(d.after).toMatch(/after the audit/)
  })
  it('the title, the period and the coaching questions are rows too; the person\'s records still lead within a group', () => {
    const v = fx('view-approved-with-change.json')
    v.pending.changes = { added: ['staff_absence'], changed: [], removed: [], top: ['title', 'period', 'coaching_questions'] }
    v.pending.form.title = 'Support capacity plan'; v.pending.form.period = 'month'; v.pending.form.coaching_questions = ['What would show you the team is coping?', 'What would change your mind?']
    const rows = changeRows(v)
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(['top:title', 'top:period', 'top:coaching_questions', 'staff_absence']))
    expect(rows.find((r) => r.id === 'top:title')).toMatchObject({ before: 'Support capacity', after: 'Support capacity plan', label: 'The name' })
    expect(rows.find((r) => r.id === 'top:period').after).toMatch(/month/)
    expect(rows.find((r) => r.id === 'top:coaching_questions').after).toMatch(/What would change your mind\?/)
    const order = rows.map((r) => r.group)
    expect(order).toEqual([...order].sort((a, b) => ({ used: 0, inferred: 1, left_out: 2, other: 3 })[a] - ({ used: 0, inferred: 1, left_out: 2, other: 3 })[b]))
  })
  it('a first draft shows the deadline it proposes, and none of the top-level fields it has nothing to compare with', () => {
    const v = fx('view-first-pending.json')
    v.pending.changes = { ...v.pending.changes, top: ['question', 'title', 'period', 'coaching_questions', 'decide_by'] }
    v.pending.form.decide_by = OLUMI_DATE
    const ids = changeRows(v).map((r) => r.id)
    expect(ids).toContain('top:decide_by')
    expect(ids.filter((i) => i.startsWith('top:'))).toEqual(['top:decide_by'])
  })
  it('DGAI\'s own reader keeps every row, groups every row, and can show the whole card', () => {
    const shim = makeShim({ core: async () => ({}) })
    const card = shim.cardFor(topOnly(OLUMI_DATE), 'turn-1')
    expect(card.changes.map((c) => c.id)).toEqual(['top:decide_by', 'top:question'])
    const p = readProposalFields({ version: 1, graph_hash: 'a'.repeat(16), proposals: [card] }).proposals[0]
    expect(p.changes).toHaveLength(2)
    expect(p.changes.every((c) => c.group !== undefined)).toBe(true)
    expect(cardCannotBeShownInFull(p, true)).toBe(false)
  })
  it('a proposal that changes nothing core names is not given an invented row', () => {
    const v = fx('view-approved-with-change.json')
    v.pending.changes = { added: [], changed: [], removed: [], top: [] }
    expect(changeRows(v)).toEqual([])
  })
})
