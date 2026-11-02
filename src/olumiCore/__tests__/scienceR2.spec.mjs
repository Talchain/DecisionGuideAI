import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analysisViewOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { restsWords } from '../../../scripts/olumi-core/lib/labels.mjs'
import { byId } from '../../../scripts/olumi-core/lib/words.mjs'

/**
 * Science step 4, round 2: the standing defects of review 00008 that live in the shim (D6's conditions, a secondary aim's exclusions, the
 * provenance wording). The D6 and module facts here are olumi-core's own producer output (739b7e8: runOnly on the capacity hand fixture of
 * src/run/__tests__/science-pipeline.test.ts with OLUMI_LABELS, ROUTES, WORTH, FAILURE, RELIANCE and TIPPING on), not hand stubs.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const S5 = fx('science/s5-labels-facts.json').scenarios
const M = fx('science/s7-module-facts.json')
const base = fx('view-approved.json')
const clone = (x) => JSON.parse(JSON.stringify(x))

const modView = (mutate = (facts) => facts) => {
  const v = clone(base)
  v.version.form = clone(M.form)
  v.version.facts = mutate(clone(M.facts))
  v.version.science = clone(M.science)
  return v
}
const notesOf = (v) => analysisViewOf(v).goal_chance.notes
const noteWith = (v, text) => notesOf(v).find((n) => n.includes(text))
const edit = (id, fn) => (facts) => facts.map((f) => (f.id === id ? fn(f) : f))

describe('D6 (tipping): a threshold keeps the conditions it holds under (review 00008 #3)', () => {
  // F34 and F35 are the same option, aim and figure; their thresholds differ only by the state of the oven-repair risk (not happened: >= 0.8 oven, happened: >= 1.6 oven).
  it('the fixture is producer output: F34 and F35 differ by `when` alone, and carry held, figure_range and the printed strings in `shown`', () => {
    const [a, b] = ['F34', 'F35'].map((id) => M.facts.find((f) => f.id === id).about)
    expect([a.option, a.goal, a.quantity]).toEqual([b.option, b.goal, b.quantity])
    expect(a.when).toEqual([{ risk: 'oven_repair', fired: false }])
    expect(b.when).toEqual([{ risk: 'oven_repair', fired: true }])
    expect(a.shown).toMatchObject({ 'tips:threshold': '>= 0.8 oven', 'tips:range': '1 oven', 'tips:held:extra_sold_per_oven': '75 loaf/week/oven' })
    expect(a.held).toEqual([{ quantity: 'extra_sold_per_oven', value: 75, by: 'olumi' }])
  })

  it('a threshold under one risk state says which risk and which state, and the two states read differently', () => {
    const v = modView()
    const notRepaired = noteWith(v, '>= 0.8 oven'), repaired = noteWith(v, '>= 1.6 oven')
    expect(notRepaired).toMatch(/risk: ‘Oven repair’, not happened/)
    expect(repaired).toMatch(/risk: ‘Oven repair’, happened/)
    expect(repaired).not.toMatch(/not happened/)
    // Flipping only the state in core's fact changes what is shown: the note is not blind to `when`.
    const flipped = noteWith(modView(edit('F34', (f) => ({ ...f, about: { ...f.about, when: [{ risk: 'oven_repair', fired: true }] } }))), '>= 0.8 oven')
    expect(flipped).toMatch(/risk: ‘Oven repair’, happened/)
    expect(flipped).not.toBe(notRepaired)
  })

  it('a "never" that holds only when a risk happened is not read as an unrestricted never', () => {
    const n = noteWith(modView(), '— tips: never')
    expect(n).toMatch(/^‘second oven’, ‘Sell 360 loaves a week’, ‘extra sold per oven’ — tips: never/)
    expect(n).toMatch(/risk: ‘Oven repair’, happened/)
    expect(n).toContain('range: 60 to 90 loaf/week/oven')
  })

  it('the figures held at their middles are named, each with the string core printed for it (about.shown), and the shim makes no number of its own', () => {
    const v = modView()
    expect(noteWith(v, '>= 0.8 oven')).toContain('held at middle: ‘extra sold per oven’, 75 loaf/week/oven')
    // The printed string decides what is shown, not held[].value: change the string and the note follows; change the number and it does not.
    const reprinted = noteWith(modView(edit('F34', (f) => ({ ...f, about: { ...f.about, shown: { ...f.about.shown, 'tips:held:extra_sold_per_oven': '75.0 loaves a week per oven' } } }))), '>= 0.8 oven')
    expect(reprinted).toContain('held at middle: ‘extra sold per oven’, 75.0 loaves a week per oven')
    const renumbered = noteWith(modView(edit('F34', (f) => ({ ...f, about: { ...f.about, held: [{ quantity: 'extra_sold_per_oven', value: 98765, by: 'olumi' }] } }))), '>= 0.8 oven')
    expect(renumbered).not.toContain('98765')
    expect(renumbered).toContain('75 loaf/week/oven')
    // A held figure core printed no string for is still named as held, with no number made up for it.
    const unprinted = noteWith(modView(edit('F34', (f) => { const shown = { ...f.about.shown }; delete shown['tips:held:extra_sold_per_oven']; return { ...f, about: { ...f.about, shown } } })), '>= 0.8 oven')
    expect(unprinted).toMatch(/held at middle: ‘extra sold per oven’(?!,)/)
    expect(unprinted).not.toMatch(/held at middle: ‘extra sold per oven’, \d/)
  })

  it('the figure\'s own range is the string core printed in tips:range (a threshold is on that range, or on the one figure when it is a point)', () => {
    const v = modView()
    expect(noteWith(v, '>= 60 loaf/week/oven')).toContain('range: 60 to 90 loaf/week/oven')
    expect(noteWith(v, '>= 0.8 oven')).toContain('range: 1 oven')
    const reprinted = noteWith(modView(edit('F36', (f) => ({ ...f, about: { ...f.about, shown: { ...f.about.shown, 'tips:range': '60 to 90 (core\'s string)' } } }))), '>= 60 loaf/week/oven')
    expect(reprinted).toContain('range: 60 to 90 (core\'s string)')
  })

  it('a threshold with no risk and nothing held carries no condition: none is invented', () => {
    const free = noteWith(modView(), '‘extra hours sold’ — tips at: >= 60 loaf/week')
    expect(free).toMatch(/‘longer hours’/)
    expect(free).not.toMatch(/risk:|held at middle/)
    expect(free).toContain('range: 40 to 80 loaf/week')
    // a threshold that holds no other figure at its middle says nothing of the kind, even when a risk is read
    expect(noteWith(modView(), '‘extra sold per oven’ — tips at: >= 60 loaf/week/oven')).not.toMatch(/held at middle/)
  })

  it('it is the whole marker: the value as stored comes first, the conditions follow it, and no sentence of ours joins them', () => {
    const n = noteWith(modView(), '>= 0.8 oven')
    expect(n).toMatch(/^‘second oven’, ‘Sell 360 loaves a week’, ‘one oven’ — tips at: >= 0.8 oven; range: 1 oven; held at middle: .*; risk: ‘Oven repair’, not happened\./)
    expect(n).not.toMatch(/\b(only if|provided that|as long as|valid when|assuming)\b/i)
  })

  it('what worth and failure leave out (limits not covered, options not compared) is said beside them, not dropped', () => {
    const worth = noteWith(modView(), '— worth: a little')
    expect(worth).toMatch(/not covered: ‘Within budget’/)
    const failure = noteWith(modView(), '— missed: about 28%')
    expect(failure).toMatch(/not covered: ‘Within budget’/)
    // a fact that leaves nothing out says nothing of the kind
    expect(noteWith(modView(edit('F27', (f) => ({ ...f, about: { ...f.about, excluded_limits: [] } }))), '— worth: a little')).not.toMatch(/not covered/)
    const opts = noteWith(modView(edit('F27', (f) => ({ ...f, about: { ...f.about, excluded_options: ['longer_hours'] } }))), '— worth: a little')
    expect(opts).toMatch(/options not compared: ‘longer hours’/)
  })
})

describe('a secondary aim keeps its own exclusions (about.leaves; review 00008 #5)', () => {
  // The capacity Run, with a second aim whose chances carry their own left-out record (the primary aim\'s is "How the team feels about a new hire").
  const second = (mutate = (f) => f) => {
    const v = clone(base)
    v.version.form = clone(S5.capacity.form)
    const facts = clone(S5.capacity.facts)
    v.version.form.records.push({ family: 'goal', id: 'turnover_goal', label: 'Keep turnover down', question: null, origin: { by: 'person', quote: 'turnover' }, measure: { quantity: 'total_capacity', per: null, cmp: '>=', target: 'capacity_target', frame: 'level', reference: null, aggregation: 'end', window: null, measure_by: 'person', assumptions: [], exclusions: ['turnover_left_out'] } })
    v.version.form.records.push({ family: 'left_out', id: 'turnover_left_out', text: 'People who leave for other reasons', why: 'Not modelled.', question: null, concerns: [], origin: { by: 'olumi', basis: '' } })
    const sampled = facts.find((f) => f.about.kind === 'chance' && f.about.option === 'add_one')
    const fixed = facts.find((f) => f.about.kind === 'chance' && f.about.option === 'hold')
    v.version.facts = [...facts, mutate({ ...clone(sampled), id: 'F50', about: { ...clone(sampled.about), goal: 'turnover_goal', leaves: ['turnover_left_out'] } }),
      mutate({ ...clone(fixed), id: 'F51', about: { ...clone(fixed.about), goal: 'turnover_goal', leaves: ['turnover_left_out'] } })]
    return v
  }
  it('a sampled chance of a second aim says what that aim leaves out', () => {
    const n = notesOf(second()).find((x) => x.startsWith('about 50%: ') && /‘Keep turnover down’/.test(x))
    expect(n).toBeDefined()
    expect(n).toContain('It leaves out: People who leave for other reasons.')
    // not the first aim\'s exclusion, which is its own note
    expect(n).not.toContain('How the team feels about a new hire')
  })
  it('a fixed chance of a second aim says it too, and the first aim\'s exclusions are still said once for the first aim', () => {
    const n = notesOf(second()).find((x) => /^never meets: /.test(x) && /‘Keep turnover down’/.test(x))
    expect(n).toContain('It leaves out: People who leave for other reasons.')
    expect(notesOf(second()).filter((x) => /^This leaves out: /.test(x))).toEqual(['This leaves out: How the team feels about a new hire.'])
  })
  it('changing what the second aim leaves out changes what is shown; an aim that leaves nothing out says nothing', () => {
    const none = notesOf(second((f) => ({ ...f, about: { ...f.about, leaves: [] } }))).find((x) => x.startsWith('about 50%: ') && /‘Keep turnover down’/.test(x))
    expect(none).not.toMatch(/leaves out/i)
    const both = notesOf(second((f) => ({ ...f, about: { ...f.about, leaves: ['turnover_left_out', 'morale_left_out'] } }))).find((x) => x.startsWith('about 50%: ') && /‘Keep turnover down’/.test(x))
    expect(both).toContain('It leaves out: People who leave for other reasons; How the team feels about a new hire.')
  })
})

describe('approved and proposed links and calculations read differently (provenance wording; review 00008, non-blocking)', () => {
  const m = byId(clone(S5.capacity.form))
  it('a link or calculation Olumi proposed that is approved is said as approved; one still proposed is "not yet approved"', () => {
    const only = (key, approval) => restsWords({ [key]: [{ id: 'x', approval }] }, m)
    for (const [key, noun] of [['olumi_links', 'links'], ['olumi_mechanisms', 'calculations']]) {
      const proposed = only(key, 'proposed'), approved = only(key, 'approved')
      expect(proposed, key).toMatch(new RegExp(`${noun} Olumi proposed \\(not yet approved\\)`))
      expect(approved, key).toMatch(new RegExp(`${noun} Olumi proposed \\(approved\\)`))
      expect(approved, key).not.toMatch(/not yet approved/)
    }
  })
  it('both states together are both said', () => {
    const w = restsWords({ olumi_links: [{ id: 'a', approval: 'approved' }, { id: 'b', approval: 'proposed' }] }, m)
    expect(w).toContain('links Olumi proposed (approved)')
    expect(w).toContain('links Olumi proposed (not yet approved)')
  })
})
